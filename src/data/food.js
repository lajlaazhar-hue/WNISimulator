/*
 * food.js — ingredients, shelf life, nutrition and recipes.
 *
 * All values here are ESTIMATED simplifications for gameplay:
 *  - shelf life in days at room temperature and in a small fridge (with a
 *    freezer compartment for meat and fish); `opened` applies once a pack
 *    has been started;
 *  - nutrition per portion: kcal, protein, carbs, fat, fibre (g) and a few
 *    micronutrient points (vitA, vitC, iron, calcium; 0–1 per portion);
 *  - `fv` counts fruit/vegetable portions toward a 5-a-day style variety goal.
 * They are not dietary advice and do not predict health outcomes.
 */
(function (root) {
  const RLS = (root.RLS = root.RLS || {});
  RLS.data = RLS.data || {};
  const { bi } = RLS.i18n;

  // type: [label, shelf {room, fridge}, opened {room, fridge}|null, nutrition per portion, group]
  const N = (kcal, protein, carbs, fat, fiber, extra = {}) => ({ kcal, protein, carbs, fat, fiber, vitA: 0, vitC: 0, iron: 0, calcium: 0, fv: 0, ...extra });
  const INGREDIENTS = {
    rice: { label: bi('Beras', 'Rice'), shelf: { room: 240, fridge: 240 }, nut: N(360, 7, 79, 1, 1), group: 'carb', portion: bi('100 g beras', '100 g rice') },
    noodle: { label: bi('Mi instan', 'Instant noodles'), shelf: { room: 240, fridge: 240 }, nut: N(380, 8, 54, 15, 2), group: 'carb', portion: bi('1 bungkus', '1 pack') },
    bread: { label: bi('Roti', 'Bread'), shelf: { room: 4, fridge: 7 }, nut: N(160, 5, 30, 2, 2), group: 'carb', portion: bi('2 lembar', '2 slices') },
    bread_whole: { label: bi('Roti gandum', 'Wholemeal bread'), shelf: { room: 4, fridge: 8 }, nut: N(170, 7, 28, 3, 5, { iron: 0.2 }), group: 'carb', portion: bi('2 lembar', '2 slices') },
    potato: { label: bi('Kentang', 'Potato'), shelf: { room: 20, fridge: 30 }, nut: N(115, 3, 26, 0, 3, { vitC: 0.3 }), group: 'carb', portion: bi('150 g', '150 g') },
    flour: { label: bi('Tepung terigu', 'Wheat flour'), shelf: { room: 180, fridge: 180 }, nut: N(180, 5, 38, 1, 1), group: 'carb', portion: bi('50 g', '50 g') },
    oat: { label: bi('Oat', 'Oats'), shelf: { room: 180, fridge: 180 }, nut: N(150, 5, 27, 3, 4, { iron: 0.3 }), group: 'carb', portion: bi('40 g', '40 g') },
    egg: { label: bi('Telur', 'Egg'), shelf: { room: 14, fridge: 30 }, nut: N(75, 6, 1, 5, 0, { vitA: 0.2, iron: 0.1 }), group: 'protein', portion: bi('1 butir', '1 egg') },
    chicken: { label: bi('Ayam', 'Chicken'), shelf: { room: 1, fridge: 20 }, nut: N(240, 25, 0, 15, 0, { iron: 0.2 }), group: 'protein', portion: bi('±125 g', '±125 g') },
    fish: { label: bi('Ikan', 'Fish'), shelf: { room: 1, fridge: 14 }, nut: N(150, 20, 0, 7, 0, { iron: 0.2, calcium: 0.2 }), group: 'protein', portion: bi('±100 g', '±100 g') },
    beef: { label: bi('Daging sapi', 'Beef'), shelf: { room: 1, fridge: 20 }, nut: N(250, 26, 0, 16, 0, { iron: 0.6 }), group: 'protein', portion: bi('±100 g', '±100 g') },
    tempe: { label: bi('Tempe', 'Tempeh'), shelf: { room: 2, fridge: 5 }, nut: N(100, 10, 5, 4, 1.5, { iron: 0.3, calcium: 0.2 }), group: 'protein', portion: bi('±50 g', '±50 g') },
    tofu: { label: bi('Tahu', 'Tofu'), shelf: { room: 2, fridge: 4 }, nut: N(65, 7, 2, 4, 0.5, { calcium: 0.3, iron: 0.2 }), group: 'protein', portion: bi('2 potong', '2 pieces') },
    sardine: { label: bi('Sarden', 'Sardines'), shelf: { room: 540, fridge: 540 }, opened: { room: 1, fridge: 2 }, nut: N(150, 15, 2, 9, 0, { calcium: 0.4, iron: 0.2 }), group: 'protein', portion: bi('½ kaleng', '½ can') },
    nugget: { label: bi('Nugget beku', 'Frozen nuggets'), shelf: { room: 1, fridge: 30 }, nut: N(220, 10, 15, 13, 1), group: 'protein', portion: bi('4 potong', '4 pieces') },
    veg_leafy: { label: bi('Sayur daun', 'Leafy greens'), shelf: { room: 2, fridge: 5 }, nut: N(25, 2, 4, 0, 2, { vitA: 0.6, vitC: 0.4, iron: 0.3, calcium: 0.2, fv: 1 }), group: 'veg', portion: bi('½ ikat', '½ bunch') },
    veg_other: { label: bi('Sayur lain', 'Other vegetables'), shelf: { room: 5, fridge: 12 }, nut: N(30, 1, 6, 0, 2, { vitA: 0.4, vitC: 0.4, fv: 1 }), group: 'veg', portion: bi('±100 g', '±100 g') },
    veg_frozen: { label: bi('Sayur beku', 'Frozen vegetables'), shelf: { room: 1, fridge: 60 }, nut: N(40, 2, 7, 0, 3, { vitA: 0.5, vitC: 0.3, fv: 1 }), group: 'veg', portion: bi('±100 g', '±100 g') },
    fruit: { label: bi('Buah', 'Fruit'), shelf: { room: 4, fridge: 10 }, nut: N(90, 1, 22, 0, 2.5, { vitC: 0.7, fv: 1 }), group: 'fruit', portion: bi('1 porsi', '1 portion') },
    fruit_long: { label: bi('Buah (tahan lama)', 'Fruit (keeps longer)'), shelf: { room: 14, fridge: 30 }, nut: N(80, 0, 21, 0, 2.5, { vitC: 0.5, fv: 1 }), group: 'fruit', portion: bi('1 buah', '1 piece') },
    milk: { label: bi('Susu UHT', 'UHT milk'), shelf: { room: 180, fridge: 180 }, opened: { room: 1, fridge: 4 }, nut: N(150, 8, 12, 8, 0, { calcium: 0.8, vitA: 0.2 }), group: 'dairy', portion: bi('250 ml', '250 ml') },
    juice: { label: bi('Jus buah', 'Fruit juice'), shelf: { room: 180, fridge: 180 }, opened: { room: 1, fridge: 5 }, nut: N(110, 1, 26, 0, 0.3, { vitC: 0.8 }), group: 'drink', portion: bi('250 ml', '250 ml') },
    oil: { label: bi('Minyak goreng', 'Cooking oil'), shelf: { room: 365, fridge: 365 }, nut: N(90, 0, 0, 10, 0), group: 'cooking', portion: bi('1 sdm', '1 tbsp') },
    seasoning: { label: bi('Bumbu', 'Seasoning'), shelf: { room: 365, fridge: 365 }, nut: N(5, 0, 1, 0, 0), group: 'cooking', portion: bi('secukupnya', 'to taste') },
    meal: { label: bi('Makanan jadi', 'Prepared meal'), shelf: { room: 1, fridge: 2 }, nut: N(600, 20, 80, 22, 3), group: 'meal', portion: bi('1 porsi', '1 serving') },
  };

  /*
   * Recipes. `needs` lists ingredient slots; each slot is an array of
   * acceptable ingredient types (the first available, soonest-expiring is used).
   * effort: 'simple' needs energy ≥ 10, 'normal' needs energy ≥ 25 and no fever.
   * fuel: 'stove' needs LPG; 'any' also works with a rice cooker on electricity.
   */
  const R = (id, name, effort, fuel, needs, opts = {}) => ({ id, name, effort, fuel, needs, oil: opts.oil || 0, seasoning: opts.seasoning || 0, tier: opts.tier || 'balanced', sickOk: !!opts.sickOk, note: opts.note || null });
  const RECIPES = [
    R('nasi_telur_sayur', bi('Nasi, telur dadar & tumis sayur', 'Rice, omelette & stir-fried greens'), 'normal', 'stove', [['rice'], ['egg'], ['veg_leafy', 'veg_other', 'veg_frozen']], { oil: 1, seasoning: 1 }),
    R('nasi_tempe_sayur', bi('Nasi, tempe/tahu goreng & sayur', 'Rice, fried tempeh/tofu & vegetables'), 'normal', 'stove', [['rice'], ['tempe', 'tofu'], ['veg_leafy', 'veg_other', 'veg_frozen']], { oil: 1, seasoning: 1 }),
    R('nasi_ayam_sayur', bi('Nasi, ayam & sayur', 'Rice, chicken & vegetables'), 'normal', 'stove', [['rice'], ['chicken'], ['veg_leafy', 'veg_other', 'veg_frozen']], { oil: 1, seasoning: 1, tier: 'varied' }),
    R('nasi_ikan_sayur', bi('Nasi, ikan & sayur', 'Rice, fish & vegetables'), 'normal', 'stove', [['rice'], ['fish'], ['veg_leafy', 'veg_other', 'veg_frozen']], { oil: 1, seasoning: 1, tier: 'varied' }),
    R('nasi_daging_sayur', bi('Nasi, semur daging & sayur', 'Rice, braised beef & vegetables'), 'normal', 'stove', [['rice'], ['beef'], ['veg_other', 'veg_leafy', 'veg_frozen']], { oil: 1, seasoning: 2, tier: 'premium' }),
    R('sayur_tahu_tempe', bi('Sayur lodeh tahu-tempe', 'Vegetable stew with tofu & tempeh'), 'normal', 'stove', [['rice'], ['tofu', 'tempe'], ['veg_other', 'veg_frozen', 'veg_leafy'], ['veg_leafy', 'veg_other', 'veg_frozen']], { seasoning: 2, tier: 'varied' }),
    R('kentang_telur', bi('Kentang balado & telur', 'Spicy potatoes & egg'), 'normal', 'stove', [['potato'], ['egg'], ['veg_other', 'veg_leafy', 'veg_frozen']], { oil: 1, seasoning: 1 }),
    R('bakwan_sayur', bi('Bakwan sayur & nasi', 'Vegetable fritters with rice'), 'normal', 'stove', [['rice'], ['flour'], ['veg_other', 'veg_leafy', 'veg_frozen']], { oil: 2, seasoning: 1, tier: 'low' }),
    R('nasi_telur', bi('Nasi telur ceplok', 'Rice with a fried egg'), 'simple', 'stove', [['rice'], ['egg']], { oil: 1, tier: 'low' }),
    R('nasi_sarden', bi('Nasi sarden', 'Rice with sardines'), 'simple', 'any', [['rice'], ['sardine']], { tier: 'low' }),
    R('nasi_nugget', bi('Nasi nugget', 'Rice with nuggets'), 'simple', 'stove', [['rice'], ['nugget']], { oil: 1, tier: 'low' }),
    R('mie_telur', bi('Mi instan pakai telur', 'Instant noodles with egg'), 'simple', 'any', [['noodle'], ['egg']], { tier: 'low' }),
    R('mie', bi('Mi instan saja', 'Plain instant noodles'), 'simple', 'any', [['noodle']], { tier: 'low' }),
    R('roti_telur', bi('Roti & telur', 'Bread & egg'), 'simple', 'stove', [['bread', 'bread_whole'], ['egg']], { oil: 1 }),
    R('roti_saja', bi('Roti saja', 'Just bread'), 'simple', 'none', [['bread', 'bread_whole']], { tier: 'low', sickOk: true }),
    R('oat_susu', bi('Oat dengan susu & buah', 'Oats with milk & fruit'), 'simple', 'any', [['oat'], ['milk'], ['fruit', 'fruit_long']], { tier: 'varied', sickOk: true }),
    R('bubur', bi('Bubur nasi', 'Rice porridge'), 'simple', 'any', [['rice']], { tier: 'low', sickOk: true, note: bi('Mudah dimakan saat sakit.', 'Easy to eat when unwell.') }),
    R('bubur_telur', bi('Bubur dengan telur', 'Rice porridge with egg'), 'simple', 'any', [['rice'], ['egg']], { sickOk: true }),
  ];

  RLS.data.food = {
    INGREDIENTS, RECIPES,
    recipeById: Object.fromEntries(RECIPES.map((r) => [r.id, r])),
    // Daily reference intake by sex and age band (AKG 2019, simplified).
    REFERENCE: {
      female: [[29, 2250, 60], [49, 2150, 60], [64, 1800, 60], [200, 1550, 58]],
      male: [[29, 2650, 65], [49, 2550, 65], [64, 2150, 65], [200, 1800, 64]],
    },
    FIBER_TARGET: 30, FV_TARGET: 5,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = RLS.data.food;
})(typeof globalThis !== 'undefined' ? globalThis : this);
