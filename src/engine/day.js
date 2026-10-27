/*
 * engine/day.js — events, the morning and evening of each day, the monthly
 * report and rollover, and the comparison model.
 *
 * Order of a day:
 *   morning  weather · sleep · trip · employment · health · free time · documents
 *            interviews · job market · parcels · bills · loans · urges · events
 *   evening  commute & work · meals · supplies · electricity · appearance · mood
 *            urges · weekly review · spoilage · distress check · next day
 */
(function (root) {
  const RLS = root.RLS;
  const E = RLS.engine;
  const M = RLS.money;
  const { rp } = M;
  const { bi, L } = RLS.i18n;
  const D = () => RLS.data;
  const { clamp } = E;
  const r1000 = (minor) => Math.round(minor / rp(1000)) * rp(1000);

  // ── events ──────────────────────────────────────────────────────────
  const CHANCE = { calm: 0.12, normal: 0.22, chaotic: 0.38 };
  const EV = (id, o) => ({ id, weight: 1, random: true, ...o });
  const EVENTS = [
    EV('wedding', { app: 'calendar', title: bi('Undangan pernikahan', 'Wedding invitation'), weight: 3,
      body: () => bi('Rekan kerjamu menikah akhir pekan ini. Tamu biasanya membawa amplop.', 'A colleague is getting married this weekend. Guests usually bring an envelope gift.'),
      choices: (s, d, r) => [
        { label: bi('Datang, amplop lebih tebal', 'Go, with a fuller envelope'), cost: r1000(rp(100000 + r() * 50000)), mood: { social: 10, loneliness: -10, happiness: 5 }, kind: 'discretionary', effect: (st) => E.maybeUrge(st, 'event', true) },
        { label: bi('Datang, amplop secukupnya', 'Go, with a smaller envelope'), cost: rp(50000), mood: { social: 8, loneliness: -8, happiness: 3 }, kind: 'discretionary' },
        { label: bi('Kirim ucapan lewat pesan', 'Send congratulations by message'), cost: 0, mood: { happiness: -2, loneliness: 2 }, skip: true },
      ] }),
    EV('family_help', { app: 'calendar', title: bi('Pesan dari rumah', 'Message from home'), weight: 3,
      body: () => bi('Ibumu bertanya apakah kamu bisa bantu biaya sekolah adikmu bulan ini.', 'Your mother asks if you can help with your younger sibling\'s school fees this month.'),
      choices: (s, d, r) => [
        { label: bi('Kirim sesuai yang diminta', 'Send what they asked for'), cost: r1000(rp(400000 + r() * 200000)), mood: { happiness: 2, anxiety: 4 }, kind: 'essential' },
        { label: bi('Kirim sebagian', 'Send part of it'), cost: rp(200000), mood: { anxiety: 2 }, kind: 'essential' },
        { label: bi('Jelaskan bulan ini belum bisa', 'Explain you can\'t this month'), cost: 0, mood: { happiness: -4, frustration: 3 }, skip: true },
      ] }),
    EV('charger', { app: 'shopsquare', title: bi('Charger rusak', 'Charger stopped working'), weight: 2,
      body: () => bi('Charger ponselmu mati semalam. Baterai tinggal 9%.', 'Your phone charger died overnight. The battery is at 9%.'),
      choices: () => [
        { label: bi('Charger murah di lapak pasar', 'Budget charger from a market stall'), cost: rp(35000), kind: 'essential' },
        { label: bi('Charger original', 'Original-brand charger'), cost: rp(150000), mood: { happiness: 1 }, kind: 'essential' },
        { label: bi('Pinjam punya teman dulu', 'Borrow a friend\'s for now'), cost: 0, mood: { frustration: 2 }, skip: true },
      ] }),
    EV('birthday_dinner', { app: 'afterhours', title: bi('Makan malam ulang tahun', 'Birthday dinner'), weight: 3,
      body: () => bi('Teman-teman makan malam untuk ulang tahun salah satu dari kalian, bayar patungan.', 'Friends are going out for a birthday dinner and splitting the bill.'),
      choices: (s, d, r) => [
        { label: bi('Ikut makan malam', 'Join the dinner'), cost: r1000(rp(100000 + r() * 60000)), mood: { social: 14, loneliness: -15, happiness: 8, boredom: -10 }, kind: 'discretionary', effect: (st) => { st.todayLog.social++; st.todayLog.leisure++; st.todayLog.extraMeal = (st.todayLog.extraMeal || 0) + 1; } },
        { label: bi('Datang, cuma pesan minum', 'Go, drinks only'), cost: rp(35000), mood: { social: 9, loneliness: -10, happiness: 4 }, kind: 'discretionary', effect: (st) => { st.todayLog.social++; } },
        { label: bi('Kali ini tidak ikut', 'Skip this one'), cost: 0, mood: { happiness: -3, loneliness: 4 }, skip: true },
      ] }),
    EV('rain_home', { app: 'move', title: bi('Hujan deras sepulang kerja', 'Heavy rain after work'), weight: 3, when: (s) => E.isRainy(s) && E.isScheduledToWork(s),
      body: (s) => s.owned.raincoat || s.owned.umbrella ? bi('Hujan deras. Kamu bawa jas hujan/payung, tapi jalanan mulai banjir.', 'It\'s pouring. You have rain gear, but the roads are flooding.') : bi('Hujan deras dan kamu tidak bawa jas hujan atau payung.', 'It\'s pouring and you have no raincoat or umbrella.'),
      choices: (s) => {
        const city = E.getLocality(s.config.cityId).city;
        return [
          { label: bi('Pesan mobil online', 'Order a ride-hailing car'), cost: E.ojolFare(city, s.config.distanceKm, 'car', 'high').cost, mood: { stress: -2 }, kind: 'essential' },
          { label: bi('Beli jas hujan di minimarket', 'Buy a raincoat at the minimarket'), cost: rp(35000), kind: 'essential', effect: (st) => { st.owned.raincoat = true; } },
          { label: bi('Tunggu reda di kantor', 'Wait it out at work'), cost: 0, mood: { stress: 3, energy: -5 }, skip: true, effect: (st) => { st.todayLog.lateNight = true; } },
        ];
      } }),
    EV('office_collection', { app: 'workday', title: bi('Iuran duka di kantor', 'Office condolence collection'), weight: 2, when: (s) => E.isEmployed(s),
      body: () => bi('Orang tua rekan kerja meninggal. Tim mengumpulkan uang duka.', 'A coworker\'s parent passed away. The team is collecting money for the family.'),
      choices: () => [
        { label: bi('Ikut Rp50.000', 'Give Rp50,000'), cost: rp(50000), mood: { social: 2 }, kind: 'essential' },
        { label: bi('Ikut Rp20.000', 'Give Rp20,000'), cost: rp(20000), kind: 'essential' },
      ] }),
    EV('fan', { app: 'shopsquare', title: bi('Kipas angin rusak', 'The fan broke'), weight: 1, when: (s) => !!s.owned.items.fan && !E.curHousing(s).ac,
      body: () => bi('Kipas anginmu berhenti berputar. Malam-malam minggu ini panas.', 'Your fan stopped turning. Nights are hot this week.'),
      choices: () => [
        { label: bi('Servis di tukang servis', 'Repair it at a service stall'), cost: rp(50000), kind: 'essential' },
        { label: bi('Beli kipas baru', 'Buy a new fan'), cost: rp(175000), kind: 'essential' },
        { label: bi('Tidur tanpa kipas dulu', 'Sleep without it for now'), cost: 0, mood: { comfort: -10 }, skip: true, effect: (st) => { delete st.owned.items.fan; } },
      ] }),
    EV('flash_sale', { app: 'dailymart', title: bi('Flash sale DailyMart (event game)', 'DailyMart flash sale (game event)'), weight: 1,
      body: () => bi('Event fiktif: beras medium 5 kg lebih murah hari ini.', 'A fictional in-game sale: 5 kg of medium rice for less today.'),
      choices: () => [
        { label: bi('Beli satu karung', 'Buy one bag'), cost: rp(58000), kind: 'essential', effect: (st) => E.addFoodBatch(st, { itemId: 'rice_medium_5', type: 'rice', qty: 50, unitValue: rp(1160) }) },
        { label: bi('Tidak sekarang', 'Not now'), cost: 0, skip: true },
      ] }),
    EV('flat_tire', { app: 'move', title: bi('Ban bocor', 'Flat tyre'), weight: 2, when: (s) => s.config.commutePlanId === 'motorcycle' && E.isScheduledToWork(s),
      body: () => bi('Ban motormu bocor di jalan.', 'Your motorcycle tyre went flat on the way.'),
      choices: () => [
        { label: bi('Tambal ban', 'Patch it'), cost: rp(15000), kind: 'essential' },
        { label: bi('Ganti ban dalam', 'Replace the inner tube'), cost: rp(45000), kind: 'essential' },
      ] }),
    EV('overtime', { app: 'workday', title: bi('Tawaran lembur', 'Overtime offered'), weight: 2, when: (s) => E.isScheduledToWork(s) && s.job && s.job.type !== 'harian',
      body: () => bi('Atasan bertanya apakah kamu bisa lembur tiga jam hari ini. Lembur dibayar per jam.', 'Your supervisor asks if you can stay three extra hours today. Overtime is paid by the hour.'),
      choices: (s) => [
        { label: bi('Lembur tiga jam', 'Stay three hours'), cost: -E.overtimePay(s.job.wage, 3), mood: { energy: -12, stress: 5 }, kind: 'income', note: bi('Upah sejam = gaji ÷ 173; 1,5× jam pertama, 2× berikutnya', 'Hourly wage = monthly ÷ 173; 1.5× first hour, 2× after'), effect: (st) => { st.todayLog.lateNight = true; E.useSlots(st, st.day.slots - st.day.used); } },
        { label: bi('Tolak dengan sopan', 'Decline politely'), cost: 0 },
      ] }),
    EV('work_print', { app: 'workday', title: bi('Urusan kerja', 'Work errand'), weight: 1, when: (s) => E.isScheduledToWork(s),
      body: () => bi('Kamu perlu mencetak dan menjilid dokumen untuk besok; printer kantor rusak.', 'You need to print and bind documents for tomorrow. The office printer is broken.'),
      choices: () => [
        { label: bi('Bayar di tempat fotokopi', 'Pay at the print shop'), cost: rp(30000), kind: 'essential' },
        { label: bi('Patungan dengan rekan', 'Split with a colleague'), cost: rp(15000), mood: { social: 2 }, kind: 'essential' },
      ] }),
    EV('phone_drop', { app: 'connect', title: bi('Ponsel jatuh', 'Dropped your phone'), weight: 1,
      body: () => bi('Ponselmu jatuh dan layarnya retak. Masih bisa dipakai, tapi sulit dibaca.', 'Your phone fell and the screen cracked. It still works, but it is hard to read.'),
      choices: () => [
        { label: bi('Ganti layar di konter', 'Replace the screen at a counter'), cost: rp(400000), kind: 'essential', effect: (st) => { st.owned.phoneCondition = 85; } },
        { label: bi('Pakai dulu apa adanya', 'Live with it for now'), cost: 0, mood: { frustration: 4 }, skip: true, effect: (st) => { st.owned.phoneCondition = 25; } },
      ] }),
    EV('child_sick', { app: 'care', title: bi('Anak demam', 'Your child has a fever'), weight: 2, when: (s) => E.members(s).kids > 0,
      body: (s) => E.hasJkn(s) ? bi('Anakmu demam sejak semalam. JKN keluargamu aktif, jadi faskes 1 gratis.', 'Your child has had a fever since last night. Your family JKN is active, so the clinic is free.') : bi('Anakmu demam sejak semalam. Keluargamu tidak punya JKN aktif.', 'Your child has had a fever since last night. Your family has no active JKN.'),
      choices: (s, d, r) => [
        E.hasJkn(s) ? { label: bi('Bawa ke faskes JKN', 'Take them to the JKN clinic'), cost: E.localFare(s) * 2, mood: { anxiety: -4 }, kind: 'essential', note: bi('Hanya ongkos jalan', 'Travel cost only') } : { label: bi('Bawa ke klinik swasta', 'Take them to a private clinic'), cost: r1000(rp(130000 + r() * 50000)), kind: 'essential' },
        { label: bi('Beli obat penurun panas anak', 'Buy children\'s fever medicine'), cost: rp(25000), kind: 'essential' },
        { label: bi('Pantau di rumah dulu', 'Watch them at home for now'), cost: 0, mood: { anxiety: 6, stress: 4 }, skip: true },
      ] }),
    EV('school_event', { app: 'calendar', title: bi('Iuran kegiatan sekolah', 'School activity fee'), weight: 2, when: (s) => E.members(s).school > 0,
      body: () => bi('Sekolah mengadakan kunjungan edukasi. Ada iuran untuk bus dan makan siang.', 'The school is running a study trip. There is a fee for the bus and lunch.'),
      choices: () => [
        { label: bi('Bayar iuran', 'Pay the fee'), cost: rp(150000), mood: { happiness: 2 }, kind: 'essential' },
        { label: bi('Anak tidak ikut', 'Your child stays behind'), cost: 0, mood: { happiness: -5, frustration: 4 }, skip: true },
      ] }),
    EV('cheap_ride', { app: 'move', title: bi('Tumpangan murah di grup chat', 'Cheap ride offered in a chat group'), weight: 1, when: (s) => E.isOnline(s),
      body: () => bi('Seseorang di grup warga menawarkan tumpangan mobil 40% lebih murah dari aplikasi. Tidak lewat aplikasi apa pun.', 'Someone in a neighbourhood chat offers car rides 40% cheaper than the apps, outside any app.'),
      choices: () => [
        { label: bi('Simpan kontaknya (tampil di Move hari ini)', 'Save the contact (shows in Move today)'), cost: 0, effect: (st) => { st.unverifiedUntil = E.today(st); } },
        { label: bi('Abaikan', 'Ignore it'), cost: 0 },
      ] }),
    // ── scripted (queued by systems) ──
    EV('sick_day', { random: false, app: 'aku', title: bi('Badanmu kurang fit', 'You\'re not feeling well'),
      body: (s) => bi(`${E.cond(s).label.id} (${L(E.severityText(s)) || ''}). Hari ini jadwal kerja.`, `${E.cond(s).label.en} (${(E.severityText(s) || {}).en || ''}). You are due at work today.`),
      choices: (s) => {
        const formal = s.config.scenario === 'formal' && s.job && s.job.type !== 'harian';
        const out = [{ label: bi('Tetap masuk kerja', 'Go to work anyway'), cost: 0, mood: { stress: 4 }, effect: (st) => { const r = E.rng(st, 'worsen'); if (r() < 0.35 && E.CONDITIONS[st.health.condition].sick) st.health.daysLeft++; } }];
        if (E.hasJkn(s)) out.push({ label: bi('Izin sakit, periksa di faskes JKN', 'Sick leave, see your JKN clinic'), cost: E.localFare(s) * 2, kind: 'essential', note: formal ? bi('Dapat surat dokter: hari ini tetap dibayar', 'You get a doctor\'s note: today stays paid') : bi('Pekerja tanpa kontrak formal: hari ini tidak dibayar', 'Without a formal contract: today is unpaid'), effect: (st) => { E.takeLeave(st, 'sick', { note: true }); E.clinicVisit(st, 'jkn', { travelPaid: true }); } });
        out.push({ label: bi('Izin sakit, klinik swasta', 'Sick leave, private clinic'), cost: rp(150000), kind: 'essential', note: formal ? bi('Dapat surat dokter', 'You get a doctor\'s note') : null, effect: (st) => { E.takeLeave(st, 'sick', { note: true }); E.clinicVisit(st, 'private'); } });
        out.push({ label: bi('Izin istirahat tanpa surat dokter', 'Stay home without a doctor\'s note'), cost: 0, note: bi('Tidak dibayar untuk hari ini', 'Unpaid for today'), effect: (st) => { E.takeLeave(st, 'sick', { note: false }); E.applyMood(st, { energy: 10, stress: -4 }); } });
        return out;
      } }),
    EV('support', { random: false, app: 'aku', title: bi('Kamu tidak harus menanggungnya sendiri', 'You don\'t have to carry this alone'),
      body: () => bi('Sudah beberapa hari kamu merasa sangat berat, lelah, dan sulit menikmati apa pun. Ini bukan kegagalan. Pilihan di bawah bisa sedikit meringankan; belanja bukan salah satunya.', 'For days now everything has felt heavy, tiring and hard to enjoy. This is not a failure. The choices below can ease things a little; shopping is not one of them.'),
      choices: (s) => {
        const out = [
          { label: bi('Istirahat seharian', 'Rest for the day'), cost: 0, effect: (st) => { if (E.isScheduledToWork(st) && !st.day.leave) E.takeLeave(st, 'rest'); E.supportAction(st, 'rest'); } },
          { label: bi('Hubungi teman yang kamu percaya', 'Reach out to a friend you trust'), cost: 0, effect: (st) => E.supportAction(st, 'friend') },
        ];
        if (E.isOnline(s)) out.push({ label: bi('Video call dengan keluarga', 'Video call your family'), cost: 0, effect: (st) => E.supportAction(st, 'family') });
        if (E.hasJkn(s)) out.push({ label: bi('Konsultasi psikolog di puskesmas (JKN)', 'See a psychologist at the puskesmas (JKN)'), cost: E.localFare(s) * 2, kind: 'essential', note: bi('Tersedia di banyak puskesmas; cek di daerahmu', 'Available at many puskesmas; check locally'), effect: (st) => { if (E.isScheduledToWork(st) && !st.day.leave) E.takeLeave(st, 'rest'); E.supportAction(st, 'professional'); } });
        out.push({ label: bi('Konsultasi psikolog swasta', 'See a private psychologist'), cost: rp(300000), kind: 'essential', effect: (st) => { if (E.isScheduledToWork(st) && !st.day.leave) E.takeLeave(st, 'rest'); E.supportAction(st, 'professional'); } });
        out.push({ label: bi('Belum sekarang', 'Not right now'), cost: 0 });
        return out;
      } }),
    EV('layoff_notice', { random: false, app: 'workday', title: bi('Pemberitahuan pemutusan hubungan kerja', 'Termination notice'),
      body: (s, d) => {
        const run = E.runwayDays(s);
        return bi(`${E.REASONS[d.reason].id}. Hari kerja terakhir ${E.absLabel(d.lastAbs, true)} (pemberitahuan 14 hari kerja). Perkiraan kompensasi/pesangon: ${M.format(d.severance)}. Saldo JHT: ${M.format(s.benefits.jht)} (bisa diklaim 1 bulan setelah berhenti). JKP: ${d.jkp ? 'kemungkinan memenuhi syarat (60% upah hingga 6 bulan)' : 'belum memenuhi syarat 12 bulan iuran'}. Dengan uang yang ada, kamu bisa bertahan ±${Math.max(0, run)} hari. Utang dan tagihanmu tetap berjalan.`,
          `${E.REASONS[d.reason].en}. Last working day ${E.absLabel(d.lastAbs, true)} (14 working days' notice). Estimated compensation/severance: ${M.format(d.severance)}. JHT balance: ${M.format(s.benefits.jht)} (claimable 1 month after you leave). JKP: ${d.jkp ? 'likely eligible (60% of wage for up to 6 months)' : 'not yet eligible (needs 12 months of contributions)'}. With the money you have, you can last about ${Math.max(0, run)} days. Your debts and bills continue.`);
      },
      choices: () => [{ label: bi('Mengerti. Mulai cari kerja di Appy', 'Understood. Start looking in Appy'), cost: 0 }, { label: bi('Butuh waktu untuk mencerna', 'Need a moment'), cost: 0, mood: { stress: 3 } }] }),
    EV('unsafe_ride', { random: false, app: 'move', title: bi('Situasi tidak aman di perjalanan', 'An unsafe situation on the ride'),
      body: (s, d) => bi('Pengemudi tiba-tiba keluar dari rute ke jalan yang sepi dan tidak menjawab saat kamu bertanya. Kamu merasa tidak aman.', 'The driver suddenly leaves the route for a quiet road and does not answer when you ask. You feel unsafe.'),
      choices: (s, d) => {
        const out = [{ label: bi('Minta berhenti di tempat ramai (minimarket) dan turun', 'Ask to stop at a busy place (a minimarket) and get out'), cost: 0, effect: (st) => unsafeOutcome(st, d, 0.9) }];
        out.push({ label: bi('Telepon orang terdekat & bagikan lokasi langsung', 'Call someone close & share your live location'), cost: 0, effect: (st) => unsafeOutcome(st, d, d.shared ? 0.96 : 0.93) });
        if (d.sos) out.push({ label: bi('Tekan tombol darurat di aplikasi', 'Press the in-app emergency button'), cost: 0, effect: (st) => unsafeOutcome(st, d, 0.97) });
        return out;
      } }),
    EV('unsafe_after', { random: false, app: 'move', title: bi('Setelah kejadian tadi', 'After what happened'),
      body: (s, d) => d.theft ? bi(`Kamu berhasil turun dan selamat, tapi ponsel dan uang tunai ${M.format(d.cash)} dibawa kabur. Ini bukan salahmu.`, `You got out safely, but your phone and ${M.format(d.cash)} in cash were taken. This is not your fault.`) : bi('Kamu berhasil turun dengan selamat. Rasa takutnya masih terasa; itu wajar.', 'You got out safely. The fear is still there; that is normal.'),
      choices: () => [
        { label: bi('Lapor ke polisi dan ke penyedia layanan', 'Report it to the police and the provider'), cost: 0, mood: { anxiety: -4 }, effect: (st) => { E.useSlots(st, 1); } },
        { label: bi('Ceritakan ke orang yang kamu percaya', 'Talk to someone you trust'), cost: 0, effect: (st) => E.supportAction(st, 'friend') },
        { label: bi('Pulang dan istirahat', 'Go home and rest'), cost: 0, mood: { stress: -4 } },
      ] }),
    EV('collector_illegal', { random: false, app: 'pinjam', title: bi('Penagih pinjol ilegal menghubungi kontakmu', 'Illegal lender\'s collectors contact your contacts'),
      body: () => bi('Mereka mengirim pesan memalukan ke teman dan keluargamu. Penagihan seperti ini melanggar hukum. Kamu bisa melapor ke OJK (kontak 157) dan polisi.', 'They are sending humiliating messages to your friends and family. Collection like this is unlawful. You can report it to OJK (contact 157) and the police.'),
      choices: (s, d) => {
        const loan = s.loans.find((l) => l.id === d.loanId);
        const owed = loan ? loan.schedule.filter((x) => !x.paid).reduce((a, x) => a + x.amount + (x.lateFee || 0), 0) : 0;
        return [
          { label: bi('Bayar semua tagihannya', 'Pay everything they demand'), cost: owed, kind: 'essential', effect: (st) => { const ln = st.loans.find((l) => l.id === d.loanId); if (ln) { ln.schedule.forEach((x) => { x.paid = true; }); ln.status = 'repaid'; st.bills.filter((b) => b.loanId === ln.id).forEach((b) => { b.status = 'paid'; }); } st.loanHarassDays = 0; }, cls: 'loan_repay_all', loanId: d.loanId },
          { label: bi('Laporkan ke OJK & polisi', 'Report to OJK & the police'), cost: 0, mood: { anxiety: -6, stress: -4 }, effect: (st) => { st.loanHarassDays = 0; const ln = st.loans.find((l) => l.id === d.loanId); if (ln) ln.reported = true; } },
          { label: bi('Blokir nomornya dan abaikan', 'Block the numbers and ignore'), cost: 0, mood: { stress: 8, loneliness: 4 } },
        ];
      } }),
  ];
  const eventById = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
  function unsafeOutcome(state, d, safeP) {
    const r = E.rng(state, 'unsafe');
    E.applyMood(state, { stress: 30, anxiety: 12, confidence: -6 });
    state.todayLog.lateNight = true;
    const theft = r() > safeP;
    let cash = 0;
    if (theft) {
      cash = r1000(rp(80000 + r() * 150000));
      E.chargeOrFail(state, { merchant: bi('Uang tunai hilang', 'Cash lost'), category: 'unexpected', cls: 'unexpected', amount: Math.min(cash, state.wallet), split: { essential: Math.min(cash, state.wallet) }, quiet: true });
      state.owned.phoneCondition = 0;
      E.applyMood(state, { stress: 15, anxiety: 10, happiness: -10 });
    }
    queueEvent(state, 'unsafe_after', { theft, cash });
  }
  function queueEvent(state, id, data = {}) {
    if (state.activeEvent && state.activeEvent.id === id) return;
    if (state.eventQueue.some((q) => q.id === id)) return;
    state.eventQueue.push({ id, data });
    pumpEvents(state);
  }
  function pumpEvents(state) {
    if (state.activeEvent || !state.eventQueue.length) return;
    const { id, data } = state.eventQueue.shift();
    const ev = eventById[id];
    if (!ev) return pumpEvents(state);
    const r = E.rng(state, 'event', id);
    const choices = ev.choices(state, data, r).map(({ effect, ...rest }, i) => ({ ...rest, idx: i }));
    state.activeEvent = { id, app: ev.app, title: ev.title, body: ev.body(state, data), choices, day: state.date.day, month: state.monthIndex, data };
    state.counters.eventsSeen++;
    E.notify(state, ev.app, ev.title, bi('Perlu keputusanmu.', 'Needs your decision.'), 'event');
  }
  function rollEvent(state) {
    if (state.trip && state.trip.active) return;
    const r = E.rng(state, 'roll');
    if (r() > CHANCE[state.config.difficulty]) return;
    const pool = EVENTS.filter((e) => e.random && (!e.when || e.when(state)));
    const totalW = pool.reduce((s, e) => s + e.weight, 0);
    let x = r() * totalW, ev = pool[0];
    for (const e of pool) { x -= e.weight; if (x <= 0) { ev = e; break; } }
    queueEvent(state, ev.id);
  }
  function resolveEvent(state, choiceIdx) {
    const ev = state.activeEvent;
    if (!ev) return { ok: false, error: 'no_event' };
    const def = eventById[ev.id];
    const ch = ev.choices[choiceIdx];
    if (!ch) return { ok: false, error: 'bad_choice' };
    const live = def.choices(state, ev.data, E.rng(state, 'event', ev.id))[choiceIdx];
    if (ch.cost > 0 && ch.loanId) {
      const loan = state.loans.find((l) => l.id === ch.loanId);
      const principal = loan ? loan.schedule.filter((x) => !x.paid).reduce((a, x) => a + x.principal, 0) : 0;
      const res = E.chargeOrFail(state, { merchant: loan ? loan.name : ev.title, category: 'loan', cls: 'loan_repay', amount: ch.cost, note: ch.label, split: { principal: Math.min(principal, ch.cost), interest: ch.cost - Math.min(principal, ch.cost) } });
      if (!res.ok) return res;
    } else if (ch.cost > 0) {
      const res = E.chargeOrFail(state, { merchant: ev.title, category: 'unexpected', cls: 'unexpected', amount: ch.cost, note: [ch.label, ch.note], split: { [ch.kind === 'discretionary' ? 'discretionary' : 'essential']: ch.cost } });
      if (!res.ok) return res;
      state.todayLog.unexpected += ch.cost;
    } else if (ch.cost < 0) E.credit(state, { merchant: ev.title, category: 'extra', cls: 'income_extra', amount: -ch.cost, note: [ch.label, ch.note] });
    state.activeEvent = null;
    if (ch.mood) E.applyMood(state, ch.mood);
    if (live && live.effect) live.effect(state);
    if (ch.skip) state.counters.skipped++;
    state.eventsLog.unshift({ ...E.stamp(state), title: ev.title, choice: ch.label, cost: ch.cost });
    if (state.eventsLog.length > 120) state.eventsLog.length = 120;
    pumpEvents(state);
    return { ok: true };
  }
  Object.assign(E, { EVENTS, queueEvent, pumpEvents, rollEvent, resolveEvent });

  // ── morning ─────────────────────────────────────────────────────────
  function startOfDay(state, opts = {}) {
    const today = E.today(state);
    state.todayLog = E.freshToday();
    state.day = { slots: 1, used: 0, leave: null, weather: E.rollWeather ? null : 'clear', friendFree: false, sickNote: false };
    state.day.weather = E.rollWeather(state);
    if (!opts.first && state.lastSleptAbs !== today) { E.sleepNight(state); state.lastSleptAbs = today; }
    E.tripDay(state);
    E.employmentChecks(state);
    E.startPendingJob(state);
    E.rollHealth(state);
    E.setupSlots(state);
    if (state.trip && state.trip.active && state.day.leave == null) state.day.slots = 0;
    E.processDocs(state);
    E.attendPassport(state);
    E.attendInterviews(state);
    state.schedule = state.schedule.filter((s) => s.abs >= today);
    E.refreshListings(state);
    E.appProgress(state);
    E.advanceOrders(state);
    // bills
    const day = state.date.day;
    E.loanDaily(state);
    for (const b of E.billsThisMonth(state)) {
      if (b.status === 'paid') continue;
      if ((b.dueDay === day || (b.forcedAutopay && b.dueDay <= day)) && b.autopay) {
        const r = E.processBillPayment(state, b.id, { quiet: true });
        if (r.ok) E.notify(state, 'bills', bi('Bayar otomatis', 'Autopay'), bi(`${L(b.label)} dibayar: ${M.format(b.amount)}`, `${(b.label && b.label.en) || b.label} paid: ${M.format(b.amount)}`), 'info');
        else E.notify(state, 'bills', bi('Bayar otomatis gagal', 'Autopay failed'), bi(`${L(b.label)}: saldo kurang.`, `${(b.label && b.label.en) || b.label}: not enough balance.`), 'warn');
      }
      if (b.status !== 'paid' && day === b.dueDay && !b.autopay) E.notify(state, 'bills', bi('Tagihan jatuh tempo hari ini', 'Bill due today'), bi(`${L(b.label)}: ${M.format(b.amount)}`, `${(b.label && b.label.en) || b.label}: ${M.format(b.amount)}`), 'warn');
      if (b.status === 'pending' && day > b.dueDay) { b.status = 'overdue'; E.notify(state, 'bills', bi('Tagihan lewat jatuh tempo', 'Bill overdue'), bi(`${L(b.label)} jatuh tempo tgl ${b.dueDay}.`, `${(b.label && b.label.en) || b.label} was due on day ${b.dueDay}.`), 'warn'); }
    }
    for (const sub of state.subscriptions) {
      if (!sub.active || sub.renewDay !== day || sub.lastChargedMonth === state.monthIndex) continue;
      const def = D().subscriptions.find((x) => x.id === sub.id);
      const res = E.chargeOrFail(state, { merchant: def.name, category: 'subs', cls: 'discretionary', amount: def.price, note: bi('Perpanjangan bulanan', 'Monthly renewal'), quiet: true });
      if (res.ok) { sub.lastChargedMonth = state.monthIndex; E.applyMood(state, def.mood); }
      else { sub.active = false; E.notify(state, 'recurring', bi('Langganan dihentikan', 'Subscription paused'), bi(`${def.name.id} gagal diperpanjang.`, `${def.name.en} could not renew.`), 'warn'); }
    }
    E.maybeIllegalOffer(state);
    if (state.dataPlanUntil && E.dayNumber(state.dataPlanUntil) === today - 1) E.notify(state, 'connect', bi('Paket data habis', 'Mobile data expired'), bi('Ojol, pesan antar, dan Appy butuh Wi-Fi atau paket data.', 'Ride-hailing, delivery and Appy need Wi-Fi or data.'), 'warn');
    const s = state.supplies;
    if (s.water > 0 && s.water <= 1.2) E.notify(state, 'dailymart', bi('Air minum hampir habis', 'Drinking water running low'), bi('Sisa sekitar sehari.', 'About one day left.'), 'info');
    if (s.gasMeals > 0 && s.gasMeals <= 3) E.notify(state, 'dailymart', bi('Gas hampir habis', 'LPG almost empty'), bi(`Cukup untuk ±${s.gasMeals} kali masak.`, `About ${s.gasMeals} more cooks.`), 'info');
    const h = E.curHousing(state);
    if (!h.includes.electricity && state.config.electricity.meter === 'prepaid') {
      const daily = E.estimateElectricity(E.electricityProfile(state), state.config.ppjBp).dailyKwh;
      if (state.electricity.kwhBalance > 0 && state.electricity.kwhBalance < daily * 2) E.notify(state, 'utility', bi('Token hampir habis', 'Token almost used up'), bi(`Sisa ${state.electricity.kwhBalance.toFixed(1)} kWh.`, `${state.electricity.kwhBalance.toFixed(1)} kWh left.`), 'warn');
    }
    state.day.friendFree = E.friendAvailable(state);
    E.morningUrges(state);
    if (E.isScheduledToWork(state) && !state.day.leave) {
      const c = E.cond(state);
      if (c.sick || (state.health.condition === 'menstrual' && state.health.severity >= 2) || (state.health.condition === 'exhausted' && state.health.severity >= 2)) queueEvent(state, 'sick_day');
    }
    if (!opts.first) rollEvent(state);
    pumpEvents(state);
  }

  // ── evening ─────────────────────────────────────────────────────────
  function advanceSimulationDay(state, opts = {}) {
    if (state.phase !== 'play') return { ended: true };
    if (state.activeEvent) return { ok: false, error: 'event_pending' };
    const log = [];
    let work = null;
    if (E.isScheduledToWork(state) && !state.day.leave) {
      const commute = E.runCommute(state);
      if (!commute.ok) {
        state.counters.missedWork++;
        if (state.job.type !== 'harian') state.employment.unpaidLeave++;
        state.perf.days.push({ abs: E.today(state), score: 15, absent: true });
        E.applyMood(state, { stress: 8, anxiety: 6 });
        log.push(bi('Tidak bisa bayar ongkos kerja; kamu absen', 'Could not pay the commute; you missed work'));
        E.notify(state, 'workday', bi('Absen kerja', 'Missed work'), bi('Saldo tidak cukup untuk ongkos. Hari ini dihitung tidak masuk tanpa upah.', 'Not enough for the commute. Today counts as an unpaid absence.'), 'warn');
      } else work = E.doWork(state, commute);
    }
    if (state.trip && state.trip.active) E.tripMeals(state);
    const meals = E.resolveMeals(state, opts.mealChoice || 'skip');
    if (meals.skipped) log.push(bi(`${meals.skipped} kali makan terlewat`, `${meals.skipped} meal(s) missed`));
    E.consumeSupplies(state);
    // electricity
    const h = E.curHousing(state);
    if (!h.includes.electricity && !(state.trip && state.trip.active && !E.ownsFridge(state))) {
      const daily = E.estimateElectricity(E.electricityProfile(state), state.config.ppjBp).dailyKwh * (state.trip && state.trip.active ? 0.4 : 1);
      if (state.config.electricity.meter === 'prepaid') {
        if (state.electricity.kwhBalance > 0) state.electricity.kwhBalance = Math.max(0, state.electricity.kwhBalance - daily);
        if (state.electricity.kwhBalance <= 0) { state.counters.outageDays++; E.applyMood(state, { stress: 3, happiness: -2 }); E.notify(state, 'utility', bi('Listrik padam', 'Your power is out'), bi('Token habis. Beli token di Utility Hub.', 'The prepaid meter hit zero. Buy a token in Utility Hub.'), 'warn'); }
      } else state.electricity.kwhUsedMonth += daily;
    }
    state.owned.phoneCondition = clamp(state.owned.phoneCondition - 0.05, 0, 100);
    E.updateAppearance(state);
    E.updateMood(state);
    if (state.todayLog.energyNext) state.mood.energy = clamp(state.mood.energy + state.todayLog.energyNext, 0, 100);
    E.eveningUrges(state);
    const wd = E.weekday(state.date.year, state.date.month, state.date.day);
    if (state.job && E.isEmployed(state) && wd === (state.config.workweek === 6 ? 6 : 5)) E.weeklyReview(state);
    E.processSpoilage(state);
    E.checkDistress(state);
    const dim = E.daysInMonth(state.date.year, state.date.month);
    if (state.date.day >= dim) {
      state.phase = 'report';
      state.lastReport = generateMonthlyReport(state);
      E.notify(state, 'report', bi('Bulan selesai', 'Month complete'), bi('Laporan akhir bulanmu sudah siap.', 'Your end-of-month report is ready.'), 'info');
      return { ended: true, log, work };
    }
    state.date.day++;
    startOfDay(state);
    return { ended: false, log, work };
  }
  Object.assign(E, { startOfDay, advanceSimulationDay });

  // ── report ──────────────────────────────────────────────────────────
  function generateMonthlyReport(state, monthIndex = state.monthIndex) {
    const txs = state.transactions.filter((t) => t.month === monthIndex && t.status === 'completed');
    const sum = (f) => txs.filter(f).reduce((s, t) => s + Math.abs(t.amount), 0);
    const salary = sum((t) => t.cls === 'income');
    const household = sum((t) => t.cls === 'income_household');
    const extraIncome = sum((t) => t.cls === 'income_extra');
    const benefits = sum((t) => t.cls === 'benefit');
    const severance = sum((t) => t.cls === 'severance');
    const income = salary + household + extraIncome + benefits + severance;
    const loanIn = sum((t) => t.cls === 'loan_in');
    const mandatory = sum((t) => t.cls === 'mandatory');
    let variableEssential = 0, discretionary = 0, unexpectedEss = 0, unexpectedDisc = 0, financeCost = 0, principalRepaid = 0, refunds = 0;
    for (const t of txs) {
      const a = Math.abs(t.amount);
      if (t.cls === 'essential') variableEssential += a;
      else if (t.cls === 'discretionary') discretionary += a;
      else if (t.cls === 'mixed') { variableEssential += t.split.essential; discretionary += t.split.discretionary; }
      else if (t.cls === 'unexpected') { unexpectedEss += t.split.essential || 0; unexpectedDisc += t.split.discretionary || 0; }
      else if (t.cls === 'loan_repay') { principalRepaid += t.split ? t.split.principal : a; financeCost += t.split ? t.split.interest : 0; }
      else if (t.cls === 'refund') { refunds += a; variableEssential -= (t.split && t.split.essential) || 0; discretionary -= (t.split && t.split.discretionary) || 0; }
    }
    const upfront = sum((t) => t.cls === 'upfront');
    const savingsIn = sum((t) => t.cls === 'savings_in');
    const savingsOut = sum((t) => t.cls === 'savings_out');
    const netSavings = savingsIn - savingsOut;
    const consumption = mandatory + variableEssential + discretionary + unexpectedEss + unexpectedDisc;
    const remaining = income - consumption - financeCost - upfront;
    const bills = state.bills.filter((b) => b.month === monthIndex);
    const unpaid = bills.filter((b) => b.status !== 'paid');
    const essentialTotal = mandatory + variableEssential + unexpectedEss + financeCost;
    const ratio = (x) => (income ? x / income : 0);
    const c = state.counters;
    const moods = state.moodLog.filter((m) => m.abs >= (state.monthStart.abs || 0));
    const avgMood = (k) => (moods.length ? Math.round(moods.reduce((s, m) => s + m[k], 0) / moods.length) : state.mood[k]);
    const debt = E.debtOutstanding(state);
    const ladder = [
      { key: 'survive', label: bi('Bertahan sampai akhir bulan', 'Got through the month'), reached: true },
      { key: 'essentials', label: bi('Kebutuhan pokok terpenuhi', 'Essentials covered'), reached: unpaid.length === 0 && c.missedMeals <= 3 && c.outageDays <= 1, detail: bi(`${unpaid.length} tagihan belum dibayar, ${c.missedMeals} kali makan terlewat`, `${unpaid.length} unpaid bill(s), ${c.missedMeals} missed meal(s)`) },
      { key: 'buffer', label: bi('Punya dana darurat', 'Emergency buffer'), reached: state.savings >= Math.round(Math.max(income, rp(1)) * 0.1) && debt === 0, detail: bi(`Tabungan ${M.format(state.savings)} vs 10% pendapatan ${M.format(Math.round(income * 0.1))}${debt ? '; masih ada utang' : ''}`, `Savings ${M.format(state.savings)} vs 10% of income ${M.format(Math.round(income * 0.1))}${debt ? '; debt outstanding' : ''}`) },
      { key: 'saving', label: bi('Bisa menabung bulan ini', 'Saved money this month'), reached: netSavings > 0, detail: bi(`Bersih ke tabungan ${M.format(netSavings)}`, `Net to savings ${M.format(netSavings)}`) },
      { key: 'freedom', label: bi('Ada ruang untuk pilihan pribadi', 'Room for personal choice'), reached: unpaid.length === 0 && ratio(discretionary + unexpectedDisc) >= 0.1, detail: bi(`${Math.round(ratio(discretionary + unexpectedDisc) * 100)}% pendapatan untuk hal opsional`, `${Math.round(ratio(discretionary + unexpectedDisc) * 100)}% of income on optional things`) },
    ];
    const nut = E.nutritionScore(state);
    return {
      monthIndex, year: state.date.year, month: state.date.month, income, salary, household, extraIncome, benefits, severance, loanIn, refunds,
      mandatory, variableEssential, discretionary, unexpectedEss, unexpectedDisc, unexpected: unexpectedEss + unexpectedDisc, financeCost, principalRepaid,
      upfront, savingsIn, savingsOut, netSavings, consumption, remaining, walletStart: state.monthStart.wallet, walletEnd: state.wallet, savingsEnd: state.savings,
      debtEnd: debt, waste: E.wasteThisMonth(state, monthIndex), inventoryValue: E.inventoryValue(state),
      essentialRatio: ratio(essentialTotal), discretionaryRatio: ratio(discretionary + unexpectedDisc), savingsRate: ratio(netSavings),
      unpaid: unpaid.map((b) => ({ label: b.label, amount: b.amount })), unpaidTotal: unpaid.reduce((s, b) => s + b.amount, 0),
      counters: { ...c }, mood: { wellbeing: avgMood('wellbeing'), stress: avgMood('stress'), boredom: avgMood('boredom'), happiness: avgMood('happiness'), anxiety: avgMood('anxiety') },
      nutrition: { score: nut.score, label: nut.label }, perf: state.job ? state.perf.avg : null, employment: state.employment.status, ladder,
      byCategory: groupBy(txs.filter((t) => t.amount < 0 && !String(t.cls).startsWith('savings') && t.cls !== 'opening'), (t) => t.category),
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
    state.date = E.addDays({ ...state.date }, 1);
    state.monthIndex++;
    state.phase = 'play';
    state.counters = E.freshCounters();
    state.electricity.lastMonthKwh = state.electricity.kwhUsedMonth || null;
    state.electricity.kwhUsedMonth = 0;
    state.lastReport = null;
    state.monthStart = { wallet: state.wallet, savings: state.savings, debt: E.debtOutstanding(state), abs: E.today(state) };
    E.monthlyEconomy(state);
    if (state.pendingMove) {
      const h = E.getHousing(state.config.cityId, state.pendingMove);
      state.config.housingId = state.pendingMove;
      state.pendingMove = null;
      if (h && h.deposit > 0) E.chargeOrFail(state, { merchant: bi('Pemilik tempat baru', 'New landlord'), category: 'housing', cls: 'upfront', amount: h.deposit, note: bi('Deposit pindahan (sekali bayar)', 'Move-in deposit (one-off)') });
      if (h && h.fridge && !state.owned.items.fridge) state.owned.items.fridge = { condition: 100, included: true };
      E.notify(state, 'homebase', bi('Kamu sudah pindah', 'You moved'), h ? h.label : bi('Tempat baru', 'New home'), 'info');
    }
    E.payday(state);
    E.generateMonthlyBills(state);
    startOfDay(state);
    return { ok: true };
  }
  Object.assign(E, { generateMonthlyReport, startNextMonth });

  // ── comparison: a planned month, no randomness ──────────────────────
  function estimateMonthlyBudget(cfgIn) {
    const cfg = E.defaultConfig(cfgIn);
    const wage = E.resolveWage(cfg.cityId);
    const pay = E.calculateNetIncome(wage.amount, cfg.scenario);
    const income = cfg.wageTreatment === 'gross' ? pay.gross : pay.net;
    const housing = E.getHousing(cfg.cityId, cfg.housingId) || E.getHousing(cfg.cityId, 'kost_typical');
    const rent = housing.type === 'family' ? cfg.familyContribution : housing.monthlyRent;
    const mem = E.members({ config: cfg });
    const prof = { ...cfg.electricity, fridge: cfg.ownsFridge, fan: cfg.ownsFan, occupants: mem.people };
    const elec = housing.includes.electricity ? 0 : E.estimateElectricity(prof, cfg.ppjBp).total;
    const water = housing.includes.water ? 0 : cfg.waterBill;
    const wd = E.workdaysInMonth(cfg.startYear, cfg.startMonth, cfg.workweek);
    const plans = E.commutePlans(cfg.cityId, cfg.distanceKm, cfg);
    const pre = E.commutePresets(plans, wd);
    const plan = plans.find((p) => p.id === (cfg.commutePlanId || pre.cheapest));
    const transport = E.monthlyCommuteCost(plan, wd) || 0;
    const b = D().baskets;
    const q = (k) => E.calculateGroceryBasket(b[k].lines.map(([itemId, qty]) => ({ itemId, qty })), cfg).total;
    const weekly = cfg.basket === 'lean' ? 'week_lean' : 'week_everyday';
    const groceries = Math.round((q(weekly) * 4.3 + q('month_staples')) * mem.portions);
    const phone = D().connect.dataPlans[1].price;
    const mandatory = rent + elec + water;
    const essentials = mandatory + transport + groceries + phone;
    return { cfg, wage, pay, income, housing, rent, elec, water, transport, plan, groceries, phone, mandatory, essentials, remaining: income - essentials, workdays: wd };
  }
  E.estimateMonthlyBudget = estimateMonthlyBudget;
})(typeof globalThis !== 'undefined' ? globalThis : this);
