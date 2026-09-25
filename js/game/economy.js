// Wirtschaft, Ordnung, Bevölkerung, Religion, Bauen, Forschung, Rekrutierung.

import { G, fac, prov, pdef, chr, factionProvinces, factionArmies, armiesIn, atWar, neighbors, ROUTES_BY_PROV, relPeek, log, newId, provName, bfsDistances, staticDistances, rng, setOwner, rel, bumpAlive } from './state.js';
import { TERRAINS, GOODS, TRADE_ROUTES, GOVERNMENTS, RELIGIONS, CULTURES } from '../data/world.js';
import { BUILDINGS } from '../data/buildings.js';
import { TECHS, techCost } from '../data/techs.js';
import { UNITS, CULTURE_ARMY } from '../data/units.js';
import { TITLES } from '../data/factions.js';
import { stat } from './characters.js';
import { TRAITS } from '../data/people.js';
import { clamp } from '../util.js';
import { specialtyEff } from '../data/specialties.js';
import { discoverByTech, knows } from './discovery.js';
import { townsOf, townContribution, townOrder, foreignHeld, setTownOwner, controlOf } from './towns.js';
import { CONTROL, TOWN_TYPES, townName as townNameOf } from '../data/towns.js';
import { focusEff, goodPrice, hasResource, IMPORT_SURCHARGE, loanPayments, processLoans, treatyFlows, clearResourceCache, clearMarketCache } from './market.js';

export const UPKEEP_SCALE = 2;
const MINING_GOODS = ['iron', 'copper', 'silver', 'gold', 'gems', 'jade'];
const ROUTE_BY_ID = Object.fromEntries(TRADE_ROUTES.map((r) => [r.id, r]));

// ---------- Modifikatoren ----------
const modCache = new Map();
export function clearModCache() { modCache.clear(); clearResourceCache(); clearMarketCache(); }

export function getMods(fid) {
  if (modCache.has(fid)) return modCache.get(fid);
  const f = fac(fid);
  const m = {
    tax: 0, trade: 0, route: 0, goods: 0, research: 0, horses: 0, order: 0, steppeOrder: 0, buildCost: 0, convert: 0,
    ranged: 0, cavDef: 0, charge: 0, feigned: 0, assault: 0, garrison: 0, distance: 0, growth: 0, upkeep: 0, income: 0,
    prestige: 0, health: 0, vizier: 0, succession: 0, mining: 0,
  };
  for (const t of f.techs) {
    const tm = TECHS[t]?.mods || {};
    for (const k in tm) m[k] = (m[k] || 0) + tm[k];
  }
  const pol = f.policies;
  if (pol.tax === 'low') { m.tax -= 0.25; m.order += 10; }
  if (pol.tax === 'high') { m.tax += 0.3; m.order -= 12; }
  if (pol.iqta && f.techs.includes('iqta')) { m.upkeep -= 0.3; m.tax -= 0.1; m.order += 3; }
  const ruler = chr(f.ruler);
  if (ruler) {
    m.tax += (stat(ruler, 'adm') - 5) * 0.02;
    m.order += (stat(ruler, 'adm') - 5) * 0.6;
    m.prestige += Math.max(0, stat(ruler, 'dip') - 5) * 0.2;
    for (const t of ruler.traits) {
      if (TRAITS[t]?.buildCost) m.buildCost -= 0.1;
      if (TRAITS[t]?.prestige) m.prestige += TRAITS[t].prestige;
      if (TRAITS[t]?.research) m.research += 0.1;
      if (TRAITS[t]?.horses) m.horses += 0.15;
    }
    if (ruler.traits.includes('just')) m.order += 3;
    if (ruler.traits.includes('cruel')) m.order -= 2;
    if (ruler.traits.includes('greedy')) m.tax += 0.05;
  }
  const viz = chr(f.vizier);
  if (viz && viz.alive) {
    const vm = 1 + m.vizier;
    m.tax += stat(viz, 'adm') * 0.012 * vm;
    m.order += (stat(viz, 'adm') / 3) * vm;
  }
  for (const t of f.titles) m.prestige += TITLES[t]?.prestige || 0;
  m.order += (f.legitimacy - 60) / 10;
  modCache.set(fid, m);
  return m;
}

// ---------- Ordnung ----------
export function religionShare(p, religion) {
  let share = p.rel[religion] || 0;
  const g = RELIGIONS[religion].group;
  for (const r in p.rel) if (r !== religion && RELIGIONS[r].group === g) share += p.rel[r] * 0.5;
  return Math.min(1, share);
}

