const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}
const initData = tg?.initData || '';
let state = null;
let pendingDialog = null;

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

  $('leaderboard').innerHTML = (data.leaderboard || []).map((r, i) => {
    const medal = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : numberFa(i + 1)));
    return `<div class="rank"><div><b>${medal} ${escapeHtml(r.name || 'کاربر')}</b><br><small>${numberFa(r.referrals)} دعوت</small></div><strong>${fmt(r.earned)}</strong></div>`;
  }).join('') || '<p class="muted">هنوز کسی وارد لیدربورد نشده.</p>';
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
