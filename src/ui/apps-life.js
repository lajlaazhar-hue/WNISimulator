/*
 * ui/apps-life.js — HomeBase, Utility Hub, Move, Dapur (kitchen), Aku (me),
 * AfterHours (recreation), Connect, Calendar.
 */
(function (root) {
  const RLS = root.RLS;
  const E = RLS.engine, M = RLS.money, D = RLS.data, I = RLS.i18n, U = RLS.U;
  const { esc, T, t, L, ic, pill, fmt, short, srcLink, num } = U;
  const ui = U.ui;
  const bi = I.bi;
  const G = () => U.G;
  const ING = D.food.INGREDIENTS;
  const TIERL = { budget: bi('Hemat', 'Budget'), typical: bi('Biasa', 'Typical'), premium: bi('Premium', 'Premium'), family: bi('Keluarga', 'Family'), standard: bi('Standar', 'Standard') };
  const daysLeftTxt = (abs) => { const n = abs - E.today(G()); return n <= 0 ? t('hari ini', 'today') : n === 1 ? t('besok', 'tomorrow') : t(`${n} hari`, `${n} days`); };

  // ── HomeBase ────────────────────────────────────────────────────────
  U.apps.homebase = () => {
    const g = G(), c = g.config;
    const opts = E.housingOptions(c.cityId, c.household);
    const cur = E.curHousing(g);
    const { city } = E.getLocality(c.cityId);
    const st = E.storageUse(g);
    const inc = (h) => ['electricity', 'water', 'internet'].map((k) => `<span class="pill ${h.includes[k] ? 'p-ok' : 'p-muted'}">${L({ electricity: bi('Listrik', 'Power'), water: bi('Air', 'Water'), internet: bi('Wi-Fi', 'Wi-Fi') }[k])} ${h.includes[k] ? t('termasuk', 'incl.') : t('terpisah', 'extra')}</span>`).join(' ');
    const card = (h) => {
      const isCur = h.id === c.housingId, isPend = h.id === g.pendingMove;
      return `<div class="box outline">
        <div class="row"><span class="grow"><span class="t">${T(h.label)}</span><span class="s">${T(TIERL[h.tier])} · ${t('kamar mandi', 'bathroom')} ${T(h.bathroom).toLowerCase()} · ${h.furnished ? t('berperabot', 'furnished') : t('kosong', 'unfurnished')} · ${t('muat', 'storage')} ±${h.capacity} ${t('porsi', 'portions')}${h.fridge ? ' · ' + t('ada kulkas', 'fridge') : ''}${h.ac ? ' · AC' : ''}</span></span>
        <span style="text-align:right"><b class="num">${h.type === 'family' ? fmt(c.familyContribution) : fmt(h.monthlyRent)}</b><br><span class="small muted">${h.type === 'family' ? t('kontribusimu', 'your contribution') : t('per bulan', 'per month')}</span></span></div>
        <div class="row" style="flex-wrap:wrap;gap:4px">${inc(h)} ${pill(h.status)}</div>
        <div class="small muted">${t('Deposit', 'Deposit')}: ${h.deposit ? fmt(h.deposit) + ' ' + t('di muka (sekali)', 'up front (one-off)') : t('tidak ada', 'none')}${h.note ? ' · ' + T(h.note) : ''}</div>
        ${isCur ? `<span class="pill p-ok" style="align-self:flex-start">${t('Kamu tinggal di sini', 'You live here')}</span>` : h.fits === false ? `<span class="pill p-warn" style="align-self:flex-start">${t('Terlalu kecil untuk rumah tanggamu', 'Too small for your household')}</span>` : isPend ? `<div class="row"><span class="pill p-due">${t('Pindah ke sini bulan depan', 'Moving here next month')}</span><button class="btn ghost sm" data-a="move-home" data-x="${c.housingId}">${t('Batal pindah', 'Cancel move')}</button></div>` : `<button class="btn sec sm" data-a="move-home" data-x="${h.id}" style="align-self:flex-start">${t('Pindah ke sini bulan depan', 'Move here next month')}</button>`}
      </div>`;
    };
    let body = `<div class="hero" style="background:#8a5a2b;color:#fff"><span class="lbl">${t('Tempat tinggal sekarang di', 'Current home in')} ${esc(city.name)}</span><span style="font-family:var(--f-display);font-weight:800;font-stretch:85%;font-size:24px">${T(cur.label)}</span>
      <div class="split"><span>${t('Per bulan', 'Monthly')}<b>${fmt(E.calculateMonthlyRent(c))}</b></span><span>${t('Tingkat sewa', 'Rent tier')}<b>${esc(city.tier)}</b></span><span>${t('Ruang simpan', 'Storage')}<b>${st.pantry}/${st.pantryCap}</b></span></div></div>`;
    if (cur.type === 'family') body += `<div class="box"><div class="field"><label for="fam">${t('Kontribusi bulanan untuk rumah', 'Monthly contribution to the household')}: <b class="num">${fmt(c.familyContribution)}</b></label>
      <input id="fam" type="range" min="0" max="2000000" step="50000" value="${c.familyContribution / 100}" data-in="fam"></div>
      <small class="muted">${t('Berlaku mulai tagihan bulan depan. Keluarga menyiapkan makan malam.', 'Applies from next month\'s bill. Your family cooks dinner.')}</small></div>`;
    body += `<small class="muted">${t(`Sewa dibagi per tingkat kota (${city.tier}): A dan B mengacu rata-rata Mamikos; C dan D perkiraan. Pindah berlaku bulan depan dan deposit baru ditagih saat itu. Ruang simpan membatasi berapa banyak makanan yang muat.`, `Rents are tiered by city type (${city.tier}): A and B anchored to Mamikos averages; C and D are estimates. Moving takes effect next month and charges the new deposit then. Storage limits how much food fits.`)}</small>`;
    for (const [type, label] of [['family', bi('Bersama keluarga', 'With family')], ['shared', bi('Berbagi', 'Shared')], ['kost', bi('Kost', 'Kost')], ['petak', bi('Kontrakan', 'Rented house')], ['apartment', bi('Apartemen', 'Apartment')]]) {
      const list = opts.filter((o) => o.type === type);
      if (list.length) body += `<div class="section-t">${T(label)}</div>${list.map(card).join('')}`;
    }
    if (!opts.some((o) => o.type === 'apartment')) body += `<div class="box"><span class="small muted">${t('Apartemen studio: tidak ada perkiraan untuk jenis kota ini.', 'Studio apartments: no estimate for this city type.')}</span> ${pill('UNAVAILABLE')}</div>`;
    return U.frame('homebase', body);
  };

  // ── Utility Hub ─────────────────────────────────────────────────────
  U.apps.utility = () => {
    const g = G(), c = g.config, h = E.curHousing(g);
    const prof = E.electricityProfile(g);
    const est = E.estimateElectricity(prof, c.ppjBp);
    const el = c.electricity;
    let body = '';
    if (h.includes.electricity) body += `<div class="box"><div class="row">${ic('Zap')}<span class="grow"><span class="t">${t('Listrik termasuk sewa', 'Electricity is included in your rent')}</span><span class="s">${t('Tidak perlu isi token. Kalau pindah ke tempat dengan meteran sendiri, rencanakan di sini.', 'No meter to top up. If you move somewhere with its own meter, plan it here.')}</span></span></div></div>`;
    else if (el.meter === 'prepaid') {
      const days = est.dailyKwh ? g.electricity.kwhBalance / est.dailyKwh : 0;
      body += `<div class="hero" style="background:#d48a00;color:#1f1400"><span class="lbl">${t('Meteran PLN prabayar', 'PLN prepaid meter')}</span><span class="big num" style="font-family:var(--f-display)">${g.electricity.kwhBalance.toFixed(1)} kWh</span>
        <div class="split"><span>${t('Cukup ±', 'Lasts about')}<b>${days.toFixed(1)} ${t('hari', 'days')}</b></span><span>${t('Pemakaian/hari', 'Use per day')}<b>${est.dailyKwh.toFixed(1)} kWh</b></span><span>${t('Tarif', 'Tariff')}<b>Rp${(est.tariffMinor / 100).toLocaleString('id-ID')}</b></span></div></div>
        <div class="section-t">${t('Beli token', 'Buy a token')}</div><div class="list">${E.TOKEN_NOMINALS.map((n) => { const b = E.tokenBreakdown(n, el.tariff, c.ppjBp); return `<div class="li row"><span class="grow"><span class="t num">${fmt(n)}</span><span class="s">Admin ${fmt(b.admin)} · PPJ ${fmt(b.ppj)} · ${t('energi', 'energy')} ${fmt(b.energyValue)} → <b>${b.kwh.toFixed(1)} kWh</b></span></span><button class="btn sm" data-a="token" data-x="${n}">${t('Beli', 'Buy')}</button></div>`; }).join('')}</div>
        <small class="muted">${t(`PPJ adalah pajak penerangan jalan yang ditetapkan tiap daerah; game ini memakai ${(c.ppjBp / 100).toLocaleString('id-ID')}% (ubah di Pengaturan). Biaya admin adalah biaya kanal pembayaran (ilustratif).`, `PPJ is a local street-lighting tax set by each regency or city; this game uses ${(c.ppjBp / 100).toLocaleString('en-US')}% (change in Settings). The admin fee is an illustrative payment-channel fee.`)}</small>`;
    } else body += `<div class="box"><div class="row">${ic('Zap')}<span class="grow"><span class="t">${t('PLN pascabayar', 'PLN postpaid')}</span><span class="s">${t(`Ditagih tgl 20 dari pemakaian bulan lalu. Bulan ini sejauh ini: ${g.electricity.kwhUsedMonth.toFixed(1)} kWh.`, `Billed on day 20 from last month's use. This month so far: ${g.electricity.kwhUsedMonth.toFixed(1)} kWh.`)}</span></span></div></div>`;
    const segL = (k, opts) => U.seg('elec', k, el[k], opts);
    const owned = g.owned.items;
    body += `<div class="section-t">${t('Profil pemakaian', 'Household profile')} ${pill('ESTIMATED')}</div><div class="box outline">
      <div class="field"><span class="lab">${t('Daya & tarif', 'Connection and tariff')}</span>${segL('tariff', [['900', '900 VA'], ['1300', '1300 VA'], ['2200', '2200 VA']])}
        <small class="muted">${esc(E.TARIFFS[el.tariff].label)}: Rp${E.TARIFFS[el.tariff].major.replace('.', ',')}/kWh. ${t('Tarif subsidi 450/900 VA butuh terdaftar di DTKS dan tidak diasumsikan.', 'Subsidised 450/900 VA tariffs need welfare-registry eligibility and are not assumed.')}</small></div>
      <div class="field"><span class="lab">${t('AC', 'Air conditioner')}</span>${segL('ac', [['none', bi('Tidak', 'None')], ['occasional', bi('Kadang', 'Sometimes')], ['nightly', bi('Tiap malam', 'Nightly')], ['heavy', bi('Sering', 'Heavy')]])}</div>
      <div class="field"><span class="lab">${t('Mesin cuci', 'Washing machine')}</span>${segL('washer', [['none', bi('Tidak', 'None')], ['shared', bi('Bersama', 'Shared')], ['private', bi('Sendiri', 'Own')]])}</div>
      <div class="toggle"><span>${t('Masak pakai rice cooker & ketel listrik', 'Cook with a rice cooker & kettle')}${owned.ricecooker ? '' : `<br><span class="small muted">${t('Kamu belum punya rice cooker.', 'You don\'t own a rice cooker.')}</span>`}</span>${owned.ricecooker ? U.sw('elec-t', 'electricCooking', el.electricCooking, t('Masak listrik', 'Electric cooking')) : `<button class="btn sm sec" data-a="open" data-x="shopsquare" data-cat="electronics">${t('Lihat', 'Shop')}</button>`}</div>
      <div class="toggle"><span>${t('Televisi', 'Television')}</span>${U.sw('elec-t', 'tv', el.tv, 'TV')}</div>
      <div class="kv"><span>${t('Kulkas', 'Fridge')} · ${t('Kipas', 'Fan')}</span><span>${owned.fridge ? t('punya', 'owned') : t('tidak', 'none')} · ${owned.fan ? t('punya', 'owned') : t('tidak', 'none')}</span></div>
      ${!h.includes.electricity ? `<div class="field"><span class="lab">${t('Meteran', 'Meter')}</span>${segL('meter', [['prepaid', bi('Prabayar', 'Prepaid')], ['postpaid', bi('Pascabayar', 'Postpaid')]])}<small class="muted">${t('Pascabayar mulai ditagih bulan depan.', 'Postpaid billing starts next month.')}</small></div>` : ''}</div>
    <div class="receipt">${est.lines.map(([l, k]) => `<div class="kv"><span>${T(l)}</span><span>${k} kWh</span></div>`).join('')}<hr>
      <div class="kv"><span>${t('Pemakaian sebulan', 'Monthly use')}</span><span>${est.kwh} kWh</span></div>
      <div class="kv"><span>${t('Energi sesuai tarif', 'Energy at tariff')}</span><span>${fmt(est.energy)}</span></div><div class="kv"><span>PPJ ${(c.ppjBp / 100).toLocaleString('id-ID')}%</span><span>${fmt(est.ppj)}</span></div>
      <div class="kv"><span>${t('Biaya admin', 'Admin fee')}</span><span>${fmt(est.admin)}</span></div><hr><div class="kv tot"><span>${t('Perkiraan sebulan', 'Estimated month')}</span><span>${fmt(est.total)}</span></div></div>
    <small class="muted">${t('Tarif', 'Tariffs')}: ${srcLink('pln_2026')}, ${t('kuartal IV 2026 tetap menurut', 'Q4 2026 unchanged per')} ${srcLink('pln_q4_2026')}. ${t('Angka kWh peralatan adalah perkiraan game.', 'Appliance kWh figures are game estimates.')}</small>
    <div class="section-t">${t('Utilitas lain', 'Other utilities')}</div>
    <div class="box outline">
      <div class="row"><span class="grow"><span class="t">${t('Air (PDAM)', 'Water (PDAM)')}</span><span class="s">${h.includes.water ? t('Termasuk sewa', 'Included in rent') : t('Tagihan bulanan, tempo tgl 20', 'Monthly bill, due day 20')}</span></span>${h.includes.water ? `<span class="pill p-ok">${t('termasuk', 'incl.')}</span>` : `<b class="num">${fmt(c.waterBill)}</b>`}</div>
      ${h.includes.water ? '' : `<input type="range" aria-label="${t('Tagihan air', 'Water bill')}" min="20000" max="200000" step="5000" value="${c.waterBill / 100}" data-in="water"><small class="muted">${pill('ILLUSTRATIVE')} ${t('Berlaku tagihan berikutnya.', 'Applies from the next bill.')}</small>`}
      <div class="row"><span class="grow"><span class="t">${t('Gas masak (LPG 3 kg)', 'Cooking gas (LPG 3 kg)')}</span><span class="s">${t(`Cukup ±${g.supplies.gasMeals} kali masak`, `About ${g.supplies.gasMeals} more cooks`)}</span></span><button class="btn sm sec" data-a="open" data-x="dailymart" data-cat="household">${t('Isi ulang', 'Refill')}</button></div>
      <div class="row"><span class="grow"><span class="t">Internet</span><span class="s">${h.includes.internet ? t('Wi-Fi termasuk sewa', 'Wi-Fi included in rent') : g.homeInternet ? t('Internet rumah berlangganan', 'Home fibre subscribed') : t('Tidak ada internet rumah', 'No home internet')}</span></span><button class="btn sm sec" data-a="open" data-x="connect">${t('Koneksi', 'Connect')}</button></div>
    </div>`;
    return U.frame('utility', body);
  };

  // ── Move ────────────────────────────────────────────────────────────
  const VLAB = () => D.world.VERIFY_LABEL;
  U.apps.move = () => {
    const g = G(), c = g.config;
    const tab = U.sub('move', 'tab', 'commute');
    const { city } = E.getLocality(c.cityId);
    const wd = E.workdaysInMonth(g.date.year, g.date.month, c.workweek);
    const dist = g.job && g.job.distanceKm ? g.job.distanceKm : c.distanceKm;
    const plans = E.commutePlans(c.cityId, dist, c);
    const pre = E.commutePresets(plans, wd);
    let body = '';
    if (tab === 'commute') {
      const remote = g.job && g.job.arrangement === 'remote';
      body += `${remote ? `<div class="box"><span class="small">${t('Pekerjaanmu jarak jauh: tidak ada ongkos berangkat kerja.', 'Your job is remote: no commute cost.')}</span></div>` : ''}
        <div class="box"><div class="field"><label for="dist">${t('Jarak rumah → kerja', 'Home → work distance')}: <b>${dist} km</b></label><input id="dist" type="range" min="1" max="45" value="${dist}" data-in="dist"></div>
        <div class="field"><span class="lab">${t('Hari kerja per minggu', 'Work week')}</span>${U.seg('cfg', 'workweek', c.workweek, [[5, bi('5 hari', '5 days')], [6, bi('6 hari', '6 days')]])}</div>
        <div class="field"><span class="lab">${t('Tingkat tarif ojol', 'Ride-hailing fare level')}</span>${U.seg('cfg', 'fareLevel', c.fareLevel, [['low', bi('Rendah', 'Low')], ['mid', bi('Tengah', 'Mid')], ['high', bi('Tinggi', 'High')]])}</div>
        <div class="chips">${[['cheapest', bi('Termurah yang masuk akal', 'Cheapest practical')], ['balanced', bi('Seimbang', 'Balanced')], ['convenience', bi('Paling praktis', 'Convenience')]].map(([k, l]) => pre[k] ? `<button class="chip ${c.commutePlanId === pre[k] ? 'on' : ''}" data-a="commute" data-x="${pre[k]}">${T(l)}</button>` : '').join('')}</div></div>
        <div class="section-t">${t('Pilihan di', 'Options in')} ${esc(city.name)} · ${wd} ${t('hari kerja', 'workdays')}</div><div class="list">`;
      for (const p of plans) {
        const monthly = E.monthlyCommuteCost(p, wd);
        const on = c.commutePlanId === p.id;
        body += `<div class="li"><div class="row"><span class="grow"><span class="t">${T(p.label)} ${on ? `<span class="pill p-ok">${t('Pilihanmu', 'Your commute')}</span>` : ''}</span>
          <span class="legs">${p.legs.map((l) => `<span>${T(l.label)} · <span class="num">${l.cost == null ? '—' : fmt(l.cost)}</span> ${pill(l.status)}</span>`).join('')}</span>
          ${p.note ? `<span class="s">${T(p.note)}</span>` : ''}${p.reason ? `<span class="s" style="color:var(--coral)">${T(p.reason)}</span>` : ''}${p.outdoor ? `<span class="s">${t('Kena hujan & panas; jas hujan/payung membantu.', 'Exposed to rain and sun; a raincoat or umbrella helps.')}</span>` : ''}</span>
          <span style="text-align:right">${p.perTrip != null ? `<b class="num">${fmt(p.perTrip)}</b><br><span class="small muted">${t('sekali jalan', 'per trip')}</span><br><span class="num small">${fmt(monthly)}${t('/bln', '/mo')}</span>` : ''}</span></div>
          ${p.id === 'bus' ? `<div class="row" style="margin-top:8px"><input id="busfare" class="inp" inputmode="numeric" placeholder="${t('Tarifmu sekali jalan, mis. 4000', 'Your fare per trip, e.g. 4000')}" value="${c.customBusFare != null ? c.customBusFare / 100 : ''}" data-in="busfare" aria-label="${t('Tarif bus', 'Bus fare')}"></div>` : ''}
          ${p.id === 'motorcycle' ? `<div class="toggle" style="margin-top:6px"><span class="small">${t('Masih mencicil motor', 'Still paying instalments')}</span>${U.sw('moto-credit', 'motorcycleCredit', c.motorcycleCredit)}</div>` : ''}
          ${p.id === 'ojol' ? `<div class="chips" style="margin-top:6px">${E.providersHere(c.cityId).filter((pr) => pr.kind === 'app').flatMap((pr) => Object.keys(pr.tiers).map((tk) => `<button class="chip ${c.ride.provider === pr.id && c.ride.tier === tk ? 'on' : ''}" data-a="ride-pref" data-x="${pr.id}" data-k="${tk}">${esc(L(pr.name))} ${T(E.TIER_LABEL[tk])}</button>`)).join('')}</div>` : ''}
          ${!on && p.available ? `<button class="btn sm sec" style="margin-top:8px" data-a="commute" data-x="${p.id}">${t('Pakai untuk kerja', 'Use this commute')}</button>` : ''}</div>`;
      }
      body += `</div><small class="muted">${t('Ongkos kerja dipotong otomatis tiap hari kerja (pergi-pulang). Hujan membuat ojol lebih mahal dan perjalanan lebih sering terlambat. Tarif ojol perkiraan dari', 'Your commute is charged each workday (two trips). Rain makes ride-hailing pricier and delays more likely. Ride-hailing fares are estimates from')} ${srcLink('game_ojol_model')}; ${t('tarif angkutan umum dari', 'transit fares from')} ${srcLink('transit_jkt_2026')}.</small>`;
    } else if (tab === 'ride') {
      const online = E.isOnline(g);
      const km = U.sub('move', 'km', 5);
      const verify = U.sub('move', 'verify', true), share = U.sub('move', 'share', true);
      const unv = g.unverifiedUntil === E.today(g);
      const offers = E.rideOffers(g, km, { includeUnverified: unv });
      const byProv = {};
      offers.forEach((o) => { (byProv[o.provider.id] = byProv[o.provider.id] || []).push(o); });
      const last = U.sub('move', 'last', null);
      body += `<div class="box">${online ? '' : `<div class="row" style="color:var(--coral)">${ic('WifiOff')}<span>${t('Tidak ada koneksi. Aplikasi ojol butuh internet; ojek pangkalan tetap bisa.', 'No connection. Ride-hailing apps need data; the ojek stand still works.')}</span></div>`}
        <div class="field"><label for="ridekm">${t('Jarak perjalanan', 'Trip distance')}: <b>${km} km</b></label><input id="ridekm" type="range" min="1" max="30" value="${km}" data-in="ridekm"></div>
        <div class="toggle"><span>${t('Cek pelat nomor & wajah pengemudi sebelum naik', 'Check the plate and driver\'s face before getting in')}</span>${U.sw('ride-opt', 'verify', verify)}</div>
        <div class="toggle"><span>${t('Bagikan perjalanan ke orang terdekat (jika ada fiturnya)', 'Share the trip with someone close (where available)')}</span>${U.sw('ride-opt', 'share', share)}</div>
        ${E.isRainy(g) ? `<small class="muted">${ic('CloudRain')} ${t('Sedang hujan: tarif aplikasi naik dan menunggu lebih lama.', 'It is raining: app fares are higher and waits longer.')}</small>` : ''}</div>`;
      if (last) body += `<div class="box ${last.cancelled ? 'warnbox' : ''}"><b>${t('Perjalanan terakhir', 'Last ride')}</b>${last.log.length ? last.log.map((x) => `<small>${T(x)}</small>`).join('') : `<small>${t('Perjalanan lancar.', 'An uneventful ride.')}</small>`}<small class="muted">${last.cancelled ? t('Tidak jadi naik, tidak ada biaya.', 'You did not ride; nothing was charged.') : `${fmt(last.price)} · ${t('tunggu', 'wait')} ${last.wait} ${t('menit', 'min')}`}</small></div>`;
      for (const [pid, list] of Object.entries(byProv)) {
        const p = list[0].provider;
        const isU = p.kind === 'unverified';
        const needsNet = p.kind !== 'informal';
        body += `<div class="box ${isU ? 'danger' : 'outline'}"><div class="row"><span class="grow"><span class="t">${esc(L(p.name))}</span><span class="s">${T(p.label)}</span></span>${isU ? `<span class="pill p-warn">${t('Tidak terverifikasi', 'Unverified')}</span>` : ''}</div>
          <div class="feat">${[[p.verify !== 'unknown', T(VLAB()[p.verify])], [p.share, t('Bagikan perjalanan', 'Trip sharing')], [p.sos, t('Tombol darurat', 'Emergency button')], [p.insurance, t('Asuransi perjalanan', 'Trip insurance')]].map(([ok, l]) => `<span class="pill ${ok ? 'p-ok' : 'p-muted'}">${ic(ok ? 'Check' : 'X')} ${l}</span>`).join('')}</div>
          <small class="muted">${t('Bantuan', 'Support')}: ${T(p.support)} · ${t('pembatalan', 'cancellations')}: ${p.cancel >= 0.12 ? t('sering', 'frequent') : p.cancel >= 0.07 ? t('kadang', 'occasional') : t('jarang', 'rare')}${p.note ? ' · ' + T(p.note) : ''}</small>
          ${isU ? `<small style="color:var(--coral)">${t('Tidak lewat aplikasi: identitas pengemudi tidak diketahui, tidak ada asuransi, tidak ada tombol darurat, dan harga bisa berubah di jalan.', 'Not through an app: the driver\'s identity is unknown, there is no insurance or emergency button, and the price may change mid-trip.')}</small>` : ''}
          ${list.map((o) => `<div class="row"><span class="grow"><span class="t">${T(E.TIER_LABEL[o.tier])} · ${o.vehicle === 'car' ? t('mobil', 'car') : t('motor', 'motorbike')}</span><span class="s">${t('tunggu', 'wait')} ${o.wait[0]}–${o.wait[1]} ${t('menit', 'min')}${o.rainSurge ? ' · ' + t('tarif hujan', 'rain pricing') : ''} ${pill(o.status)}</span></span><b class="num">${o.haggle ? `${fmt(o.low)}–${fmt(o.high)}` : fmt(o.price)}</b><button class="btn sm ${isU ? 'warn' : ''}" data-a="ride" data-x="${o.key}" ${needsNet && !online ? 'disabled' : ''}>${isU ? t('Terima', 'Accept') : t('Pesan', 'Book')}</button></div>`).join('')}
          ${isU ? `<button class="btn ghost sm" data-a="unverified-ignore">${t('Tolak tawaran ini', 'Turn this offer down')}</button>` : ''}</div>`;
      }
      body += `<small class="muted">${t('Semua penyedia fiktif. Waktu tunggu, pembatalan dan kejadian di perjalanan adalah parameter game, bukan peringkat keselamatan perusahaan mana pun. Kejadian serius sangat jarang dan dibuat untuk mengenalkan langkah keselamatan.', 'All providers are fictional. Waits, cancellations and incidents are game parameters, not safety ratings of any company. Serious incidents are very rare and exist to show safety steps.')}</small>
        <div class="section-t">${t('Riwayat', 'History')}</div><div class="list">${g.transactions.filter((x) => x.category === 'transport').slice(0, 20).map(U.txRow).join('') || `<div class="empty">${t('Belum ada perjalanan.', 'No trips yet.')}</div>`}</div>`;
    } else {
      body += `<div class="list">${E.transportModes(c.cityId).map((m) => `<div class="li row"><span class="grow"><span class="t">${T(m.label)}</span><span class="s">${T(m.fare)}${m.note ? ' · ' + T(m.note) : ''}</span></span>
        <span class="pill ${m.availability === 'available' ? 'p-ok' : m.availability === 'route' || m.availability === 'reported' ? 'p-due' : 'p-warn'}">${T({ available: bi('Ada', 'Available'), route: bi('Rute tertentu', 'Some routes'), reported: bi('Dilaporkan ada', 'Reported'), limited: bi('Terbatas', 'Limited'), uncertain: bi('Tidak menentu', 'Uncertain') }[m.availability])}</span></div>`).join('')}</div>
        <small class="muted">${t('Hanya layanan yang tercatat untuk daerah ini. MRT, LRT dan TransJakarta hanya di Jakarta; KRL hanya di jalur Commuter Line.', 'Only services recorded for this locality are listed. MRT, LRT and TransJakarta appear only in Jakarta; KRL only where the Commuter Line runs.')}</small>`;
    }
    return U.frame('move', body, { tabs: U.tabs('move', [['commute', bi('Berangkat kerja', 'Commute')], ['ride', bi('Pesan perjalanan', 'Book a ride')], ['area', bi('Layanan di sini', 'Services here')]], tab), scrollKey: tab });
  };

  // ── Dapur (kitchen) ─────────────────────────────────────────────────
  const SUPPLY = [['water', bi('Air minum', 'Drinking water'), 'd'], ['gasMeals', bi('Gas LPG', 'LPG'), 'cook'], ['soap', bi('Sabun', 'Soap'), 'd'], ['shampoo', bi('Sampo', 'Shampoo'), 'd'], ['toothpaste', bi('Pasta gigi', 'Toothpaste'), 'd'],
    ['laundry', bi('Deterjen', 'Detergent'), 'd'], ['dish', bi('Sabun cuci piring', 'Dish soap'), 'd'], ['tissue', bi('Tisu', 'Tissue'), 'd'], ['homeclean', bi('Kebersihan rumah', 'Home cleaning'), 'd'], ['deodorant', bi('Deodoran', 'Deodorant'), 'd'],
    ['repellent', bi('Anti nyamuk', 'Mosquito repellent'), 'd'], ['pads', bi('Pembalut', 'Pads'), 'd'], ['baby', bi('Popok/susu bayi', 'Baby supplies'), 'd'], ['coffee', bi('Kopi', 'Coffee'), 'x'],
    ['cleanser', bi('Sabun muka', 'Cleanser'), 'd'], ['moisturizer', bi('Pelembap', 'Moisturiser'), 'd'], ['sunscreen', bi('Tabir surya', 'Sunscreen'), 'd'], ['serum', bi('Serum', 'Serum'), 'd'], ['makeup', bi('Riasan', 'Makeup'), 'd'], ['grooming', bi('Perawatan diri', 'Grooming'), 'd']];
  U.SUPPLY = SUPPLY;
  const COOKCAP = { normal: bi('Bisa memasak menu lengkap', 'Can cook a full meal'), simple: bi('Hanya kuat menu sederhana', 'Up to simple meals only'), none: bi('Tidak kuat memasak', 'Not well enough to cook') };
  U.apps.dapur = () => {
    const g = G();
    const tab = U.sub('dapur', 'tab', 'cook');
    const sv = E.servings(g);
    let body = '';
    if (tab === 'cook') {
      const open = E.SLOTS.filter((s) => !g.food.meals[s]);
      let slot = U.sub('dapur', 'slot', open[0] || 'dinner');
      if (!open.includes(slot)) slot = open[0] || null;
      const c = E.cond(g);
      const fam = E.curHousing(g).type === 'family';
      body += `<div class="box"><div class="row">${ic(c === E.CONDITIONS.healthy ? 'ChefHat' : 'Thermometer')}<span class="grow"><span class="t">${T(c.label)}${E.severityText(g) ? ` (${T(E.severityText(g))})` : ''}</span><span class="s">${T(COOKCAP[g.mood.energy < 25 && c.cook === 'normal' ? 'simple' : c.cook])} · ${t('energi', 'energy')} ${g.mood.energy} · ${t('gas', 'gas')} ${g.supplies.gasMeals}× · ${sv} ${t('porsi per makan', 'portions per meal')}</span></span></div>
        ${c.cook !== 'normal' || g.mood.energy < 25 ? `<small>${t('Tidak apa-apa memilih yang lebih mudah hari ini: menu sederhana, makanan jadi, minta bantuan, atau istirahat dulu.', 'It\'s fine to pick something easier today: a simple meal, ready food, asking for help, or resting first.')}</small>` : ''}</div>
        <div class="section-t">${t('Makan hari ini', 'Today\'s meals')}</div><div class="box outline">${E.SLOTS.map((s) => { const m = g.food.meals[s]; return `<div class="kv"><span>${T(E.SLOT_LABEL[s])}</span><span>${m ? T(m.label) : s === 'dinner' && fam ? t('makan bersama keluarga (otomatis)', 'family dinner (automatic)') : `<span class="muted">${t('belum', 'not yet')}</span>`}</span></div>`; }).join('')}
        <small class="muted">${t('Yang belum diisi akan dimasak otomatis dari stok saat hari berakhir jika bisa.', 'Open meals are cooked from your stock automatically at the end of the day if possible.')}</small></div>`;
      if (slot) {
        const o = E.mealOptions(g);
        body += `<div class="field"><span class="lab">${t('Untuk', 'For')}</span>${U.seg('dapur-slot', 'slot', slot, open.map((s) => [s, E.SLOT_LABEL[s]]))}</div>`;
        const rs = D.food.RECIPES.map((r) => ({ r, st: E.recipeStatus(g, r, sv) })).sort((a, b) => (b.st.ok - a.st.ok));
        body += `<div class="section-t">${t('Masak', 'Cook')} · ${T(E.SLOT_LABEL[slot])}</div><div class="list">${rs.map(({ r, st }) => `<div class="li"><div class="row"><span class="grow"><span class="t">${T(r.name)}</span><span class="s">${r.needs.map((sl) => sl.map((x) => L(ING[x].label)).join('/')).join(' + ')}${r.oil ? ' + ' + L(ING.oil.label).toLowerCase() : ''} · ${r.effort === 'simple' ? t('sederhana', 'simple') : t('lengkap', 'full')} · ${r.fuel === 'stove' ? t('kompor gas', 'gas stove') : r.fuel === 'any' ? t('gas/rice cooker', 'gas or rice cooker') : t('tanpa masak', 'no cooking')}</span>
            ${st.ok ? '' : `<span class="s" style="color:var(--coral)">${st.reasons.map(T).join(' · ')}</span>`}</span><button class="btn sm" data-a="cook" data-x="${r.id}" ${st.ok ? '' : 'disabled'}>${t('Masak', 'Cook')}</button></div></div>`).join('')}</div>`;
        body += `<div class="section-t">${t('Pilihan lain', 'Other options')}</div><div class="box outline">
          ${E.countOf(g, ['meal']) >= sv ? `<div class="row"><span class="grow"><span class="t">${t('Makan makanan jadi yang ada', 'Eat ready food you have')}</span><span class="s">${E.countOf(g, ['meal'])} ${t('porsi di stok', 'in stock')}</span></span><button class="btn sm" data-a="meal-ready">${t('Makan', 'Eat')}</button></div>` : ''}
          ${o.helper.available ? `<div class="row"><span class="grow"><span class="t">${t('Minta bantuan', 'Ask for help from')} ${T(o.helper.who)}</span><span class="s">${T(o.helper.recipe.name)}</span></span><button class="btn sm sec" data-a="meal-get" data-x="helper">${t('Minta', 'Ask')}</button></div>` : ''}
          <div class="row"><span class="grow"><span class="t">${t('Beli di warung', 'Buy at a food stall')}</span><span class="s">${T(o.warung.item.name)} × ${o.servings}${o.warung.note ? ' · ' + T(o.warung.note) : ''}</span></span><b class="num">${fmt(o.warung.cost)}</b><button class="btn sm sec" data-a="meal-get" data-x="warung" ${o.warung.available ? '' : 'disabled'}>${t('Beli', 'Buy')}</button></div>
          <div class="row"><span class="grow"><span class="t">${t('Pesan antar (termurah)', 'Delivery (cheapest)')}</span><span class="s">${T(o.delivery.item.name)} · ${t('termasuk ongkir', 'incl. fees')}${o.delivery.available ? '' : ' · ' + t('butuh internet', 'needs internet')}</span></span><b class="num">${fmt(o.delivery.cost)}</b><button class="btn sm sec" data-a="meal-get" data-x="delivery" ${o.delivery.available ? '' : 'disabled'}>${t('Pesan', 'Order')}</button></div>
          <div class="row"><span class="grow"><span class="t">${t('Istirahat dulu', 'Rest first')}</span><span class="s">${t('Bersantai & tidur siang (1 waktu luang)', 'Relax and nap (1 free slot)')}</span></span><button class="btn sm sec" data-a="act" data-x="relax" ${E.freeSlots(g) ? '' : 'disabled'}>${t('Istirahat', 'Rest')}</button></div>
          ${c.sick ? `<div class="row"><span class="grow"><span class="t">${t('Obat atau periksa', 'Medicine or a check-up')}</span><span class="s">${t('Apotek & klinik', 'Pharmacy & clinic')}</span></span><button class="btn sm sec" data-a="open" data-x="care">${t('Sehat', 'Care')}</button></div>` : ''}
          <div class="row"><span class="grow"><span class="t">${t('Lewati', 'Skip')}</span><span class="s">${t('Energi dan suasana hati turun', 'Lower energy and mood')}</span></span><button class="btn sm ghost" data-a="meal-get" data-x="skip">${t('Lewati', 'Skip')}</button></div></div>`;
      } else body += `<div class="empty">${t('Semua waktu makan hari ini sudah terisi.', 'All of today\'s meals are covered.')}</div>`;
    } else if (tab === 'stock') {
      const st = E.storageUse(g);
      const inv = E.inventoryByType(g);
      const today = E.today(g);
      body += `<div class="box"><div class="kv"><span>${t('Ruang simpan', 'Storage')}</span><span class="num">${st.pantry}/${st.pantryCap} ${t('porsi', 'portions')}</span></div><div class="bar ${st.pantry > st.pantryCap ? 'bad' : ''}"><i style="width:${Math.min(100, (st.pantry / st.pantryCap) * 100)}%"></i></div>
        <div class="kv"><span>${t('Kulkas', 'Fridge')}</span><span class="num">${E.ownsFridge(g) ? `${st.fridge}/${st.fridgeCap}${E.electricityOn(g) ? '' : ' · ' + t('MATI (listrik padam)', 'OFF (no power)')}` : t('tidak punya', 'none')}</span></div>
        ${E.ownsFridge(g) ? '' : `<small class="muted">${t('Tanpa kulkas, daging, ikan dan tahu-tempe cepat basi. Beli secukupnya untuk 1–2 hari.', 'Without a fridge, meat, fish and tofu/tempeh spoil fast. Buy only what you need for a day or two.')}</small>`}</div>
        <div class="section-t">${t('Bahan makanan', 'Food')}</div><div class="list">${inv.map((x) => `<div class="li row"><span class="grow"><span class="t">${T(ING[x.type].label)}</span><span class="s">${x.qty} ${t('porsi', 'portions')} · ${T(ING[x.type].portion)}${x.fridge ? ` · ${x.fridge} ${t('di kulkas', 'in fridge')}` : ''}</span></span><span class="pill ${x.soonest - today <= 0 ? 'p-warn' : x.soonest - today <= 2 ? 'p-due' : 'p-muted'}">${t('basi', 'spoils')} ${daysLeftTxt(x.soonest + 1)}</span></div>`).join('') || `<div class="empty">${t('Dapur kosong.', 'The kitchen is empty.')}</div>`}</div>
        <small class="muted">${pill('ESTIMATED')} ${t('Umur simpan adalah perkiraan game. Bahan yang paling cepat basi dipakai dulu saat memasak. Makanan basi dicatat sebagai sampah dengan nilai belinya; tidak ditagih dua kali.', 'Shelf lives are game estimates. The soonest-to-spoil food is used first. Spoiled food is logged as waste at its purchase value; it is never charged twice.')}</small>
        <div class="section-t">${t('Persediaan rumah', 'Household supplies')}</div><div class="box outline">${SUPPLY.filter(([k]) => k !== 'pads' || g.config.character.menstruates).filter(([k]) => k !== 'baby' || E.members(g).infants).map(([k, l, u]) => { const v = Math.floor(g.supplies[k] || 0); return `<div class="kv"><span>${T(l)}</span><span class="${v < 2 && ['water', 'gasMeals', 'soap', 'toothpaste', 'laundry', 'pads', 'baby'].includes(k) ? 'warn-t' : ''}">${v} ${u === 'd' ? t('hari', 'days') : u === 'cook' ? t('kali masak', 'cooks') : t('sachet', 'sachets')}</span></div>`; }).join('')}
        <button class="btn sm sec" data-a="open" data-x="dailymart" data-cat="household">${t('Belanja di DailyMart', 'Shop at DailyMart')}</button></div>
        <div class="section-t">${t('Peralatan', 'Appliances')}</div><div class="box outline">${[['fridge', bi('Kulkas', 'Fridge')], ['ricecooker', bi('Rice cooker', 'Rice cooker')], ['fan', bi('Kipas angin', 'Fan')]].map(([k, l]) => `<div class="kv"><span>${T(l)}</span><span>${g.owned.items[k] ? t('punya', 'owned') : t('tidak', 'none')}</span></div>`).join('')}</div>`;
    } else if (tab === 'nutrition') {
      const n = E.nutritionScore(g);
      const p = n.parts;
      body += `<div class="hero" style="background:#a0522d;color:#fff"><span class="lbl">${t('Gizi 5 hari terakhir (perkiraan)', 'Nutrition, last 5 days (estimate)')}</span><span class="big">${n.score}/100</span><span class="lbl">${T(n.label)}</span></div>`;
      if (p) {
        const row = (l, v, target, unit) => `<div class="field"><div class="kv"><span>${l}</span><span class="num">${v}${unit ? ' ' + unit : ''}${target ? ` / ${target}` : ''}</span></div>${target ? `<div class="bar ${v / target < 0.6 ? 'bad' : v / target < 0.85 ? 'warm' : ''}"><i style="width:${Math.min(100, (v / target) * 100)}%"></i></div>` : ''}</div>`;
        body += `<div class="box outline">${row(t('Energi rata-rata', 'Average energy'), Math.round(p.kcal), Math.round(p.ref.kcal), 'kkal')}${row(t('Protein', 'Protein'), Math.round(p.protein), p.ref.protein, 'g')}
          ${row(t('Porsi sayur & buah per hari', 'Fruit & veg portions a day'), Math.round(p.fv * 10) / 10, D.food.FV_TARGET)}${row(t('Serat', 'Fibre'), Math.round(p.fiber), D.food.FIBER_TARGET, 'g')}
          ${row(t('Keragaman bahan (5 hari)', 'Variety of foods (5 days)'), p.variety, 7)}${row(t('Makan per hari', 'Meals a day'), Math.round(p.meals * 10) / 10, 3)}
          <div class="kv"><span>${t('Hari dengan air minum', 'Days with drinking water')}</span><span>${Math.round(p.hydration * 100)}%</span></div></div>`;
      }
      body += `<div class="section-t">${t('Per hari', 'By day')}</div><div class="list">${g.food.nutritionDays.slice().reverse().map((x) => `<div class="li row"><span class="pill p-muted">${esc(E.absLabel(x.abs))}</span><span class="grow small">${Math.round(x.kcal)} kkal · ${Math.round(x.protein)} g protein · ${Math.round(x.fv * 10) / 10} ${t('porsi sayur/buah', 'fruit/veg')} · ${x.meals} ${t('kali makan', 'meals')}</span></div>`).join('') || `<div class="empty">${t('Belum ada hari yang tercatat.', 'No days logged yet.')}</div>`}</div>
        <small class="muted">${pill('ESTIMATED')} ${t('Kebutuhan mengacu', 'Reference intake from')} ${srcLink('akg_2019')} ${t('(disederhanakan menurut usia & jenis kelamin). Nilai gizi per porsi adalah perkiraan game, dinilai per beberapa hari, bukan per makan. Ini bukan saran diet.', '(simplified by age and sex). Per-portion values are game estimates, judged over several days rather than per meal. This is not dietary advice.')}</small>`;
    } else {
      const month = g.food.waste.filter((w) => w.month === g.monthIndex);
      body += `<div class="box"><div class="kv"><span>${t('Terbuang bulan ini', 'Wasted this month')}</span><span class="num"><b>${fmt(E.wasteThisMonth(g))}</b></span></div><div class="kv"><span>${t('Nilai stok sekarang', 'Food in stock now')}</span><span class="num">${fmt(E.inventoryValue(g))}</span></div></div>
        <div class="list">${month.slice().reverse().map((w) => `<div class="li row"><span class="pill p-muted">${esc(E.absLabel(w.abs))}</span><span class="grow"><span class="t">${T(ING[w.type].label)}</span><span class="s">${w.qty} ${t('porsi', 'portions')}</span></span><span class="num">${fmt(w.value)}</span></div>`).join('') || `<div class="empty">${t('Belum ada makanan terbuang bulan ini.', 'Nothing wasted this month.')}</div>`}</div>
        <small class="muted">${t('Tips: belanja segar untuk 1–3 hari, masak yang paling cepat basi dulu, dan pakai bahan tahan lama (telur, sarden, mi, beras) untuk cadangan.', 'Tips: buy fresh food for 1–3 days, cook what spoils first, and keep long-life items (eggs, sardines, noodles, rice) as backup.')}</small>`;
    }
    return U.frame('dapur', body, { tabs: U.tabs('dapur', [['cook', bi('Masak', 'Cook')], ['stock', bi('Stok', 'Stock')], ['nutrition', bi('Gizi', 'Nutrition')], ['waste', bi('Terbuang', 'Waste')]], tab), scrollKey: tab });
  };

  // ── Aku (me) ────────────────────────────────────────────────────────
  function moodWhy(g) {
    const out = [];
    const overdue = E.billsThisMonth(g).filter((b) => b.status === 'overdue').length;
    const run = E.runwayDays(g);
    if (overdue) out.push(bi(`${overdue} tagihan lewat jatuh tempo menambah cemas soal uang.`, `${overdue} overdue bill(s) add to money worries.`));
    if (run < 7) out.push(bi(`Uangmu cukup untuk ±${Math.max(0, run)} hari kebutuhan pokok.`, `Your money covers about ${Math.max(0, run)} days of essentials.`));
    if (g.routineStreak >= 4) out.push(bi(`${g.routineStreak} hari tanpa waktu santai: rasa bosan naik.`, `${g.routineStreak} days without leisure: boredom builds.`));
    if ((g.daysSinceSocial || 0) >= 4) out.push(bi(`${g.daysSinceSocial} hari tanpa ngobrol dengan teman atau keluarga.`, `${g.daysSinceSocial} days without time with friends or family.`));
    if (g.sleep.debt > 4) out.push(bi('Kurang tidur beberapa malam membuat lelah dan sulit fokus.', 'Several short nights leave you tired and unfocused.'));
    if (E.cond(g).sick) out.push(bi('Badan sedang kurang fit.', 'You are unwell.'));
    if (g.employment.status === 'notice') out.push(bi('Masa pemberitahuan PHK membuat masa depan terasa tidak pasti.', 'The termination notice makes the future feel uncertain.'));
    if (g.employment.status === 'unemployed') out.push(bi('Belum ada penghasilan tetap.', 'No regular income right now.'));
    if (E.debtOutstanding(g)) out.push(bi('Utang yang berjalan ikut membebani pikiran.', 'Running debt weighs on your mind.'));
    if (g.mood.temptation > 60) out.push(bi('Stres dan bosan membuat keinginan belanja lebih kuat.', 'Stress and boredom make shopping urges stronger.'));
    return out;
  }
  U.apps.aku = () => {
    const g = G();
    const tab = U.sub('aku', 'tab', 'mood');
    const m = g.mood;
    let body = '';
    if (g.distress.active) body += `<div class="box support"><b>${ic('HandHeart')} ${t('Hari-hari ini terasa berat', 'These days feel heavy')}</b><small>${t('Lelah, sedih atau tidak bersemangat dalam waktu lama bisa dialami siapa saja yang tertekan keadaan. Ini bukan kegagalan dan bukan diagnosis. Hal kecil di bawah bisa sedikit meringankan; belanja bukan salah satunya.', 'Feeling tired, low or unmotivated for a long time can happen to anyone under pressure. It is not a failure and not a diagnosis. The small things below can ease it a little; shopping is not one of them.')}</small>
      <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sm" data-a="support" data-x="rest">${t('Istirahat', 'Rest')}</button><button class="btn sm" data-a="support" data-x="friend">${t('Hubungi teman', 'Reach out to a friend')}</button><button class="btn sm" data-a="support" data-x="family" ${E.isOnline(g) ? '' : 'disabled'}>${t('Video call keluarga', 'Video call family')}</button><button class="btn sm sec" data-a="open" data-x="care" data-cat="clinic">${t('Bicara dengan psikolog', 'Talk to a psychologist')}</button></div>
      <small class="muted">${t('Untukmu di dunia nyata: jika kamu sendiri sedang merasa berat, kamu bisa menghubungi layanan Kemenkes di healing119.id atau 119 ekstensi 8, atau bicara dengan orang yang kamu percaya.', 'For you in real life: if you are going through a hard time yourself, Indonesia\'s Ministry of Health offers counselling at healing119.id or 119 extension 8, or talk to someone you trust.')} ${srcLink('healing119')}</small></div>`;
    if (tab === 'mood') {
      body += `<div class="box outline">${E.MOOD_KEYS.map((k) => U.meter(L(E.MOOD_LABEL[k]), m[k], E.MOOD_BAD.has(k))).join('')}</div>`;
      const log = g.moodLog.slice(-14);
      if (log.length > 1) body += `<div class="section-t">${t('Kesejahteraan 14 hari', 'Wellbeing, 14 days')}</div><div class="spark" aria-label="${t('Grafik kesejahteraan', 'Wellbeing chart')}">${log.map((x) => `<i style="height:${Math.max(4, x.wellbeing)}%" title="${esc(E.absLabel(x.abs))}: ${x.wellbeing}"></i>`).join('')}</div>`;
      const why = moodWhy(g);
      body += `<div class="section-t">${t('Yang sedang memengaruhimu', 'What is affecting you')}</div><div class="box outline">${why.map((w) => `<small>• ${T(w)}</small>`).join('') || `<small>${t('Tidak ada yang menonjol hari ini.', 'Nothing stands out today.')}</small>`}</div>
        <small class="muted">${t('Nilai 0–100 bergerak perlahan menurut hari-harimu: kerja, uang, tidur, makan, kontak sosial dan waktu santai. Kegiatan gratis dan murah sama berguna dengan yang mahal; efeknya berkurang kalau diulang terus dalam seminggu.', 'Values (0–100) move gradually with your days: work, money, sleep, food, social contact and leisure. Free and cheap activities help as much as expensive ones; repeating the same thing all week has less effect.')}</small>
        <div class="row" style="gap:6px"><button class="btn sm sec" data-a="open" data-x="afterhours">${t('Cari kegiatan', 'Find something to do')}</button></div>`;
    } else if (tab === 'body') {
      const c = E.cond(g), h = g.health;
      const working = E.isScheduledToWork(g) && !g.day.leave;
      const relief = D.catalog.items.filter((i) => i.health && i.health.relief && i.health.relief.includes(h.condition));
      const today = E.today(g);
      const nextPeriod = g.config.character.menstruates ? h.cycleLen - ((today - h.cycleStart) % h.cycleLen) : null;
      body += `<div class="box"><div class="row">${ic(c.sick ? 'Thermometer' : 'HeartPulse')}<span class="grow"><span class="t">${T(c.label)}${E.severityText(g) ? ` (${T(E.severityText(g))})` : ''}</span><span class="s">${h.condition !== 'healthy' ? t(`±${h.daysLeft} hari lagi`, `about ${h.daysLeft} more day(s)`) : t('Tidak ada keluhan', 'No complaints')}${h.eased ? ' · ' + t('gejala sudah diredakan hari ini', 'symptoms eased today') : ''}</span></span></div>
        <div class="kv"><span>${t('Fokus kerja', 'Work focus')}</span><span>${Math.round(E.focusPenalty(g))}</span></div><div class="kv"><span>${t('Batas energi', 'Energy cap')}</span><span>${c.energyCap}</span></div><div class="kv"><span>${t('Memasak', 'Cooking')}</span><span>${T(COOKCAP[c.cook])}</span></div>
        <div class="row" style="gap:6px;flex-wrap:wrap">${E.hasJkn(g) ? `<button class="btn sm" data-a="clinic-jkn">${t('Periksa di faskes JKN', 'See your JKN clinic')}</button>` : ''}<button class="btn sm sec" data-a="open" data-x="care">${t('Apotek & klinik', 'Pharmacy & clinic')}</button>${working ? `<button class="btn sm sec" data-a="sick-leave">${t('Izin sakit hari ini', 'Call in sick today')}</button>` : ''}<button class="btn sm sec" data-a="act" data-x="relax" ${E.freeSlots(g) ? '' : 'disabled'}>${t('Istirahat', 'Rest')}</button></div>
        ${relief.length ? `<small class="muted">${t('Obat bebas yang bisa meredakan', 'Over-the-counter relief')}: ${relief.map((i) => T(i.name)).join(', ')}.</small>` : ''}
        ${working ? `<small class="muted">${g.day.sickNote ? t('Kamu punya surat dokter hari ini: izin sakit tetap dibayar (karyawan formal).', 'You have a doctor\'s note today: sick leave stays paid (formal employees).') : t('Tanpa surat dokter, izin sakit tidak dibayar.', 'Without a doctor\'s note, sick leave is unpaid.')}</small>` : ''}</div>
        <div class="box outline"><div class="kv"><span>${t('Tidur semalam', 'Last night\'s sleep')}</span><span>${g.sleep.hours} ${t('jam', 'h')}</span></div><div class="kv"><span>${t('Utang tidur', 'Sleep debt')}</span><span>${Math.round(g.sleep.debt * 10) / 10} ${t('jam', 'h')}</span></div>
          <div class="kv"><span>${t('Energi', 'Energy')}</span><span>${m.energy}/100</span></div>
          ${nextPeriod != null ? `<div class="kv"><span>${t('Perkiraan haid berikutnya', 'Next period (estimate)')}</span><span>${h.condition === 'menstrual' ? t('sedang berlangsung', 'now') : t(`±${nextPeriod} hari`, `about ${nextPeriod} days`)}</span></div><div class="kv"><span>${t('Pembalut', 'Pads')}</span><span>${Math.floor(g.supplies.pads)} ${t('hari', 'days')}</span></div>` : ''}
          <small class="muted">${t('Tidur terganggu oleh stres, nyamuk di musim hujan, panas tanpa kipas, bayi, atau sakit. Kopi sachet di pagi kerja sedikit menambah energi.', 'Sleep suffers from stress, mosquitoes in the rainy season, heat without a fan, a baby, or illness. A coffee sachet on work mornings gives a small lift.')}</small></div>
        <div class="section-t">${t('Riwayat', 'History')}</div><div class="list">${h.history.slice(0, 10).map((x) => `<div class="li row"><span class="pill p-muted">${esc(E.absLabel(x.abs))}</span><span class="grow">${T(E.CONDITIONS[x.key].label)}</span></div>`).join('') || `<div class="empty">${t('Belum ada.', 'Nothing yet.')}</div>`}</div>
        <small class="muted">${t('Game ini tidak memberi nasihat medis.', 'This game does not give medical advice.')}</small>`;
    } else if (tab === 'look') {
      const job = g.job, kind = job ? D.jobs.KINDS[job.kind] : null;
      const issues = job ? E.compliance(g) : [];
      body += `<div class="box outline">${Object.keys(E.APPEAR_LABEL).map((k) => `${U.meter(L(E.APPEAR_LABEL[k]), g.appearance[k])}<small class="muted" style="margin-top:-6px">${T(E.appearanceNote(g, k))}</small>`).join('')}</div>
        <div class="section-t">${t('Di tempat kerja', 'At work')}</div><div class="box">${job ? `<div class="kv"><span>${t('Jenis kerja', 'Kind of work')}</span><span>${T(kind.label)}</span></div>
          <div class="kv"><span>${t('Aturan berpakaian', 'Dress rules')}</span><span>${T({ office: bi('Rapi kantor', 'Office neat'), uniform: bi('Seragam & sepatu hitam', 'Uniform & black shoes'), ppe: bi('APD dari perusahaan', 'Protective gear provided') }[kind.dress])}</span></div>
          <b class="small">${t('Syarat objektif', 'Objective requirements')}</b>${issues.length ? issues.map((i) => `<div class="req no">${ic('X')}<span>${T(i)}</span></div>`).join('') : `<div class="req ok">${ic('Check')}<span>${t('Semua terpenuhi', 'All met')}</span></div>`}
          <small class="muted">${t('Yang dinilai hanya kebersihan dan aturan seragam/sepatu yang berlaku untuk pekerjaanmu. Produk mahal, riasan, atau perawatan premium tidak dibutuhkan untuk bekerja dengan baik. Percaya diri dan komentar atasan bersifat subjektif dan dicatat terpisah di aplikasi Kerja.', 'Only hygiene and the uniform/shoe rules of your job are checked. Expensive products, makeup or premium care are not needed to do well. Confidence and supervisor comments are subjective and tracked separately in Workday.')}</small>` : `<small>${t('Saat wawancara, pakaian yang bersih dan layak (tidak harus baru) sedikit membantu.', 'At interviews, clean and decent clothes (not necessarily new) help a little.')}</small>`}
          <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sm sec" data-a="open" data-x="dailymart" data-cat="hygiene">${t('Kebersihan diri', 'Hygiene')}</button><button class="btn sm sec" data-a="open" data-x="shopsquare" data-cat="workwear">${t('Pakaian kerja', 'Workwear')}</button><button class="btn sm sec" data-a="open" data-x="glow" data-cat="hair">${t('Potong rambut', 'Haircut')}</button></div></div>`;
    } else if (tab === 'family') {
      const hh = g.config.household, mem = E.members(g);
      body += `<div class="box"><div class="kv"><span>${t('Anggota rumah tangga', 'Household members')}</span><span>${mem.people}</span></div><div class="kv"><span>${t('Porsi per makan', 'Portions per meal')}</span><span>${E.servings(g)}</span></div>
        ${hh.partner ? `<div class="kv"><span>${t('Pasangan', 'Partner')}</span><span>${hh.partnerWorks ? t('bekerja', 'working') : t('tidak bekerja', 'not working')}</span></div>` : ''}
        ${hh.children.map((k, i) => `<div class="kv"><span>${t('Anak', 'Child')} ${i + 1}</span><span>${k.age} ${t('tahun', 'years')}</span></div>`).join('')}</div>`;
      if (hh.partner) {
        body += `<div class="box outline"><div class="toggle"><span>${t('Pasangan bekerja', 'Partner has an income')}</span>${U.sw('hh-t', 'partnerWorks', hh.partnerWorks)}</div>
          ${hh.partnerWorks ? `<div class="field"><label for="hhpinc">${t('Penghasilan pasangan (Rp/bulan)', 'Partner\'s income (Rp/month)')}</label><input id="hhpinc" class="inp num" inputmode="numeric" value="${Math.round(hh.partnerIncome / 100)}" data-in="hhpinc"></div>
          <div class="toggle"><span>${t('Penghasilan digabung', 'Incomes pooled')}</span>${U.sw('hh-t', 'sharedIncome', hh.sharedIncome)}</div>
          ${hh.sharedIncome ? '' : `<div class="field"><label for="hhpcon">${t('Kontribusi pasangan (Rp/bulan)', 'Partner\'s contribution (Rp/month)')}</label><input id="hhpcon" class="inp num" inputmode="numeric" value="${Math.round(hh.partnerContribution / 100)}" data-in="hhpcon"></div>`}` : `<small class="muted">${t('Pasangan di rumah bisa membantu memasak saat kamu sakit atau lelah.', 'A partner at home can help cook when you are ill or tired.')}</small>`}
          <small class="muted">${t('Masuk pada tanggal 1 bulan depan.', 'Paid in on the 1st of next month.')}</small></div>`;
      }
      if (hh.children.some((k) => k.age < 6)) body += `<div class="field"><span class="lab">${t('Pengasuhan anak kecil', 'Care for young children')}</span>${U.seg('hh-set', 'childcare', hh.childcare, [['family', bi('Dibantu keluarga', 'Family helps')], ['daycare', bi('Tempat penitipan', 'Daycare')]])}<small class="muted">${t('Berlaku tagihan bulan depan.', 'Applies from next month\'s bills.')}</small></div>`;
      body += `<div class="field"><label for="hhpar">${t('Kirim uang ke orang tua', 'Money for your parents')}: <b>${fmt(hh.supportParents)}</b>${t('/bln', '/mo')}</label><input id="hhpar" type="range" min="0" max="1500000" step="50000" value="${hh.supportParents / 100}" data-in="hhpar"><small class="muted">${t('Berlaku tagihan bulan depan.', 'Applies from next month\'s bills.')}</small></div>
        <small class="muted">${pill('ILLUSTRATIVE')} ${t('Biaya sekolah (di luar SPP), penitipan, dan kebutuhan bayi di game ini ilustratif. JKN keluarga: iuran mandiri dihitung per orang; JKN lewat kerja menanggung keluarga inti.', 'School costs (beyond tuition), childcare and baby needs are illustrative. Family JKN: independent contributions are per person; JKN through work covers the core family.')} ${srcLink('jkn_family')}</small>`;
    } else {
      const ch = g.config.character, J = D.jobs;
      body += `<div class="box"><div class="kv"><span>${t('Usia', 'Age')}</span><span>${ch.age}</span></div><div class="kv"><span>${t('Pendidikan', 'Education')}</span><span>${T(J.eduById[ch.education].label)}</span></div>
        <div class="kv"><span>${t('Pengalaman', 'Experience')}</span><span>${ch.experienceYears} ${t('tahun', 'years')}</span></div><div class="kv"><span>${t('Bahasa Inggris', 'English')}</span><span>${T(J.engById[ch.english].label)}</span></div>
        <div class="kv"><span>${t('Bahasa lain', 'Other language')}</span><span>${T((J.OTHER_LANG.find((o) => o.id === ch.otherLang) || J.OTHER_LANG[0]).label)}</span></div><div class="kv"><span>${t('Literasi digital', 'Digital literacy')}</span><span>${T(J.digById[ch.digital].label)}</span></div>
        <div class="field"><span class="lab">${t('Keahlian', 'Skills')}</span><div class="chips">${ch.skills.map((s) => `<span class="pill p-muted">${T(J.skillLabel[s])}</span>`).join('') || '—'}</div></div>
        <div class="field"><span class="lab">${t('Sertifikat', 'Certificates')}</span><div class="chips">${ch.certs.map((s) => `<span class="pill p-muted">${T(J.certLabel[s])}</span>`).join('') || '—'}</div></div>
        <button class="btn sm sec" data-a="open" data-x="appy" data-tab="improve">${t('Tingkatkan kemampuan', 'Improve your skills')}</button></div>`;
    }
    return U.frame('aku', body, { tabs: U.tabs('aku', [['mood', bi('Perasaan', 'Mood')], ['body', bi('Badan', 'Body')], ['look', bi('Penampilan', 'Appearance')], ['family', bi('Keluarga', 'Family')], ['profile', bi('Profil', 'Profile')]], tab), scrollKey: tab });
  };

  // ── AfterHours ──────────────────────────────────────────────────────
  const FX_LABEL = { boredom: bi('bosan', 'boredom'), stress: bi('stres', 'stress'), happiness: bi('bahagia', 'happiness'), social: bi('sosial', 'social'), loneliness: bi('kesepian', 'loneliness'), energy: bi('energi', 'energy'), confidence: bi('percaya diri', 'confidence') };
  U.fxText = (fx) => Object.entries(fx || {}).filter(([, v]) => v).map(([k, v]) => `${L(FX_LABEL[k] || E.MOOD_LABEL[k] || E.APPEAR_LABEL[k] || k)} ${v > 0 ? '↑' : '↓'}`).join(', ');
  U.apps.afterhours = () => {
    const g = G();
    const tab = U.sub('afterhours', 'tab', 'free');
    const [wIcon, wLabel] = U.WEATHER[g.day.weather] || U.WEATHER.clear;
    const left = g.wallet - E.unpaidBillsTotal(g);
    let body = `<div class="box"><div class="kv"><span>${t('Waktu luang hari ini', 'Free time today')}</span><span><b>${E.freeSlots(g)}</b>/${g.day.slots}</span></div>
      <div class="kv"><span>${t('Cuaca', 'Weather')}</span><span>${ic(wIcon)} ${T(wLabel)}</span></div><div class="kv"><span>${t('Teman', 'Friends')}</span><span>${g.day.friendFree ? t('ada yang bisa diajak', 'someone is free') : t('sedang sibuk', 'busy today')}</span></div>
      <div class="kv"><span>${t('Uang setelah tagihan', 'Money after bills')}</span><span class="num" style="color:${left < 0 ? 'var(--coral)' : 'inherit'}">${fmt(left)}</span></div>
      <small class="muted">${t('Hari kerja: 1 waktu luang. Hari libur: 3. Kegiatan gratis sama sahnya dengan yang berbayar.', 'Workdays: 1 free slot. Days off: 3. Free activities count just as much as paid ones.')}</small></div>`;
    const list = D.world.ACTIVITIES.filter((a) => a.cat === tab).map((a) => ({ a, st: E.activityStatus(g, a) })).filter((x) => !x.st.hidden);
    body += `<div class="list">${list.map(({ a, st }) => {
      const recent = g.activityLog.filter((x) => x.id === a.id && E.today(g) - x.abs < 7).length;
      return `<div class="li"><div class="row"><span class="grow"><span class="t">${T(a.name)}</span><span class="s">${esc(U.fxText(a.effects))}${a.slots > 1 ? ` · ${a.slots} ${t('waktu luang', 'slots')}` : ''}${a.temptation ? ' · ' + t('bisa memancing keinginan belanja', 'may trigger shopping urges') : ''}${recent ? ` · ${t('efek berkurang (sudah', 'weaker effect (done')} ${recent}× ${t('minggu ini)', 'this week)')}` : ''}</span>
        ${st.available ? '' : `<span class="s" style="color:var(--coral)">${(st.reasons || []).map(T).join(' · ')}</span>`}</span>
        <span style="text-align:right"><b class="num">${st.cost ? fmt(st.cost) : t('Gratis', 'Free')}</b>${st.travel ? `<br><span class="small muted">${t('termasuk ongkos', 'incl. travel')} ${fmt(st.travel)}</span>` : ''}</span></div>
        <div class="row" style="gap:6px;margin-top:6px"><button class="btn sm" data-a="act" data-x="${a.id}" ${st.available ? '' : 'disabled'}>${t('Lakukan', 'Do it')}</button><button class="btn sm ghost" data-a="act-later" data-x="${a.id}">${t('Tunda', 'Postpone')}</button></div></div>`;
    }).join('') || `<div class="empty">${t('Tidak ada pilihan di sini untuk kotamu.', 'Nothing in this group for your city.')}</div>`}</div>
      <small class="muted">${pill('ILLUSTRATIVE')} ${t('Harga tiket dan efek suasana hati adalah nilai game. Ketersediaan mengikuti jenis kota (taman, alun-alun, mal, bioskop, pantai).', 'Ticket prices and mood effects are gameplay values. Availability follows the city type (parks, town squares, malls, cinemas, beaches).')}</small>`;
    return U.frame('afterhours', body, { tabs: U.tabs('afterhours', [['free', bi('Gratis', 'Free')], ['low', bi('Murah', 'Low cost')], ['paid', bi('Berbayar', 'Paid')]], tab), scrollKey: tab });
  };

  // ── Connect ─────────────────────────────────────────────────────────
  U.apps.connect = () => {
    const g = G(), h = E.curHousing(g);
    const dataLeft = E.hasMobileData(g) ? E.dayNumber(g.dataPlanUntil) - E.dayNumber(g.date) : 0;
    let body = `<div class="box"><div class="row">${ic('Signal')}<span class="grow"><span class="t">${t('Paket data', 'Mobile data')}</span><span class="s">${dataLeft > 0 ? t(`Aktif, ${dataLeft} hari lagi`, `Active, ${dataLeft} day(s) left`) : E.hasMobileData(g) ? t('Hari terakhir', 'Last day today') : t('Tidak ada paket aktif', 'No active package')}</span></span></div>
      <div class="row">${ic('Wifi')}<span class="grow"><span class="t">${t('Wi-Fi di rumah', 'Wi-Fi at home')}</span><span class="s">${h.includes.internet ? t('Termasuk sewa', 'Included in rent') : g.homeInternet ? t('Internet rumah', 'Home fibre') : t('Tidak ada', 'None')}</span></span></div>
      <div class="field"><div class="kv"><span>${t('Kondisi ponsel', 'Phone condition')}</span><span>${Math.round(g.owned.phoneCondition)}/100</span></div>${U.bar(g.owned.phoneCondition, g.owned.phoneCondition < 30 ? 'bad' : '')}</div>
      ${g.owned.phoneCondition <= 0 ? `<small style="color:var(--coral)">${t('Ponselmu rusak atau hilang: tidak bisa online sampai diperbaiki atau diganti.', 'Your phone is broken or gone: no internet until it is repaired or replaced.')}</small>` : ''}
      <small class="muted">${t('Ojol, pesan antar, belanja online, Appy dan pendaftaran online butuh koneksi. Nama operator tidak dimuat; harga', 'Ride-hailing, delivery, online shopping, Appy and online applications need a connection. Operators are not named; prices are')} ${pill('ILLUSTRATIVE')}.</small></div>
      <div class="section-t">${t('Paket data', 'Data packages')}</div><div class="list">${D.connect.dataPlans.map((p) => `<div class="li row"><span class="grow"><span class="t">${T(p.name)}</span><span class="s">${p.days} ${t('hari', 'days')}</span></span><b class="num">${fmt(p.price)}</b><button class="btn sm" data-a="data" data-x="${p.id}">${t('Beli', 'Buy')}</button></div>`).join('')}</div>`;
    if (!h.includes.internet) body += `<div class="section-t">${t('Internet rumah (tagihan bulanan)', 'Home internet (monthly bill)')}</div><div class="list">${D.connect.homeInternet.map((p) => `<div class="li row"><span class="grow"><span class="t">${T(p.name)}</span><span class="s">${g.homeInternet === p.id ? t('Berlangganan', 'Subscribed') : t('Ditagih tiap bulan', 'Billed monthly')}</span></span><b class="num">${fmt(p.price)}</b>${g.homeInternet === p.id ? `<button class="btn sm sec" data-a="net" data-x="">${t('Berhenti', 'Cancel')}</button>` : `<button class="btn sm" data-a="net" data-x="${p.id}">${t('Langganan', 'Subscribe')}</button>`}</div>`).join('')}</div>`;
    body += `<div class="section-t">${t('Servis ponsel', 'Phone repairs')}</div><div class="list">${D.connect.devices.map((p) => `<div class="li row"><span class="grow"><span class="t">${T(p.name)}</span><span class="s">${t('Kondisi naik ke 85', 'Condition back to 85')}</span></span><b class="num">${fmt(p.price)}</b><button class="btn sm sec" data-a="repair" data-x="${p.id}">${t('Servis', 'Repair')}</button></div>`).join('')}</div>
      <div class="row"><button class="btn sm sec" data-a="open" data-x="shopsquare" data-cat="electronics">${t('Lihat ponsel baru di ShopSquare', 'See new phones in ShopSquare')}</button></div>
      <small class="muted">${t('Tidak ada yang wajib membeli ponsel baru.', 'Nobody is required to buy a new phone.')}</small>`;
    return U.frame('connect', body);
  };

  // ── Calendar ────────────────────────────────────────────────────────
  U.apps.calendar = () => {
    const g = G();
    const y = g.date.year, mo = g.date.month, dim = E.daysInMonth(y, mo);
    const first = E.weekday(y, mo, 1);
    const bills = E.billsThisMonth(g);
    const startAbs = E.dayNumber({ year: y, month: mo, day: 1 });
    let cells = I.WEEKDAYS[I.lang].map((d) => `<span class="h">${esc(d.slice(0, 2))}</span>`).join('');
    for (let i = 0; i < first; i++) cells += '<span></span>';
    for (let d = 1; d <= dim; d++) {
      const abs = startAbs + d - 1;
      const dots = [];
      if (d === 1 && E.isEmployed(g)) dots.push('dot-pay');
      bills.filter((b) => b.dueDay === d).forEach((b) => dots.push(b.status === 'paid' ? 'dot-paid' : 'dot-bill'));
      g.subscriptions.filter((s) => s.active && s.renewDay === d).forEach(() => dots.push('dot-sub'));
      g.schedule.filter((s) => s.abs === abs).forEach(() => dots.push('dot-event'));
      const onTrip = g.trips.some((tr) => ['booked', 'active'].includes(tr.status) && abs >= tr.startAbs && abs <= tr.endAbs);
      const work = E.isWorkdayDate(g.config.workweek, { year: y, month: mo, day: d });
      cells += `<span class="c ${d < g.date.day ? 'past' : ''} ${d === g.date.day ? 'today' : ''} ${onTrip ? 'trip' : ''} ${work ? '' : 'off'}" aria-label="${t('Tanggal', 'Day')} ${d}">${d}<span class="dots">${dots.slice(0, 3).map((c) => `<i class="${c}"></i>`).join('')}</span></span>`;
    }
    const today = E.today(g);
    const up = [];
    for (const b of bills) if (b.status !== 'paid') up.push([startAbs + b.dueDay - 1, T(b.label), fmt(b.amount), b.status === 'overdue']);
    for (const s of g.subscriptions.filter((x) => x.active)) { const dd = D.subscriptions.find((z) => z.id === s.id); up.push([startAbs + s.renewDay - 1, T(dd.name) + ' · ' + t('perpanjang', 'renews'), fmt(dd.price), false]); }
    for (const s of g.schedule) up.push([s.abs, T(s.label), '', false]);
    for (const [id, it] of Object.entries(g.docs.items)) if (it.status === 'processing') up.push([it.readyAbs, `${T(D.travel.docById[id].name)} · ${t('perkiraan selesai', 'expected ready')}`, '', false]);
    if (g.job && g.job.endAbs && g.job.endAbs - today < 60) up.push([g.job.endAbs, t('Kontrak kerja berakhir', 'Employment contract ends'), '', false]);
    if (g.employment.status === 'notice') up.push([g.employment.lastDayAbs, t('Hari kerja terakhir', 'Last working day'), '', true]);
    up.sort((a, b) => a[0] - b[0]);
    const body = `<div class="row"><b style="font-family:var(--f-display);font-size:24px;font-stretch:85%;flex:1">${esc(I.month(mo))} ${y}</b><span class="small muted">${t('Hari', 'Day')} ${g.date.day}/${dim}</span></div>
      <div class="cal">${cells}</div>
      <div class="row small muted" style="gap:12px;flex-wrap:wrap">${[['dot-pay', bi('Gajian', 'Payday')], ['dot-bill', bi('Tagihan', 'Bill due')], ['dot-paid', bi('Lunas', 'Paid')], ['dot-sub', bi('Langganan', 'Renewal')], ['dot-event', bi('Jadwal', 'Appointment')]].map(([c, l]) => `<span><i class="${c} lg"></i> ${T(l)}</span>`).join('')}</div>
      <button class="btn block" data-a="end-day" ${g.phase !== 'play' ? 'disabled' : ''}>${ic('Moon')} ${t('Akhiri hari', 'End day')} ${g.date.day}</button>
      <div class="section-t">${t('Akan datang', 'Coming up')}</div><div class="list">${up.filter((x) => x[0] >= today - 31).map(([abs, l, a, od]) => `<div class="li row"><span class="pill ${od ? 'p-warn' : 'p-muted'}">${od ? t('Lewat tempo', 'Overdue') : esc(E.absLabel(abs))}</span><span class="grow">${l}</span><span class="num">${a}</span></div>`).join('') || `<div class="empty">${t('Tidak ada jadwal.', 'Nothing scheduled.')}</div>`}</div>
      <div class="section-t">${t('Yang terjadi', 'What happened')}</div><div class="list">${g.eventsLog.filter((e) => e.month === g.monthIndex).map((e) => `<div class="li row"><span class="pill p-muted">${t('Hari', 'Day')} ${e.day}</span><span class="grow"><span class="t">${T(e.title)}</span><span class="s">${T(e.choice)}</span></span><span class="num">${e.cost ? fmt(-e.cost, { plus: e.cost < 0 }) : '—'}</span></div>`).join('') || `<div class="empty">${t('Belum ada kejadian bulan ini.', 'No events yet this month.')}</div>`}</div>`;
    return U.frame('calendar', body);
  };

  // ── actions ─────────────────────────────────────────────────────────
  const digits = (v) => Number(String(v).replace(/\D/g, '')) || 0;
  Object.assign(U.A, {
    'move-home'(el) { const r = E.planMove(G(), el.dataset.x); if (U.result(r)) U.toast(G().pendingMove ? t('Pindah direncanakan bulan depan.', 'Move planned for next month.') : t('Rencana pindah dibatalkan.', 'Move cancelled.')); U.save(); },
    token(el) { const p = U.prev(); const r = E.buyToken(G(), Number(el.dataset.x)); U.result(r, r.ok ? `+${r.kwh.toFixed(1)} kWh` : ''); U.after(p); },
    elec(el) { E.updateConfig(G(), { electricity: { [el.dataset.k]: el.dataset.x } }); U.save(); },
    'elec-t'(el) { const k = el.dataset.x; E.updateConfig(G(), { electricity: { [k]: !G().config.electricity[k] } }); U.save(); },
    cfg(el) { let v = el.dataset.x; if (el.dataset.k === 'workweek') v = Number(v); E.updateConfig(G(), { [el.dataset.k]: v }); U.save(); },
    commute(el) { E.setCommute(G(), { commutePlanId: el.dataset.x }); U.toast(t('Cara berangkat kerja diubah. Ditagih tiap hari kerja.', 'Commute updated. Charged each workday.')); U.save(); },
    'moto-credit'() { E.setCommute(G(), { motorcycleCredit: !G().config.motorcycleCredit }); U.save(); },
    'ride-pref'(el) { E.setCommute(G(), { ride: { provider: el.dataset.x, tier: el.dataset.k } }); U.save(); },
    'ride-opt'(el) { U.setSub('move', { [el.dataset.x]: !U.sub('move', el.dataset.x, true) }); },
    ride(el) {
      const p = U.prev();
      const res = E.bookRide(G(), el.dataset.x, U.sub('move', 'km', 5), { verify: U.sub('move', 'verify', true), share: U.sub('move', 'share', true) });
      if (U.result(res, res.cancelled ? t('Kamu membatalkan perjalanan.', 'You cancelled the ride.') : t(`Perjalanan selesai: ${fmt(res.price || 0)}`, `Ride done: ${fmt(res.price || 0)}`))) U.setSub('move', { last: { log: res.log || [], price: res.price || 0, wait: res.wait || 0, cancelled: !!res.cancelled } });
      if (G().activeEvent) ui.eventOpen = true;
      U.after(p);
    },
    'unverified-ignore'() { G().unverifiedUntil = null; U.toast(t('Tawaran ditolak.', 'Offer turned down.')); U.save(); },
    'dapur-slot'(el) { U.setSub('dapur', { slot: el.dataset.x }); },
    cook(el) { const slot = currentSlot(); if (!slot) return; const p = U.prev(); U.result(E.cook(G(), el.dataset.x, slot), t('Dimasak dan dimakan.', 'Cooked and eaten.')); U.after(p); },
    'meal-ready'() { const slot = currentSlot(); if (!slot) return; if (E.eatReady(G(), slot)) U.toast(t('Makanan jadi dimakan.', 'Ready food eaten.')); else U.toast(t('Makanan jadi tidak cukup.', 'Not enough ready food.'), true); U.save(); },
    'meal-get'(el) { const slot = currentSlot(); if (!slot) return; const p = U.prev(); U.result(E.getMeal(G(), slot, el.dataset.x), el.dataset.x === 'skip' ? t('Dilewati.', 'Skipped.') : t('Sudah makan.', 'Meal sorted.')); U.after(p); },
    act(el) { const p = U.prev(); const res = E.doActivity(G(), el.dataset.x); U.result(res, res.factor != null && res.factor < 0.8 ? t('Selesai. Efeknya lebih kecil karena sering dilakukan minggu ini.', 'Done. Smaller effect because you have done it often this week.') : t('Selesai. Terasa sedikit lebih baik.', 'Done. That helped a bit.')); U.after(p); },
    'act-later'() { E.postponeActivity(G()); U.toast(t('Ditunda. Mungkin lain kali.', 'Postponed. Maybe another time.')); U.save(); },
    support(el) {
      const g = G(), k = el.dataset.x;
      if (k === 'family' && !E.isOnline(g)) { U.result({ ok: false, error: 'offline' }); return; }
      if (!E.useSlots(g, 1)) { U.result({ ok: false, error: 'no_time' }); return; }
      E.supportAction(g, k);
      U.toast({ rest: t('Kamu beristirahat sebentar.', 'You rested for a while.'), friend: t('Kamu bercerita ke teman. Rasanya sedikit lebih ringan.', 'You talked to a friend. It feels a little lighter.'), family: t('Kamu bicara dengan keluarga.', 'You talked with your family.') }[k]);
      U.save();
    },
    'clinic-jkn'() { const p = U.prev(); U.result(E.clinicVisit(G(), 'jkn'), t('Sudah diperiksa di faskes JKN. Kamu dapat surat dokter bila perlu.', 'Seen at your JKN clinic. You have a doctor\'s note if needed.')); U.after(p); },
    'sick-leave'() { const p = U.prev(); const r = E.takeLeave(G(), 'sick', { note: !!G().day.sickNote }); U.result(r, r.paid ? t('Izin sakit (dibayar).', 'Sick leave (paid).') : t('Izin sakit tanpa upah.', 'Unpaid sick leave.')); U.after(p); },
    'hh-t'(el) { const hh = G().config.household; hh[el.dataset.x] = !hh[el.dataset.x]; U.save(); },
    'hh-set'(el) { G().config.household[el.dataset.k] = el.dataset.x; U.save(); },
    data(el) { const p = U.prev(); U.result(E.buyDataPlan(G(), el.dataset.x), t('Paket data aktif.', 'Data package active.')); U.after(p); },
    net(el) { E.setHomeInternet(G(), el.dataset.x || null); U.toast(el.dataset.x ? t('Berlangganan. Tagihan pertama ditambahkan.', 'Subscribed. First bill added.') : t('Dihentikan mulai bulan depan.', 'Cancelled from next month.')); U.save(); },
    repair(el) { const p = U.prev(); U.result(E.repairPhone(G(), el.dataset.x), t('Ponsel diservis.', 'Phone repaired.')); U.after(p); },
  });
  function currentSlot() { const g = G(); const open = E.SLOTS.filter((s) => !g.food.meals[s]); const s = U.sub('dapur', 'slot', open[0]); return open.includes(s) ? s : open[0] || null; }
  Object.assign(U.IN, {
    fam(el) { E.updateConfig(G(), { familyContribution: M.rp(Number(el.value)) }); U.save(); },
    water(el) { E.updateConfig(G(), { waterBill: M.rp(Number(el.value)) }); U.save(); },
    dist(el) { const v = Number(el.value); E.updateConfig(G(), { distanceKm: v }); if (G().job && G().job.arrangement !== 'remote') G().job.distanceKm = v; U.save(); },
    busfare(el) { const v = digits(el.value); E.updateConfig(G(), { customBusFare: v ? M.rp(v) : null }); U.save(); },
    ridekm(el) { U.setSub('move', { km: Number(el.value) }); },
    hhpinc(el) { G().config.household.partnerIncome = M.rp(digits(el.value)); U.save(); },
    hhpcon(el) { G().config.household.partnerContribution = M.rp(digits(el.value)); U.save(); },
    hhpar(el) { G().config.household.supportParents = M.rp(Number(el.value)); U.save(); },
  });
  ['busfare', 'hhpinc', 'hhpcon'].forEach((k) => U.LIVE.add(k));
})(typeof globalThis !== 'undefined' ? globalThis : this);
