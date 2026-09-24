// Figuren, Dynastie, Erbfolge und Thronstreit.

import { G, fac, chr, newId, rng, log, factionProvinces, factionArmies, provName, bfsDistances, setOwner, rel } from './state.js';
import { NAMES, TRAITS } from '../data/people.js';
import { PROVINCE_BY_ID } from '../data/provinces.js';
import { clamp } from '../util.js';
import { FACTIONS } from '../data/factions.js';

const ADULT = 16;

export function age(c) { return G.s.year - c.born; }

export function stat(c, key) {
  if (!c) return 0;
  let v = c[key] || 0;
  for (const t of c.traits || []) v += TRAITS[t]?.[key] || 0;
  return clamp(v, 0, 12);
}

export function randomName(culture, female) {
  const pool = NAMES[culture] || NAMES.turkic;
  const list = female ? pool.f : pool.m;
  return rng().pick(list);
}

function randomTraits(n) {
  const keys = Object.keys(TRAITS);
  const out = [];
  const conflicts = [['brave', 'coward'], ['just', 'cruel'], ['greedy', 'generous'], ['sickly', 'robust'], ['loyal', 'ambitious']];
  for (let i = 0; i < 20 && out.length < n; i++) {
    const t = rng().pick(keys);
    if (out.includes(t)) continue;
    if (conflicts.some(([a, b]) => (t === a && out.includes(b)) || (t === b && out.includes(a)))) continue;
    out.push(t);
  }
  return out;
}

export function createChar(fid, o = {}) {
  const f = fac(fid);
  const culture = o.culture || f.culture;
  const female = !!o.female;
  const c = {
    id: newId('c'), fac: fid, n: o.n || randomName(culture, female), born: o.born ?? (G.s.year - rng().int(18, 40)),
    female, dyn: o.dyn !== false, father: o.father || null,
    traits: o.traits || randomTraits(rng().int(0, 2)),
    mar: o.mar ?? rng().int(2, 7), adm: o.adm ?? rng().int(2, 7), dip: o.dip ?? rng().int(2, 7),
    loyMod: o.loyalty !== undefined ? o.loyalty - 60 : 0,
    role: o.role || 'family', alive: true, army: null, culture,
  };
  G.s.chars[c.id] = c;
  return c;
}

export function loyalty(c) {
  if (!c) return 0;
  const f = fac(c.fac);
  let l = 60 + (c.loyMod || 0);
  for (const t of c.traits) l += TRAITS[t]?.loyalty || 0;
  const ruler = chr(f.ruler);
  if (ruler && ruler.traits.includes('charismatic')) l += 10;
  if (ruler) l += (stat(ruler, 'dip') - 5) * 2;
  l += (f.legitimacy - 70) * 0.3;
  if (c.role === 'general') l += 5;
  return clamp(Math.round(l), 0, 100);
}

export function dynastyMembers(fid) {
  return Object.values(G.s.chars).filter((c) => c.alive && c.fac === fid && c.dyn);
}

export function generals(fid) {
  return Object.values(G.s.chars).filter((c) => c.alive && c.fac === fid && (c.role === 'general' || (c.dyn && !c.female && age(c) >= ADULT)));
}

// Einrichtung der Herrscher zu Spielbeginn
export function setupRulers(scenario) {
  const s = G.s;
  for (const f of Object.values(s.factions)) {
    if (!f.alive || f.id === 'rebels') continue;
    const data = scenario.rulers?.[f.id];
    let ruler;
    if (data) {
      ruler = createChar(f.id, { ...data.ruler, role: 'ruler' });
      for (const m of data.family || []) createChar(f.id, { ...m, role: 'family' });
      if (data.vizier) { const v = createChar(f.id, { ...data.vizier, dyn: false, role: 'vizier', culture: 'persian' }); f.vizier = v.id; }
      if (data.general) createChar(f.id, { ...data.general, dyn: false, role: 'general' });
    } else {
      ruler = createChar(f.id, { role: 'ruler', born: s.year - rng().int(25, 55) });
      const kids = rng().int(1, 3);
      for (let i = 0; i < kids; i++) {
        createChar(f.id, { born: ruler.born + rng().int(18, 35), female: rng().chance(0.35), father: ruler.id, role: 'family' });
      }
      if (rng().chance(0.6)) createChar(f.id, { born: ruler.born + rng().int(-6, 8), role: 'family' });
    }
    f.ruler = ruler.id;
    updateHeir(f.id);
  }
}

