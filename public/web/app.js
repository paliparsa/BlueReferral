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
    bot_username: '',
    support_username: '',
    brand: '',
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
      state.bot_username = res.bot_username || '';
      state.payment_methods = res.payment_methods || null;
      state.support_username = res.support_username || '';
      state.brand = res.brand || '';
      if (res.user) {
        state.user = res.user;
        state.is_admin = !!res.is_admin;
      }
    }

    if (new URLSearchParams(window.location.search).has('admin') || window.location.hash.includes('admin')) {
      state.currentTab = 'admin';
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
    const nav = document.querySelector('.header-nav');
    if (nav && state.is_admin && !$('admin-header-nav-btn')) {
      const btn = document.createElement('button');
      btn.id = 'admin-header-nav-btn';
      btn.className = 'nav-link';
      btn.dataset.tab = 'admin';
      btn.style.color = '#f59e0b';
      btn.innerHTML = `<span>👑</span> مدیریت`;
      nav.appendChild(btn);
    }

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
          <div class="order-row-card" data-order-open="${o.id}" style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:18px; padding:20px; cursor:pointer; transition:0.3s;" onmouseover="this.style.borderColor='var(--cyan)'" onmouseout="this.style.borderColor='var(--border-color)'">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid var(--border-color); padding-bottom:10px;">
              <div>
                <b>سفارش #${o.id}</b>
                <small style="color:var(--text-muted); margin-right:10px;">${esc(o.created_at)}</small>
              </div>
              <span style="background:rgba(0,242,254,0.15); color:var(--cyan); font-weight:800; font-size:12px; padding:4px 12px; border-radius:12px;">
                ${esc(o.status_fa || o.status || 'تکمیل شده')}
              </span>
            </div>
            <div style="font-size:14px; font-weight:700; margin-bottom:8px;">${esc(o.display_name || o.product_title || o.name || 'اشتراک دیجیتال')}</div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-weight:900; color:var(--cyan);">${priceLabel(o.final_amount || o.price)}</span>
              <span style="font-size:12px; color:var(--text-muted);">مشاهده جزئیات ‹</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /* ── Order Stepper Helper ── */
  function orderStepperHtml(o) {
    const steps = [
      {label: 'ثبت', icon: '📝'},
      {label: 'پرداخت', icon: '💳'},
      {label: 'آماده‌سازی', icon: '📦'},
      {label: 'تحویل', icon: '✅'}
    ];
    const canceled = ['rejected', 'canceled', 'refunded'].includes(o.status);
    if (canceled) {
      return `<div class="order-stepper canceled">
        <div class="stepper-cancel">
          <span class="step-circle cancel">✕</span>
          <div><b>سفارش ${esc(o.status_fa || o.status)}</b><br><small>این سفارش لغو شده است.</small></div>
        </div>
      </div>`;
    }
    let cur = 0;
    if (o.status === 'pending_payment' || o.status === 'receipt_submitted') cur = 1;
    else if (o.status === 'reviewing' || o.status === 'payment_confirmed' || o.status === 'preparing') cur = 2;
    else if (o.status === 'delivered') cur = 3;

    return `<div class="order-stepper">
      ${steps.map((s, i) => {
        const done = i <= cur;
        const active = i === cur;
        return `<div class="step ${done ? 'done' : ''} ${active ? 'active' : ''}">
          <div class="step-circle">${done ? '✓' : s.icon}</div>
          <span class="step-label">${s.label}</span>
          ${i < steps.length - 1 ? `<div class="step-line ${i < cur ? 'done' : ''}"></div>` : ''}
        </div>`;
      }).join('')}
    </div>`;
  }

  /* ── Order Detail Modal ── */
  function openOrderDetailModal(orderId) {
    const modalContainer = $('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-card" style="max-width:600px; padding:32px;">
        <div style="text-align:center; margin-bottom:20px;">
          <h3 style="font-size:20px; font-weight:900;">⏳ در حال بارگذاری سفارش...</h3>
        </div>
      </div>
    `;
    modalContainer.classList.remove('hidden');

    // Fetch order details via API
    api('my_orders').then(res => {
      const orders = (res && res.ok) ? (res.orders || []) : [];
      const o = orders.find(x => Number(x.id) === Number(orderId));
      if (!o) {
        showToast('سفارش یافت نشد', 'error');
        closeModal();
        return;
      }

      modalContainer.innerHTML = `
        <div class="modal-card" style="max-width:600px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid var(--border-color); padding-bottom:16px;">
            <div>
              <small style="color:var(--text-muted);">سفارش #${nf(o.id)}</small>
              <h3 style="font-size:18px; font-weight:900;">${esc(o.display_name || 'محصول')}</h3>
            </div>
            <button class="close-drawer-btn" id="close-modal-btn">✕</button>
          </div>

          ${orderStepperHtml(o)}

          <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:16px; padding:20px; margin-bottom:20px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
              <span style="color:var(--text-muted); font-size:14px;">مبلغ نهایی پرداخت</span>
              <b style="color:var(--cyan); font-size:16px;">${priceLabel(o.final_amount || o.price)}</b>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
              <span style="color:var(--text-muted); font-size:14px;">روش پرداخت</span>
              <b style="font-size:14px;">${esc(o.payment_method_fa || 'انتخاب نشده')}</b>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
              <span style="color:var(--text-muted); font-size:14px;">تاریخ ثبت</span>
              <b style="font-size:14px;">${esc(o.created_at || '-')}</b>
            </div>
          </div>

          ${o.license_key ? `
            <div style="background:rgba(34, 197, 94, 0.1); border:1px solid rgba(34, 197, 94, 0.3); border-radius:16px; padding:20px; margin-bottom:20px; text-align:center;">
              <p style="color:#4ade80; font-size:13px; margin-bottom:8px;">✅ کد لایسنس / اطلاعات تحویل:</p>
              <code style="display:block; font-size:18px; font-weight:900; background:rgba(0,0,0,0.3); padding:10px; border-radius:8px; margin-bottom:12px;">${esc(o.license_key)}</code>
              <button class="user-account-btn" data-copy="${esc(o.license_key)}" style="background:#22c55e; color:#000; margin:0 auto;">📋 کپی اطلاعات</button>
            </div>
          ` : ''}

          ${paymentMethodsHtml(o)}
        </div>
      `;

      $('close-modal-btn')?.addEventListener('click', closeModal);
      bindOrderPaymentEvents(o);
    });
  }

  /* ── Payment Gateways Renderer ── */
  function paymentMethodsHtml(o) {
    if (!['pending_payment', 'rejected'].includes(o.status) || Number(o.final_amount || 0) <= 0) {
      return '';
    }

    const methods = state.payment_methods || { wallet: { enabled: true }, card: { enabled: true }, crypto: { enabled: false } };
    const bal = Number(state.user?.balance || 0);

    let html = `
      <div style="margin-top:20px; border-top:1px solid var(--border-color); padding-top:16px;">
        <h4 style="font-size:15px; font-weight:800; margin-bottom:12px;">💳 انتخاب روش پرداخت</h4>
    `;

    // 1. Method Selectors
    if (!o.payment_method || o.payment_method === 'none') {
      html += `<div class="payment-grid">`;
      if (methods.wallet?.enabled !== false) {
        html += `
          <button class="pay-method-card" id="btn-pay-wallet-${o.id}">
            <b>💰 کیف پول</b>
            <span>موجودی: ${priceLabel(bal)}</span>
          </button>
        `;
      }
      if (methods.card?.enabled !== false) {
        html += `
          <button class="pay-method-card" id="btn-pay-card-${o.id}">
            <b>💳 کارت به کارت</b>
            <span>پرداخت دستی با رسید</span>
          </button>
        `;
      }
      if (methods.crypto?.enabled) {
        html += `
          <button class="pay-method-card" id="btn-pay-crypto-${o.id}">
            <b>🪙 رمزارز (USDT / TRX)</b>
            <span>واریز آنی با TXID</span>
          </button>
        `;
      }
      html += `</div>`;
    }

    // 2. Card Payment Panel
    if (o.payment_method === 'card') {
      let accounts = methods.card?.accounts || [];
      if (!accounts.length) {
        accounts = [{ title: 'کارت اصلی فروشگاه', card: '6037997412345678', owner: 'پشتیبانی BlueGate' }];
      }

      html += `
        <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:16px; padding:16px; margin-top:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <b style="font-size:14px; color:var(--cyan);">💳 اطلاعات شماره کارت</b>
            <button class="ghost" id="btn-reset-method-${o.id}" style="font-size:11px; padding:4px 8px;">🔄 تغییر روش</button>
          </div>
          ${accounts.map(acc => `
            <div class="luxury-bank-card">
              <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-muted);">
                <span>${esc(acc.title || 'کارت بانکی')}</span>
                <span>${esc(acc.owner || '')}</span>
              </div>
              <div class="bank-card-number">${esc(acc.card || '')}</div>
              <button class="user-account-btn" data-copy="${esc(acc.card || '')}" style="margin:0 auto; font-size:12px; padding:6px 14px;">📋 کپی شماره کارت</button>
            </div>
          `).join('')}

          <form id="receipt-upload-form-${o.id}" style="margin-top:16px; border-top:1px solid var(--border-color); padding-top:14px;">
            <div style="margin-bottom:12px;">
              <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">توضیحات / شماره پیگیری / ۴ رقم کارت</label>
              <input type="text" id="receipt-note-${o.id}" required placeholder="مثلاً: واریز از کارت علی محمودی کد ۱۲۳۴" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px; font-family:inherit; outline:none; font-size:13px;">
            </div>
            <div style="margin-bottom:14px;">
              <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">تصویر رسید (اختیاری)</label>
              <input type="file" id="receipt-file-${o.id}" accept="image/*" style="width:100%; font-size:12px; color:var(--text-muted);">
            </div>
            <button type="submit" class="user-account-btn" style="width:100%; justify-content:center;">📤 ثبت رسید و تایید پرداخت</button>
          </form>
        </div>
      `;
    }

    // 3. Crypto Invoicing Panel
    if (o.payment_method === 'crypto') {
      const wallets = methods.crypto?.wallets || [];
      const cryptoCheck = o.crypto_check;

      html += `
        <div class="crypto-invoice-panel">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <b style="font-size:14px; color:var(--cyan);">🪙 پرداخت رمزارز</b>
            <button class="ghost" id="btn-reset-method-${o.id}" style="font-size:11px; padding:4px 8px;">🔄 تغییر روش</button>
          </div>
          ${!cryptoCheck ? `
            <p style="color:var(--text-muted); font-size:13px; margin-bottom:12px;">کیف پول شبکه مورد نظر خود را انتخاب کنید:</p>
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${wallets.map(w => `
                <button class="user-account-btn" data-select-crypto-id="${w.id}" style="justify-content:space-between; background:rgba(255,255,255,0.04);">
                  <span>${esc(w.title || 'USDT TRC20')}</span>
                  <small style="color:var(--cyan);">${w.rate_toman ? `۱ USDT = ${priceLabel(w.rate_toman)}` : ''}</small>
                </button>
              `).join('')}
            </div>
          ` : `
            <div style="background:rgba(0,0,0,0.3); border-radius:12px; padding:14px; margin-bottom:14px;">
              <small style="color:var(--text-muted); font-size:12px; display:block;">آدرس کیف پول جهت واریز:</small>
              <code style="font-size:14px; color:var(--cyan); word-break:break-all; display:block; margin:6px 0;">${esc(cryptoCheck.address)}</code>
              <button class="user-account-btn" data-copy="${esc(cryptoCheck.address)}" style="font-size:11px; padding:4px 10px;">📋 کپی آدرس</button>
            </div>
            <form id="crypto-hash-form-${o.id}">
              <div style="margin-bottom:12px;">
                <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">کد هش تراکنش (TXID / Hash)</label>
                <input type="text" id="crypto-txid-${o.id}" required placeholder="هش تراکنش شبکه..." style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px; font-family:inherit; outline:none; font-size:13px;">
              </div>
              <button type="submit" class="user-account-btn" style="width:100%; justify-content:center;">⚡ ثبت TXID جهت استعلام آنی</button>
            </form>
          `}
        </div>
      `;
    }

    html += `</div>`;
    return html;
  }

  /* ── Order Payment Event Binding ── */
  function bindOrderPaymentEvents(o) {
    // Wallet Payment Action
    $(`btn-pay-wallet-${o.id}`)?.addEventListener('click', async () => {
      const bal = Number(state.user?.balance || 0);
      if (bal < Number(o.final_amount || 0)) {
        if (!confirm(`موجودی کیف پول شما (${priceLabel(bal)}) از مبلغ سفارش کمتر است. آیا مایلید موجودی موجود کسر شود؟`)) return;
      }
      const res = await api('apply_wallet', {}, 'POST', { order_id: o.id });
      if (res && res.ok) {
        showToast('پرداخت از کیف پول انجام شد! 🎉', 'success');
        openOrderDetailModal(o.id);
      } else {
        showToast(res.message || 'خطا در پرداخت کیف پول.', 'error');
      }
    });

    // Select Card Payment Action
    $(`btn-pay-card-${o.id}`)?.addEventListener('click', async () => {
      const res = await api('select_payment_method', {}, 'POST', { order_id: o.id, method: 'card' });
      if (res && res.ok) openOrderDetailModal(o.id);
    });

    // Select Crypto Payment Action
    $(`btn-pay-crypto-${o.id}`)?.addEventListener('click', async () => {
      const res = await api('select_payment_method', {}, 'POST', { order_id: o.id, method: 'crypto' });
      if (res && res.ok) openOrderDetailModal(o.id);
    });

    // Reset Payment Method Action
    $(`btn-reset-method-${o.id}`)?.addEventListener('click', async () => {
      const res = await api('select_payment_method', {}, 'POST', { order_id: o.id, method: 'none' });
      if (res && res.ok) openOrderDetailModal(o.id);
    });

    // Card Receipt Upload Submit
    $(`receipt-upload-form-${o.id}`)?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const note = $(`receipt-note-${o.id}`).value.trim();
      const fileInput = $(`receipt-file-${o.id}`);

      let receipt_b64 = null;
      if (fileInput && fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        receipt_b64 = await new Promise(resolve => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.readAsDataURL(file);
        });
      }

      const res = await api('submit_receipt', {}, 'POST', { order_id: o.id, note, receipt_b64 });
      if (res && res.ok) {
        showToast('رسید با موفقیت ثبت و برای پشتیبانی ارسال شد! 📤', 'success');
        openOrderDetailModal(o.id);
      } else {
        showToast(res.message || 'خطا در ثبت رسید.', 'error');
      }
    });

    // Crypto Wallet Selection
    document.querySelectorAll(`[data-select-crypto-id]`).forEach(btn => {
      btn.addEventListener('click', async () => {
        const wallet_id = btn.dataset.selectCryptoId;
        const res = await api('select_crypto_wallet', {}, 'POST', { order_id: o.id, wallet_id });
        if (res && res.ok) openOrderDetailModal(o.id);
      });
    });

    // Submit Crypto TXID Hash
    $(`crypto-hash-form-${o.id}`)?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const tx_hash = $(`crypto-txid-${o.id}`).value.trim();
      const res = await api('submit_crypto_hash', {}, 'POST', { order_id: o.id, tx_hash });
      if (res && res.ok) {
        showToast('کد TXID ثبت شد و سیستم شبکه در حال بررسی است ⚡', 'success');
        openOrderDetailModal(o.id);
      } else {
        showToast(res.message || 'خطا در ثبت کد Hash.', 'error');
      }
    });
  }

  /* ── Wallet View Renderer ── */
  async function renderWalletView(container) {
    const user = state.user || {};
    const refLink = user.referral_link || `${window.location.origin}/?ref=${user.ref_code || ''}`;

    container.innerHTML = `
      <h2 style="font-size:24px; font-weight:900; margin-bottom:20px;">💰 کیف پول &amp; پاداش‌ها</h2>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:20px;">
        <div style="background:linear-gradient(135deg, rgba(0,242,254,0.15), rgba(29,155,240,0.25)); border:1px solid var(--border-cyan); border-radius:24px; padding:28px;">
          <small style="color:var(--text-muted); font-size:13px;">موجودی فعلی کیف پول</small>
          <h1 style="font-size:36px; font-weight:900; color:#fff; margin:8px 0 16px;">${priceLabel(user.balance || 0)}</h1>
          <div style="display:flex; gap:10px;">
            <button class="user-account-btn" id="btn-deposit-trx">⚡ شارژ حساب</button>
          </div>
        </div>

        <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:24px; padding:28px; text-align:center;">
          <h3 style="margin-bottom:10px;">🎡 گردونه شانس روزانه</h3>
          <p style="color:var(--text-muted); font-size:13px; margin-bottom:16px;">شانس گردونه شما: <b style="color:var(--cyan);">${nf(user.spin_balance || 0)}</b></p>
          <button class="user-account-btn" style="margin:0 auto;" id="btn-spin-wheel">🎰 چرخاندن گردونه</button>
        </div>
      </div>

      <!-- Referral Link & Network Section -->
      <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:24px; padding:24px; margin-top:20px;">
        <h3 style="font-size:18px; font-weight:800; margin-bottom:8px;">🔗 لینک دعوت اختصاصی شما</h3>
        <p style="color:var(--text-muted); font-size:13px; margin-bottom:16px;">با دعوت دوستانتان از هر خرید آنها پورسانت آنی دریافت کنید.</p>
        <div style="display:flex; gap:10px; margin-bottom:16px;">
          <input type="text" readonly value="${esc(refLink)}" style="flex:1; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:var(--cyan); padding:12px; border-radius:12px; font-family:monospace; direction:ltr; text-align:center;">
          <button class="user-account-btn" data-copy="${esc(refLink)}">📋 کپی لینک</button>
        </div>
        <div id="referrals-tree-container">⏳ در حال بارگذاری زیرمجموعه‌ها...</div>
      </div>

      ${vipProgressHtml()}
      ${achievementsHtml()}
    `;

    $('btn-spin-wheel')?.addEventListener('click', openSpinWheelModal);

    // Fetch Referrals Tree
    const refRes = await api('my_referrals');
    const refs = (refRes && refRes.ok) ? (refRes.referrals || []) : [];
    const treeBox = $('referrals-tree-container');

    if (treeBox) {
      if (!refs.length) {
        treeBox.innerHTML = `<p style="color:var(--text-muted); font-size:13px; text-align:center;">هنوز هیچ زیرمجموعه‌ای ثبت نشده است. لینک بالا را برای دوستانتان بفرستید!</p>`;
      } else {
        treeBox.innerHTML = `
          <h4 style="font-size:14px; font-weight:700; margin-bottom:12px;">👥 زیرمجموعه‌های شما (${refs.length})</h4>
          <div style="display:flex; flex-direction:column; gap:10px;">
            ${refs.map(r => `
              <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); padding:10px 14px; border-radius:12px; font-size:13px;">
                <div>
                  <b>${esc(r.first_name || r.username || 'کاربر')}</b>
                  <small style="color:var(--text-muted); margin-right:8px;">${esc(String(r.created_at || '').slice(0, 10))}</small>
                </div>
                <span style="color:var(--cyan); font-weight:800;">+${priceLabel(r.total_earned || 0)}</span>
              </div>
            `).join('')}
          </div>
        `;
      }
    }
  }

  /* ── VIP Level Progress Component ── */
  function vipProgressHtml() {
    const user = state.user || {};
    const spent = Number(user.customer?.total_spent || 0);
    const tiers = [
      { name: 'Bronze', fa: 'برنز', emoji: '🥉', min: 0 },
      { name: 'Silver', fa: 'نقره', emoji: '🥈', min: 1000000 },
      { name: 'Gold', fa: 'طلایی', emoji: '🥇', min: 5000000 },
      { name: 'Diamond', fa: 'الماس', emoji: '💎', min: 10000000 }
    ];
    let cur = 0, nxt = tiers[1];
    for (let i = 0; i < tiers.length; i++) {
      if (spent >= tiers[i].min) {
        cur = i;
        nxt = tiers[i + 1] || null;
      }
    }
    const curTier = tiers[cur];
    const base = curTier.min;
    const ceiling = nxt ? nxt.min : curTier.min;
    const range = Math.max(1, ceiling - base);
    const pct = nxt ? Math.min(100, Math.round((spent - base) / range * 100)) : 100;

    return `
      <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:24px; padding:24px; margin-top:20px;">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
          <span style="font-size:32px;">${curTier.emoji}</span>
          <div>
            <h3 style="font-size:16px; font-weight:800;">سطح همکاری &amp; مشتری: ${esc(curTier.fa)}</h3>
            <p style="color:var(--text-muted); font-size:13px;">
              ${nxt ? `تا ${esc(nxt.fa)} ${nxt.emoji}: ${priceLabel(Math.max(0, ceiling - spent))}` : 'به بالاترین سطح مشتریان رسیده‌اید! 🎉'}
            </p>
          </div>
        </div>
        <div style="width:100%; height:8px; background:rgba(255,255,255,0.05); border-radius:10px; overflow:hidden; margin-bottom:12px;">
          <div style="width:${pct}%; height:100%; background:var(--accent-grad); transition:width 0.5s ease;"></div>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-muted);">
          ${tiers.map(t => `<span style="${t.name === curTier.name ? 'color:var(--cyan); font-weight:800;' : ''}">${t.emoji} ${esc(t.fa)}</span>`).join('')}
        </div>
      </div>
    `;
  }

  /* ── Achievements Component ── */
  function achievementsHtml() {
    const a = state.achievements || [];
    if (!a.length) return '';
    const earned = a.filter(x => x.earned).length;

    return `
      <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:24px; padding:24px; margin-top:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h3 style="font-size:16px; font-weight:800;">🏆 نشان‌های افتخار &amp; دستاوردها</h3>
          <span style="font-size:13px; color:var(--cyan); font-weight:700;">${nf(earned)} از ${nf(a.length)} باز شده</span>
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(110px, 1fr)); gap:12px;">
          ${a.map(x => `
            <div style="background:${x.earned ? 'rgba(0,242,254,0.08)' : 'rgba(255,255,255,0.02)'}; border:1px solid ${x.earned ? 'rgba(0,242,254,0.3)' : 'var(--border-color)'}; border-radius:14px; padding:12px; text-align:center; opacity:${x.earned ? '1' : '0.4'};">
              <div style="font-size:28px; margin-bottom:4px;">${x.earned ? x.emoji : '🔒'}</div>
              <small style="font-size:11px; font-weight:700; display:block;">${esc(x.title)}</small>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /* ── Spin Wheel Modal ── */
  function openSpinWheelModal() {
    const user = state.user || {};
    const spins = Number(user.spin_balance || 0);

    const modalContainer = $('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-card" style="max-width:480px; text-align:center;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h3 style="font-size:18px; font-weight:900;">🎡 گردونه شانس روزانه</h3>
          <button class="close-drawer-btn" id="close-modal-btn">✕</button>
        </div>
        <div style="margin:20px 0;">
          <div id="wheel-graphic" style="width:140px; height:140px; border-radius:50%; border:6px solid var(--cyan); margin:0 auto; display:flex; align-items:center; justify-content:center; font-size:48px; background:radial-gradient(circle, rgba(0,242,254,0.2) 0%, rgba(15,23,42,0.9) 100%); transition:transform 2.5s cubic-bezier(0.15, 0.9, 0.25, 1);">
            🎁
          </div>
        </div>
        <p style="color:var(--text-muted); font-size:14px; margin-bottom:16px;">
          شانس باقی‌مانده شما: <b style="color:var(--cyan); font-size:16px;">${nf(spins)}</b>
        </p>
        <button id="btn-spin-now" class="user-account-btn" style="width:100%; justify-content:center;" ${spins <= 0 ? 'disabled' : ''}>
          ${spins > 0 ? '🎰 چرخاندن گردونه' : 'فرصت گردونه ندارید'}
        </button>
      </div>
    `;

    modalContainer.classList.remove('hidden');
    $('close-modal-btn')?.addEventListener('click', closeModal);

    $('btn-spin-now')?.addEventListener('click', async () => {
      const btn = $('btn-spin-now');
      const graphic = $('wheel-graphic');
      if (btn) btn.disabled = true;

      if (graphic) graphic.style.transform = 'rotate(1440deg)';

      const res = await api('spin');
      setTimeout(() => {
        if (res && res.ok && res.prize) {
          showToast(`🎉 تبریک! شما برنده "${res.prize.title}" شدید!`, 'success');
          initApp();
        } else {
          showToast(res.message || 'خطا در چرخاندن گردونه.', 'error');
        }
        closeModal();
      }, 2600);
    });
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

  /* ── Admin View Renderer (Native Web Admin Dashboard) ── */
  async function renderAdminView(container) {
    if (!state.user || state.user.is_guest) {
      openAuthModal();
      return;
    }

    container.innerHTML = `<div style="text-align:center; padding:40px;">⏳ در حال دریافت اطلاعات داشبورد مدیریت...</div>`;

    const res = await api('admin_summary');
    if (!res || !res.ok) {
      container.innerHTML = `
        <div style="text-align:center; padding:60px 20px; background:var(--card-dark); border-radius:24px; border:1px solid rgba(239,68,68,0.3);">
          <div style="font-size:48px; margin-bottom:12px;">🚫</div>
          <h3 style="color:#ef4444;">دسترسی غیرمجاز!</h3>
          <p style="color:var(--text-muted); font-size:14px;">شما دسترسی مدیریت را ندارید یا نشست شما منقضی شده است.</p>
        </div>
      `;
      return;
    }

    const report = res.report || {};
    const orders = res.orders || [];
    const products = res.products || [];
    const categories = res.categories || [];

    const todayRev = report.today?.revenue || 0;
    const todayOrdersCount = report.today?.c || 0;

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
        <h2 style="font-size:24px; font-weight:900; color:#f59e0b;">👑 پنل مدیریت BlueGate</h2>
        <button class="user-account-btn" id="btn-refresh-admin">🔄 رفرش اطلاعات</button>
      </div>

      <!-- Stats Cards Row -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:16px; margin-bottom:28px;">
        <div style="background:var(--card-dark); border:1px solid rgba(245,158,11,0.3); border-radius:20px; padding:20px;">
          <small style="color:var(--text-muted); font-size:12px;">فروش امروز</small>
          <h3 style="font-size:22px; font-weight:900; color:#f59e0b; margin-top:4px;">${priceLabel(todayRev)}</h3>
        </div>
        <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:20px; padding:20px;">
          <small style="color:var(--text-muted); font-size:12px;">سفارش‌های امروز</small>
          <h3 style="font-size:22px; font-weight:900; color:#fff; margin-top:4px;">${nf(todayOrdersCount)} سفارش</h3>
        </div>
        <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:20px; padding:20px;">
          <small style="color:var(--text-muted); font-size:12px;">کل محصولات active</small>
          <h3 style="font-size:22px; font-weight:900; color:var(--cyan); margin-top:4px;">${nf(products.length)} محصول</h3>
        </div>
        <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:20px; padding:20px;">
          <small style="color:var(--text-muted); font-size:12px;">دسته‌بندی‌های فعال</small>
          <h3 style="font-size:22px; font-weight:900; color:#fff; margin-top:4px;">${nf(categories.length)} دسته</h3>
        </div>
      </div>

      <!-- Admin Sub Tabs -->
      <div style="display:flex; gap:10px; margin-bottom:20px; border-bottom:1px solid var(--border-color); padding-bottom:12px;">
        <button id="admin-tab-orders" class="nav-link active">📜 سفارش‌های اخیر (${orders.length})</button>
        <button id="admin-tab-products" class="nav-link">🛒 مدیریت محصولات (${products.length})</button>
      </div>

      <!-- Sub Content Container -->
      <div id="admin-sub-content">
        ${renderAdminOrdersList(orders)}
      </div>
    `;

    $('btn-refresh-admin')?.addEventListener('click', () => renderAdminView(container));

    const ordersTabBtn = $('admin-tab-orders');
    const prodsTabBtn = $('admin-tab-products');
    const subContent = $('admin-sub-content');

    ordersTabBtn?.addEventListener('click', () => {
      ordersTabBtn.classList.add('active');
      prodsTabBtn?.classList.remove('active');
      if (subContent) subContent.innerHTML = renderAdminOrdersList(orders);
      bindAdminOrderEvents(orders);
    });

    prodsTabBtn?.addEventListener('click', () => {
      prodsTabBtn.classList.add('active');
      ordersTabBtn?.classList.remove('active');
      if (subContent) subContent.innerHTML = renderAdminProductsList(products);
      bindAdminProductEvents(products);
    });

    bindAdminOrderEvents(orders);
  }

  /* ── Admin Orders List Markup ── */
  function renderAdminOrdersList(orders) {
    if (!orders.length) {
      return `<p style="color:var(--text-muted); text-align:center; padding:30px;">سفارشی یافت نشد.</p>`;
    }

    return `
      <div style="display:flex; flex-direction:column; gap:14px;">
        ${orders.map(o => `
          <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:18px; padding:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:10px; margin-bottom:12px;">
              <div>
                <b>سفارش #${o.id}</b>
                <span style="color:var(--text-muted); font-size:12px; margin-right:8px;">کاربر ID: #${o.user_id || '---'}</span>
              </div>
              <span style="background:rgba(245,158,11,0.15); color:#f59e0b; font-weight:800; font-size:12px; padding:4px 12px; border-radius:12px;">
                ${esc(o.status_fa || o.status)}
              </span>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <div>
                <h4 style="font-size:15px; font-weight:800; margin-bottom:4px;">${esc(o.display_name || o.product_title || 'محصول')}</h4>
                <div style="font-size:12px; color:var(--text-muted);">
                  روش: ${esc(o.payment_method_fa || o.payment_method || 'تعیین نشده')} · تاریخ: ${esc(o.created_at || '')}
                </div>
              </div>
              <b style="font-size:16px; color:var(--cyan);">${priceLabel(o.final_amount || o.price)}</b>
            </div>

            ${o.payment_note ? `
              <div style="background:rgba(255,255,255,0.03); border-radius:10px; padding:10px; font-size:12px; margin-bottom:12px; color:var(--text-muted);">
                💬 توضیحات/رسید کاربر: <span style="color:#fff;">${esc(o.payment_note)}</span>
              </div>
            ` : ''}

            <!-- Status Action Buttons -->
            <div style="display:flex; flex-wrap:wrap; gap:8px; border-top:1px solid var(--border-color); padding-top:12px;">
              <button class="user-account-btn" data-admin-status-id="${o.id}" data-status="payment_confirmed" style="background:#22c55e; color:#000; font-size:11px; padding:6px 12px;">🟢 تایید پرداخت</button>
              <button class="user-account-btn" data-admin-status-id="${o.id}" data-status="preparing" style="background:#3b82f6; color:#fff; font-size:11px; padding:6px 12px;">📦 آماده‌سازی</button>
              <button class="user-account-btn" data-admin-status-id="${o.id}" data-status="delivered" style="background:var(--cyan); color:#000; font-size:11px; padding:6px 12px;">✅ ثبت تحویل</button>
              <button class="user-account-btn" data-admin-status-id="${o.id}" data-status="rejected" style="background:#ef4444; color:#fff; font-size:11px; padding:6px 12px;">❌ رد سفارش</button>
              ${o.user_id ? `<button class="nav-link" data-admin-cust-id="${o.user_id}" style="font-size:11px; padding:6px 12px; background:rgba(255,255,255,0.06);">👤 پروفایل 360 کاربر</button>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /* ── Admin Products List Markup ── */
  function renderAdminProductsList(products) {
    if (!products.length) {
      return `<p style="color:var(--text-muted); text-align:center; padding:30px;">محصولی ثبت نشده است.</p>`;
    }

    return `
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:16px;">
        ${products.map(p => `
          <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:18px; padding:16px; display:flex; flex-direction:column; justify-content:space-between;">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <b style="font-size:14px;">${esc(p.name)}</b>
                <span style="font-size:11px; padding:2px 8px; border-radius:8px; background:${p.is_active ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}; color:${p.is_active ? '#22c55e' : '#ef4444'};">
                  ${p.is_active ? 'فعال' : 'غیرفعال'}
                </span>
              </div>
              <div style="color:var(--cyan); font-weight:800; font-size:15px; margin-bottom:8px;">${priceLabel(p.price)}</div>
              <small style="color:var(--text-muted); font-size:12px; display:block; margin-bottom:12px;">${esc(p.short_description || 'بدون توضیح')}</small>
            </div>
            <button class="nav-link" data-admin-toggle-pid="${p.id}" style="justify-content:center; font-size:12px; background:${p.is_active ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)'}; color:${p.is_active ? '#ef4444' : '#22c55e'};">
              ${p.is_active ? '🚫 غیرفعال کردن' : '✅ فعال کردن'}
            </button>
          </div>
        `).join('')}
      </div>
    `;
  }

  /* ── Admin Order Event Handlers ── */
  function bindAdminOrderEvents(orders) {
    document.querySelectorAll('[data-admin-status-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const order_id = btn.dataset.adminStatusId;
        const status = btn.dataset.status;
        const res = await api('admin_order_status', {}, 'POST', { order_id, status });
        if (res && res.ok) {
          showToast('وضعیت سفارش بروزرسانی شد! ⚡', 'success');
          renderAdminView($('app'));
        } else {
          showToast(res.message || 'خطا در تغییر وضعیت.', 'error');
        }
      });
    });

    document.querySelectorAll('[data-admin-cust-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const user_id = btn.dataset.adminCustId;
        openCustomer360Modal(user_id);
      });
    });
  }

  /* ── Admin Product Event Handlers ── */
  function bindAdminProductEvents(products) {
    document.querySelectorAll('[data-admin-toggle-pid]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const pid = btn.dataset.adminTogglePid;
        const res = await api('admin_toggle_product', {}, 'POST', { product_id: pid });
        if (res && res.ok) {
          showToast('وضعیت محصول بروزرسانی شد', 'success');
          renderAdminView($('app'));
        } else {
          showToast(res.message || 'خطا در تغییر وضعیت محصول.', 'error');
        }
      });
    });
  }

  /* ── Customer 360 View Modal ── */
  async function openCustomer360Modal(userId) {
    const modalContainer = $('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-card" style="max-width:550px; text-align:center;">
        <h3>⏳ در حال بارگذاری اطلاعات کاربر...</h3>
      </div>
    `;
    modalContainer.classList.remove('hidden');

    const res = await api('admin_customer_view', {}, 'POST', { user_id: userId });
    if (!res || !res.ok) {
      showToast('خطا در دریافت پروفایل کاربر', 'error');
      closeModal();
      return;
    }

    const u = res.user || {};
    const stats = res.customer_stats || {};

    modalContainer.innerHTML = `
      <div class="modal-card" style="max-width:550px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid var(--border-color); padding-bottom:14px;">
          <h3 style="font-size:18px; font-weight:900;">👤 پروفایل 360 کاربر</h3>
          <button class="close-drawer-btn" id="close-modal-btn">✕</button>
        </div>

        <div style="display:flex; align-items:center; gap:16px; margin-bottom:20px; background:rgba(255,255,255,0.03); padding:16px; border-radius:16px;">
          <div style="width:50px; height:50px; border-radius:50%; background:var(--accent-grad); display:flex; align-items:center; justify-content:center; font-size:24px; color:#000;">👤</div>
          <div>
            <h4 style="font-size:16px; font-weight:800;">${esc(u.first_name || u.username || 'کاربر')}</h4>
            <div style="color:var(--text-muted); font-size:12px;">ID: #${u.id} · ${u.username ? '@' + esc(u.username) : 'بدون یوزرنیم'}</div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:12px; margin-bottom:20px;">
          <div style="background:var(--card-dark); border:1px solid var(--border-color); padding:14px; border-radius:14px;">
            <small style="color:var(--text-muted); font-size:11px;">موجودی کیف پول</small>
            <b style="display:block; font-size:16px; color:var(--cyan); margin-top:4px;">${priceLabel(u.balance || 0)}</b>
          </div>
          <div style="background:var(--card-dark); border:1px solid var(--border-color); padding:14px; border-radius:14px;">
            <small style="color:var(--text-muted); font-size:11px;">مجموع خریدها</small>
            <b style="display:block; font-size:16px; color:#fff; margin-top:4px;">${priceLabel(res.total_spent || 0)}</b>
          </div>
        </div>
      </div>
    `;

    $('close-modal-btn')?.addEventListener('click', closeModal);
  }

  /* ── Auth Modal (Login, Registration & Telegram Widget) ── */
  window.onTelegramAuth = async function (user) {
    const res = await api('telegram_login', {}, 'POST', { auth_data: user });
    if (res && res.ok) {
      if (res.auth_token) localStorage.setItem('bg_web_token', res.auth_token);
      state.user = res.user;
      showToast('ورود با تلگرام با موفقیت انجام شد! 🎉', 'success');
      closeModal();
      initApp();
    } else {
      showToast(res ? res.message : 'تایید هویت تلگرام ناموفق بود.', 'error');
    }
  };

  function openAuthModal() {
    const modalContainer = $('modal-container');
    if (!modalContainer) return;

    const botName = String(state.bot_username || 'BlueGateBot').replace(/^@/, '').trim();

    modalContainer.innerHTML = `
      <div class="modal-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid var(--border-color); padding-bottom:14px;">
          <h3 style="font-size:18px; font-weight:900;">🔑 ورود / ثبت‌نام در BlueGate</h3>
          <button class="close-drawer-btn" id="close-modal-btn">✕</button>
        </div>

        <div style="display:flex; gap:6px; margin-bottom:20px; background:rgba(255,255,255,0.04); padding:4px; border-radius:14px;">
          <button id="tab-login-btn" class="nav-link active" style="flex:1; justify-content:center; font-size:12px; padding:6px 4px;">ورود</button>
          <button id="tab-register-btn" class="nav-link" style="flex:1; justify-content:center; font-size:12px; padding:6px 4px;">ثبت‌نام</button>
          <button id="tab-telegram-btn" class="nav-link" style="flex:1; justify-content:center; font-size:12px; padding:6px 4px; color:var(--cyan);">✈️ تلگرام</button>
        </div>

        <!-- Login Form -->
        <form id="login-form">
          <div style="margin-bottom:14px;">
            <label style="display:block; font-size:13px; color:var(--text-muted); margin-bottom:6px;">نام کاربری یا ایمیل</label>
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
            <label style="display:block; font-size:13px; color:var(--text-muted); margin-bottom:4px;">ایمیل (جهت ارسال کد OTP)</label>
            <input type="email" id="reg-email" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:12px; font-family:inherit; outline:none;">
          </div>
          <div style="margin-bottom:18px;">
            <label style="display:block; font-size:13px; color:var(--text-muted); margin-bottom:4px;">نام یا نام خانوادگی</label>
            <input type="text" id="reg-firstname" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:12px; font-family:inherit; outline:none;">
          </div>
          <button type="submit" class="user-account-btn" style="width:100%; justify-content:center;">ثبت‌نام حساب جدید</button>
        </form>

        <!-- Telegram Auth Container -->
        <div id="telegram-form" class="hidden" style="text-align:center; padding:16px 0;">
          <p style="color:var(--text-muted); font-size:13px; margin-bottom:16px;">جهت ورود با تلگرام، روی دکمه رسمی زیر کلیک کنید:</p>
          <div id="telegram-widget-wrapper" style="display:flex; justify-content:center; min-height:48px; margin-bottom:16px;"></div>
          
          <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:14px; padding:14px; text-align:right;">
            <small style="color:var(--text-muted); font-size:12px; display:block; margin-bottom:8px;">⚠️ پیام «Bot domain invalid» دریافت می‌کنید؟</small>
            <p style="font-size:12px; color:var(--text-muted); line-height:1.5; margin-bottom:12px;">
              مطمئن شوید در @BotFather با دستور <code>/setdomain</code> دامنه دقیق سایت را (بدون https://) برای ربات ثبت کرده‌اید.
            </p>
            <a id="tg-direct-bot-link" href="https://t.me/${botName}" target="_blank" class="user-account-btn" style="width:100%; justify-content:center; text-decoration:none; font-size:12px;">
              ✈️ ورود مستقیم از طریق ربات تلگرام
            </a>
          </div>
        </div>
      </div>
    `;

    modalContainer.classList.remove('hidden');
    $('close-modal-btn')?.addEventListener('click', closeModal);

    const loginTab = $('tab-login-btn');
    const regTab = $('tab-register-btn');
    const tgTab = $('tab-telegram-btn');
    const loginForm = $('login-form');
    const regForm = $('register-form');
    const tgForm = $('telegram-form');

    loginTab?.addEventListener('click', () => {
      loginTab.classList.add('active');
      regTab.classList.remove('active');
      tgTab?.classList.remove('active');
      loginForm.classList.remove('hidden');
      regForm.classList.add('hidden');
      tgForm.classList.add('hidden');
    });

    regTab?.addEventListener('click', () => {
      regTab.classList.add('active');
      loginTab.classList.remove('active');
      tgTab?.classList.remove('active');
      regForm.classList.remove('hidden');
      loginForm.classList.add('hidden');
      tgForm.classList.add('hidden');
    });

    tgTab?.addEventListener('click', () => {
      tgTab.classList.add('active');
      loginTab.classList.remove('active');
      regTab.classList.remove('active');
      tgForm.classList.remove('hidden');
      loginForm.classList.add('hidden');
      regForm.classList.add('hidden');

      // Get fresh bot name from state (already populated by initApp)
      const freshBotName = String(state.bot_username || botName || '').replace(/^@/, '').trim();
      console.log('[BlueGate] Telegram widget bot:', freshBotName, '| domain:', window.location.hostname);

      const wrapper = $('telegram-widget-wrapper');
      if (wrapper && !wrapper.hasChildNodes() && freshBotName) {
        const script = document.createElement('script');
        script.src = 'https://telegram.org/js/telegram-widget.js?22';
        script.setAttribute('data-telegram-login', freshBotName);
        script.setAttribute('data-size', 'large');
        script.setAttribute('data-radius', '12');
        script.setAttribute('data-onauth', 'onTelegramAuth(user)');
        script.setAttribute('data-request-access', 'write');
        script.async = true;
        script.onerror = () => console.error('[BlueGate] Telegram widget script failed to load');
        wrapper.appendChild(script);
      } else if (!freshBotName) {
        if (wrapper) wrapper.innerHTML = '<p style="color:#f87171;font-size:12px;">نام ربات تنظیم نشده. لطفاً با پشتیبانی تماس بگیرید.</p>';
      }
    });

    let pendingUserId = null;

    function showOtpForm(userId, message) {
      pendingUserId = userId;
      modalContainer.innerHTML = `
        <div class="modal-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid var(--border-color); padding-bottom:14px;">
            <h3 style="font-size:18px; font-weight:900;">✉️ تایید ایمیل</h3>
            <button class="close-drawer-btn" id="close-modal-btn">✕</button>
          </div>
          <p style="color:var(--text-muted); font-size:14px; margin-bottom:20px; text-align:center;">${esc(message)}</p>
          <form id="otp-form">
            <div style="margin-bottom:20px;">
              <label style="display:block; font-size:13px; color:var(--text-muted); margin-bottom:6px;">کد تایید ۶ رقمی</label>
              <input type="text" id="otp-code" required style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:12px; border-radius:12px; font-family:inherit; outline:none; text-align:center; font-size:24px; letter-spacing:4px;">
            </div>
            <button type="submit" class="user-account-btn" style="width:100%; justify-content:center;">تایید کد</button>
          </form>
        </div>
      `;
      $('close-modal-btn')?.addEventListener('click', closeModal);
      $('otp-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const otp = $('otp-code').value.trim();
        const res = await api('verify_email_otp', {}, 'POST', { user_id: pendingUserId, otp });
        if (res && res.ok) {
          if (res.auth_token) localStorage.setItem('bg_web_token', res.auth_token);
          state.user = res.user;
          showToast(res.message || 'ایمیل تایید شد!', 'success');
          closeModal();
          initApp();
        } else {
          showToast(res.message || 'کد تایید نامعتبر است.', 'error');
        }
      });
    }

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
      } else if (res && res.error === 'EMAIL_VERIFICATION_REQUIRED') {
        showOtpForm(res.user_id, res.message);
      } else {
        showToast(res ? res.message : 'نام کاربری یا رمز عبور اشتباه است.', 'error');
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
        if (res.requires_email_verification) {
          showOtpForm(res.user_id, res.message);
        } else {
          if (res.auth_token) localStorage.setItem('bg_web_token', res.auth_token);
          state.user = res.user;
          showToast('ثبت‌نام با موفقیت انجام شد! 🎉', 'success');
          closeModal();
          initApp();
        }
      } else {
        showToast(res ? res.message : 'خطا در ثبت‌نام.', 'error');
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
    const variants = p.variants || [];

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

        ${variants.length > 0 ? `
          <div style="margin-bottom:20px;">
            <label style="display:block; font-size:13px; color:var(--text-muted); margin-bottom:6px;">انتخاب پلن / مدت زمان</label>
            <select id="modal-variant-select" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:12px; border-radius:12px; font-family:inherit; outline:none; font-size:14px;">
              ${variants.map(v => `<option value="${v.id}" data-price="${v.price}" data-title="${esc(v.title)}">${esc(v.title)} — ${priceLabel(v.price)}</option>`).join('')}
            </select>
          </div>
        ` : ''}

        <div style="display:flex; justify-content:space-between; align-items:center;">
          <b id="modal-price-label" style="font-size:20px; color:var(--cyan);">
            ${priceLabel(variants.length > 0 ? variants[0].price : p.price)}
          </b>
          <button class="user-account-btn" id="btn-buy-modal">⚡ افزودن به سبد خرید</button>
        </div>
      </div>
    `;

    modalContainer.classList.remove('hidden');
    $('close-modal-btn')?.addEventListener('click', closeModal);

    const vSelect = $('modal-variant-select');
    const priceLbl = $('modal-price-label');

    if (vSelect && priceLbl) {
      vSelect.addEventListener('change', () => {
        const opt = vSelect.options[vSelect.selectedIndex];
        priceLbl.textContent = priceLabel(opt.dataset.price);
      });
    }

    $('btn-buy-modal')?.addEventListener('click', () => {
      let vId = null, vTitle = '', vPrice = null;
      if (vSelect) {
        const opt = vSelect.options[vSelect.selectedIndex];
        vId = opt.value;
        vTitle = opt.dataset.title;
        vPrice = opt.dataset.price;
      }
      addToCart(p.id, vId, vTitle, vPrice);
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

      // Quick Buy (From Cards)
      const buyBtn = e.target.closest('[data-buy]');
      if (buyBtn && buyBtn.dataset.buy) {
        e.stopPropagation();
        const p = state.products.find(item => Number(item.id) === Number(buyBtn.dataset.buy));
        if (p && p.variants && p.variants.length > 0) {
          openProductModal(p.id);
        } else {
          addToCart(buyBtn.dataset.buy);
        }
      }

      // Wishlist toggle
      const wishBtn = e.target.closest('[data-wishlist]');
      if (wishBtn && wishBtn.dataset.wishlist) {
        e.stopPropagation();
        toggleWishlist(wishBtn.dataset.wishlist);
      }

      // Order Detail
      const orderCard = e.target.closest('[data-order-open]');
      if (orderCard && orderCard.dataset.orderOpen) {
        openOrderDetailModal(orderCard.dataset.orderOpen);
      }
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

  function addToCart(pid, vId = null, vTitle = '', vPrice = null) {
    const product = state.products.find(p => Number(p.id) === Number(pid));
    if (!product) return;

    const title = product.title || product.name || 'محصول بدون عنوان';
    const finalTitle = vId ? `${title} — ${vTitle}` : title;
    const finalPrice = vPrice !== null ? vPrice : product.price;

    const existing = state.cart.find(item => Number(item.id) === Number(pid) && item.vid == vId);
    if (existing) {
      existing.qty = (existing.qty || 1) + 1;
    } else {
      state.cart.push({ id: product.id, vid: vId, title: finalTitle, price: finalPrice, qty: 1 });
    }

    localStorage.setItem('bg_web_cart', JSON.stringify(state.cart));
    updateCartCount();
    showToast(`"${finalTitle}" به سبد خرید اضافه شد! 🛒`, 'success');
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
      <button id="cart-checkout-btn" class="user-account-btn" style="width:100%; justify-content:center;">تکمیل خرید &amp; پرداخت</button>
    `;

    $('cart-checkout-btn')?.addEventListener('click', checkoutCart);
  }

  /* ── Checkout Flow ── */
  async function checkoutCart() {
    if (!state.cart.length) return;
    if (!state.user || state.user.is_guest) {
      showToast('برای ثبت سفارش لطفا وارد حساب شوید', 'error');
      openAuthModal();
      return;
    }

    const btn = $('cart-checkout-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'در حال پردازش...';
    }

    let okCount = 0, failCount = 0;
    
    // We send create_order for each item separately
    for (const item of state.cart) {
      for (let i = 0; i < (item.qty || 1); i++) {
        try {
          const payload = { product_id: item.id, use_wallet: 0, is_web: 1 };
          if (item.vid) payload.variant_id = item.vid;
          const res = await api('create_order', {}, 'POST', payload);
          if (res && res.ok) okCount++;
          else failCount++;
        } catch(e) {
          failCount++;
        }
      }
    }

    // Clear cart locally
    state.cart = [];
    localStorage.setItem('bg_web_cart', '[]');
    updateCartCount();
    openCartDrawer(false);

    showToast(`✅ ${nf(okCount)} سفارش ثبت شد${failCount ? ` · ${nf(failCount)} ناموفق` : ''}`, 'success');

    // Switch to orders tab to see them
    state.currentTab = 'orders';
    renderApp();
  }

  /* ── Boot Web Engine ── */
  document.addEventListener('DOMContentLoaded', initApp);

})();
