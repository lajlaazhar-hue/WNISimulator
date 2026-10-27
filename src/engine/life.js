/*
 * engine/life.js — mood, sleep, physical condition, appearance, free time,
 * recreation, purchase urges and the support flow for prolonged distress.
 *
 * Mood variables are 0–100:
 *   happiness     how good the days feel; boosts fade toward a baseline
 *   stress        pressure from work, money and illness; high stress hurts sleep and focus
 *   energy        physical energy; spent by work and activity, restored by sleep and food
 *   boredom       rises with repetitive days without leisure; lowers motivation
 *   loneliness    rises without contact; living with family slows it
 *   frustration   setbacks: declined payments, rejections, things you can't afford
 *   confidence    self-assurance; affected by personal care, outcomes, feedback
 *   motivation    drive to work and apply; hurt by boredom and setbacks
 *   social        social satisfaction from recent contact
 *   anxiety       financial anxiety: runway, overdue bills, debt, job security
 *   temptation    urge to buy optional things; rises with stress, boredom, exposure, payday
 *   wellbeing     overall wellbeing, a slow-moving blend of the others
 * Effects are gradual and contextual. Nothing here is a diagnosis.
 */
(function (root) {
  const RLS = root.RLS;
  const E = RLS.engine;
  const M = RLS.money;
  const { rp } = M;
  const { bi, L } = RLS.i18n;
  const D = () => RLS.data;
  const { clamp } = E;

  const MOOD_KEYS = ['happiness', 'stress', 'energy', 'boredom', 'loneliness', 'frustration', 'confidence', 'motivation', 'social', 'anxiety', 'temptation', 'wellbeing'];
  const MOOD_LABEL = {
    happiness: bi('Kebahagiaan', 'Happiness'), stress: bi('Stres', 'Stress'), energy: bi('Energi', 'Energy'), boredom: bi('Bosan', 'Boredom'),
    loneliness: bi('Kesepian', 'Loneliness'), frustration: bi('Frustrasi', 'Frustration'), confidence: bi('Percaya diri', 'Confidence'), motivation: bi('Motivasi', 'Motivation'),
    social: bi('Kepuasan sosial', 'Social satisfaction'), anxiety: bi('Cemas soal uang', 'Financial anxiety'), temptation: bi('Godaan belanja', 'Purchase temptation'), wellbeing: bi('Kesejahteraan', 'Wellbeing'),
  };
  const MOOD_BAD = new Set(['stress', 'boredom', 'loneliness', 'frustration', 'anxiety', 'temptation']);
  const APPEAR_KEYS = ['skin', 'grooming', 'comfort'];

  function initLife(state) {
    state.mood = { happiness: 60, stress: 30, energy: 78, boredom: 25, loneliness: state.config.household.partner ? 15 : 30, frustration: 15, confidence: 55, motivation: 62, social: 50, anxiety: 30, temptation: 30, wellbeing: 64 };
    state.moodLog = [];
    state.health = { condition: 'healthy', severity: 0, daysLeft: 0, eased: false, cycleStart: state.startAbs - E.rint(E.mulberry32(state.seed), 0, 26), cycleLen: 27 + (state.seed % 5), history: [] };
    state.appearance = { clothing: 65, workwear: 70, hygiene: 85, grooming: 70, skin: 68, footwear: 65, comfort: 70 };
    state.sleep = { hours: 7.5, debt: 0 };
    state.day = { slots: 1, used: 0, leave: null, weather: 'clear', friendFree: false };
    state.todayLog = freshToday();
    state.activityLog = [];
    state.urges = [];
    state.distress = { lowDays: 0, active: false, lastPromptAbs: -99, support: 0 };
    state.routineStreak = 0;
    state.lastClothesAbs = state.startAbs - 30;
  }
  E._inits.push(initLife);
  function freshToday() { return { worked: false, late: 0, leisure: 0, social: 0, optional: 0, unexpected: 0, declined: 0, activities: [], mealsSkipped: 0, incident: false, cookedMeals: 0, boughtMeals: 0 }; }

  function applyMood(state, delta, mult = 1) {
    if (!delta) return;
    for (const [k, v] of Object.entries(delta)) {
      if (!v) continue;
      if (k in state.mood) state.mood[k] = clamp(Math.round(state.mood[k] + v * mult), 0, 100);
      else if (APPEAR_KEYS.includes(k)) state.appearance[k] = clamp(Math.round(state.appearance[k] + v * mult), 0, 100);
    }
  }
  const toward = (cur, target, rate) => clamp(Math.round(cur + (target - cur) * rate), 0, 100);

  E.moodOnDeclined = (state) => { applyMood(state, { frustration: 6, anxiety: 3 }); state.todayLog.declined++; };
  E.moodOnBillPaid = (state, bill) => { if (/rent|arrears/.test(bill.key)) applyMood(state, { anxiety: -3 }); };

  // ── weather ─────────────────────────────────────────────────────────
  function rollWeather(state) {
    const r = E.rng(state, 'weather');
    const m = state.date.month;
    const wet = m >= 9 || m <= 3; // Oct–Apr
    const x = r();
    return x < (wet ? 0.42 : 0.12) ? 'rain' : x > (wet ? 0.85 : 0.6) ? 'hot' : 'clear';
  }
  const isRainy = (state) => state.day.weather === 'rain';
  const wetSeason = (state) => state.date.month >= 9 || state.date.month <= 3;

  // ── physical condition ──────────────────────────────────────────────
  const CONDITIONS = {
    healthy: { label: bi('Sehat dan bertenaga', 'Healthy and energetic'), cook: 'normal', focus: 0, energyCap: 100, mood: {} },
    tired: { label: bi('Agak lelah', 'Mildly tired'), cook: 'normal', focus: -5, energyCap: 70, mood: { happiness: -1 } },
    headache: { label: bi('Sakit kepala', 'Headache'), cook: 'simple', focus: -15, energyCap: 80, mood: { happiness: -3, stress: 2 } },
    fever: { label: bi('Demam', 'Fever'), cook: 'none', focus: -35, energyCap: 45, mood: { happiness: -5 }, sick: true, days: [2, 4] },
    flu: { label: bi('Pilek / gejala flu', 'Cold or flu-like symptoms'), cook: 'simple', focus: -15, energyCap: 65, mood: { happiness: -3 }, sick: true, days: [3, 5] },
    stomach: { label: bi('Sakit perut', 'Stomach upset'), cook: 'simple', focus: -18, energyCap: 60, mood: { happiness: -3 }, sick: true, days: [1, 2], light: true },
    menstrual: { label: bi('Nyeri haid', 'Menstrual discomfort'), cook: 'normal', focus: -6, energyCap: 85, mood: { happiness: -1 }, days: [2, 4] },
    exhausted: { label: bi('Kelelahan', 'Exhausted'), cook: 'simple', focus: -20, energyCap: 50, mood: { stress: 2 }, days: [1, 1] },
    sleepdeprived: { label: bi('Kurang tidur', 'Lack of sleep'), cook: 'simple', focus: -20, energyCap: 60, mood: { stress: 3, temptation: 4 }, days: [1, 1] },
    lowenergy: { label: bi('Lemas, kurang bertenaga', 'Low energy'), cook: 'simple', focus: -12, energyCap: 60, mood: { happiness: -2 }, days: [2, 3] },
  };
  function cond(state) { return CONDITIONS[state.health.condition] || CONDITIONS.healthy; }
  function severityText(state) {
    const h = state.health;
    if (h.condition === 'healthy') return null;
    return h.severity >= 2 ? bi('berat', 'strong') : bi('ringan', 'mild');
  }
  function setCondition(state, key, days, severity = 1) {
    const h = state.health;
    h.condition = key; h.daysLeft = days; h.severity = severity; h.eased = false;
    h.history.unshift({ abs: E.today(state), key });
    if (h.history.length > 40) h.history.length = 40;
    if (CONDITIONS[key].sick) state.counters.sickDays++;
  }
  function rollHealth(state) {
    const h = state.health;
    const r = E.rng(state, 'health');
    h.eased = false;
    if (h.condition !== 'healthy') {
      h.daysLeft--;
      if (h.daysLeft <= 0) {
        const was = h.condition;
        h.condition = 'healthy'; h.severity = 0;
        if (CONDITIONS[was].sick) E.notify(state, 'aku', bi('Kamu merasa lebih baik', 'You feel better'), bi('Kondisimu kembali normal. Rutinitas bisa dilanjutkan.', 'Back to normal. You can return to your usual routine.'), 'info');
      } else return;
    }
    const ch = state.config.character;
    const today = E.today(state);
    if (ch.menstruates && (today - h.cycleStart) % h.cycleLen === 0) {
      setCondition(state, 'menstrual', E.rint(r, 2, 4), r() < 0.3 ? 2 : 1);
      return;
    }
    if (state.mood.energy < 15) { setCondition(state, 'exhausted', 1, 2); return; }
    if (state.sleep.hours < 5.5) { setCondition(state, 'sleepdeprived', 1, state.sleep.hours < 4.5 ? 2 : 1); return; }
    const nut = E.nutritionScore ? E.nutritionScore(state).score : 60;
    let p = 0.02 + (state.mood.stress > 70 ? 0.03 : 0) + (nut < 45 ? 0.03 : 0) + (state.appearance.hygiene < 45 ? 0.02 : 0) + (isRainy(state) ? 0.012 : 0) + (ch.age > 45 ? 0.01 : 0) + (state.sleep.debt > 6 ? 0.02 : 0);
    if (r() > p) { if (state.mood.energy < 35 && r() < 0.35) setCondition(state, 'tired', 1, 1); return; }
    const pool = [['headache', 2 + (state.mood.stress > 65 ? 3 : 0)], ['flu', 2 + (isRainy(state) ? 2 : 0)], ['fever', 1.2], ['stomach', 1 + (state.appearance.hygiene < 45 ? 2 : 0)], ['lowenergy', nut < 45 ? 3 : 0.4]];
    const tot = pool.reduce((s, x) => s + x[1], 0);
    let x = r() * tot, key = 'headache';
    for (const [k, w] of pool) { x -= w; if (x <= 0) { key = k; break; } }
    const days = CONDITIONS[key].days ? E.rint(r, ...CONDITIONS[key].days) : 1;
    setCondition(state, key, days, r() < 0.35 ? 2 : 1);
    E.notify(state, 'aku', bi('Kondisi badan hari ini', 'How you feel today'), bi(`${CONDITIONS[key].label.id}. ${CONDITIONS[key].sick ? 'Mungkin perlu istirahat.' : ''}`, `${CONDITIONS[key].label.en}. ${CONDITIONS[key].sick ? 'You may need rest.' : ''}`), 'warn');
  }
  /** Over-the-counter relief: eases symptoms today and can shorten the episode. */
  function treatWith(state, item) {
    const relief = (item.health && item.health.relief) || [];
    const h = state.health;
    if (!relief.includes(h.condition)) return false;
    h.eased = true;
    if (h.daysLeft > 1 && h.severity < 2) h.daysLeft--;
    if (h.severity > 1) h.severity--;
    applyMood(state, { happiness: 2, stress: -2 });
    return true;
  }
  function focusPenalty(state) {
    const c = cond(state);
    let p = c.focus * (state.health.severity >= 2 ? 1.3 : 1);
    if (state.health.eased) p *= 0.5;
    return p;
  }
  Object.assign(E, { CONDITIONS, cond, severityText, setCondition, rollHealth, treatWith, focusPenalty, isRainy, wetSeason, MOOD_KEYS, MOOD_LABEL, MOOD_BAD, applyMood });

  // ── sleep (morning) ─────────────────────────────────────────────────
  function sleepNight(state) {
    const r = E.rng(state, 'sleep');
    const m = members(state);
    const h = E.curHousing(state);
    const hot = state.day.weather === 'hot' || !E.wetSeason(state);
    let hours = 7.6;
    hours -= state.mood.stress > 75 ? 1.3 : state.mood.stress > 58 ? 0.6 : 0;
    hours -= state.mood.anxiety > 75 ? 0.6 : 0;
    const mosquito = E.wetSeason(state) && !(state.supplies.repellent > 0);
    if (mosquito) hours -= 0.6;
    if (hot && !h.ac && !(state.owned.items.fan)) hours -= 0.5;
    if (m.infants > 0) hours -= 1.1;
    if (CONDITIONS[state.health.condition].sick) hours -= 0.8;
    if (state.todayLog.lateNight) hours -= 1.5;
    if (state.distress.active) hours -= 0.5;
    hours += (r() - 0.5) * 1.4;
    hours = clamp(Math.round(hours * 10) / 10, 3, 10);
    state.sleep.hours = hours;
    state.sleep.debt = clamp(state.sleep.debt + (7.5 - hours) - (hours >= 7 ? 1 : 0), 0, 14);
    const nut = E.nutritionScore ? E.nutritionScore(state).score : 60;
    const nutAdj = nut < 40 ? -10 : nut < 55 ? -4 : nut > 75 ? 4 : 0;
    const hydr = state.supplies.water > 0 ? 0 : -6;
    state.mood.energy = clamp(Math.round(state.mood.energy + hours * 9 - 12 + nutAdj + hydr - state.sleep.debt * 0.8), 0, 100);
    if (mosquito && E.today(state) - (state.lastMosquitoNote || -99) > 10) { state.lastMosquitoNote = E.today(state); E.notify(state, 'aku', bi('Tidur terganggu nyamuk', 'Mosquitoes disturbed your sleep'), bi('Musim hujan: obat nyamuk atau losion anti nyamuk dari DailyMart bisa membantu.', 'Rainy season: mosquito coils or repellent from DailyMart can help.'), 'info'); }
    if (state.supplies.coffee > 0 && E.isWorkday(state)) { state.supplies.coffee--; state.mood.energy = clamp(state.mood.energy + 4, 0, 100); }
  }
  const members = (s) => E.members(s);

  // ── appearance & personal care (daily) ──────────────────────────────
  function updateAppearance(state) {
    const a = state.appearance, s = state.supplies, worked = state.todayLog.worked;
    const job = state.job;
    const kind = job ? D().jobs.KINDS[job.kind] : null;
    const missing = ['soap', 'shampoo', 'toothpaste'].filter((k) => !(s[k] > 0)).length + (s.toothbrush > 0 ? 0 : 0.5) + (s.laundry > 0 ? 0 : 1) + (s.deodorant > 0 ? 0 : 0.3)
      + (state.health.condition === 'menstrual' && !(s.pads > 0) ? 1.5 : 0);
    a.hygiene = toward(a.hygiene, clamp(100 - missing * 18, 0, 100), 0.5);
    a.clothing = clamp(a.clothing - (100 / 260) * (s.laundry > 0 ? 1 : 1.6), 0, 100);
    if (worked) a.workwear = clamp(a.workwear - 0.45, 0, 100);
    const footwearWear = 0.18 + (worked && kind && kind.standing ? 0.4 : 0) + (state.config.commutePlanId === 'bike' ? 0.25 : 0);
    a.footwear = clamp(a.footwear - footwearWear, 0, 100);
    a.grooming = clamp(a.grooming - (s.grooming > 0 ? 0.35 : 1), 0, 100);
    const cp = E.currentCommutePlan(state);
    const outdoorCommute = worked && !!(cp && cp.outdoor);
    let skinTarget = 62 + (s.cleanser > 0 ? 8 : 0) + (s.moisturizer > 0 ? 6 : 0) + (s.serum > 0 ? 3 : 0) - (state.sleep.hours < 6 ? 10 : 0) - (state.mood.stress > 70 ? 6 : 0) - (outdoorCommute && !(s.sunscreen > 0) ? 8 : 0) - (s.water > 0 ? 0 : 6);
    a.skin = toward(a.skin, clamp(skinTarget, 0, 100), 0.2);
    let comfortTarget = 70 - (CONDITIONS[state.health.condition].sick ? 25 : 0) - (kind && kind.standing && a.footwear < 30 ? 20 : 0) - (a.clothing < 25 ? 10 : 0) + (state.owned.items.fan || E.curHousing(state).ac ? 5 : 0);
    a.comfort = toward(a.comfort, clamp(comfortTarget, 0, 100), 0.4);
    // routine supplies used daily
    for (const k of ['cleanser', 'moisturizer', 'sunscreen', 'serum', 'grooming']) if (s[k] > 0) s[k]--;
    if (worked && s.makeup > 0) s.makeup--;
    a.hygiene = Math.round(a.hygiene); a.clothing = Math.round(a.clothing * 10) / 10; a.workwear = Math.round(a.workwear * 10) / 10; a.footwear = Math.round(a.footwear * 10) / 10; a.grooming = Math.round(a.grooming * 10) / 10;
  }
  const APPEAR_LABEL = {
    clothing: bi('Kondisi pakaian', 'Clothing condition'), workwear: bi('Pakaian kerja', 'Workwear'), hygiene: bi('Kebersihan diri', 'Personal hygiene'), grooming: bi('Kerapian', 'Grooming'),
    skin: bi('Kenyamanan kulit', 'Skin comfort'), footwear: bi('Kondisi sepatu', 'Footwear condition'), comfort: bi('Kenyamanan fisik', 'Physical comfort'),
  };
  function appearanceNote(state, key) {
    const v = state.appearance[key];
    const pick = (a, b, c) => (v >= 65 ? a : v >= 35 ? b : c);
    const T = {
      clothing: pick(bi('Masih layak dan rapi', 'Still neat and wearable'), bi('Mulai kusam, masih bisa dipakai', 'Getting worn, still wearable'), bi('Banyak yang sudah usang', 'Much of it is worn out')),
      workwear: pick(bi('Sesuai aturan kerja', 'Meets work dress rules'), bi('Masih memenuhi aturan', 'Still meets the rules'), bi('Mungkin tidak memenuhi aturan berpakaian', 'May not meet the dress code')),
      hygiene: pick(bi('Kebutuhan mandi & cuci lengkap', 'Bathroom and laundry supplies covered'), bi('Ada yang mulai habis', 'Some supplies running out'), bi('Perlengkapan mandi/cuci habis', 'Out of bathroom or laundry supplies')),
      grooming: pick(bi('Rapi', 'Tidy'), bi('Cukup rapi', 'Fairly tidy'), bi('Perlu potong rambut/merapikan diri', 'Due a haircut or tidy-up')),
      skin: pick(bi('Kulit terasa nyaman', 'Skin feels comfortable'), bi('Kulit terasa kering/kusam', 'Skin feels dry or dull'), bi('Kulit terasa tidak nyaman', 'Skin feels uncomfortable')),
      footwear: pick(bi('Sepatu masih nyaman', 'Shoes still comfortable'), bi('Sol mulai tipis', 'Soles getting thin'), bi('Sepatu sudah aus; kaki pegal', 'Shoes worn out; feet ache')),
      comfort: pick(bi('Badan terasa nyaman', 'Physically comfortable'), bi('Sedikit tidak nyaman', 'Somewhat uncomfortable'), bi('Tidak nyaman', 'Uncomfortable')),
    };
    return T[key];
  }
  Object.assign(E, { updateAppearance, APPEAR_LABEL, appearanceNote, sleepNight });

  // ── daily mood dynamics (end of day) ────────────────────────────────
  function runwayDays(state) {
    const daily = Math.max(rp(30000), E.estimateDailyEssentials ? E.estimateDailyEssentials(state) : rp(60000));
    return Math.floor((state.wallet + state.savings - E.unpaidBillsTotal(state)) / daily);
  }
  function updateMood(state) {
    const m = state.mood, t = state.todayLog, r = E.rng(state, 'mood');
    const job = state.job;
    const kind = job ? D().jobs.KINDS[job.kind] : null;
    const hh = E.household(state);
    const overdue = E.billsThisMonth(state).filter((b) => b.status === 'overdue').length;
    const runway = runwayDays(state);
    const emp = state.employment ? state.employment.status : 'employed';
    const debt = E.debtOutstanding ? E.debtOutstanding(state) : 0;
    const nut = E.nutritionScore ? E.nutritionScore(state).score : 60;
    const c = cond(state);
    // routine
    if (t.leisure === 0 && t.social === 0) state.routineStreak++; else state.routineStreak = 0;
    // energy spent today
    let spent = t.worked ? kind.energy : 6;
    if (c.sick) spent += 10;
    spent += t.mealsSkipped * 8;
    if (t.worked && kind && kind.standing && state.appearance.footwear < 30) spent += 5;
    m.energy = clamp(Math.min(m.energy - spent, c.energyCap), 0, 100);
    // stress moves toward a target set by today's load, money and health
    const daysSinceSocial = t.social ? 0 : (state.daysSinceSocial || 0) + 1;
    state.daysSinceSocial = daysSinceSocial;
    let stressT = 28 + (t.worked ? kind.stress * 1.6 * (job && job.reducedHours ? 0.8 : 1) : -6) + overdue * 7 + (c.sick ? 8 : 0) + (t.late ? 5 : 0) + (t.unexpected > 0 ? 5 : 0)
      + hh.children.length * 3 + (state.distress.active ? 8 : 0) + (m.energy < 20 ? 6 : 0) + (state.sleep.debt > 5 ? 5 : 0) + (m.anxiety > 60 ? (m.anxiety - 60) * 0.3 : 0) - (t.leisure ? 8 : 0) - (t.social ? 4 : 0);
    m.stress = toward(m.stress, clamp(stressT, 0, 100), 0.28);
    // boredom, loneliness, social satisfaction
    const withPeople = hh.partner || E.curHousing(state).type === 'family';
    const boredT = 22 + Math.min(40, state.routineStreak * 4) + (!t.worked && !t.leisure ? 8 : 0) + (emp === 'unemployed' && !t.leisure ? 10 : 0) - (t.leisure ? 6 : 0);
    m.boredom = toward(m.boredom, clamp(boredT, 0, 100), 0.18);
    const loneT = (withPeople ? 18 : 30) + Math.min(45, daysSinceSocial * 3.5) - (t.worked && kind && kind.dress === 'uniform' ? 3 : 0);
    m.loneliness = toward(m.loneliness, clamp(loneT, 0, 100), 0.18);
    const socT = 62 - Math.min(50, daysSinceSocial * 4) + (withPeople ? 10 : 0);
    m.social = toward(m.social, clamp(socT, 0, 100), 0.2);
    // frustration decays
    m.frustration = clamp(Math.round(m.frustration - 3 + t.declined * 2), 0, 100);
    // anxiety target
    let anxT = 25 + overdue * 9 + (runway < 3 ? 35 : runway < 7 ? 22 : runway < 14 ? 10 : 0) + (debt > 0 ? Math.min(20, debt / rp(150000)) : 0)
      + (emp === 'notice' ? 25 : emp === 'unemployed' ? 30 : 0) + ((state.employment && state.employment.sp) || 0) * 6 + (state.loanHarassDays > 0 ? 15 : 0);
    m.anxiety = toward(m.anxiety, clamp(anxT, 0, 100), 0.3);
    // confidence
    const a = state.appearance;
    let confT = 50 + (a.hygiene - 70) * 0.2 + (a.grooming - 60) * 0.1 + (a.clothing - 50) * 0.06 + (a.skin - 60) * 0.06 - (m.frustration > 50 ? 6 : 0) + (state.perf ? (state.perf.avg - 60) * 0.1 : 0);
    if (a.workwear < 30 && t.worked && kind && kind.dress !== 'ppe') confT -= 4;
    m.confidence = toward(m.confidence, clamp(confT, 0, 100), 0.18);
    // motivation
    let motT = 62 - (m.boredom - 30) * 0.35 - (m.stress > 70 ? 10 : 0) - (m.frustration - 20) * 0.25 + (m.energy - 50) * 0.1 + (state.distress.active ? -10 : 0) - (emp === 'notice' ? 12 : 0);
    m.motivation = toward(m.motivation, clamp(motT, 0, 100), 0.22);
    // happiness
    let hapT = 55 + (m.social - 50) * 0.2 - (m.stress - 40) * 0.3 - (m.boredom - 30) * 0.22 - (m.anxiety - 40) * 0.2 + (nut < 45 ? -6 : nut > 75 ? 3 : 0) + (c.sick ? -6 : 0) + (m.energy - 50) * 0.08;
    m.happiness = toward(m.happiness, clamp(hapT, 0, 100), 0.18);
    // temptation
    const daysToPay = E.daysInMonth(state.date.year, state.date.month) - state.date.day;
    let tempT = 22 + m.stress * 0.22 + m.boredom * 0.2 + (state.date.day <= 3 ? 12 : 0) + (state.sleep.hours < 6 ? 5 : 0) + (m.frustration > 50 ? 5 : 0) - (daysToPay < 5 && m.anxiety > 60 ? 6 : 0);
    m.temptation = toward(m.temptation, clamp(tempT, 0, 100), 0.3);
    // condition mood & noise
    applyMood(state, c.mood);
    for (const k of ['happiness', 'stress', 'boredom', 'temptation']) m[k] = clamp(m[k] + Math.round((r() - 0.5) * 4), 0, 100);
    // wellbeing
    const comp = 0.24 * m.happiness + 0.14 * (100 - m.stress) + 0.14 * m.energy + 0.1 * (100 - m.boredom) + 0.1 * m.social + 0.1 * (100 - m.anxiety) + 0.06 * m.confidence + 0.06 * m.motivation + 0.06 * (100 - m.loneliness);
    m.wellbeing = toward(m.wellbeing, comp, 0.3);
    state.moodLog.push({ abs: E.today(state), ...m });
    if (state.moodLog.length > 70) state.moodLog.shift();
  }
  Object.assign(E, { updateMood, runwayDays });

  // ── distress & support ──────────────────────────────────────────────
  function checkDistress(state) {
    const d = state.distress, w = state.mood.wellbeing;
    if (w < 25) d.lowDays++; else d.lowDays = Math.max(0, d.lowDays - 1);
    if (!d.active && d.lowDays >= 5) {
      d.active = true; d.support = 0;
      E.notify(state, 'aku', bi('Hari-hari terasa sangat berat', 'Things have felt very heavy'), bi('Kamu sudah lama merasa jauh dari baik. Ada pilihan yang bisa membantu, dan kamu tidak harus menghadapinya sendirian.', 'You have felt far from okay for a while. There are things that can help, and you do not have to face this alone.'), 'event');
    }
    if (d.active && w > 38) { d.recoverDays = (d.recoverDays || 0) + 1; if (d.recoverDays >= 3) { d.active = false; d.recoverDays = 0; E.notify(state, 'aku', bi('Sedikit lebih ringan', 'A little lighter'), bi('Beberapa hari ini terasa lebih baik. Tetap jaga istirahat dan kontak dengan orang terdekat.', 'The last few days have felt better. Keep resting and staying in touch with people close to you.'), 'info'); } }
    else if (d.active) d.recoverDays = 0;
    if (d.active && E.today(state) - d.lastPromptAbs >= 6 && !state.activeEvent) { d.lastPromptAbs = E.today(state); E.queueEvent(state, 'support'); }
  }
  /** Supportive actions count toward recovery; shopping does not. */
  function supportAction(state, kind) {
    const d = state.distress;
    const fx = { rest: { stress: -10, energy: 12, wellbeing: 4 }, friend: { loneliness: -20, social: 15, wellbeing: 6, happiness: 5 }, family: { loneliness: -16, social: 10, wellbeing: 5 }, professional: { stress: -12, anxiety: -8, wellbeing: 8, motivation: 5 } }[kind];
    applyMood(state, fx);
    d.support++;
    state.todayLog.social += kind === 'friend' || kind === 'family' ? 1 : 0;
  }
  Object.assign(E, { checkDistress, supportAction });

  // ── free time (slots) ───────────────────────────────────────────────
  function setupSlots(state) {
    const working = E.isScheduledToWork ? E.isScheduledToWork(state) : E.isWorkday(state);
    let slots = working ? 1 : 3;
    if (state.trip && state.trip.active) slots = 0;
    if (state.mood.energy < 15 && slots > 0) slots--;
    state.day.slots = slots;
    state.day.used = 0;
  }
  const freeSlots = (state) => Math.max(0, state.day.slots - state.day.used);
  function useSlots(state, n) {
    if (freeSlots(state) < n) return false;
    state.day.used += n;
    return true;
  }
  Object.assign(E, { setupSlots, freeSlots, useSlots });

  // ── recreation ──────────────────────────────────────────────────────
  function cityFeatures(state) {
    const { city } = E.getLocality(state.config.cityId);
    const f = new Set(D().world.FEATURES_BY_TIER[city.tier]);
    if (D().world.BEACH_CITIES.includes(city.id)) f.add('beach');
    return f;
  }
  function friendAvailable(state) {
    const r = E.rng(state, 'friend');
    const wd = E.weekday(state.date.year, state.date.month, state.date.day);
    return r() < (wd === 0 || wd === 6 ? 0.65 : 0.35);
  }
  function localFare(state) {
    const plans = E.commutePlans(state.config.cityId, 3, state.config);
    const pub = plans.find((p) => p.tags.includes('public') && p.available);
    return pub ? Math.min(pub.perTrip, rp(8000)) : rp(5000);
  }
  function activityStatus(state, act) {
    const reasons = [];
    const wd = E.weekday(state.date.year, state.date.month, state.date.day);
    if (act.feature && !cityFeatures(state).has(act.feature)) return { available: false, hidden: true, reasons: [bi('Tidak ada di kotamu', 'Not available in your city')] };
    if (act.sundayOnly && wd !== 0) reasons.push(bi('Hanya hari Minggu pagi', 'Sunday mornings only'));
    if (act.weekendOnly && wd !== 0 && wd !== 6) reasons.push(bi('Hanya akhir pekan', 'Weekends only'));
    if (act.chance && E.rng(state, 'act', act.id)() > act.chance) reasons.push(bi('Tidak ada jadwal hari ini', 'Nothing on today'));
    if (act.outdoor && isRainy(state)) reasons.push(bi('Sedang hujan', 'It is raining'));
    for (const n of act.needs) {
      if (n === 'online' && !E.isOnline(state)) reasons.push(bi('Butuh internet', 'Needs internet'));
      if (n === 'book' && !(state.owned.items.book || (state.owned.borrowedUntil || 0) >= E.today(state))) reasons.push(bi('Butuh buku (beli atau pinjam di perpustakaan)', 'Needs a book (buy one or borrow from the library)'));
      if (n.startsWith('hobby_') && !state.owned.items[n]) reasons.push(bi('Butuh perlengkapan hobi dari ShopSquare', 'Needs hobby supplies from ShopSquare'));
      if (n === 'friend' && !state.day.friendFree) reasons.push(bi('Teman-temanmu sedang sibuk hari ini', 'Your friends are busy today'));
      if (n === 'family' && !(E.household(state).partner || E.household(state).children.length || E.curHousing(state).type === 'family')) return { available: false, hidden: true, reasons: [] };
    }
    if (freeSlots(state) < act.slots) reasons.push(bi(`Butuh ${act.slots} waktu luang`, `Needs ${act.slots} free slot${act.slots > 1 ? 's' : ''}`));
    if (CONDITIONS[state.health.condition].sick && act.id !== 'relax' && act.id !== 'online_videos' && act.id !== 'call_family' && act.id !== 'read') reasons.push(bi('Kondisi badanmu sedang kurang fit', 'You are not feeling well enough'));
    const cost = rp(act.cost) + (act.travel ? localFare(state) * 2 : 0);
    return { available: reasons.length === 0, reasons, cost, ticket: rp(act.cost), travel: act.travel ? localFare(state) * 2 : 0 };
  }
  function doActivity(state, actId) {
    const act = D().world.activityById[actId];
    if (!act) return { ok: false, error: 'unknown' };
    const st = activityStatus(state, act);
    if (!st.available) return { ok: false, error: 'unavailable', reasons: st.reasons };
    if (st.cost > 0) {
      const res = E.chargeOrFail(state, { merchant: act.name, category: 'leisure', cls: act.cost > 0 ? 'discretionary' : 'essential', amount: st.cost,
        note: st.travel ? bi(`Termasuk ongkos jalan ${M.format(st.travel)}`, `Includes ${M.format(st.travel)} travel`) : null, split: act.cost > 0 ? { discretionary: st.cost } : { essential: st.cost } });
      if (!res.ok) return res;
    }
    useSlots(state, act.slots);
    const recent = state.activityLog.filter((x) => x.id === act.id && E.today(state) - x.abs < 7).length;
    const factor = Math.pow(1 - act.habit, recent);
    applyMood(state, act.effects, factor);
    if (act.temptation) applyMood(state, { temptation: act.temptation });
    if (act.grantsBook) state.owned.borrowedUntil = E.today(state) + 14;
    if (act.meal) { state.todayLog.extraMeal = (state.todayLog.extraMeal || 0) + 1; }
    if (act.energyNext) state.todayLog.energyNext = (state.todayLog.energyNext || 0) + act.energyNext;
    const fx = act.effects;
    state.todayLog.leisure++;
    if ((fx.social || 0) > 0 || (fx.loneliness || 0) < 0) state.todayLog.social++;
    state.todayLog.activities.push(act.id);
    state.activityLog.push({ abs: E.today(state), id: act.id });
    if (state.activityLog.length > 60) state.activityLog.shift();
    if (act.cost > 0) state.counters.paidActivities++; else state.counters.freeActivities++;
    if (act.id === 'window_shop') maybeUrge(state, 'window', true);
    return { ok: true, factor, cost: st.cost };
  }
  function postponeActivity(state) {
    state.counters.postponed++;
    applyMood(state, { frustration: 2, boredom: 1, anxiety: -1 });
  }
  Object.assign(E, { cityFeatures, friendAvailable, activityStatus, doActivity, postponeActivity, localFare });

  // ── purchase urges ──────────────────────────────────────────────────
  const URGE_POOLS = {
    stress: { items: ['choco', 'chips', 'qb_kopi', 'qb_boba', 'qb_martabak', 'snack_import'], reason: bi('Hari ini melelahkan. Rasanya ingin sesuatu yang manis atau segar.', 'Today was draining. Something sweet or refreshing sounds really good.') },
    skin: { items: ['serum_standard', 'sheet_mask_standard', 'moisturizer_standard', 'sheet_mask_premium'], reason: bi('Di cermin, kulitmu terlihat lelah. Produk perawatan yang lagi ramai dibahas itu menggoda.', 'Your skin looks tired in the mirror. That skincare everyone talks about is tempting.') },
    wardrobe: { items: ['shirt_casual_standard', 'tee_standard', 'jacket_standard', 'kerudung_standard'], reason: bi('Rasanya pakai baju yang itu-itu saja. Ada model baru yang kamu suka.', 'You keep wearing the same few outfits. There is a new style you like.') },
    event: { items: ['liptint_standard', 'cushion_standard', 'batik_standard', 'shirt_casual_standard'], reason: bi('Ada acara sebentar lagi dan kamu ingin tampil berbeda.', 'There is an event coming up and you want to look different.') },
    phone: { items: ['phone_standard', 'phone_case_standard', 'charger_standard'], reason: bi('Ponselmu makin lambat dan baterainya cepat habis.', 'Your phone is slower and the battery drains fast.') },
    rough: { items: ['perfume_standard', 'candle_standard', 'earphones_standard', 'game_voucher_standard', 'novel_standard'], reason: bi('Minggu yang berat. Kamu merasa pantas dapat hadiah kecil untuk diri sendiri.', 'A rough week. You feel you deserve a small treat.') },
    social: { items: ['tote_premium', 'sneakers_standard', 'watch_standard', 'sunglasses_standard'], reason: bi('Temanmu memamerkan barang baru di media sosial. Semua orang sepertinya punya.', 'A friend showed off something new online. Everyone seems to have one.') },
    payday: { items: ['sneakers_standard', 'work_bag_standard', 'earphones_standard', 'perfume_standard', 'phone_standard'], reason: bi('Gaji baru masuk. Barang di keranjang wishlist terasa makin dekat.', 'Payday just landed. The things on your wishlist feel within reach.') },
    window: { items: ['tote_standard', 'watch_standard', 'liptint_standard', 'candle_standard', 'sunglasses_standard', 'shirt_casual_standard'], reason: bi('Habis cuci mata di mal, ada satu barang yang terus terbayang.', 'After window-shopping, one item keeps coming back to mind.') },
    sale: { items: [], reason: bi('Diskon hari ini saja. Harganya terasa "sayang kalau dilewatkan".', 'Today-only discount. It feels like a waste to miss it.') },
  };
  function maybeUrge(state, trigger, force = false) {
    if (state.urges.length >= 2) return null;
    if (!force && state.urges.some((u) => u.created === E.today(state))) return null;
    const r = E.rng(state, 'urge', trigger);
    const tm = state.mood.temptation;
    if (!force && r() > 0.12 + tm / 220) return null;
    let pool = URGE_POOLS[trigger];
    let items = pool.items;
    if (trigger === 'sale') items = (E.todaysDeals ? E.todaysDeals(state) : []).filter((d) => d.item.need === 'desire').map((d) => d.item.id);
    items = items.filter((id) => RLS.data.catalog.byId[id] && E.isItemAvailable(RLS.data.catalog.byId[id], state) && !state.urges.some((u) => u.itemId === id));
    if (!items.length) return null;
    const itemId = E.pick(r, items);
    const intensity = clamp(Math.round(35 + tm * 0.45 + (r() - 0.5) * 20 + (trigger === 'payday' ? 8 : 0)), 20, 100);
    const urge = { id: 'u' + state.seq++, itemId, trigger, reason: pool.reason, intensity, created: E.today(state), expires: E.today(state) + E.rint(r, 3, 5) };
    state.urges.push(urge);
    const it = RLS.data.catalog.byId[itemId];
    E.notify(state, it.store, bi('Lagi pengin…', 'You really want…'), bi(`${it.name.id} — ${pool.reason.id}`, `${it.name.en} — ${pool.reason.en}`), 'urge', { urgeId: urge.id });
    return urge;
  }
  function morningUrges(state) {
    state.urges = state.urges.filter((u) => u.expires >= E.today(state) && u.intensity > 0).map((u) => ({ ...u, intensity: u.intensity - (u.created === E.today(state) ? 0 : 8) })).filter((u) => u.intensity > 0);
    const a = state.appearance;
    if (state.date.day <= 2 && state.wallet > 0) maybeUrge(state, 'payday');
    else if (a.skin < 52) maybeUrge(state, 'skin');
    else if (a.clothing < 50 || E.today(state) - state.lastClothesAbs > 45) maybeUrge(state, 'wardrobe');
    else if (state.owned.phoneCondition < 40) maybeUrge(state, 'phone');
    else if (state.moodLog.length >= 5 && state.moodLog.slice(-5).reduce((s, x) => s + x.wellbeing, 0) / 5 < 45) maybeUrge(state, 'rough');
    else if (E.todaysDeals && E.todaysDeals(state).some((d) => d.item.need === 'desire')) maybeUrge(state, 'sale');
    else if (E.rng(state, 'social-urge')() < 0.15) maybeUrge(state, 'social');
  }
  function eveningUrges(state) {
    if (state.todayLog.worked && state.mood.stress >= 58) maybeUrge(state, 'stress');
  }
  function resistUrge(state, urgeId) {
    const u = state.urges.find((x) => x.id === urgeId);
    if (!u) return { ok: false };
    u.intensity -= 35;
    applyMood(state, { frustration: 3, temptation: -6, anxiety: -1 });
    state.counters.resisted++;
    if (u.intensity <= 0) state.urges = state.urges.filter((x) => x.id !== urgeId);
    return { ok: true, gone: u.intensity <= 0 };
  }
  /** Put the wanted item on the wishlist and let the urge go for now. */
  function postponeUrge(state, urgeId) {
    const u = state.urges.find((x) => x.id === urgeId);
    if (!u) return { ok: false };
    if (!state.wishlist.includes(u.itemId)) state.wishlist.push(u.itemId);
    state.urges = state.urges.filter((x) => x.id !== urgeId);
    state.counters.postponed++;
    applyMood(state, { temptation: -8, frustration: 1, anxiety: -1 });
    return { ok: true };
  }
  E.postponeUrge = postponeUrge;
  function onItemsBought(state, itemIds) {
    for (const id of itemIds) {
      const u = state.urges.find((x) => x.itemId === id);
      if (!u) continue;
      const it = RLS.data.catalog.byId[id];
      applyMood(state, { happiness: Math.round(4 + it.appeal * 1.2), temptation: -20, stress: -3 });
      state.counters.urgeBought++;
      state.urges = state.urges.filter((x) => x.id !== u.id);
    }
    const tight = state.wallet - E.unpaidBillsTotal(state) < (E.estimateDailyEssentials ? E.estimateDailyEssentials(state) * 7 : rp(300000));
    return { tight };
  }
  Object.assign(E, { URGE_POOLS, maybeUrge, morningUrges, eveningUrges, resistUrge, onItemsBought, rollWeather, freshToday });
})(typeof globalThis !== 'undefined' ? globalThis : this);
