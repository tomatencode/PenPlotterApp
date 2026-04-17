import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/**
 * Start continuous mDNS discovery. Plotters are reported as they join or leave
 * the network. Returns a cleanup function — call it to stop the daemon and
 * remove event listeners (e.g. on component unmount).
 */
export async function startPlotterDiscovery(
  onFound: (url: string) => void,
  onLost: (url: string) => void,
): Promise<() => void> {
  const unlistenFound = await listen<string>("plotter-found", (e) => onFound(e.payload));
  const unlistenLost  = await listen<string>("plotter-lost",  (e) => onLost(e.payload));

  await invoke("start_plotter_discovery");

  return () => {
    unlistenFound();
    unlistenLost();
    invoke("stop_plotter_discovery").catch(console.error);
  };
}
