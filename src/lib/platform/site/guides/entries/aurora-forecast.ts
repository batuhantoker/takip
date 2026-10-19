import type { Guide } from '../types';

export const AURORA_FORECAST: Guide = {
  slug: 'how-the-aurora-forecast-works',
  section: 'space',
  title: 'How the aurora forecast works, and where to look',
  description: 'What an aurora forecast map shows: NOAA’s OVATION model, the auroral oval, what the Kp index means, and when and where to look for the northern lights.',
  heading: 'How the aurora forecast works',
  lede: 'The aurora is the Sun’s weather meeting Earth’s magnetic field. No forecast can promise a display, but one can say where the glow is likely in the next half hour. Here is what TAKIP’s aurora layer shows, and how to use it.',
  layers: ['aurora-forecast', 'cloud-map'],
  open: { layers: ['aurora'], view: { lat: 65, lon: -20, zoom: 2.5 } },
  checked: '2026-10-19',
  sections: [
    {
      heading: 'What makes the aurora',
      paragraphs: [
        'The Sun blows out a constant stream of charged particles, the solar wind. Earth’s magnetic field steers some of its energy down towards the poles, where particles strike the thin upper atmosphere, roughly 100 to 300 km up, and make it glow.',
        'The common green glow comes from oxygen. Red appears higher up, and nitrogen adds blue and purple at the lower edge.',
        'The glow forms a ring around each magnetic pole, the auroral oval. The magnetic poles sit away from the geographic ones, so in the north the oval reaches further south over Canada than over Siberia.',
      ],
    },
    {
      heading: 'Kp and the oval',
      paragraphs: [
        'When a strong gust of solar wind arrives, the oval brightens and spreads towards the equator. The Kp index measures how disturbed Earth’s magnetic field is, on a scale from 0 to 9, from magnetometers around the world over three-hour spans. On NOAA’s scale, Kp 5 is a minor geomagnetic storm and Kp 9 an extreme one. The higher it goes, the further from the poles the aurora can reach.',
        'Kp is a single number for the whole planet. The aurora layer is drawn from a model instead, which maps the chance of aurora place by place.',
      ],
    },
    {
      heading: 'What the map shows',
      paragraphs: [
        'The layer is NOAA’s OVATION aurora nowcast, from its Space Weather Prediction Center. The model works from the solar wind measured on its way to Earth, and gives, on a 1° grid, the chance that aurora will be overhead about 30 minutes from now.',
        'It shows as a glow over both poles, brighter where the chance is higher; places under 5% are left clear. NOAA updates it about every 5 minutes, and the map fetches it again as often. The line between day and night is drawn beneath it, because the aurora can only be seen in the dark.',
      ],
      steps: [
        'Open the map with the aurora forecast on.',
        'Find where the glow lies on the night side, not the day side.',
        'Switch on “Live Clouds” in the Layers panel to see whether the sky there is clear. NOAA’s cloud mosaic is new every hour.',
        'Come back every few minutes: the oval can shift and brighten quickly.',
      ],
    },
    {
      heading: 'When and where to look',
      paragraphs: [
        'You need darkness, a clear sky and as little artificial light as you can manage. The hours around midnight are often best. Far north, summer nights never get properly dark, so the season runs from autumn to spring, and activity tends to be higher around the equinoxes in March and September.',
        'Aurora overhead in one place can often be seen low on the horizon from a few hundred kilometres closer to the equator, so look towards the pole: north in the northern hemisphere, south in the southern.',
      ],
      spots: [
        { label: 'Tromsø', view: { lat: 69.65, lon: 18.96, zoom: 5 }, note: 'Northern Norway, under the oval on most clear nights.' },
        { label: 'Iceland', view: { lat: 64.9, lon: -18.6, zoom: 5 }, note: 'Most of the island lies under or near the oval.' },
        { label: 'Fairbanks', view: { lat: 64.84, lon: -147.72, zoom: 5 }, note: 'Interior Alaska, with long, dark winter nights.' },
        { label: 'Tasmania', view: { lat: -42, lon: 147, zoom: 5 }, note: 'For the southern lights, low over the southern horizon.' },
      ],
    },
    {
      heading: 'What it can’t tell you',
      paragraphs: [
        'It looks only about 30 minutes ahead, so it says nothing about tonight or tomorrow.',
        'It ignores cloud and moonlight. A high chance under cloud means nothing to see, and a bright Moon washes out a faint display.',
        'A percentage is the chance of aurora overhead, not how bright or colourful it will be. Cameras often pick up colour the eye sees only as a pale glow.',
      ],
    },
  ],
};
