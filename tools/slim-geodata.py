#!/usr/bin/env python3
"""Slim the NTAD GeoJSON and OurAirports CSV downloads for map use (see data/reference/README.md).

Keeps a few fields per dataset, drops empty values, rounds coordinates to
5 decimals (~1 m) and simplifies lines and polygons with Douglas-Peucker.

    python3 tools/slim-geodata.py <download-dir> <out-dir>

Input files may keep their hash-suffixed download names.
"""
import csv
import json
import math
import os
import sys
from concurrent.futures import ProcessPoolExecutor

DECIMALS = 5
INFRA_M = 10
OVERVIEW_M = 50
# Keep low: a one-worker-per-core run coincided with the laptop freezing.
WORKERS = 4

AIRPORT_FIELDS = ['ident', 'type', 'name', 'elevation_ft', 'iso_country', 'iso_region', 'municipality',
                  'scheduled_service', 'icao_code', 'iata_code', 'gps_code', 'wikipedia_link']
RUNWAY_FIELDS = ['airport_ident', 'length_ft', 'width_ft', 'surface', 'lighted']
NUMERIC = {'elevation_ft', 'length_ft', 'width_ft', 'lighted'}

DATASETS = {
    'spaceports': {
        'src': 'NTAD_Spaceports_',
        'fields': ['Name', 'State', 'License', 'Launch_Type'],
    },
    'military-bases': {
        'src': 'NTAD_Military_Bases_',
        'tol': INFRA_M,
        'fields': ['siteName', 'siteReportingComponent', 'siteOperationalStatus', 'isJointBase', 'isFirrmaSite',
                   'stateNameCode'],
    },
    'rail-class-i': {
        'src': 'NTAD_North_American_Rail_Network_Lines_Class_I_Railroads_',
        'tol': INFRA_M,
        'fields': ['FRAARCID', 'FRFRANODE', 'TOFRANODE', 'RROWNER1', 'TRKRGHTS1', 'SUBDIV', 'TRACKS', 'NET', 'PASSNGR',
                   'STRACNET', 'STATEAB', 'MILES'],
    },
    'rail-passenger': {
        'src': 'NTAD_North_American_Rail_Network_Lines_Passenger_Rail_',
        'tol': INFRA_M,
        'fields': ['FRAARCID', 'FRFRANODE', 'TOFRANODE', 'RROWNER1', 'TRKRGHTS1', 'SUBDIV', 'TRACKS', 'PASSNGR',
                   'STATEAB', 'MILES'],
    },
    'amtrak-routes': {
        'src': 'NTAD_Amtrak_Routes_',
        'tol': OVERVIEW_M,
        'fields': ['name', 'ROUTE_URL'],
    },
    'highway-freight-network': {
        'src': 'NTAD_National_Highway_Freight_Network_',
        'tol': INFRA_M,
        'fields': ['ROUTEID', 'SIGN1', 'LNAME', 'NHFN_CODE', 'ST_NAME', 'LENGTH'],
    },
    'highway-planning-network': {
        'src': 'NTAD_National_Highway_Planning_Network_',
        'tol': INFRA_M,
        'fields': ['SIGN1', 'SIGNT1', 'LNAME', 'F_SYSTEM', 'FCLASS', 'NHS', 'STRAHNET', 'STFIPS', 'MILES'],
    },
    'tunnels': {
        'src': 'NTAD_National_Tunnel_Inventory_',
        'fields': ['tunnel_number_i1', 'tunnel_name_i2', 'facility_carried_i10', 'state_code_i3', 'year_built_a1',
                   'tunnel_length_g1', 'adt_a4', 'adtt_a5', 'min_vert_clearance_over_tunnel_', 'toll_c4',
                   'hazardous_material_restriction_', 'under_navigable_waterway_n1', 'number_of_bores_s1', 'owner_c1'],
    },
    'intercity-bus-routes': {
        'src': 'NTAD_Intercity_Bus_Atlas_Routes_',
        'tol': OVERVIEW_M,
        'fields': ['route_id', 'carrier_name', 'route_short_name', 'route_long_name', 'route_color', 'route_url'],
    },
    'intercity-bus-stops': {
        'src': 'NTAD_Intercity_Bus_Atlas_Stops_',
        'fields': ['stop_id', 'stop_name', 'carrier_name', 'place_name', 'state_usps', 'stop_timezone',
                   'wheelchair_boarding'],
    },
    'ferry-routes': {
        'src': 'NTAD_Ferry_Routes_',
        'tol': INFRA_M,
        'fields': ['segment_id', 'segment_name', 'operator_id', 'operator_name', 'seg_terminal1_id', 'seg_terminal2_id',
                   'average_trip_time', 'trips_per_year', 'segment_season_start', 'segment_season_end', 'passengers',
                   'vehicles', 'avg_daily_brd_pax'],
    },
    'ferry-terminals': {
        'src': 'NTAD_Ferry_Terminals_',
        'fields': ['TERMINAL_ID', 'TERMINAL_NAME', 'TERM_CITY', 'TERM_STATE', 'IN_OPERATION', 'TERMINAL_OPERATED_BY'],
        'group_by': ('TERMINAL_ID', 'OPERATOR_ID', 'OPERATOR_IDS'),
    },
    'waterway-links': {
        'src': 'Waterway_Networks_',
        'match': 'LineString',
        'tol': INFRA_M,
        'fields': ['LINKNUM', 'ANODE', 'BNODE', 'LINKNAME', 'RIVERNAME', 'LINKTYPE', 'GEO_CLASS', 'FUNC_CLASS',
                   'WTWY_TYPE', 'LENGTH'],
    },
    'waterway-nodes': {
        'src': 'Waterway_Networks_',
        'match': 'Point',
        'fields': ['NODENUM', 'PORT_ID', 'PORT_NAME', 'STATE', 'NON_US'],
    },
    'port-statistical-areas': {
        'src': 'Port_Statistical_Area_',
        'tol': INFRA_M,
        'fields': ['PORTIDPK', 'FEATURENAME', 'DATA_YEAR'],
    },
    'dams': {
        'src': 'NTAD_Dams_',
        'fields': ['nidId', 'name', 'ownerNames', 'primaryOwnerTypeId', 'primaryPurposeId', 'primaryDamTypeId',
                   'publicHazardId', 'conditionAssessId', 'eapId', 'nidHeight', 'nidStorage', 'maxDischarge',
                   'yearCompleted', 'riverName', 'state', 'county'],
    },
    'nps-boundaries': {
        'src': 'NPS_Boundary',
        'tol': INFRA_M,
        'fields': ['UNIT_CODE', 'UNIT_NAME', 'UNIT_TYPE', 'STATE', 'REGION'],
    },
}

