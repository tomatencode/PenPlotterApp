#[allow(dead_code)]
pub enum PlotterMove {
    Line            { x1: f64, y1: f64, x2: f64, y2: f64 },
    Arc             { x1: f64, y1: f64, cx: f64, cy: f64, x2: f64, y2: f64, clockwise: bool },
    QuadraticBezier { x1: f64, y1: f64, cx: f64, cy: f64, x2: f64, y2: f64 },
    CubicBezier     { x1: f64, y1: f64, cx1: f64, cy1: f64, cx2: f64, cy2: f64, x2: f64, y2: f64 },
}

pub struct PlotterStroke {
    pub start:    (f64, f64),       // precomputed — used only by the optimizer
    pub end:      (f64, f64),       // precomputed — used only by the optimizer
    pub moves:    Vec<PlotterMove>, // forward direction
    pub reversed: bool,
}
