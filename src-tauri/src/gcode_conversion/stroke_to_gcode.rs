use super::coordinate_converter::CoordinateConverter;
use super::types::{PlotterMove, PlotterStroke};

pub fn stroke_to_gcode(stroke: &PlotterStroke, conv: &CoordinateConverter) -> String {
    match stroke {
        PlotterStroke::Open { start, end, moves, reversed } => {
            open_to_gcode(start, end, moves, *reversed, conv)
        }
        PlotterStroke::Loop { joints, moves, start_index } => {
            loop_to_gcode(joints, moves, *start_index, conv)
        }
    }
}

fn open_to_gcode(
    start: &(f64, f64),
    end: &(f64, f64),
    moves: &[PlotterMove],
    reversed: bool,
    conv: &CoordinateConverter,
) -> String {
    let mut gcode = String::new();

    let pen_down = if reversed {
        conv.doc_xy_to_gcode_xy(end.0, end.1)
    } else {
        conv.doc_xy_to_gcode_xy(start.0, start.1)
    };
    gcode.push_str(&format!("G0 X{:.3} Y{:.3}\n", pen_down.0, pen_down.1));
    gcode.push_str("M3\n"); // pen down

    let moves_iter: Box<dyn Iterator<Item = &PlotterMove>> = if reversed {
        Box::new(moves.iter().rev())
    } else {
        Box::new(moves.iter())
    };

    for m in moves_iter {
        gcode.push_str(&move_to_gcode(m, reversed, conv));
    }

    gcode.push_str("M5\n"); // pen up
    gcode
}

fn loop_to_gcode(
    joints: &[(f64, f64)],
    moves: &[PlotterMove],
    start_index: usize,
    conv: &CoordinateConverter,
) -> String {
    let mut gcode = String::new();

    let pen_down = conv.doc_xy_to_gcode_xy(joints[start_index].0, joints[start_index].1);
    gcode.push_str(&format!("G0 X{:.3} Y{:.3}\n", pen_down.0, pen_down.1));
    gcode.push_str("M3\n"); // pen down

    // Rotate moves so we start at start_index and walk all the way around.
    for m in moves.iter().cycle().skip(start_index).take(moves.len()) {
        // Loops are never reversed — rotation handles all optimisation.
        gcode.push_str(&move_to_gcode(m, false, conv));
    }

    gcode.push_str("M5\n"); // pen up
    gcode
}

fn move_to_gcode(m: &PlotterMove, reversed: bool, conv: &CoordinateConverter) -> String {
    match m {
        PlotterMove::Line { x1, y1, x2, y2 } => {
            // When reversed, travel toward (x1,y1); otherwise toward (x2,y2).
            let (tx, ty) = if reversed {
                conv.doc_xy_to_gcode_xy(*x1, *y1)
            } else {
                conv.doc_xy_to_gcode_xy(*x2, *y2)
            };
            format!("G1 X{:.3} Y{:.3}\n", tx, ty)
        }
        PlotterMove::Arc { x1, y1, cx, cy, x2, y2, clockwise } => {
            // Reversal swaps travel direction (flips winding); Y-flip also flips winding.
            // Two flips cancel out: reversed arcs use the same G2/G3 as the original.
            // Non-reversed arcs: Y-flip alone inverts, so CW doc → G3 gcode.
            let (from_x, from_y, to_x, to_y) = if reversed {
                (*x2, *y2, *x1, *y1)
            } else {
                (*x1, *y1, *x2, *y2)
            };
            let (gto_x, gto_y)     = conv.doc_xy_to_gcode_xy(to_x, to_y);
            let (gcx, gcy)         = conv.doc_xy_to_gcode_xy(*cx, *cy);
            let (gfrom_x, gfrom_y) = conv.doc_xy_to_gcode_xy(from_x, from_y);
            // Y-flip inverts winding; reversal inverts again — net: reversed = original winding.
            let effective_cw = if reversed { *clockwise } else { !clockwise };
            let command = if effective_cw { "G2" } else { "G3" };
            format!(
                "{} X{:.3} Y{:.3} I{:.3} J{:.3}\n",
                command, gto_x, gto_y, gcx - gfrom_x, gcy - gfrom_y,
            )
        }
        PlotterMove::QuadraticBezier { x1, y1, cx, cy, x2, y2 } => {
            // Reversed: travel from (x2,y2) toward (x1,y1); control point is unchanged.
            let (to_x, to_y) = if reversed { (*x1, *y1) } else { (*x2, *y2) };
            let (gto_x, gto_y) = conv.doc_xy_to_gcode_xy(to_x, to_y);
            let (gcx, gcy)     = conv.doc_xy_to_gcode_xy(*cx, *cy);
            format!("G5.1 X{:.3} Y{:.3} CX{:.3} CY{:.3}\n", gto_x, gto_y, gcx, gcy)
        }
        PlotterMove::CubicBezier { x1, y1, cx1, cy1, cx2, cy2, x2, y2 } => {
            // Reversed: travel from (x2,y2) toward (x1,y1); swap the two control points.
            let (to_x, to_y, gcx1, gcy1, gcx2, gcy2) = if reversed {
                let (gto_x, gto_y) = conv.doc_xy_to_gcode_xy(*x1, *y1);
                let (gc1x, gc1y)   = conv.doc_xy_to_gcode_xy(*cx2, *cy2);
                let (gc2x, gc2y)   = conv.doc_xy_to_gcode_xy(*cx1, *cy1);
                (gto_x, gto_y, gc1x, gc1y, gc2x, gc2y)
            } else {
                let (gto_x, gto_y) = conv.doc_xy_to_gcode_xy(*x2, *y2);
                let (gc1x, gc1y)   = conv.doc_xy_to_gcode_xy(*cx1, *cy1);
                let (gc2x, gc2y)   = conv.doc_xy_to_gcode_xy(*cx2, *cy2);
                (gto_x, gto_y, gc1x, gc1y, gc2x, gc2y)
            };
            format!(
                "G5 X{:.3} Y{:.3} CX1{:.3} CY1{:.3} CX2{:.3} CY2{:.3}\n",
                to_x, to_y, gcx1, gcy1, gcx2, gcy2,
            )
        }
    }
}

