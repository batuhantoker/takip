/**
 * TAKIP — 3D models of the craft in the Horizons fleet, by Horizons ID. All are NASA's own
 * (NASA Science 3D Resources and the nasa/NASA-3D-Resources repository): free to use, credit as given.
 * assets.science.nasa.gov sends `Access-Control-Allow-Origin: *`, so those load remotely; the two
 * that exist only in the GitHub repository are copied under /data/models/.
 * Most files need KHR_draco_mesh_compression: GLTFLoader must have a DRACOLoader set.
 */

export interface CraftModel {
  /** Remote URL (cross-origin loadable) or a path under /data/models/. */
  url: string;
  credit: string;
  source: string;
  /** Longest dimension of the real craft in metres (look it up), for scaling. */
  sizeM: number;
  /** The model's longest dimension in its own units, so sizeM / modelSize scales it to metres. */
  modelSize: number;
  /** High-gain antenna boresight in the model's frame, when known: deep-space craft point it at Earth. */
  hga?: [number, number, number];
  /** The model's up axis if not +Y. */
  up?: [number, number, number];
  bytes: number;
}

const CDS = 'https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/model';
const PSD = 'https://assets.science.nasa.gov/content/dam/science/psd';
const PAGE = 'https://science.nasa.gov/3d-resources';
const RESOURCE = 'https://science.nasa.gov/resource';
const GITHUB = 'https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models';
const VTAD = 'NASA Visualization Technology Applications and Development (VTAD)';
const EYES = 'NASA/JPL/Eyes on the Solar System';
const KUMANCHIK_LOPEZ = 'NASA/Brian E. Kumanchik; NASA/Christian A. Lopez';

// sizeM is the span the model shows, scaled from a documented feature where the model is not in metres.
const VOYAGER: CraftModel = {
  url: `${CDS}/voyager-probe-(b)/Voyager%20Probe%20(B).glb`,
  credit: 'NASA/Michael D. Carbajal',
  source: `${PAGE}/voyager-probe-b/`,
  sizeM: 16.2, // scaled from the 3.66 m dish; includes the 13 m magnetometer boom
  modelSize: 16.909,
  hga: [0, 1, 0],
  bytes: 1_720_864,
};

const PIONEER: CraftModel = {
  url: `${CDS}/pioneer-10/Pioneer%2010.glb`,
  credit: EYES,
  source: `${PAGE}/pioneer/`,
  sizeM: 8.2,
  modelSize: 8.247,
  hga: [0, 0, -1],
  bytes: 2_049_840,
};

const MMS: CraftModel = {
  url: `${CDS}/magnetospheric-multiscale-(mms)-(b)/Magnetospheric%20Multiscale%20(MMS)%20(B).glb`,
  credit: 'NASA/Christopher R. Meaney',
  source: `${PAGE}/magnetospheric-multiscale-mms-b/`,
  sizeM: 29, // booms shortened in the model; scaled from the 3.5 m body
  modelSize: 14.512,
  bytes: 1_181_276,
};

// The ARTEMIS probes are THEMIS B and C.
const THEMIS: CraftModel = {
  url: `${CDS}/time-history-of-events-and-macroscale-interactions-during-substorms-(themis)/Time%20History%20of%20Events%20and%20Macroscale%20Interactions%20During%20Substorms%20(THEMIS).glb`,
  credit: EYES,
  source: `${PAGE}/time-history-of-events-and-macroscale-interactions-during-substorms-themis/`,
  sizeM: 7.2, // wire booms shortened in the model
  modelSize: 7.207,
  bytes: 682_092,
};

const MER: CraftModel = {
  url: `${CDS}/mars-exploration-rover---opportunity-(mer-b)/Mars%20Exploration%20Rover%20-%20Opportunity%20(MER-B).glb`,
  credit: 'NASA/Ames Research Center',
  source: `${PAGE}/mars-exploration-rover-opportunity-mer-b/`,
  sizeM: 3.4, // scaled from the 2.3 m width; arm extended
  modelSize: 12.708,
  bytes: 36_668,
};

