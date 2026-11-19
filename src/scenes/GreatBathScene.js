import * as THREE from 'three';
import { BaseScene } from '../core/BaseScene.js';
import { BuildKit } from '../shared/builders.js';
import { PALETTE } from '../shared/palette.js';
import { rng } from '../shared/textures.js';
import { createGround, createRidge, scatter } from '../shared/nature.js';
import { makeBitumenMaterial, makeFlat, makeGroundMaterial } from '../shared/materials.js';
import {
  createTrees, createReeds, createPots, createBullockCart, createLamp, createBanner, createAwning,
  createBirds, createDust, createGrainHeap,
} from '../shared/props.js';
import { createWater } from '../shared/water.js';
import { randomPerson, Walker } from '../shared/people.js';
import { loadModel } from '../shared/models.js';

// ---- key dimensions (metres) ----
const TOP = 6;                       // citadel platform top
const CIT = { minX: -60, maxX: 40, minZ: -30, maxZ: 30 };
const BATH = { cx: 10, cz: 0 };
const POOL = { minX: 4, maxX: 16, minZ: -3.5, maxZ: 3.5, depth: 2.4 }; // 12 x 7 x 2.4
const FLOOR = TOP - POOL.depth;      // 3.6
const WATER_Y = FLOOR + 2.0;         // 5.6
const GRANARY = { minX: -46, maxX: -26, minZ: -7, maxZ: 7 };

/**
 * Scene 1 — The Great Bath and the Citadel.
 * Cool turquoise water against warm red brick under a pale blue-white sky.
 */
export class GreatBathScene extends BaseScene {
  static id = 'greatBath';
  static settings = {
    ui: 'scene', timeSlider: true,
    camera: { pos: [10, 1.7, 66], yaw: 0, pitch: 0.12, mode: 'walk', eye: 1.7, speed: 3.6 },
    lighting: {
      time: 9.5, sky: { turbidity: 2.6, rayleigh: 1.5, mie: 0.004, mieG: 0.8 }, fogDensity: 0.0026, fogTint: 0xcfe6f6,
      shadowSize: 70, azimuthOffset: 0, exposure: 0.55, sunBoost: 1.0, hemiBoost: 1.0,
    },
    audio: { wind: 0.3, birds: 0.5, water: 0.9, crackle: 1, waterPos: [BATH.cx, WATER_Y, BATH.cz] },
    look: { bloom: { strength: 0.28, threshold: 0.92, radius: 0.65 }, saturation: 1.16, contrast: 1.07, vignette: 0.28 },
    bounds: { minX: -135, maxX: 135, minZ: -62, maxZ: 125 },
  };

  getTourStops() {
    return [
      { id: 'tour_approach', pos: [10, 2.6, 70], look: [10, 8.2, 24], hold: 9 },
      { id: 'tour_overview', pos: [-34, 27, 54], look: [6, 5, 0], hold: 9 },
      { id: 'tour_steps', pos: [-0.9, 8.4, 2.6], look: [5.2, 4.8, -0.2], hold: 9 },
      { id: 'tour_water', pos: [9, 7.9, 6.3], look: [11, 5.2, -1.5], hold: 9 },
      { id: 'tour_corridors', pos: [-3.9, 7.5, 8.2], look: [16, 7.4, 8.8], hold: 9 },
      { id: 'tour_granary', pos: [-17, 10.6, 11], look: [-36, 8.6, 0], hold: 10 },
    ];
  }

