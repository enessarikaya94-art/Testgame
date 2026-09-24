// Schlachten mit Taktikwahl.

import { G, fac, prov, pdef, chr, armiesIn, rel, log, provName, facName, rng, wallBonus, atWar, neighbors, hasAccess } from './state.js';
import { UNITS, UNIT_CLASSES, CULTURE_ARMY } from '../data/units.js';
import { TERRAINS, RELIGIONS, CULTURES } from '../data/world.js';
import { getMods } from './economy.js';
import { stat, killChar } from './characters.js';
import { clamp } from '../util.js';

export const TACTICS = {
  frontal: {
    n: { de: 'Frontalangriff', tr: 'Cephe Taarruzu' }, icon: '⚔',
    desc: { de: 'Geschlossener Angriff mit voller Wucht. Stark gegen Pfeilhagel, anfällig für vorgetäuschte Flucht und Hinterhalt.', tr: 'Tüm gücüyle toplu hücum. Ok yağmuruna karşı güçlü, sahte ricat ve pusuya karşı savunmasız.' },
  },
  feigned: {
    n: { de: 'Vorgetäuschte Flucht', tr: 'Sahte Ricat (Turan Taktiği)' }, icon: '🏹',
    desc: { de: 'Die Reiter fliehen scheinbar, locken den Feind aus der Ordnung und kehren um. Verheerend gegen Frontalangriffe, wirkungslos gegen eine feste Verteidigungsstellung. Braucht viele leichte Reiter.', tr: 'Süvariler kaçıyormuş gibi yapar, düşmanı düzeninden çıkarır ve geri döner. Cephe taarruzuna karşı yıkıcı, sağlam savunma düzenine karşı etkisiz. Çok sayıda hafif süvari gerektirir.' },
  },
  encircle: {
    n: { de: 'Umzingelung', tr: 'Kuşatma Manevrası (Hilal)' }, icon: '◠',
    desc: { de: 'Die Flügel umfassen den Gegner. Stark gegen Verteidigungsstellungen und Pfeilhagel, riskant gegen Hinterhalte. Braucht überlegene Reiterei.', tr: 'Kanatlar düşmanı sarar. Savunma düzenine ve ok yağmuruna karşı güçlü, pusuya karşı riskli. Üstün süvari gerektirir.' },
  },
  volley: {
    n: { de: 'Pfeilhagel', tr: 'Ok Yağmuru' }, icon: '➶',
    desc: { de: 'Auf Abstand bleiben und den Feind mit Pfeilen zermürben. Stark gegen Verteidigungsstellungen, schwach gegen entschlossene Angriffe. Braucht viele Schützen.', tr: 'Mesafeyi koruyup düşmanı oklarla yıpratmak. Savunma düzenine karşı güçlü, kararlı hücumlara karşı zayıf. Çok sayıda okçu gerektirir.' },
  },
  defend: {
    n: { de: 'Verteidigungsstellung', tr: 'Savunma Düzeni' }, icon: '🛡',
    desc: { de: 'Schildwall, Wagenburg oder Anhöhe halten. Stark gegen Frontalangriff und Flucht-Finten, schwach gegen Pfeilhagel und Umzingelung.', tr: 'Kalkan duvarı, araba siperi ya da tepe tutmak. Cephe taarruzuna ve sahte ricate karşı güçlü, ok yağmuruna ve kuşatmaya karşı zayıf.' },
  },
  ambush: {
    n: { de: 'Hinterhalt', tr: 'Pusu' }, icon: '🌲',
    desc: { de: 'Truppen im Gelände verbergen und aus der Deckung zuschlagen. Nur in Wald, Hügeln oder Gebirge. Stark gegen Frontalangriff und Umzingelung.', tr: 'Birlikleri arazide gizleyip siperden vurmak. Yalnızca orman, tepe veya dağlarda. Cephe taarruzuna ve kuşatmaya karşı güçlü.' },
  },
  retreat: {
    n: { de: 'Rückzug', tr: 'Geri Çekilme' }, icon: '↩',
    desc: { de: 'Der Schlacht ausweichen. Schnelle Heere entkommen leichter. Kostet Ansehen und einige Nachzügler.', tr: 'Savaştan kaçınmak. Hızlı ordular daha kolay kurtulur. İtibar ve bazı geride kalanlar kaybedilir.' },
  },
};

