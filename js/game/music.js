// Background music while the event timer runs, generated live with the Web Audio API:
// no audio files and no licences. A piece of about 1-2 minutes, then a pause of 1-2 minutes ("now and then").
const music = { ctx: null, playing: false, interval: null, piece: null, restUntil: 0, noise: null, stopTimer: null };

function musicWanted() {
  return !own && settings.music !== false && Boolean(state.running && state.timerEnd) && !timerPaused();
}

function updateMusic() {
  if (musicWanted()) startMusic(); else stopMusic();
}

function musicVolume() { return 1.6 * Math.min(1, Math.max(0, settings.musicVolume ?? 0.5)); }

function audioGraph() {
  if (music.ctx) return music.ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  music.ctx = ctx;
  music.out = ctx.createGain();
  music.out.gain.value = 0.0001;
  music.duck = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  const reverb = ctx.createConvolver();
  reverb.buffer = impulse(ctx, 3.6);
  const wet = ctx.createGain();
  wet.gain.value = 0.45;
  // a dark room: the highs are taken off everything, the reverb tail even more
  const dark = ctx.createBiquadFilter();
  dark.type = "lowpass";
  dark.frequency.value = 3200;
  const darkTail = ctx.createBiquadFilter();
  darkTail.type = "lowpass";
  darkTail.frequency.value = 1800;
  music.bus = ctx.createGain();
  music.bus.connect(dark);
  dark.connect(comp);
  dark.connect(reverb);
  reverb.connect(darkTail);
  darkTail.connect(wet);
  wet.connect(comp);
  comp.connect(music.duck);
  music.duck.connect(music.out);
  music.out.connect(ctx.destination);
  music.sfx = ctx.createGain();
  music.sfx.gain.value = 0.9;
  const sfxWet = ctx.createGain();
  sfxWet.gain.value = 0.3;
  const sfxReverb = ctx.createConvolver();
  sfxReverb.buffer = reverb.buffer;
  music.sfx.connect(ctx.destination);
  music.sfx.connect(sfxReverb);
  sfxReverb.connect(sfxWet);
  sfxWet.connect(ctx.destination);
  music.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = music.noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return ctx;
}

function impulse(ctx, seconds) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
  }
  return buffer;
}

function startMusic() {
  const ctx = audioGraph();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  clearTimeout(music.stopTimer);
  if (music.playing) return;
  try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {}
  music.playing = true;
  music.piece = null;
  music.restUntil = ctx.currentTime + 2;
  music.out.gain.cancelScheduledValues(ctx.currentTime);
  music.out.gain.setTargetAtTime(musicVolume(), ctx.currentTime, 0.5);
  music.interval = setInterval(scheduleMusic, 250);
}

function stopMusic() {
  if (!music.playing) return;
  music.playing = false;
  clearInterval(music.interval);
  const ctx = music.ctx;
  music.out.gain.cancelScheduledValues(ctx.currentTime);
  music.out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4);
  music.stopTimer = setTimeout(() => { if (!music.playing && !soundOn()) ctx.suspend().catch(() => {}); }, 2500);
}

function setMusicVolume(value) {
  settings.musicVolume = Number(value) / 100;
  if (music.ctx && music.playing) music.out.gain.setTargetAtTime(musicVolume(), music.ctx.currentTime, 0.1);
}

function duckMusic(on) {
  if (music.ctx) music.duck.gain.setTargetAtTime(on ? 0.2 : 1, music.ctx.currentTime, 0.3);
}

document.addEventListener("visibilitychange", () => {
  if (!music.ctx) return;
  if (document.hidden) music.ctx.suspend().catch(() => {});
  else if (music.playing || soundOn()) music.ctx.resume().catch(() => {});
});
// Browsers start audio only after a tap; this covers a reload in the middle of a running game.
document.addEventListener("pointerdown", () => {
  if (musicWanted()) startMusic();
  else if (soundOn() && state.running) unlockAudio();
}, { passive: true });

