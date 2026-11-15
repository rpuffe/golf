// Every sound in the game is synthesized here with WebAudio — no files.
// Each outcome class has its own voice (the fun rubric requires that no two
// share an audio call).

let ctx = null, master = null, sfxBus = null, ambBus = null, noiseBuf = null;
let muted = false;
const amb = {};

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = 0.5; ambBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startAmbience();
  }
  if (ctx.state === 'suspended') ctx.resume();
}
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.8; }
export function isMuted() { return muted; }
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend(); else ctx.resume();
});

const now = () => ctx.currentTime;
function env(g, t, a, peak, d, end = 0.0001) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(end, t + a + d);
}
function osc(type, f, t, dur, peak, { a = 0.005, f2 = null, bus = sfxBus, detune = 0 } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  env(g, t, a, peak, dur);
  o.connect(g); g.connect(bus); o.start(t); o.stop(t + a + dur + 0.05);
  return o;
}
function noise(t, dur, peak, { type = 'lowpass', f = 1000, f2 = null, q = 0.7, a = 0.004, bus = sfxBus, rate = 1 } = {}) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = rate;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ctx.createGain(); env(g, t, a, peak, dur);
  s.connect(fl); fl.connect(g); g.connect(bus);
  s.start(t, Math.random()); s.stop(t + a + dur + 0.05);
}
const ok = () => ctx && !muted;

