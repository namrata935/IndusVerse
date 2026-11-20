/**
 * Layered, fully synthesised bazaar soundscape (no audio files, nothing modern).
 *
 *  bed        : a ring of "murmur voices" (formant-filtered babble that never stops) + a soft hush
 *  chatter    : short spatialised phrases from nearby people
 *  foreground : merchants calling their wares, bargaining exchanges that rise above the bed
 *  footsteps  : dusty steps of the people who are actually walking in the scene
 *  goods      : clay knocks, copper rings, bead tinkles, thuds, cloth swishes, grain pouring
 *  animals    : oxen lowing and hooves, creaking wooden cart wheels, a goat
 *
 * The scene supplies live positions through `audio.marketSource.audioSpots` so every sound is
 * placed (HRTF panner) where something is happening, at its own distance and volume.
 */
const FORM = { a: [800, 1200, 2600], e: [500, 1800, 2500], i: [320, 2200, 3000], o: [480, 900, 2500], u: [350, 750, 2400], ae: [650, 1500, 2500] };
const VOW = Object.keys(FORM);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export class MarketAudio {
  constructor(sys) {
    this.sys = sys;
    const ctx = (this.ctx = sys.ctx);
    this.noise = sys.noise;
    this.active = 0;
    this.queue = [];
    this.timers = { chatter: 0.2, call: 1.5, bargain: 4, steps: 0.1, goods: 1, ox: 6, goat: 15, hoof: 0 };
    this.cam = { x: 0, y: 1.7, z: 0 };
    this.permanent = [];

    this.out = ctx.createGain(); this.out.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 3.5; comp.attack.value = 0.01; comp.release.value = 0.25;
    this.comp = comp; this.out.connect(comp); comp.connect(sys.master);
    this.dry = ctx.createGain(); this.dry.connect(this.out);
    // a little street reverb: short decaying stereo noise
    const irLen = Math.floor(ctx.sampleRate * 1.1), ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < irLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 2.6); }
    const verb = ctx.createConvolver(); verb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.3; verb.connect(wet); wet.connect(this.out);
    this.send = ctx.createGain(); this.send.gain.value = 0.35; this.send.connect(verb);

    this._buildBed();
  }

  // ---------------------------------------------------------------- helpers
  _noiseSrc(loop = true) {
    const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = loop;
    s.loopStart = Math.random() * 3; return s;
  }
  _dist(p) { return Math.hypot(p.x - this.cam.x, p.y - this.cam.y, p.z - this.cam.z); }
  /** gain -> lowpass(distance) -> HRTF panner -> dry + reverb send. Returns the input node. */
  _route(pos, vol, { ref = 5, roll = 1.25 } = {}) {
    const ctx = this.ctx;
    const g = ctx.createGain(); g.gain.value = vol;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = clamp(8000 - this._dist(pos) * 120, 1600, 8000);
    const p = ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = ref; p.rolloffFactor = roll; p.maxDistance = 120;
    p.positionX.value = pos.x; p.positionY.value = pos.y ?? 1.4; p.positionZ.value = pos.z;
    g.connect(lp); lp.connect(p); p.connect(this.dry); p.connect(this.send);
    return { input: g, panner: p, nodes: [g, lp, p] };
  }
  _free(nodes, afterSec) {
    this.active++;
    setTimeout(() => { for (const n of nodes) { try { n.disconnect(); } catch {} } this.active--; }, afterSec * 1000 + 300);
  }
  later(sec, fn) { this.queue.push({ t: sec, fn }); }

  // ---------------------------------------------------------------- continuous bed
  _formantBank(src, dest, Q = [7, 9, 11], G = [1, 0.7, 0.4]) {
    const ctx = this.ctx, bank = [];
    for (let k = 0; k < 3; k++) {
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = Q[k]; f.frequency.value = 500 * (k + 1);
      const g = ctx.createGain(); g.gain.value = G[k];
      src.connect(f); f.connect(g); g.connect(dest); bank.push(f);
    }
    return bank;
  }
  _buildBed() {
    const ctx = this.ctx;
    this.murmur = [];
    for (let i = 0; i < 12; i++) {
      const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = rand(95, 230);
      const nz = this._noiseSrc(); const nzg = ctx.createGain(); nzg.gain.value = 0.35; nz.connect(nzg);
      const src = ctx.createGain(); osc.connect(src); nzg.connect(src);
      const amp = ctx.createGain(); amp.gain.value = 0;
      const bank = this._formantBank(src, amp);
      const route = this._route({ x: 0, y: 1.5, z: 0 }, 0.5, { ref: 6, roll: 0.9 });
      amp.connect(route.input);
      osc.start(); nz.start();
      this.permanent.push(osc, nz);
      this.murmur.push({ osc, amp, bank, panner: route.panner, a: rand(0, 6.28), r: rand(7, 24), t: rand(0, 0.3), level: rand(0.45, 1), base: rand(95, 230) });
    }
    // soft hush of many far voices + shuffling
    const hush = this._noiseSrc();
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 800; bp.Q.value = 0.35;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    this.hush = ctx.createGain(); this.hush.gain.value = 0.05;
    hush.connect(bp); bp.connect(lp); lp.connect(this.hush); this.hush.connect(this.dry); hush.start();
    this.permanent.push(hush);
    // carts: continuous wheel rumble + creak voice, each tied to a moving position
    this.carts = [];
  }
  _ensureCarts(list) {
    const ctx = this.ctx;
    while (this.carts.length < list.length) {
      const i = this.carts.length;
      const route = this._route(list[i], 1, { ref: 6, roll: 1.1 });
      const rum = this._noiseSrc(); const rl = ctx.createBiquadFilter(); rl.type = 'lowpass'; rl.frequency.value = 170;
      const rg = ctx.createGain(); rg.gain.value = 0.9; rum.connect(rl); rl.connect(rg); rg.connect(route.input); rum.start();
      const cr = ctx.createOscillator(); cr.type = 'sawtooth'; cr.frequency.value = 200;
      const cf = ctx.createBiquadFilter(); cf.type = 'bandpass'; cf.frequency.value = 900; cf.Q.value = 7;
      const cg = ctx.createGain(); cg.gain.value = 0;
      cr.connect(cf); cf.connect(cg); cg.connect(route.input); cr.start();
      this.permanent.push(rum, cr);
      this.carts.push({ route, cr, cf, cg, rg, next: rand(0.5, 2), hoof: 0 });
    }
  }

  // ---------------------------------------------------------------- one-shot voices
  /** A phrase of syllables: glottal saw -> three formant filters, with vibrato and consonant puffs. */
  voice(pos, { f0 = 130, syl = 6, sylDur = 0.2, vol = 0.2, slope = -0.12, contour = null, vowels = null, puffs = true } = {}) {
    if (this.active > 26) return 0;
    const ctx = this.ctx, t0 = ctx.currentTime + 0.02, dur = syl * sylDur + 0.15;
    const r = this._route(pos, vol);
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(f0, t0);
    const vib = ctx.createOscillator(); vib.frequency.value = rand(4.5, 6.5); const vg = ctx.createGain(); vg.gain.value = f0 * 0.012; vib.connect(vg); vg.connect(osc.frequency);
    const nz = this._noiseSrc(); const nzg = ctx.createGain(); nzg.gain.value = 0.28; nz.connect(nzg);
    const src = ctx.createGain(); osc.connect(src); nzg.connect(src);
    const env = ctx.createGain(); env.gain.value = 0;
    const bank = this._formantBank(src, env);
    env.connect(r.input);
    const shift = f0 > 170 ? 1.18 : 1;
    for (let i = 0; i < syl; i++) {
      const ts = t0 + i * sylDur * rand(0.92, 1.1);
      const v = FORM[vowels ? vowels[i % vowels.length] : pick(VOW)];
      bank.forEach((f, k) => f.frequency.setTargetAtTime(v[k] * shift * rand(0.96, 1.04), ts, 0.03));
      const ff = contour ? f0 * contour[Math.min(i, contour.length - 1)] : f0 * (1 + slope * (i / syl)) * rand(0.9, 1.12);
      osc.frequency.setTargetAtTime(ff, ts, 0.045);
      const a = rand(0.6, 1);
      env.gain.setTargetAtTime(a, ts, 0.02);
      env.gain.setTargetAtTime(a * 0.22, ts + sylDur * 0.62, 0.03);
      if (puffs && Math.random() < 0.55) this._puff(r.input, ts, vol);
    }
    env.gain.setTargetAtTime(0, t0 + dur - 0.12, 0.05);
    osc.start(t0); vib.start(t0); nz.start(t0);
    osc.stop(t0 + dur + 0.4); vib.stop(t0 + dur + 0.4); nz.stop(t0 + dur + 0.4);
    this._free([...r.nodes, osc, vib, vg, nz, nzg, src, env, ...bank], dur + 0.4);
    return dur;
  }
  _puff(dest, t, vol) {
    const ctx = this.ctx, s = this._noiseSrc(false), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'bandpass'; f.frequency.value = rand(2500, 5500); f.Q.value = 1;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.006); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t); s.stop(t + 0.08);
    this._free([s, f, g], 0.1);
  }
  /** Generic noise burst through a filter. */
  burst(pos, { vol = 0.3, freq = 1200, q = 0.8, type = 'bandpass', att = 0.004, dec = 0.08, delay = 0 }) {
    if (this.active > 30) return;
    const ctx = this.ctx, t = ctx.currentTime + 0.01 + delay;
    const r = this._route(pos, vol, { ref: 4 });
    const s = this._noiseSrc(false), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + att); g.gain.exponentialRampToValueAtTime(0.001, t + att + dec);
    s.connect(f); f.connect(g); g.connect(r.input); s.start(t); s.stop(t + att + dec + 0.05);
    this._free([...r.nodes, s, f, g], att + dec + delay + 0.1);
  }
  /** Decaying tone(s): clay knocks, copper rings, bead pings. */
  ping(pos, { freqs = [1800], vol = 0.15, dec = 0.2, type = 'sine', glide = 1, delay = 0 }) {
    if (this.active > 30) return;
    const ctx = this.ctx, t = ctx.currentTime + 0.01 + delay;
    const r = this._route(pos, vol, { ref: 4 });
    const nodes = [...r.nodes];
    freqs.forEach((fr, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(fr, t); if (glide !== 1) o.frequency.exponentialRampToValueAtTime(fr * glide, t + dec);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1 / (i + 1), t + 0.003); g.gain.exponentialRampToValueAtTime(0.001, t + dec * (1 - i * 0.2));
      o.connect(g); g.connect(r.input); o.start(t); o.stop(t + dec + 0.05); nodes.push(o, g);
    });
    this._free(nodes, dec + delay + 0.1);
  }

  // ---------------------------------------------------------------- sound events
  step(pos) {
    this.burst(pos, { vol: rand(0.25, 0.4), freq: rand(700, 1700), q: 0.7, dec: rand(0.05, 0.09) });
    this.ping(pos, { freqs: [rand(85, 120)], vol: 0.12, dec: 0.07, glide: 0.6 });
  }
  clay(pos) {
    this.ping(pos, { freqs: [rand(430, 560)], vol: 0.2, dec: 0.12, type: 'triangle', glide: 0.62 });
    this.burst(pos, { vol: 0.12, freq: 2200, dec: 0.03 });
    if (Math.random() < 0.6) this.ping(pos, { freqs: [rand(500, 640)], vol: 0.14, dec: 0.1, type: 'triangle', glide: 0.65, delay: rand(0.12, 0.22) });
  }
  metal(pos) {
    const b = rand(2200, 3000);
    this.ping(pos, { freqs: [b, b * 1.52, b * 2.1, b * 2.74], vol: 0.07, dec: rand(0.35, 0.6) });
  }
  beads(pos) {
    const n = 3 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) this.ping(pos, { freqs: [rand(3200, 6200)], vol: 0.05, dec: 0.07, delay: i * rand(0.04, 0.09) });
  }
  thud(pos) {
    this.burst(pos, { vol: 0.5, freq: 220, q: 0.6, type: 'lowpass', dec: 0.14 });
    this.ping(pos, { freqs: [rand(150, 210)], vol: 0.12, dec: 0.06, type: 'square', glide: 0.7 });
  }
  cloth(pos) { this.burst(pos, { vol: 0.14, freq: 1800, q: 0.5, att: 0.12, dec: 0.28 }); }
  grain(pos) { this.burst(pos, { vol: 0.12, freq: 3200, q: 0.4, type: 'highpass', att: 0.05, dec: 0.7 }); }
  ox(pos) {
    const ctx = this.ctx, t = ctx.currentTime + 0.02, dur = 1.6;
    const r = this._route(pos, 0.5, { ref: 6 });
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(rand(85, 105), t);
    o.frequency.linearRampToValueAtTime(rand(115, 135), t + 0.5); o.frequency.linearRampToValueAtTime(rand(65, 80), t + dur);
    const vib = ctx.createOscillator(); vib.frequency.value = 6; const vg = ctx.createGain(); vg.gain.value = 3; vib.connect(vg); vg.connect(o.frequency);
    const env = ctx.createGain(); env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(1, t + 0.25); env.gain.setValueAtTime(1, t + dur - 0.5); env.gain.linearRampToValueAtTime(0, t + dur);
    const bank = this._formantBank(o, env, [6, 8, 10], [1, 0.6, 0.2]);
    bank[0].frequency.value = 430; bank[1].frequency.value = 760; bank[2].frequency.value = 1500;
    env.connect(r.input); o.start(t); vib.start(t); o.stop(t + dur + 0.1); vib.stop(t + dur + 0.1);
    this._free([...r.nodes, o, vib, vg, env, ...bank], dur + 0.2);
  }
  goat(pos) {
    const ctx = this.ctx, t = ctx.currentTime + 0.02, dur = rand(0.6, 0.9);
    const r = this._route(pos, 0.25, { ref: 5 });
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(rand(300, 380), t); o.frequency.linearRampToValueAtTime(rand(260, 330), t + dur);
    const trem = ctx.createOscillator(); trem.frequency.value = rand(28, 40); const tg = ctx.createGain(); tg.gain.value = 0.5; const base = ctx.createGain(); base.gain.value = 0.5;
    const env = ctx.createGain(); env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(1, t + 0.08); env.gain.setValueAtTime(1, t + dur - 0.2); env.gain.linearRampToValueAtTime(0, t + dur);
    const am = ctx.createGain(); am.gain.value = 0.5; trem.connect(tg); tg.connect(am.gain);
    o.connect(am); const bank = this._formantBank(am, env, [6, 8, 10], [1, 0.7, 0.3]);
    bank[0].frequency.value = 800; bank[1].frequency.value = 1400; bank[2].frequency.value = 2600;
    env.connect(r.input); o.start(t); trem.start(t); o.stop(t + dur + 0.1); trem.stop(t + dur + 0.1);
    this._free([...r.nodes, o, trem, tg, base, am, env, ...bank], dur + 0.2);
  }

  // ---------------------------------------------------------------- phrases
  chatter(spots) {
    const p = this._nearby(spots.people, 34);
    if (!p) return;
    const high = Math.random() < 0.4;
    this.voice(p, { f0: high ? rand(180, 250) : rand(100, 160), syl: 3 + Math.floor(Math.random() * 8), sylDur: rand(0.15, 0.22), vol: rand(0.12, 0.25), slope: rand(-0.25, 0.1) });
  }
  call(spots, onCall) {
    const near = spots.vendors.map((v, i) => ({ v, i, d: this._dist(v.pos) })).filter((o) => o.d < 55).sort((a, b) => a.d - b.d);
    if (!near.length) return;
    const o = pick(near.slice(0, 8)), f0 = o.v.f0 ?? rand(105, 150);
    const words = pick([['a', 'o', 'e', 'a'], ['o', 'a', 'i'], ['e', 'a', 'o', 'u'], ['a', 'e']]);
    const contour = [1, 1.18, 1.34, 1.1, 0.95].slice(0, words.length + 1);
    const go = () => { this.voice(o.v.pos, { f0, syl: words.length + 1, sylDur: rand(0.28, 0.4), vol: 0.5, vowels: words, contour, puffs: false }); onCall?.(o.i); };
    go();
    this.later(rand(1.9, 2.6), go);
    if (Math.random() < 0.4) this.later(rand(3.8, 4.8), go);
  }
  bargain(spots) {
    const groups = spots.groups.filter((g) => this._dist(g[0]) < 60);
    if (!groups.length) return;
    const g = pick(groups), f = g.map(() => (Math.random() < 0.45 ? rand(185, 245) : rand(100, 160)));
    const turns = 4 + Math.floor(Math.random() * 3);
    let t = 0;
    for (let i = 0; i < turns; i++) {
      const who = i % g.length, last = i === turns - 1;
      const syl = last ? 2 : 4 + Math.floor(Math.random() * 6), sd = last ? 0.26 : rand(0.15, 0.22);
      const rise = i % 2 === 0;
      this.later(t, () => this.voice(g[who], { f0: f[who], syl, sylDur: sd, vol: last ? 0.5 : rand(0.3, 0.45), slope: rise ? 0.3 : -0.3, vowels: last ? ['a', 'o'] : null }));
      t += syl * sd + rand(0.25, 0.7);
    }
  }
  goods(spots) {
    const kinds = Object.keys(spots.shops).filter((k) => spots.shops[k].length);
    if (!kinds.length) return;
    const k = pick(kinds), list = spots.shops[k].filter((p) => this._dist(p) < 40);
    if (!list.length) return;
    const p = pick(list);
    ({ pottery: () => this.clay(p), tools: () => this.metal(p), beads: () => this.beads(p), grain: () => this.grain(p), textile: () => this.cloth(p), general: () => (Math.random() < 0.5 ? this.thud(p) : this.clay(p)) })[k]?.();
    if (Math.random() < 0.3) this.thud(pick(spots.shops[pick(kinds)]));
  }
  _nearby(list, maxD) {
    if (!list?.length) return null;
    for (let tries = 0; tries < 8; tries++) { const p = pick(list); if (this._dist(p) < maxD) return p; }
    return null;
  }

  // ---------------------------------------------------------------- per-frame
  update(dt, camera, level) {
    const ctx = this.ctx, now = ctx.currentTime;
    this.cam.x = camera.position.x; this.cam.y = camera.position.y; this.cam.z = camera.position.z;
    this.out.gain.setTargetAtTime(level * 2.2, now, 0.25);
    // murmur ring + syllabic babble
    for (const m of this.murmur) {
      m.a += dt * 0.04; m.t -= dt;
      m.panner.positionX.value = this.cam.x + Math.cos(m.a) * m.r;
      m.panner.positionY.value = 1.5;
      m.panner.positionZ.value = this.cam.z + Math.sin(m.a) * m.r;
      if (m.t <= 0) {
        m.t = rand(0.14, 0.4);
        const v = FORM[pick(VOW)], sh = m.base > 170 ? 1.18 : 1;
        m.bank.forEach((f, k) => f.frequency.setTargetAtTime(v[k] * sh * rand(0.95, 1.05), now, 0.05));
        m.osc.frequency.setTargetAtTime(m.base * rand(0.88, 1.15), now, 0.06);
        m.amp.gain.setTargetAtTime(Math.random() < 0.22 ? 0.03 : rand(0.3, 0.9) * m.level * 0.5, now, 0.05);
        if (Math.random() < 0.04) m.base = rand(95, 230);
      }
    }
    this.hush.gain.setTargetAtTime(0.03 + Math.sin(now * 0.3) * 0.01, now, 0.4);

    for (let i = this.queue.length - 1; i >= 0; i--) { const q = this.queue[i]; q.t -= dt; if (q.t <= 0) { this.queue.splice(i, 1); try { q.fn(); } catch {} } }
    if (this.sys.muted || level < 0.05) return;
    const src = this.sys.marketSource, spots = src?.audioSpots;
    if (!spots) return;
    const T = this.timers;
    for (const k of Object.keys(T)) T[k] -= dt;
    if (T.chatter <= 0) { T.chatter = rand(0.15, 0.45); this.chatter(spots); }
    if (T.steps <= 0) { T.steps = rand(0.2, 0.42); const p = this._nearby(spots.walkers, 32); if (p) this.step(p); }
    if (T.call <= 0) { T.call = rand(3.2, 6.5); this.call(spots, (i) => src.onVendorCall?.(i)); }
    if (T.bargain <= 0) { T.bargain = rand(9, 17); this.bargain(spots); }
    if (T.goods <= 0) { T.goods = rand(0.9, 2.4); this.goods(spots); }
    if (T.ox <= 0 && spots.carts.length) { T.ox = rand(14, 28); const c = pick(spots.carts); if (this._dist(c) < 70) this.ox(c); }
    if (T.goat <= 0) { T.goat = rand(22, 45); const p = this._nearby(spots.people, 50); if (p) this.goat({ x: p.x + rand(-6, 6), y: 0.6, z: p.z + rand(-6, 6) }); }

    // carts: rumble, creak, hooves at their live positions
    this._ensureCarts(spots.carts);
    this.carts.forEach((c, i) => {
      const p = spots.carts[i];
      c.route.panner.positionX.value = p.x; c.route.panner.positionY.value = 0.8; c.route.panner.positionZ.value = p.z;
      const d = this._dist(p); c.rg.gain.setTargetAtTime(d < 60 ? 0.35 : 0, now, 0.3);
      c.next -= dt; c.hoof -= dt;
      if (c.next <= 0 && d < 55) {
        c.next = rand(0.7, 2.2);
        const f = rand(170, 300), len = rand(0.25, 0.6);
        c.cr.frequency.setValueAtTime(f, now); c.cr.frequency.linearRampToValueAtTime(f * rand(0.8, 1.35), now + len);
        c.cf.frequency.setValueAtTime(rand(700, 1300), now);
        c.cg.gain.cancelScheduledValues(now); c.cg.gain.setValueAtTime(0, now); c.cg.gain.linearRampToValueAtTime(0.35, now + 0.06); c.cg.gain.linearRampToValueAtTime(0, now + len);
      }
      if (c.hoof <= 0 && d < 45) { c.hoof = rand(0.52, 0.62); this.ping({ x: p.x, y: 0.1, z: p.z }, { freqs: [rand(95, 120)], vol: 0.25, dec: 0.08, glide: 0.55 }); this.burst({ x: p.x, y: 0.1, z: p.z }, { vol: 0.2, freq: 900, dec: 0.05 }); }
    });
  }

  dispose() {
    for (const s of this.permanent) { try { s.stop(); } catch {} try { s.disconnect(); } catch {} }
    try { this.out.disconnect(); } catch {}
    this.queue.length = 0;
  }
}
