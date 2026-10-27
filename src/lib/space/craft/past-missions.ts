/**
 * TAKIP — finished missions whose whole flight JPL Horizons still keeps: they are not in the live fleet (their
 * ephemeris has ended), but their flight can be played back from the history route. Each was checked to replay
 * end to end; `launched` and `ended` are the mission's years, which can differ from the ephemeris span (Horizons
 * carries Deep Impact's predicted path past its last contact).
 */

import { msg } from '@/lib/core/i18n/translator';

export interface PastMission {
  /** JPL Horizons ID. */
  id: number;
  name: string;
  /** English Wikipedia title (checked against the API). */
  wiki: string;
  agency: string;
  launched: number;
  ended: number;
  note: string;
}

export const PAST_MISSIONS: PastMission[] = [
  { id: -1024, name: 'Artemis II', wiki: 'Artemis II', agency: 'NASA', launched: 2026, ended: 2026,
    note: msg('The first crewed flight around the Moon since 1972: four astronauts in Orion, out and back in ten days.') },
  { id: -1023, name: 'Artemis I', wiki: 'Artemis I', agency: 'NASA', launched: 2022, ended: 2022,
    note: msg('Orion’s uncrewed test flight around the Moon and back, 25 days in late 2022.') },
  { id: -82, name: 'Cassini', wiki: 'Cassini–Huygens', agency: 'NASA · ESA · ASI', launched: 1997, ended: 2017,
    note: msg('Orbited Saturn for 13 years and dropped the Huygens probe onto Titan; plunged into Saturn in 2017.') },
  { id: -226, name: 'Rosetta', wiki: 'Rosetta (spacecraft)', agency: 'ESA', launched: 2004, ended: 2016,
    note: msg('Followed comet 67P for two years, landed Philae on it, and ended by touching down on the comet itself.') },
  { id: -236, name: 'MESSENGER', wiki: 'MESSENGER', agency: 'NASA', launched: 2004, ended: 2015,
    note: msg('The first craft to orbit Mercury, mapping all of it over four years before crashing into it in 2015.') },
  { id: -77, name: 'Galileo', wiki: 'Galileo (spacecraft)', agency: 'NASA', launched: 1989, ended: 2003,
    note: msg('Orbited Jupiter for eight years, dropped a probe into its clouds, and was steered into Jupiter in 2003.') },
  { id: -140, name: 'Deep Impact', wiki: 'Deep Impact (spacecraft)', agency: 'NASA', launched: 2005, ended: 2013,
    note: msg('Fired an impactor into comet Tempel 1 in 2005, then flew on past comet Hartley 2; contact was lost in 2013.') },
  { id: -29, name: 'Stardust', wiki: 'Stardust (spacecraft)', agency: 'NASA', launched: 1999, ended: 2011,
    note: msg('Caught dust from comet Wild 2 and brought it back to Earth in 2006, then flew on to comet Tempel 1.') },
  { id: -30, name: 'Deep Space 1', wiki: 'Deep Space 1', agency: 'NASA', launched: 1998, ended: 2001,
    note: msg('Proved ion engines on a long flight, passing asteroid Braille and comet Borrelly.') },
  { id: -93, name: 'NEAR Shoemaker', wiki: 'NEAR Shoemaker', agency: 'NASA', launched: 1996, ended: 2001,
    note: msg('The first craft to orbit an asteroid, Eros, and the first to land on one, in 2001; Horizons carries it on with Eros.') },
  { id: -47, name: 'Genesis', wiki: 'Genesis (spacecraft)', agency: 'NASA', launched: 2001, ended: 2004,
    note: msg('Collected the solar wind at the Sun–Earth L1 point for two years and dropped its capsule back on Earth in 2004.') },
  { id: -84, name: 'Phoenix', wiki: 'Phoenix (spacecraft)', agency: 'NASA', launched: 2007, ended: 2008,
    note: msg('Landed near the north pole of Mars in 2008 and found water ice just under the soil.') },
  { id: -248, name: 'Venus Express', wiki: 'Venus Express', agency: 'ESA', launched: 2005, ended: 2014,
    note: msg('Orbited Venus for eight years studying its thick atmosphere, until its fuel ran out in 2014.') },
  { id: -5, name: 'Akatsuki', wiki: 'Akatsuki (spacecraft)', agency: 'JAXA', launched: 2010, ended: 2024,
    note: msg('Japan’s Venus orbiter: it missed its first arrival in 2010 and got into orbit five years later, watching Venus’ clouds until 2024.') },
  { id: -177, name: 'GRAIL', wiki: 'Gravity Recovery and Interior Laboratory', agency: 'NASA', launched: 2011, ended: 2012,
    note: msg('Twin craft, Ebb and Flow, that chased each other round the Moon to map its gravity; this is Ebb, flown into a lunar mountain in 2012.') },
  { id: -12, name: 'LADEE', wiki: 'Lunar Atmosphere and Dust Environment Explorer', agency: 'NASA', launched: 2013, ended: 2014,
    note: msg('Studied the Moon’s faint atmosphere and floating dust from a low orbit, and was brought down on the far side in 2014.') },
  { id: -530, name: 'Mars Pathfinder', wiki: 'Mars Pathfinder', agency: 'NASA', launched: 1996, ended: 1997,
    note: msg('Bounced down on airbags in 1997 and drove out Sojourner, the first rover on another planet.') },
];

const BY_ID = new Map(PAST_MISSIONS.map(m => [m.id, m]));
export const pastMission = (id: number) => BY_ID.get(id) ?? null;
