// Erzeugt aus den Geodaten ein Raster: Wasser, Provinzen, Ödland, Nachbarschaften, Grenzlinien.

import { WORLD_W, WORLD_H, project, WATER, ISLANDS, WASTELANDS, SEA_LINKS } from '../data/geo.js';
import { PROVINCES } from '../data/provinces.js';
import { mulberry32 } from '../util.js';
import { REGION_IDS } from '../data/regions.js';

export const CELL = 2;

function makeNoise(seed) {
  const rnd = mulberry32(seed);
  const SIZE = 256;
  const perm = new Uint8Array(SIZE * 2);
  const vals = new Float32Array(SIZE);
  for (let i = 0; i < SIZE; i++) { perm[i] = i; vals[i] = rnd() * 2 - 1; }
  for (let i = SIZE - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < SIZE; i++) perm[i + SIZE] = perm[i];
  const h = (x, y) => vals[perm[(perm[x & 255] + y) & 511] & 255];
  const smooth = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = smooth(x - xi), yf = smooth(y - yi);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}

function rasterizeWater(gw, gh) {
  const cv = document.createElement('canvas');
  cv.width = gw; cv.height = gh;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, gw, gh);
  const poly = (pts) => {
    ctx.beginPath();
    pts.forEach(([lon, lat], i) => {
      const [x, y] = project(lon, lat);
      if (i === 0) ctx.moveTo(x / CELL, y / CELL); else ctx.lineTo(x / CELL, y / CELL);
    });
    ctx.closePath();
    ctx.fill();
  };
  ctx.fillStyle = '#fff';
  WATER.forEach((w) => poly(w.pts));
  ctx.fillStyle = '#000';
  ISLANDS.forEach((w) => poly(w.pts));
  const data = ctx.getImageData(0, 0, gw, gh).data;
  const water = new Uint8Array(gw * gh);
  for (let i = 0; i < gw * gh; i++) water[i] = data[i * 4] > 127 ? 1 : 0;
  return water;
}