export function updateHeir(fid) {
  const f = fac(fid);
  const ruler = chr(f.ruler);
  const cands = dynastyMembers(fid).filter((c) => c.id !== f.ruler);
  const males = cands.filter((c) => !c.female);
  const pool = males.length ? males : cands;
  if (!pool.length) { f.heir = null; return; }
  let heir;
  if (f.succession === 'primogeniture') {
    const sons = pool.filter((c) => ruler && c.father === ruler.id).sort((a, b) => a.born - b.born);
    heir = sons[0] || pool.slice().sort((a, b) => a.born - b.born)[0];
  } else if (f.succession === 'seniority') {
    const adults = pool.filter((c) => age(c) >= ADULT).sort((a, b) => a.born - b.born);
    heir = adults[0] || pool.slice().sort((a, b) => a.born - b.born)[0];
  } else {
    const adults = pool.filter((c) => age(c) >= ADULT);
    const list = adults.length ? adults : pool;
    heir = list.slice().sort((a, b) => score(b) - score(a))[0];
  }
  f.heir = heir ? heir.id : null;
  function score(c) { return stat(c, 'mar') + stat(c, 'adm') + stat(c, 'dip') + (c.traits.includes('charismatic') ? 3 : 0); }
}

function deathChance(c) {
  const a = age(c);
  let p = a < 16 ? 0.012 : a < 40 ? 0.012 : a < 50 ? 0.022 : a < 60 ? 0.045 : a < 70 ? 0.09 : a < 80 ? 0.17 : 0.32;
  if (c.traits.includes('sickly')) p *= 1.6;
  if (c.traits.includes('robust')) p *= 0.6;
  if (c.traits.includes('drunkard')) p *= 1.3;
  const f = fac(c.fac);
  if (f && f.techs.includes('medicine')) p *= 0.8;
  return p;
}

// Jede Runde (Jahreszeit)
let charIdx = { turn: -1, s: null, map: null };
function livingByFaction() {
  if (charIdx.turn !== G.s.turn || charIdx.s !== G.s) {
    const map = new Map();
    for (const c of Object.values(G.s.chars)) {
      if (!c.alive) continue;
      let l = map.get(c.fac);
      if (!l) { l = []; map.set(c.fac, l); }
      l.push(c);
    }
    charIdx = { turn: G.s.turn, s: G.s, map };
  }
  return charIdx.map;
}

export function processCharacters(fid) {
  const f = fac(fid);
  const members = (livingByFaction().get(fid) || []).filter((c) => c.alive && c.fac === fid);
  for (const c of members) {
    c.loyMod = (c.loyMod || 0) * 0.98;
    if (rng().chance(deathChance(c) / 4)) killChar(c, 'natural');
  }
  // Geburten einmal im Jahr (Frühling)
  if (G.s.season === 0) {
    const dyn = dynastyMembers(fid);
    if (dyn.length < 12) {
      for (const c of dyn) {
        if (c.female) continue;
        const a = age(c);
        if (a < 18 || a > 55) continue;
        if (rng().chance(a < 40 ? 0.22 : 0.1)) {
          const female = rng().chance(0.45);
          const child = createChar(fid, { born: G.s.year, female, father: c.id, role: 'family', mar: rng().int(1, 8), adm: rng().int(1, 8), dip: rng().int(1, 8) });
          if (c.id === f.ruler && fid === G.s.player) log('log.birth', { name: child.n, father: c.n, female }, { f: fid });
        }
      }
    }
    updateHeir(fid);
  }
  if (!chr(f.ruler)?.alive) succession(fid);
}

export function killChar(c, cause) {
  if (!c.alive) return;
  c.alive = false;
  c.died = G.s.year;
  c.cause = cause;
  const f = fac(c.fac);
  if (c.army && G.s.armies[c.army]) G.s.armies[c.army].gen = null;
  c.army = null;
  if (f.vizier === c.id) f.vizier = null;
  if (f.ruler === c.id) {
    if (c.fac === G.s.player || f.id === G.s.player) log('log.rulerDied', { name: c.n, cause }, { f: f.id, imp: true });
    succession(f.id);
  } else if (f.heir === c.id) {
    updateHeir(f.id);
  }
}

export function succession(fid) {
  const f = fac(fid);
  if (!f.alive) return;
  const old = chr(f.ruler);
  updateHeir(fid);
  let heir = chr(f.heir);
  let usurped = false;
  if (!heir) {
    heir = createChar(fid, { role: 'ruler', born: G.s.year - rng().int(25, 45) });
    usurped = true;
  }
  heir.role = 'ruler';
  if (old) old.pastRuler = true;
  if (heir.army && G.s.armies[heir.army]) { /* bleibt Feldherr */ }
  f.ruler = heir.id;
  const minor = age(heir) < ADULT;
  const base = { primogeniture: 85, seniority: 70, elective: 75 }[f.succession] || 70;
  const mods = f.techs.includes('historiography') ? 8 : 0;
  f.legitimacy = clamp(base + mods - (minor ? 20 : 0) - (usurped ? 30 : 0), 10, 100);
  f.prestige = Math.round(f.prestige * 0.85);
  updateHeir(fid);
  if (fid === G.s.player || FACTIONS[fid]?.major) {
    log('log.succession', { fac: f.n, name: heir.n, minor }, { f: fid, imp: fid === G.s.player });
  }
  // Thronstreit
  const provs = factionProvinces(fid);
  if (provs.length >= 6 && (f.succession === 'seniority' || f.succession === 'elective' || minor)) {
    const claimants = dynastyMembers(fid).filter((c) => c.id !== heir.id && !c.female && age(c) >= ADULT && loyalty(c) < 50);
    const reduce = (f.techs.includes('atabeg') ? 0.3 : 0) + (f.techs.includes('historiography') ? 0.15 : 0);
    const risk = clamp((0.12 + provs.length * 0.012) * (f.succession === 'elective' ? 0.5 : 1) * (1 - reduce), 0, 0.5);
    if (claimants.length && rng().chance(risk)) {
      const claimant = claimants.sort((a, b) => loyalty(a) - loyalty(b))[0];
      civilWar(fid, claimant);
    }
  }
}

