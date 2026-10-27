/*
 * engine/food.js — food inventory, storage, recipes, meals, nutrition, spoilage,
 * and household supplies.
 *
 * Food is stored as batches: { type, qty (portions), unitValue, expiresAbs, storage }.
 * Cooking takes the soonest-expiring usable portions first. Spoiled food is
 * removed and logged as waste at its purchase value; it is never charged twice.
 * Nutrition values are rough estimates (data/food.js) and are judged over
 * several days, not meal by meal.
 */
(function (root) {
  const RLS = root.RLS;
  const E = RLS.engine;
  const M = RLS.money;
  const { rp } = M;
  const { bi, L } = RLS.i18n;
  const D = () => RLS.data;
  const { clamp } = E;
  const ING = () => D().food.INGREDIENTS;
  const SLOTS = ['breakfast', 'lunch', 'dinner'];
  const SLOT_LABEL = { breakfast: bi('Sarapan', 'Breakfast'), lunch: bi('Makan siang', 'Lunch'), dinner: bi('Makan malam', 'Dinner') };
  const FRIDGE_CAP = 40;

  function initFood(state) {
    state.supplies = { water: 2, soap: 5, shampoo: 4, toothpaste: 6, toothbrush: 60, laundry: 3, dish: 5, gasMeals: 10, baby: 0, pads: 0, deodorant: 5, tissue: 5,
      repellent: 0, homeclean: 4, coffee: 0, cleanser: 0, moisturizer: 0, sunscreen: 0, serum: 0, makeup: 0, grooming: 10 };
    if (E.members(state).infants > 0) state.supplies.baby = 2;
    if (state.config.character.menstruates) state.supplies.pads = 3;
    state.food = { batches: [], meals: {}, nutritionDays: [], waste: [] };
    addFoodBatch(state, { itemId: 'rice_medium_5', type: 'rice', qty: 8, unitValue: rp(1347) });
    addFoodBatch(state, { itemId: 'eggs_10', type: 'egg', qty: 4, unitValue: rp(2000) });
    addFoodBatch(state, { itemId: 'noodle_fried', type: 'noodle', qty: 2, unitValue: rp(3500) });
    addFoodBatch(state, { itemId: 'oil_bulk', type: 'oil', qty: 10, unitValue: rp(430) });
    addFoodBatch(state, { itemId: 'salt', type: 'seasoning', qty: 10, unitValue: rp(100) });
    addFoodBatch(state, { itemId: 'kangkung', type: 'veg_leafy', qty: 2, unitValue: rp(2000) });
  }
  E._inits.push(initFood);

  // ── storage ─────────────────────────────────────────────────────────
  const hasFridge = (state) => !!(state.owned.items.fridge) && E.electricityOn(state);
  const ownsFridge = (state) => !!state.owned.items.fridge;
  const perishable = (type) => ING()[type].shelf.room < 30;
  const STAPLE_TYPES = new Set(['oil', 'seasoning']);
  function storageUse(state) {
    let pantry = 0, fridge = 0;
    for (const b of state.food.batches) { if (STAPLE_TYPES.has(b.type)) continue; if (b.storage === 'fridge') fridge += b.qty; else pantry += b.qty; }
    return { pantry, fridge, pantryCap: E.curHousing(state).capacity, fridgeCap: ownsFridge(state) ? FRIDGE_CAP : 0 };
  }
  function shelfFor(type, storage, opened) {
    const ing = ING()[type];
    if (opened && ing.opened) return ing.opened[storage];
    return ing.shelf[storage];
  }
  function addFoodBatch(state, { itemId, type, qty, unitValue, nut, name }) {
    if (!ING()[type]) return;
    const today = E.today(state);
    let left = qty;
    const make = (n, storage) => state.food.batches.push({ id: 'b' + state.seq++, itemId, type, qty: n, initial: n, unitValue, boughtAbs: today, storage, opened: false,
      expiresAbs: today + shelfFor(type, storage, false) - 1, nut: nut || null, name: name || null });
    if (perishable(type) && ownsFridge(state)) {
      const free = Math.max(0, FRIDGE_CAP - storageUse(state).fridge);
      const inFridge = Math.min(free, left);
      if (inFridge > 0) { make(inFridge, 'fridge'); left -= inFridge; }
    }
    if (left > 0) make(left, 'room');
  }
  function usable(state, types) {
    const today = E.today(state);
    return state.food.batches.filter((b) => types.includes(b.type) && b.qty > 0 && b.expiresAbs >= today).sort((a, b) => a.expiresAbs - b.expiresAbs);
  }
  const countOf = (state, types) => usable(state, types).reduce((s, b) => s + b.qty, 0);
  function take(state, types, qty) {
    const out = [];
    let need = qty;
    for (const b of usable(state, types)) {
      if (need <= 0) break;
      const n = Math.min(b.qty, need);
      b.qty -= n; need -= n;
      if (!b.opened && ING()[b.type].opened) { b.opened = true; b.expiresAbs = Math.min(b.expiresAbs, E.today(state) + shelfFor(b.type, b.storage, true) - 1); }
      out.push({ type: b.type, qty: n, value: b.unitValue * n, nut: b.nut });
    }
    state.food.batches = state.food.batches.filter((b) => b.qty > 0);
    return need <= 0 ? out : null;
  }
  function inventoryByType(state) {
    const today = E.today(state);
    const map = {};
    for (const b of state.food.batches) {
      if (b.expiresAbs < today) continue;
      const m = (map[b.type] = map[b.type] || { type: b.type, qty: 0, soonest: Infinity, fridge: 0 });
      m.qty += b.qty; m.soonest = Math.min(m.soonest, b.expiresAbs); if (b.storage === 'fridge') m.fridge += b.qty;
    }
    return Object.values(map).sort((a, b) => a.soonest - b.soonest);
  }
  Object.assign(E, { hasFridge, ownsFridge, storageUse, addFoodBatch, inventoryByType, countOf, SLOTS, SLOT_LABEL, FRIDGE_CAP });

  // ── cooking ─────────────────────────────────────────────────────────
  function fuelOk(state, fuel) {
    if (fuel === 'none') return true;
    const gas = state.supplies.gasMeals > 0;
    const elec = !!(state.owned.items.ricecooker && state.config.electricity.electricCooking && E.electricityOn(state));
    return fuel === 'stove' ? gas : gas || elec;
  }
  /** Why a recipe can or can't be cooked right now, for `servings` people. */
  function recipeStatus(state, recipe, servings = E.servings(state), opts = {}) {
    const reasons = [];
    const c = E.cond(state);
    const helper = opts.helper;
    if (!helper) {
      const sick = c.cook === 'none' && !(recipe.sickOk && state.health.severity < 2) && recipe.fuel !== 'none';
      if (sick) reasons.push(bi('Badanmu tidak memungkinkan untuk memasak', 'You are not well enough to cook'));
      if (recipe.effort === 'normal' && (c.cook !== 'normal' || state.mood.energy < 25)) reasons.push(bi('Terlalu lelah untuk memasak menu lengkap', 'Too tired to cook a full meal'));
      if (recipe.effort === 'simple' && state.mood.energy < 8 && recipe.fuel !== 'none') reasons.push(bi('Energi hampir habis', 'Almost out of energy'));
    }
    if (!fuelOk(state, recipe.fuel)) reasons.push(recipe.fuel === 'stove' ? bi('Gas LPG habis', 'Out of LPG') : bi('Tidak ada gas atau rice cooker yang menyala', 'No gas, and no working rice cooker'));
    const missing = [];
    for (const slot of recipe.needs) if (countOf(state, slot) < servings) missing.push(slot[0]);
    const oilNeed = recipe.oil ? Math.ceil((recipe.oil * servings) / 2) : 0;
    if (oilNeed && countOf(state, ['oil']) < oilNeed) missing.push('oil');
    if (missing.length) reasons.push(bi(`Bahan kurang: ${missing.map((t) => ING()[t].label.id).join(', ')}`, `Missing: ${missing.map((t) => ING()[t].label.en).join(', ')}`));
    return { ok: reasons.length === 0, reasons, missing };
  }
  function cookInto(state, recipe, servings) {
    const parts = [];
    for (const slot of recipe.needs) { const t = take(state, slot, servings); if (!t) return null; parts.push(...t); }
    const oilNeed = recipe.oil ? Math.ceil((recipe.oil * servings) / 2) : 0;
    if (oilNeed) parts.push(...(take(state, ['oil'], oilNeed) || []));
    const seasoned = recipe.seasoning ? take(state, ['seasoning'], Math.min(countOf(state, ['seasoning']), recipe.seasoning)) : [];
    if (recipe.fuel === 'stove' || (recipe.fuel === 'any' && state.supplies.gasMeals > 0)) state.supplies.gasMeals = Math.max(0, state.supplies.gasMeals - 1);
    else if (recipe.fuel === 'any') state.electricity.kwhBalance = Math.max(0, state.electricity.kwhBalance - 0.3);
    // per-serving nutrition: one portion of each ingredient slot + its share of oil
    const nut = zeroNut();
    for (const slot of recipe.needs) { const t = parts.find((p) => slot.includes(p.type)); if (t) addNut(nut, t.nut || ING()[t.type].nut); }
    if (oilNeed) addNut(nut, ING().oil.nut, Math.min(1, recipe.oil));
    const proteinTypes = parts.filter((p) => ING()[p.type].group === 'protein').map((p) => p.type);
    const vegTypes = parts.filter((p) => ['veg', 'fruit'].includes(ING()[p.type].group)).map((p) => p.type);
    return { nut, proteinTypes, vegTypes, bland: recipe.seasoning && !(seasoned && seasoned.length), value: parts.reduce((s, p) => s + p.value, 0) };
  }
  function cook(state, recipeId, slot, opts = {}) {
    const recipe = D().food.recipeById[recipeId];
    if (!recipe || !SLOTS.includes(slot)) return { ok: false, error: 'invalid' };
    if (state.food.meals[slot]) return { ok: false, error: 'already_eaten' };
    const servings = E.servings(state);
    const st = recipeStatus(state, recipe, servings, opts);
    if (!st.ok) return { ok: false, error: 'cannot_cook', reasons: st.reasons };
    const res = cookInto(state, recipe, servings);
    if (!res) return { ok: false, error: 'cannot_cook' };
    state.food.meals[slot] = { how: opts.helper ? 'helper' : 'cook', recipeId, label: recipe.name, nut: res.nut, proteinTypes: res.proteinTypes, vegTypes: res.vegTypes };
    if (!opts.helper) { E.applyMood(state, { energy: recipe.effort === 'normal' ? -4 : -1, happiness: recipe.tier === 'varied' || recipe.tier === 'premium' ? 2 : recipe.tier === 'low' ? -1 : 1 }); state.counters.cooked++; state.todayLog.cookedMeals++; }
    if (res.bland) E.applyMood(state, { happiness: -1 });
    if (state.supplies.dish > 0 && slot === 'dinner') state.supplies.dish--;
    return { ok: true, recipe };
  }
  function bestRecipe(state, opts = {}) {
    const servings = E.servings(state);
    const rank = { varied: 0, premium: 1, balanced: 2, low: 3 };
    const cands = D().food.RECIPES.filter((r) => recipeStatus(state, r, servings, opts).ok);
    if (!cands.length) return null;
    const urgency = (r) => Math.min(...r.needs.map((slot) => { const u = usable(state, slot); return u.length ? u[0].expiresAbs : 9e9; }));
    return cands.sort((a, b) => (a.effort === 'normal' ? 0 : 1) - (b.effort === 'normal' ? 0 : 1) || urgency(a) - urgency(b) || rank[a.tier] - rank[b.tier])[0];
  }
  function eatReady(state, slot) {
    const servings = E.servings(state);
    if (countOf(state, ['meal']) < servings) return false;
    const parts = take(state, ['meal'], servings);
    const n = parts[0].nut || ING().meal.nut;
    state.food.meals[slot] = { how: 'ready', label: bi('Makanan jadi yang sudah dibeli', 'Prepared food you bought'), nut: n, proteinTypes: ['meal'], vegTypes: n.fv >= 1 ? ['veg_other'] : [] };
    return true;
  }
  Object.assign(E, { recipeStatus, cook, bestRecipe, eatReady });

  // ── buying or getting a meal now ────────────────────────────────────
  function mealOptions(state) {
    const servings = E.servings(state);
    const warteg = D().catalog.byId.warteg;
    const qbMeals = D().catalog.items.filter((i) => i.store === 'quickbite' && i.food);
    const cheapestQb = qbMeals.sort((a, b) => a.price - b.price)[0];
    const qbFood = E.priceOf(cheapestQb, state.config) * servings;
    const qbFees = E.quickbiteFees ? E.quickbiteFees(qbFood, 0).reduce((s, f) => s + f.amount, 0) : rp(11000);
    const c = E.cond(state);
    const hh = E.household(state);
    const familyHome = E.curHousing(state).type === 'family';
    const partnerAvailable = hh.partner;
    const helperRecipe = (familyHome || partnerAvailable) ? bestRecipe(state, { helper: true }) : null;
    return {
      servings,
      warung: { cost: E.priceOf(warteg, state.config) * servings, item: warteg, available: !(c.cook === 'none' && state.health.severity >= 2 && !partnerAvailable), note: c.cook === 'none' ? bi('Sedang sakit: perlu keluar sebentar ke warung.', 'You are unwell: it means a short walk out.') : null },
      delivery: { cost: qbFood + qbFees, item: cheapestQb, available: E.isOnline(state) },
      helper: { available: !!helperRecipe, recipe: helperRecipe, who: familyHome ? bi('keluarga di rumah', 'your family at home') : bi('pasanganmu', 'your partner') },
    };
  }
  function getMeal(state, slot, how) {
    if (state.food.meals[slot]) return { ok: false, error: 'already_eaten' };
    const opts = mealOptions(state);
    const n = opts.servings;
    if (how === 'skip') { state.food.meals[slot] = { how: 'skip', label: bi('Dilewati', 'Skipped'), nut: zeroNut() }; return { ok: true }; }
    if (how === 'helper') {
      if (!opts.helper.available) return { ok: false, error: 'no_helper' };
      return cook(state, opts.helper.recipe.id, slot, { helper: true });
    }
    if (how === 'family_dinner') {
      state.food.meals[slot] = { how: 'family', label: bi('Makan bersama keluarga', 'Family meal at home'), nut: { ...ING().meal.nut, fv: 1, vitA: 0.4, vitC: 0.4 }, proteinTypes: ['meal'], vegTypes: ['veg_other'] };
      return { ok: true };
    }
    const src = how === 'delivery' ? opts.delivery : opts.warung;
    if (!src.available) return { ok: false, error: how === 'delivery' ? 'offline' : 'unavailable' };
    const res = E.chargeOrFail(state, { merchant: how === 'delivery' ? bi('QuickBite', 'QuickBite') : bi('Warung dekat rumah', 'Nearby food stall'), category: 'food', cls: 'essential', amount: src.cost,
      note: bi(`${SLOT_LABEL[slot].id}: ${src.item.name.id} × ${n}`, `${SLOT_LABEL[slot].en}: ${src.item.name.en} × ${n}`) });
    if (!res.ok) return res;
    state.food.meals[slot] = { how: 'bought', label: src.item.name, nut: src.item.food.nut, proteinTypes: ['meal'], vegTypes: src.item.food.nut.fv >= 1 ? ['veg_other'] : [] };
    state.counters.boughtMeals++; state.todayLog.boughtMeals++;
    return { ok: true, cost: src.cost };
  }
  /** What happens to today's open meals if the day ends now (no money moves). */
  function previewMeals(state) {
    const plan = [];
    // everything cook()/eatReady() can touch is restored afterwards
    const snapshot = JSON.stringify({ b: state.food.batches, s: state.supplies, k: state.electricity.kwhBalance, m: state.food.meals, mood: state.mood, app: state.appearance, c: state.counters, tl: state.todayLog, seq: state.seq });
    const familyHome = E.curHousing(state).type === 'family';
    let shortfall = 0;
    for (const slot of SLOTS) {
      if (state.food.meals[slot]) { plan.push({ slot, how: state.food.meals[slot].how, label: state.food.meals[slot].label }); continue; }
      if (slot === 'dinner' && familyHome) { plan.push({ slot, how: 'family', label: bi('Makan bersama keluarga', 'Family meal at home') }); continue; }
      if (countOf(state, ['meal']) >= E.servings(state)) { eatReady(state, slot); plan.push({ slot, how: 'ready', label: state.food.meals[slot].label }); continue; }
      const r = bestRecipe(state);
      if (r) { cook(state, r.id, slot); plan.push({ slot, how: 'cook', label: r.name }); continue; }
      plan.push({ slot, how: 'none' }); shortfall++;
    }
    const s = JSON.parse(snapshot);
    state.food.batches = s.b; state.supplies = s.s; state.electricity.kwhBalance = s.k; state.food.meals = s.m; state.mood = s.mood; state.appearance = s.app; state.counters = s.c; state.todayLog = s.tl; state.seq = s.seq;
    return { plan, shortfall };
  }
  /** End of day: fill open meals automatically, then apply the player's choice for the rest. */
  function resolveMeals(state, shortfallChoice = 'skip') {
    const familyHome = E.curHousing(state).type === 'family';
    if ((state.todayLog.extraMeal || 0) > 0 && !state.food.meals.dinner) state.food.meals.dinner = { how: 'out', label: bi('Makan di luar', 'Ate out'), nut: { ...ING().meal.nut, fv: 0.8 }, proteinTypes: ['meal'], vegTypes: [] };
    for (const slot of SLOTS) {
      if (state.food.meals[slot]) continue;
      if (slot === 'dinner' && familyHome) { getMeal(state, slot, 'family_dinner'); continue; }
      if (eatReady(state, slot)) continue;
      const r = bestRecipe(state);
      if (r && cook(state, r.id, slot).ok) continue;
      let done = false;
      if (shortfallChoice && shortfallChoice !== 'skip') done = getMeal(state, slot, shortfallChoice).ok;
      if (!done) getMeal(state, slot, 'skip');
    }
    const skipped = SLOTS.filter((s) => state.food.meals[s].how === 'skip').length;
    state.counters.missedMeals += skipped;
    state.todayLog.mealsSkipped = skipped;
    if (skipped) E.applyMood(state, { happiness: -4 * skipped, energy: -6 * skipped, stress: 2 * skipped });
    // fruit & milk if available, one portion each per day
    const extras = [];
    for (const t of [['fruit', 'fruit_long'], ['milk'], ['juice']]) { const got = take(state, t, 1); if (got) extras.push(got[0]); }
    recordNutrition(state, extras);
    const meals = state.food.meals;
    state.food.meals = {};
    return { meals, skipped };
  }
  Object.assign(E, { mealOptions, getMeal, previewMeals, resolveMeals });

  // ── nutrition ───────────────────────────────────────────────────────
  function zeroNut() { return { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, vitA: 0, vitC: 0, iron: 0, calcium: 0, fv: 0 }; }
  function addNut(a, b, f = 1) { for (const k in a) a[k] += (b[k] || 0) * f; return a; }
  function recordNutrition(state, extras) {
    const day = zeroNut();
    const pt = new Set(), vt = new Set();
    let meals = 0;
    for (const slot of SLOTS) {
      const m = state.food.meals[slot];
      if (!m || m.how === 'skip') continue;
      meals++;
      addNut(day, m.nut);
      (m.proteinTypes || []).forEach((x) => pt.add(x)); (m.vegTypes || []).forEach((x) => vt.add(x));
    }
    for (const e of extras) { addNut(day, e.nut || ING()[e.type].nut); vt.add(e.type); }
    state.food.nutritionDays.push({ abs: E.today(state), ...day, meals, proteinTypes: [...pt], vegTypes: [...vt], water: state.supplies.water > 0 });
    if (state.food.nutritionDays.length > 10) state.food.nutritionDays.shift();
  }
  function reference(state) {
    const ch = state.config.character;
    const tbl = D().food.REFERENCE[ch.gender === 'male' ? 'male' : 'female'];
    const row = tbl.find(([maxAge]) => ch.age <= maxAge);
    if (ch.gender === 'other') {
      const m = D().food.REFERENCE.male.find(([a]) => ch.age <= a);
      return { kcal: (row[1] + m[1]) / 2, protein: (row[2] + m[2]) / 2 };
    }
    return { kcal: row[1], protein: row[2] };
  }
  /** Rolling 5-day evaluation. Returns score 0–100 and its parts (all estimates). */
  function nutritionScore(state) {
    const days = state.food.nutritionDays.slice(-5);
    if (!days.length) return { score: 62, days: 0, parts: null, label: bi('Belum ada data', 'No data yet') };
    const ref = reference(state);
    const avg = (k) => days.reduce((s, d) => s + d[k], 0) / days.length;
    const energyRatio = avg('kcal') / ref.kcal, proteinRatio = avg('protein') / ref.protein;
    const fv = avg('fv'), fiber = avg('fiber'), micro = (avg('vitA') + avg('vitC') + avg('iron') + avg('calcium')) / 4;
    const variety = new Set(days.flatMap((d) => d.proteinTypes.concat(d.vegTypes))).size;
    const meals = avg('meals'), hydration = days.filter((d) => d.water).length / days.length;
    const sEnergy = energyRatio < 0.6 ? 20 : energyRatio < 0.8 ? 55 : energyRatio <= 1.25 ? 100 : 75;
    const sProtein = clamp(proteinRatio * 100, 0, 100);
    const sFv = clamp((fv / D().food.FV_TARGET) * 100, 0, 100);
    const sFiber = clamp((fiber / D().food.FIBER_TARGET) * 100, 0, 100);
    const sMicro = clamp(micro * 70, 0, 100);
    const sVar = clamp(variety * 14, 0, 100);
    const sMeals = clamp((meals / 3) * 100, 0, 100);
    const score = Math.round(0.22 * sEnergy + 0.2 * sProtein + 0.15 * sFv + 0.1 * sFiber + 0.1 * sMicro + 0.1 * sVar + 0.08 * sMeals + 0.05 * hydration * 100);
    const label = score >= 75 ? bi('Cukup beragam dan teratur', 'Fairly varied and regular') : score >= 55 ? bi('Cukup, tapi kurang beragam', 'Adequate, but not very varied') : score >= 40 ? bi('Kurang beragam atau kurang porsi', 'Low variety or too little food') : bi('Sangat kurang', 'Very poor');
    return { score, days: days.length, label, parts: { energyRatio, proteinRatio, fv, fiber, variety, meals, hydration, kcal: avg('kcal'), protein: avg('protein'), ref } };
  }
  Object.assign(E, { nutritionScore, reference, zeroNut });

  // ── spoilage & waste ────────────────────────────────────────────────
  function processSpoilage(state) {
    const today = E.today(state);
    // a fridge without power for a day: chilled food keeps only as long as at room temperature
    if (ownsFridge(state) && !E.electricityOn(state)) {
      let hit = 0;
      for (const b of state.food.batches) if (b.storage === 'fridge') { const cap = today + shelfFor(b.type, 'room', b.opened) - 1; if (b.expiresAbs > cap) { b.expiresAbs = cap; hit++; } }
      if (hit) E.notify(state, 'dapur', bi('Kulkas mati', 'Fridge is off'), bi('Listrik padam, jadi makanan di kulkas cepat basi.', 'With no power, food in the fridge will spoil quickly.'), 'warn');
    }
    const spoiled = state.food.batches.filter((b) => b.expiresAbs <= today && b.qty > 0);
    if (!spoiled.length) return [];
    for (const b of spoiled) state.food.waste.push({ abs: today, month: state.monthIndex, itemId: b.itemId, type: b.type, qty: b.qty, value: b.unitValue * b.qty });
    state.food.batches = state.food.batches.filter((b) => !spoiled.includes(b));
    const value = spoiled.reduce((s, b) => s + b.unitValue * b.qty, 0);
    const names = [...new Set(spoiled.map((b) => b.type))];
    E.notify(state, 'dapur', bi('Ada makanan yang basi', 'Some food spoiled'),
      bi(`${names.map((t) => ING()[t].label.id).join(', ')} (${spoiled.reduce((s, b) => s + b.qty, 0)} porsi, senilai ${M.format(value)}) harus dibuang. Coba beli lebih sedikit atau masak yang hampir kedaluwarsa dulu.`,
        `${names.map((t) => ING()[t].label.en).join(', ')} (${spoiled.reduce((s, b) => s + b.qty, 0)} portions, worth ${M.format(value)}) had to be thrown out. Try buying less, or cook what expires first.`), 'warn');
    return spoiled;
  }
  const wasteThisMonth = (state, month = state.monthIndex) => state.food.waste.filter((w) => w.month === month).reduce((s, w) => s + w.value, 0);
  Object.assign(E, { processSpoilage, wasteThisMonth });

  // ── household supplies (daily) ──────────────────────────────────────
  function consumeSupplies(state) {
    const s = state.supplies, m = E.members(state);
    const people = m.adults + m.kids * 0.5;
    const use = (k, n) => { s[k] = Math.max(0, Math.round((s[k] - n) * 10) / 10); };
    const short = [];
    if (s.water > 0) use('water', people); else short.push('water');
    for (const k of ['soap', 'shampoo', 'toothpaste']) { if (s[k] > 0) use(k, Math.max(1, people * 0.7)); }
    use('toothbrush', 1); use('deodorant', 1); use('tissue', 0.5 + people * 0.2); use('homeclean', 1);
    use('laundry', Math.max(1, 0.6 + people * 0.3));
    if (E.wetSeason(state)) use('repellent', 1);
    if (m.infants) { if (s.baby > 0) use('baby', m.infants); else short.push('baby'); }
    if (state.health.condition === 'menstrual') { if (s.pads > 0) use('pads', 1); else short.push('pads'); }
    if (!(s.homeclean > 0)) E.applyMood(state, { happiness: -1 });
    if (short.includes('water')) { E.applyMood(state, { energy: -5, happiness: -3 }); E.notify(state, 'dailymart', bi('Air minum habis', 'Out of drinking water'), bi('Beli galon isi ulang.', 'Buy a water refill.'), 'warn'); }
    if (short.includes('baby')) { E.applyMood(state, { stress: 5, happiness: -3 }); E.notify(state, 'dailymart', bi('Popok/susu bayi habis', 'Baby supplies ran out'), bi('Popok atau susu formula perlu dibeli.', 'Diapers or formula are needed.'), 'warn'); }
    if (short.includes('pads')) { E.applyMood(state, { stress: 3, confidence: -3 }); E.notify(state, 'dailymart', bi('Pembalut habis', 'Out of sanitary pads'), bi('Beli pembalut di DailyMart.', 'Buy pads at DailyMart.'), 'warn'); }
    return short;
  }
  /** Rough daily cost of food + commute for this household, for runway estimates. */
  function estimateDailyEssentials(state) {
    const b = D().baskets;
    const quote = (k) => E.calculateGroceryBasket(b[k].lines.map(([itemId, qty]) => ({ itemId, qty })), state.config).total;
    const food = ((quote('week_everyday') * 4.3 + quote('month_staples')) / 30) * E.members(state).portions;
    const plan = E.currentCommutePlan ? E.currentCommutePlan(state) : null;
    const commute = plan && plan.perTrip ? ((plan.perTrip * 2 + plan.dailyExtra) * E.workdaysInMonth(state.date.year, state.date.month, state.config.workweek)) / 30 : 0;
    return Math.round(food + commute);
  }
  Object.assign(E, { consumeSupplies, estimateDailyEssentials });
})(typeof globalThis !== 'undefined' ? globalThis : this);