function soundOn() { return settings.sound !== false; }

function unlockAudio() {
  const ctx = audioGraph();
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
}

// Short reward sound (about 1.5 s) when the time is up and a new card appears.
function playChime() {
  if (!soundOn()) return;
  const ctx = audioGraph();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  const t = ctx.currentTime + 0.05, out = music.sfx;
  if (state.adventure === "dungeon") {
    bell(t, 38, { gain: 0.18, length: 4, out });
    tone(t, 26, 2.5, { type: "sawtooth", gain: 0.05, attack: 0.05, filter: 300, out });
    [74, 73, 70, 69, 62].forEach((m, k) => bone(t + 0.5 + k * 0.11, m, { gain: 0.1, out }));
    keyJingle(t + 1.2, { gain: 0.05, out });
  } else if (state.adventure === "tavern") {
    [50, 53, 57, 62].forEach((m, k) => tone(t + k * 0.05, m, 1.3, { type: "sawtooth", gain: 0.05, attack: 0.004, filter: 1600, out }));
    bell(t + 0.35, 50, { gain: 0.08, length: 2.4, out });
    noiseHit(t, { gain: 0.06, length: 0.9, filter: 180, type: "lowpass", out });
  } else {
    [62, 65, 69, 74, 77].forEach((m, k) => tone(t + k * 0.09, m, 1.6, { type: "triangle", gain: 0.08, attack: 0.004, filter: 2400, out }));
    tone(t + 0.5, 38, 2.2, { type: "sine", gain: 0.1, attack: 0.3, out });
  }
}

// Buying a key: the jailer's bunch jingles, a lock clicks; the third key ends with an opening rattle.
function playKeySound(complete) {
  if (!soundOn()) return;
  const ctx = audioGraph();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  const t = ctx.currentTime + 0.05, out = music.sfx;
  keyJingle(t, { gain: 0.08, out });
  noiseHit(t + 0.55, { gain: 0.16, length: 0.03, filter: 1800, type: "bandpass", out });
  tone(t + 0.55, 45, 0.12, { type: "triangle", gain: 0.12, attack: 0.002, out });
  if (complete) [62, 65, 69, 74].forEach((m, k) => bone(t + 0.8 + k * 0.11, m, { gain: 0.1, out }));
}

// Breaking out: a creaking gate, a bell and a run up into the grey morning.
function playEscapeSound() {
  if (!soundOn()) return;
  const ctx = audioGraph();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  const t = ctx.currentTime + 0.05, out = music.sfx;
  creak(t, { out });
  bell(t + 1.1, 50, { gain: 0.12, length: 3, out });
  [50, 53, 57, 62, 65, 69, 74].forEach((m, k) => tone(t + 1.3 + k * 0.1, m, 1.6, { type: "triangle", gain: 0.06, attack: 0.004, filter: 2400, out }));
}

function scheduleMusic() {
  const ctx = music.ctx;
  const now = ctx.currentTime;
  if (!music.piece) {
    if (now < music.restUntil) return;
    music.piece = newPiece(["tavern", "dungeon"].includes(state.adventure) ? state.adventure : "forest", now + 0.3);
  }
  const p = music.piece;
  while (p.nextBar < now + 1 && p.bar < p.bars) {
    p.play(p.bar, p.nextBar);
    p.nextBar += p.barLength;
    p.bar++;
  }
  if (p.bar >= p.bars && now > p.nextBar) {
    music.piece = null;
    music.restUntil = now + 60 + Math.random() * 60;
  }
}

const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);
const pick = list => list[Math.floor(Math.random() * list.length)];

