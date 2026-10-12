import { describe, it, expect } from 'vitest';
import { parseKayseriMap } from './turkey';

// Verbatim from https://izle.kayseri.bel.tr/harita.
const MAP_PAGE = `
            // Kamera verilerini JavaScript'e aktar
            const cameras = [

                    {
                        id: 24,
                        title: "Tekir Çeşmeler",
                        slug: "tekir-cesmeler",
                        lat: 38.546362,
                        lng: 35.525396,
                        category: "Erciyes"
                    },
                    
                    {
                        id: 50,
                        title: "Cumhuriyet Meydanı 2 ",
                        slug: "cumhuriyet-meydani-2",
                        lat: 38.722617,
                        lng: 35.487084,
                        category: "&#x15E;ehir Merkezi"
                    },
                                ];
`;

describe('parseKayseriMap', () => {
  it('maps each camera to its thumbnail and its live page', () => {
    expect(parseKayseriMap(MAP_PAGE)).toEqual([
      {
        id: 'tr-kayseri-24',
        lat: 38.546362,
        lng: 35.525396,
        name: 'Tekir Çeşmeler',
        city: 'Kayseri',
        country: 'Turkey',
        feed_url: 'https://izle.kayseri.bel.tr/kameraGorsel/24',
        stream_type: 'jpg',
        external_url: 'https://izle.kayseri.bel.tr/kamera/tekir-cesmeler',
        source: 'Kayseri Büyükşehir Belediyesi',
      },
      expect.objectContaining({ id: 'tr-kayseri-50', name: 'Cumhuriyet Meydanı 2' }),
    ]);
  });

  it('decodes escaped titles', () => {
    const page = '{ id: 7, title: "Kayseri\\u0027nin &#x15E;ehir \\"Merkezi\\"", slug: "x", lat: 38.7, lng: 35.4 }';
    expect(parseKayseriMap(page)[0].name).toBe('Kayseri\'nin Şehir "Merkezi"');
  });

  it('drops placeholder coordinates and duplicates', () => {
    const entry = (id: number, lat: number, lng: number) =>
      `{ id: ${id}, title: "Cam", slug: "cam-${id}", lat: ${lat}, lng: ${lng}, category: "Trafik" }`;
    const cams = parseKayseriMap([entry(1, 0, 0), entry(2, 38.7, 35.4), entry(2, 38.7, 35.4)].join(','));
    expect(cams.map(c => c.id)).toEqual(['tr-kayseri-2']);
  });

  it('finds nothing in a page without the list', () => {
    expect(parseKayseriMap('<html><body>Bakım çalışması</body></html>')).toEqual([]);
  });
});
