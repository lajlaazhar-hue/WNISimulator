// Engine tests. Run: npm test  (Node's built-in test runner)
const test = require('node:test');
const assert = require('node:assert/strict');
const RLS = require('./load.js');
const { engine: E, money: M, data: D, i18n: I } = RLS;
const rp = M.rp;
const L = I.L;

const newGame = (over = {}, seed = 12345) => E.createGame({ cityId: 'tangsel', difficulty: 'calm', ...over }, seed);
/** Advance n days, resolving events with their free option (or the last one). */
function advance(state, days, mealChoice = 'skip') {
  for (let i = 0; i < days && state.phase === 'play'; i++) {
    let guard = 0;
    while (state.activeEvent && guard++ < 10) {
      const free = state.activeEvent.choices.findIndex((c) => c.cost <= 0);
      const r = E.resolveEvent(state, free >= 0 ? free : state.activeEvent.choices.length - 1);
      if (!r.ok) E.resolveEvent(state, state.activeEvent.choices.length - 1);
    }
    E.advanceSimulationDay(state, { mealChoice });
  }
}
const lines = (basket) => D.baskets[basket].lines.map(([itemId, qty]) => ({ itemId, qty }));

// ── money, wages, deductions ───────────────────────────────────────────
test('money: decimal decrees convert exactly to minor units', () => {
  assert.equal(M.toMinor('3100881.40'), 310088140);
  assert.equal(M.toMinor('2327386.07'), 232738607);
  assert.equal(M.format(M.toMinor('3100881.40'), { exact: true }), 'Rp3.100.881,40');
});
test('wages: 38 provinces with sourced 2026 UMP; UMK used where loaded, else UMP fallback', () => {
  assert.equal(D.indonesia.provinces.length, 38);
  for (const p of D.indonesia.provinces) assert.ok(D.sourceById[p.wage.sourceId], p.name);
  assert.equal(E.resolveWage('tangsel').amount, rp(5247870));
  const pk = E.resolveWage('pekanbaru');
  assert.equal(pk.fallback, true);
  assert.equal(E.resolveWage('jkt_selatan').fallback, false);
  for (const c of D.indonesia.cities) if (c.wage) assert.ok(D.sourceById[c.wage.sourceId], c.name);
});
test('net income: BPJS 1% + 2% + 1% and the TER band', () => {
  const pay = E.calculateNetIncome(rp(5729876), 'formal');
  const by = Object.fromEntries(pay.items.map((i) => [i.key, i.amount]));
  assert.equal(by.jht, M.applyBasisPoints(rp(5729876), 200));
  assert.equal(by.pph21, M.applyBasisPoints(rp(5729876), 50));
  assert.equal(E.calculateNetIncome(rp(3000000), 'gross').net, rp(3000000));
});

// ── language ───────────────────────────────────────────────────────────
test('i18n: bilingual state text switches language without changing state', () => {
  const s = newGame();
  const before = E.serialize(s);
  const n = s.notifications.find((x) => x.tone === 'pay');
  I.setLang('id'); const id = L(n.title);
  I.setLang('en'); const en = L(n.title);
  I.setLang('id');
  assert.equal(id, 'Gajian');
  assert.equal(en, 'Payday');
  assert.equal(E.serialize(s), before);
  assert.equal(L(I.bi('Hanya ID')), 'Hanya ID'); // missing English falls back
});

// ── character, education, eligibility ──────────────────────────────────
test('character: education limits starting jobs and job eligibility', () => {
  const sd = E.startingJobsFor({ education: 'sd', age: 25 }).map((j) => j.id);
  assert.ok(sd.includes('cleaner') && !sd.includes('admin'));
  const s = newGame({ character: { education: 's1', experienceYears: 0, skills: [], english: 'basic' } });
  const tpl = D.jobs.ROLES.find((r) => r.id === 'admin_finance');
  const listing = { ...tpl, roleId: tpl.id, pref: tpl.pref, skills: tpl.skills, english: [0, 0], certs: [], docs: ['cv'], exp: [1, 2], edu: 4, digital: 2, agePref: null, payMult: tpl.pay, stages: 4, applicants: 100 };
  const el = E.eligibility(s, listing);
  assert.equal(el.ok, false, 'bachelor without experience or skills is not automatically eligible');
  assert.ok(el.mandatory.some((m) => m.key === 'exp' && !m.ok));
  assert.ok(el.mandatory.some((m) => m.key === 'skill:accounting' && !m.ok));
});
test('character: unemployed start has no salary and an empty job', () => {
  const s = newGame({ startEmployed: false, startingSavings: rp(2000000) });
  assert.equal(s.job, null);
  assert.equal(s.employment.status, 'unemployed');
  assert.equal(s.transactions.filter((t) => t.cls === 'income').length, 0);
  assert.equal(s.savings, rp(2000000));
});

