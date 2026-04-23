use serde::{Deserialize, Serialize};

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
    pub color: String,
    pub width: f64,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum Element {
    Drawing { id: String, points: Vec<[f64; 2]> },
    Line   { id: String, x1: f64, y1: f64, x2: f64, y2: f64 },
    Rect   { id: String, x: f64, y: f64, w: f64, h: f64 },
    Circle { id: String, cx: f64, cy: f64, r: f64 },
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
