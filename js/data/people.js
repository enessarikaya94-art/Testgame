// Namen und Eigenschaften von Figuren.

const n = (de, tr) => ({ de, tr: tr || de });

export const NAMES = {
  turkic: {
    m: [n('Tughril', 'Tuğrul'), n('Tschaghri', 'Çağrı'), n('Arslan'), n('Kutalmisch', 'Kutalmış'), n('Böri', 'Böri'), n('Toghan', 'Toğan'),
      n('Inal', 'İnal'), n('Yinal', 'Yınal'), n('Sökmen'), n('Artuk', 'Artuk'), n('Ilghazi', 'İlgazi'), n('Kara'), n('Bughra', 'Buğra'),
      n('Satuk'), n('Kutlugh', 'Kutluğ'), n('Bilge'), n('Tekisch', 'Tekiş'), n('Atsis', 'Atsız'), n('Sandschar', 'Sencer'), n('Mahmud'),
      n('Masud', 'Mesud'), n('Sulaiman', 'Süleyman'), n('Ibrahim', 'İbrahim'), n('Yusuf'), n('Ahmad', 'Ahmed'), n('Muhammad', 'Muhammed'),
      n('Tutusch', 'Tutuş'), n('Kilidsch Arslan', 'Kılıç Arslan'), n('Kaikaus', 'Keykâvus'), n('Kaiqubad', 'Keykubad'), n('Aq Sonqur', 'Aksungur'),
      n('Zengi'), n('Toghrul Tegin', 'Tuğrul Tekin'), n('Alp Tegin', 'Alp Tekin'), n('Sebük Tegin', 'Sebük Tekin'), n('Anuschtegin', 'Anuştekin'),
      n('Il-Arslan', 'İl-Arslan'), n('Ertugrul', 'Ertuğrul'), n('Kaya'), n('Tuman'), n('Dschaghar', 'Cağar'), n('Uzun'), n('Kök Böri', 'Gökbörü'),
      n('Tarkan'), n('Temir', 'Temir'), n('Kuschtemür', 'Kuştemür'), n('Aibak', 'Aybek'), n('Baibars', 'Baybars'), n('Kutuz'), n('Iltutmisch', 'İltutmuş'),
      n('Kunduz'), n('Bars'), n('Sunkur', 'Sungur'), n('Altuntasch', 'Altuntaş'), n('Kaimaz', 'Kaymaz'), n('Tögrül Bey', 'Toğrul Bey')],
    f: [n('Terken Khatun', 'Terken Hatun'), n('Altun Dschan', 'Altun Can'), n('Ay Tschitschek', 'Ayçiçek'), n('Gülbahar'), n('Turkan', 'Türkan'),
      n('Safiyya', 'Safiye'), n('Zubaida', 'Zübeyde'), n('Mahpari', 'Mahperi'), n('Seldschuk Khatun', 'Selçuk Hatun'), n('Gevher Nesibe'),
      n('Qutlugh Khatun', 'Kutluğ Hatun'), n('Bilge Khatun', 'Bilge Hatun'), n('Arslan Khatun', 'Arslan Hatun'), n('Tschitschek', 'Çiçek')],
  },
  mongolic: {
    m: [n('Temüdschin', 'Temuçin'), n('Dschötschi', 'Cuci'), n('Tschagatai', 'Çağatay'), n('Ögedei', 'Ögedey'), n('Tolui'), n('Batu'), n('Möngke', 'Möngke'),
      n('Hülegü', 'Hülagü'), n('Subutai', 'Subutay'), n('Dschebe', 'Cebe'), n('Muqali', 'Mukali'), n('Yelü Dashi', 'Yelü Daşi'), n('Yelü Yilie', 'Yelü Yilie'),
      n('Yelü Zhilugu', 'Yelü Çilugu'), n('Kütschlüg', 'Küçlük'), n('Qasar', 'Kasar'), n('Belgutei', 'Belgütey'), n('Arghun', 'Argun'), n('Baidschu', 'Baycu')],
    f: [n('Börte'), n('Sorghaghtani', 'Sorkaktani'), n('Töregene', 'Töregene'), n('Yelü Pusuwan', 'Yelü Pusuwan'), n('Hoelun', 'Hoelün'), n('Dokuz Khatun', 'Dokuz Hatun')],
  },
  persian: {
    m: [n('Mardawidsch', 'Merdaviç'), n('Qabus', 'Kabus'), n('Manutschehr', 'Menuçehr'), n('Buya', 'Büveyh'), n('Fana Khusraw', 'Fena Hüsrev'),
      n('Rustam', 'Rüstem'), n('Faramurz', 'Feramerz'), n('Kai Kaus', 'Keykâvus'), n('Bahram', 'Behram'), n('Khusraw', 'Hüsrev'), n('Hasan'),
      n('Husain', 'Hüseyin'), n('Ali'), n('Abu Nasr', 'Ebu Nasr'), n('Abu Kalidschar', 'Ebu Kalicar'), n('Ghiyath ad-Din', 'Gıyaseddin'),
      n('Muizz ad-Din', 'Muizzeddin'), n('Ala ad-Din', 'Alaeddin'), n('Schams ad-Din', 'Şemseddin'), n('Dschalal ad-Din', 'Celaleddin'), n('Farrukhzad', 'Ferruhzad')],
    f: [n('Sayyida', 'Seyyide'), n('Schirin', 'Şirin'), n('Parisa', 'Perisa'), n('Mahbanu', 'Mahbanu'), n('Roxana', 'Revşen'), n('Fatima', 'Fatma')],
  },
  kurdish: {
    m: [n('Salah ad-Din', 'Selahaddin'), n('Schirkuh', 'Şirkuh'), n('Ayyub', 'Eyyub'), n('Turan-Schah', 'Turanşah'), n('al-Adil', 'el-Adil'), n('al-Kamil', 'el-Kâmil'),
      n('Fadl', 'Fazl'), n('Abu l-Aswar', 'Ebu\'l-Esvar'), n('Mumahhid', 'Mümehhid'), n('Nasr ad-Daula', 'Nasrüddevle'), n('Badr', 'Bedir'), n('Wahsudan', 'Vehsudan'), n('Mamlan', 'Memlan')],
    f: [n('Sitt asch-Scham', 'Sittüşşam'), n('Dayfa Khatun', 'Dayfe Hatun'), n('Ismat', 'İsmet'), n('Zumurrud', 'Zümrüt')],
  },
  arab: {
    m: [n('al-Hakim', 'el-Hâkim'), n('al-Mustansir', 'el-Müstansır'), n('al-Qadir', 'el-Kadir'), n('al-Qaim', 'el-Kaim'), n('al-Nasir', 'en-Nasır'),
      n('al-Mustadi', 'el-Müstazi'), n('Qirwasch', 'Kırvaş'), n('Mahmud'), n('Nasr'), n('Thimal', 'Sımal'), n('Salih'), n('Ali'), n('Hasan'), n('Umar', 'Ömer'),
      n('Abd Allah', 'Abdullah'), n('Dschafar', 'Cafer'), n('Abu Tahir', 'Ebu Tahir'), n('Badr al-Dschamali', 'Bedr el-Cemali'), n('al-Afdal', 'el-Efdal'), n('Muslim')],
    f: [n('Sitt al-Mulk', 'Sittülmülk'), n('Zubaida', 'Zübeyde'), n('Fatima', 'Fatma'), n('Aischa', 'Ayşe'), n('Arwa', 'Erva'), n('Khadidscha', 'Hatice'), n('Asma', 'Esma')],
  },
  greek: {
    m: [n('Basileios', 'Vasileios'), n('Konstantinos', 'Konstantinos'), n('Romanos'), n('Michael', 'Mihail'), n('Alexios', 'Aleksios'), n('Ioannes', 'İoannis'),
      n('Manuel', 'Manuil'), n('Isaak', 'İsaakios'), n('Andronikos'), n('Nikephoros', 'Nikiforos'), n('Theodoros', 'Teodoros'), n('Leon'), n('Georgios', 'Yorgos')],
    f: [n('Zoe', 'Zoi'), n('Theodora', 'Teodora'), n('Anna'), n('Eudokia', 'Evdokia'), n('Irene', 'İrini'), n('Maria', 'Maria')],
  },
  armenian: {
    m: [n('Gagik', 'Gagik'), n('Aschot', 'Aşot'), n('Smbat', 'Sımbat'), n('Hovhannes', 'Hovhannes'), n('Ruben'), n('Thoros', 'Toros'), n('Levon'), n('Hethum', 'Hetum'), n('Senekerim')],
    f: [n('Katranide'), n('Zabel'), n('Mariun', 'Mariun'), n('Rita'), n('Anna')],
  },
  georgian: {
    m: [n('Bagrat'), n('Giorgi', 'Giorgi'), n('Dawit', 'Davit'), n('Demetre'), n('Laschari', 'Laşa'), n('Wachtang', 'Vahtang'), n('Konstantine'), n('Ioane')],
    f: [n('Tamar', 'Tamara'), n('Rusudan'), n('Gurandukht', 'Gurandukht'), n('Mariam')],
  },
  alan: {
    m: [n('Durgulel'), n('Soslan'), n('Os-Bagatar', 'Os-Bagatar'), n('Ruslan'), n('Aslan'), n('Tamerlan', 'Temirlan')],
    f: [n('Borena'), n('Alda'), n('Irina', 'İrina')],
  },
  slavic: {
    m: [n('Wladimir', 'Vladimir'), n('Jaroslaw', 'Yaroslav'), n('Swjatoslaw', 'Svyatoslav'), n('Isjaslaw', 'İzyaslav'), n('Wsewolod', 'Vsevolod'),
      n('Mstislaw', 'Mstislav'), n('Rurik'), n('Oleg'), n('Igor', 'İgor'), n('Boris'), n('Samuil'), n('Iwan Assen', 'İvan Asen'), n('Kalojan', 'Kaloyan'), n('Peter', 'Petar')],
    f: [n('Olga'), n('Anna'), n('Ingigerd'), n('Predslawa', 'Predslava'), n('Jewpraksija', 'Yevpraksiya')],
  },
  latin: {
    m: [n('Bohemund', 'Bohemond'), n('Balduin', 'Baudouin'), n('Gottfried', 'Godefroy'), n('Raimund', 'Raymond'), n('Tankred', 'Tancrède'), n('Amalrich', 'Amaury'),
      n('Fulko', 'Foulques'), n('Rainald', 'Renaud'), n('Guido', 'Guy'), n('Heinrich', 'Henri'), n('Joscelin', 'Josselin')],
    f: [n('Melisende', 'Melisende'), n('Sibylle', 'Sibylla'), n('Isabella'), n('Konstanze', 'Constance'), n('Alice')],
  },
  indian: {
    m: [n('Dschayapala', 'Cayapala'), n('Anandapala'), n('Trilotschanapala', 'Trilocanapala'), n('Bhima', 'Bhima'), n('Prithviradsch', 'Prithviraj'),
      n('Dschaitschandra', 'Jaichand'), n('Anangapala'), n('Mularadscha', 'Mularaja'), n('Siddharadscha', 'Siddharaja'), n('Kumarapala'), n('Sangramaradscha', 'Sangramaraja')],
    f: [n('Didda'), n('Samyukta'), n('Nayikadevi'), n('Suryamati')],
  },
  nubian: {
    m: [n('Georgios', 'Georgios'), n('Rafael'), n('Salomo', 'Süleyman'), n('Moses', 'Musa'), n('David', 'Davud'), n('Zacharias', 'Zekeriya')],
    f: [n('Martha', 'Marta'), n('Maria')],
  },
  german: {
    m: [n('Otto'), n('Heinrich'), n('Konrad'), n('Friedrich'), n('Lothar'), n('Ludwig'), n('Rudolf'), n('Welf'), n('Albrecht'), n('Bernhard'), n('Egbert'), n('Gottfried'), n('Hermann'), n('Philipp')],
    f: [n('Mathilde'), n('Adelheid'), n('Gisela'), n('Kunigunde'), n('Agnes'), n('Richenza'), n('Beatrix')],
  },
  italian: {
    m: [n('Pietro'), n('Enrico'), n('Domenico'), n('Vitale'), n('Ottone'), n('Guglielmo'), n('Ruggero'), n('Tancredi'), n('Bonifacio'), n('Guido'), n('Ranieri'), n('Sebastiano')],
    f: [n('Matilde'), n('Beatrice'), n('Costanza'), n('Adelaide'), n('Giovanna')],
  },
  iberian: {
    m: [n('Alfonso'), n('Sancho'), n('Fernando'), n('García'), n('Ramiro'), n('Ramón'), n('Pedro'), n('Jaime'), n('Rodrigo'), n('Bermudo'), n('Abd ar-Rahman', 'Abdurrahman'), n('Hischam', 'Hişam'), n('al-Mutamid', 'Mutemid'), n('Ibn Hud', 'İbn Hud')],
    f: [n('Urraca'), n('Teresa'), n('Sancha'), n('Berenguela'), n('Leonor'), n('Subh', 'Subh')],
  },
  anglo: {
    m: [n('Æthelred'), n('Edmund'), n('Edward'), n('Harold'), n('Wilhelm', 'William'), n('Heinrich', 'Henry'), n('Richard'), n('Johann', 'John'), n('Stephan', 'Stephen'), n('Godwin'), n('Robert')],
    f: [n('Emma'), n('Edith'), n('Mathilde', 'Matilda'), n('Eleonore', 'Eleanor'), n('Adela')],
  },
  gaelic: {
    m: [n('Brian'), n('Máel Sechnaill'), n('Malcolm'), n('Duncan'), n('Macbeth'), n('Donald'), n('Diarmait'), n('Ruaidrí'), n('Toirdelbach'), n('Alexander')],
    f: [n('Gruoch'), n('Margaret'), n('Derbforgaill'), n('Gormflaith')],
  },
  norse: {
    m: [n('Sven', 'Sven'), n('Knut', 'Knut'), n('Harald'), n('Olaf'), n('Magnus'), n('Erik'), n('Sigurd'), n('Håkon', 'Hakon'), n('Waldemar', 'Valdemar'), n('Ingvar'), n('Anund'), n('Sverre')],
    f: [n('Ingrid'), n('Estrid'), n('Gunhild'), n('Astrid'), n('Sigrid')],
  },
  baltic: {
    m: [n('Mindaugas'), n('Traidenis'), n('Skomantas'), n('Herkus'), n('Kaupo'), n('Vesthard'), n('Lamekins'), n('Glande')],
    f: [n('Morta'), n('Aldona'), n('Rimgaile')],
  },
  magyar: {
    m: [n('Géza'), n('István', 'İştvan'), n('Béla'), n('László'), n('Kálmán'), n('András'), n('Imre', 'İmre'), n('Salamon'), n('Álmos'), n('Koppány'), n('Gyula'), n('Ajtony')],
    f: [n('Sarolt'), n('Gisela'), n('Adelheid'), n('Ilona'), n('Erzsébet')],
  },
  han: {
    m: [n('Zhao Heng'), n('Zhao Zhen'), n('Zhao Xu'), n('Zhao Ji'), n('Zhao Gou'), n('Yue Fei'), n('Han Shizhong'), n('Fan Zhongyan'), n('Sima Guang'), n('Su Shi'), n('Bao Zheng'), n('Di Qing'), n('Ouyang Xiu'), n('Wen Tianxiang'), n('Zhu Xi')],
    f: [n('Li Qingzhao'), n('Liu E'), n('Cao'), n('Meng'), n('Wu'), n('Liang Hongyu')],
  },
  jurchen: {
    m: [n('Aguda'), n('Wuqimai'), n('Wanyan Zongbi'), n('Wanyan Zonghan'), n('Wanyan Liang'), n('Wanyan Yong'), n('Wanyan Jing'), n('Hela'), n('Wugunai'), n('Puxian Wannu')],
    f: [n('Tangkuo'), n('Pucha'), n('Tudan')],
  },
  tangut: {
    m: [n('Li Jiqian'), n('Li Deming'), n('Li Yuanhao'), n('Li Liangzuo'), n('Li Qianshun'), n('Li Renxiao'), n('Li Chunyou'), n('Li Anquan'), n('Weiming Shouming'), n('Yeli Yuqi')],
    f: [n('Liang'), n('Moyi'), n('Yeli'), n('Weiming')],
  },
  tibetan: {
    m: [n('Yeshe-Ö'), n('Jangchub-Ö'), n('Gusiluo'), n('Dongzhan'), n('Atisha'), n('Marpa'), n('Drogön'), n('Tsangpa'), n('Duan Siping'), n('Duan Zhixiang'), n('Gao Shengtai')],
    f: [n('Dolma'), n('Pema'), n('Yangchen')],
  },
  korean: {
    m: [n('Wang Song'), n('Wang Hyeon'), n('Wang Hwi'), n('Wang U'), n('Gang Gam-chan'), n('Seo Hui'), n('Yun Gwan'), n('Kim Bu-sik'), n('Choe Chung-heon'), n('Choe U')],
    f: [n('Heonae'), n('Wonseong'), n('Inye')],
  },
  seasian: {
    m: [n('Lý Công Uẩn', 'Ly Cong Uan'), n('Lý Thường Kiệt', 'Ly Thuong Kiet'), n('Trần Thái Tông', 'Tran Thai Tong'), n('Suryavarman'), n('Jayavarman'), n('Udayadityavarman'), n('Harivarman'), n('Anawrahta'), n('Kyansittha'), n('Narapatisithu'), n('Alaungsithu')],
    f: [n('Ỷ Lan', 'Y Lan'), n('Indradevi'), n('Rajendradevi')],
  },
  berber: {
    m: [n('Yusuf ibn Taschfin', 'Yusuf bin Taşfin'), n('Ali ibn Yusuf', 'Ali bin Yusuf'), n('Abu Bakr', 'Ebubekir'), n('Abd al-Mumin', 'Abdülmü\'min'), n('Yaqub al-Mansur', 'Yakub el-Mansur'), n('Ibn Tumart', 'İbn Tumert'), n('al-Muizz', 'Muiz'), n('Buluggin', 'Bülükkin'), n('Hammad'), n('Tamim'), n('Ziri'), n('Badis')],
    f: [n('Zainab an-Nafzawiyya', 'Zeyneb en-Nefzaviyye'), n('Fatima', 'Fatma'), n('Tamima')],
  },
  sudanic: {
    m: [n('Sundiata'), n('Sumanguru'), n('Mansa Wali'), n('Kankan'), n('Tunka Manin'), n('Dia Kossoi'), n('Hume'), n('Dunama'), n('Bagauda'), n('Oranmiyan'), n('Obalufon'), n('Abubakari')],
    f: [n('Sogolon'), n('Kassi'), n('Nana'), n('Luwo')],
  },
  ethiopian: {
    m: [n('Lalibela'), n('Yemrehanna Krestos'), n('Na\'akueto La\'ab'), n('Tatadim'), n('Yetbarak'), n('Mara Takla Haymanot'), n('Degna Jan'), n('Wedem Asfare'), n('Umar Walashma'), n('Ali')],
    f: [n('Gudit'), n('Masqal Kibra'), n('Mesqel')],
  },
};

