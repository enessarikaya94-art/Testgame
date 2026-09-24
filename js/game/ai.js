// Computergegner

import { G, fac, prov, pdef, chr, factionProvinces, factionArmies, armiesIn, atWar, enemiesOf, neighbors, opinion, relPeek, rel, rng, aliveFactions, log, ROUTES_BY_PROV } from './state.js';
import { getMods, buildOptions, startBuilding, techAvailable, recruitOptions, recruit, rosterFor, clearModCache } from './economy.js';
import { armyPower, garrisonPower, reach, pathFrom, moveArmy, assault, isCavalryOnly, mergeArmies, assignGeneral, effectiveWalls } from './military.js';
import { declareWar, makePeace, peaceAcceptance, proposalAcceptance, setTrade, setAlliance, makeVassal, demandTribute, tributeAmount, militaryPower, neighborsOf, warScore, truceLeft, titleClaimable, claimTitle, alliesOf } from './diplomacy.js';
import { generals, hireGeneral, hireGeneralCost, age, stat, appointVizier } from './characters.js';
import { TECHS, techCost } from '../data/techs.js';
import { UNITS, UNIT_CLASSES } from '../data/units.js';
import { FACTIONS, TITLES } from '../data/factions.js';
import { RELIGIONS, CULTURES, TERRAINS } from '../data/world.js';
import { BUILDINGS } from '../data/buildings.js';
import { clamp } from '../util.js';

export async function aiTurn(fid) {
  const f = fac(fid);
  if (!f.alive) return;
  if (fid === 'rebels') { await rebelTurn(); return; }
  aiResearch(f);
  aiPolicies(f);
  if ((G.s.turn + hash(fid)) % 2 === 0) aiDiplomacy(f);
  aiBuild(f);
  aiRecruit(f);
  await aiMilitary(f);
}

function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 7; }

// ---------- Forschung ----------
const BRANCH_PREF = { mil: 1, adm: 1, eco: 1, cul: 1 };
function aiResearch(f) {
  if (f.research.cur) return;
  const opts = Object.keys(TECHS).filter((t) => techAvailable(f.id, t));
  if (!opts.length) return;
  const pick = rng().weighted(opts, (t) => {
    const d = TECHS[t];
    let w = BRANCH_PREF[d.br] / (1 + d.tier * 0.3);
    if (d.br === 'mil') w *= 0.6 + f.ai.aggr;
    if (d.br === 'eco') w *= 0.6 + f.ai.build;
    if (t === 'ghulam' && RELIGIONS[f.religion].group !== 'islam') w = 0.05;
    if (t === 'kurultai' && CULTURES[f.culture].group !== 'steppe') w *= 0.2;
    if (t === 'turan_tactics' && CULTURES[f.culture].group !== 'steppe') w *= 0.3;
    return w;
  });
  f.research.cur = pick;
}

