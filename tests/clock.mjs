// Checks the chessboxing clock state machine (clock.js).
// Usage: node tests/clock.mjs (also run by npm test)

import {
  defaultConfig, newFight, tick, start, press, togglePause, skipPhase,
  illegalMove, undoCount, reopen, moveStage, moveCountdownLeft, countsOf,
} from '../clock.js';

const errors = [];
const check = (cond, msg) => { if (!cond) errors.push(msg); };

function fight(over = {}) {
  const s = newFight({ ...defaultConfig(), ...over });
  start(s, 0);
  return s;
}
// Advance in 100 ms steps like the app, collecting events.
function run(s, from, to) {
  const events = [];
  for (let t = from + 100; t <= to; t += 100) events.push(...tick(s, t));
  return events;
}

// Presets: time per player
for (const [r, min] of [[5, 4.5], [7, 6], [9, 7.5], [11, 9]]) {
  const s = newFight({ ...defaultConfig(), rounds: r });
  check(s.remaining[0] === min * 60000 && s.remaining[1] === min * 60000, `preset ${r} rounds should give ${min} min`);
}

// Clock runs for the player to move, press switches it
{
  const s = fight({ moveLimit: false });
  run(s, 0, 5000);
  check(s.remaining[0] === 6 * 60000 - 5000 && s.remaining[1] === 6 * 60000, 'white clock runs first');
  press(s, 1, 5000);
  check(s.turn === 0, 'pressing the other side does nothing');
  press(s, 0, 5000);
  run(s, 5000, 8000);
  check(s.remaining[1] === 6 * 60000 - 3000, 'black clock runs after white presses');
  togglePause(s, 8000);
  run(s, 8000, 20000);
  check(s.remaining[1] === 6 * 60000 - 3000, 'pause freezes the clock');
  togglePause(s, 20000);
  run(s, 20000, 21000);
  check(s.remaining[1] === 6 * 60000 - 4000, 'clock resumes after pause');
}

// Per-move limit: warn at 20 s, countdown at 30 s, loss at 40 s, continue on request
{
  const s = fight();
  let ev = run(s, 0, 20000);
  check(ev.includes('moveWarn') && moveStage(s) === 'warn', 'warning at 20 s');
  ev = run(s, 20000, 30000);
  check(ev.includes('moveCountdown') && moveCountdownLeft(s) === 10, 'countdown starts at 30 s');
  check(countsOf(s, 0) === 1, 'a countdown is a count');
  ev = run(s, 30000, 39900);
  check(ev.filter(e => e === 'moveTick').length === 9, 'one tick per countdown second');
  ev = run(s, 39900, 40000);
  check(s.phase === 'over' && s.result.loser === 0 && s.result.method === 'réflexion', 'game lost after 30 + 10 s');
  reopen(s, 40000);
  check(s.phase === 'chess' && s.paused && s.moveElapsed === 0, 'continue anyway reopens the game, paused');
  togglePause(s, 41000);
  run(s, 41000, 60000);
  check(s.phase === 'chess', 'move timer restarted from zero after continuing');
}

// Move timer resets on press
{
  const s = fight();
  run(s, 0, 25000);
  press(s, 0, 25000);
  check(s.moveElapsed === 0 && moveStage(s) === 'ok', 'move timer resets after the move');
}

// Auto-stop and boxing timer off: round time up is signalled but clocks keep running;
// boxing is untimed and the coach starts the next chess round
{
  const s = fight({ moveLimit: false });
  const ev = run(s, 0, 180000);
  check(ev.includes('roundTimeUp') && s.phase === 'chess' && s.roundOver, 'manual mode: alert at 3 min, no pause');
  skipPhase(s, 180000);
  check(s.phase === 'boxing' && s.round === 2 && s.phaseRemaining === null, 'manual mode: untimed boxing');
  run(s, 180000, 900000);
  check(s.phase === 'boxing', 'manual mode: boxing waits for the coach');
  skipPhase(s, 900000);
  check(s.phase === 'chess' && s.round === 3 && s.moveElapsed === 0, 'manual mode: next chess round, move timer at zero');
}

