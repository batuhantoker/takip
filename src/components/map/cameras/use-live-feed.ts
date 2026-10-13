'use client';

import { useCallback, useState } from 'react';

/** The live news feed open in the viewer, if any. */
export function useLiveFeed() {
  const [liveFeedUrl, setLiveFeedUrl] = useState<string | null>(null);
  const [liveFeedName, setLiveFeedName] = useState('');
  const [liveFeedEmbedAllowed, setLiveFeedEmbedAllowed] = useState(true);

  const openFeed = useCallback((url: string, name: string, embedAllowed = true) => {
    setLiveFeedUrl(url);
    setLiveFeedName(name);
    setLiveFeedEmbedAllowed(embedAllowed);
  }, []);

  return { liveFeedUrl, setLiveFeedUrl, liveFeedName, liveFeedEmbedAllowed, openFeed };
}
