// ─── Job Files ───────────────────────────────────────────────────────────────

export interface UploadResult {
  status: "success";
  file: string;
  size: number;
}

// ─── Job Control ─────────────────────────────────────────────────────────────

export interface JobStatus {
  active: boolean;
  paused: boolean;
  file: string | null;
  currentLine: number;
  totalLines: number;
  /** 0–100 */
  progress: number;
}

// ─── Pen Slots ────────────────────────────────────────────────────────────────

/** color is RGBA (0–255 each), stroke is 0–255 */
export interface PenSlot {
  empty: boolean;
  stroke: number;
  color: [number, number, number, number];
}

// ─── Settings ────────────────────────────────────────────────────────────────

export type SettingKey =
  | "mdnsName"
  | "driverCurrent"
  | "microsteps"
  | "drawFeedRate"
  | "travelFeedRate"
  | "homingSpeed"
  | "homingBackOffSpeed"
  | "stallguardThreshold"
  | "backOffStepsX"
  | "backOffStepsY"
  | "homingTimeout"
  | "sgCheckInterval"
  | "sgStartTimeout"
  | "sgHistorySize"
  | "penUpAngle"
  | "penDownAngle";

export type PlotterSettings = Partial<Record<SettingKey, string>>;

// ─── Errors ───────────────────────────────────────────────────────────────────

export class PlotterApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "PlotterApiError";
  }
}
