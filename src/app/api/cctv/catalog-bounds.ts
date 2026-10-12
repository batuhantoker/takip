import { ALL_FEEDS } from './catalog-registry';

// Determine which regions to fetch based on viewport bounds
export function getRegionsForBounds(lat: number, lng: number, radius: number): string[] {
  const regions: string[] = [];
  // UK
  if (lat > 49 && lat < 61 && lng > -8 && lng < 2) regions.push('uk');
  // US-East
  if (lat > 24 && lat < 49 && lng > -85 && lng < -66) regions.push('us-east');
  // US-West
  if (lat > 24 && lat < 49 && lng > -125 && lng < -100) regions.push('us-west');
  // Utah (UDOT) — explicit, since us-west only covers WA + CA
  if (lat > 36.9 && lat < 42.1 && lng > -114.2 && lng < -108.9) regions.push('utah');
  // Oregon (ODOT) — explicit, since us-west only covers WA + CA
  if (lat > 41.9 && lat < 46.3 && lng > -124.6 && lng < -116.4) regions.push('oregon');
  // Nevada (NDOT) — explicit, since us-west only covers WA + CA
  if (lat > 34.9 && lat < 42.1 && lng > -120.1 && lng < -113.9) regions.push('nevada');
  // Texas (TxDOT), including El Paso west of the central region.
  if (lat > 25.8 && lat < 36.6 && lng > -106.7 && lng < -93.4) regions.push('texas');
  // US-Central
  if (lat > 24 && lat < 49 && lng > -105 && lng < -80) regions.push('us-central');
  // Michigan (MDOT) — explicit, since us-central only covers Illinois
  if (lat > 41.6 && lat < 48.3 && lng > -90.5 && lng < -82.1) regions.push('michigan');
  // Indiana (INDOT TrafficWise) — explicit, since us-central only covers Illinois
  if (lat > 37.7 && lat < 41.9 && lng > -88.2 && lng < -84.6) regions.push('indiana');
  // Kentucky (KYTC) — explicit, since us-central only covers Illinois
  if (lat > 36.4 && lat < 39.2 && lng > -89.6 && lng < -81.9) regions.push('kentucky');
  if (lat > 40.47 && lat < 40.95 && lng > -74.28 && lng < -73.68) regions.push('nyc');
  // Louisiana (LADOTD 511) — explicit, since neither us-central nor us-east reaches the Gulf coast
  if (lat > 28.8 && lat < 33.1 && lng > -94.2 && lng < -88.6) regions.push('louisiana');
  /* The rest of the southern tier, all on the same IBI 511 stack. Each is
     listed explicitly for the same reason Louisiana is: the broad us-east and
     us-central boxes cover the latitudes but carry none of these agencies. */
  if (lat > 24.4 && lat < 31.1 && lng > -87.7 && lng < -79.9) regions.push('florida');
  if (lat > 30.3 && lat < 35.1 && lng > -85.7 && lng < -80.8) regions.push('georgia');
  if (lat > 33.8 && lat < 36.6 && lng > -84.4 && lng < -75.4) regions.push('northcarolina');
  if (lat > 31.3 && lat < 37.1 && lng > -115.0 && lng < -109.0) regions.push('arizona');
  for (const { region, bounds: b } of ALL_FEEDS) {
    if (lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng) regions.push(region);
  }
  // Canada
  if (lat > 42 && lat < 70 && lng > -141 && lng < -52) regions.push('canada');
  if (lat > 53.3 && lat < 53.8 && lng > -114.0 && lng < -113.2) regions.push('edmonton');
  // Europe
  const inBulgaria = lat > 41 && lat < 44.5 && lng > 22 && lng < 29.5;
  const inGreece = lat > 34.5 && lat < 41.8 && lng > 19 && lng < 30;
  const inSerbia = lat > 42 && lat < 46.5 && lng > 18.8 && lng < 23.3;
  const inMacedonia = lat > 40.8 && lat < 42.8 && lng > 20.4 && lng < 23.2;
  const inRomania = lat > 43.5 && lat < 48.5 && lng > 20 && lng < 29.8;
  const inTurkey = lat > 35.5 && lat < 42.5 && lng > 25.5 && lng < 45;
  const inItaly = lat > 36 && lat < 47.5 && lng > 6.5 && lng < 18.5;
  const inCzechia = lat > 48.5 && lat < 51.1 && lng > 12 && lng < 18.9;
  const inSlovakia = lat > 47.7 && lat < 49.6 && lng > 16.8 && lng < 22.6;
  const inGermany = lat > 47 && lat < 55.1 && lng > 5.8 && lng < 15.1;
  const inFrance = lat > 42.3 && lat < 51.1 && lng > -5 && lng < 8.3;
  const inSpain = lat > 27 && lat < 43.8 && lng > -18.2 && lng < 4.4;
  const inPoland = lat > 49.0 && lat < 55.0 && lng > 14.1 && lng < 24.1;
  const inFinland = lat > 59.5 && lat < 70.1 && lng > 20 && lng < 31.6;
  const inLithuania = lat > 53.8 && lat < 56.5 && lng > 20.9 && lng < 26.9;
  const inIceland = lat > 63.0 && lat < 67.0 && lng > -25.0 && lng < -13.0;
  const inBalkans = inBulgaria || inGreece || inSerbia || inMacedonia || inRomania || inTurkey;
  const inWesternEurope = inItaly || inCzechia || inSlovakia || inGermany || inFrance || inSpain || inPoland || inFinland || inIceland || inLithuania;

  if (lat > 35 && lat < 72 && lng > -11 && lng < 40 && !inBalkans && !inWesternEurope) {
    regions.push('europe');
  }
  if (inBulgaria) regions.push('bulgaria');
  if (inGreece) regions.push('greece');
  if (inSerbia) regions.push('serbia');
  if (inMacedonia) regions.push('macedonia');
  if (inRomania) regions.push('romania');
  if (inTurkey) regions.push('turkey');
  if (inItaly) regions.push('italy');
  if (inCzechia) regions.push('czechia');
  if (inSlovakia) regions.push('slovakia');
  if (inGermany) regions.push('germany');
  if (inFrance) regions.push('france');
  if (inSpain) regions.push('spain');
  if (inPoland) regions.push('poland');
  if (inFinland) regions.push('finland');
  /* Not folded into inWesternEurope: Sweden's box overlaps Norway, and
     the broad 'europe' region must still load there. */
  if (lat > 55.0 && lat < 69.2 && lng > 10.5 && lng < 24.3) regions.push('sweden');
  if (inIceland) regions.push('iceland');
  if (inLithuania) regions.push('lithuania');

  // Middle East
  const inMiddleEast = lat > 29 && lat < 34.5 && lng > 34 && lng < 36.5;
  if (inMiddleEast) regions.push('middle-east');

  // Japan
  if (lat > 24 && lat < 46 && lng > 122 && lng < 154) regions.push('japan');

  // Hong Kong
  if (lat > 22.1 && lat < 22.6 && lng > 113.8 && lng < 114.4) regions.push('hongkong');

  // Taiwan
  if (lat > 21.9 && lat < 25.3 && lng > 119.5 && lng < 122.1) regions.push('taiwan');

  // Thailand — mainland through the Gulf islands
  if (lat > 5.5 && lat < 20.5 && lng > 97.3 && lng < 105.7) regions.push('thailand');

  // Asia live webcams — spans West Asia (Turkey / Levant / Gulf) through Japan and Indonesia
  if (lat > -11 && lat < 46 && lng > 25 && lng < 155) regions.push('asia-live');

  // Asia (includes Middle East, SE Asia, overriding parts of china but that's ok they can both load)
  if ((lat > -10 && lat < 60 && lng > 60 && lng < 150)) regions.push('asia');
  // OpenCCTV across Asia — the countries with no open traffic-authority index
  // of their own. Split so a viewport over Jakarta does not also pay for Japan.
  if (lat > 18 && lat < 46 && lng > 73.5 && lng < 146) regions.push('eastasia');
  if (lat > -11 && lat < 24 && lng > 92 && lng < 130) regions.push('seasia');
  if (lat > 5 && lat < 56 && lng > 25 && lng < 92) regions.push('westasia');
  // Australia explicitly
  if (lat > -45 && lat < -10 && lng > 110 && lng < 155) regions.push('asia');
  // New Zealand (NZTA)
  if (lat > -47.5 && lat < -34 && lng > 166 && lng < 179) regions.push('newzealand');

  // Live webcams for regions with no traffic-authority feed of their own
  // Latin America + Caribbean (incl. Bermuda at 32.3N)
  if (lat > -56 && lat < 33 && lng > -119 && lng < -34) regions.push('latam-live');
  // Africa (Cape Verde in the west through Seychelles in the east)
  if (lat > -35 && lat < 36 && lng > -26 && lng < 57) regions.push('africa-live');
  // European gaps (Azores in the west through northern Norway)
  if (lat > 35 && lat < 72 && lng > -32 && lng < 32) regions.push('europe-live');

  /* Public webcams. The Dutch box is the one netherlands.ts filters on; the other
     three are drawn round what those arrays actually hold, Canaries and Nordkapp
     included, rather than round the continents in the abstract. */
  if (lat > 50.7 && lat < 53.7 && lng > 3.3 && lng < 7.3) regions.push('public-webcams-nl');
  if (lat > 27 && lat < 72 && lng > -18 && lng < 31) regions.push('public-webcams-europe');
  if (lat > 11 && lat < 52 && lng > -124 && lng < -59) regions.push('public-webcams-americas');
  if (lat > -35 && lat < 62 && lng > 30 && lng < 152) regions.push('public-webcams-rest');

  return regions.length > 0 ? regions : ['uk', 'us-east']; // Default fallback
}
