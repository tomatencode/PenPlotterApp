import { fetch } from "@tauri-apps/plugin-http";
import type {
  JobStatus,
  PenSlot,
  PlotterSettings,
  SettingKey,
  UploadResult,
} from "./plotterTypes";
export { PlotterApiError } from "./plotterTypes";
export type { JobStatus, PenSlot, PlotterSettings, SettingKey, UploadResult };

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function checkResponse(res: Response): Promise<Response> {
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new (await import("./plotterTypes")).PlotterApiError(res.status, body);
  }
  return res;
}

// ─── PlotterClient ────────────────────────────────────────────────────────────

/**
 * Thin, typed HTTP client for the pen plotter web API.
 *
 * All methods throw {@link PlotterApiError} on non-2xx responses and
 * re-throw native fetch errors (e.g. network unreachable) as-is.
 */
export class PlotterClient {
  /** Base URL, e.g. `http://192.168.1.42` or `http://plotter.local` */
  readonly baseUrl: string;

  constructor(baseUrl: string) {
    // Normalise – strip trailing slash
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  // ── Job Files ──────────────────────────────────────────────────────────────

  /** List all `.gcode` files stored on the device. */
  async listFiles(): Promise<string[]> {
    const res = await checkResponse(await fetch(`${this.baseUrl}/plotFiles`));
    return res.json() as Promise<string[]>;
  }

  /** Delete a stored gcode file by name. */
  async deleteFile(filename: string): Promise<void> {
    const url = new URL(`${this.baseUrl}/plotFiles`);
    url.searchParams.set("file", filename);
    await checkResponse(await fetch(url.toString(), { method: "DELETE" }));
  }

  /**
   * Upload a `.gcode` file (max 10 MB).
   * @param filename  Must match `/^[A-Za-z0-9._-]+\.gcode$/`.
   * @param content   Raw gcode text or a `Blob`/`File` object.
   */
  async uploadFile(filename: string, content: string | Blob): Promise<UploadResult> {
    const body = new FormData();
    const blob = typeof content === "string"
      ? new Blob([content], { type: "text/plain" })
      : content;
    body.append("file", blob, filename);
    const res = await checkResponse(
      await fetch(`${this.baseUrl}/upload`, { method: "POST", body }),
    );
    return res.json() as Promise<UploadResult>;
  }

  // ── Job Control ────────────────────────────────────────────────────────────

  /** Start printing a file that is already stored on the device. */
  async startJob(filename: string): Promise<void> {
    const url = new URL(`${this.baseUrl}/start`);
    url.searchParams.set("file", filename);
    await checkResponse(await fetch(url.toString(), { method: "POST" }));
  }

  /** Abort the currently running job. */
  async abortJob(): Promise<void> {
    await checkResponse(await fetch(`${this.baseUrl}/abort`, { method: "POST" }));
  }

  /** Pause the currently running job. */
  async pauseJob(): Promise<void> {
    await checkResponse(await fetch(`${this.baseUrl}/pause`, { method: "POST" }));
  }

  /** Resume a paused job. */
  async resumeJob(): Promise<void> {
    await checkResponse(await fetch(`${this.baseUrl}/resume`, { method: "POST" }));
  }

  /**
   * Poll job status.
   * Suggested interval: 500–1000 ms while `active` is `true`.
   */
  async getJobStatus(): Promise<JobStatus> {
    const res = await checkResponse(await fetch(`${this.baseUrl}/jobStatus`));
    return res.json() as Promise<JobStatus>;
  }

  // ── GCode Execution ────────────────────────────────────────────────────────

  /**
   * Execute a single GCode line immediately.
   * Throws a `PlotterApiError` with status 503 if the device is busy.
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

  // ── Pen Slots ──────────────────────────────────────────────────────────────

  /** Get all pen slot configurations. */
  async getPenSlots(): Promise<PenSlot[]> {
    const res = await checkResponse(await fetch(`${this.baseUrl}/penSlots`));
    return res.json() as Promise<PenSlot[]>;
  }

  /**
   * Update all pen slot configurations.
   * The array length must match the number of physical slots – always send all slots.
   */
  async setPenSlots(slots: PenSlot[]): Promise<void> {
    await checkResponse(
      await fetch(`${this.baseUrl}/penSlots`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slots),
      }),
    );
  }

  /**
   * Get the currently active pen slot index.
   * Returns `null` when no slot is active.
   */
  async getActivePenSlot(): Promise<number | null> {
    const res = await checkResponse(await fetch(`${this.baseUrl}/activePenSlot`));
    return res.json() as Promise<number | null>;
  }

  // ── Settings ───────────────────────────────────────────────────────────────

  /** Get all device settings as a key→value map. */
  async getAllSettings(): Promise<PlotterSettings> {
    const res = await checkResponse(await fetch(`${this.baseUrl}/settings`));
    return res.json() as Promise<PlotterSettings>;
  }

  /** Get a single setting value as a plain-text string. */
  async getSetting(key: SettingKey): Promise<string> {
    const url = new URL(`${this.baseUrl}/setting`);
    url.searchParams.set("key", key);
    const res = await checkResponse(await fetch(url.toString()));
    return res.text();
  }

  /** Update a single setting. */
  async setSetting(key: SettingKey, value: string | number): Promise<void> {
    const url = new URL(`${this.baseUrl}/setting`);
    url.searchParams.set("key", key);
    url.searchParams.set("value", String(value));
    await checkResponse(await fetch(url.toString(), { method: "PUT" }));
  }

  // ── Device Name ────────────────────────────────────────────────────────────

  /** Update the human-readable display name of the device. */
  async setName(name: string): Promise<void> {
    await checkResponse(
      await fetch(`${this.baseUrl}/name`, {
        method: "PUT",
        headers: { "Content-Type": "text/plain" },
        body: name,
      }),
    );
  }

  async getName(): Promise<string> {
    const res = await checkResponse(await fetch(`${this.baseUrl}/name`));
    return res.text();
  }

  /**
   * Update the mDNS hostname of the device.
   * Equivalent to calling `setSetting("mdnsName", name)`.
   */
  async setMdnsName(name: string): Promise<void> {
    await checkResponse(
      await fetch(`${this.baseUrl}/mdnsName`, {
        method: "PUT",
        headers: { "Content-Type": "text/plain" },
        body: name,
      }),
    );
  }
}
