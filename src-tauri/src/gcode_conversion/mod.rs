mod compress_gcode;
mod coordinate_converter;
mod elements_to_strokes;
mod optimize_strokes;
mod stroke_to_gcode;
pub mod types;

use crate::pnplttr_file_structure::PnplttrDocument;
use coordinate_converter::CoordinateConverter;
use elements_to_strokes::elements_to_strokes;
use optimize_strokes::optimize_strokes;
use stroke_to_gcode::stroke_to_gcode;
use compress_gcode::compress_gcode;

#[tauri::command]
pub fn convert_document_to_gcode(json: String) -> Result<String, String> {
    let doc: PnplttrDocument =
        serde_json::from_str(&json).map_err(|e| format!("Invalid document: {}", e))?;

    let converter = CoordinateConverter::from_document(&doc);

    let mut gcode = String::new();
    gcode.push_str("G28 ; Home all axes\n\n");

    for layer in &doc.layers {
        gcode.push_str(&format!("; Layer: {}\n", layer.name));

        // TODO: add pen switching GCode commands here, using layer.pen.color and layer.pen.width

        let strokes = elements_to_strokes(&layer.elements);
        let home = converter.gcode_xy_to_doc_xy(0.0, 0.0);
        let strokes = optimize_strokes(strokes, home);

        gcode.push_str("M5\n"); // ensure pen up before moving to first stroke
        for stroke in strokes {
            gcode.push_str(&stroke_to_gcode(&stroke, &converter));
        }

        gcode.push_str("\n");
    }

    gcode.push_str("G0 X0 Y0"); // return to origin at end

    gcode = compress_gcode(&gcode);

    Ok(gcode)
}