function tone(t, midi, length, { type = "sine", gain = 0.1, attack = 0.01, filter = 0, vibrato = 0, detune = 0, out = null } = {}) {
  const ctx = music.ctx;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = midiHz(midi);
  osc.detune.value = detune;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + length);
  let node = osc;
  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(filter, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(200, filter / 4), t + attack + length);
    node.connect(f);
    node = f;
  }
  node.connect(g);
  g.connect(out || music.bus);
  if (vibrato) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 5;
    depth.gain.value = vibrato;
    lfo.connect(depth);
    depth.connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + attack + length + 0.1);
  }
  osc.start(t);
  osc.stop(t + attack + length + 0.1);
}

function noiseHit(t, { gain = 0.05, length = 0.05, filter = 3000, type = "highpass", out = null } = {}) {
  const ctx = music.ctx;
  const src = ctx.createBufferSource();
  src.buffer = music.noise;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = filter;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + length);
  src.connect(f);
  f.connect(g);
  g.connect(out || music.bus);
  src.start(t, Math.random() * 0.5);
  src.stop(t + length + 0.05);
}

function drum(t, gain) {
  const ctx = music.ctx;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.frequency.setValueAtTime(120, t);
  osc.frequency.exponentialRampToValueAtTime(50, t + 0.15);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  osc.connect(g);
  g.connect(music.bus);
  osc.start(t);
  osc.stop(t + 0.4);
  noiseHit(t, { gain: gain * 0.25, length: 0.04, filter: 1500, type: "bandpass" });
}

// Random walk over a scale, staying near the chord.
function walker(scale, start) {
  let index = start;
  return () => {
    index = Math.min(scale.length - 1, Math.max(0, index + pick([-2, -1, -1, 1, 1, 2, 0])));
    return scale[index];
  };
}

function newPiece(kind, start) {
  if (kind === "dungeon") return dungeonPiece(start);
  return kind === "tavern" ? tavernPiece(start) : forestPiece(start);
}

// Low wind through the trees or the cracks in the wall: filtered noise that swells and fades.
function wind(t, length, { gain = 0.03, from = 300, to = 700 } = {}) {
  const ctx = music.ctx;
  const src = ctx.createBufferSource();
  src.buffer = music.noise;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(from, t);
  f.frequency.linearRampToValueAtTime(to, t + length / 2);
  f.frequency.linearRampToValueAtTime(from, t + length);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + length / 2);
  g.gain.linearRampToValueAtTime(0.0001, t + length);
  src.connect(f);
  f.connect(g);
  g.connect(music.bus);
  src.start(t);
  src.stop(t + length + 0.1);
}

// Forest at dusk: slow D minor with a low drone, dark pad, sparse harp, a lonely flute, wind and the odd owl.
function forestPiece(start) {
  const beat = 60 / pick([50, 54, 58]);
  const chords = pick([[[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]], [[50, 53, 57], [48, 52, 55], [46, 50, 53], [45, 49, 52]]]);
  const melody = walker([57, 60, 62, 64, 65, 67, 69, 72, 74], 3);
  return {
    bars: pick([14, 18, 22]), bar: 0, nextBar: start, barLength: 4 * beat,
    play(bar, t) {
      const chord = chords[bar % chords.length];
      chord.forEach((m, k) => tone(t, m - 12 * (k === 0), 4 * beat, { type: k ? "sine" : "triangle", gain: 0.035, attack: 1.6, filter: 900, detune: k * 5 }));
      tone(t, 38, 4 * beat, { type: "sine", gain: 0.06, attack: 1.2 });
      for (let e = 0; e < 8; e++) {
        if (Math.random() < 0.38) tone(t + e * beat / 2, chord[e % 3] + 12, 2.2, { type: "triangle", gain: 0.045, attack: 0.005, filter: 1800 });
      }
      if (bar >= 4 && bar % 4 !== 3) {
        let at = 0;
        while (at < 4) {
          const length = pick([1, 2, 2, 1.5]);
          if (Math.random() < 0.65) tone(t + at * beat, melody(), length * beat * 0.95, { type: "sine", gain: 0.04, attack: 0.15, vibrato: 4 });
          at += length;
        }
      }
      if (Math.random() < 0.3) wind(t + Math.random() * beat, 3 * beat, { gain: 0.025 });
      if (Math.random() < 0.12) {
        const owl = t + Math.random() * 2 * beat;
        tone(owl, 67, 0.35, { gain: 0.03, attack: 0.08 });
        tone(owl + 0.55, 63, 0.6, { gain: 0.025, attack: 0.1 });
      }
    }
  };
}

