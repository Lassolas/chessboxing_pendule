import {
  PRESETS, defaultConfig, newFight, tick, start, press, togglePause, skipPhase,
  illegalMove, undoCount, reopen, endFight, adjustTime, moveStage, moveCountdownLeft,
  countsOf, roundType, formatClock,
} from './clock.js';
import { unlockAudio, play } from './sound.js';

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
let s = null;

// ── SETUP SCREEN ──
const NUM_FIELDS = {
  chessRound: ['chessRoundMs', 60000],
  boxRound: ['boxRoundMs', 60000],
  break: ['breakMs', 1000],
  moveWarn: ['moveWarnMs', 1000],
  moveCountdown: ['moveCountdownMs', 1000],
  moveGrace: ['moveGraceMs', 1000],
  countsPerRound: ['countsPerRound', 1],
  countsTotal: ['countsTotal', 1],
};

function renderSetup() {
  $('presets').innerHTML = Object.keys(PRESETS).map(r =>
    `<button type="button" class="btn preset${+r === cfg.rounds ? ' sel' : ''}" data-r="${r}">
      <b>${r}</b><small>rounds · ${formatClock(PRESETS[r])}</small></button>`).join('');
  $('name-0').value = cfg.names[0] === 'Blancs' ? '' : cfg.names[0];
  $('name-1').value = cfg.names[1] === 'Noirs' ? '' : cfg.names[1];
  $('opt-autopause').checked = cfg.autoPause;
  $('opt-movelimit').checked = cfg.moveLimit;
  for (const [id, [key, unit]] of Object.entries(NUM_FIELDS)) {
    $('cfg-' + id).value = cfg[key] / unit;
    document.querySelectorAll(`[data-v="${id}"]`).forEach(el => { el.textContent = cfg[key] / unit; });
  }
  const saved = load(FIGHT_KEY);
  $('btn-resume-saved').hidden = !(saved && saved.phase !== 'ready' && saved.phase !== 'over');
}

function readSetup() {
  cfg.names = [$('name-0').value.trim() || 'Blancs', $('name-1').value.trim() || 'Noirs'];
  cfg.autoPause = $('opt-autopause').checked;
  cfg.moveLimit = $('opt-movelimit').checked;
  for (const [id, [key, unit]] of Object.entries(NUM_FIELDS)) {
    const v = parseFloat($('cfg-' + id).value);
    if (v > 0) cfg[key] = Math.round(v * unit);
  }
  if (cfg.moveCountdownMs < cfg.moveWarnMs) cfg.moveCountdownMs = cfg.moveWarnMs;
  save(CFG_KEY, cfg);
}

$('presets').addEventListener('click', e => {
  const b = e.target.closest('[data-r]');
  if (!b) return;
  readSetup();
  cfg.rounds = +b.dataset.r;
  save(CFG_KEY, cfg);
  renderSetup();
});
$('setup').addEventListener('change', () => { readSetup(); renderSetup(); });
$('btn-defaults').addEventListener('click', () => {
  cfg = { ...defaultConfig(), rounds: cfg.rounds, names: cfg.names };
  save(CFG_KEY, cfg);
  renderSetup();
});
$('btn-start').addEventListener('click', () => {
  unlockAudio();
  readSetup();
  s = newFight(structuredClone(cfg));
  openFight();
});
$('btn-resume-saved').addEventListener('click', () => {
  unlockAudio();
  s = load(FIGHT_KEY);
  s.paused = true;
  s.lastTick = performance.now();
  openFight();
});

// Sound and colour test, one after the other.
$('btn-test-sound').addEventListener('click', () => {
  unlockAudio();
  const steps = [['roundStart', '#f5c842'], ['moveWarn', '#ff9a1f'], ['moveCountdown', '#ff3b3b'], ['count', '#ff3b3b']];
  steps.forEach(([ev, color], i) => setTimeout(() => { play(ev); flash(color); }, i * 1400));
});

// ── FIGHT SCREEN ──
const halves = [...document.querySelectorAll('.half')].sort((a, b) => a.dataset.p - b.dataset.p);

