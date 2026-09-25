// Heere: Bewegung, Wegfindung, Belagerung, Plünderung, Versorgung.

import { G, fac, prov, pdef, army, chr, neighbors, atWar, hasAccess, armiesIn, factionProvinces, log, provName, cityName, setOwner, rel, rng, wallBonus, facName, bumpAlive, allied } from './state.js';
import { TERRAINS, GOVERNMENTS, CULTURES } from '../data/world.js';
import { UNITS, UNIT_CLASSES, CULTURE_ARMY } from '../data/units.js';
import { resolveBattle, garrisonUnits } from './battle.js';
import { getMods, provinceIncome, createArmy } from './economy.js';
import { stat, killChar } from './characters.js';
import { clamp } from '../util.js';
import { specialtyEff } from '../data/specialties.js';
import { focusEff } from './market.js';
import { canSee } from './discovery.js';
import { townsOf, townWalls, hostileTowns, townDefenders, townSiegeNeeded, captureTown, dissolveTowns, controlOf, townName, townGarrisonUnits } from './towns.js';

export const MAX_UNITS = 20;

export function armyMen(a) {
  return Math.round(a.units.reduce((s, u) => s + UNITS[u.t].size * u.hp, 0));
}

export function unitPower(u) {
  const d = UNITS[u.t];
  return ((d.att + d.def + d.rng * 0.8 + d.cha * 0.6) / 3.4) * d.size * u.hp * (1 + (u.xp || 0) * 0.05);
}

export function armyPower(a) {
  let p = a.units.reduce((s, u) => s + unitPower(u), 0);
  const g = chr(a.gen);
  if (g) p *= 1 + stat(g, 'mar') * 0.04;
  return p;
}

export function garrisonPower(pid) {
  return garrisonUnits(pid).reduce((s, u) => s + unitPower(u), 0) * (1 + effectiveWalls(pid) * 0.35);
}

// Stärke der Verteidiger eines Ortes (Besatzung hinter Mauern und Heere seines Herrn)
export function townDefensePower(pid, i, attacker = null) {
  const w = townWalls(pid, i);
  const p = townGarrisonUnits(pid, i).reduce((s, u) => s + unitPower(u), 0) * (1 + w * 0.35) + townDefenders(pid, i).reduce((s, a) => s + armyPower(a), 0);
  // ohne Belagerungsgerät sind Mauern ab zwei Stufen schwer zu nehmen
  const noEngines = attacker && w >= 2 && !attacker.units.some((u) => UNITS[u.t].cls === 'siege');
  return noEngines ? p / 0.75 : p;
}

export function effectiveWalls(pid) {
  return (prov(pid).buildings.walls || 0) + wallBonus(pid) + (specialtyEff(pid).walls || 0);
}

export function isCavalryOnly(a) {
  return a.units.length > 0 && a.units.every((u) => ['ha', 'lc', 'camel'].includes(UNITS[u.t].cls));
}

export function isNomadArmy(a) {
  const f = fac(a.fac);
  return CULTURES[f.culture].group === 'steppe' && a.units.every((u) => UNIT_CLASSES[UNITS[u.t].cls].cav);
}

export function armySpeed(a) {
  if (!a.units.length) return 3;
  let sp = Math.min(...a.units.map((u) => UNIT_CLASSES[UNITS[u.t].cls].speed));
  const f = fac(a.fac);
  sp += GOVERNMENTS[f.gov].moveBonus;
  const g = chr(a.gen);
  if (g && g.traits.includes('horse_lord')) sp += 0.25;
  if (G.s.season === 3 && !isNomadArmy(a)) sp -= 0.5;
  if (a.stance === 'fortify') return 0;
  if (a.stance === 'forced') sp *= 1.5;
  return Math.max(1, sp);
}

export function moveCost(from, to) {
  let c = TERRAINS[pdef(to).terrain].move;
  const sea = G.map.seaLinks.some(([x, y]) => {
    const px = G.map.provinces[x].id, py = G.map.provinces[y].id;
    return (px === from && py === to) || (px === to && py === from);
  });
  if (sea) c = 2;
  return c;
}

