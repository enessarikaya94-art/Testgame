// Märkte, strategische Ressourcen, Provinzschwerpunkte, Kredite und Zahlungsverträge.

import { G, fac, prov, pdef, factionProvinces, relPeek, rel, aliveFactions, rng, log, facName } from './state.js';
import { GOODS } from '../data/world.js';
import { specialtyEff } from '../data/specialties.js';
import { clamp } from '../util.js';

const d = (de, tr) => ({ de, tr });

// ---------- Strategische Ressourcen ----------
export const RESOURCES = {
  iron: { n: d('Eisen', 'Demir'), icon: '⚒', desc: d('Für schwere Reiterei und gepanzerte Infanterie.', 'Ağır süvari ve zırhlı piyade için.') },
  timber: { n: d('Bauholz', 'Kereste'), icon: '🌲', desc: d('Für Belagerungsmaschinen.', 'Kuşatma makineleri için.') },
  naphtha: { n: d('Naphtha', 'Neft'), icon: '🔥', desc: d('Für Naphtha-Werfer.', 'Neftçiler için.') },
};
export const IMPORT_SURCHARGE = 0.6;

function provinceResources(pid) {
  const out = new Set(specialtyEff(pid).resources);
  for (const g of [...pdef(pid).goods, ...(prov(pid).extraGoods || [])]) if (RESOURCES[g]) out.add(g);
  return out;
}

// Welche Ressourcen hat eine Fraktion – selbst, über Handelsabkommen oder Lehnsbande?
export function resourceAccess(fid) {
  const own = new Set();
  for (const pid of factionProvinces(fid)) for (const r of provinceResources(pid)) own.add(r);
  const viaTrade = new Set();
  const f = fac(fid);
  for (const o of aliveFactions()) {
    if (o.id === fid) continue;
    const r = relPeek(fid, o.id);
    const linked = (r && r.trade && !r.war) || o.overlord === fid || f.overlord === o.id;
    if (!linked) continue;
    for (const pid of factionProvinces(o.id)) for (const res of provinceResources(pid)) if (!own.has(res)) viaTrade.add(res);
  }
  return { own, viaTrade };
}

export function hasResource(fid, res) {
  const a = G.resCache?.[fid] || (G.resCache = G.resCache || {}, G.resCache[fid] = resourceAccess(fid));
  return a.own.has(res) || a.viaTrade.has(res);
}
export function clearResourceCache() { G.resCache = {}; }

// ---------- Marktpreise ----------
export function initMarket() {
  const s = G.s;
  s.market = {};
  s.marketBase = {};
  for (const g of Object.keys(GOODS)) { s.market[g] = 1; s.marketBase[g] = Math.max(1, supplyOf(g)); }
}

function supplyOf(g) {
  let n = 0;
  for (const pid in G.s.provinces) {
    const p = G.s.provinces[pid];
    if (p.owner === 'rebels') continue;
    if (pdef(pid).goods.includes(g) || (p.extraGoods || []).includes(g)) n += 1 - p.devast * 0.7 - (p.siege ? 0.5 : 0);
  }
  return Math.max(0.2, n);
}

// Einmal im Jahr: Angebot und Nachfrage verschieben die Preise
export function updateMarket() {
  const s = G.s;
  if (!s.market) initMarket();
  for (const g of Object.keys(GOODS)) {
    const target = clamp(Math.sqrt(s.marketBase[g] / supplyOf(g)) * rng().range(0.85, 1.15), 0.6, 1.7);
    s.market[g] = clamp(s.market[g] * 0.6 + target * 0.4, 0.55, 1.8);
  }
}

// Monopol: mind. 2 Quellen und mind. 60 % aller Quellen eines Guts
export function monopolies(fid) {
  if (!G.monoCache || !G.monoCache.__all) {
    // Ein Durchlauf für alle Mächte
    const own = {}, all = {};
    const count = (pid, g, o) => {
      all[g] = (all[g] || 0) + 1;
      const m = own[o] || (own[o] = {});
      m[g] = (m[g] || 0) + 1;
    };
    for (const pid in G.s.provinces) {
      const p = G.s.provinces[pid];
      for (const g of pdef(pid).goods) count(pid, g, p.owner);
      if (p.extraGoods) for (const g of p.extraGoods) count(pid, g, p.owner);
    }
    const cache = { __all: true };
    for (const [o, m] of Object.entries(own)) cache[o] = Object.keys(m).filter((g) => m[g] >= 2 && m[g] / all[g] >= 0.6);
    G.monoCache = cache;
  }
  return G.monoCache[fid] || [];
}
export function clearMarketCache() { G.monoCache = {}; }

