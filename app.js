import {
  PRESETS, playerTime, defaultConfig, newFight, tick, start, press, togglePause, skipPhase,
  illegalMove, removeIllegal, undoCount, averageMove, nextChessRound, goToNextChess, nextStep, goToNextStep, reopen, endFight, moveStage, moveCountdownLeft,
  countsOf, roundType, formatClock,
} from './clock.js';
import { unlockAudio, play, setMuted, setVolumes } from './sound.js';
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
  sound: true, showAvg: true,         // Son (all sounds on / off), average per move
  volAlerts: 100, volClicks: 100,     // volumes: alerts (bell, clapper...) and the clock presses
  v: 11,
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
if (cfg.v < 11) {  // v11: one Son switch, a volume per group
  cfg.sound = !!(cfg.sound || cfg.clicks);
  delete cfg.clicks;
  cfg.v = 11;
}
cfg.countsPerRound = Math.min(5, Math.max(1, cfg.countsPerRound || 3));  // limits picked from 1 to 5
cfg.countsPerRound = Math.min(4, cfg.countsPerRound);
cfg.countsTotal = Math.min(5, Math.max(cfg.countsPerRound + 1, cfg.countsTotal || 4));
if (!DIGIT_STYLES.includes(cfg.digits)) cfg.digits = 'dgt';  // Teko was dropped
cfg.moveCountdownMs = Math.max(10000, cfg.moveCountdownMs);
let s = null;
// Silent in Éco or with Son off; otherwise each group at its volume.
function applySound() { setMuted(!cfg.sound); setVolumes(cfg.volClicks ?? 100, cfg.volAlerts ?? 100); }
applySound();

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
// Count switched off: the same hands as a bone outline, so they still read as hands.
const OUTLINE_HAND = { fill: '#101418', stroke: '#ebe5d6', sw: 10, crease: 'none', shade: 'none', cuff: false, defs: '' };
const countIcon = (on, style = TILE_HAND) => countHands(8, on ? style : OUTLINE_HAND);
const TILE_HAND = { ...REFEREE, fill: 'url(#skin-tile)', defs: REFEREE.defs.replace('id="skin"', 'id="skin-tile"') };
const PM_HAND = { ...REFEREE, fill: 'url(#skin-pm)', defs: REFEREE.defs.replace('id="skin"', 'id="skin-pm"') };
// Réglages has its own copy: a gradient inside the hidden page would leave the clock's hands without fill.
const SET_HAND = { ...REFEREE, fill: 'url(#skin-set)', defs: REFEREE.defs.replace('id="skin"', 'id="skin-set"') };
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
  { key: 'moveCountdownMs', flag: 'countdownOn', row: 2, icon: () => countHands(8, SET_HAND), label: 'Compte', step: 1000, min: 1000, max: () => countMax(cfg) },
  { key: 'illegalMoves', flag: 'illegalMoves', row: 2, icon: () => redFlag, label: 'Coups illégaux', noValue: true },
  { key: 'moveWarnMs', flag: 'warnOn', row: 2, icon: () => watch, label: 'Alerte', step: 1000, min: 0, max: () => Math.max(0, cfg.moveCountdownMs - 1000) },
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
// The longest count: a third of the chess round (of each player's time in a plain clock), to the second.
const countMax = c => Math.max(1000, Math.round((c.intervals ? c.chessRoundMs : playerTime(c)) / 3000) * 1000);
// Keep the count and its warning inside their scales when the round changes.
function clampCount(c) {
  const max = countMax(c);
  if (c.moveCountdownMs <= max) return false;
  if (c.moveWarnMs === c.moveCountdownMs - 5000) c.moveWarnMs = Math.max(0, max - 5000);  // still 5 s before
  c.moveCountdownMs = max;
  c.moveWarnMs = Math.min(c.moveWarnMs, Math.max(0, max - 1000));
  return true;
}
// The warning always comes 5 s before the count.
const warnFor = countdownMs => Math.max(0, countdownMs - 5000);
// Turning the count on brings the warning with it.
tileOf('moveCountdownMs').tap = () => { cfg.countdownOn = !cfg.countdownOn; if (cfg.countdownOn) cfg.warnOn = true; };

