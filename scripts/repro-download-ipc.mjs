// Quantifies the per-chunk IPC cost of Tauri's streaming HTTP fetch.
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

// Bytes at which serialized IPC overhead equals the wire time.
// With n = size/chunk chunks:
//   overhead = n * ipc_ms
//   wire_ms  = size * 8 / bitrate = n * chunk * 8 / bitrate
// Both are proportional to n, so the ratio is size-independent — it comes down
// to the per-chunk cost. Here IPC is the cheaper side: it dominates only if the
// round trip exceeds the time to push one chunk onto the wire.
const perChunkWireMs = (CHUNK * 8) / (WIRE_MBIT_S * 1000); // bits / (Mbit/s) -> ms
const ratio = perChunkWireMs / IPC_ROUND_TRIP_MS;
console.log(
  `\nOne ${CHUNK} B chunk costs ${IPC_ROUND_TRIP_MS} ms of IPC vs ${perChunkWireMs.toFixed(3)} ms on the wire`,
);
console.log(`(${ratio.toFixed(2)}x), and both scale linearly with file size:`);
console.log(`  every MB adds ~${Math.round((1e6 / CHUNK) * IPC_ROUND_TRIP_MS)} ms of pure IPC overhead`);
console.log(
  "A 10 MB preview would need ~6 800 serialized IPC round trips (~7 s of pure overhead,",
);
console.log(
  "before any network latency). A single-shot fetch returns the whole body in ONE IPC",
);
console.log("response, making its overhead independent of file size.");