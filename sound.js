// Synthesised sounds (no audio files, works offline). The context is
// created on the first tap, as browsers require a user gesture.

let ctx = null;
let muted = false;
export function setMuted(m) { muted = m; }

// Recorded sounds, a few variants each, picked at random: a punch for each
// press, a hammer on hard wood for the 10-second clapper.
const BANKS = {
  punch: [1, 2, 3, 4, 5, 6].map(i => `sounds/coup${i}.mp3`),
  clap: [1, 2, 3, 4, 5, 6].map(i => `sounds/claquoir${i}.mp3`),
};
const samples = { punch: [], clap: [] };
function loadSamples() {
  Object.entries(BANKS).forEach(([bank, files]) => files.forEach(url => fetch(url)
    .then(r => r.arrayBuffer())
    .then(b => new Promise((ok, ko) => ctx.decodeAudioData(b, ok, ko)))
    .then(buf => samples[bank].push(buf))
    .catch(() => {})));
}
// Plays a random sample of the bank; false if none is loaded yet.
function sample(bank, start = 0) {
  const list = samples[bank];
  if (!ctx || !list.length) return false;
  const src = ctx.createBufferSource();
  src.buffer = list[Math.floor(Math.random() * list.length)];
  src.playbackRate.value = 0.95 + Math.random() * 0.1;
  src.connect(ctx.destination);
  src.start(ctx.currentTime + start);
  return true;
}
function punch() { if (!sample('punch')) clack(); }

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    loadSamples();
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
// Bell bus: drive into soft saturation then a compressor (the ring).
// Clapper bus: clean gain only, so its attack is never squashed.
// The compressor delays its input by ~6 ms (look-ahead), so attacks sent
// straight to the speakers are played 6 ms later to stay in sync.
const LOOKAHEAD = 0.006;
function makeBus(kind) {
  const g = ctx.createGain();
  if (kind === 'clap') { g.gain.value = 0.66; g.connect(ctx.destination); return g; }
  g.gain.value = 2.2;
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(2048);
  for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh((i / 1023.5 - 1) * 1.6) / Math.tanh(1.6);
  shaper.curve = curve; shaper.oversample = '4x';
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 3; comp.ratio.value = 12;
  comp.attack.value = 0.015; comp.release.value = 0.15; // slow attack lets the strike punch through
  const trim = ctx.createGain(); trim.gain.value = 0.85;
  g.connect(shaper).connect(comp).connect(trim).connect(ctx.destination);
  return g;
}
function loud(fn, kind = 'bell') {
  if (!ctx) return;
  if (buses.get('ctx') !== ctx) { buses.clear(); buses.set('ctx', ctx); }
  if (!buses.has(kind)) buses.set(kind, makeBus(kind));
  out = buses.get(kind); fn(); out = null;
}
function direct(fn) { const o = out; out = ctx.destination; fn(); out = o; }

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
  // Hammer strike, straight to the speakers so it stays sharp.
  direct(() => {
    const t = start + LOOKAHEAD;
    hit(t, 2500, 0.6, 0.55, 0.008, 'highpass');       // steel on bronze
    hit(t, 5200, 2.5, 0.5, 0.02);                    // clank
    [[4310, 0.16, 0.05], [6870, 0.1, 0.03]]
      .forEach(([f, v, d]) => tone(f, t, d, { vol: v, attack: 0.0005 }));
  });
  hit(start, 7000, 0.7, 1.0, 0.012, 'highpass');
  hit(start, 3200, 2, 0.5, 0.03);
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
// Wood resonator: a tiny noise impulse rung through a very narrow filter,
// so the mode rings with the grain of real wood instead of a pure sine.
function ring(start, freq, decay, vol) {
  if (!ctx) return;
  const t = ctx.currentTime + start;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer();
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = Math.PI * freq * decay / 2.3;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.004);
  src.connect(f).connect(g).connect(out || ctx.destination);
  src.start(t); src.stop(t + decay + 0.05);
}
// The referee's 10-second clapper: two hardwood sticks slammed together.
// A hard, short attack (click + slap), then the sticks' bar modes
// (1 : 2.76 : 5.4) ringing with a woody grain; low modes last longest.
function claves(start) {
  const j = () => 0.99 + Math.random() * 0.02;
  hit(start, 2500, 0.8, 0.9, 0.003);                 // contact click
  hit(start, 900, 1.1, 0.8, 0.02);                   // slap of the boards
  tone(260, start, 0.05, { type: 'sine', vol: 0.45, glide: 180, attack: 0.001 }); // hand-held thump
  const f0 = 1050 * j();
  [[1, 0.42, 0.45], [1.012, 0.2, 0.35], [2.76, 0.2, 0.16], [5.4, 0.07, 0.06]]
    .forEach(([r, v, d]) => tone(f0 * r, start, d, { vol: v, attack: 0.0008 }));
  [[1, 40, 0.4], [1.5, 22, 0.2], [2.76, 18, 0.12]]
    .forEach(([r, v, d]) => ring(start, f0 * r * j(), d, v));
}
function clapper(times) {
  if (samples.clap.length) times.forEach(t => sample('clap', t));
  else loud(() => times.forEach(t => claves(t)), 'clap');
}
// For tests: render sounds into an OfflineAudioContext.
export function useContext(c) { ctx = c; }
export function loadForTest() { loadSamples(); }

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
