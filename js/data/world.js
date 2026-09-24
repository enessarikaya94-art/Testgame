// Grundlegende Weltdefinitionen: Gelände, Religionen, Kulturen, Handelsgüter, Regierungsformen.

export const TERRAINS = {
  steppe:   { n: { de: 'Steppe', tr: 'Bozkır' }, move: 1, pasture: 4, fert: 1, def: 0, color: '#d9c98f', cav: 1.2, inf: 1.0 },
  desert:   { n: { de: 'Wüste', tr: 'Çöl' }, move: 1.5, pasture: 1.5, fert: 0, def: 0, color: '#e6d3a0', cav: 1.1, inf: 0.9 },
  oasis:    { n: { de: 'Oase', tr: 'Vaha' }, move: 1, pasture: 1, fert: 3, def: 0.05, color: '#c9cf8d', cav: 1.05, inf: 1.0 },
  farmland: { n: { de: 'Ackerland', tr: 'Tarım Arazisi' }, move: 1, pasture: 1, fert: 3, def: 0, color: '#c7c98a', cav: 1.1, inf: 1.0 },
  river:    { n: { de: 'Flussland', tr: 'Nehir Vadisi' }, move: 1, pasture: 1.5, fert: 4, def: 0.05, color: '#b7c88b', cav: 1.0, inf: 1.05 },
  hills:    { n: { de: 'Hügelland', tr: 'Tepelik' }, move: 1.5, pasture: 2.5, fert: 2, def: 0.1, color: '#c8b98a', cav: 0.95, inf: 1.05 },
  mountain: { n: { de: 'Gebirge', tr: 'Dağlık' }, move: 2, pasture: 1.5, fert: 1, def: 0.2, color: '#b5a58a', cav: 0.75, inf: 1.15 },
  forest:   { n: { de: 'Wald', tr: 'Orman' }, move: 1.5, pasture: 0.7, fert: 2, def: 0.15, color: '#a8b384', cav: 0.8, inf: 1.1 },
};

export const RELIGIONS = {
  tengri:      { n: { de: 'Tengrismus', tr: 'Tengricilik' }, group: 'pagan', color: '#6fa0c8' },
  sunni:       { n: { de: 'Sunnitischer Islam', tr: 'Sünni İslam' }, group: 'islam', color: '#3f8f4f' },
  shia:        { n: { de: 'Schiitischer Islam', tr: 'Şii İslam' }, group: 'islam', color: '#1f5f3a' },
  ismaili:     { n: { de: 'Ismailiten', tr: 'İsmaililik' }, group: 'islam', color: '#7cb342' },
  orthodox:    { n: { de: 'Orthodoxes Christentum', tr: 'Ortodoks Hristiyanlık' }, group: 'christian', color: '#8e44ad' },
  catholic:    { n: { de: 'Lateinisches Christentum', tr: 'Katolik Hristiyanlık' }, group: 'christian', color: '#c0392b' },
  miaphysite:  { n: { de: 'Orientalische Kirchen', tr: 'Doğu Kiliseleri' }, group: 'christian', color: '#d35400' },
  nestorian:   { n: { de: 'Kirche des Ostens', tr: 'Nasturilik' }, group: 'christian', color: '#e67e22' },
  buddhist:    { n: { de: 'Buddhismus', tr: 'Budizm' }, group: 'dharmic', color: '#f1c40f' },
  manichaean:  { n: { de: 'Manichäismus', tr: 'Maniheizm' }, group: 'iranian', color: '#95a5a6' },
  zoroastrian: { n: { de: 'Zarathustrismus', tr: 'Zerdüştlük' }, group: 'iranian', color: '#e74c3c' },
  hindu:       { n: { de: 'Hinduismus', tr: 'Hinduizm' }, group: 'dharmic', color: '#ff7f50' },
  jewish:      { n: { de: 'Judentum', tr: 'Yahudilik' }, group: 'abrahamic', color: '#2980b9' },
  pagan:       { n: { de: 'Naturreligionen', tr: 'Doğa Dinleri' }, group: 'pagan', color: '#7f8c6d' },
  confucian:   { n: { de: 'Konfuzianismus', tr: 'Konfüçyüsçülük' }, group: 'sinic', color: '#b03060' },
};

