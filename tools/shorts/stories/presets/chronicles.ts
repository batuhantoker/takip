/**
 * Chronicles: dated stops on History's map, each told from its Wikipedia article. Dates are YYYY-MM-DD with
 * astronomical years (-48 is 49 BCE); each is checked against its article's lead when the facts are fetched.
 */

export type Stop = {
  id: string;
  date: string;
  /** lat, lon, zoom. */
  at: [number, number, number];
  layer: 'ww2-europe' | 'world-borders';
  /** English Wikipedia title. */
  wiki: string;
  title: string;
  /** The day isn't known (only the season or year): the chronicle then counts years, not days. */
  approx?: boolean;
};

export type Chronicle = { kicker: string; topic: string; overview: string; postTitle: string; stops: Stop[]; sources: string[]; hashtags: string[] };

const WIKI = 'Wikipedia (CC BY-SA 4.0)';
const CLIO = 'World borders: Cliopatria, Seshat (CC BY 4.0)';
const W = 'world-borders' as const;

export const CHRONICLES: Record<string, Chronicle> = {
  'ww2-america': {
    kicker: 'World War II',
    topic: 'how the United States went from neutrality to fighting in World War II',
    overview: 'United States in World War II',
    postTitle: 'How America was drawn into World War II',
    stops: [
      { id: 'poland', date: '1939-09-01', at: [51, 16, 3.4], layer: 'ww2-europe', wiki: 'Invasion of Poland', title: 'War in Europe' },
      { id: 'lend-lease', date: '1941-03-11', at: [44, -38, 1.7], layer: W, wiki: 'Lend-Lease', title: 'Lend-Lease' },
      { id: 'pearl-harbor', date: '1941-12-07', at: [21.36, -157.95, 5.2], layer: W, wiki: 'Attack on Pearl Harbor', title: 'Pearl Harbor' },
      { id: 'declaration', date: '1941-12-11', at: [50, 12, 3.2], layer: 'ww2-europe', wiki: 'German declaration of war against the United States', title: 'Germany declares war' },
      { id: 'normandy', date: '1944-06-06', at: [49.35, -0.6, 5.2], layer: 'ww2-europe', wiki: 'Normandy landings', title: 'D-Day' },
      { id: 'hiroshima', date: '1945-08-06', at: [34.39, 132.46, 4.8], layer: W, wiki: 'Atomic bombings of Hiroshima and Nagasaki', title: 'Hiroshima' },
    ],
    sources: [WIKI, 'WWII borders: Stanford Spatial History Lab', CLIO, 'TAKIP'],
    hashtags: ['#TAKIP', '#WorldWarII', '#WW2', '#History', '#HistoryMaps'],
  },
  ww1: {
    kicker: 'World War I',
    topic: 'how one shot in Sarajevo became a world war, and how it ended',
    overview: 'World War I',
    postTitle: 'World War I in under a minute',
    stops: [
      { id: 'sarajevo', date: '1914-06-28', at: [43.86, 18.41, 5.5], layer: W, wiki: 'Assassination of Archduke Franz Ferdinand', title: 'Sarajevo' },
      { id: 'marne', date: '1914-09-06', at: [49, 3.5, 5.2], layer: W, wiki: 'First Battle of the Marne', title: 'The Marne' },
      { id: 'gallipoli', date: '1915-04-25', at: [40.2, 26.3, 5.6], layer: W, wiki: 'Gallipoli campaign', title: 'Gallipoli' },
      { id: 'verdun', date: '1916-02-21', at: [49.2, 5.4, 5.6], layer: W, wiki: 'Battle of Verdun', title: 'Verdun' },
      { id: 'america', date: '1917-04-06', at: [39, -60, 2.2], layer: W, wiki: 'American entry into World War I', title: 'America enters' },
      { id: 'armistice', date: '1918-11-11', at: [49.43, 2.9, 5.4], layer: W, wiki: 'Armistice of 11 November 1918', title: 'Armistice' },
    ],
    sources: [WIKI, CLIO, 'TAKIP'],
    hashtags: ['#TAKIP', '#WorldWarI', '#WW1', '#History', '#HistoryMaps'],
  },
  'turkish-independence': {
    kicker: 'War of Independence',
    topic: 'the Turkish War of Independence, from the landing at Samsun to the Republic',
    overview: 'Turkish War of Independence',
    postTitle: 'From Samsun to the Republic: the Turkish War of Independence',
    stops: [
      { id: 'mudros', date: '1918-10-30', at: [39.87, 25.27, 5.4], layer: W, wiki: 'Armistice of Mudros', title: 'Mudros' },
      { id: 'samsun', date: '1919-05-19', at: [41.29, 36.33, 5.6], layer: W, wiki: 'Turkish War of Independence', title: 'Samsun' },
      { id: 'sakarya', date: '1921-08-23', at: [39.6, 31.9, 5.6], layer: W, wiki: 'Battle of Sakarya', title: 'Sakarya' },
      { id: 'dumlupinar', date: '1922-08-30', at: [38.8, 30, 5.6], layer: W, wiki: 'Battle of Dumlupınar', title: 'Dumlupınar' },
      { id: 'lausanne', date: '1923-07-24', at: [46.52, 6.63, 5], layer: W, wiki: 'Treaty of Lausanne', title: 'Lausanne' },
      { id: 'republic', date: '1923-10-29', at: [39.93, 32.85, 5], layer: W, wiki: 'Proclamation of the Republic of Turkey', title: 'The Republic' },
    ],
    sources: [WIKI, CLIO, 'TAKIP'],
    hashtags: ['#TAKIP', '#Turkey', '#Atatürk', '#History', '#HistoryMaps'],
  },
  'ottoman-rise': {
    kicker: 'Ottoman Empire',
    topic: 'how a small principality in Anatolia became an empire on three continents',
    overview: 'Ottoman Empire',
    postTitle: 'The rise of the Ottoman Empire',
    stops: [
      { id: 'bursa', date: '1326-04-06', at: [40.18, 29.06, 5.4], layer: W, wiki: 'Siege of Bursa', title: 'Bursa' },
      { id: 'kosovo', date: '1389-06-15', at: [42.7, 21.1, 5.2], layer: W, wiki: 'Battle of Kosovo', title: 'Kosovo' },
      { id: 'constantinople', date: '1453-05-29', at: [41.01, 28.95, 5.4], layer: W, wiki: 'Fall of Constantinople', title: 'Constantinople' },
      { id: 'egypt', date: '1517-01-22', at: [30.05, 31.25, 4.6], layer: W, wiki: 'Battle of Ridaniya', title: 'Cairo' },
      { id: 'mohacs', date: '1526-08-29', at: [45.94, 18.68, 5.2], layer: W, wiki: 'Battle of Mohács', title: 'Mohács' },
      { id: 'vienna', date: '1683-09-12', at: [48.2, 16.37, 5], layer: W, wiki: 'Battle of Vienna', title: 'Vienna' },
    ],
    sources: [WIKI, CLIO, 'TAKIP'],
    hashtags: ['#TAKIP', '#OttomanEmpire', '#Osmanlı', '#History', '#HistoryMaps'],
  },
  'cold-war': {
    kicker: 'Cold War',
    topic: 'the Cold War between the United States and the Soviet Union, from Berlin to Berlin',
    overview: 'Cold War',
    postTitle: 'The Cold War in under a minute',
    stops: [
      { id: 'blockade', date: '1948-06-24', at: [52.52, 13.4, 5.4], layer: W, wiki: 'Berlin Blockade', title: 'Berlin Blockade' },
      { id: 'korea', date: '1950-06-25', at: [38, 127.5, 5], layer: W, wiki: 'Korean War', title: 'Korea' },
      { id: 'cuba', date: '1962-10-16', at: [22, -80, 4.8], layer: W, wiki: 'Cuban Missile Crisis', title: 'Cuba' },
      { id: 'saigon', date: '1975-04-30', at: [10.8, 106.7, 5], layer: W, wiki: 'Fall of Saigon', title: 'Saigon' },
      { id: 'wall', date: '1989-11-09', at: [52.52, 13.4, 5.6], layer: W, wiki: 'Fall of the Berlin Wall', title: 'The Wall falls' },
      { id: 'ussr', date: '1991-12-26', at: [55.75, 60, 2.6], layer: W, wiki: 'Dissolution of the Soviet Union', title: 'The USSR ends' },
    ],
    sources: [WIKI, CLIO, 'TAKIP'],
    hashtags: ['#TAKIP', '#ColdWar', '#History', '#Geopolitics', '#HistoryMaps'],
  },
  discovery: {
    kicker: 'Age of Discovery',
    topic: 'the voyages that joined the world\'s oceans, and the empires that followed',
    overview: 'Age of Discovery',
    postTitle: 'The Age of Discovery in under a minute',
    stops: [
      { id: 'columbus', date: '1492-10-12', at: [24, -75, 4.2], layer: W, wiki: 'Voyages of Christopher Columbus', title: 'Columbus' },
      { id: 'da-gama', date: '1498-05-20', at: [11.25, 75.78, 4.6], layer: W, wiki: 'Vasco da Gama', title: 'Calicut' },
      { id: 'cabral', date: '1500-04-22', at: [-16.4, -39, 4.6], layer: W, wiki: 'Pedro Álvares Cabral', title: 'Brazil' },
      { id: 'tenochtitlan', date: '1521-08-13', at: [19.43, -99.13, 5.4], layer: W, wiki: 'Fall of Tenochtitlan', title: 'Tenochtitlan' },
      { id: 'magellan', date: '1522-09-06', at: [36.8, -6.35, 2.2], layer: W, wiki: 'Magellan expedition', title: 'Around the world' },
      { id: 'cajamarca', date: '1532-11-16', at: [-7.16, -78.5, 5.4], layer: W, wiki: 'Battle of Cajamarca', title: 'Cajamarca' },
    ],
    sources: [WIKI, CLIO, 'TAKIP'],
    hashtags: ['#TAKIP', '#AgeOfDiscovery', '#Explorers', '#History', '#HistoryMaps'],
  },
  rome: {
    kicker: 'Rome',
    topic: 'Rome from the destruction of Carthage to the end of the Western Empire',
    overview: 'Ancient Rome',
    postTitle: 'Rome, from Carthage to 476, in under a minute',
    stops: [
      { id: 'carthage', date: '-145-04-01', at: [36.85, 10.32, 5.4], layer: W, wiki: 'Siege of Carthage (Third Punic War)', title: 'Carthage', approx: true },
      { id: 'rubicon', date: '-48-01-10', at: [44.1, 12.4, 5.4], layer: W, wiki: "Caesar's civil war", title: 'The Rubicon' },
      { id: 'actium', date: '-30-09-02', at: [38.95, 20.73, 5.4], layer: W, wiki: 'Battle of Actium', title: 'Actium' },
      { id: 'trajan', date: '0117-08-08', at: [41.9, 20, 3], layer: W, wiki: 'Trajan', title: 'Trajan' },
      { id: 'constantinople', date: '0330-05-11', at: [41.01, 28.97, 5.2], layer: W, wiki: 'Constantinople', title: 'Constantinople' },
      { id: 'fall', date: '0476-09-04', at: [44.4, 12.2, 5], layer: W, wiki: 'Fall of the Western Roman Empire', title: '476' },
    ],
    sources: [WIKI, CLIO, 'TAKIP'],
    hashtags: ['#TAKIP', '#AncientRome', '#RomanEmpire', '#History', '#HistoryMaps'],
  },
  mongols: {
    kicker: 'Mongol Empire',
    topic: 'how the Mongols built the largest land empire in history',
    overview: 'Mongol Empire',
    postTitle: 'The Mongol conquests in under a minute',
    stops: [
      { id: 'khan', date: '1206-06-01', at: [47.9, 106.9, 4], layer: W, wiki: 'Genghis Khan', title: 'Genghis Khan', approx: true },
      { id: 'zhongdu', date: '1215-06-01', at: [39.9, 116.4, 5], layer: W, wiki: 'Battle of Zhongdu', title: 'Zhongdu', approx: true },
      { id: 'khwarazm', date: '1220-03-01', at: [39.65, 66.97, 4.6], layer: W, wiki: 'Mongol invasion of the Khwarazmian Empire', title: 'Samarkand', approx: true },
      { id: 'legnica', date: '1241-04-09', at: [51.2, 16.2, 5], layer: W, wiki: 'Battle of Legnica', title: 'Legnica' },
      { id: 'baghdad', date: '1258-02-10', at: [33.3, 44.4, 5], layer: W, wiki: 'Siege of Baghdad (1258)', title: 'Baghdad' },
      { id: 'yamen', date: '1279-03-19', at: [22.3, 113.1, 5], layer: W, wiki: 'Battle of Yamen', title: 'Yamen' },
    ],
    sources: [WIKI, CLIO, 'TAKIP'],
    hashtags: ['#TAKIP', '#MongolEmpire', '#GenghisKhan', '#History', '#HistoryMaps'],
  },
};
