use mdns_sd::{ServiceDaemon, ServiceEvent};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

const SERVICE_TYPE: &str = "_http._tcp.local.";
const DEVICE_KEY: &str = "device";
const DEVICE_VALUE: &str = "pnplttr";

fn normalize_fullname(fullname: &str) -> String {
    fullname.trim_end_matches('.').to_ascii_lowercase()
}

// ─── Managed state ────────────────────────────────────────────────────────────

type UrlMap = Arc<Mutex<HashMap<String, String>>>;

pub struct DiscoveryInner {
    daemon: Option<ServiceDaemon>,
    /// Shared with the background thread: fullname → URL.
    url_map: UrlMap,
}

pub struct DiscoveryState(pub Mutex<DiscoveryInner>);

impl DiscoveryState {
    pub fn new() -> Self {
        Self(Mutex::new(DiscoveryInner {
            daemon: None,
            url_map: Arc::new(Mutex::new(HashMap::new())),
        }))
    }
}

// ─── Commands ─────────────────────────────────────────────────────────────────

/// Start continuous mDNS discovery. Safe to call repeatedly — a running daemon
/// is left untouched. Emits:
/// - `plotter-found` (payload: URL string) when a plotter joins the network
/// - `plotter-lost`  (payload: URL string) when a plotter leaves the network
#[tauri::command]
pub fn start_plotter_discovery(
    app: AppHandle,
    state: tauri::State<DiscoveryState>,
) -> Result<(), String> {
    let mut inner = state.0.lock().unwrap();
    if inner.daemon.is_some() {
        return Ok(()); // already running
    }

    let daemon = ServiceDaemon::new().map_err(|e| e.to_string())?;
    let receiver = daemon.browse(SERVICE_TYPE).map_err(|e| e.to_string())?;

    // Give the thread its own Arc clone; the state keeps the other reference.
    let url_map: UrlMap = Arc::clone(&inner.url_map);
    inner.daemon = Some(daemon);
    drop(inner);

    std::thread::spawn(move || {
        loop {
            match receiver.recv() {
                Ok(ServiceEvent::ServiceResolved(info)) => {
                    let is_plotter = info
                        .get_properties()
                        .get(DEVICE_KEY)
                        .map(|v| v.val_str() == DEVICE_VALUE)
                        .unwrap_or(false);

                    if !is_plotter {
                        continue;
                    }

                    let host = info
                        .get_addresses_v4()
                        .into_iter()
                        .next()
                        .map(|a| a.to_string())
                        .unwrap_or_else(|| {
                            info.get_hostname().trim_end_matches('.').to_string()
                        });

                    let port = info.get_port();
                    let url = if port == 80 {
                        format!("http://{host}")
                    } else {
                        format!("http://{host}:{port}")
                    };

                    let fullname = normalize_fullname(info.get_fullname());

                    url_map.lock().unwrap().insert(fullname, url.clone());

                    let _ = app.emit("plotter-found", url);
                }

                Ok(ServiceEvent::ServiceRemoved(_, fullname)) => {
                    let fullname = normalize_fullname(&fullname);
                    if let Some(url) = url_map.lock().unwrap().remove(&fullname) {
                        let _ = app.emit("plotter-lost", url);
                    }
                }

                Ok(_) => {}
                Err(_) => break, // daemon was shut down
            }
        }
    });

    Ok(())
}

/// Stop the running discovery daemon and clear all tracked state.
#[tauri::command]
pub fn stop_plotter_discovery(state: tauri::State<DiscoveryState>) -> Result<(), String> {
    let mut inner = state.0.lock().unwrap();
    inner.url_map.lock().unwrap().clear();
    if let Some(daemon) = inner.daemon.take() {
        let _ = daemon.shutdown();
    }
    Ok(())
}