// Tavern in the storm: a heavy D minor tune in 3/4 with low lute, bass, muffled drum, fire crackle and distant thunder.
function tavernPiece(start) {
  const beat = 60 / pick([84, 90, 96]);
  const chords = pick([[[50, 53, 57], [48, 52, 55], [46, 50, 53], [45, 49, 52]], [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]]]);
  const melody = walker([57, 60, 62, 64, 65, 67, 69, 70, 73, 74], 4);
  return {
    bars: pick([24, 32, 40]), bar: 0, nextBar: start, barLength: 3 * beat,
    play(bar, t) {
      const chord = chords[Math.floor(bar / 2) % chords.length];
      tone(t, chord[0] - 12, 2.5 * beat, { type: "triangle", gain: 0.12, attack: 0.01 });
      tone(t + 2 * beat, chord[2] - 24, beat, { type: "triangle", gain: 0.06, attack: 0.01 });
      drum(t, 0.18);
      if (Math.random() < 0.4) drum(t + 2 * beat, 0.07);
      chord.forEach(m => tone(t + beat, m - 12, beat * 0.9, { type: "sawtooth", gain: 0.02, attack: 0.005, filter: 1100 }));
      chord.forEach(m => tone(t + 2 * beat, m - 12, beat * 0.9, { type: "sawtooth", gain: 0.016, attack: 0.005, filter: 1100 }));
      if (bar >= 2) {
        for (let e = 0; e < 6; e++) {
          if (Math.random() < 0.6) tone(t + e * beat / 2, melody(), beat * 0.8, { type: "sawtooth", gain: 0.026, attack: 0.004, filter: 1600 });
        }
      }
      for (let k = 0; k < 4; k++) {
        if (Math.random() < 0.5) noiseHit(t + Math.random() * 3 * beat, { gain: 0.01 + Math.random() * 0.015, length: 0.02, filter: 2500 });
      }
      if (Math.random() < 0.06) noiseHit(t, { gain: 0.09, length: 2.8, filter: 120, type: "lowpass" });
    }
  };
}

// Bell: inharmonic partials with a long decay (a tolling bell, also used for the event card sound).
function bell(t, midi, { gain = 0.1, length = 3, out = null } = {}) {
  [[0.5, 1], [1, 0.8], [1.19, 0.45], [1.5, 0.35], [2, 0.3], [2.74, 0.18], [3.76, 0.1]].forEach(([ratio, level], k) => {
    const ctx = music.ctx;
    const osc = ctx.createOscillator();
    osc.frequency.value = midiHz(midi) * ratio;
    const g = ctx.createGain();
    const end = length * (k ? 0.85 / Math.sqrt(k) : 1);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain * level, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + end);
    osc.connect(g);
    g.connect(out || music.bus);
    osc.start(t);
    osc.stop(t + end + 0.1);
  });
}

// Skeleton xylophone: a dry woody knock with a short bright overtone.
function bone(t, midi, { gain = 0.08, out = null } = {}) {
  tone(t, midi, 0.22, { type: "sine", gain, attack: 0.002, out });
  tone(t, midi + 24, 0.05, { type: "sine", gain: gain * 0.5, attack: 0.001, out });
  noiseHit(t, { gain: gain * 0.35, length: 0.015, filter: 2500, type: "bandpass", out });
}