// Kann das Heer die Provinz betreten?
export function canEnter(a, pid) {
  const owner = prov(pid).owner;
  if (owner === a.fac) return true;
  if (!canSee(a.fac, pid)) return false;
  return hasAccess(a.fac, owner);
}

// Dijkstra über Provinzen; feindliche Provinzen dürfen nur als Ziel oder von reinen Reiterheeren durchquert werden
export function reach(a, target = null, maxCost = Infinity, start = a.prov) {
  const cavOnly = isCavalryOnly(a);
  const dist = { [start]: 0 };
  const prev = {};
  const open = [start];
  const done = new Set();
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (dist[open[i]] < dist[open[bi]]) bi = i;
    const c = open.splice(bi, 1)[0];
    if (done.has(c)) continue;
    done.add(c);
    if (c === target) break;
    if (dist[c] > maxCost) break;
    for (const n of neighbors(c)) {
      if (done.has(n)) continue;
      if (!canEnter(a, n)) continue;
      // Feindgebiet beendet den Marsch einer Runde (außer bei reinen Reiterheeren)
      const o = prov(n).owner;
      const hostile = o !== a.fac && atWar(a.fac, o);
      const nd = dist[c] + moveCost(c, n) + (hostile && !cavOnly ? 1.5 : 0);
      if (dist[n] === undefined || nd < dist[n]) { dist[n] = nd; prev[n] = c; if (!open.includes(n)) open.push(n); }
    }
  }
  return { dist, prev };
}

export function pathFrom(a, r, target, start = a.prov) {
  if (r.dist[target] === undefined) return null;
  const path = [];
  let c = target;
  while (c !== start) { path.unshift(c); c = r.prev[c]; if (c === undefined) return null; }
  return path;
}

export function findPath(a, target, start = a.prov) {
  if (start === target) return [];
  return pathFrom(a, reach(a, target, Infinity, start), target, start);
}

// Route über mehrere Wegpunkte
export function findRoute(a, waypoints) {
  let start = a.prov;
  const route = [];
  for (const w of waypoints) {
    const seg = findPath(a, w, start);
    if (!seg) return null;
    route.push(...seg);
    start = w;
  }
  return route;
}

export function pathTurns(a, path) {
  let turns = 1, mp = a.mp;
  const speed = armySpeed(a);
  let prev = a.prov;
  const marks = [];
  const cavOnly = isCavalryOnly(a);
  for (const p of path) {
    const c = moveCost(prev, p);
    if (mp < c - 0.001) { turns++; mp = speed; }
    mp -= c;
    marks.push(turns);
    const o = prov(p).owner;
    if (o !== a.fac && atWar(a.fac, o) && !cavOnly) mp = 0;
    prev = p;
  }
  return marks;
}

function hostileArmiesIn(fid, pid) {
  return armiesIn(pid).filter((x) => x.fac !== fid && atWar(fid, x.fac) && x.units.length);
}

// Bewegt ein Heer zu einem Ziel (neue Route)
export async function moveArmy(a, target) {
  const path = findPath(a, target);
  if (!path || !path.length) { a.path = []; return { moved: false }; }
  a.path = path.slice();
  return advanceArmy(a);
}

// Arbeitet die gespeicherte Route ab, so weit die Bewegungspunkte reichen. Löst Schlachten und Abfangmanöver aus.
export async function advanceArmy(a) {
  let moved = false;
  if (a.stance === 'fortify') return { moved };
  while (a.path && a.path.length) {
    const next = a.path[0];
    const cost = moveCost(a.prov, next);
    if (a.mp < cost - 0.001) break;
    if (!canEnter(a, next)) { a.path = []; break; }
    const foes = hostileArmiesIn(a.fac, next);
    if (foes.length) {
      const res = await fight([a], foes, next, false);
      if (!G.s.armies[a.id]) return { moved, destroyed: true };
      a.mp = 0;
      if (res.winner !== 'att') { a.path = []; return { moved, battle: res }; }
    }
    a.path.shift();
    a.mp -= cost;
    const from = a.prov;
    a.prov = next;
    a.siegeTown = null;
    moved = true;
    a.moved = true;
    if (!a.trail || a.trail.turn !== G.s.turn) a.trail = { turn: G.s.turn, provs: [from] };
    a.trail.provs.push(next);
    if (a.siegeOf && a.siegeOf !== next) a.siegeOf = null;
    const o = prov(next).owner;
    if (o !== a.fac && atWar(a.fac, o)) {
      if (!isCavalryOnly(a) || !a.path.length) { a.mp = 0; }
    }
    if (from && prov(from).siege && prov(from).siege.fac === a.fac) checkSiegeLifted(from);
    // Abfangen durch lauernde Feindheere
    const ic = await checkInterception(a, next);
    if (ic) { if (!G.s.armies[a.id]) return { moved, destroyed: true }; a.mp = 0; break; }
  }
  if (!a.path) a.path = [];
  return { moved };
}