// ---------- Politik ----------
function aiPolicies(f) {
  const provs = factionProvinces(f.id);
  if (!provs.length) return;
  const avgOrder = provs.reduce((s, p) => s + prov(p).order, 0) / provs.length;
  const low = provs.filter((p) => prov(p).order < 30).length;
  const old = JSON.stringify(f.policies);
  if (low >= Math.max(1, provs.length * 0.25) || avgOrder < 40) f.policies.tax = 'low';
  else if (f.gold < 50 && avgOrder > 60) f.policies.tax = 'high';
  else if (avgOrder > 50) f.policies.tax = 'normal';
  if (f.techs.includes('iqta')) f.policies.iqta = f.gov !== 'nomad';
  const mixed = provs.filter((p) => (prov(p).rel[f.religion] || 0) < 0.5).length;
  f.policies.tolerance = mixed > provs.length * 0.4 ? 'tolerant' : 'normal';
  if (JSON.stringify(f.policies) !== old) clearModCache();
  // Titel
  for (const tid of Object.keys(TITLES)) {
    if (tid === 'sultan' || tid === 'caliph') continue;
    if (titleClaimable(f.id, tid).ok) claimTitle(f.id, tid);
  }
  // Regierungswechsel der Nomaden
  if (f.gov === 'nomad' && f.techs.includes('diwan')) {
    const settled = provs.filter((p) => !['steppe', 'desert'].includes(pdef(p).terrain) && prov(p).pop >= 90).length;
    if (settled >= 5 && rng().chance(0.1)) {
      f.gov = 'sultanate';
      f.govUnrest = 8;
      clearModCache();
      log('log.govChange', { fac: f.n, gov: 'sultanate' }, { f: f.id });
    }
  }
  if (f.holyWar <= 0 && f.prestige > 80 && ['islam', 'christian'].includes(RELIGIONS[f.religion].group)) {
    const infidelWar = enemiesOf(f.id).some((e) => fac(e) && RELIGIONS[fac(e).religion].group !== RELIGIONS[f.religion].group);
    if (infidelWar && rng().chance(0.2)) { f.holyWar = 8; f.prestige -= 40; }
  }
  // Wesir
  if (!f.vizier && f.gold > 400 && f.gov !== 'nomad' && factionProvinces(f.id).length >= 6 && rng().chance(0.1)) {
    appointVizier(f.id);
  }
}

