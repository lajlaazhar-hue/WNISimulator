/*
 * ui/apps-shop.js — DailyMart, ShopSquare, Glow, Care (stores), QuickBite,
 * the product sheet, cart & checkout with delivery, order history, wishlist.
 */
(function (root) {
  const RLS = root.RLS;
  const E = RLS.engine, M = RLS.money, D = RLS.data, I = RLS.i18n, U = RLS.U;
  const { esc, T, t, L, ic, pill, fmt, short, srcLink } = U;
  const ui = U.ui;
  const bi = I.bi;
  const G = () => U.G;
  const ING = D.food.INGREDIENTS;
  const STORES = ['dailymart', 'shopsquare', 'glow', 'care'];
  const TIER = { budget: bi('Hemat', 'Budget'), standard: bi('Standar', 'Standard'), premium: bi('Premium', 'Premium') };

  U.storeState = (id) => {
    if (!ui.store[id]) ui.store[id] = { cat: (D.catalog.departments[id] || [['all']])[0][0], q: '', tier: 'all', filter: 'all', sort: 'default', view: 'browse', delivery: null };
    return ui.store[id];
  };
  const cheapest = (opts) => opts.filter((o) => o.available).sort((a, b) => a.fee - b.fee || (Array.isArray(a.days) ? a.days[1] : 0) - (Array.isArray(b.days) ? b.days[1] : 0))[0] || null;
  const cartOf = (id) => (ui.carts[id] = ui.carts[id] || {});
  const cartLines = (id) => Object.entries(cartOf(id)).filter(([, q]) => q > 0).map(([itemId, qty]) => ({ itemId, qty }));
  U.cartLines = cartLines;
  const deptIcon = (it) => ((D.catalog.departments[it.store] || []).find((d) => d[0] === it.dept) || [0, 0, 'Package'])[2];
  const unitPrice = (it, price) => {
    if (it.unitLabel === 'g' || it.unitLabel === 'ml') return `${fmt(Math.round((price * 100) / it.unitQty))}/100 ${it.unitLabel}`;
    if (it.unitQty > 1) return `${fmt(Math.round(price / it.unitQty))}/pc`;
    return '';
  };
  const unitValue = (it) => E.priceOf(it, G().config) / Math.max(1, it.unitQty);
  const initials = (s) => String(s || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  U.ptile = (it, big) => `<span class="ptile t-${it.tier} ${big ? 'big' : ''}" style="--c:${(U.APPS[it.store] || U.APPS.shopsquare).color}" role="img" aria-label="${t('Ilustrasi produk', 'Product illustration')}: ${T(it.name)}">${ic(deptIcon(it))}<b>${esc(initials(it.brand || L(it.name)))}</b></span>`;

  function effects(it) {
    const out = [];
    if (it.food) {
      const ing = ING[it.food.type];
      out.push(bi(`+${it.food.portions} porsi ${ing.label.id.toLowerCase()} · tahan ±${ing.shelf.room} hari (suhu ruang) / ${ing.shelf.fridge} hari (kulkas)`, `+${it.food.portions} portions of ${ing.label.en.toLowerCase()} · keeps ~${ing.shelf.room} days (room) / ${ing.shelf.fridge} days (fridge)`));
    }
    if (it.supply) for (const [k, v] of Object.entries(it.supply)) { const s = U.SUPPLY.find((x) => x[0] === k); if (s) out.push(bi(`+${v} ${s[2] === 'cook' ? 'kali masak' : s[2] === 'x' ? 'sachet' : 'hari'} ${s[1].id.toLowerCase()}`, `+${v} ${s[2] === 'cook' ? 'cooks of' : s[2] === 'x' ? 'sachets of' : 'days of'} ${s[1].en.toLowerCase()}`)); }
    if (it.owned) out.push(it.functional || bi('Barang tahan lama', 'A durable item'));
    else if (it.functional) out.push(it.functional);
    if (it.durability) out.push(bi(`Awet ±${Math.round(it.durability / 30)} bulan pemakaian (perkiraan)`, `Lasts ~${Math.round(it.durability / 30)} months of use (estimate)`));
    if (it.course) out.push(bi(`${it.course.sessions} sesi belajar, masing-masing 1 waktu luang`, `${it.course.sessions} study sessions, 1 free slot each`));
    if (it.health) {
      if (it.health.relief && it.health.relief.length) out.push(bi(`Meredakan: ${it.health.relief.map((c) => E.CONDITIONS[c].label.id.toLowerCase()).join(', ')}`, `Eases: ${it.health.relief.map((c) => E.CONDITIONS[c].label.en.toLowerCase()).join(', ')}`));
      if (it.health.clinic) out.push(bi('Diperiksa dokter hari ini (1 waktu luang); dapat surat sakit bila perlu', 'A doctor sees you today (1 free slot); includes a sick note if needed'));
      if (it.health.counseling) out.push(bi('Satu sesi bicara dengan psikolog (1 waktu luang)', 'One session with a psychologist (1 free slot)'));
    }
    if (it.mood) { const fx = U.fxText(it.mood); if (fx) out.push(bi(`Terasa: ${fx}`, `Feels: ${fx}`)); }
    if (it.service && !it.health) out.push(bi('Layanan, langsung dipakai', 'A service, used right away'));
    return out;
  }

  function prodRow(id, it) {
    const g = G();
    const av = E.itemAvailability(it, g);
    const p = E.priceNow(g, it), base = E.priceOf(it, g.config);
    const deal = E.dealFor(g, it);
    const q = cartOf(id)[it.id] || 0;
    const wish = g.wishlist.includes(it.id);
    const canWish = id !== 'care';
    return `<div class="prod"><button class="pimg" data-a="item" data-x="${it.id}" aria-label="${T(it.name)}">${U.ptile(it)}</button>
      <span class="pmain"><button class="nm" data-a="item" data-x="${it.id}">${T(it.name)}</button>
      <span class="meta">${it.brand ? `<span>${esc(it.brand)}</span>` : ''}<span>${esc(it.size)}</span>${unitPrice(it, p) ? `<span>${unitPrice(it, p)}</span>` : ''} ${pill(E.priceStatus(it, g.config))} ${it.origin === 'imported' ? `<span class="pill p-muted">${t('Impor', 'Imported')}</span>` : ''} ${!it.essential ? `<span class="pill p-muted">${t('Opsional', 'Optional')}</span>` : ''}${deal ? ` <span class="pill p-deal">−${deal.pct}%</span>` : ''}${av.ok ? '' : ` <span class="pill p-warn">${T(av.reason)}</span>`}</span></span>
      <span class="pside"><span class="pr">${deal ? `<s class="muted small">${fmt(base)}</s><br>` : ''}${fmt(p)}</span>
      <span class="pact">${canWish ? `<button class="btn ghost sm" data-a="wish" data-x="${it.id}" aria-label="${wish ? t('Hapus dari wishlist', 'Remove from wishlist') : t('Simpan ke wishlist', 'Save to wishlist')}">${ic(wish ? 'HeartOff' : 'Heart')}</button>` : ''}
      ${!av.ok ? '' : q ? `<span class="qty"><button data-a="qty" data-store="${id}" data-x="${it.id}" data-d="-1" aria-label="${t('Kurangi', 'Remove one')}">${ic('Minus')}</button><span>${q}</span><button data-a="qty" data-store="${id}" data-x="${it.id}" data-d="1" aria-label="${t('Tambah', 'Add one')}">${ic('Plus')}</button></span>`
        : `<button class="addb" data-a="qty" data-store="${id}" data-x="${it.id}" data-d="1">${ic('Plus')} ${t('Tambah', 'Add')}</button>`}</span></span></div>`;
  }

  function pantryStrip() {
    const g = G(), s = g.supplies;
    const c = (types) => E.countOf(g, types);
    const bath = Math.min(s.soap, s.shampoo, s.toothpaste);
    const cell = (v, l, bad) => `<div class="${bad ? 'bad' : ''}"><b>${v}</b>${esc(l)}</div>`;
    const sv = E.servings(g);
    return `<div class="pantry">${cell(c(['rice', 'noodle', 'bread', 'bread_whole', 'potato', 'oat']), t('porsi pokok', 'staples'), c(['rice', 'noodle', 'bread', 'bread_whole', 'potato', 'oat']) < sv * 2)}${cell(c(['egg', 'chicken', 'fish', 'beef', 'tempe', 'tofu', 'sardine', 'nugget']), t('lauk', 'protein'), c(['egg', 'chicken', 'fish', 'beef', 'tempe', 'tofu', 'sardine', 'nugget']) < sv * 2)}
      ${cell(c(['veg_leafy', 'veg_other', 'veg_frozen']), t('sayur', 'veg'), c(['veg_leafy', 'veg_other', 'veg_frozen']) < sv)}${cell(c(['meal']), t('mkn jadi', 'ready'), false)}
      ${cell(Math.floor(s.water) + t('h', 'd'), t('air', 'water'), s.water < 1)}${cell(s.gasMeals, t('gas', 'LPG'), s.gasMeals < 3)}${cell(Math.floor(bath) + t('h', 'd'), t('mandi', 'bath'), bath < 1)}${cell(Math.floor(Math.min(s.laundry, s.dish)) + t('h', 'd'), t('cuci', 'washing'), s.laundry < 1)}</div>`;
  }

  function storeTop(id) {
    const g = G();
    let body = '';
    if (id === 'dailymart') {
      const groc = g.transactions.filter((x) => x.month === g.monthIndex && x.status === 'completed' && x.category === 'groceries').reduce((s, x) => s - x.amount, 0);
      body += pantryStrip() + `<div class="box"><div class="kv"><span>${t('Belanja dapur bulan ini', 'Groceries this month')}</span><span class="num">${fmt(groc)} / ${fmt(g.config.groceryBudget)}</span></div><div class="bar warm"><i style="width:${Math.min(100, (groc / Math.max(1, g.config.groceryBudget)) * 100)}%"></i></div>
        <input type="range" aria-label="${t('Anggaran belanja dapur', 'Grocery budget')}" min="300000" max="4000000" step="50000" value="${g.config.groceryBudget / 100}" data-in="grocbudget">
        <div class="chips">${Object.entries(D.baskets).map(([k, b]) => `<button class="chip" data-a="basket" data-x="${k}">${ic('ShoppingBasket')} ${T(b.label)}</button>`).join('')}</div>
        <small class="muted">${t('Paket belanja hanya mengisi keranjang; semuanya bisa diubah. Tanpa kulkas, belanja lauk segar untuk 1–2 hari saja.', 'Baskets only fill your cart; change anything. Without a fridge, buy fresh protein for a day or two only.')}${E.servings(g) > 1 ? ' ' + t(`Rumah tanggamu butuh ${E.servings(g)} porsi per makan.`, `Your household needs ${E.servings(g)} portions per meal.`) : ''}</small></div>`;
    }
    if (id === 'care') {
      const jkn = E.hasJkn(g), via = E.hasJknViaWork(g);
      const c = E.cond(g);
      const working = E.isScheduledToWork(g) && !g.day.leave;
      body += `<div class="box"><div class="row">${ic('ShieldCheck')}<span class="grow"><span class="t">${jkn ? t('JKN aktif', 'JKN active') : t('Tidak ada JKN aktif', 'No active JKN')}</span><span class="s">${via ? t('Lewat potongan gaji (1%). Periksa di faskes tingkat 1 dan rujukan ditanggung; obat di apotek di bawah bayar sendiri.', 'Through payroll (1%). Primary-care visits and referrals are covered; pharmacy items below are out of pocket.') : jkn ? t('Iuran mandiri kelas 3 dibayar tiap bulan.', 'You pay the independent class 3 contribution each month.') : t('Tanpa kantor yang mendaftarkan, kamu bisa ikut JKN mandiri kelas 3 (Rp35.000/orang/bulan setelah bantuan pemerintah).', 'Without an employer, you can join JKN independently (class 3, Rp35,000 per person per month after the government share).')}</span></span></div>
        ${via ? '' : `<div class="toggle"><span>${t('Bayar JKN mandiri kelas 3', 'Pay JKN class 3 independently')}</span>${U.sw('cfg-t', 'jknMandiri', g.config.jknMandiri)}</div><small class="muted">${pill('ESTIMATED')} ${t('Mulai jadi tagihan bulan depan.', 'Starts as a bill next month.')}</small>`}
        <div class="kv"><span>${t('Kondisimu', 'How you feel')}</span><span>${T(c.label)}</span></div>
        <div class="row" style="gap:6px;flex-wrap:wrap">${jkn ? `<button class="btn sm" data-a="clinic-jkn">${t('Periksa di faskes JKN', 'See your JKN clinic')}</button>` : ''}${working ? `<button class="btn sm sec" data-a="sick-leave">${t('Izin sakit hari ini', 'Call in sick today')}</button>` : ''}</div>
        <small class="muted">${t('Game ini tidak memberi nasihat medis.', 'This game does not give medical advice.')}</small></div>`;
    }
    if (id === 'shopsquare' || id === 'glow') {
      const left = g.wallet - E.unpaidBillsTotal(g);
      body += `<div class="box"><span class="small">${t('Uang setelah tagihan bulan ini', 'Money after this month\'s bills')}: <b class="num" style="color:${left < 0 ? 'var(--coral)' : 'inherit'}">${fmt(left)}</b> · ${t('godaan belanja', 'temptation')} ${g.mood.temptation}/100</span>
        ${id === 'glow' ? `<small class="muted">${t('Perawatan dasar (sabun, sampo, potong rambut sederhana) sudah cukup untuk memenuhi aturan kerja. Produk premium bersifat pilihan pribadi.', 'Basic care (soap, shampoo, a simple haircut) is enough for workplace rules. Premium products are a personal choice.')}</small>` : ''}</div>`;
    }
    return body;
  }

  function storeApp(id) {
    const g = G();
    const st = U.storeState(id);
    if (st.view === 'cart') return cartView(id);
    if (st.view === 'orders') return ordersView(id);
    if (st.view === 'wish') return wishView(id);
    const all = D.catalog.items.filter((i) => i.store === id && !E.itemAvailability(i, g).hidden);
    const cats = D.catalog.departments[id].filter(([k]) => all.some((i) => i.dept === k));
    if (!cats.some(([k]) => k === st.cat)) st.cat = cats[0][0];
    let body = storeTop(id);
    const deals = E.todaysDeals(g).filter((d) => d.item.store === id && !E.itemAvailability(d.item, g).hidden);
    body += `<div class="search">${ic('Search')}<input id="q-${id}" type="search" placeholder="${t('Cari di', 'Search')} ${T(U.APPS[id].name)}" value="${esc(st.q)}" data-in="storeq" data-store="${id}" aria-label="${t('Cari produk', 'Search products')}"></div>
      <div class="chips">${[['all', bi('Semua', 'All')], ['budget', TIER.budget], ['standard', TIER.standard], ['premium', TIER.premium]].map(([k, l]) => `<button class="chip ${st.tier === k ? 'on' : ''}" data-a="stier" data-store="${id}" data-x="${k}">${T(l)}</button>`).join('')}
      ${[['all', bi('Semua jenis', 'Any kind')], ['essential', bi('Kebutuhan', 'Essentials')], ['local', bi('Lokal', 'Local')], ['imported', bi('Impor', 'Imported')], ['deals', bi(`Diskon (${deals.length})`, `Deals (${deals.length})`)]].map(([k, l]) => `<button class="chip ${st.filter === k ? 'on' : ''}" data-a="sfilter" data-store="${id}" data-x="${k}">${T(l)}</button>`).join('')}</div>
      <div class="field"><span class="lab">${t('Urutkan', 'Sort')}</span>${U.seg('ssort', id, st.sort, [['default', bi('Tingkat', 'By tier')], ['price', bi('Termurah', 'Cheapest')], ['unit', bi('Harga satuan', 'Unit price')], ['durable', bi('Paling awet', 'Most durable')]])}</div>`;
    let items = st.q ? all.filter((i) => (L(i.name) + ' ' + (i.brand || '')).toLowerCase().includes(st.q.toLowerCase())) : st.filter === 'deals' ? all : all.filter((i) => i.dept === st.cat);
    if (st.tier !== 'all') items = items.filter((i) => i.tier === st.tier);
    if (st.filter === 'essential') items = items.filter((i) => i.essential);
    if (st.filter === 'local') items = items.filter((i) => i.origin === 'local');
    if (st.filter === 'imported') items = items.filter((i) => i.origin === 'imported');
    if (st.filter === 'deals') items = items.filter((i) => E.dealFor(g, i));
    const box = (list) => `<div class="box outline" style="padding:0 12px">${list.map((i) => prodRow(id, i)).join('')}</div>`;
    if (st.sort !== 'default') {
      const key = { price: (i) => E.priceNow(g, i), unit: unitValue, durable: (i) => -(i.durability || 0) }[st.sort];
      items = [...items].sort((a, b) => key(a) - key(b));
      body += items.length ? box(items) : `<div class="empty">${t('Tidak ada yang cocok.', 'No matches.')}</div>`;
      if (st.sort === 'unit') body += `<small class="muted">${t('Diurutkan per 100 g/ml atau per buah, supaya ukuran kemasan bisa dibandingkan adil.', 'Sorted per 100 g/ml or per piece, so package sizes compare fairly.')}</small>`;
    } else {
      for (const tier of ['budget', 'standard', 'premium']) {
        const list = items.filter((i) => i.tier === tier);
        if (!list.length) continue;
        const avg = Math.round(list.reduce((s, i) => s + E.priceOf(i, g.config), 0) / list.length);
        body += `<div class="tier-h tier-${tier}"><h3>${T(TIER[tier])}</h3><span class="small muted">${t('rata-rata', 'avg')} ${fmt(avg)}</span></div>${box(list)}`;
      }
      if (!items.length) body += `<div class="empty">${t('Tidak ada yang cocok.', 'No matches.')}</div>`;
    }
    body += id === 'dailymart' ? `<small class="muted">${t('Harga beras, telur, ayam, sapi dan minyak goreng yang terverifikasi adalah rata-rata nasional panel harga Bapanas (Jan–Feb 2026). Harga lokal berbeda, terutama di Indonesia timur; sesuaikan di Pengaturan. Merek fiktif.', 'Verified rice, egg, chicken, beef and cooking-oil prices are national averages from the Bapanas price panel (Jan–Feb 2026). Local prices differ, especially in eastern Indonesia; adjust in Settings. Brands are fictional.')}</small>`
      : `<small class="muted">${pill('ILLUSTRATIVE')} ${t('Harga, merek, diskon, stok dan pengiriman di toko ini adalah nilai game; mereknya fiktif. Gambar produk adalah ilustrasi.', 'Prices, brands, deals, stock and delivery in this store are gameplay values; brands are fictional. Product pictures are illustrations.')}</small>`;
    const lines = cartLines(id);
    const quote = E.quoteCart(g, lines);
    const nOrders = g.orders.filter((o) => o.store === id && ['shipped', 'replacement', 'damaged'].includes(o.status)).length;
    const nWish = g.wishlist.filter((w) => D.catalog.byId[w] && D.catalog.byId[w].store === id).length;
    const tabs = `<div class="tabs" role="tablist">${st.q || st.filter === 'deals' ? '' : cats.map(([k, l]) => `<button class="chip ${st.cat === k ? 'on' : ''}" data-a="scat" data-store="${id}" data-x="${k}">${T(l)}</button>`).join('')}
      <button class="chip" data-a="sview" data-store="${id}" data-x="orders">${ic('Package')} ${t('Pesanan', 'Orders')}${nOrders ? ` (${nOrders})` : ''}</button>${id !== 'care' ? `<button class="chip" data-a="sview" data-store="${id}" data-x="wish">${ic('Heart')} ${t('Wishlist', 'Wishlist')}${nWish ? ` (${nWish})` : ''}</button>` : ''}</div>`;
    const foot = lines.length ? `<button class="cartbar" data-a="sview" data-store="${id}" data-x="cart">${ic('ShoppingCart')}<span class="grow">${lines.reduce((s, l) => s + l.qty, 0)} ${t('barang', 'items')}</span><b>${fmt(quote.total)}</b>${ic('ChevronRight')}</button>` : '';
    return U.frame(id, body, { tabs, foot, scrollKey: st.cat + st.q + st.filter + st.tier + st.sort });
  }

  function cartView(id) {
    const g = G();
    const st = U.storeState(id);
    const lines = cartLines(id);
    const quote = E.quoteCart(g, lines);
    const opts = E.deliveryOptions(g, id, quote.total);
    let opt = opts.find((o) => o.id === st.delivery && o.available) || cheapest(opts) || opts[0];
    const fee = opt && opt.available ? opt.fee : 0;
    const total = quote.total + fee;
    const desire = quote.lines.some((l) => !l.item.essential);
    const afterBills = g.wallet - E.unpaidBillsTotal(g) - total;
    const week = E.estimateDailyEssentials(g) * 7;
    let body = `<div class="list">${quote.lines.map((l) => `<div class="li row">${U.ptile(l.item)}<span class="grow"><span class="t">${T(l.item.name)}</span><span class="s">${fmt(l.unit)} × ${l.qty} · ${T(TIER[l.item.tier])}${E.dealFor(g, l.item) ? ` · ${t('diskon', 'deal')} −${E.dealFor(g, l.item).pct}%` : ''}</span></span>
      <span class="qty"><button data-a="qty" data-store="${id}" data-x="${l.item.id}" data-d="-1" aria-label="${t('Kurangi', 'Remove one')}">${ic('Minus')}</button><span>${l.qty}</span><button data-a="qty" data-store="${id}" data-x="${l.item.id}" data-d="1" aria-label="${t('Tambah', 'Add one')}">${ic('Plus')}</button></span></div>`).join('') || `<div class="empty">${t('Keranjang kosong.', 'Your cart is empty.')}</div>`}</div>`;
    if (quote.lines.length) {
      body += `<div class="section-t">${t('Pengiriman', 'Delivery')}</div><div class="box outline">${opts.map((o) => `<button class="opt ${opt && o.id === opt.id ? 'on' : ''}" data-a="sdeliv" data-store="${id}" data-x="${o.id}" ${o.available ? '' : 'disabled'}><span class="grow"><span class="t">${T(o.label)}</span><span class="s">${Array.isArray(o.days) ? (o.days[1] ? t(`tiba ${o.days[0]}–${o.days[1]} hari`, `arrives in ${o.days[0]}–${o.days[1]} days`) : t('hari ini', 'today')) : o.days === 0 ? t('langsung', 'right away') : ''}${o.note ? ' · ' + T(o.note) : ''}${o.available ? '' : ' · ' + (E.isOnline(g) ? t('tidak tersedia di daerahmu', 'not available in your area') : t('butuh internet', 'needs internet'))}</span></span><b class="num">${o.fee ? fmt(o.fee) : t('Gratis', 'Free')}</b></button>`).join('')}
        ${id !== 'dailymart' ? `<small class="muted">${t('Paket bisa terlambat atau datang rusak (kejadian game); kamu bisa minta pengembalian dana atau penggantian.', 'Parcels can be late or arrive damaged (game events); you can ask for a refund or a replacement.')}</small>` : ''}</div>
        <div class="receipt"><div class="kv"><span>${t('Kebutuhan', 'Essentials')}</span><span>${fmt(quote.essential)}</span></div><div class="kv"><span>${t('Opsional', 'Optional')}</span><span>${fmt(quote.discretionary)}</span></div>
        ${quote.saved ? `<div class="kv"><span>${t('Hemat dari diskon', 'Saved on deals')}</span><span>${fmt(-quote.saved)}</span></div>` : ''}<div class="kv"><span>${t('Ongkir & biaya layanan', 'Delivery & service fee')}</span><span>${fmt(fee)}</span></div><hr>
        <div class="kv tot"><span>${t('Total bayar', 'Total to pay')}</span><span>${fmt(total)}</span></div><div class="kv"><span>${t('Saldo setelahnya', 'Balance after')}</span><span style="color:${g.wallet - total < 0 ? 'var(--coral)' : 'inherit'}">${fmt(g.wallet - total)}</span></div>
        <div class="kv"><span>${t('Setelah tagihan bulan ini', 'After this month\'s bills')}</span><span style="color:${afterBills < 0 ? 'var(--coral)' : 'inherit'}">${fmt(afterBills)}</span></div></div>`;
      if (desire) body += `<div class="box"><b class="small">${t('Sebelum membayar', 'Before you pay')}</b><small>${t(`Kebutuhan pokok seminggu ±${fmt(week)}. ${afterBills < week ? 'Setelah belanja ini, uangmu tidak cukup untuk seminggu kebutuhan pokok.' : 'Kebutuhan pokok seminggu masih tertutup.'} Menunda memindahkan barang ke wishlist tanpa biaya.`, `A week of essentials is about ${fmt(week)}. ${afterBills < week ? 'After this, your money won\'t cover a week of essentials.' : 'A week of essentials is still covered.'} Postponing moves items to your wishlist at no cost.`)}</small></div>`;
    }
    const foot = `<div class="setup-foot">${id === 'shopsquare' || id === 'glow' ? `<button class="btn sec" data-a="postpone" data-x="${id}" ${lines.length ? '' : 'disabled'}>${t('Tunda', 'Postpone')}</button>` : `<button class="btn sec" data-a="cart-clear" data-x="${id}" ${lines.length ? '' : 'disabled'}>${t('Kosongkan', 'Clear')}</button>`}<button class="btn" data-a="checkout" data-x="${id}" ${lines.length && opt && opt.available ? '' : 'disabled'}>${t('Bayar', 'Pay')} ${fmt(total)}</button></div>`;
    return U.frame(id, body, { title: t('Keranjang', 'Cart'), backLabel: L(U.APPS[id].short || U.APPS[id].name), foot, scrollKey: 'cart' });
  }

  const ORDER_ST = { shipped: [bi('Dikirim', 'Shipped'), 'p-due'], replacement: [bi('Pengganti dikirim', 'Replacement on the way'), 'p-due'], delivered: [bi('Diterima', 'Delivered'), 'p-ok'], damaged: [bi('Rusak / tidak sesuai', 'Damaged / wrong item'), 'p-warn'], refunded: [bi('Dana dikembalikan', 'Refunded'), 'p-muted'] };
  function ordersView(id) {
    const g = G();
    const list = g.orders.filter((o) => o.store === id);
    const body = list.map((o) => {
      const [lab, cls] = ORDER_ST[o.status] || [bi(o.status, o.status), 'p-muted'];
      return `<div class="box outline"><div class="row"><span class="grow"><span class="t">${t('Pesanan', 'Order')} ${esc(o.id)} · ${esc(E.absLabel(o.placedAbs))}</span><span class="s">${o.lines.map((l) => `${T(D.catalog.byId[l.itemId].name)} × ${l.qty}`).join(', ')}</span></span><span class="pill ${cls}">${T(lab)}</span></div>
        <div class="kv"><span>${t('Total', 'Total')}</span><span class="num">${fmt(o.total)}</span></div>
        ${['shipped', 'replacement'].includes(o.status) ? `<div class="kv"><span>${t('Perkiraan tiba', 'Expected')}</span><span>${esc(E.absLabel(o.etaAbs))}${o.promisedAbs && o.etaAbs > o.promisedAbs ? ' · ' + t('terlambat', 'delayed') : ''}</span></div>` : ''}
        ${o.status === 'delivered' && o.deliveredAbs ? `<div class="kv"><span>${t('Diterima', 'Delivered')}</span><span>${esc(E.absLabel(o.deliveredAbs))}</span></div>` : ''}
        ${o.refund ? `<div class="kv"><span>${t('Dana kembali (barang, tanpa ongkir)', 'Refunded (goods, not shipping)')}</span><span class="num">${fmt(o.refund)}</span></div>` : ''}
        ${o.events.length ? `<small class="muted">${o.events.map((e) => `${esc(E.absLabel(e.abs))}: ${T({ delay: bi('tertahan di gudang ekspedisi', 'held at the courier hub'), damaged: bi('datang rusak', 'arrived damaged'), replacement: bi('pengganti dikirim', 'replacement sent'), refund: bi('dana dikembalikan', 'refunded') }[e.kind])}`).join(' · ')}</small>` : ''}
        ${o.status === 'damaged' ? `<div class="row" style="gap:6px"><button class="btn sm" data-a="order-fix" data-x="${o.id}" data-k="refund">${t('Minta pengembalian dana', 'Ask for a refund')}</button><button class="btn sm sec" data-a="order-fix" data-x="${o.id}" data-k="replace">${t('Minta barang pengganti', 'Ask for a replacement')}</button></div>` : ''}</div>`;
    }).join('') || `<div class="empty">${t('Belum ada pesanan.', 'No orders yet.')}</div>`;
    return U.frame(id, body, { title: t('Pesanan', 'Orders'), backLabel: L(U.APPS[id].short || U.APPS[id].name), scrollKey: 'orders' });
  }
  function wishView(id) {
    const g = G();
    const list = g.wishlist.map((w) => D.catalog.byId[w]).filter((i) => i && i.store === id);
    const body = `<small class="muted">${t('Wishlist tidak dihitung sebagai pengeluaran. Barang di sini bisa dibeli kapan saja, atau dibiarkan saja.', 'The wishlist is not spending. Buy these whenever you like, or never.')}</small>${list.length ? `<div class="box outline" style="padding:0 12px">${list.map((i) => prodRow(id, i)).join('')}</div>` : `<div class="empty">${t('Wishlist kosong.', 'Your wishlist is empty.')}</div>`}`;
    return U.frame(id, body, { title: t('Wishlist', 'Wishlist'), backLabel: L(U.APPS[id].short || U.APPS[id].name), scrollKey: 'wish' });
  }
  STORES.forEach((id) => { U.apps[id] = () => storeApp(id); });

  // ── product sheet ───────────────────────────────────────────────────
  U.sheets.item = (sh) => {
    const g = G();
    const it = D.catalog.byId[sh.id];
    if (!it) return '';
    const p = E.priceNow(g, it), base = E.priceOf(it, g.config);
    const deal = E.dealFor(g, it);
    const av = E.itemAvailability(it, g);
    const s = U.src(it.sourceId);
    const urge = sh.urge ? g.urges.find((u) => u.id === sh.urge) : null;
    const wish = g.wishlist.includes(it.id);
    const left = g.wallet - E.unpaidBillsTotal(g);
    return `<div class="row" style="align-items:flex-start">${U.ptile(it, true)}<span class="grow"><h3>${T(it.name)}</h3><span class="small muted">${it.brand ? esc(it.brand) + ' · ' : ''}${esc(it.size)}</span></span></div>
      <div class="chips">${pill(E.priceStatus(it, g.config))}<span class="pill p-muted">${T(TIER[it.tier])}</span><span class="pill p-muted">${it.essential ? t('Kebutuhan', 'Essential') : t('Opsional', 'Optional')}</span><span class="pill p-muted">${it.origin === 'imported' ? t('Impor', 'Imported') : t('Lokal', 'Local')}</span>${deal ? `<span class="pill p-deal">${t('Diskon hari ini', 'Today\'s deal')} −${deal.pct}%</span>` : ''}${av.ok ? '' : `<span class="pill p-warn">${T(av.reason)}</span>`}</div>
      ${urge ? `<div class="box urge-box"><b class="small">${t('Kenapa ingin sekarang', 'Why you want it now')}</b><small>${T(urge.reason)}</small><div class="bar warm"><i style="width:${urge.intensity}%"></i></div><small class="muted">${t('Uang setelah tagihan', 'Money after bills')}: ${fmt(left)}. ${t('Tidak ada yang dibeli otomatis.', 'Nothing is bought automatically.')}</small>
        <div class="row" style="gap:6px"><button class="btn sm sec" data-a="urge-resist" data-x="${urge.id}">${t('Tahan dulu', 'Hold off')}</button><button class="btn sm sec" data-a="urge-wish" data-x="${urge.id}">${t('Simpan ke wishlist', 'Save for later')}</button></div></div>` : ''}
      <div class="receipt"><div class="kv"><span>${t('Harga', 'Price')}</span><span>${deal ? `<s>${fmt(base)}</s> ` : ''}${fmt(p)}</span></div><div class="kv"><span>${t('Kemasan', 'Package')}</span><span>${esc(it.size)}</span></div>${unitPrice(it, p) ? `<div class="kv"><span>${t('Harga satuan', 'Unit price')}</span><span>${unitPrice(it, p)}</span></div>` : ''}
        <div class="kv"><span>${t('Diamati', 'Observed')}</span><span>${esc(it.observed || t('tidak diamati', 'not observed'))}</span></div><div class="kv"><span>${t('Pengiriman', 'Delivery')}</span><span>${it.delivery === 'instant' ? t('langsung', 'immediate') : t('paket', 'parcel')}</span></div><hr>
        ${effects(it).map((x) => `<div class="small">• ${T(x)}</div>`).join('') || `<div class="small">—</div>`}</div>
      <div class="small">${s && s.type === 'game' ? `${pill('ILLUSTRATIVE')} ${t('Nilai permainan yang masuk akal, bukan harga yang diamati. Mereknya fiktif.', 'A plausible gameplay value, not an observed price. The brand is fictional.')}` : s ? `${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : esc(s.title)} — ${esc(s.note)}` : ''}</div>${it.note ? `<div class="small muted">${T(it.note)}</div>` : ''}
      <div class="row" style="gap:8px">${it.store !== 'care' ? `<button class="btn sec" data-a="wish" data-x="${it.id}">${ic(wish ? 'HeartOff' : 'Heart')} ${wish ? t('Hapus dari wishlist', 'Remove from wishlist') : t('Wishlist', 'Wishlist')}</button>` : ''}<button class="btn" style="flex:1" data-a="qty" data-store="${it.store}" data-x="${it.id}" data-d="1" ${av.ok ? '' : 'disabled'}>${t('Tambah ke keranjang', 'Add to cart')}</button></div>`;
  };

  // ── QuickBite ───────────────────────────────────────────────────────
  U.apps.quickbite = () => {
    const g = G();
    const online = E.isOnline(g), area = E.quickbiteAvailable(g);
    const lines = cartLines('quickbite');
    const quote = E.quoteCart(g, lines);
    const tip = U.sub('quickbite', 'tip', 0);
    const fees = E.quickbiteFees(quote.total, tip);
    const all = D.catalog.items.filter((i) => i.store === 'quickbite');
    const q = (k) => E.calculateGroceryBasket(D.baskets[k].lines.map(([itemId, qty]) => ({ itemId, qty })), g.config).total;
    const homeMeal = Math.round((q('week_everyday') + q('month_staples') / 4.3) / 21);
    const o = E.mealOptions(g);
    let body = !area ? `<div class="box" style="color:var(--coral)">${t('QuickBite belum menjangkau daerahmu.', 'QuickBite does not deliver to your area yet.')}</div>` : online ? '' : `<div class="box" style="color:var(--coral)"><div class="row">${ic('WifiOff')}<span>${t('Tidak ada koneksi. Bisa lihat menu, tapi memesan butuh Wi-Fi atau paket data.', 'No connection. You can browse, but ordering needs Wi-Fi or mobile data.')}</span></div><button class="btn sm sec" data-a="open" data-x="connect">${t('Beli paket data', 'Buy data')}</button></div>`;
    body += `<div class="section-t">${t('Satu kali makan, empat cara', 'One meal, four ways')} ${pill('ILLUSTRATIVE')}</div><div class="box outline">
      ${[[t('Masak sendiri', 'Cook at home'), homeMeal, t('Perkiraan dari paket belanja biasa', 'Estimated from the everyday basket')], [t('Warung/warteg', 'Food stall'), E.priceOf(D.catalog.byId.warteg, g.config), t('Nasi + 2 lauk', 'Rice and two sides')], [t('Pesan antar', 'Delivery'), Math.round(o.delivery.cost / o.servings), t('Menu termurah + ongkir & pajak', 'Cheapest dish + fees & tax')], [t('Restoran', 'Restaurant'), E.priceOf(D.catalog.byId.restaurant_set, g.config), t('Paket makan duduk', 'Sit-down set meal')]].map(([l, v, s]) => `<div class="row"><span class="grow"><span class="t">${l}</span><span class="s">${s}</span></span><b class="num">${fmt(v)}</b></div>`).join('')}</div>
      <small class="muted">${t('Makanan yang dipesan masuk ke dapur sebagai makanan jadi dan dimakan di waktu makan berikutnya (paling lambat hari ini). Minuman langsung dinikmati.', 'Ordered food goes into your kitchen as ready food and is eaten at the next meal (today at the latest). Drinks are enjoyed right away.')}</small>`;
    for (const [dept, label] of D.catalog.departments.quickbite) body += `<div class="section-t">${T(label)}</div><div class="box outline" style="padding:0 12px">${all.filter((i) => i.dept === dept).map((i) => prodRow('quickbite', i)).join('')}</div>`;
    if (lines.length) {
      const feeTotal = fees.reduce((s, f) => s + f.amount, 0);
      body += `<div class="receipt"><div class="kv"><span>${t('Makanan', 'Food')}</span><span>${fmt(quote.total)}</span></div>${fees.map((f) => `<div class="kv"><span>${T(f.label)}</span><span>${fmt(f.amount)}</span></div>`).join('')}<hr><div class="kv tot"><span>${t('Total', 'Total')}</span><span>${fmt(quote.total + feeTotal)}</span></div></div>
        <div class="field"><span class="lab">${t('Tip untuk driver', 'Tip')}</span>${U.seg('tip', 'tip', tip, [[0, bi('Tanpa tip', 'No tip')], [M.rp(2000), fmt(M.rp(2000))], [M.rp(5000), fmt(M.rp(5000))]])}</div>`;
    }
    const total = quote.total + fees.reduce((s, f) => s + f.amount, 0);
    const foot = lines.length ? `<div class="setup-foot"><button class="btn sec" data-a="cart-clear" data-x="quickbite">${t('Kosongkan', 'Clear')}</button><button class="btn" data-a="qb-order" ${online && area ? '' : 'disabled'}>${t('Pesan', 'Order')} ${fmt(total)}</button></div>` : '';
    return U.frame('quickbite', body, { foot });
  };

  // ── actions ─────────────────────────────────────────────────────────
  function checkoutMsg(res) {
    if (res.order && res.order.status === 'shipped') return t(`Dibayar ${fmt(res.total)}. Paket tiba ±${E.absLabel(res.order.etaAbs)}.`, `Paid ${fmt(res.total)}. Parcel due ${E.absLabel(res.order.etaAbs)}.`);
    return t(`Dibayar ${fmt(res.total)}.`, `Paid ${fmt(res.total)}.`) + (res.tight ? ' ' + t('Sisa uangmu sekarang tipis.', 'Money is tight now.') : '');
  }
  Object.assign(U.A, {
    item(el) { ui.sheet = { type: 'item', id: el.dataset.x }; },
    qty(el) {
      const cart = cartOf(el.dataset.store);
      cart[el.dataset.x] = Math.max(0, (cart[el.dataset.x] || 0) + Number(el.dataset.d));
      if (!cart[el.dataset.x]) delete cart[el.dataset.x];
      if (ui.sheet && ui.sheet.type === 'item') { ui.sheet = null; U.toast(t('Masuk keranjang.', 'Added to cart.')); }
      if (ui.app !== el.dataset.store && el.dataset.store) U.openApp(el.dataset.store);
    },
    scat(el) { U.storeState(el.dataset.store).cat = el.dataset.x; },
    stier(el) { U.storeState(el.dataset.store).tier = el.dataset.x; },
    sfilter(el) { U.storeState(el.dataset.store).filter = el.dataset.x; },
    ssort(el) { U.storeState(el.dataset.k).sort = el.dataset.x; },
    sview(el) { U.storeState(el.dataset.store).view = el.dataset.x; },
    sdeliv(el) { U.storeState(el.dataset.store).delivery = el.dataset.x; },
    'cart-clear'(el) { ui.carts[el.dataset.x] = {}; if (ui.store[el.dataset.x]) ui.store[el.dataset.x].view = 'browse'; },
    checkout(el) {
      const id = el.dataset.x;
      const st = U.storeState(id);
      const p = U.prev();
      const opts = E.deliveryOptions(G(), id, E.quoteCart(G(), cartLines(id)).total);
      const opt = opts.find((o) => o.id === st.delivery && o.available) || cheapest(opts);
      const res = E.processPurchase(G(), { store: id, lines: cartLines(id), delivery: opt ? opt.id : undefined });
      if (U.result(res, res.ok ? checkoutMsg(res) : '')) { ui.carts[id] = {}; st.view = res.order && res.order.status === 'shipped' ? 'orders' : 'browse'; }
      U.after(p);
    },
    postpone(el) { const id = el.dataset.x; cartLines(id).forEach((l) => { if (!G().wishlist.includes(l.itemId)) E.toggleWishlist(G(), l.itemId, true); }); ui.carts[id] = {}; U.storeState(id).view = 'browse'; U.toast(t('Dipindah ke wishlist. Tidak ada uang keluar.', 'Moved to your wishlist. No money spent.')); U.save(); },
    wish(el) { const on = E.toggleWishlist(G(), el.dataset.x); U.toast(on ? t('Disimpan ke wishlist.', 'Saved to wishlist.') : t('Dihapus dari wishlist.', 'Removed from wishlist.')); U.save(); },
    basket(el) {
      const b = D.baskets[el.dataset.x]; const cart = cartOf('dailymart'); let skipped = 0;
      b.lines.forEach(([iid, q]) => { const it = D.catalog.byId[iid]; if (it && E.isItemAvailable(it, G())) cart[iid] = (cart[iid] || 0) + q; else skipped++; });
      U.storeState('dailymart').view = 'cart';
      U.toast(`${L(b.label)}: ${t('masuk keranjang. Ubah apa saja sebelum bayar.', 'added. Change anything before paying.')}${skipped ? ' ' + t(`${skipped} barang sedang tidak tersedia.`, `${skipped} item(s) unavailable today.`) : ''}`);
    },
    'order-fix'(el) { const p = U.prev(); const r = E.resolveDamaged(G(), el.dataset.x, el.dataset.k); U.result(r, el.dataset.k === 'refund' ? t(`Dana ${fmt(r.refund || 0)} dikembalikan.`, `${fmt(r.refund || 0)} refunded.`) : t('Barang pengganti dikirim (±3 hari).', 'Replacement on its way (about 3 days).')); U.after(p); },
    tip(el) { U.setSub('quickbite', { tip: Number(el.dataset.x) }); },
    'qb-order'() {
      const p = U.prev();
      const res = E.processPurchase(G(), { store: 'quickbite', lines: cartLines('quickbite'), tip: U.sub('quickbite', 'tip', 0) });
      if (U.result(res, res.ok ? t(`Pesanan datang: ${fmt(res.total)}. Makanannya ada di Dapur.`, `Order arrived: ${fmt(res.total)}. The food is in your kitchen.`) : '')) ui.carts.quickbite = {};
      U.after(p);
    },
    'cfg-t'(el) { E.updateConfig(G(), { [el.dataset.x]: !G().config[el.dataset.x] }); U.save(); },
  });
  Object.assign(U.IN, {
    storeq(el) { U.storeState(el.dataset.store).q = el.value; },
    grocbudget(el) { E.updateConfig(G(), { groceryBudget: M.rp(Number(el.value)) }); U.save(); },
  });
  U.LIVE.add('storeq');
})(typeof globalThis !== 'undefined' ? globalThis : this);