// Heere in Stellung "Abfangen" greifen Feinde an, die ihre oder eine benachbarte Provinz betreten
async function checkInterception(mover, pid) {
  const s = G.s;
  const cands = Object.values(s.armies).filter((e) => e.stance === 'intercept' && e.units.length && e.interceptTurn !== s.turn
    && atWar(e.fac, mover.fac) && (e.prov === pid || neighbors(e.prov).includes(pid)) && canEnter(e, pid));
  if (!cands.length) return false;
  cands.sort((x, y) => armyPower(y) - armyPower(x));
  const e = cands[0];
  const ratio = armyPower(e) / (armyPower(mover) + 1);
  if (e.fac !== s.player && ratio < 0.8) return false;
  e.interceptTurn = s.turn;
  if (e.prov !== pid) {
    if (!e.trail || e.trail.turn !== s.turn) e.trail = { turn: s.turn, provs: [e.prov] };
    e.trail.provs.push(pid);
    e.prov = pid;
  }
  log('log.intercept', { a: facName(e.fac), b: facName(mover.fac), prov: provName(pid) }, { f: e.fac, imp: e.fac === s.player || mover.fac === s.player });
  await resolveBattle({ att: [e.id], def: [mover.id], prov: pid, assault: false, ambush: true });
  if (s.armies[mover.id]) mover.path = [];
  return true;
}

export async function fight(attackers, defenders, pid, assault) {
  const res = await resolveBattle({ att: attackers.map((x) => x.id), def: defenders.map((x) => x.id), prov: pid, assault });
  return res;
}

// ---------- Belagerung ----------
export function siegeNeeded(pid) {
  return 1 + Math.round(effectiveWalls(pid) * 1.5) + (prov(pid).buildings.barracks ? 1 : 0);
}

// Belagerungsziel eines Heeres in seiner Provinz: 'capital' oder Index eines Ortes
export function siegeTargetOf(a) {
  const p = prov(a.prov);
  const hostileCapital = p.owner !== a.fac && atWar(a.fac, p.owner);
  const towns = hostileTowns(a.fac, a.prov);
  if (a.siegeTown !== undefined && a.siegeTown !== null && towns.includes(a.siegeTown)) return a.siegeTown;
  if (hostileCapital) return 'capital';
  if (!towns.length) return null;
  // schwächster feindlicher Ort zuerst
  return towns.sort((x, y) => townWalls(a.prov, x) - townWalls(a.prov, y))[0];
}

export function beginSieges() {
  const s = G.s;
  for (const a of Object.values(s.armies)) {
    if (!a.units.length || a.raid) continue;
    const p = prov(a.prov);
    // Offene Orte ohne Mauern und Verteidiger fallen jedem feindlichen Heer von selbst zu
    for (const i of hostileTowns(a.fac, a.prov)) {
      const t = townsOf(a.prov)[i];
      if (townWalls(a.prov, i) === 0 && !t.siege && !townDefenders(a.prov, i).length) t.siege = { fac: a.fac, turns: 0, needed: 1 };
    }
    const target = siegeTargetOf(a);
    if (target === null) continue;
    if (target === 'capital') {
      const defenders = armiesIn(a.prov).filter((x) => x.fac === p.owner || (x.fac !== a.fac && !atWar(x.fac, p.owner) && atWar(x.fac, a.fac)));
      if (defenders.some((x) => x.units.length)) continue;
      if (!p.siege || !atWar(p.siege.fac, p.owner)) {
        p.siege = { fac: a.fac, turns: 0, needed: siegeNeeded(a.prov) };
        a.siegeOf = a.prov;
        if (p.owner === s.player) log('log.siegeStart', { prov: provName(a.prov), fac: facName(a.fac) }, { f: p.owner, imp: true });
      }
      continue;
    }
    const t = townsOf(a.prov)[target];
    if (townDefenders(a.prov, target).length) continue;
    if (!t.siege || !atWar(t.siege.fac, t.owner)) {
      t.siege = { fac: a.fac, turns: 0, needed: townSiegeNeeded(a.prov, target) };
      a.siegeOf = a.prov;
      if (t.owner === s.player) log('log.townSiege', { town: townName(a.prov, target), prov: provName(a.prov), fac: facName(a.fac) }, { f: t.owner, imp: true });
    }
  }
}