export function orderBreakdown(pid) {
  const p = prov(pid), d = pdef(pid), f = fac(p.owner);
  const m = getMods(f.id);
  const b = p.buildings;
  const parts = [];
  const add = (k, v) => { if (Math.abs(v) >= 0.5) parts.push([k, v]); };
  add('ord.base', 45);
  add('ord.mods', m.order);
  add('ord.buildings', Math.min(12, (b.temple || 0) * 3 + (b.palace || 0) * 4 + (b.walls || 0) + (b.school || 0) + ((CULTURES[p.culture].group === 'steppe') ? (b.ordu || 0) * 2 : 0)));
  const se = specialtyEff(pid), fe = focusEff(pid);
  add('ord.special', se.order || 0);
  add('ord.focus', fe.order || 0);
  const to = townOrder(pid);
  add('ord.towns', to.towns);
  add('ord.control', to.control);
  add('ord.divided', to.divided);
  if (p.plague) add('ord.plague', -10);
  if (p.famine > 0) add('ord.famine', -12);
  const own = armiesIn(pid).filter((a) => a.fac === f.id).length;
  add('ord.army', Math.min(12, own * 4));
  const tolF = { tolerant: 0.55, normal: 1, strict: 1.3 }[f.policies.tolerance];
  add('ord.religion', -(1 - religionShare(p, f.religion)) * 25 * tolF);
  if (p.culture !== f.culture) {
    const sameGroup = CULTURES[p.culture].group === CULTURES[f.culture].group;
    add('ord.culture', sameGroup ? -4 : -12);
  }
  const steppe = CULTURES[p.culture].group === 'steppe';
  if (f.gov === 'nomad') add('ord.nomad', steppe ? 8 : -6);
  if (steppe) add('ord.steppe', m.steppeOrder);
  if (f.capital) {
    const dist = G.distCache?.[f.id]?.[pid] ?? 6;
    add('ord.distance', -Math.min(25, dist * 2) * (1 + m.distance) * (1 - (b.palace || 0) * 0.3));
  }
  add('ord.conquest', -p.conquered * 2.5);
  add('ord.devastation', -p.devast * 20);
  add('ord.warWeariness', -f.warWeariness * 0.3);
  if (f.govUnrest > 0 && steppe) add('ord.govChange', -12);
  let title = 0;
  if (f.titles.includes('sultan') && (p.rel.sunni || 0) > 0.5) title += 5;
  if (f.titles.includes('khagan') && p.culture === 'turkic') title += 5;
  if (f.titles.includes('shahanshah') && p.culture === 'persian') title += 5;
  add('ord.titles', title);
  const nprov = factionProvinces(f.id).length;
  add('ord.overextension', -Math.max(0, nprov - 15) * 0.8 - Math.max(0, nprov - 25) * 0.7);
  if (f.holyWar > 0) add('ord.holyWar', 3);
  const total = parts.reduce((s, x) => s + x[1], 0);
  return { parts, total: clamp(total, 0, 100) };
}

export function computeDistances() {
  G.distCache = {};
  for (const f of Object.values(G.s.factions)) {
    if (!f.alive || !f.capital) continue;
    G.distCache[f.id] = staticDistances(f.capital);
  }
}