// Zeile = eigene Taktik, Spalte = gegnerische Taktik
const MATRIX = {
  frontal:  { frontal: 1.0, feigned: 0.72, encircle: 0.92, volley: 1.25, defend: 0.85, ambush: 0.8 },
  feigned:  { frontal: 1.38, feigned: 1.0, encircle: 0.95, volley: 1.1, defend: 0.78, ambush: 1.0 },
  encircle: { frontal: 1.08, feigned: 1.05, encircle: 1.0, volley: 1.15, defend: 1.25, ambush: 0.8 },
  volley:   { frontal: 0.82, feigned: 0.95, encircle: 0.88, volley: 1.0, defend: 1.22, ambush: 0.92 },
  defend:   { frontal: 1.18, feigned: 1.2, encircle: 0.82, volley: 0.84, defend: 1.0, ambush: 1.08 },
  ambush:   { frontal: 1.28, feigned: 1.0, encircle: 1.18, volley: 1.08, defend: 0.9, ambush: 1.0 },
};

export function garrisonUnits(pid) {
  const p = prov(pid);
  const walls = (p.buildings.walls || 0) + wallBonus(pid);
  const f = fac(p.owner);
  const m = getMods(p.owner);
  const n = clamp(Math.round((2 + walls * 1.5 + p.pop / 80 + (p.buildings.barracks || 0)) * (1 + m.garrison)), 2, 14);
  const pool = ['militia', 'militia', 'archers', 'spearmen'];
  const cult = (CULTURE_ARMY[p.culture] || []).filter((u) => !UNIT_CLASSES[UNITS[u].cls].cav && !UNITS[u].tech && !UNITS[u].factions);
  if (cult.length) pool.push(cult[0]);
  const units = [];
  for (let i = 0; i < n; i++) units.push({ t: pool[i % pool.length], hp: Math.max(0.1, p.garrison), xp: 0, garrison: true });
  return units;
}

function composition(units) {
  let men = 0, cav = 0, light = 0, ranged = 0, inf = 0, siege = 0, heavy = 0, camel = 0;
  for (const u of units) {
    const d = UNITS[u.t], c = UNIT_CLASSES[d.cls];
    const m = d.size * u.hp;
    men += m;
    if (c.cav) cav += m;
    if (d.cls === 'ha' || d.cls === 'lc') light += m;
    if (c.ranged || d.rng >= 6) ranged += m;
    if (!c.cav) inf += m;
    if (d.cls === 'siege') siege += (d.siege || 1) * u.hp;
    if (d.cls === 'hc' || d.cls === 'ele') heavy += m;
    if (d.cls === 'camel') camel += m;
  }
  const f = (x) => (men ? x / men : 0);
  return { men, cav: f(cav), light: f(light), ranged: f(ranged), inf: f(inf), heavy: f(heavy), camel: f(camel), siege };
}

export function availableTactics(side, terrain, assault, isDefender, gen) {
  const out = ['frontal', 'defend'];
  if (!assault) {
    if (side.light >= 0.3) out.push('feigned');
    if (side.cav >= 0.4) out.push('encircle');
  }
  if (side.ranged >= 0.3 || (assault && side.siege > 0)) out.push('volley');
  const rough = ['forest', 'hills', 'mountain'].includes(terrain);
  if (!assault && rough && (isDefender || (gen && stat(gen, 'mar') >= 6))) out.push('ambush');
  if (!assault) out.push('retreat');
  if (assault && !isDefender) out.splice(out.indexOf('defend'), 1);
  return out;
}

function aiPickTactic(my, enemy, options, fid) {
  // Erwartungswert gegen eine geschätzte Verteilung gegnerischer Taktiken
  const guess = { frontal: 1, defend: 0.8, feigned: enemy.light >= 0.3 ? 1.2 : 0, encircle: enemy.cav >= 0.4 ? 0.8 : 0, volley: enemy.ranged >= 0.3 ? 0.8 : 0, ambush: 0.3 };
  const fit = (t) => {
    if (t === 'feigned') return 0.7 + my.light * 0.8 + (CULTURES[fac(fid).culture].group === 'steppe' ? 0.15 : 0);
    if (t === 'encircle') return 0.75 + my.cav * 0.5;
    if (t === 'volley') return 0.75 + my.ranged * 0.6;
    if (t === 'frontal') return 0.85 + my.heavy * 0.4;
    if (t === 'defend') return 0.85 + my.inf * 0.3;
    if (t === 'ambush') return 1.0;
    return 1;
  };
  let best = 'frontal', bv = -1;
  for (const t of options) {
    if (t === 'retreat') continue;
    let v = 0, w = 0;
    for (const [et, ew] of Object.entries(guess)) { if (!ew) continue; v += (MATRIX[t][et] || 1) * ew; w += ew; }
    v = (v / w) * fit(t) * rng().range(0.9, 1.1);
    if (v > bv) { bv = v; best = t; }
  }
  return best;
}

