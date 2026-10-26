import {
  PRESETS, playerTime, defaultConfig, newFight, tick, start, press, togglePause, skipPhase,
  illegalMove, undoCount, averageMove, nextChessRound, goToNextChess, reopen, endFight, moveStage, moveCountdownLeft,
  countsOf, roundType, formatClock,
} from './clock.js';
import { unlockAudio, play, setMuted } from './sound.js';
import { countHands, handSVG, REFEREE } from './hands.js';

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
  warnOn: true, countdownOn: true, perRoundOn: true, totalOn: true,
  v: 4,
});
let cfg = { ...homeDefaults(), ...(load(CFG_KEY) || {}) };
cfg.names = cfg.names.map(n => (n === 'Blancs' || n === 'Noirs' ? '' : n));
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
let s = null;
setMuted(!!cfg.eco);

// Round number as shown: without boxing, only chess rounds are counted.
const roundNo = (c, n) => c.boxTimer ? n : Math.ceil(n / 2);

// ── SETUP SCREEN ──
const fmtValue = (v, kind) => kind === 'n' ? String(v) : v === 0 ? '∞'
  : v < 60000 ? `${v / 1000}″` : `${Math.floor(v / 60000)}'${String((v % 60000) / 1000).padStart(2, '0')}`;

// Home tiles. A tap switches the tile on or off; when on, ✎ opens a wheel.
// Row 1: the fight (chess rounds, pause, boxing). Row 2, under ♟ when it is
// on: the anti-play settings. The icons are the signs seen during the fight.
const watch = `<svg viewBox="0 0 32 32" class="ico"><circle cx="16" cy="18" r="11" fill="none" stroke="#ff9a1f" stroke-width="3"/><rect x="13" y="2" width="6" height="4" rx="1" fill="#ff9a1f"/><path d="M16 18 L16 11" stroke="#ff9a1f" stroke-width="3" stroke-linecap="round"/><path d="M25 8 l3-3" stroke="#ff9a1f" stroke-width="3" stroke-linecap="round"/></svg>`;
// Own gradient id: the fight's hands use #skin, and an id inside the hidden
// home screen would leave them without fill.
const TILE_HAND = { ...REFEREE, fill: 'url(#skin-tile)', defs: REFEREE.defs.replace('id="skin"', 'id="skin-tile"') };
const dots = n => `<span class="ico-dots">${'<span></span>'.repeat(Math.min(n, 5))}</span>`;
// key: value in cfg, on/tap: state, icon, label, wheel step/min/max, kind
const TILES = [
  { key: 'chessRoundMs', row: 1, icon: () => '♟', label: 'Échecs', step: 30000, min: 30000, max: 600000,
    on: () => cfg.intervals, tap: () => { cfg.intervals = !cfg.intervals; } },
  { key: 'breakMs', row: 1, icon: () => '⏸', label: 'Pause', step: 15000, min: 15000, max: 300000,
    on: () => cfg.intervals && cfg.breakOn,
    tap: () => { cfg.breakOn = !(cfg.intervals && cfg.breakOn); if (cfg.breakOn) cfg.intervals = true; } },
  { key: 'boxRoundMs', row: 1, icon: () => '🥊', label: 'Boxe', step: 30000, min: 30000, max: 300000,
    on: () => cfg.intervals && cfg.boxTimer,
    tap: () => { cfg.boxTimer = !(cfg.intervals && cfg.boxTimer); if (cfg.boxTimer) cfg.intervals = true; } },
  { key: 'moveWarnMs', flag: 'warnOn', row: 2, icon: () => watch, label: 'Alerte', step: 5000, min: 5000, max: 120000 },
  { key: 'moveCountdownMs', flag: 'countdownOn', row: 2, icon: () => handSVG(5, TILE_HAND), label: 'Compte', step: 5000, min: 5000, max: 180000 },
  { key: 'countsPerRound', flag: 'perRoundOn', row: 2, icon: () => dots(cfg.countsPerRound), label: '/ round', step: 1, min: 1, max: 10, kind: 'n' },
  { key: 'countsTotal', flag: 'totalOn', row: 2, icon: () => dots(cfg.countsTotal), label: 'Total', step: 1, min: 1, max: 20, kind: 'n' },
];
TILES.filter(t => t.flag).forEach(t => {
  t.on = () => !!cfg[t.flag];
  t.tap = () => { cfg[t.flag] = !cfg[t.flag]; };
});
const tileOf = key => TILES.find(t => t.key === key);
const tileValue = t => t.key === 'breakMs' && !t.on() ? '∞' : fmtValue(cfg[t.key], t.kind);
const ROW = 52;  // wheel row height, as in style.css

