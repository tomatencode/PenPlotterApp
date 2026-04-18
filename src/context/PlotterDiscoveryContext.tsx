import { createContext, useContext, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { type Plotter, type PlotterState } from "../components/home/types";
import { PlotterClient } from "../api/plotterClient";

interface PlotterDiscoveryContextValue {
  plotters: Plotter[];
}

const PlotterDiscoveryContext = createContext<PlotterDiscoveryContextValue>({ plotters: [] });

export function usePlotterDiscovery() {
  return useContext(PlotterDiscoveryContext);
}

export function PlotterDiscoveryProvider({ children }: { children: React.ReactNode }) {
  const [plotters, setPlotters] = useState<Plotter[]>([]);
  const plottersRef = useRef<Plotter[]>([]);
  useEffect(() => { plottersRef.current = plotters; }, [plotters]);

  async function resolveAndAddPlotter(url: string) {
    try {
      const client = new PlotterClient(url);
      const [name, status] = await Promise.all([client.getName(), client.getJobStatus()]);
      const state: PlotterState =
        status.active && !status.paused ? "running"
        : status.active && status.paused ? "paused"
        : "idle";
      setPlotters((prev) => [...prev.filter((p) => p.id !== url), { id: url, name, url, state }]);
    } catch {
      const name = new URL(url).hostname;
      setPlotters((prev) => [...prev.filter((p) => p.id !== url), { id: url, name, url, state: "offline" }]);
    }
  }

  // Start mDNS discovery once for the app's lifetime — never stop the daemon.
  // Only the event listeners are removed on unmount (which won't happen in practice
  // since this provider wraps the entire app).
  useEffect(() => {
    let unlistenFound: (() => void) | undefined;
    let unlistenLost: (() => void) | undefined;

    (async () => {
      unlistenFound = await listen<string>("plotter-found", (e) => resolveAndAddPlotter(e.payload));
      unlistenLost  = await listen<string>("plotter-lost",  (e) =>
        setPlotters((prev) => prev.filter((p) => p.id !== e.payload))
      );
      await invoke("start_plotter_discovery");
    })().catch(console.error);

    return () => {
      unlistenFound?.();
      unlistenLost?.();
      // Deliberately NOT calling stop_plotter_discovery — the daemon outlives
      // any individual screen and we want instant re-discovery on navigation.
    };
  }, []);

  // Poll known online plotters every second to keep status current.
  useEffect(() => {
    const id = setInterval(() => {
      const online = plottersRef.current.filter((p) => p.state !== "offline");
      online.forEach((p) => resolveAndAddPlotter(p.url));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <PlotterDiscoveryContext.Provider value={{ plotters }}>
      {children}
    </PlotterDiscoveryContext.Provider>
  );
}
