import type { AircraftDetail } from './schemas';

export interface AdsbdbResponse {
  response?: {
    aircraft?: {
      manufacturer?: string;
      type?: string;
      registered_owner?: string;
      registration?: string;
      icao_type?: string;
    };
  };
}

type AdsbdbAircraft = NonNullable<NonNullable<AdsbdbResponse['response']>['aircraft']>;

export interface AdsbFiAircraft {
  r?: string;
  t?: string;
  desc?: string;
  ownOp?: string;
}

type Identity = Pick<AircraftDetail, 'registration' | 'typeCode' | 'model' | 'operator'>;

/** Each field from the first source that has it: adsbdb, then adsb.fi. */
export function mergeIdentity(db: AdsbdbAircraft | null | undefined, live: AdsbFiAircraft | null | undefined): Identity {
  const dbModel = db?.manufacturer && db?.type ? `${db.manufacturer} ${db.type}` : db?.type;
  return {
    registration: db?.registration || live?.r?.trim() || null,
    typeCode: db?.icao_type || live?.t?.trim() || null,
    model: dbModel || live?.desc?.trim() || null,
    operator: db?.registered_owner || live?.ownOp?.trim() || null,
  };
}
