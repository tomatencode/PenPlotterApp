/// Removes redundant M3 (pen down) and M5 (pen up) commands, and strips
/// unnecessary trailing zeros from numbers (e.g. X1.2000 → X1.2, Y0.000 → Y0).
pub fn compress_gcode(gcode: &str) -> String {
    let mut pen_is_down = false;
    let mut compressed = String::new();

    for line in gcode.lines() {
        let command = line.trim();

        match command {
            "M3" if pen_is_down  => continue, // already down — skip
            "M5" if !pen_is_down => continue, // already up — skip
            "M3" => pen_is_down = true,
            "M5" => pen_is_down = false,
            _    => {}
        }

        compressed.push_str(&strip_number_zeros(line));
        compressed.push('\n');
    }

    // Remove trailing newline to match the style of the input.
    if compressed.ends_with('\n') {
        compressed.pop();
    }

    compressed
}

/// Strips trailing zeros after decimal points from all numbers in a GCode line.
/// Examples: X0.000 → X0,  Y1.2000 → Y1.2,  I-0.500 → I-0.5
fn strip_number_zeros(line: &str) -> String {
    line.split(' ')
        .map(|token| format_token(token))
        .collect::<Vec<_>>()
        .join(" ")
}

/// If a token is a GCode word with a decimal number (e.g. "X1.200"), strip
/// trailing zeros from its numeric part. Otherwise return it unchanged.
fn format_token(token: &str) -> String {
    // GCode tokens are a letter prefix followed by a number: X1.200, CX-0.500, G0, M3 …
    // Skip past any leading letters to find where the number starts.
    let prefix_len = token.chars().take_while(|c| c.is_ascii_alphabetic()).count();
    let (prefix, number_str) = token.split_at(prefix_len);

    // Only reformat if there is actually a decimal point to trim.
    if !number_str.contains('.') {
        return token.to_string();
    }

    // Make sure this really is a number (starts with a digit or minus sign).
    if !number_str.starts_with(|c: char| c.is_ascii_digit() || c == '-') {
        return token.to_string();
    }

    // Trim trailing zeros, then any now-dangling decimal point.
    let trimmed = number_str.trim_end_matches('0').trim_end_matches('.');
    format!("{}{}", prefix, trimmed)
}
