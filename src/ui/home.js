/*
 * ui/home.js — the home screen (widgets, app grid, dock) and the end-of-day flow.
 */
(function (root) {
  const RLS = root.RLS;
  const E = RLS.engine, M = RLS.money, D = RLS.data, I = RLS.i18n, U = RLS.U;
  const { esc, T, t, L, ic, fmt, short } = U;
  const ui = U.ui;
  const bi = I.bi;

  const WEATHER = { rain: ['CloudRain', bi('Hujan', 'Rain')], hot: ['Sun', bi('Panas', 'Hot')], clear: ['Cloud', bi('Cerah berawan', 'Fair')] };
  U.WEATHER = WEATHER;

  U.dayStatus = (G) => {
    if (G.trip && G.trip.active) return t('Sedang bepergian', 'Travelling');
    if (!E.isEmployed(G)) return t('Belum bekerja', 'Not working');
    if (G.day.leave) return G.day.leave.reason === 'sick' ? t('Izin sakit', 'Sick leave') : G.day.leave.paid ? t('Cuti', 'On leave') : t('Izin tanpa upah', 'Unpaid leave');
    if (E.isScheduledToWork(G)) return G.job.arrangement === 'remote' ? t('Kerja dari rumah', 'Working from home') : t('Hari kerja', 'Workday');
    if (G.job && G.job.type === 'harian' && E.isWorkday(G)) return t('Tidak dipanggil kerja', 'Not called in today');
    return t('Hari libur', 'Day off');
  };

  function badges(G) {
    const unpaid = E.billsThisMonth(G).filter((b) => b.status !== 'paid');
    const today = E.today(G);
    const expiring = G.food.batches.filter((b) => b.expiresAbs - today <= 0 && b.qty > 0 && !['oil', 'seasoning'].includes(b.type)).length;
    return {
      bills: unpaid.filter((b) => b.status === 'overdue' || b.dueDay <= G.date.day).length,
      report: G.phase === 'report' ? 1 : 0,
      appy: G.appy.applications.filter((a) => a.status === 'offer' || a.status === 'task').length,
      aku: G.distress.active ? 1 : 0,
      dapur: expiring,
      pinjam: E.activeLoans(G).filter((l) => l.status === 'late').length + (G.loanOffers.some((o) => o.lenderId === 'illegal' && o.expiresAbs >= today) ? 1 : 0),
      calendar: G.schedule.filter((s) => s.abs === today).length,
      workday: G.employment.status === 'notice' ? 1 : 0,
      jelajah: G.trips.filter((tr) => tr.status === 'booked' && !tr.arrivalDone && D.travel.destById[tr.destId].intl && D.travel.ENTRY[D.travel.destById[tr.destId].entry].arrival && tr.startAbs - today <= 3).length,
    };
  }

  U.homeView = () => {
    const G = U.G;
    const dim = E.daysInMonth(G.date.year, G.date.month);
    const unpaid = E.billsThisMonth(G).filter((b) => b.status !== 'paid');
    const due = unpaid.reduce((s, b) => s + b.amount, 0);
    const h = E.curHousing(G);
    const bd = badges(G);
    const tile = (id) => {
      const a = U.APPS[id];
      const b = bd[id] ? `<span class="badge">${bd[id]}</span>` : '';
      return `<button class="app-ico" data-a="open" data-x="${id}" aria-label="${T(a.name)}">${b}<span class="tile" style="background:${a.color}">${ic(a.icon)}</span><span class="nm">${T(a.short || a.name)}</span></button>`;
    };
    const ended = G.phase === 'report';
    const bannerOn = ui.banner && G.notifications.some((n) => n.id === ui.banner);
    const [wIcon, wLabel] = WEATHER[G.day.weather] || WEATHER.clear;
    const m = G.mood;
    const cond = E.cond(G);
    const pv = E.previewMeals(G);
    const mealsOk = 3 - pv.shortfall;
    const powerTxt = h.includes.electricity ? t('incl.', 'incl.') : G.config.electricity.meter === 'postpaid' ? t('tagihan', 'bill') : G.electricity.kwhBalance.toFixed(1);
    const dataTxt = E.hasWifi(G) ? 'Wi-Fi' : E.hasMobileData(G) ? (E.dayNumber(G.dataPlanUntil) - E.dayNumber(G.date)) + t('h', 'd') : t('tidak ada', 'none');
    let html = `<div class="home ${bannerOn ? 'has-banner' : ''}" data-scroll="home"><div class="widgets">
      <div class="w wide w-day">
        <div><div class="lbl">${esc(E.dateLabel(G.date))} · ${t('Bulan', 'Month')} ${G.monthIndex}</div><div class="d">${t('Hari', 'Day')} ${G.date.day}<span style="opacity:.6;font-size:22px">/${dim}</span></div>
        <div class="sub">${esc(U.dayStatus(G))} · ${ic(wIcon)} ${T(wLabel)} · ${t('Waktu luang', 'Free time')} ${E.freeSlots(G)}/${G.day.slots}</div></div>
        ${ended ? `<button class="btn-end" data-a="open" data-x="report">${ic('BarChart3')} ${t('Lihat laporan', 'See report')}</button>`
          : G.activeEvent ? `<button class="btn-end" data-a="event-open">${ic('AlertTriangle')} ${t('Putuskan', 'Decide')}</button>`
          : `<button class="btn-end" data-a="end-day">${ic('Moon')} ${t('Akhiri hari', 'End day')}</button>`}
      </div>
      <button class="w" data-a="open" data-x="bank"><span class="lbl">${t('Saldo', 'Balance')}</span><span class="big">${short(G.wallet)}</span><span class="sub">${t('Tabungan', 'Savings')} ${short(G.savings)}${E.debtOutstanding(G) ? ` · ${t('Utang', 'Debt')} ${short(E.debtOutstanding(G))}` : ''}</span></button>
      <button class="w" data-a="open" data-x="bills"><span class="lbl">${t('Sisa tagihan', 'Bills left')}</span><span class="big">${short(due)}</span><span class="sub">${unpaid.length} ${t('belum dibayar', 'unpaid')} · ${unpaid.filter((b) => b.status === 'overdue').length} ${t('lewat tempo', 'overdue')}</span></button>`;
    const moodCell = (l, v, bad) => `<button class="need ${(bad ? v > 65 : v < 35) ? 'bad' : ''}" data-a="open" data-x="aku"><b>${Math.round(v)}</b>${esc(l)}</button>`;
    html += `<div class="w wide"><span class="lbl">${t('Kondisimu hari ini', 'You today')}</span>
        <div class="needs">${moodCell(t('Sejahtera', 'Wellbeing'), m.wellbeing, false)}${moodCell(t('Energi', 'Energy'), m.energy, false)}${moodCell(t('Stres', 'Stress'), m.stress, true)}${moodCell(t('Bosan', 'Boredom'), m.boredom, true)}</div>
        <div class="needs">
          <button class="need ${mealsOk < 3 ? 'bad' : ''}" data-a="open" data-x="dapur">${ic('UtensilsCrossed')}<b>${mealsOk}/3</b>${t('makan', 'meals')}</button>
          <button class="need ${G.supplies.water < 1 ? 'bad' : ''}" data-a="open" data-x="dailymart" data-cat="snacks">${ic('Droplet')}<b>${Math.floor(G.supplies.water)}${t('h', 'd')}</b>${t('air', 'water')}</button>
          <button class="need ${!E.electricityOn(G) ? 'bad' : ''}" data-a="open" data-x="utility">${ic('Zap')}<b>${powerTxt}</b>${h.includes.electricity ? t('listrik', 'power') : 'kWh'}</button>
          <button class="need ${dataTxt === t('tidak ada', 'none') ? 'bad' : ''}" data-a="open" data-x="connect">${ic('Wifi')}<b>${dataTxt}</b>${t('internet', 'internet')}</button>
        </div>
        <span class="sub">${ic(cond === E.CONDITIONS.healthy ? 'Smile' : 'Thermometer')} ${T(cond.label)}${E.severityText(G) ? ` (${T(E.severityText(G))})` : ''} · ${t('Tidur', 'Sleep')} ${G.sleep.hours} ${t('jam', 'h')}${pv.shortfall ? ' · ' + t(`${pv.shortfall} waktu makan belum tercukupi`, `${pv.shortfall} meal(s) not covered`) : ''}${E.servings(G) > 1 ? ` · ${E.servings(G)} ${t('porsi/makan', 'portions/meal')}` : ''}</span>
        ${G.distress.active ? `<button class="btn sm sec" data-a="open" data-x="aku">${ic('HandHeart')} ${t('Hari-hari terasa berat. Lihat pilihan dukungan.', 'Things feel heavy. See support options.')}</button>` : ''}</div>
      </div>
      <div class="grid">${U.GRID.map(tile).join('')}</div>
      <div class="widgets">`;
    // urge card
    const u = G.urges.slice().sort((a, b) => b.intensity - a.intensity)[0];
    if (u) {
      const it = D.catalog.byId[u.itemId];
      html += `<div class="w wide urge"><span class="lbl">${ic('Sparkles')} ${t('Lagi pengin', 'You really want')}</span>
        <span class="t" style="font-weight:700;font-size:15px">${T(it.name)} · <span class="num">${fmt(E.priceNow(G, it))}</span></span><span class="sub">${T(u.reason)}</span>
        <div class="meter" aria-label="${t('Intensitas', 'Intensity')} ${u.intensity}"><i style="width:${u.intensity}%"></i></div>
        <div class="row" style="gap:6px"><button class="btn sm" data-a="urge-view" data-x="${u.id}">${t('Lihat', 'Look')}</button><button class="btn sm sec" data-a="urge-resist" data-x="${u.id}">${t('Tahan dulu', 'Hold off')}</button><button class="btn sm sec" data-a="urge-wish" data-x="${u.id}">${t('Simpan ke wishlist', 'Save for later')}</button></div>
        <span class="sub">${t('Tidak ada yang dibeli otomatis. Membeli bisa terasa menyenangkan sebentar; menahan juga sah.', 'Nothing is bought automatically. Buying may feel good for a while; holding off is fine too.')}</span></div>`;
    }
    // employment strip
    const emp = G.employment;
    const offer = G.appy.applications.find((a) => a.status === 'offer');
    if (emp.status === 'notice') html += `<button class="w wide warn" data-a="open" data-x="workday"><span class="lbl">${ic('AlertTriangle')} ${emp.resigning ? t('Mengundurkan diri', 'Resigning') : t('Masa pemberitahuan PHK', 'Termination notice')}</span><span class="sub">${t('Hari kerja terakhir', 'Last working day')}: ${esc(E.absLabel(emp.lastDayAbs, true))}${emp.severance && emp.severance.amount ? ` · ${t('perkiraan pesangon', 'estimated severance')} ${fmt(emp.severance.amount)}` : ''}</span></button>`;
    else if (!E.isEmployed(G)) html += `<button class="w wide" data-a="open" data-x="appy"><span class="lbl">${ic('Briefcase')} ${t('Sedang mencari kerja', 'Looking for work')}</span><span class="sub">${G.appy.listings.length} ${t('lowongan di Appy', 'listings in Appy')} · ${G.appy.applications.filter((a) => ['pending', 'scheduled', 'task'].includes(a.status)).length} ${t('lamaran berjalan', 'applications in progress')} · ${t('bisa bertahan ±', 'runway about ')}${Math.max(0, E.runwayDays(G))} ${t('hari', 'days')}</span></button>`;
    if (offer) html += `<button class="w wide" data-a="open" data-x="appy" data-tab="apps"><span class="lbl">${ic('BadgeCheck')} ${t('Tawaran kerja', 'Job offer')}</span><span class="sub">${T(offer.listing.title)} · ${fmt(offer.offer.wage)}${t('/bln', '/mo')} · ${t('balas sebelum', 'reply by')} ${esc(E.absLabel(offer.offer.expiresAbs))}</span></button>`;
    if (G.pendingJob) html += `<div class="w wide"><span class="lbl">${t('Pekerjaan baru', 'New job')}</span><span class="sub">${T(G.pendingJob.listing.title)} · ${t('mulai', 'starts')} ${esc(E.absLabel(G.pendingJob.startAbs, true))}</span></div>`;
    html += `</div></div>
      <div class="dock">${U.DOCK.map(tile).join('')}</div>`;
    return html;
  };

  // ── end of day ──────────────────────────────────────────────────────
  U.sheets.meals = (sh) => {
    const G = U.G;
    const pv = E.previewMeals(G);
    const o = E.mealOptions(G);
    const n = pv.shortfall;
    const slots = pv.plan.map((p) => `<div class="kv"><span>${T(E.SLOT_LABEL[p.slot])}</span><span>${p.how === 'none' ? `<b style="color:var(--coral)">${t('belum ada', 'nothing yet')}</b>` : T(p.label)}</span></div>`).join('');
    return `<h3>${t('Sebelum tidur', 'Before you sleep')}</h3><p class="evbody">${t(`${n} waktu makan hari ini belum tercukupi dari dapur. Apa yang kamu lakukan?`, `${n} of today's meals can't be covered from your kitchen. What do you do?`)}</p>
      <div class="receipt">${slots}</div>
      ${o.helper.available ? `<button class="choice" data-a="end-day-go" data-x="helper"><span>${t('Minta bantuan', 'Ask for help from')} ${T(o.helper.who)}<br><span class="small muted">${T(o.helper.recipe.name)}</span></span><b>Rp0</b></button>` : ''}
      ${o.warung.available ? `<button class="choice" data-a="end-day-go" data-x="warung"><span>${t('Beli di warung', 'Buy at a food stall')}<br><span class="small muted">${T(o.warung.item.name)} × ${o.servings}${o.warung.note ? ' · ' + T(o.warung.note) : ''}</span></span><b>${fmt(-o.warung.cost * n)}</b></button>` : ''}
      ${o.delivery.available ? `<button class="choice" data-a="end-day-go" data-x="delivery"><span>${t('Pesan antar', 'Order delivery')}<br><span class="small muted">${t('Termasuk ongkir & biaya layanan', 'Includes delivery and service fees')}</span></span><b>${fmt(-o.delivery.cost * n)}</b></button>` : ''}
      <button class="choice" data-a="end-day-go" data-x="skip"><span>${t('Lewati saja', 'Skip it')}<br><span class="small muted">${t('Energi dan suasana hati turun besok', 'Less energy and a lower mood tomorrow')}</span></span><b>Rp0</b></button>
      <button class="btn ghost" data-a="sheet-open-app" data-x="dapur">${t('Atur di Dapur dulu', 'Sort it in Dapur first')}</button>`;
  };
  function endDay(choice) {
    const G = U.G;
    const prev = U.prev();
    const r = E.advanceSimulationDay(G, { mealChoice: choice });
    ui.sheet = null;
    if (r.error === 'event_pending') { ui.eventOpen = true; return; }
    if (r.ended) { U.openApp('report'); U.toast(t('Bulan selesai.', 'Month complete.')); }
    else if (r.log && r.log.length) U.toast(r.log.map(L).join(' · '), true);
    else U.toast(`${t('Hari', 'Day')} ${G.date.day} · ${E.dateLabel(G.date)} · ${L((WEATHER[G.day.weather] || WEATHER.clear)[1])}`);
    if (G.activeEvent) ui.eventOpen = true;
    U.after(prev);
  }
  Object.assign(U.A, {
    'end-day'() {
      const G = U.G;
      if (G.phase === 'report') { U.openApp('report'); return; }
      if (G.activeEvent) { ui.eventOpen = true; return; }
      const pv = E.previewMeals(G);
      if (pv.shortfall > 0) { ui.sheet = { type: 'meals' }; return; }
      endDay('skip');
    },
    'end-day-go'(el) { endDay(el.dataset.x); },
    'sheet-open-app'(el) { ui.sheet = null; U.openApp(el.dataset.x); },
    'urge-view'(el) { const u = U.G.urges.find((x) => x.id === el.dataset.x); if (!u) return; const it = D.catalog.byId[u.itemId]; U.openApp(it.store); if (U.storeState) U.storeState(it.store).cat = it.dept; ui.sheet = { type: 'item', id: it.id, urge: u.id }; },
    'urge-resist'(el) { const r = E.resistUrge(U.G, el.dataset.x); if (ui.sheet && ui.sheet.urge) ui.sheet = null; U.toast(r.gone ? t('Keinginannya mereda.', 'The urge has passed.') : t('Kamu menahan diri. Keinginannya masih ada, tapi lebih lemah.', 'You held off. The urge is still there, but weaker.')); U.save(); },
    'urge-wish'(el) { E.postponeUrge(U.G, el.dataset.x); if (ui.sheet && ui.sheet.urge) ui.sheet = null; U.toast(t('Disimpan ke wishlist. Tidak ada uang yang keluar.', 'Saved to your wishlist. No money spent.')); U.save(); },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
