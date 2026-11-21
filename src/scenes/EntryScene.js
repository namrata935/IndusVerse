import * as THREE from 'three';
import gsap from 'gsap';
import { BaseScene } from '../core/BaseScene.js';
import { BuildKit } from '../shared/builders.js';
import { PALETTE } from '../shared/palette.js';
import { rng, makeSignTexture } from '../shared/textures.js';
import { createGround, createRidge, scatter } from '../shared/nature.js';
import { makeFlat, makeMetal, makeWoodMaterial, makeGroundMaterial } from '../shared/materials.js';
import {
  createTrees, createReeds, createPots, createBullockCart, createLamp, createBanner, createAwning, createBirds,
  createDust, createGrainHeap, makeGlowSprite,
} from '../shared/props.js';
import { createWater } from '../shared/water.js';
import { randomPerson, Walker } from '../shared/people.js';
import { loadModel } from '../shared/models.js';

const PORTALS = [
  { id: 'greatBath', color: 0x1fa6a0, z: -6, side: -1 },
  { id: 'townPlanning', color: 0xe0612f, z: -18, side: 1 },
  { id: 'market', color: 0xe8b13c, z: -32, side: 1 },
  { id: 'dock', color: 0xc42a45, z: -46, side: -1 },
];

/**
 * Entry scene: a Mohenjo-daro street at golden-hour dawn. Five glowing signposts (portals)
 * open the scene menu. Walk with WASD, look by dragging.
 */
export class EntryScene extends BaseScene {
  static id = 'entry';
  static settings = {
    ui: 'entry',
    camera: { pos: [0.4, 1.7, 22], yaw: 0, pitch: 0.03, mode: 'walk', eye: 1.7, speed: 3.2 },
    lighting: {
      time: 6.4, sky: { turbidity: 9, rayleigh: 1.9, mie: 0.02, mieG: 0.93 }, fogDensity: 0.0042, fogTint: 0xffa860,
      shadowSize: 60, azimuthOffset: -0.5, exposure: 1.05, sunBoost: 1.4, hemiBoost: 3.4, fillBoost: 2.4,
    },
    audio: { wind: 0.35, birds: 0.7 },
    look: { bloom: { strength: 0.35, threshold: 0.9, radius: 0.7 }, saturation: 1.18, contrast: 1.08, vignette: 0.34 },
    bounds: { minX: -42, maxX: 42, minZ: -104, maxZ: 32 },
  };

