'use client';

import { PanelSection } from '@/components/ui/panel';
import { Stat } from '@/components/ui/stat';
import { Tag } from '@/components/ui/tag';
import type { Tone } from '@/components/ui/class-names';

interface Advisory { issuer: string; country?: string; level: number; label: string; change: string | null; updated_at: string | null; url: string }
interface StreetCrime { month: string; total: number; top: { category: string; label: string; count: number }[] }
interface Displacement { year: number; refugees_from: number; asylum_seekers_from: number; idps: number; refugees_hosted: number; asylum_seekers_hosted: number; url: string }

const LEVEL_TONE: Tone[] = ['green', 'amber', 'amber', 'red', 'red'];

const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n));

/** Travel advice and displacement for the clicked country, and which sources did not answer. */
export default function DossierSignals({ advice, displacement, crime, unavailable }: {
  advice?: Advisory[];
  displacement?: Displacement | null;
  crime?: StreetCrime | null;
  unavailable?: string[];
}) {
  const fled = displacement ? displacement.refugees_from + displacement.asylum_seekers_from : 0;
  const hosted = displacement ? displacement.refugees_hosted + displacement.asylum_seekers_hosted : 0;
  return (
    <>
      {!!advice?.length && (
        <PanelSection title="Travel advice">
          <div className="flex flex-col gap-3">
            {advice.map(a => (
              <div key={`${a.issuer}:${a.country ?? ''}`} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-3">
                  {/* The US splits some places in two (West Bank, Gaza), so an issuer can have several rows. */}
                  <span className="text-small text-ink-2">{a.issuer}{advice.filter(b => b.issuer === a.issuer).length > 1 ? ` · ${a.country}` : ''}</span>
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                    <Tag tone={LEVEL_TONE[a.level] ?? 'red'}>{a.label}</Tag>
                  </a>
                </div>
                {a.change && <span className="text-meta text-ink-3">{a.change}{a.updated_at ? ` · ${a.updated_at.slice(0, 10)}` : ''}</span>}
              </div>
            ))}
          </div>
        </PanelSection>
      )}
      {displacement && (fled > 0 || hosted > 0 || displacement.idps > 0) && (
        <PanelSection title="Displacement" hint={`UNHCR ${displacement.year}`}>
          <div className="grid grid-cols-3 gap-4">
            <Stat size="sm" label="Fled abroad" value={fmt(fled)} />
            <Stat size="sm" label="Displaced inside" value={fmt(displacement.idps)} />
            <Stat size="sm" label="Sheltering here" value={fmt(hosted)} />
          </div>
        </PanelSection>
      )}
      {crime && (
        <PanelSection title="Street crime within a mile" hint={`${crime.month} · data.police.uk`}>
          <div className="text-body text-ink-1"><span className="font-mono tabular-nums">{crime.total.toLocaleString()}</span> reported</div>
          <div className="mt-0.5 text-small text-ink-3">{crime.top.slice(0, 3).map(t => `${t.label} ${t.count}`).join(' · ')}</div>
        </PanelSection>
      )}
      {!!unavailable?.length && <p className="mt-4 text-meta text-ink-3">No answer from {unavailable.join(' or ')}.</p>}
    </>
  );
}