export function checkSiegeLifted(pid) {
  const p = prov(pid);
  const present = (fid) => armiesIn(pid).some((x) => x.fac === fid && x.units.length);
  if (p.siege && !present(p.siege.fac)) p.siege = null;
  for (const t of townsOf(pid)) if (t.siege && !present(t.siege.fac)) t.siege = null;
}

// Rundenende: Fortschritt aller Belagerungen
export async function progressSieges() {
  const s = G.s;
  for (const pid in s.provinces) {
    const p = s.provinces[pid];
    // Orte
    for (let i = 0; i < (p.towns || []).length; i++) {
      const t = p.towns[i];
      if (!t.siege) continue;
      checkSiegeLifted(pid);
      if (!t.siege) continue;
      if (!atWar(t.siege.fac, t.owner)) { t.siege = null; continue; }
      t.siege.turns++;
      t.gar = Math.max(0.1, t.gar - 0.15);
      if (t.siege.turns >= t.siege.needed) captureTown(pid, i, t.siege.fac, 'siege');
    }
    if (!p.siege) continue;
    checkSiegeLifted(pid);
    if (!p.siege) continue;
    if (!atWar(p.siege.fac, p.owner)) { p.siege = null; continue; }
    p.siege.turns++;
    p.garrison = Math.max(0.1, p.garrison - 0.12);
    p.devast = Math.min(1, p.devast + 0.05);
    if (p.siege.turns >= p.siege.needed) {
      await captureProvince(pid, p.siege.fac, 'starve');
    }
  }
}

// Sturm auf einen Ort innerhalb der Provinz
export async function assaultTown(a, i) {
  const pid = a.prov;
  const t = townsOf(pid)[i];
  if (!t || t.owner === a.fac || !atWar(a.fac, t.owner)) return null;
  const defenders = townDefenders(pid, i);
  const res = await resolveBattle({ att: [a.id], def: defenders.map((d) => d.id), prov: pid, assault: true, town: i });
  if (res.winner === 'att' && G.s.armies[a.id]) captureTown(pid, i, a.fac, 'assault');
  a.mp = 0;
  return res;
}

export async function assault(a) {
  const pid = a.prov;
  const p = prov(pid);
  if (p.owner === a.fac || !atWar(a.fac, p.owner)) return null;
  const defenders = armiesIn(pid).filter((x) => x.fac === p.owner);
  const res = await resolveBattle({ att: [a.id], def: defenders.map((d) => d.id), prov: pid, assault: true });
  if (res.winner === 'att' && G.s.armies[a.id]) {
    await captureProvince(pid, a.fac, 'assault');
  }
  a.mp = 0;
  return res;
}

