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
  // --- Wissen aus fernen Ländern (reqRegion: Kontakt nötig, reveal: enthüllt Weltgegend) ---
  gunpowder: {
    br: 'mil', tier: 3, req: ['siege_mangonel'], cost: 170, minYear: 1040, reqRegion: 'east',
    n: { de: 'Schießpulver', tr: 'Barut' },
    desc: { de: 'Das chinesische „Feuermittel“ aus Salpeter, Schwefel und Kohle. Schaltet Feuerlanzen frei, Sturmangriffe +10 %. Setzt Kontakt mit China voraus.', tr: 'Güherçile, kükürt ve kömürden Çin\'in "ateş ilacı". Ateş mızraklarını açar, hücumlar +%10. Çin ile temas gerektirir.' },
    mods: { assault: 0.1 },
  },
  longbow: {
    br: 'mil', tier: 2, req: ['composite_bow'], cost: 90, minYear: 1130, reqRegion: 'europe',
    n: { de: 'Langbogen', tr: 'Uzun Yay' },
    desc: { de: 'Der walisische Eibenbogen durchschlägt Kettenhemden. Schaltet Langbogenschützen frei (England, Wales), Fernkampf +5 %. Setzt Kontakt mit dem Abendland voraus.', tr: 'Gal porsuk yayı zincir zırhı deler. Uzun yaylı okçuları açar (İngiltere), uzak muharebe +%5. Batı ile temas gerektirir.' },
    mods: { ranged: 0.05 },
  },
  west_envoys: {
    br: 'adm', tier: 2, req: ['diwan'], cost: 100, reveal: 'europe',
    n: { de: 'Gesandte ins Abendland', tr: 'Batı\'ya Elçiler' },
    desc: { de: 'Kaufleute und Gesandte reisen zu den Franken, nach Rom und in die Länder jenseits der Donau. Enthüllt Europa auf der Karte. Ansehen +0,5.', tr: 'Tüccarlar ve elçiler Frenklere, Roma\'ya ve Tuna\'nın ötesine gider. Avrupa\'yı haritada açar. İtibar +0,5.' },
    mods: { prestige: 0.5 },
  },
  east_envoys: {
    br: 'adm', tier: 2, req: ['diwan'], cost: 100, reveal: 'east',
    n: { de: 'Gesandte an den Kaiserhof', tr: 'İmparatorluk Sarayına Elçiler' },
    desc: { de: 'Tributgesandtschaften ziehen über den Hexi-Korridor nach China, in die Mongolei und nach Tibet. Enthüllt den Fernen Osten. Handelsrouten +3 %.', tr: 'Haraç elçilikleri Hexi Koridoru üzerinden Çin\'e, Moğolistan\'a ve Tibet\'e gider. Uzak Doğu\'yu açar. Ticaret yolları +%3.' },
    mods: { route: 0.03 },
  },
  orient_envoys: {
    br: 'adm', tier: 2, req: ['diwan'], cost: 100, reveal: 'orient',
    n: { de: 'Pilger ins Morgenland', tr: 'Doğu\'ya Hacılar' },
    desc: { de: 'Pilger, Kaufleute und Mönche berichten vom Heiligen Land, von Bagdad und den Steppen. Enthüllt den Orient. Ordnung +1.', tr: 'Hacılar, tüccarlar ve rahipler Kutsal Topraklar\'dan, Bağdat\'tan ve bozkırlardan haber getirir. Doğu\'yu açar. Asayiş +1.' },
    mods: { order: 1 },
  },
  sahara_caravans: {
    br: 'eco', tier: 2, req: ['caravanserai'], cost: 110, reveal: 'africa',
    n: { de: 'Karawanen durch die Sahara', tr: 'Sahra Kervanları' },
    desc: { de: 'Mit Kamelen und Salzbarren zu den Goldländern des Sudan und nach Abessinien. Enthüllt Afrika. Handelsrouten +5 %.', tr: 'Develer ve tuz kalıplarıyla Sudan\'ın altın ülkelerine ve Habeşistan\'a. Afrika\'yı açar. Ticaret yolları +%5.' },
    mods: { route: 0.05 },
  },
  compass: {
    br: 'eco', tier: 2, req: [], cost: 110, reqRegion: 'east',
    n: { de: 'Kompass', tr: 'Pusula' },
    desc: { de: 'Die „südweisende Nadel“ der chinesischen Seefahrer. Handelsrouten +10 %. Setzt Kontakt mit China voraus.', tr: 'Çinli denizcilerin "güneyi gösteren iğnesi". Ticaret yolları +%10. Çin ile temas gerektirir.' },
    mods: { route: 0.1 },
  },
  three_field: {
    br: 'eco', tier: 2, req: [], cost: 100, minYear: 1050, reqRegion: 'europe',
    n: { de: 'Dreifelderwirtschaft', tr: 'Üç Tarla Sistemi' },
    desc: { de: 'Schwerer Pflug und Fruchtwechsel aus dem Abendland. Wachstum und Steuern +3 %. Setzt Kontakt mit Europa voraus.', tr: 'Batı\'dan ağır saban ve ekim nöbeti. Büyüme ve vergi +%3. Avrupa ile temas gerektirir.' },
    mods: { growth: 0.0006, tax: 0.03 },
  },
  printing: {
    br: 'cul', tier: 3, req: ['paper'], cost: 150, reqRegion: 'east',
    n: { de: 'Blockdruck', tr: 'Baskı Sanatı' },
    desc: { de: 'Gedruckte Bücher, Kalender und Papiergeld. Forschung +12 %. Setzt Kontakt mit China voraus.', tr: 'Basılı kitaplar, takvimler ve kâğıt para. Araştırma +%12. Çin ile temas gerektirir.' },
    mods: { research: 0.12 },
  },
  world_map: {
    br: 'cul', tier: 3, req: ['mathematics'], cost: 180, minYear: 1120, reveal: 'all',
    n: { de: 'Weltkarte des al-Idrisi', tr: 'İdrisi\'nin Dünya Haritası' },
    desc: { de: 'Eine silberne Weltscheibe und ein Buch aller Länder: Enthüllt die ganze bekannte Welt. Forschung und Handelsrouten +5 %.', tr: 'Gümüş bir dünya diski ve bütün ülkelerin kitabı: Bilinen bütün dünyayı açar. Araştırma ve ticaret yolları +%5.' },
    mods: { research: 0.05, route: 0.05 },
  },
};

export function techCost(tech, doneCount) {
  return Math.round(tech.cost * (1 + doneCount * 0.15));
}
