// The Pendule's own line icons: one stroke weight, round ends, drawn in the
// current text colour, so they sit with the type instead of emoji.
const svg = (body, extra = '') =>
  `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${body}</svg>`;

// Val's own one-line drawings (knight, glove, hourglass), shown through a mask so they
// take the text colour like the line icons.
const drawing = name => `<i class="ic ic-mask ic-${name}" aria-hidden="true"></i>`;

export const ICONS = {
  pawn: drawing('knight'),
  glove: drawing('glove'),
  hourglass: drawing('hourglass'),
  pause: svg('<path d="M9 6v12M15 6v12"/>', ' stroke-width="2"'),
  play: svg('<path d="M8.5 5.8v12.4L18 12z"/>'),
  home: svg('<path d="M4 11.2 12 4.5l8 6.7"/><path d="M6.2 9.6V20h11.6V9.6"/><path d="M10.2 20v-5.2h3.6V20"/>'),
  replay: svg('<path d="M4.6 12.5A7.5 7.5 0 1 0 6.9 6.6"/><path d="M4.5 3.8v4.4h4.4"/>'),
  next: svg('<path d="M4 12h15"/><path d="M14 7l5 5-5 5"/>'),
  sound: svg('<path d="M4 9.5h3.4L12 5.6v12.8l-4.6-3.9H4z"/><path d="M15.5 9.2a4 4 0 0 1 0 5.6M18 6.6a7.6 7.6 0 0 1 0 10.8"/>'),
  mute: svg('<path d="M4 9.5h3.4L12 5.6v12.8l-4.6-3.9H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>'),
  eco: svg('<rect x="3" y="7.5" width="16" height="9" rx="2"/><path d="M21.2 10.6v2.8"/><path d="M6.4 13.6c.4-2.7 2.6-3.6 5.4-3.4-.2 2.8-2.2 4-5.4 3.4zM6.4 13.6l2.7-1.8"/>'),
  bell: svg('<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.6a2 2 0 0 0 4 0"/>'),
  close: svg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'),
};

const ROMAN = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
export function roman(n) {
  let out = '';
  for (const [v, r] of ROMAN) while (n >= v) { out += r; n -= v; }
  return out;
}
