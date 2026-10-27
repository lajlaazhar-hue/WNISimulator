/*
 * ui.js — the phone. Renders from the canonical state and calls the engine.
 * It never changes the wallet itself: every money movement is an engine call.
 */
(function (root) {
  const RLS = root.RLS;
  const E = RLS.engine, M = RLS.money, D = RLS.data;
  const fmt = (v, o) => M.format(v, o);
  const SAVE_KEY = 'rls-save-v' + E.STATE_VERSION;

  // ── tiny helpers ─────────────────────────────────────────────
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function ic(name, cls = '') {
    const node = (RLS.ICONS || {})[name];
    if (!node) return '';
    const kids = node.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('');
    return `<svg class="i ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${kids}</svg>`;
  }
  const pill = (status) => `<span class="pill st-${status}">${({ VERIFIED: 'Verified', ESTIMATED: 'Estimated', ILLUSTRATIVE: 'Illustrative', UNAVAILABLE: 'Unavailable' })[status] || status}</span>`;
  const src = (id) => D.sourceById[id];
  const srcLink = (id) => {
    const s = src(id);
    if (!s) return '<span class="muted">No source</span>';
    return s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.publisher)}</a>` : esc(s.publisher);
  };
  const pct = (x) => (Math.round(x * 1000) / 10).toLocaleString('id-ID') + '%';
  function storageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
  function storageSet(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } }
  function storageDel(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } }

  // ── apps ─────────────────────────────────────────────────────
  const APPS = {
    bank: { name: 'PayDay Bank', short: 'PayDay', icon: 'Landmark', color: '#0f6e69' },
    homebase: { name: 'HomeBase', icon: 'Home', color: '#8a5a2b' },
    utility: { name: 'Utility Hub', short: 'Utility', icon: 'Zap', color: '#d48a00' },
    move: { name: 'Move', icon: 'Bus', color: '#2557a7' },
    dailymart: { name: 'DailyMart', icon: 'ShoppingBasket', color: '#2a7d4a' },
    quickbite: { name: 'QuickBite', icon: 'UtensilsCrossed', color: '#c8473d' },
    shopsquare: { name: 'ShopSquare', short: 'Shop', icon: 'Shirt', color: '#3b4a8f' },
    glow: { name: 'Glow', icon: 'Sparkles', color: '#b0477a' },
    connect: { name: 'Connect', icon: 'Wifi', color: '#1f7a9c' },
    care: { name: 'Care', icon: 'HeartPulse', color: '#cf3f57' },
    afterhours: { name: 'AfterHours', short: 'After', icon: 'Ticket', color: '#6c3fb5' },
    futureme: { name: 'FutureMe', icon: 'PiggyBank', color: '#4c8c2b' },
    recurring: { name: 'Recurring', icon: 'Repeat', color: '#5a5f6b' },
    workday: { name: 'Workday', icon: 'Briefcase', color: '#33505a' },
    bills: { name: 'Bills', icon: 'Receipt', color: '#b4532a' },
    calendar: { name: 'Calendar', icon: 'CalendarDays', color: '#d0442f' },
    report: { name: 'Report', icon: 'BarChart3', color: '#0d4d63' },
    compare: { name: 'Compare', icon: 'Scale', color: '#7a6a1c' },
    sources: { name: 'Sources', icon: 'BookOpen', color: '#44545a' },
    settings: { name: 'Settings', icon: 'Settings', color: '#606a6c' },
  };
  const GRID = ['homebase', 'utility', 'move', 'quickbite', 'shopsquare', 'glow', 'connect', 'care', 'afterhours', 'futureme', 'recurring', 'workday', 'report', 'compare', 'sources', 'settings'];
  const DOCK = ['bank', 'dailymart', 'bills', 'calendar'];
  const NOTIF_APP = { messages: 'calendar', report: 'report', bills: 'bills' };

  // ── UI state (not money) ─────────────────────────────────────
  let G = null; // game state
  const ui = {
    screen: 'setup', step: 0, draft: E.defaultConfig(), provQ: '', cityQ: '', seed: '',
    app: null, sub: {}, recent: [], nc: false, switcher: false, sheet: null, toast: null, banner: null,
    carts: {}, store: {}, compare: { a: 'jkt_selatan', b: 'banjarnegara', housing: 'kost_typical', view: 'B', basket: 'standard' },
    eventOpen: false, scroll: {},
  };

  // ── persistence ──────────────────────────────────────────────
  function save() { if (G) storageSet(SAVE_KEY, E.serialize(G)); }
  function loadSaved() { const raw = storageGet(SAVE_KEY); if (!raw) return null; try { return E.deserialize(raw); } catch { return null; } }

  // ── toast / banner ───────────────────────────────────────────
  let toastTimer = null, bannerTimer = null;
  function toast(msg, bad = false) {
    ui.toast = { msg, bad };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { ui.toast = null; render(); }, 2600);
  }
  function showLatestBanner(prevCount) {
    if (!G) return;
    const fresh = G.notifications.slice(0, Math.max(0, G.notifications.length - prevCount));
    const pick = fresh.find((n) => n.tone === 'pay') || fresh.find((n) => n.tone === 'event') || fresh.find((n) => n.tone === 'warn') || fresh[0];
    if (!pick) return;
    ui.banner = pick.id;
    clearTimeout(bannerTimer);
    if (pick.tone !== 'pay') bannerTimer = setTimeout(() => { ui.banner = null; render(); }, 4200);
  }
  function result(res, okMsg) {
    if (res && res.ok) { if (okMsg) toast(okMsg); return true; }
    const map = {
      insufficient_funds: `Declined: you're ${res.shortBy ? fmt(res.shortBy) + ' short' : 'short of money'}.`,
      already_paid: 'Already paid.', offline: 'No connection. Buy mobile data or get Wi-Fi.',
      event_pending: 'Decide on the open event first.', included_in_rent: 'Electricity is included in your rent.',
      postpaid_meter: 'You are on a postpaid meter.', empty_cart: 'Your cart is empty.', insufficient_savings: 'Not that much saved.',
    };
    toast(map[res && res.error] || 'That did not go through.', true);
    return false;
  }

  // ── navigation ───────────────────────────────────────────────
  function openApp(id, sub) {
    ui.app = id; ui.nc = false; ui.switcher = false; ui.sheet = null;
    if (sub) ui.sub[id] = { ...(ui.sub[id] || {}), ...sub };
    ui.recent = [id, ...ui.recent.filter((x) => x !== id)].slice(0, 8);
    if (id === 'bank' && G) { const pay = G.notifications.find((n) => n.tone === 'pay'); if (pay && ui.banner === pay.id) ui.banner = null; }
    ui.scroll['app:' + id] = 0;
  }
  function goHome() { ui.app = null; ui.nc = false; ui.switcher = false; ui.sheet = null; }
  function back() {
    if (ui.sheet) { ui.sheet = null; return; }
    if (ui.nc) { ui.nc = false; return; }
    if (ui.switcher) { ui.switcher = false; return; }
    if (ui.app) {
      const st = ui.store[ui.app];
      if (st && st.view === 'cart') { st.view = 'browse'; return; }
      goHome();
    }
  }

  // ════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════
  function render() {
    const rootEl = document.getElementById('app');
    // keep scroll positions and focus across re-renders
    const sc = rootEl.querySelector('[data-scroll]');
    if (sc) ui.scroll[sc.dataset.scroll] = sc.scrollTop;
    const af = document.activeElement;
    const focusId = af && af.id && rootEl.contains(af) ? af.id : null;
    const sel = focusId && af.selectionStart != null ? [af.selectionStart, af.selectionEnd] : null;

    rootEl.innerHTML = stageView();

    const sc2 = rootEl.querySelector('[data-scroll]');
    if (sc2 && ui.scroll[sc2.dataset.scroll] != null) sc2.scrollTop = ui.scroll[sc2.dataset.scroll];
    if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus(); if (sel && el.setSelectionRange) try { el.setSelectionRange(sel[0], sel[1]); } catch { /* */ } } }
    updateClock();
  }

  function stageView() {
    return `<div class="stage">
      <aside class="side left" aria-label="Scenario">${caseFile()}</aside>
      <div class="device"><div class="screen" role="application" aria-label="Real Life Simulator phone">${screenView()}</div></div>
      <aside class="side right" aria-label="Recent transactions">${tapeView()}</aside>
    </div>`;
  }

  function caseFile() {
    let html = `<div class="brand"><h1>Real Life<br>Simulator</h1><p>Your salary is fixed. Your expenses aren't.</p>
      <div class="tag">Can you afford to live, or only afford to survive?</div></div>`;
    if (!G) {
      html += `<div class="card-paper"><h2>How it works</h2><small>Pick a city in Indonesia. You start the month with that place's 2026 minimum wage. Rent, food, transport and surprises come out of one wallet. Every figure is labelled Verified, Estimated or Illustrative, and the Sources app shows where it came from.</small></div>`;
      return html;
    }
    const { city, province } = E.getLocality(G.config.cityId);
    const w = E.resolveWage(G.config.cityId);
    const pay = E.calculateNetIncome(w.amount, G.config.scenario);
    const h = E.getHousing(G.config.cityId, G.config.housingId);
    html += `<div class="card-paper"><h2>Case file</h2>
      <div class="kv"><span>Place</span><span>${esc(city.name)}, ${esc(province.name)}</span></div>
      <div class="kv"><span>Wage floor</span><span class="num">${fmt(w.amount, { exact: true })}</span></div>
      <div class="kv"><span>Reference</span><span>${esc(w.wageType)} 2026 ${pill(w.verificationStatus)}</span></div>
      <div class="kv"><span>Take-home</span><span class="num">${fmt(pay.net)}</span></div>
      <div class="kv"><span>Home</span><span>${esc(h.label)}</span></div>
      <div class="kv"><span>Seed</span><span class="num">${G.seed}</span></div>
      <small>${w.fallback ? esc(w.notes[0]) + ' ' : ''}A minimum wage is a legal floor. Many workers earn more, some are paid less, and take-home pay is lower after deductions.</small>
      </div>`;
    const rep = E.generateMonthlyReport(G);
    html += `<div class="card-paper"><h2>This month so far</h2>
      <div class="kv"><span>Income</span><span class="num">${fmt(rep.income)}</span></div>
      <div class="kv"><span>Essentials</span><span class="num">${fmt(rep.mandatory + rep.variableEssential + rep.unexpectedEss)}</span></div>
      <div class="kv"><span>Optional</span><span class="num">${fmt(rep.discretionary + rep.unexpectedDisc)}</span></div>
      <div class="kv"><span>Moved to savings</span><span class="num">${fmt(rep.netSavings)}</span></div>
      <div class="kv"><span>Mood</span><span class="num">${G.wellbeing}/100</span></div></div>`;
    return html;
  }

  function tapeView() {
    if (!G) return `<div class="tape"><h2>— RECEIPT TAPE —</h2><small>Transactions print here as you play.</small></div>`;
    const rows = G.transactions.slice(0, 18).map((t) => `<div class="tape-row ${t.status === 'failed' ? 'failed' : ''}"><span class="m">${t.day} · ${esc(t.merchant)}</span><span class="${t.amount > 0 ? 'pos' : 'neg'}">${fmt(t.amount, { plus: t.amount > 0 })}</span></div>`).join('');
    return `<div class="tape"><h2>— PAYDAY BANK —</h2>${rows || '<small>No transactions yet.</small>'}
      <div class="tape-row" style="border:0;margin-top:6px;font-weight:600"><span>BALANCE</span><span>${fmt(G.wallet)}</span></div>
      <div class="tape-row" style="border:0"><span>SAVINGS</span><span>${fmt(G.savings)}</span></div></div>
      <small>Keyboard: Esc goes back. Every figure has a source label; tap a product or bill for details.</small>`;
  }

  function screenView() {
    if (!G || ui.screen === 'setup') return setupView();
    const onWall = !ui.app && !ui.nc;
    let inner = '';
    if (ui.app) inner = appView(ui.app);
    else inner = homeView();
    return `${onWall ? '<div class="wall" aria-hidden="true"></div>' : ''}
      ${statusBar(onWall)}
      <div class="view">${inner}</div>
      <div class="homebar ${onWall ? 'on-wall' : ''}"><button data-a="home" aria-label="Go to home screen. Long-press or double-click for app switcher" data-dbl="switcher"></button></div>
      ${bannerView()}${ui.nc ? ncView() : ''}${ui.switcher ? switcherView() : ''}${sheetView()}${eventView()}
      ${ui.toast ? `<div class="toast ${ui.toast.bad ? 'bad' : ''}" role="status">${esc(ui.toast.msg)}</div>` : ''}`;
  }

  function statusBar(onWall) {
    const power = E.electricityOn(G);
    const batt = power ? 82 : 14;
    const online = E.isOnline(G);
    const unread = G.notifications.filter((n) => !n.read).length;
    return `<div class="status ${onWall ? 'on-wall' : ''}">
      <button data-a="nc" aria-label="Open notifications (${unread} unread)"><span id="clock">--:--</span>${unread ? `<span style="font-size:11px;opacity:.85">· ${unread}</span>` : ''}</button>
      <span class="notch" aria-hidden="true"></span>
      <span class="right" aria-label="${online ? 'Online' : 'No connection'}, battery ${batt}%">
        ${online ? ic(E.hasWifi(G) ? 'Wifi' : 'Signal') : `<span style="font-size:11px">No data</span>`}
        <span class="batt ${batt < 20 ? 'low' : ''}"><b><i style="width:${batt}%"></i></b></span></span>
    </div>`;
  }
  function updateClock() {
    const el = document.getElementById('clock');
    if (!el) return;
    const d = new Date();
    el.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function appTile(id, size = 38) {
    const a = APPS[id] || APPS.settings;
    return `<span class="tile" style="background:${a.color};${size !== 58 ? `width:${size}px;height:${size}px` : ''}">${ic(a.icon)}</span>`;
  }
  const appForNotif = (n) => (APPS[n.app] ? n.app : NOTIF_APP[n.app] || 'bank');

  function bannerView() {
    if (!ui.banner || ui.nc) return '';
    const n = G.notifications.find((x) => x.id === ui.banner);
    if (!n) return '';
    if (n.tone === 'pay') {
      const amt = n.body.match(/\+Rp[\d.]+/);
      return `<button class="banner pay" data-a="open" data-x="bank" aria-label="Payday. Open PayDay Bank">${appTile('bank')}
        <span class="grow" style="flex:1;min-width:0"><span class="t">PAYDAY <span>${esc(E.dateLabel({ year: G.date.year, month: G.date.month, day: n.day }))}</span></span>
        <span class="b">Your salary has arrived.</span><div class="amt">${amt ? esc(amt[0]) : ''}</div></span></button>`;
    }
    return `<button class="banner" data-a="notif" data-x="${n.id}">${appTile(appForNotif(n))}
      <span style="flex:1;min-width:0"><span class="t">${esc(n.title)} <span>now</span></span><span class="b">${esc(n.body)}</span></span></button>`;
  }

  function ncView() {
    const items = G.notifications.slice(0, 60).map((n) => `<button class="ncard" data-a="notif" data-x="${n.id}">${appTile(appForNotif(n), 32)}
      <span style="flex:1;min-width:0"><span class="t">${esc(n.title)} <span>Day ${n.day}${n.month !== G.monthIndex ? ' · last month' : ''}</span></span><span class="b">${esc(n.body)}</span></span></button>`).join('');
    return `<div class="nc" role="dialog" aria-label="Notification center">
      <div class="row"><h2 style="margin:0;font-family:var(--f-display);font-stretch:85%;font-size:26px;flex:1">Notifications</h2>
      <button class="btn sm sec" data-a="nc-clear">Mark read</button><button class="btn sm" data-a="nc">Close</button></div>
      <div class="scroll" data-scroll="nc">${items || '<div class="empty">Nothing yet.</div>'}</div></div>`;
  }

  function switcherView() {
    const cards = ui.recent.map((id) => {
      const a = APPS[id];
      return `<button class="sw-card" data-a="open" data-x="${id}"><span class="top" style="background:${a.color}"><span class="tile">${ic(a.icon)}</span>${esc(a.name)}</span>
        <span class="bodyp"><span>${esc(appSummary(id))}</span></span></button>`;
    }).join('');
    return `<div class="switcher" role="dialog" aria-label="Recent apps"><div class="row" style="color:#fff"><b style="flex:1;font-size:18px">Recent apps</b><button class="btn sm sec" data-a="switcher">Close</button></div>
      <div class="cards">${cards || '<div class="empty" style="color:#fff">Open an app first.</div>'}</div></div>`;
  }
  function appSummary(id) {
    switch (id) {
      case 'bank': return `Balance ${fmt(G.wallet)}`;
      case 'dailymart': return `${E.homeMealsAvailable(G)} home meals in the pantry`;
      case 'bills': { const b = E.billsThisMonth(G).filter((x) => x.status !== 'paid'); return `${b.length} unpaid bill${b.length === 1 ? '' : 's'}`; }
      case 'futureme': return `Savings ${fmt(G.savings)}`;
      default: return APPS[id].name;
    }
  }

  // ── home ─────────────────────────────────────────────────────
  function homeView() {
    const dim = E.daysInMonth(G.date.year, G.date.month);
    const unpaid = E.billsThisMonth(G).filter((b) => b.status !== 'paid');
    const due = unpaid.reduce((s, b) => s + b.amount, 0);
    const meals = E.homeMealsAvailable(G) + G.pantry.ready;
    const need = E.mealsNeeded(G);
    const h = E.getHousing(G.config.cityId, G.config.housingId);
    const powerTxt = h.includes.electricity ? 'incl.' : G.config.electricity.meter === 'postpaid' ? 'bill' : G.electricity.kwhBalance.toFixed(1);
    const dataTxt = E.hasWifi(G) ? 'Wi-Fi' : E.hasMobileData(G) ? (E.dayNumber(G.dataPlanUntil) - E.dayNumber(G.date)) + 'd' : 'none';
    const badges = { bills: unpaid.filter((b) => b.status === 'overdue' || b.dueDay <= G.date.day).length, report: G.phase === 'report' ? 1 : 0 };
    const tile = (id, dock) => {
      const a = APPS[id];
      const b = badges[id] ? `<span class="badge">${badges[id]}</span>` : '';
      return `<button class="app-ico" data-a="open" data-x="${id}" aria-label="${esc(a.name)}">${b}<span class="tile" style="background:${a.color}">${ic(a.icon)}</span><span class="nm">${esc(a.short || a.name)}</span></button>`;
    };
    const ended = G.phase === 'report';
    const bannerOn = ui.banner && G.notifications.some((n) => n.id === ui.banner);
    return `<div class="home ${bannerOn ? 'has-banner' : ''}" data-scroll="home">
      <div class="widgets">
        <div class="w wide w-day">
          <div><div class="lbl">${esc(E.dateLabel(G.date))} · Month ${G.monthIndex}</div><div class="d">Day ${G.date.day}<span style="opacity:.6;font-size:22px">/${dim}</span></div>
          <div class="sub">${E.isWorkday(G) ? 'Workday' : 'Day off'} · Mood ${G.wellbeing}/100</div></div>
          ${ended ? `<button class="btn-end" data-a="open" data-x="report">${ic('BarChart3')} See report</button>`
            : G.activeEvent ? `<button class="btn-end" data-a="event-open">${ic('AlertTriangle')} Decide</button>`
            : `<button class="btn-end" data-a="end-day">${ic('Moon')} End day</button>`}
        </div>
        <button class="w" data-a="open" data-x="bank"><span class="lbl">Balance</span><span class="big">${M.formatShort(G.wallet)}</span><span class="sub">Savings ${M.formatShort(G.savings)}</span></button>
        <button class="w" data-a="open" data-x="bills"><span class="lbl">Bills left</span><span class="big">${M.formatShort(due)}</span><span class="sub">${unpaid.length} unpaid · ${unpaid.filter((b) => b.status === 'overdue').length} overdue</span></button>
        <div class="w wide"><span class="lbl">Today's needs</span>
          <div class="needs">
            <div class="need ${meals < need ? 'bad' : ''}">${ic('UtensilsCrossed')}<b>${meals}</b>meals ready</div>
            <div class="need ${G.supplies.water < 1 ? 'bad' : ''}">${ic('Droplet')}<b>${G.supplies.water}d</b>water</div>
            <div class="need ${!E.electricityOn(G) ? 'bad' : ''}">${ic('Zap')}<b>${powerTxt}</b>${h.includes.electricity ? 'power' : 'kWh'}</div>
            <div class="need ${dataTxt === 'none' ? 'bad' : ''}">${ic('Wifi')}<b>${dataTxt}</b>internet</div>
          </div>
          <div class="sub">You need ${need} meals a day. ${E.canCook(G) ? 'You can cook at home.' : 'No LPG: you can\'t cook.'}</div>
        </div>
      </div>
      <div class="grid">${GRID.map((id) => tile(id)).join('')}</div>
    </div>
    <div class="dock">${DOCK.map((id) => tile(id, true)).join('')}</div>`;
  }

  // ── app frame ────────────────────────────────────────────────
  function frame(id, body, opts = {}) {
    const a = APPS[id];
    return `<section class="app" aria-label="${esc(a.name)}">
      <div class="app-head"><button class="back" data-a="back" aria-label="Back">${ic('ChevronLeft')}${opts.backLabel || 'Home'}</button>
        <h2>${esc(opts.title || a.name)}</h2>
        <div class="bal">Balance<b class="num">${fmt(G.wallet)}</b></div></div>
      ${opts.tabs || ''}
      <div class="app-body" data-scroll="app:${id}:${opts.scrollKey || ''}">${body}</div>
      ${opts.foot || ''}
    </section>`;
  }
  function tabs(app, list, cur) {
    return `<div class="tabs" role="tablist">${list.map(([k, l]) => `<button class="chip ${cur === k ? 'on' : ''}" role="tab" aria-selected="${cur === k}" data-a="tab" data-app="${app}" data-x="${k}">${esc(l)}</button>`).join('')}</div>`;
  }
  const sub = (app, key, dflt) => ((ui.sub[app] || {})[key] ?? dflt);

  function appView(id) {
    switch (id) {
      case 'bank': return bankApp();
      case 'homebase': return homeApp();
      case 'utility': return utilityApp();
      case 'move': return moveApp();
      case 'dailymart': case 'shopsquare': case 'glow': case 'care': case 'afterhours': return storeApp(id);
      case 'quickbite': return quickbiteApp();
      case 'connect': return connectApp();
      case 'futureme': return futureApp();
      case 'recurring': return recurringApp();
      case 'workday': return workdayApp();
      case 'bills': return billsApp();
      case 'calendar': return calendarApp();
      case 'report': return reportApp();
      case 'compare': return compareApp();
      case 'sources': return sourcesApp();
      case 'settings': return settingsApp();
      default: return frame('settings', '<div class="empty">Unknown app</div>');
    }
  }

  // ── PayDay Bank ──────────────────────────────────────────────
  function txRow(t) {
    const cls = t.status === 'failed' ? 'amt-fail' : t.amount > 0 ? 'amt-pos' : 'amt-neg';
    return `<button class="li row" data-a="tx" data-x="${t.id}"><span class="grow"><span class="t">${esc(t.merchant)}</span>
      <span class="s">${esc(t.category)} · Day ${t.day}${t.status === 'failed' ? ' · <b style="color:var(--coral)">Declined</b>' : ''}</span></span>
      <span class="${cls}">${fmt(t.amount, { plus: t.amount > 0 })}</span></button>`;
  }
  function bankApp() {
    const tab = sub('bank', 'tab', 'activity');
    const rep = E.generateMonthlyReport(G);
    let body = `<div class="hero"><span class="lbl">Available balance</span><span class="big num" style="font-family:var(--f-display)">${fmt(G.wallet)}</span>
      <div class="split"><span>Income this month<b>${fmt(rep.income)}</b></span><span>Spent<b>${fmt(rep.consumption + rep.upfront)}</b></span><span>Savings<b>${fmt(G.savings)}</b></span></div></div>`;
    if (tab === 'activity') {
      const txs = G.transactions.filter((t) => t.month === G.monthIndex);
      body += `<div class="section-t">Transactions · ${E.MONTHS[G.date.month]}</div><div class="list">${txs.map(txRow).join('') || '<div class="empty">No transactions.</div>'}</div>`;
      if (G.monthIndex > 1) body += `<div class="section-t">Earlier</div><div class="list">${G.transactions.filter((t) => t.month < G.monthIndex).slice(0, 30).map(txRow).join('')}</div>`;
    } else if (tab === 'spending') {
      const max = Math.max(1, ...rep.byCategory.map((c) => c[1]));
      body += `<div class="box"><div class="section-t" style="margin:0">Cash flow</div>
        <div class="kv"><span>Income</span><span class="num">${fmt(rep.income)}</span></div>
        <div class="kv"><span>Bills & obligations</span><span class="num">${fmt(-rep.mandatory)}</span></div>
        <div class="kv"><span>Everyday essentials</span><span class="num">${fmt(-rep.variableEssential)}</span></div>
        <div class="kv"><span>Optional spending</span><span class="num">${fmt(-rep.discretionary)}</span></div>
        <div class="kv"><span>Unexpected</span><span class="num">${fmt(-rep.unexpected)}</span></div>
        <div class="kv"><span>One-off upfront costs</span><span class="num">${fmt(-rep.upfront)}</span></div>
        <div class="kv"><span>Net moved to savings</span><span class="num">${fmt(-rep.netSavings)}</span></div></div>
        <div class="section-t">By category</div><div class="box outline">${rep.byCategory.map(([c, v]) => `<div class="field"><div class="kv"><span>${esc(c)}</span><span class="num">${fmt(v)}</span></div><div class="bar"><i style="width:${(v / max) * 100}%"></i></div></div>`).join('') || '<div class="empty">Nothing spent yet.</div>'}</div>
        <div class="box"><div class="kv"><span>Overdraft</span><span>Off in this scenario</span></div><small class="muted">Payments that exceed your balance are declined and recorded. Nothing is deducted.</small></div>`;
    } else {
      const bills = E.billsThisMonth(G);
      body += `<div class="section-t">Scheduled & pending</div><div class="list">${bills.map(billRow).join('') || '<div class="empty">No bills this month.</div>'}</div>`;
      const subs = G.subscriptions.filter((s) => s.active);
      if (subs.length) body += `<div class="section-t">Card renewals</div><div class="list">${subs.map((s) => { const d = D.subscriptions.find((x) => x.id === s.id); return `<div class="li row"><span class="grow"><span class="t">${esc(d.name)}</span><span class="s">Renews day ${s.renewDay}</span></span><span class="amt-neg">${fmt(d.price)}</span></div>`; }).join('')}</div>`;
    }
    return frame('bank', body, { tabs: tabs('bank', [['activity', 'Activity'], ['spending', 'Spending'], ['bills', 'Upcoming']], tab), scrollKey: tab });
  }

  // ── Bills ────────────────────────────────────────────────────
  function billRow(b) {
    const st = b.status === 'paid' ? `<span class="pill p-ok">Paid day ${b.paidDay}</span>` : b.status === 'overdue' ? '<span class="pill p-warn">Overdue</span>' : b.dueDay <= G.date.day ? '<span class="pill p-due">Due today</span>' : `<span class="pill p-muted">Due day ${b.dueDay}</span>`;
    return `<div class="li"><div class="row"><span class="grow"><span class="t">${esc(b.label)}</span><span class="s">${esc(b.category)} · ${b.adjustable ? 'You can adjust this' : 'Hard to avoid'}${b.lateFee ? ` · includes ${fmt(b.lateFee)} late fee` : ''}</span></span><span class="amt-neg">${fmt(b.amount)}</span></div>
      <div class="row" style="margin-top:8px">${st}<span class="grow"></span>
      ${b.status !== 'paid' ? `<span class="small muted">Autopay</span><button class="sw ${b.autopay ? 'on' : ''}" data-a="autopay" data-x="${b.id}" role="switch" aria-checked="${b.autopay}" aria-label="Autopay for ${esc(b.label)}"></button><button class="btn sm" data-a="pay-bill" data-x="${b.id}">Pay</button>` : ''}</div></div>`;
  }
  function billsApp() {
    const bills = E.billsThisMonth(G);
    const total = bills.reduce((s, b) => s + b.amount, 0);
    const paid = bills.filter((b) => b.status === 'paid').reduce((s, b) => s + b.amount, 0);
    const left = total - paid;
    let body = `<div class="box"><div class="kv"><span>Mandatory bills this month</span><span class="num">${fmt(total)}</span></div>
      <div class="kv"><span>Paid</span><span class="num">${fmt(paid)}</span></div>
      <div class="kv"><span>Still to pay</span><span class="num"><b>${fmt(left)}</b></span></div>
      <div class="bar"><i style="width:${total ? (paid / total) * 100 : 0}%"></i></div>
      <div class="kv"><span>Money left after obligations</span><span class="num" style="color:${G.wallet - left < 0 ? 'var(--coral)' : 'inherit'}">${fmt(G.wallet - left)}</span></div></div>
      <div class="list">${bills.map(billRow).join('') || '<div class="empty">No bills this month.</div>'}</div>
      <small class="muted">Autopay pays a bill on its due day if your balance covers it. A paid bill is never charged again. Unpaid bills carry into next month, rent and power with a late fee.</small>
      <div class="section-t">Also recurring</div>
      <div class="box outline"><div class="kv"><span>Commute (charged each workday)</span><span class="num">${(() => { const p = E.currentCommutePlan(G); return p ? fmt(p.perTrip * 2 + p.dailyExtra) + '/day' : '—'; })()}</span></div>
      <div class="kv"><span>Subscriptions</span><span class="num">${fmt(G.subscriptions.filter((s) => s.active).reduce((s, x) => s + D.subscriptions.find((d) => d.id === x.id).price, 0))}/month</span></div>
      <button class="btn sec sm" data-a="open" data-x="recurring">Manage subscriptions</button></div>`;
    return frame('bills', body, { title: 'Bills & obligations' });
  }

  // ── HomeBase ─────────────────────────────────────────────────
  function homeApp() {
    const opts = E.housingOptions(G.config.cityId);
    const cur = E.getHousing(G.config.cityId, G.config.housingId);
    const { city } = E.getLocality(G.config.cityId);
    const inc = (h) => ['electricity', 'water', 'internet'].map((k) => `<span class="pill ${h.includes[k] ? 'p-ok' : 'p-muted'}">${{ electricity: 'Power', water: 'Water', internet: 'Wi-Fi' }[k]} ${h.includes[k] ? 'incl.' : 'extra'}</span>`).join(' ');
    const card = (h) => {
      const isCur = h.id === G.config.housingId, isPend = h.id === G.pendingMove;
      return `<div class="box outline">
        <div class="row"><span class="grow"><span class="t">${esc(h.label)}</span><span class="s">${h.tier === 'family' ? 'Family home' : esc(h.tier[0].toUpperCase() + h.tier.slice(1))} · ${esc(h.bathroom)} bathroom · ${h.furnished ? 'furnished' : 'unfurnished'}</span></span>
        <span style="text-align:right"><b class="num">${h.type === 'family' ? fmt(G.config.familyContribution) : fmt(h.monthlyRent)}</b><br><span class="small muted">${h.type === 'family' ? 'your contribution' : 'per month'}</span></span></div>
        <div class="row" style="flex-wrap:wrap;gap:4px">${inc(h)} ${pill(h.status)}</div>
        <div class="small muted">Deposit: ${h.deposit ? fmt(h.deposit) + ' up front (one-off)' : 'none'}${h.note ? ' · ' + esc(h.note) : ''}</div>
        ${isCur ? '<span class="pill p-ok" style="align-self:flex-start">You live here</span>' : isPend ? `<div class="row"><span class="pill p-due">Moving here next month</span><button class="btn ghost sm" data-a="move-home" data-x="${G.config.housingId}">Cancel move</button></div>` : `<button class="btn sec sm" data-a="move-home" data-x="${h.id}" style="align-self:flex-start">Move here next month</button>`}
      </div>`;
    };
    const groups = [['family', 'With family'], ['shared', 'Shared'], ['kost', 'Kost'], ['petak', 'Kontrakan'], ['apartment', 'Apartment']];
    let body = `<div class="hero" style="background:#8a5a2b;color:#fff"><span class="lbl">Current home in ${esc(city.name)}</span><span style="font-family:var(--f-display);font-weight:800;font-stretch:85%;font-size:24px">${esc(cur.label)}</span>
      <div class="split"><span>Monthly<b>${fmt(E.calculateMonthlyRent(G.config))}</b></span><span>Rent tier<b>${esc(city.tier)}</b></span></div></div>`;
    if (cur.type === 'family') body += `<div class="box"><div class="field"><label for="fam">Monthly contribution to the household: <b class="num">${fmt(G.config.familyContribution)}</b></label>
      <input id="fam" type="range" min="0" max="2000000" step="50000" value="${G.config.familyContribution / 100}" data-in="fam"></div>
      <div class="toggle"><span>Family cooks dinner (one less meal to buy)</span><button class="sw ${G.config.familyDinner ? 'on' : ''}" data-a="cfg-toggle" data-x="familyDinner" role="switch" aria-checked="${G.config.familyDinner}"></button></div>
      <small class="muted">Changes apply from next month's bill.</small></div>`;
    body += `<small class="muted">Rents are tiered by city type (${esc(city.tier)}): Tier A and B anchored to published Mamikos averages; C and D scaled estimates. Moving takes effect next month and charges the new deposit then.</small>`;
    for (const [type, label] of groups) {
      const list = opts.filter((o) => o.type === type);
      if (!list.length) continue;
      body += `<div class="section-t">${label}</div>${list.map(card).join('')}`;
    }
    if (!opts.some((o) => o.type === 'apartment')) body += `<div class="box"><span class="small muted">Studio apartments: no estimate for this city type.</span> ${pill('UNAVAILABLE')}</div>`;
    return frame('homebase', body);
  }

  // ── Utility Hub ──────────────────────────────────────────────
  function utilityApp() {
    const c = G.config, h = E.getHousing(c.cityId, c.housingId);
    const est = E.estimateElectricity(c.electricity, c.ppjBp);
    const el = c.electricity;
    let body = '';
    if (h.includes.electricity) body += `<div class="box"><div class="row">${ic('Zap')}<span class="grow"><span class="t">Electricity is included in your rent</span><span class="s">No meter to top up. If you move somewhere with its own meter, plan it here.</span></span></div></div>`;
    else if (el.meter === 'prepaid') {
      const days = est.dailyKwh ? G.electricity.kwhBalance / est.dailyKwh : 0;
      body += `<div class="hero" style="background:#d48a00;color:#1f1400"><span class="lbl">PLN prepaid meter</span><span class="big num" style="font-family:var(--f-display)">${G.electricity.kwhBalance.toFixed(1)} kWh</span>
        <div class="split"><span>Lasts about<b>${days.toFixed(1)} days</b></span><span>Use per day<b>${est.dailyKwh.toFixed(1)} kWh</b></span><span>Tariff<b>Rp${(est.tariffMinor / 100).toLocaleString('id-ID')}</b></span></div></div>
        <div class="section-t">Buy a token</div><div class="list">${E.TOKEN_NOMINALS.map((n) => { const b = E.tokenBreakdown(n, el.tariff, c.ppjBp); return `<div class="li row"><span class="grow"><span class="t num">${fmt(n)}</span><span class="s">Admin ${fmt(b.admin)} · PPJ ${fmt(b.ppj)} · energy ${fmt(b.energyValue)} → <b>${b.kwh.toFixed(1)} kWh</b></span></span><button class="btn sm" data-a="token" data-x="${n}">Buy</button></div>`; }).join('')}</div>
        <small class="muted">PPJ is a local street-lighting tax set by each regency or city; this game uses ${(c.ppjBp / 100).toLocaleString('id-ID')}% (change in Settings). The admin fee is an illustrative payment-channel fee.</small>`;
    } else {
      body += `<div class="box"><div class="row">${ic('Zap')}<span class="grow"><span class="t">PLN postpaid</span><span class="s">Billed on day 20 from last month's use. This month so far: ${G.electricity.kwhUsedMonth.toFixed(1)} kWh.</span></span></div></div>`;
    }
    body += `<div class="section-t">Household profile ${pill('ESTIMATED')}</div><div class="box outline">
      <div class="field"><span class="lab">Connection and tariff</span><div class="seg">${['900', '1300', '2200'].map((k) => `<button class="${el.tariff === k ? 'on' : ''}" data-a="elec" data-k="tariff" data-x="${k}">${k} VA</button>`).join('')}</div>
        <small class="muted">${esc(E.TARIFFS[el.tariff].label)}: Rp${E.TARIFFS[el.tariff].major.replace('.', ',')}/kWh. Subsidised 450/900 VA tariffs need welfare-registry eligibility and are not assumed.</small></div>
      <div class="field"><span class="lab">Air conditioner</span><div class="seg">${['none', 'occasional', 'nightly', 'heavy'].map((k) => `<button class="${el.ac === k ? 'on' : ''}" data-a="elec" data-k="ac" data-x="${k}">${k}</button>`).join('')}</div></div>
      <div class="field"><span class="lab">Washing machine</span><div class="seg">${['none', 'shared', 'private'].map((k) => `<button class="${el.washer === k ? 'on' : ''}" data-a="elec" data-k="washer" data-x="${k}">${k}</button>`).join('')}</div></div>
      ${[['fridge', 'Small refrigerator'], ['electricCooking', 'Rice cooker & kettle (cook without LPG)'], ['tv', 'Television']].map(([k, l]) => `<div class="toggle"><span>${l}</span><button class="sw ${el[k] ? 'on' : ''}" data-a="elec" data-k="${k}" data-x="${!el[k]}" role="switch" aria-checked="${!!el[k]}"></button></div>`).join('')}
      ${!h.includes.electricity ? `<div class="field"><span class="lab">Meter</span><div class="seg">${['prepaid', 'postpaid'].map((k) => `<button class="${el.meter === k ? 'on' : ''}" data-a="elec" data-k="meter" data-x="${k}">${k}</button>`).join('')}</div><small class="muted">Switching to postpaid starts billing next month.</small></div>` : ''}
    </div>
    <div class="receipt">${est.lines.map(([l, k]) => `<div class="kv"><span>${esc(l)}</span><span>${k} kWh</span></div>`).join('')}<hr>
      <div class="kv"><span>Monthly use</span><span>${est.kwh} kWh</span></div>
      <div class="kv"><span>Energy at tariff</span><span>${fmt(est.energy)}</span></div><div class="kv"><span>PPJ ${(c.ppjBp / 100).toLocaleString('id-ID')}%</span><span>${fmt(est.ppj)}</span></div>
      <div class="kv"><span>Admin fee</span><span>${fmt(est.admin)}</span></div><hr><div class="kv tot"><span>Estimated month</span><span>${fmt(est.total)}</span></div></div>
    <small class="muted">Tariffs: ${srcLink('pln_2026')}, Q4 2026 unchanged per ${srcLink('pln_q4_2026')}. Appliance kWh figures are game estimates.</small>
    <div class="section-t">Other utilities</div>
    <div class="box outline">
      <div class="row"><span class="grow"><span class="t">Water (PDAM)</span><span class="s">${h.includes.water ? 'Included in rent' : 'Monthly bill, due day 20'}</span></span>${h.includes.water ? '<span class="pill p-ok">incl.</span>' : `<b class="num">${fmt(c.waterBill)}</b>`}</div>
      ${h.includes.water ? '' : `<input type="range" aria-label="Water bill" min="20000" max="200000" step="5000" value="${c.waterBill / 100}" data-in="water"><small class="muted">${pill('ILLUSTRATIVE')} Applies from next bill.</small>`}
      <div class="row"><span class="grow"><span class="t">Cooking gas (LPG 3 kg)</span><span class="s">${G.supplies.gasMeals} cooked meals left</span></span><button class="btn sm sec" data-a="open" data-x="dailymart" data-cat="household">Refill</button></div>
      <div class="row"><span class="grow"><span class="t">Internet</span><span class="s">${h.includes.internet ? 'Wi-Fi included in rent' : G.homeInternet ? 'Home fibre subscribed' : 'No home internet'}</span></span><button class="btn sm sec" data-a="open" data-x="connect">Connect</button></div>
    </div>`;
    return frame('utility', body);
  }

  // ── Move ─────────────────────────────────────────────────────
  function moveApp() {
    const c = G.config;
    const tab = sub('move', 'tab', 'commute');
    const { city } = E.getLocality(c.cityId);
    const wd = E.workdaysInMonth(G.date.year, G.date.month, c.workweek);
    const plans = E.commutePlans(c.cityId, c.distanceKm, c);
    const pre = E.commutePresets(plans, wd);
    let body = '';
    if (tab === 'commute') {
      body += `<div class="box"><div class="field"><label for="dist">Home → work distance: <b>${c.distanceKm} km</b></label><input id="dist" type="range" min="1" max="45" value="${c.distanceKm}" data-in="dist"></div>
        <div class="field"><span class="lab">Work week</span><div class="seg"><button class="${c.workweek === 5 ? 'on' : ''}" data-a="cfg" data-k="workweek" data-x="5">5 days</button><button class="${c.workweek === 6 ? 'on' : ''}" data-a="cfg" data-k="workweek" data-x="6">6 days</button></div></div>
        <div class="field"><span class="lab">Ride-hailing fare level</span><div class="seg">${['low', 'mid', 'high'].map((k) => `<button class="${c.fareLevel === k ? 'on' : ''}" data-a="cfg" data-k="fareLevel" data-x="${k}">${k}</button>`).join('')}</div></div>
        <div class="row" style="gap:6px;flex-wrap:wrap">${[['cheapest', 'Cheapest practical'], ['balanced', 'Balanced'], ['convenience', 'Convenience']].map(([k, l]) => pre[k] ? `<button class="chip ${c.commutePlanId === pre[k] ? 'on' : ''}" data-a="commute" data-x="${pre[k]}">${l}</button>` : '').join('')}</div></div>
        <div class="section-t">Options in ${esc(city.name)} · ${wd} workdays</div><div class="list">`;
      for (const p of plans) {
        const monthly = E.monthlyCommuteCost(p, wd);
        const on = c.commutePlanId === p.id;
        body += `<div class="li"><div class="row"><span class="grow"><span class="t">${esc(p.label)} ${on ? '<span class="pill p-ok">Your commute</span>' : ''}</span>
          <span class="legs">${p.legs.map((l) => `<span>${esc(l.label)} · <span class="num">${l.cost == null ? '—' : fmt(l.cost)}</span> ${pill(l.status)}</span>`).join('')}</span>
          ${p.note ? `<span class="s">${esc(p.note)}</span>` : ''}${p.reason ? `<span class="s" style="color:var(--coral)">${esc(p.reason)}</span>` : ''}</span>
          <span style="text-align:right">${p.perTrip != null ? `<b class="num">${fmt(p.perTrip)}</b><br><span class="small muted">per trip</span><br><span class="num small">${fmt(monthly)}/mo</span>` : ''}</span></div>
          ${p.id === 'bus' ? `<div class="row" style="margin-top:8px"><input id="busfare" class="inp" inputmode="numeric" placeholder="Your fare per trip, e.g. 4000" value="${c.customBusFare != null ? c.customBusFare / 100 : ''}" data-in="busfare" aria-label="Bus fare per trip"></div>` : ''}
          ${p.id === 'motorcycle' ? `<div class="toggle" style="margin-top:6px"><span class="small">Still paying instalments</span><button class="sw ${c.motorcycleCredit ? 'on' : ''}" data-a="cfg-toggle" data-x="motorcycleCredit" role="switch" aria-checked="${c.motorcycleCredit}"></button></div>` : ''}
          ${!on && p.available ? `<button class="btn sm sec" style="margin-top:8px" data-a="commute" data-x="${p.id}">Use this commute</button>` : ''}</div>`;
      }
      body += `</div><small class="muted">Your commute is charged automatically each workday (two trips). Ride-hailing fares are estimates from ${srcLink('game_ojol_model')}; transit fares from ${srcLink('transit_jkt_2026')}.</small>`;
    } else if (tab === 'ride') {
      const online = E.isOnline(G);
      const km = sub('move', 'km', 5);
      const m = E.ojolFare(city, km, 'motor', c.fareLevel), car = E.ojolFare(city, km, 'car', c.fareLevel);
      body += `<div class="box">${online ? '' : `<div class="row" style="color:var(--coral)">${ic('WifiOff')}<span>No connection. Buy data in Connect to book rides.</span></div>`}
        <div class="field"><label for="ridekm">Trip distance: <b>${km} km</b></label><input id="ridekm" type="range" min="1" max="30" value="${km}" data-in="ridekm"></div>
        <div class="row"><span class="grow"><span class="t">Motorbike</span><span class="s">Range ${fmt(m.low)}–${fmt(m.high)} ${pill(m.status)}</span></span><b class="num">${fmt(m.cost)}</b><button class="btn sm" ${online ? '' : 'disabled'} data-a="ride" data-x="motor">Book</button></div>
        <div class="row"><span class="grow"><span class="t">Car</span><span class="s">Range ${fmt(car.low)}–${fmt(car.high)} ${pill(car.status)}</span></span><b class="num">${fmt(car.cost)}</b><button class="btn sm" ${online ? '' : 'disabled'} data-a="ride" data-x="car">Book</button></div></div>
        <div class="section-t">Trip history</div><div class="list">${G.transactions.filter((t) => t.category === 'Transport').slice(0, 25).map(txRow).join('') || '<div class="empty">No trips yet.</div>'}</div>`;
    } else {
      body += `<div class="list">${E.transportModes(c.cityId).map((m) => `<div class="li row"><span class="grow"><span class="t">${esc(m.label)}</span><span class="s">${esc(m.fare)}${m.note ? ' · ' + esc(m.note) : ''}</span></span>
        <span class="pill ${m.availability === 'available' ? 'p-ok' : m.availability === 'route' || m.availability === 'reported' ? 'p-due' : 'p-warn'}">${{ available: 'Available', route: 'Some routes', reported: 'Reported', limited: 'Limited', uncertain: 'Uncertain' }[m.availability]}</span></div>`).join('')}</div>
        <small class="muted">Only services recorded for this locality are listed. MRT, LRT and TransJakarta appear only in Jakarta; KRL only where the Commuter Line runs.</small>`;
    }
    return frame('move', body, { tabs: tabs('move', [['commute', 'Commute'], ['ride', 'Book a ride'], ['area', 'Services here']], tab), scrollKey: tab });
  }

  // ── Generic store (DailyMart, ShopSquare, Glow, Care, AfterHours) ──
  function storeState(id) {
    if (!ui.store[id]) ui.store[id] = { cat: D.catalog.categories[id][0][0], q: '', filter: 'all', view: 'browse' };
    return ui.store[id];
  }
  const cartOf = (id) => (ui.carts[id] = ui.carts[id] || {});
  function cartLines(id) { return Object.entries(cartOf(id)).filter(([, q]) => q > 0).map(([itemId, qty]) => ({ itemId, qty })); }
  function unitPrice(item, price) {
    if (item.unitLabel === 'g' || item.unitLabel === 'ml') return `${fmt(Math.round((price * 100) / item.unitQty))}/100 ${item.unitLabel}`;
    if (item.unitQty > 1) return `${fmt(Math.round(price / item.unitQty))}/pc`;
    return '';
  }
  function prodRow(id, item) {
    const p = E.priceOf(item, G.config);
    const q = cartOf(id)[item.id] || 0;
    const wish = G.wishlist.includes(item.id);
    const canWish = id === 'glow' || id === 'shopsquare';
    return `<div class="prod"><button class="nm" data-a="item" data-x="${item.id}">${esc(item.name)}</button>
      <span class="pr">${fmt(p)}</span>
      <span class="meta">${esc(item.size)} ${unitPrice(item, p) ? '· ' + unitPrice(item, p) : ''} ${pill(E.priceStatus(item, G.config))} ${item.origin === 'imported' ? '<span class="pill p-muted">Imported</span>' : ''} ${!item.essential ? '<span class="pill p-muted">Optional</span>' : ''}</span>
      <span style="display:flex;gap:6px;justify-content:flex-end;align-items:center">${canWish ? `<button class="btn ghost sm" data-a="wish" data-x="${item.id}" aria-label="${wish ? 'Remove from' : 'Add to'} wishlist">${ic(wish ? 'HeartOff' : 'Heart')}</button>` : ''}
      ${q ? `<span class="qty"><button data-a="qty" data-store="${id}" data-x="${item.id}" data-d="-1" aria-label="Remove one">${ic('Minus')}</button><span>${q}</span><button data-a="qty" data-store="${id}" data-x="${item.id}" data-d="1" aria-label="Add one">${ic('Plus')}</button></span>`
        : `<button class="addb" data-a="qty" data-store="${id}" data-x="${item.id}" data-d="1">${ic('Plus')} Add</button>`}</span></div>`;
  }
  function pantryStrip() {
    const s = G.supplies, p = G.pantry;
    const bath = Math.min(s.soap, s.shampoo, s.toothpaste);
    const cell = (v, l, bad) => `<div class="${bad ? 'bad' : ''}"><b>${v}</b>${l}</div>`;
    return `<div class="pantry">${cell(E.homeMealsAvailable(G) + p.ready, 'meals', E.homeMealsAvailable(G) + p.ready < E.mealsNeeded(G))}${cell(p.staple + '/' + p.side, 'staple/side', false)}
      ${cell(s.water + 'd', 'water', s.water < 1)}${cell(s.gasMeals, 'LPG meals', s.gasMeals < 3)}
      ${cell(bath + 'd', 'bathroom', bath < 1)}${cell(Math.min(s.laundry, s.dish) + 'd', 'cleaning', s.laundry < 1)}${G.config.household === 'dependent' ? cell(s.baby + 'd', 'baby', s.baby < 1) : cell(p.ready, 'ready meals', false)}${cell(p.complete, 'noodles', false)}</div>`;
  }
  function storeApp(id) {
    const st = storeState(id);
    const lines = cartLines(id);
    const quote = E.calculateGroceryBasket(lines, G.config);
    if (st.view === 'cart') return cartView(id, quote);
    const all = D.catalog.items.filter((i) => i.store === id && E.isItemAvailable(i, G.config));
    let cats = D.catalog.categories[id].filter(([k]) => all.some((i) => i.cat === k));
    let body = '';
    if (id === 'dailymart') {
      const spent = E.generateMonthlyReport(G);
      const groc = G.transactions.filter((t) => t.month === G.monthIndex && t.status === 'completed' && t.merchant === 'DailyMart').reduce((s, t) => s - t.amount, 0);
      body += pantryStrip();
      body += `<div class="box"><div class="kv"><span>Grocery spending this month</span><span class="num">${fmt(groc)} of ${fmt(G.config.groceryBudget)}</span></div><div class="bar warm"><i style="width:${Math.min(100, (groc / Math.max(1, G.config.groceryBudget)) * 100)}%"></i></div>
        <div class="small muted">Remaining ${fmt(G.config.groceryBudget - groc)} · drag to set your monthly grocery budget</div>
        <input type="range" aria-label="Monthly grocery budget" min="300000" max="3000000" step="50000" value="${G.config.groceryBudget / 100}" data-in="grocbudget">
        <div class="row" style="gap:6px"><button class="btn sm sec" style="flex:1" data-a="basket" data-x="budget">Load lean basket</button><button class="btn sm sec" style="flex:1" data-a="basket" data-x="standard">Load everyday basket</button></div></div>`;
      void spent;
    }
    if (id === 'care') {
      const covered = G.config.scenario === 'formal' || G.config.jknMandiri;
      body += `<div class="box"><div class="row">${ic('ShieldCheck')}<span class="grow"><span class="t">${covered ? 'JKN active' : 'No JKN in this scenario'}</span><span class="s">${covered ? (G.config.scenario === 'formal' ? 'Paid through payroll (1% of your wage). Visits to your registered clinic and referrals are covered; pharmacy items below are out of pocket.' : 'You pay the independent class 3 contribution each month.') : 'Without an employer, you can join JKN independently (class 3, Rp35.000/month after the government share).'}</span></span></div>
        ${G.config.scenario === 'gross' ? `<div class="toggle"><span>Pay JKN class 3 independently</span><button class="sw ${G.config.jknMandiri ? 'on' : ''}" data-a="cfg-toggle" data-x="jknMandiri" role="switch" aria-checked="${G.config.jknMandiri}"></button></div><small class="muted">${pill('ESTIMATED')} Starts as a bill next month.</small>` : ''}
        <small class="muted">This game does not give medical advice.</small></div>`;
    }
    if (id === 'afterhours') body += `<div class="box"><span class="small">Leisure lifts your mood. After this month's bills you have <b class="num">${fmt(G.wallet - E.billsThisMonth(G).filter((b) => b.status !== 'paid').reduce((s, b) => s + b.amount, 0))}</b> for everything else.</span></div>`;
    if ((id === 'glow' || id === 'shopsquare') && G.wishlist.some((w) => D.catalog.byId[w]?.store === id)) {
      body += `<div class="section-t">Wishlist (not counted as spending)</div><div class="box outline">${G.wishlist.filter((w) => D.catalog.byId[w]?.store === id).map((w) => prodRow(id, D.catalog.byId[w])).join('')}</div>`;
    }
    body += `<div class="search">${ic('Search')}<input id="q-${id}" type="search" placeholder="Search ${esc(APPS[id].name)}" value="${esc(st.q)}" data-in="storeq" data-store="${id}" aria-label="Search products"></div>`;
    const filters = [['all', 'All'], ['unit', 'Lowest unit price'], ['essential', 'Essentials only'], ['local', 'Local'], ['imported', 'Imported']];
    body += `<div class="row" style="gap:6px;overflow-x:auto;scrollbar-width:none">${filters.map(([k, l]) => `<button class="chip ${st.filter === k ? 'on' : ''}" data-a="sfilter" data-store="${id}" data-x="${k}">${l}</button>`).join('')}</div>`;
    let items = st.q ? all.filter((i) => i.name.toLowerCase().includes(st.q.toLowerCase())) : all.filter((i) => i.cat === st.cat);
    if (st.filter === 'essential') items = items.filter((i) => i.essential);
    if (st.filter === 'local') items = items.filter((i) => i.origin === 'local');
    if (st.filter === 'imported') items = items.filter((i) => i.origin === 'imported');
    const tabsHtml = st.q ? '' : `<div class="tabs" role="tablist">${cats.map(([k, l]) => `<button class="chip ${st.cat === k ? 'on' : ''}" data-a="scat" data-store="${id}" data-x="${k}">${esc(l)}</button>`).join('')}</div>`;
    if (st.filter === 'unit') {
      const up = (i) => (i.unitLabel === 'g' || i.unitLabel === 'ml' ? E.priceOf(i, G.config) / i.unitQty : E.priceOf(i, G.config) / Math.max(1, i.unitQty));
      items = [...items].sort((a, b) => up(a) - up(b));
      body += `<div class="box outline">${items.map((i) => prodRow(id, i)).join('') || '<div class="empty">No matches.</div>'}</div><small class="muted">Sorted by price per 100 g/ml or per piece, so package sizes compare fairly.</small>`;
    } else {
      for (const [tier, label] of [['budget', 'Budget'], ['standard', 'Standard'], ['premium', 'Premium']]) {
        const list = items.filter((i) => i.tier === tier);
        if (!list.length) continue;
        const avg = Math.round(list.reduce((s, i) => s + E.priceOf(i, G.config), 0) / list.length);
        body += `<div class="tier-h tier-${tier}"><h3>${label}</h3><span class="small muted">avg ${fmt(avg)}</span></div><div class="box outline" style="padding:0 14px">${list.map((i) => prodRow(id, i)).join('')}</div>`;
      }
      if (!items.length) body += '<div class="empty">No matches.</div>';
    }
    body += `<small class="muted">Verified rice, egg, chicken, beef and cooking-oil prices are national averages from the Bapanas price panel (Jan–Feb 2026). Local prices differ, especially in eastern Indonesia; adjust in Settings. Other prices are labelled.</small>`;
    const foot = lines.length ? `<button class="cartbar" data-a="cart" data-x="${id}">${ic('ShoppingCart')}<span class="grow">${lines.reduce((s, l) => s + l.qty, 0)} items</span><b>${fmt(quote.total)}</b>${ic('ChevronRight')}</button>` : '';
    return frame(id, body, { tabs: tabsHtml, foot, scrollKey: st.cat + st.q + st.filter });
  }
  function cartView(id, quote) {
    let body = `<div class="list">${quote.lines.map((l) => `<div class="li row"><span class="grow"><span class="t">${esc(l.item.name)}</span><span class="s">${fmt(l.unit)} × ${l.qty} · ${esc(l.item.tier)}</span></span>
      <span class="qty"><button data-a="qty" data-store="${id}" data-x="${l.item.id}" data-d="-1" aria-label="Remove one">${ic('Minus')}</button><span>${l.qty}</span><button data-a="qty" data-store="${id}" data-x="${l.item.id}" data-d="1" aria-label="Add one">${ic('Plus')}</button></span>
      <b class="num" style="min-width:86px;text-align:right">${fmt(l.line)}</b></div>`).join('')}</div>`;
    const tierTotals = { budget: 0, standard: 0, premium: 0 };
    quote.lines.forEach((l) => { tierTotals[l.item.tier] += l.line; });
    body += `<div class="receipt"><div class="kv"><span>Essentials</span><span>${fmt(quote.essential)}</span></div><div class="kv"><span>Optional</span><span>${fmt(quote.discretionary)}</span></div>
      <div class="kv"><span>Budget / standard / premium tiers</span><span>${M.formatShort(tierTotals.budget)} · ${M.formatShort(tierTotals.standard)} · ${M.formatShort(tierTotals.premium)}</span></div><hr>
      <div class="kv tot"><span>Total to pay</span><span>${fmt(quote.total)}</span></div><div class="kv"><span>Balance after</span><span style="color:${G.wallet - quote.total < 0 ? 'var(--coral)' : 'inherit'}">${fmt(G.wallet - quote.total)}</span></div></div>
      ${id === 'shopsquare' || id === 'glow' ? '<small class="muted">Not sure? Postpone moves items to your wishlist without spending anything.</small>' : ''}`;
    const foot = `<div class="setup-foot">${id === 'shopsquare' || id === 'glow' ? `<button class="btn sec" data-a="postpone" data-x="${id}">Postpone</button>` : `<button class="btn sec" data-a="cart-clear" data-x="${id}">Clear</button>`}<button class="btn" data-a="checkout" data-x="${id}" ${quote.total > 0 || quote.lines.length ? '' : 'disabled'}>Pay ${fmt(quote.total)}</button></div>`;
    return frame(id, body || '<div class="empty">Cart is empty.</div>', { title: 'Cart', backLabel: APPS[id].short || APPS[id].name, foot, scrollKey: 'cart' });
  }

  // ── QuickBite ────────────────────────────────────────────────
  const QB_FEES = { delivery: M.rp(9000), service: M.rp(2000), taxBp: 1000 };
  function quickbiteFees(foodTotal, tip) {
    if (!foodTotal) return [];
    return [
      { label: 'Delivery fee (illustrative)', amount: QB_FEES.delivery },
      { label: 'Service fee (illustrative)', amount: QB_FEES.service },
      { label: 'Restaurant tax 10% (estimated)', amount: M.applyBasisPoints(foodTotal, QB_FEES.taxBp) },
      ...(tip ? [{ label: 'Tip for the rider', amount: tip }] : []),
    ];
  }
  function quickbiteApp() {
    const online = E.isOnline(G);
    const lines = cartLines('quickbite');
    const quote = E.calculateGroceryBasket(lines, G.config);
    const tip = sub('quickbite', 'tip', 0);
    const fees = quickbiteFees(quote.total, tip);
    const all = D.catalog.items.filter((i) => i.store === 'quickbite');
    const std = D.baskets.standard;
    const basketTotal = E.calculateGroceryBasket(std.lines.map(([itemId, qty]) => ({ itemId, qty })), G.config).total;
    const homeMeal = Math.round(basketTotal / 90);
    const avgFood = Math.round(all.filter((i) => i.cat === 'meals' && i.tier !== 'premium').reduce((s, i) => s + i.price, 0) / all.filter((i) => i.cat === 'meals' && i.tier !== 'premium').length);
    const delivered = avgFood + quickbiteFees(avgFood, 0).reduce((s, f) => s + f.amount, 0);
    let body = online ? '' : `<div class="box" style="color:var(--coral)"><div class="row">${ic('WifiOff')}<span>No connection. You can browse, but ordering needs Wi-Fi or mobile data.</span></div><button class="btn sm sec" data-a="open" data-x="connect">Buy data</button></div>`;
    body += `<div class="section-t">One meal, four ways ${pill('ILLUSTRATIVE')}</div><div class="box outline">
      ${[['Cook at home', homeMeal, 'Everyday basket ÷ 90 meals'], ['Warteg nearby', E.priceOf(D.catalog.byId.warteg, G.config), 'Rice and two sides'], ['Order delivery', delivered, 'Typical meal + fees + tax'], ['Restaurant', E.priceOf(D.catalog.byId.restaurant_set, G.config), 'Sit-down set meal']].map(([l, v, s]) => `<div class="row"><span class="grow"><span class="t">${l}</span><span class="s">${s}</span></span><b class="num">${fmt(v)}</b></div>`).join('')}</div>`;
    for (const cat of ['meals', 'drinks']) body += `<div class="section-t">${cat === 'meals' ? 'Meals' : 'Drinks'}</div><div class="box outline" style="padding:0 14px">${all.filter((i) => i.cat === cat).map((i) => prodRow('quickbite', i)).join('')}</div>`;
    if (lines.length) {
      const feeTotal = fees.reduce((s, f) => s + f.amount, 0);
      body += `<div class="receipt"><div class="kv"><span>Food</span><span>${fmt(quote.total)}</span></div>${fees.map((f) => `<div class="kv"><span>${esc(f.label)}</span><span>${fmt(f.amount)}</span></div>`).join('')}<hr><div class="kv tot"><span>Checkout total</span><span>${fmt(quote.total + feeTotal)}</span></div></div>
        <div class="field"><span class="lab">Tip</span><div class="seg">${[0, 2000, 5000].map((t) => `<button class="${tip === M.rp(t) ? 'on' : ''}" data-a="tip" data-x="${M.rp(t)}">${t ? fmt(M.rp(t)) : 'No tip'}</button>`).join('')}</div></div>`;
    }
    const foot = lines.length ? `<div class="setup-foot"><button class="btn sec" data-a="cart-clear" data-x="quickbite">Clear</button><button class="btn" data-a="qb-order" ${online ? '' : 'disabled'}>Order ${fmt(quote.total + fees.reduce((s, f) => s + f.amount, 0))}</button></div>` : '';
    return frame('quickbite', body, { foot });
  }

  // ── Connect ──────────────────────────────────────────────────
  function connectApp() {
    const h = E.getHousing(G.config.cityId, G.config.housingId);
    const dataLeft = E.hasMobileData(G) ? E.dayNumber(G.dataPlanUntil) - E.dayNumber(G.date) : 0;
    let body = `<div class="box"><div class="row">${ic('Signal')}<span class="grow"><span class="t">Mobile data</span><span class="s">${dataLeft > 0 ? `Active, ${dataLeft} day${dataLeft === 1 ? '' : 's'} left` : E.hasMobileData(G) ? 'Last day today' : 'No active package'}</span></span></div>
      <div class="row">${ic('Wifi')}<span class="grow"><span class="t">Wi-Fi at home</span><span class="s">${h.includes.internet ? 'Included in rent' : G.homeInternet ? 'Home fibre' : 'None'}</span></span></div>
      <small class="muted">Ride-hailing and food delivery need a connection. Operator names and exact packages are not loaded; prices below are ${pill('ILLUSTRATIVE')}.</small></div>
      <div class="section-t">Data packages</div><div class="list">${D.connect.dataPlans.map((p) => `<div class="li row"><span class="grow"><span class="t">${esc(p.name)}</span><span class="s">${p.days} days</span></span><b class="num">${fmt(p.price)}</b><button class="btn sm" data-a="data" data-x="${p.id}">Buy</button></div>`).join('')}</div>`;
    if (!h.includes.internet) body += `<div class="section-t">Home internet (monthly bill)</div><div class="list">${D.connect.homeInternet.map((p) => `<div class="li row"><span class="grow"><span class="t">${esc(p.name)}</span><span class="s">${G.homeInternet === p.id ? 'Subscribed' : 'Billed monthly on day 20'}</span></span><b class="num">${fmt(p.price)}</b>${G.homeInternet === p.id ? `<button class="btn sm sec" data-a="net" data-x="">Cancel</button>` : `<button class="btn sm" data-a="net" data-x="${p.id}">Subscribe</button>`}</div>`).join('')}</div>`;
    body += `<div class="section-t">Devices & repairs (one-off)</div><div class="list">${D.connect.devices.map((p) => `<div class="li row"><span class="grow"><span class="t">${esc(p.name)}</span></span><b class="num">${fmt(p.price)}</b><button class="btn sm sec" data-a="device" data-x="${p.id}">Buy</button></div>`).join('')}</div>
      <small class="muted">Nobody is required to buy a new phone. Device purchases count as one-off upfront costs in your report.</small>`;
    return frame('connect', body);
  }

  // ── FutureMe ─────────────────────────────────────────────────
  function futureApp() {
    const rep = E.generateMonthlyReport(G);
    let body = `<div class="hero" style="background:#4c8c2b;color:#fff"><span class="lbl">Total savings</span><span class="big num" style="font-family:var(--f-display)">${fmt(G.savings)}</span>
      <div class="split"><span>Saved this month<b>${fmt(rep.netSavings)}</b></span><span>Spendable<b>${fmt(G.wallet)}</b></span></div></div>
      <small class="muted">Moving money here lowers what you can spend today, but it is not spending. Reports count it separately.</small>`;
    const amt = sub('futureme', 'amt', 100000);
    body += `<div class="box"><div class="field"><label for="samt">Amount</label><input id="samt" class="inp num" inputmode="numeric" value="${amt}" data-in="samt"></div>
      <div class="row" style="gap:6px;flex-wrap:wrap">${[50000, 100000, 250000, 500000].map((v) => `<button class="chip" data-a="samt" data-x="${v}">${M.formatShort(M.rp(v))}</button>`).join('')}</div></div>`;
    for (const g of G.goals) {
      const p = g.target ? Math.min(1, g.saved / g.target) : 0;
      body += `<div class="box outline"><div class="row"><span class="grow"><span class="t">${esc(g.name)}</span><span class="s">${fmt(g.saved)} of ${fmt(g.target)}</span></span><b>${Math.round(p * 100)}%</b></div>
        <div class="bar"><i style="width:${p * 100}%"></i></div>
        <div class="row" style="gap:6px"><button class="btn sm" data-a="save-in" data-x="${g.id}">Add</button><button class="btn sm sec" data-a="save-out" data-x="${g.id}" ${g.saved ? '' : 'disabled'}>Withdraw</button></div></div>`;
    }
    body += `<div class="section-t">New goal</div><div class="box"><div class="field"><label for="gname">Goal</label><select id="gname" class="inp" data-in="gname">${['Education', 'Travel', 'Replace my phone', 'Hari Raya at home', 'Other'].map((n) => `<option ${sub('futureme', 'gname', 'Education') === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="field"><label for="gtarget">Target (Rp)</label><input id="gtarget" class="inp num" inputmode="numeric" value="${sub('futureme', 'gtarget', 2000000)}" data-in="gtarget"></div><button class="btn" data-a="add-goal">Create goal</button></div>`;
    return frame('futureme', body);
  }

  // ── Recurring ────────────────────────────────────────────────
  function recurringApp() {
    let body = `<small class="muted">Subscriptions renew automatically on the same day each month. Cancel before the renewal day to stop the next charge.</small><div class="list">`;
    for (const d of D.subscriptions) {
      const s = G.subscriptions.find((x) => x.id === d.id);
      body += `<div class="li row"><span class="grow"><span class="t">${esc(d.name)}</span><span class="s">${s && s.active ? `Renews day ${s.renewDay}` : s ? 'Cancelled' : 'Not subscribed'} · ${pill(d.status)}</span></span><b class="num">${fmt(d.price)}</b>
        ${s && s.active ? `<button class="btn sm sec" data-a="unsub" data-x="${d.id}">Cancel</button>` : `<button class="btn sm" data-a="subscribe" data-x="${d.id}">Subscribe</button>`}</div>`;
    }
    body += `</div><div class="section-t">Recurring bills</div><div class="list">${E.billsThisMonth(G).map((b) => `<div class="li row"><span class="grow"><span class="t">${esc(b.label)}</span><span class="s">Due day ${b.dueDay}</span></span><span class="num">${fmt(b.amount)}</span></div>`).join('')}</div>`;
    return frame('recurring', body);
  }

  // ── Workday ──────────────────────────────────────────────────
  function workdayApp() {
    const w = E.resolveWage(G.config.cityId);
    const pay = E.calculateNetIncome(w.amount, G.config.scenario);
    const s = src(w.sourceId);
    const hours = G.config.workweek === 5 ? '8 hours × 5 days' : '7 hours × 6 days';
    let body = `<div class="receipt"><div style="text-align:center;font-weight:700;letter-spacing:.1em">PAYSLIP · ${E.MONTHS[G.date.month].toUpperCase()} ${G.date.year}</div><hr>
      <div class="kv"><span>Wage reference</span><span>${esc(w.label)}</span></div>
      <div class="kv"><span>Gross monthly wage</span><span>${fmt(w.amount, { exact: true })}</span></div>
      ${pay.items.map((i) => `<div class="kv"><span>${esc(i.label)}${i.rateBp != null ? ` (${(i.rateBp / 100).toLocaleString('id-ID')}%)` : ''}</span><span>${fmt(-i.amount)}</span></div>`).join('')}<hr>
      <div class="kv tot"><span>Net pay</span><span>${fmt(pay.net)}</span></div>
      <div class="kv"><span>Paid into wallet</span><span>${G.config.wageTreatment === 'gross' ? 'Gross amount' : 'Net amount'}</span></div>
      <div class="kv"><span>Payday</span><span>Day 1 of each month</span></div>
      <div class="kv"><span>Working time</span><span>40 h/week (${hours})</span></div></div>
      <div class="box"><div class="row"><span class="grow"><span class="t">Source</span><span class="s">${s ? `${srcLink(w.sourceId)}: ${esc(s.title)} (${esc(s.published)})` : 'none'}</span></span>${pill(w.verificationStatus)}</div>
      ${w.notes.map((n) => `<small class="muted">${esc(n)}</small>`).join('')}
      <small class="muted">Effective ${esc(w.effectiveFrom)} to ${esc(w.effectiveTo)}. Minimum wages apply to workers with under one year of service; employers must pay at least this amount. Many people earn more, and informal workers often earn less.</small></div>
      <div class="section-t">Deduction details</div><div class="list">${pay.items.map((i) => `<div class="li"><div class="row"><span class="grow"><span class="t">${esc(i.label)}</span><span class="s">${i.note ? esc(i.note) + ' · ' : ''}${srcLink(i.sourceId)}</span></span>${pill(i.status)}</div></div>`).join('') || '<div class="empty">No payroll deductions modelled in this scenario.</div>'}</div>
      <div class="box"><small>Overtime: hourly wage = monthly wage ÷ 173. The first overtime hour pays 1,5×, later hours 2×. At your wage, three hours of overtime pay <b class="num">${fmt(E.overtimePay(w.amount, 3))}</b>.</small></div>`;
    return frame('workday', body, { title: 'Workday · Payslip' });
  }

  // ── Calendar ─────────────────────────────────────────────────
  function calendarApp() {
    const y = G.date.year, m = G.date.month, dim = E.daysInMonth(y, m);
    const first = E.weekday(y, m, 1);
    const bills = E.billsThisMonth(G);
    let cells = E.WEEKDAYS.map((d) => `<span class="h">${d[0]}</span>`).join('');
    for (let i = 0; i < first; i++) cells += '<span></span>';
    for (let d = 1; d <= dim; d++) {
      const dots = [];
      if (d === 1) dots.push('dot-pay');
      bills.filter((b) => b.dueDay === d).forEach((b) => dots.push(b.status === 'paid' ? 'dot-paid' : 'dot-bill'));
      G.subscriptions.filter((s) => s.active && s.renewDay === d).forEach(() => dots.push('dot-sub'));
      const wd = E.weekday(y, m, d);
      cells += `<span class="c ${d < G.date.day ? 'past' : ''} ${d === G.date.day ? 'today' : ''}" aria-label="Day ${d}">${d}<span class="dots">${dots.slice(0, 3).map((c) => `<i class="${c}"></i>`).join('')}</span>${wd === 0 || (wd === 6 && G.config.workweek === 5) ? '' : ''}</span>`;
    }
    const upcoming = [];
    for (const b of bills) if (b.status !== 'paid') upcoming.push([b.dueDay, b.label, b.amount, b.status === 'overdue']);
    for (const s of G.subscriptions.filter((x) => x.active)) { const d = D.subscriptions.find((z) => z.id === s.id); upcoming.push([s.renewDay, d.name + ' renews', d.price, false]); }
    upcoming.sort((a, b) => a[0] - b[0]);
    let body = `<div class="row"><b style="font-family:var(--f-display);font-size:24px;font-stretch:85%;flex:1">${E.MONTHS[m]} ${y}</b><span class="small muted">Day ${G.date.day} of ${dim}</span></div>
      <div class="cal">${cells}</div>
      <div class="row small muted" style="gap:12px;flex-wrap:wrap"><span><i class="dot-pay" style="display:inline-block;width:8px;height:8px;border-radius:50%"></i> Payday</span><span><i class="dot-bill" style="display:inline-block;width:8px;height:8px;border-radius:50%"></i> Bill due</span><span><i class="dot-paid" style="display:inline-block;width:8px;height:8px;border-radius:50%"></i> Paid</span><span><i class="dot-sub" style="display:inline-block;width:8px;height:8px;border-radius:50%"></i> Renewal</span></div>
      <button class="btn block" data-a="end-day" ${G.phase !== 'play' || G.activeEvent ? 'disabled' : ''}>${ic('Moon')} End day ${G.date.day}</button>
      <div class="section-t">Coming up</div><div class="list">${upcoming.map(([d, l, a, od]) => `<div class="li row"><span class="pill ${od ? 'p-warn' : 'p-muted'}">${od ? 'Overdue' : 'Day ' + d}</span><span class="grow">${esc(l)}</span><span class="num">${fmt(a)}</span></div>`).join('') || '<div class="empty">Nothing scheduled.</div>'}</div>
      <div class="section-t">What happened</div><div class="list">${G.eventsLog.filter((e) => e.month === G.monthIndex).map((e) => `<div class="li row"><span class="pill p-muted">Day ${e.day}</span><span class="grow"><span class="t">${esc(e.title)}</span><span class="s">${esc(e.choice)}</span></span><span class="num">${e.cost ? fmt(-e.cost, { plus: e.cost < 0 }) : '—'}</span></div>`).join('') || '<div class="empty">No events yet this month.</div>'}</div>`;
    return frame('calendar', body);
  }

  // ── Report ───────────────────────────────────────────────────
  function reportApp() {
    const final = G.phase === 'report';
    const r = final ? G.lastReport : E.generateMonthlyReport(G);
    const pastIdx = sub('report', 'past', null);
    const rep = pastIdx != null ? G.reports[pastIdx] : r;
    let body = '';
    if (G.reports.length) body += `<div class="row" style="gap:6px;flex-wrap:wrap"><button class="chip ${pastIdx == null ? 'on' : ''}" data-a="rep-past" data-x="">${final ? 'This month' : 'Month to date'}</button>${G.reports.map((x, i) => `<button class="chip ${pastIdx === i ? 'on' : ''}" data-a="rep-past" data-x="${i}">Month ${x.monthIndex}</button>`).join('')}</div>`;
    body += `<div class="hero" style="background:#0d4d63;color:#fff"><span class="lbl">${final && pastIdx == null ? 'Month complete' : 'Month ' + rep.monthIndex + (pastIdx == null ? ', so far' : '')}</span>
      <span class="big num" style="font-family:var(--f-display)">${fmt(rep.remaining)}</span><span class="lbl">left after spending and one-off costs</span>
      <div class="split"><span>Income<b>${fmt(rep.income)}</b></span><span>Spent<b>${fmt(rep.consumption)}</b></span><span>To savings<b>${fmt(rep.netSavings)}</b></span></div></div>`;
    body += `<div class="section-t">Where you landed</div><div class="ladder">${rep.ladder.map((l) => `<div class="rung ${l.reached ? 'on' : ''}"><span class="mk">${ic(l.reached ? 'Check' : 'Minus')}</span><span class="grow"><span class="t">${esc(l.label)}</span>${l.detail ? `<span class="s small muted" style="display:block">${esc(l.detail)}</span>` : ''}</span><span class="small">${l.reached ? 'Reached' : 'Not this month'}</span></div>`).join('')}</div>`;
    const m = (label, v, f) => `<div class="box outline metric"><span class="t" style="font-weight:700">${label}</span><span class="v">${pct(v)}</span><span class="f">${f}</span></div>`;
    body += `<div class="section-t">Metrics</div>
      ${m('Essential expense ratio', rep.essentialRatio, `(bills ${M.formatShort(rep.mandatory)} + everyday essentials ${M.formatShort(rep.variableEssential)} + essential surprises ${M.formatShort(rep.unexpectedEss)}) ÷ income ${M.formatShort(rep.income)}`)}
      ${m('Discretionary spending ratio', rep.discretionaryRatio, `(optional ${M.formatShort(rep.discretionary)} + optional surprises ${M.formatShort(rep.unexpectedDisc)}) ÷ income`)}
      ${m('Savings rate', rep.savingsRate, `(moved in ${M.formatShort(rep.savingsIn)} − withdrawn ${M.formatShort(rep.savingsOut)}) ÷ income`)}
      <div class="box outline metric"><span class="t" style="font-weight:700">Remaining income</span><span class="v">${M.formatShort(rep.remaining)}</span><span class="f">income ${M.formatShort(rep.income)} − consumption ${M.formatShort(rep.consumption)} − one-off costs ${M.formatShort(rep.upfront)}. Savings transfers are not subtracted: of this, ${M.formatShort(rep.netSavings)} went to savings and the rest stayed in your wallet.</span></div>`;
    body += `<div class="section-t">Breakdown</div><div class="receipt">
      <div class="kv"><span>Salary</span><span>${fmt(rep.salary)}</span></div><div class="kv"><span>Extra income</span><span>${fmt(rep.extraIncome)}</span></div><hr>
      <div class="kv"><span>Mandatory bills</span><span>${fmt(rep.mandatory)}</span></div><div class="kv"><span>Everyday essentials</span><span>${fmt(rep.variableEssential)}</span></div>
      <div class="kv"><span>Optional spending</span><span>${fmt(rep.discretionary)}</span></div><div class="kv"><span>Unexpected</span><span>${fmt(rep.unexpected)}</span></div>
      <div class="kv"><span>One-off upfront</span><span>${fmt(rep.upfront)}</span></div><hr>
      <div class="kv"><span>Unpaid obligations</span><span style="color:${rep.unpaidTotal ? 'var(--coral)' : 'inherit'}">${fmt(rep.unpaidTotal)}</span></div>
      <div class="kv"><span>Wallet at end</span><span>${fmt(rep.walletEnd)}</span></div><div class="kv"><span>Savings at end</span><span>${fmt(rep.savingsEnd)}</span></div><hr>
      <div class="kv"><span>Optional items bought</span><span>${rep.counters.optionalBought}</span></div><div class="kv"><span>Postponed or skipped</span><span>${rep.counters.postponed + rep.counters.skipped}</span></div>
      <div class="kv"><span>Meals missed</span><span>${rep.counters.missedMeals}</span></div><div class="kv"><span>Days without power</span><span>${rep.counters.outageDays}</span></div>
      <div class="kv"><span>Commutes you couldn't pay</span><span>${rep.counters.missedWork}</span></div><div class="kv"><span>Mood</span><span>${rep.wellbeing}/100</span></div></div>
      ${rep.unpaid.length ? `<div class="box"><b>Unpaid</b>${rep.unpaid.map((u) => `<div class="kv"><span>${esc(u.label)}</span><span class="num">${fmt(u.amount)}</span></div>`).join('')}<small class="muted">These carry into next month as arrears.</small></div>` : ''}
      <small class="muted">The ladder describes what the month allowed, not how well you played. The same choices land differently in a different city or home.</small>`;
    const foot = final && pastIdx == null ? `<div class="setup-foot"><button class="btn sec" data-a="open" data-x="compare">Compare places</button><button class="btn" data-a="next-month">Start month ${G.monthIndex + 1}</button></div>` : '';
    return frame('report', body, { title: final ? 'End of month' : 'Report', foot });
  }

  // ── Compare ──────────────────────────────────────────────────
  function cityOptions(sel) {
    return D.indonesia.provinces.map((p) => `<optgroup label="${esc(p.name)}">${E.citiesForProvince(p.id).map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}${c.wage ? '' : ' (UMP)'}</option>`).join('')}</optgroup>`).join('');
  }
  function compareApp() {
    const cp = ui.compare;
    const base = { scenario: G.config.scenario, wageTreatment: 'net', distanceKm: G.config.distanceKm, workweek: G.config.workweek, basket: cp.basket, familyContribution: G.config.familyContribution };
    const A = E.estimateMonthlyBudget({ ...base, cityId: cp.a, housingId: cp.housing });
    const B = E.estimateMonthlyBudget({ ...base, cityId: cp.b, housingId: cp.housing });
    const name = (x) => E.getLocality(x.cfg.cityId).city.name;
    let body = `<div class="box"><div class="field"><label for="cmpa">Place A</label><select id="cmpa" class="inp" data-in="cmpa">${cityOptions(cp.a)}</select></div>
      <div class="field"><label for="cmpb">Place B</label><select id="cmpb" class="inp" data-in="cmpb">${cityOptions(cp.b)}</select></div>
      <div class="field"><span class="lab">Same household in both places</span><div class="seg">${[['kost_typical', 'Kost alone'], ['shared_typical', 'Shared room'], ['family', 'With family']].map(([k, l]) => `<button class="${cp.housing === k ? 'on' : ''}" data-a="cmp" data-k="housing" data-x="${k}">${l}</button>`).join('')}</div></div>
      <div class="field"><span class="lab">Grocery basket</span><div class="seg">${[['budget', 'Lean'], ['standard', 'Everyday']].map(([k, l]) => `<button class="${cp.basket === k ? 'on' : ''}" data-a="cmp" data-k="basket" data-x="${k}">${l}</button>`).join('')}</div></div>
      <div class="seg"><button class="${cp.view === 'A' ? 'on' : ''}" data-a="cmp" data-k="view" data-x="A">Local prices</button><button class="${cp.view === 'B' ? 'on' : ''}" data-a="cmp" data-k="view" data-x="B">Monthly life</button></div></div>`;
    const row = (l, a, b, cls = '') => `<tr class="${cls}"><td>${l}</td><td>${a}</td><td>${b}</td></tr>`;
    const head = `<thead><tr><th></th><th>${esc(name(A))}</th><th>${esc(name(B))}</th></tr></thead>`;
    if (cp.view === 'A') {
      const item = (id) => D.catalog.byId[id];
      body += `<div class="cmp-wrap"><table class="cmp">${head}<tbody>
        ${row('Wage floor', `${fmt(A.wage.amount)}<br><span class="small">${A.wage.wageType}</span>`, `${fmt(B.wage.amount)}<br><span class="small">${B.wage.wageType}</span>`)}
        ${row('Take-home', fmt(A.pay.net), fmt(B.pay.net))}
        ${row('Typical kost', fmt(E.getHousing(cp.a, 'kost_typical').monthlyRent), fmt(E.getHousing(cp.b, 'kost_typical').monthlyRent))}
        ${row('Rent tier', E.getLocality(cp.a).city.tier, E.getLocality(cp.b).city.tier)}
        ${row('Medium rice, 1 kg', fmt(item('rice_medium_1').price), fmt(item('rice_medium_1').price))}
        ${row('Eggs, 1 kg', fmt(item('eggs_1kg').price), fmt(item('eggs_1kg').price))}
        ${row('Cheapest commute', A.plan ? esc(A.plan.label) : '—', B.plan ? esc(B.plan.label) : '—')}
        ${row('Kost rent as % of take-home', pct(E.getHousing(cp.a, 'kost_typical').monthlyRent / A.pay.net), pct(E.getHousing(cp.b, 'kost_typical').monthlyRent / B.pay.net), 'tot')}
        </tbody></table></div><small class="muted">Both places are in rupiah, so no conversion is needed. Food prices are national averages and are the same in both columns: the game has no city-level food prices yet.</small>`;
    } else {
      body += `<div class="cmp-wrap"><table class="cmp">${head}<tbody>
        ${row('Take-home pay', fmt(A.income), fmt(B.income), 'tot')}
        ${row('Housing', fmt(A.rent), fmt(B.rent))}
        ${row('Electricity', A.elec ? fmt(A.elec) : 'incl.', B.elec ? fmt(B.elec) : 'incl.')}
        ${row('Water', A.water ? fmt(A.water) : 'incl.', B.water ? fmt(B.water) : 'incl.')}
        ${row('Commute', `${fmt(A.transport)}<br><span class="small">${A.plan ? esc(A.plan.label) : ''}</span>`, `${fmt(B.transport)}<br><span class="small">${B.plan ? esc(B.plan.label) : ''}</span>`)}
        ${row('Groceries', fmt(A.groceries), fmt(B.groceries))}
        ${row('Mobile data', fmt(A.phone), fmt(B.phone))}
        ${row('Healthcare', A.cfg.scenario === 'formal' ? 'JKN via payroll' : 'Not included', B.cfg.scenario === 'formal' ? 'JKN via payroll' : 'Not included')}
        ${row('Essentials total', fmt(A.essentials), fmt(B.essentials), 'tot')}
        ${row('Left for savings & choice', `<span style="color:${A.remaining < 0 ? 'var(--coral)' : 'var(--green)'}">${fmt(A.remaining)}</span>`, `<span style="color:${B.remaining < 0 ? 'var(--coral)' : 'var(--green)'}">${fmt(B.remaining)}</span>`, 'tot')}
        ${row('Essentials as % of pay', pct(A.essentials / A.income), pct(B.essentials / B.income))}
        </tbody></table></div>
        <small class="muted">A planned month with the same household, basket, distance (${G.config.distanceKm} km) and cheapest practical commute in both places; no surprises. City-level rent uses the tier model and food uses national averages, so differences come mostly from wages, rent tier and transport. No place is "better" overall: subsidies, family support, job type and transport access change the result.</small>`;
    }
    body += `<div class="box"><b>Other countries</b><small class="muted">South Korea, Japan, Australia, New Zealand, the UK, the US, Singapore, Malaysia, Thailand, the Philippines and Germany are in the catalogue with their wage systems described, but their wage and price data are not loaded yet, so they can't be compared.</small></div>`;
    return frame('compare', body);
  }

  // ── Sources ──────────────────────────────────────────────────
  function sourcesApp() {
    const tab = sub('sources', 'tab', 'inuse');
    let body = '';
    if (tab === 'inuse') {
      const w = E.resolveWage(G.config.cityId);
      const pay = E.calculateNetIncome(w.amount, G.config.scenario);
      const h = E.getHousing(G.config.cityId, G.config.housingId);
      const plan = E.currentCommutePlan(G);
      const rows = [
        ['Minimum wage', fmt(w.amount, { exact: true }), w.verificationStatus, w.sourceId],
        ...pay.items.map((i) => [i.label, fmt(i.amount), i.status, i.sourceId]),
        ['Housing: ' + h.label, h.type === 'family' ? fmt(G.config.familyContribution) : fmt(h.monthlyRent), h.status, h.sourceId],
        ['Electricity tariff', 'Rp' + E.TARIFFS[G.config.electricity.tariff].major.replace('.', ',') + '/kWh', 'VERIFIED', 'pln_2026'],
        ['Appliance consumption', E.estimateElectricity(G.config.electricity).kwh + ' kWh/month', 'ESTIMATED', 'game_assumption'],
        ...(plan ? plan.legs.map((l) => ['Commute: ' + l.label, l.cost == null ? '—' : fmt(l.cost), l.status, l.sourceId || 'game_assumption']) : []),
      ];
      body += `<small class="muted">The numbers your current game is using, with where each one comes from.</small><div class="list">${rows.map(([l, v, st, s]) => `<div class="li"><div class="row"><span class="grow"><span class="t">${esc(l)}</span><span class="s">${srcLink(s)}</span></span><span style="text-align:right"><b class="num">${v}</b><br>${pill(st)}</span></div></div>`).join('')}</div>`;
    } else if (tab === 'registry') {
      body += `<div class="list">${D.sources.map((s) => `<div class="li"><div class="t" style="font-weight:700">${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : esc(s.title)}</div>
        <div class="small muted">${esc(s.publisher)} · ${esc(s.type)} · published ${esc(s.published)} · checked ${esc(s.accessed)}</div><div class="small">${esc(s.note)}</div></div>`).join('')}</div>`;
    } else {
      const counts = {};
      D.catalog.items.forEach((i) => { counts[i.status] = (counts[i.status] || 0) + 1; });
      const umk = D.indonesia.cities.filter((c) => c.wage).length;
      body += `<div class="box"><b>What's loaded</b>
        <div class="kv"><span>Provinces with 2026 UMP</span><span>38 of 38</span></div>
        <div class="kv"><span>Cities/regencies with 2026 UMK</span><span>${umk} of 514</span></div>
        <div class="kv"><span>Other localities listed (UMP fallback)</span><span>${D.indonesia.cities.length - umk}</span></div>
        <div class="kv"><span>Products verified / estimated / illustrative</span><span>${counts.VERIFIED || 0} / ${counts.ESTIMATED || 0} / ${counts.ILLUSTRATIVE || 0}</span></div>
        <div class="kv"><span>Countries playable</span><span>1 of 12</span></div></div>
        <div class="box outline"><b>Labels</b>
        <div class="row">${pill('VERIFIED')}<span class="small">Supported by a cited source. National averages are still national.</span></div>
        <div class="row">${pill('ESTIMATED')}<span class="small">Derived from a documented method or anchored to a source.</span></div>
        <div class="row">${pill('ILLUSTRATIVE')}<span class="small">A plausible gameplay value, not a real-world claim.</span></div>
        <div class="row">${pill('UNAVAILABLE')}<span class="small">No reliable value; the game asks you or leaves it out.</span></div></div>
        <div class="box"><b>Known gaps</b><small class="muted">Most UMK values outside Java are not loaded. Wage figures are taken from press reports of governor decrees, not the decree PDFs. Food prices are national, not city-level. Rents outside Jabodetabek are scaled estimates. City bus fares, ride-hailing platform fees, packaged-goods prices and phone plans are not observed. Data is a static snapshot (checked 26 Oct 2026), not live.</small></div>`;
    }
    return frame('sources', body, { tabs: tabs('sources', [['inuse', 'In this game'], ['registry', 'All sources'], ['coverage', 'Coverage']], tab), scrollKey: tab });
  }

  // ── Settings ─────────────────────────────────────────────────
  function settingsApp() {
    const c = G.config;
    const confirm = sub('settings', 'confirm', null);
    let body = `<div class="box"><div class="field"><span class="lab">Starting balance and paydays use</span><div class="seg">${[['net', 'Net take-home'], ['gross', 'Gross wage']].map(([k, l]) => `<button class="${c.wageTreatment === k ? 'on' : ''}" data-a="cfg" data-k="wageTreatment" data-x="${k}">${l}</button>`).join('')}</div><small class="muted">Applies from the next payday.</small></div>
      <div class="field"><span class="lab">Surprise events</span><div class="seg">${['calm', 'normal', 'chaotic'].map((k) => `<button class="${c.difficulty === k ? 'on' : ''}" data-a="cfg" data-k="difficulty" data-x="${k}">${k}</button>`).join('')}</div></div>
      <div class="field"><label for="padj">Local price adjustment: <b>${c.priceAdjustBp >= 0 ? '+' : ''}${c.priceAdjustBp / 100}%</b></label><input id="padj" type="range" min="-20" max="60" step="5" value="${c.priceAdjustBp / 100}" data-in="padj">
        <small class="muted">Shifts store prices from national averages to what you see locally. Adjusted verified prices are relabelled Estimated.</small></div>
      <div class="field"><label for="ppj">Street-lighting tax on electricity (PPJ): <b>${c.ppjBp / 100}%</b></label><input id="ppj" type="range" min="0" max="10" step="0.5" value="${c.ppjBp / 100}" data-in="ppj"></div></div>
      <div class="section-t">Game</div><div class="box outline">
      <div class="kv"><span>Seed</span><span class="num">${G.seed}</span></div>
      ${confirm ? `<div class="box" style="background:var(--coral-soft)"><b>${confirm === 'replay' ? 'Restart this month with the same seed?' : confirm === 'new' ? 'Set up a new scenario?' : 'Erase your saved game?'}</b><small>Your current progress will be lost.</small>
        <div class="row" style="gap:8px"><button class="btn sec sm" data-a="confirm" data-x="">Keep playing</button><button class="btn warn sm" data-a="do" data-x="${confirm}">${confirm === 'replay' ? 'Replay' : confirm === 'new' ? 'New scenario' : 'Erase'}</button></div></div>`
        : `<button class="btn sec" data-a="confirm" data-x="replay">Replay from day 1 with the same seed</button><button class="btn sec" data-a="confirm" data-x="new">New scenario (change place or home)</button><button class="btn ghost" data-a="confirm" data-x="reset" style="color:var(--coral)">Erase saved game</button>`}
      </div><small class="muted">Progress saves in this browser only.</small>`;
    return frame('settings', body);
  }

  // ── sheets (product, transaction) ────────────────────────────
  function sheetView() {
    if (!ui.sheet) return '';
    let inner = '';
    if (ui.sheet.type === 'item') {
      const it = D.catalog.byId[ui.sheet.id];
      const p = E.priceOf(it, G.config);
      const s = src(it.sourceId);
      const eff = Object.entries(it.effects || {}).filter(([, v]) => v).map(([k, v]) => ({ staple: `+${v} staple portions`, side: `+${v} side portions`, complete: `+${v} full meal${v > 1 ? 's' : ''}`, water: `+${v} days drinking water`, soap: `+${v} days soap`, shampoo: `+${v} days shampoo`, toothpaste: `+${v} days toothpaste`, laundry: `+${v} days laundry`, dish: `+${v} days dish soap`, gasMeals: `cooks ${v} meals`, baby: `+${v} days baby supplies`, wellbeing: `+${v} mood`, raincoat: 'keeps you dry', health: 'eases symptoms' })[k]).filter(Boolean);
      inner = `<h3>${esc(it.name)}</h3><div class="row" style="flex-wrap:wrap;gap:6px">${pill(E.priceStatus(it, G.config))}<span class="pill p-muted">${esc(it.tier)}</span><span class="pill p-muted">${it.essential ? 'Essential' : 'Optional'}</span><span class="pill p-muted">${it.origin}</span></div>
        <div class="receipt"><div class="kv"><span>Price</span><span>${fmt(p)}</span></div><div class="kv"><span>Package</span><span>${esc(it.size)}</span></div>${unitPrice(it, p) ? `<div class="kv"><span>Unit price</span><span>${unitPrice(it, p)}</span></div>` : ''}
        <div class="kv"><span>Observed</span><span>${esc(it.observed || 'not observed')}</span></div><div class="kv"><span>In the game</span><span>${esc(eff.join(', ') || '—')}</span></div></div>
        <div class="small">${s ? `${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : esc(s.title)} — ${esc(s.note)}` : ''}</div>${it.note ? `<div class="small muted">${esc(it.note)}</div>` : ''}
        <button class="btn" data-a="qty" data-store="${it.store}" data-x="${it.id}" data-d="1">Add to cart</button>`;
    } else if (ui.sheet.type === 'tx') {
      const t = G.transactions.find((x) => x.id === ui.sheet.id);
      if (!t) return '';
      inner = `<h3>${esc(t.merchant)}</h3><div class="receipt">
        <div class="kv"><span>Date</span><span>${esc(E.dateLabel({ year: t.y, month: t.m, day: t.day }, true))}</span></div>
        <div class="kv"><span>Category</span><span>${esc(t.category)}</span></div><div class="kv"><span>Type</span><span>${esc({ income: 'Income', income_extra: 'Extra income', mandatory: 'Bill', essential: 'Essential', discretionary: 'Optional', mixed: 'Essential + optional', unexpected: 'Unexpected', upfront: 'One-off upfront', savings_in: 'Savings transfer', savings_out: 'Savings withdrawal' }[t.cls] || t.cls)}</span></div>
        <div class="kv"><span>Amount</span><span>${fmt(t.amount, { plus: t.amount > 0 })}</span></div><div class="kv"><span>Status</span><span>${t.status === 'failed' ? 'Declined, nothing deducted' : 'Completed'}</span></div>
        <div class="kv"><span>Balance after</span><span>${fmt(t.balanceAfter)}</span></div>
        ${t.items ? '<hr>' + t.items.map((i) => `<div class="kv"><span>${esc(i.name)} × ${i.qty}</span><span>${fmt(i.unit * i.qty)}</span></div>`).join('') : ''}
        ${t.note ? `<hr><div class="small">${esc(t.note)}</div>` : ''}</div>`;
    }
    return `<div class="overlay" data-a="sheet-close"><div class="sheet" role="dialog" aria-modal="true" data-stop="1"><div class="grab"></div>${inner}<button class="btn sec" data-a="sheet-close">Close</button></div></div>`;
  }

  function eventView() {
    if (!G.activeEvent || !ui.eventOpen) return '';
    const ev = G.activeEvent;
    return `<div class="overlay"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="evt" data-stop="1"><div class="grab"></div>
      <div class="row">${appTile(APPS[ev.app] ? ev.app : NOTIF_APP[ev.app] || 'calendar', 36)}<span class="small muted">Day ${ev.day} · decision</span></div>
      <h3 id="evt">${esc(ev.title)}</h3><p style="margin:0;line-height:1.5">${esc(ev.body)}</p>
      ${ev.choices.map((ch, i) => `<button class="choice" data-a="choose" data-x="${i}"><span>${esc(ch.label)}${ch.note ? `<br><span class="small muted">${esc(ch.note)}</span>` : ''}</span><b>${ch.cost > 0 ? fmt(-ch.cost) : ch.cost < 0 ? fmt(-ch.cost, { plus: true }) : 'Rp0'}</b></button>`).join('')}
      <small class="muted">${pill('ILLUSTRATIVE')} Event amounts are gameplay values. Your balance: ${fmt(G.wallet)}.</small>
      <button class="btn ghost" data-a="event-close">Decide later</button></div></div>`;
  }

  // ════════════════════════════════════════════════════════════
  // SETUP
  // ════════════════════════════════════════════════════════════
  const STEPS = ['Welcome', 'Country', 'Province', 'City', 'Work', 'Home', 'Settings', 'Confirm'];
  function setupView() {
    const d = ui.draft, step = ui.step;
    const stepBar = step ? `<div class="steps" aria-label="Step ${step} of ${STEPS.length - 1}">${STEPS.slice(1).map((_, i) => `<i class="${i < step ? 'on' : ''}"></i>`).join('')}</div>` : '';
    let body = '', canNext = true, nextLabel = 'Continue';
    if (step === 0) {
      const saved = loadSaved();
      body = `<div style="flex:1"></div><div class="small muted" style="font-family:var(--f-mono);letter-spacing:.08em">REAL LIFE SIMULATOR</div><h2 style="font-size:46px">Your salary is fixed. Your expenses aren't.</h2>
        <p class="lede">Start a month on a 2026 minimum wage somewhere in Indonesia. Pay rent, keep the lights on, buy food, get to work, and decide what is left for you.</p>
        <p class="lede" style="font-family:var(--f-display);font-stretch:90%;font-weight:700;color:var(--ink);font-size:18px">Can you afford to live, or only afford to survive?</p>
        ${saved ? `<button class="opt" data-a="continue"><span class="grow"><span class="t">Continue saved game</span><span class="s">Month ${saved.monthIndex}, day ${saved.date.day} · ${esc(E.getLocality(saved.config.cityId).city.name)} · ${fmt(saved.wallet)}</span></span>${ic('ChevronRight')}</button>` : ''}`;
      nextLabel = 'New game';
    } else if (step === 1) {
      body = `<h2>Choose a country</h2><p class="lede">Each country sets its wage floor differently. Only Indonesia has data loaded in this version.</p>
        ${D.countries.map((c) => `<button class="opt ${d.countryId === c.id ? 'on' : ''}" data-a="d-country" data-x="${c.id}" ${c.dataStatus === 'loaded' ? '' : 'disabled'}><span class="flag">${c.flagCode}</span><span class="grow"><span class="t">${esc(c.name)} ${c.dataStatus === 'loaded' ? '' : '<span class="pill p-muted">Not loaded yet</span>'}</span><span class="s">${esc(c.wageSystem)}</span></span></button>`).join('')}`;
    } else if (step === 2) {
      const q = ui.provQ.toLowerCase();
      const list = D.indonesia.provinces.filter((p) => p.name.toLowerCase().includes(q) || E.citiesForProvince(p.id).some((c) => c.name.toLowerCase().includes(q)));
      body = `<h2>Province</h2><p class="lede">All 38 provinces carry their 2026 UMP. Search a province or a city.</p>
        <div class="search">${ic('Search')}<input id="provq" type="search" placeholder="e.g. Banten, Bekasi, Papua" value="${esc(ui.provQ)}" data-in="provq" aria-label="Search provinces"></div>
        ${list.map((p) => `<button class="opt ${d.provinceId === p.id ? 'on' : ''}" data-a="d-prov" data-x="${p.id}"><span class="grow"><span class="t">${esc(p.name)}</span><span class="s">UMP ${fmt(M.toMinor(p.wage.amountMajor), { exact: true })} · ${E.citiesForProvince(p.id).filter((c) => c.wage).length} UMK loaded</span></span>${ic('ChevronRight')}</button>`).join('') || '<div class="empty">No match.</div>'}`;
      canNext = !!d.provinceId;
    } else if (step === 3) {
      const prov = D.indonesia.provinceById[d.provinceId];
      const list = E.citiesForProvince(d.provinceId);
      body = `<h2>${esc(prov.name)}</h2><p class="lede">Pick where you live and work. A city's own UMK is used when loaded; otherwise the provincial UMP, and the game tells you.</p>
        ${list.map((c) => `<button class="opt ${d.cityId === c.id ? 'on' : ''}" data-a="d-city" data-x="${c.id}"><span class="grow"><span class="t">${esc(c.name)}</span><span class="s">${c.wage ? `UMK ${fmt(M.toMinor(c.wage.amountMajor), { exact: true })}` : prov.id === 'dki' ? `UMP ${fmt(M.toMinor(prov.wage.amountMajor))} (Jakarta has no UMK)` : `UMK not loaded · UMP ${fmt(M.toMinor(prov.wage.amountMajor))} used`} · rent tier ${c.tier}</span></span>${c.wage || prov.id === 'dki' ? pill('VERIFIED') : '<span class="pill p-due">Fallback</span>'}</button>`).join('')}`;
      canNext = !!d.cityId && E.getLocality(d.cityId)?.province.id === d.provinceId;
      if (canNext) {
        const w = E.resolveWage(d.cityId);
        body += `<div class="box"><b>${esc(w.label)}: <span class="num">${fmt(w.amount, { exact: true })}</span></b><small class="muted">Source: ${srcLink(w.sourceId)} · effective ${esc(w.effectiveFrom)}</small>${w.notes.map((n) => `<small class="muted">${esc(n)}</small>`).join('')}</div>`;
      }
    } else if (step === 4) {
      const w = E.resolveWage(d.cityId);
      const pay = E.calculateNetIncome(w.amount, d.scenario);
      body = `<h2>Your job</h2><p class="lede">A full-time job paid exactly the local minimum wage.</p>
        ${[['formal', 'Formal employee', `Payroll deducts BPJS (4%) and PPh 21 where it applies. Take-home ${fmt(E.calculateNetIncome(w.amount, 'formal').net)}.`], ['gross', 'No payroll deductions', `Paid the full ${fmt(w.amount)} with nothing withheld, no JKN through work. Closer to informal arrangements.`]].map(([k, t, s]) => `<button class="opt ${d.scenario === k ? 'on' : ''}" data-a="d-set" data-k="scenario" data-x="${k}"><span class="grow"><span class="t">${t}</span><span class="s">${s}</span></span></button>`).join('')}
        ${d.scenario === 'formal' ? `<div class="field"><span class="lab">Starting balance uses</span><div class="seg">${[['net', `Net ${M.formatShort(pay.net)}`], ['gross', `Gross ${M.formatShort(pay.gross)}`]].map(([k, l]) => `<button class="${d.wageTreatment === k ? 'on' : ''}" data-a="d-set" data-k="wageTreatment" data-x="${k}">${l}</button>`).join('')}</div></div>` : ''}
        <div class="field"><span class="lab">Work week</span><div class="seg"><button class="${d.workweek === 5 ? 'on' : ''}" data-a="d-set" data-k="workweek" data-x="5">5 days × 8 h</button><button class="${d.workweek === 6 ? 'on' : ''}" data-a="d-set" data-k="workweek" data-x="6">6 days × 7 h</button></div></div>
        <div class="field"><label for="ddist">Distance from home to work: <b>${d.distanceKm} km</b></label><input id="ddist" type="range" min="1" max="45" value="${d.distanceKm}" data-in="ddist"></div>`;
    } else if (step === 5) {
      const opts = E.housingOptions(d.cityId);
      if (!opts.some((o) => o.id === d.housingId)) d.housingId = 'kost_typical';
      const h = E.getHousing(d.cityId, d.housingId);
      body = `<h2>Where you live</h2><p class="lede">Rent tier ${E.getLocality(d.cityId).city.tier}. You can move later from HomeBase.</p>
        ${opts.map((o) => `<button class="opt ${d.housingId === o.id ? 'on' : ''}" data-a="d-set" data-k="housingId" data-x="${o.id}"><span class="grow"><span class="t">${esc(o.label)} <span class="small muted">${o.tier !== 'family' ? o.tier : ''}</span></span><span class="s">${o.type === 'family' ? 'Your contribution, you choose' : fmt(o.monthlyRent) + '/month'} · ${['electricity', 'water', 'internet'].filter((k) => o.includes[k]).join(', ') || 'no utilities'} included${o.deposit ? ' · deposit ' + fmt(o.deposit) : ''}</span></span>${pill(o.status)}</button>`).join('')}
        ${h.type === 'family' ? `<div class="field"><label for="dfam">Monthly contribution to the household: <b>${fmt(d.familyContribution)}</b></label><input id="dfam" type="range" min="0" max="2000000" step="50000" value="${d.familyContribution / 100}" data-in="dfam"></div>
          <div class="toggle"><span>Family cooks dinner</span><button class="sw ${d.familyDinner ? 'on' : ''}" data-a="d-set" data-k="familyDinner" data-x="${!d.familyDinner}" role="switch" aria-checked="${d.familyDinner}"></button></div>` : ''}
        ${h.deposit ? `<div class="toggle"><span>Deposit already paid before the game</span><button class="sw ${d.depositPaid ? 'on' : ''}" data-a="d-set" data-k="depositPaid" data-x="${!d.depositPaid}" role="switch" aria-checked="${d.depositPaid}"></button></div><small class="muted">If off, the ${fmt(h.deposit)} deposit is charged on day 1 as a one-off cost.</small>` : ''}
        <div class="field"><span class="lab">Household</span><div class="seg"><button class="${d.household === 'single' ? 'on' : ''}" data-a="d-set" data-k="household" data-x="single">Just me</button><button class="${d.household === 'dependent' ? 'on' : ''}" data-a="d-set" data-k="household" data-x="dependent">Me + a toddler</button></div>
        <small class="muted">With a toddler you need 5 meals a day and baby supplies. Childcare is not modelled.</small></div>`;
    } else if (step === 6) {
      body = `<h2>How bumpy?</h2><p class="lede">Surprises happen on some days: invitations, breakdowns, family requests, overtime offers.</p>
        ${[['calm', 'Calm', 'About one surprise a week'], ['normal', 'Normal', 'About one every four or five days'], ['chaotic', 'Chaotic', 'More than one a week']].map(([k, t, s]) => `<button class="opt ${d.difficulty === k ? 'on' : ''}" data-a="d-set" data-k="difficulty" data-x="${k}"><span class="grow"><span class="t">${t}</span><span class="s">${s}</span></span></button>`).join('')}
        <div class="field"><label for="dseed">Seed (same seed + same choices = same month)</label><input id="dseed" class="inp num" inputmode="numeric" placeholder="Random" value="${esc(ui.seed)}" data-in="dseed"></div>
        <div class="field"><label for="dpadj">Local price adjustment: <b>${d.priceAdjustBp >= 0 ? '+' : ''}${d.priceAdjustBp / 100}%</b></label><input id="dpadj" type="range" min="-20" max="60" step="5" value="${d.priceAdjustBp / 100}" data-in="dpadj"><small class="muted">Store prices are national averages. Raise this for places where food costs more, such as much of eastern Indonesia.</small></div>`;
    } else {
      const w = E.resolveWage(d.cityId);
      const pay = E.calculateNetIncome(w.amount, d.scenario);
      const h = E.getHousing(d.cityId, d.housingId);
      const start = E.calculateStartingBalance(d);
      const { city, province } = E.getLocality(d.cityId);
      body = `<h2>Ready for payday</h2><div class="receipt">
        <div class="kv"><span>Place</span><span>${esc(city.name)}, ${esc(province.name)}</span></div>
        <div class="kv"><span>${esc(w.label)}</span><span>${fmt(w.amount, { exact: true })}</span></div>
        ${d.scenario === 'formal' ? pay.items.map((i) => `<div class="kv"><span>${esc(i.label.replace(' (TER A, single, no dependants)', ''))}</span><span>${fmt(-i.amount)}</span></div>`).join('') : ''}<hr>
        <div class="kv tot"><span>Starting balance (${d.wageTreatment === 'gross' || d.scenario === 'gross' ? 'gross' : 'net'})</span><span>${fmt(start)}</span></div><hr>
        <div class="kv"><span>${esc(h.label)}</span><span>${h.type === 'family' ? fmt(d.familyContribution) : fmt(h.monthlyRent)}/mo</span></div>
        ${!d.depositPaid && h.deposit ? `<div class="kv"><span>Deposit on day 1</span><span>${fmt(h.deposit)}</span></div>` : ''}
        <div class="kv"><span>Commute</span><span>${d.distanceKm} km, ${d.workweek}-day week</span></div>
        <div class="kv"><span>Surprises</span><span>${d.difficulty}</span></div></div>
        <small class="muted">${pill(w.verificationStatus)} wage from ${srcLink(w.sourceId)}. A minimum wage is a legal floor, not what every worker takes home.</small>`;
      nextLabel = 'Start the month';
    }
    return `<div class="status"><span id="clock">--:--</span><span class="notch" aria-hidden="true"></span><span class="right">${ic('Signal')}<span class="batt"><b><i style="width:90%"></i></b></span></span></div>
      <div class="view"><div class="setup" data-scroll="setup:${step}">${stepBar}${body}</div>
      <div class="setup-foot">${step > 0 ? '<button class="btn sec" data-a="s-back">Back</button>' : ''}<button class="btn" data-a="s-next" ${canNext ? '' : 'disabled'}>${nextLabel}</button></div></div>
      <div class="homebar"><button aria-hidden="true" tabindex="-1"></button></div>`;
  }

  // ════════════════════════════════════════════════════════════
  // ACTIONS
  // ════════════════════════════════════════════════════════════
  function money(v) { const n = Math.round(Number(String(v).replace(/[^\d]/g, ''))); return Number.isFinite(n) ? M.rp(n) : 0; }
  function afterGame(prev) { showLatestBanner(prev); save(); }

  const A = {
    // setup
    's-next'() {
      if (ui.step === 7) {
        const seed = ui.seed ? Number(String(ui.seed).replace(/\D/g, '')) || E.hashSeed(ui.seed) : (Math.random() * 2 ** 31) >>> 0;
        G = E.createGame({ ...ui.draft, electricity: { ...ui.draft.electricity } }, seed);
        ui.screen = 'phone'; ui.app = null; ui.carts = {}; ui.store = {}; ui.recent = [];
        ui.compare.a = G.config.cityId;
        afterGame(0);
        if (G.activeEvent) ui.eventOpen = false;
        return;
      }
      ui.step++;
    },
    's-back'() { ui.step = Math.max(0, ui.step - 1); },
    continue() { const s = loadSaved(); if (s) { G = s; ui.screen = 'phone'; ui.app = null; ui.compare.a = G.config.cityId; } },
    'd-country'(el) { ui.draft.countryId = el.dataset.x; },
    'd-prov'(el) { ui.draft.provinceId = el.dataset.x; const first = E.citiesForProvince(el.dataset.x)[0]; ui.draft.cityId = first ? first.id : null; ui.step = 3; },
    'd-city'(el) { ui.draft.cityId = el.dataset.x; },
    'd-set'(el) {
      const k = el.dataset.k; let v = el.dataset.x;
      if (v === 'true' || v === 'false') v = v === 'true';
      else if (k === 'workweek') v = Number(v);
      ui.draft[k] = v;
      if (k === 'scenario' && v === 'gross') ui.draft.wageTreatment = 'gross';
      if (k === 'scenario' && v === 'formal') ui.draft.wageTreatment = 'net';
    },
    // shell
    home() { goHome(); },
    back() { back(); },
    switcher() { ui.switcher = !ui.switcher; ui.nc = false; },
    nc() { ui.nc = !ui.nc; ui.switcher = false; if (ui.nc) ui.banner = null; },
    'nc-clear'() { G.notifications.forEach((n) => { n.read = true; }); save(); },
    notif(el) { const n = G.notifications.find((x) => x.id === el.dataset.x); if (n) { n.read = true; ui.banner = null; if (n.tone === 'event' && G.activeEvent) { ui.eventOpen = true; ui.nc = false; } else openApp(appForNotif(n)); save(); } },
    open(el) { openApp(el.dataset.x); if (el.dataset.cat) { storeState(el.dataset.x).cat = el.dataset.cat; } },
    tab(el) { ui.sub[el.dataset.app] = { ...(ui.sub[el.dataset.app] || {}), tab: el.dataset.x }; },
    // day loop
    'end-day'() {
      if (G.activeEvent) { ui.eventOpen = true; return; }
      const prev = G.notifications.length;
      const r = E.advanceSimulationDay(G);
      if (r.ended) { openApp('report'); toast('Month complete.'); }
      else if (r.log && r.log.length) toast(r.log.join(' · '), true);
      else toast(`Day ${G.date.day}: ${E.dateLabel(G.date)}`);
      if (G.activeEvent) ui.eventOpen = true;
      afterGame(prev);
    },
    'event-open'() { ui.eventOpen = true; },
    'event-close'() { ui.eventOpen = false; },
    choose(el) {
      const prev = G.notifications.length;
      const res = E.resolveEvent(G, Number(el.dataset.x));
      if (result(res, 'Decision made.')) ui.eventOpen = false;
      afterGame(prev);
    },
    'next-month'() { const prev = G.notifications.length; E.startNextMonth(G); ui.app = null; ui.sub.report = {}; afterGame(prev); },
    'rep-past'(el) { ui.sub.report = { past: el.dataset.x === '' ? null : Number(el.dataset.x) }; },
    // bank & bills
    tx(el) { ui.sheet = { type: 'tx', id: el.dataset.x }; },
    'pay-bill'(el) { const prev = G.notifications.length; result(E.processBillPayment(G, el.dataset.x), 'Bill paid.'); afterGame(prev); },
    autopay(el) { const b = G.bills.find((x) => x.id === el.dataset.x); E.setAutopay(G, el.dataset.x, !b.autopay); save(); },
    // stores
    item(el) { ui.sheet = { type: 'item', id: el.dataset.x }; },
    qty(el) {
      const cart = cartOf(el.dataset.store);
      cart[el.dataset.x] = Math.max(0, (cart[el.dataset.x] || 0) + Number(el.dataset.d));
      if (!cart[el.dataset.x]) delete cart[el.dataset.x];
      if (ui.sheet && ui.sheet.type === 'item') { ui.sheet = null; toast('Added to cart.'); }
    },
    scat(el) { storeState(el.dataset.store).cat = el.dataset.x; },
    sfilter(el) { storeState(el.dataset.store).filter = el.dataset.x; },
    cart(el) { storeState(el.dataset.x).view = 'cart'; },
    'cart-clear'(el) { ui.carts[el.dataset.x] = {}; if (ui.store[el.dataset.x]) ui.store[el.dataset.x].view = 'browse'; },
    checkout(el) {
      const id = el.dataset.x;
      const prev = G.notifications.length;
      const res = E.processPurchase(G, { store: id, lines: cartLines(id) });
      if (result(res, `Paid ${fmt(res.total || 0)}.`)) { ui.carts[id] = {}; storeState(id).view = 'browse'; }
      afterGame(prev);
    },
    postpone(el) { const id = el.dataset.x; cartLines(id).forEach((l) => { if (!G.wishlist.includes(l.itemId)) E.toggleWishlist(G, l.itemId, true); }); ui.carts[id] = {}; storeState(id).view = 'browse'; toast('Moved to your wishlist.'); save(); },
    wish(el) { const on = E.toggleWishlist(G, el.dataset.x); toast(on ? 'Saved to wishlist.' : 'Removed from wishlist.'); save(); },
    basket(el) { const b = D.baskets[el.dataset.x]; const cart = cartOf('dailymart'); b.lines.forEach(([id, q]) => { cart[id] = (cart[id] || 0) + q; }); storeState('dailymart').view = 'cart'; toast(`${b.label} basket added. Change anything before paying.`); },
    tip(el) { ui.sub.quickbite = { ...(ui.sub.quickbite || {}), tip: Number(el.dataset.x) }; },
    'qb-order'() {
      const prev = G.notifications.length;
      if (!E.isOnline(G)) { result({ ok: false, error: 'offline' }); return; }
      const lines = cartLines('quickbite');
      const q = E.calculateGroceryBasket(lines, G.config);
      const res = E.processPurchase(G, { store: 'quickbite', lines, fees: quickbiteFees(q.total, sub('quickbite', 'tip', 0)) });
      if (result(res, `Order placed: ${fmt(res.total || 0)}.`)) ui.carts.quickbite = {};
      afterGame(prev);
    },
    // utilities & connect
    token(el) { const prev = G.notifications.length; const r = E.buyToken(G, Number(el.dataset.x)); result(r, r.ok ? `+${r.kwh.toFixed(1)} kWh on your meter.` : ''); afterGame(prev); },
    elec(el) { let v = el.dataset.x; if (v === 'true' || v === 'false') v = v === 'true'; E.updateConfig(G, { electricity: { [el.dataset.k]: v } }); save(); },
    data(el) { const prev = G.notifications.length; result(E.buyDataPlan(G, el.dataset.x), 'Data package active.'); afterGame(prev); },
    net(el) { E.setHomeInternet(G, el.dataset.x || null); toast(el.dataset.x ? 'Subscribed. First bill added.' : 'Cancelled from next month.'); save(); },
    device(el) { const prev = G.notifications.length; result(E.buyDevice(G, el.dataset.x), 'Bought.'); afterGame(prev); },
    // move & housing
    commute(el) { E.setCommute(G, { commutePlanId: el.dataset.x }); toast('Commute updated. Charged each workday.'); save(); },
    ride(el) { const prev = G.notifications.length; result(E.bookRide(G, el.dataset.x, sub('move', 'km', 5)), 'Ride booked.'); afterGame(prev); },
    'move-home'(el) { E.planMove(G, el.dataset.x); toast(G.pendingMove ? 'Move planned for next month.' : 'Move cancelled.'); save(); },
    cfg(el) { let v = el.dataset.x; if (['workweek'].includes(el.dataset.k)) v = Number(v); if (el.dataset.k === 'commutePlanId') E.setCommute(G, { commutePlanId: v }); else E.updateConfig(G, { [el.dataset.k]: v }); save(); },
    'cfg-toggle'(el) { const k = el.dataset.x; if (k === 'motorcycleCredit') E.setCommute(G, { motorcycleCredit: !G.config[k] }); else E.updateConfig(G, { [k]: !G.config[k] }); save(); },
    // savings & subs
    samt(el) { ui.sub.futureme = { ...(ui.sub.futureme || {}), amt: Number(el.dataset.x) }; },
    'save-in'(el) { result(E.processSavingsTransfer(G, M.rp(Number(sub('futureme', 'amt', 100000)) || 0), 'in', el.dataset.x), 'Moved to savings.'); save(); },
    'save-out'(el) { result(E.processSavingsTransfer(G, M.rp(Number(sub('futureme', 'amt', 100000)) || 0), 'out', el.dataset.x), 'Moved back to your wallet.'); save(); },
    'add-goal'() { E.addGoal(G, sub('futureme', 'gname', 'Education'), money(sub('futureme', 'gtarget', 2000000)), 'custom'); toast('Goal created.'); save(); },
    subscribe(el) { const prev = G.notifications.length; result(E.subscribe(G, el.dataset.x), 'Subscribed.'); afterGame(prev); },
    unsub(el) { E.cancelSubscription(G, el.dataset.x); toast('Cancelled. No more renewals.'); save(); },
    // compare, settings, sheets
    cmp(el) { ui.compare[el.dataset.k] = el.dataset.x; },
    confirm(el) { ui.sub.settings = { confirm: el.dataset.x || null }; },
    do(el) {
      const what = el.dataset.x;
      ui.sub.settings = {};
      if (what === 'replay') { G = E.createGame({ ...G.config, commutePlanId: G.config.commutePlanId, electricity: { ...G.config.electricity } }, G.seed); ui.app = null; ui.carts = {}; afterGame(0); toast('Replaying from day 1.'); }
      else if (what === 'new') { ui.draft = { ...G.config, electricity: { ...G.config.electricity } }; ui.screen = 'setup'; ui.step = 2; ui.seed = ''; }
      else { storageDel(SAVE_KEY); G = null; ui.screen = 'setup'; ui.step = 0; ui.draft = E.defaultConfig(); }
    },
    'sheet-close'() { ui.sheet = null; },
  };

  const INPUTS = {
    provq(el) { ui.provQ = el.value; },
    ddist(el) { ui.draft.distanceKm = Number(el.value); },
    dfam(el) { ui.draft.familyContribution = M.rp(Number(el.value)); },
    dseed(el) { ui.seed = el.value; },
    dpadj(el) { ui.draft.priceAdjustBp = Number(el.value) * 100; },
    storeq(el) { storeState(el.dataset.store).q = el.value; },
    dist(el) { E.updateConfig(G, { distanceKm: Number(el.value) }); save(); },
    ridekm(el) { ui.sub.move = { ...(ui.sub.move || {}), km: Number(el.value) }; },
    busfare(el) { const v = Number(el.value.replace(/\D/g, '')); E.updateConfig(G, { customBusFare: v ? M.rp(v) : null }); save(); },
    fam(el) { E.updateConfig(G, { familyContribution: M.rp(Number(el.value)) }); save(); },
    water(el) { E.updateConfig(G, { waterBill: M.rp(Number(el.value)) }); save(); },
    grocbudget(el) { E.updateConfig(G, { groceryBudget: M.rp(Number(el.value)) }); save(); },
    samt(el) { ui.sub.futureme = { ...(ui.sub.futureme || {}), amt: Number(el.value.replace(/\D/g, '')) || 0 }; },
    gname(el) { ui.sub.futureme = { ...(ui.sub.futureme || {}), gname: el.value }; },
    gtarget(el) { ui.sub.futureme = { ...(ui.sub.futureme || {}), gtarget: Number(el.value.replace(/\D/g, '')) || 0 }; },
    cmpa(el) { ui.compare.a = el.value; },
    cmpb(el) { ui.compare.b = el.value; },
    padj(el) { E.updateConfig(G, { priceAdjustBp: Number(el.value) * 100 }); save(); },
    ppj(el) { E.updateConfig(G, { ppjBp: Math.round(Number(el.value) * 100) }); save(); },
  };
  // text fields re-render on input; sliders on change to keep dragging smooth
  const LIVE_TEXT = new Set(['provq', 'storeq', 'dseed', 'samt', 'gtarget', 'busfare']);

  function boot() {
    const rootEl = document.getElementById('app');
    rootEl.addEventListener('click', (e) => {
      const t = e.target.closest('[data-a]');
      if (!t || !rootEl.contains(t)) return;
      if (t.dataset.a === 'sheet-close' && t.classList.contains('overlay') && e.target.closest('[data-stop]')) return;
      if (t.disabled) return;
      const fn = A[t.dataset.a];
      if (!fn) return;
      if (ui.banner && t.dataset.a !== 'notif') ui.banner = null; // any other tap dismisses the banner
      fn(t);
      render();
    });
    rootEl.addEventListener('dblclick', (e) => { if (e.target.closest('[data-dbl="switcher"]')) { ui.switcher = true; render(); } });
    let pressTimer = null;
    rootEl.addEventListener('pointerdown', (e) => { if (e.target.closest('[data-dbl="switcher"]')) pressTimer = setTimeout(() => { ui.switcher = true; pressTimer = 'fired'; render(); }, 500); });
    rootEl.addEventListener('pointerup', () => { if (pressTimer && pressTimer !== 'fired') clearTimeout(pressTimer); pressTimer = null; });
    rootEl.addEventListener('input', (e) => {
      const el = e.target.closest('[data-in]');
      if (!el || !INPUTS[el.dataset.in]) return;
      INPUTS[el.dataset.in](el);
      if (LIVE_TEXT.has(el.dataset.in)) render();
    });
    rootEl.addEventListener('change', (e) => {
      const el = e.target.closest('[data-in]');
      if (!el || !INPUTS[el.dataset.in] || LIVE_TEXT.has(el.dataset.in)) return;
      INPUTS[el.dataset.in](el);
      render();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { if (ui.eventOpen) ui.eventOpen = false; else back(); render(); }
    });
    setInterval(updateClock, 15000);
    const saved = loadSaved();
    if (saved) { ui.step = 0; }
    render();
  }

  RLS.ui = { boot, _ui: ui, get game() { return G; } };
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