// ---------- Einkommen ----------
// baseOnly: Grundleistung der Provinz ohne ihre Orte (Grundlage für die Anteile der Orte)
export function provinceIncome(pid, baseOnly = false) {
  const p = prov(pid), d = pdef(pid), f = fac(p.owner);
  const gov = GOVERNMENTS[f.gov];
  const m = getMods(f.id);
  const b = p.buildings;
  const ordF = 0.4 + (p.order / 100) * 0.8;
  const dev = 1 - p.devast * 0.7;
  const besieged = p.siege ? 0.2 : 1;
  const steppeLand = ['steppe', 'desert'].includes(d.terrain);
  const govTax = steppeLand ? Math.max(gov.taxMult, 0.9) : gov.taxMult;
  const bTax = BUILDINGS.market.eff.tax * (b.market || 0) + BUILDINGS.irrigation.eff.tax * (b.irrigation || 0)
    + BUILDINGS.workshop.eff.tax * (b.workshop || 0) + BUILDINGS.palace.eff.tax * (b.palace || 0);
  const crisis = (p.famine > 0 ? 0.6 : 1) * (p.plague ? 0.75 : 1);
  const se = specialtyEff(pid), fe = focusEff(pid);
  const tax = crisis * p.pop * 0.032 * govTax * (1 + m.tax + bTax + (se.tax || 0) + (fe.tax || 0)) * ordF * dev * besieged
    + ((se.flat || 0) * ordF * dev * besieged);

  const nTrade = G.tradeCount?.[f.id] || 0;
  const tradeF = (1 + Math.min(0.5, nTrade * 0.08)) * (1 + m.trade + (b.market || 0) * BUILDINGS.market.eff.trade + (b.port || 0) * BUILDINGS.port.eff.trade);
  let goods = 0;
  for (const g of [...d.goods, ...(p.extraGoods || [])]) {
    let v = GOODS[g].value * goodPrice(f.id, g) * (1 + m.goods + (b.workshop || 0) * BUILDINGS.workshop.eff.goods + (b.caravanserai || 0) * BUILDINGS.caravanserai.eff.goods + (b.port || 0) * BUILDINGS.port.eff.goods + (se.goods || 0) + (fe.goods || 0));
    if (MINING_GOODS.includes(g)) v *= 1 + m.mining;
    goods += v;
  }
  goods *= 0.6 * tradeF * ordF * dev * besieged;

  let route = 0;
  for (const rid of ROUTES_BY_PROV[pid] || []) {
    const r = ROUTE_BY_ID[rid];
    const i = r.path.indexOf(pid);
    let safety = 1;
    for (const j of [i - 1, i + 1]) {
      const q = r.path[j];
      if (!q) continue;
      const qo = G.s.provinces[q].owner;
      if (qo !== f.id && atWar(f.id, qo)) safety -= 0.35;
      if (G.s.provinces[q].siege) safety -= 0.15;
    }
    const boom = G.s.routeBoom?.id === rid ? 1.6 : 1;
    route += boom * r.value * (1 + m.route + (b.caravanserai || 0) * BUILDINGS.caravanserai.eff.route + (se.route || 0) + (fe.route || 0)) * Math.max(0.2, safety) * (p.plague ? 0.6 : 1);
  }
  route *= 0.6 * tradeF * dev * besieged;

  const pasture = TERRAINS[d.terrain].pasture * (1 + (b.ordu || 0) * BUILDINGS.ordu.eff.pasture) * (1 - p.devast) * (p.drought > 0 ? 0.45 : 1);
  const pastureGold = pasture * gov.pastureGold * 1.4;
  const horses = (pasture * gov.horsesMult * 0.6 + (se.horses || 0)) * (1 + m.horses) + (b.stables || 0) * 1.5 + (b.ordu || 0) * 1;
  const research = ([0, 0.75, 1.25, 2][b.school || 0] + (se.research || 0) * ordF) * (1 + m.research) * gov.researchMult;
  const base = { tax, goods, route, pasture: pastureGold, horses, research };
  const tw = p.towns || [];
  if (baseOnly || !tw.length) return { ...base, towns: 0, prestige: 0, control: tw.length ? 'full' : 'none' };
  // Orte der Provinz: eigene tragen bei, fremde spalten das Land
  let foreign = 0;
  const add = { tax: 0, goods: 0, route: 0, pasture: 0, flat: 0, horses: 0, research: 0, prestige: 0, gold: 0 };
  tw.forEach((t, i) => {
    if (t.owner !== p.owner) { foreign++; return; }
    const c = townContribution(pid, i, base);
    for (const k in add) add[k] += c[k] || 0;
  });
  const f1 = foreign ? Math.max(0.6, 1 - CONTROL.dividedLoss * foreign) : 1 + CONTROL.bonus;
  return {
    tax: tax * f1 + add.tax + add.flat, goods: goods * f1 + add.goods, route: route * f1 + add.route, pasture: pastureGold * f1 + add.pasture,
    horses: horses + add.horses, research: research + add.research,
    towns: add.gold, prestige: add.prestige, control: foreign ? 'divided' : 'full', foreign,
  };
}

// Einnahmen aus Orten in fremden Provinzen (Enklaven)
export function enclaveIncome(fid) {
  const out = { gold: 0, horses: 0, research: 0, prestige: 0, n: 0 };
  for (const [pid, i] of foreignHeld(fid)) {
    const base = provinceIncome(pid, true);
    const c = townContribution(pid, i, base);
    out.gold += c.gold * 0.8 + base.tax * 0.04;
    out.horses += c.horses; out.research += c.research; out.prestige += c.prestige;
    out.n++;
  }
  return out;
}

