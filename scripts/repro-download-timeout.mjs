// Reproduces the download-timeout bug in plotterClient's fetch() wrapper.
//
// The Tauri HTTP plugin resolves fetch() as soon as the response HEADERS arrive
// and returns a lazy ReadableStream body (see the plugin's dist-js/index.js:
// `new Response(body, …)` where body is a ReadableStream fed by one
// `invoke('plugin:http|fetch_read_body')` per pull).
//
// The wrapper's `clearTimeout` lives in `.finally()` on that header promise, so
// the abort timer is already gone before the first body byte is read. For a
// small file the body is buffered by the OS and arrives instantly; for a large
// one it trickles in over minutes, and nothing can interrupt it.
//
// Run:  node scripts/repro-download-timeout.mjs

function makePluginFetch({ headerDelayMs, bodyChunkDelayMs, bodyChunks }) {
  return async function pluginFetch(url, init) {
    const signal = init?.signal;
    await new Promise((r) => setTimeout(r, headerDelayMs));
    let i = 0;
    const body = new ReadableStream({
      async pull(controller) {
        if (signal?.aborted) { controller.error(new Error("Request cancelled")); return; }
        if (i++ >= bodyChunks) { controller.close(); return; }
        await new Promise((r) => setTimeout(r, bodyChunkDelayMs));
        controller.enqueue(new Uint8Array(1024));
      },
    });
    return new Response(body, { status: 200 });
  };
}

// Mirror of the wrapper in src/features/plotter/api/plotterClient.ts.
// Records whether the real AbortController ever fired, since that is what
// decides whether a stalled transfer can be interrupted.
function makeWrapper(pluginFetch, onAbort) {
  return function fetch(input, init, timeoutMs = 5000) {
    const controller = new AbortController();
    const id = setTimeout(() => { onAbort(Date.now()); controller.abort(); }, timeoutMs);
    if (init?.signal) init.signal.addEventListener("abort", () => controller.abort(), { once: true });
    return pluginFetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(id));
  };
}

const URL_ = "http://plotter.local/downloadJob";
const TIMEOUT = 300; // stand-in for TRANSFER_TIMEOUT_MS

/** Drain whatever the response yields, tolerating an abort mid-stream. */
async function drain(res) {
  let bytes = 0;
  try {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
    }
  } catch {
    // Aborted part-way — exactly what the timeout is supposed to cause.
  }
  return bytes;
}

let failures = 0;
for (const [label, cfg] of [
  ["small file  (body already buffered at header time)", { headerDelayMs: 20, bodyChunkDelayMs: 0, bodyChunks: 1 }],
  ["big file    (body trickles long after headers)", { headerDelayMs: 20, bodyChunkDelayMs: 400, bodyChunks: 40 }],
]) {
  console.log(label);
  for (const [kind, impl, budgetApplies] of [
    ["before (buggy)", makeWrapper(makePluginFetch(cfg)), false],
    ["after  (fixed)", makeWrapperFixed(makePluginFetch(cfg)), true],
  ]) {
    const t0 = Date.now();
    let bytes = 0;
    try {
      const res = await impl(URL_, undefined, TIMEOUT);
      bytes = await drain(res);
    } catch {
      // Fixed version aborts inside request(); treat as ending at the budget.
    }
    const totalMs = Date.now() - t0;
    const withinBudget = totalMs <= TIMEOUT * 2;
    // The buggy wrapper is *expected* to overrun — that is the bug. Only the
    // fixed wrapper is held to the budget.
    if (budgetApplies && !withinBudget) failures++;

    console.log(
      `  ${kind}: ended ${String(totalMs).padStart(5)}ms (budget ${TIMEOUT}ms) |` +
      ` ${String(bytes).padStart(6)} bytes | ` +
      (budgetApplies ? (withinBudget ? "within budget" : "BLEW PAST BUDGET") : "(buggy — no limit in effect)"),
    );
  }
  console.log();
}

console.log(
  failures === 0
    ? "PASS: fixed wrapper honours its budget; old wrapper shown for contrast."
    : `FAIL: ${failures} check(s) did not behave as expected.`,
);
if (failures > 0) process.exitCode = 1;

/** The fixed wrapper: the timer stays armed while the body streams. */
function makeWrapperFixed(pluginFetch) {
  return async function fetch(input, init, timeoutMs = 5000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    if (init?.signal) init.signal.addEventListener("abort", () => controller.abort(), { once: true });
    try {
      const res = await pluginFetch(input, { ...init, signal: controller.signal });
      // Draining the body here keeps the controller live for the whole transfer,
      // then hands back a buffered Response the caller can read without risk.
      const buf = await res.arrayBuffer();
      const buffered = new Response(buf, { status: res.status, statusText: res.statusText });
      Object.defineProperty(buffered, "url", { value: res.url });
      return buffered;
    } finally {
      clearTimeout(id);
    }
  };
}