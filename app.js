import {
  PRESETS, playerTime, defaultConfig, newFight, tick, start, press, togglePause, skipPhase,
  illegalMove, removeIllegal, undoCount, averageMove, nextChessRound, goToNextChess, nextStep, goToNextStep, reopen, endFight, moveStage, moveCountdownLeft,
  countsOf, roundType, formatClock,
} from './clock.js';
import { unlockAudio, play, setMuted, setSounds } from './sound.js';
import { countHands, REFEREE } from './hands.js';
import { DIGIT_STYLES, setDigits } from './digits.js';
import { ICONS, roman } from './icons.js';

const $ = id => document.getElementById(id);
// Static buttons name their icon; it is drawn in front of their text.
document.querySelectorAll('[data-icon]').forEach(el => el.insertAdjacentHTML('afterbegin', ICONS[el.dataset.icon]));
const CFG_KEY = 'pendule-cb-config';
const FIGHT_KEY = 'pendule-cb-fight';

function load(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
}

// The home screen keeps on/off flags beside each value; fightConfig() turns
// them into the clock's settings.
const homeDefaults = () => ({
  ...defaultConfig(),
  breakMs: 60000, breakOn: true,    // pause off = open pause (∞)
  warnOn: false, countdownOn: false,   // counts off by default
  digits: 'dgt',                      // clock digits: dgt | oxanium | saira
  moveWarnMs: 25000,                  // the warning, 5 s before the count unless moved
  sound: true, clicks: true,          // alerts (bell, clapper...) and the clock presses
  v: 10,
});
let cfg = { ...homeDefaults(), ...(load(CFG_KEY) || {}) };
cfg.names = ['', ''];  // no player names: BLANCS / NOIRS only
cfg.moveGraceMs = 10000;  // the count always lasts 10 s
if (!cfg.v || cfg.v < 2) {  // v2: illegal moves off by default
  cfg.illegalMoves = false;
  cfg.v = 2;
}
if (cfg.v < 3) {  // v3: rounds always stop; open pause (∞) by default; ⏸ tile
  cfg.breakMs = 0;
  cfg.boxTimer = !!((cfg.boxTimer || cfg.autoPause) && !cfg.noBoxing);
  ['autoStop', 'autoPause', 'noBoxing'].forEach(k => delete cfg[k]);
  cfg.v = 3;
}
if (cfg.v < 4) {  // v4: pause on/off (off = ∞), anti-play settings as tiles
  cfg.breakOn = false;
  cfg.breakMs = 60000;
  cfg.warnOn = cfg.countdownOn = cfg.moveLimit !== false;
  cfg.v = 4;
}
if (cfg.v < 5) {  // v5: count limits always on (− / + lines)
  delete cfg.perRoundOn; delete cfg.totalOn;
  cfg.v = 5;
}
if (cfg.v < 6) {  // v6: counts off by default
  cfg.warnOn = cfg.countdownOn = false;
  cfg.v = 6;
}
if (cfg.v < 7) {  // v7: sound back on for everyone, on by default
  cfg.sound = true;
  cfg.v = 7;
}
if (cfg.v < 8) {  // v8: the club's usual fight by default: 5 × (3' chess, 3' boxing), 1' pauses, Prêt ?
  Object.assign(cfg, { rounds: 5, intervals: true, chessRoundMs: 180000, boxRoundMs: 180000, boxTimer: true,
    breakOn: true, breakMs: 60000, readyCheck: true, v: 8 });
}
if (cfg.v < 9) {  // v9: DGT digits by default
  cfg.digits = 'dgt';
  cfg.v = 9;
}
if (cfg.v < 10) {  // v10: the warning has its own ruler, starting 5 s before the count
  cfg.moveWarnMs = cfg.moveCountdownMs - 5000;
  cfg.v = 10;
}
if (!DIGIT_STYLES.includes(cfg.digits)) cfg.digits = 'dgt';  // Teko was dropped
cfg.moveCountdownMs = Math.max(10000, cfg.moveCountdownMs);
let s = null;
setMuted(!!cfg.eco); setSounds(cfg.clicks !== false, !!cfg.sound);

// Round number as shown: always the real one, so chess rounds stay odd (I, III, V…).
// Without a boxing timer the boxing round sits inside the pause and is not shown.
const roundNo = (c, n) => n;

// ── SETUP SCREEN ──
const fmtValue = (v, kind) => kind === 'n' ? String(v)
  : `${Math.floor(v / 60000)}:${String(Math.round((v % 60000) / 1000)).padStart(2, '0')}`;  // durations as m:ss (3:00, 0:30)

// Home tiles. A tap switches the tile on or off; its strip sets the value.
// Row 1: the fight (chess rounds, pause, boxing). Row 2, under ♟ when it is
// on: the anti-play settings. The icons are the signs seen during the fight.
const watch = `<svg viewBox="0 0 32 32" class="ico"><circle cx="16" cy="18" r="11" fill="none" stroke="#ff9a1f" stroke-width="3"/><rect x="13" y="2" width="6" height="4" rx="1" fill="#ff9a1f"/><path d="M16 18 L16 11" stroke="#ff9a1f" stroke-width="3" stroke-linecap="round"/><path d="M25 8 l3-3" stroke="#ff9a1f" stroke-width="3" stroke-linecap="round"/></svg>`;
const redFlag = `<svg viewBox="0 0 32 32" class="ico"><path d="M7 3 V30" stroke="#ff3b3b" stroke-width="3" stroke-linecap="round"/><path d="M8 4 H26 L21 10 L26 16 H8 Z" fill="#ff3b3b"/></svg>`;
// Own gradient id: the fight's hands use #skin, and an id inside the hidden
// home screen would leave them without fill.
const TILE_HAND = { ...REFEREE, fill: 'url(#skin-tile)', defs: REFEREE.defs.replace('id="skin"', 'id="skin-tile"') };
// key: value in cfg, on/tap: state, icon, label, strip step/min/max, kind
const TILES = [
  { key: 'chessRoundMs', row: 1, icon: () => ICONS.pawn, label: 'Échecs', step: 10000, min: 30000, max: 600000,
    on: () => cfg.intervals, tap: () => { cfg.intervals = !cfg.intervals; } },
  { key: 'breakMs', row: 1, icon: () => ICONS.hourglass, label: 'Pause', step: 10000, min: 0, max: 300000,
    on: () => cfg.intervals && cfg.breakOn,
    tap: () => { cfg.breakOn = !(cfg.intervals && cfg.breakOn); if (cfg.breakOn) cfg.intervals = true; } },
  { key: 'boxRoundMs', row: 1, icon: () => ICONS.glove, label: 'Boxe', step: 10000, min: 30000, max: 300000,
    on: () => cfg.intervals && cfg.boxTimer,
    tap: () => { cfg.boxTimer = !(cfg.intervals && cfg.boxTimer); if (cfg.boxTimer) cfg.intervals = true; } },
  { key: 'moveCountdownMs', flag: 'countdownOn', row: 2, icon: () => countHands(8, TILE_HAND), label: 'Compte', step: 5000, min: 10000, max: 180000 },
  { key: 'illegalMoves', flag: 'illegalMoves', row: 2, icon: () => redFlag, label: 'Coups illégaux', noValue: true },
  { key: 'moveWarnMs', flag: 'warnOn', row: 2, icon: () => watch, label: 'Alerte', step: 5000, min: 5000, max: () => warnFor(cfg.moveCountdownMs) },
  // Count limits: rulers too, always on (no drawing to tap).
  { key: 'countsPerRound', kind: 'n', label: 'Max', sub: '/ round', step: 1, min: 1, max: 10, on: () => true, tap: () => {} },
  { key: 'countsTotal', kind: 'n', label: 'Max', sub: 'total', step: 1, min: 1, max: 20, on: () => true, tap: () => {} },
];
TILES.filter(t => t.flag).forEach(t => {
  t.on = t.key === 'moveWarnMs' ? () => cfg.countdownOn && cfg.warnOn : () => !!cfg[t.flag];
  t.tap = () => { cfg[t.flag] = !cfg[t.flag]; };
});
// Count limits: plain − / + lines, always on.
const LIMITS = [['countsPerRound', '/ round', 1, 10], ['countsTotal', 'total', 1, 20]];
const tileOf = key => TILES.find(t => t.key === key);
// The warning always comes 5 s before the count.
const warnFor = countdownMs => countdownMs - 5000;
// Turning the count on brings the warning with it.
tileOf('moveCountdownMs').tap = () => { cfg.countdownOn = !cfg.countdownOn; if (cfg.countdownOn) cfg.warnOn = true; };
const tileValue = t => t.key === 'breakMs' && !t.on() ? '∞' : fmtValue(cfg[t.key], t.kind);

