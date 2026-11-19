import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { makeFlat } from './materials.js';

const G = {};
function geos() {
  if (G.torso) return G;
  G.torso = new THREE.CylinderGeometry(0.2, 0.26, 0.62, 7); G.torso.translate(0, 1.05, 0);
  G.skirt = new THREE.ConeGeometry(0.34, 0.8, 7, 1, true); G.skirt.translate(0, 0.52, 0);
  G.head = new THREE.IcosahedronGeometry(0.15, 0); G.head.translate(0, 1.55, 0);
  G.hair = new THREE.SphereGeometry(0.165, 6, 4, 0, Math.PI * 2, 0, Math.PI * 0.55); G.hair.translate(0, 1.57, 0);
  G.band = new THREE.TorusGeometry(0.15, 0.025, 4, 8); G.band.rotateX(Math.PI / 2); G.band.translate(0, 1.6, 0);
  G.arm = new THREE.CylinderGeometry(0.055, 0.045, 0.55, 5); G.arm.translate(0, -0.27, 0);
  G.leg = new THREE.CylinderGeometry(0.075, 0.06, 0.55, 5); G.leg.translate(0, -0.27, 0);
  G.sash = new THREE.BoxGeometry(0.5, 0.1, 0.44); 
  return G;
}

/**
 * Low-poly stylised person: coloured wrap, bare arms, headband, optional shoulder cloth.
 * Pose: group.userData.legs/arms swing when `walk` is advanced.
 */
export function createPerson({ cloth = PALETTE.cloth[0], sash = PALETTE.ochre, skin = PALETTE.skin[0], band = PALETTE.indigo, scale = 1, carry = false } = {}) {
  const g = geos();
  const root = new THREE.Group();
  const clothM = makeFlat(cloth), skinM = makeFlat(skin), bandM = makeFlat(band), sashM = makeFlat(sash);
  clothM.side = THREE.DoubleSide;
  const body = new THREE.Group();
  const add = (geo, m, parent = body) => { const me = new THREE.Mesh(geo, m); me.castShadow = true; parent.add(me); return me; };
  add(g.torso, skinM);
  add(g.skirt, clothM);
  add(g.head, skinM);
  const hair = add(g.hair, makeFlat(0x1c1410));
  add(g.band, bandM);
  const sashMesh = add(g.sash, sashM); sashMesh.position.set(0, 1.15, 0); sashMesh.rotation.z = 0.5; sashMesh.scale.set(0.6, 1.2, 0.9);
  const mkLimb = (geo, x, y, m) => { const p = new THREE.Group(); p.position.set(x, y, 0); add(geo, m, p); body.add(p); return p; };
  const armL = mkLimb(g.arm, -0.27, 1.3, skinM), armR = mkLimb(g.arm, 0.27, 1.3, skinM);
  const legL = mkLimb(g.leg, -0.1, 0.56, skinM), legR = mkLimb(g.leg, 0.1, 0.56, skinM);
  if (carry) { // water pot on the head
    const pot = new THREE.Mesh(new THREE.SphereGeometry(0.17, 7, 5), makeFlat(0xb4482a)); pot.position.y = 1.82; pot.castShadow = true; body.add(pot);
    armL.rotation.z = -2.4; armR.rotation.z = 2.4;
  }
  root.add(body);
  root.scale.setScalar(scale);
  root.userData = { body, armL, armR, legL, legR, phase: Math.random() * 6, carry, dispose() { clothM.dispose(); skinM.dispose(); bandM.dispose(); sashM.dispose(); hair.material.dispose(); } };
  return root;
}

export function randomPerson(R = Math.random, opts = {}) {
  const pickA = (a) => a[Math.floor(R() * a.length)];
  return createPerson({ cloth: pickA(PALETTE.cloth), sash: pickA(PALETTE.cloth), skin: pickA(PALETTE.skin), band: pickA(PALETTE.cloth), scale: 0.95 + R() * 0.15, ...opts });
}

/** Walks a person back and forth / around a polyline of waypoints. */
export class Walker {
  constructor(person, points, { speed = 0.9, loop = false, y = 0, groundFn = null } = {}) {
    this.p = person; this.pts = points.map((p) => new THREE.Vector3(p[0], 0, p[1]));
    this.speed = speed * (0.85 + Math.random() * 0.3); this.loop = loop; this.y = y; this.groundFn = groundFn;
    this.seg = 0; this.k = Math.random(); this.dir = 1;
    this._pos();
  }
  _pos() {
    const n = this.pts.length;
    const a = this.pts[this.seg], b = this.pts[(this.seg + this.dir + n) % n];
    this.p.position.lerpVectors(a, b, this.k);
    this.p.position.y = this.groundFn ? this.groundFn(this.p.position.x, this.p.position.z) : this.y;
    this.p.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
  }
  update(dt) {
    const n = this.pts.length;
    if (this.speed > 0) {
      let b = this.pts[(this.seg + this.dir + n) % n];
      const len = Math.max(0.01, this.pts[this.seg].distanceTo(b));
      this.k += (this.speed * dt) / len;
      if (this.k >= 1) {
        this.k = 0;
        this.seg = (this.seg + this.dir + n) % n;
        if (!this.loop) {
          if (this.seg === n - 1 && this.dir === 1) this.dir = -1;
          else if (this.seg === 0 && this.dir === -1) this.dir = 1;
        }
      }
      this._pos();
    }
    const u = this.p.userData;
    u.phase += dt * this.speed * 5.2;
    const s = Math.sin(u.phase);
    if (this.speed > 0) {
      u.legL.rotation.x = s * 0.55; u.legR.rotation.x = -s * 0.55;
      if (!u.carry) { u.armL.rotation.x = -s * 0.45; u.armR.rotation.x = s * 0.45; }
      u.body.position.y = Math.abs(Math.cos(u.phase)) * 0.04;
    }
  }
}
