import { MarketAudio } from './MarketAudio.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

/**
 * Soundscape of the artisan workshop (synthesised, nothing modern): a turning pottery wheel,
 * furnace roar and crackle, stone-carving taps, clay slaps, metal clinks, goods being moved,
 * and the low murmur of artisans talking. Outside the building everything is muffled by a
 * low-pass filter that opens when you step inside. Activities can raise the wheel / furnace /
 * kiln levels and play thuds and chimes through `sfx`.
 */
export class WorkshopAudio extends MarketAudio {
  constructor(sys) {
    super(sys);
    const ctx = this.ctx;
    // muffling filter between the mix and the compressor (outside the walls)
    this.occ = ctx.createBiquadFilter(); this.occ.type = 'lowpass'; this.occ.frequency.value = 800; this.occ.Q.value = 0.4;
    this.out.disconnect(); this.out.connect(this.occ); this.occ.connect(this.comp);
    this.boost = { wheel: 0, furnace: 0, kiln: 0 };
    this.timers = { tap: 1, slap: 3, clink: 4, crackle: 0.3, move: 6, talk: 7 };
  }
  _buildBed() {
    const ctx = this.ctx;
    this.permanent = []; this.murmur = []; this.carts = [];
    const bus = (pos, vol) => { const r = this._route(pos, vol, { ref: 4, roll: 1 }); return r; };
    // furnace: filtered noise roar with slow breathing
    const n = this._noiseSrc(); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 0.6;
    this.furnaceGain = ctx.createGain(); this.furnaceGain.gain.value = 0;
    this.furnaceRoute = bus({ x: 8, y: 1, z: -8 }, 1);
    n.connect(lp); lp.connect(this.furnaceGain); this.furnaceGain.connect(this.furnaceRoute.input); n.start(); this.permanent.push(n);
    this.furnaceLp = lp;
    // pottery wheel: soft low rumble + whirr
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 58;
    const wn = this._noiseSrc(); const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 340; wf.Q.value = 1.2;
    const wl = ctx.createBiquadFilter(); wl.type = 'lowpass'; wl.frequency.value = 180;
    this.wheelGain = ctx.createGain(); this.wheelGain.gain.value = 0;
    this.wheelRoute = bus({ x: -7, y: 0.6, z: -6.8 }, 1);
    o.connect(wl); wl.connect(this.wheelGain); wn.connect(wf); wf.connect(this.wheelGain); this.wheelGain.connect(this.wheelRoute.input);
    o.start(); wn.start(); this.permanent.push(o, wn); this.wheelOsc = o;
    // very low room tone so the building never goes silent
    const room = this._noiseSrc(); const rl = ctx.createBiquadFilter(); rl.type = 'lowpass'; rl.frequency.value = 400;
    this.room = ctx.createGain(); this.room.gain.value = 0.02; room.connect(rl); rl.connect(this.room); this.room.connect(this.dry); room.start(); this.permanent.push(room);
    this.hush = this.room;
  }

  update(dt, camera, level) {
    const ctx = this.ctx, now = ctx.currentTime, cam = camera.position;
    this.cam.x = cam.x; this.cam.y = cam.y; this.cam.z = cam.z;
    const inside = cam.z < -0.4 && Math.abs(cam.x) < 10.4;
    this.occ.frequency.setTargetAtTime(inside ? 12000 : 650, now, 0.25);
    this.out.gain.setTargetAtTime(level * 2.1, now, 0.3);
    const b = this.boost, src = this.sys.workshopSource, sp = src?.audioSpots;
    this.furnaceGain.gain.setTargetAtTime(0.14 + b.furnace * 0.55 + b.kiln * 0.25 + Math.sin(now * 0.9) * 0.02, now, 0.2);
    this.furnaceLp.frequency.setTargetAtTime(480 + b.furnace * 380 + Math.sin(now * 1.7) * 60, now, 0.2);
    this.wheelGain.gain.setTargetAtTime(0.05 + b.wheel * 0.5, now, 0.25);
    this.wheelOsc.frequency.setTargetAtTime(52 + b.wheel * 14, now, 0.4);
    if (sp) {
      this.furnaceRoute.panner.positionX.value = sp.furnace.x; this.furnaceRoute.panner.positionZ.value = sp.furnace.z;
      this.wheelRoute.panner.positionX.value = sp.wheel.x; this.wheelRoute.panner.positionZ.value = sp.wheel.z;
    }
    for (let i = this.queue.length - 1; i >= 0; i--) { const q = this.queue[i]; q.t -= dt; if (q.t <= 0) { this.queue.splice(i, 1); try { q.fn(); } catch {} } }
    if (this.sys.muted || level < 0.05 || !sp) return;
    const T = this.timers; for (const k of Object.keys(T)) T[k] -= dt;
    if (T.tap <= 0) { // a little burst of chisel taps at the carving bench
      T.tap = rand(2.5, 5); const n = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) this.later(i * rand(0.16, 0.24), () => { this.burst(sp.carve, { vol: 0.35, freq: rand(2400, 4200), q: 2, dec: 0.03 }); this.ping(sp.carve, { freqs: [rand(1700, 2300)], vol: 0.08, dec: 0.05 }); });
    }
    if (T.slap <= 0) { T.slap = rand(3, 7); this.burst(sp.wheel, { vol: 0.35, freq: 420, q: 0.7, att: 0.01, dec: 0.12 }); this.ping(sp.wheel, { freqs: [rand(110, 160)], vol: 0.12, dec: 0.1, glide: 0.6 }); }
    if (T.clink <= 0) { T.clink = rand(4, 9); this.metal(pick([sp.furnace, sp.bench])); }
    if (T.crackle <= 0) { T.crackle = rand(0.12, 0.5); this.burst(sp.furnace, { vol: rand(0.1, 0.3), freq: rand(3000, 6500), type: 'highpass', q: 0.5, dec: rand(0.01, 0.04) }); }
    if (T.move <= 0) { T.move = rand(6, 12); const p = pick([sp.bench, sp.carve, sp.wheel]); this.thud(p); this.later(rand(0.2, 0.5), () => this.clay(p)); }
    if (T.talk <= 0) { // two artisans murmuring now and then
      T.talk = rand(9, 16); const [a, c] = sp.helpers, f = [rand(100, 150), rand(170, 230)];
      for (let i = 0; i < 3; i++) this.later(i * rand(1.0, 1.6), () => this.voice(i % 2 ? c : a, { f0: f[i % 2], syl: 3 + Math.floor(Math.random() * 5), sylDur: rand(0.17, 0.23), vol: 0.22, slope: i % 2 ? 0.2 : -0.2 }));
    }
  }
  // ---- levers used by the activities
  setBoost(k, v) { this.boost[k] = v; }
}
