import { MarketAudio } from './MarketAudio.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

/**
 * Riverside soundscape (synthesised): water lapping at the quay and hulls, creaking timber, ropes, cargo set down on planks, and crickets that fade in at dusk.
 * The scene supplies live positions and the dusk amount through `audio.dockSource`.
 */
export class DockAudio extends MarketAudio {
  constructor(sys) {
    super(sys);
    this.timers = { thud: 5, creak: 2, rope: 8, cricket: 0.4, clay: 7 };
  }
  _buildBed() {
    const ctx = this.ctx;
    this.permanent = []; this.murmur = []; this.carts = [];
    // lapping water against hulls and the stone quay
    const n = this._noiseSrc(); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = 0.8;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    this.lap = ctx.createGain(); this.lap.gain.value = 0.12;
    const route = this._route({ x: 0, y: 0.3, z: -8 }, 1, { ref: 6, roll: 0.8 });
    n.connect(bp); bp.connect(lp); lp.connect(this.lap); this.lap.connect(route.input); n.start(); this.permanent.push(n);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.23; const lg = ctx.createGain(); lg.gain.value = 0.05; lfo.connect(lg); lg.connect(this.lap.gain); lfo.start(); this.permanent.push(lfo);
    // faint hush of the wider riverside
    const h = this._noiseSrc(); const hb = ctx.createBiquadFilter(); hb.type = 'bandpass'; hb.frequency.value = 900; hb.Q.value = 0.4;
    this.hush = ctx.createGain(); this.hush.gain.value = 0.02; h.connect(hb); hb.connect(this.hush); this.hush.connect(this.dry); h.start(); this.permanent.push(h);
  }
  creak(pos) {
    const f = rand(160, 280);
    this.ping(pos, { freqs: [f, f * 1.5], vol: 0.07, dec: rand(0.25, 0.5), type: 'sawtooth', glide: rand(0.8, 1.25) });
    this.burst(pos, { vol: 0.05, freq: rand(900, 1500), q: 6, att: 0.05, dec: 0.3 });
  }
  cricket(pos) {
    const f = rand(4300, 5200), n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) this.ping(pos, { freqs: [f], vol: 0.025, dec: 0.035, delay: i * 0.065 });
  }
  update(dt, camera, level) {
    const ctx = this.ctx, now = ctx.currentTime;
    this.cam.x = camera.position.x; this.cam.y = camera.position.y; this.cam.z = camera.position.z;
    this.out.gain.setTargetAtTime(level * 2.0, now, 0.3);
    for (let i = this.queue.length - 1; i >= 0; i--) { const q = this.queue[i]; q.t -= dt; if (q.t <= 0) { this.queue.splice(i, 1); try { q.fn(); } catch {} } }
    const src = this.sys.dockSource, sp = src?.audioSpots;
    if (this.sys.muted || level < 0.05 || !sp) return;
    const dusk = src.dusk ?? 0, T = this.timers; for (const k of Object.keys(T)) T[k] -= dt;
    if (T.thud <= 0 && dusk < 0.7) { T.thud = rand(3.5, 8); const p = pick(sp.cargo); this.thud(p); if (Math.random() < 0.5) this.later(0.2, () => this.clay(p)); }
    if (T.creak <= 0) { T.creak = rand(2.5, 6); this.creak(pick(sp.boats)); }
    if (T.rope <= 0) { T.rope = rand(7, 14); this.burst(pick(sp.boats), { vol: 0.12, freq: 2400, q: 0.5, att: 0.1, dec: 0.4 }); }
    if (T.clay <= 0) { T.clay = rand(6, 12); this.grain(pick(sp.cargo)); }
    if (T.cricket <= 0 && dusk > 0.25) { T.cricket = rand(0.12, 0.45) / (0.3 + dusk); this.cricket({ x: this.cam.x + rand(-14, 14), y: 0.3, z: this.cam.z + rand(-14, 14) }); }
  }
}
