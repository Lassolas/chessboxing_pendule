// Chessboxing clock: pure state machine, no DOM. Every function takes the
// current time `now` (ms) so the logic can be tested without real timers.
// Rounds alternate chess / boxing, starting and ending with chess, with a
// break between rounds. Players are the two halves of the screen (0 = bottom,
// 1 = top); the first one to press takes Black, which starts White's clock.

export const PRESETS = {
  5: 4.5 * 60000,
  7: 6 * 60000,
  9: 7.5 * 60000,
  11: 9 * 60000,
};

// Thinking time per player: half of all the chess rounds (rounds 1, 3, 5…),
// so a shorter chess round gives a shorter clock. A plain clock keeps the
// preset times.
export function playerTime(cfg) {
  if (!cfg.intervals) return PRESETS[cfg.rounds];
  return Math.ceil(cfg.rounds / 2) * cfg.chessRoundMs / 2;
}

export function defaultConfig() {
  return {
    rounds: 5,
    names: ['', ''],       // optional, by half of the screen
    chessRoundMs: 3 * 60000,
    boxRoundMs: 3 * 60000,
    breakMs: null,          // null = open pause (∞): the coach starts the next round; 0 = no pause
    intervals: true,        // coached 3-min chess rounds; false = plain clock
    boxTimer: true,         // timed boxing rounds between the pauses
    readyCheck: true,       // "Prêt ?" before each chess round after a timed pause
    illegalMoves: false,    // yellow card to claim an illegal move
    moveLimit: true,        // per-move thinking limit
    moveWarnMs: 20000,      // warning colour + sound
    moveCountdownMs: 30000, // countdown starts
    moveGraceMs: 10000,     // the count: always 10 s, then the game is lost
    countsPerRound: 3,      // counts in one chess round that lose the fight
    countsTotal: 4,         // counts in the whole fight that lose it
  };
}

export function roundType(round) {
  return round % 2 === 1 ? 'chess' : 'boxing';
}

export function newFight(cfg) {
  return {
    cfg,
    phase: 'ready',        // ready | chess | break | boxing | over
    round: 1,
    nextRound: 1,          // round that follows the current break
    paused: false,
    white: null,           // player with White, set by the first press
    turn: null,
    remaining: [playerTime(cfg), playerTime(cfg)],
    moveElapsed: 0,
    phaseRemaining: cfg.intervals ? cfg.chessRoundMs : null,
    roundOver: false,      // last round reopened after the decision
    counts: [],            // {player, round, illegal}: move countdowns and illegal moves
    moves: [0, 0],         // moves played, for the average time per move
    spent: [0, 0],         // thinking time of those moves
    curMove: 0,            // thinking time of the move in progress
    result: null,          // {winner, loser, method, prev}
    lastTick: null,
  };
}

export function isRunning(s) {
  return !s.paused && (s.phase === 'chess' || s.phase === 'break' || s.phase === 'boxing');
}

export function moveStage(s) {
  if (!s.cfg.moveLimit || s.phase !== 'chess') return 'ok';
  if (s.moveElapsed >= s.cfg.moveCountdownMs) return 'countdown';
  if (s.moveElapsed >= s.cfg.moveWarnMs) return 'warn';
  return 'ok';
}

// Seconds left in the per-move countdown (10..1), or null outside it.
export function moveCountdownLeft(s) {
  if (moveStage(s) !== 'countdown') return null;
  return Math.max(0, Math.ceil((s.cfg.moveCountdownMs + s.cfg.moveGraceMs - s.moveElapsed) / 1000));
}

export function countsOf(s, player, round = null) {
  return s.counts.filter(c => c.player === player && (round === null || c.round === round)).length;
}

function finish(s, loser, method, events) {
  s.result = {
    winner: loser === null ? null : 1 - loser,
    loser,
    method,
    prev: { phase: s.phase, paused: s.paused },
  };
  s.phase = 'over';
  events.push('over');
}

// `auto`: the round follows a timed pause on its own. A chess round then
// waits on "Prêt ?" (the boxers need time to take their gloves off).
function startPhase(s, round, events, auto = false) {
  s.round = round;
  s.roundOver = false;
  s.awaitReady = false;
  if (roundType(round) === 'chess') {
    s.phase = 'chess';
    if (auto && round > 1 && s.cfg.readyCheck) {
      s.paused = true;
      s.awaitReady = true;
    }
    // The last chess round lasts as long as the players' clocks.
    s.phaseRemaining = s.cfg.intervals && round + 2 <= s.cfg.rounds ? s.cfg.chessRoundMs : null;
    s.moveElapsed = 0;
  } else {
    s.phase = 'boxing';
    s.phaseRemaining = s.cfg.boxRoundMs;
  }
  events.push(s.awaitReady ? 'ready' : 'roundStart');
}

