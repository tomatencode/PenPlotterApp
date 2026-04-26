// ─── Device Info ─────────────────────────────────────────────────────────────

export interface PlotterIteration {
  iteration: number;
}

export interface FirmwareVersion {
  firmwareVersion: string;
}

export interface WorkspaceSize {
  x: number;
  y: number;
}

// ─── Job Files ───────────────────────────────────────────────────────────────

export interface UploadResult {
  status: "success";
  file: string;
  size: number;
}

// ─── Job Control ─────────────────────────────────────────────────────────────

export type MotionState = "idle" | "running" | "paused";

export interface JobStatus {
  active: boolean;
  paused: boolean;
  file: string | null;
  currentLine: number;
  totalLines: number;
  /** 0.0–1.0 */
  progress: number;
}

export interface FileInfo {
  lines: number;
  sizeBytes: number;
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
  | "penDownAngle"
  | "penSlots";

export type PlotterSettings = Partial<Record<SettingKey, string>>;

// ─── WebSocket ────────────────────────────────────────────────────────────────

export interface WsStateMessage {
  type: "state";
  x: number;
  y: number;
  penDown: boolean;
  activePenSlot: number | null;
  motionState: MotionState;
  jobActive: boolean;
  jobFile: string;
  jobProgress: number;
  jobLine: number;
  jobTotalLines: number;
}

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