function buildHalves() {
  halves.forEach(h => {
    const p = +h.dataset.p;
    h.innerHTML = `
      <div class="h-name">${p === 0 ? '♔' : '♚'} ${escapeHtml(s.cfg.names[p])}</div>
      <div class="h-phase"></div>
      <div class="h-clock"></div>
      <div class="h-move"></div>
      <div class="h-counts">
        <span>Round<span class="dots" data-k="round"></span></span>
        <span>Total<span class="dots" data-k="total"></span></span>
      </div>
      <button type="button" class="yellow-card" aria-label="Coup illégal adverse" title="Coup illégal adverse"></button>`;
    h.querySelector('.yellow-card').addEventListener('pointerdown', e => {
      e.stopPropagation();
      act(illegalMove(s, 1 - p, performance.now()));
      showToast(`Coup illégal de ${s.cfg.names[1 - p]} : 1 compte`);
    });
  });
}

halves.forEach(h => h.addEventListener('pointerdown', e => {
  if (e.target.closest('button')) return;
  act(press(s, +h.dataset.p, performance.now()));
}));

$('bar-btn').addEventListener('click', () => {
  unlockAudio();
  if (s.phase === 'ready') act(start(s, performance.now()));
  else if (s.phase === 'boxing' && s.phaseRemaining === null) act(skipPhase(s, performance.now()));
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

function openFight() {
  $('setup').hidden = true;
  $('fight').hidden = false;
  buildHalves();
  requestWakeLock();
  document.documentElement.requestFullscreen?.().catch(() => {});
  render();
}

function closeFight() {
  save(FIGHT_KEY, null);
  s = null;
  ['fight', 'pause-menu', 'end-menu', 'result'].forEach(id => { $(id).hidden = true; });
  $('setup').hidden = false;
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
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
    if (FLASH[ev]) flash(FLASH[ev]);
  }
  if (events.includes('over')) $('result').classList.add('loss-flash');
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

function dots(n, max) {
  return Array.from({ length: max }, (_, i) => `<i class="dot${i < n ? ' on' : ''}"></i>`).join('');
}

const PHASE_LABEL = { ready: 'Prêt', chess: 'Échecs', boxing: 'Boxe', break: 'Pause', over: 'Terminé' };

function render() {
  if (!s) return;
  const body = document.body;
  body.className = `phase-${s.phase}${s.paused ? ' paused' : ''}`;
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
    h.querySelector('.h-clock').textContent = formatClock(s.remaining[p]);
    const phaseEl = h.querySelector('.h-phase');
    phaseEl.textContent = s.phase === 'boxing' ? (untimed ? 'BOXE' : `BOXE ${formatClock(s.phaseRemaining)}`)
      : s.phase === 'break' ? `PAUSE ${formatClock(s.phaseRemaining)}` : '';
    const move = h.querySelector('.h-move');
    if (active && cd !== null) move.textContent = cd;
    else if (active && s.cfg.moveLimit) move.textContent = `Coup : ${Math.floor(s.moveElapsed / 1000)} s`;
    else move.textContent = '';
    h.querySelector('[data-k=round]').innerHTML = dots(countsOf(s, p, roundForCounts), s.cfg.countsPerRound);
    h.querySelector('[data-k=total]').innerHTML = dots(countsOf(s, p), s.cfg.countsTotal);
    h.querySelector('.yellow-card').hidden = s.phase !== 'chess' || s.paused;
  });

  $('bar-round').textContent = `Round ${shownRound}/${s.cfg.rounds}`;
  $('bar-phase').textContent = s.phase === 'break'
    ? `Pause → ${roundType(s.nextRound) === 'chess' ? 'échecs' : 'boxe'}`
    : s.roundOver ? 'Temps du round !' : (s.paused ? 'En pause' : PHASE_LABEL[s.phase]);
  $('bar-timer').textContent = s.phase === 'ready' ? formatClock(s.cfg.chessRoundMs) : untimed ? '' : formatClock(s.phaseRemaining);
  document.querySelector('.bar').classList.toggle('alert', s.roundOver && !s.paused);
  $('bar-btn').textContent = s.phase === 'ready' ? '▶ GO' : s.paused ? '▶ REPRENDRE'
    : untimed && s.phase === 'boxing' ? `▶ ROUND ${s.round + 1}` : 'PAUSE';
  $('bar-btn').classList.toggle('go', untimed && s.phase === 'boxing' && !s.paused);

  $('pause-menu').hidden = !(s.paused && s.phase !== 'over') || !$('end-menu').hidden;
  if (!$('pause-menu').hidden) renderPauseMenu();
  renderResult();
}

