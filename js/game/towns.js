// Städte und Burgen innerhalb der Provinzen.
// Die Hauptstadt einer Provinz bestimmt ihren Herrn; die übrigen Orte können einzeln gehalten werden.
// Wer alle Orte einer Provinz besitzt, erhält den Bonus der vollständigen Kontrolle; fremde Orte
// (Enklaven, Burgen im Feindesland) schwächen Ordnung und Einnahmen und sind Anlass für Streit.

import { G, fac, prov, pdef, log, provName, facName, rel, atWar, armiesIn, rng } from './state.js';
import { TOWN_TYPES, PROVINCE_TOWNS, CONTROL, townName } from '../data/towns.js';
import { UNITS, UNIT_CLASSES, CULTURE_ARMY } from '../data/units.js';
import { clamp } from '../util.js';

const MINING = ['iron', 'copper', 'silver', 'gold', 'gems', 'jade', 'salt'];

export function initTowns() {
  const s = G.s;
  for (const pid in s.provinces) {
    const p = s.provinces[pid], d = pdef(pid);
    p.towns = (PROVINCE_TOWNS[pid] || []).map(([, t]) => ({
      t, owner: p.owner, lvl: (['town', 'market', 'port'].includes(t) && d.pop >= 150) ? 2 : 1,
      gar: 1, siege: null,
    }));
  }
  s.townVer = 1;
}

export const townsOf = (pid) => G.s.provinces[pid].towns || [];
export const townType = (pid, i) => TOWN_TYPES[townsOf(pid)[i]?.t];
export { townName };

export function townWalls(pid, i) {
  const t = townsOf(pid)[i];
  if (!t) return 0;
  const T = TOWN_TYPES[t.t];
  let w = T.walls;
  if (t.t === 'castle') w += t.lvl - 1;
  else if (w > 0 && t.lvl >= 3) w += 1;
  return w;
}

export function foreignTowns(pid) {
  const p = prov(pid);
  return townsOf(pid).filter((t) => t.owner !== p.owner).length;
}

// Kontrolle: 'full' (alles in einer Hand), 'divided' (fremde Orte), 'none' (keine Orte)
export function controlOf(pid) {
  const tw = townsOf(pid);
  if (!tw.length) return 'none';
  return foreignTowns(pid) ? 'divided' : 'full';
}

// Alle Orte, die eine Macht in fremden Provinzen hält (Index mit Versionszähler)
let idx = { ver: -1, s: null, map: new Map() };
function index() {
  const s = G.s;
  if (idx.s === s && idx.ver === s.townVer) return idx.map;
  const map = new Map();
  for (const pid in s.provinces) {
    const p = s.provinces[pid];
    (p.towns || []).forEach((t, i) => {
      if (t.owner === p.owner) return;
      let l = map.get(t.owner);
      if (!l) map.set(t.owner, (l = []));
      l.push([pid, i]);
    });
  }
  idx = { ver: s.townVer, s, map };
  return map;
}
export function foreignHeld(fid) { return index().get(fid) || []; }
export function allEnclaves() { return index(); }

// Hält a Orte in Provinzen von b (oder umgekehrt)?
export function contestedWith(a, b) {
  return foreignHeld(a).some(([pid]) => prov(pid).owner === b) || foreignHeld(b).some(([pid]) => prov(pid).owner === a);
}

export function setTownOwner(pid, i, fid, how = 'transfer') {
  const t = townsOf(pid)[i];
  if (!t || t.owner === fid) return;
  const old = t.owner;
  t.owner = fid;
  t.siege = null;
  t.gar = how === 'transfer' ? Math.max(t.gar, 0.6) : 0.3;
  G.s.townVer = (G.s.townVer || 0) + 1;
  return old;
}

// Beitrag eines Ortes zu den Einnahmen (auf Grundlage der Provinz-Grundleistung)
export function townContribution(pid, i, base) {
  const t = townsOf(pid)[i];
  const e = TOWN_TYPES[t.t].eff, L = t.lvl;
  const mining = t.t === 'mine' && pdef(pid).goods.some((g) => MINING.includes(g)) ? 1.6 : 1;
  const c = {
    tax: (base.tax || 0) * (e.tax || 0) * L,
    goods: (base.goods || 0) * (e.goods || 0) * L,
    route: (base.route || 0) * (e.route || 0) * L,
    pasture: (base.pasture || 0) * (e.pasture || 0) * L,
    flat: (e.flat || 0) * L * mining,
    horses: (e.horses || 0) * L,
    research: (e.research || 0) * L,
    prestige: (e.prestige || 0) * L,
  };
  if (t.siege) for (const k in c) c[k] *= 0.2;
  c.gold = c.tax + c.goods + c.route + c.pasture + c.flat;
  return c;
}

// Ordnungsbeitrag der Orte für den Provinzherrn
export function townOrder(pid) {
  const p = prov(pid);
  let own = 0, foreign = 0;
  for (const t of townsOf(pid)) {
    if (t.owner === p.owner) own += (TOWN_TYPES[t.t].eff.order || 0) * t.lvl;
    else foreign++;
  }
  const tw = townsOf(pid).length;
  return {
    towns: own,
    control: tw && !foreign ? CONTROL.order : 0,
    divided: -Math.min(CONTROL.dividedMaxOrder, foreign * CONTROL.dividedOrder),
  };
}

