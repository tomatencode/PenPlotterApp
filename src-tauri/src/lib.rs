mod file_actions;
mod handwriting;
mod plotter_discovery;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .manage(plotter_discovery::DiscoveryState::new())
        .manage(handwriting::HandwritingState::new())
        .invoke_handler(tauri::generate_handler![
            file_actions::get_recent_files,
            file_actions::push_recent_file,
            file_actions::remove_recent_file,
            file_actions::get_documents_dir,
            file_actions::get_gcode_dir,
            file_actions::save_file,
            file_actions::open_file,
            plotter_discovery::start_plotter_discovery,
            plotter_discovery::stop_plotter_discovery,
            handwriting::generate_handwriting,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