export async function captureProvince(pid, fid, how) {
  const s = G.s;
  const p = prov(pid);
  const oldOwner = p.owner;
  if (oldOwner === fid) return;
  // Vasallen und Verbündete befreien aufständisches Land für den früheren Herrn, statt es zu behalten
  const lord = p.lastOwner;
  if (oldOwner === 'rebels' && lord && lord !== fid && s.factions[lord]?.alive && !atWar(fid, lord)
    && (fac(fid).overlord === lord || allied(fid, lord))) {
    setOwner(pid, lord, true);
    for (const a of armiesIn(pid)) if (a.fac === fid) a.siegeOf = null;
    rel(fid, lord).mod += 5;
    fac(fid).prestige += 2;
    log('log.provFreed', { prov: provName(pid), fac: facName(fid), lord: facName(lord) }, { f: lord, imp: lord === s.player || fid === s.player });
    return 'occupy';
  }
  let choice = 'occupy';
  if (fid === s.player && G.ui?.chooseCapture) {
    choice = await G.ui.chooseCapture({ prov: pid, from: oldOwner, how });
  } else if (fid !== s.player) {
    const f = fac(fid);
    const sackChance = fid === 'mongol' ? 0.7 : fid === 'rebels' ? 0.3 : f.ai.aggr * 0.25 + (f.religion !== pickMajorReligion(p) ? 0.1 : 0);
    if (rng().chance(sackChance)) choice = 'sack';
  }
  const f = fac(fid);
  let loot = 0;
  if (choice === 'sack' || choice === 'raze') {
    const inc = provinceIncome(pid);
    loot = Math.round((inc.tax + inc.goods) * (choice === 'raze' ? 5 : 3.5) + p.pop * 0.3);
    f.gold += loot;
    p.pop *= choice === 'raze' ? 0.6 : 0.85;
    p.devast = Math.min(1, p.devast + (choice === 'raze' ? 0.8 : 0.45));
    if (choice === 'raze') { for (const k of Object.keys(p.buildings)) { p.buildings[k] = Math.max(0, p.buildings[k] - 1); if (!p.buildings[k]) delete p.buildings[k]; } }
    f.prestige += choice === 'raze' ? 2 : 1;
  }
  // Kriegspunkte und Ruf
  if (oldOwner && s.factions[oldOwner]) {
    const r = rel(fid, oldOwner);
    r.score = r.score || {};
    r.score[fid] = (r.score[fid] || 0) + 10 + Math.round(p.pop / 20);
    s.factions[oldOwner].warWeariness += 3;
    s.factions[oldOwner].prestige = Math.max(0, s.factions[oldOwner].prestige - 3);
  }
  if (fid !== 'rebels') {
    const holy = f.holyWar > 0 && s.factions[oldOwner] && s.factions[oldOwner].religion !== f.religion;
    f.infamy += holy ? 2 : 5;
    f.prestige += 3;
  }
  setOwner(pid, fid, true);
  if (choice === 'sack') p.order = Math.max(0, p.order - 20);
  if (choice === 'raze') p.order = Math.max(0, p.order - 40);
  // Heere des alten Besitzers in der Provinz ziehen ab
  for (const a of armiesIn(pid)) {
    if (a.fac === oldOwner) retreatArmy(a);
    if (a.fac === fid) a.siegeOf = null;
  }
  const important = fid === s.player || oldOwner === s.player;
  log(choice === 'occupy' ? 'log.captured' : choice === 'raze' ? 'log.razed' : 'log.sacked', { prov: provName(pid), city: cityName(pid), fac: facName(fid), from: facName(oldOwner), loot }, { f: fid, imp: important });
  if (oldOwner && s.factions[oldOwner] && !factionProvinces(oldOwner).length) checkFactionDeath(oldOwner, fid);
  return choice;
}

function pickMajorReligion(p) {
  return Object.entries(p.rel).sort((a, b) => b[1] - a[1])[0][0];
}

export function checkFactionDeath(fid, killer) {
  const s = G.s;
  const f = s.factions[fid];
  if (!f || !f.alive || fid === 'rebels') return;
  if (factionProvinces(fid).length) return;
  const armies = Object.values(s.armies).filter((a) => a.fac === fid);
  // Fraktionen ohne Land überleben nur mit großem Heer (z. B. Kreuzfahrer, Mongolen)
  const men = armies.reduce((x, a) => x + armyMen(a), 0);
  if (men > 1500 && f.spawned && !f.everOwned) return;
  f.alive = false;
  bumpAlive();
  dissolveTowns(fid);
  for (const a of armies) delete s.armies[a.id];
  for (const c of Object.values(s.chars)) if (c.fac === fid) c.alive = false;
  for (const v of Object.values(s.factions)) if (v.overlord === fid) v.overlord = null;
  f.overlord = null;
  for (const k in s.rel) if (k.split('|').includes(fid)) delete s.rel[k];
  log('log.destroyed', { fac: f.n, by: killer ? facName(killer) : null }, { f: fid, imp: true });
}

