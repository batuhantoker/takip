import type { TransitMode } from '../modes';

/**
 * Vehicle positions out of a GTFS Realtime FeedMessage (gtfs.org/realtime/reference), and the stops
 * of vehicles that report no position. A minimal protobuf reader: only the fields the map draws are
 * decoded, the rest skipped by wire type.
 */

export interface RtVehicle {
  /** The vehicle's own id where the feed gives one, else the entity id; unique within one feed only. */
  id: string;
  lat: number;
  lng: number;
  bearing?: number;
  /** Metres per second. */
  speed?: number;
  route?: string;
  trip?: string;
  label?: string;
  plate?: string;
  operator?: string;
  /** VehicleStopStatus: 0 arriving, 1 stopped at, 2 in transit to. */
  status?: number;
  /** Unix seconds; the feed header's time when the vehicle has none. */
  t?: number;
  /** Placed from its stops, not a GPS fix: the stop it is at or heading to, and the one it left. */
  stop?: string;
  from?: string;
  estimated?: boolean;
  /** Where the source says; otherwise the feed's routes.txt decides. */
  mode?: TransitMode;
  /** The route's public name where `route` is an internal id. */
  line?: string;
  /** Run from the timetable: the system publishes nothing live. */
  scheduled?: boolean;
}

/** A vehicle the feed gives by stop alone, with no position: NYC's subway knows the track circuit, not the coordinates. */
export interface RtStopFix {
  /** The trip where there is one: such feeds renumber their entities every message. */
  id: string;
  stopId: string;
  /** VehicleStopStatus; absent is IN_TRANSIT_TO, the proto default. */
  status: number;
  route?: string;
  trip?: string;
  label?: string;
  t?: number;
  /** The stop it last left and when, where the feed says (a trip update that keeps passed stops). */
  fromId?: string;
  left?: number;
}

/** One stop of a trip update; times are Unix seconds. */
export interface RtStopTime {
  stop: string;
  arrive?: number;
  depart?: number;
  seq?: number;
}

/** A trip's progress from its TripUpdate: the last stop it left, where the feed still lists it, and its next few. */
export interface RtTripTimes {
  route?: string;
  left?: RtStopTime;
  next: RtStopTime[];
}

export interface RtFeed {
  timestamp?: number;
  vehicles: RtVehicle[];
  atStops: RtStopFix[];
  trips: Map<string, RtTripTimes>;
}

const utf8 = new TextDecoder();

class Reader {
  pos: number;
  private view: DataView;

  constructor(private buf: Uint8Array, start = 0, readonly end = buf.length) {
    this.pos = start;
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  get done() { return this.pos >= this.end; }

  private need(n: number) {
    if (this.pos + n > this.end) throw new Error('GTFS-RT: truncated message');
  }

  varint(): number {
    let result = 0;
    // Multiplication, not shifts: uint64 timestamps pass 2^32.
    for (let shift = 0, i = 0; i < 10; i++, shift += 7) {
      this.need(1);
      const b = this.buf[this.pos++];
      result += (b & 0x7f) * 2 ** shift;
      if (b < 0x80) return result;
    }
    throw new Error('GTFS-RT: varint too long');
  }

  float(): number {
    this.need(4);
    const v = this.view.getFloat32(this.pos, true);
    this.pos += 4;
    return v;
  }

  bytes(): Reader {
    const len = this.varint();
    this.need(len);
    const sub = new Reader(this.buf, this.pos, this.pos + len);
    this.pos += len;
    return sub;
  }

  string(): string {
    const sub = this.bytes();
    return utf8.decode(this.buf.subarray(sub.pos, sub.end));
  }

  skip(wire: number) {
    if (wire === 0) this.varint();
    else if (wire === 1) { this.need(8); this.pos += 8; }
    else if (wire === 2) this.bytes();
    else if (wire === 5) { this.need(4); this.pos += 4; }
    else throw new Error(`GTFS-RT: unexpected wire type ${wire}`);
  }

  /** Calls `field` for every tag until the end; it returns false to have the value skipped. */
  each(field: (num: number, wire: number) => boolean) {
    while (!this.done) {
      const tag = this.varint();
      const wire = tag & 7;
      if (!field(Math.floor(tag / 8), wire)) this.skip(wire);
    }
  }
}

const finite = (v: number | undefined) => (v != null && Number.isFinite(v) ? v : undefined);

function readHeader(r: Reader): number | undefined {
  let ts = undefined as number | undefined;
  r.each((n, w) => {
    if (n === 3 && w === 0) { ts = r.varint(); return true; }
    return false;
  });
  return ts || undefined;
}

function readVehicle(r: Reader, entityId: string): RtVehicle | RtStopFix | null {
  const v: Partial<RtVehicle> & { vid?: string } = {};
  // Assigned inside the field callbacks, which TypeScript's narrowing doesn't follow.
  let lat = undefined as number | undefined, lng = undefined as number | undefined;
  let stopId = '';
  r.each((n, w) => {
    if (n === 1 && w === 2) {
      const t = r.bytes();
      t.each((tn, tw) => {
        if (tn === 1 && tw === 2) { v.trip = t.string(); return true; }
        if (tn === 5 && tw === 2) { v.route = t.string(); return true; }
        return false;
      });
      return true;
    }
    if (n === 2 && w === 2) {
      const p = r.bytes();
      p.each((pn, pw) => {
        if (pw !== 5) return false;
        if (pn === 1) lat = p.float();
        else if (pn === 2) lng = p.float();
        else if (pn === 3) v.bearing = finite(p.float());
        else if (pn === 5) v.speed = finite(p.float());
        else return false;
        return true;
      });
      return true;
    }
    if (n === 4 && w === 0) { v.status = r.varint(); return true; }
    if (n === 5 && w === 0) { v.t = r.varint() || undefined; return true; }
    if (n === 7 && w === 2) { stopId = r.string(); return true; }
    if (n === 8 && w === 2) {
      const d = r.bytes();
      d.each((dn, dw) => {
        if (dw !== 2) return false;
        if (dn === 1) v.vid = d.string();
        else if (dn === 2) v.label = d.string();
        else if (dn === 3) v.plate = d.string();
        else return false;
        return true;
      });
      return true;
    }
    return false;
  });
  const { vid, ...rest } = v;
  if (lat == null && lng == null && stopId) {
    const { route, trip, label, t, status } = rest;
    return { id: vid || trip || entityId, stopId, status: status ?? 2, route, trip, label, t };
  }
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || (Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01)) return null;
  return { ...rest, id: vid || entityId, lat, lng };
}

