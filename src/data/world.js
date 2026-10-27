/*
 * world.js — ride-hailing providers, recreation activities, city features.
 * Providers are FICTIONAL. Their prices, waits and incident chances are game
 * parameters, not ratings of any real company (source `fictional_brands`).
 */
(function (root) {
  const RLS = (root.RLS = root.RLS || {});
  RLS.data = RLS.data || {};
  const { bi } = RLS.i18n;

  /*
   * Provider fields:
   *  tiers     { econ|standard|comfort: { vehicle, mult, wait:[min,max] } } — only the tiers it offers
   *  cities    city tiers / transport profiles it serves
   *  cancel    chance a driver cancels or no driver accepts (game parameter)
   *  verify    'id_face' | 'documents' | 'community' | 'unknown'
   *  share, sos, insurance, support: features shown to the player
   *  risk      multiplier on the (rare) safety-incident roll
   */
  const PROVIDERS = [
    { id: 'gesit', name: 'Gesit', kind: 'app', label: bi('Aplikasi nasional (fiktif)', 'National app (fictional)'),
      tiers: { econ: { vehicle: 'motor', mult: 0.9, wait: [6, 14] }, standard: { vehicle: 'motor', mult: 1, wait: [3, 8] }, comfort: { vehicle: 'car', mult: 1.35, wait: [5, 12] } },
      carStandard: true, cityTiers: ['A', 'B', 'C', 'D'], profiles: ['jakarta', 'krl', 'krl_lrt', 'city_bus', 'basic'], cancel: 0.06,
      verify: 'id_face', share: true, sos: true, insurance: true, support: bi('Pusat bantuan 24 jam dalam aplikasi', '24-hour in-app help centre'), risk: 1 },
    { id: 'kilat', name: 'Kilat', kind: 'app', label: bi('Aplikasi nasional (fiktif)', 'National app (fictional)'),
      tiers: { econ: { vehicle: 'motor', mult: 0.85, wait: [5, 15] }, standard: { vehicle: 'motor', mult: 0.98, wait: [3, 9] } },
      carStandard: true, cityTiers: ['A', 'B', 'C'], profiles: ['jakarta', 'krl', 'krl_lrt', 'city_bus', 'basic'], cancel: 0.08,
      verify: 'id_face', share: true, sos: true, insurance: true, support: bi('Chat bantuan dalam aplikasi', 'In-app support chat'), risk: 1 },
    { id: 'laju', name: 'Laju', kind: 'app', label: bi('Aplikasi tarif rendah (fiktif)', 'Low-fare app (fictional)'),
      tiers: { econ: { vehicle: 'motor', mult: 0.75, wait: [8, 22] }, standard: { vehicle: 'car', mult: 0.85, wait: [10, 25] } },
      cityTiers: ['B', 'C', 'D'], profiles: ['krl', 'krl_lrt', 'city_bus', 'basic', 'remote'], cancel: 0.15,
      verify: 'documents', share: true, sos: false, insurance: false, support: bi('Bantuan lewat email, respons lambat', 'Email support, slow replies'), risk: 1.4,
      note: bi('Tarif sering bisa ditawar di aplikasi.', 'Fares can often be negotiated in the app.') },
    { id: 'pangkalan', name: bi('Ojek pangkalan', 'Ojek stand'), kind: 'informal', label: bi('Ojek pangkalan di ujung gang', 'Motorbike taxi stand at the corner'),
      tiers: { standard: { vehicle: 'motor', mult: 1.05, wait: [0, 6], haggle: [0.85, 1.4] } },
      cityTiers: ['A', 'B', 'C', 'D'], profiles: ['jakarta', 'krl', 'krl_lrt', 'city_bus', 'basic', 'remote'], cancel: 0.02,
      verify: 'community', share: false, sos: false, insurance: false, support: bi('Tidak ada; pengemudi biasanya dikenal warga sekitar', 'None; drivers are usually known locally'), risk: 1.2,
      note: bi('Harga ditawar langsung. Tidak ada aplikasi, jadi tidak ada fitur bagikan perjalanan.', 'Price is agreed on the spot. No app, so no trip sharing.') },
  ];
  // Offered only as an optional event ("cheap ride from a chat group").
  const UNVERIFIED = { id: 'unverified', name: bi('Tumpangan dari grup chat', 'Ride offered in a chat group'), kind: 'unverified', label: bi('Penyedia tidak terverifikasi', 'Unverified provider'),
    tiers: { econ: { vehicle: 'car', mult: 0.6, wait: [5, 40] } }, cancel: 0.15, verify: 'unknown', share: false, sos: false, insurance: false,
    support: bi('Tidak ada', 'None'), risk: 6, fareChange: 0.25 };

  const VERIFY_LABEL = {
    id_face: bi('KTP & verifikasi wajah pengemudi', 'Driver ID and face check'),
    documents: bi('Unggah dokumen pengemudi', 'Driver document upload'),
    community: bi('Dikenal warga sekitar, tanpa verifikasi formal', 'Known locally, no formal check'),
    unknown: bi('Tidak diketahui', 'Unknown'),
  };

  // City features for recreation availability, by rent tier, plus named extras.
  const FEATURES_BY_TIER = {
    A: ['park', 'cfd', 'museum', 'mall', 'library', 'cinema', 'karaoke', 'amusement', 'concert', 'cafe', 'pool'],
    B: ['park', 'cfd', 'museum', 'mall', 'library', 'cinema', 'karaoke', 'cafe', 'pool', 'concert'],
    C: ['park', 'alun', 'cfd', 'mall', 'library', 'cinema', 'karaoke', 'cafe', 'pool'],
    D: ['park', 'alun', 'cafe'],
  };
  const BEACH_CITIES = ['denpasar', 'badung', 'gianyar', 'tabanan', 'makassar', 'padang', 'manado', 'kupang', 'ambon', 'mataram', 'ternate', 'sorong', 'jayapura', 'bandar_lampung', 'pangandaran', 'batam', 'balikpapan', 'kendari', 'palu', 'kota_bengkulu', 'jkt_utara'];

  /*
   * Activities. cost in rupiah (0 = free); travel: needs a short trip (two angkot/bus legs)
   * slots: free time used; feature: required city feature; needs: online, book, hobby_*, friend, family
   * effects: daily mood changes (boredom, stress, happiness, social, loneliness, energy, confidence)
   * habit: how quickly repeating it in a week loses effect (0–1)
   */
  const A = (id, name, cat, o) => ({ id, name, cat, cost: 0, travel: false, slots: 1, feature: null, needs: [], outdoor: false, habit: 0.3, ...o });
  const ACTIVITIES = [
    A('relax', bi('Bersantai & tidur siang', 'Relax and nap at home'), 'free', { effects: { energy: 12, stress: -5, boredom: 2 }, habit: 0.1 }),
    A('walk_park', bi('Jalan santai di taman kota', 'A walk in the city park'), 'free', { feature: 'park', outdoor: true, effects: { boredom: -10, stress: -7, happiness: 4, energy: -3 } }),
    A('alun', bi('Duduk-duduk di alun-alun', 'Hang out at the town square'), 'free', { feature: 'alun', outdoor: true, travel: true, effects: { boredom: -9, stress: -5, happiness: 4, social: 3 } }),
    A('cfd', bi('Car Free Day (Minggu pagi)', 'Car Free Day (Sunday morning)'), 'free', { feature: 'cfd', outdoor: true, travel: true, sundayOnly: true, effects: { boredom: -14, stress: -8, happiness: 6, social: 5, energy: -4 } }),
    A('library', bi('Ke perpustakaan umum (pinjam buku)', 'Public library (borrow a book)'), 'free', { feature: 'library', travel: true, grantsBook: true, effects: { boredom: -8, stress: -4, happiness: 3 } }),
    A('read', bi('Membaca buku', 'Read a book'), 'free', { needs: ['book'], effects: { boredom: -9, stress: -6, happiness: 4 }, habit: 0.15 }),
    A('home_workout', bi('Olahraga di rumah', 'Work out at home'), 'free', { effects: { stress: -9, energy: -6, happiness: 3, confidence: 2 }, energyNext: 6, habit: 0.15 }),
    A('online_videos', bi('Nonton video gratis di internet', 'Watch free videos online'), 'free', { needs: ['online'], effects: { boredom: -8, stress: -3, happiness: 2 }, habit: 0.5 }),
    A('friends_free', bi('Ngobrol dengan teman (tanpa belanja)', 'Hang out with friends (no spending)'), 'free', { needs: ['friend'], travel: true, effects: { loneliness: -18, social: 14, boredom: -10, happiness: 6, stress: -5 } }),
    A('call_family', bi('Video call dengan keluarga', 'Video call with family'), 'free', { needs: ['online'], effects: { loneliness: -14, social: 8, happiness: 4, stress: -3 }, habit: 0.2 }),
    A('family_time', bi('Waktu bersama keluarga di rumah', 'Time with your family at home'), 'free', { needs: ['family'], effects: { loneliness: -12, social: 8, happiness: 6, stress: -4, boredom: -6 }, habit: 0.15 }),
    A('explore', bi('Jalan-jalan keliling kampung/kompleks', 'Explore the neighbourhood'), 'free', { outdoor: true, effects: { boredom: -7, stress: -3, happiness: 2, energy: -2 } }),
    A('window_shop', bi('Cuci mata di mal', 'Window-shopping at the mall'), 'free', { feature: 'mall', travel: true, effects: { boredom: -9, happiness: 3 }, temptation: 18 }),
    A('drawing', bi('Menggambar', 'Drawing'), 'free', { needs: ['hobby_drawing'], effects: { boredom: -10, stress: -7, happiness: 5, confidence: 2 }, habit: 0.15 }),
    A('plants', bi('Merawat tanaman', 'Tending plants'), 'free', { needs: ['hobby_plants'], effects: { stress: -6, boredom: -5, happiness: 3 }, habit: 0.1 }),
    A('free_event', bi('Acara gratis di kota (pameran/konser komunitas)', 'Free city event (exhibition/community gig)'), 'free', { travel: true, weekendOnly: true, chance: 0.5, effects: { boredom: -15, happiness: 7, social: 6, stress: -5 } }),
    A('warkop', bi('Nongkrong di warkop', 'Hang out at a coffee stall'), 'low', { cost: 15000, needs: ['friend'], effects: { loneliness: -12, social: 10, boredom: -9, happiness: 5 } }),
    A('street_food', bi('Jajan malam bareng teman', 'Street-food night with friends'), 'low', { cost: 35000, needs: ['friend'], travel: true, effects: { loneliness: -14, social: 12, boredom: -11, happiness: 7 } }),
    A('museum_cheap', bi('Museum (tiket murah)', 'Museum (cheap ticket)'), 'low', { cost: 15000, feature: 'museum', travel: true, effects: { boredom: -13, happiness: 5, stress: -4 } }),
    A('pool', bi('Berenang di kolam umum', 'Public swimming pool'), 'low', { cost: 25000, feature: 'pool', travel: true, effects: { stress: -10, energy: -6, happiness: 5, boredom: -9 }, energyNext: 5 }),
    A('badminton', bi('Main bulu tangkis (patungan lapangan)', 'Badminton (shared court fee)'), 'low', { cost: 20000, needs: ['friend'], travel: true, effects: { stress: -10, social: 8, loneliness: -8, energy: -8, happiness: 5 } }),
    A('beach', bi('Ke pantai', 'Go to the beach'), 'low', { cost: 20000, feature: 'beach', travel: true, slots: 2, outdoor: true, effects: { boredom: -20, stress: -12, happiness: 9, energy: -6 } }),
    A('cinema', bi('Nonton bioskop', 'Cinema'), 'paid', { cost: 50000, feature: 'cinema', travel: true, effects: { boredom: -16, happiness: 7, stress: -5 } }),
    A('cafe', bi('Sore di kafe bersama teman', 'Afternoon at a café with a friend'), 'paid', { cost: 65000, feature: 'cafe', needs: ['friend'], travel: true, effects: { loneliness: -14, social: 12, boredom: -12, happiness: 7 } }),
    A('restaurant', bi('Makan malam di restoran', 'Dinner at a restaurant'), 'paid', { cost: 120000, travel: true, effects: { happiness: 9, boredom: -12, social: 6, stress: -5 }, meal: true }),
    A('karaoke', bi('Karaoke (patungan room)', 'Karaoke (shared room)'), 'paid', { cost: 70000, feature: 'karaoke', needs: ['friend'], travel: true, effects: { boredom: -18, social: 14, happiness: 9, stress: -8 } }),
    A('amusement', bi('Taman hiburan', 'Amusement park'), 'paid', { cost: 300000, feature: 'amusement', travel: true, slots: 3, weekendOnly: true, effects: { boredom: -30, happiness: 14, stress: -10, energy: -12 } }),
    A('concert', bi('Konser musik', 'Music concert'), 'paid', { cost: 650000, feature: 'concert', travel: true, slots: 2, weekendOnly: true, chance: 0.3, effects: { boredom: -30, happiness: 16, social: 8, stress: -10, energy: -10 } }),
    A('massage', bi('Pijat refleksi', 'Reflexology massage'), 'paid', { cost: 90000, feature: 'mall', travel: true, effects: { stress: -16, energy: 6, happiness: 6 } }),
    A('hobby_class', bi('Kelas hobi (merangkai bunga, keramik)', 'Hobby class (flowers, ceramics)'), 'paid', { cost: 200000, feature: 'mall', travel: true, slots: 2, weekendOnly: true, effects: { boredom: -22, happiness: 10, confidence: 4, social: 5 } }),
  ];

  RLS.data.world = { PROVIDERS, UNVERIFIED, VERIFY_LABEL, FEATURES_BY_TIER, BEACH_CITIES, ACTIVITIES, activityById: Object.fromEntries(ACTIVITIES.map((a) => [a.id, a])), providerById: Object.fromEntries(PROVIDERS.concat([UNVERIFIED]).map((p) => [p.id, p])) };
  if (typeof module !== 'undefined' && module.exports) module.exports = RLS.data.world;
})(typeof globalThis !== 'undefined' ? globalThis : this);
