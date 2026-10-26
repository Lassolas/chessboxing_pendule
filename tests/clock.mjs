// Checks the chessboxing clock state machine (clock.js).
// Usage: node tests/clock.mjs (also run by npm test)

import {
  defaultConfig, newFight, tick, start, press, togglePause, skipPhase,
  illegalMove, removeIllegal, undoCount, averageMove, nextChessRound, goToNextChess, nextStep, goToNextStep, reopen, adjustTime, moveStage, moveCountdownLeft, countsOf, playerTime, formatClock,
} from '../clock.js';

const errors = [];
const check = (cond, msg) => { if (!cond) errors.push(msg); };

function fight(over = {}) {
  const s = newFight({ ...defaultConfig(), ...over });
  start(s, 0, 1);
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

// Default: chess round stops at 3 min, open pause (∞), no boxing; the coach
// starts the next chess round
{
  const s = fight({ moveLimit: false });
  const ev = run(s, 0, 180000);
  check(ev.includes('roundEnd') && s.phase === 'break' && s.nextRound === 3 && s.phaseRemaining === null, 'default: open pause after the chess round');
  run(s, 180000, 900000);
  check(s.phase === 'break', 'open pause waits for the coach');
  skipPhase(s, 900000);
  check(s.phase === 'chess' && s.round === 3 && s.moveElapsed === 0, 'coach starts chess round 3, move timer at zero');
}

// Boxing on, 1 min pauses: chess -> break -> boxing -> break -> chess, clocks frozen outside chess
{
  const s = fight({ moveLimit: false, boxTimer: true, breakMs: 60000 });
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
  const s = fight({ moveLimit: false, boxTimer: true, rounds: 5 });
  for (let i = 0; i < 4; i++) skipPhase(s, 0), skipPhase(s, 0);
  check(s.phase === 'chess' && s.round === 5, 'reach the last round');
  skipPhase(s, 0);
  check(s.phase === 'over' && s.result.method === 'decision', 'end of last round asks for a decision');
}

// Flag
{
  const s = fight({ moveLimit: false, rounds: 5, intervals: false });
  run(s, 0, 4.5 * 60000);
  check(s.phase === 'over' && s.result.loser === 0 && s.result.method === 'temps', 'lose on time when the clock reaches zero');
}

// Counts: each move countdown and each illegal move; 3 in a round or 4 in total lose
{
  const s = fight({ boxTimer: true });
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
  const s = fight({ moveLimit: false, boxTimer: true });
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

// Boxing on with an open pause: the coach starts the boxing round, which is timed
{
  const s = fight({ moveLimit: false, boxTimer: true });
  run(s, 0, 180000);
  check(s.phase === 'break' && s.nextRound === 2 && s.phaseRemaining === null, 'boxing on: open pause first');
  skipPhase(s, 180000);
  run(s, 180000, 360000);
  check(s.phase === 'break' && s.nextRound === 3, 'boxing round timed, then another pause');
}

// The first press picks the colours
{
  const s = newFight(defaultConfig());
  press(s, 0, 0);
  check(s.phase === 'chess' && s.white === 1 && s.turn === 1, 'first to press is Black, White to move');
  run(s, 0, 2000);
  check(s.remaining[1] === 6 * 60000 - 2000 && s.remaining[0] === 6 * 60000, "White's clock runs");
}

// Pause menu: jump to the next chess round
{
  const s = fight({ moveLimit: false, boxTimer: true });
  run(s, 0, 10000);
  togglePause(s, 10000);
  check(nextChessRound(s) === 3, 'from chess round 1 the next chess round is 3');
  goToNextChess(s, 10000);
  check(s.phase === 'chess' && s.round === 3 && !s.paused && s.moveElapsed === 0, 'jump to chess round 3, running');
  skipPhase(s, 10000);
  check(s.phase === 'break' && nextChessRound(s) === 5, 'from the break after round 3, next chess round is 5');
  goToNextChess(s, 10000); goToNextChess(s, 10000);
  check(s.round === 7 && nextChessRound(s) === null, 'no next chess round after the last one');
}

// Without intervals: a plain clock, no rounds
{
  const s = fight({ intervals: false, moveLimit: false });
  run(s, 0, 300000);
  check(s.phase === 'chess' && s.round === 1 && !s.roundOver && nextChessRound(s) === null, 'plain clock: no round stop');
}

// Average time per move
{
  const s = fight({ moveLimit: false });
  run(s, 0, 4000); press(s, 0, 4000);      // white 4 s
  run(s, 4000, 6000); press(s, 1, 6000);   // black 2 s
  run(s, 6000, 8000); press(s, 0, 8000);   // white 2 s
  check(averageMove(s, 0) === 3000 && averageMove(s, 1) === 2000, 'average per move: white 3 s, black 2 s');
  run(s, 8000, 18000);                     // black thinking 10 s, longer than the average
  check(averageMove(s, 1) === 6000, 'a long move in progress counts');
}

// Thinking time follows the chess round length
{
  check(playerTime({ ...defaultConfig(), rounds: 5 }) === 270000, '5 rounds of 3 min: 4\'30 each');
  check(playerTime({ ...defaultConfig(), rounds: 11 }) === 540000, '11 rounds of 3 min: 9\'00 each');
  check(playerTime({ ...defaultConfig(), rounds: 5, chessRoundMs: 120000 }) === 180000, '5 rounds of 2 min: 3\'00 each');
  check(playerTime({ ...defaultConfig(), rounds: 7, intervals: false }) === 360000, 'plain clock keeps the preset');
  const s = newFight({ ...defaultConfig(), rounds: 5, chessRoundMs: 120000 });
  check(s.remaining[0] === 180000 && s.remaining[1] === 180000, 'a new fight uses it');
}

// Chess without boxing: chess round, timed pause, next chess round
{
  const s = fight({ moveLimit: false, rounds: 5, breakMs: 60000 });
  for (let t = 0; t <= 180000; t += 1000) tick(s, t);
  check(s.phase === 'break' && s.nextRound === 3 && s.phaseRemaining > 0, 'no boxing: a pause follows the chess round');
  for (let t = 181000; t <= 241000; t += 1000) tick(s, t);
  check(s.phase === 'chess' && s.round === 3, 'no boxing: the pause leads to chess round 3');
}

// Pause of 0 s: the next round starts at once
{
  const s = fight({ moveLimit: false, rounds: 5, breakMs: 0 });
  run(s, 0, 180000);
  check(s.phase === 'chess' && s.round === 3, 'no pause: chess round 3 follows straight away');
  const b = fight({ moveLimit: false, rounds: 5, breakMs: 0, boxTimer: true });
  run(b, 0, 180000);
  check(b.phase === 'boxing' && b.round === 2, 'no pause: boxing follows straight away');
}

// The last chess round lasts as long as the clocks, even after a skip or added time
{
  const s = fight({ moveLimit: false, rounds: 5, breakMs: 0 });
  goToNextChess(s, 0); goToNextChess(s, 0);
  check(s.round === 5 && s.phaseRemaining === null, 'last chess round has no round timer');
  adjustTime(s, s.turn, 120000, 0);
  run(s, 0, 300000);
  check(s.phase === 'chess', 'last round still running after 5 min');
  run(s, 300000, 400000);
  check(s.phase === 'over' && s.result.method !== 'decision', 'last round ends on the flag');
}

// The − next to the flag takes back the last illegal move against that player
{
  const s = fight({ moveLimit: false, illegalMoves: true });
  illegalMove(s, 0, 1000); illegalMove(s, 1, 1000); illegalMove(s, 0, 1000);
  removeIllegal(s, 0, 2000);
  check(countsOf(s, 0) === 1 && countsOf(s, 1) === 1, 'removeIllegal takes back one illegal move of that player');
  check(removeIllegal(s, 1, 2000).length === 1 && removeIllegal(s, 1, 2000).length === 0, 'nothing to remove: no event');
}

// The display drops a second as soon as the clock runs
check(formatClock(270000) === '4:30' && formatClock(269900) === '4:29', 'clock shows 4:29 right after the start');
check(formatClock(9960) === '9.9' && formatClock(10000) === '0:10', 'tenths under 10 s, rounded down');

// The pause menu goes to the next step: chess → pause → boxing → pause → chess
{
  const s = fight({ moveLimit: false, rounds: 5, boxTimer: true, breakMs: 60000 });
  togglePause(s, 1000);
  const seen = [];
  for (let i = 0; i < 5; i++) { const n = nextStep(s); seen.push(n.phase + n.round); goToNextStep(s, 2000 + i); }
  check(seen.join(' ') === 'break2 boxing2 break3 chess3 break4', 'next step follows the fight order: ' + seen.join(' '));
  check(!s.paused, 'the next step runs');
  const n = fight({ moveLimit: false, rounds: 5, breakMs: null });
  check(nextStep(n).phase === 'break' && nextStep(n).round === 3, 'no boxing: chess round → pause → chess 3');
}

if (errors.length) {
  console.error(`pendule-clock: ${errors.length} failure(s)`);
  errors.forEach(e => console.error('  ✗ ' + e));
  process.exit(1);
}
console.log('pendule-clock: all checks passed');