/** Enough of a trip's upcoming stops to time the run to its next one. */
const MAX_NEXT = 3;

/** A TripUpdate's last passed stop, where it is still listed, and its next few; `now` is the feed's own time. */
function readTripUpdate(r: Reader, now: number): [string, RtTripTimes] | null {
  let trip = '', route: string | undefined;
  let left: RtStopTime | undefined;
  const next: RtStopTime[] = [];
  r.each((n, w) => {
    if (n === 1 && w === 2) {
      const t = r.bytes();
      t.each((tn, tw) => {
        if (tn === 1 && tw === 2) { trip = t.string(); return true; }
        if (tn === 5 && tw === 2) { route = t.string(); return true; }
        return false;
      });
      return true;
    }
    if (n === 2 && w === 2 && next.length < MAX_NEXT) {
      const u = r.bytes();
      const st: RtStopTime = { stop: '' };
      u.each((un, uw) => {
        if (un === 1 && uw === 0) { st.seq = u.varint(); return true; }
        if (un === 4 && uw === 2) { st.stop = u.string(); return true; }
        if ((un === 2 || un === 3) && uw === 2) {
          const e = u.bytes();
          e.each((en, ew) => {
            if (en !== 2 || ew !== 0) return false;
            const at = e.varint() || undefined;
            if (un === 2) st.arrive = at; else st.depart = at;
            return true;
          });
          return true;
        }
        return false;
      });
      const until = st.depart ?? st.arrive;
      if (!st.stop || until == null) return true;
      if (until < now) left = st;
      else next.push(st);
      return true;
    }
    return false;
  });
  return trip && (left || next.length) ? [trip, { route, left, next }] : null;
}

/** Throws on a body that isn't a FeedMessage: an HTML error page, JSON, a truncated download. */
export function decodeVehiclePositions(buf: Uint8Array): RtFeed {
  const r = new Reader(buf);
  let timestamp: number | undefined;
  const vehicles: RtVehicle[] = [];
  const atStops: RtStopFix[] = [];
  const trips: RtFeed['trips'] = new Map();
  let sawHeader = false as boolean;
  r.each((n, w) => {
    if (n === 1 && w === 2) { sawHeader = true; timestamp = readHeader(r.bytes()); return true; }
    if (n === 2 && w === 2) {
      const e = r.bytes();
      let id = '';
      let deleted = false;
      let vehicle = null as Reader | null, update = null as Reader | null;
      e.each((en, ew) => {
        if (en === 1 && ew === 2) { id = e.string(); return true; }
        if (en === 2 && ew === 0) { deleted = e.varint() !== 0; return true; }
        if (en === 3 && ew === 2) { update = e.bytes(); return true; }
        if (en === 4 && ew === 2) { vehicle = e.bytes(); return true; }
        return false;
      });
      if (deleted) return true;
      if (vehicle) {
        const v = readVehicle(vehicle, id);
        if (v && 'stopId' in v) atStops.push(v);
        else if (v) vehicles.push(v);
      }
      if (update) {
        // A malformed TripUpdate costs only its own times, never the positions.
        try {
          const t = readTripUpdate(update, timestamp ?? Date.now() / 1000);
          if (t) trips.set(...t);
        } catch { /* skipped */ }
      }
      return true;
    }
    return false;
  });
  if (!sawHeader) throw new Error('GTFS-RT: no feed header');
  if (timestamp) for (const v of [...vehicles, ...atStops]) v.t ??= timestamp;
  return { timestamp, vehicles, atStops, trips };
}