// Gegenseitige Einstellung von Religionen (Beziehungsmodifikator)
export function religionAffinity(a, b) {
  if (a === b) return 20;
  const ga = RELIGIONS[a].group, gb = RELIGIONS[b].group;
  const pair = [a, b].sort().join('|');
  const special = {
    'shia|sunni': -15, 'ismaili|sunni': -25, 'ismaili|shia': -10,
    'catholic|orthodox': -5, 'miaphysite|orthodox': -5, 'catholic|miaphysite': -5,
    'buddhist|confucian': 5, 'confucian|tengri': -5, 'buddhist|hindu': 0,
  };
  if (special[pair] !== undefined) return special[pair];
  if (ga === gb) return 5;
  if ((ga === 'islam' && gb === 'christian') || (gb === 'islam' && ga === 'christian')) return -15;
  if (ga === 'pagan' || gb === 'pagan') return -5;
  return -10;
}

export const CULTURES = {
  turkic:   { n: { de: 'Türkisch', tr: 'Türk' }, group: 'steppe', color: '#2e86ab' },
  mongolic: { n: { de: 'Mongolisch-Kitanisch', tr: 'Moğol-Kıtay' }, group: 'steppe', color: '#34495e' },
  persian:  { n: { de: 'Persisch', tr: 'Fars' }, group: 'iranian', color: '#8e6c3a' },
  kurdish:  { n: { de: 'Kurdisch', tr: 'Kürt' }, group: 'iranian', color: '#a0784a' },
  arab:     { n: { de: 'Arabisch', tr: 'Arap' }, group: 'semitic', color: '#27ae60' },
  greek:    { n: { de: 'Griechisch', tr: 'Rum' }, group: 'hellenic', color: '#8e44ad' },
  armenian: { n: { de: 'Armenisch', tr: 'Ermeni' }, group: 'caucasian', color: '#d35400' },
  georgian: { n: { de: 'Georgisch', tr: 'Gürcü' }, group: 'caucasian', color: '#c0392b' },
  alan:     { n: { de: 'Alanisch', tr: 'Alan' }, group: 'caucasian', color: '#b9770e' },
  slavic:   { n: { de: 'Slawisch', tr: 'Slav' }, group: 'european', color: '#5d6d7e' },
  latin:    { n: { de: 'Fränkisch', tr: 'Frenk' }, group: 'european', color: '#bdc3c7' },
  indian:   { n: { de: 'Indisch', tr: 'Hint' }, group: 'indian', color: '#e67e22' },
  nubian:   { n: { de: 'Nubisch', tr: 'Nubyalı' }, group: 'african', color: '#6e2c00' },
  german:   { n: { de: 'Deutsch', tr: 'Alman' }, group: 'european', color: '#7f8c8d' },
  italian:  { n: { de: 'Italienisch', tr: 'İtalyan' }, group: 'european', color: '#a3816a' },
  iberian:  { n: { de: 'Iberisch', tr: 'İber' }, group: 'european', color: '#c49a3c' },
  anglo:    { n: { de: 'Englisch', tr: 'İngiliz' }, group: 'european', color: '#9c3d54' },
  gaelic:   { n: { de: 'Gälisch', tr: 'Gal' }, group: 'european', color: '#4e8a5c' },
  norse:    { n: { de: 'Nordisch', tr: 'İskandinav' }, group: 'european', color: '#4a6fa5' },
  baltic:   { n: { de: 'Baltisch', tr: 'Baltık' }, group: 'european', color: '#7a8c4a' },
  magyar:   { n: { de: 'Ungarisch', tr: 'Macar' }, group: 'steppe', color: '#b35a3b' },
  han:      { n: { de: 'Chinesisch', tr: 'Çinli' }, group: 'sinic', color: '#c0392b' },
  jurchen:  { n: { de: 'Dschurdschisch', tr: 'Curcen' }, group: 'steppe', color: '#5b7c99' },
  tangut:   { n: { de: 'Tangutisch', tr: 'Tangut' }, group: 'tibetan', color: '#8e5f3a' },
  tibetan:  { n: { de: 'Tibetisch', tr: 'Tibetli' }, group: 'tibetan', color: '#a0522d' },
  korean:   { n: { de: 'Koreanisch', tr: 'Koreli' }, group: 'sinic', color: '#3d7ea6' },
  seasian:  { n: { de: 'Südostasiatisch', tr: 'Güneydoğu Asyalı' }, group: 'seasian', color: '#6b8e23' },
  berber:   { n: { de: 'Berberisch', tr: 'Berberi' }, group: 'semitic', color: '#b7950b' },
  sudanic:  { n: { de: 'Westafrikanisch', tr: 'Batı Afrikalı' }, group: 'african', color: '#784212' },
  ethiopian:{ n: { de: 'Äthiopisch', tr: 'Habeş' }, group: 'african', color: '#935116' },
};