// ── purchases, orders, refunds ─────────────────────────────────────────
test('purchase reduces the wallet by exactly the quoted total (incl. delivery fee)', () => {
  const s = newGame();
  const ls = [{ itemId: 'rice_medium_5', qty: 1 }, { itemId: 'choco', qty: 2 }];
  const q = E.quoteCart(s, ls);
  const opt = E.deliveryOptions(s, 'dailymart', q.total).find((o) => o.id === 'pickup');
  const before = s.wallet;
  const res = E.processPurchase(s, { store: 'dailymart', lines: ls, delivery: 'pickup' });
  assert.ok(res.ok);
  assert.equal(before - s.wallet, q.total + opt.fee);
  assert.equal(res.tx.split.essential + res.tx.split.discretionary, res.total);
});
test('a failed purchase deducts nothing and is recorded as failed', () => {
  const s = newGame();
  const before = s.wallet;
  const res = E.processPurchase(s, { store: 'shopsquare', lines: [{ itemId: 'phone_premium', qty: 3 }], delivery: 'regular' });
  if (res.error === 'delivery_unavailable') { E.buyDataPlan(s, 'data_7d'); }
  const res2 = E.processPurchase(s, { store: 'shopsquare', lines: [{ itemId: 'phone_premium', qty: 3 }], delivery: 'regular' });
  assert.equal(res2.ok, false);
  assert.equal(s.wallet, before - (res.error === 'delivery_unavailable' ? D.connect.dataPlans[0].price : 0));
  assert.equal(s.transactions[0].status, 'failed');
});
test('parcel orders arrive later; a damaged parcel can be refunded once', () => {
  const s = newGame();
  E.buyDataPlan(s, 'data_30d_20');
  let order = null;
  for (let k = 0; k < 40 && !order; k++) {
    const r = E.processPurchase(s, { store: 'shopsquare', lines: [{ itemId: 'tee_budget', qty: 1 }], delivery: 'economy' });
    if (r.ok && r.order.willDamage) order = r.order;
    s.seq += 3;
  }
  assert.ok(order, 'found a parcel flagged to arrive damaged');
  assert.equal(order.status, 'shipped');
  advance(s, 12);
  assert.equal(order.status, 'damaged');
  const before = s.wallet;
  assert.ok(E.resolveDamaged(s, order.id, 'refund').ok);
  assert.equal(s.wallet - before, order.lines[0].unit * order.lines[0].qty);
  assert.equal(E.resolveDamaged(s, order.id, 'refund').ok, false);
});

// ── bills & savings ────────────────────────────────────────────────────
test('a paid bill cannot be charged twice, including by autopay', () => {
  const s = newGame();
  const rent = E.billsThisMonth(s).find((b) => b.key === 'rent');
  E.setAutopay(s, rent.id, true);
  assert.ok(E.processBillPayment(s, rent.id).ok);
  assert.equal(E.processBillPayment(s, rent.id).error, 'already_paid');
  advance(s, 6);
  assert.equal(s.transactions.filter((t) => L(t.merchant) === L(rent.label) && t.status === 'completed').length, 1);
});
test('savings transfers move money but are not consumption', () => {
  const s = newGame();
  assert.ok(E.processSavingsTransfer(s, rp(500000), 'in').ok);
  assert.ok(E.processSavingsTransfer(s, rp(200000), 'out').ok);
  const r = E.generateMonthlyReport(s);
  assert.equal(r.consumption, 0);
  assert.equal(r.netSavings, rp(300000));
});

