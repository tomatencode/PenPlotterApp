use std::sync::{Arc, Mutex, OnceLock};

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

fn load_model(#[allow(unused_variables)] app: &tauri::AppHandle) -> Result<Arc<HandwritingModel>, String> {
    // In dev builds the binary lives in target/debug/ and bundle resources
    // haven't been copied there yet, so fall back to the source tree.
    #[cfg(debug_assertions)]
    let model_path = std::path::PathBuf::from(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/resources/handwriting.onnx"
    ));

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
    steps: u32,
    state: tauri::State<'_, HandwritingState>,
) -> Result<Vec<PlotterStroke>, String> {
    let model_result = state.model.get_or_init(|| load_model(&app));

    match model_result {
        Err(e) => Err(e.clone()),
        Ok(model) => run_inference(model, &text, style, steps),
    }
}

// ── Inference ─────────────────────────────────────────────────────────────────

fn run_inference(
    model: &Arc<HandwritingModel>,
    text: &str,
    style: u32,
    steps: u32,
) -> Result<Vec<PlotterStroke>, String> {
    let char_indices: Vec<i32> = text.chars().map(char_to_index).collect();
    if char_indices.is_empty() {
        return Ok(vec![]);
    }

    // style 0 → bias 1.0, style 9 → bias 3.0  (higher = cleaner writing)
    let bias: f32 = 1.0 + style as f32 * (2.0 / 9.0);
    // Auto-calculate steps if 0: ~25 per character, clamped to [400, 2000]
    let max_steps: i32 = if steps == 0 {
        ((char_indices.len() as i32) * 25).clamp(400, 2000)
    } else {
        steps as i32
    };

    // Build input tensors: shape `[]` = scalar, `[n]` = 1-D vector.
    // NOTE: if prime was exported as INT32 change `bool` → `i32` and `false` → `0i32`.
    let seq_len = char_indices.len();
    // c:0 must be rank 2: [num_samples=1, seq_len]
    let c_t      = Tensor::<i32>::from_array(([1usize, seq_len], char_indices))
        .map_err(|e| format!("c tensor: {e}"))?;
    let clen_t   = Tensor::<i32>::from_array(([1usize], vec![seq_len as i32]))
        .map_err(|e| format!("c_len tensor: {e}"))?;
    let nsamp_t  = Tensor::<i32>::from_array(([] as [usize; 0], vec![1i32]))
        .map_err(|e| format!("num_samples tensor: {e}"))?;
    let tstep_t  = Tensor::<i32>::from_array(([] as [usize; 0], vec![max_steps]))
        .map_err(|e| format!("sample_tsteps tensor: {e}"))?;
    let prime_t  = Tensor::<bool>::from_array(([] as [usize; 0], vec![false]))
        .map_err(|e| format!("prime tensor: {e}"))?;
    let bias_t   = Tensor::<f32>::from_array(([1usize], vec![bias]))
        .map_err(|e| format!("bias tensor: {e}"))?;
    let xp_t     = Tensor::<f32>::from_array(([1usize, 1, 3], vec![0.0f32; 3]))
        .map_err(|e| format!("x_prime tensor: {e}"))?;
    // x_prime_len:0 shape [1]; pass [1] when prime=false (dummy x_prime has T=1)
    let xplen_t  = Tensor::<i32>::from_array(([1usize], vec![1i32]))
        .map_err(|e| format!("x_prime_len tensor: {e}"))?;

    eprintln!("[handwriting] Running inference: text={:?} bias={}", text, bias);
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
    eprintln!("[handwriting] Inference OK, reading output...");

    // Output: cond/Merge:0  shape [1, steps, 3]
    let (shape, data) = outputs[0]
        .try_extract_tensor::<f32>()
        .map_err(|e| format!("Failed to read output tensor: {e}"))?;
    eprintln!("[handwriting] Output shape={:?} data_len={}", &shape[..], data.len());
    let steps = shape[1] as usize;
    let result = strokes_from_steps(data, steps);
    if let Ok(ref s) = result { eprintln!("[handwriting] Produced {} strokes", s.len()); }
    result
}

