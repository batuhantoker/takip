import type { SiteCopy } from '../copy';

const FLIGHT_SOURCES = [
  'Posições da sua rede mundial de receptores ADS-B.',
  'Redes comunitárias de ADS-B: aeronaves militares, tipos de aeronave e a visão de perto ao seu redor.',
  'Rotas e dados da aeronave, consultados quando você abre um avião.',
];

const FLIGHT_FRESHNESS =
  'Com o zoom numa região, as aeronaves num raio de cerca de 250 milhas náuticas são atualizadas a cada 15 segundos. A visão do mundo inteiro é atualizada a cada poucos minutos, então ali um avião pode estar alguns minutos atrás de onde realmente está.';

const NOT_FOR_PLANNING = 'Serve para ter uma ideia das condições, não para planejar voos.';

const CELESTRAK = 'Elementos orbitais publicados de satélites ativos, objetos brilhantes e três nuvens de detritos.';
const ORBIT_FRESHNESS =
  'Os elementos orbitais são atualizados a partir do CelesTrak a cada 2 horas. As posições são calculadas no seu navegador a partir deles, então os satélites se movem suavemente em tempo real.';
const NAMED_BY_NAME = 'Esta camada é separada pelo nome dos satélites, então é aproximada: alguns satélites caem no grupo errado ou em nenhum.';

const HORIZONS = 'Posições dos planetas, luas e sondas.';
const ALWAYS_NOW = 'Sempre agora: tudo é posicionado para o momento presente.';
const NO_TIME = 'A visão ao vivo ainda não tem controles de tempo; ela mostra o presente.';
const ENDED_MISSIONS = 'Missões já encerradas ainda não estão na lista.';
const MOSAIC_FRESHNESS = 'A superfície é um mosaico; os orbitadores são posicionados para o momento presente.';

const GFS = 'O Global Forecast System em sua grade de 0,25°, lido do servidor THREDDS da Unidata.';
const OPEN_METEO = 'Uma grade grosseira mostrada enquanto o campo do GFS carrega, e os detalhes quando você clica.';
const GFS_FRESHNESS =
  'O GFS roda a cada 6 horas, com um passo de previsão a cada 3. O mapa mostra o passo mais próximo de agora e procura um mais novo a cada 15 minutos.';

const CLOUDFLARE = 'O que a Cloudflare vê na parte da internet que ela transporta.';

const BORDERS = 'Fronteiras do mundo ano a ano, de 3400 a.C. a 2024.';
const EVENTS =
  'Correlates of War, UCDP, Global Terrorism Database, riscos naturais da NOAA, testes nucleares do SIPRI, UNESCO e Wikidata, entre outros.';
const HISTORY_FRESHNESS =
  'Os registros históricos são importados uma vez e mudam pouco; são atualizados quando as fontes publicam novas edições.';
const RECONSTRUCTED = 'As fronteiras são reconstruções: onde eram vagas ou disputadas, o mapa mostra uma leitura delas.';
const LIVE_PAUSES = 'As camadas ao vivo ficam pausadas enquanto a História está aberta.';
const PLATES = 'Um modelo tectônico de placas completas que volta 1,8 bilhão de anos, publicado sob CC BY 4.0.';
const CLIMATE = 'A temperatura média da Terra e o CO₂ nos últimos 485 milhões de anos.';
const MODEL_FRESHNESS = 'Reconstruções publicadas; mudam quando os modelos são revisados.';
const CLICK_EMPIRE = 'Clique no império para ver o artigo da Wikipédia.';

const DESKTOP = 'Por enquanto, só no computador.';

