use std::sync::{Arc, Mutex, OnceLock};

#[cfg(not(debug_assertions))]
use tauri::Manager;
use ort::session::Session;
use ort::value::Tensor;
use serde::{Deserialize, Serialize};

// ── Types (mirror of TS PlotterMove / PlotterStroke) ─────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum PlotterMove {
    Line {
        x1: f64,
        y1: f64,
        x2: f64,
        y2: f64,
    },
    Arc {
        x1: f64,
        y1: f64,
        cx: f64,
        cy: f64,
        x2: f64,
        y2: f64,
        clockwise: bool,
    },
    QuadBezier {
        x1: f64,
        y1: f64,
        cx: f64,
        cy: f64,
        x2: f64,
        y2: f64,
    },
    CubicBezier {
        x1: f64,
        y1: f64,
        cx1: f64,
        cy1: f64,
        cx2: f64,
        cy2: f64,
        x2: f64,
        y2: f64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlotterStroke {
    pub start: [f64; 2],
    pub moves: Vec<PlotterMove>,
}

// ── Alphabet ─────────────────────────────────────────────────────────────────

const ALPHABET: &str =
    "\x00 !\"#'(),-.0123456789:;?ABCDEFGHIJKLMNOPRSTUVWYabcdefghijklmnopqrstuvwxyz";

fn char_to_index(c: char) -> i32 {
    // ALPHABET[0] = '\x00' (NUL=0), ALPHABET[1] = ' ' (space=1), etc.
    // Model uses 0-based indices; unknown chars → 0 (NUL).
    ALPHABET.find(c).map(|i| i as i32).unwrap_or(0)
}

// ── State ─────────────────────────────────────────────────────────────────────

type HandwritingModel = Mutex<Session>;

pub struct HandwritingState {
    /// Lazily loaded on first call. Stores Ok(model) or Err(reason).
    model: OnceLock<Result<Arc<HandwritingModel>, String>>,
}

impl HandwritingState {
    pub fn new() -> Self {
        Self {
            model: OnceLock::new(),
        }
    }
}

// ── Model loading ─────────────────────────────────────────────────────────────

fn load_model(#[cfg_attr(debug_assertions, allow(unused_variables))] app: &tauri::AppHandle) -> Result<Arc<HandwritingModel>, String> {
    // In dev builds the binary lives in target/debug/ and bundle resources
    // haven't been copied there yet, so fall back to the source tree.
    #[cfg(debug_assertions)]
    let model_path = std::path::PathBuf::from(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/resources/handwriting.onnx"
    ));

    #[cfg(not(debug_assertions))]
    let model_path = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {e}"))?
        .join("resources")
        .join("handwriting.onnx");

    if !model_path.exists() {
        return Err(format!(
            "handwriting.onnx not found at {model_path:?}. \
             Export the model and add it to src-tauri/resources/."
        ));
    }

    let session = Session::builder()
        .map_err(|e| format!("Failed to create ONNX session: {e}"))?
        .commit_from_file(&model_path)
        .map_err(|e| format!("Failed to load ONNX model: {e}"))?;

    Ok(Arc::new(Mutex::new(session)))
}

// ── Tauri command ─────────────────────────────────────────────────────────────

/// Generate handwriting strokes for `text` using style index `style` (0–9).
///
/// Returns strokes in **normalised space**: all coordinates are in [0, 1].
/// The TypeScript layer scales them into the element bounding box at render time.
#[tauri::command]
pub fn generate_handwriting(
    app: tauri::AppHandle,
    text: String,
    style: u32,
    state: tauri::State<'_, HandwritingState>,
) -> Result<Vec<PlotterStroke>, String> {
    let model_result = state.model.get_or_init(|| load_model(&app));

    match model_result {
        Err(e) => Err(e.clone()),
        Ok(model) => {
            let lines: Vec<&str> = text.lines().filter(|l| !l.trim().is_empty()).collect();
            if lines.is_empty() { return Ok(vec![]); }
            run_inference(model, &lines, style)
        }
    }
}

// ── Inference ─────────────────────────────────────────────────────────────────