export function goodPrice(fid, g) {
  const base = G.s.market?.[g] ?? 1;
  return base * (monopolies(fid).includes(g) ? 1.3 : 1);
}

// ---------- Provinzschwerpunkte ----------
export const FOCUS = {
  none: { n: d('Ausgewogen', 'Dengeli'), icon: '⚖', desc: d('Keine besondere Ausrichtung.', 'Özel bir yönelim yok.'), eff: {} },
  tax: { n: d('Steuereintreibung', 'Vergi Tahsili'), icon: '💰', desc: d('Steuern +25 %, Ordnung −6.', 'Vergi +%25, asayiş −6.'), eff: { tax: 0.25, order: -6 } },
  trade: { n: d('Handel & Handwerk', 'Ticaret ve Zanaat'), icon: '⚖', desc: d('Güter und Routen +30 %, Steuern −10 %.', 'Mallar ve yollar +%30, vergi −%10.'), eff: { goods: 0.3, route: 0.3, tax: -0.1 } },
  farm: { n: d('Landwirtschaft', 'Tarım'), icon: '🌾', desc: d('Doppeltes Wachstum, Bevölkerungsgrenze +10 %, bessere Versorgung, Steuern −10 %.', 'İki kat büyüme, nüfus sınırı +%10, daha iyi ikmal, vergi −%10.'), eff: { growthMult: 2, cap: 0.1, supply: 1, tax: -0.1 } },
  military: { n: d('Heerlager', 'Ordugâh'), icon: '⚔', desc: d('+2 Rekruten pro Runde, Anwerbung −15 %, Garnison +30 %, Steuern −20 %.', 'Tur başına +2 asker, toplama −%15, garnizon +%30, vergi −%20.'), eff: { recruit: 2, recruitCost: -0.15, garrison: 0.3, tax: -0.2 } },
  faith: { n: d('Glaubenszentrum', 'İnanç Merkezi'), icon: '✧', desc: d('Bekehrung ×2,5, Ordnung +4, Steuern −15 %.', 'Din değiştirme ×2,5, asayiş +4, vergi −%15.'), eff: { convertMult: 2.5, order: 4, tax: -0.15 } },
};

export function focusEff(pid) {
  return FOCUS[prov(pid).focus || 'none'].eff;
}

export function setFocus(pid, focus) {
  const p = prov(pid);
  if (p.focusTurn && G.s.turn - p.focusTurn < 4) return false;
  p.focus = focus;
  p.focusTurn = G.s.turn;
  return true;
}

// ---------- Kredite ----------
export const LOAN = { amount: 300, per: 30, turns: 12, max: 2 };

export function takeLoan(fid) {
  const f = fac(fid);
  f.loans = f.loans || [];
  if (f.loans.length >= LOAN.max) return false;
  f.loans.push({ left: LOAN.turns, per: LOAN.per });
  f.gold += LOAN.amount;
  return true;
}

export function loanPayments(fid) {
  return (fac(fid).loans || []).reduce((s, l) => s + l.per, 0);
}

export function processLoans(fid) {
  const f = fac(fid);
  if (!f.loans?.length) return;
  for (const l of f.loans) l.left--;
  f.loans = f.loans.filter((l) => l.left > 0);
}

// ---------- Zahlungsverträge (Tribut, Subsidien) ----------
// rel.pay = { from, to, amount, until }
export function treatyFlows(fid) {
  let inc = 0, out = 0;
  for (const k in G.s.rel) {
    const r = G.s.rel[k];
    if (!r.pay || r.war || r.pay.until <= G.s.turn) continue;
    if (r.pay.to === fid) inc += r.pay.amount;
    if (r.pay.from === fid) out += r.pay.amount;
  }
  return { inc, out };
}

export function setPayment(from, to, amount, turns) {
  const r = rel(from, to);
  r.pay = { from, to, amount, until: G.s.turn + turns };
}

export function paymentBetween(a, b) {
  const r = relPeek(a, b);
  if (!r?.pay || r.pay.until <= G.s.turn) return null;
  return r.pay;
}

export function expirePayments() {
  for (const k in G.s.rel) {
    const r = G.s.rel[k];
    if (r.pay && (r.pay.until <= G.s.turn || r.war)) {
      if (!r.war && r.pay.until <= G.s.turn) log('log.payEnd', { a: facName(r.pay.from), b: facName(r.pay.to) }, { f: r.pay.from, imp: r.pay.from === G.s.player || r.pay.to === G.s.player });
      r.pay = null;
    }
  }
}