// A bunch of keys: a cluster of short metallic pings.
function keyJingle(t, { gain = 0.06, out = null } = {}) {
  for (let k = 0; k < 9; k++) {
    const at = t + Math.random() * 0.45;
    tone(at, 96 + Math.floor(Math.random() * 10), 0.12 + Math.random() * 0.15, { gain: gain * (0.5 + Math.random() * 0.5), attack: 0.001, out });
    noiseHit(at, { gain: gain * 0.6, length: 0.02, filter: 6000, out });
  }
}

// Creaking iron gate: a slowly bending sawtooth through a resonant filter.
function creak(t, { out = null } = {}) {
  const ctx = music.ctx;
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(70, t);
  osc.frequency.linearRampToValueAtTime(110, t + 0.4);
  osc.frequency.linearRampToValueAtTime(62, t + 0.8);
  osc.frequency.linearRampToValueAtTime(95, t + 1.1);
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 900;
  f.Q.value = 8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
  osc.connect(f);
  f.connect(g);
  g.connect(out || music.bus);
  osc.start(t);
  osc.stop(t + 1.3);
}

// Dungeon: a slow dance of death in D phrygian, 3/4. An organ drone, a grave bell, a heartbeat drum,
// a skeleton xylophone in the low register, rattling chains and now and then a moan in the dark.
function dungeonPiece(start) {
  const beat = 60 / pick([62, 68, 74]);
  const chords = pick([
    [[50, 53, 57], [51, 55, 58], [50, 53, 57], [45, 49, 52], [46, 50, 53], [51, 55, 58], [50, 53, 57], [45, 49, 55]],
    [[50, 53, 57], [46, 50, 53], [51, 55, 58], [50, 53, 57], [43, 46, 50], [51, 55, 58], [45, 49, 52], [45, 49, 55]]
  ]);
  const melody = walker([57, 58, 61, 62, 64, 65, 67, 69, 70, 73, 74], 3);
  return {
    bars: pick([24, 32, 40]), bar: 0, nextBar: start, barLength: 3 * beat,
    play(bar, t) {
      const chord = chords[Math.floor(bar / 2) % chords.length];
      if (bar % 4 === 0) bell(t, 38, { gain: 0.09, length: 5 });
      if (bar % 2 === 0) {
        tone(t, chord[0] - 12, 6 * beat, { type: "sawtooth", gain: 0.05, attack: 0.8, filter: 420 });
        tone(t, chord[0] - 24, 6 * beat, { type: "sine", gain: 0.09, attack: 0.6 });
        chord.forEach((m, k) => tone(t, m - 12, 6 * beat, { type: "square", gain: 0.007, attack: 1.2, filter: 700, detune: k * 6 }));
      }
      drum(t, 0.16);
      drum(t + 0.28, 0.08);
      if (bar >= 2) {
        const rhythm = pick([[0, 2], [0, 1, 2], [0, 1.5], [1, 2], [0]]);
        rhythm.forEach(at => { if (Math.random() < 0.8) bone(t + at * beat, melody(), { gain: 0.08 }); });
      }
      if (Math.random() < 0.15) {
        const at = t + Math.random() * 2 * beat;
        for (let k = 0; k < 6; k++) noiseHit(at + k * 0.06 + Math.random() * 0.02, { gain: 0.022, length: 0.035, filter: 3000, type: "bandpass" });
      }
      if (bar > 6 && Math.random() < 0.08) {
        const ctx = music.ctx, at = t + beat;
        const osc = ctx.createOscillator(), g = ctx.createGain();
        osc.frequency.setValueAtTime(midiHz(57), at);
        osc.frequency.linearRampToValueAtTime(midiHz(52), at + 2.2);
        g.gain.setValueAtTime(0.0001, at);
        g.gain.linearRampToValueAtTime(0.025, at + 0.8);
        g.gain.linearRampToValueAtTime(0.0001, at + 2.4);
        osc.connect(g); g.connect(music.bus);
        osc.start(at); osc.stop(at + 2.5);
      }
      if (bar % 4 === 2 && Math.random() < 0.5) wind(t, 3 * beat, { gain: 0.02, from: 200, to: 450 });
    }
  };
}
