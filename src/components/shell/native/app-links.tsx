'use client';

import { useEffect } from 'react';
import { closeSystemBrowser, hideSplash, launchLink, minimizeApp, onAppLink, onBackButton } from '@/lib/platform/native/bridge';
import { APP_VERIFY_PATH, appLinkPath } from '@/lib/platform/native/handoff';

// The cold-start link stays the launch URL for the app's whole run; handled once per web view.
const LAUNCH_KEY = 'takip.app.launchLink';

function open(link: string) {
  const path = appLinkPath(link, location.origin);
  if (!path) return;
  if (path.startsWith(APP_VERIFY_PATH)) void closeSystemBrowser();
  location.assign(path);
}

/** Back closes what is open first, through the same stack as Escape (ui/use-escape, popovers, dialogs). */
function back(canGoBack: boolean) {
  const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  document.body.dispatchEvent(escape);
  if (escape.defaultPrevented) return;
  if (canGoBack) history.back();
  else void minimizeApp();
}

/** In the phone apps: drops the launch screen, opens takip.dev links and sign-ins coming back from the system browser, and answers Android's back button. */
export default function AppLinks() {
  useEffect(() => {
    void hideSplash();
    void launchLink().then(link => {
      if (!link || sessionStorage.getItem(LAUNCH_KEY) === link) return;
      sessionStorage.setItem(LAUNCH_KEY, link);
      open(link);
    });
    const stopLinks = onAppLink(open);
    const stopBack = onBackButton(back);
    return () => {
      stopLinks();
      stopBack();
    };
  }, []);
  return null;
}
