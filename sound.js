// Synthesised sounds (no audio files, works offline). The context is
// created on the first tap, as browsers require a user gesture.

let ctx = null;
let muted = false;
export function setMuted(m) { muted = m; }

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
}

function tone(freq, start, dur, { type = 'sine', vol = 0.3, decay = true } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  if (decay) gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  else {
    gain.gain.setValueAtTime(vol, t + dur - 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

// Mechanical clock lever: a sharp filtered noise snap, a wooden thunk, and
// the latch falling a few ms later, like an old analogue chess clock.
let noise = null;
function noiseBuffer() {
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 4);
  }
  return noise;
}
function snap(start, freq, q, vol, dur) {
  const t = ctx.currentTime + start;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer();
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(g).connect(ctx.destination);
  src.start(t); src.stop(t + dur + 0.02);
}
function clack() {
  if (!ctx) return;
  snap(0, 3200, 1.2, 1.4, 0.035);       // lever snap
  tone(180, 0, 0.07, { type: 'triangle', vol: 0.45 }); // body thunk
  snap(0.028, 1800, 3, 0.6, 0.03);      // latch
}

// Boxing bell: a few inharmonic partials with a long decay, struck `hits` times.
function bell(hits = 1) {
  for (let h = 0; h < hits; h++) {
    const s = h * 0.45;
    [[523, 0.35], [1046, 0.18], [1410, 0.12], [2090, 0.06]].forEach(([f, v]) =>
      tone(f, s, 2.2, { vol: v }));
  }
}

const SOUNDS = {
  press: clack,
  moveWarn: () => { tone(880, 0, 0.15, { vol: 0.35 }); tone(880, 0.2, 0.15, { vol: 0.35 }); },
  moveCountdown: () => tone(1200, 0, 0.3, { type: 'square', vol: 0.25 }),
  moveTick: () => tone(1200, 0, 0.1, { type: 'square', vol: 0.2 }),
  clockLow: () => tone(1600, 0, 0.05, { type: 'square', vol: 0.1 }),
  phaseTen: () => { tone(660, 0, 0.12, { vol: 0.35 }); tone(660, 0.18, 0.12, { vol: 0.35 }); },
  roundStart: () => bell(1),
  roundEnd: () => bell(3),
  roundTimeUp: () => bell(3),
  count: () => { tone(160, 0, 0.35, { type: 'triangle', vol: 0.6 }); tone(120, 0.1, 0.4, { type: 'triangle', vol: 0.5 }); },
  over: () => {
    tone(440, 0, 0.35, { type: 'sawtooth', vol: 0.18, decay: false });
    tone(349, 0.4, 0.35, { type: 'sawtooth', vol: 0.18, decay: false });
    tone(262, 0.8, 0.8, { type: 'sawtooth', vol: 0.18, decay: false });
  },
  pause: () => tone(500, 0, 0.12, { vol: 0.3 }),
  resume: () => tone(750, 0, 0.12, { vol: 0.3 }),
  undo: () => tone(600, 0, 0.08, { vol: 0.25 }),
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
  phaseTen: [100, 80, 100],
};

export function play(event) {
  if (!muted) SOUNDS[event]?.();
  if (VIBRATE[event] && navigator.vibrate) navigator.vibrate(VIBRATE[event]);
}