export function cultureAffinity(a, b) {
  if (a === b) return 10;
  if (CULTURES[a].group === CULTURES[b].group) return 5;
  return 0;
}

// Handelsgüter: Grundwert (Gold pro Runde)
export const GOODS = {
  horses:   { n: { de: 'Pferde', tr: 'At' }, value: 1.5, icon: '🐎' },
  silk:     { n: { de: 'Seide', tr: 'İpek' }, value: 3, icon: '🧵' },
  cotton:   { n: { de: 'Baumwolle', tr: 'Pamuk' }, value: 1.5, icon: '☁' },
  textiles: { n: { de: 'Tuche & Brokat', tr: 'Kumaş ve Brokar' }, value: 2.5, icon: '🧶' },
  carpets:  { n: { de: 'Teppiche', tr: 'Halı' }, value: 2, icon: '▦' },
  iron:     { n: { de: 'Eisen', tr: 'Demir' }, value: 1.5, icon: '⚒' },
  copper:   { n: { de: 'Kupfer', tr: 'Bakır' }, value: 1.5, icon: '⚱' },
  silver:   { n: { de: 'Silber', tr: 'Gümüş' }, value: 2.5, icon: '◈' },
  gold:     { n: { de: 'Gold', tr: 'Altın' }, value: 3, icon: '✦' },
  gems:     { n: { de: 'Edelsteine', tr: 'Değerli Taşlar' }, value: 2.5, icon: '◆' },
  jade:     { n: { de: 'Jade', tr: 'Yeşim' }, value: 2.5, icon: '◇' },
  furs:     { n: { de: 'Pelze', tr: 'Kürk' }, value: 2, icon: '🦊' },
  wax:      { n: { de: 'Wachs & Honig', tr: 'Bal Mumu' }, value: 1, icon: '🍯' },
  spices:   { n: { de: 'Gewürze', tr: 'Baharat' }, value: 3, icon: '🌶' },
  incense:  { n: { de: 'Weihrauch', tr: 'Tütsü' }, value: 3, icon: '♨' },
  saffron:  { n: { de: 'Safran', tr: 'Safran' }, value: 2.5, icon: '❀' },
  paper:    { n: { de: 'Papier', tr: 'Kâğıt' }, value: 2, icon: '📜' },
  glass:    { n: { de: 'Glas', tr: 'Cam' }, value: 2, icon: '⚗' },
  wine:     { n: { de: 'Wein', tr: 'Şarap' }, value: 1.5, icon: '🍷' },
  dates:    { n: { de: 'Datteln', tr: 'Hurma' }, value: 1, icon: '🌴' },
  sugar:    { n: { de: 'Zucker', tr: 'Şeker' }, value: 2, icon: '▫' },
  salt:     { n: { de: 'Salz', tr: 'Tuz' }, value: 1, icon: '◻' },
  pearls:   { n: { de: 'Perlen', tr: 'İnci' }, value: 2.5, icon: '○' },
  grain:    { n: { de: 'Getreide', tr: 'Tahıl' }, value: 1, icon: '🌾' },
  timber:   { n: { de: 'Holz', tr: 'Kereste' }, value: 1, icon: '🌲' },
  naphtha:  { n: { de: 'Naphtha', tr: 'Neft' }, value: 1.5, icon: '🔥' },
  porcelain:{ n: { de: 'Porzellan', tr: 'Porselen' }, value: 3, icon: '🏺' },
  tea:      { n: { de: 'Tee', tr: 'Çay' }, value: 2, icon: '🍵' },
  wool:     { n: { de: 'Wolle', tr: 'Yün' }, value: 1.5, icon: '🐑' },
  amber:    { n: { de: 'Bernstein', tr: 'Kehribar' }, value: 2, icon: '🟠' },
  ivory:    { n: { de: 'Elfenbein', tr: 'Fildişi' }, value: 2.5, icon: '🦷' },
};

