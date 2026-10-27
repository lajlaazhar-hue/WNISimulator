/*
 * ui/apps-work.js — Workday (job, payslip, leave, performance, benefits) and Appy (job market).
 */
(function (root) {
  const RLS = root.RLS;
  const E = RLS.engine, M = RLS.money, D = RLS.data, I = RLS.i18n, U = RLS.U;
  const { esc, T, t, L, ic, pill, fmt, short, srcLink } = U;
  const ui = U.ui;
  const bi = I.bi;
  const G = () => U.G;
  const J = D.jobs;
  const EMP = { employed: bi('Bekerja', 'Employed'), notice: bi('Masa pemberitahuan', 'Serving notice'), unemployed: bi('Tidak bekerja', 'Not working') };

  // ── Workday ─────────────────────────────────────────────────────────
  U.apps.workday = () => {
    const g = G();
    const tab = U.sub('workday', 'tab', 'today');
    const job = g.job, emp = g.employment;
    let body = '';
    if (tab === 'today') {
      if (job) {
        const kind = J.KINDS[job.kind];
        body += `<div class="hero" style="background:#33505a;color:#fff"><span class="lbl">${T(job.company)}</span><span style="font-family:var(--f-display);font-weight:800;font-stretch:85%;font-size:24px">${T(job.title)}</span>
          <div class="split"><span>${t('Gaji pokok', 'Base wage')}<b>${fmt(job.wage)}</b></span><span>${t('Status', 'Status')}<b>${T(EMP[emp.status])}</b></span><span>${t('Cuti tersisa', 'Leave left')}<b>${emp.leaveBalance} ${t('hari', 'days')}</b></span></div></div>
          <div class="box"><div class="kv"><span>${t('Jenis kontrak', 'Contract')}</span><span>${T(J.EMP_TYPES[job.type].label)}</span></div>
          ${job.endAbs ? `<div class="kv"><span>${t('Kontrak berakhir', 'Contract ends')}</span><span>${esc(E.absLabel(job.endAbs, true))}</span></div>` : ''}
          <div class="kv"><span>${t('Jenis kerja', 'Kind of work')}</span><span>${T(kind.label)}</span></div><div class="kv"><span>${t('Lokasi', 'Location')}</span><span>${job.arrangement === 'remote' ? t('jarak jauh', 'remote') : job.arrangement === 'hybrid' ? t('hibrida', 'hybrid') : `${job.distanceKm} km`}</span></div>
          <div class="kv"><span>${t('Masa kerja', 'Tenure')}</span><span>${Math.max(0, Math.round((E.today(g) - job.startAbs) / 30.4))} ${t('bulan', 'months')}</span></div>
          ${job.reducedHours ? `<div class="kv"><span>${t('Pengurangan jam', 'Reduced hours')}</span><span>−${Math.round(job.reducedHours.pct * 100)}% · ${job.reducedHours.months} ${t('bln', 'mo')}</span></div>` : ''}
          ${emp.sp ? `<div class="kv"><span>${t('Surat peringatan', 'Warning letters')}</span><span style="color:var(--coral)">SP${emp.sp}</span></div>` : ''}</div>`;
        if (emp.status === 'notice') {
          const sev = emp.severance || { amount: 0, lines: [] };
          body += `<div class="box danger"><b>${emp.resigning ? t('Kamu mengundurkan diri', 'You are resigning') : t('Pemberitahuan pemutusan kerja', 'Termination notice')}</b>
            ${emp.reason && E.REASONS[emp.reason] ? `<small>${T(E.REASONS[emp.reason])}</small>` : ''}
            <div class="kv"><span>${t('Hari kerja terakhir', 'Last working day')}</span><span>${esc(E.absLabel(emp.lastDayAbs, true))}</span></div>
            <div class="kv"><span>${t('Perkiraan pesangon/kompensasi', 'Estimated severance/compensation')}</span><span class="num">${fmt(sev.amount)}</span></div>${sev.lines.map((x) => `<small class="muted">${T(x)}</small>`).join('')}
            <div class="kv"><span>${t('Saldo JHT', 'JHT balance')}</span><span class="num">${fmt(g.benefits.jht)}</span></div><div class="kv"><span>JKP</span><span>${emp.jkpEligible ? t('kemungkinan memenuhi syarat', 'likely eligible') : t('belum memenuhi syarat', 'not eligible')}</span></div>
            <div class="kv"><span>${t('Uangmu cukup ±', 'Your money lasts about')}</span><span>${Math.max(0, E.runwayDays(g))} ${t('hari', 'days')}</span></div>
            <small class="muted">${pill('ESTIMATED')} ${t('Perhitungan disederhanakan; hak sebenarnya tergantung kontrak dan alasan PHK. Gaji berhenti setelah hari terakhir; utang dan tagihan tetap berjalan.', 'Simplified; real entitlements depend on the contract and the reason. Salary stops after the last day; debts and bills continue.')} ${srcLink('labour_rules')}</small>
            <button class="btn sm" data-a="open" data-x="appy">${t('Cari kerja di Appy', 'Look for work in Appy')}</button></div>`;
        }
        const working = E.isScheduledToWork(g);
        body += `<div class="section-t">${t('Hari ini', 'Today')}</div><div class="box outline"><div class="kv"><span>${t('Jadwal', 'Schedule')}</span><span>${esc(U.dayStatus(g))}</span></div>
          ${working && !g.day.leave ? `<div class="row" style="gap:6px;flex-wrap:wrap">${emp.leaveBalance > 0 ? `<button class="btn sm sec" data-a="leave" data-x="annual">${t('Ambil cuti (1 hari)', 'Take a day of leave')}</button>` : ''}<button class="btn sm sec" data-a="leave" data-x="unpaid">${t('Izin tanpa upah', 'Unpaid day off')}</button><button class="btn sm sec" data-a="sick-leave">${t('Izin sakit', 'Call in sick')}</button></div>
          <small class="muted">${t('Izin memberi 3 waktu luang hari ini: untuk mengurus dokumen, wawancara, atau istirahat. Izin sakit dibayar bila ada surat dokter (karyawan formal).', 'Time off gives you 3 free slots today: for paperwork, interviews or rest. Sick leave is paid with a doctor\'s note (formal employees).')}</small>` : ''}</div>`;
      } else {
        body += `<div class="box"><b>${t('Kamu sedang tidak bekerja', 'You are not working right now')}</b><small>${t(`Sejak ${E.absLabel(emp.since, true)}. Tidak ada gaji di tanggal 1. Tagihan dan cicilan tetap berjalan.`, `Since ${E.absLabel(emp.since, true)}. No salary on the 1st. Bills and instalments continue.`)}</small>
          <div class="kv"><span>${t('Uangmu cukup ±', 'Your money lasts about')}</span><span>${Math.max(0, E.runwayDays(g))} ${t('hari', 'days')}</span></div>
          ${g.pendingJob ? `<div class="kv"><span>${t('Pekerjaan baru mulai', 'New job starts')}</span><span>${esc(E.absLabel(g.pendingJob.startAbs, true))}</span></div>` : ''}
          <button class="btn sm" data-a="open" data-x="appy">${t('Buka Appy', 'Open Appy')}</button></div>`;
      }
      if (emp.history.length) body += `<div class="section-t">${t('Riwayat kerja', 'Work history')}</div><div class="list">${emp.history.map((h) => `<div class="li row"><span class="grow"><span class="t">${T(h.title)}</span><span class="s">${T(h.company)} · ${esc(E.absLabel(h.startAbs))} – ${esc(E.absLabel(h.endAbs))}${h.reason && E.REASONS[h.reason] ? ' · ' + T(E.REASONS[h.reason]) : ''}</span></span></div>`).join('')}</div>`;
    } else if (tab === 'pay') {
      const w = E.resolveWage(g.config.cityId);
      const gross = job ? job.wage : w.amount;
      const pay = E.calculateNetIncome(gross, g.config.scenario);
      const s = U.src(w.sourceId);
      body += `<div class="receipt"><div style="text-align:center;font-weight:700;letter-spacing:.1em">${t('SLIP GAJI', 'PAYSLIP')} · ${esc(I.month(g.date.month).toUpperCase())} ${g.date.year}</div><hr>
        <div class="kv"><span>${t('Acuan upah', 'Wage reference')}</span><span>${T(w.label)}</span></div><div class="kv"><span>${t('Upah minimum', 'Minimum wage')}</span><span>${fmt(w.amount, { exact: true })}</span></div>
        <div class="kv"><span>${t('Gaji bruto', 'Gross wage')}</span><span>${fmt(gross, { exact: true })}</span></div>
        ${pay.items.map((i) => `<div class="kv"><span>${T(i.label)}${i.rateBp != null ? ` (${(i.rateBp / 100).toLocaleString(I.lang === 'en' ? 'en-US' : 'id-ID')}%)` : ''}</span><span>${fmt(-i.amount)}</span></div>`).join('')}<hr>
        <div class="kv tot"><span>${t('Gaji bersih', 'Net pay')}</span><span>${fmt(pay.net)}</span></div><div class="kv"><span>${t('Masuk dompet', 'Paid into wallet')}</span><span>${g.config.wageTreatment === 'gross' ? t('Jumlah bruto', 'Gross amount') : t('Jumlah bersih', 'Net amount')}</span></div>
        <div class="kv"><span>${t('Gajian', 'Payday')}</span><span>${job && job.type === 'harian' ? t('Upah harian tiap hari kerja', 'Daily wage each workday') : t('Tanggal 1 tiap bulan', 'Day 1 of each month')}</span></div></div>
        <div class="box"><div class="row"><span class="grow"><span class="t">${t('Sumber', 'Source')}</span><span class="s">${s ? `${srcLink(w.sourceId)}: ${esc(s.title)} (${esc(s.published)})` : '—'}</span></span>${pill(w.verificationStatus)}</div>
        ${w.notes.map((n) => `<small class="muted">${T(n)}</small>`).join('')}
        <small class="muted">${t('Upah minimum berlaku untuk pekerja dengan masa kerja di bawah satu tahun. Banyak orang dibayar lebih, dan pekerja informal sering dibayar kurang.', 'Minimum wages apply to workers with under one year of service. Many people earn more, and informal workers often earn less.')}</small></div>
        <div class="section-t">${t('Rincian potongan', 'Deduction details')}</div><div class="list">${pay.items.map((i) => `<div class="li"><div class="row"><span class="grow"><span class="t">${T(i.label)}</span><span class="s">${i.note ? T(i.note) + ' · ' : ''}${srcLink(i.sourceId)}</span></span>${pill(i.status)}</div></div>`).join('') || `<div class="empty">${t('Tidak ada potongan di skenario ini.', 'No payroll deductions in this scenario.')}</div>`}</div>
        <div class="box"><small>${t(`Lembur: upah sejam = gaji ÷ 173. Jam pertama 1,5×, berikutnya 2×. Tiga jam lembur dengan gajimu = <b class="num">${fmt(E.overtimePay(gross, 3))}</b>.`, `Overtime: hourly wage = monthly ÷ 173. First hour 1.5×, later hours 2×. Three hours at your wage = <b class="num">${fmt(E.overtimePay(gross, 3))}</b>.`)}</small></div>`;
    } else if (tab === 'perf') {
      const p = g.perf;
      const days = p.days.filter((x) => !x.leave).slice(-10).reverse();
      const issues = job ? E.compliance(g) : [];
      body += `<div class="box"><div class="kv"><span>${t('Kualitas kerja aktual (10 hari)', 'Actual work quality (10 days)')}</span><span><b>${p.avg}</b>/100</span></div>${U.bar(p.avg)}
        <small class="muted">${t('Kualitas aktual dihitung dari fokus (tidur, stres, gizi, kesehatan, energi), motivasi dan kecocokan keahlian. Terlambat dan aturan kerja yang tidak terpenuhi menurunkannya.', 'Actual quality comes from focus (sleep, stress, nutrition, health, energy), motivation and skill fit. Lateness and unmet work rules lower it.')}</small></div>
        <div class="section-t">${t('Penilaian mingguan', 'Weekly reviews')}</div><div class="list">${p.weeks.map((w) => `<div class="li"><div class="row"><span class="pill p-muted">${esc(E.absLabel(w.abs))}</span><span class="grow"><span class="t">${t('Atasan', 'Supervisor')}: ${T(w.label)} (${w.manager})</span><span class="s">${t('Aktual', 'Actual')} ${w.actual} · ${t('terlambat', 'late')} ${w.lateN}× · ${t('aturan kerja', 'work rules')} ${w.issueN}×</span></span></div></div>`).join('') || `<div class="empty">${t('Belum ada penilaian. Penilaian keluar tiap akhir minggu kerja.', 'No reviews yet. They come at the end of each work week.')}</div>`}</div>
        <small class="muted">${t('Penilaian atasan bersifat subjektif dan bisa berbeda dari kualitas kerja aktualmu. Dua minggu berturut-turut di bawah 45 berujung surat peringatan (SP1–SP3); setelah SP3, pemutusan kerja.', 'Supervisor ratings are subjective and can differ from your actual quality. Two weeks in a row below 45 lead to a warning letter (SP1–SP3); after SP3, termination.')}</small>
        <div class="section-t">${t('Syarat objektif hari ini', 'Objective requirements today')}</div><div class="box outline">${job ? (issues.length ? issues.map((i) => `<div class="req no">${ic('X')}<span>${T(i)}</span></div>`).join('') : `<div class="req ok">${ic('Check')}<span>${t('Pakaian, sepatu dan kebersihan sesuai aturan', 'Clothing, shoes and hygiene meet the rules')}</span></div>`) : '—'}</div>
        <div class="section-t">${t('Hari-hari terakhir', 'Recent days')}</div><div class="list">${days.map((d) => `<div class="li row"><span class="pill p-muted">${esc(E.absLabel(d.abs))}</span><span class="grow small">${d.absent ? t('Absen', 'Absent') : `${t('fokus', 'focus')} ${d.focus} · ${t('tugas', 'tasks')} ${d.task}${d.late ? ' · ' + t('terlambat', 'late') : ''}${d.issues ? ' · ' + t('aturan', 'rules') : ''}`}</span><b class="num">${d.score}</b></div>`).join('') || `<div class="empty">—</div>`}</div>`;
    } else {
      const b = g.benefits, today = E.today(g);
      const claimable = b.jhtClaimableAbs && today >= b.jhtClaimableAbs && !b.jhtClaimed && b.jht > 0;
      const jkp = b.jkp;
      body += `<div class="box"><b>JHT · ${t('Jaminan Hari Tua', 'Old-age savings')}</b><div class="kv"><span>${t('Saldo (perkiraan)', 'Balance (estimate)')}</span><span class="num">${fmt(b.jht)}</span></div>
        <small class="muted">${t('Iuran 5,7% upah (2% kamu, 3,7% perusahaan). Bisa dicairkan 1 bulan setelah berhenti bekerja, dengan paklaring.', '5.7% of wage (2% you, 3.7% employer). Claimable one month after leaving a job, with a paklaring.')}</small>
        ${b.jhtClaimableAbs && !b.jhtClaimed ? `<div class="kv"><span>${t('Bisa diklaim mulai', 'Claimable from')}</span><span>${esc(E.absLabel(b.jhtClaimableAbs, true))}</span></div>` : ''}
        ${b.jhtClaimed ? `<span class="pill p-ok">${t('Sudah dicairkan', 'Paid out')}</span>` : `<button class="btn sm" data-a="jht" ${claimable ? '' : 'disabled'}>${t('Klaim JHT', 'Claim JHT')}</button>`}</div>
        <div class="box"><b>JKP · ${t('Jaminan Kehilangan Pekerjaan', 'Job-loss benefit')}</b><small>${t('60% upah (maks. upah Rp5 juta) hingga 6 bulan, untuk peserta dengan iuran minimal 12 bulan yang di-PHK (bukan mengundurkan diri), dan harus aktif mencari kerja.', '60% of wage (capped at a Rp5m wage) for up to 6 months, for members with at least 12 months of contributions who were laid off (not resigned), and who keep looking for work.')}</small>
        <div class="kv"><span>${t('Bulan iuran', 'Contribution months')}</span><span>${g.employment.contributionMonths}</span></div>
        <div class="kv"><span>Status</span><span>${jkp.eligible ? (jkp.applied ? t(`aktif · dibayar ${jkp.paid}/6`, `active · paid ${jkp.paid}/6`) : t('memenuhi syarat, belum diajukan', 'eligible, not applied')) : t('tidak memenuhi syarat saat ini', 'not eligible now')}</span></div>
        ${jkp.eligible && !jkp.applied ? `<button class="btn sm" data-a="jkp">${t('Ajukan JKP', 'Apply for JKP')}</button>` : ''}<small class="muted">${srcLink('jkp_2025')}</small></div>
        <div class="box"><b>JKN · BPJS Kesehatan</b><div class="kv"><span>Status</span><span>${E.hasJknViaWork(g) ? t('lewat kerja', 'through work') : g.config.jknMandiri ? t('mandiri', 'independent') : t('tidak aktif', 'inactive')}</span></div>
        ${b.jknUntilAbs && !E.isEmployed(g) ? `<div class="kv"><span>${t('Masih ditanggung sampai', 'Still covered until')}</span><span>${esc(E.absLabel(b.jknUntilAbs, true))}</span></div>` : ''}<small class="muted">${t('Setelah PHK, JKN dari kantor masih berlaku hingga 6 bulan.', 'After a layoff, workplace JKN continues for up to 6 months.')}</small></div>`;
    }
    return U.frame('workday', body, { tabs: U.tabs('workday', [['today', bi('Pekerjaan', 'Job')], ['pay', bi('Slip gaji', 'Payslip')], ['perf', bi('Kinerja', 'Performance')], ['benefits', bi('Jaminan', 'Benefits')]], tab), scrollKey: tab });
  };

  // ── Appy ────────────────────────────────────────────────────────────
  const APP_ST = { pending: [bi('Diproses', 'In review'), 'p-due'], task: [bi('Tes menunggu', 'Test to do'), 'p-warn'], scheduled: [bi('Wawancara dijadwalkan', 'Interview scheduled'), 'p-due'], offer: [bi('Tawaran!', 'Offer!'), 'p-ok'],
    rejected: [bi('Ditolak', 'Rejected'), 'p-muted'], ghosted: [bi('Tidak ada kabar', 'No response'), 'p-muted'], freeze: [bi('Rekrutmen dihentikan', 'Hiring paused'), 'p-muted'], withdrawn: [bi('Ditarik', 'Withdrawn'), 'p-muted'],
    hired: [bi('Diterima', 'Hired'), 'p-ok'], declined: [bi('Kamu tolak', 'Declined'), 'p-muted'], expired: [bi('Kedaluwarsa', 'Expired'), 'p-muted'] };
  const SECTOR = { retail: bi('Ritel', 'Retail'), fnb: bi('Makanan & minuman', 'Food & beverage'), logistics: bi('Logistik', 'Logistics'), manufacturing: bi('Manufaktur', 'Manufacturing'), services: bi('Jasa & perkantoran', 'Services & office'),
    hospitality: bi('Perhotelan', 'Hospitality'), sales: bi('Penjualan', 'Sales'), media: bi('Media & kreatif', 'Media & creative'), marketing: bi('Pemasaran', 'Marketing'), technology: bi('Teknologi', 'Technology'), facility: bi('Fasilitas & keamanan', 'Facilities & security'), finance: bi('Keuangan', 'Finance') };
  const chance = (s) => (s >= 0.6 ? bi('lumayan', 'fair') : s >= 0.42 ? bi('sedang', 'moderate') : bi('rendah', 'low'));
  const arrL = (a) => L({ remote: bi('jarak jauh', 'remote'), hybrid: bi('hibrida', 'hybrid'), onsite: bi('di lokasi', 'on site') }[a]);
  function listingRow(g, l) {
    const el = E.eligibility(g, l);
    const mOk = el.mandatory.filter((m) => m.ok).length;
    const applied = g.appy.applications.some((a) => a.listingId === l.id);
    const saved = (g.appy.saved || []).includes(l.id);
    return `<button class="li listing" data-a="listing" data-x="${l.id}"><span class="row"><span class="grow"><span class="t">${T(l.title)}</span><span class="s">${T(l.company)} · ${T(J.EMP_TYPES[l.type].label)}${l.termMonths ? ` ${l.termMonths} ${t('bln', 'mo')}` : ''} · ${l.arrangement === 'onsite' ? `${l.distanceKm} km` : arrL(l.arrangement)}</span></span>
      <span style="text-align:right"><b class="num small">${l.pay ? `${short(l.pay[0])}–${short(l.pay[1])}` : t('tidak dicantumkan', 'not stated')}</b><br>${applied ? `<span class="pill p-ok">${t('Dilamar', 'Applied')}</span>` : saved ? `<span class="pill p-muted">${ic('Heart')}</span>` : ''}</span></span>
      <span class="s">${el.ok ? `<span class="pill p-ok">${t('Syarat wajib terpenuhi', 'Mandatory met')}</span>` : `<span class="pill p-warn">${mOk}/${el.mandatory.length} ${t('syarat wajib', 'mandatory')}</span>`} · ${l.applicants} ${t('pelamar', 'applicants')} · ${t('tutup', 'closes')} ${esc(E.absLabel(l.deadlineAbs))}${l.unrealistic ? ' · ' + t('syarat tinggi untuk level ini', 'high bar for the level') : ''}</span></button>`;
  }
  function listingDetail(id) {
    const g = G();
    const l = g.appy.listings.find((x) => x.id === id) || (g.appy.applications.find((a) => a.listingId === id) || {}).listing;
    if (!l) { U.setSub('appy', { detail: null }); return U.apps.appy(); }
    const el = E.eligibility(g, l);
    const app = g.appy.applications.find((a) => a.listingId === id);
    const saved = (g.appy.saved || []).includes(l.id);
    const kind = J.KINDS[l.kind];
    let body = `<div class="box"><span class="t" style="font-weight:800;font-size:18px">${T(l.title)}</span><span class="small muted">${T(l.company)} · ${t('lowongan fiktif', 'fictional listing')}</span>
      <div class="kv"><span>${t('Gaji', 'Pay')}</span><span class="num">${l.pay ? `${fmt(l.pay[0])} – ${fmt(l.pay[1])}` : t('Tidak dicantumkan', 'Not stated')}</span></div>
      <div class="kv"><span>${t('Jenis kontrak', 'Contract')}</span><span>${T(J.EMP_TYPES[l.type].label)}${l.termMonths ? ` · ${l.termMonths} ${t('bulan', 'months')}` : ''}</span></div>
      <div class="kv"><span>${t('Bidang', 'Sector')}</span><span>${T(SECTOR[l.sector] || l.sector)}</span></div><div class="kv"><span>${t('Jenis kerja', 'Kind of work')}</span><span>${T(kind.label)}</span></div>
      <div class="kv"><span>${t('Lokasi', 'Location')}</span><span>${l.arrangement === 'onsite' ? `${l.distanceKm} km ${t('dari rumah', 'from home')}` : arrL(l.arrangement)}</span></div>
      <div class="kv"><span>${t('Tahap seleksi', 'Selection stages')}</span><span>${l.stages}</span></div><div class="kv"><span>${t('Pelamar', 'Applicants')}</span><span>±${l.applicants}</span></div>
      <div class="kv"><span>${t('Batas lamaran', 'Deadline')}</span><span>${esc(E.absLabel(l.deadlineAbs, true))}</span></div>
      ${l.note ? `<small>${T(l.note)}</small>` : ''}${l.unpaidTask ? `<small style="color:var(--coral)">${t('Tahap tes meminta tugas proyek tanpa bayaran (skenario fiktif).', 'The test stage asks for an unpaid project task (fictional scenario).')}</small>` : ''}
      ${l.unrealistic ? `<small style="color:var(--coral)">${t('Syarat pengalaman tinggi untuk posisi ini. Lowongan seperti ini ada; tetap boleh dicoba bila syarat wajib terpenuhi.', 'A high experience bar for this level. Listings like this exist; you can still try if you meet the mandatory ones.')}</small>` : ''}</div>
      <div class="section-t">${t('Syarat wajib', 'Mandatory')}</div>${U.reqList(el.mandatory.map((m) => ({ ...m, fix: m.ok ? null : m.doc === 'portfolio' ? 'portfolio' : m.doc && D.travel.docById[m.doc] && D.travel.docById[m.doc].heldIfEdu != null ? null : m.fix })))}
      <div class="section-t">${t('Diutamakan', 'Preferred')}</div>${el.preferred.length ? U.reqList(el.preferred.map((p) => ({ ...p, optional: !p.ok }))) : `<small class="muted">—</small>`}
      <div class="box"><small>${t(`Peluang lolos seleksi berkas: ${L(chance(E.matchScore(g, l)))}. Ini perkiraan kasar dari kecocokan profilmu, kualitas CV (${g.appy.cv}/100) dan jumlah pelamar, bukan statistik. Pendidikan lebih tinggi tidak menjamin diterima.`, `Chance of passing screening: ${L(chance(E.matchScore(g, l)))}. A rough guess from your profile fit, CV quality (${g.appy.cv}/100) and the number of applicants, not a statistic. More education never guarantees a job.`)}</small></div>`;
    if (app) body += appCard(g, app);
    const foot = app ? '' : `<div class="setup-foot"><button class="btn sec" data-a="save-listing" data-x="${l.id}">${ic(saved ? 'HeartOff' : 'Heart')} ${saved ? t('Hapus simpan', 'Unsave') : t('Simpan', 'Save')}</button><button class="btn" data-a="apply" data-x="${l.id}" ${el.ok && E.isOnline(g) ? '' : 'disabled'}>${el.ok ? (E.isOnline(g) ? t('Lamar sekarang', 'Apply now') : t('Butuh internet', 'Needs internet')) : t('Syarat wajib belum terpenuhi', 'Mandatory not met')}</button></div>`;
    return U.frame('appy', body, { title: 'Appy', backLabel: t('Lowongan', 'Listings'), foot, scrollKey: 'L' + id });
  }
  function appCard(g, a) {
    const [lab, cls] = APP_ST[a.status] || [bi(a.status, a.status), 'p-muted'];
    const stage = a.stages[Math.min(a.stage, a.stages.length - 1)];
    return `<div class="box outline"><div class="row"><span class="grow"><span class="t">${T(a.listing.title)}</span><span class="s">${T(a.listing.company)} · ${t('dilamar', 'applied')} ${esc(E.absLabel(a.appliedAbs))}</span></span><span class="pill ${cls}">${T(lab)}</span></div>
      <div class="stages">${a.stages.map((s, i) => `<span class="${i < a.stage || a.status === 'offer' || a.status === 'hired' ? 'done' : i === a.stage && ['pending', 'task', 'scheduled'].includes(a.status) ? 'cur' : ''}">${T(E.STAGE_LABEL[s])}</span>`).join('')}</div>
      ${a.status === 'task' ? `<small>${t('Kerjakan sebelum', 'Do it before')} ${esc(E.absLabel(a.taskDeadline, true))} (${t('1 waktu luang', '1 free slot')}).</small><button class="btn sm" data-a="app-task" data-x="${a.id}" ${E.freeSlots(g) ? '' : 'disabled'}>${t('Kerjakan', 'Do it now')} · ${T(E.STAGE_LABEL[stage])}</button>` : ''}
      ${a.status === 'scheduled' ? `<small>${t('Jadwal', 'Scheduled')}: ${esc(E.absLabel(a.scheduledAbs, true))}. ${t('Kamu hadir otomatis pada hari itu; jika hari kerja, izin diambil otomatis.', 'You attend automatically that day; on a workday, time off is taken automatically.')}</small>` : ''}
      ${a.status === 'offer' ? `<div class="kv"><span>${t('Tawaran gaji', 'Offered wage')}</span><span class="num"><b>${fmt(a.offer.wage)}</b></span></div><small>${t('Balas sebelum', 'Reply by')} ${esc(E.absLabel(a.offer.expiresAbs, true))}. ${E.isEmployed(g) ? t('Menerima berarti mengundurkan diri dari pekerjaan sekarang (7 hari, tanpa pesangon).', 'Accepting means resigning from your current job (7 days, no severance).') : ''}</small><div class="row" style="gap:6px"><button class="btn sm" data-a="offer-accept" data-x="${a.id}">${t('Terima', 'Accept')}</button><button class="btn sm sec" data-a="offer-decline" data-x="${a.id}">${t('Tolak', 'Decline')}</button></div>` : ''}
      <div class="hist">${a.history.slice(0, 5).map((h) => `<small class="muted">${esc(E.absLabel(Math.min(h.abs, E.today(g))))} · ${T(h.text)}</small>`).join('')}</div>
      ${['pending', 'task', 'scheduled'].includes(a.status) ? `<button class="btn ghost sm" data-a="app-withdraw" data-x="${a.id}">${t('Tarik lamaran', 'Withdraw')}</button>` : ''}</div>`;
  }
  U.apps.appy = () => {
    const g = G();
    const det = U.sub('appy', 'detail', null);
    if (det) return listingDetail(det);
    const tab = U.sub('appy', 'tab', 'jobs');
    const online = E.isOnline(g);
    let body = online ? '' : `<div class="box" style="color:var(--coral)"><div class="row">${ic('WifiOff')}<span>${t('Tidak ada koneksi. Lowongan bisa dilihat, tapi melamar butuh internet.', 'No connection. You can browse, but applying needs internet.')}</span></div></div>`;
    if (tab === 'jobs') {
      const f = U.sub('appy', 'f', 'all');
      let list = g.appy.listings.slice().sort((a, b) => b.postedAbs - a.postedAbs);
      if (f === 'ok') list = list.filter((l) => E.eligibility(g, l).ok);
      if (f === 'saved') list = list.filter((l) => (g.appy.saved || []).includes(l.id));
      body += `<div class="chips">${[['all', bi('Semua', 'All')], ['ok', bi('Syarat wajib terpenuhi', 'I qualify')], ['saved', bi('Disimpan', 'Saved')]].map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" data-a="appy-f" data-x="${k}">${T(l)}</button>`).join('')}</div>
        <small class="muted">${t('Lowongan baru muncul tiap hari dan menutup sesuai batasnya. Semua perusahaan fiktif. Kondisi ekonomi game memengaruhi jumlah lowongan.', 'New listings appear daily and close at their deadline. All companies are fictional. The in-game economy affects how many there are.')}</small>
        <div class="list">${list.map((l) => listingRow(g, l)).join('') || `<div class="empty">${t('Tidak ada lowongan yang cocok hari ini.', 'No matching listings today.')}</div>`}</div>`;
    } else if (tab === 'apps') {
      const apps = g.appy.applications;
      const active = apps.filter((a) => ['pending', 'task', 'scheduled', 'offer'].includes(a.status));
      body += `<div class="box"><div class="kv"><span>${t('Lamaran berjalan', 'In progress')}</span><span>${active.length}</span></div><div class="kv"><span>${t('Ditolak / tanpa kabar', 'Rejected / no reply')}</span><span>${apps.filter((a) => ['rejected', 'ghosted'].includes(a.status)).length}</span></div>
        <small class="muted">${t('Ditolak itu biasa, apalagi untuk posisi dengan ratusan pelamar. Banyak lamaran tidak dibalas sama sekali.', 'Rejection is normal, especially for roles with hundreds of applicants. Many applications get no reply at all.')}</small></div>
        ${apps.map((a) => appCard(g, a)).join('') || `<div class="empty">${t('Belum ada lamaran.', 'No applications yet.')}</div>`}`;
    } else if (tab === 'gigs') {
      body += `<small class="muted">${t('Kerja harian dibayar di hari yang sama. Bayaran ilustratif; tidak ada jaminan sosial.', 'Day gigs pay the same day. Pay is illustrative; no social security.')}</small>
        <div class="list">${g.appy.gigs.map((gg) => { const st = E.gigStatus(g, gg); return `<div class="li"><div class="row"><span class="grow"><span class="t">${T(gg.title)}</span><span class="s">${gg.slots} ${t('waktu luang', 'slots')} · ${t('energi', 'energy')} −${gg.energy}${gg.cost ? ` · ${t('biaya', 'cost')} ${fmt(gg.cost)} (${T(gg.costLabel)})` : ''}${gg.remote ? ' · ' + t('online', 'online') : ''}</span>${st.ok ? '' : `<span class="s" style="color:var(--coral)">${st.reasons.map(T).join(' · ')}</span>`}</span><b class="num">${fmt(gg.pay)}</b></div>
          <button class="btn sm" style="margin-top:6px" data-a="gig" data-x="${gg.id}" ${st.ok && !gg.done ? '' : 'disabled'}>${gg.done ? t('Sudah dikerjakan', 'Done') : t('Ambil', 'Take it')}</button></div>`; }).join('') || `<div class="empty">${t('Tidak ada kerja harian hari ini. Cek lagi besok.', 'No day gigs today. Check again tomorrow.')}</div>`}</div>`;
    } else {
      const a = g.appy;
      const courses = g.courses.filter((c) => c.sessionsLeft > 0);
      body += `<div class="box"><div class="kv"><span>${t('Waktu luang hari ini', 'Free time today')}</span><span><b>${E.freeSlots(g)}</b></span></div><small class="muted">${t('Tiap langkah memakai 1 waktu luang dan energi.', 'Each step uses 1 free slot and some energy.')}</small></div>
        <div class="box outline"><div class="row"><span class="grow"><span class="t">${t('Perbaiki CV', 'Improve your CV')}</span><span class="s">${t('Kualitas', 'Quality')} ${a.cv}/100 · ${t('memengaruhi seleksi berkas', 'affects screening')}</span></span><button class="btn sm" data-a="improve" data-x="cv" ${E.freeSlots(g) ? '' : 'disabled'}>${t('Kerjakan', 'Work on it')}</button></div>${U.bar(a.cv)}</div>
        <div class="box outline"><div class="row"><span class="grow"><span class="t">${t('Bangun portofolio', 'Build a portfolio')}</span><span class="s">${a.portfolio}/100 · ${t('dokumen portofolio siap di 25', 'portfolio document ready at 25')}</span></span><button class="btn sm" data-a="improve" data-x="portfolio" ${E.freeSlots(g) ? '' : 'disabled'}>${t('Kerjakan', 'Work on it')}</button></div>${U.bar(a.portfolio)}</div>
        <div class="box outline"><div class="row"><span class="grow"><span class="t">${t('Latihan bahasa Inggris gratis', 'Free English practice')}</span><span class="s">${T(J.engById[g.config.character.english].label)} · ${t('kemajuan ke level berikutnya', 'progress to next level')} ${Math.min(100, a.englishPractice)}%</span></span><button class="btn sm" data-a="improve" data-x="english" ${E.freeSlots(g) && E.engRank(g.config.character.english) < 3 ? '' : 'disabled'}>${t('Latihan', 'Practise')}</button></div>${U.bar(Math.min(100, a.englishPractice))}</div>
        <div class="section-t">${t('Kursus', 'Courses')}</div>${courses.map((c) => `<div class="box outline"><div class="row"><span class="grow"><span class="t">${T(D.catalog.byId[c.itemId].name)}</span><span class="s">${c.total - c.sessionsLeft}/${c.total} ${t('sesi', 'sessions')}</span></span><button class="btn sm" data-a="improve" data-x="course" data-k="${c.id}" ${E.freeSlots(g) ? '' : 'disabled'}>${t('Ikut sesi', 'Attend')}</button></div>${U.bar(((c.total - c.sessionsLeft) / c.total) * 100)}</div>`).join('') || `<small class="muted">${t('Belum ada kursus aktif.', 'No active courses.')}</small>`}
        <button class="btn sec sm" data-a="open" data-x="shopsquare" data-cat="school">${t('Lihat kursus di ShopSquare', 'Browse courses in ShopSquare')}</button>
        <div class="section-t">${t('Dokumen lamaran', 'Application papers')}</div><div class="box outline"><small>${t('SKCK, surat sehat, SIM C, sertifikat bahasa Inggris dan kartu pencari kerja (AK1) diurus di Berkas.', 'Police clearance, medical certificate, SIM C, English test and job-seeker card (AK1) are handled in Berkas.')}</small><button class="btn sm sec" data-a="open" data-x="berkas">${t('Buka Berkas', 'Open Berkas')}</button></div>`;
    }
    return U.frame('appy', body, { tabs: U.tabs('appy', [['jobs', bi(`Lowongan (${g.appy.listings.length})`, `Listings (${g.appy.listings.length})`)], ['apps', bi('Lamaranku', 'My applications')], ['gigs', bi('Kerja harian', 'Day gigs')], ['improve', bi('Tingkatkan diri', 'Improve')]], tab), scrollKey: tab });
  };

  Object.assign(U.A, {
    leave(el) { const p = U.prev(); const r = E.takeLeave(G(), el.dataset.x, { unpaid: el.dataset.x === 'unpaid' }); U.result(r, r.paid ? t('Cuti dipakai 1 hari.', 'One day of leave used.') : t('Izin tanpa upah; dipotong saat gajian.', 'Unpaid day off; deducted on payday.')); U.after(p); },
    jht() { const p = U.prev(); const r = E.claimJht(G()); U.result(r, t(`JHT cair: ${fmt(r.amount || 0)}`, `JHT paid out: ${fmt(r.amount || 0)}`)); U.after(p); },
    jkp() { U.result(E.applyJkp(G()), t('JKP diajukan. Manfaat dibayar tiap tanggal 1 selama kamu aktif melamar kerja.', 'JKP applied for. Paid on the 1st while you keep applying for jobs.')); U.save(); },
    listing(el) { U.setSub('appy', { detail: el.dataset.x }); },
    'appy-f'(el) { U.setSub('appy', { f: el.dataset.x }); },
    'save-listing'(el) { const a = G().appy; a.saved = a.saved || []; const i = a.saved.indexOf(el.dataset.x); if (i >= 0) a.saved.splice(i, 1); else a.saved.push(el.dataset.x); U.save(); },
    apply(el) { const p = U.prev(); U.result(E.apply(G(), el.dataset.x), t('Lamaran terkirim. Kabar biasanya datang dalam beberapa hari, atau tidak sama sekali.', 'Application sent. Replies usually take a few days, or never come.')); U.after(p); },
    'app-task'(el) { const p = U.prev(); U.result(E.doTask(G(), el.dataset.x), t('Tes dikerjakan.', 'Test submitted.')); U.after(p); },
    'app-withdraw'(el) { E.withdraw(G(), el.dataset.x); U.toast(t('Lamaran ditarik.', 'Application withdrawn.')); U.save(); },
    'offer-accept'(el) { const p = U.prev(); const r = E.acceptOffer(G(), el.dataset.x); U.result(r, t(`Diterima! Mulai ${E.absLabel(r.startAbs || 0, true)}.`, `Accepted! Starting ${E.absLabel(r.startAbs || 0, true)}.`)); U.after(p); },
    'offer-decline'(el) { E.declineOffer(G(), el.dataset.x); U.toast(t('Tawaran ditolak.', 'Offer declined.')); U.save(); },
    gig(el) { const p = U.prev(); const r = E.doGig(G(), el.dataset.x); U.result(r, r.cancelled ? t(`Klien batal di tengah jalan; dibayar ${fmt(r.pay)}.`, `The client cancelled midway; paid ${fmt(r.pay)}.`) : t(`Selesai. Dibayar ${fmt(r.pay || 0)}.`, `Done. Paid ${fmt(r.pay || 0)}.`)); U.after(p); },
    improve(el) { const p = U.prev(); const r = E.improve(G(), el.dataset.x, el.dataset.k); U.result(r, { cv: t('CV lebih baik.', 'CV improved.'), portfolio: t('Portofolio bertambah.', 'Portfolio grew.'), english: t('Latihan selesai.', 'Practice done.'), course: t('Satu sesi selesai.', 'One session done.') }[el.dataset.x]); U.after(p); },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
