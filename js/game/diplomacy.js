// Diplomatie: Krieg, Frieden, Handel, Bündnisse, Vasallen, Titel.

import { G, fac, rel, relPeek, atWar, opinion, log, facName, factionProvinces, factionArmies, aliveFactions, neighbors, prov, provName, setOwner, rng, chr } from './state.js';
import { armyPower } from './military.js';
import { provinceIncome } from './economy.js';
import { RELIGIONS } from '../data/world.js';
import { TITLES } from '../data/factions.js';
import { clamp } from '../util.js';
import { generals, loyalty, createChar, civilWar } from './characters.js';
import { setPayment, resourceAccess } from './market.js';
import { contactByWar } from './discovery.js';
import { foreignHeld, setTownOwner, townValue, townsOf, townName } from './towns.js';

export const TRUCE_TURNS = 12;

export function militaryPower(fid) {
  const c = G.powerCache;
  if (c && c.has(fid)) return c.get(fid);
  const v = factionArmies(fid).reduce((s, a) => s + armyPower(a), 0) + factionProvinces(fid).length * 300;
  if (c) c.set(fid, v);
  return v;
}

export function borders(a, b) {
  const pa = factionProvinces(a);
  return pa.some((p) => neighbors(p).some((n) => prov(n).owner === b));
}

export function neighborsOf(fid) {
  const set = new Set();
  for (const p of factionProvinces(fid)) {
    for (const n of neighbors(p)) {
      const o = prov(n).owner;
      if (o && o !== fid && o !== 'rebels') set.add(o);
    }
    // fremde Orte in eigenen Provinzen
    for (const t of prov(p).towns || []) if (t.owner !== fid && t.owner !== 'rebels') set.add(t.owner);
  }
  // eigene Orte in fremden Provinzen
  for (const [pid] of foreignHeld(fid)) { const o = prov(pid).owner; if (o !== 'rebels') set.add(o); }
  return [...set];
}

export function alliesOf(fid) {
  return aliveFactions().filter((f) => f.id !== fid && relPeek(fid, f.id)?.alliance).map((f) => f.id);
}

export function vassalsOf(fid) {
  return aliveFactions().filter((f) => f.overlord === fid).map((f) => f.id);
}

export function warScore(a, b) {
  const r = relPeek(a, b);
  if (!r || !r.score) return 0;
  return (r.score[a] || 0) - (r.score[b] || 0);
}

export function truceLeft(a, b) {
  const r = relPeek(a, b);
  return r ? Math.max(0, (r.truce || 0) - G.s.turn) : 0;
}

// ---------- Krieg ----------
export function declareWar(a, b, opts = {}) {
  if (a === b || atWar(a, b)) return false;
  const fa = fac(a), fb = fac(b);
  const r = rel(a, b);
  const truce = truceLeft(a, b) > 0;
  const holy = fa.holyWar > 0 && RELIGIONS[fa.religion].group !== RELIGIONS[fb.religion].group;
  r.war = true; r.warStart = G.s.turn; r.score = {}; r.trade = false; r.alliance = false; r.mod -= 20;
  if (fb.overlord === a) fb.overlord = null;
  if (fa.overlord === b) { fa.overlord = null; }
  fa.infamy += holy ? 3 : fb.infamy > 50 ? 4 : 10;
  if (truce) { fa.infamy += 20; fa.prestige = Math.max(0, fa.prestige - 20); }
  log('log.war', { a: fa.n, b: fb.n }, { f: a, imp: a === G.s.player || b === G.s.player });
  contactByWar(a, b);
  // Bündnispartner und Vasallen
  for (const ally of [...alliesOf(b), ...vassalsOf(b)]) {
    if (ally === a || atWar(ally, a)) continue;
    if (ally === G.s.player) { G.s.pending.push({ type: 'callToArms', from: b, enemy: a }); continue; }
    if (vassalsOf(b).includes(ally) || opinion(ally, b) > 20 || rng().chance(0.6)) joinWar(ally, a, b);
    else breakAlliance(ally, b, true);
  }
  if (!opts.noCall) {
    for (const v of vassalsOf(a)) if (v !== b && !atWar(v, b) && v !== G.s.player) joinWar(v, b, a);
  }
  // Koalition gegen notorische Eroberer
  if (fa.infamy > 25 && a !== 'rebels') {
    for (const n of neighborsOf(a)) {
      if (n === b || n === G.s.player || atWar(n, a) || fac(n).overlord === a || relPeek(a, n)?.alliance) continue;
      const p = clamp((fa.infamy - 25) / 70, 0, 0.5) * (opinion(n, a) < 0 ? 1 : 0.35);
      if (rng().chance(p)) { joinWar(n, a, b); log('log.coalition', { a: facName(n), b: fa.n }, { f: n, imp: a === G.s.player }); }
    }
  }
  return true;
}