export const sfx = {
  whoosh(power = 1) { if (!ok()) return; noise(now(), 0.28, 0.25 * power + 0.05, { type: 'bandpass', f: 400, f2: 2400, q: 1.2, a: 0.08 }); },
  backswing(p) { if (!ok()) return; osc('sine', 300 + p * 500, now(), 0.04, 0.03); },
  strike(pure, club) {
    if (!ok()) return; const t = now();
    if (club === 'putter') { osc('sine', pure ? 1400 : 900, t, 0.08, 0.35); osc('triangle', 2800, t, 0.03, 0.08); return; }
    if (pure) {
      osc('triangle', 1900, t, 0.06, 0.6, { f2: 900 });
      noise(t, 0.05, 0.6, { type: 'highpass', f: 3000 });
      osc('sine', 3800, t + 0.01, 0.4, 0.07);                 // the "ping" of a pure strike
      osc('sine', 5700, t + 0.02, 0.3, 0.04);
    } else {
      osc('square', 180, t, 0.12, 0.3, { f2: 90 });           // dull thud
      noise(t, 0.12, 0.5, { type: 'lowpass', f: 900 });
      osc('sawtooth', 70, t, 0.25, 0.12, { detune: 30 });     // jarring buzz up the shaft
    }
  },
  fairway(v = 1) { if (!ok()) return; const t = now(); noise(t, 0.12, 0.35 * v, { f: 600 }); osc('sine', 110, t, 0.1, 0.25 * v, { f2: 60 }); },
  green(v = 1) { if (!ok()) return; const t = now(); osc('sine', 260, t, 0.08, 0.25 * v, { f2: 180 }); noise(t, 0.05, 0.15 * v, { f: 1500 }); },
  rough(v = 1) { if (!ok()) return; noise(now(), 0.35, 0.35 * v, { type: 'bandpass', f: 2500, f2: 900, q: 0.6, a: 0.02 }); },
  sand(v = 1) {
    if (!ok()) return; const t = now();
    for (let i = 0; i < 6; i++) noise(t + i * 0.025, 0.05, 0.25 * v, { type: 'highpass', f: 3500 + i * 300 });
    noise(t, 0.3, 0.2 * v, { type: 'bandpass', f: 1200, q: 2 });
  },
  water() {
    if (!ok()) return; const t = now();
    noise(t, 0.6, 0.7, { type: 'lowpass', f: 3000, f2: 300, a: 0.01 });
    for (let i = 0; i < 7; i++) osc('sine', 500 + Math.random() * 700, t + 0.2 + i * 0.09, 0.08, 0.12, { f2: 1400 + Math.random() * 600 });
  },
  oob() { if (!ok()) return; const t = now(); [392, 370, 349, 311].forEach((f, i) => osc('sawtooth', f, t + i * 0.22, i === 3 ? 0.6 : 0.2, 0.12, { f2: i === 3 ? f * 0.8 : null })); },
  lip() { if (!ok()) return; const t = now(); osc('triangle', 2100, t, 0.25, 0.3); osc('triangle', 2650, t + 0.015, 0.3, 0.2); osc('sine', 1300, t + 0.1, 0.2, 0.15); },
  holed() {
    if (!ok()) return; const t = now();
    for (let i = 0; i < 3; i++) osc('triangle', 1600 - i * 200, t + i * 0.07, 0.07, 0.3);
    [523, 659, 784, 1047, 1319].forEach((f, i) => { osc('triangle', f, t + 0.3 + i * 0.09, 0.35, 0.22); osc('sine', f * 2, t + 0.3 + i * 0.09, 0.2, 0.06); });
  },
  tree() { if (!ok()) return; const t = now(); osc('square', 330, t, 0.06, 0.3, { f2: 160 }); noise(t, 0.08, 0.4, { type: 'bandpass', f: 700, q: 3 }); },
  leaves() { if (!ok()) return; const t = now(); for (let i = 0; i < 5; i++) noise(t + i * 0.05, 0.12, 0.18, { type: 'highpass', f: 4000 + Math.random() * 3000 }); },
  honk(urgency = 1) {
    if (!ok()) return; const t = now();
    for (let i = 0; i < (urgency > 1 ? 3 : 1); i++) {
      const s = t + i * 0.22, f = 330 + Math.random() * 60;
      osc('square', f, s, 0.17, 0.16, { f2: f * 0.78, a: 0.01 });
      osc('sawtooth', f * 1.01, s, 0.17, 0.12, { f2: f * 0.8, a: 0.01, detune: 25 });
      noise(s, 0.15, 0.08, { type: 'bandpass', f: 1500, q: 4 });
    }
  },
  // "CALLED IT": the ball landed on the carry marker you swung for
  calledIt() { if (!ok()) return; const t = now(); [784, 988, 1319].forEach((f, i) => { osc('sine', f, t + i * 0.075, 0.22, 0.2); osc('triangle', f * 2, t + i * 0.075, 0.1, 0.05); }); },
  feathers() { if (!ok()) return; noise(now(), 0.4, 0.3, { type: 'bandpass', f: 5000, f2: 2000, q: 1, a: 0.01 }); },
  gooseBonk() { if (!ok()) return; const t = now(); osc('sine', 600, t, 0.15, 0.4, { f2: 200 }); this.honk(2); },
  ghostHit() {
    if (!ok()) return; const t = now();
    [880, 1109, 1319, 1760].forEach((f, i) => osc('sine', f, t + i * 0.03, 0.9, 0.12));
    noise(t, 0.5, 0.2, { type: 'bandpass', f: 600, f2: 4000, q: 4, a: 0.3 });
  },
  stymie() { if (!ok()) return; const t = now(); [110, 131, 156, 185].forEach(f => osc('sawtooth', f, t, 1.4, 0.05, { a: 0.3 })); },
  overtake() { if (!ok()) return; const t = now(); [440, 554, 659, 880].forEach((f, i) => osc('square', f, t + i * 0.06, 0.12, 0.08)); },
  fallBehind() { if (!ok()) return; const t = now(); [440, 415, 349].forEach((f, i) => osc('triangle', f, t + i * 0.16, 0.25, 0.14)); },
  snap() { if (!ok()) return; const t = now(); osc('sawtooth', 900, t, 0.25, 0.4, { f2: 60 }); noise(t, 0.08, 0.8, { type: 'highpass', f: 2000 }); },
  reelClick() { if (!ok()) return; noise(now(), 0.015, 0.2, { type: 'highpass', f: 5000 }); },
  splashBob() { if (!ok()) return; osc('sine', 700, now(), 0.15, 0.15, { f2: 300 }); },
  catchBall() { if (!ok()) return; const t = now(); [523, 784, 1047].forEach((f, i) => osc('triangle', f, t + i * 0.1, 0.3, 0.2)); },
  junk() { if (!ok()) return; const t = now(); osc('sine', 200, t, 0.4, 0.3, { f2: 800 }); osc('sine', 800, t + 0.4, 0.3, 0.2, { f2: 150 }); },
  bell() { if (!ok()) return; const t = now(); for (let i = 0; i < 3; i++) { osc('sine', 196, t + i * 1.1, 1.6, 0.25); osc('sine', 392 * 1.01, t + i * 1.1, 1.2, 0.08); osc('sine', 587, t + i * 1.1, 0.8, 0.05); } },
  heartbeat() { if (!ok()) return; const t = now(); osc('sine', 60, t, 0.1, 0.5, { f2: 40 }); osc('sine', 55, t + 0.18, 0.12, 0.35, { f2: 38 }); },
  gasp() { if (!ok()) return; noise(now(), 0.5, 0.25, { type: 'bandpass', f: 900, f2: 1800, q: 1.5, a: 0.15 }); },
  scope(on) { if (!ok()) return; osc('sawtooth', on ? 300 : 500, now(), 0.12, 0.04, { f2: on ? 500 : 300 }); },
  tick() { if (!ok()) return; osc('sine', 1200, now(), 0.03, 0.08); },
  thump() { if (!ok()) return; osc('sine', 80, now(), 0.15, 0.4, { f2: 45 }); },
  slowmo() { if (!ok()) return; noise(now(), 1.4, 0.25, { type: 'lowpass', f: 2500, f2: 200, a: 0.05 }); osc('sine', 220, now(), 1.4, 0.15, { f2: 55 }); },
  drop() { if (!ok()) return; osc('sine', 500, now(), 0.12, 0.2, { f2: 900 }); },
  newBall() { if (!ok()) return; const t = now(); osc('triangle', 660, t, 0.1, 0.15); osc('triangle', 990, t + 0.08, 0.15, 0.15); },
};

