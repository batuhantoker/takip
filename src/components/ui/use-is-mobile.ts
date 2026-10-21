'use client';

import { createContext, useContext, useEffect, useState } from 'react';

/** Set by an embed: its frame is small, but there is no phone shell for a sheet to sit on, so it keeps windows. */
export const InEmbed = createContext(false);

/** Narrow, or a landscape phone (short and not wide): the phone layout, for code outside React. */
export const isPhoneViewport = () => window.innerWidth < 768 || (window.innerHeight < 500 && window.innerWidth < 1024);

export function useIsMobile() {
  const embedded = useContext(InEmbed);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(isPhoneViewport());
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);
  return isMobile && !embedded;
}
