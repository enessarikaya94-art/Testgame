// Lehnswesen: Vasallen sind nützlich, aber teuer zu halten.
// Jeder Vasall hat eine Treue (0–100). Sie hängt von Macht und Ansehen des Lehnsherrn, gemeinsamem Glauben,
// der Tributlast, der Zahl der Vasallen (Lehnsgrenze) und davon ab, ob der Lehnsherr seine Schutzpflicht erfüllt.
// Untreue Vasallen zahlen weniger, verweigern die Heerfolge und sagen sich schließlich los – oft gemeinsam.

import { G, fac, factionProvinces, aliveFactions, opinion, rel, log, facName, rng, atWar } from './state.js';
import { RELIGIONS, CULTURES } from '../data/world.js';
import { clamp } from '../util.js';

export const TRIBUTE_RATES = { low: 0.08, normal: 0.15, high: 0.25 };
export const ANNEX_MIN_TURNS = 32;
export const ANNEX_MIN_LOYALTY = 65;

let powerFn = null;
// militaryPower lebt in diplomacy.js; um Kreisimporte zu vermeiden, wird es dort registriert
export function registerPower(fn) { powerFn = fn; }
const power = (fid) => (powerFn ? powerFn(fid) : 1);

export function vassalsOf(fid) {
  return aliveFactions().filter((f) => f.overlord === fid).map((f) => f.id);
}

// Wie viele Vasallen kann ein Reich halten, ohne dass die Treue aller leidet?
export function vassalCap(fid) {
  const f = fac(fid);
  if (!f) return 0;
  let cap = 1 + Math.floor(factionProvinces(fid).length / 6);
  if (f.titles?.length) cap += 1;
  if (f.gov === 'nomad') cap += 1; // Steppenbünde leben von Gefolgschaft
  if (f.prestige > 250) cap += 1;
  return Math.min(cap, 6);
}

export function tributeRate(vassal) {
  const v = fac(vassal);
  return TRIBUTE_RATES[v.vassalTax || 'normal'];
}

// Bestandteile der Treue eines Vasallen
export function loyaltyParts(vid) {
  const v = fac(vid), o = fac(v.overlord);
  if (!o) return [];
  const parts = [];
  const add = (k, n) => { if (Math.abs(n) >= 0.5) parts.push([k, Math.round(n)]); };
  add('loy.base', 36);
  add('loy.opinion', clamp(opinion(vid, o.id) * 0.35, -20, 20));
  const ratio = power(o.id) / (power(vid) + 1);
  add('loy.power', clamp((ratio - 3) * 4, -25, 10));
  const sameRel = RELIGIONS[v.religion].group === RELIGIONS[o.religion].group;
  add('loy.religion', sameRel ? 6 : -14);
  if (CULTURES[v.culture]?.group === CULTURES[o.culture]?.group) add('loy.culture', 5);
  add('loy.prestige', clamp(o.prestige / 40, 0, 6));
  add('loy.tax', v.vassalTax === 'low' ? 10 : v.vassalTax === 'high' ? -18 : 0);
  add('loy.size', -Math.max(0, factionProvinces(vid).length - 1) * 3);
  const n = vassalsOf(o.id).length, cap = vassalCap(o.id);
  if (n > cap) add('loy.overCap', -(n - cap) * 5);
  add('loy.years', Math.min(8, (G.s.turn - (v.vassalSince ?? G.s.turn)) / 12));
  if (v.protectMod) add('loy.protect', v.protectMod);
  if (o.infamy > 30) add('loy.infamy', -Math.min(15, (o.infamy - 30) / 3));
  return parts;
}

export function loyaltyTarget(vid) {
  return clamp(loyaltyParts(vid).reduce((s, [, n]) => s + n, 0), 0, 100);
}

export function loyaltyOf(vid) {
  const v = fac(vid);
  return v.loyalty ?? loyaltyTarget(vid);
}

// Ab welcher Treue folgt der Vasall in den Krieg?
export const followsToWar = (vid) => loyaltyOf(vid) >= 35;

export function initVassal(vid, oid) {
  const v = fac(vid);
  v.overlord = oid;
  v.vassalSince = G.s.turn;
  v.vassalTax = v.vassalTax || 'normal';
  v.protectMod = 0;
  v.loyalty = null;
  v.loyalty = clamp(loyaltyTarget(vid) - 10, 0, 100); // frisch Unterworfene sind misstrauisch
  // Untervasallen werden frei: Nur der unmittelbare Herr bindet
  for (const sub of vassalsOf(vid)) {
    fac(sub).overlord = null;
    log('log.vassalFree', { a: fac(sub).n, b: v.n }, { f: sub, imp: sub === G.s.player || vid === G.s.player });
  }
}

