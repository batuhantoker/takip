'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Shield, Globe, Server, Lock, AlertTriangle, X, Loader2, Radar } from 'lucide-react';

type OsintTab = 'ip' | 'dns' | 'certs' | 'whois' | 'threats' | 'scanner';

const TABS: { id: OsintTab; label: string; icon: any; placeholder: string }[] = [
  { id: 'scanner', label: 'NMAP', icon: Radar, placeholder: 'IP or domain to scan' },
  { id: 'ip', label: 'IP', icon: Globe, placeholder: '8.8.8.8' },
  { id: 'dns', label: 'DNS', icon: Server, placeholder: 'example.com' },
  { id: 'certs', label: 'CERTS', icon: Lock, placeholder: 'example.com' },
  { id: 'whois', label: 'WHOIS', icon: Shield, placeholder: 'example.com' },
  { id: 'threats', label: 'THREATS', icon: AlertTriangle, placeholder: '8.8.8.8 or domain' },
];

export default function OsintPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<OsintTab>('ip');
  const [query, setQuery] = useState('');
  const [scanType, setScanType] = useState('quick');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState('');

  const runLookup = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setResults(null);

    try {
      let url = '';
      switch (activeTab) {
        case 'ip': url = `/api/osint/ip?ip=${encodeURIComponent(query)}`; break;
        case 'dns': url = `/api/osint/dns?domain=${encodeURIComponent(query)}`; break;
        case 'certs': url = `/api/osint/certs?domain=${encodeURIComponent(query)}`; break;
        case 'whois': url = `/api/osint/whois?domain=${encodeURIComponent(query)}`; break;
        case 'threats': url = `/api/osint/threats?query=${encodeURIComponent(query)}`; break;
        case 'scanner': url = `/api/scanner?target=${encodeURIComponent(query)}&type=${scanType}`; break;
      }
      const res = await fetch(url);
      if (res.ok) {
        setResults(await res.json());
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Lookup failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [query, activeTab, scanType]);

  const renderResults = () => {
    if (!results) return null;

    if (activeTab === 'ip' && results.geo) {
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            <ResultField label="COUNTRY" value={`${results.geo.country} (${results.geo.country_code})`} />
            <ResultField label="CITY" value={`${results.geo.city}, ${results.geo.region}`} />
            <ResultField label="COORDS" value={`${results.geo.lat}, ${results.geo.lon}`} />
            <ResultField label="TIMEZONE" value={results.geo.timezone} />
            <ResultField label="ISP" value={results.geo.isp} />
            <ResultField label="ORG" value={results.geo.org} />
            <ResultField label="ASN" value={results.geo.as_number} />
            <ResultField label="AS NAME" value={results.geo.as_name} />
          </div>
          <div className="flex gap-2 mt-2">
            <Badge label="PROXY" active={results.reputation?.is_proxy} />
            <Badge label="HOSTING" active={results.reputation?.is_hosting} />
            <Badge label="MOBILE" active={results.reputation?.is_mobile} />
          </div>
          <RiskBadge level={results.reputation?.risk_level || 'LOW'} />
        </div>
      );
    }

    if (activeTab === 'dns' && results.summary) {
      return (
        <div className="space-y-2">
          <ResultField label="TOTAL RECORDS" value={results.summary.total_records} />
          {results.summary.ip_addresses?.length > 0 && (
            <ResultField label="A RECORDS" value={results.summary.ip_addresses.join(', ')} />
          )}
          {results.summary.mail_servers?.length > 0 && (
            <ResultField label="MX RECORDS" value={results.summary.mail_servers.join(', ')} />
          )}
          {results.summary.nameservers?.length > 0 && (
            <ResultField label="NS RECORDS" value={results.summary.nameservers.join(', ')} />
          )}
          {Object.entries(results.records || {}).map(([type, records]: [string, any]) => (
            records.length > 0 && (
              <div key={type} className="text-[7px] font-mono">
                <span className="text-[var(--gold-primary)]">{type}</span>
                {records.slice(0, 3).map((r: any, i: number) => (
                  <div key={i} className="text-[var(--text-muted)] pl-2 truncate">{r.data}</div>
                ))}
              </div>
            )
          ))}
        </div>
      );
    }

    if (activeTab === 'certs') {
      return (
        <div className="space-y-2">
          <ResultField label="TOTAL CERTIFICATES" value={results.total_certs} />
          <ResultField label="UNIQUE SUBDOMAINS" value={results.unique_subdomains} />
          {results.subdomains?.length > 0 && (
            <div>
              <span className="text-[7px] font-mono text-[var(--gold-primary)] tracking-widest">DISCOVERED SUBDOMAINS</span>
              <div className="mt-1 max-h-32 overflow-y-auto styled-scrollbar space-y-0.5">
                {results.subdomains.map((s: string) => (
                  <div key={s} className="text-[7px] font-mono text-[var(--cyan-primary)] truncate">{s}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (activeTab === 'whois') {
      return (
        <div className="space-y-2">
          {results.registration && <ResultField label="REGISTERED" value={new Date(results.registration).toLocaleDateString()} />}
          {results.expiration && <ResultField label="EXPIRES" value={new Date(results.expiration).toLocaleDateString()} />}
          {results.last_changed && <ResultField label="LAST CHANGED" value={new Date(results.last_changed).toLocaleDateString()} />}
          {results.rdap?.nameservers?.length > 0 && (
            <ResultField label="NAMESERVERS" value={results.rdap.nameservers.join(', ')} />
          )}
          {results.rdap?.status?.length > 0 && (
            <ResultField label="STATUS" value={results.rdap.status.join(', ')} />
          )}
          {results.security_score && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[7px] font-mono text-[var(--text-muted)] tracking-widest">SECURITY GRADE</span>
              <span className={`text-[10px] font-bold ${
                results.security_score.grade === 'A' ? 'text-[var(--alert-green)]' :
                results.security_score.grade === 'B' ? 'text-[var(--gold-primary)]' :
                'text-[#FF3D3D]'
              }`}>{results.security_score.grade} ({results.security_score.score}/{results.security_score.max})</span>
            </div>
          )}
          {results.http?.headers && Object.keys(results.http.headers).length > 0 && (
            <div>
              <span className="text-[7px] font-mono text-[var(--gold-primary)] tracking-widest">HTTP HEADERS</span>
              {Object.entries(results.http.headers).map(([k, v]: [string, any]) => (
                <div key={k} className="text-[6px] font-mono text-[var(--text-muted)] truncate">{k}: {v}</div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (activeTab === 'threats') {
      return (
        <div className="space-y-2">
          <RiskBadge level={results.threat_level || 'LOW'} />
          {results.tor_exit_node !== undefined && (
            <Badge label="TOR EXIT NODE" active={results.tor_exit_node} />
          )}
          {results.otx && (
            <>
              <ResultField label="OTX PULSE COUNT" value={results.otx.pulse_count} />
              {results.otx.country && <ResultField label="COUNTRY" value={results.otx.country} />}
              {results.otx.asn && <ResultField label="ASN" value={results.otx.asn} />}
            </>
          )}
        </div>
      );
    }

    if (activeTab === 'scanner' && results.ports) {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ResultField label="TARGET" value={results.target} />
            {results.ip && <ResultField label="IP" value={results.ip} />}
          </div>
          <ResultField label="OPEN PORTS" value={`${results.open_ports} found`} />
          {results.os_guess && <ResultField label="OS" value={results.os_guess} />}
          {results.ports.length > 0 && (
            <div>
              <span className="text-[7px] font-mono text-[var(--gold-primary)] tracking-widest">PORT SCAN RESULTS</span>
              <div className="mt-1 space-y-1">
                {results.ports.map((p: any) => (
                  <div key={p.port} className="flex items-center gap-2 py-0.5 border-b border-[var(--border-secondary)]/30">
                    <span className="text-[8px] font-mono text-[var(--cyan-primary)] font-bold w-10">{p.port}</span>
                    <span className={`text-[6px] font-mono px-1 rounded ${p.state === 'open' ? 'bg-[var(--alert-green)]/15 text-[var(--alert-green)]' : 'bg-[#FF3D3D]/15 text-[#FF3D3D]'}`}>{p.state}</span>
                    <span className="text-[7px] font-mono text-[var(--text-secondary)]">{p.service}</span>
                    {p.product && <span className="text-[6px] font-mono text-[var(--text-muted)]">{p.product} {p.version}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {results.certificate && (
            <div>
              <span className="text-[7px] font-mono text-[var(--gold-primary)] tracking-widest">SSL CERTIFICATE</span>
              {results.certificate.subject && <ResultField label="SUBJECT" value={results.certificate.subject} />}
              {results.certificate.issuer && <ResultField label="ISSUER" value={results.certificate.issuer} />}
              {results.certificate.not_after && <ResultField label="EXPIRES" value={results.certificate.not_after} />}
            </div>
          )}
          {results.hops && (
            <div>
              <span className="text-[7px] font-mono text-[var(--gold-primary)] tracking-widest">TRACEROUTE ({results.hop_count} hops)</span>
              <div className="mt-1 max-h-32 overflow-y-auto styled-scrollbar">
                {results.hops.map((h: string, i: number) => (
                  <div key={i} className="text-[6px] font-mono text-[var(--text-muted)]">{h}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    return <pre className="text-[6px] font-mono text-[var(--text-muted)] overflow-auto max-h-40">{JSON.stringify(results, null, 2)}</pre>;
  };

  return (
    <>
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="glass-panel px-3 py-1.5 flex items-center gap-1.5 pointer-events-auto hover:border-[var(--cyan-primary)]/40 transition-colors"
      >
        <Search className="w-3 h-3 text-[var(--cyan-primary)]" />
        <span className="text-[8px] font-mono text-[var(--text-primary)] tracking-widest">OSINT</span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute top-12 right-0 w-80 glass-panel p-3 pointer-events-auto z-[400] osiris-glow"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[var(--cyan-primary)]" />
                <span className="text-[9px] font-mono text-[var(--text-primary)] tracking-widest font-bold">OSIRIS RECON</span>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X className="w-3 h-3" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-0.5 mb-2 overflow-x-auto">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setActiveTab(t.id); setResults(null); setError(''); }}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[6px] font-mono tracking-wider transition-all whitespace-nowrap ${
                    activeTab === t.id
                      ? 'bg-[var(--cyan-primary)]/15 text-[var(--cyan-primary)] border border-[var(--cyan-primary)]/30'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-transparent'
                  }`}
                >
                  <t.icon className="w-2.5 h-2.5" />
                  {t.label}
                </button>
              ))}
            </div>

            {/* Scan type selector for NMAP tab */}
            {activeTab === 'scanner' && (
              <div className="flex gap-0.5 mb-2">
                {['quick', 'ports', 'ssl', 'traceroute', 'headers'].map(t => (
                  <button key={t} onClick={() => setScanType(t)}
                    className={`px-1.5 py-0.5 rounded text-[5px] font-mono tracking-wider ${scanType === t ? 'bg-[var(--gold-primary)]/15 text-[var(--gold-primary)] border border-[var(--gold-primary)]/30' : 'text-[var(--text-muted)] border border-transparent hover:text-[var(--text-primary)]'}`}
                  >{t.toUpperCase()}</button>
                ))}
              </div>
            )}

            {/* Search Input */}
            <div className="flex gap-1.5 mb-2">
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runLookup()}
                placeholder={TABS.find(t => t.id === activeTab)?.placeholder}
                className="flex-1 px-2 py-1.5 rounded bg-[var(--bg-void)] border border-[var(--border-primary)] text-[8px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/40 focus:outline-none focus:border-[var(--cyan-primary)]/50"
              />
              <button
                onClick={runLookup}
                disabled={loading || !query.trim()}
                className="px-3 py-1.5 rounded bg-[var(--cyan-primary)]/15 border border-[var(--cyan-primary)]/30 text-[7px] font-mono text-[var(--cyan-primary)] tracking-widest hover:bg-[var(--cyan-primary)]/25 disabled:opacity-30 transition-all"
              >
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'SCAN'}
              </button>
            </div>

            {/* Results */}
            {error && (
              <div className="p-2 rounded bg-[#FF3D3D]/10 border border-[#FF3D3D]/20 text-[7px] font-mono text-[#FF3D3D]">{error}</div>
            )}

            {loading && (
              <div className="flex items-center justify-center py-6 gap-2">
                <Loader2 className="w-4 h-4 text-[var(--cyan-primary)] animate-spin" />
                <span className="text-[8px] font-mono text-[var(--text-muted)] tracking-widest animate-pulse">SCANNING...</span>
              </div>
            )}

            {results && !loading && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-h-64 overflow-y-auto styled-scrollbar"
              >
                {renderResults()}
              </motion.div>
            )}

            <div className="mt-2 text-center text-[5px] font-mono text-[var(--text-muted)]/50 tracking-widest">
              OSIRIS RECON v3.0 · NMAP POWERED SCANNER
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function ResultField({ label, value }: { label: string; value: any }) {
  if (!value) return null;
  return (
    <div className="flex flex-col">
      <span className="text-[6px] font-mono text-[var(--text-muted)] tracking-widest">{label}</span>
      <span className="text-[8px] font-mono text-[var(--text-primary)] truncate">{String(value)}</span>
    </div>
  );
}

function Badge({ label, active }: { label: string; active: boolean }) {
  return (
    <span className={`px-1.5 py-0.5 rounded text-[6px] font-mono tracking-wider border ${
      active
        ? 'bg-[#FF3D3D]/15 text-[#FF3D3D] border-[#FF3D3D]/30'
        : 'bg-[var(--alert-green)]/10 text-[var(--alert-green)] border-[var(--alert-green)]/20'
    }`}>
      {active ? '⚠' : '✓'} {label}
    </span>
  );
}

function RiskBadge({ level }: { level: string }) {
  const color = level === 'HIGH' ? '#FF3D3D' : level === 'MEDIUM' ? '#FF9500' : '#00E676';
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[6px] font-mono text-[var(--text-muted)] tracking-widest">RISK</span>
      <span className="px-2 py-0.5 rounded text-[7px] font-mono font-bold tracking-wider" style={{ color, background: `${color}15`, border: `1px solid ${color}30` }}>
        {level}
      </span>
    </div>
  );
}
