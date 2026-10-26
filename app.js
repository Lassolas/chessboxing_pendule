import {
  PRESETS, playerTime, defaultConfig, newFight, tick, start, press, togglePause, skipPhase,
  illegalMove, removeIllegal, undoCount, averageMove, nextChessRound, goToNextChess, reopen, endFight, moveStage, moveCountdownLeft,
  countsOf, roundType, formatClock,
} from './clock.js';
import { unlockAudio, play, setMuted } from './sound.js';
import { countHands, REFEREE } from './hands.js';
import { DIGIT_STYLES, setDigits } from './digits.js';

const $ = id => document.getElementById(id);
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
  breakMs: 60000, breakOn: false,   // pause off = open pause (∞)
  warnOn: false, countdownOn: false,   // counts off by default
  digits: 'oxanium',                  // clock digits: oxanium | dgt | teko
  sound: true,
  v: 7,
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
cfg.moveCountdownMs = Math.max(10000, cfg.moveCountdownMs);
let s = null;
setMuted(!!cfg.eco || !cfg.sound);

// Round number as shown: without boxing, only chess rounds are counted.
const roundNo = (c, n) => c.boxTimer ? n : Math.ceil(n / 2);

// ── SETUP SCREEN ──
const fmtValue = (v, kind) => kind === 'n' ? String(v)
  : v < 60000 ? `${v / 1000}″` : `${Math.floor(v / 60000)}'${String((v % 60000) / 1000).padStart(2, '0')}`;

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
  { key: 'chessRoundMs', row: 1, icon: () => '♟', label: 'Échecs', step: 10000, min: 30000, max: 600000,
    on: () => cfg.intervals, tap: () => { cfg.intervals = !cfg.intervals; } },
  { key: 'breakMs', row: 1, icon: () => '⏸', label: 'Pause', step: 10000, min: 0, max: 300000,
    on: () => cfg.intervals && cfg.breakOn,
    tap: () => { cfg.breakOn = !(cfg.intervals && cfg.breakOn); if (cfg.breakOn) cfg.intervals = true; } },
  { key: 'boxRoundMs', row: 1, icon: () => '🥊', label: 'Boxe', step: 10000, min: 30000, max: 300000,
    on: () => cfg.intervals && cfg.boxTimer,
    tap: () => { cfg.boxTimer = !(cfg.intervals && cfg.boxTimer); if (cfg.boxTimer) cfg.intervals = true; } },
  { key: 'moveCountdownMs', flag: 'countdownOn', row: 2, icon: () => countHands(8, TILE_HAND), label: 'Compte', step: 5000, min: 10000, max: 180000 },
  { key: 'illegalMoves', flag: 'illegalMoves', row: 2, icon: () => redFlag, label: 'Coups illégaux', noValue: true },
  { key: 'moveWarnMs', flag: 'warnOn', row: 2, icon: () => watch, label: 'Alerte', fixed: true },  // follows the count
];
TILES.filter(t => t.flag).forEach(t => {
  t.on = () => !!cfg[t.flag];
  t.tap = () => { cfg[t.flag] = !cfg[t.flag]; };
});
// Count limits: plain − / + lines, always on.
const LIMITS = [['countsPerRound', '/ round', 1, 10], ['countsTotal', 'total', 1, 20]];
const tileOf = key => TILES.find(t => t.key === key);
// The warning comes 10 s before the count, or 5 s before under 30 s.
const warnFor = countdownMs => countdownMs - (countdownMs >= 30000 ? 10000 : 5000);
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
    case 'moveWarnMs': return on ? `Alerte au bout de ${v} sur un coup (${cfg.moveCountdownMs >= 30000 ? 10 : 5} s avant le compte).` : 'Pas d\'alerte.';
    case 'illegalMoves': return on ? 'Drapeau rouge dans ton coin : coup illégal adverse = 1 compte, il rejoue.' : 'Pas de bouton coup illégal.';
    default: return on ? `Compte de 10 s dès ${v} sur un coup, puis perdu.` : 'Pas de compte.';
  }
}
// Each tile: icon and label (tap = on/off), and on the right a strip
// showing the value like a wheel: press and slide up or down to set it.
const valuesOf = t => { const v = []; for (let x = t.min; x <= t.max; x += t.step) v.push(x); return v; };
function stripHTML(t) {
  if (!t.on() || t.fixed) return `<span class="sv"></span><span class="sv cur">${tileValue(t)}</span><span class="sv"></span>`;
  const vals = valuesOf(t), i = Math.max(0, vals.indexOf(cfg[t.key]));
  const at = k => vals[k] === undefined ? '' : fmtValue(vals[k], t.kind);
  return `<span class="sv">${at(i + 1)}</span><span class="sv cur">${at(i)}</span><span class="sv">${at(i - 1)}</span>`;
}
function renderTiles() {
  cfg.moveWarnMs = warnFor(cfg.moveCountdownMs);
  const html = t => `<div class="dur${t.row === 2 ? ' small' : ''}${t.fixed ? ' linked' : ''}${t.on() ? ' on' : ''}" role="button" tabindex="0" data-tile="${t.key}">
      <div class="dur-body"><i>${t.icon()}</i><small>${t.label}</small></div>
      ${t.noValue ? '' : `<div class="strip" data-strip="${t.key}">${stripHTML(t)}</div>`}</div>`;
  $('durations').innerHTML = TILES.filter(t => t.row === 1).map(html).join('');
  $('chess-set').classList.toggle('dim', !cfg.intervals);  // dimmed, not hidden: nothing moves
  // Under ♟: the count first; once on, the warning and the count limits.
  const count = tileOf('moveCountdownMs'), more = count.on();
  // Secondary setting: one small line, − value + for each limit.
  const limits = more || cfg.illegalMoves ? `<div class="limits"><span class="lim-t">Comptes max</span>${LIMITS.map(([key, label, min, max]) => `
    <span class="lim"><button type="button" data-lim="${key}" data-d="-1"${cfg[key] <= min ? ' disabled' : ''}>−</button><b>${cfg[key]}</b><button type="button" data-lim="${key}" data-d="1"${cfg[key] >= max ? ' disabled' : ''}>+</button><small>${label}</small></span>`).join('')}</div>` : '';
  $('chess-set').innerHTML = html(count) + html(tileOf('illegalMoves')) + (more ? html(tileOf('moveWarnMs')) : '') + limits;
}
function showTileText(t) {
  $('opt-help').hidden = false;
  $('opt-help').textContent = tileText(t);
}
function onTiles(e) {
  if (e.target.closest('[data-strip]')) return;
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
  t.tap();
  save(CFG_KEY, cfg);
  renderSetup();
  showTileText(t);
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

// Icon toggles: sound (🔊 / 🔇) and Éco (battery: no sound, darker, no animations).
const OPTIONS = [
  ['sound', on => (on ? '🔊' : '🔇'), 'Son'],
  ['eco', () => '🔋<small>Éco</small>', 'Éco'],
];

function renderPresets() {
  $('presets').innerHTML = Object.keys(PRESETS).map(r =>
    cfg.intervals
      ? `<button type="button" class="btn preset" data-r="${r}"><b>${r}</b><small>rounds</small><em>${formatClock(playerTime({ ...cfg, rounds: +r })).replace(':', "'")}</em></button>`
      : `<button type="button" class="btn preset classic" data-r="${r}"><b>${formatClock(PRESETS[r]).replace(':', "'")}</b><small>classique</small></button>`).join('');
}

function renderSetup() {
  document.body.className = cfg.eco ? 'eco' : '';
  document.documentElement.dataset.digits = cfg.digits;
  renderPresets();
  // Unchecking the intervals leaves a plain clock: only Éco still applies.
  // A plain clock has no illegal-move card: dimmed, so the layout stays put.
  $('options').innerHTML = OPTIONS.map(([key, icon, label]) => `
    <button type="button" class="opt-icon${cfg[key] ? ' on' : ''}" data-opt="${key}" aria-pressed="${!!cfg[key]}" aria-label="${label}">${icon(cfg[key])}</button>`).join('');
  // Clock digits: the same time shown in each style, one tap to choose.
  $('options').insertAdjacentHTML('beforeend', `<div class="digit-pick">${DIGIT_STYLES.map(d =>
    `<button type="button" class="digit-opt${cfg.digits === d ? ' on' : ''}" data-digits="${d}" aria-label="Chiffres ${d}"><span></span></button>`).join('')}</div>`);
  $('options').querySelectorAll('.digit-opt span').forEach(sp => setDigits(sp, '4:30', sp.parentNode.dataset.digits));
  renderTiles();
  const saved = load(FIGHT_KEY);
  const live = saved && saved.phase !== 'ready' && saved.phase !== 'over';
  $('resume-wrap').hidden = !live;
  // The fight in progress at a glance: White's time, Continue, Black's time.
  if (live) {
    const w = saved.white ?? 0;
    $('btn-resume-saved').innerHTML = `<span class="tw">${formatClock(saved.remaining[w])}</span>
      <b>▶ CONTINUER</b><span class="tb">${formatClock(saved.remaining[1 - w])}</span>`;
  }
}


// A preset button starts the fight straight away.
$('presets').addEventListener('click', e => {
  const b = e.target.closest('[data-r]');
  if (!b) return;
  unlockAudio();
  cfg.rounds = +b.dataset.r;
  save(CFG_KEY, cfg);
  s = newFight(fightConfig());
  openFight();
});
// A plain clock (no intervals) has no counts and no chessboxing options.
const NEVER = 1e9;
function fightConfig() {
  const c = structuredClone(cfg);
  if (!c.intervals) Object.assign(c, { illegalMoves: false, boxTimer: false, warnOn: false, countdownOn: false });
  if (!c.breakOn) c.breakMs = null;
  if (!c.countdownOn) c.warnOn = false;  // the warning comes with the count
  c.moveWarnMs = warnFor(c.moveCountdownMs);
  if (!c.warnOn) c.moveWarnMs = NEVER;
  if (!c.countdownOn) c.moveCountdownMs = NEVER;
  c.moveLimit = c.warnOn || c.countdownOn;
  return c;
}
$('options').addEventListener('click', e => {
  const t = e.target.closest('[data-opt]');
  const d = e.target.closest('[data-digits]');
  if (d) { cfg.digits = d.dataset.digits; save(CFG_KEY, cfg); }
  if (t) {
    cfg[t.dataset.opt] = !cfg[t.dataset.opt];
    save(CFG_KEY, cfg);
    setMuted(!!cfg.eco || !cfg.sound);
  }
  renderSetup();
});
$('btn-reset').addEventListener('click', () => $('btn-defaults').click());
$('btn-defaults').addEventListener('click', () => {
  cfg = { ...homeDefaults(), rounds: cfg.rounds, names: cfg.names, eco: cfg.eco, digits: cfg.digits };
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
function nameOf(p) {
  return s.cfg.names[p] || colourOf(p) || `Joueur ${p + 1}`;
}

const halves = [...document.querySelectorAll('.half')].sort((a, b) => a.dataset.p - b.dataset.p);

function buildHalves() {
  halves.forEach(h => {
    const p = +h.dataset.p;
    h.innerHTML = `<div class="h-in">
      <div class="h-name"></div>
      <div class="h-phase"></div>
      <div class="h-clock"></div>
      <div class="h-move"></div>
      <div class="h-counts"></div>
      <div class="h-avg"></div>
      <div class="h-notice" hidden></div>
      <div class="illegal-wrap"><button type="button" class="illegal-btn" aria-label="Coup illégal adverse">${redFlag}<span>Coup illégal</span></button><button type="button" class="illegal-minus" aria-label="Retirer le coup illégal">−</button></div></div>`;
    h.querySelector('.illegal-btn').addEventListener('pointerdown', e => {
      e.stopPropagation();
      act(illegalMove(s, 1 - p, performance.now()));
      showNotice(1 - p);
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
// Compass in the bar: press and swipe right or left to turn both clocks'
// digits that way, up or down for the usual face-to-face layout. A tap
// goes round the three.
const ORIENTS = ['normal', 'right', 'left'];
function setOrient(o) {
  cfg.orient = o;
  $('fight').dataset.orient = o;
}
setOrient(cfg.orient || 'normal');
let compass = null;
$('bar-compass').addEventListener('pointerdown', e => {
  e.stopPropagation();
  compass = { x: e.clientX, y: e.clientY, moved: false };
  $('bar-compass').setPointerCapture(e.pointerId);
});
$('bar-compass').addEventListener('pointermove', e => {
  if (!compass) return;
  const dx = e.clientX - compass.x, dy = e.clientY - compass.y;
  if (Math.hypot(dx, dy) < 24) return;
  compass.moved = true;
  setOrient(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : 'normal');
});
const compassUp = () => {
  if (!compass) return;
  if (!compass.moved) setOrient(ORIENTS[(ORIENTS.indexOf(cfg.orient) + 1) % ORIENTS.length]);
  compass = null;
  save(CFG_KEY, cfg);
};
$('bar-compass').addEventListener('pointerup', compassUp);
$('bar-compass').addEventListener('pointercancel', compassUp);

// The phone's tilt turns the digits too: right side down = right, left side
// down = left, held upright = face to face. Lying flat on the table changes
// nothing, so the compass choice stays. iOS asks for permission on a tap.
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
  window.addEventListener('devicemotion', onMotion);
  DeviceMotionEvent.requestPermission?.().catch(() => {});  // iOS: asks once, on this tap
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
  roundStart: '#f5c842', roundEnd: '#f5c842', roundTimeUp: '#ff3b3b',
  moveWarn: '#ff9a1f', moveCountdown: '#ff3b3b', count: '#ff3b3b', over: '#ffffff',
  phaseTen: '#4a9eff', breakTen: '#4a9eff', pause: '#2fbf71', resume: '#2fbf71', undo: '#a3a3b8',
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

const METHOD_SHORT = { temps: 'Temps écoulé !', 'réflexion': 'Anti-jeu', decision: 'Fin' };
const methodShort = m => METHOD_SHORT[m] || m.replace(/ dans le round| au total/, '');

function render() {
  if (!s) return;
  const body = document.body;
  const r = s.result;
  const flagScreen = r && r.method !== 'decision';
  body.className = `phase-${s.phase}${s.paused ? ' paused' : ''}${cfg.eco ? ' eco' : ''}${flagScreen ? ' flag' : ''}`;
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
    setDigits(h.querySelector('.h-clock'), formatClock(s.remaining[p]), cfg.digits);
    const phaseEl = h.querySelector('.h-phase');
    phaseEl.textContent = s.phase === 'boxing' ? (untimed ? 'BOXE' : `BOXE ${formatClock(s.phaseRemaining)}`)
      : s.phase === 'break' ? (untimed ? 'PAUSE' : `PAUSE ${formatClock(s.phaseRemaining)}`) : '';
    const move = h.querySelector('.h-move');
    if (active && cd !== null) move.innerHTML = countHands(cd);
    else if (active && stage === 'warn') move.textContent = `${Math.floor(s.moveElapsed / 1000)} s`;
    else if (s.phase === 'ready') move.textContent = '▶ Touche';
    else if (flagScreen && r.loser === p) move.textContent = `⚑ ${methodShort(r.method)}`;
    else if (flagScreen) move.textContent = r.winner === null ? '½' : 'VICTOIRE';
    else move.textContent = '';
    // Colour in big letters; a name only if one was typed in ⚙.
    const icon = s.white === null ? '' : p === s.white ? 'BLANCS' : 'NOIRS';
    h.querySelector('.h-name').textContent = [icon, s.cfg.names[p]].filter(Boolean).join(' · ');
    // Average per move, shown when paused or at the end.
    const avg = averageMove(s, p);
    h.querySelector('.h-avg').textContent = (s.paused || s.phase === 'over') && avg !== null
      ? `⌀ ${(avg / 1000).toFixed(1).replace(".", ",")} s / coup` : '';
    // Counts: nothing until the first one, then one red dot each
    // (bright for this round, dim for earlier rounds).
    const mine = s.counts.filter(c => c.player === p);
    h.querySelector('.h-counts').innerHTML = mine.map(c =>
      `<i class="dot on${c.round === roundForCounts ? '' : ' old'}"></i>`).join('');
    h.querySelector('.illegal-wrap').hidden = !s.cfg.illegalMoves || s.phase !== 'chess' || s.paused;
    h.querySelector('.illegal-minus').hidden = !s.counts.some(c => c.player === 1 - p && c.illegal);
  });

  const roundIcon = roundType(shownRound) === 'chess' ? '♟' : '🥊';
  $('bar-round').textContent = !s.cfg.intervals ? '♟'
    : `${s.phase === 'break' ? '⏸' : roundIcon} ${roundNo(s.cfg, shownRound)}/${roundNo(s.cfg, s.cfg.rounds)}`;
  $('bar-phase').textContent = s.phase === 'ready' ? '1er = NOIRS' : s.phase === 'break' ? `→ ${roundIcon}`
    : flagScreen ? methodShort(r.method)
    : s.roundOver ? 'Temps !' : s.paused ? 'Pause' : '';
  setDigits($('bar-timer'), s.phase === 'ready' || s.phase === 'over' || untimed ? '' : formatClock(s.phaseRemaining), cfg.digits);
  // Lost on time: ↺ Rejouer in the middle of the bar.
  const replay = !!flagScreen && r.method === 'temps';
  $('bar-timer').hidden = replay;
  document.querySelector('.bar-info').hidden = replay;
  $('bar-replay').hidden = !replay;
  document.querySelector('.bar').classList.toggle('alert', s.roundOver && !s.paused && s.phase !== 'over');
  // On the flag screen the bar button carries the one useful action.
  const overAction = flagScreen ? (r.method === 'réflexion' ? 'Continuer' : r.method.includes('comptes') ? 'Annuler' : null) : null;
  $('bar-btn').hidden = s.phase === 'ready' || (s.phase === 'over' && !overAction);
  $('bar-btn').textContent = overAction ? overAction : s.paused ? '▶ GO'
    : untimed && s.phase === 'break' ? `▶ ${roundIcon} ${roundNo(s.cfg, shownRound)}` : s.roundOver ? 'STOP' : 'PAUSE';
  $('bar-btn').classList.toggle('long', $('bar-btn').textContent.length > 6);
  $('bar-btn').classList.toggle('go', untimed && s.phase === 'break' && !s.paused);

  $('pause-menu').hidden = !(s.paused && s.phase !== 'over') || !$('end-menu').hidden;
  if (!$('pause-menu').hidden) renderPauseMenu();
  renderResult();
}

// Pause menu: big Continue, ↺ restart from zero (tap twice), ⌂ home.
function renderPauseMenu() {
  const next = nextChessRound(s);
  $('pm-next').hidden = next === null;
  if (next !== null) $('pm-next').textContent = `♟ Round ${roundNo(s.cfg, next)} ▶`;
}
$('pm-next').addEventListener('click', () => act(goToNextChess(s, performance.now())));

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
(function loop() {
  if (s && !$('fight').hidden) {
    const ev = tick(s, performance.now());
    if (ev.length) act(ev);
    else render();
    persist(false);
  }
  setTimeout(loop, cfg.eco ? 250 : 100);
})();

// ── SCREEN ON + INSTALL ──
let wakeLock = null;
async function requestWakeLock() {
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
    // Released by the system (battery saver…): ask again while the clock is shown.
    wakeLock?.addEventListener('release', () => {
      if (document.visibilityState === 'visible' && !$('fight').hidden) requestWakeLock();
    });
  } catch { /* not supported */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && s && !$('fight').hidden) requestWakeLock();
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
  const v = keys.find(k => k.startsWith('pendule-'));
  if (v) $('version').textContent = '· ' + v.replace('pendule-', '');
}).catch(() => {});
