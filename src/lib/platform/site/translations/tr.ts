import type { SiteCopy } from '../copy';

const FLIGHT_SOURCES = [
  'Dünya çapındaki ADS-B alıcı ağından gelen konumlar.',
  'Topluluk ADS-B ağları: askeri uçaklar, uçak tipleri ve çevrenizin yakın görünümü.',
  'Bir uçağı açtığınızda sorgulanan rota ve gövde bilgileri.',
];
const FLIGHT_FRESHNESS =
  'Bir bölgeye yakınlaştırdığınızda yaklaşık 250 deniz mili içindeki uçaklar 15 saniyede bir yenilenir. Dünya görünümü birkaç dakikada bir yenilenir; bu yüzden oradaki bir uçak gerçek konumunun birkaç dakika gerisinde olabilir.';
const NOT_FOR_PLANNING = 'Koşullara genel bir bakış içindir, uçuş planlaması için değildir.';

const CELESTRAK = 'Aktif uydular, parlak cisimler ve üç enkaz bulutu için yayımlanan yörünge elemanları.';
const ORBIT_FRESHNESS =
  'Yörünge elemanları CelesTrak’ten 2 saatte bir yenilenir. Konumlar bunlardan tarayıcınızda hesaplanır; böylece uydular gerçek zamanlı ve akıcı biçimde hareket eder.';
const NAMED_BY_NAME = 'Bu katman uydu adına göre ayıklanır, bu yüzden yaklaşıktır: birkaç uydu yanlış gruba düşer ya da hiçbir gruba girmez.';

const HORIZONS = 'Gezegenlerin, doğal uyduların ve uzay araçlarının konumları.';
const ALWAYS_NOW = 'Her zaman şimdi: her şey içinde bulunduğumuz an için konumlanır.';
const NO_TIME = 'Canlı görünümde henüz zaman kontrolleri yok; şimdiki anı gösterir.';
const ENDED = 'Sona ermiş görevler henüz listelenmiyor.';
const SURFACE_NOW = 'Yüzey bir mozaiktir; yörünge araçları şimdiki an için konumlanır.';

const GFS = 'Unidata’nın THREDDS sunucusundan okunan, 0,25°’lik ızgaradaki Global Forecast System.';
const OPEN_METEO = 'GFS alanı yüklenirken gösterilen kaba bir ızgara ve tıkladığınızda ayrıntılar.';
const GFS_FRESHNESS =
  'GFS her 6 saatte bir çalışır ve 3 saatlik adımlarla tahmin üretir. Harita şimdiye en yakın adımı gösterir ve 15 dakikada bir daha yenisi olup olmadığını kontrol eder.';
const DETAIL_Z7 = 'Ayrıntı yaklaşık 7. yakınlaştırma düzeyinde biter.';

const CLOUDFLARE = 'Cloudflare’in taşıdığı internet trafiği payında gördükleri.';

const BORDERS = 'MÖ 3400’den 2024’e yıl yıl dünya sınırları.';
const EVENTS =
  'Diğerlerinin yanı sıra Correlates of War, UCDP, Global Terrorism Database, NOAA doğal tehlike kayıtları, SIPRI’nin nükleer deneme verileri, UNESCO ve Wikidata.';
const HISTORY_FRESHNESS = 'Tarihî kayıtlar bir kez içe aktarılır ve nadiren değişir; kaynakları yeni sürüm yayımladığında güncellenir.';
const RECONSTRUCTED = 'Sınırlar yeniden çizimdir: belirsiz ya da tartışmalı oldukları yerlerde harita bunların tek bir yorumunu gösterir.';
const LIVE_PAUSES = 'Tarih açıkken canlı katmanlar duraklar.';
const PLATES = '1,8 milyar yıl geriye uzanan, CC BY 4.0 lisansıyla yayımlanmış tam levha tektonik modeli.';
const CLIMATE = 'Son 485 milyon yılda Dünya’nın ortalama sıcaklığı ve CO₂ düzeyi.';
const DEEP_FRESHNESS = 'Yayımlanmış yeniden yapılandırmalar; modeller revize edildiğinde değişir.';

const DESKTOP = 'Şimdilik yalnızca masaüstünde.';