// ── Output post-processing ────────────────────────────────────────────────────

/// Integrates (dx, dy, pen_up) steps into absolute-coordinate strokes, then
/// normalises to [0, 1] × [0, 1] space so the TS layer can scale to the
/// element bounding box.
fn strokes_from_steps(
    data: &[f32],
    steps: usize,
) -> Result<Vec<PlotterStroke>, String> {
    // ── Step 1: strip trailing padding (all-zero rows) ────────────────────────
    // The model pads output with (0,0,0) rows after generation finishes.
    let last_real = (0..steps)
        .rev()
        .find(|&i| data[i*3].abs() + data[i*3+1].abs() > 1e-6 || data[i*3+2] > 0.5);
    let Some(last_real) = last_real else { return Ok(vec![]); };

    // ── Step 2: integrate dx/dy into absolute positions ───────────────────────
    let n = last_real + 1;
    let mut pts  = Vec::with_capacity(n);
    let mut eos  = Vec::with_capacity(n);   // eos[t] → controls transition t→t+1
    let mut x = 0.0_f64;
    let mut y = 0.0_f64;
    for i in 0..n {
        x += data[i * 3    ] as f64;
        y += data[i * 3 + 1] as f64;
        pts.push([x, y]);
        eos.push(data[i * 3 + 2] > 0.5);
    }
    if pts.len() < 2 { return Ok(vec![]); }

    // ── Step 3: build strokes using eos lookahead semantics ───────────────────
    // eos[t] = false → draw line from pts[t] to pts[t+1]
    // eos[t] = true  → lift pen;  pts[t+1] is the start of the next stroke
    let mut raw_strokes: Vec<Vec<[f64; 2]>> = Vec::new();
    let mut current: Vec<[f64; 2]> = vec![pts[0]];
    for i in 0..pts.len() - 1 {
        if eos[i] {
            // End current stroke at pts[i], start next at pts[i+1]
            if current.len() >= 2 { raw_strokes.push(current.clone()); }
            current = vec![pts[i + 1]];
        } else {
            current.push(pts[i + 1]);
        }
    }
    if current.len() >= 2 { raw_strokes.push(current); }


    if raw_strokes.is_empty() {
        return Ok(vec![]);
    }

    // Bounding box for normalisation.
    let mut min_x = f64::MAX;
    let mut min_y = f64::MAX;
    let mut max_x = f64::MIN;
    let mut max_y = f64::MIN;
    for stroke in &raw_strokes {
        for &[px, py] in stroke {
            if px < min_x { min_x = px; }
            if py < min_y { min_y = py; }
            if px > max_x { max_x = px; }
            if py > max_y { max_y = py; }
        }
    }

    // Use a uniform scale so the aspect ratio of the handwriting is preserved.
    // ny uses (max_y - py) to flip the y axis: the model's y grows upward but
    // SVG/document space has y growing downward.
    let range_x = (max_x - min_x).max(1e-6);
    let range_y = (max_y - min_y).max(1e-6);
    let scale   = range_x.max(range_y); // uniform — preserves aspect ratio
    let nx = |px: f64| (px - min_x) / scale;
    let ny = |py: f64| (max_y - py) / scale; // flipped

    let strokes = raw_strokes
        .into_iter()
        .map(|pts| {
            let start = [nx(pts[0][0]), ny(pts[0][1])];
            let moves = pts
                .windows(2)
                .map(|w| PlotterMove::Line {
                    x1: nx(w[0][0]),
                    y1: ny(w[0][1]),
                    x2: nx(w[1][0]),
                    y2: ny(w[1][1]),
                })
                .collect();
            PlotterStroke { start, moves }
        })
        .collect();

    Ok(strokes)
}