export function generateMap() {
  const gw = Math.ceil(WORLD_W / CELL), gh = Math.ceil(WORLD_H / CELL);
  const water = rasterizeWater(gw, gh);
  const nP = PROVINCES.length;
  const seeds = [];
  PROVINCES.forEach((p) => { const [x, y] = project(p.lon, p.lat); seeds.push({ x: x / CELL, y: y / CELL, prov: true }); });
  WASTELANDS.forEach((w) => { const [x, y] = project(w.lon, w.lat); seeds.push({ x: x / CELL, y: y / CELL, prov: false }); });
  const nS = seeds.length;
  const sx = new Float32Array(nS), sy = new Float32Array(nS);
  seeds.forEach((s, i) => { sx[i] = s.x; sy[i] = s.y; });

  const noiseA = makeNoise(1071), noiseB = makeNoise(1040);
  const WARP1 = 9, WARP2 = 3; // in Zellen
  const MAXD = 110; // Zellen; weiter entfernt = namenloses Ödland
  const ids = new Int16Array(gw * gh);
  const B = 16;
  const margin = (WARP1 + WARP2) * 1.5 + B * 1.5;
  const cand = new Int16Array(nS);
  for (let by = 0; by < gh; by += B) {
    for (let bx = 0; bx < gw; bx += B) {
      const cx = bx + B / 2, cy = by + B / 2;
      let dmin = Infinity;
      const dist = new Float32Array(nS);
      for (let s = 0; s < nS; s++) {
        const d = Math.hypot(sx[s] - cx, sy[s] - cy);
        dist[s] = d;
        if (d < dmin) dmin = d;
      }
      let nc = 0;
      for (let s = 0; s < nS; s++) if (dist[s] <= dmin + margin * 2) cand[nc++] = s;
      for (let y = by; y < Math.min(gh, by + B); y++) {
        for (let x = bx; x < Math.min(gw, bx + B); x++) {
          const i = y * gw + x;
          if (water[i]) { ids[i] = -1; continue; }
          const wx = x + noiseA(x / 38, y / 38) * WARP1 + noiseB(x / 9, y / 9) * WARP2;
          const wy = y + noiseA(x / 38 + 71.3, y / 38 + 19.7) * WARP1 + noiseB(x / 9 + 33.1, y / 9 + 5.3) * WARP2;
          let best = -2, bd = Infinity;
          for (let k = 0; k < nc; k++) {
            const s = cand[k];
            const dx = sx[s] - wx, dy = sy[s] - wy;
            const d = dx * dx + dy * dy;
            if (d < bd) { bd = d; best = s; }
          }
          if (bd > MAXD * MAXD) best = -2;
          ids[i] = best;
        }
      }
    }
  }

  // Städte liegen immer in ihrer eigenen Provinz
  for (let s = 0; s < nP; s++) {
    const r = 4;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const x = Math.round(sx[s]) + dx, y = Math.round(sy[s]) + dy;
      if (x < 0 || y < 0 || x >= gw || y >= gh) continue;
      const i = y * gw + x;
      if (!water[i]) ids[i] = s;
    }
  }

  // Nur zusammenhängende Gebiete gehören zur Provinz (Inseln ohne Provinz werden Ödland)
  const seen = new Uint8Array(gw * gh);
  const stack = new Int32Array(gw * gh);
  for (let s = 0; s < nP; s++) {
    const start = Math.round(sy[s]) * gw + Math.round(sx[s]);
    if (ids[start] !== s) continue;
    let sp = 0; stack[sp++] = start; seen[start] = 1;
    while (sp > 0) {
      const i = stack[--sp];
      const x = i % gw, y = (i / gw) | 0;
      if (x > 0 && !seen[i - 1] && ids[i - 1] === s) { seen[i - 1] = 1; stack[sp++] = i - 1; }
      if (x < gw - 1 && !seen[i + 1] && ids[i + 1] === s) { seen[i + 1] = 1; stack[sp++] = i + 1; }
      if (y > 0 && !seen[i - gw] && ids[i - gw] === s) { seen[i - gw] = 1; stack[sp++] = i - gw; }
      if (y < gh - 1 && !seen[i + gw] && ids[i + gw] === s) { seen[i + gw] = 1; stack[sp++] = i + gw; }
    }
  }
  for (let i = 0; i < gw * gh; i++) if (ids[i] >= 0 && ids[i] < nP && !seen[i]) ids[i] = -2;

  // Statistik je Provinz
  const cnt = new Float64Array(nP), mx = new Float64Array(nP), my = new Float64Array(nP);
  const bbox = Array.from({ length: nP }, () => [Infinity, Infinity, -Infinity, -Infinity]);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const id = ids[y * gw + x];
    if (id < 0 || id >= nP) continue;
    cnt[id]++; mx[id] += x; my[id] += y;
    const b = bbox[id];
    if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y;
  }

  // Nachbarschaften
  const adjCount = new Map();
  const addAdj = (a, b) => {
    if (a === b || a < 0 || b < 0 || a >= nP || b >= nP) return;
    const k = a < b ? a * 1000 + b : b * 1000 + a;
    adjCount.set(k, (adjCount.get(k) || 0) + 1);
  };
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const i = y * gw + x, a = ids[i];
    if (x < gw - 1) addAdj(a, ids[i + 1]);
    if (y < gh - 1) addAdj(a, ids[i + gw]);
  }
  const neighbors = Array.from({ length: nP }, () => new Set());
  for (const [k, c] of adjCount) {
    if (c < 3) continue;
    const a = Math.floor(k / 1000), b = k % 1000;
    neighbors[a].add(b); neighbors[b].add(a);
  }
  const idx = Object.fromEntries(PROVINCES.map((p, i) => [p.id, i]));
  const seaLinks = [];
  SEA_LINKS.forEach(([a, b]) => {
    const ia = idx[a], ib = idx[b];
    if (ia === undefined || ib === undefined) return;
    if (!neighbors[ia].has(ib)) seaLinks.push([ia, ib]);
    neighbors[ia].add(ib); neighbors[ib].add(ia);
  });

  // Grenzlinien: Kanten zwischen Zellen verschiedener Gebiete, zu Linienzügen verkettet und geglättet
  const borders = buildBorders(ids, gw, gh, nP);

  const provinces = PROVINCES.map((p, i) => {
    const [px, py] = project(p.lon, p.lat);
    let lx = cnt[i] ? (mx[i] / cnt[i]) * CELL + CELL / 2 : px;
    let ly = cnt[i] ? (my[i] / cnt[i]) * CELL + CELL / 2 : py;
    const ci = Math.floor(ly / CELL) * gw + Math.floor(lx / CELL);
    if (ids[ci] !== i) { lx = px; ly = py - 14; }
    return {
      id: p.id, index: i, x: px, y: py, lx, ly, area: cnt[i],
      bbox: bbox[i].map((v) => v * CELL),
      neighbors: [...neighbors[i]].map((j) => PROVINCES[j].id),
    };
  });

  const provIndex = Object.fromEntries(provinces.map((p) => [p.id, p]));
  const regions = buildRegionGrid(ids, gw, gh, nP);
  return { gw, gh, ids, water, nP, provinces, provIndex, borders, seaLinks, wastelandOffset: nP, regions, regionIds: REGION_IDS };
}