export function factionIncome(fid) {
  const f = fac(fid);
  const m = getMods(fid);
  const r = { tax: 0, goods: 0, route: 0, pasture: 0, horses: 0, research: 1.5, tribute: 0, upkeep: 0, tributePaid: 0, admin: 0 };
  r.towns = 0; r.townPrestige = 0;
  for (const pid of factionProvinces(fid)) {
    const pi = provinceIncome(pid);
    r.tax += pi.tax; r.goods += pi.goods; r.route += pi.route; r.pasture += pi.pasture; r.horses += pi.horses; r.research += pi.research;
    r.towns += pi.towns || 0; r.townPrestige += pi.prestige || 0;
  }
  // Enklaven in fremden Provinzen
  const en = enclaveIncome(fid);
  r.enclaves = en.gold; r.nEnclaves = en.n;
  r.tax += en.gold; r.horses += en.horses; r.research += en.research; r.townPrestige += en.prestige;
  const mult = 1 + m.income;
  r.tax *= mult; r.goods *= mult; r.route *= mult; r.pasture *= mult;
  const gross = r.tax + r.goods + r.route + r.pasture;
  // Tribut
  if (f.overlord && fac(f.overlord)?.alive) r.tributePaid = gross * 0.15;
  for (const v of Object.values(G.s.factions)) {
    if (v.alive && v.overlord === fid && v.last) r.tribute += v.last.tributePaid || 0;
  }
  const gov = GOVERNMENTS[f.gov];
  let up = 0;
  for (const a of factionArmies(fid)) for (const u of a.units) up += UNITS[u.t].upkeep;
  r.upkeep = up * UPKEEP_SCALE * gov.upkeepMult * (1 + m.upkeep);
  // Hof und Verwaltung: wächst mit Reichsgröße und Bauten
  const provs = factionProvinces(fid);
  let levels = 0;
  for (const pid of provs) for (const k in G.s.provinces[pid].buildings) levels += G.s.provinces[pid].buildings[k];
  r.admin = levels * ADMIN_PER_LEVEL + Math.pow(provs.length, 1.3) * 0.5;
  // Große Schatzkammern verleiten zu Verschwendung und Unterschlagung
  // Prunk des Hofes wächst mit dem Reichtum
  r.admin += courtCost(gross);
  const cap = 800 + provs.length * 60;
  const g = fac(fid).gold;
  if (g > cap) r.admin += (Math.min(g, cap * 2) - cap) * 0.15 + Math.max(0, g - cap * 2) * 0.3;
  r.research *= (1 + m.research) * gov.researchMult;
  // Kredite und Zahlungsverträge
  r.loans = loanPayments(fid);
  const tf = treatyFlows(fid);
  r.payIn = tf.inc; r.payOut = tf.out;
  // Futter für die Reiterei
  let cav = 0;
  for (const a of factionArmies(fid)) for (const u of a.units) if (['ha', 'lc', 'hc', 'camel'].includes(UNITS[u.t].cls)) cav++;
  r.fodder = cav * (f.gov === 'nomad' ? 0.1 : f.gov === 'sultanate' ? 0.2 : 0.3);
  r.horsesNet = r.horses - r.fodder;
  r.net = gross + r.tribute - r.tributePaid - r.upkeep - r.admin - r.loans + r.payIn - r.payOut;
  r.gross = gross;
  return r;
}

// ---------- Rundenverarbeitung je Fraktion ----------
export function processEconomy(fid) {
  const f = fac(fid);
  const inc = factionIncome(fid);
  f.last = inc;
  f.prestige += inc.townPrestige || 0;
  f.gold += inc.net;
  f.horses = Math.min(f.horses + inc.horsesNet, 400 + factionProvinces(fid).length * 60);
  if (f.horses < 0) {
    // Ohne Futter verlieren die Reiter ihre Pferde
    f.horses = 0;
    for (const a of factionArmies(fid)) for (const u of a.units) if (['ha', 'lc', 'hc'].includes(UNITS[u.t].cls)) u.hp = Math.max(0.05, u.hp - 0.05);
    if (fid === G.s.player) log('log.noFodder', {}, { f: fid, imp: true });
  }
  processLoans(fid);
  for (const pid of factionProvinces(fid)) f.prestige += (specialtyEff(pid).prestige || 0) * 0.5;
  const m = getMods(fid);
  f.prestige = Math.max(0, f.prestige * 0.99 + m.prestige * 0.5 + 0.2);
  if (f.gold < 0) {
    // Soldrückstand: Moral und Ordnung sinken, Truppen desertieren
    f.warWeariness += 2;
    if (f.gold < -100) {
      const armies = factionArmies(fid);
      if (armies.length) {
        const a = rng().pick(armies);
        if (a.units.length) {
          a.units.splice(rng().int(0, a.units.length - 1), 1);
          if (fid === G.s.player) log('log.desertion', { army: a.name || '' }, { f: fid, imp: true });
        }
      }
    }
  }
  // Forschung
  if (f.research.cur && TECHS[f.research.cur] && !f.techs.includes(f.research.cur)) {
    f.research.pts += inc.research;
    const cost = techCost(TECHS[f.research.cur], f.techs.length);
    if (f.research.pts >= cost) {
      f.research.pts -= cost;
      f.techs.push(f.research.cur);
      if (fid === G.s.player) log('log.techDone', { tech: TECHS[f.research.cur].n }, { f: fid, imp: true });
      discoverByTech(fid, TECHS[f.research.cur]);
      f.research.cur = null;
      clearModCache();
    }
  } else {
    f.research.pts += inc.research * 0.5;
  }
  f.warWeariness = Math.max(0, f.warWeariness * 0.97 - 0.2);
  f.infamy = Math.max(0, f.infamy - 0.8);
  if (f.govUnrest > 0) f.govUnrest--;
  if (f.holyWar > 0) f.holyWar--;
  f.legitimacy = clamp(f.legitimacy + 0.3, 0, 100);

  for (const pid of factionProvinces(fid)) processProvince(pid);
}