// One line on what a tile does now.
function tileText(t) {
  const v = fmtValue(cfg[t.key], t.kind), on = t.on();
  switch (t.key) {
    case 'chessRoundMs': return on ? `Rounds d'échecs de ${v}.` : 'Pendule classique, sans rounds.';
    case 'breakMs': return !on ? 'Pause libre : tu relances le round.'
      : cfg.breakMs ? `Pauses de ${v}.` : 'Pas de pause : les rounds s\'enchaînent.';
    case 'boxRoundMs': return on ? `Round de boxe chronométré de ${v} entre deux pauses.` : 'Pas de round de boxe.';
    case 'moveWarnMs': return on ? `Alerte au bout de ${v} sur un coup.` : 'Pas d\'alerte.';
    case 'illegalMoves': return on ? 'Drapeau rouge : coup illégal adverse = 1 compte, il rejoue.' : 'Pas de bouton coup illégal.';
    default: return on ? `Compte de 10 s dès ${v} sur un coup, puis perdu.` : 'Pas de compte.';
  }
}
// Each tile: icon and label (tap = on/off), and on the right a strip
// showing the value like a wheel: press and slide up or down to set it.
const valuesOf = t => { const v = [], max = typeof t.max === 'function' ? t.max() : t.max; for (let x = t.min; x <= max; x += t.step) v.push(x); return v; };
function stripHTML(t) {
  if (!t.on() || t.fixed) return `<span class="sv"></span><span class="sv cur">${tileValue(t)}</span><span class="sv"></span>`;
  const vals = valuesOf(t), i = Math.max(0, vals.indexOf(cfg[t.key]));
  const at = k => vals[k] === undefined ? '' : fmtValue(vals[k], t.kind);
  return `<span class="sv">${at(i + 1)}</span><span class="sv cur">${at(i)}</span><span class="sv">${at(i - 1)}</span>`;
}
// Durées: one ruler per step, like a radio dial. Slide the scale under the
// needle (or tap either side for one step); tap the drawing to switch the step on / off.
const TICK_PX = 10;  // one step (10 s) of the scale
const tickOf = t => t.kind === 'n' ? 18 : TICK_PX;  // counts: wider steps
const RULER_TONE = { chessRoundMs: 'chess', boxRoundMs: 'box', breakMs: 'pause', moveCountdownMs: 'count', moveWarnMs: 'count', countsPerRound: 'n', countsTotal: 'n' };
function rulerHTML(t) {
  const on = t.on(), px = tickOf(t);
  const dim = ((t.key === 'boxRoundMs' || t.key === 'breakMs') && !cfg.intervals) || (t.key === 'moveWarnMs' && !cfg.countdownOn);
  const vals = valuesOf(t), i = Math.max(0, vals.indexOf(cfg[t.key]));
  const every = t.kind === 'n' ? 5 : t.step * 6;
  const labels = vals.map((v, k) => v % every === 0 ? `<b style="left:${k * px}px">${fmtValue(v, t.kind)}</b>` : '').join('');
  const std = standardOf(t.key);
  // Count limits have no on / off: their name is a plain label, not a button.
  const ico = t.kind === 'n'
    ? `<span class="rl-ico rl-lbl"><small>${t.label}</small><em>${t.sub}</em></span>`
    : `<button type="button" class="rl-ico" data-tile="${t.key}" aria-pressed="${on}">${t.icon()}<small>${on || t.key !== 'breakMs' ? t.label : '∞'}</small></button>`;
  return `<div class="ruler rl-${RULER_TONE[t.key]}${on ? ' on' : ''}${dim ? ' dim' : ''}">${ico}
    <div class="rl-scale" data-ruler="${t.key}">
      <div class="rl-strip" style="width:${(vals.length - 1) * px}px;transform:translateX(${-i * px}px)">${labels}</div>
      <i class="rl-needle"></i><span class="rl-cur">${on ? fmtValue(cfg[t.key], t.kind) : t.key === 'breakMs' ? 'libre' : '—'}</span>
    </div>
    <button type="button" class="rl-reset${on && cfg[t.key] !== std ? '' : ' same'}" data-reset="${t.key}" aria-label="${t.label} : valeur standard">${ICONS.replay}</button></div>`;
}
// The ↺ value: 3:00 rounds, 1:00 pause, the warning 5 s before the count, 3 / 4 counts.
const standardOf = key => key === 'moveWarnMs' ? warnFor(cfg.moveCountdownMs) : homeDefaults()[key];
let rdrag = null;
function setRuler(t, el, i, vals) {
  i = Math.min(vals.length - 1, Math.max(0, i));
  if (vals[i] === cfg[t.key]) return false;
  // The warning keeps up with the count: still 5 s before it, never after it.
  if (t.key === 'moveCountdownMs' && (cfg.moveWarnMs === warnFor(cfg.moveCountdownMs) || cfg.moveWarnMs > warnFor(vals[i]))) cfg.moveWarnMs = warnFor(vals[i]);
  cfg[t.key] = vals[i];
  el.querySelector('.rl-strip').style.transform = `translateX(${-i * tickOf(t)}px)`;
  el.querySelector('.rl-cur').textContent = fmtValue(vals[i], t.kind);
  renderPresets();
  if (navigator.vibrate) navigator.vibrate(4);
  return true;
}
const onRulerDown = e => {
  const el = e.target.closest('[data-ruler]');
  if (!el) return;
  const t = tileOf(el.dataset.ruler);
  if (!t.on()) return;
  const vals = valuesOf(t);
  rdrag = { t, el, vals, x: e.clientX, i0: Math.max(0, vals.indexOf(cfg[t.key])), moved: false };
  el.setPointerCapture(e.pointerId);
  e.preventDefault();
};
const onRulerMove = e => {
  if (!rdrag) return;
  const dx = e.clientX - rdrag.x;
  if (Math.abs(dx) > 4) rdrag.moved = true;
  if (rdrag.moved) setRuler(rdrag.t, rdrag.el, rdrag.i0 - Math.round(dx / tickOf(rdrag.t)), rdrag.vals);  // drag left = more
};
const endRuler = e => {
  if (!rdrag) return;
  const { t, el, vals, i0, moved } = rdrag;
  rdrag = null;
  if (!moved && e.type === 'pointerup') {  // a tap: one step towards that side
    const r = el.getBoundingClientRect();
    setRuler(t, el, i0 + (e.clientX > r.left + r.width / 2 ? 1 : -1), vals);
  }
  save(CFG_KEY, cfg);
  renderSetup();
};
['durations', 'chess-set'].forEach(id => {
  $(id).addEventListener('pointerdown', onRulerDown);
  $(id).addEventListener('pointermove', onRulerMove);
  $(id).addEventListener('pointerup', endRuler);
  $(id).addEventListener('pointercancel', endRuler);
});
function renderTiles() {
  $('durations').innerHTML = ['chessRoundMs', 'boxRoundMs', 'breakMs'].map(k => rulerHTML(tileOf(k))).join('');
  // Under the rulers: the count and its warning; once on, the count limits
  // (a plain clock is one game: only the total); then the illegal-move switch.
  const more = cfg.countdownOn || (cfg.intervals && cfg.illegalMoves);
  const limits = !more ? [] : cfg.intervals ? ['countsPerRound', 'countsTotal'] : ['countsTotal'];
  const ill = tileOf('illegalMoves'), illOn = cfg.intervals && cfg.illegalMoves;
  const illRow = `<button type="button" class="ruler rl-opt rl-ill${illOn ? ' on' : ''}${cfg.intervals ? '' : ' dim'}" data-tile="illegalMoves" aria-pressed="${illOn}">
      <span class="rl-ico">${ill.icon()}<small>Illégal</small></span><span class="rl-note">${cfg.intervals ? tileText(ill) : 'Avec les rounds seulement.'}</span></button>`;
  $('chess-set').innerHTML = ['moveCountdownMs', 'moveWarnMs', ...limits].map(k => rulerHTML(tileOf(k))).join('') + illRow;
}
function showTileText(t) {
  $('opt-help').hidden = false;
  $('opt-help').textContent = tileText(t);
}
function onTiles(e) {
  if (e.target.closest('[data-strip]')) return;
  const reset = e.target.closest('[data-reset]');
  if (reset) {  // back to the standard value: 3:00 rounds, 1:00 pause
    const key = reset.dataset.reset;
    if (!tileOf(key).on()) return;
    if (key === 'moveCountdownMs' && cfg.moveWarnMs > warnFor(homeDefaults()[key])) cfg.moveWarnMs = warnFor(homeDefaults()[key]);
    cfg[key] = standardOf(key);
    save(CFG_KEY, cfg);
    renderSetup();
    return;
  }
  const lim = e.target.closest('[data-lim]');
  if (lim) {
    const [key, , min, max] = LIMITS.find(l => l[0] === lim.dataset.lim);
    cfg[key] = Math.min(max, Math.max(min, cfg[key] + +lim.dataset.d));
    save(CFG_KEY, cfg);
    renderSetup();
    return;
  }
  const el = e.target.closest('[data-tile]');
  if (!el) return;
  const t = tileOf(el.dataset.tile);
  if (t.key === 'moveWarnMs' && !cfg.countdownOn) return;  // the warning comes with the count
  t.tap();
  save(CFG_KEY, cfg);
  renderSetup();
  if (t.key !== 'illegalMoves') showTileText(t);  // its row already says it
}
$('durations').addEventListener('click', onTiles);
$('chess-set').addEventListener('click', onTiles);