// ---------- Diplomatie ----------
function aiDiplomacy(f) {
  const s = G.s;
  const me = f.id;
  const enemies = enemiesOf(me).filter((e) => e !== 'rebels');
  const myPow = militaryPower(me);
  // Frieden
  for (const e of enemies) {
    const r = relPeek(me, e);
    const dur = s.turn - (r?.warStart || 0);
    if (dur < 5) continue;
    const ws = warScore(me, e);
    const terms = {};
    if (ws > 25) { terms.gold = Math.round(Math.min(fac(e).gold * 0.5, 300)); terms.goldFrom = e; }
    else if (ws < -25 && f.gold > 80) { terms.gold = Math.round(Math.min(f.gold * 0.3, 150)); terms.goldFrom = me; }
    const myWill = peaceAcceptance(e, me, terms);
    if (myWill < -10 && dur < 20) continue;
    if (e === s.player) {
      if (!s.pending.some((x) => x.from === me && x.kind === 'peace') && rng().chance(0.35)) s.pending.push({ type: 'proposal', kind: 'peace', from: me, terms });
      continue;
    }
    if (peaceAcceptance(me, e, terms) > 0) makePeace(me, e, terms);
  }
  if (f.overlord) return;
  // Kriegserklärung
  const wars = enemiesOf(me).filter((e) => e !== 'rebels').length;
  const lastCheck = f.lastWarCheck || 0;
  const maxWars = f.ai.aggr > 0.75 ? 1 : 0;
  if (wars <= maxWars && s.turn - lastCheck >= 3 && s.turn > 2) {
    f.lastWarCheck = s.turn;
    const cands = neighborsOf(me).filter((n) => {
      const nf = fac(n);
      if (!nf || !nf.alive || n === 'rebels') return false;
      if (nf.overlord === me || f.overlord === n) return false;
      if (relPeek(me, n)?.alliance) return false;
      if (truceLeft(me, n) > 0) return false;
      return true;
    });
    let best = null, bv = 0;
    for (const n of cands) {
      const theirPow = militaryPower(n) + alliesOf(n).reduce((x, a) => x + militaryPower(a) * 0.5, 0) + (fac(n).overlord ? militaryPower(fac(n).overlord) * 0.6 : 0);
      const ratio = myPow / (theirPow + 1);
      const op = opinion(me, n);
      // Überlegenheit zählt nur bis zu einem Punkt; lohnende Ziele sind wichtiger als wehrlose
      let v = Math.min(ratio, 2.5) - (1.3 - f.ai.aggr * 0.4) - op / 120 - wars * 0.4;
      v += Math.min(0.4, factionProvinces(n).length * 0.05);
      v -= f.infamy / 80;
      if (n === s.player) v += 0.1 * f.ai.aggr;
      if (RELIGIONS[fac(n).religion].group !== RELIGIONS[f.religion].group) v += 0.15;
      const goals = FACTIONS[me]?.goals || [];
      if (goals.some((g) => g.p && g.p.some((p) => prov(p).owner === n))) v += 0.3;
      if (v > bv) { bv = v; best = n; }
    }
    if (best && f.infamy > 45 && me !== 'mongol') best = null;
    if (best) {
      // Kleine Nachbarn lieber unterwerfen als vernichten
      if (factionProvinces(best).length <= 2 && best !== s.player && proposalAcceptance('vassalize', me, best) > -25 && rng().chance(0.6)) makeVassal(best, me);
      else if (rng().chance(0.1 + f.ai.aggr * 0.4)) declareWar(me, best);
    }
  }
  // Handel & Bündnisse
  const nbs = neighborsOf(me);
  for (const n of nbs) {
    const r = relPeek(me, n);
    if (r?.trade || atWar(me, n)) continue;
    if (opinion(me, n) < 0) continue;
    if (n === s.player) {
      if (rng().chance(0.08) && !s.pending.some((x) => x.from === me)) s.pending.push({ type: 'proposal', kind: 'trade', from: me });
    } else if (proposalAcceptance('trade', me, n) > 0 && rng().chance(0.3)) setTrade(me, n, true);
  }
  // Bedrohung -> Bündnis
  const threat = nbs.filter((n) => militaryPower(n) > myPow * 1.6 && fac(n).ai.aggr > 0.55)[0];
  if (threat && rng().chance(0.25)) {
    const partner = neighborsOf(threat).filter((x) => x !== me && !atWar(x, me) && !relPeek(me, x)?.alliance && x !== 'rebels')[0];
    if (partner) {
      if (partner === s.player) {
        if (!s.pending.some((x) => x.from === me)) s.pending.push({ type: 'proposal', kind: 'alliance', from: me });
      } else if (proposalAcceptance('alliance', me, partner) > 0) setAlliance(me, partner);
    }
  }
  // Tribut von schwächeren Nachbarn
  if (rng().chance(0.06 + f.ai.aggr * 0.08)) {
    const weak = nbs.filter((n) => n !== 'rebels' && !atWar(me, n) && fac(n).overlord !== me && !(relPeek(me, n)?.tributeTurn && s.turn - relPeek(me, n).tributeTurn < 12) && militaryPower(n) * 2 < myPow)[0];
    if (weak) {
      if (weak === s.player) {
        if (!s.pending.some((x) => x.kind === 'tribute' && x.from === me)) { s.pending.push({ type: 'proposal', kind: 'tribute', from: me, amount: tributeAmount(me, weak) }); rel(me, weak).tributeTurn = s.turn; }
      } else if (proposalAcceptance('tribute', me, weak) > 0) demandTribute(me, weak);
      else { rel(me, weak).tributeTurn = s.turn; if (rng().chance(f.ai.aggr * 0.3)) declareWar(me, weak); }
    }
  }
  // Kleine Nachbarn unterwerfen
  if (factionProvinces(me).length >= 8 && rng().chance(0.1)) {
    const small = nbs.filter((n) => factionProvinces(n).length <= 2 && !fac(n).overlord && n !== 'rebels')[0];
    if (small && small !== s.player && proposalAcceptance('vassalize', me, small) > 0) makeVassal(small, me);
  }
  // Sultanstitel beim Kalifen erbitten
  if (!f.titles.includes('sultan') && titleClaimable(me, 'sultan').ok && rng().chance(0.15)) {
    if (s.player === 'abbasid') {
      if (!s.pending.some((x) => x.kind === 'sultan' && x.from === me)) s.pending.push({ type: 'proposal', kind: 'sultan', from: me });
    } else if (proposalAcceptance('sultan', me, 'abbasid') > 0) {
      f.titles.push('sultan');
      f.prestige -= 20;
      rel(me, 'abbasid').mod += 10;
      log('log.title', { fac: f.n, title: TITLES.sultan.n }, { f: me, imp: true });
    }
  }
}

