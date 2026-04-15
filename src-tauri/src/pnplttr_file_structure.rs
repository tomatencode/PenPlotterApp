use serde::{Deserialize, Serialize};
use chrono;

#[derive(Serialize, Deserialize, Clone)]
pub struct PageSettings {
    pub page_width: f64,
    pub page_height: f64,
    pub workspace_width: f64,
    pub workspace_height: f64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct MetaSettings {
    pub created: String,
    pub doctype_version: u16,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Pen {
    pub name: String,
    pub color: String,
    pub width: f64,
}

/// A single plotter command — one continuous pen-down move.
/// All coordinates are in millimetres, absolute document space.
///
/// CANONICAL IMPLEMENTATION — if you change this, update the TypeScript
/// mirror in src/utils/strokes.ts to match.
#[derive(Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum PlotterMove {
    Line        { x2: f64, y2: f64 },
    QuadBezier  { cx: f64, cy: f64, x2: f64, y2: f64 },
    CubicBezier { cx1: f64, cy1: f64, cx2: f64, cy2: f64, x2: f64, y2: f64 },
}

/// A sequence of plotter moves preceded by a single pen-down at `start`.
/// One Stroke = one contiguous drawn line. Multiple strokes = pen lifts between them.
#[derive(Serialize, Deserialize, Clone)]
pub struct Stroke {
    pub start: (f64, f64),
    pub moves: Vec<PlotterMove>,
}

/// A drawing element stored in the document.
/// Each element carries a unique `id` (assigned by the frontend, not used by Rust logic).
///
/// CANONICAL IMPLEMENTATION — if you change this, update the TypeScript
/// mirror in src/utils/strokes.ts to match.
#[derive(Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum Element {
    Line   { id: String, x1: f64, y1: f64, x2: f64, y2: f64 },
    Rect   { id: String, x: f64, y: f64, w: f64, h: f64 },
    Circle { id: String, cx: f64, cy: f64, r: f64 },
}

impl Element {
    /// Converts this element into plotter strokes.
    /// CANONICAL IMPLEMENTATION — mirror in src/utils/strokes.ts must match.
    pub fn to_strokes(&self) -> Vec<Stroke> {
        match self {
            // A Line: pen down at (x1,y1), one line move to (x2,y2).
            Element::Line { x1, y1, x2, y2, .. } => vec![Stroke {
                start: (*x1, *y1),
                moves: vec![PlotterMove::Line { x2: *x2, y2: *y2 }],
            }],

            // A Rect: start top-left, go clockwise, close back to start.
            Element::Rect { x, y, w, h, .. } => vec![Stroke {
                start: (*x, *y),
                moves: vec![
                    PlotterMove::Line { x2: x + w, y2: *y       },
                    PlotterMove::Line { x2: x + w, y2: y + h    },
                    PlotterMove::Line { x2: *x,    y2: y + h    },
                    PlotterMove::Line { x2: *x,    y2: *y       },
                ],
            }],

            // A Circle: 4 cubic bezier arcs, clockwise from top (cx, cy-r).
            // Approximation constant k = 0.5522847 gives a good circle.
            Element::Circle { cx, cy, r, .. } => {
                let k = 0.5522847 * r;
                vec![Stroke {
                    start: (*cx, cy - r),
                    moves: vec![
                        PlotterMove::CubicBezier { cx1: cx + k, cy1: cy - r, cx2: cx + r, cy2: cy - k, x2: cx + r, y2: *cy     },
                        PlotterMove::CubicBezier { cx1: cx + r, cy1: cy + k, cx2: cx + k, cy2: cy + r, x2: *cx,    y2: cy + r  },
                        PlotterMove::CubicBezier { cx1: cx - k, cy1: cy + r, cx2: cx - r, cy2: cy + k, x2: cx - r, y2: *cy     },
                        PlotterMove::CubicBezier { cx1: cx - r, cy1: cy - k, cx2: cx - k, cy2: cy - r, x2: *cx,    y2: cy - r  },
                    ],
                }]
            }
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Layer {
    pub name: String,
    pub pen: Pen,
    pub elements: Vec<Element>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct PnplttrDocument {
    pub meta: MetaSettings,
    pub page: PageSettings,
    pub layers: Vec<Layer>,
}

impl PnplttrDocument {
    pub fn new_default(workspace_width: f64, workspace_height: f64) -> Self {
        PnplttrDocument {
            meta: MetaSettings {
                created: chrono::Utc::now().to_rfc3339(),
                doctype_version: 1,
            },
            page: PageSettings {
                page_width: 210.0, // A4 default
                page_height: 297.0, // A4 default
                workspace_width,
                workspace_height,
            },
            layers: vec![],
        }
    }
}