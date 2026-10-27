/*
 * engine/shop.js — store availability, daily deals and stock, cart quotes,
 * checkout with delivery options, parcel orders (delays, damage, refunds),
 * and what each item does once it reaches you.
 *
 * Deals, stock-outs, delays and damage are FICTIONAL game events (seeded),
 * not observations of real retailers.
 */
(function (root) {
  const RLS = root.RLS;
  const E = RLS.engine;
  const M = RLS.money;
  const { rp } = M;
  const { bi, L } = RLS.i18n;
  const D = () => RLS.data;
  const { clamp } = E;

  function initShop(state) { state.orders = []; state.courses = []; state.skillProgress = {}; }
  E._inits.push(initShop);

  // ── availability ────────────────────────────────────────────────────
  function itemAvailability(item, state) {
    const cfg = state.config || state;
    const m = E.members(cfg.household ? { config: cfg } : state);
    if (item.requires === 'infant' && !m.infants) return { ok: false, hidden: true };
    if (item.requires === 'child' && !m.kids) return { ok: false, hidden: true };
    if (item.requires === 'school' && !m.school) return { ok: false, hidden: true };
    const loc = E.getLocality(cfg.cityId);
    if (loc && item.origin === 'imported' && item.store === 'dailymart' && (loc.city.tier === 'D' || loc.city.transport === 'remote'))
      return { ok: false, reason: bi('Tidak dijual di toko daerahmu', 'Not stocked in your area') };
    if (state.date && stockOut(state, item)) return { ok: false, reason: bi('Stok habis hari ini', 'Out of stock today'), stock: true };
    return { ok: true };
  }
  const isItemAvailable = (item, state) => itemAvailability(item, state).ok;
  function stockOut(state, item) {
    if (!state.seed) return false;
    const r = E.rng(state, 'stock', item.id)();
    return r < (item.need === 'basic' ? 0.02 : 0.05);
  }
  function todaysDeals(state) {
    if (!state.date) return [];
    const r = E.rng(state, 'deals');
    const pool = D().catalog.items.filter((i) => !i.service && !i.course && i.store !== 'care' && itemAvailability(i, { ...state, date: null }).ok);
    const deals = [];
    const used = new Set();
    for (let k = 0; k < 7 && pool.length; k++) {
      const it = pool[Math.floor(r() * pool.length)];
      if (used.has(it.id)) continue;
      used.add(it.id);
      const pct = [10, 15, 20, 25, 30, 35][Math.floor(r() * 6)];
      deals.push({ item: it, pct });
    }
    return deals;
  }
  function dealFor(state, item) { return todaysDeals(state).find((d) => d.item.id === item.id) || null; }
  function priceNow(state, item) {
    const base = E.priceOf(item, state.config);
    const d = dealFor(state, item);
    return d ? M.roundTo(base - M.applyBasisPoints(base, d.pct * 100), rp(100)) : base;
  }
  Object.assign(E, { itemAvailability, isItemAvailable, stockOut, todaysDeals, dealFor, priceNow });

  // ── quotes ──────────────────────────────────────────────────────────
  /** Quote for planning (no deals): used by baskets and comparison. */
  function calculateGroceryBasket(lines, config) {
    const out = [];
    let total = 0, essential = 0, discretionary = 0;
    for (const { itemId, qty } of lines) {
      const item = D().catalog.byId[itemId];
      if (!item || !Number.isInteger(qty) || qty <= 0) continue;
      const unit = E.priceOf(item, config);
      const line = unit * qty;
      total += line;
      if (item.essential) essential += line; else discretionary += line;
      out.push({ item, qty, unit, line });
    }
    return { lines: out, total, essential, discretionary };
  }
  function quoteCart(state, lines) {
    const out = [];
    let total = 0, essential = 0, discretionary = 0, saved = 0;
    for (const { itemId, qty } of lines) {
      const item = D().catalog.byId[itemId];
      if (!item || !Number.isInteger(qty) || qty <= 0) continue;
      const unit = priceNow(state, item);
      const line = unit * qty;
      saved += (E.priceOf(item, state.config) - unit) * qty;
      total += line;
      if (item.essential) essential += line; else discretionary += line;
      out.push({ item, qty, unit, line });
    }
    return { lines: out, total, essential, discretionary, saved };
  }
  const isRemote = (state) => { const { city } = E.getLocality(state.config.cityId); return city.tier === 'D' || city.transport === 'remote'; };
  function deliveryOptions(state, store, subtotal) {
    const remote = isRemote(state);
    if (store === 'dailymart') return [
      { id: 'pickup', label: bi('Ambil sendiri di toko', 'Pick up in store'), fee: 0, days: 0, available: true, note: bi('Langsung masuk persediaan.', 'Goes straight into your supplies.') },
      { id: 'instant', label: bi('Antar instan', 'Instant delivery'), fee: rp(10000) + rp(1000), days: 0, available: E.isOnline(state) && !remote, note: bi('Ongkir Rp10.000 + biaya layanan Rp1.000 (ilustratif).', 'Rp10,000 delivery + Rp1,000 service fee (illustrative).') },
    ];
    if (store === 'quickbite' || store === 'care') return [{ id: 'instant', label: bi('Langsung', 'Immediate'), fee: 0, days: 0, available: true }];
    const svc = rp(1000), extra = remote ? rp(15000) : 0, add = remote ? 3 : 0;
    return [
      { id: 'economy', label: bi('Hemat', 'Economy'), fee: rp(5000) + svc + extra, days: [5 + add, 7 + add], available: E.isOnline(state) },
      { id: 'regular', label: bi('Reguler', 'Regular'), fee: (subtotal >= rp(150000) ? 0 : rp(10000)) + svc + extra, days: [2 + add, 4 + add], available: E.isOnline(state),
        note: subtotal >= rp(150000) ? bi('Gratis ongkir (promo fiktif) untuk belanja ≥ Rp150.000.', 'Free shipping (fictional promo) on orders ≥ Rp150,000.') : null },
      { id: 'instant', label: bi('Instan hari ini', 'Same-day'), fee: rp(22000) + svc, days: [0, 0], available: E.isOnline(state) && !remote },
    ];
  }
  function quickbiteFees(foodTotal, tip) {
    if (!foodTotal) return [];
    return [
      { label: bi('Ongkos kirim (ilustratif)', 'Delivery fee (illustrative)'), amount: rp(9000) },
      { label: bi('Biaya layanan (ilustratif)', 'Service fee (illustrative)'), amount: rp(2000) },
      { label: bi('Pajak restoran 10% (perkiraan)', 'Restaurant tax 10% (estimated)'), amount: M.applyBasisPoints(foodTotal, 1000) },
      ...(tip ? [{ label: bi('Tip untuk driver', 'Tip for the rider'), amount: tip }] : []),
    ];
  }
  const quickbiteAvailable = (state) => E.getLocality(state.config.cityId).city.transport !== 'remote';
  Object.assign(E, { calculateGroceryBasket, quoteCart, deliveryOptions, quickbiteFees, quickbiteAvailable, isRemote });

  // ── checkout ────────────────────────────────────────────────────────
  const STORE_META = {
    dailymart: { merchant: bi('DailyMart', 'DailyMart'), category: 'groceries' },
    quickbite: { merchant: bi('QuickBite', 'QuickBite'), category: 'food' },
    shopsquare: { merchant: bi('ShopSquare', 'ShopSquare'), category: 'shopping' },
    glow: { merchant: bi('Glow', 'Glow'), category: 'beauty' },
    care: { merchant: bi('Apotek & klinik Care', 'Care pharmacy & clinic'), category: 'health' },
  };
  function processPurchase(state, { store, lines, delivery, fees: extraFees = [], tip = 0 }) {
    if (state.phase !== 'play') return { ok: false, error: 'not_playing' };
    if (!Array.isArray(lines) || !lines.length) return { ok: false, error: 'empty_cart' };
    for (const l of lines) {
      const item = D().catalog.byId[l.itemId];
      if (!item) return { ok: false, error: 'unknown_item', itemId: l.itemId };
      if (!Number.isInteger(l.qty) || l.qty <= 0) return { ok: false, error: 'invalid_quantity' };
      const av = itemAvailability(item, state);
      if (!av.ok) return { ok: false, error: av.stock ? 'out_of_stock' : 'item_unavailable', itemId: l.itemId };
      if (item.store !== store) return { ok: false, error: 'wrong_store' };
    }
    const quote = quoteCart(state, lines);
    let fees = [...extraFees];
    let opt = null;
    if (store === 'quickbite') {
      if (!E.isOnline(state)) return { ok: false, error: 'offline' };
      if (!quickbiteAvailable(state)) return { ok: false, error: 'unavailable_area' };
      fees = quickbiteFees(quote.total, tip);
    } else {
      const opts = deliveryOptions(state, store, quote.total);
      opt = opts.find((o) => o.id === (delivery || opts[0].id));
      if (!opt || !opt.available) return { ok: false, error: 'delivery_unavailable' };
      if (opt.fee) fees.push({ label: opt.label, amount: opt.fee });
    }
    const services = quote.lines.filter((l) => l.item.service && l.item.health && l.item.health.clinic || l.item.health && l.item.health.counseling);
    if (services.length && E.freeSlots(state) < 1) return { ok: false, error: 'no_time' };
    const feeTotal = fees.reduce((s, f) => s + f.amount, 0);
    const total = quote.total + feeTotal;
    const discShare = quote.discretionary + (quote.total ? Math.round((feeTotal * quote.discretionary) / quote.total) : 0);
    const split = { essential: total - discShare, discretionary: discShare };
    const meta = STORE_META[store];
    const res = E.chargeOrFail(state, {
      merchant: meta.merchant, category: meta.category, cls: split.discretionary === total ? 'discretionary' : split.discretionary ? 'mixed' : 'essential', amount: total,
      items: quote.lines.map((l) => ({ id: l.item.id, name: l.item.name, qty: l.qty, unit: l.unit })).concat(fees.map((f) => ({ id: 'fee', name: f.label, qty: 1, unit: f.amount }))), split,
    });
    if (!res.ok) { if (state.urges.some((u) => lines.some((l) => l.itemId === u.itemId))) E.applyMood(state, { frustration: 4 }); return { ...res, total }; }
    const parcel = opt && Array.isArray(opt.days) && opt.days[1] > 0;
    const order = { id: 'o' + state.seq++, store, placedAbs: E.today(state), lines: quote.lines.map((l) => ({ itemId: l.item.id, qty: l.qty, unit: l.unit })), fees, total, split, txId: res.tx.id, delivery: opt ? opt.id : 'instant', status: 'delivered', etaAbs: E.today(state), events: [] };
    if (parcel) {
      const r = E.rng(state, 'order', order.id);
      order.etaAbs = E.today(state) + E.rint(r, opt.days[0], opt.days[1]);
      order.status = 'shipped';
      if (r() < 0.15) { order.delayDays = E.rint(r, 1, 3); }
      if (r() < 0.05) order.willDamage = true;
      order.promisedAbs = order.etaAbs;
    } else {
      for (const l of quote.lines) applyItem(state, l.item, l.qty, l.unit);
    }
    state.orders.unshift(order);
    if (state.orders.length > 120) state.orders.length = 120;
    const desireQty = quote.lines.filter((l) => !l.item.essential).reduce((s, l) => s + l.qty, 0);
    if (desireQty) { state.counters.optionalBought += desireQty; state.todayLog.optional += quote.discretionary; }
    const urge = E.onItemsBought(state, quote.lines.map((l) => l.item.id));
    if (urge.tight && desireQty) E.applyMood(state, { anxiety: 6 });
    return { ok: true, total, tx: res.tx, order, tight: urge.tight && desireQty > 0 };
  }

  /** What an item does once you have it. */
  function applyItem(state, item, qty, unitPrice = item.price) {
    const s = state.supplies, a = state.appearance, o = state.owned;
    if (item.food) {
      const ing = D().food.INGREDIENTS[item.food.type];
      if (ing) E.addFoodBatch(state, { itemId: item.id, type: item.food.type, qty: item.food.portions * qty, unitValue: Math.round(unitPrice / item.food.portions), nut: item.food.nut || null, name: item.name });
    }
    if (item.supply) for (const [k, v] of Object.entries(item.supply)) s[k] = Math.round(((s[k] || 0) + v * qty) * 10) / 10;
    if (item.owned) {
      const key = item.owned.key;
      o.items[key] = { itemId: item.id, tier: item.tier, since: E.today(state), condition: 100 };
      if (key === 'clothing') { a.clothing = clamp(a.clothing + (item.owned.boost || 20) * qty * (item.tier === 'premium' ? 1.2 : 1), 0, 100); state.lastClothesAbs = E.today(state); }
      if (key === 'workwear') a.workwear = clamp(a.workwear + (item.owned.boost || 40) * qty, 0, 100);
      if (key === 'footwear') { a.footwear = Math.max(a.footwear, item.owned.boost || 100); if (item.owned.hobby) o.items.hobby_fitness = o.items.hobby_fitness || { itemId: item.id, condition: 100 }; }
      if (key === 'phone') o.phoneCondition = 100;
      if (key === 'charger' || key === 'case') o.phoneCondition = clamp(o.phoneCondition + (key === 'charger' ? 10 : 5), 0, 100);
      if (key === 'raincoat') o.raincoat = true;
      if (key === 'umbrella') o.umbrella = true;
      if (key === 'fridge' && !E.curHousing(state).fridge) E.notify(state, 'dapur', bi('Kulkas terpasang', 'Fridge installed'), bi('Makanan segar sekarang lebih awet. Pemakaian listrik bertambah ±30 kWh/bulan.', 'Fresh food now keeps longer. Electricity use rises by about 30 kWh a month.'), 'info');
    }
    if (item.mood) E.applyMood(state, item.mood, qty > 1 && item.need === 'desire' ? 1 + Math.log(qty) * 0.3 : 1);
    if (item.course) state.courses.push({ id: 'c' + state.seq++, itemId: item.id, skill: item.course.skill, sessionsLeft: item.course.sessions * qty, total: item.course.sessions * qty });
    if (item.health) {
      if (item.health.clinic && E.clinicVisit) E.clinicVisit(state, 'private');
      else if (item.health.counseling) { E.useSlots(state, 1); E.supportAction(state, 'professional'); }
      else if (item.health.relief) E.treatWith(state, item);
    }
  }
  function advanceOrders(state) {
    const today = E.today(state);
    for (const o of state.orders) {
      if (o.status !== 'shipped' && o.status !== 'replacement') continue;
      if (today < o.etaAbs) continue;
      if (o.delayDays) {
        o.etaAbs += o.delayDays; o.delayDays = 0; o.events.push({ abs: today, kind: 'delay' });
        E.notify(state, o.store, bi('Paket terlambat', 'Parcel delayed'), bi(`Pesananmu tertahan di gudang ekspedisi. Perkiraan tiba ${E.absLabel(o.etaAbs)}.`, `Your order is held at the courier hub. New estimate: ${E.absLabel(o.etaAbs)}.`), 'warn');
        continue;
      }
      if (o.willDamage && o.status === 'shipped') {
        o.status = 'damaged'; o.willDamage = false; o.events.push({ abs: today, kind: 'damaged' });
        E.notify(state, o.store, bi('Paket datang rusak', 'Parcel arrived damaged'), bi('Salah satu barang rusak/tidak sesuai. Pilih pengembalian dana atau penggantian di riwayat pesanan.', 'An item is damaged or wrong. Choose a refund or replacement in your order history.'), 'warn', { orderId: o.id });
        continue;
      }
      o.status = 'delivered'; o.deliveredAbs = today;
      for (const l of o.lines) applyItem(state, D().catalog.byId[l.itemId], l.qty, l.unit);
      E.notify(state, o.store, bi('Paket sudah sampai', 'Parcel delivered'), bi(`${o.lines.length} jenis barang diterima.`, `${o.lines.length} item type(s) received.`), 'info');
    }
  }
  /** Resolve a damaged parcel: refund the goods (not the shipping) or ship a replacement. */
  function resolveDamaged(state, orderId, choice) {
    const o = state.orders.find((x) => x.id === orderId);
    if (!o || o.status !== 'damaged') return { ok: false, error: 'invalid' };
    if (choice === 'replace') { o.status = 'replacement'; o.etaAbs = E.today(state) + 3; o.events.push({ abs: E.today(state), kind: 'replacement' }); return { ok: true }; }
    const goods = o.lines.reduce((s, l) => s + l.unit * l.qty, 0);
    const discGoods = o.lines.filter((l) => !D().catalog.byId[l.itemId].essential).reduce((s, l) => s + l.unit * l.qty, 0);
    E.credit(state, { merchant: bi('Pengembalian dana', 'Refund'), category: 'refund', cls: 'refund', amount: goods, note: bi(`Pesanan ${o.id}: barang rusak`, `Order ${o.id}: damaged goods`), split: { essential: goods - discGoods, discretionary: discGoods } });
    o.status = 'refunded'; o.refund = goods; o.events.push({ abs: E.today(state), kind: 'refund' });
    return { ok: true, refund: goods };
  }
  function toggleWishlist(state, itemId, postpone = false) {
    const i = state.wishlist.indexOf(itemId);
    if (i >= 0) { state.wishlist.splice(i, 1); return false; }
    state.wishlist.push(itemId);
    if (postpone) { state.counters.postponed++; E.applyMood(state, { frustration: 1, anxiety: -1 }); }
    return true;
  }
  function inventoryValue(state) { return state.food.batches.reduce((s, b) => s + b.unitValue * b.qty, 0); }
  Object.assign(E, { processPurchase, applyItem, advanceOrders, resolveDamaged, toggleWishlist, inventoryValue, STORE_META });
})(typeof globalThis !== 'undefined' ? globalThis : this);