// Ambience: wind bed + occasional birds; wind gain follows the hole's wind.
function startAmbience() {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
  const g = ctx.createGain(); g.gain.value = 0.05;
  s.connect(f); f.connect(g); g.connect(ambBus); s.start();
  amb.wind = g; amb.windFilter = f;
  const bird = () => {
    if (ctx && !muted && Math.random() < 0.6) {
      const t = now(), base = 2200 + Math.random() * 1600, n = 2 + (Math.random() * 4 | 0);
      for (let i = 0; i < n; i++) osc('sine', base, t + i * 0.13, 0.08, 0.025, { f2: base * (1.2 + Math.random() * 0.3), bus: ambBus });
    }
    setTimeout(bird, 2500 + Math.random() * 6000);
  };
  setTimeout(bird, 3000);
}
export function setWindAmbience(speed) {
  if (!amb.wind) return;
  amb.wind.gain.setTargetAtTime(0.03 + speed * 0.012, now(), 0.5);
  amb.windFilter.frequency.setTargetAtTime(250 + speed * 50, now(), 0.5);
}
// Flight whistle: a looping band of noise whose pitch follows ball speed.
let flight = null;
export function flightSound(speed) {
  if (!ctx || muted) { if (flight) { flight.g.gain.value = 0; } return; }
  if (!flight) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3;
    const g = ctx.createGain(); g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start();
    flight = { f, g };
  }
  flight.g.gain.setTargetAtTime(Math.min(0.12, speed * 0.003), now(), 0.05);
  flight.f.frequency.setTargetAtTime(300 + speed * 40, now(), 0.05);
}

