use super::types::PlotterStroke;

pub fn optimize_strokes(strokes: Vec<PlotterStroke>, home: (f64, f64)) -> Vec<PlotterStroke> {
    if strokes.is_empty() {
        return strokes;
    }

    // Phase 1: greedy nearest-neighbour — builds a solid starting order in O(n²)
    let mut ordered = greedy_order(strokes, home);

    // Phase 2: 2-opt — repeatedly reverse segments to cut total pen-up travel
    two_opt(&mut ordered, home);

    // Phase 3: commit the chosen entry point (reversed / start_index) for each stroke
    apply_all_entries(&mut ordered, home);

    ordered
}

// ── Phase 1: greedy nearest-neighbour ────────────────────────────────────────

fn greedy_order(mut strokes: Vec<PlotterStroke>, home: (f64, f64)) -> Vec<PlotterStroke> {
    let mut ordered = Vec::with_capacity(strokes.len());
    let mut pen = home;

    while !strokes.is_empty() {
        // Pick the stroke whose nearest entry is closest to the current pen position.
        let best_idx = strokes
            .iter()
            .enumerate()
            .min_by(|(_, a), (_, b)| {
                pen_up_dist(pen, a).partial_cmp(&pen_up_dist(pen, b)).unwrap()
            })
            .map(|(i, _)| i)
            .unwrap();

        let stroke = strokes.swap_remove(best_idx);
        pen = best_exit(pen, &stroke);
        ordered.push(stroke);
    }

    ordered
}

// ── Phase 2: 2-opt ────────────────────────────────────────────────────────────

/// Repeatedly scans all pairs (i, j) and reverses strokes[i+1..=j] whenever
/// doing so reduces total pen-up travel. Stops when a full scan finds nothing.
fn two_opt(strokes: &mut Vec<PlotterStroke>, home: (f64, f64)) {
    let n = strokes.len();
    if n < 3 {
        return;
    }

    let mut improved = true;
    while improved {
        improved = false;

        // Precompute the pen position after each stroke so we can evaluate
        // swap candidates without replaying the whole tour each time.
        let exits = compute_exits(strokes, home);

        // 'outer lets us break out of both loops at once when we find a swap.
        'outer: for i in 0..n - 1 {
            for j in i + 1..n {
                // The pen sits at exits[i] just before it needs to enter strokes[i+1].
                let pen_before_segment = exits[i];

                if reversing_segment_saves_travel(strokes, i + 1, j, pen_before_segment) {
                    strokes[i + 1..=j].reverse();
                    improved = true;
                    break 'outer; // exits cache is now stale — restart the scan
                }
            }
        }
    }
}

/// Returns true if visiting strokes[from..=to] in reverse order costs less
/// pen-up travel than forward order (including the first hop to the next
/// stroke after the segment, since the exit position may differ).
fn reversing_segment_saves_travel(
    strokes: &[PlotterStroke],
    from: usize,
    to: usize,
    pen: (f64, f64),
) -> bool {
    let segment = &strokes[from..=to];

    let (fwd_cost, fwd_exit) = traversal_cost(segment.iter(), pen);
    let (rev_cost, rev_exit) = traversal_cost(segment.iter().rev(), pen);

    // The stroke right after the segment is also affected: a different exit
    // position means a different pen-up hop to reach it.
    let n = strokes.len();
    let hop_after_fwd = if to + 1 < n { pen_up_dist(fwd_exit, &strokes[to + 1]) } else { 0.0 };
    let hop_after_rev = if to + 1 < n { pen_up_dist(rev_exit, &strokes[to + 1]) } else { 0.0 };

    (rev_cost + hop_after_rev) < (fwd_cost + hop_after_fwd)
}

/// Simulates the pen moving through a sequence of strokes.
/// Returns the total pen-up travel cost and the pen's final position.
/// Each stroke independently picks the best entry given where the pen arrives from.
fn traversal_cost<'a>(
    strokes: impl Iterator<Item = &'a PlotterStroke>,
    from: (f64, f64),
) -> (f64, (f64, f64)) {
    let mut pen = from;
    let mut cost = 0.0;
    for stroke in strokes {
        let entry = best_entry(pen, stroke);
        cost += dist(pen, entry);
        pen = best_exit(pen, stroke);
    }
    (cost, pen)
}

// ── Phase 3: commit entry choices ────────────────────────────────────────────

/// Walks the final stroke order and writes the chosen entry into each stroke's
/// flag fields (reversed for Open, start_index for Loop).
fn apply_all_entries(strokes: &mut [PlotterStroke], home: (f64, f64)) {
    let mut pen = home;
    for stroke in strokes.iter_mut() {
        let entry = best_entry(pen, stroke);
        commit_entry(stroke, entry);
        pen = best_exit(pen, stroke);
    }
}

fn commit_entry(stroke: &mut PlotterStroke, entry: (f64, f64)) {
    match stroke {
        PlotterStroke::Open { start, end, reversed, .. } => {
            *reversed = entry == *end && entry != *start;
        }
        PlotterStroke::Loop { joints, start_index, .. } => {
            *start_index = joints.iter().position(|&j| j == entry).unwrap_or(0);
        }
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Computes the pen exit position after each stroke in order.
/// `exits[i]` = pen position immediately after completing `strokes[i]`.
fn compute_exits(strokes: &[PlotterStroke], home: (f64, f64)) -> Vec<(f64, f64)> {
    let mut pen = home;
    strokes
        .iter()
        .map(|s| {
            pen = best_exit(pen, s);
            pen
        })
        .collect()
}

/// Pen-up travel distance from `pen` to the nearest entry point of `stroke`.
fn pen_up_dist(pen: (f64, f64), stroke: &PlotterStroke) -> f64 {
    dist(pen, best_entry(pen, stroke))
}

/// The entry point on `stroke` closest to `pen`.
fn best_entry(pen: (f64, f64), stroke: &PlotterStroke) -> (f64, f64) {
    match stroke {
        PlotterStroke::Open { start, end, .. } => {
            if dist(pen, *start) <= dist(pen, *end) { *start } else { *end }
        }
        PlotterStroke::Loop { joints, .. } => {
            *joints
                .iter()
                .min_by(|a, b| dist(pen, **a).partial_cmp(&dist(pen, **b)).unwrap())
                .unwrap()
        }
    }
}

/// Where the pen ends up after drawing `stroke`, given it enters from `pen`.
fn best_exit(pen: (f64, f64), stroke: &PlotterStroke) -> (f64, f64) {
    match stroke {
        PlotterStroke::Open { start, end, .. } => {
            // Enter from the nearest end, exit from the other end.
            if dist(pen, *start) <= dist(pen, *end) { *end } else { *start }
        }
        PlotterStroke::Loop { .. } => {
            // Loops always close back to their entry joint.
            best_entry(pen, stroke)
        }
    }
}

fn dist(a: (f64, f64), b: (f64, f64)) -> f64 {
    let dx = a.0 - b.0;
    let dy = a.1 - b.1;
    (dx * dx + dy * dy).sqrt()
}