// Ein Prinz spaltet einen Teil des Reiches ab
export function civilWar(fid, claimant) {
  const s = G.s;
  const f = fac(fid);
  const provs = factionProvinces(fid).filter((p) => p !== f.capital);
  if (provs.length < 3) return null;
  const dist = bfsDistances(f.capital, (p) => s.provinces[p].owner === fid);
  const base = provs.slice().sort((a, b) => (dist[b] ?? 99) - (dist[a] ?? 99))[0];
  const take = Math.max(2, Math.round(provs.length / 3));
  const region = [base];
  const q = [base];
  while (q.length && region.length < take) {
    const c = q.shift();
    for (const n of G.map.provIndex[c].neighbors) {
      if (region.length >= take) break;
      if (s.provinces[n].owner === fid && n !== f.capital && !region.includes(n)) { region.push(n); q.push(n); }
    }
  }
  const nid = newId('split_');
  const d = PROVINCE_BY_ID[base];
  s.factions[nid] = {
    ...JSON.parse(JSON.stringify(f)), id: nid,
    n: { de: `${f.dyn.de} von ${d.city.de}`, tr: `${f.dyn.tr} (${d.city.tr})` },
    color: shiftColor(f.color), gold: Math.round(f.gold * 0.3), horses: Math.round(f.horses * 0.3), prestige: Math.round(f.prestige * 0.4),
    capital: base, ruler: claimant.id, heir: null, vizier: null, titles: [], overlord: null, spawned: true, legitimacy: 55,
    stats: { won: 0, lost: 0 }, research: { cur: null, pts: 0 }, last: null,
  };
  f.gold = Math.round(f.gold * 0.7);
  claimant.fac = nid; claimant.role = 'ruler';
  // Kinder des Prätendenten folgen ihm
  for (const c of Object.values(s.chars)) if (c.alive && c.father === claimant.id) c.fac = nid;
  for (const pid of region) setOwner(pid, nid);
  for (const pid of region) s.provinces[pid].conquered = 0;
  for (const a of factionArmies(fid)) {
    if (region.includes(a.prov) && (!a.gen || chr(a.gen)?.id === claimant.id || rng().chance(0.5))) {
      if (a.gen && chr(a.gen) && chr(a.gen).id !== f.ruler) chr(a.gen).fac = nid;
      a.fac = nid;
    }
  }
  if (claimant.army && s.armies[claimant.army]) s.armies[claimant.army].fac = nid;
  const r = rel(fid, nid);
  r.war = true; r.warStart = s.turn; r.mod = -30;
  updateHeir(nid);
  log('log.civilWar', { name: claimant.n, fac: f.n, newFac: s.factions[nid].n, prov: provName(base) }, { f: fid, imp: true });
  return nid;
}

function shiftColor(hex) {
  const h = hex.replace('#', '');
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const out = c.map((v, i) => clamp(Math.round(v * 0.75 + (i === 1 ? 40 : 20)), 0, 255));
  return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function hireGeneralCost(fid) {
  const n = generals(fid).filter((c) => c.role === 'general').length;
  return 60 + n * 30;
}

export function hireGeneral(fid) {
  const f = fac(fid);
  const cost = hireGeneralCost(fid);
  if (f.gold < cost) return null;
  f.gold -= cost;
  const culture = f.culture;
  const c = createChar(fid, { dyn: false, role: 'general', culture, born: G.s.year - rng().int(22, 40), mar: rng().int(4, 8), adm: rng().int(1, 6) });
  return c;
}

export function appointVizier(fid) {
  const f = fac(fid);
  const cost = 120;
  if (f.gold < cost) return null;
  f.gold -= cost;
  const v = createChar(fid, { dyn: false, role: 'vizier', culture: f.culture === 'turkic' ? 'persian' : f.culture, born: G.s.year - rng().int(30, 50), adm: rng().int(5, 9), dip: rng().int(3, 8), mar: rng().int(1, 4) });
  if (f.vizier && chr(f.vizier)) chr(f.vizier).role = 'general';
  f.vizier = v.id;
  return v;
}
