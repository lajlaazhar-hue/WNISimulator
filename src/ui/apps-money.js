/*
 * ui/apps-money.js — PayDay Bank, Bills, FutureMe, Subscriptions, Borrow (Pinjam), Report.
 */
(function (root) {
  const RLS = root.RLS;
  const E = RLS.engine, M = RLS.money, D = RLS.data, I = RLS.i18n, U = RLS.U;
  const { esc, T, t, L, ic, pill, fmt, short, srcLink, pct } = U;
  const ui = U.ui;
  const bi = I.bi;
  const G = () => U.G;
  const CLS = {
    income: bi('Gaji', 'Salary'), income_household: bi('Pendapatan rumah tangga', 'Household income'), income_extra: bi('Pendapatan tambahan', 'Extra income'), benefit: bi('Jaminan sosial', 'Social security benefit'),
    severance: bi('Pesangon/kompensasi', 'Severance/compensation'), mandatory: bi('Tagihan wajib', 'Bill'), essential: bi('Kebutuhan pokok', 'Essential'), discretionary: bi('Opsional', 'Optional'),
    mixed: bi('Pokok + opsional', 'Essential + optional'), unexpected: bi('Tak terduga', 'Unexpected'), upfront: bi('Biaya awal sekali bayar', 'One-off upfront'), savings_in: bi('Pindah ke tabungan', 'To savings'),
    savings_out: bi('Tarik dari tabungan', 'From savings'), loan_in: bi('Pinjaman cair (bukan pendapatan)', 'Loan received (not income)'), loan_repay: bi('Bayar pinjaman', 'Loan repayment'), refund: bi('Pengembalian dana', 'Refund'), opening: bi('Saldo awal', 'Opening'),
  };
  U.CLS = CLS;
  const cat = (k) => L(E.CAT[k] || k);

  U.txRow = (x) => {
    const cls = x.status === 'failed' ? 'amt-fail' : x.amount > 0 ? 'amt-pos' : 'amt-neg';
    return `<button class="li row" data-a="tx" data-x="${x.id}"><span class="grow"><span class="t">${T(x.merchant)}</span>
      <span class="s">${esc(cat(x.category))} · ${t('Hari', 'Day')} ${x.day}${x.status === 'failed' ? ` · <b style="color:var(--coral)">${t('Ditolak', 'Declined')}</b>` : ''}</span></span>
      <span class="${cls}">${fmt(x.amount, { plus: x.amount > 0 })}</span></button>`;
  };
  U.billRow = (b) => {
    const st = b.status === 'paid' ? `<span class="pill p-ok">${t('Lunas tgl', 'Paid day')} ${b.paidDay}</span>` : b.status === 'overdue' ? `<span class="pill p-warn">${t('Lewat tempo', 'Overdue')}</span>` : b.dueDay <= G().date.day ? `<span class="pill p-due">${t('Jatuh tempo hari ini', 'Due today')}</span>` : `<span class="pill p-muted">${t('Tempo tgl', 'Due day')} ${b.dueDay}</span>`;
    return `<div class="li"><div class="row"><span class="grow"><span class="t">${T(b.label)}</span><span class="s">${esc(cat(b.category))} · ${b.loanId ? t(`pokok ${fmt(b.principal)}, bunga/biaya ${fmt(b.amount - b.principal)}`, `principal ${fmt(b.principal)}, interest/fees ${fmt(b.amount - b.principal)}`) : b.adjustable ? t('Bisa kamu ubah', 'You can adjust this') : t('Sulit dihindari', 'Hard to avoid')}${b.lateFee ? ` · ${t('termasuk denda', 'includes late fee')} ${fmt(b.lateFee)}` : ''}</span></span><span class="amt-neg">${fmt(b.amount)}</span></div>
      <div class="row" style="margin-top:8px">${st}<span class="grow"></span>
      ${b.status !== 'paid' ? (b.forcedAutopay ? `<span class="small muted">${t('Dipotong otomatis', 'Auto-deducted')}</span>` : `<span class="small muted">${t('Bayar otomatis', 'Autopay')}</span>${U.sw('autopay', b.id, b.autopay, t('Bayar otomatis', 'Autopay') + ' ' + L(b.label))}`) + `<button class="btn sm" data-a="pay-bill" data-x="${b.id}">${t('Bayar', 'Pay')}</button>` : ''}</div></div>`;
  };

  // ── PayDay Bank ─────────────────────────────────────────────────────
  U.apps.bank = () => {
    const g = G();
    const tab = U.sub('bank', 'tab', 'activity');
    const rep = E.generateMonthlyReport(g);
    let body = `<div class="hero"><span class="lbl">${t('Saldo tersedia', 'Available balance')}</span><span class="big num" style="font-family:var(--f-display)">${fmt(g.wallet)}</span>
      <div class="split"><span>${t('Pendapatan bulan ini', 'Income this month')}<b>${fmt(rep.income)}</b></span><span>${t('Terpakai', 'Spent')}<b>${fmt(rep.consumption + rep.upfront + rep.financeCost)}</b></span><span>${t('Tabungan', 'Savings')}<b>${fmt(g.savings)}</b></span></div></div>`;
    if (tab === 'activity') {
      const txs = g.transactions.filter((x) => x.month === g.monthIndex && x.cls !== 'opening');
      body += `<div class="section-t">${t('Transaksi', 'Transactions')} · ${esc(I.month(g.date.month))}</div><div class="list">${txs.map(U.txRow).join('') || `<div class="empty">${t('Belum ada transaksi.', 'No transactions.')}</div>`}</div>`;
      if (g.monthIndex > 1) body += `<div class="section-t">${t('Sebelumnya', 'Earlier')}</div><div class="list">${g.transactions.filter((x) => x.month < g.monthIndex).slice(0, 30).map(U.txRow).join('')}</div>`;
    } else if (tab === 'spending') {
      const max = Math.max(1, ...rep.byCategory.map((c) => c[1]));
      const kv = (l, v) => `<div class="kv"><span>${l}</span><span class="num">${fmt(v)}</span></div>`;
      body += `<div class="box"><div class="section-t" style="margin:0">${t('Arus kas', 'Cash flow')}</div>
        ${kv(t('Pendapatan', 'Income'), rep.income)}${rep.loanIn ? kv(t('Pinjaman cair (bukan pendapatan)', 'Loans received (not income)'), rep.loanIn) : ''}${rep.refunds ? kv(t('Pengembalian dana', 'Refunds'), rep.refunds) : ''}
        ${kv(t('Tagihan wajib', 'Bills & obligations'), -rep.mandatory)}${kv(t('Kebutuhan sehari-hari', 'Everyday essentials'), -rep.variableEssential)}${kv(t('Belanja opsional', 'Optional spending'), -rep.discretionary)}
        ${kv(t('Tak terduga', 'Unexpected'), -rep.unexpected)}${kv(t('Biaya awal sekali bayar', 'One-off upfront costs'), -rep.upfront)}${rep.financeCost ? kv(t('Bunga & biaya pinjaman', 'Interest & loan fees'), -rep.financeCost) : ''}
        ${rep.principalRepaid ? kv(t('Pokok pinjaman dibayar', 'Loan principal repaid'), -rep.principalRepaid) : ''}${kv(t('Bersih ke tabungan', 'Net moved to savings'), -rep.netSavings)}</div>
        <div class="section-t">${t('Per kategori', 'By category')}</div><div class="box outline">${rep.byCategory.map(([c, v]) => `<div class="field"><div class="kv"><span>${esc(cat(c))}</span><span class="num">${fmt(v)}</span></div><div class="bar"><i style="width:${(v / max) * 100}%"></i></div></div>`).join('') || `<div class="empty">${t('Belum ada pengeluaran.', 'Nothing spent yet.')}</div>`}</div>
        <div class="box"><div class="kv"><span>${t('Cerukan (overdraft)', 'Overdraft')}</span><span>${t('Tidak aktif', 'Off')}</span></div><small class="muted">${t('Pembayaran melebihi saldo ditolak dan dicatat. Tidak ada yang terpotong.', 'Payments above your balance are declined and recorded. Nothing is deducted.')}</small></div>`;
    } else {
      body += `<div class="section-t">${t('Terjadwal & menunggu', 'Scheduled & pending')}</div><div class="list">${E.billsThisMonth(g).map(U.billRow).join('') || `<div class="empty">${t('Tidak ada tagihan.', 'No bills.')}</div>`}</div>`;
      const subs = g.subscriptions.filter((s) => s.active);
      if (subs.length) body += `<div class="section-t">${t('Perpanjangan kartu', 'Card renewals')}</div><div class="list">${subs.map((s) => { const dd = D.subscriptions.find((x) => x.id === s.id); return `<div class="li row"><span class="grow"><span class="t">${T(dd.name)}</span><span class="s">${t('Diperpanjang tgl', 'Renews day')} ${s.renewDay}</span></span><span class="amt-neg">${fmt(dd.price)}</span></div>`; }).join('')}</div>`;
    }
    return U.frame('bank', body, { tabs: U.tabs('bank', [['activity', bi('Aktivitas', 'Activity')], ['spending', bi('Pengeluaran', 'Spending')], ['bills', bi('Mendatang', 'Upcoming')]], tab), scrollKey: tab });
  };
  U.sheets.tx = (sh) => {
    const x = G().transactions.find((y) => y.id === sh.id);
    if (!x) return '';
    const split = x.split ? Object.entries(x.split).filter(([, v]) => v).map(([k, v]) => `<div class="kv"><span>${esc(L({ essential: bi('Pokok', 'Essential'), discretionary: bi('Opsional', 'Optional'), principal: bi('Pokok pinjaman', 'Principal'), interest: bi('Bunga & biaya', 'Interest & fees') }[k] || k))}</span><span>${fmt(v)}</span></div>`).join('') : '';
    return `<h3>${T(x.merchant)}</h3><div class="receipt">
      <div class="kv"><span>${t('Tanggal', 'Date')}</span><span>${esc(E.dateLabel({ year: x.y, month: x.m, day: x.day }, true))}</span></div>
      <div class="kv"><span>${t('Kategori', 'Category')}</span><span>${esc(cat(x.category))}</span></div><div class="kv"><span>${t('Jenis', 'Type')}</span><span>${T(CLS[x.cls] || x.cls)}</span></div>
      <div class="kv"><span>${t('Jumlah', 'Amount')}</span><span>${fmt(x.amount, { plus: x.amount > 0 })}</span></div><div class="kv"><span>Status</span><span>${x.status === 'failed' ? t('Ditolak, tidak ada yang terpotong', 'Declined, nothing deducted') : t('Berhasil', 'Completed')}</span></div>
      <div class="kv"><span>${t('Saldo setelahnya', 'Balance after')}</span><span>${fmt(x.balanceAfter)}</span></div>${split ? '<hr>' + split : ''}
      ${x.items ? '<hr>' + x.items.map((i) => `<div class="kv"><span>${T(i.name)} × ${i.qty}</span><span>${fmt(i.unit * i.qty)}</span></div>`).join('') : ''}
      ${x.note ? `<hr><div class="small">${T(x.note)}</div>` : ''}</div>`;
  };

  // ── Bills ───────────────────────────────────────────────────────────
  U.apps.bills = () => {
    const g = G();
    const bills = E.billsThisMonth(g);
    const total = bills.reduce((s, b) => s + b.amount, 0);
    const paid = bills.filter((b) => b.status === 'paid').reduce((s, b) => s + b.amount, 0);
    const left = total - paid;
    const plan = E.currentCommutePlan(g);
    const body = `<div class="box"><div class="kv"><span>${t('Tagihan bulan ini', 'Bills this month')}</span><span class="num">${fmt(total)}</span></div>
      <div class="kv"><span>${t('Sudah dibayar', 'Paid')}</span><span class="num">${fmt(paid)}</span></div>
      <div class="kv"><span>${t('Masih harus dibayar', 'Still to pay')}</span><span class="num"><b>${fmt(left)}</b></span></div>
      <div class="bar"><i style="width:${total ? (paid / total) * 100 : 0}%"></i></div>
      <div class="kv"><span>${t('Sisa uang setelah kewajiban', 'Money left after obligations')}</span><span class="num" style="color:${g.wallet - left < 0 ? 'var(--coral)' : 'inherit'}">${fmt(g.wallet - left)}</span></div></div>
      <div class="list">${bills.map(U.billRow).join('') || `<div class="empty">${t('Tidak ada tagihan bulan ini.', 'No bills this month.')}</div>`}</div>
      <small class="muted">${t('Bayar otomatis membayar tagihan pada tanggal jatuh tempo bila saldo cukup. Tagihan yang sudah lunas tidak ditagih lagi. Tagihan yang belum dibayar pindah ke bulan depan; sewa dan listrik kena denda. Cicilan pinjaman yang telat tetap bisa dibayar dan dendanya berjalan sesuai produknya.', 'Autopay pays a bill on its due day if your balance covers it. A paid bill is never charged again. Unpaid bills carry into next month, rent and power with a late fee. Overdue loan instalments stay payable and their late fees follow the product.')}</small>
      <div class="section-t">${t('Juga rutin', 'Also recurring')}</div>
      <div class="box outline"><div class="kv"><span>${t('Ongkos kerja (tiap hari kerja)', 'Commute (each workday)')}</span><span class="num">${plan && plan.perTrip != null ? fmt(plan.perTrip * 2 + plan.dailyExtra) + t('/hari', '/day') : '—'}</span></div>
      <div class="kv"><span>${t('Langganan', 'Subscriptions')}</span><span class="num">${fmt(g.subscriptions.filter((s) => s.active).reduce((s, x) => s + D.subscriptions.find((dd) => dd.id === x.id).price, 0))}${t('/bln', '/mo')}</span></div>
      <button class="btn sec sm" data-a="open" data-x="recurring">${t('Kelola langganan', 'Manage subscriptions')}</button></div>`;
    return U.frame('bills', body, { title: t('Tagihan & kewajiban', 'Bills & obligations') });
  };

  // ── FutureMe ────────────────────────────────────────────────────────
  const GOALS = [['edu', bi('Pendidikan', 'Education')], ['travel', bi('Liburan', 'Travel')], ['phone', bi('Ganti ponsel', 'Replace my phone')], ['mudik', bi('Mudik Lebaran', 'Going home for the holidays')], ['passport', bi('Paspor & visa', 'Passport & visa')], ['other', bi('Lainnya', 'Other')]];
  U.apps.futureme = () => {
    const g = G();
    const rep = E.generateMonthlyReport(g);
    const amt = U.sub('futureme', 'amt', 100000);
    let body = `<div class="hero" style="background:#4c8c2b;color:#fff"><span class="lbl">${t('Total tabungan', 'Total savings')}</span><span class="big num" style="font-family:var(--f-display)">${fmt(g.savings)}</span>
      <div class="split"><span>${t('Ditabung bulan ini', 'Saved this month')}<b>${fmt(rep.netSavings)}</b></span><span>${t('Bisa dipakai', 'Spendable')}<b>${fmt(g.wallet)}</b></span><span>${t('Bertahan ±', 'Runway')}<b>${Math.max(0, E.runwayDays(g))} ${t('hari', 'days')}</b></span></div></div>
      <small class="muted">${t('Memindahkan uang ke sini mengurangi uang yang bisa kamu pakai hari ini, tapi bukan pengeluaran. Laporan menghitungnya terpisah. "Bertahan" = (saldo + tabungan − tagihan belum dibayar) ÷ perkiraan kebutuhan harian.', 'Moving money here lowers what you can spend today, but it is not spending. Reports count it separately. "Runway" = (balance + savings − unpaid bills) ÷ estimated daily essentials.')}</small>
      <div class="box"><div class="field"><label for="samt">${t('Jumlah (Rp)', 'Amount (Rp)')}</label><input id="samt" class="inp num" inputmode="numeric" value="${amt}" data-in="samt"></div>
      <div class="chips">${[50000, 100000, 250000, 500000].map((v) => `<button class="chip ${Number(amt) === v ? 'on' : ''}" data-a="samt" data-x="${v}">${short(M.rp(v))}</button>`).join('')}</div></div>`;
    for (const gl of g.goals) {
      const p = gl.target ? Math.min(1, gl.saved / gl.target) : 0;
      body += `<div class="box outline"><div class="row"><span class="grow"><span class="t">${T(gl.name)}</span><span class="s">${fmt(gl.saved)} ${t('dari', 'of')} ${fmt(gl.target)}</span></span><b>${Math.round(p * 100)}%</b></div>
        <div class="bar"><i style="width:${p * 100}%"></i></div>
        <div class="row" style="gap:6px"><button class="btn sm" data-a="save-in" data-x="${gl.id}">${t('Tambah', 'Add')}</button><button class="btn sm sec" data-a="save-out" data-x="${gl.id}" ${gl.saved ? '' : 'disabled'}>${t('Tarik', 'Withdraw')}</button></div></div>`;
    }
    const gname = U.sub('futureme', 'gname', 'edu');
    body += `<div class="section-t">${t('Tujuan baru', 'New goal')}</div><div class="box"><div class="field"><label for="gname">${t('Tujuan', 'Goal')}</label><select id="gname" class="inp" data-in="gname">${GOALS.map(([k, n]) => `<option value="${k}" ${gname === k ? 'selected' : ''}>${T(n)}</option>`).join('')}</select></div>
      <div class="field"><label for="gtarget">${t('Target (Rp)', 'Target (Rp)')}</label><input id="gtarget" class="inp num" inputmode="numeric" value="${U.sub('futureme', 'gtarget', 2000000)}" data-in="gtarget"></div><button class="btn" data-a="add-goal">${t('Buat tujuan', 'Create goal')}</button></div>`;
    return U.frame('futureme', body);
  };

  // ── Subscriptions ───────────────────────────────────────────────────
  U.apps.recurring = () => {
    const g = G();
    let body = `<small class="muted">${t('Langganan diperpanjang otomatis di tanggal yang sama tiap bulan. Batalkan sebelum tanggal itu untuk menghentikan tagihan berikutnya.', 'Subscriptions renew automatically on the same day each month. Cancel before the renewal day to stop the next charge.')}</small><div class="list">`;
    for (const dd of D.subscriptions) {
      const s = g.subscriptions.find((x) => x.id === dd.id);
      body += `<div class="li row"><span class="grow"><span class="t">${T(dd.name)}</span><span class="s">${s && s.active ? `${t('Diperpanjang tgl', 'Renews day')} ${s.renewDay}` : s ? t('Dibatalkan', 'Cancelled') : t('Belum berlangganan', 'Not subscribed')} · ${pill(dd.status)}</span></span><b class="num">${fmt(dd.price)}</b>
        ${s && s.active ? `<button class="btn sm sec" data-a="unsub" data-x="${dd.id}">${t('Batalkan', 'Cancel')}</button>` : `<button class="btn sm" data-a="subscribe" data-x="${dd.id}">${t('Langganan', 'Subscribe')}</button>`}</div>`;
    }
    body += `</div><div class="section-t">${t('Tagihan rutin', 'Recurring bills')}</div><div class="list">${E.billsThisMonth(g).map((b) => `<div class="li row"><span class="grow"><span class="t">${T(b.label)}</span><span class="s">${t('Tempo tgl', 'Due day')} ${b.dueDay}</span></span><span class="num">${fmt(b.amount)}</span></div>`).join('')}</div>`;
    return U.frame('recurring', body);
  };

  // ── Pinjam (borrowing) ──────────────────────────────────────────────
  function lenderVisible(g, l) { return l.kind !== 'illegal' || g.loanOffers.some((o) => o.lenderId === 'illegal' && o.expiresAbs >= E.today(g)); }
  function kindText(l) {
    if (l.kind === 'flat_monthly') return t(`Cicilan bulanan · bunga flat ${(l.rate * 100).toLocaleString('id-ID')}%/bln${l.upfrontFee ? ` · biaya di muka ${Math.round(l.upfrontFee * 100)}%` : ''} · tenor ${l.tenors.join('/')} bln`, `Monthly instalments · flat ${(l.rate * 100).toLocaleString('en-US')}%/month${l.upfrontFee ? ` · ${Math.round(l.upfrontFee * 100)}% upfront fee` : ''} · ${l.tenors.join('/')} months`);
    if (l.kind === 'daily_bullet') return t(`Sekali bayar setelah ${l.days} hari · ${(l.dailyRate * 100).toLocaleString('id-ID')}%/hari`, `One repayment after ${l.days} days · ${(l.dailyRate * 100).toLocaleString('en-US')}%/day`);
    return t(`Tenor ${l.days} hari · ${Math.round(l.withhold * 100)}% dipotong di muka · denda ${Math.round(l.lateDaily * 100)}%/hari`, `${l.days}-day term · ${Math.round(l.withhold * 100)}% withheld · ${Math.round(l.lateDaily * 100)}%/day penalty`);
  }
  function lateText(l) {
    if (l.kind === 'illegal') return t('Denda harian sangat tinggi, penagihan dengan mempermalukan lewat kontak ponsel. Ini melanggar hukum.', 'Very high daily penalties and debt-shaming through your phone contacts. This is unlawful.');
    if (!l.late) return '';
    if (l.late.type === 'daily') return t(`Telat: denda ${(l.late.rate * 100).toLocaleString('id-ID')}% per hari dari cicilan; total biaya dibatasi 100% pokok. Skor kredit (fiktif) turun dan penagih menghubungi.`, `Late: ${(l.late.rate * 100).toLocaleString('en-US')}% of the instalment per day; total cost capped at 100% of principal. Your (fictional) credit score drops and collectors call.`);
    if (l.late.amount) return t(`Telat: denda ${fmt(M.rp(l.late.amount))} per cicilan; skor kredit (fiktif) turun.`, `Late: ${fmt(M.rp(l.late.amount))} per instalment; your (fictional) credit score drops.`);
    return t('Dipotong otomatis dari gaji, jadi jarang telat. Kalau gaji tidak cukup, cicilan menunggak.', 'Deducted from your salary, so rarely late. If your pay can\'t cover it, the instalment goes overdue.');
  }
  U.apps.pinjam = () => {
    const g = G();
    const tab = U.sub('pinjam', 'tab', 'offers');
    const sel = U.sub('pinjam', 'detail', null);
    if (sel) return loanDetail(sel);
    const debt = E.debtOutstanding(g);
    let body = `<div class="hero" style="background:#8b3a3a;color:#fff"><span class="lbl">${t('Total utang tersisa (pokok + bunga)', 'Debt outstanding (principal + interest)')}</span><span class="big num" style="font-family:var(--f-display)">${fmt(debt)}</span>
      <div class="split"><span>${t('Pokok', 'Principal')}<b>${fmt(E.principalOutstanding(g))}</b></span><span>${t('Pinjaman aktif', 'Active loans')}<b>${E.activeLoans(g).length}</b></span><span>${t('Skor kredit (fiktif)', 'Credit score (fictional)')}<b>${g.credit}/100</b></span></div></div>`;
    if (tab === 'offers') {
      body += `<small class="muted">${t('Uang pinjaman bukan pendapatan. Setiap cicilan terbagi atas pokok dan bunga/biaya; laporan menghitung bunga sebagai biaya keuangan. Semua pemberi pinjaman di sini fiktif.', 'Borrowed money is not income. Each instalment splits into principal and interest/fees; reports count interest as a finance cost. Every lender here is fictional.')}</small>`;
      for (const l of D.lenders.filter((x) => lenderVisible(g, x))) {
        const el = E.loanEligibility(g, l.id);
        const illegal = l.kind === 'illegal';
        body += `<div class="box ${illegal ? 'danger' : 'outline'}"><div class="row"><span class="grow"><span class="t">${T(l.name)}</span><span class="s">${esc(kindText(l))}</span></span>${illegal ? `<span class="pill p-warn">${t('ILEGAL', 'ILLEGAL')}</span>` : l.regulated && l.p2p ? `<span class="pill p-ok">${t('Berizin (fiktif)', 'Licensed (fictional)')}</span>` : pill(l.status)}</div>
          <small>${T(l.blurb)}</small>
          ${el.ok ? `<small class="muted">${t('Bisa diajukan', 'Available')}: ${fmt(el.min)} – ${fmt(el.max)}</small>` : `<div class="reqs">${el.reasons.map((r) => `<div class="req no">${ic('X')}<span>${T(r)}</span></div>`).join('')}</div>`}
          <button class="btn sm ${illegal ? 'warn' : 'sec'}" data-a="loan-sel" data-x="${l.id}">${illegal ? t('Lihat isi tawaran ini', 'See what this offer really is') : t('Simulasi biaya', 'See the full cost')}</button></div>`;
      }
    } else if (tab === 'loans') {
      const loans = g.loans.slice().reverse();
      body += loans.map((ln) => {
        const l = E.lender(ln.lenderId);
        const st = { active: [bi('Aktif', 'Active'), 'p-due'], late: [bi('Menunggak', 'Overdue'), 'p-warn'], repaid: [bi('Lunas', 'Repaid'), 'p-ok'] }[ln.status] || [bi(ln.status, ln.status), 'p-muted'];
        return `<div class="box outline"><div class="row"><span class="grow"><span class="t">${T(ln.name)}</span><span class="s">${t('Diterima', 'Received')} ${fmt(ln.received)} · ${t('total bayar', 'total to repay')} ${fmt(ln.totalRepay)} · ${t('biaya', 'cost')} ${fmt(ln.cost)} · APR ±${pct(ln.apr)}</span></span><span class="pill ${st[1]}">${T(st[0])}</span></div>
          <div class="list">${ln.schedule.map((s) => `<div class="li row"><span class="pill ${s.paid ? 'p-ok' : s.dueAbs < E.today(g) ? 'p-warn' : 'p-muted'}">${s.n}/${ln.schedule.length}</span><span class="grow small">${esc(E.absLabel(s.dueAbs))}${s.lateFee ? ` · ${t('denda', 'late fee')} ${fmt(s.lateFee)}` : ''}</span><span class="num">${fmt(s.amount + (s.lateFee || 0))}</span></div>`).join('')}</div>
          ${['active', 'late'].includes(ln.status) ? `<button class="btn sm" data-a="loan-early" data-x="${ln.id}">${t('Bayar cicilan berikutnya sekarang', 'Pay the next instalment now')}</button>` : ''}
          ${ln.reported ? `<small class="muted">${t('Sudah dilaporkan ke OJK dan polisi.', 'Reported to OJK and the police.')}</small>` : ''}
          ${l && l.kind === 'illegal' && ln.status !== 'repaid' ? `<small style="color:var(--coral)">${t('Kamu tidak wajib menerima penagihan yang mengancam atau mempermalukan. Laporkan ke OJK (157).', 'You do not have to put up with threats or shaming. Report it to OJK (157).')}</small>` : ''}</div>`;
      }).join('') || `<div class="empty">${t('Belum pernah meminjam.', 'No loans yet.')}</div>`;
    } else {
      body += `<div class="box"><b>${t('Ciri pinjaman berizin', 'Signs of a licensed lender')}</b>
        <div class="reqs">${[bi('Terdaftar dan diawasi OJK (cek daftar resmi OJK)', 'Registered with and supervised by OJK (check the official list)'), bi('Biaya total, bunga, denda dan jadwal ditunjukkan sebelum kamu setuju', 'Total cost, interest, penalties and schedule shown before you agree'), bi('Pinjol konsumtif 2026: biaya maks. 0,1% per hari; maks. 3 platform per orang', 'Consumer P2P 2026: max 0.1% per day all-in; at most 3 platforms per person'), bi('Hanya boleh mengakses kamera, mikrofon dan lokasi', 'May only access camera, microphone and location')].map((x) => `<div class="req ok">${ic('Check')}<span>${T(x)}</span></div>`).join('')}</div></div>
        <div class="box danger"><b>${t('Tanda bahaya pinjol ilegal', 'Red flags of an illegal lender')}</b>
        <div class="reqs">${[bi('Menawarkan lewat SMS/WhatsApp dari nomor pribadi', 'Offers by SMS/WhatsApp from personal numbers'), bi('"Cair 5 menit tanpa syarat"', '"Cash in 5 minutes, no requirements"'), bi('Uang yang diterima jauh lebih kecil dari yang "disetujui"', 'You receive much less than the "approved" amount'), bi('Meminta akses kontak dan galeri ponsel', 'Asks for access to your contacts and photo gallery'), bi('Tenor sangat pendek dan denda harian tinggi', 'Very short term and steep daily penalties')].map((x) => `<div class="req no">${ic('X')}<span>${T(x)}</span></div>`).join('')}</div>
        <small>${t('Laporkan ke OJK lewat kontak 157 dan ke polisi. Penagihan yang mengancam atau mempermalukan melanggar hukum.', 'Report to OJK on contact 157 and to the police. Collection that threatens or shames you is unlawful.')}</small></div>
        <small class="muted">${t('Batas biaya dan jumlah platform', 'Cost cap and platform limit')}: ${srcLink('ojk_p2p')}. ${t('Produk koperasi, bank dan paylater di game ini ilustratif.', 'Cooperative, bank and paylater terms in this game are illustrative.')}</small>`;
    }
    return U.frame('pinjam', body, { tabs: U.tabs('pinjam', [['offers', bi('Pilihan', 'Options')], ['loans', bi('Pinjamanku', 'My loans')], ['learn', bi('Kenali pinjol', 'Know the signs')]], tab), scrollKey: tab });
  };
  function loanDetail(id) {
    const g = G();
    const l = E.lender(id);
    const el = E.loanEligibility(g, id);
    const illegal = l.kind === 'illegal';
    const maxMajor = Math.max(el.min, el.max) / 100, minMajor = el.min / 100;
    let amt = Number(U.sub('pinjam', 'amt', minMajor));
    amt = Math.min(Math.max(amt, minMajor), maxMajor);
    const tenors = l.tenors || [null];
    const tenor = Number(U.sub('pinjam', 'tenor', tenors[0])) || tenors[0];
    const q = E.loanQuote(g, id, M.rp(amt), tenor);
    const ack = U.sub('pinjam', 'ack', false);
    let body = `${illegal ? `<div class="box danger"><b>${ic('ShieldAlert')} ${t('Ini contoh pinjaman ilegal', 'This is an example of an illegal loan')}</b><small>${t('Tidak terdaftar di OJK. Tawaran seperti ini bukan produk keuangan yang normal: potongan di muka besar, tenor sangat pendek, denda harian tinggi, dan penagihan lewat kontak ponselmu.', 'Not registered with OJK. Offers like this are not a normal financial product: a large upfront cut, a very short term, steep daily penalties, and collection through your phone contacts.')}</small></div>` : ''}
      <div class="box"><div class="kv"><span>${t('Pemberi pinjaman', 'Lender')}</span><span>${T(l.name)}</span></div><small class="muted">${esc(kindText(l))}</small></div>`;
    if (el.ok) {
      body += `<div class="box outline"><div class="field"><label for="lamt">${t('Jumlah pinjaman', 'Loan amount')}: <b class="num">${fmt(M.rp(amt))}</b></label><input id="lamt" type="range" min="${minMajor}" max="${maxMajor}" step="100000" value="${amt}" data-in="lamt"></div>
        ${l.tenors ? `<div class="field"><span class="lab">${t('Tenor', 'Term')}</span>${U.seg('loan-tenor', 'tenor', tenor, l.tenors.map((n) => [n, bi(`${n} bulan`, `${n} months`)]))}</div>` : ''}</div>`;
    }
    body += `<div class="receipt">
      <div class="kv"><span>${t('Disetujui', 'Approved amount')}</span><span>${fmt(q.amount)}</span></div>
      ${q.upfrontFee ? `<div class="kv"><span>${illegal ? t('"Biaya admin" dipotong', '"Admin fee" withheld') : t('Biaya di muka', 'Upfront fee')}</span><span>${fmt(-q.upfrontFee)}</span></div>` : ''}
      <div class="kv tot"><span>${t('Yang kamu terima', 'What you receive')}</span><span>${fmt(q.received)}</span></div><hr>
      <div class="kv"><span>${t('Total yang wajib dibayar', 'Total you must repay')}</span><span>${fmt(q.totalRepay)}</span></div>
      <div class="kv tot"><span>${t('Biaya meminjam', 'Cost of borrowing')}</span><span>${fmt(q.cost)}</span></div>
      <div class="kv"><span>${t('Setara per tahun (APR, perkiraan)', 'Annualised (APR, estimate)')}</span><span>${pct(q.apr)}</span></div><hr>
      ${q.schedule.map((s) => `<div class="kv"><span>${t('Cicilan', 'Instalment')} ${s.n} · ${esc(E.absLabel(s.dueAbs))}</span><span>${fmt(s.amount)}</span></div>`).join('')}</div>
      ${q.notes.map((n) => `<small class="muted">${T(n)}</small>`).join('')}
      <div class="box"><b>${t('Kalau telat bayar', 'If you pay late')}</b><small>${esc(lateText(l))}</small></div>`;
    if (!el.ok) body += `<div class="reqs">${el.reasons.map((r) => `<div class="req no">${ic('X')}<span>${T(r)}</span></div>`).join('')}</div>`;
    else if (illegal) body += `<div class="toggle"><span>${t('Saya mengerti ini pinjaman ilegal dengan risiko penagihan yang merugikan', 'I understand this is an illegal loan with harmful collection risks')}</span>${U.sw('loan-ack', 'ack', ack)}</div>`;
    const foot = `<div class="setup-foot"><button class="btn sec" data-a="loan-back">${illegal ? t('Tolak & abaikan', 'Decline & ignore') : t('Kembali', 'Back')}</button>${el.ok ? `<button class="btn ${illegal ? 'warn' : ''}" data-a="loan-take" data-x="${id}" ${illegal && !ack ? 'disabled' : ''}>${t('Ajukan', 'Borrow')} ${fmt(q.amount)}</button>` : ''}</div>`;
    return U.frame('pinjam', body, { title: L(l.name), backLabel: t('Pinjam', 'Borrow'), foot, scrollKey: 'detail' + id });
  }

  // ── Report ──────────────────────────────────────────────────────────
  U.apps.report = () => {
    const g = G();
    const final = g.phase === 'report';
    const r = final ? g.lastReport : E.generateMonthlyReport(g);
    const pastIdx = U.sub('report', 'past', null);
    const rep = pastIdx != null ? g.reports[pastIdx] : r;
    const kv = (l, v, style = '') => `<div class="kv"><span>${l}</span><span ${style}>${v}</span></div>`;
    let body = '';
    if (g.reports.length) body += `<div class="chips">${`<button class="chip ${pastIdx == null ? 'on' : ''}" data-a="rep-past" data-x="">${final ? t('Bulan ini', 'This month') : t('Sejauh ini', 'Month to date')}</button>`}${g.reports.map((x, i) => `<button class="chip ${pastIdx === i ? 'on' : ''}" data-a="rep-past" data-x="${i}">${t('Bulan', 'Month')} ${x.monthIndex}</button>`).join('')}</div>`;
    body += `<div class="hero" style="background:#0d4d63;color:#fff"><span class="lbl">${final && pastIdx == null ? t('Bulan selesai', 'Month complete') : `${t('Bulan', 'Month')} ${rep.monthIndex}${pastIdx == null ? ', ' + t('sejauh ini', 'so far') : ''}`}</span>
      <span class="big num" style="font-family:var(--f-display)">${fmt(rep.remaining)}</span><span class="lbl">${t('sisa pendapatan setelah pengeluaran, bunga, dan biaya sekali bayar', 'income left after spending, interest and one-off costs')}</span>
      <div class="split"><span>${t('Pendapatan', 'Income')}<b>${fmt(rep.income)}</b></span><span>${t('Pengeluaran', 'Spent')}<b>${fmt(rep.consumption)}</b></span><span>${t('Ke tabungan', 'To savings')}<b>${fmt(rep.netSavings)}</b></span></div></div>`;
    body += `<div class="section-t">${t('Posisimu', 'Where you landed')}</div><div class="ladder">${rep.ladder.map((x) => `<div class="rung ${x.reached ? 'on' : ''}"><span class="mk">${ic(x.reached ? 'Check' : 'Minus')}</span><span class="grow"><span class="t">${T(x.label)}</span>${x.detail ? `<span class="s small muted" style="display:block">${T(x.detail)}</span>` : ''}</span><span class="small">${x.reached ? t('Tercapai', 'Reached') : t('Belum', 'Not yet')}</span></div>`).join('')}</div>`;
    const met = (label, v, f) => `<div class="box outline metric"><span class="t" style="font-weight:700">${label}</span><span class="v">${pct(v)}</span><span class="f">${f}</span></div>`;
    body += `<div class="section-t">${t('Ukuran', 'Metrics')}</div>
      ${met(t('Rasio kebutuhan pokok', 'Essential expense ratio'), rep.essentialRatio, `(${t('tagihan', 'bills')} ${short(rep.mandatory)} + ${t('kebutuhan harian', 'everyday')} ${short(rep.variableEssential)} + ${t('kejutan pokok', 'essential surprises')} ${short(rep.unexpectedEss)} + ${t('bunga', 'interest')} ${short(rep.financeCost)}) ÷ ${t('pendapatan', 'income')} ${short(rep.income)}`)}
      ${met(t('Rasio belanja opsional', 'Discretionary ratio'), rep.discretionaryRatio, `(${t('opsional', 'optional')} ${short(rep.discretionary)} + ${t('kejutan opsional', 'optional surprises')} ${short(rep.unexpectedDisc)}) ÷ ${t('pendapatan', 'income')}`)}
      ${met(t('Tingkat menabung', 'Savings rate'), rep.savingsRate, `(${t('masuk', 'in')} ${short(rep.savingsIn)} − ${t('ditarik', 'out')} ${short(rep.savingsOut)}) ÷ ${t('pendapatan', 'income')}`)}
      <div class="box outline metric"><span class="t" style="font-weight:700">${t('Sisa pendapatan', 'Remaining income')}</span><span class="v">${short(rep.remaining)}</span><span class="f">${t('pendapatan', 'income')} ${short(rep.income)} − ${t('konsumsi', 'consumption')} ${short(rep.consumption)} − ${t('bunga', 'interest')} ${short(rep.financeCost)} − ${t('sekali bayar', 'one-off')} ${short(rep.upfront)}. ${t('Pinjaman yang cair dan pokok yang dibayar tidak dihitung sebagai pendapatan atau pengeluaran.', 'Loan money received and principal repaid are not counted as income or spending.')}</span></div>`;
    body += `<div class="section-t">${t('Rincian', 'Breakdown')}</div><div class="receipt">
      ${kv(t('Gaji', 'Salary'), fmt(rep.salary))}${rep.household ? kv(t('Penghasilan rumah tangga', 'Household income'), fmt(rep.household)) : ''}${kv(t('Pendapatan tambahan', 'Extra income'), fmt(rep.extraIncome))}${rep.benefits ? kv(t('Jaminan sosial (JHT/JKP)', 'Benefits (JHT/JKP)'), fmt(rep.benefits)) : ''}${rep.severance ? kv(t('Pesangon', 'Severance'), fmt(rep.severance)) : ''}<hr>
      ${kv(t('Tagihan wajib', 'Mandatory bills'), fmt(rep.mandatory))}${kv(t('Kebutuhan harian', 'Everyday essentials'), fmt(rep.variableEssential))}${kv(t('Belanja opsional', 'Optional spending'), fmt(rep.discretionary))}${kv(t('Tak terduga', 'Unexpected'), fmt(rep.unexpected))}${kv(t('Sekali bayar', 'One-off upfront'), fmt(rep.upfront))}${rep.refunds ? kv(t('Pengembalian dana (sudah dikurangkan)', 'Refunds (already netted)'), fmt(rep.refunds)) : ''}<hr>
      ${kv(t('Pinjaman cair', 'Loans received'), fmt(rep.loanIn))}${kv(t('Pokok dibayar', 'Principal repaid'), fmt(rep.principalRepaid))}${kv(t('Bunga & biaya pinjaman', 'Interest & loan fees'), fmt(rep.financeCost))}${kv(t('Utang di akhir', 'Debt at end'), fmt(rep.debtEnd))}<hr>
      ${kv(t('Kewajiban belum dibayar', 'Unpaid obligations'), fmt(rep.unpaidTotal), rep.unpaidTotal ? 'style="color:var(--coral)"' : '')}${kv(t('Saldo akhir', 'Wallet at end'), fmt(rep.walletEnd))}${kv(t('Tabungan akhir', 'Savings at end'), fmt(rep.savingsEnd))}<hr>
      ${kv(t('Makanan terbuang', 'Food wasted'), fmt(rep.waste))}${kv(t('Nilai stok makanan', 'Food in stock'), fmt(rep.inventoryValue))}${kv(t('Gizi 5 hari (perkiraan)', 'Nutrition, 5 days (estimate)'), `${rep.nutrition.score}/100 · ${T(rep.nutrition.label)}`)}<hr>
      ${kv(t('Kesejahteraan rata-rata', 'Average wellbeing'), rep.mood.wellbeing + '/100')}${kv(t('Stres rata-rata', 'Average stress'), rep.mood.stress + '/100')}${kv(t('Bosan rata-rata', 'Average boredom'), rep.mood.boredom + '/100')}${kv(t('Cemas soal uang', 'Financial anxiety'), rep.mood.anxiety + '/100')}<hr>
      ${kv(t('Barang opsional dibeli', 'Optional items bought'), rep.counters.optionalBought)}${kv(t('Keinginan ditahan / ditunda', 'Urges resisted / postponed'), `${rep.counters.resisted} / ${rep.counters.postponed}`)}${kv(t('Dibeli karena keinginan', 'Bought on an urge'), rep.counters.urgeBought)}
      ${kv(t('Masak / beli makan / terlewat', 'Cooked / bought / missed meals'), `${rep.counters.cooked} / ${rep.counters.boughtMeals} / ${rep.counters.missedMeals}`)}${kv(t('Hari tanpa listrik', 'Days without power'), rep.counters.outageDays)}
      ${kv(t('Hari sakit / terlambat / absen', 'Sick / late / missed workdays'), `${rep.counters.sickDays} / ${rep.counters.lateDays} / ${rep.counters.missedWork}`)}${kv(t('Kegiatan gratis / berbayar', 'Free / paid activities'), `${rep.counters.freeActivities} / ${rep.counters.paidActivities}`)}
      ${kv(t('Lamaran / wawancara / tawaran / ditolak', 'Applications / interviews / offers / rejections'), `${rep.counters.applications} / ${rep.counters.interviews} / ${rep.counters.offers} / ${rep.counters.rejections}`)}${rep.perf != null ? kv(t('Kinerja rata-rata', 'Average performance'), rep.perf + '/100') : ''}</div>
      ${rep.unpaid.length ? `<div class="box"><b>${t('Belum dibayar', 'Unpaid')}</b>${rep.unpaid.map((u) => `<div class="kv"><span>${T(u.label)}</span><span class="num">${fmt(u.amount)}</span></div>`).join('')}<small class="muted">${t('Pindah ke bulan depan sebagai tunggakan.', 'These carry into next month as arrears.')}</small></div>` : ''}
      <small class="muted">${t('Tangga ini menggambarkan apa yang dimungkinkan bulan ini, bukan seberapa "pintar" kamu bermain. Pilihan yang sama berakhir berbeda di kota atau rumah yang berbeda.', 'The ladder describes what the month allowed, not how "well" you played. The same choices land differently in a different city or home.')}</small>`;
    const foot = final && pastIdx == null ? `<div class="setup-foot"><button class="btn sec" data-a="open" data-x="compare">${t('Bandingkan tempat', 'Compare places')}</button><button class="btn" data-a="next-month">${t('Mulai bulan', 'Start month')} ${g.monthIndex + 1}</button></div>` : '';
    return U.frame('report', body, { title: final ? t('Akhir bulan', 'End of month') : t('Laporan', 'Report'), foot });
  };

  // ── actions ─────────────────────────────────────────────────────────
  const num = (v) => Number(String(v).replace(/\D/g, '')) || 0;
  Object.assign(U.A, {
    tx(el) { ui.sheet = { type: 'tx', id: el.dataset.x }; },
    'pay-bill'(el) { const p = U.prev(); U.result(E.processBillPayment(G(), el.dataset.x), t('Tagihan dibayar.', 'Bill paid.')); U.after(p); },
    autopay(el) { const b = G().bills.find((x) => x.id === el.dataset.x); E.setAutopay(G(), el.dataset.x, !b.autopay); U.save(); },
    samt(el) { U.setSub('futureme', { amt: Number(el.dataset.x) }); },
    'save-in'(el) { U.result(E.processSavingsTransfer(G(), M.rp(num(U.sub('futureme', 'amt', 100000))), 'in', el.dataset.x), t('Dipindah ke tabungan.', 'Moved to savings.')); U.save(); },
    'save-out'(el) { U.result(E.processSavingsTransfer(G(), M.rp(num(U.sub('futureme', 'amt', 100000))), 'out', el.dataset.x), t('Dipindah ke dompet.', 'Moved back to your wallet.')); U.save(); },
    'add-goal'() { const k = U.sub('futureme', 'gname', 'edu'); const name = GOALS.find((x) => x[0] === k)[1]; const tgt = M.rp(num(U.sub('futureme', 'gtarget', 2000000))); if (!tgt) { U.toast(t('Isi target dulu.', 'Enter a target first.'), true); return; } E.addGoal(G(), name, tgt, k); U.toast(t('Tujuan dibuat.', 'Goal created.')); U.save(); },
    subscribe(el) { const p = U.prev(); U.result(E.subscribe(G(), el.dataset.x), t('Berlangganan.', 'Subscribed.')); U.after(p); },
    unsub(el) { E.cancelSubscription(G(), el.dataset.x); U.toast(t('Dibatalkan. Tidak ada perpanjangan lagi.', 'Cancelled. No more renewals.')); U.save(); },
    'loan-sel'(el) { const elig = E.loanEligibility(G(), el.dataset.x); U.setSub('pinjam', { detail: el.dataset.x, amt: elig.min / 100, tenor: (E.lender(el.dataset.x).tenors || [null])[0], ack: false }); },
    'loan-back'() { const id = U.sub('pinjam', 'detail'); if (id === 'illegal') { G().loanOffers = G().loanOffers.filter((o) => o.lenderId !== 'illegal'); E.applyMood(G(), { anxiety: -2 }); U.toast(t('Tawaran diabaikan.', 'Offer ignored.')); U.save(); } U.setSub('pinjam', { detail: null }); },
    'loan-tenor'(el) { U.setSub('pinjam', { tenor: Number(el.dataset.x) }); },
    'loan-ack'() { U.setSub('pinjam', { ack: !U.sub('pinjam', 'ack', false) }); },
    'loan-take'(el) { const p = U.prev(); const res = E.takeLoan(G(), el.dataset.x, M.rp(Number(U.sub('pinjam', 'amt', 0))), Number(U.sub('pinjam', 'tenor', 0)) || undefined); if (U.result(res, t(`Pinjaman cair: ${fmt(res.loan ? res.loan.received : 0)}. Cicilan muncul di Tagihan.`, `Loan received: ${fmt(res.loan ? res.loan.received : 0)}. Instalments appear in Bills.`))) U.setSub('pinjam', { detail: null, tab: 'loans' }); U.after(p); },
    'loan-early'(el) { const p = U.prev(); U.result(E.payLoanEarly(G(), el.dataset.x), t('Cicilan dibayar.', 'Instalment paid.')); U.after(p); },
    'next-month'() { const p = U.prev(); U.result(E.startNextMonth(G())); ui.app = null; ui.sub.report = {}; if (G().activeEvent) ui.eventOpen = true; U.after(p); },
    'rep-past'(el) { U.setSub('report', { past: el.dataset.x === '' ? null : Number(el.dataset.x) }); },
  });
  Object.assign(U.IN, {
    samt(el) { U.setSub('futureme', { amt: num(el.value) }); },
    gname(el) { U.setSub('futureme', { gname: el.value }); },
    gtarget(el) { U.setSub('futureme', { gtarget: num(el.value) }); },
    lamt(el) { U.setSub('pinjam', { amt: Number(el.value) }); },
  });
  ['samt', 'gtarget'].forEach((k) => U.LIVE.add(k));
})(typeof globalThis !== 'undefined' ? globalThis : this);