EMPTY = {'', '#N\\A', '<Null>', 'N/A'}


def iter_features(path):
    # The downloads are one ~1 GB line of JSON, so decode a feature at a time.
    dec = json.JSONDecoder()
    chunk = 1 << 24
    with open(path, encoding='utf-8-sig') as f:
        buf = ''
        while '"features"' not in buf:
            more = f.read(chunk)
            if not more:
                return
            buf += more
        buf = buf[buf.index('[', buf.index('"features"')) + 1:]
        pos = 0
        while True:
            while pos < len(buf) and buf[pos] in ' \t\r\n,':
                pos += 1
            if pos < len(buf) and buf[pos] == ']':
                return
            try:
                obj, end = dec.raw_decode(buf, pos)
            except json.JSONDecodeError:
                more = f.read(chunk)
                if not more:
                    raise
                buf, pos = buf[pos:] + more, 0
                continue
            yield obj
            pos = end
            if pos > chunk:
                buf, pos = buf[pos:], 0


def first_geometry_type(path):
    for feat in iter_features(path):
        if feat.get('geometry'):
            return feat['geometry']['type']


def find_source(src_dir, name, spec):
    for f in sorted(os.listdir(src_dir)):
        if not f.endswith('.geojson'):
            continue
        if f == name + '.geojson' or f.startswith(spec['src']):
            path = os.path.join(src_dir, f)
            if 'match' not in spec or spec['match'] in first_geometry_type(path):
                return path


