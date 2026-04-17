import { invoke } from "@tauri-apps/api/core";

/**
 * Scan the local network for pen plotters via mDNS (_http._tcp + device=pnplttr TXT record).
 * Blocks for ~3 seconds then returns the base URL of each plotter found,
 * e.g. `["http://192.168.1.42", "http://192.168.1.55"]`.
 */
export function discoverPlotters(): Promise<string[]> {
  return invoke<string[]>("discover_plotters");
}