// One line on what a tile does now.
function tileText(t) {
  const v = fmtValue(cfg[t.key], t.kind), on = t.on();
  switch (t.key) {
    case 'chessRoundMs': return on ? `Rounds d'échecs de ${v}.` : 'Pendule classique, sans rounds.';
    case 'breakMs': return on ? `Pauses de ${v}.` : 'Pause libre : tu relances le round.';
    case 'boxRoundMs': return on ? `Round de boxe chronométré de ${v} entre deux pauses.` : 'Pas de round de boxe.';
    case 'moveWarnMs': return on ? `Alerte au bout de ${v} sur un coup.` : 'Pas d\'alerte.';
    case 'moveCountdownMs': return on ? `Compte de 10 s dès ${v} sur un coup, puis perdu.` : 'Pas de compte.';
    case 'countsPerRound': return on ? `${v} comptes dans un round : perdu.` : 'Pas de limite par round.';
    default: return on ? `${v} comptes au total : perdu.` : 'Pas de limite au total.';
  }
}
function renderTiles() {
  const html = t => `<div class="dur${t.row === 2 ? ' small' : ''}${t.on() ? ' on' : ''}" role="button" tabindex="0" data-tile="${t.key}">
      <i>${t.icon()}</i><b>${tileValue(t)}</b><small>${t.label}</small>
      ${t.on() ? `<button type="button" class="edit" data-edit="${t.key}" aria-label="Modifier">✎</button>` : ''}</div>`;
  $('durations').innerHTML = TILES.filter(t => t.row === 1).map(html).join('');
  $('chess-set').classList.toggle('dim', !cfg.intervals);  // dimmed, not hidden: nothing moves
  $('chess-set').innerHTML = TILES.filter(t => t.row === 2).map(html).join('');
}
function onTiles(e) {
  const edit = e.target.closest('[data-edit]');
  if (edit) { openWheel(edit.dataset.edit); return; }
  const el = e.target.closest('[data-tile]');
  if (!el) return;
  const t = tileOf(el.dataset.tile);
  t.tap();
  if (t.key === 'breakMs' && t.on() && !cfg.breakMs) cfg.breakMs = 60000;
  save(CFG_KEY, cfg);
  helpShown = null;
  renderSetup();
  $('opt-help').hidden = false;
  $('opt-help').textContent = tileText(t);
}
$('durations').addEventListener('click', onTiles);
$('chess-set').addEventListener('click', onTiles);