def clean_value(v):
    if isinstance(v, str):
        v = v.strip()
        return None if v in EMPTY else v
    if isinstance(v, float):
        return int(v) if v.is_integer() else round(v, 3)
    return v


def simplify(pts, tol_m):
    n = len(pts)
    if n < 3:
        return pts
    lat = sum(p[1] for p in pts) / n
    kx, ky = math.cos(math.radians(lat)) * 111320.0, 110574.0
    xs = [p[0] * kx for p in pts]
    ys = [p[1] * ky for p in pts]
    keep = bytearray(n)
    keep[0] = keep[-1] = 1
    tol2 = tol_m * tol_m
    stack = [(0, n - 1)]
    while stack:
        a, b = stack.pop()
        if b - a < 2:
            continue
        ax, ay = xs[a], ys[a]
        dx, dy = xs[b] - ax, ys[b] - ay
        seg2 = dx * dx + dy * dy
        best, idx = -1.0, -1
        for i in range(a + 1, b):
            px, py = xs[i] - ax, ys[i] - ay
            if seg2:
                t = (px * dx + py * dy) / seg2
                t = 0.0 if t < 0 else 1.0 if t > 1 else t
                px, py = px - t * dx, py - t * dy
            d = px * px + py * py
            if d > best:
                best, idx = d, i
        if best > tol2:
            keep[idx] = 1
            stack.append((a, idx))
            stack.append((idx, b))
    return [p for p, k in zip(pts, keep) if k]


def round_dedupe(pts):
    out = []
    for p in pts:
        q = [round(p[0], DECIMALS), round(p[1], DECIMALS)]
        if not out or q != out[-1]:
            out.append(q)
    return out


def slim_line(pts, tol):
    out = round_dedupe(simplify(pts, tol) if tol else pts)
    return out if len(out) > 1 else out * 2


def slim_ring(ring, tol):
    for candidate in ((simplify(ring, tol) if tol else ring), ring):
        out = round_dedupe(candidate)
        if out[0] != out[-1]:
            out.append(out[0])
        if len(out) >= 4:
            return out
    return None


def slim_polygon(rings, tol):
    outer = slim_ring(rings[0], tol)
    if outer is None:
        return None
    return [outer] + [r for r in (slim_ring(h, tol) for h in rings[1:]) if r]


def slim_geometry(g, tol):
    t, c = g['type'], g['coordinates']
    if t == 'Point':
        return {'type': t, 'coordinates': [round(c[0], DECIMALS), round(c[1], DECIMALS)]}
    if t == 'LineString':
        return {'type': t, 'coordinates': slim_line(c, tol)}
    if t == 'MultiLineString':
        return {'type': t, 'coordinates': [slim_line(part, tol) for part in c]}
    if t == 'Polygon':
        rings = slim_polygon(c, tol)
        return {'type': t, 'coordinates': rings} if rings else None
    if t == 'MultiPolygon':
        polys = [p for p in (slim_polygon(p, tol) for p in c) if p]
        return {'type': t, 'coordinates': polys} if polys else None
    raise ValueError('unsupported geometry ' + t)


def slim(job):
    name, src, out_dir = job
    spec = DATASETS[name]
    tol = spec.get('tol')
    group_key, list_src, list_dst = spec.get('group_by', (None, None, None))
    features, groups, dropped = [], {}, 0
    for feat in iter_features(src):
        g = feat.get('geometry')
        # NID has placeholder dams at (0, 0).
        if g is None or (g['type'] == 'Point' and abs(g['coordinates'][0]) < 1e-6 and abs(g['coordinates'][1]) < 1e-6):
            dropped += 1
            continue
        g = slim_geometry(g, tol)
        if g is None:
            dropped += 1
            continue
        raw = feat.get('properties') or {}
        props = {}
        for k in spec['fields']:
            v = clean_value(raw.get(k))
            if v is not None:
                props[k] = v
        if group_key:
            key = props.get(group_key)
            if key in groups:
                groups[key]['properties'][list_dst].add(raw[list_src])
                continue
            props[list_dst] = {raw[list_src]}
            groups[key] = {'type': 'Feature', 'properties': props, 'geometry': g}
            features.append(groups[key])
            continue
        features.append({'type': 'Feature', 'properties': props, 'geometry': g})
    if group_key:
        for feat in features:
            feat['properties'][list_dst] = sorted(feat['properties'][list_dst])
    out = os.path.join(out_dir, name + '.geojson')
    write_collection(out, features)
    return name, os.path.getsize(src), os.path.getsize(out), len(features), dropped


