// Seefahrt: Flotten werden in Häfen gebaut, nehmen Heere an Bord, segeln über zusammenhängende Meere
// (Mittelmeer–Schwarzes Meer–Atlantik–Ostsee, Kaspisches Meer, Indischer Ozean mit Rotem Meer und Golf,
// Chinesisches Meer) und liefern sich Seeschlachten. Feindliche Flotten in einem Hafen blockieren den Seehandel.

import { G, fac, prov, pdef, atWar, log, provName, facName, rng, newId, factionProvinces } from './state.js';
import { UNITS } from '../data/units.js';
import { PROVINCES } from '../data/provinces.js';
import { discover, regionOf, knows } from './discovery.js';

export const SHIPS = {
  cog: {
    icon: '⛵', n: { de: 'Transportschiff', tr: 'Nakliye gemisi' },
    desc: { de: 'Dhau, Kogge oder Tarida: trägt 4 Einheiten über das Meer, wehrt sich aber kaum.', tr: 'Dav, kog ya da tarida: 4 birliği denizden taşır ama zayıf savaşır.' },
    cost: 60, upkeep: 1, cap: 4, att: 1, def: 2, port: 1,
  },
  galley: {
    icon: '🛶', n: { de: 'Kriegsgaleere', tr: 'Savaş kadırgası' },
    desc: { de: 'Gerudert und mit Rammsporn, Bogenschützen und griechischem Feuer: gewinnt Seeschlachten, trägt 1 Einheit.', tr: 'Kürekli, mahmuzlu, okçulu ve Rum ateşli: deniz savaşlarını kazanır, 1 birlik taşır.' },
    cost: 110, upkeep: 2, cap: 1, att: 6, def: 4, port: 2,
  },
};
export const FLEET_MAX = 20;
const SPEED = 300; // Weltpixel je Runde
const F = 2; // Vergröberung des Wasserrasters

// ---------- Meeresnetz ----------
let sea = null;
function seaNet() {
  const m = G.map;
  if (sea && sea.map === m) return sea;
  const gw = Math.ceil(m.gw / F), gh = Math.ceil(m.gh / F);
  const w = new Uint8Array(gw * gh);
  for (let y = 0; y < m.gh; y++) for (let x = 0; x < m.gw; x++) if (m.water[y * m.gw + x]) w[((y / F) | 0) * gw + ((x / F) | 0)] = 1;
  // Zusammenhängende Meere
  const comp = new Int32Array(gw * gh).fill(-1);
  let nc = 0;
  for (let i = 0; i < gw * gh; i++) {
    if (!w[i] || comp[i] >= 0) continue;
    const st = [i]; comp[i] = nc;
    while (st.length) {
      const j = st.pop(), x = j % gw, y = (j / gw) | 0;
      for (const k of [x > 0 ? j - 1 : -1, x < gw - 1 ? j + 1 : -1, y > 0 ? j - gw : -1, y < gh - 1 ? j + gw : -1]) if (k >= 0 && w[k] && comp[k] < 0) { comp[k] = nc; st.push(k); }
    }
    nc++;
  }
  const size = new Array(nc).fill(0);
  for (let i = 0; i < gw * gh; i++) if (comp[i] >= 0) size[comp[i]]++;
  // Anlegestelle jedes Hafens: nächstgelegene Wasserzelle eines größeren Meeres
  const cell = F * 2; // CELL = 2 Weltpixel
  const entry = {};
  for (const p of PROVINCES) {
    if (!p.port) continue;
    const mp = m.provIndex[p.id];
    const cx = Math.floor(mp.x / cell), cy = Math.floor(mp.y / cell);
    let best = null;
    for (let r = 0; r <= 30 && !best; r++) {
      for (let dy = -r; dy <= r && !best; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= gw || y >= gh) continue;
        const c = comp[y * gw + x];
        if (c >= 0 && size[c] > 150) { best = y * gw + x; break; }
      }
    }
    if (best !== null) entry[p.id] = best;
  }
  // Seewege zwischen Meeren, die das Raster trennt (Straße von Malakka)
  const joins = [['chola', 'champa']];
  sea = { map: m, gw, gh, w, comp, entry, cell, joins, cache: new Map() };
  return sea;
}

