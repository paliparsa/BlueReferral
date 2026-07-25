/**
 * web-init.js — Web Mode Bridge for BlueGate Store
 * Patches the miniapp's app.js to work as a full web application:
 * 1. Replaces Telegram initData auth with web token auth
 * 2. Hooks auth modal for web login/register/OTP/Telegram Widget
 * 3. Syncs web topbar with miniapp state
 * 4. Injects Telegram Login Widget on demand
 * 5. Wires footer & sidebar navigation
 */
(function () {
  'use strict';

  const WEB_TOKEN_KEY = 'web_token';
  let _pendingOtpUserId = null;

  // Reactive state getter/setter so topbar syncs immediately whenever state changes
  let _st = window.state || null;
  try {
    Object.defineProperty(window, 'state', {
      get() { return _st; },
      set(val) {
        _st = val;
        try { syncWebAuthBtn(); } catch(e) {}
      },
      configurable: true
    });
  } catch(e) {}

  /* ── Helpers ── */
  const $ = (id) => document.getElementById(id);
  function showStatus(msg, type = 'success') {
    const el = $('status');
    if (!el) return;
    el.textContent = (type === 'error' ? '❌ ' : type === 'warning' ? '⚠️ ' : '✅ ') + msg;
    el.className = `toast ${type}`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 3500);
  }

  /* ── Patch miniapp API function to use web token ── */
  // The miniapp's api() already reads localStorage('web_token') and sends it.
  // We just need to ensure it uses multi-path resolution for the web.
  const _origFetch = window.fetch;
  window.fetch = function (url, options) {
    // Intercept /api.php calls and add fallback paths
    if (typeof url === 'string' && (url === '/api.php' || url === 'api.php')) {
      // Try current-relative first, then absolute
      const token = localStorage.getItem(WEB_TOKEN_KEY) || '';
      if (options && options.body) {
        try {
          const body = JSON.parse(options.body);
          if (!body.authToken && token) {
            body.authToken = token;
            options = { ...options, body: JSON.stringify(body) };
          }
        } catch (e) {}
      }
      // Use absolute path for web
      return _origFetch('/api.php', options).catch(() =>
        _origFetch('../api.php', options)
      );
    }
    return _origFetch.apply(this, arguments);
  };

  /* ── Auth Modal Tab Switcher ── */
  function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(b =>
      b.classList.toggle('active', b.dataset.authTab === tab)
    );
    $('loginForm')?.classList.toggle('hidden', tab !== 'login');
    $('registerForm')?.classList.toggle('hidden', tab !== 'register');
    $('telegramTab')?.classList.toggle('hidden', tab !== 'telegram');
    $('otpVerificationForm')?.classList.add('hidden');

    if (tab === 'telegram') injectTelegramWidget();
  }

  /* ── Inject Telegram Login Widget ── */
  function injectTelegramWidget() {
    const container = $('tgWidgetContainer');
    if (!container || container.querySelector('script[data-telegram-login]')) return;

    // Get bot username from state if loaded
    const botUsername = window.state?.bot_username || 'BlueGateBot';
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.dataset.telegramLogin = botUsername;
    script.dataset.size = 'large';
    script.dataset.radius = '14';
    script.dataset.onauth = '__webTelegramLoginCallback';
    script.dataset.requestAccess = 'write';
    container.innerHTML = '';
    container.appendChild(script);
  }

  /* ── Telegram Login Widget Callback ── */
  window.__webTelegramLoginCallback = async function (data) {
    try {
      const res = await fetch('/api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'telegram_login', auth_data: data })
      });
      const json = await res.json();
      if (json.auth_token) {
        localStorage.setItem(WEB_TOKEN_KEY, json.auth_token);
        closeAuthModal();
        showStatus('ورود با تلگرام موفقیت‌آمیز بود! 🎉');
        setTimeout(() => location.reload(), 600);
      } else {
        showStatus(json.message || 'خطا در ورود با تلگرام', 'error');
      }
    } catch (e) {
      showStatus('خطا در اتصال به سرور', 'error');
    }
  };

  /* ── Open / Close Auth Modal ── */
  function openAuthModal(tab = 'login') {
    const m = $('authModal');
    if (!m) return;
    switchAuthTab(tab);
    try { m.showModal(); } catch (e) {}
    m.setAttribute('open', '');
    m.classList.add('open');
  }
  function closeAuthModal() {
    const m = $('authModal');
    if (!m) return;
    try { m.close(); } catch (e) {}
    m.removeAttribute('open');
    m.classList.remove('open');
  }

  /* ── Web Topbar Auth Button Sync ── */
  function syncWebAuthBtn() {
    const btnText = $('webAuthBtnText');
    const btnIcon = $('webAuthBtnIcon');
    const token = localStorage.getItem(WEB_TOKEN_KEY);
    if (!btnText) return;

    if (token && window.state && window.state.user && !window.state.user.is_guest) {
      const u = window.state.user;
      const name = u.first_name || u.username || 'حساب من';
      const bal = Number(u.balance || 0).toLocaleString('fa-IR');
      btnText.textContent = `${name} (${bal} تومان)`;
      if (btnIcon) btnIcon.textContent = '👤';
      // Sync footer brand
      if ($('footerBrand') && window.state.brand) $('footerBrand').textContent = window.state.brand + ' Store';
      if ($('webBrandTitle') && window.state.brand) $('webBrandTitle').textContent = window.state.brand;
      // Support link
      if ($('footerSupportLink') && window.state.support_username) {
        $('footerSupportLink').href = `https://t.me/${window.state.support_username}`;
      }

      // If user is admin, inject Admin Panel buttons across header, nav, sidebar, and mobile bottom nav
      if (window.state.is_admin) {
        let adminHeaderBtn = $('webAdminHeaderBtn');
        if (!adminHeaderBtn) {
          adminHeaderBtn = document.createElement('a');
          adminHeaderBtn.id = 'webAdminHeaderBtn';
          adminHeaderBtn.href = '?admin=1';
          adminHeaderBtn.className = 'web-auth-btn';
          adminHeaderBtn.style.background = 'linear-gradient(135deg, #f59e0b, #ef4444)';
          adminHeaderBtn.style.marginRight = '8px';
          adminHeaderBtn.innerHTML = '<span>👑</span> <b>پنل مدیریت</b>';
          const actions = document.querySelector('.web-header-actions');
          if (actions) actions.insertBefore(adminHeaderBtn, actions.firstChild);
        }

        let adminNavBtn = $('webAdminNavBtn');
        if (!adminNavBtn) {
          adminNavBtn = document.createElement('a');
          adminNavBtn.id = 'webAdminNavBtn';
          adminNavBtn.href = '?admin=1';
          adminNavBtn.className = 'web-nav-btn';
          adminNavBtn.style.color = '#f59e0b';
          adminNavBtn.style.fontWeight = 'bold';
          adminNavBtn.innerHTML = '👑 مدیریت';
          const nav = document.querySelector('.web-header-nav');
          if (nav) nav.appendChild(adminNavBtn);
        }

        let adminSidebarBtn = $('webAdminSidebarBtn');
        if (!adminSidebarBtn) {
          adminSidebarBtn = document.createElement('a');
          adminSidebarBtn.id = 'webAdminSidebarBtn';
          adminSidebarBtn.href = '?admin=1';
          adminSidebarBtn.className = 'web-sidebar-btn';
          adminSidebarBtn.style.color = '#f59e0b';
          adminSidebarBtn.innerHTML = '<span>👑</span><b>پنل مدیریت</b>';
          const sidebarInner = document.querySelector('.web-sidebar-inner');
          if (sidebarInner) sidebarInner.appendChild(adminSidebarBtn);
        }

        let adminBottomBtn = $('webAdminBottomBtn');
        if (!adminBottomBtn) {
          adminBottomBtn = document.createElement('a');
          adminBottomBtn.id = 'webAdminBottomBtn';
          adminBottomBtn.href = '?admin=1';
          adminBottomBtn.style.cssText = 'color:#f59e0b; font-size:11px; text-decoration:none; display:flex; flex-direction:column; align-items:center; justify-content:center; flex:1;';
          adminBottomBtn.innerHTML = '<span style="font-size:18px">👑</span>مدیریت';
          const bottomNav = document.querySelector('.bottom-nav');
          if (bottomNav) bottomNav.appendChild(adminBottomBtn);
        }
      }
    } else if (!token) {
      btnText.textContent = 'ورود / ثبت‌نام';
      if (btnIcon) btnIcon.textContent = '🔑';
    }
  }

  /* ── Web topbar auth button click ── */
  document.getElementById('openAuthModalBtn')?.addEventListener('click', () => {
    const token = localStorage.getItem(WEB_TOKEN_KEY);
    if (token && window.state && !window.state.user?.is_guest) {
      // Already logged in → switch to home/profile tab
      if (typeof setTab === 'function') setTab('home');
      else if (typeof currentTab !== 'undefined') {
        window.currentTab = 'home';
        if (typeof renderUser === 'function') renderUser();
      }
    } else {
      openAuthModal('login');
    }
  });

  /* ── Auth Modal Tab clicks ── */
  document.querySelector('#authModal')?.addEventListener('click', (e) => {
    const tab = e.target.closest('.auth-tab');
    if (tab?.dataset.authTab) switchAuthTab(tab.dataset.authTab);

    // Close button
    if (e.target.id === 'closeAuthModal' || e.target.closest('#closeAuthModal')) {
      closeAuthModal();
    }
  });

  /* ── Login Form ── */
  $('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = $('loginUsername')?.value?.trim();
    const password = $('loginPassword')?.value;
    const errEl = $('loginError');
    if (errEl) errEl.classList.add('hidden');

    try {
      const res = await fetch('/api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', username, password })
      });
      const data = await res.json();
      if (data.requires_email_verification) {
        _pendingOtpUserId = data.user_id;
        if ($('otpEmailTarget')) $('otpEmailTarget').textContent = data.email || '';
        $('otpVerificationForm')?.classList.remove('hidden');
        $('loginForm')?.classList.add('hidden');
        $('authModal')?.querySelector('.auth-tabs')?.classList.add('hidden');
        showStatus(data.message || 'کد تایید ارسال شد 📩');
        return;
      }
      if (data.auth_token) {
        localStorage.setItem(WEB_TOKEN_KEY, data.auth_token);
        closeAuthModal();
        showStatus('ورود موفقیت‌آمیز بود! 🎉');
        setTimeout(() => location.reload(), 600);
      } else {
        if (errEl) { errEl.textContent = data.message || 'خطا در ورود'; errEl.classList.remove('hidden'); }
      }
    } catch (err) {
      if (errEl) { errEl.textContent = 'خطا در اتصال به سرور'; errEl.classList.remove('hidden'); }
    }
  });

  /* ── Register Form ── */
  $('registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = $('regUsername')?.value?.trim();
    const email = $('regEmail')?.value?.trim();
    const first_name = $('regFirstName')?.value?.trim();
    const password = $('regPassword')?.value;
    const ref_code = $('regRefCode')?.value?.trim();
    const errEl = $('regError');
    if (errEl) errEl.classList.add('hidden');

    try {
      const res = await fetch('/api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', username, email, first_name, password, ref_code })
      });
      const data = await res.json();
      if (data.requires_email_verification) {
        _pendingOtpUserId = data.user_id;
        if ($('otpEmailTarget')) $('otpEmailTarget').textContent = data.email || '';
        $('otpVerificationForm')?.classList.remove('hidden');
        $('registerForm')?.classList.add('hidden');
        $('authModal')?.querySelector('.auth-tabs')?.classList.add('hidden');
        showStatus(data.message || 'کد تایید ارسال شد 📩');
        return;
      }
      if (data.auth_token) {
        localStorage.setItem(WEB_TOKEN_KEY, data.auth_token);
        closeAuthModal();
        showStatus('حساب با موفقیت ساخته شد! 🎉');
        setTimeout(() => location.reload(), 600);
      } else {
        if (errEl) { errEl.textContent = data.message || 'خطا در ثبت‌نام'; errEl.classList.remove('hidden'); }
      }
    } catch (err) {
      if (errEl) { errEl.textContent = 'خطا در اتصال به سرور'; errEl.classList.remove('hidden'); }
    }
  });

  /* ── OTP Form ── */
  $('otpVerificationForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const otp = $('otpCodeInput')?.value?.trim();
    const errEl = $('otpError');
    if (errEl) errEl.classList.add('hidden');

    try {
      const res = await fetch('/api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_email_otp', user_id: _pendingOtpUserId, otp })
      });
      const data = await res.json();
      if (data.auth_token) {
        localStorage.setItem(WEB_TOKEN_KEY, data.auth_token);
        closeAuthModal();
        showStatus('ایمیل تایید شد! خوش اومدی 🎉');
        setTimeout(() => location.reload(), 600);
      } else {
        if (errEl) { errEl.textContent = data.message || 'کد تایید نادرست است'; errEl.classList.remove('hidden'); }
      }
    } catch (err) {
      if (errEl) { errEl.textContent = 'خطا در اتصال به سرور'; errEl.classList.remove('hidden'); }
    }
  });

  /* ── Resend OTP ── */
  $('resendOtpBtn')?.addEventListener('click', async () => {
    if (!_pendingOtpUserId) return;
    try {
      await fetch('/api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resend_email_otp', user_id: _pendingOtpUserId })
      });
      showStatus('کد جدید به ایمیل شما ارسال شد 📩');
    } catch (e) {
      showStatus('خطا در ارسال کد', 'error');
    }
  });

  /* ── Web sidebar & footer navigation ── */
  document.querySelectorAll('[data-tab]').forEach(btn => {
    if (btn.closest('.web-sidebar, .web-site-footer, .web-header-nav')) {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab && typeof window.setTab === 'function') {
          window.setTab(tab);
        } else if (tab) {
          window.currentTab = tab;
          if (typeof renderUser === 'function') renderUser();
        }
      });
    }
  });

  /* ── If app.js exposes openAuthModal, patch it ── */
  // Poll briefly to patch after app.js loads
  const _patchTimer = setInterval(() => {
    // Expose openAuthModal to miniapp
    if (typeof window.openAuthModal === 'undefined') {
      window.openAuthModal = openAuthModal;
    }

    // Sync topbar once state is loaded
    if (window.state && window.state.user) {
      clearInterval(_patchTimer);
      syncWebAuthBtn();

      // Auto-open shop tab on first load
      if (!localStorage.getItem('blue_ref_web_first_load')) {
        localStorage.setItem('blue_ref_web_first_load', '1');
        if (typeof window.setTab === 'function') window.setTab('shop');
      }
    }
  }, 200);

  /* ── Handle AUTH_REQUIRED from app.js api() errors ── */
  // app.js already calls openAuthModal() on AUTH_REQUIRED - we just need it defined
  window.openAuthModal = openAuthModal;

  /* ── Logout helper (expose to miniapp) ── */
  window.webLogout = function () {
    localStorage.removeItem(WEB_TOKEN_KEY);
    showStatus('از حساب کاربری خارج شدید');
    setTimeout(() => location.reload(), 700);
  };

  /* ── Reflect tab changes in web sidebar ── */
  const _origRenderUser = window.renderUser;
  const _syncSidebar = () => {
    const tab = window.currentTab || 'shop';
    document.querySelectorAll('.web-sidebar-btn, .web-nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    document.querySelectorAll('.bottom-nav button').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    syncWebAuthBtn();
  };
  // Observe DOM mutations to catch renderUser calls
  new MutationObserver(_syncSidebar).observe(document.getElementById('homePage') || document.body, {
    childList: true, subtree: false
  });

  console.log('[WebInit] BlueGate Web Mode initialized ✅');
})();
