import { createContext, useContext, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { PlotterClient } from "../api/plotterClient";

export type PlotterState = "idle" | "running" | "paused" | "connecting";

export interface PlotterDisplayInfo {
  name: string;
  mdnsName: string;
  iteration: number;
  state: PlotterState;
}


export interface Plotter {
  url: string;
  displayInfo: PlotterDisplayInfo;
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

  // Internal clients — not exposed, never put in React state
  const clientsRef = useRef<Map<string, PlotterClient>>(new Map());

  function getClient(url: string): PlotterClient {
    if (!clientsRef.current.has(url)) {
      clientsRef.current.set(url, new PlotterClient(url));
    }
    return clientsRef.current.get(url)!;
  }

  function addPlotter(url: string) {
    if (plottersRef.current.some((p) => p.url === url)) return;
    getClient(url); // ensure client exists
    setPlotters((prev) => {
      if (prev.some((p) => p.url === url)) return prev;
      return [...prev, { url, displayInfo: { name: "", mdnsName: "", iteration: 0, state: "connecting" } }];
    });
    console.log(`Plotter found: ${url}`);
  }

  function removePlotter(url: string) {
    clientsRef.current.delete(url);
    setPlotters((prev) => prev.filter((p) => p.url !== url));
    console.log(`Plotter lost: ${url}`);
  }


  // Poll motion state for all known plotters every 2 seconds.
  useEffect(() => {
    const id = setInterval(() => {
      for (const plotter of plottersRef.current) {
        const client = getClient(plotter.url);
        let allInfoFetched = true;
        console.log(`Polling plotter: ${plotter.url}`);

        client.getName()
          .then((name) => {
            setPlotters((prev) => prev.map(
              (p) => p.url === plotter.url ? { ...p, displayInfo: { ...p.displayInfo, name } } : p)
            );
          })
          .catch(() => {
            allInfoFetched = false;
            setPlotters((prev) => prev.map(
              (p) => p.url === plotter.url ? { ...p, displayInfo: { ...p.displayInfo, name: plotter.url } } : p)
            );
          });
        
        client.getMdnsName()
          .then((mdnsName) => {
            setPlotters((prev) => prev.map(
              (p) => p.url === plotter.url ? { ...p, displayInfo: { ...p.displayInfo, mdnsName } } : p)
            );
          })
          .catch(() => {
            allInfoFetched = false;
            setPlotters((prev) => prev.map(
              (p) => p.url === plotter.url ? { ...p, displayInfo: { ...p.displayInfo, mdnsName: "" } } : p)
            );
          });
        
        // Only fetch iteration if we haven't successfully fetched it before - the hardware doesn't change
        if (plotter.displayInfo.iteration === 0) {
          client.getIteration()
            .then((iteration) => {
              setPlotters((prev) => prev.map(
                (p) => p.url === plotter.url ? { ...p, displayInfo: { ...p.displayInfo, iteration } } : p)
              );
            })
            .catch(() => {
              allInfoFetched = false;
              setPlotters((prev) => prev.map(
                (p) => p.url === plotter.url ? { ...p, displayInfo: { ...p.displayInfo, iteration: 0 } } : p)
              );
            });
        }

        if (!allInfoFetched) {
          // If we failed to fetch some info, mark the plotter as "connecting" to indicate an issue.
          setPlotters((prev) => prev.map(
            (p) => p.url === plotter.url ? { ...p, displayInfo: { ...p.displayInfo, state: "connecting" } } : p)
          );
          continue;
        }

        client.getMotionState()
          .then((state) => {
            setPlotters((prev) => prev.map(
              (p) => p.url === plotter.url ? { ...p, displayInfo: { ...p.displayInfo, state } } : p)
            );
          })
          .catch(() => {
            allInfoFetched = false;
            setPlotters((prev) => prev.map(
              (p) => p.url === plotter.url ? { ...p, displayInfo: { ...p.displayInfo, state: "connecting" } } : p)
            );
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