// Every round ends on a pause (timed, or open until the coach restarts).
// Without boxing, the pause leads straight to the next chess round.
function endRound(s, events) {
  events.push('roundEnd');
  if (s.round >= s.cfg.rounds) {
    finish(s, null, 'decision', events);
    return;
  }
  const skipBoxing = s.phase === 'chess' && !s.cfg.boxTimer;
  const next = s.round + (skipBoxing ? 2 : 1);
  if (s.cfg.breakMs === 0) { startPhase(s, next, events, true); return; }  // no pause
  s.phase = 'break';
  s.nextRound = next;
  s.phaseRemaining = s.cfg.breakMs ?? null;
  s.roundOver = false;
}

// Crossing a whole-second mark between two remaining times.
function crossedSecond(before, after, max) {
  const b = Math.ceil(before / 1000), a = Math.ceil(after / 1000);
  return a < b && a <= max && a >= 1 ? a : null;
}

// Advance the clocks to `now`. Returns a list of events for sounds/colours.
export function tick(s, now) {
  const events = [];
  if (s.lastTick === null || !isRunning(s)) { s.lastTick = now; return events; }
  const dt = Math.max(0, now - s.lastTick);
  s.lastTick = now;
  if (dt === 0) return events;

  if (s.phase === 'chess') {
    const p = s.turn;
    const before = s.remaining[p];
    s.remaining[p] = Math.max(0, before - dt);
    if (crossedSecond(before, s.remaining[p], 10)) events.push('clockLow');
    if (s.remaining[p] === 0) { finish(s, p, 'temps', events); return events; }

    const m0 = s.moveElapsed;
    s.moveElapsed += dt;
    s.curMove = (s.curMove || 0) + dt;
    const c = s.cfg;
    if (c.moveLimit) {
      if (m0 < c.moveWarnMs && s.moveElapsed >= c.moveWarnMs) events.push('moveWarn');
      if (m0 < c.moveCountdownMs && s.moveElapsed >= c.moveCountdownMs) {
        events.push('moveCountdown');
        if (giveCount(s, p, false, events)) return events;
      }
      const limit = c.moveCountdownMs + c.moveGraceMs;
      if (s.moveElapsed > c.moveCountdownMs && m0 < limit) {
        const sec = crossedSecond(limit - Math.max(m0, c.moveCountdownMs), limit - s.moveElapsed, 9);
        if (sec) events.push('moveTick');
      }
      if (s.moveElapsed >= limit) { finish(s, p, 'réflexion', events); return events; }
    }

    if (s.phaseRemaining === null) return events;  // plain clock: no rounds
    const r0 = s.phaseRemaining;
    s.phaseRemaining = Math.max(0, r0 - dt);
    if (crossedSecond(r0, s.phaseRemaining, 10) === 10) events.push('phaseTen');
    if (r0 > 0 && s.phaseRemaining === 0) endRound(s, events);
    return events;
  }

  if (s.phaseRemaining === null) return events;
  const r0 = s.phaseRemaining;
  s.phaseRemaining = Math.max(0, r0 - dt);
  if (crossedSecond(r0, s.phaseRemaining, 10) === 10) events.push(s.phase === 'break' ? 'breakTen' : 'phaseTen');
  if (s.phaseRemaining === 0) {
    if (s.phase === 'break') startPhase(s, s.nextRound, events, true);
    else endRound(s, events);
  }
  return events;
}

// `black` pressed first: they take Black and White's clock starts.
export function start(s, now, black) {
  const events = [];
  if (s.phase !== 'ready') return events;
  s.white = 1 - black;
  s.turn = s.white;
  s.lastTick = now;
  startPhase(s, 1, events);
  return events;
}

// The player whose clock runs taps their side to end their move.
export function press(s, player, now) {
  if (s.phase === 'ready') return start(s, now, player);
  tick(s, now);
  if (s.phase !== 'chess' || s.paused || player !== s.turn) return [];
  s.moves ??= [0, 0]; s.spent ??= [0, 0];
  s.moves[player] += 1;
  s.spent[player] += s.curMove || 0;
  s.curMove = 0;
  s.turn = 1 - player;
  s.moveElapsed = 0;
  return ['press'];
}

export function togglePause(s, now) {
  tick(s, now);
  if (s.phase === 'ready' || s.phase === 'over') return [];
  // Fight reopened after the last round: the pause button ends it again.
  if (s.phase === 'chess' && s.roundOver && !s.paused) {
    const events = [];
    endRound(s, events);
    s.lastTick = now;
    return events;
  }
  s.lastTick = now;
  // "Prêt ?" answered: the chess round starts, with the bell.
  if (s.awaitReady && s.paused) {
    s.awaitReady = false;
    s.paused = false;
    return ['roundStart'];
  }
  s.paused = !s.paused;
  return [s.paused ? 'pause' : 'resume'];
}

// Jump to the next phase now (end the chess round, skip a break...).
export function skipPhase(s, now) {
  tick(s, now);
  const events = [];
  if (s.phase === 'chess' || s.phase === 'boxing') endRound(s, events);
  else if (s.phase === 'break') startPhase(s, s.nextRound, events);
  s.lastTick = now;
  return events;
}

