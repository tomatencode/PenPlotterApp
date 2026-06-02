import { createContext, useContext, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { PlotterClient } from "./api/plotterClient";

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
  const iterationFetchedRef = useRef<Set<string>>(new Set());
  // Timestamp of the last successful poll response per URL.
  const lastSeenRef = useRef<Map<string, number>>(new Map());

  function getClient(url: string): PlotterClient {
    if (!clientsRef.current.has(url)) {
      clientsRef.current.set(url, new PlotterClient(url));
    }
    return clientsRef.current.get(url)!;
  }

  function addPlotter(url: string) {
    // Refresh before the early-return so that a plotter-found event for an
    // already-known (but "connecting") plotter resets the timeout clock.
    lastSeenRef.current.set(url, Date.now());
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
    iterationFetchedRef.current.delete(url);
    lastSeenRef.current.delete(url);
    setPlotters((prev) => prev.filter((p) => p.url !== url));
    console.log(`Plotter lost: ${url}`);
  }

  // Poll motion state for all known plotters every 2 seconds.
  useEffect(() => {
    const id = setInterval(() => {
      for (const plotter of plottersRef.current) {
        const client = getClient(plotter.url);
        console.log(`Polling plotter: ${plotter.url}`);

        const nameProm = client.getName()
          .then((name) => {
            setPlotters((prev) => prev.map(
              (p) => p.url === plotter.url ? { ...p, displayInfo: { ...p.displayInfo, name } } : p)
            );
          })
          .catch(() => {
            setPlotters((prev) => prev.map(
              (p) => p.url === plotter.url ? { ...p, displayInfo: { ...p.displayInfo, name: plotter.url } } : p)
            );
            return Promise.reject();
          });

        const mdnsNameProm = client.getMdnsName()
          .then((mdnsName) => {
            setPlotters((prev) => prev.map(
              (p) => p.url === plotter.url ? { ...p, displayInfo: { ...p.displayInfo, mdnsName } } : p)
            );
          })
          .catch(() => {
            setPlotters((prev) => prev.map(
              (p) => p.url === plotter.url ? { ...p, displayInfo: { ...p.displayInfo, mdnsName: "" } } : p)
            );
            return Promise.reject();
          });

        const motionStateProm = client.getMotionState()
          .then((state) => {
            setPlotters((prev) => prev.map(
              (p) => p.url === plotter.url ? { ...p, displayInfo: { ...p.displayInfo, state } } : p)
            );
          })
          .catch(() => {
            setPlotters((prev) => prev.map(
              (p) => p.url === plotter.url ? { ...p, displayInfo: { ...p.displayInfo, state: "connecting" } } : p)
            );
            return Promise.reject();
          });

        const proms: Promise<void>[] = [nameProm, mdnsNameProm, motionStateProm];

        // Only fetch iteration once — the hardware revision never changes.
        if (!iterationFetchedRef.current.has(plotter.url)) {
          const iterProm = client.getIteration()
            .then((iteration) => {
              iterationFetchedRef.current.add(plotter.url);
              setPlotters((prev) => prev.map(
                (p) => p.url === plotter.url ? { ...p, displayInfo: { ...p.displayInfo, iteration } } : p)
              );
            })
            .catch(() => {
              setPlotters((prev) => prev.map(
                (p) => p.url === plotter.url ? { ...p, displayInfo: { ...p.displayInfo, iteration: 0 } } : p)
              );
              return Promise.reject();
            });
          proms.push(iterProm);
        }

        // Track last-seen time and remove plotters unresponsive for more than 10 s.
        // The plotter will re-appear naturally when mDNS fires plotter-found again.
        Promise.allSettled(proms).then((results) => {
          if (results.some((r) => r.status === "fulfilled")) {
            lastSeenRef.current.set(plotter.url, Date.now());
          }
          if (results.some((r) => r.status === "rejected")) {
            const lastSeen = lastSeenRef.current.get(plotter.url) ?? Date.now();
            if (Date.now() - lastSeen > 10_000) {
              removePlotter(plotter.url);
              // Flush the mDNS daemon's cache for this plotter so it is
              // re-detected via a fresh ServiceResolved when it powers back on.
              invoke("forget_plotter", { url: plotter.url }).catch(console.error);
            } else {
              setPlotters((prev) => prev.map(
                (p) => p.url === plotter.url ? { ...p, displayInfo: { ...p.displayInfo, state: "connecting" } } : p)
              );
            }
          }
        });
      }
    }, 2000);
    return () => clearInterval(id);
  }, []);

  // Start mDNS discovery once for the app's lifetime — never stop the daemon.
  // Only the event listeners are removed on unmount (which won't happen in practice
  // since this provider wraps the entire app).
  useEffect(() => {
    let unlistenFound: (() => void) | undefined;
    let unlistenLost: (() => void) | undefined;

    (async () => {
      unlistenFound = await listen<string>("plotter-found", (e) => addPlotter(e.payload));
      unlistenLost  = await listen<string>("plotter-lost",  (e) => removePlotter(e.payload));
      await invoke("start_plotter_discovery");
    })().catch(console.error);

    return () => {
      unlistenFound?.();
      unlistenLost?.();
    };
  }, []);

  return (
    <PlotterDiscoveryContext.Provider value={{ plotters }}>
      {children}
    </PlotterDiscoveryContext.Provider>
  );
}
