// Zufalls- und Geschichtsereignisse.

import { G, fac, prov, pdef, chr, factionProvinces, factionArmies, rng, log, provName, facName, setOwner, rel, atWar, aliveFactions, neighbors, newId, ROUTES_BY_PROV, bumpAlive } from './state.js';
import { createArmy, convertProvince, clearModCache, getMods } from './economy.js';
import { createChar, loyalty, generals, civilWar, age, killChar, updateHeir } from './characters.js';
import { declareWar, makeVassal, makePeace, neighborsOf, militaryPower } from './diplomacy.js';
import { armySpeed, checkFactionDeath } from './military.js';
import { SCHOLARS } from '../data/people.js';
import { TECHS } from '../data/techs.js';
import { FACTIONS } from '../data/factions.js';
import { RELIGIONS, CULTURES, TERRAINS } from '../data/world.js';
import { clamp } from '../util.js';
import { discover, knows, knownRegions, contactByWar, revealToNeighbors } from './discovery.js';
import { REGIONS, REGION_IDS } from '../data/regions.js';
import { townName } from '../data/towns.js';

const d = (de, tr) => ({ de, tr });

function steppeProvinces(fid) {
  return factionProvinces(fid).filter((p) => TERRAINS[pdef(p).terrain].pasture >= 2.5);
}

function addUnits(fid, pid, list) {
  const a = createArmy(fid, pid, list.map((t) => ({ t, hp: 1, xp: 0 })));
  a.mp = armySpeed(a);
  return a;
}

// Reisende berichten von fernen Ländern (je nach Weltgegend, aus der sie kommen)
const TRAVELERS = {
  orient: [d('Ein armenischer Kaufmann', 'Ermeni bir tüccar'), d('Ein Pilger aus Jerusalem', 'Kudüs\'ten bir hacı'), d('Ein Gesandter aus Konstantinopel', 'Kostantiniyye\'den bir elçi')],
  europe: [d('Ein venezianischer Kaufmann', 'Venedikli bir tüccar'), d('Benjamin von Tudela', 'Tudelalı Benjamin'), d('Ein normannischer Pilger', 'Norman bir hacı')],
  east: [d('Ein uigurischer Mönch', 'Uygur bir rahip'), d('Ein Gesandter des Kaiserhofs', 'İmparatorluk sarayından bir elçi'), d('Ein Seidenhändler aus Kaschgar', 'Kaşgarlı bir ipek tüccarı')],
  africa: [d('Ein Salzhändler aus Sidschilmasa', 'Sicilmaseli bir tuz tüccarı'), d('Ein Pilger aus Kanem', 'Kanemli bir hacı'), d('Ein abessinischer Mönch', 'Habeş bir rahip')],
};

function charterTowns(fid) {
  const out = [];
  for (const pid in G.s.provinces) {
    const p = G.s.provinces[pid];
    if (p.owner !== fid || p.order < 45) continue;
    (p.towns || []).forEach((t, i) => { if (t.owner === fid && t.lvl < 3 && ['town', 'market', 'port'].includes(t.t)) out.push([pid, i]); });
  }
  return out;
}

