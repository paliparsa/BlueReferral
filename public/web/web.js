/* ===== BlueGate Dedicated Minimal Web Application ===== */
(function() {
  'use strict';

  const $ = (id) => document.getElementById(id);
  let state = null;
  let activeCategory = 'all';
  let searchTerm = '';
  let selectedProduct = null;
  let pendingVerifUserId = null;

  // Toast status notification
  function showToast(msg, type = 'success') {
    const el = $('toast');
    if (!el) return;
    el.textContent = (type === 'error' ? '❌ ' : '✅ ') + msg;
    el.className = `toast ${type}`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 3500);
  }

  // API Call helper
  async function api(action, payload = {}) {
    const authToken = localStorage.getItem('web_token') || '';
    const res = await fetch('/api.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, authToken, ...payload })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      const err = new Error(data.message || data.error || 'خطایی رخ داد');
      Object.assign(err, data);
      throw err;
    }
    return data;
  }

  // Number Formatter
  function nf(n) {
    return Number(n || 0).toLocaleString('fa-IR');
  }

  // Load Dashboard Data
  async function loadData() {
    try {
      state = await api('me');
    } catch (e) {
      state = await api('guest_dashboard_payload').catch(() => null);
    }
    if (!state) {
      showToast('خطا در دریافت اطلاعات محصولات', 'error');
      return;
    }
    renderUI();
  }

  // Render UI
  function renderUI() {
    if (state.brand) $('brandTitle').textContent = state.brand;

    // Update Auth Button
    const u = state.user;
    if (u && !u.is_guest) {
      $('authBtnText').textContent = `${u.first_name || u.username} (${nf(u.balance)} تومان)`;
      $('payWalletOption').classList.remove('hidden');
    } else {
      $('authBtnText').textContent = 'ورود / ثبت‌نام';
      $('payWalletOption').classList.add('hidden');
    }

    renderCategoryPills();
    renderProducts();
  }

  // Category Pills
  function renderCategoryPills() {
    const container = $('categoryPills');
    if (!container) return;
    const categories = state.shop_categories || [];

    let html = `<button class="cat-pill ${activeCategory === 'all' ? 'active' : ''}" data-cat="all">⚡ همه خدمات</button>`;
    categories.forEach(c => {
      html += `<button class="cat-pill ${activeCategory == c.id ? 'active' : ''}" data-cat="${c.id}">${c.emoji || '📦'} ${c.title}</button>`;
    });
    container.innerHTML = html;
  }

  // Product Catalog Grid
  function renderProducts() {
    const container = $('productGrid');
    if (!container) return;
    let products = state.shop_products || [];

    // Filter by Category
    if (activeCategory !== 'all') {
      products = products.filter(p => Number(p.category_id) === Number(activeCategory));
    }

    // Filter by Search Term
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase().trim();
      products = products.filter(p => (p.name || '').toLowerCase().includes(q) || (p.short_description || '').toLowerCase().includes(q));
    }

    if (products.length === 0) {
      container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">هیچ محصولی با این مشخصات یافت نشد.</div>`;
      return;
    }

    let html = '';
    products.forEach(p => {
      const img = p.image_url || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23182338"/><text x="50%" y="55%" font-size="36" text-anchor="middle" fill="%231d9bf0">⚡</text></svg>';
      const priceText = p.price > 0 ? `${nf(p.price)} تومان` : 'مشاهده قیمت‌ها';
      
      html += `
        <div class="web-product-card">
          <div class="card-top">
            <img src="${img}" alt="${p.name}" class="card-img" />
            <div class="card-info">
              <h3 class="card-title">${p.name}</h3>
              <p class="card-desc">${p.short_description || 'تحویل خودکار و فوری'}</p>
            </div>
          </div>
          <div class="card-bottom">
            <div class="card-price">
              <small>شروع از</small>
              <strong>${priceText}</strong>
            </div>
            <button type="button" class="buy-btn" data-buy-id="${p.id}">ثبت سفارش 🚀</button>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  }

  // Open Checkout Modal
  function openCheckout(productId) {
    const products = state.shop_products || [];
    selectedProduct = products.find(p => Number(p.id) === Number(productId));
    if (!selectedProduct) return;

    $('checkoutName').textContent = selectedProduct.name;
    $('checkoutImg').src = selectedProduct.image_url || '';
    $('checkoutPrice').textContent = selectedProduct.price > 0 ? `${nf(selectedProduct.price)} تومان` : '';

    // Populate Variants
    const variants = selectedProduct.variants || [];
    const select = $('variantSelect');
    if (variants.length > 0) {
      $('variantSelectorWrap').classList.remove('hidden');
      select.innerHTML = variants.map(v => `<option value="${v.id}">${v.title} - ${nf(v.price)} تومان</option>`).join('');
    } else {
      $('variantSelectorWrap').classList.add('hidden');
    }

    // Customer Email
    if (state.user && state.user.email) {
      $('customerEmail').value = state.user.email;
    }

    $('checkoutError').classList.add('hidden');
    const modal = $('checkoutModal');
    if (typeof modal.showModal === 'function') modal.showModal();
    else modal.classList.add('open');
  }

  let activePayOrder = null;

  function openPaymentModal(order) {
    if (!order) return;
    activePayOrder = order;

    $('payOrderId').textContent = order.id;
    $('payItemName').textContent = order.product_name || selectedProduct?.name || 'سفارش سرویس';
    $('payAmountText').textContent = `${nf(order.final_amount || order.total_amount)} تومان`;

    const pm = state?.payment_methods || {};
    let cards = pm.card_accounts || pm.card?.accounts || [];
    const cardContainer = $('cardListDisplay');

    if (!cards || cards.length === 0) {
      const rawText = pm.card_accounts_text || pm.card?.instructions || state?.payment_instructions || state?.settings?.payment_instructions || '';
      const matches = rawText.match(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g) || [];
      if (matches.length > 0) {
        cards = matches.map(num => ({ card: num.replace(/\s+/g, '-'), owner: 'شماره کارت جهت واریز', title: 'کارت بانکی' }));
      }
    }

    if (cards && cards.length > 0) {
      cardContainer.innerHTML = cards.map(c => {
        const rawCard = (c.card || c.card_number || '').replace(/\D+/g, '');
        const formattedCard = rawCard.length === 16 ? rawCard.replace(/(\d{4})/g, '$1 ').trim() : (c.card || c.card_number || '');
        const owner = c.owner || c.holder_name || 'صاحب حساب مشخص نشده';
        const bank = c.title || c.bank_name || 'کارت بانکی';
        return `
          <div class="credit-card-item">
            <div class="card-header-row">
              <span class="card-chip">💳</span>
              <span class="card-bank-title">${bank}</span>
            </div>
            <div class="card-number-display">
              <span>${formattedCard}</span>
              <button type="button" class="copy-btn" data-copy="${rawCard}">کپی 📋</button>
            </div>
            <div class="card-footer-row">
              <span>به نام: <strong class="card-owner-name">${owner}</strong></span>
              ${c.sheba ? `<small>شبا: ${c.sheba}</small>` : ''}
            </div>
          </div>
        `;
      }).join('');
    } else {
      const instructions = state?.payment_instructions || pm.card?.instructions || 'لطفاً مبلغ را به شماره کارت واریز کرده و کد ارجاع را ثبت کنید.';
      cardContainer.innerHTML = `<div style="font-size:13px; color:var(--text); padding:14px; background:rgba(255,255,255,0.05); border-radius:14px; line-height:1.6;">${instructions}</div>`;
    }

    let cryptoWallets = pm.crypto_wallets || pm.crypto?.wallets || [];
    const cryptoContainer = $('cryptoListDisplay');
    if (cryptoWallets && cryptoWallets.length > 0) {
      cryptoContainer.innerHTML = cryptoWallets.map(w => {
        const net = w.network || 'TRC20';
        const addr = w.address || '';
        const symbol = w.asset || w.rate_symbol || 'USDT';
        const estAmount = w.estimated_amount ? `(${w.estimated_amount} ${symbol})` : '';
        return `
          <div class="crypto-card-item">
            <div class="crypto-header-row">
              <span style="font-size:13px; font-weight:800; color:#fff;">🪙 ${symbol} ${estAmount}</span>
              <span class="network-badge">شبکه: ${net}</span>
            </div>
            <div class="crypto-address-display">
              <span>${addr}</span>
              <button type="button" class="copy-btn" data-copy="${addr}">کپی 📋</button>
            </div>
          </div>
        `;
      }).join('');
    } else {
      cryptoContainer.innerHTML = `<div style="font-size:13px; color:var(--text-muted); text-align:center; padding:10px;">کیف پول رمزارز ثبت نشده است.</div>`;
    }

    $('receiptError').classList.add('hidden');
    $('cryptoError').classList.add('hidden');

    const modal = $('paymentModal');
    if (typeof modal.showModal === 'function') modal.showModal();
    else modal.classList.add('open');
  }

  // Confirm Purchase Action
  async function confirmPurchase() {
    if (!selectedProduct) return;
    const variantId = $('variantSelect')?.value || null;
    const email = $('customerEmail')?.value || '';
    const payMethod = document.querySelector('input[name="payMethod"]:checked')?.value || 'card';

    const errEl = $('checkoutError');
    errEl.classList.add('hidden');

    try {
      const useWallet = payMethod === 'wallet' ? 1 : 0;
      const res = await api('create_order', {
        product_id: selectedProduct.id,
        variant_id: variantId,
        use_wallet: useWallet,
        email: email
      });

      if (res.ok) {
        $('checkoutModal').close?.();

        if (useWallet) {
          showToast('سفارش با موفقیت از کیف پول پرداخت شد 🎉');
          openTracker(res.order?.id);
          loadData();
        } else {
          // Select payment method & Open Payment Details Modal
          if (payMethod === 'card' && res.order?.id) {
            await api('select_payment_method', { order_id: res.order.id, method: 'card', details: {} });
          } else if (payMethod === 'crypto' && res.order?.id) {
            await api('select_payment_method', { order_id: res.order.id, method: 'crypto', details: {} });
          }
          openPaymentModal(res.order);
        }
      }
    } catch (err) {
      errEl.textContent = err.message || 'خطا در ثبت سفارش';
      errEl.classList.remove('hidden');
    }
  }

  // Auth Screen Switcher
  function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    $('loginForm').classList.toggle('hidden', tab !== 'login');
    $('registerForm').classList.toggle('hidden', tab !== 'register');
    $('otpForm').classList.add('hidden');
    $('authTabs').classList.remove('hidden');
  }

  function showOtpForm(userId, email, message) {
    pendingVerifUserId = userId;
    $('authTabs').classList.add('hidden');
    $('loginForm').classList.add('hidden');
    $('registerForm').classList.add('hidden');
    $('otpEmailTarget').textContent = email || '';
    $('otpError').classList.add('hidden');
    $('otpForm').classList.remove('hidden');
    showToast(message || 'کد تایید ۶ رقمی به ایمیل شما ارسال شد 📩');
  }

  // Open Tracker
  function openTracker(orderId = '') {
    if (orderId) $('trackOrderId').value = orderId;
    $('trackResult').classList.add('hidden');
    const modal = $('trackerModal');
    if (typeof modal.showModal === 'function') modal.showModal();
  }

  // Global Event Listeners
  document.addEventListener('click', async (e) => {
    const t = e.target.closest('button, .cat-pill, .auth-tab') || e.target;

    // Category click
    if (t.dataset?.cat) {
      activeCategory = t.dataset.cat;
      renderCategoryPills();
      renderProducts();
    }

    // Buy Button click
    if (t.dataset?.buyId) {
      openCheckout(t.dataset.buyId);
    }

    // Auth / User Deposit Modal
    if (t.id === 'openAuthModalBtn' || t.closest('#openAuthModalBtn')) {
      const u = state?.user;
      if (u && !u.is_guest) {
        $('depositModal').showModal?.();
      } else {
        switchAuthTab('login');
        $('authModal').showModal?.();
      }
    }
    if (t.id === 'closeAuthModal') $('authModal').close?.();
    if (t.dataset?.tab && t.classList.contains('auth-tab')) switchAuthTab(t.dataset.tab);

    // Checkout Modal
    if (t.id === 'closeCheckoutModal') $('checkoutModal').close?.();
    if (t.id === 'confirmBuyBtn') confirmPurchase();

    // Payment Modal
    if (t.id === 'closePaymentModal') $('paymentModal').close?.();
    if (t.dataset?.payTab) {
      document.querySelectorAll('.pay-tab').forEach(b => b.classList.toggle('active', b === t));
      $('cardPaySection').classList.toggle('hidden', t.dataset.payTab !== 'card');
      $('cryptoPaySection').classList.toggle('hidden', t.dataset.payTab !== 'crypto');
    }
    if (t.dataset?.copy) {
      navigator.clipboard.writeText(t.dataset.copy);
      showToast('در حافظه کپی شد! 📋');
    }

    // Order Tracking Modal
    if (t.id === 'trackOrderBtn' || t.id === 'footerTrackBtn') openTracker();
    if (t.id === 'closeTrackerModal') $('trackerModal').close?.();
    if (t.id === 'searchOrderBtn') {
      const oid = $('trackOrderId').value;
      if (!oid) return showToast('شناسه سفارش را وارد کنید', 'error');
      const orders = state?.orders || [];
      const match = orders.find(o => Number(o.id) === Number(oid));
      const resEl = $('trackResult');
      resEl.classList.remove('hidden');
      if (match) {
        let credsHtml = '';
        const creds = match.item_details || match.license_code || match.delivery_note || match.delivered_item;
        if (creds) {
          credsHtml = `
            <div style="margin-top:10px; padding:10px; background:rgba(34,197,94,0.15); border:1px solid #22c55e; border-radius:12px;">
              <b style="color:#22c55e; font-size:12px;">🔑 اکانت / کد تحویلی:</b>
              <div class="card-num" style="margin-top:6px;">
                <span style="font-size:13px;">${creds}</span>
                <button type="button" class="copy-btn" data-copy="${creds}">کپی 📋</button>
              </div>
            </div>
          `;
        }
        resEl.innerHTML = `
          <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 12px; margin-top: 10px;">
            <h4>سفارش #${match.id} - ${match.product_name}</h4>
            <p>وضعیت: <strong style="color:var(--accent);">${match.status_fa || match.status}</strong></p>
            <small>مبلغ: ${nf(match.final_amount || match.total_amount)} تومان | تاریخ: ${match.created_at || ''}</small>
            ${credsHtml}
          </div>
        `;
      } else {
        resEl.innerHTML = `<p style="color:#f87171; margin-top:10px;">سفارشی با این شناسه در حساب شما یافت نشد. لطفاً وارد حساب خود شوید.</p>`;
      }
    }
  });

  // Deposit Modal Handlers
  $('closeDepositModal')?.addEventListener('click', () => $('depositModal').close?.());
  $('confirmDepositBtn')?.addEventListener('click', async () => {
    const amount = Number($('depositAmount').value);
    const payMethod = document.querySelector('input[name="depositPayMethod"]:checked')?.value || 'card';
    const errEl = $('depositError');
    errEl.classList.add('hidden');

    if (!amount || amount < 1000) {
      errEl.textContent = 'لطفاً مبلغ معتبر وارد کنید.';
      errEl.classList.remove('hidden');
      return;
    }

    try {
      const res = await api('deposit', { amount, method: payMethod });
      $('depositModal').close?.();
      if (res.order) openPaymentModal(res.order);
      else showToast('درخواست شارژ حساب ثبت شد');
    } catch (err) {
      errEl.textContent = err.message || 'خطا در ثبت درخواست شارژ';
      errEl.classList.remove('hidden');
    }
  });

  // Receipt Form Submit
  $('receiptForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activePayOrder) return;
    const note = $('receiptNote').value;
    const errEl = $('receiptError');
    errEl.classList.add('hidden');

    try {
      await api('submit_receipt', { order_id: activePayOrder.id, note });
      showToast('رسید پرداخت با موفقیت ثبت شد 🎉');
      $('paymentModal').close?.();
      openTracker(activePayOrder.id);
      loadData();
    } catch (err) {
      errEl.textContent = err.message || 'خطا در ثبت رسید';
      errEl.classList.remove('hidden');
    }
  });

  // Crypto Form Submit
  $('cryptoForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activePayOrder) return;
    const txHash = $('cryptoTxid').value;
    const errEl = $('cryptoError');
    errEl.classList.add('hidden');

    try {
      await api('submit_crypto_hash', { order_id: activePayOrder.id, tx_hash: txHash });
      showToast('کد هش تراکنش با موفقیت ثبت شد 🎉');
      $('paymentModal').close?.();
      openTracker(activePayOrder.id);
      loadData();
    } catch (err) {
      errEl.textContent = err.message || 'خطا در ثبت کد تراکنش';
      errEl.classList.remove('hidden');
    }
  });

  // Search Input Event
  $('searchInput')?.addEventListener('input', (e) => {
    searchTerm = e.target.value;
    renderProducts();
  });

  // Login Form Submit
  $('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = $('loginUsername').value;
    const password = $('loginPassword').value;
    const errEl = $('loginError');
    errEl.classList.add('hidden');

    try {
      const res = await api('login', { username, password });
      if (res.auth_token) {
        localStorage.setItem('web_token', res.auth_token);
        showToast('ورود موفقیت‌آمیز بود!');
        $('authModal').close?.();
        loadData();
      }
    } catch (err) {
      if (err.requires_email_verification || err.error === 'EMAIL_VERIFICATION_REQUIRED') {
        showOtpForm(err.user_id, err.email, err.message);
        return;
      }
      errEl.textContent = err.message || 'خطا در ورود';
      errEl.classList.remove('hidden');
    }
  });

  // Register Form Submit
  $('registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = $('regUsername').value;
    const email = $('regEmail').value;
    const password = $('regPassword').value;
    const errEl = $('regError');
    errEl.classList.add('hidden');

    try {
      const res = await api('register', { username, email, password });
      if (res.requires_email_verification) {
        showOtpForm(res.user_id, res.email, res.message);
        return;
      }
      if (res.auth_token) {
        localStorage.setItem('web_token', res.auth_token);
        showToast('حساب با موفقیت ساخته شد!');
        $('authModal').close?.();
        loadData();
      }
    } catch (err) {
      errEl.textContent = err.message || 'خطا در ثبت‌نام';
      errEl.classList.remove('hidden');
    }
  });

  // OTP Form Submit
  $('otpForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const otp = $('otpInput').value;
    const errEl = $('otpError');
    errEl.classList.add('hidden');

    try {
      const res = await api('verify_email_otp', { user_id: pendingVerifUserId, otp });
      if (res.auth_token) {
        localStorage.setItem('web_token', res.auth_token);
        showToast('ایمیل تایید شد! 🎉');
        $('authModal').close?.();
        loadData();
      }
    } catch (err) {
      errEl.textContent = err.message || 'کد تایید نامعتبر است';
      errEl.classList.remove('hidden');
    }
  });

  // Resend OTP Code
  $('resendOtpBtn')?.addEventListener('click', async () => {
    if (!pendingVerifUserId) return;
    try {
      await api('resend_email_otp', { user_id: pendingVerifUserId });
      showToast('کد جدید به ایمیل شما ارسال شد 📩');
    } catch (err) {
      showToast(err.message || 'خطا در ارسال کد', 'error');
    }
  });

  // Init
  loadData();
})();