function processProvince(pid) {
  const p = prov(pid), d = pdef(pid), f = fac(p.owner);
  const m = getMods(f.id);
  const b = p.buildings;
  // Ordnung
  const target = orderBreakdown(pid).total;
  p.order = clamp(p.order + (target - p.order) * 0.3, 0, 100);
  if (p.conquered > 0) p.conquered--;
  p.devast = Math.max(0, p.devast - 0.05);
  // Garnison erholt sich
  p.garrison = Math.min(1, p.garrison + (p.siege ? 0 : 0.15));
  // Bevölkerung
  const se = specialtyEff(pid), fe = focusEff(pid);
  const cap = popCap(pid);
  const growth = (0.003 + TERRAINS[d.terrain].fert * 0.0008 + (b.irrigation || 0) * BUILDINGS.irrigation.eff.growth + m.growth + (se.growth || 0)) * (fe.growthMult || 1);
  if (p.pop < cap) p.pop += p.pop * growth * (1 - p.pop / cap) * 4 * (1 - p.devast);
  else p.pop -= (p.pop - cap) * 0.02;
  if (p.siege) p.pop *= 0.985;
  p.pop = Math.max(5, p.pop);
  // Religion
  const tolF = { tolerant: 0.5, normal: 1, strict: 1.8 }[f.policies.tolerance];
  let rate = (0.002 + (b.temple || 0) * 0.003) * (1 + m.convert) * tolF;
  if (RELIGIONS[f.religion].group === 'pagan') rate *= 0.4;
  if (f.religion === 'sunni' && (p.rel.tengri || 0) > 0 && f.techs.includes('sufi')) rate *= 1.5;
  rate *= (se.convert || 1) * (fe.convertMult || 1);
  convertProvince(p, f.religion, rate);
  // Kultur
  if (p.culture !== f.culture) {
    let prog = 0.12;
    const pastoral = TERRAINS[d.terrain].pasture >= 2.5;
    if (f.culture === 'turkic' && f.gov !== 'sedentary' && pastoral) prog += 0.9;
    if (f.culture === 'turkic' && pastoral) prog += 0.3;
    if (b.ordu) prog += 0.3;
    if (f.culture === 'turkic') prog += se.turkify || 0;
    if (p.culture === 'turkic' || p.culture === 'mongolic') prog *= 0.5;
    p.cultProg = (p.cultProg || 0) + prog;
    if (p.cultProg >= 100) {
      const oldC = p.culture;
      p.culture = f.culture;
      p.cultProg = 0;
      if (f.id === G.s.player) log('log.cultureChange', { prov: provName(pid), from: CULTURES[oldC].n, to: CULTURES[f.culture].n }, { f: f.id });
    }
  } else p.cultProg = 0;
  // Bau
  if (p.queue) {
    p.queue.turns--;
    if (p.queue.turns <= 0) {
      b[p.queue.b] = p.queue.l;
      if (f.id === G.s.player) log('log.built', { prov: provName(pid), b: p.queue.b, l: p.queue.l, rel: f.religion }, { f: f.id });
      p.queue = null;
    }
  }
  p.recruited = 0;
  // Aufstände
  if (p.order < 20) p.unrest++;
  else if (p.order >= 30) p.unrest = 0;
}