fn run_inference(
    model: &Arc<HandwritingModel>,
    lines: &[&str],
    style: u32,
) -> Result<Vec<PlotterStroke>, String> {
    let encoded_lines: Vec<Vec<i32>> = lines
        .iter()
        .map(|l| l.chars().chain(std::iter::once(' ')).map(char_to_index).collect())
        .collect();
    // +1 ensures a trailing zero past the last character so the model's attention
    // mechanism can "step past" the final character (mirrors the Python which always
    // pads chars to a fixed width of 120 with zeros).
    let max_seq_len = encoded_lines.iter().map(|v| v.len()).max().unwrap_or(0) + 1;
    if max_seq_len == 1 {
        return Ok(vec![]);
    }
    let num_samples = encoded_lines.len();

    // style 0 → bias 1.0, style 9 → bias 3.0  (higher = cleaner writing)
    let bias: f32 = 1.0 + style as f32 * (2.0 / 9.0);
    // Auto-calculate steps if 0: ~25 per character of the longest line, clamped to [400, 2000]
    let max_steps: i32 = (max_seq_len as i32 * 25).clamp(400, 2000);

    // Build padded char tensor [num_samples, max_seq_len] (zero-pad shorter lines)
    let mut chars_data = vec![0i32; num_samples * max_seq_len];
    let mut chars_len_data = vec![0i32; num_samples];
    for (i, encoded) in encoded_lines.iter().enumerate() {
        for (j, &c) in encoded.iter().enumerate() {
            chars_data[i * max_seq_len + j] = c;
        }
        chars_len_data[i] = encoded.len() as i32;
    }

    // Build input tensors.
    // NOTE: if prime was exported as INT32 change `bool` → `i32` and `false` → `0i32`.
    let c_t     = Tensor::<i32>::from_array(([num_samples, max_seq_len], chars_data))
        .map_err(|e| format!("c tensor: {e}"))?;
    let clen_t  = Tensor::<i32>::from_array(([num_samples], chars_len_data))
        .map_err(|e| format!("c_len tensor: {e}"))?;
    let nsamp_t = Tensor::<i32>::from_array(([] as [usize; 0], vec![num_samples as i32]))
        .map_err(|e| format!("num_samples tensor: {e}"))?;
    let tstep_t = Tensor::<i32>::from_array(([] as [usize; 0], vec![max_steps]))
        .map_err(|e| format!("sample_tsteps tensor: {e}"))?;
    let prime_t = Tensor::<bool>::from_array(([] as [usize; 0], vec![false]))
        .map_err(|e| format!("prime tensor: {e}"))?;
    let bias_t  = Tensor::<f32>::from_array(([num_samples], vec![bias; num_samples]))
        .map_err(|e| format!("bias tensor: {e}"))?;
    // x_prime: dummy zeros [num_samples, 1, 3] when prime=false
    let xp_t    = Tensor::<f32>::from_array(([num_samples, 1, 3], vec![0.0f32; num_samples * 3]))
        .map_err(|e| format!("x_prime tensor: {e}"))?;
    let xplen_t = Tensor::<i32>::from_array(([num_samples], vec![1i32; num_samples]))
        .map_err(|e| format!("x_prime_len tensor: {e}"))?;

    let mut session = model.lock().map_err(|e| format!("Lock poisoned: {e}"))?;
    let outputs = session
        .run(ort::inputs![
            "c:0"             => c_t,
            "c_len:0"         => clen_t,
            "num_samples:0"   => nsamp_t,
            "sample_tsteps:0" => tstep_t,
            "prime:0"         => prime_t,
            "bias:0"          => bias_t,
            "x_prime:0"       => xp_t,
            "x_prime_len:0"   => xplen_t,
        ])
        .map_err(|e| format!("Inference failed: {e}"))?;

    // Output: cond/Merge:0  shape [num_samples, max_steps, 3]
    let (shape, data) = outputs[0]
        .try_extract_tensor::<f32>()
        .map_err(|e| format!("Failed to read output tensor: {e}"))?;

    let steps_per_sample = shape[1] as usize;

    // Collect raw strokes per line (y already flipped to doc space), then stack
    // them vertically before doing a single global normalisation so that the
    // relative size and aspect ratio of every line is preserved.
    let mut all_raw: Vec<Vec<[f64; 2]>> = Vec::new();
    let mut y_cursor = 0.0_f64;
    for i in 0..num_samples {
        let offset = i * steps_per_sample * 3;
        let slice = &data[offset..offset + steps_per_sample * 3];
        let Some(mut line_raw) = raw_strokes_from_steps(slice, steps_per_sample) else {
            continue;
        };
        // Shift this line so its top sits at y_cursor
        let y_min = line_raw.iter().flatten().map(|&[_, py]| py).fold(f64::MAX, f64::min);
        let y_max = line_raw.iter().flatten().map(|&[_, py]| py).fold(f64::MIN, f64::max);
        let shift = y_cursor - y_min;
        for stroke in &mut line_raw {
            for pt in stroke { pt[1] += shift; }
        }
        y_cursor += (y_max - y_min).max(1e-6) * 1.2; // line height + 20% gap
        all_raw.extend(line_raw);
    }
    if all_raw.is_empty() {
        return Ok(vec![]);
    }
    let all_strokes = normalise_strokes(all_raw);
    Ok(all_strokes)
}

