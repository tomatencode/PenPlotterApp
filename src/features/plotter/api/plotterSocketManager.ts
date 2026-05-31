import type {
  WsStateMessage,
} from "./plotterTypes";
export type { StateListener }
export {
  wsUrlFromHttp,
  PlotterSocketManager,
};

/** Derives the WebSocket URL from the HTTP base URL.
 *  http://192.168.1.42       → ws://192.168.1.42:81
 *  http://192.168.1.42:8080  → ws://192.168.1.42:81
 *  http://plotter.local      → ws://plotter.local:81
 */
function wsUrlFromHttp(httpUrl: string): string {
  const { hostname } = new URL(httpUrl);
  return `ws://${hostname}:81`;
}

// ─── Internal WebSocket manager ───────────────────────────────────────────────

type StateListener = (msg: WsStateMessage) => void;

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

class PlotterSocketManager {
  private ws: WebSocket | null = null;
  private listeners = new Set<StateListener>();
  private stopped = false;
  private reconnectDelay = RECONNECT_BASE_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly wsUrl: string) {}

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    this.stopped = false;
    if (this.ws === null && this.reconnectTimer === null) {
      this.connect();
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.stop();
      }
    };
  }

  private connect(): void {
    if (this.stopped) return;
    const ws = new WebSocket(this.wsUrl);
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectDelay = RECONNECT_BASE_MS;
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      let msg: WsStateMessage;
      try {
        msg = JSON.parse(event.data) as WsStateMessage;
      } catch {
        return;
      }
      if (msg.type !== "state") return;
      this.listeners.forEach(l => l(msg));
    };

    ws.onclose = () => {
      this.ws = null;
      if (!this.stopped && this.listeners.size > 0) {
        this.scheduleReconnect();
      }
    };

    ws.onerror = () => {
      // onclose fires immediately after, so reconnect is handled there
      ws.close();
    };
  }

  private scheduleReconnect(): void {
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, RECONNECT_MAX_MS);
  }

  private stop(): void {
    this.stopped = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws !== null) {
      this.ws.close();
      this.ws = null;
    }
  }
}