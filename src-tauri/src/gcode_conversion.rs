use std::default;

use crate::pnplttr_file_structure::PnplttrDocument;

struct CoordinateConverter {
    x_offset: f64,
    y_offset: f64,
    workspace_height: f64,
}

impl CoordinateConverter {
    fn from_document(doc: &PnplttrDocument) -> Self {
        let x_offset = (doc.page.workspace_width - doc.page.page_width) / 2.0;
        let y_offset = (doc.page.workspace_height - doc.page.page_height) / 2.0;

        Self {
            x_offset,
            y_offset,
            workspace_height: doc.page.workspace_height,
        }
    }

    fn doc_xy_to_gcode_xy(&self, x: f64, y: f64) -> (f64, f64) {
        // Document space: origin top-left with +Y down.
        // GCode space: origin bottom-left with +Y up.
        let gcode_x = x + self.x_offset;
        let gcode_y = self.workspace_height - (y + self.y_offset);
        (gcode_x, gcode_y)
    }
}

pub enum PlotterMove {
    Line   { x1: f64, y1: f64, x2: f64, y2: f64 },
    Arc    { x1: f64, y1: f64, cx: f64, cy: f64, x2: f64, y2: f64, clockwise: bool },
    QuadraticBezier { x1: f64, y1: f64, cx: f64, cy: f64, x2: f64, y2: f64 },
    CubicBezier { x1: f64, y1: f64, cx1: f64, cy1: f64, cx2: f64, cy2: f64, x2: f64, y2: f64 },
}

pub struct PlotterStroke {
    pub start: (f64, f64),   // precomputed — used only by the optimizer
    pub end:   (f64, f64),   // precomputed — used only by the optimizer
    pub moves: Vec<PlotterMove>, // forward direction
    pub reversed: bool,
}

pub fn stroke_to_gcode(stroke: &PlotterStroke) -> String {
    let mut gcode = String::new();
    gcode.push_str(&format!("G0 X{} Y{}\n", stroke.start.0, stroke.start.1)); // rapid move to start
    gcode.push_str("M3\n"); // pen down
    for move in &stroke.moves {
        match move {
            PlotterMove::Line { x1, y1, x2, y2 } => {
                gcode.push_str(&format!("G1 X{} Y{}\n", x2, y2));
            }
            PlotterMove::Arc { x1, y1, cx, cy, x2, y2, clockwise } => {
                let command = if *clockwise { "G2" } else { "G3" };
                gcode.push_str(&format!("{} X{} Y{} I{} J{}\n", command, x2, y2, cx - x1, cy - y1));
            }
            PlotterMove::QuadraticBezier { x1, y1, cx, cy, x2, y2 } => {
                gcode.push_str(&format!("G5.1 X{} Y{} CX{} CY{}\n", x2, y2, cx, cy));
            }
            PlotterMove::CubicBezier { x1, y1, cx1, cy1, cx2, cy2, x2, y2 } => {
                gcode.push_str(&format!("G5 X{} Y{} CX1{} CY1{} CX2{} CY2{}\n", x2, y2, cx1, cy1, cx2, cy2));
            }
        }
    }
    gcode.push_str("M5\n"); // pen up
    gcode
}

pub fn elements_to_strokes(elements: &[Element]) -> Vec<PlotterStroke> {
    let mut strokes = Vec::new();
    for element in elements {
        match element {
            Element::Line { x1, y1, x2, y2, .. } => {
                strokes.push(PlotterStroke {
                    start: (*x1, *y1),
                    end: (*x2, *y2),
                    moves: vec![PlotterMove::Line { x1: *x1, y1: *y1, x2: *x2, y2: *y2 }],
                    reversed: false,
                });
            }
            Element::Rect { x, y, w, h, .. } => {
                let x1 = *x;
                let y1 = *y;
                let x2 = x + w;
                let y2 = y + h;
                strokes.push(PlotterStroke {
                    start: (x1, y1),
                    end: (x1, y1),
                    moves: vec![
                        PlotterMove::Line { x1, y1, x2, y2: y1 },
                        PlotterMove::Line { x1: x2, y1: y1, x2: x2, y2 },
                        PlotterMove::Line { x1: x2, y1: y2, x2: x1, y2 },
                        PlotterMove::Line { x1: x1, y1: y2, x2: x1, y2: y1 },
                    ],
                    reversed: false,
                });
            }
            Element::Circle { cx, cy, r, .. } => {
                let start_x = cx + r;
                let start_y = *cy;
                strokes.push(PlotterStroke {
                    start: (start_x, start_y),
                    end: (start_x, start_y),
                    moves: vec![
                        PlotterMove::Arc { 
                            x1: start_x,
                            y1: start_y,
                            cx: *cx,
                            cy: *cy,
                            x2: start_x,
                            y2: start_y,
                            clockwise: true,
                        }
                    ],
                    reversed: false,
                });
            }
        }
    }
    strokes
}

pub fn optimoze_strokes(strokes: Vec<PlotterStroke>) -> Vec<PlotterStroke> {
    strokes // TODO: implement this function to reorder/reverse strokes for minimal pen-up travel
}

#[tauri::command]
pub fn convert_document_to_gcode(_json: String) -> Result<String, String> {
    let doc: PnplttrDocument =
        serde_json::from_str(&_json).map_err(|e| format!("Invalid document: {}", e))?;

    let converter = CoordinateConverter::from_document(&doc);
    
    let mut gcode = String::new();

    for layer in &doc.layers {
        gcode.push_str(&format!("\n; Layer: {}\n", layer.name));

        // TODO: add pen switching GCode commands here, using layer.pen.color and layer.pen.width
        
        let strokes = elements_to_strokes(&layer.elements);
        let strokes = optimoze_strokes(strokes);

        for stroke in strokes {
            let gcode_stroke = stroke_to_gcode(&stroke);
            gcode.push_str(&gcode_stroke);
        }
    }

    gcode.push_str("G0 X0 Y0\n"); // return to origin at end

    Ok(gcode)
}