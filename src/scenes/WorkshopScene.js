import * as THREE from 'three';
import gsap from 'gsap';
import { BaseScene } from '../core/BaseScene.js';
import { BuildKit } from '../shared/builders.js';
import { PALETTE } from '../shared/palette.js';
import { rng } from '../shared/textures.js';
import { createGround, createRidge, scatter } from '../shared/nature.js';
import { createTrees, createPots, createLamp, createBirds, createDust, createBanner, makeGlowSprite } from '../shared/props.js';
import { randomPerson } from '../shared/people.js';
import { el } from '../ui/dom.js';
import { DialogueBox } from '../ui/DialogueBox.js';
import { Artisan } from '../workshop/Artisan.js';
import { createDancingGirl } from '../workshop/DancingGirl.js';
import { runPottery } from '../workshop/potteryActivity.js';
import { runSeal } from '../workshop/sealActivity.js';
import { runBronze } from '../workshop/bronzeActivity.js';
import { SCRIPT, ARTISAN } from '../data/workshopScript.js';

// ---- layout (metres). The building's front wall is at z = 0 and the workshop opens to +z. ----
const B = { x0: -10, x1: 10, z0: 0, z1: -17, h: 4.2, t: 0.6 };
const DOOR = 1.4;                                   // half-width of the entrance
const STATIONS = {
  pottery: { name: 'Pottery', stand: [-3.3, -6.0], yaw: Math.PI / 2, artisan: [-5.4, -4.5], spot: [-7.0, 2.1, -6.8], color: PALETTE.terracotta },
  seal: { name: 'Seal making', stand: [0.8, -11.0], yaw: 0, artisan: [-2.6, -12.6], spot: [0, 2.1, -15.4], color: PALETTE.lapis },
  bronze: { name: 'Bronze casting', stand: [3.6, -9.6], yaw: -Math.PI / 2, artisan: [5.4, -11.2], spot: [8.2, 2.6, -8.2], color: PALETTE.bronze },
};
const RUNNERS = { pottery: runPottery, seal: runSeal, bronze: runBronze };
const HUB = [-1.6, -5.0];

/**
 * Scene 6 — The Harappan Artisan Workshop. A separate, story-driven destination: an artisan
 * greets the visitor outside a baked-brick workshop, invites them in, and guides them through
 * pottery, seal making and lost-wax bronze casting.
 */
export class WorkshopScene extends BaseScene {
  static id = 'workshop';
  static accent = PALETTE.terracotta;
  static settings = {
    ui: 'scene', timeSlider: false,
    camera: { pos: [0, 1.7, 24], yaw: 0, pitch: 0.04, mode: 'walk', eye: 1.7, speed: 3.2 },
    lighting: {
      time: 10.2, sky: { turbidity: 3.4, rayleigh: 1.5, mie: 0.005, mieG: 0.8 }, fogDensity: 0.0045, fogTint: 0xf0dcc0,
      shadowSize: 55, azimuthOffset: 0.35, exposure: 0.58, sunBoost: 1.0, hemiBoost: 1.7,
    },
    audio: { wind: 0.1, birds: 0.25, workshop: 1 },
    look: { bloom: { strength: 0.28, threshold: 0.9, radius: 0.6 }, saturation: 1.15, contrast: 1.06, vignette: 0.3 },
    bounds: { minX: -45, maxX: 45, minZ: -40, maxZ: 60 },
  };

