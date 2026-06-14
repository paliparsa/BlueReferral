const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}
const initData = tg?.initData || '';
let state = null;
let pendingDialog = null;
let selectedCategory = 0;

const $ = (id) => document.getElementById(id);
const fmt = (n) => `${Number(n || 0).toLocaleString('fa-IR')} تومان`;
const numberFa = (n) => Number(n || 0).toLocaleString('fa-IR');

function setAccent(color) {
  if (!color) return;
  document.documentElement.style.setProperty('--accent', color);
  localStorage.setItem('bg_accent', color);
  tg?.setHeaderColor?.(color);
  tg?.setBackgroundColor?.('#07111f');
}
function showStatus(text, type = 'success') {
  const el = $('status');
  el.textContent = text;
  el.className = `status glass ${type}`;
  setTimeout(() => el.classList.add('hidden'), 4200);
}
async function api(action, payload = {}) {
  const res = await fetch('/api.php', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ action, initData, ...payload })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.error || 'خطا در ارتباط با سرور');
  }
  return data;
}
function render(data) {
  state = data;
  const localAccent = localStorage.getItem('bg_accent');
  setAccent(localAccent || data.theme_color || '#1d9bf0');
  $('brand').textContent = data.brand || 'BlueGate';
  $('balance').textContent = fmt(data.user.balance);
  $('earned').textContent = fmt(data.user.total_earned);
  $('refs').textContent = numberFa(data.user.referrals_count);
  $('spins').textContent = numberFa(data.user.spin_balance);
  $('vipEmoji').textContent = data.user.vip.emoji || '💎';
  $('vipTitle').textContent = data.user.vip.fa || data.user.vip.name;
  $('vipText').textContent = data.user.vip.next ? `تا سطح بعدی ${numberFa(data.user.vip.next - data.user.referrals_count)} دعوت دیگر لازم داری.` : 'بالاترین سطح همکاری فعال است.';
  $('refLink').textContent = data.user.referral_link;
  $('startReward').textContent = `هر دعوت ${fmt(data.start_reward)}`;
  $('todayRefs').textContent = `امروز ${numberFa(data.user.today_referrals)} دعوت`;
  $('minWithdraw').textContent = `حداقل برداشت: ${fmt(data.min_withdraw)}`;

  $('missions').innerHTML = (data.missions || []).map(m => {
    const icon = m.claimed ? '✅' : (m.done ? '🎁' : '⏳');
    const status = m.claimed ? 'دریافت شد' : (m.done ? 'آماده دریافت' : 'در حال انجام');
    return `<div class="mission"><div><b>${icon} ${numberFa(m.target)} دعوت امروز</b><br><span>${status}</span></div><strong>${fmt(m.reward)}</strong></div>`;
  }).join('') || '<p class="muted">مأموریتی فعال نیست.</p>';

  renderShop(data);

  $('leaderboard').innerHTML = (data.leaderboard || []).map((r, i) => {
    const medal = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : numberFa(i + 1)));
    return `<div class="rank"><div><b>${medal} ${escapeHtml(r.name || 'کاربر')}</b><br><small>${numberFa(r.referrals)} دعوت</small></div><strong>${fmt(r.earned)}</strong></div>`;
  }).join('') || '<p class="muted">هنوز کسی وارد لیدربورد نشده.</p>';
}

