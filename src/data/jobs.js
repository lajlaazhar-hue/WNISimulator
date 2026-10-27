/*
 * jobs.js — character options, starting jobs and the job-listing generator's templates.
 * All employers and listings are FICTIONAL (source `fictional_brands`).
 * Salary ranges are multiples of the local minimum wage, chosen for gameplay.
 */
(function (root) {
  const RLS = (root.RLS = root.RLS || {});
  RLS.data = RLS.data || {};
  const { bi } = RLS.i18n;

  const EDUCATION = [
    { id: 'none', rank: 0, label: bi('Tidak bersekolah formal', 'No formal education') },
    { id: 'sd', rank: 1, label: bi('SD', 'Primary school') },
    { id: 'smp', rank: 2, label: bi('SMP', 'Junior high school') },
    { id: 'sma', rank: 3, label: bi('SMA/sederajat', 'Senior high school or equivalent') },
    { id: 'smk', rank: 3, vocational: true, label: bi('SMK', 'Vocational high school') },
    { id: 'd3', rank: 4, label: bi('Diploma (D3)', 'Diploma (D3)') },
    { id: 's1', rank: 5, label: bi('Sarjana (S1)', 'Bachelor\'s degree') },
    { id: 's2', rank: 6, label: bi('Magister (S2)', 'Master\'s degree') },
    { id: 's3', rank: 7, label: bi('Doktor (S3)', 'Doctoral degree') },
  ];
  const ENGLISH = [
    { id: 'none', rank: 0, label: bi('Tidak bisa', 'None') },
    { id: 'basic', rank: 1, label: bi('Dasar', 'Basic') },
    { id: 'intermediate', rank: 2, label: bi('Menengah', 'Intermediate') },
    { id: 'fluent', rank: 3, label: bi('Lancar', 'Fluent') },
  ];
  const DIGITAL = [
    { id: 'basic', rank: 1, label: bi('Dasar (chat, media sosial)', 'Basic (chat, social media)') },
    { id: 'intermediate', rank: 2, label: bi('Menengah (dokumen, email, spreadsheet)', 'Intermediate (documents, email, spreadsheets)') },
    { id: 'advanced', rank: 3, label: bi('Mahir (tools kerja, otomasi)', 'Advanced (work tools, automation)') },
  ];
  const OTHER_LANG = [
    { id: 'none', label: bi('Tidak ada', 'None') },
    { id: 'mandarin', label: bi('Mandarin', 'Mandarin') },
    { id: 'japanese', label: bi('Jepang', 'Japanese') },
    { id: 'korean', label: bi('Korea', 'Korean') },
    { id: 'arabic', label: bi('Arab', 'Arabic') },
    { id: 'regional', label: bi('Bahasa daerah (Jawa, Sunda, dll.)', 'A regional language (Javanese, Sundanese, …)') },
  ];
  const SKILLS = [
    ['office', bi('Microsoft Office', 'Microsoft Office')], ['customer', bi('Layanan pelanggan', 'Customer service')], ['sales', bi('Penjualan', 'Sales')],
    ['cashier', bi('Kasir', 'Cashiering')], ['cooking', bi('Memasak', 'Cooking')], ['barista', bi('Barista', 'Barista')],
    ['warehouse', bi('Gudang & logistik', 'Warehouse & logistics')], ['driving', bi('Mengemudi motor', 'Motorbike riding')], ['design', bi('Desain grafis', 'Graphic design')],
    ['copywriting', bi('Menulis konten', 'Copywriting')], ['socialmedia', bi('Media sosial', 'Social media')], ['data', bi('Analisis data', 'Data analysis')],
    ['accounting', bi('Akuntansi dasar', 'Basic accounting')], ['programming', bi('Pemrograman', 'Programming')], ['machine', bi('Operasional mesin', 'Machine operation')],
    ['cleaning', bi('Kebersihan profesional', 'Professional cleaning')], ['hospitality', bi('Perhotelan', 'Hospitality')],
  ];
  const CERTS = [
    ['k3', bi('Sertifikat K3 umum', 'General OHS (K3) certificate')], ['foodhandler', bi('Sertifikat penjamah makanan', 'Food handler certificate')],
    ['gada', bi('Gada Pratama (satpam)', 'Gada Pratama (security guard)')], ['brevet', bi('Brevet pajak A/B', 'Tax brevet A/B')],
  ];

  /*
   * Job kinds decide which personal factors matter on the job:
   *  desk      focus, energy, task completion
   *  customer  dress/grooming rules, energy, punctuality
   *  standing  footwear comfort, energy
   *  physical  energy, footwear; employer provides protective equipment (APD)
   */
  const KINDS = {
    desk: { label: bi('Kerja meja', 'Desk work'), stress: 7, energy: 26, dress: 'office', standing: false },
    customer: { label: bi('Melayani pelanggan', 'Customer-facing'), stress: 9, energy: 30, dress: 'uniform', standing: true },
    standing: { label: bi('Banyak berdiri', 'On your feet'), stress: 7, energy: 34, dress: 'uniform', standing: true },
    physical: { label: bi('Kerja fisik', 'Physical work'), stress: 6, energy: 40, dress: 'ppe', standing: true },
  };

  // Starting jobs (all paid the local minimum wage in this game).
  const STARTING_JOBS = [
    { id: 'retail', title: bi('Pramuniaga minimarket', 'Minimarket shop assistant'), kind: 'customer', minEdu: 3, type: 'pkwt', termMonths: 12, uniform: true, sector: 'retail', koperasi: false },
    { id: 'fnb', title: bi('Kru restoran cepat saji', 'Fast-food crew'), kind: 'customer', minEdu: 3, type: 'pkwt', termMonths: 12, uniform: true, sector: 'fnb', koperasi: false },
    { id: 'factory', title: bi('Operator produksi pabrik', 'Factory production operator'), kind: 'physical', minEdu: 3, type: 'pkwt', termMonths: 12, uniform: true, sector: 'manufacturing', koperasi: true },
    { id: 'warehouse', title: bi('Staf gudang', 'Warehouse staff'), kind: 'physical', minEdu: 2, type: 'pkwt', termMonths: 6, uniform: true, sector: 'logistics', koperasi: false },
    { id: 'admin', title: bi('Staf administrasi', 'Administrative staff'), kind: 'desk', minEdu: 3, type: 'pkwt', termMonths: 12, uniform: false, sector: 'services', koperasi: true },
    { id: 'cs', title: bi('Customer service call center', 'Call-centre customer service'), kind: 'desk', minEdu: 3, type: 'pkwt', termMonths: 12, uniform: false, sector: 'services', koperasi: false },
    { id: 'content', title: bi('Staf konten media sosial', 'Social media content staff'), kind: 'desk', minEdu: 4, type: 'pkwt', termMonths: 12, uniform: false, sector: 'media', koperasi: false },
    { id: 'kitchen', title: bi('Asisten dapur', 'Kitchen assistant'), kind: 'standing', minEdu: 0, type: 'pkwt', termMonths: 6, uniform: true, sector: 'fnb', koperasi: false },
    { id: 'cleaner', title: bi('Petugas kebersihan (outsourcing)', 'Cleaner (outsourced)'), kind: 'physical', minEdu: 0, type: 'pkwt', termMonths: 12, uniform: true, sector: 'facility', koperasi: false },
    { id: 'helper', title: bi('Pekerja harian lepas', 'Daily casual worker'), kind: 'physical', minEdu: 0, type: 'harian', termMonths: 0, uniform: false, sector: 'logistics', koperasi: false },
  ];
  const EMP_TYPES = {
    pkwt: { label: bi('Kontrak (PKWT)', 'Fixed-term contract (PKWT)') },
    pkwtt: { label: bi('Tetap (PKWTT)', 'Permanent (PKWTT)') },
    harian: { label: bi('Harian lepas', 'Daily casual') },
    magang: { label: bi('Magang (uang saku)', 'Internship (allowance)') },
    freelance: { label: bi('Lepas/proyek', 'Freelance / project') },
  };

  /*
   * Listing templates for Appy. Fields:
   *  pay [min, max] × local minimum wage; null = "not disclosed"
   *  edu minimum rank; eduPref preferred rank
   *  exp [mandatory years, preferred years]
   *  skills mandatory, pref preferred; english [mandatory rank, preferred rank]
   *  certs mandatory; docs mandatory documents (ids from data/docs.js)
   *  stages 2–5; applicants range; kind (see KINDS)
   */
  const T = (id, title, sector, kind, o) => ({ id, title, sector, kind, ...o });
  const ROLES = [
    T('retail', bi('Pramuniaga', 'Shop assistant'), 'retail', 'customer', { pay: [1, 1.05], edu: 3, exp: [0, 0], skills: [], pref: ['customer', 'cashier'], docs: ['cv', 'ijazah'], stages: 3, applicants: [150, 600], types: ['pkwt'] }),
    T('cashier', bi('Kasir', 'Cashier'), 'retail', 'customer', { pay: [1, 1.08], edu: 3, exp: [0, 1], skills: [], pref: ['cashier', 'customer'], docs: ['cv', 'ijazah', 'skck'], stages: 3, applicants: [200, 700], types: ['pkwt'], agePref: 27 }),
    T('fnb_crew', bi('Kru restoran', 'Restaurant crew'), 'fnb', 'customer', { pay: [1, 1.05], edu: 3, exp: [0, 0], skills: [], pref: ['customer', 'cooking'], docs: ['cv', 'surat_sehat'], stages: 3, applicants: [100, 400], types: ['pkwt'] }),
    T('barista', bi('Barista', 'Barista'), 'fnb', 'customer', { pay: [1, 1.2], edu: 3, exp: [0, 1], skills: ['barista'], pref: ['customer'], docs: ['cv', 'surat_sehat'], stages: 3, applicants: [80, 300], types: ['pkwt'] }),
    T('cook', bi('Juru masak (cook helper)', 'Cook helper'), 'fnb', 'standing', { pay: [1, 1.15], edu: 2, exp: [1, 2], skills: ['cooking'], pref: [], certs: [], docs: ['cv', 'surat_sehat'], stages: 2, applicants: [40, 150], types: ['pkwt'] }),
    T('warehouse', bi('Staf gudang', 'Warehouse staff'), 'logistics', 'physical', { pay: [1, 1.05], edu: 2, exp: [0, 1], skills: [], pref: ['warehouse'], docs: ['cv', 'surat_sehat'], stages: 2, applicants: [200, 900], types: ['pkwt', 'harian'] }),
    T('courier', bi('Kurir motor', 'Motorbike courier'), 'logistics', 'physical', { pay: [1, 1.25], edu: 2, exp: [0, 1], skills: ['driving'], pref: [], certs: [], docs: ['cv', 'sim_c', 'skck'], stages: 2, applicants: [100, 400], types: ['pkwt'], ownBike: true }),
    T('operator', bi('Operator produksi', 'Production operator'), 'manufacturing', 'physical', { pay: [1, 1.1], edu: 3, eduVoc: true, exp: [0, 0], skills: [], pref: ['machine'], docs: ['cv', 'ijazah', 'surat_sehat', 'skck'], stages: 4, applicants: [500, 1500], types: ['pkwt'], agePref: 25 }),
    T('admin', bi('Staf administrasi', 'Administrative staff'), 'services', 'desk', { pay: [1, 1.15], edu: 3, exp: [0, 1], skills: ['office'], pref: ['data'], docs: ['cv', 'ijazah'], stages: 3, applicants: [300, 1200], types: ['pkwt'], digital: 2 }),
    T('admin_finance', bi('Admin keuangan', 'Finance administrator'), 'services', 'desk', { pay: [1.05, 1.3], edu: 4, exp: [1, 2], skills: ['office', 'accounting'], pref: ['data'], certs: [], docs: ['cv', 'ijazah', 'transkrip'], stages: 4, applicants: [150, 600], types: ['pkwt', 'pkwtt'], digital: 2 }),
    T('cs_center', bi('Customer service', 'Customer service agent'), 'services', 'desk', { pay: [1, 1.15], edu: 3, exp: [0, 1], skills: [], pref: ['customer', 'office'], english: [0, 2], docs: ['cv', 'ijazah'], stages: 3, applicants: [200, 800], types: ['pkwt'] }),
    T('cs_english', bi('Customer support (bahasa Inggris)', 'English-speaking customer support'), 'services', 'desk', { pay: [1.3, 1.7], edu: 4, exp: [0, 1], skills: ['customer'], pref: ['office'], english: [2, 3], docs: ['cv', 'ijazah', 'toefl'], stages: 4, applicants: [80, 300], types: ['pkwt'] }),
    T('hotel', bi('Staf front office hotel', 'Hotel front office staff'), 'hospitality', 'customer', { pay: [1, 1.2], edu: 4, exp: [0, 1], skills: [], pref: ['hospitality', 'customer'], english: [1, 2], docs: ['cv', 'ijazah', 'surat_sehat'], stages: 4, applicants: [100, 400], types: ['pkwt'], agePref: 28 }),
    T('housekeeping', bi('Room attendant hotel', 'Hotel room attendant'), 'hospitality', 'physical', { pay: [1, 1.05], edu: 3, exp: [0, 1], skills: [], pref: ['cleaning', 'hospitality'], docs: ['cv', 'surat_sehat'], stages: 3, applicants: [80, 300], types: ['pkwt'] }),
    T('sales', bi('Sales lapangan', 'Field sales'), 'sales', 'customer', { pay: [1, 1.4], edu: 3, exp: [0, 1], skills: [], pref: ['sales', 'driving'], docs: ['cv', 'sim_c'], stages: 2, applicants: [60, 250], types: ['pkwt'], note: bi('Sebagian gaji berupa komisi.', 'Part of the pay is commission.') }),
    T('telesales', bi('Telemarketing', 'Telesales'), 'sales', 'desk', { pay: [1, 1.2], edu: 3, exp: [0, 0], skills: [], pref: ['sales', 'customer'], docs: ['cv'], stages: 2, applicants: [80, 300], types: ['pkwt'] }),
    T('content', bi('Staf konten media sosial', 'Social media content staff'), 'media', 'desk', { pay: [1, 1.3], edu: 4, exp: [0, 1], skills: ['socialmedia'], pref: ['copywriting', 'design'], docs: ['cv', 'portfolio'], stages: 4, applicants: [300, 1000], types: ['pkwt'], digital: 2 }),
    T('designer', bi('Desainer grafis junior', 'Junior graphic designer'), 'media', 'desk', { pay: [1.05, 1.4], edu: 4, exp: [0, 1], skills: ['design'], pref: ['socialmedia'], docs: ['cv', 'portfolio'], stages: 4, applicants: [200, 700], types: ['pkwt', 'freelance'], digital: 2, unpaidTask: true }),
    T('copywriter', bi('Copywriter', 'Copywriter'), 'media', 'desk', { pay: [1.1, 1.5], edu: 5, exp: [1, 2], skills: ['copywriting'], pref: ['socialmedia'], english: [1, 2], docs: ['cv', 'portfolio'], stages: 4, applicants: [150, 500], types: ['pkwt'] }),
    T('marketing', bi('Staf pemasaran digital', 'Digital marketing staff'), 'marketing', 'desk', { pay: [1.2, 1.6], edu: 5, exp: [1, 2], skills: ['socialmedia'], pref: ['data', 'copywriting'], english: [1, 2], docs: ['cv', 'ijazah', 'portfolio'], stages: 4, applicants: [300, 1000], types: ['pkwt', 'pkwtt'], digital: 3 }),
    T('data_entry', bi('Data entry', 'Data entry clerk'), 'services', 'desk', { pay: [1, 1.05], edu: 3, exp: [0, 0], skills: ['office'], pref: [], docs: ['cv'], stages: 2, applicants: [300, 1000], types: ['pkwt', 'harian'], digital: 2 }),
    T('data_analyst', bi('Analis data junior', 'Junior data analyst'), 'technology', 'desk', { pay: [1.5, 2.2], edu: 5, exp: [0, 1], skills: ['data', 'office'], pref: ['programming'], english: [1, 2], docs: ['cv', 'ijazah', 'transkrip', 'portfolio'], stages: 5, applicants: [400, 1500], types: ['pkwtt', 'pkwt'], digital: 3 }),
    T('it_support', bi('IT support', 'IT support'), 'technology', 'desk', { pay: [1.2, 1.6], edu: 4, exp: [0, 1], skills: ['office'], pref: ['programming'], docs: ['cv', 'ijazah'], stages: 3, applicants: [120, 500], types: ['pkwt'], digital: 3 }),
    T('junior_dev', bi('Programmer junior', 'Junior developer'), 'technology', 'desk', { pay: [1.6, 2.5], edu: 5, exp: [1, 2], skills: ['programming'], pref: ['data'], english: [1, 2], docs: ['cv', 'portfolio'], stages: 5, applicants: [300, 1200], types: ['pkwtt', 'pkwt'], digital: 3, unrealistic: true }),
    T('security', bi('Satpam', 'Security guard'), 'facility', 'standing', { pay: [1, 1.05], edu: 3, exp: [0, 1], skills: [], pref: [], certs: ['gada'], docs: ['cv', 'skck', 'surat_sehat'], stages: 3, applicants: [100, 400], types: ['pkwt'] }),
    T('cleaner', bi('Petugas kebersihan', 'Cleaner'), 'facility', 'physical', { pay: [1, 1], edu: 0, exp: [0, 0], skills: [], pref: ['cleaning'], docs: ['cv'], stages: 2, applicants: [60, 300], types: ['pkwt', 'harian'] }),
    T('teller', bi('Teller bank (alih daya)', 'Bank teller (outsourced)'), 'finance', 'customer', { pay: [1.05, 1.25], edu: 4, exp: [0, 0], skills: [], pref: ['customer', 'office'], docs: ['cv', 'ijazah', 'transkrip', 'skck'], stages: 5, applicants: [800, 2500], types: ['pkwt'], agePref: 25 }),
    T('tax_admin', bi('Staf pajak', 'Tax staff'), 'finance', 'desk', { pay: [1.2, 1.6], edu: 5, exp: [1, 2], skills: ['accounting', 'office'], pref: [], certs: ['brevet'], docs: ['cv', 'ijazah', 'transkrip'], stages: 4, applicants: [100, 400], types: ['pkwt', 'pkwtt'] }),
    T('intern', bi('Magang kantor', 'Office intern'), 'services', 'desk', { pay: [0.4, 0.6], edu: 4, exp: [0, 0], skills: [], pref: ['office'], docs: ['cv', 'transkrip'], stages: 2, applicants: [200, 800], types: ['magang'], note: bi('Magang dibayar uang saku, bukan upah minimum.', 'Interns receive an allowance, not the minimum wage.') }),
    T('supervisor', bi('Supervisor toko', 'Store supervisor'), 'retail', 'customer', { pay: [1.3, 1.7], edu: 3, exp: [2, 3], skills: ['customer', 'sales'], pref: ['office'], docs: ['cv', 'ijazah', 'paklaring'], stages: 4, applicants: [60, 250], types: ['pkwt', 'pkwtt'] }),
  ];

  const COMPANY = {
    pre: ['Sinar', 'Cahaya', 'Mitra', 'Karya', 'Prima', 'Nusa', 'Bumi', 'Sentosa', 'Maju', 'Arta', 'Bina', 'Lintas', 'Tunas', 'Rasa', 'Gemilang'],
    mid: ['Niaga', 'Abadi', 'Mandiri', 'Sejahtera', 'Logistik', 'Retail', 'Digital', 'Kreasi', 'Pangan', 'Solusi', 'Teknologi', 'Jaya', 'Usaha', 'Media'],
    end: ['Utama', 'Indonesia', 'Nusantara', 'Persada', 'Lestari', 'Perkasa', 'Makmur', 'Group'],
  };

  // Day gigs (informal, paid at the end of the day). ILLUSTRATIVE pay.
  const GIGS = [
    { id: 'event_crew', title: bi('Kru acara (pasang dekorasi)', 'Event crew (setting up)'), pay: 150000, slots: 3, energy: 35, req: {} },
    { id: 'packing', title: bi('Bantu packing toko online', 'Packing for an online shop'), pay: 110000, slots: 3, energy: 30, req: {} },
    { id: 'kitchen_extra', title: bi('Tambahan tenaga dapur katering', 'Extra hands at a caterer'), pay: 130000, slots: 3, energy: 35, req: { skill: 'cooking' } },
    { id: 'delivery_helper', title: bi('Antar barang pakai motor sendiri', 'Delivering with your own motorbike'), pay: 140000, slots: 3, energy: 30, req: { doc: 'sim_c' }, cost: 25000, costLabel: bi('bensin', 'fuel') },
    { id: 'design_gig', title: bi('Desain poster untuk UMKM', 'Poster design for a small business'), pay: 250000, slots: 2, energy: 20, req: { skill: 'design' }, remote: true },
    { id: 'writing_gig', title: bi('Menulis 3 caption produk', 'Writing 3 product captions'), pay: 120000, slots: 1, energy: 12, req: { skill: 'copywriting' }, remote: true },
    { id: 'survey', title: bi('Isi survei & uji aplikasi', 'Surveys & app testing'), pay: 25000, slots: 1, energy: 8, req: { online: true }, remote: true },
    { id: 'tutor', title: bi('Les privat anak SD', 'Tutoring a primary-school child'), pay: 75000, slots: 1, energy: 15, req: { edu: 3 } },
    { id: 'translation', title: bi('Terjemahan dokumen pendek', 'Short document translation'), pay: 200000, slots: 2, energy: 18, req: { english: 2 }, remote: true },
  ];

  RLS.data.jobs = { EDUCATION, ENGLISH, DIGITAL, OTHER_LANG, SKILLS, CERTS, KINDS, STARTING_JOBS, EMP_TYPES, ROLES, COMPANY, GIGS,
    eduById: Object.fromEntries(EDUCATION.map((e) => [e.id, e])), engById: Object.fromEntries(ENGLISH.map((e) => [e.id, e])), digById: Object.fromEntries(DIGITAL.map((e) => [e.id, e])),
    skillLabel: Object.fromEntries(SKILLS), certLabel: Object.fromEntries(CERTS) };
  if (typeof module !== 'undefined' && module.exports) module.exports = RLS.data.jobs;
})(typeof globalThis !== 'undefined' ? globalThis : this);
