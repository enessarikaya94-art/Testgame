// Zentraler Spielzustand und Hilfsfunktionen für den Zugriff darauf.

import { FACTIONS } from '../data/factions.js';
import { PROVINCES, PROVINCE_BY_ID } from '../data/provinces.js';
import { SCENARIOS } from '../data/scenarios.js';
import { TRADE_ROUTES, GOVERNMENTS, religionAffinity, cultureAffinity } from '../data/world.js';
import { BUILDINGS } from '../data/buildings.js';
import { RNG, pairKey, clamp } from '../util.js';

export const G = {
  s: null,      // serialisierbarer Zustand
  map: null,    // Ergebnis von generateMap()
  rng: null,
  listeners: [],
};

export const END_YEAR = 1300;

export function rng() { return G.rng; }
export function S() { return G.s; }

export function newId(prefix) {
  G.s.nextId = (G.s.nextId || 1) + 1;
  return `${prefix}${G.s.nextId}`;
}

// ---------- Zugriffe ----------
export const fac = (id) => G.s.factions[id];
export const prov = (id) => G.s.provinces[id];
export const pdef = (id) => PROVINCE_BY_ID[id];
export const army = (id) => G.s.armies[id];
export const chr = (id) => (id ? G.s.chars[id] : null);

export function neighbors(pid) {
  return G.map.provIndex[pid].neighbors;
}

export function factionProvinces(fid) {
  const out = [];
  for (const pid in G.s.provinces) if (G.s.provinces[pid].owner === fid) out.push(pid);
  return out;
}

export function factionArmies(fid) {
  return Object.values(G.s.armies).filter((a) => a.fac === fid);
}

export function armiesIn(pid) {
  return Object.values(G.s.armies).filter((a) => a.prov === pid);
}

export function aliveFactions() {
  return Object.values(G.s.factions).filter((f) => f.alive);
}

export function facName(fid) {
  const f = G.s.factions[fid];
  return f ? f.n : { de: fid, tr: fid };
}
export function provName(pid) { return PROVINCE_BY_ID[pid].n; }
export function cityName(pid) { return PROVINCE_BY_ID[pid].city; }

// ---------- Beziehungen ----------
export function rel(a, b) {
  const k = pairKey(a, b);
  let r = G.s.rel[k];
  if (!r) {
    r = { mod: 0, war: false, warStart: 0, score: 0, trade: false, alliance: false, nap: 0, truce: 0 };
    G.s.rel[k] = r;
  }
  return r;
}
export function relPeek(a, b) { return G.s.rel[pairKey(a, b)] || null; }

export function atWar(a, b) {
  if (a === b) return false;
  if (a === 'rebels' || b === 'rebels') return true;
  const r = relPeek(a, b);
  return !!(r && r.war);
}

export function enemiesOf(fid) {
  const out = [];
  for (const f of aliveFactions()) if (f.id !== fid && atWar(fid, f.id)) out.push(f.id);
  return out;
}

export function isVassal(a) { return G.s.factions[a]?.overlord || null; }

export function allied(a, b) {
  if (a === b) return true;
  const r = relPeek(a, b);
  return !!(r && r.alliance);
}

// Darf Armee von a durch Gebiet von b ziehen?
export function hasAccess(a, b) {
  if (!b || a === b) return true;
  if (atWar(a, b)) return true;
  if (allied(a, b)) return true;
  const fa = G.s.factions[a], fb = G.s.factions[b];
  if (fa?.overlord === b || fb?.overlord === a) return true;
  return false;
}

export function opinion(a, b) {
  const fa = G.s.factions[a], fb = G.s.factions[b];
  if (!fa || !fb) return 0;
  const r = relPeek(a, b);
  let o = religionAffinity(fa.religion, fb.religion) + cultureAffinity(fa.culture, fb.culture);
  if (r) {
    o += r.mod;
    if (r.war) o -= 50;
    if (r.alliance) o += 25;
    if (r.trade) o += 10;
  }
  if (fa.overlord === b || fb.overlord === a) o += 15;
  o -= Math.min(30, (fa.infamy + fb.infamy) * 0.15);
  return clamp(Math.round(o), -100, 100);
}