// ---------- Bauen ----------
const BUILD_VALUE = {
  market: 1.3, irrigation: 1.1, temple: 0.9, school: 0.8, walls: 0.7, barracks: 0.7, stables: 0.7, ordu: 1.0, caravanserai: 0.9, workshop: 0.9, palace: 0.6, port: 0.8,
};
function aiBuild(f) {
  const provs = factionProvinces(f.id);
  const reserve = 60 + provs.length * 15;
  let budget = f.gold - reserve;
  let built = 0;
  const maxBuild = f.gold > reserve * 4 ? 4 : 2;
  if (budget < 40) return;
  const options = [];
  for (const pid of provs) {
    const p = prov(pid);
    if (p.queue || p.siege) continue;
    for (const o of buildOptions(pid)) {
      if (!o.ok) continue;
      let v = BUILD_VALUE[o.id] || 0.5;
      v *= 0.5 + p.pop / 150;
      if (o.id === 'temple' && (p.rel[f.religion] || 0) < 0.7) v *= 1.6;
      if (o.id === 'temple' && p.order < 40) v *= 1.5;
      if (o.id === 'walls') {
        const border = neighbors(pid).some((n) => prov(n).owner !== f.id);
        v *= border ? 1.4 : 0.3;
        if (enemiesOf(f.id).length) v *= 1.3;
      }
      if (o.id === 'caravanserai' && !ROUTES_BY_PROV[pid]) v *= 0.2;
      if (o.id === 'ordu' && CULTURES[f.culture].group === 'steppe') v *= 1.3;
      if (o.id === 'stables' && TERRAINS[pdef(pid).terrain].pasture >= 2.5) v *= 1.3;
      if (o.id === 'barracks' && pid === f.capital) v *= 1.5;
      if (o.id === 'palace' && pid !== f.capital) v *= 0.4;
      v *= f.ai.build + 0.5;
      v /= o.cost / 60;
      v /= o.level;
      options.push({ pid, id: o.id, cost: o.cost, v: v * rng().range(0.8, 1.2) });
    }
  }
  options.sort((a, b) => b.v - a.v);
  for (const o of options) {
    if (built >= maxBuild || o.cost > budget) continue;
    if (prov(o.pid).queue) continue;
    if (startBuilding(o.pid, o.id)) { budget -= o.cost; built++; }
  }
}

