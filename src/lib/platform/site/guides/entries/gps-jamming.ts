import type { Guide } from '../types';

export const GPS_JAMMING: Guide = {
  slug: 'what-gps-jamming-looks-like',
  section: 'air',
  title: 'What GPS jamming looks like on a map, and how it is found',
  description: 'How a live map finds GPS jamming from what aircraft say about their own position: the signal it reads, the thresholds, where it shows up, and its limits.',
  heading: 'What GPS jamming looks like on a map',
  lede: 'Nobody broadcasts "I am jamming GPS". But aircraft broadcast how sure they are of their own position, and where many of them lose that certainty in the same place at once, the map lights up.',
  layers: ['gps-jamming', 'flight-tracker', 'gps-satellites'],
  open: { layers: ['gps_jamming', 'flights'], view: { lat: 45, lon: 30, zoom: 3.5 } },
  checked: '2026-10-19',
  sections: [
    {
      heading: 'The signal: aircraft grading their own position',
      paragraphs: [
        'Airliners and most other aircraft send ADS-B messages a few times a second: where they are, how high and how fast. Alongside the position, each one sends a number called NACp, the navigation accuracy category, which says how far off that position might be.',
        'A healthy GPS fix rates high: the aircraft knows where it is to within tens of metres. When GPS is jammed or spoofed, the receiver loses its fix or stops trusting it, and the number drops. TAKIP counts an aircraft as degraded when its NACp is 4 or less, meaning it can only vouch for its position to within about a nautical mile, or not at all.',
      ],
    },
    {
      heading: 'From one aircraft to a pattern',
      paragraphs: [
        'One aircraft with a poor number proves little: a faulty receiver looks the same. So the map works in squares 2° on a side, and a square is shaded only when it holds at least ten airborne aircraft, at least three of them are degraded, and they make up at least a tenth of the total.',
        'Aircraft on the ground and below 100 feet are left out, and each aircraft is counted once. The positions come from the community ADS-B networks adsb.lol and adsb.fi, because their data carries NACp; OpenSky’s does not.',
        'The squares are worked out again with every flight update, every few minutes, so a patch can appear and fade within an hour.',
      ],
      steps: [
        'Open the map with GPS jamming and flights switched on.',
        'Look for shaded squares. Click one for the share of aircraft affected and how many were counted.',
        'Zoom in on a square and watch the aircraft inside it: the degraded ones are still flying normally, just less sure of where they are.',
      ],
    },
    {
      heading: 'Where it shows up',
      paragraphs: [
        'The shading follows where interference has been reported for years: around conflict zones and some borders, where militaries jam or spoof GPS and airliners fly through the edge of it.',
      ],
      spots: [
        { label: 'The Baltic', view: { lat: 57, lon: 22, zoom: 4.8 }, note: 'Widespread interference has been reported around Kaliningrad and the Baltic states.' },
        { label: 'Eastern Mediterranean', view: { lat: 34, lon: 34, zoom: 5 }, note: 'Heavy spoofing has been reported here since late 2023.' },
        { label: 'Black Sea', view: { lat: 44, lon: 34, zoom: 5 }, note: 'Around Crimea and the coasts near the war in Ukraine.' },
      ],
    },
    {
      heading: 'What it can’t tell you',
      paragraphs: [
        'It is an inference, not a detector. It can’t tell jamming from spoofing, or either from a fault, and it can’t point to the transmitter: a square only says that aircraft inside it were affected.',
        'Where few aircraft fly, nothing is shown, because a square needs ten of them to be judged. Empty sky over a war zone can hide strong interference, and a quiet night can make a busy area look clean.',
        'Pilots are trained for it: aircraft fall back on inertial navigation and ground beacons, so a shaded square doesn’t mean aircraft are lost.',
      ],
    },
  ],
};