// Auto-stop and boxing timer on: chess -> break -> boxing -> break -> chess, clocks frozen outside chess
{
  const s = fight({ moveLimit: false, autoStop: true, boxTimer: true });
  for (let t = 0; t < 180000; t += 15000) { run(s, t, t + 15000); press(s, s.turn, t + 15000); }
  check(s.phase === 'break' && s.nextRound === 2, 'auto-pause after the 3 min chess round');
  const left = [...s.remaining];
  check(left[0] + left[1] === 12 * 60000 - 180000, 'both clocks used 3 min in total');
  run(s, 180000, 240000);
  check(s.phase === 'boxing' && s.round === 2, 'boxing round starts after the 1 min break');
  run(s, 240000, 420000);
  check(s.phase === 'break' && s.nextRound === 3, 'break after boxing');
  run(s, 420000, 480000);
  check(s.phase === 'chess' && s.round === 3, 'chess round 3 starts');
  check(s.remaining[0] === left[0] && s.remaining[1] === left[1], 'clocks frozen during boxing and breaks');
}

// Last round ends the fight on a decision
{
  const s = fight({ moveLimit: false, autoStop: true, boxTimer: true, rounds: 5 });
  for (let i = 0; i < 4; i++) skipPhase(s, 0), skipPhase(s, 0);
  check(s.phase === 'chess' && s.round === 5, 'reach the last round');
  skipPhase(s, 0);
  check(s.phase === 'over' && s.result.method === 'decision', 'end of last round asks for a decision');
}

// Flag
{
  const s = fight({ moveLimit: false, rounds: 5 });
  run(s, 0, 4.5 * 60000);
  check(s.phase === 'over' && s.result.loser === 0 && s.result.method === 'temps', 'lose on time when the clock reaches zero');
}

// Counts: each move countdown and each illegal move; 3 in a round or 4 in total lose
{
  const s = fight({ autoStop: true, boxTimer: true });
  run(s, 0, 31000); press(s, 0, 31000);          // white: count 1
  run(s, 31000, 62000); press(s, 1, 62000);      // black: count 1
  run(s, 62000, 93000); press(s, 0, 93000);      // white: count 2
  check(countsOf(s, 0, 1) === 2 && s.phase === 'chess', 'two counts are not a loss');
  run(s, 93000, 103000);                          // black thinks 10 s
  press(s, 1, 103000);
  illegalMove(s, 0, 103000);                      // white's move was illegal... claimed late: white to play again
  check(s.phase === 'over' && s.result.loser === 0 && s.result.method.includes('round'), '3 counts in a round lose');
  undoCount(s, 103000);
  check(s.phase === 'chess' && s.paused && countsOf(s, 0) === 2, 'undo the count reopens the fight, paused');
}
{
  const s = fight({ moveLimit: false, autoStop: true, boxTimer: true });
  press(s, 0, 0);
  illegalMove(s, 0, 0);
  check(s.turn === 0 && countsOf(s, 0) === 1, 'illegal move: 1 count and the offender plays again');
  illegalMove(s, 0, 0);
  for (let i = 0; i < 4; i++) skipPhase(s, 0); // to chess round 3
  check(s.round === 3 && s.phase === 'chess', 'reach round 3');
  illegalMove(s, 0, 0);
  check(s.phase === 'chess' && countsOf(s, 0) === 3, 'three counts over two rounds are not a loss');
  illegalMove(s, 0, 0);
  check(s.phase === 'over' && s.result.method.includes('total'), '4 counts in total lose');
}

// Auto-stop without boxing timer: untimed boxing after the 3 min round
{
  const s = fight({ moveLimit: false, autoStop: true });
  run(s, 0, 180000);
  check(s.phase === 'boxing' && s.round === 2 && s.phaseRemaining === null, 'auto-stop only: untimed boxing');
}
// Boxing timer without auto-stop: the coach ends the chess round, then breaks and boxing are timed
{
  const s = fight({ moveLimit: false, boxTimer: true });
  run(s, 0, 200000);
  check(s.phase === 'chess' && s.roundOver, 'timer only: chess goes on after 3 min');
  skipPhase(s, 200000);
  run(s, 200000, 200000 + 60000 + 180000 + 60000);
  check(s.phase === 'chess' && s.round === 3, 'timer only: break, boxing, break, then chess round 3');
}

if (errors.length) {
  console.error(`pendule-clock: ${errors.length} failure(s)`);
  errors.forEach(e => console.error('  ✗ ' + e));
  process.exit(1);
}
console.log('pendule-clock: all checks passed');
