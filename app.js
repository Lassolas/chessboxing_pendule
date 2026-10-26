import {
  PRESETS, defaultConfig, newFight, tick, start, press, togglePause, skipPhase,
  illegalMove, undoCount, averageMove, nextChessRound, goToNextChess, reopen, endFight, moveStage, moveCountdownLeft,
  countsOf, roundType, formatClock,
} from './clock.js';
import { unlockAudio, play, setMuted } from './sound.js';

const $ = id => document.getElementById(id);
const CFG_KEY = 'pendule-cb-config';
const FIGHT_KEY = 'pendule-cb-fight';

function load(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
}

let cfg = { ...defaultConfig(), ...(load(CFG_KEY) || {}) };
cfg.names = cfg.names.map(n => (n === 'Blancs' || n === 'Noirs' ? '' : n));
cfg.moveGraceMs = 10000;  // the count always lasts 10 s
if (!cfg.v || cfg.v < 2) {  // v2: illegal moves off by default
  cfg.illegalMoves = false;
  cfg.v = 2;
}
if ('autoPause' in cfg) {  // older versions had one option for both
  cfg.autoStop = cfg.boxTimer = cfg.autoPause;
  delete cfg.autoPause;
}
let s = null;
setMuted(!!cfg.eco);

// ── SETUP SCREEN ──
// ⚙ settings: one stepper per value. [key, icon, label, step, min, max, kind]
const STEPPERS = [
  ['chessRoundMs', '♟', 'Round', 30000, 30000, 600000, 'time'],
  ['boxRoundMs', '🥊', 'Round', 30000, 30000, 300000, 'time'],
  ['breakMs', '⏸', 'Pause', 15000, 15000, 300000, 'time'],
  ['moveWarnMs', '⏱', 'Alerte', 5000, 5000, 120000, 'time'],
  ['moveCountdownMs', '⏱', 'Compte dès', 5000, 5000, 180000, 'time'],
  ['countsPerRound', '⚑', '/ round', 1, 1, 10, 'n'],
  ['countsTotal', '⚑', 'Total', 1, 1, 20, 'n'],
];
const fmtValue = (v, kind) => kind === 'n' ? String(v)
  : v < 60000 ? `${v / 1000} s` : `${Math.floor(v / 60000)}'${String((v % 60000) / 1000).padStart(2, '0')}`;

function renderSteppers() {
  $('steppers').innerHTML = STEPPERS.map(([key, icon, label, , min, max, kind]) => `
    <div class="stepper">
      <span class="st-label"><i>${icon}</i>${label}</span>
      <button type="button" data-step="${key}" data-dir="-1"${cfg[key] <= min ? ' disabled' : ''}>−</button>
      <b>${fmtValue(cfg[key], kind)}</b>
      <button type="button" data-step="${key}" data-dir="1"${cfg[key] >= max ? ' disabled' : ''}>+</button>
    </div>`).join('');
}
$('steppers').addEventListener('click', e => {
  const b = e.target.closest('[data-step]');
  if (!b) return;
  const [key, , , step, min, max] = STEPPERS.find(x => x[0] === b.dataset.step);
  cfg[key] = Math.min(max, Math.max(min, cfg[key] + step * +b.dataset.dir));
  if (cfg.moveCountdownMs < cfg.moveWarnMs) cfg.moveCountdownMs = cfg.moveWarnMs;
  save(CFG_KEY, cfg);
  renderSetup();
});

