'use client';

import ChainBrief from './chain-brief';
import type { ReconData } from '@/lib/intel/recon/lookup';
import { renderFallback } from './result-primitives';
import { ScannerResult, VulnResult, ShodanResult, BgpResult, MacResult } from './network-results';
import { DnsResult, WhoisResult, CertsResult, SslResult } from './domain-results';
import { HeadersResult, TechResult, SubdomainsResult } from './scan-results';
import { UsernameResult, GithubResult, PhoneResult } from './identity-results';
import { ThreatsResult, LeaksResult } from './threat-results';
import { CryptoResult } from './chain-results';

export function StructuredResults({ activeTab, chainView, results, query }: {
  activeTab: string;
  chainView: 'brief' | 'wallet';
  results: ReconData;
  query: string;
}) {
  // The daily brief loads itself and needs no query.
  if (activeTab === 'crypto' && chainView === 'brief') return <ChainBrief />;
  if (!results) return null;
  const tool = { r: results, query };

  switch (activeTab) {
    case 'scanner': return <ScannerResult {...tool} />;
    case 'vuln': return <VulnResult {...tool} />;
    case 'dns': return <DnsResult {...tool} />;
    case 'whois': return <WhoisResult {...tool} />;
    case 'shodan': return <ShodanResult {...tool} />;
    case 'bgp': return <BgpResult {...tool} />;
    case 'mac': return <MacResult {...tool} />;
    case 'phone': return <PhoneResult {...tool} />;
    case 'github': return <GithubResult {...tool} />;
    case 'username': return <UsernameResult {...tool} />;
    case 'crypto': return <CryptoResult {...tool} />;
    case 'leaks': return <LeaksResult {...tool} />;
    case 'certs': return <CertsResult {...tool} />;
    case 'threats': return <ThreatsResult {...tool} />;
    case 'ssl': return <SslResult {...tool} />;
    case 'headers': return <HeadersResult {...tool} />;
    case 'tech': return <TechResult {...tool} />;
    case 'subdomains': return <SubdomainsResult {...tool} />;
    default: return renderFallback(results);
  }
}
