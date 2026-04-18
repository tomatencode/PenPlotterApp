import { createContext, useContext, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { PlotterClient } from "../api/plotterClient";

export type PlotterState = "idle" | "running" | "paused" | "connecting";

export interface Plotter {
  url: string;
  name: string;
  state: PlotterState;
  client: PlotterClient;
}

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

  function addPlotter(url: string) {
    if (plottersRef.current.some((p) => p.url === url)) return;
    const client = new PlotterClient(url);
    setPlotters((prev) => {
      if (prev.some((p) => p.url === url)) return prev;
      return [...prev, { url, name: url, state: "connecting", client }];
    });
    console.log(`Plotter found: ${url}`);
  }

  function removePlotter(url: string) {
    setPlotters((prev) => prev.filter((p) => p.url !== url));
  }


  // Poll motion state for all known plotters every 2 seconds.
  useEffect(() => {
    const id = setInterval(() => {
      for (const plotter of plottersRef.current) {
        plotter.client.getMotionState()
          .then((state) => {
            setPlotters((prev) => prev.map((p) => p.url === plotter.url ? { ...p, state } : p));
          })
          .catch(() => {
            setPlotters((prev) => prev.map((p) => p.url === plotter.url ? { ...p, state: "connecting" } : p));
          });
        
        plotter.client.getName()
          .then((name) => {
            setPlotters((prev) => prev.map((p) => p.url === plotter.url ? { ...p, name } : p));
          })
          .catch(() => {
            setPlotters((prev) => prev.map((p) => p.url === plotter.url ? { ...p, name: plotter.url } : p));
          });
      }
    }, 2000);
    return () => clearInterval(id);
  }, []);


  // Start mDNS discovery once for the app's lifetime — never stop the daemon.
  // Only the event listeners are removed on unmount (which won't happen in practice
  // since this provider wraps the entire app).
  useEffect(() => {
    (async () => {
      await listen<string>("plotter-found", (e) => addPlotter(e.payload));
      await listen<string>("plotter-lost",  (e) => removePlotter(e.payload));
      await invoke("start_plotter_discovery");
    })().catch(console.error);
  }, []);

  return (
    <PlotterDiscoveryContext.Provider value={{ plotters }}>
      {children}
    </PlotterDiscoveryContext.Provider>
  );
}
