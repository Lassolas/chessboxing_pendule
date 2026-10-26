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

export function defaultConfig() {
  return {
    rounds: 7,
    names: ['', ''],       // optional, by half of the screen
    chessRoundMs: 3 * 60000,
    boxRoundMs: 3 * 60000,
    breakMs: 60000,
    intervals: true,        // coached 3-min chess rounds; false = plain clock
    autoStop: false,        // end the chess round on its own after chessRoundMs
    boxTimer: false,        // time the breaks and the boxing round
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
    remaining: [PRESETS[cfg.rounds], PRESETS[cfg.rounds]],
    moveElapsed: 0,
    phaseRemaining: cfg.intervals ? cfg.chessRoundMs : null,
    roundOver: false,      // chess round time is up but autoStop is off
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

function startPhase(s, round, events) {
  s.round = round;
  s.roundOver = false;
  if (roundType(round) === 'chess') {
    s.phase = 'chess';
    s.phaseRemaining = s.cfg.intervals ? s.cfg.chessRoundMs : null;
    s.moveElapsed = 0;
  } else {
    s.phase = 'boxing';
    // Without boxTimer the coach times boxing and breaks: no countdown here.
    s.phaseRemaining = s.cfg.boxTimer ? s.cfg.boxRoundMs : null;
  }
  events.push('roundStart');
}

function endRound(s, events) {
  events.push('roundEnd');
  if (s.round >= s.cfg.rounds) {
    finish(s, null, 'decision', events);
    return;
  }
  if (!s.cfg.boxTimer) {
    // No timed breaks: boxing is followed straight by the next chess round,
    // and chess by an untimed boxing phase that covers boxing and breaks.
    if (s.phase === 'boxing') { events.pop(); startPhase(s, s.round + 1, events); return; }
    s.round += 1;
    s.phase = 'boxing';
    s.phaseRemaining = null;
    s.roundOver = false;
    return;
  }
  s.phase = 'break';
  s.nextRound = s.round + 1;
  s.phaseRemaining = s.cfg.breakMs;
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
    if (r0 > 0 && s.phaseRemaining === 0) {
      if (s.cfg.autoStop) endRound(s, events);
      else { s.roundOver = true; events.push('roundTimeUp'); }
    }
    return events;
  }

  if (s.phaseRemaining === null) return events;
  const r0 = s.phaseRemaining;
  s.phaseRemaining = Math.max(0, r0 - dt);
  if (crossedSecond(r0, s.phaseRemaining, 10) === 10) events.push(s.phase === 'break' ? 'breakTen' : 'phaseTen');
  if (s.phaseRemaining === 0) {
    if (s.phase === 'break') startPhase(s, s.nextRound, events);
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
  // Chess round time is up (no auto stop): the pause button ends the round.
  if (s.phase === 'chess' && s.roundOver && !s.paused) {
    const events = [];
    endRound(s, events);
    s.lastTick = now;
    return events;
  }
  s.paused = !s.paused;
  s.lastTick = now;
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

// Skip straight to the next chess round, running.
export function goToNextChess(s, now) {
  tick(s, now);
  const target = nextChessRound(s);
  if (target === null) return [];
  const events = [];
  startPhase(s, target, events);
  s.paused = false;
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
  const max = PRESETS[s.cfg.rounds] * 2;
  s.remaining[player] = Math.min(max, Math.max(1000, s.remaining[player] + deltaMs));
  return [];
}

export function formatClock(ms) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60), sec = total % 60;
  if (ms < 10000 && ms > 0) return (ms / 1000).toFixed(1);
  return `${m}:${String(sec).padStart(2, '0')}`;
}
