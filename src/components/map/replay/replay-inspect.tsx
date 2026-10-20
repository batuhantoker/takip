'use client';

import { useEffect } from 'react';
import { Plane, Ship } from 'lucide-react';
import { Stat } from '@/components/ui/stat';
import { Tag } from '@/components/ui/tag';
import { useIsMobile } from '@/components/ui/use-is-mobile';
import { useT } from '@/components/ui/use-t';
import { FloatingWindow } from '@/components/map/windows';
import { bearing, compass } from '@/components/map/inspect/format';
import { FLIGHT_LAYER_LABEL } from '@/components/map/inspect/live';
import { MoveActions } from '@/components/map/inspect/parts/inspect-actions';
import { InspectCard, Note, SourceLinks, StatRow } from '@/components/map/inspect/parts/inspect-card';
import { InspectSheet } from '@/components/map/inspect/parts/inspect-sheet';
import { isFollowed, useFollow } from '@/components/map/inspect/use-follow';
import type { MapRef } from '@/components/map/types';
import { toFeet } from '@/lib/feeds/aviation/flight-watch';
import { SHIP_CLASSES } from '@/lib/feeds/maritime/ship-filter';
import { course } from '@/lib/map/course';
import type { ReplaySession } from '@/lib/map/replay/session';
import { sampleEntity } from '@/lib/map/replay/track-sample';
import { pickReplay, replayEntity, replayFlightLayer, replayFollowKey, useReplayPick, type ReplayPick } from './replay-pick';
import { useReplayTick } from './use-replay';

/** The replayed ship or aircraft picked on the map or found by Search, in a window (a sheet on a phone). */
export function ReplayInspect({ mapRef, session }: { mapRef: MapRef; session: ReplaySession }) {
  const t = useT();
  const pick = useReplayPick();
  const isMobile = useIsMobile();
  if (!pick) return null;
  const close = () => pickReplay(null);
  const card = <ReplayCard key={pick.entity} pick={pick} mapRef={mapRef} session={session} onClose={close} />;
  if (isMobile) return <InspectSheet onClose={close}>{card}</InspectSheet>;
  return (
    <FloatingWindow id={replayFollowKey(pick.entity)} kind="inspect" label={pick.label || (pick.cls === 'aircraft' ? t('Aircraft') : t('Unnamed vessel'))} onClose={close}>
      {card}
    </FloatingWindow>
  );
}

/** Where it was at the replay clock's time, read from its recorded track; the camera follows it frame by frame. */
function ReplayCard({ pick, mapRef, session, onClose }: { pick: ReplayPick; mapRef: MapRef; session: ReplaySession; onClose: () => void }) {
  const t = useT();
  useReplayTick(session);
  const key = replayFollowKey(pick.entity);
  // No position handed over: useFollow's eased moves would trail a target that moves every frame.
  const { following, setFollowing } = useFollow(mapRef, null, key);
  const entity = replayEntity(pick.entity);
  const at = entity ? sampleEntity(entity, session.clock.time() / 1000) : null;

  useEffect(() => {
    if (!following) return;
    const go = () => {
      const e = replayEntity(pick.entity);
      const s = e && sampleEntity(e, session.clock.time() / 1000);
      if (s && isFollowed(key)) mapRef.current?.jumpTo({ center: [s.lon, s.lat] });
    };
    go();
    return session.clock.subscribe(go);
  }, [following, key, pick.entity, session, mapRef]);

  const aircraft = pick.cls === 'aircraft';
  const kind = aircraft
    ? t(FLIGHT_LAYER_LABEL[replayFlightLayer(pick.category)])
    : t(SHIP_CLASSES.find(c => c.type === pick.category)?.label ?? 'Vessel');
  const hdg = at ? course(at.heading, at.speed) : null;
  const callsign = aircraft ? pick.label.replace(/\s+/g, '') : '';

  return (
    <InspectCard
      icon={aircraft ? Plane : Ship}
      title={pick.label || (aircraft ? t('Aircraft') : t('Unnamed vessel'))}
      subtitle={kind}
      tags={<>
        <Tag>{t('Replay')}</Tag>
        {!at && <Tag tone="amber">{t('Not on the map at this time')}</Tag>}
        {at?.held && <Tag tone="amber">{t('Last seen here')}</Tag>}
      </>}
      onClose={onClose}
      headerActions={at && <MoveActions mapRef={mapRef} lat={at.lat} lng={at.lon} zoom={8} following={following} onFollow={setFollowing} />}
    >
      <StatRow>
        {aircraft && <Stat size="sm" label={t('Altitude')} value={at?.alt != null ? toFeet(at.alt).toLocaleString(t.intl) : '—'} unit="ft" />}
        <Stat size="sm" label={t('Speed')} value={at && at.speed > 0 ? Math.round(at.speed) : '—'} unit={aircraft ? 'kt' : 'kn'} />
        {hdg != null && <Stat size="sm" label={t('Heading')} value={bearing(hdg)} unit={compass(hdg)} />}
      </StatRow>
      <div className="mt-4 flex flex-col gap-3">
        <Note>{t('From recorded positions. Replay has no route or airframe details yet.')}</Note>
        {callsign && (
          <SourceLinks links={[{ href: `https://www.flightaware.com/live/flight/${encodeURIComponent(callsign)}/history`, label: 'FlightAware' }]} />
        )}
      </div>
    </InspectCard>
  );
}