let wheelKey = null, wheelValues = [];
function openWheel(key) {
  const t = tileOf(key);
  wheelKey = key;
  wheelValues = [];
  for (let v = t.min; v <= t.max; v += t.step) wheelValues.push(v);
  $('wheel-title').innerHTML = `<span class="wt-ico">${t.icon()}</span> ${t.label}`;
  $('wheel-list').innerHTML = wheelValues.map((v, i) => `<div class="wheel-item" data-i="${i}">${fmtValue(v, t.kind)}</div>`).join('');
  $('wheel').hidden = false;
  $('wheel-list').scrollTop = Math.max(0, wheelValues.indexOf(cfg[key])) * ROW;
  markWheel();
}
const wheelIndex = () => Math.min(wheelValues.length - 1, Math.max(0, Math.round($('wheel-list').scrollTop / ROW)));
function markWheel() {
  const i = wheelIndex();
  $('wheel-list').querySelectorAll('.wheel-item').forEach(el => el.classList.toggle('sel', +el.dataset.i === i));
}
$('wheel-list').addEventListener('scroll', markWheel, { passive: true });
$('wheel-list').addEventListener('click', e => {
  const it = e.target.closest('.wheel-item');
  if (it) $('wheel-list').scrollTo({ top: +it.dataset.i * ROW, behavior: 'smooth' });
});
function closeWheel() {
  cfg[wheelKey] = wheelValues[wheelIndex()];
  // The count cannot start before the warning.
  if (wheelKey === 'moveWarnMs' && cfg.moveCountdownMs < cfg.moveWarnMs) cfg.moveCountdownMs = cfg.moveWarnMs;
  if (wheelKey === 'moveCountdownMs' && cfg.moveWarnMs > cfg.moveCountdownMs) cfg.moveWarnMs = cfg.moveCountdownMs;
  save(CFG_KEY, cfg);
  $('wheel').hidden = true;
  renderSetup();
  $('opt-help').hidden = false;
  $('opt-help').textContent = tileText(tileOf(wheelKey));
}
$('wheel-ok').addEventListener('click', closeWheel);
// A tap outside the wheel validates too.
$('wheel').addEventListener('click', e => { if (!e.target.closest('.wheel-panel')) closeWheel(); });

// One or two words per option; the "?" shows the explanation.
const OPTIONS = [
  ['illegalMoves', 'Coups illégaux', () => `Carton jaune dans ton coin : coup illégal adverse = 1 compte, il rejoue.`],
  ['eco', 'Éco', () => `Économie d'énergie : pas de son (vibrations seulement), écran plus sombre, pas d'animations.`],
];
let helpShown = null;

function renderSetup() {
  document.body.className = cfg.eco ? 'eco' : '';
  $('presets').innerHTML = Object.keys(PRESETS).map(r =>
    cfg.intervals
      ? `<button type="button" class="btn preset" data-r="${r}"><b>${r}</b><small>rounds</small><em>${formatClock(playerTime({ ...cfg, rounds: +r })).replace(':', "'")}</em></button>`
      : `<button type="button" class="btn preset classic" data-r="${r}"><b>${formatClock(PRESETS[r]).replace(':', "'")}</b><small>classique</small></button>`).join('');
  // Unchecking the intervals leaves a plain clock: only Éco still applies.
  // A plain clock has no illegal-move card: dimmed, so the layout stays put.
  $('options').innerHTML = OPTIONS.map(([key, label]) => `
    <div class="opt${cfg[key] ? ' on' : ''}${!cfg.intervals && key !== 'eco' ? ' dim' : ''}">
      <button type="button" class="opt-toggle" data-opt="${key}"><span class="box">${cfg[key] ? '✓' : ''}</span>${label}</button>
      <button type="button" class="opt-q${helpShown === key ? ' sel' : ''}" data-help="${key}" aria-label="Explication">?</button>
    </div>`).join('');
  const help = OPTIONS.find(o => o[0] === helpShown);
  $('opt-help').hidden = !help;
  if (help) $('opt-help').textContent = help[2]();
  $('name-0').value = cfg.names[0];
  $('name-1').value = cfg.names[1];
  renderTiles();
  const saved = load(FIGHT_KEY);
  const live = saved && saved.phase !== 'ready' && saved.phase !== 'over';
  $('btn-resume-saved').hidden = !live;
  // The fight in progress at a glance: White's time, Continue, Black's time.
  if (live) {
    const w = saved.white ?? 0;
    $('btn-resume-saved').innerHTML = `<span class="tw">${formatClock(saved.remaining[w])}</span>
      <b>▶ CONTINUER</b><span class="tb">${formatClock(saved.remaining[1 - w])}</span>`;
  }
}

function readSetup() {
  cfg.names = [$('name-0').value.trim(), $('name-1').value.trim()];
  save(CFG_KEY, cfg);
}