export function clearVassal(v) {
  v.overlord = null;
  v.loyalty = null;
  v.vassalSince = null;
  v.protectMod = 0;
}

// Eingliederung eines treuen Vasallen ins Reich
export function annexCost(oid, vid) {
  return 40 + factionProvinces(vid).length * 70;
}

export function canAnnex(oid, vid) {
  const v = fac(vid), o = fac(oid);
  if (!v || v.overlord !== oid) return { ok: false, reason: 'annex.notVassal' };
  const turns = G.s.turn - (v.vassalSince ?? G.s.turn);
  if (turns < ANNEX_MIN_TURNS) return { ok: false, reason: 'annex.tooSoon', n: ANNEX_MIN_TURNS - turns };
  if (loyaltyOf(vid) < ANNEX_MIN_LOYALTY) return { ok: false, reason: 'annex.loyalty', n: ANNEX_MIN_LOYALTY };
  if (aliveFactions().some((f) => f.id !== oid && atWar(vid, f.id) && f.id !== 'rebels')) return { ok: false, reason: 'annex.war' };
  const cost = annexCost(oid, vid);
  if (o.gold < cost) return { ok: false, reason: 'annex.gold', cost };
  return { ok: true, cost };
}

// Die eigentliche Übergabe erledigt diplomacy.js (setOwner, Heere, Figuren); hier nur Kosten und Folgen
export function annexEffects(oid, vid) {
  const o = fac(oid);
  const n = factionProvinces(vid).length;
  o.gold -= annexCost(oid, vid);
  o.infamy += 2 + n * 2;
  // Andere Vasallen fürchten dasselbe Schicksal
  for (const other of vassalsOf(oid)) if (other !== vid) fac(other).protectMod = (fac(other).protectMod || 0) - 8;
}

// Schutzpflicht: Wurde ein Vasall angegriffen, erwartet er Hilfe
export function protectionAnswered(vid, helped) {
  const v = fac(vid);
  if (!v?.overlord) return;
  const o = fac(v.overlord);
  if (helped) { v.protectMod = Math.min(15, (v.protectMod || 0) + 10); return; }
  v.protectMod = (v.protectMod || 0) - 25;
  o.prestige = Math.max(0, o.prestige - 15);
  // Die anderen Vasallen sehen zu
  for (const other of vassalsOf(o.id)) if (other !== vid) fac(other).protectMod = (fac(other).protectMod || 0) - 10;
  log('log.protectFail', { a: o.n, b: v.n }, { f: o.id, imp: o.id === G.s.player || vid === G.s.player });
}

// Jede Runde: Treue anpassen, Abfall und Aufstände
export function processVassals(declareWar, joinWarFn) {
  const s = G.s;
  const risers = new Map();
  for (const v of aliveFactions()) {
    if (!v.overlord) continue;
    const o = fac(v.overlord);
    if (!o || !o.alive) { clearVassal(v); continue; }
    if (v.vassalSince == null) v.vassalSince = s.turn;
    v.protectMod = (v.protectMod || 0) * 0.96;
    const target = loyaltyTarget(v.id);
    v.loyalty = clamp((v.loyalty ?? target) + (target - (v.loyalty ?? target)) * 0.15, 0, 100);
    if (v.id === s.player) continue;
    // Abfall
    if (v.loyalty < 20 && rng().chance(0.06 + (20 - v.loyalty) * 0.006)) {
      if (!risers.has(o.id)) risers.set(o.id, []);
      risers.get(o.id).push(v.id);
    }
  }
  for (const [oid, list] of risers) {
    const o = fac(oid);
    const leader = list[0];
    // Weitere untreue Vasallen schließen sich an
    const allies = vassalsOf(oid).filter((x) => x !== leader && x !== s.player && loyaltyOf(x) < 35);
    for (const vid of [leader, ...allies]) {
      const v = fac(vid);
      clearVassal(v);
      v.loyalty = null;
      log('log.vassalRevolt', { a: v.n, b: o.n }, { f: vid, imp: oid === s.player });
    }
    declareWar(leader, oid, { noCall: true });
    for (const vid of allies) if (!atWar(vid, oid)) joinWarFn(vid, oid, leader);
    rel(leader, oid).mod -= 20;
    if (allies.length) log('log.vassalUprising', { b: o.n, n: allies.length + 1 }, { f: oid, imp: oid === s.player });
  }
}

export const facNameOf = facName;
