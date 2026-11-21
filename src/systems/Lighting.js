import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

const C = (h) => new THREE.Color(h);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * Time-of-day lighting rig: procedural Sky shader + warm key sun (PCFSoft shadows) +
 * cool hemisphere fill (blue-tinted shadows) + fog + lamp flicker. One call to setTime(h)
 * re-derives every colour and intensity from the sun elevation.
 */
export class DayNight {
  constructor(scene, renderer, app, cfg = {}) {
    this.scene = scene; this.renderer = renderer; this.app = app;
    this.cfg = {
      sky: { turbidity: 6, rayleigh: 2, mie: 0.005, mieG: 0.8 },
      fogDensity: 0.006, fogTint: 0xffffff,
      shadowSize: 70, azimuthOffset: 0, maxElev: 62, exposure: 0.55,
      sunBoost: 1, hemiBoost: 1,
      ...cfg,
    };
    this.time = 9;
    this.sunDir = new THREE.Vector3();
    this.elev = 30;
    this.lamps = [];
    this.envTargets = [];
    this.envRT = null;
    this._envT = 0;

    this.sky = new Sky();
    this.sky.scale.setScalar(900);
    this.sky.frustumCulled = false;
    scene.add(this.sky);
    this.envSky = new Sky(); this.envSky.scale.setScalar(50);
    this.envScene = new THREE.Scene(); this.envScene.add(this.envSky);
    this.pmrem = new THREE.PMREMGenerator(renderer);

    this.sun = new THREE.DirectionalLight(0xfff0d0, 3);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.05;
    this.sun.shadow.radius = 3;
    scene.add(this.sun, this.sun.target);

    this.hemi = new THREE.HemisphereLight(0x9cc4ff, 0xa0623d, 0.8);
    scene.add(this.hemi);
    this.fill = new THREE.DirectionalLight(0x7aa2ff, 0.0); // cool "sky bounce" from the opposite side
    scene.add(this.fill, this.fill.target);

    scene.fog = new THREE.FogExp2(0xdbb899, this.cfg.fogDensity);
    this.applyQuality(app.quality.shadowSize);
    this.setTime(this.time, true);
  }

  applyQuality(size) {
    const s = this.sun.shadow;
    if (s.map) { s.map.dispose(); s.map = null; }
    s.mapSize.set(size, size);
    const e = this.cfg.shadowSize;
    s.camera.left = -e; s.camera.right = e; s.camera.top = e; s.camera.bottom = -e;
    s.camera.near = 1; s.camera.far = e * 4;
    s.camera.updateProjectionMatrix();
  }

