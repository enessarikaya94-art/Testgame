// Unerwartete Weltereignisse: Seuchen, Steppenhorden, Hungersnöte, Katastrophen und Glücksfälle.
// Die Häufigkeit lässt sich über G.s.eventRate steuern (0 = aus, 1 = normal, 2 = häufig).

import { G, fac, prov, pdef, chr, factionProvinces, factionArmies, rng, log, provName, cityName, facName, setOwner, rel, atWar, aliveFactions, neighbors, newId, ROUTES_BY_PROV } from './state.js';
import { createArmy, clearModCache } from './economy.js';
import { createChar, killChar, loyalty, generals, updateHeir } from './characters.js';
import { armySpeed, armyMen } from './military.js';
import { TERRAINS, TRADE_ROUTES, RELIGIONS } from '../data/world.js';
import { NAMES } from '../data/people.js';
import { clamp } from '../util.js';

const d = (de, tr) => ({ de, tr });

export const DISEASES = [
  { id: 'plague', n: d('die Pest', 'veba'), sev: 1.0, spread: 0.32 },
  { id: 'pox', n: d('die Pocken', 'çiçek hastalığı'), sev: 0.6, spread: 0.38 },
  { id: 'typhus', n: d('das Fleckfieber', 'tifüs'), sev: 0.7, spread: 0.28 },
];

const STEPPE_GATES = ['irtysh', 'saryarka', 'yaik', 'almaliq', 'pontic', 'sarkel', 'yengikent', 'bashkir'];

function rate() { return G.s.eventRate ?? 1; }
function mine(pid) { return prov(pid).owner === G.s.player; }

function pickWeighted(list, w) { return rng().weighted(list, w); }

// ---------- Seuchen ----------
function startEpidemic() {
  const s = G.s;
  const cands = Object.keys(s.provinces).filter((p) => !(s.provinces[p].immune > s.turn) && s.provinces[p].pop > 60);
  const origin = pickWeighted(cands, (p) => s.provinces[p].pop * (ROUTES_BY_PROV[p] ? 2 : 1));
  if (!origin) return;
  const dis = rng().pick(DISEASES);
  s.epidemics = s.epidemics || [];
  const ep = { id: newId('ep'), dis: dis.id, origin, turns: 0 };
  s.epidemics.push(ep);
  infect(origin, ep);
  log('we.epidemic', { dis: dis.n, city: cityName(origin), prov: provName(origin) }, { imp: true, f: prov(origin).owner });
}

function infect(pid, ep) {
  const p = prov(pid);
  if (p.plague || p.immune > G.s.turn) return;
  p.plague = { ep: ep.id, dis: ep.dis, left: rng().int(3, 6) };
  if (mine(pid) && ep.origin !== pid) log('we.infected', { dis: DISEASES.find((x) => x.id === ep.dis).n, prov: provName(pid) }, { imp: true, f: p.owner });
}

function processEpidemics() {
  const s = G.s;
  const newly = [];
  for (const pid in s.provinces) {
    const p = s.provinces[pid];
    if (!p.plague) continue;
    const dis = DISEASES.find((x) => x.id === p.plague.dis);
    const f = fac(p.owner);
    const med = f?.techs.includes('medicine') ? 0.55 : 1;
    const loss = 0.035 * dis.sev * med * (p.pop > 150 ? 1.3 : 1);
    p.pop = Math.max(5, p.pop * (1 - loss));
    p.order = Math.max(0, p.order - 3);
    // Heere in verseuchten Provinzen leiden mit
    for (const a of Object.values(s.armies)) if (a.prov === pid) for (const u of a.units) u.hp -= 0.05 * dis.sev * med;
    // Ausbreitung, entlang der Handelswege besonders schnell
    for (const n of neighbors(pid)) {
      const shared = (ROUTES_BY_PROV[pid] || []).some((r) => (ROUTES_BY_PROV[n] || []).includes(r));
      if (rng().chance(dis.spread * (shared ? 1.4 : 0.8) * med)) newly.push([n, p.plague.ep, p.plague.dis]);
    }
    p.plague.left--;
    if (p.plague.left <= 0) { p.plague = null; p.immune = s.turn + 60; }
  }
  for (const [n, epId, dis] of newly) infect(n, { id: epId, dis, origin: null });
  for (const a of Object.values(s.armies)) a.units = a.units.filter((u) => u.hp > 0.06);
  // Beendete Epidemien entfernen
  if (s.epidemics) s.epidemics = s.epidemics.filter((ep) => Object.values(s.provinces).some((p) => p.plague?.ep === ep.id));
}