// Handelsrouten: Folge von Provinzen, Wert pro Transitprovinz
export const TRADE_ROUTES = [
  {
    id: 'silk_main', n: { de: 'Seidenstraße (Südroute)', tr: 'İpek Yolu (Güney)' }, value: 3.5,
    path: ['qocho', 'kucha', 'aksu', 'kashgar', 'fergana', 'samarkand', 'bukhara', 'merv', 'nishapur', 'gurgan', 'rey', 'hamadan', 'baghdad', 'raqqa', 'aleppo', 'antioch'],
  },
  {
    id: 'silk_north', n: { de: 'Seidenstraße (Nordroute)', tr: 'İpek Yolu (Kuzey)' }, value: 2.5,
    path: ['qocho', 'almaliq', 'barskhan', 'balasagun', 'talas', 'isfijab', 'shash', 'samarkand'],
  },
  {
    id: 'khotan_route', n: { de: 'Jade-Route', tr: 'Yeşim Yolu' }, value: 1.5,
    path: ['khotan', 'kashgar'],
  },
  {
    id: 'steppe_route', n: { de: 'Steppenroute', tr: 'Bozkır Yolu' }, value: 2,
    path: ['khwarazm', 'mangyshlak', 'itil', 'sarkel', 'tmutarakan', 'crimea', 'constantinople'],
  },
  {
    id: 'volga_route', n: { de: 'Wolga-Route', tr: 'İdil Yolu' }, value: 2,
    path: ['bulgar', 'itil', 'derbent', 'shirvan', 'arran', 'tabriz'],
  },
  {
    id: 'fur_route', n: { de: 'Pelzroute', tr: 'Kürk Yolu' }, value: 1.5,
    path: ['bulgar', 'bashkir', 'yaik', 'khwarazm', 'bukhara'],
  },
  {
    id: 'dnieper_route', n: { de: 'Weg von den Warägern zu den Griechen', tr: 'Varanglardan Rumlara Yol' }, value: 1.5,
    path: ['kiev', 'pontic', 'crimea', 'constantinople'],
  },
  {
    id: 'anatolian', n: { de: 'Anatolische Straße', tr: 'Anadolu Yolu' }, value: 2,
    path: ['tabriz', 'vaspurakan', 'erzurum', 'sivas', 'kayseri', 'konya', 'phrygia', 'nicaea', 'constantinople'],
  },
  {
    id: 'trebizond_route', n: { de: 'Trapezunt-Route', tr: 'Trabzon Yolu' }, value: 1.5,
    path: ['tabriz', 'ani', 'erzurum', 'trebizond'],
  },
  {
    id: 'incense', n: { de: 'Weihrauchstraße', tr: 'Tütsü Yolu' }, value: 2.5,
    path: ['yemen', 'hijaz', 'medina', 'jerusalem', 'damascus'],
  },
  {
    id: 'levant', n: { de: 'Levante-Straße', tr: 'Levant Yolu' }, value: 2,
    path: ['egypt', 'jerusalem', 'damascus', 'aleppo', 'antioch'],
  },
  {
    id: 'gulf', n: { de: 'Golf-Seeroute', tr: 'Körfez Deniz Yolu' }, value: 2.5,
    path: ['gujarat', 'sindh', 'makran', 'oman', 'bahrain', 'basra', 'baghdad'],
  },
  {
    id: 'red_sea', n: { de: 'Rotmeer-Route', tr: 'Kızıldeniz Yolu' }, value: 2,
    path: ['yemen', 'hijaz', 'upper_egypt', 'egypt', 'alexandria'],
  },
  {
    id: 'india_route', n: { de: 'Indienstraße', tr: 'Hint Yolu' }, value: 2.5,
    path: ['kanauj', 'delhi', 'lahore', 'peshawar', 'kabul', 'balkh', 'bukhara'],
  },
  {
    id: 'multan_route', n: { de: 'Multan-Route', tr: 'Multan Yolu' }, value: 1.5,
    path: ['multan', 'ghazna', 'bust', 'herat', 'merv'],
  },
  {
    id: 'persian_road', n: { de: 'Persische Königsstraße', tr: 'Pers Kral Yolu' }, value: 2,
    path: ['nishapur', 'yazd', 'isfahan', 'fars', 'kerman'],
  },
  {
    id: 'khuzistan_road', n: { de: 'Chusistan-Straße', tr: 'Huzistan Yolu' }, value: 1.5,
    path: ['isfahan', 'khuzistan', 'basra'],
  },
  {
    id: 'silk_east', n: { de: 'Seidenstraße (Hexi-Korridor)', tr: 'İpek Yolu (Hexi Koridoru)' }, value: 3,
    path: ['kaifeng', 'changan', 'ganzhou', 'dunhuang', 'qocho'],
  },
  {
    id: 'tea_horse', n: { de: 'Tee-Pferde-Straße', tr: 'Çay-At Yolu' }, value: 1.5,
    path: ['sichuan', 'amdo', 'lhasa', 'guge', 'kashmir'],
  },
  {
    id: 'grand_canal', n: { de: 'Kaiserkanal', tr: 'Büyük Kanal' }, value: 2.5,
    path: ['hangzhou', 'jiangning', 'kaifeng', 'hebei', 'yanjing'],
  },
  {
    id: 'maritime_silk', n: { de: 'Maritime Seidenstraße', tr: 'Deniz İpek Yolu' }, value: 3,
    path: ['fujian', 'guangzhou', 'champa', 'angkor', 'chola', 'lanka', 'gujarat', 'oman', 'yemen'],
  },
  {
    id: 'steppe_east', n: { de: 'Steppenweg der Kitan', tr: 'Kıtay Bozkır Yolu' }, value: 1.5,
    path: ['yanjing', 'shangjing', 'kerulen', 'orkhon', 'khovd', 'irtysh'],
  },
  {
    id: 'venetian', n: { de: 'Venezianische Seeroute', tr: 'Venedik Deniz Yolu' }, value: 2.5,
    path: ['venice', 'apulia', 'epirus', 'morea', 'crete', 'constantinople'],
  },
  {
    id: 'levant_sea', n: { de: 'Levanteroute', tr: 'Doğu Akdeniz Yolu' }, value: 2,
    path: ['genoa', 'tuscany', 'sicily', 'crete', 'cyprus', 'antioch'],
  },
  {
    id: 'champagne', n: { de: 'Champagnermessen', tr: 'Şampanya Panayırları' }, value: 2,
    path: ['flanders', 'paris', 'burgundy', 'provence', 'genoa', 'lombardy', 'venice'],
  },
  {
    id: 'amber_road', n: { de: 'Bernsteinstraße', tr: 'Kehribar Yolu' }, value: 1.5,
    path: ['prussia', 'greater_poland', 'lesser_poland', 'hungary', 'austria', 'venice'],
  },
  {
    id: 'north_sea', n: { de: 'Nordseehandel', tr: 'Kuzey Denizi Ticareti' }, value: 1.5,
    path: ['norway', 'denmark', 'saxony', 'flanders', 'england'],
  },
  {
    id: 'rus_amber', n: { de: 'Weg von Nowgorod', tr: 'Novgorod Yolu' }, value: 1.5,
    path: ['livonia', 'novgorod', 'smolensk', 'kiev'],
  },
  {
    id: 'danube_route', n: { de: 'Donauweg', tr: 'Tuna Yolu' }, value: 1.5,
    path: ['bavaria', 'austria', 'hungary', 'wallachia', 'bulgaria', 'constantinople'],
  },
  {
    id: 'saharan_gold', n: { de: 'Transsahara-Goldroute', tr: 'Sahra Ötesi Altın Yolu' }, value: 3,
    path: ['mali', 'ghana', 'awdaghust', 'sijilmasa', 'fez', 'cordoba'],
  },
  {
    id: 'saharan_east', n: { de: 'Karawanenweg von Kanem', tr: 'Kanem Kervan Yolu' }, value: 2,
    path: ['kano', 'kanem', 'fezzan', 'tripolitania', 'ifriqiya'],
  },
  {
    id: 'niger_route', n: { de: 'Nigerstraße', tr: 'Nijer Yolu' }, value: 2,
    path: ['ife', 'kano', 'gao', 'timbuktu', 'ouargla', 'constantine'],
  },
  {
    id: 'maghreb_road', n: { de: 'Küstenstraße des Maghreb', tr: 'Mağrib Sahil Yolu' }, value: 2,
    path: ['fez', 'tlemcen', 'constantine', 'ifriqiya', 'tripolitania', 'cyrenaica', 'alexandria'],
  },
  {
    id: 'nile_south', n: { de: 'Weg nach Abessinien', tr: 'Habeşistan Yolu' }, value: 1.5,
    path: ['upper_egypt', 'nubia', 'alodia', 'axum', 'lasta', 'shewa', 'zeila'],
  },
  {
    id: 'bengal_route', n: { de: 'Gangesweg', tr: 'Ganj Yolu' }, value: 2,
    path: ['kanauj', 'bengal', 'kalinga', 'vengi', 'chola'],
  },
];

