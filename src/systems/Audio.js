import * as THREE from 'three';

/**
 * Fully synthesised ambience (no audio files): filtered-noise wind with slow gusts, burbling
 * water through a PannerNode (3D positional — the Web Audio listener tracks the camera),
 * random bird chirps and lamp crackle. Mute state is remembered. No voice-over.
 */
export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.muted = (() => { try { return localStorage.getItem('indusverse.muted') === '1'; } catch { return false; } })();
    this.levels = { wind: 0, water: 0, birds: 0, crackle: 0 };
    this.target = { wind: 0, water: 0, birds: 0, crackle: 0 };
    this.waterPos = null;
    this.nextChirp = 2;
    this._fwd = new THREE.Vector3();
    this.onMuteChange = null;
  }

  /** Must be called from a user gesture (browser autoplay policy). */
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(ctx.destination);
    // 4s looping white noise
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    const src = () => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.loopStart = Math.random() * 3; s.start(); return s; };

    // wind: band-passed noise, freq and gain modulated by slow LFOs
    const wind = ctx.createGain(); wind.gain.value = 0;
    const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 420; wf.Q.value = 0.7;
    src().connect(wf); wf.connect(wind); wind.connect(this.master);
    const lfo = (rate, depth, param) => { const o = ctx.createOscillator(); o.frequency.value = rate; const g = ctx.createGain(); g.gain.value = depth; o.connect(g); g.connect(param); o.start(); };
    lfo(0.11, 220, wf.frequency); lfo(0.07, 0.35, wind.gain); // gain LFO centred by base, see update
    this.wind = wind; this.windF = wf;

    // water: bright noise through bandpass, with fast ripple modulation, spatialised
    const water = ctx.createGain(); water.gain.value = 0;
    const wb = ctx.createBiquadFilter(); wb.type = 'bandpass'; wb.frequency.value = 1500; wb.Q.value = 0.9;
    const wb2 = ctx.createBiquadFilter(); wb2.type = 'highpass'; wb2.frequency.value = 500;
    const panner = ctx.createPanner(); panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse'; panner.refDistance = 6; panner.rolloffFactor = 1.1; panner.maxDistance = 120;
    src().connect(wb); wb.connect(wb2); wb2.connect(water); water.connect(panner); panner.connect(this.master);
    lfo(3.1, 500, wb.frequency); lfo(5.3, 300, wb.frequency); lfo(0.4, 0.12, water.gain);
    this.water = water; this.panner = panner;

    // birds + crackle buses
    this.birdBus = ctx.createGain(); this.birdBus.gain.value = 0; this.birdBus.connect(this.master);
    this.crackle = ctx.createGain(); this.crackle.gain.value = 0;
    const cf = ctx.createBiquadFilter(); cf.type = 'highpass'; cf.frequency.value = 3000;
    src().connect(cf); cf.connect(this.crackle); this.crackle.connect(this.master);
  }

  setScene(cfg = {}) {
    for (const k of Object.keys(this.target)) this.target[k] = cfg[k] ?? 0;
    this.waterPos = cfg.waterPos ? new THREE.Vector3(...cfg.waterPos) : null;
  }

  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem('indusverse.muted', this.muted ? '1' : '0'); } catch {}
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.1);
    this.onMuteChange?.(this.muted);
    return this.muted;
  }

  /** Short UI blip. */
  blip(freq = 660, dur = 0.12, vol = 0.05) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 1.5, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }

  chirp() {
    const ctx = this.ctx, t = ctx.currentTime;
    const n = 2 + Math.floor(Math.random() * 3), base = 2200 + Math.random() * 1800;
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain(), st = t + i * 0.11;
      o.type = 'sine';
      o.frequency.setValueAtTime(base, st); o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.4), st + 0.07);
      o.frequency.exponentialRampToValueAtTime(base * 0.9, st + 0.1);
      g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(0.18, st + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, st + 0.1);
      o.connect(g); g.connect(this.birdBus); o.start(st); o.stop(st + 0.12);
    }
  }

  update(dt, camera, dusk = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx, k = 1 - Math.exp(-dt * 1.5);
    for (const key of Object.keys(this.levels)) this.levels[key] += (this.target[key] - this.levels[key]) * k;
    const t = ctx.currentTime;
    this.wind.gain.setTargetAtTime(this.levels.wind * 0.22, t, 0.2);
    this.water.gain.setTargetAtTime(this.levels.water * 0.5, t, 0.2);
    this.birdBus.gain.setTargetAtTime(this.levels.birds * (1 - dusk * 0.8), t, 0.2);
    this.crackle.gain.setTargetAtTime(this.levels.crackle * dusk * 0.05, t, 0.2);
    // listener follows the camera (3D positional water)
    camera.getWorldDirection(this._fwd);
    const L = ctx.listener, p = camera.position;
    if (L.positionX) {
      L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z;
      L.forwardX.value = this._fwd.x; L.forwardY.value = this._fwd.y; L.forwardZ.value = this._fwd.z;
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    }
    if (this.waterPos) this.panner.positionX.value = this.waterPos.x, this.panner.positionY.value = this.waterPos.y, this.panner.positionZ.value = this.waterPos.z;
    this.nextChirp -= dt;
    if (this.nextChirp <= 0) {
      this.nextChirp = 1.5 + Math.random() * 5;
      if (this.levels.birds > 0.05 && !this.muted) this.chirp();
    }
  }
}