function joinWar(joiner, enemy, friend) {
  const r = rel(joiner, enemy);
  r.war = true; r.warStart = G.s.turn; r.score = {}; r.trade = false; r.alliance = false;
  if (fac(enemy).overlord === joiner) fac(enemy).overlord = null;
  if (fac(joiner).overlord === enemy) fac(joiner).overlord = null;
  log('log.joinWar', { a: facName(joiner), b: facName(enemy), c: facName(friend) }, { f: joiner, imp: joiner === G.s.player || enemy === G.s.player });
}

export function acceptCallToArms(joiner, friend, enemy, accept) {
  if (accept) joinWar(joiner, enemy, friend);
  else { breakAlliance(joiner, friend, true); fac(joiner).prestige = Math.max(0, fac(joiner).prestige - 15); }
}

export function makePeace(a, b, terms = {}) {
  const wsA = warScore(a, b);
  const r = rel(a, b);
  r.war = false; r.truce = G.s.turn + TRUCE_TURNS; r.score = {};
  const fa = fac(a), fb = fac(b);
  if (terms.gold) {
    const payer = fac(terms.goldFrom);
    const amount = Math.min(terms.gold, Math.max(0, Math.round(payer.gold)));
    payer.gold -= amount;
    fac(terms.goldFrom === a ? b : a).gold += amount;
  }
  for (const pid of terms.provinces || []) {
    const p = prov(pid);
    const to = p.owner === a ? b : a;
    setOwner(pid, to);
    for (const ar of Object.values(G.s.armies)) if (ar.prov === pid && ar.fac !== to) moveHome(ar);
  }
  // Enklaven: Der Sieger behält seine Orte im Land des Verlierers und erhält dessen Orte im eigenen Land zurück
  if (Math.abs(wsA) > 15) {
    const win = wsA > 0 ? a : b, lose = win === a ? b : a;
    for (const [pid, i] of [...foreignHeld(lose)]) if (prov(pid).owner === win) setTownOwner(pid, i, win);
  }
  for (const [pid, i] of terms.towns || []) {
    const t = townsOf(pid)[i];
    if (t) setTownOwner(pid, i, t.owner === a ? b : a);
  }
  if (terms.vassal) fac(terms.vassal).overlord = terms.vassal === a ? b : a;
  if (terms.pay) setPayment(terms.pay.from, terms.pay.from === a ? b : a, terms.pay.amount, terms.pay.turns);
  for (const f of [fa, fb]) f.warWeariness = Math.max(0, f.warWeariness - 10);
  // Heere in fremdem Gebiet kehren heim
  for (const ar of Object.values(G.s.armies)) {
    if ((ar.fac === a && prov(ar.prov).owner === b) || (ar.fac === b && prov(ar.prov).owner === a)) moveHome(ar);
  }
  for (const pid in G.s.provinces) {
    const p = G.s.provinces[pid];
    if (p.siege && ((p.siege.fac === a && p.owner === b) || (p.siege.fac === b && p.owner === a))) p.siege = null;
    for (const t of p.towns || []) if (t.siege && ((t.siege.fac === a && t.owner === b) || (t.siege.fac === b && t.owner === a))) t.siege = null;
  }
  log('log.peace', { a: fa.n, b: fb.n }, { f: a, imp: a === G.s.player || b === G.s.player });
}

function moveHome(ar) {
  const own = factionProvinces(ar.fac);
  if (!own.length) { delete G.s.armies[ar.id]; return; }
  const cap = fac(ar.fac).capital;
  ar.prov = own.includes(cap) ? cap : own[0];
  ar.path = []; ar.siegeOf = null; ar.raid = false;
}

// Grundleistung einer Provinz (für den Wert ihrer Orte)
export function provinceBaseFor(pid) { return provinceIncome(pid, true); }

