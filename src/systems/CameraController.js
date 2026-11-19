import * as THREE from 'three';

/**
 * First-person controller. Modes:
 *  - 'walk' : WASD, drag-to-look, eye height follows GroundMap, blocked by walls (step limit + blockers)
 *  - 'fly'  : free camera (Q/E = down/up), no collisions
 *  - 'tour' : driven externally by Tour (spline camera)
 */
export class CameraController {
  constructor(camera, dom) {
    this.camera = camera; this.dom = dom;
    this.camera.rotation.order = 'YXZ';
    this.yaw = 0; this.pitch = 0;
    this.pos = new THREE.Vector3(); // eye position (walk: feet = pos.y - eye)
    this.footY = 0;
    this.mode = 'walk'; this.enabled = true;
    this.eye = 1.7; this.speed = 3.4; this.radius = 0.35;
    this.ground = null; this.bounds = null;
    this.keys = new Set();
    this.drag = null; this.bob = 0; this.moving = false;
    this.onClick = null; this.onHover = null;
    this._v = new THREE.Vector3();
    this._bind();
  }
  configure({ pos, yaw = 0, pitch = 0, mode = 'walk', eye = 1.7, speed = 3.4, ground = null, bounds = null }) {
    this.ground = ground; this.bounds = bounds; this.eye = eye; this.speed = speed;
    this.mode = mode; this.yaw = yaw; this.pitch = pitch;
    this.footY = pos[1] - eye; this.pos.set(pos[0], pos[1], pos[2]);
    this.keys.clear();
    this.apply();
  }
  apply() {
    this.camera.position.copy(this.pos);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
  /** Adopt the camera's current transform (after a tour). */
  syncFromCamera() {
    this.pos.copy(this.camera.position);
    const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.yaw = e.y; this.pitch = THREE.MathUtils.clamp(e.x, -1.4, 1.4);
    this.footY = this.pos.y - this.eye;
    this.apply();
  }
  toggleFly() {
    if (this.mode === 'tour') return;
    this.mode = this.mode === 'fly' ? 'walk' : 'fly';
    if (this.mode === 'walk') this.footY = this.pos.y - this.eye;
    return this.mode;
  }
  _bind() {
    const d = this.dom;
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      this.keys.add(e.code);
      if (e.code === 'KeyF' && this.enabled) this.toggleFly();
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault?.();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    d.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      this.drag = { x: e.clientX, y: e.clientY, moved: 0, id: e.pointerId };
      d.setPointerCapture?.(e.pointerId);
    });
    d.addEventListener('pointermove', (e) => {
      if (this.drag && e.pointerId === this.drag.id) {
        const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
        this.drag.x = e.clientX; this.drag.y = e.clientY; this.drag.moved += Math.abs(dx) + Math.abs(dy);
        if (this.enabled && this.mode !== 'tour' && this.drag.moved > 3) {
          this.yaw -= dx * 0.0032; this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.0032, -1.45, 1.45);
          d.classList.add('dragging');
        }
      } else this.onHover?.(e);
    });
    const up = (e) => {
      if (!this.drag) return;
      const wasClick = this.drag.moved < 5;
      this.drag = null; d.classList.remove('dragging');
      if (wasClick && this.enabled) this.onClick?.(e);
    };
    d.addEventListener('pointerup', up);
    d.addEventListener('pointercancel', () => { this.drag = null; d.classList.remove('dragging'); });
  }
  update(dt) {
    if (this.mode === 'tour' || !this.enabled) return;
    const k = this.keys;
    const f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const s = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const run = k.has('ShiftLeft') || k.has('ShiftRight') ? 1.9 : 1;
    const sp = this.speed * run * (this.mode === 'fly' ? 2.2 : 1);
    this.moving = !!(f || s);
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let dx = (-sin * f + cos * s), dz = (-cos * f - sin * s);
    if (this.mode === 'fly') {
      // fly along the full look direction
      const cp = Math.cos(this.pitch), sp2 = Math.sin(this.pitch);
      const fx = -sin * cp * f + cos * s, fz = -cos * cp * f - sin * s, fy = sp2 * f;
      const up = (k.has('KeyE') ? 1 : 0) - (k.has('KeyQ') ? 1 : 0);
      this.pos.x += fx * sp * dt; this.pos.z += fz * sp * dt; this.pos.y += (fy + up) * sp * dt;
      this.pos.y = Math.max(0.5, this.pos.y);
    } else {
      const len = Math.hypot(dx, dz);
      if (len > 0) {
        dx = (dx / len) * sp * dt; dz = (dz / len) * sp * dt;
        this._tryMove(dx, 0); this._tryMove(0, dz);
      }
      const gy = this.ground ? this.ground.height(this.pos.x, this.pos.z) : 0;
      this.footY += (gy - this.footY) * (1 - Math.exp(-dt * 12));
      this.bob += this.moving ? dt * 8 * run : 0;
      this.pos.y = this.footY + this.eye + (this.moving ? Math.sin(this.bob) * 0.035 : 0);
    }
    const b = this.bounds;
    if (b) { this.pos.x = THREE.MathUtils.clamp(this.pos.x, b.minX, b.maxX); this.pos.z = THREE.MathUtils.clamp(this.pos.z, b.minZ, b.maxZ); }
    this.apply();
  }
  _tryMove(dx, dz) {
    const nx = this.pos.x + dx, nz = this.pos.z + dz, g = this.ground;
    if (!g) { this.pos.x = nx; this.pos.z = nz; return; }
    if (g.blocked(nx, nz, this.radius)) return;
    const cur = g.height(this.pos.x, this.pos.z), nxt = g.height(nx, nz);
    if (nxt - cur > 0.62 || cur - nxt > 1.0) return; // step limit
    this.pos.x = nx; this.pos.z = nz;
  }
}
