// Synthesised sounds (no audio files, works offline). The context is
// created on the first tap, as browsers require a user gesture.

let ctx = null;
let muted = false;
export function setMuted(m) { muted = m; }

// Recorded punches for each press (a few variants, picked at random).
const PUNCH_FILES = [1, 2, 3, 4, 5, 6].map(i => `sounds/coup${i}.mp3`);
let punches = [];
function loadPunches() {
  PUNCH_FILES.forEach(url => fetch(url)
    .then(r => r.arrayBuffer())
    .then(b => new Promise((ok, ko) => ctx.decodeAudioData(b, ok, ko)))
    .then(buf => punches.push(buf))
    .catch(() => {}));
}
function punch() {
  if (!ctx || !punches.length) { clack(); return; }
  const src = ctx.createBufferSource();
  src.buffer = punches[Math.floor(Math.random() * punches.length)];
  src.playbackRate.value = 0.95 + Math.random() * 0.1;
  src.connect(ctx.destination);
  src.start();
}

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    loadPunches();
  }
  if (ctx.state === 'suspended') ctx.resume();
}

// Every sound imitates a real object: clock lever, boxing bell, wooden
// clapper, a door closing. No beeps.

function tone(freq, start, dur, { type = 'sine', vol = 0.3, attack = 0.003, glide = null } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (glide) osc.frequency.exponentialRampToValueAtTime(glide, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(out || ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

// Loud bus for the clapper and the bell: drive into soft saturation then a
// compressor, so they cut through a noisy gym without clipping.
let out = null;
const buses = new Map();
// drive: how hard the signal hits the saturation; bias adds even harmonics.
function makeBus(drive, bias, shelfDb, level) {
  const g = ctx.createGain(); g.gain.value = drive;
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(2048), off = Math.tanh(bias);
  for (let i = 0; i < curve.length; i++) curve[i] = (Math.tanh((i / 1023.5 - 1) * 1.6 + bias) - off) / (1 + Math.abs(off));
  shaper.curve = curve; shaper.oversample = '4x';
  const shelf = ctx.createBiquadFilter();
  shelf.type = 'highshelf'; shelf.frequency.value = 3500; shelf.gain.value = shelfDb;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 3; comp.ratio.value = 12;
  comp.attack.value = 0.0005; comp.release.value = 0.08;
  const trim = ctx.createGain(); trim.gain.value = level;
  g.connect(shaper).connect(shelf).connect(comp).connect(trim).connect(ctx.destination);
  return g;
}
function loud(fn, kind = 'bell') {
  if (!ctx) return;
  if (buses.get('ctx') !== ctx) { buses.clear(); buses.set('ctx', ctx); }
  if (!buses.has(kind)) buses.set(kind, kind === 'clap' ? makeBus(7, 0.35, 6, 1.35) : makeBus(2.2, 0, 0, 1.25));
  out = buses.get(kind); fn(); out = null;
}

let noise = null;
function noiseBuffer() {
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noise;
}
// A burst of filtered noise: the attack of anything hit.
function hit(start, freq, q, vol, dur, type = 'bandpass') {
  if (!ctx) return;
  const t = ctx.currentTime + start;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer();
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out || ctx.destination);
  src.start(t); src.stop(t + dur + 0.02);
}

// Old analogue chess clock lever: snap, wooden thunk, latch.
function clack() {
  hit(0, 3200, 1.2, 1.4, 0.035);
  tone(180, 0, 0.07, { type: 'triangle', vol: 0.45 });
  hit(0.028, 1800, 3, 0.6, 0.03);
}

// Boxing bell: a steel hammer on a bronze dome. A hard metallic clang
// (bright broadband strike) then high inharmonic partials ringing long.
function ding(start) {
  hit(start, 7000, 0.7, 1.0, 0.012, 'highpass');   // metal on metal
  hit(start, 3200, 2, 0.5, 0.03);                   // clang
  [[1180, 0.26, 2.6], [2650, 0.2, 2.0], [3910, 0.14, 1.5], [5420, 0.1, 1.0], [7130, 0.07, 0.7], [9050, 0.04, 0.4]]
    .forEach(([f, v, d]) => { tone(f, start, d, { vol: v, attack: 0.001 }); tone(f * 1.004, start, d * 0.8, { vol: v * 0.5, attack: 0.001 }); });
}
function bell(hits) {
  loud(() => { for (let i = 0; i < hits; i++) ding(i * 0.32); });
}

// Two wooden boards clapped together (anti-play countdown).
function wood(start, vol = 1) {
  hit(start, 1500, 1.5, 1.6 * vol, 0.05);
  hit(start, 700, 6, 0.9 * vol, 0.09);
  tone(420, start, 0.06, { type: 'triangle', vol: 0.35 * vol });
}
// The referee's 10-second clapper, like high hardwood claves slammed
// together: a violent crack over the whole spectrum, a split-wood buzz, then
// the bright ring of the sticks, all driven hard into saturation.
function claves(start) {
  hit(start, 200, 0.5, 2.5, 0.022, 'highpass');     // crack, full spectrum
  hit(start, 10000, 0.5, 2.5, 0.008, 'highpass');   // splinter
  hit(start, 4500, 0.8, 1.8, 0.03);                 // snap
  hit(start, 1100, 1, 1.4, 0.04);                   // slap body
  hit(start, 450, 2, 0.9, 0.05);                    // low thwack
  [[2480, 0.8, 0.18, 'triangle'], [2530, 0.35, 0.13, 'sine'], [3700, 0.3, 0.08, 'sine'],
   [6350, 0.35, 0.06, 'sine'], [8900, 0.2, 0.03, 'sine'], [12400, 0.12, 0.02, 'sine']]
    .forEach(([f, v, d, type]) => tone(f * (0.995 + Math.random() * 0.01), start, d, { type, vol: v, attack: 0.0005 }));
}
function clapper(times) { loud(() => times.forEach(t => claves(t)), 'clap'); }
// For tests: render sounds into an OfflineAudioContext.
export function useContext(c) { ctx = c; }

// Knuckle on a wooden table: duller and lower.
function knock(start, vol = 1) {
  hit(start, 450, 3, 1.2 * vol, 0.08);
  tone(140, start, 0.1, { type: 'triangle', vol: 0.5 * vol, glide: 110 });
}
// Pendulum / metronome tick.
function tick(start, high) {
  hit(start, high ? 3800 : 2900, 8, 0.7, 0.025);
  tone(high ? 1900 : 1500, start, 0.03, { vol: 0.08 });
}
// A heavy door or drawer pushed shut: slide, body thud, latch.
function doorShut() {
  hit(0, 900, 0.7, 0.25, 0.35, 'lowpass');                 // slide
  tone(85, 0.3, 0.45, { type: 'sine', vol: 0.9, glide: 45 }); // thud
  hit(0.3, 220, 1.5, 1.2, 0.25);                           // wood body
  hit(0.3, 2500, 2, 0.35, 0.05);                           // contact
  hit(0.42, 3000, 4, 0.5, 0.03);                           // latch
}

const SOUNDS = {
  press: punch,
  moveWarn: () => knock(0),
  moveCountdown: () => { wood(0); wood(0.16); },
  moveTick: () => tick(0, Math.round(performance.now() / 1000) % 2 === 0),
  clockLow: () => tick(0, true),
  phaseTen: () => clapper([0, 0.4, 0.8]),  // 10 s left in a round: 3 strikes in 0.8 s
  breakTen: () => clapper([0, 1, 2]),      // 10 s left in a break: 3 strikes, 1 s apart
  roundStart: () => bell(1),
  roundEnd: () => bell(3),
  roundTimeUp: () => bell(3),
  count: () => { knock(0, 1.2); knock(0.14, 1.2); },
  over: doorShut,
  pause: () => hit(0, 2200, 3, 0.5, 0.03),
  resume: clack,
  undo: () => hit(0, 2600, 3, 0.4, 0.03),
};

const VIBRATE = {
  moveWarn: [120, 80, 120],
  moveCountdown: [300],
  moveTick: [60],
  roundStart: [400],
  roundEnd: [200, 100, 200, 100, 200],
  roundTimeUp: [200, 100, 200, 100, 200],
  count: [300],
  over: [600, 150, 600],
  phaseTen: [80, 320, 80, 320, 80],
  breakTen: [80, 920, 80, 920, 80],
};

export function play(event) {
  if (!muted) SOUNDS[event]?.();
  if (VIBRATE[event] && navigator.vibrate) navigator.vibrate(VIBRATE[event]);
}