function bfs(src) {
  const n = seaNet();
  if (n.cache.has(src)) return n.cache.get(src);
  const { gw, gh, w } = n;
  const start = n.entry[src];
  const dist = new Int32Array(gw * gh).fill(-1);
  const par = new Int32Array(gw * gh).fill(-1);
  if (start === undefined) return null;
  const q = new Int32Array(gw * gh);
  let h = 0, t = 0;
  q[t++] = start; dist[start] = 0;
  while (h < t) {
    const j = q[h++], x = j % gw, y = (j / gw) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= gw || yy >= gh) continue;
      const k = yy * gw + xx;
      if (!w[k] || dist[k] >= 0) continue;
      dist[k] = dist[j] + 1; par[k] = j; q[t++] = k;
    }
  }
  const res = { dist, par };
  if (n.cache.size > 12) n.cache.delete(n.cache.keys().next().value);
  n.cache.set(src, res);
  return res;
}

// Seeweg zwischen zwei Häfen: Länge in Weltpixeln und Linienzug
export function seaRoute(from, to) {
  if (from === to) return null;
  const n = seaNet();
  if (n.entry[from] === undefined || n.entry[to] === undefined) return null;
  const direct = (a, b) => {
    const r = bfs(a);
    if (!r) return null;
    const e = n.entry[b];
    if (r.dist[e] < 0) return null;
    const pts = [];
    for (let j = e; j >= 0; j = r.par[j]) pts.push([(j % n.gw + 0.5) * n.cell, (((j / n.gw) | 0) + 0.5) * n.cell]);
    pts.reverse();
    return { len: r.dist[e] * n.cell * 1.08, pts };
  };
  let route = direct(from, to);
  if (!route) {
    // Über eine Meerenge, die das Raster nicht kennt
    for (const [a, b] of n.joins) {
      for (const [x, y] of [[a, b], [b, a]]) {
        const r1 = from === x ? { len: 0, pts: [] } : direct(from, x);
        const r2 = to === y ? { len: 0, pts: [] } : direct(y, to);
        if (!r1 || !r2) continue;
        const px = G.map.provIndex[x], py = G.map.provIndex[y];
        const gap = Math.hypot(px.x - py.x, px.y - py.y);
        const cand = { len: r1.len + gap + r2.len, pts: [...r1.pts, [px.x, px.y], [py.x, py.y], ...r2.pts] };
        if (!route || cand.len < route.len) route = cand;
      }
    }
  }
  if (!route) return null;
  // Linienzug ausdünnen
  const p0 = G.map.provIndex[from], p1 = G.map.provIndex[to];
  const thin = [[p0.x, p0.y]];
  const step = Math.max(1, Math.floor(route.pts.length / 60));
  for (let i = 0; i < route.pts.length; i += step) thin.push(route.pts[i]);
  thin.push([p1.x, p1.y]);
  return { len: route.len, pts: thin };
}

export function isPort(pid) { return !!pdef(pid)?.port; }
export function speedOf(fl) { return SPEED * (fac(fl.fac)?.techs.includes('compass') ? 1.3 : 1); }
export function sailTurns(fl, to) {
  const r = seaRoute(fl.prov, to);
  return r ? Math.max(1, Math.ceil(r.len / speedOf(fl))) : null;
}

// ---------- Flotten ----------
export function fleets() { return Object.values(G.s.fleets || {}); }
export function fleetsIn(pid) { return fleets().filter((f) => f.prov === pid && !f.route); }
export function fleetsOf(fid) { return fleets().filter((f) => f.fac === fid); }
export function fleet(id) { return G.s.fleets?.[id] || null; }
export function capacity(fl) { return fl.ships.reduce((n, s) => n + SHIPS[s.t].cap * (s.hp > 0.35 ? 1 : 0.5), 0); }
export function cargoUnits(fl) { return fl.cargo.reduce((n, a) => n + a.units.length, 0); }
export function fleetPower(fl) { return fl.ships.reduce((n, s) => n + (SHIPS[s.t].att + SHIPS[s.t].def * 0.5) * s.hp, 0) * (1 + (fl.xp || 0) * 0.05); }

function createFleet(fid, pid) {
  if (!G.s.fleets) G.s.fleets = {};
  const id = newId('f');
  const fl = { id, fac: fid, prov: pid, ships: [], cargo: [], route: null };
  G.s.fleets[id] = fl;
  return fl;
}

export function shipyardLimit(pid) { return prov(pid).buildings.port || 0; }

export function shipOptions(fid, pid) {
  const p = prov(pid), f = fac(fid);
  if (!isPort(pid) || p.owner !== fid) return [];
  const lvl = p.buildings.port || 0;
  return Object.entries(SHIPS).map(([id, sd]) => {
    const o = { id, cost: sd.cost, ok: true, reason: null };
    if (lvl < sd.port) { o.ok = false; o.reason = 'sh.needPort'; o.lvl = sd.port; }
    else if ((p.shipsBuilt || 0) >= shipyardLimit(pid)) { o.ok = false; o.reason = 'sh.limit'; }
    else if (f.gold < sd.cost) { o.ok = false; o.reason = 'r.gold'; }
    else if (p.siege) { o.ok = false; o.reason = 'r.siege'; }
    return o;
  });
}

