import type { ApiGroup } from '../../api-catalog';

export const SPACE: ApiGroup = {
  id: 'space',
  title: 'Space',
  blurb: 'Launches, the spacecraft fleet, the solar system and the Sun, as the space view reads them. All keyless.',
  endpoints: [
    {
      path: '/api/launches',
      method: 'GET',
      summary: 'Upcoming launches at their pads, from Launch Library 2.',
      returns: ['launches', 'upcoming', 'mirror', 'total', 'timestamp'],
      notes: "`launches` holds the soonest 50; `upcoming` is LL2's own count. Read at most once an hour, and held off for 15 minutes after a failure, since LL2's anonymous quota is small.",
    },
    {
      path: '/api/space/fleet',
      method: 'GET',
      summary: 'Every spacecraft JPL Horizons can place right now.',
      returns: ['epoch', 'craft', 'pending', 'candidates'],
      notes: 'On a cold start `pending` counts craft still being looked up; poll again until it is 0.',
    },
    {
      path: '/api/space/history/{id}',
      method: 'GET',
      summary: "One spacecraft's whole flight from JPL Horizons, for replay: its track, encounters, mission phases and events.",
      returns: ['id', 'name', 'launch', 'start', 'end', 'coarse', 'encounters', 'phases', 'events'],
      notes: '`id` is a Horizons spacecraft id, which is negative (-31 is Voyager 1). A first read can take a minute or two.',
    },
    {
      path: '/api/space/sky',
      method: 'GET',
      summary: 'The Sun, Moon and planets from JPL Horizons.',
      returns: ['epoch', 'bodies'],
    },
    {
      path: '/api/space/outer',
      method: 'GET',
      summary: 'Dwarf planets, interstellar visitors and distant minor planets, from JPL Horizons and the Minor Planet Center.',
      returns: ['epoch', 'bodies', 'distant', 'distantSource'],
      notes: 'Read once a day: bodies past Neptune move a fraction of a degree a month.',
    },
    {
      path: '/api/space/exoplanets',
      method: 'GET',
      summary: 'Every confirmed exoplanet with a known distance, grouped by host star, from the NASA Exoplanet Archive.',
      returns: ['fetched', 'planets', 'hosts'],
      notes: 'Refreshed daily.',
    },
    {
      path: '/api/space/surface/{body}',
      method: 'GET',
      summary: 'Orbiters over the Moon or Mars, the Mars rovers, and where the surface is lit.',
      returns: ['body', 'epoch', 'orbiters', 'rovers', 'lighting'],
      notes: '`body` is `moon` or `mars`.',
    },
    {
      path: '/api/space/sun',
      method: 'GET',
      summary: 'The time of the latest solar frame in each channel, from Helioviewer.',
      returns: ['frames'],
      notes: 'Channels: `aia171`, `aia193`, `aia304`, `aia131` (SDO/AIA), `hmi-int`, `hmi-mag` (SDO/HMI) and `lasco-c3` (SOHO coronagraph).',
    },
    {
      path: '/api/space/sun/{channel}',
      method: 'GET',
      summary: 'One solar frame as a JPEG.',
      params: [{ name: 't', desc: 'The frame time from /api/space/sun. When it matches, the image is cached for good.' }],
      returns: ['image/jpeg', 'X-Frame-Time header'],
    },
  ],
};
