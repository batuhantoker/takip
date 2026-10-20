// Injected before any page script. Owns the page's clocks (timers, animation frames, Date,
// performance.now, Web Animations) so the renderer can step time one video frame at a time,
// however long a frame takes to capture. Until freeze() it follows the real clock.
(() => {
  if (window.__shortsClock) return;
  const realNow = performance.now.bind(performance);
  const realRaf = window.requestAnimationFrame.bind(window);
  const realSetTimeout = window.setTimeout.bind(window);
  const RealDate = Date;

  let now = realNow();
  const epoch = RealDate.now() - now;
  let manual = false;
  let nextId = 1;
  const timers = new Map();
  let frames = new Map();
  const animations = new WeakMap();
  const channel = new MessageChannel();
  const yields = [];
  channel.port1.onmessage = () => yields.shift()?.();
  // a macrotask, so promise callbacks queued by the last timer run before the next one
  const yieldTask = () => new Promise(resolve => { yields.push(resolve); channel.port2.postMessage(0); });
  const report = error => realSetTimeout(() => { throw error; });

  function call(fn, args) {
    try {
      if (typeof fn === 'function') fn(...args);
      else (0, eval)(String(fn));
    } catch (error) {
      report(error);
    }
  }

  function dueTimer(until) {
    let best;
    for (const [id, t] of timers) {
      if (t.at <= until && (!best || t.at < best[1].at || (t.at === best[1].at && id < best[0]))) best = [id, t];
    }
    return best;
  }

  async function runTimers(until, yieldBetween) {
    for (let guard = 0; guard < 100000; guard++) {
      const due = dueTimer(until);
      if (!due) break;
      const [id, t] = due;
      now = Math.max(now, t.at);
      if (t.every) t.at += t.every;
      else timers.delete(id);
      call(t.fn, t.args);
      if (yieldBetween) await yieldTask();
    }
    now = Math.max(now, until);
  }

  function runFrames() {
    const due = frames;
    frames = new Map();
    for (const cb of due.values()) call(cb, [now]);
  }

  function stepAnimations() {
    if (!document.getAnimations) return;
    for (const a of document.getAnimations()) {
      let seen = animations.get(a);
      if (!seen) {
        seen = { start: now - (Number(a.currentTime) || 0) };
        animations.set(a, seen);
        a.pause();
      }
      if (seen.done) continue;
      const end = a.effect?.getComputedTiming().endTime;
      const t = now - seen.start;
      if (typeof end === 'number' && Number.isFinite(end) && t >= end) {
        seen.done = true;
        a.finish();
      } else {
        a.currentTime = t;
      }
    }
  }

  window.setTimeout = (fn, ms, ...args) => {
    const id = nextId++;
    timers.set(id, { at: now + Math.max(1, Number(ms) || 0), fn, args });
    return id;
  };
  window.setInterval = (fn, ms, ...args) => {
    const id = nextId++;
    const every = Math.max(1, Number(ms) || 0);
    timers.set(id, { at: now + every, every, fn, args });
    return id;
  };
  window.clearTimeout = window.clearInterval = id => { timers.delete(id); };
  window.requestAnimationFrame = cb => {
    const id = nextId++;
    frames.set(id, cb);
    return id;
  };
  window.cancelAnimationFrame = id => { frames.delete(id); };
  window.requestIdleCallback = (cb, opts) => window.setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 8 }), Math.min(opts?.timeout ?? 1, 50));
  window.cancelIdleCallback = id => window.clearTimeout(id);
  performance.now = () => now;

  class VirtualDate extends RealDate {
    constructor(...args) {
      if (args.length) super(...args);
      else super(Math.floor(epoch + now));
    }
    static now() {
      return Math.floor(epoch + now);
    }
  }
  window.Date = VirtualDate;

  // Requests in flight, so a frame waits for the data a clock change asked for.
  const requests = new Map();
  let nextRequest = 1;
  const track = (promise, url) => {
    const id = nextRequest++;
    requests.set(id, { at: realNow(), url: String(url).slice(0, 160) });
    const done = () => requests.delete(id);
    promise.then(done, done);
    return promise;
  };
  const realFetch = window.fetch.bind(window);
  window.fetch = (...args) => track(realFetch(...args), args[0]?.url ?? args[0]);
  const realOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__shortsUrl = url;
    return realOpen.call(this, method, url, ...rest);
  };
  const realSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    track(new Promise(resolve => this.addEventListener('loadend', resolve, { once: true })), this.__shortsUrl);
    return realSend.apply(this, args);
  };

  let pumping = false;
  async function pump() {
    if (!manual && !pumping) {
      pumping = true;
      await runTimers(realNow(), false);
      runFrames();
      pumping = false;
    }
    if (!manual) realRaf(pump);
  }
  realRaf(pump);
  // rAF is throttled when Chrome thinks nothing is visible; timers must still fire while loading
  const tick = () => { if (!manual) { pump(); realSetTimeout(tick, 16); } };
  realSetTimeout(tick, 16);

  window.__shortsClock = {
    get now() { return now; },
    get manual() { return manual; },
    /** Stops following the real clock; from here only advance() moves time. */
    freeze() {
      manual = true;
      stepAnimations();
    },
    /** Moves time by ms: due timers in order, then one animation frame. */
    async advance(ms) {
      await runTimers(now + Math.max(0, ms), true);
      stepAnimations();
      runFrames();
      await yieldTask();
    },
    /** Requests started less than `maxAgeMs` ago and not yet answered; older ones are streams or stuck. */
    inflight(maxAgeMs = 10000) {
      return this.inflightUrls(maxAgeMs).length;
    },
    inflightUrls(maxAgeMs = 10000) {
      const now = realNow();
      return [...requests.values()].filter(r => now - r.at < maxAgeMs).map(r => r.url);
    },
  };
})();