// ---------- Rekrutierung ----------
function aiRecruit(f) {
  const provs = factionProvinces(f.id);
  if (!provs.length) return;
  const armies = factionArmies(f.id);
  const units = armies.reduce((s, a) => s + a.units.length, 0);
  const enemies = enemiesOf(f.id);
  const threat = enemies.reduce((s, e) => s + (e === 'rebels' ? 0 : militaryPower(e)), 0);
  let desired = Math.round(provs.length * 1.2 + 4 + (enemies.length ? 4 : 0) + threat / 2500);
  desired = Math.min(desired, 12 + provs.length * 2);
  const rich = f.gold > 600 + provs.length * 40;
  if (rich) desired = Math.round(Math.min(desired * 1.5, 20 + provs.length * 3));
  const upkeepRoom = (f.last?.gross || 30) * 0.75 - (f.last?.upkeep || 0);
  if (units >= desired && !(enemies.length && f.gold > 400)) return;
  if (upkeepRoom < 0 && units >= provs.length && !rich) return;
  const reserve = enemies.length ? 30 : 80;
  let n = 0;
  const cand = provs.filter((p) => !prov(p).siege).sort((a, b) => {
    const score = (p) => (p === f.capital ? 3 : 0) + (prov(p).buildings.barracks || 0) + (prov(p).buildings.ordu || 0) + (prov(p).buildings.stables || 0) + (neighbors(p).some((x) => enemies.includes(prov(x).owner)) ? 2 : 0);
    return score(b) - score(a);
  });
  for (const pid of cand) {
    if (n >= (rich ? 6 : 4) || units + n >= desired) break;
    const opts = recruitOptions(f.id, pid).filter((o) => o.ok);
    if (!opts.length) continue;
    const prefer = rosterFor(f.id, pid);
    let tries = 0;
    while (tries++ < 3 && n < (rich ? 6 : 4) && units + n < desired) {
      const ok = recruitOptions(f.id, pid).filter((o) => o.ok);
      if (!ok.length) break;
      const pick = rng().weighted(ok, (o) => {
        const u = UNITS[o.id];
        let w = prefer.includes(o.id) ? 3 : 0.6;
        if (u.cls === 'siege') w = enemies.length ? 0.8 : 0.05;
        if (o.id === 'militia') w = 0.3;
        if (u.cost > f.gold - reserve) w = 0;
        return w;
      });
      if (!pick) break;
      if (recruit(f.id, pid, pick.id)) n++;
      else break;
    }
  }
  // Feldherren
  const noGen = factionArmies(f.id).filter((a) => !a.gen && a.units.length >= 4);
  for (const a of noGen) {
    const free = generals(f.id).find((c) => !c.army && c.id !== f.vizier && age(c) >= 16 && (c.id !== f.ruler || stat(c, 'mar') >= 5));
    if (free) assignGeneral(a, free.id);
    else if (f.gold > hireGeneralCost(f.id) + 150) { const g = hireGeneral(f.id); if (g) assignGeneral(a, g.id); }
  }
}