// Ort verkaufen/kaufen/verschenken
export function tradeTown(pid, i, from, to, price = 0) {
  const t = townsOf(pid)[i];
  if (!t || t.owner !== from) return false;
  if (price) { fac(to).gold -= price; fac(from).gold += price; }
  setTownOwner(pid, i, to);
  if (!price) rel(from, to).mod += 12 + t.lvl * 4;
  log(price ? 'log.townSold' : 'log.townCeded', { town: townName(pid, i), prov: provName(pid), a: facName(from), b: facName(to), n: price }, { f: from, imp: from === G.s.player || to === G.s.player });
  return true;
}

// Bewertung eines Friedensangebots durch die KI (aus Sicht von "to")
export function peaceAcceptance(from, to, terms) {
  const ws = warScore(to, from); // positiv = "to" gewinnt
  const r = relPeek(from, to);
  const dur = G.s.turn - (r?.warStart || 0);
  const pf = militaryPower(from), pt = militaryPower(to);
  let v = -ws * 0.8 + fac(to).warWeariness * 0.8 + dur * 0.8 + (pf / (pt + 1) - 1) * 25 - 10;
  if (terms.gold) v += (terms.goldFrom === from ? 1 : -1) * terms.gold / 12;
  for (const pid of terms.provinces || []) {
    const val = 12 + prov(pid).pop / 12;
    v += prov(pid).owner === from ? val : -val * 1.4;
  }
  if (terms.pay) v += (terms.pay.from === from ? 1 : -1) * terms.pay.amount * terms.pay.turns / 14;
  if (terms.vassal === to) v -= 60;
  if (terms.vassal === from) v += 50;
  if (from === 'mongol' || to === 'mongol') v -= 10;
  return Math.round(v);
}

// ---------- Handel, Bündnis, Vasallen ----------
export function proposalAcceptance(type, from, to, extra = {}) {
  const op = opinion(from, to);
  const pf = militaryPower(from), pt = militaryPower(to);
  const ratio = pf / (pt + 1);
  const ft = fac(to);
  switch (type) {
    case 'trade': {
      // Wer Ressourcen braucht, die der andere hat, handelt gern
      const need = resourceAccess(to), give = resourceAccess(from);
      const gain = [...give.own].filter((x) => !need.own.has(x)).length;
      return op + 15 + gain * 12 - (atWar(from, to) ? 999 : 0);
    }
    case 'access': return op + 5 - (fac(from).ai.aggr * 20) - (neighborsOf(to).includes(from) ? 10 : 0) - (atWar(from, to) ? 999 : 0);
    case 'tributeTreaty': {
      if (atWar(from, to) || fac(to).overlord === from) return -999;
      return (ratio - 1.8) * 35 + op * 0.2 + (neighborsOf(to).includes(from) ? 10 : -25) - (fac(to).ai.aggr * 20);
    }
    case 'subsidy': return 60;
    case 'alliance': {
      const common = aliveFactions().some((f) => f.id !== from && f.id !== to && atWar(from, f.id) && atWar(to, f.id));
      return op - 25 + (common ? 30 : 0) + (ratio > 1 ? 10 : 0) - (ft.ai.aggr > 0.8 ? 20 : 0);
    }
    case 'nap': return op + 10 + (ratio > 1.2 ? 15 : 0);
    case 'vassalize': {
      // "to" soll Vasall von "from" werden
      if (ft.overlord) return -999;
      const n = factionProvinces(to).length;
      return (ratio - 3) * 20 + op * 0.5 - n * 3 - (fac(to).prestige / 10) + (neighborsOf(to).includes(from) ? 10 : -30);
    }
    case 'marriage': return op + 10 - (atWar(from, to) ? 999 : 0);
    case 'buyTown': {
      // "from" möchte einen Ort von "to" kaufen (Preis im Verhältnis zum Wert)
      if (atWar(from, to)) return -999;
      const { pid, i, price } = extra;
      const value = townValue(pid, i, provinceBaseFor(pid));
      const own = prov(pid).owner === to ? -30 : 10; // Orte im eigenen Land gibt man ungern her
      return (price / value - 1) * 60 + op * 0.4 + own + (ratio > 1.5 ? 10 : 0) - (townsOf(pid)[i].t === 'castle' ? 15 : 0);
    }
    case 'sellTown': {
      // "from" bietet "to" einen Ort zum Kauf an
      if (atWar(from, to)) return -999;
      const { pid, i, price } = extra;
      if (fac(to).gold < price) return -999;
      const value = townValue(pid, i, provinceBaseFor(pid));
      return (value / price - 1) * 60 + op * 0.2 + (prov(pid).owner === to ? 25 : -20);
    }
    case 'tribute': {
      // "to" soll einmalig Tribut an "from" zahlen
      if (atWar(from, to) || fac(to).overlord === from) return -999;
      return (ratio - 1.6) * 35 + op * 0.2 + (neighborsOf(to).includes(from) ? 10 : -25) - (fac(to).ai.aggr * 20);
    }
    case 'sultan': {
      // Der Kalif (to) verleiht den Sultanstitel an "from"
      return op + (fac(from).overlord === null && fac(to).overlord === from ? 60 : 0) + ratio * 5 + fac(from).prestige / 5 - 20;
    }
    default: return 0;
  }
}

