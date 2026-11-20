import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { emojiCursor } from './ActivityShell.js';

/**
 * Small self-contained 3D viewer (own renderer + canvas) used inside the workshop activity
 * panels: lit stage, drag-to-rotate, optional painting hooks, per-frame callbacks.
 */
export class ModelViewer {
  constructor(container, { fov = 32, distance = 5, height = 1, bg = null } = {}) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: !bg, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.append(this.renderer.domElement);
    this.canvas = this.renderer.domElement;
    this.scene = new THREE.Scene();
    if (bg) this.scene.background = new THREE.Color(bg);
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
    this.scene.environmentIntensity = 0.55;
    this.camera = new THREE.PerspectiveCamera(fov, 1, 0.05, 100);
    this.distance = distance; this.target = new THREE.Vector3(0, height, 0);
    this.hemi = new THREE.HemisphereLight(0xfff0dc, 0x6a4a34, 0.9); this.scene.add(this.hemi);
    this.key = new THREE.DirectionalLight(0xfff2d8, 2.2); this.key.position.set(3, 5, 4); this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024); Object.assign(this.key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 14 });
    this.scene.add(this.key);
    this.warm = new THREE.PointLight(0xff8a3a, 0, 8, 1.6); this.warm.position.set(0, 1.2, 1.5); this.scene.add(this.warm);
    this.pivot = new THREE.Group(); this.scene.add(this.pivot);   // everything that should spin
    this.rotateMode = true; this.autoSpin = 0; this.yaw = 0; this.tilt = 0.12;
    this.frameCbs = []; this.hooks = {}; this._clock = new THREE.Clock(); this.ray = new THREE.Raycaster(); this._ndc = new THREE.Vector2();
    this._bind();
    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(container);
    this.resize();
    this.renderer.setAnimationLoop(() => this._frame());
  }
  resize() {
    const w = Math.max(50, this.container.clientWidth), h = Math.max(50, this.container.clientHeight);
    this.renderer.setSize(w, h, false); this.canvas.style.width = '100%'; this.canvas.style.height = '100%';
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  _bind() {
    const c = this.canvas; let drag = null;
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', (e) => {
      const rotate = this.rotateMode || e.button === 2 || e.shiftKey;
      c.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, y: e.clientY, rotate, id: e.pointerId };
      if (!rotate) this.hooks.down?.(e);
    });
    c.addEventListener('pointermove', (e) => {
      if (drag && drag.rotate) {
        this.yaw += (e.clientX - drag.x) * 0.009; this.tilt = THREE.MathUtils.clamp(this.tilt + (e.clientY - drag.y) * 0.006, -0.9, 1.1);
        drag.x = e.clientX; drag.y = e.clientY;
      } else if (drag) this.hooks.move?.(e);
      else this.hooks.hover?.(e);
    });
    const up = (e) => { if (drag && !drag.rotate) this.hooks.up?.(e); drag = null; };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.distance = THREE.MathUtils.clamp(this.distance * (1 + e.deltaY * 0.001), 1.5, 14); }, { passive: false });
  }
  /** Raycast from a pointer event against some objects; returns the first hit or null. */
  pick(e, objects) {
    const r = this.canvas.getBoundingClientRect();
    this._ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this._ndc, this.camera);
    const hits = this.ray.intersectObjects(objects, true);
    return hits[0] || null;
  }
  /** Show a tool as the mouse cursor over the 3D view. */
  setCursor(ch, hx = 16, hy = 16) { this.canvas.style.cursor = ch ? emojiCursor(ch, hx, hy) : ''; }
  /** Pointer position on the vertical plane z = planeZ (world space), for dragging things around. */
  planePoint(e, planeZ = 0) {
    const r = this.canvas.getBoundingClientRect();
    this._ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this._ndc, this.camera);
    const out = new THREE.Vector3();
    return this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -planeZ), out) ? out : null;
  }
  onFrame(fn) { this.frameCbs.push(fn); }
  _frame() {
    const dt = Math.min(this._clock.getDelta(), 0.05), t = this._clock.elapsedTime;
    if (this.autoSpin) this.yaw += dt * this.autoSpin;
    // Only the spin (yaw) turns the model; "tilt" raises or lowers the camera, so things resting on a table never sink into it.
    this.pivot.rotation.y = this.yaw;
    const d = this.distance, el = THREE.MathUtils.clamp(0.14 + this.tilt, -0.2, 1.4);
    this.camera.position.set(this.target.x, this.target.y + d * Math.sin(el), d * Math.cos(el)); this.camera.lookAt(this.target);
    for (const f of this.frameCbs) f(dt, t);
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.renderer.setAnimationLoop(null); this._ro.disconnect();
    this.scene.traverse((o) => {
      o.geometry?.dispose?.();
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of ms) { for (const v of Object.values(m)) if (v && v.isTexture) v.dispose(); m.dispose(); }
    });
    this.scene.environment?.dispose?.();
    this.renderer.dispose(); this.renderer.forceContextLoss?.(); this.canvas.remove();
  }
}
