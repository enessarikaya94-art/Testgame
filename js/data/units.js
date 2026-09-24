// Truppentypen.
// cls: ha = berittene Bogenschützen, lc = leichte Reiterei, hc = schwere Reiterei, camel = Kamelreiter,
//      inf = Infanterie, spear = Speerträger, arch = Fußbogenschützen, ele = Elefanten, siege = Belagerungsgerät
// req: benötigtes Gebäude in der Provinz {b: Gebäude, l: Stufe}
// cultures: nur verfügbar, wenn Fraktion ODER Provinz diese Kultur hat (leer = alle)
// relGroup: nur für Fraktionen dieser Religionsgruppe

export const UNIT_CLASSES = {
  ha:    { n: { de: 'Berittene Bogenschützen', tr: 'Atlı Okçu' }, speed: 3, cav: true, ranged: true },
  lc:    { n: { de: 'Leichte Reiterei', tr: 'Hafif Süvari' }, speed: 3, cav: true, ranged: false },
  hc:    { n: { de: 'Schwere Reiterei', tr: 'Ağır Süvari' }, speed: 2.5, cav: true, ranged: false },
  camel: { n: { de: 'Kamelreiter', tr: 'Deve Süvarisi' }, speed: 3, cav: true, ranged: false },
  inf:   { n: { de: 'Infanterie', tr: 'Piyade' }, speed: 2, cav: false, ranged: false },
  spear: { n: { de: 'Speerträger', tr: 'Mızrakçı' }, speed: 2, cav: false, ranged: false },
  arch:  { n: { de: 'Fußbogenschützen', tr: 'Yaya Okçu' }, speed: 2, cav: false, ranged: true },
  ele:   { n: { de: 'Elefanten', tr: 'Fil' }, speed: 2, cav: false, ranged: false },
  siege: { n: { de: 'Belagerungsgerät', tr: 'Kuşatma Aleti' }, speed: 1.5, cav: false, ranged: true },
};

const STEPPE = ['turkic', 'mongolic'];

