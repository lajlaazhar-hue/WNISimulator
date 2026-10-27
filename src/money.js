/*
 * money.js — integer money helpers.
 * All amounts in the game are stored as integer minor units.
 * IDR has an ISO 4217 exponent of 2 (sen), and some wage decrees carry sen
 * (e.g. UMP Banten Rp3.100.881,40), so 1 rupiah = 100 units.
 */
(function (root) {
  const RLS = (root.RLS = root.RLS || {});

  const CURRENCIES = {
    IDR: { code: 'IDR', symbol: 'Rp', exponent: 2, locale: 'id-ID', displayDecimals: 0 },
  };

  /** Convert a major-unit amount (e.g. 5247870 or 3100881.40) to integer minor units. */
  function toMinor(major, currency = 'IDR') {
    const exp = CURRENCIES[currency].exponent;
    // Round through a string to avoid binary float drift (3100881.40 * 100).
    const [whole, frac = ''] = String(major).split('.');
    const fracPadded = (frac + '0'.repeat(exp)).slice(0, exp);
    const sign = whole.trim().startsWith('-') ? -1 : 1;
    const absWhole = Math.abs(parseInt(whole, 10)) || 0;
    return sign * (absWhole * Math.pow(10, exp) + (parseInt(fracPadded || '0', 10) || 0));
  }

  /** Shorthand used by data files: rp(15000) → 1500000 minor units. */
  const rp = (major) => toMinor(major, 'IDR');

  /** Percentage in basis points applied with integer rounding (half up). */
  function applyBasisPoints(amountMinor, bp) {
    return Math.round((amountMinor * bp) / 10000);
  }

  /** Round minor units to a whole multiple (e.g. nearest Rp100 = 10000 minor). */
  function roundTo(amountMinor, stepMinor) {
    return Math.round(amountMinor / stepMinor) * stepMinor;
  }

  function format(amountMinor, opts = {}) {
    const currency = opts.currency || 'IDR';
    const c = CURRENCIES[currency];
    const exact = !!opts.exact;
    const neg = amountMinor < 0;
    const abs = Math.abs(amountMinor);
    const factor = Math.pow(10, c.exponent);
    const whole = Math.floor(abs / factor);
    const frac = abs % factor;
    let s = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    if (exact && frac) s += ',' + String(frac).padStart(c.exponent, '0');
    else if (!exact && frac >= factor / 2) {
      // round half up for display only
      s = (whole + 1).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }
    const sign = neg ? '−' : opts.plus ? '+' : '';
    return sign + c.symbol + s;
  }

  /** Compact display: Rp5,2 jt / Rp850 rb */
  function formatShort(amountMinor) {
    const v = Math.abs(amountMinor) / 100;
    const sign = amountMinor < 0 ? '−' : '';
    if (v >= 1e6) return sign + 'Rp' + (v / 1e6).toFixed(v >= 1e7 ? 1 : 2).replace('.', ',') + ' jt';
    if (v >= 1e3) return sign + 'Rp' + Math.round(v / 1e3) + ' rb';
    return sign + 'Rp' + Math.round(v);
  }

  RLS.money = { CURRENCIES, toMinor, rp, applyBasisPoints, roundTo, format, formatShort };
  if (typeof module !== 'undefined' && module.exports) module.exports = RLS.money;
})(typeof globalThis !== 'undefined' ? globalThis : this);
