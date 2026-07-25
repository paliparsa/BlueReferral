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
    recent: JSON.parse(localStorage.getItem('bg_web_recent') || '[]'),
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
      state.spin_rewards = res.spin_rewards || [];
      state.spin_every = res.spin_every || 5;
      state.missions = res.missions || [];
      state.transactions = res.transactions || [];
      state.achievements = res.achievements || [];
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
    handleDeepLink();
  }

  /* ── Product Deep Link Handler ── */
  function handleDeepLink() {
    const search = new URLSearchParams(window.location.search);
    const hash = window.location.hash || '';

    let productId = search.get('p') || search.get('product') || search.get('id');

    if (!productId && hash) {
      const match = hash.match(/product-(\d+)/i) || hash.match(/p=(\d+)/i) || hash.match(/pid=(\d+)/i) || hash.match(/#(\d+)/);
      if (match) productId = match[1];
    }

    if (productId && state.products.length > 0) {
      const p = state.products.find(x => Number(x.id) === Number(productId));
      if (p) {
        state.currentTab = 'shop';
        renderApp();
        setTimeout(() => openProductModal(p.id), 250);
      }
    }
  }

  window.addEventListener('hashchange', handleDeepLink, { passive: true });

  /* ── Auto Responsive Device Detection ── */
  function detectDevice() {
    const w = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const isMobile = w <= 768 || (isTouch && w <= 900) || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    return { w, isMobile, isDesktop: !isMobile };
  }

  function applyResponsiveLayout() {
    const d = detectDevice();
    const target = document.body || document.documentElement;
    if (target) {
      target.classList.toggle('is-mobile-view', d.isMobile);
      target.classList.toggle('is-desktop-view', d.isDesktop);
    }
    renderMobileBottomNav(d.isMobile);
  }

  function renderMobileBottomNav(isMobile) {
    let container = $('mobile-bottom-nav');
    if (!isMobile) {
      if (container) container.style.display = 'none';
      return;
    }

    const mount = document.body || document.documentElement;
    if (!mount) return;

    if (!container) {
      container = document.createElement('nav');
      container.id = 'mobile-bottom-nav';
      container.className = 'mobile-bottom-nav';
      mount.appendChild(container);
    }

    container.style.display = 'flex';
    const totalCart = state.cart.reduce((sum, item) => sum + (item.qty || 1), 0);

    container.innerHTML = `
      <button class="mobile-nav-btn ${state.currentTab === 'shop' ? 'active' : ''}" data-tab="shop">
        <span class="mnav-icon">🛍️</span>
        <span class="mnav-label">فروشگاه</span>
      </button>
      <button class="mobile-nav-btn ${state.currentTab === 'orders' ? 'active' : ''}" data-tab="orders">
        <span class="mnav-icon">📜</span>
        <span class="mnav-label">سفارش‌ها</span>
      </button>
      <button class="mobile-nav-btn ${state.currentTab === 'wallet' ? 'active' : ''}" data-tab="wallet">
        <span class="mnav-icon">💰</span>
        <span class="mnav-label">کیف پول</span>
      </button>
      <button class="mobile-nav-btn" id="mobile-cart-trigger">
        <span class="mnav-icon">🛒 ${totalCart > 0 ? `<b class="mobile-cart-badge">${totalCart}</b>` : ''}</span>
        <span class="mnav-label">سبد خرید</span>
      </button>
      <button class="mobile-nav-btn ${state.currentTab === 'profile' ? 'active' : ''}" id="mobile-user-trigger">
        <span class="mnav-icon">👤</span>
        <span class="mnav-label">${state.user && !state.user.is_guest ? 'حساب' : 'ورود'}</span>
      </button>
    `;

    $('mobile-cart-trigger')?.addEventListener('click', () => openCartDrawer(true));
    $('mobile-user-trigger')?.addEventListener('click', () => {
      if (state.user && !state.user.is_guest) {
        state.currentTab = 'profile';
        renderApp();
      } else {
        openAuthModal();
      }
    });
  }

  window.addEventListener('resize', applyResponsiveLayout, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(applyResponsiveLayout, 150), { passive: true });

  /* ── Main App Renderer ── */
  function renderApp() {
    applyResponsiveLayout();
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
            <div class="trust-chip" data-tab="wallet" style="cursor:pointer;"><span>🎡</span><b>گردونه شانس روزانه</b></div>
            <div class="trust-chip" data-tab="wallet" style="cursor:pointer;"><span>💰</span><b>کیف پول &amp; پاداش دعوت</b></div>
            <div class="trust-chip" data-tab="wallet" style="cursor:pointer;"><span>👥</span><b>درخت زیرمجموعه‌ها</b></div>
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
      ${glowingFlashSaleSectionHtml()}
      <div class="storefront-layout">
        ${sidebarHtml}
        <section class="catalog-area">
          ${recentProductsHtml()}
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

  /* ── Glowing Top Section — Only shows products with real discounts ── */
  /* Shows: active flash sale OR at least one variant with discount_percent > 0 */
  function glowingFlashSaleSectionHtml() {
    const specialProducts = state.products.filter(p => {
      if (flashSaleActive(p)) return true;
      return (p.variants || []).some(v => Number(v.discount_percent) > 0);
    });
    if (!specialProducts.length) return '';

    const flashProduct = specialProducts.find(p => flashSaleActive(p));
    const timerText = flashProduct ? getFlashTimeRemaining(flashProduct) : '';

    return `
      <section class="glowing-flash-sale-section">
        <div class="flash-sale-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="glowing-fire-icon">⚡</span>
            <h3 class="flash-sale-title">تخفیف‌های ویژه</h3>
          </div>
          ${timerText ? `
          <div class="flash-sale-timer-pill">
            <span>⏰ زمان باقی‌مانده:</span>
            <b class="flash-sale-timer">${timerText}</b>
          </div>` : ''}
        </div>

        <div class="glowing-flash-products-row">
          ${specialProducts.slice(0, 6).map(p => {
            const flash = flashSaleActive(p);
            const flashDisc = Number(p.flash_sale_discount || 0);

            // For flash sale: p.price is original, realPrice = p.price * (1 - flashDisc/100)
            // For variant discount: show the cheapest variant's discounted vs original
            let realPrice = Number(p.price);
            let crossedPrice = 0;
            let discLabel = '';

            if (flash && flashDisc > 0) {
              realPrice = Math.round(Number(p.price) * (1 - flashDisc / 100));
              crossedPrice = Number(p.price);
              discLabel = `⚡ −${flashDisc}٪`;
            } else {
              // Find best variant discount
              const discountedVariants = (p.variants || []).filter(v => Number(v.discount_percent) > 0);
              if (discountedVariants.length > 0) {
                // Sort by most discount
                const best = discountedVariants.sort((a, b) => Number(b.discount_percent) - Number(a.discount_percent))[0];
                const d = Number(best.discount_percent);
                realPrice = Number(best.price); // already discounted
                crossedPrice = Number(best.old_price) || Math.round(Number(best.price) / (1 - d / 100));
                discLabel = `−${d}٪`;
              }
            }

            return `
              <div class="glowing-flash-card" data-pid="${p.id}">
                <span class="flash-card-badge">${discLabel || 'ویژه'}</span>
                <div class="flash-card-img">
                  ${p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(p.title || p.name)}">` : `<span>🛒</span>`}
                </div>
                <div class="flash-card-title">${esc(p.title || p.name)}</div>
                <div class="flash-card-bottom">
                  <div class="flash-card-price-col">
                    ${crossedPrice > 0 ? `<s class="flash-card-orig-price">${priceLabel(crossedPrice)}</s>` : ''}
                    <b class="flash-card-cur-price">${priceLabel(realPrice)}</b>
                  </div>
                  <button class="card-quick-buy-btn" data-buy="${p.id}" style="padding:6px 12px; font-size:12px;">⚡ خرید</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>
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

  /* ── Flash Sale Active Check — mirrors miniapp flashSaleActive(p) ── */
  function flashSaleActive(p) {
    if (!p.flash_sale_start || !p.flash_sale_end || !Number(p.flash_sale_discount)) return false;
    const now = Date.now();
    return now >= new Date(p.flash_sale_start).getTime() && now <= new Date(p.flash_sale_end).getTime();
  }

  function flashSaleCountdown(p) {
    if (!flashSaleActive(p)) return '';
    const ms = new Date(p.flash_sale_end).getTime() - Date.now();
    if (ms <= 0) return '';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `⚡ فلش فروش −${p.flash_sale_discount}٪ · ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  /* ── Product Card Component ── */
  function renderProductCard(p) {
    const title = p.title || p.name || 'محصول بدون عنوان';
    const isWished = state.wishlist.includes(Number(p.id));
    const flash = flashSaleActive(p);
    const flashDiscount = Number(p.flash_sale_discount || 0);

    // Find best variant discount (highest %) for display on the card
    const discountedVariants = (p.variants || []).filter(v => Number(v.discount_percent) > 0);
    const bestVariant = discountedVariants.sort((a, b) => Number(b.discount_percent) - Number(a.discount_percent))[0];
    const variantDiscount = bestVariant ? Number(bestVariant.discount_percent) : 0;
    const hasSale = flash || variantDiscount > 0;

    let origPrice = 0;   // crossed-out price
    let salePrice = 0;   // actual price to pay
    let discPct = 0;

    if (flash && flashDiscount > 0) {
      // Flash sale on the product itself
      origPrice = Number(p.price);
      salePrice = Math.round(origPrice * (1 - flashDiscount / 100));
      discPct = flashDiscount;
    } else if (bestVariant) {
      // Variant-level discount: v.price already discounted, v.old_price = original
      origPrice = Number(bestVariant.old_price) || 0;
      salePrice = Number(bestVariant.price);
      discPct = variantDiscount;
      // Safety: only show crossed price if original is actually higher
      if (origPrice <= salePrice) origPrice = 0;
    }

    const priceHtml = (origPrice > 0 && salePrice > 0)
      ? `<s style="color:var(--text-muted); font-size:11px; text-decoration:line-through;">${priceLabel(origPrice)}</s>
         <b style="color:var(--cyan); font-weight:900; display:block; margin-top:2px;">${priceLabel(salePrice)}</b>`
      : `<b style="color:var(--cyan); font-weight:900;">${priceLabel(p.price)}</b>`;

    const badgeHtml = flash
      ? `<div class="flash-sale-badge"><span>⚡</span><b class="flash-sale-timer" data-pid="${p.id}">${flashSaleCountdown(p)}</b></div>`
      : (discPct > 0 ? `<span class="card-discount-badge">−${discPct}٪ تخفیف</span>` : '');

    return `
      <div class="product-card ${hasSale ? 'has-sale' : ''}" data-pid="${p.id}">
        <div class="card-img-wrap">
          ${badgeHtml}
          <button class="card-wishlist-btn" data-wishlist="${p.id}">${isWished ? '❤️' : '🤍'}</button>
          ${p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(title)}">` : `<span style="display:flex;align-items:center;justify-content:center;height:100%;font-size:56px;">🛒</span>`}
        </div>
        <div class="card-content">
          <h3 class="card-title">${esc(title)}</h3>
          <div class="card-price-row">
            <div class="card-price">${priceHtml}</div>
            <div style="display:flex; gap:6px;">
              <button class="user-account-btn" data-share="${p.id}" style="padding:6px 10px; font-size:12px;" title="اشتراک‌گذاری">🔗</button>
              <button class="card-quick-buy-btn" data-buy="${p.id}">⚡ خرید</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* ── Phase 4 — Product Experience Helpers ── */
  function pushRecent(pid) {
    const id = Number(pid);
    if (!id) return;
    state.recent = [id, ...state.recent.filter(x => Number(x) !== id)].slice(0, 8);
    localStorage.setItem('bg_web_recent', JSON.stringify(state.recent));
  }

  /* getFlashTimeRemaining kept for timer pill in banner only */
  function getFlashTimeRemaining(p = null) {
    if (p && p.flash_sale_end) {
      const ms = new Date(p.flash_sale_end).getTime() - Date.now();
      if (ms > 0) {
        const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
        const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
        const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
        return `${nf(h)}:${nf(m)}:${nf(s)}`;
      }
    }
    return '';
  }

  function recentProductsHtml() {
    if (!state.recent || !state.recent.length) return '';
    const recentProds = state.recent.map(id => state.products.find(p => Number(p.id) === Number(id))).filter(Boolean);
    if (!recentProds.length) return '';

    return `
      <div class="recently-viewed-section">
        <h3 class="sidebar-title" style="margin-bottom:12px; font-size:14px; color:var(--cyan);">👁️ آخرین بازدیدهای شما</h3>
        <div class="recent-products-row">
          ${recentProds.map(p => `
            <div class="recent-product-card" data-pid="${p.id}">
              <div class="recent-card-img">
                ${p.image_url ? `<img src="${esc(p.image_url)}">` : `<span>🛒</span>`}
              </div>
              <div class="recent-card-info">
                <b>${esc(p.title || p.name)}</b>
                <small style="color:var(--cyan); font-weight:800; font-size:11px;">${priceLabel(p.price)}</small>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function toggleWishlist(pid) {
    const id = Number(pid);
    if (!id) return;
    const idx = state.wishlist.indexOf(id);
    if (idx > -1) {
      state.wishlist.splice(idx, 1);
      showToast('از لیست نشان‌شده‌ها حذف شد', 'info');
    } else {
      state.wishlist.push(id);
      showToast('به لیست نشان‌شده‌ها اضافه شد! ❤️', 'success');
    }
    localStorage.setItem('bg_web_wishlist', JSON.stringify(state.wishlist));
    renderApp();
  }

  function openShareSheet(pid) {
    const p = state.products.find(x => Number(x.id) === Number(pid));
    if (!p) return;
    const modalContainer = $('modal-container');
    if (!modalContainer) return;
    if (document.body) document.body.style.overflow = 'hidden';

    const baseUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${baseUrl}?p=${p.id}`;
    const shareTitle = p.title || p.name || 'محصول BlueGate';

    modalContainer.innerHTML = `
      <div class="modal-card" style="max-width:460px; text-align:center;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h3 style="font-size:18px; font-weight:900;">🔗 اشتراک‌گذاری محصول</h3>
          <button class="close-drawer-btn" id="close-modal-btn">✕</button>
        </div>
        
        <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:16px; padding:16px; margin-bottom:16px; display:flex; align-items:center; gap:12px; text-align:right;">
          ${p.image_url ? `<img src="${esc(p.image_url)}" style="width:50px; height:50px; border-radius:10px; object-fit:cover;">` : '<span style="font-size:32px;">🛍️</span>'}
          <div>
            <b style="font-size:14px; color:#fff; display:block;">${esc(shareTitle)}</b>
            <small style="color:var(--cyan); font-weight:800;">${priceLabel(p.price)}</small>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:10px;">
          <a href="https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}" target="_blank" class="user-account-btn" style="width:100%; justify-content:center; background:#229ED9; color:#fff; font-weight:800; text-decoration:none;">
            ✈️ ارسال مستقیم در تلگرام
          </a>
          <button class="user-account-btn" id="btn-copy-share-link" style="width:100%; justify-content:center;">
            📋 کپی لینک مستقیم
          </button>
          ${navigator.share ? `
            <button class="user-account-btn" id="btn-native-share" style="width:100%; justify-content:center; background:rgba(255,255,255,0.08);">
              📱 اشتراک‌گذاری بومی
            </button>
          ` : ''}
        </div>
      </div>
    `;
    modalContainer.classList.remove('hidden');

    $('close-modal-btn')?.addEventListener('click', closeModal);
    $('btn-copy-share-link')?.addEventListener('click', () => {
      navigator.clipboard.writeText(shareUrl);
      showToast('لینک محصول کپی شد! 📋', 'success');
    });
    $('btn-native-share')?.addEventListener('click', () => {
      navigator.share({ title: shareTitle, url: shareUrl }).catch(() => {});
    });
  }

  setInterval(() => {
    const timerEls = document.querySelectorAll('.flash-sale-timer');
    if (timerEls.length) {
      const tStr = getFlashTimeRemaining();
      timerEls.forEach(el => el.textContent = tStr);
    }
  }, 1000);

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
      {label: 'ثبت سفارش', icon: '📝'},
      {label: 'پرداخت', icon: '💳'},
      {label: 'آماده‌سازی', icon: '📦'},
      {label: 'تحویل نهایی', icon: '✅'}
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

    const progressPct = cur === 0 ? 0 : cur === 1 ? 33 : cur === 2 ? 66 : 100;

    return `
      <div class="order-stepper-container">
        <div class="stepper-bar-bg">
          <div class="stepper-bar-fill" style="width:${progressPct}%;"></div>
        </div>
        <div class="stepper-nodes-row">
          ${steps.map((s, i) => `
            <div class="step-node ${i <= cur ? 'done' : ''} ${i === cur ? 'active' : ''}">
              <div class="node-circle">${i < cur ? '✓' : (i === cur ? '⚡' : s.icon)}</div>
              <span class="node-title">${s.label}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /* ── Order Detail Modal ── */
  function openOrderDetailModal(orderId) {
    const modalContainer = $('modal-container');
    if (!modalContainer) return;
    if (document.body) document.body.style.overflow = 'hidden';
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
        <div class="modal-card" style="max-width:620px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid var(--border-color); padding-bottom:16px;">
            <div>
              <small style="color:var(--text-muted);">سفارش #${nf(o.id)}</small>
              <h3 style="font-size:18px; font-weight:900;">${esc(o.display_name || 'محصول')}</h3>
            </div>
            <button class="close-drawer-btn" id="close-modal-btn">✕</button>
          </div>

          ${orderStepperHtml(o)}

          <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:16px; padding:20px; margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
              <span style="color:var(--text-muted); font-size:14px;">مبلغ نهایی پرداخت</span>
              <b style="color:var(--cyan); font-size:16px;">${priceLabel(o.final_amount || o.price)}</b>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
              <span style="color:var(--text-muted); font-size:14px;">روش پرداخت</span>
              <b style="font-size:14px;">${esc(o.payment_method_fa || 'انتخاب نشده')}</b>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span style="color:var(--text-muted); font-size:14px;">تاریخ ثبت</span>
              <b style="font-size:14px;">${esc(o.created_at || '-')}</b>
            </div>
          </div>

          ${o.license_key ? `
            <div style="background:rgba(34, 197, 94, 0.1); border:1px solid rgba(34, 197, 94, 0.3); border-radius:16px; padding:20px; margin-bottom:16px; text-align:center;">
              <p style="color:#4ade80; font-size:13px; margin-bottom:8px;">✅ کد لایسنس / اطلاعات تحویل:</p>
              <code style="display:block; font-size:18px; font-weight:900; background:rgba(0,0,0,0.3); padding:10px; border-radius:8px; margin-bottom:12px;">${esc(o.license_key)}</code>
              <button class="user-account-btn" data-copy="${esc(o.license_key)}" style="background:#22c55e; color:#000; margin:0 auto;">📋 کپی اطلاعات</button>
            </div>
          ` : ''}

          ${o.payment_note ? `<div class="note-box"><b>رسید / توضیحات پرداخت:</b><br>${esc(o.payment_note)}</div>` : ''}
          ${o.customer_note ? `<div class="note-box customer"><b>یادداشت اکانت / توضیحات شما:</b><br>${esc(o.customer_note)}</div>` : ''}
          ${o.delivery_text ? `<div class="note-box" style="border-color:#22c55e; background:rgba(34,197,94,0.06);"><b style="color:#4ade80;">اطلاعات تحویل سفارش:</b><br>${esc(o.delivery_text)}</div>` : ''}

          ${o.timeline && o.timeline.length ? `
            <details class="timeline-details">
              <summary>🗓 تاریخچه کامل تغییرات سفارش (${o.timeline.length})</summary>
              <div class="timeline">
                ${o.timeline.map(t => `<div><b>${esc(t.title)}</b><small>${esc(t.created_at || '')}</small></div>`).join('')}
              </div>
            </details>
          ` : ''}

          <!-- Action Buttons Bar -->
          <div class="order-action-pills-bar">
            <button class="order-pill-btn info" id="btn-order-note-${o.id}">
              <span>📝</span> <b>یادداشت اکانت</b>
            </button>
            ${o.status === 'pending_payment' ? `
              <button class="order-pill-btn primary" id="btn-order-coupon-${o.id}">
                <span>🎟</span> <b>کد تخفیف</b>
              </button>
              <button class="order-pill-btn danger" id="btn-order-cancel-${o.id}">
                <span>❌</span> <b>لغو سفارش</b>
              </button>
            ` : ''}
            ${['rejected', 'canceled', 'refunded'].includes(o.status) ? `
              <button class="order-pill-btn danger" id="btn-order-hide-${o.id}">
                <span>🗑️</span> <b>حذف از لیست</b>
              </button>
            ` : ''}
          </div>

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
        <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:20px; padding:20px; margin-top:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <b style="font-size:15px; color:var(--cyan);">💳 اطلاعات شماره کارت</b>
            <button class="btn-reset-method" id="btn-reset-method-${o.id}">🔄 تغییر روش</button>
          </div>
          ${accounts.map(acc => {
            const rawCard = String(acc.card || '0000000000000000').replace(/\D/g, '');
            const formattedCard = rawCard.length === 16 ? rawCard.match(/.{1,4}/g).join(' - ') : esc(acc.card || '');
            return `
              <div class="luxury-bank-card-v2">
                <div class="bank-card-header">
                  <span class="card-chip-icon">💳</span>
                  <span class="bank-title">${esc(acc.title || 'کارت بانکی سفارشات')}</span>
                </div>
                <div class="bank-number-display">${formattedCard}</div>
                <div class="bank-owner-row">
                  <span>صاحب حساب: <b>${esc(acc.owner || 'پشتیبانی فروشگاه')}</b></span>
                </div>
                <button class="card-copy-btn" data-copy="${esc(acc.card || '')}">📋 کپی شماره کارت</button>
              </div>
            `;
          }).join('')}

          <form id="receipt-upload-form-${o.id}" style="margin-top:18px; border-top:1px solid var(--border-color); padding-top:16px;">
            <div style="margin-bottom:14px;">
              <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:6px;">توضیحات / شماره پیگیری / ۴ رقم کارت</label>
              <input type="text" id="receipt-note-${o.id}" required placeholder="مثلاً: واریز از کارت علی محمودی کد ۱۲۳۴" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:12px; border-radius:12px; font-family:inherit; outline:none; font-size:13px;">
            </div>
            <div style="margin-bottom:16px;">
              <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:6px;">تصویر رسید (اختیاری)</label>
              <label class="custom-file-upload">
                <input type="file" id="receipt-file-${o.id}" accept="image/*" style="display:none;">
                <span class="upload-icon">🖼️</span>
                <span id="receipt-file-label-${o.id}" class="upload-label">انتخاب یا درگ تصویر رسید پرداخت...</span>
              </label>
            </div>
            <button type="submit" class="user-account-btn" style="width:100%; justify-content:center; background:linear-gradient(135deg, var(--cyan), #1d9bf0); color:#000; font-weight:900; padding:12px;">📤 ثبت رسید و تایید پرداخت</button>
          </form>
        </div>
      `;
    }

    // 3. Crypto Invoicing Panel
    if (o.payment_method === 'crypto') {
      const wallets = methods.crypto?.wallets || [];
      const cryptoCheck = o.crypto_check;

      html += `
        <div class="crypto-invoice-panel" style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:20px; padding:20px; margin-top:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <b style="font-size:15px; color:var(--cyan);">🪙 پرداخت رمزارز (Crypto)</b>
            <button class="btn-reset-method" id="btn-reset-method-${o.id}">🔄 تغییر روش</button>
          </div>
          ${!cryptoCheck ? `
            <p style="color:var(--text-muted); font-size:13px; margin-bottom:14px;">کیف پول شبکه مورد نظر خود را برای پرداخت انتخاب کنید:</p>
            <div class="crypto-wallet-list">
              ${wallets.map(w => `
                <button class="crypto-wallet-item" data-select-crypto-id="${w.id}">
                  <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:22px;">🪙</span>
                    <div>
                      <b style="font-size:14px; color:#fff; display:block;">${esc(w.title || w.asset || 'USDT')}</b>
                      <span style="font-size:11px; color:var(--text-muted);">${esc(w.network || 'TRC20')}</span>
                    </div>
                  </div>
                  <small style="color:var(--cyan); font-weight:800; font-size:13px;">${w.rate_toman ? `۱ ${esc(w.asset || 'USDT')} = ${priceLabel(w.rate_toman)}` : ''}</small>
                </button>
              `).join('')}
            </div>
          ` : `
            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--border-color); border-radius:16px; padding:16px; margin-bottom:16px;">
              <small style="color:var(--text-muted); font-size:12px; display:block; margin-bottom:6px;">آدرس کیف پول جهت واریز:</small>
              <code style="font-size:14px; color:var(--cyan); word-break:break-all; display:block; margin-bottom:12px; background:rgba(0,0,0,0.4); padding:10px; border-radius:10px;">${esc(cryptoCheck.address)}</code>
              <button class="user-account-btn" data-copy="${esc(cryptoCheck.address)}" style="font-size:12px; padding:8px 16px; background:var(--cyan); color:#000;">📋 کپی آدرس ولت</button>
            </div>
            <form id="crypto-hash-form-${o.id}">
              <div style="margin-bottom:14px;">
                <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:6px;">کد هش تراکنش (TXID / Hash)</label>
                <input type="text" id="crypto-txid-${o.id}" required placeholder="هش تراکنش شبکه..." style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:12px; border-radius:12px; font-family:inherit; outline:none; font-size:13px;">
              </div>
              <button type="submit" class="user-account-btn" style="width:100%; justify-content:center; background:linear-gradient(135deg, var(--cyan), #1d9bf0); color:#000; font-weight:900; padding:12px;">⚡ ثبت TXID جهت استعلام آنی</button>
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
    // Wallet Payment Action -> Open Confirmation Sheet
    $(`btn-pay-wallet-${o.id}`)?.addEventListener('click', () => {
      openWalletConfirmSheet(o.id);
    });

    // Customer Note Action
    $(`btn-order-note-${o.id}`)?.addEventListener('click', async () => {
      const note = prompt('یادداشت جدید برای این سفارش (مثلاً نام کاربری/توضیحات اکانت):', o.customer_note || '');
      if (note === null) return;
      const res = await api('customer_order_note', {}, 'POST', { order_id: o.id, customer_note: note });
      if (res && res.ok) {
        showToast('یادداشت سفارش ذخیره شد 📝', 'success');
        openOrderDetailModal(o.id);
      } else {
        showToast(res.message || 'خطا در ذخیره یادداشت.', 'error');
      }
    });

    // Coupon Code Action
    $(`btn-order-coupon-${o.id}`)?.addEventListener('click', async () => {
      const coupon = prompt('کد تخفیف خود را وارد کنید:');
      if (!coupon) return;
      const res = await api('apply_coupon', {}, 'POST', { order_id: o.id, coupon_code: coupon });
      if (res && res.ok) {
        showToast('کد تخفیف اعمال شد! 🎉', 'success');
        openOrderDetailModal(o.id);
      } else {
        showToast(res.message || 'کد تخفیف نامعتبر یا منقضی است.', 'error');
      }
    });

    // Cancel Order Action
    $(`btn-order-cancel-${o.id}`)?.addEventListener('click', async () => {
      if (!confirm(`آیا از لغو سفارش #${o.id} اطمینان دارید؟`)) return;
      const res = await api('cancel_order', {}, 'POST', { order_id: o.id });
      if (res && res.ok) {
        showToast('سفارش لغو شد', 'info');
        openOrderDetailModal(o.id);
      } else {
        showToast(res.message || 'خطا در لغو سفارش.', 'error');
      }
    });

    // Hide Order Action
    $(`btn-order-hide-${o.id}`)?.addEventListener('click', async () => {
      if (!confirm(`آیا این سفارش از لیست شما حذف شود؟`)) return;
      const res = await api('hide_order', {}, 'POST', { order_id: o.id });
      if (res && res.ok) {
        showToast('سفارش از لیست حذف شد', 'info');
        closeModal();
        renderApp();
      } else {
        showToast(res.message || 'خطا در حذف سفارش.', 'error');
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

    // Select Crypto Wallet Asset
    document.querySelectorAll(`[data-select-crypto-id]`).forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const wallet_id = e.currentTarget.dataset.selectCryptoId;
        const res = await api('select_crypto_wallet', {}, 'POST', { order_id: o.id, wallet_id });
        if (res && res.ok) openOrderDetailModal(o.id);
      });
    });

    // Reset Payment Method Action
    $(`btn-reset-method-${o.id}`)?.addEventListener('click', async () => {
      const res = await api('select_payment_method', {}, 'POST', { order_id: o.id, method: 'none' });
      if (res && res.ok) openOrderDetailModal(o.id);
    });

    // File label change listener
    const fileInput = $(`receipt-file-${o.id}`);
    const fileLabel = $(`receipt-file-label-${o.id}`);
    if (fileInput && fileLabel) {
      fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files[0]) {
          fileLabel.textContent = `📎 ${fileInput.files[0].name}`;
          fileLabel.style.color = 'var(--cyan)';
        }
      });
    }

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

    // Crypto Hash TXID Submit
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

  function openWalletConfirmSheet(orderId) {
    const modalContainer = $('modal-container');
    if (!modalContainer) return;

    api('my_orders').then(res => {
      const orders = (res && res.ok) ? (res.orders || []) : [];
      const o = orders.find(x => Number(x.id) === Number(orderId));
      if (!o) return;
      const bal = Number(state.user?.balance || 0);

      modalContainer.innerHTML = `
        <div class="modal-card" style="max-width:480px; text-align:center;">
          <div style="font-size:42px; margin-bottom:8px;">💰</div>
          <h3 style="font-size:18px; font-weight:900; margin-bottom:8px;">پرداخت از موجودی کیف پول</h3>
          <p style="color:var(--text-muted); font-size:13px; margin-bottom:16px;">
            آیا از کسر مبلغ <b>${priceLabel(o.final_amount || o.price)}</b> بابت سفارش <b>#${nf(o.id)}</b> اطمینان دارید؟<br>
            موجودی کیف پول شما: <b style="color:#4ade80;">${priceLabel(bal)}</b>
          </p>

          <div style="background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.3); border-radius:14px; padding:12px; font-size:12px; color:#fde68a; margin-bottom:20px; text-align:right;">
            ⚠️ <b>توجه:</b> موجودی کسرشده تنها در صورت لغو سفارش به کیف پول شما بازگردانده می‌شود.
          </div>

          <div style="display:flex; gap:10px;">
            <button class="user-account-btn" id="btn-confirm-wallet-pay" style="flex:1; justify-content:center; background:#22c55e; color:#000;">تایید و کسر از کیف پول</button>
            <button class="nav-link" id="close-modal-btn" style="flex:1; justify-content:center;">انصراف</button>
          </div>
        </div>
      `;

      modalContainer.classList.remove('hidden');
      $('close-modal-btn')?.addEventListener('click', closeModal);

      $('btn-confirm-wallet-pay')?.addEventListener('click', async () => {
        const res = await api('apply_wallet', {}, 'POST', { order_id: o.id });
        if (res && res.ok) {
          showToast('پرداخت با موفقیت انجام شد! 🎉', 'success');
          closeModal();
          openOrderDetailModal(o.id);
        } else {
          showToast(res.message || 'خطا در پرداخت با کیف پول.', 'error');
        }
      });
    });
  }

  /* ── Wallet View Renderer ── */
  async function renderWalletView(container) {
    const user = state.user || {};
    const isGuest = !user || user.is_guest;
    const refLink = user.referral_link || `${window.location.origin}/?ref=${user.ref_code || ''}`;
    const walletSubTab = state.walletSubTab || 'overview';

    const guestBanner = isGuest ? `
      <div style="background:linear-gradient(135deg, rgba(245,158,11,0.15), rgba(29,155,240,0.15)); border:1px solid rgba(245,158,11,0.4); border-radius:20px; padding:18px 24px; margin-bottom:24px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="font-size:28px;">👋</span>
          <div>
            <strong style="display:block; font-size:15px; color:#fde68a;">حالت میهمان (حساب باز نشده)</strong>
            <span style="font-size:13px; color:var(--text-muted);">برای مشاهده شانس گردونه، پاداش‌های دعوت، ثبت سفارشات و موجودی خود وارد شوید.</span>
          </div>
        </div>
        <button class="user-account-btn" id="btn-guest-login" style="background:#f59e0b; color:#000; font-weight:800; font-size:13px; padding:10px 20px;">🔑 ورود / ثبت‌نام سریع</button>
      </div>
    ` : '';

    container.innerHTML = `
      ${guestBanner}
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <h2 style="font-size:24px; font-weight:900;">💰 کیف پول &amp; شبکه همکاری</h2>
        <div style="font-size:13px; color:var(--text-muted);">
          موجودی: <b style="color:var(--cyan); font-size:16px;">${priceLabel(user.balance || 0)}</b>
        </div>
      </div>

      <!-- Wallet Sub Navigation Tabs -->
      <div style="display:flex; gap:8px; margin-bottom:24px; background:rgba(255,255,255,0.04); padding:4px; border-radius:16px; max-width:550px;">
        <button id="wtab-overview" class="nav-link ${walletSubTab === 'overview' ? 'active' : ''}" style="flex:1; justify-content:center;">📊 خلاصه &amp; همکاری</button>
        <button id="wtab-missions" class="nav-link ${walletSubTab === 'missions' ? 'active' : ''}" style="flex:1; justify-content:center;">🎯 گردونه &amp; ماموریت</button>
        <button id="wtab-history" class="nav-link ${walletSubTab === 'history' ? 'active' : ''}" style="flex:1; justify-content:center;">📋 تراکنش‌ها</button>
      </div>

      <!-- Subtab Container -->
      <div id="wallet-subtab-container"></div>
    `;

    const subContainer = $('wallet-subtab-container');
    if (!subContainer) return;

    $('btn-guest-login')?.addEventListener('click', openAuthModal);

    $('wtab-overview')?.addEventListener('click', () => {
      state.walletSubTab = 'overview';
      renderWalletView(container);
    });

    $('wtab-missions')?.addEventListener('click', () => {
      state.walletSubTab = 'missions';
      renderWalletView(container);
    });

    $('wtab-history')?.addEventListener('click', () => {
      state.walletSubTab = 'history';
      renderWalletView(container);
    });

    // Render active subtab content
    if (walletSubTab === 'overview') {
      subContainer.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:20px; margin-bottom:24px;">
          <div style="background:linear-gradient(135deg, rgba(0,242,254,0.15), rgba(29,155,240,0.25)); border:1px solid var(--border-cyan); border-radius:24px; padding:28px;">
            <small style="color:var(--text-muted); font-size:13px;">موجودی قابل خرج در سفارش‌ها</small>
            <h1 style="font-size:36px; font-weight:900; color:#fff; margin:8px 0 16px;">${priceLabel(user.balance || 0)}</h1>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button class="user-account-btn" id="btn-withdraw-req" style="background:#22c55e; color:#000;">🏧 درخواست برداشت نقد</button>
            </div>
          </div>

          <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:24px; padding:24px;">
            <small style="color:var(--text-muted); font-size:12px; display:block; margin-bottom:6px;">آمار درآمد &amp; دعوتی‌ها</small>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:12px;">
              <div style="background:rgba(255,255,255,0.03); padding:12px; border-radius:14px;">
                <small style="color:var(--text-muted); font-size:11px;">مجموع درآمد</small>
                <b style="display:block; font-size:15px; color:var(--cyan); margin-top:2px;">${priceLabel(user.total_earned || 0)}</b>
              </div>
              <div style="background:rgba(255,255,255,0.03); padding:12px; border-radius:14px;">
                <small style="color:var(--text-muted); font-size:11px;">تعداد زیرمجموعه‌ها</small>
                <b style="display:block; font-size:15px; color:#fff; margin-top:2px;">${nf(user.referrals_count || 0)} کاربر</b>
              </div>
            </div>
          </div>
        </div>

        <!-- Referral Link & Network Tools Section -->
        <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:24px; padding:24px; margin-bottom:24px;">
          <h3 style="font-size:18px; font-weight:800; margin-bottom:8px;">🔗 لینک دعوت اختصاصی شما</h3>
          <p style="color:var(--text-muted); font-size:13px; margin-bottom:16px;">با ارسال این لینک به دوستانتان، با هر خرید آنها پورسانت آنی دریافت می‌کنید.</p>
          
          <div style="display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap;">
            <input type="text" readonly value="${esc(refLink)}" style="flex:1; min-width:240px; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:var(--cyan); padding:12px; border-radius:12px; font-family:monospace; direction:ltr; text-align:center;">
            <button class="user-account-btn" data-copy="${esc(refLink)}">📋 کپی لینک</button>
            <button class="nav-link" id="btn-qr-modal" style="background:rgba(255,255,255,0.06);">📱 کد QR</button>
            <button class="nav-link" id="btn-promo-modal" style="background:rgba(255,255,255,0.06);">📝 متن تبلیغ آماده</button>
          </div>

          <div id="referrals-tree-container">⏳ در حال بارگذاری لیست زیرمجموعه‌ها...</div>
        </div>

        ${vipProgressHtml()}
        ${achievementsHtml()}
      `;

      $('btn-qr-modal')?.addEventListener('click', openQrSheetModal);
      $('btn-promo-modal')?.addEventListener('click', openPromoSheetModal);

      // Withdrawal Request Dialog
      $('btn-withdraw-req')?.addEventListener('click', () => {
        const modalContainer = $('modal-container');
        if (!modalContainer) return;
        modalContainer.innerHTML = `
          <div class="modal-card" style="max-width:480px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
              <h3 style="font-size:18px; font-weight:900;">🏧 درخواست برداشت موجودی</h3>
              <button class="close-drawer-btn" id="close-modal-btn">✕</button>
            </div>
            <p style="color:var(--text-muted); font-size:13px; margin-bottom:16px;">
              موجودی قابل برداشت: <b style="color:var(--cyan);">${priceLabel(user.balance || 0)}</b>
            </p>
            <form id="withdraw-form">
              <div style="margin-bottom:16px;">
                <label style="display:block; font-size:13px; color:var(--text-muted); margin-bottom:6px;">شماره کارت یا شبا جهت واریز</label>
                <input type="text" id="withdraw-card" required placeholder="IR000000000000000000000000 یا ۶۰۳۷..." style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:12px; border-radius:12px; font-family:inherit; outline:none;">
              </div>
              <button type="submit" class="user-account-btn" style="width:100%; justify-content:center;">ثبت درخواست برداشت</button>
            </form>
          </div>
        `;
        modalContainer.classList.remove('hidden');
        $('close-modal-btn')?.addEventListener('click', closeModal);

        $('withdraw-form')?.addEventListener('submit', async (e) => {
          e.preventDefault();
          const card_info = $('withdraw-card').value.trim();
          const res = await api('withdraw', {}, 'POST', { card_info });
          if (res && res.ok) {
            showToast('درخواست برداشت با موفقیت ثبت شد و در صف تایید قرار گرفت. 🏦', 'success');
            closeModal();
            initApp();
          } else {
            showToast(res.message || 'خطا در ثبت درخواست برداشت.', 'error');
          }
        });
      });

      // Fetch Referrals Tree
      const refRes = await api('my_referrals');
      const refs = (refRes && refRes.ok) ? (refRes.referrals || []) : [];
      const treeBox = $('referrals-tree-container');

      if (treeBox) {
        treeBox.innerHTML = referralTreeHtml(refs);
      }
    } else if (walletSubTab === 'missions') {
      subContainer.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:20px; margin-bottom:24px;">
          <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:24px; padding:28px; text-align:center;">
            <div style="font-size:48px; margin-bottom:10px;">🎡</div>
            <h3 style="font-size:18px; font-weight:900; margin-bottom:6px;">گردونه شانس روزانه</h3>
            <p style="color:var(--text-muted); font-size:13px; margin-bottom:16px;">
              برای هر ${nf(state.spin_every || 5)} زیرمجموعه جدید، یک شانس چرخاندن می‌گیرید.
              <br>شانس باقی‌مانده شما: <b style="color:var(--cyan); font-size:16px;">${nf(user.spin_balance || 0)}</b>
            </p>
            <button class="user-account-btn" style="margin:0 auto;" id="btn-spin-wheel">🎰 چرخاندن گردونه شانس</button>
          </div>

          <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:24px; padding:24px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
              <h3 style="font-size:16px; font-weight:800;">🎯 ماموریت‌های امروز</h3>
              <button class="user-account-btn" id="btn-claim-missions" style="font-size:11px; padding:6px 12px; background:#22c55e; color:#000;">🎁 دریافت پاداش‌ها</button>
            </div>
            <div style="display:flex; flex-direction:column; gap:12px;">
              ${(state.missions || []).map(missionCard).join('') || '<p style="color:var(--text-muted); font-size:13px; text-align:center;">ماموریتی یافت نشد.</p>'}
            </div>
          </div>
        </div>
      `;

      $('btn-spin-wheel')?.addEventListener('click', openSpinWheelModal);

      $('btn-claim-missions')?.addEventListener('click', async () => {
        const res = await api('claim_missions');
        if (res && res.ok) {
          showToast(`🎁 پاداش ماموریت‌ها دریافت شد!`, 'success');
          initApp();
        } else {
          showToast(res ? res.message : 'هیچ پاداش جدیدی آماده دریافت نیست.', 'info');
        }
      });
    } else if (walletSubTab === 'history') {
      const txs = state.transactions || [];
      subContainer.innerHTML = `
        <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:24px; padding:24px;">
          <h3 style="font-size:18px; font-weight:800; margin-bottom:16px;">📋 تاریخچه تراکنش‌های کیف پول (${txs.length})</h3>
          ${!txs.length ? `
            <p style="color:var(--text-muted); font-size:13px; text-align:center; padding:30px 0;">تراکنشی یافت نشد.</p>
          ` : `
            <div style="display:flex; flex-direction:column; gap:10px;">
              ${txs.map(t => `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); border:1px solid var(--border-color); padding:14px; border-radius:14px;">
                  <div>
                    <b style="font-size:14px;">${esc(t.description || t.type || 'تراکنش')}</b>
                    <div style="color:var(--text-muted); font-size:11px; margin-top:2px;">${esc(t.created_at || '')}</div>
                  </div>
                  <b style="font-size:15px; color:${Number(t.amount || 0) >= 0 ? '#22c55e' : '#ef4444'};">
                    ${Number(t.amount || 0) >= 0 ? '+' : ''}${priceLabel(t.amount || 0)}
                  </b>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      `;
    }
  }

  /* ── Phase 2 Helper Functions ── */
  function wheelGradient(rewards = []) {
    const colors = ['#1d9bf0', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#ef4444', '#84cc16'];
    const list = rewards.length ? rewards : [{ title: 'جایزه' }];
    const step = 100 / list.length;
    return `conic-gradient(${list.map((_, i) => `${colors[i % colors.length]} ${i * step}% ${(i + 1) * step}%`).join(',')})`;
  }

  function wheelPrizeList(rewards = []) {
    return (rewards || []).slice(0, 8).map(r => `
      <div class="wheel-prize-chip">
        <b>${esc(r.title || 'جایزه')}</b>
        <span>${Number(r.amount || 0) > 0 ? priceLabel(r.amount) : 'جایزه ویژه'}</span>
      </div>
    `).join('') || '<p style="color:var(--text-muted); font-size:12px;">جایزه‌ای تعریف نشده.</p>';
  }

  function referralTreeHtml(refs = []) {
    if (!refs || !refs.length) {
      return `
        <div style="text-align:center; padding:24px 0; color:var(--text-muted);">
          <div style="font-size:36px; margin-bottom:8px;">🌳</div>
          <p style="font-size:13px;">هنوز هیچ زیرمجموعه‌ای ثبت نشده است. لینک فوق را برای دوستانتان ارسال کنید!</p>
        </div>
      `;
    }
    const totalEarned = refs.reduce((s, r) => s + Number(r.reward_amount || r.total_earned || 0), 0);
    return `
      <div style="margin-top:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <h4 style="font-size:15px; font-weight:800;">🌳 درخت زیرمجموعه‌ها (${nf(refs.length)})</h4>
          <span style="color:var(--cyan); font-size:13px; font-weight:800;">کل پاداش: ${priceLabel(totalEarned)}</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:10px;">
          ${refs.map(r => {
            const initial = esc(String(r.first_name || r.username || '?').slice(0, 1).toUpperCase());
            const spent = Number(r.total_spent || 0);
            const orders = Number(r.orders_count || 0);
            const reward = Number(r.reward_amount || r.total_earned || 0);
            return `
              <div class="referral-node-v2">
                <div style="display:flex; align-items:center; gap:12px;">
                  <div class="referral-avatar-circle">${initial}</div>
                  <div>
                    <b style="font-size:14px;">${esc(r.first_name || r.username || 'کاربر')}${r.username ? ' (@' + esc(r.username) + ')' : ''}</b>
                    <div style="color:var(--text-muted); font-size:11px; margin-top:2px;">
                      عضویت: ${esc(String(r.created_at || r.joined_at || '').slice(0, 10))} ${orders > 0 ? `· ${nf(orders)} سفارش (${priceLabel(spent)})` : '· بدون سفارش'}
                    </div>
                  </div>
                </div>
                <div class="referral-reward-badge">+${priceLabel(reward)}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  function missionCard(m) {
    const today = Number(state.user?.today_referrals || 0);
    const target = Math.max(1, Number(m.target || 1));
    const current = Math.min(today, target);
    const pct = Math.max(0, Math.min(100, Math.round(current / target * 100)));
    const doneClass = m.claimed ? 'claimed' : (m.done ? 'done' : 'todo');
    const badgeText = m.claimed ? 'دریافت شد ✅' : (m.done ? 'آماده دریافت 🎁' : 'در حال انجام ⏳');

    return `
      <div class="mission-card-v2 ${doneClass}">
        <div class="mission-top-v2">
          <div>
            <span style="font-size:11px; color:var(--cyan); font-weight:700;">${nf(current)} از ${nf(target)} دعوت</span>
            <h4 style="font-size:15px; font-weight:800; margin-top:2px;">${esc(m.title || `${nf(target)} دعوت امروز`)}</h4>
          </div>
          <b style="color:#22c55e; font-size:14px;">${priceLabel(m.reward || 0)}</b>
        </div>
        <div class="progress-track-v2">
          <div class="progress-fill-v2" style="width:${pct}%;"></div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:var(--text-muted);">
          <span>${pct}% تکمیل شده</span>
          <b>${badgeText}</b>
        </div>
      </div>
    `;
  }

  /* ── QR Code Generator Modal ── */
  function openQrSheetModal() {
    const user = state.user || {};
    const refLink = user.referral_link || `${window.location.origin}/web?ref=${user.ref_code || ''}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(refLink)}&margin=8`;

    const modalContainer = $('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-card" style="max-width:440px; text-align:center;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h3 style="font-size:18px; font-weight:900;">📱 کد QR اختصاصی دعوت شما</h3>
          <button class="close-drawer-btn" id="close-modal-btn">✕</button>
        </div>
        <p style="color:var(--text-muted); font-size:13px; margin-bottom:16px;">
          این کد QR را اسکن کنید تا مستقیماً به لینک دعوت شما منتقل شوید:
        </p>
        <div style="background:#fff; padding:16px; border-radius:16px; display:inline-block; margin-bottom:16px;">
          <img src="${esc(qrUrl)}" alt="QR Code" style="width:200px; height:200px; display:block;">
        </div>
        <button class="user-account-btn" data-copy="${esc(refLink)}" style="width:100%; justify-content:center;">📋 کپی لینک دعوت</button>
      </div>
    `;

    modalContainer.classList.remove('hidden');
    $('close-modal-btn')?.addEventListener('click', closeModal);
  }

  /* ── Promotional Text Modal ── */
  function openPromoSheetModal() {
    const user = state.user || {};
    const refLink = user.referral_link || `${window.location.origin}/web?ref=${user.ref_code || ''}`;
    const brand = state.brand || 'BlueGate';

    const promoText = `💙 با ${brand} جدیدترین اشتراک‌های پرمیوم، اکانت‌های هوش مصنوعی و خدمات دیجیتال را با تحویل فوری دریافت کنید!\n\n👥 با عضویت از طریق لینک زیر، هدیه ورودی دریافت کنید:\n🔗 ${refLink}`;

    const modalContainer = $('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-card" style="max-width:500px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h3 style="font-size:18px; font-weight:900;">📝 متن تبلیغاتی آماده جهت ارسال</h3>
          <button class="close-drawer-btn" id="close-modal-btn">✕</button>
        </div>
        <p style="color:var(--text-muted); font-size:13px; margin-bottom:12px;">
          این متن را کپی کنید و در کانال‌ها، گروه‌ها یا برای دوستانتان بفرستید:
        </p>
        <div style="background:rgba(255,255,255,0.04); border:1px solid var(--border-color); padding:14px; border-radius:14px; font-size:13px; line-height:1.6; white-space:pre-wrap; margin-bottom:16px; direction:rtl; text-align:right;">${esc(promoText)}</div>
        <button class="user-account-btn" data-copy="${esc(promoText)}" style="width:100%; justify-content:center;">📋 کپی متن تبلیغاتی</button>
      </div>
    `;

    modalContainer.classList.remove('hidden');
    $('close-modal-btn')?.addEventListener('click', closeModal);
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
    const rewards = state.spin_rewards || [];

    const modalContainer = $('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-card" style="max-width:500px; text-align:center;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h3 style="font-size:18px; font-weight:900;">🎡 گردونه شانس روزانه</h3>
          <button class="close-drawer-btn" id="close-modal-btn">✕</button>
        </div>
        <p style="color:var(--text-muted); font-size:13px; margin-bottom:14px;">
          برای هر ${nf(state.spin_every || 5)} زیرمجموعه جدید، یک شانس چرخاندن می‌گیرید. جایزه‌ها خودکار به کیف پول اضافه می‌شوند.
        </p>

        <div class="spin-stage-wrap">
          <div class="wheel-pointer-v2">▼</div>
          <div id="spinWheelVisual" class="spin-wheel-v2" style="background:${wheelGradient(rewards)}">
            <div class="wheel-center-v2"><span>SPIN</span></div>
          </div>
        </div>

        <p style="color:var(--text-muted); font-size:14px; margin-bottom:16px;">
          شانس باقی‌مانده شما: <b style="color:var(--cyan); font-size:16px;">${nf(spins)}</b>
        </p>
        <button id="btn-spin-now" class="user-account-btn" style="width:100%; justify-content:center;" ${spins <= 0 ? 'disabled' : ''}>
          ${spins > 0 ? '🎡 چرخاندن گردونه' : 'فعلاً شانسی نداری'}
        </button>

        <div class="spin-prizes-list">
          ${wheelPrizeList(rewards)}
        </div>
      </div>
    `;

    modalContainer.classList.remove('hidden');
    $('close-modal-btn')?.addEventListener('click', closeModal);

    $('btn-spin-now')?.addEventListener('click', async () => {
      const btn = $('btn-spin-now');
      const wheel = $('spinWheelVisual');
      if (!btn || btn.disabled) return;
      btn.disabled = true;
      btn.textContent = 'در حال چرخش...';

      const count = Math.max(1, rewards.length);
      const start = Number(wheel?.dataset.rot || 0);
      const fakeIndex = Math.floor(Math.random() * count);
      const degPer = 360 / count;
      const target = start + 1440 + (360 - (fakeIndex * degPer + degPer / 2));

      if (wheel) {
        wheel.dataset.rot = String(target);
        wheel.style.transform = `rotate(${target}deg)`;
      }

      try {
        const res = await api('spin');
        const prize = res.prize || {};
        const idx = Number(prize.index ?? fakeIndex);
        const finalRot = start + 2160 + (360 - (idx * degPer + degPer / 2));

        if (wheel) {
          wheel.dataset.rot = String(finalRot);
          wheel.style.transform = `rotate(${finalRot}deg)`;
        }

        setTimeout(() => {
          showToast(`🎉 مبارک! جایزه شما: "${prize.title || 'جایزه گردونه'}"`, 'success');
          initApp();
          closeModal();
        }, 2600);
      } catch (e) {
        showToast(e.message || 'خطا در گردونه', 'error');
        btn.disabled = false;
        btn.textContent = 'چرخاندن گردونه';
      }
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
    if (document.body) document.body.style.overflow = 'hidden';
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
    if (document.body) document.body.style.overflow = '';
  }

  /* ── Product Detail Preview Modal ── */
  function openProductModal(pid) {
    const p = state.products.find(item => Number(item.id) === Number(pid));
    if (!p) return;
    pushRecent(pid);

    const modalContainer = $('modal-container');
    if (!modalContainer) return;
    if (document.body) document.body.style.overflow = 'hidden';

    const title = p.title || p.name || 'جزئیات محصول';
    const variants = p.variants || [];
    const isWished = state.wishlist.includes(Number(p.id));

    // Description text handling
    const rawDesc = (p.full_description || p.short_description || '').trim();
    const hasDesc = rawDesc && rawDesc !== '-' && rawDesc !== '.';

    let selectedVariant = variants.length > 0 ? variants[0] : null;
    let selectedQty = 1;

    modalContainer.innerHTML = `
      <div class="modal-card" style="max-width:620px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <h3 style="font-size:18px; font-weight:900;">${esc(title)}</h3>
          <div style="display:flex; align-items:center; gap:8px;">
            <button class="card-wishlist-btn" id="modal-wish-btn" style="position:static;" title="علاقه‌مندی">${isWished ? '❤️' : '🤍'}</button>
            <button class="user-account-btn" id="modal-share-btn" style="padding:6px 10px; font-size:12px;" title="اشتراک‌گذاری">🔗</button>
            <button class="close-drawer-btn" id="close-modal-btn">✕</button>
          </div>
        </div>

        ${p.image_url ? `
          <div class="product-modal-hero">
            <img src="${esc(p.image_url)}" alt="${esc(title)}">
          </div>
        ` : ''}

        ${hasDesc ? `
          <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:14px; padding:14px; margin-bottom:16px; font-size:13.5px; line-height:1.6; color:var(--text-muted);">
            ${esc(rawDesc)}
          </div>
        ` : `
          <div style="display:flex; justify-content:space-around; background:rgba(0,242,254,0.04); border:1px solid rgba(0,242,254,0.2); border-radius:14px; padding:12px; margin-bottom:16px; font-size:12px; color:var(--cyan);">
            <span>⚡ <b>تحویل آنی ۲۴ ساعته</b></span>
            <span>🛡️ <b>ضمانت سلامت اکانت</b></span>
            <span>🎧 <b>پشتیبانی اختصاصی</b></span>
          </div>
        `}

        ${variants.length > 0 ? `
          <div style="margin-bottom:18px;">
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:8px;">انتخاب پلن / مدت زمان اشتراک:</label>
            <div class="variant-cards-grid">
              ${variants.map((v, idx) => {
                // v.price is already the discounted price (price_runtime_meta applies discount_percent)
                // v.old_price is the original price before discount (computed in API)
                const vDisc = Number(v.discount_percent || 0);
                const vOrig = Number(v.old_price || 0);  // already pre-computed by API
                return `
                  <button class="variant-option-card ${idx === 0 ? 'selected' : ''}" data-v-id="${v.id}" data-v-price="${v.price}" data-v-orig="${vOrig || ''}" data-v-title="${esc(v.title)}">
                    <div class="variant-card-header">
                      <span class="variant-title">${esc(v.title)}</span>
                      <span class="variant-badge">${v.duration_days ? `${v.duration_days} روز` : 'پلن ویژه'}</span>
                    </div>
                    <div class="variant-price">
                      ${vOrig > 0 && vOrig > Number(v.price) ? `<s style="color:var(--text-muted); font-size:11px; margin-left:4px; text-decoration:line-through;">${priceLabel(vOrig)}</s>` : ''}
                      <span>${priceLabel(v.price)}</span>
                      ${vDisc > 0 ? `<span class="flash-pill" style="font-size:10px; background:rgba(239, 68, 68, 0.2); color:#fca5a5; padding:2px 6px; border-radius:6px; margin-right:4px;">−${nf(vDisc)}٪</span>` : ''}
                    </div>
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-color); padding-top:16px; margin-top:10px;">
          <div>
            <small style="color:var(--text-muted); font-size:11px; display:block;">مبلغ کل:</small>
            <b id="modal-price-label" style="font-size:22px; color:var(--cyan); font-weight:900;">
              ${priceLabel((selectedVariant ? selectedVariant.price : p.price) * selectedQty)}
            </b>
          </div>
          <div style="display:flex; align-items:center; gap:12px;">
            <div class="modal-qty-control">
              <button class="qty-btn" id="modal-qty-minus">-</button>
              <span class="qty-val" id="modal-qty-val">1</span>
              <button class="qty-btn" id="modal-qty-plus">+</button>
            </div>
            <button class="user-account-btn" id="btn-buy-modal" style="background:linear-gradient(135deg, var(--cyan), #1d9bf0); color:#000; font-weight:900; padding:12px 20px; font-size:14px;">⚡ افزودن به سبد خرید</button>
          </div>
        </div>
      </div>
    `;

    modalContainer.classList.remove('hidden');
    $('close-modal-btn')?.addEventListener('click', closeModal);
    $('modal-wish-btn')?.addEventListener('click', () => toggleWishlist(p.id));
    $('modal-share-btn')?.addEventListener('click', () => openShareSheet(p.id));

    // Variant Card Selection Handler
    document.querySelectorAll('.variant-option-card').forEach(card => {
      card.addEventListener('click', (e) => {
        document.querySelectorAll('.variant-option-card').forEach(c => c.classList.remove('selected'));
        const btn = e.currentTarget;
        btn.classList.add('selected');
        selectedVariant = {
          id: btn.dataset.vId,
          title: btn.dataset.vTitle,
          price: Number(btn.dataset.vPrice),
          origPrice: btn.dataset.vOrig ? Number(btn.dataset.vOrig) : null
        };
        updateModalPrice();
      });
    });

    // Quantity Buttons
    $('modal-qty-plus')?.addEventListener('click', () => {
      selectedQty++;
      $('modal-qty-val').textContent = selectedQty;
      updateModalPrice();
    });

    $('modal-qty-minus')?.addEventListener('click', () => {
      if (selectedQty > 1) {
        selectedQty--;
        $('modal-qty-val').textContent = selectedQty;
        updateModalPrice();
      }
    });

    function updateModalPrice() {
      const basePrice = selectedVariant ? selectedVariant.price : p.price;
      const baseOrig = selectedVariant ? selectedVariant.origPrice : null;

      const totalPrice = basePrice * selectedQty;
      const totalOrig = baseOrig ? baseOrig * selectedQty : null;

      const priceLbl = $('modal-price-label');
      if (priceLbl) {
        priceLbl.innerHTML = `
          ${totalOrig ? `<s style="color:var(--text-muted); font-size:13px; margin-left:6px; text-decoration:line-through; font-weight:normal;">${priceLabel(totalOrig)}</s>` : ''}
          ${priceLabel(totalPrice)}
        `;
      }
    }

    $('btn-buy-modal')?.addEventListener('click', () => {
      for (let i = 0; i < selectedQty; i++) {
        addToCart(
          p.id,
          selectedVariant ? selectedVariant.id : null,
          selectedVariant ? selectedVariant.title : '',
          selectedVariant ? selectedVariant.price : p.price
        );
      }
      closeModal();
    });
  }

  /* ── Global Event Delegation ── */
  function bindGlobalEvents() {
    // Wheel listener for horizontal category carousel & pills
    document.addEventListener('wheel', (e) => {
      const scrollEl = e.target.closest('.sidebar-cat-list, .hero-trust-row, .order-action-pills-bar, .stepper-nodes-row');
      if (scrollEl && e.deltaY !== 0) {
        scrollEl.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    }, { passive: false });

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

      if (e.target.closest('#mobile-cart-trigger')) {
        openCartDrawer(true);
        return;
      }

      if (e.target.closest('#mobile-user-trigger')) {
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

      // Share sheet
      const shareBtn = e.target.closest('[data-share]');
      if (shareBtn && shareBtn.dataset.share) {
        e.stopPropagation();
        openShareSheet(shareBtn.dataset.share);
      }

      // Recently viewed item click
      const recentCard = e.target.closest('.recent-product-card');
      if (recentCard && recentCard.dataset.pid) {
        openProductModal(recentCard.dataset.pid);
      }

      // Glowing flash card click
      const flashCard = e.target.closest('.glowing-flash-card');
      if (flashCard && flashCard.dataset.pid && !e.target.closest('[data-buy]')) {
        openProductModal(flashCard.dataset.pid);
      }

      // Order Detail
      const orderCard = e.target.closest('[data-order-open]');
      if (orderCard && orderCard.dataset.orderOpen) {
        openOrderDetailModal(orderCard.dataset.orderOpen);
      }
      const card = e.target.closest('.product-card');
      if (card && card.dataset.pid && !e.target.closest('[data-buy]') && !e.target.closest('[data-wishlist]') && !e.target.closest('[data-share]')) {
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
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

  /* ── Live Flash Sale Countdown Ticker (updates DOM in-place every second) ── */
  setInterval(() => {
    // Update .flash-sale-timer elements that have data-pid directly
    document.querySelectorAll('.flash-sale-timer[data-pid]').forEach(el => {
      const pid = el.dataset.pid;
      const p = state.products.find(x => Number(x.id) === Number(pid));
      if (!p || !flashSaleActive(p)) return;
      const text = flashSaleCountdown(p);
      if (text) el.textContent = text;
    });
    // Update banner timer (no data-pid, inside flash-sale-timer-pill)
    document.querySelectorAll('.flash-sale-timer-pill .flash-sale-timer').forEach(el => {
      const flashP = state.products.find(p => flashSaleActive(p));
      if (!flashP) return;
      const t = getFlashTimeRemaining(flashP);
      if (t) el.textContent = t;
    });
  }, 1000);

})();
