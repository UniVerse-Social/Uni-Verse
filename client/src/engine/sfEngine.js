// src/engine/sfEngine.js
// Loads exactly one local ASM worker: /public/stockfish/stockfish.js
// Make sure you copied your asm build there.
// Key speed tweaks:
//  - bestMove() forces MultiPV=1
//  - strict per-call timeouts so we never "hang"

export function createStockfish() {
  let ready = false;
  let worker = null;
  const listeners = [];

  const send = (cmd) => {
    if (!worker) throw new Error('Stockfish worker not created');
    worker.postMessage(cmd);
  };

  const fanout = (evtOrString) => {
    const msg = typeof evtOrString === 'string' ? evtOrString : evtOrString?.data;
    for (const fn of listeners.slice()) { try { fn(msg); } catch {} }
  };

  const WORKER_URL = '/stockfish/stockfish.js';

  async function preflight(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const txt = (await res.text()).trim();
    if (txt.startsWith('<')) throw new Error(`Got HTML instead of JS at ${url}. Did you copy the file into /public/stockfish/?`);
  }

  async function boot(url, opts, timeoutMs = 5000) {
    await preflight(url);

    return new Promise((resolve, reject) => {
      let done = false;
      const w = new Worker(url);
      worker = w;

      const cleanup = (err) => {
        try { w.terminate(); } catch {}
        worker = null;
        if (!done) reject(err);
      };

      const to = setTimeout(() => {
        done = true;
        cleanup(new Error(`Timeout waiting for readyok from ${url}`));
      }, timeoutMs);

      w.onmessage = (evt) => {
        fanout(evt);
        const msg = typeof evt?.data === 'string' ? evt.data : '';
        if (!msg) return;

        if (msg.includes('uciok')) {
          const { skill = 20, hash = 64, contempt = 0, multipv = 1 } = (opts || {});
          try { send(`setoption name Skill Level value ${skill}`); } catch {}
          try { send(`setoption name Hash value ${hash}`); } catch {}
          try { send(`setoption name Threads value 1`); } catch {}
          try { send(`setoption name Contempt value ${contempt}`); } catch {}
          try { send(`setoption name MultiPV value ${multipv}`); } catch {}
          try { send('isready'); } catch {}
        } else if (msg.includes('readyok')) {
          clearTimeout(to);
          done = true;
          resolve();
        }
      };

      w.onerror = (e) => {
        clearTimeout(to);
        cleanup(new Error(`Worker error for ${url}: ${e.message || e}`));
      };

      try {
        send('uci');
      } catch (e) {
        clearTimeout(to);
        cleanup(new Error(`postMessage failed for ${url}: ${e.message || e}`));
      }
    });
  }

  const init = async ({ skill = 20, hash = 64, contempt = 0, multipv = 1 } = {}) => {
    await boot(WORKER_URL, { skill, hash, contempt, multipv });
    ready = true;
  };

  function withTimeout(makePromise, ms, label) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      makePromise()
        .then((v) => { clearTimeout(t); resolve(v); })
        .catch((e) => { clearTimeout(t); reject(e); });
    });
  }

  const bestMove = async ({ fen, movetime = 400, depth, hardLimitMs } = {}) => {
    if (!ready) throw new Error('Stockfish not initialized');
    const limit = hardLimitMs ?? Math.max(600, (movetime || 0) + 300);

    return withTimeout(() => new Promise((resolve, reject) => {
      const handle = (msg) => {
        if (typeof msg !== 'string') return;
        if (msg.startsWith('bestmove')) {
          const m = msg.split(' ')[1];
          const i = listeners.indexOf(handle);
          if (i >= 0) listeners.splice(i, 1);
          resolve(m);
        }
      };
      const bail = (e) => {
        const i = listeners.indexOf(handle);
        if (i >= 0) listeners.splice(i, 1);
        reject(e instanceof Error ? e : new Error(String(e)));
      };

      listeners.push(handle);
      try {
        send('ucinewgame');
        // FAST: ensure single PV even if earlier analysis used MultiPV>1
        send('setoption name MultiPV value 1');
        send(`position fen ${fen}`);
        if (depth) send(`go depth ${depth}`); else send(`go movetime ${movetime}`);
      } catch (e) { bail(e); }
    }), limit, 'bestMove');
  };

  const analyze = async ({ fen, movetime = 160, depth, multipv = 1, hardLimitMs } = {}) => {
    if (!ready) throw new Error('Stockfish not initialized');
    const limit = hardLimitMs ?? Math.max(400, (movetime || 0) + 250);

    return withTimeout(() => new Promise((resolve, reject) => {
      const lines = new Map();
      const onInfo = (msg) => {
        if (typeof msg !== 'string' || !msg.startsWith('info ')) return;
        const mpv = / multipv (\d+)/.exec(msg);
        const pv = / pv (.+)$/.exec(msg);
        const scMate = / score mate (-?\d+)/.exec(msg);
        const scCp = / score cp (-?\d+)/.exec(msg);
        if (!mpv || !pv) return;
        const k = parseInt(mpv[1], 10);
        const score = scMate
          ? (100000 * Math.sign(parseInt(scMate[1], 10)))
          : (scCp ? parseInt(scCp[1], 10) : 0);
        lines.set(k, { scoreCp: score, pv: pv[1] });
      };
      const done = (msg) => {
        if (typeof msg !== 'string') return;
        if (msg.startsWith('bestmove')) {
          const i1 = listeners.indexOf(onInfo);
          const i2 = listeners.indexOf(done);
          if (i1 >= 0) listeners.splice(i1, 1);
          if (i2 >= 0) listeners.splice(i2, 1);
          resolve(Array.from(lines.entries()).sort((a,b)=> a[0]-b[0]).map(([_,v])=>v));
        }
      };
      const bail = (e) => {
        const i1 = listeners.indexOf(onInfo);
        const i2 = listeners.indexOf(done);
        if (i1 >= 0) listeners.splice(i1, 1);
        if (i2 >= 0) listeners.splice(i2, 1);
        reject(e instanceof Error ? e : new Error(String(e)));
      };

      listeners.push(onInfo);
      listeners.push(done);
      try {
        send('ucinewgame');
        send(`setoption name MultiPV value ${multipv}`);
        send(`position fen ${fen}`);
        if (depth) send(`go depth ${depth}`); else send(`go movetime ${movetime}`);
      } catch (e) { bail(e); }
    }), limit, 'analyze');
  };

  const destroy = () => {
    try { worker?.terminate?.(); } catch {}
    worker = null;
    ready = false;
  };

  return { init, bestMove, analyze, destroy };
}
