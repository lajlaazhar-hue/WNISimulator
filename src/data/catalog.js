/*
 * catalog.js — every product and service sold in the in-phone stores.
 *
 * Price status:
 *   VERIFIED     national consumer average from the Bapanas price panel (via press).
 *   ESTIMATED    derived from a documented method (see the item note).
 *   ILLUSTRATIVE plausible gameplay price, not an observed price.
 * Brands are fictional (see source `fictional_brands`).
 *
 * Item fields used by the engine:
 *   need       'basic' (counts as essential spending) or 'desire' (optional)
 *   appeal     0–10, how emotionally tempting it is
 *   mood       mood change when bought or used (happiness, stress, confidence, boredom, energy)
 *   food       { type, portions } → enters the food inventory (see data/food.js)
 *   supply     { key: days } → household supply counters (water, soap, …)
 *   owned      { key } → durable goods and their condition (clothing, footwear, fridge, …)
 *   service    applied immediately (haircut, clinic visit)
 *   course     { skill, sessions } → online/offline course that improves a skill
 *   durability days a durable item lasts before it is worn out
 *   requires   'infant' | 'child' | 'school' — only shown when the household has one
 */
(function (root) {
  const RLS = (root.RLS = root.RLS || {});
  RLS.data = RLS.data || {};
  const { rp } = RLS.money;
  const { bi } = RLS.i18n;

  const items = [];
  const V = 'VERIFIED', E = 'ESTIMATED', I = 'ILLUSTRATIVE', G = 'game_assumption';
  const FEB28 = 'pangan_20260228', FEB24 = 'pangan_20260224', JAN20 = 'pangan_20260120';
  const TIER_DUR = { budget: 120, standard: 240, premium: 420 };

  function add(o) {
    const it = {
      id: o.id, store: o.store, dept: o.dept, name: o.name, brand: o.brand || null, tier: o.tier,
      size: o.size || '1', unitQty: o.unitQty || 1, unitLabel: o.unitLabel || 'pcs',
      price: rp(o.price), status: o.status || I, sourceId: o.sourceId || G,
      observed: o.status === V ? (RLS.data.sourceById[o.sourceId] || {}).published : null,
      need: o.need || 'basic', appeal: o.appeal ?? (o.need === 'desire' ? 5 : 1),
      mood: o.mood || null, food: o.food || null, supply: o.supply || null, owned: o.owned || null,
      service: !!o.service, course: o.course || null, durability: o.durability || null,
      origin: o.origin || 'local', requires: o.requires || null, note: o.note || null,
      functional: o.functional || null, delivery: o.delivery || (o.store === 'dailymart' || o.store === 'quickbite' ? 'instant' : 'parcel'),
    };
    it.essential = it.need === 'basic';
    items.push(it);
    return it;
  }
  const n = (idn, en) => bi(idn, en);

  // ── DailyMart: groceries & household ───────────────────────────────
  const DM = 'dailymart';
  const f = (dept, id, name, brand, tier, size, unitQty, unitLabel, price, status, sourceId, food, extra = {}) =>
    add({ store: DM, dept, id, name, brand, tier, size, unitQty, unitLabel, price, status, sourceId, food, ...extra });
  const ricePer5 = bi('Harga = rata-rata nasional per kg × 5. Satu porsi ≈ 100 g beras.', 'Price = national average per kg × 5. One portion ≈ 100 g rice.');

  // Staples
  f('staples', 'rice_sphp_5', n('Beras SPHP Bulog 5 kg', 'Bulog SPHP rice, 5 kg'), 'Bulog SPHP', 'budget', '5 kg', 5000, 'g', 12365 * 5, V, FEB24, { type: 'rice', portions: 50 }, { note: ricePer5 });
  f('staples', 'rice_medium_1', n('Beras medium 1 kg', 'Medium rice, 1 kg'), 'Pilihan Hemat', 'budget', '1 kg', 1000, 'g', 14000, E, FEB28, { type: 'rice', portions: 10 }, { note: bi('Rata-rata nasional Rp13.473/kg ditambah selisih kemasan kecil.', 'National average Rp13.473/kg plus a small-pack markup.') });
  f('staples', 'noodle_fried', n('Mi goreng instan', 'Instant fried noodles'), 'Mie Sedap Rasa', 'budget', '85 g', 85, 'g', 3500, I, G, { type: 'noodle', portions: 1 });
  f('staples', 'noodle_5pack', n('Mi instan isi 5', 'Instant noodles, 5-pack'), 'Mie Sedap Rasa', 'budget', '5 × 85 g', 425, 'g', 16500, I, G, { type: 'noodle', portions: 5 });
  f('staples', 'flour', n('Tepung terigu 1 kg', 'Wheat flour, 1 kg'), 'Pilihan Hemat', 'budget', '1 kg', 1000, 'g', 13000, I, G, { type: 'flour', portions: 20 });
  f('staples', 'rice_medium_5', n('Beras medium 5 kg', 'Medium rice, 5 kg'), 'Sari Dapur', 'standard', '5 kg', 5000, 'g', 13473 * 5, V, FEB28, { type: 'rice', portions: 50 }, { note: ricePer5 });
  f('staples', 'bread_white', n('Roti tawar', 'White sandwich bread'), 'Roti Pagi', 'standard', '400 g', 400, 'g', 16000, I, G, { type: 'bread', portions: 6 });
  f('staples', 'potato_1', n('Kentang 1 kg', 'Potatoes, 1 kg'), null, 'standard', '1 kg', 1000, 'g', 18000, I, G, { type: 'potato', portions: 6 });
  f('staples', 'rice_premium_5', n('Beras premium 5 kg', 'Premium rice, 5 kg'), 'Ladang Prima', 'premium', '5 kg', 5000, 'g', 15368 * 5, V, FEB28, { type: 'rice', portions: 50 }, { note: ricePer5 });
  f('staples', 'bread_whole', n('Roti gandum sourdough', 'Wholemeal sourdough loaf'), 'Ladang Prima', 'premium', '500 g', 500, 'g', 45000, I, G, { type: 'bread_whole', portions: 6 }, { need: 'desire', appeal: 3 });
  f('staples', 'oats', n('Oat impor', 'Imported rolled oats'), 'Northfield', 'premium', '500 g', 500, 'g', 65000, I, G, { type: 'oat', portions: 12 }, { origin: 'imported' });
  f('staples', 'ramyeon', n('Ramyeon Korea impor', 'Imported Korean ramyeon'), 'Seoul Bowl', 'premium', '120 g', 120, 'g', 22000, I, G, { type: 'noodle', portions: 1 }, { origin: 'imported', need: 'desire', appeal: 6, mood: { happiness: 2 } });

  // Fresh produce
  f('produce', 'kangkung', n('Kangkung 1 ikat', 'Water spinach, 1 bunch'), null, 'budget', '1 ikat', 1, 'pcs', 4000, I, G, { type: 'veg_leafy', portions: 2 });
  f('produce', 'bayam', n('Bayam 1 ikat', 'Spinach, 1 bunch'), null, 'budget', '1 ikat', 1, 'pcs', 4000, I, G, { type: 'veg_leafy', portions: 2 });
  f('produce', 'sawi', n('Sawi hijau 1 ikat', 'Mustard greens, 1 bunch'), null, 'budget', '1 ikat', 1, 'pcs', 5000, I, G, { type: 'veg_leafy', portions: 2 });
  f('produce', 'timun', n('Timun 500 g', 'Cucumbers, 500 g'), null, 'budget', '500 g', 500, 'g', 7000, I, G, { type: 'veg_other', portions: 3 });
  f('produce', 'pepaya', n('Pepaya 1 buah', 'Papaya, 1 fruit'), null, 'budget', '±1 kg', 1000, 'g', 15000, I, G, { type: 'fruit', portions: 5 });
  f('produce', 'kol', n('Kubis 1 buah', 'Cabbage, 1 head'), null, 'standard', '±800 g', 800, 'g', 9000, I, G, { type: 'veg_other', portions: 5 });
  f('produce', 'carrot', n('Wortel 500 g', 'Carrots, 500 g'), null, 'standard', '500 g', 500, 'g', 9000, I, G, { type: 'veg_other', portions: 3 });
  f('produce', 'tomato', n('Tomat 500 g', 'Tomatoes, 500 g'), null, 'standard', '500 g', 500, 'g', 10000, I, G, { type: 'veg_other', portions: 3 });
  f('produce', 'banana', n('Pisang 1 sisir', 'Bananas, 1 hand'), null, 'standard', '±1 kg', 1000, 'g', 20000, I, G, { type: 'fruit', portions: 6 });
  f('produce', 'jeruk', n('Jeruk lokal 1 kg', 'Local oranges, 1 kg'), null, 'standard', '1 kg', 1000, 'g', 25000, I, G, { type: 'fruit_long', portions: 6 });
  f('produce', 'apple_import', n('Apel impor 1 kg', 'Imported apples, 1 kg'), 'Northfield', 'premium', '1 kg', 1000, 'g', 45000, I, G, { type: 'fruit_long', portions: 6 }, { origin: 'imported', need: 'desire', appeal: 3 });
  f('produce', 'frozen_veg', n('Sayur campur beku', 'Frozen mixed vegetables'), 'Ladang Prima', 'premium', '500 g', 500, 'g', 35000, I, G, { type: 'veg_frozen', portions: 5 });
  f('produce', 'salad_pack', n('Sayur salad siap makan', 'Ready-to-eat salad leaves'), 'Ladang Prima', 'premium', '200 g', 200, 'g', 28000, I, G, { type: 'veg_leafy', portions: 2 }, { need: 'desire', appeal: 3 });

  // Protein
  f('protein', 'tempe', n('Tempe 1 papan', 'Tempeh, 1 board'), null, 'budget', '±400 g', 400, 'g', 7000, I, G, { type: 'tempe', portions: 4 });
  f('protein', 'tahu', n('Tahu putih isi 10', 'White tofu, 10 pcs'), null, 'budget', '10 pcs', 10, 'pcs', 8000, I, G, { type: 'tofu', portions: 5 });
  f('protein', 'eggs_10', n('Telur ayam isi 10', 'Chicken eggs, 10 pcs'), null, 'budget', '10 butir', 10, 'pcs', 20000, E, FEB28, { type: 'egg', portions: 10 }, { note: bi('Dari rata-rata nasional Rp31.038/kg (±16 butir/kg) plus selisih kemasan kecil.', 'From the national average Rp31.038/kg (±16 eggs/kg) plus a small-pack markup.') });
  f('protein', 'lele', n('Ikan lele 500 g', 'Catfish, 500 g'), null, 'budget', '500 g', 500, 'g', 16000, I, G, { type: 'fish', portions: 4 });
  f('protein', 'sardine', n('Sarden kaleng saus tomat', 'Canned sardines in tomato sauce'), 'Laut Biru', 'budget', '155 g', 155, 'g', 11000, I, G, { type: 'sardine', portions: 2 });
  f('protein', 'eggs_1kg', n('Telur ayam 1 kg (±16 butir)', 'Chicken eggs, 1 kg (±16)'), null, 'standard', '1 kg', 1000, 'g', 31038, V, FEB28, { type: 'egg', portions: 16 });
  f('protein', 'chicken_1kg', n('Daging ayam ras 1 kg', 'Chicken (ayam ras), 1 kg'), null, 'standard', '1 kg', 1000, 'g', 37459, V, FEB28, { type: 'chicken', portions: 8 });
  f('protein', 'mackerel', n('Ikan kembung 500 g', 'Mackerel, 500 g'), null, 'standard', '500 g', 500, 'g', 25000, I, G, { type: 'fish', portions: 4 });
  f('protein', 'nugget', n('Nugget ayam beku 500 g', 'Frozen chicken nuggets, 500 g'), 'Rasa Kita', 'standard', '500 g', 500, 'g', 38000, I, G, { type: 'nugget', portions: 6 }, { appeal: 3 });
  f('protein', 'chicken_breast', n('Dada ayam fillet 500 g', 'Chicken breast fillet, 500 g'), 'Ladang Prima', 'premium', '500 g', 500, 'g', 42000, I, G, { type: 'chicken', portions: 4 });
  f('protein', 'beef_500', n('Daging sapi murni 500 g', 'Beef, 500 g'), null, 'premium', '500 g', 500, 'g', Math.round(135331 / 2), V, FEB28, { type: 'beef', portions: 5 }, { note: bi('Separuh dari rata-rata nasional per kg.', 'Half the national average per kg.') });
  f('protein', 'salmon', n('Fillet salmon impor', 'Imported salmon fillet'), 'Northfield', 'premium', '200 g', 200, 'g', 85000, I, G, { type: 'fish', portions: 2 }, { origin: 'imported', need: 'desire', appeal: 5 });

  // Cooking ingredients
  f('cooking', 'oil_bulk', n('Minyak goreng curah 1 L', 'Bulk cooking oil, 1 L'), null, 'budget', '1 L', 1000, 'ml', 17266, V, JAN20, { type: 'oil', portions: 40 });
  f('cooking', 'salt', n('Garam beryodium', 'Iodised salt'), 'Pilihan Hemat', 'budget', '250 g', 250, 'g', 3000, I, G, { type: 'seasoning', portions: 30 });
  f('cooking', 'spice_pack', n('Bumbu instan sachet', 'Instant spice paste sachet'), 'Rasa Kita', 'budget', '1 sachet', 1, 'pcs', 4000, I, G, { type: 'seasoning', portions: 4 });
  f('cooking', 'oil_pack', n('Minyak goreng kemasan 1 L', 'Packaged cooking oil, 1 L'), 'Sari Dapur', 'standard', '1 L', 1000, 'ml', 20531, V, JAN20, { type: 'oil', portions: 40 });
  f('cooking', 'sugar', n('Gula pasir 1 kg', 'Granulated sugar, 1 kg'), 'Sari Dapur', 'standard', '1 kg', 1000, 'g', 18000, I, G, { type: 'seasoning', portions: 40 });
  f('cooking', 'kecap', n('Kecap manis', 'Sweet soy sauce'), 'Sari Dapur', 'standard', '520 ml', 520, 'ml', 24000, I, G, { type: 'seasoning', portions: 40 });
  f('cooking', 'bawang', n('Bawang merah & putih 500 g', 'Shallots & garlic, 500 g'), null, 'standard', '500 g', 500, 'g', 19000, I, G, { type: 'seasoning', portions: 30 });
  f('cooking', 'cabai', n('Cabai rawit 100 g', 'Bird\'s-eye chillies, 100 g'), null, 'standard', '100 g', 100, 'g', 6000, I, G, { type: 'seasoning', portions: 10 });
  f('cooking', 'sambal', n('Saus sambal botol', 'Bottled chilli sauce'), 'Rasa Kita', 'standard', '335 ml', 335, 'ml', 18000, I, G, { type: 'seasoning', portions: 25 }, { need: 'desire', appeal: 2 });
  f('cooking', 'olive_oil', n('Minyak zaitun impor', 'Imported olive oil'), 'Northfield', 'premium', '500 ml', 500, 'ml', 95000, I, G, { type: 'oil', portions: 30 }, { origin: 'imported', need: 'desire', appeal: 2 });
  f('cooking', 'pasta_sauce', n('Saus pasta impor', 'Imported pasta sauce'), 'Northfield', 'premium', '400 g', 400, 'g', 55000, I, G, { type: 'seasoning', portions: 6 }, { origin: 'imported', need: 'desire', appeal: 3 });

  // Snacks & beverages
  f('snacks', 'galon_refill', n('Air minum isi ulang depot', 'Drinking water, depot refill'), null, 'budget', '19 L', 19000, 'ml', 6000, I, G, null, { supply: { water: 8 }, note: bi('Galon isi ulang tanpa merek di depot air.', 'Unbranded refill at a water depot.') });
  f('snacks', 'teh_botol', n('Teh manis botol', 'Bottled sweet tea'), 'Segar Sari', 'budget', '350 ml', 350, 'ml', 5000, I, G, null, { need: 'desire', appeal: 4, mood: { happiness: 1, stress: -1 } });
  f('snacks', 'coffee_sachet', n('Kopi sachet isi 10', 'Instant coffee sachets, 10 pcs'), 'Kopi Pagi', 'budget', '10 sachet', 10, 'pcs', 15000, I, G, null, { supply: { coffee: 10 }, need: 'desire', appeal: 4, note: bi('Satu sachet per pagi kerja: sedikit tambahan energi.', 'One sachet per work morning: a small energy lift.') });
  f('snacks', 'biscuits', n('Biskuit kelapa 300 g', 'Coconut biscuits, 300 g'), 'Pilihan Hemat', 'budget', '300 g', 300, 'g', 12000, I, G, null, { need: 'desire', appeal: 4, mood: { happiness: 2, stress: -2 } });
  f('snacks', 'galon_brand', n('Air galon bermerek (isi ulang)', 'Branded water gallon refill'), 'Tirta Jernih', 'standard', '19 L', 19000, 'ml', 22000, I, G, null, { supply: { water: 8 } });
  f('snacks', 'tea_bags', n('Teh celup isi 25', 'Tea bags, 25 pcs'), 'Daun Hijau', 'standard', '25 pcs', 25, 'pcs', 7000, I, G, null, { need: 'desire', appeal: 2, mood: { stress: -1 } });
  f('snacks', 'milk_uht', n('Susu UHT 1 L', 'UHT milk, 1 L'), 'Sapi Riang', 'standard', '1 L', 1000, 'ml', 20000, I, G, { type: 'milk', portions: 4 });
  f('snacks', 'chips', n('Keripik kentang', 'Potato chips'), 'Kriuk', 'standard', '68 g', 68, 'g', 11000, I, G, null, { need: 'desire', appeal: 6, mood: { happiness: 3, stress: -2 } });
  f('snacks', 'choco', n('Cokelat batangan', 'Chocolate bar'), 'Kakao Nusa', 'standard', '58 g', 58, 'g', 15000, I, G, null, { need: 'desire', appeal: 7, mood: { happiness: 4, stress: -3 } });
  f('snacks', 'juice', n('Jus jeruk 1 L', 'Orange juice, 1 L'), 'Segar Sari', 'standard', '1 L', 1000, 'ml', 28000, I, G, { type: 'juice', portions: 4 }, { need: 'desire', appeal: 3 });
  f('snacks', 'water_import', n('Air mineral impor 1 L', 'Imported mineral water, 1 L'), 'Alpenquell', 'premium', '1 L', 1000, 'ml', 35000, I, G, null, { origin: 'imported', need: 'desire', appeal: 2, supply: { water: 0.5 } });
  f('snacks', 'snack_import', n('Camilan impor Jepang/Korea', 'Imported Japanese/Korean snacks'), 'Tokyo Treats', 'premium', '120 g', 120, 'g', 45000, I, G, null, { origin: 'imported', need: 'desire', appeal: 8, mood: { happiness: 5, stress: -3 } });
  f('snacks', 'coffee_beans', n('Kopi bubuk spesialti', 'Specialty ground coffee'), 'Lereng Kopi', 'premium', '250 g', 250, 'g', 75000, I, G, null, { supply: { coffee: 25 }, need: 'desire', appeal: 6, mood: { happiness: 2 } });

  // Ready to eat (enters inventory as a prepared meal; best eaten the same day)
  const meal = (kcal, protein, carbs, fat, fiber, fv = 0) => ({ kcal, protein, carbs, fat, fiber, vitA: fv * 0.4, vitC: fv * 0.4, iron: 0.2, calcium: 0.1, fv });
  f('ready', 'nasi_uduk', n('Nasi uduk bungkus', 'Nasi uduk takeaway'), null, 'budget', '1 bungkus', 1, 'pcs', 12000, I, G, { type: 'meal', portions: 1, nut: meal(550, 14, 75, 20, 2, 0.3) });
  f('ready', 'warteg', n('Nasi warteg (nasi + 2 lauk)', 'Nasi warteg (rice + two sides)'), null, 'budget', '1 porsi', 1, 'pcs', 15000, I, G, { type: 'meal', portions: 1, nut: meal(650, 20, 85, 22, 4, 1) });
  f('ready', 'gorengan', n('Gorengan isi 3', 'Street fritters, 3 pcs'), null, 'budget', '3 pcs', 3, 'pcs', 5000, I, G, null, { need: 'desire', appeal: 5, mood: { happiness: 2, stress: -1 } });
  f('ready', 'nasi_padang', n('Nasi Padang bungkus', 'Nasi Padang takeaway'), null, 'standard', '1 bungkus', 1, 'pcs', 25000, I, G, { type: 'meal', portions: 1, nut: meal(850, 30, 95, 38, 3, 0.5) }, { mood: { happiness: 1 } });
  f('ready', 'bento', n('Rice bowl minimarket', 'Convenience-store rice bowl'), 'Siap Saji', 'standard', '1 bowl', 1, 'pcs', 22000, I, G, { type: 'meal', portions: 1, nut: meal(550, 18, 78, 18, 2, 0.3) });
  f('ready', 'gado_gado', n('Gado-gado', 'Gado-gado (vegetables with peanut sauce)'), null, 'standard', '1 porsi', 1, 'pcs', 18000, I, G, { type: 'meal', portions: 1, nut: meal(480, 16, 50, 22, 8, 2) });
  f('ready', 'salad_bowl', n('Salad bowl ayam panggang', 'Grilled chicken salad bowl'), 'Hijau Kitchen', 'premium', '1 bowl', 1, 'pcs', 45000, I, G, { type: 'meal', portions: 1, nut: meal(520, 32, 40, 22, 7, 2) }, { need: 'desire', appeal: 5, mood: { happiness: 2 } });
  f('ready', 'restaurant_set', n('Paket makan restoran', 'Restaurant set meal'), null, 'premium', '1 set', 1, 'pcs', 55000, I, G, { type: 'meal', portions: 1, nut: meal(850, 30, 90, 35, 4, 1) }, { need: 'desire', appeal: 6, mood: { happiness: 4 } });

  // Household & cleaning
  f('household', 'lpg_3', n('Isi ulang LPG 3 kg', 'LPG 3 kg refill'), null, 'budget', '3 kg', 3000, 'g', 22000, I, G, null, { supply: { gasMeals: 60 }, note: bi('Harga eceran warung; harga eceran tertinggi di pangkalan resmi lebih rendah dan berbeda per daerah.', 'Retail price at a neighbourhood shop; the capped price at official outlets is lower and varies by region.') });
  f('household', 'detergent_s', n('Deterjen sachet isi 6', 'Laundry detergent sachets, 6 pcs'), 'Pilihan Hemat', 'budget', '6 sachet', 6, 'pcs', 6000, I, G, null, { supply: { laundry: 12 } });
  f('household', 'dish_refill', n('Sabun cuci piring refill', 'Dishwashing liquid refill'), 'Pilihan Hemat', 'budget', '400 ml', 400, 'ml', 9000, I, G, null, { supply: { dish: 30 } });
  f('household', 'mosquito_coil', n('Obat nyamuk bakar isi 10', 'Mosquito coils, 10 pcs'), 'Malam Tenang', 'budget', '10 pcs', 10, 'pcs', 6000, I, G, null, { supply: { repellent: 10 }, note: bi('Di musim hujan, tanpa penangkal nyamuk tidurmu lebih terganggu.', 'In the rainy season, sleep is worse without mosquito protection.') });
  f('household', 'trash_bags', n('Kantong sampah isi 20', 'Trash bags, 20 pcs'), 'Pilihan Hemat', 'budget', '20 pcs', 20, 'pcs', 8000, I, G, null, { supply: { homeclean: 20 } });
  f('household', 'detergent_l', n('Deterjen bubuk 800 g', 'Laundry powder, 800 g'), 'Bersih Kilat', 'standard', '800 g', 800, 'g', 24000, I, G, null, { supply: { laundry: 35 } });
  f('household', 'floor_cleaner', n('Pembersih lantai', 'Floor cleaner'), 'Bersih Kilat', 'standard', '780 ml', 780, 'ml', 15000, I, G, null, { supply: { homeclean: 30 } });
  f('household', 'sponge', n('Spons cuci isi 3', 'Kitchen sponges, 3 pcs'), 'Bersih Kilat', 'standard', '3 pcs', 3, 'pcs', 9000, I, G, null, { supply: { dish: 10, homeclean: 10 } });
  f('household', 'repellent_lotion', n('Losion anti nyamuk', 'Mosquito repellent lotion'), 'Malam Tenang', 'standard', '50 ml', 50, 'ml', 12000, I, G, null, { supply: { repellent: 20 } });
  f('household', 'lpg_55', n('LPG 5,5 kg nonsubsidi', 'Non-subsidised LPG 5.5 kg'), null, 'premium', '5,5 kg', 5500, 'g', 95000, I, G, null, { supply: { gasMeals: 110 } });
  f('household', 'detergent_eco', n('Deterjen ramah lingkungan impor', 'Imported eco detergent'), 'GreenLeaf', 'premium', '1 L', 1000, 'ml', 85000, I, G, null, { supply: { laundry: 40 }, origin: 'imported', need: 'desire', appeal: 2 });

  // Personal hygiene
  f('hygiene', 'soap_bar3', n('Sabun batang isi 3', 'Bar soap, 3-pack'), 'Pilihan Hemat', 'budget', '3 × 85 g', 255, 'g', 9000, I, G, null, { supply: { soap: 45 } });
  f('hygiene', 'shampoo_sachet', n('Sampo sachet isi 12', 'Shampoo sachets, 12 pcs'), 'Rambut Sehat', 'budget', '12 × 10 ml', 120, 'ml', 6000, I, G, null, { supply: { shampoo: 12 } });
  f('hygiene', 'toothpaste_s', n('Pasta gigi 75 g', 'Toothpaste, 75 g'), 'Gigi Putih', 'budget', '75 g', 75, 'g', 6500, I, G, null, { supply: { toothpaste: 25 } });
  f('hygiene', 'toothbrush', n('Sikat gigi', 'Toothbrush'), 'Gigi Putih', 'budget', '1 pc', 1, 'pcs', 5000, I, G, null, { supply: { toothbrush: 90 } });
  f('hygiene', 'pads', n('Pembalut isi 10', 'Sanitary pads, 10 pcs'), 'Nyaman', 'budget', '10 pcs', 10, 'pcs', 12000, I, G, null, { supply: { pads: 3 } });
  f('hygiene', 'bodywash', n('Sabun cair refill', 'Body wash refill'), 'Segar Mandi', 'standard', '450 ml', 450, 'ml', 25000, I, G, null, { supply: { soap: 40 } });
  f('hygiene', 'shampoo_bottle', n('Sampo botol', 'Shampoo bottle'), 'Rambut Sehat', 'standard', '170 ml', 170, 'ml', 25000, I, G, null, { supply: { shampoo: 30 } });
  f('hygiene', 'toothpaste_l', n('Pasta gigi 190 g', 'Toothpaste, 190 g'), 'Gigi Putih', 'standard', '190 g', 190, 'g', 15000, I, G, null, { supply: { toothpaste: 60 } });
  f('hygiene', 'deodorant', n('Deodoran roll-on', 'Roll-on deodorant'), 'Segar Mandi', 'standard', '50 ml', 50, 'ml', 22000, I, G, null, { supply: { deodorant: 40 } });
  f('hygiene', 'tissue', n('Tisu wajah 250 lembar', 'Facial tissue, 250 sheets'), 'Lembut', 'standard', '250 lbr', 250, 'pcs', 12000, I, G, null, { supply: { tissue: 25 } });
  f('hygiene', 'toilet_paper', n('Tisu toilet isi 4', 'Toilet paper, 4 rolls'), 'Lembut', 'standard', '4 roll', 4, 'pcs', 18000, I, G, null, { supply: { tissue: 30 } });
  f('hygiene', 'pads_night', n('Pembalut malam premium isi 10', 'Premium night pads, 10 pcs'), 'Nyaman Plus', 'premium', '10 pcs', 10, 'pcs', 25000, I, G, null, { supply: { pads: 3 }, mood: { confidence: 1 } });
  f('hygiene', 'shampoo_salon', n('Sampo salon', 'Salon shampoo'), 'Maison Hair', 'premium', '300 ml', 300, 'ml', 120000, I, G, null, { supply: { shampoo: 50 }, origin: 'imported', need: 'desire', appeal: 5, mood: { confidence: 2 } });
  f('hygiene', 'bodywash_lux', n('Sabun cair impor', 'Imported body wash'), 'Maison Bath', 'premium', '500 ml', 500, 'ml', 95000, I, G, null, { supply: { soap: 45 }, origin: 'imported', need: 'desire', appeal: 5, mood: { happiness: 2 } });

  // Baby & child (only with an infant/child in the household)
  f('baby', 'diapers', n('Popok bayi isi 20', 'Diapers, 20 pcs'), 'Bayi Ceria', 'budget', '20 pcs', 20, 'pcs', 55000, I, G, null, { supply: { baby: 5 }, requires: 'infant' });
  f('baby', 'formula', n('Susu formula balita 400 g', 'Toddler formula, 400 g'), 'Bayi Ceria', 'standard', '400 g', 400, 'g', 85000, I, G, null, { supply: { baby: 7 }, requires: 'infant' });
  f('baby', 'diapers_prem', n('Popok premium isi 20', 'Premium diapers, 20 pcs'), 'Little Cloud', 'premium', '20 pcs', 20, 'pcs', 95000, I, G, null, { supply: { baby: 5 }, requires: 'infant', origin: 'imported' });
  f('baby', 'kids_snack', n('Biskuit anak', 'Children\'s biscuits'), 'Bayi Ceria', 'standard', '120 g', 120, 'g', 18000, I, G, null, { requires: 'child', need: 'desire', appeal: 5, mood: { happiness: 2 }, note: bi('Anak senang; kamu ikut senang.', 'The kids are happy, so are you.') });

  // ── Durable goods & beauty helpers ─────────────────────────────────
  const TIERS = ['budget', 'standard', 'premium'];
  function three(store, dept, base, name, prices, brands, opts = {}) {
    TIERS.forEach((tier, i) => add({
      store, dept, id: `${base}_${tier}`, name, brand: brands[i], tier, size: opts.size || '1 pc', unitQty: opts.unitQty || 1, unitLabel: opts.unitLabel || 'pcs',
      price: prices[i], need: opts.need || 'basic', appeal: (opts.appeal || 3) + i * 2, mood: opts.mood ? scaleMood(opts.mood, i) : null,
      owned: opts.owned || null, supply: opts.supply ? Object.fromEntries(Object.entries(opts.supply).map(([k, v]) => [k, Math.round(v * [1, 1.3, 1.6][i])])) : null,
      durability: opts.owned ? Math.round(TIER_DUR[tier] * (opts.durMul || 1)) : null, service: !!opts.service,
      origin: i === 2 && opts.importPremium ? 'imported' : 'local', requires: opts.requires || null, functional: opts.functional || null, note: opts.note || null,
      course: opts.course || null,
    }));
  }
  const scaleMood = (m, i) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, Math.round(v * [1, 1.4, 1.9][i])]));
  const SS = 'shopsquare', GL = 'glow';

  // Clothing
  three(SS, 'clothing', 'tee', n('Kaus polos', 'Plain T-shirt'), [45000, 120000, 350000], ['Basic Hemat', 'Kain Nusa', 'Atelier Loka'], { need: 'desire', appeal: 4, owned: { key: 'clothing', boost: 25 }, mood: { happiness: 2, boredom: -2 }, importPremium: true });
  three(SS, 'clothing', 'shirt_casual', n('Kemeja/blus kasual', 'Casual shirt or blouse'), [85000, 190000, 480000], ['Basic Hemat', 'Kain Nusa', 'Atelier Loka'], { need: 'desire', appeal: 5, owned: { key: 'clothing', boost: 30 }, mood: { happiness: 3, boredom: -3, confidence: 2 } });
  three(SS, 'clothing', 'trousers', n('Celana panjang/jins', 'Trousers or jeans'), [99000, 230000, 650000], ['Basic Hemat', 'Kain Nusa', 'Denim North'], { owned: { key: 'clothing', boost: 30 }, mood: { boredom: -2 }, importPremium: true });
  three(SS, 'clothing', 'kerudung', n('Kerudung', 'Headscarf'), [35000, 90000, 250000], ['Basic Hemat', 'Kain Nusa', 'Atelier Loka'], { need: 'desire', appeal: 4, owned: { key: 'clothing', boost: 15 }, mood: { happiness: 2, confidence: 1 } });
  three(SS, 'clothing', 'jacket', n('Jaket', 'Jacket'), [120000, 280000, 900000], ['Basic Hemat', 'Kain Nusa', 'Northline'], { need: 'desire', appeal: 5, owned: { key: 'clothing', boost: 20 }, mood: { happiness: 3 }, importPremium: true });
  three(SS, 'clothing', 'underwear', n('Pakaian dalam isi 3', 'Underwear, 3-pack'), [45000, 110000, 300000], ['Basic Hemat', 'Kain Nusa', 'Atelier Loka'], { size: '3 pcs', owned: { key: 'clothing', boost: 10 }, mood: { comfort: 3 } });
  // Workwear
  three(SS, 'workwear', 'work_shirt', n('Kemeja kerja', 'Work shirt'), [90000, 220000, 550000], ['Basic Hemat', 'Kantor Rapi', 'Atelier Loka'], { owned: { key: 'workwear', boost: 45 }, mood: { confidence: 2 }, functional: bi('Memenuhi aturan berpakaian kerja kantor atau toko.', 'Meets office or shop dress codes.') });
  three(SS, 'workwear', 'work_bottom', n('Celana/rok kerja hitam', 'Black work trousers or skirt'), [95000, 210000, 520000], ['Basic Hemat', 'Kantor Rapi', 'Atelier Loka'], { owned: { key: 'workwear', boost: 40 }, functional: bi('Banyak toko dan restoran meminta bawahan hitam.', 'Many shops and restaurants ask for black bottoms.') });
  three(SS, 'workwear', 'batik', n('Kemeja batik', 'Batik shirt'), [110000, 260000, 850000], ['Basic Hemat', 'Batik Pesisir', 'Batik Tulis Lawas'], { need: 'desire', appeal: 4, owned: { key: 'workwear', boost: 25 }, mood: { confidence: 2, boredom: -2 }, functional: bi('Sering dipakai hari Jumat dan acara resmi.', 'Often worn on Fridays and at formal events.') });
  three(SS, 'workwear', 'blazer', n('Blazer', 'Blazer'), [180000, 420000, 1300000], ['Basic Hemat', 'Kantor Rapi', 'Atelier Loka'], { need: 'desire', appeal: 4, owned: { key: 'workwear', boost: 30 }, mood: { confidence: 4 }, functional: bi('Berguna untuk wawancara, tidak wajib.', 'Useful for interviews; not required.') });
  // Shoes
  three(SS, 'shoes', 'shoes', n('Sepatu sehari-hari', 'Everyday shoes'), [120000, 350000, 1200000], ['Langkah', 'Jejak Kota', 'Stride North'], { owned: { key: 'footwear', boost: 100 }, mood: { comfort: 4 }, importPremium: true, functional: bi('Sepatu yang masih bagus membuat kerja berdiri lebih nyaman.', 'Shoes in good condition make standing jobs more comfortable.') });
  three(SS, 'shoes', 'work_shoes', n('Sepatu kerja hitam', 'Black work shoes'), [150000, 380000, 1100000], ['Langkah', 'Kantor Rapi', 'Stride North'], { owned: { key: 'footwear', boost: 100, work: true }, mood: { comfort: 4, confidence: 2 }, functional: bi('Memenuhi aturan sepatu tertutup hitam di banyak tempat kerja.', 'Meets the closed black shoe rule at many workplaces.') });
  three(SS, 'shoes', 'sandals', n('Sandal', 'Sandals'), [25000, 80000, 350000], ['Langkah', 'Jejak Kota', 'Stride North'], { need: 'desire', appeal: 2, owned: { key: 'sandals' } });
  three(SS, 'shoes', 'sneakers', n('Sepatu olahraga', 'Sports shoes'), [160000, 450000, 1800000], ['Langkah', 'Lari Nusa', 'Stride North'], { need: 'desire', appeal: 6, owned: { key: 'footwear', boost: 80, hobby: 'fitness' }, mood: { happiness: 3 }, importPremium: true });
  // Bags & accessories
  three(SS, 'bags', 'backpack', n('Ransel', 'Backpack'), [80000, 220000, 800000], ['Bawa', 'Ranselku', 'Northline'], { need: 'desire', appeal: 4, owned: { key: 'bag' }, mood: { happiness: 2 } });
  three(SS, 'bags', 'work_bag', n('Tas kerja', 'Work bag'), [80000, 250000, 900000], ['Bawa', 'Kantor Rapi', 'Atelier Loka'], { need: 'desire', appeal: 5, owned: { key: 'bag' }, mood: { confidence: 2 } });
  three(SS, 'bags', 'tote', n('Tas jinjing', 'Tote bag'), [35000, 120000, 1500000], ['Bawa', 'Kain Nusa', 'Maison Loka'], { need: 'desire', appeal: 5, owned: { key: 'bag' }, mood: { happiness: 3 }, importPremium: true });
  three(SS, 'accessories', 'watch', n('Jam tangan', 'Wristwatch'), [80000, 350000, 2500000], ['Tepat', 'Waktu Nusa', 'Horloge'], { need: 'desire', appeal: 6, owned: { key: 'accessory' }, mood: { happiness: 3, confidence: 2 }, importPremium: true });
  three(SS, 'accessories', 'sunglasses', n('Kacamata hitam', 'Sunglasses'), [50000, 180000, 1200000], ['Tepat', 'Lensa Kota', 'Soleil'], { need: 'desire', appeal: 5, owned: { key: 'accessory' }, mood: { happiness: 2 }, importPremium: true });
  three(SS, 'accessories', 'umbrella', n('Payung lipat', 'Folding umbrella'), [30000, 70000, 200000], ['Teduh', 'Teduh Plus', 'Rainshield'], { owned: { key: 'umbrella' }, functional: bi('Mengurangi kebutuhan naik mobil saat hujan.', 'Less need for a car ride when it rains.') });
  three(SS, 'accessories', 'raincoat', n('Jas hujan', 'Raincoat'), [35000, 85000, 250000], ['Teduh', 'Teduh Plus', 'Rainshield'], { owned: { key: 'raincoat' }, functional: bi('Bisa tetap naik motor saat hujan.', 'Lets you keep riding a motorbike in the rain.') });
  // Electronics
  three(SS, 'electronics', 'fan', n('Kipas angin berdiri', 'Standing fan'), [175000, 320000, 900000], ['Angin Sejuk', 'Sejuk Prima', 'Nordwind'], { owned: { key: 'fan' }, functional: bi('Tidur lebih nyaman di kamar tanpa AC.', 'Better sleep in a room without AC.') });
  three(SS, 'electronics', 'ricecooker', n('Rice cooker', 'Rice cooker'), [180000, 350000, 900000], ['Dapur Listrik', 'Masak Mudah', 'Kaze'], { owned: { key: 'ricecooker' }, functional: bi('Bisa memasak nasi dan bubur tanpa gas (pakai listrik).', 'Cook rice and porridge without gas (uses electricity).') });
  three(SS, 'electronics', 'fridge', n('Kulkas kecil 1 pintu', 'Small single-door fridge'), [1400000, 2200000, 3800000], ['Dingin', 'Dingin Prima', 'Kaze'], { owned: { key: 'fridge' }, functional: bi('Makanan segar lebih awet; ada ruang beku kecil. Menambah pemakaian listrik.', 'Fresh food lasts longer; small freezer compartment. Adds to electricity use.') });
  three(SS, 'electronics', 'earphones', n('Earphone', 'Earphones'), [60000, 200000, 1500000], ['Dengar', 'Suara Nusa', 'Klang'], { need: 'desire', appeal: 6, owned: { key: 'earphones' }, mood: { happiness: 3, boredom: -2 }, importPremium: true });
  three(SS, 'electronics', 'phone', n('Ponsel Android', 'Android phone'), [1500000, 3500000, 12000000], ['Nusa Mobile', 'Nusa Mobile Pro', 'Aurum'], { need: 'desire', appeal: 7, owned: { key: 'phone' }, mood: { happiness: 6, confidence: 3 }, importPremium: true, functional: bi('Mengganti ponsel lama yang rusak atau lambat.', 'Replaces an old, damaged or slow phone.') });
  // Phone accessories
  three(SS, 'phone_acc', 'charger', n('Charger & kabel', 'Charger and cable'), [35000, 90000, 350000], ['Daya', 'Daya Plus', 'Voltix'], { owned: { key: 'charger' } });
  three(SS, 'phone_acc', 'phone_case', n('Casing ponsel', 'Phone case'), [25000, 80000, 300000], ['Lindung', 'Lindung Plus', 'Armour'], { need: 'desire', appeal: 4, owned: { key: 'case' }, mood: { happiness: 2 } });
  three(SS, 'phone_acc', 'powerbank', n('Power bank', 'Power bank'), [120000, 250000, 600000], ['Daya', 'Daya Plus', 'Voltix'], { need: 'desire', appeal: 3, owned: { key: 'powerbank' } });
  // Entertainment & hobbies
  three(SS, 'entertainment', 'novel', n('Novel', 'Novel'), [60000, 110000, 250000], ['Penerbit Rakyat', 'Pustaka Nusa', 'Imported edition'], { need: 'desire', appeal: 4, owned: { key: 'book' }, mood: { happiness: 2, boredom: -4 }, importPremium: true });
  three(SS, 'entertainment', 'game_voucher', n('Voucher gim', 'Game voucher'), [50000, 150000, 700000], ['Main', 'Main Plus', 'Console title'], { need: 'desire', appeal: 7, mood: { happiness: 4, boredom: -8 } });
  three(SS, 'entertainment', 'boardgame', n('Permainan papan', 'Board game'), [80000, 250000, 600000], ['Main', 'Main Plus', 'Tabletop Co.'], { need: 'desire', appeal: 5, owned: { key: 'boardgame' }, mood: { happiness: 3, boredom: -4 } });
  three(SS, 'hobby', 'sketch', n('Set buku sketsa & pensil', 'Sketchbook & pencil set'), [35000, 120000, 450000], ['Gores', 'Gores Pro', 'Atelier'], { need: 'desire', appeal: 4, owned: { key: 'hobby_drawing' }, mood: { happiness: 2 }, functional: bi('Membuka kegiatan gratis "Menggambar" di AfterHours.', 'Unlocks the free "Drawing" activity in AfterHours.') });
  three(SS, 'hobby', 'plants', n('Bibit tanaman & pot', 'Seedlings & pots'), [25000, 75000, 250000], ['Tanam', 'Tanam Plus', 'Greenhouse'], { need: 'desire', appeal: 3, owned: { key: 'hobby_plants' }, mood: { happiness: 2 }, functional: bi('Membuka kegiatan gratis "Merawat tanaman".', 'Unlocks the free "Tending plants" activity.') });
  three(SS, 'hobby', 'yoga_mat', n('Matras olahraga', 'Exercise mat'), [60000, 150000, 500000], ['Gerak', 'Gerak Pro', 'Zenfit'], { need: 'desire', appeal: 3, owned: { key: 'hobby_fitness' }, functional: bi('Olahraga di rumah terasa lebih nyaman.', 'Makes home workouts more comfortable.') });
  // School & learning
  three(SS, 'school', 'notebooks', n('Buku tulis isi 10 & alat tulis', '10 exercise books & stationery'), [25000, 55000, 120000], ['Tulis', 'Tulis Plus', 'Papier'], { requires: 'school', owned: { key: 'school_supplies' } });
  three(SS, 'school', 'uniform', n('Seragam sekolah anak', 'Child\'s school uniform'), [90000, 160000, 300000], ['Sekolahku', 'Sekolahku Plus', 'Premium uniform'], { requires: 'school', owned: { key: 'school_uniform' } });
  three(SS, 'school', 'kid_shoes', n('Sepatu sekolah anak', 'Child\'s school shoes'), [80000, 150000, 350000], ['Langkah Kecil', 'Langkah Kecil Plus', 'Stride Kids'], { requires: 'school', owned: { key: 'school_shoes' } });
  add({ store: SS, dept: 'school', id: 'course_office', name: n('Kursus online: Excel & administrasi kantor', 'Online course: Excel & office admin'), brand: 'BelajarYuk', tier: 'budget', price: 99000, need: 'desire', appeal: 3, course: { skill: 'office', sessions: 4 }, functional: bi('4 sesi belajar (masing-masing 1 waktu luang) menambah keahlian "Microsoft Office".', '4 study sessions (1 free slot each) add the "Microsoft Office" skill.') });
  add({ store: SS, dept: 'school', id: 'course_design', name: n('Kursus online: desain grafis dasar', 'Online course: basic graphic design'), brand: 'BelajarYuk', tier: 'standard', price: 149000, need: 'desire', appeal: 3, course: { skill: 'design', sessions: 6 } });
  add({ store: SS, dept: 'school', id: 'course_marketing', name: n('Kursus online: pemasaran digital', 'Online course: digital marketing'), brand: 'BelajarYuk', tier: 'standard', price: 149000, need: 'desire', appeal: 3, course: { skill: 'socialmedia', sessions: 6 } });
  add({ store: SS, dept: 'school', id: 'course_english', name: n('Kursus bahasa Inggris online (1 bulan)', 'Online English course (1 month)'), brand: 'Speak Up', tier: 'standard', price: 199000, need: 'desire', appeal: 3, course: { skill: 'english', sessions: 8 }, functional: bi('8 sesi menaikkan kemampuan bahasa Inggris satu tingkat.', '8 sessions raise English by one level.') });
  add({ store: SS, dept: 'school', id: 'course_data', name: n('Kursus online: analisis data dengan spreadsheet', 'Online course: spreadsheet data analysis'), brand: 'BelajarYuk', tier: 'standard', price: 179000, need: 'desire', appeal: 3, course: { skill: 'data', sessions: 6 } });
  add({ store: SS, dept: 'school', id: 'course_barista', name: n('Kelas barista (tatap muka)', 'Barista class (in person)'), brand: 'Kopi Akademi', tier: 'premium', price: 750000, need: 'desire', appeal: 4, course: { skill: 'barista', sessions: 4 } });
  // Family & children
  three(SS, 'family', 'kid_clothes', n('Pakaian anak', 'Children\'s clothes'), [60000, 120000, 300000], ['Anak Ceria', 'Anak Ceria Plus', 'Petit'], { requires: 'child', owned: { key: 'kid_clothes' }, mood: { happiness: 2 } });
  three(SS, 'family', 'toy', n('Mainan anak', 'Children\'s toy'), [40000, 150000, 600000], ['Main Kecil', 'Main Kecil Plus', 'Toyhaus'], { requires: 'child', need: 'desire', appeal: 6, mood: { happiness: 4 }, importPremium: true });
  // Travel essentials
  three(SS, 'travel', 'luggage', n('Koper kabin', 'Cabin suitcase'), [250000, 600000, 2000000], ['Jalan Jauh', 'Jalan Jauh Pro', 'Voyager'], { need: 'desire', appeal: 4, owned: { key: 'luggage' }, mood: { happiness: 2 }, importPremium: true });
  three(SS, 'travel', 'adapter', n('Adaptor colokan universal', 'Universal plug adapter'), [45000, 90000, 250000], ['Colok', 'Colok Plus', 'Voyager'], { owned: { key: 'adapter' }, functional: bi('Dibutuhkan untuk jalan-jalan ke negara dengan colokan berbeda.', 'Needed for countries with different plug types.') });
  three(SS, 'travel', 'toiletry_kit', n('Paket peralatan mandi perjalanan', 'Travel toiletry kit'), [30000, 60000, 150000], ['Jalan Jauh', 'Jalan Jauh Pro', 'Voyager'], { need: 'desire', appeal: 2, owned: { key: 'toiletry_kit' } });
  // Lifestyle
  three(SS, 'lifestyle', 'candle', n('Lilin aromaterapi', 'Scented candle'), [35000, 90000, 350000], ['Harum', 'Harum Prima', 'Maison Lumière'], { need: 'desire', appeal: 5, mood: { happiness: 2, stress: -3 }, importPremium: true });
  three(SS, 'lifestyle', 'houseplant', n('Tanaman hias', 'Houseplant'), [30000, 80000, 300000], ['Tanam', 'Tanam Plus', 'Greenhouse'], { need: 'desire', appeal: 4, owned: { key: 'decor' }, mood: { happiness: 2, boredom: -2 } });
  three(SS, 'lifestyle', 'lights', n('Lampu hias kamar', 'Room fairy lights'), [40000, 90000, 250000], ['Terang', 'Terang Plus', 'Lumen'], { need: 'desire', appeal: 5, owned: { key: 'decor' }, mood: { happiness: 3, boredom: -2 } });

  // ── Glow: beauty & personal care ───────────────────────────────────
  three(GL, 'skincare', 'cleanser', n('Sabun cuci muka', 'Facial cleanser'), [18000, 55000, 220000], ['Kulit Sehat', 'Glowlab', 'Maison Peau'], { supply: { cleanser: 60 }, importPremium: true, functional: bi('Bagian dari rutinitas perawatan kulit harian.', 'Part of a daily skincare routine.') });
  three(GL, 'skincare', 'moisturizer', n('Pelembap wajah', 'Moisturiser'), [25000, 90000, 450000], ['Kulit Sehat', 'Glowlab', 'Maison Peau'], { supply: { moisturizer: 45 }, need: 'desire', appeal: 4, mood: { confidence: 1 }, importPremium: true });
  three(GL, 'skincare', 'sunscreen', n('Tabir surya SPF 50', 'Sunscreen SPF 50'), [30000, 65000, 250000], ['Kulit Sehat', 'Glowlab', 'Maison Peau'], { supply: { sunscreen: 40 }, importPremium: true, functional: bi('Melindungi kulit saat perjalanan di bawah matahari.', 'Protects skin on sunny commutes.') });
  three(GL, 'skincare', 'serum', n('Serum wajah', 'Face serum'), [35000, 120000, 600000], ['Kulit Sehat', 'Glowlab', 'Maison Peau'], { supply: { serum: 30 }, need: 'desire', appeal: 6, mood: { happiness: 2, confidence: 2 }, importPremium: true });
  three(GL, 'skincare', 'sheet_mask', n('Masker wajah lembar', 'Sheet mask'), [8000, 25000, 80000], ['Kulit Sehat', 'Glowlab', 'Seoul Skin'], { need: 'desire', appeal: 6, mood: { happiness: 3, stress: -2, skin: 6 }, importPremium: true });
  three(GL, 'makeup', 'liptint', n('Lip tint', 'Lip tint'), [25000, 65000, 400000], ['Warna', 'Glowlab', 'Maison Rouge'], { supply: { makeup: 60 }, need: 'desire', appeal: 6, mood: { happiness: 2, confidence: 2 }, importPremium: true });
  three(GL, 'makeup', 'cushion', n('Cushion foundation', 'Cushion foundation'), [45000, 150000, 750000], ['Warna', 'Glowlab', 'Maison Rouge'], { supply: { makeup: 60 }, need: 'desire', appeal: 6, mood: { confidence: 3 }, importPremium: true });
  three(GL, 'makeup', 'mascara', n('Maskara', 'Mascara'), [30000, 95000, 450000], ['Warna', 'Glowlab', 'Maison Rouge'], { supply: { makeup: 50 }, need: 'desire', appeal: 5, mood: { confidence: 2 }, importPremium: true });
  three(GL, 'makeup', 'powder', n('Bedak padat', 'Pressed powder'), [25000, 80000, 400000], ['Warna', 'Glowlab', 'Maison Rouge'], { supply: { makeup: 60 }, need: 'desire', appeal: 4, mood: { confidence: 1 }, importPremium: true });
  three(GL, 'hair', 'haircut', n('Potong rambut', 'Haircut'), [20000, 50000, 250000], ['Pangkas Rakyat', 'Barber & Salon', 'Studio Rambut'], { service: true, need: 'basic', appeal: 3, mood: { confidence: 4, happiness: 2, grooming: 60 }, functional: bi('Rambut rapi membantu memenuhi aturan kerapian kerja.', 'Neat hair helps meet workplace grooming rules.') });
  three(GL, 'hair', 'hair_serum', n('Serum rambut', 'Hair serum'), [20000, 55000, 300000], ['Rambut Sehat', 'Glowlab', 'Maison Hair'], { need: 'desire', appeal: 4, mood: { confidence: 1, grooming: 10 }, importPremium: true });
  three(GL, 'body', 'lotion', n('Losion tubuh', 'Body lotion'), [18000, 45000, 250000], ['Kulit Sehat', 'Glowlab', 'Maison Bath'], { need: 'desire', appeal: 3, mood: { skin: 5 }, importPremium: true });
  three(GL, 'fragrance', 'perfume', n('Parfum', 'Fragrance'), [35000, 150000, 1800000], ['Harum', 'Harum Prima', 'Maison Parfum'], { need: 'desire', appeal: 7, mood: { happiness: 3, confidence: 3 }, importPremium: true });
  three(GL, 'grooming', 'razor', n('Pisau cukur & perawatan', 'Razor & grooming kit'), [15000, 40000, 200000], ['Rapi', 'Rapi Plus', 'Barbiere'], { supply: { grooming: 45 }, functional: bi('Menjaga kerapian untuk aturan kerja yang menghadap pelanggan.', 'Keeps you tidy for customer-facing grooming rules.') });

  // ── Care: pharmacy & clinic ────────────────────────────────────────
  const C = 'care';
  const med = (id, name, tier, price, health, extra = {}) => add({ store: C, dept: extra.dept || 'pharmacy', id, name, tier, price, need: 'basic', health, ...extra });
  med('paracetamol_gen', n('Parasetamol 500 mg generik (1 strip)', 'Paracetamol 500 mg, generic strip'), 'budget', 5000, { relief: ['fever', 'headache', 'menstrual', 'flu'] }, { size: '10 tablet' });
  med('oralit', n('Oralit', 'Oral rehydration salts'), 'budget', 3000, { relief: ['stomach'] });
  med('masks', n('Masker medis isi 50', 'Medical masks, 50 pcs'), 'budget', 25000, {});
  med('paracetamol_brand', n('Obat demam & nyeri bermerek', 'Branded fever & pain relief'), 'standard', 15000, { relief: ['fever', 'headache', 'menstrual', 'flu'] });
  med('menstrual_relief', n('Pereda nyeri haid', 'Period pain relief'), 'standard', 15000, { relief: ['menstrual'] });
  med('cough_syrup', n('Obat batuk sirup', 'Cough syrup'), 'standard', 25000, { relief: ['flu'] });
  med('antacid', n('Obat maag', 'Antacid'), 'standard', 12000, { relief: ['stomach'] });
  med('vitamin_c', n('Vitamin C isi 30', 'Vitamin C, 30 tablets'), 'standard', 30000, {}, { need: 'desire', appeal: 2 });
  med('multivit', n('Multivitamin impor isi 60', 'Imported multivitamin, 60 tablets'), 'premium', 180000, {}, { need: 'desire', appeal: 3, origin: 'imported' });
  med('clinic_gp', n('Periksa dokter umum (klinik swasta)', 'GP visit (private clinic)'), 'standard', 150000, { clinic: true, note: true }, { dept: 'clinic', service: true, note: bi('Bayar sendiri. Termasuk surat keterangan sakit bila perlu.', 'Out of pocket. Includes a sick note if needed.') });
  med('dental_check', n('Periksa gigi (swasta)', 'Dental check-up (private)'), 'premium', 250000, { clinic: true }, { dept: 'clinic', service: true });
  med('counseling', n('Konseling psikolog (swasta)', 'Psychologist session (private)'), 'premium', 300000, { counseling: true }, { dept: 'clinic', service: true, note: bi('Sesi bicara dengan psikolog. Di banyak daerah, layanan psikolog juga tersedia di puskesmas lewat JKN.', 'A talking session with a psychologist. In many areas puskesmas also offer psychologist services through JKN.') });

  // ── QuickBite: delivery menu ───────────────────────────────────────
  const QB = 'quickbite';
  const qb = (id, name, tier, price, nut, extra = {}) => add({ store: QB, dept: extra.dept || 'meals', id: 'qb_' + id, name, tier, price, food: nut ? { type: 'meal', portions: 1, nut } : null, need: extra.need || (tier === 'premium' ? 'desire' : 'basic'), appeal: extra.appeal ?? (tier === 'premium' ? 6 : 4), mood: extra.mood || null });
  qb('geprek', n('Ayam geprek + nasi', 'Smashed fried chicken with rice'), 'budget', 18000, meal(700, 28, 80, 28, 2, 0.2));
  qb('mie_ayam', n('Mi ayam', 'Chicken noodles'), 'budget', 17000, meal(550, 20, 75, 18, 2, 0.4));
  qb('nasgor', n('Nasi goreng', 'Fried rice'), 'budget', 22000, meal(680, 18, 90, 25, 2, 0.3));
  qb('gado', n('Gado-gado', 'Gado-gado'), 'budget', 20000, meal(480, 16, 50, 22, 8, 2));
  qb('bakso', n('Bakso', 'Meatball soup'), 'standard', 22000, meal(500, 22, 55, 20, 2, 0.4));
  qb('padang_box', n('Nasi Padang rendang', 'Nasi Padang with rendang'), 'standard', 32000, meal(900, 32, 95, 40, 3, 0.5), { mood: { happiness: 2 } });
  qb('sate', n('Sate ayam 10 tusuk + lontong', '10 chicken satay with rice cake'), 'standard', 30000, meal(700, 35, 70, 28, 2, 0.2), { mood: { happiness: 2 } });
  qb('sayur_set', n('Paket nasi, sayur asem & ikan', 'Rice, tamarind veg soup & fish'), 'standard', 28000, meal(620, 28, 80, 18, 6, 1.5));
  qb('burger', n('Paket burger', 'Burger combo'), 'premium', 58000, meal(1000, 30, 110, 45, 4, 0.3), { mood: { happiness: 4 } });
  qb('sushi', n('Paket sushi', 'Sushi set'), 'premium', 89000, meal(650, 28, 95, 15, 2, 0.4), { mood: { happiness: 5 } });
  qb('poke', n('Poke bowl', 'Poke bowl'), 'premium', 75000, meal(600, 30, 70, 20, 6, 1.5), { mood: { happiness: 4 } });
  qb('kopi', n('Es kopi susu gula aren', 'Iced palm-sugar latte'), 'budget', 22000, null, { dept: 'drinks', need: 'desire', appeal: 7, mood: { happiness: 3, stress: -3, energy: 4 } });
  qb('boba', n('Boba gula aren', 'Brown-sugar boba'), 'standard', 28000, null, { dept: 'drinks', need: 'desire', appeal: 7, mood: { happiness: 4, stress: -3 } });
  qb('martabak', n('Martabak manis', 'Sweet martabak'), 'standard', 45000, null, { dept: 'drinks', need: 'desire', appeal: 8, mood: { happiness: 6, stress: -4 } });

  RLS.data.catalog = {
    items,
    byId: Object.fromEntries(items.map((i) => [i.id, i])),
    departments: {
      dailymart: [
        ['staples', bi('Beras & makanan pokok', 'Rice & staples'), 'Wheat'], ['produce', bi('Sayur & buah', 'Fresh produce'), 'Carrot'], ['protein', bi('Daging, ikan & telur', 'Meat, fish & eggs'), 'Egg'],
        ['cooking', bi('Bumbu & bahan masak', 'Cooking'), 'CookingPot'], ['snacks', bi('Camilan & minuman', 'Snacks & drinks'), 'Coffee'], ['ready', bi('Siap saji', 'Ready to eat'), 'Soup'],
        ['household', bi('Rumah tangga', 'Household'), 'SprayCan'], ['hygiene', bi('Kebersihan diri', 'Personal hygiene'), 'Bath'], ['baby', bi('Bayi & anak', 'Baby & child'), 'Baby'],
      ],
      shopsquare: [
        ['clothing', bi('Pakaian', 'Clothing'), 'Shirt'], ['workwear', bi('Pakaian kerja', 'Workwear'), 'Briefcase'], ['shoes', bi('Sepatu', 'Shoes'), 'Footprints'],
        ['bags', bi('Tas', 'Bags'), 'ShoppingBag'], ['accessories', bi('Aksesori', 'Accessories'), 'Watch'], ['electronics', bi('Elektronik', 'Electronics'), 'Plug'],
        ['phone_acc', bi('Aksesori ponsel', 'Phone accessories'), 'Smartphone'], ['entertainment', bi('Hiburan', 'Entertainment'), 'Gamepad2'], ['hobby', bi('Hobi', 'Hobbies'), 'Palette'],
        ['school', bi('Sekolah & belajar', 'School & learning'), 'GraduationCap'], ['family', bi('Keluarga & anak', 'Family & kids'), 'Baby'], ['travel', bi('Perlengkapan perjalanan', 'Travel essentials'), 'Luggage'],
        ['lifestyle', bi('Gaya hidup', 'Lifestyle'), 'Flower2'],
      ],
      glow: [['skincare', bi('Perawatan kulit', 'Skincare'), 'Droplets'], ['makeup', bi('Riasan', 'Makeup'), 'Sparkles'], ['hair', bi('Rambut', 'Hair'), 'Scissors'], ['body', bi('Tubuh', 'Body'), 'HandHeart'], ['fragrance', bi('Parfum', 'Fragrance'), 'Flower2'], ['grooming', bi('Perawatan diri', 'Grooming'), 'Scissors']],
      care: [['pharmacy', bi('Apotek', 'Pharmacy'), 'Pill'], ['clinic', bi('Klinik', 'Clinic'), 'Stethoscope']],
      quickbite: [['meals', bi('Makanan', 'Meals'), 'UtensilsCrossed'], ['drinks', bi('Minuman & camilan', 'Drinks & treats'), 'Coffee']],
    },
  };

  // ── Connect: phone & internet ───────────────────────────────────────
  RLS.data.connect = {
    dataPlans: [
      { id: 'data_7d', name: bi('Paket data 8 GB', 'Prepaid data 8 GB'), days: 7, price: rp(30000), status: I, sourceId: G },
      { id: 'data_30d_20', name: bi('Paket data 20 GB', 'Prepaid data 20 GB'), days: 30, price: rp(60000), status: I, sourceId: G },
      { id: 'data_30d_50', name: bi('Paket data 50 GB', 'Prepaid data 50 GB'), days: 30, price: rp(100000), status: I, sourceId: G },
      { id: 'data_30d_unl', name: bi('Kuota besar 120 GB', 'Large quota 120 GB'), days: 30, price: rp(150000), status: I, sourceId: G },
    ],
    homeInternet: [
      { id: 'net_20', name: bi('Internet rumah 20 Mbps', 'Home fibre 20 Mbps'), price: rp(250000), status: I, sourceId: G },
      { id: 'net_50', name: bi('Internet rumah 50 Mbps', 'Home fibre 50 Mbps'), price: rp(350000), status: I, sourceId: G },
    ],
    devices: [
      { id: 'screen_fix', name: bi('Ganti layar di konter HP', 'Screen replacement at a phone counter'), price: rp(400000), status: I, sourceId: G, repair: true },
      { id: 'battery_fix', name: bi('Ganti baterai ponsel', 'Phone battery replacement'), price: rp(250000), status: I, sourceId: G, repair: true },
    ],
  };

  // ── Recurring subscriptions ────────────────────────────────────────
  RLS.data.subscriptions = [
    { id: 'sub_video', name: bi('Streaming video, paket ponsel', 'Video streaming, mobile plan'), price: rp(54000), mood: { boredom: -2, happiness: 1 }, status: I, sourceId: G },
    { id: 'sub_music', name: bi('Streaming musik individu', 'Music streaming, individual'), price: rp(55000), mood: { happiness: 1, stress: -1 }, status: I, sourceId: G },
    { id: 'sub_cloud', name: bi('Penyimpanan cloud 100 GB', 'Cloud storage 100 GB'), price: rp(27000), mood: {}, status: I, sourceId: G },
    { id: 'sub_gym', name: bi('Keanggotaan gym dekat rumah', 'Neighbourhood gym membership'), price: rp(200000), mood: { stress: -2, energy: 1 }, status: I, sourceId: G },
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = RLS.data.catalog;
})(typeof globalThis !== 'undefined' ? globalThis : this);
