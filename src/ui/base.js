/*
 * ui/base.js — shared UI state, helpers, the phone chrome and event routing.
 * App screens live in the other ui/*.js files and register themselves on U.
 * The UI reads the canonical state and calls engine functions; it never
 * changes the wallet directly.
 */
(function (root) {
  const RLS = root.RLS;
  const E = RLS.engine, M = RLS.money, D = RLS.data, I = RLS.i18n;
  const U = (RLS.U = RLS.U || { apps: {}, views: {}, A: {}, IN: {}, LIVE: new Set(), sheets: {} });
  const L = I.L;
  const t = (id, en) => I.t(id, en);
  const SAVE_KEY = 'rls-save-v' + E.STATE_VERSION, OLD_SAVE = 'rls-save-v3', LANG_KEY = 'rls-lang';

  // ── helpers ─────────────────────────────────────────────────────────
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const T = (x) => esc(L(x)); // bilingual object → escaped text
  function ic(name, cls = '') {
    const node = (RLS.ICONS || {})[name];
    if (!node) return '';
    const kids = node.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('');
    return `<svg class="i ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${kids}</svg>`;
  }
  const STATUS = { VERIFIED: ['Terverifikasi', 'Verified'], ESTIMATED: ['Perkiraan', 'Estimated'], ILLUSTRATIVE: ['Ilustratif', 'Illustrative'], UNAVAILABLE: ['Tidak tersedia', 'Unavailable'] };
  const pill = (status) => `<span class="pill st-${status}">${esc(t(...(STATUS[status] || [status, status])))}</span>`;
  const fmt = (v, o) => M.format(v, o);
  const short = (v) => (I.lang === 'en' ? M.formatShort(v).replace(',', '.').replace(' jt', 'm').replace(' rb', 'k') : M.formatShort(v));
  const src = (id) => D.sourceById[id];
  const srcLink = (id) => { const s = src(id); if (!s) return `<span class="muted">${t('Tanpa sumber', 'No source')}</span>`; return s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.publisher)}</a>` : esc(s.publisher); };
  const pct = (x) => (Math.round(x * 1000) / 10).toLocaleString(I.lang === 'en' ? 'en-US' : 'id-ID') + '%';
  const num = (x, d = 0) => Number(x).toLocaleString(I.lang === 'en' ? 'en-US' : 'id-ID', { maximumFractionDigits: d, minimumFractionDigits: d });
  function storageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
  function storageSet(k, v) { try { localStorage.setItem(k, v); } catch { /* unavailable */ } }
  function storageDel(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
  const bar = (v, cls = '') => `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, v))}%"></i></div>`;
  const meter = (label, v, bad) => `<div class="meter-row"><span>${esc(label)}</span>${bar(v, bad ? (v > 65 ? 'bad' : v > 40 ? 'warm' : '') : v < 35 ? 'bad' : v < 55 ? 'warm' : '')}<b class="num">${Math.round(v)}</b></div>`;
  Object.assign(U, { esc, T, t, L, ic, pill, fmt, short, srcLink, src, pct, num, bar, meter, storageGet, storageSet, storageDel });

  // ── apps ────────────────────────────────────────────────────────────
  const bi = I.bi;
  U.APPS = {
    bank: { name: bi('PayDay Bank', 'PayDay Bank'), short: bi('PayDay', 'PayDay'), icon: 'Landmark', color: '#0f6e69' },
    bills: { name: bi('Tagihan', 'Bills'), icon: 'Receipt', color: '#b4532a' },
    homebase: { name: bi('HomeBase', 'HomeBase'), icon: 'Home', color: '#8a5a2b' },
    utility: { name: bi('Utility Hub', 'Utility Hub'), short: bi('Utilitas', 'Utility'), icon: 'Zap', color: '#c47f00' },
    move: { name: bi('Move', 'Move'), icon: 'Bus', color: '#2557a7' },
    dailymart: { name: bi('DailyMart', 'DailyMart'), icon: 'ShoppingBasket', color: '#2a7d4a' },
    dapur: { name: bi('Dapur', 'Kitchen'), icon: 'ChefHat', color: '#a0522d' },
    quickbite: { name: bi('QuickBite', 'QuickBite'), icon: 'UtensilsCrossed', color: '#c8473d' },
    shopsquare: { name: bi('ShopSquare', 'ShopSquare'), short: bi('Shop', 'Shop'), icon: 'ShoppingBag', color: '#3b4a8f' },
    glow: { name: bi('Glow', 'Glow'), icon: 'Sparkles', color: '#b0477a' },
    care: { name: bi('Sehat', 'Care'), icon: 'HeartPulse', color: '#cf3f57' },
    connect: { name: bi('Koneksi', 'Connect'), icon: 'Wifi', color: '#1f7a9c' },
    afterhours: { name: bi('AfterHours', 'AfterHours'), short: bi('After', 'After'), icon: 'Ticket', color: '#6c3fb5' },
    jelajah: { name: bi('Jelajah', 'Jelajah'), icon: 'Plane', color: '#0e7c86' },
    berkas: { name: bi('Berkas', 'Berkas'), icon: 'FileText', color: '#55606b' },
    appy: { name: bi('Appy', 'Appy'), icon: 'Briefcase', color: '#e0662a' },
    workday: { name: bi('Kerja', 'Workday'), icon: 'BadgeCheck', color: '#33505a' },
    pinjam: { name: bi('Pinjam', 'Borrow'), icon: 'HandCoins', color: '#8b3a3a' },
    futureme: { name: bi('FutureMe', 'FutureMe'), icon: 'PiggyBank', color: '#4c8c2b' },
    recurring: { name: bi('Langganan', 'Subscriptions'), short: bi('Langganan', 'Subs'), icon: 'Repeat', color: '#5a5f6b' },
    aku: { name: bi('Aku', 'Me'), icon: 'User', color: '#7a4fa0' },
    calendar: { name: bi('Kalender', 'Calendar'), icon: 'CalendarDays', color: '#d0442f' },
    report: { name: bi('Laporan', 'Report'), icon: 'BarChart3', color: '#0d4d63' },
    compare: { name: bi('Bandingkan', 'Compare'), icon: 'Scale', color: '#7a6a1c' },
    sources: { name: bi('Sumber', 'Sources'), icon: 'BookOpen', color: '#44545a' },
    settings: { name: bi('Pengaturan', 'Settings'), icon: 'Settings', color: '#606a6c' },
  };
  U.GRID = ['aku', 'appy', 'workday', 'homebase', 'utility', 'move', 'quickbite', 'shopsquare', 'glow', 'care', 'afterhours', 'jelajah', 'berkas', 'pinjam', 'futureme', 'connect', 'recurring', 'bills', 'report', 'compare', 'sources', 'settings'];
  U.DOCK = ['bank', 'dailymart', 'dapur', 'calendar'];
  const NOTIF_APP = { messages: 'calendar' };
  U.appFor = (n) => (U.APPS[n.app] ? n.app : NOTIF_APP[n.app] || 'bank');

  // ── UI state (never money) ──────────────────────────────────────────
  U.G = null;
  U.ui = { screen: 'setup', step: 0, draft: E.defaultConfig(), provQ: '', seed: '', app: null, sub: {}, recent: [], nc: false, switcher: false, sheet: null, toast: null, banner: null,
    carts: {}, store: {}, compare: { a: 'jkt_selatan', b: 'banjarnegara', housing: 'kost_typical', view: 'B', basket: 'everyday' }, eventOpen: false, scroll: {} };
  const ui = U.ui;

  // ── persistence & language ──────────────────────────────────────────
  U.save = () => { if (U.G) storageSet(SAVE_KEY, E.serialize(U.G)); };
  U.loadSaved = () => { const raw = storageGet(SAVE_KEY) || storageGet(OLD_SAVE); if (!raw) return null; return E.deserialize(raw); };
  U.clearSave = () => { storageDel(SAVE_KEY); storageDel(OLD_SAVE); };
  U.setLang = (l) => { I.setLang(l); storageSet(LANG_KEY, I.lang); document.documentElement.lang = I.lang; };
  U.initLang = () => { const l = storageGet(LANG_KEY); U.setLang(l === 'en' ? 'en' : 'id'); };

  // ── toast & banner ──────────────────────────────────────────────────
  let toastTimer = null, bannerTimer = null;
  U.toast = (msg, bad = false) => { ui.toast = { msg, bad }; clearTimeout(toastTimer); toastTimer = setTimeout(() => { ui.toast = null; U.render(); }, 2800); };
  U.showLatestBanner = (prevCount) => {
    const G = U.G;
    if (!G) return;
    const fresh = G.notifications.slice(0, Math.max(0, G.notifications.length - prevCount));
    const pick = fresh.find((n) => n.tone === 'pay') || fresh.find((n) => n.tone === 'event') || fresh.find((n) => n.tone === 'urge') || fresh.find((n) => n.tone === 'warn') || fresh[0];
    if (!pick) return;
    ui.banner = pick.id;
    clearTimeout(bannerTimer);
    if (pick.tone !== 'pay') bannerTimer = setTimeout(() => { ui.banner = null; U.render(); }, 4500);
  };
  const ERR = {
    insufficient_funds: ['Ditolak: saldo kurang', 'Declined: not enough balance'], already_paid: ['Sudah dibayar.', 'Already paid.'], offline: ['Tidak ada koneksi. Beli paket data atau pakai Wi-Fi.', 'No connection. Buy mobile data or use Wi-Fi.'],
    event_pending: ['Putuskan kejadian yang terbuka dulu.', 'Decide on the open event first.'], included_in_rent: ['Listrik sudah termasuk sewa.', 'Electricity is included in your rent.'],
    postpaid_meter: ['Meteranmu pascabayar.', 'Your meter is postpaid.'], empty_cart: ['Keranjang kosong.', 'Your cart is empty.'], insufficient_savings: ['Tabunganmu tidak sebanyak itu.', 'Not that much saved.'],
    out_of_stock: ['Ada barang yang stoknya habis hari ini.', 'An item is out of stock today.'], item_unavailable: ['Barang ini tidak tersedia untukmu.', 'This item is not available to you.'], delivery_unavailable: ['Opsi pengiriman ini tidak tersedia.', 'That delivery option is unavailable.'],
    no_time: ['Waktu luangmu hari ini sudah habis.', 'No free time left today.'], cannot_cook: ['Tidak bisa memasak menu itu sekarang.', 'You can\'t cook that right now.'], already_eaten: ['Waktu makan itu sudah terisi.', 'That meal is already covered.'],
    not_eligible: ['Belum memenuhi syarat wajib.', 'Mandatory requirements not met.'], too_tired: ['Terlalu lelah untuk melamar sekarang.', 'Too tired to apply right now.'], already_applied: ['Sudah melamar.', 'Already applied.'],
    missing_prereq: ['Ada syarat dokumen yang belum ada.', 'A prerequisite is missing.'], needs_leave: ['Ini harus didatangi langsung saat jam kerja. Ambil izin/cuti dulu di aplikasi Kerja, atau tunggu hari libur.', 'This needs an in-person visit during work hours. Take leave first in Workday, or wait for a day off.'],
    processing: ['Masih diproses.', 'Still processing.'], unavailable: ['Belum tersedia.', 'Not available.'], no_offer: ['Tidak ada tawaran aktif.', 'No active offer.'], invalid_amount: ['Jumlah tidak valid.', 'Invalid amount.'],
    requirements: ['Masih ada syarat yang belum terpenuhi.', 'Some requirements are not met yet.'], too_early: ['Kartu kedatangan baru bisa diisi 3 hari sebelum tiba.', 'Arrival cards open 3 days before arrival.'], not_working: ['Hari ini kamu tidak dijadwalkan kerja.', 'You are not scheduled to work today.'],
    no_helper: ['Tidak ada yang bisa membantu memasak.', 'Nobody is available to help cook.'], too_small: ['Tempat ini terlalu kecil untuk rumah tanggamu.', 'This place is too small for your household.'], needs_skill: ['Butuh literasi digital menengah atau keahlian kreatif.', 'Needs intermediate digital literacy or a creative skill.'],
    no_jkn: ['Kamu tidak punya JKN aktif.', 'You have no active JKN.'], not_claimable: ['Belum bisa diklaim.', 'Not claimable yet.'], needs_paklaring: ['Butuh paklaring.', 'Needs a paklaring.'], unavailable_area: ['Layanan ini tidak menjangkau daerahmu.', 'This service doesn\'t reach your area.'],
  };
  U.result = (res, okMsg) => {
    if (res && res.ok) { if (okMsg) U.toast(okMsg); return true; }
    const e = res && res.error;
    let msg = ERR[e] ? t(...ERR[e]) : t('Tidak berhasil.', 'That did not go through.');
    if (e === 'insufficient_funds' && res.shortBy) msg = t(`Ditolak: kurang ${fmt(res.shortBy)}.`, `Declined: ${fmt(res.shortBy)} short.`);
    if (res && res.reasons && res.reasons.length) msg += ' ' + res.reasons.map(L).join(' · ');
    if (res && res.missing && res.missing.length && e !== 'not_eligible') msg += ' ' + res.missing.map((m) => L(m.label)).join(', ');
    U.toast(msg, true);
    return false;
  };

  // ── navigation ──────────────────────────────────────────────────────
  U.openApp = (id, sub) => {
    ui.app = id; ui.nc = false; ui.switcher = false; ui.sheet = null;
    if (sub) ui.sub[id] = { ...(ui.sub[id] || {}), ...sub };
    ui.recent = [id, ...ui.recent.filter((x) => x !== id)].slice(0, 8);
    if (id === 'bank' && U.G) { const pay = U.G.notifications.find((n) => n.tone === 'pay'); if (pay && ui.banner === pay.id) ui.banner = null; }
  };
  U.goHome = () => { ui.app = null; ui.nc = false; ui.switcher = false; ui.sheet = null; };
  U.back = () => {
    if (ui.sheet) { ui.sheet = null; return; }
    if (ui.nc) { ui.nc = false; return; }
    if (ui.switcher) { ui.switcher = false; return; }
    if (ui.app) {
      const st = ui.store[ui.app];
      if (st && st.view && st.view !== 'browse') { st.view = 'browse'; return; }
      const sb = ui.sub[ui.app];
      if (sb && sb.detail) { sb.detail = null; return; }
      U.goHome();
    }
  };
  U.sub = (app, key, dflt) => ((ui.sub[app] || {})[key] ?? dflt);
  U.setSub = (app, patch) => { ui.sub[app] = { ...(ui.sub[app] || {}), ...patch }; };

  // ── frame pieces ────────────────────────────────────────────────────
  U.frame = (id, body, opts = {}) => {
    const a = U.APPS[id];
    return `<section class="app" aria-label="${T(a.name)}">
      <div class="app-head"><button class="back" data-a="back" aria-label="${t('Kembali', 'Back')}">${ic('ChevronLeft')}${esc(opts.backLabel || t('Beranda', 'Home'))}</button>
        <h2>${esc(opts.title || L(a.name))}</h2>
        <div class="bal">${t('Saldo', 'Balance')}<b class="num">${fmt(U.G.wallet)}</b></div></div>
      ${opts.tabs || ''}
      <div class="app-body" data-scroll="app:${id}:${opts.scrollKey || ''}">${body}</div>
      ${opts.foot || ''}
    </section>`;
  };
  U.tabs = (app, list, cur) => `<div class="tabs" role="tablist">${list.map(([k, l]) => `<button class="chip ${cur === k ? 'on' : ''}" role="tab" aria-selected="${cur === k}" data-a="tab" data-app="${app}" data-x="${k}">${esc(L(l))}</button>`).join('')}</div>`;
  U.appTile = (id, size = 38) => { const a = U.APPS[id] || U.APPS.settings; return `<span class="tile" style="background:${a.color};width:${size}px;height:${size}px">${ic(a.icon)}</span>`; };
  U.seg = (action, key, cur, opts) => `<div class="seg">${opts.map(([v, l]) => `<button class="${String(cur) === String(v) ? 'on' : ''}" data-a="${action}" data-k="${key}" data-x="${v}">${esc(L(l))}</button>`).join('')}</div>`;
  U.sw = (action, key, on, label) => `<button class="sw ${on ? 'on' : ''}" data-a="${action}" data-x="${key}" role="switch" aria-checked="${!!on}" aria-label="${esc(label || key)}"></button>`;
  U.reqList = (items) => `<div class="reqs">${items.map((r) => `<div class="req ${r.ok ? 'ok' : r.optional || r.info ? 'opt' : 'no'}">${ic(r.ok ? 'Check' : r.optional || r.info ? 'Info' : 'X')}<span>${T(r.label)}</span>${r.fix && !r.ok ? `<button class="btn ghost sm" data-a="fix" data-x="${r.fix}" data-doc="${r.doc || ''}">${t('Urus', 'Fix')}</button>` : ''}</div>`).join('')}</div>`;

  // ── render ──────────────────────────────────────────────────────────
  U.render = () => {
    const rootEl = document.getElementById('app');
    const sc = rootEl.querySelector('[data-scroll]');
    if (sc) ui.scroll[sc.dataset.scroll] = sc.scrollTop;
    const af = document.activeElement;
    const focusId = af && af.id && rootEl.contains(af) ? af.id : null;
    const sel = focusId && af.selectionStart != null ? [af.selectionStart, af.selectionEnd] : null;
    rootEl.innerHTML = stageView();
    const sc2 = rootEl.querySelector('[data-scroll]');
    if (sc2 && ui.scroll[sc2.dataset.scroll] != null) sc2.scrollTop = ui.scroll[sc2.dataset.scroll];
    if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus(); if (sel && el.setSelectionRange) try { el.setSelectionRange(sel[0], sel[1]); } catch { /* */ } } }
    U.updateClock();
  };
  function stageView() {
    return `<div class="stage">
      <aside class="side left" aria-label="${t('Ringkasan', 'Summary')}">${U.caseFile()}</aside>
      <div class="device"><div class="screen" role="application" aria-label="Real Life Simulator">${screenView()}</div></div>
      <aside class="side right" aria-label="${t('Transaksi terbaru', 'Recent transactions')}">${U.tapeView()}</aside>
    </div>`;
  }
  function screenView() {
    const G = U.G;
    if (!G || ui.screen === 'setup') return U.setupView();
    const onWall = !ui.app && !ui.nc;
    const inner = ui.app ? (U.apps[ui.app] ? U.apps[ui.app]() : U.frame('settings', '<div class="empty">?</div>')) : U.homeView();
    return `${onWall ? '<div class="wall" aria-hidden="true"></div>' : ''}
      ${U.statusBar(onWall)}
      <div class="view">${inner}</div>
      <div class="homebar ${onWall ? 'on-wall' : ''}"><button data-a="home" data-dbl="switcher" aria-label="${t('Ke beranda. Ketuk dua kali untuk aplikasi terbaru', 'Go home. Double-tap for recent apps')}"></button></div>
      ${bannerView()}${ui.nc ? ncView() : ''}${ui.switcher ? switcherView() : ''}${sheetView()}${eventView()}
      ${ui.toast ? `<div class="toast ${ui.toast.bad ? 'bad' : ''}" role="status">${esc(ui.toast.msg)}</div>` : ''}`;
  }
  U.langChip = (onWall) => `<button class="lang ${onWall ? 'on-wall' : ''}" data-a="lang" aria-label="${t('Ganti bahasa ke English', 'Switch language to Bahasa Indonesia')}"><b class="${I.lang === 'id' ? 'cur' : ''}">ID</b><b class="${I.lang === 'en' ? 'cur' : ''}">EN</b></button>`;
  U.statusBar = (onWall) => {
    const G = U.G;
    const power = E.electricityOn(G);
    const batt = G.owned.phoneCondition <= 0 ? 0 : power ? 82 : 14;
    const online = E.isOnline(G);
    const unread = G.notifications.filter((n) => !n.read).length;
    return `<div class="status ${onWall ? 'on-wall' : ''}">
      <button data-a="nc" aria-label="${t('Notifikasi', 'Notifications')} (${unread})"><span id="clock">--:--</span>${unread ? `<span class="unread">${unread}</span>` : ''}</button>
      <span class="notch" aria-hidden="true"></span>
      <span class="right">${U.langChip(onWall)}
        ${online ? ic(E.hasWifi(G) ? 'Wifi' : 'Signal') : `<span class="tiny" title="${t('Tidak ada koneksi', 'No connection')}">${ic('WifiOff')}</span>`}
        <span class="batt ${batt < 20 ? 'low' : ''}" aria-label="${t('Baterai', 'Battery')} ${batt}%"><b><i style="width:${batt}%"></i></b></span></span>
    </div>`;
  };
  U.updateClock = () => { const el = document.getElementById('clock'); if (!el) return; const d = new Date(); el.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

  function bannerView() {
    const G = U.G;
    if (!ui.banner || ui.nc || ui.sheet || ui.eventOpen) return '';
    const n = G.notifications.find((x) => x.id === ui.banner);
    if (!n) return '';
    if (n.tone === 'pay') {
      const amt = L(n.body).match(/\+Rp[\d.]+/);
      return `<button class="banner pay" data-a="open" data-x="bank">${U.appTile('bank')}
        <span style="flex:1;min-width:0"><span class="t">${t('GAJIAN', 'PAYDAY')} <span>${esc(E.dateLabel({ year: G.date.year, month: G.date.month, day: n.day }))}</span></span>
        <span class="b">${t('Gajimu sudah masuk.', 'Your salary has arrived.')}</span><div class="amt">${amt ? esc(amt[0]) : ''}</div></span></button>`;
    }
    return `<button class="banner ${n.tone === 'urge' ? 'urge' : ''}" data-a="notif" data-x="${n.id}">${U.appTile(U.appFor(n))}
      <span style="flex:1;min-width:0"><span class="t">${T(n.title)} <span>${t('baru', 'now')}</span></span><span class="b">${T(n.body)}</span></span></button>`;
  }
  function ncView() {
    const G = U.G;
    const items = G.notifications.slice(0, 70).map((n) => `<button class="ncard" data-a="notif" data-x="${n.id}">${U.appTile(U.appFor(n), 32)}
      <span style="flex:1;min-width:0"><span class="t">${T(n.title)} <span>${t('Hari', 'Day')} ${n.day}${n.month !== G.monthIndex ? ' · ' + t('bln lalu', 'last month') : ''}</span></span><span class="b">${T(n.body)}</span></span></button>`).join('');
    return `<div class="nc" role="dialog" aria-label="${t('Pusat notifikasi', 'Notification centre')}">
      <div class="row"><h2 class="nc-h">${t('Notifikasi', 'Notifications')}</h2><button class="btn sm sec" data-a="nc-clear">${t('Tandai dibaca', 'Mark read')}</button><button class="btn sm" data-a="nc">${t('Tutup', 'Close')}</button></div>
      <div class="scroll" data-scroll="nc">${items || `<div class="empty">${t('Belum ada.', 'Nothing yet.')}</div>`}</div></div>`;
  }
  function switcherView() {
    const cards = ui.recent.map((id) => { const a = U.APPS[id]; return `<button class="sw-card" data-a="open" data-x="${id}"><span class="top" style="background:${a.color}"><span class="tile">${ic(a.icon)}</span>${T(a.name)}</span><span class="bodyp">${esc(U.appSummary(id))}</span></button>`; }).join('');
    return `<div class="switcher" role="dialog" aria-label="${t('Aplikasi terbaru', 'Recent apps')}"><div class="row" style="color:#fff"><b style="flex:1;font-size:18px">${t('Aplikasi terbaru', 'Recent apps')}</b><button class="btn sm sec" data-a="switcher">${t('Tutup', 'Close')}</button></div>
      <div class="cards">${cards || `<div class="empty" style="color:#fff">${t('Buka aplikasi dulu.', 'Open an app first.')}</div>`}</div></div>`;
  }
  U.appSummary = (id) => {
    const G = U.G;
    switch (id) {
      case 'bank': return t(`Saldo ${fmt(G.wallet)}`, `Balance ${fmt(G.wallet)}`);
      case 'bills': { const b = E.billsThisMonth(G).filter((x) => x.status !== 'paid'); return t(`${b.length} tagihan belum dibayar`, `${b.length} unpaid bill(s)`); }
      case 'futureme': return t(`Tabungan ${fmt(G.savings)}`, `Savings ${fmt(G.savings)}`);
      case 'appy': return t(`${G.appy.listings.length} lowongan`, `${G.appy.listings.length} listings`);
      case 'aku': return t(`Kesejahteraan ${G.mood.wellbeing}/100`, `Wellbeing ${G.mood.wellbeing}/100`);
      default: return L(U.APPS[id].name);
    }
  };
  function sheetView() {
    if (!ui.sheet) return '';
    const fn = U.sheets[ui.sheet.type];
    const inner = fn ? fn(ui.sheet) : '';
    if (!inner) return '';
    return `<div class="overlay" data-a="sheet-close" data-self="1"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${inner}<button class="btn sec" data-a="sheet-close">${t('Tutup', 'Close')}</button></div></div>`;
  }
  function eventView() {
    const G = U.G;
    if (!G.activeEvent || !ui.eventOpen) return '';
    const ev = G.activeEvent;
    return `<div class="overlay"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="evt"><div class="grab"></div>
      <div class="row">${U.appTile(U.APPS[ev.app] ? ev.app : 'calendar', 36)}<span class="small muted">${t('Hari', 'Day')} ${ev.day} · ${t('keputusan', 'decision')}</span></div>
      <h3 id="evt">${T(ev.title)}</h3><p class="evbody">${T(ev.body)}</p>
      ${ev.choices.map((ch, i) => `<button class="choice" data-a="choose" data-x="${i}"><span>${T(ch.label)}${ch.note ? `<br><span class="small muted">${T(ch.note)}</span>` : ''}</span><b>${ch.cost > 0 ? fmt(-ch.cost) : ch.cost < 0 ? fmt(-ch.cost, { plus: true }) : 'Rp0'}</b></button>`).join('')}
      <small class="muted">${pill('ILLUSTRATIVE')} ${t('Nominal kejadian adalah nilai permainan.', 'Event amounts are gameplay values.')} ${t('Saldo', 'Balance')}: ${fmt(G.wallet)}.</small>
      <button class="btn ghost" data-a="event-close">${t('Putuskan nanti', 'Decide later')}</button></div></div>`;
  }

  // ── side panels (desktop) ───────────────────────────────────────────
  U.caseFile = () => {
    const G = U.G;
    let html = `<div class="brand"><h1>Real Life<br>Simulator</h1><p>${t('Gajimu tetap. Pengeluaranmu tidak.', 'Your salary is fixed. Your expenses aren\'t.')}</p>
      <div class="tag">${t('Mampu hidup layak, atau hanya bertahan?', 'Can you afford to live, or only afford to survive?')}</div></div>`;
    if (!G) return html + `<div class="card-paper"><h2>${t('Cara main', 'How it works')}</h2><small>${t('Buat karaktermu, pilih kota di Indonesia, lalu jalani sebulan dengan upah minimum 2026 setempat. Semua angka diberi label Terverifikasi, Perkiraan, atau Ilustratif; aplikasi Sumber menunjukkan asalnya.', 'Create your character, pick a city in Indonesia and live a month on its 2026 minimum wage. Every figure is labelled Verified, Estimated or Illustrative; the Sources app shows where it came from.')}</small></div>`;
    const { city, province } = E.getLocality(G.config.cityId);
    const w = E.resolveWage(G.config.cityId);
    const ch = G.config.character;
    const job = G.job;
    html += `<div class="card-paper"><h2>${t('Berkas karakter', 'Case file')}</h2>
      <div class="kv"><span>${t('Kota', 'Place')}</span><span>${esc(city.name)}, ${esc(province.name)}</span></div>
      <div class="kv"><span>${t('Profil', 'Profile')}</span><span>${ch.age} ${t('th', 'y')} · ${T(D.jobs.eduById[ch.education].label)}</span></div>
      <div class="kv"><span>${t('Upah minimum', 'Wage floor')}</span><span class="num">${fmt(w.amount, { exact: true })}</span></div>
      <div class="kv"><span>${t('Pekerjaan', 'Job')}</span><span>${job ? T(job.title) : t('Belum bekerja', 'Not working')}</span></div>
      <div class="kv"><span>${t('Rumah tangga', 'Household')}</span><span>${E.members(G).people} ${t('orang', 'people')}</span></div>
      <div class="kv"><span>Seed</span><span class="num">${G.seed}</span></div>
      <small>${t('Upah minimum adalah batas bawah hukum. Banyak pekerja dibayar lebih, sebagian dibayar kurang, dan gaji bersih lebih kecil setelah potongan.', 'A minimum wage is a legal floor. Many workers earn more, some are paid less, and take-home pay is lower after deductions.')}</small></div>`;
    const m = G.mood;
    html += `<div class="card-paper"><h2>${t('Hari ini', 'Today')}</h2>${U.meter(t('Kesejahteraan', 'Wellbeing'), m.wellbeing)}${U.meter(t('Energi', 'Energy'), m.energy)}${U.meter(t('Stres', 'Stress'), m.stress, true)}${U.meter(t('Godaan belanja', 'Temptation'), m.temptation, true)}</div>`;
    return html;
  };
  U.tapeView = () => {
    const G = U.G;
    if (!G) return `<div class="tape"><h2>— ${t('STRUK', 'RECEIPT TAPE')} —</h2><small>${t('Transaksi tercetak di sini selama bermain.', 'Transactions print here as you play.')}</small></div>`;
    const rows = G.transactions.filter((x) => x.cls !== 'opening').slice(0, 18).map((x) => `<div class="tape-row ${x.status === 'failed' ? 'failed' : ''}"><span class="m">${x.day} · ${T(x.merchant)}</span><span class="${x.amount > 0 ? 'pos' : 'neg'}">${fmt(x.amount, { plus: x.amount > 0 })}</span></div>`).join('');
    return `<div class="tape"><h2>— PAYDAY BANK —</h2>${rows || `<small>${t('Belum ada transaksi.', 'No transactions yet.')}</small>`}
      <div class="tape-row tot"><span>${t('SALDO', 'BALANCE')}</span><span>${fmt(G.wallet)}</span></div><div class="tape-row tot"><span>${t('TABUNGAN', 'SAVINGS')}</span><span>${fmt(G.savings)}</span></div>
      ${E.debtOutstanding(G) ? `<div class="tape-row tot"><span>${t('UTANG', 'DEBT')}</span><span>${fmt(E.debtOutstanding(G))}</span></div>` : ''}</div>
      <small>${t('Keyboard: Esc untuk kembali.', 'Keyboard: Esc goes back.')}</small>`;
  };

  // ── shared actions ──────────────────────────────────────────────────
  U.after = (prev) => { U.showLatestBanner(prev); U.save(); };
  U.prev = () => (U.G ? U.G.notifications.length : 0);
  Object.assign(U.A, {
    home() { U.goHome(); }, back() { U.back(); },
    lang() { U.setLang(I.lang === 'id' ? 'en' : 'id'); },
    switcher() { ui.switcher = !ui.switcher; ui.nc = false; },
    nc() { ui.nc = !ui.nc; ui.switcher = false; if (ui.nc) ui.banner = null; },
    'nc-clear'() { U.G.notifications.forEach((n) => { n.read = true; }); U.save(); },
    notif(el) {
      const G = U.G;
      const n = G.notifications.find((x) => x.id === el.dataset.x);
      if (!n) return;
      n.read = true; ui.banner = null;
      if (n.tone === 'event' && G.activeEvent) { ui.eventOpen = true; ui.nc = false; }
      else if (n.urgeId) { const u = G.urges.find((x) => x.id === n.urgeId); U.openApp(RLS.data.catalog.byId[u ? u.itemId : ''] ? RLS.data.catalog.byId[u.itemId].store : U.appFor(n)); if (u) ui.sheet = { type: 'item', id: u.itemId, urge: u.id }; }
      else if (n.orderId && U.storeState) { U.openApp(n.app); U.storeState(n.app).view = 'orders'; }
      else U.openApp(U.appFor(n));
      U.save();
    },
    open(el) { U.openApp(el.dataset.x); if (el.dataset.cat && U.storeState) U.storeState(el.dataset.x).cat = el.dataset.cat; if (el.dataset.tab) U.setSub(el.dataset.x, { tab: el.dataset.tab }); },
    tab(el) { U.setSub(el.dataset.app, { tab: el.dataset.x, detail: null }); },
    'sheet-close'(el, e) { if (el.dataset.self && e && e.target !== el) return; ui.sheet = null; },
    'event-open'() { ui.eventOpen = true; },
    'event-close'() { ui.eventOpen = false; },
    choose(el) { const p = U.prev(); if (U.result(E.resolveEvent(U.G, Number(el.dataset.x)), t('Keputusan dicatat.', 'Decision made.'))) ui.eventOpen = !!U.G.activeEvent; U.after(p); },
    fix(el) {
      const k = el.dataset.x;
      if (k === 'passport' || el.dataset.doc === 'passport') U.openApp('berkas', { tab: 'passport' });
      else if (k === 'doc') { U.openApp('berkas'); if (el.dataset.doc) ui.sheet = { type: 'doc', id: el.dataset.doc }; }
      else if (k === 'futureme') U.openApp('futureme');
      else if (k === 'course') { U.openApp('shopsquare'); U.storeState('shopsquare').cat = 'school'; }
      else if (k === 'english' || k === 'portfolio') U.openApp('appy', { tab: 'improve', detail: null });
      else if (k === 'unpaid') U.setSub('jelajah', { unpaidOk: true });
    },
  });

  // ── boot & event routing ────────────────────────────────────────────
  U.boot = () => {
    U.initLang();
    const rootEl = document.getElementById('app');
    rootEl.addEventListener('click', (e) => {
      const el = e.target.closest('[data-a]');
      if (!el || !rootEl.contains(el) || el.disabled) return;
      const fn = U.A[el.dataset.a];
      if (!fn) return;
      if (el.dataset.self && e.target !== el) return;
      if (ui.banner && el.dataset.a !== 'notif') ui.banner = null;
      fn(el, e);
      U.render();
    });
    rootEl.addEventListener('dblclick', (e) => { if (e.target.closest('[data-dbl="switcher"]')) { ui.switcher = true; U.render(); } });
    let press = null;
    rootEl.addEventListener('pointerdown', (e) => { if (e.target.closest('[data-dbl="switcher"]')) press = setTimeout(() => { ui.switcher = true; press = 'fired'; U.render(); }, 500); });
    rootEl.addEventListener('pointerup', () => { if (press && press !== 'fired') clearTimeout(press); press = null; });
    rootEl.addEventListener('input', (e) => { const el = e.target.closest('[data-in]'); if (!el || !U.IN[el.dataset.in]) return; U.IN[el.dataset.in](el); if (U.LIVE.has(el.dataset.in)) U.render(); });
    rootEl.addEventListener('change', (e) => { const el = e.target.closest('[data-in]'); if (!el || !U.IN[el.dataset.in] || U.LIVE.has(el.dataset.in)) return; U.IN[el.dataset.in](el); U.render(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (ui.eventOpen) ui.eventOpen = false; else U.back(); U.render(); } });
    setInterval(U.updateClock, 15000);
    U.render();
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