export function buildShip(fid, pid, type) {
  const o = shipOptions(fid, pid).find((x) => x.id === type);
  if (!o || !o.ok) return null;
  const p = prov(pid);
  fac(fid).gold -= o.cost;
  p.shipsBuilt = (p.shipsBuilt || 0) + 1;
  let fl = fleetsIn(pid).find((x) => x.fac === fid && x.ships.length < FLEET_MAX);
  if (!fl) fl = createFleet(fid, pid);
  fl.ships.push({ t: type, hp: 0.7 });
  return fl;
}

// Heer an Bord nehmen
export function canEmbark(fl, a) {
  if (!fl || !a || fl.route || a.fac !== fl.fac || a.prov !== fl.prov) return false;
  return cargoUnits(fl) + a.units.length <= capacity(fl);
}
export function embark(fl, a) {
  if (!canEmbark(fl, a)) return false;
  delete G.s.armies[a.id];
  a.path = []; a.raid = false; a.siegeOf = null; a.mp = 0;
  fl.cargo.push(a);
  return true;
}
// An Land gehen (nur im Hafen)
export function disembark(fl, idx = null) {
  if (!fl || fl.route) return [];
  const out = idx === null ? fl.cargo.splice(0) : fl.cargo.splice(idx, 1);
  for (const a of out) {
    a.prov = fl.prov; a.mp = 0; a.path = [];
    G.s.armies[a.id] = a;
    if (a.gen && G.s.chars[a.gen]) G.s.chars[a.gen].army = a.id;
  }
  if (out.length && fl.fac === G.s.player && prov(fl.prov).owner !== fl.fac && atWar(fl.fac, prov(fl.prov).owner)) {
    log('log.landing', { prov: provName(fl.prov), fac: facName(fl.fac) }, { f: fl.fac, imp: true });
  }
  return out;
}

export function setSail(fl, to) {
  if (!fl || !isPort(to) || to === fl.prov) return false;
  const r = seaRoute(fl.prov, to);
  if (!r) return false;
  fl.route = { from: fl.prov, to, len: r.len, pts: r.pts, done: 0 };
  return true;
}
export function cancelSail(fl) { if (fl?.route && fl.route.done === 0) fl.route = null; }

// Position einer Flotte auf dem Seeweg
export function fleetPos(fl) {
  if (!fl.route) { const p = G.map.provIndex[fl.prov]; return [p.x, p.y]; }
  const { pts, len, done } = fl.route;
  let want = Math.min(1, done / len);
  let total = 0;
  const segs = [];
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(d); total += d; }
  let target = want * total;
  for (let i = 1; i < pts.length; i++) {
    if (target <= segs[i - 1]) { const k = segs[i - 1] ? target / segs[i - 1] : 0; return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k]; }
    target -= segs[i - 1];
  }
  return pts[pts.length - 1];
}

// Unterhalt der Flotte und der Heere an Bord
export function fleetUpkeep(fid) {
  let up = 0, units = 0;
  for (const fl of fleetsOf(fid)) {
    for (const s of fl.ships) up += SHIPS[s.t].upkeep;
    for (const a of fl.cargo) for (const u of a.units) units += UNITS[u.t].upkeep;
  }
  return { ships: up, units };
}

// ---------- Seeschlacht ----------
function sinkShips(fl, frac) {
  // Jedes Schiff sinkt mit einer gewissen Wahrscheinlichkeit oder wird beschädigt
  for (const s of fl.ships) {
    if (rng().chance(frac * (0.6 + (1 - s.hp) * 0.6))) s.hp = 0;
    else s.hp -= frac * 0.5;
  }
  fl.ships = fl.ships.filter((s) => s.hp > 0.12);
  // Wer keinen Platz mehr hat, ertrinkt
  let over = cargoUnits(fl) - capacity(fl);
  for (const a of fl.cargo) {
    while (over > 0 && a.units.length) { a.units.pop(); over--; }
  }
  fl.cargo = fl.cargo.filter((a) => a.units.length);
}

