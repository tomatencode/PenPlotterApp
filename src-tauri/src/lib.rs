mod document;
pub mod pnplttr_file_structure;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            document::get_recent_files,
            document::remove_recent_file,
            document::get_documents_dir,
            document::create_document,
            document::open_document,
            document::save_document,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
