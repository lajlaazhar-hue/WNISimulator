/*
 * engine.js — the simulation engine.
 *
 * Owns the canonical game state and every operation that moves money.
 * The UI reads state and calls these functions; it never edits the wallet.
 * All money is integer minor units (see money.js).
 */
(function (root) {
  const RLS = (root.RLS = root.RLS || {});
  const M = RLS.money;
  const { rp } = M;
  const D = () => RLS.data;

  const STATE_VERSION = 3;

  // ────────────────────────────────────────────────────────────────────
  // Utilities
  // ────────────────────────────────────────────────────────────────────
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
  const weekday = (y, m, d) => new Date(Date.UTC(y, m, d)).getUTCDay(); // 0 = Sunday
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function isWorkday(state, d = state.date.day) {
    const wd = weekday(state.date.year, state.date.month, d);
    if (wd === 0) return false;
    if (wd === 6) return state.config.workweek === 6;
    return true;
  }
  function workdaysInMonth(year, month, workweek) {
    let n = 0;
    for (let d = 1; d <= daysInMonth(year, month); d++) {
      const wd = weekday(year, month, d);
      if (wd === 0) continue;
      if (wd === 6 && workweek !== 6) continue;
      n++;
    }
    return n;
  }

  // ────────────────────────────────────────────────────────────────────
  // Locality & wages
  // ────────────────────────────────────────────────────────────────────
  function getLocality(cityId) {
    const city = D().indonesia.cityById[cityId];
    if (!city) return null;
    return { city, province: D().indonesia.provinceById[city.provinceId] };
  }
  function citiesForProvince(provinceId) {
    return D().indonesia.cities.filter((c) => c.provinceId === provinceId);
  }

  /** Which wage applies to a locality, with the reason. */
  function resolveWage(cityId) {
    const loc = getLocality(cityId);
    if (!loc) throw new Error('Unknown locality: ' + cityId);
    const { city, province } = loc;
    const notes = [];
    if (city.wage) {
      if (city.wage.note) notes.push(city.wage.note);
      return {
        ...city.wage, amount: M.toMinor(city.wage.amountMajor), fallback: false,
        label: `UMK ${city.name} 2026`, notes,
      };
    }
    const w = province.wage;
    if (province.id === 'dki') notes.push('Jakarta has no city-level minimum wage. The provincial UMP applies across all five administrative cities.');
    else {
      notes.push(`No 2026 UMK for ${city.name} is loaded in this game, so the provincial UMP is used. The real UMK may be higher.`);
      if (city.note) notes.push(city.note);
    }
    if (w.note) notes.push(w.note);
    return {
      ...w, amount: M.toMinor(w.amountMajor), fallback: province.id !== 'dki',
      label: `UMP ${province.name} 2026`, notes,
    };
  }

  // PPh 21 effective monthly rates (TER), category A (TK/0, TK/1, K/0).
  // Upper bound of monthly gross in rupiah → rate in basis points.
  const TER_A = [
    [5400000, 0], [5650000, 25], [5950000, 50], [6300000, 75], [6750000, 100],
    [7500000, 125], [8550000, 150], [9650000, 175], [10050000, 200],
  ];
  const DEDUCTION_RULES = {
    jkn: { label: 'BPJS Kesehatan (JKN), worker share', bp: 100, capMajor: 12000000, sourceId: 'bpjskes_iuran', status: 'VERIFIED' },
    jht: { label: 'BPJS TK — Jaminan Hari Tua', bp: 200, capMajor: null, sourceId: 'bpjstk_iuran', status: 'VERIFIED' },
    jp: { label: 'BPJS TK — Jaminan Pensiun', bp: 100, capMajor: 11086300, sourceId: 'bpjstk_iuran', status: 'VERIFIED',
      note: 'The JP wage ceiling is reported between Rp10,5 and Rp11,1 juta for 2026; no minimum wage reaches it.' },
  };

  /** Net pay from gross for a scenario. 'formal' = payroll with BPJS + PPh 21; 'gross' = no payroll deductions modelled. */
  function calculateNetIncome(grossMinor, scenario = 'formal') {
    const items = [];
    if (scenario === 'formal') {
      for (const [key, r] of Object.entries(DEDUCTION_RULES)) {
        const base = r.capMajor ? Math.min(grossMinor, rp(r.capMajor)) : grossMinor;
        items.push({ key, label: r.label, rateBp: r.bp, amount: M.applyBasisPoints(base, r.bp), status: r.status, sourceId: r.sourceId, note: r.note || null });
      }
      const grossMajor = grossMinor / 100;
      const bracket = TER_A.find(([upper]) => grossMajor <= upper);
      if (bracket) {
        const amount = M.applyBasisPoints(grossMinor, bracket[1]);
        items.push({
          key: 'pph21', label: 'PPh 21 withholding (TER A, single, no dependants)', rateBp: bracket[1], amount,
          status: 'ESTIMATED', sourceId: 'pph21_ter',
          note: bracket[1] === 0 ? 'Monthly gross is within the 0% band.' : 'Monthly withholding estimate; the annual reconciliation in December can differ.',
        });
      } else {
        items.push({ key: 'pph21', label: 'PPh 21 withholding', rateBp: null, amount: 0, status: 'UNAVAILABLE', sourceId: 'pph21_ter', note: 'Rate band not loaded for this income.' });
      }
    }
    const total = items.reduce((s, i) => s + i.amount, 0);
    return { gross: grossMinor, items, totalDeductions: total, net: grossMinor - total, scenario };
  }

  function calculateStartingBalance(config) {
    const wage = resolveWage(config.cityId);
    const pay = calculateNetIncome(wage.amount, config.scenario);
    return config.wageTreatment === 'gross' ? pay.gross : pay.net;
  }

  /** Overtime pay per PP 35/2021: hourly = monthly wage / 173; 1.5× first hour, 2× after. */
  function overtimePay(monthlyMinor, hours) {
    const hourly = monthlyMinor / 173;
    const mult = hours <= 0 ? 0 : 1.5 + Math.max(0, hours - 1) * 2;
    return Math.round(hourly * mult);
  }

  // ────────────────────────────────────────────────────────────────────
  // Housing
  // ────────────────────────────────────────────────────────────────────
  const RENT = {
    // [budget, typical, premium] in rupiah
    kost: { A: [900000, 1500000, 2500000], B: [800000, 1300000, 2000000], C: [600000, 950000, 1600000], D: [450000, 700000, 1200000] },
    petak: { A: [1200000, 1800000, 2800000], B: [1000000, 1500000, 2300000], C: [700000, 1100000, 1800000], D: [500000, 800000, 1300000] },
    apartment: { A: [2800000, 3800000, 6000000], B: [2300000, 3200000, 4800000], C: [1800000, 2600000, 4000000], D: null },
  };
  const TIERS = ['budget', 'typical', 'premium'];

  function housingOptions(cityId) {
    const { city } = getLocality(cityId);
    const t = city.tier;
    const anchor = t === 'A' ? 'kost_jakarta' : t === 'B' ? 'kost_tangerang' : 'game_rent_model';
    const opts = [];
    opts.push({
      id: 'family', type: 'family', tier: 'family', label: 'Live with family', monthlyRent: 0, deposit: 0,
      includes: { electricity: true, water: true, internet: true }, furnished: true, bathroom: 'Shared with family',
      contributionDefault: rp(500000), status: 'ILLUSTRATIVE', sourceId: 'game_assumption',
      note: 'No rent. You choose how much you hand over each month for household costs.',
    });
    const kostShared = RENT.kost[t].map((v) => Math.round((v * 0.6) / 50000) * 50000);
    opts.push({
      id: 'shared_typical', type: 'shared', tier: 'typical', label: 'Shared room in a kost', monthlyRent: rp(kostShared[1]), deposit: 0,
      includes: { electricity: true, water: true, internet: true }, furnished: true, bathroom: 'Shared',
      status: 'ESTIMATED', sourceId: 'game_rent_model', note: 'Rent split with one roommate: about 60% of a typical private kost.',
    });
    const kostInc = [
      { electricity: true, water: true, internet: false },
      { electricity: false, water: true, internet: true },
      { electricity: true, water: true, internet: true },
    ];
    const kostBath = ['Shared', 'Private', 'Private, with AC'];
    const kostDep = [0, 0.5, 1];
    RENT.kost[t].forEach((v, i) => opts.push({
      id: `kost_${TIERS[i]}`, type: 'kost', tier: TIERS[i], label: ['Basic kost room', 'Kost room, private bathroom', 'Kost room with AC'][i],
      monthlyRent: rp(v), deposit: rp(Math.round(v * kostDep[i])), includes: kostInc[i], furnished: true, bathroom: kostBath[i],
      ac: i === 2, status: 'ESTIMATED', sourceId: i === 1 ? anchor : 'game_rent_model',
      note: i === 1 && t === 'A' ? 'Close to the Mamikos average for men\'s kost in Jakarta (Rp1,49 juta); women\'s kost average higher (Rp2,0 juta).' :
        i === 1 && t === 'B' ? 'Below the Rp1,8–2 juta Mamikos reports for an AC + Wi-Fi kost in Tangerang; this one has no AC.' : null,
    }));
    RENT.petak[t].forEach((v, i) => opts.push({
      id: `petak_${TIERS[i]}`, type: 'petak', tier: TIERS[i], label: 'Rented room-house (kontrakan petak)',
      monthlyRent: rp(v), deposit: rp(v), includes: { electricity: false, water: false, internet: false }, furnished: false,
      bathroom: 'Private', status: 'ESTIMATED', sourceId: 'game_rent_model', note: 'Unfurnished. Many landlords ask for several months up front; this game asks for one month as deposit.',
    }));
    if (RENT.apartment[t]) RENT.apartment[t].forEach((v, i) => opts.push({
      id: `apartment_${TIERS[i]}`, type: 'apartment', tier: TIERS[i], label: 'Studio apartment',
      monthlyRent: rp(v), deposit: rp(v), includes: { electricity: false, water: false, internet: false }, furnished: true,
      bathroom: 'Private', ac: true, status: 'ESTIMATED', sourceId: 'game_rent_model', note: 'Service charge (IPL) assumed inside the rent.',
    }));
    return opts;
  }
  function getHousing(cityId, housingId) {
    return housingOptions(cityId).find((h) => h.id === housingId) || null;
  }
  /** Moving takes effect at the start of next month, when the new deposit is charged. */
  function planMove(state, housingId) {
    if (!getHousing(state.config.cityId, housingId)) return { ok: false, error: 'unknown_housing' };
    state.pendingMove = housingId === state.config.housingId ? null : housingId;
    return { ok: true };
  }
  function calculateMonthlyRent(config) {
    const h = getHousing(config.cityId, config.housingId);
    if (!h) return 0;
    return h.type === 'family' ? config.familyContribution ?? h.contributionDefault : h.monthlyRent;
  }

  // ────────────────────────────────────────────────────────────────────
  // Electricity & utilities
  // ────────────────────────────────────────────────────────────────────
  const TARIFFS = {
    '450s': { label: 'R-1/TR 450 VA (subsidised)', major: '415', subsidised: true },
    '900s': { label: 'R-1/TR 900 VA (subsidised)', major: '605', subsidised: true },
    '900': { label: 'R-1/TR 900 VA RTM', major: '1352' },
    '1300': { label: 'R-1/TR 1.300 VA', major: '1444.70' },
    '2200': { label: 'R-1/TR 2.200 VA', major: '1444.70' },
  };
  const KWH = { ac: { none: 0, occasional: 24, nightly: 96, heavy: 168 }, fridge: 30, cooking: 25, washer: { none: 0, shared: 4, private: 8 }, tv: 10 };
  const ADMIN_FEE = rp(2500);
  const INITIAL_KWH = 8;

  function defaultElectricity() {
    return { tariff: '900', ac: 'none', fridge: false, electricCooking: false, washer: 'shared', tv: false, occupants: 1, meter: 'prepaid' };
  }
  function estimateElectricity(profile, ppjBp = 300) {
    const lines = [];
    const base = 25 + 5 * Math.max(0, (profile.occupants || 1) - 1);
    lines.push(['Lights, fan, phone and laptop charging', base]);
    if (KWH.ac[profile.ac]) lines.push([`Air conditioner (${profile.ac})`, KWH.ac[profile.ac]]);
    if (profile.fridge) lines.push(['Small refrigerator', KWH.fridge]);
    if (profile.electricCooking) lines.push(['Rice cooker and electric kettle', KWH.cooking]);
    if (KWH.washer[profile.washer]) lines.push([`Washing machine (${profile.washer})`, KWH.washer[profile.washer]]);
    if (profile.tv) lines.push(['Television', KWH.tv]);
    const kwh = lines.reduce((s, l) => s + l[1], 0);
    const tariff = TARIFFS[profile.tariff] || TARIFFS['900'];
    const tariffMinor = M.toMinor(tariff.major);
    const energy = Math.round(kwh * tariffMinor);
    const ppj = M.applyBasisPoints(energy, ppjBp);
    return {
      kwh, lines, tariffKey: profile.tariff, tariffLabel: tariff.label, tariffMinor, energy, ppj, admin: ADMIN_FEE,
      total: energy + ppj + ADMIN_FEE, dailyKwh: kwh / 30, status: 'ESTIMATED', sourceId: 'pln_2026',
    };
  }
  /** What a prepaid token buys: nominal − admin fee, then local street-lighting tax (PPJ), then kWh at the tariff. */
  function tokenBreakdown(nominalMinor, tariffKey, ppjBp = 300) {
    const tariffMinor = M.toMinor((TARIFFS[tariffKey] || TARIFFS['900']).major);
    const afterAdmin = Math.max(0, nominalMinor - ADMIN_FEE);
    const energyValue = Math.round((afterAdmin * 10000) / (10000 + ppjBp));
    const ppj = afterAdmin - energyValue;
    return { nominal: nominalMinor, admin: ADMIN_FEE, ppj, energyValue, kwh: energyValue / tariffMinor, tariffMinor };
  }
  const TOKEN_NOMINALS = [20000, 50000, 100000, 200000, 500000].map(rp);
  const WATER_BILL_DEFAULT = rp(70000);

  // ────────────────────────────────────────────────────────────────────
  // Transport
  // ────────────────────────────────────────────────────────────────────
  const OJOL_ZONES = {
    I: { label: 'Zone I (Java outside Jabodetabek, Bali, Sumatra)', perKm: [1850, 2300], min: [9250, 11500] },
    II: { label: 'Zone II (Jabodetabek)', perKm: [2600, 2700], min: [13000, 13500] },
    III: { label: 'Zone III (Kalimantan, Sulawesi, Nusa Tenggara, Maluku, Papua)', perKm: [2100, 2600], min: [10500, 13000] },
  };
  const ZONE_I_PROVINCES = new Set(['aceh', 'sumut', 'sumbar', 'riau', 'jambi', 'sumsel', 'bengkulu', 'lampung', 'babel', 'kepri', 'jabar', 'jateng', 'diy', 'jatim', 'banten', 'bali']);
  function ojolZone(city) {
    if (['jakarta', 'krl', 'krl_lrt'].includes(city.transport) && ['dki', 'banten', 'jabar'].includes(city.provinceId) && city.tier !== 'D') return 'II';
    return ZONE_I_PROVINCES.has(city.provinceId) ? 'I' : 'III';
  }
  const FUEL_PER_L = rp(10000);
  const MOTOR_KM_PER_L = 45;

  const FARES = {
    tj: () => ({ cost: rp(3500), status: 'VERIFIED', sourceId: 'transit_jkt_2026', label: 'TransJakarta' }),
    mikrotrans: () => ({ cost: 0, status: 'VERIFIED', sourceId: 'transit_jkt_2026', label: 'Mikrotrans (JakLingko feeder)' }),
    krl: (d) => ({ cost: rp(3000 + 1000 * Math.ceil(Math.max(0, d - 25) / 10)), status: 'VERIFIED', sourceId: 'transit_jkt_2026', label: `KRL Commuter Line (${d} km)` }),
    mrt: (d) => ({ cost: rp(clamp(4000 + 1000 * Math.floor(Math.max(0, d - 2) / 1.5), 4000, 14000)), status: 'ESTIMATED', sourceId: 'transit_jkt_2026', label: 'MRT Jakarta', note: 'Fare range Rp4.000–14.000 is published; the per-trip figure is estimated from distance.' }),
    lrtJkt: () => ({ cost: rp(5000), status: 'VERIFIED', sourceId: 'transit_jkt_2026', label: 'LRT Jakarta' }),
    lrtJbd: (d) => ({ cost: rp(Math.min(20000, Math.round((5000 + 700 * Math.max(0, d - 1)) / 100) * 100)), status: 'ESTIMATED', sourceId: 'transit_jkt_2026', label: 'LRT Jabodebek', note: 'Rp5.000 base + Rp700/km, capped at the published Rp20.000 peak maximum.' }),
    angkot: () => ({ cost: rp(5000), status: 'ILLUSTRATIVE', sourceId: 'game_assumption', label: 'Angkot (minibus)' }),
    bus: (d, opts) => opts.customBusFare != null
      ? { cost: opts.customBusFare, status: 'ILLUSTRATIVE', sourceId: 'game_assumption', label: 'City bus (your fare)' }
      : { cost: null, status: 'UNAVAILABLE', sourceId: null, label: 'City bus' },
  };
  function ojolFare(city, d, kind, level = 'mid') {
    if (kind === 'car') {
      const lo = Math.max(15000, 3500 * d), hi = Math.max(20000, 4500 * d);
      const v = level === 'low' ? lo : level === 'high' ? hi : (lo + hi) / 2;
      return { cost: rp(Math.round(v / 500) * 500), low: rp(lo), high: rp(hi), status: 'ILLUSTRATIVE', sourceId: 'game_ojol_model', label: `Ride-hailing car (${d} km)` };
    }
    const z = OJOL_ZONES[ojolZone(city)];
    const lo = Math.max(z.min[0], z.perKm[0] * d), hi = Math.max(z.min[1], z.perKm[1] * d);
    const v = level === 'low' ? lo : level === 'high' ? hi : (lo + hi) / 2;
    return { cost: rp(Math.round(v / 500) * 500), low: rp(Math.round(lo)), high: rp(Math.round(hi)), status: 'ESTIMATED', sourceId: 'game_ojol_model', label: `Ride-hailing motorbike (${d} km)`, note: z.label };
  }

  /** Services the Move app lists for a locality. */
  function transportModes(cityId) {
    const { city } = getLocality(cityId);
    const p = city.transport;
    const m = [];
    const push = (id, label, fare, availability = 'available', note = null) => m.push({ id, label, fare, availability, note });
    if (p === 'jakarta') {
      push('tj', 'TransJakarta bus rapid transit', 'Rp3.500 flat · Rp2.000 before 07.00', 'available');
      push('mikrotrans', 'Mikrotrans feeder minibuses', 'Free', 'available');
      push('mrt', 'MRT Jakarta', 'Rp4.000–14.000 by distance', 'route', 'North–South line only.');
      push('lrtJkt', 'LRT Jakarta', 'Rp5.000 flat', 'route', 'Velodrome–Pegangsaan Dua corridor only.');
      push('krl', 'KRL Commuter Line', 'Rp3.000 first 25 km, +Rp1.000 per 10 km', 'available');
    }
    if (p === 'krl' || p === 'krl_lrt') {
      push('krl', 'KRL Commuter Line', 'Rp3.000 first 25 km, +Rp1.000 per 10 km', 'available');
      if (p === 'krl_lrt') push('lrtJbd', 'LRT Jabodebek', 'Rp5.000 + Rp700/km, max Rp20.000 peak', 'route', 'Bekasi and Cibubur lines to Dukuh Atas.');
      push('angkot', 'Angkot minibuses', 'Fare not loaded — game uses Rp5.000', 'available');
    }
    if (p === 'city_bus') {
      push('bus', city.bus || 'City bus', 'Fare not loaded — enter yours', 'reported', 'Service is reported for this city; check routes and fares locally.');
      push('angkot', 'Angkot minibuses', 'Fare not loaded — game uses Rp5.000', 'available');
    }
    if (p === 'basic') push('angkot', 'Angkot minibuses', 'Fare not loaded — game uses Rp5.000', 'available');
    if (p === 'remote') push('angkot', 'Angkot or ojek pangkalan', 'Negotiated — game uses Rp5.000 per leg', 'limited');
    const z = OJOL_ZONES[ojolZone(city)];
    push('ojol', 'Ride-hailing motorbike', `≈ Rp${z.perKm[0].toLocaleString('id-ID')}–${z.perKm[1].toLocaleString('id-ID')}/km`, p === 'remote' ? 'uncertain' : 'available', p === 'remote' ? 'Coverage may be patchy or absent here.' : null);
    push('ojol_car', 'Ride-hailing car', 'Estimate Rp3.500–4.500/km', p === 'remote' ? 'uncertain' : 'available');
    push('motorcycle', 'Own motorcycle', 'Fuel, parking, upkeep', 'available');
    push('bike', 'Bicycle or walking', 'Free', 'available');
    return m;
  }

  function commutePlans(cityId, distanceKm, opts = {}) {
    const { city } = getLocality(cityId);
    const d = clamp(Math.round(distanceKm), 1, 60);
    const level = opts.fareLevel || 'mid';
    const p = city.transport;
    const plans = [];
    const plan = (id, label, legs, extra = {}) => {
      const missing = legs.find((l) => l.cost == null);
      const perTrip = missing ? null : legs.reduce((s, l) => s + l.cost, 0);
      plans.push({ id, label, legs, perTrip, dailyExtra: extra.dailyExtra || 0, monthlyFixed: extra.monthlyFixed || 0,
        available: !missing && extra.available !== false, reason: missing ? 'Fare not loaded. Enter the fare you pay to use this option.' : extra.reason || null,
        tags: extra.tags || [], note: extra.note || null });
    };
    const ojM = ojolFare(city, d, 'motor', level);
    const ojFeeder = ojolFare(city, 3, 'motor', level);
    if (p === 'jakarta') {
      plan('tj', 'Mikrotrans + TransJakarta', [FARES.mikrotrans(), FARES.tj()], { tags: ['public'] });
      plan('krl_tj', 'KRL + TransJakarta', [FARES.krl(d), FARES.tj()], { tags: ['public'] });
      plan('mrt', 'MRT Jakarta', [FARES.mrt(d)], { tags: ['public'], note: 'Only if home and work are on the North–South line.' });
    }
    if (p === 'krl' || p === 'krl_lrt') {
      plan('angkot_krl', 'Angkot + KRL', [FARES.angkot(), FARES.krl(d)], { tags: ['public'] });
      plan('ojol_krl', 'Ride-hailing to station + KRL', [ojFeeder, FARES.krl(d)], { tags: ['public'] });
      if (p === 'krl_lrt') plan('lrt_jbd', 'Angkot + LRT Jabodebek', [FARES.angkot(), FARES.lrtJbd(d)], { tags: ['public'], note: 'Only if your route follows the Bekasi or Cibubur line.' });
    }
    if (p === 'city_bus') plan('bus', city.bus || 'City bus', [FARES.bus(d, opts)], { tags: ['public'] });
    if (p === 'city_bus' || p === 'basic' || p === 'remote') {
      const legs = d > 8 ? [FARES.angkot(), FARES.angkot()] : [FARES.angkot()];
      plan('angkot', d > 8 ? 'Two angkot legs' : 'Angkot', legs, { tags: ['public'] });
    }
    plan('ojol_motor', 'Ride-hailing motorbike', [ojM], { tags: ['door'], available: true,
      reason: p === 'remote' ? 'Coverage may be patchy here.' : null });
    plan('ojol_car', 'Ride-hailing car', [ojolFare(city, d, 'car', level)], { tags: ['door'] });
    const fuelPerTrip = Math.round((d / MOTOR_KM_PER_L) * FUEL_PER_L);
    plan('motorcycle', 'Own motorcycle', [{ cost: fuelPerTrip, status: 'ESTIMATED', sourceId: 'game_assumption', label: `Fuel, ${d} km at 45 km/L, Rp10.000/L` }], {
      dailyExtra: rp(2000), monthlyFixed: rp(80000) + (opts.motorcycleCredit ? rp(750000) : 0), tags: ['own'],
      note: 'Parking Rp2.000/day; tax and servicing Rp80.000/month' + (opts.motorcycleCredit ? '; instalment Rp750.000/month.' : '; assumes the motorcycle is paid off.'),
    });
    if (d <= 6) plan('bike', d <= 2 ? 'Walk' : 'Bicycle', [{ cost: 0, status: 'VERIFIED', sourceId: null, label: d <= 2 ? 'Walking' : 'Cycling' }], { tags: ['free'] });
    return plans;
  }
  function monthlyCommuteCost(plan, workdays) {
    if (!plan || plan.perTrip == null) return null;
    return plan.perTrip * 2 * workdays + plan.dailyExtra * workdays + plan.monthlyFixed;
  }
  /** Cheapest / balanced / convenience picks among available plans. */
  function commutePresets(plans, workdays) {
    const avail = plans.filter((p) => p.available).map((p) => ({ p, cost: monthlyCommuteCost(p, workdays) })).sort((a, b) => a.cost - b.cost);
    if (!avail.length) return {};
    const nonFree = avail.filter((a) => !a.p.tags.includes('free'));
    // Cheapest *practical* option: public transport or free modes; owning a motorcycle is a choice, not a default.
    const practical = avail.filter((a) => a.p.tags.includes('public') || a.p.tags.includes('free'));
    const cheapest = (practical[0] || avail[0]).p;
    const convenience = (avail.find((a) => a.p.id === 'ojol_motor') || avail[avail.length - 1]).p;
    const mid = nonFree.length ? nonFree[Math.floor(nonFree.length / 2)] : avail[0];
    return { cheapest: cheapest.id, balanced: mid.p.id, convenience: convenience.id };
  }

  // ────────────────────────────────────────────────────────────────────
  // Catalog pricing
  // ────────────────────────────────────────────────────────────────────
  function priceOf(item, config) {
    const adj = (config && config.priceAdjustBp) || 0;
    if (!adj) return item.price;
    return M.roundTo(item.price + M.applyBasisPoints(item.price, adj), rp(100));
  }
  function priceStatus(item, config) {
    return (config && config.priceAdjustBp) && item.status === 'VERIFIED' ? 'ESTIMATED' : item.status;
  }
  function isItemAvailable(item, config) {
    if (item.requires === 'dependent' && config.household !== 'dependent') return false;
    return true;
  }
  /** Quote a cart. The same function prices the checkout, so the wallet moves by exactly this total. */
  function calculateGroceryBasket(lines, config) {
    const out = [];
    let total = 0, essential = 0, discretionary = 0;
    for (const { itemId, qty } of lines) {
      const item = D().catalog.byId[itemId];
      if (!item || !Number.isInteger(qty) || qty <= 0) continue;
      const unit = priceOf(item, config);
      const line = unit * qty;
      total += line;
      if (item.essential) essential += line; else discretionary += line;
      out.push({ item, qty, unit, line });
    }
    return { lines: out, total, essential, discretionary };
  }

  // ────────────────────────────────────────────────────────────────────
  // Game creation
  // ────────────────────────────────────────────────────────────────────
  function defaultConfig(overrides = {}) {
    return {
      countryId: 'id', provinceId: 'banten', cityId: 'tangsel',
      scenario: 'formal', wageTreatment: 'net', workweek: 5, distanceKm: 12,
      housingId: 'kost_typical', depositPaid: true, familyContribution: rp(500000), familyDinner: false,
      household: 'single', difficulty: 'normal', priceAdjustBp: 0, ppjBp: 300,
      electricity: defaultElectricity(), waterBill: WATER_BILL_DEFAULT,
      commutePlanId: null, fareLevel: 'mid', customBusFare: null, motorcycleCredit: false,
      jknMandiri: false, groceryBudget: rp(1000000), startYear: 2026, startMonth: 10,
      ...overrides,
    };
  }

  function createGame(configIn, seed) {
    const config = defaultConfig(configIn);
    const loc = getLocality(config.cityId);
    if (!loc) throw new Error('Unknown locality');
    config.provinceId = loc.province.id;
    if (!getHousing(config.cityId, config.housingId)) config.housingId = 'kost_typical';
    const s = (seed >>> 0) || hashSeed(config.cityId, Date.now());
    const wd = workdaysInMonth(config.startYear, config.startMonth, config.workweek);
    if (!config.commutePlanId) {
      const pre = commutePresets(commutePlans(config.cityId, config.distanceKm, config), wd);
      config.commutePlanId = pre.cheapest || null;
    }
    const state = {
      version: STATE_VERSION, seed: s, config,
      date: { year: config.startYear, month: config.startMonth, day: 1 },
      monthIndex: 1, phase: 'play',
      wallet: 0, savings: 0,
      goals: [{ id: 'emergency', name: 'Emergency fund', target: 0, saved: 0, kind: 'emergency' }],
      transactions: [], bills: [], notifications: [], eventsLog: [], activeEvent: null,
      pantry: { staple: 6, side: 3, complete: 2, ready: 0 },
      supplies: { water: 2, soap: 5, shampoo: 4, toothpaste: 6, laundry: 3, dish: 5, gasMeals: 10, baby: config.household === 'dependent' ? 2 : 0 },
      electricity: { kwhBalance: INITIAL_KWH, kwhUsedMonth: 0, lastMonthKwh: null, outageToday: false },
      dataPlanUntil: null, homeInternet: null, pendingMove: null, subscriptions: [], owned: { raincoat: false },
      wellbeing: 70, counters: freshCounters(), wishlist: [], reports: [],
      seq: 1,
    };
    const g = state.goals[0];
    const h = getHousing(config.cityId, config.housingId);
    g.target = Math.round(((h.type === 'family' ? config.familyContribution : h.monthlyRent) + rp(1000000)) / rp(100000)) * rp(100000);
    payday(state);
    if (!config.depositPaid && h.deposit > 0) {
      chargeOrFail(state, { merchant: 'Landlord', category: 'Housing', cls: 'upfront', amount: h.deposit, note: 'Move-in deposit (one-off, usually refundable when you move out)' });
    }
    generateMonthlyBills(state);
    startOfDay(state);
    return state;
  }
  function freshCounters() {
    return { missedMeals: 0, missedWork: 0, outageDays: 0, optionalBought: 0, postponed: 0, skipped: 0, eventsSeen: 0 };
  }

  // ────────────────────────────────────────────────────────────────────
  // Transactions
  // ────────────────────────────────────────────────────────────────────
  function nowStamp(state) {
    return { month: state.monthIndex, day: state.date.day, y: state.date.year, m: state.date.month };
  }
  function pushTx(state, tx) {
    const full = {
      id: 'tx' + state.seq++, ...nowStamp(state), currency: 'IDR', status: 'completed', items: null, split: null, note: null, ...tx,
    };
    full.balanceAfter = state.wallet;
    state.transactions.unshift(full);
    return full;
  }
  /**
   * The single debit path. Validates, then either deducts and records a
   * completed transaction, or records a failed attempt and deducts nothing.
   * split: optional {essential, discretionary, ...} allocation of `amount`.
   */
  function chargeOrFail(state, { merchant, category, cls, amount, note, items, split }) {
    if (!Number.isInteger(amount) || amount < 0) return { ok: false, error: 'invalid_amount' };
    if (amount > state.wallet) {
      const tx = pushTx(state, { merchant, category, cls, amount: -amount, status: 'failed', note: (note ? note + ' · ' : '') + 'Declined: not enough balance', items, split });
      notify(state, 'bank', 'Payment declined', `${merchant}: ${M.format(amount)}. Your balance is ${M.format(state.wallet)}.`, 'warn');
      return { ok: false, error: 'insufficient_funds', tx, shortBy: amount - state.wallet };
    }
    state.wallet -= amount;
    const tx = pushTx(state, { merchant, category, cls, amount: -amount, note, items, split });
    return { ok: true, tx };
  }
  function credit(state, { merchant, category, cls, amount, note }) {
    state.wallet += amount;
    return pushTx(state, { merchant, category, cls, amount, note });
  }
  function notify(state, app, title, body, tone = 'info') {
    state.notifications.unshift({ id: 'n' + state.seq++, app, title, body, tone, ...nowStamp(state), read: false });
    if (state.notifications.length > 120) state.notifications.length = 120;
  }

  function payday(state) {
    const wage = resolveWage(state.config.cityId);
    const pay = calculateNetIncome(wage.amount, state.config.scenario);
    const amount = state.config.wageTreatment === 'gross' ? pay.gross : pay.net;
    credit(state, {
      merchant: 'Employer payroll', category: 'Salary', cls: 'income', amount,
      note: state.config.wageTreatment === 'gross' ? 'Gross wage (deductions not modelled)' : `Net after ${M.format(pay.totalDeductions)} deductions`,
    });
    notify(state, 'bank', 'Payday', `Your salary has arrived. ${M.format(amount, { plus: true })}`, 'pay');
    return amount;
  }

  function processPurchase(state, { store, lines, fees = [], merchant }) {
    if (state.phase !== 'play') return { ok: false, error: 'not_playing' };
    if (!Array.isArray(lines) || !lines.length) return { ok: false, error: 'empty_cart' };
    for (const l of lines) {
      const item = D().catalog.byId[l.itemId];
      if (!item) return { ok: false, error: 'unknown_item', itemId: l.itemId };
      if (!Number.isInteger(l.qty) || l.qty <= 0) return { ok: false, error: 'invalid_quantity' };
      if (!isItemAvailable(item, state.config)) return { ok: false, error: 'item_unavailable', itemId: l.itemId };
    }
    const quote = calculateGroceryBasket(lines, state.config);
    const feeTotal = fees.reduce((s, f) => s + f.amount, 0);
    const total = quote.total + feeTotal;
    const discShare = quote.discretionary + (quote.total ? Math.round((feeTotal * quote.discretionary) / quote.total) : 0);
    const split = { essential: total - discShare, discretionary: discShare };
    const meta = STORE_META[store] || { merchant: store, category: 'Shopping' };
    const res = chargeOrFail(state, {
      merchant: merchant || meta.merchant, category: meta.category, cls: split.discretionary === total ? 'discretionary' : split.discretionary ? 'mixed' : 'essential',
      amount: total, items: quote.lines.map((l) => ({ id: l.item.id, name: l.item.name, qty: l.qty, unit: l.unit })).concat(fees.map((f) => ({ id: 'fee', name: f.label, qty: 1, unit: f.amount }))),
      split,
    });
    if (!res.ok) return { ...res, total };
    for (const l of quote.lines) applyEffects(state, l.item, l.qty);
    if (quote.discretionary > 0) state.counters.optionalBought += quote.lines.filter((l) => !l.item.essential).reduce((s, l) => s + l.qty, 0);
    return { ok: true, total, tx: res.tx };
  }
  const STORE_META = {
    dailymart: { merchant: 'DailyMart', category: 'Groceries' },
    quickbite: { merchant: 'QuickBite', category: 'Food delivery' },
    shopsquare: { merchant: 'ShopSquare', category: 'Clothing & home' },
    glow: { merchant: 'Glow', category: 'Personal care' },
    care: { merchant: 'Care Pharmacy', category: 'Health' },
    afterhours: { merchant: 'AfterHours', category: 'Leisure' },
  };
  function applyEffects(state, item, qty) {
    const e = item.effects || {};
    const p = state.pantry, s = state.supplies;
    if (e.staple) p.staple += e.staple * qty;
    if (e.side) p.side += e.side * qty;
    if (e.complete) {
      if (item.store === 'quickbite' || item.cat === 'ready') p.ready += e.complete * qty;
      else p.complete += e.complete * qty;
    }
    for (const k of ['water', 'soap', 'shampoo', 'toothpaste', 'laundry', 'dish', 'gasMeals', 'baby']) if (e[k]) s[k] += e[k] * qty;
    if (e.wellbeing) state.wellbeing = clamp(state.wellbeing + e.wellbeing * qty, 0, 100);
    if (e.raincoat) state.owned.raincoat = true;
    if (e.health) state.wellbeing = clamp(state.wellbeing + 1, 0, 100);
  }

  // ────────────────────────────────────────────────────────────────────
  // Bills
  // ────────────────────────────────────────────────────────────────────
  function addBill(state, b) {
    const bill = { id: `${state.monthIndex}-${b.key}`, month: state.monthIndex, status: 'pending', autopay: false, paidDay: null, mandatory: true, adjustable: false, ...b };
    if (state.bills.some((x) => x.id === bill.id)) return null; // never create the same bill twice
    state.bills.push(bill);
    return bill;
  }
  function generateMonthlyBills(state) {
    const c = state.config;
    const h = getHousing(c.cityId, c.housingId);
    if (h.type === 'family') {
      if (c.familyContribution > 0) addBill(state, { key: 'family', label: 'Contribution to family household', category: 'Housing', amount: c.familyContribution, dueDay: 5, adjustable: true, mandatory: true });
    } else {
      addBill(state, { key: 'rent', label: `Rent — ${h.label}`, category: 'Housing', amount: h.monthlyRent, dueDay: 5 });
    }
    if (!h.includes.electricity && c.electricity.meter === 'postpaid') {
      const est = estimateElectricity(c.electricity, c.ppjBp);
      const kwh = state.electricity.lastMonthKwh ?? est.kwh;
      const energy = Math.round(kwh * est.tariffMinor);
      addBill(state, { key: 'electricity', label: `PLN postpaid (${Math.round(kwh)} kWh)`, category: 'Utilities', amount: energy + M.applyBasisPoints(energy, c.ppjBp) + ADMIN_FEE, dueDay: 20 });
    }
    if (!h.includes.water) addBill(state, { key: 'water', label: 'Water utility (PDAM)', category: 'Utilities', amount: c.waterBill, dueDay: 20, adjustable: true });
    if (state.homeInternet && !h.includes.internet) {
      const plan = D().connect.homeInternet.find((x) => x.id === state.homeInternet);
      if (plan) addBill(state, { key: 'internet', label: plan.name, category: 'Phone & internet', amount: plan.price, dueDay: 20, adjustable: true });
    }
    if (c.scenario === 'gross' && c.jknMandiri) addBill(state, { key: 'jkn', label: 'BPJS Kesehatan, independent class 3', category: 'Health', amount: rp(35000), dueDay: 10, adjustable: true });
    const plan = currentCommutePlan(state);
    if (plan && plan.monthlyFixed) addBill(state, { key: 'motorcycle', label: 'Motorcycle tax, servicing' + (c.motorcycleCredit ? ' and instalment' : ''), category: 'Transport', amount: plan.monthlyFixed, dueDay: 15 });
    // carry unpaid bills from last month as arrears
    for (const old of state.bills.filter((b) => b.month === state.monthIndex - 1 && b.status !== 'paid' && !b.carried)) {
      old.carried = true;
      const late = old.key === 'rent' || old.key === 'electricity' ? rp(50000) : 0;
      addBill(state, { key: 'arrears-' + old.key, label: `Overdue from last month: ${old.label}`, category: old.category, amount: old.amount + late, lateFee: late, dueDay: 1, arrears: true });
    }
  }
  function billsThisMonth(state) { return state.bills.filter((b) => b.month === state.monthIndex); }

  function processBillPayment(state, billId) {
    const bill = state.bills.find((b) => b.id === billId);
    if (!bill) return { ok: false, error: 'unknown_bill' };
    if (bill.status === 'paid') return { ok: false, error: 'already_paid' };
    if (bill.month < state.monthIndex && bill.carried) return { ok: false, error: 'carried_forward' };
    const res = chargeOrFail(state, { merchant: bill.label, category: bill.category, cls: 'mandatory', amount: bill.amount, note: `Bill due day ${bill.dueDay}` });
    if (!res.ok) return res;
    bill.status = 'paid';
    bill.paidDay = state.date.day;
    if (bill.key === 'rent' || bill.key === 'arrears-rent') state.wellbeing = clamp(state.wellbeing + 2, 0, 100);
    return { ok: true, tx: res.tx };
  }
  function setAutopay(state, billId, on) {
    const bill = state.bills.find((b) => b.id === billId);
    if (bill) bill.autopay = !!on;
  }

  // ────────────────────────────────────────────────────────────────────
  // Utilities actions
  // ────────────────────────────────────────────────────────────────────
  function buyToken(state, nominalMinor) {
    const c = state.config;
    const h = getHousing(c.cityId, c.housingId);
    if (h.includes.electricity) return { ok: false, error: 'included_in_rent' };
    if (c.electricity.meter !== 'prepaid') return { ok: false, error: 'postpaid_meter' };
    const b = tokenBreakdown(nominalMinor, c.electricity.tariff, c.ppjBp);
    const res = chargeOrFail(state, { merchant: 'PLN prepaid token', category: 'Utilities', cls: 'essential', amount: nominalMinor, note: `${b.kwh.toFixed(1)} kWh after admin fee and PPJ` });
    if (!res.ok) return res;
    state.electricity.kwhBalance += b.kwh;
    state.electricity.outageToday = false;
    return { ok: true, kwh: b.kwh, tx: res.tx };
  }
  function buyDataPlan(state, planId) {
    const plan = D().connect.dataPlans.find((p) => p.id === planId);
    if (!plan) return { ok: false, error: 'unknown_plan' };
    const res = chargeOrFail(state, { merchant: 'Mobile data', category: 'Phone & internet', cls: 'essential', amount: plan.price, note: plan.name });
    if (!res.ok) return res;
    const base = state.dataPlanUntil && dayNumber(state.dataPlanUntil) >= dayNumber(state.date) ? state.dataPlanUntil : state.date;
    state.dataPlanUntil = addDays(base, plan.days);
    return { ok: true, tx: res.tx };
  }
  function buyDevice(state, deviceId) {
    const dev = D().connect.devices.find((p) => p.id === deviceId);
    if (!dev) return { ok: false, error: 'unknown_device' };
    return chargeOrFail(state, { merchant: 'Phone counter', category: 'Phone & internet', cls: 'upfront', amount: dev.price, note: dev.name });
  }
  function setHomeInternet(state, planId) {
    state.homeInternet = planId || null;
    // takes effect from next month's bills; first month charged now if added mid-month
    if (planId) {
      const plan = D().connect.homeInternet.find((x) => x.id === planId);
      if (plan && !billsThisMonth(state).some((b) => b.key === 'internet')) addBill(state, { key: 'internet', label: plan.name, category: 'Phone & internet', amount: plan.price, dueDay: Math.min(daysInMonth(state.date.year, state.date.month), state.date.day + 2), adjustable: true });
    }
  }
  function hasWifi(state) {
    const h = getHousing(state.config.cityId, state.config.housingId);
    if (h.includes.internet) return true;
    if (!state.homeInternet) return false;
    const bill = state.bills.find((b) => b.key === 'internet' && b.month === state.monthIndex);
    return !bill || bill.status === 'paid' || state.date.day <= bill.dueDay;
  }
  function hasMobileData(state) {
    return !!state.dataPlanUntil && dayNumber(state.dataPlanUntil) >= dayNumber(state.date);
  }
  function isOnline(state) { return hasWifi(state) || hasMobileData(state); }
  function electricityOn(state) {
    const h = getHousing(state.config.cityId, state.config.housingId);
    if (h.includes.electricity) return true;
    if (state.config.electricity.meter === 'postpaid') {
      const overdue = state.bills.find((b) => (b.key === 'electricity' || b.key === 'arrears-electricity') && b.status !== 'paid' && b.month === state.monthIndex && b.arrears && state.date.day > 10);
      return !overdue;
    }
    return state.electricity.kwhBalance > 0;
  }

  // ────────────────────────────────────────────────────────────────────
  // Subscriptions
  // ────────────────────────────────────────────────────────────────────
  function subscribe(state, subId) {
    const sub = D().subscriptions.find((s) => s.id === subId);
    if (!sub || state.subscriptions.some((s) => s.id === subId && s.active)) return { ok: false, error: 'invalid' };
    const res = chargeOrFail(state, { merchant: sub.name, category: 'Subscriptions', cls: 'discretionary', amount: sub.price, note: 'First month' });
    if (!res.ok) return res;
    const existing = state.subscriptions.find((s) => s.id === subId);
    const renewDay = Math.min(state.date.day, 28);
    if (existing) Object.assign(existing, { active: true, renewDay, lastChargedMonth: state.monthIndex });
    else state.subscriptions.push({ id: subId, active: true, renewDay, lastChargedMonth: state.monthIndex });
    state.wellbeing = clamp(state.wellbeing + (sub.wellbeing || 0), 0, 100);
    state.counters.optionalBought++;
    return { ok: true, tx: res.tx };
  }
  function cancelSubscription(state, subId) {
    const s = state.subscriptions.find((x) => x.id === subId);
    if (s) s.active = false;
  }

  // ────────────────────────────────────────────────────────────────────
  // Savings
  // ────────────────────────────────────────────────────────────────────
  function processSavingsTransfer(state, amount, direction = 'in', goalId = 'emergency') {
    if (!Number.isInteger(amount) || amount <= 0) return { ok: false, error: 'invalid_amount' };
    const goal = state.goals.find((g) => g.id === goalId);
    if (!goal) return { ok: false, error: 'unknown_goal' };
    if (direction === 'in') {
      if (amount > state.wallet) return { ok: false, error: 'insufficient_funds' };
      state.wallet -= amount; state.savings += amount; goal.saved += amount;
      return { ok: true, tx: pushTx(state, { merchant: `FutureMe · ${goal.name}`, category: 'Savings', cls: 'savings_in', amount: -amount, note: 'Transfer to savings (not spending)' }) };
    }
    if (amount > goal.saved) return { ok: false, error: 'insufficient_savings' };
    goal.saved -= amount; state.savings -= amount; state.wallet += amount;
    return { ok: true, tx: pushTx(state, { merchant: `FutureMe · ${goal.name}`, category: 'Savings', cls: 'savings_out', amount, note: 'Withdrawal from savings (not income)' }) };
  }
  function addGoal(state, name, targetMinor, kind = 'custom') {
    const id = 'g' + state.seq++;
    state.goals.push({ id, name, target: targetMinor, saved: 0, kind });
    return id;
  }

  // ────────────────────────────────────────────────────────────────────
  // Small actions
  // ────────────────────────────────────────────────────────────────────
  /** Settings the player can change mid-game. Money-relevant ones apply to future bills and paydays. */
  const EDITABLE = ['waterBill', 'ppjBp', 'difficulty', 'priceAdjustBp', 'wageTreatment', 'familyContribution', 'familyDinner', 'groceryBudget', 'fareLevel', 'customBusFare', 'motorcycleCredit', 'jknMandiri', 'distanceKm', 'workweek', 'commutePlanId'];
  function updateConfig(state, patch) {
    for (const [k, v] of Object.entries(patch)) if (EDITABLE.includes(k)) state.config[k] = v;
    if (patch.electricity) state.config.electricity = { ...state.config.electricity, ...patch.electricity };
  }
  function toggleWishlist(state, itemId, postpone = false) {
    const i = state.wishlist.indexOf(itemId);
    if (i >= 0) { state.wishlist.splice(i, 1); return false; }
    state.wishlist.push(itemId);
    if (postpone) state.counters.postponed++;
    return true;
  }
  /** One-off ride-hailing trip (rain, late night, errands). Needs a connection. */
  function bookRide(state, kind, km) {
    if (!isOnline(state)) return { ok: false, error: 'offline' };
    const city = getLocality(state.config.cityId).city;
    const f = ojolFare(city, clamp(Math.round(km), 1, 60), kind, state.config.fareLevel);
    return chargeOrFail(state, { merchant: kind === 'car' ? 'Ride-hailing car' : 'Ride-hailing motorbike', category: 'Transport', cls: 'essential', amount: f.cost, note: `One-off trip, ${km} km (estimated fare)` });
  }

  // ────────────────────────────────────────────────────────────────────
  // Commute & date
  // ────────────────────────────────────────────────────────────────────
  function currentCommutePlan(state) {
    const c = state.config;
    const plans = commutePlans(c.cityId, c.distanceKm, c);
    return plans.find((p) => p.id === c.commutePlanId && p.available) || null;
  }
  function setCommute(state, patch) {
    Object.assign(state.config, patch);
    const plan = currentCommutePlan(state);
    // a motorcycle bill is added for this month if switching to it
    if (plan && plan.monthlyFixed && !billsThisMonth(state).some((b) => b.key === 'motorcycle')) {
      addBill(state, { key: 'motorcycle', label: 'Motorcycle tax, servicing' + (state.config.motorcycleCredit ? ' and instalment' : ''), category: 'Transport', amount: plan.monthlyFixed, dueDay: Math.max(15, state.date.day) });
    }
  }
  function dayNumber(dt) { return Date.UTC(dt.year, dt.month, dt.day) / 86400000; }
  function addDays(dt, n) {
    const t = new Date(Date.UTC(dt.year, dt.month, dt.day + n));
    return { year: t.getUTCFullYear(), month: t.getUTCMonth(), day: t.getUTCDate() };
  }
  function dateLabel(dt, long = false) {
    const wd = WEEKDAYS[weekday(dt.year, dt.month, dt.day)];
    return long ? `${wd}, ${dt.day} ${MONTHS[dt.month]} ${dt.year}` : `${wd} ${dt.day} ${MONTHS[dt.month].slice(0, 3)}`;
  }
  function mealsNeeded(state) {
    return 3 + (state.config.household === 'dependent' ? 2 : 0) - (state.config.familyDinner && getHousing(state.config.cityId, state.config.housingId).type === 'family' ? 1 : 0);
  }
  function canCook(state) {
    return state.supplies.gasMeals > 0 || (state.config.electricity.electricCooking && electricityOn(state));
  }
  function homeMealsAvailable(state) {
    if (!canCook(state)) return 0;
    return state.pantry.complete + Math.min(state.pantry.staple, state.pantry.side);
  }

  /** Close the current day and open the next one. */
  function advanceSimulationDay(state) {
    if (state.phase !== 'play') return { ended: true };
    if (state.activeEvent) return { ok: false, error: 'event_pending' };
    const log = [];
    const c = state.config;
    // 1. meals
    let need = mealsNeeded(state);
    const eatReady = Math.min(state.pantry.ready, need); state.pantry.ready -= eatReady; need -= eatReady;
    let cooked = 0;
    const useGas = () => { if (!(c.electricity.electricCooking && electricityOn(state))) state.supplies.gasMeals = Math.max(0, state.supplies.gasMeals - 1); };
    while (need > 0 && canCook(state) && state.pantry.complete > 0) { state.pantry.complete--; need--; cooked++; useGas(); }
    while (need > 0 && canCook(state) && state.pantry.staple > 0 && state.pantry.side > 0) { state.pantry.staple--; state.pantry.side--; need--; cooked++; useGas(); }
    if (need > 0) {
      state.counters.missedMeals += need;
      state.wellbeing -= 5 * need;
      log.push(`Missed ${need} meal${need > 1 ? 's' : ''}`);
      notify(state, 'dailymart', 'Not enough food today', `${need} meal${need > 1 ? 's' : ''} skipped. ${!canCook(state) ? 'No way to cook: refill LPG or buy ready meals.' : 'Restock rice and sides, or buy a ready meal.'}`, 'warn');
    }
    // 2. supplies
    const s = state.supplies;
    if (s.water > 0) s.water--; else { state.wellbeing -= 3; notify(state, 'dailymart', 'Out of drinking water', 'Buy a gallon refill.', 'warn'); }
    let bathOut = false;
    for (const k of ['soap', 'shampoo', 'toothpaste']) { if (s[k] > 0) s[k]--; else bathOut = true; }
    if (bathOut) state.wellbeing -= 1;
    if (s.laundry > 0) s.laundry--; else state.wellbeing -= 1;
    if (cooked && s.dish > 0) s.dish--;
    if (c.household === 'dependent') { if (s.baby > 0) s.baby--; else { state.wellbeing -= 3; notify(state, 'dailymart', 'Baby supplies ran out', 'Diapers or formula needed.', 'warn'); } }
    // 3. electricity
    const h = getHousing(c.cityId, c.housingId);
    if (!h.includes.electricity) {
      const daily = estimateElectricity(c.electricity, c.ppjBp).dailyKwh;
      if (c.electricity.meter === 'prepaid') {
        if (state.electricity.kwhBalance > 0) state.electricity.kwhBalance = Math.max(0, state.electricity.kwhBalance - daily);
        if (state.electricity.kwhBalance <= 0) {
          state.counters.outageDays++; state.wellbeing -= 3;
          notify(state, 'utility', 'Your power is out', 'The prepaid meter hit zero. Buy a token in Utility Hub.', 'warn');
        }
      } else state.electricity.kwhUsedMonth += daily;
    }
    // 4. wellbeing recovery
    state.wellbeing += 1;
    if (billsThisMonth(state).some((b) => b.key.includes('rent') && b.status === 'overdue')) state.wellbeing -= 2;
    state.wellbeing = clamp(Math.round(state.wellbeing), 0, 100);
    // 5. next date
    const dim = daysInMonth(state.date.year, state.date.month);
    if (state.date.day >= dim) {
      state.phase = 'report';
      state.lastReport = generateMonthlyReport(state);
      notify(state, 'report', 'Month complete', 'Your end-of-month report is ready.', 'info');
      return { ended: true, log };
    }
    state.date.day++;
    startOfDay(state, log);
    return { ended: false, log };
  }

  function startOfDay(state, log = []) {
    const c = state.config;
    const day = state.date.day;
    // commute
    if (isWorkday(state)) {
      const plan = currentCommutePlan(state);
      if (plan && (plan.perTrip > 0 || plan.dailyExtra > 0)) {
        const amount = plan.perTrip * 2 + plan.dailyExtra;
        const res = chargeOrFail(state, { merchant: plan.label, category: 'Transport', cls: 'essential', amount, note: 'Commute: home → work → home' });
        if (!res.ok) {
          state.counters.missedWork++; state.wellbeing = clamp(state.wellbeing - 4, 0, 100);
          log.push('Could not pay the commute');
        }
      }
    }
    // bills
    for (const b of billsThisMonth(state)) {
      if (b.status === 'paid') continue;
      if (b.dueDay === day && b.autopay) {
        const r = processBillPayment(state, b.id);
        if (r.ok) notify(state, 'bills', 'Autopay', `${b.label} paid: ${M.format(b.amount)}`, 'info');
      }
      if (b.status !== 'paid' && day === b.dueDay && !b.autopay) notify(state, 'bills', 'Bill due today', `${b.label}: ${M.format(b.amount)}`, 'warn');
      if (b.status === 'pending' && day > b.dueDay) {
        b.status = 'overdue';
        notify(state, 'bills', 'Bill overdue', `${b.label} was due on day ${b.dueDay}.`, 'warn');
      }
    }
    // subscriptions renew
    for (const sub of state.subscriptions) {
      if (!sub.active || sub.renewDay !== day || sub.lastChargedMonth === state.monthIndex) continue;
      const def = D().subscriptions.find((x) => x.id === sub.id);
      const res = chargeOrFail(state, { merchant: def.name, category: 'Subscriptions', cls: 'discretionary', amount: def.price, note: 'Monthly renewal' });
      if (res.ok) { sub.lastChargedMonth = state.monthIndex; state.wellbeing = clamp(state.wellbeing + (def.wellbeing || 0), 0, 100); }
      else { sub.active = false; notify(state, 'recurring', 'Subscription paused', `${def.name} could not renew.`, 'warn'); }
    }
    // data plan expiry
    if (state.dataPlanUntil && dayNumber(state.dataPlanUntil) === dayNumber(state.date) - 1) notify(state, 'connect', 'Mobile data expired', 'Ride-hailing and delivery apps need Wi-Fi or data.', 'warn');
    // low supply nudges
    const s = state.supplies;
    if (s.water === 1) notify(state, 'dailymart', 'Drinking water running low', 'About one day left.', 'info');
    if (s.gasMeals > 0 && s.gasMeals <= 3) notify(state, 'dailymart', 'LPG almost empty', `About ${s.gasMeals} cooked meals left.`, 'info');
    const h = getHousing(c.cityId, c.housingId);
    if (!h.includes.electricity && c.electricity.meter === 'prepaid') {
      const daily = estimateElectricity(c.electricity, c.ppjBp).dailyKwh;
      if (state.electricity.kwhBalance > 0 && state.electricity.kwhBalance < daily * 2) notify(state, 'utility', 'Token almost used up', `${state.electricity.kwhBalance.toFixed(1)} kWh left.`, 'warn');
    }
    // events
    rollEvent(state);
    return log;
  }

  // ────────────────────────────────────────────────────────────────────
  // Events
  // ────────────────────────────────────────────────────────────────────
  const CHANCE = { calm: 0.12, normal: 0.22, chaotic: 0.38 };
  const r1000 = (minor) => Math.round(minor / rp(1000)) * rp(1000);
  const EVENTS = [
    { id: 'wedding', app: 'calendar', title: 'Wedding invitation', weight: 3,
      body: () => 'A colleague is getting married this weekend. Guests usually bring an envelope gift.',
      choices: (r) => [
        { label: 'Go with a fuller envelope', cost: r1000(rp(100000 + r() * 50000)), wb: 5, kind: 'discretionary' },
        { label: 'Go with a smaller envelope', cost: rp(50000), wb: 3, kind: 'discretionary' },
        { label: 'Send congratulations by message', cost: 0, wb: -2, skip: true },
      ] },
    { id: 'family_help', app: 'messages', title: 'Message from home', weight: 3,
      body: () => 'Your mother asks if you can help with your younger sibling\'s school fees this month.',
      choices: (r) => [
        { label: 'Send what they asked for', cost: r1000(rp(400000 + r() * 200000)), wb: 2, kind: 'essential' },
        { label: 'Send a smaller amount', cost: rp(200000), wb: 0, kind: 'essential' },
        { label: 'Explain you can\'t this month', cost: 0, wb: -4, skip: true },
      ] },
    { id: 'charger', app: 'shopsquare', title: 'Charger stopped working', weight: 2,
      body: () => 'Your phone charger died overnight. The battery is at 9%.',
      choices: () => [
        { label: 'Budget charger from the market stall', cost: rp(35000), wb: 0, kind: 'essential' },
        { label: 'Original-brand charger', cost: rp(150000), wb: 1, kind: 'essential' },
        { label: 'Borrow a roommate\'s for now', cost: 0, wb: -2, skip: true },
      ] },
    { id: 'birthday_dinner', app: 'afterhours', title: 'Birthday dinner', weight: 3,
      body: () => 'Friends are going out for a birthday dinner and split the bill evenly.',
      choices: (r) => [
        { label: 'Join the dinner', cost: r1000(rp(100000 + r() * 60000)), wb: 7, kind: 'discretionary' },
        { label: 'Join for a drink only', cost: rp(35000), wb: 4, kind: 'discretionary' },
        { label: 'Skip this one', cost: 0, wb: -3, skip: true },
      ] },
    { id: 'rain', app: 'move', title: 'Heavy rain after work', weight: 3, when: (s) => isWorkday(s),
      body: (s) => s.owned.raincoat ? 'Rain is pouring. You have a raincoat, but the roads are flooding.' : 'Rain is pouring and you have no raincoat.',
      choices: (r, s) => {
        const city = getLocality(s.config.cityId).city;
        return [
          { label: 'Order a ride-hailing car home', cost: ojolFare(city, s.config.distanceKm, 'car', 'high').cost, wb: 1, kind: 'essential' },
          { label: 'Buy a raincoat at the minimarket', cost: rp(35000), wb: 0, kind: 'essential', effect: (st) => { st.owned.raincoat = true; } },
          { label: 'Wait it out at the office', cost: 0, wb: -3, skip: true },
        ];
      } },
    { id: 'office_collection', app: 'workday', title: 'Office condolence collection', weight: 2,
      body: () => 'A coworker\'s parent passed away. The team is collecting money for the family.',
      choices: () => [
        { label: 'Give Rp50.000', cost: rp(50000), wb: 1, kind: 'essential' },
        { label: 'Give Rp20.000', cost: rp(20000), wb: 0, kind: 'essential' },
      ] },
    { id: 'flu', app: 'care', title: 'You wake up with a fever', weight: 2,
      body: (s) => s.config.scenario === 'formal' ? 'You have JKN through work, so a visit to your registered clinic (faskes 1) is covered.' : 'You do not have JKN through an employer in this scenario.',
      choices: (r, s) => {
        const covered = s.config.scenario === 'formal' || s.config.jknMandiri;
        return [
          covered ? { label: 'Visit your JKN clinic', cost: 0, wb: 2, kind: 'essential', note: 'Covered by JKN' } : { label: 'Visit a private clinic', cost: r1000(rp(120000 + r() * 60000)), wb: 2, kind: 'essential' },
          { label: 'Buy medicine at the pharmacy', cost: rp(30000), wb: 1, kind: 'essential' },
          { label: 'Rest and push through', cost: 0, wb: -5, skip: true },
        ];
      } },
    { id: 'fan', app: 'shopsquare', title: 'The fan broke', weight: 1, when: (s) => !getHousing(s.config.cityId, s.config.housingId).ac,
      body: () => 'Your standing fan stopped turning. Nights are hot this week.',
      choices: () => [
        { label: 'Repair it at a service stall', cost: rp(50000), wb: 1, kind: 'essential' },
        { label: 'Buy a new fan', cost: rp(175000), wb: 2, kind: 'essential' },
        { label: 'Sleep without it for now', cost: 0, wb: -4, skip: true },
      ] },
    { id: 'flash_sale', app: 'dailymart', title: 'DailyMart flash sale (game event)', weight: 1,
      body: () => 'A fictional in-game sale: a 5 kg bag of medium rice for less today.',
      choices: () => [
        { label: 'Buy one bag on sale', cost: rp(58000), wb: 1, kind: 'essential', effect: (st) => { st.pantry.staple += 50; } },
        { label: 'Not now', cost: 0, wb: 0, skip: true },
      ] },
    { id: 'flat_tire', app: 'move', title: 'Flat tyre', weight: 2, when: (s) => s.config.commutePlanId === 'motorcycle',
      body: () => 'Your motorcycle tyre went flat on the way to work.',
      choices: () => [
        { label: 'Patch it (tambal ban)', cost: rp(15000), wb: 0, kind: 'essential' },
        { label: 'Replace the inner tube', cost: rp(45000), wb: 1, kind: 'essential' },
      ] },
    { id: 'overtime', app: 'workday', title: 'Overtime offered', weight: 2, when: (s) => isWorkday(s),
      body: () => 'Your supervisor asks if you can stay three extra hours today. Overtime is paid by the hour.',
      choices: (r, s) => [
        { label: 'Stay three hours', cost: -overtimePay(resolveWage(s.config.cityId).amount, 3), wb: -3, kind: 'income', note: 'Hourly wage = monthly ÷ 173; 1,5× first hour, 2× after (PP 35/2021)' },
        { label: 'Decline politely', cost: 0, wb: 0 },
      ] },
    { id: 'work_print', app: 'workday', title: 'Work errand', weight: 1,
      body: () => 'You need to print and bind documents for tomorrow. The office printer is broken.',
      choices: () => [
        { label: 'Pay at the print shop', cost: rp(30000), wb: 0, kind: 'essential' },
        { label: 'Ask a colleague to share costs', cost: rp(15000), wb: -1, kind: 'essential' },
      ] },
  ];

  function rollEvent(state) {
    if (state.activeEvent) return;
    const r = mulberry32(hashSeed(state.seed, state.monthIndex, state.date.day));
    if (r() > CHANCE[state.config.difficulty]) return;
    const pool = EVENTS.filter((e) => !e.when || e.when(state));
    const totalW = pool.reduce((s, e) => s + e.weight, 0);
    let pick = r() * totalW, ev = pool[0];
    for (const e of pool) { pick -= e.weight; if (pick <= 0) { ev = e; break; } }
    const choices = ev.choices(r, state).map((ch, i) => ({ ...ch, idx: i }));
    state.activeEvent = { id: ev.id, app: ev.app, title: ev.title, body: ev.body(state), choices: choices.map(({ effect, ...rest }) => rest), day: state.date.day, month: state.monthIndex };
    state.counters.eventsSeen++;
    notify(state, ev.app, ev.title, 'Needs your decision.', 'event');
  }

  function resolveEvent(state, choiceIdx) {
    const ev = state.activeEvent;
    if (!ev) return { ok: false, error: 'no_event' };
    const def = EVENTS.find((e) => e.id === ev.id);
    const r = mulberry32(hashSeed(state.seed, state.monthIndex, ev.day));
    r(); // keep stream aligned with rollEvent: the first draw decided whether the event happened
    const liveChoices = def.choices(() => 0.5, state);
    const ch = ev.choices[choiceIdx];
    if (!ch) return { ok: false, error: 'bad_choice' };
    if (ch.cost > 0) {
      const res = chargeOrFail(state, {
        merchant: ev.title, category: 'Unexpected', cls: 'unexpected', amount: ch.cost,
        note: ch.label + (ch.note ? ` (${ch.note})` : ''), split: { [ch.kind === 'discretionary' ? 'discretionary' : 'essential']: ch.cost },
      });
      if (!res.ok) return res;
    } else if (ch.cost < 0) {
      credit(state, { merchant: ev.title, category: 'Extra income', cls: 'income_extra', amount: -ch.cost, note: ch.label + (ch.note ? ` · ${ch.note}` : '') });
    }
    const effectSrc = liveChoices[choiceIdx];
    if (effectSrc && effectSrc.effect) effectSrc.effect(state);
    if (ch.skip) state.counters.skipped++;
    state.wellbeing = clamp(state.wellbeing + (ch.wb || 0), 0, 100);
    state.eventsLog.unshift({ ...nowStamp(state), title: ev.title, choice: ch.label, cost: ch.cost });
    state.activeEvent = null;
    return { ok: true };
  }

  // ────────────────────────────────────────────────────────────────────
  // Reports
  // ────────────────────────────────────────────────────────────────────
  function generateMonthlyReport(state, monthIndex = state.monthIndex) {
    const txs = state.transactions.filter((t) => t.month === monthIndex && t.status === 'completed');
    const sum = (f) => txs.filter(f).reduce((s, t) => s + Math.abs(t.amount), 0);
    const salary = sum((t) => t.cls === 'income');
    const extraIncome = sum((t) => t.cls === 'income_extra');
    const income = salary + extraIncome;
    const mandatory = sum((t) => t.cls === 'mandatory');
    let variableEssential = 0, discretionary = 0, unexpectedEss = 0, unexpectedDisc = 0;
    for (const t of txs) {
      const a = Math.abs(t.amount);
      if (t.cls === 'essential') variableEssential += a;
      else if (t.cls === 'discretionary') discretionary += a;
      else if (t.cls === 'mixed') { variableEssential += t.split.essential; discretionary += t.split.discretionary; }
      else if (t.cls === 'unexpected') { unexpectedEss += t.split.essential || 0; unexpectedDisc += t.split.discretionary || 0; }
    }
    const upfront = sum((t) => t.cls === 'upfront');
    const savingsIn = sum((t) => t.cls === 'savings_in');
    const savingsOut = sum((t) => t.cls === 'savings_out');
    const netSavings = savingsIn - savingsOut;
    const consumption = mandatory + variableEssential + discretionary + unexpectedEss + unexpectedDisc;
    const remaining = income - consumption - upfront;
    const bills = state.bills.filter((b) => b.month === monthIndex);
    const unpaid = bills.filter((b) => b.status !== 'paid');
    const essentialTotal = mandatory + variableEssential + unexpectedEss;
    const ratio = (x) => (income ? x / income : 0);
    const c = state.counters;
    const ladder = [
      { key: 'survive', label: 'Got through the month', reached: true },
      { key: 'essentials', label: 'Essentials covered', reached: unpaid.length === 0 && c.missedMeals <= 3 && c.outageDays <= 1, detail: `${unpaid.length} unpaid bill${unpaid.length === 1 ? '' : 's'}, ${c.missedMeals} missed meal${c.missedMeals === 1 ? '' : 's'}` },
      { key: 'buffer', label: 'Emergency buffer', reached: state.savings >= Math.round(income * 0.1), detail: `Savings ${M.format(state.savings)} vs 10% of income ${M.format(Math.round(income * 0.1))}` },
      { key: 'saving', label: 'Saved money this month', reached: netSavings > 0, detail: `Net to savings ${M.format(netSavings)}` },
      { key: 'freedom', label: 'Room for personal choice', reached: unpaid.length === 0 && ratio(discretionary + unexpectedDisc) >= 0.1, detail: `${Math.round(ratio(discretionary + unexpectedDisc) * 100)}% of income on optional things` },
    ];
    return {
      monthIndex, year: state.date.year, month: state.date.month, income, salary, extraIncome,
      mandatory, variableEssential, discretionary, unexpectedEss, unexpectedDisc, unexpected: unexpectedEss + unexpectedDisc,
      upfront, savingsIn, savingsOut, netSavings, consumption, remaining,
      walletEnd: state.wallet, savingsEnd: state.savings,
      essentialRatio: ratio(essentialTotal), discretionaryRatio: ratio(discretionary + unexpectedDisc), savingsRate: ratio(netSavings),
      unpaid: unpaid.map((b) => ({ label: b.label, amount: b.amount })), unpaidTotal: unpaid.reduce((s, b) => s + b.amount, 0),
      counters: { ...c }, wellbeing: state.wellbeing, ladder,
      byCategory: groupBy(txs.filter((t) => t.amount < 0 && !t.cls.startsWith('savings')), (t) => t.category),
    };
  }
  function groupBy(txs, keyFn) {
    const m = {};
    for (const t of txs) m[keyFn(t)] = (m[keyFn(t)] || 0) + Math.abs(t.amount);
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }

  function startNextMonth(state) {
    if (state.phase !== 'report') return { ok: false, error: 'month_not_finished' };
    state.reports.push(state.lastReport || generateMonthlyReport(state));
    const next = addDays({ ...state.date }, 1);
    state.date = next;
    state.monthIndex++;
    state.phase = 'play';
    state.counters = freshCounters();
    state.electricity.lastMonthKwh = state.electricity.kwhUsedMonth || null;
    state.electricity.kwhUsedMonth = 0;
    state.lastReport = null;
    payday(state);
    if (state.pendingMove) {
      const h = getHousing(state.config.cityId, state.pendingMove);
      state.config.housingId = state.pendingMove;
      state.pendingMove = null;
      if (h && h.deposit > 0) chargeOrFail(state, { merchant: 'New landlord', category: 'Housing', cls: 'upfront', amount: h.deposit, note: 'Move-in deposit (one-off)' });
      notify(state, 'homebase', 'You moved', h ? h.label : 'New home', 'info');
    }
    generateMonthlyBills(state);
    startOfDay(state);
    return { ok: true };
  }

  // ────────────────────────────────────────────────────────────────────
  // Comparison: a planned month, no gameplay randomness
  // ────────────────────────────────────────────────────────────────────
  function estimateMonthlyBudget(cfgIn) {
    const cfg = defaultConfig(cfgIn);
    const wage = resolveWage(cfg.cityId);
    const pay = calculateNetIncome(wage.amount, cfg.scenario);
    const income = cfg.wageTreatment === 'gross' ? pay.gross : pay.net;
    const housing = getHousing(cfg.cityId, cfg.housingId) || getHousing(cfg.cityId, 'kost_typical');
    const rent = housing.type === 'family' ? cfg.familyContribution : housing.monthlyRent;
    const elec = housing.includes.electricity ? 0 : estimateElectricity(cfg.electricity, cfg.ppjBp).total;
    const water = housing.includes.water ? 0 : cfg.waterBill;
    const wd = workdaysInMonth(cfg.startYear, cfg.startMonth, cfg.workweek);
    const plans = commutePlans(cfg.cityId, cfg.distanceKm, cfg);
    const pre = commutePresets(plans, wd);
    const plan = plans.find((p) => p.id === (cfg.commutePlanId || pre.cheapest));
    const transport = monthlyCommuteCost(plan, wd) || 0;
    const basket = D().baskets[cfg.basket || 'standard'];
    const groceries = calculateGroceryBasket(basket.lines.map(([itemId, qty]) => ({ itemId, qty })), cfg).total;
    const phone = housing.includes.internet ? D().connect.dataPlans[1].price : D().connect.dataPlans[1].price;
    const mandatory = rent + elec + water;
    const essentials = mandatory + transport + groceries + phone;
    return {
      cfg, wage, pay, income, housing, rent, elec, water, transport, plan, groceries, phone,
      mandatory, essentials, remaining: income - essentials, workdays: wd,
    };
  }

  // ────────────────────────────────────────────────────────────────────
  // Persistence
  // ────────────────────────────────────────────────────────────────────
  function serialize(state) { return JSON.stringify(state); }
  function deserialize(json) {
    const s = JSON.parse(json);
    if (!s || s.version !== STATE_VERSION) return null;
    return s;
  }

  RLS.engine = {
    STATE_VERSION, MONTHS, WEEKDAYS, TOKEN_NOMINALS, TARIFFS, OJOL_ZONES, EVENTS,
    mulberry32, hashSeed, daysInMonth, weekday, workdaysInMonth, isWorkday, dayNumber, addDays, dateLabel,
    getLocality, citiesForProvince, resolveWage, calculateNetIncome, calculateStartingBalance, overtimePay,
    housingOptions, getHousing, calculateMonthlyRent, planMove,
    defaultElectricity, estimateElectricity, tokenBreakdown,
    transportModes, commutePlans, commutePresets, monthlyCommuteCost, ojolFare,
    priceOf, priceStatus, isItemAvailable, calculateGroceryBasket,
    defaultConfig, createGame, processPurchase, processBillPayment, setAutopay, billsThisMonth,
    buyToken, buyDataPlan, buyDevice, setHomeInternet, hasWifi, hasMobileData, isOnline, electricityOn,
    subscribe, cancelSubscription, processSavingsTransfer, addGoal,
    currentCommutePlan, setCommute, mealsNeeded, canCook, homeMealsAvailable,
    advanceSimulationDay, resolveEvent, generateMonthlyReport, startNextMonth,
    estimateMonthlyBudget, serialize, deserialize, notify, chargeOrFail, updateConfig, toggleWishlist, bookRide,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = RLS.engine;
})(typeof globalThis !== 'undefined' ? globalThis : this);