export function convertProvince(p, religion, rate) {
  const cur = p.rel[religion] || 0;
  if (cur >= 0.999) return;
  let moved = 0;
  for (const r in p.rel) {
    if (r === religion) continue;
    const take = p.rel[r] * rate;
    p.rel[r] -= take;
    moved += take;
    if (p.rel[r] < 0.005) { moved += p.rel[r]; delete p.rel[r]; }
  }
  p.rel[religion] = cur + moved;
}

// Prunk des Hofes: gestaffelt nach Bruttoeinnahmen (15 % ab 250, 25 % ab 600, 35 % ab 1000)
export function courtCost(gross) {
  return Math.max(0, Math.min(gross, 600) - 250) * 0.15 + Math.max(0, Math.min(gross, 1000) - 600) * 0.25 + Math.max(0, gross - 1000) * 0.35;
}
export function courtRate(gross) { return gross > 1000 ? 0.35 : gross > 600 ? 0.25 : gross > 250 ? 0.15 : 0; }

// Verwaltungskosten je Gebäudestufe (Gold pro Runde)
export const ADMIN_PER_LEVEL = 0.2;

// Bevölkerungsgrenze einer Provinz
export function popCap(pid) {
  const p = prov(pid), b = p.buildings;
  const se = specialtyEff(pid), fe = focusEff(pid);
  return p.basePop * (1.2 + (b.irrigation || 0) * BUILDINGS.irrigation.eff.cap + (b.market || 0) * BUILDINGS.market.eff.cap + (se.cap || 0) + (fe.cap || 0));
}

// ---------- Bauen ----------
export function buildOptions(pid) {
  const p = prov(pid), d = pdef(pid), f = fac(p.owner);
  const gov = GOVERNMENTS[f.gov];
  const m = getMods(f.id);
  const out = [];
  for (const [bid, bd] of Object.entries(BUILDINGS)) {
    const cur = p.buildings[bid] || 0;
    const next = cur + 1;
    const o = { id: bid, level: next, cur, ok: true, reason: null };
    if (cur >= 3) { o.ok = false; o.reason = 'b.max'; }
    else if (bd.portOnly && !d.port) { o.ok = false; o.reason = 'b.port'; }
    else if (bd.govs && !bd.govs.includes(f.gov)) { o.ok = false; o.reason = 'b.gov'; }
    else if (bid !== 'walls' && next > gov.maxBuildLevel) { o.ok = false; o.reason = 'b.nomad'; }
    else if (bd.tech[next - 1] && !f.techs.includes(bd.tech[next - 1])) { o.ok = false; o.reason = 'b.tech'; o.tech = bd.tech[next - 1]; }
    if (cur >= 3) o.level = 3;
    o.cost = Math.round(bd.cost[Math.min(2, next - 1)] * (1 + m.buildCost));
    o.turns = bd.turns[Math.min(2, next - 1)];
    if (o.ok && p.queue) { o.ok = false; o.reason = 'b.busy'; }
    if (o.ok && f.gold < o.cost) { o.ok = false; o.reason = 'b.gold'; }
    if (o.ok && p.siege) { o.ok = false; o.reason = 'b.siege'; }
    if (bd.portOnly && !d.port) continue;
    if (bd.govs && !bd.govs.includes(f.gov) && !cur) continue;
    out.push(o);
  }
  return out;
}

export function startBuilding(pid, bid) {
  const o = buildOptions(pid).find((x) => x.id === bid);
  if (!o || !o.ok) return false;
  const p = prov(pid), f = fac(p.owner);
  f.gold -= o.cost;
  p.queue = { b: bid, l: o.level, turns: o.turns, total: o.turns };
  return true;
}

// ---------- Forschung ----------
export function techAvailable(fid, tid) {
  const f = fac(fid), t = TECHS[tid];
  if (f.techs.includes(tid)) return false;
  if (t.minYear && G.s.year < t.minYear) return false;
  if (t.reqRegion && !knows(fid, t.reqRegion)) return false;
  return t.req.every((r) => f.techs.includes(r));
}

// ---------- Rekrutierung ----------
// Kosten einer Einheit in einer Provinz (regionale Rabatte, Importaufschlag für fehlende Ressourcen)
export function unitCost(fid, pid, uid) {
  const u = UNITS[uid];
  const se = specialtyEff(pid), fe = focusEff(pid);
  let mult = 1 + (se.recruitCost || 0) + (fe.recruitCost || 0);
  if (se.units.includes(uid) && uid === 'ghulam') mult -= 0.1;
  const missing = (u.needs || []).filter((r) => !hasResource(fid, r));
  if (missing.length) mult += IMPORT_SURCHARGE;
  const cls = UNITS[uid].cls;
  const xpc = se.xp || {};
  const xp = Math.min(3, (xpc.all || 0) + (['ha', 'lc', 'hc', 'camel'].includes(cls) ? xpc.cav || 0 : 0) + (['arch', 'ha'].includes(cls) ? xpc.ranged || 0 : 0) + (['inf', 'spear'].includes(cls) ? xpc.inf || 0 : 0));
  return { gold: Math.round(u.cost * Math.max(0.5, mult)), horses: u.horses, missing, xp };
}

