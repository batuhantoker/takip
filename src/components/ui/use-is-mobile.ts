'use client';

import { createContext, useContext, useEffect, useState } from 'react';

/** Set by an embed: its frame is small, but there is no phone shell for a sheet to sit on, so it keeps windows. */
export const InEmbed = createContext(false);

export function useIsMobile() {
  const embedded = useContext(InEmbed);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      // Mobile if narrow, OR landscape phone (short height + moderate width)
      setIsMobile(w < 768 || (h < 500 && w < 1024));
    };
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
