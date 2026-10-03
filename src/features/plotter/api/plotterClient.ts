import { fetch as _fetch } from "@tauri-apps/plugin-http";
import { invoke } from "@tauri-apps/api/core";
import { PlotterApiError } from "./plotterTypes";
import type {
  FirmwareVersion,
  JobStatus,
  MotionState,
  PenSlot,
  PlotterIteration,
  PlotterSettings,
  SettingKey,
  FileInfo,

  UploadResult,
  WorkspaceSize,
  WsStateMessage,
} from "./plotterTypes";
import {
  wsUrlFromHttp,
  PlotterSocketManager,
  StateListener,
} from "./plotterSocketManager";
export { PlotterApiError } from "./plotterTypes";
export type {
  FirmwareVersion,
  JobStatus,
  MotionState,
  PenSlot,
  PlotterIteration,
  PlotterSettings,
  SettingKey,
  FileInfo,
  UploadResult,
  WorkspaceSize,
  WsStateMessage,
};

// Internal helpers

const REQUEST_TIMEOUT_MS = 5_000;
// Uploads are a multipart POST of a whole GCode file to an embedded device over
// WiFi, which routinely takes longer than the interactive timeout. Aborting it
// mid-body produced a "Request canceled" error, so uploads get their own,
// much more generous budget. The device accepts up to 10 MB, which at the
// transfer rates observed takes minutes — hence 5 minutes here.
const UPLOAD_TIMEOUT_MS = 300_000;
// Downloads of a multi-MB GCode file take tens of seconds over WiFi, so they get
// the same generous budget. It bounds the whole operation on the Rust side too
// (see `fetch_text`), so a stalled device fails visibly instead of hanging.
const TRANSFER_TIMEOUT_MS = 300_000;

/**
 * Wraps the Tauri fetch with a per-request timeout, and returns the **fully
 * buffered** body. An optional caller signal aborts together with the timeout
 * (whichever fires first), so sequenced UI requests can cancel a superseded
 * transfer instead of racing it.
 *
 * The timeout deliberately spans the body, not just the headers. The plugin
 * resolves `fetch()` as soon as `fetch_send` returns and hands back a lazy
 * `ReadableStream`, so a `.finally(clearTimeout)` on that promise disarmed the
 * timer before a single body byte was read — leaving a large download running
 * indefinitely with nothing able to stop it (reproduced in
 * `scripts/repro-download-timeout.mjs`). Draining the stream here keeps the
 * abort controller live for the whole transfer.
 *
 * Returning an `ArrayBuffer` rather than `Response` makes that safe by
 * construction: a caller cannot accidentally start reading a body outside the
 * timeout window. Status is checked here too, so an error response yields a
 * {@link PlotterApiError} without a second, untimed read.
 */
async function request(
  input: string | URL,
  init?: Parameters<typeof _fetch>[1] & { signal?: AbortSignal },
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<ArrayBuffer> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  if (init?.signal) {
    if (init.signal.aborted) controller.abort();
    else init.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  try {
    const res = await _fetch(input as string, { ...init, signal: controller.signal });
    const body = await res.arrayBuffer();
    if (!res.ok) {
      throw new PlotterApiError(res.status, decode(body) || res.statusText);
    }
    return body;
  } finally {
    clearTimeout(id);
  }
}

/** UTF-8 decode of a body already read by {@link request}. */
function decode(body: ArrayBuffer): string {
  return new TextDecoder("utf-8").decode(body);
}

/** Parse a body already read by {@link request}. */
function parseJson<T>(body: ArrayBuffer): T {
  return JSON.parse(decode(body)) as T;
}

// Whether an error means our side cancelled the request (timeout, an explicitly
// aborted transfer, or the plugin's wording for it).
//
// Checks the name/message structurally rather than `instanceof Error`, because a
// `DOMException` thrown by `new DOMException(…, "AbortError")` does not inherit
// from Error in every engine, and Tauri rejections are plain strings.
export function isRequestCancelled(error: unknown): boolean {
  if (typeof error === "string") return /request\s*cancel(led|ed)/i.test(error);
  if (!error || typeof error !== "object") return false;
  const { name, message } = error as { name?: unknown; message?: unknown };
  if (name === "AbortError") return true;
  return typeof message === "string" && /request\s*cancel(led|ed)/i.test(message);
}

// True when Tauri could not find the command at all — i.e. the Rust binary is
// older than the frontend calling it. Distinct from the command running and
// failing, which must not be retried over a slower path.
function isMissingCommand(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /not found|unknown command|command .* not allowed/i.test(message);
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retries a preview download that died with a transport-level failure such as
// "error decoding response body". Cancelled transfers are never retried.
export async function downloadPreview(
  client: Pick<PlotterClient, "downloadJob">,
  filename: string,
  signal?: AbortSignal,
): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await delay(1000 * 2 ** (attempt - 1));
    }
    try {
      return await client.downloadJob(filename, signal);
    } catch (error) {
      lastError = error;
      if (isRequestCancelled(error)) throw error;
      console.warn(`Preview download of "${filename}" failed (attempt ${attempt + 1}/3): ${String(error)}`);
    }
  }
  throw lastError;
}