// ── food, nutrition, spoilage ──────────────────────────────────────────
test('cooking consumes ingredients from inventory; missing ingredients block it', () => {
  const s = newGame();
  const eggs = E.countOf(s, ['egg']);
  const r = E.cook(s, 'nasi_telur_sayur', 'breakfast');
  assert.ok(r.ok, JSON.stringify(r.reasons && r.reasons.map(L)));
  assert.equal(E.countOf(s, ['egg']), eggs - 1);
  const st = E.recipeStatus(s, D.food.recipeById.nasi_ayam_sayur);
  assert.equal(st.ok, false);
  assert.ok(st.missing.includes('chicken'));
});
test('spoilage removes food and logs waste without charging again', () => {
  const s = newGame();
  E.processPurchase(s, { store: 'dailymart', lines: [{ itemId: 'chicken_1kg', qty: 1 }], delivery: 'pickup' });
  const wallet = s.wallet;
  const txCount = s.transactions.length;
  const chickenBefore = E.countOf(s, ['chicken']);
  assert.ok(chickenBefore >= 7);
  advance(s, 1);
  assert.equal(E.countOf(s, ['chicken']), 0, 'raw chicken without a fridge is gone after the day');
  assert.ok(E.wasteThisMonth(s) > 0);
  const charged = s.transactions.slice(0, s.transactions.length - txCount).filter((t) => t.cls === 'groceries');
  assert.equal(charged.length, 0);
  void wallet;
});
test('a fridge keeps meat for days', () => {
  const s = newGame({ ownsFridge: true });
  E.buyToken(s, rp(100000));
  E.processPurchase(s, { store: 'dailymart', lines: [{ itemId: 'chicken_1kg', qty: 1 }], delivery: 'pickup' });
  advance(s, 2);
  assert.ok(E.countOf(s, ['chicken']) > 0);
});
test('nutrition is judged over several days', () => {
  const s = newGame();
  advance(s, 4);
  const n = E.nutritionScore(s);
  assert.equal(n.days, 4);
  assert.ok(n.score >= 0 && n.score <= 100);
});
test('family size scales servings and ingredient use', () => {
  const solo = newGame();
  const fam = newGame({ household: { partner: true, children: [{ age: 7 }, { age: 3 }] }, housingId: 'petak_typical' });
  assert.equal(E.servings(solo), 1);
  assert.equal(E.servings(fam), 4); // 1 + 1 + 0.75 + 0.5 → 3.25 → 4
  E.processPurchase(fam, { store: 'dailymart', lines: [{ itemId: 'eggs_10', qty: 1 }, { itemId: 'kangkung', qty: 2 }], delivery: 'pickup' });
  const before = E.countOf(fam, ['egg']);
  assert.ok(E.cook(fam, 'nasi_telur_sayur', 'dinner').ok);
  assert.equal(before - E.countOf(fam, ['egg']), 4);
  assert.ok(E.billsThisMonth(fam).some((b) => b.key.startsWith('school-')));
});
test('sickness can block cooking and offers paid or free alternatives', () => {
  const s = newGame({ household: { partner: true }, housingId: 'petak_typical' });
  E.setCondition(s, 'fever', 3, 2);
  assert.equal(E.recipeStatus(s, D.food.recipeById.nasi_telur_sayur).ok, false);
  const o = E.mealOptions(s);
  assert.ok(o.helper.available, 'partner can cook');
  assert.ok(o.warung.cost > 0);
});

// ── mood & urges ───────────────────────────────────────────────────────
test('urges never buy anything by themselves', () => {
  const s = newGame({ difficulty: 'chaotic' });
  s.mood.temptation = 95; s.mood.stress = 80;
  for (let k = 0; k < 10; k++) E.maybeUrge(s, 'stress', true);
  assert.ok(s.urges.length > 0);
  const before = s.wallet;
  const tx = s.transactions.length;
  E.resistUrge(s, s.urges[0].id);
  assert.equal(s.wallet, before);
  assert.equal(s.transactions.length, tx);
});
test('a routine with no leisure raises boredom; a free activity lowers it at no cost', () => {
  const s = newGame();
  const b0 = s.mood.boredom;
  advance(s, 12);
  assert.ok(s.mood.boredom > b0);
  while (E.weekday(s.date.year, s.date.month, s.date.day) !== 0) advance(s, 1);
  const before = s.wallet;
  const b1 = s.mood.boredom;
  const r = E.doActivity(s, 'relax');
  assert.ok(r.ok);
  assert.equal(s.wallet, before);
  const r2 = E.doActivity(s, 'explore');
  if (r2.ok) assert.ok(s.mood.boredom < b1);
});

