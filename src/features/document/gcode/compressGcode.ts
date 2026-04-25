function formatToken(token: string): string {
  // Advance past any letter prefix (X, CX1, G, M …)
  let i = 0;
  while (i < token.length && /[A-Za-z]/.test(token[i])) i++;
  const prefix = token.slice(0, i);
  const numStr = token.slice(i);

  // Only reformat tokens that actually have a decimal point.
  if (!numStr.includes('.') || !/^[-0-9]/.test(numStr)) return token;

  const trimmed = numStr.replace(/0+$/, '').replace(/\.$/, '');
  return prefix + trimmed;
}

export function compressGcode(gcode: string): string {
  let penDown = false;
  const lines: string[] = [];

  for (const line of gcode.split('\n')) {
    const cmd = line.trim();
    if (cmd === 'M3') {
      if (penDown) continue;  // already down — skip
      penDown = true;
    } else if (cmd === 'M5') {
      if (!penDown) continue; // already up — skip
      penDown = false;
    }
    lines.push(line.split(' ').map(formatToken).join(' '));
  }

  // Strip trailing blank lines.
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();

  return lines.join('\n');
}
