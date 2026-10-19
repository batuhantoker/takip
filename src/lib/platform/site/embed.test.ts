import { describe, expect, it } from 'vitest';
import { embedPath, hasEmbed, pageEmbed } from './embed';
import { LAYER_PAGES } from './layer-pages';

describe('hasEmbed', () => {
  it('gives an embed to the pages about today’s map, and none to History, deep time, Space, Replay or the tools', () => {
    expect(LAYER_PAGES.filter(hasEmbed).map(p => p.slug)).toEqual([
      'flight-tracker', 'military-aircraft', 'private-jets', 'airport-delays', 'airport-weather', 'turbulence-sigmets', 'gps-jamming',
      'ship-tracker', 'chokepoints',
      'satellite-tracker', 'iss-tracker', 'starlink', 'military-satellites', 'gps-satellites', 'rocket-launches', 'aurora-forecast',
      'night-sky', 'day-night-map',
      'rain-radar', 'wind-map', 'temperature-map', 'lightning-map', 'live-satellite-earth', 'cloud-map', 'daily-satellite-images',
      'earthquakes', 'wildfires', 'severe-weather', 'hurricanes', 'radiation', 'disease-outbreaks',
      'live-cameras', 'plate-readers', 'live-news',
      'traffic', 'live-transit', 'hiking-trails',
      'world-news-map', 'air-raid-alerts', 'disaster-alerts',
      'internet-outages', 'ddos-attacks', 'malware-map', 'service-outages', 'undersea-cables',
    ]);
  });
});

describe('pageEmbed', () => {
  it('carries the page’s layers, view and what it follows', () => {
    const iss = LAYER_PAGES.find(p => p.slug === 'iss-tracker')!;
    expect(pageEmbed(iss)).toEqual({ layers: ['sat_science'], view: { lat: 0, lon: 0, zoom: 2 }, track: 'satellite:25544' });
    expect(embedPath(iss.slug)).toBe('/embed/iss-tracker');
  });
});
