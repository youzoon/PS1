// ============================================================
//  Audio: synthesized chiptune SFX + procedural music (WebAudio)
// ============================================================
const Sfx = (() => {
  let ctx = null, master, sfxBus, musBus, noiseBuf, comp;
  const last = {};
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { ctx = null; return; }
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master = ctx.createGain(); master.gain.value = 0.9;
    sfxBus = ctx.createGain(); musBus = ctx.createGain();
    sfxBus.connect(comp); musBus.connect(comp); comp.connect(master); master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVolumes();
  }
  function applyVolumes() {
    if (!ctx) return;
    sfxBus.gain.value = SAVE.settings.sfx * 0.55;
    musBus.gain.value = SAVE.settings.music * 0.32;
  }
  function tone(f, dur, type = 'square', vol = 0.3, f2 = null, delay = 0, bus = sfxBus) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, freq = 1200, vol = 0.3, type = 'lowpass', delay = 0, f2 = null, bus = sfxBus) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(freq, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(bus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  const defs = {
    whoosh: () => noise(0.12, 900, 0.18, 'bandpass', 0, 3000),
    hit: (p = 1) => { noise(0.09, 2200, 0.35 * p); tone(140 * R(0.9, 1.1), 0.12, 'square', 0.25 * p, 50); },
    heavy: () => { noise(0.2, 1400, 0.45, 'lowpass', 0, 200); tone(90, 0.25, 'sawtooth', 0.35, 35); },
    crit: () => { tone(880, 0.08, 'square', 0.2, 1760); noise(0.12, 4000, 0.3, 'highpass'); tone(110, 0.2, 'square', 0.3, 40); },
    block: () => { tone(1200, 0.05, 'square', 0.18, 900); tone(2400, 0.08, 'triangle', 0.12); },
    jump: () => tone(260, 0.14, 'square', 0.14, 620),
    land: () => noise(0.08, 500, 0.2),
    hurt: () => { tone(420, 0.18, 'sawtooth', 0.2, 120); },
    die: () => { tone(500, 0.5, 'square', 0.22, 60); noise(0.4, 800, 0.2, 'lowpass', 0.05, 100); },
    coin: () => { tone(988, 0.06, 'square', 0.13); tone(1319, 0.2, 'square', 0.13, null, 0.06); },
    gem: () => tone(1400 + Math.random() * 500, 0.07, 'triangle', 0.12, 2400),
    heal: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.15, 'triangle', 0.16, null, i * 0.06)); },
    levelup: () => { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.18, 'square', 0.12, null, i * 0.07)); },
    select: () => tone(660, 0.07, 'square', 0.12, 990),
    back: () => tone(500, 0.08, 'square', 0.1, 330),
    card: () => { tone(392, 0.08, 'triangle', 0.15); tone(784, 0.12, 'triangle', 0.12, null, 0.05); },
    fire: () => { noise(0.35, 700, 0.35, 'lowpass', 0, 2500); tone(180, 0.3, 'sawtooth', 0.12, 90); },
    boom: () => { noise(0.6, 900, 0.55, 'lowpass', 0, 90); tone(70, 0.5, 'sine', 0.5, 30); },
    ice: () => { [1800, 2400, 3100].forEach((f, i) => tone(f, 0.18, 'triangle', 0.1, f * 0.8, i * 0.03)); noise(0.15, 5000, 0.15, 'highpass'); },
    shatter: () => { noise(0.3, 6000, 0.35, 'highpass'); [2600, 3300, 2100].forEach((f, i) => tone(f, 0.12, 'square', 0.07, null, i * 0.04)); },
    quake: () => { noise(0.9, 300, 0.7, 'lowpass', 0, 60); tone(50, 0.8, 'sawtooth', 0.35, 28); },
    zap: () => { tone(R(900, 1400), 0.15, 'sawtooth', 0.18, R(100, 300)); noise(0.1, 3000, 0.25, 'bandpass'); },
    time: () => { tone(200, 0.6, 'sine', 0.3, 900); tone(300, 0.6, 'triangle', 0.15, 1400, 0.05); },
    timeStop: () => { tone(1500, 0.9, 'sine', 0.3, 80); noise(0.6, 2000, 0.2, 'bandpass', 0, 200); },
    blink: () => { tone(1800, 0.1, 'square', 0.12, 300); },
    throw: () => noise(0.16, 700, 0.25, 'bandpass', 0, 1800),
    crate: () => { noise(0.2, 900, 0.4, 'lowpass', 0, 200); tone(160, 0.1, 'square', 0.15, 80); },
    roar: () => { noise(1.1, 400, 0.6, 'bandpass', 0, 150); tone(90, 1.0, 'sawtooth', 0.4, 45); tone(95, 1.0, 'sawtooth', 0.3, 47); },
    banner: () => { [392, 392, 523].forEach((f, i) => tone(f, i === 2 ? 0.35 : 0.1, 'square', 0.14, null, i * 0.12)); },
    win: () => { [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, i === 5 ? 0.5 : 0.14, 'square', 0.14, null, i * 0.12)); },
    lose: () => { [392, 370, 349, 330].forEach((f, i) => tone(f, i === 3 ? 0.7 : 0.25, 'triangle', 0.18, null, i * 0.22)); },
    overdrive: () => { [262, 330, 392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'sawtooth', 0.1, null, i * 0.035)); noise(0.5, 1200, 0.3, 'bandpass', 0.1, 6000); },
    moo: () => { tone(140, 0.7, 'sawtooth', 0.22, 110); tone(142, 0.7, 'square', 0.1, 108); },
    cheat: () => { [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.09, 'square', 0.12, null, i * 0.05)); },
    typeKey: () => tone(1600 + Math.random() * 200, 0.03, 'square', 0.05),
    typeMiss: () => tone(160, 0.12, 'square', 0.14, 110),
    step: () => noise(0.03, 400, 0.06),
    dialup: () => { [1200, 2100, 900, 1800, 2400, 1300].forEach((f, i) => tone(f, 0.12, i % 2 ? 'square' : 'sawtooth', 0.07, f * 1.2, i * 0.09)); noise(0.5, 3000, 0.1, 'bandpass', 0.55, 1200); },
  };
  function play(name, p) {
    if (!ctx || SAVE.settings.sfx <= 0) return;
    const now = performance.now();
    if (last[name] && now - last[name] < 35) return; // de-dupe bursts
    last[name] = now;
    const fn = defs[name];
    if (fn) try { fn(p); } catch (e) { /* ignore */ }
  }

  // ---------------- procedural music ----------------
  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
    phryg: [0, 1, 3, 5, 7, 8, 10], mixo: [0, 2, 4, 5, 7, 9, 10], harm: [0, 2, 3, 5, 7, 8, 11], pent: [0, 2, 4, 7, 9, 12, 14],
  };
  const THEMES = {
    title:   { bpm: 128, root: 57, scale: 'dorian', prog: [0, 5, 3, 4], lead: 'square', bass: 'triangle', drums: 'rock', seed: 11 },
    map:     { bpm: 104, root: 60, scale: 'major', prog: [0, 3, 4, 0], lead: 'triangle', bass: 'triangle', drums: 'soft', seed: 22 },
    meadow:  { bpm: 132, root: 60, scale: 'major', prog: [0, 4, 5, 3], lead: 'square', bass: 'triangle', drums: 'rock', seed: 33 },
    forest:  { bpm: 120, root: 57, scale: 'dorian', prog: [0, 6, 5, 6], lead: 'triangle', bass: 'triangle', drums: 'shuffle', seed: 44 },
    desert:  { bpm: 124, root: 62, scale: 'harm', prog: [0, 1, 0, 6], lead: 'sawtooth', bass: 'square', drums: 'tribal', seed: 55 },
    ice:     { bpm: 116, root: 64, scale: 'minor', prog: [0, 5, 2, 6], lead: 'triangle', bass: 'triangle', drums: 'soft', seed: 66 },
    volcano: { bpm: 146, root: 52, scale: 'phryg', prog: [0, 1, 0, 6], lead: 'sawtooth', bass: 'sawtooth', drums: 'metal', seed: 77 },
    neon:    { bpm: 138, root: 57, scale: 'minor', prog: [0, 5, 6, 4], lead: 'square', bass: 'sawtooth', drums: 'disco', seed: 88 },
    glitch:  { bpm: 150, root: 50, scale: 'harm', prog: [0, 1, 4, 0], lead: 'square', bass: 'sawtooth', drums: 'metal', seed: 99 },
    boss:    { bpm: 156, root: 52, scale: 'harm', prog: [0, 5, 1, 4], lead: 'sawtooth', bass: 'square', drums: 'metal', seed: 123 },
    cow:     { bpm: 112, root: 65, scale: 'major', prog: [0, 3, 0, 4], lead: 'triangle', bass: 'square', drums: 'polka', seed: 7 },
    typing:  { bpm: 120, root: 60, scale: 'mixo', prog: [0, 6, 3, 0], lead: 'square', bass: 'triangle', drums: 'disco', seed: 17 },
    victory: { bpm: 140, root: 60, scale: 'major', prog: [0, 3, 4, 0], lead: 'square', bass: 'triangle', drums: 'rock', seed: 5 },
  };
  let seq = null;
  function buildSong(th) {
    const r = makeRng(th.seed * 7919);
    const sc = SCALES[th.scale];
    const note = (deg, oct = 0) => {
      const n = sc.length;
      const o = Math.floor(deg / n);
      const d = ((deg % n) + n) % n;
      return th.root + sc[d] + 12 * (o + oct);
    };
    // 4 bars x 16 steps; two phrases (A/B) for variety
    const phrases = [];
    for (let ph = 0; ph < 2; ph++) {
      const lead = [], bass = [], arp = [];
      for (let bar = 0; bar < 4; bar++) {
        const chord = th.prog[bar] + (ph === 1 && bar === 3 ? 1 : 0);
        let last = chord + 7;
        for (let s = 0; s < 16; s++) {
          // bass: root/fifth pumping eighths
          bass.push(s % 2 === 0 ? note(chord + (s % 8 === 4 ? 4 : 0), -2) : null);
          // arpeggio of chord tones
          arp.push(s % 2 === 1 ? note(chord + [0, 2, 4, 7][(s >> 1) % 4], 0) : null);
          // melody: rhythmic motif with chord-tone targets on strong beats
          const strong = s % 4 === 0;
          const play = strong ? r() < 0.85 : r() < (ph ? 0.5 : 0.35);
          if (play) {
            if (strong) last = chord + r.pick([0, 2, 4, 7]);
            else last += r.pick([-1, 1, 1, 2, -2]);
            lead.push({ n: note(last, 1), len: strong && r() < 0.4 ? 2 : 1 });
          } else lead.push(null);
        }
      }
      phrases.push({ lead, bass, arp });
    }
    return phrases;
  }
  function drumHit(kind, t, style) {
    if (kind === 'k') {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.connect(g); g.connect(musBus); o.start(t); o.stop(t + 0.16);
    } else if (kind === 's') {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = style === 'metal' ? 1200 : 1800;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      s.connect(f); f.connect(g); g.connect(musBus); s.start(t, Math.random() * 0.5); s.stop(t + 0.14);
    } else if (kind === 'h') {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      s.connect(f); f.connect(g); g.connect(musBus); s.start(t, Math.random() * 0.5); s.stop(t + 0.05);
    }
  }
  const DRUMS = {
    rock:    ['k.h.s.h.k.k.s.h.', 'k.h.s.h.k.hks.hs'],
    soft:    ['k...h...s...h...', 'k...h..ks...h.h.'],
    shuffle: ['k..hs..hk..hs.hh', 'k..hs..hk.khs.hs'],
    tribal:  ['k.hkh.s.k.hkh.ss', 'k.hkh.s.kkhkhsss'],
    metal:   ['kkhskkhskkhskkhs', 'kkskkkskkksskss.'],
    disco:   ['khshkhshkhshkhsh', 'khshkhshkhshkss.'],
    polka:   ['k.s.k.s.k.s.k.s.', 'k.s.k.s.k.s.kss.'],
  };
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function playMusic(name) {
    if (!ctx) return;
    if (seq && seq.name === name) return;
    stopMusic();
    const th = THEMES[name] || THEMES.meadow;
    const song = buildSong(th);
    const stepDur = 60 / th.bpm / 4;
    seq = { name, th, song, step: 0, next: ctx.currentTime + 0.1, stepDur, timer: null, gain: ctx.createGain() };
    seq.gain.gain.value = 0.0001;
    seq.gain.connect(musBus);
    seq.gain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 1.2);
    const s = seq;
    s.timer = setInterval(() => schedule(s), 40);
  }
  function schedule(s) {
    if (!ctx || seq !== s) return;
    while (s.next < ctx.currentTime + 0.15) {
      const total = 64 * 2;
      const i = s.step % total;
      const ph = s.song[Math.floor(i / 64)];
      const j = i % 64;
      const t = s.next;
      const L = ph.lead[j];
      if (L) mtone(mtof(L.n), s.stepDur * (L.len + 0.6), s.th.lead, 0.09, t, s);
      if (ph.bass[j] != null) mtone(mtof(ph.bass[j]), s.stepDur * 1.6, s.th.bass, 0.16, t, s);
      if (ph.arp[j] != null && s.th.drums !== 'soft') mtone(mtof(ph.arp[j]), s.stepDur * 0.9, 'triangle', 0.035, t, s);
      const pat = DRUMS[s.th.drums][Math.floor(j / 16) === 3 ? 1 : 0];
      const d = pat[j % 16];
      if (d === 'k' || d === 's' || d === 'h') drumHit(d, t, s.th.drums);
      s.step++;
      s.next += s.stepDur;
    }
  }
  function mtone(f, dur, type, vol, t, s) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(s.gain);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function stopMusic() {
    if (!seq) return;
    const s = seq; seq = null;
    clearInterval(s.timer);
    try {
      s.gain.gain.cancelScheduledValues(ctx.currentTime);
      s.gain.gain.setValueAtTime(s.gain.gain.value, ctx.currentTime);
      s.gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
      setTimeout(() => s.gain.disconnect(), 600);
    } catch (e) { /* ignore */ }
  }
  function setMusicRate(mul) { if (seq) seq.stepDur = 60 / seq.th.bpm / 4 / mul; }
  return { init, play, playMusic, stopMusic, applyVolumes, setMusicRate, get ready() { return !!ctx; }, get current() { return seq && seq.name; } };
})();
