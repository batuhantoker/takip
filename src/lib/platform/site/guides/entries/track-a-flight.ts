import type { Guide } from '../types';

export const TRACK_A_FLIGHT: Guide = {
  slug: 'how-to-track-a-flight-live',
  section: 'air',
  title: 'How to track a flight live on a map',
  description: 'How to find a flight on a live ADS-B map, see its route, altitude and speed, follow it, send a link that follows it, and know where coverage runs out.',
  heading: 'How to track a flight live',
  lede: 'Most aircraft broadcast where they are a few times a second. TAKIP draws the ones receivers hear, so you can pick out a flight, follow it across the map and send someone a link that follows it too.',
  layers: ['flight-tracker', 'private-jets', 'military-aircraft', 'airport-delays'],
  open: { layers: ['flights', 'private', 'jets', 'military'], view: { lat: 51.47, lon: -0.45, zoom: 8 } },
  checked: '2026-10-19',
  sections: [
    {
      heading: 'Where the positions come from',
      paragraphs: [
        'Airliners, business jets and many small aircraft carry an ADS-B transponder that broadcasts the aircraft’s identity, its GPS position, altitude and speed. Volunteers around the world run receivers and feed what they hear into networks such as the OpenSky Network, adsb.lol and adsb.fi, and TAKIP draws what those networks hear.',
        'Aircraft are split into four layers in the Layers panel: Commercial, Private, Private Jets and Military. Which one an aircraft lands in is worked out from its type, callsign, altitude and speed, so a few end up in the wrong one. An aircraft squawking 7500, 7600 or 7700, or sending an emergency status, is drawn in red with a ring around it, as long as its layer is on.',
      ],
    },
    {
      heading: 'Finding the flight you want',
      paragraphs: [
        'The search box finds places, not flights, so you find a flight by going to where it is: its departure or arrival airport, or somewhere along its route.',
        'Zoomed out, only a share of aircraft is drawn, about one airliner in ten, so the world stays readable, and those positions can be a few minutes old. From about zoom 5, every aircraft the networks hear within 250 nautical miles of the middle of your view is drawn and refreshed every 15 seconds.',
        'Signed in with your own AI key, you can also ask TI for a flight by callsign or registration, if it is in the air on the map now.',
      ],
      steps: [
        'Open the map with the aircraft layers on, and zoom in to the airport or region the flight is in.',
        'Click aircraft until you find the callsign you are after. Each one points the way it is flying.',
        'Leave its card open: it keeps to the aircraft’s latest position from the feed until you close it.',
      ],
    },
    {
      heading: 'What the card tells you',
      paragraphs: [
        'The card gives the callsign, the type and operator where the registry knows them, altitude in feet, speed in knots, heading, squawk, registration and ICAO address. Tags say when the aircraft is on the ground, declaring an emergency or out of range.',
        'The map draws the track the aircraft has flown as a solid line. TAKIP also looks the route up by callsign, but a schedule often belongs to another leg of the same aircraft’s day, so it is used only when it agrees with where the aircraft actually is. Then the card shows where the flight is from and where it is going, with departure and arrival times and how far along it is where the schedule has them, and the rest of the way is drawn dashed, because that part is a projection, not an observation.',
        'Nearby lists the closest aircraft and ships within 250 km. Links open the same flight on FlightAware and ADS-B Exchange.',
      ],
    },
    {
      heading: 'Following, watching and sharing',
      paragraphs: [
        'Three buttons on the card keep a flight within reach.',
      ],
      steps: [
        'Press Follow, and the map keeps the aircraft in the middle of the view as it moves. Zooming keeps the follow; dragging the map ends it.',
        'Press Watch to add it to the Watched aircraft window, which keeps up to six flights to jump back to.',
        'Press Copy a link that follows this. Whoever opens the link lands on the same view with the same layers on, and the map follows the aircraft once it shows up in the data.',
      ],
    },
    {
      heading: 'Delays and gaps',
      paragraphs: [
        'In the United States, the Airport Delays layer pins each airport where the FAA has a programme running, such as a ground stop, a ground delay programme or arrival and departure delays, with the reason and the average delay where given. It is read every 2 minutes.',
        'Coverage depends on receivers. Over oceans and remote land there are few, so flights thin out mid-crossing and come back near the coast. Many military and state aircraft don’t broadcast, and owners can hide a jet’s identity through privacy programmes.',
        'A shared link looks for its aircraft for two minutes. If it has landed or flown out of coverage by then, the map says it isn’t in the live data now.',
      ],
    },
  ],
};