export const GOVERNMENTS = {
  nomad: {
    n: { de: 'Nomadisches Khanat', tr: 'Göçebe Hanlık' },
    desc: {
      de: 'Herden und Weidegründe bilden die Grundlage der Macht. Schnelle Reiterheere, günstige berittene Bogenschützen, aber geringe Steuern aus Städten und Ackerland.',
      tr: 'Güç, sürülere ve otlaklara dayanır. Hızlı süvari orduları, ucuz atlı okçular; ancak şehirlerden ve tarım arazilerinden düşük vergi.',
    },
    taxMult: 0.55, pastureGold: 1.6, horsesMult: 1.6, moveBonus: 0.5, maxBuildLevel: 1, noWalls: false,
    upkeepMult: 0.5, researchMult: 0.8,
  },
  sultanate: {
    n: { de: 'Sultanat (Iqta-Staat)', tr: 'Sultanlık (İkta Devleti)' },
    desc: {
      de: 'Eine türkische Militärelite herrscht über sesshafte Untertanen. Turkmenische Stämme und Ghulam-Garden, persische Verwaltung.',
      tr: 'Türk askeri seçkinleri yerleşik tebaayı yönetir. Türkmen boyları ve gulam muhafızları, Fars bürokrasisi.',
    },
    taxMult: 0.9, pastureGold: 0.8, horsesMult: 1.15, moveBonus: 0.25, maxBuildLevel: 3,
    upkeepMult: 0.8, researchMult: 1.0,
  },
  sedentary: {
    n: { de: 'Sesshaftes Reich', tr: 'Yerleşik Devlet' },
    desc: {
      de: 'Ein Reich aus Städten und Ackerland mit Beamtentum und Steuerregistern. Hohe Einnahmen, aber langsamere Heere und weniger Pferde.',
      tr: 'Şehirler ve tarım arazilerinden oluşan, memurluk ve vergi kayıtlarına sahip bir devlet. Yüksek gelir, ama daha yavaş ordular ve daha az at.',
    },
    taxMult: 1.0, pastureGold: 0.35, horsesMult: 0.75, moveBonus: 0, maxBuildLevel: 3,
    upkeepMult: 1.0, researchMult: 1.1,
  },
};

