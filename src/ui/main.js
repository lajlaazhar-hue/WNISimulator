/*
 * ui/main.js — starts the interface once the page is ready.
 */
(function (root) {
  const RLS = root.RLS;
  const U = RLS.U;
  RLS.ui = { boot: U.boot, _ui: U.ui, get game() { return U.G; } };
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', U.boot); else U.boot();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
