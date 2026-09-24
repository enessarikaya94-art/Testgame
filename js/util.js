// Hilfsfunktionen

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Zufallsgenerator, dessen Zustand im Spielstand gespeichert wird
export class RNG {
  constructor(seed) { this.state = seed >>> 0; }
  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  weighted(items, weightFn) {
    let total = 0;
    const ws = items.map((it) => { const w = Math.max(0, weightFn(it)); total += w; return w; });
    if (total <= 0) return null;
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
    return items[items.length - 1];
  }
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const round1 = (v) => Math.round(v * 10) / 10;
const PK = new Map();
export function pairKey(a, b) {
  let m = PK.get(a);
  if (!m) { m = new Map(); PK.set(a, m); }
  let k = m.get(b);
  if (k === undefined) { k = a < b ? `${a}|${b}` : `${b}|${a}`; m.set(b, k); }
  return k;
}

export function fmt(n) {
  if (Math.abs(n) >= 10000) return Math.round(n / 1000) + 'k';
  if (Math.abs(n) >= 10) return String(Math.round(n));
  return String(Math.round(n * 10) / 10);
}

export function signed(n, digits = 0) {
  const v = digits ? n.toFixed(digits) : String(Math.round(n));
  return (n >= 0 ? '+' : '') + v;
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