// One or two words per option; the "?" shows the explanation.
const OPTIONS = [
  ['intervals', 'Intervalles 3 min', () => `Combat coaché : rounds d'échecs de ${cfg.chessRoundMs / 60000} min, comptes et options ci-dessous. Décoché : pendule classique, rien d'autre.`],
  ['illegalMoves', 'Coups illégaux', () => `Carton jaune dans ton coin : coup illégal adverse = 1 compte, il rejoue.`],
  ['autoStop', 'Auto rounds', () => `Round d'échecs stoppé à ${cfg.chessRoundMs / 60000} min. Sinon : alerte, tu stoppes.`],
  ['moveLimit', 'Anti-jeu', () => `${cfg.moveWarnMs / 1000} s : alerte. ${cfg.moveCountdownMs / 1000} s : compte de 10 s, puis perdu. ${cfg.countsPerRound} comptes / round ou ${cfg.countsTotal} au total : perdu.`],
  ['boxTimer', 'Timer boxe', () => `Pause ${cfg.breakMs / 1000} s + boxe ${cfg.boxRoundMs / 60000} min chronométrées. Sinon : tu relances.`],
  ['eco', 'Éco', () => `Économie d'énergie : pas de son (vibrations seulement), écran plus sombre, pas d'animations.`],
];
let helpShown = null;

