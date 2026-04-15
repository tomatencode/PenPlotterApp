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

#[derive(Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum Element {
    Line {
        x1: f64,
        y1: f64,
        x2: f64,
        y2: f64,
    },
    Rect {
        x: f64,
        y: f64,
        w: f64,
        h: f64,
    },
    Circle {
        cx: f64,
        cy: f64,
        r: f64,
    },
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