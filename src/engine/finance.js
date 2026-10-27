/*
 * engine/finance.js — loans and repayments.
 *
 * A loan credits the wallet with what you actually receive (cls 'loan_in',
 * not income), records a liability, and schedules instalments as bills.
 * Each instalment splits into principal (reduces the debt, not spending) and
 * cost (interest and fees, counted as a finance cost). Nothing is deducted
 * except on the due date (autopay) or when you pay voluntarily.
 */
(function (root) {
  const RLS = root.RLS;
  const E = RLS.engine;
  const M = RLS.money;
  const { rp } = M;
  const { bi, L } = RLS.i18n;
  const D = () => RLS.data;
  const { clamp } = E;

  function initFinance(state) { state.loans = []; state.credit = 62; state.loanHarassDays = 0; state.loanOffers = []; }
  E._inits.push(initFinance);

  const lender = (id) => D().lenders.find((l) => l.id === id);
  const activeLoans = (state) => state.loans.filter((l) => l.status === 'active' || l.status === 'late');
  const p2pCount = (state) => activeLoans(state).filter((l) => lender(l.lenderId).p2p).length;
  function debtOutstanding(state) { return activeLoans(state).reduce((s, l) => s + l.schedule.filter((x) => !x.paid).reduce((a, x) => a + x.amount + (x.lateFee || 0), 0), 0); }
  function principalOutstanding(state) { return activeLoans(state).reduce((s, l) => s + l.schedule.filter((x) => !x.paid).reduce((a, x) => a + x.principal, 0), 0); }

  /** Monthly income the lender would see. */
  function incomeFor(state) {
    const wage = state.job && E.isEmployed(state) ? state.job.wage : 0;
    const hh = state.config.household;
    return wage + (hh.partner && hh.partnerWorks && hh.sharedIncome ? hh.partnerIncome : 0);
  }
  function eligibility(state, lid) {
    const l = lender(lid);
    const req = l.requires || {};
    const reasons = [];
    const emp = state.employment;
    const tenure = state.job ? (E.today(state) - state.job.startAbs) / 30.4 : 0;
    if (req.employed && !E.isEmployed(state)) reasons.push(bi('Harus sedang bekerja', 'Must be employed'));
    if (req.koperasi && !(state.job && state.job.koperasi)) reasons.push(bi('Tempat kerjamu tidak punya koperasi karyawan', 'Your workplace has no staff cooperative'));
    if (req.tenureMonths && tenure < req.tenureMonths) reasons.push(bi(`Masa kerja minimal ${req.tenureMonths} bulan`, `At least ${req.tenureMonths} months in the job`));
    if (req.minWage && (!state.job || state.job.wage < rp(req.minWage))) reasons.push(bi(`Gaji minimal ${M.format(rp(req.minWage))}`, `Salary of at least ${M.format(rp(req.minWage))}`));
    if (req.credit && state.credit < req.credit) reasons.push(bi('Skor kredit (fiktif) belum memenuhi', 'Credit score (fictional) too low'));
    if (req.age && state.config.character.age < req.age) reasons.push(bi('Usia minimal 18 tahun', 'Must be 18 or older'));
    if (req.income && incomeFor(state) <= 0) reasons.push(bi('Butuh penghasilan rutin', 'Needs a regular income'));
    if (req.doc && !E.docStatus(state, req.doc).valid) reasons.push(bi(`Butuh ${D().travel.docById[req.doc].name.id}`, `Needs ${D().travel.docById[req.doc].name.en}`));
    if (l.p2p && p2pCount(state) >= 3) reasons.push(bi('Sudah meminjam di 3 platform (batas OJK)', 'Already borrowing from 3 platforms (OJK limit)'));
    if (activeLoans(state).some((x) => x.lenderId === lid)) reasons.push(bi('Masih ada pinjaman aktif di sini', 'You still have an active loan here'));
    if (activeLoans(state).some((x) => x.status === 'late') && l.regulated && l.id !== 'koperasi') reasons.push(bi('Ada pinjaman yang menunggak', 'You have an overdue loan'));
    const inc = incomeFor(state);
    const max = l.kind === 'illegal' ? rp(l.maxAbs) : Math.min(rp(l.maxAbs || 1e12), Math.round(Math.max(inc, l.requires.income || l.requires.employed ? inc : rp(2000000)) * (l.maxWageMult || 1)));
    if (max < rp(l.min)) reasons.push(bi('Limit yang bisa diberikan terlalu kecil', 'The limit you would get is too small'));
    return { ok: !reasons.length, reasons, max: Math.max(0, M.roundTo(max, rp(100000))), min: rp(l.min) };
  }

  /** Full cost disclosure before you confirm. */
  function quote(state, lid, amount, tenor) {
    const l = lender(lid);
    const today = E.today(state);
    const out = { lender: l, amount, tenor, schedule: [], received: amount, upfrontFee: 0, totalRepay: 0, cost: 0, apr: 0, notes: [] };
    if (l.kind === 'flat_monthly') {
      const n = tenor;
      const interest = Math.round(amount * l.rate * n);
      const fee = Math.round(amount * (l.upfrontFee || 0));
      out.upfrontFee = fee; out.received = amount - fee;
      const per = Math.round((amount + interest) / n);
      const pPer = Math.round(out.received / n);
      for (let i = 1; i <= n; i++) {
        const due = l.payroll ? E.dayNumber({ ...E.addMonthsStart(state.date, i) }) : today + Math.round(30.4 * i);
        const last = i === n;
        const amt = last ? amount + interest - per * (n - 1) : per;
        const prin = last ? out.received - pPer * (n - 1) : pPer;
        out.schedule.push({ n: i, dueAbs: due, amount: amt, principal: prin, paid: false });
      }
      out.totalRepay = amount + interest; out.cost = out.totalRepay - out.received;
      out.apr = irrAnnual(out.received, out.schedule.map((s) => s.amount));
      out.notes.push(bi(`Bunga flat ${(l.rate * 100).toLocaleString('id-ID')}% per bulan dari pokok`, `Flat interest of ${(l.rate * 100).toLocaleString('en-US')}% of principal per month`));
      if (fee) out.notes.push(bi(`Biaya provisi ${Math.round(l.upfrontFee * 100)}% dipotong di muka`, `${Math.round(l.upfrontFee * 100)}% provision fee taken up front`));
    } else if (l.kind === 'daily_bullet') {
      const cost = Math.round(amount * l.dailyRate * l.days);
      out.schedule.push({ n: 1, dueAbs: today + l.days, amount: amount + cost, principal: amount, paid: false });
      out.totalRepay = amount + cost; out.cost = cost; out.apr = l.dailyRate * 365;
      out.notes.push(bi(`${(l.dailyRate * 100).toLocaleString('id-ID')}% per hari × ${l.days} hari (batas OJK 2026 untuk pinjaman konsumtif)`, `${(l.dailyRate * 100).toLocaleString('en-US')}% per day × ${l.days} days (OJK 2026 cap for consumer loans)`));
    } else {
      const withheld = Math.round(amount * l.withhold);
      out.upfrontFee = withheld; out.received = amount - withheld;
      out.schedule.push({ n: 1, dueAbs: today + l.days, amount, principal: out.received, paid: false });
      out.totalRepay = amount; out.cost = withheld; out.apr = (withheld / out.received) * (365 / l.days);
      out.notes.push(bi(`${Math.round(l.withhold * 100)}% "biaya admin" dipotong; kamu menerima ${M.format(out.received)} tapi wajib bayar ${M.format(amount)} dalam ${l.days} hari`, `${Math.round(l.withhold * 100)}% "admin fee" withheld; you receive ${M.format(out.received)} but owe ${M.format(amount)} in ${l.days} days`));
      out.notes.push(bi(`Denda ${Math.round(l.lateDaily * 100)}% per hari jika telat. Meminta akses kontak ponsel.`, `${Math.round(l.lateDaily * 100)}% per day late penalty. Asks for access to your phone contacts.`));
      out.illegal = true;
    }
    out.late = l.late || null;
    return out;
  }
  function irrAnnual(pv, payments) {
    let lo = 0, hi = 1;
    const f = (r) => payments.reduce((s, p, i) => s + p / Math.pow(1 + r, i + 1), 0) - pv;
    for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2; if (f(mid) > 0) lo = mid; else hi = mid; }
    return Math.pow(1 + (lo + hi) / 2, 12) - 1;
  }
  E.addMonthsStart = (dt, n) => { const t = new Date(Date.UTC(dt.year, dt.month + n, 1)); return { year: t.getUTCFullYear(), month: t.getUTCMonth(), day: 1 }; };

  function takeLoan(state, lid, amount, tenor) {
    const l = lender(lid);
    if (!l) return { ok: false, error: 'unknown' };
    if (l.kind === 'illegal' && !state.loanOffers.some((o) => o.lenderId === 'illegal' && o.expiresAbs >= E.today(state))) return { ok: false, error: 'no_offer' };
    const el = eligibility(state, lid);
    if (!el.ok) return { ok: false, error: 'not_eligible', reasons: el.reasons };
    if (!Number.isInteger(amount) || amount < el.min || amount > el.max) return { ok: false, error: 'invalid_amount' };
    if (l.kind === 'flat_monthly' && !l.tenors.includes(tenor)) return { ok: false, error: 'invalid_tenor' };
    const q = quote(state, lid, amount, tenor);
    const loan = { id: 'loan' + state.seq++, lenderId: lid, name: l.name, amount, received: q.received, totalRepay: q.totalRepay, cost: q.cost, apr: q.apr, startAbs: E.today(state), schedule: q.schedule, status: 'active', regulated: l.regulated, payroll: !!l.payroll };
    state.loans.push(loan);
    E.credit(state, { merchant: l.name, category: 'loan', cls: 'loan_in', amount: q.received, note: bi(`Pinjaman cair. Total wajib bayar ${M.format(q.totalRepay)}`, `Loan paid out. Total to repay ${M.format(q.totalRepay)}`) });
    loanBillsForMonth(state);
    if (l.kind === 'illegal') { state.loanOffers = state.loanOffers.filter((o) => o.lenderId !== 'illegal'); E.applyMood(state, { anxiety: 10 }); }
    else E.applyMood(state, { anxiety: -6, stress: -2 });
    return { ok: true, loan };
  }
  /** Create bills for instalments that fall due in the current month. */
  function loanBillsForMonth(state) {
    const y = state.date.year, m = state.date.month;
    for (const loan of activeLoans(state)) {
      for (const s of loan.schedule) {
        if (s.paid || s.billed) continue;
        const dt = E.fromDayNumber(s.dueAbs);
        if (dt.year !== y || dt.month !== m) continue;
        const b = E.addBill(state, { key: `loan-${loan.id}-${s.n}`, label: bi(`Cicilan ${L(loan.name)} (${s.n}/${loan.schedule.length})`, `${L(loan.name)} instalment (${s.n}/${loan.schedule.length})`), category: 'loan', amount: s.amount + (s.lateFee || 0), principal: s.principal, dueDay: dt.day, loanId: loan.id, installment: s.n, autopay: true, forcedAutopay: !!loan.payroll, adjustable: false });
        if (b) s.billed = true;
      }
    }
  }
  function onLoanBillPaid(state, bill) {
    const loan = state.loans.find((l) => l.id === bill.loanId);
    if (!loan) return;
    const s = loan.schedule.find((x) => x.n === bill.installment);
    if (s) { s.paid = true; s.paidAbs = E.today(state); }
    if (loan.schedule.every((x) => x.paid)) {
      loan.status = 'repaid';
      if (loan.regulated) state.credit = clamp(state.credit + 6, 0, 100);
      E.notify(state, 'pinjam', bi('Pinjaman lunas', 'Loan repaid'), bi(`${L(loan.name)} sudah lunas.`, `${L(loan.name)} is paid off.`), 'info');
      E.applyMood(state, { anxiety: -8, happiness: 3 });
    } else if (loan.status === 'late' && !loan.schedule.some((x) => !x.paid && x.dueAbs < E.today(state))) loan.status = 'active';
  }
  /** Daily: late fees, credit score, collection pressure. Overdue instalments from earlier months stay payable. */
  function loanDaily(state) {
    const today = E.today(state);
    carryLoanBills(state);
    state.loanHarassDays = Math.max(0, state.loanHarassDays - 1);
    for (const loan of activeLoans(state)) {
      const l = lender(loan.lenderId);
      for (const s of loan.schedule) {
        if (s.paid || s.dueAbs >= today) continue;
        if (loan.status !== 'late') { loan.status = 'late'; if (l.regulated) state.credit = clamp(state.credit - 12, 0, 100); E.notify(state, 'pinjam', bi('Cicilan terlambat', 'Instalment overdue'), bi(`${L(loan.name)}: ${l.late && l.late.type === 'daily' ? 'denda harian berjalan' : 'denda keterlambatan berlaku'}. Bayar di Tagihan.`, `${L(loan.name)}: ${l.late && l.late.type === 'daily' ? 'daily late fees are running' : 'a late fee applies'}. Pay it in Bills.`), 'warn'); }
        let fee = 0;
        if (l.kind === 'illegal') fee = Math.round(s.amount * l.lateDaily);
        else if (l.late && l.late.type === 'daily') {
          const cap = loan.amount - loan.cost - (s.lateFee || 0); // total cost capped at 100% of principal (OJK)
          fee = Math.max(0, Math.min(Math.round(s.amount * l.late.rate), cap));
        } else if (l.late && l.late.type === 'flat' && !s.flatApplied) { fee = rp(l.late.amount); s.flatApplied = true; }
        if (fee > 0) {
          s.lateFee = (s.lateFee || 0) + fee;
          const bill = state.bills.find((b) => b.loanId === loan.id && b.installment === s.n);
          if (bill && bill.status !== 'paid') bill.amount = s.amount + s.lateFee;
        }
        if (!s.billed) loanBillsForMonth(state);
        const days = today - s.dueAbs;
        if (l.kind === 'illegal' && days >= 1) { state.loanHarassDays = 3; if (days % 2 === 1) E.queueEvent(state, 'collector_illegal', { loanId: loan.id }); }
        else if (days === 10 || days === 30) E.notify(state, 'pinjam', bi('Penagihan', 'Collection call'), bi('Petugas penagihan menghubungimu soal cicilan yang tertunggak.', 'A collector called about your overdue instalment.'), 'warn');
      }
    }
  }
  function carryLoanBills(state) {
    for (const b of state.bills) if (b.loanId && b.status !== 'paid' && b.month < state.monthIndex) { b.month = state.monthIndex; b.id = `${state.monthIndex}-${b.key}`; b.status = 'overdue'; b.dueDay = 1; }
  }
  /** Sometimes, when money is very tight, an illegal lender texts you. */
  function maybeIllegalOffer(state) {
    if (state.mood.anxiety < 62 || state.loanOffers.some((o) => o.lenderId === 'illegal')) return;
    const r = E.rng(state, 'sms-loan');
    if (r() > 0.12) return;
    state.loanOffers.push({ lenderId: 'illegal', expiresAbs: E.today(state) + 2 });
    E.notify(state, 'pinjam', bi('SMS: "Dana cair 5 menit tanpa syarat!"', 'Text: "Cash in 5 minutes, no requirements!"'), bi('Tawaran dari nomor tak dikenal. Pemberi pinjaman ini tidak terdaftar di OJK.', 'An offer from an unknown number. This lender is not registered with OJK.'), 'warn');
  }
  function payLoanEarly(state, loanId) {
    const loan = state.loans.find((l) => l.id === loanId);
    if (!loan || !['active', 'late'].includes(loan.status)) return { ok: false };
    const next = loan.schedule.find((s) => !s.paid);
    if (!next) return { ok: false };
    let bill = state.bills.find((b) => b.loanId === loan.id && b.installment === next.n && b.status !== 'paid');
    if (!bill) { bill = E.addBill(state, { key: `loan-${loan.id}-${next.n}-early`, label: bi(`Cicilan ${L(loan.name)} (${next.n}/${loan.schedule.length}) — bayar awal`, `${L(loan.name)} instalment (${next.n}/${loan.schedule.length}) — early`), category: 'loan', amount: next.amount + (next.lateFee || 0), principal: next.principal, dueDay: state.date.day, loanId: loan.id, installment: next.n }); next.billed = true; }
    return E.processBillPayment(state, bill.id);
  }
  Object.assign(E, { lender, activeLoans, debtOutstanding, principalOutstanding, loanEligibility: eligibility, loanQuote: quote, takeLoan, loanBillsForMonth, onLoanBillPaid, loanDaily, maybeIllegalOffer, payLoanEarly });
})(typeof globalThis !== 'undefined' ? globalThis : this);
