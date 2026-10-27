/*
 * indonesia.js — provinces, cities/regencies, 2026 minimum wages, and
 * per-locality profiles (rent tier, transport availability).
 *
 * WAGE RULES
 *  - Every province carries its 2026 UMP.
 *  - A city/regency carries a UMK only where a 2026 figure was found in a
 *    source listed in sources.js. Otherwise umk is null and the game falls
 *    back to the UMP and says so on screen.
 *  - DKI Jakarta has no UMK; its five administrative cities use the UMP.
 *  - Amounts are strings in rupiah exactly as published (decimals = sen).
 *
 * TIERS (rent model, see game_rent_model)
 *  A  Jakarta
 *  B  Jabodetabek satellites and the largest metros outside Jakarta
 *  C  Other provincial capitals and large cities
 *  D  Regencies and smaller cities
 *
 * TRANSPORT PROFILES (see engine.transportModes)
 *  jakarta        TransJakarta, MRT, LRT Jakarta, KRL, Mikrotrans, ojol
 *  krl            Jabodetabek area served by KRL Commuter Line
 *  krl_lrt        KRL plus LRT Jabodebek stations
 *  city_bus       A city bus system is reported; fare not loaded
 *  basic          Angkot, ojol, own motorcycle
 *  remote         Limited ride-hailing; angkot/ojek pangkalan, own motorcycle
 */
