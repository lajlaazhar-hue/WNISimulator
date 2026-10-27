/*
 * i18n.js — two-language text model.
 *
 * Default language is Bahasa Indonesia. Text that the engine stores in the
 * game state (notifications, bill labels, transaction merchants, event text)
 * is stored as a bilingual object { id, en }, so switching language
 * re-renders everything without touching the save.
 *
 *   bi('Saldo', 'Balance')  → { id: 'Saldo', en: 'Balance' }
 *   L(x)                    → picks the current language; accepts strings too
 *   t('Saldo', 'Balance')   → inline UI text in the current language
 *
 * A missing English string falls back to the Indonesian one (and vice versa),
 * so a key is never shown raw.
 */
(function (root) {
  const RLS = (root.RLS = root.RLS || {});
  let lang = 'id';

  const bi = (id, en) => ({ id, en: en == null ? id : en });
  function L(x) {
    if (x == null) return '';
    if (typeof x === 'string' || typeof x === 'number') return String(x);
    if (Array.isArray(x)) return x.map(L).filter(Boolean).join(' · ');
    if (typeof x === 'object') return x[lang] != null ? x[lang] : x.id != null ? x.id : x.en != null ? x.en : '';
    return String(x);
  }
  const t = (id, en) => (lang === 'en' ? (en == null ? id : en) : id);

  const MONTHS = {
    id: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  };
  const WEEKDAYS = {
    id: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'],
    en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  };
  const WEEKDAYS_LONG = {
    id: ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
    en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  };

  RLS.i18n = {
    bi, L, t, MONTHS, WEEKDAYS, WEEKDAYS_LONG,
    get lang() { return lang; },
    setLang(l) { lang = l === 'en' ? 'en' : 'id'; return lang; },
    month: (m) => MONTHS[lang][m],
    weekday: (d) => WEEKDAYS[lang][d],
    weekdayLong: (d) => WEEKDAYS_LONG[lang][d],
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = RLS.i18n;
})(typeof globalThis !== 'undefined' ? globalThis : this);