export function setTrade(a, b, on) {
  const r = rel(a, b);
  r.trade = on;
  if (on) r.mod += 5;
}
export function setAlliance(a, b) {
  const r = rel(a, b);
  r.alliance = true; r.mod += 10;
}
export function breakAlliance(a, b, dishonor) {
  const r = rel(a, b);
  if (!r.alliance) return;
  r.alliance = false; r.mod -= 25;
  if (dishonor) fac(a).prestige = Math.max(0, fac(a).prestige - 10);
}
export function setNap(a, b) {
  const r = rel(a, b);
  r.nap = G.s.turn + 20; r.truce = Math.max(r.truce || 0, G.s.turn + 20); r.mod += 5;
}
export function makeVassal(vassal, overlord) {
  fac(vassal).overlord = overlord;
  const r = rel(vassal, overlord);
  r.war = false; r.mod += 10; r.truce = G.s.turn + TRUCE_TURNS;
  log('log.vassal', { a: facName(vassal), b: facName(overlord) }, { f: overlord, imp: vassal === G.s.player || overlord === G.s.player });
}
export function releaseVassal(overlord, vassal) {
  if (fac(vassal).overlord !== overlord) return;
  fac(vassal).overlord = null;
  rel(overlord, vassal).mod += 30;
}
export function giftGold(from, to, amount) {
  const f = fac(from);
  if (f.gold < amount) return false;
  f.gold -= amount;
  fac(to).gold += amount;
  rel(from, to).mod += Math.min(40, amount / 8);
  return true;
}
export function tributeAmount(from, to) {
  return Math.max(20, Math.round(Math.min(fac(to).gold * 0.4, 60 + factionProvinces(to).length * 30)));
}
export function demandTribute(from, to) {
  const n = Math.min(tributeAmount(from, to), Math.max(0, Math.round(fac(to).gold)));
  fac(to).gold -= n;
  fac(from).gold += n;
  fac(from).prestige += 3;
  rel(from, to).mod -= 20;
  rel(from, to).tributeTurn = G.s.turn;
  log('log.tribute', { a: facName(to), b: facName(from), n }, { f: from, imp: from === G.s.player || to === G.s.player });
  return n;
}

export function setAccess(a, b, on) {
  const r = rel(a, b);
  r.access = on;
  if (on) r.mod += 3; else r.mod -= 8;
}

export function marriage(a, b) {
  rel(a, b).mod += 25;
  rel(a, b).married = G.s.turn;
  fac(a).prestige += 3; fac(b).prestige += 3;
}

