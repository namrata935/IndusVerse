import * as THREE from 'three';
import { BaseScene } from '../core/BaseScene.js';
import { createGround } from '../shared/nature.js';
import { BuildKit } from '../shared/builders.js';
import { PALETTE } from '../shared/palette.js';

/**
 * Placeholder used by the four not-yet-built scenes. A stub only has to set `static id`,
 * `static accent` and (optionally) its caption key; it shows a small brick plinth with a
 * glowing seal, the HUD "Coming soon" card, and offers the way back to the menu.
 */
export class ComingSoonScene extends BaseScene {
  static id = 'comingSoon';
  static accent = PALETTE.ochre;
  static settings = {
    ui: 'soon',
    camera: { pos: [0, 2.2, 7], yaw: 0, pitch: -0.12, mode: 'fly', eye: 1.7, speed: 3 },
    lighting: { time: 8.5, sky: { turbidity: 5, rayleigh: 2.2, mie: 0.005, mieG: 0.8 }, fogDensity: 0.01, shadowSize: 30, exposure: 0.55 },
    audio: { wind: 0.4, birds: 0.2 }, bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 },
  };
  async init() {
    this.add(createGround(200, 'earth'));
    const kit = new BuildKit(this.ground, 5);
    kit.box('stone', 0, 0.3, 0, 4, 0.6, 4, {});
    kit.box('brick', 0, 1.1, 0, 2.4, 1, 2.4, {});
    kit.build(this.root);
    const seal = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 0.18), new THREE.MeshStandardMaterial({ color: this.constructor.accent, emissive: this.constructor.accent, emissiveIntensity: 0.9, roughness: 0.4 }));
    seal.position.set(0, 2.5, 0);
    this.add(seal, (dt, t) => { seal.rotation.y = t * 0.8; seal.position.y = 2.5 + Math.sin(t * 1.5) * 0.12; });
  }
  onEnter() {
    const c = this.app.captions.get('comingSoon', this.constructor.id) ?? { title: 'Coming soon', text: '' };
    this.app.ui.hud.showComing(c.title, this.app.data.ui.comingSoonBody);
  }
}
