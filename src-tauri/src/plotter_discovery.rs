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

// ─── Helpers ──────────────────────────────────────────────────────────────────

type BrowseReceiver = mdns_sd::Receiver<ServiceEvent>;

/// Spawn the background thread that forwards mDNS events to the frontend.
/// The thread exits cleanly when the receiver is closed (daemon shutdown or
/// `stop_browse`).
fn spawn_browse_thread(app: AppHandle, receiver: BrowseReceiver, url_map: UrlMap) {
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
                Err(_) => break, // receiver closed — exit thread
            }
        }
    });
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
    let url_map = Arc::clone(&inner.url_map);
    inner.daemon = Some(daemon);
    drop(inner);

    spawn_browse_thread(app, receiver, url_map);
    Ok(())
}

/// Remove a specific plotter from tracking and restart the mDNS browse so the
/// daemon's cache is flushed. When the plotter powers back on and announces
/// itself, a fresh `ServiceResolved` event fires and `plotter-found` is emitted.
#[tauri::command]
pub fn forget_plotter(
    app: AppHandle,
    state: tauri::State<DiscoveryState>,
    url: String,
) -> Result<(), String> {
    let inner = state.0.lock().unwrap();

    // Drop our record of this plotter.
    inner.url_map.lock().unwrap().retain(|_, v| *v != url);

    let daemon = match inner.daemon.as_ref() {
        Some(d) => d,
        None => return Ok(()), // discovery not running
    };

    // Stop the current browse — this closes the receiver and the background
    // thread exits on its next iteration.
    let _ = daemon.stop_browse(SERVICE_TYPE);

    // Start a new browse. The daemon is still alive so there's no gap in
    // discovery for other plotters; they will simply be re-resolved immediately.
    let receiver = daemon.browse(SERVICE_TYPE).map_err(|e| e.to_string())?;
    let url_map = Arc::clone(&inner.url_map);
    drop(inner);

    spawn_browse_thread(app, receiver, url_map);
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

