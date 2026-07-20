// BlueReferral miniapp — ensure no stray top-level statements break the bundle
// (prepending a safe comment helps spot versions; remove only when sure)
const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }
// Scroll safety: do not block touchmove/touchend globally.
// Telegram's WebView handles one-finger page scrolling best when touch events stay passive.
// Zoom is controlled by the viewport meta and CSS; global preventDefault breaks scrolling on some Android builds.
try { tg?.disableVerticalSwipes?.(); } catch(e) {}
const initData = tg?.initData || '';
function getUrlFlag(name){
  const search=new URLSearchParams(location.search||'');
  if(search.get(name)) return search.get(name);
  const hash=(location.hash||'').replace(/^#/,'');
  try{const hp=new URLSearchParams(hash); if(hp.get(name)) return hp.get(name);}catch(e){}
  return null;
}
const adminFlag = getUrlFlag('admin') || getUrlFlag('mode') || getUrlFlag('startapp') || tg?.initDataUnsafe?.start_param || '';
const isAdminMode = adminFlag === '1' || String(adminFlag).toLowerCase() === 'admin';
let state = null, adminState = null, currentTab = 'home', currentAdminTab = 'dashboard', searchTerm = '', activeCategory = 'all', pendingDialog = null, pendingEdit = null, currentOrderId = null, orderFilter = 'all', lastSpinPrize = null, searchTimeout = null, shopSort = 'newest', shopFilterInStock = false, shopFilterFeatured = false, _shareUrl = '';
// Product card display mode: 'compact' (grid) or 'detailed' (list)
let productCardMode = localStorage.getItem('blue_ref_card_mode') || 'compact';

function setProductCardMode(mode){productCardMode=mode;localStorage.setItem('blue_ref_card_mode',mode);renderShop();}
let adminUiCards = [], adminUiWallets = [], adminUiRates = [];

function detectMiniAppDevice(){
  const ua = navigator.userAgent || '';
  const platform = String(tg?.platform || '').toLowerCase();
  const isiOS = /iphone|ipad|ipod/i.test(ua) || platform === 'ios' || platform === 'iphone' || platform === 'ipad' || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /android/i.test(ua) || platform === 'android';
  const w = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  const h = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
  return {isiOS,isAndroid,w,h,compact:w<=390,phone:w<=520,tablet:w>=760,landscape:w>h};
}
function applyDeviceLayout(){
  const d = detectMiniAppDevice();
  const root = document.documentElement;
  const body = document.body;
  root.classList.toggle('device-ios', d.isiOS);
  root.classList.toggle('device-android', d.isAndroid);
  root.classList.toggle('device-other', !d.isiOS && !d.isAndroid);
  root.classList.toggle('device-compact', d.compact);
  root.classList.toggle('device-phone', d.phone);
  root.classList.toggle('device-tablet', d.tablet);
  root.classList.toggle('device-landscape', d.landscape);
  if(body){
    body.dataset.device = d.isiOS ? 'ios' : (d.isAndroid ? 'android' : 'other');
    body.style.setProperty('--app-vw', `${d.w}px`);
    body.style.setProperty('--app-vh', `${d.h}px`);
  }
}
applyDeviceLayout();
window.addEventListener('resize', applyDeviceLayout, {passive:true});
window.addEventListener('orientationchange', () => setTimeout(applyDeviceLayout, 160), {passive:true});
// Compact header: reduce topbar on scroll for better viewport space
function updateCompactHeader(){
  const tb = document.querySelector('.topbar');
  if(!tb) return;
  tb.classList.toggle('compact', window.scrollY > 48);
}
window.addEventListener('scroll', updateCompactHeader, {passive:true});
// initialize
setTimeout(updateCompactHeader, 120);

// Keyboard shortcuts: Cmd/Ctrl+K to open command palette, '/' to focus search
document.addEventListener('keydown', function(e){
  // ignore when typing in inputs or dialogs
  const tag = (document.activeElement && document.activeElement.tagName || '').toLowerCase();
  if(tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable) return;
  // Cmd/Ctrl+K
  if((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')){
    e.preventDefault();
    openCommandPalette();
    return;
  }
  // Focus search with '/'
  if(e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey){
    e.preventDefault();
    const s = document.getElementById('searchInput');
    if(s){ s.focus(); s.select(); }
  }
}, {passive:false});
function tgUser(){return tg?.initDataUnsafe?.user || {}}
function userPhotoUrl(u={}){return u.photo_url || tgUser().photo_url || ''}
function userInitial(u={}){return esc(String(u.first_name || u.username || 'B').trim().slice(0,1).toUpperCase() || 'B')}
function userProfileAvatar(u={}, cls='profile-photo'){
  const photo = userPhotoUrl(u);
  return photo ? `<div class="${cls}"><img src="${esc(photo)}" alt="profile"></div>` : `<div class="${cls} fallback">${userInitial(u)}</div>`;
}
const $ = (id) => document.getElementById(id);
const fmt = (n) => `${Number(n || 0).toLocaleString('fa-IR')} تومان`;
const nf = (n) => Number(n || 0).toLocaleString('fa-IR');
const esc = (s) => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const textBlock = (s) => esc(s || '').replace(/\n/g,'<br>');
function colorMix(c){return c || '#1d9bf0'}
function applyTheme(data={}){const local=localStorage.getItem('blue_ref_color');const accent=local||data.theme_color||data.settings?.theme_color||'#1d9bf0';document.documentElement.style.setProperty('--accent',accent);document.documentElement.style.setProperty('--primary',data.button_colors_enabled===false?'#1d9bf0':(data.button_colors?.primary||data.settings?.button_colors?.primary||accent));document.documentElement.style.setProperty('--secondary',data.button_colors?.secondary||data.settings?.button_colors?.secondary||'#2563eb');document.documentElement.style.setProperty('--danger',data.button_colors?.danger||data.settings?.button_colors?.danger||'#ef4444');document.documentElement.style.setProperty('--success',data.button_colors?.success||data.settings?.button_colors?.success||'#22c55e');document.documentElement.style.setProperty('--warning',data.button_colors?.warning||data.settings?.button_colors?.warning||'#f59e0b');try{tg?.setHeaderColor?.(accent);tg?.setBackgroundColor?.('#08111f');tg?.MainButton?.setParams?.({color:accent,text_color:'#ffffff'});}catch(e){}}
let _statusTimer=null;
function showStatus(text,type='success'){
  const el=$('status');
  if(!el) return;
  // icon prefix
  const icons={success:'✅',error:'❌',warning:'⚠️',info:'🔔'};
  const icon=icons[type]||icons.success;
  el.innerHTML=`<span class="toast-icon">${icon}</span><span class="toast-text">${text}</span><div class="toast-bar"></div>`;
  el.className=`toast ${type}`;
  el.classList.remove('hidden');
  // haptic
  if(type==='error')try{tg?.HapticFeedback?.notificationOccurred?.('error')}catch(e){}
  else if(type==='success')try{tg?.HapticFeedback?.notificationOccurred?.('success')}catch(e){}
  // progress bar drain animation
  const bar=el.querySelector('.toast-bar');
  if(bar){bar.style.transition='none';bar.style.width='100%';requestAnimationFrame(()=>requestAnimationFrame(()=>{bar.style.transition='width 3.4s linear';bar.style.width='0%'}));}
  clearTimeout(_statusTimer);
  _statusTimer=setTimeout(()=>el.classList.add('hidden'),3500);
}
async function api(action,payload={}){const res=await fetch('/api.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,initData,...payload})});const data=await res.json().catch(()=>({}));if(!res.ok||data.ok===false)throw new Error(data.message||data.error||'خطا در ارتباط');return data}
/* ===== Batch 1 utilities: haptic, chime, confetti, pull-to-refresh, charts, lightbox, stepper ===== */
function haptic(t='light'){try{tg?.HapticFeedback?.impactOccurred?.(t)}catch(e){}}
function hapticNotify(t='success'){try{tg?.HapticFeedback?.notificationOccurred?.(t)}catch(e){}}
function playChime(){try{const ctx=new(window.AudioContext||window.webkitAudioContext)();[523.25,659.25,783.99].forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.value=f;o.type='sine';const t0=ctx.currentTime+i*0.1;g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(0.12,t0+0.02);g.gain.exponentialRampToValueAtTime(0.001,t0+0.35);o.start(t0);o.stop(t0+0.4)})}catch(e){}}
function fireConfetti(){try{const c=document.createElement('canvas');c.className='confetti-canvas';c.width=innerWidth;c.height=innerHeight;c.style.cssText='position:fixed;inset:0;z-index:9999;pointer-events:none';document.body.appendChild(c);const cx=c.getContext('2d'),colors=['#1d9bf0','#22c55e','#f59e0b','#ec4899','#8b5cf6','#ef4444','#06b6d4','#fde047'];const P=[];for(let i=0;i<90;i++)P.push({x:c.width/2+(Math.random()-0.5)*80,y:c.height*0.35,vx:(Math.random()-0.5)*14,vy:Math.random()*-12-5,grav:0.35+Math.random()*0.25,sz:5+Math.random()*8,col:colors[0|Math.random()*colors.length],rot:Math.random()*6.28,vr:(Math.random()-0.5)*0.3,life:1});let fr=0;(function anim(){fr++;cx.clearRect(0,0,c.width,c.height);let alive=false;P.forEach(p=>{if(p.life<=0)return;alive=true;p.x+=p.vx;p.y+=p.vy;p.vy+=p.grav;p.vx*=0.99;p.rot+=p.vr;if(fr>90)p.life-=0.04;cx.save();cx.globalAlpha=Math.max(0,p.life);cx.translate(p.x,p.y);cx.rotate(p.rot);cx.fillStyle=p.col;cx.fillRect(-p.sz/2,-p.sz/2,p.sz,p.sz*0.6);cx.restore()});if(alive&&fr<210)requestAnimationFrame(anim);else c.remove()})()}catch(e){}}
function celebrate(){hapticNotify('success');playChime();fireConfetti()}
let lastReferralsCount=-1,lastDeliveredOrderId=null;
function checkAndCelebrate(){const u=state?.user;if(u){if(lastReferralsCount>=0&&Number(u.referrals_count)>lastReferralsCount){celebrate();showStatus('🎉 زیرمجموعه جدید اضافه شد!')}lastReferralsCount=Number(u.referrals_count)}if(currentOrderId&&currentTab==='orders'){const o=orderById(currentOrderId);if(o&&o.status==='delivered'&&lastDeliveredOrderId!==currentOrderId){lastDeliveredOrderId=currentOrderId;celebrate()}}}
function orderStepperHtml(o){const steps=[{label:'پرداخت',icon:'💳'},{label:'در بررسی',icon:'🔍'},{label:'آماده‌سازی',icon:'📦'},{label:'تحویل',icon:'✅'}];const canceled=['rejected','canceled','refunded'].includes(o.status);if(canceled)return `<div class="order-stepper canceled"><div class="stepper-cancel"><span class="step-circle cancel">✕</span><div><b>سفارش ${esc(o.status_fa||o.status)}</b><small>این سفارش کامل نشد</small></div></div></div>`;let cur=0;if(o.status==='pending_payment'||o.status==='receipt_submitted')cur=0;else if(o.status==='reviewing'||o.status==='payment_confirmed')cur=1;else if(o.status==='preparing')cur=2;else if(o.status==='delivered')cur=3;return `<div class="order-stepper">${steps.map((s,i)=>{const done=i<cur,active=i===cur;return `<div class="step ${done?'done':''} ${active?'active':''}"><div class="step-circle">${done?'✓':s.icon}</div><span class="step-label">${s.label}</span>${i<steps.length-1?`<div class="step-line ${i<cur?'done':''}"></div>`:''}</div>`}).join('')}</div>`}
/* Pull-to-refresh */
let _ptrAttached=false,_ptrStartY=0,_ptrPulling=false,_ptrDist=0,_ptrIndicator=null;
function attachPullToRefresh(){if(_ptrAttached)return;_ptrAttached=true;_ptrIndicator=document.createElement('div');_ptrIndicator.className='ptr-indicator';_ptrIndicator.innerHTML=`<span class="ptr-spinner">↻</span><span class="ptr-label">برای رفرش بکش پایین</span>`;document.body.appendChild(_ptrIndicator);document.addEventListener('touchstart',e=>{if(scrollY<=0){_ptrStartY=e.touches[0].clientY;_ptrPulling=true;_ptrDist=0}},{passive:true});document.addEventListener('touchmove',e=>{if(!_ptrPulling)return;_ptrDist=Math.max(0,e.touches[0].clientY-_ptrStartY);if(_ptrDist>0&&_ptrDist<130){_ptrIndicator.style.opacity=Math.min(1,_ptrDist/70);const sp=_ptrIndicator.querySelector('.ptr-spinner');if(sp)sp.style.transform=`rotate(${_ptrDist*4}deg)`;_ptrIndicator.classList.toggle('ready',_ptrDist>70);if(_ptrDist>70){const lbl=_ptrIndicator.querySelector('.ptr-label');if(lbl)lbl.textContent='رها کن برای رفرش'}}else{_ptrIndicator.style.opacity=0}},{passive:true});document.addEventListener('touchend',async()=>{if(!_ptrPulling)return;_ptrPulling=false;if(_ptrDist>70){_ptrIndicator.classList.add('loading');const sp=_ptrIndicator.querySelector('.ptr-spinner');if(sp)sp.style.animation='ptrSpin .7s linear infinite';const lbl=_ptrIndicator.querySelector('.ptr-label');if(lbl)lbl.textContent='در حال بارگذاری...';try{await reloadCurrentPage()}catch(e){}setTimeout(()=>{_ptrIndicator.classList.remove('loading','ready');_ptrIndicator.style.opacity='';if(sp)sp.style.animation='';if(lbl)lbl.textContent='برای رفرش بکش پایین'},400)}else{_ptrIndicator.style.opacity=''}_ptrDist=0},{passive:true})}
async function reloadCurrentPage(){if(isAdminMode){adminState=await api('admin_summary');applyTheme(adminState.settings||{});renderAdmin()}else{state=await api('me');applyTheme(state);renderUser()}}
/* Charts (SVG / CSS, no external lib) */
function last7DaysRevenue(orders){const days=[];const now=new Date();for(let i=6;i>=0;i--){const d=new Date(now);d.setDate(d.getDate()-i);const ds=d.toISOString().slice(0,10);const rev=orders.filter(o=>{const od=String(o.created_at||'').slice(0,10);return ds===od&&['payment_confirmed','preparing','delivered'].includes(o.status)}).reduce((s,o)=>s+Number(o.final_amount||0),0);days.push({date:ds,label:['ی','د','س','چ','پ','ج','ش'][d.getDay()],rev})}return days}
function sparklineHtml(data){if(!data||!data.length)return '';const max=Math.max(...data.map(d=>d.rev),1);const w=280,h=56,pad=4;const pts=data.map((d,i)=>{const x=pad+(i*(w-2*pad))/(data.length-1);const y=h-pad-(d.rev/max)*(h-2*pad);return [x,y]});const poly=pts.map(p=>p.join(',')).join(' ');const area=`${pad},${h-pad} ${poly} ${w-pad},${h-pad}`;const labels=data.map((d,i)=>`<text x="${pad+(i*(w-2*pad))/(data.length-1)}" y="${h-1}" text-anchor="middle" font-size="9" fill="#9fb0c8">${d.label}</text>`).join('');const dots=pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="var(--accent)"/>`).join('');return `<svg class="sparkline" viewBox="0 0 ${w} ${h+12}" width="100%" height="68"><polygon points="${area}" fill="color-mix(in srgb,var(--accent) 18%,transparent)" stroke="none"/><polyline points="${poly}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>${dots}${labels}</svg>`}
function barChartHtml(items){if(!items||!items.length)return '<p class="muted empty-state">داده‌ای نیست.</p>';const max=Math.max(...items.map(i=>Number(i.c||0)),1);return `<div class="bar-chart">${items.map((it,i)=>{const pct=Math.round((Number(it.c||0)/max)*100);const colors=['var(--accent)','var(--success)','var(--warning)','#8b5cf6','#ec4899'];return `<div class="bar-row"><span class="bar-label">${esc(it.name||'')}</span><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:linear-gradient(90deg,${colors[i%5]},color-mix(in srgb,${colors[i%5]} 50%,#000))"></div></div><span class="bar-value">${nf(it.c||0)}</span></div>`}).join('')}</div>`}
function pieChartHtml(orders){const methods={};orders.forEach(o=>{const m=o.payment_method||'unknown';methods[m]=(methods[m]||0)+1});const total=orders.length;if(!total)return '<p class="muted empty-state">سفارشی نیست.</p>';const labels={card:'کارت',wallet:'کیف پول',stars:'Stars',crypto:'رمزارز',unknown:'نامشخص'};const colors={card:'#1d9bf0',wallet:'#22c55e',stars:'#f59e0b',crypto:'#8b5cf6',unknown:'#64748b'};const entries=Object.entries(methods).filter(([,c])=>c>0);let acc=0;const segs=entries.map(([k,c])=>{const pct=c/total*100;const s=acc;acc+=pct;return {k,c,pct,start:s,color:colors[k]||'#64748b'}});const grad=segs.map(s=>`${s.color} ${s.start}% ${s.start+s.pct}%`).join(', ');return `<div class="pie-wrap"><div class="pie" style="background:conic-gradient(${grad})"><div class="pie-hole"><b>${nf(total)}</b><span>سفارش</span></div></div><div class="pie-legend">${entries.map(([k,c])=>`<div class="pie-legend-row"><span class="pie-dot" style="background:${colors[k]||'#64748b'}"></span><span>${labels[k]||k}</span><b>${nf(c)}</b></div>`).join('')}</div></div>`}
/* Lightbox */
function openLightbox(url,caption=''){const lb=$('lightbox');if(!lb)return;lb.innerHTML=`<div class="lightbox-backdrop"></div><img src="${esc(url)}" alt="${esc(caption)}"><button class="lightbox-close">✕</button>${caption?`<p class="lightbox-caption">${esc(caption)}</p>`:''}`;lb.classList.add('open');lb.querySelector('.lightbox-backdrop')?.addEventListener('click',()=>closeLightbox());lb.querySelector('.lightbox-close')?.addEventListener('click',()=>closeLightbox())}
function closeLightbox(){const lb=$('lightbox');if(lb)lb.classList.remove('open')}
async function loadReceiptImage(orderId){try{haptic('light');showStatus('در حال دریافت رسید...');const r=await api('get_receipt_url',{order_id:orderId});if(r.url){openLightbox(r.url,`رسید سفارش #${nf(orderId)}`);showStatus('')}else{showStatus('رسید قابل دریافت نبود','error')}}catch(e){showStatus(e.message||'خطا در دریافت رسید','error')}}
/* Admin live counter polling */
let _adminLastTodayCount=-1;
function startAdminLivePolling(){if(isAdminMode&&currentAdminTab==='dashboard'){setTimeout(async()=>{if(!isAdminMode||currentAdminTab!=='dashboard')return;try{const snap=await api('admin_summary');const c=Number(snap.report?.today?.c||0);if(_adminLastTodayCount>=0&&c>_adminLastTodayCount){hapticNotify('success');playChime();const el=document.querySelector('.admin-stat-card:first-child');if(el){el.classList.add('pulse-alert');setTimeout(()=>el.classList.remove('pulse-alert'),2000)}showStatus(`🛎 سفارش جدید! (${nf(c-_adminLastTodayCount)} عدد)`)}_adminLastTodayCount=c;adminState=snap;renderAdmin()}catch(e){}},30000)}}
/* ===== Batch 2 utilities: cart, referral tree, customer 360, CSV export ===== */
let _cart=JSON.parse(localStorage.getItem('blue_ref_cart')||'[]');
function saveCart(){localStorage.setItem('blue_ref_cart',JSON.stringify(_cart));updateCartFab()}
function cartCount(){return _cart.reduce((s,i)=>s+Number(i.qty||1),0)}
function cartTotal(){return _cart.reduce((s,i)=>s+Number(i.price||0)*Number(i.qty||1),0)}
function cartAdd(pid,vid=0){const p=(state.shop_products||[]).find(x=>Number(x.id)===Number(pid));if(!p)return;const v=vid?(p.variants||[]).find(x=>Number(x.id)===Number(vid)):null;const price=v?Number(v.price):Number(p.price);const name=v?`${p.name} — ${v.title}`:p.name;const ex=_cart.find(i=>Number(i.pid)===Number(pid)&&Number(i.vid)===Number(vid));if(ex){ex.qty++}else{_cart.push({pid:Number(pid),vid:Number(vid),name,price,qty:1,img:p.image_url||''})}saveCart();haptic('light');showStatus(`🛒 «${name}» به سبد اضافه شد`);updateCartFab()}
function cartRemove(idx){_cart.splice(idx,1);saveCart();renderCartSheet()}
function cartQty(idx,delta){const it=_cart[idx];if(!it)return;it.qty=Math.max(1,Number(it.qty)+delta);saveCart();renderCartSheet()}
function cartClear(){_cart=[];saveCart();renderCartSheet()}
async function cartCheckout(){if(!_cart.length)return;if(!confirm(`${nf(cartCount())} سفارش ساخته شود؟`))return;const btn=$('cartCheckoutBtn');if(btn)btn.disabled=true;let ok=0, fail=0;for(const item of _cart){try{await api('create_order',{product_id:item.pid,variant_id:item.vid||null,use_wallet:0});ok++}catch(e){fail++}}_cart=[];saveCart();closeCartSheet();if(btn)btn.disabled=false;showStatus(`✅ ${nf(ok)} سفارش ساخته شد${fail?` · ${nf(fail)} ناموفق`:''}`);state=await api('me');applyTheme(state);currentTab='orders';renderUser()}
function updateCartFab(){const fab=$('cartFab');if(!fab)return;const c=cartCount();fab.classList.toggle('hidden',c===0||isAdminMode);const badge=fab.querySelector('.cart-fab-badge');if(badge)badge.textContent=nf(c)}
function openCartSheet(){const s=$('cartSheet');if(!s)return;s.innerHTML=cartSheetHtml();s.classList.add('open');haptic('light')}
function closeCartSheet(){const s=$('cartSheet');if(s)s.classList.remove('open')}
function cartSheetHtml(){if(!_cart.length)return `<div class="cart-sheet-inner"><div class="cart-sheet-handle"></div><div class="cart-sheet-head"><h3>🛒 سبد خرید</h3><button class="ghost" id="cartCloseBtn">✕</button></div><p class="muted empty-state">سبدت خالی است. از فروشگاه محصول اضافه کن.</p></div>`;return `<div class="cart-sheet-inner"><div class="cart-sheet-handle"></div><div class="cart-sheet-head"><h3>🛒 سبد خرید (${nf(cartCount())})</h3><button class="ghost" id="cartCloseBtn">✕</button></div><div class="cart-items">${_cart.map((it,i)=>`<div class="cart-item"><div class="cart-item-thumb">${it.img?`<img src="${esc(it.img)}" alt="">`:'<span>🛍</span>'}</div><div class="cart-item-info"><b>${esc(it.name)}</b><span class="muted">${fmt(it.price)} × ${nf(it.qty)}</span></div><div class="cart-item-qty"><button class="ghost" data-cart-dec="${i}">−</button><span>${nf(it.qty)}</span><button class="ghost" data-cart-inc="${i}">+</button></div><button class="ghost cart-item-del" data-cart-del="${i}">🗑</button></div>`).join('')}</div><div class="cart-sheet-foot"><div class="cart-total"><span>مجموع</span><b>${fmt(cartTotal())}</b></div><div class="cart-actions"><button class="secondary" id="cartClearBtn">پاک کردن</button><button class="primary" id="cartCheckoutBtn">ثبت ${nf(cartCount())} سفارش</button></div><p class="muted cart-note">هر آیتم یک سفارش جدا می‌شود و باید جدا پرداخت شود.</p></div></div>`}
function renderCartSheet(){const s=$('cartSheet');if(s&&s.classList.contains('open'))s.innerHTML=cartSheetHtml()}
/* Referral tree */
async function loadReferralTree(){try{const r=await api('my_referrals');return r.referrals||[]}catch(e){return[]}}
function referralTreeHtml(refs){if(!refs||!refs.length)return `<article class="wallet-card referral-tree-card"><div class="referral-tree-head"><span class="admin-card-icon">🌳</span><div><h3>درخت دعوت</h3><p class="muted">هنوز کسی را دعوت نکرده‌ای.</p></div></div><p class="muted">لینک دعوت خود را بفرست و با اولین دعوت پاداش بگیر.</p></article>`;const totalEarned=refs.reduce((s,r)=>s+Number(r.reward_amount||0),0);return `<article class="wallet-card referral-tree-card"><div class="referral-tree-head"><span class="admin-card-icon">🌳</span><div><h3>درخت دعوت</h3><p class="muted">${nf(refs.length)} زیرمجموعه · ${fmt(totalEarned)} درآمد</p></div></div><div class="referral-tree-list">${refs.map(r=>`<div class="referral-node"><div class="referral-node-avatar">${esc(String(r.first_name||r.username||'?').slice(0,1).toUpperCase())}</div><div class="referral-node-info"><b>${esc(r.first_name||r.username||'کاربر')}${r.username?' @'+esc(r.username):''}</b><span class="muted">عضو: ${esc(String(r.joined_at||r.created_at||'').slice(0,10))} · ${Number(r.orders_count||0)>0?nf(r.orders_count)+' سفارش · '+fmt(r.total_spent):'بدون سفارش'}</span></div><div class="referral-node-reward">+${fmt(r.reward_amount||0)}</div></div>`).join('')}</div></article>`}
/* Customer 360 */
async function openCustomer360(userId){try{haptic('light');const r=await api('admin_customer_view',{user_id:userId});const d=$('custDrawer');if(!d)return;const u=r.user,cs=r.customer_stats||{};d.innerHTML=`<div class="cust-drawer-inner"><div class="cust-drawer-handle"></div><div class="cust-drawer-head"><div class="cust-avatar">${esc(String(u.first_name||u.username||'?').slice(0,1).toUpperCase())}</div><div><h3>${esc(u.first_name||u.username||'کاربر')}</h3><p class="muted">${u.username?'@'+esc(u.username)+' · ':''}ID: <code>${u.telegram_id}</code>${u.phone_number?' · 📱 '+esc(u.phone_number):''}</p></div><button class="ghost" id="custCloseBtn">✕</button></div><div class="cust-stats-grid"><div class="cust-stat"><b>${fmt(u.balance)}</b><span>موجودی</span></div><div class="cust-stat"><b>${fmt(r.total_spent)}</b><span>کل خرید</span></div><div class="cust-stat"><b>${nf(u.referrals_count)}</b><span>زیرمجموعه</span></div><div class="cust-stat"><b>${esc(cs.tier?.emoji||'🥉')}</b><span>${esc(cs.tier?.fa||'برنز')}</span></div></div><div class="cust-section"><h4>🧾 سفارش‌ها (${nf(r.orders?.length||0)})</h4><div class="cust-orders">${(r.orders||[]).slice(0,8).map(o=>`<div class="cust-order-row"><div><b>#${nf(o.id)}</b> ${esc(o.display_name)}</div><span class="chip-mini chip-${o.status==='delivered'?'active':o.status==='rejected'?'off':'featured'}">${esc(o.status_fa||o.status)}</span></div>`).join('')||'<p class="muted">سفارشی نیست.</p>'}</div></div>${(r.withdrawals||[]).length?`<div class="cust-section"><h4>🏧 برداشت‌ها</h4><div class="cust-orders">${r.withdrawals.slice(0,5).map(w=>`<div class="cust-order-row"><div><b>${fmt(w.amount)}</b><small>${esc(w.card_info||'').slice(0,30)}</small></div><span class="chip-mini chip-${w.status==='paid'?'active':w.status==='rejected'?'off':'featured'}">${esc(w.status)}</span></div>`).join('')}</div></div>`:''}<div class="cust-section"><h4>📊 عضو از ${esc(String(u.created_at||'').slice(0,10))}</h4></div></div>`;d.classList.add('open');d.querySelector('#custCloseBtn')?.addEventListener('click',()=>closeCustomer360());d.querySelector('.cust-drawer-handle')?.addEventListener('click',()=>closeCustomer360())}catch(e){showStatus(e.message||'خطا در دریافت اطلاعات کاربر','error')}}
function closeCustomer360(){const d=$('custDrawer');if(d)d.classList.remove('open')}
/* CSV export */
function exportCsv(filename,rows){const csv=rows.map(r=>r.map(c=>{const s=String(c??'');return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}).join(',')).join('\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);haptic('light');showStatus(`📊 ${filename} دانلود شد`)}
function exportOrdersCsv(){const rows=[['#','کاربر','محصول','مبلغ نهایی','روش پرداخت','وضعیت','تاریخ']];(adminState.orders||[]).forEach(o=>rows.push([o.id,o.telegram_id,o.display_name,o.final_amount,o.payment_method_fa||o.payment_method,o.status_fa||o.status,o.created_at]));exportCsv('orders-'+new Date().toISOString().slice(0,10)+'.csv',rows)}
function exportProductsCsv(){const rows=[['#','نام','دسته','قیمت','واحد','فعال','ویژه','موجودی']];(adminState.products||[]).forEach(p=>rows.push([p.id,p.name,p.category_title||'',p.price,p.price_currency,p.is_active,p.is_featured,p.inventory_available||0]));exportCsv('products-'+new Date().toISOString().slice(0,10)+'.csv',rows)}
/* ===== Batch 3 utilities: balance counter, long-press, VIP bar, onboarding, recent, QR, light theme, badges, search, bulk, inline-edit, reorder, command palette, activity log, roles, flash sale, forecast, chat shortcut ===== */
function animateCount(el,end,duration=900){if(!el)return;const start=0;const t0=performance.now();const tick=now=>{const p=Math.min(1,(now-t0)/duration);const ease=1-Math.pow(1-p,3);el.textContent=nf(Math.round(start+(end-start)*ease));if(p<1)requestAnimationFrame(tick)};requestAnimationFrame(tick)}
function triggerBalanceAnims(){document.querySelectorAll('[data-count-anim]').forEach(el=>{if(el.dataset.counted)return;el.dataset.counted='1';animateCount(el,Number(el.dataset.countAnim||0))})}
/* Long-press: products + order rows */
let _lpTimer=null,_lpTarget=null,_lpAttached=false;
function _showOrderQuickMenu(orderId){
  const o=(state?.orders||[]).find(x=>Number(x.id)===Number(orderId));
  if(!o) return;
  haptic('medium');
  const ss=$('shareSheet'); // reuse share-sheet overlay
  if(!ss) return;
  _shareUrl=''; // not a share context
  ss.innerHTML=`<div class="share-sheet-inner"><div class="share-sheet-handle" data-close-share></div><div class="share-sheet-head"><div class="share-product-thumb" style="font-size:26px;display:grid;place-items:center">🧾</div><div class="share-product-info"><h3>سفارش #${nf(o.id)}</h3><p class="muted">${esc(o.display_name)} · ${esc(o.status_fa||o.status)}</p></div><button class="ghost" data-close-share>✕</button></div><div class="share-actions"><button class="share-btn" data-order-quick-copy="${o.id}"><span class="share-btn-icon">📋</span><div><b>کپی شناسه سفارش</b><small>#${nf(o.id)}</small></div></button>${state?.support_username?`<button class="share-btn" data-order-quick-support><span class="share-btn-icon">💬</span><div><b>تماس با پشتیبانی</b><small>@${esc(state.support_username)}</small></div></button>`:''}<button class="share-btn" data-order-open="${o.id}"><span class="share-btn-icon">📄</span><div><b>باز کردن جزئیات</b><small>مشاهده کامل سفارش</small></div></button></div></div>`;
  ss.classList.add('open');
  ss.addEventListener('click',ev=>{if(ev.target===ss)closeShareSheet();},{once:true});
}
function attachLongPress(){if(_lpAttached)return;_lpAttached=true;
  let _lpOrderTarget=null, _lpOrderTimer=null;
  document.addEventListener('touchstart',e=>{
    // product preview
    if($('previewSheet')?.classList.contains('open')) return;
    const t=e.target.closest('[data-product]');
    if(t){_lpTarget=t;_lpTimer=setTimeout(()=>{if(_lpTarget===t){_lpTarget=null;haptic('medium');showProductPreview(Number(t.dataset.product))}},550);}
    // order quick menu
    const or=e.target.closest('.order-row[data-order-open]');
    if(or){_lpOrderTarget=or;_lpOrderTimer=setTimeout(()=>{if(_lpOrderTarget===or){_lpOrderTarget=null;_showOrderQuickMenu(or.dataset.orderOpen)}},600);}
  },{passive:true});
  document.addEventListener('touchend',()=>{clearTimeout(_lpTimer);_lpTarget=null;clearTimeout(_lpOrderTimer);_lpOrderTarget=null;});
  document.addEventListener('touchmove',()=>{clearTimeout(_lpTimer);_lpTarget=null;clearTimeout(_lpOrderTimer);_lpOrderTarget=null;},{passive:true});
}
function showProductPreview(pid){const p=(state.shop_products||[]).find(x=>Number(x.id)===Number(pid));if(!p)return;const pv=$('previewSheet');if(!pv)return;pv.innerHTML=`<div class="preview-sheet-inner"><div class="preview-sheet-handle" data-close-preview></div><button class="preview-close-btn" data-close-preview>✕</button><div class="preview-img">${cardImage(p,'🛍')}</div><div class="preview-body"><h3>${esc(p.name)}</h3><div class="product-price-row"><span class="big-price">${priceLabel(p)}</span><span class="badge">${esc(p.delivery_type_fa)}</span>${Number(p.inventory_available||0)>0?'<span class="soon">آنی</span>':''}</div>${p.short_description?`<div class="preview-desc-box">${esc(p.short_description)}</div>`:''}<button class="secondary wide" data-preview-full="${p.id}">مشاهده کامل</button>${buyButtonsForProduct(p)}</div></div>`;pv.classList.add('open');pushRecent(pid);pv.querySelectorAll('[data-close-preview]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();closePreviewSheet()}));pv.querySelector('[data-preview-full]')?.addEventListener('click',e=>{e.stopPropagation();closePreviewSheet();showProduct(pid)});pv.addEventListener('click',function(ev){if(ev.target===pv)closePreviewSheet()})}
function closePreviewSheet(){const pv=$('previewSheet');if(pv){pv.classList.remove('open');pv.innerHTML=''}}
/* VIP / loyalty progress (U8) */
function vipProgressHtml(){const u=state.user;if(!u)return '';const tier=u.customer?.tier||{};const spent=Number(u.customer?.total_spent||0);const tiers=[{name:'Bronze',fa:'برنز',emoji:'🥉',min:0},{name:'Silver',fa:'نقره',emoji:'🥈',min:1000000},{name:'Gold',fa:'طلایی',emoji:'🥇',min:5000000},{name:'Diamond',fa:'الماس',emoji:'💎',min:10000000}];let cur=0,nxt=tiers[1];for(let i=0;i<tiers.length;i++){if(spent>=tiers[i].min){cur=i;nxt=tiers[i+1]||null}}const curTier=tiers[cur];const base=curTier.min;const ceiling=nxt?nxt.min:curTier.min;const range=Math.max(1,ceiling-base);const pct=nxt?Math.min(100,Math.round((spent-base)/range*100)):100;return `<article class="wallet-card vip-card"><div class="vip-head"><span class="vip-emoji">${curTier.emoji}</span><div><h3>سطح مشتری ${curTier.fa}</h3><p class="muted">${nxt?`تا ${nxt.fa} ${nxt.emoji}: ${fmt(Math.max(0,ceiling-spent))}`:'بالاترین سطح رسیدی! 🎉'}</p></div></div><div class="vip-track"><div class="vip-fill" style="width:${pct}%"></div></div><div class="vip-tiers">${tiers.map(t=>`<span class="${t.name===curTier.name?'active':''}">${t.emoji} ${esc(t.fa)}</span>`).join('')}</div></article>`}
/* Onboarding (U10) */
function shouldShowOnboarding(){return !localStorage.getItem('blue_ref_onboarded')}
function showOnboarding(){if(!shouldShowOnboarding())return;const o=$('onboarding');if(!o)return;const slides=[{emoji:'👋',title:'به فروشگاه خوش اومدی',text:'محصولات دیجیتال، VPN و اشتراک‌ها را اینجا پیدا کن.'},{emoji:'🤝',title:'با دعوت دوستان پول دربیار',text:'لینک دعوت اختصاصی بفرست و برای هر عضو جدید پاداش بگیر.'},{emoji:'🛒',title:'خرید کن و تحویل بگیر',text:'سفارش بده، پرداخت کن و تحویل آنی یا دستی را دریافت کن.'}];let idx=0;o.innerHTML=`<div class="onb-inner"><div class="onb-slides">${slides.map((s,i)=>`<div class="onb-slide ${i===0?'active':''}" data-onb-slide="${i}"><div class="onb-emoji">${s.emoji}</div><h2>${s.title}</h2><p>${s.text}</p></div>`).join('')}</div><div class="onb-dots">${slides.map((_,i)=>`<span class="onb-dot ${i===0?'active':''}" data-onb-dot="${i}"></span>`).join('')}</div><div class="onb-actions"><button class="ghost" id="onbSkip">رد کردن</button><button class="primary" id="onbNext">بعدی</button></div></div>`;o.classList.add('open');const next=$('onbNext');next?.addEventListener('click',()=>{idx++;if(idx>=slides.length){finishOnboarding();return}updateOnbSlide(idx,slides.length)});$('onbSkip')?.addEventListener('click',finishOnboarding);o.querySelectorAll('[data-onb-dot]').forEach(d=>d.addEventListener('click',()=>{idx=Number(d.dataset.onbDot);updateOnbSlide(idx,slides.length)}))}
function updateOnbSlide(i,total){document.querySelectorAll('[data-onb-slide]').forEach(s=>s.classList.toggle('active',Number(s.dataset.onbSlide)===i));document.querySelectorAll('[data-onb-dot]').forEach(d=>d.classList.toggle('active',Number(d.dataset.onbDot)===i));$('onbNext').textContent=i>=total-1?'شروع کنیم':'بعدی'}
function finishOnboarding(){localStorage.setItem('blue_ref_onboarded','1');$('onboarding')?.classList.remove('open')}
/* Recently viewed (U12) */
function pushRecent(pid){let r=JSON.parse(localStorage.getItem('blue_ref_recent')||'[]');r=r.filter(id=>Number(id)!==Number(pid));r.unshift(Number(pid));r=r.slice(0,8);localStorage.setItem('blue_ref_recent',JSON.stringify(r))}
function recentProductsHtml(){const ids=JSON.parse(localStorage.getItem('blue_ref_recent')||'[]');if(!ids.length)return '';const prods=ids.map(id=>(state.shop_products||[]).find(p=>Number(p.id)===Number(id))).filter(Boolean);if(!prods.length)return '';return `<section class="section-row"><div class="section-title"><h2>👁 اخیراً دیده‌شده</h2></div><div class="h-scroll product-grid-wrap">${prods.map(productCard).join('')}</div></section>`}
/* QR code (U13) — real QR via api.qrserver.com */
function qrCodeImg(text,size=200){const url='https://api.qrserver.com/v1/create-qr-code/?size='+size+'x'+size+'&data='+encodeURIComponent(text)+'&margin=8&qzone=2';return `<img src="${esc(url)}" alt="QR" width="${size}" height="${size}" style="display:block;width:100%;height:100%;border-radius:8px">`}
function openQrSheet(){const u=state.user;if(!u)return;const link=u.referral_link||'';if(!link){showStatus('لینک دعوت در دسترس نیست','error');return}const qs=$('qrSheet');if(!qs)return;qs.innerHTML=`<div class="qr-sheet-inner"><div class="qr-sheet-handle" data-close-qr></div><h3>📱 کد QR لینک دعوت</h3><p class="muted">دوستت این کد را با دوربین گوشی اسکن کنه تا مستقیم وارد بات بشه.</p><div class="qr-box">${qrCodeImg(link,200)}</div><div class="qr-link-box"><code>${esc(link)}</code></div><div class="actions"><button class="secondary" id="qrCopyBtn">📋 کپی لینک</button><button class="primary" id="qrCloseBtn">بستن</button></div></div>`;qs.classList.add('open');qs.querySelectorAll('[data-close-qr]').forEach(el=>el.addEventListener('click',closeQrSheet));$('qrCopyBtn')?.addEventListener('click',()=>{navigator.clipboard?.writeText(link);showStatus('لینک کپی شد')});$('qrCloseBtn')?.addEventListener('click',closeQrSheet)}
function closeQrSheet(){const qs=$('qrSheet');if(qs){qs.classList.remove('open');qs.innerHTML=''}}
/* Achievement badges (U15) */
function achievementsHtml(){const a=state.achievements||[];if(!a.length)return '';const earned=a.filter(x=>x.earned).length;return `<article class="wallet-card achievements-card"><div class="achievements-head"><span class="admin-card-icon">🏆</span><div><h3>دستاوردها</h3><p class="muted">${nf(earned)} از ${nf(a.length)} باز شده</p></div></div><div class="badges-grid">${a.map(x=>`<div class="badge-cell ${x.earned?'earned':'locked'}" title="${esc(x.title)}"><span class="badge-emoji">${x.earned?x.emoji:'🔒'}</span><small>${esc(x.title)}</small></div>`).join('')}</div></article>`}
/* Advanced order search (A2) */
let adminOrderSearch='',adminOrderStatusFilter='all',selectedOrderIds=new Set();
async function adminSearchOrdersNow(){try{const r=await api('admin_search_orders',{search:adminOrderSearch,status:adminOrderStatusFilter});adminState.orders=r.orders||[];renderAdmin()}catch(e){showStatus(e.message,'error')}}
/* Bulk actions (A3) */
async function bulkOrderAction(action){if(!selectedOrderIds.size){showStatus('حداقل یک سفارش انتخاب کن','error');return}const ids=[...selectedOrderIds];if(!confirm(`${nf(ids.length)} سفارش به «${action==='payment_confirmed'?'تایید پرداخت':action==='rejected'?'رد':action}» تغییر وضعیت دهد؟`))return;for(const id of ids){try{await api('admin_order_status',{order_id:id,status:action})}catch(e){}}selectedOrderIds.clear();await loadAdmin();showStatus(`${nf(ids.length)} سفارش تغییر کرد`)}
/* Inline edit (A4) */
function inlineEditProduct(id,field){const p=(adminState.products||[]).find(x=>Number(x.id)===Number(id));if(!p)return;const cur=p[field];const label={name:'نام',price:'قیمت',short_description:'توضیح کوتاه'}[field]||field;openDialog(`ویرایش ${label}`,`مقدار جدید برای ${esc(p.name)}:`,cur,async(txt)=>{await adminAction('admin_update_product',{product_id:id,[field]:txt})},String(cur||''))}
/* Reorder (A7) — up/down buttons */
async function reorderItem(type,id,direction){const list=type==='product'?(adminState.products||[]):(adminState.categories||[]);const ids=list.map(x=>Number(x.id));const idx=ids.indexOf(Number(id));if(idx<0)return;const swapIdx=direction==='up'?idx-1:idx+1;if(swapIdx<0||swapIdx>=ids.length)return;[ids[idx],ids[swapIdx]]=[ids[swapIdx],ids[idx]];const action=type==='product'?'admin_reorder_products':'admin_reorder_categories';try{haptic('light');await api(action,{ordered_ids:ids});showStatus('ترتیب ذخیره شد');await loadAdmin()}catch(e){showStatus(e.message,'error')}}
/* Command palette (A13) */
function openCommandPalette(){const cp=$('cmdPalette');if(!cp)return;const cmds=[{label:'داشبورد',icon:'📊',action:()=>setAdminTab('dashboard')},{label:'محصولات',icon:'🛒',action:()=>setAdminTab('products')},{label:'پلن‌ها',icon:'📐',action:()=>setAdminTab('variants')},{label:'سفارش‌ها',icon:'🧾',action:()=>setAdminTab('orders')},{label:'برداشت‌ها',icon:'🏧',action:()=>setAdminTab('withdrawals')},{label:'کدهای تخفیف',icon:'🎟',action:()=>setAdminTab('coupons')},{label:'انبار',icon:'📦',action:()=>setAdminTab('inventory')},{label:'تنظیمات',icon:'⚙️',action:()=>setAdminTab('settings')},{label:'بکاپ',icon:'💾',action:()=>setAdminTab('backups')},{label:'لاگ فعالیت',icon:'📜',action:()=>setAdminTab('activity')},{label:'نقش‌های ادمین',icon:'👥',action:()=>setAdminTab('roles')},{label:'دانلود CSV سفارش‌ها',icon:'📥',action:()=>exportOrdersCsv()},{label:'دانلود CSV محصولات',icon:'📥',action:()=>exportProductsCsv()}];const q=(cp.querySelector('#cmdInput')?.value||'').toLowerCase();const filtered=cmds.filter(c=>c.label.toLowerCase().includes(q));cp.querySelector('#cmdList').innerHTML=filtered.length?filtered.map((c,i)=>`<button class="cmd-item" data-cmd-idx="${i}"><span>${c.icon}</span><b>${c.label}</b></button>`).join(''):'<p class="muted" style="padding:14px;text-align:center">موردی پیدا نشد.</p>';cp._cmds=filtered;cp.classList.add('open');setTimeout(()=>cp.querySelector('#cmdInput')?.focus(),50)}
function closeCommandPalette(){const cp=$('cmdPalette');if(cp)cp.classList.remove('open')}
/* Flash sale helpers (U18/A18) */
function flashSaleActive(p){if(!p.flash_sale_start||!p.flash_sale_end||!Number(p.flash_sale_discount))return false;const now=Date.now();return now>=new Date(p.flash_sale_start).getTime()&&now<=new Date(p.flash_sale_end).getTime()}
function flashSaleCountdown(p){if(!flashSaleActive(p))return '';const ms=new Date(p.flash_sale_end).getTime()-Date.now();if(ms<=0)return '';const h=Math.floor(ms/3600000),m=Math.floor((ms%3600000)/60000),s=Math.floor((ms%60000)/1000);return `⚡ فلش فروش −${nf(p.flash_sale_discount)}٪ · ${nf(h)}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
/* Chat shortcut (A16) */
function openUserChat(username){if(username){try{Telegram?.WebApp?.openTelegramLink?.('https://t.me/'+username)}catch(e){location.href='https://t.me/'+username}}else{showStatus('این کاربر یوزرنیم ندارد','error')}}
function openDialog(title,text,placeholder,onSubmit,initial=''){pendingDialog=onSubmit;$('dialogTitle').textContent=title;$('dialogText').textContent=text;$('dialogInput').value=initial;$('dialogInput').placeholder=placeholder||'';$('inputDialog').showModal()}
function openEdit(title,fields,onSubmit){pendingEdit=onSubmit;$('editTitle').textContent=title;$('editFields').innerHTML=fields.join('');$('editDialog').showModal()}
function val(id){const el=$(id);return el?.type==='checkbox'?el.checked:el?.value}
function timeline(t=[]){return t?.length?`<div class="timeline">${t.map(e=>`<div><b>${esc(e.title)}</b><small>${esc(e.created_at||'')}</small></div>`).join('')}</div>`:''}
const cleanupStatuses=['rejected','canceled','refunded'];
function canHideOrder(o){return cleanupStatuses.includes(String(o?.status||''))}
function statusClass(status){return ({delivered:'success',payment_confirmed:'success',preparing:'warning',receipt_submitted:'warning',reviewing:'warning',pending_payment:'pending',rejected:'danger',canceled:'danger',refunded:'danger'}[status]||'pending')}
function orderStatusBadge(o){return `<span class="status-badge ${statusClass(o.status)}">${esc(o.status_fa||o.status)}</span>`}
function orderById(id){return (state.orders||[]).find(o=>Number(o.id)===Number(id))}
function cryptoRateCacheText(){const c=state?.payment_methods?.crypto?.rate_cache||adminState?.settings?.crypto_rate_cache||{};const rows=Object.entries(c||{});const last=adminState?.settings?.crypto_rate_last_result||{};let out=[];if(rows.length){out=rows.map(([k,v])=>{const r=typeof v==='object'?v.rate:v;const at=typeof v==='object'?(v.updated_at||''):'';const src=typeof v==='object'?(v.source||v.provider||'cache'):'cache';return `${k}: ${Number(r||0).toLocaleString('fa-IR')} تومان · ${src}${at?' · '+at:''}`})}else out.push('هنوز cache نرخ نداریم.');if(last?.providers?.length)out.push('Providerها: '+last.providers.join(' → '));if(last?.failed&&Object.keys(last.failed).length)out.push('خطا/ fallback: '+Object.entries(last.failed).map(([k,v])=>`${k}:${v}`).join('، '));return out.join('\n')}
async function refreshCurrentOrderSilently(){if(currentTab!=='orders'||!currentOrderId)return;try{state=await api('me');applyTheme(state);renderOrders()}catch(e){console.warn('order refresh failed',e)}}

function cardImage(obj, emoji='🛒'){
  if(!obj || !obj.image_url) return `<div class="tile-placeholder">${emoji}</div>`;
  const url=esc(obj.image_url);
  // support optional responsive srcset if provided by API
  const srcset = obj.image_srcset?` srcset="${esc(obj.image_srcset)}"` : '';
  return `<img src="${url}" loading="lazy" decoding="async"${srcset} alt="${esc(obj.name||'product')}">`;
}
function priceLabel(p){return esc(p.price_label || fmt(p.price))}
function priceCurrencyOptions(selected='IRT'){selected=String(selected||'IRT').toUpperCase();return `<option value="IRT" ${selected!=='USD'?'selected':''}>تومان</option><option value="USD" ${selected==='USD'?'selected':''}>دلار / USDT</option>`}
function priceAdminFields(prefix,item={}){const c=String(item.price_currency||'IRT').toUpperCase();const usd=item.price_usd||'';const toman=item.price||'';return `<div class="price-editor full"><div class="price-editor-head"><span>💸</span><div><b>نوع قیمت‌گذاری</b><small>تومان ثابت یا دلار با تبدیل خودکار به تومان</small></div></div><div class="price-editor-grid"><label><span>واحد قیمت</span><select id="${prefix}_currency">${priceCurrencyOptions(c)}</select></label><label><span>قیمت تومان</span><input id="${prefix}_price" value="${esc(toman)}" inputmode="numeric" placeholder="مثلاً 2199000"></label><label><span>قیمت دلار</span><input id="${prefix}_price_usd" value="${esc(usd)}" inputmode="decimal" placeholder="مثلاً 19.99"></label><p class="muted full">اگر دلار انتخاب شود، کاربر فقط قیمت تومانی لحظه‌ای را می‌بیند؛ مبلغ دلاری فقط هنگام پرداخت رمزارز/ارزی نمایش داده می‌شود.</p></div></div>`}
function priceAdminSummary(obj={}){const m=obj.price_meta||{};if((obj.price_currency||m.currency)==='USD'){return `قیمت دلاری: ${nf(obj.price_usd||m.usd||0)}$ → ${fmt(obj.price||m.toman||0)} ${m.rate_source?`· نرخ ${esc(m.rate_source)}`:''}`}return `قیمت تومانی: ${fmt(obj.price||0)}`}
function orderUsdHint(o){return String(o.price_currency||'IRT').toUpperCase()==='USD' && Number(o.price_usd||0)>0 ? `<p class="muted usd-only-hint">مبنای دلاری این سفارش: $${nf(o.price_usd)} · نرخ تبدیل: ${o.usd_rate_toman?nf(o.usd_rate_toman)+' تومان':''}</p>` : ''}
function setTab(tab){currentTab=tab;renderUser()}
function setAdminTab(tab){currentAdminTab=tab;renderAdmin()}
function render(data){
  hideSkeleton();
  state=data;applyTheme(data);
  if($('brandTitle')) $('brandTitle').textContent=data.brand||'BlueReferral';
  if($('helloText')) $('helloText').textContent=`سلام ${data.user?.first_name||data.user?.username||'رفیق'} 👋`;
  $('userApp').classList.toggle('hidden',isAdminMode);
  $('adminApp').classList.toggle('hidden',!isAdminMode);
  if(isAdminMode){loadAdmin();return}
  renderUser();checkAndCelebrate();handleDeepLink();
}
let _deepLinkHandled=false;
function handleDeepLink(){
  if(_deepLinkHandled) return;
  _deepLinkHandled=true;
  // 1) Telegram startapp param: ?startapp=product_5 or tg.initDataUnsafe.start_param = 'product_5'
  const startParam = tg?.initDataUnsafe?.start_param || getUrlFlag('startapp') || '';
  let pid = null;
  if(startParam && /^product_(\d+)$/i.test(startParam)){
    pid = startParam.replace(/^product_/i,'');
  }
  // 2) Web fallback: ?product=5
  if(!pid){ pid = getUrlFlag('product'); }
  if(pid && Number(pid) > 0){
    // Switch to shop tab first so back-button works, then show the product
    currentTab='shop';
    showProduct(pid);
  }
}
function hidePages(){['homePage','shopPage','productPage','ordersPage','walletPage'].forEach(id=>$(id).classList.add('hidden'));document.querySelectorAll('.bottom-nav [data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===currentTab))}
function renderUser(){hidePages();if(currentTab==='home'){ $('homePage').classList.remove('hidden'); renderHome(); }if(currentTab==='shop'){ $('shopPage').classList.remove('hidden'); renderShop(); }if(currentTab==='orders'){ $('ordersPage').classList.remove('hidden'); renderOrders(); }if(currentTab==='wallet'){ $('walletPage').classList.remove('hidden'); renderWallet(); }}
function renderHome(){const u=state.user;const c=u.customer?.tier||{};const today=Number(u.today_referrals||0);$('homePage').innerHTML=`<section class="hero hero-pro wallet-hero"><div class="hero-glow"></div><div class="row profile-row"><div class="profile-head">${userProfileAvatar(u)}<div><small>داشبورد حساب</small><h2>${esc(u.first_name||u.username||'کاربر BlueReferral')}</h2><p class="muted user-line">${u.username?'@'+esc(u.username):'بدون یوزرنیم'} · ${u.phone_number?'📱 '+esc(u.phone_number):'شماره ثبت نشده'}</p></div></div><div class="avatar floating-avatar">${u.vip?.emoji||'💙'}</div></div><div class="wallet-balance"><span>موجودی قابل خرج</span><b data-count-anim="${u.balance}">${fmt(u.balance)}</b></div><p class="muted">موجودی کیف پولت می‌تواند از مبلغ فاکتور فروشگاه کم شود. سطح همکاری ${u.vip?.emoji||''} ${esc(u.vip?.fa||'')} · سطح مشتری ${c.emoji||''} ${esc(c.fa||'')}</p></section><div class="stats-grid vivid"><div class="mini-stat"><b data-count-anim="${u.referrals_count}">${nf(u.referrals_count)}</b><span>زیرمجموعه</span></div><div class="mini-stat"><b data-count-anim="${u.total_earned}">${fmt(u.total_earned)}</b><span>کل درآمد</span></div><div class="mini-stat"><b data-count-anim="${u.spin_balance}">${nf(u.spin_balance)}</b><span>شانس گردونه</span></div></div>${vipProgressHtml()}${achievementsHtml()}<article class="mission-preview"> <div><small>ماموریت امروز</small><h3>پیشرفت دعوت‌ها</h3><p class="muted">امروز ${nf(today)} دعوت ثبت شده است.</p></div><button class="secondary" data-tab-jump="wallet">مشاهده</button></article><div class="quick-grid"><button class="quick-card gradient-card" data-tab-jump="orders"><b>🧾 سفارش‌های من</b><span>پیگیری وضعیت و تحویل‌ها</span></button><button class="quick-card gradient-card" data-tab-jump="wallet"><b>💰 کیف پول</b><span>ماموریت، تراکنش و پرداخت</span></button><button class="quick-card gradient-card" data-tab-jump="shop"><b>🛒 فروشگاه</b><span>محصولات دیجیتال و VPN</span></button><button class="quick-card gradient-card" id="paletteQuick"><b>🎨 تغییر رنگ</b><span>ظاهر Mini App را شخصی کن</span></button></div>`;triggerBalanceAnims()}
function openPalettePopup(){const colors=['#1d9bf0','#8b5cf6','#22c55e','#ef4444','#f97316','#ec4899','#06b6d4','#f59e0b','#14b8a6','#64748b'];const p=$('palettePopup');if(!p)return;p.innerHTML=`<div class="palette-popup-backdrop" data-close-palette></div><div class="palette-popup-inner"><button class="palette-popup-close" data-close-palette>✕</button><h3>🎨 رنگ دلخواه Mini App</h3><p class="muted">یکی از رنگ‌ها را بزن یا رنگ اختصاصی خودت را انتخاب کن. این رنگ فقط روی همین دستگاه ذخیره می‌شود.</p><div class="palette">${colors.map(c=>`<button class="swatch" data-color="${c}" style="background:${c}"></button>`).join('')}<label class="custom-color"><span>رنگ دلخواه</span><input id="userCustomColor" type="color" value="${esc(localStorage.getItem('blue_ref_color')||state?.theme_color||'#1d9bf0')}"></label><button class="secondary wide" id="applyCustomColor">اعمال رنگ</button><button class="ghost wide" id="resetColor">پیش‌فرض</button></div></div>`;p.classList.add('open');p.querySelectorAll('[data-close-palette]').forEach(el=>el.addEventListener('click',closePalettePopup))}
function closePalettePopup(){const p=$('palettePopup');if(p){p.classList.remove('open');p.innerHTML=''}}
function missionCard(m){const today=Number(state.user?.today_referrals||0);const target=Math.max(1,Number(m.target||1));const pct=Math.max(0,Math.min(100,Math.round(today/target*100)));const done=m.claimed?'claimed':(m.done?'done':'todo');return `<article class="mission-card ${done}"><div class="mission-top"><div><small>${nf(Math.min(today,target))} از ${nf(target)}</small><h3>${nf(target)} دعوت امروز</h3><p class="muted">پاداش: <b>${fmt(m.reward)}</b></p></div><div class="mission-icon">${m.claimed?'✅':(m.done?'🎁':'✌️')}</div></div><div class="progress-track"><span style="width:${pct}%"></span></div><div class="mission-foot"><span>${pct}% تکمیل شده</span><b>${m.claimed?'دریافت شد':(m.done?'آماده دریافت':'در حال انجام')}</b></div></article>`}
function filteredProducts(){let list=(state.shop_products||[]).filter(p=>(activeCategory==='all'||Number(p.category_id)===Number(activeCategory)||activeCategory==='featured'&&Number(p.is_featured)===1)&&(!searchTerm||`${p.name} ${p.short_description} ${p.full_description}`.toLowerCase().includes(searchTerm.toLowerCase())));if(shopFilterInStock)list=list.filter(p=>Number(p.inventory_available||0)>0);if(shopFilterFeatured)list=list.filter(p=>Number(p.is_featured)===1||flashSaleActive(p));if(shopSort==='price_low')list=[...list].sort((a,b)=>Number(a.price||0)-Number(b.price||0));else if(shopSort==='price_high')list=[...list].sort((a,b)=>Number(b.price||0)-Number(a.price||0));return list}
function shopSectionsHtml(){const cats=state.shop_categories||[];const products=filteredProducts();const filtersActive=shopFilterInStock||shopFilterFeatured||shopSort!=='newest';let sections='';if(activeCategory==='all'&&!searchTerm&&!filtersActive){const recent=recentProductsHtml();if(recent)sections+=recent;const featured=(state.shop_products||[]).filter(p=>Number(p.is_featured)===1||flashSaleActive(p));if(featured.length)sections+=sectionHtml('⭐ محصولات ویژه',featured);for(const c of cats){const list=(state.shop_products||[]).filter(p=>Number(p.category_id)===Number(c.id));if(list.length)sections+=sectionHtml(`${esc(c.emoji||'🛒')} ${esc(c.title)}`,list)} }else sections=gridHtml(products);return sections||'<p class="muted empty-state">محصولی پیدا نشد.</p>'}
function renderShop(){const cats=state.shop_categories||[];const brand=state.brand||'BlueReferral';$('shopPage').innerHTML=`<section class="shop-hero"><div><small>${esc(brand)}</small><h2>محصولاتو راحت پیدا کن</h2></div><span>🛍</span></section><div class="searchbar">🔍<input id="searchInput" autocomplete="off" inputmode="search" placeholder="جستجوی محصول، اشتراک، VPN..." value="${esc(searchTerm)}"><div class="search-actions"><button class="ghost" id="toggleCardMode" data-toggle-card-mode>${productCardMode==='compact'?'🔳':'📋'}</button></div></div><div class="shop-filter-bar"><div class="shop-sort-group"><button class="shop-filter-chip ${shopSort==='newest'?'active':''}" data-shop-sort="newest">جدیدترین</button><button class="shop-filter-chip ${shopSort==='price_low'?'active':''}" data-shop-sort="price_low">ارزان‌ترین</button><button class="shop-filter-chip ${shopSort==='price_high'?'active':''}" data-shop-sort="price_high">گران‌ترین</button></div><div class="shop-toggle-group"><button class="shop-filter-chip ${shopFilterInStock?'active':''}" data-shop-toggle="instock">${shopFilterInStock?'✓ ':''}فقط آنی</button><button class="shop-filter-chip ${shopFilterFeatured?'active':''}" data-shop-toggle="featured">${shopFilterFeatured?'✓ ':''}ویژه</button></div></div><div class="category-strip"><button class="cat-pill ${activeCategory==='all'?'active':''}" data-cat="all"><span>✨</span><b>همه</b></button><button class="cat-pill ${activeCategory==='featured'?'active':''}" data-cat="featured"><span>⭐</span><b>ویژه</b></button>${cats.map(c=>`<button class="cat-pill ${Number(activeCategory)===Number(c.id)?'active':''}" data-cat="${c.id}">${c.image_url?`<img src="${esc(c.image_url)}">`:`<span>${esc(c.emoji||'🛒')}</span>`}<b>${esc(c.title)}</b></button>`).join('')}</div><div id="shopSections">${shopSectionsHtml()}</div>`}
function renderShopSections(){const box=$('shopSections'); if(box) box.innerHTML=shopSectionsHtml();}
function sectionHtml(title,products){return `<details class="section-row section-collapsible" open><summary class="section-title"><h2>${title}</h2><span class="section-chevron">‹</span></summary><div class="h-scroll product-grid-wrap">${products.map(productCard).join('')}</div></details>`}
function gridHtml(products){return `<section class="section-row"><div class="h-scroll product-grid-wrap">${products.map(productCard).join('')}</div></section>`}
function productCard(p){
  const flash=flashSaleActive(p);
  if(productCardMode==='detailed'){
    return `<article class="product-tile detailed ${flash?'flash-sale-tile':''}" data-product="${p.id}">`+
      `<div class="tile-img">${cardImage(p,'🛍')}${flash?'<span class="flash-badge">⚡</span>':''}</div>`+
      `<div class="tile-body"><h3>${esc(p.name)}</h3>`+
      (p.short_description?`<p class="tile-desc">${esc(p.short_description)}</p>`:'')+
      `<div class="product-detail-row"><div class="price-row-mini"><span class="price-pill">${flash?'<s>'+priceLabel(p)+'</s>':priceLabel(p)}</span>${flash?`<span class="flash-pill">−${nf(p.flash_sale_discount)}٪</span>`:''}${Number(p.inventory_available||0)>0?'<span class="soon">آنی</span>':''}</div>`+
      `<div class="detail-actions">${buyButtonsForProduct(p)}<button class="ghost" data-share-product="${p.id}">🔗 اشتراک</button></div></div></div></article>`;
  }
  return `<article class="product-tile ${flash?'flash-sale-tile':''}" data-product="${p.id}"><div class="tile-img">${cardImage(p,'🛍')}${flash?'<span class="flash-badge">⚡</span>':''}</div><div class="tile-body"><h3>${esc(p.name)}</h3>${p.short_description?`<p class="tile-desc">${esc(p.short_description)}</p>`:''}<div class="price-row-mini"><span class="price-pill">${flash?'<s>'+priceLabel(p)+'</s>':priceLabel(p)}</span>${flash?`<span class="flash-pill">−${nf(p.flash_sale_discount)}٪</span>`:''}${Number(p.inventory_available||0)>0?'<span class="soon">آنی</span>':''}</div><div class="tile-actions"><button class="ghost" data-share-product="${p.id}">🔗 اشتراک</button></div></div></article>`;
}
function buyButtonsForProduct(p){const bal=Number(state.user?.balance||0);const walletHint=bal>0?`<div class="wallet-hint">💰 موجودی شما: <b>${fmt(bal)}</b>؛ می‌تونی ازش برای کم‌کردن فاکتور استفاده کنی.</div>`:'';if((p.variants||[]).length){return `${walletHint}<div class="variant-list">${(p.variants||[]).map(v=>`<div class="variant-card"><div><b>${esc(v.title)}</b><span>${priceLabel(v)}</span></div><div class="variant-card-actions"><button class="ghost" data-cart-add="${p.id}" data-cart-variant="${v.id}">🛒 سبد</button><button class="primary" data-buy="${p.id}" data-variant="${v.id}">ثبت سفارش</button>${bal>0?`<button class="secondary" data-buy-wallet="${p.id}" data-variant="${v.id}">کیف پول</button>`:''}</div></div>`).join('')}</div>`}return `${walletHint}<div class="actions variant-list"><button class="ghost" data-cart-add="${p.id}">🛒 افزودن به سبد</button><button class="primary pulse" data-buy="${p.id}">ثبت سفارش</button>${bal>0?`<button class="secondary" data-buy-wallet="${p.id}">خرید با کیف پول</button>`:''}</div>`}

/* ===== Share sheet ===== */
function copyText(text){
  // Try modern clipboard API first, fall back to execCommand
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(
      ()=>showStatus('لینک محصول کپی شد 🔗'),
      ()=>_copyFallback(text)
    );
  } else {
    _copyFallback(text);
  }
}
function _copyFallback(text){
  try{
    const ta=document.createElement('textarea');
    ta.value=text;
    ta.setAttribute('readonly','');
    ta.style.cssText='position:fixed;left:-9999px;top:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok=document.execCommand('copy');
    ta.remove();
    showStatus(ok?'لینک محصول کپی شد 🔗':'لینک: '+text.slice(0,40));
  }catch(e){
    showStatus('لینک: '+text.slice(0,50));
  }
}
function productShareUrl(pid){
  const bot = state?.bot_username || '';
  if(bot) return `https://t.me/${encodeURIComponent(bot)}?startapp=product_${encodeURIComponent(pid)}`;
  return location.origin + location.pathname + '?product=' + encodeURIComponent(pid);
}
function openShareSheet(pid){
  const p=(state.shop_products||[]).find(x=>Number(x.id)===Number(pid));
  if(!p){ shareProductLegacy(pid); return; }
  const bot = state?.bot_username||'';
  const tgLink = bot ? `https://t.me/${encodeURIComponent(bot)}?startapp=product_${encodeURIComponent(pid)}` : null;
  const webLink = location.origin + location.pathname + '?product=' + encodeURIComponent(pid);
  _shareUrl = tgLink || webLink;
  const ss=$('shareSheet');
  if(!ss){ shareProductLegacy(pid); return; }
  haptic('light');
  ss.innerHTML=`<div class="share-sheet-inner"><div class="share-sheet-handle" data-close-share></div><div class="share-sheet-head"><div class="share-product-thumb">${cardImage(p,'\uD83D\uDECD')}</div><div class="share-product-info"><h3>${esc(p.name)}</h3><p class="muted">${priceLabel(p)}</p></div><button class="ghost" data-close-share>\u2715</button></div><p class="share-hint muted">\u0627\u06CC\u0646 \u0645\u062D\u0635\u0648\u0644 \u0631\u0627 \u0628\u0627 \u062F\u0648\u0633\u062A\u0627\u0646\u062A \u0628\u0647 \u0627\u0634\u062A\u0631\u0627\u06A9 \u0628\u0630\u0627\u0631 \u062A\u0627 \u0645\u0633\u062A\u0642\u06CC\u0645 \u062A\u0648\u06CC \u0628\u0627\u062A \u0628\u0627\u0632 \u0634\u0648\u062F.</p><div class="share-actions">${tgLink?`<button class="share-btn share-tg" data-share-tg-url="${esc(tgLink)}"><span class="share-btn-icon">\u2708\uFE0F</span><div><b>\u0627\u0634\u062A\u0631\u0627\u06A9\u200C\u06AF\u0630\u0627\u0631\u06CC \u062F\u0631 \u062A\u0644\u06AF\u0631\u0627\u0645</b><small>\u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 \u0645\u0633\u062A\u0642\u06CC\u0645 \u062F\u0631 \u0628\u0627\u062A</small></div></button>`:''}<button class="share-btn share-copy" data-share-copy-url><span class="share-btn-icon">\uD83D\uDD17</span><div><b>\u06A9\u067E\u06CC \u0644\u06CC\u0646\u06A9 \u0645\u062D\u0635\u0648\u0644</b><small>${esc(_shareUrl.slice(0,48))}\u2026</small></div></button>${navigator.share?`<button class="share-btn share-native" data-share-native><span class="share-btn-icon">\u2B06\uFE0F</span><div><b>\u0627\u0634\u062A\u0631\u0627\u06A9\u200C\u06AF\u0630\u0627\u0631\u06CC \u0633\u06CC\u0633\u062A\u0645\u06CC</b><small>\u0648\u0627\u062A\u0633\u0627\u067E\u060C \u067E\u06CC\u0627\u0645\u060C \u0627\u06CC\u0645\u06CC\u0644 \u0648...</small></div></button>`:''}</div></div>`;
  ss.classList.add('open');
  ss.addEventListener('click',ev=>{ if(ev.target===ss) closeShareSheet(); },{once:true});
}
function closeShareSheet(){const ss=$('shareSheet');if(ss){ss.classList.remove('open');ss.innerHTML='';_shareUrl=''}}
async function shareProductLegacy(pid){
  const p=(state.shop_products||[]).find(x=>Number(x.id)===Number(pid));
  const title = p? (p.name||'\u0645\u062D\u0635\u0648\u0644') : '\u0645\u062D\u0635\u0648\u0644';
  const bot = state?.bot_username || '';
  const tgLink = bot ? `https://t.me/${encodeURIComponent(bot)}?startapp=product_${encodeURIComponent(pid)}` : null;
  const webLink = location.origin + location.pathname + '?product=' + encodeURIComponent(pid);
  const shareUrl = tgLink || webLink;
  try{
    if(navigator.share){ await navigator.share({title, text: title, url: shareUrl}); showStatus('\u0644\u06CC\u0646\u06A9 \u0628\u0647 \u0627\u0634\u062A\u0631\u0627\u06A9 \u06AF\u0630\u0627\u0634\u062A\u0647 \u0634\u062F'); return; }
  }catch(e){}
  copyText(shareUrl);
}




function showProduct(pid){const p=(state.shop_products||[]).find(x=>Number(x.id)===Number(pid));if(!p)return;currentTab='product';hidePages();$('productPage').classList.remove('hidden');$('productPage').innerHTML=`<div class="detail-hero product-hero">${cardImage(p,'🛍')}</div><article class="detail-card product-detail"><div class="product-detail-topbar"><button class="secondary" data-back-shop>بازگشت به فروشگاه</button><button class="share-pill" data-share-product="${p.id}">🔗 اشتراک</button></div><h2>${esc(p.name)}</h2><div class="product-price-row"><span class="big-price">${priceLabel(p)}</span><span class="badge live-price-badge">${p.price_currency==='USD'?'نرخ لحظه‌ای':'قیمت ثابت'}</span><span class="badge">${esc(p.delivery_type_fa)}</span><span class="badge">موجودی آماده: ${nf(p.inventory_available||0)}</span></div><div class="description-box">${textBlock(p.full_description||p.short_description||'بدون توضیح')}</div>${buyButtonsForProduct(p)}</article>`;window.scrollTo({top:0,behavior:'instant'})}
function renderOrders(){const all=state.orders||[];const filters=[['all','همه'],['active','فعال'],['pending_payment','در انتظار پرداخت'],['receipt_submitted','رسید ارسال شده'],['delivered','تحویل‌شده'],['cleanup','لغو/رد شده']];if(currentOrderId){const o=orderById(currentOrderId); if(!o){currentOrderId=null; return renderOrders()} $('ordersPage').innerHTML=orderDetailHtml(o); return;}const orders=all.filter(o=>orderFilter==='all'||(orderFilter==='active'&&!canHideOrder(o)&&o.status!=='delivered')||(orderFilter==='cleanup'&&canHideOrder(o))||o.status===orderFilter);$('ordersPage').innerHTML=`<section class="orders-header"><div><h2>🧾 سفارش‌های من</h2><p class="muted">روی هر سفارش بزن تا جزئیات تمیز و کاملش باز شود.</p></div><button class="secondary" data-clear-canceled>پاکسازی لغو/رد شده‌ها</button></section><div class="order-filters">${filters.map(f=>`<button class="filter-chip ${orderFilter===f[0]?'active':''}" data-order-filter="${f[0]}">${f[1]}</button>`).join('')}</div><div class="order-list">${orders.map(orderRowHtml).join('')||'<p class="muted empty-state">سفارشی در این بخش نیست.</p>'}</div>`}
function orderRowHtml(o){const paid=Number(o.wallet_amount||0)>0?` · کیف پول ${fmt(o.wallet_amount)}`:'';return `<article class="order-row" data-order-open="${o.id}"><div class="order-row-main"><div class="order-icon">${o.image_url?`<img src="${esc(o.image_url)}">`:'🧾'}</div><div><h3>#${nf(o.id)} · ${esc(o.display_name)}</h3><p class="muted">${esc(o.created_at||'')} · مانده ${fmt(o.final_amount)}${paid}</p></div></div>${orderStatusBadge(o)}<span class="chev">‹</span></article>`}
function paymentMethodsHtml(o){
  const methods=state.payment_methods||{wallet:{enabled:true},card:{enabled:true,accounts:[],instructions:state.payment_instructions||''},stars:{enabled:false,rate_toman:3200},crypto:{enabled:false,wallets:[],markup_percent:1}};
  if(!['pending_payment','rejected'].includes(o.status)||Number(o.final_amount||0)<=0)return '';
  const bal=Number(state.user?.balance||0);
  let html=`<article class="payment-box"><div class="section-title compact"><h3>💳 روش پرداخت</h3><span class="badge">${esc(o.payment_method_fa||'انتخاب نشده')}</span></div><div class="payment-grid">`;
  if(methods.wallet?.enabled) html+=`<button class="pay-method success" data-wallet-order="${o.id}"><b>💰 کیف پول</b><span>موجودی: ${fmt(bal)}</span></button>`;
  if(methods.card?.enabled) html+=`<button class="pay-method" data-select-card="${o.id}"><b>💳 کارت به کارت</b><span>پرداخت دستی با رسید</span></button>`;
  if(methods.stars?.enabled) html+=`<button class="pay-method warning" data-pay-stars="${o.id}"><b>⭐ Telegram Stars</b><span>${nf(Math.max(1,Math.ceil(Number(o.final_amount||0)/Number(methods.stars?.rate_toman||3200))))} استار</span></button>`;
  if(methods.crypto?.enabled) html+=`<button class="pay-method crypto" data-show-crypto="${o.id}"><b>🪙 رمزارز</b><span>USDT / TRX / TON با TXID</span></button>`;
  if(!methods.wallet?.enabled && !methods.card?.enabled && !methods.stars?.enabled && !methods.crypto?.enabled) html+=`<p class="muted empty-state">فعلاً هیچ روش پرداختی فعال نیست. لطفاً به پشتیبانی پیام بده.</p>`;
  html+=`</div>`;
  if(o.payment_method==='card'&&methods.card?.accounts?.length){
    html+=`<div class="card-pay-list"><p class="muted">یکی از کارت‌های زیر را کپی کن، پرداخت را انجام بده و رسید را ارسال کن.</p>`+methods.card.accounts.map(c=>`<div class="pay-card"><div><b>${esc(c.title||'کارت')}</b><small>${esc(c.owner||'')}</small></div><button class="secondary" data-copy="${esc(c.card||'')}">کپی کارت</button><code>${esc(c.card||'')}</code>${c.sheba?`<small>شبا: ${esc(c.sheba)}</small>`:''}</div>`).join('')+`</div>`;
  }
  const cryptoWallets=methods.crypto?.wallets||[];
  const cryptoCheck=o.crypto_check||null;
  if(methods.crypto?.enabled && (o.payment_method==='crypto' || cryptoWallets.length)){
    html+=`<div class="crypto-pay-panel"><h4>🪙 پرداخت رمزارز</h4>`;
    if(o.payment_method!=='crypto'){
      html+=`<p class="muted">کیف پول موردنظر را انتخاب کن.</p><div class="crypto-wallet-grid">`+cryptoWallets.map(w=>{const rate=Number(w.rate_toman||0);const markup=Number(methods.crypto?.markup_percent||0)/100;const amount=rate>0?((Number(o.final_amount||0)/rate)*(1+markup)).toFixed(6):null;return `<button class="crypto-wallet" data-select-crypto="${o.id}:${w.id}"><b>${esc(w.title||w.asset)}</b><span>${esc(w.network)} · ${esc(w.asset)}</span><em>${amount?`${amount} ${esc(w.asset)}`:'نرخ دستی لازم است'}</em><small>${rate?`نرخ: ${nf(rate)} تومان${w.rate_updated_at?' · '+esc(w.rate_updated_at):''}`:''}</small></button>`}).join('')+`</div>`;
    } else if(cryptoCheck){
      const amountText=Number(cryptoCheck.expected_amount||0).toFixed(6)+' '+esc(cryptoCheck.asset);
      html+=`<div class="crypto-invoice live">${orderUsdHint(o)}<div class="full warning-box"><b>مبلغ دقیق پرداخت</b><p>دقیقاً <b>${amountText}</b> باید به ولت زیر برسد. کارمزد صرافی/شبکه بر عهده شماست و نباید از این مبلغ کم شود.</p><button class="secondary" data-copy="${Number(cryptoCheck.expected_amount||0).toFixed(6)}">کپی مبلغ</button></div><div><small>شبکه / ارز</small><b>${esc(cryptoCheck.network)} / ${esc(cryptoCheck.asset)}</b></div><div><small>نرخ مبنا</small><b>${cryptoCheck.rate_toman?nf(cryptoCheck.rate_toman)+' تومان':'-'}</b></div><div class="full"><small>آدرس ولت</small><code>${esc(cryptoCheck.address)}</code><button class="secondary" data-copy="${esc(cryptoCheck.address)}">کپی ولت</button></div>${cryptoCheck.tx_hash?`<div class="full"><small>TXID</small><code>${esc(cryptoCheck.tx_hash)}</code></div>`:''}<div class="full"><small>وضعیت بررسی</small><b>${cryptoCheck.status==='confirmed'?'✅ تایید شده':cryptoCheck.status==='pending'?'در حال بررسی':'در انتظار هش'}</b>${cryptoCheck.fail_reason?`<p class="muted">${esc(cryptoCheck.fail_reason)}</p>`:''}</div></div><div class="actions"><button class="primary" data-crypto-hash="${o.id}">ثبت TXID / Hash</button><button class="secondary" data-check-crypto="${o.id}">بررسی دوباره</button></div>`;
    }
    html+=`</div>`;
  }
  html+=`</article>`;
  return html;
}

function orderDetailHtml(o){const bal=Number(state.user?.balance||0);return `<section class="detail-card order-detail-page"><button class="secondary" data-order-back>بازگشت به سفارش‌ها</button><div class="order-detail-head"><div><small>سفارش #${nf(o.id)}</small><h2>${esc(o.display_name)}</h2></div>${orderStatusBadge(o)}</div>${orderStepperHtml(o)}<div class="price-panel"><span>مانده قابل پرداخت</span><b>${fmt(o.final_amount)}</b></div>${o.payment_method==='crypto'?orderUsdHint(o):''}<div class="order-money-grid"><p><b>قیمت اصلی</b><br>${fmt(o.amount)}</p><p><b>تخفیف</b><br>${fmt(o.discount_amount||0)}</p><p><b>پرداخت از کیف پول</b><br>${fmt(o.wallet_amount||0)}</p></div><div class="order-info-grid"><p><b>روش پرداخت</b><br>${esc(o.payment_method_fa||'انتخاب نشده')}</p><p><b>نوع تحویل</b><br>${esc(o.delivery_type_fa||'-')}</p><p><b>تاریخ ثبت</b><br>${esc(o.created_at||'-')}</p>${o.expires_at?`<p><b>انقضا</b><br>${esc(o.expires_at)}</p>`:''}</div>${paymentMethodsHtml(o)}${o.timeline?.length?`<details class="timeline-details"><summary>🗓 تاریخچه کامل سفارش</summary>${timeline(o.timeline)}</details>`:''}${o.payment_note?`<div class="note-box"><b>رسید/توضیح پرداخت:</b><br>${textBlock(o.payment_note)}</div>`:''}${o.customer_note?`<div class="note-box customer"><b>یادداشت شما:</b><br>${textBlock(o.customer_note)}</div>`:''}${o.delivery_text?`<div class="delivery-box clean-delivery">${textBlock(o.delivery_text)}</div>`:''}<div class="actions sticky-actions">${(o.status==='pending_payment'||o.status==='rejected')&&Number(o.final_amount||0)>0?`<button class="primary" data-receipt="${o.id}">ارسال رسید</button>`:''}<button class="secondary" data-customer-note="${o.id}">یادداشت سفارش</button>${o.status==='pending_payment'?`<button class="secondary" data-coupon="${o.id}">کد تخفیف</button><button class="danger" data-cancel="${o.id}">لغو</button>`:''}${canHideOrder(o)?`<button class="danger" data-hide-order="${o.id}">حذف از لیست من</button>`:''}</div></section>`}

function wheelGradient(rewards=[]){const colors=['#1d9bf0','#22c55e','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#ef4444','#84cc16'];const list=rewards.length?rewards:[{title:'جایزه'}];const step=100/list.length;return `conic-gradient(${list.map((_,i)=>`${colors[i%colors.length]} ${i*step}% ${(i+1)*step}%`).join(',')})`}
function wheelPrizeList(rewards=[]){return (rewards||[]).slice(0,8).map(r=>`<div class="wheel-prize"><b>${esc(r.title||'جایزه')}</b><br><span>${Number(r.amount||0)>0?fmt(r.amount):'جایزه دستی'}</span></div>`).join('') || '<p class="muted">جایزه‌ای تعریف نشده.</p>'}
function renderSpinWheel(){const rewards=state.spin_rewards||[];const chances=Number(state.user?.spin_balance||0);return `<article class="wallet-card spin-section spin-section-v2"><div class="spin-head"><div class="spin-head-icon">🎡</div><div class="spin-head-text"><small>گردونه شانس روزانه</small><h3>بچرخون، ببر!</h3></div><div class="spin-chances-badge"><b>${nf(chances)}</b><span>شانس</span></div></div><p class="muted spin-desc">برای هر ${nf(state.spin_every||5)} زیرمجموعه جدید، یک شانس چرخوندن می‌گیری. جایزه‌ها خودکار به کیف پولت اضافه می‌شه.</p><div class="wheel-stage"><div class="wheel-pointer-v2">▼</div><div class="wheel-glow"></div><div id="spinWheel" class="spin-wheel spin-wheel-v2" style="background:${wheelGradient(rewards)}"><div class="wheel-center wheel-center-v2"><span>SPIN</span></div></div></div><button id="spinBtn" class="primary spin-btn-v2" ${chances<=0?'disabled':''}>${chances>0?'🎡 چرخوندن گردونه':'فعلاً شانسی نداری'}</button><div id="spinResult" class="spin-result ${lastSpinPrize?'':'hidden'}">${lastSpinPrize?`🎉 جایزه آخر شما: <b>${esc(lastSpinPrize.title||'جایزه گردونه')}</b>${Number(lastSpinPrize.amount||0)>0?`<br>به کیف پول اضافه شد: <b>${fmt(lastSpinPrize.amount)}</b>`:''}`:''}</div><div class="wheel-prizes">${wheelPrizeList(rewards)}</div></article>`}
async function doSpinWheel(){const btn=$('spinBtn'), wheel=$('spinWheel'), result=$('spinResult');if(!btn||btn.disabled)return;btn.disabled=true;btn.textContent='در حال چرخش...';if(result)result.classList.add('hidden');const rewards=state.spin_rewards||[];const count=Math.max(1,rewards.length);const start=Number(wheel?.dataset.rot||0);const fakeIndex=Math.floor(Math.random()*count);const degPer=360/count;const target=start + 1440 + (360 - (fakeIndex*degPer + degPer/2));if(wheel){wheel.dataset.rot=String(target);wheel.style.transform=`rotate(${target}deg)`;}try{await new Promise(r=>setTimeout(r,1800));const data=await api('spin');const prize=data.prize||{};state=data;applyTheme(state);const idx=Number(prize.index ?? fakeIndex);const finalRot=start + 2160 + (360 - (idx*degPer + degPer/2));if(wheel){wheel.dataset.rot=String(finalRot);wheel.style.transform=`rotate(${finalRot}deg)`;}await new Promise(r=>setTimeout(r,2400));lastSpinPrize=prize;if(result){result.innerHTML=`🎉 جایزه شما: <b>${esc(prize.title||'جایزه گردونه')}</b>${Number(prize.amount||0)>0?`<br>به کیف پول اضافه شد: <b>${fmt(prize.amount)}</b>`:''}`;result.classList.remove('hidden')}showStatus('جایزه گردونه ثبت شد');renderWallet()}catch(e){showStatus(e.message||'خطا در گردونه','error');btn.disabled=false;btn.textContent='چرخاندن گردونه'}}

function renderWallet(){const u=state.user;const today=Number(u.today_referrals||0);$('walletPage').innerHTML=`<section class="wallet-dashboard"><div class="wallet-card-main"><small>موجودی قابل خرج در فروشگاه</small><strong data-count-anim="${u.balance}">${fmt(u.balance)}</strong><p>این موجودی برای کم‌کردن مبلغ سفارش‌های فروشگاه استفاده می‌شود.</p></div><div class="wallet-mini-grid"><div><b>${fmt(u.total_earned)}</b><span>کل درآمد</span></div><div><b>${nf(u.referrals_count)}</b><span>دعوت موفق</span></div><div><b>${nf(u.spin_balance)}</b><span>شانس گردونه</span></div><div><b>${fmt(u.total_earned)}</b><span>کل کسب</span></div></div></section>${vipProgressHtml()}<article class="wallet-card referral-card"><div class="referral-card-head"><span class="referral-icon">🔗</span><div><h3>دعوت دوستان، درآمد بساز</h3><p class="muted">لینک اختصاصی خودت را با دوستان به اشتراک بذار. هر کس با این لینک وارد بات بشه و عضو بشه، خودکار به زیرمجموعه‌های تو اضافه می‌شه و پاداش دعوت به کیف پولت واریز می‌شه. هرچه دعوت بیشتر، درآمد بیشتر!</p></div></div><div class="actions"><button class="secondary" id="copyLink">📋 کپی لینک دعوت</button><button class="secondary" id="openQrWallet">📱 کد QR</button></div></article><div id="referralTreePlaceholder"><article class="wallet-card referral-tree-card"><div class="referral-tree-head"><span class="admin-card-icon">🌳</span><div><h3>درخت دعوت</h3><p class="muted">در حال بارگذاری...</p></div></div></article></div>${renderSpinWheel()}<article class="wallet-card missions-panel"><div class="section-title"><h2>🎯 ماموریت‌های امروز</h2><small>${nf(today)} دعوت امروز</small></div><div class="missions-grid">${(state.missions||[]).map(missionCard).join('')||'<p class="muted">مأموریتی نیست.</p>'}</div><button class="success" id="claimBtn">دریافت پاداش‌های آماده</button></article><article class="wallet-card"><h3>تراکنش‌های اخیر</h3><div class="tx-list">${(state.transactions||[]).map(t=>`<div class="tx-row"><span>${esc(t.description||t.type)}</span><b class="${Number(t.amount)<0?'negative':'positive'}">${fmt(t.amount)}</b><small>${esc(t.created_at)}</small></div>`).join('')||'<p class="muted">تراکنشی نیست.</p>'}</div></article>`;triggerBalanceAnims();loadReferralTree().then(refs=>{const ph=$('referralTreePlaceholder');if(ph)ph.innerHTML=referralTreeHtml(refs)})}
async function reload(){state=await api('me');applyTheme(state);renderUser()}
function showFatalPanel(message){
  const html=`<section class="hero error-panel"><h2>⚠️ خطا</h2><p class="muted">${esc(message||'خطا در بارگذاری')}</p><button class="primary" id="reloadAdmin">تلاش دوباره</button></section>`;
  if(isAdminMode){$('userApp').classList.add('hidden');$('adminApp').classList.remove('hidden');$('adminContent').innerHTML=html;}
  else {$('userApp').classList.remove('hidden');$('adminApp').classList.add('hidden');$('homePage').innerHTML=html;}
}
async function load(){
  if(!initData){
    // Try to auto-inject dev shim for local testing if available
    try{
      if(!location.search.includes('dev=1')){
        const s=document.createElement('script');s.src='dev.init.js';s.async=false;document.head.appendChild(s);
        // wait briefly for dev.init to run
        await new Promise(r=>setTimeout(r,120));
      }
    }catch(e){}
    if(!tg?.initData && !tg?.initDataUnsafe){
      showFatalPanel('Mini App باید داخل تلگرام باز شود.');showStatus('Mini App باید داخل تلگرام باز شود.','error');return
    }
  }
  try{
    if(isAdminMode){$('userApp').classList.add('hidden');$('adminApp').classList.remove('hidden');await loadAdmin();return}
    render(await api('me'))
  }catch(e){showFatalPanel(e.message);showStatus(e.message,'error')}
}
async function loadAdmin(){try{adminState=await api('admin_summary');applyTheme(adminState.settings||{});renderAdmin()}catch(e){showFatalPanel(e.message);showStatus(e.message,'error')}}
function renderAdmin(){const r=adminState.report||{};$('adminStats').innerHTML=`<div class="mini-stat admin-stat-card"><b>${nf(r.today?.c||0)}</b><span>سفارش امروز<br>${fmt(r.today?.s||0)}</span></div><div class="mini-stat admin-stat-card"><b>${nf(r.month?.c||0)}</b><span>سفارش ماه<br>${fmt(r.month?.s||0)}</span></div><div class="mini-stat admin-stat-card"><b>${nf(r.pending||0)}</b><span>نیازمند اقدام</span></div>`;document.querySelectorAll('[data-admin-tab]').forEach(b=>b.classList.toggle('active',b.dataset.adminTab===currentAdminTab));const fn={dashboard:renderAdminDashboard,products:renderAdminProducts,categories:renderAdminCategories,variants:renderAdminVariants,inventory:renderAdminInventory,orders:renderAdminOrders,withdrawals:renderAdminWithdrawals,coupons:renderAdminCoupons,activity:renderAdminActivity,roles:renderAdminRoles,settings:renderAdminSettings,backups:renderAdminBackups}[currentAdminTab];const content=$('adminContent');content.classList.remove('admin-content-enter');void content.offsetWidth;content.innerHTML=fn?fn():'';content.classList.add('admin-content-enter');requestAnimationFrame(()=>{content.querySelectorAll('.admin-card, .admin-item, .accordion-card, .no-variant-row').forEach((el,i)=>{el.style.setProperty('--stagger-i',i);el.classList.add('stagger-in')})});setTimeout(()=>{if(currentAdminTab==='settings')initSettingsUi();attachLongPress()},0)}
function catOptions(selected=''){return `<option value="">بدون دسته</option>`+(adminState.categories||[]).map(c=>`<option value="${c.id}" ${Number(selected)===Number(c.id)?'selected':''}>${esc(c.emoji||'🛒')} ${esc(c.title)}</option>`).join('')}
function productOptions(selected=''){return (adminState.products||[]).map(p=>`<option value="${p.id}" ${Number(selected)===Number(p.id)?'selected':''}>#${p.id} ${esc(p.name)}</option>`).join('')}
function variantOptions(selected='', productId=null){return `<option value="">بدون پلن</option>`+(adminState.variants||[]).filter(v=>!productId||Number(v.product_id)===Number(productId)).map(v=>`<option value="${v.id}" ${Number(selected)===Number(v.id)?'selected':''}>#${v.id} ${esc(v.product_name)} - ${esc(v.title)}</option>`).join('')}
function renderAdminDashboard(){const top=adminState.report?.top||[];const productCount=(adminState.products||[]).length;const variantCount=(adminState.variants||[]).length;const orderCount=(adminState.orders||[]).length;const inventoryCount=(adminState.inventory||[]).length;const orders=adminState.orders||[];const rev7=last7DaysRevenue(orders);const total7=rev7.reduce((s,d)=>s+d.rev,0);const lowStock=(adminState.products||[]).filter(p=>Number(p.inventory_available||0)<3&&Number(p.is_active)).sort((a,b)=>Number(a.inventory_available||0)-Number(b.inventory_available||0));return `<article class="admin-card dashboard-hero"><div class="admin-card-head"><span class="admin-card-icon">📊</span><div><h3>داشبورد فروش</h3><p class="muted">مرور سریع وضعیت فروشگاه و دسترسی به همه بخش‌ها.</p></div></div><div class="dashboard-quick-stats"><div class="dq-stat"><b>${nf(productCount)}</b><span>محصول</span></div><div class="dq-stat"><b>${nf(variantCount)}</b><span>پلن</span></div><div class="dq-stat"><b>${nf(orderCount)}</b><span>سفارش</span></div><div class="dq-stat"><b>${nf(inventoryCount)}</b><span>آیتم انبار</span></div></div><div class="dashboard-quick-actions"><button class="quick-action" data-admin-tab="products"><span>🛒</span><b>محصولات</b></button><button class="quick-action" data-admin-tab="variants"><span>📐</span><b>پلن‌ها</b></button><button class="quick-action" data-admin-tab="orders"><span>🧾</span><b>سفارش‌ها</b></button><button class="quick-action" data-admin-tab="inventory"><span>📦</span><b>انبار</b></button><button class="quick-action" data-admin-tab="settings"><span>⚙️</span><b>تنظیمات</b></button><button class="quick-action" data-admin-tab="backups"><span>💾</span><b>بکاپ</b></button></div></article>${lowStock.length?`<article class="admin-card alert-card"><div class="admin-card-head"><span class="admin-card-icon">⚠️</span><div><h3>موجودی کم</h3><p class="muted">${nf(lowStock.length)} محصول کمتر از ۳ آیتم در انبار دارند.</p></div></div><div class="low-stock-list">${lowStock.slice(0,5).map(p=>`<div class="low-stock-row" data-admin-tab="inventory"><div><b>${esc(p.name)}</b><span class="muted">موجودی: ${nf(p.inventory_available||0)} آیتم</span></div><span class="chip-mini chip-${Number(p.inventory_available||0)===0?'off':'featured'}">${Number(p.inventory_available||0)===0?'ناموجود':'کم'}</span></div>`).join('')}</div>${lowStock.length>5?`<button class="secondary wide" data-admin-tab="inventory" style="margin-top:10px">مشاهده همه در انبار</button>`:''}</article>`:''}<article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">📈</span><div><h3>درآمد ۷ روز اخیر</h3><p class="muted">مجموع: ${fmt(total7)} تومان</p></div></div>${sparklineHtml(rev7)}</article>${(adminState.forecast&&adminState.forecast.forecast)?`<article class="admin-card forecast-card"><div class="admin-card-head"><span class="admin-card-icon">🔮</span><div><h3>پیش‌بینی ماه آینده</h3><p class="muted">بر اساس میانگین ۳۰ روز اخیر</p></div></div><div class="forecast-grid"><div class="forecast-main"><b>${fmt(adminState.forecast.forecast)}</b><span>تومان پیش‌بینی</span></div><div class="forecast-side"><span class="chip-mini chip-${adminState.forecast.change_percent>=0?'active':'off'}">${adminState.forecast.change_percent>=0?'▲':'▼'} ${nf(Math.abs(adminState.forecast.change_percent))}٪</span><small>نسبت به ماه قبل</small></div></div><p class="muted">میانگین روزانه: ${fmt(adminState.forecast.daily_avg)} تومان · ۳۰ روز اخیر: ${nf(adminState.forecast.last30_count)} سفارش</p></article>`:''}<div class="admin-charts-grid"><article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">🏆</span><div><h3>پرفروش‌ترین‌ها</h3><p class="muted">بر اساس تعداد سفارش</p></div></div>${top.length?barChartHtml(top):'<p class="muted empty-state">داده‌ای نیست.</p>'}</article><article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">🥧</span><div><h3>روش‌های پرداخت</h3><p class="muted">توزیع ${nf(orderCount)} سفارش</p></div></div>${pieChartHtml(orders)}</article></div>`}
function renderAdminProducts(){const prods=adminState.products||[];return `<article class="admin-card admin-add-card"><div class="admin-card-head"><span class="admin-card-icon">➕</span><div><h3>افزودن محصول جدید</h3><p class="muted">محصولات زیر ساخته‌ای و پلن‌های قیمت‌گذاری را از تب «پلن‌ها» اضافه کن.</p></div></div><div class="form-grid"><input id="ap_name" placeholder="نام محصول">${priceAdminFields('ap')}<select id="ap_cat">${catOptions()}</select><select id="ap_delivery"><option value="manual">دستی</option><option value="account">اکانت</option><option value="vpn">VPN / لینک ساب</option><option value="code">کد</option><option value="file">فایل/متن</option></select><select id="ap_commission_type"><option value="none">بدون پورسانت</option><option value="fixed">مبلغ ثابت</option><option value="percent">درصدی</option></select><input id="ap_commission_value" placeholder="مقدار پورسانت"><input id="ap_img" placeholder="لینک عکس محصول"><input id="ap_duration" placeholder="مدت روز"><label class="switch-line liquid-toggle">ویژه باشد؟ <input id="ap_featured" type="checkbox"></label><input id="ap_flash_discount" inputmode="numeric" placeholder="٪ تخفیف فلش (۰=خاموش)"><input id="ap_flash_start" type="datetime-local"><input id="ap_flash_end" type="datetime-local"><textarea id="ap_short" placeholder="توضیح کوتاه"></textarea><textarea id="ap_full" placeholder="توضیح کامل"></textarea><button class="primary" data-admin-add-product>ثبت محصول</button></div></article><article class="admin-card csv-export-card"><div class="admin-card-head"><span class="admin-card-icon">📊</span><div><h3>خروجی CSV</h3><p class="muted">دانلود لیست محصولات به صورت فایل اکسل.</p></div></div><button class="secondary" data-export-products-csv>📥 دانلود CSV محصولات</button></article>`+prods.map((p,i)=>`<div class="admin-item product-list-item"><div class="admin-item-head"><div class="reorder-btns"><button class="ghost reorder-btn" data-reorder="product:${p.id}:up" ${i===0?'disabled':''}>▲</button><button class="ghost reorder-btn" data-reorder="product:${p.id}:down" ${i===prods.length-1?'disabled':''}>▼</button></div><div class="admin-item-thumb">${p.image_url?`<img src="${esc(p.image_url)}" alt="">`:'<span>🛒</span>'}</div><div class="admin-item-main"><h4>${esc(p.name)} <span class="admin-id-badge">#${nf(p.id)}</span></h4><p class="muted">${priceAdminSummary(p)} · ${Number(p.is_active)?'<span class="chip-mini chip-active">فعال</span>':'<span class="chip-mini chip-off">غیرفعال</span>'} ${Number(p.is_featured)?'<span class="chip-mini chip-featured">ویژه</span>':''} ${flashSaleActive(p)?'<span class="chip-mini chip-count">⚡ فلش</span>':''} · موجودی: ${nf(p.inventory_available||0)}</p></div></div><div class="admin-actions"><button data-edit-product="${p.id}">ویرایش کامل</button><button data-admin-toggle-product="${p.id}">${Number(p.is_active)?'غیرفعال':'فعال'}</button><button class="danger" data-admin-delete-product="${p.id}">غیرفعال‌سازی</button><button class="danger" data-admin-hard-delete-product="${p.id}">حذف کامل</button></div></div>`).join('')}
function renderAdminCategories(){const cats=adminState.categories||[];return `<article class="admin-card admin-add-card"><div class="admin-card-head"><span class="admin-card-icon">➕</span><div><h3>افزودن دسته جدید</h3><p class="muted">دسته‌ها به کاربر کمک می‌کنند محصول موردنظرش را سریع‌تر پیدا کند.</p></div></div><div class="form-grid"><input id="ac_title" placeholder="نام دسته"><input id="ac_emoji" placeholder="اموجی"><input id="ac_img" placeholder="لینک عکس دسته"><input id="ac_sort" placeholder="ترتیب نمایش"><button class="primary" data-admin-add-category>ثبت دسته</button></div></article>`+cats.map((c,i)=>`<div class="admin-item category-list-item"><div class="admin-item-head"><div class="reorder-btns"><button class="ghost reorder-btn" data-reorder="category:${c.id}:up" ${i===0?'disabled':''}>▲</button><button class="ghost reorder-btn" data-reorder="category:${c.id}:down" ${i===cats.length-1?'disabled':''}>▼</button></div><div class="admin-item-thumb emoji-thumb"><span>${esc(c.emoji||'🛒')}</span></div><div class="admin-item-main"><h4>${esc(c.title)} <span class="admin-id-badge">#${nf(c.id)}</span></h4><p class="muted">${Number(c.is_active)?'<span class="chip-mini chip-active">فعال</span>':'<span class="chip-mini chip-off">غیرفعال</span>'} · ترتیب: ${nf(c.sort_order)}</p></div></div><div class="admin-actions"><button data-edit-category="${c.id}">ویرایش</button><button class="danger" data-admin-delete-category="${c.id}">غیرفعال‌سازی</button><button class="danger" data-admin-hard-delete-category="${c.id}">حذف کامل</button></div></div>`).join('')}
let variantExpandedProducts = new Set();
function toggleVariantProduct(pid){pid=Number(pid);if(variantExpandedProducts.has(pid))variantExpandedProducts.delete(pid);else variantExpandedProducts.add(pid);renderAdmin()}
function renderAdminVariants(){
  const addForm = `<article class="admin-card admin-add-card"><div class="admin-card-head"><span class="admin-card-icon">➕</span><div><h3>افزودن پلن جدید</h3><p class="muted">برای هر محصول می‌توانی چند پلن با قیمت و مدت متفاوت بسازی.</p></div></div><div class="form-grid"><select id="av_product">${productOptions()}</select><input id="av_title" placeholder="نام پلن">${priceAdminFields('av')}<input id="av_duration" placeholder="مدت روز"><input id="av_sort" placeholder="ترتیب"><button class="primary" data-admin-add-variant>ثبت پلن</button></div></article>`;
  const allVariants = adminState.variants || [];
  const allProducts = adminState.products || [];
  if(!allVariants.length && !allProducts.length){
    return addForm + `<article class="admin-card empty-state-card"><div class="empty-illustration">📦</div><h3>هنوز محصولی نساخته‌ای</h3><p class="muted">اول از تب «محصولات» یک محصول بساز، بعد اینجا برایش پلن اضافه کن.</p></article>`;
  }
  // Group variants by product_id
  const byProduct = new Map();
  for(const v of allVariants){
    const pid = Number(v.product_id);
    if(!byProduct.has(pid)) byProduct.set(pid, []);
    byProduct.get(pid).push(v);
  }
  // Build list: products that have variants first (sorted by variant count desc), then products without variants
  const productsWithVariants = allProducts.filter(p => byProduct.has(Number(p.id)))
    .sort((a,b) => (byProduct.get(Number(b.id)).length) - (byProduct.get(Number(a.id)).length));
  const productsWithoutVariants = allProducts.filter(p => !byProduct.has(Number(p.id)) && Number(p.is_active));
  // Orphan variants (product deleted) — show in a separate section
  const orphanPids = [...byProduct.keys()].filter(pid => !allProducts.some(p => Number(p.id) === pid));
  const orphanVariants = orphanPids.flatMap(pid => byProduct.get(pid).map(v => ({...v, _orphan: true})));
  let accordionHtml = '';
  if(productsWithVariants.length){
    accordionHtml += `<div class="admin-accordion-group" data-accordion-group>`;
    for(const p of productsWithVariants){
      const pid = Number(p.id);
      const variants = byProduct.get(pid);
      const activeCount = variants.filter(v => Number(v.is_active)).length;
      const totalDuration = variants.reduce((s,v) => s + (Number(v.duration_days)||0), 0);
      const expanded = variantExpandedProducts.has(pid);
      const minPrice = variants.reduce((m,v) => Math.min(m, Number(v.price)||0), Infinity);
      const maxPrice = variants.reduce((m,v) => Math.max(m, Number(v.price)||0), 0);
      const priceRange = minPrice === Infinity ? '—' : (minPrice === maxPrice ? fmt(minPrice) : `${fmt(minPrice)} – ${fmt(maxPrice)}`);
      accordionHtml += `<article class="accordion-card ${expanded?'expanded':''}" data-accordion="${pid}">
        <header class="accordion-header" data-accordion-toggle="${pid}">
          <div class="accordion-product-info">
            <div class="accordion-product-thumb">${p.image_url?`<img src="${esc(p.image_url)}" alt="">`:`<span>${esc(p.emoji||(p.category_emoji||'📦'))}</span>`}</div>
            <div class="accordion-product-meta">
              <h4>${esc(p.name)}</h4>
              <p class="muted">
                <span class="chip-mini chip-count">${nf(variants.length)} پلن</span>
                <span class="chip-mini chip-active">${nf(activeCount)} فعال</span>
                <span class="chip-mini chip-price">${priceRange}</span>
                ${!Number(p.is_active)?'<span class="chip-mini chip-off">غیرفعال</span>':''}
              </p>
            </div>
          </div>
          <span class="accordion-chevron" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </span>
        </header>
        <div class="accordion-body">
          <div class="accordion-body-inner">
            ${variants.map(v => variantItemHtml(v)).join('')}
            <button class="secondary accordion-add-inline" data-accordion-add-variant="${pid}">➕ افزودن پلن برای ${esc(p.name)}</button>
          </div>
        </div>
      </article>`;
    }
    accordionHtml += `</div>`;
  }
  if(productsWithoutVariants.length){
    accordionHtml += `<article class="admin-card no-variants-card">
      <div class="admin-card-head"><span class="admin-card-icon">💤</span><div><h3>محصولات بدون پلن</h3><p class="muted">این محصولات هنوز پلن قیمت‌گذاری ندارند. روی دکمه بزن تا مستقیم پلن اضافه کنی.</p></div></div>
      <div class="no-variants-list">
        ${productsWithoutVariants.map(p => `<div class="no-variant-row"><div><b>${esc(p.name)}</b><span class="muted">${priceAdminSummary(p)}</span></div><button class="secondary" data-accordion-add-variant="${p.id}">➕ افزودن پلن</button></div>`).join('')}
      </div>
    </article>`;
  }
  if(orphanVariants.length){
    accordionHtml += `<article class="admin-card warning-card">
      <div class="admin-card-head"><span class="admin-card-icon">⚠️</span><div><h3>پلن‌های یتیم</h3><p class="muted">محصول این پلن‌ها حذف شده. می‌توانید آن‌ها را به محصول دیگری منتقل یا حذف کنید.</p></div></div>
      ${orphanVariants.map(v => variantItemHtml(v)).join('')}
    </article>`;
  }
  return addForm + accordionHtml;
}
function variantItemHtml(v){
  return `<div class="admin-item variant-item">
    <div class="variant-item-head">
      <div class="variant-item-title"><b>${esc(v.title)}</b><span class="variant-id-badge">#${nf(v.id)}</span></div>
      <div class="variant-item-meta">${priceAdminSummary(v)} · ${Number(v.is_active)?'<span class="chip-mini chip-active">فعال</span>':'<span class="chip-mini chip-off">غیرفعال</span>'} · مدت: ${nf(v.duration_days)} روز</div>
    </div>
    <div class="admin-actions"><button data-edit-variant="${v.id}">ویرایش</button><button class="danger" data-admin-delete-variant="${v.id}">غیرفعال‌سازی</button><button class="danger" data-admin-hard-delete-variant="${v.id}">حذف کامل</button></div>
  </div>`;
}
function renderAdminInventory(){return `<article class="admin-card"><h3>➕ افزودن انبار</h3><div class="form-grid"><select id="ai_product">${productOptions()}</select><select id="ai_variant">${variantOptions()}</select><textarea id="ai_content" placeholder="هر آیتم یک خط؛ ایمیل/پسورد، لینک ساب، کد یا متن آماده"></textarea><button class="primary" data-admin-add-inventory>ثبت انبار</button></div></article>`+(adminState.inventory||[]).map(i=>`<div class="admin-item"><h4>#${i.id} ${esc(i.product_name)} ${i.variant_title?' / '+esc(i.variant_title):''}</h4><p class="muted">وضعیت: ${esc(i.status)} | ${esc(String(i.content).slice(0,80))}</p><div class="admin-actions"><button data-edit-inventory="${i.id}">ویرایش کامل</button><button class="danger" data-admin-delete-inventory="${i.id}">حذف امن</button><button class="danger" data-admin-hard-delete-inventory="${i.id}">حذف کامل</button></div></div>`).join('')}
function renderAdminOrders(){const c=adminState.cleanup||{};return `<article class="admin-card csv-export-card"><div class="admin-card-head"><span class="admin-card-icon">📊</span><div><h3>خروجی CSV</h3><p class="muted">دانلود لیست ${(adminState.orders||[]).length} سفارش به صورت فایل اکسل.</p></div></div><button class="secondary" data-export-orders-csv>📥 دانلود CSV سفارش‌ها</button></article><article class="admin-card search-card"><div class="admin-card-head"><span class="admin-card-icon">🔍</span><div><h3>جستجوی پیشرفته</h3><p class="muted">جستجو با شماره سفارش، یوزرنیم، نام محصول یا ID تلگرام.</p></div></div><div class="form-grid"><input id="adminOrderSearchInput" placeholder="جستجو..." value="${esc(adminOrderSearch)}"><select id="adminOrderStatusSelect"><option value="all" ${adminOrderStatusFilter==='all'?'selected':''}>همه</option><option value="pending_payment" ${adminOrderStatusFilter==='pending_payment'?'selected':''}>در انتظار پرداخت</option><option value="receipt_submitted" ${adminOrderStatusFilter==='receipt_submitted'?'selected':''}>رسید ارسال شده</option><option value="reviewing" ${adminOrderStatusFilter==='reviewing'?'selected':''}>در بررسی</option><option value="payment_confirmed" ${adminOrderStatusFilter==='payment_confirmed'?'selected':''}>پرداخت تاییدشده</option><option value="preparing" ${adminOrderStatusFilter==='preparing'?'selected':''}>آماده‌سازی</option><option value="delivered" ${adminOrderStatusFilter==='delivered'?'selected':''}>تحویل‌شده</option><option value="rejected" ${adminOrderStatusFilter==='rejected'?'selected':''}>رد شده</option></select><button class="primary" id="adminOrderSearchBtn">جستجو</button><button class="secondary" id="adminOrderResetBtn">ریست</button></div></article>${selectedOrderIds.size?`<article class="admin-card bulk-action-bar"><div class="admin-card-head"><span class="admin-card-icon">☑️</span><div><h3>${nf(selectedOrderIds.size)} سفارش انتخاب شده</h3></div></div><div class="admin-actions"><button class="success" data-bulk-action="payment_confirmed">✅ تایید پرداخت</button><button class="warning" data-bulk-action="preparing">📦 آماده‌سازی</button><button class="danger" data-bulk-action="rejected">رد</button><button class="ghost" id="bulkClearBtn">لغو انتخاب</button></div></article>`:''}<article class="admin-card cleanup-card"><div class="admin-card-head"><span class="admin-card-icon">🧹</span><div><h3>پاکسازی سفارش‌ها</h3><p class="muted">فقط سفارش‌های لغو/رد/مرجوع قابل حذف کامل هستند.</p></div></div><div class="admin-actions"><button class="danger" data-admin-cleanup="all">حذف همه (${nf(c.all||0)})</button><button class="warning" data-admin-cleanup="7">حذف قدیمی‌تر از ۷ روز (${nf(c.older_7||0)})</button><button class="secondary" data-admin-cleanup="30">حذف قدیمی‌تر از ۳۰ روز (${nf(c.older_30||0)})</button></div></article>`+((adminState.orders||[]).map(o=>`<div class="admin-item order-admin-item"><div class="admin-item-head"><input type="checkbox" class="bulk-check" data-bulk-check="${o.id}" ${selectedOrderIds.has(Number(o.id))?'checked':''}><div class="admin-item-thumb">${o.image_url?`<img src="${esc(o.image_url)}" alt="">`:'<span>🧾</span>'}</div><div class="admin-item-main"><h4>#${nf(o.id)} ${esc(o.display_name)} <span class="admin-id-badge">${esc(o.status_fa||o.status)}</span></h4><p class="muted">${fmt(o.final_amount)} · ${esc(o.created_at||'')}${o.payment_method_fa?' · '+esc(o.payment_method_fa):''}${o.receipt_file_id?' · <span class="chip-mini chip-active">🖼 رسید عکس</span>':''}${o.username?' · @'+esc(o.username):''}</p></div></div><div class="admin-actions">${o.user_id?`<button class="secondary" data-customer-360="${o.user_id}">👤 پروفایل</button>`:''}${o.username?`<button class="ghost" data-chat-user="${esc(o.username)}">💬 پیام</button>`:''}<button data-admin-status="${o.id}:reviewing">در بررسی</button><button data-admin-status="${o.id}:payment_confirmed">تایید پرداخت</button><button data-admin-status="${o.id}:preparing">آماده‌سازی</button><button data-admin-deliver="${o.id}">تحویل</button><button class="danger" data-admin-status="${o.id}:rejected">رد</button><button class="secondary" data-admin-archive-order="${o.id}">آرشیو</button>${o.receipt_file_id?`<button class="secondary" data-view-receipt="${o.id}">🖼 دیدن رسید</button>`:''}${cleanupStatuses.includes(o.status)?`<button class="danger" data-admin-delete-order="${o.id}">حذف کامل</button>`:''}</div>${o.timeline?.length?`<details class="timeline-details"><summary>🗓 تاریخچه</summary>${timeline(o.timeline)}</details>`:''}</div>`).join('')||'<p class="muted">سفارشی نیست.</p>')}
function renderAdminWithdrawals(){const w=adminState.withdrawals||[];const pending=w.filter(x=>x.status==='pending');const paid=w.filter(x=>x.status==='paid');const rejected=w.filter(x=>x.status==='rejected');const totalPending=pending.reduce((s,x)=>s+Number(x.amount||0),0);return `<article class="admin-card dashboard-hero"><div class="admin-card-head"><span class="admin-card-icon">🏧</span><div><h3>صف برداشت‌ها</h3><p class="muted">${nf(pending.length)} در انتظار · مجموع ${fmt(totalPending)} تومان</p></div></div><div class="dashboard-quick-stats"><div class="dq-stat"><b>${nf(pending.length)}</b><span>در انتظار</span></div><div class="dq-stat"><b>${nf(paid.length)}</b><span>پرداخت‌شده</span></div><div class="dq-stat"><b>${nf(rejected.length)}</b><span>رد‌شده</span></div><div class="dq-stat"><b>${fmt(totalPending)}</b><span>مانده برداشت</span></div></div></article>${pending.length?`<article class="admin-card alert-card"><div class="admin-card-head"><span class="admin-card-icon">⏳</span><div><h3>نیازمند اقدام</h3><p class="muted">این برداشت‌ها منتظر تایید یا رد شما هستند.</p></div></div>${pending.map(x=>withdrawalRowHtml(x)).join('')}</article>`:''}<article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">📋</span><div><h3>همه برداشت‌ها</h3><p class="muted">${nf(w.length)} رکورد</p></div></div>${w.length?w.map(x=>withdrawalRowHtml(x)).join(''):'<p class="muted empty-state">هنوز برداشتی ثبت نشده.</p>'}</article>`}
function withdrawalRowHtml(w){const cls=w.status==='paid'?'active':w.status==='rejected'?'off':'featured';return `<div class="admin-item withdrawal-row"><div class="admin-item-head"><div class="admin-item-thumb emoji-thumb"><span>${w.status==='paid'?'✅':w.status==='rejected'?'❌':'⏳'}</span></div><div class="admin-item-main"><h4>${fmt(w.amount)} <span class="admin-id-badge">#${nf(w.id)}</span></h4><p class="muted">${esc(w.first_name||'')} ${w.username?'@'+esc(w.username):''} · ID: <code>${w.telegram_id}</code> · ${esc(w.created_at||'')}</p><p class="muted withdrawal-card-info">💳 ${esc(w.card_info||'')}</p></div></div><div class="admin-actions"><span class="chip-mini chip-${cls}">${esc(w.status==='paid'?'پرداخت‌شده':w.status==='rejected'?'رد‌شده':'در انتظار')}</span>${w.status==='pending'?`<button class="success" data-admin-withdraw="${w.id}:paid">✅ تایید و پرداخت</button><button class="danger" data-admin-withdraw="${w.id}:rejected">رد و برگشت</button>`:''}</div></div>`}
function renderAdminCoupons(){const c=adminState.coupons||[];return `<article class="admin-card admin-add-card"><div class="admin-card-head"><span class="admin-card-icon">➕</span><div><h3>افزودن کد تخفیف</h3><p class="muted">کد تخفیف درصدی یا مبلغ ثابت بساز.</p></div></div><div class="form-grid"><input id="acp_code" placeholder="کد (مثلاً BLUE10)"><select id="acp_type"><option value="percent">درصدی</option><option value="fixed">مبلغ ثابت</option></select><input id="acp_value" inputmode="numeric" placeholder="مقدار (٪ یا تومان)"><input id="acp_max" inputmode="numeric" placeholder="حداکثر استفاده (۰=نامحدود)"><input id="acp_expires" type="datetime-local" placeholder="انقضا"><button class="primary" data-admin-add-coupon>ثبت کد تخفیف</button></div></article><article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">🎟</span><div><h3>کدهای تخفیف</h3><p class="muted">${nf(c.length)} کد · ${nf(c.filter(x=>Number(x.is_active)).length)} فعال</p></div></div>${c.length?c.map(cp=>couponRowHtml(cp)).join(''):'<p class="muted empty-state">هنوز کد تخفیفی ساخته نشده.</p>'}</article>`}
function couponRowHtml(cp){const expired=cp.expires_at&&new Date(cp.expires_at)<new Date();const exhausted=Number(cp.max_uses)>0&&Number(cp.used_count)>=Number(cp.max_uses);const active=Number(cp.is_active)&&!expired&&!exhausted;return `<div class="admin-item coupon-row"><div class="admin-item-head"><div class="admin-item-thumb emoji-thumb"><span>${active?'🎟':expired?'⏰':'⏸'}</span></div><div class="admin-item-main"><h4>${esc(cp.code)} <span class="admin-id-badge">${cp.type==='percent'?'٪':'تومان'}</span></h4><p class="muted">${cp.type==='percent'?'درصد '+nf(cp.value):'مبلغ '+fmt(cp.value)} · استفاده: ${nf(cp.used_count)}${Number(cp.max_uses)>0?' از '+nf(cp.max_uses):' (∞)'}${cp.expires_at?' · انقضا: '+esc(String(cp.expires_at).slice(0,16)):''}</p></div></div><div class="admin-actions"><span class="chip-mini chip-${active?'active':expired?'off':'featured'}">${active?'فعال':expired?'منقضی':exhausted?'تمام‌شده':'غیرفعال'}</span><button data-edit-coupon="${cp.id}">ویرایش</button><button data-admin-toggle-coupon="${cp.id}">${Number(cp.is_active)?'غیرفعال':'فعال'}</button><button class="danger" data-admin-delete-coupon="${cp.id}">حذف</button></div></div>`}
function renderAdminActivity(){const log=adminState.activity_log||[];const actionFa={delete_coupon:'حذف کد تخفیف',reorder_products:'مرتب‌سازی محصولات',reorder_categories:'مرتب‌سازی دسته‌ها',set_role:'تعیین نقش ادمین',remove_role:'حذف نقش ادمین'};return `<article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">📜</span><div><h3>لاگ فعالیت ادمین‌ها</h3><p class="muted">${nf(log.length)} آخرین اقدام — فقط ادمین‌های کامل قابل دیدن هستند.</p></div></div>${log.length?`<div class="activity-list">${log.map(l=>`<div class="activity-row"><div class="activity-icon">📌</div><div class="activity-info"><b>${esc(actionFa[l.action]||l.action)}</b>${l.entity_type?` <span class="admin-id-badge">${esc(l.entity_type)}${l.entity_id?': #'+nf(l.entity_id):''}</span>`:''}${l.details?` <small>${esc(l.details)}</small>`:''}<span class="muted"> · ادمین <code>${l.admin_telegram_id}</code> · ${esc(l.created_at||'')}</span></div></div>`).join('')}</div>`:'<p class="muted empty-state">هنوز فعالیتی ثبت نشده.</p>'}</article>`}
function renderAdminRoles(){const roles=adminState.admin_roles||[];return `<article class="admin-card admin-add-card"><div class="admin-card-head"><span class="admin-card-icon">➕</span><div><h3>افزودن نقش ادمین</h3><p class="muted">به ادمین‌های دیگر نقش محدود بده: فقط سفارش‌ها، فقط محصولات یا فقط مالی.</p></div></div><div class="form-grid"><input id="ar_tid" inputmode="numeric" placeholder="Telegram ID عددی"><input id="ar_name" placeholder="نام نمایشی (اختیاری)"><select id="ar_role"><option value="full">ادمین کامل (همه دسترسی‌ها)</option><option value="orders">فقط سفارش‌ها</option><option value="products">فقط محصولات</option><option value="finance">فقط مالی (برداشت‌ها)</option></select><button class="primary" data-admin-add-role>ثبت نقش</button></div></article><article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">👥</span><div><h3>نقش‌های تعریف‌شده</h3><p class="muted">${nf(roles.length)} ادمین با نقش — ادمین‌های کامل از فایل config.php هم دسترسی کامل دارند.</p></div></div>${roles.length?roles.map(r=>`<div class="admin-item role-row"><div class="admin-item-head"><div class="admin-item-thumb emoji-thumb"><span>${r.role==='full'?'👑':r.role==='orders'?'🧾':r.role==='products'?'🛒':r.role==='finance'?'🏧':'👤'}</span></div><div class="admin-item-main"><h4>${esc(r.display_name||'بدون نام')} <span class="admin-id-badge">${esc(r.role)}</span></h4><p class="muted">Telegram ID: <code>${r.telegram_id}</code> · عضو از ${esc(String(r.created_at||'').slice(0,10))}</p></div></div><div class="admin-actions"><button data-edit-role="${r.id}">ویرایش</button><button class="danger" data-admin-remove-role="${r.telegram_id}">حذف نقش</button></div></div>`).join(''):'<p class="muted empty-state">هنوز نقشی تعریف نشده. ادمین‌های config.php دسترسی کامل دارند.</p>'}</article>`}

function parsePipeLines(text, fields){
  return String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map((line,idx)=>{
    const p=line.split('|').map(v=>v.trim()); const o={_idx:idx}; fields.forEach((f,i)=>o[f]=p[i]||''); return o;
  });
}
function cardLine(c){return [c.title||'',c.card||'',c.owner||'',c.sheba||''].join('|')}
function walletLine(w){return [w.title||'',(w.network||'TRC20').toUpperCase(),(w.asset||'USDT').toUpperCase(),w.address||'',(w.rate_symbol||w.asset||'USDT').toUpperCase(),String(w.is_active??'1'),String(w.sort_order??'99')].join('|')}
function rateLine(r){return [(r.asset||'USDT').toUpperCase(),String(r.rate_toman||'0')].join('|')}
function parseSettingsBuilders(){
  const st=adminState.settings||{};
  adminUiCards=parsePipeLines(st.card_accounts_text||'', ['title','card','owner','sheba']);
  adminUiWallets=parsePipeLines(st.crypto_wallets_text||'', ['title','network','asset','address','rate_symbol','is_active','sort_order']);
  adminUiRates=parsePipeLines(st.crypto_manual_rates_text||'USDT|0\nTRX|0\nTON|0', ['asset','rate_toman']);
}
function paymentListHtml(items,type){
  if(!items.length) return `<div class="empty-state small">هنوز چیزی اضافه نشده.</div>`;
  return `<div class="builder-list">`+items.map((it,i)=>{
    if(type==='card') return `<div class="builder-row"><div><b>${esc(it.title||'کارت')}</b><small>${esc(it.owner||'بدون صاحب کارت')}</small><code>${esc(it.card||'بدون شماره کارت')}</code>${it.sheba?`<small class="ltr">${esc(it.sheba)}</small>`:''}</div><div class="builder-actions"><button class="secondary tiny" data-builder-edit="card:${i}">ویرایش</button><button class="danger tiny" data-builder-del="card:${i}">حذف</button></div></div>`;
    if(type==='wallet') return `<div class="builder-row"><div><b>${esc(it.title||it.asset||'ولت')}</b><small>${esc((it.network||'').toUpperCase())} · ${esc((it.asset||'').toUpperCase())} · ${it.is_active==='0'?'غیرفعال':'فعال'}</small><code>${esc(it.address||'بدون آدرس')}</code><small>نماد نرخ: ${esc((it.rate_symbol||it.asset||'').toUpperCase())} · ترتیب: ${esc(it.sort_order||'99')}</small></div><div class="builder-actions"><button class="secondary tiny" data-builder-edit="wallet:${i}">ویرایش</button><button class="danger tiny" data-builder-del="wallet:${i}">حذف</button></div></div>`;
    return `<div class="builder-row compact"><div><b>${esc((it.asset||'USDT').toUpperCase())}</b><small>نرخ دستی: ${nf(it.rate_toman||0)} تومان</small></div><div class="builder-actions"><button class="secondary tiny" data-builder-edit="rate:${i}">ویرایش</button><button class="danger tiny" data-builder-del="rate:${i}">حذف</button></div></div>`;
  }).join('')+`</div>`;
}
function syncPaymentBuilders(){
  if($('as_cards') && adminUiCards.length) $('as_cards').value=adminUiCards.map(cardLine).join('\n');
  if($('as_crypto_wallets') && adminUiWallets.length) $('as_crypto_wallets').value=adminUiWallets.map(walletLine).join('\n');
  if($('as_crypto_rates') && adminUiRates.length) $('as_crypto_rates').value=adminUiRates.map(rateLine).join('\n');
  if($('cardBuilderList')) $('cardBuilderList').innerHTML=paymentListHtml(adminUiCards,'card');
  if($('walletBuilderList')) $('walletBuilderList').innerHTML=paymentListHtml(adminUiWallets,'wallet');
  if($('rateBuilderList')) $('rateBuilderList').innerHTML=paymentListHtml(adminUiRates,'rate');
}
function initSettingsUi(){ parseSettingsBuilders(); syncPaymentBuilders(); if($('as_crypto_source')) $('as_crypto_source').value=(adminState.settings?.crypto_rate_source||'auto'); }
function field(label,html){return `<label><span>${label}</span>${html}</label>`}
function openCardBuilder(index=null){const c=index===null?{}:adminUiCards[index]||{};openEdit(index===null?'افزودن کارت جدید':'ویرایش کارت',[field('عنوان کارت',`<input id="bc_title" value="${esc(c.title||'')}" placeholder="کارت اصلی">`),field('شماره کارت',`<input id="bc_card" value="${esc(c.card||'')}" inputmode="numeric" placeholder="6037...">`),field('نام صاحب کارت',`<input id="bc_owner" value="${esc(c.owner||'')}" placeholder="نام و نام خانوادگی">`),field('شبا اختیاری',`<input id="bc_sheba" value="${esc(c.sheba||'')}" placeholder="IR...">`)],async()=>{const obj={title:val('bc_title'),card:val('bc_card'),owner:val('bc_owner'),sheba:val('bc_sheba')}; if(!obj.card&&!obj.owner) throw new Error('شماره کارت یا صاحب کارت را وارد کن'); if(index===null)adminUiCards.push(obj);else adminUiCards[index]=obj; syncPaymentBuilders(); showStatus('کارت ذخیره شد')})}
function openWalletBuilder(index=null){const w=index===null?{network:'TRC20',asset:'USDT',rate_symbol:'USDT',is_active:'1',sort_order:'99'}:adminUiWallets[index]||{};openEdit(index===null?'افزودن کیف پول رمزارز':'ویرایش کیف پول',[field('عنوان ولت',`<input id="bw_title" value="${esc(w.title||'')}" placeholder="USDT TRC20">`),field('شبکه',`<input id="bw_network" value="${esc((w.network||'TRC20').toUpperCase())}" list="networkSuggestions" placeholder="TRC20 / TON / BEP20"><datalist id="networkSuggestions"><option value="TRC20"><option value="TRON"><option value="TON"><option value="BEP20"><option value="ERC20"></datalist>`),field('ارز',`<input id="bw_asset" value="${esc((w.asset||'USDT').toUpperCase())}" placeholder="USDT">`),field('آدرس ولت',`<textarea id="bw_address" placeholder="آدرس کیف پول">${esc(w.address||'')}</textarea>`),field('نماد نرخ',`<input id="bw_rate" value="${esc((w.rate_symbol||w.asset||'USDT').toUpperCase())}" placeholder="USDT">`),field('ترتیب نمایش',`<input id="bw_sort" value="${esc(w.sort_order||'99')}" inputmode="numeric">`),`<label class="switch-line">فعال باشد؟ <input id="bw_active" type="checkbox" ${String(w.is_active??'1')!=='0'?'checked':''}></label>`],async()=>{const obj={title:val('bw_title'),network:val('bw_network'),asset:val('bw_asset'),address:val('bw_address'),rate_symbol:val('bw_rate'),is_active:val('bw_active')?'1':'0',sort_order:val('bw_sort')}; if(!obj.address) throw new Error('آدرس ولت را وارد کن'); if(index===null)adminUiWallets.push(obj);else adminUiWallets[index]=obj; syncPaymentBuilders(); showStatus('ولت ذخیره شد')})}
function openRateBuilder(index=null){const r=index===null?{asset:'USDT',rate_toman:'0'}:adminUiRates[index]||{};openEdit(index===null?'افزودن نرخ دستی':'ویرایش نرخ دستی',[field('نماد ارز',`<input id="br_asset" value="${esc((r.asset||'USDT').toUpperCase())}" placeholder="USDT">`),field('قیمت تومان',`<input id="br_rate" value="${esc(r.rate_toman||0)}" inputmode="decimal" placeholder="95000">`)],async()=>{const obj={asset:val('br_asset'),rate_toman:val('br_rate')}; if(!obj.asset) throw new Error('نماد ارز را وارد کن'); if(index===null)adminUiRates.push(obj);else adminUiRates[index]=obj; syncPaymentBuilders(); showStatus('نرخ دستی ذخیره شد')})}
const adminPaletteColors=['#1d9bf0','#2563eb','#8b5cf6','#22c55e','#14b8a6','#f59e0b','#f97316','#ef4444','#ec4899','#64748b'];
function colorPicker(id,value){return `<div class="color-picker-row"><input id="${id}" type="color" value="${esc(value)}"><input id="${id}_text" value="${esc(value)}" placeholder="#1d9bf0" data-color-mirror="${id}"></div>`}
function settingsPalette(target){return `<div class="admin-palette">${adminPaletteColors.map(c=>`<button class="swatch small" data-admin-color="${target}:${c}" style="background:${c}"></button>`).join('')}</div>`}

function bytesLabel(n){n=Number(n||0);if(n>1024*1024)return (n/1024/1024).toFixed(2)+' MB';if(n>1024)return (n/1024).toFixed(1)+' KB';return n+' B'}
function renderAdminBackups(){
  const rows=adminState.backups||[];
  return `<section class="settings-dashboard backup-dashboard">
    <article class="settings-hero admin-card">
      <div><small>Backup Center</small><h3>💾 بکاپ و ریستور</h3><p class="muted">بکاپ روی سرور ذخیره می‌شود، قابل دانلود از SFTP است و می‌تواند داخل چت بات هم ارسال شود.</p></div>
    </article>
    <article class="admin-card">
      <h3>📦 گرفتن بکاپ</h3>
      <p class="muted">اگر دانلود داخل Mini App مشکل داشت، از «ارسال در چت بات» استفاده کن؛ پایدارتر است.</p>
      <div class="admin-actions"><button class="primary" data-admin-backup-create>ساخت بکاپ روی سرور</button><button class="success" data-admin-backup-sendbot>ساخت و ارسال در چت بات</button></div>
      <div class="hint-box">مسیر SFTP روی VPS: <code>/var/www/bluereferral/storage/backups/</code></div>
    </article>
    <article class="admin-card danger-zone">
      <h3>♻️ Restore بکاپ</h3>
      <p class="muted">Restore کل دیتابیس فعلی را جایگزین می‌کند. قبل از Restore یک safety backup خودکار ساخته می‌شود.</p>
      <input id="backupUpload" type="file" accept=".json,.gz,.json.gz">
      <div class="admin-actions"><button class="danger" data-admin-backup-upload>Upload & Restore</button></div>
      <div class="hint-box">راه پایدارتر: در چت بات دستور <code>/restore_backup</code> را بزن و فایل <code>.json.gz</code> را همانجا ارسال کن.</div>
    </article>
    <article class="admin-card">
      <h3>🗂 بکاپ‌های روی سرور</h3>
      ${rows.length?rows.map(b=>`<div class="admin-item"><h4>${esc(b.filename)}</h4><p class="muted">${bytesLabel(b.size)} · ${esc(b.created_at||'')}</p><div class="admin-actions"><button class="secondary" data-open-url="${esc(b.download_url||'')}">دانلود</button><button class="warning" data-admin-backup-restore-server="${esc(b.filename)}">Restore همین فایل</button><button class="danger" data-admin-backup-delete="${esc(b.filename)}">حذف</button></div></div>`).join(''):'<p class="muted">هنوز بکاپی روی سرور نیست.</p>'}
    </article>
  </section>`
}
async function uploadBackupRestore(){
  const input=$('backupUpload');
  const file=input?.files?.[0];
  if(!file){showStatus('اول فایل بکاپ را انتخاب کن','error');return}
  if(!confirm('Restore کل دیتابیس فعلی را جایگزین می‌کند. ادامه می‌دهی؟'))return;
  const fd=new FormData();
  fd.append('initData',initData);fd.append('confirm','RESTORE');fd.append('backup',file);
  const res=await fetch('/backup_upload.php',{method:'POST',body:fd});
  const data=await res.json().catch(()=>({}));
  if(!res.ok||data.ok===false)throw new Error(data.message||data.error||'Restore failed');
  showStatus('Restore انجام شد');
  await loadAdmin();
}

function renderAdminSettings(){
  const s=adminState.settings||{};
  const bc=s.button_colors||{};
  const pm=s.payment_methods_enabled||{};
  const starsActive=pm.stars===true || pm.stars===1 || pm.stars==='1';
  const cryptoActive=pm.crypto===true || pm.crypto===1 || pm.crypto==='1';
  const walletActive=pm.wallet!==false && pm.wallet!==0 && pm.wallet!=='0';
  const cardActive=pm.card!==false && pm.card!==0 && pm.card!=='0';
  return `<section class="settings-dashboard better-settings">
    <article class="settings-hero admin-card">
      <div><small>مرکز تنظیمات</small><h3>⚙️ تنظیمات BlueReferral</h3><p class="muted">روش‌های پرداخت، رنگ‌ها و تنظیمات حساس به صورت کارت جدا و کم‌خطا مدیریت می‌شوند.</p></div>
      <button class="primary" data-admin-save-settings>ذخیره همه</button>
    </article>
    <article class="settings-card admin-card">
      <div class="settings-card-head"><span>🏷️</span><div><h3>نام فروشگاه</h3><p class="muted">این نام در صفحه فروشگاه و بالای مینی‌اپ نمایش داده می‌شود.</p></div></div>
      <div class="form-grid settings-form">
        <label class="full"><span>نام فروشگاه</span><input id="as_brand_name" value="${esc(s.brand_name||'BlueReferral')}" placeholder="مثلاً BlueGate Store"></label>
      </div>
    </article>
    <article class="settings-card admin-card">
      <div class="settings-card-head"><span>💳</span><div><h3>روش‌های پرداخت</h3><p class="muted">روش‌هایی که کاربر در صفحه سفارش می‌بیند.</p></div></div>
      <div class="settings-toggles">
        <label class="pretty-switch"><input id="as_pay_wallet" type="checkbox" ${walletActive?'checked':''}><span></span><b>کیف پول داخلی</b><small>کم‌کردن مبلغ فاکتور از موجودی</small></label>
        <label class="pretty-switch"><input id="as_pay_card" type="checkbox" ${cardActive?'checked':''}><span></span><b>کارت به کارت</b><small>پرداخت دستی با رسید</small></label>
        <label class="pretty-switch"><input id="as_pay_stars" type="checkbox" ${starsActive?'checked':''}><span></span><b>Telegram Stars</b><small>فاکتور مستقیم داخل تلگرام</small></label>
        <label class="pretty-switch"><input id="as_pay_crypto" type="checkbox" ${cryptoActive?'checked':''}><span></span><b>پرداخت رمزارز</b><small>کیف پول دستی + بررسی TXID</small></label>
      </div>
      <div class="form-grid settings-form">
        <label><span>ارزش هر Star به تومان</span><input id="as_stars_rate" value="${esc(s.stars_rate_toman||3200)}" inputmode="numeric" placeholder="مثلاً 3200"></label>
        <label class="full"><span>متن راهنمای پرداخت</span><textarea id="as_payment" placeholder="متن راهنمای پرداخت برای کاربر">${esc(s.payment_instructions||'')}</textarea></label>
      </div>
    </article>
    <article class="settings-card admin-card builder-card">
      <div class="settings-card-head"><span>💳</span><div><h3>حساب‌های کارت به کارت</h3><p class="muted">به جای فرمت خطی، کارت‌ها را جدا جدا اضافه یا ویرایش کن.</p></div></div>
      <input type="hidden" id="as_cards">
      <div id="cardBuilderList"></div>
      <button class="secondary wide" data-builder-add="card">➕ افزودن کارت جدید</button>
    </article>
    <article class="settings-card admin-card builder-card">
      <div class="settings-card-head"><span>🪙</span><div><h3>کیف پول‌های رمزارز</h3><p class="muted">هر ولت را جدا با شبکه، ارز، آدرس و وضعیت فعال بودن تعریف کن.</p></div></div>
      <div class="form-grid settings-form compact-form">
        <label><span>منبع نرخ</span><select id="as_crypto_source"><option value="auto">خودکار: Wallex → Ramzinex → Nobitex → دستی/cache</option><option value="wallex">اولویت با Wallex + fallback</option><option value="ramzinex">اولویت با Ramzinex + fallback</option><option value="nobitex">اولویت با Nobitex + fallback</option><option value="manual">فقط نرخ دستی</option></select></label>
        <label><span>درصد احتیاط نرخ</span><input id="as_crypto_markup" value="${esc(s.crypto_rate_markup_percent||1)}" inputmode="decimal" placeholder="مثلاً 1"></label><label><span>رفرش نرخ هر چند ثانیه</span><input id="as_crypto_refresh_interval" value="${esc(s.crypto_rate_refresh_interval_seconds||600)}" inputmode="numeric" placeholder="60"></label>
        <label class="pretty-switch inline"><input id="as_crypto_notify" type="checkbox" ${s.crypto_notify_rate_fail!==false?'checked':''}><span></span><b>اعلان خطای نرخ به ادمین</b></label>
      </div>
      <input type="hidden" id="as_crypto_wallets">
      <div id="walletBuilderList"></div>
      <button class="secondary wide" data-builder-add="wallet">➕ افزودن ولت جدید</button>
    </article>
    <article class="settings-card admin-card builder-card">
      <div class="settings-card-head"><span>📈</span><div><h3>نرخ دستی fallback</h3><p class="muted">اگر Providerها جواب ندادند یا منبع دستی باشد، این نرخ‌ها استفاده می‌شوند.</p></div></div>
      <input type="hidden" id="as_crypto_rates">
      <div class="rate-live-box"><b>نرخ‌های فعلی Providerها/cache</b><pre id="cryptoRateCacheView">${esc(cryptoRateCacheText())}</pre><button class="secondary wide" data-refresh-crypto-rates>🔄 رفرش نرخ از Wallex/Ramzinex/Nobitex</button></div>
      <div id="rateBuilderList"></div>
      <button class="secondary wide" data-builder-add="rate">➕ افزودن نرخ دستی</button>
    </article>
    <article class="settings-card admin-card">
      <div class="settings-card-head"><span>🎨</span><div><h3>پالت رنگ Mini App</h3><p class="muted">رنگ اصلی و دکمه‌ها را با color picker یا پالت سریع تنظیم کن.</p></div></div>
      <div class="settings-color-grid">
        <label><span>رنگ اصلی</span>${colorPicker('as_theme',s.theme_color||'#1d9bf0')}${settingsPalette('as_theme')}</label>
        <label class="pretty-switch inline"><input id="as_btn_enabled" type="checkbox" ${s.button_colors_enabled?'checked':''}><span></span><b>رنگی بودن دکمه‌های Mini App</b></label>
        <label><span>دکمه اصلی</span>${colorPicker('as_primary',bc.primary||'#1d9bf0')}${settingsPalette('as_primary')}</label>
        <label><span>دکمه دوم</span>${colorPicker('as_secondary',bc.secondary||'#2563eb')}${settingsPalette('as_secondary')}</label>
        <label><span>موفق</span>${colorPicker('as_success',bc.success||'#22c55e')}${settingsPalette('as_success')}</label>
        <label><span>هشدار</span>${colorPicker('as_warning',bc.warning||'#f59e0b')}${settingsPalette('as_warning')}</label>
        <label><span>حذف/خطر</span>${colorPicker('as_danger',bc.danger||'#ef4444')}${settingsPalette('as_danger')}</label>
      </div>
    </article>
    <article class="settings-card admin-card">
      <div class="settings-card-head"><span>👤</span><div><h3>کاربر و احراز</h3><p class="muted">کنترل ورود، شماره تماس و اعلان عضو جدید.</p></div></div>
      <div class="settings-toggles two">
        <label class="pretty-switch"><input id="as_require_contact" type="checkbox" ${s.require_contact_auth?'checked':''}><span></span><b>احراز شماره اجباری</b><small>کاربر باید Share Contact بزند</small></label>
        <label class="pretty-switch"><input id="as_notify_new" type="checkbox" ${s.notify_new_user!==false?'checked':''}><span></span><b>اعلان عضو جدید</b><small>فقط دفعه اول استارت</small></label>
      </div>
    </article>
    <article class="settings-card admin-card">
      <div class="settings-card-head"><span>🎡</span><div><h3>گردونه و مأموریت</h3><p class="muted">شانس گردونه و جایزه‌های قابل تنظیم.</p></div></div>
      <div class="form-grid settings-form">
        <label><span>هر چند دعوت = ۱ شانس</span><input id="as_spin_every" value="${esc(s.spin_referrals_per_chance||5)}" inputmode="numeric"></label>
        <label class="full"><span>جایزه‌های گردونه</span><textarea id="as_spin_rewards" placeholder="هر خط: عنوان|مبلغ|وزن|اعلان ادمین">${esc(s.spin_rewards_text||'')}</textarea></label>
      </div>
      <div class="hint-box">فرمت جایزه: <code>عنوان|مبلغ کیف پول|وزن احتمال|اعلان ادمین ۰/۱</code></div>
    </article>
    <button class="primary save-floating" data-admin-save-settings>ذخیره همه تنظیمات</button>
  </section>`}
function editProduct(id){const p=adminState.products.find(x=>Number(x.id)===Number(id));if(!p)return;openEdit(`ویرایش محصول #${id}`,[`<input id="ep_name" value="${esc(p.name)}" placeholder="نام">`,priceAdminFields('ep',p),`<select id="ep_cat">${catOptions(p.category_id)}</select>`,`<select id="ep_delivery"><option value="manual">دستی</option><option value="account">اکانت</option><option value="vpn">VPN</option><option value="code">کد</option><option value="file">فایل/متن</option></select>`,`<select id="ep_commission_type"><option value="none">بدون</option><option value="fixed">ثابت</option><option value="percent">درصدی</option></select>`,`<input id="ep_commission_value" value="${p.commission_value||0}" placeholder="مقدار پورسانت">`,`<input id="ep_duration" value="${p.duration_days||0}" placeholder="مدت روز">`,`<input id="ep_img" value="${esc(p.image_url||'')}" placeholder="لینک عکس">`,`<label class="switch-line liquid-toggle">فعال <input id="ep_active" type="checkbox" ${Number(p.is_active)?'checked':''}></label>`,`<label class="switch-line liquid-toggle">ویژه <input id="ep_featured" type="checkbox" ${Number(p.is_featured)?'checked':''}></label>`,`<input id="ep_flash_discount" value="${p.flash_sale_discount||0}" inputmode="numeric" placeholder="٪ تخفیف فلش">`,`<input id="ep_flash_start" type="datetime-local" value="${p.flash_sale_start?String(p.flash_sale_start).slice(0,16):''}" placeholder="شروع فلش">`,`<input id="ep_flash_end" type="datetime-local" value="${p.flash_sale_end?String(p.flash_sale_end).slice(0,16):''}" placeholder="پایان فلش">`,`<textarea id="ep_short" placeholder="توضیح کوتاه">${esc(p.short_description||'')}</textarea>`,`<textarea id="ep_full" placeholder="توضیح کامل">${esc(p.full_description||'')}</textarea>`],async()=>{await adminAction('admin_update_product',{product_id:id,name:val('ep_name'),price_currency:val('ep_currency'),price:val('ep_price'),price_usd:val('ep_price_usd'),category_id:val('ep_cat'),delivery_type:val('ep_delivery'),commission_type:val('ep_commission_type'),commission_value:val('ep_commission_value'),duration_days:val('ep_duration'),image_url:val('ep_img'),is_active:val('ep_active')?1:0,is_featured:val('ep_featured')?1:0,flash_sale_discount:val('ep_flash_discount'),flash_sale_start:val('ep_flash_start'),flash_sale_end:val('ep_flash_end'),short_description:val('ep_short'),full_description:val('ep_full')})});setTimeout(()=>{if($('ep_delivery'))$('ep_delivery').value=p.delivery_type;if($('ep_commission_type'))$('ep_commission_type').value=p.commission_type||'none'},0)}
function editCategory(id){const c=adminState.categories.find(x=>Number(x.id)===Number(id));if(!c)return;openEdit(`ویرایش دسته #${id}`,[`<input id="ec_title" value="${esc(c.title)}" placeholder="نام">`,`<input id="ec_emoji" value="${esc(c.emoji||'')}" placeholder="اموجی">`,`<input id="ec_img" value="${esc(c.image_url||'')}" placeholder="لینک عکس">`,`<input id="ec_sort" value="${c.sort_order||0}" placeholder="ترتیب">`,`<label class="switch-line">فعال <input id="ec_active" type="checkbox" ${Number(c.is_active)?'checked':''}></label>`],async()=>adminAction('admin_update_category',{category_id:id,title:val('ec_title'),emoji:val('ec_emoji'),image_url:val('ec_img'),sort_order:val('ec_sort'),is_active:val('ec_active')?1:0}))}
function editVariant(id){const v=adminState.variants.find(x=>Number(x.id)===Number(id));if(!v)return;openEdit(`ویرایش پلن #${id}`,[`<input id="ev_title" value="${esc(v.title)}" placeholder="نام پلن">`,priceAdminFields('ev',v),`<input id="ev_duration" value="${v.duration_days||0}" placeholder="مدت روز">`,`<input id="ev_sort" value="${v.sort_order||0}" placeholder="ترتیب">`,`<label class="switch-line liquid-toggle">فعال <input id="ev_active" type="checkbox" ${Number(v.is_active)?'checked':''}></label>`],async()=>adminAction('admin_update_variant',{variant_id:id,title:val('ev_title'),price_currency:val('ev_currency'),price:val('ev_price'),price_usd:val('ev_price_usd'),duration_days:val('ev_duration'),sort_order:val('ev_sort'),is_active:val('ev_active')?1:0}))}
function editInventory(id){const i=adminState.inventory.find(x=>Number(x.id)===Number(id));if(!i)return;openEdit(`ویرایش آیتم انبار #${id}`,[`<select id="ei_product">${productOptions(i.product_id)}</select>`,`<select id="ei_variant">${variantOptions(i.variant_id)}</select>`,`<select id="ei_status"><option value="available">available</option><option value="reserved">reserved</option><option value="delivered">delivered</option><option value="disabled">disabled</option></select>`,`<textarea id="ei_content">${esc(i.content||'')}</textarea>`],async()=>adminAction('admin_update_inventory',{inventory_id:id,product_id:val('ei_product'),variant_id:val('ei_variant'),status:val('ei_status'),content:val('ei_content')}));setTimeout(()=>{if($('ei_status'))$('ei_status').value=i.status||'available'},0)}
async function adminAction(action,payload={}){
  try{
    adminState=await api(action,payload);
    if(!adminState || adminState.ok===false) throw new Error(adminState?.message||'خطا در ذخیره');
    $('userApp').classList.add('hidden');$('adminApp').classList.remove('hidden');
    applyTheme(adminState.settings||{});renderAdmin();showStatus('ذخیره شد');return true
  }catch(e){showStatus(e.message||'خطا در ذخیره','error');return false}
}
async function loadAfterAction(action,payload={}){try{state=await api(action,payload);applyTheme(state);renderUser();showStatus('انجام شد');return true}catch(e){showStatus(e.message,'error');return false}}

document.addEventListener('click',async(e)=>{
  const b=e.target.closest('[data-builder-add],[data-builder-edit],[data-builder-del],[data-admin-color],#applyCustomColor,#applyAdminColor,[data-close-share],[data-share-tg-url],[data-share-copy-url],[data-share-native],[data-share-product]');
  if(!b) return;
  e.preventDefault(); e.stopPropagation();
  if(b.id==='applyCustomColor'){
    const c=$('userCustomColor')?.value || '#1d9bf0';
    localStorage.setItem('blue_ref_color',c);
    applyTheme({...state,theme_color:c});
    showStatus('رنگ دلخواه اعمال شد');
    return;
  }
  if(b.dataset.shareProduct){ openShareSheet(b.dataset.shareProduct); return; }
  if(b.dataset.closeShare !== undefined){ closeShareSheet(); return; }
  if(b.dataset.shareTgUrl){
    const link = b.dataset.shareTgUrl;
    try{tg?.openTelegramLink?.(link)}catch(_){try{Telegram?.WebApp?.openLink?.(link)}catch(__){location.href=link}}
    showStatus('لینک محصول در تلگرام باز شد');
    closeShareSheet();
    return;
  }
  if(b.dataset.shareCopyUrl !== undefined){
    copyText(_shareUrl);
    return;
  }
  if(b.dataset.shareNative !== undefined){
    if(navigator.share && _shareUrl){
      try{ await navigator.share({title: document.title, url: _shareUrl}); showStatus('اشتراک‌گذاری انجام شد'); closeShareSheet(); }catch(_){}
    }
    return;
  }
  if(b.dataset.adminColor){const [id,c]=b.dataset.adminColor.split(':'); if($(id)){$(id).value=c; const t=$(id+'_text'); if(t)t.value=c; showStatus('رنگ انتخاب شد')}}
  if(b.dataset.builderAdd){ if(b.dataset.builderAdd==='card')openCardBuilder(); if(b.dataset.builderAdd==='wallet')openWalletBuilder(); if(b.dataset.builderAdd==='rate')openRateBuilder(); return; }
  if(b.dataset.builderEdit){const [type,idx]=b.dataset.builderEdit.split(':'); const i=Number(idx); if(type==='card')openCardBuilder(i); if(type==='wallet')openWalletBuilder(i); if(type==='rate')openRateBuilder(i); return; }
  if(b.dataset.builderDel){const [type,idx]=b.dataset.builderDel.split(':'); const i=Number(idx); if(!confirm('این مورد حذف شود؟'))return; if(type==='card')adminUiCards.splice(i,1); if(type==='wallet')adminUiWallets.splice(i,1); if(type==='rate')adminUiRates.splice(i,1); syncPaymentBuilders(); showStatus('حذف شد'); return; }
},true);
// Removed capture-phase palette persistence to server — palette is local-only now.

// Override applyTheme to prefer per-user theme when available
function applyTheme(data={}){
  const local = localStorage.getItem('blue_ref_color');
  const accent = local || (data && data.theme_color) || (data && data.settings && data.settings.theme_color) || '#1d9bf0';
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--primary', data && data.button_colors_enabled===false ? '#1d9bf0' : (data && (data.button_colors?.primary || (data.settings && data.settings.button_colors?.primary)) || accent));
  document.documentElement.style.setProperty('--secondary', data && (data.button_colors?.secondary || (data.settings && data.settings.button_colors?.secondary)) || '#2563eb');
  document.documentElement.style.setProperty('--danger', data && (data.button_colors?.danger || (data.settings && data.settings.button_colors?.danger)) || '#ef4444');
  document.documentElement.style.setProperty('--success', data && (data.button_colors?.success || (data.settings && data.settings.button_colors?.success)) || '#22c55e');
  document.documentElement.style.setProperty('--warning', data && (data.button_colors?.warning || (data.settings && data.settings.button_colors?.warning)) || '#f59e0b');
  try{tg?.setHeaderColor?.(accent);tg?.setBackgroundColor?.('#08111f');tg?.MainButton?.setParams?.({color:accent,text_color:'#ffffff'});}catch(e){}
}
document.addEventListener('click',async(e)=>{const t=e.target.closest('button,[data-product],[data-order-open],[data-accordion-toggle]');if(!t)return;if(t.dataset.tab){setTab(t.dataset.tab)}if(t.dataset.tabJump){setTab(t.dataset.tabJump)}if(t.id==='openPalette'||t.id==='paletteQuick'){openPalettePopup()}if(t.dataset.color){localStorage.setItem('blue_ref_color',t.dataset.color);applyTheme({...state,theme_color:t.dataset.color});showStatus('رنگ تغییر کرد')}if(t.id==='resetColor'){localStorage.removeItem('blue_ref_color');applyTheme(state);showStatus('رنگ پیش‌فرض برگشت')}if(t.id==='applyCustomColor'){const c=$('userCustomColor')?.value||'#1d9bf0';localStorage.setItem('blue_ref_color',c);applyTheme({...state,theme_color:c});showStatus('رنگ دلخواه اعمال شد')}if(t.dataset.cat){activeCategory=t.dataset.cat;renderShop()}if(t.dataset.shopSort!==undefined){shopSort=t.dataset.shopSort;renderShop()}if(t.dataset.shopToggle!==undefined){if(t.dataset.shopToggle==='instock')shopFilterInStock=!shopFilterInStock;else if(t.dataset.shopToggle==='featured')shopFilterFeatured=!shopFilterFeatured;renderShop()}if(t.id==='searchInput')return;if(t.dataset.product)showProduct(t.dataset.product);if(t.dataset.backShop!==undefined){currentTab='shop';renderUser()}if(t.dataset.buy||t.dataset.buyWallet){if(!confirm('آیا از ثبت سفارش خود مطمئن هستید؟'))return;closePreviewSheet();await loadAfterAction('create_order',{product_id:t.dataset.buy||t.dataset.buyWallet,variant_id:t.dataset.variant||null,use_wallet:t.dataset.buyWallet?1:0});currentTab='orders';currentOrderId=state.order?.id||null;renderUser()}if(t.dataset.walletOrder){await loadAfterAction('apply_wallet',{order_id:t.dataset.walletOrder});currentTab='orders';currentOrderId=t.dataset.walletOrder;renderUser()}if(t.dataset.selectCard){await loadAfterAction('select_payment_method',{order_id:t.dataset.selectCard,method:'card',details:{}});currentTab='orders';currentOrderId=t.dataset.selectCard;renderUser();showStatus('کارت به کارت انتخاب شد')}if(t.dataset.payStars){await loadAfterAction('start_stars_invoice',{order_id:t.dataset.payStars});currentTab='orders';currentOrderId=t.dataset.payStars;renderUser();showStatus('فاکتور Stars داخل تلگرام ارسال شد')}if(t.dataset.selectCrypto){const [oid,wid]=t.dataset.selectCrypto.split(':');await loadAfterAction('select_crypto_wallet',{order_id:oid,wallet_id:wid});currentTab='orders';currentOrderId=oid;renderUser();showStatus('کیف پول رمزارز انتخاب شد')}if(t.dataset.showCrypto){showStatus('کمی پایین‌تر کیف پول رمزارز را انتخاب کن')}if(t.dataset.cryptoHash){openDialog('ثبت TXID / Hash',`هش تراکنش رمزارز سفارش #${t.dataset.cryptoHash} را وارد کن.`, 'TXID / Hash', async(txt)=>{await loadAfterAction('submit_crypto_hash',{order_id:t.dataset.cryptoHash,tx_hash:txt});currentTab='orders';currentOrderId=t.dataset.cryptoHash;renderUser();showStatus('هش ثبت شد و در صف بررسی قرار گرفت')})}if(t.dataset.checkCrypto){await loadAfterAction('check_crypto_payment',{order_id:t.dataset.checkCrypto});currentTab='orders';currentOrderId=t.dataset.checkCrypto;renderUser();showStatus('بررسی پرداخت انجام شد')}
if(t.dataset.openUrl){try{Telegram?.WebApp?.openLink?.(t.dataset.openUrl)}catch(_){location.href=t.dataset.openUrl}}if(t.dataset.copy){navigator.clipboard?.writeText(t.dataset.copy);showStatus('کپی شد')}if(t.dataset.receipt){openDialog('ارسال رسید',`توضیح یا کد پیگیری سفارش #${t.dataset.receipt} را وارد کن.`, 'مثلاً کد پیگیری یا توضیح پرداخت', async(txt)=>{await loadAfterAction('submit_receipt',{order_id:t.dataset.receipt,note:txt});currentTab='orders';renderUser();showStatus('رسید ثبت شد؛ اگر لازم است اطلاعات اکانت را با دکمه یادداشت سفارش بفرست')})}if(t.dataset.customerNote){openDialog('یادداشت سفارش',`ایمیل، رمز، یوزرنیم یا توضیح لازم برای سفارش #${t.dataset.customerNote} را وارد کن.`, 'مثلاً email@example.com / Password یا توضیح مورد نیاز', async(txt)=>{await loadAfterAction('customer_order_note',{order_id:t.dataset.customerNote,note:txt});currentTab='orders';renderUser()})}if(t.dataset.coupon){openDialog('کد تخفیف',`کد تخفیف سفارش #${t.dataset.coupon} را وارد کن.`, 'BLUE10', async(txt)=>{await loadAfterAction('apply_coupon',{order_id:t.dataset.coupon,code:txt});currentTab='orders';renderUser()})}if(t.dataset.orderFilter){orderFilter=t.dataset.orderFilter;currentOrderId=null;renderOrders()}if(t.dataset.orderOpen){currentOrderId=t.dataset.orderOpen;renderOrders()}if(t.dataset.orderBack!==undefined){currentOrderId=null;renderOrders()}if(t.dataset.hideOrder&&confirm('این سفارش از لیست شما حذف شود؟')){await loadAfterAction('hide_order',{order_id:t.dataset.hideOrder});currentTab='orders';currentOrderId=null;renderUser()}if(t.dataset.clearCanceled!==undefined&&confirm('همه سفارش‌های لغو/رد شده از لیست شما مخفی شوند؟')){await loadAfterAction('clear_canceled_orders');currentTab='orders';currentOrderId=null;renderUser()}if(t.dataset.cancel){await loadAfterAction('cancel_order',{order_id:t.dataset.cancel});currentTab='orders';currentOrderId=null;renderUser()}if(t.id==='copyLink'||t.id==='copyRefHome'){navigator.clipboard?.writeText(state.user.referral_link);showStatus('لینک دعوت کپی شد')}if(t.id==='claimBtn')await loadAfterAction('claim_missions');if(t.id==='spinBtn')await doSpinWheel();if(t.dataset.refreshCryptoRates!==undefined){const ok=await adminAction('admin_refresh_crypto_rates',{});if(ok){showStatus('نرخ‌ها از Providerها رفرش شد')}}if(t.dataset.adminBackupCreate!==undefined){const ok=await adminAction('admin_backup_create',{});if(ok){showStatus('بکاپ روی سرور ساخته شد')}}if(t.dataset.adminBackupSendbot!==undefined){const ok=await adminAction('admin_backup_send_bot',{});if(ok){showStatus('بکاپ داخل چت بات ارسال شد')}}if(t.dataset.adminBackupDelete&&confirm('این بکاپ از سرور حذف شود؟')){await adminAction('admin_backup_delete',{filename:t.dataset.adminBackupDelete})}if(t.dataset.adminBackupRestoreServer&&confirm('Restore این فایل انجام شود؟ دیتابیس فعلی جایگزین می‌شود.')){await adminAction('admin_backup_restore_server',{filename:t.dataset.adminBackupRestoreServer,confirm:'RESTORE'})}if(t.dataset.adminBackupUpload!==undefined){try{await uploadBackupRestore()}catch(e){showStatus(e.message||'Restore failed','error')}}if(t.dataset.accordionToggle!==undefined){toggleVariantProduct(t.dataset.accordionToggle);return}if(t.dataset.accordionAddVariant!==undefined){const pid=t.dataset.accordionAddVariant;if(currentAdminTab!=='variants'){setAdminTab('variants')}setTimeout(()=>{const sel=$('av_product'); if(sel){sel.value=String(pid); sel.dispatchEvent(new Event('change')); $('av_title')?.focus()} if(typeof tg!=='undefined'&&tg?.HapticFeedback)tg.HapticFeedback.impactOccurred('light'); document.getElementById('av_title')?.scrollIntoView({behavior:'smooth',block:'center'})},120);return}
if(t.dataset.cartAdd!==undefined){closePreviewSheet();cartAdd(Number(t.dataset.cartAdd),Number(t.dataset.cartVariant||0));return}if(t.dataset.cartInc!==undefined){cartQty(Number(t.dataset.cartInc),1);return}if(t.dataset.cartDec!==undefined){cartQty(Number(t.dataset.cartDec),-1);return}if(t.dataset.cartDel!==undefined){cartRemove(Number(t.dataset.cartDel));return}if(t.id==='cartCloseBtn'){closeCartSheet();return}if(t.id==='cartClearBtn'){cartClear();return}if(t.id==='cartCheckoutBtn'){cartCheckout();return}if(t.id==='cartFab'){openCartSheet();return}if(t.dataset.customer360){openCustomer360(Number(t.dataset.customer360));return}if(t.id==='custCloseBtn'){closeCustomer360();return}if(t.dataset.exportOrdersCsv!==undefined){exportOrdersCsv();return}if(t.dataset.exportProductsCsv!==undefined){exportProductsCsv();return}if(t.dataset.adminWithdraw){const [wid,act]=t.dataset.adminWithdraw.split(':');if(confirm(act==='paid'?'تایید برداشت و علامت‌گذاری به‌عنوان پرداخت‌شده؟ کاربر نوتیف می‌شود.':'رد این برداشت؟ مبلغ به موجودی کاربر برمی‌گردد.')){adminAction('admin_withdraw_action',{withdrawal_id:Number(wid),action_type:act})}return}if(t.dataset.adminAddCoupon!==undefined){adminAction('admin_add_coupon',{code:val('acp_code'),type:val('acp_type'),value:val('acp_value'),max_uses:val('acp_max'),expires_at:val('acp_expires')});return}if(t.dataset.editCoupon){const cp=(adminState.coupons||[]).find(x=>Number(x.id)===Number(t.dataset.editCoupon));if(!cp)return;openEdit(`ویرایش کد ${esc(cp.code)}`,[`<input id="ecp_code" value="${esc(cp.code)}" placeholder="کد">`,`<select id="ecp_type"><option value="percent" ${cp.type==='percent'?'selected':''}>درصدی</option><option value="fixed" ${cp.type==='fixed'?'selected':''}>مبلغ ثابت</option></select>`,`<input id="ecp_value" value="${cp.value||0}" inputmode="numeric" placeholder="مقدار">`,`<input id="ecp_max" value="${cp.max_uses||0}" inputmode="numeric" placeholder="حداکثر استفاده">`,`<input id="ecp_expires" type="datetime-local" value="${cp.expires_at?String(cp.expires_at).slice(0,16):''}" placeholder="انقضا">`,`<label class="switch-line liquid-toggle">فعال <input id="ecp_active" type="checkbox" ${Number(cp.is_active)?'checked':''}></label>`],async()=>adminAction('admin_update_coupon',{coupon_id:cp.id,code:val('ecp_code'),type:val('ecp_type'),value:val('ecp_value'),max_uses:val('ecp_max'),expires_at:val('ecp_expires'),is_active:val('ecp_active')?1:0}));return}if(t.dataset.adminToggleCoupon){const cp=(adminState.coupons||[]).find(x=>Number(x.id)===Number(t.dataset.adminToggleCoupon));if(cp)adminAction('admin_update_coupon',{coupon_id:cp.id,is_active:Number(cp.is_active)?0:1});return}if(t.dataset.adminDeleteCoupon&&confirm('این کد تخفیف حذف شود؟')){adminAction('admin_delete_coupon',{coupon_id:Number(t.dataset.adminDeleteCoupon)});return}
if(t.id==='openQrHome'||t.id==='openQrWallet'){openQrSheet();return}if(t.id==='adminOrderSearchBtn'){adminOrderSearch=$('adminOrderSearchInput')?.value||'';adminOrderStatusFilter=$('adminOrderStatusSelect')?.value||'all';adminSearchOrdersNow();return}if(t.id==='adminOrderResetBtn'){adminOrderSearch='';adminOrderStatusFilter='all';adminSearchOrdersNow();return}if(t.id==='bulkClearBtn'){selectedOrderIds.clear();renderAdmin();return}if(t.dataset.bulkAction){bulkOrderAction(t.dataset.bulkAction);return}if(t.dataset.reorder){const [type,id,dir]=t.dataset.reorder.split(':');reorderItem(type,Number(id),dir);return}if(t.dataset.chatUser){openUserChat(t.dataset.chatUser);return}if(t.dataset.adminAddRole!==undefined){adminAction('admin_set_role',{telegram_id:val('ar_tid'),role:val('ar_role'),display_name:val('ar_name')});return}if(t.dataset.editRole){const r=(adminState.admin_roles||[]).find(x=>Number(x.id)===Number(t.dataset.editRole));if(!r)return;openEdit(`ویرایش نقش ${esc(r.display_name||'')}`,[`<input id="erl_name" value="${esc(r.display_name||'')}" placeholder="نام نمایشی">`,`<select id="erl_role"><option value="full" ${r.role==='full'?'selected':''}>ادمین کامل</option><option value="orders" ${r.role==='orders'?'selected':''}>فقط سفارش‌ها</option><option value="products" ${r.role==='products'?'selected':''}>فقط محصولات</option><option value="finance" ${r.role==='finance'?'selected':''}>فقط مالی</option></select>`],async()=>adminAction('admin_set_role',{telegram_id:r.telegram_id,role:val('erl_role'),display_name:val('erl_name')}));return}if(t.dataset.adminRemoveRole&&confirm('نقش این کاربر حذف شود؟')){adminAction('admin_remove_role',{telegram_id:Number(t.dataset.adminRemoveRole)});return}
if(t.dataset.adminTab){setAdminTab(t.dataset.adminTab)}if(t.id==='reloadAdmin')loadAdmin();if(t.id==='openCmdPalette'){openCommandPalette();return}if(t.dataset.adminAddProduct!==undefined)adminAction('admin_add_product',{name:val('ap_name'),price_currency:val('ap_currency'),price:val('ap_price'),price_usd:val('ap_price_usd'),category_id:val('ap_cat'),delivery_type:val('ap_delivery'),commission_type:val('ap_commission_type'),commission_value:val('ap_commission_value'),image_url:val('ap_img'),duration_days:val('ap_duration'),is_featured:val('ap_featured')?1:0,flash_sale_discount:val('ap_flash_discount'),flash_sale_start:val('ap_flash_start'),flash_sale_end:val('ap_flash_end'),short_description:val('ap_short'),full_description:val('ap_full')});if(t.dataset.editProduct)editProduct(t.dataset.editProduct);if(t.dataset.adminToggleProduct)adminAction('admin_toggle_product',{product_id:t.dataset.adminToggleProduct});if(t.dataset.adminDeleteProduct&&confirm('محصول غیرفعال شود؟'))adminAction('admin_delete_product',{product_id:t.dataset.adminDeleteProduct});if(t.dataset.adminHardDeleteProduct&&confirm('حذف کامل محصول؟ اگر سفارش داشته باشد انجام نمی‌شود.'))adminAction('admin_hard_delete_product',{product_id:t.dataset.adminHardDeleteProduct});if(t.dataset.adminAddCategory!==undefined)adminAction('admin_add_category',{title:val('ac_title'),emoji:val('ac_emoji'),image_url:val('ac_img'),sort_order:val('ac_sort')});if(t.dataset.editCategory)editCategory(t.dataset.editCategory);if(t.dataset.adminDeleteCategory&&confirm('دسته غیرفعال شود؟'))adminAction('admin_delete_category',{category_id:t.dataset.adminDeleteCategory});if(t.dataset.adminHardDeleteCategory&&confirm('حذف کامل دسته؟ محصولات بدون دسته می‌شوند.'))adminAction('admin_hard_delete_category',{category_id:t.dataset.adminHardDeleteCategory});if(t.dataset.adminAddVariant!==undefined)adminAction('admin_add_variant',{product_id:val('av_product'),title:val('av_title'),price_currency:val('av_currency'),price:val('av_price'),price_usd:val('av_price_usd'),duration_days:val('av_duration'),sort_order:val('av_sort')});if(t.dataset.editVariant)editVariant(t.dataset.editVariant);if(t.dataset.adminDeleteVariant&&confirm('پلن غیرفعال شود؟'))adminAction('admin_delete_variant',{variant_id:t.dataset.adminDeleteVariant});if(t.dataset.adminHardDeleteVariant&&confirm('حذف کامل پلن؟ اگر سفارش داشته باشد انجام نمی‌شود.'))adminAction('admin_hard_delete_variant',{variant_id:t.dataset.adminHardDeleteVariant});if(t.dataset.adminAddInventory!==undefined)adminAction('admin_add_inventory',{product_id:val('ai_product'),variant_id:val('ai_variant'),content:val('ai_content')});if(t.dataset.editInventory)editInventory(t.dataset.editInventory);if(t.dataset.adminDeleteInventory&&confirm('حذف امن آیتم؟'))adminAction('admin_delete_inventory',{inventory_id:t.dataset.adminDeleteInventory});if(t.dataset.adminHardDeleteInventory&&confirm('حذف کامل آیتم؟'))adminAction('admin_hard_delete_inventory',{inventory_id:t.dataset.adminHardDeleteInventory});if(t.dataset.adminStatus){const [id,status]=t.dataset.adminStatus.split(':');adminAction('admin_order_status',{order_id:id,status})}if(t.dataset.adminArchiveOrder&&confirm('این سفارش آرشیو شود؟'))adminAction('admin_archive_order',{order_id:t.dataset.adminArchiveOrder});if(t.dataset.adminDeleteOrder&&confirm('حذف کامل سفارش؟ این عملیات قابل برگشت نیست.'))adminAction('admin_delete_order',{order_id:t.dataset.adminDeleteOrder});if(t.dataset.adminCleanup&&confirm('پاکسازی گروهی سفارش‌های لغو/رد شده انجام شود؟'))adminAction('admin_cleanup_orders',{older_days:t.dataset.adminCleanup==='all'?null:t.dataset.adminCleanup});if(t.dataset.adminDeliver){const oid=t.dataset.adminDeliver;openDialog('تحویل سفارش',`متن تحویل سفارش #${oid} را وارد کن.`, 'ایمیل/پسورد، لینک ساب یا کد', async(txt)=>{const ok=await adminAction('admin_deliver_order',{order_id:oid,delivery:txt});if(ok){currentAdminTab='orders';showStatus('تحویل ثبت شد و برای کاربر ارسال شد')}})}if(t.dataset.viewReceipt!==undefined){loadReceiptImage(t.dataset.viewReceipt)}if(t.dataset.adminSaveSettings!==undefined){syncPaymentBuilders();adminAction('admin_save_settings',{brand_name:val('as_brand_name'),theme_color:val('as_theme'),button_colors_enabled:val('as_btn_enabled')?1:0,require_contact_auth:val('as_require_contact')?1:0,notify_new_user:val('as_notify_new')?1:0,button_colors:{primary:val('as_primary'),secondary:val('as_secondary'),success:val('as_success'),warning:val('as_warning'),danger:val('as_danger')},payment_instructions:val('as_payment'),payment_methods_enabled:{wallet:val('as_pay_wallet')?1:0,card:val('as_pay_card')?1:0,stars:val('as_pay_stars')?1:0,crypto:val('as_pay_crypto')?1:0},card_accounts_text:val('as_cards'),stars_rate_toman:val('as_stars_rate'),crypto_wallets_text:val('as_crypto_wallets'),crypto_manual_rates_text:val('as_crypto_rates'),crypto_rate_source:val('as_crypto_source'),crypto_rate_provider_priority:'wallex,ramzinex,nobitex',crypto_rate_markup_percent:val('as_crypto_markup'),crypto_rate_refresh_interval_seconds:val('as_crypto_refresh_interval'),crypto_notify_rate_fail:val('as_crypto_notify')?1:0,spin_referrals_per_chance:val('as_spin_every'),spin_rewards_text:val('as_spin_rewards')})}});
document.addEventListener('input',e=>{if(e.target.id==='searchInput'){searchTerm=e.target.value;clearTimeout(searchTimeout);searchTimeout=setTimeout(renderShopSections,250)}if(e.target.id==='ai_product'){const sel=$('ai_variant'); if(sel) sel.innerHTML=variantOptions('', e.target.value)}if(e.target.dataset.colorMirror){const id=e.target.dataset.colorMirror;if($(id))$(id).value=e.target.value}if(e.target.type==='color'&&$(e.target.id+'_text'))$(e.target.id+'_text').value=e.target.value;if(e.target.id==='cmdInput'&&$('cmdPalette')?.classList.contains('open')){openCommandPalette()}})
document.addEventListener('change',e=>{if(e.target.classList?.contains('bulk-check')){const id=Number(e.target.dataset.bulkCheck);if(e.target.checked)selectedOrderIds.add(id);else selectedOrderIds.delete(id);if(selectedOrderIds.size>0&&currentAdminTab==='orders'){const bar=document.querySelector('.bulk-action-bar h3');if(bar)bar.textContent=`${nf(selectedOrderIds.size)} سفارش انتخاب شده`;else renderAdmin()}}})
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();openCommandPalette()}if(e.key==='Escape'){$('cmdPalette')?.classList.remove('open');$('onboarding')?.classList.remove('open');closePreviewSheet();closeQrSheet();closeCartSheet();closeCustomer360();closePalettePopup();closeShareSheet()}if($('cmdPalette')?.classList.contains('open')){const cp=$('cmdPalette');if(e.key==='Enter'){const first=cp.querySelector('[data-cmd-idx]');if(first){const idx=Number(first.dataset.cmdIdx);cp._cmds?.[idx]?.action?.();closeCommandPalette()}}if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const items=[...cp.querySelectorAll('[data-cmd-idx]')];const cur=cp.querySelector('[data-cmd-idx].selected');let i=cur?items.indexOf(cur):-1;i+=e.key==='ArrowDown'?1:-1;if(i<0)i=items.length-1;if(i>=items.length)i=0;items.forEach(el=>el.classList.remove('selected'));items[i]?.classList.add('selected');items[i]?.scrollIntoView({block:'nearest'})}}})
document.addEventListener('click',e=>{const cp=e.target.closest('#cmdPalette, [data-cmd-idx]');if(e.target.dataset?.cmdIdx!==undefined){const cp2=$('cmdPalette');const idx=Number(e.target.dataset.cmdIdx);cp2?._cmds?.[idx]?.action?.();closeCommandPalette();return}if(!cp&&$('cmdPalette')?.classList.contains('open')){closeCommandPalette()}})
$('dialogSubmit').addEventListener('click',async(e)=>{
  if(!pendingDialog) return;
  e.preventDefault();
  const txt=$('dialogInput').value.trim();
  if(!txt){showStatus('ورودی خالی است','error');return}
  const cb=pendingDialog;
  const btn=$('dialogSubmit');
  pendingDialog=null;
  btn.disabled=true;
  try{
    await cb(txt);
    $('inputDialog').close('ok');
  }catch(err){
    showStatus(err.message||'خطا در ثبت اطلاعات','error');
    pendingDialog=cb;
  }finally{
    btn.disabled=false;
  }
})
$('editSubmit').addEventListener('click',async(e)=>{
  if(!pendingEdit) return;
  e.preventDefault();
  const cb=pendingEdit;
  const btn=$('editSubmit');
  pendingEdit=null;
  btn.disabled=true;
  try{
    await cb();
    $('editDialog').close('ok');
  }catch(err){
    showStatus(err.message||'خطا در ذخیره ویرایش','error');
    pendingEdit=cb;
  }finally{
    btn.disabled=false;
  }
})
setInterval(()=>{
  if(!isAdminMode && currentTab==='orders' && currentOrderId){ refreshCurrentOrderSilently(); }
  if(isAdminMode && currentAdminTab==='settings'){ loadAdmin(); }
},60000);
// Capture-phase click handler for toggle and optimistic buy flows.
document.addEventListener('click',async function(e){
  const t=e.target.closest('#toggleCardMode,[data-toggle-card-mode],[data-buy],[data-buy-wallet]');
  if(!t) return;
  // Toggle card mode
  if(t.id==='toggleCardMode' || t.dataset.toggleCardMode!==undefined){
    e.preventDefault(); e.stopPropagation();
    const newMode = productCardMode==='compact'?'detailed':'compact';
    setProductCardMode(newMode);
    return;
  }
  // Optimistic buy handler
  if(t.dataset.buy||t.dataset.buyWallet){
    e.preventDefault(); e.stopPropagation();
    if(!confirm('آیا از ثبت سفارش خود مطمئن هستید؟')) return;
    closePreviewSheet();
    const pid = Number(t.dataset.buy||t.dataset.buyWallet);
    const variantId = t.dataset.variant?Number(t.dataset.variant):null;
    const p = (state.shop_products||[]).find(x=>Number(x.id)===Number(pid));
    const tmpId = 'tmp_'+Date.now();
    const price = variantId ? ((p.variants||[]).find(v=>Number(v.id)===variantId)?.price||p.price) : p.price;
    const tmpOrder = {id: tmpId, display_name: p?.name||'سفارش', status:'pending_payment', final_amount:price, created_at:new Date().toISOString(), image_url:p?.image_url};
    state.orders = state.orders || [];
    state.orders.unshift(tmpOrder);
    renderUser();
    try{
      await api('create_order',{product_id:pid,variant_id:variantId,use_wallet:t.dataset.buyWallet?1:0});
      state = await api('me'); applyTheme(state); currentTab='orders'; currentOrderId = state.order?.id||null; renderUser();
    }catch(err){
      state.orders = (state.orders||[]).filter(o=>o.id!==tmpId);
      showStatus(err.message||'خطا در ثبت سفارش','error'); renderUser();
    }
  }
}, true);

/* ===== Quick-win: skeleton loading ===== */
function showSkeleton(){
  // Use an overlay so userApp's real children (brandTitle etc.) are NOT destroyed
  let sk=document.getElementById('skeletonOverlay');
  if(!sk){
    sk=document.createElement('div');
    sk.id='skeletonOverlay';
    sk.className='skeleton-overlay';
    sk.innerHTML=`<div class="skeleton-wrap">
    <div class="skeleton-hero sk"></div>
    <div class="skeleton-stats">
      <div class="sk sk-card"></div><div class="sk sk-card"></div><div class="sk sk-card"></div>
    </div>
    <div class="skeleton-row">
      <div class="sk sk-title"></div>
      <div class="skeleton-cards">
        <div class="sk sk-product"></div><div class="sk sk-product"></div><div class="sk sk-product"></div>
      </div>
    </div>
    <div class="skeleton-row">
      <div class="sk sk-title"></div>
      <div class="skeleton-cards">
        <div class="sk sk-product"></div><div class="sk sk-product"></div>
      </div>
    </div>
  </div>`;
    (document.querySelector('.app-shell')||document.body).appendChild(sk);
  }
  sk.classList.remove('hidden');
}
function hideSkeleton(){
  const sk=document.getElementById('skeletonOverlay');
  if(sk) sk.classList.add('hidden');
}

/* ===== Quick-win: flash sale live countdown ===== */
let _flashInterval=null;
function startFlashCountdowns(){
  clearInterval(_flashInterval);
  _flashInterval=setInterval(()=>{
    document.querySelectorAll('[data-flash-pid]').forEach(el=>{
      const p=(state?.shop_products||[]).find(x=>Number(x.id)===Number(el.dataset.flashPid));
      if(p) el.textContent=flashSaleCountdown(p);
    });
  },1000);
}

/* ===== Quick-win: back-to-top button ===== */
function initBackToTop(){
  const btn=document.createElement('button');
  btn.id='backToTop';
  btn.className='back-to-top hidden';
  btn.setAttribute('aria-label','بازگشت به بالا');
  btn.innerHTML='↑';
  document.body.appendChild(btn);
  btn.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
  window.addEventListener('scroll',()=>{
    btn.classList.toggle('hidden',window.scrollY<300);
  },{passive:true});
}

/* ===== Quick-win: order row long-press delegation ===== */
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-order-quick-copy],[data-order-quick-support]');
  if(!b) return;
  e.preventDefault(); e.stopPropagation();
  if(b.dataset.orderQuickCopy!==undefined){ copyText('#'+b.dataset.orderQuickCopy); closeShareSheet(); return; }
  if(b.dataset.orderQuickSupport!==undefined){
    const u=state?.support_username;
    if(u){try{tg?.openTelegramLink?.('https://t.me/'+u)}catch(_){location.href='https://t.me/'+u}}
    closeShareSheet(); return;
  }
},true);

/* ===== Quick-win: haptic on tab & cat clicks ===== */
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-tab],[data-tab-jump],[data-cat],[data-shop-sort],[data-shop-toggle]');
  if(t) haptic('light');
},{passive:true,capture:false});

async function load(){
  showSkeleton();
  try{
    if(isAdminMode){
      adminState=await api('admin_summary');
      applyTheme(adminState.settings||{});
      $('userApp').classList.add('hidden');
      $('adminApp').classList.remove('hidden');
      loadAdmin();
    } else {
      state=await api('me');
      render(state);
    }
  }catch(e){
    const app=$('userApp');
    if(app) app.innerHTML=`<div class="error-state"><p>⚠️ ${esc(e.message||'خطا در بارگذاری')}</p><button class="primary" onclick="location.reload()">تلاش مجدد</button></div>`;
    app?.classList.remove('hidden');
  }
}
load();attachPullToRefresh();setInterval(startAdminLivePolling,30000);updateCartFab();attachLongPress();initBackToTop();setTimeout(()=>{if(!isAdminMode)showOnboarding()},800);setInterval(()=>{if(currentTab==='shop'||currentTab==='product'){renderShopSections&&0;startFlashCountdowns();}},60000);
