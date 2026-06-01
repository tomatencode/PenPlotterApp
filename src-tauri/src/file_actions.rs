use std::fs;
use tauri::{AppHandle, Manager};

// Paths

pub fn plotters_dir(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let docs = app.path().document_dir().map_err(|e| e.to_string())?;
    let dir = docs.join("PenPlotterDocs");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn recent_files_path(app: &AppHandle) -> std::path::PathBuf {
    let data_dir = app
        .path()
        .app_data_dir()
        .expect("failed to get app data dir");
    let _ = fs::create_dir_all(&data_dir);
    data_dir.join("recent_files.json")
}

// Recent files

pub fn load_recent_files(app: &AppHandle) -> Vec<String> {
    let path = recent_files_path(app);
    if let Ok(data) = fs::read_to_string(&path) {
        let files: Vec<String> = serde_json::from_str(&data).unwrap_or_default();
        // Filter out files that no longer exist on disk
        files
            .into_iter()
            .filter(|p| std::path::Path::new(p).exists())
            .collect()
    } else {
        vec![]
    }
}

fn save_recent_files(app: &AppHandle, recents: &[String]) {
    let path = recent_files_path(app);
    let _ = fs::write(&path, serde_json::to_string(recents).unwrap_or_default());
}

pub fn push_recent(app: &AppHandle, file_path: &str) {
    let mut recents = load_recent_files(app);
    recents.retain(|p| p != file_path);
    recents.insert(0, file_path.to_string());
    recents.truncate(10);
    save_recent_files(app, &recents);
}

pub fn remove_recent(app: &AppHandle, file_path: &str) {
    let mut recents = load_recent_files(app);
    recents.retain(|p| p != file_path);
    save_recent_files(app, &recents);
}

// Tauri commands

#[tauri::command]
pub fn get_recent_files(app: AppHandle) -> Vec<String> {
    load_recent_files(&app)
}

#[tauri::command]
pub fn push_recent_file(app: AppHandle, file_path: String) {
    push_recent(&app, &file_path);
}

#[tauri::command]
pub fn remove_recent_file(app: AppHandle, file_path: String) {
    remove_recent(&app, &file_path);
}

#[tauri::command]
pub fn get_documents_dir(app: AppHandle) -> Result<String, String> {
    plotters_dir(&app).map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_gcode_dir(app: AppHandle) -> Result<String, String> {
    let docs = app.path().document_dir().map_err(|e| e.to_string())?;
    let dir = docs.join("PenPlotterGcode");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn open_file(path: String) -> Result<String, String> {
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    Ok(content)
}


#[tauri::command]
pub fn save_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content.as_bytes()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_file(file_path: String) -> Result<(), String> {
    fs::remove_file(&file_path).map_err(|e| e.to_string())
}