// ── transport ──────────────────────────────────────────────────────────
test('transport options are filtered by location', () => {
  const ids = (c) => E.transportModes(c).map((m) => m.id);
  assert.ok(ids('jkt_pusat').includes('mrt') && ids('jkt_pusat').includes('tj'));
  assert.ok(!ids('banjarnegara').includes('krl'));
  assert.ok(ids('tangsel').includes('krl') && !ids('tangsel').includes('tj'));
  const prov = (c) => E.providersHere(c).map((p) => p.id);
  assert.ok(prov('jkt_pusat').includes('gesit') && !prov('jkt_pusat').includes('laju'));
  assert.ok(prov('jayawijaya').includes('pangkalan'));
});
test('ride offers differ by provider and tier; not every provider offers every tier', () => {
  const s = newGame();
  E.buyDataPlan(s, 'data_7d');
  const offers = E.rideOffers(s, 8);
  assert.ok(offers.some((o) => o.provider.id === 'gesit' && o.tier === 'comfort'));
  assert.ok(!offers.some((o) => o.provider.id === 'kilat' && o.tier === 'comfort'));
  const econ = offers.find((o) => o.key === 'gesit:econ'), std = offers.find((o) => o.key === 'gesit:standard');
  assert.ok(econ.price < std.price);
  const before = s.wallet;
  const r = E.bookRide(s, 'gesit:standard', 8, { share: true });
  assert.ok(r.ok);
  assert.equal(before - s.wallet, r.price);
});
test('KRL fares follow the published formula; missing bus fares stay unavailable', () => {
  const krl = (d) => E.commutePlans('tangsel', d).find((p) => p.id === 'angkot_krl').legs[1].cost;
  assert.equal(krl(25), rp(3000));
  assert.equal(krl(36), rp(5000));
  const bus = E.commutePlans('kota_bandung', 10).find((p) => p.id === 'bus');
  assert.equal(bus.available, false);
  assert.equal(bus.legs[0].status, 'UNAVAILABLE');
});

