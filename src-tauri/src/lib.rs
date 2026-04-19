mod file_actions;
mod plotter_discovery;
pub mod pnplttr_file_structure;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .manage(plotter_discovery::DiscoveryState::new())
        .invoke_handler(tauri::generate_handler![
            file_actions::get_recent_files,
            file_actions::remove_recent_file,
            file_actions::get_documents_dir,
            file_actions::create_document,
            file_actions::open_document,
            file_actions::save_document,
            plotter_discovery::start_plotter_discovery,
            plotter_discovery::stop_plotter_discovery,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
