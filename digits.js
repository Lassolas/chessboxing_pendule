// Clock digits: a font (Oxanium, Chakra Petch), or DGT-style seven-segment LCD digits
// drawn in SVG, with the unlit segments faintly visible like a real LCD.

export const DIGIT_STYLES = ['oxanium', 'dgt', 'chakra'];

const SEGS = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
const W = 56, H = 100, T = 11, G = 2;
const hSeg = (y, x0, x1) => `${x0},${y} ${x0 + T / 2},${y - T / 2} ${x1 - T / 2},${y - T / 2} ${x1},${y} ${x1 - T / 2},${y + T / 2} ${x0 + T / 2},${y + T / 2}`;
const vSeg = (x, y0, y1) => `${x},${y0} ${x + T / 2},${y0 + T / 2} ${x + T / 2},${y1 - T / 2} ${x},${y1} ${x - T / 2},${y1 - T / 2} ${x - T / 2},${y0 + T / 2}`;
const SEG_PTS = {
  a: hSeg(T / 2, T / 2 + G, W - T / 2 - G), g: hSeg(H / 2, T / 2 + G, W - T / 2 - G), d: hSeg(H - T / 2, T / 2 + G, W - T / 2 - G),
  f: vSeg(T / 2, T / 2 + G, H / 2 - G), b: vSeg(W - T / 2, T / 2 + G, H / 2 - G),
  e: vSeg(T / 2, H / 2 + G, H - T / 2 - G), c: vSeg(W - T / 2, H / 2 + G, H - T / 2 - G),
};

export function segSVG(text) {
  let x = 0, out = '';
  for (const ch of text) {
    if (ch === ':' || ch === "'") {
      out += `<rect class="lit" x="${x + 4}" y="28" width="10" height="10"/><rect class="lit" x="${x + 4}" y="62" width="10" height="10"/>`;
      x += 22;
      continue;
    }
    if (ch === '.') {  // tenths under 10 s
      out += `<rect class="lit" x="${x - 2}" y="${H - 12}" width="12" height="12"/>`;
      x += 16;
      continue;
    }
    if (!(ch in SEGS)) continue;
    const on = SEGS[ch];
    out += `<g transform="translate(${x} 0)">` + Object.entries(SEG_PTS).map(([k, p]) =>
      `<polygon class="${on.includes(k) ? 'lit' : 'ghost'}" points="${p}"/>`).join('') + '</g>';
    x += W + 12;
  }
  return `<svg class="seg" viewBox="-4 0 ${x} ${H}" role="img" aria-label="${text}"><g transform="skewX(-6) translate(6 0)">${out}</g></svg>`;
}

// Writes `text` into `el` in the chosen style, only when it changed.
export function setDigits(el, text, style) {
  const key = style + '|' + text;
  if (el.dataset.shown === key) return;
  el.dataset.shown = key;
  if (style === 'dgt' && /^[\d:'.]+$/.test(text)) el.innerHTML = segSVG(text);
  // Fonts: each digit in a fixed-width slot, so the time never wiggles
  // as it counts down, even in a font without tabular figures.
  else el.innerHTML = text.replace(/[&<>]/g, '').replace(/\d/g, d => `<span class="dg">${d}</span>`);
}