// Slide on a strip: one step every STEP_PX, down = more (like turning a wheel).
const STEP_PX = 24;
let drag = null;
function onStripDown(e) {
  const strip = e.target.closest('[data-strip]');
  if (!strip) return;
  const t = tileOf(strip.dataset.strip);
  if (!t.on() || t.fixed) return;
  const vals = valuesOf(t);
  drag = { t, strip, vals, y: e.clientY, i0: Math.max(0, vals.indexOf(cfg[t.key])) };
  strip.setPointerCapture(e.pointerId);
  strip.classList.add('drag');
  e.preventDefault();
}
function onStripMove(e) {
  if (!drag) return;
  const { t, strip, vals } = drag;
  const i = Math.min(vals.length - 1, Math.max(0, drag.i0 + Math.round((e.clientY - drag.y) / STEP_PX)));
  if (vals[i] === cfg[t.key]) return;
  cfg[t.key] = vals[i];
  if (t.key === 'moveCountdownMs') {
    cfg.moveWarnMs = warnFor(cfg.moveCountdownMs);
    const w = document.querySelector('[data-strip="moveWarnMs"]');
    if (w) w.innerHTML = stripHTML(tileOf('moveWarnMs'));
  }
  strip.innerHTML = stripHTML(t);
  strip.closest('[data-tile]').querySelector('i').innerHTML = t.icon();  // dots follow the count
  renderPresets();
  showTileText(t);
  if (navigator.vibrate) navigator.vibrate(5);
}
function onStripUp() {
  if (!drag) return;
  drag.strip.classList.remove('drag');
  drag = null;
  save(CFG_KEY, cfg);
  renderSetup();
}
['durations', 'chess-set'].forEach(id => {
  $(id).addEventListener('pointerdown', onStripDown);
  $(id).addEventListener('pointermove', onStripMove);
  $(id).addEventListener('pointerup', onStripUp);
  $(id).addEventListener('pointercancel', onStripUp);
});