// Jährliche Pflege
export function processDiplomacy() {
  const s = G.s;
  // Übergroße Reiche: Emire und Atabegs machen sich in fernen Provinzen selbstständig
  for (const f of aliveFactions()) {
    if (f.id === 'rebels' || f.id === 'mongol') continue;
    const n = factionProvinces(f.id).length;
    if (n <= 30) continue;
    const risk = Math.min(0.35, (n - 30) * 0.015) * (1 - Math.min(0.5, (f.legitimacy - 50) / 100));
    if (!rng().chance(risk)) continue;
    let emir = generals(f.id).filter((c) => !c.dyn && c.id !== f.ruler && c.id !== f.vizier).sort((a, b) => loyalty(a) - loyalty(b))[0];
    if (!emir) emir = createChar(f.id, { dyn: false, role: 'general', traits: ['ambitious'] });
    const nid = civilWar(f.id, emir);
    if (nid) log('log.atabeg', { name: emir.n, fac: f.n }, { f: f.id, imp: true });
  }
  for (const k in s.rel) {
    const r = s.rel[k];
    r.mod *= 0.97;
    if (r.war) {
      const [a, b] = k.split('|');
      if (s.factions[a]?.alive) s.factions[a].warWeariness += 0.4;
      if (s.factions[b]?.alive) s.factions[b].warWeariness += 0.4;
    }
  }
  // Vasallen, die stärker werden als ihr Lehnsherr, sagen sich los
  for (const f of aliveFactions()) {
    if (!f.overlord) continue;
    const o = fac(f.overlord);
    if (!o || !o.alive) { f.overlord = null; continue; }
    if (f.id === s.player) continue;
    const ratio = militaryPower(f.id) / (militaryPower(o.id) + 1);
    if (ratio > 1.1 && opinion(f.id, o.id) < 20 && rng().chance(0.05)) {
      f.overlord = null;
      log('log.vassalFree', { a: f.n, b: o.n }, { f: f.id, imp: o.id === s.player });
      if (rng().chance(0.5) && o.id !== s.player) declareWar(o.id, f.id);
    }
  }
}

// ---------- Titel ----------
export function titleClaimable(fid, tid) {
  const f = fac(fid), t = TITLES[tid];
  if (f.titles.includes(tid)) return { ok: false, reason: 't.has' };
  if (tid === 'sultan') {
    if (f.religion !== 'sunni') return { ok: false, reason: 't.sunni' };
    const cal = fac('abbasid');
    if (!cal || !cal.alive) return { ok: false, reason: 't.noCaliph' };
    if (fid === 'abbasid') return { ok: false, reason: 't.isCaliph' };
    if (f.prestige < 60) return { ok: false, reason: 't.prestige', need: 60 };
    return { ok: true, caliph: true };
  }
  if (tid === 'caliph') return { ok: false, reason: 't.never' };
  if (tid === 'khagan' && f.culture !== 'turkic' && f.culture !== 'mongolic') return { ok: false, reason: 't.turkic' };
  if (tid === 'shahanshah' && !['persian', 'kurdish', 'turkic'].includes(f.culture)) return { ok: false, reason: 't.persian' };
  if (tid === 'basileus' && f.religion !== 'orthodox') return { ok: false, reason: 't.orthodox' };
  if (tid === 'kaiser' && f.religion !== 'catholic') return { ok: false, reason: 't.catholic' };
  if (tid === 'huangdi' && !['han', 'jurchen', 'mongolic', 'tangut', 'korean'].includes(f.culture)) return { ok: false, reason: 't.sinic' };
  const need = t.needs || [];
  const missing = need.filter((p) => prov(p).owner !== fid);
  if (missing.length) return { ok: false, reason: 't.needs', missing };
  if (f.prestige < 40) return { ok: false, reason: 't.prestige', need: 40 };
  return { ok: true };
}

export function claimTitle(fid, tid) {
  const f = fac(fid);
  const c = titleClaimable(fid, tid);
  if (!c.ok) return false;
  f.titles.push(tid);
  f.prestige -= tid === 'sultan' ? 20 : 30;
  f.legitimacy = clamp(f.legitimacy + 15, 0, 100);
  log('log.title', { fac: f.n, title: TITLES[tid].n }, { f: fid, imp: true });
  return true;
}

export function validateTitles() {
  for (const f of aliveFactions()) {
    f.titles = f.titles.filter((t) => {
      const need = TITLES[t]?.needs;
      if (!need) return true;
      return need.some((p) => prov(p).owner === f.id);
    });
    if (f.titles.includes('sultan') && f.religion !== 'sunni') f.titles = f.titles.filter((t) => t !== 'sultan');
  }
}

export function aggressiveNeighbors(fid) {
  return neighborsOf(fid).filter((n) => fac(n).ai.aggr > 0.6);
}

export function strongestEnemy(fid) {
  let best = null, bp = 0;
  for (const f of aliveFactions()) {
    if (!atWar(fid, f.id)) continue;
    const p = militaryPower(f.id);
    if (p > bp) { bp = p; best = f.id; }
  }
  return best;
}

export function rulerName(fid) { return chr(fac(fid).ruler)?.n; }
