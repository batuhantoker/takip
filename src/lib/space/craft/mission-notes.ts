/**
 * TAKIP — what the better-known craft in the Horizons fleet are, by Horizons ID.
 * Optional notes only: a craft missing here still shows, under Horizons' name.
 */

import { msg } from '@/lib/core/i18n/translator';

export interface MissionNote {
  name?: string;
  agency: string;
  summary: string;
  /** Year the mission ended; the craft is still out there. */
  ended?: number;
}

export const MISSION_NOTES: Record<number, MissionNote> = {
  [-170]: { name: 'James Webb Space Telescope', agency: 'NASA · ESA · CSA', summary: msg('Infrared observatory circling the Sun–Earth L2 point.') },
  [-31]: { agency: 'NASA', summary: msg('Launched 1977. Crossed the heliopause in 2012; the farthest object people have made.') },
  [-32]: { agency: 'NASA', summary: msg('Launched 1977. The only craft to visit Uranus and Neptune; in interstellar space since 2018.') },
  [-98]: { agency: 'NASA', summary: msg('Flew past Pluto in 2015 and Arrokoth in 2019; now crossing the Kuiper belt.') },
  [-96]: { agency: 'NASA', summary: msg('Dives to 6.1 million km from the Sun — closer than anything built before it.') },
  [-61]: { agency: 'NASA', summary: msg('Jupiter orbiter since 2016, mapping the planet and its moons.') },
  [-159]: { agency: 'NASA', summary: msg('Bound for Jupiter’s moon Europa and its buried ocean; arrives 2030.') },
  [-28]: { agency: 'ESA', summary: msg('Jupiter Icy Moons Explorer; arrives 2031 and settles at Ganymede.') },
  [-121]: { agency: 'ESA · JAXA', summary: msg('Two orbiters riding together to Mercury, arriving November 2026.') },
  [-144]: { agency: 'ESA · NASA', summary: msg('Climbing out of the ecliptic to image the Sun’s poles.') },
  [-255]: { agency: 'NASA', summary: msg('Electric-propulsion cruise to the metal-rich asteroid 16 Psyche, arriving 2029.') },
  [-49]: { agency: 'NASA', summary: msg('Touring the Trojan asteroids that share Jupiter’s orbit.') },
  [-64]: { name: 'OSIRIS-APEX', agency: 'NASA', summary: msg('Formerly OSIRIS-REx; meets asteroid Apophis after its 2029 Earth flyby.') },
  [-91]: { agency: 'ESA', summary: msg('Surveying Didymos and Dimorphos, the pair NASA’s DART struck in 2022.') },
  [-37]: { name: 'Hayabusa2', agency: 'JAXA', summary: msg('Returned Ryugu samples in 2020; extended to asteroid 1998 KY26 for 2031.') },
  [-74]: { name: 'Mars Reconnaissance Orbiter', agency: 'NASA', summary: msg('HiRISE camera and the main relay for the Mars rovers.') },
  [-202]: { agency: 'NASA', summary: msg('Measures how Mars lost its atmosphere to space.') },
  [-53]: { name: '2001 Mars Odyssey', agency: 'NASA', summary: msg('The longest-serving spacecraft at Mars, in orbit since 2001.') },
  [-41]: { agency: 'ESA', summary: msg('Mars orbiter since 2003; its radar found buried ice.') },
  [-143]: { name: 'ExoMars Trace Gas Orbiter', agency: 'ESA · Roscosmos', summary: msg('Sniffs the Martian air for trace gases and relays rover data.') },
  [-62]: { name: 'Hope (Emirates Mars Mission)', agency: 'UAE Space Agency', summary: msg('Watches Martian weather from a high, slow orbit.') },
  [-9901491]: { agency: 'CNSA', summary: msg('China’s first Mars orbiter, which carried the Zhurong rover.') },
  [-9]: { agency: 'NASA · Rocket Lab', summary: msg('Twin smallsat (Blue) bound for Mars to study its magnetosphere.') },
  [-10]: { agency: 'NASA · Rocket Lab', summary: msg('Twin smallsat (Gold) bound for Mars to study its magnetosphere.') },
  [-168]: { name: 'Perseverance (Mars 2020)', agency: 'NASA', summary: msg('Rover in Jezero crater, caching samples for return to Earth.') },
  [-76]: { name: 'Curiosity (MSL)', agency: 'NASA', summary: msg('Rover climbing Mount Sharp in Gale crater since 2012.') },
  [-85]: { name: 'Lunar Reconnaissance Orbiter', agency: 'NASA', summary: msg('Mapping the Moon from low orbit since 2009.') },
  [-155]: { name: 'Danuri (KPLO)', agency: 'KARI', summary: msg('Korea’s first lunar orbiter, with NASA’s ShadowCam for the dark craters.') },
  [-152]: { name: 'Chandrayaan-2 orbiter', agency: 'ISRO', summary: msg('Polar lunar orbiter, in service since 2019.') },
  [-1176]: { agency: 'NASA · Advanced Space', summary: msg('Tested the near-rectilinear halo orbit planned for Gateway.') },
  [-192]: { name: 'ARTEMIS P1', agency: 'NASA', summary: msg('Former THEMIS probe, studying the solar wind around the Moon.') },
  [-193]: { name: 'ARTEMIS P2', agency: 'NASA', summary: msg('Former THEMIS probe, studying the solar wind around the Moon.') },
  [-158]: { name: 'Vikram (Chandrayaan-3)', agency: 'ISRO', summary: msg('Landed near the lunar south pole in August 2023.') },
  [-169]: { name: 'Chandrayaan-3 propulsion module', agency: 'ISRO', summary: msg('Carried Vikram to the Moon, then returned to Earth orbit.') },
  [-240]: { agency: 'JAXA', summary: msg('Smart Lander for Investigating Moon; landed within 100 m of its target in 2024.') },
  [-21]: { agency: 'ESA · NASA', summary: msg('Watching the Sun from L1 since 1996; its coronagraph sees coronal mass ejections.') },
  [-92]: { name: 'Advanced Composition Explorer', agency: 'NASA', summary: msg('Samples the solar wind about an hour before it reaches Earth.') },
  [-78]: { agency: 'NOAA · NASA', summary: msg('Solar-wind sentinel at L1; its EPIC camera photographs the whole sunlit Earth.') },
  [-8]: { agency: 'NASA', summary: msg('Measuring the solar wind since 1994.') },
  [-156]: { agency: 'ISRO', summary: msg('India’s solar observatory at L1.') },
  [-231]: { agency: 'NOAA', summary: msg('Operational space-weather monitor at L1, launched 2025.') },
  [-43]: { name: 'IMAP', agency: 'NASA', summary: msg('Maps the heliosphere’s boundary from L1, launched 2025.') },
  [-171]: { agency: 'NASA', summary: msg('Images Earth’s outermost atmosphere, the exosphere, from L1.') },
  [-680]: { agency: 'ESA', summary: msg('Surveying dark matter and dark energy from L2.') },
  [-211]: { name: 'Nancy Grace Roman Space Telescope', agency: 'NASA', summary: msg('Wide-field infrared survey telescope bound for L2; launched August 2026.') },
  [-139479]: { agency: 'ESA', summary: msg('Mapped two billion stars; retired in 2025.'), ended: 2025 },
  [-234]: { agency: 'NASA', summary: msg('Sees the Sun from a second vantage point along Earth’s orbit.') },
  [-95]: { agency: 'NASA', summary: msg('Planet hunter in an orbit timed to the Moon’s.') },
  [-48]: { agency: 'NASA · ESA', summary: msg('Optical and ultraviolet telescope in low Earth orbit since 1990.') },
  [-151]: { name: 'Chandra X-ray Observatory', agency: 'NASA', summary: msg('X-ray telescope on a high elliptical orbit since 1999.') },
  [-125544]: { name: 'International Space Station', agency: 'NASA · Roscosmos · ESA · JAXA · CSA', summary: msg('Crewed continuously since November 2000.') },
  [-148274]: { name: 'Tiangong', agency: 'CMSA', summary: msg('China’s crewed space station.') },
  [-143205]: { name: 'Tesla Roadster', agency: 'SpaceX', summary: msg('Falcon Heavy’s 2018 test payload, with Starman at the wheel.') },
  [-163182]: { agency: 'NASA', summary: msg('All-sky spectral survey telescope, launched 2025.') },
  [-165053]: { agency: 'NASA · ISRO', summary: msg('Radar satellite measuring how Earth’s surface moves, launched 2025.') },
  [-463]: { agency: 'ESA · CAS', summary: msg('Images how the solar wind strikes Earth’s magnetosphere.') },
  [-227]: { agency: 'NASA', summary: msg('Planet-hunting telescope, drifting behind Earth since it retired.'), ended: 2018 },
  [-79]: { agency: 'NASA', summary: msg('Infrared telescope, trailing Earth around the Sun since it retired.'), ended: 2020 },
  [-242]: { agency: 'NASA', summary: msg('Lunar water mapper; contact was lost soon after its 2025 launch.'), ended: 2025 },
  [-55]: { agency: 'ESA · NASA', summary: msg('First craft to fly over the Sun’s poles.'), ended: 2009 },
  [-203]: { agency: 'NASA', summary: msg('Orbited Vesta, then Ceres, where it remains.'), ended: 2018 },
  [-489]: { agency: 'ESA', summary: msg('Mapped the cosmic microwave background.'), ended: 2013 },
  [-486]: { agency: 'ESA', summary: msg('Far-infrared observatory.'), ended: 2013 },
  [-24]: { agency: 'NASA', summary: msg('First to fly past Saturn; silent since 1995 and heading out of the solar system.'), ended: 1995 },
  [-23]: { agency: 'NASA', summary: msg('First to cross the asteroid belt and fly past Jupiter.'), ended: 2003 },
  [-189]: { agency: 'NASA', summary: msg('Mars lander that measured marsquakes in Elysium Planitia.'), ended: 2022 },
  [-254]: { agency: 'NASA', summary: msg('Mars Exploration Rover in Gusev crater.'), ended: 2010 },
  [-253]: { agency: 'NASA', summary: msg('Mars Exploration Rover that drove 45 km across Meridiani Planum.'), ended: 2018 },
  [-40000]: { name: 'Clementine', agency: 'NASA · BMDO', summary: msg('Mapped the Moon in 1994, then lost on the way to an asteroid.'), ended: 1994 },
  [-164]: { agency: 'NASA', summary: msg('Laser-reflectometer cubesat for lunar ice; never reached lunar orbit.'), ended: 2023 },
  [-110637]: { name: 'International Ultraviolet Explorer', agency: 'NASA · ESA · UK', summary: msg('Ultraviolet telescope in geosynchronous orbit.'), ended: 1996 },
};
