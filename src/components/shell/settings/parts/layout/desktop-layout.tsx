'use client';

import { ArrowDownLeft, ArrowDownRight, ArrowUpLeft, ArrowUpRight, SeparatorHorizontal } from 'lucide-react';
import { startArranging } from '@/components/shell/layout/arrange/arrange-state';
import { CONTROL_LABELS, CORNER_LABELS, OVERLAY_LABELS, RAIL_LABELS, STATUS_LABELS } from '@/components/shell/layout/lib/labels';
import {
  CONTROL_IDS, CORNERS, backToCorners, isShown, moveToCorner, setCornerList, setRail, setRailBreak, setStatusList, setStatusSide,
  type Corner, type PageLayout, type Side,
} from '@/components/shell/layout/lib/model';
import { updateLayout } from '@/components/shell/layout/use-page-layout';
import { showAccountDialog } from '@/components/site/account/account-dialog-state';
import { Row, Section, SmallButton } from '@/components/site/account/settings/settings-parts';
import { IconButton } from '@/components/ui/button';
import { cx } from '@/components/ui/class-names';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { Tag } from '@/components/ui/tag';
import { useT } from '@/components/ui/use-t';
import { msg } from '@/lib/core/i18n/translator';
import { OrderList, PieceRow, ShownSwitch, Subhead } from './rows';

const CORNER_ICONS = { 'top-left': ArrowUpLeft, 'top-right': ArrowUpRight, 'bottom-left': ArrowDownLeft, 'bottom-right': ArrowDownRight };
const SIDES: Side[] = ['left', 'right'];
const SIDE_LABELS: Record<Side, string> = { left: msg('Left'), right: msg('Right') };

const Name = ({ children }: { children: string }) => <span className="min-w-0 flex-1 truncate text-body text-ink-1">{children}</span>;

/** The desktop's sidebar, map pieces, map controls and status bar. */
export default function DesktopLayout({ layout }: { layout: PageLayout }) {
  const t = useT();
  const d = layout.desktop;
  const barOn = isShown(layout, 'desktop', 'statusbar');
  const placed = Object.keys(d.free).length;
  const cornerOptions: SegmentedOption<Corner>[] = CORNERS.map(c => ({ value: c, icon: CORNER_ICONS[c], label: <span className="sr-only">{t(CORNER_LABELS[c])}</span> }));
  const sideOptions: SegmentedOption<Side>[] = SIDES.map(s => ({ value: s, label: t(SIDE_LABELS[s]) }));
  return (
    <>
      <Section title={t('Sidebar')}>
        <OrderList items={d.rail} onOrder={rail => updateLayout(l => setRail(l, rail))} label={id => t(RAIL_LABELS[id])}
          row={id => (
            <>
              <Name>{t(RAIL_LABELS[id])}</Name>
              <IconButton label={t('Gap above {name}', { name: t(RAIL_LABELS[id]) })} icon={SeparatorHorizontal} size="sm" active={d.railBreaks.includes(id)}
                onClick={() => updateLayout(l => setRailBreak(l, id, !l.desktop.railBreaks.includes(id)))} />
            </>
          )}
          trailing={id => <ShownSwitch layout={layout} form="desktop" piece={`rail:${id}`} label={t(RAIL_LABELS[id])} />} />
        <PieceRow layout={layout} form="desktop" piece="rail:ai" label="TI" detail={t('Always last, below its rule')} />
        <p className="text-small text-ink-3">{t('More and your account always stay, so Settings is a click away. A hidden panel still opens from its key.')}</p>
      </Section>

      <Section title={t('Map pieces')}>
        {/* Settings steps aside so the map is clear to arrange. */}
        <Row label={t('Move them anywhere')} detail={t('Drag the pieces on the map itself')}>
          <SmallButton onClick={() => { showAccountDialog(null); startArranging(); }}>{t('Arrange')}</SmallButton>
        </Row>
        {placed > 0 && (
          <Row label={t('Placed by hand')} detail={t('{n, plural, one {# piece sits where you dragged it} other {# pieces sit where you dragged them}}', { n: placed })}>
            <SmallButton onClick={() => updateLayout(backToCorners)}>{t('Back to corners')}</SmallButton>
          </Row>
        )}
        <p className="text-small text-ink-3">{t('Or keep them in corners: each lists what sits nearest the corner first, and picking a corner puts a placed piece back. A hidden search still opens with /.')}</p>
        {CORNERS.map(corner => (
          <div key={corner} className="flex flex-col">
            <Subhead>{t(CORNER_LABELS[corner])}</Subhead>
            <OrderList items={d.corners[corner]} onOrder={ids => updateLayout(l => setCornerList(l, corner, ids))} label={id => t(OVERLAY_LABELS[id])}
              row={id => (
                <>
                  <Name>{t(OVERLAY_LABELS[id])}</Name>
                  {d.free[id] && <Tag>{t('Placed')}</Tag>}
                  <Segmented size="sm" label={t('Corner for {name}', { name: t(OVERLAY_LABELS[id]) })} value={corner} options={cornerOptions}
                    onChange={to => updateLayout(l => moveToCorner(l, id, to))} />
                </>
              )}
              trailing={id => <ShownSwitch layout={layout} form="desktop" piece={`overlay:${id}`} label={t(OVERLAY_LABELS[id])} />} />
          </div>
        ))}
      </Section>

      <Section title={t('Map controls')}>
        {CONTROL_IDS.map(id => <PieceRow key={id} layout={layout} form="desktop" piece={`control:${id}`} label={t(CONTROL_LABELS[id])} />)}
      </Section>

      <Section title={t('Status bar')}>
        <PieceRow layout={layout} form="desktop" piece="statusbar" label={t('Status bar')} detail={t('Off, the map runs to the bottom of the screen')} />
        <div className={cx('flex flex-col', !barOn && 'pointer-events-none opacity-40')} inert={!barOn}>
          {SIDES.map(side => (
            <div key={side} className="flex flex-col">
              <Subhead>{t(SIDE_LABELS[side])}</Subhead>
              <OrderList items={d.status[side]} onOrder={ids => updateLayout(l => setStatusList(l, side, ids))} label={id => t(STATUS_LABELS[id])}
                row={id => (
                  <>
                    <Name>{t(STATUS_LABELS[id])}</Name>
                    <Segmented size="sm" label={t('Side for {name}', { name: t(STATUS_LABELS[id]) })} value={side} options={sideOptions}
                      onChange={to => updateLayout(l => setStatusSide(l, id, to))} />
                  </>
                )}
                trailing={id => <ShownSwitch layout={layout} form="desktop" piece={`status:${id}`} label={t(STATUS_LABELS[id])} />} />
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
