'use client';

import { Bitcoin } from 'lucide-react';
import ChainBrief from '@/components/recon/chain-brief';
import type { ReconData } from '@/lib/recon-lookup';
import { SectionHeader, renderFallback } from './result-primitives';
import { ScannerResult, VulnResult, ShodanResult, BgpResult, MacResult } from './network-results';
import { DnsResult, WhoisResult, CertsResult, SslResult } from './domain-results';
import { UsernameResult, GithubResult, PhoneResult } from './identity-results';
import { ThreatsResult, LeaksResult } from './threat-results';
import { CryptoResult } from './chain-results';

export function StructuredResults({ activeTab, chainView, results, query, scanType }: {
  activeTab: string;
  chainView: 'brief' | 'wallet';
  results: ReconData;
  query: string;
  scanType: string;
}) {
  // The daily brief is self-loading and needs no query, so it renders
  // regardless of whether a lookup has been run.
  if (activeTab === 'crypto' && chainView === 'brief') {
    return (
      <div>
        <SectionHeader title="CHAIN INTEL — DAILY BRIEF" icon={Bitcoin} color="#F7931A" />
        <ChainBrief />
      </div>
    );
  }
  if (!results) return null;
  const r = results;
  const tool = { r, query, scanType };

  // ── PORT SCAN ──
  if (activeTab === 'scanner') return <ScannerResult {...tool} />;

  // ── VULN SCAN ──
  if (activeTab === 'vuln') return <VulnResult {...tool} />;

  // ── DNS ──
  if (activeTab === 'dns') return <DnsResult {...tool} />;

  // ── WHOIS ──
  if (activeTab === 'whois') return <WhoisResult {...tool} />;

  // ── SHODAN ──
  if (activeTab === 'shodan') return <ShodanResult {...tool} />;

  // ── BGP ──
  if (activeTab === 'bgp') return <BgpResult {...tool} />;

  // ── MAC ──
  if (activeTab === 'mac') return <MacResult {...tool} />;

  // ── PHONE ──
  if (activeTab === 'phone') return <PhoneResult {...tool} />;

  // ── GITHUB ──
  if (activeTab === 'github') return <GithubResult {...tool} />;

  // ── USERNAME HUNT ──
  if (activeTab === 'username') return <UsernameResult {...tool} />;

  // ── CHAIN INTEL ──
  if (activeTab === 'crypto') return <CryptoResult {...tool} />;

  // ── LEAKS ──
  if (activeTab === 'leaks') return <LeaksResult {...tool} />;

  // ── CERTS ──
  if (activeTab === 'certs') return <CertsResult {...tool} />;

  // ── THREATS ──
  if (activeTab === 'threats') return <ThreatsResult {...tool} />;

  // ── SSL ──
  if (activeTab === 'ssl') return <SslResult {...tool} />;

  // Fallback for other tools
  return renderFallback(r);
}