// PlotterClient

export class PlotterClient {
  // Base HTTP URL, e.g. `http://192.168.1.42`
  readonly baseUrl: string;

  private readonly _socket: PlotterSocketManager;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this._socket = new PlotterSocketManager(wsUrlFromHttp(this.baseUrl));
  }

  // Real-time state

  /**
   * Subscribe to live state messages pushed by the device every 100 ms.
   * Opens the WebSocket connection on the first call.
   * @returns Unsubscribe function — call it to stop receiving updates.
   *          The socket is closed automatically when all subscribers unsubscribe.
  */
  subscribe(listener: StateListener): () => void {
    return this._socket.subscribe(listener);
  }

  // Device Info

  // Get the hardware iteration number.
  async getIteration(): Promise<number> {
    const body = await request(`${this.baseUrl}/iteration`);
    return parseJson<PlotterIteration>(body).iteration;
  }

  // Get the firmware version string, e.g. `"1.2.3"`.
  async getFirmwareVersion(): Promise<string> {
    const body = await request(`${this.baseUrl}/firmwareVersion`);
    return parseJson<FirmwareVersion>(body).firmwareVersion;
  }

  // Get the maximum workspace dimensions in mm.
  async getWorkspace(): Promise<WorkspaceSize> {
    const body = await request(`${this.baseUrl}/workspace`);
    return parseJson<WorkspaceSize>(body);
  }

  // State
  async getMotionState(): Promise<MotionState> {
    const body = await request(`${this.baseUrl}/motionState`);
    const data = parseJson<{ motionState?: MotionState } | MotionState>(body);
    return (typeof data === "object" && data !== null && "motionState" in data
      ? data.motionState
      : data) as MotionState;
  }

  // Device Name

  // Get the human-readable display name.
  async getName(): Promise<string> {
    const body = await request(`${this.baseUrl}/name`);
    return decode(body);
  }

  // Set the human-readable display name.
  async setName(name: string): Promise<void> {
    await request(`${this.baseUrl}/name`, {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body: name,
    });
  }

  // Get the mDNS hostname, e.g. `"plotter"` (without `.local`).
  async getMdnsName(): Promise<string> {
    const body = await request(`${this.baseUrl}/mdnsName`);
    return decode(body);
  }

  // Update the mDNS hostname. Causes an mDNS restart on the device.
  async setMdnsName(name: string): Promise<void> {
    await request(`${this.baseUrl}/mdnsName`, {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body: name,
    });
  }

  // Job Files

  // List all `.gcode` files stored on the device.
  async listFiles(): Promise<string[]> {
    const body = await request(`${this.baseUrl}/plotFiles`);
    return parseJson<string[]>(body);
  }

  /**
   * Upload a `.gcode` file (max 10 MB).
   *
   * Uses the long upload timeout — a 1 MB+ body to an embedded device over WiFi
   * can take tens of seconds, far beyond the interactive request timeout.
   *
   * @param filename  Alphanumeric + `-`, `_`, `.` only; must end in `.gcode`.
   * @param content   Raw gcode text or a `Blob`/`File` object.
  */
  async uploadFile(filename: string, content: string | Blob): Promise<UploadResult> {
    const body = new FormData();
    const blob =
      typeof content === "string"
        ? new Blob([content], { type: "text/plain" })
        : content;
    body.append("file", blob, filename);
    const raw = await request(
      `${this.baseUrl}/upload`,
      { method: "POST", body },
      UPLOAD_TIMEOUT_MS,
    );
    return parseJson<UploadResult>(raw);
  }

  // get metadata about a stored file, including line count, size in bytes, and estimated time in seconds.
  async getFileInfo(filename: string): Promise<FileInfo> {
    const url = new URL(`${this.baseUrl}/fileInfo`);
    url.searchParams.set("file", filename);
    const body = await request(url.toString());
    return parseJson<FileInfo>(body);
  }

  // Delete a stored gcode file by name.
  async deleteFile(filename: string): Promise<void> {
    const url = new URL(`${this.baseUrl}/plotFiles`);
    url.searchParams.set("file", filename);
    await request(url.toString(), { method: "DELETE" });
  }

  // Download the raw gcode content of a stored file.
  //
  // Prefers the single-shot `fetch_text` command, which returns the whole body in
  // ONE IPC response. The streaming plugin fetch costs one IPC round trip per
  // network chunk, and this firmware sends 1460-byte chunks — so a multi-MB file
  // needed thousands of serialized hops and appeared to hang. Falls back to the
  // plugin if the command is unavailable (e.g. an older Rust build).
  //
  // Neither path aborts on a caller-supplied `signal`: a single-shot invoke
  // cannot be cancelled once dispatched, and abandoning it mid-flight would leave
  // the device streaming into a request nobody reads. Supersession is handled by
  // the caller's request queue, which discards results for stale files.
  async downloadJob(filename: string, signal?: AbortSignal): Promise<string> {
    const url = new URL(`${this.baseUrl}/downloadJob`);
    url.searchParams.set("file", filename);
    const full = url.toString();
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    try {
      return await invoke<string>("fetch_text", { url: full, timeoutMs: TRANSFER_TIMEOUT_MS });
    } catch (error) {
      // Only fall back when the command itself is unavailable — a real HTTP or
      // network failure must surface rather than be retried over a slow pipe.
      if (!isMissingCommand(error)) throw error;
      console.warn("fetch_text unavailable, falling back to streaming download");
    }

    return decode(
      await request(full, signal ? { signal } : undefined, TRANSFER_TIMEOUT_MS),
    );
  }

  // Job Control

  // Start printing a file already stored on the device.
  async startJob(filename: string): Promise<void> {
    const url = new URL(`${this.baseUrl}/start`);
    url.searchParams.set("file", filename);
    await request(url.toString(), { method: "POST" });
  }

  // Abort the currently running job.
  async abortJob(): Promise<void> {
    await request(`${this.baseUrl}/abort`, { method: "POST" });
  }

  // Pause the currently running job.
  async pauseJob(): Promise<void> {
    await request(`${this.baseUrl}/pause`, { method: "POST" });
  }

  // Resume a paused job.
  async resumeJob(): Promise<void> {
    await request(`${this.baseUrl}/resume`, { method: "POST" });
  }

  // Fetch the current job status. Redundant when WebSocket is active.
  async getJobStatus(): Promise<JobStatus> {
    const body = await request(`${this.baseUrl}/jobStatus`);
    return parseJson<JobStatus>(body);
  }

  // ── GCode Execution ────────────────────────────────────────────────────────

  /**
   * Execute a single GCode line immediately.
   * Throws `PlotterApiError` with status 503 if the device is busy.
  */
  async executeGCode(line: string): Promise<void> {
    await request(`${this.baseUrl}/execute`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: line,
    });
  }

  // Settings

  // Get all device settings as a key value map.
  async getAllSettings(): Promise<PlotterSettings> {
    const body = await request(`${this.baseUrl}/settings`);
    return parseJson<PlotterSettings>(body);
  }

  // Get a single setting value as a plain-text string.
  async getSetting(key: SettingKey): Promise<string> {
    const url = new URL(`${this.baseUrl}/setting`);
    url.searchParams.set("key", key);
    const body = await request(url.toString());
    return decode(body);
  }

  // Update a single setting. Persisted to flash immediately.
  async setSetting(key: SettingKey, value: string | number): Promise<void> {
    const url = new URL(`${this.baseUrl}/setting`);
    url.searchParams.set("key", key);
    url.searchParams.set("value", String(value));
    await request(url.toString(), { method: "PUT" });
  }
}