// ---------- Steppenhorden ----------
const HORDE_TITLES = [d('Horde des {name}', '{name} Ordası'), d('Die Kumanen-Horde des {name}', '{name} Kuman Ordası'), d('Die Steppenkrieger des {name}', '{name} Bozkır Savaşçıları')];

export function spawnHorde(opts = {}) {
  const s = G.s;
  const gates = STEPPE_GATES.filter((p) => s.provinces[p] && !(s.factions[s.provinces[p].owner]?.capital === p && s.provinces[p].owner === s.player));
  const at = opts.at || rng().pick(gates);
  if (!at) return null;
  const victim = prov(at).owner;
  const mongolic = s.year > 1150 && rng().chance(0.5);
  const culture = mongolic ? 'mongolic' : 'turkic';
  const khan = rng().pick(NAMES[culture].m);
  const title = rng().pick(HORDE_TITLES);
  const fid = newId('horde_');
  s.factions[fid] = {
    id: fid, n: { de: title.de.replace('{name}', khan.de), tr: title.tr.replace('{name}', khan.tr) },
    color: mongolic ? '#4a4e69' : '#7a5c3e', culture, religion: 'tengri', gov: 'nomad', succession: 'elective', alive: true,
    dyn: { de: 'Khane', tr: 'Hanlar' }, gold: 500, horses: 800, prestige: 60, research: { cur: null, pts: 0 },
    techs: ['composite_bow', 'turan_tactics', 'lamellar', 'kurultai'], capital: at, ruler: null, heir: null, vizier: null, titles: [],
    policies: { tax: 'normal', tolerance: 'normal', iqta: false }, legitimacy: 70, warWeariness: 0, infamy: 0, overlord: null,
    holyWar: 0, govUnrest: 0, last: null, stats: { won: 0, lost: 0 }, ai: { aggr: 0.95, build: 0.2, diplo: 0.3 },
    spawned: true, lastWarCheck: 0, npc: true,
  };
  const ruler = createChar(fid, { n: khan, role: 'ruler', mar: rng().int(7, 10), traits: ['brave', 'horse_lord'] });
  s.factions[fid].ruler = ruler.id;
  createChar(fid, { born: ruler.born + 20, father: ruler.id, role: 'family' });
  updateHeir(fid);
  setOwner(at, fid);
  prov(at).conquered = 0;
  const strength = clamp(Math.round(10 + (s.year - 1000) / 25), 10, 20);
  const unitsA = mongolic ? ['mongol_ha', 'mongol_ha', 'keshig'] : ['horse_archers', 'horse_archers', 'turkmen', 'tarkhan'];
  for (const n of [strength, Math.round(strength * 0.7)]) {
    const a = createArmy(fid, at, Array.from({ length: n }, (_, i) => ({ t: unitsA[i % unitsA.length], hp: 1, xp: 1 })));
    a.mp = armySpeed(a);
    const g = createChar(fid, { dyn: false, role: 'general', mar: rng().int(6, 9), culture });
    a.gen = g.id; g.army = a.id;
  }
  // Heere des bisherigen Herrn weichen
  for (const a of Object.values(s.armies)) if (a.prov === at && a.fac !== fid) {
    const safe = neighbors(at).find((n) => prov(n).owner === a.fac);
    if (safe) a.prov = safe; else delete s.armies[a.id];
  }
  if (victim && s.factions[victim]?.alive) { const r = rel(fid, victim); r.war = true; r.warStart = s.turn; r.score = {}; }
  s.lastHorde = s.turn;
  log('we.horde', { fac: s.factions[fid].n, prov: provName(at), from: victim ? facName(victim) : '' }, { imp: true, f: fid });
  return fid;
}