  async init() {
    const R = rng(77), rnd = (a, b) => a + R() * (b - a), pickA = (a) => a[Math.floor(R() * a.length)];
    const g = this.ground, kit = new BuildKit(g, 61); kit.R = R;
    const potsAll = [], t = B.t;
    this.audioSpots = { carve: new THREE.Vector3(0, 1.2, -15.4), wheel: new THREE.Vector3(-7, 0.8, -6.8), furnace: new THREE.Vector3(7.2, 1.2, -8.2), bench: new THREE.Vector3(8.6, 1.1, -12.8), helpers: [] };
    this.app.audio.workshopSource = this;
    this.phase = 'start'; this.visited = new Set(); this.dead = false;
    this.workers = [];

    // ============ ground, forecourt, paving ============
    this.add(createGround(900, 'earth'));
    kit.stone.addMM(-13, 0, 0, 13, 0.05, 17, 0xe0c9a2, 0, 0.05);
    kit.stone.addMM(-3.2, 0, 17, 3.2, 0.05, 60, 0xd8bf9a, 0, 0.05);
    kit.stone.addMM(B.x0 + t, 0, B.z1, B.x1 - t, 0.05, -t, 0xe4cfae, 0, 0.04); // interior floor
    for (const x of [-1.9, 1.9]) kit.accent.addMM(x - 0.12, 0.05, 17, x + 0.12, 0.07, 60, 0x4a3426, 0, 0.1);

    // ============ the building ============
    const wall = (x, z, sx, sz, y0 = 0, h = B.h, collide = true) => kit.box('brick', x, y0 + h / 2, z, sx, h, sz, { tint: pickA([0xffffff, 0xf4d8c8, 0xe6b8a0]), collide });
    kit.box('brick', -(10 + DOOR) / 2, B.h / 2, -t / 2, 10 - DOOR, B.h, t, { collide: true, tint: 0xe6b8a0 });
    kit.box('brick', (10 + DOOR) / 2, B.h / 2, -t / 2, 10 - DOOR, B.h, t, { collide: true, tint: 0xf0c8b0 });
    kit.box('brick', 0, 2.8 + (B.h - 2.8) / 2, -t / 2, DOOR * 2, B.h - 2.8, t, { tint: 0xe6b8a0 });                       // wall above the entrance
    for (const s of [-1, 1]) wall(s * (B.x1 - t / 2), (B.z1) / 2, t, -B.z1);                                                   // side walls
    wall(0, B.z1 - t / 2, B.x1 - B.x0, t);                                                                                      // back wall
    // door frame: painted lintel + timber posts
    for (const s of [-1, 1]) kit.box('accent', s * (DOOR + 0.1), 1.45, 0.05, 0.22, 2.9, 0.4, { tint: 0x8a5a3a, vary: 0.08 });
    kit.box('accent', 0, 3.0, 0.05, DOOR * 2 + 0.6, 0.3, 0.5, { tint: 0x7d5435, vary: 0.06 });
    kit.box('accent', 0, 3.7, 0.04, 8, 0.5, 0.12, { tint: PALETTE.terracotta, vary: 0.04 });
    for (let i = 0; i < 9; i++) kit.box('accent', -4 + i, 3.7, 0.12, 0.34, 0.34, 0.06, { tint: [PALETTE.ochre, PALETTE.turquoise, PALETTE.lapis][i % 3], vary: 0.05 });
    // flat roof with a skylight; parapet round the edge
    const roofY = B.h;
    const roofBox = (x0, z0, x1, z1) => kit.plaster.addMM(x0, roofY, z0, x1, roofY + 0.3, z1, 0xeedfc0, 0, 0.05);
    const SKY = { x0: -1.8, x1: 1.8, z0: -9.5, z1: -5.9 };
    roofBox(B.x0 - 0.3, B.z1 - 0.3, B.x1 + 0.3, SKY.z0);                 // back strip
    roofBox(B.x0 - 0.3, SKY.z1, B.x1 + 0.3, 0.3);                        // front strip
    roofBox(B.x0 - 0.3, SKY.z0, SKY.x0, SKY.z1); roofBox(SKY.x1, SKY.z0, B.x1 + 0.3, SKY.z1); // either side of the skylight
    const para = (x0, z0, x1, z1) => kit.brick.addMM(x0, roofY + 0.3, z0, x1, roofY + 0.8, z1, 0xd9a07c, 0, 0.08);
    para(B.x0 - 0.3, 0, B.x1 + 0.3, 0.3); para(B.x0 - 0.3, B.z1 - 0.3, B.x1 + 0.3, B.z1); para(B.x0 - 0.3, B.z1, B.x0, 0.3); para(B.x1, B.z1, B.x1 + 0.3, 0.3);
    kit.brick.addMM(7.3, roofY + 0.3, -9.4, 9.1, roofY + 1.9, -7.0, 0xc0704a, 0, 0.08);   // furnace chimney stack
    // pale plaster liner on the inside so the interior is bright
    const LN = 0.06, IX0 = B.x0 + t, IX1 = B.x1 - t, IZ1 = B.z1 + 0.0, IZ0 = -t;   // inner faces of the walls
    kit.plaster.addMM(IX0 + 0.004, 0.02, IZ1, IX0 + LN, roofY, IZ0, 0xf2e3c8, 0, 0.03);
    kit.plaster.addMM(IX1 - LN, 0.02, IZ1, IX1 - 0.004, roofY, IZ0, 0xf2e3c8, 0, 0.03);
    kit.plaster.addMM(IX0 + LN, 0.02, IZ1 + 0.004, IX1 - LN, roofY, IZ1 + LN, 0xf2e3c8, 0, 0.03);
    kit.plaster.addMM(IX0 + LN, 0.02, IZ0 - LN, -DOOR, roofY, IZ0 - 0.004, 0xf2e3c8, 0, 0.03);
    kit.plaster.addMM(DOOR, 0.02, IZ0 - LN, IX1 - LN, roofY, IZ0 - 0.004, 0xf2e3c8, 0, 0.03);
        for (let z = -2; z > -16; z -= 3.4) kit.accent.addMM(IX0, 3.85, z - 0.15, IX1, 4.2, z + 0.15, 0xa87848, 0, 0.1);

    // ============ outside: courtyard walls, neighbours, materials ============
    kit.wall(-14, 0, -14, 15, { h: 1.4, t: 0.5, capColor: PALETTE.ochre }); kit.wall(14, 0, 14, 15, { h: 1.4, t: 0.5, capColor: PALETTE.ochre });
    kit.wall(-14, 15, -7, 15, { h: 1.4, t: 0.5, capColor: PALETTE.ochre }); kit.wall(7, 15, 14, 15, { h: 1.4, t: 0.5, capColor: PALETTE.ochre });
    const rot = [0, Math.PI, Math.PI / 2, -Math.PI / 2];
    for (const s of [-1, 1]) {
      for (const z of [2, 14, 26, 38]) kit.house({ x: s * 24, z: z + rnd(-1, 1), w: rnd(8, 11), d: rnd(7, 9), h: rnd(3.6, 5), rot: s > 0 ? -Math.PI / 2 : Math.PI / 2, mat: R() < 0.3 ? 'plaster' : 'brick', upper: R() < 0.3 });
      for (const z of [-4, -18]) kit.house({ x: s * 20, z, w: 9, d: 8, h: rnd(4, 5), rot: s > 0 ? -Math.PI / 2 : Math.PI / 2, mat: 'brick' });
    }
    for (let x = -50; x < 55; x += 14) kit.house({ x: x + rnd(-2, 2), z: -32 + rnd(-2, 2), w: rnd(8, 11), d: rnd(7, 9), h: rnd(3.6, 5), rot: 0, mat: R() < 0.3 ? 'plaster' : 'brick', collide: false });
    // pots, baskets, mats and materials by the entrance
    [[-3.6, 2.2], [-4.4, 3.4], [-5.2, 2.0], [3.6, 2.6], [4.5, 1.6], [5.4, 3.0], [-9, 3], [9.5, 4], [-10.5, 6], [10.2, 7]].forEach(([x, z]) => potsAll.push([x, 0, z, rnd(0.9, 1.5)]));
    for (const [x, z, c] of [[-6.5, 1.6, 0xc4985a], [-7.4, 3.2, 0xb88a4a], [6.6, 1.8, 0xd0a868], [7.6, 3.4, 0xc4985a], [-11, 9, 0xb88a4a], [11, 10, 0xd0a868]]) kit.box('accent', x, 0.28, z, 0.8, 0.55, 0.8, { tint: c, vary: 0.1 });
    kit.box('accent', -4.8, 0.03, 4.2, 2.2, 0.05, 1.4, { tint: 0xc9a468, vary: 0.05 }); kit.box('accent', 5.0, 0.03, 4.6, 2.4, 0.05, 1.5, { tint: 0xb89868, vary: 0.05 });
    for (let i = 0; i < 12; i++) kit.brick.add(-11.5 + (i % 4) * 0.55, 0.12 + Math.floor(i / 4) * 0.22, 11.5 - Math.floor(i / 4) * 0.02, 0.5, 0.2, 0.28, 0xffffff, 0, 0.1, R); // stack of bricks
    kit.stone.add(11, 0.3, 11, 1.4, 0.6, 0.9, 0xb89870, 0, 0.1, R);                                                                                      // clay pile
    kit.accent.add(-11, 0.4, 5, 0.5, 0.8, 2.4, 0xc09068, 0, 0.1, R); kit.accent.add(-11, 1.0, 5, 0.9, 0.08, 2.6, 0xd8b088, 0, 0.1, R);                       // drying rack
    for (let i = 0; i < 4; i++) potsAll.push([-11 + (i % 2) * 0.1, 1.04, 4.1 + i * 0.6, 0.7]);
    // a small outdoor kiln with a glow
    kit.box('brick', 12.2, 0.9, 5, 2, 1.8, 2, { tint: 0xd89878, collide: true }); kit.box('brick', 12.2, 2.0, 5, 1.4, 0.5, 1.4, { tint: 0xc98868 }); kit.box('accent', 11.15, 0.6, 5, 0.1, 0.8, 0.8, { tint: 0x120a07, vary: 0 });
    const kg = makeGlowSprite(0xff7a2a, 1.8, 0.8); kg.position.set(11.0, 0.65, 5); this.add(kg);
    this.updaters.push((dt, tt) => { kg.material.opacity = 0.7 + Math.sin(tt * 9) * 0.1; });
    for (const [x, z, ci] of [[-6.4, 14.4, 0], [6.4, 14.4, 1]]) { const b = createBanner({ uTime: this.uTime, colors: [PALETTE.cloth[ci], PALETTE.ochre, PALETTE.turquoise, PALETTE.indigo], poleH: 4.4 }); b.position.set(x, 0, z); this.add(b); }
    [[-2.6, 3.0], [2.6, 3.0], [-3, 22], [3, 22]].forEach(([x, z]) => this.add(createLamp({ lamps: this.lamps, x, y: 0, z, light: false })));
    this.add(createTrees([...scatter(14, [-90, 90, -70, -45], { seed: 3 }), ...scatter(10, [-60, 60, 45, 80], { seed: 4, avoid: [[-6, 6, 40, 90]] }), [-16, 0, 20, 1.1], [16, 0, 22, 1.2], [-14, 0, 8, 1], [15, 0, 14, 1]], { uTime: this.uTime, seed: 5 }));
    const ridge = createRidge({ width: 1300, height: 65, color: 0x9a8fb0, seed: 8 }); ridge.position.set(0, 0, -520); this.add(ridge);

    // ============ interior: pottery corner (west) ============
    const WH = { x: -7.0, z: -6.8 };
    kit.box('stone', WH.x, 0.28, WH.z, 0.7, 0.56, 0.7, { tint: 0xb89870, collide: true });                         // wheel stand
    const wheelDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.1, 24), new THREE.MeshStandardMaterial({ color: 0x9c6a44, roughness: 0.85 })); wheelDisc.position.set(WH.x, 0.62, WH.z); wheelDisc.castShadow = true; this.add(wheelDisc);
    const wheelPot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.3, 14), new THREE.MeshStandardMaterial({ color: 0x9a7a62, roughness: 0.6 })); wheelPot.position.y = 0.2; wheelDisc.add(wheelPot);
    this.updaters.push((dt) => { wheelDisc.rotation.y += dt * 2.6; });
    kit.box('accent', -8.9, 0.42, -3.6, 1.2, 0.84, 3.2, { tint: 0xcaa07a, collide: true }); kit.box('accent', -8.9, 0.88, -3.6, 1.3, 0.08, 3.3, { tint: 0xdbb68e });
    for (let i = 0; i < 9; i++) potsAll.push([-9.2 + (i % 3) * 0.35, 0.92, -4.6 + Math.floor(i / 3) * 0.9, rnd(0.45, 0.7)]);
    kit.stone.add(-7.6, 0.2, -9.1, 1.1, 0.4, 0.8, 0xb09070, 0, 0.1, R);                                           // lump of clay
    for (const y of [1.2, 2.2]) kit.accent.addMM(-9.4, y, -2.2, -8.9, y + 0.08, -12, 0xb98a5e, 0, 0.06);            // shelves
    for (let i = 0; i < 12; i++) potsAll.push([-9.15, 1.28 + (i % 2) * 1.0, -2.6 - Math.floor(i / 2) * 1.5, rnd(0.55, 0.75)]);
    // kiln for the potters
    kit.box('brick', -8.2, 0.95, -14.3, 2.2, 1.9, 2.2, { tint: 0xd89878, collide: true }); kit.box('brick', -8.2, 2.15, -14.3, 1.6, 0.6, 1.6, { tint: 0xc98868 }); kit.box('accent', -7.05, 0.65, -14.3, 0.08, 0.8, 0.8, { tint: 0x120a07, vary: 0 });
    const ig = makeGlowSprite(0xff7a2a, 1.6, 0.8); ig.position.set(-6.9, 0.65, -14.3); this.add(ig);
    this.updaters.push((dt, tt) => { ig.material.opacity = 0.65 + Math.sin(tt * 7.7) * 0.12; });
    // ============ interior: seal bench (north) ============
    kit.box('accent', 0, 0.45, -15.4, 6.4, 0.9, 1.5, { tint: 0xcaa07a, collide: true }); kit.box('accent', 0, 0.94, -15.4, 6.6, 0.08, 1.7, { tint: 0xdbb68e });
    for (let i = 0; i < 6; i++) kit.stone.add(-2.6 + i * 0.95, 1.02, -15.2 + (i % 2) * 0.3, 0.38, 0.1, 0.38, 0xe6dcc8, 0, 0.05, R);       // seals / stone blanks
    for (let i = 0; i < 4; i++) kit.stone.add(-2.9 + i * 1.7, 1.08, -15.8, 0.7, 0.2, 0.5, 0xb8a88a, 0, 0.1, R);                            // stone slabs
    for (let i = 0; i < 5; i++) kit.accent.add(1.0 + i * 0.35, 1.0, -14.9, 0.04, 0.03, 0.34, i % 2 ? PALETTE.copper : PALETTE.bronze, 0.3 * i, 0.1);   // carving tools
    for (let i = 0; i < 3; i++) potsAll.push([2.2 + i * 0.35, 0.98, -15.9, 0.35]);
    for (const y of [1.7, 2.6]) kit.accent.addMM(-3.6, y, -17.0, 3.6, y + 0.07, -16.4, 0xb98a5e, 0, 0.06);
    for (let i = 0; i < 9; i++) kit.stone.add(-3.2 + i * 0.8, 1.84 + (i % 2) * 0.9, -16.7, 0.4, 0.08 + 0.2, 0.2, 0xe6dcc8, 0, 0.06, R);        // finished seals on the shelves
    for (let x of [-1.6, 1.6]) kit.accent.add(x, 0.25, -13.9, 0.5, 0.5, 0.5, 0xb08050, 0, 0.1, R);                                         // stools
    // ============ interior: bronze corner (east) ============
    const FX = 8.3, FZ = -8.2;
    kit.box('brick', FX, 1.0, FZ, 2.4, 2.0, 2.6, { tint: 0xc8644a, collide: true }); kit.box('brick', FX, 2.4, FZ, 1.8, 0.8, 2.0, { tint: 0xb85a42 });
    kit.box('accent', FX - 1.22, 0.75, FZ, 0.1, 0.9, 1.0, { tint: 0x100806, vary: 0 });
    const fg = makeGlowSprite(0xff6a1a, 2.6, 0.95); fg.position.set(FX - 1.35, 0.8, FZ); this.add(fg);
    const fireL = new THREE.PointLight(0xff7a2a, 20, 12, 1.5); fireL.position.set(FX - 2.2, 1.0, FZ); this.add(fireL);
    this.updaters.push((dt, tt) => { const f = 0.8 + Math.sin(tt * 11) * 0.1 + Math.sin(tt * 27) * 0.06; fireL.intensity = 20 * f; fg.material.opacity = 0.7 + (f - 0.8) * 1.5; });
    kit.box('accent', 8.7, 0.45, -12.8, 1.3, 0.9, 3.2, { tint: 0xcaa07a, collide: true }); kit.box('accent', 8.7, 0.94, -12.8, 1.4, 0.08, 3.3, { tint: 0xdbb68e });
    for (let i = 0; i < 4; i++) kit.accent.add(8.5, 1.02, -14 + i * 0.6, 0.45, 0.1, 0.3, 0xeed596, 0, 0.05);                 // wax blocks
    for (let i = 0; i < 3; i++) kit.box('accent', 8.9, 1.12, -11.6 + i * 0.5, 0.35, 0.3, 0.3, { tint: 0xb0764f, vary: 0.1 });  // clay moulds
    for (let i = 0; i < 4; i++) kit.accent.add(8.9, 1.0, -13.4 - i * 0.0, 0.3, 0.07, 0.18, PALETTE.copper, 0.2 * i, 0.1);     // ingots
    kit.stone.add(6.2, 0.3, -12, 0.7, 0.6, 0.7, 0xb0a088, 0, 0.1, R);                                                          // anvil stone
    // statuette of the Dancing Girl on a shelf by the east wall
    kit.accent.addMM(8.9, 1.5, -5.6, 9.4, 1.58, -3.2, 0xb98a5e, 0, 0.06);
    const bronzeMat = new THREE.MeshStandardMaterial({ color: 0xb4732f, metalness: 0.92, roughness: 0.34, envMapIntensity: 1.5 });
    const statuette = createDancingGirl(bronzeMat); statuette.scale.setScalar(0.42); statuette.position.set(9.1, 1.58, -4.4); statuette.rotation.y = -Math.PI / 2; this.add(statuette);
    this.lighting.onEnv((e) => { bronzeMat.envMap = e; bronzeMat.needsUpdate = true; });
    for (const x of [-4, 3]) kit.accent.add(9.5, 0.9, x - 2, 0.6, 0.5, 0.6, 0xc4985a, 0, 0.1);
    // ============ shared interior details ============
    for (const [x, z, c] of [[-6, -1.6, 0xc4985a], [6.4, -1.6, 0xb88a4a], [3.6, -2.0, 0xd0a868], [-3.2, -16, 0xc4985a], [4.8, -16, 0xb88a4a], [9, -15.5, 0xd0a868]]) kit.box('accent', x, 0.3, z, 0.7, 0.6, 0.7, { tint: c, vary: 0.1 });
    for (const [x, z] of [[-4.5, -2], [4.2, -3.2]]) potsAll.push([x, 0, z, 1.4], [x + 0.6, 0, z + 0.2, 1.1]);
    kit.accent.addMM(-2.4, 0.05, -7.2, 2.4, 0.07, -3.6, 0xb89868, 0, 0.04); // woven mat in the middle
    // warm interior light + the skylight shaft
    for (const [x, y, z, i] of [[0, 2.6, -4.5, 7], [0, 2.6, -12, 6], [-5.5, 2.5, -9, 4], [5, 2.5, -4, 3]]) { const L = new THREE.PointLight(0xffd9a0, i, 14, 1.5); L.position.set(x, y, z); this.add(L); }
    [[-3.4, -3.2], [3.4, -12.4], [-5.2, -12.4]].forEach(([x, z]) => this.add(createLamp({ lamps: this.lamps, x, y: 0, z, light: false })));
    this.add(createPots(potsAll));
    kit.build(this.root);

    // ground blockers for interior furniture
    g.addBlocker(-9.6, -8.2, -5.4, -1.8); g.addBlocker(-7.5, -6.5, -7.3, -6.3); g.addBlocker(-3.4, 3.4, -16.3, -14.5); g.addBlocker(7.0, 9.6, -9.6, -6.8); g.addBlocker(8.0, 9.4, -14.6, -11.0); g.addBlocker(-9.3, -7.1, -15.4, -13.2);

    // ============ people: the artisan + ambient workers ============
    const art = (this.artisan = new Artisan(new THREE.Vector3(3.6, 0, 5.6), { heading: 0.2 }));
    this.add(art.root, (dt, tt) => art.update(dt, tt));
    art.root.userData.dispose = () => {};
    const worker = (x, z, ry, mode) => {
      const p = randomPerson(R); p.position.set(x, 0, z); p.rotation.y = ry; this.add(p);
      const a = { p, mode, ph: rnd(0, 6) }; this.workers.push(a); return p;
    };
    const w1 = worker(-8.1, -6.8, Math.PI / 2, 'wheel'), w2 = worker(-2.0, -16.6, 0, 'carve'), w3 = worker(6.0, -9.8, Math.PI / 2, 'metal');
    this.audioSpots.helpers.push(w1.position, w2.position);
    this.updaters.push((dt, tt) => {
      for (const w of this.workers) {
        const u = w.p.userData, s = Math.sin(tt * (w.mode === 'carve' ? 6 : 3.2) + w.ph);
        u.armR.rotation.x = -1.0 + s * (w.mode === 'carve' ? 0.4 : 0.22); u.armL.rotation.x = -0.9 + Math.sin(tt * 3.2 + w.ph + 1.4) * 0.15;
        w.p.rotation.y += Math.sin(tt * 0.5 + w.ph) * 0.0015;
      }
    });
    const birds = createBirds(8, { center: [0, 38, 20], radius: 60, spread: 12, seed: 9 }); this.add(birds.group, (dt, tt) => birds.update(dt, tt));
    const dust = createDust({ count: 220, box: 34, height: 10 }); this.add(dust.points, (dt) => dust.update(dt, this.app.camera.position, 0.7));

    // ============ hotspots (switched on once the guided welcome is over) ============
    for (const [id, s] of Object.entries(STATIONS)) {
      this.hotspots.add({ id, position: new THREE.Vector3(...s.spot), color: s.color, radius: 2.8, size: 1.0, onActivate: () => { if (this.phase === 'free') this.visitStation(id); } });
    }
    this.hotspots.setEnabled(false);

    // ============ UI ============
    const ui = document.getElementById('ui');
    this.dlg = new DialogueBox(ui);
    this.objective = el('div', { id: 'objective' }); ui.append(this.objective);
    this.sfx = this._makeSfx();
    this.debug = { skipToFree: () => this._skipToFree(), visit: (k) => this.visitStation(k), open: (k) => this.openActivity(k) };
    this.setObjective('Walk towards the artisan standing by the entrance');
  }

  // ---------------------------------------------------------------- small helpers
  setObjective(t) { this.objective.textContent = t || ''; this.objective.classList.toggle('show', !!t); }
  say(text, label) { return this.dlg.say(ARTISAN, text, label); }
  async sayAll(lines, lastLabel) { for (let i = 0; i < lines.length; i++) await this.say(lines[i], i === lines.length - 1 && lastLabel ? lastLabel : undefined); }
  lock(on) { this.app.controls.enabled = !on; }
  /** Smoothly walk the player's camera to a spot and turn to a heading (no teleporting). */
  glide(x, z, yaw, pitch = 0.02, dur = 2.2) {
    const c = this.app.controls; let dy = yaw - c.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    gsap.to(c.pos, { x, z, duration: dur, ease: 'power2.inOut', onUpdate: () => { c.footY = 0; c.apply(); } });
    return new Promise((res) => gsap.to(c, { duration: dur, ease: 'power2.inOut', yaw: c.yaw + dy, pitch, onUpdate: () => c.apply(), onComplete: res }));
  }
  turnTo(point, dur = 1.1) {
    const c = this.app.controls, dx = point[0] - c.pos.x, dz = point[1] - c.pos.z, yaw = Math.atan2(-dx, -dz);
    let dy = yaw - c.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    return new Promise((res) => gsap.to(c, { yaw: c.yaw + dy, pitch: 0.02, duration: dur, ease: 'power2.inOut', onUpdate: () => c.apply(), onComplete: res }));
  }
  _makeSfx() {
    const a = this.app.audio, w = () => a.workshop, cam = () => this.app.camera.position;
    return {
      wheel: (v) => w()?.setBoost('wheel', v), kiln: (v) => w()?.setBoost('kiln', v), furnace: (v) => w()?.setBoost('furnace', v),
      thud: () => w()?.thud(cam()), hiss: () => w()?.burst(cam(), { vol: 0.5, freq: 5000, type: 'highpass', att: 0.08, dec: 1.4 }),
      chime: () => { a.blip(784, 0.18, 0.06); setTimeout(() => a.blip(1046, 0.25, 0.06), 140); },
    };
  }

  // ---------------------------------------------------------------- the story
  update(dt) {
    super.update(dt);
    if (this.dead) return;
    const cam = this.app.camera.position;
    if (this.phase === 'start' && cam.distanceTo(this.artisan.pos) < 9.5) { this.phase = 'greeting'; this.greetOutside(); }
    else if (this.phase === 'toDoor' && cam.z < -1.2 && Math.abs(cam.x) < 3) { this.phase = 'intro'; this.introInside(); }
  }

  async greetOutside() {
    const art = this.artisan, cam = this.app.camera.position;
    this.setObjective(''); this.lock(true);
    art.faceToward(cam); await wait(500);
    art.setMode('wave'); await wait(1600);                       // the greeting animation
    art.setMode('talk');
    await this.sayAll(SCRIPT.greet.slice(0, 2));
    art.point(new THREE.Vector3(0, 0, -3)); await wait(300);    // gestures towards the entrance
    await this.say(SCRIPT.greet[2], SCRIPT.greetButton);
    this.dlg.hide(); art.setMode('idle');
    // the artisan walks in ahead of the visitor
    this.lock(false); this.phase = 'toDoor';
    this.setObjective('Walk through the entrance into the workshop');
    await art.walkTo([[1.2, 3.0], [0.2, 0.8], [HUB[0] + 0.6, -2.8], HUB]);
    art.faceToward(this.app.camera.position); art.setMode('idle');
  }

  async introInside() {
    const art = this.artisan; this.lock(true); this.setObjective('');
    if (art.walk) await new Promise((r) => { const iv = setInterval(() => { if (!art.walk) { clearInterval(iv); r(); } }, 100); });
    art.faceToward(this.app.camera.position); art.setMode('talk');
    await this.sayAll(SCRIPT.intro);
    for (const k of ['pottery', 'seal', 'bronze']) {                // brief tour, gesturing at each workstation
      const s = STATIONS[k]; art.point(new THREE.Vector3(s.spot[0], 0, s.spot[2]));
      const look = this.turnTo([s.spot[0], s.spot[2]], 1.0);
      await this.say(SCRIPT.tour[k]); await look;
      art.setMode('talk'); art.faceToward(this.app.camera.position);
    }
    art.faceToward(this.app.camera.position); art.setMode('talk');
    this.hotspots.setEnabled(false);
    await this.chooseCraft(SCRIPT.ask, ['pottery', 'seal', 'bronze'], true);
  }

  /** Ask which craft; then guide the visitor there. */
  async chooseCraft(question, options, first = false) {
    const labels = first ? SCRIPT.choices : SCRIPT.moreChoices;
    const choices = options.map((v) => ({ value: v, label: (this.visited.has(v) ? '✓ ' : '') + labels[v] }));
    if (!first) choices.push({ value: 'finish', label: SCRIPT.moreChoices.finish }, { value: 'stay', label: SCRIPT.moreChoices.stay });
    const pick = await this.dlg.ask(ARTISAN, question, choices);
    this.dlg.hide();
    if (pick === 'finish') return this.farewell();
    if (pick === 'stay') return this.freeRoam();
    return this.visitStation(pick);
  }

  async visitStation(kind) {
    if (this.dead || this.busy) return; this.busy = true;
    const s = STATIONS[kind], art = this.artisan; this.lock(true); this.hotspots.setEnabled(false); this.setObjective('');
    // the artisan leads the way; the visitor's view glides to the workbench at the same time
    art.setMode('idle');
    const walk = art.walkTo([HUB, s.artisan]);
    await Promise.all([walk, this.glide(s.stand[0], s.stand[1], s.yaw, 0.0, 3.0)]);
    art.faceToward(this.app.camera.position); art.setMode('talk');
    await this.sayAll(SCRIPT.station[kind], SCRIPT.begin);
    this.dlg.hide(); art.setMode('craft');
    const completed = await this.openActivity(kind);
    this.visited.add(kind);
    art.faceToward(this.app.camera.position); art.setMode('talk');
    this.busy = false;
    this.lock(true);
    await this.say(completed ? SCRIPT.done[kind] : SCRIPT.early);
    const rest = ['pottery', 'seal', 'bronze'];
    await this.chooseCraft(SCRIPT.more, rest);
  }

  openActivity(kind) {
    this.app.controls.enabled = false; this.dlg.hide(); this.app.paused = true;
    return new Promise((resolve) => {
      const done = (c) => { this.activity = null; this.app.paused = false; resolve(c); };
      const run = RUNNERS[kind](document.getElementById('ui'), { sfx: this.sfx, app: this.app });
      this.activity = { close: () => document.querySelector('.ws-overlay .ws-back')?.click() };
      run.then(done);
    });
  }

  freeRoam() {
    this.phase = 'free'; this.busy = false; this.lock(false); this.artisan.setMode('idle'); this.artisan.faceToward(this.app.camera.position);
    this.hotspots.setEnabled(true); this.setObjective('Walk up to a workbench, or click its marker, to return to that craft');
  }
  async farewell() {
    this.artisan.setMode('talk'); await this.sayAll(SCRIPT.farewell);
    const v = await this.dlg.ask(ARTISAN, 'Shall we say goodbye?', [{ value: 'menu', label: SCRIPT.farewellChoices.menu }, { value: 'stay', label: SCRIPT.farewellChoices.stay }]);
    this.dlg.hide();
    if (v === 'menu') { this.lock(false); this.phase = 'free'; this.busy = false; this.app.ui.openMenu(); } else this.freeRoam();
  }
  _skipToFree() { this.dlg.hide(); this.setObjective(''); this.artisan.pos.set(...[HUB[0], 0, HUB[1]]); this.app.controls.pos.set(0, 1.7, -3); this.visited.clear(); this.freeRoam(); }

  onEnter() {}
  dispose() {
    this.dead = true; this.activity?.close(); this.app.paused = false;
    gsap.killTweensOf(this.app.controls); gsap.killTweensOf(this.app.controls.pos);
    this.dlg?.dispose(); this.objective?.remove();
    if (this.app.audio.workshopSource === this) this.app.audio.workshopSource = null;
    this.app.controls.enabled = true;
    super.dispose();
  }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
