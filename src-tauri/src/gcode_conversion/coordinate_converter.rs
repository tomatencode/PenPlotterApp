use crate::pnplttr_file_structure::PnplttrDocument;

pub struct CoordinateConverter {
    x_offset: f64,
    y_offset: f64,
    workspace_height: f64,
}

impl CoordinateConverter {
    pub fn from_document(doc: &PnplttrDocument) -> Self {
        let x_offset = (doc.page.workspace_width - doc.page.page_width) / 2.0;
        let y_offset = (doc.page.workspace_height - doc.page.page_height) / 2.0;

        Self {
            x_offset,
            y_offset,
            workspace_height: doc.page.workspace_height,
        }
    }

    pub fn doc_xy_to_gcode_xy(&self, x: f64, y: f64) -> (f64, f64) {
        // Document space: origin top-left with +Y down.
        // GCode space: origin bottom-left with +Y up.
        let gcode_x = x + self.x_offset;
        let gcode_y = self.workspace_height - (y + self.y_offset);
        (gcode_x, gcode_y)
    }

    /// The plotter home (GCode 0,0) expressed in document space.
    /// This is the correct starting position for the stroke optimizer.
    pub fn gcode_xy_to_doc_xy(&self, x: f64, y: f64) -> (f64, f64) {
        let doc_x = x - self.x_offset;
        let doc_y = self.workspace_height - y - self.y_offset;
        (doc_x, doc_y)
    }
}
