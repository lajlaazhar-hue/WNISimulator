/*
 * engine/work.js — employment, payday, leave, sick days, performance,
 * warning letters, layoffs and contract ends, severance, JHT and JKP,
 * the Appy job market, applications, interviews, offers, gigs, and
 * self-improvement (CV, portfolio, courses, English practice).
 *
 * Employers and listings are FICTIONAL. Legal amounts follow the game's
 * reading of Indonesian rules (source `labour_rules`, `jkp_2025`) and are
 * simplified; real entitlements depend on the contract and the reason.
 */
(function (root) {
  const RLS = root.RLS;
  const E = RLS.engine;
  const M = RLS.money;
  const { rp } = M;
  const { bi, L } = RLS.i18n;
  const D = () => RLS.data;
  const { clamp } = E;
  const J = () => D().jobs;

  // ── setup ───────────────────────────────────────────────────────────
  function eduRank(id) { return (J().eduById[id] || { rank: 0 }).rank; }
  const engRank = (id) => (J().engById[id] || { rank: 0 }).rank;
  const digRank = (id) => (J().digById[id] || { rank: 1 }).rank;
  function startingJobsFor(character) { return J().STARTING_JOBS.filter((j) => eduRank(character.education) >= j.minEdu && character.age >= 18); }

  function makeJob(state, tpl, extra = {}) {
    const wage = E.resolveWage(state.config.cityId).amount;
    return {
      id: tpl.id, title: tpl.title, company: extra.company || bi('PT Contoh Usaha (fiktif)', 'PT Contoh Usaha (fictional)'), kind: tpl.kind, type: tpl.type, termMonths: tpl.termMonths,
      uniform: !!tpl.uniform, sector: tpl.sector, koperasi: !!tpl.koperasi, wage: extra.wage || wage, distanceKm: extra.distanceKm || state.config.distanceKm,
      stability: extra.stability ?? 0.65, arrangement: extra.arrangement || 'onsite', skills: extra.skills || [], startAbs: extra.startAbs ?? E.today(state),
      endAbs: tpl.type === 'pkwt' || tpl.type === 'magang' ? (extra.startAbs ?? E.today(state)) + Math.round((extra.termMonths || tpl.termMonths || 12) * 30.4) : null,
      fromListing: extra.fromListing || null, reducedHours: null,
    };
  }
  function initWork(state) {
    const c = state.config;
    state.economy = 1;
    state.perf = { days: [], avg: 65, weeks: [], badWeeks: 0, goodWeeks: 0 };
    state.benefits = { jht: c.scenario === 'formal' ? Math.round(E.resolveWage(c.cityId).amount * 0.057 * c.tenureMonths) : 0, jhtClaimableAbs: null, jhtClaimed: false, jkp: { eligible: false, applied: false, paid: 0, lastAbs: null, wage: 0 }, jknUntilAbs: null };
    state.appy = { listings: [], applications: [], cv: 45 + Math.min(25, c.character.experienceYears * 4), portfolio: ['design', 'copywriting', 'socialmedia'].some((s) => c.character.skills.includes(s)) ? 30 : 0, gigs: [], lastRefresh: null, englishPractice: 0 };
    state.schedule = [];
    const tpl = J().STARTING_JOBS.find((j) => j.id === c.startJobId);
    if (c.startEmployed && tpl && eduRank(c.character.education) >= tpl.minEdu) {
      const r = E.mulberry32(E.hashSeed(state.seed, 'job'));
      state.job = makeJob(state, tpl, { company: companyName(r), stability: 0.5 + r() * 0.35, startAbs: state.startAbs - Math.round(c.tenureMonths * 30.4) });
      if (state.job.endAbs && state.job.endAbs <= state.startAbs + 14) state.job.endAbs = state.startAbs + 30 + Math.round(r() * 120);
      state.employment = { status: 'employed', since: state.job.startAbs, lastDayAbs: null, reason: null, sp: 0, spAbs: null, leaveBalance: c.tenureMonths >= 12 ? 12 : 0, unpaidLeave: 0, contributionMonths: c.scenario === 'formal' ? c.tenureMonths : 0, monthsWorked: 0, history: [] };
    } else {
      state.job = null;
      state.employment = { status: 'unemployed', since: state.startAbs, lastDayAbs: null, reason: 'start', sp: 0, leaveBalance: 0, unpaidLeave: 0, contributionMonths: 0, monthsWorked: 0, history: [] };
    }
    if (!c.commutePlanId) {
      const wd = E.workdaysInMonth(c.startYear, c.startMonth, c.workweek);
      c.commutePlanId = E.commutePresets(E.commutePlans(c.cityId, c.distanceKm, c), wd).cheapest || null;
    }
  }
  E._inits.push(initWork);
  function companyName(r) {
    const C = J().COMPANY;
    const n = `PT ${E.pick(r, C.pre)} ${E.pick(r, C.mid)} ${E.pick(r, C.end)}`;
    return bi(`${n} (fiktif)`, `${n} (fictional)`);
  }

  const isEmployed = (state) => state.employment.status === 'employed' || state.employment.status === 'notice';
  const hasJknViaWork = (state) => state.config.scenario === 'formal' && (isEmployed(state) || (state.benefits.jknUntilAbs && E.today(state) <= state.benefits.jknUntilAbs));
  const hasJkn = (state) => hasJknViaWork(state) || state.config.jknMandiri;
  function isScheduledToWork(state) {
    if (!isEmployed(state) || !state.job) return false;
    if (state.trip && state.trip.active) return false;
    if (!E.isWorkday(state)) return false;
    if (state.job.arrangement === 'remote') return true;
    if (state.job.type === 'harian') return E.rng(state, 'called')() < 0.82;
    return true;
  }
  Object.assign(E, { eduRank, engRank, digRank, startingJobsFor, isEmployed, hasJknViaWork, hasJkn, isScheduledToWork, makeJob });

  // ── payday ──────────────────────────────────────────────────────────
  function dailyRate(state) { return Math.round(state.job.wage / (state.config.workweek === 6 ? 25 : 21)); }
  function payday(state) {
    const c = state.config, emp = state.employment;
    const lines = [];
    if (isEmployed(state) && state.job && state.job.type !== 'harian') {
      let gross = state.job.wage;
      if (state.job.reducedHours && state.job.reducedHours.months > 0) { gross = Math.round(gross * (1 - state.job.reducedHours.pct)); lines.push(bi(`Pengurangan jam kerja ${Math.round(state.job.reducedHours.pct * 100)}%`, `Reduced hours ${Math.round(state.job.reducedHours.pct * 100)}%`)); state.job.reducedHours.months--; if (!state.job.reducedHours.months) state.job.reducedHours = null; }
      const pay = E.calculateNetIncome(gross, c.scenario);
      let amount = c.wageTreatment === 'gross' ? pay.gross : pay.net;
      if (emp.unpaidLeave > 0) { const cut = Math.min(amount, dailyRate(state) * emp.unpaidLeave); amount -= cut; lines.push(bi(`Potongan ${emp.unpaidLeave} hari izin tanpa upah: ${M.format(cut)}`, `${emp.unpaidLeave} unpaid leave day(s): −${M.format(cut)}`)); emp.unpaidLeave = 0; }
      E.credit(state, { merchant: state.job.company, category: 'salary', cls: 'income', amount,
        note: [c.wageTreatment === 'gross' ? bi('Upah bruto (potongan tidak dihitung)', 'Gross wage (deductions not modelled)') : bi(`Bersih setelah potongan ${M.format(pay.totalDeductions)}`, `Net after ${M.format(pay.totalDeductions)} deductions`), ...lines] });
      E.notify(state, 'bank', bi('Gajian', 'Payday'), bi(`Gajimu sudah masuk. ${M.format(amount, { plus: true })}`, `Your salary has arrived. ${M.format(amount, { plus: true })}`), 'pay');
      if (c.scenario === 'formal') { state.benefits.jht += Math.round(gross * 0.057); emp.contributionMonths++; }
      emp.monthsWorked++;
      if (emp.monthsWorked % 12 === 0) { c.character.experienceYears++; emp.leaveBalance = 12; E.notify(state, 'workday', bi('Setahun bekerja', 'A year on the job'), bi('Kamu berhak atas 12 hari cuti tahunan dan pengalaman kerjamu bertambah.', 'You are entitled to 12 days of annual leave, and your experience grows.'), 'info'); }
      E.applyMood(state, { happiness: 8, anxiety: -15, motivation: 3 });
    } else if (!isEmployed(state)) {
      E.notify(state, 'bank', bi('Tanggal 1, tanpa gaji', 'The 1st, no salary'), bi('Kamu sedang tidak bekerja. Cek Appy untuk lowongan dan kerja harian.', 'You are not working right now. Check Appy for vacancies and day gigs.'), 'warn');
      E.applyMood(state, { anxiety: 6 });
    }
    // household income
    const hh = c.household;
    if (hh.partner && hh.partnerWorks && hh.partnerIncome > 0) {
      const amt = hh.sharedIncome ? hh.partnerIncome : Math.min(hh.partnerIncome, hh.partnerContribution || 0);
      if (amt > 0) E.credit(state, { merchant: bi('Pasangan', 'Partner'), category: 'household', cls: 'income_household', amount: amt, note: hh.sharedIncome ? bi('Penghasilan pasangan masuk dompet bersama', 'Partner\'s income into the shared wallet') : bi('Kontribusi pasangan untuk rumah tangga', 'Partner\'s household contribution') });
    }
    // JKP
    const jkp = state.benefits.jkp;
    if (!isEmployed(state) && jkp.eligible && jkp.applied && jkp.paid < 6) {
      const searched = state.appy.applications.some((a) => E.today(state) - a.appliedAbs <= 31);
      if (searched) {
        const amt = Math.round(Math.min(jkp.wage, rp(5000000)) * 0.6);
        E.credit(state, { merchant: bi('BPJS Ketenagakerjaan — JKP', 'BPJS Ketenagakerjaan — JKP'), category: 'benefit', cls: 'benefit', amount: amt, note: bi(`Manfaat uang tunai JKP bulan ke-${jkp.paid + 1} dari 6`, `JKP cash benefit, month ${jkp.paid + 1} of 6`) });
        jkp.paid++;
      } else E.notify(state, 'workday', bi('JKP bulan ini tertunda', 'JKP held this month'), bi('Manfaat JKP mensyaratkan kamu aktif mencari kerja. Belum ada lamaran dalam 30 hari terakhir.', 'JKP requires an active job search. No applications in the last 30 days.'), 'warn');
    }
    return true;
  }
  Object.assign(E, { payday, dailyRate });

  // ── leave, sick days, clinic ────────────────────────────────────────
  function takeLeave(state, reason, opts = {}) {
    const emp = state.employment;
    if (!isScheduledToWork(state) || state.day.leave) return { ok: false, error: 'not_working' };
    let paid = false;
    if (reason === 'sick' && opts.note && state.config.scenario === 'formal') paid = true;
    else if (reason !== 'sick' && emp.leaveBalance > 0 && !opts.unpaid) { emp.leaveBalance--; paid = true; }
    if (!paid && state.job.type !== 'harian') emp.unpaidLeave++;
    state.day.leave = { reason, paid };
    state.day.slots = Math.max(state.day.slots, 3);
    if (reason !== 'sick') state.perf.days.push({ abs: E.today(state), leave: true });
    return { ok: true, paid };
  }
  function clinicVisit(state, kind, opts = {}) {
    if (kind === 'jkn' && !hasJkn(state)) return { ok: false, error: 'no_jkn' };
    if (!state.day.leave && !E.useSlots(state, 1)) return { ok: false, error: 'no_time' };
    if (kind === 'jkn' && !opts.travelPaid) {
      const fare = E.localFare(state) * 2;
      const res = E.chargeOrFail(state, { merchant: bi('Ongkos ke faskes JKN', 'Travel to your JKN clinic'), category: 'health', cls: 'essential', amount: fare, note: bi('Periksa di faskes tingkat 1 ditanggung JKN', 'The primary-care visit itself is covered by JKN') });
      if (!res.ok) { if (!state.day.leave) state.day.used--; return res; }
    }
    const h = state.health;
    if (h.condition !== 'healthy') { h.eased = true; h.severity = 1; if (h.daysLeft > 1) h.daysLeft--; }
    state.day.sickNote = true;
    E.applyMood(state, { anxiety: -3, stress: -2 });
    return { ok: true };
  }
  Object.assign(E, { takeLeave, clinicVisit });

  // ── performance ─────────────────────────────────────────────────────
  function skillMatch(state, skills) {
    const ch = state.config.character;
    const base = 68 + Math.min(20, ch.experienceYears * 4);
    if (!skills || !skills.length) return base;
    const have = skills.filter((s) => ch.skills.includes(s)).length;
    return clamp(base - 25 + (have / skills.length) * 35, 0, 100);
  }
  function compliance(state) {
    const kind = J().KINDS[state.job.kind], a = state.appearance;
    const issues = [];
    if (kind.dress === 'office') { if (a.workwear < 30) issues.push(bi('Pakaian kerja dianggap kurang rapi', 'Work clothes considered not neat enough')); }
    if (kind.dress === 'uniform') { if (a.footwear < 30) issues.push(bi('Sepatu hitam tertutup sudah rusak', 'Closed black shoes are worn out')); if (a.grooming < 30) issues.push(bi('Aturan kerapian rambut', 'Hair and grooming rules')); }
    if (a.hygiene < 45 && kind.dress !== 'ppe') issues.push(bi('Kebersihan diri (perlengkapan mandi/cuci habis)', 'Personal hygiene (out of bathroom/laundry supplies)'));
    return issues;
  }
  function doWork(state, commute) {
    const m = state.mood, r = E.rng(state, 'work');
    const nut = E.nutritionScore(state).score;
    let focus = 84 - state.sleep.debt * 4 - Math.max(0, m.stress - 55) * 0.6 + E.focusPenalty(state) - (nut < 45 ? 12 : nut < 55 ? 5 : 0) - (state.supplies.water > 0 ? 0 : 8) + (m.energy - 50) * 0.25 - (state.distress.active ? 8 : 0) - (state.food.meals.breakfast && state.food.meals.breakfast.how === 'skip' ? 4 : 0);
    focus = clamp(Math.round(focus), 5, 100);
    const sm = skillMatch(state, state.job.skills);
    let task = clamp(Math.round(0.55 * focus + 0.25 * m.motivation + 0.2 * sm + (r() - 0.5) * 16), 0, 100);
    const issues = compliance(state);
    const late = !!(commute && commute.late);
    const score = clamp(task - (late ? 8 : 0) - (issues.length ? 5 : 0), 0, 100);
    state.perf.days.push({ abs: E.today(state), focus, task, late, issues: issues.length, score });
    if (state.perf.days.length > 40) state.perf.days.shift();
    const worked = state.perf.days.filter((d) => !d.leave).slice(-10);
    state.perf.avg = Math.round(worked.reduce((s, d) => s + d.score, 0) / Math.max(1, worked.length));
    state.todayLog.worked = true;
    if (late) { state.todayLog.late = commute.minutes; state.counters.lateDays++; }
    if (state.job.type === 'harian') E.credit(state, { merchant: state.job.company, category: 'salary', cls: 'income', amount: dailyRate(state), note: bi('Upah harian', 'Daily wage') });
    if (issues.length && r() < 0.3) E.notify(state, 'workday', bi('Teguran ringan dari atasan', 'A word from your supervisor'), bi(`Atasan menyinggung: ${issues.map((i) => i.id).join('; ')}.`, `Your supervisor mentioned: ${issues.map((i) => i.en).join('; ')}.`), 'warn');
    return { focus, task, score, late, issues };
  }
  function weeklyReview(state) {
    const days = state.perf.days.filter((d) => !d.leave && E.today(state) - d.abs < 7);
    if (!days.length) return;
    const r = E.rng(state, 'review');
    const actual = Math.round(days.reduce((s, d) => s + d.score, 0) / days.length);
    const lateN = days.filter((d) => d.late).length, issueN = days.filter((d) => d.issues).length;
    const manager = clamp(Math.round(actual + (r() - 0.5) * 20 - lateN * 3 - issueN * 2), 0, 100);
    const label = manager >= 70 ? bi('Baik', 'Good') : manager >= 50 ? bi('Cukup', 'Satisfactory') : bi('Perlu perbaikan', 'Needs improvement');
    state.perf.weeks.unshift({ abs: E.today(state), actual, manager, label, lateN, issueN });
    if (state.perf.weeks.length > 12) state.perf.weeks.length = 12;
    const emp = state.employment;
    if (manager < 45) { state.perf.badWeeks++; state.perf.goodWeeks = 0; } else { state.perf.badWeeks = 0; if (manager >= 60) state.perf.goodWeeks++; }
    E.applyMood(state, manager >= 70 ? { confidence: 4, motivation: 3 } : manager < 45 ? { confidence: -4, stress: 4, motivation: -3 } : {});
    if (state.perf.badWeeks >= 2 && emp.status === 'employed') {
      state.perf.badWeeks = 0;
      if (emp.sp >= 3) { startTermination(state, 'performance'); return; }
      emp.sp++; emp.spAbs = E.today(state);
      E.notify(state, 'workday', bi(`Surat Peringatan ${emp.sp} (SP${emp.sp})`, `Warning letter ${emp.sp} (SP${emp.sp})`), bi(`Penilaian atasan dua minggu berturut-turut rendah. Kualitas kerja aktualmu ${actual}/100, keterlambatan ${lateN} kali.`, `Two weeks of low supervisor ratings. Your actual work quality was ${actual}/100, with ${lateN} late day(s).`), 'warn');
      E.applyMood(state, { anxiety: 10, confidence: -6 });
    } else if (state.perf.goodWeeks >= 4 && emp.sp > 0) { emp.sp--; state.perf.goodWeeks = 0; E.notify(state, 'workday', bi('Peringatan dicabut', 'Warning lifted'), bi('Kinerjamu stabil; satu surat peringatan tidak berlaku lagi.', 'Your performance has been steady; one warning letter no longer applies.'), 'info'); }
    else E.notify(state, 'workday', bi('Catatan mingguan atasan', 'Weekly note from your supervisor'), bi(`Penilaian: ${label.id} (${manager}/100). Kualitas kerja aktual: ${actual}/100.`, `Rating: ${label.en} (${manager}/100). Actual work quality: ${actual}/100.`), 'info');
  }
  Object.assign(E, { doWork, weeklyReview, compliance, skillMatch });

  // ── layoffs, contract ends, severance ───────────────────────────────
  function tenureYears(state) { return state.job ? (E.today(state) - state.job.startAbs) / 365 : 0; }
  function severanceEstimate(state, reason) {
    const job = state.job, w = job.wage, yrs = tenureYears(state);
    if (job.type === 'harian' || job.type === 'freelance' || state.config.scenario !== 'formal') return { amount: 0, lines: [bi('Pekerja harian/lepas atau tanpa kontrak formal: tidak ada pesangon dalam skenario ini.', 'Casual, freelance or informal work: no severance in this scenario.')] };
    if (job.type === 'pkwt' || job.type === 'magang') {
      if (job.type === 'magang') return { amount: 0, lines: [bi('Magang tidak mendapat kompensasi.', 'Internships receive no compensation.')] };
      const months = (E.today(state) - job.startAbs) / 30.4;
      const amt = Math.round((w * Math.min(months, 60)) / 12);
      return { amount: amt, lines: [bi(`Uang kompensasi PKWT: ${months.toFixed(1)} bulan ÷ 12 × upah`, `PKWT compensation: ${months.toFixed(1)} months ÷ 12 × wage`)] };
    }
    const sched = yrs < 1 ? 1 : Math.min(9, Math.floor(yrs) + 1);
    const upmk = yrs >= 24 ? 10 : yrs >= 3 ? Math.min(8, Math.floor(yrs / 3) + 1) : 0;
    const mult = reason === 'performance' ? 0.5 : 1;
    const amt = Math.round(w * (sched * mult + upmk));
    return { amount: amt, lines: [bi(`Pesangon ${sched} × ${mult} bulan upah`, `Severance ${sched} × ${mult} months' wage`), upmk ? bi(`Uang penghargaan masa kerja ${upmk} bulan`, `Long-service pay ${upmk} months`) : null].filter(Boolean) };
  }
  const REASONS = {
    downsizing: bi('Efisiensi karyawan karena penjualan turun', 'Staff cuts after falling sales'),
    restructuring: bi('Restrukturisasi organisasi', 'Organisational restructuring'),
    project: bi('Proyek tempatmu bekerja dibatalkan klien', 'The client cancelled the project you work on'),
    closure: bi('Divisi/cabang tempatmu bekerja ditutup', 'Your department or branch is closing'),
    contract: bi('Kontrak tidak diperpanjang', 'Contract not renewed'),
    performance: bi('Pemutusan setelah SP3 dan kinerja yang belum membaik', 'Termination after SP3 and no improvement'),
    harian: bi('Tidak dipanggil lagi untuk kerja harian', 'No longer called for daily work'),
  };
  function startTermination(state, reason, lastAbs) {
    const emp = state.employment;
    if (emp.status !== 'employed') return;
    const job = state.job;
    emp.status = 'notice';
    emp.reason = reason;
    emp.lastDayAbs = lastAbs || (job.type === 'harian' ? E.today(state) : E.addWorkdays(state.config.workweek, E.today(state), 14));
    emp.severance = severanceEstimate(state, reason);
    const jkpOk = state.config.scenario === 'formal' && ['pkwt', 'pkwtt'].includes(job.type) && emp.contributionMonths >= 12;
    emp.jkpEligible = jkpOk;
    E.applyMood(state, { anxiety: 25, motivation: -18, stress: 10, happiness: -10 });
    E.queueEvent(state, 'layoff_notice', { reason, lastAbs: emp.lastDayAbs, severance: emp.severance.amount, jkp: jkpOk });
    E.notify(state, 'workday', bi('Pemberitahuan pemutusan kerja', 'Termination notice'), bi(`${REASONS[reason].id}. Hari kerja terakhir: ${E.absLabel(emp.lastDayAbs)}.`, `${REASONS[reason].en}. Last working day: ${E.absLabel(emp.lastDayAbs)}.`), 'warn');
  }
  function finishEmployment(state) {
    const emp = state.employment, job = state.job;
    const sev = emp.severance || { amount: 0 };
    if (sev.amount > 0) E.credit(state, { merchant: job.company, category: 'salary', cls: 'severance', amount: sev.amount, note: sev.lines });
    emp.history.unshift({ title: job.title, company: job.company, startAbs: job.startAbs, endAbs: E.today(state), reason: emp.reason });
    const formal = state.config.scenario === 'formal' && job.type !== 'harian';
    if (formal) {
      state.docs.items.paklaring = { status: 'ready', readyAbs: E.today(state), expiresAbs: null };
      state.benefits.jhtClaimableAbs = E.today(state) + 30;
      state.benefits.jknUntilAbs = E.today(state) + 180;
      state.benefits.jkp = { eligible: !!emp.jkpEligible, applied: false, paid: 0, lastAbs: null, wage: job.wage, deadlineAbs: E.today(state) + 180 };
    }
    state.job = null;
    emp.status = 'unemployed'; emp.since = E.today(state); emp.sp = 0;
    E.notify(state, 'workday', bi('Hari ini hari terakhirmu bekerja', 'Today was your last working day'),
      bi(`${sev.amount ? 'Kompensasi/pesangon ' + M.format(sev.amount) + ' sudah dibayar. ' : ''}${formal ? 'Paklaring tersedia di Berkas. JHT bisa diklaim setelah 1 bulan.' : ''}`, `${sev.amount ? 'Compensation/severance of ' + M.format(sev.amount) + ' has been paid. ' : ''}${formal ? 'Your paklaring is in Berkas. JHT can be claimed after 1 month.' : ''}`), 'warn');
  }
  function employmentChecks(state) {
    const emp = state.employment, today = E.today(state);
    if (emp.status === 'notice' && today > emp.lastDayAbs) { finishEmployment(state); return; }
    if (emp.status === 'notice' && emp.resigning && today > emp.lastDayAbs) { finishEmployment(state); return; }
    if (emp.status !== 'employed' || !state.job) return;
    const job = state.job;
    // contract end
    if (job.endAbs && today === job.endAbs - 14) {
      const r = E.rng(state, 'renew');
      const p = clamp(0.6 + (state.perf.avg - 60) / 100 - (state.economy - 1) * 0.35 - emp.sp * 0.15, 0.1, 0.92);
      if (r() < p) {
        job.endAbs += Math.round((job.termMonths || 12) * 30.4);
        E.notify(state, 'workday', bi('Kontrak diperpanjang', 'Contract renewed'), bi(`Kontrakmu diperpanjang hingga ${E.absLabel(job.endAbs)}.`, `Your contract was extended to ${E.absLabel(job.endAbs)}.`), 'info');
        E.applyMood(state, { anxiety: -12, motivation: 6, confidence: 4 });
      } else startTermination(state, 'contract', job.endAbs);
      return;
    }
    // weekly structural risk (Mondays)
    if (E.weekday(state.date.year, state.date.month, state.date.day) !== 1) return;
    const r = E.rng(state, 'layoff');
    const hazard = (0.002 + (1 - job.stability) * 0.011) * state.economy + (emp.sp >= 2 ? 0.008 : 0);
    const x = r();
    if (x < hazard) {
      const reasons = job.type === 'harian' ? ['harian'] : ['downsizing', 'restructuring', 'closure'].concat(job.type === 'pkwt' ? ['project'] : []);
      startTermination(state, E.pick(r, reasons));
    } else if (x < hazard * 2.2 && !job.reducedHours && job.type !== 'harian') {
      job.reducedHours = { pct: E.pick(r, [0.2, 0.25, 0.3]), months: E.rint(r, 1, 2) };
      E.notify(state, 'workday', bi('Pengurangan jam kerja', 'Reduced working hours'), bi(`Perusahaan mengurangi jam kerja (skenario fiktif). Gaji bulan depan dipotong ${Math.round(job.reducedHours.pct * 100)}% selama ${job.reducedHours.months} bulan.`, `The company is cutting hours (fictional scenario). Next month's pay is ${Math.round(job.reducedHours.pct * 100)}% lower for ${job.reducedHours.months} month(s).`), 'warn');
      E.applyMood(state, { anxiety: 12, motivation: -6 });
    }
  }
  function claimJht(state) {
    const b = state.benefits;
    if (b.jhtClaimed || !b.jhtClaimableAbs || E.today(state) < b.jhtClaimableAbs || b.jht <= 0) return { ok: false, error: 'not_claimable' };
    if (!state.docs.items.paklaring) return { ok: false, error: 'needs_paklaring' };
    const amt = b.jht;
    E.credit(state, { merchant: bi('BPJS Ketenagakerjaan — JHT', 'BPJS Ketenagakerjaan — JHT'), category: 'benefit', cls: 'benefit', amount: amt, note: bi('Saldo Jaminan Hari Tua dicairkan', 'Old-age savings (JHT) paid out') });
    b.jht = 0; b.jhtClaimed = true;
    return { ok: true, amount: amt };
  }
  function applyJkp(state) {
    const j = state.benefits.jkp;
    if (!j.eligible || j.applied || isEmployed(state) || E.today(state) > (j.deadlineAbs || 0)) return { ok: false, error: 'not_eligible' };
    j.applied = true;
    return { ok: true };
  }
  function monthlyEconomy(state) {
    const r = E.rng(state, 'economy');
    state.economy = clamp(Math.round((state.economy + (r() - 0.45) * 0.25) * 100) / 100, 0.7, 1.6);
  }
  Object.assign(E, { severanceEstimate, startTermination, finishEmployment, employmentChecks, claimJht, applyJkp, monthlyEconomy, REASONS, tenureYears });

  // ── Appy: listings ──────────────────────────────────────────────────
  function refreshListings(state) {
    const a = state.appy, today = E.today(state);
    if (a.lastRefresh === today) return;
    a.lastRefresh = today;
    a.listings = a.listings.filter((l) => l.deadlineAbs >= today);
    const r = E.rng(state, 'listings');
    const { city } = E.getLocality(state.config.cityId);
    const n = E.rint(r, state.economy > 1.25 ? 1 : 2, state.economy > 1.25 ? 3 : 5) + (a.listings.length < 4 ? 2 : 0);
    const techOk = city.tier === 'A' || city.tier === 'B';
    const pool = J().ROLES.filter((t) => techOk || t.sector !== 'technology' || r() < 0.3);
    for (let i = 0; i < n; i++) {
      const t = E.pick(r, pool);
      const company = companyName(r);
      if (a.listings.some((l) => l.roleId === t.id && L(l.company) === L(company))) continue;
      a.listings.push(makeListing(state, t, company, r));
    }
    // keep the board readable: at most 14 open listings (saved or applied ones stay)
    const keep = new Set([...(a.saved || []), ...a.applications.map((x) => x.listingId)]);
    if (a.listings.length > 14) { const extra = a.listings.filter((l) => !keep.has(l.id)).sort((x, y) => x.postedAbs - y.postedAbs).slice(0, a.listings.length - 14).map((l) => l.id); a.listings = a.listings.filter((l) => !extra.includes(l.id)); }
    // gigs
    a.gigs = J().GIGS.filter(() => r() < 0.4).slice(0, 3).map((g) => ({ ...g, abs: today, pay: rp(g.pay), cost: g.cost ? rp(g.cost) : 0 }));
  }
  function makeListing(state, t, company, r) {
    const ump = E.resolveWage(state.config.cityId).amount;
    const unrealistic = t.unrealistic || r() < 0.08;
    const expReq = unrealistic ? Math.max(t.exp[0], 2) : t.exp[0];
    const type = E.pick(r, t.types);
    const arrangement = t.kind === 'desk' && r() < 0.12 ? 'remote' : t.kind === 'desk' && r() < 0.2 ? 'hybrid' : 'onsite';
    const hidden = r() < 0.25;
    return {
      id: 'L' + state.seq++, roleId: t.id, title: t.title, company, sector: t.sector, kind: t.kind, type, termMonths: type === 'pkwt' ? E.pick(r, [6, 12, 12]) : type === 'magang' ? 6 : 0,
      pay: hidden ? null : [Math.round(ump * t.pay[0] / rp(50000)) * rp(50000), Math.round(ump * t.pay[1] / rp(50000)) * rp(50000)], payMult: t.pay,
      distanceKm: arrangement === 'remote' ? 0 : E.rint(r, 3, 32), arrangement, edu: t.edu, eduVoc: !!t.eduVoc, exp: [expReq, Math.max(expReq, t.exp[1])], unrealistic: unrealistic && t.exp[0] < expReq || !!t.unrealistic,
      skills: t.skills || [], pref: t.pref || [], english: t.english || [0, 0], certs: t.certs || [], docs: t.docs || ['cv'], digital: t.digital || 1, agePref: t.agePref || null, ownBike: !!t.ownBike,
      stages: t.stages, applicants: E.rint(r, t.applicants[0], t.applicants[1]), postedAbs: E.today(state), deadlineAbs: E.today(state) + E.rint(r, 3, 14),
      stability: 0.35 + r() * 0.55, unpaidTask: !!t.unpaidTask && r() < 0.6, note: t.note || null, fictional: true,
    };
  }
  /** Mandatory requirements must all pass; preferred ones only change the odds. */
  function eligibility(state, listing) {
    const ch = state.config.character;
    const mand = [], pref = [];
    const er = eduRank(ch.education);
    const eduLabel = (J().EDUCATION.find((e) => e.rank >= listing.edu) || J().EDUCATION[0]).label;
    mand.push({ key: 'edu', label: bi(`Pendidikan minimal ${eduLabel.id}`, `At least ${eduLabel.en}`), ok: er >= listing.edu });
    if (listing.exp[0] > 0) mand.push({ key: 'exp', label: bi(`Pengalaman ${listing.exp[0]} tahun`, `${listing.exp[0]} year(s) of experience`), ok: ch.experienceYears >= listing.exp[0] });
    for (const s of listing.skills) mand.push({ key: 'skill:' + s, label: bi(`Keahlian: ${J().skillLabel[s].id}`, `Skill: ${J().skillLabel[s].en}`), ok: ch.skills.includes(s), fix: 'course' });
    if (listing.english[0] > 0) mand.push({ key: 'english', label: bi(`Bahasa Inggris ${J().ENGLISH[listing.english[0]].label.id}`, `English: ${J().ENGLISH[listing.english[0]].label.en}`), ok: engRank(ch.english) >= listing.english[0], fix: 'english' });
    for (const c of listing.certs) mand.push({ key: 'cert:' + c, label: bi(`Sertifikat: ${J().certLabel[c].id}`, `Certificate: ${J().certLabel[c].en}`), ok: ch.certs.includes(c) });
    for (const d of listing.docs) {
      const st = E.docStatus(state, d);
      mand.push({ key: 'doc:' + d, label: bi(`Dokumen: ${D().travel.docById[d].name.id}`, `Document: ${D().travel.docById[d].name.en}`), ok: st.valid, fix: 'doc', doc: d, state: st });
    }
    if (listing.ownBike) mand.push({ key: 'bike', label: bi('Punya motor sendiri', 'Own a motorbike'), ok: !!state.config.ownsMotorcycle || state.config.commutePlanId === 'motorcycle' });
    if (listing.exp[1] > listing.exp[0]) pref.push({ label: bi(`Pengalaman ${listing.exp[1]} tahun`, `${listing.exp[1]} years of experience`), ok: ch.experienceYears >= listing.exp[1] });
    for (const s of listing.pref) pref.push({ label: bi(J().skillLabel[s].id, J().skillLabel[s].en), ok: ch.skills.includes(s) });
    if (listing.english[1] > listing.english[0]) pref.push({ label: bi(`Bahasa Inggris ${J().ENGLISH[listing.english[1]].label.id}`, `English: ${J().ENGLISH[listing.english[1]].label.en}`), ok: engRank(ch.english) >= listing.english[1] });
    if (listing.eduVoc) pref.push({ label: bi('Lulusan SMK', 'Vocational school graduate'), ok: !!(J().eduById[ch.education] || {}).vocational || er >= 4 });
    if (listing.agePref) pref.push({ label: bi(`Usia maksimal ${listing.agePref} (preferensi perusahaan)`, `Age up to ${listing.agePref} (employer preference)`), ok: ch.age <= listing.agePref });
    if (listing.digital > 1) pref.push({ label: bi(`Literasi digital ${J().DIGITAL[listing.digital - 1].label.id}`, `Digital literacy: ${J().DIGITAL[listing.digital - 1].label.en}`), ok: digRank(ch.digital) >= listing.digital });
    return { ok: mand.every((x) => x.ok), mandatory: mand, preferred: pref };
  }
  function matchScore(state, listing) {
    const el = eligibility(state, listing);
    const ch = state.config.character;
    const prefOk = el.preferred.length ? el.preferred.filter((p) => p.ok).length / el.preferred.length : 0.6;
    let s = 0.32 + prefOk * 0.3 + Math.min(0.12, Math.max(0, ch.experienceYears - listing.exp[0]) * 0.04) + state.appy.cv * 0.0015;
    if (listing.docs.includes('portfolio')) s += state.appy.portfolio * 0.002 - 0.08;
    if (listing.agePref && ch.age > listing.agePref) s -= 0.12;
    if (eduRank(ch.education) >= listing.edu + 3 && listing.payMult[1] < 1.2) s -= 0.05;
    return clamp(s, 0.02, 0.98);
  }
  Object.assign(E, { refreshListings, eligibility, matchScore });

  // ── Appy: applications pipeline ─────────────────────────────────────
  const STAGE_PLANS = { 2: ['screening', 'interview'], 3: ['screening', 'interview', 'final'], 4: ['screening', 'test', 'interview', 'final'], 5: ['screening', 'psych', 'test', 'interview', 'final'] };
  const STAGE_LABEL = { screening: bi('Seleksi berkas', 'CV screening'), psych: bi('Psikotes online', 'Online psychometric test'), test: bi('Tes teknis/tugas', 'Technical test or task'), interview: bi('Wawancara HR', 'HR interview'), final: bi('Wawancara akhir', 'Final interview'), offer: bi('Penawaran kerja', 'Job offer') };
  function apply(state, listingId) {
    const l = state.appy.listings.find((x) => x.id === listingId);
    if (!l) return { ok: false, error: 'unknown' };
    if (state.appy.applications.some((a) => a.listingId === l.id)) return { ok: false, error: 'already_applied' };
    if (!E.isOnline(state)) return { ok: false, error: 'offline' };
    const el = eligibility(state, l);
    if (!el.ok) return { ok: false, error: 'not_eligible', missing: el.mandatory.filter((m) => !m.ok) };
    if (state.mood.energy < 6) return { ok: false, error: 'too_tired' };
    const quality = clamp(Math.round(state.appy.cv * 0.6 + state.mood.motivation * 0.2 + state.mood.energy * 0.2), 0, 100);
    const r = E.rng(state, 'apply', l.id);
    const app = { id: 'A' + state.seq++, listingId: l.id, listing: l, appliedAbs: E.today(state), stages: STAGE_PLANS[l.stages], stage: 0, status: 'pending', quality, nextAbs: E.today(state) + E.rint(r, 2, 8), history: [{ abs: E.today(state), text: bi('Lamaran dikirim', 'Application sent') }] };
    state.appy.applications.unshift(app);
    state.counters.applications++;
    E.applyMood(state, { energy: -3, motivation: -1 });
    return { ok: true, app };
  }
  function appProgress(state) {
    const today = E.today(state);
    for (const app of state.appy.applications) {
      if (!['pending', 'scheduled', 'task'].includes(app.status)) continue;
      if (app.status === 'task' && today > app.taskDeadline) { reject(state, app, bi('Tugas tidak dikumpulkan sebelum tenggat', 'Task not submitted before the deadline')); continue; }
      if (app.status === 'scheduled' && today > app.scheduledAbs && !app.attended) { reject(state, app, bi('Kamu tidak hadir di jadwal wawancara', 'You missed the interview')); continue; }
      if (app.nextAbs > today) continue;
      const r = E.rng(state, 'stage', app.id, app.stage);
      if (r() < 0.025) { app.status = 'freeze'; app.history.unshift({ abs: today, text: bi('Perusahaan menghentikan rekrutmen (hiring freeze)', 'The company paused hiring (hiring freeze)') }); E.notify(state, 'appy', bi('Rekrutmen dihentikan', 'Hiring paused'), bi(`${L(app.listing.title)} di ${L(app.listing.company)}: posisi ditutup sementara.`, `${L(app.listing.title)} at ${L(app.listing.company)}: the role is on hold.`), 'warn'); continue; }
      const stage = app.stages[app.stage];
      if (stage === 'screening') {
        const p = clamp(0.06 + matchScore(state, app.listing) * 0.55 + (app.quality - 60) * 0.002 - app.listing.applicants / 2600, 0.03, 0.6);
        if (r() < p) advance(state, app, r);
        else if (r() < 0.45) { app.status = 'ghosted'; app.history.unshift({ abs: today + 14, text: bi('Tidak ada kabar', 'No response') }); state.counters.rejections++; E.applyMood(state, { frustration: 2, motivation: -1 }); }
        else reject(state, app, bi('Ditolak otomatis setelah seleksi berkas', 'Automatically rejected after screening'));
      } else if (stage === 'psych' || stage === 'test') {
        if (!app.taskDone) continue;
        const sm = E.skillMatch(state, app.listing.skills.concat(app.listing.pref.slice(0, 1)));
        const p = clamp(0.25 + (sm - 50) * 0.006 + (app.taskScore - 50) * 0.006, 0.08, 0.85);
        if (r() < p) advance(state, app, r); else reject(state, app, bi('Belum lolos tes', 'Did not pass the test'));
      } else if (stage === 'interview' || stage === 'final') {
        if (!app.attended) continue;
        const p = clamp(0.22 + matchScore(state, app.listing) * 0.35 + (app.interviewScore - 50) * 0.008, 0.06, 0.82);
        if (r() < p) advance(state, app, r); else reject(state, app, bi('Tidak lanjut setelah wawancara', 'Not progressed after the interview'));
      }
    }
    // offers expire
    for (const app of state.appy.applications) if (app.status === 'offer' && today > app.offer.expiresAbs) { app.status = 'expired'; app.history.unshift({ abs: today, text: bi('Penawaran kedaluwarsa', 'Offer expired') }); }
  }
  function reject(state, app, text) {
    app.status = 'rejected';
    app.history.unshift({ abs: E.today(state), text });
    state.counters.rejections++;
    E.applyMood(state, { frustration: 4, confidence: -2, motivation: -2 });
    E.notify(state, 'appy', bi('Kabar lamaran', 'Application update'), bi(`${L(app.listing.title)} di ${L(app.listing.company)}: ${text.id}.`, `${L(app.listing.title)} at ${L(app.listing.company)}: ${text.en}.`), 'info');
  }
  function advance(state, app, r) {
    app.stage++;
    const today = E.today(state);
    if (app.stage >= app.stages.length) {
      const l = app.listing;
      const ump = E.resolveWage(state.config.cityId).amount;
      const lo = l.pay ? l.pay[0] : Math.round(ump * 1.0), hi = l.pay ? l.pay[1] : Math.round(ump * 1.2);
      const wage = M.roundTo(lo + Math.round((hi - lo) * r()), rp(50000));
      app.status = 'offer'; app.offer = { wage, expiresAbs: today + 3 };
      app.history.unshift({ abs: today, text: bi(`Penawaran kerja: ${M.format(wage)}/bulan`, `Job offer: ${M.format(wage)}/month`) });
      state.counters.offers++;
      E.applyMood(state, { confidence: 15, motivation: 15, happiness: 10, anxiety: -8 });
      E.notify(state, 'appy', bi('Kamu dapat tawaran kerja!', 'You got a job offer!'), bi(`${L(l.title)} di ${L(l.company)}: ${M.format(wage)}/bulan. Balas dalam 3 hari.`, `${L(l.title)} at ${L(l.company)}: ${M.format(wage)}/month. Reply within 3 days.`), 'event');
      return;
    }
    const stage = app.stages[app.stage];
    E.applyMood(state, { confidence: 4, motivation: 4 });
    if (stage === 'test' || stage === 'psych') {
      app.status = 'task'; app.taskDeadline = today + 3; app.taskDone = false; app.nextAbs = today + 99;
      app.history.unshift({ abs: today, text: bi(`Lolos ke tahap ${STAGE_LABEL[stage].id}. Kerjakan sebelum ${E.absLabel(app.taskDeadline)}.`, `Through to ${STAGE_LABEL[stage].en}. Complete it before ${E.absLabel(app.taskDeadline)}.`) });
      E.notify(state, 'appy', bi('Undangan tes', 'Test invitation'), bi(`${L(app.listing.title)}: ${STAGE_LABEL[stage].id}${app.listing.unpaidTask && stage === 'test' ? ' (tugas proyek tanpa bayaran — skenario fiktif)' : ''}.`, `${L(app.listing.title)}: ${STAGE_LABEL[stage].en}${app.listing.unpaidTask && stage === 'test' ? ' (unpaid project task — fictional scenario)' : ''}.`), 'event');
    } else {
      let day = today + E.rint(r, 2, 5);
      while (!E.isWorkdayDate(5, E.fromDayNumber(day))) day++;
      app.status = 'scheduled'; app.scheduledAbs = day; app.attended = false; app.nextAbs = day + E.rint(r, 2, 6);
      state.schedule.push({ id: 's' + state.seq++, abs: day, type: 'interview', appId: app.id, label: bi(`${STAGE_LABEL[stage].id}: ${L(app.listing.title)}`, `${STAGE_LABEL[stage].en}: ${L(app.listing.title)}`) });
      app.history.unshift({ abs: today, text: bi(`Undangan ${STAGE_LABEL[stage].id} pada ${E.absLabel(day)}`, `${STAGE_LABEL[stage].en} invitation for ${E.absLabel(day)}`) });
      state.counters.interviews++;
      E.notify(state, 'appy', bi('Undangan wawancara', 'Interview invitation'), bi(`${L(app.listing.title)} di ${L(app.listing.company)} — ${E.absLabel(day, true)}.`, `${L(app.listing.title)} at ${L(app.listing.company)} — ${E.absLabel(day, true)}.`), 'event');
    }
  }
  function doTask(state, appId) {
    const app = state.appy.applications.find((a) => a.id === appId);
    if (!app || app.status !== 'task') return { ok: false, error: 'invalid' };
    if (!E.useSlots(state, 1)) return { ok: false, error: 'no_time' };
    const r = E.rng(state, 'task', app.id);
    app.taskDone = true; app.status = 'pending'; app.nextAbs = E.today(state) + E.rint(r, 2, 5);
    app.taskScore = clamp(Math.round(state.mood.motivation * 0.4 + state.mood.energy * 0.2 + E.skillMatch(state, app.listing.skills) * 0.4 + (r() - 0.5) * 25), 0, 100);
    E.applyMood(state, { energy: -10, stress: 3 });
    app.history.unshift({ abs: E.today(state), text: bi('Tes/tugas dikerjakan', 'Test or task submitted') });
    return { ok: true };
  }
  function withdraw(state, appId) {
    const app = state.appy.applications.find((a) => a.id === appId);
    if (!app || ['rejected', 'withdrawn', 'hired', 'declined'].includes(app.status)) return { ok: false };
    app.status = 'withdrawn'; app.history.unshift({ abs: E.today(state), text: bi('Kamu mengundurkan diri dari proses', 'You withdrew') });
    state.schedule = state.schedule.filter((s) => s.appId !== appId);
    return { ok: true };
  }
  /** Morning of an interview: take time off if needed, travel, attend. */
  function attendInterviews(state) {
    const today = E.today(state);
    for (const s of state.schedule.filter((x) => x.abs === today && x.type === 'interview')) {
      const app = state.appy.applications.find((a) => a.id === s.appId);
      if (!app || app.status !== 'scheduled') continue;
      if (state.trip && state.trip.active) continue;
      if (isScheduledToWork(state) && !state.day.leave) {
        const lv = takeLeave(state, 'interview');
        E.notify(state, 'workday', bi('Izin untuk wawancara', 'Time off for an interview'), lv.paid ? bi('Memakai 1 hari cuti.', 'Used 1 day of annual leave.') : bi('Izin tanpa upah; dipotong saat gajian.', 'Unpaid leave; deducted on payday.'), 'info');
      }
      if (!E.useSlots(state, 1)) continue;
      const fare = app.listing.arrangement === 'remote' ? 0 : Math.max(E.localFare(state) * 2, (E.currentCommutePlan(state) || { perTrip: E.localFare(state) }).perTrip * 2);
      if (fare) E.chargeOrFail(state, { merchant: bi('Ongkos ke lokasi wawancara', 'Travel to the interview'), category: 'work', cls: 'essential', amount: fare, note: app.listing.company });
      const r = E.rng(state, 'interview', app.id);
      const attire = Math.max(state.appearance.clothing, state.appearance.workwear) >= 40 ? 5 : -6;
      const engGap = Math.max(0, app.listing.english[1] - engRank(state.config.character.english)) * 8;
      app.interviewScore = clamp(Math.round(45 + (state.mood.confidence - 50) * 0.5 + (state.mood.energy - 50) * 0.2 + attire - engGap + (r() - 0.5) * 30 - E.focusPenalty(state) * -0.3), 0, 100);
      app.attended = true;
      app.history.unshift({ abs: today, text: bi('Kamu hadir di wawancara', 'You attended the interview') });
      E.applyMood(state, { stress: 6, energy: -8 });
    }
  }
  function acceptOffer(state, appId) {
    const app = state.appy.applications.find((a) => a.id === appId);
    if (!app || app.status !== 'offer') return { ok: false, error: 'invalid' };
    const l = app.listing;
    const today = E.today(state);
    let start = today + 1;
    if (state.employment.status === 'notice') {
      // already leaving (layoff, contract end or resignation): keep those terms, start after the last day
      start = Math.max(start, state.employment.lastDayAbs + 1);
    } else if (isEmployed(state)) {
      const emp = state.employment;
      emp.status = 'notice'; emp.reason = 'resign'; emp.resigning = true; emp.lastDayAbs = today + 7; emp.severance = { amount: 0, lines: [bi('Mengundurkan diri: tidak ada pesangon', 'Resignation: no severance')] }; emp.jkpEligible = false;
      start = emp.lastDayAbs + 1;
    }
    while (!E.isWorkdayDate(state.config.workweek, E.fromDayNumber(start))) start++;
    app.status = 'hired';
    state.pendingJob = { listing: l, wage: app.offer.wage, startAbs: start };
    app.history.unshift({ abs: today, text: bi(`Diterima. Mulai kerja ${E.absLabel(start)}`, `Accepted. Starting ${E.absLabel(start)}`) });
    for (const other of state.appy.applications) if (other !== app && ['pending', 'scheduled', 'task', 'offer'].includes(other.status)) { other.status = 'withdrawn'; other.history.unshift({ abs: today, text: bi('Ditarik karena sudah menerima tawaran lain', 'Withdrawn after accepting another offer') }); }
    state.schedule = state.schedule.filter((s) => s.type !== 'interview');
    return { ok: true, startAbs: start };
  }
  function declineOffer(state, appId) {
    const app = state.appy.applications.find((a) => a.id === appId);
    if (!app || app.status !== 'offer') return { ok: false };
    app.status = 'declined'; app.history.unshift({ abs: E.today(state), text: bi('Penawaran ditolak', 'Offer declined') });
    return { ok: true };
  }
  function startPendingJob(state) {
    const pj = state.pendingJob;
    if (!pj || E.today(state) < pj.startAbs) return;
    if (state.employment.status === 'notice') finishEmployment(state);
    const l = pj.listing;
    const tpl = { id: l.roleId, title: l.title, kind: l.kind, type: l.type, termMonths: l.termMonths, uniform: ['retail', 'fnb', 'manufacturing', 'logistics', 'facility'].includes(l.sector), sector: l.sector, koperasi: l.sector === 'manufacturing' };
    state.job = makeJob(state, tpl, { company: l.company, wage: pj.wage, distanceKm: l.distanceKm || 1, stability: l.stability, arrangement: l.arrangement, skills: l.skills, fromListing: l.id });
    state.employment = { ...state.employment, status: 'employed', since: E.today(state), lastDayAbs: null, reason: null, resigning: false, sp: 0, leaveBalance: 0, monthsWorked: 0 };
    state.benefits.jkp.applied = false; state.benefits.jkp.eligible = false;
    state.pendingJob = null;
    if (l.arrangement !== 'remote') {
      state.config.distanceKm = l.distanceKm;
      const wd = E.workdaysInMonth(state.date.year, state.date.month, state.config.workweek);
      const plans = E.commutePlans(state.config.cityId, l.distanceKm, state.config);
      if (!plans.find((p) => p.id === state.config.commutePlanId && p.available)) state.config.commutePlanId = E.commutePresets(plans, wd).cheapest || null;
    }
    const dim = E.daysInMonth(state.date.year, state.date.month);
    const remaining = dim - state.date.day + 1;
    if (l.type !== 'harian') {
      const pay = E.calculateNetIncome(pj.wage, state.config.scenario);
      const first = Math.round(((state.config.wageTreatment === 'gross' ? pay.gross : pay.net) * remaining) / dim);
      E.credit(state, { merchant: l.company, category: 'salary', cls: 'income', amount: first, note: bi(`Gaji pertama prorata (${remaining} dari ${dim} hari)`, `First salary, pro rata (${remaining} of ${dim} days)`) });
    }
    E.notify(state, 'workday', bi('Hari pertama kerja', 'First day at work'), bi(`${L(l.title)} di ${L(l.company)}.`, `${L(l.title)} at ${L(l.company)}.`), 'info');
    E.applyMood(state, { anxiety: -20, motivation: 10, confidence: 8, happiness: 8 });
  }
  Object.assign(E, { apply, appProgress, doTask, withdraw, attendInterviews, acceptOffer, declineOffer, startPendingJob, STAGE_LABEL });

  // ── gigs & self-improvement ─────────────────────────────────────────
  function gigStatus(state, gig) {
    const ch = state.config.character;
    const reasons = [];
    if (gig.req.skill && !ch.skills.includes(gig.req.skill)) reasons.push(bi(`Butuh keahlian ${J().skillLabel[gig.req.skill].id}`, `Needs ${J().skillLabel[gig.req.skill].en}`));
    if (gig.req.doc && !E.docStatus(state, gig.req.doc).valid) reasons.push(bi(`Butuh ${D().travel.docById[gig.req.doc].name.id}`, `Needs ${D().travel.docById[gig.req.doc].name.en}`));
    if (gig.req.english && engRank(ch.english) < gig.req.english) reasons.push(bi('Butuh bahasa Inggris menengah', 'Needs intermediate English'));
    if (gig.req.edu && eduRank(ch.education) < gig.req.edu) reasons.push(bi('Butuh lulusan SMA', 'Needs a high-school diploma'));
    if ((gig.req.online || gig.remote) && !E.isOnline(state)) reasons.push(bi('Butuh internet', 'Needs internet'));
    if (E.freeSlots(state) < gig.slots) reasons.push(bi(`Butuh ${gig.slots} waktu luang hari ini`, `Needs ${gig.slots} free slot(s) today`));
    if (state.mood.energy < gig.energy * 0.6) reasons.push(bi('Energimu tidak cukup', 'Not enough energy'));
    return { ok: !reasons.length, reasons };
  }
  function doGig(state, gigId) {
    const gig = state.appy.gigs.find((g) => g.id === gigId);
    if (!gig || gig.done) return { ok: false };
    const st = gigStatus(state, gig);
    if (!st.ok) return { ok: false, error: 'unavailable', reasons: st.reasons };
    E.useSlots(state, gig.slots);
    gig.done = true;
    const r = E.rng(state, 'gig', gig.id);
    const cancelled = r() < 0.06;
    const pay = cancelled ? Math.round(gig.pay / 2) : gig.pay;
    if (gig.cost) E.chargeOrFail(state, { merchant: gig.title, category: 'work', cls: 'essential', amount: gig.cost, note: gig.costLabel });
    E.credit(state, { merchant: gig.title, category: 'extra', cls: 'income_extra', amount: pay, note: cancelled ? bi('Klien membatalkan di tengah jalan; dibayar setengah', 'The client cancelled midway; paid half') : bi('Kerja harian (ilustratif)', 'Day gig (illustrative)') });
    E.applyMood(state, { energy: -gig.energy, stress: 3, anxiety: -4, confidence: 2 });
    state.todayLog.gig = true;
    return { ok: true, pay, cancelled };
  }
  function improve(state, kind, courseId) {
    if (!E.useSlots(state, 1)) return { ok: false, error: 'no_time' };
    const a = state.appy, ch = state.config.character;
    const mot = state.mood.motivation;
    if (kind === 'cv') { a.cv = clamp(a.cv + Math.round(8 + mot * 0.08), 0, 92); E.applyMood(state, { energy: -5, confidence: 2 }); return { ok: true, value: a.cv }; }
    if (kind === 'portfolio') {
      if (digRank(ch.digital) < 2 && !['design', 'copywriting', 'socialmedia', 'programming', 'data'].some((s) => ch.skills.includes(s))) { state.day.used--; return { ok: false, error: 'needs_skill' }; }
      a.portfolio = clamp(a.portfolio + Math.round(6 + mot * 0.08), 0, 100); E.applyMood(state, { energy: -8, boredom: -3, confidence: 2 });
      if (a.portfolio >= 25 && !state.docs.items.portfolio) state.docs.items.portfolio = { status: 'ready', readyAbs: E.today(state), expiresAbs: null };
      return { ok: true, value: a.portfolio };
    }
    if (kind === 'english') {
      a.englishPractice += 6 + Math.round(mot * 0.05);
      E.applyMood(state, { energy: -5 });
      if (a.englishPractice >= 100 && engRank(ch.english) < 3) { a.englishPractice = 0; ch.english = J().ENGLISH[engRank(ch.english) + 1].id; E.notify(state, 'appy', bi('Bahasa Inggrismu naik level', 'Your English levelled up'), bi(`Sekarang: ${J().engById[ch.english].label.id}.`, `Now: ${J().engById[ch.english].label.en}.`), 'info'); }
      return { ok: true, value: a.englishPractice };
    }
    if (kind === 'course') {
      const c = state.courses.find((x) => x.id === courseId && x.sessionsLeft > 0);
      if (!c) { state.day.used--; return { ok: false, error: 'no_course' }; }
      c.sessionsLeft--; E.applyMood(state, { energy: -6, boredom: -4, motivation: 2 });
      if (c.sessionsLeft === 0) {
        if (c.skill === 'english') { if (engRank(ch.english) < 3) ch.english = J().ENGLISH[engRank(ch.english) + 1].id; }
        else if (!ch.skills.includes(c.skill)) ch.skills.push(c.skill);
        E.notify(state, 'appy', bi('Kursus selesai', 'Course completed'), bi(`Keahlian baru tercatat di profilmu.`, `A new skill is on your profile.`), 'info');
        E.applyMood(state, { confidence: 6, motivation: 6, happiness: 4 });
      }
      return { ok: true };
    }
    state.day.used--;
    return { ok: false };
  }
  Object.assign(E, { gigStatus, doGig, improve });
})(typeof globalThis !== 'undefined' ? globalThis : this);