  async init() {
    const R = rng(42);
    const rnd = (a, b) => a + R() * (b - a);
    const kit = new BuildKit(this.ground, 11);
    kit.R = R;

    // ---- ground: dusty plain + stone-paved street
    this.add(createGround(900, 'earth'));
    kit.box('plaster', 0, 0.02, -30, 6.2, 0.06, 140, { tint: 0xf0c090, vary: 0 });
    // green fields & scrub patches either side of the far plain
    const meadow = new THREE.Mesh(new THREE.PlaneGeometry(500, 60).rotateX(-Math.PI / 2), makeGroundMaterial('grass'));
    meadow.position.set(0, 0.03, -132); meadow.receiveShadow = true; this.add(meadow);
    const meadow2 = meadow.clone(); meadow2.scale.set(1, 1, 1.2); meadow2.position.set(0, 0.03, -204); this.add(meadow2);

    // ---- covered drains along both kerbs: brick channel, stone cover slabs, dark inspection openings
    for (const side of [-1, 1]) {
      const x = side * 2.65;
      kit.box('brick', x - 0.5 * side, 0.1, -30, 0.14, 0.26, 140, { vary: 0.05 });
      kit.box('brick', x + 0.5 * side, 0.1, -30, 0.14, 0.26, 140, { vary: 0.05 });
      for (let z = 26, k = 0; z > -96; z -= 1.9, k++) {
        if (k % 7 === 3) kit.box('accent', x, 0.13, z - 0.95, 0.8, 0.04, 1.85, { tint: 0x0d0807, vary: 0 }); // open inspection gap
        else kit.box('stone', x, 0.2, z - 0.95, 0.86, 0.1, 1.84, { tint: k % 2 ? 0xe9dcc6 : 0xd8c6aa, vary: 0.1 });
      }
    }

    // ---- brick houses lining both sides
    const lane = [-25.5, -21];
    for (const side of [-1, 1]) {
      let z = 26;
      while (z > -84) {
        const w = rnd(5.5, 9), d = rnd(6, 10), h = rnd(3.2, 5.4);
        if (z > lane[0] && z - w < lane[1]) { z = lane[0]; continue; }
        const mat = R() < 0.28 ? 'plaster' : 'brick';
        kit.house({ x: side * (3.55 + d / 2), z: z - w / 2, w, d, h, rot: side < 0 ? Math.PI / 2 : -Math.PI / 2, mat, upper: R() < 0.25, accent: [PALETTE.lapis, PALETTE.turquoise, PALETTE.madder, PALETTE.ochre, PALETTE.indigo][Math.floor(R() * 5)] });
        z -= w;
        if (R() < 0.3) z -= rnd(1.6, 2.4); // narrow alley
      }
      // low garden wall closing the far end
      kit.wall(side * 12, -90, side * 3.6, -90, { h: 2.4, t: 0.6, mat: 'brick' });
    }
    // end-of-street gate pillars in lapis-washed plaster
    for (const s of [-1, 1]) kit.box('plaster', s * 3.4, 1.7, -86, 1.0, 3.4, 1.0, { tint: 0xc9d8f0, collide: true });
    kit.box('wood', 0, 3.6, -86, 8, 0.4, 0.7, { tint: 0x7a4a30 });

    // ---- distant citadel mound beyond the river (stepped brick + plastered buildings)
    this._mound(kit, rnd, 0, -226);

    kit.build(this.root);

    // ---- river + banks (teal-blue band across the plain)
    const river = createWater({ width: 700, depth: 34, color: 0x1a8f9c, opacity: 0.93, repeat: [70, 3.4], rippleRings: 0 });
    river.group.position.set(0, 0.07, -164);
    this.lighting.onEnv((e) => river.setEnv(e));
    this.add(river.group, (dt) => river.update(dt));
    const reedPts = [];
    for (const zc of [-145.5, -183]) for (let i = 0; i < 520; i++) reedPts.push([(R() - 0.5) * 360, 0.05, zc + (R() - 0.5) * 7]);
    this.add(createReeds(reedPts, { uTime: this.uTime, seed: 3 }));

    // ---- trees
    const treePts = [
      ...scatter(26, [-45, 45, -140, -100], { y: 0, seed: 5 }),
      ...scatter(30, [-120, 120, -150, -146], { y: 0, seed: 6 }),
      ...scatter(14, [-30, 30, -200, -184], { y: 0, seed: 7 }),
      [-8.5, 0, -23.3, 1.1], [8.5, 0, -23.3, 1.2], [-6, 0, -28.5, 1], [-3.8, 0, 29, 0.9], [4.2, 0, 28, 1.0], [-12, 0, 18, 1.0], [14, 0, -12, 1.2],
    ];
    this.add(createTrees(treePts, { uTime: this.uTime, seed: 8 }));

    // ---- far hills (blue-violet), for depth and hue contrast
    const ridge = createRidge({ width: 1100, height: 70, color: 0x7e86b4, seed: 3 });
    ridge.position.set(0, 0, -480); this.add(ridge);
    const ridge2 = createRidge({ width: 1100, height: 45, color: 0x8c92bc, seed: 7 });
    ridge2.position.set(-60, 0, -440); this.add(ridge2);

    // ---- props: bullock carts, pots, grain, banners, awnings, lamps
    const cartSpec = [[1.1, 9, Math.PI / 2, PALETTE.cloth[0]], [-1.0, -13, -Math.PI / 2 + 0.1, PALETTE.cloth[1]], [0.9, -40, Math.PI / 2 - 0.15, PALETTE.cloth[3]]];
    for (const [x, z, ry, cl] of cartSpec) {
      const cart = await loadModel('bullock_cart', () => createBullockCart({ cloth: cl }));
      cart.position.set(x, 0, z); cart.rotation.y = ry;
      this.root.add(cart);
      // cart + bullocks span ~5m along local x (from x-1 to x+4): block a box around that footprint
      const c = Math.cos(ry), s = Math.sin(ry);
      const mx = x + 1.5 * c, mz = z - 1.5 * s; // footprint centre in world
      const ex = Math.abs(c) * 2.5 + Math.abs(s) * 0.8, ez = Math.abs(s) * 2.5 + Math.abs(c) * 0.8;
      this.ground.addBlocker(mx - ex, mx + ex, mz - ez, mz + ez);
    }
    const pots = [];
    for (let i = 0; i < 34; i++) {
      const side = R() < 0.5 ? -1 : 1;
      pots.push([side * rnd(3.0, 3.6) + (R() - 0.5) * 0.3, 0.02, rnd(24, -80), rnd(0.9, 1.3)]);
    }
    for (let i = 0; i < 8; i++) pots.push([-5.5 + R(), 0, 20 + R() * 2, 1.2]);
    this.add(createPots(pots));
    for (const [x, z, c] of [[-3.4, 14, PALETTE.ochre], [3.4, -2, 0xc9a36b], [-3.3, -38, PALETTE.ochre], [3.5, -52, 0xd9c28a]]) {
      const g = createGrainHeap(c); g.position.set(x, 0, z); this.add(g);
    }
    for (const [x, z, ci] of [[-3.3, 12, 0], [3.3, 3, 1], [-3.3, -10, 3], [3.3, -28, 2], [-3.3, -48, 4], [3.3, -66, 5]]) {
      const b = createBanner({ uTime: this.uTime, colors: [PALETTE.cloth[ci], PALETTE.ochre, PALETTE.indigo, PALETTE.turquoise], poleH: 4.2 });
      b.position.set(x, 0, z); b.rotation.y = x < 0 ? 0 : Math.PI; this.add(b);
    }
    for (const [x, z] of [[-3.8, 8], [3.8, -16], [-3.8, -34]]) {
      const a = createAwning({ uTime: this.uTime, w: 4.6, d: 2.6, colors: [PALETTE.cloth[Math.floor(R() * 6)], PALETTE.ochre, PALETTE.turquoise, PALETTE.indigo] });
      a.position.set(x + (x < 0 ? 1.4 : -1.4), 0, z); this.add(a);
    }
    const lampZ = [20, 6, -10, -28, -44, -62];
    lampZ.forEach((z, i) => {
      const side = i % 2 ? 1 : -1;
      const lamp = createLamp({ lamps: this.lamps, x: side * 3.25, z, light: i < 4 });
      if (lamp) this.add(lamp);
    });

    // ---- portals (signposts) -> menu
    this.portals = [];
    for (const p of PORTALS) this._portal(p);

    // ---- people
    this.walkers = [];
    const personSpec = [
      [[-1.5, 18], [-1.0, -6]], [[1.4, 12], [1.6, -26]], [[0.5, -4], [-0.7, -50]], [[-1.8, -30], [-1.4, 4]], [[1.8, -52], [1.2, -8]],
      [[0.2, 22], [0.4, -8]], [[-0.8, -14], [-1.6, -64]], [[1.0, -22], [0.2, 16]],
    ];
    personSpec.forEach((pts, i) => {
      const person = randomPerson(R, { carry: i % 3 === 0 });
      this.add(person);
      this.walkers.push(new Walker(person, pts, { speed: 0.7 + R() * 0.5 }));
    });
    [[-3.0, 8, Math.PI / 2], [3.1, -20, -Math.PI / 2], [3.1, -38, -Math.PI / 2]].forEach(([x, z, ry]) => {
      const p = randomPerson(R); p.position.set(x, 0, z); p.rotation.y = ry; this.add(p);
    });

    // ---- life: birds, dust motes
    const birds = createBirds(14, { center: [0, 30, -50], radius: 70, spread: 14, seed: 4 });
    this.add(birds.group, (dt, t) => birds.update(dt, t));
    const dust = createDust({ count: 320, box: 36, height: 12 });
    this.add(dust.points, (dt) => dust.update(dt, this.app.camera.position, 1));

    this.updaters.push((dt, t) => {
      this.walkers.forEach((w) => w.update(dt));
      for (const p of this.portals) {
        p.plaque.rotation.y = Math.sin(t * 0.8 + p.phase) * 0.25;
        p.ring.material.opacity = 0.45 + 0.25 * Math.sin(t * 2.5 + p.phase);
        p.ring.scale.setScalar(1 + 0.08 * Math.sin(t * 2.5 + p.phase));
      }
    });
  }