// Average thinking time per move of `player` (ms), or null before their first
// move. The move in progress counts once it takes longer than the average.
export function averageMove(s, player) {
  const moves = s.moves?.[player] || 0;
  let spent = s.spent?.[player] || 0, n = moves;
  const cur = s.turn === player ? s.curMove || 0 : 0;
  if (cur > 0 && (n === 0 || cur > spent / n)) { spent += cur; n += 1; }
  return n ? spent / n : null;
}

// The chess round the coach can jump to from here, or null after the last one.
export function nextChessRound(s) {
  const r = s.phase === 'break' ? s.nextRound : s.phase === 'chess' ? s.round + 1 : s.round;
  const target = roundType(r) === 'chess' ? r : r + 1;
  return !s.cfg.intervals || s.phase === 'ready' || s.phase === 'over' || target > s.cfg.rounds ? null : target;
}

// The step that follows the current one, in fight order: chess round →
// pause → boxing → pause → chess…, or null after the last round.
export function nextStep(s) {
  if (!s.cfg.intervals || s.phase === 'ready' || s.phase === 'over') return null;
  if (s.phase === 'break') return { phase: roundType(s.nextRound), round: s.nextRound };
  if (s.round >= s.cfg.rounds) return null;
  const next = s.round + (s.phase === 'chess' && !s.cfg.boxTimer ? 2 : 1);
  if (s.cfg.breakMs === 0) return { phase: roundType(next), round: next };
  return { phase: 'break', round: next };
}

// Jump to that step now, running.
export function goToNextStep(s, now) {
  if (!nextStep(s)) return [];
  const events = skipPhase(s, now);
  s.paused = false;
  s.awaitReady = false;
  s.lastTick = now;
  return events;
}

// Skip straight to the next chess round, running.
export function goToNextChess(s, now) {
  tick(s, now);
  const target = nextChessRound(s);
  if (target === null) return [];
  const events = [];
  startPhase(s, target, events);
  s.paused = false;
  s.awaitReady = false;
  s.lastTick = now;
  return events;
}

// A count against `player`, in the current chess round. Returns true when
// it loses the fight.
function giveCount(s, player, illegal, events) {
  s.counts.push({ player, round: s.round, illegal });
  events.push('count');
  if (countsOf(s, player, s.round) >= s.cfg.countsPerRound) {
    finish(s, player, `${s.cfg.countsPerRound} comptes dans le round`, events);
  } else if (countsOf(s, player) >= s.cfg.countsTotal) {
    finish(s, player, `${s.cfg.countsTotal} comptes au total`, events);
  } else return false;
  return true;
}

// An illegal move by `player`, claimed by the opponent: it counts as a count
// and the offender takes the move back and plays again.
export function illegalMove(s, player, now) {
  tick(s, now);
  if (s.phase !== 'chess') return [];
  const events = [];
  if (s.turn !== player) {
    s.turn = player;
    s.moveElapsed = 0;
  }
  giveCount(s, player, true, events);
  return events;
}

export function undoCount(s, now) {
  tick(s, now);
  if (!s.counts.length) return [];
  s.counts.pop();
  if (s.result && s.result.method.includes('comptes')) reopen(s, now);
  return ['undo'];
}

// Take back the last illegal move given against `player` (a mistaken tap).
export function removeIllegal(s, player, now) {
  tick(s, now);
  const i = s.counts.findLastIndex(c => c.player === player && c.illegal);
  if (i < 0) return [];
  s.counts.splice(i, 1);
  if (s.result && s.result.method.includes('comptes')) reopen(s, now);
  return ['undo'];
}

// Leave the result screen and carry on, paused. After a per-move timeout
// the move timer starts again from zero.
export function reopen(s, now) {
  if (!s.result) return [];
  const prev = s.result.prev;
  if (s.result.method === 'réflexion') s.moveElapsed = 0;
  if (s.result.method === 'temps') return [];
  if (s.result.method === 'decision') {
    s.phase = 'chess';
    s.roundOver = true;
  } else {
    s.phase = prev.phase;
  }
  s.result = null;
  s.paused = true;
  s.lastTick = now;
  return ['pause'];
}

export function endFight(s, winner, method, now) {
  tick(s, now);
  if (s.phase === 'ready') return [];
  const events = [];
  if (s.phase === 'over') s.phase = s.result.prev.phase;
  finish(s, winner === null ? null : 1 - winner, method, events);
  return events;
}

export function adjustTime(s, player, deltaMs, now) {
  tick(s, now);
  const max = playerTime(s.cfg) * 2;
  s.remaining[player] = Math.min(max, Math.max(1000, s.remaining[player] + deltaMs));
  return [];
}

// Rounded down, like a real clock: 4:30 becomes 4:29 the moment it starts.
export function formatClock(ms) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60), sec = total % 60;
  if (ms < 10000 && ms > 0) return (Math.floor(ms / 100) / 10).toFixed(1);
  return `${m}:${String(sec).padStart(2, '0')}`;
}
