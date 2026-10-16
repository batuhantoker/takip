/**
 * TAKIP — when and from where each craft in the Horizons fleet launched, so a replay can start on the pad.
 * Where a pad article only gives the complex's coordinates (SLC-17, LC-36, Vandenberg SLC-3 and SLC-4,
 * Baikonur Site 200), its pads share them.
 */

export interface Launch {
  /** UTC, ISO 8601. */
  utc: string;
  precision: 'minute' | 'day';
  pad: string;
  lat: number;
  /** Degrees east. */
  lng: number;
  vehicle: string;
}

/** By Horizons ID. Sources: each craft's Wikipedia article (infobox), pad coordinates from the pad's article. */
export const LAUNCHES: Record<number, Launch> = {
  [-151]: { utc: '1999-07-23T04:31:00Z', precision: 'minute', pad: 'Kennedy LC-39B', lat: 28.6272, lng: -80.6208, vehicle: 'Space Shuttle Columbia (STS-93) / IUS' },
  // Horizons starts ~12 h before launch on a back-propagated orbit; points before launch aren't real.
  [-125989]: { utc: '1999-12-10T14:32:00Z', precision: 'minute', pad: 'Kourou ELA-3', lat: 5.2390, lng: -52.7680, vehicle: 'Ariane 5G' },
  [-463]: { utc: '2026-05-19T03:52:10Z', precision: 'minute', pad: 'Kourou ELV', lat: 5.2360, lng: -52.7750, vehicle: 'Vega C' },
  // Infobox says 01:33; the Proton launch list and 2002 in spaceflight both say 04:41.
  [-198]: { utc: '2002-10-17T04:41:00Z', precision: 'minute', pad: 'Baikonur Site 200/39', lat: 46.0336, lng: 63.0289, vehicle: 'Proton-K / Blok DM-2' },
  // Horizons starts ~11 h before launch on a back-propagated orbit; points before launch aren't real.
  [-140482]: { utc: '2015-03-13T02:44:00Z', precision: 'minute', pad: 'Cape Canaveral SLC-41', lat: 28.5833, lng: -80.5831, vehicle: 'Atlas V 421' },
  [-140483]: { utc: '2015-03-13T02:44:00Z', precision: 'minute', pad: 'Cape Canaveral SLC-41', lat: 28.5833, lng: -80.5831, vehicle: 'Atlas V 421' },
  [-140484]: { utc: '2015-03-13T02:44:00Z', precision: 'minute', pad: 'Cape Canaveral SLC-41', lat: 28.5833, lng: -80.5831, vehicle: 'Atlas V 421' },
  [-140485]: { utc: '2015-03-13T02:44:00Z', precision: 'minute', pad: 'Cape Canaveral SLC-41', lat: 28.5833, lng: -80.5831, vehicle: 'Atlas V 421' },
  [-95]: { utc: '2018-04-18T22:51:30Z', precision: 'minute', pad: 'Cape Canaveral SLC-40', lat: 28.5619, lng: -80.5772, vehicle: 'Falcon 9' },
  [-85]: { utc: '2009-06-18T21:32:00Z', precision: 'minute', pad: 'Cape Canaveral SLC-41', lat: 28.5833, lng: -80.5831, vehicle: 'Atlas V 401' },
  [-152]: { utc: '2019-07-22T09:13:12Z', precision: 'minute', pad: 'Sriharikota Second Launch Pad', lat: 13.7199, lng: 80.2305, vehicle: 'GSLV Mk III' },
  [-155]: { utc: '2022-08-04T23:08:48Z', precision: 'minute', pad: 'Cape Canaveral SLC-40', lat: 28.5619, lng: -80.5772, vehicle: 'Falcon 9' },
  // Launched as THEMIS B and C.
  [-192]: { utc: '2007-02-17T23:01:00Z', precision: 'minute', pad: 'Cape Canaveral SLC-17B', lat: 28.4467, lng: -80.5661, vehicle: 'Delta II 7925-10C' },
  [-193]: { utc: '2007-02-17T23:01:00Z', precision: 'minute', pad: 'Cape Canaveral SLC-17B', lat: 28.4467, lng: -80.5661, vehicle: 'Delta II 7925-10C' },
  [-92]: { utc: '1997-08-25T14:39:00Z', precision: 'minute', pad: 'Cape Canaveral SLC-17A', lat: 28.4467, lng: -80.5661, vehicle: 'Delta II 7920-8' },
  [-8]: { utc: '1994-11-01T09:31:00Z', precision: 'minute', pad: 'Cape Canaveral SLC-17B', lat: 28.4467, lng: -80.5661, vehicle: 'Delta II 7925-10' },
  // Horizons starts at 00:00 that day on a back-propagated orbit; points before launch aren't real.
  [-21]: { utc: '1995-12-02T08:08:01Z', precision: 'minute', pad: 'Cape Canaveral LC-36B', lat: 28.4706, lng: -80.5400, vehicle: 'Atlas IIAS' },
  [-78]: { utc: '2015-02-11T23:03:42Z', precision: 'minute', pad: 'Cape Canaveral SLC-40', lat: 28.5619, lng: -80.5772, vehicle: 'Falcon 9 v1.1' },
  [-43]: { utc: '2025-09-24T11:30:00Z', precision: 'minute', pad: 'Kennedy LC-39A', lat: 28.6083, lng: -80.6044, vehicle: 'Falcon 9' },
  [-231]: { utc: '2025-09-24T11:30:00Z', precision: 'minute', pad: 'Kennedy LC-39A', lat: 28.6083, lng: -80.6044, vehicle: 'Falcon 9' },
  [-171]: { utc: '2025-09-24T11:30:00Z', precision: 'minute', pad: 'Kennedy LC-39A', lat: 28.6083, lng: -80.6044, vehicle: 'Falcon 9' },
  [-156]: { utc: '2023-09-02T06:20:00Z', precision: 'minute', pad: 'Sriharikota Second Launch Pad', lat: 13.7199, lng: 80.2305, vehicle: 'PSLV-XL' },
  [-680]: { utc: '2023-07-01T15:12:00Z', precision: 'minute', pad: 'Cape Canaveral SLC-40', lat: 28.5619, lng: -80.5772, vehicle: 'Falcon 9' },
  [-170]: { utc: '2021-12-25T12:20:00Z', precision: 'minute', pad: 'Kourou ELA-3', lat: 5.2390, lng: -52.7680, vehicle: 'Ariane 5 ECA' },
  [-211]: { utc: '2026-08-30T11:26:04Z', precision: 'minute', pad: 'Kennedy LC-39A', lat: 28.6083, lng: -80.6044, vehicle: 'Falcon Heavy' },
  [-9]: { utc: '2025-11-13T20:55:01Z', precision: 'minute', pad: 'Cape Canaveral LC-36A', lat: 28.4706, lng: -80.5400, vehicle: 'New Glenn' },
  [-10]: { utc: '2025-11-13T20:55:01Z', precision: 'minute', pad: 'Cape Canaveral LC-36A', lat: 28.4706, lng: -80.5400, vehicle: 'New Glenn' },
  [-41]: { utc: '2003-06-02T17:45:00Z', precision: 'minute', pad: 'Baikonur Site 31/6', lat: 45.9961, lng: 63.5642, vehicle: 'Soyuz-FG / Fregat' },
  [-53]: { utc: '2001-04-07T15:02:22Z', precision: 'minute', pad: 'Cape Canaveral SLC-17A', lat: 28.4467, lng: -80.5661, vehicle: 'Delta II 7925-9.5' },
  [-189]: { utc: '2018-05-05T11:05:01Z', precision: 'minute', pad: 'Vandenberg SLC-3E', lat: 34.6430, lng: -120.5885, vehicle: 'Atlas V 401' },
  [-76]: { utc: '2011-11-26T15:02:00Z', precision: 'minute', pad: 'Cape Canaveral SLC-41', lat: 28.5833, lng: -80.5831, vehicle: 'Atlas V 541' },
  [-74]: { utc: '2005-08-12T11:43:00Z', precision: 'minute', pad: 'Cape Canaveral SLC-41', lat: 28.5833, lng: -80.5831, vehicle: 'Atlas V 401' },
  [-253]: { utc: '2003-07-08T03:18:00Z', precision: 'minute', pad: 'Cape Canaveral SLC-17B', lat: 28.4467, lng: -80.5661, vehicle: 'Delta II 7925H' },
  [-254]: { utc: '2003-06-10T17:58:47Z', precision: 'minute', pad: 'Cape Canaveral SLC-17A', lat: 28.4467, lng: -80.5661, vehicle: 'Delta II 7925-9.5' },
  // Horizons starts ~1.3 h before launch, ~200,000 km out on a back-propagated orbit.
  [-143]: { utc: '2016-03-14T09:31:00Z', precision: 'minute', pad: 'Baikonur Site 200/39', lat: 46.0336, lng: 63.0289, vehicle: 'Proton-M / Briz-M' },
  // Infobox says 20 July; the H-IIA flight list and Horizons both put it on 19 July.
  [-62]: { utc: '2020-07-19T21:58:14Z', precision: 'minute', pad: 'Tanegashima LA-Y1', lat: 30.4022, lng: 130.9750, vehicle: 'H-IIA 202' },
  [-28]: { utc: '2023-04-14T12:14:36Z', precision: 'minute', pad: 'Kourou ELA-3', lat: 5.2390, lng: -52.7680, vehicle: 'Ariane 5 ECA' },
  [-40000]: { utc: '1994-01-25T16:34:00Z', precision: 'minute', pad: 'Vandenberg SLC-4W', lat: 34.6330, lng: -120.6130, vehicle: 'Titan II(23)G' },
  // Infoboxes name only the Guiana Space Centre; Ariane 5 flew only from ELA-3.
  [-489]: { utc: '2009-05-14T13:12:02Z', precision: 'minute', pad: 'Kourou ELA-3', lat: 5.2390, lng: -52.7680, vehicle: 'Ariane 5 ECA' },
  [-486]: { utc: '2009-05-14T13:12:02Z', precision: 'minute', pad: 'Kourou ELA-3', lat: 5.2390, lng: -52.7680, vehicle: 'Ariane 5 ECA' },
  [-159]: { utc: '2024-10-14T16:06:00Z', precision: 'minute', pad: 'Kennedy LC-39A', lat: 28.6083, lng: -80.6044, vehicle: 'Falcon Heavy' },
  [-37]: { utc: '2014-12-03T04:22:04Z', precision: 'minute', pad: 'Tanegashima LA-Y1', lat: 30.4022, lng: 130.9750, vehicle: 'H-IIA 202' },
  [-139479]: { utc: '2013-12-19T09:12:14Z', precision: 'minute', pad: 'Kourou ELS', lat: 5.3019, lng: -52.8346, vehicle: 'Soyuz ST-B / Fregat-MT' },
  // Horizons starts at liftoff on the pad, ascent included.
  [-64]: { utc: '2016-09-08T23:05:00Z', precision: 'minute', pad: 'Cape Canaveral SLC-41', lat: 28.5833, lng: -80.5831, vehicle: 'Atlas V 411' },
  [-143205]: { utc: '2018-02-06T20:45:00Z', precision: 'minute', pad: 'Kennedy LC-39A', lat: 28.6083, lng: -80.6044, vehicle: 'Falcon Heavy' },
  [-242]: { utc: '2025-02-27T00:16:30Z', precision: 'minute', pad: 'Kennedy LC-39A', lat: 28.6083, lng: -80.6044, vehicle: 'Falcon 9' },
  [-70007]: { utc: '2022-11-16T06:47:44Z', precision: 'minute', pad: 'Kennedy LC-39B', lat: 28.6272, lng: -80.6208, vehicle: 'SLS Block 1 (Artemis I)' },
  [-144]: { utc: '2020-02-10T04:03:00Z', precision: 'minute', pad: 'Cape Canaveral SLC-41', lat: 28.5833, lng: -80.5831, vehicle: 'Atlas V 411' },
  [-96]: { utc: '2018-08-12T07:31:00Z', precision: 'minute', pad: 'Cape Canaveral SLC-37B', lat: 28.5320, lng: -80.5668, vehicle: 'Delta IV Heavy / Star 48BV' },
  [-121]: { utc: '2018-10-20T01:45:00Z', precision: 'minute', pad: 'Kourou ELA-3', lat: 5.2390, lng: -52.7680, vehicle: 'Ariane 5 ECA' },
  // Horizons starts at 00:00 that day on a back-propagated orbit; points before launch aren't real.
  [-234]: { utc: '2006-10-26T00:52:00Z', precision: 'minute', pad: 'Cape Canaveral SLC-17B', lat: 28.4467, lng: -80.5661, vehicle: 'Delta II 7925-10L' },
  [-164]: { utc: '2022-12-11T07:38:23Z', precision: 'minute', pad: 'Cape Canaveral SLC-40', lat: 28.5619, lng: -80.5772, vehicle: 'Falcon 9' },
  [-91]: { utc: '2024-10-07T14:52:11Z', precision: 'minute', pad: 'Cape Canaveral SLC-40', lat: 28.5619, lng: -80.5772, vehicle: 'Falcon 9' },
  [-55]: { utc: '1990-10-06T11:47:16Z', precision: 'minute', pad: 'Kennedy LC-39B', lat: 28.6272, lng: -80.6208, vehicle: 'Space Shuttle Discovery (STS-41) / IUS / PAM-S' },
  [-227]: { utc: '2009-03-07T03:49:57Z', precision: 'minute', pad: 'Cape Canaveral SLC-17B', lat: 28.4467, lng: -80.5661, vehicle: 'Delta II 7925-10L' },
  [-255]: { utc: '2023-10-13T14:19:00Z', precision: 'minute', pad: 'Kennedy LC-39A', lat: 28.6083, lng: -80.6044, vehicle: 'Falcon Heavy' },
  [-79]: { utc: '2003-08-25T05:35:39Z', precision: 'minute', pad: 'Cape Canaveral SLC-17B', lat: 28.4467, lng: -80.5661, vehicle: 'Delta II 7920H' },
  [-203]: { utc: '2007-09-27T11:34:00Z', precision: 'minute', pad: 'Cape Canaveral SLC-17B', lat: 28.4467, lng: -80.5661, vehicle: 'Delta II 7925H' },
  [-49]: { utc: '2021-10-16T09:34:00Z', precision: 'minute', pad: 'Cape Canaveral SLC-41', lat: 28.5833, lng: -80.5831, vehicle: 'Atlas V 401' },
  [-61]: { utc: '2011-08-05T16:25:00Z', precision: 'minute', pad: 'Cape Canaveral SLC-41', lat: 28.5833, lng: -80.5831, vehicle: 'Atlas V 551' },
  [-98]: { utc: '2006-01-19T19:00:00Z', precision: 'minute', pad: 'Cape Canaveral SLC-41', lat: 28.5833, lng: -80.5831, vehicle: 'Atlas V 551' },
  [-24]: { utc: '1973-04-06T02:11:00Z', precision: 'minute', pad: 'Cape Canaveral LC-36B', lat: 28.4706, lng: -80.5400, vehicle: 'Atlas SLV-3D Centaur-D1A / Star 37E' },
  [-23]: { utc: '1972-03-03T01:49:04Z', precision: 'minute', pad: 'Cape Canaveral LC-36A', lat: 28.4706, lng: -80.5400, vehicle: 'Atlas SLV-3C Centaur-D / Star 37E' },
  [-32]: { utc: '1977-08-20T14:29:00Z', precision: 'minute', pad: 'Cape Canaveral SLC-41', lat: 28.5833, lng: -80.5831, vehicle: 'Titan IIIE / Centaur' },
  [-31]: { utc: '1977-09-05T12:56:01Z', precision: 'minute', pad: 'Cape Canaveral SLC-41', lat: 28.5833, lng: -80.5831, vehicle: 'Titan IIIE / Centaur' },
};
