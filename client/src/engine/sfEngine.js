// Stockfish wrapper (no npm import, no loop-captured functions)

function supportsSAB() {
  try {
    const coi =
      typeof window !== "undefined" &&
      typeof window.crossOriginIsolated !== "undefined" &&
      window.crossOriginIsolated === true;
    return typeof SharedArrayBuffer !== "undefined" && coi;
  } catch {
    return false;
  }
}

function pickBasePaths() {
  const bases = [];
  if (typeof window !== "undefined" && window.STOCKFISH_BASE_PATH) {
    let b = String(window.STOCKFISH_BASE_PATH);
    if (!b.endsWith("/")) b += "/";
    bases.push(b);
  }
  // CRA dev & prod when files live under client/public/stockfish
  bases.push("/stockfish/");
  // If your Node server also serves repo-root /public
  bases.push("/public/stockfish/");
  // dedupe
  return Array.from(new Set(bases));
}

function candidateUrls() {
  const list = [];
  const bases = pickBasePaths();
  const tryWasmLite = supportsSAB();

  for (const base of bases) {
    if (tryWasmLite) list.push(base + "stockfish-17.1-lite-51f59da.js");
    list.push(base + "stockfish.js");
    list.push(base + "stockfish-17.1-asm-341ff22.js"); 
  }
  return list;
}