  _portal({ id, color, z, side }) {
    const g = new THREE.Group();
    g.position.set(side * 1.7, 0, z);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.1, 0.22), makeWoodMaterial());
    post.position.y = 1.55; post.castShadow = true;
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.28, 0.8), makeFlat(0xb8a690));
    base.position.y = 0.14; base.castShadow = true;
    // rounded-square seal plaque (ExtrudeGeometry, bevelled), glowing
    const s = 0.62, r = 0.16, shape = new THREE.Shape();
    shape.moveTo(-s + r, -s); shape.lineTo(s - r, -s); shape.quadraticCurveTo(s, -s, s, -s + r); shape.lineTo(s, s - r);
    shape.quadraticCurveTo(s, s, s - r, s); shape.lineTo(-s + r, s); shape.quadraticCurveTo(-s, s, -s, s - r);
    shape.lineTo(-s, -s + r); shape.quadraticCurveTo(-s, -s, -s + r, -s);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.035, bevelSegments: 2 });
    geo.translate(0, 0, -0.05);
    const sign = makeSignTexture(PORTALS.findIndex((p) => p.id === id) + 1, color);
    // map only the front face area: simple planar UVs from XY
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + s) / (2 * s), (pos.getY(i) + s) / (2 * s));
    const plaqueMat = new THREE.MeshStandardMaterial({ map: sign, emissiveMap: sign, emissive: 0xffffff, emissiveIntensity: 1.1, roughness: 0.5 });
    const plaque = new THREE.Mesh(geo, plaqueMat);
    plaque.position.y = 3.45; plaque.castShadow = true;
    const halo = makeGlowSprite(color, 4.2, 0.55); halo.position.y = 3.45;
    const ringGeo = new THREE.RingGeometry(0.7, 1.05, 40).rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    ring.position.y = 0.07;
    g.add(post, base, plaque, halo, ring);
    this.add(g);
    this.ground.addBlocker(g.position.x - 0.3, g.position.x + 0.3, z - 0.3, z + 0.3);
    this.portals.push({ id, plaque, ring, phase: Math.random() * 6 });
    const c = this.app.data.menu[id];
    this.hotspots.add({
      id: 'portal_' + id, position: new THREE.Vector3(g.position.x, 3.45, z), color, radius: 3.6, size: 0.9,
      kind: 'portal',
      onActivate: () => { if (this.time > 4) this.app.ui.openMenu(id); },
    });
    this._portalTitle = c;
  }

  _mound(kit, rnd, cx, cz) {
    kit.box('brick', cx, 8, cz, 220, 16, 70, { tint: 0xe8b8a0, vary: 0.05 });
    kit.box('stone', cx, 16.4, cz, 214, 0.8, 64, { tint: 0xd8c8b0 });
    for (let i = 0; i < 26; i++) {
      const w = rnd(8, 18), d = rnd(8, 16), h = rnd(5, 12);
      kit.house({ x: cx - 100 + i * 7.6 + rnd(-2, 2), z: cz + rnd(-22, 22), w, d, h, y0: 16.8, rot: 0, mat: i % 3 ? 'brick' : 'plaster', collide: false });
    }
    // great-bath style pavilion with a pale blue-white plaster roofline
    kit.box('plaster', cx + 8, 21, cz, 30, 8, 22, { tint: 0xdbe6f4, collide: false });
    kit.box('accent', cx + 8, 25.2, cz, 31, 0.5, 23, { tint: PALETTE.lapis });
    for (const s of [-1, 1]) kit.box('brick', cx + s * 55, 26, cz - 18, 8, 20, 8, { tint: 0xd9a58a, collide: false });
  }

  onEnter() {
    const a = this.app;
    a.captions.show('entry', 'intro', { duration: 11000 });
    gsap.delayedCall(12.5, () => { if (!a.ui.menu.visible && !a.tour.active && a.sceneManager.current === this) a.captions.show('entry', 'hint', { duration: 9000 }); });
  }
}
