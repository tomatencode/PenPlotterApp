use crate::pnplttr_file_structure::Element;
use super::types::{PlotterMove, PlotterStroke};

pub fn elements_to_strokes(elements: &[Element]) -> Vec<PlotterStroke> {
    let mut strokes = Vec::new();
    for element in elements {
        match element {
            Element::Line { x1, y1, x2, y2, .. } => {
                strokes.push(PlotterStroke::Open {
                    start: (*x1, *y1),
                    end:   (*x2, *y2),
                    moves: vec![PlotterMove::Line { x1: *x1, y1: *y1, x2: *x2, y2: *y2 }],
                    reversed: false,
                });
            }
            Element::Rect { x, y, w, h, .. } => {
                let (x1, y1) = (*x,       *y      );
                let (x2, y2) = (*x + w,   *y + h  );
                // Each corner is a valid start joint — store all 4.
                strokes.push(PlotterStroke::Loop {
                    joints: vec![
                        (x1, y1),
                        (x2, y1),
                        (x2, y2),
                        (x1, y2),
                    ],
                    moves: vec![
                        PlotterMove::Line { x1,       y1,       x2,       y2: y1 },
                        PlotterMove::Line { x1: x2,   y1,       x2,       y2     },
                        PlotterMove::Line { x1: x2,   y1: y2,   x2: x1,   y2     },
                        PlotterMove::Line { x1,       y1: y2,   x2: x1,   y2: y1 },
                    ],
                    start_index: 0,
                });
            }
            Element::Circle { cx, cy, r, .. } => {
                // Two semicircles: right → left → right.
                // Split at rightmost and leftmost points to give the optimizer 2 joint choices.
                let right = (*cx + r, *cy);
                let left  = (*cx - r, *cy);
                strokes.push(PlotterStroke::Loop {
                    joints: vec![right, left],
                    moves: vec![
                        PlotterMove::Arc { x1: right.0, y1: right.1, cx: *cx, cy: *cy, x2: left.0,  y2: left.1,  clockwise: true },
                        PlotterMove::Arc { x1: left.0,  y1: left.1,  cx: *cx, cy: *cy, x2: right.0, y2: right.1, clockwise: true },
                    ],
                    start_index: 0,
                });
            }
        }
    }
    strokes
}
