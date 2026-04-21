use crate::pnplttr_file_structure::{Element, PnplttrDocument};

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

#[allow(dead_code)]
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

fn elements_to_strokes(elements: &[Element]) -> Vec<PlotterStroke> {
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

fn optimoze_strokes(strokes: Vec<PlotterStroke>) -> Vec<PlotterStroke> {
    strokes // TODO: implement this function to reorder/reverse strokes for minimal pen-up travel
}

fn stroke_to_gcode(stroke: &PlotterStroke, conv: &CoordinateConverter) -> String {
    let mut gcode = String::new();

    let pen_down = if stroke.reversed {
        conv.doc_xy_to_gcode_xy(stroke.end.0, stroke.end.1)
    } else {
        conv.doc_xy_to_gcode_xy(stroke.start.0, stroke.start.1)
    };
    gcode.push_str(&format!("G0 X{:.3} Y{:.3}\n", pen_down.0, pen_down.1));
    gcode.push_str("M3\n"); // pen down

    let moves_iter: Box<dyn Iterator<Item = &PlotterMove>> = if stroke.reversed {
        Box::new(stroke.moves.iter().rev())
    } else {
        Box::new(stroke.moves.iter())
    };

    for m in moves_iter {
        match m {
            PlotterMove::Line { x1, y1, x2, y2 } => {
                // When reversed, travel toward (x1,y1); otherwise toward (x2,y2).
                let (tx, ty) = if stroke.reversed {
                    conv.doc_xy_to_gcode_xy(*x1, *y1)
                } else {
                    conv.doc_xy_to_gcode_xy(*x2, *y2)
                };
                gcode.push_str(&format!("G1 X{:.3} Y{:.3}\n", tx, ty));
            }
            PlotterMove::Arc { x1, y1, cx, cy, x2, y2, clockwise } => {
                // Reversal swaps travel direction (flips winding); Y-flip also flips winding.
                // Two flips cancel out: reversed arcs use the same G2/G3 as the original.
                // Non-reversed arcs: Y-flip alone inverts, so CW doc → G3 gcode.
                let (from_x, from_y, to_x, to_y) = if stroke.reversed {
                    (*x2, *y2, *x1, *y1)
                } else {
                    (*x1, *y1, *x2, *y2)
                };
                let (gto_x, gto_y) = conv.doc_xy_to_gcode_xy(to_x, to_y);
                let (gcx, gcy) = conv.doc_xy_to_gcode_xy(*cx, *cy);
                let (gfrom_x, gfrom_y) = conv.doc_xy_to_gcode_xy(from_x, from_y);
                // Y-flip inverts winding; reversal inverts again — net: reversed = original winding.
                let effective_cw = if stroke.reversed { *clockwise } else { !clockwise };
                let command = if effective_cw { "G2" } else { "G3" };
                gcode.push_str(&format!("{} X{:.3} Y{:.3} I{:.3} J{:.3}\n",
                    command, gto_x, gto_y, gcx - gfrom_x, gcy - gfrom_y));
            }
            PlotterMove::QuadraticBezier { x1, y1, cx, cy, x2, y2 } => {
                // Reversed: travel from (x2,y2) toward (x1,y1); control point is unchanged.
                let (to_x, to_y) = if stroke.reversed { (*x1, *y1) } else { (*x2, *y2) };
                let (gto_x, gto_y) = conv.doc_xy_to_gcode_xy(to_x, to_y);
                let (gcx, gcy) = conv.doc_xy_to_gcode_xy(*cx, *cy);
                gcode.push_str(&format!("G5.1 X{:.3} Y{:.3} CX{:.3} CY{:.3}\n", gto_x, gto_y, gcx, gcy));
            }
            PlotterMove::CubicBezier { x1, y1, cx1, cy1, cx2, cy2, x2, y2 } => {
                // Reversed: travel from (x2,y2) toward (x1,y1); swap the two control points.
                let (to_x, to_y, gcx1, gcy1, gcx2, gcy2) = if stroke.reversed {
                    let (gto_x, gto_y) = conv.doc_xy_to_gcode_xy(*x1, *y1);
                    let (gc1x, gc1y) = conv.doc_xy_to_gcode_xy(*cx2, *cy2);
                    let (gc2x, gc2y) = conv.doc_xy_to_gcode_xy(*cx1, *cy1);
                    (gto_x, gto_y, gc1x, gc1y, gc2x, gc2y)
                } else {
                    let (gto_x, gto_y) = conv.doc_xy_to_gcode_xy(*x2, *y2);
                    let (gc1x, gc1y) = conv.doc_xy_to_gcode_xy(*cx1, *cy1);
                    let (gc2x, gc2y) = conv.doc_xy_to_gcode_xy(*cx2, *cy2);
                    (gto_x, gto_y, gc1x, gc1y, gc2x, gc2y)
                };
                gcode.push_str(&format!("G5 X{:.3} Y{:.3} CX1{:.3} CY1{:.3} CX2{:.3} CY2{:.3}\n",
                    to_x, to_y, gcx1, gcy1, gcx2, gcy2));
            }
        }
    }
    gcode.push_str("M5\n"); // pen up
    gcode
}

#[tauri::command]
pub fn convert_document_to_gcode(_json: String) -> Result<String, String> {
    let doc: PnplttrDocument =
        serde_json::from_str(&_json).map_err(|e| format!("Invalid document: {}", e))?;

    let converter = CoordinateConverter::from_document(&doc);
    
    let mut gcode = String::new();

    for layer in &doc.layers {
        gcode.push_str(&format!("; Layer: {}\n", layer.name));

        // TODO: add pen switching GCode commands here, using layer.pen.color and layer.pen.width
        
        let strokes = elements_to_strokes(&layer.elements);
        let strokes = optimoze_strokes(strokes);

        gcode.push_str("M5\n"); // ensure pen up before moving to first stroke
        for stroke in strokes {
            let gcode_stroke = stroke_to_gcode(&stroke, &converter);
            gcode.push_str(&gcode_stroke);
        }
        
        gcode.push_str("\n");
    }

    gcode.push_str("G0 X0 Y0"); // return to origin at end

    Ok(gcode)
}