function sidePower(units, comp, fid, tacticMult, terrain, gen, isDefender, opp, assault, walls) {
  const m = fid && G.s.factions[fid] ? getMods(fid) : { ranged: 0, cavDef: 0, charge: 0, feigned: 0, assault: 0 };
  const t = TERRAINS[terrain];
  let p = 0;
  for (const u of units) {
    const d = UNITS[u.t], c = UNIT_CLASSES[d.cls];
    const men = d.size * u.hp * (1 + (u.xp || 0) * 0.05);
    let ranged = d.rng * (1 + m.ranged);
    let melee = d.att;
    let charge = c.cav || d.cls === 'ele' ? d.cha * (1 + m.charge) : d.cha * 0.3;
    let def = d.def * (c.cav ? 1 + m.cavDef : 1);
    if (opp.camel > 0.15 && c.cav) charge *= 0.85;
    if (d.cls === 'spear' && opp.cav > 0.4) def *= 1.2;
    let v = ranged * 0.55 + melee + charge * 0.6 + def * 0.7;
    v *= c.cav ? t.cav : t.inf;
    if (assault && !isDefender && d.cls !== 'siege' && c.cav) v *= 0.7; // Reiter taugen nicht zum Mauersturm
    if (assault && d.cls === 'siege') v *= isDefender ? 1 : 2.5;
    p += v * men;
  }
  p *= tacticMult;
  if (gen) p *= 1 + stat(gen, 'mar') * 0.05;
  if (isDefender) p *= 1 + t.def;
  if (assault && isDefender) {
    const eff = Math.max(0, walls * Math.max(0.25, 1 - opp.siege * 0.18));
    p *= 1 + eff * 0.4;
  }
  if (assault && !isDefender) p *= 1 + m.assault;
  const f = fid && G.s.factions[fid];
  if (f && f.holyWar > 0) p *= 1.08;
  if (G.s.season === 3 && f && CULTURES[f.culture].group !== 'steppe') p *= 0.94;
  return p;
}

function applyLosses(units, frac) {
  let lost = 0;
  for (const u of units) {
    const d = UNITS[u.t];
    const before = u.hp;
    u.hp = Math.max(0, u.hp - frac * rng().range(0.7, 1.3));
    lost += (before - u.hp) * d.size;
  }
  return Math.round(lost);
}

