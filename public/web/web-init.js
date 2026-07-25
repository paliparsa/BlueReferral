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

  /* ── Enhanced Global Command Palette (⌘K) ── */
  window.openCommandPalette = window.openWebCommandPalette = function () {
    const cp = $('cmdPalette');
    if (!cp) return;

    const q = (cp.querySelector('#cmdInput')?.value || '').trim().toLowerCase();

    // 1. Navigation items
    let commands = [
      { label: 'فروشگاه و محصولات', icon: '🛒', badge: 'صفحه اصلی', action: () => window.setTab?.('shop') },
      { label: 'سفارش‌های من', icon: '🧾', badge: 'پیگیری سفارشات', action: () => window.setTab?.('orders') },
      { label: 'کیف پول و شارژ حساب', icon: '💰', badge: 'موجودی', action: () => window.setTab?.('wallet') },
      { label: 'پروفایل و حساب کاربری', icon: '👤', badge: 'تنظیمات', action: () => window.setTab?.('home') },
      { label: 'پشتیبانی تلگرام', icon: '💬', badge: 'پاسخگویی ۲۴/۷', action: () => window.open('https://t.me/BlueGateSupport', '_blank') }
    ];

    // 2. Search products in catalog if state is available
    const prods = window.state?.shop_products || window.state?.products || [];
    if (Array.isArray(prods) && prods.length) {
      const prodCmds = prods.map(p => ({
        label: p.name || p.title || 'محصول',
        icon: '⚡',
        badge: (p.price ? Number(p.price).toLocaleString('fa-IR') + ' تومان' : 'محصول'),
        action: () => {
          if (typeof window.showProduct === 'function') {
            window.showProduct(p.id);
          } else {
            window.setTab?.('shop');
            const searchInp = $('searchInput');
            if (searchInp) {
              searchInp.value = p.name || p.title;
              searchInp.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }
        }
      }));
      commands = [...commands, ...prodCmds];
    }

    // 3. Admin options if user is admin
    if (window.state?.is_admin) {
      commands.push(
        { label: 'پنل مدیریت (داشبورد)', icon: '👑', badge: 'مدیریت', action: () => location.href = '?admin=1' },
        { label: 'مدیریت محصولات', icon: '📦', badge: 'ادمین', action: () => location.href = '?admin=1#products' },
        { label: 'مدیریت سفارش‌ها', icon: '🧾', badge: 'ادمین', action: () => location.href = '?admin=1#orders' }
      );
    }

    // Filter by search query
    const filtered = q
      ? commands.filter(c => c.label.toLowerCase().includes(q) || (c.badge && c.badge.toLowerCase().includes(q)))
      : commands;

    const listEl = cp.querySelector('#cmdList');
    if (listEl) {
      listEl.innerHTML = filtered.length
        ? filtered.map((c, i) => `
            <button class="cmd-item ${i === 0 ? 'selected' : ''}" data-web-cmd-idx="${i}">
              <span>${c.icon}</span>
              <b>${c.label}</b>
              ${c.badge ? `<span class="cmd-item-badge">${c.badge}</span>` : ''}
            </button>
          `).join('')
        : '<p class="muted" style="padding:16px;text-align:center;color:rgba(255,255,255,0.4)">هیچ نتیجه‌ای یافت نشد.</p>';
    }

    cp._webCmds = filtered;
    cp.classList.add('open');
    setTimeout(() => cp.querySelector('#cmdInput')?.focus(), 50);
  };

  // Command palette item click listener
  document.addEventListener('click', (e) => {
    const itemBtn = e.target.closest('[data-web-cmd-idx]');
    if (itemBtn) {
      const idx = Number(itemBtn.dataset.webCmdIdx);
      const cp = $('cmdPalette');
      if (cp && cp._webCmds && cp._webCmds[idx]) {
        cp._webCmds[idx].action();
        cp.classList.remove('open');
      }
    }
  });

  /* ── Header Cart Launcher & Badge Sync ── */
  $('webHeaderCartBtn')?.addEventListener('click', () => {
    if (typeof window.openCartSheet === 'function') window.openCartSheet();
    else $('cartFab')?.click();
  });

  const _syncCartBadge = () => {
    const count = typeof window.cartCount === 'function' ? window.cartCount() : 0;
    const badge = $('webCartCount');
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
  };

  const _origUpdateCartFab = window.updateCartFab;
  window.updateCartFab = function () {
    if (typeof _origUpdateCartFab === 'function') _origUpdateCartFab.apply(this, arguments);
    _syncCartBadge();
  };

  /* ── Global ⌘K Shortcut & KBD Click ── */
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      window.openWebCommandPalette();
    }
  });

  // Clicking kbd badge opens Command Palette
  document.querySelector('.web-search-kbd')?.addEventListener('click', (e) => {
    e.stopPropagation();
    window.openWebCommandPalette();
  });

  /* ── Desktop Tab Sync & Navigation Patch ── */
  function syncAllWebNavs() {
    const tab = window.currentTab || 'shop';
    document.querySelectorAll('.web-sidebar-btn, .web-nav-btn, .web-footer-btn, .bottom-nav button, .topbar-desktop-nav button').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    syncWebAuthBtn();
    _syncCartBadge();
  }

  // Global tab click listener
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab]');
    if (btn && btn.dataset.tab) {
      const tab = btn.dataset.tab;
      if (typeof window.setTab === 'function') {
        window.setTab(tab);
      } else {
        window.currentTab = tab;
        if (typeof window.renderUser === 'function') window.renderUser();
      }
      syncAllWebNavs();
    }
  });

  // Patch window.renderUser and window.setTab to sync navigation bars
  const _origRenderUser = window.renderUser;
  window.renderUser = function () {
    if (typeof _origRenderUser === 'function') _origRenderUser.apply(this, arguments);
    syncAllWebNavs();
  };

  const _origSetTab = window.setTab;
  window.setTab = function (tab) {
    if (typeof _origSetTab === 'function') _origSetTab(tab);
    else {
      window.currentTab = tab;
      if (typeof window.renderUser === 'function') window.renderUser();
    }
    syncAllWebNavs();
  };

  /* ── Phase 2: Enhanced Desktop Shop & Hero ── */
  window.renderShop = function () {
    const cats = window.state?.shop_categories || [];
    const prods = window.state?.shop_products || window.state?.products || [];
    const brand = window.state?.brand || 'BlueGate';
    const esc = (s) => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
    const mode = window.productCardMode || 'compact';

    const heroHtml = `
      <section class="web-desktop-hero" id="webDesktopHero">
        <div class="web-hero-content">
          <div class="web-hero-badge">⚡ مرجع تخصصی اشتراک‌های دیجیتال & هوش مصنوعی</div>
          <h1 class="web-hero-title">دسترسی فوری به <span class="hero-highlight">بهترین سرویس‌های دنیا</span></h1>
          <p class="web-hero-subtitle">خرید مستقیم و بدون واسطه اکانت‌های ChatGPT Plus، تلگرام پرمیوم، اسپاتیفای و سرویس‌های پرکاربرد با تحویل خودکار ۲۴ ساعته.</p>
          <div class="web-hero-trust">
            <div class="trust-item"><span>⚡</span><b>تحویل خودکار و آنی</b></div>
            <div class="trust-item"><span>🛡️</span><b>ضمانت ۱۰۰٪ کارکرد</b></div>
            <div class="trust-item"><span>💬</span><b>پشتیبانی زنده تلگرام</b></div>
          </div>
        </div>
      </section>
    `;

    const viewModeToggleHtml = `
      <div class="web-view-mode-toggle">
        <button class="view-btn ${mode !== 'detailed' ? 'active' : ''}" data-card-mode="compact" title="نمایش شبکه‌ای (Grid)">
          <span>🔲</span> <b>گرید</b>
        </button>
        <button class="view-btn ${mode === 'detailed' ? 'active' : ''}" data-card-mode="detailed" title="نمایش لیستی (List)">
          <span>≡</span> <b>لیست</b>
        </button>
      </div>
    `;

    const shopHtml = `
      ${heroHtml}
      <div class="shop-header-sticky">
        <div class="searchbar-modern">
          <span class="search-icon">🔍</span>
          <input id="searchInput" autocomplete="off" inputmode="search" placeholder="جستجوی محصول، اشتراک (ChatGPT، Telegram...)" value="${esc(window.searchTerm || '')}">
          <div class="quick-toggles">
            <button class="icon-toggle ${window.shopFilterWishlist ? 'active' : ''}" data-shop-toggle="wishlist" title="نشان‌شده">${window.shopFilterWishlist ? '❤️' : '🤍'}</button>
            <button class="icon-toggle ${window.shopFilterInStock ? 'active' : ''}" data-shop-toggle="instock" title="فقط آنی">${window.shopFilterInStock ? '⚡' : '📦'}</button>
          </div>
        </div>

        <div class="shop-controls-row">
          <div class="segmented-control">
            <button class="${window.shopSort === 'newest' ? 'active' : ''}" data-shop-sort="newest">جدیدترین</button>
            <button class="${window.shopSort === 'price_low' ? 'active' : ''}" data-shop-sort="price_low">ارزان‌ترین</button>
            <button class="${window.shopSort === 'price_high' ? 'active' : ''}" data-shop-sort="price_high">گران‌ترین</button>
          </div>
          ${viewModeToggleHtml}
        </div>

        <div class="category-strip modern-cats">
          <button class="cat-pill ${window.activeCategory === 'all' ? 'active' : ''}" data-cat="all"><span>✨</span><b>همه</b></button>
          <button class="cat-pill ${window.activeCategory === 'featured' ? 'active' : ''}" data-cat="featured"><span>⭐</span><b>ویژه</b></button>
          ${cats.map(c => `<button class="cat-pill ${Number(window.activeCategory) === Number(c.id) ? 'active' : ''}" data-cat="${c.id}">${c.image_url ? `<img src="${esc(c.image_url)}">` : `<span>${esc(c.emoji || '🛒')}</span>`}<b>${esc(c.title)}</b></button>`).join('')}
        </div>
      </div>
      <div id="shopSections">${typeof window.shopSectionsHtml === 'function' ? window.shopSectionsHtml() : ''}</div>
    `;

    const shopPage = document.getElementById('shopPage');
    if (shopPage) shopPage.innerHTML = shopHtml;
  };

  // Card view mode toggle listener (Grid vs List)
  document.addEventListener('click', (e) => {
    const modeBtn = e.target.closest('[data-card-mode]');
    if (modeBtn && modeBtn.dataset.cardMode) {
      const mode = modeBtn.dataset.cardMode;
      if (typeof window.setProductCardMode === 'function') {
        window.setProductCardMode(mode);
      } else {
        window.productCardMode = mode;
        localStorage.setItem('blue_ref_card_mode', mode);
        if (typeof window.renderShop === 'function') window.renderShop();
      }
    }
  });

  /* ── Phase 3: 3D Card Tilt & Copy Glow FX ── */
  document.addEventListener('mousemove', (e) => {
    const card = e.target.closest('.luxury-bank-card');
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const rotY = (x / rect.width) * 16;
    const rotX = -(y / rect.height) * 16;
    card.style.transform = `perspective(1000px) rotateY(${rotY}deg) rotateX(${rotX}deg)`;
  });

  document.addEventListener('mouseleave', (e) => {
    const card = e.target.closest('.luxury-bank-card');
    if (card) {
      card.style.transform = 'perspective(1000px) rotateY(0deg) rotateX(0deg)';
    }
  }, true);

  // Copy card button glow feedback
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-copy]');
    if (btn) {
      const card = btn.closest('.luxury-bank-card');
      if (card) {
        card.classList.add('copied-glow');
        setTimeout(() => card.classList.remove('copied-glow'), 1200);
      }
    }
  });

  /* ── Phase 3: Drag-and-Drop Receipt Dropzone ── */
  function initReceiptDropzone() {
    const dropzone = $('receiptDropzone');
    const fileInput = $('dialogFileInput');
    const previewBox = $('dropzonePreview');
    if (!dropzone || !fileInput) return;

    // Show dropzone if file input is visible
    const observer = new MutationObserver(() => {
      const isFileVisible = fileInput.style.display !== 'none';
      dropzone.style.display = isFileVisible ? 'flex' : 'none';
    });
    observer.observe(fileInput, { attributes: true, attributeFilter: ['style'] });

    dropzone.addEventListener('click', () => fileInput.click());

    ['dragenter', 'dragover'].forEach(evt => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(evt => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length && files[0].type.startsWith('image/')) {
        fileInput.files = files;
        showFilePreview(files[0]);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) {
        showFilePreview(fileInput.files[0]);
      }
    });

    function showFilePreview(file) {
      if (!previewBox) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        previewBox.innerHTML = `<img src="${e.target.result}" alt="رسید انتخاب شده">`;
        previewBox.classList.remove('hidden');
        dropzone.querySelector('.dropzone-title').textContent = '✅ تصویر رسید انتخاب شد';
        dropzone.querySelector('.dropzone-subtitle').textContent = file.name;
      };
      reader.readAsDataURL(file);
    }
  }

  // Initialize receipt dropzone once DOM is ready
  setTimeout(initReceiptDropzone, 300);

  /* ── Poll to initialize topbar & auth state on load ── */
  const _patchTimer = setInterval(() => {
    if (typeof window.openAuthModal === 'undefined') {
      window.openAuthModal = openAuthModal;
    }

    if (window.state) {
      clearInterval(_patchTimer);
      syncAllWebNavs();

      // Auto-open shop tab on first load
      if (!localStorage.getItem('blue_ref_web_first_load')) {
        localStorage.setItem('blue_ref_web_first_load', '1');
        if (typeof window.setTab === 'function') window.setTab('shop');
      }
    }
  }, 100);

  window.openAuthModal = openAuthModal;

  /* ── Logout helper ── */
  window.webLogout = function () {
    localStorage.removeItem(WEB_TOKEN_KEY);
    showStatus('از حساب کاربری خارج شدید');
    setTimeout(() => location.reload(), 700);
  };

  console.log('[WebInit] BlueGate Web Mode Phase 3 Fixed & Operational ✅');
})();
