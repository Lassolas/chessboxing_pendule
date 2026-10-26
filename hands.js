// The referee's count, drawn as two hands: 10 fingers up, one folded per second.
// Parametric referee hand, palm facing the viewer, thumb on the right (toward the centre).
// style: {fill, stroke, sw, crease, shade, cuff}
export function handSVG(fingers, style, mirror = false) {
  const F = [ // little, ring, middle, index : base x, base y, angle, length, width
    [62, 132, -11, 58, 18], [86, 124, -4, 74, 21], [110, 122, 1, 80, 22], [134, 128, 7, 72, 21],
  ];
  const order = [3, 2, 1, 0]; // index first, then middle, ring, little
  const raised = new Set(order.slice(0, Math.min(fingers, 4)));
  const thumbUp = fingers >= 5;
  const S = style;
  const stroke = `stroke="${S.stroke}" stroke-width="${S.sw}" stroke-linejoin="round" stroke-linecap="round"`;
  const fingerPath = (L, w) =>
    `M ${-w / 2} 14 L ${-w * 0.44} ${-L + w * 0.46} A ${w * 0.44} ${w * 0.46} 0 0 1 ${w * 0.44} ${-L + w * 0.46} L ${w / 2} 14 Z`;
  let back = '', front = '';
  F.forEach(([x, y, a, L, w], i) => {
    if (raised.has(i)) {
      const c1 = -L * 0.38, c2 = -L * 0.68;
      back += `<g transform="translate(${x} ${y}) rotate(${a})">
        <path d="${fingerPath(L, w)}" fill="${S.fill}" ${stroke}/>
        <path d="M ${-w * 0.3} ${c1} q ${w * 0.3} 3 ${w * 0.6} 0 M ${-w * 0.26} ${c2} q ${w * 0.26} 2.5 ${w * 0.52} 0" fill="none" stroke="${S.crease}" stroke-width="${S.sw * 0.6}" stroke-linecap="round"/>
      </g>`;
    } else {
      // Folded: one piece, bent forward at the knuckle and lying down on the
      // palm, tip towards the wrist.
      const top = -16, bot = 40, r = w / 2;
      front += `<g transform="translate(${x} ${y}) rotate(${a * 0.6})">
        <path d="M ${-r} ${top + r} A ${r} ${r} 0 0 1 ${r} ${top + r} L ${r * 0.92} ${bot - r} A ${r * 0.92} ${r * 0.92} 0 0 1 ${-r * 0.92} ${bot - r} Z" fill="${S.fill}" ${stroke}/>
        <path d="M ${-r * 0.7} ${top + r + 4} q ${r * 0.7} -5 ${r * 1.4} 0" fill="none" stroke="${S.crease}" stroke-width="${S.sw * 0.6}" stroke-linecap="round"/>
        <path d="M ${-r * 0.6} ${top + 26} q ${r * 0.6} 3 ${r * 1.2} 0" fill="none" stroke="${S.crease}" stroke-width="${S.sw * 0.6}" stroke-linecap="round"/>
      </g>`;
    }
  });
  const thumb = thumbUp
    ? `<g transform="translate(152 196) rotate(38)"><path d="${fingerPath(62, 25)}" fill="${S.fill}" ${stroke}/>
        <path d="M -7 -30 q 7 3 14 0" fill="none" stroke="${S.crease}" stroke-width="${S.sw * 0.6}" stroke-linecap="round"/></g>`
    : `<g transform="translate(150 200) rotate(-62)"><path d="${fingerPath(56, 25)}" fill="${S.fill}" ${stroke}/>
        <path d="M -7 -34 q 7 3 14 0" fill="none" stroke="${S.crease}" stroke-width="${S.sw * 0.6}" stroke-linecap="round"/></g>`;
  const palm = `<path d="M 50 132 Q 40 190 66 222 L 72 262 L 140 262 L 144 224 Q 168 200 160 156 Q 154 136 146 128 Z" fill="${S.fill}" ${stroke}/>
    <path d="M 62 168 Q 100 158 146 170 M 74 196 Q 104 182 126 150 M 92 232 Q 112 212 150 204" fill="none" stroke="${S.crease}" stroke-width="${S.sw * 0.55}" stroke-linecap="round" opacity=".8"/>`;
  const cuff = S.cuff ? `<rect x="58" y="252" width="96" height="34" rx="6" fill="#f4f1e8" stroke="#1a1a26" stroke-width="3"/>
    <rect x="58" y="252" width="96" height="9" fill="#1a1a26"/><circle cx="132" cy="272" r="4" fill="#1a1a26"/>` : '';
  const g = `${back}${palm}${front}${thumb}${cuff}`;
  return `<svg viewBox="20 30 180 260" class="hand" ${mirror ? 'style="transform:scaleX(-1)"' : ''}>${S.defs || ''}${g}</svg>`;
}
// Left of the screen: the referee's right hand (first five), right: the left hand.
export function countHands(n, style = REFEREE) {
  return `<span class="hands">${handSVG(Math.min(n, 5), style, false)}${handSVG(Math.max(n - 5, 0), style, true)}</span>`;
}
// Referee look: skin tones, thick outline, white shirt cuffs.
export const REFEREE = { fill: 'url(#skin)', stroke: '#1a1a26', sw: 4.5, crease: '#7a4a32', shade: '#c98d68', cuff: true,
  defs: '<defs><linearGradient id="skin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6d2b0"/><stop offset="1" stop-color="#d9a07a"/></linearGradient></defs>' };
