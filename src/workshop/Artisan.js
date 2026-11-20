import * as THREE from 'three';
import { createPerson } from '../shared/people.js';
import { PALETTE } from '../shared/palette.js';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * The artisan NPC: reuses the shared low-poly person and drives its limbs by hand.
 * Modes: idle, wave (greeting), point (gesture at something), talk (small hand gestures),
 * craft (working at a bench). Plus: face a position smoothly and walk along waypoints.
 */
export class Artisan {
  constructor(position, { heading = 0, cloth = PALETTE.terracotta, sash = PALETTE.turquoise, band = PALETTE.lapis, skin = PALETTE.skin[1] } = {}) {
    this.root = createPerson({ cloth, sash, skin, band, scale: 1.04 });
    this.root.position.copy(position); this.root.rotation.y = heading;
    this.pos = this.root.position; this.heading = heading; this.faceTarget = null;
    this.mode = 'idle'; this.walk = null; this.speed = 1.5; this.phase = 0;
  }
  faceToward(v) { this.faceTarget = v; }
  headingTo(v) { return Math.atan2(v.x - this.pos.x, v.z - this.pos.z); }
  point(v) { this.mode = 'point'; this.faceTarget = null; this.heading = this.headingTo(v); }
  setMode(m) { this.mode = m; }
  /** Walk along [[x,z], ...]; resolves when the last point is reached. */
  walkTo(points) {
    return new Promise((resolve) => { this.walk = { pts: points.map(([x, z]) => new THREE.Vector3(x, this.pos.y, z)), i: 0, resolve }; this.faceTarget = null; });
  }
  update(dt, t) {
    const u = this.root.userData, r = this.root;
    let moving = false;
    if (this.walk) {
      const w = this.walk, tgt = w.pts[w.i], d = tgt.clone().sub(this.pos); d.y = 0;
      const dist = d.length();
      if (dist < 0.08) { w.i++; if (w.i >= w.pts.length) { const res = w.resolve; this.walk = null; res(); } }
      else { d.normalize(); this.pos.addScaledVector(d, Math.min(dist, this.speed * dt)); this.heading = Math.atan2(d.x, d.z); moving = true; }
    }
    if (this.faceTarget && !moving) this.heading = this.headingTo(this.faceTarget);
    r.rotation.y += wrap(this.heading - r.rotation.y) * Math.min(1, dt * 6);
    this.phase += dt * (moving ? 7 : 0);
    const s = Math.sin(this.phase), idle = Math.sin(t * 1.3);
    let aLx = 0, aLz = 0, aRx = 0, aRz = 0;
    if (moving) { u.legL.rotation.x = s * 0.55; u.legR.rotation.x = -s * 0.55; aLx = -s * 0.4; aRx = s * 0.4; }
    else { u.legL.rotation.x *= 0.85; u.legR.rotation.x *= 0.85; aLx = idle * 0.03; aRx = -idle * 0.03; }
    if (!moving) {
      if (this.mode === 'wave') { aRz = 2.35 + Math.sin(t * 7) * 0.28; aRx = 0; }
      else if (this.mode === 'point') { aRx = -1.45; aRz = 0.05; aLx = 0.1; }
      else if (this.mode === 'talk') { const on = Math.sin(t * 0.9) > -0.2; aRx = on ? -0.8 + Math.sin(t * 2.6) * 0.35 : -0.1; aLx = on ? -0.35 + Math.sin(t * 2.1 + 1) * 0.3 : 0; }
      else if (this.mode === 'craft') { aRx = -1.0 + Math.sin(t * 5) * 0.28; aLx = -0.9 + Math.sin(t * 5 + 1.6) * 0.22; }
    }
    const k = Math.min(1, dt * 10);
    u.armL.rotation.x += (aLx - u.armL.rotation.x) * k; u.armL.rotation.z += (aLz - u.armL.rotation.z) * k;
    u.armR.rotation.x += (aRx - u.armR.rotation.x) * k; u.armR.rotation.z += (aRz - u.armR.rotation.z) * k;
    u.body.position.y = moving ? Math.abs(Math.cos(this.phase)) * 0.04 : idle * 0.006;
  }
}
