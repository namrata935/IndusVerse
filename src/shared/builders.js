import * as THREE from 'three';
import {
  makeBrickMaterial, makePlasterMaterial, makeStoneMaterial, makeWoodMaterial, makeFlat,
} from './materials.js';
import { PALETTE } from './palette.js';
import { rng } from './textures.js';

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

/** Collects boxes and emits ONE InstancedMesh (single draw call) for a material. */
export class BoxBatch {
  constructor(material, { cast = true, receive = true } = {}) {
    this.material = material;
    this.items = [];
    this.cast = cast;
    this.receive = receive;
  }
  /** centre + size box; `tint` is a colour multiplier (per-instance variation). */
  add(cx, cy, cz, sx, sy, sz, tint = 0xffffff, rotY = 0, vary = 0.1, rand = Math.random) {
    this.items.push({ cx, cy, cz, sx, sy, sz, tint, rotY, vary, r: rand() });
    return this;
  }
  /** min/max corner box. */
  addMM(x0, y0, z0, x1, y1, z1, tint, rotY = 0, vary) {
    return this.add((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, tint, rotY, vary);
  }
  build() {
    if (!this.items.length) return null;
    const mesh = new THREE.InstancedMesh(UNIT_BOX, this.material, this.items.length);
    this.items.forEach((it, i) => {
      _q.setFromAxisAngle(UP, it.rotY);
      _m.compose(_p.set(it.cx, it.cy, it.cz), _q, _s.set(it.sx, it.sy, it.sz));
      mesh.setMatrixAt(i, _m);
      _c.set(it.tint);
      const k = 1 + (it.r - 0.5) * 2 * it.vary;
      _c.multiplyScalar(k);
      mesh.setColorAt(i, _c);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = this.cast;
    mesh.receiveShadow = this.receive;
    return mesh;
  }
}

/**
 * BuildKit: the reusable construction toolkit every scene uses. Keeps one batch per
 * material (brick / plaster / stone / wood / flat-colour accent) so a whole city is a
 * handful of draw calls. Also records collision rectangles for the CameraController.
 */
export class BuildKit {
  constructor(ground, seed = 3) {
    this.R = rng(seed);
    this.ground = ground;
    this.brick = new BoxBatch(makeBrickMaterial());
    this.plaster = new BoxBatch(makePlasterMaterial());
    this.stone = new BoxBatch(makeStoneMaterial());
    this.wood = new BoxBatch(makeWoodMaterial());
    this.accent = new BoxBatch(makeFlat(0xffffff, { flatShading: false, roughness: 0.7 }));
    this.batches = [this.brick, this.plaster, this.stone, this.wood, this.accent];
  }
  mat(name) { return this[name] || this.brick; }
  rnd(a, b) { return a + this.R() * (b - a); }
  pick(arr) { return arr[Math.floor(this.R() * arr.length)]; }

  /** Axis-aligned or rotated solid box with optional ground collider. */
  box(matName, cx, cy, cz, sx, sy, sz, { tint = 0xffffff, rotY = 0, vary = 0.1, collide = false } = {}) {
    this.mat(matName).add(cx, cy, cz, sx, sy, sz, tint, rotY, vary, this.R);
    if (collide && this.ground) {
      const ex = rotY ? Math.abs(Math.cos(rotY)) * sx / 2 + Math.abs(Math.sin(rotY)) * sz / 2 : sx / 2;
      const ez = rotY ? Math.abs(Math.sin(rotY)) * sx / 2 + Math.abs(Math.cos(rotY)) * sz / 2 : sz / 2;
      this.ground.addBlocker(cx - ex, cx + ex, cz - ez, cz + ez);
    }
  }

  /** Straight wall between two ground points, made of slightly varied segments. */
  wall(x1, z1, x2, z2, { y0 = 0, h = 3, t = 0.6, mat = 'brick', tint = 0xffffff, collide = true, segment = 3.2, vary = 0.14, hVary = 0.12, capColor } = {}) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const ang = Math.atan2(-(z2 - z1), x2 - x1);
    const n = Math.max(1, Math.round(len / segment));
    const sl = len / n;
    for (let i = 0; i < n; i++) {
      const c = (i + 0.5) / n;
      const cx = x1 + (x2 - x1) * c, cz = z1 + (z2 - z1) * c;
      const hh = h * (1 + (this.R() - 0.5) * 2 * hVary);
      this.mat(mat).add(cx, y0 + hh / 2, cz, sl + 0.02, hh, t, tint, ang, vary, this.R);
    }
    if (capColor !== undefined) this.accent.add((x1 + x2) / 2, y0 + h + 0.08, (z1 + z2) / 2, len, 0.16, t + 0.12, capColor, ang, 0.05, this.R);
    if (collide && this.ground) {
      // axis-aligned approximation for collisions (walls here are axis-aligned)
      const hx = Math.abs(x2 - x1) >= Math.abs(z2 - z1);
      if (hx) this.ground.addBlocker(Math.min(x1, x2), Math.max(x1, x2), z1 - t / 2, z1 + t / 2);
      else this.ground.addBlocker(x1 - t / 2, x1 + t / 2, Math.min(z1, z2), Math.max(z1, z2));
    }
  }

  /** Ascending stairs. Registers walkable height + visual boxes. dir: '+x','-x','+z','-z'. */
  stairs({ x, z, y0 = 0, width, steps, rise = 0.3, run = 0.4, dir = '+z', mat = 'brick', tint = 0xffffff, sideWalls = true }) {
    const d = { '+x': [1, 0], '-x': [-1, 0], '+z': [0, 1], '-z': [0, -1] }[dir];
    const alongX = d[0] !== 0;
    for (let i = 0; i < steps; i++) {
      const top = y0 + (i + 1) * rise;
      const mid = (i + 0.5) * run;
      const cx = x + d[0] * mid, cz = z + d[1] * mid;
      const hgt = top - y0 + 0.2;
      this.mat(mat).add(cx, y0 - 0.2 + hgt / 2, cz, alongX ? run : width, hgt, alongX ? width : run, tint, 0, 0.06, this.R);
    }
    if (this.ground) this.ground.addStairs({ x, z, width, steps, rise, run, dir, y0 });
    if (sideWalls) {
      const len = steps * run, hgt = steps * rise;
      for (const s of [-1, 1]) {
        const off = (width / 2 + 0.25) * s;
        // sloped balustrade approximated with stepped boxes
        for (let i = 0; i < steps; i += 2) {
          const top = y0 + (i + 2) * rise + 0.5;
          const mid = (i + 1) * run;
          const cx = x + d[0] * mid + (alongX ? 0 : off), cz = z + d[1] * mid + (alongX ? off : 0);
          this.brick.add(cx, y0 - 0.2 + (top - y0 + 0.2) / 2, cz, alongX ? run * 2 : 0.5, top - y0 + 0.2, alongX ? 0.5 : run * 2, tint, 0, 0.1, this.R);
        }
      }
    }
  }

  /**
   * A mud-brick house block with parapet, door, window slits and painted accents.
   * (x,z) centre, w along x, d along z, front faces +z unless rotated by multiples of 90deg.
   */
  house({ x, z, w, d, h, y0 = 0, rot = 0, mat = 'brick', door = true, accent, upper = false, collide = true }) {
    const R = this.R;
    const cs = Math.cos(rot), sn = Math.sin(rot);
    const place = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs];
    const rotY = rot;
    const [cx, cz] = place(0, 0);
    const swapped = Math.abs(Math.sin(rot)) > 0.5;
    const tint = mat === 'plaster' ? this.pick([0xffffff, 0xfff0e0, 0xe8f2f0, 0xf3e2d4]) : this.pick([0xffffff, 0xf4d8c8, 0xe6b8a0, 0xffffff, 0xcc9988]);
    this.mat(mat).add(cx, y0 + h / 2, cz, w, h, d, tint, rotY, 0.06, R);
    if (collide && this.ground) {
      const hw = (swapped ? d : w) / 2, hd = (swapped ? w : d) / 2;
      this.ground.addBlocker(cx - hw, cx + hw, cz - hd, cz + hd);
    }
    // flat mud-plaster roof (ochre / pale), so roofs read differently from brick walls
    this.plaster.add(cx, y0 + h + 0.03, cz, w - 0.02, 0.08, d - 0.02, this.pick([0xd9a868, 0xe6c9a0, 0xc99a6c, 0xe0b888]), rotY, 0.05, R);
    // parapet ring
    const pt = 0.25, ph = 0.4, pc = this.pick([0xffffff, 0xd9a07c, 0xc88b6e]);
    for (const [lx, lz, sx, sz] of [[0, d / 2 - pt / 2, w, pt], [0, -d / 2 + pt / 2, w, pt], [w / 2 - pt / 2, 0, pt, d - pt * 2], [-w / 2 + pt / 2, 0, pt, d - pt * 2]]) {
      const [px, pz] = place(lx, lz);
      this.brick.add(px, y0 + h + ph / 2, pz, sx, ph, sz, pc, rotY, 0.1, R);
    }
    // roof beams poking out of the facade
    for (let i = -1; i <= 1; i++) {
      const [px, pz] = place(i * w * 0.3, d / 2 + 0.12);
      this.wood.add(px, y0 + h - 0.15, pz, 0.18, 0.18, 0.5, 0x9a6a45, rotY, 0.2, R);
    }
    const ac = accent ?? this.pick([PALETTE.lapis, PALETTE.turquoise, PALETTE.madder, PALETTE.ochre, PALETTE.indigo]);
    if (door) {
      const dw = Math.min(1.1, w * 0.3), dh = 2.05;
      const dx = this.rnd(-w * 0.25, w * 0.25);
      let [px, pz] = place(dx, d / 2 + 0.02);
      this.accent.add(px, y0 + dh / 2, pz, dw, dh, 0.1, 0x1c110d, rotY, 0, R);
      [px, pz] = place(dx, d / 2 + 0.07);
      this.accent.add(px, y0 + dh + 0.12, pz, dw + 0.5, 0.22, 0.18, ac, rotY, 0.05, R);
      for (const s of [-1, 1]) {
        [px, pz] = place(dx + s * (dw / 2 + 0.1), d / 2 + 0.06);
        this.wood.add(px, y0 + dh / 2, pz, 0.16, dh, 0.14, 0x7d5435, rotY, 0.15, R);
      }
      // stone threshold
      [px, pz] = place(dx, d / 2 + 0.3);
      this.stone.add(px, y0 + 0.07, pz, dw + 0.6, 0.14, 0.7, 0xffffff, rotY, 0.1, R);
    }
    // narrow window slits high on the wall (Indus houses mostly faced inward)
    const nWin = Math.floor(w / 3);
    for (let i = 0; i < nWin; i++) {
      if (R() < 0.4) continue;
      const [px, pz] = place(-w / 2 + (i + 0.5) * (w / nWin), d / 2 + 0.02);
      this.accent.add(px, y0 + h - 0.8, pz, 0.28, 0.55, 0.08, 0x1c110d, rotY, 0, R);
    }
    if (upper) {
      const uh = h * 0.6, uw = w * 0.7, ud = d * 0.7;
      const [px, pz] = place(0, -d * 0.1);
      this.mat(mat === 'brick' ? 'plaster' : 'brick').add(px, y0 + h + uh / 2 + 0.4, pz, uw, uh, ud, 0xffffff, rotY, 0.05, R);
    }
  }

  /** A row of square piers with a lintel beam above (colonnade / verandah). */
  colonnade({ x1, z1, x2, z2, y0, h = 3.2, spacing = 3, pier = 0.9, beamColor = 0x6e3a26 }) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const n = Math.max(1, Math.round(len / spacing));
    const ax = (x2 - x1) / len, az = (z2 - z1) / len;
    for (let i = 0; i <= n; i++) {
      const px = x1 + ax * (len * i / n), pz = z1 + az * (len * i / n);
      this.brick.add(px, y0 + h / 2, pz, pier, h, pier, 0xffffff, 0, 0.12, this.R);
      this.stone.add(px, y0 + 0.12, pz, pier + 0.3, 0.24, pier + 0.3, 0xffffff, 0, 0.1, this.R);
      if (this.ground) this.ground.addBlocker(px - pier / 2, px + pier / 2, pz - pier / 2, pz + pier / 2);
    }
    const ang = Math.atan2(-(z2 - z1), x2 - x1);
    this.wood.add((x1 + x2) / 2, y0 + h + 0.2, (z1 + z2) / 2, len + pier, 0.4, pier + 0.2, beamColor, ang, 0.1, this.R);
  }

  build(parent) {
    const meshes = [];
    for (const b of this.batches) {
      const m = b.build();
      if (m) { parent.add(m); meshes.push(m); }
    }
    return meshes;
  }
}
