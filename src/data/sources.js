/*
 * sources.js — the source registry.
 * Every VERIFIED or ESTIMATED value in the game points at one of these ids.
 * type: 'official' (government / operator publication),
 *       'press'    (credible press reporting an official decree or dataset),
 *       'market'   (listing platform or market report),
 *       'regulation' (named regulation; amounts computed by the game),
 *       'game'     (gameplay assumption written for this project).
 * accessed: date this project last checked the source.
 */
(function (root) {
  const RLS = (root.RLS = root.RLS || {});
  RLS.data = RLS.data || {};

  const S = [
    // ── Wages ──────────────────────────────────────────────────────────
    {
      id: 'ump2026_detik', type: 'press', publisher: 'detikFinance',
      title: 'Daftar Lengkap UMP di 38 Provinsi yang Langsung Berlaku Januari 2026',
      url: 'https://finance.detik.com/berita-ekonomi-bisnis/d-8295123/daftar-lengkap-ump-di-38-provinsi-yang-langsung-berlaku-januari-2026',
      published: '2026-01-07', accessed: '2026-10-26',
      note: 'Full list of 38 provincial minimum wages for 2026, effective 1 Jan 2026 under PP 49/2025. Aceh figure quoted from the governor decree.',
    },
    {
      id: 'ump2026_metrotv', type: 'press', publisher: 'Metro TV News',
      title: 'Berlaku Mulai Januari, Kemnaker Rilis Daftar Resmi UMP 2026 di 38 Provinsi',
      url: 'https://metrotvnews.com/read/KXyCWXPX-berlaku-mulai-januari-kemnaker-rilis-daftar-resmi-ump-2026-di-38-provinsi',
      published: '2026-01-08', accessed: '2026-10-26',
      note: 'Reports the Ministry of Manpower (Kemnaker) list as of 5 Jan 2026. Used to cross-check Jakarta, Jawa Barat, Banten, Aceh.',
    },
    {
      id: 'umk2026_tangerang', type: 'press', publisher: 'Dealls',
      title: 'UMK Tangerang Resmi Naik Per 1 Januari 2026',
      url: 'https://dealls.com/pengembangan-karir/umk-tangerang',
      published: '2026-04-13', accessed: '2026-10-26',
      note: 'Cites Keputusan Gubernur Banten No. 703 Tahun 2025 for Kota Tangerang, Kab. Tangerang, Tangerang Selatan, Cilegon and Kota Serang.',
    },
    {
      id: 'umk2026_jawa_bisnis', type: 'press', publisher: 'Bisnis.com',
      title: 'Siap-siap Dipajaki! Ini Daftar UMK 2026 di Jawa yang Lampaui PTKP',
      url: 'https://ekonomi.bisnis.com/read/20251226/259/1939723/siap-siap-dipajaki-ini-daftar-umk-2026-di-jawa-yang-lampaui-ptkp',
      published: '2025-12-26', accessed: '2026-10-26',
      note: 'UMK 2026 for Bekasi, Karawang, Depok, Bogor, Purwakarta, Bandung, Cilegon, Tangerang, Tangerang Selatan.',
    },
    {
      id: 'umk2026_top10', type: 'press', publisher: 'Industry.co.id',
      title: 'Daftar Gaji UMR/UMK 2026 di Seluruh Indonesia',
      url: 'https://www.industry.co.id/read/152368/daftar-gaji-umrumk-2026-di-seluruh-indonesia-lengkap-38-provinsi',
      published: '2026-01', accessed: '2026-10-26',
      note: 'Top-10 UMK list; source used for Kota Batam and Kota Surabaya.',
    },
    {
      id: 'umk2026_sumbarbisnis', type: 'press', publisher: 'Sumbar Bisnis',
      title: 'UMK 2026: Daftar Lengkap Wilayah dengan UMK Tertinggi & Terendah',
      url: 'https://www.sumbarbisnis.com/umk-2026-daftar-lengkap-wilayah-dengan-umk-tertinggi-terendah/',
      published: '2026-01', accessed: '2026-10-26',
      note: 'Used for Bandung Barat, Pangandaran, Kota Sukabumi and four Bali regencies/cities.',
    },
    {
      id: 'umk2026_mamikos_banten', type: 'market', publisher: 'Mamikos',
      title: 'UMK Banten 2026 (artikel info)',
      url: 'https://mamikos.com/info/?p=334000',
      published: '2026', accessed: '2026-10-26',
      note: 'Lower confidence: a listings blog, and its Tangerang Selatan figure (Rp5.297.821) disagrees with two other sources. Used only for Kab. Serang and Pandeglang.',
    },
    {
      id: 'umk2026_lebak', type: 'press', publisher: 'Dealls',
      title: 'Lengkap! 10 Daerah dengan UMR Tertinggi di Indonesia Terbaru 2026',
      url: 'https://dealls.com/pengembangan-karir/umr-tertinggi-di-indonesia',
      published: '2026', accessed: '2026-10-26',
      note: 'Used for Kabupaten Lebak.',
    },
    {
      id: 'umk2026_jateng', type: 'press', publisher: 'Bisnis.com',
      title: 'Lengkap! Daftar UMK Jateng 2026 di 35 Kabupaten & Kota',
      url: 'https://ekonomi.bisnis.com/read/20251228/12/1939935/lengkap-daftar-umk-jateng-2026-di-35-kabupaten-kota',
      published: '2025-12-28', accessed: '2026-10-26',
      note: 'Central Java UMK 2026, announced by the governor on 24 Dec 2025.',
    },
    {
      id: 'umk2026_jateng_mamikos', type: 'market', publisher: 'Mamikos',
      title: 'Gaji UMK/UMR di Brebes 2026 setelah Kenaikan',
      url: 'https://mamikos.com/info/gaji-umk-umr-di-brebes-2026-qna-kry/',
      published: '2026', accessed: '2026-10-26',
      note: 'Used for Jepara, Batang and Brebes; consistent with the Bisnis.com Jateng list for overlapping regencies.',
    },
    {
      id: 'umk2026_jateng_gnfi', type: 'press', publisher: 'Good News From Indonesia',
      title: 'UMP Jawa Tengah 2026 dan Daftar UMK Resmi',
      url: 'https://www.goodnewsfromindonesia.id/ragam/trending/ump-jawa-tengah-2026-dan-daftar-umk-resmi',
      published: '2026', accessed: '2026-10-26',
      note: 'Used for Kota Pekalongan, Kota Tegal and Banjarnegara.',
    },
    {
      id: 'umk2026_diy', type: 'press', publisher: 'Bisnis.com (Kabar24)',
      title: 'Perbandingan UMP dan UMK se-Jawa 2026, DIY Masih Terendah?',
      url: 'https://kabar24.bisnis.com/read/20251225/15/1939588/perbandingan-ump-dan-umk-se-jawa-2026-diy-masih-terendah',
      published: '2025-12-25', accessed: '2026-10-26',
      note: 'Yogyakarta, Sleman, Bantul UMK 2026.',
    },
    {
      id: 'umk2026_sumut', type: 'press', publisher: 'Fakultas Hukum UMSU',
      title: 'Daftar Rincian UMK Sumut Tahun 2026 di 33 Kabupaten/Kota',
      url: 'https://fahum.umsu.ac.id/info/daftar-rincian-umk-sumut-tahun-2026-di-33-kabupaten-kota/',
      published: '2025-12-28', accessed: '2026-10-26',
      note: 'North Sumatra UMK 2026 (Medan, Binjai, Sibolga, Tanjungbalai, Tebing Tinggi, Padangsidimpuan).',
    },
    {
      id: 'umk2026_makassar', type: 'press', publisher: 'Metro TV News',
      title: 'Berapa UMK Makassar di 2026? Cek Besaran Terbarunya di Sini',
      url: 'https://www.metrotvnews.com/read/NOlC9xp9-berapa-umk-makassar-di-2026-cek-besaran-terbarunya-di-sini',
      published: '2026-02-06', accessed: '2026-10-26',
      note: 'Cites the Makassar city government website.',
    },

    // ── Payroll deductions ─────────────────────────────────────────────
    {
      id: 'bpjstk_iuran', type: 'official', publisher: 'BPJS Ketenagakerjaan',
      title: 'Berapa Besaran Iuran JHT, JKK, JKM, JP dan JKP?',
      url: 'https://www.bpjsketenagakerjaan.go.id/artikel/18913/artikel-berapa-besaran-iuran-jht,-jkk,-jkm,-jp-dan-jkp',
      published: '2026', accessed: '2026-10-26',
      note: 'Employee share: JHT 2%, JP 1% (JP has a wage ceiling far above any minimum wage).',
    },
    {
      id: 'bpjskes_iuran', type: 'press', publisher: 'Babel Insight',
      title: 'Potongan Iuran BPJS Ketenagakerjaan PPU 2026 Capai 3 Persen Gaji',
      url: 'https://www.babelinsight.id/potongan-iuran-bpjs-ketenagakerjaan-ppu-2026',
      published: '2026', accessed: '2026-10-26',
      note: 'JKN (BPJS Kesehatan) for wage earners: 5% total, 1% paid by the worker.',
    },
    {
      id: 'pph21_ter', type: 'regulation', publisher: 'Kementerian Keuangan',
      title: 'PMK 168/2023 — PPh 21 monthly effective rates (TER), category A',
      url: null, published: '2023-12', accessed: '2026-10-26',
      note: 'Game computes a TER-based monthly withholding for an unmarried worker with no dependants (TK/0). Not checked against a real payslip.',
    },

    // ── Utilities ──────────────────────────────────────────────────────
    {
      id: 'pln_2026', type: 'press', publisher: 'Bisnis.com',
      title: 'Cek! Daftar Tarif Listrik Terbaru Berlaku 1 Januari 2026',
      url: 'https://ekonomi.bisnis.com/read/20260102/44/1941013/cek-daftar-tarif-listrik-terbaru-berlaku-1-januari-2026',
      published: '2026-01-02', accessed: '2026-10-26',
      note: 'Household tariffs per kWh: R-1 450 VA Rp415 (subsidised), 900 VA subsidised Rp605, 900 VA RTM Rp1.352, 1.300–2.200 VA Rp1.444,70.',
    },
    {
      id: 'pln_q4_2026', type: 'press', publisher: 'JournalArta',
      title: 'Tarif Listrik PLN Oktober 2026: Resmi Tak Naik',
      url: 'https://journalarta.com/news/2026/10/13/tarif-listrik-pln-oktober-2026-2/',
      published: '2026-10-13', accessed: '2026-10-26',
      note: 'Q4 2026 (Oct–Dec) tariffs unchanged from Q3.',
    },

    // ── Transport ─────────────────────────────────────────────────────
    {
      id: 'transit_jkt_2026', type: 'press', publisher: 'Bisnis.com',
      title: 'Lengkap! Tarif Transjakarta, KRL, MRT, hingga LRT Awal 2026',
      url: 'https://ekonomi.bisnis.com/read/20260106/98/1942136/lengkap-tarif-transjakarta-krl-mrt-hingga-lrt-awal-2026',
      published: '2026-01-06', accessed: '2026-10-26',
      note: 'TransJakarta Rp3.500 flat (Rp2.000 05.00–07.00); KRL Rp3.000 first 25 km + Rp1.000 per 10 km; MRT Rp4.000–14.000; LRT Jakarta Rp5.000; LRT Jabodebek Rp5.000 + Rp700/km, max Rp20.000 peak; Mikrotrans free.',
    },
    {
      id: 'tj_2026_freeze', type: 'press', publisher: 'Bisnis.com',
      title: 'Tarif Transjakarta Batal Naik, Anggaran Bakal Dikerek Jadi Rp4,8 Triliun',
      url: 'https://ekonomi.bisnis.com/read/20260108/98/1942749/tarif-transjakarta-batal-naik-anggaran-bakal-dikerek-jadi-rp48-triliun',
      published: '2026-01-08', accessed: '2026-10-26',
      note: 'TransJakarta fare kept at Rp3.500 for 2026.',
    },

    // ── Food prices ───────────────────────────────────────────────────
    {
      id: 'pangan_20260228', type: 'press', publisher: 'Bisnis.com (Panel Harga Bapanas)',
      title: 'Harga Pangan Hari Ini (28/2): Daging & Telur Kompak Naik',
      url: 'https://ekonomi.bisnis.com/read/20260228/12/1956504/harga-pangan-hari-ini-282-daging-telur-kompak-naik',
      published: '2026-02-28', accessed: '2026-10-26',
      note: 'National consumer averages: beras premium Rp15.368/kg, medium Rp13.473/kg, beef Rp135.331/kg, chicken Rp37.459/kg, eggs Rp31.038/kg.',
    },
    {
      id: 'pangan_20260224', type: 'press', publisher: 'Bisnis.com (Panel Harga Bapanas)',
      title: 'Harga Pangan Hari Ini 24 Februari',
      url: 'https://ekonomi.bisnis.com/read/20260224/12/1955233/harga-pangan-hari-ini-24-februari-harga-telur-daging-ayam-cabai-rawit-melambung',
      published: '2026-02-24', accessed: '2026-10-26',
      note: 'Beras SPHP (Bulog) national consumer average Rp12.365/kg.',
    },
    {
      id: 'pangan_20260120', type: 'press', publisher: 'Bisnis.com (Panel Harga Bapanas)',
      title: 'Harga Pangan Selasa (20/1): Beras Stabil, Telur Ayam Konsisten Naik',
      url: 'https://ekonomi.bisnis.com/read/20260120/12/1945446/harga-pangan-selasa-201-beras-stabil-telur-ayam-konsisten-naik',
      published: '2026-01-20', accessed: '2026-10-26',
      note: 'Cooking oil national averages: packaged Rp20.531/L, bulk (curah) Rp17.266/L.',
    },

    // ── Housing ───────────────────────────────────────────────────────
    {
      id: 'kost_jakarta', type: 'market', publisher: 'Mamikos',
      title: 'Kost Jakarta — rata-rata harga sewa',
      url: 'https://mamikos.com/kost/kost-jakarta-murah',
      published: '2026', accessed: '2026-10-26',
      note: 'Platform averages: men\'s kost Rp1.492.000, women\'s Rp2.000.600, private bathroom or AC Rp2.500.800, all listings Rp3.649.000 per month.',
    },
    {
      id: 'kost_tangerang', type: 'market', publisher: 'Mamikos',
      title: 'Biaya hidup / harga kos di Tangerang',
      url: 'https://mamikos.com/info/?p=323406',
      published: '2026', accessed: '2026-10-26',
      note: 'Typical kost with AC, private bathroom and Wi-Fi about Rp1,8–2 juta; lowest around Rp1,3 juta.',
    },

    // ── Documents, employment law, lending, travel (added in v0.2) ─────
    {
      id: 'passport_fee_2024', type: 'press', publisher: 'Bisnis.com (Kabar24)',
      title: 'Resmi! Ini Tarif Bikin Paspor Terbaru yang Mulai Berlaku Hari Ini',
      url: 'https://kabar24.bisnis.com/read/20241217/15/1825100/resmi-ini-tarif-bikin-paspor-terbaru-yang-mulai-berlaku-hari-ini',
      published: '2024-12-17', accessed: '2026-10-27',
      note: 'PP 45/2024 passport fees: non-electronic 5 yr Rp350.000, 10 yr Rp650.000; electronic 5 yr Rp650.000, 10 yr Rp950.000; same-day service Rp1.000.000.',
    },
    {
      id: 'passport_10y', type: 'press', publisher: 'Suara Surabaya',
      title: 'Masa berlaku paspor 10 tahun (Permenkumham 18/2022)',
      url: 'https://www.suarasurabaya.net/?p=586827',
      published: '2022-10-09', accessed: '2026-10-27',
      note: '10-year validity applies to citizens aged 17+ or married; others receive 5 years.',
    },
    {
      id: 'skck_2026', type: 'press', publisher: 'Good News From Indonesia',
      title: 'SKCK digital bisa dibuat lewat Presisi Polri Super App per Maret 2026',
      url: 'https://www.goodnewsfromindonesia.id/short/skck-digital-bisa-dibuat-lewat-presisipolri-super-app-per-maret-2026',
      published: '2026-03-31', accessed: '2026-10-27',
      note: 'E-SKCK Rp30.000 PNBP, valid 6 months, issued within 24 hours; needs digital ID, family card, birth certificate or diploma, red-background photo and active BPJS Kesehatan membership.',
    },
    {
      id: 'jkp_2025', type: 'press', publisher: 'Bisnis.com',
      title: 'Korban PHK Dapat 60% Gaji Selama 6 Bulan, Simak Ketentuannya',
      url: 'https://ekonomi.bisnis.com/read/20250217/12/1840075/korban-phk-dapat-60-gaji-selama-6-bulan-simak-ketentuannya',
      published: '2025-02-17', accessed: '2026-10-27',
      note: 'PP 6/2025 JKP: 60% of the last reported wage (capped at Rp5 juta) for up to 6 months; needs 12 months of contributions within 24 months; PKWT and PKWTT; claim within 6 months.',
    },
    {
      id: 'labour_rules', type: 'regulation', publisher: 'UU 13/2003 (as amended), PP 35/2021, Permenaker 4/2022',
      title: 'Leave, sick pay, termination notice, severance, PKWT compensation, JHT claim',
      url: null, published: '2021-02', accessed: '2026-10-27',
      note: 'Game reading: 12 days annual leave after 12 months; paid sick leave with a doctor\'s note; 14 working days termination notice; severance schedule (1 month wage under 1 year of service, rising with tenure); PKWT compensation of 1 month wage per 12 months, pro rata; JHT claimable 1 month after leaving. Not legal advice; real entitlements depend on the reason and agreement.',
    },
    {
      id: 'ojk_p2p', type: 'press', publisher: 'Bisnis.com',
      title: '7 Aturan Pinjol Terbaru Menurut OJK',
      url: 'https://finansial.bisnis.com/read/20231218/90/1724758/7-aturan-pinjol-terbaru-menurut-ojk-bunga-dan-denda-rendah-tapi-tak-boleh-pinjam-lebih-dari-3-platform',
      published: '2023-12-18', accessed: '2026-10-27',
      note: 'SEOJK 19/2023: consumptive P2P loans capped at 0,1% per day from 2026 (0,3% 2024, 0,2% 2025), caps include interest and fees; borrowers may use at most 3 platforms.',
    },
    {
      id: 'jkn_family', type: 'regulation', publisher: 'Perpres 82/2018, Perpres 64/2020',
      title: 'JKN coverage for wage earners\' families; independent class 3 contribution',
      url: null, published: '2020-05', accessed: '2026-10-27',
      note: 'Game reading: a formal wage earner\'s contribution covers up to 5 people (worker, spouse, up to 3 children); independent class 3 members pay Rp35.000 per person per month.',
    },
    {
      id: 'akg_2019', type: 'regulation', publisher: 'Permenkes 28/2019 (Angka Kecukupan Gizi)',
      title: 'Indonesian recommended daily energy and protein intake',
      url: null, published: '2019', accessed: '2026-10-27',
      note: 'Reference values used to scale the simplified nutrition meter (e.g. ages 19–29: about 2.650 kcal and 65 g protein for men, 2.250 kcal and 60 g for women). The game\'s food values are rough estimates, not dietary advice.',
    },
    {
      id: 'visa_jp_2026', type: 'press', publisher: 'CNBC Indonesia',
      title: 'Sudah Berlaku, Biaya Visa Jepang Naik 5x Lipat Jadi Rp1,65 Juta',
      url: 'https://cnbcindonesia.com/lifestyle/20260803154108-33-756140/sudah-berlaku-biaya-visa-jepang-naik-5x-lipat-jadi-rp165-juta',
      published: '2026-08-03', accessed: '2026-10-27',
      note: 'From 1 July 2026: single-entry Rp1.650.000, multiple-entry Rp3.330.000; applications through JVAC Jakarta. The e-passport visa waiver (15 days) remains.',
    },
    {
      id: 'javes_2026', type: 'press', publisher: 'Metro TV News',
      title: 'Bebas Visa ke Jepang 15 Hari: Simak Prosedur Registrasi JAVES bagi WNI',
      url: 'https://www.metrotvnews.com/read/bzGCepJQ-bebas-visa-ke-jepang-15-hari-simak-prosedur-registrasi-javes-bagi-wni',
      published: '2026-02-17', accessed: '2026-10-27',
      note: 'Indonesian e-passport holders register on JAVES before departure; stays of up to 15 days, no visa fee; passport valid 6+ months; return or onward ticket.',
    },
    {
      id: 'visa_kr', type: 'market', publisher: 'Trip.com (guide)',
      title: 'Visa Korea: Syarat, Biaya, dan Cara Mengurusnya [2026]',
      url: 'https://id.trip.com/guide/info/visa-korea.html',
      published: '2026', accessed: '2026-10-27',
      note: 'Lower confidence (travel platform). Single entry ≤90 days about Rp856.000 including Rp240.000 KVAC service fee; about 9 working days; no official minimum bank balance.',
    },
    {
      id: 'visa_au', type: 'market', publisher: 'Asia Pacific Group (migration agent)',
      title: 'Australian tourist visa cost and fees',
      url: 'https://asiapacificgroup.com/blog/australian-tourist-visa-cost-fees/',
      published: '2026', accessed: '2026-10-27',
      note: 'Visitor visa subclass 600 (tourist stream, outside Australia): AUD 250 from 1 July 2026 (previously AUD 200). Check the Department of Home Affairs before relying on it.',
    },
    {
      id: 'visa_uk', type: 'market', publisher: 'DavidsonMorris (law firm)',
      title: 'UK Visitor Visa Fees 2026',
      url: 'https://www.davidsonmorris.com/uk-visitor-visa-fees/',
      published: '2026-01-02', accessed: '2026-10-27',
      note: 'Standard Visitor visa up to 6 months £127; decision usually within 3 weeks of biometrics.',
    },
    {
      id: 'asean_entry', type: 'game', publisher: 'Real Life Simulator',
      title: 'ASEAN visa exemption and digital arrival cards',
      url: null, published: '2026-10-27', accessed: '2026-10-27',
      note: 'Indonesian passport holders can visit Singapore, Malaysia, Thailand and Vietnam visa-free for up to 30 days; Singapore, Malaysia and Thailand ask for a free online arrival card within 3 days before arrival. From general knowledge, not re-verified this session.',
    },
    {
      id: 'healing119', type: 'press', publisher: 'detikHealth',
      title: 'Kemenkes Buka Layanan Konseling Gratis bagi Warga +62',
      url: 'https://health.detik.com/berita-detikhealth/d-8092544/kemenkes-buka-layanan-konseling-gratis-bagi-warga-62-yang-anxiety-gegara-demo',
      published: '2025-09-02', accessed: '2026-10-27',
      note: 'Ministry of Health counselling: healing119.id (24-hour, call or chat with psychologists) and phone 119 extension 8. Shown to players in the support screen; not used in any calculation.',
    },
    {
      id: 'fictional_brands', type: 'game', publisher: 'Real Life Simulator',
      title: 'Fictional brands, companies, providers and lenders',
      url: null, published: '2026-10-27', accessed: '2026-10-27',
      note: 'Every brand, employer, ride-hailing provider and lender in the game is invented. Job listings are not real vacancies. Real services differ in price, features and safety practices.',
    },

    // ── Game assumptions ──────────────────────────────────────────────
    {
      id: 'game_assumption', type: 'game', publisher: 'Real Life Simulator',
      title: 'Gameplay assumption',
      url: null, published: '2026-10-26', accessed: '2026-10-26',
      note: 'A plausible value written for gameplay. Not an observed price. Replace with a sourced observation when one is available.',
    },
    {
      id: 'game_rent_model', type: 'game', publisher: 'Real Life Simulator',
      title: 'Rent tier model',
      url: null, published: '2026-10-26', accessed: '2026-10-26',
      note: 'Tier A (Jakarta) and Tier B (Jabodetabek satellites) rents are anchored to the Mamikos averages above. Tiers C and D are scaled down from those anchors and have not been checked against local listings.',
    },
    {
      id: 'game_ojol_model', type: 'game', publisher: 'Real Life Simulator',
      title: 'Ride-hailing fare model',
      url: null, published: '2026-10-26', accessed: '2026-10-26',
      note: 'Per-km ranges modelled on the Ministry of Transportation zone bands for ojek online. Platform service fees, surge pricing and promos are not included.',
    },
  ];

  RLS.data.sources = S;
  RLS.data.sourceById = Object.fromEntries(S.map((s) => [s.id, s]));
  if (typeof module !== 'undefined' && module.exports) module.exports = S;
})(typeof globalThis !== 'undefined' ? globalThis : this);