// Toggles, laid out like the rulers: the drawing on the left, what it does on the right.
const OPTIONS = [
  ['readyCheck', () => ICONS.play, 'Prêt ?', on => on
    ? 'Attend une touche avant chaque round d\'échecs.'
    : 'Les échecs repartent seuls après la pause.'],
  ['sound', () => ICONS.bell, 'Alertes', on => on
    ? 'Cloche des rounds et claquoir des 10 s.'
    : 'Pas d\'alerte sonore : les couleurs seules.'],
  ['clicks', on => (on ? ICONS.sound : ICONS.mute), 'Coups', on => on
    ? 'Le bruit de la pendule à chaque appui.'
    : 'Appuis silencieux.'],
  ['eco', () => ICONS.eco, 'Éco', () => 'Écran noir, sans son ni animation.'],
];

// Rounds: one tap picks the number (the time per player follows).
function renderPresets() {
  $('presets').innerHTML = Object.keys(PRESETS).map(r =>
    `<button type="button" class="preset${+r === cfg.rounds ? ' on' : ''}" data-r="${r}">${cfg.intervals  // rounds: numeral + time per player; plain clock: the time alone
      ? `<b>${roman(+r)}</b><small>${formatClock(playerTime({ ...cfg, rounds: +r }))}</small>`
      : `<b class="dur-only">${formatClock(PRESETS[r])}</b>`}</button>`).join('');
  renderFrieze();
  renderSummary();
}
// Durées: the fight step by step (chess, pause, boxing),
// each step with its time. The last chess round runs until a flag falls.
function renderFrieze() {
  // Plain clock: one white bar, no rounds nor pauses, same height and total.
  if (!cfg.intervals) {
    $('frieze').innerHTML = `<div class="tl"><span class="tl-r tl-chess" style="flex-grow:1"><em>&nbsp;</em><i></i></span></div><div class="tl-total">Total <b>${fmtValue(totalMs(cfg))}</b></div>`;
    return;
  }
  // A thin time line, each step as long as it lasts: chess in bone, boxing in red,
  // pauses in blue. The last chess round runs until a flag falls: it fades out.
  const chessRounds = Array.from({ length: cfg.rounds }, (_, i) => i + 1).filter(n => roundType(n) === 'chess');
  const lastChess = Math.max(...chessRounds);
  const lastMs = Math.max(cfg.chessRoundMs, 2 * playerTime(cfg) - (chessRounds.length - 1) * cfg.chessRoundMs);
  const pauseMs = cfg.breakOn ? cfg.breakMs : 0;
  const cols = [];
  for (let n = 1; n <= cfg.rounds; n++) {
    const chess = roundType(n) === 'chess';
    if (!chess && !cfg.boxTimer) continue;
    // An open pause (∞, the coach restarts) gets a short dotted bar of its own.
    if (cols.length && !cfg.breakOn) cols.push(`<span class="tl-r tl-p tl-inf" style="flex-grow:${cfg.chessRoundMs / 3}"><em>∞</em><i></i></span>`);
    else if (cols.length && pauseMs) cols.push(`<span class="tl-r tl-p" style="flex-grow:${pauseMs}"><em></em><i></i></span>`);
    const ms = chess ? (n === lastChess ? lastMs : cfg.chessRoundMs) : cfg.boxRoundMs;
    cols.push(`<span class="tl-r ${chess ? 'tl-chess' : 'tl-box'}${n === lastChess ? ' tl-last' : ''}" style="flex-grow:${ms}"><em>${roman(roundNo(cfg, n))}</em><i></i></span>`);
  }
  // The total, small, under the last round.
  $('frieze').innerHTML = `<div class="tl">${cols.join('')}</div><div class="tl-total">Total <b>${fmtValue(totalMs(cfg))}</b></div>`;
}
// Longest fight: both chess clocks run out, plus boxing and timed pauses (an open pause counts 0).
function totalMs(c) {
  if (!c.intervals) return 2 * PRESETS[c.rounds];
  let boxing = 0, steps = 0;
  for (let n = 1; n <= c.rounds; n++) if (c.boxTimer || roundType(n) === 'chess') { steps++; if (roundType(n) !== 'chess') boxing++; }
  return 2 * playerTime(c) + boxing * c.boxRoundMs + (c.breakOn ? (steps - 1) * c.breakMs : 0);
}
// The big COMBAT button says what it starts.
const mins = ms => fmtValue(ms);
function renderSummary() {
  const c = cfg, parts = [];
  const item = (icon, text) => `<span class="si">${icon}${text}</span>`;
  if (!c.intervals) parts.push(item(ICONS.pawn, `Pendule ${formatClock(PRESETS[c.rounds])}`));
  else {
    parts.push(`<span class="si si-n">${roman(c.rounds)}<small>rounds</small></span>`, item(ICONS.pawn, mins(c.chessRoundMs)));
    if (c.boxTimer) parts.push(item(ICONS.glove, mins(c.boxRoundMs)));
    parts.push(item(ICONS.hourglass, c.breakOn ? (c.breakMs ? mins(c.breakMs) : '0') : '∞'));
  }
  parts.push(`<span class="si si-total">Total ${fmtValue(totalMs(c))}</span>`);
  $('fight-sum').innerHTML = parts.join('');
}

function renderSetup() {
  document.body.className = cfg.eco ? 'eco' : '';
  document.documentElement.dataset.digits = cfg.digits;
  renderPresets();
  // Unchecking the intervals leaves a plain clock: only Éco still applies.
  // A plain clock has no illegal-move card: dimmed, so the layout stays put.
  $('options').innerHTML = OPTIONS.map(([key, icon, label, note]) => `
    <button type="button" class="ruler rl-opt${cfg[key] ? ' on' : ''}" data-opt="${key}" aria-pressed="${!!cfg[key]}">
      <span class="rl-ico">${icon(cfg[key])}<small>${label}</small></span>
      <span class="rl-note">${note(cfg[key])}</span></button>`).join('');
  // Clock digits: the same time shown in each style, one tap to choose.
  $('digit-pick').innerHTML = `<div class="digit-pick">${DIGIT_STYLES.map(d =>
    `<button type="button" class="digit-opt${cfg.digits === d ? ' on' : ''}" data-digits="${d}" aria-label="Chiffres ${d}"><span></span></button>`).join('')}</div>`;
  $('digit-pick').querySelectorAll('.digit-opt span').forEach(sp => setDigits(sp, '4:30', sp.parentNode.dataset.digits));
  $('orient-pick').innerHTML = ORIENT_PICK.map(([o, icon, label]) =>
    `<button type="button" class="orient-opt${(cfg.orient || 'normal') === o ? ' on' : ''}" data-orient="${o}" aria-label="${label}">${icon}<small>${label}</small></button>`).join('');
  renderTiles();
  const saved = load(FIGHT_KEY);
  const live = saved && saved.phase !== 'ready' && saved.phase !== 'over';
  $('resume-wrap').hidden = !live;
  // The fight in progress at a glance: White's time, Continue, Black's time.
  if (live) {
    const w = saved.white ?? 0;
    $('btn-resume-saved').innerHTML = `<span class="tw">${formatClock(saved.remaining[w])}</span>
      <b>${ICONS.play}CONTINUER</b><span class="tb">${formatClock(saved.remaining[1 - w])}</span>`;
  }
}


