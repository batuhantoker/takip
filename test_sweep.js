const urls = [];
for(let i=0; i<256; i++) urls.push(`https://internetdb.shodan.io/212.83.149.${i}`);
async function run() {
  let errors = 0;
  let successes = 0;
  let t0 = Date.now();
  await Promise.all(urls.map(u => fetch(u).then(r => { if(r.ok || r.status === 404) successes++; else errors++; }).catch(e => errors++)));
  console.log(`Successes (200 or 404): ${successes}, Errors (Rate limit or network): ${errors}, Time: ${Date.now() - t0}ms`);
}
run();