// ── Output post-processing ────────────────────────────────────────────────────

/// Integrates (dx, dy, pen_up) steps into raw absolute-coordinate strokes.
/// y is flipped immediately (model y grows upward → doc y grows downward).
/// Returns None if the output is all padding or produces fewer than 2 points.
fn raw_strokes_from_steps(data: &[f32], steps: usize) -> Option<Vec<Vec<[f64; 2]>>> {
    // Strip trailing padding: model pads with (0,0,0) rows after generation finishes.
    let last_real = (0..steps)
        .rev()
        .find(|&i| data[i*3].abs() + data[i*3+1].abs() > 1e-6 || data[i*3+2] > 0.5)?;

    let n = last_real + 1;
    let mut pts = Vec::with_capacity(n);
    let mut eos = Vec::with_capacity(n);
    let mut x = 0.0_f64;
    let mut y = 0.0_f64;
    for i in 0..n {
        x += data[i * 3    ] as f64;
        y += data[i * 3 + 1] as f64;
        pts.push([x, -y]); // flip y: model up → doc down
        eos.push(data[i * 3 + 2] > 0.5);
    }
    if pts.len() < 2 { return None; }

    // eos[t] = false → draw line from pts[t] to pts[t+1]
    // eos[t] = true  → lift pen;  pts[t+1] is the start of the next stroke
    let mut strokes: Vec<Vec<[f64; 2]>> = Vec::new();
    let mut current: Vec<[f64; 2]> = vec![pts[0]];
    for i in 0..pts.len() - 1 {
        if eos[i] {
            if current.len() >= 2 { strokes.push(current.clone()); }
            current = vec![pts[i + 1]];
        } else {
            current.push(pts[i + 1]);
        }
    }
    if current.len() >= 2 { strokes.push(current); }

    if strokes.is_empty() { None } else { Some(strokes) }
}

/// Applies a single global normalisation to all raw strokes using a uniform scale
/// derived from the combined bounding box, so relative sizes between lines are preserved.
fn normalise_strokes(all_raw: Vec<Vec<[f64; 2]>>) -> Vec<PlotterStroke> {
    let mut min_x = f64::MAX;
    let mut min_y = f64::MAX;
    let mut max_x = f64::MIN;
    let mut max_y = f64::MIN;
    for stroke in &all_raw {
        for &[px, py] in stroke {
            if px < min_x { min_x = px; }
            if py < min_y { min_y = py; }
            if px > max_x { max_x = px; }
            if py > max_y { max_y = py; }
        }
    }
    let range_x = (max_x - min_x).max(1e-6);
    let range_y = (max_y - min_y).max(1e-6);
    let scale   = range_x.max(range_y); // uniform — preserves aspect ratio across lines
    let nx = |px: f64| (px - min_x) / scale;
    let ny = |py: f64| (py - min_y) / scale; // y already oriented correctly

    all_raw
        .into_iter()
        .map(|pts| {
            let start = [nx(pts[0][0]), ny(pts[0][1])];
            let moves = pts
                .windows(2)
                .map(|w| PlotterMove::Line {
                    x1: nx(w[0][0]), y1: ny(w[0][1]),
                    x2: nx(w[1][0]), y2: ny(w[1][1]),
                })
                .collect();
            PlotterStroke { start, moves }
        })
        .collect()
}