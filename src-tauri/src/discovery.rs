use mdns_sd::{ServiceDaemon, ServiceEvent};
use std::time::Duration;

/// The mDNS service type the pen plotter firmware advertises.
const SERVICE_TYPE: &str = "_http._tcp.local.";

/// The TXT record key/value used to identify pen plotter devices.
const DEVICE_KEY: &str = "device";
const DEVICE_VALUE: &str = "pnplttr";

/// Scan timeout – how long to listen for mDNS responses.
const SCAN_TIMEOUT_MS: u64 = 1000;

/// Tauri command – scans the local network for pen plotters via mDNS.
/// Returns a list of base URLs, e.g. `["http://192.168.1.42"]`.
#[tauri::command]
pub fn discover_plotters() -> Result<Vec<String>, String> {
    let daemon = ServiceDaemon::new().map_err(|e| e.to_string())?;
    let receiver = daemon.browse(SERVICE_TYPE).map_err(|e| e.to_string())?;

    let deadline = std::time::Instant::now() + Duration::from_millis(SCAN_TIMEOUT_MS);
    let mut urls: Vec<String> = Vec::new();

    loop {
        let remaining = deadline.saturating_duration_since(std::time::Instant::now());
        if remaining.is_zero() {
            break;
        }

        match receiver.recv_timeout(remaining) {
            Ok(ServiceEvent::ServiceResolved(info)) => {
                // Filter: only accept services that carry our device marker.
                let is_plotter = info
                    .get_properties()
                    .get(DEVICE_KEY)
                    .map(|v| v.val_str() == DEVICE_VALUE)
                    .unwrap_or(false);

                if !is_plotter {
                    continue;
                }

                // Prefer first IPv4 address; fall back to hostname.
                let host = info
                    .get_addresses_v4()
                    .into_iter()
                    .next()
                    .map(|a| a.to_string())
                    .unwrap_or_else(|| info.get_hostname().trim_end_matches('.').to_string());

                let port = info.get_port();
                let url = if port == 80 {
                    format!("http://{host}")
                } else {
                    format!("http://{host}:{port}")
                };

                if !urls.contains(&url) {
                    urls.push(url);
                }
            }
            Ok(_) => {}
            Err(_) => break,
        }
    }

    let _ = daemon.shutdown();
    Ok(urls)
}
