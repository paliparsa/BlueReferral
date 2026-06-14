const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }
const initData = tg?.initData || '';
let state = null;
let pendingDialog = null;
let selectedCategory = 0;
let searchTerm = '';

const $ = (id) => document.getElementById(id);
const fmt = (n) => `${Number(n || 0).toLocaleString('fa-IR')} تومان`;
const numberFa = (n) => Number(n || 0).toLocaleString('fa-IR');
const escapeHtml = (str) => String(str ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function setAccent(color) { if (!color) return; document.documentElement.style.setProperty('--accent', color); localStorage.setItem('bg_accent', color); tg?.setHeaderColor?.(color); tg?.setBackgroundColor?.('#07111f'); }
function showStatus(text, type = 'success') { const el = $('status'); el.textContent = text; el.className = `status glass ${type}`; setTimeout(() => el.classList.add('hidden'), 4500); }
async function api(action, payload = {}) { const res = await fetch('/api.php', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action, initData, ...payload }) }); const data = await res.json().catch(() => ({})); if (!res.ok || data.ok === false) throw new Error(data.message || data.error || 'خطا در ارتباط با سرور'); return data; }
function statusSteps(timeline = []) { if (!timeline.length) return ''; return `<div class="timeline">${timeline.map(e => `<div><b>${escapeHtml(e.title)}</b><small>${escapeHtml(e.created_at || '')}</small></div>`).join('')}</div>`; }

function render(data) {
  state = data;
  setAccent(localStorage.getItem('bg_accent') || data.theme_color || '#1d9bf0');
  $('brand').textContent = data.brand || 'BlueGate';
  $('balance').textContent = fmt(data.user.balance);
  $('earned').textContent = fmt(data.user.total_earned);
  $('refs').textContent = numberFa(data.user.referrals_count);
  $('spins').textContent = numberFa(data.user.spin_balance);
  $('vipEmoji').textContent = data.user.vip.emoji || '💎';
  $('vipTitle').textContent = data.user.vip.fa || data.user.vip.name;
  $('vipText').textContent = data.user.vip.next ? `تا سطح بعدی ${numberFa(data.user.vip.next - data.user.referrals_count)} دعوت دیگر لازم داری. سطح مشتری: ${data.user.customer?.tier?.emoji || ''} ${data.user.customer?.tier?.fa || ''}` : `بالاترین سطح همکاری فعال است. سطح مشتری: ${data.user.customer?.tier?.emoji || ''} ${data.user.customer?.tier?.fa || ''}`;
  $('refLink').textContent = data.user.referral_link;
  $('startReward').textContent = `هر دعوت ${fmt(data.start_reward)}`;
  $('todayRefs').textContent = `امروز ${numberFa(data.user.today_referrals)} دعوت`;
  $('minWithdraw').textContent = `حداقل برداشت: ${fmt(data.min_withdraw)}`;
  $('missions').innerHTML = (data.missions || []).map(m => `<div class="mission"><div><b>${m.claimed ? '✅' : (m.done ? '🎁' : '⏳')} ${numberFa(m.target)} دعوت امروز</b><br><span>${m.claimed ? 'دریافت شد' : (m.done ? 'آماده دریافت' : 'در حال انجام')}</span></div><strong>${fmt(m.reward)}</strong></div>`).join('') || '<p class="muted">مأموریتی فعال نیست.</p>';
  renderShop(data);
  renderOrders(data);
  renderAdmin(data);
  $('leaderboard').innerHTML = (data.leaderboard || []).map((r, i) => `<div class="rank"><div><b>${i===0?'🥇':(i===1?'🥈':(i===2?'🥉':numberFa(i+1)))} ${escapeHtml(r.name || 'کاربر')}</b><br><small>${numberFa(r.referrals)} دعوت</small></div><strong>${fmt(r.earned)}</strong></div>`).join('') || '<p class="muted">هنوز کسی وارد لیدربورد نشده.</p>';
}

