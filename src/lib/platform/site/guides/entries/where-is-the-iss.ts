import type { Guide } from '../types';

export const WHERE_IS_THE_ISS: Guide = {
  slug: 'where-is-the-iss-right-now',
  section: 'space',
  title: 'Where is the ISS right now? How to follow it live',
  description: 'How to follow the International Space Station live on a map: where its position comes from, how its orbit works, and how to find its next passes over you.',
  heading: 'Where is the ISS right now?',
  lede: 'The International Space Station circles the Earth about every 92 minutes, some 400 km up. Here is how TAKIP places it, why its path looks the way it does, and how to tell when it will next cross your sky.',
  layers: ['iss-tracker', 'satellite-tracker'],
  open: { layers: ['sat_science'], track: 'satellite:25544', view: { lat: 0, lon: 0, zoom: 2 } },
  checked: '2026-10-19',
  sections: [
    {
      heading: 'Following it live',
      paragraphs: [
        'Open the map and it finds the station and follows it, with its card open. The position isn’t a report from the station itself. TAKIP reads its latest published orbital elements from CelesTrak every 2 hours, and your browser works out where they put it, moment by moment, with the standard SGP4 model.',
        'The card gives its altitude, speed and orbital period, and the place directly below it. Its orbit is drawn on the globe for one full lap, half behind it and half ahead. “Follow” keeps the map with it, and the link button copies a link that opens the map following it too.',
        'For the view from the station, open the Space panel and its “ISS live” tab: three live streams from cameras outside the station.',
      ],
    },
    {
      heading: 'How its orbit works',
      paragraphs: [
        'The station moves at about 7.7 km a second, fast enough that it keeps falling around the Earth rather than into it. That makes about 15.5 laps a day.',
        'Its orbit is tilted 51.6° to the equator, so it passes over everywhere between about 51.6° north and 51.6° south, where most of the world’s people live, but never over the polar regions. On a flat map its track is a wave, climbing to 51.6° north and dipping to 51.6° south. The Earth turns beneath it as it goes, so each lap crosses the ground further west than the last.',
        'At that height there is still a trace of air, which slowly drags the station down, so from time to time it fires engines to climb back up. After a boost its marker can be off until new elements are published.',
      ],
    },
    {
      heading: 'When it passes over you',
      paragraphs: [
        'The card lists the station’s next passes over the middle of the map: up to four in the next 48 hours, counting the time it is more than 10° above the horizon. Each gives the time, how high it climbs and the compass points where it rises and sets.',
        'An eye marks a pass you can see by eye: the station is lit by the Sun while your sky is dark, with the Sun at least 6° below the horizon. That is why sightings come in the hours after dusk and before dawn. It looks like a bright, steady star gliding across the sky for a few minutes, without blinking.',
      ],
      steps: [
        'Open the map. It follows the station, with its card open.',
        'Turn off following with the follow button on the card, then drag the map until your town is in the middle. Don’t zoom in far: close in, the satellites leave the map and the card closes.',
        'Press the crosshair beside “Next passes”. The passes are worked out again for the middle of the map.',
        'Look for a pass with the eye, then go out a few minutes early and face the direction it rises from.',
      ],
    },
    {
      heading: 'What it can’t tell you',
      paragraphs: [
        'Pass times are predictions from the latest elements, and they move when the station boosts its orbit, so check again on the day.',
        'They don’t account for cloud, and a pass that climbs only a little above 10° can hide behind buildings, trees or haze.',
        'Far north or south, beyond about 64° of latitude, the station never climbs above 10°, so the card lists no passes at all.',
      ],
    },
  ],
};