const copy: SiteCopy = {
  sections: {
    air: { label: 'No ar', blurb: 'Aeronaves captadas por receptores ADS-B, aeroportos e o espaço aéreo ao redor deles.' },
    sea: { label: 'No mar', blurb: 'Navios pelo AIS, e os estreitos e canais apertados por onde eles passam.' },
    space: { label: 'No espaço', blurb: 'Satélites, a ISS, lançamentos de foguetes e a aurora.' },
    weather: { label: 'Meteorologia', blurb: 'Radar, vento, temperatura, raios e a Terra vista por satélites meteorológicos.' },
    hazards: { label: 'Riscos', blurb: 'Terremotos, incêndios florestais, tempestades, radiação e surtos de doenças.' },
    cameras: { label: 'Câmeras e transmissões', blurb: 'Câmeras públicas e canais de notícias ao vivo, marcados onde estão.' },
    ground: { label: 'Em terra', blurb: 'Trânsito, ônibus e trens, e trilhas.' },
    world: { label: 'Acontecimentos no mundo', blurb: 'Notícias à medida que são publicadas, alertas de ataque aéreo e os lugares que importam numa crise.' },
    network: { label: 'A internet', blurb: 'Quedas, ataques, malware e os cabos que carregam tudo isso.' },
    past: { label: 'De volta no tempo', blurb: 'Reveja o tráfego gravado, viaje pela história e veja os continentes à deriva.' },
    tools: { label: 'Ferramentas', blurb: 'Desenhe áreas, planeje rotas, faça consultas e pergunte ao TI sobre o que está no mapa.' },
  },

  about: {
    title: 'Sobre o TAKIP: o mundo acontecendo, em um só mapa',
    description: 'Por que o TAKIP existe: os dados públicos sobre o mundo estão espalhados. O TAKIP junta voos, navios, satélites, câmeras, terremotos e tempo num mapa ao vivo.',
    kicker: 'Sobre o TAKIP',
    heading: 'O mundo acontecendo, em um só mapa',
    lede: 'Os aviões transmitem onde estão. Os navios informam sua posição por rádio. Os satélites seguem órbitas publicadas, os sismógrafos registram cada tremor, os radares meteorológicos varrem o céu e as cidades apontam câmeras para suas ruas. Quase tudo isso é público. O TAKIP reúne esses dados num só mapa ao vivo, para você olhar o mundo e vê-lo se mover.',
    whyTitle: 'Por que ele existe',
    why: [
      'Cada um desses fluxos vive num site próprio, com seu próprio mapa e seu próprio jeito de mostrar as coisas. Juntos, eles dizem muito mais: os aviões sobre a sua cidade e a tempestade que estão contornando, os navios em fila na entrada de um estreito, a costa que um terremoto acabou de sacudir e as câmeras voltadas para ela, o satélite que passa sobre você hoje à noite.',
      'O TAKIP foi feito para olhar, acompanhar e entender. Abra numa noite tranquila e siga a ISS, ou abra num dia cheio de notícias e veja onde as coisas estão acontecendo. Em turco, takip quer dizer “acompanhar”.',
    ],
    onMapTitle: 'O que há no mapa',
    moreTitle: 'Mais do que um mapa ao vivo',
    more: [
      'O Replay reproduz o que o TAKIP gravou, para você percorrer os voos e navios de um dia anterior.',
      'A História é um atlas do passado: as fronteiras do mundo ao longo dos séculos e os continentes à deriva por centenas de milhões de anos.',
      'O Espaço deixa a Terra para uma visão 3D em tempo real dos satélites ao redor dela e dos planetas mais além.',
      'As Áreas permitem desenhar uma forma no mapa, ver o que há dentro dela e manter um registro do que entra e sai.',
      'O TI é um assistente que lê o mapa com você e responde a perguntas sobre o que está nele, usando a chave de IA que você fornecer.',
      'Compartilhe o que você está vendo (um avião, um navio, um satélite ou um lugar) e o link abre a mesma visão, do jeito que ela estiver no momento em que for aberto.',
    ],
    honestTitle: 'Honesto sobre seus dados',
    honest: 'Cada camada diz de onde vêm seus dados e quão recentes eles são. Quando algo é estimado, inferido ou segue uma tabela de horários em vez de ser visto ao vivo, o mapa avisa. A cobertura é desigual: aviões e navios aparecem onde há receptores que os captam, e uma cidade só tem câmeras se as publica. A página de cada camada lista o que ela não consegue dizer.',
    freeTitle: 'Gratuito',
    free: 'O TAKIP é gratuito. Sem conta, você tem uma cota diária de tempo no mapa, e uma conta gratuita dá mais. Os planos gratuitos mostram alguns anúncios, nunca no mapa. O que o TAKIP guarda sobre a sua visita está explicado com clareza na página de privacidade.',
  },
  sourceNames: {
    '2MRS, SDSS and WMAP': '2MRS, SDSS e WMAP',
    'adsb.lol and adsb.fi': 'adsb.lol e adsb.fi',
    'adsbdb, hexdb.io and airplanes.live': 'adsbdb, hexdb.io e airplanes.live',
    'Agency APIs': 'APIs das operadoras',
    'Cities': 'Cidades',
    'CDC travel health notices': 'Avisos de saúde para viajantes do CDC',
    'CWFIS and BC Wildfire Service': 'CWFIS e BC Wildfire Service',
    'Environment Canada and the provinces': 'Environment Canada e as províncias',
    'Event records': 'Registros de eventos',
    'GDACS and NASA EONET': 'GDACS e NASA EONET',
    'IMF, OECD and ERA5': 'FMI, OCDE e ERA5',
    'Israel': 'Israel',
    'Mobility Database and Transitland': 'Mobility Database e Transitland',
    'NASA EONET, NWS and GDACS': 'NASA EONET, NWS e GDACS',
    'NASA SDO, through Helioviewer': 'NASA SDO, via Helioviewer',
    'News wires and Telegram': 'Agências de notícias e Telegram',
    'News wires': 'Agências de notícias',
    'NHC and the Hong Kong Observatory': 'NHC e Observatório de Hong Kong',
    'OpenSky, adsb.lol and adsb.fi': 'OpenSky, adsb.lol e adsb.fi',
    'Public registries and services': 'Registros e serviços públicos',
    'Rennes and Nantes Métropole': 'Rennes e Nantes Métropole',
    'Road authorities': 'Órgãos rodoviários',
    'The map’s own layers': 'As camadas do próprio mapa',
    'Ukraine': 'Ucrânia',
    'United Nations': 'Nações Unidas',
    'US National Hurricane Center': 'Centro Nacional de Furacões dos EUA',
    'US National Weather Service': 'Serviço Nacional de Meteorologia dos EUA',
    'USGS and EMSC': 'USGS e EMSC',
    'Vendor status pages': 'Páginas de status dos fornecedores',
    'Webcam networks': 'Redes de webcams',
    'WHO Disease Outbreak News': 'Notícias sobre surtos de doenças da OMS',
    'WMO Severe Weather Information Centre': 'Centro de Informação sobre Tempo Severo da OMM',
    'Worked out in your browser': 'Calculado no seu navegador',
    'World Bank': 'Banco Mundial',
    'World War II layer': 'Camada da Segunda Guerra Mundial',
    'Yale Bright Star, Hipparcos and Gaia DR3': 'Yale Bright Star, Hipparcos e Gaia DR3',
    'Your AI provider': 'Seu provedor de IA',
    'YouTube and Rumble': 'YouTube e Rumble',
  },

  pages: {
    // In the air
    'flight-tracker': {
      title: 'Radar de voos ao vivo: aviões no mapa agora',
      description: 'Veja os aviões que estão no céu agora num mapa ao vivo e gratuito, via ADS-B: voos comerciais, jatos particulares e militares, com altitude, velocidade e rota.',
      heading: 'Radar de voos ao vivo',
      lede: 'Todas as aeronaves que transmitem sua posição por ADS-B e são captadas por um receptor, desenhadas onde estão e se movendo pelo mapa.',
      shows: [
        'Aviões comerciais, aeronaves particulares, jatos executivos e voos militares, cada um numa camada que você pode ligar ou desligar.',
        'Cada aeronave aponta para onde está voando. Clique numa para ver o indicativo de chamada, o tipo e o operador, a altitude, a velocidade, o rumo e o código squawk.',
        'Quando a rota e a aeronave são conhecidas, o cartão mostra de onde o voo veio e para onde vai, com links para o FlightAware e o ADS-B Exchange.',
        'Siga uma aeronave e o mapa a mantém à vista. Compartilhe o link e quem abrir segue a mesma aeronave.',
      ],
      sources: FLIGHT_SOURCES,
      freshness: FLIGHT_FRESHNESS,
      limits: [
        'Só aparecem aeronaves que transmitem ADS-B, e só onde um receptor as capta. Sobre os oceanos e regiões remotas, a cobertura diminui.',
        'Se um voo conta como comercial, particular ou jato executivo é deduzido pelo tipo, indicativo, altitude e velocidade, então alguns caem na camada errada.',
      ],
      spots: [
        { label: 'Londres', note: 'Heathrow, Gatwick e os circuitos de espera ao redor deles.' },
        { label: 'Nova York', note: 'JFK, LaGuardia e Newark numa só visão.' },
        { label: 'Istambul', note: 'O Aeroporto de Istambul e o Sabiha Gökçen, em dois continentes.' },
        { label: 'Atlântico Norte', note: 'As rotas entre a Europa e a América do Norte. A cobertura some no meio do oceano.' },
      ],
    },
    'military-aircraft': {
      title: 'Radar de aviões militares: voos militares ao vivo',
      description: 'Aviões militares que transmitem ADS-B, ao vivo no mapa: reabastecimento, transporte, patrulha e vigilância, com tipo, altitude e velocidade quando conhecidos.',
      heading: 'Aviões militares ao vivo',
      lede: 'Aeronaves militares e de governo que transmitem sua posição, separadas do fluxo de ADS-B e desenhadas numa camada própria.',
      shows: [
        'Aviões-tanque, de transporte, de patrulha marítima, de vigilância e de treinamento, onde quer que transmitam.',
        'Clique num deles para ver o indicativo, o tipo, a altitude, a velocidade e o rumo, com links para pesquisar mais.',
        'Ligue junto a interferência de GPS para ver onde as aeronaves estão relatando navegação degradada.',
      ],
      sources: [
        'Seu feed militar e os instantâneos de tipos de aeronave, a principal fonte desta camada.',
        'Um segundo feed militar, usado quando o adsb.lol está indisponível.',
        'Todo o resto que está no ar, de onde tipos militares conhecidos e prefixos de indicativo separam outros.',
      ],
      freshness: 'O feed militar é atualizado a cada poucos minutos, e as aeronaves ao redor da sua visão a cada 15 segundos depois que você dá zoom.',
      limits: [
        'A maioria dos aviões de combate e muitos voos de Estado não transmitem, ou transmitem sem identidade. O que você vê é a parte que escolhe ser vista.',
        'Uma aeronave conta como militar pela marcação da rede, pelo tipo ou pelo indicativo, então algumas escapam e alguns aviões civis entram.',
        'Os receptores voluntários são mais densos na Europa e na América do Norte, e escassos sobre os oceanos e as zonas de conflito.',
      ],
      spots: [
        { label: 'Leste Europeu', note: 'Voos de vigilância e de reabastecimento costumam orbitar ao longo do flanco leste da OTAN.' },
        { label: 'Mediterrâneo Oriental', note: 'Aviões de transporte e de patrulha entre Chipre, o Levante e Creta.' },
        { label: 'Golfo Pérsico', note: 'Bases aéreas dos dois lados do Golfo.' },
      ],
    },
    'private-jets': {
      title: 'Jatos particulares ao vivo: radar de jatos executivos',
      description: 'Jatos executivos e aeronaves particulares num mapa ao vivo e gratuito, via ADS-B: onde estão, a que altura e velocidade, com tipo e matrícula quando conhecidos.',
      heading: 'Jatos particulares ao vivo',
      lede: 'Jatos executivos e aeronaves particulares, cada um numa camada própria, dos mesmos feeds ADS-B dos aviões comerciais.',
      shows: [
        'Jatos executivos, dos leves aos de longo alcance, e turbo-hélices rápidos como o PC-12 e o TBM, que fazem as mesmas viagens.',
        'Aeronaves particulares: aviões pequenos e aviação geral, de voos de instrução a viagens de turismo.',
        'Clique num deles para ver o tipo, a matrícula, a altitude, a velocidade e o rumo, com links para o FlightAware e o ADS-B Exchange.',
      ],
      sources: FLIGHT_SOURCES,
      freshness: FLIGHT_FRESHNESS,
      limits: [
        'Os donos podem esconder sua identidade por meio de programas de privacidade, então alguns jatos aparecem sem nome ou matrícula.',
        'Se é jato ou não é decidido pelo tipo de aeronave, quando conhecido, e pela velocidade e altitude, quando não, então a divisão é aproximada.',
      ],
      spots: [
        { label: 'Teterboro', note: 'O aeroporto de jatos executivos de Nova York, um dos mais movimentados dos EUA.' },
        { label: 'Van Nuys', note: 'O polo de aviação geral de Los Angeles.' },
        { label: 'Paris–Le Bourget', note: 'O aeroporto de aviação executiva mais movimentado da Europa.' },
      ],
    },
    'airport-delays': {
      title: 'Atrasos em aeroportos dos EUA ao vivo: ground stops da FAA',
      description: 'O status dos aeroportos da FAA ao vivo no mapa: ground stops, atrasos em solo e atrasos de chegada e partida nos EUA, verificados a cada poucos minutos.',
      heading: 'Atrasos em aeroportos dos EUA',
      lede: 'O status dos aeroportos que a FAA publica ao vivo, marcado no mapa: quais aeroportos dos EUA têm agora um ground stop ou um programa de atrasos em vigor.',
      shows: [
        'Um marcador em cada aeroporto dos EUA com um programa de atrasos em vigor.',
        'Clique num deles para ver o aeroporto e os programas em vigor: ground stops (partidas suspensas), atrasos em solo e atrasos de chegada ou partida, com um link para a FAA.',
      ],
      sources: ['O status do espaço aéreo nacional da Federal Aviation Administration, publicado em nasstatus.faa.gov.'],
      freshness: 'O status da FAA é lido a cada 2 minutos, e o mapa verifica mudanças a cada 5.',
      limits: [
        'Só os Estados Unidos: a FAA publica isso para aeroportos americanos.',
        'Aeroportos sem nada em vigor não aparecem, então um mapa vazio é boa notícia.',
      ],
    },
    'airport-weather': {
      title: 'Tempo nos aeroportos: METAR ao vivo e categorias de voo',
      description: 'O tempo nos aeroportos ao vivo, de boletins METAR do mundo todo, por categoria de voo (VFR, MVFR, IFR, LIFR), com vento, visibilidade, teto e temperatura.',
      heading: 'Tempo nos aeroportos (METAR)',
      lede: 'O boletim meteorológico mais recente de cada aeroporto que reporta, colorido pelo que significa para o voo: condições visuais, marginais, por instrumentos ou por instrumentos com teto baixo.',
      shows: [
        'Um ponto em cada estação que reporta, colorido pela categoria de voo: VFR, MVFR, IFR ou LIFR. Os nomes das estações aparecem a partir do zoom 7.',
        'Clique numa estação para ver vento, visibilidade, teto, fenômenos, temperatura e ponto de orvalho, e há quantos minutos o boletim saiu.',
      ],
      sources: ['O cache de METAR da NOAA em aviationweather.gov, com estações do mundo todo.'],
      freshness: 'Os boletins são lidos a cada 5 minutos. A maioria dos aeroportos emite um METAR por hora, e com mais frequência quando o tempo muda.',
      limits: [
        'Aeródromos pequenos sem estação meteorológica não aparecem.',
        NOT_FOR_PLANNING,
      ],
    },
    'turbulence-sigmets': {
      title: 'Mapa de SIGMET: turbulência, gelo e cinzas vulcânicas',
      description: 'SIGMETs internacionais ao vivo no mapa: espaço aéreo com turbulência forte, gelo, trovoadas ou cinzas vulcânicas, com níveis de voo, deslocamento e validade.',
      heading: 'Espaço aéreo perigoso (SIGMETs)',
      lede: 'Os avisos que os pilotos recebem sobre tempo perigoso: áreas de turbulência forte, formação de gelo, trovoadas e cinzas vulcânicas, desenhadas com as formas que os meteorologistas emitem.',
      shows: [
        'Cada SIGMET internacional ativo como uma área contornada.',
        'Clique num deles para ver o fenômeno, a região de informação de voo, os níveis que abrange, para onde se desloca, se está se intensificando ou enfraquecendo, e por quanto tempo vale.',
      ],
      sources: ['SIGMETs internacionais, publicados em aviationweather.gov.'],
      freshness: 'Verificado a cada 5 minutos; avisos vencidos saem do mapa.',
      limits: [
        'Só SIGMETs internacionais. SIGMETs domésticos dos EUA e AIRMETs ainda não aparecem.',
        NOT_FOR_PLANNING,
      ],
    },
    'gps-jamming': {
      title: 'Mapa de bloqueio e interferência de GPS ao vivo',
      description: 'Onde os aviões relatam GPS degradado agora, deduzido das suas próprias transmissões ADS-B: um mapa ao vivo de prováveis bloqueios e falsificações de GNSS.',
      heading: 'Bloqueio e interferência de GPS',
      lede: 'As aeronaves transmitem o quanto confiam na própria posição. Quando muitas delas no mesmo lugar a informam mal ao mesmo tempo, algo está interferindo no GPS.',
      shows: [
        'Células de 2° sombreadas onde pelo menos um décimo das aeronaves, e pelo menos três delas, relatam precisão de navegação degradada.',
        'Clique numa célula para ver a parcela de aeronaves afetadas e quantas foram contadas.',
        'Ligue os voos para ver as aeronaves de onde isso é deduzido.',
      ],
      sources: ['A precisão de navegação (NACp) que cada aeronave informa nas suas mensagens ADS-B.'],
      freshness: 'Recalculado a cada atualização dos voos, a cada poucos minutos.',
      limits: [
        'Isto é uma inferência. Não distingue bloqueio de falsificação de sinal (spoofing), nem de uma falha num único avião.',
        'Uma célula precisa de pelo menos dez aeronaves para ser avaliada, então céu vazio não mostra nada, mesmo onde a interferência é forte.',
      ],
      spots: [
        { label: 'Báltico', note: 'Há relatos de interferência generalizada ao redor de Kaliningrado e dos países bálticos.' },
        { label: 'Mediterrâneo Oriental', note: 'Há relatos de spoofing intenso aqui desde o fim de 2023.' },
        { label: 'Mar Negro', note: 'Ao redor da Crimeia e das costas próximas à guerra na Ucrânia.' },
      ],
    },

    // At sea
    'ship-tracker': {
      title: 'Navios ao vivo: mapa de navios em tempo real',
      description: 'Navios no mar agora num mapa ao vivo e gratuito, via AIS: cargueiros, petroleiros, balsas, barcos de pesca e navios de guerra, com velocidade, rumo e destino.',
      heading: 'Navios ao vivo',
      lede: 'Os navios transmitem posição, velocidade e destino pelo AIS. O TAKIP desenha os que capta, até 20.000 de uma vez, e os mantém em movimento.',
      shows: [
        'Cargueiros, petroleiros, navios de passageiros, barcos de pesca e embarcações militares, de serviço e de lazer, cada um num filtro que você pode desligar.',
        '“Só em movimento” esconde navios ancorados ou atracados, para mostrar o que está de fato navegando.',
        'Clique num navio para ver nome, tipo, velocidade, rumo, destino e MMSI, com links para o MarineTraffic e o VesselFinder.',
        'Os principais portos e dez gargalos marítimos estão marcados, com uma contagem ao vivo dos navios perto de cada porto.',
      ],
      sources: ['Um fluxo ao vivo de mensagens AIS retransmitidas por receptores do mundo todo.'],
      freshness: 'O mapa pede novas posições a cada 10 segundos. Um navio que não é captado por 10 minutos sai do mapa.',
      limits: [
        'O AIS é captado sobretudo a partir da costa, então navios em alto-mar muitas vezes somem. A cobertura é melhor perto de costas e portos movimentados.',
        'Navios de guerra e alguns outros desligam o AIS. O tipo e o destino de um navio são digitados pela tripulação e nem sempre estão certos.',
        'Os volumes e rankings dos portos são números de referência, não dados ao vivo; as contagens de navios perto de cada porto são ao vivo.',
      ],
      spots: [
        { label: 'Estreito de Cingapura', note: 'Um dos trechos de mar mais movimentados do mundo.' },
        { label: 'Bósforo', note: 'Navios passando pelo meio de Istambul.' },
        { label: 'Roterdã', note: 'O maior porto da Europa.' },
        { label: 'Canal da Mancha', note: 'Corredores de tráfego entre o Mar do Norte e o Atlântico.' },
      ],
    },
    chokepoints: {
      title: 'Tráfego em Ormuz, Suez e Malaca: gargalos marítimos',
      description: 'O tráfego nos gargalos marítimos do mundo, do IMF PortWatch: travessias diárias por Ormuz, Suez, Bab el-Mandeb, Malaca e outros, comparadas com o normal.',
      heading: 'Gargalos marítimos',
      lede: 'Algumas passagens estreitas carregam boa parte do comércio mundial. Esta camada mostra quantos navios têm passado por cada uma, comparado com o normal recente daquele mesmo estreito.',
      shows: [
        'Cada gargalo que o IMF PortWatch acompanha, marcado pela comparação da última semana com os cerca de três meses anteriores.',
        'Clique num deles para ver os últimos 7 dias como parcela do normal (por tonelagem de petroleiros ou número de navios), um gráfico de 30 dias e qualquer interrupção registrada pelo PortWatch.',
        'Ligue os navios junto para ver o próprio tráfego.',
      ],
      sources: ['Estimativas diárias de travessias feitas a partir do AIS pelo FMI e pela Universidade de Oxford.'],
      freshness: 'O PortWatch publica semanalmente, então o dia mais recente mostrado muitas vezes tem uma semana ou mais. O TAKIP o lê a cada 6 horas.',
      limits: [
        'As travessias são estimadas a partir do AIS pelo PortWatch, não contadas no estreito.',
        'O normal é o passado recente do próprio estreito, então, depois de uma interrupção longa, o nível mais baixo vira o novo normal.',
      ],
      spots: [
        { label: 'Estreito de Ormuz', note: 'A saída do Golfo Pérsico para o seu petróleo e gás.' },
        { label: 'Bab el-Mandeb', note: 'A porta sul do Mar Vermelho.' },
        { label: 'Canal de Suez', note: 'O atalho entre a Europa e a Ásia.' },
        { label: 'Estreito de Malaca', note: 'Entre o Oceano Índico e o Mar da China Meridional.' },
      ],
    },

    // In space
    'satellite-tracker': {
      title: 'Satélites ao vivo: todos os satélites num globo 3D',
      description: 'Cerca de 18.000 satélites e detritos num globo 3D ao vivo, com dados orbitais do CelesTrak: veja o que passa sobre você, sua órbita e as próximas passagens.',
      heading: 'Rastreador de satélites',
      lede: 'Cerca de 18.000 objetos em órbita, de satélites em operação a detritos, posicionados onde suas órbitas publicadas os colocam e se movendo em tempo real.',
      shows: [
        'Tudo o que está no catálogo de satélites ativos do CelesTrak, mais os detritos de três desintegrações: Fengyun-1C, Iridium 33 e Cosmos 2251.',
        'Filtros para Starlink e outros satélites de comunicação, navegação, observação da Terra, estações espaciais e telescópios, e satélites militares.',
        'Clique num deles para ver nome, missão, órbita, altitude, velocidade e período, o ponto logo abaixo dele e as próximas passagens sobre você.',
        'Siga um satélite e o mapa fica com ele. Compartilhe o link e quem abrir também o segue.',
      ],
      sources: [CELESTRAK],
      freshness: ORBIT_FRESHNESS,
      limits: [
        'As posições são previstas a partir dos elementos orbitais com o modelo SGP4, não observadas. Elas se desviam no caso de satélites que manobraram depois que os elementos foram publicados.',
        'Os grupos são separados pelo nome dos satélites, então são aproximados.',
      ],
    },
    'iss-tracker': {
      title: 'Onde está a ISS agora? Estação Espacial ao vivo',
      description: 'Acompanhe a Estação Espacial Internacional ao vivo no mapa: onde ela está agora, sua órbita, a que altura e velocidade está e quando passa sobre você de novo.',
      heading: 'Onde está a ISS agora?',
      lede: 'A Estação Espacial Internacional dá uma volta na Terra a cada 92 minutos, mais ou menos, a uns 400 km de altitude. Abra o mapa e ele acompanha a estação.',
      shows: [
        'A ISS na sua órbita, seguida pelo mapa, sobre um globo iluminado conforme o dia e a noite.',
        'Sua altitude, velocidade, período orbital e o ponto logo abaixo dela.',
        'Suas próximas passagens sobre onde você está, para saber quando olhar para cima.',
        'Vídeo ao vivo da estação, no painel Espaço.',
      ],
      sources: ['Os elementos orbitais mais recentes publicados para a estação.'],
      freshness: 'Os elementos orbitais são atualizados a cada 2 horas, e a posição é calculada no seu navegador para cada momento entre uma atualização e outra.',
      limits: [
        'A posição é prevista a partir dos elementos mais recentes. Depois que a estação eleva a órbita, ela pode ficar fora do lugar até novos elementos serem publicados.',
        'Uma passagem só é visível com o céu escuro e limpo; os horários das passagens não levam as nuvens em conta.',
      ],
    },
    starlink: {
      title: 'Satélites Starlink ao vivo: veja onde estão no mapa',
      description: 'Starlink e outros satélites de comunicação num globo 3D ao vivo, posicionados com dados orbitais do CelesTrak: milhares deles, se movendo em tempo real.',
      heading: 'Satélites Starlink ao vivo',
      lede: 'Milhares de satélites Starlink já circundam a Terra. Ligue esta camada e veja as faixas de satélites girando ao redor do globo.',
      shows: [
        'Todos os satélites com nome Starlink, OneWeb ou WorldView, numa só camada.',
        'Clique num deles para ver nome, órbita, altitude, velocidade e próximas passagens sobre você.',
      ],
      sources: [CELESTRAK],
      freshness: ORBIT_FRESHNESS,
      limits: [
        'Separada pelo nome, então a camada também inclui os satélites da OneWeb e os satélites de imageamento WorldView, e deixa de fora satélites de comunicação com outros nomes.',
        'Um lote recém-lançado voa em fila por alguns dias, o “trem Starlink”. Ele aparece quando o CelesTrak publica os elementos dele.',
      ],
    },
    'military-satellites': {
      title: 'Satélites militares e espiões ao vivo no mapa',
      description: 'Satélites militares, de reconhecimento e de alerta antecipado com órbitas públicas, num globo 3D ao vivo com dados do CelesTrak: órbita, altitude e passagens.',
      heading: 'Satélites militares',
      lede: 'Satélites de reconhecimento, inteligência de sinais e alerta antecipado que aparecem no catálogo público, separados pelo nome e desenhados numa camada própria.',
      shows: [
        'Satélites militares dos EUA, da Rússia e da China que aparecem com nome no catálogo público, como USA, Cosmos e Yaogan.',
        'Clique num deles para ver órbita, altitude, velocidade e próximas passagens sobre você.',
      ],
      sources: [CELESTRAK],
      freshness: ORBIT_FRESHNESS,
      limits: [
        'Muitos satélites secretos não estão no catálogo público, ou aparecem com nomes genéricos.',
        'Tudo o que se chama USA ou Cosmos vem parar aqui, o que inclui alguns que não são militares.',
      ],
    },
    'gps-satellites': {
      title: 'Satélites GPS ao vivo: GPS, Galileo, GLONASS e BeiDou',
      description: 'Satélites de navegação num globo 3D ao vivo: GPS, Galileo, GLONASS e BeiDou, posicionados com dados orbitais do CelesTrak, com órbita, altitude e passagens.',
      heading: 'Satélites de navegação',
      lede: 'As constelações por trás da localização de qualquer celular (GPS, Galileo, GLONASS e BeiDou), a maioria a uns 20.000 km de altitude, desenhadas onde estão agora.',
      shows: [
        'Satélites com nome GPS ou Navstar, Galileo, GLONASS ou BeiDou.',
        'Clique num deles para ver órbita, altitude, velocidade e período.',
      ],
      sources: [CELESTRAK],
      freshness: ORBIT_FRESHNESS,
      limits: [NAMED_BY_NAME, 'Sistemas regionais, como o QZSS do Japão e o NavIC da Índia, não estão nesta camada.'],
    },
    'rocket-launches': {
      title: 'Próximos lançamentos de foguetes: agenda no mapa',
      description: 'Os próximos lançamentos de foguetes no mundo, num mapa, do Launch Library 2: o próximo de cada plataforma, com foguete, missão, horário e transmissões ao vivo.',
      heading: 'Próximos lançamentos de foguetes',
      lede: 'O próximo lançamento de cada plataforma ativa da Terra, marcado no local de onde decola, com o foguete, a missão e o horário.',
      shows: [
        'Um marcador por plataforma de lançamento, para o próximo lançamento dela.',
        'Clique numa plataforma para ver a missão, seu status, a plataforma e sua localização, o horário mais cedo de lançamento, a empresa responsável e a transmissão, quando houver uma ao vivo.',
      ],
      sources: ['O banco de dados de lançamentos mantido pela comunidade The Space Devs; os 50 mais próximos são mostrados.'],
      freshness: 'Lido a cada hora, e o mapa verifica a cada 30 minutos.',
      limits: [
        'Os horários de lançamento são “não antes de”. Eles mudam com frequência, às vezes no próprio dia.',
        'O marcador indica a plataforma, não a trajetória.',
      ],
      spots: [
        { label: 'Cabo Canaveral', note: 'A Space Coast da Flórida, o local de lançamentos mais movimentado do mundo.' },
        { label: 'Starbase', note: 'A base da Starship da SpaceX, no sul do Texas.' },
        { label: 'Baikonur', note: 'De onde as tripulações para a ISS decolam na Soyuz.' },
        { label: 'Wenchang', note: 'O centro de lançamento costeiro da China, em Hainan.' },
      ],
    },
    'aurora-forecast': {
      title: 'Previsão da aurora boreal: onde ver a aurora agora',
      description: 'A previsão de auroras da NOAA ao vivo no mapa: onde a aurora boreal e a austral são prováveis na próxima meia hora, sobre a linha entre o dia e a noite.',
      heading: 'Previsão de auroras',
      lede: 'A previsão de curto prazo da NOAA de onde a aurora é provável agora, desenhada como uma faixa sobre os dois polos, com a noite e o dia no mapa por baixo.',
      shows: [
        'A chance de aurora no céu, numa grade de 1°, para os próximos 30 minutos, mais ou menos. Áreas abaixo de 5% ficam sem cor.',
        'A linha entre o dia e a noite, já que a aurora só pode ser vista no escuro.',
      ],
      sources: ['O modelo de auroras do Space Weather Prediction Center, alimentado pelo vento solar medido a caminho da Terra.'],
      freshness: 'Atualizado a cada 5 minutos, conforme a NOAA atualiza.',
      limits: [
        'Ignora nuvens e o luar: uma chance alta sob nuvens não significa nada para ver.',
        'Olha uns 30 minutos à frente, então não diz nada sobre esta noite ou amanhã.',
        'Uma aurora no alto do céu muitas vezes pode ser vista baixa no horizonte a algumas centenas de quilômetros mais longe do polo.',
      ],
      spots: [
        { label: 'Tromsø', note: 'Norte da Noruega, sob o oval auroral na maioria das noites limpas.' },
        { label: 'Islândia' },
        { label: 'Fairbanks', note: 'Interior do Alasca.' },
        { label: 'Tasmânia', note: 'Para a aurora austral.' },
      ],
    },
    'night-sky': {
      title: 'Onde estão os planetas agora? Sol, Lua e estrelas',
      description: 'O Sol, a Lua, os planetas e as estrelas mais brilhantes em suas posições reais ao redor de um globo 3D ao vivo, do JPL Horizons e do Yale Bright Star Catalogue.',
      heading: 'O Sol, a Lua e os planetas',
      lede: 'Afaste o zoom para além da Terra e o céu real está ao redor dela: o Sol, a Lua e os planetas onde estão agora, contra as estrelas mais brilhantes.',
      shows: [
        'O Sol, a Lua e os planetas nas suas direções reais a partir da Terra.',
        'As estrelas mais brilhantes, do Yale Bright Star Catalogue.',
        'O céu some quando você aproxima o zoom, para nunca atrapalhar o mapa.',
      ],
      sources: ['Posições do Sol, da Lua e dos planetas.', 'As estrelas mais brilhantes do céu.'],
      freshness: 'As posições são lidas a cada 3 horas, e as marcas se movem a cada minuto.',
      limits: ['Um pano de fundo ao redor do globo, não um planetário: não há visão do céu a partir de onde você está.'],
    },
    'day-night-map': {
      title: 'Mapa dia e noite: onde é dia agora no mundo',
      description: 'Um mapa-múndi ao vivo do dia e da noite: a linha entre os dois se movendo com o Sol, para você ver onde é dia, crepúsculo ou noite em qualquer lugar da Terra.',
      heading: 'Dia e noite ao vivo',
      lede: 'A linha entre o dia e a noite, desenhada onde o Sol a coloca agora e deslizando para oeste conforme a Terra gira.',
      shows: ['O lado da noite sombreado e o lado do dia claro, com a fronteira se movendo com o passar das horas.'],
      sources: ['A partir da posição do Sol no momento atual; nada é baixado.'],
      freshness: 'Redesenhado a cada 5 minutos.',
      limits: [],
    },

    // The Space view
    'solar-system-3d': {
      title: 'Sistema Solar em 3D: planetas e sondas ao vivo',
      description: 'O Sistema Solar em 3D e em tempo real: os planetas onde estão agora, cerca de 150 sondas, planetas anões, objetos interestelares e 8.300 planetas menores.',
      heading: 'O Sistema Solar ao vivo em 3D',
      lede: 'Afaste o zoom para além da Terra e continue. Os planetas estão onde estão agora, e as sondas que os exploram também.',
      shows: [
        'Os planetas nas suas posições reais, com cerca de 150 sondas espaciais posicionadas entre eles.',
        'Planetas anões, os três objetos interestelares conhecidos e 8.300 planetas menores distantes.',
        'A heliosfera e a nuvem de Oort, desenhadas e identificadas como ilustrações.',
        'Paradas pelo caminho: Terra, Lua, Marte, Sol, o Sistema Solar, as estrelas, a galáxia e o universo.',
      ],
      sources: [HORIZONS, 'Os planetas menores distantes.'],
      freshness: ALWAYS_NOW,
      limits: [NO_TIME, ENDED_MISSIONS],
    },
    'spacecraft-tracker': {
      title: 'Onde está a Voyager agora? Sondas ao vivo em 3D',
      description: 'Cerca de 150 sondas posicionadas ao vivo pelo NASA JPL Horizons, das Voyager 1 e 2 ao telescópio James Webb, com distância, tempo-luz e replays dos voos.',
      heading: 'Sondas pelo Sistema Solar',
      lede: 'As Voyager 1 e 2, o Telescópio Espacial James Webb, os orbitadores de Marte e as sondas mais além: cerca de 150 naves, cada uma onde está agora.',
      shows: [
        'Sondas agrupadas por onde estão, com a distância da Terra e quanto tempo o sinal delas leva para chegar até nós.',
        '“Assistir ao voo” reproduz a viagem de uma nave, com o lançamento, os sobrevoos, as chegadas e os pousos marcados numa linha do tempo.',
        'Notas sobre cada missão.',
      ],
      sources: [HORIZONS],
      freshness: 'As posições seguem o relógio; as trajetórias vêm do JPL.',
      limits: [
        'No replay de um voo, a subida desde a plataforma de lançamento é ilustrada, e indicada como tal.',
        ENDED_MISSIONS,
      ],
    },
    'moon-3d': {
      title: 'Mapa da Lua em 3D: locais de pouso, rovers e orbitadores',
      description: 'A Lua como um globo 3D do Lunar Reconnaissance Orbiter da NASA, com os locais de pouso, os caminhos dos rovers e os orbitadores ao redor dela agora.',
      heading: 'A Lua em 3D',
      lede: 'Um globo da Lua feito com imagens do Lunar Reconnaissance Orbiter da NASA, com os lugares onde pessoas e robôs pousaram.',
      shows: [
        'Locais de pouso e os caminhos que os rovers percorreram a partir deles.',
        'Os orbitadores ao redor da Lua, onde estão agora.',
      ],
      sources: ['As imagens da superfície da Lua.', HORIZONS],
      freshness: MOSAIC_FRESHNESS,
      limits: [NO_TIME],
    },
    'mars-3d': {
      title: 'Mapa de Marte em 3D: trilhas dos rovers e locais de pouso',
      description: 'Marte como um globo 3D feito com imagens da Viking, com os locais de pouso, os caminhos percorridos pelos rovers e os orbitadores ao redor do planeta agora.',
      heading: 'Marte em 3D',
      lede: 'Um globo de Marte feito com as imagens da Viking, da NASA, com os locais de pouso, as trilhas dos rovers pela superfície e os orbitadores lá em cima.',
      shows: [
        'Locais de pouso e os caminhos que os rovers percorreram.',
        'Os orbitadores ao redor de Marte, onde estão agora.',
      ],
      sources: ['As imagens globais de Marte.', HORIZONS],
      freshness: MOSAIC_FRESHNESS,
      limits: [NO_TIME],
    },
    'sun-live': {
      title: 'O Sol ao vivo hoje: a imagem mais recente do SDO da NASA',
      description: 'O Sol hoje na imagem mais recente do Solar Dynamics Observatory da NASA, em ultravioleta extremo, aqui e em um globo 3D no sistema solar ao vivo do TAKIP.',
      heading: 'O Sol ao vivo',
      lede: 'O Sol na imagem mais recente do Solar Dynamics Observatory da NASA, na luz ultravioleta extrema de 171 Å, que revela seus arcos e regiões ativas.',
      shows: ['O Sol como um globo, envolto no quadro mais recente do SDO.'],
      sources: ['As imagens mais recentes do Solar Dynamics Observatory.'],
      freshness: 'O quadro mais recente que o Helioviewer tem.',
      limits: ['Só um canal, 171 Å.'],
    },
    'stars-and-galaxies': {
      title: 'Estrelas, exoplanetas e galáxias em 3D',
      description: 'Voe do Sol até a borda do universo observável: 12.807 estrelas próximas, planetas de outras estrelas, a Via Láctea e 43.463 galáxias, tudo em 3D.',
      heading: 'Das estrelas à borda do universo',
      lede: 'Continue afastando o zoom e a visão continua: as estrelas próximas e seus planetas, a Via Láctea, as galáxias vizinhas e dezenas de milhares de outras.',
      shows: [
        '12.807 estrelas do Yale Bright Star Catalogue, do Hipparcos e, a até uns 100 anos-luz, do Gaia DR3.',
        'Estrelas que sabidamente têm planetas, do NASA Exoplanet Archive.',
        'A Via Láctea vista de dentro e, de fora, como ilustração artística, identificada como tal.',
        'O Grupo Local, 43.463 galáxias do 2MASS Redshift Survey, galáxias e quasares do SDSS e a radiação cósmica de fundo em micro-ondas do WMAP.',
      ],
      sources: [
        'Posições e brilho das estrelas.',
        'Estrelas com planetas conhecidos.',
        'A Via Láctea vista de dentro.',
        'Galáxias, quasares e a radiação cósmica de fundo em micro-ondas.',
      ],
      freshness: 'Catálogos, atualizados quando eles são atualizados.',
      limits: [
        'As estrelas não se movem nesta visão.',
        'Ninguém jamais viu a Via Láctea de fora; essa visão é uma ilustração.',
      ],
    },

    // Weather
    'weather-near-me': {
      title: 'Clima perto de mim: radar, raios e previsão do tempo agora',
      description:
        'O tempo onde você está agora: o boletim do aeroporto mais próximo, radar de chuva, raios dos últimos 15 minutos e previsão de 7 dias do MET Norway, ao vivo.',
      heading: 'Clima perto de mim',
      lede: 'O tempo onde você está, encontrado pela sua conexão ou pelo seu aparelho: o que o aeroporto mais próximo mede, o que o radar e as redes de raios veem agora ao seu redor e a previsão do MET Norway para os próximos dias.',
      shows: [
        'O último boletim da estação meteorológica do aeroporto mais próximo de você, em palavras simples.',
        'Chuva ou neve no radar e raios dos últimos 15 minutos a menos de 50 km de você: a que distância e em que direção.',
        'A previsão do MET Norway para o seu ponto: o próximo dia a cada três horas e depois uma linha por dia durante uma semana.',
        'O mapa ao vivo ao seu redor com radar, raios, temperatura, vento e avisos, e um link para a página do tempo da sua cidade.',
      ],
      sources: [
        'A previsão para o seu ponto do Locationforecast: de hora em hora por cerca de dois dias e meio, depois a cada seis horas.',
        'O último METAR das estações meteorológicas de aeroporto da cidade mais próxima de você.',
        'Um mosaico mundial das redes nacionais de radares meteorológicos.',
        'Raios das redes NLDN e GLD360 e do Lightning Imager do Meteosat-12.',
      ],
      freshness: 'Boletins de aeroporto em geral a cada hora, radar a cada 10 minutos, raios a cada 5 a 15 minutos e a previsão sempre que o MET Norway publica uma nova.',
      limits: [
        '“Perto de você” segue onde sua conexão situa você, o que pode errar por dezenas de quilômetros, até você compartilhar a localização do seu aparelho.',
        'A previsão, e a temperatura e o vento no mapa, são valores de modelo; o boletim do aeroporto, o radar e os raios são medições.',
        'O boletim do aeroporto é o da cidade mais próxima, e não há nenhum onde nenhuma estação informa a menos de 30 km dessa cidade.',
        'Radar e raios não chegam a todo lugar; as páginas deles listam as lacunas.',
      ],
    },
    'rain-radar': {
      title: 'Radar de chuva em tempo real: chuva e neve perto de mim',
      description:
        'Está chovendo perto de você? Radar meteorológico em tempo real do RainViewer: chuva e neve vistas por radares em solo no mundo todo nas últimas duas horas.',
      heading: 'Radar de chuva',
      lede: 'O que os radares meteorológicos em terra veem agora, costurado num só mapa: chuva, pancadas e neve das últimas duas horas, em loop para você ver para que lado estão indo.',
      shows: [
        'Quadros de radar a cada 10 minutos das últimas 2 horas, exibidos em loop.',
        'Se o radar mostra chuva ou neve a menos de 50 km de você, a que distância e em que direção.',
        'Volte no tempo com o Replay e o radar acompanha o horário que você está vendo.',
      ],
      sources: ['Um mosaico mundial das redes nacionais de radares meteorológicos.'],
      freshness: 'Quadros novos a cada 10 minutos, e o mapa verifica a cada 5.',
      limits: [
        'Só onde há radares em terra: o oceano aberto e boa parte da África, da Ásia Central e da América do Sul não têm nenhum.',
        'Só quadros passados; os quadros de previsão do RainViewer ficam de fora.',
        '“Perto de você” segue onde sua conexão situa você, o que pode errar por dezenas de quilômetros, até você compartilhar a localização do seu aparelho.',
        'O detalhe para por volta do zoom 7.',
      ],
    },
    'wind-map': {
      title: 'Mapa de ventos ao vivo: velocidade e direção no mundo',
      description: 'Um mapa global de ventos do modelo GFS da NOAA: o vento a 10 metros de altura, em traços que se movem, com velocidade e direção em qualquer lugar do mundo.',
      heading: 'Mapa de ventos',
      lede: 'O vento a 10 metros do solo, do modelo global de previsão da NOAA, desenhado como traços que se movem com ele, para que frentes e tempestades se destaquem num relance.',
      shows: [
        'Traços em movimento que mostram a direção e a força do vento.',
        'Clique para ver a temperatura, o vento, as rajadas, a chuva recente e as nuvens no ponto da grade mais próximo.',
      ],
      sources: [GFS, OPEN_METEO],
      freshness: GFS_FRESHNESS,
      limits: [
        'Um modelo de previsão, não vento medido.',
        'Ventos locais em vales e entre prédios são suavizados nesta escala.',
      ],
    },
    'temperature-map': {
      title: 'Mapa de temperatura ao vivo no mundo todo',
      description: 'A temperatura do ar a 2 metros do solo no mundo todo, do modelo GFS da NOAA a 0,25°, num mapa ao vivo com valores marcados por toda parte, em °C ou °F.',
      heading: 'Mapa de temperatura',
      lede: 'A temperatura do ar no planeta inteiro, do modelo global da NOAA, como um campo de cores com valores marcados, em °C ou °F.',
      shows: [
        'Um campo de cores da temperatura a 2 metros do solo.',
        'Valores marcados pelo mapa; clique num deles para ver o lugar e o valor.',
        'Alterne entre °C e °F.',
      ],
      sources: [GFS, OPEN_METEO],
      freshness: GFS_FRESHNESS,
      limits: [
        'Valores do modelo para a hora de previsão mais próxima, não leituras de termômetro.',
        'Até o GFS carregar, uma grade grosseira do Open-Meteo é interpolada, o que suaviza montanhas e litorais.',
      ],
    },
    'lightning-map': {
      title: 'Mapa de raios em tempo real: tempestades perto de mim',
      description:
        'Tem raio perto de você agora? Mapa de raios em tempo real com dados da NOAA e da EUMETSAT: descargas dos últimos 15 minutos nas Américas, Europa e África.',
      heading: 'Mapa de raios em tempo real',
      lede: 'Onde os raios estão caindo agora: as redes terrestres da NOAA sobre as Américas e o Pacífico, e o imageador de raios do Meteosat sobre a Europa, a África e o Oriente Médio, para que as tempestades ativas se destaquem num relance e você saiba se os trovões que ouve estão perto.',
      shows: [
        'Densidade de descargas em células de 8 km a cada 15 minutos sobre as Américas, o Pacífico e a Ásia Oriental, da NOAA.',
        'Relâmpagos vistos da órbita em células de 2 km a cada 5 minutos sobre a Europa, a África e o Oriente Médio, da EUMETSAT.',
        'Se caiu raio a menos de 50 km de você nos últimos 15 minutos, a que distância e em que direção.',
        'Volte no tempo com o Replay e a camada acompanha, por cerca das últimas 6 horas.',
      ],
      sources: [
        'Densidade de descargas das redes de detecção de raios NLDN e GLD360.',
        'Área acumulada de relâmpagos do Lightning Imager do Meteosat-12, pelo serviço de mapas EUMETView.',
      ],
      freshness: 'Quadros da NOAA a cada 15 minutos e da EUMETSAT a cada 5, cada um com cerca de 10 a 20 minutos de atraso; o mapa verifica a cada 5 minutos.',
      limits: [
        'Sem cobertura: de 70° L a 110° L (Índia, Ásia Central, oeste da China e o Sudeste Asiático continental), Austrália e Nova Zelândia ao sul de 25° S, e o extremo norte.',
        'As duas redes medem de formas diferentes: a NOAA conta descargas a partir do solo e o Meteosat vê relâmpagos da órbita, inclusive entre nuvens, então suas cores não se comparam.',
        '“Perto de você” segue onde sua conexão situa você, o que pode errar por dezenas de quilômetros, até você compartilhar a localização do seu aparelho.',
        'O detalhe para no zoom 8.',
      ],
    },
    'live-satellite-earth': {
      title: 'A Terra ao vivo do espaço: imagem de satélite a cada 10 min',
      description: 'A Terra inteira vista do espaço pelos satélites GOES, Meteosat e Himawari em um mapa ao vivo: uma nova imagem a cada 10 minutos, com cerca de 40 min de atraso.',
      heading: 'A Terra vista por satélites meteorológicos, ao vivo',
      lede: 'Satélites meteorológicos geoestacionários fotografam a face inteira da Terra a cada 10 minutos. O TAKIP junta GOES, Meteosat e Himawari numa só visão ao vivo do planeta.',
      shows: [
        'GOES-East e GOES-West em cores reais sobre as Américas e o Pacífico.',
        'Meteosat sobre a Europa, a África e o Atlântico.',
        'Himawari sobre a Ásia e a Austrália, em infravermelho.',
      ],
      sources: [
        'Imagens GeoColor do GOES e infravermelho do Himawari sobre o Blue Marble e o Black Marble da NASA.',
        'Imagens do Meteosat do seu serviço de visualização.',
      ],
      freshness: 'Quadros a cada 10 minutos, que chegam uns 30 a 40 minutos depois de serem feitos. O mapa verifica a cada 5 minutos.',
      limits: [
        'O setor do Himawari é nuvem em infravermelho sobre uma imagem fixa do solo, não cores reais.',
        'O detalhe para por volta do zoom 7.',
        'Não aparece enquanto a História está aberta.',
      ],
    },
    'cloud-map': {
      title: 'Mapa de nuvens ao vivo: cobertura de nuvens por satélite',
      description: 'A cobertura de nuvens do planeta, do mosaico de satélites meteorológicos da NOAA, atualizada a cada hora e desenhada em 3D, para ver onde o céu está limpo.',
      heading: 'Nuvens ao vivo',
      lede: 'O mosaico horário da NOAA com todos os satélites meteorológicos geoestacionários, sobreposto ao mapa como nuvens iluminadas em 3D, para ver num relance onde o céu está limpo.',
      shows: [
        'Nuvens a partir de imagens no infravermelho e no visível, no mundo todo.',
        'Iluminadas pelo Sol, com alturas estimadas pela temperatura do topo das nuvens.',
      ],
      sources: ['O Global Mosaic of Geostationary Satellite Imagery, pelo nowCOAST.'],
      freshness: 'Um mosaico novo a cada hora, e o mapa verifica a cada 5 minutos.',
      limits: [
        'Cerca de 3 km por pixel, então nuvens pequenas se misturam. O detalhe para no zoom 6.',
        'O efeito 3D é uma renderização, não a altura medida das nuvens.',
      ],
    },
    'daily-satellite-images': {
      title: 'Imagens de satélite diárias da Terra desde 2000 (NASA)',
      description: 'As imagens diárias em cores reais da Terra inteira, da NASA (VIIRS e MODIS), desde fevereiro de 2000, num mapa que segue a História e o Replay até qualquer dia.',
      heading: 'Imagens de satélite diárias',
      lede: 'Os satélites de órbita polar da NASA fotografam o planeta inteiro todos os dias. Esta camada mostra essas imagens: as de ontem, por padrão, e as de qualquer dia desde fevereiro de 2000.',
      shows: [
        'Imagens em cores reais do VIIRS, no NOAA-20, desde janeiro de 2018, e do MODIS, no Terra, desde 24 de fevereiro de 2000.',
        'Volte no tempo com a História ou o Replay e as imagens acompanham a data.',
      ],
      sources: ['Global Imagery Browse Services, os mosaicos diários de reflectância corrigida da NASA.'],
      freshness: 'No modo ao vivo, mostra ontem (UTC), o último dia completo.',
      limits: [
        'Montadas com passagens feitas em horários diferentes do dia, então emendas e falhas entre as passagens são normais.',
        'O detalhe para por volta do zoom 9.',
      ],
    },

    // Hazards
    earthquakes: {
      title: 'Terremotos hoje: mapa de terremotos ao vivo no mundo',
      description: 'Todos os terremotos de magnitude 2,5 ou mais das últimas 24 horas, no mundo todo, do USGS e do EMSC num só mapa ao vivo, com magnitude, profundidade e local.',
      heading: 'Terremotos ao vivo',
      lede: 'Todos os terremotos de magnitude 2,5 ou mais do último dia, no mundo todo, dos dois grandes catálogos combinados para que cada tremor apareça uma vez só.',
      shows: [
        'Cada terremoto marcado onde ocorreu.',
        'Clique num deles para ver magnitude, local, profundidade e coordenadas, o número da outra agência quando as duas o registram, e um link para o relatório completo.',
      ],
      sources: [
        'O feed do Serviço Geológico dos EUA com terremotos de magnitude 2,5 ou mais, no mundo todo.',
        'O catálogo do Centro Sismológico Euro-Mediterrânico, mais forte na Europa e no Mediterrâneo.',
      ],
      freshness: 'Os dois catálogos são lidos a cada minuto, e o mapa verifica a cada 15 minutos.',
      limits: [
        'A primeira magnitude costuma ser revisada na hora seguinte ao terremoto.',
        'A lista do EMSC é limitada aos seus 500 eventos mais recentes, então, num dia muito movimentado, alguns terremotos pequenos fora dos EUA podem faltar.',
        'Terremotos pequenos são mais bem registrados onde as redes sísmicas são densas, como nos EUA, no Japão e na Europa.',
      ],
      spots: [{ label: 'Japão' }, { label: 'Califórnia' }, { label: 'Turquia' }, { label: 'Indonésia' }],
    },
    wildfires: {
      title: 'Mapa de queimadas: focos de incêndio da NASA FIRMS ao vivo',
      description: 'Focos de incêndio ativos no mundo, da NASA FIRMS, nas últimas 24 horas, com perímetros de incêndios nos EUA e ocorrências no Canadá, num mapa ao vivo.',
      heading: 'Incêndios ativos',
      lede: 'O calor detectado pelos satélites da NASA nas últimas 24 horas, com os perímetros oficiais de incêndios nos EUA e as ocorrências no Canadá, num só mapa.',
      shows: [
        'Focos de calor dos instrumentos VIIRS nos satélites Suomi NPP, NOAA-20 e NOAA-21.',
        'Clique num foco para ver o brilho, a potência radiativa do fogo, quantos satélites o detectaram e quando.',
        'Perímetros de incêndios nos EUA, do NIFC, com tamanho e contenção, e ocorrências no Canadá, do CWFIS e do BC Wildfire Service.',
      ],
      sources: [
        'Focos de calor das passagens de satélite das últimas 24 horas.',
        'Perímetros de incêndios florestais nos Estados Unidos.',
        'Ocorrências de incêndio em todo o Canadá.',
        'Vulcões ativos.',
      ],
      freshness: 'O FIRMS é lido a cada 30 minutos e os perímetros a cada 10. Os focos carregam quando você abre o mapa, então recarregue para ver os mais recentes.',
      limits: [
        'Um foco de calor é calor visto da órbita: um incêndio florestal, uma queimada agrícola, uma chama de gás ou um vulcão. Não é um incêndio confirmado.',
        'Quando há mais de 5.000 focos, a metade mais forte é mantida e o resto é amostrado.',
        'Os vulcões ativos da NASA EONET também são desenhados como focos; os valores de brilho e potência deles são marcadores provisórios, não leituras de satélite.',
      ],
      spots: [
        { label: 'Califórnia' },
        { label: 'Oeste do Canadá' },
        { label: 'África Central', note: 'A maior parte das queimadas do mundo acontece nas savanas africanas.' },
        { label: 'Amazônia' },
      ],
    },
    'severe-weather': {
      title: 'Mapa de alertas meteorológicos: avisos no mundo, ao vivo',
      description: 'Avisos de tempo severo num mapa ao vivo: alertas dos EUA e do Canadá, avisos da OMM e do GDACS, eventos da NASA EONET e previsões de furacões, num só lugar.',
      heading: 'Alertas de tempo severo',
      lede: 'Avisos oficiais de serviços meteorológicos do mundo todo, reunidos num só mapa: tempestades, enchentes, calor, neve e mais, cada um com quem o emitiu.',
      shows: [
        'Um marcador por alerta, indicado pela gravidade.',
        'Clique num deles para ver tipo, gravidade, área e emissor, com um link para o original.',
        'Cones de previsão de furacões e tempestades tropicais do Centro Nacional de Furacões dos EUA.',
      ],
      sources: [
        'Alertas ativos em todos os Estados Unidos.',
        'Avisos meteorológicos e alertas da defesa civil no Canadá.',
        'Avisos severos e extremos de serviços meteorológicos nacionais do mundo todo.',
        'Alertas globais de desastres e eventos naturais.',
        'Previsões e avisos de ciclones tropicais.',
      ],
      freshness: 'As fontes são lidas a cada 3 minutos, e o mapa verifica a cada 5.',
      limits: [
        'A cobertura depende do que cada país publica num formato que o TAKIP consegue ler; muitos só estão cobertos pelos avisos severos e extremos da OMM.',
        'Cada alerta é um ponto, não a área completa do aviso. Alertas dos EUA sem área mapeada ficam de fora.',
      ],
    },
    hurricanes: {
      title: 'Furacões ao vivo: tempestades tropicais e cones de previsão',
      description: 'Furacões e tempestades tropicais num mapa ao vivo, com os cones e pontos de previsão do Centro Nacional de Furacões dos EUA e alertas de ciclones no mundo todo.',
      heading: 'Furacões e tempestades tropicais',
      lede: 'Furacões e tempestades tropicais ativos com o cone de previsão e a trajetória do Centro Nacional de Furacões, e alertas de ciclones do resto do mundo.',
      shows: [
        'Cones e pontos de previsão do NHC para tempestades no Atlântico e no Pacífico leste e central.',
        'Clique num ponto de previsão para ver horário de validade, vento, rajadas e pressão.',
        'Alertas de ciclones tropicais em outras bacias oceânicas, do GDACS.',
      ],
      sources: ['Cones de previsão, trajetórias e boletins.', 'Alertas de ciclones tropicais no mundo todo.'],
      freshness: 'Os cones são lidos a cada 5 minutos e redesenhados a cada 10. O NHC emite boletins a cada 6 horas, e com mais frequência quando uma tempestade ameaça a terra.',
      limits: [
        'O cone mostra para onde o centro da tempestade deve ir, não o tamanho dela: os efeitos muitas vezes chegam bem além dele.',
        'As previsões do NHC cobrem só o Atlântico e o Pacífico leste e central.',
      ],
    },
    radiation: {
      title: 'Mapa de radiação ao vivo: leituras da EPA RadNet e Safecast',
      description: 'A radiação de fundo num mapa ao vivo, dos monitores EPA RadNet nos EUA e dos sensores voluntários da Safecast no mundo, comparada com o normal de cada estação.',
      heading: 'Níveis de radiação',
      lede: 'Leituras de radiação gama dos monitores RadNet do governo dos EUA e da rede voluntária Safecast, com as estações RadNet comparadas com o próprio normal.',
      shows: [
        'Um ponto por monitor, com a leitura mais recente em nanosieverts por hora.',
        'Para as estações RadNet, uma avaliação em relação à média de 7 dias da estação.',
        'Estações sem sinal há 6 horas são marcadas como offline.',
      ],
      sources: [
        'Monitores fixos de ar em todos os Estados Unidos.',
        'Sensores montados por voluntários que reportam por conta própria, no mundo todo.',
      ],
      freshness: 'O RadNet é lido a cada hora e a Safecast a cada 15 minutos; o mapa verifica a cada 5.',
      limits: [
        'A chuva tira a radioatividade natural do ar e muitas vezes causa picos curtos. Um pico sozinho não é um alerta.',
        'As leituras da Safecast aparecem sem avaliação.',
      ],
      spots: [{ label: 'Fukushima', note: 'A Safecast surgiu depois do acidente de 2011 aqui.' }],
    },
    'disease-outbreaks': {
      title: 'Mapa de surtos de doenças: avisos da OMS, CDC e ECDC',
      description: 'Surtos de doenças relatados pela OMS, avisos de viagem do CDC dos EUA e do ECDC, marcados no país a que se referem, dos últimos 90 dias, num mapa ao vivo.',
      heading: 'Surtos de doenças',
      lede: 'Relatórios oficiais de surtos da Organização Mundial da Saúde, do CDC dos EUA e do ECDC europeu, agrupados pelo país a que se referem.',
      shows: [
        'Um marcador por país com algum aviso nos últimos 90 dias.',
        'Clique num deles para ver os avisos, com links para lê-los na íntegra.',
      ],
      sources: [
        'Os relatórios de surtos da Organização Mundial da Saúde.',
        'Mantidos no mapa enquanto estão em vigor.',
        'O Centro Europeu de Prevenção e Controle de Doenças.',
      ],
      freshness: 'Lido a cada hora.',
      limits: [
        'Só em nível de país: o marcador fica no meio do país, não onde estão os casos.',
        'Os avisos saem depois da confirmação oficial, muitas vezes dias ou semanas depois do início de um surto.',
      ],
    },

    // Cameras and streams
    'live-cameras': {
      title: 'Câmeras ao vivo pelo mundo: trânsito e webcams de cidades',
      description: 'Cerca de 100.000 câmeras públicas de trânsito e de cidades num mapa ao vivo, de órgãos públicos e redes de webcams em dezenas de países. Clique e assista.',
      heading: 'Câmeras ao vivo',
      lede: 'Órgãos de trânsito, prefeituras e redes de webcams publicam suas câmeras. O TAKIP reúne cerca de 100.000 delas num só mapa, para você ver um lugar como ele está agora.',
      shows: [
        'Um marcador por câmera, com prévias ao vivo sobre elas conforme você aproxima o zoom.',
        'Clique numa para abrir um player: vídeo ao vivo quando a fonte transmite, senão a imagem estática mais recente, sendo atualizada.',
        'Câmeras listadas mas sem transmissão continuam no mapa, esmaecidas e marcadas como fora do ar.',
      ],
      sources: [
        'Câmeras de rodovias dos departamentos de transporte estaduais dos EUA e dos serviços 511, e de órgãos rodoviários da Europa, do Canadá, do Japão, da Coreia, de Taiwan, da Austrália e da Nova Zelândia.',
        'Câmeras de trânsito de cidades, como as de Istambul, Seul e Calgary.',
        'Webcams públicas de redes como CamStreamer e PhenoCam, e webcams listadas no OpenStreetMap.',
      ],
      freshness: 'A lista de câmeras é refeita a cada 30 minutos; cada imagem é atualizada com a frequência da sua fonte.',
      limits: [
        'Muitas fontes publicam imagens estáticas que se atualizam a cada minuto ou a cada poucos minutos, não vídeo.',
        'A cobertura depende de quem publica: os EUA, o Japão e o Canadá têm mais, e muitos países não têm nenhuma.',
        'Câmeras saem do ar por manutenção ou por decisão das autoridades; essas são marcadas como fora do ar, em vez de removidas.',
      ],
      spots: [
        { label: 'Istambul', note: 'O trânsito da cidade dos dois lados do Bósforo.' },
        { label: 'Tóquio' },
        { label: 'Alpes', note: 'Passos de montanha e vales.' },
        { label: 'Seattle' },
      ],
    },
    'plate-readers': {
      title: 'Mapa de câmeras leitoras de placas (ALPR) nos EUA e Canadá',
      description: 'Leitores automáticos de placas, da Flock e outros, mapeados por voluntários no OpenStreetMap via DeFlock nos EUA e no Canadá, com a direção de cada um.',
      heading: 'Leitores de placas (ALPR)',
      lede: 'Câmeras de leitura automática de placas, como as da Flock Safety, mapeadas por voluntários no OpenStreetMap via DeFlock, com a direção para onde cada uma está virada.',
      shows: [
        'Pontos a partir do zoom 3, detalhes a partir do zoom 9 e cones de visão a partir do zoom 13.',
        'Clique numa para ver operador, fabricante, a direção para onde aponta, onde está instalada e quando foi mapeada.',
      ],
      sources: ['Blocos de mapa, refeitos a cada hora, com as câmeras ALPR marcadas no OpenStreetMap.'],
      freshness: 'O DeFlock refaz seus blocos a partir do OpenStreetMap a cada hora.',
      limits: [
        'Os voluntários mapeiam o que encontram, então muitos leitores ainda não estão no mapa.',
        'A largura e o alcance do cone são valores típicos, não medidos para cada câmera.',
        'Só os EUA e o Canadá.',
      ],
    },
    'live-news': {
      title: 'Notícias ao vivo no mapa: canais de TV do mundo',
      description: 'Canais de notícias ao vivo do mundo todo, marcados nas suas redações: abra uma transmissão e assista enquanto acompanha os acontecimentos no mesmo mapa.',
      heading: 'Canais de notícias ao vivo',
      lede: 'Canais de notícias do mundo todo que transmitem ao vivo, marcados no lugar de onde transmitem, ao lado dos eventos relatados nas últimas duas horas, para você ver o noticiário ao lado do mapa de que ele fala.',
      shows: [
        'Um marcador na redação de cada canal. Um canal fora do ar mantém o seu marcador, esmaecido.',
        'Clique num deles para assistir ao que ele transmite agora, ou para abri-lo no YouTube quando o dono não permite reproduzi-lo em outro lugar.',
        'Eventos do GDELT: violência, protestos e tensão relatados por pelo menos dois veículos nas últimas duas horas, dimensionados pelo número de veículos que relatam cada um.',
      ],
      sources: [
        'As transmissões ao vivo dos próprios canais.',
        'Eventos codificados a cada 15 minutos a partir de notícias do mundo todo.',
      ],
      freshness: 'Quais canais estão no ar, e com qual transmissão, é verificado a cada 30 minutos. O GDELT carrega quando você abre o mapa.',
      limits: [
        'Nem todo canal está ao vivo o tempo todo, e alguns não passam em todos os países.',
        'Os marcadores indicam a redação, não o lugar da notícia.',
        'Os canais refletem a visão dos seus donos, e há emissoras estatais entre eles.',
        'O GDELT é codificado por máquina e às vezes coloca um evento no centro de uma região.',
      ],
    },

    // On the ground
    traffic: {
      title: 'Mapa de trânsito ao vivo: velocidade e congestionamento',
      description: 'Velocidades medidas nas vias, ao vivo: no mundo pela TomTom e, com mais detalhe, por dados abertos dos Países Baixos e da França, com as vias lentas em cor.',
      heading: 'Trânsito',
      lede: 'A que velocidade o trânsito está andando, medida, com as vias lentas e congestionadas destacadas em cor, para o congestionamento aparecer sem cobrir o mapa.',
      shows: [
        'Vias lentas e congestionadas destacadas, a partir do zoom 10.',
        'Clique numa via para ver a velocidade, a parcela da velocidade habitual e quando foi medida.',
      ],
      sources: [
        'Fluxo de trânsito no mundo todo.',
        'O armazém nacional de dados rodoviários dos Países Baixos.',
        'Dados abertos de trânsito das duas cidades francesas.',
      ],
      freshness: 'O mapa é atualizado a cada 2 minutos.',
      limits: [
        'Só as vias lentas e congestionadas são destacadas; as que fluem livremente ficam sem cor.',
        'Aparece a partir do zoom 10, mais ou menos uma cidade por vez.',
      ],
    },
    'live-transit': {
      title: 'Ônibus e trens ao vivo: transporte público em tempo real',
      description: 'Ônibus, bondes, trens e metrôs em tempo real em centenas de cidades, de cerca de 750 feeds abertos de transporte, com a linha e o status de cada veículo.',
      heading: 'Ônibus e trens ao vivo',
      lede: 'Centenas de operadoras de transporte publicam onde estão seus veículos. O TAKIP os desenha em movimento, para você ver os ônibus, bondes e trens de uma cidade enquanto circulam.',
      shows: [
        'Veículos a partir do zoom 10. Com o zoom afastado, as cidades com dados aparecem listadas no mapa.',
        'Clique num veículo para ver linha, identificação, status, velocidade e operadora.',
        'Cada veículo diz se é ao vivo, estimado ou se segue a tabela de horários, para você saber o que está vendo.',
      ],
      sources: [
        'Cerca de 750 feeds GTFS Realtime em uns 40 países.',
        'Os ônibus da İETT de Istambul, o LA Metro Rail, o ‘L’ de Chicago, o metrô de Londres, a FGC de Barcelona, o Toei de Tóquio e outros.',
      ],
      freshness: 'Os veículos são atualizados a cada 20 segundos enquanto você está com o zoom aproximado.',
      limits: [
        'Alguns sistemas publicam só previsões de chegada. Os trens deles são posicionados entre as estações a partir dessas previsões e marcados como estimados.',
        'Onde não existe nada ao vivo, como nos metrôs de Istambul e de Izmir, os trens seguem a tabela de horários e são marcados como tal.',
        'A maioria dos feeds está nos EUA, no Canadá e na França.',
      ],
      spots: [
        { label: 'Nova York', note: 'Ônibus ao vivo; o metrô posicionado pelos horários de chegada.' },
        { label: 'Londres' },
        { label: 'Istambul', note: 'Ônibus da İETT ao vivo; o metrô pela tabela de horários.' },
        { label: 'São Francisco' },
      ],
    },
    'hiking-trails': {
      title: 'Mapa de trilhas: rotas de caminhada longas e locais',
      description: 'Rotas de caminhada sinalizadas do OpenStreetMap no mundo todo: trilhas internacionais e nacionais em qualquer zoom, e regionais e locais ao aproximar.',
      heading: 'Trilhas de caminhada',
      lede: 'Rotas de caminhada sinalizadas do OpenStreetMap, via Waymarked Trails: das trilhas de longa distância que cruzam continentes aos circuitos locais.',
      shows: [
        'Rotas internacionais e nacionais em qualquer zoom, regionais a partir do zoom 7 e locais a partir do zoom 10.',
        'Clique numa rota para ver a rede, o itinerário, a extensão mapeada e a oficial, o responsável e links.',
      ],
      sources: ['Rotas de caminhada mapeadas no OpenStreetMap.'],
      freshness: 'Mantido em dia com o OpenStreetMap pelo Waymarked Trails.',
      limits: ['Só rotas que alguém mapeou como rota no OpenStreetMap; a cobertura é mais rica na Europa.'],
    },

    // World events
    'world-news-map': {
      title: 'Mapa de notícias do mundo: últimas notícias por lugar',
      description: 'Últimas notícias num mapa ao vivo: reportagens de agências e canais públicos do Telegram nos lugares que citam, ao lado dos eventos codificados do GDELT.',
      heading: 'Notícias do mundo no mapa',
      lede: 'Reportagens de agências de notícias e canais públicos, marcadas na cidade que citam, ao lado dos eventos codificados por máquina do GDELT: protestos, violência e tensão relatados nas últimas duas horas.',
      shows: [
        'Marcadores de alerta: reportagens das últimas 72 horas, posicionadas no lugar que citam. Clique num para ver a reportagem, a fonte e o viés dela.',
        'Eventos do GDELT: violência, protestos e tensão relatados por pelo menos dois veículos nas últimas duas horas, dimensionados pelo número de veículos que relatam cada um.',
      ],
      sources: [
        'Onze feeds RSS públicos, entre eles BBC, Guardian, Al Jazeera, TASS e Anadolu.',
        'Nove canais públicos.',
        'Eventos codificados a cada 15 minutos a partir de notícias do mundo todo.',
      ],
      freshness: 'As agências são lidas a cada 5 minutos e os canais a cada 3. O GDELT carrega quando você abre o mapa.',
      limits: [
        'Os lugares são extraídos do texto da reportagem, então um marcador fica, no máximo, no nível da cidade, e às vezes está errado.',
        'As fontes tomam partido. Cada uma é identificada com seu viés, e as partidárias estão incluídas de propósito.',
        'O GDELT é codificado por máquina e às vezes coloca um evento no centro de uma região.',
      ],
    },
    'air-raid-alerts': {
      title: 'Alertas de ataque aéreo: sirenes na Ucrânia e em Israel',
      description: 'Alertas de ataque aéreo ao vivo no mapa: os alertas por região da Ucrânia e as sirenes de foguetes de Israel, com o início de cada um e o total do último dia.',
      heading: 'Alertas de ataque aéreo',
      lede: 'Onde as sirenes de ataque aéreo estão soando agora, na Ucrânia por região e em Israel por cidade, com há quanto tempo cada alerta dura e quantos houve no último dia.',
      shows: [
        'Alertas ativos e os que acabaram de terminar.',
        'Clique num deles para ver o lugar, quando começou, as sirenes ali nas últimas 24 horas e a fonte.',
      ],
      sources: [
        'O sistema oficial de alertas de ataque aéreo, por meio de um espelho público.',
        'Tzeva Adom, um serviço comunitário que retransmite os alertas do Comando da Frente Interna.',
      ],
      freshness: 'O mapa verifica a cada minuto. Os dados da Ucrânia são tratados como indisponíveis se não forem atualizados em 10 minutos.',
      limits: [
        'Nunca dependa disto para a sua segurança. Use o aplicativo oficial de alertas.',
        'Os dois feeds são retransmissões não oficiais e podem atrasar ou cair.',
      ],
      spots: [{ label: 'Ucrânia' }, { label: 'Israel' }],
    },
    'disaster-alerts': {
      title: 'Mapa de alertas de desastres no mundo: GDACS ao vivo',
      description: 'Terremotos, ciclones tropicais, enchentes, vulcões e secas sinalizados pelo GDACS, o sistema global de alerta de desastres da ONU e da UE, num mapa ao vivo.',
      heading: 'Alertas de desastres',
      lede: 'Alertas do GDACS, o sistema de alerta de desastres mantido pelas Nações Unidas e pela Comissão Europeia, que sinaliza desastres repentinos que podem exigir uma resposta internacional.',
      shows: [
        'Um marcador por alerta atual do GDACS: terremotos, ciclones tropicais, enchentes, vulcões, secas e incêndios florestais.',
        'Clique num deles para ver o tipo, o nome e o relatório do GDACS.',
      ],
      sources: ['O feed de alertas do Global Disaster Alert and Coordination System.'],
      freshness: 'Lido quando você abre o mapa, com no máximo 5 minutos; recarregue para ver os mais recentes.',
      limits: ['Os alertas do GDACS são primeiras estimativas automáticas de impacto, refinadas conforme chegam relatos.'],
    },

    // The internet
    'internet-outages': {
      title: 'Queda de internet hoje: mapa ao vivo por país e operadora',
      description: 'Quedas de internet agora num mapa ao vivo, do Cloudflare Radar e do IODA: quais países e operadoras perderam a conexão, por quê e por quanto tempo.',
      heading: 'Quedas de internet',
      lede: 'Quedas que o Cloudflare Radar e o IODA, da Georgia Tech, veem nas suas medições, de bloqueios impostos por governos, cabos rompidos e falta de energia à queda de uma única operadora, marcadas no país atingido.',
      shows: [
        'Quedas que a Cloudflare confirmou e descreveu, como pontos cheios: as 50 mais recentes, de países inteiros e de redes isoladas, como uma operadora móvel.',
        'Quedas de tráfego que o detector da Cloudflare viu na última semana, e o IODA nos últimos dois dias, ainda não descritas por ninguém, como anéis.',
        'Clique num deles para ver a rede atingida, a causa, o alcance e quando começou e terminou.',
      ],
      sources: [CLOUDFLARE, 'Se as redes de um país continuam acessíveis, pelo roteamento da internet (BGP), sondagens ativas e outros sinais.'],
      freshness: 'Os dois são lidos de novo a cada 5 minutos enquanto o mapa está aberto. A Cloudflare confirma as quedas depois, então uma nova costuma aparecer primeiro como anel.',
      limits: [
        'Marcado no meio do país, não na área afetada.',
        'Só quedas visíveis num país ou numa rede inteira: uma falha numa rua ou numa cidade não aparece.',
        'Os anéis são detecções automáticas que ninguém verificou ainda e podem ser um problema de medição, não uma queda.',
      ],
    },
    'ddos-attacks': {
      title: 'Mapa de ataques DDoS: de onde vem o tráfego de ataque',
      description: 'Os países de onde vem a maior parte do tráfego de ataques DDoS na camada de rede, segundo o Cloudflare Radar no último dia, com a parcela de cada país.',
      heading: 'Origens dos ataques',
      lede: 'De onde vem o tráfego DDoS na camada de rede que a Cloudflare vê: os 25 principais países no último dia, pela parcela de todo o tráfego de ataque.',
      shows: ['Os 25 principais países de origem, cada um com a sua parcela.'],
      sources: [CLOUDFLARE],
      freshness: 'O último dia, numa janela móvel, carregado quando você abre o mapa.',
      limits: [
        '“Origem” é de onde a Cloudflare viu o tráfego vir. Os atacantes passam por outros países, então isso não diz quem está por trás.',
        'Marcado no meio de cada país.',
      ],
    },
    'malware-map': {
      title: 'Mapa de malware ao vivo: URLs maliciosas e botnets',
      description: 'Sites de download de malware do URLhaus do abuse.ch conforme são denunciados, e servidores de comando de botnets ativos do Feodo Tracker, num mapa ao vivo.',
      heading: 'Malware e botnets',
      lede: 'Novos sites de download de malware conforme o URLhaus do abuse.ch os registra, enviados direto para o mapa, ao lado dos servidores de comando aos quais as botnets se reportam.',
      shows: [
        'Sites de malware, posicionados pela localização do endereço IP. Clique num para ver a ameaça, a família do malware, o host, a rede e há quanto tempo é visto.',
        'Servidores de comando de botnets do Feodo Tracker. Clique num para ver o malware, o endereço, a porta, a rede e quando esteve online pela última vez.',
      ],
      sources: [
        'Sites de distribuição de malware denunciados pela comunidade de segurança.',
        'Servidores de comando e controle de botnets.',
        'Onde cada endereço está localizado.',
      ],
      freshness: 'O URLhaus é verificado a cada minuto, e os sites novos vão direto para o mapa. O Feodo Tracker é lido a cada 5 minutos.',
      limits: [
        'As localizações vêm de geolocalização de IP, que mostra onde um endereço está registrado ou hospedado, não quem está por trás dele.',
        'Os servidores de botnets são marcados no meio do país de hospedagem.',
        'Um servidor listado é infraestrutura, não um ataque em andamento.',
      ],
    },
    'service-outages': {
      title: 'Está fora do ar? Quedas de nuvem e apps num mapa ao vivo',
      description: 'Incidentes nas páginas de status dos grandes serviços de nuvem e software, num mapa ao vivo: o que está fora do ar ou instável agora, nas palavras deles.',
      heading: 'Incidentes em serviços',
      lede: 'Quando um grande serviço de nuvem ou software tem um problema, ele o publica na sua página de status. O TAKIP lê treze delas e coloca os incidentes em aberto no mapa.',
      shows: [
        'Um marcador por serviço com um incidente em aberto.',
        'Clique num deles para ver o incidente e a atualização mais recente.',
      ],
      sources: ['As páginas de status públicas de treze grandes serviços.'],
      freshness: 'Lido a cada 5 minutos.',
      limits: [
        'O que a empresa escolhe relatar, quando escolhe relatar.',
        'O marcador indica a sede da empresa, não onde está a falha.',
      ],
    },
    'undersea-cables': {
      title: 'Mapa de cabos submarinos: os cabos da internet no mar',
      description: 'Os cabos submarinos que levam a internet entre os continentes, num mapa com o ponto de chegada de cada um, por baixo dos navios ao vivo, das quedas e de mais.',
      heading: 'Cabos submarinos',
      lede: 'Quase todo o tráfego entre continentes passa por cabos no fundo do mar. Aqui estão suas rotas e pontos de chegada, por baixo de tudo o mais no mapa.',
      shows: [
        'Cerca de 700 rotas de cabos, desenhadas finas e translúcidas.',
        'Clique num cabo para ver o nome, onde ele chega à costa e um link para o mapa de cabos da TeleGeography.',
      ],
      sources: ['As rotas e os pontos de chegada do Submarine Cable Map.'],
      freshness: 'Um retrato, atualizado manualmente, pela última vez em outubro de 2026.',
      limits: [
        'As rotas são desenhos, não posições levantadas no fundo do mar.',
        'Não é ao vivo: um cabo rompido continua aparecendo.',
      ],
    },

    // Back in time
    'history-map': {
      title: 'Mapa histórico: fronteiras do mundo de 3400 a.C. até hoje',
      description: 'Um atlas histórico interativo: as fronteiras do mundo ano a ano desde 3400 a.C., com guerras, batalhas e outros eventos desde 7500 a.C., num globo 3D.',
      heading: 'O mundo ao longo da história',
      lede: 'Escolha um ano e o mapa redesenha o mundo como ele era: seus Estados e impérios, e as guerras, batalhas e outros eventos daquele momento, avançando na velocidade que você escolher.',
      shows: [
        'Fronteiras do mundo de 3400 a.C. a 2024, com fronteiras detalhadas e datadas do OpenHistoricalMap a partir do zoom 7.',
        'Oito tipos de evento, cada um com seu botão: guerras e batalhas (desde 7500 a.C.), atentados, reivindicações territoriais, patrimônio em perigo, riscos naturais, política, explosões nucleares e desastres.',
        'Países coloridos por cerca de 45 indicadores, como expectativa de vida, PIB per capita e população.',
        'Clique num evento ou num Estado para ver o artigo da Wikipédia; clique num país para ver o gráfico dele ao longo do tempo.',
        '“Ir para” aceita um ano, uma data, “-500” (500 a.C.) ou o nome de um período, e treze momentos escolhidos ficam a um clique.',
      ],
      sources: [BORDERS, 'Fronteiras detalhadas e datadas, a partir do zoom 7.', EVENTS],
      freshness: HISTORY_FRESHNESS,
      limits: [
        RECONSTRUCTED,
        'Cada tipo de evento cobre seu próprio período. Não há fronteiras antes de 3400 a.C. nem eventos antes de 7500 a.C.',
        LIVE_PAUSES,
      ],
    },
    'world-map-1914': {
      title: 'Mapa-múndi em 1914: impérios antes da Primeira Guerra',
      description: 'O mundo em 1914 num mapa interativo: os impérios e as fronteiras às vésperas da Primeira Guerra Mundial e, depois, as batalhas da guerra conforme aconteceram.',
      heading: 'O mundo em 1914',
      lede: 'Em 1914, boa parte do mundo era governada a partir de um punhado de capitais europeias. Abra o mapa em 1914 para ver as fronteiras desses impérios e siga pela Primeira Guerra Mundial, com as batalhas aparecendo onde foram travadas.',
      shows: [
        'As fronteiras do mundo como estavam em 1914.',
        'Guerras e batalhas aparecendo conforme começaram.',
        'Siga a um mês por segundo, ou vá para 1920 para ver as fronteiras traçadas pelos tratados de paz.',
      ],
      sources: [BORDERS, EVENTS],
      freshness: HISTORY_FRESHNESS,
      limits: [RECONSTRUCTED, 'As batalhas ficam onde os registros as colocam, algumas só aproximadamente.', LIVE_PAUSES],
    },
    'world-war-2-map': {
      title: 'Mapa da Segunda Guerra: fronteiras e ocupação mês a mês',
      description: 'A Europa na Segunda Guerra Mundial num mapa interativo: fronteiras, alianças e ocupação mês a mês de fevereiro de 1938 a maio de 1945, com as batalhas.',
      heading: 'A Segunda Guerra Mundial na Europa',
      lede: 'A guerra na Europa como um mapa em movimento: quem estava com quem e quem controlava o quê, mês a mês, do início de 1938 a maio de 1945, com cada batalha aparecendo onde e quando foi travada.',
      shows: [
        'As fronteiras de cada mês como estavam no fim dele, com cada país marcado: Eixo e alinhados, ocupado pelo Eixo, Aliados, em guerra fora dos dois blocos, neutro ou fora da guerra.',
        '“Reproduzir 1938–1945” liga as batalhas, leva a câmera à Europa e reproduz a guerra a um mês por segundo.',
        'Clique numa batalha para ver o que aconteceu, com o artigo da Wikipédia.',
      ],
      sources: ['Fronteiras a partir das anexações, mês a mês; a ocupação aparece como um status, não como fronteira.', EVENTS],
      freshness: HISTORY_FRESHNESS,
      limits: [
        'Só a Europa: a guerra na Ásia e no Pacífico ainda não tem uma camada mês a mês.',
        'Aparece uma camada de fronteiras por vez, então as fronteiras do mundo ficam desligadas enquanto esta estiver ligada.',
        LIVE_PAUSES,
      ],
    },
    'roman-empire-map': {
      title: 'Mapa do Império Romano: no auge e ao longo dos séculos',
      description: 'O Império Romano num mapa histórico interativo: suas fronteiras em 117 d.C., na maior extensão, e como elas cresceram e caíram ao longo dos séculos.',
      heading: 'O Império Romano',
      lede: 'Abra o mapa em 117 d.C., quando o império atingiu sua maior extensão sob Trajano, e volte até a República ou avance até a queda do Ocidente.',
      shows: [
        'As fronteiras de Roma e as dos seus vizinhos em qualquer ano.',
        'Suas guerras e batalhas, conforme começaram.',
        CLICK_EMPIRE,
      ],
      sources: [BORDERS, EVENTS],
      freshness: HISTORY_FRESHNESS,
      limits: ['Fronteiras tão antigas são reconstruções acadêmicas, muitas vezes com margens amplas.', LIVE_PAUSES],
    },
    'ottoman-empire-map': {
      title: 'Mapa do Império Otomano: fronteiras ao longo dos séculos',
      description: 'O Império Otomano num mapa histórico interativo, da ascensão por volta de 1300 ao fim em 1922, com suas fronteiras no cerco de Viena em 1683.',
      heading: 'O Império Otomano',
      lede: 'Abra o mapa em 1683, ano do segundo cerco de Viena, quando o império avançava fundo na Europa, e siga por seu longo recuo até 1922.',
      shows: [
        'As fronteiras do império e as dos seus vizinhos em qualquer ano.',
        'As guerras que travou, conforme começaram.',
        CLICK_EMPIRE,
      ],
      sources: [BORDERS, EVENTS],
      freshness: HISTORY_FRESHNESS,
      limits: [RECONSTRUCTED, LIVE_PAUSES],
    },
    'country-data-over-time': {
      title: 'Mapas de expectativa de vida, PIB e população no tempo',
      description: 'Países coloridos por expectativa de vida, PIB per capita, população e cerca de 45 outros indicadores, ano a ano, com projeções até 2100 onde existem.',
      heading: 'Os países ao longo do tempo',
      lede: 'Pinte cada país por um de cerca de 45 indicadores e veja-o mudar ano a ano; depois compare num gráfico, lado a lado, os países que interessam a você.',
      shows: [
        'Cerca de 45 indicadores, de expectativa de vida, PIB per capita e população a temperatura e urbanização.',
        'Projeções hachuradas no mapa, quando uma fonte as publica, que vão até algum ano entre 2028 e 2100.',
        'Clique num país para ver o gráfico dele ao longo do tempo; até seis lado a lado.',
      ],
      sources: [
        'World Development Indicators, Global Economic Prospects e o Climate Change Knowledge Portal.',
        'Séries de longo prazo, entre elas PIB per capita e população.',
        'World Population Prospects e World Urbanization Prospects.',
        'Perspectivas econômicas e reanálise climática.',
      ],
      freshness: 'Cada indicador segue a versão mais recente da sua fonte.',
      limits: [
        'Os valores são desenhados sobre as fronteiras de hoje, e os anos entre dois valores publicados são estimados.',
        'Projeções são projeções, não previsões do que vai acontecer.',
        LIVE_PAUSES,
      ],
    },
    'continental-drift': {
      title: 'Mapa da deriva continental: a Terra em 1,8 bilhão de anos',
      description: 'Veja os continentes se moverem num globo 3D, do supercontinente Nuna, há 1,8 bilhão de anos, passando pela Pangeia até hoje, com uma história em 13 capítulos.',
      heading: 'Deriva continental',
      lede: 'As placas que carregam os continentes, se movendo num globo de 1,8 bilhão de anos atrás até agora. Começa na Pangeia, há 250 milhões de anos; aperte o play e veja-a se partir até virar o mapa de hoje.',
      shows: [
        'Placas tectônicas e continentes até 1.800 milhões de anos atrás.',
        'Uma história em 13 capítulos, de “Nuna se forma” a “Hoje”, com a câmera acompanhando cada capítulo.',
        'A temperatura da Terra e o CO₂ nos últimos 485 milhões de anos.',
        'Os períodos geológicos ao longo da linha do tempo. “Ir para” aceita “250 Ma” ou um nome como “Jurássico”.',
      ],
      sources: [PLATES, CLIMATE],
      freshness: MODEL_FRESHNESS,
      limits: [
        'Um modelo: quanto mais para trás, menos certas são as posições.',
        'Temperatura e CO₂ cobrem só os últimos 485 milhões de anos.',
      ],
    },
    'dinosaur-earth': {
      title: 'A Terra dos dinossauros: mapas do Jurássico e do Cretáceo',
      description: 'Os continentes como os dinossauros os conheceram, num globo 3D: a Pangeia se partindo no Jurássico, o Atlântico se abrindo e o mundo há 66 milhões de anos.',
      heading: 'A Terra na era dos dinossauros',
      lede: 'Os dinossauros viveram mais de 160 milhões de anos de continentes em movimento. Abra o mapa no Jurássico, há 150 milhões de anos, quando a Pangeia se separa, e siga até o fim do Cretáceo, há 66 milhões de anos.',
      shows: [
        'As placas e os continentes em qualquer momento, com o período geológico na linha do tempo.',
        'O jovem Atlântico se alargando entre as Américas, a Europa e a África.',
        'A temperatura da Terra e o CO₂ ao longo do Mesozoico.',
      ],
      sources: [PLATES, CLIMATE],
      freshness: MODEL_FRESHNESS,
      limits: ['Um modelo de onde as placas estavam, não um mapa dos próprios dinossauros.'],
    },
    'flight-history-replay': {
      title: 'Histórico de voos em replay: voos e navios passados no mapa',
      description: 'Reveja os voos e navios que o TAKIP gravou, num mapa com linha do tempo: vá a qualquer momento, acelere até um ano por segundo e veja tudo acontecer de novo.',
      heading: 'Replay de voos e navios gravados',
      lede: 'O TAKIP grava as aeronaves e os navios que vê. O Replay os reproduz no mapa, para você voltar a um momento e vê-lo acontecer de novo.',
      shows: [
        'Aeronaves e navios como foram gravados, se movendo pelas suas trajetórias.',
        'Uma linha do tempo com play, um controle deslizante e velocidades do tempo real até um ano por segundo. “Ir para” aceita uma data e um horário.',
        'Satélites onde suas órbitas os colocavam naquele momento.',
      ],
      sources: ['Posições de aeronaves, gravadas conforme chegam.', 'Posições de navios, gravadas conforme chegam.'],
      freshness: 'A gravação roda o tempo todo, então um momento pode ser revisto pouco depois de acontecer.',
      limits: [
        'Até onde você pode voltar depende do seu plano: um dia sem conta, sete dias com uma conta gratuita.',
        'Só o que o TAKIP gravou, com as mesmas falhas de cobertura do mapa ao vivo.',
        'As posições dos satélites são calculadas para trás a partir das órbitas de hoje e ficam menos precisas com o passar dos dias.',
        'Com o zoom muito afastado, o mapa pede para você aproximar para ver as trajetórias.',
      ],
    },

    // Tools
    'draw-an-area': {
      title: 'Desenhe uma área no mapa e veja o que há dentro dela',
      description: 'Desenhe uma forma no mapa ao vivo e liste os aviões, navios, câmeras e eventos dentro dela, exporte em CSV ou GeoJSON e registre o que entra e sai.',
      heading: 'Áreas',
      lede: 'Desenhe um polígono, retângulo, círculo ou linha no mapa, ou escolha uma região, e o TAKIP lista o que há dentro dela agora.',
      shows: [
        'Desenhe um polígono, retângulo, círculo ou linha, ou escolha uma região.',
        'Veja o que há dentro dela e exporte em CSV ou GeoJSON.',
        'Monitore uma área para manter um registro do que entra e sai dela enquanto o mapa está aberto.',
        'Busque imagens de satélite recentes da área, dos últimos 60 dias.',
      ],
      sources: ['As camadas que estiverem ligadas.', 'Cenas de satélite da área.'],
      freshness: 'Recontado a cada atualização dos dados.',
      limits: [
        'O monitoramento só funciona enquanto o TAKIP está aberto no seu navegador, e não envia alertas.',
        'As formas ficam guardadas neste navegador.',
        DESKTOP,
      ],
    },
    'route-planner': {
      title: 'Planejador de rotas: de carro, bicicleta e a pé',
      description: 'Planeje uma rota de carro, de bicicleta ou a pé no mapa ao vivo, com paradas no caminho, trechos a evitar, perfil de elevação e instruções passo a passo.',
      heading: 'Planejador de rotas',
      lede: 'Rotas no mesmo mapa de todo o resto: de carro, de bicicleta ou a pé, com as câmeras de trânsito e o tempo pelo caminho a um clique.',
      shows: [
        'Rotas de carro, bicicleta ou a pé, com paradas pelo caminho e trechos a evitar.',
        'Um perfil de elevação e instruções curva a curva.',
      ],
      sources: ['Roteamento sobre o OpenStreetMap.', 'Uma alternativa para rotas de carro.'],
      freshness: 'As rotas usam o OpenStreetMap como os servidores de roteamento o carregaram pela última vez.',
      limits: ['Sem rotas de transporte público.', 'As rotas não levam em conta o trânsito ao vivo.'],
    },
    'ai-map-assistant': {
      title: 'TI: um assistente de IA que lê o mapa ao vivo com você',
      description: 'Pergunte ao TI sobre o que há no mapa: aviões, navios, tempo, terremotos e notícias por perto. Ele acha, segue, explica e desenha previsões com sua chave de IA.',
      heading: 'TI, o assistente do mapa',
      lede: 'O TI lê os mesmos dados ao vivo que você vê e responde a perguntas sobre eles: que avião é aquele, o que está acontecendo perto daqui e o que já aconteceu neste lugar.',
      shows: [
        'Assistente: um chat com ferramentas que encontram lugares, consultam aeronaves, verificam o tempo, planejam rotas, listam o que há por perto, seguem uma trajetória e abrem câmeras.',
        'Previsão: o TI lê as notícias e os dados em torno de uma pergunta e desenha sua previsão no mapa.',
        'Ele pode usar o Replay e a História, e pesquisar o registro de eventos passados.',
      ],
      sources: ['OpenAI, Anthropic, Google Gemini, OpenRouter, Groq, DeepSeek, xAI, Mistral, Qwen ou um modelo local, com a sua própria chave.'],
      freshness: 'As respostas usam os dados do mapa como estão no momento da pergunta.',
      limits: [
        'Entre na sua conta para usar. Ele roda com a chave que você fornecer, e o seu provedor cobra de você pelo que for usado.',
        'Como qualquer IA, ele pode errar. Confira o que for importante.',
      ],
    },
    'osint-lookups': {
      title: 'Ferramentas OSINT: IP, domínio, usuário e certificados',
      description: 'Consulte IP, domínio ou usuário ao lado do mapa ao vivo: WHOIS, certificados, portas abertas, Shodan, vazamentos e listas de ameaças, cerca de 20 ferramentas.',
      heading: 'Recon',
      lede: 'Cerca de vinte consultas para um endereço IP, um domínio, um nome de usuário ou um endereço de cripto, com os resultados que têm um lugar marcados no mapa.',
      shows: [
        'Consultas de endereços IP, domínios, nomes de usuário, listas de ameaças e endereços de cripto.',
        'Entre elas WHOIS, registros de certificados, varredura de portas, Shodan e registros de vazamentos.',
        'Resultados com localização são marcados no mapa.',
      ],
      sources: ['Como WHOIS, registros de transparência de certificados e Shodan; cada consulta cita sua fonte.'],
      freshness: 'Cada consulta pergunta à sua fonte no momento em que você a executa.',
      limits: ['Investigue só o que você tem o direito de investigar.'],
    },
    'arcgis-layers': {
      title: 'Adicione camadas do ArcGIS a um mapa ao vivo',
      description: 'Pesquise no ArcGIS Online ou cole um endereço de FeatureServer e desenhe essa camada no mapa ao vivo do TAKIP, ao lado dos voos, navios, tempo e todo o resto.',
      heading: 'Camadas do ArcGIS',
      lede: 'Milhares de organizações publicam camadas de mapa no ArcGIS. Encontre uma, ou cole o endereço dela, e ela entra no mapa ao vivo.',
      shows: ['Pesquise camadas públicas no arcgis.com.', 'Cole um endereço de FeatureServer para adicioná-la diretamente.'],
      sources: ['Camadas públicas, publicadas pelos próprios donos.'],
      freshness: 'Cada camada é tão atual quanto o dono a mantém.',
      limits: ['Só camadas públicas.', DESKTOP],
    },
    'news-alerts': {
      title: 'Alertas de últimas notícias, cada um marcado no mapa',
      description: 'Um feed ao vivo de notícias de agências e canais públicos, terremotos e avisos oficiais, cada um a um clique do seu lugar no mapa, com resumo por IA no Pro.',
      heading: 'Alertas',
      lede: 'Um só feed para o que está acontecendo agora: notícias de agências e canais públicos, terremotos e avisos oficiais, cada um a um clique de onde está no mapa.',
      shows: [
        'Notícias de canais públicos do Telegram e de agências com RSS, como BBC, Guardian, Al Jazeera, TASS e Anadolu.',
        'Terremotos de magnitude 2,5 ou mais, do USGS e do EMSC.',
        'Avisos da NASA EONET, do Serviço Nacional de Meteorologia dos EUA e do GDACS.',
        'Um resumo do feed por IA, no plano Pro.',
      ],
      sources: ['Feeds RSS públicos e canais públicos.', 'Terremotos.', 'Eventos naturais e avisos.'],
      freshness: 'As agências são lidas a cada 5 minutos e os canais a cada 3.',
      limits: [
        'As fontes tomam partido; cada uma é identificada com seu viés.',
        'O lugar de uma reportagem é extraído do texto, então é aproximado.',
      ],
    },

    // Past events
    'battles-in-history': {
      title: 'Batalhas na história: 18.000+ batalhas e cercos num mapa',
      description: 'Mais de 18.000 batalhas e cercos de 3000 a.C. até hoje, cada um posicionado onde foi travado e quase todos com artigo na Wikipédia, num só mapa.',
      heading: 'Batalhas na história',
      lede: 'Mais de 18.000 batalhas e cercos, cada um posicionado onde foi travado e datado com a precisão que o registro permite. Quase todos têm um artigo na Wikipédia, e mais de 11.000 indicam a guerra da qual fizeram parte.',
      shows: [
        'Só batalhas e cercos, como marcas vermelhas de conflito; o painel da História pode trazer de volta as guerras e os massacres ao redor.',
        'O nome de cada batalha ao lado dela a partir do zoom 3.',
        'A página e o popup de uma batalha trazem a data, a guerra a que ela pertenceu e o resumo da Wikipédia.',
        'Aberto a partir desta página, o mapa reproduz as Guerras Revolucionárias Francesas e as Guerras Napoleônicas, de 1792 a 1815, sobre a Europa.',
      ],
      sources: [
        'Batalhas e cercos com data e coordenadas, e a guerra de que cada um fez parte, quando o Wikidata informa.',
        'Cerca de 300 batalhas da Primeira Guerra Mundial, tiradas das listas da Wikipédia.',
      ],
      freshness: 'Extraído do Wikidata quando o conjunto é importado; uma batalha adicionada lá depois aparece após a próxima importação.',
      limits: [
        'A cobertura acompanha os editores da Wikipédia: só França, Estados Unidos, Espanha e Itália reúnem cerca de um quarto das batalhas.',
        'Cerca de um terço está posicionado apenas numa área, não no próprio campo de batalha.',
        'As batalhas não trazem números de baixas aqui, então o mapa desenha todas do mesmo tamanho.',
        'As operações militares, as incursões e os ataques aéreos têm uma página própria.',
      ],
    },
    'wars-in-history': {
      title: 'Guerras na história: 3.600+ guerras e rebeliões num mapa',
      description: 'Guerras, guerras civis, rebeliões e conflitos armados de 2600 a.C. até hoje num só mapa, do Wikidata, do Correlates of War e do Uppsala Conflict Data Program.',
      heading: 'Guerras na história',
      lede: 'Mais de 3.600 guerras, guerras civis, rebeliões, revoltas e conflitos armados, da Idade do Bronze aos conflitos ainda em curso, cada um desenhado como uma só marca para a guerra inteira.',
      shows: [
        'Cada guerra como uma só marca, que fica no mapa enquanto a guerra dura e depois some aos poucos.',
        'Quando uma fonte conta os mortos, a marca cresce com o número.',
        'A página de uma guerra lista as batalhas que ela incluiu e todas as fontes que a registram.',
        'Aberto a partir desta página, o mapa reproduz de 1900 a 2000 em cerca de um minuto.',
      ],
      sources: [
        'Guerras, guerras civis, rebeliões e revoltas com data e lugar: a maior parte da lista, quase todas com artigo na Wikipédia.',
        'Guerras entre Estados de 1823 a 2003, com seus mortos em combate.',
        'Conflitos armados desde 1989 com suas mortes relacionadas a combates, do Uppsala Conflict Data Program.',
        'Uma compilação das guerras dos séculos XX e XXI publicada no Kaggle, com os mortos; as fontes dela não são informadas.',
      ],
      freshness: 'Cada fonte é importada como foi publicada; o UCDP acrescenta um ano por vez.',
      limits: [
        'Uma guerra é um ponto: as coordenadas que o Wikidata lhe dá, o centro das suas batalhas ou o centro dos países que a travaram. Nove em cada dez estão posicionadas apenas numa área ou num país.',
        'Quando duas fontes registram a mesma guerra, o TAKIP junta as que consegue associar; a página da guerra cita cada fonte.',
        'Só cerca de uma guerra em cada nove tem número de mortos, então a maioria é desenhada do mesmo tamanho.',
      ],
    },
    'genocides-and-massacres': {
      title: 'Genocídios e massacres na história num mapa',
      description: 'Mais de 3.800 massacres, genocídios, pogroms, expulsões e deportações registrados no Wikidata, cada um onde aconteceu, com o número de mortos quando informado.',
      heading: 'Genocídios e massacres na história',
      lede: 'Massacres, genocídios, pogroms, expulsões e deportações registrados no Wikidata, mais de 3.800 no total, cada um posicionado onde aconteceu e datado com a precisão que o registro permite, com o número de mortos quando informado.',
      shows: [
        'Cada um como uma marca de conflito dimensionada pelo número de mortos, que quase três em cada quatro registros informam.',
        'Uma página para cada um, com a data, o número de mortos e o resumo da Wikipédia.',
        'Aberto a partir desta página, o mapa reproduz de 1900 até hoje.',
      ],
      sources: [
        'Itens que são massacres, genocídios ou pogroms, com data, lugar e, na maioria, número de mortos; 95% têm artigo na Wikipédia.',
        'Cerca de 150 expulsões, deportações e deslocamentos forçados, com data e lugar.',
      ],
      freshness: 'Extraído do Wikidata quando os conjuntos são importados; um registro adicionado ou corrigido lá depois aparece após a próxima importação.',
      limits: [
        'Mais de quatro em cada cinco são de 1900 em diante: o registro acompanha aquilo sobre o que os editores da Wikipédia escreveram.',
        'Se um evento é chamado de massacre, de genocídio ou de pogrom segue a classificação do Wikidata, não a decisão de um tribunal.',
        'O número de mortos é o que o Wikidata registra, e muitos são contestados; o artigo dá o contexto.',
        'Cerca de metade está posicionada apenas numa área, não num local exato.',
      ],
    },
    'assassinations-in-history': {
      title: 'Assassinatos na história num mapa',
      description: 'Cerca de 170 assassinatos registrados no Wikidata, do século VII a 2026, cada um posicionado onde aconteceu e datado até o dia, com seu artigo na Wikipédia.',
      heading: 'Assassinatos na história',
      lede: 'Assassinatos registrados no Wikidata, posicionados onde aconteceram e datados até o dia. A maioria é dos últimos 120 anos.',
      shows: [
        'Cada assassinato como uma marca política, dimensionada pelo número de mortos quando o registro informa (cerca de dois em cada três informam).',
        'Uma página para cada um, com a data e o resumo da Wikipédia.',
        'Aberto a partir desta página, o mapa reproduz de 1850 até hoje.',
      ],
      sources: [
        'Itens que são assassinatos, com data e lugar.',
      ],
      freshness: 'Extraído do Wikidata quando o conjunto é importado; cresce junto com o Wikidata.',
      limits: [
        'Um conjunto pequeno, cerca de 170 eventos: longe de todos os assassinatos da história.',
        'Estados Unidos e Japão são os que mais têm aqui: o conjunto é o que o Wikidata registra, não uma contagem completa.',
        'Quase metade está posicionada apenas numa área, não no local exato.',
      ],
    },
    'treaties-in-history': {
      title: 'Tratados na história: 2.200 tratados num mapa',
      description: 'Cerca de 2.200 tratados do Wikidata, da Idade do Bronze até hoje, cada um posicionado onde o Wikidata o situa e datado até o dia quando se sabe, com seu artigo.',
      heading: 'Tratados na história',
      lede: 'Tratados de todo tipo registrados no Wikidata, de tratados de paz a alianças, cada um posicionado onde o Wikidata o situa e datado até o dia quando a data é conhecida.',
      shows: [
        'Cada tratado como uma marca política na sua data, todos do mesmo tamanho: um tratado não tem o que contar.',
        'Uma página para cada um, com o resumo da Wikipédia e os eventos próximos no tempo e no espaço.',
        'Aberto a partir desta página, o mapa reproduz de 1600 a 1900 sobre a Europa.',
      ],
      sources: [
        'Itens que são tratados, com data e lugar; 93% têm artigo na Wikipédia.',
      ],
      freshness: 'Extraído do Wikidata quando o conjunto é importado; um tratado adicionado lá depois aparece após a próxima importação.',
      limits: [
        'A Europa domina: só a França reúne cerca de um tratado em cada sete, e França, Estados Unidos, Alemanha e Grã-Bretanha juntos quase quatro em cada dez.',
        'Um tratado é um ponto, embora vincule países inteiros.',
        'O registro não diz quem assinou nem se o tratado foi cumprido; o artigo diz.',
        'Os acordos de paz dos conflitos desde 1990 são um conjunto à parte, do PA-X.',
      ],
    },
    'terrorist-attacks-map': {
      title: 'Mapa de atentados terroristas: 180.000 ataques desde 1970',
      description: 'Todos os ataques do Global Terrorism Database de 1970 a 2017, e outros anteriores e posteriores do Wikidata, num só mapa, com a arma e o número de mortos.',
      heading: 'Atentados terroristas no mapa',
      lede: 'Mais de 180.000 ataques do Global Terrorism Database, de 1970 a 2017, com cerca de 800 do Wikidata antes e depois desses anos.',
      shows: [
        'Ataques como marcas laranja dimensionadas pelo número de mortos, que o GTD informa para quase todos.',
        'Quando uma visualização tem mais de 2.000 ataques, eles se agrupam em bolhas com a contagem; aproxime para ver cada um.',
        'Clique num ataque para ver a arma, o alvo, se foi consumado e reivindicado, e o resumo do próprio GTD.',
        'Aberto a partir desta página, o mapa reproduz de 1970 a 2017.',
      ],
      sources: [
        'O registro de ataques do START de 1970 a 2017: lugar, armas, alvos, vítimas e um breve resumo de cada um.',
        'Cerca de 800 ataques de antes de 1970 e depois de 2017, cada um com artigo na Wikipédia.',
      ],
      freshness: 'Os dados do GTD aqui terminam em 2017; ataques posteriores vêm só do Wikidata, então os anos recentes são escassos.',
      limits: [
        'O que conta como terrorismo segue a definição do GTD: violência de atores não estatais com um objetivo político, econômico, religioso ou social.',
        'Não há 1993: o GTD perdeu seus registros daquele ano.',
        'Iraque, Paquistão, Afeganistão e Índia reúnem cerca de um terço dos ataques.',
        'Cerca de um em cada sete está posicionado apenas na cidade ou na região.',
      ],
    },
    'earthquakes-in-history': {
      title: 'Terremotos na história: 4.000 anos de sismos significativos',
      description: 'Cerca de 13.800 terremotos num só mapa: os sismos significativos da NOAA desde cerca de 2150 a.C., os da Europa de 1000 a 1899 do EPICA e os do USGS desde 2026.',
      heading: 'Terremotos na história',
      lede: 'Os terremotos mortais, destrutivos e de grande magnitude da NOAA desde cerca de 2150 a.C., os 5.300 terremotos europeus que o EPICA cataloga de 1000 a 1899 e os sismos que o TAKIP registrou do USGS desde 2026.',
      shows: [
        'Só terremotos, como marcas amarelas dimensionadas pela magnitude; o painel da História pode acrescentar os tsunamis e as erupções ao redor.',
        'Clique num terremoto para ver magnitude, profundidade, intensidade, mortos e danos quando a fonte os informa, e a incerteza do EPICA sobre o epicentro.',
        'Aberto a partir desta página, o mapa reproduz de 1900 até hoje.',
      ],
      sources: [
        'O Significant Earthquake Database: terremotos que mataram, causaram cerca de US$ 1 milhão em danos, chegaram à magnitude 7,5 ou à intensidade X, ou provocaram um tsunami.',
        'O European PreInstrumental Earthquake Catalogue, versão 1.1 (Rovida e Antonucci 2021, INGV): os terremotos da Europa de 1000 a 1899 com magnitude estimada.',
        'Os terremotos que o TAKIP registrou do feed do USGS desde que começou a gravar, em 2026.',
      ],
      freshness: 'A NOAA acrescenta terremotos conforme os revisa; o EPICA é um catálogo publicado; o registro do USGS cresce enquanto o TAKIP roda.',
      limits: [
        'Quando dois catálogos têm o mesmo terremoto (cerca de 390 dos do EPICA também estão na NOAA), ele é um só evento.',
        'A Europa antes de 1900 é muito mais completa que qualquer outro lugar, graças ao EPICA: só a Itália reúne cerca de um terremoto em cada oito.',
        'As magnitudes de antes dos instrumentos são estimadas a partir dos danos relatados; cerca de um terremoto em cada sete não tem nenhuma.',
        'Mais da metade está posicionada apenas numa área: um epicentro antigo é incerto, muitas vezes em dezenas de quilômetros.',
      ],
    },
    'volcanic-eruptions-in-history': {
      title: 'Erupções vulcânicas na história: 11.000 erupções num mapa',
      description: 'Cerca de 11.500 erupções do Global Volcanism Program do Smithsonian e da NOAA, a maioria dos últimos 12.000 anos, com o tamanho de cada uma (VEI) quando conhecido.',
      heading: 'Erupções vulcânicas na história',
      lede: 'As erupções do Volcanoes of the World do Smithsonian, a maioria nos últimos 12.000 anos, com o registro da NOAA das erupções que mataram pessoas, causaram danos ou provocaram um tsunami.',
      shows: [
        'Erupções como marcas de risco natural no vulcão, todas do mesmo tamanho: a História dimensiona os riscos pela magnitude, que as erupções não têm.',
        'Clique numa para ver o Índice de Explosividade Vulcânica (conhecido para três em cada quatro), como foi datada e o artigo da Wikipédia sobre o vulcão.',
        'Aberto a partir desta página, o mapa reproduz de 1800 até hoje.',
      ],
      sources: [
        'O Volcanoes of the World do Global Volcanism Program, versão 5.3: erupções do Holoceno com suas datas, o VEI e como foram datadas.',
        'O Significant Volcanic Eruptions Database: erupções que mataram, causaram cerca de US$ 1 milhão em danos, chegaram a VEI 6 ou vieram com um tsunami ou um grande terremoto.',
      ],
      freshness: 'O Global Volcanism Program e a NOAA revisam seus registros; o TAKIP os recebe quando os conjuntos são importados de novo.',
      limits: [
        'Antes dos registros escritos, as erupções são datadas por radiocarbono, camadas de tefra ou varves lacustres, algumas só até o século; uma em cada cinco é de antes de 1 d.C.',
        'Quando a NOAA e o Smithsonian registram a mesma erupção (cerca de 480), ela é um só evento.',
        'Japão e Indonésia reúnem quase três em cada dez das erupções.',
        'O artigo da Wikipédia costuma ser o do vulcão, não o da erupção. Os termos do Smithsonian permitem apenas uso não comercial.',
      ],
    },
    'tsunamis-in-history': {
      title: 'Tsunamis na história: 2.300 tsunamis num mapa',
      description: 'O registro da NOAA de mais de 2.300 tsunamis, do de Thera, por volta de 1610 a.C., até hoje, num só mapa, com as mortes e a maior altura da água onde foi medida.',
      heading: 'Tsunamis na história',
      lede: 'Todos os tsunamis do Global Historical Tsunami Database da NOAA, o mais antigo provocado pela erupção de Thera por volta de 1610 a.C., cada um posicionado na área da sua origem.',
      shows: [
        'Só tsunamis, como marcas de risco natural na sua origem; o painel da História pode acrescentar os terremotos e as erupções que os provocaram.',
        'Clique num para ver as mortes, a maior altura da água e o número de lugares onde a água foi medida.',
        'Aberto a partir desta página, o mapa reproduz de 1800 até hoje.',
      ],
      sources: [
        'O Global Historical Tsunami Database, com as alturas de inundação (run-up) observadas em cada evento.',
      ],
      freshness: 'A NOAA acrescenta tsunamis conforme os revisa; o TAKIP os recebe quando o conjunto é importado de novo.',
      limits: [
        'Cerca de um em cada quatro registra alguma morte.',
        'Só o Japão reúne cerca de um em cada sete.',
        'Cerca de 400 são de antes de 1800, conhecidos por relatos escritos.',
        'O artigo da Wikipédia, quando existe, costuma ser o do terremoto.',
      ],
    },
    'nuclear-tests-map': {
      title: 'Mapa de testes nucleares: todas as explosões de 1945 a 1998',
      description: 'As 2.051 explosões nucleares, do teste Trinity em 1945 aos testes do Paquistão em 1998, num mapa, teste a teste, cada uma dimensionada pela potência em quilotons.',
      heading: 'Explosões nucleares, 1945 a 1998',
      lede: 'Todas as explosões nucleares do teste Trinity, em julho de 1945, a maio de 1998, entre elas as bombas lançadas sobre Hiroshima e Nagasaki, cada uma posicionada no seu local de teste.',
      shows: [
        'Cada explosão como uma marca verde dimensionada pela potência em quilotons.',
        'Clique numa para ver o país, o local, o tipo (torre, lançamento aéreo, subterrânea e outros), a potência e a finalidade.',
        'Aberto a partir desta página, o mapa reproduz de 1945 a 1998.',
      ],
      sources: [
        'A lista de explosões nucleares compilada pelo SIPRI e pelo Instituto Nacional de Pesquisa de Defesa da Suécia (FOA), como publicada pelo TidyTuesday.',
      ],
      freshness: 'Uma lista fechada que termina em 1998, então os testes da Coreia do Norte a partir de 2006 não estão nela.',
      limits: [
        'Os Estados Unidos fizeram quase metade das explosões aqui, e a União Soviética a maior parte do resto, muitas em Semipalatinsk, no atual Cazaquistão.',
        'A licença da lista não é informada.',
      ],
    },
    'natural-disasters-since-1960': {
      title: 'Desastres naturais desde 1960: enchentes, temporais e secas',
      description: 'Cerca de 9.900 enchentes, tempestades, terremotos, deslizamentos, secas e ondas de calor e de frio de 1960 a 2018 num só mapa, do conjunto Geocoded Disasters.',
      heading: 'Desastres naturais desde 1960',
      lede: 'Os desastres do EM-DAT, a base internacional de dados de desastres, como o projeto GDIS os georreferenciou: cerca de 9.900 enchentes, tempestades, terremotos, deslizamentos, secas e extremos de temperatura de 1960 a 2018.',
      shows: [
        'Cada desastre como uma marca verde-azulada no centro dos lugares que atingiu, dimensionada por quantos lugares foram.',
        'Clique num para ver as províncias ou os distritos que ele atingiu.',
        'Aberto a partir desta página, o mapa mostra só estes desastres; fomes, epidemias, incêndios, acidentes e naufrágios têm cada um uma página própria.',
        'Aberto a partir desta página, o mapa reproduz de 1960 a 2018.',
      ],
      sources: [
        'Geocoded Disasters 1960–2018 (Rosvold e Buhaug, PRIO, via NASA SEDAC): os desastres do EM-DAT associados aos lugares que atingiram.',
      ],
      freshness: 'Um conjunto de dados publicado que termina em 2018.',
      limits: [
        'Os lugares atingidos são províncias ou distritos, então um desastre é desenhado no centro deles, não onde começou.',
        'Sem mortes nem danos: o GDIS dá os lugares, e os números do EM-DAT não fazem parte dele.',
        'Enchentes e tempestades são sete em cada dez dos eventos.',
        'Um terremoto pode aparecer duas vezes na História: como terremoto da NOAA e aqui, como os lugares que atingiu.',
      ],
    },
    'border-changes-in-history': {
      title: 'Fronteiras desde 1816: terra ganha, perdida e reivindicada',
      description: 'Territórios que passaram de um Estado a outro desde 1816, do Correlates of War, e reivindicações territoriais até 2001, do ICOW, num mapa, com quem ganhou e perdeu.',
      heading: 'Mudanças de fronteira e reivindicações territoriais',
      lede: 'Cerca de 900 vezes em que um território passou de um Estado a outro desde 1816, e cerca de 1.200 reivindicações de um Estado sobre o território de outro, cada uma posicionada no território.',
      shows: [
        'Cada mudança ou reivindicação como uma marca violeta no território; uma reivindicação fica no mapa pelo tempo em que foi sustentada.',
        'Clique numa mudança para ver o território, quem o ganhou e quem o perdeu, como (conquista, cessão, anexação e outras), sua área e sua população.',
        'Clique numa reivindicação para ver o território e quantos pares de Estados o disputaram.',
        'Aberto a partir desta página, o mapa reproduz de 1816 a 2001.',
      ],
      sources: [
        'Territorial Change, versão 6: transferências de território entre Estados de 1816 a 2015.',
        'As reivindicações territoriais entre Estados do Issue Correlates of War, de 1816 a 2001.',
        '81 anexações e ocupações na Europa de 1938 a 1945.',
      ],
      freshness: 'Conjuntos de dados publicados; mudam quando os autores lançam uma nova versão.',
      limits: [
        'Uma mudança é um ponto no território; a camada de fronteiras da História desenha as próprias fronteiras, a partir do Cliopatria.',
        'O artigo da Wikipédia costuma ser sobre o território, não sobre a mudança.',
        'As reivindicações param em 2001, e as mudanças em 2015.',
      ],
    },
    'world-heritage-in-danger': {
      title: 'Patrimônio Mundial em Perigo: a lista da UNESCO num mapa',
      description: 'Os 89 sítios na Lista do Patrimônio Mundial em Perigo da UNESCO, na edição de 2021, num só mapa, cada um no próprio local, com seu artigo da Wikipédia.',
      heading: 'Patrimônio Mundial em Perigo',
      lede: 'Os sítios da Lista do Patrimônio Mundial em Perigo da UNESCO na edição de 2021 da Lista do Patrimônio Mundial, de cidades antigas a parques nacionais.',
      shows: [
        'Cada sítio como uma marca azul no próprio local.',
        'Uma página para cada um, com o resumo da Wikipédia sobre o sítio.',
        'Aberto a partir desta página, o mapa mostra a História em 2021.',
      ],
      sources: [
        'A Lista do Patrimônio Mundial como a UNESCO a publicou em 2021, com os sítios que ela marca como em perigo.',
      ],
      freshness: 'Um retrato de 2021: sítios retirados da lista antes disso, ou incluídos depois, não estão aqui.',
      limits: [
        'Síria, República Democrática do Congo e Líbia reúnem cerca de um em cada cinco dos sítios.',
        'A lista diz que um sítio está em perigo, não por quê; o artigo e a página da UNESCO dizem.',
      ],
    },
    'military-operations': {
      title: 'Operações militares na história: incursões e ataques aéreos',
      description: 'Mais de 3.100 operações militares, incursões e ataques aéreos registrados no Wikidata, a maioria dos séculos XX e XXI, cada um posicionado onde foi travado.',
      heading: 'Operações militares',
      lede: 'Operações com nome, incursões e ataques aéreos registrados no Wikidata, da Antiguidade às guerras deste ano. Mais da metade é do século XX, e quase três em cada dez são do século XXI.',
      shows: [
        'Operações entre os eventos de conflito da História, no mesmo vermelho das batalhas e guerras.',
        'Uma página para cada uma, com a data, o resumo da Wikipédia e as batalhas e operações próximas.',
        'Aberto a partir desta página, o mapa reproduz a Segunda Guerra Mundial, de 1939 a 1945.',
      ],
      sources: [
        'Itens que são operações militares, incursões ou ataques aéreos, com data e lugar; 96% têm artigo na Wikipédia.',
      ],
      freshness: 'Extraído do Wikidata quando o conjunto é importado; operações de guerras ainda em curso aparecem conforme o Wikidata as registra.',
      limits: [
        'Duas em cada três estão posicionadas apenas numa área: uma operação abrange um território, e o Wikidata lhe dá um só ponto.',
        'Menos de uma em cada dez tem número de mortos.',
        'Ucrânia, Síria, Japão, Rússia, Vietnã e Iraque são os que mais têm, juntos cerca de um quarto.',
      ],
    },
    'missile-tests-map': {
      title: 'Mapa de testes de mísseis: 15.000 lançamentos desde 1942',
      description: 'Mais de 15.000 lançamentos de mísseis, dos testes do V-2 em 1942 até hoje, do registro de Jonathan McDowell, cada um no seu local de lançamento e com seu resultado.',
      heading: 'Lançamentos de mísseis desde 1942',
      lede: 'Lançamentos de mísseis balísticos e de outros tipos registrados pelo astrônomo Jonathan McDowell, dos testes alemães do V-2 em 1942 até este ano, cada um posicionado no local de onde foi lançado.',
      shows: [
        'Cada lançamento como uma marca âmbar no seu local de lançamento, todos do mesmo tamanho.',
        'Quando uma visualização tem mais de 2.000, eles se agrupam em bolhas com a contagem; aproxime para ver cada um.',
        'Clique num para ver o míssil, a força que o lançou, o local e se teve sucesso.',
        'Aberto a partir desta página, o mapa reproduz de 1955 a 1975.',
      ],
      sources: [
        'O General Catalog of Artificial Space Objects de Jonathan McDowell, no seu registro de lançamentos de mísseis: veículo, agência, local, apogeu e resultado.',
      ],
      freshness: 'O GCAT é atualizado à medida que os lançamentos acontecem; o TAKIP o recebe quando o conjunto é importado de novo.',
      limits: [
        'Três em cada quatro foram lançados dos Estados Unidos, da Rússia ou do Cazaquistão, onde ficavam os campos de teste da União Soviética.',
        'Não só testes: o GCAT também registra lançamentos de forças em guerra, entre eles cerca de 600 do Iêmen, pelo movimento houthi.',
        'Quase um lançamento em cada dez não tem resultado conhecido, e alguns locais são apenas os prováveis, como a fonte os marca.',
      ],
    },
    'revolutions-in-history': {
      title: 'Revoluções na história num mapa',
      description: 'Cerca de 130 revoluções registradas no Wikidata, da Antiguidade a 2025, a maioria nos séculos XIX e XX, cada uma com seu artigo na Wikipédia, num só mapa.',
      heading: 'Revoluções na história',
      lede: 'Revoluções registradas no Wikidata, da Antiguidade a esta década. Quatro em cada cinco caem nos séculos XIX e XX.',
      shows: [
        'Cada revolução como uma marca política rosa que fica no mapa enquanto dura.',
        'Uma página para cada uma, com as datas e o resumo da Wikipédia.',
        'Aberto a partir desta página, o mapa reproduz de 1789 a 1922.',
      ],
      sources: [
        'Itens que são revoluções, com data e lugar; quase todos têm artigo na Wikipédia.',
      ],
      freshness: 'Extraído do Wikidata quando o conjunto é importado; cresce junto com o Wikidata.',
      limits: [
        'Um conjunto pequeno: o que o Wikidata classifica como revolução, não toda convulsão chamada assim.',
        'Quase todas estão posicionadas numa área ou num país, não num ponto exato.',
        'Nenhum país tem mais do que cerca de uma em cada vinte delas.',
      ],
    },
    'coups-in-history': {
      title: 'Golpes de Estado desde 1945: êxitos, fracassos e tramas',
      description: 'Cerca de 1.400 golpes, tentativas fracassadas e conspirações num só mapa, do Cline Center desde 1945 e do Wikidata para os mais antigos, com o desfecho de cada um.',
      heading: 'Golpes de Estado',
      lede: 'Golpes que deram certo, tentativas que fracassaram e conspirações detidas antes de começar: o registro do Cline Center desde 1945, com os golpes que o Wikidata conhece de séculos anteriores.',
      shows: [
        'Golpes bem-sucedidos, tentativas fracassadas e conspirações como três tipos de evento político, cada um nomeado assim no popup e na página.',
        'Clique num para ver quem o executou (os militares, dissidentes, a elite governante, apoiadores estrangeiros e outros) e o que aconteceu com o líder, quando o Cline Center os codifica.',
        'Aberto a partir desta página, o mapa reproduz de 1945 até hoje.',
      ],
      sources: [
        'O Coup d’État Project, versão 2.2.2, da Universidade de Illinois: golpes, tentativas e conspirações desde 1945, por país.',
        'Cerca de 480 golpes com data e lugar, muitos de antes de 1945.',
      ],
      freshness: 'O Cline Center publica novas versões; os do Wikidata crescem junto com o próprio Wikidata. Os dois são extraídos quando importados.',
      limits: [
        'O Cline Center posiciona um golpe na capital do país na época, então dois em cada três são desenhados numa capital, não onde as tropas se moveram.',
        'Quando o Cline Center e o Wikidata registram o mesmo golpe (cerca de 200), eles são um só evento.',
        'Bolívia e Argentina são os que mais têm aqui.',
      ],
    },
    'peace-agreements': {
      title: 'Acordos de paz desde 1990 num mapa',
      description: 'Cerca de 2.200 acordos de paz assinados desde 1990, da base PA-X: primeiras negociações, cessar-fogos e acordos finais, cada um posicionado no conflito de que trata.',
      heading: 'Acordos de paz desde 1990',
      lede: 'Todos os acordos do PA-X Peace Agreements Database: cessar-fogos, acordos-quadro, textos de pré-negociação e acordos de implementação assinados para encerrar ou administrar conflitos desde 1990.',
      shows: [
        'Cada acordo como uma marca política no dia em que foi assinado, no centro do conflito de que trata.',
        'Clique num para ver o processo de paz, a fase, se o conflito era dentro de um Estado ou entre Estados, e como foi assinado.',
        'Aberto a partir desta página, o mapa reproduz de 1990 a 2025.',
      ],
      sources: [
        'O PA-X Peace Agreements Database, versão 10, do PeaceRep, na Universidade de Edimburgo; seus termos permitem apenas uso não comercial (CC BY-NC-SA 4.0).',
      ],
      freshness: 'O PeaceRep lança novas versões do PA-X; o TAKIP as recebe quando o conjunto é importado de novo.',
      limits: [
        'Um acordo é posicionado no seu conflito, não onde foi assinado: um acordo assinado no exterior ainda aparece no país em guerra.',
        'Dois em cada três tratam de conflitos dentro de um Estado; um sexto são acordos locais.',
        'Colômbia, Filipinas, Bósnia e Herzegovina e Sudão são os que mais têm aqui, juntos cerca de três em cada dez.',
      ],
    },
    'riots-protests-and-strikes': {
      title: 'Tumultos, protestos e greves num mapa: 18.000 eventos',
      description: 'Cerca de 14.800 protestos contra governos de 1990 a 2020, do Mass Mobilization Project, com tumultos, protestos e greves do Wikidata, num só mapa.',
      heading: 'Tumultos, protestos e greves',
      lede: 'Protestos contra governos em 166 países de 1990 a 2020, como o Mass Mobilization Project os registra, e cerca de 3.400 tumultos, protestos e greves do Wikidata ao longo dos séculos.',
      shows: [
        'Protestos, tumultos e greves como três tipos de evento político; quando uma visualização tem mais de 2.000, eles se agrupam em bolhas com a contagem.',
        'Clique num protesto para ver o tamanho, o que os manifestantes exigiam e como o Estado respondeu, quando o Mass Mobilization Project os codifica.',
        'Aberto a partir desta página, o mapa reproduz de 1990 a 2020.',
      ],
      sources: [
        'Versão 5.1, de David Clark e Patrick Regan: protestos de 50 pessoas ou mais contra governos, de 1990 a 2020, a partir de reportagens de jornais.',
        'Tumultos, protestos e greves com data e lugar, quase todos com artigo na Wikipédia.',
      ],
      freshness: 'O Mass Mobilization Project termina em março de 2020; eventos posteriores vêm só do Wikidata.',
      limits: [
        'O Mass Mobilization Project deixa de fora os Estados Unidos, então os protestos americanos aqui são só os que o Wikidata tem.',
        'A maioria dos protestos está posicionada na sua cidade; cerca de um em cada sete, apenas no país.',
        'Mais da metade foi ignorada pelo Estado, segundo a codificação das reportagens; cerca de um em cada doze foi recebido com tiros ou mortes.',
      ],
    },
    'murders-and-shootings': {
      title: 'Homicídios e tiroteios na história num mapa',
      description: 'Cerca de 3.600 homicídios e tiroteios que têm artigo na Wikipédia, do século VIII a 2026, num só mapa, com o número de mortos quando registrado.',
      heading: 'Homicídios e tiroteios',
      lede: 'Homicídios e tiroteios registrados no Wikidata, quase todos com artigo na Wikipédia: os casos sobre os quais se escreveu, não uma estatística criminal.',
      shows: [
        'Cada um como uma marca verde-azulada dimensionada pelo número de mortos, que quase metade dos registros informa.',
        'Uma página para cada um, com a data e o resumo da Wikipédia.',
        'Aberto a partir desta página, o mapa reproduz de 1960 até hoje.',
      ],
      sources: [
        'Itens que são homicídios ou tiroteios, com data e lugar; 98% têm artigo na Wikipédia.',
      ],
      freshness: 'Extraído do Wikidata quando o conjunto é importado; um caso adicionado lá depois aparece após a próxima importação.',
      limits: [
        'Só casos com artigo: o registro acompanha a imprensa e os editores da Wikipédia, não os números da polícia.',
        'Os Estados Unidos reúnem cerca de um terço deles, e Grã-Bretanha e Japão juntos cerca de um em cada seis.',
        'Cerca de um em cada cinco está posicionado apenas num distrito ou num país, alguns pelo lugar que a descrição do item cita quando o Wikidata não dá um ponto.',
      ],
    },
    'transatlantic-slave-trade': {
      title: 'O tráfico transatlântico de escravos num mapa',
      description: 'Cerca de 45.000 viagens do tráfico de escravos de 1514 a 1866, do SlaveVoyages, cada uma no seu principal porto de compra e dimensionada pelas pessoas embarcadas.',
      heading: 'O tráfico transatlântico de escravos',
      lede: 'As viagens registradas pelo SlaveVoyages: cerca de 34.000 através do Atlântico, da África para as Américas, e cerca de 10.600 dentro das Américas, de 1514 a 1866.',
      shows: [
        'Cada viagem é um ponto no seu principal porto de compra, dimensionado pelas pessoas embarcadas, como as bases o registram ou estimam; onde registram os portos, uma linha leva a sua rota até onde as pessoas foram desembarcadas.',
        'Quando uma visualização tem mais de 2.000 viagens, elas se agrupam em bolhas com a contagem; aproxime para ver cada uma.',
        'Clique numa viagem para ver o navio, sua bandeira e seu capitão, a rota, as pessoas embarcadas e desembarcadas e como a viagem terminou.',
        'Aberto a partir desta página, o mapa reproduz de 1700 a 1866.',
      ],
      sources: [
        'O Trans-Atlantic Slave Trade Database (2019): cerca de 34.000 viagens da África para as Américas.',
        'O Intra-American Slave Trade Database (1.0): cerca de 10.600 viagens entre portos das Américas.',
      ],
      freshness: 'Bases de dados publicadas; o SlaveVoyages acrescenta viagens conforme a pesquisa as encontra, e o TAKIP recebe uma nova edição quando ela é importada.',
      limits: [
        'Cerca de 7.900 viagens dizem apenas “África, porto não especificado”: elas são desenhadas no único ponto que a base dá para isso, não num porto real.',
        'Muitas outras citam apenas uma região, como a Costa do Ouro ou a África Centro-Ocidental, e são desenhadas no ponto dela.',
        'Os números de embarcados são em parte estimativas das bases; seus dados históricos são de domínio público, e as estimativas, CC BY-NC 3.0.',
      ],
    },
    'tropical-cyclones': {
      title: 'Ciclones tropicais desde 1842: 13.000 tempestades num mapa',
      description: 'Mais de 13.000 furacões, tufões e ciclones de 1842 até hoje, do IBTrACS, cada um desenhado ao longo da sua trajetória, com um ponto onde os ventos chegaram ao pico.',
      heading: 'Ciclones tropicais desde 1842',
      lede: 'Todas as tempestades do IBTrACS, a coleção mundial de trajetórias de ciclones tropicais, de 1842 a esta temporada, em todas as bacias oceânicas, cada uma desenhada ao longo da sua trajetória.',
      shows: [
        'A trajetória de cada tempestade como uma linha fina, com um ponto de risco natural onde os ventos foram mais fortes.',
        'Clique numa para ver o vento máximo, a categoria, a bacia e o momento do pico.',
        'Aberto a partir desta página, o mapa reproduz de 2000 a 2025.',
      ],
      sources: [
        'O International Best Track Archive for Climate Stewardship da NOAA NCEI, versão 4.01: as trajetórias das agências de previsão do mundo, combinadas.',
      ],
      freshness: 'O IBTrACS acrescenta tempestades conforme as agências finalizam suas melhores trajetórias; o TAKIP as recebe quando o conjunto é importado de novo.',
      limits: [
        'O ponto marca onde a tempestade chegou ao pico, muitas vezes longe no mar; a linha mostra todo o seu caminho, incluindo a chegada à terra.',
        'As categorias são a escala Saffir–Simpson sobre os ventos de um minuto das agências dos EUA; tempestades sem esses ventos (cerca de metade) não têm categoria.',
        'O Pacífico Norte Ocidental reúne quase um terço das tempestades; antes de os satélites vigiarem os oceanos, tempestades fracas longe de navios e de terra muitas vezes passavam despercebidas.',
      ],
    },
    'fireballs-map': {
      title: 'Mapa de bólidos: meteoros que explodiram no céu desde 1988',
      description: 'Cerca de 900 bólidos, meteoros que explodiram na atmosfera, registrados pelo CNEOS da NASA desde 1988, entre eles o de Chelyabinsk em 2013, cada um com sua energia.',
      heading: 'Bólidos desde 1988',
      lede: 'Meteoros brilhantes que se desintegraram na atmosfera, como o Center for Near Earth Object Studies da NASA os lista desde 1988, cada um posicionado onde foi visto explodir.',
      shows: [
        'Cada bólido como uma marca de risco natural onde explodiu, todos do mesmo tamanho.',
        'Clique num para ver a energia de impacto em quilotons, a energia irradiada, a altitude e a velocidade.',
        'Aberto a partir desta página, o mapa reproduz de 1988 até hoje.',
      ],
      sources: [
        'O Center for Near Earth Object Studies do JPL da NASA: relatos de bolas de fogo e bólidos captados por sensores do governo dos EUA.',
      ],
      freshness: 'O CNEOS acrescenta bólidos conforme são relatados, muitas vezes semanas depois; o TAKIP os recebe quando o conjunto é importado de novo.',
      limits: [
        'Só os bólidos que os sensores captaram e que o CNEOS lista com um lugar; a maioria dos meteoros é muito menor.',
        'Cerca de metade explodiu sobre o mar ou longe de qualquer cidade.',
        'O maior, de longe, é o de Chelyabinsk, em fevereiro de 2013, com cerca de 440 quilotons; cerca de um em cada oito chega a um quiloton.',
      ],
    },
    'famines-in-history': {
      title: 'Fomes na história num mapa',
      description: 'As fomes que têm artigo na Wikipédia, da fome de Yōwa no Japão, em 1181, até esta década, num só mapa: 67 delas, cada uma posicionada onde atingiu.',
      heading: 'Fomes na história',
      lede: 'Fomes registradas no Wikidata, todas com artigo na Wikipédia: do Japão medieval e da Grande Fome europeia de 1315 ao Sudão e a Gaza nesta década.',
      shows: [
        'Cada fome como uma marca de desastre verde-azulada que fica no mapa enquanto dura.',
        'Uma página para cada uma, com as datas e o resumo da Wikipédia.',
        'Aberto a partir desta página, o mapa reproduz de 1700 até hoje.',
      ],
      sources: [
        'Itens que são fomes, com data e lugar.',
      ],
      freshness: 'Extraído do Wikidata quando o conjunto é importado; cresce junto com o Wikidata.',
      limits: [
        'Um conjunto pequeno, de 67, longe de todas as fomes, e sem número de mortos; o artigo dá esse número.',
        'Mais da metade está posicionada apenas num país.',
        'O Japão reúne cerca de uma em cada seis, muitas delas fomes do período Edo.',
      ],
    },
    'epidemics-and-plague': {
      title: 'Peste e epidemias na história: 7.000 surtos',
      description: 'Cerca de 6.800 surtos de peste em cidades europeias de 1347 a 1900, da lista de Biraben, e cerca de 400 epidemias do Wikidata, de 430 a.C. até hoje.',
      heading: 'Peste e epidemias',
      lede: 'Os surtos de peste que Jean-Noël Biraben listou cidade por cidade, da Peste Negra em 1347 a 1900, e as epidemias do Wikidata, da peste de Atenas a esta década.',
      shows: [
        'Cada surto como uma marca de desastre verde-azulada na sua cidade, no ano em que ocorreu; quando uma visualização tem mais de 2.000, eles se agrupam em bolhas com a contagem.',
        'Uma página para cada epidemia com artigo, com o resumo da Wikipédia.',
        'Aberto a partir desta página, o mapa reproduz os anos da peste, de 1347 a 1720, sobre a Europa.',
      ],
      sources: [
        'A lista de surtos de peste de Biraben (1975–76), digitalizada por Büntgen e colegas no WSL: um surto por cidade e ano.',
        'Itens que são epidemias ou pandemias, com data e lugar; a maioria tem artigo na Wikipédia.',
      ],
      freshness: 'A lista da peste é fechada; as epidemias do Wikidata são extraídas quando o conjunto é importado.',
      limits: [
        'Os surtos de peste cobrem apenas a Europa e as margens do Mediterrâneo, e só as cidades para as quais Biraben encontrou registros.',
        'A França está sobrerrepresentada, com quase quatro em cada dez surtos; a Grã-Bretanha tem cerca de um em cada seis.',
        'Um surto é datado pelo ano, e uma cidade conta uma vez por ano, por mais que ele tenha durado.',
        'Nenhum dos dois conjuntos traz número de mortos.',
      ],
    },
    'fires-in-history': {
      title: 'Grandes incêndios e incêndios florestais na história',
      description: 'Cerca de 2.000 incêndios urbanos, prediais e florestais registrados no Wikidata, do Grande Incêndio de Roma em 64 d.C. aos deste ano, cada um onde queimou.',
      heading: 'Incêndios e incêndios florestais',
      lede: 'Cerca de 1.160 incêndios em cidades e edifícios e cerca de 860 incêndios florestais registrados no Wikidata. Seis em cada dez são deste século.',
      shows: [
        'Cada incêndio como uma marca de desastre verde-azulada onde queimou; um incêndio florestal que o Wikidata situa em várias áreas é desenhado no centro delas.',
        'Uma página para cada um, com as datas, as mortes quando o Wikidata as informa e o resumo da Wikipédia.',
        'Aberto a partir desta página, o mapa reproduz de 1990 até hoje.',
      ],
      sources: [
        'Itens que são incêndios ou incêndios florestais, com data e lugar; 85% têm artigo na Wikipédia.',
      ],
      freshness: 'Extraído do Wikidata quando o conjunto é importado; um incêndio adicionado lá depois aparece após a próxima importação.',
      limits: [
        'Os Estados Unidos reúnem mais de um terço deles, a maioria incêndios florestais.',
        'Cerca de quatro em cada dez estão posicionados apenas numa área.',
        'As mortes são informadas para cerca de um quarto; o mapa desenha todos os incêndios do mesmo tamanho.',
      ],
    },
    'plane-crashes': {
      title: 'Acidentes aéreos na história: 2.800+ desastres num mapa',
      description: 'Cerca de 2.900 desastres aéreos registrados no Wikidata, de um acidente de balão em 1819 às quedas deste ano, cada um posicionado onde aconteceu, com as mortes.',
      heading: 'Quedas de aviões e desastres aéreos',
      lede: 'Quedas, colisões no ar e outros desastres aéreos registrados no Wikidata, quase todos com artigo na Wikipédia. Dois terços são do século XX.',
      shows: [
        'Cada queda como uma marca de desastre verde-azulada onde aconteceu.',
        'Uma página para cada uma, com a data, as mortes e os feridos quando o Wikidata os informa, e o resumo da Wikipédia.',
        'Aberto a partir desta página, o mapa reproduz de 1950 até hoje.',
      ],
      sources: [
        'Itens que são acidentes ou incidentes aeronáuticos, com data e lugar; 96% têm artigo na Wikipédia.',
      ],
      freshness: 'Extraído do Wikidata quando o conjunto é importado; uma queda adicionada lá depois aparece após a próxima importação.',
      limits: [
        'Só as quedas sobre as quais alguém escreveu: Estados Unidos e Rússia reúnem quase três em cada dez.',
        'Cerca de três em cada dez estão posicionadas apenas numa área.',
        'As mortes são informadas para cerca de quatro em cada cinco; o mapa desenha todas as quedas do mesmo tamanho.',
      ],
    },
    'rail-accidents': {
      title: 'Acidentes ferroviários na história: 1.800 desastres num mapa',
      description: 'Cerca de 1.800 colisões de trens, descarrilamentos e outros acidentes ferroviários registrados no Wikidata, de 1815 até hoje, cada um onde aconteceu, com as mortes.',
      heading: 'Acidentes ferroviários',
      lede: 'Colisões, descarrilamentos e outros acidentes ferroviários registrados no Wikidata, dos primeiros tempos do vapor até este ano, quase todos com artigo na Wikipédia.',
      shows: [
        'Cada acidente como uma marca de desastre verde-azulada onde aconteceu.',
        'Uma página para cada um, com a data, as mortes e os feridos quando o Wikidata os informa, e o resumo da Wikipédia.',
        'Aberto a partir desta página, o mapa reproduz de 1850 até hoje.',
      ],
      sources: [
        'Itens que são acidentes ferroviários, com data e lugar; 96% têm artigo na Wikipédia.',
      ],
      freshness: 'Extraído do Wikidata quando o conjunto é importado; um acidente adicionado lá depois aparece após a próxima importação.',
      limits: [
        'Estados Unidos, Grã-Bretanha e Alemanha reúnem cerca de um terço deles.',
        'Cerca de três em cada dez estão posicionados apenas numa área.',
        'As mortes são informadas para quase nove em cada dez; o mapa desenha todos os acidentes do mesmo tamanho.',
      ],
    },
    'accidents-in-history': {
      title: 'Acidentes em minas, indústrias e estradas na história',
      description: 'Cerca de 1.250 acidentes viários, explosões, desastres em minas, acidentes industriais e esmagamentos em multidões do Wikidata, cada um onde ocorreu, com as mortes.',
      heading: 'Acidentes: estradas, minas, explosões e multidões',
      lede: 'Acidentes com artigo na Wikipédia que não envolvem aviões nem trens: cerca de 390 acidentes viários, 380 explosões, 270 desastres em minas, 120 acidentes industriais e 100 esmagamentos em multidões.',
      shows: [
        'Cada acidente como uma marca de desastre verde-azulada onde aconteceu, com o tipo nomeado no popup e na página.',
        'Uma página para cada um, com a data, as mortes e os feridos quando o Wikidata os informa, e o resumo da Wikipédia.',
        'Aberto a partir desta página, o mapa reproduz de 1900 até hoje.',
      ],
      sources: [
        'Itens que são acidentes viários, de mineração ou industriais, explosões ou esmagamentos em multidões, com data e lugar; 90% têm artigo na Wikipédia.',
      ],
      freshness: 'Extraído do Wikidata quando o conjunto é importado; um acidente adicionado lá depois aparece após a próxima importação.',
      limits: [
        'Mais da metade é deste século.',
        'As mortes são informadas para cerca de seis em cada dez; o mapa desenha todos os acidentes do mesmo tamanho.',
        'Cerca de um terço está posicionado apenas numa área.',
      ],
    },
    'ancient-shipwrecks': {
      title: 'Naufrágios antigos do Mediterrâneo num mapa',
      description: 'Cerca de 1.500 naufrágios antigos e medievais encontrados ao redor do Mediterrâneo, de cerca de 2500 a.C. a 1500 d.C., da base do Oxford Roman Economy Project.',
      heading: 'Naufrágios antigos',
      lede: 'Os naufrágios do Shipwrecks Database do Oxford Roman Economy Project: navios perdidos no Mediterrâneo e em mares próximos da Idade do Bronze a 1500, metade deles antes de 1 d.C.',
      shows: [
        'Cada naufrágio como uma marca de desastre verde-azulada vazada, perto de onde está.',
        'Clique num para ver como a base o data, seu período, sua carga e a região onde foi encontrado, quando registrados.',
        'Aberto a partir desta página, o mapa reproduz de 300 a.C. a 300 d.C.',
      ],
      sources: [
        'O Shipwrecks Database, versão 2.1 (Strauss, Wilson e Flohr 2017), baseado no catálogo de naufrágios antigos de A. J. Parker.',
      ],
      freshness: 'Uma base de dados publicada; só muda com uma nova versão.',
      limits: [
        'As posições são borradas de propósito, para proteger os naufrágios de saqueadores.',
        'Um naufrágio é datado pelos achados, muitas vezes só num intervalo de um século ou mais, e o mapa o mostra durante todo esse intervalo.',
        'Itália e França reúnem quase seis em cada dez.',
        'A licença da base de dados não é informada.',
      ],
    },
    'rocket-launch-history': {
      title: 'Histórico de foguetes: todo lançamento desde 1945 num mapa',
      description: 'Cerca de 7.400 lançamentos orbitais, do Sputnik em 1957 até hoje, e 52.000 foguetes suborbitais desde 1945, do registro de Jonathan McDowell, cada um no seu local.',
      heading: 'Lançamentos de foguetes desde 1945',
      lede: 'Todos os lançamentos orbitais desde o Sputnik, em outubro de 1957, e todos os foguetes suborbitais desde 1945, de foguetes de sondagem que estudam o tempo a testes de novos lançadores, cada um no local de onde subiu.',
      shows: [
        'Lançamentos orbitais e suborbitais como dois tipos de evento espacial num só verde, nos seus locais de lançamento; quando uma visualização tem mais de 2.000, eles se agrupam em bolhas com a contagem.',
        'Clique num para ver o foguete, a carga útil, a agência, a plataforma e se teve sucesso.',
        'Aberto a partir desta página, o mapa reproduz de 1957 até hoje.',
      ],
      sources: [
        'O General Catalog of Artificial Space Objects de Jonathan McDowell, nos seus registros de lançamentos orbitais e suborbitais: veículo, carga útil, agência, local, apogeu e resultado.',
      ],
      freshness: 'O GCAT é atualizado à medida que os lançamentos acontecem; o TAKIP o recebe quando o conjunto é importado de novo. A página ao vivo dos próximos lançamentos é separada.',
      limits: [
        'Quase nove em cada dez lançamentos aqui são suborbitais, e metade deles são foguetes meteorológicos.',
        'Cerca de um terço está posicionado na própria plataforma, e a maior parte do resto no local de lançamento.',
        'Cerca de 7% dos lançamentos orbitais falharam, total ou parcialmente; um voo suborbital em cada seis não tem resultado conhecido.',
        'Os lançamentos de mísseis têm uma página própria.',
      ],
    },
  },
};

export default copy;