// ctx: { att: [armyIds], def: [armyIds], prov, assault }
export async function resolveBattle(ctx) {
  const s = G.s;
  const pid = ctx.prov;
  const p = prov(pid);
  const terrain = pdef(pid).terrain;
  const attArmies = ctx.att.map((id) => s.armies[id]).filter(Boolean);
  let defArmies = ctx.def.map((id) => s.armies[id]).filter(Boolean);
  const attFac = attArmies[0].fac;
  let defFac = defArmies[0]?.fac || p.owner;
  const attUnits = attArmies.flatMap((a) => a.units);
  const garrison = ctx.assault ? garrisonUnits(pid) : [];
  const defUnits = [...defArmies.flatMap((a) => a.units), ...garrison];
  const attGen = chr(attArmies.find((a) => a.gen)?.gen);
  const defGen = chr(defArmies.find((a) => a.gen)?.gen);
  const walls = ctx.assault ? (p.buildings.walls || 0) + wallBonus(pid) : 0;
  const cA = composition(attUnits), cD = composition(defUnits);
  const optA = availableTactics(cA, terrain, ctx.assault, false, attGen);
  const optD = availableTactics(cD, terrain, ctx.assault, true, defGen);
  const player = s.player;
  const info = {
    prov: pid, terrain, assault: !!ctx.assault, walls,
    att: { fac: attFac, gen: attGen?.id || null, men: Math.round(cA.men), comp: cA, options: optA, units: attUnits.map((u) => ({ t: u.t, hp: u.hp })) },
    def: { fac: defFac, gen: defGen?.id || null, men: Math.round(cD.men), comp: cD, options: optD, units: defUnits.map((u) => ({ t: u.t, hp: u.hp })) },
  };
  let tA, tD;
  const ui = G.ui && !s.observer;
  if (attFac === player && ui) tA = await G.ui.chooseTactic(info, 'att');
  if (!tA) tA = aiPickTactic(cA, cD, optA, attFac);
  if (defFac === player && ui && defArmies.length) tD = await G.ui.chooseTactic(info, 'def');
  if (!tD) tD = aiPickTactic(cD, cA, optD, defFac);
  if (!optA.includes(tA)) tA = 'frontal';
  if (!optD.includes(tD)) tD = 'defend';

  const report = { ...info, tA, tD, lines: [] };
  report.lines.push({ k: 'b.intro', p: { att: facName(attFac), def: facName(defFac), prov: provName(pid), terrain: TERRAINS[terrain].n } });

  // Rückzug
  for (const [side, t, armies, enemyComp, myComp] of [['att', tA, attArmies, cD, cA], ['def', tD, defArmies, cA, cD]]) {
    if (t !== 'retreat') continue;
    const chance = clamp(0.55 + (myComp.cav - enemyComp.cav) * 0.6 + myComp.light * 0.2, 0.15, 0.95);
    if (rng().chance(chance)) {
      const lost = applyLosses(armies.flatMap((a) => a.units), 0.06);
      for (const a of armies) a.units = a.units.filter((u) => u.hp > 0.06);
      const fid = side === 'att' ? attFac : defFac;
      fac(fid).prestige = Math.max(0, fac(fid).prestige - 2);
      report.lines.push({ k: 'b.retreatOk', p: { fac: facName(fid), lost } });
      report.winner = side === 'att' ? 'def' : 'att';
      report.retreated = side;
      report.attLost = side === 'att' ? lost : 0; report.defLost = side === 'def' ? lost : 0;
      if (side === 'def') for (const a of defArmies) retreatFrom(a, pid);
      finish(report);
      return report;
    }
    report.lines.push({ k: 'b.retreatFail', p: { fac: facName(side === 'att' ? attFac : defFac) } });
    if (side === 'att') tA = 'frontal'; else tD = 'defend';
  }
  report.tA = tA; report.tD = tD;

  // Taktikmultiplikatoren
  const eff = (t, my, fid) => {
    let e = 1;
    if (t === 'feigned') e = clamp(0.75 + my.light * 0.6, 0.8, 1.15) * (1 + (fid ? getMods(fid).feigned : 0)) * (CULTURES[fac(fid)?.culture || 'arab'].group === 'steppe' ? 1.08 : 1);
    if (t === 'encircle') e = clamp(0.8 + my.cav * 0.4, 0.85, 1.15);
    if (t === 'volley') e = clamp(0.8 + my.ranged * 0.45, 0.85, 1.15);
    return e;
  };
  const mA = (MATRIX[tA]?.[tD] || 1) * eff(tA, cA, attFac);
  const mD = (MATRIX[tD]?.[tA] || 1) * eff(tD, cD, defFac);
  let PA = sidePower(attUnits, cA, attFac, mA, terrain, attGen, false, cD, ctx.assault, walls) * rng().range(0.85, 1.15);
  let PD = sidePower(defUnits, cD, defFac, mD, terrain, defGen, true, cA, ctx.assault, walls) * rng().range(0.85, 1.15);
  if (ctx.assault && cA.siege === 0 && walls >= 2) PA *= 0.75;
  const ratio = PA / (PA + PD);
  const k = 2.2;
  const pWin = Math.pow(ratio, k) / (Math.pow(ratio, k) + Math.pow(1 - ratio, k));
  const attWins = rng().chance(pWin);
  const margin = Math.abs(ratio - 0.5) * 2;

  report.lines.push({ k: `b.t.${tA}`, p: { fac: facName(attFac) } });
  report.lines.push({ k: `b.t.${tD}`, p: { fac: facName(defFac) } });
  const clash = (MATRIX[tA]?.[tD] || 1) - (MATRIX[tD]?.[tA] || 1);
  if (clash > 0.15) report.lines.push({ k: 'b.tacticWin', p: { fac: facName(attFac), t: TACTICS[tA].n } });
  else if (clash < -0.15) report.lines.push({ k: 'b.tacticWin', p: { fac: facName(defFac), t: TACTICS[tD].n } });
  if (ctx.assault) report.lines.push({ k: cA.siege > 0 ? 'b.siegeEngines' : 'b.noEngines', p: { walls } });

  const winComp = attWins ? cA : cD;
  const loserFrac = clamp(0.22 + margin * 0.35 + winComp.cav * 0.12 + (attWins ? (tA === 'feigned' || tA === 'encircle' ? 0.08 : 0) : (tD === 'ambush' ? 0.08 : 0)), 0.15, 0.85);
  const winnerFrac = clamp(0.22 - margin * 0.18, 0.04, 0.3) * (ctx.assault && attWins ? 1.4 : 1);
  const attLost = applyLosses(attUnits, attWins ? winnerFrac : loserFrac);
  const defLost = applyLosses(defUnits, attWins ? loserFrac : winnerFrac);
  report.attLost = attLost; report.defLost = defLost;
  report.winner = attWins ? 'att' : 'def';
  report.margin = margin;
  report.lines.push({ k: margin > 0.45 ? 'b.decisive' : margin > 0.15 ? 'b.clear' : 'b.narrow', p: { fac: facName(attWins ? attFac : defFac) } });

  // Garnison
  if (garrison.length) {
    const avg = garrison.reduce((x, u) => x + u.hp, 0) / garrison.length;
    p.garrison = clamp(avg, 0.05, 1);
  }
  for (const a of [...attArmies, ...defArmies]) {
    a.units = a.units.filter((u) => u.hp > 0.06);
    for (const u of a.units) u.xp = Math.min(3, (u.xp || 0) + (rng().chance(0.5) ? 1 : 0));
  }
  // Feldherren
  const losGen = attWins ? defGen : attGen;
  const winGen = attWins ? attGen : defGen;
  if (losGen && rng().chance(0.08 + margin * 0.15)) { report.lines.push({ k: 'b.genDied', p: { name: losGen.n } }); killChar(losGen, 'battle'); }
  if (winGen && rng().chance(0.02)) { report.lines.push({ k: 'b.genDied', p: { name: winGen.n } }); killChar(winGen, 'battle'); }

  // Ansehen & Kriegspunkte
  const wf = attWins ? attFac : defFac, lf = attWins ? defFac : attFac;
  if (s.factions[wf]) { s.factions[wf].prestige += 2 + Math.round(margin * 6); s.factions[wf].stats.won++; }
  if (s.factions[lf]) { s.factions[lf].prestige = Math.max(0, s.factions[lf].prestige - 3); s.factions[lf].stats.lost++; s.factions[lf].warWeariness += 2; }
  if (s.factions[wf] && s.factions[lf] && wf !== 'rebels' && lf !== 'rebels') {
    const r = rel(wf, lf);
    r.score = r.score || {};
    r.score[wf] = (r.score[wf] || 0) + 4 + Math.round((attWins ? defLost : attLost) / 200);
  }

  // Heere ohne Truppen auflösen, Verlierer ziehen sich zurück
  for (const a of [...attArmies, ...defArmies]) if (!a.units.length) removeArmy(a);
  if (attWins && !ctx.assault) {
    for (const a of defArmies) if (s.armies[a.id]) retreatFrom(a, pid);
  }
  finish(report);
  return report;

  function finish(rep) {
    const involvesPlayer = attFac === player || defFac === player;
    log('log.battle', { prov: provName(pid), att: facName(attFac), def: facName(defFac), win: facName(rep.winner === 'att' ? attFac : defFac), al: rep.attLost || 0, dl: rep.defLost || 0, assault: !!ctx.assault }, { f: attFac, imp: involvesPlayer });
    if (involvesPlayer && G.ui?.battleReport && !s.observer) G.ui.battleReport(rep);
  }
}

function removeArmy(a) {
  if (a.gen && G.s.chars[a.gen]) {
    const g = G.s.chars[a.gen];
    g.army = null;
    if (g.alive && rng().chance(0.3)) killChar(g, 'battle');
  }
  delete G.s.armies[a.id];
}

function retreatFrom(a, pid) {
  const s = G.s;
  const opts = neighbors(pid).filter((n) => {
    const o = s.provinces[n].owner;
    const hostile = Object.values(s.armies).some((x) => x.prov === n && x.fac !== a.fac && atWar(a.fac, x.fac) && x.units.length);
    return !hostile && (o === a.fac || (hasAccess(a.fac, o) && !atWar(a.fac, o)));
  });
  if (!opts.length) {
    // eingeschlossen: schwere Verluste
    for (const u of a.units) u.hp *= 0.5;
    a.units = a.units.filter((u) => u.hp > 0.06);
    if (!a.units.length) removeArmy(a);
    return;
  }
  opts.sort((x, y) => (s.provinces[y].owner === a.fac) - (s.provinces[x].owner === a.fac));
  a.prov = opts[0];
  a.path = [];
  a.mp = 0;
  a.raid = false;
  a.siegeOf = null;
}