const valuesOf = t => { const v = [], max = typeof t.max === 'function' ? t.max() : t.max; for (let x = t.min; x <= max; x += t.step) v.push(x); return v; };
// Durées: one ruler per step, like a radio dial. Slide the scale under the
// needle (or tap either side for one step); tap the drawing to switch the step on / off.
const TICK_PX = 10;  // one step (10 s) of the scale
const tickOf = t => t.kind === 'n' ? 18 : t.step === 1000 ? 5 : TICK_PX;  // counts: wider steps; seconds: finer
// Scale labels too close to the needle would peek out from under the value: hidden.
const hidesLabel = (t, k, i) => Math.abs(k - i) * tickOf(t) < (t.kind === 'n' ? 26 : 46);
function hideNear(t, el, i) { el.querySelectorAll('.rl-strip b').forEach(b => b.classList.toggle('hid', hidesLabel(t, +b.dataset.k, i))); }
const RULER_TONE = { chessRoundMs: 'chess', boxRoundMs: 'box', breakMs: 'pause', moveCountdownMs: 'count', moveWarnMs: 'count', countsPerRound: 'n', countsTotal: 'n' };
function rulerHTML(t, always = false) {
  const on = always || t.on(), px = tickOf(t);
  const dim = !always && (((t.key === 'boxRoundMs' || t.key === 'breakMs') && !cfg.intervals) || (t.key === 'moveWarnMs' && !cfg.countdownOn));
  const vals = valuesOf(t), i = Math.max(0, vals.indexOf(cfg[t.key]));
  const every = t.kind === 'n' ? 5 : t.step === 1000 ? 10000 : t.step * 6;
  const labels = vals.map((v, k) => v % every === 0 ? `<b data-k="${k}"${hidesLabel(t, k, i) ? ' class="hid"' : ''} style="left:${k * px}px">${fmtValue(v, t.kind)}</b>` : '').join('');
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
// Turned towards the far player: the settings page, or a panel opened from the top half.
const flipped = el => document.documentElement.classList.contains('flip') || !!el.closest('.qflip');
function setRuler(t, el, i, vals) {
  i = Math.min(vals.length - 1, Math.max(0, i));
  if (vals[i] === cfg[t.key]) return false;
  // The warning keeps up with the count: still 5 s before it, never after it.
  if (t.key === 'moveCountdownMs' && (cfg.moveWarnMs === warnFor(cfg.moveCountdownMs) || cfg.moveWarnMs > warnFor(vals[i]))) cfg.moveWarnMs = warnFor(vals[i]);
  cfg[t.key] = vals[i];
  el.querySelector('.rl-strip').style.transform = `translateX(${-i * tickOf(t)}px)`;
  el.querySelector('.rl-cur').textContent = fmtValue(vals[i], t.kind);
  hideNear(t, el, i);
  if (navigator.vibrate) navigator.vibrate(4);
  return true;
}
const onRulerDown = e => {
  const el = e.target.closest('[data-ruler]');
  if (!el) return;
  const t = tileOf(el.dataset.ruler);
  if (!t.on() && !el.closest('#chess-set')) return;
  const vals = valuesOf(t);
  rdrag = { t, el, vals, x: e.clientX, i0: Math.max(0, vals.indexOf(cfg[t.key])), moved: false };
  el.setPointerCapture(e.pointerId);
  e.preventDefault();
};
const onRulerMove = e => {
  if (!rdrag) return;
  const dx = (e.clientX - rdrag.x) * (flipped(rdrag.el) ? -1 : 1);
  if (Math.abs(dx) > 4) rdrag.moved = true;
  if (rdrag.moved) setRuler(rdrag.t, rdrag.el, rdrag.i0 - Math.round(dx / tickOf(rdrag.t)), rdrag.vals);  // drag left = more
};
const endRuler = e => {
  if (!rdrag) return;
  const { t, el, vals, i0, moved } = rdrag;
  rdrag = null;
  if (!moved && e.type === 'pointerup') {  // a tap: one step towards that side
    const r = el.getBoundingClientRect();
    const right = (e.clientX > r.left + r.width / 2) !== flipped(el);
    setRuler(t, el, i0 + (right ? 1 : -1), vals);
  }
  save(CFG_KEY, cfg);
  renderSetup();
};
function onTiles(e) {
  if (e.target.closest('[data-strip]')) return;
  const reset = e.target.closest('[data-reset]');
  if (reset) {  // back to the standard value: 3:00 rounds, 1:00 pause
    const key = reset.dataset.reset;
    if (!tileOf(key).on() && !reset.closest('#chess-set')) return;
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
}

// Toggles, laid out like the rulers: the drawing on the left, what it does on the right.
const OPTIONS = [
  ['readyCheck', () => ICONS.play, 'Prêt ?', on => on
    ? 'Attend une touche avant chaque round d\'échecs.'
    : 'Les échecs repartent seuls après la pause.'],
];

const optRow = ([key, icon, label, note]) => `
    <button type="button" class="ruler rl-opt${cfg[key] ? ' on' : ''}" data-opt="${key}" aria-pressed="${!!cfg[key]}">
      <span class="rl-ico">${icon(cfg[key])}<small>${label}</small></span>
      <span class="rl-note">${note(cfg[key])}</span></button>`;

const mins = ms => fmtValue(ms);
function renderSetup() {
  document.body.className = cfg.eco ? 'eco' : '';
  document.documentElement.dataset.digits = cfg.digits;
  if (clampCount(cfg)) save(CFG_KEY, cfg);
  $('opt-ready').innerHTML = optRow(OPTIONS[0]);
  // Comptes: the count's times and the limits (switched on from the clock). Alerte 0:00 = none.
  // The limits: five plain numbers to tap (1 to 5), no wheel.
  // The total is always above the limit per round (with rounds): the others are greyed out.
  const allowed = (k, n) => !cfg.intervals || (k === 'countsPerRound' ? n < 5 : n > cfg.countsPerRound);
  const pick = (k, label, sub) => `<div class="cnt-pick"><span class="cp-l"><small>${label}</small><em>${sub}</em></span>${[1, 2, 3, 4, 5].map(n =>
    `<button type="button" class="${cfg[k] === n ? 'on' : ''}" data-pick="${k}" data-n="${n}"${allowed(k, n) ? '' : ' disabled'}>${n}</button>`).join('')}</div>`;
  $('chess-set').innerHTML = ['moveCountdownMs', 'moveWarnMs'].map(k => rulerHTML(tileOf(k), true)).join('')
    + (cfg.intervals ? pick('countsPerRound', 'Max', '/ round') : '') + pick('countsTotal', 'Max', 'total');
  [['vol-alerts', 'volAlerts'], ['vol-clicks', 'volClicks']].forEach(([id, k]) => {
    $(id).value = cfg[k] ?? 100;
    $(id + '-v').textContent = cfg[k] ?? 100;
  });
  // Clock digits: the same time shown in each style, one tap to choose.
  $('digit-pick').innerHTML = `<div class="digit-pick">${DIGIT_STYLES.map(d =>
    `<button type="button" class="digit-opt${cfg.digits === d ? ' on' : ''}" data-digits="${d}" aria-label="Chiffres ${d}"><span></span></button>`).join('')}</div>`;
  $('digit-pick').querySelectorAll('.digit-opt span').forEach(sp => setDigits(sp, '4:30', sp.parentNode.dataset.digits));
  $('orient-pick').innerHTML = ORIENT_PICK.map(([o, icon, label]) =>
    `<button type="button" class="orient-opt${(cfg.orient || 'normal') === o ? ' on' : ''}" data-orient="${o}" aria-label="${label}">${icon}<small>${label}</small></button>`).join('');
  // The clock waiting to start follows the settings at once.
  if (s && s.phase === 'ready' && !$('fight').hidden) { s = newFight(fightConfig()); render(); }
  renderQuick();
}


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
  // Plain clock: no boxing; counts and illegal moves stay, judged on the total only.
  if (!c.intervals) Object.assign(c, { boxTimer: false, countsPerRound: 999 });
  if (!c.breakOn) c.breakMs = null;
  if (!c.countdownOn) c.warnOn = false;  // the warning comes with the count
  clampCount(c);
  if (!c.warnOn || c.moveWarnMs <= 0) c.moveWarnMs = NEVER;  // 0:00 = no warning (counts under 5 s)
  if (!c.countdownOn) c.moveCountdownMs = NEVER;
  c.moveLimit = c.warnOn || c.countdownOn;
  return c;
}
function onOptions(e) {
  const t = e.target.closest('[data-opt]');
  const d = e.target.closest('[data-digits]');
  if (!t && !d) return;
  if (d) cfg.digits = d.dataset.digits;
  if (t) cfg[t.dataset.opt] = !cfg[t.dataset.opt];
  save(CFG_KEY, cfg);
  renderSetup();
}
$('digit-pick').addEventListener('click', onOptions);
$('opt-ready').addEventListener('click', onOptions);
// Volume sliders: heard at once on the next sound; a short sample when let go.
[['vol-alerts', 'volAlerts', 'roundStart'], ['vol-clicks', 'volClicks', 'press']].forEach(([id, k, ev]) => {
  $(id).addEventListener('input', () => { cfg[k] = +$(id).value; $(id + '-v').textContent = cfg[k]; applySound(); });
  $(id).addEventListener('change', () => {
    unlockAudio();
    if (!cfg.sound) { cfg.sound = true; applySound(); renderSetup(); }  // moving a volume turns the sound on
    save(CFG_KEY, cfg);
    play(ev);
  });
});
// ‹ Pendule: back to the clock (a fight left in progress comes back paused).
$('btn-back').addEventListener('click', () => { unlockAudio(); backToClock(); });
function backToClock() {
  const saved = load(FIGHT_KEY);
  if (saved && saved.phase !== 'ready' && saved.phase !== 'over') {
    s = saved;
    s.paused = true;
    s.lastTick = performance.now();
    openFight();
  } else readyClock();
}

// ↺ Standard: the club's usual fight (5 rounds, 3:00 / 3:00 / 1:00, counts off);
// how the app looks and sounds stays as set.
function standard() {
  const keep = ['eco', 'sound', 'volAlerts', 'volClicks', 'digits', 'orient', 'showAvg', 'readyCheck', 'moveCountdownMs', 'moveWarnMs', 'countsPerRound', 'countsTotal'];
  const old = cfg;
  cfg = { ...homeDefaults(), names: cfg.names, moveGraceMs: cfg.moveGraceMs };
  keep.forEach(k => { if (old[k] !== undefined) cfg[k] = old[k]; });
  save(CFG_KEY, cfg);
  if (navigator.vibrate) navigator.vibrate(8);
  renderSetup();
}
// Son: all sounds on or off; Éco: dark, silent. Both apply to the clock at once.
function toggleSoundOrEco(which) {
  unlockAudio();
  if (which === 'eco') { cfg.eco = !cfg.eco; cfg.sound = !cfg.eco; updateMotion(); }  // Éco mutes; leaving it brings the sound back
  else cfg.sound = !cfg.sound;  // the sound can come back on in Éco too
  save(CFG_KEY, cfg);
  applySound();
  if (s) s.cfg.eco = cfg.eco;
  document.body.classList.toggle('eco', !!cfg.eco);
  render();
}
// Long press on Son: the volume panel (a tap still switches the sound).
let holdTimer = null, held = false;
$('bar-tg').addEventListener('pointerdown', e => {
  held = false;
  if (!e.target.closest('[data-tg="sound"]')) return;
  holdTimer = setTimeout(() => { held = true; if (navigator.vibrate) navigator.vibrate(10); openQuick('vol'); }, 500);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => $('bar-tg').addEventListener(ev, () => clearTimeout(holdTimer)));
$('bar-tg').addEventListener('contextmenu', e => e.preventDefault());
$('quick-box').addEventListener('input', e => {
  const r = e.target.closest('[data-vol]');
  if (!r) return;
  cfg[r.dataset.vol] = +r.value;
  r.nextElementSibling.textContent = r.value;
  applySound();
});
$('quick-box').addEventListener('change', e => {
  const r = e.target.closest('[data-vol]');
  if (!r) return;
  unlockAudio();
  if (!cfg.sound) { cfg.sound = true; applySound(); render(); }  // moving a volume turns the sound on
  save(CFG_KEY, cfg);
  play(r.dataset.vol === 'volAlerts' ? 'roundStart' : 'press');
});
$('bar-tg').addEventListener('click', e => {
  const b = e.target.closest('[data-tg]');
  if (!b) return;
  if (held) { held = false; return; }  // that was a long press
  if (b.dataset.tg === 'std') { standard(); return; }
  if (b.dataset.tg === 'orient') { cycleOrient(); return; }
  toggleSoundOrEco(b.dataset.tg);
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

const SET_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="7" r="2.2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="10" cy="17" r="2.2" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
const halves = [...document.querySelectorAll('.half')].sort((a, b) => a.dataset.p - b.dataset.p);

function buildHalves() {
  halves.forEach(h => {
    const p = +h.dataset.p;
    h.innerHTML = `<div class="h-in">
      <div class="h-name"></div>
      <div class="h-up"><div class="h-phase"><small></small><b></b></div></div>
      <div class="h-clock"></div>
      <div class="h-down"><div class="h-move"></div><button type="button" class="h-set">${SET_ICON}Réglages</button><div class="h-counts"></div></div>
      <div class="h-tgs"><button type="button" class="h-tg h-avgtg" aria-label="Temps moyen par coup"><b>s</b>/coup</button><button type="button" class="h-tg h-cnttg" aria-label="Comptes"></button><button type="button" class="h-tg h-illtg" aria-label="Coups illégaux">${redFlag}<small>Illégal</small></button></div>
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
    // Before the start: Réglages, turned towards the player who asked for them.
    const far = () => h.classList.contains('top') && (cfg.orient || 'normal') === 'normal' && matchMedia('(orientation: portrait)').matches;
    h.querySelector('.h-set').addEventListener('click', e => {
      e.stopPropagation();
      openSettings(far());
    });
    // s/coup: the average per move shown or not; the hands: the counts panel.
    h.querySelector('.h-avgtg').addEventListener('click', e => {
      e.stopPropagation();
      cfg.showAvg = cfg.showAvg === false;
      save(CFG_KEY, cfg);
      renderSetup();
    });
    // ✋ only switches the count on / off; its times and limits are in Réglages.
    h.querySelector('.h-cnttg').addEventListener('click', e => {
      e.stopPropagation();
      cfg.countdownOn = !cfg.countdownOn;
      if (cfg.countdownOn) cfg.warnOn = true;
      save(CFG_KEY, cfg);
      renderSetup();
    });
    // Before the start: the red flag in the corner switches illegal moves on / off.
    h.querySelector('.h-illtg').addEventListener('click', e => {
      e.stopPropagation();
      cfg.illegalMoves = !cfg.illegalMoves;
      save(CFG_KEY, cfg);
      renderSetup();
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

// A press is a sharp tap: finger down and up in place. A slide (or a long hold) does nothing.
const TAP_SLOP = 14, TAP_MS = 600;
const taps = new Map();
halves.forEach(h => {
  h.addEventListener('pointerdown', e => {
    unlockAudio();  // iPhone: sound back after a call or a trip to the background
    if (e.target.closest('button')) return;
    taps.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
  });
  h.addEventListener('pointerup', e => {
    const d = taps.get(e.pointerId);
    taps.delete(e.pointerId);
    if (!d || !s) return;
    const now = performance.now();
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > TAP_SLOP || now - d.t > TAP_MS) return;
    act(press(s, +h.dataset.p, now));
  });
  h.addEventListener('pointercancel', e => taps.delete(e.pointerId));
});

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
  if (Math.abs(z) > 7) { tilt.o = null; tilt.lock = null; return; }  // flat
  const o = Math.abs(x) > Math.abs(y) + 2 ? (x > 0 ? 'right' : 'left') : Math.abs(y) > Math.abs(x) + 2 ? 'normal' : null;
  if (!o) return;
  const now = performance.now();
  if (o !== tilt.o) { tilt = { o, since: now, lock: tilt.lock === o ? o : null }; return; }
  // A turn chosen with the button holds until the phone is tilted another way.
  if (now - tilt.since > 350 && o !== cfg.orient && o !== tilt.lock) { setOrient(o); save(CFG_KEY, cfg); render(); }
}
let motionAsked = false;
function askMotion() {
  if (motionAsked) return;
  motionAsked = true;
  if (typeof DeviceMotionEvent === 'undefined') return;
  // iOS asks once, on this tap; the sensor starts once allowed.
  if (IOS && DeviceMotionEvent.requestPermission) DeviceMotionEvent.requestPermission().then(() => { motionOn = false; updateMotion(); }).catch(() => {});
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
// Android and others need no permission: the tilt works from the start, before any tap.
const IOS = MOTION_SIGN === 1;
if (!IOS) askMotion();
// Orientation button (like lichess): each tap turns the digits to the next way.
const ORIENTS = ['normal', 'right', 'left'];
function cycleOrient() {
  const o = ORIENTS[(ORIENTS.indexOf(cfg.orient || 'normal') + 1) % ORIENTS.length];
  setOrient(o);
  tilt.lock = tilt.o;  // the tilt only takes over again once the phone moves
  save(CFG_KEY, cfg);
  if (navigator.vibrate) navigator.vibrate(6);
  render();
}

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
  document.documentElement.classList.remove('flip');
  $('setup').hidden = true;
  $('fight').hidden = false;
  buildHalves();
  requestWakeLock();
  // No requestFullscreen: browsers then show an "exit full screen" toast over
  // the clock. The installed app is full screen on its own (manifest).
  render();
}

// The end of a fight (⌂): straight back to a fresh clock, ready to go.
function closeFight() {
  save(FIGHT_KEY, null);
  ['pause-menu', 'end-menu', 'result'].forEach(id => { $(id).hidden = true; });
  readyClock();
}
// The app opens on the clock, ready: the fight as set, waiting for the first press.
function readyClock() {
  s = newFight(fightConfig());
  openFight();
}
// Réglages from the clock; from the far half, the page turns to face that player.
// A fight in progress is kept, paused (Continuer on the page, or ‹ Pendule).
function openSettings(flip) {
  if (s && s.phase !== 'ready' && s.phase !== 'over') {
    if (!s.paused) togglePause(s, performance.now());
    persist();
  } else save(FIGHT_KEY, null);
  s = null;
  quickKey = null; renderQuick();
  ['fight', 'pause-menu', 'end-menu', 'result'].forEach(id => { $(id).hidden = true; });
  document.documentElement.classList.toggle('flip', !!flip);
  $('setup').hidden = false;
  renderSetup();
  window.scrollTo(0, 0); $('setup').scrollTop = 0;
}
// Before the start the bar holds round buttons: rounds, chess, boxing, pause.
// Each part can be tapped to change it right there (see the quick panel).
function readyInfoHTML(c) {
  // Round buttons, all the same size: the rounds, and the clock (chess, boxing and pause times).
  const item = (q, icon, label) => `<button type="button" class="ri ri-${q}${quickKey === q ? ' open' : ''}" data-q="${q}" aria-label="${label}">${icon}</button>`;
  // The rounds like a wheel: the number set, the other choices peeking out at the edges.
  // All the choices: the one set big in the middle, the others small and dim along the bottom of the dial.
  const others = Object.keys(PRESETS).map(Number).filter(n => n !== c.rounds);
  const ring = others.map((n, i) => `<i class="ri-peek ri-o${i}">${roman(n)}</i>`).join('');
  return item('rounds', `<span class="ri-n${roman(c.rounds).length > 2 ? ' long' : ''}">${roman(c.rounds)}</span>` + ring, 'Rounds')
    + item('times', ICONS.clock + timesMarks(c), 'Temps');
}
// Around the clock drawing, a ring in three arcs for the settings behind it:
// chess (bone), boxing (red), pause (blue); an arc fades when its step is off.
const timesMarks = c => `<span class="ri-ring${c.intervals && c.boxTimer ? '' : ' no-box'}${c.intervals && c.breakOn ? '' : ' no-pause'}"></span>`;
// Quick panel over the waiting clock: the step's ruler, on / off and back to the
// original time; for the rounds, the four numbers. Tap outside to close.
let quickKey = null, quickFlip = false;
function renderQuick() {
  const k = quickKey;
  $('quick').hidden = !k;
  $('quick-box').classList.toggle('qflip', !!k && quickFlip);
  if (!k) return;
  if (k === 'rounds') {
    $('quick-box').innerHTML = `<p class="q-t">Rounds</p><div class="q-rounds">${Object.keys(PRESETS).map(r =>
      `<button type="button" class="${+r === cfg.rounds ? 'on' : ''}" data-qr="${r}"><b>${roman(+r)}</b><small>${formatClock(playerTime({ ...cfg, rounds: +r }))}</small></button>`).join('')}</div>`;
    return;
  }
  if (k === 'vol') {  // long press on Son: the two volumes
    const row = (k2, icon, label, sub) => `<label class="vol"><span class="vol-ico">${icon}</span><span class="vol-l">${label}<small>${sub}</small></span><input type="range" min="0" max="100" step="5" data-vol="${k2}" value="${cfg[k2] ?? 100}"><b>${cfg[k2] ?? 100}</b></label>`;
    $('quick-box').innerHTML = `<p class="q-t">Son</p><div class="vols">` + row('volAlerts', ICONS.bell, 'Alertes', 'cloche, claquoir') + row('volClicks', ICONS.sound, 'Coups', 'appuis')
      + `</div><div class="q-act q-act-one"><button type="button" class="q-btn q-ok" data-qclose>OK</button></div>`;
    return;
  }
  if (k === 'times') {  // the three wheels; tap a drawing to switch that step on / off
    $('quick-box').innerHTML = `<p class="q-t">Temps</p>` + ['chessRoundMs', 'boxRoundMs', 'breakMs'].map(x => rulerHTML(tileOf(x))).join('')
      + `<div class="q-act q-act-one"><button type="button" class="q-btn q-ok" data-qclose>OK</button></div>`;
    return;
  }
  const t = tileOf(k), on = t.on();
  $('quick-box').innerHTML = rulerHTML(t) + `<div class="q-act">
    <button type="button" class="q-btn" data-tile="${k}">${on ? 'Désactiver' : 'Activer'}</button>
    <button type="button" class="q-btn" data-reset="${k}"${on && cfg[k] !== standardOf(k) ? '' : ' disabled'}>${ICONS.replay}${fmtValue(standardOf(k))}</button>
    <button type="button" class="q-btn q-ok" data-qclose>OK</button></div>`;
}
function openQuick(k, flip = false) { quickKey = k; quickFlip = flip; renderQuick(); render(); }
$('bar-round').addEventListener('click', e => {
  const b = e.target.closest('[data-q]');
  if (!b || !s || s.phase !== 'ready') return;
  openQuick(b.dataset.q);
});
$('quick').addEventListener('click', e => {
  if (e.target === $('quick') || e.target.closest('[data-qclose]')) { quickKey = null; renderQuick(); render(); return; }
  const r = e.target.closest('[data-qr]');
  if (r) { cfg.rounds = +r.dataset.qr; save(CFG_KEY, cfg); renderSetup(); }
});
$('quick').addEventListener('click', onTiles);
// Réglages › Comptes: drag the rulers, ↺ resets; the drawings are not switches here.
$('chess-set').addEventListener('click', e => {
  const b = e.target.closest('[data-pick]');
  if (b) {
    cfg[b.dataset.pick] = +b.dataset.n;
    if (cfg.countsTotal <= cfg.countsPerRound) cfg.countsTotal = cfg.countsPerRound + 1;  // the total stays above
    save(CFG_KEY, cfg); renderSetup(); return;
  }
  if (e.target.closest('[data-reset]')) onTiles(e);
});
['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].forEach((ev, i) =>
  $('chess-set').addEventListener(ev, [onRulerDown, onRulerMove, endRuler, endRuler][i]));
$('quick').addEventListener('click', onOptions);
['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].forEach((ev, i) =>
  $('quick').addEventListener(ev, [onRulerDown, onRulerMove, endRuler, endRuler][i]));
// The way the digits face now: ↕ face to face, → turned right, ← turned left.
const ORIENT_ICON = {
  normal: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4"/></svg>',
  right: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18M17 8l4 4-4 4"/></svg>',
  left: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12H3M7 8l-4 4 4 4"/></svg>',
};
function renderBarToggles() {
  const sound = !!cfg.sound;
  $('bar-tg').innerHTML = `<button type="button" class="tg${sound ? ' on' : ''}" data-tg="sound" aria-label="Son">${sound ? ICONS.sound : ICONS.mute}</button>`
    + `<button type="button" class="tg${cfg.eco ? ' on' : ''}" data-tg="eco" aria-label="Éco">${ICONS.eco}</button>`
    + `<button type="button" class="tg tg-orient" data-tg="orient" aria-label="Orientation">${ORIENT_ICON[cfg.orient || 'normal']}</button>`
    + `<button type="button" class="tg tg-std" data-tg="std" aria-label="Standard">${ICONS.replay}</button>`;
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
// A round numeral in its colour, bold: chess white, boxing red.
const roundTag = n => `<span class="rtag ${roundType(n) === 'chess' ? 'rt-chess' : 'rt-box'}">${roman(n)}</span>`;
function setHTML(el, html) {
  if (el.dataset.html === html) return;
  el.dataset.html = html;
  el.innerHTML = html;
}
// Progress in the bar: the round numerals, chess in gold, boxing in red,
// the round being played in bold; the others greyed.
function trackHTML() {
  const c = s.cfg, rounds = [];
  for (let n = 1; n <= c.rounds; n++) if (c.boxTimer || roundType(n) === 'chess') rounds.push(n);
  const cur = s.phase === 'break' || s.phase === 'over' ? null : s.phase === 'ready' ? 1 : s.round;
  // In a pause: the round just played in bold grey, the next one bold and blinking.
  const prev = s.phase === 'break' ? s.round : null, next = s.phase === 'break' ? s.nextRound : null;
  // Every round already played: bold grey.
  const played = n => s.phase === 'over' || n < (cur ?? next ?? 1) || n === prev;
  const cls = n => n === cur ? ' now' : n === next ? ' now next' : played(n) ? ' prev' : '';
  // Many rounds: tighter type so they all fit in the bar.
  return `<span class="trk${rounds.length > 8 ? ' many' : rounds.length > 6 ? ' more' : ''}">${rounds.map(n =>
    `<b class="tr ${roundType(n) === 'chess' ? 'tr-chess' : 'tr-box'}${cls(n)}">${roman(roundNo(c, n))}</b>`).join('')}</span>`;
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
    // No round names on the clock (Val): only Boxe / Pause over their timer; the rounds are in the bar.
    phaseEl.classList.remove('soon');
    // No text over the timers (Val): the rounds are in the bar.
    setHTML(phaseEl.firstChild, '');
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
    // Average per move: always shown once there is one, during play too.
    // During play only finished moves count: the figure changes when a move is played, not live.
    const avg = averageMove(s, p, s.phase !== 'chess' || s.paused);
    setHTML(h.querySelector('.h-avg'), cfg.showAvg !== false && s.phase !== 'ready' && avg !== null
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
  setHTML($('bar-round'), s.phase === 'ready' ? readyInfoHTML(s.cfg) : s.cfg.intervals ? trackHTML() : '');
  $('bar-phase').textContent = s.phase === 'ready' ? '' : flagScreen ? methodShort(r.method)
    : s.roundOver ? 'Temps !' : '';
  setDigits($('bar-timer'), s.phase === 'ready' || s.phase === 'over' || untimed ? '' : roundClock(s.phaseRemaining), cfg.digits);
  // Lost on time or on counts: ↺ Rejouer in the middle of the bar.
  const byCounts = !!flagScreen && r.method.includes('comptes');
  // After the referee's count reached 0: ↺ Rejouer and Continuer side by side.
  const byCount0 = !!flagScreen && r.method === 'réflexion';
  const replay = !!flagScreen && (r.method === 'temps' || byCounts || byCount0);
  $('bar-replay').classList.toggle('with-btn', byCount0);
  // Every round and timed pause: → next step beside ⏸. In boxing and pauses the halves
  // already show the time, so it takes the timer's place; in chess the round timer stays.
  const skipTo = ['chess', 'boxing', 'break'].includes(s.phase) && !untimed && !s.awaitReady && !s.roundOver ? nextStep(s) : null;
  $('bar-next').hidden = !skipTo;
  if (skipTo) setHTML($('bar-next'), ICONS.next + (skipTo.phase === 'break' ? ICONS.hourglass : roundTag(skipTo.round)));
  $('bar-timer').hidden = replay || (!!skipTo && s.phase !== 'chess');
  document.querySelector('.bar').classList.toggle('next-t', !!skipTo && s.phase === 'chess');
  document.querySelector('.bar-info').hidden = replay;
  $('bar-replay').hidden = !replay;
  document.querySelector('.bar').classList.toggle('alert', s.roundOver && !s.paused && s.phase !== 'over');
  // On the flag screen the bar button carries the one useful action.
  // Lost on counts: Annuler in the loser's corner, where the flag button sits.
  halves.forEach(h => { h.querySelector('.over-undo').hidden = !(byCounts && r.loser === +h.dataset.p); });
  const overAction = flagScreen && r.method === 'réflexion' ? 'Continuer' : null;
  $('bar-btn').hidden = s.phase === 'ready' || (s.phase === 'over' && !overAction);
  const btnText = overAction || (s.roundOver && !s.paused ? 'Stop' : '');
  // Open pause: the button starts the next round, so it says which one (→ IV in its colour).
  setHTML($('bar-btn'), btnText || (untimed && s.phase === 'break' && !s.paused ? `<span class="bb-next">${ICONS.next}${roundTag(s.nextRound)}</span>`
    : s.paused || (untimed && s.phase === 'break') ? ICONS.play : ICONS.pause));
  $('bar-btn').classList.toggle('long', !!btnText);
  $('bar-btn').setAttribute('aria-label', btnText || (s.paused ? 'Reprendre' : 'Pause'));
  $('bar-btn').classList.toggle('go', untimed && s.phase === 'break' && !s.paused);

  $('pause-menu').hidden = !(s.paused && s.phase !== 'over') || !$('end-menu').hidden || !!quickKey;  // the volume panel goes over it
  $('pause-menu').classList.toggle('ready', !!s.awaitReady);
  // ⌂ in the bar only before the start and at the end; during the fight it is in the pause strip.
  $('bar-home').hidden = s.phase !== 'over';
  // Before the start: Son and Éco in the bar, Réglages in each half.
  $('bar-tg').hidden = s.phase !== 'ready';
  if (s.phase === 'ready') renderBarToggles();
  halves.forEach(h => {
    h.querySelector('.h-set').hidden = s.phase !== 'ready';
    h.querySelector('.h-tgs').hidden = s.phase !== 'ready';
    [['.h-illtg', !!s.cfg.illegalMoves], ['.h-cnttg', !!cfg.countdownOn], ['.h-avgtg', cfg.showAvg !== false]].forEach(([q, on]) => {
      const b = h.querySelector(q);
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on);
      // One pair of hands only: skin when on, outline when off.
      if (q === '.h-cnttg' && b.dataset.on !== String(on)) { b.dataset.on = on; b.innerHTML = countIcon(on) + '<small>Compte</small>'; }
    });
  });
  if (!$('pause-menu').hidden) renderPauseMenu();
  renderResult();
  fitTrack();
}
// The frieze of rounds always whole on the one line: shrunk only if it does not fit.
let fitKey = '';
function fitTrack() {
  const r = $('bar-round'), k = [r.dataset.html, innerWidth, innerHeight, $('bar-next').hidden, $('bar-timer').hidden, cfg.orient].join('|');
  if (k === fitKey) return;
  fitKey = k;
  const t = r.querySelector('.trk');
  if (!t) return;
  t.style.zoom = '';
  const over = t.scrollWidth / r.clientWidth;
  if (over > 1) t.style.zoom = (1 / over).toFixed(3);
}

// Pause menu: big Continue, ↺ restart from zero (tap twice), ⌂ home.
function renderPauseMenu() {
  // Prêt ?: nothing in the middle but Prêt ? (no pause settings).
  $('pm-tgs').hidden = $('pm-restart').hidden = !!s.awaitReady;
  setHTML($('pm-resume'), s.awaitReady ? '<i class="ready-txt">Prêt ?</i>' : `${ICONS.play}<span>GO</span>`);
  // Switches for the rest of the fight: counts, illegal moves, sound, Éco; and Réglages.
  const sound = !!cfg.sound;
  const tg = (k, on, icon, label) => `<button type="button" class="pt${on ? ' on' : ''}" data-pt="${k}" aria-pressed="${on}">${icon}<small>${label}</small></button>`;
  setHTML($('pm-tgs'), tg('count', !!s.cfg.countdownOn, countIcon(!!s.cfg.countdownOn, PM_HAND), 'Compte')
    + tg('ill', !!s.cfg.illegalMoves, redFlag, 'Illégal')
    + tg('sound', sound, sound ? ICONS.sound : ICONS.mute, 'Son')
    + tg('eco', !!cfg.eco, ICONS.eco, 'Éco')
    + `<button type="button" class="pt pt-set" data-pt="set">${SET_ICON}<small>Réglages</small></button>`);
}
// Counts and illegal moves switched during a fight: the clock takes them at once.
const COUNT_KEYS = ['countdownOn', 'warnOn', 'moveWarnMs', 'moveCountdownMs', 'moveLimit', 'illegalMoves', 'countsPerRound', 'countsTotal'];
// Long press on Son in the pause too: the volume panel.
$('pm-tgs').addEventListener('pointerdown', e => {
  held = false;
  if (!e.target.closest('[data-pt="sound"]')) return;
  holdTimer = setTimeout(() => { held = true; if (navigator.vibrate) navigator.vibrate(10); openQuick('vol'); }, 500);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => $('pm-tgs').addEventListener(ev, () => clearTimeout(holdTimer)));
$('pm-tgs').addEventListener('contextmenu', e => e.preventDefault());
$('pm-tgs').addEventListener('click', e => {
  const b = e.target.closest('[data-pt]');
  if (!b) return;
  if (held) { held = false; return; }  // that was a long press
  const k = b.dataset.pt;
  if (k === 'set') { openSettings(false); return; }
  if (k === 'sound' || k === 'eco') { toggleSoundOrEco(k); return; }
  if (k === 'count') { cfg.countdownOn = !s.cfg.countdownOn; if (cfg.countdownOn) cfg.warnOn = true; }
  else cfg.illegalMoves = !s.cfg.illegalMoves;
  save(CFG_KEY, cfg);
  const f = fightConfig();
  COUNT_KEYS.forEach(c => { s.cfg[c] = f[c]; });
  persist();
  render();
});
// Timed pause: → next round beside ⏸, where the timer was.
$('bar-next').addEventListener('click', () => { unlockAudio(); act(goToNextStep(s, performance.now())); });

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
  // Screen locked (or app left) during a chess round: the chess clock stops. Boxing and pauses keep running.
  if (document.visibilityState === 'hidden' && s && s.phase === 'chess' && !s.paused && !s.roundOver && !$('fight').hidden) {
    act(togglePause(s, performance.now()));
    persist();
  }
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

// Slide down from anywhere (clock stopped, or Réglages scrolled to the top) to
// reload the app: the newest version, everything set afresh.
const PTR_PX = 110;
const ptr = document.createElement('div');
ptr.id = 'ptr';
ptr.innerHTML = ICONS.replay;
document.body.append(ptr);
let pull = null;
function pullAllowed(target) {
  if (target.closest('[data-ruler], input, .quick-box')) return false;
  if (!$('setup').hidden) {
    const el = $('setup');
    return document.documentElement.classList.contains('flip')
      ? el.scrollTop >= el.scrollHeight - el.clientHeight - 2  // turned page: its top is at the bottom
      : window.scrollY <= 0 && el.scrollTop <= 0;
  }
  return !!s && (s.phase === 'ready' || s.phase === 'over' || s.paused);
}
function pullStart(x, y, target) { pull = pullAllowed(target) ? { x, y, d: 0 } : null; }
function pullMove(x, y) {
  if (!pull) return;
  const flip = document.documentElement.classList.contains('flip') && !$('setup').hidden;
  const dy = (y - pull.y) * (flip ? -1 : 1), dx = Math.abs(x - pull.x);
  if (dx > Math.max(40, dy)) { pullEnd(false); return; }  // sideways: not a pull
  pull.d = Math.max(0, dy);
  const k = Math.min(1, pull.d / PTR_PX);
  ptr.style.opacity = k;
  ptr.style.transform = `translateY(${(flip ? -1 : 1) * (-60 + k * 100)}px) rotate(${k * 300}deg)`;
  ptr.classList.toggle('go', k >= 1);
}
function pullEnd(ok = true) {
  const go = ok && pull && pull.d >= PTR_PX;
  pull = null;
  ptr.style.opacity = 0;
  ptr.style.transform = '';
  ptr.classList.remove('go');
  if (!go) return;
  persist();
  const reg = navigator.serviceWorker ? navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => {}) : Promise.resolve();
  Promise.race([reg, new Promise(ok => setTimeout(ok, 1500))]).then(() => location.reload());
}
document.addEventListener('touchstart', e => { if (e.touches.length === 1) pullStart(e.touches[0].clientX, e.touches[0].clientY, e.target); else pull = null; }, { passive: true });
document.addEventListener('touchmove', e => { if (e.touches.length === 1) pullMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
document.addEventListener('touchend', () => pullEnd(), { passive: true });
document.addEventListener('touchcancel', () => pullEnd(false), { passive: true });
// A mouse can pull too (computer, tests).
document.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') pullStart(e.clientX, e.clientY, e.target); });
document.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && e.buttons) pullMove(e.clientX, e.clientY); });
document.addEventListener('pointerup', e => { if (e.pointerType === 'mouse') pullEnd(); });

function escapeHtml(t) {
  return String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

renderSetup();
{  // Opening: on the clock, ready, or the fight left in progress, paused.
  backToClock();  // a fight left in progress comes back paused
}
// Version shown in Réglages (and in the feedback subject): the newest cache, read again
// when a new version takes over, so it never lags one version behind.
const vNum = k => k.replace('chessboxing-pendule-', '').split('.').map(Number);
const newer = (a, b) => { const x = vNum(a), y = vNum(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return (y[i] || 0) - (x[i] || 0); return 0; };
function showVersion() {
  caches?.keys?.().then(keys => {
    const v = keys.filter(k => k.startsWith('chessboxing-pendule-')).sort(newer)[0];
    if (v) $('version').textContent = '· ' + v.replace('chessboxing-pendule-', '');
    // Feedback by email: the subject is filled in, with the version.
    const ver = v ? ' ' + v.replace('chessboxing-pendule-', '') : '';
    $('btn-feedback').href = 'mailto:chessboxingparis@gmail.com?subject=' + encodeURIComponent(`[Pendule${ver}] Retour appli`);
  }).catch(() => {});
}
showVersion();
navigator.serviceWorker?.addEventListener('controllerchange', () => setTimeout(showVersion, 500));