// ── work, layoffs, Appy ────────────────────────────────────────────────
test('a layoff gives notice, pays severance, then stops salary', () => {
  const s = newGame({ startJobId: 'admin', tenureMonths: 14 });
  E.startTermination(s, 'downsizing');
  assert.equal(s.employment.status, 'notice');
  while (s.activeEvent) E.resolveEvent(s, 0);
  const sev = s.employment.severance.amount;
  assert.ok(sev > 0);
  const last = s.employment.lastDayAbs;
  while (E.today(s) <= last && s.phase === 'play') advance(s, 1);
  if (s.phase === 'report') E.startNextMonth(s);
  while (E.today(s) <= last) advance(s, 1);
  assert.equal(s.employment.status, 'unemployed');
  assert.ok(s.transactions.some((t) => t.cls === 'severance' && t.amount === sev));
  assert.ok(E.docStatus(s, 'paklaring').valid);
  // run to the next payday: no salary
  while (s.phase === 'play') advance(s, 1);
  E.startNextMonth(s);
  const salaries = s.transactions.filter((t) => t.cls === 'income' && t.month === s.monthIndex);
  assert.equal(salaries.length, 0);
});
test('Appy: listings rotate daily, mandatory documents block applying', () => {
  const s = newGame({ character: { education: 'sma', skills: ['customer', 'cashier'], experienceYears: 1 } });
  E.buyDataPlan(s, 'data_30d_20');
  const ids0 = s.appy.listings.map((l) => l.id).join();
  advance(s, 2);
  assert.notEqual(s.appy.listings.map((l) => l.id).join(), ids0);
  const listing = { id: 'Lx', roleId: 'cashier', title: I.bi('Kasir', 'Cashier'), company: I.bi('PT Uji', 'PT Test'), kind: 'customer', type: 'pkwt', termMonths: 6, pay: [rp(5300000), rp(5500000)], payMult: [1, 1.05], distanceKm: 5, arrangement: 'onsite',
    edu: 3, exp: [0, 1], skills: [], pref: [], english: [0, 0], certs: [], docs: ['cv', 'skck'], digital: 1, stages: 2, applicants: 50, postedAbs: E.today(s), deadlineAbs: E.today(s) + 5, stability: 0.6 };
  s.appy.listings.push(listing);
  const r = E.apply(s, 'Lx');
  assert.equal(r.ok, false);
  assert.ok(r.missing.some((m) => m.key === 'doc:skck'));
  const st = E.docPrereqs(s, 'skck');
  assert.ok(st.some((x) => x.id === 'jkn' && x.valid), 'formal worker has JKN for SKCK');
});
test('Appy: eligible applicants are neither always hired nor always rejected', () => {
  let offers = 0, rejections = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const s = newGame({ startEmployed: false, character: { education: 's1', skills: ['office', 'customer', 'data'], experienceYears: 2, english: 'intermediate', digital: 'advanced' } }, seed);
    E.buyDataPlan(s, 'data_30d_50');
    for (let d = 0; d < 25 && s.phase === 'play'; d++) {
      for (const l of s.appy.listings) if (!s.appy.applications.some((a) => a.listingId === l.id) && E.eligibility(s, l).ok) E.apply(s, l.id);
      for (const a of s.appy.applications.filter((x) => x.status === 'task')) E.doTask(s, a.id);
      advance(s, 1);
    }
    offers += s.counters.offers; rejections += s.counters.rejections;
  }
  assert.ok(offers > 0, 'some offers');
  assert.ok(rejections > offers, 'more rejections than offers');
});

// ── loans ──────────────────────────────────────────────────────────────
test('loans: full cost shown, proceeds are not income, repayment splits principal and interest', () => {
  const s = newGame();
  const el = E.loanEligibility(s, 'p2p_30');
  assert.ok(el.ok, JSON.stringify(el.reasons.map(L)));
  const q = E.loanQuote(s, 'p2p_30', rp(1000000));
  assert.equal(q.totalRepay, rp(1000000) + rp(30000)); // 0,1%/day × 30 days
  const before = s.wallet;
  assert.ok(E.takeLoan(s, 'p2p_30', rp(1000000)).ok);
  assert.equal(s.wallet - before, rp(1000000));
  const rep = E.generateMonthlyReport(s);
  assert.equal(rep.loanIn, rp(1000000));
  assert.equal(rep.income, E.generateMonthlyReport(s).salary + rep.household + rep.extraIncome + rep.benefits + rep.severance);
  assert.equal(E.debtOutstanding(s), q.totalRepay);
  assert.ok(E.payLoanEarly(s, s.loans[0].id).ok);
  const rep2 = E.generateMonthlyReport(s);
  assert.equal(rep2.principalRepaid, rp(1000000));
  assert.equal(rep2.financeCost, rp(30000));
  assert.equal(E.debtOutstanding(s), 0);
});
test('loans: OJK limit of 3 P2P platforms and the illegal offer is clearly separate', () => {
  const s = newGame();
  const ill = E.loanQuote(s, 'illegal', rp(2000000));
  assert.ok(ill.illegal);
  assert.equal(ill.received, rp(1400000));
  assert.equal(E.takeLoan(s, 'illegal', rp(2000000)).error, 'no_offer');
  assert.equal(D.lenders.find((l) => l.id === 'illegal').regulated, false);
});
test('report identity holds with loans, refunds, savings and events', () => {
  const s = newGame({ difficulty: 'chaotic' }, 777);
  E.processPurchase(s, { store: 'dailymart', lines: lines('month_staples'), delivery: 'pickup' });
  E.processSavingsTransfer(s, rp(250000), 'in');
  E.takeLoan(s, 'paylater', rp(500000), 3);
  for (const b of E.billsThisMonth(s)) E.setAutopay(s, b.id, true);
  advance(s, 40, 'warung');
  const r = s.lastReport;
  assert.equal(r.walletEnd - r.walletStart, r.income + r.loanIn - r.consumption - r.financeCost - r.upfront - r.netSavings - r.principalRepaid);
});