$('presets').addEventListener('click', e => {
  const b = e.target.closest('[data-r]');
  if (!b) return;
  cfg.rounds = +b.dataset.r;
  save(CFG_KEY, cfg);
  renderSetup();
});
// COMBAT: the fight as set, straight away.
$('btn-fight').addEventListener('click', () => {
  unlockAudio();
  s = newFight(fightConfig());
  openFight();
});
// Orientation of the digits: face to face, or both turned to one side
// (the phone's tilt also sets it during the fight).
const ORIENT_PICK = [
  ['normal', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M7 8l5-5 5 5M7 16l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>', 'Face à face'],
  ['right', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h18M16 7l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>', 'Côté droit'],
  ['left', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12H3M8 7l-5 5 5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>', 'Côté gauche'],
];
$('orient-pick').addEventListener('click', e => {
  const b = e.target.closest('[data-orient]');
  if (!b) return;
  setOrient(b.dataset.orient);
  save(CFG_KEY, cfg);
  renderSetup();
});
// A plain clock (no intervals) has no chessboxing options; counts only count towards the total.
const NEVER = 1e9;
function fightConfig() {
  const c = structuredClone(cfg);
  // Plain clock: no boxing, no illegal-move flag; the count stays, judged on the total only.
  if (!c.intervals) Object.assign(c, { illegalMoves: false, boxTimer: false, countsPerRound: 999 });
  if (!c.breakOn) c.breakMs = null;
  if (!c.countdownOn) c.warnOn = false;  // the warning comes with the count
  c.moveWarnMs = Math.min(c.moveWarnMs, warnFor(c.moveCountdownMs));
  if (!c.warnOn) c.moveWarnMs = NEVER;
  if (!c.countdownOn) c.moveCountdownMs = NEVER;
  c.moveLimit = c.warnOn || c.countdownOn;
  return c;
}
function onOptions(e) {
  const t = e.target.closest('[data-opt]');
  const d = e.target.closest('[data-digits]');
  if (d) { cfg.digits = d.dataset.digits; save(CFG_KEY, cfg); }
  if (t) {
    cfg[t.dataset.opt] = !cfg[t.dataset.opt];
    if (t.dataset.opt === 'eco') { cfg.sound = cfg.clicks = !cfg.eco; updateMotion(); }  // Éco mutes; leaving it brings the sound back
    else if (cfg.eco && (cfg.sound || cfg.clicks)) { cfg.eco = false; updateMotion(); }  // a sound switched on leaves Éco
    save(CFG_KEY, cfg);
    setMuted(!!cfg.eco); setSounds(cfg.clicks !== false, !!cfg.sound);
  }
  renderSetup();
}
$('options').addEventListener('click', onOptions);
$('digit-pick').addEventListener('click', onOptions);
$('btn-defaults').addEventListener('click', () => {
  cfg = { ...homeDefaults(), readyCheck: true, names: cfg.names, eco: cfg.eco, sound: cfg.sound, clicks: cfg.clicks, digits: cfg.digits, orient: cfg.orient };
  save(CFG_KEY, cfg);
  renderSetup();
});
// ✕ on the Continue button drops the saved fight.
$('btn-drop-saved').addEventListener('click', () => {
  save(FIGHT_KEY, null);
  renderSetup();
});
$('btn-resume-saved').addEventListener('click', () => {
  unlockAudio();
  s = load(FIGHT_KEY);
  s.paused = false;  // straight back into the fight, no pause screen
  s.lastTick = performance.now();
  openFight();
  act(['resume']);
});

// Sound and colour test, one after the other.
$('btn-test-sound').addEventListener('click', () => {
  unlockAudio();
  const steps = [['press', '#2fbf71'], ['roundStart', '#f5c842'], ['phaseTen', '#4a9eff'], ['breakTen', '#4a9eff'], ['moveWarn', '#ff9a1f'], ['moveCountdown', '#ff3b3b'], ['count', '#ff3b3b'], ['roundEnd', '#f5c842'], ['over', '#ffffff']];
  steps.forEach(([ev, color], i) => setTimeout(() => { play(ev); flash(color); }, i * 1400));
});

// ── FIGHT SCREEN ──
// Colours are known once the first player has pressed.
function colourOf(p) {
  return s.white === null ? '' : p === s.white ? 'Blancs' : 'Noirs';
}
// Round, boxing and pause timers: whole seconds only (tenths are for the chess clocks).
function roundClock(ms) {
  const t = Math.floor(ms / 1000);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

function nameOf(p) {
  return s.cfg.names[p] || colourOf(p) || `Joueur ${p + 1}`;
}

const halves = [...document.querySelectorAll('.half')].sort((a, b) => a.dataset.p - b.dataset.p);

function buildHalves() {
  halves.forEach(h => {
    const p = +h.dataset.p;
    h.innerHTML = `<div class="h-in">
      <div class="h-name"></div>
      <div class="h-phase"><small></small><b></b></div>
      <div class="h-clock"></div>
      <div class="h-move"></div>
      <div class="h-counts"></div>
      <div class="h-avg"></div>
      <div class="h-notice" hidden></div>
      <div class="h-card"><em class="hc-num"></em><span class="hc-rule"></span><b class="hc-label"></b><i class="hc-ready">Prêt ?</i></div>
      <button type="button" class="notice-undo over-undo" hidden>Annuler</button>
      <div class="illegal-wrap"><button type="button" class="illegal-btn" aria-label="Coup illégal adverse">${redFlag}<span>Coup illégal</span></button><button type="button" class="illegal-minus" aria-label="Retirer le coup illégal">−</button></div></div>`;
    h.querySelector('.illegal-btn').addEventListener('pointerdown', e => {
      e.stopPropagation();
      act(illegalMove(s, 1 - p, performance.now()));
      showNotice(1 - p);
    });
    h.querySelector('.over-undo').addEventListener('pointerdown', e => {
      e.stopPropagation();
      act(undoCount(s, performance.now()));
    });
    // − next to the flag: takes back the last illegal move this side gave.
    h.querySelector('.illegal-minus').addEventListener('pointerdown', e => {
      e.stopPropagation();
      halves.forEach(x => { x.querySelector('.h-notice').hidden = true; });
      act(removeIllegal(s, 1 - p, performance.now()));
    });
  });
}

halves.forEach(h => h.addEventListener('pointerdown', e => {
  unlockAudio();  // iPhone: sound back after a call or a trip to the background
  if (e.target.closest('button')) return;
  act(press(s, +h.dataset.p, performance.now()));
}));

$('bar-btn').addEventListener('click', () => {
  unlockAudio();
  if (s.phase === 'ready') return;
  if (s.phase === 'over') {
    act(s.result.method === 'réflexion' ? reopen(s, performance.now()) : undoCount(s, performance.now()));
    return;
  }
  if (s.phase === 'break' && s.phaseRemaining === null && !s.paused) act(skipPhase(s, performance.now()));
  else act(togglePause(s, performance.now()));
});

document.addEventListener('keydown', e => {
  if (!s || $('fight').hidden || e.repeat) return;
  if (e.key === ' ') { e.preventDefault(); $('bar-btn').click(); }
  else if (['Enter', 'PageDown', 'PageUp', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
    e.preventDefault();
    act(press(s, s.turn, performance.now()));
  }
});

// Back to the home screen: a fight in progress is paused and kept, so
// "Reprendre le combat" brings it back.
// Digits face to face, or both turned right / left (Réglages, or the phone's tilt).
function setOrient(o) {
  cfg.orient = o;
  $('fight').dataset.orient = o;
}
setOrient(cfg.orient || 'normal');

// The phone's tilt turns the digits too: right side down = right, left side
// down = left, held upright = face to face. Lying flat on the table changes
// nothing, so the choice made in Réglages stays. iOS asks for permission on a tap.
let tilt = { o: null, since: 0 };
// iOS reports gravity with the opposite sign to Android and the spec.
const MOTION_SIGN = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 1 : -1;
function onMotion(e) {
  const g = e.accelerationIncludingGravity;
  if (!g || g.x === null || $('fight').hidden) return;
  const x = g.x * MOTION_SIGN, y = g.y * MOTION_SIGN, z = g.z;
  if (Math.abs(z) > 7) { tilt.o = null; return; }  // flat
  const o = Math.abs(x) > Math.abs(y) + 2 ? (x > 0 ? 'right' : 'left') : Math.abs(y) > Math.abs(x) + 2 ? 'normal' : null;
  if (!o) return;
  const now = performance.now();
  if (o !== tilt.o) { tilt = { o, since: now }; return; }
  if (now - tilt.since > 600 && o !== cfg.orient) { setOrient(o); save(CFG_KEY, cfg); }
}
let motionAsked = false;
function askMotion() {
  if (motionAsked) return;
  motionAsked = true;
  if (typeof DeviceMotionEvent === 'undefined') return;
  DeviceMotionEvent.requestPermission?.().catch(() => {});  // iOS: asks once, on this tap
  updateMotion();
}
// Éco switches the tilt sensor off (Réglages still turns the digits).
let motionOn = false;
function updateMotion() {
  const want = motionAsked && !cfg.eco && typeof DeviceMotionEvent !== 'undefined';
  if (want === motionOn) return;
  if (want) window.addEventListener('devicemotion', onMotion);
  else window.removeEventListener('devicemotion', onMotion);
  motionOn = want;
}
document.addEventListener('click', askMotion);
document.addEventListener('touchend', askMotion);

$('bar-home').addEventListener('click', () => {
  if (s.phase === 'ready' || s.phase === 'over') { closeFight(); return; }
  if (!s.paused) togglePause(s, performance.now());
  persist();
  s = null;
  ['fight', 'pause-menu', 'end-menu', 'result'].forEach(id => { $(id).hidden = true; });
  $('setup').hidden = false;
  renderSetup();
});

function openFight() {
  $('setup').hidden = true;
  $('fight').hidden = false;
  buildHalves();
  requestWakeLock();
  // No requestFullscreen: browsers then show an "exit full screen" toast over
  // the clock. The installed app is full screen on its own (manifest).
  render();
}

function closeFight() {
  save(FIGHT_KEY, null);
  s = null;
  ['fight', 'pause-menu', 'end-menu', 'result'].forEach(id => { $(id).hidden = true; });
  $('setup').hidden = false;
  renderSetup();
}

// Play the sounds and colour flashes of a list of events, then redraw.
const FLASH = {
  roundEnd: '#e4be5f', roundTimeUp: '#ff3b3b',
  moveWarn: '#ff9a1f', moveCountdown: '#ff3b3b', count: '#ff3b3b', over: '#ffffff',
  phaseTen: '#4a9eff', breakTen: '#4a9eff', undo: '#a3a3b8',
};
function act(events) {
  if (!events) return;
  for (const ev of events) {
    play(ev);
    if (FLASH[ev] && !cfg.eco) flash(FLASH[ev]);
  }
  render();
  persist();
}

function flash(color) {
  const f = $('flash');
  f.style.background = color;
  f.classList.remove('on');
  void f.offsetWidth;
  f.classList.add('on');
}

// Big notice on the offender's half: they read it the right way up.
let noticeTimer = null;
function showNotice(p) {
  halves.forEach(h => { h.querySelector('.h-notice').hidden = true; });
  if (s.phase === 'over') return;
  const n = halves[p].querySelector('.h-notice');
  n.innerHTML = `${redFlag}<b>COUP ILLÉGAL</b><span>+1 compte · rejoue</span>
    <button type="button" class="notice-undo">Annuler</button>`;
  n.querySelector('.notice-undo').addEventListener('pointerdown', e => {
    e.stopPropagation();
    n.hidden = true;
    act(undoCount(s, performance.now()));
  });
  n.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { n.hidden = true; }, 3000);
}

// innerHTML only when it changes (the loop redraws ten times a second).
function setHTML(el, html) {
  if (el.dataset.html === html) return;
  el.dataset.html = html;
  el.innerHTML = html;
}
// The step on the title card: round numeral and name, or the pause.
function stepCard() {
  if (s.phase === 'break') return { num: ICONS.hourglass, label: 'Pause' };
  return { num: roman(roundNo(s.cfg, s.round)), label: s.phase === 'boxing' ? 'Boxe' : 'Échecs' };
}
function trackHTML() {
  const c = s.cfg, rounds = [];
  for (let n = 1; n <= c.rounds; n++) if (c.boxTimer || roundType(n) === 'chess') rounds.push(n);
  const cur = s.phase === 'break' ? null : s.phase === 'ready' ? 1 : s.round;
  const nextR = s.phase === 'break' ? s.nextRound : null;
  return rounds.map((n, i) => {
    const kind = roundType(n) === 'chess' ? 'sq' : 'ci';
    const state = n === cur ? ' now' : (n < (cur ?? nextR) || s.phase === 'over') ? ' done' : '';
    const dash = i === 0 ? '' : `<i class="tk-dash${n === nextR ? ' now' : n < (cur ?? nextR) ? ' done' : ''}"></i>`;
    return `${dash}<i class="tk ${kind}${state}"></i>`;
  }).join('');
}

const METHOD_SHORT = { temps: 'Temps écoulé !', 'réflexion': 'Anti-jeu', decision: 'Fin' };
const methodShort = m => METHOD_SHORT[m] || m.replace(/ dans le round| au total/, '');

function render() {
  if (s) lastEcoKey = ecoKey();
  if (!s) return;
  const body = document.body;
  const r = s.result;
  const flagScreen = r && r.method !== 'decision';
  body.className = `phase-${s.phase}${s.paused ? ' paused' : ''}${s.awaitReady ? ' await' : ''}${cfg.eco ? ' eco' : ''}${flagScreen ? ' flag' : ''}`;
  const shownRound = s.phase === 'break' ? s.nextRound : s.round;
  const stage = moveStage(s);
  const cd = moveCountdownLeft(s);
  const lastRound = s.phase === 'break' ? s.nextRound - 1 : s.round;
  const roundForCounts = lastRound % 2 ? lastRound : lastRound - 1;
  const untimed = s.phaseRemaining === null;

  halves.forEach(h => {
    const p = +h.dataset.p;
    const active = s.phase === 'chess' && s.turn === p;
    h.classList.toggle('active', active);
    h.classList.toggle('warn', active && stage === 'warn');
    h.classList.toggle('countdown', active && stage === 'countdown');
    h.classList.toggle('low', s.remaining[p] < 10000);
    h.classList.toggle('winner', !!flagScreen && (r.winner === p || r.winner === null));
    h.classList.toggle('loser', !!flagScreen && r.loser === p);
    setDigits(h.querySelector('.h-clock'), cfg.eco ? roundClock(s.remaining[p]) : formatClock(s.remaining[p]), cfg.digits);  // Éco: no tenths
    const phaseEl = h.querySelector('.h-phase');
    // Boxing / pause: small label, the round timer in big digits.
    // Nothing ever covers a running clock: the next round is announced in
    // the last 10 s of the pause (and before the first one), above the timer.
    const soon = s.phase === 'break' && s.phaseRemaining !== null && s.phaseRemaining <= 10000;
    const upcoming = n => `<em>${roman(roundNo(s.cfg, n))}</em>${roundType(n) === 'chess' ? 'Échecs' : 'Boxe'}`;
    phaseEl.classList.toggle('soon', soon || s.phase === 'ready');
    setHTML(phaseEl.firstChild, s.phase === 'boxing' ? upcoming(s.round) : soon ? upcoming(s.nextRound)
      : s.phase === 'break' ? `${ICONS.hourglass}Pause` : s.phase === 'ready' ? upcoming(1) : '');
    const card = stepCard();
    setHTML(h.querySelector('.hc-num'), card.num);
    h.querySelector('.hc-label').textContent = card.label;
    setDigits(phaseEl.lastChild, (s.phase === 'boxing' || s.phase === 'break') && !untimed ? roundClock(s.phaseRemaining) : (s.phase === 'break' ? '∞' : ''), cfg.digits);
    const move = h.querySelector('.h-move');
    if (active && cd !== null) move.innerHTML = countHands(cd);
    else if (active && stage === 'warn') move.textContent = `${Math.floor(s.moveElapsed / 1000)} s`;
    else if (s.phase === 'ready') setHTML(move, `${ICONS.play}Touche`);
    else if (flagScreen && r.loser === p) move.textContent = `⚑ ${methodShort(r.method)}`;
    else if (flagScreen) move.textContent = r.winner === null ? '½' : 'VICTOIRE';
    else move.textContent = '';
    // Colour in big letters; a name only if one was typed in ⚙.
    const icon = s.white === null ? '' : p === s.white ? 'BLANCS' : 'NOIRS';
    h.querySelector('.h-name').textContent = [icon, s.cfg.names[p]].filter(Boolean).join(' · ');
    // Average per move, shown in every pause (referee pause, between rounds, Prêt ?) and at the end.
    const avg = averageMove(s, p);
    setHTML(h.querySelector('.h-avg'), (s.paused || s.phase === 'break' || s.phase === 'over') && avg !== null
      ? `${(avg / 1000).toFixed(1)}s<small>/coup</small>` : '');
    // Counts: nothing until the first one, then one red dot each
    // (bright for this round, dim for earlier rounds).
    const mine = s.counts.filter(c => c.player === p);
    h.querySelector('.h-counts').innerHTML = mine.map(c =>
      `<i class="dot on${c.round === roundForCounts ? '' : ' old'}"></i>`).join('');
    h.querySelector('.illegal-wrap').hidden = !s.cfg.illegalMoves || s.phase !== 'chess' || s.paused;
    h.querySelector('.illegal-minus').hidden = !s.counts.some(c => c.player === 1 - p && c.illegal);
  });

  // The fight as a frieze: one mark per round (square = chess, round =
  // boxing), a short dash for each pause; done, current (gold), to come.
  setHTML($('bar-round'), s.cfg.intervals ? trackHTML() : '');
  $('bar-phase').textContent = s.phase === 'ready' ? '1er = Noirs' : flagScreen ? methodShort(r.method)
    : s.roundOver ? 'Temps !' : '';
  setDigits($('bar-timer'), s.phase === 'ready' || s.phase === 'over' || untimed ? '' : roundClock(s.phaseRemaining), cfg.digits);
  // Lost on time or on counts: ↺ Rejouer in the middle of the bar.
  const byCounts = !!flagScreen && r.method.includes('comptes');
  // After the referee's count reached 0: ↺ Rejouer and Continuer side by side.
  const byCount0 = !!flagScreen && r.method === 'réflexion';
  const replay = !!flagScreen && (r.method === 'temps' || byCounts || byCount0);
  $('bar-replay').classList.toggle('with-btn', byCount0);
  $('bar-timer').hidden = replay;
  document.querySelector('.bar-info').hidden = replay;
  $('bar-replay').hidden = !replay;
  document.querySelector('.bar').classList.toggle('alert', s.roundOver && !s.paused && s.phase !== 'over');
  // On the flag screen the bar button carries the one useful action.
  // Lost on counts: Annuler in the loser's corner, where the flag button sits.
  halves.forEach(h => { h.querySelector('.over-undo').hidden = !(byCounts && r.loser === +h.dataset.p); });
  const overAction = flagScreen && r.method === 'réflexion' ? 'Continuer' : null;
  $('bar-btn').hidden = s.phase === 'ready' || (s.phase === 'over' && !overAction);
  const btnText = overAction || (s.roundOver && !s.paused ? 'Stop' : '');
  setHTML($('bar-btn'), btnText || (s.paused || (untimed && s.phase === 'break') ? ICONS.play : ICONS.pause));
  $('bar-btn').classList.toggle('long', !!btnText);
  $('bar-btn').setAttribute('aria-label', btnText || (s.paused ? 'Reprendre' : 'Pause'));
  $('bar-btn').classList.toggle('go', untimed && s.phase === 'break' && !s.paused);

  $('pause-menu').hidden = !(s.paused && s.phase !== 'over') || !$('end-menu').hidden;
  $('pause-menu').classList.toggle('ready', !!s.awaitReady);
  // ⌂ in the bar only before the start and at the end; during the fight it is in the pause strip.
  $('bar-home').hidden = !(s.phase === 'ready' || s.phase === 'over');
  if (!$('pause-menu').hidden) renderPauseMenu();
  renderResult();
}

// Pause menu: big Continue, ↺ restart from zero (tap twice), ⌂ home.
function renderPauseMenu() {
  // Next step in fight order: → ⏸ pause, then → 🥊 boxing or → ♟ chess.
  const next = s.awaitReady ? null : nextStep(s);
  $('pm-next').hidden = next === null;
  $('pm-restart').hidden = !!s.awaitReady;
  setHTML($('pm-resume'), s.awaitReady ? '<i class="ready-txt">Prêt ?</i>' : `${ICONS.play}<span>GO</span>`);
  if (next) setHTML($('pm-next'), ICONS.next + (next.phase === 'break' ? ICONS.hourglass : next.phase === 'chess' ? ICONS.pawn : ICONS.glove));
}
$('pm-next').addEventListener('click', () => act(goToNextStep(s, performance.now())));

$('pm-resume').addEventListener('click', () => act(togglePause(s, performance.now())));
// A tap anywhere outside the buttons resumes too.
$('pause-menu').addEventListener('click', e => { if (!e.target.closest('button')) $('pm-resume').click(); });
function restart() {
  s = newFight(structuredClone(s.cfg));
  buildHalves();
  act(['undo']);
}
$('pm-restart').addEventListener('click', restart);
$('bar-replay').addEventListener('click', restart);
$('pm-home').addEventListener('click', () => $('bar-home').click());

// ── MANUAL END ──
const METHODS = ['Mat', 'Abandon', 'KO', 'Arbitre', 'Juges', 'Disqualif.', 'Nulle'];
let endChoice = { winner: undefined, method: null };

function openEndMenu() {
  endChoice = { winner: undefined, method: null };
  $('end-menu').hidden = false;
  $('pause-menu').hidden = true;
  renderEndMenu();
}
function renderEndMenu() {
  const opts = [[0, nameOf(0)], [1, nameOf(1)], [null, 'Nul']];
  $('end-winner').innerHTML = opts.map(([w, label]) =>
    `<button type="button" class="btn${endChoice.winner === w ? ' sel' : ''}" data-w="${w}">${escapeHtml(label)}</button>`).join('');
  $('end-method').innerHTML = METHODS.map(m =>
    `<button type="button" class="btn${endChoice.method === m ? ' sel' : ''}" data-m="${m}">${m}</button>`).join('');
  $('end-ok').disabled = endChoice.winner === undefined || !endChoice.method;
}
$('end-winner').addEventListener('click', e => {
  const b = e.target.closest('[data-w]');
  if (!b) return;
  endChoice.winner = b.dataset.w === 'null' ? null : +b.dataset.w;
  if (endChoice.winner === null) endChoice.method = 'Nulle';
  renderEndMenu();
});
$('end-method').addEventListener('click', e => {
  const b = e.target.closest('[data-m]');
  if (!b) return;
  endChoice.method = b.dataset.m;
  renderEndMenu();
});
$('end-ok').addEventListener('click', () => {
  $('end-menu').hidden = true;
  act(endFight(s, endChoice.winner, endChoice.method, performance.now()));
});
$('end-cancel').addEventListener('click', () => { $('end-menu').hidden = true; render(); });

// ── RESULT ──
// Wins and draws show on the halves themselves (dark screen, winner in
// gold); only the end of the last round asks for the winner here.
function renderResult() {
  const r = s.result;
  const undecided = r && r.method === 'decision';
  $('result').hidden = !undecided || !$('end-menu').hidden;
  if (!undecided) return;
  $('res-kicker').textContent = 'FIN';
  $('res-name').textContent = '';
  $('res-method').textContent = '';
}
$('res-decide').addEventListener('click', () => { $('result').hidden = true; openEndMenu(); });
$('res-new').addEventListener('click', closeFight);

// ── LOOP ──
let lastSave = 0;
function persist(force = true) {
  if (!s) return;
  const now = performance.now();
  if (!force && now - lastSave < 1000) return;
  lastSave = now;
  save(FIGHT_KEY, s);
}
// Eco mode refreshes less often.
// What the screen shows, to the second: Éco skips the redraw when it hasn't changed.
let lastEcoKey = '';
function ecoKey() {
  const sec = ms => (ms === null ? '-' : Math.floor(ms / 1000));
  return [s.phase, s.paused, s.turn, s.round, s.roundOver, s.counts.length, sec(s.remaining[0]), sec(s.remaining[1]),
    sec(s.phaseRemaining), sec(s.moveElapsed), s.result?.method, document.querySelectorAll('.h-notice:not([hidden])').length].join('|');
}

(function loop() {
  if (s && !$('fight').hidden) {
    const ev = tick(s, performance.now());
    if (ev.length) act(ev);
    else if (!cfg.eco || ecoKey() !== lastEcoKey) render();  // Éco: redraw only when something shown changes
    persist(false);
  }
  setTimeout(loop, cfg.eco ? 250 : 100);
})();

// ── SCREEN ON + INSTALL ──
let wakeLock = null;
async function requestWakeLock() {
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    // Released by the system (battery saver…): ask again while the clock is shown.
    wakeLock.addEventListener('release', () => {
      if (document.visibilityState === 'visible' && !$('fight').hidden) requestWakeLock();
    });
  } catch {
    // No screen wake lock (older iPhones, some home-screen apps): a tiny silent
    // looping video keeps the screen on instead.
    keepAwakeVideo();
  }
}
let awake = null;
function keepAwakeVideo() {
  if (!awake) {
    awake = Object.assign(document.createElement('video'), { src: 'awake.mp4', muted: true, loop: true, playsInline: true });
    awake.setAttribute('playsinline', '');
    awake.setAttribute('aria-hidden', 'true');
    awake.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;bottom:0;left:0';
    document.body.appendChild(awake);
  }
  awake.play().catch(() => {});
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && s && !$('fight').hidden) { requestWakeLock(); unlockAudio(); }
});

let installEvent = null;
const standalone = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installEvent = e;
  $('install-box').hidden = false;
  $('btn-install').hidden = false;
});
$('btn-install').addEventListener('click', async () => {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice;
  installEvent = null;
  $('install-box').hidden = true;
});
if (!standalone && /iphone|ipad|ipod/i.test(navigator.userAgent)) {
  $('install-box').hidden = false;
  $('install-ios').hidden = false;
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});

function escapeHtml(t) {
  return String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

renderSetup();
caches?.keys?.().then(keys => {
  const v = keys.find(k => k.startsWith('chessboxing-pendule-'));
  if (v) $('version').textContent = '· ' + v.replace('chessboxing-pendule-', '');
}).catch(() => {});
