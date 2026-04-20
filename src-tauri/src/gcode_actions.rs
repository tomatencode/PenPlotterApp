use std::fs;

/// Placeholder GCode converter — returns a small example program for UI testing.
/// Replace the body with real document-to-GCode logic when ready.
#[tauri::command]
pub fn convert_document_to_gcode(_json: String) -> Result<String, String> {
    let example = "\
; PenPlotter GCode — example output
G21           ; millimetre mode
G90           ; absolute positioning
G28           ; home all axes
M5            ; pen up
G0 X0 Y0
; --- Rectangle 50x30 mm ---
G0 X10 Y10
M3            ; pen down
G1 X60 Y10 F50
G1 X60 Y40
G1 X10 Y40
G1 X10 Y10
M5            ; pen up
; --- Diagonal cross ---
G0 X10 Y10
M3            ; pen down
G1 X60 Y40 F50
M5            ; pen up
G0 X60 Y10
M3            ; pen down
G1 X10 Y40 F50
M5            ; pen up
; --- Circle approximation (octagon) ---
G0 X35 Y10
M3            ; pen down
G1 X46 Y14 F50
G1 X50 Y25
G1 X46 Y36
G1 X35 Y40
G1 X24 Y36
G1 X20 Y25
G1 X24 Y14
G1 X35 Y10
M5            ; pen up
G0 X0 Y0      ; return home
M5            ; spindle off
";
    Ok(example.to_string())
}

/// Write GCode content to an arbitrary path chosen by the user via the save dialog.
#[tauri::command]
pub fn save_gcode_file(path: String, content: String) -> Result<(), String> {
    // Validate that the path has a .gcode extension to prevent writing arbitrary files.
    let p = std::path::Path::new(&path);
    match p.extension().and_then(|e| e.to_str()) {
        Some(ext) if ext.eq_ignore_ascii_case("gcode") => {}
        _ => return Err("Only .gcode files may be saved with this command.".to_string()),
    }

    fs::write(&path, content.as_bytes()).map_err(|e| e.to_string())
}