// ---------- Hungersnot, Dürre, Flut, Brand ----------
function region(origin, size, filter = () => true) {
  const out = [origin];
  const q = [origin];
  while (q.length && out.length < size) {
    const c = q.shift();
    for (const n of neighbors(c)) if (!out.includes(n) && filter(n) && out.length < size) { out.push(n); q.push(n); }
  }
  return out;
}

function famine() {
  const s = G.s;
  const cands = Object.keys(s.provinces).filter((p) => TERRAINS[pdef(p).terrain].fert >= 2 && !s.provinces[p].famine);
  const origin = rng().pick(cands);
  if (!origin) return;
  const cause = rng().pick([d('Heuschreckenschwärme', 'Çekirge sürüleri'), d('Eine Missernte', 'Kıtlık yılı'), d('Eine große Dürre', 'Büyük bir kuraklık')]);
  const reg = region(origin, rng().int(2, 5), (p) => TERRAINS[pdef(p).terrain].fert >= 1);
  for (const p of reg) s.provinces[p].famine = rng().int(3, 5);
  log('we.famine', { cause, prov: provName(origin), n: reg.length }, { imp: reg.some(mine), f: prov(origin).owner });
}

function drought() {
  const s = G.s;
  const cands = Object.keys(s.provinces).filter((p) => TERRAINS[pdef(p).terrain].pasture >= 2.5);
  const origin = rng().pick(cands);
  if (!origin) return;
  const reg = region(origin, rng().int(3, 6), (p) => TERRAINS[pdef(p).terrain].pasture >= 1.5);
  const hit = new Set();
  for (const p of reg) { s.provinces[p].drought = 6; hit.add(s.provinces[p].owner); }
  for (const f of hit) if (s.factions[f]) s.factions[f].horses = Math.round(s.factions[f].horses * 0.7);
  log('we.cattlePlague', { prov: provName(origin) }, { imp: reg.some(mine), f: prov(origin).owner });
}

function flood() {
  const s = G.s;
  const cands = Object.keys(s.provinces).filter((p) => pdef(p).terrain === 'river');
  const pid = rng().pick(cands);
  if (!pid) return;
  const p = s.provinces[pid];
  p.pop *= 0.95;
  p.devast = Math.min(1, p.devast + 0.3);
  if (p.buildings.irrigation && rng().chance(0.5)) p.buildings.irrigation--;
  if (!p.buildings.irrigation) delete p.buildings.irrigation;
  log('we.flood', { prov: provName(pid) }, { imp: mine(pid), f: p.owner });
}

function fire() {
  const s = G.s;
  const cands = Object.keys(s.provinces).filter((p) => s.provinces[p].pop > 140);
  const pid = rng().pick(cands);
  if (!pid) return;
  const p = s.provinces[pid];
  const keys = Object.keys(p.buildings).filter((k) => k !== 'walls');
  if (keys.length) { const k = rng().pick(keys); p.buildings[k]--; if (!p.buildings[k]) delete p.buildings[k]; }
  p.pop *= 0.97;
  p.order = Math.max(0, p.order - 6);
  log('we.fire', { city: cityName(pid) }, { imp: mine(pid), f: p.owner });
}

// ---------- Politische Überraschungen ----------
function assassins() {
  const s = G.s;
  if (!fac('nizari')?.alive) return;
  const targets = aliveFactions().filter((f) => f.id !== 'nizari' && f.id !== 'rebels' && f.religion === 'sunni' && factionProvinces(f.id).length >= 4);
  const f = rng().pick(targets);
  if (!f) return;
  const victim = chr(f.vizier) && rng().chance(0.6) ? chr(f.vizier) : chr(f.ruler);
  if (!victim) return;
  log('we.assassin', { name: victim.n, fac: f.n }, { imp: true, f: f.id });
  killChar(victim, 'assassinated');
}

