/*
 * travel.js — destinations, entry requirements for Indonesian passport holders,
 * and administrative documents.
 *
 * Trip costs are ILLUSTRATIVE gameplay values (no fares were observed).
 * Entry rules and official fees cite their sources; where a source is a
 * travel platform or agent, the status is ESTIMATED.
 * Foreign-currency fees are converted with ILLUSTRATIVE rates for display.
 */
(function (root) {
  const RLS = (root.RLS = root.RLS || {});
  RLS.data = RLS.data || {};
  const { bi } = RLS.i18n;

  const FX = { AUD: 10800, GBP: 21500, USD: 16300 }; // rupiah per unit, ILLUSTRATIVE
  const STYLES = [['budget', bi('Hemat', 'Budget')], ['standard', bi('Standar', 'Standard')], ['comfort', bi('Nyaman', 'Comfort')]];

  // Island zone of each province (for domestic transport costs).
  const ZONE = {
    aceh: 'S', sumut: 'S', sumbar: 'S', riau: 'S', jambi: 'S', sumsel: 'S', bengkulu: 'S', lampung: 'S', babel: 'S', kepri: 'S',
    dki: 'J', jabar: 'J', jateng: 'J', diy: 'J', jatim: 'J', banten: 'J', bali: 'J',
    ntb: 'C', ntt: 'C', kalbar: 'K', kalteng: 'K', kalsel: 'K', kaltim: 'K', kaltara: 'K',
    sulut: 'C', sulteng: 'C', sulsel: 'C', sultra: 'C', gorontalo: 'C', sulbar: 'C',
    maluku: 'E', malut: 'E', pabar: 'E', pbd: 'E', papua: 'E', papsel: 'E', papteng: 'E', pappeg: 'E',
  };
  // Multiplier on flight costs from a zone to a destination zone.
  const ZONE_MULT = { J: { J: 1, S: 1.1, K: 1.1, C: 1.15, E: 1.6 }, S: { J: 1.1, S: 0.9, K: 1.3, C: 1.4, E: 1.8 }, K: { J: 1.1, S: 1.3, K: 0.9, C: 1.1, E: 1.5 }, C: { J: 1.15, S: 1.4, K: 1.1, C: 0.9, E: 1.3 }, E: { J: 1.6, S: 1.8, K: 1.5, C: 1.3, E: 1 } };
  const INTL_EXTRA = { J: 0, S: 600000, K: 900000, C: 1100000, E: 2200000 }; // domestic leg to Jakarta, ILLUSTRATIVE

  /*
   * land: [budget, standard, comfort] round-trip by train/bus when on the same island as the
   *       player (Java/Bali treated as one); fly: round-trip flight from Java.
   * stay/food/local: per day. attractions: optional extras.
   */
  const D = (id, name, zone, o) => ({ id, name, zone, intl: false, ...o });
  const DOMESTIC = [
    D('yogya', bi('Yogyakarta', 'Yogyakarta'), 'J', { land: [300000, 600000, 1100000], fly: [1100000, 1500000, 2400000], stay: [150000, 400000, 950000], food: [90000, 180000, 380000], local: [40000, 90000, 250000], minNights: 2,
      attractions: [['malioboro', bi('Jalan-jalan Malioboro', 'Walk Malioboro'), 0], ['prambanan', bi('Candi Prambanan', 'Prambanan temple'), 50000], ['borobudur', bi('Candi Borobudur (pelataran)', 'Borobudur temple grounds'), 50000], ['jeep_merapi', bi('Jeep lava tour Merapi', 'Merapi lava jeep tour'), 450000]] }),
    D('bandung', bi('Bandung', 'Bandung'), 'J', { land: [150000, 300000, 600000], fly: [1100000, 1500000, 2400000], stay: [150000, 380000, 900000], food: [90000, 170000, 350000], local: [40000, 90000, 220000], minNights: 1,
      attractions: [['braga', bi('Jalan Braga & alun-alun', 'Braga street & square'), 0], ['kawah_putih', bi('Kawah Putih', 'Kawah Putih crater'), 75000], ['tangkuban', bi('Tangkuban Parahu', 'Tangkuban Parahu'), 50000]] }),
    D('malang', bi('Malang & Bromo', 'Malang & Bromo'), 'J', { land: [450000, 850000, 1500000], fly: [1200000, 1700000, 2600000], stay: [150000, 380000, 850000], food: [80000, 160000, 330000], local: [40000, 100000, 250000], minNights: 2,
      attractions: [['bromo_jeep', bi('Jip matahari terbit Bromo (patungan)', 'Bromo sunrise jeep (shared)'), 350000], ['batu', bi('Kota Batu', 'Batu town'), 30000]] }),
    D('bali', bi('Bali', 'Bali'), 'J', { land: [700000, 1100000, 1800000], fly: [1300000, 1900000, 3200000], stay: [180000, 500000, 1500000], food: [100000, 220000, 500000], local: [80000, 150000, 400000], minNights: 3,
      attractions: [['beach_day', bi('Seharian di pantai', 'A day at the beach'), 0], ['ubud', bi('Ubud & sawah Tegallalang', 'Ubud & Tegallalang rice terraces'), 50000], ['uluwatu', bi('Pura Uluwatu & tari kecak', 'Uluwatu temple & kecak dance'), 150000], ['snorkel', bi('Snorkeling Nusa Penida', 'Snorkelling at Nusa Penida'), 450000]] }),
    D('lombok', bi('Lombok', 'Lombok'), 'C', { fly: [1400000, 2000000, 3300000], stay: [170000, 450000, 1300000], food: [90000, 200000, 450000], local: [80000, 160000, 400000], minNights: 3,
      attractions: [['gili', bi('Penyeberangan ke Gili', 'Boat to the Gilis'), 200000], ['kuta_lombok', bi('Pantai Kuta Mandalika', 'Kuta Mandalika beach'), 0]] }),
    D('labuan_bajo', bi('Labuan Bajo', 'Labuan Bajo'), 'C', { fly: [2200000, 3000000, 4800000], stay: [200000, 550000, 1800000], food: [100000, 220000, 500000], local: [80000, 180000, 450000], minNights: 3,
      attractions: [['komodo_trip', bi('Trip kapal Taman Nasional Komodo (patungan)', 'Komodo National Park boat trip (shared)'), 950000], ['bukit_sylvia', bi('Matahari terbenam di Bukit Sylvia', 'Sunset at Sylvia Hill'), 0]] }),
    D('toba', bi('Danau Toba', 'Lake Toba'), 'S', { land: [400000, 700000, 1200000], fly: [1500000, 2100000, 3400000], stay: [130000, 350000, 900000], food: [80000, 160000, 330000], local: [60000, 120000, 300000], minNights: 2,
      attractions: [['samosir', bi('Keliling Pulau Samosir', 'Around Samosir island'), 100000]] }),
    D('belitung', bi('Belitung', 'Belitung'), 'S', { fly: [1300000, 1800000, 2900000], stay: [150000, 420000, 1100000], food: [90000, 180000, 380000], local: [80000, 150000, 350000], minNights: 2,
      attractions: [['island_hop', bi('Hopping pulau (patungan)', 'Island hopping (shared)'), 250000]] }),
    D('makassar', bi('Makassar & Rammang-Rammang', 'Makassar & Rammang-Rammang'), 'C', { land: [0, 0, 0], fly: [1500000, 2100000, 3300000], stay: [150000, 400000, 950000], food: [90000, 180000, 380000], local: [60000, 130000, 300000], minNights: 2,
      attractions: [['losari', bi('Pantai Losari', 'Losari beach'), 0], ['rammang', bi('Perahu Rammang-Rammang', 'Rammang-Rammang boat'), 150000]] }),
  ];
  const I = (id, name, o) => ({ id, name, intl: true, zone: 'X', ...o });
  const INTERNATIONAL = [
    I('singapore', bi('Singapura', 'Singapore'), { entry: 'sg', fly: [1300000, 2000000, 4000000], stay: [450000, 1100000, 2800000], food: [200000, 400000, 900000], local: [90000, 150000, 400000], minNights: 2, plug: true,
      attractions: [['marina', bi('Marina Bay & Gardens (area gratis)', 'Marina Bay & Gardens (free areas)'), 0], ['zoo', bi('Kebun binatang', 'Zoo'), 650000], ['sentosa', bi('Pulau Sentosa', 'Sentosa'), 250000]] }),
    I('kuala_lumpur', bi('Kuala Lumpur', 'Kuala Lumpur'), { entry: 'my', fly: [1000000, 1600000, 3500000], stay: [300000, 700000, 1800000], food: [130000, 260000, 600000], local: [60000, 120000, 300000], minNights: 2, plug: true,
      attractions: [['klcc', bi('Menara Petronas (luar) & taman KLCC', 'Petronas Towers (outside) & KLCC park'), 0], ['batu_caves', bi('Gua Batu', 'Batu Caves'), 0], ['skybridge', bi('Skybridge Petronas', 'Petronas Skybridge'), 400000]] }),
    I('bangkok', bi('Bangkok', 'Bangkok'), { entry: 'th', fly: [1800000, 2800000, 5500000], stay: [300000, 750000, 2000000], food: [120000, 250000, 600000], local: [60000, 130000, 350000], minNights: 3,
      attractions: [['grand_palace', bi('Grand Palace', 'Grand Palace'), 230000], ['market', bi('Pasar malam & Chatuchak', 'Night markets & Chatuchak'), 0]] }),
    I('hcmc', bi('Ho Chi Minh City', 'Ho Chi Minh City'), { entry: 'vn', fly: [1900000, 2900000, 5500000], stay: [250000, 650000, 1700000], food: [110000, 230000, 550000], local: [50000, 110000, 300000], minNights: 3,
      attractions: [['cu_chi', bi('Terowongan Cu Chi', 'Cu Chi tunnels'), 250000], ['ben_thanh', bi('Pasar Ben Thanh', 'Ben Thanh market'), 0]] }),
    I('tokyo', bi('Tokyo', 'Tokyo'), { entry: 'jp', fly: [5500000, 8000000, 16000000], stay: [600000, 1400000, 3500000], food: [300000, 550000, 1200000], local: [150000, 250000, 600000], minNights: 4, plug: true,
      attractions: [['shrines', bi('Kuil & taman (gratis)', 'Shrines & parks (free)'), 0], ['skytree', bi('Tokyo Skytree', 'Tokyo Skytree'), 350000], ['disney', bi('Taman hiburan', 'Theme park'), 1050000]] }),
    I('seoul', bi('Seoul', 'Seoul'), { entry: 'kr', fly: [5000000, 7500000, 15000000], stay: [550000, 1200000, 3000000], food: [250000, 450000, 1000000], local: [100000, 180000, 450000], minNights: 4, plug: false,
      attractions: [['palace', bi('Istana Gyeongbokgung', 'Gyeongbokgung palace'), 40000], ['namsan', bi('Menara Namsan', 'Namsan tower'), 250000]] }),
    I('sydney', bi('Sydney', 'Sydney'), { entry: 'au', fly: [7000000, 10000000, 22000000], stay: [900000, 1800000, 4000000], food: [350000, 650000, 1400000], local: [150000, 250000, 600000], minNights: 5, plug: true, insuranceRec: true,
      attractions: [['opera', bi('Opera House & pelabuhan (luar)', 'Opera House & harbour (outside)'), 0], ['bondi', bi('Pantai Bondi', 'Bondi beach'), 0], ['zoo_au', bi('Kebun binatang Taronga', 'Taronga Zoo'), 550000]] }),
    I('london', bi('London', 'London'), { entry: 'uk', fly: [11000000, 15000000, 35000000], stay: [1300000, 2600000, 6000000], food: [450000, 800000, 1800000], local: [250000, 400000, 900000], minNights: 5, plug: true, insuranceRec: true,
      attractions: [['museums', bi('Museum nasional (gratis)', 'National museums (free)'), 0], ['tower', bi('Tower of London', 'Tower of London'), 750000], ['lse', bi('Jalan-jalan ke kampus LSE & Holborn', 'Walk past LSE & Holborn'), 0]] }),
  ];

  /*
   * Entry requirements for an Indonesian passport (ordinary tourist visit).
   * type: visa_free | waiver_or_visa | visa
   */
  const ENTRY = {
    sg: { type: 'visa_free', days: 30, passportMonths: 6, arrival: 'sgac', status: 'ESTIMATED', sourceId: 'asean_entry', label: bi('Bebas visa hingga 30 hari', 'Visa-free up to 30 days') },
    my: { type: 'visa_free', days: 30, passportMonths: 6, arrival: 'mdac', status: 'ESTIMATED', sourceId: 'asean_entry', label: bi('Bebas visa hingga 30 hari', 'Visa-free up to 30 days') },
    th: { type: 'visa_free', days: 30, passportMonths: 6, arrival: 'tdac', status: 'ESTIMATED', sourceId: 'asean_entry', label: bi('Bebas visa hingga 30 hari', 'Visa-free up to 30 days') },
    vn: { type: 'visa_free', days: 30, passportMonths: 6, arrival: null, status: 'ESTIMATED', sourceId: 'asean_entry', label: bi('Bebas visa hingga 30 hari', 'Visa-free up to 30 days') },
    jp: { type: 'waiver_or_visa', days: 15, passportMonths: 6, waiverDoc: 'javes', visaDoc: 'visa_jp', status: 'VERIFIED', sourceId: 'javes_2026',
      label: bi('Bebas visa 15 hari untuk e-paspor (daftar JAVES); paspor biasa perlu visa', 'Visa waiver up to 15 days for e-passports (JAVES registration); ordinary passports need a visa') },
    kr: { type: 'visa', passportMonths: 6, visaDoc: 'visa_kr', status: 'ESTIMATED', sourceId: 'visa_kr', label: bi('Perlu visa kunjungan singkat sebelum berangkat', 'Short-term visit visa needed before travel') },
    au: { type: 'visa', passportMonths: 6, visaDoc: 'visa_au', status: 'ESTIMATED', sourceId: 'visa_au', label: bi('Perlu Visitor visa (subclass 600) sebelum berangkat', 'Visitor visa (subclass 600) needed before travel') },
    uk: { type: 'visa', passportMonths: 6, visaDoc: 'visa_uk', status: 'ESTIMATED', sourceId: 'visa_uk', label: bi('Perlu Standard Visitor visa sebelum berangkat', 'Standard Visitor visa needed before travel') },
  };

  /*
   * Documents. fee in rupiah (or {cur, amount}); days [min,max] processing (working days when wd:true);
   * inPerson: uses a free slot (and time off work on a workday); valid: validity in days (null = no expiry).
   * needs: prerequisite documents or conditions.
   */
  const Doc = (id, name, o) => ({ id, name, fee: 0, status: 'ILLUSTRATIVE', sourceId: 'game_assumption', days: [0, 0], wd: false, inPerson: false, valid: null, needs: [], purpose: null, extra: [], ...o });
  const DOCS = [
    Doc('ktp', bi('KTP elektronik', 'Electronic ID card (KTP)'), { held: true, purpose: bi('Identitas dasar untuk hampir semua urusan.', 'Basic identity for almost everything.') }),
    Doc('kk', bi('Kartu Keluarga', 'Family card (KK)'), { held: true, purpose: bi('Dibutuhkan untuk SKCK, paspor, dan banyak berkas lain.', 'Needed for SKCK, passports and many other files.') }),
    Doc('akta', bi('Akta kelahiran', 'Birth certificate'), { held: true }),
    Doc('cv', bi('CV / daftar riwayat hidup', 'CV / résumé'), { held: true, purpose: bi('Kualitasnya bisa kamu tingkatkan di Appy.', 'You can improve it in Appy.') }),
    Doc('ijazah', bi('Salinan ijazah terakhir', 'Copy of latest diploma'), { heldIfEdu: 1 }),
    Doc('transkrip', bi('Transkrip nilai', 'Academic transcript'), { heldIfEdu: 4 }),
    Doc('pas_foto', bi('Pas foto latar merah', 'Red-background ID photos'), { fee: 25000, days: [0, 0], valid: 365, purpose: bi('Untuk SKCK dan berkas lamaran.', 'For SKCK and application files.') }),
    Doc('skck', bi('SKCK (digital)', 'Police clearance (SKCK, digital)'), { fee: 30000, status: 'VERIFIED', sourceId: 'skck_2026', days: [1, 1], valid: 180, needs: ['pas_foto', 'jkn'],
      purpose: bi('Diminta sebagian pemberi kerja (kasir, satpam, kurir, teller, operator) dan beberapa visa.', 'Asked by some employers (cashier, security, courier, teller, operator) and some visas.') }),
    Doc('surat_sehat', bi('Surat keterangan sehat', 'Medical certificate'), { fee: 30000, days: [0, 0], inPerson: true, valid: 90,
      purpose: bi('Diminta untuk pekerjaan makanan, perhotelan, gudang, dan satpam.', 'Asked for food, hospitality, warehouse and security jobs.'), extra: [[bi('Bisa lebih mahal di klinik swasta', 'Can cost more at private clinics'), 0]] }),
    Doc('sim_c', bi('SIM C (baru)', 'Motorbike licence (SIM C, new)'), { fee: 160000, status: 'ESTIMATED', sourceId: 'game_assumption', days: [0, 0], inPerson: true, valid: 1825, needs: ['age17', 'surat_sehat'],
      purpose: bi('Wajib untuk kerja kurir dan sales lapangan bermotor.', 'Required for courier and motorbike sales jobs.'), test: true,
      extra: [[bi('Termasuk tes kesehatan & psikologi (perkiraan)', 'Includes health & psychology test (estimate)'), 60000]] }),
    Doc('toefl', bi('Sertifikat tes bahasa Inggris (setara TOEFL ITP)', 'English test certificate (TOEFL ITP-type)'), { fee: 750000, days: [5, 7], inPerson: true, valid: 730,
      purpose: bi('Diminta untuk pekerjaan berbahasa Inggris dan studi.', 'Asked for English-speaking jobs and study.') }),
    Doc('ak1', bi('Kartu pencari kerja (AK1)', 'Job seeker card (AK1)'), { fee: 0, status: 'ESTIMATED', days: [1, 3], valid: 730,
      purpose: bi('Bukti terdaftar sebagai pencari kerja di Disnaker.', 'Proof of registration as a job seeker with the labour office.') }),
    Doc('bank_statement', bi('Rekening koran 3 bulan', '3-month bank statement'), { fee: 10000, days: [0, 0], valid: 30,
      purpose: bi('Bukti keuangan untuk visa.', 'Proof of funds for visas.') }),
    Doc('employment_letter', bi('Surat keterangan kerja', 'Employment letter'), { fee: 0, days: [2, 3], wd: true, valid: 60, needs: ['employed'],
      purpose: bi('Dari HRD: jabatan, gaji, lama bekerja. Untuk visa dan pinjaman bank.', 'From HR: position, salary, tenure. For visas and bank loans.') }),
    Doc('paklaring', bi('Paklaring (surat pengalaman kerja)', 'Work experience letter (paklaring)'), { auto: true,
      purpose: bi('Diberikan saat hubungan kerja berakhir. Dipakai untuk klaim JHT dan melamar kerja.', 'Issued when a job ends. Used for JHT claims and job applications.') }),
    Doc('translation', bi('Terjemahan tersumpah (KK & akta)', 'Sworn translation (family card & birth certificate)'), { fee: 300000, days: [3, 4], valid: null,
      purpose: bi('Dokumen berbahasa Indonesia untuk visa Inggris/Australia.', 'Indonesian-language documents for UK/Australian visas.') }),
    Doc('insurance', bi('Asuransi perjalanan (satu perjalanan)', 'Travel insurance (single trip)'), { fee: 250000, days: [0, 0], valid: 45,
      purpose: bi('Disarankan untuk perjalanan luar negeri; diminta untuk visa Korea.', 'Recommended abroad; requested for the Korean visa.') }),
    Doc('portfolio', bi('Portofolio', 'Portfolio'), { built: true, purpose: bi('Dibangun dengan mengerjakan proyek di Appy.', 'Built by working on projects in Appy.') }),
    Doc('passport', bi('Paspor', 'Passport'), { special: 'passport', status: 'VERIFIED', sourceId: 'passport_fee_2024' }),
    Doc('javes', bi('Registrasi bebas visa Jepang (JAVES)', 'Japan visa waiver registration (JAVES)'), { fee: 0, status: 'VERIFIED', sourceId: 'javes_2026', days: [1, 2], valid: 90, needs: ['epassport'] }),
    Doc('sgac', bi('SG Arrival Card', 'SG Arrival Card'), { fee: 0, status: 'ESTIMATED', sourceId: 'asean_entry', days: [0, 0], arrival: true }),
    Doc('mdac', bi('Malaysia Digital Arrival Card', 'Malaysia Digital Arrival Card'), { fee: 0, status: 'ESTIMATED', sourceId: 'asean_entry', days: [0, 0], arrival: true }),
    Doc('tdac', bi('Thailand Digital Arrival Card', 'Thailand Digital Arrival Card'), { fee: 0, status: 'ESTIMATED', sourceId: 'asean_entry', days: [0, 0], arrival: true }),
    Doc('visa_jp', bi('Visa turis Jepang (sekali masuk)', 'Japan tourist visa (single entry)'), { fee: 1650000, status: 'VERIFIED', sourceId: 'visa_jp_2026', days: [5, 7], wd: true, inPerson: true, valid: 90, visa: true,
      needs: ['passport_valid', 'bank_statement', 'employment_or_funds'] }),
    Doc('visa_kr', bi('Visa kunjungan singkat Korea', 'Korea short-term visit visa'), { fee: 856000, status: 'ESTIMATED', sourceId: 'visa_kr', days: [7, 10], wd: true, inPerson: true, valid: 90, visa: true,
      needs: ['passport_valid', 'bank_statement', 'employment_or_funds', 'insurance'] }),
    Doc('visa_au', bi('Visa Australia Visitor (subclass 600)', 'Australia Visitor visa (subclass 600)'), { fee: { cur: 'AUD', amount: 250 }, status: 'ESTIMATED', sourceId: 'visa_au', days: [15, 30], wd: true, valid: 365, visa: true,
      needs: ['passport_valid', 'bank_statement', 'employment_or_funds', 'translation'] }),
    Doc('visa_uk', bi('Visa Standard Visitor Inggris', 'UK Standard Visitor visa'), { fee: { cur: 'GBP', amount: 127 }, status: 'ESTIMATED', sourceId: 'visa_uk', days: [12, 18], wd: true, inPerson: true, valid: 180, visa: true,
      needs: ['passport_valid', 'bank_statement', 'employment_or_funds', 'translation'] }),
  ];

  const PASSPORT_TYPES = [
    { id: 'e10', name: bi('E-paspor, 10 tahun', 'E-passport, 10 years'), fee: 950000, years: 10, electronic: true },
    { id: 'n10', name: bi('Paspor biasa, 10 tahun', 'Ordinary passport, 10 years'), fee: 650000, years: 10, electronic: false },
    { id: 'e5', name: bi('E-paspor, 5 tahun', 'E-passport, 5 years'), fee: 650000, years: 5, electronic: true },
    { id: 'n5', name: bi('Paspor biasa, 5 tahun', 'Ordinary passport, 5 years'), fee: 350000, years: 5, electronic: false },
  ];
  const PASSPORT_EXPRESS = 1000000; // same-day service, PP 45/2024

  RLS.data.travel = { FX, STYLES, ZONE, ZONE_MULT, INTL_EXTRA, DOMESTIC, INTERNATIONAL, ENTRY, DOCS, PASSPORT_TYPES, PASSPORT_EXPRESS,
    destById: Object.fromEntries(DOMESTIC.concat(INTERNATIONAL).map((d) => [d.id, d])), docById: Object.fromEntries(DOCS.map((d) => [d.id, d])) };
  if (typeof module !== 'undefined' && module.exports) module.exports = RLS.data.travel;
})(typeof globalThis !== 'undefined' ? globalThis : this);
