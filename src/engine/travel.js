/*
 * engine/travel.js — administrative documents, passports, visas, trips.
 *
 * Visa outcomes contain GAMEPLAY uncertainty (requests for more documents,
 * refusals tied to the game's own financial-evidence rule). These are not
 * official refusal rates. Fees cite their sources in data/travel.js.
 */
(function (root) {
  const RLS = root.RLS;
  const E = RLS.engine;
  const M = RLS.money;
  const { rp } = M;
  const { bi, L } = RLS.i18n;
  const D = () => RLS.data;
  const T = () => D().travel;
  const { clamp } = E;

  function initTravel(state) {
    state.docs = { items: {}, passport: null };
    const p = state.config.passport;
    if (p && p.has) {
      const type = T().PASSPORT_TYPES.find((x) => x.id === p.type) || T().PASSPORT_TYPES[0];
      state.docs.passport = { status: p.yearsLeft > 0 ? 'ready' : 'expired', type: type.id, electronic: type.electronic, expiresAbs: state.startAbs + Math.round(p.yearsLeft * 365), readyAbs: state.startAbs };
    }
    state.trips = [];
    state.trip = null;
  }
  E._inits.push(initTravel);

  const feeIdr = (fee) => (typeof fee === 'object' ? rp(fee.amount * T().FX[fee.cur]) : rp(fee));
  function passportValid(state, untilAbs = E.today(state)) {
    const p = state.docs.passport;
    return !!(p && p.status === 'ready' && p.expiresAbs >= untilAbs);
  }
  /** Status of a document or pseudo-requirement. */
  function docStatus(state, id) {
    const today = E.today(state);
    const ch = state.config.character;
    switch (id) {
      case 'jkn': return { valid: E.hasJkn(state), label: bi('BPJS Kesehatan aktif', 'Active BPJS Kesehatan') };
      case 'employed': return { valid: E.isEmployed(state), label: bi('Sedang bekerja', 'Currently employed') };
      case 'age17': return { valid: ch.age >= 17, label: bi('Usia minimal 17', 'Aged 17 or over') };
      case 'epassport': return { valid: passportValid(state) && state.docs.passport.electronic, label: bi('E-paspor yang masih berlaku', 'A valid e-passport') };
      case 'passport_valid': return { valid: passportValid(state, today + 183), label: bi('Paspor berlaku > 6 bulan', 'Passport valid for 6+ months') };
      case 'employment_or_funds': {
        const funds = state.wallet + state.savings;
        const ok = (E.isEmployed(state) && docStatus(state, 'employment_letter').valid) || funds >= rp(25000000);
        return { valid: ok, label: bi('Surat keterangan kerja, atau dana ≥ Rp25 juta (aturan game)', 'Employment letter, or funds ≥ Rp25 million (game rule)') };
      }
      case 'passport': {
        const p = state.docs.passport;
        if (!p) return { valid: false, status: 'none' };
        if (p.status === 'processing' || p.status === 'appointment') return { valid: false, status: p.status, readyAbs: p.readyAbs, appointmentAbs: p.appointmentAbs };
        return { valid: p.expiresAbs >= today, status: p.expiresAbs >= today ? 'ready' : 'expired', expiresAbs: p.expiresAbs };
      }
    }
    const d = T().docById[id];
    if (!d) return { valid: false, status: 'unknown' };
    if (d.held) return { valid: true, status: 'held' };
    if (d.heldIfEdu != null) return E.eduRank(ch.education) >= d.heldIfEdu ? { valid: true, status: 'held' } : { valid: false, status: 'na' };
    if (id === 'portfolio') return { valid: state.appy.portfolio >= 25, status: state.appy.portfolio >= 25 ? 'ready' : 'none', progress: state.appy.portfolio };
    const it = state.docs.items[id];
    if (!it) return { valid: false, status: 'none' };
    if (it.status === 'processing') return { valid: false, status: 'processing', readyAbs: it.readyAbs };
    if (it.status === 'failed' || it.status === 'rejected') return { valid: false, status: it.status };
    if (it.expiresAbs != null && it.expiresAbs < today) return { valid: false, status: 'expired', expiresAbs: it.expiresAbs };
    return { valid: true, status: 'ready', expiresAbs: it.expiresAbs, score: it.score };
  }
  function docCost(state, id) {
    const d = T().docById[id];
    return feeIdr(d.fee) + (d.extra || []).reduce((s, x) => s + rp(x[1]), 0);
  }
  function docPrereqs(state, id) {
    const d = T().docById[id];
    return (d.needs || []).map((n) => ({ id: n, label: T().docById[n] ? T().docById[n].name : docStatus(state, n).label, ...docStatus(state, n) }));
  }
  function applyDoc(state, id) {
    const d = T().docById[id];
    if (!d || d.held || d.auto || d.built || d.special) return { ok: false, error: 'invalid' };
    const cur = docStatus(state, id);
    if (cur.status === 'processing') return { ok: false, error: 'processing' };
    const missing = docPrereqs(state, id).filter((x) => !x.valid);
    if (missing.length) return { ok: false, error: 'missing_prereq', missing };
    if (d.inPerson) {
      if (E.isScheduledToWork(state) && !state.day.leave) return { ok: false, error: 'needs_leave' };
      if (!E.useSlots(state, 1)) return { ok: false, error: 'no_time' };
    } else if (!E.isOnline(state) && !d.arrival && id !== 'pas_foto') return { ok: false, error: 'offline' };
    const cost = docCost(state, id);
    if (cost > 0) {
      const res = E.chargeOrFail(state, { merchant: d.name, category: d.visa ? 'travel' : 'docs', cls: d.visa ? 'discretionary' : 'essential', amount: cost, note: d.status === 'VERIFIED' ? bi('Tarif resmi', 'Official fee') : bi('Biaya perkiraan', 'Estimated cost') });
      if (!res.ok) { if (d.inPerson) state.day.used--; return res; }
    }
    const r = E.rng(state, 'doc', id);
    const days = E.rint(r, d.days[0], d.days[1]);
    const readyAbs = d.wd ? E.addWorkdays(5, E.today(state), days) : E.today(state) + days;
    const it = { status: 'processing', appliedAbs: E.today(state), readyAbs, expiresAbs: d.valid ? readyAbs + d.valid : null };
    if (d.test && id === 'sim_c') { const pass = r() < (state.config.character.skills.includes('driving') ? 0.85 : 0.45); if (!pass) { it.status = 'failed'; state.docs.items[id] = it; E.applyMood(state, { frustration: 6 }); return { ok: true, failed: true }; } }
    if (id === 'toefl') { const band = [[310, 380], [380, 450], [450, 530], [530, 620]][E.engRank(state.config.character.english)]; it.score = E.rint(r, band[0], band[1]); }
    if (d.visa) it.visa = visaOutcome(state, id, r);
    if (days === 0 && !d.visa) { it.status = 'ready'; it.readyAbs = E.today(state); if (d.valid) it.expiresAbs = E.today(state) + d.valid; }
    state.docs.items[id] = it;
    return { ok: true, readyAbs: it.readyAbs, status: it.status };
  }
  function visaOutcome(state, id, r) {
    const funds = state.wallet + state.savings;
    const weak = funds < rp(id === 'visa_au' || id === 'visa_uk' ? 30000000 : 15000000);
    const unemployed = !E.isEmployed(state);
    const more = r() < 0.15;
    const refuse = r() < 0.04 + (weak ? 0.3 : 0) + (unemployed ? 0.15 : 0);
    return { more, refuse, weak, unemployed };
  }
  function processDocs(state) {
    const today = E.today(state);
    for (const [id, it] of Object.entries(state.docs.items)) {
      if (it.status !== 'processing' || it.readyAbs > today) continue;
      const d = T().docById[id];
      if (it.visa && it.visa.more) { it.visa.more = false; it.readyAbs = E.addWorkdays(5, today, 5); E.notify(state, 'berkas', bi('Kedutaan minta dokumen tambahan', 'The embassy asked for more documents'), bi(`${d.name.id}: proses diperpanjang ±5 hari kerja (skenario game).`, `${d.name.en}: processing extended by about 5 working days (game scenario).`), 'warn'); continue; }
      if (it.visa && it.visa.refuse) { it.status = 'rejected'; E.notify(state, 'berkas', bi('Visa ditolak', 'Visa refused'), bi(`${d.name.id} ditolak. Biaya tidak dikembalikan. ${it.visa.weak ? 'Bukti keuangan dinilai kurang (aturan game).' : ''} Hasil ini adalah ketidakpastian dalam game, bukan statistik resmi.`, `${d.name.en} was refused. The fee is not refunded. ${it.visa.weak ? 'Financial evidence was judged weak (game rule).' : ''} This outcome is in-game uncertainty, not an official statistic.`), 'warn'); E.applyMood(state, { frustration: 10, happiness: -6 }); continue; }
      it.status = 'ready';
      if (d.valid) it.expiresAbs = today + d.valid;
      E.notify(state, 'berkas', bi('Dokumen siap', 'Document ready'), bi(`${d.name.id} sudah selesai${it.score ? ' (skor ' + it.score + ')' : ''}.`, `${d.name.en} is ready${it.score ? ' (score ' + it.score + ')' : ''}.`), 'info');
    }
    const p = state.docs.passport;
    if (p && p.status === 'processing' && p.readyAbs <= today) { p.status = 'ready'; p.expiresAbs = today + p.years * 365; E.notify(state, 'berkas', bi('Paspor jadi', 'Passport ready'), bi(`Berlaku sampai ${E.absLabel(p.expiresAbs, true)}.`, `Valid until ${E.absLabel(p.expiresAbs, true)}.`), 'info'); }
  }
  Object.assign(E, { docStatus, docCost, docPrereqs, applyDoc, processDocs, passportValid, feeIdr });

  // ── passport ────────────────────────────────────────────────────────
  function passportOptions(state) {
    const ch = state.config.character;
    const can10 = ch.age >= 17 || state.config.household.partner;
    return T().PASSPORT_TYPES.map((t) => ({ ...t, available: t.years === 5 || can10, reason: t.years === 10 && !can10 ? bi('Paspor 10 tahun untuk usia 17+ atau sudah menikah', '10-year passports are for ages 17+ or married applicants') : null }));
  }
  function applyPassport(state, typeId, express = false) {
    const t = passportOptions(state).find((x) => x.id === typeId);
    if (!t || !t.available) return { ok: false, error: 'invalid' };
    const p = state.docs.passport;
    if (p && (p.status === 'processing' || p.status === 'appointment')) return { ok: false, error: 'processing' };
    if (!E.isOnline(state)) return { ok: false, error: 'offline' };
    const fee = rp(t.fee) + (express ? rp(T().PASSPORT_EXPRESS) : 0);
    const res = E.chargeOrFail(state, { merchant: bi('Imigrasi — paspor', 'Immigration — passport'), category: 'docs', cls: 'essential', amount: fee, note: bi(`${t.name.id}${express ? ' + layanan percepatan' : ''} (PNBP)`, `${t.name.en}${express ? ' + same-day service' : ''} (official fee)`) });
    if (!res.ok) return res;
    const r = E.rng(state, 'passport');
    let appt = E.today(state) + E.rint(r, 3, 10);
    while (!E.isWorkdayDate(5, E.fromDayNumber(appt))) appt++;
    state.docs.passport = { status: 'appointment', type: t.id, electronic: t.electronic, years: t.years, express, appointmentAbs: appt, previous: p && p.status === 'ready' ? p : null };
    state.schedule.push({ id: 's' + state.seq++, abs: appt, type: 'passport', label: bi('Wawancara & foto paspor di kantor imigrasi', 'Passport interview & photo at the immigration office') });
    return { ok: true, appointmentAbs: appt };
  }
  function attendPassport(state) {
    const p = state.docs.passport;
    if (!p || p.status !== 'appointment' || p.appointmentAbs !== E.today(state)) return;
    if (state.trip && state.trip.active) { p.appointmentAbs = E.today(state) + 7; return; }
    if (E.isScheduledToWork(state) && !state.day.leave) { const lv = E.takeLeave(state, 'passport'); E.notify(state, 'workday', bi('Izin ke kantor imigrasi', 'Time off for the immigration office'), lv.paid ? bi('Memakai 1 hari cuti.', 'Used 1 day of annual leave.') : bi('Izin tanpa upah.', 'Unpaid leave.'), 'info'); }
    E.useSlots(state, 1);
    E.chargeOrFail(state, { merchant: bi('Ongkos ke kantor imigrasi', 'Travel to the immigration office'), category: 'docs', cls: 'essential', amount: E.localFare(state) * 2, quiet: true });
    p.status = 'processing';
    p.readyAbs = p.express ? E.today(state) : E.addWorkdays(5, E.today(state), 4);
    if (p.express) processDocs(state);
  }
  Object.assign(E, { passportOptions, applyPassport, attendPassport });

  // ── trips ───────────────────────────────────────────────────────────
  function originZone(state) { return T().ZONE[state.config.provinceId] || 'J'; }
  function tripQuote(state, destId, style, nights, opts = {}) {
    const d = T().destById[destId];
    const si = { budget: 0, standard: 1, comfort: 2 }[style];
    const mem = E.members(state);
    const travellers = mem.adults + mem.kids * 0.75;
    const rooms = Math.max(1, Math.ceil(mem.people / 2.5));
    const z = originZone(state);
    let transport, mode;
    if (d.intl) { transport = (d.fly[si] + T().INTL_EXTRA[z]) * travellers; mode = 'fly'; }
    else {
      const sameIsland = d.zone === z && d.land && d.land[si] > 0;
      if (sameIsland && !opts.fly) { transport = d.land[si] * travellers; mode = 'land'; }
      else { transport = d.fly[si] * T().ZONE_MULT[z][d.zone] * travellers; mode = 'fly'; }
    }
    const days = nights + 1;
    const lines = [
      [bi(mode === 'land' ? 'Kereta/bus pulang-pergi' : 'Tiket pesawat pulang-pergi', mode === 'land' ? 'Return train/bus' : 'Return flights'), Math.round(transport)],
      [bi(`Penginapan ${nights} malam × ${rooms} kamar`, `Accommodation, ${nights} nights × ${rooms} room(s)`), d.stay[si] * nights * rooms],
      [bi(`Makan ${days} hari`, `Food, ${days} days`), Math.round(d.food[si] * days * mem.portions)],
      [bi(`Transport lokal ${days} hari`, `Local transport, ${days} days`), d.local[si] * days],
    ];
    const att = (opts.attractions || []).map((id) => d.attractions.find((a) => a[0] === id)).filter(Boolean);
    for (const a of att) if (a[2]) lines.push([a[1], a[2] * Math.ceil(travellers)]);
    const ins = opts.insurance ? (d.intl ? (['au', 'uk'].includes(d.entry) ? 500000 : 250000) : 50000) * Math.ceil(travellers) : 0;
    if (ins) lines.push([bi('Asuransi perjalanan', 'Travel insurance'), ins]);
    if (opts.extra) lines.push([bi('Belanja & oleh-oleh (rencana)', 'Shopping & souvenirs (planned)'), opts.extra]);
    const total = lines.reduce((s, l) => s + rp(l[1]), 0);
    return { dest: d, style, nights, mode, lines: lines.map(([label, v]) => ({ label, amount: rp(v) })), total, travellers, status: 'ILLUSTRATIVE' };
  }
  function tripRequirements(state, destId, startAbs, nights, opts = {}) {
    const d = T().destById[destId];
    const endAbs = startAbs + nights;
    const q = tripQuote(state, destId, opts.style || 'standard', nights, opts);
    const reqs = [];
    const today = E.today(state);
    reqs.push({ key: 'date', ok: startAbs > today, label: bi('Berangkat paling cepat besok', 'Departure from tomorrow at the earliest') });
    reqs.push({ key: 'money', ok: state.wallet >= q.total, label: bi(`Saldo cukup (${M.format(q.total)}); tabungan bisa ditarik dulu di FutureMe`, `Enough balance (${M.format(q.total)}); you can withdraw savings in FutureMe first`), fix: 'futureme' });
    if (nights < d.minNights) reqs.push({ key: 'nights', ok: false, label: bi(`Minimal ${d.minNights} malam untuk tujuan ini`, `At least ${d.minNights} nights for this destination`) });
    if (d.intl) {
      const entry = T().ENTRY[d.entry];
      reqs.push({ key: 'passport', ok: passportValid(state, endAbs + 183), label: bi('Paspor berlaku minimal 6 bulan setelah pulang', 'Passport valid 6+ months after you return'), fix: 'passport' });
      if (entry.type === 'visa_free') reqs.push({ key: 'entry', ok: nights + 1 <= entry.days, label: bi(`${entry.label.id}`, `${entry.label.en}`), info: true });
      if (entry.type === 'waiver_or_visa') {
        const e = state.docs.passport && state.docs.passport.electronic;
        const doc = e ? entry.waiverDoc : entry.visaDoc;
        const st = docStatus(state, doc);
        reqs.push({ key: 'entry', ok: st.valid && (!st.expiresAbs || st.expiresAbs >= endAbs) && (!e || nights + 1 <= entry.days), label: e ? bi('Registrasi JAVES (bebas visa, maks 15 hari)', 'JAVES registration (visa waiver, max 15 days)') : bi('Visa Jepang (paspor biasa)', 'Japanese visa (ordinary passport)'), fix: 'doc', doc });
      }
      if (entry.type === 'visa') { const st = docStatus(state, entry.visaDoc); reqs.push({ key: 'entry', ok: st.valid && (!st.expiresAbs || st.expiresAbs >= endAbs), label: T().docById[entry.visaDoc].name, fix: 'doc', doc: entry.visaDoc, state: st }); }
      if (entry.arrival) reqs.push({ key: 'arrival', ok: true, later: true, label: bi(`${T().docById[entry.arrival].name.id}: isi online 3 hari sebelum tiba (gratis)`, `${T().docById[entry.arrival].name.en}: fill in online within 3 days before arrival (free)`), doc: entry.arrival });
      if (d.plug) reqs.push({ key: 'adapter', ok: !!state.owned.items.adapter, label: bi('Adaptor colokan (disarankan)', 'Plug adapter (recommended)'), optional: true });
      if (d.insuranceRec) reqs.push({ key: 'insurance', ok: !!opts.insurance, label: bi('Asuransi perjalanan (sangat disarankan)', 'Travel insurance (strongly recommended)'), optional: true });
    }
    // time off
    const wd = E.isEmployed(state) && state.job ? E.workdaysBetween(state.config.workweek, startAbs, endAbs) : 0;
    const paid = Math.min(wd, state.employment.leaveBalance || 0);
    if (wd > 0) reqs.push({ key: 'leave', ok: paid === wd || !!opts.unpaidOk, label: paid === wd ? bi(`Butuh ${wd} hari cuti (sisa cuti ${state.employment.leaveBalance})`, `Needs ${wd} leave day(s) (you have ${state.employment.leaveBalance})`) : bi(`${wd} hari kerja; cuti tersisa ${paid}. Sisanya izin tanpa upah (−${M.format(E.dailyRate(state) * (wd - paid))})`, `${wd} workday(s); ${paid} paid leave left. The rest would be unpaid (−${M.format(E.dailyRate(state) * (wd - paid))})`), fix: 'unpaid', unpaidDays: wd - paid });
    const clash = state.schedule.filter((s) => s.abs >= startAbs && s.abs <= endAbs && s.type !== 'trip');
    if (clash.length) reqs.push({ key: 'clash', ok: false, label: bi(`Bentrok dengan jadwal: ${clash.map((c) => c.label.id).join(', ')}`, `Clashes with: ${clash.map((c) => c.label.en).join(', ')}`) });
    return { quote: q, reqs, ok: reqs.every((r) => r.ok || r.optional || r.info) , endAbs, workdays: wd, paidLeave: paid };
  }
  function bookTrip(state, destId, style, startAbs, nights, opts = {}) {
    const check = tripRequirements(state, destId, startAbs, nights, { ...opts, style });
    if (!check.ok) return { ok: false, error: 'requirements', reqs: check.reqs.filter((r) => !r.ok && !r.optional && !r.info) };
    const q = check.quote;
    const res = E.chargeOrFail(state, { merchant: bi(`Perjalanan ke ${q.dest.name.id}`, `Trip to ${q.dest.name.en}`), category: 'travel', cls: 'discretionary', amount: q.total, items: q.lines.map((l) => ({ id: 'trip', name: l.label, qty: 1, unit: l.amount })) });
    if (!res.ok) return res;
    const trip = { id: 'T' + state.seq++, destId, style, nights, startAbs, endAbs: check.endAbs, total: q.total, status: 'booked', arrivalDone: false, unpaidOk: !!opts.unpaidOk, lines: q.lines };
    state.trips.unshift(trip);
    state.schedule.push({ id: 's' + state.seq++, abs: startAbs, type: 'trip', tripId: trip.id, label: bi(`Berangkat ke ${q.dest.name.id}`, `Leave for ${q.dest.name.en}`) });
    E.applyMood(state, { happiness: 6, boredom: -6, motivation: 4 });
    return { ok: true, trip };
  }
  function fillArrivalCard(state, tripId) {
    const trip = state.trips.find((t) => t.id === tripId);
    if (!trip || !E.isOnline(state)) return { ok: false, error: 'offline' };
    if (trip.startAbs - E.today(state) > 3) return { ok: false, error: 'too_early' };
    trip.arrivalDone = true;
    return { ok: true };
  }
  /** Morning check for trips: depart, continue, or return. */
  function tripDay(state) {
    const today = E.today(state);
    if (state.trip && state.trip.active) {
      const trip = state.trips.find((t) => t.id === state.trip.tripId);
      if (today > trip.endAbs) {
        state.trip = null; trip.status = 'done';
        E.applyMood(state, { energy: -15, happiness: 6, boredom: -10 });
        E.notify(state, 'jelajah', bi('Sudah pulang', 'Back home'), bi(`Perjalanan ke ${T().destById[trip.destId].name.id} selesai. Cek dapur: makanan segar mungkin basi selama kamu pergi.`, `Your trip to ${T().destById[trip.destId].name.en} is over. Check the kitchen: fresh food may have spoiled while you were away.`), 'info');
      } else {
        if (E.isEmployed(state) && E.isWorkday(state)) E.takeLeaveForTrip(state, trip);
        E.applyMood(state, { happiness: 7, boredom: -12, stress: -7, social: E.members(state).people > 1 ? 5 : 2, energy: -3, loneliness: -4 });
      }
      return;
    }
    for (const trip of state.trips.filter((t) => t.status === 'booked' && t.startAbs === today)) {
      const d = T().destById[trip.destId];
      const problems = [];
      if (d.intl) {
        const entry = T().ENTRY[d.entry];
        if (!passportValid(state, trip.endAbs + 183)) problems.push(bi('paspor tidak memenuhi syarat', 'passport not valid long enough'));
        if (entry.type !== 'visa_free') {
          const doc = entry.type === 'waiver_or_visa' && state.docs.passport && state.docs.passport.electronic ? entry.waiverDoc : entry.visaDoc;
          if (!docStatus(state, doc).valid) problems.push(bi('visa/izin masuk belum ada', 'visa or entry authorisation missing'));
        }
        if (entry.arrival && !trip.arrivalDone) { if (E.isOnline(state)) trip.arrivalDone = true; else problems.push(bi('kartu kedatangan belum diisi (butuh internet)', 'arrival card not filled in (needs internet)')); }
      }
      if (problems.length) {
        trip.status = 'cancelled';
        const refund = Math.round(trip.lines.slice(1, 2).reduce((s, l) => s + l.amount, 0) * 0.5);
        if (refund) E.credit(state, { merchant: bi('Pengembalian sebagian (penginapan)', 'Partial refund (accommodation)'), category: 'refund', cls: 'refund', amount: refund, split: { discretionary: refund } });
        E.notify(state, 'jelajah', bi('Perjalanan batal', 'Trip cancelled'), bi(`Tidak bisa berangkat: ${problems.map((p) => p.id).join(', ')}. Tiket hangus; sebagian biaya penginapan kembali ${M.format(refund)}.`, `You could not depart: ${problems.map((p) => p.en).join(', ')}. Tickets are lost; ${M.format(refund)} of the accommodation came back.`), 'warn');
        E.applyMood(state, { frustration: 15, happiness: -10 });
        continue;
      }
      trip.status = 'active';
      state.trip = { active: true, tripId: trip.id };
      if (E.isEmployed(state) && E.isWorkday(state)) E.takeLeaveForTrip(state, trip);
      E.notify(state, 'jelajah', bi('Berangkat!', 'You\'re off!'), bi(`Selamat jalan ke ${d.name.id}.`, `Have a good trip to ${d.name.en}.`), 'info');
      E.applyMood(state, { happiness: 10, boredom: -15, stress: -8 });
    }
  }
  E.takeLeaveForTrip = (state, trip) => {
    const emp = state.employment;
    let paid = false;
    if (emp.leaveBalance > 0) { emp.leaveBalance--; paid = true; } else if (state.job && state.job.type !== 'harian') emp.unpaidLeave++;
    state.day.leave = { reason: 'trip', paid };
  };
  function tripMeals(state) {
    // meals are covered by the trip's food budget
    const n = RLS.data.food.INGREDIENTS.meal.nut;
    for (const slot of E.SLOTS) if (!state.food.meals[slot]) state.food.meals[slot] = { how: 'trip', label: bi('Makan di perjalanan', 'Eating while travelling'), nut: { ...n, fv: 1.2, vitC: 0.5, vitA: 0.4 }, proteinTypes: ['meal', 'trip'], vegTypes: ['veg_other', 'fruit'] };
  }
  Object.assign(E, { tripQuote, tripRequirements, bookTrip, fillArrivalCard, tripDay, tripMeals, originZone });

  /** Every document the player currently needs, with where it is needed. */
  function missingDocs(state) {
    const out = {};
    const add = (doc, why) => { if (!docStatus(state, doc).valid) (out[doc] = out[doc] || []).push(why); };
    for (const a of state.appy.applications.filter((x) => ['pending', 'scheduled', 'task'].includes(x.status))) a.listing.docs.forEach((d) => add(d, a.listing.title));
    for (const id of state.appy.saved || []) { const l = state.appy.listings.find((x) => x.id === id); if (l) l.docs.forEach((d) => add(d, l.title)); }
    for (const t of state.trips.filter((x) => x.status === 'booked')) {
      const d = T().destById[t.destId];
      if (!d.intl) continue;
      const entry = T().ENTRY[d.entry];
      add('passport', d.name);
      if (entry.type === 'visa') add(entry.visaDoc, d.name);
      if (entry.type === 'waiver_or_visa') add(state.docs.passport && state.docs.passport.electronic ? entry.waiverDoc : entry.visaDoc, d.name);
    }
    if (state.benefits.jhtClaimableAbs && !state.benefits.jhtClaimed) add('paklaring', bi('Klaim JHT', 'JHT claim'));
    return out;
  }
  E.missingDocs = missingDocs;
})(typeof globalThis !== 'undefined' ? globalThis : this);
