/** The About page's copy in English; other languages override it by key in their SiteCopy (copy.ts). */
export const ABOUT = {
  title: 'About TAKIP: the world as it happens, on one map',
  description: 'Why TAKIP exists: public data about the world is everywhere but scattered. TAKIP puts flights, ships, satellites, cameras, quakes and weather on one live map.',
  kicker: 'About TAKIP',
  heading: 'The world as it happens, on one map',
  lede: 'Aircraft broadcast where they are. Ships report their position over radio. Satellites follow published orbits, seismographs time every tremor, weather radar sweeps the sky and cities point cameras at their streets. Almost all of it is public. TAKIP gathers it onto one live map, so you can look at the world and watch it move.',
  whyTitle: 'Why it exists',
  why: [
    'Each of these streams lives on its own site, with its own map and its own way of showing things. Put together they tell you far more: the planes over your city and the storm they are flying around, the ships queueing outside a strait, the coast a quake has just shaken and the cameras that look at it, the satellite passing over you tonight.',
    'TAKIP is made for looking, watching and understanding. Open it on a quiet evening and follow the ISS, or open it on a busy news day and see where things are happening. Takip is Turkish for keeping track.',
  ],
  onMapTitle: 'What is on the map',
  moreTitle: 'More than a live map',
  more: [
    'Replay plays back what TAKIP has recorded, so you can scrub through the flights and ships of an earlier day.',
    'History is an atlas of the past: the world’s borders through the centuries, and the continents drifting over hundreds of millions of years.',
    'Space leaves the Earth for a real-time 3D view of the satellites around it and the planets beyond.',
    'Areas let you draw a shape on the map, see what is inside it, and keep a log of what enters and leaves.',
    'TI is an assistant that reads the map with you and answers questions about what is on it, using the AI key you give it.',
    'Share what you are looking at, an aircraft, a ship, a satellite or a place, and the link opens the same view, as it is when it is opened.',
  ],
  honestTitle: 'Honest about its data',
  honest: 'Every layer says where its data comes from and how fresh it is. Where something is estimated, inferred or run from a timetable rather than seen live, the map says so. Coverage is uneven: aircraft and ships show up where receivers hear them, and a city has cameras only if it publishes them. Each layer’s page lists what it can’t tell you.',
  freeTitle: 'Free to use',
  free: 'TAKIP is free. Without an account you get a daily allowance of map time, and a free account gives you more. The free plans show a few ads, never on the map. What TAKIP keeps about your visit is set out plainly on the privacy page.',
};

export type AboutKey = keyof typeof ABOUT;
