const urls = [];
for(let i=0; i<256; i++) urls.push(`https://internetdb.shodan.io/212.83.149.${i}`);

async function batchFetch(urls, concurrency, fn) {
  const results = new Array(urls.length).fill(null);
  let idx = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (idx < urls.length) {
      const i = idx++;
      results[i] = await fn(urls[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function run() {
  const t0 = Date.now();
  const shodanResults = await batchFetch(
      urls,
      20,
      async (url) => {
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
          if (res.status === 404) return null; // Non-responsive host
          if (!res.ok) return null;
          return await res.json();
        } catch {
          return null;
        }
      },
    );
  
  const valid = shodanResults.filter(Boolean);
  console.log(`Found ${valid.length} devices in ${Date.now() - t0}ms`);
}
run();