  setTime(h, force = false) {
    this.time = h;
    const c = this.cfg;
    const ang = ((h - 6) / 12) * Math.PI;
    const elev = Math.sin(ang) * c.maxElev; // degrees; negative below horizon
    this.elev = elev;
    const az = ((h - 6) / 12) * Math.PI * 0.9 + 0.35 + c.azimuthOffset; // east -> west sweep
    const er = THREE.MathUtils.degToRad(elev);
    this.sunDir.set(Math.cos(er) * Math.cos(az), Math.sin(er), Math.cos(er) * Math.sin(az)).normalize();
    // sun colour: deep orange at the horizon -> golden -> warm white
    const warm = C(0xff7a2e).lerp(C(0xffc27a), sstep(-2, 10, elev)).lerp(C(0xfff3e0), sstep(10, 45, elev));
    this.sun.color.copy(warm);
    const day = sstep(-5, 8, elev);
    this.sun.intensity = (0.15 + day * 3.0) * c.sunBoost * (elev > -6 ? 1 : 0);
    // sky shader
    const u = this.sky.material.uniforms, ue = this.envSky.material.uniforms;
    const rayleigh = c.sky.rayleigh * (0.6 + 1.2 * (1 - sstep(0, 25, elev)));
    for (const x of [u, ue]) {
      x.turbidity.value = c.sky.turbidity; x.rayleigh.value = rayleigh;
      x.mieCoefficient.value = c.sky.mie; x.mieDirectionalG.value = c.sky.mieG;
      x.sunPosition.value.copy(this.sunDir);
    }
    // cool fill: blue shadows
    this.hemi.color.copy(C(0x6c8fd6).lerp(C(0xa8cdf5), sstep(0, 30, elev)).lerp(C(0x1f2a5a), 1 - sstep(-10, 3, elev)));
    this.hemi.groundColor.copy(C(0x8a4f32).lerp(C(0xb8774c), sstep(0, 30, elev)).lerp(C(0x1a1420), 1 - sstep(-10, 3, elev)));
    const night = 1 - sstep(-8, 4, elev);
    this.hemi.intensity = (0.28 + 0.75 * sstep(-8, 20, elev)) * c.hemiBoost + night * (c.nightHemi ?? 0);
    this.fill.color.set(0x6f98ff);
    this.fill.intensity = 0.35 * sstep(-8, 15, elev) * (c.fillBoost ?? 1) + night * (c.moon ?? 0);
    this.fill.position.set(-this.sunDir.x, 0.6, -this.sunDir.z).multiplyScalar(60);
    // fog follows the horizon colour
    const fog = C(0x0b1330).lerp(C(0xc0504a), sstep(-10, -1, elev)).lerp(C(0xf0b48a), sstep(-2, 8, elev)).lerp(C(0xcfe2ee), sstep(10, 40, elev));
    fog.lerp(C(c.fogTint), 0.18);
    this.scene.fog.color.copy(fog);
    this.scene.fog.density = c.fogDensity;
    this.renderer.toneMappingExposure = c.exposure * (0.75 + 0.35 * day);
    this.lampFactor = sstep(10, -3, elev);
    this._envDirty = true;
    if (force) this.refreshEnv();
  }

  refreshEnv() {
    this._envDirty = false;
    const rt = this.pmrem.fromScene(this.envScene, 0, 1, 100);
    if (this.envRT) this.envRT.dispose();
    this.envRT = rt;
    this.envTargets.forEach((fn) => fn(rt.texture));
  }
  onEnv(fn) { this.envTargets.push(fn); if (this.envRT) fn(this.envRT.texture); }
  get envMap() { return this.envRT ? this.envRT.texture : null; }

  addLamp(rec) { this.lamps.push(rec); }

  /** Keep the sun's shadow frustum centred on the viewer (snapped to texels). */
  follow(focus) {
    const e = this.cfg.shadowSize, texel = (e * 2) / this.sun.shadow.mapSize.x;
    const fx = Math.round(focus.x / texel) * texel, fz = Math.round(focus.z / texel) * texel, fy = focus.y * 0.0;
    this.sun.target.position.set(fx, fy, fz);
    this.sun.position.set(fx, fy, fz).addScaledVector(this.sunDir, e * 2);
    this.sun.target.updateMatrixWorld();
    this.sky.position.copy(focus);
  }

  update(dt, t, focus) {
    this.follow(focus);
    if (this._envDirty && (this._envT += dt) > 0.35) { this._envT = 0; this.refreshEnv(); }
    for (const l of this.lamps) {
      const f = this.lampFactor;
      const flick = 0.82 + 0.18 * Math.sin(t * 9 + l.seed) * Math.sin(t * 5.3 + l.seed * 2) + (Math.random() - 0.5) * 0.06;
      if (l.light) l.light.intensity = l.base * f * flick;
      l.flame.material.opacity = 0.35 + 0.65 * Math.max(f, 0.35) * flick;
      l.flame.scale.setScalar(0.5 + 0.12 * flick);
    }
  }

  dispose() {
    if (this.envRT) this.envRT.dispose();
    this.pmrem.dispose();
    this.sun.shadow.map?.dispose();
    for (const s of [this.sky, this.envSky]) { s.geometry.dispose(); s.material.dispose(); }
  }
}
