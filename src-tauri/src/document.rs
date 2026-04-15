use serde::Serialize;
use std::fs;
use tauri::{AppHandle, Manager};
use crate::pnplttr_file_structure::PnplttrDocument;

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

// Return type

#[derive(Serialize)]
pub struct OpenedDocument {
    pub path: String,
    pub json: String,
}

// Tauri commands

#[tauri::command]
pub fn get_recent_files(app: AppHandle) -> Vec<String> {
    load_recent_files(&app)
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
pub fn create_document(app: AppHandle, name: String) -> Result<OpenedDocument, String> {
    let dir = plotters_dir(&app)?;

    // Sanitise name — strip path separators and reserved chars
    let safe: String = name
        .trim()
        .chars()
        .map(|c| {
            if matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|') {
                '_'
            } else {
                c
            }
        })
        .collect();
    let safe = if safe.is_empty() {
        "Untitled".to_string()
    } else {
        safe
    };

    // Find a unique filename
    let mut file_path = dir.join(format!("{}.pnplttr", safe));
    let mut counter = 1u32;
    while file_path.exists() {
        file_path = dir.join(format!("{} ({}).pnplttr", safe, counter));
        counter += 1;
    }

    let doc = PnplttrDocument::new_default(185.0, 265.0); // workspace size in mm of my current plotter
    let json = serde_json::to_string_pretty(&doc).map_err(|e| e.to_string())?;
    fs::write(&file_path, &json).map_err(|e| e.to_string())?;

    let path = file_path.to_string_lossy().to_string();
    push_recent(&app, &path);

    Ok(OpenedDocument { path, json })
}

#[tauri::command]
pub fn open_document(app: AppHandle, path: String) -> Result<OpenedDocument, String> {
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let _: PnplttrDocument = serde_json::from_str(&content)
        .map_err(|e| format!("Invalid .pnplttr file: {}", e))?;
    push_recent(&app, &path);
    Ok(OpenedDocument { path, json: content })
}

#[tauri::command]
pub fn save_document(app: AppHandle, path: String, content: String) -> Result<(), String> {
    let _: PnplttrDocument = serde_json::from_str(&content)
        .map_err(|e| format!("Invalid document: {}", e))?;
    fs::write(&path, &content).map_err(|e| e.to_string())?;
    push_recent(&app, &path);
    Ok(())
}