def write_collection(path, features):
    with open(path, 'w', encoding='utf-8') as f:
        f.write('{"type":"FeatureCollection","features":[\n')
        for i, feat in enumerate(features):
            f.write((',\n' if i else '') + json.dumps(feat, separators=(',', ':'), ensure_ascii=False))
        f.write('\n]}\n')


def csv_props(row, fields):
    props = {}
    for k in fields:
        v = row[k]
        if k in NUMERIC and v:
            v = float(v)
        v = clean_value(v)
        if v is not None:
            props[k] = v
    return props


def slim_ourairports(src_dir, out_dir):
    a_path, r_path = os.path.join(src_dir, 'airports.csv'), os.path.join(src_dir, 'runways.csv')
    if not (os.path.exists(a_path) and os.path.exists(r_path)):
        print('skip ourairports: airports.csv or runways.csv not found', file=sys.stderr)
        return
    with open(a_path, encoding='utf-8') as f:
        rows = [r for r in csv.DictReader(f)]
    closed_idents = {r['ident'] for r in rows if r['type'] == 'closed'}
    longest, runways, no_coords = {}, [], 0
    with open(r_path, encoding='utf-8') as f:
        for r in csv.DictReader(f):
            if r['closed'] == '1' or r['airport_ident'] in closed_idents:
                continue
            if r['length_ft']:
                ident = r['airport_ident']
                longest[ident] = max(longest.get(ident, 0), int(float(r['length_ft'])))
            ends = (r['le_longitude_deg'], r['le_latitude_deg'], r['he_longitude_deg'], r['he_latitude_deg'])
            if not all(ends):
                no_coords += 1
                continue
            x1, y1, x2, y2 = (float(v) for v in ends)
            props = csv_props(r, RUNWAY_FIELDS)
            props['name'] = '/'.join(filter(None, (r['le_ident'], r['he_ident'])))
            runways.append({'type': 'Feature', 'properties': props,
                            'geometry': {'type': 'LineString', 'coordinates': slim_line([[x1, y1], [x2, y2]], None)}})
    airports = []
    for r in rows:
        if r['type'] == 'closed':
            continue
        props = csv_props(r, AIRPORT_FIELDS)
        if r['ident'] in longest:
            props['longest_runway_ft'] = longest[r['ident']]
        point = [round(float(r['longitude_deg']), DECIMALS), round(float(r['latitude_deg']), DECIMALS)]
        airports.append({'type': 'Feature', 'properties': props, 'geometry': {'type': 'Point', 'coordinates': point}})
    for name, src, features, note in (('airports', a_path, airports, f'dropped {len(closed_idents)} closed'),
                                      ('runways', r_path, runways, f'dropped {no_coords} without both ends')):
        out = os.path.join(out_dir, name + '.geojson')
        write_collection(out, features)
        print(f'{name:26s} {os.path.getsize(src) / 1e6:8.1f} MB -> {os.path.getsize(out) / 1e6:7.1f} MB  '
              f'{len(features)} features, {note}')


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    src_dir, out_dir = sys.argv[1], sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)
    os.nice(10)
    slim_ourairports(src_dir, out_dir)
    jobs = []
    for name, spec in DATASETS.items():
        src = find_source(src_dir, name, spec)
        if src:
            jobs.append((name, src, out_dir))
        else:
            print(f'skip {name}: no source file', file=sys.stderr)
    jobs.sort(key=lambda j: -os.path.getsize(j[1]))
    with ProcessPoolExecutor(max_workers=WORKERS) as ex:
        for name, before, after, kept, dropped in ex.map(slim, jobs):
            note = f', dropped {dropped}' if dropped else ''
            print(f'{name:26s} {before / 1e6:8.1f} MB -> {after / 1e6:7.1f} MB  {kept} features{note}')


if __name__ == '__main__':
    main()
