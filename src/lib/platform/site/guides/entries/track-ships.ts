import type { Guide } from '../types';

export const TRACK_SHIPS: Guide = {
  slug: 'how-to-track-ships-live',
  section: 'sea',
  title: 'How to track ships live on a map with AIS',
  description: 'How ships report their position over AIS, what a ship on the live map tells you, how to follow one, and how to watch traffic through the world’s chokepoints.',
  heading: 'How to track ships live',
  lede: 'Ships broadcast their name, position, speed and destination over AIS, much as aircraft do over ADS-B. TAKIP draws the ones it hears and keeps them moving, so you can watch a strait fill up or follow one ship into port.',
  layers: ['ship-tracker', 'chokepoints'],
  open: { layers: ['maritime', 'chokepoint_flow'], view: { lat: 1.25, lon: 103.9, zoom: 9 } },
  checked: '2026-10-19',
  requiresEnv: 'AIS_API_KEY',
  sections: [
    {
      heading: 'What AIS is',
      paragraphs: [
        'The Automatic Identification System was built so ships could see each other and avoid collisions. Under international rules, every passenger ship, and every other ship of 300 gross tonnes or more on an international voyage, must carry it, and many fishing boats and yachts carry a simpler version.',
        'A transponder sends two kinds of message. Position reports, every few seconds under way and every few minutes at anchor, carry position, speed and course. Static reports, sent less often, carry the ship’s name, its type and its destination, which the crew types in.',
        'Receivers ashore hear them, and aisstream.io relays what they hear. TAKIP keeps up to 20,000 ships at a time, asks for new positions every 10 seconds, and drops a ship it hasn’t heard from for 10 minutes.',
      ],
    },
    {
      heading: 'What a ship shows',
      paragraphs: [
        'Ships are coloured by type: cargo, tankers, passenger ships and ferries, fishing, military and law enforcement, tugs and service vessels, sailing and leisure, and other. Each type has its own switch under Maritime / Naval in the Layers panel, and Underway only hides anything slower than half a knot: anchored, moored or drifting.',
        'A ship whose static report hasn’t been heard yet has no type, so it shows as Other / Unidentified, sometimes without a name.',
        'The MMSI on the card is the ship’s nine-digit radio identity. Its first three digits usually say which country the ship is registered in.',
      ],
      steps: [
        'Click a ship to open its card: name, type, speed in knots, heading, destination and MMSI, with a tag saying Under way or Stationary.',
        'Nearby lists the closest ships and aircraft within 250 km. Click one to go to it and follow it.',
        'Press Follow to keep the ship in view, or Copy a link that follows this to send it to someone. The link finds the ship by its MMSI when it opens.',
        'Use the links at the bottom of the card to open the same ship on MarineTraffic or VesselFinder.',
      ],
    },
    {
      heading: 'Watching the chokepoints',
      paragraphs: [
        'A few narrow passages carry much of the world’s trade. The ship layer marks ten of them, among them Hormuz, Bab el-Mandeb, Suez, Malacca and Panama, and the Chokepoint Traffic layer adds how busy each has been.',
        'Chokepoint Traffic comes from IMF PortWatch, which estimates transits from AIS. Each strait’s last seven days are compared with its own normal, the three months or so before. If each of the last three days ran below 85% of normal, it is marked disrupted. Click one for the share of normal, a 30-day chart and any disruption PortWatch has recorded.',
        'PortWatch publishes weekly, so its latest day is often a week or more old. Use it for the trend, and the ships themselves for what is passing now.',
      ],
      spots: [
        { label: 'Strait of Hormuz', view: { lat: 26.5, lon: 56.3, zoom: 7 }, note: 'The way out of the Gulf for its oil and gas.' },
        { label: 'Bab el-Mandeb', view: { lat: 12.6, lon: 43.3, zoom: 7 }, note: 'The southern gate of the Red Sea.' },
        { label: 'Suez Canal', view: { lat: 30.5, lon: 32.35, zoom: 7.5 }, note: 'The shortcut between Europe and Asia.' },
        { label: 'Singapore Strait', view: { lat: 1.25, lon: 103.9, zoom: 9 }, note: 'One of the busiest stretches of water in the world.' },
      ],
    },
    {
      heading: 'What AIS can’t show',
      paragraphs: [
        'AIS is mostly heard from the shore, so coverage is best near busy coasts and ports. Far out at sea, ships often drop off the map and come back as they near land.',
        'Ships can switch AIS off, and warships often do. Nothing checks what a transponder says, so a position can be faked, and a type or destination typed in by the crew can be wrong or out of date.',
        'A ship missing from the map is not proof that it isn’t there.',
      ],
    },
  ],
};
