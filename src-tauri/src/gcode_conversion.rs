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