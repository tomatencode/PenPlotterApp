use crate::pnplttr_file_structure::Element;
use super::types::{PlotterMove, PlotterStroke};

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
                        PlotterMove::Line { x1,       y1,       x2,       y2: y1 },
                        PlotterMove::Line { x1: x2,   y1,       x2,       y2     },
                        PlotterMove::Line { x1: x2,   y1: y2,   x2: x1,   y2     },
                        PlotterMove::Line { x1,       y1: y2,   x2: x1,   y2: y1 },
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
                            x1: start_x, y1: start_y,
                            cx: *cx,     cy: *cy,
                            x2: start_x, y2: start_y,
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
