'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface Exchange { name: string; country: string; open: boolean; }
interface CountryRisk { code: string; risk_score: number; risk_level: string; tags: string[]; }

export default function GlobalStatusBar() {
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [risks, setRisks] = useState<CountryRisk[]>([]);
  const [cyber, setCyber] = useState<any>(null);
  const [openCount, setOpenCount] = useState(0);
  const [scrollPos, setScrollPos] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [riskRes, cyberRes] = await Promise.allSettled([
          fetch('/api/country-risk'),
          fetch('/api/cyber-threats'),
        ]);
        if (riskRes.status === 'fulfilled' && riskRes.value.ok) {
          const d = await riskRes.value.json();
          setExchanges(d.exchanges || []);
          setRisks(d.countries || []);
          setOpenCount(d.open_exchanges || 0);
        }
        if (cyberRes.status === 'fulfilled' && cyberRes.value.ok) {
          setCyber(await cyberRes.value.json());
        }
      } catch {}
    };
    fetchData();
    const iv = setInterval(fetchData, 300000);
    return () => clearInterval(iv);
  }, []);

  // Ticker scroll
  useEffect(() => {
    const iv = setInterval(() => setScrollPos(p => p - 0.5), 30);
    return () => clearInterval(iv);
  }, []);

  const topRisks = risks.slice(0, 6);
  const cveCount = cyber?.stats?.active_cves || 0;

  const riskColor = (level: string) =>
    level === 'CRITICAL' ? '#FF3D3D' : level === 'HIGH' ? '#FF9500' : level === 'ELEVATED' ? '#FFD700' : '#00E676';

  const countryFlag = (code: string) => {
    try {
      return String.fromCodePoint(...code.toUpperCase().split('').map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
    } catch { return code; }
  };

  if (exchanges.length === 0 && risks.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 4, duration: 0.6 }}
      className="absolute top-10 md:top-11 left-0 right-0 z-[199] pointer-events-none"
    >
      <div className="mx-auto max-w-[100vw] overflow-hidden">
        <div className="flex items-center gap-0 h-5 text-[6px] font-mono tracking-wider">
          {/* Exchange ticker */}
          <div className="flex-shrink-0 bg-[var(--bg-panel)] border-y border-[var(--border-secondary)] px-2 flex items-center gap-1.5 h-full">
            <span className="text-[var(--text-muted)]">EXCHANGES</span>
            <span className="text-[var(--gold-primary)] font-bold">{openCount}/{exchanges.length}</span>
          </div>

          {/* Scrolling ticker */}
          <div className="flex-1 bg-[var(--bg-panel)]/60 border-y border-[var(--border-secondary)] h-full overflow-hidden">
            <div className="flex items-center h-full gap-3 whitespace-nowrap" style={{ transform: `translateX(${scrollPos}px)` }}>
              {/* Exchange dots */}
              {exchanges.map(ex => (
                <span key={ex.name} className="flex items-center gap-0.5">
                  <span className={`w-1 h-1 rounded-full ${ex.open ? 'bg-[var(--alert-green)]' : 'bg-[var(--text-muted)]/30'}`} />
                  <span className={ex.open ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]/50'}>{ex.name}</span>
                </span>
              ))}

              <span className="text-[var(--border-primary)]">│</span>

              {/* Risk countries */}
              {topRisks.map(r => (
                <span key={r.code} className="flex items-center gap-0.5">
                  <span className="text-[7px]">{countryFlag(r.code)}</span>
                  <span style={{ color: riskColor(r.risk_level) }} className="font-bold">{r.risk_score}</span>
                </span>
              ))}

              <span className="text-[var(--border-primary)]">│</span>

              {/* Cyber */}
              <span className="flex items-center gap-0.5">
                <span className="text-[#E040FB]">CYBER</span>
                <span className="text-[var(--text-primary)]">{cveCount} CVEs</span>
              </span>

              {/* Duplicate for seamless loop */}
              {exchanges.map(ex => (
                <span key={`d-${ex.name}`} className="flex items-center gap-0.5">
                  <span className={`w-1 h-1 rounded-full ${ex.open ? 'bg-[var(--alert-green)]' : 'bg-[var(--text-muted)]/30'}`} />
                  <span className={ex.open ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]/50'}>{ex.name}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