const copy: SiteCopy = {
  sections: {
    air: { label: 'Havada', blurb: 'ADS-B alıcılarından uçaklar, havalimanları ve çevrelerindeki hava sahası.' },
    sea: { label: 'Denizde', blurb: 'AIS ile izlenen gemiler ve içinden geçtikleri dar boğazlar ile kanallar.' },
    space: { label: 'Uzayda', blurb: 'Uydular, ISS, roket fırlatmaları ve kutup ışıkları.' },
    weather: { label: 'Hava durumu', blurb: 'Radar, rüzgâr, sıcaklık, yıldırım ve hava durumu uydularından Dünya.' },
    hazards: { label: 'Tehlikeler', blurb: 'Depremler, orman yangınları, fırtınalar, radyasyon ve salgın hastalıklar.' },
    cameras: { label: 'Kameralar ve yayınlar', blurb: 'Herkese açık kameralar ve canlı haber yayınları, bulundukları yerde işaretli.' },
    ground: { label: 'Karada', blurb: 'Yol trafiği, otobüsler ve trenler, yürüyüş parkurları.' },
    world: { label: 'Dünya olayları', blurb: 'Bildirildiği anda haberler, hava saldırısı alarmları ve bir krizde önem taşıyan yerler.' },
    network: { label: 'İnternet', blurb: 'Kesintiler, saldırılar, zararlı yazılımlar ve tüm bunları taşıyan kablolar.' },
    past: { label: 'Geçmişe yolculuk', blurb: 'Kaydedilen trafiği yeniden oynatın, tarihte gezinin ve kıtaların kaymasını izleyin.' },
    tools: { label: 'Araçlar', blurb: 'Alan çizin, rota planlayın, sorgulama yapın ve haritadakiler hakkında TI’a sorun.' },
  },
  about: {
    title: 'TAKIP hakkında: dünya, olduğu anda, tek bir haritada',
    description:
      'TAKIP neden var: dünyaya dair kamuya açık veri her yerde ama dağınık. TAKIP uçuş, gemi, uydu, kamera, deprem ve hava verisini tek canlı haritada toplar.',
    kicker: 'TAKIP hakkında',
    heading: 'Dünya, olduğu anda, tek bir haritada',
    lede: 'Uçaklar nerede olduklarını yayınlar. Gemiler konumlarını telsizle bildirir. Uydular yayımlanmış yörüngeleri izler, sismograflar her sarsıntının zamanını kaydeder, hava radarları gökyüzünü tarar ve şehirler kameralarını sokaklarına çevirir. Bunların neredeyse hepsi kamuya açık. TAKIP hepsini tek bir canlı haritada toplar; böylece dünyaya bakabilir ve hareket edişini izleyebilirsiniz.',
    whyTitle: 'Neden var',
    why: [
      'Bu akışların her biri kendi sitesinde, kendi haritasıyla ve kendi gösterme biçimiyle durur. Bir araya geldiklerinde çok daha fazlasını anlatırlar: şehrinizin üzerindeki uçakları ve etrafından dolaştıkları fırtınayı, bir boğazın önünde sıra bekleyen gemileri, bir depremin az önce salladığı kıyıyı ve oraya bakan kameraları, bu gece üzerinizden geçecek uyduyu.',
      'TAKIP bakmak, izlemek ve anlamak için yapıldı. Sakin bir akşam açıp ISS’i takip edin ya da yoğun bir haber gününde açıp olayların nerede yaşandığını görün. Adını da buradan alıyor: olan biteni takip etmek.',
    ],
    onMapTitle: 'Haritada neler var',
    moreTitle: 'Canlı bir haritadan fazlası',
    more: [
      'Tekrar oynatma, TAKIP’in kaydettiklerini yeniden oynatır; böylece daha önceki bir günün uçuşları ve gemileri arasında ileri geri gezinebilirsiniz.',
      'Tarih, geçmişin bir atlasıdır: yüzyıllar boyunca dünyanın sınırları ve yüz milyonlarca yıl boyunca kayan kıtalar.',
      'Uzay, Dünya’dan ayrılıp çevresindeki uyduların ve ötesindeki gezegenlerin gerçek zamanlı 3D görünümüne geçer.',
      'Alanlar, haritada bir şekil çizmenizi, içinde ne olduğunu görmenizi ve girip çıkanların kaydını tutmanızı sağlar.',
      'TI, haritayı sizinle birlikte okuyan ve verdiğiniz yapay zekâ anahtarıyla haritadakiler hakkındaki soruları yanıtlayan bir asistandır.',
      'Baktığınız şeyi, bir uçağı, gemiyi, uyduyu ya da bir yeri paylaşın; bağlantı aynı görünümü, açıldığı andaki hâliyle açar.',
    ],
    honestTitle: 'Verisi konusunda dürüst',
    honest:
      'Her katman verisinin nereden geldiğini ve ne kadar güncel olduğunu belirtir. Bir şey canlı görülmek yerine tahmin ediliyor, çıkarım yapılarak bulunuyor ya da tarifeye göre çalıştırılıyorsa harita bunu söyler. Kapsama eşit değildir: uçaklar ve gemiler alıcıların onları duyduğu yerlerde görünür, bir şehrin kameraları ise ancak şehir onları yayımlıyorsa haritadadır. Her katmanın sayfası size neyi söyleyemeyeceğini listeler.',
    freeTitle: 'Kullanımı ücretsiz',
    free: 'TAKIP ücretsizdir. Hesap olmadan her gün belirli bir süre haritayı kullanabilirsiniz; ücretsiz bir hesap size daha fazlasını verir. Ücretsiz planlarda birkaç reklam gösterilir, asla haritanın üzerinde değil. TAKIP’in ziyaretiniz hakkında neleri sakladığı gizlilik sayfasında açıkça anlatılır.',
  },
  sourceNames: {
    '2MRS, SDSS and WMAP': '2MRS, SDSS ve WMAP',
    'adsb.lol and adsb.fi': 'adsb.lol ve adsb.fi',
    'adsbdb, hexdb.io and airplanes.live': 'adsbdb, hexdb.io ve airplanes.live',
    'Agency APIs': 'Ulaşım kurumlarının API’leri',
    'Cities': 'Şehirler',
    'CDC travel health notices': 'CDC seyahat sağlığı uyarıları',
    'CWFIS and BC Wildfire Service': 'CWFIS ve BC Wildfire Service',
    'Environment Canada and the provinces': 'Environment Canada ve eyaletler',
    'Event records': 'Olay kayıtları',
    'GDACS and NASA EONET': 'GDACS ve NASA EONET',
    'IMF, OECD and ERA5': 'IMF, OECD ve ERA5',
    'Israel': 'İsrail',
    'Mobility Database and Transitland': 'Mobility Database ve Transitland',
    'NASA EONET, NWS and GDACS': 'NASA EONET, NWS ve GDACS',
    'NASA SDO, through Helioviewer': 'NASA SDO, Helioviewer üzerinden',
    'News wires and Telegram': 'Haber ajansları ve Telegram',
    'News wires': 'Haber ajansları',
    'NHC and the Hong Kong Observatory': 'NHC ve Hong Kong Gözlemevi',
    'OpenSky, adsb.lol and adsb.fi': 'OpenSky, adsb.lol ve adsb.fi',
    'Public registries and services': 'Herkese açık kayıtlar ve hizmetler',
    'Rennes and Nantes Métropole': 'Rennes ve Nantes Métropole',
    'Road authorities': 'Karayolu idareleri',
    'The map’s own layers': 'Haritanın kendi katmanları',
    'Ukraine': 'Ukrayna',
    'United Nations': 'Birleşmiş Milletler',
    'US National Hurricane Center': 'ABD Ulusal Kasırga Merkezi',
    'US National Weather Service': 'ABD Ulusal Meteoroloji Servisi',
    'USGS and EMSC': 'USGS ve EMSC',
    'Vendor status pages': 'Sağlayıcı durum sayfaları',
    'Webcam networks': 'Web kamerası ağları',
    'WHO Disease Outbreak News': 'WHO salgın haberleri',
    'WMO Severe Weather Information Centre': 'WMO Şiddetli Hava Bilgi Merkezi',
    'Worked out in your browser': 'Tarayıcınızda hesaplanır',
    'World Bank': 'Dünya Bankası',
    'World War II layer': 'II. Dünya Savaşı katmanı',
    'Yale Bright Star, Hipparcos and Gaia DR3': 'Yale Bright Star, Hipparcos ve Gaia DR3',
    'Your AI provider': 'Yapay zekâ sağlayıcınız',
    'YouTube and Rumble': 'YouTube ve Rumble',
  },
  pages: {
    'flight-tracker': {
      title: 'Canlı uçak takip haritası: şu an havadaki uçaklar',
      description:
        'Şu an gökyüzündeki uçakları ADS-B verisiyle ücretsiz canlı haritada görün: yolcu uçakları, özel jetler ve askeri uçuşlar; irtifa, hız ve rotalarıyla.',
      heading: 'Canlı uçak takibi',
      lede: 'Konumunu ADS-B ile yayınlayan ve bir alıcının duyduğu her uçak, bulunduğu yerde çizilir ve harita üzerinde ilerler.',
      shows: [
        'Yolcu uçakları, özel uçaklar, iş jetleri ve askeri uçuşlar; her biri açıp kapatabileceğiniz ayrı bir katman.',
        'Her uçak uçtuğu yönü gösterir. Çağrı kodu, tipi ve işletmecisi, irtifası, hızı, yönü ve squawk kodu için birine tıklayın.',
        'Rotası ve gövdesi bilinen uçuşlarda kart, uçuşun nereden gelip nereye gittiğini gösterir; FlightAware ve ADS-B Exchange bağlantılarıyla.',
        'Bir uçağı takip ettiğinizde harita onu görüş alanında tutar. Bağlantıyı paylaşın; açan kişi de aynı uçağı takip eder.',
      ],
      sources: FLIGHT_SOURCES,
      freshness: FLIGHT_FRESHNESS,
      limits: [
        'Yalnızca ADS-B yayını yapan uçaklar ve yalnızca bir alıcının onları duyduğu yerlerde görünür. Okyanuslar ve ıssız bölgeler üzerinde kapsama zayıflar.',
        'Bir uçuşun yolcu uçuşu mu, özel uçuş mu, iş jeti mi olduğu tipinden, çağrı kodundan, irtifasından ve hızından çıkarılır; bu yüzden birkaçı yanlış katmana düşer.',
      ],
      spots: [
        { label: 'Londra', note: 'Heathrow, Gatwick ve çevrelerindeki bekleme paternleri.' },
        { label: 'New York', note: 'JFK, LaGuardia ve Newark tek görünümde.' },
        { label: 'İstanbul', note: 'İki kıtada İstanbul Havalimanı ve Sabiha Gökçen.' },
        { label: 'Kuzey Atlantik', note: 'Avrupa ile Kuzey Amerika arasındaki uçuş koridorları. Okyanusun ortasında kapsama azalır.' },
      ],
    },
    'military-aircraft': {
      title: 'Askeri uçak takibi: canlı askeri uçuş haritası',
      description:
        'ADS-B yayını yapan askeri uçaklar canlı haritada: tanker, nakliye, devriye ve keşif uçuşları; bilindiği yerlerde tipi, irtifası ve hızıyla.',
      heading: 'Askeri uçaklar, canlı',
      lede: 'Konumunu yayınlayan askeri ve devlet uçakları, ADS-B akışından ayıklanır ve kendine ait bir katmanda çizilir.',
      shows: [
        'Tanker, nakliye, deniz devriye, gözetleme ve eğitim uçuşları; yayın yaptıkları her yerde.',
        'Çağrı kodu, tipi, irtifası, hızı ve yönü için birine tıklayın; daha fazla araştırmak için bağlantılar da var.',
        'Uçakların navigasyon doğruluğunun düştüğünü bildirdiği yerleri görmek için yanında GPS parazitini açın.',
      ],
      sources: [
        'Askeri akışı ve uçak tipi anlık görüntüleri; bu katmanın ana kaynağı.',
        'adsb.lol erişilemediğinde kullanılan ikinci bir askeri akış.',
        'Havadaki diğer her şey; bilinen askeri tipler ve çağrı kodu önekleri buradan daha fazlasını ayıklar.',
      ],
      freshness: 'Askeri akış birkaç dakikada bir yenilenir; yakınlaştırdığınızda görünümünüzün çevresindeki uçaklar ise 15 saniyede bir.',
      limits: [
        'Savaş uçaklarının çoğu ve birçok devlet uçuşu yayın yapmaz ya da kimlik bilgisi olmadan yayın yapar. Gördüğünüz, görünmeyi seçen kısımdır.',
        'Bir uçak, ağın işaretine, tipine ya da çağrı koduna göre askeri sayılır; bu yüzden bazıları gözden kaçar, birkaç sivil uçak da araya karışır.',
        'Gönüllü alıcılar en yoğun Avrupa ve Kuzey Amerika üzerindedir; okyanuslar ve çatışma bölgeleri üzerinde seyrektir.',
      ],
      spots: [
        { label: 'Doğu Avrupa', note: 'Gözetleme ve tanker uçuşları sık sık NATO’nun doğu kanadı boyunca tur atar.' },
        { label: 'Doğu Akdeniz', note: 'Kıbrıs, Levant ve Girit arasında nakliye ve devriye uçakları.' },
        { label: 'Basra Körfezi', note: 'Körfez’in iki yakasındaki hava üsleri.' },
      ],
    },
    'private-jets': {
      title: 'Özel jet takibi: iş jetleri canlı haritada',
      description:
        'İş jetleri ve özel uçaklar ADS-B verisiyle ücretsiz canlı haritada: nerede oldukları, ne kadar yüksekte ve hızlı uçtukları; bilindiğinde tipi ve tescili.',
      heading: 'Özel jetler, canlı',
      lede: 'İş jetleri ve özel uçaklar, her biri kendi katmanında; yolcu uçaklarıyla aynı ADS-B akışlarından.',
      shows: [
        'Hafif jetlerden uzun menzillilere iş jetleri ve aynı yolculukları yapan PC-12 ve TBM gibi hızlı turboproplar.',
        'Özel uçaklar: eğitim uçuşlarından gezi uçuşlarına küçük uçaklar ve genel havacılık.',
        'Tipi, tescili, irtifası, hızı ve yönü için birine tıklayın; FlightAware ve ADS-B Exchange bağlantılarıyla.',
      ],
      sources: FLIGHT_SOURCES,
      freshness: FLIGHT_FRESHNESS,
      limits: [
        'Sahipler gizlilik programlarıyla kimliklerini gizleyebilir; bu yüzden bazı jetler adı ya da tescili olmadan görünür.',
        'Jet olup olmadığına, biliniyorsa uçak tipine, bilinmiyorsa hız ve irtifaya bakılarak karar verilir; bu yüzden ayrım yaklaşıktır.',
      ],
      spots: [
        { label: 'Teterboro', note: 'New York’un iş jeti havalimanı; ABD’nin en yoğunlarından biri.' },
        { label: 'Van Nuys', note: 'Los Angeles’ın genel havacılık merkezi.' },
        { label: 'Paris–Le Bourget', note: 'Avrupa’nın en yoğun iş havacılığı havalimanı.' },
      ],
    },
    'airport-delays': {
      title: 'ABD havalimanı gecikmeleri: FAA kalkış durdurmaları, canlı',
      description:
        'FAA havalimanı durumu canlı haritada: ABD havalimanlarında kalkış durdurmaları, yerde bekletme programları, varış ve kalkış gecikmeleri; birkaç dakikada bir.',
      heading: 'ABD havalimanı gecikmeleri',
      lede: 'FAA’nın canlı havalimanı durumu haritada işaretli: şu an hangi ABD havalimanlarında kalkış durdurma ya da gecikme programı uygulandığı.',
      shows: [
        'Gecikme programı yürürlükte olan her ABD havalimanında bir işaret.',
        'Havalimanı ve uygulanan programlar için birine tıklayın: kalkış durdurmaları, yerde bekletmeler ve varış ya da kalkış gecikmeleri; FAA bağlantısıyla.',
      ],
      sources: ['Federal Havacılık İdaresi’nin nasstatus.faa.gov adresinde yayımladığı ulusal hava sahası durumu.'],
      freshness: 'FAA durumu 2 dakikada bir okunur; harita değişiklikleri 5 dakikada bir kontrol eder.',
      limits: [
        'Yalnızca Amerika Birleşik Devletleri: FAA bu bilgiyi ABD havalimanları için yayımlar.',
        'Uygulanan bir program olmayan havalimanları gösterilmez; yani boş bir harita iyi haber demektir.',
      ],
    },
    'airport-weather': {
      title: 'Havalimanı hava durumu: canlı METAR ve uçuş kategorileri',
      description:
        'Dünya genelinde METAR raporlarından canlı havalimanı hava durumu; uçuş kategorisine göre renkli (VFR, MVFR, IFR, LIFR), rüzgâr, görüş, tavan ve sıcaklıkla.',
      heading: 'Havalimanı hava durumu (METAR)',
      lede: 'Rapor veren her havalimanının son hava raporu, uçuş açısından anlamına göre renklendirilir: açık, marjinal, aletli ya da düşük aletli koşullar.',
      shows: [
        'Rapor veren her istasyonda uçuş kategorisine göre renkli bir nokta: VFR, MVFR, IFR ya da LIFR. İstasyon adları 7. yakınlaştırma düzeyinden itibaren görünür.',
        'Rüzgâr, görüş mesafesi, bulut tavanı, hava olayı, sıcaklık ve çiy noktası ile raporun kaç dakikalık olduğu için bir istasyona tıklayın.',
      ],
      sources: ['NOAA’nın aviationweather.gov adresindeki METAR önbelleği; dünya genelinde rapor veren istasyonları kapsar.'],
      freshness: 'Raporlar 5 dakikada bir okunur. Çoğu havalimanı saatte bir METAR yayımlar, hava değiştiğinde daha sık.',
      limits: ['Meteoroloji istasyonu olmayan küçük havaalanları görünmez.', NOT_FOR_PLANNING],
    },
    'turbulence-sigmets': {
      title: 'SIGMET haritası: türbülans, buzlanma ve volkanik kül',
      description:
        'Canlı haritada uluslararası SIGMET’ler: şiddetli türbülans, buzlanma, gök gürültülü fırtına ya da volkanik kül olan hava sahası; seviye, hareket ve süreleriyle.',
      heading: 'Tehlikeli hava sahası (SIGMET)',
      lede: 'Pilotlara tehlikeli hava için verilen uyarılar: şiddetli türbülans, buzlanma, gök gürültülü fırtına ve volkanik kül alanları, tahmincilerin yayımladığı şekillerle çizilir.',
      shows: [
        'Yürürlükteki her uluslararası SIGMET, sınırları çizilmiş bir alan olarak.',
        'Tehlike türü, uçuş bilgi bölgesi, kapsadığı seviyeler, hangi yöne ilerlediği, güçlenip zayıfladığı ve ne kadar süre geçerli olduğu için birine tıklayın.',
      ],
      sources: ['aviationweather.gov adresinde yayımlanan uluslararası SIGMET’ler.'],
      freshness: '5 dakikada bir kontrol edilir; süresi dolan uyarılar kaldırılır.',
      limits: ['Yalnızca uluslararası SIGMET’ler. ABD iç SIGMET’leri ve AIRMET’ler henüz gösterilmiyor.', NOT_FOR_PLANNING],
    },
    'gps-jamming': {
      title: 'GPS karıştırma haritası: uçaklardan canlı GNSS paraziti',
      description:
        'Uçakların şu an zayıf GPS bildirdiği yerler, kendi ADS-B yayınlarından hesaplanır: olası GNSS karıştırma (jamming) ve sahte sinyalin (spoofing) canlı haritası.',
      heading: 'GPS karıştırma ve parazit',
      lede: 'Uçaklar kendi konumlarından ne kadar emin olduklarını yayınlar. Aynı yerde birçoğu bunu aynı anda zayıf bildiriyorsa, bir şey GPS sinyalini bozuyordur.',
      shows: [
        'Uçakların en az onda birinin, en az da üçünün düşük navigasyon doğruluğu bildirdiği, gölgelendirilmiş 2°’lik hücreler.',
        'Etkilenen uçakların oranı ve kaç uçağın sayıldığı için bir hücreye tıklayın.',
        'Hesaplamanın dayandığı uçakları görmek için uçuşları açın.',
      ],
      sources: ['Her uçağın ADS-B mesajlarında bildirdiği navigasyon doğruluğu (NACp).'],
      freshness: 'Her uçuş güncellemesinde, birkaç dakikada bir yeniden hesaplanır.',
      limits: [
        'Bu bir çıkarımdır. Karıştırmayı sahte sinyalden ya da tek bir uçaktaki arızadan ayırt edemez.',
        'Bir hücrenin değerlendirilmesi için en az on uçak gerekir; bu yüzden parazit güçlü olsa bile boş gökyüzünde hiçbir şey görünmez.',
      ],
      spots: [
        { label: 'Baltık', note: 'Kaliningrad ve Baltık ülkeleri çevresinde yaygın parazit bildirildi.' },
        { label: 'Doğu Akdeniz', note: '2023’ün sonlarından beri burada yoğun sahte sinyal (spoofing) bildiriliyor.' },
        { label: 'Karadeniz', note: 'Kırım çevresinde ve Ukrayna’daki savaşa yakın kıyılarda.' },
      ],
    },
    'ship-tracker': {
      title: 'Canlı gemi takibi: şu an denizdeki gemiler haritada',
      description:
        'Denizdeki gemiler AIS ile ücretsiz canlı haritada: kargo gemileri, tankerler, feribotlar, balıkçı tekneleri ve savaş gemileri; hız, yön ve varış yeriyle.',
      heading: 'Canlı gemi takibi',
      lede: 'Gemiler konumlarını, hızlarını ve varış yerlerini AIS ile yayınlar. TAKIP duyduklarını, bir seferde 20.000’e kadarını çizer ve hareket ettirir.',
      shows: [
        'Kargo gemileri, tankerler, yolcu gemileri, balıkçı tekneleri ile askeri, hizmet ve gezi tekneleri; her biri kapatabileceğiniz bir filtre.',
        '“Yalnızca seyirdekiler” demirli ya da bağlı gemileri gizler ve gerçekten hareket edenleri gösterir.',
        'Adı, tipi, hızı, yönü, varış yeri ve MMSI numarası için bir gemiye tıklayın; MarineTraffic ve VesselFinder bağlantılarıyla.',
        'Büyük limanlar ve on kritik deniz geçidi işaretlidir; her limanın yakınındaki gemi sayısı canlı gösterilir.',
      ],
      sources: ['Dünyanın dört bir yanındaki alıcılardan aktarılan canlı AIS mesajı akışı.'],
      freshness: 'Harita 10 saniyede bir yeni konum ister. 10 dakikadır sinyali alınmayan gemi haritadan kaldırılır.',
      limits: [
        'AIS çoğunlukla kıyıdan alınır; bu yüzden açık denizdeki gemiler sık sık kaybolur. Kapsama en iyi yoğun kıyılar ve limanlar çevresindedir.',
        'Savaş gemileri ve bazı başka gemiler AIS’i kapatır. Bir geminin tipi ve varış yeri mürettebatı tarafından elle girilir ve her zaman doğru değildir.',
        'Liman hacimleri ve sıralamaları başvuru değerleridir, canlı değildir; her limanın yakınındaki gemi sayıları ise canlıdır.',
      ],
      spots: [
        { label: 'Singapur Boğazı', note: 'Dünyanın en yoğun su yollarından biri.' },
        { label: 'İstanbul Boğazı', note: 'İstanbul’un ortasından süzülen gemiler.' },
        { label: 'Rotterdam', note: 'Avrupa’nın en büyük limanı.' },
        { label: 'Manş Denizi', note: 'Kuzey Denizi ile Atlantik arasındaki trafik şeritleri.' },
      ],
    },
    chokepoints: {
      title: 'Hürmüz Boğazı, Süveyş ve Malakka gemi trafiği takibi',
      description:
        'IMF PortWatch verisiyle dünyanın kritik deniz geçitlerindeki trafik: Hürmüz, Süveyş, Babülmendep, Malakka ve diğerlerinden günlük geçişler, normale göre.',
      heading: 'Kritik deniz geçitleri',
      lede: 'Birkaç dar geçit dünya ticaretinin büyük kısmını taşır. Bu katman, her birinden kaç geminin geçtiğini o geçidin yakın dönemdeki kendi normaliyle karşılaştırarak gösterir.',
      shows: [
        'IMF PortWatch’un izlediği her geçit, son haftasının kendinden önceki yaklaşık üç aya göre durumuna göre işaretlenir.',
        'Son 7 günün normale oranı (tanker tonajına ya da gemi sayısına göre), 30 günlük bir grafik ve PortWatch’un kaydettiği aksaklıklar için birine tıklayın.',
        'Trafiğin kendisini izlemek için yanında gemileri açın.',
      ],
      sources: ['IMF ve Oxford Üniversitesi’nin AIS verisinden ürettiği günlük geçiş tahminleri.'],
      freshness: 'PortWatch haftalık yayımlar; bu yüzden gösterilen son gün çoğu zaman bir hafta ya da daha eskidir. TAKIP veriyi 6 saatte bir okur.',
      limits: [
        'Geçişler PortWatch tarafından AIS verisinden tahmin edilir, geçitte sayılmaz.',
        'Normal, geçidin kendi yakın geçmişidir; uzun bir aksaklıktan sonra düşen seviye yeni normal hâline gelir.',
      ],
      spots: [
        { label: 'Hürmüz Boğazı', note: 'Körfez petrolünün ve gazının dışarı açılan yolu.' },
        { label: 'Babülmendep Boğazı', note: 'Kızıldeniz’in güney kapısı.' },
        { label: 'Süveyş Kanalı', note: 'Avrupa ile Asya arasındaki kestirme yol.' },
        { label: 'Malakka Boğazı', note: 'Hint Okyanusu ile Güney Çin Denizi arasında.' },
      ],
    },
    'satellite-tracker': {
      title: 'Uydu takibi: tüm uydular 3D küre üzerinde, canlı',
      description:
        'Yaklaşık 18.000 uydu ve enkaz parçası, CelesTrak yörünge verileriyle canlı bir 3D kürede: tepenizde ne olduğunu, yörüngesini ve sonraki geçişlerini görün.',
      heading: 'Uydu takibi',
      lede: 'Çalışan uydulardan enkaza, yörüngedeki yaklaşık 18.000 cisim; yayımlanan yörüngelerinin koyduğu yerde, gerçek zamanlı hareket ederken.',
      shows: [
        'CelesTrak’in aktif katalogundaki her şey ve üç parçalanmadan kalan enkaz: Fengyun-1C, Iridium 33 ve Cosmos 2251.',
        'Starlink ve diğer iletişim uyduları, navigasyon, Yer gözlemi, uzay istasyonları ve teleskoplar ile askeri uydular için filtreler.',
        'Adı, görevi, yörüngesi, irtifası, hızı ve periyodu, tam altındaki nokta ve üzerinizden sonraki geçişleri için birine tıklayın.',
        'Bir uyduyu takip ettiğinizde harita onunla birlikte kalır. Bağlantıyı paylaşın; açan kişi de onu takip eder.',
      ],
      sources: [CELESTRAK],
      freshness: ORBIT_FRESHNESS,
      limits: [
        'Konumlar gözlemlenmez, yörünge elemanlarından SGP4 modeliyle tahmin edilir. Elemanlar yayımlandıktan sonra manevra yapmış uydularda kayma olur.',
        'Gruplar uydu adına göre ayıklanır, bu yüzden yaklaşıktır.',
      ],
    },
    'iss-tracker': {
      title: 'ISS şu an nerede? Canlı ISS takibi',
      description:
        'Uluslararası Uzay İstasyonu’nu canlı haritada takip edin: şu an nerede, yörüngesi, ne kadar yüksekte ve hızlı gittiği ve üzerinizden bir sonraki geçişi.',
      heading: 'ISS şu an nerede?',
      lede: 'Uluslararası Uzay İstasyonu yaklaşık 400 km yükseklikte, Dünya’nın çevresini yaklaşık 92 dakikada bir dolanır. Haritayı açın; harita istasyonu ilerledikçe takip eder.',
      shows: [
        'Yörüngesindeki ISS, harita tarafından takip edilir; gece ve gündüze göre aydınlatılmış bir kürenin üzerinde.',
        'İrtifası, hızı, yörünge periyodu ve tam altındaki nokta.',
        'Bulunduğunuz yerin üzerinden sonraki geçişleri; böylece ne zaman yukarı bakacağınızı bilirsiniz.',
        'Uzay panelinde istasyondan canlı görüntü.',
      ],
      sources: ['İstasyonun yayımlanan son yörünge elemanları.'],
      freshness: 'Yörünge elemanları 2 saatte bir yenilenir; konum ise aradaki her an için tarayıcınızda hesaplanır.',
      limits: [
        'Konum son elemanlardan tahmin edilir. İstasyon yörüngesini yükselttikten sonra, yeni elemanlar yayımlanana kadar sapma olabilir.',
        'Bir geçiş yalnızca karanlık ve açık bir gökyüzünde görülebilir; geçiş saatleri bulutu hesaba katmaz.',
      ],
    },
    starlink: {
      title: 'Starlink takibi: Starlink uyduları canlı haritada',
      description:
        'Starlink ve diğer iletişim uyduları, CelesTrak yörünge verileriyle canlı bir 3D kürede: binlercesi, gerçek zamanlı olarak hareket ederken.',
      heading: 'Starlink uyduları, canlı',
      lede: 'Binlerce Starlink uydusu artık Dünya’yı çevreliyor. Bu katmanı açın ve yörünge kabuklarının küreyi süpürüşünü izleyin.',
      shows: [
        'Adı Starlink, OneWeb ya da WorldView olan her uydu, tek katmanda.',
        'Adı, yörüngesi, irtifası, hızı ve üzerinizden sonraki geçişleri için birine tıklayın.',
      ],
      sources: [CELESTRAK],
      freshness: ORBIT_FRESHNESS,
      limits: [
        'Ada göre ayıklandığı için katmanda OneWeb uyduları ve WorldView görüntüleme uyduları da bulunur; başka adlar taşıyan iletişim uyduları ise gözden kaçar.',
        'Yeni fırlatılan bir grup birkaç gün boyunca sıra hâlinde uçar: “Starlink treni”. CelesTrak onun için eleman yayımladığında görünür.',
      ],
    },
    'military-satellites': {
      title: 'Askeri ve casus uydu takibi, canlı',
      description:
        'Yörüngeleri kamuya açık askeri, keşif ve erken uyarı uyduları; CelesTrak verisiyle canlı bir 3D kürede, yörünge, irtifa ve geçişleriyle birlikte.',
      heading: 'Askeri uydular',
      lede: 'Kamuya açık katalogda yer alan keşif, sinyal istihbaratı ve erken uyarı uyduları; ada göre ayıklanır ve kendine ait bir katmanda çizilir.',
      shows: [
        'Kamuya açık katalogda USA, Cosmos ve Yaogan gibi adlarla yer alan ABD, Rus ve Çin askeri uyduları.',
        'Yörüngesi, irtifası, hızı ve üzerinizden sonraki geçişleri için birine tıklayın.',
      ],
      sources: [CELESTRAK],
      freshness: ORBIT_FRESHNESS,
      limits: [
        'Gizli uyduların çoğu kamuya açık katalogda yoktur ya da sıradan adlarla listelenir.',
        'Adı USA ya da Cosmos olan her şey buraya düşer; bunların bir kısmı askeri değildir.',
      ],
    },
    'gps-satellites': {
      title: 'GPS uydu takibi: GPS, Galileo, GLONASS ve BeiDou',
      description:
        'Navigasyon uyduları canlı bir 3D kürede: GPS, Galileo, GLONASS ve BeiDou, CelesTrak yörünge verileriyle; yörünge, irtifa ve sonraki geçişleriyle.',
      heading: 'Navigasyon uyduları',
      lede: 'Her telefonun konum bilgisinin arkasındaki uydu takımyıldızları, GPS, Galileo, GLONASS ve BeiDou; çoğu yaklaşık 20.000 km yükseklikte, şu an bulundukları yerde çizilir.',
      shows: [
        'Adı GPS ya da Navstar, Galileo, GLONASS veya BeiDou olan uydular.',
        'Yörüngesi, irtifası, hızı ve periyodu için birine tıklayın.',
      ],
      sources: [CELESTRAK],
      freshness: ORBIT_FRESHNESS,
      limits: [NAMED_BY_NAME, 'Japonya’nın QZSS’i ve Hindistan’ın NavIC’i gibi bölgesel sistemler bu katmanda yok.'],
    },
    'rocket-launches': {
      title: 'Roket fırlatma takvimi: yaklaşan fırlatmalar haritada',
      description:
        'Dünya genelinde yaklaşan roket fırlatmaları Launch Library 2 verisiyle haritada: her rampadan sıradaki fırlatma; roket, görev, saat ve canlı yayınlarla.',
      heading: 'Yaklaşan roket fırlatmaları',
      lede: 'Dünyadaki her aktif rampadan sıradaki fırlatma, havalanacağı yerde işaretli; roket, görev ve saatiyle.',
      shows: [
        'Her fırlatma rampası için, oradan yapılacak sıradaki fırlatmayı gösteren bir işaret.',
        'Görev, durumu, rampa ve konumu, en erken fırlatma saati, fırlatan kuruluş ve canlıysa yayın için bir rampaya tıklayın.',
      ],
      sources: ['The Space Devs topluluğunun tuttuğu fırlatma veritabanı; en yakın 50 fırlatma gösterilir.'],
      freshness: 'Saatte bir okunur; harita 30 dakikada bir kontrol eder.',
      limits: [
        'Fırlatma saatleri “en erken” saatlerdir. Sık sık kayar, bazen fırlatma gününde bile.',
        'İşaret rampayı gösterir, uçuş yolunu değil.',
      ],
      spots: [
        { label: 'Cape Canaveral', note: 'Florida’nın Uzay Kıyısı; dünyanın en yoğun fırlatma üssü.' },
        { label: 'Starbase', note: 'SpaceX’in güney Teksas’taki Starship üssü.' },
        { label: 'Baykonur', note: 'ISS’e giden mürettebatın Soyuz ile fırlatıldığı yer.' },
        { label: 'Wenchang', note: 'Çin’in Hainan’daki kıyı fırlatma üssü.' },
      ],
    },
    'aurora-forecast': {
      title: 'Kutup ışıkları tahmini: aurora şu an nereden görülür',
      description:
        'NOAA’nın kutup ışıkları (aurora) tahmini canlı haritada: kuzey ve güney ışıklarının önümüzdeki yarım saatte nerede olası olduğu, gece-gündüz çizgisi üzerinde.',
      heading: 'Kutup ışıkları tahmini',
      lede: 'NOAA’nın kutup ışıklarının şu an nerede olası olduğuna dair kısa vadeli tahmini; iki kutbun üzerinde bir kuşak olarak çizilir, altında haritadaki gece ve gündüzle.',
      shows: [
        'Önümüzdeki yaklaşık 30 dakika için 1°’lik bir ızgarada tepede kutup ışığı görme olasılığı. %5’in altındaki alanlar boş bırakılır.',
        'Gece ile gündüz arasındaki çizgi; çünkü kutup ışıkları yalnızca karanlıkta görülebilir.',
      ],
      sources: ['Uzay Hava Durumu Tahmin Merkezi’nin, Dünya’ya doğru gelirken ölçülen güneş rüzgârıyla çalışan kutup ışığı modeli.'],
      freshness: 'NOAA güncelledikçe, 5 dakikada bir güncellenir.',
      limits: [
        'Bulutu ve ay ışığını hesaba katmaz: bulut altındaki yüksek bir olasılık, görülecek bir şey olmadığı anlamına gelir.',
        'Yaklaşık 30 dakika ileriye bakar; bu gece ya da yarın hakkında bir şey söylemez.',
        'Tepede görülen kutup ışıkları, kutuptan birkaç yüz kilometre daha uzaktan çoğu zaman ufkun alçağında görülebilir.',
      ],
      spots: [
        { label: 'Tromsø', note: 'Kuzey Norveç; açık gecelerin çoğunda kutup ışığı halkasının altında.' },
        { label: 'İzlanda' },
        { label: 'Fairbanks', note: 'Alaska’nın iç kesimleri.' },
        { label: 'Tazmanya', note: 'Güney ışıkları için.' },
      ],
    },
    'night-sky': {
      title: 'Gezegenler şu an nerede? Güneş, Ay ve yıldızlar canlı',
      description:
        'Güneş, Ay, gezegenler ve en parlak yıldızlar, canlı bir 3D kürenin çevresinde gerçek yerlerinde; NASA JPL Horizons ve Yale Bright Star Catalogue verisiyle.',
      heading: 'Güneş, Ay ve gezegenler',
      lede: 'Dünya’nın ötesine uzaklaşın; çevresinde gerçek gökyüzü var: Güneş, Ay ve gezegenler şu an bulundukları yerde, en parlak yıldızların önünde.',
      shows: [
        'Güneş, Ay ve gezegenler, Dünya’dan bakıldığındaki gerçek yönlerinde.',
        'Yale Bright Star Catalogue’dan en parlak yıldızlar.',
        'Yakınlaştırdıkça soluklaşır; böylece haritanın önüne hiç geçmez.',
      ],
      sources: ['Güneş’in, Ay’ın ve gezegenlerin konumları.', 'Gökyüzündeki en parlak yıldızlar.'],
      freshness: 'Konumlar 3 saatte bir okunur; işaretler her dakika hareket eder.',
      limits: ['Kürenin çevresinde bir arka plan, planetaryum değil: durduğunuz yerden gökyüzünün görünümü yok.'],
    },
    'day-night-map': {
      title: 'Gece gündüz haritası: dünyada şu an nerede gündüz',
      description:
        'Gece ve gündüzün canlı dünya haritası: aradaki çizgi Güneş’le birlikte hareket eder; Dünya’nın her yerinde gündüz mü, alacakaranlık mı, gece mi, görebilirsiniz.',
      heading: 'Gece ve gündüz, canlı',
      lede: 'Gece ile gündüz arasındaki çizgi, Güneş’in şu an belirlediği yerde çizilir ve Dünya döndükçe batıya kayar.',
      shows: ['Gece tarafı gölgeli, gündüz tarafı açık; sınır saatler geçtikçe hareket eder.'],
      sources: ['Şu anki saatte Güneş’in konumundan; hiçbir şey indirilmez.'],
      freshness: '5 dakikada bir yeniden çizilir.',
      limits: [],
    },
    'solar-system-3d': {
      title: '3D Güneş Sistemi: gezegenler ve uzay araçları, canlı',
      description:
        'Gerçek zamanlı 3D Güneş Sistemi: şu anki yerlerinde gezegenler, yaklaşık 150 uzay aracı, cüce gezegenler, yıldızlararası cisimler ve 8.300 uzak küçük gezegen.',
      heading: 'Güneş Sistemi, canlı ve 3D',
      lede: 'Dünya’nın ötesine uzaklaşın ve devam edin. Gezegenler şu an bulundukları yerde; onları keşfeden uzay araçları da öyle.',
      shows: [
        'Gerçek konumlarındaki gezegenler ve aralarına yerleştirilmiş yaklaşık 150 uzay aracı.',
        'Cüce gezegenler, bilinen üç yıldızlararası cisim ve 8.300 uzak küçük gezegen.',
        'Helyosfer ve Oort bulutu; temsilî çizim olarak çizilir ve öyle etiketlenir.',
        'Yol boyunca duraklar: Dünya, Ay, Mars, Güneş, Güneş Sistemi, yıldızlar, galaksi ve evren.',
      ],
      sources: [HORIZONS, 'Uzak küçük gezegenler.'],
      freshness: ALWAYS_NOW,
      limits: [NO_TIME, ENDED],
    },
    'spacecraft-tracker': {
      title: 'Voyager şu an nerede? 3D canlı uzay aracı takibi',
      description:
        'NASA JPL Horizons ile canlı konumlanan yaklaşık 150 uzay aracı, Voyager 1 ve 2’den James Webb teleskobuna; uzaklıkları, ışık süreleri ve uçuş tekrarlarıyla.',
      heading: 'Güneş Sistemi’ndeki uzay araçları',
      lede: 'Voyager 1 ve 2, James Webb Uzay Teleskobu, Mars yörünge araçları ve daha ötedeki sondalar: her biri şu an bulunduğu yerde, yaklaşık 150 uzay aracı.',
      shows: [
        'Bulundukları yere göre gruplanmış uzay araçları; Dünya’ya uzaklıkları ve sinyallerinin bize ulaşma süresiyle.',
        '“Uçuşu izle” bir aracın yolculuğunu yeniden oynatır; fırlatılışı, yakın geçişleri, varışları ve inişleri bir zaman çizelgesinde işaretlidir.',
        'Her görev hakkında notlar.',
      ],
      sources: [HORIZONS],
      freshness: 'Konumlar saati izler; uçuş yolları JPL’den gelir.',
      limits: ['Uçuş tekrarında fırlatma rampasından yükseliş temsilîdir ve öyle işaretlenir.', ENDED],
    },
    'moon-3d': {
      title: '3D Ay haritası: iniş yerleri, gezginler ve yörünge araçları',
      description:
        'NASA’nın Lunar Reconnaissance Orbiter görüntüleriyle 3D Ay küresi: iniş noktaları, gezgin araçların izlediği yollar ve şu an çevresindeki yörünge araçları.',
      heading: 'Üç boyutlu Ay',
      lede: 'NASA’nın Lunar Reconnaissance Orbiter görüntülerinden bir Ay küresi; insanların ve robotların indiği yerlerle.',
      shows: ['İniş noktaları ve gezgin araçların oradan itibaren izlediği yollar.', 'Ay’ın çevresindeki yörünge araçları, şu an bulundukları yerde.'],
      sources: ['Ay yüzeyinin görüntüleri.', HORIZONS],
      freshness: SURFACE_NOW,
      limits: [NO_TIME],
    },
    'mars-3d': {
      title: '3D Mars haritası: gezgin izleri ve iniş noktaları',
      description:
        'Viking görüntüleriyle 3D Mars küresi: iniş noktaları, gezgin araçların katettiği yollar ve şu an gezegenin çevresinde dolanan yörünge araçları.',
      heading: 'Üç boyutlu Mars',
      lede: 'NASA’nın Viking görüntülerinden bir Mars küresi; iniş noktaları, gezgin araçların yüzeydeki izleri ve tepedeki yörünge araçlarıyla.',
      shows: ['İniş noktaları ve gezgin araçların katettiği yollar.', 'Mars’ın çevresindeki yörünge araçları, şu an bulundukları yerde.'],
      sources: ['Mars’ın küresel görüntüleri.', HORIZONS],
      freshness: SURFACE_NOW,
      limits: [NO_TIME],
    },
    'sun-live': {
      title: 'Bugün Güneş: NASA SDO’dan en son görüntü',
      description:
        'Güneş’in NASA Solar Dynamics Observatory uydusundan gelen en son aşırı morötesi görüntüsü, TAKIP’in canlı Güneş Sistemi görünümünde 3D bir küre üzerinde.',
      heading: 'Güneş, canlı',
      lede: 'NASA Solar Dynamics Observatory uydusunun en son görüntüsünde Güneş; ilmeklerini ve aktif bölgelerini gösteren 171 Å aşırı morötesi ışıkta.',
      shows: ['SDO’nun en son karesiyle kaplanmış bir küre olarak Güneş.'],
      sources: ['Solar Dynamics Observatory’nin en son görüntüleri.'],
      freshness: 'Helioviewer’daki en son kare.',
      limits: ['Yalnızca tek kanal: 171 Å.'],
    },
    'stars-and-galaxies': {
      title: '3D yıldızlar, ötegezegenler ve galaksiler',
      description:
        'Güneş’ten gözlemlenebilir evrenin sınırına uçun: 12.807 yakın yıldız, başka yıldızların çevresindeki gezegenler, Samanyolu ve 43.463 galaksi, hepsi 3D.',
      heading: 'Yıldızlardan evrenin sınırına',
      lede: 'Uzaklaşmaya devam ettikçe görünüm de sürer: yakın yıldızlar ve gezegenleri, Samanyolu, komşu galaksilerimiz ve on binlercesi daha.',
      shows: [
        'Yale Bright Star Catalogue, Hipparcos ve yaklaşık 100 ışık yılı içinde Gaia DR3’ten 12.807 yıldız.',
        'NASA Exoplanet Archive’dan, gezegeni olduğu bilinen yıldızlar.',
        'Samanyolu içeriden; dışarıdan ise bir sanatçı çizimi olarak ve öyle etiketlenmiş hâlde.',
        'Yerel Grup, 2MASS Redshift Survey’den 43.463 galaksi, SDSS galaksileri ve kuasarları ile WMAP’ten kozmik mikrodalga arka plan ışıması.',
      ],
      sources: [
        'Yıldızların konumları ve parlaklıkları.',
        'Gezegeni bilinen yıldızlar.',
        'İçeriden görülen Samanyolu.',
        'Galaksiler, kuasarlar ve kozmik mikrodalga arka plan ışıması.',
      ],
      freshness: 'Kataloglar; onlar güncellendikçe güncellenir.',
      limits: ['Bu görünümde yıldızlar hareket etmez.', 'Samanyolu’nu dışarıdan kimse görmedi; o görünüm bir çizimdir.'],
    },
    'rain-radar': {
      title: 'Canlı yağış radarı haritası: dünya genelinde yağmur ve kar',
      description:
        'RainViewer ile canlı hava radarı: son iki saatte dünya genelindeki yer radarlarının gördüğü yağmur ve kar, nereye ilerlediğini göstermek için döngü hâlinde.',
      heading: 'Yağış radarı',
      lede: 'Yer tabanlı hava radarlarının şu an gördükleri, tek bir haritada birleştirilir: son iki saatteki yağmur, sağanak ve kar; hangi yöne ilerlediğini görebilmeniz için döngü hâlinde.',
      shows: [
        'Son 2 saat için 10 dakikada bir radar karesi, döngü olarak oynatılır.',
        'Tekrar oynatma ile geri gidin; radar izlediğiniz zamanı takip eder.',
      ],
      sources: ['Ulusal hava radarı ağlarının dünya çapındaki mozaiği.'],
      freshness: '10 dakikada bir yeni kareler gelir; harita 5 dakikada bir kontrol eder.',
      limits: [
        'Yalnızca yer radarı olan yerlerde: açık okyanusta ve Afrika, Orta Asya ve Güney Amerika’nın büyük bölümünde radar yok.',
        'Yalnızca geçmiş kareler; RainViewer’ın tahmin kareleri dâhil edilmez.',
        DETAIL_Z7,
      ],
    },
    'wind-map': {
      title: 'Canlı rüzgâr haritası: dünya genelinde rüzgâr hızı ve yönü',
      description:
        'NOAA’nın GFS modelinden küresel rüzgâr haritası: yerden 10 metre yükseklikteki rüzgâr hareketli çizgilerle; dünyanın her yerinde hızı ve yönüyle.',
      heading: 'Rüzgâr haritası',
      lede: 'NOAA’nın küresel tahmin modelinden, yerden 10 metre yükseklikteki rüzgâr; onunla birlikte hareket eden çizgilerle çizilir, böylece cepheler ve fırtınalar bir bakışta göze çarpar.',
      shows: [
        'Rüzgârın yönü ve şiddeti için hareketli çizgiler.',
        'En yakın ızgara noktasının sıcaklığı, rüzgârı, hamleleri, son yağışı ve bulutluluğu için tıklayın.',
      ],
      sources: [GFS, OPEN_METEO],
      freshness: GFS_FRESHNESS,
      limits: ['Ölçülmüş rüzgâr değil, bir tahmin modeli.', 'Vadilerdeki ve binalar arasındaki yerel rüzgârlar bu ölçekte yumuşatılır.'],
    },
    'temperature-map': {
      title: 'Sıcaklık haritası: dünya genelinde canlı hava sıcaklığı',
      description:
        'NOAA’nın 0,25°’lik GFS modelinden, yerden 2 metre yükseklikteki dünya geneli hava sıcaklığı; üzerinde °C ya da °F değerleri yazılı canlı bir haritada.',
      heading: 'Sıcaklık haritası',
      lede: 'NOAA’nın küresel modelinden tüm gezegenin hava sıcaklığı; değerleri yazılı bir renk alanı olarak, °C ya da °F cinsinden.',
      shows: [
        'Yerden 2 metre yükseklikteki sıcaklığın renk alanı.',
        'Harita boyunca yazılı değerler; yer ve değer için birine tıklayın.',
        '°C ile °F arasında geçiş yapın.',
      ],
      sources: [GFS, OPEN_METEO],
      freshness: GFS_FRESHNESS,
      limits: [
        'En yakın tahmin saati için model değerleri; termometre ölçümleri değil.',
        'GFS yüklenene kadar kaba bir Open-Meteo ızgarası enterpole edilir; bu da dağları ve kıyıları yumuşatır.',
      ],
    },
    'lightning-map': {
      title: 'Canlı yıldırım haritası: Amerika ve Pasifik’te yıldırımlar',
      description:
        'NOAA nowCOAST ile canlı haritada yıldırım yoğunluğu: Amerika kıtası ve Pasifik’teki gök gürültülü fırtınalar, Tekrar oynatmayı izleyen 15 dakikalık karelerle.',
      heading: 'Yıldırım',
      lede: 'Yıldırımların nereye düştüğü, NOAA’nın kullandığı ağlardan 15 dakikadaki düşüş sayısı olarak; böylece etkin gök gürültülü fırtınalar bir bakışta göze çarpar.',
      shows: [
        'Her 15 dakika için 8 km’lik hücrelerde yıldırım yoğunluğu.',
        'Tekrar oynatma ile geri gidin; katman da yaklaşık son 6 saat için onu izler.',
      ],
      sources: ['NLDN ve GLD360 yıldırım tespit ağlarından yıldırım yoğunluğu.'],
      freshness: '15 dakikada bir yeni kareler gelir; harita 5 dakikada bir kontrol eder.',
      limits: [
        'Yalnızca Amerika kıtası ve Pasifik: 25° G ile 80° K arası, 110° D ile başlangıç meridyeni arasında. Avrupa, Afrika ve Asya’nın büyük bölümü kapsanmaz.',
        'Ayrıntı 8. yakınlaştırma düzeyinde biter.',
      ],
    },
    'live-satellite-earth': {
      title: 'Hava durumu uydularından canlı Dünya görüntüsü',
      description:
        'GOES, Meteosat ve Himawari hava durumu uydularından tüm Dünya canlı haritada; her 10 dakikada yeni bir kare, gerçek zamanın yaklaşık 40 dakika gerisinden.',
      heading: 'Hava durumu uydularından Dünya, canlı',
      lede: 'Yer durağan hava durumu uyduları Dünya’nın bütün yüzünü 10 dakikada bir fotoğraflar. TAKIP; GOES, Meteosat ve Himawari’yi gezegenin tek bir canlı görünümünde birleştirir.',
      shows: [
        'Amerika kıtası ve Pasifik üzerinde gerçek renkli GOES-East ve GOES-West.',
        'Avrupa, Afrika ve Atlantik üzerinde Meteosat.',
        'Asya ve Avustralya üzerinde kızılötesi Himawari.',
      ],
      sources: [
        'GOES GeoColor görüntüleri ile NASA’nın Blue Marble ve Black Marble’ı üzerinde Himawari kızılötesi görüntüleri.',
        'Görüntüleme hizmetinden Meteosat görüntüleri.',
      ],
      freshness: '10 dakikada bir kare; çekildikten yaklaşık 30 ila 40 dakika sonra gelir. Harita 5 dakikada bir kontrol eder.',
      limits: [
        'Himawari sektörü, yerin sabit bir görüntüsü üzerinde kızılötesi buluttur; gerçek renk değildir.',
        DETAIL_Z7,
        'Tarih açıkken gösterilmez.',
      ],
    },
    'cloud-map': {
      title: 'Canlı bulut haritası: uydulardan küresel bulut örtüsü',
      description:
        'NOAA’nın hava durumu uydusu mozaiğinden küresel bulut örtüsü; saatte bir yenilenir ve haritada 3D çizilir, böylece gökyüzünün nerede açık olduğunu görürsünüz.',
      heading: 'Canlı bulutlar',
      lede: 'NOAA’nın tüm yer durağan hava durumu uydularından oluşan saatlik mozaiği, haritanın üzerine 3D aydınlatılmış bulutlar olarak serilir; böylece havanın nerede açık olduğunu bir bakışta görürsünüz.',
      shows: [
        'Dünya genelinde kızılötesi ve görünür görüntülerden bulutlar.',
        'Güneş tarafından aydınlatılır; yükseklikler bulut tepelerinin ne kadar soğuk olduğundan tahmin edilir.',
      ],
      sources: ['nowCOAST üzerinden Global Mosaic of Geostationary Satellite Imagery.'],
      freshness: 'Saatte bir yeni mozaik; harita 5 dakikada bir kontrol eder.',
      limits: [
        'Piksel başına yaklaşık 3 km; bu yüzden küçük bulutlar birbirine karışır. Ayrıntı 6. yakınlaştırma düzeyinde biter.',
        '3D görünüm bir görselleştirmedir, ölçülmüş bulut yüksekliği değildir.',
      ],
    },
    'daily-satellite-images': {
      title: '2000’den bu yana günlük Dünya uydu görüntüleri (NASA)',
      description:
        'NASA’nın VIIRS ve MODIS ile çektiği günlük gerçek renkli Dünya görüntüleri, Şubat 2000’e kadar; Tarih ve Tekrar oynatma ile istediğiniz güne giden bir haritada.',
      heading: 'Günlük uydu görüntüleri',
      lede: 'NASA’nın kutupsal yörüngeli uyduları her gün tüm gezegeni fotoğraflar. Bu katman o görüntüleri gösterir: varsayılan olarak dünün görüntüsünü ve Şubat 2000’e kadar geriye herhangi bir günü.',
      shows: [
        'Ocak 2018’den itibaren NOAA-20 üzerindeki VIIRS’ten, 24 Şubat 2000’e kadar geriye ise Terra üzerindeki MODIS’ten gerçek renkli görüntüler.',
        'Tarih ya da Tekrar oynatma ile geri gidin; görüntüler tarihi takip eder.',
      ],
      sources: ['Global Imagery Browse Services; NASA’nın günlük düzeltilmiş yansıtım mozaikleri.'],
      freshness: 'Canlı modda dünü (UTC), yani tamamlanmış son günü gösterir.',
      limits: [
        'Günün farklı saatlerinde yapılan geçişlerden birleştirilir; bu yüzden geçişler arasındaki ek yerleri ve boşluklar normaldir.',
        'Ayrıntı yaklaşık 9. yakınlaştırma düzeyinde biter.',
      ],
    },
    earthquakes: {
      title: 'Son depremler: bugün dünyada canlı deprem haritası',
      description:
        'Son 24 saatte dünya genelinde 2,5 ve üzeri büyüklükteki tüm depremler, USGS ve EMSC verisiyle tek bir canlı haritada; büyüklük, derinlik ve yeriyle.',
      heading: 'Depremler, canlı',
      lede: 'Son bir günde dünya genelinde 2,5 ve üzeri büyüklükteki her deprem; iki büyük katalog birleştirilir, böylece her deprem bir kez görünür.',
      shows: [
        'Her deprem, meydana geldiği yerde işaretli.',
        'Büyüklüğü, yeri, derinliği ve koordinatları, iki kurum da bildirdiyse diğer kurumun değeri ve tam rapor bağlantısı için birine tıklayın.',
      ],
      sources: [
        'ABD Jeoloji Araştırmaları Kurumu’nun dünya genelinde 2,5 ve üzeri büyüklükteki depremler akışı.',
        'Avrupa-Akdeniz Sismoloji Merkezi’nin katalogu; en güçlü olduğu bölgeler Avrupa ve Akdeniz.',
      ],
      freshness: 'İki katalog da dakikada bir okunur; harita 15 dakikada bir kontrol eder.',
      limits: [
        'İlk büyüklük değeri, depremden sonraki bir saat içinde sık sık güncellenir.',
        'EMSC listesi en son 500 olayla sınırlıdır; bu yüzden çok yoğun bir günde ABD dışındaki bazı küçük depremler eksik olabilir.',
        'Küçük depremler en iyi, ABD, Japonya ve Avrupa’daki gibi sismik ağların yoğun olduğu yerlerde kaydedilir.',
      ],
      spots: [{ label: 'Japonya' }, { label: 'Kaliforniya' }, { label: 'Türkiye' }, { label: 'Endonezya' }],
    },
    wildfires: {
      title: 'Orman yangını haritası: NASA FIRMS ile aktif yangınlar',
      description:
        'Son 24 saatte NASA FIRMS uydu sıcak noktalarından dünya genelinde aktif yangınlar; ABD yangın sınırları ve Kanada’daki olaylarla birlikte canlı haritada.',
      heading: 'Aktif yangınlar',
      lede: 'NASA uydularının son 24 saatte tespit ettiği ısı; ABD’deki resmî yangın sınırları ve Kanada’daki olaylarla birlikte tek haritada.',
      shows: [
        'Suomi NPP, NOAA-20 ve NOAA-21 üzerindeki VIIRS cihazlarından sıcak noktalar.',
        'Parlaklığı, yangın ışınım gücü, kaç uydunun gördüğü ve ne zaman görüldüğü için bir sıcak noktaya tıklayın.',
        'NIFC’den alanı ve kontrol altına alınma oranıyla ABD yangın sınırları; CWFIS ve BC Wildfire Service’ten Kanada’daki olaylar.',
      ],
      sources: [
        'Son 24 saatteki uydu geçişlerinden yangın sıcak noktaları.',
        'Amerika Birleşik Devletleri genelinde orman yangını sınırları.',
        'Kanada genelinde yangın olayları.',
        'Aktif volkanlar.',
      ],
      freshness: 'FIRMS 30 dakikada bir, sınırlar 10 dakikada bir okunur. Sıcak noktalar haritayı açtığınızda yüklenir; en güncelini görmek için sayfayı yenileyin.',
      limits: [
        'Sıcak nokta, yörüngeden görülen ısıdır: bir orman yangını, tarımsal yakma, gaz meşalesi ya da volkan olabilir. Doğrulanmış bir yangın değildir.',
        '5.000’den fazla sıcak nokta olduğunda en güçlü yarısı tutulur, geri kalanından örnek alınır.',
        'NASA EONET’ten aktif volkanlar da sıcak nokta olarak çizilir; parlaklık ve güç değerleri yer tutucudur, uydu ölçümü değildir.',
      ],
      spots: [
        { label: 'Kaliforniya' },
        { label: 'Batı Kanada' },
        { label: 'Orta Afrika', note: 'Dünyadaki yanmanın çoğu Afrika savanlarında olur.' },
        { label: 'Amazon' },
      ],
    },
    'severe-weather': {
      title: 'Şiddetli hava uyarıları haritası: dünya geneli, canlı',
      description:
        'Şiddetli hava uyarıları canlı haritada: ABD ve Kanada uyarıları, WMO ve GDACS uyarıları, NASA EONET olayları ve kasırga tahminleri, hepsi tek yerde.',
      heading: 'Şiddetli hava uyarıları',
      lede: 'Dünyanın dört bir yanındaki meteoroloji kurumlarının resmî uyarıları tek haritada: fırtınalar, seller, sıcak hava, kar ve daha fazlası; her biri yayımlayan kurumla birlikte.',
      shows: [
        'Her uyarı için şiddetine göre işaretlenmiş bir nokta.',
        'Türü, şiddeti, bölgesi ve yayımlayan kurum için birine tıklayın; asıl uyarının bağlantısıyla.',
        'ABD Ulusal Kasırga Merkezi’nden kasırga ve tropik fırtına tahmin konileri.',
      ],
      sources: [
        'Amerika Birleşik Devletleri genelinde yürürlükteki uyarılar.',
        'Kanada’da hava durumu uyarıları ve sivil uyarılar.',
        'Dünya genelindeki ulusal meteoroloji kurumlarından şiddetli ve aşırı hava uyarıları.',
        'Küresel afet uyarıları ve doğal olaylar.',
        'Tropik siklon tahminleri ve uyarıları.',
      ],
      freshness: 'Kaynaklar 3 dakikada bir okunur; harita 5 dakikada bir kontrol eder.',
      limits: [
        'Kapsama, her ülkenin TAKIP’in okuyabileceği biçimde ne yayımladığına bağlıdır; birçok ülke yalnızca WMO’nun şiddetli ve aşırı hava uyarılarıyla kapsanır.',
        'Her uyarı, uyarı alanının tamamı değil tek bir noktadır. Haritalanmış alanı olmayan ABD uyarıları dâhil edilmez.',
      ],
    },
    hurricanes: {
      title: 'Kasırga takibi: tropik fırtınalar ve tahmin konileri',
      description:
        'Kasırgalar ve tropik fırtınalar canlı haritada: ABD Ulusal Kasırga Merkezi’nin tahmin konileri ve noktaları ile dünya genelindeki tropik siklon uyarıları.',
      heading: 'Kasırgalar ve tropik fırtınalar',
      lede: 'Ulusal Kasırga Merkezi’nin tahmin konisi ve izleğiyle aktif kasırgalar ve tropik fırtınalar; dünyanın geri kalanından siklon uyarılarıyla.',
      shows: [
        'Atlantik ile doğu ve orta Pasifik fırtınaları için NHC tahmin konileri ve tahmin noktaları.',
        'Geçerlilik zamanı, rüzgârı, hamleleri ve basıncı için bir tahmin noktasına tıklayın.',
        'GDACS’ten diğer okyanus havzalarındaki tropik siklon uyarıları.',
      ],
      sources: ['Tahmin konileri, izlekler ve bültenler.', 'Dünya genelinde tropik siklon uyarıları.'],
      freshness: 'Koniler 5 dakikada bir okunur, 10 dakikada bir yeniden çizilir. NHC bültenleri 6 saatte bir, bir fırtına karayı tehdit ettiğinde daha sık yayımlar.',
      limits: [
        'Koni, fırtınanın ne kadar büyük olduğunu değil, merkezinin muhtemelen nereye gideceğini gösterir: etkileri çoğu zaman koninin çok dışına ulaşır.',
        'NHC tahminleri yalnızca Atlantik’i ve doğu ile orta Pasifik’i kapsar.',
      ],
    },
    radiation: {
      title: 'Canlı radyasyon haritası: EPA RadNet ve Safecast ölçümleri',
      description:
        'Arka plan radyasyonu canlı haritada: ABD’de EPA RadNet istasyonları ve dünya genelinde Safecast’in gönüllü sensörleri; her istasyonun kendi normaline göre.',
      heading: 'Radyasyon seviyeleri',
      lede: 'ABD hükümetinin RadNet istasyonlarından ve Safecast’in gönüllü ağından gama radyasyonu ölçümleri; RadNet istasyonları kendi normalleriyle karşılaştırılır.',
      shows: [
        'Her istasyon için bir nokta; son ölçümü saatte nanosievert (nSv/h) cinsinden.',
        'RadNet istasyonları için, istasyonun 7 günlük ortalamasına göre bir değerlendirme.',
        '6 saat boyunca veri göndermeyen istasyonlar çevrimdışı olarak işaretlenir.',
      ],
      sources: [
        'Amerika Birleşik Devletleri genelinde sabit hava izleme istasyonları.',
        'Dünya genelinde kendi başına veri bildiren, gönüllülerin kurduğu sensörler.',
      ],
      freshness: 'RadNet saatte bir, Safecast 15 dakikada bir okunur; harita 5 dakikada bir kontrol eder.',
      limits: [
        'Yağmur, havadaki doğal radyoaktiviteyi yere indirir ve sık sık kısa süreli sıçramalara yol açar. Tek başına bir sıçrama uyarı değildir.',
        'Safecast ölçümleri değerlendirme olmadan gösterilir.',
      ],
      spots: [{ label: 'Fukuşima', note: 'Safecast, buradaki 2011 kazasından sonra kuruldu.' }],
    },
    'disease-outbreaks': {
      title: 'Salgın hastalık haritası: WHO, CDC ve ECDC bildirimleri',
      description:
        'WHO’nun bildirdiği salgınlar, ABD CDC seyahat uyarıları ve ECDC bildirimleri; son 90 günden, ilgili oldukları ülkeye işaretli olarak canlı haritada.',
      heading: 'Salgın hastalıklar',
      lede: 'Dünya Sağlık Örgütü (WHO), ABD CDC ve Avrupa’nın ECDC’sinden resmî salgın raporları; ilgili oldukları ülkeye göre gruplanır.',
      shows: [
        'Son 90 günde bildirimi olan her ülke için bir işaret.',
        'Bildirimler için birine tıklayın; tamamını okumak için bağlantılarıyla.',
      ],
      sources: [
        'Dünya Sağlık Örgütü’nün salgın raporları.',
        'Yürürlükte oldukları sürece haritada tutulur.',
        'Avrupa Hastalık Önleme ve Kontrol Merkezi.',
      ],
      freshness: 'Saatte bir okunur.',
      limits: [
        'Yalnızca ülke düzeyinde: işaret, vakaların olduğu yerde değil ülkenin ortasında durur.',
        'Bildirimler resmî doğrulamadan sonra, çoğu zaman salgının başlamasından günler ya da haftalar sonra gelir.',
      ],
    },
    'live-cameras': {
      title: 'Canlı kamera izle: dünyadan trafik ve şehir kameraları',
      description:
        'Onlarca ülkedeki karayolu idareleri, şehirler ve web kamerası ağlarından yaklaşık 100.000 trafik ve şehir kamerası tek canlı haritada. İzlemek için tıklayın.',
      heading: 'Canlı kameralar',
      lede: 'Karayolu idareleri, şehirler ve web kamerası ağları kameralarını yayımlıyor. TAKIP bunların yaklaşık 100.000’ini tek haritada toplar; böylece bir yere şu anki hâliyle bakabilirsiniz.',
      shows: [
        'Her kamera için bir işaret; yakınlaştırdıkça üzerlerinde canlı önizleme kutucukları.',
        'Bir oynatıcı açmak için birine tıklayın: kaynak yayın yapıyorsa canlı video, yapmıyorsa yenilenen son durağan görüntüsü.',
        'Listelenen ama yayın yapmayan kameralar haritada kalır; soluk ve yayın dışı olarak işaretli.',
      ],
      sources: [
        'ABD eyalet ulaştırma idarelerinden ve 511 hizmetlerinden; Avrupa, Kanada, Japonya, Kore, Tayvan, Avustralya ve Yeni Zelanda’daki karayolu idarelerinden otoyol kameraları.',
        'İstanbul, Seul ve Calgary’ninkiler gibi şehir trafik kameraları.',
        'CamStreamer ve PhenoCam gibi ağlardan herkese açık web kameraları ve OpenStreetMap’te listelenen web kameraları.',
      ],
      freshness: 'Kamera listesi 30 dakikada bir yeniden oluşturulur; her görüntü, kaynağı ne sıklıkta güncelliyorsa o sıklıkta güncellenir.',
      limits: [
        'Birçok kaynak video değil, her dakika ya da birkaç dakikada bir güncellenen durağan görüntüler yayımlar.',
        'Kapsama, kimin yayımladığına bağlıdır: en çok ABD, Japonya ve Kanada’da var; birçok ülkede hiç yok.',
        'Kameralar bakım ya da politika nedenleriyle kararır; bunlar kaldırılmaz, yayın dışı olarak işaretlenir.',
      ],
      spots: [
        { label: 'İstanbul', note: 'Boğaz’ın iki yakasında şehir trafiği.' },
        { label: 'Tokyo' },
        { label: 'Alpler', note: 'Dağ geçitleri ve vadiler.' },
        { label: 'Seattle' },
      ],
    },
    'plate-readers': {
      title: 'ALPR haritası: ABD ve Kanada’da plaka okuma kameraları',
      description:
        'Flock ve diğer otomatik plaka okuma kameraları; ABD ve Kanada genelinde gönüllülerce DeFlock aracılığıyla OpenStreetMap’e işlenmiş, her birinin baktığı yönle.',
      heading: 'Plaka okuma kameraları (ALPR)',
      lede: 'Flock Safety’ninkiler gibi otomatik plaka okuma kameraları; gönüllülerce DeFlock aracılığıyla OpenStreetMap’e işlenmiş, her birinin baktığı yönle.',
      shows: [
        '3. yakınlaştırma düzeyinden itibaren noktalar, 9. düzeyden itibaren ayrıntılar ve 13. düzeyden itibaren görüş konileri.',
        'İşletmecisi, üreticisi, baktığı yön, neyin üzerine monte edildiği ve ne zaman haritaya işlendiği için birine tıklayın.',
      ],
      sources: ['OpenStreetMap’te etiketlenmiş ALPR kameralarının saatlik harita döşemeleri.'],
      freshness: 'DeFlock döşemelerini OpenStreetMap’ten saatte bir yeniden oluşturur.',
      limits: [
        'Gönüllüler bulduklarını haritaya işler; bu yüzden birçok okuyucu henüz haritada yok.',
        'Koninin genişliği ve menzili tipik değerlerdir, her kamera için ölçülmemiştir.',
        'Yalnızca ABD ve Kanada.',
      ],
    },
    'live-news': {
      title: 'Haritada canlı haber yayınları: dünya TV kanalları',
      description:
        'Dünyanın dört bir yanından canlı haber kanalları, haber merkezlerinin bulunduğu yerde haritada: bir yayını açın, olayları aynı haritada takip ederken izleyin.',
      heading: 'Canlı haber yayınları',
      lede: 'Canlı yayın yapan yaklaşık on altı uluslararası haber kanalı, yayın yaptıkları yerde işaretli; böylece haberi, konusu olduğu haritanın yanında izleyebilirsiniz.',
      shows: [
        'Her kanalın haber merkezinde bir işaret.',
        'Yayını bir oynatıcıda açmak için birine tıklayın; gömülemiyorsa kanalın kendi sitesinde açılır.',
      ],
      sources: ['Kanalların kendi canlı yayınları.'],
      freshness: 'Kanal listesi nadiren değişir; bir yayın, kanalı yayındayken canlıdır.',
      limits: [
        'Her kanal her zaman canlı değildir.',
        'İşaretler haberin geçtiği yeri değil, haber merkezini gösterir.',
        'Kanallar sahiplerinin görüşlerini yansıtır; aralarında devlet yayıncıları da var.',
      ],
    },
    traffic: {
      title: 'Canlı trafik haritası: yol hızları ve trafik yoğunluğu',
      description:
        'Ölçülmüş yol hızları canlı haritada: dünya genelinde TomTom’dan, Hollanda ve Fransa’da açık veriden daha ayrıntılı olarak; yavaş akan yollar renklendirilir.',
      heading: 'Yol trafiği',
      lede: 'Trafiğin ne kadar hızlı aktığı, ölçülerek; yavaş ve sıkışık yollar renklendirilir, böylece trafik yoğunluğu haritayı kaplamadan göze çarpar.',
      shows: [
        '10. yakınlaştırma düzeyinden itibaren renklendirilmiş yavaş ve sıkışık yollar.',
        'Hızı, olağan hızına oranı ve ne zaman ölçüldüğü için bir yola tıklayın.',
      ],
      sources: ['Dünya genelinde trafik akışı.', 'Hollanda’nın ulusal yol veri ambarı.', 'İki Fransız şehrinin açık trafik verisi.'],
      freshness: 'Harita 2 dakikada bir yenilenir.',
      limits: [
        'Yalnızca yavaş ve sıkışık yollar renklendirilir; akan yollar renksiz kalır.',
        '10. yakınlaştırma düzeyinden itibaren, aşağı yukarı her seferinde bir şehir kadar alan gösterilir.',
      ],
    },
    'live-transit': {
      title: 'Canlı otobüs ve tren haritası: toplu taşıma gerçek zamanlı',
      description:
        'Yüzlerce şehirde gerçek zamanlı hareket eden otobüs, tramvay, tren ve metrolar; yaklaşık 750 açık toplu taşıma akışından, her aracın hattı ve durumuyla.',
      heading: 'Otobüsler ve trenler, canlı',
      lede: 'Yüzlerce toplu taşıma kuruluşu araçlarının nerede olduğunu yayımlıyor. TAKIP onları hareket hâlinde çizer; böylece bir şehrin otobüslerini, tramvaylarını ve trenlerini sefer yaparken izleyebilirsiniz.',
      shows: [
        '10. yakınlaştırma düzeyinden itibaren araçlar. Uzaklaştırıldığında verisi olan şehirler haritada listelenir.',
        'Hattı, etiketi, durumu, hızı ve işletmecisi için bir araca tıklayın.',
        'Her araç canlı mı, tahmini mi yoksa tarifeye göre mi gösterildiğini belirtir; böylece neye baktığınızı bilirsiniz.',
      ],
      sources: [
        'Yaklaşık 40 ülkede yaklaşık 750 GTFS Realtime akışı.',
        'İstanbul’un İETT otobüsleri, LA Metro Rail, Chicago’nun “L” hattı, Londra Metrosu, Barselona’nın FGC’si, Tokyo’nun Toei’si ve diğerleri.',
      ],
      freshness: 'Yakınlaştırılmış durumdayken araçlar 20 saniyede bir yenilenir.',
      limits: [
        'Bazı sistemler yalnızca varış tahminleri yayımlar. Bu sistemlerin trenleri bu tahminlerden yola çıkılarak duraklar arasına yerleştirilir ve tahmini olarak işaretlenir.',
        'İstanbul ve İzmir metrolarındaki gibi canlı veri olmayan yerlerde trenler tarifeye göre gösterilir ve öyle işaretlenir.',
        'Akışların çoğu ABD, Kanada ve Fransa’da.',
      ],
      spots: [
        { label: 'New York', note: 'Otobüsler canlı; metro varış saatlerinden yerleştirilir.' },
        { label: 'Londra' },
        { label: 'İstanbul', note: 'İETT otobüsleri canlı; metro tarifesine göre.' },
        { label: 'San Francisco' },
      ],
    },
    'hiking-trails': {
      title: 'Yürüyüş parkurları haritası: uzun mesafe ve yerel rotalar',
      description:
        'OpenStreetMap’ten dünya genelinde işaretli yürüyüş rotaları: her ölçekte uluslararası ve ulusal parkurlar, yakınlaştırdıkça bölgesel ve yerel patikalar.',
      heading: 'Yürüyüş rotaları',
      lede: 'Waymarked Trails aracılığıyla OpenStreetMap’ten işaretli yürüyüş rotaları: kıtaları aşan uzun mesafe parkurlarından yerel döngü rotalarına kadar.',
      shows: [
        'Her yakınlaştırma düzeyinde uluslararası ve ulusal rotalar, 7. düzeyden itibaren bölgesel, 10. düzeyden itibaren yerel rotalar.',
        'Ağı, güzergâhı, haritadaki ve resmî uzunluğu, işletmecisi ve bağlantıları için bir rotaya tıklayın.',
      ],
      sources: ['OpenStreetMap’te haritalanmış yürüyüş rotaları.'],
      freshness: 'Waymarked Trails tarafından OpenStreetMap ile güncel tutulur.',
      limits: ['Yalnızca birinin OpenStreetMap’te rota olarak haritaladığı rotalar; kapsama en zengin Avrupa’da.'],
    },
    'world-news-map': {
      title: 'Dünya haber haritası: son dakika haberleri ve olaylar',
      description:
        'Son dakika haberleri canlı haritada: ajanslardan ve herkese açık Telegram kanallarından raporlar andıkları yerde, GDELT’in kodlanmış olaylarının yanında.',
      heading: 'Haritada dünya haberleri',
      lede: 'Haber ajanslarından ve herkese açık kanallardan raporlar, andıkları kasabaya işaretli; yanında GDELT’in makineyle kodlanmış olayları: son iki saatte bildirilen protestolar, şiddet ve gerginlik.',
      shows: [
        'Uyarı işaretleri: son 72 saatteki raporlar, andıkları yere yerleştirilir. Rapor, kaynağı ve o kaynağın eğilimi için birine tıklayın.',
        'GDELT olayları: son iki saatte en az iki yayın organının bildirdiği şiddet, protesto ve gerginlik; her biri, onu bildiren yayın sayısına göre boyutlandırılır.',
      ],
      sources: [
        'Aralarında BBC, the Guardian, Al Jazeera, TASS ve Anadolu Ajansı’nın da bulunduğu on bir herkese açık RSS akışı.',
        'Dokuz herkese açık kanal.',
        'Dünya genelindeki haberlerden 15 dakikada bir kodlanan olaylar.',
      ],
      freshness: 'Ajanslar 5 dakikada bir, kanallar 3 dakikada bir okunur. GDELT haritayı açtığınızda yüklenir.',
      limits: [
        'Yerler raporun metninden bulunur; bu yüzden bir işaret en iyi ihtimalle kasaba düzeyindedir ve bazen yanlıştır.',
        'Kaynaklar taraf tutar. Her biri eğilimiyle etiketlenir; taraflı kaynaklar bilerek dâhil edilmiştir.',
        'GDELT makine tarafından kodlanır ve bazen bir olayı bir bölgenin ortasına yerleştirir.',
      ],
    },
    'air-raid-alerts': {
      title: 'Hava saldırısı alarmları haritası: Ukrayna ve İsrail, canlı',
      description:
        'Hava saldırısı alarmları çaldığı anda canlı haritada: Ukrayna’nın bölgesel alarmları ve İsrail’in roket sirenleri; başlama saatleri ve son bir gündeki sayıları.',
      heading: 'Hava saldırısı alarmları',
      lede: 'Hava saldırısı sirenlerinin şu an çaldığı yerler: Ukrayna’da bölgeye, İsrail’de yerleşime göre; her alarmın ne kadar sürdüğü ve son bir günde kaç alarm olduğuyla.',
      shows: [
        'Etkin alarmlar ve az önce sona erenler.',
        'Yer, başlama zamanı, son 24 saatte oradaki sirenler ve kaynak için birine tıklayın.',
      ],
      sources: [
        'Resmî hava saldırısı alarm sistemi, herkese açık bir yansı üzerinden.',
        'Ev Cephesi Komutanlığı alarmlarını aktaran bir topluluk hizmeti olan Tzeva Adom.',
      ],
      freshness: 'Harita dakikada bir kontrol eder. Ukrayna verisi 10 dakika içinde yenilenmezse erişilemez sayılır.',
      limits: [
        'Güvenliğiniz için asla buna güvenmeyin. Resmî alarm uygulamanızı kullanın.',
        'İki akış da resmî olmayan aktarımlardır; gecikebilir ya da kesilebilir.',
      ],
      spots: [{ label: 'Ukrayna' }, { label: 'İsrail' }],
    },
    'disaster-alerts': {
      title: 'Küresel afet uyarıları haritası: GDACS, canlı',
      description:
        'Birleşmiş Milletler ve AB’nin küresel afet uyarı sistemi GDACS’in bildirdiği depremler, tropik siklonlar, seller, volkanlar ve kuraklıklar canlı haritada.',
      heading: 'Afet uyarıları',
      lede: 'Birleşmiş Milletler ve Avrupa Komisyonu’nun yürüttüğü afet uyarı sistemi GDACS’ten uyarılar; sistem, uluslararası müdahale gerektirebilecek ani afetleri işaretler.',
      shows: [
        'Güncel her GDACS uyarısı için bir işaret: depremler, tropik siklonlar, seller, volkanlar, kuraklıklar ve orman yangınları.',
        'Türü, adı ve GDACS raporu için birine tıklayın.',
      ],
      sources: ['Küresel Afet Uyarı ve Koordinasyon Sistemi’nin uyarı akışı.'],
      freshness: 'Haritayı açtığınızda okunur, en fazla 5 dakikalıktır; en güncelini görmek için sayfayı yenileyin.',
      limits: ['GDACS uyarıları, etkinin otomatik ilk tahminleridir; raporlar geldikçe iyileştirilir.'],
    },
    'internet-outages': {
      title: 'İnternet kesintisi haritası: Cloudflare verisiyle ülke ülke',
      description:
        'Cloudflare Radar verisiyle dünya genelinde internet kesintileri canlı haritada: hangi ülkeler ve ağlar bağlantısını kaybetti, neden ve ne kadar süreyle.',
      heading: 'İnternet kesintileri',
      lede: 'Cloudflare Radar’ın trafiğinde gördüğü kesintiler; hükümetlerin internet kapatmalarından kablo kopmalarına ve elektrik kesintilerine kadar, etkiledikleri ülkede işaretli.',
      shows: ['En fazla 50 yeni kesinti; her ülke ya da ağ için bir işaret.', 'Nedeni, kapsamı, başlangıç ve bitiş zamanı için birine tıklayın.'],
      sources: [CLOUDFLARE],
      freshness: 'Haritayı açtığınızda yüklenir. Cloudflare kesintileri doğruladıkça ekler.',
      limits: [
        'Etkilenen bölgeye değil, ülkenin ortasına işaretlenir.',
        'Cloudflare kesintileri doğruladıktan sonra listeler; bu yüzden yeni bir kesintinin görünmesi saatler sürebilir.',
      ],
    },
    'ddos-attacks': {
      title: 'DDoS saldırı haritası: saldırı trafiği nereden geliyor',
      description:
        'Cloudflare Radar’a göre son bir günde ağ katmanı DDoS saldırı trafiğinin en çok geldiği ülkeler; her ülkenin payıyla birlikte canlı bir haritada.',
      heading: 'Saldırı kaynakları',
      lede: 'Cloudflare’in gördüğü ağ katmanı DDoS trafiğinin nereden geldiği: son bir günde, tüm saldırı trafiğindeki paylarına göre ilk 25 ülke.',
      shows: ['Her biri payıyla birlikte ilk 25 kaynak ülke.'],
      sources: [CLOUDFLARE],
      freshness: 'Kayan son bir gün; haritayı açtığınızda yüklenir.',
      limits: [
        '“Kaynak”, Cloudflare’in trafiğin geldiğini gördüğü yerdir. Saldırganlar trafiği başka ülkeler üzerinden yönlendirir; bu yüzden arkasında kimin olduğunu göstermez.',
        'Her ülkenin ortasına işaretlenir.',
      ],
    },
    'malware-map': {
      title: 'Canlı zararlı yazılım haritası: kötü amaçlı URL ve botnetler',
      description:
        'abuse.ch URLhaus’ta bildirildikleri anda zararlı yazılım indirme siteleri ve Feodo Tracker’dan etkin botnet komuta sunucuları, canlı bir haritada bir arada.',
      heading: 'Zararlı yazılımlar ve botnetler',
      lede: 'abuse.ch’nin URLhaus’u kaydettikçe yeni zararlı yazılım indirme siteleri haritaya akar; yanında botnetlerin bağlandığı komuta sunucuları.',
      shows: [
        'IP adreslerinin konumuna göre yerleştirilen zararlı yazılım siteleri. Tehdit, zararlı yazılım ailesi, sunucu, ağı ve ne kadar süredir görüldüğü için birine tıklayın.',
        'Feodo Tracker’dan botnet komuta sunucuları. Zararlı yazılım, adres, port, ağ ve en son ne zaman çevrimiçi olduğu için birine tıklayın.',
      ],
      sources: [
        'Güvenlik topluluğunun bildirdiği zararlı yazılım dağıtım siteleri.',
        'Botnet komuta ve kontrol sunucuları.',
        'Her adresin nerede bulunduğu.',
      ],
      freshness: 'URLhaus dakikada bir kontrol edilir ve yeni siteler doğrudan haritaya gönderilir. Feodo Tracker 5 dakikada bir okunur.',
      limits: [
        'Konumlar IP coğrafi konumlandırmasından gelir; bu, bir adresin nerede kayıtlı olduğunu ya da barındırıldığını gösterir, arkasında kimin olduğunu değil.',
        'Botnet sunucuları barındırıldıkları ülkenin ortasına işaretlenir.',
        'Listelenen bir sunucu altyapıdır, süren bir saldırı değildir.',
      ],
    },
    'service-outages': {
      title: 'Çöktü mü? Bulut ve uygulama kesintileri canlı haritada',
      description:
        'Büyük bulut ve yazılım hizmetlerinin durum sayfalarında yayımlanan olaylar canlı haritada: şu an neyin çöktüğü ya da aksadığı, kendi ifadeleriyle.',
      heading: 'Hizmet aksaklıkları',
      lede: 'Büyük bir bulut ya da yazılım hizmetinde sorun çıktığında hizmet bunu durum sayfasında yayımlar. TAKIP bunlardan on üçünü okur ve açık olayları haritaya koyar.',
      shows: ['Açık bir olayı olan her hizmet için bir işaret.', 'Olay ve son güncellemesi için birine tıklayın.'],
      sources: ['On üç büyük hizmetin herkese açık durum sayfaları.'],
      freshness: '5 dakikada bir okunur.',
      limits: [
        'Bir şirketin bildirmeyi seçtiği şey, bildirmeyi seçtiği zaman.',
        'İşaret, kesintinin olduğu yeri değil şirketin genel merkezini gösterir.',
      ],
    },
    'undersea-cables': {
      title: 'Denizaltı kablo haritası: interneti taşıyan kablolar',
      description:
        'İnterneti kıtalar arasında taşıyan denizaltı kabloları, karaya çıktıkları yerlerle bir haritada; canlı gemilerin, kesintilerin ve daha fazlasının altında.',
      heading: 'Denizaltı kabloları',
      lede: 'Kıtalar arasındaki trafiğin neredeyse tamamı deniz tabanındaki kablolardan geçer. İşte güzergâhları ve karaya çıkış noktaları; haritadaki her şeyin altında.',
      shows: [
        'İnce ve yarı saydam çizilmiş yaklaşık 700 kablo güzergâhı.',
        'Adı, karaya çıktığı yerler ve TeleGeography’nin kablo haritası bağlantısı için bir kabloya tıklayın.',
      ],
      sources: ['Submarine Cable Map’in güzergâhları ve karaya çıkış noktaları.'],
      freshness: 'Elle güncellenen bir anlık görüntü; son güncelleme Ekim 2026.',
      limits: ['Güzergâhlar çizimdir, deniz tabanında ölçülmüş konumlar değildir.', 'Canlı değil: kopmuş bir kablo yine görünür.'],
    },
    'history-map': {
      title: 'Tarih haritası: MÖ 3400’den bugüne dünya sınırları',
      description:
        'Etkileşimli bir tarih atlası: MÖ 3400’den itibaren yıl yıl dünya sınırları, MÖ 7500’den itibaren savaşlar, muharebeler ve diğer olaylar, 3D bir küre üzerinde.',
      heading: 'Tarih boyunca dünya',
      lede: 'Bir yıl seçin, harita dünyayı o zamanki hâliyle yeniden çizsin: devletleri ve imparatorlukları, o anın savaşları, muharebeleri ve diğer olaylarıyla; seçtiğiniz hızda ileriye doğru oynar.',
      shows: [
        'MÖ 3400’den 2024’e dünya sınırları; 7. yakınlaştırma düzeyinden itibaren OpenHistoricalMap’ten tarihli ayrıntılı sınırlarla.',
        'Her biri ayrı bir anahtar olan sekiz olay türü: savaşlar ve muharebeler (MÖ 7500’den itibaren), saldırılar, toprak talepleri, tehlike altındaki miras, doğal tehlikeler, siyaset, nükleer patlamalar ve afetler.',
        'Yaşam beklentisi, kişi başına GSYH ve nüfus gibi yaklaşık 45 ölçüte göre renklendirilmiş ülkeler.',
        'Vikipedi maddesi için bir olaya ya da devlete tıklayın; zaman içindeki grafiğini görmek için bir ülkeye tıklayın.',
        '“Git” bir yıl, bir tarih, “500 BCE” (MÖ 500 için) ya da bir dönemin adını kabul eder; seçilmiş on üç an bir tık uzaklıktadır.',
      ],
      sources: [BORDERS, '7. yakınlaştırma düzeyinden itibaren tarihli ayrıntılı sınırlar.', EVENTS],
      freshness: HISTORY_FRESHNESS,
      limits: [
        RECONSTRUCTED,
        'Her olay türü kendi zaman aralığını kapsar. MÖ 3400’den önce sınır, MÖ 7500’den önce olay yok.',
        LIVE_PAUSES,
      ],
    },
    'world-map-1914': {
      title: '1914 dünya haritası: I. Dünya Savaşı öncesi imparatorluklar',
      description:
        '1914’te dünya etkileşimli haritada: Birinci Dünya Savaşı’nın arifesindeki imparatorluklar ve sınırlar, ardından savaşın muharebeleri gerçekleştikleri sırayla.',
      heading: '1914’te dünya',
      lede: '1914’te dünyanın büyük bölümü bir avuç Avrupa başkentinden yönetiliyordu. Bu imparatorlukların sınırlarını görmek için haritayı 1914’te açın, ardından muharebeler savaşıldıkları yerde belirirken Birinci Dünya Savaşı boyunca oynatmaya devam edin.',
      shows: [
        '1914’teki hâliyle dünya sınırları.',
        'Başladıkça beliren savaşlar ve muharebeler.',
        'Saniyede bir ay hızla oynatmaya devam edin ya da barış antlaşmalarının çizdiği sınırları görmek için 1920’ye gidin.',
      ],
      sources: [BORDERS, EVENTS],
      freshness: HISTORY_FRESHNESS,
      limits: [RECONSTRUCTED, 'Muharebeler kayıtların gösterdiği yere yerleştirilir; bazıları yalnızca kabaca.', LIVE_PAUSES],
    },
    'world-war-2-map': {
      title: 'II. Dünya Savaşı haritası: ay ay sınırlar ve işgal',
      description:
        'İkinci Dünya Savaşı’nda Avrupa etkileşimli haritada: Şubat 1938’den Mayıs 1945’e ay ay sınırlar, ittifaklar ve işgaller, muharebelerle birlikte.',
      heading: 'Avrupa’da II. Dünya Savaşı',
      lede: 'Avrupa’daki savaş hareketli bir harita olarak: kimin kiminle saf tuttuğu ve neyi kimin elinde tuttuğu, 1938 başından Mayıs 1945’e ay ay; her muharebe savaşıldığı yerde ve zamanda belirir.',
      shows: [
        'Her ayın sonundaki hâliyle sınırlar, her ülke işaretli: Mihver ve yandaşları, Mihver işgali altındakiler, Müttefikler, iki blokta da yer almadan savaşanlar, tarafsızlar ya da savaşta olmayanlar.',
        '“1938–1945’i oynat” muharebeleri açar, kamerayı Avrupa’ya getirir ve savaşı saniyede bir ay hızla oynatır.',
        'Ne olduğunu Vikipedi maddesiyle birlikte görmek için bir muharebeye tıklayın.',
      ],
      sources: ['İlhaklara dayalı sınırlar, ay ay; işgal sınır olarak değil, bir durum olarak gösterilir.', EVENTS],
      freshness: HISTORY_FRESHNESS,
      limits: [
        'Yalnızca Avrupa: Asya ve Pasifik’teki savaşın henüz ay ay katmanı yok.',
        'Aynı anda tek bir sınır katmanı gösterilir; bu yüzden bu katman açıkken dünya sınırları kapalıdır.',
        LIVE_PAUSES,
      ],
    },
    'roman-empire-map': {
      title: 'Roma İmparatorluğu haritası: zirvesinde ve yüzyıllar boyunca',
      description:
        'Etkileşimli tarih haritasında Roma İmparatorluğu: en geniş hâline ulaştığı MS 117’deki sınırları ve yüzyıllar içinde nasıl büyüyüp çöktüğü.',
      heading: 'Roma İmparatorluğu',
      lede: 'Haritayı, imparatorluğun Traianus döneminde en geniş sınırlarına ulaştığı MS 117’de açın, ardından Cumhuriyet’e doğru geriye ya da Batı’nın çöküşüne doğru ileriye oynatın.',
      shows: [
        'Herhangi bir yılda Roma’nın ve komşularının sınırları.',
        'Başladıkça savaşları ve muharebeleri.',
        'Vikipedi maddesi için imparatorluğa tıklayın.',
      ],
      sources: [BORDERS, EVENTS],
      freshness: HISTORY_FRESHNESS,
      limits: ['Bu kadar eski sınırlar, çoğu zaman geniş hata paylı bilimsel yeniden çizimlerdir.', LIVE_PAUSES],
    },
    'ottoman-empire-map': {
      title: 'Osmanlı İmparatorluğu haritası: yüzyıllar boyunca sınırlar',
      description:
        'Etkileşimli tarih haritasında Osmanlı İmparatorluğu: 1300 civarındaki yükselişinden 1922’deki sonuna, 1683 Viyana kuşatmasındaki sınırlarıyla.',
      heading: 'Osmanlı İmparatorluğu',
      lede: 'Haritayı, imparatorluğun Avrupa’nın içlerine uzandığı ikinci Viyana kuşatmasının yılı olan 1683’te açın, ardından 1922’ye uzanan uzun geri çekilişi boyunca oynatın.',
      shows: [
        'Herhangi bir yılda imparatorluğun ve komşularının sınırları.',
        'Başladıkça yaptığı savaşlar.',
        'Vikipedi maddesi için imparatorluğa tıklayın.',
      ],
      sources: [BORDERS, EVENTS],
      freshness: HISTORY_FRESHNESS,
      limits: [RECONSTRUCTED, LIVE_PAUSES],
    },
    'country-data-over-time': {
      title: 'Yaşam beklentisi, GSYH ve nüfus haritaları zaman içinde',
      description:
        'Ülkeler yaşam beklentisi, kişi başına GSYH, nüfus ve yaklaşık 45 başka ölçüte göre yıl yıl renklendirilir; olan yerlerde 2100’e kadar projeksiyonlarla.',
      heading: 'Zaman içinde ülkeler',
      lede: 'Her ülkeyi yaklaşık 45 ölçütten birine göre renklendirin ve yıldan yıla değişimini izleyin; ardından ilgilendiğiniz ülkeleri yan yana grafiğe dökün.',
      shows: [
        'Yaşam beklentisi, kişi başına GSYH ve nüfustan sıcaklık ve kentleşmeye kadar yaklaşık 45 ölçüt.',
        'Bir kaynağın yayımladığı yerlerde haritada taralı gösterilen, 2028 ile 2100 arasındaki bir yıla kadar uzanan projeksiyonlar.',
        'Zaman içindeki grafiğini görmek için bir ülkeye tıklayın; en fazla altı ülke yan yana.',
      ],
      sources: [
        'World Development Indicators, Global Economic Prospects ve Climate Change Knowledge Portal.',
        'Aralarında kişi başına GSYH ve nüfusun da bulunduğu uzun dönemli seriler.',
        'World Population Prospects ve World Urbanization Prospects.',
        'Ekonomik görünüm raporları ve iklim yeniden analizi.',
      ],
      freshness: 'Her ölçüt, kaynağının en son yayımını izler.',
      limits: [
        'Değerler bugünün sınırları üzerine çizilir; yayımlanmış iki değer arasındaki yıllar tahmin edilir.',
        'Projeksiyonlar yalnızca projeksiyondur; ne olacağına dair öngörü değildir.',
        LIVE_PAUSES,
      ],
    },
    'continental-drift': {
      title: 'Kıtaların kayması haritası: 1,8 milyar yılda Dünya',
      description:
        '3D bir kürede kıtaların hareketini izleyin: 1,8 milyar yıl önceki süperkıta Nuna’dan Pangea’ya ve bugüne, yol boyunca 13 bölümlük bir anlatımla.',
      heading: 'Kıtaların kayması',
      lede: 'Kıtaları taşıyan levhalar, 1,8 milyar yıl öncesinden bugüne bir kürede hareket eder. Başlangıç noktası 250 milyon yıl önceki Pangea’dır; oynatma düğmesine basın ve onun parçalanarak bugünkü haritaya dönüşmesini izleyin.',
      shows: [
        '1.800 milyon yıl öncesine kadar tektonik levhalar ve kıtalar.',
        '“Nuna bir araya geliyor”dan “Bugün”e 13 bölümlük bir anlatım; kamera her bölümü takip eder.',
        'Son 485 milyon yılda Dünya’nın sıcaklığı ve CO₂ düzeyi.',
        'Zaman çizelgesi boyunca jeolojik dönemler. “Git”, “250 Ma” ya da “Jurassic” gibi bir dönem adı kabul eder.',
      ],
      sources: [PLATES, CLIMATE],
      freshness: DEEP_FRESHNESS,
      limits: [
        'Bir model: ne kadar geriye gidilirse konumlar o kadar belirsizleşir.',
        'Sıcaklık ve CO₂ yalnızca son 485 milyon yılı kapsar.',
      ],
    },
    'dinosaur-earth': {
      title: 'Dinozorlar çağında Dünya: Jura ve Kretase haritaları',
      description:
        'Dinozorların bildiği hâliyle kıtalar 3D bir kürede: Jura’da bölünmeye başlayan Pangea, açılan Atlantik Okyanusu ve 66 milyon yıl önceki dünya.',
      heading: 'Dinozorlar çağında Dünya',
      lede: 'Dinozorlar, kıtaların hareket ettiği 160 milyon yılı aşkın bir süre boyunca yaşadı. Haritayı, Pangea’nın ayrıldığı 150 milyon yıl önceki Jura’da açın ve 66 milyon yıl önce, Kretase’nin sonuna kadar oynatın.',
      shows: [
        'Herhangi bir andaki levhalar ve kıtalar; zaman çizelgesinde jeolojik dönemle birlikte.',
        'Amerika kıtaları ile Avrupa ve Afrika arasında genişleyen genç Atlantik.',
        'Mezozoyik boyunca Dünya’nın sıcaklığı ve CO₂ düzeyi.',
      ],
      sources: [PLATES, CLIMATE],
      freshness: DEEP_FRESHNESS,
      limits: ['Levhaların nerede olduğunun bir modeli; dinozorların kendilerinin haritası değil.'],
    },
    'flight-history-replay': {
      title: 'Uçuş geçmişi tekrarı: geçmiş uçuşlar ve gemiler haritada',
      description:
        'TAKIP’in kaydettiği uçuş ve gemileri zaman çizelgeli haritada yeniden oynatın: istediğiniz ana gidin, saniyede bir yıla kadar hızlandırın, yeniden izleyin.',
      heading: 'Kaydedilen uçuşları ve gemileri yeniden oynatın',
      lede: 'TAKIP gördüğü uçakları ve gemileri kaydeder. Tekrar oynatma bunları haritada yeniden oynatır; böylece bir ana geri dönüp olanları yeniden izleyebilirsiniz.',
      shows: [
        'Kaydedildikleri hâliyle, izleri boyunca hareket eden uçaklar ve gemiler.',
        'Oynatma düğmesi, kaydırıcı ve gerçek zamandan saniyede bir yıla kadar hızlarla bir zaman çizelgesi. “Git” bir tarih ve saat kabul eder.',
        'O anda yörüngelerinin koyduğu yerde uydular.',
      ],
      sources: ['Uçak konumları, geldikçe kaydedilir.', 'Gemi konumları, geldikçe kaydedilir.'],
      freshness: 'Kayıt günün her saati sürer; bu yüzden bir an, gerçekleştikten kısa süre sonra yeniden oynatılabilir.',
      limits: [
        'Ne kadar geriye gidebileceğiniz planınıza bağlıdır: hesap olmadan bir gün, ücretsiz bir hesapla yedi gün.',
        'Yalnızca TAKIP’in kaydettikleri; canlı haritadaki kapsama boşluklarıyla aynı boşluklarla.',
        'Uydu konumları bugünkü yörüngelerden geriye doğru hesaplanır ve günler geçtikçe doğrulukları azalır.',
        'Çok uzaklaştırıldığında harita, izleri görmek için yakınlaştırmanızı ister.',
      ],
    },
    'draw-an-area': {
      title: 'Haritada alan çizin ve içinde ne olduğunu görün',
      description:
        'Canlı haritada bir şekil çizin; içindeki uçak, gemi, kamera ve olayları listeleyin, CSV ya da GeoJSON olarak dışa aktarın ve girip çıkanları kaydedin.',
      heading: 'Alanlar',
      lede: 'Haritada bir çokgen, dikdörtgen, daire ya da çizgi çizin veya bir bölge seçin; TAKIP şu an içinde ne olduğunu listeler.',
      shows: [
        'Bir çokgen, dikdörtgen, daire ya da çizgi çizin veya bir bölge seçin.',
        'İçinde ne olduğunu görün ve bunu CSV ya da GeoJSON olarak dışa aktarın.',
        'Harita açıkken bir alana girip çıkanların kaydını tutmak için alanı izlemeye alın.',
        'Alanın son 60 güne ait yeni uydu görüntülerini arayın.',
      ],
      sources: ['Hangi katmanlar açıksa onlar.', 'Alanın uydu sahneleri.'],
      freshness: 'Her veri yenilemesinde yeniden sayılır.',
      limits: ['İzleme yalnızca TAKIP tarayıcınızda açıkken çalışır ve bildirim göndermez.', 'Şekiller bu tarayıcıda saklanır.', DESKTOP],
    },
    'route-planner': {
      title: 'Rota planlayıcı: araba, bisiklet ve yürüyüş yol tarifi',
      description:
        'Canlı haritada araba, bisiklet ya da yürüyerek rota planlayın: yol üzerinde duraklar, kaçınılacak yerler, yükseklik profili ve adım adım yol tarifiyle.',
      heading: 'Rota planlayıcı',
      lede: 'Yol tarifi, diğer her şeyle aynı haritada: araba, bisiklet ya da yürüyerek; yol boyunca trafik kameraları ve hava durumu bir anahtar uzaklıkta.',
      shows: [
        'Yol üzerinde duraklar ve kaçınılacak yerlerle araba, bisiklet ya da yürüyüş rotaları.',
        'Yükseklik profili ve adım adım yönlendirme.',
      ],
      sources: ['OpenStreetMap üzerinde rota hesaplama.', 'Araç rotaları için yedek.'],
      freshness: 'Rotalar, OpenStreetMap’i rota sunucularının en son yüklediği hâliyle kullanır.',
      limits: ['Toplu taşıma rotası yok.', 'Rotalar canlı trafiği hesaba katmaz.'],
    },
    'ai-map-assistant': {
      title: 'TI: canlı haritayı sizinle okuyan yapay zekâ asistanı',
      description:
        'Haritadakileri TI’a sorun: yakındaki uçaklar, gemiler, hava, depremler ve haberler. Kendi yapay zekâ anahtarınızla bulur, takip eder, açıklar, tahmin çizer.',
      heading: 'Harita asistanı TI',
      lede: 'TI sizin gördüğünüz canlı veriyi okur ve onunla ilgili soruları yanıtlar: o uçağın ne olduğunu, buranın yakınında neler olduğunu ve bu yerde daha önce neler yaşandığını.',
      shows: [
        '“Asistan”: yer bulan, uçak sorgulayan, hava durumuna bakan, rota planlayan, yakındakileri listeleyen, bir izi takip eden ve kamera açan araçlarla donatılmış bir sohbet.',
        '“Tahmin”: TI bir sorunun çevresindeki haberleri ve verileri okur ve tahminini haritaya çizer.',
        'Tekrar oynatma ve Tarih modlarını çalıştırabilir, geçmiş olayların kayıtlarında arama yapabilir.',
      ],
      sources: ['Kendi anahtarınızla OpenAI, Anthropic, Google Gemini, OpenRouter, Groq, DeepSeek, xAI, Mistral, Qwen ya da yerel bir model.'],
      freshness: 'Yanıtlar, sorduğunuz andaki harita verisini kullanır.',
      limits: [
        'Kullanmak için oturum açın. Verdiğiniz anahtarla çalışır; kullandığı kadarını sağlayıcınız size faturalar.',
        'Her yapay zekâ gibi o da yanılabilir. Önemli olanı kontrol edin.',
      ],
    },
    'osint-lookups': {
      title: 'OSINT sorguları: IP, alan adı, kullanıcı adı ve sertifika',
      description:
        'Canlı haritanın yanında IP, alan adı ya da kullanıcı adı sorgulayın: WHOIS, sertifika, açık port, Shodan, ihlal kayıtları ve tehdit listeleri; yaklaşık 20 araç.',
      heading: 'Keşif',
      lede: 'Bir IP adresi, alan adı, kullanıcı adı ya da kripto adresi için yaklaşık yirmi sorgu; konumu olan sonuçlar haritada işaretlenir.',
      shows: [
        'IP adresleri, alan adları, kullanıcı adları, tehdit listeleri ve kripto adresleri için sorgular.',
        'Aralarında WHOIS, sertifika kayıtları, port taraması, Shodan ve veri ihlali kayıtları var.',
        'Konumu olan sonuçlar haritada işaretlenir.',
      ],
      sources: ['WHOIS, sertifika şeffaflığı kayıtları ve Shodan gibi; her sorgu kendi kaynağını belirtir.'],
      freshness: 'Her sorgu, çalıştırdığınızda kaynağına sorar.',
      limits: ['Yalnızca araştırmaya hakkınız olan şeyleri araştırın.'],
    },
    'arcgis-layers': {
      title: 'Canlı haritaya ArcGIS katmanları ekleyin',
      description:
        'ArcGIS Online’da arama yapın ya da bir FeatureServer adresi yapıştırın; o katmanı TAKIP’in canlı haritasında uçuşların, gemilerin, hava durumunun yanına çizin.',
      heading: 'ArcGIS katmanları',
      lede: 'Binlerce kuruluş ArcGIS’te harita katmanları yayımlıyor. Birini bulun ya da adresini yapıştırın; canlı haritaya eklensin.',
      shows: ['Herkese açık katmanlar için arcgis.com’da arama yapın.', 'Doğrudan eklemek için bir FeatureServer adresi yapıştırın.'],
      sources: ['Sahiplerinin yayımladığı herkese açık katmanlar.'],
      freshness: 'Her katman, sahibinin onu güncel tuttuğu kadar günceldir.',
      limits: ['Yalnızca herkese açık katmanlar.', DESKTOP],
    },
    'news-alerts': {
      title: 'Son dakika haber uyarıları, her biri haritada yerinde',
      description:
        'Ajans ve herkese açık kanal haberleri, depremler ve resmî uyarılar tek canlı akışta; her biri haritadaki yerine bir tık uzaklıkta, Pro’da yapay zekâ özetiyle.',
      heading: 'Uyarılar',
      lede: 'Şu an olanlar için tek bir akış: ajanslardan ve herkese açık kanallardan haberler, depremler ve resmî uyarılar; her biri haritadaki yerine bir tık uzaklıkta.',
      shows: [
        'Herkese açık Telegram kanallarından ve BBC, the Guardian, Al Jazeera, TASS ve Anadolu Ajansı gibi RSS ajanslarından haberler.',
        'USGS ve EMSC’den 2,5 ve üzeri büyüklükteki depremler.',
        'NASA EONET, ABD Ulusal Meteoroloji Servisi ve GDACS’ten uyarılar.',
        'Pro’da akışın yapay zekâ özeti.',
      ],
      sources: ['Herkese açık RSS akışları ve herkese açık kanallar.', 'Depremler.', 'Doğal olaylar ve uyarılar.'],
      freshness: 'Ajanslar 5 dakikada bir, kanallar 3 dakikada bir okunur.',
      limits: ['Kaynaklar taraf tutar; her biri eğilimiyle etiketlenir.', 'Bir raporun yeri metninden bulunur; bu yüzden yaklaşıktır.'],
    },
  },
};

export default copy;