/** By Horizons ID. */
export const CRAFT_MODELS: Record<number, CraftModel> = {
  [-31]: VOYAGER,
  [-32]: VOYAGER,
  [-23]: PIONEER,
  [-24]: PIONEER,
  [-98]: {
    url: `${PSD}/solar/2023/09/n/New_Horizons.glb`,
    credit: VTAD,
    source: `${RESOURCE}/new-horizons-3d-model/`,
    sizeM: 3.3, // scaled from the 2.1 m dish
    modelSize: 2.976,
    hga: [0, 1, 0],
    bytes: 3_293_532,
  },
  [-61]: {
    url: `${PSD}/solar/2023/09/j/Juno.glb`,
    credit: VTAD,
    source: `${RESOURCE}/juno-3d-model/`,
    sizeM: 19.3,
    modelSize: 18.543,
    hga: [0, 1, 0],
    bytes: 9_185_648,
  },
  [-159]: {
    url: `${PSD}/solar/2023/09/c/clipper_spacecraft.glb`,
    credit: VTAD,
    source: `${RESOURCE}/europa-clipper-3d-model/`,
    sizeM: 30.5,
    modelSize: 30.5,
    // The dish is modelled as a shallow cone; it faces away from the bus.
    hga: [0, -1, 0],
    bytes: 35_706_144,
  },
  [-64]: {
    url: `${CDS}/osiris-rex/OSIRIS-REx.glb`,
    credit: 'NASA/Christopher R. Meaney',
    source: `${PAGE}/origins-spectral-interpretation-resource-identification-and-security-regolith-explorer-osiris-rex/`,
    sizeM: 6.2,
    modelSize: 34.651,
    hga: [1, 0, 0],
    bytes: 1_281_308,
  },
  [-55]: {
    url: `${CDS}/ulysses/Ulysses.glb`,
    credit: KUMANCHIK_LOPEZ,
    source: `${PAGE}/ulysses/`,
    sizeM: 72.5, // the wire dipole; the body is about 3 m
    modelSize: 68.023,
    hga: [0, 1, 0],
    bytes: 2_462_656,
  },
  [-203]: {
    url: `${CDS}/dawn/Dawn.glb`,
    credit: 'NASA/Brian E. Kumanchik',
    source: `${PAGE}/dawn/`,
    sizeM: 19.7,
    modelSize: 19.698,
    hga: [0, 0, 1],
    bytes: 927_020,
  },
  [-227]: {
    url: `${CDS}/kepler-(a)/Kepler%20(A).glb`,
    credit: KUMANCHIK_LOPEZ,
    source: `${PAGE}/kepler-a/`,
    sizeM: 4.7,
    modelSize: 5.007,
    hga: [0, 0, -1],
    bytes: 2_003_276,
  },
  [-79]: {
    url: `${CDS}/spitzer-space-telescope/Spitzer%20Space%20Telescope.glb`,
    credit: 'NASA/Janice C. Lee; NASA/Robert L. Hurt',
    source: `${PAGE}/spitzer-space-telescope/`,
    sizeM: 4.5,
    modelSize: 4.488,
    hga: [0, -0.99, -0.14],
    bytes: 251_388,
  },
  [-96]: {
    url: `${CDS}/parker-solar-probe/Parker%20Solar%20Probe.glb`,
    credit: 'NASA/Matthew J. Garcia',
    source: `${PAGE}/parker-solar-probe/`,
    sizeM: 6.6,
    modelSize: 6.611,
    bytes: 443_572,
  },
  [-170]: {
    url: `${CDS}/james-webb-space-telescope-(b)/James%20Webb%20Space%20Telescope%20(B).glb`,
    credit: 'NASA/Christopher R. Meaney',
    source: `${PAGE}/james-webb-space-telescope-b/`,
    sizeM: 21.2,
    modelSize: 20.996,
    bytes: 1_004_248,
  },
  [-211]: {
    url: `${CDS}/nancy-grace-roman-space-telescope-(a)/Nancy%20Grace%20Roman%20Space%20Telescope%20(A).glb`,
    credit: 'NASA/Christopher R. Meaney',
    source: `${PAGE}/nancy-grace-roman-space-telescope-a/`,
    sizeM: 12.7, // 2015 WFIRST-AFTA design, scaled to the flown length
    modelSize: 344.298,
    bytes: 2_672_000,
  },
  [-151]: {
    url: `${CDS}/chandra-x-ray-observatory/Chandra%20X-ray%20Observatory.glb`,
    credit: 'NASA/Brian E. Kumanchik',
    source: `${PAGE}/chandra-x-ray-observatory/`,
    sizeM: 19.5,
    modelSize: 19.507,
    bytes: 998_500,
  },
  [-95]: {
    url: `${CDS}/transiting-exoplanet-survey-satellite-(tess)-(b)/Transiting%20Exoplanet%20Survey%20Satellite%20(TESS)%20(B).glb`,
    credit: 'NASA/Matthew J. Garcia',
    source: `${PAGE}/transiting-exoplanet-survey-satellite-tess-b/`,
    sizeM: 3.7,
    modelSize: 7.394,
    bytes: 1_693_644,
  },
  [-140482]: MMS,
  [-140483]: MMS,
  [-140484]: MMS,
  [-140485]: MMS,
  [-192]: THEMIS,
  [-193]: THEMIS,
  [-85]: {
    url: `${CDS}/lunar-reconnaissance-orbiter-(b)/Lunar%20Reconnaissance%20Orbiter%20(B).glb`,
    credit: KUMANCHIK_LOPEZ,
    source: `${PAGE}/lunar-reconnaissance-orbiter-b/`,
    sizeM: 5.5,
    modelSize: 5.505,
    bytes: 2_902_744,
  },
  [-40000]: {
    url: `${CDS}/clementine/Clementine.glb`,
    credit: 'NASA/Brian E. Kumanchik',
    source: `${PAGE}/clementine/`,
    sizeM: 4.1,
    modelSize: 4.132,
    bytes: 3_026_396,
  },
  [-92]: {
    url: `${CDS}/advanced-composition-explorer/Advanced%20Composition%20Explorer.glb`,
    credit: 'NASA/Christopher R. Meaney',
    source: `${PAGE}/advanced-composition-explorer/`,
    sizeM: 8.3,
    modelSize: 1345.304,
    bytes: 2_030_760,
  },
  [-8]: {
    url: `${CDS}/wind/Wind.glb`,
    credit: 'NASA/Christopher R. Meaney',
    source: `${PAGE}/wind/`,
    sizeM: 40, // wire antennas shortened in the model; scaled from the 2.4 m body
    modelSize: 52.431,
    bytes: 233_988,
  },
  [-21]: {
    url: '/data/models/soho.glb',
    credit: 'NASA',
    source: `${GITHUB}/Solar%20and%20Heliospheric%20Observatory`,
    sizeM: 9.5,
    modelSize: 43.269,
    bytes: 83_268,
  },
  [-78]: {
    url: `${CDS}/deep-space-climate-observatory-(dscovr)-(triana)/Deep%20Space%20Climate%20Observatory%20(DSCOVR)%20(Triana).glb`,
    credit: 'NASA',
    source: `${PAGE}/deep-space-climate-observatory-dscovr-triana/`,
    sizeM: 6.4, // scaled from the 1.87 m body
    modelSize: 266.371,
    bytes: 112_488,
  },
  [-234]: {
    url: '/data/models/stereo-a.glb',
    credit: 'NASA',
    source: `${GITHUB}/Solar%20TErrestrial%20RElations%20Observatory%20(STEREO)`,
    sizeM: 6.5,
    modelSize: 3142.189,
    bytes: 354_212,
  },
  [-74]: {
    url: `${CDS}/mars-reconnaissance-orbiter-(mro)-(c)/Mars%20Reconnaissance%20Orbiter%20(MRO)%20(C).glb`,
    credit: KUMANCHIK_LOPEZ,
    source: `${PAGE}/mars-reconnaissance-orbiter-mro-c/`,
    sizeM: 13.6,
    modelSize: 13.18,
    bytes: 1_219_800,
  },
  [-53]: {
    url: `${CDS}/mars-odyssey/Mars%20Odyssey.glb`,
    credit: EYES,
    source: `${PAGE}/mars-odyssey/`,
    sizeM: 8.2,
    modelSize: 8.221,
    bytes: 5_801_372,
  },
  [-143]: {
    url: `${PSD}/solar/2023/09/t/TGO.glb`,
    credit: VTAD,
    source: `${RESOURCE}/trace-gas-orbiter-3d-model/`,
    sizeM: 17.5,
    modelSize: 17.534,
    bytes: 5_911_208,
  },
  [-189]: {
    url: `${CDS}/insight-cruise-lander/InSight%20Cruise%20Lander%20(arm%20deployed).glb`,
    credit: 'NASA/Brian E. Kumanchik',
    source: `${PAGE}/insight-cruise-lander/`,
    sizeM: 6.0,
    modelSize: 6.135,
    bytes: 3_949_036,
  },
  [-76]: {
    url: `${PSD}/mars/resources/gltf_files/24584_Curiosity_static.glb`,
    credit: 'NASA/JPL-Caltech',
    source: `${RESOURCE}/curiosity-rover-3d-model/`,
    sizeM: 3.9,
    modelSize: 3.945,
    bytes: 11_860_016,
  },
  [-253]: MER,
  [-254]: MER,
};