function renderShop(data) {
  const cats = data.shop_categories || [];
  const products = data.shop_products || [];
  const orders = data.orders || [];
  if (!$('shopCats') || !$('products') || !$('orders')) return;
  const allBtn = `<button class="${selectedCategory === 0 ? 'active' : ''}" data-cat="0">همه</button>`;
  $('shopCats').innerHTML = allBtn + cats.map(c => `<button class="${selectedCategory === c.id ? 'active' : ''}" data-cat="${c.id}">${escapeHtml(c.emoji || '🛒')} ${escapeHtml(c.title)}</button>`).join('');
  const filtered = selectedCategory ? products.filter(p => Number(p.category_id) === Number(selectedCategory)) : products;
  $('products').innerHTML = filtered.map(p => `
    <article class="product-card">
      <h3>${escapeHtml(p.name)}</h3>
      <p>${escapeHtml(p.short_description || p.full_description || 'بدون توضیح')}</p>
      <div class="product-meta"><span class="badge">${escapeHtml(p.delivery_type_fa)}</span><strong>${fmt(p.price)}</strong></div>
      <div class="product-meta"><small>پورسانت معرف: ${escapeHtml(p.commission || '—')}</small></div>
      <div class="card-actions"><button class="primary" data-buy="${p.id}">ثبت سفارش</button></div>
    </article>`).join('') || '<p class="muted">فعلاً محصولی در این دسته نیست.</p>';
  $('orders').innerHTML = orders.map(o => `
    <article class="order-card">
      <h3>سفارش #${numberFa(o.id)} — ${escapeHtml(o.product_name)}</h3>
      <div class="order-meta"><span class="badge">${escapeHtml(o.status_fa)}</span><strong>${fmt(o.final_amount)}</strong></div>
      ${o.discount_amount > 0 ? `<p>تخفیف: ${fmt(o.discount_amount)} ${o.coupon_code ? ' | کد: ' + escapeHtml(o.coupon_code) : ''}</p>` : ''}
      ${o.delivery_text ? `<div class="delivery-box">${escapeHtml(o.delivery_text)}</div>` : ''}
      <div class="card-actions">
        ${(o.status === 'pending_payment' || o.status === 'rejected') ? `<button class="primary" data-receipt="${o.id}">ارسال رسید</button>` : ''}
        ${o.status === 'pending_payment' ? `<button class="secondary" data-coupon="${o.id}">کد تخفیف</button><button class="secondary" data-cancel="${o.id}">لغو</button>` : ''}
      </div>
    </article>`).join('') || '<p class="muted">هنوز سفارشی نداری.</p>';
}

