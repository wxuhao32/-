/**
 * localStorage small helper (safe read/write)
 */
const KEY_PREFIX = "msw_ret";

export function save(key, value) {
  try {
    localStorage.setItem(`${KEY_PREFIX}:${key}`, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(`${KEY_PREFIX}:${key}`);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
