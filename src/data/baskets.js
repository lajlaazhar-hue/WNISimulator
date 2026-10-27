/*
 * baskets.js — suggested grocery baskets, for one adult.
 * Never forced: DailyMart loads one into the cart and every line can be changed.
 * `period` says how long the basket is meant to last. Weekly baskets keep
 * fresh food from spoiling; the monthly staples basket holds dry goods and
 * household supplies. Comparison mode uses weekly × 4,3 + staples.
 */
(function (root) {
  const RLS = (root.RLS = root.RLS || {});
  RLS.data = RLS.data || {};
  const { bi } = RLS.i18n;
  RLS.data.baskets = {
    week_lean: {
      label: bi('Seminggu hemat', 'Lean week'), period: 'week',
      lines: [['eggs_10', 2], ['tempe', 2], ['tahu', 1], ['kangkung', 2], ['bayam', 2], ['timun', 1], ['pepaya', 1], ['noodle_5pack', 1]],
    },
    week_everyday: {
      label: bi('Seminggu biasa', 'Everyday week'), period: 'week',
      lines: [['eggs_10', 1], ['chicken_1kg', 1], ['tempe', 2], ['tahu', 1], ['mackerel', 1], ['kangkung', 2], ['carrot', 1], ['tomato', 1], ['kol', 1], ['banana', 1]],
    },
    month_staples: {
      label: bi('Kebutuhan pokok sebulan', 'Monthly staples'), period: 'month',
      lines: [['rice_medium_5', 2], ['oil_bulk', 1], ['salt', 1], ['bawang', 1], ['kecap', 1], ['galon_refill', 4], ['lpg_3', 2],
        ['soap_bar3', 1], ['shampoo_sachet', 3], ['toothpaste_s', 1], ['detergent_s', 3], ['dish_refill', 1], ['trash_bags', 1]],
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = RLS.data.baskets;
})(typeof globalThis !== 'undefined' ? globalThis : this);
