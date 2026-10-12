'use client';

interface Advisory { issuer: string; country?: string; level: number; label: string; change: string | null; updated_at: string | null; url: string }
interface StreetCrime { month: string; total: number; top: { category: string; label: string; count: number }[] }
interface Displacement { year: number; refugees_from: number; asylum_seekers_from: number; idps: number; refugees_hosted: number; asylum_seekers_hosted: number; url: string }

const LEVEL_COLORS = ['var(--alert-green)', 'var(--gold-primary)', 'var(--gold-primary)', 'var(--alert-red)', 'var(--alert-red)'];

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
      {advice?.map(a => (
        <div key={`${a.issuer}:${a.country ?? ''}`}>
          {/* The US splits some places in two (West Bank, Gaza), so an issuer can have several rows. */}
          <div className="hud-label mb-0.5">TRAVEL ADVICE · {a.issuer}{advice.filter(b => b.issuer === a.issuer).length > 1 ? ` · ${a.country}` : ''}</div>
          <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{ color: LEVEL_COLORS[a.level] ?? 'var(--alert-red)' }}>{a.label}</a>
          {a.change && <div className="text-[9px] text-[var(--text-muted)] mt-0.5">{a.change}{a.updated_at ? ` (${a.updated_at.slice(0, 10)})` : ''}</div>}
        </div>
      ))}
      {displacement && (fled > 0 || hosted > 0 || displacement.idps > 0) && (
        <div>
          <div className="hud-label mb-0.5">DISPLACEMENT · UNHCR {displacement.year}</div>
          <div className="grid grid-cols-3 gap-2 text-xs text-[var(--text-primary)] font-mono">
            <div title="Refugees and asylum seekers from this country"><div className="text-[9px] text-[var(--text-muted)]">FLED</div>{fmt(fled)}</div>
            <div title="Internally displaced people"><div className="text-[9px] text-[var(--text-muted)]">IDPs</div>{fmt(displacement.idps)}</div>
            <div title="Refugees and asylum seekers sheltering here"><div className="text-[9px] text-[var(--text-muted)]">HOSTED</div>{fmt(hosted)}</div>
          </div>
        </div>
      )}
      {crime && (
        <div>
          <div className="hud-label mb-0.5">STREET CRIME WITHIN 1 MILE · {crime.month} · data.police.uk</div>
          <div className="text-xs text-[var(--text-primary)] font-mono">{crime.total.toLocaleString()} reported</div>
          <div className="text-[9px] text-[var(--text-muted)]">{crime.top.slice(0, 3).map(t => `${t.label} ${t.count}`).join(' · ')}</div>
        </div>
      )}
      {!!unavailable?.length && <div className="text-[9px] text-[var(--text-muted)]">No answer from {unavailable.join(' or ')}.</div>}
    </>
  );
}