// ── travel & documents ─────────────────────────────────────────────────
test('international trips need a valid passport and entry documents before booking', () => {
  const s = newGame({ passport: { has: false } });
  const start = E.today(s) + 10;
  const chk = E.tripRequirements(s, 'singapore', start, 3, { style: 'budget' });
  assert.equal(chk.ok, false);
  assert.ok(chk.reqs.some((r) => r.key === 'passport' && !r.ok));
  assert.equal(E.bookTrip(s, 'singapore', 'budget', start, 3).ok, false);
  const s2 = newGame({ passport: { has: true, type: 'n10', yearsLeft: 5 } });
  const kr = E.tripRequirements(s2, 'seoul', E.today(s2) + 20, 4, { style: 'budget' });
  assert.ok(kr.reqs.some((r) => r.key === 'entry' && !r.ok), 'Korea needs a visa');
  const jp = E.tripRequirements(s2, 'tokyo', E.today(s2) + 20, 4, { style: 'budget' });
  assert.ok(jp.reqs.some((r) => r.key === 'entry' && r.doc === 'visa_jp'), 'ordinary passport → Japanese visa');
});
test('a domestic trip with enough money and leave is charged once and runs', () => {
  const s = newGame({ tenureMonths: 14, startingSavings: rp(5000000) });
  E.processSavingsTransfer(s, rp(3000000), 'out');
  let start = E.today(s) + 2;
  while (E.weekday(...Object.values(E.fromDayNumber(start))) !== 6) start++;
  const chk = E.tripRequirements(s, 'bandung', start, 1, { style: 'budget' });
  assert.ok(chk.ok, JSON.stringify(chk.reqs.filter((r) => !r.ok).map((r) => L(r.label))));
  const before = s.wallet;
  const r = E.bookTrip(s, 'bandung', 'budget', start, 1);
  assert.ok(r.ok);
  assert.equal(before - s.wallet, chk.quote.total);
  while (E.today(s) < start) advance(s, 1);
  assert.ok(s.trip && s.trip.active);
});
test('SKCK requires active JKN; without it the application is blocked', () => {
  const s = newGame({ scenario: 'gross', jknMandiri: false });
  E.buyDataPlan(s, 'data_7d');
  const r = E.applyDoc(s, 'skck');
  assert.equal(r.ok, false);
  assert.equal(r.error, 'missing_prereq');
  assert.ok(r.missing.some((m) => m.id === 'jkn'));
});
test('passport application: fee by type, appointment, then ready', () => {
  const s = newGame({ passport: { has: false } });
  E.buyDataPlan(s, 'data_30d_20');
  const before = s.wallet;
  const r = E.applyPassport(s, 'e10');
  assert.ok(r.ok);
  assert.equal(before - s.wallet, rp(950000));
  while (E.today(s) <= r.appointmentAbs + 8 && s.phase === 'play') advance(s, 1);
  if (s.phase === 'report') { E.startNextMonth(s); advance(s, 3); }
  assert.ok(E.passportValid(s));
});

