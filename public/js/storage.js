/**
 * localStorage small helper (safe read/write)
 * Global namespace: window.MSStorage
 */
(function () {
  "use strict";
  const KEY_PREFIX = "msw_ret";

  function save(key, value) {
    try {
      localStorage.setItem(`${KEY_PREFIX}:${key}`, JSON.stringify(value));
    } catch {
      // ignore
    }
  }

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(`${KEY_PREFIX}:${key}`);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  window.MSStorage = { save, load };
})();
