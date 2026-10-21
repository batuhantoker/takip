import { describe, expect, it } from 'vitest';
import { EN } from './format';
import { compass, humidity, precipitationIn, skyOf, temperatureIn, unitsFor, weatherWords, windSpeedIn } from './weather-words';

describe('weather words', () => {
  it('uses the units the place reads', () => {
    expect(temperatureIn(20, unitsFor('US'), EN)).toBe('68 °F');
    expect(temperatureIn(20, unitsFor('FR'), EN)).toBe('20 °C');
    expect(windSpeedIn(10, unitsFor('GB'), EN)).toBe('22 mph');
    expect(windSpeedIn(10, unitsFor('TR'), EN)).toBe('36 km/h');
    expect(precipitationIn(25.4, unitsFor('US'), EN)).toBe('1 in');
    expect(precipitationIn(1.25, unitsFor('DE'), EN)).toBe('1.3 mm');
  });

  it('names the eight compass points, north wrapping round', () => {
    expect([0, 22, 23, 225, 337, 338, 360].map(d => compass(d, EN))).toEqual(['N', 'N', 'NE', 'SW', 'NW', 'N', 'N']);
  });

  it('works out humidity from the dew point', () => {
    expect(humidity(20, 20)).toBe(100);
    expect(humidity(20, 10)).toBe(53);
  });

  it('reads METAR weather groups', () => {
    expect(weatherWords('-SHRA BR', EN)).toEqual(['light rain showers', 'mist']);
    expect(weatherWords('+TSRAGR', EN)).toEqual(['heavy thunderstorm with rain and hail']);
    expect(weatherWords('FZDZ VCSH NSW', EN)).toEqual(['freezing drizzle']);
    expect(weatherWords('FZFG', EN)).toEqual(['freezing fog']);
  });

  it('sorts MET symbols into kinds of sky', () => {
    expect(skyOf('lightrainshowers_day')).toEqual({ sky: 'lightrain', night: false });
    expect(skyOf('heavysnowshowersandthunder_night')).toEqual({ sky: 'thunder', night: true });
    expect(skyOf('partlycloudy_polartwilight')).toEqual({ sky: 'partly', night: true });
    expect(skyOf('clearsky_day')?.sky).toBe('clear');
    expect(skyOf('sleet')?.sky).toBe('sleet');
    expect(skyOf(null)).toBeNull();
  });
});