function escapeHtml(str) {
  return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
async function load() {
  if (!initData) {
    showStatus('این Mini App باید داخل تلگرام باز شود.', 'error');
    return;
  }
  try { render(await api('me')); }
  catch (e) { showStatus(e.message, 'error'); }
}
function openDialog(title, text, placeholder, onSubmit) {
  pendingDialog = onSubmit;
  $('dialogTitle').textContent = title;
  $('dialogText').textContent = text;
  $('dialogInput').value = '';
  $('dialogInput').placeholder = placeholder || 'اینجا بنویس...';
  $('inputDialog').showModal();
}


document.addEventListener('click', async (e) => {
  const cat = e.target.closest('[data-cat]');
  if (cat) { selectedCategory = Number(cat.dataset.cat || 0); renderShop(state || {}); return; }
  const buy = e.target.closest('[data-buy]');
  if (buy) {
    try { const data = await api('create_order', { product_id: Number(buy.dataset.buy) }); render(data); showStatus(`سفارش #${numberFa(data.order?.id)} ثبت شد. حالا رسید پرداخت را ارسال کن.`); }
    catch (err) { showStatus(err.message, 'error'); }
    return;
  }
  const coupon = e.target.closest('[data-coupon]');
  if (coupon) {
    const oid = Number(coupon.dataset.coupon);
    openDialog('ثبت کد تخفیف', `کد تخفیف سفارش #${numberFa(oid)} را وارد کن.`, 'BLUE10', async (value) => {
      const data = await api('apply_coupon', { order_id: oid, code: value }); render(data); return 'کد تخفیف اعمال شد.';
    });
    return;
  }
  const receipt = e.target.closest('[data-receipt]');
  if (receipt) {
    const oid = Number(receipt.dataset.receipt);
    openDialog('ارسال رسید پرداخت', `توضیح پرداخت سفارش #${numberFa(oid)} را بنویس. برای ارسال عکس رسید، از داخل خود بات هم می‌توانی استفاده کنی.`, 'شماره پیگیری / چهار رقم آخر کارت / توضیح پرداخت', async (value) => {
      const data = await api('submit_receipt', { order_id: oid, note: value }); render(data); return 'رسید پرداخت ثبت شد و منتظر بررسی ادمین است.';
    });
    return;
  }
  const cancel = e.target.closest('[data-cancel]');
  if (cancel) {
    try { const data = await api('cancel_order', { order_id: Number(cancel.dataset.cancel) }); render(data); showStatus('سفارش لغو شد.'); }
    catch (err) { showStatus(err.message, 'error'); }
  }
});

$('refreshBtn').addEventListener('click', load);
$('copyLink').addEventListener('click', async () => {
  await navigator.clipboard.writeText(state?.user?.referral_link || '');
  tg?.HapticFeedback?.notificationOccurred?.('success');
  showStatus('لینک دعوت کپی شد.');
});
$('shareBtn').addEventListener('click', () => {
  const link = state?.user?.referral_link || '';
  const text = `💙 با BlueGate هم اینترنت آزاد داشته باش، هم از دعوت دوستات درآمد بگیر!\n\n👥 با لینک من وارد ربات شو؛ فعالیتت زیرمجموعه من حساب می‌شه.\n🎁 پاداش دعوت، کیف پول، گردونه شانس و برداشت نقدی فعال است.\n\n🔗 ${link}`;
  tg?.openTelegramLink?.(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
});
$('claimBtn').addEventListener('click', async () => {
  try { render(await api('claim_missions')); tg?.HapticFeedback?.notificationOccurred?.('success'); showStatus('مأموریت‌ها بررسی و پاداش‌های آماده ثبت شد.'); }
  catch (e) { showStatus(e.message, 'error'); }
});
$('spinBtn').addEventListener('click', async () => {
  try {
    const data = await api('spin');
    render(data);
    tg?.HapticFeedback?.impactOccurred?.('heavy');
    showStatus(`جایزه گردونه: ${data.prize?.title || 'ثبت شد'}`);
  } catch (e) { showStatus(e.message, 'error'); }
});
$('withdrawBtn').addEventListener('click', () => {
  openDialog('درخواست برداشت', 'شماره کارت/شبا و نام صاحب حساب را وارد کن.', 'مثال: 6037... به نام ...', async (value) => {
    const data = await api('withdraw', { card_info: value });
    render(data);
    return `درخواست برداشت ${fmt(data.withdraw_amount)} ثبت شد.`;
  });
});
$('customCodeBtn').addEventListener('click', () => {
  openDialog('کد دعوت اختصاصی', 'کد دلخواهت را وارد کن. فقط حروف انگلیسی، عدد و _ مجاز است.', 'parsa_blue', async (value) => {
    const data = await api('custom_code', { code: value });
    render(data);
    return 'کد اختصاصی ذخیره شد.';
  });
});
$('supportBtn').addEventListener('click', () => tg?.openTelegramLink?.(`https://t.me/${state?.support_username || 'BlueGateSupport'}`));
$('dialogCancel').addEventListener('click', () => $('inputDialog').close());
$('dialogSubmit').addEventListener('click', async () => {
  const value = $('dialogInput').value.trim();
  if (!value) return showStatus('ورودی خالی است.', 'error');
  try {
    const msg = await pendingDialog(value);
    $('inputDialog').close();
    tg?.HapticFeedback?.notificationOccurred?.('success');
    showStatus(msg || 'ثبت شد.');
  } catch (e) { showStatus(e.message, 'error'); }
});
document.querySelectorAll('.theme-row button').forEach(btn => btn.addEventListener('click', () => setAccent(btn.dataset.color)));

setAccent(localStorage.getItem('bg_accent') || '#1d9bf0');
load();
