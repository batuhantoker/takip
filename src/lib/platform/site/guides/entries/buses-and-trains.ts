import type { Guide } from '../types';

export const BUSES_AND_TRAINS: Guide = {
  slug: 'how-to-follow-buses-and-trains-live',
  section: 'ground',
  title: 'How to follow buses and trains live on a map',
  description: 'Watch buses, trams and trains move in real time, and tell a live GPS position from an estimate or a timetable: what each marker means and where it works.',
  heading: 'How to follow buses and trains live',
  lede: 'Hundreds of transit agencies publish where their vehicles are, and some publish less than that. The map says which is which: every bus, tram and train on it is live, estimated or running from the timetable.',
  layers: ['live-transit'],
  open: { layers: ['transit'], view: { lat: 41.01, lon: 28.97, zoom: 11 } },
  checked: '2026-10-19',
  sections: [
    {
      heading: 'Live, estimated or scheduled',
      paragraphs: [
        'Live: the agency publishes where each vehicle is, from the vehicle’s own GPS, usually as a GTFS Realtime feed. This is most of what you see. TAKIP reads about 750 such feeds in about 40 countries, plus a few agencies’ own APIs.',
        'Estimated: some systems, often metros running underground where GPS doesn’t reach, publish only when each train will reach its next stations. TAKIP puts such a train between the station it left and the one it is heading to, as far along as those times say. The London Underground is placed this way, from TfL’s arrival predictions. A few systems publish positions they work out themselves from the timetable and live delays; those are marked estimated too.',
        'Scheduled: where a system publishes nothing live at all, as on the Istanbul and İzmir metros, trains run from the published timetable, each one where its timetable says it should be now. That is a planned service, not a sighting, and the map labels it so.',
      ],
    },
    {
      heading: 'Reading the markers',
      paragraphs: [
        'Vehicles appear from zoom 10, about a city at a time. Zoomed out, each city with transit data gets a ring, larger where more vehicles run; click one to fly in.',
        'Trains, trams, metros and cable cars are blue; buses, ferries and the rest are sandy yellow. A filled marker is a GPS position. A hollow one was placed from its stops or its timetable, and timetable trains are drawn fainter still. Anything the feed hasn’t updated for five minutes fades, since it may have moved on.',
        'From zoom 13 each marker gets a notch pointing the way it is heading, where the feed says, and from zoom 14 short route numbers are written beside them. The layer refreshes every 20 seconds while you are zoomed in.',
      ],
    },
    {
      heading: 'Clicking a vehicle',
      paragraphs: [
        'While a vehicle’s card is open, TAKIP checks it every 10 seconds, at any zoom and even with the layer switched off. Between updates it glides along its route rather than jumping, and leaves a trail behind it.',
      ],
      steps: [
        'Switch on Buses & Trains in the Layers panel and zoom in to a city.',
        'Click a vehicle. The card gives its route, its own number or plate where the feed sends one, its speed and heading, and the operator. For a train placed from its stops, it says which station it is at or between.',
        'Read the tags: Estimated position, or Timetable, not live. No recent position means the feed hasn’t updated it for five minutes.',
        'Press Follow to keep it in view. Dragging the map ends the follow.',
      ],
    },
    {
      heading: 'Where it works',
      paragraphs: [
        'Coverage follows open data. The United States, Canada and France have the most feeds; elsewhere it depends on whether each operator publishes. A city can have its trains on the map but not its buses, or the other way round.',
        'Each city the layer covers has a page of its own at /city/<place>/transit, such as /city/cincinnati/transit, naming its operators, how each one’s vehicles reach the map, and what is running there now.',
      ],
      spots: [
        { label: 'Istanbul', view: { lat: 41.01, lon: 28.97, zoom: 11 }, note: 'İETT buses live; the metro from its timetable.' },
        { label: 'London', view: { lat: 51.51, lon: -0.12, zoom: 11.5 }, note: 'The Underground, placed from TfL’s arrival predictions.' },
        { label: 'Chicago', view: { lat: 41.88, lon: -87.63, zoom: 11.5 }, note: 'The ‘L’ from its trains’ GPS, and Pace buses.' },
        { label: 'Toronto', view: { lat: 43.65, lon: -79.38, zoom: 11.5 }, note: 'TTC streetcars and buses, live.' },
      ],
    },
  ],
};
