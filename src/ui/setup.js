/*
 * ui/setup.js — new-game flow: language, place, character, skills, work,
 * household, home, money & documents, settings, confirmation.
 * The draft is a config object; nothing touches money until createGame.
 */
(function (root) {
  const RLS = root.RLS;
  const E = RLS.engine, M = RLS.money, D = RLS.data, I = RLS.i18n, U = RLS.U;
  const { esc, T, t, L, ic, pill, fmt, short, srcLink } = U;
  const ui = U.ui;
  const J = D.jobs;
  const bi = I.bi;

  const STEPS = [bi('Mulai', 'Welcome'), bi('Negara', 'Country'), bi('Provinsi', 'Province'), bi('Kota', 'City'), bi('Karakter', 'Character'), bi('Kemampuan', 'Skills'),
    bi('Pekerjaan', 'Work'), bi('Rumah tangga', 'Household'), bi('Tempat tinggal', 'Home'), bi('Uang & dokumen', 'Money & papers'), bi('Pengaturan', 'Settings'), bi('Konfirmasi', 'Confirm')];
  const LAST = STEPS.length - 1;
  const money = (v) => { const n = Math.round(Number(String(v).replace(/[^\d]/g, ''))); return Number.isFinite(n) ? M.rp(n) : 0; };
  const major = (minor) => Math.round(minor / 100);
  const opt = (on, action, attrs, title, sub, right = '', disabled = false) => `<button class="opt ${on ? 'on' : ''}" data-a="${action}" ${attrs} ${disabled ? 'disabled' : ''}><span class="grow"><span class="t">${title}</span>${sub ? `<span class="s">${sub}</span>` : ''}</span>${right}</button>`;
  const toggle = (label, on, action, key, note) => `<div class="toggle"><span>${esc(label)}${note ? `<br><span class="small muted">${esc(note)}</span>` : ''}</span>${U.sw(action, key, on, label)}</div>`;
  const chipSel = (action, key, on, label) => `<button class="chip ${on ? 'on' : ''}" data-a="${action}" data-x="${key}" aria-pressed="${!!on}">${on ? ic('Check') + ' ' : ''}${esc(label)}</button>`;

  function eligibleJobs(d) { return E.startingJobsFor(d.character); }
  function fixDraft(d) {
    const jobs = eligibleJobs(d);
    if (d.startEmployed && !jobs.some((j) => j.id === d.startJobId)) d.startJobId = (jobs[0] || {}).id || null;
    if (!jobs.length) d.startEmployed = false;
    const opts = E.housingOptions(d.cityId, d.household);
    if (!opts.some((o) => o.id === d.housingId && o.fits !== false)) d.housingId = (opts.find((o) => o.fits !== false && o.type !== 'family') || opts[0]).id;
    if (!d.startEmployed || d.scenario === 'gross') { /* JKN must then be paid independently if wanted */ } else d.jknMandiri = false;
  }

  U.setupView = () => {
    const d = ui.draft, step = ui.step;
    const stepBar = step ? `<div class="steps" aria-label="${t('Langkah', 'Step')} ${step} / ${LAST}">${STEPS.slice(1).map((_, i) => `<i class="${i < step ? 'on' : ''}"></i>`).join('')}</div><div class="small muted">${t('Langkah', 'Step')} ${step}/${LAST} · ${T(STEPS[step])}</div>` : '';
    let body = '', canNext = true, nextLabel = t('Lanjut', 'Continue');
    if (step === 0) {
      const saved = U.loadSaved();
      body = `<div style="flex:1"></div><div class="small muted" style="font-family:var(--f-mono);letter-spacing:.08em">REAL LIFE SIMULATOR</div>
        <h2 style="font-size:44px">${t('Gajimu tetap. Pengeluaranmu tidak.', 'Your salary is fixed. Your expenses aren\'t.')}</h2>
        <p class="lede">${t('Jalani hidup dengan upah minimum 2026 di Indonesia. Bayar sewa, jaga listrik tetap menyala, masak atau beli makan, berangkat kerja, rawat diri, cari kerja, dan tentukan apa yang tersisa untukmu.', 'Live on a 2026 minimum wage in Indonesia. Pay rent, keep the lights on, cook or buy food, get to work, look after yourself, look for work, and decide what is left for you.')}</p>
        <p class="lede" style="font-family:var(--f-display);font-stretch:90%;font-weight:700;color:var(--ink);font-size:18px">${t('Mampu hidup layak, atau hanya bertahan?', 'Can you afford to live, or only afford to survive?')}</p>
        <div class="field"><span class="lab">${t('Bahasa', 'Language')}</span>${U.seg('lang-set', 'lang', I.lang, [['id', 'Bahasa Indonesia'], ['en', 'English']])}</div>
        ${saved ? opt(false, 'continue', '', t('Lanjutkan permainan tersimpan', 'Continue saved game'), `${t('Bulan', 'Month')} ${saved.monthIndex}, ${t('hari', 'day')} ${saved.date.day} · ${esc(E.getLocality(saved.config.cityId).city.name)} · ${fmt(saved.wallet)}${saved.migratedFrom ? ' · ' + t('dipindahkan dari versi lama', 'migrated from the old version') : ''}`, ic('ChevronRight')) : ''}`;
      nextLabel = t('Permainan baru', 'New game');
    } else if (step === 1) {
      body = `<h2>${t('Pilih negara', 'Choose a country')}</h2><p class="lede">${t('Tiap negara menetapkan upah minimum dengan cara berbeda. Baru Indonesia yang datanya dimuat di versi ini.', 'Each country sets its wage floor differently. Only Indonesia has data loaded in this version.')}</p>
        ${D.countries.map((c) => opt(d.countryId === c.id, 'd-country', `data-x="${c.id}"`, `${esc(c.name)} ${c.dataStatus === 'loaded' ? '' : `<span class="pill p-muted">${t('Belum dimuat', 'Not loaded yet')}</span>`}`, esc(c.wageSystem), '', c.dataStatus !== 'loaded').replace('<span class="grow">', `<span class="flag">${c.flagCode}</span><span class="grow">`)).join('')}`;
    } else if (step === 2) {
      const q = ui.provQ.toLowerCase();
      const list = D.indonesia.provinces.filter((p) => p.name.toLowerCase().includes(q) || E.citiesForProvince(p.id).some((c) => c.name.toLowerCase().includes(q)));
      body = `<h2>${t('Provinsi', 'Province')}</h2><p class="lede">${t('Ke-38 provinsi memakai UMP 2026. Cari provinsi atau kota.', 'All 38 provinces carry their 2026 UMP. Search a province or a city.')}</p>
        <div class="search">${ic('Search')}<input id="provq" type="search" placeholder="${t('mis. Banten, Bekasi, Papua', 'e.g. Banten, Bekasi, Papua')}" value="${esc(ui.provQ)}" data-in="provq" aria-label="${t('Cari provinsi', 'Search provinces')}"></div>
        ${list.map((p) => opt(d.provinceId === p.id, 'd-prov', `data-x="${p.id}"`, esc(p.name), `UMP ${fmt(M.toMinor(p.wage.amountMajor), { exact: true })} · ${E.citiesForProvince(p.id).filter((c) => c.wage).length} ${t('UMK dimuat', 'UMK loaded')}`, ic('ChevronRight'))).join('') || `<div class="empty">${t('Tidak ditemukan.', 'No match.')}</div>`}`;
      canNext = !!d.provinceId;
    } else if (step === 3) {
      const prov = D.indonesia.provinceById[d.provinceId];
      const list = E.citiesForProvince(d.provinceId);
      body = `<h2>${esc(prov.name)}</h2><p class="lede">${t('Pilih tempat kamu tinggal dan bekerja. UMK kota dipakai bila sudah dimuat; jika belum, UMP provinsi, dan game memberi tahu.', 'Pick where you live and work. A city\'s own UMK is used when loaded; otherwise the provincial UMP, and the game says so.')}</p>
        ${list.map((c) => opt(d.cityId === c.id, 'd-city', `data-x="${c.id}"`, esc(c.name), `${c.wage ? `UMK ${fmt(M.toMinor(c.wage.amountMajor), { exact: true })}` : prov.id === 'dki' ? `UMP ${fmt(M.toMinor(prov.wage.amountMajor))} (${t('Jakarta tanpa UMK', 'Jakarta has no UMK')})` : `${t('UMK belum dimuat · UMP', 'UMK not loaded · UMP')} ${fmt(M.toMinor(prov.wage.amountMajor))}`} · ${t('tingkat sewa', 'rent tier')} ${c.tier}`, c.wage || prov.id === 'dki' ? pill('VERIFIED') : `<span class="pill p-due">${t('Cadangan', 'Fallback')}</span>`)).join('')}`;
      canNext = !!d.cityId && E.getLocality(d.cityId) && E.getLocality(d.cityId).province.id === d.provinceId;
      if (canNext) {
        const w = E.resolveWage(d.cityId);
        body += `<div class="box"><b>${T(w.label)}: <span class="num">${fmt(w.amount, { exact: true })}</span></b><small class="muted">${t('Sumber', 'Source')}: ${srcLink(w.sourceId)} · ${t('berlaku', 'effective')} ${esc(w.effectiveFrom)}</small>${w.notes.map((n) => `<small class="muted">${T(n)}</small>`).join('')}</div>`;
      }
    } else if (step === 4) {
      const ch = d.character;
      body = `<h2>${t('Siapa kamu?', 'Who are you?')}</h2><p class="lede">${t('Pilihan ini memengaruhi lowongan, cara kerja, kebutuhan gizi, dan kebutuhan pribadi. Tidak ada pilihan yang "lebih benar".', 'These choices shape job options, how work goes, nutrition needs and personal needs. No option is the "right" one.')}</p>
        <div class="field"><label for="dage">${t('Usia', 'Age')}: <b>${ch.age} ${t('tahun', 'years')}</b></label><input id="dage" type="range" min="18" max="64" value="${ch.age}" data-in="dage"></div>
        <div class="field"><span class="lab">${t('Gender', 'Gender')}</span>${U.seg('d-char', 'gender', ch.gender, [['female', bi('Perempuan', 'Woman')], ['male', bi('Laki-laki', 'Man')], ['other', bi('Lainnya / tidak disebut', 'Other / prefer not to say')]])}</div>
        ${toggle(t('Mengalami siklus menstruasi', 'Has menstrual cycles'), ch.menstruates, 'd-char-t', 'menstruates', t('Memengaruhi kebutuhan pembalut dan hari-hari dengan nyeri haid.', 'Affects pad supplies and days with period pain.'))}
        <div class="field"><span class="lab">${t('Pendidikan terakhir', 'Highest education')}</span><div class="opts">${J.EDUCATION.map((e) => opt(ch.education === e.id, 'd-char', `data-k="education" data-x="${e.id}"`, T(e.label), '')).join('')}</div>
          <small class="muted">${t('Pendidikan lebih tinggi membuka lebih banyak lowongan, tapi tidak menjamin diterima. Untuk sebagian pekerjaan, pengalaman dan keahlian lebih menentukan.', 'More education opens more vacancies but never guarantees a job. For many roles, experience and skills matter more.')}</small></div>
        <div class="field"><label for="dexp">${t('Pengalaman kerja', 'Work experience')}: <b>${ch.experienceYears} ${t('tahun', 'years')}</b></label><input id="dexp" type="range" min="0" max="${Math.max(0, ch.age - 15)}" value="${Math.min(ch.experienceYears, ch.age - 15)}" data-in="dexp"></div>`;
    } else if (step === 5) {
      const ch = d.character;
      const jobs = eligibleJobs(d);
      body = `<h2>${t('Kemampuan', 'Skills')}</h2><p class="lede">${t('Lowongan di Appy punya syarat wajib dan syarat yang diutamakan. Kamu bisa menambah keahlian lewat kursus nanti.', 'Appy listings have mandatory and preferred requirements. You can add skills later through courses.')}</p>
        <div class="field"><span class="lab">${t('Keahlian', 'Skills')}</span><div class="chips">${J.SKILLS.map(([k, l]) => chipSel('d-skill', k, ch.skills.includes(k), L(l))).join('')}</div></div>
        <div class="field"><span class="lab">${t('Sertifikat', 'Certificates')}</span><div class="chips">${J.CERTS.map(([k, l]) => chipSel('d-cert', k, ch.certs.includes(k), L(l))).join('')}</div></div>
        <div class="field"><span class="lab">${t('Bahasa Inggris', 'English')}</span>${U.seg('d-char', 'english', ch.english, J.ENGLISH.map((e) => [e.id, e.label]))}</div>
        <div class="field"><label for="dlang">${t('Bahasa lain', 'Other language')}</label><select id="dlang" class="inp" data-in="dlang">${J.OTHER_LANG.map((o) => `<option value="${o.id}" ${ch.otherLang === o.id ? 'selected' : ''}>${T(o.label)}</option>`).join('')}</select>
          <small class="muted">${t('Dicatat di profil; belum ada lowongan di game ini yang mensyaratkannya.', 'Recorded on your profile; no listing in this game requires it yet.')}</small></div>
        <div class="field"><span class="lab">${t('Literasi digital', 'Digital literacy')}</span>${U.seg('d-char', 'digital', ch.digital, J.DIGITAL.map((e) => [e.id, bi(e.label.id.split(' (')[0], e.label.en.split(' (')[0])]))}
          <small class="muted">${T(J.digById[ch.digital].label)}</small></div>
        <div class="box"><span class="small">${t(`Pekerjaan awal yang bisa kamu mulai: <b>${jobs.length}</b> dari ${J.STARTING_JOBS.length}.`, `Starting jobs open to you: <b>${jobs.length}</b> of ${J.STARTING_JOBS.length}.`)}</span></div>`;
    } else if (step === 6) {
      fixDraft(d);
      const w = E.resolveWage(d.cityId);
      const pay = E.calculateNetIncome(w.amount, d.scenario);
      const edu = E.eduRank(d.character.education);
      body = `<h2>${t('Pekerjaan', 'Work')}</h2><p class="lede">${t('Pekerjaan awal dibayar sebesar upah minimum setempat. Kamu juga bisa mulai tanpa pekerjaan dan mencarinya di Appy.', 'Starting jobs pay exactly the local minimum wage. You can also start without a job and look for one in Appy.')}</p>
        ${toggle(t('Mulai dengan pekerjaan', 'Start with a job'), d.startEmployed, 'd-set-t', 'startEmployed')}`;
      if (d.startEmployed) {
        body += `<div class="opts">${J.STARTING_JOBS.map((j) => { const ok = edu >= j.minEdu; return opt(d.startJobId === j.id, 'd-set', `data-k="startJobId" data-x="${j.id}"`, T(j.title), `${T(J.KINDS[j.kind].label)} · ${T(J.EMP_TYPES[j.type].label)}${j.termMonths ? ` ${j.termMonths} ${t('bln', 'mo')}` : ''}${ok ? '' : ` · ${t('butuh pendidikan', 'needs')} ${T((J.EDUCATION.find((e) => e.rank >= j.minEdu) || {}).label)}`}`, '', !ok); }).join('')}</div>
          <div class="field"><label for="dten">${t('Sudah bekerja di sini', 'Already in this job for')}: <b>${d.tenureMonths} ${t('bulan', 'months')}</b></label><input id="dten" type="range" min="0" max="36" value="${d.tenureMonths}" data-in="dten"><small class="muted">${t('Memengaruhi cuti tahunan, saldo JHT, syarat pinjaman, dan kelayakan JKP.', 'Affects annual leave, JHT balance, loan eligibility and JKP.')}</small></div>
          ${opt(d.scenario === 'formal', 'd-set', 'data-k="scenario" data-x="formal"', t('Karyawan formal', 'Formal employee'), t(`Gaji dipotong BPJS (4%) dan PPh 21 bila berlaku. Bersih ${fmt(pay.net)}. JKN lewat kantor.`, `Payroll deducts BPJS (4%) and PPh 21 where it applies. Take-home ${fmt(E.calculateNetIncome(w.amount, 'formal').net)}. JKN through work.`))}
          ${opt(d.scenario === 'gross', 'd-set', 'data-k="scenario" data-x="gross"', t('Tanpa potongan gaji', 'No payroll deductions'), t(`Dibayar penuh ${fmt(w.amount)}, tanpa JKN/BPJS TK dari kantor. Mirip pekerjaan informal.`, `Paid the full ${fmt(w.amount)}, no JKN/BPJS TK through work. Closer to informal work.`))}
          ${d.scenario === 'formal' ? `<div class="field"><span class="lab">${t('Gaji yang masuk dompet', 'Salary paid into your wallet')}</span>${U.seg('d-set', 'wageTreatment', d.wageTreatment, [['net', bi(`Bersih ${short(pay.net)}`, `Net ${short(pay.net)}`)], ['gross', bi(`Bruto ${short(pay.gross)}`, `Gross ${short(pay.gross)}`)]])}</div>` : ''}`;
      } else body += `<div class="box"><span class="small">${t('Tanpa gaji di tanggal 1. Kamu mulai dengan tabungan dan penghasilan rumah tangga (jika ada). Lowongan dan kerja harian ada di Appy.', 'No salary on the 1st. You start with your savings and any household income. Vacancies and day gigs are in Appy.')}</span></div>`;
      body += `<div class="field"><span class="lab">${t('Hari kerja per minggu', 'Work week')}</span>${U.seg('d-set', 'workweek', d.workweek, [[5, bi('5 hari × 8 jam', '5 days × 8 h')], [6, bi('6 hari × 7 jam', '6 days × 7 h')]])}</div>
        <div class="field"><label for="ddist">${t('Jarak rumah ke tempat kerja', 'Distance from home to work')}: <b>${d.distanceKm} km</b></label><input id="ddist" type="range" min="1" max="45" value="${d.distanceKm}" data-in="ddist"></div>`;
    } else if (step === 7) {
      const h = d.household;
      const wage = E.resolveWage(d.cityId).amount;
      body = `<h2>${t('Rumah tangga', 'Household')}</h2><p class="lede">${t('Keluarga mengubah jumlah porsi makan, ruang yang dibutuhkan, tagihan, dan siapa yang bisa membantu di rumah. Biaya anak di game ini ilustratif.', 'Family changes meal portions, space needed, bills and who can help at home. Child costs in this game are illustrative.')}</p>
        ${toggle(t('Tinggal bersama pasangan', 'Living with a partner'), h.partner, 'd-hh-t', 'partner')}`;
      if (h.partner) {
        body += toggle(t('Pasangan bekerja', 'Partner has an income'), h.partnerWorks, 'd-hh-t', 'partnerWorks');
        if (h.partnerWorks) body += `<div class="field"><label for="dpinc">${t('Penghasilan pasangan per bulan (Rp)', 'Partner\'s monthly income (Rp)')}</label><input id="dpinc" class="inp num" inputmode="numeric" value="${major(h.partnerIncome || wage)}" data-in="dpinc"></div>
          ${toggle(t('Penghasilan digabung di dompet bersama', 'Incomes pooled in a shared wallet'), h.sharedIncome, 'd-hh-t', 'sharedIncome', t('Jika tidak, pasangan memberi kontribusi tetap.', 'If not, your partner hands over a fixed contribution.'))}
          ${h.sharedIncome ? '' : `<div class="field"><label for="dpcon">${t('Kontribusi pasangan per bulan (Rp)', 'Partner\'s monthly contribution (Rp)')}</label><input id="dpcon" class="inp num" inputmode="numeric" value="${major(h.partnerContribution)}" data-in="dpcon"></div>`}`;
        else body += `<small class="muted">${t('Pasangan tanpa penghasilan tetap bisa membantu memasak saat kamu sakit atau lelah.', 'A partner without an income can still help cook when you are ill or tired.')}</small>`;
      }
      body += `<div class="section-t">${t('Anak', 'Children')} (${h.children.length}/2)</div>
        ${h.children.map((k, i) => `<div class="box outline"><div class="field"><label for="dkid${i}">${t('Anak', 'Child')} ${i + 1}: <b>${k.age} ${t('tahun', 'years')}</b> · ${k.age < 2 ? t('bayi (popok, susu)', 'infant (diapers, formula)') : k.age < 6 ? t('balita', 'young child') : t('usia sekolah', 'school age')}</label><input id="dkid${i}" type="range" min="0" max="17" value="${k.age}" data-in="dkid" data-i="${i}"></div><button class="btn ghost sm" data-a="d-kid-del" data-x="${i}">${t('Hapus', 'Remove')}</button></div>`).join('')}
        ${h.children.length < 2 ? `<button class="btn sec sm" data-a="d-kid-add">${ic('Plus')} ${t('Tambah anak', 'Add a child')}</button>` : ''}
        ${h.children.some((k) => k.age < 6) ? `<div class="field"><span class="lab">${t('Pengasuhan anak kecil', 'Care for young children')}</span>${U.seg('d-hh', 'childcare', h.childcare, [['family', bi('Dibantu keluarga', 'Family helps')], ['daycare', bi('Tempat penitipan', 'Daycare')]])}</div>` : ''}
        <div class="field"><label for="dpar">${t('Kirim uang ke orang tua tiap bulan', 'Money sent to your parents each month')}: <b>${fmt(h.supportParents)}</b></label><input id="dpar" type="range" min="0" max="1500000" step="50000" value="${major(h.supportParents)}" data-in="dpar"></div>`;
    } else if (step === 8) {
      fixDraft(d);
      const opts = E.housingOptions(d.cityId, d.household);
      const h = E.getHousing(d.cityId, d.housingId);
      const mem = E.members({ household: d.household });
      body = `<h2>${t('Tempat tinggal', 'Where you live')}</h2><p class="lede">${t(`Tingkat sewa ${E.getLocality(d.cityId).city.tier}. Rumah tangga ${mem.people} orang. Kamu bisa pindah nanti lewat HomeBase.`, `Rent tier ${E.getLocality(d.cityId).city.tier}. Household of ${mem.people}. You can move later in HomeBase.`)}</p>
        ${opts.map((o) => opt(d.housingId === o.id, 'd-set', `data-k="housingId" data-x="${o.id}"`, `${T(o.label)} <span class="small muted">${o.tier !== 'family' ? L({ budget: bi('hemat', 'budget'), typical: bi('biasa', 'typical'), premium: bi('premium', 'premium') }[o.tier]) : ''}</span>`,
          `${o.type === 'family' ? t('Kontribusimu, kamu tentukan', 'Your contribution, you choose') : fmt(o.monthlyRent) + t('/bulan', '/month')} · ${['electricity', 'water', 'internet'].filter((k) => o.includes[k]).map((k) => L({ electricity: bi('listrik', 'power'), water: bi('air', 'water'), internet: bi('Wi-Fi', 'Wi-Fi') }[k])).join(', ') || t('tanpa utilitas', 'no utilities')} ${t('termasuk', 'included')}${o.deposit ? ' · deposit ' + fmt(o.deposit) : ''}${o.fits === false ? ' · ' + t('terlalu kecil untuk rumah tanggamu', 'too small for your household') : ''}`, pill(o.status), o.fits === false)).join('')}
        ${h.type === 'family' ? `<div class="field"><label for="dfam">${t('Kontribusi bulanan untuk rumah', 'Monthly contribution to the household')}: <b>${fmt(d.familyContribution)}</b></label><input id="dfam" type="range" min="0" max="2000000" step="50000" value="${major(d.familyContribution)}" data-in="dfam"><small class="muted">${t('Keluarga menyiapkan makan malam. Kamu tetap mengurus sarapan dan makan siang.', 'Family cooks dinner. You still sort out breakfast and lunch.')}</small></div>` : ''}
        ${h.deposit ? toggle(t('Deposit sudah dibayar sebelum game', 'Deposit already paid before the game'), d.depositPaid, 'd-set-t', 'depositPaid', t(`Jika tidak, deposit ${fmt(h.deposit)} ditagih hari pertama.`, `If not, the ${fmt(h.deposit)} deposit is charged on day 1.`)) : ''}
        <div class="section-t">${t('Barang yang sudah kamu punya', 'Things you already own')}</div>
        ${h.fridge ? `<small class="muted">${t('Tempat ini sudah ada kulkasnya.', 'This place comes with a fridge.')}</small>` : toggle(t('Kulkas kecil', 'Small fridge'), d.ownsFridge, 'd-set-t', 'ownsFridge', t('Makanan segar lebih awet; menambah ±30 kWh/bulan.', 'Fresh food keeps longer; adds about 30 kWh a month.'))}
        ${toggle(t('Rice cooker', 'Rice cooker'), d.ownsRiceCooker, 'd-set-t', 'ownsRiceCooker', t('Masak nasi/bubur tanpa gas.', 'Cook rice and porridge without gas.'))}
        ${toggle(t('Kipas angin', 'Fan'), d.ownsFan, 'd-set-t', 'ownsFan')}`;
    } else if (step === 9) {
      const p = d.passport;
      const noWorkJkn = !d.startEmployed || d.scenario === 'gross';
      body = `<h2>${t('Uang & dokumen', 'Money & papers')}</h2><p class="lede">${t('Tabungan yang sudah ada masuk FutureMe. Dokumen dasar (KTP, KK, akta, ijazah) dianggap sudah kamu punya.', 'Existing savings go into FutureMe. Basic papers (ID card, family card, birth certificate, diplomas) are assumed to be held.')}</p>
        <div class="field"><label for="dsav">${t('Tabungan yang sudah ada (Rp)', 'Existing savings (Rp)')}</label><input id="dsav" class="inp num" inputmode="numeric" value="${major(d.startingSavings)}" data-in="dsav">
          <div class="chips">${[0, 500000, 2000000, 5000000].map((v) => `<button class="chip ${d.startingSavings === M.rp(v) ? 'on' : ''}" data-a="d-sav" data-x="${v}">${short(M.rp(v))}</button>`).join('')}</div></div>
        ${toggle(t('Sudah punya paspor', 'Already have a passport'), p.has, 'd-pass-t', 'has')}
        ${p.has ? `<div class="field"><span class="lab">${t('Jenis paspor', 'Passport type')}</span>${U.seg('d-pass', 'type', p.type, D.travel.PASSPORT_TYPES.map((x) => [x.id, x.name]))}</div>
          <div class="field"><label for="dpy">${t('Sisa masa berlaku', 'Validity left')}: <b>${p.yearsLeft} ${t('tahun', 'years')}</b>${p.yearsLeft === 0 ? ' · ' + t('sudah habis', 'expired') : ''}</label><input id="dpy" type="range" min="0" max="${(D.travel.PASSPORT_TYPES.find((x) => x.id === p.type) || { years: 10 }).years}" value="${p.yearsLeft}" data-in="dpy"></div>` : ''}
        ${noWorkJkn ? toggle(t('Bayar BPJS Kesehatan mandiri (kelas 3)', 'Pay BPJS Kesehatan independently (class 3)'), d.jknMandiri, 'd-set-t', 'jknMandiri', t(`Rp35.000/orang/bulan. Tanpa JKN, berobat harus bayar sendiri.`, 'Rp35,000 per person per month. Without JKN, healthcare is out of pocket.')) : `<small class="muted">${t('JKN ditanggung lewat potongan gaji.', 'JKN is covered through payroll.')}</small>`}`;
    } else if (step === 10) {
      body = `<h2>${t('Seberapa bergelombang?', 'How bumpy?')}</h2><p class="lede">${t('Kejutan muncul di beberapa hari: undangan, barang rusak, permintaan keluarga, tawaran lembur.', 'Surprises happen on some days: invitations, breakdowns, family requests, overtime offers.')}</p>
        ${[['calm', bi('Tenang', 'Calm'), bi('Sekitar satu kejutan per minggu', 'About one surprise a week')], ['normal', bi('Normal', 'Normal'), bi('Sekitar satu tiap 4–5 hari', 'About one every four or five days')], ['chaotic', bi('Kacau', 'Chaotic'), bi('Lebih dari satu per minggu', 'More than one a week')]].map(([k, l, s]) => opt(d.difficulty === k, 'd-set', `data-k="difficulty" data-x="${k}"`, T(l), T(s))).join('')}
        <div class="field"><label for="dseed">${t('Seed (seed + pilihan yang sama = bulan yang sama)', 'Seed (same seed + same choices = same month)')}</label><input id="dseed" class="inp num" inputmode="numeric" placeholder="${t('Acak', 'Random')}" value="${esc(ui.seed)}" data-in="dseed"></div>
        <div class="field"><label for="dpadj">${t('Penyesuaian harga lokal', 'Local price adjustment')}: <b>${d.priceAdjustBp >= 0 ? '+' : ''}${d.priceAdjustBp / 100}%</b></label><input id="dpadj" type="range" min="-20" max="60" step="5" value="${d.priceAdjustBp / 100}" data-in="dpadj"><small class="muted">${t('Harga toko memakai rata-rata nasional. Naikkan untuk daerah yang lebih mahal, seperti banyak wilayah Indonesia timur.', 'Store prices are national averages. Raise this for places where food costs more, such as much of eastern Indonesia.')}</small></div>`;
    } else {
      fixDraft(d);
      const seed = seedFrom(ui.seed) || 12345;
      let pv = null;
      try { pv = E.createGame(JSON.parse(JSON.stringify(d)), seed); } catch (e) { pv = null; }
      const { city, province } = E.getLocality(d.cityId);
      const w = E.resolveWage(d.cityId);
      const ch = d.character;
      const h = E.getHousing(d.cityId, d.housingId);
      const bills = pv ? E.billsThisMonth(pv).reduce((s, b) => s + b.amount, 0) : 0;
      body = `<h2>${t('Siap memulai', 'Ready to start')}</h2><div class="receipt">
        <div class="kv"><span>${t('Tempat', 'Place')}</span><span>${esc(city.name)}, ${esc(province.name)}</span></div>
        <div class="kv"><span>${T(w.label)}</span><span>${fmt(w.amount, { exact: true })}</span></div>
        <div class="kv"><span>${t('Karakter', 'Character')}</span><span>${ch.age} ${t('th', 'y')} · ${T(J.eduById[ch.education].label)} · ${ch.experienceYears} ${t('th pengalaman', 'y experience')}</span></div>
        <div class="kv"><span>${t('Pekerjaan', 'Job')}</span><span>${pv && pv.job ? `${T(pv.job.title)}<br><span class="small">${T(pv.job.company)}</span>` : t('Belum bekerja', 'Not working')}</span></div>
        <div class="kv"><span>${t('Rumah tangga', 'Household')}</span><span>${E.members({ household: d.household }).people} ${t('orang', 'people')}</span></div>
        <div class="kv"><span>${T(h.label)}</span><span>${h.type === 'family' ? fmt(d.familyContribution) : fmt(h.monthlyRent)}${t('/bln', '/mo')}</span></div><hr>
        <div class="kv tot"><span>${t('Saldo hari pertama', 'Balance on day 1')}</span><span>${pv ? fmt(pv.wallet) : '—'}</span></div>
        <div class="kv"><span>${t('Tabungan', 'Savings')}</span><span>${fmt(d.startingSavings)}</span></div>
        <div class="kv"><span>${t('Tagihan bulan ini', 'Bills this month')}</span><span>${fmt(bills)}</span></div>
        <div class="kv"><span>${t('Paspor', 'Passport')}</span><span>${d.passport.has ? (d.passport.yearsLeft > 0 ? t(`berlaku ${d.passport.yearsLeft} th`, `valid ${d.passport.yearsLeft} y`) : t('kedaluwarsa', 'expired')) : t('belum punya', 'none')}</span></div>
        <div class="kv"><span>${t('Kejutan', 'Surprises')}</span><span>${esc(d.difficulty)}</span></div></div>
        <small class="muted">${pill(w.verificationStatus)} ${t('upah dari', 'wage from')} ${srcLink(w.sourceId)}. ${t('Upah minimum adalah batas bawah hukum, bukan yang dibawa pulang setiap pekerja. Semua perusahaan, toko, aplikasi dan pemberi pinjaman di game ini fiktif.', 'A minimum wage is a legal floor, not what every worker takes home. Every company, shop, app and lender in this game is fictional.')}</small>`;
      nextLabel = t('Mulai bulan ini', 'Start the month');
    }
    return `${U.setupStatus()}
      <div class="view"><div class="setup" data-scroll="setup:${step}">${stepBar}${body}</div>
      <div class="setup-foot">${step > 0 ? `<button class="btn sec" data-a="s-back">${t('Kembali', 'Back')}</button>` : ''}<button class="btn" data-a="s-next" ${canNext ? '' : 'disabled'}>${nextLabel}</button></div></div>
      <div class="homebar"><button aria-hidden="true" tabindex="-1"></button></div>${ui.toast ? `<div class="toast ${ui.toast.bad ? 'bad' : ''}" role="status">${esc(ui.toast.msg)}</div>` : ''}`;
  };
  U.setupStatus = () => `<div class="status"><span id="clock">--:--</span><span class="notch" aria-hidden="true"></span><span class="right">${U.langChip(false)}${ic('Signal')}<span class="batt"><b><i style="width:90%"></i></b></span></span></div>`;

  function seedFrom(s) { if (!s) return 0; const n = Number(String(s).replace(/\D/g, '')); return n ? n >>> 0 : E.hashSeed(s); }

  const d = () => ui.draft;
  Object.assign(U.A, {
    's-next'() {
      if (ui.step === LAST) {
        fixDraft(d());
        const seed = seedFrom(ui.seed) || ((Math.random() * 2 ** 31) >>> 0);
        U.G = E.createGame(JSON.parse(JSON.stringify(d())), seed);
        ui.screen = 'phone'; ui.app = null; ui.carts = {}; ui.store = {}; ui.recent = []; ui.sub = {};
        ui.compare.a = U.G.config.cityId;
        U.after(0);
        ui.banner = (U.G.notifications.find((n) => n.tone === 'pay') || {}).id || null;
        return;
      }
      if (ui.step === 4 || ui.step === 5 || ui.step === 7) fixDraft(d());
      ui.step++;
    },
    's-back'() { ui.step = Math.max(0, ui.step - 1); },
    continue() { const s = U.loadSaved(); if (s) { U.G = s; ui.screen = 'phone'; ui.app = null; ui.compare.a = s.config.cityId; U.save(); } else U.toast(t('Simpanan tidak bisa dibaca.', 'The save could not be read.'), true); },
    'lang-set'(el) { U.setLang(el.dataset.x); },
    'd-country'(el) { d().countryId = el.dataset.x; },
    'd-prov'(el) { d().provinceId = el.dataset.x; const first = E.citiesForProvince(el.dataset.x)[0]; d().cityId = first ? first.id : null; ui.step = 3; },
    'd-city'(el) { d().cityId = el.dataset.x; },
    'd-set'(el) { let v = el.dataset.x; if (el.dataset.k === 'workweek') v = Number(v); d()[el.dataset.k] = v; if (el.dataset.k === 'scenario') d().wageTreatment = v === 'gross' ? 'gross' : 'net'; },
    'd-set-t'(el) { d()[el.dataset.x] = !d()[el.dataset.x]; },
    'd-char'(el) { const ch = d().character; ch[el.dataset.k] = el.dataset.x; if (el.dataset.k === 'gender') ch.menstruates = el.dataset.x === 'female' ? true : el.dataset.x === 'male' ? false : ch.menstruates; },
    'd-char-t'(el) { const ch = d().character; ch[el.dataset.x] = !ch[el.dataset.x]; },
    'd-skill'(el) { const s = d().character.skills; const i = s.indexOf(el.dataset.x); if (i >= 0) s.splice(i, 1); else s.push(el.dataset.x); },
    'd-cert'(el) { const s = d().character.certs; const i = s.indexOf(el.dataset.x); if (i >= 0) s.splice(i, 1); else s.push(el.dataset.x); },
    'd-hh'(el) { d().household[el.dataset.k] = el.dataset.x; },
    'd-hh-t'(el) { const h = d().household; h[el.dataset.x] = !h[el.dataset.x]; if (el.dataset.x === 'partnerWorks' && h.partnerWorks && !h.partnerIncome) h.partnerIncome = E.resolveWage(d().cityId).amount; },
    'd-kid-add'() { const h = d().household; if (h.children.length < 2) h.children.push({ age: 4 }); },
    'd-kid-del'(el) { d().household.children.splice(Number(el.dataset.x), 1); },
    'd-pass'(el) { const p = d().passport; p[el.dataset.k] = el.dataset.x; const max = (D.travel.PASSPORT_TYPES.find((x) => x.id === p.type) || { years: 10 }).years; p.yearsLeft = Math.min(p.yearsLeft, max); },
    'd-pass-t'(el) { const p = d().passport; p[el.dataset.x] = !p[el.dataset.x]; },
    'd-sav'(el) { d().startingSavings = M.rp(Number(el.dataset.x)); },
  });
  Object.assign(U.IN, {
    provq(el) { ui.provQ = el.value; },
    ddist(el) { d().distanceKm = Number(el.value); },
    dfam(el) { d().familyContribution = M.rp(Number(el.value)); },
    dseed(el) { ui.seed = el.value; },
    dpadj(el) { d().priceAdjustBp = Number(el.value) * 100; },
    dage(el) { const ch = d().character; ch.age = Number(el.value); ch.experienceYears = Math.min(ch.experienceYears, Math.max(0, ch.age - 15)); },
    dexp(el) { d().character.experienceYears = Number(el.value); },
    dten(el) { d().tenureMonths = Number(el.value); },
    dlang(el) { d().character.otherLang = el.value; },
    dpinc(el) { d().household.partnerIncome = money(el.value); },
    dpcon(el) { d().household.partnerContribution = money(el.value); },
    dpar(el) { d().household.supportParents = M.rp(Number(el.value)); },
    dkid(el) { d().household.children[Number(el.dataset.i)].age = Number(el.value); },
    dsav(el) { d().startingSavings = money(el.value); },
    dpy(el) { d().passport.yearsLeft = Number(el.value); },
  });
  ['provq', 'dseed', 'dpinc', 'dpcon', 'dsav'].forEach((k) => U.LIVE.add(k));
  U.money = money;
})(typeof globalThis !== 'undefined' ? globalThis : this);