// ---------------------------------------------------------------- goose song
// The goose's theme: a sneaky honk-voiced march that plays while it carries
// your ball off. 4 bars at 132 bpm (~7.3 s), so the theft lasts exactly one
// performance. Returns a stop function (fades the song out early).
export const GOOSE_SONG_SECS = 32 * (60 / 132 / 2) + 0.45;
const mid = m => 440 * 2 ** ((m - 69) / 12);
export function gooseSong() {
  if (!ok()) return () => {};
  const bus = ctx.createGain(); bus.gain.value = 0.9; bus.connect(sfxBus);
  const t0 = now() + 0.05, e = 60 / 132 / 2;   // one eighth note
  // lead: every note is a little honk (square + saw, sagging pitch, a breath of noise)
  const lead = [69, 0, 72, 0, 69, 64, 0, 69, 71, 0, 72, 0, 74, 72, 71, 0, 69, 0, 72, 0, 76, 0, 74, 72, 71, 69, 68, 0, 69, 0, 0, 0];
  lead.forEach((m, i) => {
    if (!m) return;
    const t = t0 + i * e, f = mid(m), d = e * 0.8;
    osc('square', f, t, d, 0.075, { f2: f * 0.94, a: 0.008, bus });
    osc('sawtooth', f * 1.003, t, d, 0.05, { f2: f * 0.93, a: 0.008, bus, detune: 18 });
    noise(t, 0.05, 0.03, { type: 'bandpass', f: 1400, q: 5, bus });
  });
  // oom-pah bass on the beats
  const bass = [45, 52, 45, 52, 43, 50, 43, 50, 41, 48, 41, 48, 40, 47, 40, 45];
  bass.forEach((m, i) => osc('triangle', mid(m), t0 + i * 2 * e, e * 1.3, 0.22, { a: 0.006, bus }));
  // shaker on the off-beats
  for (let i = 1; i < 32; i += 2) noise(t0 + i * e, 0.04, 0.05, { type: 'highpass', f: 7000, bus });
  // the big finish: a triple honk, as the goose lets go
  for (let k = 0; k < 3; k++) {
    const t = t0 + 28 * e + k * 0.16, f = 300 - k * 25;
    osc('square', f, t, 0.15, 0.13, { f2: f * 0.75, a: 0.01, bus });
    osc('sawtooth', f * 1.01, t, 0.15, 0.1, { f2: f * 0.78, a: 0.01, bus, detune: 25 });
  }
  return () => {
    try { const t = now(); bus.gain.setValueAtTime(bus.gain.value, t); bus.gain.linearRampToValueAtTime(0.0001, t + 0.25); setTimeout(() => bus.disconnect(), 400); } catch { /* already gone */ }
  };
}

// ---------------------------------------------------------------- swing theremin
// One quiet voice during the backswing whose pitch follows the predicted
// carry in metres (so a full driver sings higher than a full wedge).
let ther = null;
export const swingTone = {
  start() {
    if (!ok()) return;
    this.stop();
    const o = ctx.createOscillator(), g = ctx.createGain(), t = now();
    o.type = 'triangle'; o.frequency.value = 220;
    g.gain.setValueAtTime(0.0001, t); g.gain.setTargetAtTime(0.045, t, 0.03);
    o.connect(g); g.connect(sfxBus); o.start(t);
    ther = { o, g, released: false };
  },
  set(metres) {
    if (!ther || ther.released) return;
    const f = Math.max(220, Math.min(1400, 220 * 2 ** (metres / 60)));
    ther.o.frequency.setTargetAtTime(f, now(), 0.03);
  },
  // downswing: the note drops an octave and dies away
  release() {
    if (!ther || ther.released) return;
    ther.released = true;
    const t = now(), { o, g } = ther;
    o.frequency.cancelScheduledValues(t); o.frequency.setValueAtTime(o.frequency.value, t); o.frequency.exponentialRampToValueAtTime(Math.max(60, o.frequency.value / 2), t + 0.12);
    g.gain.setTargetAtTime(0.0001, t + 0.05, 0.05);
    o.stop(t + 0.5); ther = null;
  },
  stop() {
    if (!ther) return;
    const t = now(); ther.g.gain.setTargetAtTime(0.0001, t, 0.02); ther.o.stop(t + 0.15); ther = null;
  },
};
