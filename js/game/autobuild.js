// Automatischer Ausbau für den Spieler: Provinzen mit eingeschaltetem Auto-Ausbau errichten
// am Rundenende selbstständig Gebäude und bauen ihre Orte aus, solange Gold über der Reserve liegt.

import { G, fac, prov, pdef, neighbors, factionProvinces, enemiesOf, log, provName } from './state.js';
import { provinceIncome, orderBreakdown, buildOptions, startBuilding, ADMIN_PER_LEVEL, courtRate } from './economy.js';
import { townsOf, townName, townContribution, canUpgrade, upgradeTown } from './towns.js';
import { buildingName } from '../data/buildings.js';
import { CULTURES } from '../data/world.js';

export const RESERVES = [0, 100, 250, 500, 1000];

export function autoReserve(fid) {
  const r = fac(fid).autoReserve;
  return r ?? 150;
}

export function autoProvinces(fid) {
  return factionProvinces(fid).filter((pid) => prov(pid).auto);
}

export function setAuto(pid, on) {
  prov(pid).auto = on ? true : undefined;
}

// Wie viel bringt ein Gebäude? Einnahmen, Forschung, Pferde und Ordnung vor und nach dem Bau
function buildScore(pid, o, f, atWar) {
  const p = prov(pid);
  const cur = p.buildings[o.id] || 0;
  const snap = () => {
    const i = provinceIncome(pid);
    return { gold: i.tax + i.goods + i.route + i.pasture, research: i.research, horses: i.horses, order: orderBreakdown(pid).total };
  };
  const a = snap();
  p.buildings[o.id] = cur + 1;
  let b;
  try { b = snap(); } finally { if (cur) p.buildings[o.id] = cur; else delete p.buildings[o.id]; }
  const keep = 1 - courtRate(f.last?.gross || 0);
  let gain = (b.gold - a.gold) * keep - ADMIN_PER_LEVEL + (b.research - a.research) * 1.5 + (b.horses - a.horses) * 0.4;
  // Ordnung zählt, solange die Provinz unruhig ist
  if (p.order < 70) gain += Math.max(0, b.order - a.order) * (p.order < 40 ? 0.6 : 0.3);
  // Mehr Platz für Menschen bringt später Steuern
  if (o.id === 'irrigation') gain += 0.6 + pdef(pid).pop / 250;
  if (o.id === 'walls') {
    const border = neighbors(pid).some((n) => prov(n).owner !== f.id);
    gain += border ? (atWar ? 1.6 : 0.5) : 0;
  }
  if (o.id === 'barracks' && pid === f.capital) gain += 0.8;
  if (o.id === 'ordu' && CULTURES[f.culture].group === 'steppe') gain += 0.5;
  return gain / o.cost;
}

// Wird zu Beginn jeder Runde des Spielers ausgeführt
export function runAutoBuild(fid) {
  const f = fac(fid);
  const provs = autoProvinces(fid);
  if (!provs.length) return [];
  const reserve = autoReserve(fid);
  const atWar = enemiesOf(fid).some((e) => e !== 'rebels');
  const done = [];
  const cands = [];
  for (const pid of provs) {
    const p = prov(pid);
    if (!p.queue && !p.siege) {
      for (const o of buildOptions(pid)) {
        if (o.reason && o.reason !== 'b.gold') continue;
        cands.push({ kind: 'b', pid, id: o.id, cost: o.cost, v: buildScore(pid, o, f, atWar) });
      }
    }
    townsOf(pid).forEach((t, i) => {
      if (t.owner !== fid) return;
      const c = canUpgrade(fid, pid, i);
      if (c.cost === null || c.reason || t.siege) return;
      const base = provinceIncome(pid, true);
      const gain = townContribution(pid, i, base).gold / t.lvl + (t.t === 'castle' && atWar ? 1.5 : 0) + (t.t === 'monastery' || t.t === 'holy' ? 0.5 : 0);
      cands.push({ kind: 't', pid, i, cost: c.cost, v: gain / c.cost });
    });
  }
  cands.sort((a, b) => b.v - a.v);
  const busy = new Set();
  for (const c of cands) {
    if (c.v <= 0) continue;
    if (f.gold - c.cost < reserve) continue;
    if (c.kind === 'b') {
      if (busy.has(c.pid)) continue;
      if (startBuilding(c.pid, c.id)) {
        busy.add(c.pid);
        done.push({ pid: c.pid, n: buildingName(c.id, prov(c.pid).queue.l, f.religion) });
      }
    } else if (upgradeTown(fid, c.pid, c.i, true)) {
      done.push({ pid: c.pid, n: townName(c.pid, c.i) });
    }
  }
  if (done.length && fid === G.s.player) {
    log('log.autoBuild', { n: done.length, list: done.slice(0, 6).map((d) => d.n), provs: done.slice(0, 6).map((d) => provName(d.pid)), more: Math.max(0, done.length - 6) }, { f: fid, imp: true });
  }
  return done;
}
