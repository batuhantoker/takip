/** Class names filter lists hide on sight. */
const BAIT_CLASSES = 'adsbox ad-banner textads banner-ads pub_300x250';

/** True when a cosmetic filter hides or removes an element dressed as an ad. */
export function baitHidden(): Promise<boolean> {
  const bait = document.createElement('div');
  bait.className = BAIT_CLASSES;
  bait.setAttribute('aria-hidden', 'true');
  bait.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;';
  bait.innerHTML = '&nbsp;';
  document.body.appendChild(bait);
  // Blockers inject their stylesheet a beat after the element lands.
  return new Promise(resolve => setTimeout(() => {
    const style = getComputedStyle(bait);
    const hidden = !bait.isConnected || bait.offsetHeight === 0 || style.display === 'none' || style.visibility === 'hidden';
    bait.remove();
    resolve(hidden);
  }, 300));
}
