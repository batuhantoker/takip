import { describe, it, expect } from 'vitest';
import { parsePlacemarks, mapPlacemark, fetchMadridCameras, type MadridPlacemark } from './madrid';

// Two placemarks from informo.madrid.es/informo/tmadrid/CCTV.kml (2026-10-12).
const KML = `﻿<kml xmlns="http://earth.google.com/kml/2.2">
  <Document>
    <name>CCTV.kml</name>
    <Placemark>
      <description>&lt;div align=center&gt;&lt;img src=https://informo.madrid.es/cameras/Camara06303.jpg?v=23864  width=300 height=220/&gt;&lt;br/&gt;PLAZA DE CASTILLA (NORTE)&lt;/div&gt;</description>
      <styleUrl>#m_ylw-pushpin</styleUrl>
      <ExtendedData>
        <Data name="Numero">
          <Value>06303</Value>
        </Data>
        <Data name="Nombre">
          <Value>PLAZA DE CASTILLA (NORTE)</Value>
        </Data>
      </ExtendedData>
      <Point>
        <altitudeMode>relativeToGround</altitudeMode>
        <coordinates>-3.68894207537291,40.466063829633,10 </coordinates>
      </Point>
    </Placemark>
    <Placemark>
      <description>&lt;div align=center&gt;&lt;img src=https://informo.madrid.es/cameras/Camara06304.jpg?v=23864  width=300 height=220/&gt;&lt;br/&gt;PLAZA DE CASTILLA (SUR)&lt;/div&gt;</description>
      <styleUrl>#m_ylw-pushpin</styleUrl>
      <ExtendedData>
        <Data name="Numero">
          <Value>06304</Value>
        </Data>
        <Data name="Nombre">
          <Value>PLAZA DE CASTILLA (SUR)</Value>
        </Data>
      </ExtendedData>
      <Point>
        <altitudeMode>relativeToGround</altitudeMode>
        <coordinates>-3.68963237924212,40.4657761535436,10 </coordinates>
      </Point>
    </Placemark>
  </Document>
</kml>`;

const sample: MadridPlacemark = { numero: '06303', nombre: 'PLAZA DE CASTILLA (NORTE)', lat: 40.466063829633, lng: -3.68894207537291 };

describe('parsePlacemarks', () => {
  it('reads number, name and coordinates', () => {
    expect(parsePlacemarks(KML)).toEqual([
      sample,
      { numero: '06304', nombre: 'PLAZA DE CASTILLA (SUR)', lat: 40.4657761535436, lng: -3.68963237924212 },
    ]);
  });

  it('decodes entities and tolerates a placemark without coordinates', () => {
    const kml = '<Placemark><Data name="Numero"><Value>1</Value></Data><Data name="Nombre"><Value>A &amp; B</Value></Data></Placemark>';
    const [p] = parsePlacemarks(kml);
    expect(p.nombre).toBe('A & B');
    expect(mapPlacemark(p)).toBeNull();
  });
});

describe('mapPlacemark', () => {
  it('maps a placemark, keeping the zero-padded number', () => {
    expect(mapPlacemark(sample)).toEqual({
      id: 'madrid-06303',
      lat: 40.466063829633,
      lng: -3.68894207537291,
      name: 'PLAZA DE CASTILLA (NORTE)',
      city: 'Madrid',
      country: 'Spain',
      feed_url: 'https://informo.madrid.es/cameras/Camara06303.jpg',
      source: 'Ayuntamiento de Madrid',
    });
  });

  it('skips bad numbers and coordinates outside the city', () => {
    expect(mapPlacemark({ ...sample, numero: '' })).toBeNull();
    expect(mapPlacemark({ ...sample, numero: '06303/../x' })).toBeNull();
    expect(mapPlacemark({ ...sample, lat: NaN })).toBeNull();
    // Toledo.
    expect(mapPlacemark({ ...sample, lat: 39.8628, lng: -4.0273 })).toBeNull();
  });

  it('falls back to a default name', () => {
    expect(mapPlacemark({ ...sample, nombre: '' })?.name).toBe('Madrid Camera 06303');
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchMadridCameras (live)', () => {
  liveIt('fetches the city set', async () => {
    const cams = await fetchMadridCameras();
    expect(cams.length).toBeGreaterThan(300);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    for (const cam of cams) expect(cam.feed_url).toMatch(/^https:\/\/informo\.madrid\.es\/cameras\/Camara\d+\.jpg$/);
  });
});
