// Entdeckung der Welt: Welche Weltgegenden kennt eine Macht?
// Kontakt entsteht durch gemeinsame Grenzen, Eroberung, Krieg, Handel und Bündnisse,
// durch Forschung (Gesandtschaften, Karawanen, Weltkarte) und durch Ereignisse.

import { G, fac, prov, neighbors, relPeek, log, rng, aliveFactions } from './state.js';
import { PROV_REGION, REGION_IDS, REGIONS } from '../data/regions.js';

let silent = false;

export function regionOf(pid) { return PROV_REGION[pid] || 'orient'; }

// Aufständische und Steppenhorden kennen keine Grenzen
const omniscient = (f) => f.id === 'rebels' || f.id.startsWith('horde_');

function knownList(f) {
  if (omniscient(f)) return REGION_IDS;
  if (!f.known) {
    // Heimat: Gegend der Hauptstadt bzw. aller Provinzen
    const set = new Set();
    if (f.capital) set.add(regionOf(f.capital));
    for (const pid in G.s.provinces) if (G.s.provinces[pid].owner === f.id) set.add(regionOf(pid));
    if (!set.size) set.add('orient');
    f.known = [...set];
  }
  return f.known;
}

export function knows(fid, region) {
  if (!fid) return true; // Beobachter sieht alles
  const f = fac(fid);
  if (!f) return true;
  return knownList(f).includes(region);
}

export function knownRegions(fid) {
  if (!fid) return [...REGION_IDS];
  const f = fac(fid);
  if (!f) return [...REGION_IDS];
  return [...knownList(f)];
}

// Darf die Macht diese Provinz sehen und betreten?
export function canSee(fid, pid) { return knows(fid, regionOf(pid)); }

// Kennt die Macht die andere Macht? (mindestens eine Provinz in bekanntem Gebiet)
export function knowsFaction(fid, other) {
  if (!fid || fid === other) return true;
  const o = fac(other);
  if (!o) return false;
  if (o.capital && canSee(fid, o.capital)) return true;
  for (const pid in G.s.provinces) if (G.s.provinces[pid].owner === other && canSee(fid, pid)) return true;
  return false;
}

// Weltgegend entdecken. cause: border, war, trade, tech, event, conquest
export function discover(fid, region, cause = 'event', via = null) {
  const f = fac(fid);
  if (!f || omniscient(f)) return false;
  const list = knownList(f);
  if (region === 'all') { let any = false; for (const r of REGION_IDS) any = discover(fid, r, cause, via) || any; return any; }
  if (!REGIONS[region] || list.includes(region)) return false;
  list.push(region);
  G.s.knownVersion = (G.s.knownVersion || 0) + 1;
  if (fid === G.s.player && !G.s.observer && !silent) {
    log('log.discover', { region: REGIONS[region].n, cause: 'disc.' + cause, via: via ? fac(via)?.n : null }, { f: fid, imp: true });
    G.s.pending.push({ type: 'discovery', region, cause, via });
  }
  return true;
}

// Jede Runde: Grenzkontakte
export function processDiscovery(bordersOnly = false) {
  const s = G.s;
  for (const pid in s.provinces) {
    const o = s.provinces[pid].owner;
    if (!o || o === 'rebels') continue;
    const r = regionOf(pid);
    if (!knows(o, r)) discover(o, r, 'conquest');
    for (const n of neighbors(pid)) {
      const rn = regionOf(n);
      if (rn !== r && !knows(o, rn)) discover(o, rn, 'border');
    }
  }
  // Einmal im Jahr: Kaufleute und Verbündete bringen Kunde aus fernen Ländern
  if (bordersOnly || s.season !== 0) return;
  const alive = aliveFactions().filter((f) => f.id !== 'rebels');
  for (const f of alive) {
    const mine = knownList(f);
    if (mine.length >= REGION_IDS.length) continue;
    for (const g of alive) {
      if (g.id === f.id) continue;
      const r = relPeek(f.id, g.id);
      const link = r && !r.war && (r.trade ? 0.035 : 0) + (r.alliance ? 0.03 : 0) + (f.overlord === g.id || g.overlord === f.id ? 0.05 : 0);
      if (!link) continue;
      for (const reg of knownList(g)) {
        if (!mine.includes(reg) && rng().chance(link)) discover(f.id, reg, 'trade', g.id);
      }
    }
  }
}

// Zu Spielbeginn: Grenzkontakte ohne Meldungen
export function initDiscovery() {
  silent = true;
  try { for (const f of aliveFactions()) f.known = null; processDiscovery(true); } finally { silent = false; }
}

// Krieg: beide Seiten lernen die Heimat des Gegners kennen
export function contactByWar(a, b) {
  const fa = fac(a), fb = fac(b);
  if (!fa || !fb) return;
  if (fb.capital) discover(a, regionOf(fb.capital), 'war', b);
  if (fa.capital) discover(b, regionOf(fa.capital), 'war', a);
}

// Forschung mit Enthüllung
export function discoverByTech(fid, tech) {
  if (tech.reveal) discover(fid, tech.reveal, 'tech');
}

// Alle Mächte, die Provinzen in einer Gegend besitzen oder an sie grenzen, lernen eine andere kennen
export function revealToNeighbors(ofRegion, region, cause = 'event') {
  const s = G.s;
  const seen = new Set();
  for (const pid in s.provinces) {
    if (regionOf(pid) !== ofRegion) continue;
    const o = s.provinces[pid].owner;
    if (!o || seen.has(o)) continue;
    seen.add(o);
    discover(o, region, cause);
  }
}