// Eigenschaften: Modifikatoren auf Werte
export const TRAITS = {
  brave:      { n: n('Tapfer', 'Cesur'), mar: 2, good: true },
  coward:     { n: n('Feige', 'Korkak'), mar: -2 },
  strategist: { n: n('Stratege', 'Stratejist'), mar: 3, good: true },
  ghazi:      { n: n('Gazi', 'Gazi'), mar: 1, piety: 2, good: true },
  just:       { n: n('Gerecht', 'Adil'), adm: 2, good: true },
  cruel:      { n: n('Grausam', 'Zalim'), adm: -1, mar: 1 },
  wise:       { n: n('Weise', 'Bilge'), adm: 1, dip: 1, good: true },
  scholar:    { n: n('Gelehrt', 'Âlim'), adm: 1, research: 1, good: true },
  poet:       { n: n('Dichter', 'Şair'), dip: 1, prestige: 1, good: true },
  greedy:     { n: n('Habgierig', 'Açgözlü'), adm: 1, dip: -1 },
  generous:   { n: n('Freigebig', 'Cömert'), dip: 2, good: true },
  drunkard:   { n: n('Trinker', 'Ayyaş'), adm: -2 },
  pious:      { n: n('Fromm', 'Dindar'), piety: 3, good: true },
  ambitious:  { n: n('Ehrgeizig', 'Hırslı'), mar: 1, adm: 1, loyalty: -20 },
  loyal:      { n: n('Treu', 'Sadık'), loyalty: 25, good: true },
  paranoid:   { n: n('Misstrauisch', 'Kuşkucu'), dip: -2 },
  charismatic:{ n: n('Charismatisch', 'Karizmatik'), dip: 2, loyaltyAll: 10, good: true },
  sickly:     { n: n('Kränklich', 'Hastalıklı'), health: -1 },
  robust:     { n: n('Robust', 'Güçlü Bünyeli'), health: 1, good: true },
  horse_lord: { n: n('Herr der Pferde', 'At Beyi'), mar: 1, horses: 1, good: true },
  builder:    { n: n('Bauherr', 'Bânî'), adm: 1, buildCost: 1, good: true },
};