// Weltgegend je Zelle: Land nach seinem Kern, Wasser und namenloses Land nach der nächsten Landzelle
function buildRegionGrid(ids, gw, gh, nP) {
  const ri = Object.fromEntries(REGION_IDS.map((r, i) => [r, i]));
  const seedReg = [...PROVINCES.map((p) => ri[p.region || 'orient']), ...WASTELANDS.map((w) => ri[w.r || 'orient'])];
  const reg = new Uint8Array(gw * gh).fill(255);
  const q = new Int32Array(gw * gh);
  let qh = 0, qt = 0;
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (id >= 0) { reg[i] = seedReg[id] ?? 0; q[qt++] = i; }
  }
  while (qh < qt) {
    const i = q[qh++];
    const x = i % gw, r = reg[i];
    if (x > 0 && reg[i - 1] === 255) { reg[i - 1] = r; q[qt++] = i - 1; }
    if (x < gw - 1 && reg[i + 1] === 255) { reg[i + 1] = r; q[qt++] = i + 1; }
    if (i >= gw && reg[i - gw] === 255) { reg[i - gw] = r; q[qt++] = i - gw; }
    if (i + gw < ids.length && reg[i + gw] === 255) { reg[i + gw] = r; q[qt++] = i + gw; }
  }
  return reg;
}

function buildBorders(ids, gw, gh, nP) {
  // Schlüssel: "a|b" (Provinzen) oder "a|w" (Provinz/Ödland) oder "w" (Ödland/Ödland nicht gezeichnet)
  const edgesByKey = new Map();
  const W1 = gw + 1;
  const push = (a, b, v1, v2) => {
    if (a === b) return;
    if (a === -1 || b === -1) return; // Küste wird aus Polygonen gezeichnet
    const pa = a >= 0 && a < nP, pb = b >= 0 && b < nP;
    if (!pa && !pb) return;
    let key;
    if (pa && pb) key = a < b ? `${a}|${b}` : `${b}|${a}`;
    else key = `${pa ? a : b}|w`;
    let arr = edgesByKey.get(key);
    if (!arr) { arr = []; edgesByKey.set(key, arr); }
    arr.push(v1, v2);
  };
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const i = y * gw + x, a = ids[i];
    if (x < gw - 1) { const b = ids[i + 1]; if (a !== b) push(a, b, y * W1 + x + 1, (y + 1) * W1 + x + 1); }
    if (y < gh - 1) { const b = ids[i + gw]; if (a !== b) push(a, b, (y + 1) * W1 + x, (y + 1) * W1 + x + 1); }
  }
  const result = [];
  for (const [key, arr] of edgesByKey) {
    const adj = new Map();
    const ne = arr.length / 2;
    for (let e = 0; e < ne; e++) {
      for (const v of [arr[e * 2], arr[e * 2 + 1]]) {
        let l = adj.get(v); if (!l) { l = []; adj.set(v, l); } l.push(e);
      }
    }
    const used = new Uint8Array(ne);
    const other = (e, v) => (arr[e * 2] === v ? arr[e * 2 + 1] : arr[e * 2]);
    const lines = [];
    for (let e0 = 0; e0 < ne; e0++) {
      if (used[e0]) continue;
      used[e0] = 1;
      const chain = [arr[e0 * 2], arr[e0 * 2 + 1]];
      // vorwärts
      for (let dir = 0; dir < 2; dir++) {
        while (true) {
          const v = dir === 0 ? chain[chain.length - 1] : chain[0];
          const l = adj.get(v);
          if (!l || l.length !== 2) break;
          const next = l.find((e) => !used[e]);
          if (next === undefined) break;
          used[next] = 1;
          const nv = other(next, v);
          if (dir === 0) chain.push(nv); else chain.unshift(nv);
        }
      }
      let pts = chain.map((v) => [(v % W1) * CELL, Math.floor(v / W1) * CELL]);
      pts = simplifyStraight(pts);
      pts = chaikin(chaikin(pts));
      lines.push(pts);
    }
    const [a, b] = key.split('|');
    result.push({ a: +a, b: b === 'w' ? -2 : +b, lines });
  }
  return result;
}

function simplifyStraight(pts) {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [ax, ay] = out[out.length - 1], [bx, by] = pts[i], [cx, cy] = pts[i + 1];
    if ((bx - ax) * (cy - by) - (by - ay) * (cx - bx) !== 0) out.push(pts[i]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function chaikin(pts) {
  if (pts.length < 3) return pts;
  const closed = pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1];
  const out = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    out.push([x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25]);
    out.push([x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75]);
  }
  out.push(pts[pts.length - 1]);
  if (closed) out[out.length - 1] = out[0];
  return out;
}