// ============ Fraktionsereignisse ============
export const EVENTS = {
  charter: {
    chance: 0.02,
    cond: (fid) => charterTowns(fid).length > 0,
    prep: (fid) => { const [pid, i] = rng().pick(charterTowns(fid)); return { pid, i }; },
    title: d('Stadtrechte', 'Şehir Hakları'),
    text: d('Die Kaufleute und Handwerker von {town} ({prov}) bieten an, Mauern und Markt mitzufinanzieren – wenn wir ihnen Selbstverwaltung und Zollfreiheit gewähren.',
      '{town} ({prov}) tüccarları ve zanaatkârları, bize özyönetim ve gümrük muafiyeti verirsek sur ve pazar masraflarının bir kısmını üstlenmeyi teklif ediyor.'),
    params: (ctx) => ({ town: townName(ctx.pid, ctx.i), prov: provName(ctx.pid) }),
    options: [
      { t: d('Gewährt die Rechte (50 Gold)', 'Hakları verin (50 altın)'), desc: d('Der Ort steigt eine Stufe auf, Ordnung +5, Ansehen +2', 'Yer bir kademe yükselir, asayiş +5, itibar +2'), ai: 3,
        ok: (fid) => fac(fid).gold >= 50,
        fx: (fid, ctx) => { const t = prov(ctx.pid).towns[ctx.i]; if (!t || t.owner !== fid) return; fac(fid).gold -= 50; t.lvl = Math.min(3, t.lvl + 1); prov(ctx.pid).order = Math.min(100, prov(ctx.pid).order + 5); fac(fid).prestige += 2; } },
      { t: d('Die Stadt gehört dem Herrscher', 'Şehir hükümdarındır'), desc: d('Ordnung −6, einmalig 30 Gold Sondersteuer', 'Asayiş −6, bir kerelik 30 altın özel vergi'), ai: 1,
        fx: (fid, ctx) => { prov(ctx.pid).order = Math.max(0, prov(ctx.pid).order - 6); fac(fid).gold += 30; } },
    ],
  },
  traveler: {
    chance: 0.006,
    cond: (fid) => fac(fid).capital && REGION_IDS.some((r) => !knows(fid, r)),
    prep: (fid) => { const r = rng().pick(REGION_IDS.filter((x) => !knows(fid, x))); return { region: r, who: REGION_IDS.indexOf(r) * 10 + rng().int(0, TRAVELERS[r].length - 1) }; },
    title: d('Ein Reisender aus fernen Ländern', 'Uzak Diyarlardan Bir Seyyah'),
    text: d('{who} ist an unserem Hof eingetroffen. Er berichtet von {region}: von fremden Königen, reichen Städten und seltsamen Sitten. Sollen wir ihn anhören und Gesandte mit ihm zurückschicken?',
      '{who} sarayımıza geldi. {region} hakkında anlatıyor: yabancı krallardan, zengin şehirlerden ve tuhaf âdetlerden. Onu dinleyip yanında elçiler mi gönderelim?'),
    params: (ctx) => ({ who: TRAVELERS[ctx.region][ctx.who % 10], region: REGIONS[ctx.region].n }),
    options: [
      { t: d('Gesandte mitschicken (60 Gold)', 'Yanında elçiler gönderin (60 altın)'), desc: d('Die Weltgegend wird enthüllt, Ansehen +5', 'Bölge haritada açılır, itibar +5'), ai: 3,
        ok: (fid) => fac(fid).gold >= 60,
        fx: (fid, ctx) => { fac(fid).gold -= 60; fac(fid).prestige += 5; discover(fid, ctx.region, 'traveler'); } },
      { t: d('Nur seine Geschichten anhören', 'Sadece hikâyelerini dinleyin'), desc: d('Forschung +40', 'Araştırma +40'), ai: 1, fx: (fid) => { fac(fid).research.pts += 40; } },
    ],
  },
  turkmen: {
    chance: 0.025,
    cond: (fid) => fac(fid).culture === 'turkic' && steppeProvinces(fid).length > 0 && G.s.year < 1250,
    title: d('Turkmenen suchen Weideland', 'Türkmenler Otlak Arıyor'),
    text: d('Mehrere turkmenische Sippen sind mit ihren Herden an unsere Grenzen gezogen. Ihre Beys bieten uns ihre Schwerter an, wenn wir ihnen Weiden zuweisen.',
      'Birkaç Türkmen obası sürüleriyle sınırlarımıza gelmiş. Beyleri, onlara otlak verirsek kılıçlarını bize sunuyor.'),
    options: [
      { t: d('Nehmt sie auf!', 'Onları kabul edin!'), desc: d('+4 Turkmenen-Einheiten, Ordnung −8 in einer Provinz', '+4 Türkmen birliği, bir eyalette asayiş −8'), ai: 3,
        fx: (fid) => { const p = rng().pick(steppeProvinces(fid)); addUnits(fid, p, ['turkmen', 'turkmen', 'horse_archers', 'horse_archers']); prov(p).order -= 8; fac(fid).prestige += 3; } },
      { t: d('Schickt sie weiter', 'Onları başka yere gönderin'), desc: d('Ansehen −3', 'İtibar −3'), ai: 1, fx: (fid) => { fac(fid).prestige -= 3; } },
    ],
  },
  scholar: {
    chance: 0.02,
    cond: (fid) => factionProvinces(fid).some((p) => prov(p).buildings.school) && scholarsNow().length > 0,
    prep: () => ({ sch: rng().pick(scholarsNow()).id }),
    title: d('Ein Gelehrter sucht einen Hof', 'Bir Âlim Saray Arıyor'),
    text: d('{scholar} ist in unserer Hauptstadt eingetroffen und bietet dem Herrscher seine Dienste an – gegen einen angemessenen Lohn.',
      '{scholar} başkentimize geldi ve uygun bir ücret karşılığında hükümdara hizmet etmeyi teklif ediyor.'),
    params: (ctx) => ({ scholar: SCHOLARS.find((x) => x.id === ctx.sch).n }),
    options: [
      { t: d('Willkommen an unserem Hof! (100 Gold)', 'Sarayımıza hoş geldiniz! (100 altın)'), desc: d('Technologie oder Forschung und Ansehen', 'Teknoloji veya araştırma ve itibar'), ai: 3,
        ok: (fid) => fac(fid).gold >= 100,
        fx: (fid, ctx) => {
          const f = fac(fid); f.gold -= 100;
          const sc = SCHOLARS.find((x) => x.id === ctx.sch);
          if (TECHS[sc.field] && !f.techs.includes(sc.field) && TECHS[sc.field].req.every((r) => f.techs.includes(r))) { f.techs.push(sc.field); clearModCache(); }
          else f.research.pts += 80;
          f.prestige += 10;
          G.s.flags['sch_' + sc.id] = true;
        } },
      { t: d('Wir haben keine Verwendung für ihn', 'Ona ihtiyacımız yok'), desc: d('Nichts geschieht', 'Hiçbir şey olmaz'), ai: 1, fx: () => {} },
    ],
  },
  plague: {
    chance: 0.006,
    cond: (fid) => factionProvinces(fid).some((p) => prov(p).pop > 100),
    prep: (fid) => ({ p: rng().pick(factionProvinces(fid).filter((p) => prov(p).pop > 100)) }),
    title: d('Seuche!', 'Salgın!'),
    text: d('In {prov} ist eine Seuche ausgebrochen. Die Menschen sterben auf den Straßen.', '{prov} eyaletinde salgın baş gösterdi. İnsanlar sokaklarda ölüyor.'),
    params: (ctx) => ({ prov: provName(ctx.p) }),
    options: [
      { t: d('Die Stadt abriegeln (60 Gold)', 'Şehri karantinaya alın (60 altın)'), desc: d('Verluste halbiert', 'Kayıplar yarıya iner'), ai: 2, ok: (fid) => fac(fid).gold >= 60,
        fx: (fid, ctx) => { fac(fid).gold -= 60; plague(ctx.p, 0.5); } },
      { t: d('Wir beten um Gnade', 'Merhamet için dua ediyoruz'), desc: d('Hohe Verluste, auch in Nachbarprovinzen', 'Komşu eyaletlerde de ağır kayıplar'), ai: 1,
        fx: (fid, ctx) => { plague(ctx.p, 1); fac(fid).prestige += 2; } },
    ],
  },
  harvest: {
    chance: 0.012,
    cond: (fid) => factionProvinces(fid).length >= 2 && G.s.season === 2,
    title: d('Reiche Ernte', 'Bereketli Hasat'),
    text: d('Die Ernte war in diesem Jahr außergewöhnlich gut. Die Kornspeicher sind voll.', 'Bu yıl hasat olağanüstü iyi oldu. Ambarlar dolu.'),
    options: [
      { t: d('Die Überschüsse verkaufen', 'Fazlayı satın'), desc: d('+Gold', '+Altın'), ai: 2, fx: (fid) => { fac(fid).gold += 40 + factionProvinces(fid).length * 8; } },
      { t: d('Unter dem Volk verteilen', 'Halka dağıtın'), desc: d('Ordnung +10 in allen Provinzen', 'Tüm eyaletlerde asayiş +10'), ai: 1, fx: (fid) => { for (const p of factionProvinces(fid)) prov(p).order = Math.min(100, prov(p).order + 10); } },
    ],
  },
  dzud: {
    chance: 0.015,
    cond: (fid) => fac(fid).gov === 'nomad' && G.s.season === 3,
    title: d('Dschut – Viehsterben', 'Zud – Hayvan Kırımı'),
    text: d('Ein eisiger Winter hat die Weiden unter Eis begraben. Die Herden verhungern, die Sippen sind verzweifelt.', 'Dondurucu bir kış otlakları buzla kapladı. Sürüler açlıktan ölüyor, obalar çaresiz.'),
    options: [
      { t: d('Auf Beutezug zu den Sesshaften!', 'Yerleşiklere akın!'), desc: d('Pferde −30 %, dafür ein Kriegsgrund ohne Ruf-Verlust gegen einen sesshaften Nachbarn', 'At −%30; buna karşılık yerleşik bir komşuya itibar kaybı olmadan savaş gerekçesi'), ai: 2,
        fx: (fid) => {
          const f = fac(fid); f.horses = Math.round(f.horses * 0.7);
          const n = neighborsOf(fid).filter((x) => fac(x).gov === 'sedentary' && !atWar(fid, x))[0];
          if (n && fid !== G.s.player) { const inf = f.infamy; declareWar(fid, n); f.infamy = inf; }
          else if (n) { f.holyWar = Math.max(f.holyWar, 4); }
        } },
      { t: d('Ausharren', 'Dayanmak'), desc: d('Pferde −50 %, Gold −30', 'At −%50, altın −30'), ai: 1, fx: (fid) => { const f = fac(fid); f.horses = Math.round(f.horses * 0.5); f.gold -= 30; } },
    ],
  },
  ghulams: {
    chance: 0.02,
    cond: (fid) => fac(fid).techs.includes('ghulam') && RELIGIONS[fac(fid).religion].group === 'islam' && fac(fid).capital,
    title: d('Der Sklavenmarkt von Buchara', 'Buhara Köle Pazarı'),
    text: d('Händler bieten junge Kiptschaken und Oghusen an, die zu Ghulam-Reitern ausgebildet werden könnten.', 'Tüccarlar, gulam süvarisi olarak yetiştirilebilecek genç Kıpçak ve Oğuzlar sunuyor.'),
    options: [
      { t: d('Kauft sie alle (160 Gold)', 'Hepsini satın alın (160 altın)'), desc: d('+2 Ghulam-Garde in der Hauptstadt', 'Başkentte +2 gulam muhafızı'), ai: 2, ok: (fid) => fac(fid).gold >= 160,
        fx: (fid) => { fac(fid).gold -= 160; addUnits(fid, fac(fid).capital, ['ghulam', 'ghulam']); } },
      { t: d('Kein Bedarf', 'İhtiyaç yok'), desc: d('Nichts geschieht', 'Hiçbir şey olmaz'), ai: 1, fx: () => {} },
    ],
  },
  dervish: {
    chance: 0.02,
    cond: (fid) => ['sunni', 'shia'].includes(fac(fid).religion) && factionProvinces(fid).some((p) => (prov(p).rel.tengri || 0) > 0.15),
    title: d('Wandernde Derwische', 'Gezgin Dervişler'),
    text: d('Derwische ziehen durch die Jurtenlager und predigen den Nomaden in ihrer eigenen Sprache.', 'Dervişler obaları dolaşıp göçebelere kendi dillerinde vaaz veriyor.'),
    options: [
      { t: d('Ihnen Stiftungen gewähren (50 Gold)', 'Onlara vakıf tahsis edin (50 altın)'), desc: d('Tengristen bekehren sich schneller, Ordnung +5', 'Tengriciler daha hızlı din değiştirir, asayiş +5'), ai: 2, ok: (fid) => fac(fid).gold >= 50,
        fx: (fid) => { fac(fid).gold -= 50; for (const p of factionProvinces(fid)) if ((prov(p).rel.tengri || 0) > 0.05) { convertProvince(prov(p), fac(fid).religion, 0.2); prov(p).order += 5; } } },
      { t: d('Sie gewähren lassen', 'Serbest bırakın'), desc: d('Leichte Bekehrung', 'Hafif din değişimi'), ai: 1,
        fx: (fid) => { for (const p of factionProvinces(fid)) if ((prov(p).rel.tengri || 0) > 0.05) convertProvince(prov(p), fac(fid).religion, 0.06); } },
    ],
  },
  emir: {
    chance: 0.02,
    cond: (fid) => factionProvinces(fid).length >= 8 && disloyalGeneral(fid),
    prep: (fid) => ({ c: disloyalGeneral(fid).id }),
    title: d('Ein unzufriedener Emir', 'Hoşnutsuz Bir Emir'),
    text: d('{name} murrt offen über seinen Anteil an der Beute. Man sagt, er verhandle heimlich mit unseren Feinden.', '{name} ganimetten aldığı paydan açıkça yakınıyor. Düşmanlarımızla gizlice görüştüğü söyleniyor.'),
    params: (ctx) => ({ name: chr(ctx.c)?.n || '' }),
    options: [
      { t: d('Ihn mit einem Iqta beschenken (120 Gold)', 'Ona ikta bağışlayın (120 altın)'), desc: d('Loyalität +30', 'Sadakat +30'), ai: 2, ok: (fid) => fac(fid).gold >= 120,
        fx: (fid, ctx) => { fac(fid).gold -= 120; const c = chr(ctx.c); if (c) c.loyMod += 30; } },
      { t: d('Ihn hinrichten lassen', 'Onu idam ettirin'), desc: d('Er stirbt. Ansehen −5, andere werden misstrauisch', 'Ölür. İtibar −5, diğerleri kuşkulanır'), ai: 1,
        fx: (fid, ctx) => { const c = chr(ctx.c); if (c) killChar(c, 'executed'); fac(fid).prestige -= 5; for (const g of generals(fid)) g.loyMod -= 8; } },
      { t: d('Gerede ignorieren', 'Dedikoduları önemsemeyin'), desc: d('Risiko eines Aufstands', 'İsyan riski'), ai: 1,
        fx: (fid, ctx) => { const c = chr(ctx.c); if (c && rng().chance(0.45)) civilWar(fid, c); } },
    ],
  },
  heir_edu: {
    chance: 0.03,
    cond: (fid) => { const h = chr(fac(fid).heir); return h && age(h) >= 10 && age(h) <= 15 && !h.educated; },
    prep: (fid) => ({ c: fac(fid).heir }),
    title: d('Die Erziehung des Thronfolgers', 'Veliahdın Eğitimi'),
    text: d('{name} wird bald erwachsen. Wem sollen wir seine Erziehung anvertrauen?', '{name} yakında yetişkin olacak. Eğitimini kime emanet edelim?'),
    params: (ctx) => ({ name: chr(ctx.c)?.n || '' }),
    options: [
      { t: d('Einem Atabeg – er soll ein Krieger werden', 'Bir atabege – savaşçı olsun'), desc: d('Kriegskunst +2', 'Savaş +2'), ai: 2, fx: (fid, ctx) => { const c = chr(ctx.c); if (c) { c.mar += 2; c.educated = true; } } },
      { t: d('Den Gelehrten der Madrasa', 'Medrese âlimlerine'), desc: d('Verwaltung +2', 'Yönetim +2'), ai: 1, fx: (fid, ctx) => { const c = chr(ctx.c); if (c) { c.adm += 2; c.educated = true; } } },
      { t: d('Den Dichtern und Gesandten des Hofes', 'Saray şairlerine ve elçilerine'), desc: d('Diplomatie +2', 'Diplomasi +2'), ai: 1, fx: (fid, ctx) => { const c = chr(ctx.c); if (c) { c.dip += 2; c.educated = true; } } },
    ],
  },
  caravan: {
    chance: 0.015,
    cond: (fid) => factionProvinces(fid).some((p) => ROUTES_BY_PROV[p]),
    prep: (fid) => ({ p: rng().pick(factionProvinces(fid).filter((p) => ROUTES_BY_PROV[p])) }),
    title: d('Karawane überfallen', 'Kervan Soyuldu'),
    text: d('Räuber haben bei {prov} eine reiche Karawane überfallen. Die Kaufleute verlangen Schutz.', '{prov} yakınlarında haydutlar zengin bir kervanı soydu. Tüccarlar koruma istiyor.'),
    params: (ctx) => ({ prov: provName(ctx.p) }),
    options: [
      { t: d('Wachposten einrichten (60 Gold)', 'Karakollar kurun (60 altın)'), desc: d('Ordnung +10 in der Provinz, Ansehen +3', 'Eyalette asayiş +10, itibar +3'), ai: 2, ok: (fid) => fac(fid).gold >= 60,
        fx: (fid, ctx) => { fac(fid).gold -= 60; prov(ctx.p).order += 10; fac(fid).prestige += 3; } },
      { t: d('Das Risiko tragen die Händler', 'Riski tüccarlar taşısın'), desc: d('Ordnung −8 in der Provinz', 'Eyalette asayiş −8'), ai: 1, fx: (fid, ctx) => { prov(ctx.p).order -= 8; } },
    ],
  },
  earthquake: {
    chance: 0.004,
    cond: (fid) => factionProvinces(fid).some((p) => ['mountain', 'hills'].includes(pdef(p).terrain)),
    prep: (fid) => ({ p: rng().pick(factionProvinces(fid).filter((p) => ['mountain', 'hills'].includes(pdef(p).terrain))) }),
    title: d('Erdbeben', 'Deprem'),
    text: d('Ein schweres Erdbeben hat {prov} erschüttert. Mauern sind eingestürzt.', 'Şiddetli bir deprem {prov} eyaletini sarstı. Surlar yıkıldı.'),
    params: (ctx) => ({ prov: provName(ctx.p) }),
    options: [
      { t: d('Sofort wieder aufbauen (100 Gold)', 'Hemen yeniden inşa edin (100 altın)'), desc: d('Nur Bevölkerungsverluste', 'Yalnızca nüfus kaybı'), ai: 2, ok: (fid) => fac(fid).gold >= 100,
        fx: (fid, ctx) => { fac(fid).gold -= 100; prov(ctx.p).pop *= 0.93; } },
      { t: d('Die Trümmer liegen lassen', 'Enkazı bırakın'), desc: d('Mauern −1 Stufe, Bevölkerung −7 %', 'Surlar −1 seviye, nüfus −%7'), ai: 1,
        fx: (fid, ctx) => { const p = prov(ctx.p); p.pop *= 0.93; if (p.buildings.walls) p.buildings.walls--; p.devast = Math.min(1, p.devast + 0.2); } },
    ],
  },
  comet: {
    chance: 0.004,
    cond: () => true,
    title: d('Ein Schweifstern am Himmel', 'Gökte Kuyruklu Yıldız'),
    text: d('Die Sterndeuter sind sich uneins: Ist der Komet ein Zeichen des Sieges oder des Unheils?', 'Müneccimler anlaşamıyor: Kuyruklu yıldız zafer mi yoksa felaket mi işaret ediyor?'),
    options: [
      { t: d('Ein Zeichen unseres Sieges!', 'Zaferimizin işareti!'), desc: d('Ansehen +8, Ordnung −3', 'İtibar +8, asayiş −3'), ai: 1, fx: (fid) => { fac(fid).prestige += 8; for (const p of factionProvinces(fid)) prov(p).order -= 3; } },
      { t: d('Opfer und Almosen, um das Unheil abzuwenden (40 Gold)', 'Felaketi savmak için kurban ve sadaka (40 altın)'), desc: d('Ordnung +5', 'Asayiş +5'), ai: 1, ok: (fid) => fac(fid).gold >= 40,
        fx: (fid) => { fac(fid).gold -= 40; for (const p of factionProvinces(fid)) prov(p).order += 5; } },
    ],
  },
  pilgrims: {
    chance: 0.02,
    cond: (fid) => RELIGIONS[fac(fid).religion].group === 'islam' && (prov('hijaz').owner === fid || prov('medina').owner === fid),
    title: d('Die Pilgerkarawane', 'Hac Kervanı'),
    text: d('Tausende Pilger ziehen nach Mekka. Wer ihre Karawane schützt, gewinnt Ansehen in der ganzen Umma.', 'Binlerce hacı Mekke\'ye gidiyor. Kervanlarını koruyan, bütün ümmette itibar kazanır.'),
    options: [
      { t: d('Eskorte und Brunnen stiften (80 Gold)', 'Muhafız ve kuyu bağışlayın (80 altın)'), desc: d('Ansehen +20', 'İtibar +20'), ai: 2, ok: (fid) => fac(fid).gold >= 80,
        fx: (fid) => { fac(fid).gold -= 80; fac(fid).prestige += 20; } },
      { t: d('Die Pilger zahlen Wegzoll', 'Hacılardan yol vergisi alın'), desc: d('+60 Gold, Ansehen −10', '+60 altın, itibar −10'), ai: 1, fx: (fid) => { fac(fid).gold += 60; fac(fid).prestige -= 10; } },
    ],
  },
  conversion: {
    chance: 0.03,
    cond: (fid) => ['tengri', 'pagan', 'manichaean'].includes(fac(fid).religion) && conversionOffer(fid),
    prep: (fid) => ({ r: conversionOffer(fid) }),
    title: d('Missionare am Hof', 'Sarayda Misyonerler'),
    text: d('Gesandte des {rel} sind in unserem Lager eingetroffen. Sie sprechen von einem einzigen Gott, von Städten voller Gelehrter und von mächtigen Verbündeten. Die Schamanen murren.', '{rel} elçileri ordugâhımıza geldi. Tek bir Tanrı\'dan, âlimlerle dolu şehirlerden ve güçlü müttefiklerden söz ediyorlar. Kamlar homurdanıyor.'),
    params: (ctx) => ({ rel: RELIGIONS[ctx.r].n }),
    options: [
      { t: d('Wir nehmen den neuen Glauben an', 'Yeni dini kabul ediyoruz'), desc: d('Staatsreligion wechselt. Ordnung in alten Provinzen sinkt vorübergehend', 'Devlet dini değişir. Eski eyaletlerde asayiş geçici olarak düşer'), ai: 2,
        fx: (fid, ctx) => { changeReligion(fid, ctx.r); } },
      { t: d('Wir bleiben beim Ewigen Himmel', 'Sonsuz Gök\'e bağlı kalıyoruz'), desc: d('Ansehen +5', 'İtibar +5'), ai: 1, fx: (fid) => { fac(fid).prestige += 5; } },
    ],
  },
  settle: {
    chance: 0.03,
    cond: (fid) => fac(fid).gov === 'nomad' && factionProvinces(fid).filter((p) => !['steppe', 'desert'].includes(pdef(p).terrain) && prov(p).pop >= 90).length >= 4,
    title: d('Die Emire wollen Paläste', 'Emirler Saray İstiyor'),
    text: d('Unsere Beys haben die Reichtümer der Städte gesehen. Persische Schreiber drängen darauf, das Reich wie einen Staat zu verwalten, nicht wie ein Heerlager.', 'Beylerimiz şehirlerin zenginliğini gördü. Fars kâtipler devleti bir ordugâh gibi değil, bir devlet gibi yönetmemizi istiyor.'),
    options: [
      { t: d('Ein Sultanat nach persischem Vorbild errichten', 'Fars örneğinde bir sultanlık kurun'), desc: d('Regierungsform: Sultanat. Steppenvölker sind eine Weile unzufrieden', 'Yönetim biçimi: Sultanlık. Bozkır halkı bir süre hoşnutsuz olur'), ai: 2,
        fx: (fid) => { const f = fac(fid); f.gov = 'sultanate'; f.govUnrest = 8; clearModCache(); } },
      { t: d('Wir sind Söhne der Steppe', 'Biz bozkırın evlatlarıyız'), desc: d('Ordnung in Steppenprovinzen +5', 'Bozkır eyaletlerinde asayiş +5'), ai: 1,
        fx: (fid) => { for (const p of factionProvinces(fid)) if (CULTURES[prov(p).culture].group === 'steppe') prov(p).order += 5; } },
    ],
  },
};