// Bekannte Gelehrte/Persönlichkeiten für Ereignisse
export const SCHOLARS = [
  { id: 'ibn_sina', n: n('Ibn Sina (Avicenna)', 'İbn Sina'), from: 990, to: 1037, field: 'medicine' },
  { id: 'biruni', n: n('al-Biruni', 'Bîrûnî'), from: 1000, to: 1048, field: 'astronomy' },
  { id: 'firdausi', n: n('Firdausi', 'Firdevsi'), from: 990, to: 1020, field: 'poetry' },
  { id: 'yusuf_hajib', n: n('Yusuf Has Hadschib', 'Yusuf Has Hacib'), from: 1050, to: 1085, field: 'poetry' },
  { id: 'kashgari', n: n('Mahmud al-Kaschgari', 'Kaşgarlı Mahmud'), from: 1060, to: 1102, field: 'historiography' },
  { id: 'nizam', n: n('Nizam al-Mulk', 'Nizamülmülk'), from: 1050, to: 1092, field: 'vizierate' },
  { id: 'khayyam', n: n('Omar Chayyam', 'Ömer Hayyam'), from: 1070, to: 1131, field: 'mathematics' },
  { id: 'ghazali', n: n('al-Ghazali', 'Gazâlî'), from: 1080, to: 1111, field: 'madrasa' },
  { id: 'yesevi', n: n('Ahmed Yesevi', 'Ahmed Yesevî'), from: 1100, to: 1166, field: 'sufi' },
  { id: 'nizami', n: n('Nizami Gandschawi', 'Nizamî Gencevî'), from: 1160, to: 1209, field: 'poetry' },
  { id: 'razi', n: n('Fachr ad-Din ar-Razi', 'Fahreddin Râzî'), from: 1170, to: 1210, field: 'translation' },
  { id: 'rumi', n: n('Dschalal ad-Din Rumi', 'Mevlânâ Celâleddîn Rûmî'), from: 1230, to: 1273, field: 'sufi' },
  { id: 'tusi', n: n('Nasir ad-Din at-Tusi', 'Nasîrüddin Tûsî'), from: 1230, to: 1274, field: 'astronomy' },
  { id: 'juvayni', n: n('Ata al-Mulk Dschuwaini', 'Cüveynî'), from: 1250, to: 1283, field: 'historiography' },
];