export function navalBattle(att, def) {
  const pa = fleetPower(att), pd = fleetPower(def) * 1.1;
  const ratio = pa / (pa + pd + 0.01);
  const pWin = Math.pow(ratio, 2) / (Math.pow(ratio, 2) + Math.pow(1 - ratio, 2));
  const attWins = rng().chance(pWin);
  const [win, lose] = attWins ? [att, def] : [def, att];
  const margin = Math.abs(ratio - 0.5) * 2;
  const shipsBefore = [att.ships.length, def.ships.length];
  sinkShips(lose, 0.45 + margin * 0.3);
  sinkShips(win, 0.12 + (1 - margin) * 0.12);
  win.xp = Math.min(5, (win.xp || 0) + 1);
  const report = { prov: att.route?.to || att.prov, att: att.fac, def: def.fac, win: win.fac, lostA: shipsBefore[0] - att.ships.length, lostD: shipsBefore[1] - def.ships.length };
  const imp = att.fac === G.s.player || def.fac === G.s.player;
  log('log.navalBattle', { prov: provName(report.prov), a: facName(att.fac), b: facName(def.fac), win: facName(win.fac), la: report.lostA, ld: report.lostD }, { f: att.fac, imp });
  for (const fl of [att, def]) if (!fl.ships.length) {
    for (const a of fl.cargo) if (a.gen && G.s.chars[a.gen]) G.s.chars[a.gen].army = null;
    delete G.s.fleets[fl.id];
  }
  // Der Verlierer flieht in den nächsten eigenen Hafen
  if (G.s.fleets[lose.id]) retreatFleet(lose);
  return report;
}

function retreatFleet(fl) {
  const own = factionProvinces(fl.fac).filter((pid) => isPort(pid) && pid !== fl.prov);
  let best = null, bl = Infinity;
  for (const pid of own) { const r = seaRoute(fl.prov, pid); if (r && r.len < bl) { bl = r.len; best = pid; } }
  fl.route = null;
  if (best) setSail(fl, best);
}

// ---------- Rundenende ----------
export function processFleets() {
  const s = G.s;
  if (!s.fleets) s.fleets = {};
  for (const pid in s.provinces) s.provinces[pid].shipsBuilt = 0;
  for (const fl of fleets()) {
    if (!fac(fl.fac)?.alive) { delete s.fleets[fl.id]; continue; }
    for (const sh of fl.ships) sh.hp = Math.min(1, sh.hp + (fl.route ? 0.03 : 0.12));
    if (!fl.route) continue;
    fl.route.done += speedOf(fl);
    if (fl.route.done >= fl.route.len) {
      const to = fl.route.to;
      fl.prov = to;
      fl.route = null;
      const reg = regionOf(to);
      if (!knows(fl.fac, reg)) discover(fl.fac, reg, 'sea');
      if (fl.fac === s.player) log('log.fleetArrived', { prov: provName(to) }, { f: fl.fac, imp: true });
    }
  }
  // Seeschlachten in Häfen
  const byProv = {};
  for (const fl of fleets()) if (!fl.route) (byProv[fl.prov] = byProv[fl.prov] || []).push(fl);
  for (const list of Object.values(byProv)) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (!s.fleets[a.id] || !s.fleets[b.id] || !atWar(a.fac, b.fac)) continue;
      if (a.route || b.route) continue;
      // Wer im fremden Hafen liegt, greift an
      const attacker = prov(a.prov).owner === b.fac ? a : b;
      navalBattle(attacker, attacker === a ? b : a);
    }
  }
  // Seeblockade: feindliche Flotten in einem Hafen
  const block = {};
  for (const fl of fleets()) {
    if (fl.route) continue;
    const o = prov(fl.prov).owner;
    if (o && o !== fl.fac && atWar(fl.fac, o)) block[fl.prov] = fl.fac;
  }
  s.blockade = block;
}

// Stirbt eine Macht, sinken ihre Flotten (Heere an Bord gehen mit unter)
export function dissolveFleets(fid) {
  for (const fl of fleetsOf(fid)) delete G.s.fleets[fl.id];
}

// ---------- KI: Kriegsgaleeren zur Verteidigung der Küsten ----------
export function aiShips(f) {
  if (f.gold < 400) return;
  const ports = factionProvinces(f.id).filter((pid) => isPort(pid) && (prov(pid).buildings.port || 0) >= 2);
  if (!ports.length) return;
  const have = fleetsOf(f.id).reduce((n, fl) => n + fl.ships.length, 0);
  const want = Math.min(6, Math.ceil(ports.length * 1.5));
  if (have >= want || !rng().chance(0.25)) return;
  const pid = ports.includes(f.capital) ? f.capital : ports[Math.floor(rng().next() * ports.length)];
  buildShip(f.id, pid, 'galley');
}