function renderShop(data) {
  const cats = data.shop_categories || [];
  let products = data.shop_products || [];
  if (!$('shopCats') || !$('products')) return;
  $('shopCats').innerHTML = `<button class="${selectedCategory===0?'active':''}" data-cat="0">همه</button><button class="${selectedCategory===-1?'active':''}" data-cat="-1">⭐ ویژه</button>` + cats.map(c => `<button class="${selectedCategory===c.id?'active':''}" data-cat="${c.id}">${escapeHtml(c.emoji || '🛒')} ${escapeHtml(c.title)}</button>`).join('');
  if (selectedCategory === -1) products = products.filter(p => Number(p.is_featured) === 1);
  else if (selectedCategory) products = products.filter(p => Number(p.category_id) === Number(selectedCategory));
  if (searchTerm) products = products.filter(p => `${p.name} ${p.short_description} ${p.full_description}`.toLowerCase().includes(searchTerm.toLowerCase()));
  $('products').innerHTML = products.map(p => {
    const variants = (p.variants || []).map(v => `<button class="secondary" data-buy="${p.id}" data-variant="${v.id}">${escapeHtml(v.title)} — ${fmt(v.price)}</button>`).join('');
    const img = p.image_url ? `<img class="product-img" src="${escapeHtml(p.image_url)}" alt="">` : '';
    return `<article class="product-card">${img}<h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.short_description || p.full_description || 'بدون توضیح')}</p><div class="product-meta"><span class="badge">${escapeHtml(p.delivery_type_fa)}</span><strong>${escapeHtml(p.price_label || fmt(p.price))}</strong></div><div class="product-meta"><small>پورسانت: ${escapeHtml(p.commission || '—')}</small><small>موجودی آماده: ${numberFa(p.inventory_available || 0)}</small></div><div class="card-actions">${variants || `<button class="primary" data-buy="${p.id}">ثبت سفارش</button>`}</div></article>`;
  }).join('') || '<p class="muted">فعلاً محصولی در این دسته نیست.</p>';
}
function renderOrders(data) {
  const orders = data.orders || [];
  $('orders').innerHTML = orders.map(o => `<article class="order-card"><h3>سفارش #${numberFa(o.id)} — ${escapeHtml(o.display_name || o.product_name)}</h3><div class="order-meta"><span class="badge">${escapeHtml(o.status_fa)}</span><strong>${fmt(o.final_amount)}</strong></div>${o.discount_amount > 0 ? `<p>تخفیف: ${fmt(o.discount_amount)} ${o.coupon_code ? ' | کد: ' + escapeHtml(o.coupon_code) : ''}</p>` : ''}${o.expires_at ? `<p>انقضا/مدت: ${escapeHtml(o.expires_at)}</p>` : ''}${statusSteps(o.timeline || [])}${o.delivery_text ? `<div class="delivery-box">${escapeHtml(o.delivery_text)}</div>` : ''}<div class="card-actions">${(o.status === 'pending_payment' || o.status === 'rejected') ? `<button class="primary" data-receipt="${o.id}">ارسال رسید</button>` : ''}${o.status === 'pending_payment' ? `<button class="secondary" data-coupon="${o.id}">کد تخفیف</button><button class="secondary" data-cancel="${o.id}">لغو</button>` : ''}</div></article>`).join('') || '<p class="muted">هنوز سفارشی نداری.</p>';
}
function renderAdmin(data) {
  if (!data.is_admin) { $('adminPanel')?.classList.add('hidden'); return; }
  $('adminPanel')?.classList.remove('hidden');
  $('adminSummary').innerHTML = `<div class="mini-stat"><b>ادمین</b><span>برای مدیریت کامل، از دکمه‌های پنل ادمین داخل ربات یا همین Mini Panel استفاده کن.</span></div><button class="primary" id="adminLoadBtn">بارگذاری گزارش فروش</button>`;
}
async function loadAdminSummary() { const data = await api('admin_summary'); const r = data.report || {}; $('adminSummary').innerHTML = `<div class="mini-stat"><b>امروز</b><span>${numberFa(r.today?.c || 0)} سفارش | ${fmt(r.today?.s || 0)}</span></div><div class="mini-stat"><b>این ماه</b><span>${numberFa(r.month?.c || 0)} سفارش | ${fmt(r.month?.s || 0)}</span></div><div class="mini-stat"><b>نیازمند اقدام</b><span>${numberFa(r.pending || 0)} سفارش</span></div>`; }
async function load() { if (!initData) { showStatus('این Mini App باید داخل تلگرام باز شود.', 'error'); return; } try { render(await api('me')); } catch(e) { showStatus(e.message, 'error'); } }
function openDialog(title, text, placeholder, onSubmit) { pendingDialog = onSubmit; $('dialogTitle').textContent = title; $('dialogText').textContent = text; $('dialogInput').value = ''; $('dialogInput').placeholder = placeholder || 'اینجا بنویس...'; $('inputDialog').showModal(); }