export function retreatArmy(a) {
  const opts = neighbors(a.prov).filter((n) => {
    const o = prov(n).owner;
    return (o === a.fac || hasAccess(a.fac, o) && !atWar(a.fac, o)) && !hostileArmiesIn(a.fac, n).length;
  });
  if (!opts.length) { destroyArmy(a); return false; }
  opts.sort((x, y) => (prov(x).owner === a.fac ? -1 : 0) - (prov(y).owner === a.fac ? -1 : 0));
  a.prov = opts[0];
  a.path = [];
  a.mp = 0;
  a.siegeOf = null;
  return true;
}

export function destroyArmy(a) {
  if (a.gen && G.s.chars[a.gen]) {
    const g = G.s.chars[a.gen];
    g.army = null;
    if (rng().chance(0.35)) killChar(g, 'battle');
  }
  delete G.s.armies[a.id];
}

// ---------- Plünderung ----------
export function processRaids() {
  const s = G.s;
  for (const a of Object.values(s.armies)) {
    if (!a.raid || !a.units.length) continue;
    const p = prov(a.prov);
    if (p.owner === a.fac || !atWar(a.fac, p.owner)) { a.raid = false; continue; }
    const inc = provinceIncome(a.prov);
    const cavShare = a.units.filter((u) => UNIT_CLASSES[UNITS[u.t].cls].cav).length / a.units.length;
    const loot = Math.round((inc.tax + inc.goods + inc.pasture) * (1 + cavShare) * (1 - p.devast * 0.7));
    fac(a.fac).gold += loot;
    fac(a.fac).horses += Math.round(inc.horses * 1.5);
    p.devast = Math.min(1, p.devast + 0.25);
    p.pop *= 0.98;
    p.order = Math.max(0, p.order - 6);
    const r = rel(a.fac, p.owner);
    r.score = r.score || {};
    r.score[a.fac] = (r.score[a.fac] || 0) + 2;
    if (a.fac === s.player || p.owner === s.player) log('log.raid', { prov: provName(a.prov), fac: facName(a.fac), loot }, { f: a.fac, imp: p.owner === s.player });
  }
}

// ---------- Versorgung, Verschleiß, Auffrischung ----------
export function processSupply() {
  const s = G.s;
  for (const a of Object.values(s.armies)) {
    if (!a.units.length) { if (!a.gen) delete s.armies[a.id]; continue; }
    const p = prov(a.prov), d = pdef(a.prov);
    const own = p.owner === a.fac;
    const friendly = own || (hasAccess(a.fac, p.owner) && !atWar(a.fac, p.owner)) || (p.towns || []).some((t) => t.owner === a.fac);
    const nomad = isNomadArmy(a);
    let attr = 0;
    if (d.terrain === 'desert' && !nomad && !['camel'].includes(a.units[0] && UNITS[a.units[0].t].cls)) attr += 0.04;
    if (s.season === 3 && !nomad) attr += own ? 0 : d.terrain === 'mountain' ? 0.08 : 0.03;
    if (!friendly && !nomad) attr += 0.02;
    const se = specialtyEff(a.prov);
    if (!own) attr += se.hostileAttrition || 0;
    if (a.stance === 'forced' && a.moved) attr += 0.04;
    // Versorgung: große Heere in armen Provinzen
    const supply = (p.pop / 12 + (TERRAINS[d.terrain].pasture * (nomad ? 4 : 1))) * (1 + ((se.supply || 0) + (own ? focusEff(a.prov).supply || 0 : 0)) * 0.5);
    const men = armyMen(a) / 100;
    if (men > supply) attr += Math.min(0.06, (men - supply) / supply * 0.03);
    if (fac(a.fac).gold < 0) attr += 0.03;
    for (const u of a.units) {
      if (attr > 0) u.hp -= attr * rng().range(0.6, 1.4);
      else if (own && !p.siege) {
        const cls = UNITS[u.t].cls;
        const cav = UNIT_CLASSES[cls].cav;
        let reg = 0.07;
        if (cav && (p.buildings.stables || p.buildings.ordu)) reg += 0.06;
        if (!cav && p.buildings.barracks) reg += 0.06;
        u.hp = Math.min(1, u.hp + reg);
      } else if (friendly) u.hp = Math.min(1, u.hp + 0.03);
    }
    a.units = a.units.filter((u) => u.hp > 0.06);
  }
}