function defector() {
  const s = G.s;
  const cands = [];
  for (const a of Object.values(s.armies)) {
    const g = chr(a.gen);
    const f = fac(a.fac);
    if (!g || !f || g.id === f.ruler || a.fac === 'rebels' || a.units.length < 4) continue;
    if (loyalty(g) < 35) cands.push(a);
  }
  const a = rng().pick(cands);
  if (!a) return;
  const g = chr(a.gen), f = fac(a.fac);
  const enemy = aliveFactions().find((x) => x.id !== 'rebels' && atWar(f.id, x.id) && x.id !== f.id);
  const to = enemy ? enemy.id : 'rebels';
  log('we.defector', { name: g.n, fac: f.n, to: to === 'rebels' ? d('die Aufständischen', 'asiler') : facName(to), men: armyMen(a) }, { imp: f.id === s.player || to === s.player, f: f.id });
  a.fac = to;
  a.path = [];
  if (to === 'rebels') { g.alive = false; a.gen = null; } else g.fac = to;
}

function heresy() {
  const s = G.s;
  const cands = Object.keys(s.provinces).filter((pid) => {
    const p = s.provinces[pid], f = fac(p.owner);
    return f && p.owner !== 'rebels' && (p.rel[f.religion] || 0) < 0.4;
  });
  const pid = rng().pick(cands);
  if (!pid) return;
  const p = s.provinces[pid];
  const major = Object.entries(p.rel).sort((a, b) => b[1] - a[1])[0][0];
  p.order = Math.max(0, p.order - 25);
  p.unrest = Math.max(p.unrest, 2);
  log('we.heresy', { prov: provName(pid), rel: RELIGIONS[major].n }, { imp: mine(pid), f: p.owner });
}

function goldVein() {
  const s = G.s;
  const cands = Object.keys(s.provinces).filter((p) => ['mountain', 'hills'].includes(pdef(p).terrain) && !(s.provinces[p].extraGoods || []).length);
  const pid = rng().pick(cands);
  if (!pid) return;
  const good = rng().pick(['gold', 'silver', 'gems', 'copper']);
  s.provinces[pid].extraGoods = [good];
  log('we.vein', { prov: provName(pid), good }, { imp: mine(pid), f: s.provinces[pid].owner });
}

function tradeBoom() {
  const s = G.s;
  const r = rng().pick(TRADE_ROUTES);
  s.routeBoom = { id: r.id, until: s.turn + 12 };
  log('we.tradeBoom', { route: r.n }, { imp: r.path.some(mine) });
}

// ---------- Ablauf ----------
const TABLE = [
  { fn: startEpidemic, p: 0.012 },
  { fn: () => { if (G.s.turn - (G.s.lastHorde ?? -99) > 60) spawnHorde(); }, p: 0.0045 },
  { fn: famine, p: 0.012 },
  { fn: drought, p: 0.008 },
  { fn: flood, p: 0.008 },
  { fn: fire, p: 0.008 },
  { fn: assassins, p: 0.015 },
  { fn: defector, p: 0.008 },
  { fn: heresy, p: 0.01 },
  { fn: goldVein, p: 0.004 },
  { fn: tradeBoom, p: 0.006 },
];

export function processWorldEvents() {
  const s = G.s;
  const r = rate();
  // laufende Zustände
  for (const pid in s.provinces) {
    const p = s.provinces[pid];
    if (p.famine > 0) { p.famine--; p.pop *= 0.985; }
    if (p.drought > 0) p.drought--;
  }
  processEpidemics();
  if (s.routeBoom && s.routeBoom.until <= s.turn) s.routeBoom = null;
  if (r <= 0) return;
  for (const ev of TABLE) {
    if (rng().chance(ev.p * r)) {
      try { ev.fn(); } catch (e) { console.error('Weltereignis', e); }
    }
  }
  clearModCache();
}