function renderSetup() {
  document.body.className = cfg.eco ? 'eco' : '';
  $('presets').innerHTML = Object.keys(PRESETS).map(r =>
    cfg.intervals
      ? `<button type="button" class="btn preset" data-r="${r}"><b>${r}</b><small>rounds</small><em>${formatClock(PRESETS[r]).replace(':', "'")}</em></button>`
      : `<button type="button" class="btn preset" data-r="${r}"><b>${formatClock(PRESETS[r]).replace(':', "'")}</b><small>classique</small></button>`).join('');
  // Unchecking the intervals leaves a plain clock: only Éco still applies.
  const shown = OPTIONS.filter(([key]) => cfg.intervals || key === 'intervals' || key === 'eco');
  $('options').innerHTML = shown.map(([key, label]) => `
    <div class="opt${cfg[key] ? ' on' : ''}">
      <button type="button" class="opt-toggle" data-opt="${key}"><span class="box">${cfg[key] ? '✓' : ''}</span>${label}</button>
      <button type="button" class="opt-q${helpShown === key ? ' sel' : ''}" data-help="${key}" aria-label="Explication">?</button>
    </div>`).join('');
  const help = OPTIONS.find(o => o[0] === helpShown);
  $('opt-help').hidden = !help;
  if (help) $('opt-help').textContent = help[2]();
  $('name-0').value = cfg.names[0];
  $('name-1').value = cfg.names[1];
  renderSteppers();
  const saved = load(FIGHT_KEY);
  const live = saved && saved.phase !== 'ready' && saved.phase !== 'over';
  $('btn-resume-saved').hidden = !live;
  // The fight in progress at a glance: White's time, Continue, Black's time.
  if (live) {
    const w = saved.white ?? 0;
    $('btn-resume-saved').innerHTML = `<span><small>BLANCS</small>${formatClock(saved.remaining[w])}</span>
      <b>▶ CONTINUER</b><span><small>NOIRS</small>${formatClock(saved.remaining[1 - w])}</span>`;
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
function fightConfig() {
  const c = structuredClone(cfg);
  if (!c.intervals) Object.assign(c, { moveLimit: false, illegalMoves: false, autoStop: false, boxTimer: false });
  return c;
}
$('options').addEventListener('click', e => {
  const t = e.target.closest('[data-opt]');
  const q = e.target.closest('[data-help]');
  if (t) { cfg[t.dataset.opt] = !cfg[t.dataset.opt]; save(CFG_KEY, cfg); setMuted(!!cfg.eco); }
  if (q) helpShown = helpShown === q.dataset.help ? null : q.dataset.help;
  renderSetup();
});
$('setup').addEventListener('change', () => { readSetup(); renderSetup(); });
$('btn-defaults').addEventListener('click', () => {
  cfg = { ...defaultConfig(), rounds: cfg.rounds, names: cfg.names };
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
  const steps = [['press', '#2fbf71'], ['roundStart', '#f5c842'], ['phaseTen', '#4a9eff'], ['moveWarn', '#ff9a1f'], ['moveCountdown', '#ff3b3b'], ['count', '#ff3b3b'], ['roundEnd', '#f5c842'], ['over', '#ffffff']];
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
  if (s.phase === 'boxing' && s.phaseRemaining === null) act(skipPhase(s, performance.now()));
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
  phaseTen: '#4a9eff', pause: '#2fbf71', resume: '#2fbf71', undo: '#a3a3b8',
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
      : s.phase === 'break' ? `PAUSE ${formatClock(s.phaseRemaining)}` : '';
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
  $('bar-round').textContent = !s.cfg.intervals ? '♟' : `${s.phase === 'break' ? '⏸' : roundIcon} ${shownRound}/${s.cfg.rounds}`;
  $('bar-phase').textContent = s.phase === 'ready' ? '1er = NOIRS' : s.phase === 'break' ? `→ ${roundIcon}`
    : flagScreen ? methodShort(r.method)
    : s.roundOver ? 'Temps !' : s.paused ? 'Pause' : '';
  $('bar-timer').textContent = s.phase === 'ready' || s.phase === 'over' || untimed ? '' : formatClock(s.phaseRemaining);
  document.querySelector('.bar').classList.toggle('alert', s.roundOver && !s.paused && s.phase !== 'over');
  // On the flag screen the bar button carries the one useful action.
  const overAction = flagScreen ? (r.method === 'réflexion' ? 'Continuer' : r.method.includes('comptes') ? 'Annuler' : null) : null;
  $('bar-btn').hidden = s.phase === 'ready' || (s.phase === 'over' && !overAction);
  $('bar-btn').textContent = overAction ? overAction : s.paused ? '▶ GO'
    : untimed && s.phase === 'boxing' ? `▶ ROUND ${s.round + 1}` : s.roundOver ? 'STOP' : 'PAUSE';
  $('bar-btn').classList.toggle('long', $('bar-btn').textContent.length > 6);
  $('bar-btn').classList.toggle('go', untimed && s.phase === 'boxing' && !s.paused);

  $('pause-menu').hidden = !(s.paused && s.phase !== 'over') || !$('end-menu').hidden;
  if (!$('pause-menu').hidden) renderPauseMenu();
  renderResult();
}

// Pause menu: big Continue, ↺ restart from zero (tap twice), ⌂ home.
function renderPauseMenu() {
  const next = nextChessRound(s);
  $('pm-next').hidden = next === null;
  if (next !== null) $('pm-next').textContent = `♟ Round ${next} ▶`;
}
$('pm-next').addEventListener('click', () => act(goToNextChess(s, performance.now())));

$('pm-resume').addEventListener('click', () => act(togglePause(s, performance.now())));
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

// The referee's count shown with hands: two hands of five fingers, 10 → 0.
function hand(fingers, mirror) {
  // Index, middle, ring, little finger, then the thumb.
  const xs = [30, 44, 58, 72];
  const f = xs.map((x, i) => {
    const up = fingers > i;
    return `<rect x="${x - 6}" y="${up ? 8 : 50}" width="12" height="${up ? 60 : 18}" rx="6"/>`;
  }).join('');
  const thumb = fingers >= 5
    ? '<rect x="16" y="50" width="13" height="48" rx="6.5" transform="rotate(-32 22 98)"/>'
    : '<rect x="12" y="66" width="12" height="22" rx="6" transform="rotate(-50 18 88)"/>';
  return `<svg viewBox="-24 0 124 120" class="hand"${mirror ? ' style="transform:scaleX(-1)"' : ''}>
    ${f}${thumb}<rect x="20" y="58" width="64" height="56" rx="18"/></svg>`;
}
function countHands(n) {
  return `<span class="hands">${hand(Math.min(n, 5), false)}${hand(Math.max(n - 5, 0), true)}</span>`;
}

function escapeHtml(t) {
  return String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

renderSetup();
caches?.keys?.().then(keys => {
  const v = keys.find(k => k.startsWith('pendule-'));
  if (v) $('version').textContent = 'Version ' + v.replace('pendule-', '');
}).catch(() => {});