document.addEventListener('click', async (e) => {
  const cat = e.target.closest('[data-cat]'); if (cat) { selectedCategory = Number(cat.dataset.cat || 0); renderShop(state || {}); return; }
  const buy = e.target.closest('[data-buy]'); if (buy) { try { const data = await api('create_order', { product_id: Number(buy.dataset.buy), variant_id: buy.dataset.variant ? Number(buy.dataset.variant) : null }); render(data); showStatus(`سفارش #${numberFa(data.order?.id)} ثبت شد. حالا رسید پرداخت را ارسال کن.`); } catch(err) { showStatus(err.message, 'error'); } return; }
  const coupon = e.target.closest('[data-coupon]'); if (coupon) { const oid = Number(coupon.dataset.coupon); openDialog('ثبت کد تخفیف', `کد تخفیف سفارش #${numberFa(oid)} را وارد کن.`, 'BLUE10', async (value) => { const data = await api('apply_coupon', { order_id: oid, code: value }); render(data); return 'کد تخفیف اعمال شد.'; }); return; }
  const receipt = e.target.closest('[data-receipt]'); if (receipt) { const oid = Number(receipt.dataset.receipt); openDialog('ارسال رسید پرداخت', `توضیح پرداخت سفارش #${numberFa(oid)} را بنویس.`, 'شماره پیگیری / چهار رقم آخر کارت / توضیح پرداخت', async (value) => { const data = await api('submit_receipt', { order_id: oid, note: value }); render(data); return 'رسید پرداخت ثبت شد و منتظر بررسی ادمین است.'; }); return; }
  const cancel = e.target.closest('[data-cancel]'); if (cancel) { try { const data = await api('cancel_order', { order_id: Number(cancel.dataset.cancel) }); render(data); showStatus('سفارش لغو شد.'); } catch(err) { showStatus(err.message, 'error'); } return; }
  if (e.target.id === 'adminLoadBtn' || e.target.id === 'adminRefresh') { try { await loadAdminSummary(); } catch(err) { showStatus(err.message, 'error'); } }
});
$('shopSearch')?.addEventListener('input', (e) => { searchTerm = e.target.value || ''; renderShop(state || {}); });
$('refreshBtn').addEventListener('click', load);
$('copyLink').addEventListener('click', async () => { await navigator.clipboard.writeText(state?.user?.referral_link || ''); tg?.HapticFeedback?.notificationOccurred?.('success'); showStatus('لینک دعوت کپی شد.'); });
$('shareBtn').addEventListener('click', () => { const link = state?.user?.referral_link || ''; const text = `💙 با BlueGate هم اینترنت آزاد داشته باش، هم از دعوت دوستات درآمد بگیر!\n\n👥 با لینک من وارد ربات شو؛ فعالیتت زیرمجموعه من حساب می‌شه.\n🎁 پاداش دعوت، کیف پول، گردونه شانس و برداشت نقدی فعال است.\n\n🔗 ${link}`; tg?.openTelegramLink?.(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`); });
$('claimBtn').addEventListener('click', async () => { try { render(await api('claim_missions')); tg?.HapticFeedback?.notificationOccurred?.('success'); showStatus('مأموریت‌ها بررسی و پاداش‌های آماده ثبت شد.'); } catch(e) { showStatus(e.message, 'error'); } });
$('spinBtn').addEventListener('click', async () => { try { const data = await api('spin'); render(data); tg?.HapticFeedback?.impactOccurred?.('heavy'); showStatus(`جایزه گردونه: ${data.prize?.title || 'ثبت شد'}`); } catch(e) { showStatus(e.message, 'error'); } });
$('withdrawBtn').addEventListener('click', () => openDialog('درخواست برداشت', 'شماره کارت/شبا و نام صاحب حساب را وارد کن.', 'مثال: 6037... به نام ...', async (value) => { const data = await api('withdraw', { card_info: value }); render(data); return `درخواست برداشت ${fmt(data.withdraw_amount)} ثبت شد.`; }));
$('customCodeBtn').addEventListener('click', () => openDialog('کد دعوت اختصاصی', 'کد دلخواهت را وارد کن. فقط حروف انگلیسی، عدد و _ مجاز است.', 'parsa_blue', async (value) => { const data = await api('custom_code', { code: value }); render(data); return 'کد اختصاصی ذخیره شد.'; }));
$('supportBtn').addEventListener('click', () => tg?.openTelegramLink?.(`https://t.me/${state?.support_username || 'BlueGateSupport'}`));
$('dialogCancel').addEventListener('click', () => $('inputDialog').close());
$('dialogSubmit').addEventListener('click', async () => { const value = $('dialogInput').value.trim(); if (!value) return showStatus('ورودی خالی است.', 'error'); try { const msg = await pendingDialog(value); $('inputDialog').close(); tg?.HapticFeedback?.notificationOccurred?.('success'); showStatus(msg || 'ثبت شد.'); } catch(e) { showStatus(e.message, 'error'); } });
document.querySelectorAll('.theme-row button').forEach(btn => btn.addEventListener('click', () => setAccent(btn.dataset.color)));
setAccent(localStorage.getItem('bg_accent') || '#1d9bf0'); load();