// ---------- Heere ----------
async function aiMilitary(f) {
  const s = G.s;
  const me = f.id;
  let armies = factionArmies(me).filter((a) => a.units.length);
  // Zusammenlegen
  for (const a of armies) {
    if (!s.armies[a.id]) continue;
    for (const b of armiesIn(a.prov)) {
      if (b.id !== a.id && b.fac === me && a.units.length + b.units.length <= 20 && s.armies[b.id]) mergeArmies(a, b);
    }
  }
  armies = factionArmies(me).filter((a) => a.units.length).sort((a, b) => armyPower(b) - armyPower(a));
  const enemies = enemiesOf(me);
  const warTargets = new Set(enemies);
  const myProvs = new Set(factionProvinces(me));
  const goalProvs = new Set((FACTIONS[me]?.goals || []).flatMap((g) => g.p || []));
  const claimed = {};
  for (const a of armies) {
    if (!s.armies[a.id] || a.mp <= 0) continue;
    const pow = armyPower(a);
    const hp = a.units.reduce((x, u) => x + u.hp, 0) / a.units.length;
    const r = reach(a, null, 9);
    let target = null, best = 0, action = null;
    if (warTargets.size) {
      // Feindliche Heere
      for (const e of Object.values(s.armies)) {
        if (!warTargets.has(e.fac) || !e.units.length) continue;
        const d = r.dist[e.prov];
        if (d === undefined || d > 6) continue;
        const epow = armiesIn(e.prov).filter((x) => x.fac === e.fac).reduce((x, y) => x + armyPower(y), 0);
        const ratio = pow / (epow + 1);
        const threatToMe = myProvs.has(e.prov) || neighbors(e.prov).some((n) => myProvs.has(n));
        if (ratio < 1.2 && !(threatToMe && ratio > 0.9)) continue;
        const v = (epow / 800 + 1) * (threatToMe ? 2 : 1) * Math.min(2, ratio) / (d + 1);
        if (v > best) { best = v; target = e.prov; action = 'attack'; }
      }
      // Feindliche Provinzen
      if (hp > 0.45) {
        for (const pid in r.dist) {
          const p = prov(pid);
          if (!warTargets.has(p.owner)) continue;
          const d = r.dist[pid];
          if (d > 8) continue;
          const gpow = garrisonPower(pid) + armiesIn(pid).filter((x) => x.fac === p.owner).reduce((x, y) => x + armyPower(y), 0);
          if (pow < gpow * 0.45) continue;
          let v = (20 + p.pop / 8 + (fac(p.owner).capital === pid ? 25 : 0) + (goalProvs.has(pid) ? 50 : 0)) / (d + 1.5);
          if (p.siege && p.siege.fac === me) v *= 1.6;
          if (claimed[pid]) v *= 0.4;
          if (neighbors(pid).some((n) => myProvs.has(n))) v *= 1.4;
          v *= Math.min(1.5, pow / (gpow + 1));
          if (v > best) { best = v; target = pid; action = 'siege'; }
        }
      }
    }
    if (hp < 0.45 || a.units.length < 3) {
      // Zur Auffrischung heim
      let home = null, hd = Infinity;
      for (const pid of myProvs) {
        const d = r.dist[pid];
        if (d === undefined) continue;
        const bonus = (prov(pid).buildings.barracks || 0) + (prov(pid).buildings.ordu || 0) + (prov(pid).buildings.stables || 0);
        const v = d - bonus * 0.7;
        if (v < hd) { hd = v; home = pid; }
      }
      if (home && !action) { target = home; action = 'rest'; }
      if (home && hp < 0.35) { target = home; action = 'rest'; }
    }
    if (!target) {
      // Frieden: Grenzschutz oder Hauptstadt
      if (!myProvs.has(a.prov) || rng().chance(0.1)) {
        let pick = f.capital;
        const border = [...myProvs].filter((p) => neighbors(p).some((n) => prov(n).owner !== me && prov(n).owner !== 'rebels' && fac(prov(n).owner)?.ai.aggr > 0.5));
        if (border.length && armies.indexOf(a) > 0) pick = rng().pick(border);
        if (pick && pick !== a.prov && r.dist[pick] !== undefined) { target = pick; action = 'station'; }
      }
    }
    if (target && target !== a.prov) {
      const path = pathFrom(a, r, target);
      if (path && path.length) {
        claimed[target] = true;
        await moveArmy(a, target);
      }
    }
    if (!s.armies[a.id]) continue;
    // Vor Ort: Sturm oder Plünderung
    const here = prov(a.prov);
    if (here.owner !== me && atWar(me, here.owner)) {
      const defenders = armiesIn(a.prov).filter((x) => x.fac === here.owner);
      const gpow = garrisonPower(a.prov) + defenders.reduce((x, y) => x + armyPower(y), 0);
      const hasSiege = a.units.some((u) => UNITS[u.t].cls === 'siege');
      const walls = effectiveWalls(a.prov);
      const nomadNoSiege = isCavalryOnly(a) && !hasSiege && walls >= 2;
      if (nomadNoSiege && pow < gpow * 2.5) { a.raid = true; continue; }
      a.raid = false;
      const need = hasSiege ? 1.3 : 1.8 + walls * 0.15;
      const siegeTurnsLeft = here.siege ? here.siege.needed - here.siege.turns : 99;
      if (pow > gpow * need && (siegeTurnsLeft > 1 || pow > gpow * 3)) {
        await assault(a);
      }
    } else a.raid = false;
  }
}

// ---------- Aufständische ----------
async function rebelTurn() {
  const s = G.s;
  for (const a of Object.values(s.armies)) {
    if (a.fac !== 'rebels' || !a.units.length) continue;
    const p = prov(a.prov);
    if (p.owner === 'rebels') {
      const target = neighbors(a.prov).find((n) => prov(n).owner !== 'rebels' && garrisonPower(n) < armyPower(a));
      if (target && rng().chance(0.3)) await moveArmy(a, target);
      continue;
    }
    const gpow = garrisonPower(a.prov);
    if (armyPower(a) > gpow * 1.5 && rng().chance(0.5)) await assault(a);
  }
}
