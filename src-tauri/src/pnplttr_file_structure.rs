use serde::{Deserialize, Serialize};
use chrono;

#[derive(Serialize, Deserialize, Clone)]
pub struct PageSettings {
    pub width: f64,
    pub height: f64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct MetaSettings {
    pub author: String,
    pub created: String,
    pub doctype_version: u16,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum Element {
    Line {
        id: String,
        pen: String,
        z: i32,
        properties: LineProps,
    },
    Rect {
        id: String,
        pen: String,
        z: i32,
        properties: RectProps,
    },
    Circle {
        id: String,
        pen: String,
        z: i32,
        properties: CircleProps,
    },
}

#[derive(Serialize, Deserialize, Clone)]
pub struct LineProps {
    pub x1: f64,
    pub y1: f64,
    pub x2: f64,
    pub y2: f64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RectProps {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct CircleProps {
    pub cx: f64,
    pub cy: f64,
    pub r: f64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct PnplttrDocument {
    pub meta: MetaSettings,
    pub page: PageSettings,
    pub elements: Vec<Element>,
}

impl PnplttrDocument {
    pub fn new_default(author: String, width: f64, height: f64) -> Self {
        PnplttrDocument {
            meta: MetaSettings {
                author: author,
                created: chrono::Utc::now().to_rfc3339(),
                doctype_version: 1,
            },
            page: PageSettings {
                width: width,
                height: height,
            },
            elements: vec![],
        }
    }
}