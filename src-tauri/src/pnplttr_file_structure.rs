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
pub struct Element {
    pub id: String,
    pub pen: String,
    pub z: i32,
    #[serde(rename = "type")]
    pub element_type: String,
    pub properties: serde_json::Value,
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