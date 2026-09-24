// Forschungsbaum. mods werden zu Fraktionsmodifikatoren addiert.
// minYear: frühestes Jahr, ab dem die Technologie erforscht werden kann.

export const TECH_BRANCHES = {
  mil: { n: { de: 'Kriegskunst', tr: 'Harp Sanatı' }, color: '#8b1a1a' },
  adm: { n: { de: 'Verwaltung', tr: 'Yönetim' }, color: '#1f4e79' },
  eco: { n: { de: 'Wirtschaft', tr: 'İktisat' }, color: '#6b5b1f' },
  cul: { n: { de: 'Kultur & Wissenschaft', tr: 'Kültür ve İlim' }, color: '#4a235a' },
};

export const TECHS = {
  // --- Kriegskunst ---
  composite_bow: {
    br: 'mil', tier: 1, req: [], cost: 60,
    n: { de: 'Kompositbogen-Handwerk', tr: 'Terkip Yay Sanatı' },
    desc: { de: 'Horn, Holz und Sehne verleimt: Fernkampf +10 %.', tr: 'Boynuz, ağaç ve sinir tutkalla birleşir: uzak muharebe +%10.' },
    mods: { ranged: 0.1 },
  },
  lamellar: {
    br: 'mil', tier: 2, req: ['composite_bow'], cost: 100,
    n: { de: 'Lamellenpanzer', tr: 'Pullu Zırh' },
    desc: { de: 'Verschnürte Eisenplättchen: Verteidigung der Reiterei +10 %.', tr: 'Bağlanmış demir pullar: süvari savunması +%10.' },
    mods: { cavDef: 0.1 },
  },
  ghulam: {
    br: 'mil', tier: 2, req: ['composite_bow'], cost: 110,
    n: { de: 'Ghulam-System', tr: 'Gulam Sistemi' },
    desc: { de: 'Ausbildung von Militärsklaven zur Elitegarde (islamische Staaten). Schaltet die Ghulam-Garde frei.', tr: 'Askerî kölelerin seçkin muhafız olarak yetiştirilmesi (İslam devletleri). Gulam muhafızlarını açar.' },
    mods: {},
  },
  turan_tactics: {
    br: 'mil', tier: 2, req: ['composite_bow'], cost: 90,
    n: { de: 'Turan-Taktik', tr: 'Turan Taktiği' },
    desc: { de: 'Perfektionierte vorgetäuschte Flucht: +20 % Wirkung dieser Taktik.', tr: 'Mükemmelleştirilmiş sahte ricat: bu taktiğin etkisi +%20.' },
    mods: { feigned: 0.2 },
  },
  siege_mangonel: {
    br: 'mil', tier: 2, req: [], cost: 90,
    n: { de: 'Mandschanik', tr: 'Mancınık' },
    desc: { de: 'Zugkatapulte für Belagerungen. Schaltet den Mandschanik frei.', tr: 'Kuşatmalar için çekmeli mancınıklar. Mancınığı açar.' },
    mods: { assault: 0.1 },
  },
  fortification: {
    br: 'mil', tier: 3, req: ['siege_mangonel'], cost: 140,
    n: { de: 'Festungsbau', tr: 'Kale Mimarisi' },
    desc: { de: 'Zitadellen und Flankentürme. Garnisonen +25 %.', tr: 'İç kaleler ve yan kuleler. Garnizonlar +%25.' },
    mods: { garrison: 0.25 },
  },
  naphtha: {
    br: 'mil', tier: 3, req: ['siege_mangonel'], cost: 130,
    n: { de: 'Naphtha-Feuer', tr: 'Neft Ateşi' },
    desc: { de: 'Brandwaffen aus Erdöl. Schaltet Naphtha-Werfer frei.', tr: 'Petrolden yangın silahları. Neftçileri açar.' },
    mods: { assault: 0.1 },
  },
  heavy_lancers: {
    br: 'mil', tier: 3, req: ['lamellar'], cost: 150,
    n: { de: 'Schwere Lanzenreiterei', tr: 'Ağır Mızraklı Süvari' },
    desc: { de: 'Wucht des Reiterangriffs +15 %.', tr: 'Süvari hücumunun gücü +%15.' },
    mods: { charge: 0.15 },
  },
  counterweight: {
    br: 'mil', tier: 4, req: ['fortification'], cost: 200, minYear: 1150,
    n: { de: 'Gegengewicht-Tribok', tr: 'Karşı Ağırlıklı Mancınık' },
    desc: { de: 'Die schwerste Belagerungsmaschine. Sturmangriffe +15 %.', tr: 'En ağır kuşatma makinesi. Hücumlar +%15.' },
    mods: { assault: 0.15 },
  },
  // --- Verwaltung ---
  diwan: {
    br: 'adm', tier: 1, req: [], cost: 60,
    n: { de: 'Diwan-Kanzlei', tr: 'Divan Teşkilatı' },
    desc: { de: 'Persische Schreiber führen die Staatskanzlei. Steuern +5 %, Ordnung +2.', tr: 'Fars kâtipler devlet dairesini yönetir. Vergi +%5, asayiş +2.' },
    mods: { tax: 0.05, order: 2 },
  },
  iqta: {
    br: 'adm', tier: 2, req: ['diwan'], cost: 100,
    n: { de: 'Iqta-System', tr: 'İkta Sistemi' },
    desc: { de: 'Steuerrechte gegen Kriegsdienst. Ermöglicht die Iqta-Politik (weniger Sold, etwas weniger Steuern).', tr: 'Askerlik karşılığı vergi hakkı. İkta politikasını açar (daha az ulufe, biraz daha az vergi).' },
    mods: {},
  },
  barid: {
    br: 'adm', tier: 2, req: ['diwan'], cost: 100,
    n: { de: 'Barid-Post', tr: 'Berid Teşkilatı' },
    desc: { de: 'Reiterstafetten und Kundschafter. Nachteil durch Entfernung zur Hauptstadt −40 %.', tr: 'Atlı ulaklar ve haberciler. Başkente uzaklık cezası −%40.' },
    mods: { distance: -0.4 },
  },
  vizierate: {
    br: 'adm', tier: 3, req: ['diwan'], cost: 130,
    n: { de: 'Wesirat', tr: 'Vezirlik' },
    desc: { de: 'Ein mächtiger Wesir leitet den Staat. Wirkung des Wesirs +50 %.', tr: 'Güçlü bir vezir devleti yönetir. Vezirin etkisi +%50.' },
    mods: { vizier: 0.5 },
  },
  cadastre: {
    br: 'adm', tier: 3, req: ['diwan'], cost: 130,
    n: { de: 'Steuerkataster', tr: 'Vergi Tahriri' },
    desc: { de: 'Land wird vermessen und erfasst. Steuern +10 %.', tr: 'Arazi ölçülür ve kaydedilir. Vergi +%10.' },
    mods: { tax: 0.1 },
  },
  atabeg: {
    br: 'adm', tier: 3, req: ['iqta'], cost: 140,
    n: { de: 'Atabeg-Wesen', tr: 'Atabeglik' },
    desc: { de: 'Erzieher für die Prinzen. Weniger Thronstreit, bessere Erben.', tr: 'Şehzadeler için lalalar. Daha az taht kavgası, daha iyi veliahtlar.' },
    mods: { succession: 0.3 },
  },
  kurultai: {
    br: 'adm', tier: 2, req: [], cost: 90,
    n: { de: 'Kurultai', tr: 'Kurultay' },
    desc: { de: 'Die Versammlung der Stammesfürsten. Erlaubt die Wahlnachfolge und die Große Ordu. Ordnung in türkischen Provinzen +3.', tr: 'Boy beylerinin meclisi. Seçimli veraseti ve Ordu-Balık\'ı açar. Türk eyaletlerinde asayiş +3.' },
    mods: { steppeOrder: 3 },
  },
  mint: {
    br: 'adm', tier: 4, req: ['cadastre'], cost: 180,
    n: { de: 'Münzreform', tr: 'Sikke Reformu' },
    desc: { de: 'Stabile Silber- und Golddinar. Alle Einnahmen +8 %.', tr: 'İstikrarlı gümüş ve altın dinarlar. Tüm gelirler +%8.' },
    mods: { income: 0.08 },
  },
  qadi_courts: {
    br: 'adm', tier: 2, req: ['diwan'], cost: 110,
    n: { de: 'Richterwesen', tr: 'Kadılık' },
    desc: { de: 'Richter in jeder Stadt. Ordnung +4.', tr: 'Her şehirde kadı. Asayiş +4.' },
    mods: { order: 4 },
  },
  // --- Wirtschaft ---
  qanat: {
    br: 'eco', tier: 1, req: [], cost: 70,
    n: { de: 'Kanate', tr: 'Kârizler' },
    desc: { de: 'Unterirdische Wasserleitungen. Ermöglicht Bewässerung Stufe 2.', tr: 'Yeraltı su kanalları. 2. seviye sulamayı açar.' },
    mods: { growth: 0.0005 },
  },
  caravanserai: {
    br: 'eco', tier: 1, req: [], cost: 70,
    n: { de: 'Karawanserei-Netz', tr: 'Kervansaray Ağı' },
    desc: { de: 'Befestigte Rasthäuser entlang der Handelswege. Routeneinnahmen +20 %.', tr: 'Ticaret yolları boyunca tahkimli hanlar. Yol gelirleri +%20.' },
    mods: { route: 0.2 },
  },
  paper: {
    br: 'eco', tier: 2, req: [], cost: 90,
    n: { de: 'Papierherstellung', tr: 'Kâğıt Yapımı' },
    desc: { de: 'Das Papier aus Samarkand verändert Verwaltung und Wissenschaft. Forschung +10 %.', tr: 'Semerkant kâğıdı yönetimi ve ilmi değiştirir. Araştırma +%10.' },
    mods: { research: 0.1 },
  },
  cotton: {
    br: 'eco', tier: 2, req: ['qanat'], cost: 100,
    n: { de: 'Baumwollanbau', tr: 'Pamuk Tarımı' },
    desc: { de: 'Neue Nutzpflanzen und Fruchtfolgen. Güter +10 %, Wachstum +.', tr: 'Yeni ekinler ve münavebe. Ticaret malları +%10, büyüme artar.' },
    mods: { goods: 0.1, growth: 0.0005 },
  },
  windmill: {
    br: 'eco', tier: 3, req: ['qanat'], cost: 140,
    n: { de: 'Windmühlen', tr: 'Yel Değirmenleri' },
    desc: { de: 'Die Windmühlen Sistans. Ermöglicht Bewässerung Stufe 3.', tr: 'Sistan\'ın yel değirmenleri. 3. seviye sulamayı açar.' },
    mods: { tax: 0.03 },
  },
  sakk: {
    br: 'eco', tier: 3, req: ['caravanserai'], cost: 140,
    n: { de: 'Wechselbriefe (Sakk)', tr: 'Senet (Sakk)' },
    desc: { de: 'Kaufleute zahlen mit Schecks über weite Strecken. Handel +15 %.', tr: 'Tüccarlar uzak mesafelerde senetle ödeme yapar. Ticaret +%15.' },
    mods: { trade: 0.15 },
  },
  bazaar: {
    br: 'eco', tier: 3, req: ['caravanserai'], cost: 130,
    n: { de: 'Große Basare', tr: 'Büyük Çarşılar' },
    desc: { de: 'Überdachte Märkte und Zünfte. Ermöglicht den Großen Basar.', tr: 'Kapalı çarşılar ve loncalar. Büyük çarşıyı açar.' },
    mods: { tax: 0.03 },
  },
  horse_breeding: {
    br: 'eco', tier: 2, req: [], cost: 90,
    n: { de: 'Pferdezucht', tr: 'At Yetiştiriciliği' },
    desc: { de: 'Zucht edler Rassen. Pferde +25 %.', tr: 'Soylu cinslerin yetiştirilmesi. At +%25.' },
    mods: { horses: 0.25 },
  },
  mining: {
    br: 'eco', tier: 2, req: [], cost: 100,
    n: { de: 'Bergbau', tr: 'Madencilik' },
    desc: { de: 'Tiefere Stollen: Eisen, Kupfer, Silber, Gold und Edelsteine +50 %.', tr: 'Daha derin galeriler: demir, bakır, gümüş, altın ve değerli taşlar +%50.' },
    mods: { mining: 0.5 },
  },
  // --- Kultur ---
  madrasa: {
    br: 'cul', tier: 1, req: [], cost: 70,
    n: { de: 'Hochschulen', tr: 'Medreseler' },
    desc: { de: 'Stiftungen für Gelehrte. Ermöglicht Madrasa/Akademie.', tr: 'Âlimler için vakıflar. Medrese/akademiyi açar.' },
    mods: { research: 0.05 },
  },
  astronomy: {
    br: 'cul', tier: 3, req: ['madrasa', 'mathematics'], cost: 160,
    n: { de: 'Sternkunde', tr: 'Astronomi' },
    desc: { de: 'Sternwarten und der Dschalali-Kalender. Forschung +15 %.', tr: 'Rasathaneler ve Celali takvimi. Araştırma +%15.' },
    mods: { research: 0.15 },
  },
  medicine: {
    br: 'cul', tier: 2, req: ['madrasa'], cost: 110,
    n: { de: 'Heilkunst', tr: 'Tıp' },
    desc: { de: 'Der Kanon der Medizin. Seuchen schwächer, Herrscher leben länger.', tr: 'Tıp Kanunu. Salgınlar daha zayıf, hükümdarlar daha uzun yaşar.' },
    mods: { health: 0.3, growth: 0.0005 },
  },
  sufi: {
    br: 'cul', tier: 2, req: [], cost: 100,
    n: { de: 'Sufi-Orden', tr: 'Tasavvuf Tarikatları' },
    desc: { de: 'Derwische wie Ahmed Yesevi predigen den Nomaden. Bekehrung +50 %, Ordnung in Steppenprovinzen +3.', tr: 'Ahmed Yesevi gibi dervişler göçebelere vaaz eder. Din değiştirme +%50, bozkır eyaletlerinde asayiş +3.' },
    mods: { convert: 0.5, steppeOrder: 3 },
  },
  poetry: {
    br: 'cul', tier: 1, req: [], cost: 60,
    n: { de: 'Hofdichtung', tr: 'Saray Şiiri' },
    desc: { de: 'Werke wie das Kutadgu Bilig verherrlichen den Herrscher. Ansehen +1 pro Runde.', tr: 'Kutadgu Bilig gibi eserler hükümdarı yüceltir. Tur başına itibar +1.' },
    mods: { prestige: 1 },
  },
  architecture: {
    br: 'cul', tier: 2, req: ['madrasa'], cost: 120,
    n: { de: 'Muqarnas-Baukunst', tr: 'Mukarnas Mimarisi' },
    desc: { de: 'Kuppeln und Stalaktitgewölbe. Baukosten −15 %, höchste Stufe der Sakralbauten.', tr: 'Kubbeler ve mukarnaslar. İnşaat maliyeti −%15, en yüksek seviye ibadethaneler.' },
    mods: { buildCost: -0.15 },
  },
  translation: {
    br: 'cul', tier: 2, req: ['madrasa'], cost: 110,
    n: { de: 'Übersetzerschulen', tr: 'Tercüme Okulları' },
    desc: { de: 'Griechisches, persisches und indisches Wissen. Forschung +10 %.', tr: 'Yunan, Fars ve Hint ilmi. Araştırma +%10.' },
    mods: { research: 0.1 },
  },
  mathematics: {
    br: 'cul', tier: 2, req: ['madrasa'], cost: 120,
    n: { de: 'Algebra', tr: 'Cebir' },
    desc: { de: 'Das Erbe al-Chwarizmis. Forschung +5 %, Steuern +3 %.', tr: 'Harezmî\'nin mirası. Araştırma +%5, vergi +%3.' },
    mods: { research: 0.05, tax: 0.03 },
  },
  historiography: {
    br: 'cul', tier: 3, req: ['poetry'], cost: 130,
    n: { de: 'Geschichtsschreibung', tr: 'Tarih Yazıcılığı' },
    desc: { de: 'Chroniken sichern den Ruhm der Dynastie. Ansehen +2 pro Runde, Legitimität bei der Nachfolge.', tr: 'Vakayinameler hanedanın şanını korur. Tur başına itibar +2, verasette meşruiyet.' },
    mods: { prestige: 2, succession: 0.15 },
  },
};

export function techCost(tech, doneCount) {
  return Math.round(tech.cost * (1 + doneCount * 0.15));
}