async function preflight(url) {
  const res = await fetch(url, { cache: "no-store", credentials: "same-origin" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  const txt = await res.text();
  const looksJs =
    ct.includes("javascript") || ct.includes("ecmascript") || ct.includes("text/plain");
  if (!looksJs || txt.trim().startsWith("<")) {
    throw new Error(`Not a JS worker at ${url}`);
  }
}

/**
 * Create a ready worker from a URL.
 * Resolves with a *READY* Worker (long-lived) after sending options and receiving "readyok".
 * No external variables captured (ESLint-safe).
 */
async function createReadyWorkerFromUrl(url, opts, timeoutMs = 10000) {
  await preflight(url);

  return new Promise((resolve, reject) => {
    let stage = 0;
    let timer = null;
    let w;
    try {
      w = new Worker(url, { type: "classic", name: "stockfish" });
    } catch (e) {
      reject(new Error(`Worker construct failed for ${url}: ${e.message || e}`));
      return;
    }

    const clearAll = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const send = (cmd) => {
      try {
        w.postMessage(cmd);
      } catch (e) {
        throw new Error(`postMessage failed: ${e.message || e}`);
      }
    };

    const onReadyTimeout = () =>
      reject(new Error(`Timeout waiting for engine ready (${url})`));

    timer = setTimeout(onReadyTimeout, timeoutMs);

    w.onmessage = (evt) => {
      const msg = typeof evt.data === "string" ? evt.data : "";
      if (!msg) return;

      if (stage === 0 && msg.includes("uciok")) {
        stage = 1;
        try {
          const {
            skill = 20,
            hash = 64,
            threads = 1, // keep 1; >1 requires SAB
            contempt = 0,
            multipv = 1,
            limitStrength,
            uciElo,
          } = opts || {};
          send(`setoption name Skill Level value ${skill}`);
          send(`setoption name Hash value ${hash}`);
          send(`setoption name Threads value ${threads}`);
          send(`setoption name Contempt value ${contempt}`);
          send(`setoption name MultiPV value ${multipv}`);
          if (typeof limitStrength === "boolean")
            send(
              `setoption name UCI_LimitStrength value ${
                limitStrength ? "true" : "false"
              }`
            );
          if (typeof uciElo === "number") send(`setoption name UCI_Elo value ${uciElo}`);
          send("isready");
        } catch (e) {
          clearAll();
          reject(e);
        }
      } else if (stage === 1 && msg.includes("readyok")) {
        clearAll();
        resolve(w); // long-lived, ready worker
      }
    };

    const onErr = (e) => {
        try { e?.preventDefault?.(); } catch {}
        clearAll();
        reject(new Error(`Worker error for ${url}: ${e?.message || e}`));
      };
      w.addEventListener("error", onErr);
      w.addEventListener("messageerror", onErr);

    // Defer first command to let the worker finish boot
    setTimeout(() => {
      try {
        send("uci");
      } catch (e) {
        clearAll();
        reject(e);
      }
    }, 0);
  });
}

// ----------------------------------------------------------------------------

export function createStockfish() {
  let ready = false;
  /** @type {Worker|null} */
  let worker = null;
  const listeners = [];

  const fanout = (evtOrString) => {
    const msg = typeof evtOrString === "string" ? evtOrString : evtOrString?.data;
    if (!msg) return;
    for (const fn of listeners.slice()) {
      try {
        fn(msg);
      } catch {
        // ignore listener errors
      }
    }
  };

  const send = (cmd) => {
    if (!worker) throw new Error("Engine not created");
    worker.postMessage(cmd);
  };

  async function init(opts = {}) {
    const urls = candidateUrls();
    let lastErr = null;

    // Try each candidate URL until one produces a ready worker.
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      try {
        const w = await createReadyWorkerFromUrl(url, opts, 12000);
        // Hook events for the long-lived worker
        worker = w;
        worker.onmessage = (evt) => fanout(evt);
        ready = true;
        return; // success
      } catch (e) {
        lastErr = e;
        // Continue to next candidate
      }
    }

    throw lastErr || new Error("No usable Stockfish engine could be started");
  }

  function withTimeout(makePromise, ms, label) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(
        () => reject(new Error(`${label} timed out after ${ms}ms`)),
        ms
      );
      makePromise()
        .then((v) => {
          clearTimeout(t);
          resolve(v);
        })
        .catch((e) => {
          clearTimeout(t);
          reject(e);
        });
    });
  }

  function onceMatch(prefix, onHit) {
    const handler = (msg) => {
      if (typeof msg !== "string") return;
      if (msg.startsWith(prefix)) {
        const i = listeners.indexOf(handler);
        if (i >= 0) listeners.splice(i, 1);
        onHit(msg);
      }
    };
    listeners.push(handler);
    return () => {
      const i = listeners.indexOf(handler);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  function tryStop() {
    try {
      send("stop");
    } catch {
      // ignore
    }
  }

  const bestMove = async ({ fen, movetime = 260, depth, hardLimitMs } = {}) => {
    if (!ready) throw new Error("Stockfish not initialized");
    const limit = hardLimitMs ?? Math.max(700, (movetime || 0) + 320);

    return withTimeout(
      () =>
        new Promise((resolve, reject) => {
          tryStop();
          const unhook = onceMatch("bestmove", (line) => {
            const parts = line.split(/\s+/);
            const bm = parts[1] || "(none)";
            resolve(bm === "(none)" ? null : bm);
          });
          try {
            send("ucinewgame");
            send("setoption name MultiPV value 1");
            send(`position fen ${fen}`);
            if (depth) send(`go depth ${depth}`);
            else send(`go movetime ${movetime}`);
          } catch (e) {
            unhook();
            reject(e);
          }
        }),
      limit,
      "bestMove"
    );
  };

  const analyze = async ({
    fen,
    movetime = 200,
    depth,
    multipv = 1,
    hardLimitMs,
  } = {}) => {
    if (!ready) throw new Error("Stockfish not initialized");
    const limit = hardLimitMs ?? Math.max(650, (movetime || 0) + 320);

    return withTimeout(
      () =>
        new Promise((resolve, reject) => {
          tryStop();
          const lines = new Map();

          const onInfo = (msg) => {
            if (typeof msg !== "string" || !msg.startsWith("info ")) return;
            const mpv = / multipv (\d+)/.exec(msg);
            const pv = / pv (.+)$/.exec(msg);
            const scMate = / score mate (-?\d+)/.exec(msg);
            const scCp = / score cp (-?\d+)/.exec(msg);
            if (!mpv || !pv) return;
            const k = parseInt(mpv[1], 10);
            const score = scMate
              ? 100000 * Math.sign(parseInt(scMate[1], 10))
              : scCp
              ? parseInt(scCp[1], 10)
              : 0;
            lines.set(k, { scoreCp: score, pv: pv[1] });
          };

          const unInfo = () => {
            const i = listeners.indexOf(onInfo);
            if (i >= 0) listeners.splice(i, 1);
          };

          const unBest = onceMatch("bestmove", () => {
            unInfo();
            resolve(
              Array.from(lines.entries())
                .sort((a, b) => a[0] - b[0])
                .map(([_, v]) => v)
            );
          });

          listeners.push(onInfo);

          try {
            send("ucinewgame");
            send(`setoption name MultiPV value ${multipv}`);
            send(`position fen ${fen}`);
            if (depth) send(`go depth ${depth}`);
            else send(`go movetime ${movetime}`);
          } catch (e) {
            unInfo();
            unBest();
            reject(e);
          }
        }),
      limit,
      "analyze"
    );
  };

  const destroy = () => {
    try {
      send("quit");
    } catch {
      // ignore
    }
    try {
      worker?.terminate?.();
    } catch {
      // ignore
    }
    worker = null;
    ready = false;
  };

  return { init, bestMove, analyze, destroy };
}