export const SUCCESSION_LAWS = {
  seniority: {
    n: { de: 'Seniorat (Töre)', tr: 'Ekberiyet (Töre)' },
    desc: {
      de: 'Das älteste fähige Mitglied der Dynastie erbt. Das Reich gilt als Besitz der ganzen Familie, übergangene Prinzen können rebellieren.',
      tr: 'Hanedanın en yaşlı ehil üyesi tahta geçer. Ülke tüm ailenin ortak malıdır; atlanan şehzadeler isyan edebilir.',
    },
  },
  primogeniture: {
    n: { de: 'Primogenitur', tr: 'Primojenitür' },
    desc: {
      de: 'Der älteste Sohn erbt. Stabil, aber minderjährige Herrscher brauchen einen Regenten (Atabeg).',
      tr: 'En büyük oğul tahta geçer. İstikrarlıdır; ancak reşit olmayan hükümdarlar bir naibe (atabeg) ihtiyaç duyar.',
    },
  },
  elective: {
    n: { de: 'Wahl durch den Kurultai', tr: 'Kurultay Seçimi' },
    desc: {
      de: 'Der Kurultai der Stammesführer wählt den fähigsten Prinzen. Kaum Thronkriege, aber das Ansehen des Herrschers ist entscheidend.',
      tr: 'Boy beylerinin kurultayı en ehil şehzadeyi seçer. Taht kavgası az olur; ancak hükümdarın itibarı belirleyicidir.',
    },
  },
};

export const SEASONS = [
  { de: 'Frühling', tr: 'İlkbahar' },
  { de: 'Sommer', tr: 'Yaz' },
  { de: 'Herbst', tr: 'Sonbahar' },
  { de: 'Winter', tr: 'Kış' },
];