(function (root) {
  const RLS = (root.RLS = root.RLS || {});
  RLS.data = RLS.data || {};

  const UMP_SRC = 'ump2026_detik';

  // [id, name, UMP 2026 (Rp), note]
  const PROVINCES = [
    ['aceh', 'Aceh', '3932552', 'Set late (6 Jan 2026) after flood response; quoted from the governor decree.'],
    ['sumut', 'Sumatera Utara', '3228949', 'Fortune IDN reports Rp3.228.701; detikFinance figure used.'],
    ['sumbar', 'Sumatera Barat', '3182955', null],
    ['riau', 'Riau', '3780495', null],
    ['jambi', 'Jambi', '3471497', null],
    ['sumsel', 'Sumatera Selatan', '3942963', null],
    ['bengkulu', 'Bengkulu', '2827250', null],
    ['lampung', 'Lampung', '3047734', null],
    ['babel', 'Kepulauan Bangka Belitung', '4035000', null],
    ['kepri', 'Kepulauan Riau', '3879520', null],
    ['dki', 'DKI Jakarta', '5729876', 'Highest UMP in 2026. Jakarta sets no UMK, so the UMP applies across all five administrative cities.'],
    ['jabar', 'Jawa Barat', '2317601', 'Lowest UMP in 2026, but several regencies (Bekasi, Karawang) have the highest UMK in the country.'],
    ['jateng', 'Jawa Tengah', '2327386.07', null],
    ['diy', 'DI Yogyakarta', '2417495', null],
    ['jatim', 'Jawa Timur', '2446880', null],
    ['banten', 'Banten', '3100881.40', null],
    ['bali', 'Bali', '3207459', null],
    ['ntb', 'Nusa Tenggara Barat', '2673861', null],
    ['ntt', 'Nusa Tenggara Timur', '2455898', null],
    ['kalbar', 'Kalimantan Barat', '3054552', null],
    ['kalteng', 'Kalimantan Tengah', '3686138', null],
    ['kalsel', 'Kalimantan Selatan', '3725000', 'Fortune IDN reports Rp3.686.138; detikFinance figure used.'],
    ['kaltim', 'Kalimantan Timur', '3762431', 'Fortune IDN reports Rp3.759.313; detikFinance figure used.'],
    ['kaltara', 'Kalimantan Utara', '3775243', 'Fortune IDN reports Rp3.770.000; detikFinance figure used.'],
    ['sulut', 'Sulawesi Utara', '4002630', null],
    ['sulteng', 'Sulawesi Tengah', '3179565', null],
    ['sulsel', 'Sulawesi Selatan', '3921088', null],
    ['sultra', 'Sulawesi Tenggara', '3306496.18', null],
    ['gorontalo', 'Gorontalo', '3405144', null],
    ['sulbar', 'Sulawesi Barat', '3315934', null],
    ['maluku', 'Maluku', '3334490', null],
    ['malut', 'Maluku Utara', '3510240', null],
    ['pabar', 'Papua Barat', '3841000', null],
    ['pbd', 'Papua Barat Daya', '3766000', null],
    ['papua', 'Papua', '4436283', null],
    ['papsel', 'Papua Selatan', '4508100', null],
    ['papteng', 'Papua Tengah', '4285848', null],
    ['pappeg', 'Papua Pegunungan', '4508714', null],
  ];

  /*
   * Cities / regencies.
   * [id, provinceId, name, kind, umk|null, umkSourceId|null, tier, transportProfile, extra]
   * kind: 'kota' | 'kab' | 'kota_adm'
   * extra: { bus: 'name of reported city bus system', note: '…' }
   */
  const CITIES = [
    // DKI Jakarta (UMP applies)
    ['jkt_pusat', 'dki', 'Jakarta Pusat', 'kota_adm', null, null, 'A', 'jakarta'],
    ['jkt_selatan', 'dki', 'Jakarta Selatan', 'kota_adm', null, null, 'A', 'jakarta'],
    ['jkt_barat', 'dki', 'Jakarta Barat', 'kota_adm', null, null, 'A', 'jakarta'],
    ['jkt_timur', 'dki', 'Jakarta Timur', 'kota_adm', null, null, 'A', 'jakarta'],
    ['jkt_utara', 'dki', 'Jakarta Utara', 'kota_adm', null, null, 'A', 'jakarta'],

    // Banten
    ['tangsel', 'banten', 'Tangerang Selatan', 'kota', '5247870', 'umk2026_tangerang', 'B', 'krl', { note: 'A listings blog reports Rp5.297.821; two sources citing Kepgub Banten 703/2025 give Rp5.247.870, used here.' }],
    ['kota_tangerang', 'banten', 'Kota Tangerang', 'kota', '5399405.69', 'umk2026_tangerang', 'B', 'krl'],
    ['kab_tangerang', 'banten', 'Kabupaten Tangerang', 'kab', '5210377', 'umk2026_tangerang', 'B', 'krl', { note: 'Another source reports Rp5.219.789. Figure citing Kepgub Banten 703/2025 used.' }],
    ['cilegon', 'banten', 'Kota Cilegon', 'kota', '5469922.59', 'umk2026_tangerang', 'C', 'basic'],
    ['kota_serang', 'banten', 'Kota Serang', 'kota', '4665927.94', 'umk2026_tangerang', 'C', 'basic', { note: 'Reported as unchanged from 2025.' }],
    ['kab_serang', 'banten', 'Kabupaten Serang', 'kab', '5172678', 'umk2026_mamikos_banten', 'D', 'basic', { note: 'Single lower-confidence source.' }],
    ['lebak', 'banten', 'Kabupaten Lebak', 'kab', '3378589', 'umk2026_lebak', 'D', 'krl', { note: 'KRL reaches Rangkasbitung.' }],
    ['pandeglang', 'banten', 'Kabupaten Pandeglang', 'kab', '3415071', 'umk2026_mamikos_banten', 'D', 'basic', { note: 'Single lower-confidence source.' }],

    // Jawa Barat
    ['kota_bekasi', 'jabar', 'Kota Bekasi', 'kota', '5999443', 'umk2026_jawa_bisnis', 'B', 'krl_lrt'],
    ['kab_bekasi', 'jabar', 'Kabupaten Bekasi', 'kab', '5938885', 'umk2026_jawa_bisnis', 'B', 'krl', { note: 'KRL Cikarang line.' }],
    ['karawang', 'jabar', 'Kabupaten Karawang', 'kab', '5886853', 'umk2026_jawa_bisnis', 'C', 'basic'],
    ['depok', 'jabar', 'Kota Depok', 'kota', '5522662', 'umk2026_jawa_bisnis', 'B', 'krl_lrt'],
    ['kota_bogor', 'jabar', 'Kota Bogor', 'kota', '5437203', 'umk2026_jawa_bisnis', 'B', 'krl'],
    ['kab_bogor', 'jabar', 'Kabupaten Bogor', 'kab', '5161769', 'umk2026_jawa_bisnis', 'B', 'krl'],
    ['purwakarta', 'jabar', 'Kabupaten Purwakarta', 'kab', '5052856', 'umk2026_jawa_bisnis', 'D', 'basic'],
    ['kota_bandung', 'jabar', 'Kota Bandung', 'kota', '4737678', 'umk2026_jawa_bisnis', 'B', 'city_bus', { bus: 'Trans Metro Pasundan / Trans Metro Bandung' }],
    ['bandung_barat', 'jabar', 'Kabupaten Bandung Barat', 'kab', '3984711', 'umk2026_sumbarbisnis', 'D', 'basic'],
    ['kota_sukabumi', 'jabar', 'Kota Sukabumi', 'kota', '3192807', 'umk2026_sumbarbisnis', 'D', 'basic'],
    ['pangandaran', 'jabar', 'Kabupaten Pangandaran', 'kab', '2351250', 'umk2026_sumbarbisnis', 'D', 'remote'],

    // Jawa Tengah
    ['kota_semarang', 'jateng', 'Kota Semarang', 'kota', '3701709', 'umk2026_jateng', 'C', 'city_bus', { bus: 'Trans Semarang' }],
    ['demak', 'jateng', 'Kabupaten Demak', 'kab', '3122805', 'umk2026_jateng', 'D', 'basic'],
    ['kendal', 'jateng', 'Kabupaten Kendal', 'kab', '2992994', 'umk2026_jateng', 'D', 'basic'],
    ['kab_semarang', 'jateng', 'Kabupaten Semarang', 'kab', '2940088', 'umk2026_jateng', 'D', 'basic'],
    ['kudus', 'jateng', 'Kabupaten Kudus', 'kab', '2818585', 'umk2026_jateng', 'D', 'basic'],
    ['cilacap', 'jateng', 'Kabupaten Cilacap', 'kab', '2773184', 'umk2026_jateng', 'D', 'basic'],
    ['jepara', 'jateng', 'Kabupaten Jepara', 'kab', '2756501', 'umk2026_jateng_mamikos', 'D', 'basic'],
    ['batang', 'jateng', 'Kabupaten Batang', 'kab', '2708520', 'umk2026_jateng_mamikos', 'D', 'basic'],
    ['kota_pekalongan', 'jateng', 'Kota Pekalongan', 'kota', '2700926', 'umk2026_jateng_gnfi', 'D', 'basic'],
    ['kota_tegal', 'jateng', 'Kota Tegal', 'kota', '2526510', 'umk2026_jateng_gnfi', 'D', 'basic'],
    ['brebes', 'jateng', 'Kabupaten Brebes', 'kab', '2400350', 'umk2026_jateng_mamikos', 'D', 'basic'],
    ['banjarnegara', 'jateng', 'Kabupaten Banjarnegara', 'kab', '2327813', 'umk2026_jateng_gnfi', 'D', 'remote', { note: 'Lowest UMK in Central Java for 2026.' }],

    // DI Yogyakarta
    ['kota_yogya', 'diy', 'Kota Yogyakarta', 'kota', '2827593', 'umk2026_diy', 'C', 'city_bus', { bus: 'Trans Jogja' }],
    ['sleman', 'diy', 'Kabupaten Sleman', 'kab', '2624387', 'umk2026_diy', 'C', 'city_bus', { bus: 'Trans Jogja' }],
    ['bantul', 'diy', 'Kabupaten Bantul', 'kab', '2509001', 'umk2026_diy', 'D', 'basic'],

    // Jawa Timur
    ['surabaya', 'jatim', 'Kota Surabaya', 'kota', '5288796', 'umk2026_top10', 'B', 'city_bus', { bus: 'Suroboyo Bus / Trans Semanggi' }],

    // Kepulauan Riau
    ['batam', 'kepri', 'Kota Batam', 'kota', '5357982', 'umk2026_top10', 'B', 'city_bus', { bus: 'Trans Batam' }],
    ['tanjungpinang', 'kepri', 'Kota Tanjungpinang', 'kota', null, null, 'C', 'basic'],

    // Bali
    ['denpasar', 'bali', 'Kota Denpasar', 'kota', '3499879', 'umk2026_sumbarbisnis', 'B', 'city_bus', { bus: 'Trans Metro Dewata' }],
    ['badung', 'bali', 'Kabupaten Badung', 'kab', '3791003', 'umk2026_sumbarbisnis', 'B', 'basic'],
    ['gianyar', 'bali', 'Kabupaten Gianyar', 'kab', '3316789', 'umk2026_sumbarbisnis', 'D', 'basic'],
    ['tabanan', 'bali', 'Kabupaten Tabanan', 'kab', '3287679', 'umk2026_sumbarbisnis', 'D', 'basic'],

    // Sumatera Utara
    ['medan', 'sumut', 'Kota Medan', 'kota', '4335198', 'umk2026_sumut', 'C', 'city_bus', { bus: 'Trans Metro Deli' }],
    ['binjai', 'sumut', 'Kota Binjai', 'kota', '3367913.55', 'umk2026_sumut', 'D', 'basic'],
    ['tebing_tinggi', 'sumut', 'Kota Tebing Tinggi', 'kota', '3229957.70', 'umk2026_sumut', 'D', 'basic'],
    ['tanjungbalai', 'sumut', 'Kota Tanjungbalai', 'kota', '3496856.58', 'umk2026_sumut', 'D', 'basic'],
    ['sibolga', 'sumut', 'Kota Sibolga', 'kota', '3668667.50', 'umk2026_sumut', 'D', 'basic'],
    ['padangsidimpuan', 'sumut', 'Kota Padangsidimpuan', 'kota', '3416803', 'umk2026_sumut', 'D', 'basic'],

    // Sulawesi Selatan
    ['makassar', 'sulsel', 'Kota Makassar', 'kota', '4148719', 'umk2026_makassar', 'C', 'city_bus', { bus: 'Trans Mamminasata' }],

    // Provincial capitals without a loaded UMK (UMP fallback)
    ['banda_aceh', 'aceh', 'Kota Banda Aceh', 'kota', null, null, 'C', 'basic'],
    ['padang', 'sumbar', 'Kota Padang', 'kota', null, null, 'C', 'basic'],
    ['pekanbaru', 'riau', 'Kota Pekanbaru', 'kota', null, null, 'C', 'basic'],
    ['kota_jambi', 'jambi', 'Kota Jambi', 'kota', null, null, 'C', 'basic'],
    ['palembang', 'sumsel', 'Kota Palembang', 'kota', null, null, 'C', 'city_bus', { bus: 'Trans Musi Jaya / LRT Sumsel' }],
    ['kota_bengkulu', 'bengkulu', 'Kota Bengkulu', 'kota', null, null, 'C', 'basic'],
    ['bandar_lampung', 'lampung', 'Kota Bandar Lampung', 'kota', null, null, 'C', 'basic'],
    ['pangkalpinang', 'babel', 'Kota Pangkalpinang', 'kota', null, null, 'C', 'basic'],
    ['mataram', 'ntb', 'Kota Mataram', 'kota', null, null, 'C', 'basic'],
    ['kupang', 'ntt', 'Kota Kupang', 'kota', null, null, 'C', 'basic'],
    ['pontianak', 'kalbar', 'Kota Pontianak', 'kota', null, null, 'C', 'basic'],
    ['palangka_raya', 'kalteng', 'Kota Palangka Raya', 'kota', null, null, 'C', 'basic'],
    ['banjarbaru', 'kalsel', 'Kota Banjarbaru', 'kota', null, null, 'C', 'basic'],
    ['banjarmasin', 'kalsel', 'Kota Banjarmasin', 'kota', null, null, 'C', 'basic'],
    ['samarinda', 'kaltim', 'Kota Samarinda', 'kota', null, null, 'C', 'basic'],
    ['balikpapan', 'kaltim', 'Kota Balikpapan', 'kota', null, null, 'C', 'basic'],
    ['tarakan', 'kaltara', 'Kota Tarakan', 'kota', null, null, 'C', 'basic', { note: 'Reported around Rp4,74 juta (rounded); exact figure not loaded.' }],
    ['bulungan', 'kaltara', 'Kabupaten Bulungan (Tanjung Selor)', 'kab', null, null, 'D', 'remote'],
    ['manado', 'sulut', 'Kota Manado', 'kota', null, null, 'C', 'basic'],
    ['palu', 'sulteng', 'Kota Palu', 'kota', null, null, 'C', 'basic'],
    ['kendari', 'sultra', 'Kota Kendari', 'kota', null, null, 'C', 'basic'],
    ['kota_gorontalo', 'gorontalo', 'Kota Gorontalo', 'kota', null, null, 'C', 'basic'],
    ['mamuju', 'sulbar', 'Kabupaten Mamuju', 'kab', null, null, 'D', 'remote'],
    ['ambon', 'maluku', 'Kota Ambon', 'kota', null, null, 'C', 'basic'],
    ['ternate', 'malut', 'Kota Ternate', 'kota', null, null, 'C', 'basic'],
    ['manokwari', 'pabar', 'Kabupaten Manokwari', 'kab', null, null, 'C', 'remote'],
    ['sorong', 'pbd', 'Kota Sorong', 'kota', null, null, 'C', 'basic'],
    ['jayapura', 'papua', 'Kota Jayapura', 'kota', null, null, 'C', 'basic'],
    ['merauke', 'papsel', 'Kabupaten Merauke', 'kab', null, null, 'D', 'remote'],
    ['nabire', 'papteng', 'Kabupaten Nabire', 'kab', null, null, 'D', 'remote'],
    ['jayawijaya', 'pappeg', 'Kabupaten Jayawijaya (Wamena)', 'kab', null, null, 'D', 'remote'],
  ];

  const provinces = PROVINCES.map(([id, name, ump, note]) => ({
    id, name, countryId: 'id', administrativeLevel: 'province',
    wage: {
      id: `ump-${id}-2026`, countryId: 'id', regionId: id, cityId: null,
      wageType: 'UMP', amountMajor: ump, currency: 'IDR', period: 'month',
      effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31', grossOrNet: 'gross',
      sourceId: UMP_SRC, verificationStatus: 'VERIFIED', note,
    },
  }));

  const cities = CITIES.map(([id, provinceId, name, kind, umk, src, tier, transport, extra = {}]) => ({
    id, provinceId, name, kind, countryId: 'id', administrativeLevel: kind === 'kab' ? 'regency' : 'city',
    parentRegionId: provinceId, tier, transport, bus: extra.bus || null,
    wage: umk ? {
      id: `umk-${id}-2026`, countryId: 'id', regionId: provinceId, cityId: id,
      wageType: 'UMK', amountMajor: umk, currency: 'IDR', period: 'month',
      effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31', grossOrNet: 'gross',
      sourceId: src, verificationStatus: 'VERIFIED',
      note: extra.note || null,
    } : null,
    note: !umk ? extra.note || null : null,
  }));

  RLS.data.indonesia = {
    year: 2026,
    provinces,
    cities,
    provinceById: Object.fromEntries(provinces.map((p) => [p.id, p])),
    cityById: Object.fromEntries(cities.map((c) => [c.id, c])),
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = RLS.data.indonesia;
})(typeof globalThis !== 'undefined' ? globalThis : this);