export const UNITS = {
  militia: {
    n: { de: 'Stadtmiliz', tr: 'Şehir Milisi' }, cls: 'spear',
    att: 3, def: 5, rng: 0, cha: 1, mor: 4, size: 120, cost: 15, horses: 0, upkeep: 0.35,
    req: null, cultures: [],
    desc: { de: 'Bewaffnete Bürger. Billig, aber wenig standhaft.', tr: 'Silahlı kentliler. Ucuz ama dayanıksız.' },
  },
  spearmen: {
    n: { de: 'Speerträger', tr: 'Mızrakçılar' }, cls: 'spear',
    att: 5, def: 7, rng: 0, cha: 1, mor: 5, size: 120, cost: 25, horses: 0, upkeep: 0.5,
    req: { b: 'barracks', l: 1 }, cultures: [],
    desc: { de: 'Solide Linieninfanterie, stark gegen Reiterangriffe.', tr: 'Sağlam hat piyadesi, süvari hücumuna karşı güçlü.' },
  },
  archers: {
    n: { de: 'Fußbogenschützen', tr: 'Yaya Okçular' }, cls: 'arch',
    att: 3, def: 3, rng: 7, cha: 0, mor: 4, size: 100, cost: 25, horses: 0, upkeep: 0.5,
    req: { b: 'barracks', l: 1 }, cultures: [],
    desc: { de: 'Schützen zu Fuß für Fernkampf und Belagerung.', tr: 'Uzak muharebe ve kuşatma için yaya okçular.' },
  },
  horse_archers: {
    n: { de: 'Berittene Bogenschützen', tr: 'Atlı Okçular' }, cls: 'ha',
    att: 5, def: 4, rng: 9, cha: 3, mor: 6, size: 80, cost: 35, horses: 8, upkeep: 0.9,
    req: { b: 'ordu', l: 1, alt: { b: 'stables', l: 1 } }, cultures: STEPPE,
    desc: { de: 'Das Herz jedes Steppenheeres: schnell, ausdauernd, tödlich auf Distanz.', tr: 'Her bozkır ordusunun kalbi: hızlı, dayanıklı, uzaktan ölümcül.' },
  },
  turkmen: {
    n: { de: 'Turkmenische Stammesreiter', tr: 'Türkmen Akıncıları' }, cls: 'lc',
    att: 6, def: 3, rng: 6, cha: 4, mor: 5, size: 80, cost: 25, horses: 6, upkeep: 0.6,
    req: { b: 'ordu', l: 1 }, cultures: ['turkic'],
    desc: { de: 'Stammeskrieger der Oghusen. Billig und beutehungrig, aber schwer zu kontrollieren.', tr: 'Oğuz boylarının savaşçıları. Ucuz ve ganimete aç, ama denetimi zor.' },
  },
  tarkhan: {
    n: { de: 'Tarchan-Lanzenreiter', tr: 'Tarhan Mızraklı Süvarileri' }, cls: 'hc',
    att: 9, def: 7, rng: 4, cha: 8, mor: 8, size: 60, cost: 80, horses: 14, upkeep: 1.8,
    req: { b: 'ordu', l: 2 }, needs: ['iron'], cultures: ['turkic'],
    desc: { de: 'Gepanzerte Adelsreiter der Steppe mit Lanze und Bogen.', tr: 'Mızrak ve yay taşıyan zırhlı bozkır soyluları.' },
  },
  ghulam: {
    n: { de: 'Ghulam-Garde', tr: 'Gulam Muhafızları' }, cls: 'hc',
    att: 10, def: 9, rng: 6, cha: 8, mor: 9, size: 60, cost: 110, horses: 15, upkeep: 2.4,
    req: { b: 'barracks', l: 2 }, tech: 'ghulam', relGroup: 'islam', needs: ['iron'], cultures: [],
    desc: { de: 'Als Kinder gekaufte, meist türkische Militärsklaven, von Jugend an zu Elitereitern ausgebildet und nur dem Herrscher treu.', tr: 'Çocukken satın alınan, çoğu Türk kökenli askerî köleler. Küçük yaştan seçkin süvari olarak yetiştirilir, yalnızca hükümdara sadıktır.' },
  },
  mongol_ha: {
    n: { de: 'Mongolische Reiterbogenschützen', tr: 'Moğol Atlı Okçuları' }, cls: 'ha',
    att: 6, def: 5, rng: 10, cha: 4, mor: 8, size: 80, cost: 45, horses: 9, upkeep: 1,
    req: { b: 'ordu', l: 1 }, cultures: ['mongolic'],
    desc: { de: 'Diszipliniert in Zehner- bis Zehntausenderschaften, jeder Reiter mit mehreren Ersatzpferden.', tr: 'Onluk ve tümen düzeninde disiplinli; her süvarinin birkaç yedek atı vardır.' },
  },
  keshig: {
    n: { de: 'Keschig-Garde', tr: 'Keşik Muhafızları' }, cls: 'hc',
    att: 11, def: 9, rng: 7, cha: 9, mor: 10, size: 60, cost: 120, horses: 16, upkeep: 2.5,
    req: { b: 'ordu', l: 2 }, needs: ['iron'], cultures: ['mongolic'],
    desc: { de: 'Die persönliche Leibwache des Khans.', tr: 'Hanın şahsi muhafız birliği.' },
  },
  persian_cav: {
    n: { de: 'Persische Panzerreiter', tr: 'Esaviré Süvarileri' }, cls: 'hc',
    att: 8, def: 8, rng: 3, cha: 7, mor: 7, size: 60, cost: 80, horses: 14, upkeep: 1.8,
    req: { b: 'stables', l: 2 }, needs: ['iron'], cultures: ['persian'],
    desc: { de: 'Nachfahren der sasanidischen Asawira, schwer gepanzert.', tr: 'Sasani esavirelerinin torunları, ağır zırhlı.' },
  },
  daylamite: {
    n: { de: 'Dailamitische Fußkämpfer', tr: 'Deylemli Piyadeler' }, cls: 'inf',
    att: 7, def: 7, rng: 2, cha: 3, mor: 7, size: 100, cost: 40, horses: 0, upkeep: 0.8,
    req: { b: 'barracks', l: 1 }, cultures: ['persian'],
    desc: { de: 'Berühmte Bergkrieger mit Schild und Wurfspieß.', tr: 'Kalkan ve ciritle ünlü dağlı savaşçılar.' },
  },
  kurdish_cav: {
    n: { de: 'Kurdische Reiter', tr: 'Kürt Süvarileri' }, cls: 'lc',
    att: 7, def: 4, rng: 3, cha: 5, mor: 6, size: 80, cost: 35, horses: 8, upkeep: 0.8,
    req: { b: 'stables', l: 1 }, cultures: ['kurdish'],
    desc: { de: 'Gewandte Reiter aus den Bergen des Zagros.', tr: 'Zagros dağlarından çevik süvariler.' },
  },
  bedouin: {
    n: { de: 'Beduinenreiter', tr: 'Bedevi Süvarileri' }, cls: 'lc',
    att: 6, def: 4, rng: 2, cha: 5, mor: 6, size: 80, cost: 30, horses: 6, upkeep: 0.7,
    req: { b: 'stables', l: 1 }, cultures: ['arab'],
    desc: { de: 'Stammesreiter der arabischen Wüste.', tr: 'Arap çölünün kabile süvarileri.' },
  },
  camels: {
    n: { de: 'Kamelreiter', tr: 'Deve Süvarileri' }, cls: 'camel',
    att: 6, def: 5, rng: 4, cha: 4, mor: 6, size: 70, cost: 30, horses: 0, upkeep: 0.7,
    req: { b: 'stables', l: 1 }, cultures: ['arab', 'nubian'],
    desc: { de: 'In der Wüste unermüdlich. Pferde scheuen vor Kamelen.', tr: 'Çölde yorulmak bilmezler. Atlar develerden ürker.' },
  },
  nubian_archers: {
    n: { de: 'Nubische Bogenschützen', tr: 'Nubyalı Okçular' }, cls: 'arch',
    att: 4, def: 3, rng: 9, cha: 0, mor: 6, size: 100, cost: 35, horses: 0, upkeep: 0.7,
    req: { b: 'barracks', l: 1 }, cultures: ['nubian'],
    desc: { de: 'Die „Augenschützen“ Nubiens, gefürchtet seit der Antike.', tr: 'Nubya\'nın "göz okçuları", antik çağdan beri korkulan.' },
  },
  kataphraktoi: {
    n: { de: 'Kataphrakten', tr: 'Katafraktlar' }, cls: 'hc',
    att: 9, def: 10, rng: 2, cha: 9, mor: 8, size: 60, cost: 100, horses: 15, upkeep: 2.2,
    req: { b: 'stables', l: 2 }, needs: ['iron'], cultures: ['greek'],
    desc: { de: 'Voll gepanzerte byzantinische Reiter in Keilformation.', tr: 'Kama düzeninde tamamen zırhlı Bizans süvarileri.' },
  },
  skutatoi: {
    n: { de: 'Skutatoi', tr: 'Skutatoi Piyadesi' }, cls: 'spear',
    att: 6, def: 9, rng: 0, cha: 2, mor: 7, size: 120, cost: 40, horses: 0, upkeep: 0.8,
    req: { b: 'barracks', l: 1 }, needs: ['iron'], cultures: ['greek'],
    desc: { de: 'Schwere byzantinische Schildträger.', tr: 'Ağır Bizans kalkanlı piyadesi.' },
  },
  varangian: {
    n: { de: 'Warägergarde', tr: 'Varank Muhafızları' }, cls: 'inf',
    att: 11, def: 8, rng: 0, cha: 4, mor: 10, size: 80, cost: 110, horses: 0, upkeep: 2,
    req: { b: 'barracks', l: 3 }, needs: ['iron'], cultures: ['greek'], factions: ['byzantine'],
    desc: { de: 'Nordische Axtkämpfer, Leibwache des Kaisers.', tr: 'İmparatorun muhafızı olan İskandinav baltacılar.' },
  },
  monaspa: {
    n: { de: 'Monaspa-Reiter', tr: 'Monaspa Süvarileri' }, cls: 'hc',
    att: 9, def: 8, rng: 2, cha: 8, mor: 9, size: 60, cost: 90, horses: 14, upkeep: 2,
    req: { b: 'stables', l: 2 }, needs: ['iron'], cultures: ['georgian'],
    desc: { de: 'Die königliche Garde Georgiens.', tr: 'Gürcistan\'ın kraliyet muhafızları.' },
  },
  azat: {
    n: { de: 'Armenische Azat-Reiter', tr: 'Ermeni Azat Süvarileri' }, cls: 'hc',
    att: 8, def: 8, rng: 2, cha: 7, mor: 7, size: 60, cost: 80, horses: 13, upkeep: 1.8,
    req: { b: 'stables', l: 2 }, needs: ['iron'], cultures: ['armenian', 'alan'],
    desc: { de: 'Armenischer Kriegeradel zu Pferde.', tr: 'Atlı Ermeni savaşçı soyluları.' },
  },
  mountaineers: {
    n: { de: 'Kaukasische Bergkrieger', tr: 'Kafkas Dağ Savaşçıları' }, cls: 'inf',
    att: 7, def: 6, rng: 3, cha: 3, mor: 7, size: 100, cost: 35, horses: 0, upkeep: 0.7,
    req: { b: 'barracks', l: 1 }, cultures: ['armenian', 'georgian', 'alan', 'kurdish'],
    desc: { de: 'Zähe Kämpfer aus den Bergtälern.', tr: 'Dağ vadilerinin çetin savaşçıları.' },
  },
  druzhina: {
    n: { de: 'Druschina', tr: 'Drujina' }, cls: 'hc',
    att: 8, def: 8, rng: 1, cha: 7, mor: 8, size: 60, cost: 75, horses: 12, upkeep: 1.6,
    req: { b: 'stables', l: 1 }, needs: ['iron'], cultures: ['slavic'],
    desc: { de: 'Das Gefolge der Rus-Fürsten.', tr: 'Rus knezlerinin maiyeti.' },
  },
  knights: {
    n: { de: 'Fränkische Ritter', tr: 'Frenk Şövalyeleri' }, cls: 'hc',
    att: 11, def: 10, rng: 0, cha: 11, mor: 9, size: 50, cost: 110, horses: 15, upkeep: 2.4,
    req: { b: 'stables', l: 1 }, needs: ['iron'], cultures: ['latin'],
    desc: { de: 'Ihr Lanzenangriff ist unaufhaltsam, wenn er gelingt.', tr: 'Mızrak hücumları başarılı olursa durdurulamaz.' },
  },
  sergeants: {
    n: { de: 'Sergeanten', tr: 'Çavuş Piyadesi' }, cls: 'spear',
    att: 6, def: 8, rng: 0, cha: 2, mor: 7, size: 100, cost: 35, horses: 0, upkeep: 0.7,
    req: { b: 'barracks', l: 1 }, cultures: ['latin'],
    desc: { de: 'Gepanzertes Fußvolk der Kreuzfahrer.', tr: 'Haçlıların zırhlı piyadesi.' },
  },
  crossbows: {
    n: { de: 'Armbrustschützen', tr: 'Arbaletçiler' }, cls: 'arch',
    att: 4, def: 5, rng: 9, cha: 0, mor: 6, size: 100, cost: 40, horses: 0, upkeep: 0.8,
    req: { b: 'barracks', l: 1 }, cultures: ['latin'],
    desc: { de: 'Durchschlagskräftige Schützen.', tr: 'Delici atış gücüne sahip nişancılar.' },
  },
  rajputs: {
    n: { de: 'Rajputen-Krieger', tr: 'Racput Savaşçıları' }, cls: 'inf',
    att: 8, def: 6, rng: 1, cha: 4, mor: 9, size: 100, cost: 40, horses: 0, upkeep: 0.8,
    req: { b: 'barracks', l: 1 }, cultures: ['indian'],
    desc: { de: 'Stolze Kriegerkaste, die lieber stirbt als flieht.', tr: 'Kaçmaktansa ölmeyi yeğleyen onurlu savaşçı kastı.' },
  },
  elephants: {
    n: { de: 'Kriegselefanten', tr: 'Savaş Filleri' }, cls: 'ele',
    att: 13, def: 8, rng: 2, cha: 13, mor: 6, size: 20, cost: 120, horses: 0, upkeep: 2.5,
    req: { b: 'stables', l: 2 }, cultures: ['indian'],
    desc: { de: 'Furchteinflößend. Mahmud von Ghazna führte Hunderte davon.', tr: 'Korku salarlar. Gazneli Mahmud yüzlercesine sahipti.' },
  },
  mangonel: {
    n: { de: 'Mandschanik', tr: 'Mancınık' }, cls: 'siege',
    att: 1, def: 1, rng: 6, cha: 0, mor: 3, size: 30, cost: 60, horses: 0, upkeep: 1,
    req: { b: 'barracks', l: 2 }, tech: 'siege_mangonel', needs: ['timber'], cultures: [], siege: 1,
    desc: { de: 'Zugkatapult. Unverzichtbar gegen Stadtmauern.', tr: 'Çekmeli mancınık. Surlara karşı vazgeçilmez.' },
  },
  naffatun: {
    n: { de: 'Naphtha-Werfer', tr: 'Neffatlar' }, cls: 'siege',
    att: 3, def: 2, rng: 8, cha: 0, mor: 5, size: 40, cost: 70, horses: 0, upkeep: 1.2,
    req: { b: 'barracks', l: 2 }, tech: 'naphtha', needs: ['naphtha'], cultures: [], siege: 0.7,
    desc: { de: 'Werfen brennendes Naphtha auf Tore und Holzwerke.', tr: 'Kapılara ve ahşap yapılara yanan neft atarlar.' },
  },
  trebuchet: {
    n: { de: 'Gegengewicht-Tribok', tr: 'Karşı Ağırlıklı Mancınık' }, cls: 'siege',
    att: 1, def: 1, rng: 9, cha: 0, mor: 3, size: 30, cost: 100, horses: 0, upkeep: 1.5,
    req: { b: 'barracks', l: 3 }, tech: 'counterweight', needs: ['timber'], cultures: [], siege: 2,
    desc: { de: 'Die mächtigste Belagerungsmaschine ihrer Zeit.', tr: 'Çağının en güçlü kuşatma makinesi.' },
  },
  ghazi: {
    n: { de: 'Gazi-Grenzkrieger', tr: 'Gazi Uç Savaşçıları' }, cls: 'lc', local: true,
    att: 7, def: 4, rng: 6, cha: 5, mor: 9, size: 80, cost: 30, horses: 5, upkeep: 0.6,
    req: null, cultures: [],
    desc: { de: 'Glaubenskrieger der Grenzmarken, beutehungrig und furchtlos.', tr: 'Uç bölgelerinin inanç savaşçıları; ganimete aç ve korkusuz.' },
  },
  fergana_cav: {
    n: { de: 'Fergana-Panzerreiter', tr: 'Fergana Zırhlı Süvarileri' }, cls: 'hc', local: true,
    att: 10, def: 9, rng: 5, cha: 10, mor: 8, size: 60, cost: 95, horses: 12, upkeep: 2,
    req: { b: 'stables', l: 1, alt: { b: 'ordu', l: 1 } }, cultures: [], needs: ['iron'],
    desc: { de: 'Auf den edlen Pferden Ferganas – die beste schwere Reiterei Zentralasiens.', tr: 'Fergana\'nın soylu atları üzerinde – Orta Asya\'nın en iyi ağır süvarisi.' },
  },
  sistan_archers: {
    n: { de: 'Sistan-Bogenschützen', tr: 'Sistan Okçuları' }, cls: 'arch', local: true,
    att: 4, def: 4, rng: 11, cha: 0, mor: 7, size: 100, cost: 40, horses: 0, upkeep: 0.8,
    req: null, cultures: [],
    desc: { de: 'Meisterschützen aus den Sümpfen des Hilmend und den Grenzländern.', tr: 'Hilmend bataklıklarından ve uç diyarlarından usta okçular.' },
  },
  kipchak_guard: {
    n: { de: 'Kiptschakische Garde', tr: 'Kıpçak Muhafızları' }, cls: 'ha', local: true,
    att: 7, def: 6, rng: 10, cha: 6, mor: 8, size: 80, cost: 70, horses: 10, upkeep: 1.4,
    req: null, cultures: [], needs: ['iron'],
    desc: { de: 'Gepanzerte Reiterbogenschützen aus der Steppe im Sold reicher Herrscher.', tr: 'Zengin hükümdarların hizmetindeki zırhlı bozkır atlı okçuları.' },
  },
  fidai: {
    n: { de: 'Fidais', tr: 'Fedailer' }, cls: 'inf', local: true,
    att: 12, def: 3, rng: 0, cha: 5, mor: 12, size: 40, cost: 60, horses: 0, upkeep: 1.2,
    req: null, cultures: [],
    desc: { de: 'Todesbereite Gefolgsleute des Alten vom Berge.', tr: 'Dağın Şeyhi\'nin ölüme hazır müritleri.' },
  },
};

// Welche Truppen die KI und die Startarmeen je Kultur bevorzugen
export const CULTURE_ARMY = {
  turkic: ['horse_archers', 'horse_archers', 'turkmen', 'tarkhan', 'spearmen'],
  mongolic: ['mongol_ha', 'mongol_ha', 'mongol_ha', 'keshig'],
  persian: ['daylamite', 'archers', 'persian_cav', 'spearmen'],
  kurdish: ['kurdish_cav', 'mountaineers', 'archers'],
  arab: ['bedouin', 'spearmen', 'archers', 'camels'],
  greek: ['skutatoi', 'archers', 'kataphraktoi', 'skutatoi'],
  armenian: ['azat', 'mountaineers', 'archers'],
  georgian: ['monaspa', 'mountaineers', 'archers'],
  alan: ['azat', 'mountaineers'],
  slavic: ['druzhina', 'spearmen', 'archers'],
  latin: ['knights', 'sergeants', 'crossbows'],
  indian: ['rajputs', 'elephants', 'archers'],
  nubian: ['nubian_archers', 'camels', 'spearmen'],
};