// Garnison eines Ortes
export function townGarrisonUnits(pid, i) {
  const t = townsOf(pid)[i];
  const p = prov(pid);
  const T = TOWN_TYPES[t.t];
  const walls = townWalls(pid, i);
  const n = clamp(Math.round((1 + walls + T.gar + t.lvl) * (t.t === 'castle' ? 1.2 : 1)), 1, 10);
  const pool = ['militia', 'archers', 'spearmen', 'militia'];
  const cult = (CULTURE_ARMY[fac(t.owner)?.culture || p.culture] || []).filter((u) => !UNIT_CLASSES[UNITS[u].cls].cav && !UNITS[u].tech && !UNITS[u].factions);
  if (cult.length) pool.push(cult[0]);
  const units = [];
  for (let k = 0; k < n; k++) units.push({ t: pool[k % pool.length], hp: Math.max(0.1, t.gar), xp: 0, garrison: true });
  return units;
}

export function townSiegeNeeded(pid, i) {
  const w = townWalls(pid, i);
  return w <= 0 ? 1 : 1 + Math.round(w * 1.2);
}

// Wert eines Ortes für Kauf und Verkauf
export function townValue(pid, i, base) {
  const c = townContribution(pid, i, base);
  const t = townsOf(pid)[i];
  return Math.round(50 + t.lvl * 35 + c.gold * 14 + (t.t === 'castle' ? 60 : 0));
}

export function upgradeCost(pid, i) {
  const t = townsOf(pid)[i];
  if (!t || t.lvl >= 3) return null;
  return t.lvl === 1 ? 100 : 220;
}

export function canUpgrade(fid, pid, i) {
  const t = townsOf(pid)[i];
  const cost = upgradeCost(pid, i);
  if (!t || t.owner !== fid || cost === null || t.siege) return { ok: false, cost };
  if (prov(pid).owner === fid && prov(pid).order < 30) return { ok: false, cost, reason: 'order' };
  return { ok: fac(fid).gold >= cost, cost };
}

export function upgradeTown(fid, pid, i) {
  const c = canUpgrade(fid, pid, i);
  if (!c.ok) return false;
  fac(fid).gold -= c.cost;
  const t = townsOf(pid)[i];
  t.lvl++;
  t.gar = Math.min(1, t.gar + 0.2);
  if (fid === G.s.player) log('log.townUpgrade', { town: townName(pid, i), prov: provName(pid), lvl: t.lvl }, { f: fid });
  return true;
}

// Eroberung eines Ortes
export function captureTown(pid, i, fid, how = 'siege') {
  const s = G.s;
  const t = townsOf(pid)[i];
  if (!t) return;
  const from = t.owner;
  const lord = prov(pid).owner;
  // Befreiung: Wer einen aufständischen Ort im Land einer Macht einnimmt, mit der er nicht im Krieg liegt
  // (Vasall, Verbündeter, Durchziehender), gibt ihn dem Landesherrn zurück.
  if (from === 'rebels' && lord && lord !== fid && lord !== 'rebels' && s.factions[lord]?.alive && !atWar(fid, lord)) {
    setTownOwner(pid, i, lord, 'transfer');
    const f = fac(fid);
    if (f) f.prestige += 1;
    rel(fid, lord).mod += 3;
    log('log.townFreed', { town: townName(pid, i), prov: provName(pid), fac: facName(fid), lord: facName(lord) }, { f: lord, imp: lord === s.player || fid === s.player });
    return;
  }
  setTownOwner(pid, i, fid, how);
  const f = fac(fid);
  if (f) {
    f.prestige += 1;
    f.gold += 10 + t.lvl * 10;
    if (from && s.factions[from] && from !== 'rebels' && fid !== 'rebels') {
      const r = rel(fid, from);
      r.score = r.score || {};
      r.score[fid] = (r.score[fid] || 0) + 4 + t.lvl * 2 + (t.t === 'castle' ? 3 : 0);
      f.infamy += 1;
    }
  }
  const p = prov(pid);
  const important = fid === s.player || from === s.player || p.owner === s.player;
  log('log.townTaken', { town: townName(pid, i), prov: provName(pid), fac: facName(fid), from: facName(from) }, { f: fid, imp: important });
  if (p.owner === fid && controlOf(pid) === 'full' && fid === s.player) log('log.fullControl', { prov: provName(pid) }, { f: fid, imp: true });
}

// Übergabe einer Provinz: Welche Orte folgen der Hauptstadt?
// Bei Eroberung halten sich stark befestigte Orte (Enklaven), offene Orte ergeben sich.
export function transferTowns(pid, from, to, conquest) {
  townsOf(pid).forEach((t, i) => {
    if (t.owner !== from) return;
    if (conquest && from && from !== 'rebels' && to !== 'rebels') {
      const w = townWalls(pid, i);
      if (w >= 2) return;
      if (w === 1 && rng().chance(0.45)) return;
    }
    setTownOwner(pid, i, to, 'transfer');
  });
}

// Eine Macht ist untergegangen: ihre Orte fallen an die Herren der Provinzen
export function dissolveTowns(fid) {
  for (const [pid, i] of [...foreignHeld(fid)]) setTownOwner(pid, i, prov(pid).owner, 'transfer');
}

// Welche Orte darf ein Heer in dieser Provinz angreifen?
export function hostileTowns(fid, pid) {
  const out = [];
  townsOf(pid).forEach((t, i) => { if (t.owner !== fid && t.owner && atWar(fid, t.owner)) out.push(i); });
  return out;
}

export function townDefenders(pid, i) {
  const t = townsOf(pid)[i];
  return armiesIn(pid).filter((a) => a.fac === t.owner && a.units.length);
}