// Haltung eines Heeres ändern
export const STANCES = ['normal', 'forced', 'intercept', 'fortify'];
export function setStance(a, stance) {
  const old = a.stance || 'normal';
  if (old === stance) return;
  const full = armySpeed({ ...a, stance: 'normal' });
  if (stance === 'fortify' || old === 'fortify') a.mp = 0;
  else if (stance === 'forced' && !a.moved) a.mp = Math.max(a.mp, full * 1.5);
  else if (old === 'forced') a.mp = Math.min(a.mp, a.moved ? Math.max(0, a.mp - full * 0.5) : full);
  a.stance = stance;
}

export function resetMovement() {
  for (const a of Object.values(G.s.armies)) { a.mp = armySpeed(a); a.moved = false; }
}

export function mergeArmies(a, b) {
  if (a.fac !== b.fac || a.prov !== b.prov) return false;
  const space = MAX_UNITS - a.units.length;
  const moved = b.units.splice(0, space);
  a.units.push(...moved);
  a.mp = Math.min(a.mp, b.mp);
  if (!a.gen && b.gen) { a.gen = b.gen; chr(b.gen).army = a.id; b.gen = null; }
  if (!b.units.length) {
    if (b.gen) chr(b.gen).army = null;
    delete G.s.armies[b.id];
  }
  return true;
}

export function splitArmy(a, indices) {
  if (!indices.length || indices.length >= a.units.length) return null;
  const units = indices.sort((x, y) => y - x).map((i) => a.units.splice(i, 1)[0]).reverse();
  const na = createArmy(a.fac, a.prov, units);
  na.mp = a.mp;
  return na;
}

export function assignGeneral(a, cid) {
  const c = chr(cid);
  if (!c || c.fac !== a.fac) return;
  if (c.army && G.s.armies[c.army]) G.s.armies[c.army].gen = null;
  if (a.gen && chr(a.gen)) chr(a.gen).army = null;
  a.gen = cid;
  c.army = a.id;
}

export function armyLabel(a) {
  const g = chr(a.gen);
  return g ? g.n : null;
}

export function startingArmies() {
  const s = G.s;
  for (const f of Object.values(s.factions)) {
    if (!f.alive || f.id === 'rebels' || !f.capital) continue;
    const provs = factionProvinces(f.id);
    const nArmies = provs.length >= 18 ? 3 : provs.length >= 8 ? 2 : 1;
    const sizes = [clamp(Math.round(4 + provs.length * 0.7), 4, 16), clamp(Math.round(3 + provs.length * 0.4), 3, 10), clamp(Math.round(3 + provs.length * 0.3), 3, 8)];
    const byPop = provs.slice().sort((a, b) => s.provinces[b].pop - s.provinces[a].pop);
    for (let i = 0; i < nArmies; i++) {
      const pid = i === 0 ? f.capital : byPop[i] || f.capital;
      const roster = rosterForStart(f.id, pid);
      const units = [];
      for (let k = 0; k < sizes[i]; k++) units.push({ t: roster[k % roster.length], hp: 1, xp: rng().int(0, 1) });
      const a = createArmy(f.id, pid, units);
      a.mp = armySpeed(a);
    }
  }
}

function rosterForStart(fid, pid) {
  const f = fac(fid);
  const list = [...(CULTURE_ARMY[f.culture] || CULTURE_ARMY.turkic)];
  const pc = prov(pid).culture;
  if (pc !== f.culture && CULTURE_ARMY[pc]) list.push(CULTURE_ARMY[pc][0]);
  if (f.gov === 'sultanate' && f.culture === 'turkic') list.push('spearmen', 'archers');
  let out = f.gov === 'nomad' && CULTURES[f.culture].group === 'steppe' ? list.filter((u) => UNIT_CLASSES[UNITS[u].cls].cav) : list.filter((u) => !UNITS[u].tech);
  // Kleine Mächte beginnen mit bezahlbaren Truppen
  if (factionProvinces(fid).length <= 2) {
    const cheap = out.filter((u) => UNITS[u].upkeep <= 1);
    out = cheap.length ? cheap : ['spearmen', 'archers'];
  }
  return out;
}
