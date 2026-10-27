/*
 * lenders.js — fictional lending products (source `fictional_brands`).
 * Regulated P2P products follow the OJK caps for 2026 (source `ojk_p2p`):
 * consumptive loans ≤ 0,1% per day including fees; at most 3 P2P platforms.
 * Koperasi, bank and paylater terms are ILLUSTRATIVE.
 *
 * kind:
 *   flat_monthly  equal monthly instalments; interest = principal × rate × months
 *   daily_bullet  one repayment at the end; cost = principal × daily rate × days
 *   illegal       unlicensed offer: part of the "approved" amount is withheld
 */
(function (root) {
  const RLS = (root.RLS = root.RLS || {});
  RLS.data = RLS.data || {};
  const { bi } = RLS.i18n;

  RLS.data.lenders = [
    { id: 'koperasi', name: bi('Koperasi karyawan', 'Staff cooperative'), kind: 'flat_monthly', regulated: true, rate: 0.01, tenors: [3, 6, 12], upfrontFee: 0,
      min: 500000, maxWageMult: 2, payroll: true, status: 'ILLUSTRATIVE', sourceId: 'game_assumption',
      requires: { employed: true, koperasi: true, tenureMonths: 3 },
      late: { type: 'flat', amount: 0 }, blurb: bi('Cicilan dipotong otomatis dari gaji setiap tanggal 1.', 'Instalments are deducted from your salary on the 1st of each month.') },
    { id: 'bank_kta', name: bi('Bank Mitra Nusa — KTA', 'Bank Mitra Nusa — personal loan'), kind: 'flat_monthly', regulated: true, rate: 0.015, tenors: [12, 24], upfrontFee: 0.03,
      min: 3000000, maxWageMult: 5, maxAbs: 20000000, status: 'ILLUSTRATIVE', sourceId: 'game_assumption',
      requires: { employed: true, tenureMonths: 12, minWage: 3000000, credit: 60, doc: 'employment_letter' },
      late: { type: 'flat', amount: 50000 }, blurb: bi('Bunga lebih rendah, tapi syaratnya ketat dan prosesnya beberapa hari.', 'Lower interest, but strict requirements and a few days to process.'), processDays: 3 },
    { id: 'p2p_30', name: bi('DanaTertib — pinjaman 30 hari', 'DanaTertib — 30-day loan'), kind: 'daily_bullet', regulated: true, p2p: true, dailyRate: 0.001, days: 30, upfrontFee: 0,
      min: 500000, maxWageMult: 0.6, maxAbs: 3000000, status: 'ESTIMATED', sourceId: 'ojk_p2p',
      requires: { credit: 35, age: 18 }, late: { type: 'daily', rate: 0.001 },
      blurb: bi('Pinjol berizin (fiktif). Biaya total mengikuti batas OJK 0,1% per hari.', 'Licensed P2P lender (fictional). Total cost follows the OJK cap of 0.1% per day.') },
    { id: 'p2p_inst', name: bi('CicilAman — cicilan 3–6 bulan', 'CicilAman — 3–6 month instalments'), kind: 'flat_monthly', regulated: true, p2p: true, rate: 0.03, tenors: [3, 6], upfrontFee: 0,
      min: 1000000, maxWageMult: 1, maxAbs: 6000000, status: 'ESTIMATED', sourceId: 'ojk_p2p',
      requires: { credit: 45, age: 18, income: true }, late: { type: 'daily', rate: 0.001 },
      blurb: bi('Pinjol berizin (fiktif). 3% per bulan ≈ 0,1% per hari, di batas OJK.', 'Licensed P2P lender (fictional). 3% per month ≈ 0.1% per day, at the OJK cap.') },
    { id: 'paylater', name: bi('BayarNanti — paylater', 'BayarNanti — paylater'), kind: 'flat_monthly', regulated: true, rate: 0.025, tenors: [3, 6], upfrontFee: 0.01,
      min: 300000, maxWageMult: 0.5, maxAbs: 3000000, status: 'ILLUSTRATIVE', sourceId: 'game_assumption',
      requires: { credit: 40, age: 18 }, late: { type: 'daily', rate: 0.001 },
      blurb: bi('Mudah disetujui. Cicilan kecil terasa ringan, tapi bunganya terus berjalan.', 'Easy to approve. Small instalments feel light, but interest keeps running.') },
    { id: 'illegal', name: bi('"Pinjaman Kilat Cair 5 Menit"', '"Instant Cash in 5 Minutes"'), kind: 'illegal', regulated: false, days: 7, withhold: 0.3, lateDaily: 0.05,
      min: 1000000, maxAbs: 3000000, status: 'ILLUSTRATIVE', sourceId: 'game_assumption', requires: {},
      blurb: bi('TIDAK TERDAFTAR DI OJK. Contoh tawaran pinjol ilegal: potongan besar di muka, tenor sangat pendek, denda harian tinggi, dan meminta akses kontak.', 'NOT REGISTERED WITH OJK. An example of an illegal lending offer: a large upfront cut, a very short term, steep daily penalties and a demand for contact access.') },
  ];
  if (typeof module !== 'undefined' && module.exports) module.exports = RLS.data.lenders;
})(typeof globalThis !== 'undefined' ? globalThis : this);
