/**
 * Deterministic RNG — FNV-1a 32-bit hash + Mulberry32 PRNG.
 *
 * Il buddy non e' casuale: e' *deterministico*. Lo stesso userId produce
 * sempre la stessa creatura, perche' l'hash del suo id semina il PRNG e la
 * sequenza di estrazioni e' fissa (vedi DRAW ORDER in bones.mjs).
 */

/** Salt dell'edizione 2026 — omaggio al primo aprile. */
export const SALT = 'friend-2026-401';

/** FNV-1a a 32 bit. Math.imul evita la perdita di precisione dei float. */
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Mulberry32: PRNG a stato singolo, veloce e riproducibile. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Il generatore canonico di un utente: hash(userId + SALT) -> Mulberry32. */
export function seededRandom(userId, namespace = '') {
  return mulberry32(fnv1a(String(userId) + SALT + namespace));
}

/** Intero in [min, max] inclusi. */
export function randInt(rand, min, max) {
  return min + Math.floor(rand() * (max - min + 1));
}

/** Elemento da un array. */
export function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length)];
}

/** Fisher-Yates deterministico: non muta l'input. */
export function shuffle(rand, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Estrazione pesata su una tabella [{ weight }].
 * I pesi sono probabilita' in centesimi (60 = 60%).
 */
export function weighted(rand, table) {
  const total = table.reduce((s, e) => s + e.weight, 0);
  let roll = rand() * total;
  for (const entry of table) {
    roll -= entry.weight;
    if (roll < 0) return entry;
  }
  return table[table.length - 1];
}
