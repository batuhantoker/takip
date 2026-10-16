'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { useIsMobile } from '@/components/ui/use-is-mobile';
import { useAccess } from '@/components/site/account/use-access';
import { AD_CLIENT, AD_SLOTS, showAds } from '@/lib/platform/ads';
import AdblockNotice from './adblock-notice';
import { baitHidden } from './adblock-bait';

type AdsState = { on: boolean; blocked: boolean };

const HAS_SLOTS = Boolean(AD_SLOTS.panel || AD_SLOTS.page);

const AdsContext = createContext<AdsState>({ on: false, blocked: false });

export const useAds = () => useContext(AdsContext);

/** Loads Google's ad script for plans that show ads, and notices when a blocker stops it. */
export default function AdsProvider({ children }: { children: ReactNode }) {
  return AD_CLIENT ? <AdsRuntime client={AD_CLIENT}>{children}</AdsRuntime> : children;
}

function AdsRuntime({ client, children }: { client: string; children: ReactNode }) {
  const access = useAccess();
  const on = showAds(client, access, usePathname());
  const [scriptFailed, setScriptFailed] = useState(false);
  const [baitCaught, setBaitCaught] = useState(false);
  // The phone map has no slot, so there it would be asking for ads it can't show.
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!on || !HAS_SLOTS) return;
    let live = true;
    const timer = setTimeout(() => void baitHidden().then(hidden => live && hidden && setBaitCaught(true)), 2000);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [on]);

  const blocked = on && (scriptFailed || baitCaught);

  return (
    <AdsContext.Provider value={{ on, blocked }}>
      {children}
      {on && (
        <Script id="adsbygoogle" strategy="afterInteractive" crossOrigin="anonymous"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
          // Offline looks the same as blocked from here.
          onError={() => navigator.onLine && setScriptFailed(true)} />
      )}
      {blocked && HAS_SLOTS && !isMobile && <AdblockNotice />}
    </AdsContext.Provider>
  );
}
