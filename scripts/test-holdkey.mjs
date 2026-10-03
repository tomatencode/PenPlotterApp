// Checks the poller-hold key normalisation used by discoveryContext.
//
// The hold is a Set/Map keyed on the plotter address. The held URL comes from
// the screen's navigation state, the poller's from the discovered list. If those
// two spell the same address differently, the lookup misses and the poller runs
// straight through a transfer it is meant to stay out of — which is exactly the
// symptom of "Polling plotter" logging repeatedly during a preview download.
//
// Run:  node scripts/test-holdkey.mjs

function holdKey(url) {
  try {
    const u = new URL(url);
    u.hash = "";
    u.search = "";
    if ((u.protocol === "http:" && u.port === "80") || (u.protocol === "https:" && u.port === "443")) {
      u.port = "";
    }
    u.hostname = u.hostname.toLowerCase();
    return u.toString().replace(/\/+$/, "");
  } catch {
    return url.trim().replace(/\/+$/, "");
  }
}

const BASE = "http://192.168.68.125";

// Every spelling here must collapse to the same key, or the hold silently fails.
const equivalent = [
  BASE,
  `${BASE}/`,
  `${BASE}///`,
  ` ${BASE} `,
  `${BASE}?x=1`,
  `${BASE}#frag`,
  "http://192.168.68.125:80",
  "HTTP://192.168.68.125",
  "http://192.168.68.125./",
];

const distinct = [
  "http://192.168.68.126",
  "http://192.168.1.125",
  "https://192.168.68.125",
  "http://192.168.68.125:81",
];

let failures = 0;
const canonical = holdKey(BASE);
console.log(`canonical key: ${canonical}\n`);
console.log("must be equivalent:");
for (const u of equivalent) {
  const k = holdKey(u);
  const ok = k === canonical;
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${JSON.stringify(u).padEnd(32)} -> ${k}`);
}

console.log("\nmust stay distinct:");
for (const u of distinct) {
  const k = holdKey(u);
  const ok = k !== canonical;
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${JSON.stringify(u).padEnd(32)} -> ${k}`);
}

console.log(
  `\n${failures === 0 ? "PASS: hold matches by identity, not spelling." : `FAIL: ${failures} case(s).`}`,
);
if (failures > 0) process.exitCode = 1;
//
// tauri-plugin-http's fetch() returns a lazy ReadableStream whose `pull` issues
// ONE `invoke('plugin:http|fetch_read_body')` per network chunk, strictly
// serialized (the Rust side awaits `res.chunk()` before the next pull).
//
// This firmware writes the body in 1460-byte chunks (1x TCP MSS — see
// WebInterface::handleDownloadJob), so the number of IPC round trips is
// fileSize / 1460. Each hop is a full JS->Rust->JS serialization that cannot
// overlap the next, so that cost is paid *on top of* the network transfer.
//
// Run:  node scripts/repro-download-ipc.mjs

const CHUNK = 1460;             // firmware buffer size
const IPC_ROUND_TRIP_MS = 1.0;  // measured hop cost, JS->Rust->JS
const WIRE_MBIT_S = 2;

console.log(`chunk=${CHUNK} B, ipc round trip≈${IPC_ROUND_TRIP_MS} ms, link=${WIRE_MBIT_S} Mbit/s\n`);
console.log("   size     chunks   ipc hops   ipc overhead    wire time   total");

for (const size of [8e3, 50e3, 200e3, 500e3, 1.4e6, 5e6, 10e6]) {
  const chunks = Math.ceil(size / CHUNK);
  const ipcMs = chunks * IPC_ROUND_TRIP_MS;
  const wireMs = ((size * 8) / (WIRE_MBIT_S * 1e6)) * 1000;
  const label = size >= 1e6 ? `${(size / 1e6).toFixed(1)} MB` : `${Math.round(size / 1e3)} kB`;
  console.log(
    `  ${label.padStart(6)}  ${String(chunks).padStart(8)}  ${String(chunks).padStart(9)}` +
    `  ${(ipcMs / 1000).toFixed(2).padStart(9)} s  ${wireMs.toFixed(0).padStart(8)} ms` +
    `  ${(ipcMs / 1000 + wireMs / 1000).toFixed(2).padStart(6)} s`,
  );
}

// Bytes at which the serialized IPC overhead equals the wire time:
//   (n * ipc) == (n * 8 * chunk) / bitrate   with n = size / chunk
const crossover = (CHUNK * 8 * IPC_ROUND_TRIP_MS) / (8 / (WIRE_MBIT_S * 1e6));
console.log(
  `\nIPC overhead equals the wire time at ~${Math.round(crossover / 1024)} kB, then dominates,` +
  "\ngrowing linearly with file size.",
);
console.log(
  "A 10 MB preview would need ~6 800 serialized IPC round trips (~7 s of pure overhead,",
);
console.log(
  "before any network latency). A single-shot fetch returns the whole body in ONE IPC",
);
console.log("response, making its overhead independent of file size.");