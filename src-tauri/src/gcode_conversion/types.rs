#[allow(dead_code)]
pub enum PlotterMove {
    Line            { x1: f64, y1: f64, x2: f64, y2: f64 },
    Arc             { x1: f64, y1: f64, cx: f64, cy: f64, x2: f64, y2: f64, clockwise: bool },
    QuadraticBezier { x1: f64, y1: f64, cx: f64, cy: f64, x2: f64, y2: f64 },
    CubicBezier     { x1: f64, y1: f64, cx1: f64, cy1: f64, cx2: f64, cy2: f64, x2: f64, y2: f64 },
}

pub enum PlotterStroke {
    /// An open stroke: fixed start and end. Can be traversed in either direction.
    Open {
        start:    (f64, f64),
        end:      (f64, f64),
        moves:    Vec<PlotterMove>, // always stored in forward (start→end) direction
        reversed: bool,             // set by optimizer
    },
    /// A closed loop: any joint is a valid start point.
    /// joints[i] is the pen position at the start of moves[i].
    /// The loop closes back to joints[0] after the last move.
    Loop {
        joints:      Vec<(f64, f64)>,
        moves:       Vec<PlotterMove>,
        start_index: usize, // set by optimizer; default 0
    },
}
