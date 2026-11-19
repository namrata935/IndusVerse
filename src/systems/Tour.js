import * as THREE from 'three';
import gsap from 'gsap';

/**
 * Guided tour: the camera position and look-at target each follow a CatmullRom spline through
 * the stop list. GSAP tweens a single parameter u between stops; a caption shows at each stop.
 * Skip / back / exit are available at any time.
 */
export class Tour {
  constructor(app) {
    this.app = app; this.active = false; this.stops = []; this.index = 0;
    this.u = { v: 0 }; this.blend = { v: 0 };
    this.tween = null; this.timer = null;
    this._p = new THREE.Vector3(); this._l = new THREE.Vector3(); this._startPos = new THREE.Vector3(); this._startQuat = new THREE.Quaternion();
    this._tmpCam = new THREE.PerspectiveCamera();
  }
  start(sceneId, stops, { onEnd } = {}) {
    const a = this.app;
    this.stop(true);
    this.sceneId = sceneId; this.stops = stops; this.onEnd = onEnd;
    const pts = stops.map((s) => new THREE.Vector3(...s.pos)), looks = stops.map((s) => new THREE.Vector3(...s.look));
    this.posCurve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    this.lookCurve = new THREE.CatmullRomCurve3(looks, false, 'centripetal');
    this.active = true; this.index = 0;
    a.controls.mode = 'tour';
    a.ui.panel.hide(); a.captions.hide();
    this._startPos.copy(a.camera.position); this._startQuat.copy(a.camera.quaternion);
    this.u.v = 0; this.blend.v = 0;
    a.ui.hud.setTour(true, stops.length, 0);
    a.audio.blip(520);
    this.tween = gsap.to(this.blend, { v: 1, duration: 2.6, ease: 'power2.inOut', onComplete: () => this._arrive() });
  }
  _arrive() {
    const s = this.stops[this.index];
    this.app.ui.hud.setTour(true, this.stops.length, this.index);
    this.app.captions.show(this.sceneId, s.id, { tour: true });
    this.timer = gsap.delayedCall(s.hold ?? 9, () => this.next());
  }
  _go(i, duration = 6.5) {
    this.timer?.kill(); this.tween?.kill();
    this.app.captions.hide();
    this.index = i;
    this.app.ui.hud.setTour(true, this.stops.length, i);
    const target = i / (this.stops.length - 1);
    this.tween = gsap.to(this.u, { v: target, duration, ease: 'power2.inOut', onComplete: () => this._arrive() });
  }
  next() {
    if (!this.active) return;
    if (this.index >= this.stops.length - 1) return this.stop();
    this._go(this.index + 1, this.blend.v < 1 ? 2.5 : 6.5);
  }
  prev() {
    if (!this.active || this.index === 0) return;
    this._go(this.index - 1, 4.5);
  }
  stop(silent = false) {
    if (!this.active) return;
    this.timer?.kill(); this.tween?.kill();
    this.active = false;
    const a = this.app;
    a.captions.hide();
    a.ui.hud.setTour(false);
    a.controls.mode = 'walk';
    a.controls.syncFromCamera();
    const g = a.controls.ground;
    // if we are not near a walkable floor, continue in fly mode instead of dropping through the world
    if (!g || a.camera.position.y - g.height(a.camera.position.x, a.camera.position.z) > a.controls.eye + 1.2 || g.blocked(a.camera.position.x, a.camera.position.z, 0.4)) a.controls.mode = 'fly';
    if (!silent) this.onEnd?.();
  }
  update() {
    if (!this.active) return;
    const t = THREE.MathUtils.clamp(this.u.v, 0, 1);
    this.posCurve.getPoint(t, this._p); this.lookCurve.getPoint(t, this._l);
    const cam = this.app.camera;
    this._tmpCam.position.copy(this._p);
    this._tmpCam.up.set(0, 1, 0);
    this._tmpCam.lookAt(this._l);
    const b = this.blend.v;
    cam.position.lerpVectors(this._startPos, this._p, b);
    cam.quaternion.slerpQuaternions(this._startQuat, this._tmpCam.quaternion, b);
  }
}
