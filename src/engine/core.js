/*
 * engine/core.js — canonical state, money movement, wages, housing,
 * utilities, bills, savings, household, persistence.
 *
 * Other engine modules (life, food, shop, transport, work, finance, travel,
 * day) attach to the same RLS.engine object. The UI never edits the wallet:
 * every debit goes through chargeOrFail, every credit through credit.
 * All money is integer minor units (IDR sen).
 */
(function (root) {
  const RLS = (root.RLS = root.RLS || {});
  const E = (RLS.engine = RLS.engine || {});
  const M = RLS.money;
  const { rp } = M;
  const { bi } = RLS.i18n;
  const D = () => RLS.data;

  const STATE_VERSION = 4;
  E.STATE_VERSION = STATE_VERSION;
  E._inits = E._inits || [];
  E._dayStart = E._dayStart || [];
  E._dayEnd = E._dayEnd || [];

  // ── utilities ───────────────────────────────────────────────────────
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashSeed(...parts) {
    let h = 2166136261;
    for (const ch of parts.join('|')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const daysInMonth = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const weekday = (y, m, d) => new Date(Date.UTC(y, m, d)).getUTCDay();
  const dayNumber = (dt) => Date.UTC(dt.year, dt.month, dt.day) / 86400000;
  function addDays(dt, n) {
    const t = new Date(Date.UTC(dt.year, dt.month, dt.day + n));
    return { year: t.getUTCFullYear(), month: t.getUTCMonth(), day: t.getUTCDate() };
  }
  const fromDayNumber = (n) => { const t = new Date(n * 86400000); return { year: t.getUTCFullYear(), month: t.getUTCMonth(), day: t.getUTCDate() }; };
  const today = (state) => dayNumber(state.date);
  /** Deterministic random stream for (seed, day, tags). Same choices → same outcomes. */
  const rng = (state, ...tags) => mulberry32(hashSeed(state.seed, today(state), ...tags));
  const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];
  const rint = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));

  function isWorkdayDate(workweek, dt) {
    const wd = weekday(dt.year, dt.month, dt.day);
    if (wd === 0) return false;
    if (wd === 6) return workweek === 6;
    return true;
  }
  function isWorkday(state, d = state.date.day) {
    return isWorkdayDate(state.config.workweek, { ...state.date, day: d });
  }
  function workdaysInMonth(year, month, workweek) {
    let n = 0;
    for (let d = 1; d <= daysInMonth(year, month); d++) if (isWorkdayDate(workweek, { year, month, day: d })) n++;
    return n;
  }
  function workdaysBetween(workweek, fromAbs, toAbs) { // inclusive
    let n = 0;
    for (let a = fromAbs; a <= toAbs; a++) if (isWorkdayDate(workweek, fromDayNumber(a))) n++;
    return n;
  }
  function addWorkdays(workweek, fromAbs, n) {
    let a = fromAbs, left = n;
    while (left > 0) { a++; if (isWorkdayDate(workweek, fromDayNumber(a))) left--; }
    return a;
  }
  function dateLabel(dt, long = false) {
    const I = RLS.i18n;
    const wd = weekday(dt.year, dt.month, dt.day);
    return long ? `${I.weekdayLong(wd)}, ${dt.day} ${I.month(dt.month)} ${dt.year}` : `${I.weekday(wd)} ${dt.day} ${I.month(dt.month).slice(0, 3)}`;
  }
  const absLabel = (abs, long) => dateLabel(fromDayNumber(abs), long);

  Object.assign(E, { mulberry32, hashSeed, clamp, daysInMonth, weekday, dayNumber, addDays, fromDayNumber, today, rng, pick, rint,
    isWorkday, isWorkdayDate, workdaysInMonth, workdaysBetween, addWorkdays, dateLabel, absLabel });

  // ── locality & wages ────────────────────────────────────────────────
  function getLocality(cityId) {
    const city = D().indonesia.cityById[cityId];
    if (!city) return null;
    return { city, province: D().indonesia.provinceById[city.provinceId] };
  }
  const citiesForProvince = (provinceId) => D().indonesia.cities.filter((c) => c.provinceId === provinceId);

  function resolveWage(cityId) {
    const loc = getLocality(cityId);
    if (!loc) throw new Error('Unknown locality: ' + cityId);
    const { city, province } = loc;
    const notes = [];
    if (city.wage) {
      if (city.wage.note) notes.push(city.wage.note);
      return { ...city.wage, amount: M.toMinor(city.wage.amountMajor), fallback: false, label: bi(`UMK ${city.name} 2026`, `UMK ${city.name} 2026`), notes };
    }
    const w = province.wage;
    if (province.id === 'dki') notes.push(bi('Jakarta tidak menetapkan UMK. UMP berlaku di kelima kota administrasi.', 'Jakarta sets no city-level minimum wage. The provincial UMP applies across all five administrative cities.'));
    else {
      notes.push(bi(`UMK 2026 untuk ${city.name} belum dimuat di game ini, jadi UMP provinsi dipakai. UMK sebenarnya bisa lebih tinggi.`, `No 2026 UMK for ${city.name} is loaded in this game, so the provincial UMP is used. The real UMK may be higher.`));
      if (city.note) notes.push(city.note);
    }
    if (w.note) notes.push(w.note);
    return { ...w, amount: M.toMinor(w.amountMajor), fallback: province.id !== 'dki', label: bi(`UMP ${province.name} 2026`, `UMP ${province.name} 2026`), notes };
  }

  // PPh 21 effective monthly rates (TER), category A (TK/0, TK/1, K/0). Upper bound (Rp) → basis points.
  const TER_A = [[5400000, 0], [5650000, 25], [5950000, 50], [6300000, 75], [6750000, 100], [7500000, 125], [8550000, 150], [9650000, 175], [10050000, 200], [10350000, 225], [10700000, 250], [11050000, 300], [11600000, 350], [12500000, 400], [13750000, 500], [15100000, 600]];
  const DEDUCTION_RULES = {
    jkn: { label: bi('BPJS Kesehatan (JKN), bagian pekerja', 'BPJS Kesehatan (JKN), worker share'), bp: 100, capMajor: 12000000, sourceId: 'bpjskes_iuran', status: 'VERIFIED' },
    jht: { label: bi('BPJS TK — Jaminan Hari Tua', 'BPJS TK — Old-age savings (JHT)'), bp: 200, capMajor: null, sourceId: 'bpjstk_iuran', status: 'VERIFIED' },
    jp: { label: bi('BPJS TK — Jaminan Pensiun', 'BPJS TK — Pension (JP)'), bp: 100, capMajor: 11086300, sourceId: 'bpjstk_iuran', status: 'VERIFIED',
      note: bi('Batas upah JP 2026 dilaporkan sekitar Rp10,5–11,1 juta; upah minimum tidak mencapainya.', 'The 2026 JP wage ceiling is reported at about Rp10.5–11.1 million; no minimum wage reaches it.') },
  };
  function calculateNetIncome(grossMinor, scenario = 'formal') {
    const items = [];
    if (scenario === 'formal' && grossMinor > 0) {
      for (const [key, r] of Object.entries(DEDUCTION_RULES)) {
        const base = r.capMajor ? Math.min(grossMinor, rp(r.capMajor)) : grossMinor;
        items.push({ key, label: r.label, rateBp: r.bp, amount: M.applyBasisPoints(base, r.bp), status: r.status, sourceId: r.sourceId, note: r.note || null });
      }
      const grossMajor = grossMinor / 100;
      const bracket = TER_A.find(([upper]) => grossMajor <= upper);
      if (bracket) items.push({ key: 'pph21', label: bi('Potongan PPh 21 (TER A, lajang, tanpa tanggungan)', 'PPh 21 withholding (TER A, single, no dependants)'), rateBp: bracket[1], amount: M.applyBasisPoints(grossMinor, bracket[1]), status: 'ESTIMATED', sourceId: 'pph21_ter',
        note: bracket[1] === 0 ? bi('Upah bruto bulanan masih di tarif 0%.', 'Monthly gross is within the 0% band.') : bi('Perkiraan potongan bulanan; rekonsiliasi tahunan di Desember bisa berbeda.', 'Monthly withholding estimate; the December annual reconciliation can differ.') });
      else items.push({ key: 'pph21', label: bi('Potongan PPh 21', 'PPh 21 withholding'), rateBp: null, amount: 0, status: 'UNAVAILABLE', sourceId: 'pph21_ter', note: bi('Tarif untuk penghasilan ini belum dimuat.', 'Rate band not loaded for this income.') });
    }
    const total = items.reduce((s, i) => s + i.amount, 0);
    return { gross: grossMinor, items, totalDeductions: total, net: grossMinor - total, scenario };
  }
  function overtimePay(monthlyMinor, hours) {
    const hourly = monthlyMinor / 173;
    const mult = hours <= 0 ? 0 : 1.5 + Math.max(0, hours - 1) * 2;
    return Math.round(hourly * mult);
  }

  Object.assign(E, { getLocality, citiesForProvince, resolveWage, calculateNetIncome, overtimePay, DEDUCTION_RULES });

  // ── household ───────────────────────────────────────────────────────
  function defaultHousehold() {
    return { partner: false, partnerWorks: false, partnerIncome: rp(0), sharedIncome: true, partnerContribution: rp(0), children: [], childcare: 'family', supportParents: rp(0) };
  }
  const childFactor = (age) => (age < 2 ? 0 : age < 6 ? 0.5 : age < 13 ? 0.75 : 1);
  function household(state) { return (state.config || state).household || defaultHousehold(); }
  function members(cfgOrState) {
    const h = household(cfgOrState);
    const kids = h.children || [];
    return {
      adults: 1 + (h.partner ? 1 : 0), kids: kids.length, infants: kids.filter((k) => k.age < 2).length,
      young: kids.filter((k) => k.age >= 2 && k.age < 6).length, school: kids.filter((k) => k.age >= 6 && k.age <= 17).length,
      people: 1 + (h.partner ? 1 : 0) + kids.length,
      portions: 1 + (h.partner ? 1 : 0) + kids.reduce((s, k) => s + childFactor(k.age), 0),
    };
  }
  function servings(state) { return Math.max(1, Math.ceil(members(state).portions - 1e-9)); }
  Object.assign(E, { defaultHousehold, members, servings, childFactor, household });

  // ── housing ─────────────────────────────────────────────────────────
  const RENT = {
    kost: { A: [900000, 1500000, 2500000], B: [800000, 1300000, 2000000], C: [600000, 950000, 1600000], D: [450000, 700000, 1200000] },
    petak: { A: [1200000, 1800000, 2800000], B: [1000000, 1500000, 2300000], C: [700000, 1100000, 1800000], D: [500000, 800000, 1300000] },
    apartment: { A: [2800000, 3800000, 6000000], B: [2300000, 3200000, 4800000], C: [1800000, 2600000, 4000000], D: null },
  };
  const TIERS = ['budget', 'typical', 'premium'];
  // Capacity: max adults, max children, storage capacity in food portions.
  const CAPACITY = { family: [9, 9, 220], shared: [1, 0, 30], kost: [2, 1, 60], petak: [4, 3, 140], apartment: [3, 2, 110] };

  function housingOptions(cityId, hh) {
    const { city } = getLocality(cityId);
    const t = city.tier;
    const anchor = t === 'A' ? 'kost_jakarta' : t === 'B' ? 'kost_tangerang' : 'game_rent_model';
    const opts = [];
    const lab = (idn, en) => bi(idn, en);
    opts.push({ id: 'family', type: 'family', tier: 'family', label: lab('Tinggal bersama keluarga', 'Live with family'), monthlyRent: 0, deposit: 0,
      includes: { electricity: true, water: true, internet: true }, furnished: true, bathroom: lab('Berbagi dengan keluarga', 'Shared with family'),
      contributionDefault: rp(500000), status: 'ILLUSTRATIVE', sourceId: 'game_assumption', fridge: true,
      note: lab('Tanpa sewa. Kamu menentukan berapa yang kamu berikan untuk kebutuhan rumah tiap bulan.', 'No rent. You choose how much you hand over each month for household costs.') });
    const kostShared = RENT.kost[t].map((v) => Math.round((v * 0.6) / 50000) * 50000);
    opts.push({ id: 'shared_typical', type: 'shared', tier: 'typical', label: lab('Kamar kost berbagi', 'Shared kost room'), monthlyRent: rp(kostShared[1]), deposit: 0,
      includes: { electricity: true, water: true, internet: true }, furnished: true, bathroom: lab('Bersama', 'Shared'),
      status: 'ESTIMATED', sourceId: 'game_rent_model', note: lab('Sewa dibagi dengan satu teman sekamar: ±60% kost biasa.', 'Rent split with one roommate: about 60% of a typical private kost.') });
    const kostInc = [{ electricity: true, water: true, internet: false }, { electricity: false, water: true, internet: true }, { electricity: true, water: true, internet: true }];
    const kostBath = [lab('Bersama', 'Shared'), lab('Dalam', 'Private'), lab('Dalam, dengan AC', 'Private, with AC')];
    const kostDep = [0, 0.5, 1];
    RENT.kost[t].forEach((v, i) => opts.push({
      id: `kost_${TIERS[i]}`, type: 'kost', tier: TIERS[i], label: [lab('Kamar kost sederhana', 'Basic kost room'), lab('Kost kamar mandi dalam', 'Kost room, private bathroom'), lab('Kost dengan AC', 'Kost room with AC')][i],
      monthlyRent: rp(v), deposit: rp(Math.round(v * kostDep[i])), includes: kostInc[i], furnished: true, bathroom: kostBath[i], ac: i === 2, fridge: i === 2,
      status: 'ESTIMATED', sourceId: i === 1 ? anchor : 'game_rent_model',
      note: i === 1 && t === 'A' ? lab('Dekat rata-rata kost putra di Jakarta versi Mamikos (Rp1,49 juta); kost putri rata-rata lebih tinggi (Rp2,0 juta).', 'Close to the Mamikos average for men\'s kost in Jakarta (Rp1.49m); women\'s kost averages higher (Rp2.0m).')
        : i === 1 && t === 'B' ? lab('Di bawah Rp1,8–2 juta yang dilaporkan Mamikos untuk kost ber-AC + Wi-Fi di Tangerang; yang ini tanpa AC.', 'Below the Rp1.8–2m Mamikos reports for an AC + Wi-Fi kost in Tangerang; this one has no AC.') : null,
    }));
    RENT.petak[t].forEach((v, i) => opts.push({ id: `petak_${TIERS[i]}`, type: 'petak', tier: TIERS[i], label: lab('Kontrakan petak', 'Rented row house (kontrakan petak)'),
      monthlyRent: rp(v), deposit: rp(v), includes: { electricity: false, water: false, internet: false }, furnished: false, bathroom: lab('Dalam', 'Private'),
      status: 'ESTIMATED', sourceId: 'game_rent_model', note: lab('Tanpa perabot. Banyak pemilik meminta beberapa bulan di muka; di game ini satu bulan sebagai deposit.', 'Unfurnished. Many landlords ask for several months up front; this game asks for one month as deposit.') }));
    if (RENT.apartment[t]) RENT.apartment[t].forEach((v, i) => opts.push({ id: `apartment_${TIERS[i]}`, type: 'apartment', tier: TIERS[i], label: lab('Apartemen studio', 'Studio apartment'),
      monthlyRent: rp(v), deposit: rp(v), includes: { electricity: false, water: false, internet: false }, furnished: true, bathroom: lab('Dalam', 'Private'), ac: true, fridge: i > 0,
      status: 'ESTIMATED', sourceId: 'game_rent_model', note: lab('Biaya IPL diasumsikan sudah termasuk sewa.', 'Service charge (IPL) assumed inside the rent.') }));
    if (hh) {
      const mem = members({ household: hh });
      for (const o of opts) {
        const [maxA, maxK] = CAPACITY[o.type];
        o.fits = mem.adults <= maxA && mem.kids <= maxK;
        o.capacity = CAPACITY[o.type][2];
      }
    }
    for (const o of opts) o.capacity = CAPACITY[o.type][2];
    return opts;
  }
  const getHousing = (cityId, housingId) => housingOptions(cityId).find((h) => h.id === housingId) || null;
  const curHousing = (state) => getHousing(state.config.cityId, state.config.housingId);
  function calculateMonthlyRent(config) {
    const h = getHousing(config.cityId, config.housingId);
    if (!h) return 0;
    return h.type === 'family' ? config.familyContribution ?? h.contributionDefault : h.monthlyRent;
  }
  function planMove(state, housingId) {
    const h = housingOptions(state.config.cityId, state.config.household).find((x) => x.id === housingId);
    if (!h) return { ok: false, error: 'unknown_housing' };
    if (h.fits === false) return { ok: false, error: 'too_small' };
    state.pendingMove = housingId === state.config.housingId ? null : housingId;
    return { ok: true };
  }
  Object.assign(E, { housingOptions, getHousing, curHousing, calculateMonthlyRent, planMove, CAPACITY });

  // ── electricity & utilities ─────────────────────────────────────────
  const TARIFFS = {
    '450s': { label: 'R-1/TR 450 VA (subsidi)', major: '415', subsidised: true },
    '900s': { label: 'R-1/TR 900 VA (subsidi)', major: '605', subsidised: true },
    '900': { label: 'R-1/TR 900 VA RTM', major: '1352' },
    '1300': { label: 'R-1/TR 1.300 VA', major: '1444.70' },
    '2200': { label: 'R-1/TR 2.200 VA', major: '1444.70' },
  };
  const KWH = { ac: { none: 0, occasional: 24, nightly: 96, heavy: 168 }, fridge: 30, cooking: 25, washer: { none: 0, shared: 4, private: 8 }, tv: 10, fan: 8 };
  const ADMIN_FEE = rp(2500);
  const TOKEN_NOMINALS = [20000, 50000, 100000, 200000, 500000].map(rp);
  const WATER_BILL_DEFAULT = rp(70000);
  const defaultElectricity = () => ({ tariff: '900', ac: 'none', electricCooking: false, washer: 'shared', tv: false, meter: 'prepaid' });

  /** Owned appliances come from state.owned; profile choices from config.electricity. */
  function electricityProfile(state) {
    const c = state.config.electricity;
    const o = (state.owned && state.owned.items) || {};
    return { ...c, fridge: !!o.fridge, fan: !!o.fan, electricCooking: !!(c.electricCooking && o.ricecooker), occupants: members(state).people };
  }
  function estimateElectricity(profile, ppjBp = 300) {
    const lines = [];
    const base = 25 + 5 * Math.max(0, (profile.occupants || 1) - 1);
    lines.push([bi('Lampu, kipas kecil, isi daya ponsel & laptop', 'Lights, small fan, phone and laptop charging'), base]);
    if (KWH.ac[profile.ac]) lines.push([bi(`AC (${profile.ac})`, `Air conditioner (${profile.ac})`), KWH.ac[profile.ac]]);
    if (profile.fridge) lines.push([bi('Kulkas kecil', 'Small refrigerator'), KWH.fridge]);
    if (profile.fan) lines.push([bi('Kipas angin berdiri', 'Standing fan'), KWH.fan]);
    if (profile.electricCooking) lines.push([bi('Rice cooker & ketel listrik', 'Rice cooker and electric kettle'), KWH.cooking]);
    if (KWH.washer[profile.washer]) lines.push([bi(`Mesin cuci (${profile.washer})`, `Washing machine (${profile.washer})`), KWH.washer[profile.washer]]);
    if (profile.tv) lines.push([bi('Televisi', 'Television'), KWH.tv]);
    const kwh = lines.reduce((s, l) => s + l[1], 0);
    const tariff = TARIFFS[profile.tariff] || TARIFFS['900'];
    const tariffMinor = M.toMinor(tariff.major);
    const energy = Math.round(kwh * tariffMinor);
    const ppj = M.applyBasisPoints(energy, ppjBp);
    return { kwh, lines, tariffKey: profile.tariff, tariffLabel: tariff.label, tariffMinor, energy, ppj, admin: ADMIN_FEE, total: energy + ppj + ADMIN_FEE, dailyKwh: kwh / 30, status: 'ESTIMATED', sourceId: 'pln_2026' };
  }
  function tokenBreakdown(nominalMinor, tariffKey, ppjBp = 300) {
    const tariffMinor = M.toMinor((TARIFFS[tariffKey] || TARIFFS['900']).major);
    const afterAdmin = Math.max(0, nominalMinor - ADMIN_FEE);
    const energyValue = Math.round((afterAdmin * 10000) / (10000 + ppjBp));
    const ppj = afterAdmin - energyValue;
    return { nominal: nominalMinor, admin: ADMIN_FEE, ppj, energyValue, kwh: energyValue / tariffMinor, tariffMinor };
  }
  Object.assign(E, { TARIFFS, TOKEN_NOMINALS, ADMIN_FEE, defaultElectricity, electricityProfile, estimateElectricity, tokenBreakdown });

  // ── pricing ─────────────────────────────────────────────────────────
  function priceOf(item, config) {
    const adj = (config && config.priceAdjustBp) || 0;
    if (!adj) return item.price;
    return M.roundTo(item.price + M.applyBasisPoints(item.price, adj), rp(100));
  }
  const priceStatus = (item, config) => ((config && config.priceAdjustBp) && item.status === 'VERIFIED' ? 'ESTIMATED' : item.status);
  Object.assign(E, { priceOf, priceStatus });

  // ── transactions & notifications ────────────────────────────────────
  const stamp = (state) => ({ month: state.monthIndex, day: state.date.day, y: state.date.year, m: state.date.month, abs: today(state) });
  function pushTx(state, tx) {
    const full = { id: 'tx' + state.seq++, ...stamp(state), currency: 'IDR', status: 'completed', items: null, split: null, note: null, ...tx };
    full.balanceAfter = state.wallet;
    state.transactions.unshift(full);
    if (state.transactions.length > 1500) state.transactions.length = 1500;
    return full;
  }
  /**
   * The single debit path. Validates, then either deducts and records a completed
   * transaction, or records a failed attempt and deducts nothing.
   */
  function chargeOrFail(state, { merchant, category, cls, amount, note, items, split, quiet }) {
    if (!Number.isInteger(amount) || amount < 0) return { ok: false, error: 'invalid_amount' };
    if (amount > state.wallet) {
      const tx = pushTx(state, { merchant, category, cls, amount: -amount, status: 'failed', note: [note, bi('Ditolak: saldo tidak cukup', 'Declined: not enough balance')].filter(Boolean), items, split });
      if (!quiet) notify(state, 'bank', bi('Pembayaran ditolak', 'Payment declined'), bi(`${RLS.i18n.L(merchant)}: ${M.format(amount)}. Saldo kamu ${M.format(state.wallet)}.`, `${(merchant && merchant.en) || merchant}: ${M.format(amount)}. Your balance is ${M.format(state.wallet)}.`), 'warn');
      if (E.moodOnDeclined) E.moodOnDeclined(state);
      return { ok: false, error: 'insufficient_funds', tx, shortBy: amount - state.wallet };
    }
    state.wallet -= amount;
    return { ok: true, tx: pushTx(state, { merchant, category, cls, amount: -amount, note, items, split }) };
  }
  function credit(state, { merchant, category, cls, amount, note, split }) {
    state.wallet += amount;
    return pushTx(state, { merchant, category, cls, amount, note, split });
  }
  function notify(state, app, title, body, tone = 'info', extra = {}) {
    state.notifications.unshift({ id: 'n' + state.seq++, app, title, body, tone, ...stamp(state), read: false, ...extra });
    if (state.notifications.length > 150) state.notifications.length = 150;
  }
  const CAT = {
    salary: bi('Gaji', 'Salary'), housing: bi('Tempat tinggal', 'Housing'), utilities: bi('Utilitas', 'Utilities'), transport: bi('Transportasi', 'Transport'),
    groceries: bi('Belanja dapur', 'Groceries'), food: bi('Makan di luar & antar', 'Eating out & delivery'), shopping: bi('Belanja', 'Shopping'), beauty: bi('Perawatan diri', 'Personal care'),
    health: bi('Kesehatan', 'Health'), leisure: bi('Hiburan', 'Leisure'), phone: bi('Ponsel & internet', 'Phone & internet'), subs: bi('Langganan', 'Subscriptions'),
    savings: bi('Tabungan', 'Savings'), unexpected: bi('Tak terduga', 'Unexpected'), extra: bi('Pendapatan tambahan', 'Extra income'), family: bi('Keluarga', 'Family'),
    loan: bi('Pinjaman', 'Loans'), docs: bi('Dokumen & administrasi', 'Documents & admin'), travel: bi('Perjalanan', 'Travel'), work: bi('Kerja', 'Work'), refund: bi('Pengembalian dana', 'Refund'),
    benefit: bi('Jaminan sosial', 'Social security'), household: bi('Pendapatan rumah tangga', 'Household income'),
  };
  Object.assign(E, { pushTx, chargeOrFail, credit, notify, CAT, stamp });

  // ── bills ──────────────────────────────────────────────────────────
  function addBill(state, b) {
    const bill = { id: `${state.monthIndex}-${b.key}`, month: state.monthIndex, status: 'pending', autopay: false, paidDay: null, mandatory: true, adjustable: false, ...b };
    if (state.bills.some((x) => x.id === bill.id)) return null; // never create the same bill twice
    state.bills.push(bill);
    return bill;
  }
  const billsThisMonth = (state) => state.bills.filter((b) => b.month === state.monthIndex);

  function generateMonthlyBills(state) {
    const c = state.config;
    const h = curHousing(state);
    const hh = household(state);
    const mem = members(state);
    if (h.type === 'family') {
      if (c.familyContribution > 0) addBill(state, { key: 'family', label: bi('Kontribusi untuk rumah keluarga', 'Contribution to the family household'), category: 'housing', amount: c.familyContribution, dueDay: 5, adjustable: true });
    } else addBill(state, { key: 'rent', label: bi(`Sewa — ${h.label.id}`, `Rent — ${h.label.en}`), category: 'housing', amount: h.monthlyRent, dueDay: 5 });
    if (!h.includes.electricity && c.electricity.meter === 'postpaid') {
      const est = estimateElectricity(electricityProfile(state), c.ppjBp);
      const kwh = state.electricity.lastMonthKwh ?? est.kwh;
      const energy = Math.round(kwh * est.tariffMinor);
      addBill(state, { key: 'electricity', label: bi(`PLN pascabayar (${Math.round(kwh)} kWh)`, `PLN postpaid (${Math.round(kwh)} kWh)`), category: 'utilities', amount: energy + M.applyBasisPoints(energy, c.ppjBp) + ADMIN_FEE, dueDay: 20 });
    }
    if (!h.includes.water) addBill(state, { key: 'water', label: bi('Air PDAM', 'Water utility (PDAM)'), category: 'utilities', amount: c.waterBill + Math.max(0, mem.people - 1) * rp(20000), dueDay: 20, adjustable: true });
    if (state.homeInternet && !h.includes.internet) {
      const plan = D().connect.homeInternet.find((x) => x.id === state.homeInternet);
      if (plan) addBill(state, { key: 'internet', label: plan.name, category: 'phone', amount: plan.price, dueDay: 20, adjustable: true });
    }
    if (!E.hasJknViaWork || !E.hasJknViaWork(state)) {
      if (c.jknMandiri) addBill(state, { key: 'jkn', label: bi(`BPJS Kesehatan mandiri kelas 3 (${mem.people} orang)`, `BPJS Kesehatan, independent class 3 (${mem.people} people)`), category: 'health', amount: rp(35000) * mem.people, dueDay: 10, adjustable: true });
    }
    const plan = E.currentCommutePlan ? E.currentCommutePlan(state) : null;
    if (plan && plan.monthlyFixed) addBill(state, { key: 'motorcycle', label: bi('Pajak & servis motor' + (c.motorcycleCredit ? ' + cicilan' : ''), 'Motorcycle tax & servicing' + (c.motorcycleCredit ? ' + instalment' : '')), category: 'transport', amount: plan.monthlyFixed, dueDay: 15 });
    // family costs (ILLUSTRATIVE)
    const { city } = getLocality(c.cityId);
    const schoolCost = { 6: 200000, 12: 300000, 15: 400000 };
    hh.children.forEach((k, i) => {
      if (k.age >= 6 && k.age <= 17) {
        const base = k.age <= 12 ? schoolCost[6] : k.age <= 15 ? schoolCost[12] : schoolCost[15];
        addBill(state, { key: `school-${i}`, label: bi(`Kebutuhan sekolah anak ${i + 1} (seragam, buku, uang jajan, antar-jemput)`, `School costs for child ${i + 1} (uniform, books, pocket money, transport)`), category: 'family', amount: rp(base), dueDay: 3, adjustable: true,
          note: bi('SPP sekolah negeri umumnya gratis; ini biaya lain-lain (ilustratif).', 'Public school tuition is generally free; these are the other costs (illustrative).') });
      }
      if (k.age < 6 && hh.childcare === 'daycare') {
        const care = { A: 1500000, B: 1200000, C: 900000, D: 700000 }[city.tier];
        addBill(state, { key: `childcare-${i}`, label: bi(`Penitipan anak ${i + 1}`, `Childcare for child ${i + 1}`), category: 'family', amount: rp(care), dueDay: 3, adjustable: true });
      }
    });
    if (hh.children.some((k) => k.age < 6) && hh.childcare === 'family') addBill(state, { key: 'childcare-thanks', label: bi('Uang terima kasih untuk keluarga yang menjaga anak', 'Thank-you money for family minding the children'), category: 'family', amount: rp(250000), dueDay: 3, adjustable: true });
    if (hh.supportParents > 0) addBill(state, { key: 'parents', label: bi('Kirim uang untuk orang tua', 'Money for your parents'), category: 'family', amount: hh.supportParents, dueDay: 5, adjustable: true });
    if (E.loanBillsForMonth) E.loanBillsForMonth(state);
    // carry unpaid bills from last month as arrears
    for (const old of state.bills.filter((b) => b.month === state.monthIndex - 1 && b.status !== 'paid' && !b.carried)) {
      old.carried = true;
      if (old.loanId) continue; // loan arrears are tracked by the loan itself
      const late = old.key === 'rent' || old.key === 'electricity' ? rp(50000) : 0;
      addBill(state, { key: 'arrears-' + old.key, label: bi(`Tunggakan bulan lalu: ${RLS.i18n.L(old.label)}`, `Overdue from last month: ${old.label.en || old.label}`), category: old.category, amount: old.amount + late, lateFee: late, dueDay: 1, arrears: true });
    }
  }

  function processBillPayment(state, billId, opts = {}) {
    const bill = state.bills.find((b) => b.id === billId);
    if (!bill) return { ok: false, error: 'unknown_bill' };
    if (bill.status === 'paid') return { ok: false, error: 'already_paid' };
    if (bill.month < state.monthIndex && bill.carried && !bill.loanId) return { ok: false, error: 'carried_forward' };
    const split = bill.loanId ? { principal: bill.principal, interest: bill.amount - bill.principal } : null;
    const res = chargeOrFail(state, { merchant: bill.label, category: bill.category, cls: bill.loanId ? 'loan_repay' : 'mandatory', amount: bill.amount, note: bi(`Tagihan jatuh tempo tgl ${bill.dueDay}`, `Bill due on day ${bill.dueDay}`), split, quiet: opts.quiet });
    if (!res.ok) return res;
    bill.status = 'paid';
    bill.paidDay = state.date.day;
    if (bill.loanId && E.onLoanBillPaid) E.onLoanBillPaid(state, bill);
    if (E.moodOnBillPaid) E.moodOnBillPaid(state, bill);
    return { ok: true, tx: res.tx };
  }
  function setAutopay(state, billId, on) {
    const bill = state.bills.find((b) => b.id === billId);
    if (bill && !bill.forcedAutopay) bill.autopay = !!on;
  }
  function unpaidBillsTotal(state) { return billsThisMonth(state).filter((b) => b.status !== 'paid').reduce((s, b) => s + b.amount, 0); }
  Object.assign(E, { addBill, billsThisMonth, generateMonthlyBills, processBillPayment, setAutopay, unpaidBillsTotal });

  // ── utilities actions ───────────────────────────────────────────────
  function buyToken(state, nominalMinor) {
    const c = state.config;
    const h = curHousing(state);
    if (h.includes.electricity) return { ok: false, error: 'included_in_rent' };
    if (c.electricity.meter !== 'prepaid') return { ok: false, error: 'postpaid_meter' };
    const b = tokenBreakdown(nominalMinor, c.electricity.tariff, c.ppjBp);
    const res = chargeOrFail(state, { merchant: bi('Token listrik PLN', 'PLN prepaid token'), category: 'utilities', cls: 'essential', amount: nominalMinor, note: bi(`${b.kwh.toFixed(1)} kWh setelah biaya admin & PPJ`, `${b.kwh.toFixed(1)} kWh after admin fee and PPJ`) });
    if (!res.ok) return res;
    state.electricity.kwhBalance += b.kwh;
    return { ok: true, kwh: b.kwh, tx: res.tx };
  }
  function buyDataPlan(state, planId) {
    const plan = D().connect.dataPlans.find((p) => p.id === planId);
    if (!plan) return { ok: false, error: 'unknown_plan' };
    const res = chargeOrFail(state, { merchant: bi('Paket data seluler', 'Mobile data'), category: 'phone', cls: 'essential', amount: plan.price, note: plan.name });
    if (!res.ok) return res;
    const base = state.dataPlanUntil && dayNumber(state.dataPlanUntil) >= today(state) ? state.dataPlanUntil : state.date;
    state.dataPlanUntil = addDays(base, plan.days);
    return { ok: true, tx: res.tx };
  }
  function repairPhone(state, deviceId) {
    const dev = D().connect.devices.find((p) => p.id === deviceId);
    if (!dev) return { ok: false, error: 'unknown_device' };
    const res = chargeOrFail(state, { merchant: bi('Konter HP', 'Phone counter'), category: 'phone', cls: 'essential', amount: dev.price, note: dev.name });
    if (res.ok) state.owned.phoneCondition = Math.max(state.owned.phoneCondition, 85);
    return res;
  }
  function setHomeInternet(state, planId) {
    state.homeInternet = planId || null;
    if (planId) {
      const plan = D().connect.homeInternet.find((x) => x.id === planId);
      if (plan && !billsThisMonth(state).some((b) => b.key === 'internet')) addBill(state, { key: 'internet', label: plan.name, category: 'phone', amount: plan.price, dueDay: Math.min(daysInMonth(state.date.year, state.date.month), state.date.day + 2), adjustable: true });
    }
  }
  function hasWifi(state) {
    const h = curHousing(state);
    if (h.includes.internet) return true;
    if (!state.homeInternet) return false;
    const bill = state.bills.find((b) => b.key === 'internet' && b.month === state.monthIndex);
    return !bill || bill.status === 'paid' || state.date.day <= bill.dueDay;
  }
  const hasMobileData = (state) => !!state.dataPlanUntil && dayNumber(state.dataPlanUntil) >= today(state);
  const isOnline = (state) => (hasWifi(state) || hasMobileData(state)) && state.owned.phoneCondition > 0;
  function electricityOn(state) {
    const h = curHousing(state);
    if (h.includes.electricity) return true;
    if (state.config.electricity.meter === 'postpaid') {
      const overdue = state.bills.find((b) => (b.key === 'electricity' || b.key === 'arrears-electricity') && b.status !== 'paid' && b.month === state.monthIndex && b.arrears && state.date.day > 10);
      return !overdue;
    }
    return state.electricity.kwhBalance > 0;
  }
  Object.assign(E, { buyToken, buyDataPlan, repairPhone, setHomeInternet, hasWifi, hasMobileData, isOnline, electricityOn, WATER_BILL_DEFAULT });

  // ── subscriptions ───────────────────────────────────────────────────
  function subscribe(state, subId) {
    const sub = D().subscriptions.find((s) => s.id === subId);
    if (!sub || state.subscriptions.some((s) => s.id === subId && s.active)) return { ok: false, error: 'invalid' };
    const res = chargeOrFail(state, { merchant: sub.name, category: 'subs', cls: 'discretionary', amount: sub.price, note: bi('Bulan pertama', 'First month') });
    if (!res.ok) return res;
    const existing = state.subscriptions.find((s) => s.id === subId);
    const renewDay = Math.min(state.date.day, 28);
    if (existing) Object.assign(existing, { active: true, renewDay, lastChargedMonth: state.monthIndex });
    else state.subscriptions.push({ id: subId, active: true, renewDay, lastChargedMonth: state.monthIndex });
    if (E.applyMood) E.applyMood(state, sub.mood);
    state.counters.optionalBought++;
    return { ok: true, tx: res.tx };
  }
  function cancelSubscription(state, subId) { const s = state.subscriptions.find((x) => x.id === subId); if (s) s.active = false; }
  Object.assign(E, { subscribe, cancelSubscription });

  // ── savings ─────────────────────────────────────────────────────────
  function processSavingsTransfer(state, amount, direction = 'in', goalId = 'emergency') {
    if (!Number.isInteger(amount) || amount <= 0) return { ok: false, error: 'invalid_amount' };
    const goal = state.goals.find((g) => g.id === goalId);
    if (!goal) return { ok: false, error: 'unknown_goal' };
    if (direction === 'in') {
      if (amount > state.wallet) return { ok: false, error: 'insufficient_funds' };
      state.wallet -= amount; state.savings += amount; goal.saved += amount;
      return { ok: true, tx: pushTx(state, { merchant: bi(`FutureMe · ${goal.name.id || goal.name}`, `FutureMe · ${goal.name.en || goal.name}`), category: 'savings', cls: 'savings_in', amount: -amount, note: bi('Pindah ke tabungan (bukan pengeluaran)', 'Transfer to savings (not spending)') }) };
    }
    if (amount > goal.saved) return { ok: false, error: 'insufficient_savings' };
    goal.saved -= amount; state.savings -= amount; state.wallet += amount;
    return { ok: true, tx: pushTx(state, { merchant: bi(`FutureMe · ${goal.name.id || goal.name}`, `FutureMe · ${goal.name.en || goal.name}`), category: 'savings', cls: 'savings_out', amount, note: bi('Tarik dari tabungan (bukan pendapatan)', 'Withdrawal from savings (not income)') }) };
  }
  function addGoal(state, name, targetMinor, kind = 'custom') {
    const id = 'g' + state.seq++;
    state.goals.push({ id, name, target: targetMinor, saved: 0, kind });
    return id;
  }
  Object.assign(E, { processSavingsTransfer, addGoal });

  // ── config, character, creation ─────────────────────────────────────
  function defaultCharacter() {
    return { age: 23, gender: 'female', menstruates: true, education: 'sma', experienceYears: 0, skills: ['customer'], certs: [], english: 'basic', otherLang: 'regional', digital: 'intermediate' };
  }
  function defaultConfig(overrides = {}) {
    const base = {
      countryId: 'id', provinceId: 'banten', cityId: 'tangsel',
      scenario: 'formal', wageTreatment: 'net', workweek: 5, distanceKm: 12,
      housingId: 'kost_typical', depositPaid: true, familyContribution: rp(500000),
      difficulty: 'normal', priceAdjustBp: 0, ppjBp: 300,
      electricity: defaultElectricity(), waterBill: WATER_BILL_DEFAULT,
      commutePlanId: null, ride: { provider: 'gesit', tier: 'standard' }, fareLevel: 'mid', customBusFare: null, motorcycleCredit: false,
      jknMandiri: false, groceryBudget: rp(1000000), startYear: 2026, startMonth: 10,
      character: defaultCharacter(), household: defaultHousehold(),
      startEmployed: true, startJobId: 'retail', tenureMonths: 4, startingSavings: rp(0),
      passport: { has: false, type: 'e10', yearsLeft: 6 }, ownsFridge: false, ownsRiceCooker: true, ownsFan: true,
    };
    const cfg = { ...base, ...overrides };
    cfg.character = { ...defaultCharacter(), ...(overrides.character || {}) };
    cfg.household = { ...defaultHousehold(), ...(overrides.household || {}) };
    cfg.electricity = { ...defaultElectricity(), ...(overrides.electricity || {}) };
    cfg.ride = { ...base.ride, ...(overrides.ride || {}) };
    cfg.passport = { ...base.passport, ...(overrides.passport || {}) };
    return cfg;
  }
  function freshCounters() {
    return { missedMeals: 0, missedWork: 0, outageDays: 0, optionalBought: 0, postponed: 0, skipped: 0, eventsSeen: 0, resisted: 0, urgeBought: 0,
      sickDays: 0, lateDays: 0, freeActivities: 0, paidActivities: 0, cooked: 0, boughtMeals: 0, applications: 0, rejections: 0, interviews: 0, offers: 0, rides: 0 };
  }

  function createGame(configIn, seed) {
    const config = defaultConfig(configIn);
    const loc = getLocality(config.cityId);
    if (!loc) throw new Error('Unknown locality');
    config.provinceId = loc.province.id;
    const opts = housingOptions(config.cityId, config.household);
    if (!opts.some((o) => o.id === config.housingId && o.fits !== false)) config.housingId = (opts.find((o) => o.fits !== false && o.type !== 'family') || opts[0]).id;
    const s = (seed >>> 0) || hashSeed(config.cityId, Date.now());
    const state = {
      version: STATE_VERSION, seed: s, config,
      date: { year: config.startYear, month: config.startMonth, day: 1 },
      startAbs: dayNumber({ year: config.startYear, month: config.startMonth, day: 1 }),
      monthIndex: 1, phase: 'play',
      wallet: 0, savings: 0,
      goals: [{ id: 'emergency', name: bi('Dana darurat', 'Emergency fund'), target: 0, saved: 0, kind: 'emergency' }],
      transactions: [], bills: [], notifications: [], eventsLog: [], activeEvent: null, eventQueue: [],
      electricity: { kwhBalance: 8, kwhUsedMonth: 0, lastMonthKwh: null },
      dataPlanUntil: null, homeInternet: null, pendingMove: null, subscriptions: [],
      owned: { items: {}, phoneCondition: 70, raincoat: false, umbrella: false },
      wishlist: [], counters: freshCounters(), reports: [], monthStart: { wallet: 0, savings: 0, debt: 0 },
      seq: 1,
    };
    if (config.ownsFridge || opts.find((o) => o.id === config.housingId).fridge) state.owned.items.fridge = { condition: 100 };
    if (config.ownsRiceCooker) state.owned.items.ricecooker = { condition: 100 };
    if (config.ownsFan) state.owned.items.fan = { condition: 100 };
    for (const init of E._inits) init(state);
    const h = curHousing(state);
    state.goals[0].target = Math.round(((h.type === 'family' ? config.familyContribution : h.monthlyRent) + rp(1000000)) / rp(100000)) * rp(100000);
    if (config.startingSavings > 0) {
      state.savings = config.startingSavings;
      state.goals[0].saved = config.startingSavings;
      pushTx(state, { merchant: bi('Tabungan awal', 'Opening savings'), category: 'savings', cls: 'opening', amount: 0, note: bi(`Tabungan yang sudah ada: ${M.format(config.startingSavings)}`, `Existing savings: ${M.format(config.startingSavings)}`) });
    }
    E.payday(state);
    if (!config.depositPaid && h.deposit > 0) chargeOrFail(state, { merchant: bi('Pemilik kost/kontrakan', 'Landlord'), category: 'housing', cls: 'upfront', amount: h.deposit, note: bi('Deposit pindahan (sekali bayar, biasanya kembali saat pindah)', 'Move-in deposit (one-off, usually refundable when you move out)') });
    generateMonthlyBills(state);
    state.monthStart = { wallet: 0, savings: state.savings, debt: E.debtOutstanding ? E.debtOutstanding(state) : 0, abs: state.startAbs };
    E.startOfDay(state, { first: true });
    return state;
  }
  /** Change player settings (never money). Nested objects are merged. */
  function updateConfig(state, patch) {
    for (const [k, v] of Object.entries(patch)) {
      if (v && typeof v === 'object' && !Array.isArray(v) && state.config[k] && typeof state.config[k] === 'object') state.config[k] = { ...state.config[k], ...v };
      else state.config[k] = v;
    }
    return state.config;
  }
  Object.assign(E, { defaultConfig, defaultCharacter, freshCounters, createGame, updateConfig });

  // ── persistence & migration ─────────────────────────────────────────
  const serialize = (state) => JSON.stringify(state);
  function deserialize(json) {
    let s;
    try { s = JSON.parse(json); } catch { return null; }
    if (!s) return null;
    if (s.version === STATE_VERSION) return s;
    if (s.version === 3) return migrateV3(s);
    return null;
  }
  /** v3 (first release) → v4. Keeps money, bills, transactions, savings and the calendar. */
  function migrateV3(old) {
    const cfg = defaultConfig({
      ...old.config,
      character: defaultCharacter(),
      household: old.config.household === 'dependent' ? { ...defaultHousehold(), children: [{ age: 2 }], childcare: 'family' } : defaultHousehold(),
      ride: { provider: 'gesit', tier: 'standard' }, startEmployed: true, startJobId: 'retail', tenureMonths: 4,
    });
    delete cfg.familyDinner;
    if (['ojol_motor', 'ojol_car'].includes(cfg.commutePlanId)) cfg.commutePlanId = 'ojol';
    const fresh = createGame({ ...cfg }, old.seed);
    const keep = ['seed', 'date', 'monthIndex', 'phase', 'wallet', 'savings', 'goals', 'bills', 'transactions', 'notifications', 'eventsLog', 'electricity', 'dataPlanUntil', 'homeInternet', 'pendingMove', 'subscriptions', 'wishlist', 'reports', 'lastReport', 'seq'];
    for (const k of keep) if (old[k] !== undefined) fresh[k] = old[k];
    fresh.activeEvent = null;
    fresh.version = STATE_VERSION;
    fresh.startAbs = dayNumber({ year: old.config.startYear, month: old.config.startMonth, day: 1 });
    fresh.goals = fresh.goals.map((g) => ({ ...g, name: typeof g.name === 'string' ? bi(g.name === 'Emergency fund' ? 'Dana darurat' : g.name, g.name) : g.name }));
    // pantry → food batches
    const p = old.pantry || {}, sup = old.supplies || {};
    fresh.food.batches = [];
    if (E.addFoodBatch) {
      if (p.staple) E.addFoodBatch(fresh, { itemId: 'rice_medium_5', type: 'rice', qty: p.staple, unitValue: rp(1347) });
      if (p.side) E.addFoodBatch(fresh, { itemId: 'eggs_1kg', type: 'egg', qty: p.side, unitValue: rp(1940) });
      if (p.complete) E.addFoodBatch(fresh, { itemId: 'noodle_fried', type: 'noodle', qty: p.complete, unitValue: rp(3500) });
    }
    Object.assign(fresh.supplies, { water: sup.water ?? 2, soap: sup.soap ?? 5, shampoo: sup.shampoo ?? 4, toothpaste: sup.toothpaste ?? 6, laundry: sup.laundry ?? 3, dish: sup.dish ?? 5, gasMeals: sup.gasMeals ?? 10, baby: sup.baby ?? 0 });
    if (fresh.mood && old.wellbeing != null) fresh.mood.wellbeing = old.wellbeing;
    fresh.counters = { ...freshCounters(), ...(old.counters || {}) };
    fresh.migratedFrom = 3;
    return fresh;
  }
  Object.assign(E, { serialize, deserialize, migrateV3 });
})(typeof globalThis !== 'undefined' ? globalThis : this);
