// Sound effects are synthesized live with WebAudio; the music is audio/song.mp3.
const r = (a, b) => a + Math.random() * (b - a);

export class Sound {
  constructor() { this.ctx = null; this.muted = false; try { this.muted = localStorage.getItem('der-muted') === '1'; } catch (e) { } this.loops = {}; }
  init() {
    if (this.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : .9;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(c.destination);
    this.sfx = this.bus(.9); this.amb = this.bus(1);
    // music skips the effects compressor so the (already limited) song plays at full loudness
    this.musOut = c.createGain(); this.musOut.gain.value = this.muted ? 0 : 1; this.musOut.connect(c.destination);
    this.mus = c.createGain(); this.mus.gain.value = 0; this.mus.connect(this.musOut);
    const len = c.sampleRate * 2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.nb = b; return true;
  }
  bus(v) { const g = this.ctx.createGain(); g.gain.value = v; g.connect(this.master); return g; }
  resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume(); }
  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  setMuted(m) {
    this.muted = m; try { localStorage.setItem('der-muted', m ? '1' : '0'); } catch (e) { }
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : .9, this.ctx.currentTime, .05);
    if (this.ctx) this.musOut.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, .05);
  }
  get now() { return this.ctx.currentTime; }
  noise(start = 0) { const s = this.ctx.createBufferSource(); s.buffer = this.nb; s.loop = true; s.loopStart = 0; s.loopEnd = 2; s.start(this.now + start, r(0, 1.9)); return s; }
  filt(type, f, q = 1) { const x = this.ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x; }
  gain(v) { const g = this.ctx.createGain(); g.gain.value = v; return g; }
  env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  tone(type, f, t, dur, vol, out, f2) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + .006); g.gain.setValueAtTime(vol, t + Math.max(.01, dur - .04)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + .03);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + .05);
  }
  burst(t, dur, vol, type, f, out, q = .8, f2) {
    const s = this.ctx.createBufferSource(); s.buffer = this.nb; const fl = this.filt(type, f, q); const g = this.gain(0);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    this.env(g, t, .004, vol, dur); s.connect(fl); fl.connect(g); g.connect(out); s.start(t, r(0, 1.5)); s.stop(t + dur + .05);
  }
  stopLoop(name, fade = .6) {
    const L = this.loops[name]; if (!L) return; delete this.loops[name];
    const t = this.now; L.g.gain.setTargetAtTime(0.0001, t, fade / 3); clearInterval(L.iv);
    setTimeout(() => { L.nodes.forEach(n => { try { n.stop(); } catch (e) { } }); L.g.disconnect(); }, fade * 1000 + 300);
  }
  /* ---------- ambiences ---------- */
  startRoom() {
    if (!this.ctx || this.loops.room) return;
    const g = this.gain(0); g.connect(this.amb); g.gain.setTargetAtTime(1, this.now, .4);
    const n = this.noise(); const bp = this.filt('bandpass', 700, .5); const ng = this.gain(.05); n.connect(bp); bp.connect(ng); ng.connect(g);
    const h = this.noise(); const hp = this.filt('highpass', 5000); const hg = this.gain(.012); h.connect(hp); hp.connect(hg); hg.connect(g);
    const iv = setInterval(() => { const t = this.now + r(0, .1); if (Math.random() < .7) this.burst(t, r(.008, .05), r(.05, .3), 'highpass', r(1200, 3500), g); }, 90);
    this.loops.room = { g, nodes: [n, h], iv };
  }
  startDrive() {
    if (!this.ctx || this.loops.drive) return;
    const c = this.ctx, g = this.gain(0); g.connect(this.amb); g.gain.setTargetAtTime(1, this.now, .8);
    const w = this.noise(); const wl = this.filt('lowpass', 600, .7); const wg = this.gain(.11); w.connect(wl); wl.connect(wg); wg.connect(g);
    const lfo = c.createOscillator(); lfo.frequency.value = .13; const lg = this.gain(260); lfo.connect(lg); lg.connect(wl.frequency); lfo.start();
    const j = this.noise(); const jl = this.filt('lowpass', 210, .9); this.jetG = this.gain(.13); j.connect(jl); jl.connect(this.jetG); this.jetG.connect(g);
    const saw = c.createOscillator(); saw.type = 'sawtooth'; saw.frequency.value = 46; const sl = this.filt('lowpass', 140); const sg = this.gain(.05); saw.connect(sl); sl.connect(sg); sg.connect(g); saw.start(); this.jetOsc = saw;
    const hN = this.noise(); const hb = this.filt('bandpass', 150, 1.2); const hg = this.gain(.05); const am = c.createOscillator(); am.type = 'square'; am.frequency.value = 11.5; const amg = this.gain(.05);
    am.connect(amg); amg.connect(hg.gain); hN.connect(hb); hb.connect(hg); hg.connect(g); am.start(); this.rotorG = hg; this.rotorAM = amg;
    const iv = setInterval(() => { if (Math.random() < .08) this.siren(); }, 2500);
    this.loops.drive = { g, nodes: [w, lfo, j, saw, hN, am], iv };
  }
  // chopper rotor loudness, k = 0 far … 1 right behind the sleigh
  heliNear(k) {
    if (!this.rotorG) return; const t = this.now;
    this.rotorG.gain.setTargetAtTime(.03 + k * .09, t, .25); this.rotorAM.gain.setTargetAtTime(.03 + k * .09, t, .25);
  }
  // police siren coming in from far away: quiet at first, loud on arrival, then fades
  sirenIn(dur = 5) {
    if (!this.ctx) return; const c = this.ctx, t = this.now, T = dur + 2, o = c.createOscillator(), o2 = c.createOscillator(), g = this.gain(0), bp = this.filt('bandpass', 1000, 1.2);
    const n = Math.max(3, Math.round(T / .6)) | 1, f = new Float32Array(n), f2 = new Float32Array(n);
    for (let i = 0; i < n; i++) { const d = 1 + .045 * Math.min(1, i / n * T / dur); f[i] = (i % 2 ? 1280 : 660) * d; f2[i] = f[i] * .5; }
    o.type = 'sine'; o.frequency.setValueCurveAtTime(f, t, T); o2.type = 'square'; o2.frequency.setValueCurveAtTime(f2, t, T);
    const og = this.gain(.25); o2.connect(og); og.connect(bp); o.connect(bp); bp.connect(g); g.connect(this.amb);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.06, t + dur); g.gain.setValueAtTime(.06, t + dur + .3); g.gain.linearRampToValueAtTime(0, t + T);
    o.start(t); o2.start(t); o.stop(t + T + .05); o2.stop(t + T + .05);
  }
  setBoost(b) { if (this.jetG) { this.jetG.gain.setTargetAtTime(.13 + b * .3, this.now, .2); this.jetOsc.frequency.setTargetAtTime(46 + b * 40, this.now, .3); } }
  siren() {
    if (!this.ctx) return; const c = this.ctx, t = this.now, o = c.createOscillator(), g = this.gain(0), bp = this.filt('bandpass', 900, 2);
    o.type = 'sine'; const curve = new Float32Array([620, 900, 1240, 900, 620, 900, 1240, 900, 620]); o.frequency.setValueCurveAtTime(curve, t, 2.6);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.035, t + .3); g.gain.linearRampToValueAtTime(0, t + 2.6); o.connect(bp); bp.connect(g); g.connect(this.amb); o.start(t); o.stop(t + 2.7);
  }
  /* ---------- music: the project's song, looped ---------- */
  loadSong(url) { this.songP = fetch(url).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null); }
  startMusic() {
    if (!this.ctx || this.musOn || !this.songP) return; this.musOn = true;
    this.mus.gain.cancelScheduledValues(this.now); this.mus.gain.setTargetAtTime(1, this.now, .5);
    const buf = this.songBuf ? Promise.resolve(this.songBuf) : this.songP.then(ab => ab && new Promise((ok, no) => this.ctx.decodeAudioData(ab, ok, no))).catch(() => null);
    buf.then(b => {
      if (!b || !this.musOn || this.songSrc) return; this.songBuf = b;
      const s = this.ctx.createBufferSource(); s.buffer = b; s.loop = true; s.connect(this.mus); s.start(); this.songSrc = s;
    });
  }
  stopMusic() { this.musOn = false; if (this.ctx) this.mus.gain.setTargetAtTime(0, this.now, .3); const s = this.songSrc; this.songSrc = null; if (s) setTimeout(() => { try { s.stop(); } catch (e) { } }, 1200); }
  /* ---------- effects ---------- */
  shot() { if (!this.ctx) return; const t = this.now; this.burst(t, .32, .9, 'lowpass', 2600, this.sfx, .7, 400); this.burst(t, .04, .6, 'highpass', 3000, this.sfx); this.tone('sine', 120, t, .22, .7, this.sfx, 38); }
  zap(dur = 1.4) {
    if (!this.ctx) return; const t = this.now, s = this.ctx.createBufferSource(); s.buffer = this.nb; s.loop = true; const bp = this.filt('bandpass', 2600, 3); const g = this.gain(0);
    for (let k = 0; k < dur; k += .03) g.gain.setValueAtTime(Math.random() < .55 ? r(.08, .3) : 0, t + k); g.gain.setValueAtTime(0, t + dur);
    s.connect(bp); bp.connect(g); g.connect(this.sfx); s.start(t); s.stop(t + dur + .1); this.tone('sawtooth', 70, t, dur, .05, this.sfx, 140);
  }
  suck() { if (!this.ctx) return; const t = this.now; this.burst(t, 1.6, .45, 'bandpass', 2800, this.sfx, 1.2, 160); this.tone('sine', 700, t, 1.5, .16, this.sfx, 60); }
  boom() { if (!this.ctx) return; const t = this.now; this.tone('sine', 90, t, 1.1, .8, this.sfx, 28); this.burst(t, 1.2, .45, 'lowpass', 500, this.sfx, .7, 80); this.burst(t, .25, .35, 'highpass', 4000, this.sfx); }
  whoosh() { if (!this.ctx) return; const t = this.now; this.burst(t, .7, .22, 'bandpass', 500, this.sfx, 1.4, 2200); }
  blip() { if (!this.ctx) return; const t = this.now; this.tone('square', 990, t, .04, .05, this.sfx); this.tone('square', 1480, t + .045, .05, .05, this.sfx); }
  ching() { if (!this.ctx) return; const t = this.now; this.burst(t, .05, .25, 'highpass', 5000, this.sfx); this.tone('triangle', 1568, t + .02, .25, .16, this.sfx); this.tone('triangle', 2637, t + .1, .55, .14, this.sfx); }
  clank() { if (!this.ctx) return; const t = this.now; this.tone('square', r(900, 1300), t, .05, .09, this.sfx, 500); this.burst(t, .08, .35, 'bandpass', 3200, this.sfx, 3); this.tone('triangle', 2400, t + .01, .18, .05, this.sfx, 1800); }
  whistle(T = 1) { if (!this.ctx) return; const t = this.now; this.tone('sine', 1900, t, T, .07, this.sfx, 520); this.burst(t, T, .05, 'bandpass', 1400, this.sfx, 6, 500); }
  explode(k = 1) { if (!this.ctx) return; const t = this.now; this.tone('sine', 70, t, 1.4, .95 * k, this.sfx, 24); this.burst(t, 1.6, .7 * k, 'lowpass', 900, this.sfx, .7, 60); this.burst(t, .35, .5 * k, 'highpass', 2500, this.sfx);
    for (let i = 0; i < 10; i++) this.burst(t + .15 + Math.random() * .9, .04, .12 * k, 'highpass', 3000 + Math.random() * 3000, this.sfx); }
  glass() { if (!this.ctx) return; const t = this.now; this.burst(t, .25, .5, 'highpass', 4500, this.sfx); for (let i = 0; i < 9; i++) this.tone('sine', r(3500, 7500), t + Math.random() * .35, .12, .03, this.sfx); this.tone('square', 220, t, .06, .12, this.sfx, 90); }
  tvOn() { if (!this.ctx) return; const t = this.now; this.tone('sine', 60, t, .25, .4, this.sfx, 40); this.burst(t, .5, .2, 'highpass', 3000, this.sfx); this.tone('sine', 15000, t + .05, .4, .01, this.sfx); }
}
