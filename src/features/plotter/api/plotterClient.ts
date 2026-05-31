import { fetch as _fetch } from "@tauri-apps/plugin-http";
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

/** Wraps the Tauri fetch with a per-request timeout. */
function fetch(
  input: string | URL,
  init?: Parameters<typeof _fetch>[1],
): ReturnType<typeof _fetch> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return _fetch(input as string, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(id),
  );
}

async function checkResponse(res: Response): Promise<Response> {
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new PlotterApiError(res.status, body);
  }
  return res;
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
    const res = await checkResponse(await fetch(`${this.baseUrl}/iteration`));
    return ((await res.json()) as PlotterIteration).iteration;
  }

  // Get the firmware version string, e.g. `"1.2.3"`.
  async getFirmwareVersion(): Promise<string> {
    const res = await checkResponse(await fetch(`${this.baseUrl}/firmwareVersion`));
    return ((await res.json()) as FirmwareVersion).firmwareVersion;
  }

  // Get the maximum workspace dimensions in mm.
  async getWorkspace(): Promise<WorkspaceSize> {
    const res = await checkResponse(await fetch(`${this.baseUrl}/workspace`));
    return res.json() as Promise<WorkspaceSize>;
  }

  // State
  async getMotionState(): Promise<MotionState> {
    const res = await checkResponse(await fetch(`${this.baseUrl}/motionState`));
    const data = await res.json();
    return (typeof data === "object" ? data.motionState : data) as MotionState;
  }

  // Device Name

  // Get the human-readable display name.
  async getName(): Promise<string> {
    const res = await checkResponse(await fetch(`${this.baseUrl}/name`));
    return res.text();
  }

  // Set the human-readable display name.
  async setName(name: string): Promise<void> {
    await checkResponse(
      await fetch(`${this.baseUrl}/name`, {
        method: "PUT",
        headers: { "Content-Type": "text/plain" },
        body: name,
      }),
    );
  }

  // Get the mDNS hostname, e.g. `"plotter"` (without `.local`).
  async getMdnsName(): Promise<string> {
    const res = await checkResponse(await fetch(`${this.baseUrl}/mdnsName`));
    return res.text();
  }

  // Update the mDNS hostname. Causes an mDNS restart on the device.
  async setMdnsName(name: string): Promise<void> {
    await checkResponse(
      await fetch(`${this.baseUrl}/mdnsName`, {
        method: "PUT",
        headers: { "Content-Type": "text/plain" },
        body: name,
      }),
    );
  }

  // Job Files

  // List all `.gcode` files stored on the device.
  async listFiles(): Promise<string[]> {
    const res = await checkResponse(await fetch(`${this.baseUrl}/plotFiles`));
    return res.json() as Promise<string[]>;
  }

  /**
   * Upload a `.gcode` file (max 10 MB).
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
    const res = await checkResponse(
      await fetch(`${this.baseUrl}/upload`, { method: "POST", body }),
    );
    return res.json() as Promise<UploadResult>;
  }

  // get metadata about a stored file, including line count, size in bytes, and estimated time in seconds.
  async getFileInfo(filename: string): Promise<FileInfo> {
    const url = new URL(`${this.baseUrl}/fileInfo`);
    url.searchParams.set("file", filename);
    const res = await checkResponse(await fetch(url.toString()));
    return res.json() as Promise<FileInfo>;
  }

  // Delete a stored gcode file by name.
  async deleteFile(filename: string): Promise<void> {
    const url = new URL(`${this.baseUrl}/plotFiles`);
    url.searchParams.set("file", filename);
    await checkResponse(await fetch(url.toString(), { method: "DELETE" }));
  }

  // Job Control

  // Start printing a file already stored on the device.
  async startJob(filename: string): Promise<void> {
    const url = new URL(`${this.baseUrl}/start`);
    url.searchParams.set("file", filename);
    await checkResponse(await fetch(url.toString(), { method: "POST" }));
  }

  // Abort the currently running job.
  async abortJob(): Promise<void> {
    await checkResponse(await fetch(`${this.baseUrl}/abort`, { method: "POST" }));
  }

  // Pause the currently running job.
  async pauseJob(): Promise<void> {
    await checkResponse(await fetch(`${this.baseUrl}/pause`, { method: "POST" }));
  }

  // Resume a paused job.
  async resumeJob(): Promise<void> {
    await checkResponse(await fetch(`${this.baseUrl}/resume`, { method: "POST" }));
  }

  // Fetch the current job status. Redundant when WebSocket is active.
  async getJobStatus(): Promise<JobStatus> {
    const res = await checkResponse(await fetch(`${this.baseUrl}/jobStatus`));
    return res.json() as Promise<JobStatus>;
  }

  // ── GCode Execution ────────────────────────────────────────────────────────

  /**
   * Execute a single GCode line immediately.
   * Throws `PlotterApiError` with status 503 if the device is busy.
  */
  async executeGCode(line: string): Promise<void> {
    await checkResponse(
      await fetch(`${this.baseUrl}/execute`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: line,
      }),
    );
  }

  // Settings

  // Get all device settings as a key value map.
  async getAllSettings(): Promise<PlotterSettings> {
    const res = await checkResponse(await fetch(`${this.baseUrl}/settings`));
    return res.json() as Promise<PlotterSettings>;
  }

  // Get a single setting value as a plain-text string.
  async getSetting(key: SettingKey): Promise<string> {
    const url = new URL(`${this.baseUrl}/setting`);
    url.searchParams.set("key", key);
    const res = await checkResponse(await fetch(url.toString()));
    return res.text();
  }

  // Update a single setting. Persisted to flash immediately.
  async setSetting(key: SettingKey, value: string | number): Promise<void> {
    const url = new URL(`${this.baseUrl}/setting`);
    url.searchParams.set("key", key);
    url.searchParams.set("value", String(value));
    await checkResponse(await fetch(url.toString(), { method: "PUT" }));
  }
}
