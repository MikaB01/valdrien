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
  reverb.buffer = impulse(ctx, 2.6);
  const wet = ctx.createGain();
  wet.gain.value = 0.35;
  music.bus = ctx.createGain();
  music.bus.connect(comp);
  music.bus.connect(reverb);
  reverb.connect(wet);
  wet.connect(comp);
  comp.connect(music.duck);
  music.duck.connect(music.out);
  music.out.connect(ctx.destination);
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
  music.stopTimer = setTimeout(() => { if (!music.playing) ctx.suspend().catch(() => {}); }, 2500);
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
  else if (music.playing) music.ctx.resume().catch(() => {});
});
// Browsers start audio only after a tap; this covers a reload in the middle of a running game.
document.addEventListener("pointerdown", () => { if (musicWanted()) startMusic(); }, { passive: true });

function scheduleMusic() {
  const ctx = music.ctx;
  const now = ctx.currentTime;
  if (!music.piece) {
    if (now < music.restUntil) return;
    music.piece = newPiece(state.adventure === "tavern" ? "tavern" : "forest", now + 0.3);
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

function tone(t, midi, length, { type = "sine", gain = 0.1, attack = 0.01, filter = 0, vibrato = 0, detune = 0 } = {}) {
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
  g.connect(music.bus);
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

function noiseHit(t, { gain = 0.05, length = 0.05, filter = 3000, type = "highpass" } = {}) {
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
  g.connect(music.bus);
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
  return kind === "tavern" ? tavernPiece(start) : forestPiece(start);
}

// Forest: slow, airy D major pentatonic with pad, harp arpeggios, a flute line and the odd bird.
function forestPiece(start) {
  const beat = 60 / pick([60, 66, 72]);
  const chords = pick([[[50, 54, 57], [47, 50, 54], [43, 47, 50], [45, 49, 52]], [[50, 54, 57], [43, 47, 50], [47, 50, 54], [45, 49, 52]]]);
  const melody = walker([62, 64, 66, 69, 71, 74, 76, 78, 81], 3);
  return {
    bars: pick([16, 20, 24]), bar: 0, nextBar: start, barLength: 4 * beat,
    play(bar, t) {
      const chord = chords[bar % chords.length];
      chord.forEach((m, k) => tone(t, m, 4 * beat, { type: k ? "sine" : "triangle", gain: 0.035, attack: 1.2, filter: 1400, detune: k * 4 }));
      tone(t, chord[0] - 12, 4 * beat, { type: "sine", gain: 0.05, attack: 0.8 });
      for (let e = 0; e < 8; e++) {
        if (Math.random() < 0.55) tone(t + e * beat / 2, chord[e % 3] + 12 * (e > 3 ? 2 : 1), 1.6, { type: "triangle", gain: 0.05, attack: 0.005 });
      }
      if (bar % 4 >= 2 || bar > 8) {
        let at = 0;
        while (at < 4) {
          const length = pick([1, 1, 2, 0.5]);
          if (Math.random() < 0.8) tone(t + at * beat, melody(), length * beat * 0.9, { type: "sine", gain: 0.045, attack: 0.08, vibrato: 3 });
          at += length;
        }
      }
      if (Math.random() < 0.3) {
        const bird = t + Math.random() * 3 * beat;
        for (let k = 0; k < 3; k++) tone(bird + k * 0.12, 98 + Math.floor(Math.random() * 5), 0.08, { gain: 0.012, attack: 0.01 });
      }
    }
  };
}

// Tavern: lively D dorian tune in 3/4 with plucked lute, bass, frame drum and a crackling fire.
function tavernPiece(start) {
  const beat = 60 / pick([108, 116, 124]);
  const chords = pick([[[50, 53, 57], [48, 52, 55], [50, 53, 57], [45, 48, 52]], [[50, 53, 57], [48, 52, 55], [53, 57, 60], [48, 52, 55]]]);
  const melody = walker([62, 64, 65, 67, 69, 71, 72, 74, 76, 77], 4);
  return {
    bars: pick([24, 32, 40]), bar: 0, nextBar: start, barLength: 3 * beat,
    play(bar, t) {
      const chord = chords[Math.floor(bar / 2) % chords.length];
      tone(t, chord[0] - 12, 2.5 * beat, { type: "triangle", gain: 0.11, attack: 0.01 });
      tone(t + 2 * beat, chord[2] - 12, beat, { type: "triangle", gain: 0.06, attack: 0.01 });
      drum(t, 0.22);
      if (Math.random() < 0.6) drum(t + 2 * beat, 0.09);
      chord.forEach(m => tone(t + beat, m, beat * 0.8, { type: "sawtooth", gain: 0.018, attack: 0.005, filter: 1800 }));
      chord.forEach(m => tone(t + 2 * beat, m, beat * 0.8, { type: "sawtooth", gain: 0.014, attack: 0.005, filter: 1800 }));
      if (bar >= 2) {
        for (let e = 0; e < 6; e++) {
          if (Math.random() < 0.8) tone(t + e * beat / 2, melody(), beat * 0.7, { type: "sawtooth", gain: 0.03, attack: 0.004, filter: 2600 });
        }
      }
      for (let k = 0; k < 4; k++) {
        if (Math.random() < 0.5) noiseHit(t + Math.random() * 3 * beat, { gain: 0.012 + Math.random() * 0.02, length: 0.02, filter: 2500 });
      }
    }
  };
}