// ---------- Handelsrouten ----------
export const ROUTES_BY_PROV = (() => {
  const m = {};
  for (const r of TRADE_ROUTES) for (const p of r.path) (m[p] = m[p] || []).push(r.id);
  return m;
})();

// ---------- Protokoll ----------
export function log(k, p = {}, opts = {}) {
  const s = G.s;
  s.log.push({ t: s.turn, y: s.year, se: s.season, k, p, f: opts.f || null, imp: !!opts.imp });
  if (s.log.length > 400) s.log.splice(0, s.log.length - 400);
}

// ---------- Neues Spiel ----------
export function createGame(scenarioId, playerFid, seed = Date.now() % 1e9, mapData) {
  const sc = SCENARIOS[scenarioId];
  const s = {
    v: 1, scenario: scenarioId, year: sc.year, season: 0, turn: 1, player: playerFid,
    rngState: seed, nextId: 1, factions: {}, provinces: {}, armies: {}, chars: {}, rel: {}, log: [],
    flags: {}, pending: [], gameOver: null, eventRate: 1, startYear: sc.year, observer: playerFid === null,
  };
  G.s = s;
  G.rng = new RNG(seed);
  G.map = mapData;

  // Provinzen
  for (const p of PROVINCES) {
    s.provinces[p.id] = {
      owner: null, pop: p.pop, basePop: p.pop, order: 60, buildings: {}, queue: null,
      rel: { ...p.rel }, culture: p.culture, cultProg: 0, garrison: 1, devast: 0, unrest: 0,
      siege: null, conquered: 0, recruited: 0, lastOwner: null,
    };
  }
  for (const [fid, list] of Object.entries(sc.owners)) {
    for (const pid of list) {
      if (!s.provinces[pid]) { console.warn('Unbekannte Provinz', pid); continue; }
      s.provinces[pid].owner = fid;
    }
  }
  for (const pid in s.provinces) if (!s.provinces[pid].owner) console.warn('Provinz ohne Besitzer:', pid);

  // Fraktionen
  const present = new Set(Object.keys(sc.owners));
  for (const fid of Object.keys(FACTIONS)) {
    const d = FACTIONS[fid];
    s.factions[fid] = {
      id: fid, n: d.n, color: d.color, culture: d.culture,
      religion: sc.religions?.[fid] || d.religion, gov: sc.govs?.[fid] || d.gov, succession: d.succession,
      alive: present.has(fid) || fid === 'rebels', dyn: d.dyn || d.n,
      gold: 0, horses: 0, prestige: 20, research: { cur: null, pts: 0 }, techs: [],
      capital: null, ruler: null, heir: null, vizier: null, titles: [],
      policies: { tax: 'normal', tolerance: 'normal', iqta: false },
      legitimacy: 80, warWeariness: 0, infamy: 0, overlord: null,
      holyWar: 0, govUnrest: 0, last: null, stats: { won: 0, lost: 0 },
      ai: { ...d.ai }, spawned: false, lastWarCheck: 0,
    };
  }
  const F = s.factions;
  F.rebels.alive = true;

  for (const fid of present) {
    const f = F[fid];
    const provs = factionProvinces(fid);
    const capWanted = sc.capitals?.[fid];
    f.capital = capWanted && provs.includes(capWanted) ? capWanted : provs.slice().sort((a, b) => s.provinces[b].pop - s.provinces[a].pop)[0];
    f.npc = !FACTIONS[fid].major;
    f.gold = sc.gold?.[fid] ?? Math.round(100 + provs.length * 25);
    f.horses = 60 + provs.length * 10;
    f.prestige = 20 + provs.length * 3;
    f.titles = [...(sc.titles?.[fid] || [])];
    const techs = new Set([...(sc.techs?.['*'] || []), ...(sc.techs?.[fid] || [])]);
    if (f.gov === 'nomad') techs.add('composite_bow');
    else techs.add('diwan');
    if (sc.year >= 1150 && f.gov === 'nomad') techs.add('kurultai');
    f.techs = [...techs];
  }

  for (const [v, o] of sc.vassals || []) if (F[v].alive && F[o].alive) F[v].overlord = o;
  for (const [a, b] of sc.wars || []) if (F[a].alive && F[b].alive) { const r = rel(a, b); r.war = true; r.warStart = 0; }
  for (const [a, b] of sc.alliances || []) if (F[a].alive && F[b].alive) { rel(a, b).alliance = true; }

  // Startgebäude
  for (const pid in s.provinces) initBuildings(pid);

  G.s = s;
  return s;
}