export function recruitOptions(fid, pid) {
  const f = fac(fid), p = prov(pid);
  const se = specialtyEff(pid);
  const out = [];
  for (const [uid, u] of Object.entries(UNITS)) {
    const o = { id: uid, ok: true, reason: null };
    const local = se.units.includes(uid);
    if (u.local && !local) continue;
    if (u.factions && !u.factions.includes(fid)) continue;
    if (!local && u.cultures.length && !u.cultures.includes(f.culture) && !u.cultures.includes(p.culture)) continue;
    if (u.relGroup && RELIGIONS[f.religion].group !== u.relGroup) continue;
    const c = unitCost(fid, pid, uid);
    o.cost = c.gold; o.missing = c.missing; o.xp = c.xp; o.local = local;
    if (u.req && !local) {
      const okMain = (p.buildings[u.req.b] || 0) >= u.req.l;
      const okAlt = u.req.alt && (p.buildings[u.req.alt.b] || 0) >= u.req.alt.l;
      if (!okMain && !okAlt) { o.ok = false; o.reason = 'r.building'; o.need = u.req; }
    }
    if (u.tech && !f.techs.includes(u.tech) && !local) { o.ok = false; o.reason = 'r.tech'; o.tech = u.tech; }
    if (o.ok && f.gold < o.cost) { o.ok = false; o.reason = 'r.gold'; }
    if (o.ok && f.horses < u.horses) { o.ok = false; o.reason = 'r.horses'; }
    if (o.ok && p.siege) { o.ok = false; o.reason = 'r.siege'; }
    if (o.ok && p.recruited >= recruitLimit(pid)) { o.ok = false; o.reason = 'r.limit'; }
    out.push(o);
  }
  return out;
}

export function recruitLimit(pid) {
  const p = prov(pid);
  const castles = (p.towns || []).filter((t) => t.owner === p.owner && TOWN_TYPES[t.t].eff.recruit).length;
  return 1 + (p.buildings.barracks || 0) + (p.buildings.ordu || 0) + (p.pop >= 150 ? 1 : 0) + (focusEff(pid).recruit || 0) + castles;
}

export function recruit(fid, pid, uid) {
  const o = recruitOptions(fid, pid).find((x) => x.id === uid);
  if (!o || !o.ok) return null;
  const f = fac(fid), p = prov(pid), u = UNITS[uid];
  f.gold -= o.cost;
  f.horses -= u.horses;
  p.recruited++;
  let a = armiesIn(pid).find((x) => x.fac === fid && x.units.length < 20);
  if (!a) a = createArmy(fid, pid, []);
  a.units.push({ t: uid, hp: 0.6, xp: o.xp || 0 });
  a.mp = Math.min(a.mp, 0);
  return a;
}

export function createArmy(fid, pid, units, gen = null) {
  const id = newId('a');
  const a = { id, fac: fid, prov: pid, units, gen, mp: 0, path: [], raid: false };
  G.s.armies[id] = a;
  if (gen && G.s.chars[gen]) G.s.chars[gen].army = id;
  return a;
}

// Truppen für Startheere / KI
export function rosterFor(fid, pid) {
  const f = fac(fid), p = prov(pid);
  const pref = [...(CULTURE_ARMY[f.culture] || CULTURE_ARMY.turkic)];
  if (p && p.culture !== f.culture) pref.push(...(CULTURE_ARMY[p.culture] || []).slice(0, 2));
  if (p) pref.push(...specialtyEff(pid).units, ...specialtyEff(pid).units);
  return pref.filter((uid) => {
    const u = UNITS[uid];
    if (u.factions && !u.factions.includes(fid)) return false;
    if (u.relGroup && RELIGIONS[f.religion].group !== u.relGroup) return false;
    if (u.cultures.length && !u.cultures.includes(f.culture) && !(p && u.cultures.includes(p.culture))) return false;
    return true;
  });
}

