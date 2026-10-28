import {
  PRESETS, playerTime, defaultConfig, newFight, tick, start, press, togglePause, skipPhase,
  illegalMove, removeIllegal, undoCount, averageMove, nextChessRound, goToNextChess, nextStep, goToNextStep, reopen, endFight, moveStage, moveCountdownLeft,
  countsOf, roundType, formatClock,
} from './clock.js';
import { unlockAudio, play, setMuted } from './sound.js';
import { countHands } from './hands.js';
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
  sound: true,
  v: 9,
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
if (!DIGIT_STYLES.includes(cfg.digits)) cfg.digits = 'dgt';  // Teko was dropped
cfg.moveCountdownMs = Math.max(10000, cfg.moveCountdownMs);
let s = null;
setMuted(!!cfg.eco || !cfg.sound);

// Round number as shown: without boxing, only chess rounds are counted.
const roundNo = (c, n) => c.boxTimer ? n : Math.ceil(n / 2);

// ── SETUP SCREEN ──
const fmtValue = (v, kind) => kind === 'n' ? String(v)
  : `${Math.floor(v / 60000)}:${String(Math.round((v % 60000) / 1000)).padStart(2, '0')}`;  // durations as m:ss (3:00, 0:30)

// ── RÉGLAGES ──
// One calm list: a row per setting, a switch on the right, − value + where
// there is a value. One tap each, nothing to slide, no colour but the text.
// The illegal-move flag, as seen in the fight.
const redFlag = `<svg viewBox="0 0 32 32" class="ico"><path d="M7 3 V30" stroke="#ff3b3b" stroke-width="3" stroke-linecap="round"/><path d="M8 4 H26 L21 10 L26 16 H8 Z" fill="#ff3b3b"/></svg>`;
const warnFor = countdownMs => countdownMs - 5000;  // the warning always comes 5 s before the count
const LIMITS = [['countsPerRound', '/ round', 1, 10], ['countsTotal', 'total', 1, 20]];
// key in cfg, its switch (on / flip), label, icon, − / + steps
const ROWS = {
  chess: { key: 'chessRoundMs', label: 'Échecs', icon: () => ICONS.pawn, step: 10000, min: 30000, max: 600000,
    on: () => cfg.intervals, flip: () => { cfg.intervals = !cfg.intervals; } },
  box: { key: 'boxRoundMs', label: 'Boxe', icon: () => ICONS.glove, step: 10000, min: 30000, max: 300000,
    on: () => cfg.intervals && cfg.boxTimer, flip: () => { cfg.boxTimer = !(cfg.intervals && cfg.boxTimer); if (cfg.boxTimer) cfg.intervals = true; } },
  pause: { key: 'breakMs', label: 'Pause', icon: () => ICONS.hourglass, step: 10000, min: 0, max: 300000, offValue: '∞',
    on: () => cfg.intervals && cfg.breakOn, flip: () => { cfg.breakOn = !(cfg.intervals && cfg.breakOn); if (cfg.breakOn) cfg.intervals = true; } },
  count: { key: 'moveCountdownMs', label: 'Compte', step: 5000, min: 10000, max: 180000,
    on: () => cfg.countdownOn, flip: () => { cfg.countdownOn = !cfg.countdownOn; cfg.warnOn = cfg.countdownOn; } },  // the warning comes with the count
  illegal: { label: 'Coups illégaux', on: () => cfg.illegalMoves, flip: () => { cfg.illegalMoves = !cfg.illegalMoves; } },
  ready: { label: 'Prêt ?', on: () => cfg.readyCheck, flip: () => { cfg.readyCheck = !cfg.readyCheck; } },
  sound: { label: 'Son', on: () => cfg.sound && !cfg.eco, flip: () => { cfg.sound = !(cfg.sound && !cfg.eco); if (cfg.sound) cfg.eco = false; } },
  eco: { label: 'Éco', on: () => cfg.eco, flip: () => { cfg.eco = !cfg.eco; cfg.sound = !cfg.eco; } },  // Éco mutes; leaving it brings the sound back
};
const stepper = (key, v, min, max, step, text) => `<span class="rg-step">
  <button type="button" data-step="${key}" data-d="${-step}" data-min="${min}" data-max="${max}"${v <= min ? ' disabled' : ''} aria-label="Moins">−</button>
  <b>${text}</b>
  <button type="button" data-step="${key}" data-d="${step}" data-min="${min}" data-max="${max}"${v >= max ? ' disabled' : ''} aria-label="Plus">+</button></span>`;
