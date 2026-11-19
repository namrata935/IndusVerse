import * as THREE from 'three';
import { DayNight } from '../systems/Lighting.js';
import { Hotspots } from '../systems/Hotspots.js';
import { GroundMap } from '../shared/ground.js';
import { disposeTextureCache } from '../shared/textures.js';

/**
 * Base class for every scene. Subclasses set `static id`, override `settings` and implement
 * init() (build content into this.root) and update(dt). Everything created here is disposed
 * in dispose() — geometries, materials, textures, lights, hotspots, render targets.
 *
 * Per-scene settings (all optional):
 *  camera   : {pos:[x,y,z], yaw, pitch, mode:'walk'|'fly', eye, speed}
 *  lighting : {time, sky:{turbidity,rayleigh,mie,mieG}, fogDensity, fogTint, shadowSize, azimuthOffset, exposure, ...}
 *  timeSlider: bool, ui: 'entry' | 'scene' | 'soon', audio:{wind,water,birds,crackle,waterPos}
 *  look     : post-processing overrides {bloom:{strength,threshold,radius}, saturation, contrast, vignette}
 *  bounds   : walkable/minimap rectangle {minX,maxX,minZ,maxZ}
 */
export class BaseScene {
  static id = 'base';
  static settings = {};

  constructor(app) {
    this.app = app;
    this.scene = new THREE.Scene();
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.uTime = { value: 0 };
    this.time = 0;
    this.ground = new GroundMap();
    this.lamps = [];
    this.settings = {
      camera: { pos: [0, 1.7, 0], yaw: 0, pitch: 0, mode: 'walk', eye: 1.7, speed: 3.4 },
      lighting: { time: 9 }, timeSlider: false, ui: 'scene', audio: {}, look: {}, bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 },
      ...this.constructor.settings,
    };
    this.disposers = [];
    this.updaters = [];
  }
  get id() { return this.constructor.id; }

  /** Called by SceneManager: builds lights, then content. */
  async load() {
    const s = this.settings;
    this.lighting = new DayNight(this.scene, this.app.renderer, this.app, s.lighting);
    this.lighting.setTime(s.lighting.time ?? 9, true);
    this.hotspots = new Hotspots(this.root);
    await this.init();
    this.lighting.lamps.push(...this.lamps);
  }
  /** Subclass: build content. */
  async init() {}
  /** Subclass: runs after the fade-in begins (captions etc). */
  onEnter() {}
  /** Subclass: guided-tour stops (array) or null. */
  getTourStops() { return null; }

  /** Applies camera, audio, post, UI for this scene. */
  activate() {
    const a = this.app, s = this.settings;
    a.controls.configure({ ...s.camera, ground: this.ground, bounds: s.bounds });
    a.audio.setScene(s.audio);
    a.post.setScene(this.scene, a.camera);
    a.post.applyLook(s.look);
    a.ui.hud.setMode(s.ui, { timeSlider: s.timeSlider, time: s.lighting.time, hasTour: !!this.getTourStops() });
    a.ui.minimap.setScene(s.ui === 'soon' ? null : s.bounds, this.ground, this.hotspots.items);
    this.lighting.applyQuality(a.quality.shadowSize);
  }
  setTime(h) { this.lighting.setTime(h); }

  update(dt) {
    this.time += dt;
    this.uTime.value = this.time;
    const cam = this.app.camera;
    this.lighting.update(dt, this.time, cam.position);
    this.hotspots.update(dt, this.time, cam);
    for (const u of this.updaters) u(dt, this.time);
  }

  /** Utility: add to root and track updaters / disposers. */
  add(obj, updater, disposer) {
    this.root.add(obj);
    if (updater) this.updaters.push(updater);
    if (disposer) this.disposers.push(disposer);
    return obj;
  }

  dispose() {
    this.app.tour.stop(true);
    this.hotspots.dispose();
    this.lighting.dispose();
    this.disposers.forEach((d) => d());
    this.scene.traverse((o) => {
      o.userData?.dispose?.();
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
        m.dispose();
      }
      if (o.isInstancedMesh) o.dispose();
    });
    this.scene.environment = null;
    this.scene.clear();
    disposeTextureCache();
  }
}