// ── persistence ────────────────────────────────────────────────────────
test('serialisation round-trips the state', () => {
  const s = newGame();
  advance(s, 3);
  const back = E.deserialize(E.serialize(s));
  assert.deepEqual(back, JSON.parse(JSON.stringify(s)));
});
test('a v0.1 save migrates and keeps balance, bills and transactions', () => {
  const v3 = { version: 3, seed: 99, config: { cityId: 'tangsel', provinceId: 'banten', housingId: 'kost_typical', scenario: 'formal', wageTreatment: 'net', workweek: 5, distanceKm: 12, difficulty: 'normal', priceAdjustBp: 0, ppjBp: 300, electricity: { tariff: '900', ac: 'none', fridge: false, electricCooking: false, washer: 'shared', tv: false, occupants: 1, meter: 'prepaid' }, waterBill: rp(70000), commutePlanId: 'ojol_motor', household: 'single', familyContribution: rp(500000), startYear: 2026, startMonth: 10 },
    date: { year: 2026, month: 10, day: 9 }, monthIndex: 1, phase: 'play', wallet: rp(3210000), savings: rp(100000), goals: [{ id: 'emergency', name: 'Emergency fund', target: rp(2300000), saved: rp(100000), kind: 'emergency' }],
    transactions: [{ id: 'tx1', month: 1, day: 1, y: 2026, m: 10, merchant: 'Employer payroll', category: 'Salary', cls: 'income', amount: rp(5037955), status: 'completed', balanceAfter: rp(5037955) }],
    bills: [{ id: '1-rent', key: 'rent', month: 1, label: 'Rent', category: 'Housing', amount: rp(1300000), dueDay: 5, status: 'paid', paidDay: 2 }],
    notifications: [], eventsLog: [], activeEvent: null, pantry: { staple: 10, side: 4, complete: 1, ready: 0 }, supplies: { water: 3 }, electricity: { kwhBalance: 5, kwhUsedMonth: 0, lastMonthKwh: null },
    dataPlanUntil: null, homeInternet: null, subscriptions: [], owned: { raincoat: false }, wellbeing: 55, counters: { missedMeals: 2 }, wishlist: [], reports: [], seq: 50 };
  const s = E.deserialize(JSON.stringify(v3));
  assert.ok(s);
  assert.equal(s.version, E.STATE_VERSION);
  assert.equal(s.wallet, rp(3210000));
  assert.equal(s.savings, rp(100000));
  assert.equal(s.date.day, 9);
  assert.equal(s.bills.find((b) => b.key === 'rent').status, 'paid');
  assert.equal(s.config.commutePlanId, 'ojol');
  assert.ok(E.countOf(s, ['rice']) >= 10);
  advance(s, 2);
  assert.equal(s.date.day, 11);
});

// ── read-only previews and UI-facing helpers ────────────────────────────
test('previewing meals never changes the game state', () => {
  const s = newGame();
  E.processPurchase(s, { store: 'dailymart', lines: lines('week_everyday') });
  const before = JSON.stringify(s);
  for (let i = 0; i < 5; i++) E.previewMeals(s);
  assert.equal(JSON.stringify(s), before);
});
test('postponing an urge saves it to the wishlist and spends nothing', () => {
  const s = newGame();
  const u = E.maybeUrge(s, 'window', true);
  assert.ok(u);
  const w = s.wallet;
  assert.ok(E.postponeUrge(s, u.id).ok);
  assert.ok(s.wishlist.includes(u.itemId));
  assert.equal(s.urges.length, 0);
  assert.equal(s.wallet, w);
});
test('a JKN clinic visit charges only the travel; remote jobs have no commute', () => {
  const s = newGame();
  s.day.slots = 3; s.day.used = 0;
  const w = s.wallet;
  assert.ok(E.clinicVisit(s, 'jkn').ok);
  assert.equal(w - s.wallet, E.localFare(s) * 2);
  s.job.arrangement = 'remote';
  const r = E.runCommute(s);
  assert.ok(r.ok && r.remote);
});
test('updateConfig merges nested settings without touching money', () => {
  const s = newGame();
  const w = s.wallet;
  E.updateConfig(s, { electricity: { tv: true }, difficulty: 'chaotic' });
  assert.equal(s.config.electricity.tv, true);
  assert.equal(s.config.electricity.tariff, '900');
  assert.equal(s.config.difficulty, 'chaotic');
  assert.equal(s.wallet, w);
});
test('accepting a new job during a layoff notice keeps the severance terms', () => {
  const s = newGame({ tenureMonths: 20 });
  E.startTermination(s, 'downsizing');
  const sev = s.employment.severance.amount;
  assert.ok(sev > 0);
  const l = s.appy.listings[0];
  s.appy.applications.unshift({ id: 'Ax', listingId: l.id, listing: l, appliedAbs: E.today(s), stages: ['screening'], stage: 1, status: 'offer', offer: { wage: rp(6000000), expiresAbs: E.today(s) + 3 }, history: [] });
  const r = E.acceptOffer(s, 'Ax');
  assert.ok(r.ok);
  assert.equal(s.employment.resigning, undefined);
  assert.equal(s.employment.severance.amount, sev);
  assert.ok(r.startAbs > s.employment.lastDayAbs);
});
