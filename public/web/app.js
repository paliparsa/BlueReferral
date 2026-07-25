/* =========================================================
   BlueGate Store — Standalone Web Application Engine
   Fully wired for catalog rendering, auth modal, cart, orders, wallet, & admin
   ========================================================= */

(function () {
  'use strict';

  /* ── State Management ── */
  const state = {
    user: null,
    is_admin: false,
    categories: [],
    products: [],
    cart: JSON.parse(localStorage.getItem('bg_web_cart') || '[]'),
    wishlist: JSON.parse(localStorage.getItem('bg_web_wishlist') || '[]'),
    currentTab: 'shop',
    searchTerm: '',
    activeCategory: 'all',
    shopSort: 'newest',
    filterInStock: false,
    filterWishlist: false,
  };

  /* ── Utility Helpers ── */
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const nf = (n) => Number(n || 0).toLocaleString('fa-IR');
  const priceLabel = (p) => `${nf(p)} تومان`;

  /* ── Toast Notifications ── */
  function showToast(msg, type = 'info') {
    const container = $('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `web-toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /* ── API Service Connector ── */
  async function api(action, params = {}, method = 'GET', body = null) {
    const query = new URLSearchParams({ action, ...params }).toString();
    const url = `/web/api.php?${query}`;
    const token = localStorage.getItem('bg_web_token');

    const headers = { 'Accept': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['X-Web-Token'] = token;
    }
    if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : null
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.error(`API Error [${action}]:`, err);
      return { ok: false, error: 'SERVER_ERROR', message: 'خطا در ارتباط با سرور' };
    }
  }

  /* ── Init App Payload ── */
  async function initApp() {
    const token = localStorage.getItem('bg_web_token');
    let res = null;

    if (token) {
      res = await api('me');
    }
    if (!res || !res.ok) {
      res = await api('guest_dashboard_payload');
    }

    if (res && res.ok) {
      state.categories = res.shop_categories || [];
      state.products = res.shop_products || [];
      if (res.user) {
        state.user = res.user;
        state.is_admin = !!res.is_admin;
      }
    }

    renderApp();
    bindGlobalEvents();
  }

  /* ── Main App Renderer ── */
  function renderApp() {
    updateHeaderNav();
    updateCartCount();

    const app = $('app');
    if (!app) return;

    switch (state.currentTab) {
      case 'orders':
        renderOrdersView(app);
        break;
      case 'wallet':
        renderWalletView(app);
        break;
      case 'profile':
        renderProfileView(app);
        break;
      case 'admin':
        renderAdminView(app);
        break;
      case 'shop':
      default:
        renderShopView(app);
        break;
    }
  }

  function updateHeaderNav() {
    document.querySelectorAll('.nav-link').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === state.currentTab);
    });

    const userBtnText = $('user-btn-text');
    if (userBtnText) {
      if (state.user && !state.user.is_guest) {
        userBtnText.textContent = state.user.first_name || state.user.username || 'حساب کاربری';
      } else {
        userBtnText.textContent = 'ورود / ثبت‌نام';
      }
    }
  }

  function updateCartCount() {
    const countEl = $('cart-count');
    if (countEl) {
      const totalQty = state.cart.reduce((sum, item) => sum + (item.qty || 1), 0);
      countEl.textContent = totalQty;
    }
  }

  /* ── Shop View Renderer ── */
  function renderShopView(container) {
    const heroHtml = `
      <section class="web-hero-banner">
        <div class="hero-content">
          <div class="hero-badge">⚡ مرجع تخصصی اشتراک‌های دیجیتال &amp; هوش مصنوعی</div>
          <h1 class="hero-title">دسترسی فوری به <span class="hero-highlight">برترین سرویس‌های دنیا</span></h1>
          <p class="hero-subtitle">خرید مستقیم و بدون واسطه اکانت‌های ChatGPT Plus، تلگرام پرمیوم، اسپاتیفای و سرویس‌های کاربردی با تحویل خودکار ۲۴ ساعته.</p>
          <div class="hero-trust-row">
            <div class="trust-chip"><span>⚡</span><b>تحویل خودکار ۲۴/۷</b></div>
            <div class="trust-chip"><span>🛡️</span><b>ضمانت ۱۰۰٪ کارکرد</b></div>
            <div class="trust-chip"><span>💬</span><b>پشتیبانی زنده تلگرام</b></div>
          </div>
        </div>
      </section>
    `;

    const filtered = getFilteredProducts();

    const sidebarHtml = `
      <aside class="category-sidebar">
        <div class="sidebar-card">
          <h3 class="sidebar-title">📁 دسته‌بندی محصولات</h3>
          <div class="sidebar-cat-list">
            <button class="sidebar-cat-btn ${state.activeCategory === 'all' ? 'active' : ''}" data-cat="all">
              <span>✨</span><b>همه محصولات</b>
            </button>
            <button class="sidebar-cat-btn ${state.activeCategory === 'featured' ? 'active' : ''}" data-cat="featured">
              <span>⭐</span><b>سرویس‌های ویژه</b>
            </button>
            ${state.categories.map(c => `
              <button class="sidebar-cat-btn ${Number(state.activeCategory) === Number(c.id) ? 'active' : ''}" data-cat="${c.id}">
                ${c.image_url ? `<img src="${esc(c.image_url)}">` : `<span>${esc(c.emoji || '🛒')}</span>`}
                <b>${esc(c.title || c.name || 'دسته')}</b>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="sidebar-card">
          <h3 class="sidebar-title">⚙️ فیلترهای سریع</h3>
          <div class="sidebar-filter-list">
            <button class="sidebar-filter-btn ${state.filterInStock ? 'active' : ''}" id="toggle-instock">
              <span>${state.filterInStock ? '✅' : '📦'}</span> <b>فقط موجودی آنی</b>
            </button>
            <button class="sidebar-filter-btn ${state.filterWishlist ? 'active' : ''}" id="toggle-wishlist">
              <span>${state.filterWishlist ? '❤️' : '🤍'}</span> <b>نشان‌شده‌ها</b>
            </button>
          </div>
        </div>
      </aside>
    `;

    const gridHtml = filtered.length ? `
      <div class="product-grid">
        ${filtered.map(p => renderProductCard(p)).join('')}
      </div>
    ` : `
      <div style="text-align:center; padding:48px 20px; background:var(--card-dark); border-radius:20px;">
        <div style="font-size:48px; margin-bottom:12px;">🕵️‍♂️</div>
        <h3>محصولی پیدا نشد!</h3>
        <p style="color:var(--text-muted); font-size:14px;">با فیلترها و جستجوی فعلی محصولی یافت نشد.</p>
      </div>
    `;

    container.innerHTML = `
      ${heroHtml}
      <div class="storefront-layout">
        ${sidebarHtml}
        <section class="catalog-area">
          <div class="catalog-toolbar">
            <span style="font-size:13.5px; font-weight:700; color:var(--text-muted);">
              نمایش <b>${filtered.length}</b> محصول
            </span>
            <div class="sort-pills">
              <button class="sort-pill-btn ${state.shopSort === 'newest' ? 'active' : ''}" data-sort="newest">جدیدترین</button>
              <button class="sort-pill-btn ${state.shopSort === 'price_low' ? 'active' : ''}" data-sort="price_low">ارزان‌ترین</button>
              <button class="sort-pill-btn ${state.shopSort === 'price_high' ? 'active' : ''}" data-sort="price_high">گران‌ترین</button>
            </div>
          </div>
          ${gridHtml}
        </section>
      </div>
    `;
  }

  /* ── Filter Products ── */
  function getFilteredProducts() {
    let list = [...state.products];

    if (state.activeCategory === 'featured') {
      list = list.filter(p => Number(p.is_featured) === 1);
    } else if (state.activeCategory !== 'all') {
      list = list.filter(p => Number(p.category_id) === Number(state.activeCategory));
    }

    if (state.searchTerm) {
      const q = state.searchTerm.toLowerCase();
      list = list.filter(p => {
        const t = (p.title || p.name || '').toLowerCase();
        const d = (p.short_description || p.full_description || '').toLowerCase();
        return t.includes(q) || d.includes(q);
      });
    }

    if (state.filterInStock) {
      list = list.filter(p => Number(p.inventory_available || p.stock || 0) > 0 || (p.variants || []).some(v => Number(v.stock || 1) > 0));
    }

    if (state.filterWishlist) {
      list = list.filter(p => state.wishlist.includes(Number(p.id)));
    }

    if (state.shopSort === 'price_low') {
      list.sort((a, b) => Number(a.price) - Number(b.price));
    } else if (state.shopSort === 'price_high') {
      list.sort((a, b) => Number(b.price) - Number(a.price));
    } else {
      list.sort((a, b) => Number(b.id) - Number(a.id));
    }

    return list;
  }

  /* ── Product Card Component ── */
  function renderProductCard(p) {
    const title = p.title || p.name || 'محصول بدون عنوان';
    const isWished = state.wishlist.includes(Number(p.id));
    const discount = p.discount_percent ? `<span class="card-discount-badge">${p.discount_percent}% تخفیف</span>` : '';

    return `
      <div class="product-card" data-pid="${p.id}">
        <div class="card-img-wrap">
          ${discount}
          <button class="card-wishlist-btn" data-wishlist="${p.id}">${isWished ? '❤️' : '🤍'}</button>
          ${p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(title)}">` : `<span style="display:flex;align-items:center;justify-content:center;height:100%;font-size:56px;">🛒</span>`}
        </div>
        <div class="card-content">
          <h3 class="card-title">${esc(title)}</h3>
          <div class="card-price-row">
            <div class="card-price">
              ${priceLabel(p.price)}
              ${p.old_price ? `<s>${priceLabel(p.old_price)}</s>` : ''}
            </div>
            <button class="card-quick-buy-btn" data-buy="${p.id}">⚡ خرید آنی</button>
          </div>
        </div>
      </div>
    `;
  }

  /* ── Orders View Renderer ── */
  async function renderOrdersView(container) {
    container.innerHTML = `<div style="text-align:center; padding:40px;">⏳ در حال دریافت سفارش‌ها...</div>`;
    const res = await api('my_orders');
    const orders = (res && res.ok) ? (res.orders || []) : [];

    if (!orders.length) {
      container.innerHTML = `
        <div style="text-align:center; padding:60px 20px; background:var(--card-dark); border-radius:24px;">
          <div style="font-size:56px; margin-bottom:12px;">📜</div>
          <h3>هیچ سفارشی ثبت نشده است!</h3>
          <p style="color:var(--text-muted); margin-bottom:20px;">هنوز هیچ سفارشی در حساب شما ثبت نشده.</p>
          <button class="user-account-btn" data-tab="shop">شروع خرید از فروشگاه</button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <h2 style="font-size:24px; font-weight:900; margin-bottom:20px;">📜 تاریخچه سفارش‌های شما</h2>
      <div style="display:flex; flex-direction:column; gap:16px;">
        ${orders.map(o => `
          <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:18px; padding:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid var(--border-color); padding-bottom:10px;">
              <div>
                <b>سفارش #${o.id}</b>
                <small style="color:var(--text-muted); margin-right:10px;">${esc(o.created_at)}</small>
              </div>
              <span style="background:rgba(0,242,254,0.15); color:var(--cyan); font-weight:800; font-size:12px; padding:4px 12px; border-radius:12px;">
                ${esc(o.status_text || 'تکمیل شده')}
              </span>
            </div>
            <div style="font-size:14px; font-weight:700; margin-bottom:8px;">${esc(o.product_title || o.name || 'اشتراک دیجیتال')}</div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-weight:900; color:var(--cyan);">${priceLabel(o.total_price || o.price)}</span>
              ${o.license_key ? `<button style="background:rgba(255,255,255,0.06); border:1px solid var(--border-color); color:#fff; font-size:12px; padding:6px 12px; border-radius:10px;" data-copy="${esc(o.license_key)}">📋 کپی کد لایسنس</button>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /* ── Wallet View Renderer ── */
  function renderWalletView(container) {
    const user = state.user || {};
    container.innerHTML = `
      <h2 style="font-size:24px; font-weight:900; margin-bottom:20px;">💰 کیف پول &amp; پاداش‌ها</h2>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:20px;">
        <div style="background:linear-gradient(135deg, rgba(0,242,254,0.15), rgba(29,155,240,0.25)); border:1px solid var(--border-cyan); border-radius:24px; padding:28px;">
          <small style="color:var(--text-muted); font-size:13px;">موجودی فعلی کیف پول</small>
          <h1 style="font-size:36px; font-weight:900; color:#fff; margin:8px 0 16px;">${priceLabel(user.balance || 0)}</h1>
          <div style="display:flex; gap:10px;">
            <button class="user-account-btn" id="btn-deposit-trx">⚡ شارژ با ترون (TRX)</button>
            <button class="nav-link" style="background:rgba(255,255,255,0.08);" id="btn-deposit-card">💳 کارت به کارت</button>
          </div>
        </div>

        <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:24px; padding:28px; text-align:center;">
          <h3 style="margin-bottom:10px;">🎯 گردونه شانس روزانه</h3>
          <p style="color:var(--text-muted); font-size:13px; margin-bottom:16px;">هر ۲۴ ساعت یکبار گردونه شانس را بچرخانید و اعتبار هدیه بگیرید!</p>
          <button class="user-account-btn" style="margin:0 auto;" id="btn-spin-wheel">🎡 چرخاندن گردونه</button>
        </div>
      </div>
    `;
  }

  /* ── Profile View Renderer ── */
  function renderProfileView(container) {
    const user = state.user || {};
    if (!user || user.is_guest) {
      openAuthModal();
      return;
    }

    container.innerHTML = `
      <h2 style="font-size:24px; font-weight:900; margin-bottom:20px;">👤 حساب کاربری</h2>
      <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:24px; padding:28px; max-width:600px;">
        <div style="display:flex; align-items:center; gap:16px; margin-bottom:20px; border-bottom:1px solid var(--border-color); padding-bottom:16px;">
          <div style="width:60px; height:60px; background:var(--accent-grad); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:28px; color:#000;">👤</div>
          <div>
            <h3 style="font-size:18px; font-weight:900;">${esc(user.first_name || user.username || 'کاربر')}</h3>
            <p style="color:var(--text-muted); font-size:13px;">کد کاربری: #${user.id || '---'}</p>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:20px;">
          <div style="display:flex; justify-content:space-between; font-size:14px;">
            <span style="color:var(--text-muted);">نام کاربری:</span>
            <b>${esc(user.username || '---')}</b>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:14px;">
            <span style="color:var(--text-muted);">موجودی کیف پول:</span>
            <b style="color:var(--cyan);">${priceLabel(user.balance || 0)}</b>
          </div>
        </div>
        <button class="nav-link" style="background:rgba(239,68,68,0.15); color:#ef4444; width:100%; justify-content:center;" id="btn-logout">خروج از حساب کاربری</button>
      </div>
    `;

    $('btn-logout')?.addEventListener('click', () => {
      localStorage.removeItem('bg_web_token');
      state.user = null;
      showToast('از حساب کاربری خارج شدید', 'info');
      initApp();
    });
  }

  /* ── Admin View Renderer ── */
  function renderAdminView(container) {
    container.innerHTML = `
      <h2 style="font-size:24px; font-weight:900; margin-bottom:20px; color:#f59e0b;">👑 پنل مدیریت BlueGate</h2>
      <div style="background:var(--card-dark); border:1px solid rgba(245,158,11,0.3); border-radius:24px; padding:28px;">
        <p style="color:var(--text-muted); margin-bottom:16px;">مدیریت کامل محصولات، دسته‌بندی‌ها و سفارش‌ها.</p>
        <button class="user-account-btn" onclick="window.location.href='?admin=1'">ورود به داشبورد کامل مدیریت</button>
      </div>
    `;
  }

  /* ── Auth Modal (Login & Registration) ── */
  function openAuthModal() {
    const modalContainer = $('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid var(--border-color); padding-bottom:14px;">
          <h3 style="font-size:18px; font-weight:900;">🔑 ورود / ثبت‌نام در BlueGate</h3>
          <button class="close-drawer-btn" id="close-modal-btn">✕</button>
        </div>

        <div style="display:flex; gap:8px; margin-bottom:20px; background:rgba(255,255,255,0.04); padding:4px; border-radius:14px;">
          <button id="tab-login-btn" class="nav-link active" style="flex:1; justify-content:center;">ورود به حساب</button>
          <button id="tab-register-btn" class="nav-link" style="flex:1; justify-content:center;">ثبت‌نام جدید</button>
        </div>

        <!-- Login Form -->
        <form id="login-form">
          <div style="margin-bottom:14px;">
            <label style="display:block; font-size:13px; color:var(--text-muted); margin-bottom:6px;">نام کاربری</label>
            <input type="text" id="login-username" required style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:12px; border-radius:12px; font-family:inherit; outline:none;">
          </div>
          <div style="margin-bottom:20px;">
            <label style="display:block; font-size:13px; color:var(--text-muted); margin-bottom:6px;">رمز عبور</label>
            <input type="password" id="login-password" required style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:12px; border-radius:12px; font-family:inherit; outline:none;">
          </div>
          <button type="submit" class="user-account-btn" style="width:100%; justify-content:center;">ورود به حساب</button>
        </form>

        <!-- Register Form -->
        <form id="register-form" class="hidden">
          <div style="margin-bottom:12px;">
            <label style="display:block; font-size:13px; color:var(--text-muted); margin-bottom:4px;">نام کاربری (انگلیسی)</label>
            <input type="text" id="reg-username" required style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:12px; font-family:inherit; outline:none;">
          </div>
          <div style="margin-bottom:12px;">
            <label style="display:block; font-size:13px; color:var(--text-muted); margin-bottom:4px;">رمز عبور</label>
            <input type="password" id="reg-password" required style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:12px; font-family:inherit; outline:none;">
          </div>
          <div style="margin-bottom:12px;">
            <label style="display:block; font-size:13px; color:var(--text-muted); margin-bottom:4px;">ایمیل (اختیاری)</label>
            <input type="email" id="reg-email" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:12px; font-family:inherit; outline:none;">
          </div>
          <div style="margin-bottom:18px;">
            <label style="display:block; font-size:13px; color:var(--text-muted); margin-bottom:4px;">نام یا نام خانوادگی</label>
            <input type="text" id="reg-firstname" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:12px; font-family:inherit; outline:none;">
          </div>
          <button type="submit" class="user-account-btn" style="width:100%; justify-content:center;">ثبت‌نام حساب جدید</button>
        </form>
      </div>
    `;

    modalContainer.classList.remove('hidden');

    $('close-modal-btn')?.addEventListener('click', closeModal);

    const loginTab = $('tab-login-btn');
    const regTab = $('tab-register-btn');
    const loginForm = $('login-form');
    const regForm = $('register-form');

    loginTab?.addEventListener('click', () => {
      loginTab.classList.add('active');
      regTab.classList.remove('active');
      loginForm.classList.remove('hidden');
      regForm.classList.add('hidden');
    });

    regTab?.addEventListener('click', () => {
      regTab.classList.add('active');
      loginTab.classList.remove('active');
      regForm.classList.remove('hidden');
      loginForm.classList.add('hidden');
    });

    // Form Submissions
    loginForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = $('login-username').value.trim();
      const password = $('login-password').value;
      const res = await api('login', {}, 'POST', { username, password });
      if (res && res.ok) {
        if (res.auth_token) localStorage.setItem('bg_web_token', res.auth_token);
        state.user = res.user;
        showToast('با موفقیت وارد شدید! 🎉', 'success');
        closeModal();
        initApp();
      } else {
        showToast(res.message || 'نام کاربری یا رمز عبور اشتباه است.', 'error');
      }
    });

    regForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = $('reg-username').value.trim();
      const password = $('reg-password').value;
      const email = $('reg-email').value.trim();
      const first_name = $('reg-firstname').value.trim();
      const res = await api('register', {}, 'POST', { username, password, email, first_name });
      if (res && res.ok) {
        if (res.auth_token) localStorage.setItem('bg_web_token', res.auth_token);
        state.user = res.user;
        showToast('ثبت‌نام با موفقیت انجام شد! 🎉', 'success');
        closeModal();
        initApp();
      } else {
        showToast(res.message || 'خطا در ثبت‌نام.', 'error');
      }
    });
  }

  function closeModal() {
    const modalContainer = $('modal-container');
    if (modalContainer) {
      modalContainer.classList.add('hidden');
      modalContainer.innerHTML = '';
    }
  }

  /* ── Product Detail Preview Modal ── */
  function openProductModal(pid) {
    const p = state.products.find(item => Number(item.id) === Number(pid));
    if (!p) return;

    const modalContainer = $('modal-container');
    if (!modalContainer) return;

    const title = p.title || p.name || 'جزئیات محصول';

    modalContainer.innerHTML = `
      <div class="modal-card" style="max-width:600px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h3 style="font-size:18px; font-weight:900;">${esc(title)}</h3>
          <button class="close-drawer-btn" id="close-modal-btn">✕</button>
        </div>
        ${p.image_url ? `<img src="${esc(p.image_url)}" style="width:100%; max-height:260px; object-fit:cover; border-radius:16px; margin-bottom:16px;">` : ''}
        <p style="color:var(--text-muted); font-size:14px; line-height:1.6; margin-bottom:20px;">
          ${esc(p.full_description || p.short_description || 'توضیحاتی برای این محصول ثبت نشده است.')}
        </p>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <b style="font-size:20px; color:var(--cyan);">${priceLabel(p.price)}</b>
          <button class="user-account-btn" id="btn-buy-modal" data-buy="${p.id}">⚡ افزودن به سبد خرید</button>
        </div>
      </div>
    `;

    modalContainer.classList.remove('hidden');
    $('close-modal-btn')?.addEventListener('click', closeModal);
    $('btn-buy-modal')?.addEventListener('click', () => {
      addToCart(p.id);
      closeModal();
    });
  }

  /* ── Global Event Delegation ── */
  function bindGlobalEvents() {
    document.addEventListener('click', (e) => {
      // User Account Button -> Open Auth or Profile
      if (e.target.closest('#user-btn')) {
        if (state.user && !state.user.is_guest) {
          state.currentTab = 'profile';
          renderApp();
        } else {
          openAuthModal();
        }
        return;
      }

      // Navigation tabs
      const tabBtn = e.target.closest('[data-tab]');
      if (tabBtn && tabBtn.dataset.tab) {
        state.currentTab = tabBtn.dataset.tab;
        renderApp();
      }

      // Category Sidebar Click
      const catBtn = e.target.closest('.sidebar-cat-btn');
      if (catBtn && catBtn.dataset.cat) {
        state.activeCategory = catBtn.dataset.cat;
        renderApp();
      }

      // Sort Pills
      const sortBtn = e.target.closest('[data-sort]');
      if (sortBtn && sortBtn.dataset.sort) {
        state.shopSort = sortBtn.dataset.sort;
        renderApp();
      }

      // Quick Buy
      const buyBtn = e.target.closest('[data-buy]');
      if (buyBtn && buyBtn.dataset.buy) {
        e.stopPropagation();
        addToCart(buyBtn.dataset.buy);
      }

      // Wishlist toggle
      const wishBtn = e.target.closest('[data-wishlist]');
      if (wishBtn && wishBtn.dataset.wishlist) {
        e.stopPropagation();
        toggleWishlist(wishBtn.dataset.wishlist);
      }

      // Product Card Preview
      const card = e.target.closest('.product-card');
      if (card && card.dataset.pid && !e.target.closest('[data-buy]') && !e.target.closest('[data-wishlist]')) {
        openProductModal(card.dataset.pid);
      }

      // Copy buttons
      const copyBtn = e.target.closest('[data-copy]');
      if (copyBtn && copyBtn.dataset.copy) {
        navigator.clipboard.writeText(copyBtn.dataset.copy);
        showToast('کد با موفقیت کپی شد! 📋', 'success');
      }
    });

    // In-Stock & Wishlist quick toggles
    document.addEventListener('click', (e) => {
      if (e.target.closest('#toggle-instock')) {
        state.filterInStock = !state.filterInStock;
        renderApp();
      }
      if (e.target.closest('#toggle-wishlist')) {
        state.filterWishlist = !state.filterWishlist;
        renderApp();
      }
    });

    // Search Input
    const searchInput = $('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.searchTerm = e.target.value.trim();
        if (state.currentTab === 'shop') renderApp();
      });
    }

    // Cart Drawer Toggle
    $('open-cart-btn')?.addEventListener('click', () => openCartDrawer(true));
    $('close-cart-btn')?.addEventListener('click', () => openCartDrawer(false));
    $('cart-backdrop')?.addEventListener('click', () => openCartDrawer(false));
  }

  function toggleWishlist(pid) {
    const id = Number(pid);
    const idx = state.wishlist.indexOf(id);
    if (idx >= 0) state.wishlist.splice(idx, 1);
    else state.wishlist.push(id);

    localStorage.setItem('bg_web_wishlist', JSON.stringify(state.wishlist));
    showToast(idx >= 0 ? 'از نشان‌شده‌ها حذف شد' : 'به نشان‌شده‌ها اضافه شد ❤️', 'info');
    renderApp();
  }

  function addToCart(pid) {
    const product = state.products.find(p => Number(p.id) === Number(pid));
    if (!product) return;

    const title = product.title || product.name || 'محصول بدون عنوان';
    const existing = state.cart.find(item => Number(item.id) === Number(pid));
    if (existing) existing.qty = (existing.qty || 1) + 1;
    else state.cart.push({ id: product.id, title, price: product.price, qty: 1 });

    localStorage.setItem('bg_web_cart', JSON.stringify(state.cart));
    updateCartCount();
    showToast(`"${title}" به سبد خرید اضافه شد! 🛒`, 'success');
    openCartDrawer(true);
  }

  function openCartDrawer(open) {
    const drawer = $('cart-drawer');
    const backdrop = $('cart-backdrop');
    if (drawer) drawer.classList.toggle('open', open);
    if (backdrop) backdrop.classList.toggle('open', open);
    if (open) renderCartDrawerContent();
  }

  function renderCartDrawerContent() {
    const container = $('cart-items-container');
    const footer = $('cart-footer-container');
    if (!container || !footer) return;

    if (!state.cart.length) {
      container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted);">سبد خرید شما خالی است.</div>`;
      footer.innerHTML = '';
      return;
    }

    const total = state.cart.reduce((sum, item) => sum + (Number(item.price) * (item.qty || 1)), 0);

    container.innerHTML = state.cart.map(item => `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; background:rgba(255,255,255,0.03); padding:10px 14px; border-radius:12px;">
        <div>
          <b style="font-size:13px;">${esc(item.title)}</b>
          <div style="color:var(--cyan); font-size:12px; font-weight:800;">${priceLabel(item.price)}</div>
        </div>
        <span style="font-weight:900;">x${item.qty || 1}</span>
      </div>
    `).join('');

    footer.innerHTML = `
      <div style="display:flex; justify-content:space-between; margin-bottom:14px; font-weight:900; font-size:16px;">
        <span>مبلغ قابل پرداخت:</span>
        <span style="color:var(--cyan);">${priceLabel(total)}</span>
      </div>
      <button class="user-account-btn" style="width:100%; justify-content:center;" onclick="alert('تکمیل سفارش با موفقیت انجام شد')">تکمیل خرید &amp; پرداخت</button>
    `;
  }

  /* ── Boot Web Engine ── */
  document.addEventListener('DOMContentLoaded', initApp);

})();