function renderPauseMenu() {
  const next = s.phase === 'break' ? s.nextRound : s.round + 1;
  const skip = $('pm-skip');
  if (s.phase === 'break') skip.textContent = `Lancer le round ${next} (${roundType(next) === 'chess' ? 'échecs' : 'boxe'})`;
  else if (s.round >= s.cfg.rounds) skip.textContent = 'Fin du dernier round';
  else if (s.phase === 'boxing' && !s.cfg.autoPause) skip.textContent = `Lancer le round ${s.round + 1} (échecs)`;
  else skip.textContent = `Terminer le round ${s.round} → ${s.cfg.autoPause ? 'pause' : 'boxe'}`;
  $('pm-undo').hidden = !s.counts.length;
  $('pm-adjust').innerHTML = [0, 1].map(p => `
    <span>${escapeHtml(s.cfg.names[p])} <b>${formatClock(s.remaining[p])}</b></span>
    <button type="button" class="btn" data-adj="${p}" data-d="-10000">−10 s</button>
    <button type="button" class="btn" data-adj="${p}" data-d="10000">+10 s</button>`).join('');
}

$('pm-resume').addEventListener('click', () => act(togglePause(s, performance.now())));
$('pm-skip').addEventListener('click', () => {
  const ev = skipPhase(s, performance.now());
  if (s.phase !== 'over') { s.paused = false; s.lastTick = performance.now(); }
  act(ev);
});
$('pm-undo').addEventListener('click', () => act(undoCount(s, performance.now())));
$('pm-adjust').addEventListener('click', e => {
  const b = e.target.closest('[data-adj]');
  if (b) act(adjustTime(s, +b.dataset.adj, +b.dataset.d, performance.now()));
});
$('pm-new').addEventListener('click', () => {
  if (confirm('Abandonner ce combat et revenir aux réglages ?')) closeFight();
});

// ── MANUAL END ──
const METHODS = ['Échec et mat', 'Abandon', 'KO', "Arrêt de l'arbitre", 'Décision des juges', 'Disqualification', 'Nulle'];
let endChoice = { winner: undefined, method: null };

function openEndMenu() {
  endChoice = { winner: undefined, method: null };
  $('end-menu').hidden = false;
  $('pause-menu').hidden = true;
  renderEndMenu();
}
function renderEndMenu() {
  const opts = [[0, s.cfg.names[0]], [1, s.cfg.names[1]], [null, 'Match nul']];
  $('end-winner').innerHTML = opts.map(([w, label]) =>
    `<button type="button" class="btn${endChoice.winner === w ? ' sel' : ''}" data-w="${w}">${escapeHtml(label)}</button>`).join('');
  $('end-method').innerHTML = METHODS.map(m =>
    `<button type="button" class="btn${endChoice.method === m ? ' sel' : ''}" data-m="${m}">${m}</button>`).join('');
  $('end-ok').disabled = endChoice.winner === undefined || !endChoice.method;
}
$('pm-end').addEventListener('click', openEndMenu);
$('res-decide').addEventListener('click', () => { $('result').hidden = true; openEndMenu(); });
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
const METHOD_TEXT = {
  temps: 'Drapeau tombé (temps écoulé)',
  'réflexion': 'Temps de réflexion dépassé',
  decision: 'Fin du dernier round',
};
function renderResult() {
  const r = s.result;
  $('result').hidden = !r || !$('end-menu').hidden;
  if (!r) { $('result').classList.remove('loss-flash'); return; }
  const undecided = r.method === 'decision';
  $('res-kicker').textContent = undecided ? 'FIN DU COMBAT' : r.winner === null ? 'MATCH NUL' : 'VICTOIRE';
  $('res-name').textContent = undecided ? 'Décision' : r.winner === null ? '' : s.cfg.names[r.winner];
  $('res-method').textContent = METHOD_TEXT[r.method] || r.method;
  $('res-detail').textContent = undecided ? 'Personne ne gagne par mat, KO ou temps : désigne le vainqueur.'
    : r.loser === null ? '' : `${s.cfg.names[r.loser]} perd · round ${s.round}/${s.cfg.rounds}`
      + ` · comptes ${countsOf(s, 0)} - ${countsOf(s, 1)}`;
  $('res-continue').hidden = r.method !== 'réflexion';
  $('res-undo').hidden = !r.method.includes('comptes');
  $('res-decide').hidden = !undecided;
}
$('res-continue').addEventListener('click', () => act(reopen(s, performance.now())));
$('res-undo').addEventListener('click', () => act(undoCount(s, performance.now())));
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
setInterval(() => {
  if (!s || $('fight').hidden) return;
  const ev = tick(s, performance.now());
  if (ev.length) act(ev);
  else render();
  persist(false);
}, 100);

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
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

function escapeHtml(t) {
  return String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

renderSetup();