// Chess, boxing, pause side by side: tap the icon = on / off, − value + below.
function cell(id) {
  const r = ROWS[id], on = r.on(), dim = id !== 'chess' && !cfg.intervals;
  return `<div class="rg-cell${on ? ' on' : ''}${dim ? ' dim' : ''}">
    <button type="button" class="rg-cell-t" data-sw="${id}" aria-pressed="${on}">${r.icon()}<small>${r.label}</small></button>
    ${on ? stepper(r.key, cfg[r.key], r.min, r.max, r.step, fmtValue(cfg[r.key])) : `<span class="rg-off">${r.offValue || '—'}</span>`}</div>`;
}
// A word that lights up when on.
const chip = id => `<button type="button" class="rg-chip${ROWS[id].on() ? ' on' : ''}" data-sw="${id}" aria-pressed="${ROWS[id].on()}">${ROWS[id].label}</button>`;
const iconChip = (id, html) => `<button type="button" class="rg-chip ic-only${ROWS[id].on() ? ' on' : ''}" data-sw="${id}" aria-pressed="${ROWS[id].on()}" aria-label="${ROWS[id].label}">${html}</button>`;
const seg = (name, items, cur) => `<div class="rg-seg">${items.map(([v, html, label]) =>
  `<button type="button" data-${name}="${v}" class="${v === cur ? 'on' : ''}" aria-label="${label}">${html}</button>`).join('')}</div>`;
const ORIENT_PICK = [
  ['normal', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M7 8l5-5 5 5M7 16l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>', 'Face à face'],
  ['right', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h18M16 7l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>', 'Côté droit'],
  ['left', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12H3M8 7l-5 5 5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>', 'Côté gauche'],
];
function renderSettings() {
  cfg.moveWarnMs = warnFor(cfg.moveCountdownMs);
  const rounds = Object.keys(PRESETS).map(r => [r, cfg.intervals ? roman(+r) : `<span class="rg-t">${formatClock(PRESETS[r])}</span>`, `${r} rounds`]);
  const counts = cfg.countdownOn || cfg.illegalMoves;
  const arbiter = cfg.intervals ? `<div class="rg-line rg-chips">${chip('count')}${chip('illegal')}${chip('ready')}</div>
    ${cfg.countdownOn ? `<div class="rg-line"><span class="rg-k">Compte dès</span>${stepper('moveCountdownMs', cfg.moveCountdownMs, ROWS.count.min, ROWS.count.max, ROWS.count.step, fmtValue(cfg.moveCountdownMs))}</div>` : ''}
    ${counts ? `<div class="rg-line"><span class="rg-k">Max</span>${LIMITS.map(([key, label, min, max]) => `<span class="rg-lim">${stepper(key, cfg[key], min, max, 1, cfg[key])}<small>${label}</small></span>`).join('')}</div>` : ''}` : '';
  $('rg').innerHTML = `
    <div class="rg-line">${seg('r', rounds, String(cfg.rounds))}<button type="button" class="rg-std" data-act="std">${ICONS.replay}<small>Standard</small></button></div>
    <div class="rg-cells">${cell('chess')}${cell('box')}${cell('pause')}</div>
    ${arbiter}
    <div class="rg-line rg-dev">${iconChip('sound', cfg.sound && !cfg.eco ? ICONS.sound : ICONS.mute)}${iconChip('eco', ICONS.eco)}<span class="rg-sp"></span>${seg('orient', ORIENT_PICK, cfg.orient || 'normal')}</div>
    <div class="rg-line">${seg('digits', DIGIT_STYLES.map(d => [d, '<span class="rg-dg"></span>', `Chiffres ${d}`]), cfg.digits)}<button type="button" class="rg-test" data-act="test" aria-label="Test son">${ICONS.bell}</button></div>`;
  $('rg').querySelectorAll('[data-digits] .rg-dg').forEach(sp => setDigits(sp, '4:30', sp.parentNode.dataset.digits));
}
$('rg').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  const d = b.dataset;
  if (d.sw) {
    ROWS[d.sw].flip();
    if (d.sw === 'eco') updateMotion();
    setMuted(!!cfg.eco || !cfg.sound);
  } else if (d.step) {
    cfg[d.step] = Math.min(+d.max, Math.max(+d.min, cfg[d.step] + +d.d));
  } else if (d.r) cfg.rounds = +d.r;
  else if (d.orient) setOrient(d.orient);
  else if (d.digits) cfg.digits = d.digits;
  else if (d.act === 'std') cfg = { ...homeDefaults(), readyCheck: true, names: cfg.names, eco: cfg.eco, sound: cfg.sound, digits: cfg.digits, orient: cfg.orient };
  else if (d.act === 'test') { testSound(); return; }
  save(CFG_KEY, cfg);
  renderSetup();
});

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
  $('fight-sum').innerHTML = parts.join('');
}

function renderSetup() {
  document.body.className = cfg.eco ? 'eco' : '';
  document.documentElement.dataset.digits = cfg.digits;
  renderSummary();
  renderSettings();
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

// COMBAT: the fight as set, straight away.
$('btn-fight').addEventListener('click', () => {
  unlockAudio();
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
function testSound() {
  unlockAudio();
  const steps = [['press', '#2fbf71'], ['roundStart', '#f5c842'], ['phaseTen', '#4a9eff'], ['breakTen', '#4a9eff'], ['moveWarn', '#ff9a1f'], ['moveCountdown', '#ff3b3b'], ['count', '#ff3b3b'], ['roundEnd', '#f5c842'], ['over', '#ffffff']];
  steps.forEach(([ev, color], i) => setTimeout(() => { play(ev); flash(color); }, i * 1400));
}

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
  const v = keys.find(k => k.startsWith('chessboxing-pendule-'));
  if (v) $('version').textContent = '· ' + v.replace('chessboxing-pendule-', '');
}).catch(() => {});
