/*
 * engine/transport.js — commute plans, ride-hailing providers and tiers,
 * one-off rides with uncertain outcomes, safety choices, and daily commute
 * effects (cost, delays, punctuality, energy, stress).
 *
 * Incident chances are GAME PARAMETERS, not statistics. Providers are fictional.
 */
(function (root) {
  const RLS = root.RLS;
  const E = RLS.engine;
  const M = RLS.money;
  const { rp } = M;
  const { bi, L } = RLS.i18n;
  const D = () => RLS.data;
  const { clamp } = E;

  // ride-hailing fare bands per km (game model based on zone tariffs)
  const OJOL_ZONES = {
    I: { label: bi('Zona I (Jawa di luar Jabodetabek, Bali, Sumatra)', 'Zone I (Java outside Jabodetabek, Bali, Sumatra)'), perKm: [1850, 2300], min: [9250, 11500] },
    II: { label: bi('Zona II (Jabodetabek)', 'Zone II (Jabodetabek)'), perKm: [2600, 2700], min: [13000, 13500] },
    III: { label: bi('Zona III (Kalimantan, Sulawesi, Nusa Tenggara, Maluku, Papua)', 'Zone III (Kalimantan, Sulawesi, Nusa Tenggara, Maluku, Papua)'), perKm: [2100, 2600], min: [10500, 13000] },
  };
  const ZONE_I = new Set(['aceh', 'sumut', 'sumbar', 'riau', 'jambi', 'sumsel', 'bengkulu', 'lampung', 'babel', 'kepri', 'jabar', 'jateng', 'diy', 'jatim', 'banten', 'bali']);
  function ojolZone(city) {
    if (['jakarta', 'krl', 'krl_lrt'].includes(city.transport) && ['dki', 'banten', 'jabar'].includes(city.provinceId) && city.tier !== 'D') return 'II';
    return ZONE_I.has(city.provinceId) ? 'I' : 'III';
  }
  const FUEL_PER_L = rp(10000), MOTOR_KM_PER_L = 45;
  const FARES = {
    tj: () => ({ cost: rp(3500), status: 'VERIFIED', sourceId: 'transit_jkt_2026', label: bi('TransJakarta', 'TransJakarta') }),
    mikrotrans: () => ({ cost: 0, status: 'VERIFIED', sourceId: 'transit_jkt_2026', label: bi('Mikrotrans (JakLingko)', 'Mikrotrans (JakLingko feeder)') }),
    krl: (d) => ({ cost: rp(3000 + 1000 * Math.ceil(Math.max(0, d - 25) / 10)), status: 'VERIFIED', sourceId: 'transit_jkt_2026', label: bi(`KRL Commuter Line (${d} km)`, `KRL Commuter Line (${d} km)`) }),
    mrt: (d) => ({ cost: rp(clamp(4000 + 1000 * Math.floor(Math.max(0, d - 2) / 1.5), 4000, 14000)), status: 'ESTIMATED', sourceId: 'transit_jkt_2026', label: bi('MRT Jakarta', 'MRT Jakarta') }),
    lrtJbd: (d) => ({ cost: rp(Math.min(20000, Math.round((5000 + 700 * Math.max(0, d - 1)) / 100) * 100)), status: 'ESTIMATED', sourceId: 'transit_jkt_2026', label: bi('LRT Jabodebek', 'LRT Jabodebek') }),
    angkot: () => ({ cost: rp(5000), status: 'ILLUSTRATIVE', sourceId: 'game_assumption', label: bi('Angkot', 'Angkot (minibus)') }),
    bus: (d, opts) => opts.customBusFare != null ? { cost: opts.customBusFare, status: 'ILLUSTRATIVE', sourceId: 'game_assumption', label: bi('Bus kota (tarif dari kamu)', 'City bus (your fare)') } : { cost: null, status: 'UNAVAILABLE', sourceId: null, label: bi('Bus kota', 'City bus') },
  };
  function baseFare(city, km, vehicle, level = 'mid') {
    if (vehicle === 'car') {
      const lo = Math.max(15000, 3500 * km), hi = Math.max(20000, 4500 * km);
      const v = level === 'low' ? lo : level === 'high' ? hi : (lo + hi) / 2;
      return { cost: rp(Math.round(v / 500) * 500), low: rp(lo), high: rp(hi) };
    }
    const z = OJOL_ZONES[ojolZone(city)];
    const lo = Math.max(z.min[0], z.perKm[0] * km), hi = Math.max(z.min[1], z.perKm[1] * km);
    const v = level === 'low' ? lo : level === 'high' ? hi : (lo + hi) / 2;
    return { cost: rp(Math.round(v / 500) * 500), low: rp(Math.round(lo)), high: rp(Math.round(hi)) };
  }
  function ojolFare(city, km, kind, level = 'mid') {
    const b = baseFare(city, km, kind === 'car' ? 'car' : 'motor', level);
    return { ...b, status: kind === 'car' ? 'ILLUSTRATIVE' : 'ESTIMATED', sourceId: 'game_ojol_model', label: kind === 'car' ? bi(`Mobil online (${km} km)`, `Ride-hailing car (${km} km)`) : bi(`Ojek online (${km} km)`, `Ride-hailing motorbike (${km} km)`) };
  }

  // ── providers ───────────────────────────────────────────────────────
  function providersHere(cityId) {
    const { city } = E.getLocality(cityId);
    return D().world.PROVIDERS.filter((p) => p.cityTiers.includes(city.tier) && p.profiles.includes(city.transport));
  }
  /** Every provider × tier offer for a trip, with price, wait and features. */
  function rideOffers(state, km, opts = {}) {
    const { city } = E.getLocality(state.config.cityId);
    const rain = E.isRainy(state);
    const list = opts.includeUnverified ? providersHere(state.config.cityId).concat([D().world.UNVERIFIED]) : providersHere(state.config.cityId);
    const offers = [];
    for (const p of list) {
      for (const [tier, t] of Object.entries(p.tiers)) {
        const b = baseFare(city, km, t.vehicle, state.config.fareLevel);
        let mult = t.mult * (rain && p.kind === 'app' ? 1.25 : 1);
        const price = M.roundTo(Math.round(b.cost * mult), rp(500));
        const wait = [t.wait[0] + (rain ? 3 : 0), t.wait[1] + (rain ? 8 : 0)];
        offers.push({ key: `${p.id}:${tier}`, provider: p, tier, vehicle: t.vehicle, price, low: t.haggle ? M.roundTo(Math.round(b.cost * t.haggle[0]), rp(500)) : price, high: t.haggle ? M.roundTo(Math.round(b.cost * t.haggle[1]), rp(500)) : price,
          wait, rainSurge: rain && p.kind === 'app', haggle: !!t.haggle, status: p.kind === 'app' ? 'ESTIMATED' : 'ILLUSTRATIVE' });
      }
    }
    return offers;
  }
  const TIER_LABEL = { econ: bi('Hemat', 'Economy'), standard: bi('Standar', 'Standard'), comfort: bi('Nyaman', 'Comfort') };

  /*
   * Book a one-off ride. choices: { verify: bool, share: bool }.
   * Outcome is seeded by day + offer: cancellation (retry), fare change (informal),
   * lateness, route deviation, and a rare unsafe situation.
   */
  function bookRide(state, offerKey, km, choices = {}) {
    if (!E.isOnline(state) && !offerKey.startsWith('pangkalan')) return { ok: false, error: 'offline' };
    const offer = rideOffers(state, km, { includeUnverified: offerKey.startsWith('unverified') }).find((o) => o.key === offerKey);
    if (!offer) return { ok: false, error: 'unknown' };
    const p = offer.provider;
    const r = E.rng(state, 'ride', offerKey, state.counters.rides);
    const log = [];
    let price = offer.haggle ? M.roundTo(offer.low + Math.round((offer.high - offer.low) * r()), rp(500)) : offer.price;
    let wait = E.rint(r, offer.wait[0], offer.wait[1]);
    if (r() < p.cancel) { wait += E.rint(r, 5, 15); log.push(bi('Pengemudi pertama membatalkan; kamu menunggu yang lain.', 'The first driver cancelled; you waited for another.')); }
    if (p.fareChange && r() < p.fareChange) { const bump = M.roundTo(Math.round(price * (0.2 + r() * 0.3)), rp(1000)); price += bump; log.push(bi(`Di tengah jalan pengemudi minta tambahan ${M.format(bump)}.`, `Mid-way the driver asked for ${M.format(bump)} more.`)); }
    if (choices.verify && p.verify === 'unknown' && r() < 0.3) {
      state.counters.rides++;
      return { ok: true, cancelled: true, log: [bi('Pelat nomor tidak sesuai dengan yang dijanjikan. Kamu membatalkan dan tidak jadi naik.', 'The plate number did not match. You cancelled and did not get in.')], price: 0 };
    }
    // safety roll (game parameter)
    let risk = 0.0008 * p.risk * (choices.share && p.share ? 0.6 : 1) * (choices.verify ? 0.6 : 1) * (state.date && E.isRainy(state) ? 1.1 : 1);
    const deviation = r() < 0.01 * p.risk;
    if (deviation) log.push(bi('Pengemudi mengambil rute yang tidak biasa; perjalanan sedikit lebih lama.', 'The driver took an unusual route; the trip took a little longer.'));
    const res = E.chargeOrFail(state, { merchant: bi(`${L(p.name)} ${TIER_LABEL[offer.tier].id}`, `${L(p.name)} ${TIER_LABEL[offer.tier].en}`), category: 'transport', cls: 'essential', amount: price, note: bi(`Perjalanan ${km} km · tunggu ${wait} menit`, `${km} km trip · ${wait} min wait`) });
    if (!res.ok) return res;
    state.counters.rides++;
    E.applyMood(state, { stress: wait > 20 ? 3 : 0, energy: offer.vehicle === 'car' ? 2 : 0 });
    if (r() < risk) queueSafetyIncident(state, p, choices);
    return { ok: true, price, wait, log, tx: res.tx };
  }
  function queueSafetyIncident(state, provider, choices) {
    state.todayLog.incident = true;
    E.queueEvent(state, 'unsafe_ride', { provider: provider.id, sos: !!provider.sos, shared: !!(choices.share && provider.share) });
  }
  Object.assign(E, { OJOL_ZONES, ojolZone, ojolFare, providersHere, rideOffers, bookRide, TIER_LABEL });

  // ── commute plans (unchanged logic from v0.1, plus provider rides) ──
  function transportModes(cityId) {
    const { city } = E.getLocality(cityId);
    const p = city.transport;
    const m = [];
    const push = (id, label, fare, availability = 'available', note = null) => m.push({ id, label, fare, availability, note });
    if (p === 'jakarta') {
      push('tj', bi('TransJakarta (bus rapid transit)', 'TransJakarta bus rapid transit'), bi('Rp3.500 flat · Rp2.000 sebelum 07.00', 'Rp3,500 flat · Rp2,000 before 07:00'));
      push('mikrotrans', bi('Mikrotrans (angkot JakLingko)', 'Mikrotrans feeder minibuses'), bi('Gratis', 'Free'));
      push('mrt', bi('MRT Jakarta', 'MRT Jakarta'), bi('Rp4.000–14.000 sesuai jarak', 'Rp4,000–14,000 by distance'), 'route', bi('Hanya jalur Utara–Selatan.', 'North–South line only.'));
      push('lrtJkt', bi('LRT Jakarta', 'LRT Jakarta'), bi('Rp5.000 flat', 'Rp5,000 flat'), 'route', bi('Hanya koridor Velodrome–Pegangsaan Dua.', 'Velodrome–Pegangsaan Dua only.'));
      push('krl', bi('KRL Commuter Line', 'KRL Commuter Line'), bi('Rp3.000 untuk 25 km pertama, +Rp1.000 per 10 km', 'Rp3,000 first 25 km, +Rp1,000 per 10 km'));
    }
    if (p === 'krl' || p === 'krl_lrt') {
      push('krl', bi('KRL Commuter Line', 'KRL Commuter Line'), bi('Rp3.000 untuk 25 km pertama, +Rp1.000 per 10 km', 'Rp3,000 first 25 km, +Rp1,000 per 10 km'));
      if (p === 'krl_lrt') push('lrtJbd', bi('LRT Jabodebek', 'LRT Jabodebek'), bi('Rp5.000 + Rp700/km, maks Rp20.000 jam sibuk', 'Rp5,000 + Rp700/km, max Rp20,000 at peak'), 'route', bi('Jalur Bekasi & Cibubur ke Dukuh Atas.', 'Bekasi and Cibubur lines to Dukuh Atas.'));
      push('angkot', bi('Angkot', 'Angkot minibuses'), bi('Tarif belum dimuat — game pakai Rp5.000', 'Fare not loaded — game uses Rp5,000'));
    }
    if (p === 'city_bus') {
      push('bus', city.bus || bi('Bus kota', 'City bus'), bi('Tarif belum dimuat — masukkan tarifmu', 'Fare not loaded — enter yours'), 'reported', bi('Layanan dilaporkan ada; cek rute dan tarif setempat.', 'Service is reported; check routes and fares locally.'));
      push('angkot', bi('Angkot', 'Angkot minibuses'), bi('Tarif belum dimuat — game pakai Rp5.000', 'Fare not loaded — game uses Rp5,000'));
    }
    if (p === 'basic') push('angkot', bi('Angkot', 'Angkot minibuses'), bi('Tarif belum dimuat — game pakai Rp5.000', 'Fare not loaded — game uses Rp5,000'));
    if (p === 'remote') push('angkot', bi('Angkot atau ojek pangkalan', 'Angkot or ojek stand'), bi('Ditawar — game pakai Rp5.000 per jalan', 'Negotiated — game uses Rp5,000 per leg'), 'limited');
    for (const pr of providersHere(cityId)) push('prov_' + pr.id, pr.name, bi(`${Object.keys(pr.tiers).map((t) => TIER_LABEL[t].id).join(', ')}`, `${Object.keys(pr.tiers).map((t) => TIER_LABEL[t].en).join(', ')}`), pr.kind === 'informal' ? 'available' : p === 'remote' ? 'uncertain' : 'available', pr.label);
    push('motorcycle', bi('Motor sendiri', 'Own motorcycle'), bi('Bensin, parkir, perawatan', 'Fuel, parking, upkeep'));
    push('bike', bi('Sepeda atau jalan kaki', 'Bicycle or walking'), bi('Gratis', 'Free'));
    return m;
  }
  function commutePlans(cityId, distanceKm, opts = {}) {
    const { city } = E.getLocality(cityId);
    const d = clamp(Math.round(distanceKm), 1, 60);
    const level = opts.fareLevel || 'mid';
    const p = city.transport;
    const plans = [];
    const plan = (id, label, legs, extra = {}) => {
      const missing = legs.find((l) => l.cost == null);
      const perTrip = missing ? null : legs.reduce((s, l) => s + l.cost, 0);
      plans.push({ id, label, legs, perTrip, dailyExtra: extra.dailyExtra || 0, monthlyFixed: extra.monthlyFixed || 0, available: !missing && extra.available !== false,
        reason: missing ? bi('Tarif belum dimuat. Masukkan tarif yang kamu bayar.', 'Fare not loaded. Enter the fare you pay to use this option.') : extra.reason || null, tags: extra.tags || [], note: extra.note || null, delay: extra.delay || 0, outdoor: !!extra.outdoor });
    };
    const ojFeeder = ojolFare(city, 3, 'motor', level);
    if (p === 'jakarta') {
      plan('tj', bi('Mikrotrans + TransJakarta', 'Mikrotrans + TransJakarta'), [FARES.mikrotrans(), FARES.tj()], { tags: ['public'], delay: 0.06 });
      plan('krl_tj', bi('KRL + TransJakarta', 'KRL + TransJakarta'), [FARES.krl(d), FARES.tj()], { tags: ['public'], delay: 0.05 });
      plan('mrt', bi('MRT Jakarta', 'MRT Jakarta'), [FARES.mrt(d)], { tags: ['public'], delay: 0.02, note: bi('Hanya jika rumah dan kantor di jalur Utara–Selatan.', 'Only if home and work are on the North–South line.') });
    }
    if (p === 'krl' || p === 'krl_lrt') {
      plan('angkot_krl', bi('Angkot + KRL', 'Angkot + KRL'), [FARES.angkot(), FARES.krl(d)], { tags: ['public'], delay: 0.06 });
      plan('ojol_krl', bi('Ojek online ke stasiun + KRL', 'Ride-hailing to station + KRL'), [ojFeeder, FARES.krl(d)], { tags: ['public'], delay: 0.04 });
      if (p === 'krl_lrt') plan('lrt_jbd', bi('Angkot + LRT Jabodebek', 'Angkot + LRT Jabodebek'), [FARES.angkot(), FARES.lrtJbd(d)], { tags: ['public'], delay: 0.03, note: bi('Hanya jika rutemu mengikuti jalur Bekasi/Cibubur.', 'Only if your route follows the Bekasi or Cibubur line.') });
    }
    if (p === 'city_bus') plan('bus', city.bus ? bi(city.bus, city.bus) : bi('Bus kota', 'City bus'), [FARES.bus(d, opts)], { tags: ['public'], delay: 0.07 });
    if (p === 'city_bus' || p === 'basic' || p === 'remote') {
      const legs = d > 8 ? [FARES.angkot(), FARES.angkot()] : [FARES.angkot()];
      plan('angkot', d > 8 ? bi('Dua kali naik angkot', 'Two angkot legs') : bi('Angkot', 'Angkot'), legs, { tags: ['public'], delay: 0.08, outdoor: true });
    }
    // ride-hailing commute uses the chosen provider and tier
    const ride = opts.ride || { provider: 'gesit', tier: 'standard' };
    const prov = providersHere(cityId).find((x) => x.id === ride.provider) || providersHere(cityId).find((x) => x.kind === 'app') || providersHere(cityId)[0];
    if (prov) {
      const tierKey = prov.tiers[ride.tier] ? ride.tier : Object.keys(prov.tiers)[0];
      const t = prov.tiers[tierKey];
      const b = baseFare(city, d, t.vehicle, level);
      const price = M.roundTo(Math.round(b.cost * t.mult), rp(500));
      plan('ojol', bi(`${L(prov.name)} ${TIER_LABEL[tierKey].id} (${t.vehicle === 'car' ? 'mobil' : 'motor'})`, `${L(prov.name)} ${TIER_LABEL[tierKey].en} (${t.vehicle})`), [{ cost: price, status: 'ESTIMATED', sourceId: 'game_ojol_model', label: bi(`${d} km`, `${d} km`) }],
        { tags: ['door'], delay: prov.cancel * 0.6, provider: prov.id, outdoor: t.vehicle === 'motor', reason: p === 'remote' ? bi('Layanan bisa tidak menentu di sini.', 'Service may be patchy here.') : null });
      plans[plans.length - 1].provider = prov.id; plans[plans.length - 1].tier = tierKey; plans[plans.length - 1].vehicle = t.vehicle;
    }
    const fuelPerTrip = Math.round((d / MOTOR_KM_PER_L) * FUEL_PER_L);
    plan('motorcycle', bi('Motor sendiri', 'Own motorcycle'), [{ cost: fuelPerTrip, status: 'ESTIMATED', sourceId: 'game_assumption', label: bi(`Bensin ${d} km (45 km/L, Rp10.000/L)`, `Fuel, ${d} km at 45 km/L, Rp10,000/L`) }], {
      dailyExtra: rp(2000), monthlyFixed: rp(80000) + (opts.motorcycleCredit ? rp(750000) : 0), tags: ['own'], delay: 0.02, outdoor: true,
      note: bi('Parkir Rp2.000/hari; pajak & servis Rp80.000/bulan' + (opts.motorcycleCredit ? '; cicilan Rp750.000/bulan.' : '; motor diasumsikan sudah lunas.'), 'Parking Rp2,000/day; tax and servicing Rp80,000/month' + (opts.motorcycleCredit ? '; instalment Rp750,000/month.' : '; assumes the bike is paid off.')),
    });
    if (d <= 6) plan('bike', d <= 2 ? bi('Jalan kaki', 'Walk') : bi('Sepeda', 'Bicycle'), [{ cost: 0, status: 'VERIFIED', sourceId: null, label: d <= 2 ? bi('Jalan kaki', 'Walking') : bi('Bersepeda', 'Cycling') }], { tags: ['free'], outdoor: true });
    return plans;
  }
  const monthlyCommuteCost = (plan, workdays) => (!plan || plan.perTrip == null ? null : plan.perTrip * 2 * workdays + plan.dailyExtra * workdays + plan.monthlyFixed);
  function commutePresets(plans, workdays) {
    const avail = plans.filter((p) => p.available).map((p) => ({ p, cost: monthlyCommuteCost(p, workdays) })).sort((a, b) => a.cost - b.cost);
    if (!avail.length) return {};
    const nonFree = avail.filter((a) => !a.p.tags.includes('free'));
    const practical = avail.filter((a) => a.p.tags.includes('public') || a.p.tags.includes('free'));
    const cheapest = (practical[0] || avail[0]).p;
    const convenience = (avail.find((a) => a.p.id === 'ojol') || avail[avail.length - 1]).p;
    const mid = nonFree.length ? nonFree[Math.floor(nonFree.length / 2)] : avail[0];
    return { cheapest: cheapest.id, balanced: mid.p.id, convenience: convenience.id };
  }
  function currentCommutePlan(state) {
    const c = state.config;
    const plans = commutePlans(c.cityId, state.job && state.job.distanceKm ? state.job.distanceKm : c.distanceKm, c);
    return plans.find((p) => p.id === c.commutePlanId && p.available) || null;
  }
  function setCommute(state, patch) {
    Object.assign(state.config, patch);
    const plan = currentCommutePlan(state);
    if (plan && plan.monthlyFixed && !E.billsThisMonth(state).some((b) => b.key === 'motorcycle'))
      E.addBill(state, { key: 'motorcycle', label: bi('Pajak & servis motor' + (state.config.motorcycleCredit ? ' + cicilan' : ''), 'Motorcycle tax & servicing' + (state.config.motorcycleCredit ? ' + instalment' : '')), category: 'transport', amount: plan.monthlyFixed, dueDay: Math.max(15, state.date.day) });
  }
  /** Charge today's commute and decide punctuality. Returns { ok, late, minutes }. */
  function runCommute(state) {
    if (state.job && state.job.arrangement === 'remote') return { ok: true, late: false, none: true, remote: true };
    const plan = currentCommutePlan(state);
    if (!plan) return { ok: true, late: false, none: true };
    const r = E.rng(state, 'commute');
    const rain = E.isRainy(state);
    let amount = plan.perTrip * 2 + plan.dailyExtra;
    if (plan.id === 'ojol' && rain) amount = M.roundTo(Math.round(amount * 1.25), rp(500));
    let note = bi('Pergi-pulang kerja', 'Commute: home → work → home');
    let extraStress = 0;
    if (rain && plan.outdoor && !state.owned.raincoat && !state.owned.umbrella) { extraStress += 3; E.applyMood(state, { comfort: -8, happiness: -2 }); }
    if (amount > 0) {
      const res = E.chargeOrFail(state, { merchant: plan.label, category: 'transport', cls: 'essential', amount, note: rain && plan.id === 'ojol' ? bi('Pergi-pulang · tarif hujan', 'Commute · rain pricing') : note, quiet: true });
      if (!res.ok) return { ok: false };
    }
    let delayP = plan.delay * (rain ? 2 : 1);
    let minutes = 0;
    if (r() < delayP) minutes = E.rint(r, 10, 45);
    E.applyMood(state, { stress: extraStress + (minutes ? 3 : 0), energy: plan.vehicle === 'car' ? 2 : plan.id === 'bike' ? -4 : plan.tags.includes('public') ? -2 : 0 });
    return { ok: true, late: minutes >= 15, minutes, plan };
  }
  Object.assign(E, { transportModes, commutePlans, commutePresets, monthlyCommuteCost, currentCommutePlan, setCommute, runCommute });
})(typeof globalThis !== 'undefined' ? globalThis : this);
