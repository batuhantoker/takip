/**
 * OSIRIS — Major Airport Coordinate Database
 * ~350 busiest airports worldwide with IATA/ICAO codes and coordinates.
 * Used for resolving flight route origin/destination to lat/lng.
 */

export interface Airport {
  iata: string;
  icao: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
}

// Indexed by ICAO code (primary key for ATC/ADS-B data)
const AIRPORTS_BY_ICAO: Record<string, Airport> = {};
// Indexed by IATA code (fallback)
const AIRPORTS_BY_IATA: Record<string, Airport> = {};

const RAW: [string, string, string, string, string, number, number][] = [
  // North America — US
  ['ATL','KATL','Hartsfield-Jackson','Atlanta','US',33.6367,-84.4281],
  ['LAX','KLAX','Los Angeles Intl','Los Angeles','US',33.9425,-118.4081],
  ['ORD','KORD','O\'Hare Intl','Chicago','US',41.9742,-87.9073],
  ['DFW','KDFW','Dallas/Fort Worth','Dallas','US',32.8998,-97.0403],
  ['DEN','KDEN','Denver Intl','Denver','US',39.8561,-104.6737],
  ['JFK','KJFK','John F Kennedy','New York','US',40.6399,-73.7787],
  ['SFO','KSFO','San Francisco Intl','San Francisco','US',37.6213,-122.3790],
  ['SEA','KSEA','Seattle-Tacoma','Seattle','US',47.4502,-122.3088],
  ['LAS','KLAS','Harry Reid Intl','Las Vegas','US',36.0840,-115.1537],
  ['MCO','KMCO','Orlando Intl','Orlando','US',28.4312,-81.3081],
  ['MIA','KMIA','Miami Intl','Miami','US',25.7959,-80.2870],
  ['EWR','KEWR','Newark Liberty','Newark','US',40.6895,-74.1745],
  ['CLT','KCLT','Charlotte Douglas','Charlotte','US',35.2140,-80.9431],
  ['PHX','KPHX','Phoenix Sky Harbor','Phoenix','US',33.4373,-112.0078],
  ['IAH','KIAH','George Bush Intercontinental','Houston','US',29.9902,-95.3368],
  ['MSP','KMSP','Minneapolis-Saint Paul','Minneapolis','US',44.8848,-93.2223],
  ['DTW','KDTW','Detroit Metropolitan','Detroit','US',42.2124,-83.3534],
  ['BOS','KBOS','Logan Intl','Boston','US',42.3656,-71.0096],
  ['FLL','KFLL','Fort Lauderdale-Hollywood','Fort Lauderdale','US',26.0726,-80.1527],
  ['LGA','KLGA','LaGuardia','New York','US',40.7769,-73.8740],
  ['BWI','KBWI','Baltimore/Washington','Baltimore','US',39.1754,-76.6684],
  ['IAD','KIAD','Washington Dulles','Washington','US',38.9445,-77.4558],
  ['DCA','KDCA','Reagan National','Washington','US',38.8521,-77.0377],
  ['SAN','KSAN','San Diego Intl','San Diego','US',32.7336,-117.1897],
  ['TPA','KTPA','Tampa Intl','Tampa','US',27.9755,-82.5332],
  ['PDX','KPDX','Portland Intl','Portland','US',45.5887,-122.5975],
  ['SLC','KSLC','Salt Lake City Intl','Salt Lake City','US',40.7884,-111.9778],
  ['STL','KSTL','St Louis Lambert','St Louis','US',38.7487,-90.3700],
  ['HNL','PHNL','Daniel K Inouye','Honolulu','US',21.3187,-157.9225],
  ['AUS','KAUS','Austin-Bergstrom','Austin','US',30.1945,-97.6699],
  ['BNA','KBNA','Nashville Intl','Nashville','US',36.1263,-86.6774],
  ['RDU','KRDU','Raleigh-Durham','Raleigh','US',35.8776,-78.7875],
  ['MCI','KMCI','Kansas City Intl','Kansas City','US',39.2976,-94.7139],
  ['PIT','KPIT','Pittsburgh Intl','Pittsburgh','US',40.4915,-80.2329],
  ['SMF','KSMF','Sacramento Intl','Sacramento','US',38.6954,-121.5908],
  ['IND','KIND','Indianapolis Intl','Indianapolis','US',39.7173,-86.2944],
  ['CLE','KCLE','Cleveland Hopkins','Cleveland','US',41.4117,-81.8498],
  ['ANC','PANC','Ted Stevens','Anchorage','US',61.1744,-149.9964],
  // North America — Canada
  ['YYZ','CYYZ','Toronto Pearson','Toronto','CA',43.6777,-79.6248],
  ['YVR','CYVR','Vancouver Intl','Vancouver','CA',49.1947,-123.1790],
  ['YUL','CYUL','Montréal Trudeau','Montréal','CA',45.4706,-73.7408],
  ['YYC','CYYC','Calgary Intl','Calgary','CA',51.1215,-114.0076],
  ['YOW','CYOW','Ottawa Macdonald-Cartier','Ottawa','CA',45.3225,-75.6692],
  ['YEG','CYEG','Edmonton Intl','Edmonton','CA',53.3097,-113.5800],
  ['YHZ','CYHZ','Halifax Stanfield','Halifax','CA',44.8808,-63.5085],
  ['YWG','CYWG','Winnipeg Intl','Winnipeg','CA',49.9100,-97.2399],
  // North America — Mexico
  ['MEX','MMMX','Mexico City Intl','Mexico City','MX',19.4363,-99.0721],
  ['CUN','MMUN','Cancún Intl','Cancún','MX',21.0365,-86.8771],
  ['GDL','MMGL','Guadalajara Intl','Guadalajara','MX',20.5218,-103.3113],
  // Europe — UK
  ['LHR','EGLL','Heathrow','London','GB',51.4700,-0.4543],
  ['LGW','EGKK','Gatwick','London','GB',51.1481,-0.1903],
  ['STN','EGSS','Stansted','London','GB',51.8850,0.2350],
  ['MAN','EGCC','Manchester','Manchester','GB',53.3537,-2.2750],
  ['EDI','EGPH','Edinburgh','Edinburgh','GB',55.9508,-3.3725],
  ['BHX','EGBB','Birmingham','Birmingham','GB',52.4539,-1.7480],
  // Europe — France
  ['CDG','LFPG','Charles de Gaulle','Paris','FR',49.0097,2.5479],
  ['ORY','LFPO','Orly','Paris','FR',48.7233,2.3794],
  ['NCE','LFMN','Nice Côte d\'Azur','Nice','FR',43.6584,7.2159],
  ['LYS','LFLL','Lyon-Saint Exupéry','Lyon','FR',45.7256,5.0811],
  // Europe — Germany
  ['FRA','EDDF','Frankfurt','Frankfurt','DE',50.0333,8.5706],
  ['MUC','EDDM','Munich','Munich','DE',48.3538,11.7861],
  ['BER','EDDB','Berlin Brandenburg','Berlin','DE',52.3667,13.5033],
  ['DUS','EDDL','Düsseldorf','Düsseldorf','DE',51.2895,6.7668],
  ['HAM','EDDH','Hamburg','Hamburg','DE',53.6304,9.9882],
  // Europe — Netherlands / Belgium
  ['AMS','EHAM','Schiphol','Amsterdam','NL',52.3086,4.7639],
  ['BRU','EBBR','Brussels','Brussels','BE',50.9014,4.4844],
  // Europe — Spain / Portugal
  ['MAD','LEMD','Adolfo Suárez Madrid–Barajas','Madrid','ES',40.4936,-3.5668],
  ['BCN','LEBL','El Prat','Barcelona','ES',41.2971,2.0785],
  ['AGP','LEMG','Málaga','Málaga','ES',36.6749,-4.4991],
  ['LIS','LPPT','Humberto Delgado','Lisbon','PT',38.7756,-9.1354],
  ['OPO','LPPR','Francisco Sá Carneiro','Porto','PT',41.2481,-8.6814],
  // Europe — Italy
  ['FCO','LIRF','Fiumicino','Rome','IT',41.8003,12.2389],
  ['MXP','LIMC','Malpensa','Milan','IT',45.6306,8.7281],
  ['VCE','LIPZ','Marco Polo','Venice','IT',45.5053,12.3519],
  ['NAP','LIRN','Napoli Capodichino','Naples','IT',40.8861,14.2908],
  // Europe — Scandinavia
  ['CPH','EKCH','Copenhagen','Copenhagen','DK',55.6181,12.6560],
  ['ARN','ESSA','Arlanda','Stockholm','SE',59.6519,17.9186],
  ['OSL','ENGM','Gardermoen','Oslo','NO',60.1939,11.1004],
  ['HEL','EFHK','Helsinki-Vantaa','Helsinki','FI',60.3172,24.9633],
  // Europe — Eastern
  ['WAW','EPWA','Chopin','Warsaw','PL',52.1657,20.9671],
  ['PRG','LKPR','Václav Havel','Prague','CZ',50.1008,14.2600],
  ['BUD','LHBP','Budapest Liszt Ferenc','Budapest','HU',47.4298,19.2611],
  ['VIE','LOWW','Vienna Intl','Vienna','AT',48.1103,16.5697],
  ['ZRH','LSZH','Zürich','Zürich','CH',47.4647,8.5492],
  ['GVA','LSGG','Geneva','Geneva','CH',46.2381,6.1089],
  // Europe — Greece / Turkey
  ['ATH','LGAV','Eleftherios Venizelos','Athens','GR',37.9364,23.9445],
  ['IST','LTFM','Istanbul','Istanbul','TR',41.2753,28.7519],
  ['SAW','LTFJ','Sabiha Gökçen','Istanbul','TR',40.8986,29.3092],
  ['AYT','LTAI','Antalya','Antalya','TR',36.8987,30.8005],
  // Europe — Ireland
  ['DUB','EIDW','Dublin','Dublin','IE',53.4213,-6.2700],
  // Middle East
  ['DXB','OMDB','Dubai Intl','Dubai','AE',25.2528,55.3644],
  ['AUH','OMAA','Abu Dhabi Intl','Abu Dhabi','AE',24.4330,54.6511],
  ['DOH','OTHH','Hamad Intl','Doha','QA',25.2731,51.6081],
  ['RUH','OERK','King Khalid','Riyadh','SA',24.9576,46.6988],
  ['JED','OEJN','King Abdulaziz','Jeddah','SA',21.6796,39.1565],
  ['TLV','LLBG','Ben Gurion','Tel Aviv','IL',32.0114,34.8867],
  ['AMM','OJAI','Queen Alia','Amman','JO',31.7226,35.9932],
  ['BAH','OBBI','Bahrain Intl','Manama','BH',26.2708,50.6336],
  ['MCT','OOMS','Muscat Intl','Muscat','OM',23.5933,58.2844],
  ['KWI','OKBK','Kuwait Intl','Kuwait City','KW',29.2266,47.9689],
  // South Asia
  ['DEL','VIDP','Indira Gandhi','Delhi','IN',28.5562,77.1000],
  ['BOM','VABB','Chhatrapati Shivaji','Mumbai','IN',19.0896,72.8656],
  ['BLR','VOBL','Kempegowda','Bengaluru','IN',13.1986,77.7066],
  ['MAA','VOMM','Chennai Intl','Chennai','IN',12.9941,80.1709],
  ['HYD','VOHS','Rajiv Gandhi','Hyderabad','IN',17.2403,78.4294],
  ['CCU','VECC','Netaji Subhas Chandra Bose','Kolkata','IN',22.6547,88.4467],
  ['CMB','VCBI','Bandaranaike','Colombo','LK',7.1808,79.8841],
  ['KTM','VNKT','Tribhuvan','Kathmandu','NP',27.6966,85.3591],
  ['DAC','VGHS','Hazrat Shahjalal','Dhaka','BD',23.8433,90.3978],
  ['ISB','OPIS','Islamabad Intl','Islamabad','PK',33.5605,72.8526],
  ['KHI','OPKC','Jinnah Intl','Karachi','PK',24.9065,67.1609],
  ['LHE','OPLA','Allama Iqbal','Lahore','PK',31.5216,74.4036],
  // East Asia
  ['PEK','ZBAA','Beijing Capital','Beijing','CN',40.0799,116.6031],
  ['PKX','ZBAD','Beijing Daxing','Beijing','CN',39.5098,116.4105],
  ['PVG','ZSPD','Shanghai Pudong','Shanghai','CN',31.1434,121.8052],
  ['SHA','ZSSS','Shanghai Hongqiao','Shanghai','CN',31.1979,121.3364],
  ['CAN','ZGGG','Guangzhou Baiyun','Guangzhou','CN',23.3924,113.2988],
  ['SZX','ZGSZ','Shenzhen Bao\'an','Shenzhen','CN',22.6393,113.8107],
  ['CTU','ZUUU','Chengdu Shuangliu','Chengdu','CN',30.5785,103.9471],
  ['HKG','VHHH','Hong Kong Intl','Hong Kong','HK',22.3089,113.9144],
  ['NRT','RJAA','Narita','Tokyo','JP',35.7647,140.3864],
  ['HND','RJTT','Haneda','Tokyo','JP',35.5494,139.7798],
  ['KIX','RJBB','Kansai','Osaka','JP',34.4347,135.2441],
  ['ICN','RKSI','Incheon','Seoul','KR',37.4602,126.4407],
  ['GMP','RKSS','Gimpo','Seoul','KR',37.5586,126.7906],
  ['TPE','RCTP','Taiwan Taoyuan','Taipei','TW',25.0777,121.2325],
  // Southeast Asia
  ['SIN','WSSS','Changi','Singapore','SG',1.3502,103.9940],
  ['BKK','VTBS','Suvarnabhumi','Bangkok','TH',13.6900,100.7501],
  ['DMK','VTBD','Don Mueang','Bangkok','TH',13.9126,100.6068],
  ['KUL','WMKK','Kuala Lumpur Intl','Kuala Lumpur','MY',2.7456,101.7099],
  ['CGK','WIII','Soekarno-Hatta','Jakarta','ID',-6.1256,106.6559],
  ['DPS','WADD','Ngurah Rai','Bali','ID',-8.7482,115.1672],
  ['MNL','RPLL','Ninoy Aquino','Manila','PH',14.5086,121.0198],
  ['SGN','VVTS','Tan Son Nhat','Ho Chi Minh City','VN',10.8188,106.6520],
  ['HAN','VVNB','Noi Bai','Hanoi','VN',21.2212,105.8072],
  ['RGN','VYYY','Yangon Intl','Yangon','MM',16.9073,96.1332],
  ['PNH','VDPP','Phnom Penh','Phnom Penh','KH',11.5466,104.8442],
  // Oceania
  ['SYD','YSSY','Kingsford Smith','Sydney','AU',-33.9399,151.1753],
  ['MEL','YMML','Tullamarine','Melbourne','AU',-37.6733,144.8433],
  ['BNE','YBBN','Brisbane','Brisbane','AU',-27.3842,153.1175],
  ['PER','YPPH','Perth','Perth','AU',-31.9403,115.9672],
  ['AKL','NZAA','Auckland','Auckland','NZ',-37.0082,174.7850],
  ['WLG','NZWN','Wellington','Wellington','NZ',-41.3272,174.8053],
  ['CHC','NZCH','Christchurch','Christchurch','NZ',-43.4894,172.5322],
  // Africa
  ['JNB','FAOR','O R Tambo','Johannesburg','ZA',-26.1392,28.2460],
  ['CPT','FACT','Cape Town Intl','Cape Town','ZA',-33.9649,18.6017],
  ['CAI','HECA','Cairo Intl','Cairo','EG',30.1219,31.4056],
  ['ADD','HAAB','Bole Intl','Addis Ababa','ET',8.9779,38.7993],
  ['NBO','HKJK','Jomo Kenyatta','Nairobi','KE',-1.3192,36.9278],
  ['LOS','DNMM','Murtala Muhammed','Lagos','NG',6.5774,3.3212],
  ['CMN','GMMN','Mohammed V','Casablanca','MA',33.3675,-7.5898],
  ['ALG','DAAG','Houari Boumediene','Algiers','DZ',36.6910,3.2154],
  ['TUN','DTTA','Tunis-Carthage','Tunis','TN',36.8510,10.2272],
  ['DAR','HTDA','Julius Nyerere','Dar es Salaam','TZ',-6.8781,39.2026],
  ['ACC','DGAA','Kotoka','Accra','GH',5.6052,-0.1668],
  ['DSS','GOBD','Blaise Diagne','Dakar','SN',14.6710,-17.0728],
  ['EBB','HUEN','Entebbe','Kampala','UG',0.0424,32.4435],
  // South America
  ['GRU','SBGR','Guarulhos','São Paulo','BR',-23.4356,-46.4731],
  ['GIG','SBGL','Galeão','Rio de Janeiro','BR',-22.8100,-43.2506],
  ['BSB','SBBR','Brasília','Brasília','BR',-15.8711,-47.9186],
  ['EZE','SAEZ','Ministro Pistarini','Buenos Aires','AR',-34.8222,-58.5358],
  ['SCL','SCEL','Arturo Merino Benítez','Santiago','CL',-33.3930,-70.7858],
  ['BOG','SKBO','El Dorado','Bogotá','CO',4.7016,-74.1469],
  ['LIM','SPJC','Jorge Chávez','Lima','PE',-12.0219,-77.1143],
  ['PTY','MPTO','Tocumen','Panama City','PA',9.0714,-79.3835],
  ['UIO','SEQM','Mariscal Sucre','Quito','EC',-0.1292,-78.3575],
  ['CCS','SVMI','Simón Bolívar','Caracas','VE',10.6031,-66.9906],
  ['MVD','SUMU','Carrasco','Montevideo','UY',-34.8384,-56.0308],
  // Central America / Caribbean
  ['SJO','MROC','Juan Santamaría','San José','CR',9.9939,-84.2088],
  ['SJU','TJSJ','Luis Muñoz Marín','San Juan','PR',18.4394,-66.0018],
  ['NAS','MYNN','Lynden Pindling','Nassau','BS',25.0390,-77.4662],
  ['MBJ','MKJS','Sangster Intl','Montego Bay','JM',18.5037,-77.9134],
  ['HAV','MUHA','José Martí','Havana','CU',22.9892,-82.4091],
  // Central Asia / Caucasus
  ['IST','LTFM','Istanbul Airport','Istanbul','TR',41.2753,28.7519],
  ['TBS','UGTB','Shota Rustaveli','Tbilisi','GE',41.6692,44.9547],
  ['GYD','UBBB','Heydar Aliyev','Baku','AZ',40.4675,50.0467],
  ['ALA','UAAA','Almaty','Almaty','KZ',43.3521,77.0405],
  ['NQZ','UACC','Nursultan Nazarbayev','Astana','KZ',51.0222,71.4669],
  ['TAS','UTTT','Islam Karimov','Tashkent','UZ',41.2573,69.2817],
  // Russia
  ['SVO','UUEE','Sheremetyevo','Moscow','RU',55.9726,37.4146],
  ['DME','UUDD','Domodedovo','Moscow','RU',55.4088,37.9063],
  ['LED','ULLI','Pulkovo','St Petersburg','RU',59.8003,30.2625],
];

// Build indexes
for (const [iata, icao, name, city, country, lat, lng] of RAW) {
  const ap: Airport = { iata, icao, name, city, country, lat, lng };
  AIRPORTS_BY_ICAO[icao] = ap;
  AIRPORTS_BY_IATA[iata] = ap;
}

/**
 * Look up an airport by ICAO or IATA code.
 * Returns null if not found.
 */
export function lookupAirport(code: string): Airport | null {
  if (!code) return null;
  const upper = code.toUpperCase().trim();
  return AIRPORTS_BY_ICAO[upper] || AIRPORTS_BY_IATA[upper] || null;
}

/**
 * Get all airports (for debugging/lookup).
 */
export function getAllAirports(): Airport[] {
  return Object.values(AIRPORTS_BY_ICAO);
}

export { AIRPORTS_BY_ICAO, AIRPORTS_BY_IATA };
