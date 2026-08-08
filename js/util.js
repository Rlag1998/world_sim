// util.js — seeded RNG, math helpers, value noise, misc shared utilities.
// All sim randomness flows through one seeded RNG so a chronicle is reproducible from its seed.

class RNG {
  constructor(seed) { this.s = (seed >>> 0) || 1; }
  // mulberry32
  r() {
    let t = (this.s += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  ri(a, b) { return a + Math.floor(this.r() * (b - a + 1)); }   // int, inclusive
  rf(a, b) { return a + this.r() * (b - a); }
  chance(p) { return this.r() < p; }
  pick(arr) { return arr[Math.floor(this.r() * arr.length)]; }
  pickw(arr, wf) { // weighted pick; wf(item) -> weight
    let total = 0;
    for (const it of arr) total += Math.max(0, wf(it));
    if (total <= 0) return arr.length ? this.pick(arr) : null;
    let roll = this.r() * total;
    for (const it of arr) { roll -= Math.max(0, wf(it)); if (roll <= 0) return it; }
    return arr[arr.length - 1];
  }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.r() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  gauss(mean = 0, sd = 1) { // Box–Muller
    let u = 0, v = 0;
    while (u === 0) u = this.r();
    while (v === 0) v = this.r();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
}

// 2D value noise with octaves, for terrain generation.
function makeNoise(rng, octaves = 4) {
  const perm = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  rng.shuffle(base);
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255];
  const hash = (x, y) => perm[(perm[x & 255] + y) & 255] / 255;
  const smooth = (t) => t * t * (3 - 2 * t);
  function layer(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    const u = smooth(xf), v = smooth(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  return function noise(x, y, scale = 0.1) {
    let amp = 1, freq = scale, sum = 0, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * layer(x * freq, y * freq);
      norm += amp;
      amp *= 0.5; freq *= 2.1;
    }
    return sum / norm;
  };
}

let _uid = 1;
const U = {
  clamp: (v, a, b) => v < a ? a : v > b ? b : v,
  lerp: (a, b, t) => a + (b - a) * t,
  dist: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
  mdist: (x1, y1, x2, y2) => Math.abs(x2 - x1) + Math.abs(y2 - y1),
  key: (x, y) => y * 4096 + x,
  uid: () => _uid++,
  setUidFloor: (n) => { _uid = Math.max(_uid, n); },
  cap: (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s,
  // "Ada, Bo and Cy"
  listJoin(names) {
    if (!names.length) return '';
    if (names.length === 1) return names[0];
    return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
  },
  ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  },
  plural: (n, word, pl) => n === 1 ? word : (pl || word + 's'),
  sgn: (v) => v > 0 ? '+' + v : '' + v,
  // Deterministic tiny hash for pair-compatibility etc.
  hash2(a, b) {
    let h = (a * 2654435761 ^ b * 40503) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    return (h % 1000) / 1000;
  },
};

Object.assign(globalThis, { RNG, makeNoise, U });