  async init() {
    const R = rng(91);
    const rnd = (a, b) => a + R() * (b - a);
    const g = this.ground;
    const kit = new BuildKit(g, 17);
    kit.R = R;

    // ============ terrain ============
    this.add(createGround(900, 'earth'));
    const meadow = new THREE.Mesh(new THREE.PlaneGeometry(700, 70).rotateX(-Math.PI / 2), makeGroundMaterial('grass'));
    meadow.position.set(0, 0.03, -92); meadow.receiveShadow = true; this.add(meadow);
    const meadow2 = meadow.clone(); meadow2.position.set(0, 0.03, -138); this.add(meadow2);

    // ============ citadel platform (a hole is left for the pool) ============
    const A = 0xf0c8b4;
    kit.box('brick', 0, 1.8, 0, 100, 3.6, 60, { tint: A, vary: 0 });
    for (const [x0, x1, z0, z1] of [
      [CIT.minX, POOL.minX, CIT.minZ, CIT.maxZ], [POOL.maxX, CIT.maxX, CIT.minZ, CIT.maxZ],
      [POOL.minX, POOL.maxX, POOL.maxZ, CIT.maxZ], [POOL.minX, POOL.maxX, CIT.minZ, POOL.minZ],
    ]) kit.brick.addMM(x0, FLOOR, z0, x1, TOP, z1, A, 0, 0.04);
    // stone plinth around the base + paving tint on top
    for (const [cx, cz, sx, sz] of [[0, 30.4, 102, 1.2], [0, -30.4, 102, 1.2], [40.4, 0, 1.2, 62], [-60.4, 0, 1.2, 62]]) kit.stone.add(cx, 0.45, cz, sx, 0.9, sz, 0xffffff, 0, 0.08, R);
    g.addPlatform(CIT.minX, CIT.maxX, CIT.minZ, CIT.maxZ, TOP);
    // pale dressed-stone paving on the citadel top around the bath complex (breaks up the brick red)
    for (const [x0, z0, x1, z1] of [[CIT.minX, CIT.minZ, -6, CIT.maxZ], [26, CIT.minZ, CIT.maxX, CIT.maxZ], [-6, CIT.minZ, 26, -11], [-6, 11, 26, CIT.maxZ]]) kit.stone.addMM(x0, TOP, z0, x1, TOP + 0.06, z1, 0xf2e6d0, 0, 0);

    // warm-pale paving inside the bath complex (contrast against the turquoise water and red piers)
    for (const [x0, z0, x1, z1] of [[-6, -11, POOL.minX - 0.5, 11], [POOL.maxX + 0.5, -11, 26, 11], [POOL.minX - 0.5, -11, POOL.maxX + 0.5, POOL.minZ - 0.5], [POOL.minX - 0.5, POOL.maxZ + 0.5, POOL.maxX + 0.5, 11]]) kit.stone.addMM(x0, TOP, z0, x1, TOP + 0.06, z1, 0xf0d2b4, 0, 0);
    // pool: rim coping, bitumen floor + wall lining, steps at both ends
    const cop = 0.5;
    for (const [x0, z0, x1, z1] of [
      [POOL.minX - cop, POOL.minZ - cop, POOL.maxX + cop, POOL.minZ], [POOL.minX - cop, POOL.maxZ, POOL.maxX + cop, POOL.maxZ + cop],
      [POOL.minX - cop, POOL.minZ, POOL.minX, POOL.maxZ], [POOL.maxX, POOL.minZ, POOL.maxX + cop, POOL.maxZ],
    ]) kit.stone.addMM(x0, TOP, z0, x1, TOP + 0.14, z1, 0xf4ead8, 0, 0.05);
    g.addHole(POOL.minX, POOL.maxX, POOL.minZ, POOL.maxZ, FLOOR);
    kit.stairs({ x: POOL.minX + 2.4, z: 0, y0: FLOOR, width: 6, steps: 8, rise: 0.3, run: 0.3, dir: '-x', tint: 0xffe2cc, sideWalls: false });
    kit.stairs({ x: POOL.maxX - 2.4, z: 0, y0: FLOOR, width: 6, steps: 8, rise: 0.3, run: 0.3, dir: '+x', tint: 0xffe2cc, sideWalls: false });
    g.addBlocker(POOL.minX + 0.9, POOL.maxX - 0.9, POOL.minZ, POOL.maxZ);
    const bit = makeBitumenMaterial();
    const lining = new THREE.Group();
    const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(12, 0.1, 7), bit); floorMesh.position.set(BATH.cx, FLOOR + 0.04, 0); floorMesh.receiveShadow = true;
    lining.add(floorMesh);
    for (const [cx, cz, sx, sz] of [[BATH.cx, POOL.minZ + 0.04, 12, 0.08], [BATH.cx, POOL.maxZ - 0.04, 12, 0.08]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, 1.3, sz), bit); m.position.set(cx, FLOOR + 0.65, cz); m.receiveShadow = true; lining.add(m);
    }
    this.add(lining);

    // water
    const water = createWater({ width: 12, depth: 7, color: 0x0b9da3, opacity: 0.9, reflect: 0.55, repeat: [3.2, 1.9], rippleRings: 6 });
    water.group.position.set(BATH.cx, WATER_Y, 0);
    water.materials.forEach((m) => { m.depthWrite = false; });
    this.lighting.onEnv((e) => water.setEnv(e));
    this.add(water.group, (dt) => water.update(dt));

    // ============ Great Bath complex: outer wall, gates, colonnaded corridors ============
    const WX0 = -6, WX1 = 26, WZ0 = -11, WZ1 = 11, WH = 4.2;
    const cap = PALETTE.turquoise;
    kit.wall(WX0, WZ1, 8, WZ1, { y0: TOP, h: WH, t: 1, capColor: cap, collide: true });      // south, gate x 8..12
    kit.wall(12, WZ1, WX1, WZ1, { y0: TOP, h: WH, t: 1, capColor: cap });
    kit.wall(WX0, WZ0, 8, WZ0, { y0: TOP, h: WH, t: 1, capColor: cap });                      // north gate
    kit.wall(12, WZ0, WX1, WZ0, { y0: TOP, h: WH, t: 1, capColor: cap });
    kit.wall(WX1, WZ0, WX1, -1.6, { y0: TOP, h: WH, t: 1, capColor: cap });                   // east gate z -1.6..1.6
    kit.wall(WX1, 1.6, WX1, WZ1, { y0: TOP, h: WH, t: 1, capColor: cap });
    kit.wall(WX0, WZ0, WX0, 3.5, { y0: TOP, h: WH, t: 1, capColor: cap });                    // west: wide opening z 3.5..10.5
    kit.wall(WX0, 10.5, WX0, WZ1, { y0: TOP, h: WH, t: 1, capColor: cap });
    // gate lintels (painted lapis) and stone thresholds
    kit.box('accent', 10, TOP + 3.6, WZ1, 4.6, 0.5, 1.2, { tint: PALETTE.lapis, vary: 0.04 });
    kit.box('accent', 10, TOP + 3.6, WZ0, 4.6, 0.5, 1.2, { tint: PALETTE.lapis, vary: 0.04 });
    kit.box('accent', WX1, TOP + 3.6, 0, 1.2, 0.5, 3.8, { tint: PALETTE.madder, vary: 0.04 });
    // pier lines facing the courtyard
    const CX0 = -2, CX1 = 22, CZ0 = -7.2, CZ1 = 7.2, CH = 3.4;
    kit.colonnade({ x1: CX0, z1: CZ1, x2: CX1, z2: CZ1, y0: TOP, h: CH, spacing: 3, beamColor: 0x7a4a30 });
    kit.colonnade({ x1: CX0, z1: CZ0, x2: CX1, z2: CZ0, y0: TOP, h: CH, spacing: 3, beamColor: 0x7a4a30 });
    kit.colonnade({ x1: CX0, z1: CZ0, x2: CX0, z2: CZ1, y0: TOP, h: CH, spacing: 3.6, beamColor: 0x7a4a30 });
    kit.colonnade({ x1: CX1, z1: CZ0, x2: CX1, z2: CZ1, y0: TOP, h: CH, spacing: 3.6, beamColor: 0x7a4a30 });
    // roofs of the four corridor wings + turquoise faience band under the eaves
    const roofY = TOP + CH + 0.4;
    for (const [x0, z0, x1, z1] of [[WX0, CZ1 - 0.3, WX1, WZ1], [WX0, WZ0, WX1, CZ0 + 0.3], [WX0, CZ0, CX0 + 0.3, CZ1], [CX1 - 0.3, CZ0, WX1, CZ1]]) {
      kit.brick.addMM(x0, roofY, z0, x1, roofY + 0.35, z1, 0xd8a890, 0, 0.05);
    }
    for (const [x0, z0, x1, z1] of [[CX0, CZ1 + 0.18, CX1, CZ1 + 0.3], [CX0, CZ0 - 0.3, CX1, CZ0 - 0.18]]) kit.accent.addMM(x0, TOP + CH + 0.02, z0, x1, TOP + CH + 0.4, z1, PALETTE.faience, 0, 0.05);
    // painted doorways opening off the corridors
    for (const x of [-1, 4, 10, 16, 21]) for (const z of [WZ1 - 0.55, WZ0 + 0.55]) {
      const s = z > 0 ? -1 : 1;
      kit.box('accent', x, TOP + 1.1, z + s * 0.01 * 0, 1.2, 2.2, 0.12, { tint: 0x1a0f0b, vary: 0 });
      kit.box('accent', x, TOP + 2.35, z, 1.8, 0.28, 0.22, { tint: [PALETTE.lapis, PALETTE.turquoise, PALETTE.madder, PALETTE.indigo, PALETTE.ochre][Math.abs(x) % 5], vary: 0.04 });
    }
    // a stair block hinting at an upper storey (north-east corner of the corridor)
    kit.stairs({ x: 23.4, z: -9.8, y0: TOP, width: 1.6, steps: 10, rise: 0.3, run: 0.34, dir: '-z', sideWalls: false });

    // ============ the Granary: ribbed brick base with ventilation channels, timber deck, hall frame ============
    const GZ = GRANARY.maxZ - GRANARY.minZ, GW = GRANARY.maxX - GRANARY.minX, GH = 1.95;
    const ribs = 7, ribW = 1.4, gap = (GZ - ribs * ribW) / (ribs - 1);
    for (let i = 0; i < ribs; i++) {
      const z0 = GRANARY.minZ + i * (ribW + gap);
      kit.brick.addMM(GRANARY.minX, TOP, z0, GRANARY.maxX, TOP + GH - 0.1, z0 + ribW, 0xf0c0a8, 0, 0.12);
      if (i < ribs - 1) kit.accent.addMM(GRANARY.minX + 0.05, TOP, z0 + ribW, GRANARY.maxX - 0.05, TOP + GH - 0.1, z0 + ribW + gap, 0x0f0907, 0, 0);
    }
    kit.wood.addMM(GRANARY.minX - 0.3, TOP + GH - 0.1, GRANARY.minZ - 0.3, GRANARY.maxX + 0.3, TOP + GH + 0.25, GRANARY.maxZ + 0.3, 0xf2d6b8, 0, 0.04);
    g.addBlocker(GRANARY.minX - 0.3, GRANARY.maxX + 0.3, GRANARY.minZ - 0.3, GRANARY.maxZ + 0.3);
    kit.stairs({ x: GRANARY.maxX + 3.0, z: 0, y0: TOP, width: 3, steps: 6, rise: 0.33, run: 0.5, dir: '-x', sideWalls: true });
    g.blockers.pop(); // keep stairs walkable: replace the full blocker with two end pieces
    g.addBlocker(GRANARY.minX - 0.3, GRANARY.maxX + 0.3 - 0, GRANARY.minZ - 0.3, -1.7);
    g.addBlocker(GRANARY.minX - 0.3, GRANARY.maxX + 0.3 - 0, 1.7, GRANARY.maxZ + 0.3);
    g.addBlocker(GRANARY.minX - 0.3, GRANARY.minX + 18, -1.7, 1.7);
    // timber hall frame on the deck + coloured awnings
    const deckY = TOP + GH + 0.25;
    for (let x = GRANARY.minX + 1.5; x <= GRANARY.maxX - 1.5; x += 3.4) for (const z of [-5, 5]) kit.wood.add(x, deckY + 1.9, z, 0.4, 3.8, 0.4, 0xffffff, 0, 0.12, R);
    for (const z of [-5, 5]) kit.wood.add((GRANARY.minX + GRANARY.maxX) / 2, deckY + 3.9, z, GW - 2, 0.4, 0.5, 0xd8b090, 0, 0.1, R);
    for (let x = GRANARY.minX + 1.5; x <= GRANARY.maxX - 1.5; x += 3.4) kit.wood.add(x, deckY + 3.95, 0, 0.35, 0.3, 10.6, 0xffffff, 0, 0.1, R);
    kit.plaster.add((GRANARY.minX + GRANARY.maxX) / 2, deckY + 1.0, -5.1, GW - 3, 2, 0.35, 0xe7dccb, 0, 0.05, R);
    for (const [x, z] of [[-41, -3], [-36, -3], [-31, -3]]) {
      const aw = createAwning({ uTime: this.uTime, w: 4.2, d: 3.2, colors: [PALETTE.cloth[Math.floor(R() * 6)], PALETTE.ochre, PALETTE.indigo, PALETTE.turquoise] });
      aw.position.set(x, deckY + 1.3, z + 3.2); this.add(aw);
    }

    // ============ grand stairway, side stair, parapets, towers ============
    kit.stairs({ x: 10, z: CIT.maxZ + 8.4, y0: 0, width: 8, steps: 20, rise: 0.3, run: 0.42, dir: '-z', tint: 0xffe0cc });
    kit.stairs({ x: CIT.maxX + 8, z: -15, y0: 0, width: 4, steps: 20, rise: 0.3, run: 0.4, dir: '-x', tint: 0xffe0cc });
    const PH = 1.1, ps = { y0: TOP, h: PH, t: 0.7, capColor: PALETTE.turquoise };
    kit.wall(CIT.minX + 0.4, CIT.maxZ - 0.4, 5.6, CIT.maxZ - 0.4, ps);
    kit.wall(14.4, CIT.maxZ - 0.4, CIT.maxX - 0.4, CIT.maxZ - 0.4, ps);
    kit.wall(CIT.minX + 0.4, CIT.minZ + 0.4, CIT.maxX - 0.4, CIT.minZ + 0.4, ps);
    kit.wall(CIT.minX + 0.4, CIT.minZ + 0.4, CIT.minX + 0.4, CIT.maxZ - 0.4, ps);
    kit.wall(CIT.maxX - 0.4, CIT.minZ + 0.4, CIT.maxX - 0.4, -17.5, ps);
    kit.wall(CIT.maxX - 0.4, -12.5, CIT.maxX - 0.4, CIT.maxZ - 0.4, ps);
    for (const [x, z] of [[CIT.minX + 3, CIT.maxZ - 3], [CIT.maxX - 3, CIT.maxZ - 3], [CIT.minX + 3, CIT.minZ + 3], [CIT.maxX - 3, CIT.minZ + 3], [3, CIT.maxZ - 2.2], [17, CIT.maxZ - 2.2]]) {
      kit.box('brick', x, TOP + 2.8, z, 4.4, 5.6, 4.4, { tint: 0xf0b8a0, collide: true });
      kit.box('plaster', x, TOP + 5.9, z, 4.9, 0.7, 4.9, { tint: 0xdbe8f4 });
      kit.box('accent', x, TOP + 6.35, z, 5.0, 0.18, 5.0, { tint: PALETTE.lapis, vary: 0 });
    }

    // ============ other citadel buildings (halls, houses) ============
    const B = [
      [-14, -7.5, 9, 7, 5.4, 'plaster', 0], [-14, 8.5, 8, 6, 4.4, 'brick', Math.PI], [8, -21, 16, 8, 6.2, 'brick', 0], [-12, -21, 12, 8, 5.2, 'plaster', 0],
      [30, 10, 8, 11, 5, 'brick', -Math.PI / 2], [32, -4, 7, 9, 4.6, 'plaster', -Math.PI / 2], [-6, 21, 11, 8, 4.6, 'brick', Math.PI], [-26, 21, 12, 8, 5.4, 'plaster', Math.PI],
      [-50, 18, 9, 8, 4.4, 'brick', Math.PI], [-50, -18, 10, 8, 5.4, 'brick', 0], [-36, -21, 11, 8, 4.8, 'plaster', 0], [22, 21, 10, 8, 4.4, 'brick', Math.PI],
    ];
    B.forEach(([x, z, w, d, h, mat, rot]) => kit.house({ x, z, w, d, h, y0: TOP, rot, mat, upper: R() < 0.4, collide: true, accent: [PALETTE.lapis, PALETTE.turquoise, PALETTE.madder, PALETTE.indigo][Math.floor(R() * 4)] }));

    // ============ lower town (instanced houses for context) ============
    for (let gx = -118; gx < 150; gx += 13) for (let gz = 40; gz < 140; gz += 15) {
      const cx = gx + rnd(-1.5, 1.5), cz = gz + rnd(-2, 2);
      if (cx > -4 && cx < 26 && cz < 80) continue; // clear approach to the grand stairs
      if (R() < 0.12) continue;
      kit.house({ x: cx, z: cz, w: rnd(6, 10), d: rnd(7, 10), h: rnd(3.2, 5.2), rot: [0, Math.PI, Math.PI / 2, -Math.PI / 2][Math.floor(R() * 4)], mat: R() < 0.25 ? 'plaster' : 'brick', upper: R() < 0.2, collide: true });
    }
    for (let gx = 48; gx < 150; gx += 13) for (let gz = -48; gz < 36; gz += 15) {
      if (R() < 0.15) continue;
      kit.house({ x: gx + rnd(-1.5, 1.5), z: gz + rnd(-2, 2), w: rnd(6, 10), d: rnd(7, 10), h: rnd(3.2, 5), rot: [0, Math.PI, Math.PI / 2, -Math.PI / 2][Math.floor(R() * 4)], mat: R() < 0.25 ? 'plaster' : 'brick', collide: true });
    }
    for (let gx = -118; gx < -64; gx += 13) for (let gz = -40; gz < 36; gz += 15) {
      if (R() < 0.2) continue;
      kit.house({ x: gx + rnd(-1.5, 1.5), z: gz + rnd(-2, 2), w: rnd(6, 10), d: rnd(7, 10), h: rnd(3.2, 5), rot: [0, Math.PI, Math.PI / 2, -Math.PI / 2][Math.floor(R() * 4)], mat: R() < 0.25 ? 'plaster' : 'brick', collide: true });
    }
    kit.build(this.root);

    // ============ nature: river, reeds, trees, hills ============
    const river = createWater({ width: 700, depth: 42, color: 0x0e7f93, opacity: 0.96, repeat: [70, 4], rippleRings: 0, reflect: 0.45 });
    river.group.position.set(0, 0.07, -108);
    this.lighting.onEnv((e) => river.setEnv(e));
    this.add(river.group, (dt) => river.update(dt));
    const reeds = [];
    for (const zc of [-85.5, -130.5]) for (let i = 0; i < 700; i++) reeds.push([(R() - 0.5) * 340, 0.05, zc + (R() - 0.5) * 7]);
    this.add(createReeds(reeds, { uTime: this.uTime, seed: 4 }));
    const trees = [...scatter(34, [-130, 130, -84, -50], { seed: 3 }), ...scatter(22, [-130, 130, -145, -132], { seed: 4 }),
      ...scatter(18, [-130, 130, 40, 130], { seed: 5, avoid: [[-6, 28, 40, 100]] }), [-62.5, 0, 26, 1.1], [43, 0, 22, 1.2], [-63, 0, -14, 1.2]];
    this.add(createTrees(trees, { uTime: this.uTime, seed: 9 }));
    const ridge = createRidge({ width: 1200, height: 75, color: 0x7f8cba, seed: 5 }); ridge.position.set(0, 0, -520); this.add(ridge);

    // ============ props and people ============
    const pots = [];
    for (let i = 0; i < 40; i++) {
      const sx = R() < 0.5;
      pots.push(sx ? [rnd(-44, 36), TOP, R() < 0.5 ? rnd(-29, -27) : rnd(27, 29), rnd(0.9, 1.3)] : [rnd(-5, 25), TOP, R() < 0.5 ? rnd(-10.2, -9.2) : rnd(9.4, 10.2), rnd(0.9, 1.2)]);
    }
    for (let i = 0; i < 14; i++) pots.push([rnd(-44, -28), TOP + GH + 0.25, rnd(-6, 6), rnd(0.9, 1.3)]);
    for (let i = 0; i < 20; i++) pots.push([rnd(-8, 30), 0, rnd(46, 90), rnd(0.9, 1.2)]);
    this.add(createPots(pots));
    for (const [x, z, c] of [[-30, 5, PALETTE.ochre], [-29, -4, 0xd9c28a], [-27, 2, PALETTE.ochre]]) { const h = createGrainHeap(c); h.position.set(x, TOP + GH + 0.25, z); this.add(h); }
    for (const [x, z, ci] of [[0, 28.6, 0], [20, 28.6, 5], [CIT.minX + 5, CIT.minZ + 5, 1], [CIT.maxX - 5, CIT.minZ + 5, 3], [-3, 41, 0], [23, 41, 2]]) {
      const b = createBanner({ uTime: this.uTime, colors: [PALETTE.cloth[ci], PALETTE.ochre, PALETTE.turquoise, PALETTE.indigo], poleH: 4.6 });
      b.position.set(x, x === -3 || x === 23 ? 0 : TOP, z); this.add(b);
    }
    const cart = await loadModel('bullock_cart', () => createBullockCart({ cloth: PALETTE.cloth[1] }));
    cart.position.set(24, 0, 62); cart.rotation.y = 2.3; this.root.add(cart);
    // torches / oil lamps (fire up at dusk)
    [[-1, 6.6], [21, 6.6], [-1, -6.6], [21, -6.6], [10, 9.6], [-27, 8.2]].forEach(([x, z], i) => this.add(createLamp({ lamps: this.lamps, x, y: i === 5 ? TOP + 0 : TOP, z, light: true })));
    // people
    this.walkers = [];
    const gy = (x, z) => g.height(x, z);
    const routes = [
      [[-4, 9], [24, 9]], [[24, -9], [-4, -9]], [[-4.2, -8], [-4.2, 8]], [[1, 9.5], [20, 9.4]], [[-24, 12], [-24, -12], [-8, -12], [-8, 12]],
      [[10, 52], [10, 29]], [[8, 36], [12, 46]], [[10, 26], [10, 15], [8, 12.5]], [[-26, 15], [-16, 15], [-16, 25]], [[-60, 2], [-52, 2]],
      [[2, 4.9], [2, -4.9]], [[18, -5], [18, 5.5]],
    ];
    routes.forEach((r, i) => {
      const p = randomPerson(R, { carry: i % 4 === 0 }); this.add(p);
      this.walkers.push(new Walker(p, r, { speed: 0.55 + R() * 0.45, groundFn: gy }));
    });
    [[2.4, 2.2, 1.6], [17.2, -2.4, -1.6], [17.5, 2, -1.4], [-28, 4, -1.57], [-28, -3, -1.57], [10.5, 8.1, 0], [3.3, -0.6, 1.57], [-18, 3, 0], [11, 30.6, 3.14]].forEach(([x, z, ry]) => {
      const p = randomPerson(R); p.position.set(x, g.height(x, z), z); p.rotation.y = ry; this.add(p);
    });
    for (let i = 0; i < 7; i++) {
      const p = randomPerson(R, { carry: i % 2 === 0 }); this.add(p);
      this.walkers.push(new Walker(p, [[rnd(-100, 100), rnd(44, 110)], [rnd(-100, 100), rnd(44, 110)]].map(([x, z]) => [Math.min(Math.max(x, 28), 100) * (i % 2 ? 1 : -1) , z]), { speed: 0.6 + R() * 0.4, y: 0 }));
    }

    // ============ life ============
    const birds = createBirds(12, { center: [10, 52, 0], radius: 95, spread: 16, seed: 6 });
    this.add(birds.group, (dt, t) => birds.update(dt, t));
    const dust = createDust({ count: 300, box: 40, height: 16 });
    this.add(dust.points, (dt) => dust.update(dt, this.app.camera.position, 0.8));
    this.updaters.push((dt) => this.walkers.forEach((w) => w.update(dt)));

    // ============ hotspots ============
    const H = (id, pos, color, radius = 3.4) => this.hotspots.add({
      id, position: new THREE.Vector3(...pos), color, radius, size: 0.95,
      onActivate: () => { this.app.ui.panel.show(this.app.captions.get('greatBath', 'hotspot_' + id), '#' + color.toString(16).padStart(6, '0')); this.app.audio.blip(880); },
    });
    H('steps', [4.9, 7.2, -0.3], PALETTE.ochre);
    H('pool', [10, 6.7, 1.2], PALETTE.turquoise, 3.8);
    H('bitumen', [10, 4.5, -3.1], 0xc9d4e8, 3.6);
    H('corridors', [10, 8.0, 9.1], PALETTE.carnelian, 3.2);
    H('granary', [-27.5, 9.9, 3.6], PALETTE.lapis, 4.4);
    this.hotspots.items.forEach((h) => { if (h.id === 'bitumen') h.core.material.color.set(0xff9bd0); });
    this.app.ui.panel.onClose = () => {};
  }

  onEnter() {
    this.app.captions.show('greatBath', 'enter', { duration: 10000 });
  }
}
