/*
 * ui/apps-info.js — Jelajah (travel), Berkas (documents & passport), Compare, Sources, Settings.
 */
(function (root) {
  const RLS = root.RLS;
  const E = RLS.engine, M = RLS.money, D = RLS.data, I = RLS.i18n, U = RLS.U;
  const { esc, T, t, L, ic, pill, fmt, short, srcLink, pct } = U;
  const ui = U.ui;
  const bi = I.bi;
  const G = () => U.G;
  const TR = D.travel;

  // ── Jelajah ─────────────────────────────────────────────────────────
  const TRIP_ST = { booked: [bi('Dipesan', 'Booked'), 'p-due'], active: [bi('Sedang berlangsung', 'Under way'), 'p-ok'], done: [bi('Selesai', 'Done'), 'p-muted'], cancelled: [bi('Batal', 'Cancelled'), 'p-warn'] };
  U.apps.jelajah = () => {
    const g = G();
    const tab = U.sub('jelajah', 'tab', 'plan');
    const today = E.today(g);
    let body = '';
    if (tab === 'plan') {
      const scope = U.sub('jelajah', 'scope', 'domestic');
      const list = scope === 'domestic' ? TR.DOMESTIC : TR.INTERNATIONAL;
      let destId = U.sub('jelajah', 'dest', null);
      if (!list.some((d) => d.id === destId)) destId = null;
      body += `${U.seg('trip-scope', 'scope', scope, [['domestic', bi('Dalam negeri', 'Domestic')], ['international', bi('Luar negeri', 'International')]])}
        <div class="chips">${list.map((d) => `<button class="chip ${destId === d.id ? 'on' : ''}" data-a="trip-dest" data-x="${d.id}">${T(d.name)}</button>`).join('')}</div>`;
      if (!destId) body += `<div class="empty">${t('Pilih tujuan untuk melihat rincian biaya, syarat dokumen dan rencana perjalanan.', 'Pick a destination to see the cost breakdown, document requirements and itinerary.')}</div>`;
      else {
        const d = TR.destById[destId];
        const style = U.sub('jelajah', 'style', 'standard');
        const nights = Math.max(d.minNights, Number(U.sub('jelajah', 'nights', d.minNights)));
        const offset = Number(U.sub('jelajah', 'offset', 14));
        const atts = U.sub('jelajah', 'atts', []);
        const insurance = U.sub('jelajah', 'ins', false);
        const extra = M.rp(Number(U.sub('jelajah', 'extra', 0)));
        const unpaidOk = U.sub('jelajah', 'unpaidOk', false);
        const startAbs = today + offset;
        const opts = { style, attractions: atts, insurance, extra, unpaidOk };
        const chk = E.tripRequirements(g, destId, startAbs, nights, opts);
        const q = chk.quote;
        const entry = d.intl ? TR.ENTRY[d.entry] : null;
        body += `<div class="field"><span class="lab">${t('Gaya perjalanan', 'Travel style')}</span>${U.seg('trip-style', 'style', style, TR.STYLES)}</div>
          <div class="field"><label for="tnights">${t('Lama', 'Length')}: <b>${nights} ${t('malam', 'nights')}</b> (${t('min.', 'min.')} ${d.minNights})</label><input id="tnights" type="range" min="${d.minNights}" max="14" value="${nights}" data-in="tnights"></div>
          <div class="field"><label for="toff">${t('Berangkat', 'Departure')}: <b>${esc(E.absLabel(startAbs, true))}</b> (${t('dalam', 'in')} ${offset} ${t('hari', 'days')})</label><input id="toff" type="range" min="1" max="90" value="${offset}" data-in="toff"></div>
          <div class="field"><span class="lab">${t('Rencana kegiatan', 'Itinerary')}</span><div class="chips">${d.attractions.map(([id, name, cost]) => `<button class="chip ${atts.includes(id) ? 'on' : ''}" data-a="trip-att" data-x="${id}">${T(name)} · ${cost ? short(M.rp(cost)) : t('gratis', 'free')}</button>`).join('')}</div></div>
          <div class="toggle"><span>${t('Asuransi perjalanan', 'Travel insurance')}</span>${U.sw('trip-ins', 'ins', insurance)}</div>
          <div class="field"><label for="textra">${t('Belanja & oleh-oleh (Rp)', 'Shopping & souvenirs (Rp)')}</label><input id="textra" class="inp num" inputmode="numeric" value="${U.sub('jelajah', 'extra', 0)}" data-in="textra"></div>
          <div class="section-t">${t('Rincian biaya', 'Cost breakdown')} ${pill('ILLUSTRATIVE')}</div>
          <div class="receipt">${q.lines.map((l) => `<div class="kv"><span>${T(l.label)}</span><span>${fmt(l.amount)}</span></div>`).join('')}<hr><div class="kv tot"><span>${t('Total', 'Total')}</span><span>${fmt(q.total)}</span></div>
            <div class="kv"><span>${t('Saldo / tabungan', 'Balance / savings')}</span><span>${fmt(g.wallet)} / ${fmt(g.savings)}</span></div><div class="kv"><span>${t('Pelancong', 'Travellers')}</span><span>${E.members(g).people}</span></div>
            <div class="kv"><span>${t('Pulang', 'Return')}</span><span>${esc(E.absLabel(chk.endAbs, true))}</span></div></div>
          <small class="muted">${t('Ongkos transport, penginapan, makan dan tiket adalah perkiraan game, bukan harga yang diamati. Transport darat hanya bila tujuan satu pulau denganmu.', 'Fares, stays, food and tickets are game estimates, not observed prices. Overland travel only when the destination is on your island.')}</small>
          ${entry ? `<div class="box"><b>${t('Masuk negara tujuan', 'Entry rules')}</b><small>${T(entry.label)}</small><small class="muted">${pill(entry.status)} ${srcLink(entry.sourceId)} · ${t('paspor harus berlaku', 'passport valid for')} ${entry.passportMonths} ${t('bulan setelah tanggal pulang (aturan game mengikuti praktik umum).', 'months after you return (game rule following common practice).')}</small></div>` : ''}
          <div class="section-t">${t('Syarat', 'Requirements')}</div>${U.reqList(chk.reqs)}
          ${chk.ok ? '' : `<small class="muted">${t('Perjalanan tidak bisa dipesan sampai semua syarat wajib terpenuhi.', 'You can\'t book until every required item is met.')}</small>`}`;
        return U.frame('jelajah', body, { tabs: U.tabs('jelajah', [['plan', bi('Rencana', 'Plan')], ['trips', bi('Perjalananku', 'My trips')]], tab), scrollKey: 'plan' + destId,
          foot: `<div class="setup-foot"><button class="btn" data-a="trip-book" ${chk.ok ? '' : 'disabled'}>${t('Pesan', 'Book')} ${fmt(q.total)}</button></div>` });
      }
    } else {
      body += g.trips.map((tr) => {
        const d = TR.destById[tr.destId];
        const [lab, cls] = TRIP_ST[tr.status];
        const entry = d.intl ? TR.ENTRY[d.entry] : null;
        const needArrival = tr.status === 'booked' && entry && entry.arrival && !tr.arrivalDone;
        return `<div class="box outline"><div class="row"><span class="grow"><span class="t">${T(d.name)}</span><span class="s">${esc(E.absLabel(tr.startAbs))} – ${esc(E.absLabel(tr.endAbs))} · ${tr.nights} ${t('malam', 'nights')} · ${fmt(tr.total)}</span></span><span class="pill ${cls}">${T(lab)}</span></div>
          ${needArrival ? `<div class="row"><span class="grow small">${T(TR.docById[entry.arrival].name)}: ${tr.startAbs - today <= 3 ? t('sudah bisa diisi', 'can be filled in now') : t(`bisa diisi mulai ${E.absLabel(tr.startAbs - 3)}`, `opens ${E.absLabel(tr.startAbs - 3)}`)}</span><button class="btn sm" data-a="arrival" data-x="${tr.id}" ${tr.startAbs - today <= 3 ? '' : 'disabled'}>${t('Isi (gratis)', 'Fill in (free)')}</button></div>` : ''}
          ${tr.status === 'booked' && d.intl ? `<small class="muted">${t('Paspor/visa dicek lagi saat berangkat. Jika belum siap, tiket hangus dan hanya sebagian biaya penginapan kembali.', 'Passport and visa are checked again on departure. If they are not ready, tickets are lost and only part of the stay is refunded.')}</small>` : ''}</div>`;
      }).join('') || `<div class="empty">${t('Belum ada perjalanan.', 'No trips yet.')}</div>`;
    }
    return U.frame('jelajah', body, { tabs: U.tabs('jelajah', [['plan', bi('Rencana', 'Plan')], ['trips', bi('Perjalananku', 'My trips')]], tab), scrollKey: tab });
  };

  // ── Berkas ──────────────────────────────────────────────────────────
  function docState(g, id) {
    const st = E.docStatus(g, id);
    const d = TR.docById[id];
    const m = {
      held: [bi('Dimiliki', 'Held'), 'p-ok'], ready: [st.expiresAbs ? bi(`Siap · s/d ${E.absLabel(st.expiresAbs)}`, `Ready · until ${E.absLabel(st.expiresAbs)}`) : bi('Siap', 'Ready'), 'p-ok'],
      processing: [bi(`Diproses · siap ±${st.readyAbs ? E.absLabel(st.readyAbs) : ''}`, `Processing · ready ~${st.readyAbs ? E.absLabel(st.readyAbs) : ''}`), 'p-due'], expired: [bi('Kedaluwarsa', 'Expired'), 'p-warn'],
      failed: [bi('Tidak lulus tes', 'Failed the test'), 'p-warn'], rejected: [bi('Ditolak', 'Refused'), 'p-warn'], none: [d && d.auto ? bi('Diberikan saat kerja berakhir', 'Issued when a job ends') : d && d.built ? bi(`Dibangun di Appy (${st.progress || 0}/25)`, `Built in Appy (${st.progress || 0}/25)`) : bi('Belum ada', 'Not yet'), 'p-muted'], na: [bi('Tidak berlaku untukmu', 'Not applicable to you'), 'p-muted'],
    };
    return m[st.status] || [bi(st.status, st.status), 'p-muted'];
  }
  const applicable = (d) => !(d.held || d.auto || d.built || d.special || d.arrival || d.heldIfEdu != null);
  U.sheets.doc = (sh) => {
    const g = G();
    if (sh.id === 'passport') { ui.sheet = null; U.openApp('berkas', { tab: 'passport' }); return ''; }
    const d = TR.docById[sh.id];
    if (!d) return '';
    const st = E.docStatus(g, d.id);
    const [lab, cls] = docState(g, d.id);
    const pre = E.docPrereqs(g, d.id);
    const cost = E.docCost(g, d.id);
    const working = E.isScheduledToWork(g) && !g.day.leave;
    const canApply = applicable(d) && st.status !== 'processing';
    return `<h3>${T(d.name)}</h3><div class="chips"><span class="pill ${cls}">${T(lab)}</span>${pill(d.status)}${d.visa ? `<span class="pill p-muted">${t('Visa', 'Visa')}</span>` : ''}</div>
      ${d.purpose ? `<p class="evbody">${T(d.purpose)}</p>` : ''}
      <div class="receipt"><div class="kv"><span>${t('Biaya', 'Fee')}</span><span>${cost ? fmt(cost) : t('Gratis', 'Free')}</span></div>${(d.extra || []).map(([l, v]) => `<div class="small muted">${T(l)}${v ? ': ' + fmt(M.rp(v)) : ''}</div>`).join('')}
        ${typeof d.fee === 'object' ? `<div class="small muted">${d.fee.cur} ${d.fee.amount} × Rp${TR.FX[d.fee.cur].toLocaleString('id-ID')} (${t('kurs ilustratif', 'illustrative rate')})</div>` : ''}
        <div class="kv"><span>${t('Proses', 'Processing')}</span><span>${d.days[1] ? `${d.days[0]}–${d.days[1]} ${d.wd ? t('hari kerja', 'working days') : t('hari', 'days')}` : t('langsung', 'same day')}</span></div>
        <div class="kv"><span>${t('Cara', 'How')}</span><span>${d.inPerson ? t('datang langsung (1 waktu luang; izin bila hari kerja)', 'in person (1 free slot; time off on a workday)') : t('online', 'online')}</span></div>
        <div class="kv"><span>${t('Berlaku', 'Valid for')}</span><span>${d.valid ? `${d.valid} ${t('hari', 'days')}` : t('tidak kedaluwarsa', 'no expiry')}</span></div>${st.score ? `<div class="kv"><span>${t('Skor', 'Score')}</span><span>${st.score}</span></div>` : ''}</div>
      ${pre.length ? `<div class="section-t">${t('Perlu lebih dulu', 'Needs first')}</div>${U.reqList(pre.map((p) => ({ ok: p.valid, label: p.label, fix: TR.docById[p.id] ? 'doc' : null, doc: p.id })))}` : ''}
      ${d.visa ? `<small class="muted">${t('Hasil visa di game mengandung ketidakpastian (minta dokumen tambahan, atau ditolak bila bukti keuangan lemah menurut aturan game). Ini bukan statistik resmi. Biaya tidak dikembalikan bila ditolak.', 'Visa outcomes in the game carry uncertainty (requests for more documents, or refusal when financial evidence is weak under the game rule). This is not an official statistic. Fees are not refunded on refusal.')}</small>` : ''}
      ${d.test ? `<small class="muted">${t('Ada ujian praktik; peluang lulus lebih baik bila sudah bisa mengendarai motor.', 'There is a practical test; you are more likely to pass if you can already ride.')}</small>` : ''}
      ${d.source || d.sourceId ? `<small class="muted">${srcLink(d.sourceId)}</small>` : ''}
      ${canApply && d.inPerson && working ? `<div class="box"><small>${t('Hari ini kamu dijadwalkan kerja. Kantor layanan buka di jam kerja.', 'You are due at work today. Offices open during working hours.')}</small><button class="btn sm sec" data-a="leave" data-x="${g.employment.leaveBalance > 0 ? 'annual' : 'unpaid'}">${g.employment.leaveBalance > 0 ? t('Ambil cuti hari ini', 'Take leave today') : t('Izin tanpa upah hari ini', 'Unpaid day off today')}</button></div>` : ''}
      ${canApply ? `<button class="btn" data-a="doc-apply" data-x="${d.id}">${st.valid ? t('Urus ulang', 'Renew') : t('Urus sekarang', 'Apply now')}${cost ? ' · ' + fmt(cost) : ''}</button>` : ''}`;
  };
  U.apps.berkas = () => {
    const g = G();
    const tab = U.sub('berkas', 'tab', 'docs');
    let body = '';
    if (tab === 'docs') {
      const row = (d) => { const [lab, cls] = docState(g, d.id); return `<button class="li row" data-a="doc" data-x="${d.id}"><span class="grow"><span class="t">${T(d.name)}</span><span class="s">${d.purpose ? T(d.purpose) : ''}</span></span><span class="pill ${cls}">${T(lab)}</span></button>`; };
      const docs = TR.DOCS.filter((d) => !d.special && !d.arrival);
      body += `<div class="section-t">${t('Identitas & lamaran kerja', 'ID & job applications')}</div><div class="list">${docs.filter((d) => !d.visa && !['javes', 'insurance', 'bank_statement', 'translation'].includes(d.id)).map(row).join('')}</div>
        <div class="section-t">${t('Perjalanan & visa', 'Travel & visas')}</div><div class="list">${docs.filter((d) => d.visa || ['javes', 'insurance', 'bank_statement', 'translation'].includes(d.id)).map(row).join('')}</div>
        <small class="muted">${t('Kartu kedatangan (SG Arrival Card, MDAC, TDAC) diisi gratis di Jelajah 3 hari sebelum tiba.', 'Arrival cards (SG Arrival Card, MDAC, TDAC) are free and filled in from Jelajah within 3 days of arrival.')}</small>`;
    } else if (tab === 'passport') {
      const p = g.docs.passport, today = E.today(g);
      const express = U.sub('berkas', 'express', false);
      let cur;
      if (!p) cur = t('Kamu belum punya paspor.', 'You don\'t have a passport.');
      else if (p.status === 'appointment') cur = t(`Jadwal wawancara & foto di kantor imigrasi: ${E.absLabel(p.appointmentAbs, true)}.`, `Interview & photo at the immigration office: ${E.absLabel(p.appointmentAbs, true)}.`);
      else if (p.status === 'processing') cur = t(`Sedang dicetak, siap ±${E.absLabel(p.readyAbs, true)}.`, `Being printed, ready ~${E.absLabel(p.readyAbs, true)}.`);
      else cur = p.expiresAbs >= today ? t(`${p.electronic ? 'E-paspor' : 'Paspor biasa'} berlaku sampai ${E.absLabel(p.expiresAbs, true)}${p.expiresAbs - today < 183 ? ' — kurang dari 6 bulan, banyak negara menolak' : ''}.`, `${p.electronic ? 'E-passport' : 'Ordinary passport'} valid until ${E.absLabel(p.expiresAbs, true)}${p.expiresAbs - today < 183 ? ' — under 6 months, many countries refuse entry' : ''}.`) : t('Paspormu sudah kedaluwarsa.', 'Your passport has expired.');
      const busy = p && ['appointment', 'processing'].includes(p.status);
      body += `<div class="box"><b>${ic('BookOpen')} ${t('Paspor', 'Passport')}</b><small>${esc(cur)}</small></div>
        <div class="box outline"><b class="small">${t('Langkahnya', 'How it works')}</b><small>1. ${t('Daftar & bayar PNBP online (butuh internet).', 'Book and pay the official fee online (needs internet).')}</small><small>2. ${t('Datang ke kantor imigrasi di tanggal jadwal untuk wawancara & foto (izin kerja bila hari kerja).', 'Visit the immigration office on the appointment date for an interview & photo (time off on a workday).')}</small><small>3. ${t('Paspor jadi ±4 hari kerja; layanan percepatan selesai di hari yang sama.', 'Ready in about 4 working days; the express service finishes the same day.')}</small><small>${t('Butuh KTP & KK. Perpanjangan memakai langkah yang sama.', 'Needs your ID and family card. Renewal follows the same steps.')}</small></div>
        <div class="list">${E.passportOptions(g).map((o) => `<div class="li row"><span class="grow"><span class="t">${T(o.name)}</span><span class="s">${o.years} ${t('tahun', 'years')}${o.electronic ? ' · ' + t('bisa bebas visa Jepang lewat JAVES', 'qualifies for Japan\'s JAVES visa waiver') : ''}${o.reason ? ' · ' + T(o.reason) : ''}</span></span><b class="num">${fmt(M.rp(o.fee))}</b><button class="btn sm" data-a="passport" data-x="${o.id}" ${o.available && !busy ? '' : 'disabled'}>${p && p.status === 'ready' ? t('Perpanjang', 'Renew') : t('Daftar', 'Apply')}</button></div>`).join('')}</div>
        <div class="toggle"><span>${t('Layanan percepatan (selesai hari itu)', 'Express service (same day)')} · +${fmt(M.rp(TR.PASSPORT_EXPRESS))}</span>${U.sw('pp-express', 'express', express)}</div>
        <small class="muted">${pill('VERIFIED')} ${t('Tarif PNBP', 'Official fees')}: ${srcLink('passport_fee_2024')} · ${srcLink('passport_10y')}</small>`;
    } else {
      const miss = E.missingDocs(g);
      const keys = Object.keys(miss);
      body += `<small class="muted">${t('Dokumen yang dibutuhkan lamaran aktif, lowongan yang kamu simpan, perjalanan yang dipesan, dan klaim JHT.', 'Documents needed by your active applications, saved listings, booked trips and a JHT claim.')}</small>
        <div class="list">${keys.map((id) => `<div class="li row"><span class="grow"><span class="t">${id === 'passport' ? t('Paspor (berlaku)', 'Passport (valid)') : T(TR.docById[id].name)}</span><span class="s">${t('Untuk', 'For')}: ${[...new Set(miss[id].map(L))].join(', ')}</span></span><button class="btn sm" data-a="doc" data-x="${id}">${t('Urus', 'Sort it')}</button></div>`).join('') || `<div class="empty">${ic('Check')} ${t('Tidak ada dokumen yang kurang saat ini.', 'Nothing missing right now.')}</div>`}</div>`;
    }
    return U.frame('berkas', body, { tabs: U.tabs('berkas', [['docs', bi('Dokumen', 'Documents')], ['passport', bi('Paspor', 'Passport')], ['missing', bi(`Yang kurang (${Object.keys(E.missingDocs(g)).length})`, `Missing (${Object.keys(E.missingDocs(g)).length})`)]], tab), scrollKey: tab });
  };

  // ── Compare ─────────────────────────────────────────────────────────
  function cityOptions(sel) {
    return D.indonesia.provinces.map((p) => `<optgroup label="${esc(p.name)}">${E.citiesForProvince(p.id).map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}${c.wage ? '' : ' (UMP)'}</option>`).join('')}</optgroup>`).join('');
  }
  U.apps.compare = () => {
    const g = G();
    const cp = ui.compare;
    const base = { scenario: g.config.scenario, wageTreatment: 'net', distanceKm: g.config.distanceKm, workweek: g.config.workweek, basket: cp.basket, familyContribution: g.config.familyContribution };
    const A = E.estimateMonthlyBudget({ ...base, cityId: cp.a, housingId: cp.housing });
    const B = E.estimateMonthlyBudget({ ...base, cityId: cp.b, housingId: cp.housing });
    const name = (x) => E.getLocality(x.cfg.cityId).city.name;
    let body = `<div class="box"><div class="field"><label for="cmpa">${t('Tempat A', 'Place A')}</label><select id="cmpa" class="inp" data-in="cmpa">${cityOptions(cp.a)}</select></div>
      <div class="field"><label for="cmpb">${t('Tempat B', 'Place B')}</label><select id="cmpb" class="inp" data-in="cmpb">${cityOptions(cp.b)}</select></div>
      <div class="field"><span class="lab">${t('Rumah yang sama di kedua tempat', 'Same home in both places')}</span>${U.seg('cmp', 'housing', cp.housing, [['kost_typical', bi('Kost sendiri', 'Kost alone')], ['shared_typical', bi('Kamar berbagi', 'Shared room')], ['family', bi('Bersama keluarga', 'With family')]])}</div>
      <div class="field"><span class="lab">${t('Belanja dapur', 'Grocery basket')}</span>${U.seg('cmp', 'basket', cp.basket, [['lean', bi('Hemat', 'Lean')], ['everyday', bi('Biasa', 'Everyday')]])}</div>
      ${U.seg('cmp', 'view', cp.view, [['A', bi('Harga lokal', 'Local prices')], ['B', bi('Hidup sebulan', 'Monthly life')]])}</div>`;
    const row = (l, a, b, cls = '') => `<tr class="${cls}"><td>${l}</td><td>${a}</td><td>${b}</td></tr>`;
    const head = `<thead><tr><th></th><th>${esc(name(A))}</th><th>${esc(name(B))}</th></tr></thead>`;
    if (cp.view === 'A') {
      const item = (id) => D.catalog.byId[id];
      body += `<div class="cmp-wrap"><table class="cmp">${head}<tbody>
        ${row(t('Upah minimum', 'Wage floor'), `${fmt(A.wage.amount)}<br><span class="small">${A.wage.wageType}</span>`, `${fmt(B.wage.amount)}<br><span class="small">${B.wage.wageType}</span>`)}
        ${row(t('Gaji bersih', 'Take-home'), fmt(A.pay.net), fmt(B.pay.net))}
        ${row(t('Kost biasa', 'Typical kost'), fmt(E.getHousing(cp.a, 'kost_typical').monthlyRent), fmt(E.getHousing(cp.b, 'kost_typical').monthlyRent))}
        ${row(t('Tingkat sewa', 'Rent tier'), E.getLocality(cp.a).city.tier, E.getLocality(cp.b).city.tier)}
        ${row(t('Beras medium 1 kg', 'Medium rice, 1 kg'), fmt(E.priceOf(item('rice_medium_1'), g.config)), fmt(E.priceOf(item('rice_medium_1'), g.config)))}
        ${row(t('Telur 1 kg', 'Eggs, 1 kg'), fmt(E.priceOf(item('eggs_1kg'), g.config)), fmt(E.priceOf(item('eggs_1kg'), g.config)))}
        ${row(t('Berangkat kerja termurah', 'Cheapest commute'), A.plan ? T(A.plan.label) : '—', B.plan ? T(B.plan.label) : '—')}
        ${row(t('Kost sebagai % gaji bersih', 'Kost as % of take-home'), pct(E.getHousing(cp.a, 'kost_typical').monthlyRent / A.pay.net), pct(E.getHousing(cp.b, 'kost_typical').monthlyRent / B.pay.net), 'tot')}
        </tbody></table></div><small class="muted">${t('Harga makanan adalah rata-rata nasional dan sama di kedua kolom: game belum punya harga per kota.', 'Food prices are national averages and identical in both columns: the game has no city-level food prices yet.')}</small>`;
    } else {
      const col = (x) => `<span style="color:${x.remaining < 0 ? 'var(--coral)' : 'var(--green)'}">${fmt(x.remaining)}</span>`;
      body += `<div class="cmp-wrap"><table class="cmp">${head}<tbody>
        ${row(t('Gaji bersih', 'Take-home pay'), fmt(A.income), fmt(B.income), 'tot')}
        ${row(t('Tempat tinggal', 'Housing'), fmt(A.rent), fmt(B.rent))}
        ${row(t('Listrik', 'Electricity'), A.elec ? fmt(A.elec) : t('termasuk', 'incl.'), B.elec ? fmt(B.elec) : t('termasuk', 'incl.'))}
        ${row(t('Air', 'Water'), A.water ? fmt(A.water) : t('termasuk', 'incl.'), B.water ? fmt(B.water) : t('termasuk', 'incl.'))}
        ${row(t('Berangkat kerja', 'Commute'), `${fmt(A.transport)}<br><span class="small">${A.plan ? T(A.plan.label) : ''}</span>`, `${fmt(B.transport)}<br><span class="small">${B.plan ? T(B.plan.label) : ''}</span>`)}
        ${row(t('Belanja dapur', 'Groceries'), fmt(A.groceries), fmt(B.groceries))}
        ${row(t('Paket data', 'Mobile data'), fmt(A.phone), fmt(B.phone))}
        ${row(t('Kebutuhan pokok', 'Essentials total'), fmt(A.essentials), fmt(B.essentials), 'tot')}
        ${row(t('Sisa untuk tabungan & pilihan', 'Left for savings & choice'), col(A), col(B), 'tot')}
        ${row(t('Kebutuhan pokok % gaji', 'Essentials as % of pay'), pct(A.essentials / A.income), pct(B.essentials / B.income))}
        </tbody></table></div>
        <small class="muted">${t(`Bulan terencana tanpa kejutan, dengan rumah tangga 1 orang, belanja, jarak (${g.config.distanceKm} km) dan cara berangkat termurah yang sama. Tidak ada tempat yang "lebih baik" secara umum: subsidi, dukungan keluarga, jenis pekerjaan dan akses transportasi mengubah hasilnya.`, `A planned month with no surprises, for one person, with the same basket, distance (${g.config.distanceKm} km) and cheapest practical commute in both places. No place is "better" overall: subsidies, family support, job type and transport access change the result.`)}</small>`;
    }
    body += `<div class="box"><b>${t('Negara lain', 'Other countries')}</b><small class="muted">${t('Korea Selatan, Jepang, Australia, Selandia Baru, Inggris, AS, Singapura, Malaysia, Thailand, Filipina dan Jerman ada di katalog dengan sistem upahnya, tapi data upah dan harganya belum dimuat, jadi belum bisa dibandingkan.', 'South Korea, Japan, Australia, New Zealand, the UK, the US, Singapore, Malaysia, Thailand, the Philippines and Germany are in the catalogue with their wage systems described, but their wage and price data are not loaded yet, so they can\'t be compared.')}</small></div>`;
    return U.frame('compare', body);
  };

  // ── Sources ─────────────────────────────────────────────────────────
  U.apps.sources = () => {
    const g = G();
    const tab = U.sub('sources', 'tab', 'inuse');
    let body = '';
    if (tab === 'inuse') {
      const w = E.resolveWage(g.config.cityId);
      const pay = E.calculateNetIncome(g.job ? g.job.wage : w.amount, g.config.scenario);
      const h = E.curHousing(g);
      const plan = E.currentCommutePlan(g);
      const rows = [
        [T(w.label), fmt(w.amount, { exact: true }), w.verificationStatus, w.sourceId],
        ...pay.items.map((i) => [T(i.label), fmt(i.amount), i.status, i.sourceId]),
        [t('Tempat tinggal', 'Housing') + ': ' + T(h.label), h.type === 'family' ? fmt(g.config.familyContribution) : fmt(h.monthlyRent), h.status, h.sourceId],
        [t('Tarif listrik', 'Electricity tariff'), 'Rp' + E.TARIFFS[g.config.electricity.tariff].major.replace('.', ',') + '/kWh', 'VERIFIED', 'pln_2026'],
        [t('Pemakaian peralatan', 'Appliance use'), E.estimateElectricity(E.electricityProfile(g)).kwh + ' kWh/' + t('bln', 'mo'), 'ESTIMATED', 'game_assumption'],
        ...(plan ? plan.legs.map((l) => [t('Berangkat kerja', 'Commute') + ': ' + T(l.label), l.cost == null ? '—' : fmt(l.cost), l.status, l.sourceId || 'game_assumption']) : []),
        [t('Batas biaya pinjol (OJK)', 'P2P lending cost cap (OJK)'), '0,1%/' + t('hari', 'day'), 'ESTIMATED', 'ojk_p2p'],
        [t('Kebutuhan gizi', 'Nutrition reference'), `${E.reference(g).kcal} kkal, ${E.reference(g).protein} g protein`, 'ESTIMATED', 'akg_2019'],
        [t('Tarif paspor', 'Passport fees'), 'Rp350.000–950.000', 'VERIFIED', 'passport_fee_2024'],
        [t('SKCK', 'Police clearance (SKCK)'), 'Rp30.000', 'VERIFIED', 'skck_2026'],
        [t('Merek, perusahaan, aplikasi & pemberi pinjaman', 'Brands, companies, apps & lenders'), t('fiktif', 'fictional'), 'ILLUSTRATIVE', 'fictional_brands'],
      ];
      body += `<small class="muted">${t('Angka yang dipakai permainanmu sekarang, beserta asalnya.', 'The numbers your current game is using, with where each comes from.')}</small><div class="list">${rows.map(([l, v, st, s]) => `<div class="li"><div class="row"><span class="grow"><span class="t">${l}</span><span class="s">${srcLink(s)}</span></span><span style="text-align:right"><b class="num">${v}</b><br>${pill(st)}</span></div></div>`).join('')}</div>`;
    } else if (tab === 'registry') {
      body += `<div class="list">${D.sources.map((s) => `<div class="li"><div class="t" style="font-weight:700">${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : esc(s.title)}</div>
        <div class="small muted">${esc(s.publisher)} · ${esc(s.type)} · ${t('terbit', 'published')} ${esc(s.published)} · ${t('dicek', 'checked')} ${esc(s.accessed)}</div><div class="small">${esc(s.note)}</div></div>`).join('')}</div>`;
    } else {
      const counts = {};
      D.catalog.items.forEach((i) => { counts[i.status] = (counts[i.status] || 0) + 1; });
      const umk = D.indonesia.cities.filter((c) => c.wage).length;
      const feat = [
        [bi('Upah, potongan, gaji bulanan & harian', 'Wages, deductions, monthly & daily pay'), 'VERIFIED'], [bi('Tagihan, bayar otomatis, tunggakan', 'Bills, autopay, arrears'), 'ESTIMATED'],
        [bi('Stok makanan, umur simpan, kulkas, sampah', 'Food stock, shelf life, fridge, waste'), 'ESTIMATED'], [bi('Gizi beberapa hari (perkiraan)', 'Multi-day nutrition (estimate)'), 'ESTIMATED'],
        [bi('Suasana hati (12 variabel), tidur, kondisi badan', 'Mood (12 variables), sleep, physical condition'), 'ILLUSTRATIVE'], [bi('Keinginan belanja (tidak pernah otomatis)', 'Purchase urges (never automatic)'), 'ILLUSTRATIVE'],
        [bi('Toko: tingkat, merek fiktif, diskon, stok, ongkir, pesanan, refund', 'Stores: tiers, fictional brands, deals, stock, delivery, orders, refunds'), 'ILLUSTRATIVE'],
        [bi('Ojol: penyedia fiktif, tingkat layanan, keselamatan', 'Ride-hailing: fictional providers, tiers, safety'), 'ILLUSTRATIVE'], [bi('Penampilan & syarat kerja objektif', 'Appearance & objective work rules'), 'ILLUSTRATIVE'],
        [bi('Kegiatan gratis, murah, berbayar', 'Free, low-cost and paid activities'), 'ILLUSTRATIVE'], [bi('Perjalanan, paspor, visa, dokumen', 'Travel, passport, visas, documents'), 'ESTIMATED'],
        [bi('PHK, pesangon, JHT, JKP', 'Layoffs, severance, JHT, JKP'), 'ESTIMATED'], [bi('Appy: lowongan fiktif, seleksi, wawancara, tawaran', 'Appy: fictional listings, selection, interviews, offers'), 'ILLUSTRATIVE'],
        [bi('Keluarga: pasangan, hingga 2 anak', 'Family: partner, up to 2 children'), 'ILLUSTRATIVE'], [bi('Pinjaman: berizin, mahal, ilegal', 'Loans: licensed, high-cost, illegal'), 'ESTIMATED'],
      ];
      body += `<div class="box"><b>${t('Yang dimuat', 'What\'s loaded')}</b>
        <div class="kv"><span>${t('Provinsi dengan UMP 2026', 'Provinces with 2026 UMP')}</span><span>38 / 38</span></div>
        <div class="kv"><span>${t('Kota/kabupaten dengan UMK 2026', 'Cities/regencies with 2026 UMK')}</span><span>${umk} / 514</span></div>
        <div class="kv"><span>${t('Lokasi lain (pakai UMP)', 'Other localities (UMP fallback)')}</span><span>${D.indonesia.cities.length - umk}</span></div>
        <div class="kv"><span>${t('Produk terverifikasi / perkiraan / ilustratif', 'Products verified / estimated / illustrative')}</span><span>${counts.VERIFIED || 0} / ${counts.ESTIMATED || 0} / ${counts.ILLUSTRATIVE || 0}</span></div>
        <div class="kv"><span>${t('Negara yang bisa dimainkan', 'Countries playable')}</span><span>1 / 12</span></div></div>
        <div class="section-t">${t('Fitur & jenis datanya', 'Features & their data')}</div><div class="list">${feat.map(([l, s]) => `<div class="li row"><span class="grow small">${T(l)}</span>${pill(s)}</div>`).join('')}</div>
        <div class="box outline"><b>${t('Label', 'Labels')}</b>
        <div class="row">${pill('VERIFIED')}<span class="small">${t('Didukung sumber yang dikutip. Rata-rata nasional tetap rata-rata nasional.', 'Backed by a cited source. National averages are still national.')}</span></div>
        <div class="row">${pill('ESTIMATED')}<span class="small">${t('Diturunkan dari metode yang dijelaskan atau diacu ke sumber.', 'Derived from a documented method or anchored to a source.')}</span></div>
        <div class="row">${pill('ILLUSTRATIVE')}<span class="small">${t('Nilai permainan yang masuk akal, bukan klaim dunia nyata.', 'A plausible gameplay value, not a real-world claim.')}</span></div>
        <div class="row">${pill('UNAVAILABLE')}<span class="small">${t('Tidak ada nilai yang bisa diandalkan; game bertanya atau tidak memakainya.', 'No reliable value; the game asks you or leaves it out.')}</span></div></div>
        <div class="box"><b>${t('Kekurangan yang diketahui', 'Known gaps')}</b><small class="muted">${t('Sebagian besar UMK di luar Jawa belum dimuat. Angka upah dari laporan media atas keputusan gubernur, bukan PDF keputusannya. Harga makanan nasional, bukan per kota. Sewa di luar Jabodetabek perkiraan. Tarif bus kota, biaya platform ojol, harga barang kemasan, paket ponsel, ongkos perjalanan dan biaya anak tidak diamati. Peluang lolos lamaran, kejadian di perjalanan dan hasil visa adalah parameter game. Data adalah potret statis, bukan data langsung.', 'Most UMK values outside Java are not loaded. Wage figures come from press reports of governor decrees, not the decree PDFs. Food prices are national, not city-level. Rents outside Jabodetabek are estimates. City bus fares, ride-hailing platform fees, packaged goods, phone plans, trip costs and child costs are not observed. Hiring odds, ride incidents and visa outcomes are game parameters. Data is a static snapshot, not live.')}</small></div>`;
    }
    return U.frame('sources', body, { tabs: U.tabs('sources', [['inuse', bi('Di game ini', 'In this game')], ['registry', bi('Semua sumber', 'All sources')], ['coverage', bi('Cakupan', 'Coverage')]], tab), scrollKey: tab });
  };

  // ── Settings ────────────────────────────────────────────────────────
  U.apps.settings = () => {
    const g = G(), c = g.config;
    const confirm = U.sub('settings', 'confirm', null);
    const body = `<div class="box"><div class="field"><span class="lab">${t('Bahasa', 'Language')}</span>${U.seg('lang-set', 'lang', I.lang, [['id', 'Bahasa Indonesia'], ['en', 'English']])}<small class="muted">${t('Mengganti bahasa tidak mengubah progres.', 'Switching language keeps all progress.')}</small></div>
      <div class="field"><span class="lab">${t('Gaji yang masuk dompet', 'Salary paid into your wallet')}</span>${U.seg('cfg', 'wageTreatment', c.wageTreatment, [['net', bi('Bersih', 'Net take-home')], ['gross', bi('Bruto', 'Gross wage')]])}<small class="muted">${t('Berlaku mulai gajian berikutnya.', 'Applies from the next payday.')}</small></div>
      <div class="field"><span class="lab">${t('Kejutan', 'Surprise events')}</span>${U.seg('cfg', 'difficulty', c.difficulty, [['calm', bi('Tenang', 'Calm')], ['normal', bi('Normal', 'Normal')], ['chaotic', bi('Kacau', 'Chaotic')]])}</div>
      <div class="field"><label for="padj">${t('Penyesuaian harga lokal', 'Local price adjustment')}: <b>${c.priceAdjustBp >= 0 ? '+' : ''}${c.priceAdjustBp / 100}%</b></label><input id="padj" type="range" min="-20" max="60" step="5" value="${c.priceAdjustBp / 100}" data-in="padj">
        <small class="muted">${t('Menggeser harga toko dari rata-rata nasional ke harga yang kamu lihat. Harga terverifikasi yang disesuaikan berubah label menjadi Perkiraan.', 'Shifts store prices from national averages to what you see locally. Adjusted verified prices are relabelled Estimated.')}</small></div>
      <div class="field"><label for="ppj">${t('Pajak penerangan jalan (PPJ)', 'Street-lighting tax (PPJ)')}: <b>${c.ppjBp / 100}%</b></label><input id="ppj" type="range" min="0" max="10" step="0.5" value="${c.ppjBp / 100}" data-in="ppj"></div></div>
      <div class="section-t">${t('Permainan', 'Game')}</div><div class="box outline">
      <div class="kv"><span>Seed</span><span class="num">${g.seed}</span></div><div class="kv"><span>${t('Versi data simpanan', 'Save version')}</span><span>v${g.version}${g.migratedFrom ? ` (${t('dari', 'from')} v${g.migratedFrom})` : ''}</span></div>
      ${confirm ? `<div class="box" style="background:var(--coral-soft)"><b>${confirm === 'replay' ? t('Ulang bulan ini dari hari 1 dengan seed yang sama?', 'Restart from day 1 with the same seed?') : confirm === 'new' ? t('Buat skenario baru?', 'Set up a new scenario?') : t('Hapus permainan tersimpan?', 'Erase your saved game?')}</b><small>${t('Progres sekarang akan hilang.', 'Your current progress will be lost.')}</small>
        <div class="row" style="gap:8px"><button class="btn sec sm" data-a="confirm" data-x="">${t('Lanjut main', 'Keep playing')}</button><button class="btn warn sm" data-a="do" data-x="${confirm}">${confirm === 'replay' ? t('Ulang', 'Replay') : confirm === 'new' ? t('Skenario baru', 'New scenario') : t('Hapus', 'Erase')}</button></div></div>`
        : `<button class="btn sec" data-a="confirm" data-x="replay">${t('Ulang dari hari 1 dengan seed yang sama', 'Replay from day 1 with the same seed')}</button><button class="btn sec" data-a="confirm" data-x="new">${t('Skenario baru (ubah tempat, karakter, rumah)', 'New scenario (change place, character, home)')}</button><button class="btn ghost" data-a="confirm" data-x="reset" style="color:var(--coral)">${t('Hapus permainan tersimpan', 'Erase saved game')}</button>`}
      </div><small class="muted">${t('Progres disimpan di browser ini saja.', 'Progress saves in this browser only.')}</small>`;
    return U.frame('settings', body);
  };

  // ── actions ─────────────────────────────────────────────────────────
  const digits = (v) => Number(String(v).replace(/\D/g, '')) || 0;
  Object.assign(U.A, {
    'trip-scope'(el) { U.setSub('jelajah', { scope: el.dataset.x, dest: null }); },
    'trip-dest'(el) { const d = TR.destById[el.dataset.x]; U.setSub('jelajah', { dest: el.dataset.x, nights: d.minNights, atts: [] }); },
    'trip-style'(el) { U.setSub('jelajah', { style: el.dataset.x }); },
    'trip-att'(el) { const a = [...U.sub('jelajah', 'atts', [])]; const i = a.indexOf(el.dataset.x); if (i >= 0) a.splice(i, 1); else a.push(el.dataset.x); U.setSub('jelajah', { atts: a }); },
    'trip-ins'() { U.setSub('jelajah', { ins: !U.sub('jelajah', 'ins', false) }); },
    'trip-book'() {
      const g = G(), s = ui.sub.jelajah || {};
      const d = TR.destById[s.dest];
      const nights = Math.max(d.minNights, Number(s.nights || d.minNights));
      const p = U.prev();
      const res = E.bookTrip(g, s.dest, s.style || 'standard', E.today(g) + Number(s.offset || 14), nights, { attractions: s.atts || [], insurance: !!s.ins, extra: M.rp(Number(s.extra || 0)), unpaidOk: !!s.unpaidOk });
      if (U.result(res, t(`Perjalanan ke ${d.name.id} dipesan.`, `Trip to ${d.name.en} booked.`))) U.setSub('jelajah', { tab: 'trips', dest: null });
      U.after(p);
    },
    arrival(el) { U.result(E.fillArrivalCard(G(), el.dataset.x), t('Kartu kedatangan sudah diisi.', 'Arrival card done.')); U.save(); },
    doc(el) { if (el.dataset.x === 'passport') U.setSub('berkas', { tab: 'passport' }); else ui.sheet = { type: 'doc', id: el.dataset.x }; },
    'doc-apply'(el) {
      const p = U.prev();
      const res = E.applyDoc(G(), el.dataset.x);
      const d = TR.docById[el.dataset.x];
      if (U.result(res, res.failed ? t('Belum lulus tes. Bisa dicoba lagi.', 'You did not pass the test. You can try again.') : res.status === 'ready' ? t(`${d.name.id} selesai.`, `${d.name.en} done.`) : t(`Diajukan. Perkiraan selesai ${E.absLabel(res.readyAbs || 0)}.`, `Submitted. Expected ${E.absLabel(res.readyAbs || 0)}.`))) ui.sheet = null;
      U.after(p);
    },
    passport(el) { const p = U.prev(); const r = E.applyPassport(G(), el.dataset.x, U.sub('berkas', 'express', false)); U.result(r, t(`Dibayar. Jadwal ke kantor imigrasi: ${E.absLabel(r.appointmentAbs || 0, true)}.`, `Paid. Immigration office appointment: ${E.absLabel(r.appointmentAbs || 0, true)}.`)); U.after(p); },
    'pp-express'() { U.setSub('berkas', { express: !U.sub('berkas', 'express', false) }); },
    cmp(el) { ui.compare[el.dataset.k] = el.dataset.x; },
    confirm(el) { U.setSub('settings', { confirm: el.dataset.x || null }); },
    do(el) {
      const what = el.dataset.x;
      ui.sub.settings = {};
      if (what === 'replay') { const g = G(); U.G = E.createGame(JSON.parse(JSON.stringify(g.config)), g.seed); ui.app = null; ui.carts = {}; ui.sub = {}; U.after(0); U.toast(t('Diulang dari hari 1.', 'Replaying from day 1.')); }
      else if (what === 'new') { ui.draft = E.defaultConfig(JSON.parse(JSON.stringify(G().config))); ui.draft.commutePlanId = null; ui.screen = 'setup'; ui.step = 2; ui.seed = ''; }
      else { U.clearSave(); U.G = null; ui.screen = 'setup'; ui.step = 0; ui.draft = E.defaultConfig(); ui.app = null; }
    },
  });
  Object.assign(U.IN, {
    tnights(el) { U.setSub('jelajah', { nights: Number(el.value) }); },
    toff(el) { U.setSub('jelajah', { offset: Number(el.value) }); },
    textra(el) { U.setSub('jelajah', { extra: digits(el.value) }); },
    cmpa(el) { ui.compare.a = el.value; },
    cmpb(el) { ui.compare.b = el.value; },
    padj(el) { E.updateConfig(G(), { priceAdjustBp: Number(el.value) * 100 }); U.save(); },
    ppj(el) { E.updateConfig(G(), { ppjBp: Math.round(Number(el.value) * 100) }); U.save(); },
  });
  U.LIVE.add('textra');
})(typeof globalThis !== 'undefined' ? globalThis : this);