function initBuildings(pid) {
  const s = G.s, p = s.provinces[pid], d = PROVINCE_BY_ID[pid];
  const f = s.factions[p.owner];
  const b = p.buildings;
  const maxL = GOVERNMENTS[f.gov].maxBuildLevel;
  const cap = (l) => Math.min(l, maxL);
  b.walls = Math.min(3, d.walls);
  if (d.pop >= 60) b.market = cap(d.pop >= 150 ? 2 : 1);
  const majority = Object.entries(p.rel).sort((x, y) => y[1] - x[1])[0][0];
  if (majority === f.religion) b.temple = cap(d.pop >= 150 ? 2 : 1);
  if (['river', 'oasis', 'farmland'].includes(d.terrain) && d.pop >= 90) b.irrigation = 1;
  if (d.pop >= 150) b.school = cap(1);
  if (f.capital === pid) { b.palace = cap(2); b.barracks = 1; }
  if (f.gov !== 'sedentary' && ['steppe', 'desert', 'hills'].includes(d.terrain)) b.ordu = 1;
  if (f.gov !== 'nomad' && ['steppe', 'hills', 'mountain'].includes(d.terrain)) b.stables = 1;
  if (ROUTES_BY_PROV[pid] && d.pop >= 100) b.caravanserai = 1;
  if (d.port && d.pop >= 100) b.port = 1;
  if (d.pop >= 120 && !b.barracks) b.barracks = 1;
  for (const k of Object.keys(b)) if (!b[k]) delete b[k];
}

export function wallBonus(pid) {
  return Math.max(0, PROVINCE_BY_ID[pid].walls - 3);
}

export function buildingLevel(pid, bid) {
  return G.s.provinces[pid].buildings[bid] || 0;
}

export function isCoastal(pid) { return PROVINCE_BY_ID[pid].port; }

export function setOwner(pid, fid) {
  const p = G.s.provinces[pid];
  const old = p.owner;
  p.lastOwner = old;
  p.owner = fid;
  p.queue = null;
  p.siege = null;
  p.conquered = 8;
  p.garrison = 0.3;
  const f = G.s.factions[fid];
  f.everOwned = true;
  // Gebäude, die die neue Herrschaft nicht nutzen kann
  if (p.buildings.temple) {
    const major = Object.entries(p.rel).sort((x, y) => y[1] - x[1])[0][0];
    if (major !== f.religion) p.buildings.temple = Math.max(0, p.buildings.temple - 1);
    if (!p.buildings.temple) delete p.buildings.temple;
  }
  if (f.gov === 'sedentary' && p.buildings.ordu) delete p.buildings.ordu;
  const maxL = GOVERNMENTS[f.gov].maxBuildLevel;
  for (const k in p.buildings) if (p.buildings[k] > maxL && k !== 'walls') p.buildings[k] = maxL;
  if (old && G.s.factions[old] && G.s.factions[old].capital === pid) relocateCapital(old);
  if (!f.capital || G.s.provinces[f.capital]?.owner !== fid) f.capital = pid;
}

export function relocateCapital(fid) {
  const provs = factionProvinces(fid);
  const f = G.s.factions[fid];
  if (!provs.length) { f.capital = null; return; }
  provs.sort((a, b) => G.s.provinces[b].pop - G.s.provinces[a].pop);
  f.capital = provs[0];
}

// Entfernung (Anzahl Provinzen) innerhalb eigener Gebiete bzw. allgemein
export function bfsDistances(start, passable = () => true) {
  const dist = { [start]: 0 };
  const q = [start];
  while (q.length) {
    const c = q.shift();
    for (const n of neighbors(c)) {
      if (dist[n] !== undefined || !passable(n)) continue;
      dist[n] = dist[c] + 1;
      q.push(n);
    }
  }
  return dist;
}

export function buildingsList() { return Object.keys(BUILDINGS); }