function scholarsNow() {
  const y = G.s.year;
  return SCHOLARS.filter((s) => y >= s.from && y <= s.to && !G.s.flags['sch_' + s.id]);
}

function disloyalGeneral(fid) {
  const f = fac(fid);
  return generals(fid).filter((c) => c.id !== f.ruler && loyalty(c) < 40)[0] || null;
}

function conversionOffer(fid) {
  const counts = {};
  for (const n of neighborsOf(fid)) {
    const r = fac(n).religion;
    if (['sunni', 'orthodox', 'buddhist', 'shia'].includes(r)) counts[r] = (counts[r] || 0) + militaryPower(n);
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : null;
}

export function changeReligion(fid, r) {
  const f = fac(fid);
  f.religion = r;
  f.govUnrest = Math.max(f.govUnrest, 6);
  f.legitimacy = clamp(f.legitimacy - 10, 0, 100);
  for (const p of factionProvinces(fid)) convertProvince(prov(p), r, 0.1);
  for (const pid of factionProvinces(fid)) {
    const b = prov(pid).buildings;
    if (b.temple) b.temple = Math.max(1, b.temple - 1);
  }
  clearModCache();
  log('log.convert', { fac: f.n, rel: RELIGIONS[r].n }, { f: fid, imp: true });
}

function plague(pid, factor) {
  const f = fac(prov(pid).owner);
  const med = f.techs.includes('medicine') ? 0.6 : 1;
  prov(pid).pop *= 1 - 0.15 * factor * med;
  prov(pid).order -= 10;
  for (const n of neighbors(pid)) prov(n).pop *= 1 - 0.05 * factor * med;
}

// ============ Ablauf ============
export function rollEvents(fid) {
  const s = G.s;
  const f = fac(fid);
  if (!f.alive || fid === 'rebels' || !factionProvinces(fid).length) return;
  for (const [id, ev] of Object.entries(EVENTS)) {
    if (!rng().chance(ev.chance)) continue;
    let ok = false;
    try { ok = ev.cond(fid); } catch (e) { ok = false; }
    if (!ok) continue;
    const ctx = ev.prep ? ev.prep(fid) : {};
    if (fid === s.player && !s.observer) {
      s.pending.push({ type: 'event', id, fid, ctx });
    } else {
      const opts = ev.options.filter((o) => !o.ok || o.ok(fid));
      const pick = rng().weighted(opts, (o) => o.ai || 1);
      if (pick) pick.fx(fid, ctx);
    }
    return; // höchstens ein Ereignis pro Runde und Fraktion
  }
}

export function applyEventChoice(pending, idx) {
  const ev = EVENTS[pending.id] || GLOBAL_EVENTS[pending.id];
  const o = ev.options[idx];
  if (!o) return;
  if (o.ok && !o.ok(pending.fid, pending.ctx)) return;
  o.fx(pending.fid, pending.ctx || {});
  clearModCache();
}

// ============ Historische Ereignisse ============
function spawnFaction(fid, o) {
  const s = G.s;
  const f = s.factions[fid];
  f.alive = true;
  f.spawned = true;
  bumpAlive();
  f.gold = o.gold || 500;
  f.horses = o.horses || 300;
  f.prestige = o.prestige || 50;
  if (o.gov) f.gov = o.gov;
  f.techs = [...new Set([...(f.techs || []), 'composite_bow', 'diwan', 'lamellar', ...(o.techs || [])])];
  for (const pid of o.provinces || []) setOwner(pid, fid);
  if (o.provinces?.length) f.capital = o.provinces[0];
  if (!f.ruler || !chr(f.ruler)?.alive) {
    const r = createChar(fid, { ...(o.ruler || {}), role: 'ruler' });
    f.ruler = r.id;
    for (let i = 0; i < 2; i++) createChar(fid, { born: r.born + rng().int(18, 30), father: r.id, role: 'family' });
    updateHeir(fid);
  }
  for (const a of o.armies || []) {
    const army = createArmy(fid, a.prov, a.units.map((t) => ({ t, hp: 1, xp: 1 })));
    army.mp = armySpeed(army);
    const g = createChar(fid, { dyn: false, role: 'general', mar: rng().int(6, 9) });
    army.gen = g.id; g.army = army.id;
  }
  f.known = null;
  for (const e of o.wars || []) if (s.factions[e]?.alive && e !== fid) { const r = rel(fid, e); r.war = true; r.warStart = s.turn; r.score = {}; contactByWar(fid, e); }
  clearModCache();
}

const rep = (arr, n) => Array.from({ length: n }, (_, i) => arr[i % arr.length]);

export const GLOBAL_EVENTS = {
  seljuk_rise: {
    when: () => G.s.year >= 1030 && G.s.year <= 1045 && !G.s.flags.seljukRise && (!fac('seljuk').alive || factionProvinces('seljuk').length < 8) && G.s.startYear < 1030,
    run: () => {
      const s = G.s;
      s.flags.seljukRise = true;
      const f = fac('seljuk');
      if (!f.alive) {
        // Der Klan kehrt aus der Steppe zurück
        const home = ['dihistan', 'jand', 'mangyshlak', 'yengikent'].find((p) => prov(p).owner !== s.player) || 'dihistan';
        const old = prov(home).owner;
        spawnFaction('seljuk', { provinces: [home], gold: 200, gov: 'nomad', ruler: { n: d('Tughril Bey', 'Tuğrul Bey'), born: 990, mar: 8, adm: 7, dip: 6, traits: ['strategist', 'ambitious'] }, wars: [old] });
        f.religion = 'sunni';
      }
      const at = f.capital || factionProvinces('seljuk')[0];
      if (!at) return;
      f.overlord = null;
      addUnits('seljuk', at, rep(['turkmen', 'horse_archers', 'horse_archers', 'turkmen', 'tarkhan'], 16));
      addUnits('seljuk', at, rep(['turkmen', 'horse_archers', 'horse_archers'], 12));
      f.gold += 400; f.horses += 300; f.prestige += 30;
      f.ai.aggr = 0.95;
      const dih = prov('dihistan');
      if (s.player !== 'seljuk' && dih.owner !== 'seljuk' && dih.owner !== s.player) setOwner('dihistan', 'seljuk');
      const target = prov('merv').owner;
      if (s.player !== 'seljuk' && target !== 'seljuk' && fac(target)?.alive && !atWar('seljuk', target)) declareWar('seljuk', target);
      log('ev.seljukRise', {}, { imp: true });
    },
  },
  crusade: {
    when: () => G.s.year >= 1096 && G.s.year <= 1100 && !G.s.flags.crusade && !fac('crusader').alive && RELIGIONS[fac(prov('jerusalem').owner).religion].group !== 'christian',
    run: () => {
      const s = G.s;
      s.flags.crusade = true;
      const start = ['constantinople', 'nicaea', 'cilicia', 'antioch'].find((p) => fac(prov(p).owner).religion === 'orthodox') || 'cyprus';
      const targets = ['jerusalem', 'antioch', 'edessa', 'tripoli', 'nicaea', 'konya'].map((p) => prov(p).owner).filter((o) => RELIGIONS[fac(o).religion].group === 'islam');
      spawnFaction('crusader', {
        gold: 700, horses: 300, prestige: 80, ruler: { n: d('Bohemund von Tarent', 'Tarentli Bohemond'), born: 1054, mar: 8, traits: ['strategist', 'ambitious'] },
        armies: [{ prov: start, units: rep(['knights', 'knights', 'sergeants', 'crossbows', 'sergeants'], 16) }, { prov: start, units: rep(['knights', 'sergeants', 'crossbows', 'sergeants'], 14) }],
        wars: [...new Set(targets)],
      });
      if (fac('byzantine').alive) { rel('crusader', 'byzantine').alliance = true; }
      discover('crusader', 'europe', 'event');
      for (const p of ['jerusalem', 'antioch', 'edessa', 'tripoli', 'damascus', 'aleppo', 'konya', 'nicaea', 'cilicia', 'egypt', 'baghdad', 'mosul']) discover(prov(p).owner, 'europe', 'crusade');
      log('ev.crusade', {}, { imp: true });
    },
  },
  crusade_later: {
    when: () => [1147, 1189, 1217].includes(G.s.year) && G.s.season === 1 && fac('crusader').alive,
    run: () => {
      const f = fac('crusader');
      const own = factionProvinces('crusader');
      const at = own.find((p) => pdef(p).port) || own[0] || 'cyprus';
      addUnits('crusader', at, rep(['knights', 'knights', 'sergeants', 'crossbows'], 14));
      f.gold += 400;
      log('ev.crusadeLater', {}, { imp: true });
    },
  },
  karakhitai: {
    when: () => G.s.year >= 1130 && G.s.year <= 1140 && !G.s.flags.karakhitai && !fac('karakhitai').alive,
    run: () => {
      const s = G.s;
      s.flags.karakhitai = true;
      const prov1 = 'almaliq';
      const victim = prov(prov1).owner;
      spawnFaction('karakhitai', {
        gold: 900, horses: 500, prestige: 80, gov: 'nomad', provinces: [prov1],
        ruler: { n: d('Yelü Dashi', 'Yelü Daşi'), born: 1087, mar: 9, adm: 7, dip: 6, traits: ['strategist', 'wise'] },
        armies: [{ prov: prov1, units: rep(['mongol_ha', 'mongol_ha', 'keshig'], 16) }, { prov: prov1, units: rep(['mongol_ha', 'mongol_ha', 'keshig'], 12) }],
        wars: [victim, prov('balasagun').owner],
        techs: ['kurultai', 'heavy_lancers'],
      });
      log('ev.karakhitai', { fac: facName(victim) }, { imp: true });
    },
  },
  nizari: {
    when: () => G.s.year >= 1090 && G.s.year <= 1100 && !G.s.flags.nizari && !fac('nizari').alive && fac(prov('daylam').owner).religion !== 'ismaili' && prov('daylam').owner !== G.s.player,
    run: () => {
      G.s.flags.nizari = true;
      const victim = prov('daylam').owner;
      spawnFaction('nizari', {
        gold: 300, prestige: 30, provinces: ['daylam'],
        ruler: { n: d('Hasan-i Sabbah', 'Hasan Sabbah'), born: 1050, mar: 5, adm: 8, dip: 7, traits: ['pious', 'scholar'] },
        armies: [{ prov: 'daylam', units: rep(['daylamite', 'archers'], 6) }], wars: [victim],
      });
      log('ev.nizari', {}, { imp: true });
    },
  },
  rum: {
    when: () => G.s.year >= 1075 && G.s.year <= 1090 && !G.s.flags.rum && !fac('rum').alive && fac('seljuk').alive && rumProvinces().length >= 2,
    player: () => G.s.player === 'seljuk',
    title: d('Sulaiman ibn Kutalmisch', 'Kutalmışoğlu Süleyman'),
    text: d('Unser Vetter Sulaiman hat mit den Turkmenen weite Teile Anatoliens erobert. Er verlangt, dass wir ihn als Herrn dieser Länder anerkennen.', 'Amcaoğlumuz Süleyman, Türkmenlerle Anadolu\'nun geniş bölümlerini fethetti. Bu toprakların hâkimi olarak tanınmasını istiyor.'),
    options: [
      { t: d('Er soll als unser Vasall in Rum herrschen', 'Rum\'da vasalımız olarak hüküm sürsün'), desc: d('Die anatolischen Provinzen werden zum Sultanat Rum (Vasall)', 'Anadolu eyaletleri Rum Sultanlığı olur (vasal)'), fx: () => foundRum(true) },
      { t: d('Niemals! Anatolien gehört dem Großsultan', 'Asla! Anadolu büyük sultanındır'), desc: d('Ansehen +10, aber Unruhe in Anatolien', 'İtibar +10, ama Anadolu\'da huzursuzluk'), fx: () => { G.s.flags.rum = true; fac('seljuk').prestige += 10; for (const p of rumProvinces()) prov(p).order -= 15; } },
    ],
    run: () => foundRum(true),
  },
  zengid: {
    when: () => G.s.year >= 1127 && G.s.year <= 1135 && !G.s.flags.zengid && !fac('zengid').alive && prov('mosul').owner !== G.s.player && factionProvinces(prov('mosul').owner).length >= 12,
    run: () => {
      G.s.flags.zengid = true;
      const old = prov('mosul').owner;
      const provs = ['mosul', 'aleppo', 'raqqa'].filter((p) => prov(p).owner === old);
      spawnFaction('zengid', { gold: 300, provinces: provs, ruler: { n: d('Imad ad-Din Zengi', 'İmadeddin Zengi'), born: 1085, mar: 8, adm: 6, traits: ['strategist', 'cruel'] }, armies: [{ prov: 'mosul', units: rep(['horse_archers', 'ghulam', 'spearmen', 'kurdish_cav'], 10) }], techs: ['ghulam'] });
      fac('zengid').overlord = old;
      log('ev.zengid', {}, { imp: true });
    },
  },
  ayyubid: {
    when: () => G.s.year >= 1169 && G.s.year <= 1175 && !G.s.flags.ayyubid && !fac('ayyubid').alive && fac('fatimid').alive && prov('egypt').owner === 'fatimid' && G.s.player !== 'fatimid',
    run: () => {
      G.s.flags.ayyubid = true;
      const provs = factionProvinces('fatimid');
      spawnFaction('ayyubid', { gold: 600, provinces: ['egypt', ...provs.filter((p) => p !== 'egypt')], ruler: { n: d('Salah ad-Din', 'Selahaddin Eyyubi'), born: 1137, mar: 9, adm: 8, dip: 8, traits: ['just', 'strategist', 'ghazi'] }, armies: [{ prov: 'egypt', units: rep(['kurdish_cav', 'ghulam', 'spearmen', 'archers', 'horse_archers'], 14) }], techs: ['ghulam', 'iqta'] });
      fac('ayyubid').religion = 'sunni';
      checkFactionDeath('fatimid', 'ayyubid');
      log('ev.ayyubid', {}, { imp: true });
    },
  },
  delhi: {
    when: () => G.s.year >= 1206 && G.s.year <= 1215 && !G.s.flags.delhi && !fac('delhi').alive && fac('ghurid').alive && prov('delhi').owner === 'ghurid',
    player: () => G.s.player === 'ghurid',
    title: d('Aibak in Delhi', 'Delhi\'de Aybek'),
    text: d('Nach dem Tod des Sultans hat sich Qutb ad-Din Aibak, unser türkischer Ghulam-General in Indien, in Lahore und Delhi zum Herrscher ausgerufen.', 'Sultanın ölümünden sonra Hindistan\'daki Türk gulam komutanımız Kutbeddin Aybek, Lahor ve Delhi\'de kendini hükümdar ilan etti.'),
    options: [
      { t: d('Wir erkennen ihn als Vasallen an', 'Onu vasal olarak tanıyoruz'), desc: d('Das Sultanat Delhi entsteht als unser Vasall', 'Delhi Sultanlığı vasalımız olarak doğar'), fx: () => foundDelhi(true) },
      { t: d('Verrat! Krieg!', 'İhanet! Savaş!'), desc: d('Das Sultanat Delhi entsteht als Feind', 'Delhi Sultanlığı düşman olarak doğar'), fx: () => foundDelhi(false) },
    ],
    run: () => foundDelhi(rng().chance(0.3)),
  },
  mongols: {
    when: () => { const s = G.s; if (!s.flags.mongolYear) s.flags.mongolYear = 1190 + rng().int(0, 35); return s.year >= s.flags.mongolYear && !s.flags.mongols && !fac('mongol').alive && (s.eventRate ?? 1) >= 0; },
    run: () => {
      const s = G.s;
      s.flags.mongols = true;
      const base = prov('kerulen').owner === s.player && prov('orkhon').owner !== s.player ? 'orkhon' : 'kerulen';
      const victim = prov(base).owner;
      spawnFaction('mongol', {
        gold: 1500, horses: 1200, prestige: 150, gov: 'nomad', provinces: [base],
        ruler: { n: d('Dschingis Khan', 'Cengiz Han'), born: 1162, mar: 12, adm: 9, dip: 8, traits: ['strategist', 'charismatic', 'cruel'] },
        armies: [{ prov: base, units: rep(['mongol_ha', 'mongol_ha', 'mongol_ha', 'keshig'], 18) }, { prov: base, units: rep(['mongol_ha', 'mongol_ha', 'keshig'], 16) }],
        wars: [victim], techs: ['kurultai', 'turan_tactics', 'heavy_lancers', 'siege_mangonel', 'horse_breeding'],
      });
      const f = fac('mongol');
      f.ai.aggr = 1;
      // Die Uiguren unterwerfen sich
      if (fac('uyghur').alive && G.s.player !== 'uyghur') { fac('uyghur').overlord = 'mongol'; }
      else if (G.s.player === 'uyghur') G.s.pending.push({ type: 'global', id: 'uyghur_submit' });
      log('ev.mongols', {}, { imp: true, rg: 'east' });
    },
  },
  uyghur_submit: {
    when: () => false,
    title: d('Die Gesandten Dschingis Khans', 'Cengiz Han\'ın Elçileri'),
    text: d('Gesandte des Mongolenkhans verlangen, dass der Iduqqut sich unterwirft. „Werde der fünfte Sohn des Khans – oder teile das Schicksal der Naimanen.“', 'Moğol hanının elçileri İdikut\'un boyun eğmesini istiyor. "Hanın beşinci oğlu ol – ya da Naymanların akıbetini paylaş."'),
    options: [
      { t: d('Wir unterwerfen uns', 'Boyun eğiyoruz'), desc: d('Vasall der Mongolen, Ansehen +10', 'Moğolların vasalı, itibar +10'), fx: () => { fac('uyghur').overlord = 'mongol'; fac('uyghur').prestige += 10; } },
      { t: d('Die Uiguren beugen sich niemandem', 'Uygurlar kimseye boyun eğmez'), desc: d('Krieg mit den Mongolen', 'Moğollarla savaş'), fx: () => { declareWar('mongol', 'uyghur'); } },
    ],
  },
  mongol_invasion: {
    when: () => G.s.year >= (G.s.flags.mongolYear || 1208) + 11 && !G.s.flags.mongolInv && fac('mongol').alive,
    run: () => {
      const s = G.s;
      s.flags.mongolInv = true;
      const own = factionProvinces('mongol');
      const at = own[0];
      if (!at) return;
      addUnits('mongol', at, rep(['mongol_ha', 'mongol_ha', 'mongol_ha', 'keshig', 'mangonel'], 20));
      addUnits('mongol', at, rep(['mongol_ha', 'mongol_ha', 'keshig', 'mangonel'], 18));
      fac('mongol').gold += 1500;
      const target = ['otrar', 'samarkand', 'khwarazm'].map((p) => prov(p).owner).find((o) => o !== 'mongol' && fac(o).alive && fac(o).overlord !== 'mongol');
      if (target && !atWar('mongol', target)) declareWar('mongol', target);
      log('ev.mongolInvasion', { fac: target ? facName(target) : d('', '') }, { imp: true });
    },
  },
  mongol_stipend: {
    when: () => fac('mongol').alive && G.s.year < (G.s.flags.mongolYear || 1208) + 50 && G.s.season === 0,
    silent: true,
    run: () => {
      const f = fac('mongol');
      f.gold += 250;
      f.horses += 200;
      const own = factionProvinces('mongol');
      if (own.length && G.s.year < (G.s.flags.mongolYear || 1208) + 42 && factionArmies('mongol').reduce((x, a) => x + a.units.length, 0) < 30) {
        addUnits('mongol', own[0], rep(['mongol_ha', 'mongol_ha', 'keshig'], 14));
      }
    },
  },
  mamluks: {
    when: () => G.s.year >= 1250 && G.s.year <= 1260 && !G.s.flags.mamluk && !fac('mamluk').alive && prov('egypt').owner !== 'mamluk' && fac(prov('egypt').owner).religion === 'sunni' && prov('egypt').owner !== G.s.player,
    run: () => {
      G.s.flags.mamluk = true;
      const old = prov('egypt').owner;
      const provs = ['egypt', 'alexandria', 'upper_egypt'].filter((p) => prov(p).owner === old);
      spawnFaction('mamluk', { gold: 700, provinces: provs, ruler: { n: d('Aibak', 'Aybek'), born: 1210, mar: 7, adm: 6, traits: ['ambitious'] }, armies: [{ prov: 'egypt', units: rep(['ghulam', 'ghulam', 'horse_archers', 'archers', 'spearmen'], 16) }], wars: [old], techs: ['ghulam', 'iqta', 'naphtha', 'siege_mangonel', 'fortification'] });
      fac('mamluk').culture = 'turkic';
      log('ev.mamluks', {}, { imp: true });
    },
  },
  fourth_crusade: {
    when: () => G.s.year === 1203 && G.s.season === 3 && !G.s.flags.c4 && fac('byzantine').alive && prov('constantinople').owner === 'byzantine' && prov('thrace').owner === 'byzantine',
    run: () => {
      G.s.flags.c4 = true;
      spawnFaction('crusader', { gold: 800, ruler: fac('crusader').alive ? undefined : { n: d('Balduin von Flandern', 'Flandreli Baudouin'), born: 1172, mar: 6, traits: ['ambitious'] }, armies: [{ prov: 'thrace', units: rep(['knights', 'knights', 'sergeants', 'crossbows'], 18) }], wars: ['byzantine'] });
      log('ev.fourthCrusade', {}, { imp: true });
    },
  },
  mongol_china: {
    when: () => fac('mongol').alive && !G.s.flags.mongolChina && G.s.year >= (G.s.flags.mongolYear || 1208) + 4,
    run: () => {
      G.s.flags.mongolChina = true;
      const targets = ['xingqing', 'yanjing'].map((p) => prov(p).owner).filter((o) => o && o !== 'mongol' && fac(o)?.alive && fac(o).overlord !== 'mongol');
      const own = factionProvinces('mongol');
      if (!own.length || !targets.length) return;
      addUnits('mongol', own[0], rep(['mongol_ha', 'mongol_ha', 'mongol_ha', 'keshig', 'mangonel'], 16));
      for (const t of targets.slice(0, 1)) if (!atWar('mongol', t)) declareWar('mongol', t);
      log('ev.mongolChina', { fac: facName(targets[0]) }, { imp: true, rg: 'east' });
    },
  },
  jin_rise: {
    when: () => G.s.year >= 1114 && G.s.year <= 1125 && !G.s.flags.jinRise && !fac('jin').alive && fac('liao').alive && prov('jurchen').owner !== G.s.player,
    run: () => {
      const s = G.s;
      s.flags.jinRise = true;
      const old = prov('jurchen').owner;
      const provs = ['jurchen', ...(prov('liaodong').owner === 'liao' ? ['liaodong'] : [])];
      spawnFaction('jin', {
        gold: 700, horses: 600, prestige: 80, gov: 'sultanate', provinces: provs,
        ruler: { n: d('Wanyan Aguda', 'Wanyan Aguda'), born: 1068, mar: 10, adm: 7, dip: 6, traits: ['strategist', 'ambitious'] },
        armies: [{ prov: 'jurchen', units: rep(['iron_pagoda', 'horse_archers', 'horse_archers', 'spearmen'], 16) }, { prov: 'jurchen', units: rep(['iron_pagoda', 'horse_archers', 'horse_archers'], 12) }],
        wars: ['liao'], techs: ['heavy_lancers', 'kurultai'],
      });
      if (old && old !== 'jin' && old !== 'liao') checkFactionDeath(old, 'jin');
      log('ev.jinRise', {}, { imp: true, rg: 'east' });
    },
  },
  jin_south: {
    when: () => G.s.year >= 1125 && G.s.year <= 1130 && !G.s.flags.jinSouth && fac('jin').alive && fac('song').alive && G.s.player !== 'jin' && !atWar('jin', 'song'),
    run: () => {
      G.s.flags.jinSouth = true;
      const own = factionProvinces('jin');
      const at = own.find((p) => neighbors(p).some((n) => prov(n).owner === 'song')) || own[0];
      if (!at) return;
      addUnits('jin', at, rep(['iron_pagoda', 'horse_archers', 'horse_archers', 'spearmen', 'mangonel'], 18));
      declareWar('jin', 'song');
      log('ev.jinSouth', {}, { imp: true, rg: 'east' });
    },
  },
  hilal_invasion: {
    when: () => G.s.year >= 1050 && G.s.year <= 1057 && !G.s.flags.hilal && G.s.startYear < 1050 && !fac('hilal').alive && prov('cyrenaica').owner !== G.s.player,
    run: () => {
      G.s.flags.hilal = true;
      const old = prov('cyrenaica').owner;
      const targets = ['cyrenaica', 'tripolitania', 'ifriqiya'].map((p) => prov(p).owner).filter((o) => o && o !== 'hilal');
      spawnFaction('hilal', {
        gold: 300, horses: 400, gov: 'nomad', provinces: ['cyrenaica'],
        ruler: { n: d('Mu’nis ibn Yahya', 'Münis bin Yahya'), born: 1010, mar: 7, traits: ['brave', 'greedy'] },
        armies: [{ prov: 'cyrenaica', units: rep(['bedouin', 'bedouin', 'camels', 'bedouin'], 16) }],
        wars: [...new Set(targets)],
      });
      if (old && fac(old)?.alive && !factionProvinces(old).length) checkFactionDeath(old, 'hilal');
      log('ev.hilal', {}, { imp: true, rg: 'africa' });
    },
  },
  almoravid_rise: {
    when: () => G.s.year >= 1053 && G.s.year <= 1062 && !G.s.flags.almoravid && G.s.startYear < 1050 && !fac('almoravid').alive && prov('awdaghust').owner !== G.s.player,
    run: () => {
      G.s.flags.almoravid = true;
      const provs = ['awdaghust', ...(prov('sijilmasa').owner !== G.s.player ? ['sijilmasa'] : [])];
      const olds = [...new Set(provs.map((p) => prov(p).owner))];
      spawnFaction('almoravid', {
        gold: 400, horses: 300, gov: 'nomad', provinces: provs,
        ruler: { n: d('Abu Bakr ibn Umar', 'Ebubekir bin Ömer'), born: 1020, mar: 8, adm: 6, traits: ['pious', 'ghazi'] },
        armies: [{ prov: provs[0], units: rep(['murabitun', 'camels', 'jinetes', 'murabitun'], 14) }],
        wars: olds, techs: ['sufi'],
      });
      fac('almoravid').ai.aggr = 0.85;
      for (const o of olds) if (o && fac(o)?.alive && !factionProvinces(o).length) checkFactionDeath(o, 'almoravid');
      log('ev.almoravid', {}, { imp: true, rg: 'africa' });
    },
  },
  almohad_rise: {
    when: () => G.s.year >= 1121 && G.s.year <= 1147 && !G.s.flags.almohad && !fac('almohad').alive && G.s.startYear < 1121 && prov('marrakesh').owner !== G.s.player && G.s.year >= 1121 + (G.s.flags.almohadDelay ?? (G.s.flags.almohadDelay = rng().int(0, 18))),
    run: () => {
      G.s.flags.almohad = true;
      const old = prov('marrakesh').owner;
      spawnFaction('almohad', {
        gold: 500, horses: 300, gov: 'sultanate', provinces: ['marrakesh'],
        ruler: { n: d('Abd al-Mumin', 'Abdülmü\'min'), born: 1094, mar: 9, adm: 8, dip: 6, traits: ['strategist', 'pious', 'ambitious'] },
        armies: [{ prov: 'marrakesh', units: rep(['murabitun', 'jinetes', 'archers', 'murabitun', 'camels'], 16) }],
        wars: [old], techs: ['sufi', 'iqta'],
      });
      if (old && fac(old)?.alive && !factionProvinces(old).length) checkFactionDeath(old, 'almohad');
      log('ev.almohad', {}, { imp: true, rg: 'africa' });
    },
  },
  mali_rise: {
    when: () => G.s.year >= 1230 && G.s.year <= 1240 && !G.s.flags.mali && G.s.player !== 'mali' && prov('mali').owner !== G.s.player,
    run: () => {
      G.s.flags.mali = true;
      const f = fac('mali');
      if (!f.alive) spawnFaction('mali', { gold: 500, provinces: ['mali'], ruler: { n: d('Sundiata Keita', 'Sundiata Keita'), born: 1217, mar: 9, adm: 7, dip: 7, traits: ['strategist', 'charismatic'] } });
      else { f.gold += 500; f.prestige += 40; }
      const own = factionProvinces('mali');
      if (!own.length) return;
      addUnits('mali', own[0], rep(['mande_cav', 'sahel_archers', 'mande_cav', 'spearmen'], 16));
      const target = prov('ghana').owner;
      if (target && target !== 'mali' && fac(target)?.alive && !atWar('mali', target)) declareWar('mali', target);
      log('ev.mali', {}, { imp: true, rg: 'africa' });
    },
  },
};

function rumProvinces() {
  return ['konya', 'kayseri', 'ankara', 'phrygia', 'sivas', 'amasya', 'malatya', 'nicaea', 'paphlagonia', 'smyrna', 'attaleia'].filter((p) => prov(p).owner === 'seljuk');
}

function foundRum(vassal) {
  G.s.flags.rum = true;
  const provs = rumProvinces();
  if (!provs.length) return;
  const cap = provs.includes('konya') ? 'konya' : provs[0];
  spawnFaction('rum', { gold: 300, provinces: [cap, ...provs.filter((p) => p !== cap)], gov: 'sultanate', ruler: { n: d('Sulaiman ibn Kutalmisch', 'Kutalmışoğlu Süleyman'), born: 1045, mar: 7, adm: 5, traits: ['brave', 'ambitious'] }, armies: [{ prov: cap, units: rep(['horse_archers', 'turkmen', 'turkmen', 'tarkhan'], 12) }], techs: ['iqta', 'turan_tactics'] });
  if (vassal) fac('rum').overlord = 'seljuk';
  if (fac('byzantine').alive) { const r = rel('rum', 'byzantine'); r.war = true; r.warStart = G.s.turn; r.score = {}; }
  log('ev.rum', {}, { imp: true });
}

function foundDelhi(vassal) {
  G.s.flags.delhi = true;
  const provs = ['delhi', 'lahore', 'kanauj'].filter((p) => prov(p).owner === 'ghurid');
  spawnFaction('delhi', { gold: 500, provinces: provs, gov: 'sultanate', ruler: { n: d('Qutb ad-Din Aibak', 'Kutbeddin Aybek'), born: 1150, mar: 8, adm: 6, traits: ['ambitious', 'generous'] }, armies: [{ prov: provs[0], units: rep(['ghulam', 'horse_archers', 'elephants', 'rajputs', 'archers'], 14) }], techs: ['ghulam', 'iqta'] });
  const general = Object.values(G.s.chars).find((c) => c.alive && c.fac === 'ghurid' && c.n.de.includes('Aibak'));
  if (general) killChar(general, 'left');
  if (vassal) fac('delhi').overlord = 'ghurid';
  else { const r = rel('delhi', 'ghurid'); r.war = true; r.warStart = G.s.turn; r.score = {}; }
  log('ev.delhi', {}, { imp: true });
}

export function runGlobalEvents() {
  const s = G.s;
  for (const [id, ev] of Object.entries(GLOBAL_EVENTS)) {
    let ok = false;
    try { ok = ev.when(); } catch (e) { console.error(e); ok = false; }
    if (!ok) continue;
    if (ev.player && ev.player() && !s.observer) {
      s.flags[id] = true;
      s.pending.push({ type: 'global', id });
    } else ev.run();
  }
}