// A preset button starts the fight straight away.
$('presets').addEventListener('click', e => {
  const b = e.target.closest('[data-r]');
  if (!b) return;
  unlockAudio();
  readSetup();
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
  if (!c.breakOn) c.breakMs = 0;
  if (!c.warnOn) c.moveWarnMs = NEVER;
  if (!c.countdownOn) c.moveCountdownMs = NEVER;
  c.moveLimit = c.warnOn || c.countdownOn;
  if (!c.perRoundOn) c.countsPerRound = 999;
  if (!c.totalOn) c.countsTotal = 999;
  return c;
}
$('options').addEventListener('click', e => {
  const t = e.target.closest('[data-opt]');
  const q = e.target.closest('[data-help]');
  if (t) {
    cfg[t.dataset.opt] = !cfg[t.dataset.opt];
    save(CFG_KEY, cfg);
    setMuted(!!cfg.eco);
  }
  if (q) helpShown = helpShown === q.dataset.help ? null : q.dataset.help;
  renderSetup();
});
$('setup').addEventListener('change', () => { readSetup(); renderSetup(); });
$('btn-reset').addEventListener('click', () => $('btn-defaults').click());
$('btn-defaults').addEventListener('click', () => {
  cfg = { ...homeDefaults(), rounds: cfg.rounds, names: cfg.names, eco: cfg.eco };
  save(CFG_KEY, cfg);
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
    h.innerHTML = `
      <div class="h-name"></div>
      <div class="h-phase"></div>
      <div class="h-clock"></div>
      <div class="h-move"></div>
      <div class="h-counts"></div>
      <div class="h-avg"></div>
      <button type="button" class="yellow-card" aria-label="Coup illégal adverse" title="Coup illégal adverse"></button>`;
    h.querySelector('.yellow-card').addEventListener('pointerdown', e => {
      e.stopPropagation();
      act(illegalMove(s, 1 - p, performance.now()));
      showToast(`🟨 ${nameOf(1 - p)} +1`);
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

let toastTimer = null;
function showToast(text) {
  if (s.phase === 'over') return;
  $('toast-text').textContent = text;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4000);
}
$('toast-undo').addEventListener('click', () => {
  $('toast').hidden = true;
  act(undoCount(s, performance.now()));
});

const METHOD_SHORT = { temps: 'Drapeau', 'réflexion': 'Anti-jeu', decision: 'Fin' };
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
    h.querySelector('.h-clock').textContent = formatClock(s.remaining[p]);
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
    h.querySelector('.yellow-card').hidden = !s.cfg.illegalMoves || s.phase !== 'chess' || s.paused;
  });

  const roundIcon = roundType(shownRound) === 'chess' ? '♟' : '🥊';
  $('bar-round').textContent = !s.cfg.intervals ? '♟'
    : `${s.phase === 'break' ? '⏸' : roundIcon} ${roundNo(s.cfg, shownRound)}/${roundNo(s.cfg, s.cfg.rounds)}`;
  $('bar-phase').textContent = s.phase === 'ready' ? '1er = NOIRS' : s.phase === 'break' ? `→ ${roundIcon}`
    : flagScreen ? methodShort(r.method)
    : s.roundOver ? 'Temps !' : s.paused ? 'Pause' : '';
  $('bar-timer').textContent = s.phase === 'ready' || s.phase === 'over' || untimed ? '' : formatClock(s.phaseRemaining);
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
let restartTimer = null;
$('pm-restart').addEventListener('click', () => {
  const b = $('pm-restart');
  if (!b.classList.contains('confirm')) {
    b.classList.add('confirm');
    b.textContent = '↺ Sûr ?';
    clearTimeout(restartTimer);
    restartTimer = setTimeout(() => { b.classList.remove('confirm'); b.textContent = '↺ Rejouer'; }, 3000);
    return;
  }
  clearTimeout(restartTimer);
  b.classList.remove('confirm');
  b.textContent = '↺ Rejouer';
  s = newFight(structuredClone(s.cfg));
  buildHalves();
  act(['undo']);
});
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
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* not supported */ }
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
  if (v) $('version').textContent = 'Version ' + v.replace('pendule-', '');
}).catch(() => {});