// ---------- Aufständische ----------
export function processRebellions() {
  const s = G.s;
  for (const pid in s.provinces) {
    const p = s.provinces[pid];
    if (p.owner === 'rebels') {
      p.rebelTurns = (p.rebelTurns || 0) + 1;
      if (p.rebelTurns >= 4 && !Object.values(s.armies).some((a) => a.prov === pid && a.fac !== 'rebels')) independence(pid);
      continue;
    }
    // Aufständische Orte kehren bei guter Ordnung zurück
    for (let i = 0; i < (p.towns || []).length; i++) {
      const t = p.towns[i];
      if (t.owner === 'rebels' && !t.siege && p.order > 55 && rng().chance(0.15)) setTownOwner(pid, i, p.owner, 'transfer');
    }
    if (p.unrest >= 3 && rng().chance(0.35)) {
      p.unrest = 0;
      const n = clamp(Math.round(p.pop / 45) + 2, 2, 10);
      const f = fac(p.owner);
      const pool = [...(CULTURE_ARMY[p.culture] || ['militia']), 'militia', 'militia'];
      const units = [];
      for (let i = 0; i < n; i++) units.push({ t: rng().pick(pool).replace('keshig', 'mongol_ha').replace('varangian', 'skutatoi'), hp: 0.8, xp: 0 });
      createArmy('rebels', pid, units);
      log('log.revolt', { prov: provName(pid), fac: f.n }, { f: p.owner, imp: p.owner === s.player });
      // Ein Ort schließt sich den Aufständischen an
      const own = (p.towns || []).map((t, i) => [t, i]).filter(([t]) => t.owner === p.owner);
      if (own.length && rng().chance(0.5)) {
        const [, i] = rng().pick(own);
        setTownOwner(pid, i, 'rebels', 'revolt');
        log('log.townRevolt', { town: townNameOf(pid, i), prov: provName(pid) }, { f: p.owner, imp: p.owner === s.player });
      }
    }
  }
}

function independence(pid) {
  const s = G.s;
  const p = s.provinces[pid], d = pdef(pid);
  const fid = newId('ind_');
  const cult = p.culture;
  const rel = Object.entries(p.rel).sort((a, b) => b[1] - a[1])[0][0];
  const kind = { turkic: ['Beylik', 'Beyliği'], mongolic: ['Ulus', 'Ulusu'], persian: ['Emirat', 'Emirliği'], kurdish: ['Emirat', 'Emirliği'], arab: ['Emirat', 'Emirliği'], greek: ['Despotat', 'Despotluğu'] }[cult] || ['Fürstentum', 'Prensliği'];
  s.factions[fid] = {
    id: fid, n: { de: `${kind[0]} ${d.n.de}`, tr: `${d.n.tr} ${kind[1]}` }, color: randomColor(), culture: cult, religion: rel,
    gov: cult === 'turkic' || cult === 'mongolic' ? 'sultanate' : 'sedentary', succession: 'seniority', alive: true, dyn: d.n,
    gold: 80, horses: 40, prestige: 10, research: { cur: null, pts: 0 }, techs: ['diwan'], capital: pid, ruler: null, heir: null, vizier: null,
    titles: [], policies: { tax: 'normal', tolerance: 'normal', iqta: false }, legitimacy: 50, warWeariness: 0, infamy: 0, overlord: null,
    holyWar: 0, govUnrest: 0, last: null, stats: { won: 0, lost: 0 }, ai: { aggr: 0.3, build: 0.6, diplo: 0.6 }, spawned: true, lastWarCheck: 0,
  };
  setOwner(pid, fid);
  p.conquered = 0; p.order = 50; p.unrest = 0; p.rebelTurns = 0;
  for (const a of Object.values(s.armies)) if (a.fac === 'rebels' && a.prov === pid) a.fac = fid;
  s.pendingRulers = s.pendingRulers || [];
  s.pendingRulers.push(fid);
  log('log.independence', { prov: provName(pid), fac: s.factions[fid].n }, { f: fid });
}

function randomColor() {
  const h = rng().int(0, 359);
  const sat = 45, l = 45;
  const a = (sat / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n) => { const k = (n + h / 30) % 12; const c = l / 100 - a * Math.max(Math.min(k - 3, 9 - k, 1), -1); return Math.round(255 * c).toString(16).padStart(2, '0'); };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function countTrade() {
  G.tradeCount = {};
  for (const k in G.s.rel) {
    const r = G.s.rel[k];
    if (!r.trade || r.war) continue;
    const [a, b] = k.split('|');
    G.tradeCount[a] = (G.tradeCount[a] || 0) + 1;
    G.tradeCount[b] = (G.tradeCount[b] || 0) + 1;
  }
}
