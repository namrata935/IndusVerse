import * as THREE from 'three';
import { BaseScene } from '../core/BaseScene.js';
import { BuildKit } from '../shared/builders.js';
import { PALETTE } from '../shared/palette.js';
import { rng } from '../shared/textures.js';
import { createGround, createRidge, scatter } from '../shared/nature.js';
import {
  createTrees, createPots, createBullockCart, createLamp, createBanner, createAwning,
  createBirds, createDust, createGrainHeap, makeGlowSprite,
} from '../shared/props.js';
import { randomPerson, Walker } from '../shared/people.js';
import { loadModel } from '../shared/models.js';
import { SpeechBubble } from '../ui/SpeechBubble.js';
import { BackgroundAudio } from '../systems/BackgroundAudio.js';

// ---- layout (metres). The bazaar is one long street running along Z. ----
const S = 8.5;                 // half-width of the street out to the shop fronts (platforms take 2 m each side)
const Z_START = 34, Z_END = -50; // shop rows run between these Z values
const PLAZA = { z0: -50, z1: -86, hw: 26 };

// What each kind of shop sells: cloth colours for its awning and the painted lintel strip
const KINDS = {
  pottery: { accent: PALETTE.terracotta, cloth: [PALETTE.cloth[0], PALETTE.ochre, PALETTE.indigo] },
  beads: { accent: PALETTE.turquoise, cloth: [PALETTE.turquoise, PALETTE.lapis, PALETTE.ochre] },
  grain: { accent: PALETTE.ochre, cloth: [PALETTE.ochre, 0xc9a36b, PALETTE.cloth[3]] },
  textile: { accent: PALETTE.madder, cloth: [PALETTE.cloth[4], PALETTE.cloth[1], PALETTE.cloth[2]] },
  tools: { accent: PALETTE.bronze, cloth: [PALETTE.indigo, PALETTE.cloth[0], PALETTE.ochre] },
  general: { accent: PALETTE.lapis, cloth: [PALETTE.cloth[5], PALETTE.cloth[2], PALETTE.cloth[0]] },
};
const ROLES = { pottery: 'potter', beads: 'bead-maker', grain: 'grain merchant', textile: 'cloth seller', tools: 'metalworker', general: 'trader' };
const ORDER = ['pottery', 'beads', 'grain', 'textile', 'tools', 'general'];

/**
 * Scene 4 — Marketplace, Trade and Crafts.
 * One continuous bazaar street: terraced baked-brick shops shoulder to shoulder on both sides,
 * each open-fronted with a raised selling platform, awning, goods and a merchant; ox-carts and
 * crowds in the middle; a weighing plaza and a potter's kiln at the far end. The sound is a
 * layered synthesised soundscape (see MarketAudio) fed by live positions from this scene.
 */
export class MarketScene extends BaseScene {
  static id = 'market';
  static accent = PALETTE.ochre;
  static settings = {
    ui: 'scene', timeSlider: true,
    camera: { pos: [0, 1.7, 68], yaw: 0, pitch: 0.03, mode: 'walk', eye: 1.7, speed: 3.4 },
    lighting: {
      time: 10.5, sky: { turbidity: 3.6, rayleigh: 1.5, mie: 0.006, mieG: 0.8 }, fogDensity: 0.0055, fogTint: 0xf0d8b8,
      shadowSize: 70, azimuthOffset: 0.5, exposure: 0.55, sunBoost: 1.0, hemiBoost: 1.6,
    },
    audio: { wind: 0.12, birds: 0.2, crackle: 0.6, market: 1 },
    look: { bloom: { strength: 0.25, threshold: 0.92, radius: 0.6 }, saturation: 1.16, contrast: 1.07, vignette: 0.3 },
    bounds: { minX: -50, maxX: 50, minZ: -92, maxZ: 92 },
  };

  getTourStops() { return this.stops; }

  async init() {
    const R = rng(52);
    const rnd = (a, b) => a + R() * (b - a);
    const pickA = (a) => a[Math.floor(R() * a.length)];
    const g = this.ground;
    const kit = new BuildKit(g, 29);
    kit.R = R;
    const potsAll = [];
    const anim = [];            // per-person gesture / idle animation records
    const vendors = [];         // {p, pos, f0, kind, call}
    const walkers = [];
    this.walkers = walkers;
    const spots = { people: [], walkers: [], vendors: [], groups: [], shops: {}, carts: [] };
    ORDER.forEach((k) => { spots.shops[k] = []; });
    this.audioSpots = spots;
    this._head = new THREE.Vector3();
    this.app.audio.marketSource = this;

    // ============ ground: paved street, gutters, cart ruts, plaza ============
    this.add(createGround(900, 'earth'));
    kit.stone.addMM(-S, 0, PLAZA.z0, S, 0.05, 92, 0xe3cba4, 0, 0.05);
    kit.stone.addMM(-PLAZA.hw, 0, PLAZA.z1, PLAZA.hw, 0.05, PLAZA.z0, 0xe6d1ac, 0, 0.05);
    for (const x of [-6.35, 6.35]) kit.accent.addMM(x - 0.14, 0.05, PLAZA.z0, x + 0.14, 0.08, 92, 0x4a3426, 0, 0.1); // covered drains
    for (const x of [-4.2, -2.6, 2.6, 4.2]) kit.accent.addMM(x - 0.18, 0.05, PLAZA.z0, x + 0.18, 0.065, 90, 0xcaa97c, 0, 0.12);   // cart ruts

    // ============ shop rows ============
    const shops = [];
    const sb = (sh, mat, v, y, u, sv, sy, su, o = {}) => kit.box(mat, sh.side * (S + v), y, sh.zc + u, sv, sy, su, o);
    const wp = (sh, v, u) => [sh.side * (S + v), sh.zc + u];
    const addPot = (sh, v, u, y, s) => { const [x, z] = wp(sh, v, u); potsAll.push([x, y, z, s]); };
    const good = (sh, v, y, u, sv, sy, su, tint, vary = 0.1) => sb(sh, 'accent', v, y, u, sv, sy, su, { tint, vary });
    const PF = 0.3; // platform height

    const buildShop = (sh) => {
      const { side, zc, w, D, h, kind } = sh, C = KINDS[kind];
      const top = PF + h;
      // raised selling platform that reaches out into the street
      sb(sh, 'stone', (D - 2) / 2, PF / 2, 0, D + 2, PF, w, { tint: 0xf4e6c8, vary: 0.04 });
      const xa = side * (S - 2), xb = side * (S + D);
      g.addPlatform(Math.min(xa, xb), Math.max(xa, xb), zc - w / 2, zc + w / 2, PF);
      // party walls, back wall, flat roof with parapets, front beam + painted fascia
      for (const e of [-1, 1]) sb(sh, 'brick', D / 2 - 0.15, PF + h / 2, e * (w / 2 - 0.2), D + 0.3, h, 0.4, { tint: pickA([0xffffff, 0xf4d8c8, 0xe6b8a0, 0xd9a58a]), collide: true });
      sb(sh, 'plaster', D - 0.2, PF + h / 2, 0, 0.4, h, w, { tint: pickA([0xffffff, 0xfff0e0]), collide: true });
      sb(sh, 'plaster', (D - 0.5) / 2, top + 0.15, 0, D + 0.7, 0.3, w, { tint: pickA([0xd9a868, 0xe6c9a0, 0xc99a6c]) });
      sb(sh, 'brick', -0.45, top + 0.55, 0, 0.3, 0.5, w, { tint: pickA([0xe6b8a0, 0xd9a58a, 0xf0c8b0]), vary: 0.06 });
      for (const e of [-1, 1]) sb(sh, 'brick', D / 2 - 0.2, top + 0.45, e * (w / 2 - 0.15), D + 0.5, 0.3, 0.3, { tint: 0xd9a07c });
      sb(sh, 'brick', D - 0.1, top + 0.45, 0, 0.3, 0.3, w, { tint: 0xd9a07c });
      sb(sh, 'wood', -0.2, top - 0.4, 0, 0.45, 0.4, w - 0.8, { tint: 0x8a5a3a, vary: 0.06 });
      sb(sh, 'accent', -0.62, top + 0.55, 0, 0.05, 0.3, w - 1.0, { tint: C.accent, vary: 0.04 });
      for (let i = -1; i <= 1; i += 2) sb(sh, 'wood', -0.25, PF + h / 2, i * (w / 2 - 0.55), 0.3, h, 0.3, { tint: 0x8a5a3a, vary: 0.1 }); // timber door posts
      if (sh.upper) {
        const uh = 2.4;
        sb(sh, 'plaster', (1.2 + D - 0.4) / 2, top + 0.3 + uh / 2, 0, D - 1.6, uh, w - 0.8, { tint: pickA([0xf0dcc0, 0xe6cfae]) });
        sb(sh, 'brick', (1.2 + D - 0.4) / 2, top + 0.3 + uh + 0.15, 0, D - 1.5, 0.3, w - 0.7, { tint: 0xd9a07c });
        for (const u of [-w * 0.22, w * 0.22]) sb(sh, 'accent', 1.17, top + 1.4, u, 0.05, 0.6, 0.35, { tint: 0x1c110d, vary: 0 });
      }
      // awning shading the selling area
      const aw = createAwning({ uTime: this.uTime, w: w - 0.5, d: 1.9, colors: C.cloth, tilt: 0.5 });
      aw.position.set(side * (S - 1.1), PF, sh.zc); aw.rotation.y = -side * Math.PI / 2; this.add(aw);
      // counter (vendor side is blocked so people stay on the street side)
      const hasCounter = kind !== 'pottery' && kind !== 'grain';
      if (hasCounter) {
        sb(sh, 'wood', 0.55, PF + 0.45, 0, 0.9, 0.9, w - 1.2, { tint: 0xcaa07a, vary: 0.06 });
        sb(sh, 'wood', 0.55, PF + 0.92, 0, 1.0, 0.07, w - 1.1, { tint: 0xdbb68e, vary: 0.04 });
      }
      const [bx, bz] = wp(sh, 0.45, 0);
      const bl = { x: Math.abs(side) * 0 };
      g.addBlocker(Math.min(side * (S - 0.3), side * (S + 1.2)), Math.max(side * (S - 0.3), side * (S + 1.2)), zc - w / 2, zc + w / 2);
      // shelves along the back wall
      for (const y of [1.15, 2.05]) sb(sh, 'wood', D - 0.65, PF + y, 0, 0.6, 0.08, w - 1.0, { tint: 0xb98a5e, vary: 0.05 });
      stock(sh);
      // merchant behind the goods
      const merchant = randomPerson(R);
      const mu = rnd(-w * 0.2, w * 0.2);
      const [mx, mz] = wp(sh, hasCounter ? 1.5 : 2.4, mu);
      merchant.position.set(mx, PF, mz); merchant.rotation.y = -side * Math.PI / 2; this.add(merchant);
      const v = { p: merchant, pos: merchant.position, f0: rnd(100, 150), kind, call: 0, name: 'Friend', role: ROLES[kind] };
      sh.vendor = v;
      vendors.push(v); spots.vendors.push(v); spots.people.push(merchant.position);
      anim.push({ p: merchant, mode: 'vendor', ph: rnd(0, 6), rate: rnd(0.8, 1.6), base: merchant.rotation.y, v });
      const [cx, cz] = wp(sh, 0.9, 0);
      spots.shops[kind].push(new THREE.Vector3(cx, PF + 1, cz));
      // some shops have a helper moving stock around inside
      if (R() < 0.35) {
        const hp = randomPerson(R, { carry: R() < 0.4 }); this.add(hp);
        const [ax, az] = wp(sh, D - 1.6, -w / 2 + 1.0), [ex, ez] = wp(sh, D - 1.6, w / 2 - 1.0);
        walkers.push(new Walker(hp, [[ax, az], [ex, ez]], { speed: 0.4 + R() * 0.3, y: PF }));
        spots.people.push(hp.position);
      }
    };

    const stock = (sh) => {
      const { kind, w, D } = sh;
      const mat = (v0, v1, u0, u1, tint = 0xc9a468) => {
        sb(sh, 'accent', (v0 + v1) / 2, PF + 0.02, (u0 + u1) / 2, v1 - v0, 0.04, u1 - u0, { tint, vary: 0.05 });
        for (let u = u0 + 0.2; u < u1 - 0.1; u += 0.5) sb(sh, 'accent', (v0 + v1) / 2, PF + 0.045, u, v1 - v0, 0.01, 0.12, { tint: 0x8f6a3a, vary: 0.1 });
      };
      const half = w / 2 - 0.9;
      if (kind === 'pottery') {
        mat(-1.7, -0.3, -half, half);
        for (let i = 0; i < 12; i++) addPot(sh, -1.45 + (i % 2) * 0.7, -half + 0.5 + (i >> 1) * ((2 * half - 1) / 5), PF + 0.03, rnd(0.8, 1.35));
        for (let i = 0; i < 6; i++) addPot(sh, 0.9, -half + 0.5 + i * ((2 * half - 1) / 5), PF + 0.03, rnd(1.2, 1.6));        // big storage jars
        for (let i = 0; i < 7; i++) addPot(sh, D - 0.65, -half + 0.4 + i * ((2 * half - 0.8) / 6), PF + 1.2, rnd(0.55, 0.75));
        for (let i = 0; i < 7; i++) addPot(sh, D - 0.65, -half + 0.4 + i * ((2 * half - 0.8) / 6), PF + 2.1, rnd(0.45, 0.6));
      } else if (kind === 'beads') {
        const cols = [PALETTE.carnelian, PALETTE.lapis, PALETTE.faience, 0xf2e6d0, PALETTE.ochre, PALETTE.madder];
        for (let t = 0; t < 4; t++) {
          const u = -half + 0.7 + t * ((2 * half - 1.4) / 3);
          sb(sh, 'stone', 0.5, PF + 0.98, u, 0.55, 0.05, 0.7, { tint: 0xe8dcc6, vary: 0.04 });
          for (let i = 0; i < 9; i++) good(sh, 0.5 + rnd(-0.18, 0.18), PF + 1.03 + (i % 3) * 0.04, u + rnd(-0.25, 0.25), 0.09, 0.07, 0.09, cols[(t + (i % 3)) % 6]);
        }
        for (let i = 0; i < 9; i++) { const u = -half + 0.3 + i * ((2 * half - 0.6) / 8); sb(sh, 'accent', 0.3, PF + 2.55, u, 0.02, 0.9, 0.02, { tint: 0x4a3426, vary: 0 }); for (let b = 0; b < 4; b++) good(sh, 0.3, PF + 2.3 + b * 0.2, u, 0.09, 0.09, 0.09, cols[(i + b) % 6]); } // hanging strings
        for (let i = 0; i < 8; i++) good(sh, D - 0.65, PF + 1.22, -half + 0.4 + i * ((2 * half - 0.8) / 7), 0.34, 0.12, 0.34, 0xf2eadc, 0.06); // shell bangles
        for (let i = 0; i < 8; i++) good(sh, D - 0.65, PF + 2.12, -half + 0.4 + i * ((2 * half - 0.8) / 7), 0.28, 0.2, 0.28, i % 2 ? 0xf0d8c0 : PALETTE.faience, 0.08);
      } else if (kind === 'grain') {
        mat(-1.7, -0.3, -half, half, 0xd0b074);
        const heap = [PALETTE.ochre, 0xd9c28a, 0xb08a4a, 0xc9a36b, 0x9a7a44];
        for (let i = 0; i < 6; i++) {
          const u = -half + 0.5 + (i % 3) * ((2 * half - 1) / 2), v = -1.45 + Math.floor(i / 3) * 0.85;
          sb(sh, 'accent', v, PF + 0.28, u, 0.85, 0.5, 0.85, { tint: 0xc4985a, vary: 0.1 });
          const hp = createGrainHeap(heap[i % 5]); const [x, z] = wp(sh, v, u); hp.position.set(x, PF + 0.5, z); hp.scale.setScalar(0.62); this.add(hp);
        }
        for (let i = 0; i < 7; i++) sb(sh, 'accent', 1.0 + (i % 2) * 0.1, PF + 0.4 + Math.floor(i / 4) * 0.55, -half + 0.45 + (i % 4) * 0.75, 0.55, 0.7, 0.5, { tint: pickA([0xd8c294, 0xc9b080, 0xe2d0a4]), vary: 0.08 }); // sacks
        for (let i = 0; i < 6; i++) addPot(sh, D - 0.65, -half + 0.5 + i * ((2 * half - 1) / 5), PF + 1.2, rnd(0.5, 0.7));
      } else if (kind === 'textile') {
        const cols = PALETTE.cloth;
        for (let s = 0; s < 4; s++) { const u = -half + 0.7 + s * ((2 * half - 1.4) / 3); for (let k = 0; k < 4; k++) good(sh, 0.55, PF + 0.98 + k * 0.1, u + rnd(-0.03, 0.03), 0.7, 0.1, 0.8, cols[(s + k) % 6], 0.06); }
        for (let i = 0; i < 6; i++) good(sh, 2.0, PF + 1.6, -half + 0.5 + i * ((2 * half - 1) / 5), 0.05, 1.9, 0.85, cols[(i * 2) % 6], 0.07); // hanging lengths
        for (let i = 0; i < 6; i++) good(sh, D - 0.65, PF + 1.3, -half + 0.45 + i * ((2 * half - 0.9) / 5), 0.45, 0.3, 0.5, cols[(i + 3) % 6], 0.08); // rolls
        for (let i = 0; i < 5; i++) good(sh, D - 0.65, PF + 2.2, -half + 0.5 + i * ((2 * half - 1) / 4), 0.45, 0.3, 0.5, cols[(i + 1) % 6], 0.08);
      } else if (kind === 'tools') {
        for (let i = 0; i < 9; i++) good(sh, 0.45 + rnd(-0.15, 0.15), PF + 0.98, -half + 0.4 + i * ((2 * half - 0.8) / 8), 0.5, 0.03, 0.12, i % 2 ? PALETTE.copper : PALETTE.bronze, 0.1); // blades
        for (let i = 0; i < 4; i++) { const u = -half + 0.8 + i * ((2 * half - 1.6) / 3); good(sh, 0.8, PF + 1.0, u, 0.4, 0.05, 0.05, 0x6a4a30); good(sh, 0.62, PF + 1.03, u, 0.12, 0.1, 0.16, PALETTE.copper, 0.06); } // axes
        for (let i = 0; i < 5; i++) good(sh, D - 0.45, PF + 1.9 + (i % 2) * 0.3, -half + 0.5 + i * ((2 * half - 1) / 4), 0.06, 0.8, 0.07, i % 2 ? PALETTE.bronze : PALETTE.copper, 0.1); // tools hung on the back wall
        for (let i = 0; i < 6; i++) good(sh, D - 0.65, PF + 1.23, -half + 0.4 + i * ((2 * half - 0.8) / 5), 0.34, 0.14, 0.24, i % 2 ? PALETTE.copper : PALETTE.bronze, 0.08); // ingots
        sb(sh, 'stone', 1.7, PF + 0.3, half - 0.3, 0.7, 0.6, 0.7, { tint: 0xb0a088, vary: 0.1 }); // anvil stone
        for (let i = 0; i < 5; i++) sb(sh, 'stone', 0.48, PF + 1.06, -half + 0.3 + i * 0.28, 0.14 + i * 0.03, 0.14 + i * 0.03, 0.14 + i * 0.03, { tint: 0xc9b99a, vary: 0.06 }); // cubic weights
      } else { // general trade stall
        mat(-1.7, -0.3, -half, half, 0xb89868);
        for (let i = 0; i < 5; i++) sb(sh, 'accent', -1.2 + (i % 2) * 0.7, PF + 0.22, -half + 0.5 + i * ((2 * half - 1) / 4), 0.6, 0.4, 0.6, { tint: pickA([0xc4985a, 0xb88a4a, 0xd0a868]), vary: 0.1 }); // baskets
        for (let i = 0; i < 8; i++) sb(sh, 'stone', 0.5, PF + 0.97, -half + 0.4 + i * ((2 * half - 0.8) / 7), 0.22, 0.06, 0.22, { tint: 0xe8dcc6, vary: 0.05 }); // steatite seals
        for (let i = 0; i < 6; i++) good(sh, 0.75, PF + 1.0, -half + 0.6 + i * ((2 * half - 1.2) / 5), 0.16, 0.12, 0.1, [0xc9764a, 0xb88a4a, 0xe0c090][i % 3], 0.1); // clay figurines
        for (let i = 0; i < 4; i++) sb(sh, 'wood', D - 0.75 + (i % 2) * 0.05, PF + 0.4 + Math.floor(i / 2) * 0.8, -half + 0.6 + (i % 2) * 1.0, 0.7, 0.7, 0.8, { tint: 0xb08050, vary: 0.1 }); // crates
        for (let i = 0; i < 5; i++) addPot(sh, D - 0.65, -half + 0.5 + i * ((2 * half - 1) / 4), PF + 1.2, rnd(0.5, 0.7));
        for (let i = 0; i < 4; i++) good(sh, D - 0.65, PF + 2.15, -half + 0.6 + i * ((2 * half - 1.2) / 3), 0.4, 0.2, 0.4, 0xd8c090, 0.1); // bundles
      }
    };

    // lay out each row without gaps (just a thin slit between neighbours)
    let idx = 0;
    for (const side of [-1, 1]) {
      let cursor = Z_START, i = 0;
      while (cursor > Z_END + 6) {
        const w = rnd(6.0, 7.8), D = rnd(6.2, 7.2), h = rnd(3.2, 4.0);
        const kind = ORDER[(i + (side > 0 ? 3 : 0) + (i > 5 && R() < 0.3 ? 1 : 0)) % 6];
        const sh = { side, zc: cursor - w / 2, w, D, h, kind, upper: R() < 0.28 };
        shops.push(sh); buildShop(sh);
        cursor -= w + rnd(0.1, 0.25); i++; idx++;
      }
      // closing house at the end of the row
      kit.house({ x: side * (S + 4.5), z: cursor - 3.5, w: 9, d: 7, h: 4.4, rot: side > 0 ? -Math.PI / 2 : Math.PI / 2, mat: 'brick', collide: true });
    }
    this.shops = shops;

    // ============ lane houses to the south, back-of-row skyline, plaza surround ============
    for (const side of [-1, 1]) {
      for (let z = 42; z < 88; z += 10.5) kit.house({ x: side * (S + 5), z: z + rnd(-0.4, 0.4), w: rnd(8, 10), d: rnd(7, 9), h: rnd(3.6, 5), rot: side > 0 ? -Math.PI / 2 : Math.PI / 2, mat: R() < 0.3 ? 'plaster' : 'brick', upper: R() < 0.3 });
      for (let z = Z_START; z > Z_END - 6; z -= 11) kit.house({ x: side * (S + 7 + 6.5), z: z + rnd(-1, 1), w: rnd(8, 11), d: rnd(7, 9), h: rnd(4.6, 7), rot: side > 0 ? Math.PI / 2 : -Math.PI / 2, mat: R() < 0.3 ? 'plaster' : 'brick', upper: R() < 0.4, collide: false });
    }
    for (let x = -PLAZA.hw + 3; x < PLAZA.hw; x += 11) kit.house({ x: x + rnd(-0.5, 0.5), z: PLAZA.z1 - 5, w: rnd(8, 10.5), d: rnd(7, 9), h: rnd(3.8, 5.4), rot: 0, mat: R() < 0.3 ? 'plaster' : 'brick', upper: R() < 0.35 });
    for (const side of [-1, 1]) for (let z = PLAZA.z0 - 14; z > PLAZA.z1 + 4; z -= 11) kit.house({ x: side * (PLAZA.hw + 5), z: z + rnd(-0.5, 0.5), w: rnd(8, 10), d: rnd(7, 9), h: rnd(3.6, 5), rot: side > 0 ? -Math.PI / 2 : Math.PI / 2, mat: R() < 0.3 ? 'plaster' : 'brick' });
    for (let gx = -120; gx < 125; gx += 14) for (const gz of [-118, -134]) kit.house({ x: gx + rnd(-1.5, 1.5), z: gz + rnd(-2, 2), w: rnd(6, 10), d: rnd(7, 10), h: rnd(3.2, 5), rot: pickA([0, Math.PI]), mat: R() < 0.25 ? 'plaster' : 'brick', collide: false });

    // ============ plaza: weighing dais, kiln, parked cart ============
    const DX = 0, DZ = -68;
    kit.stone.addMM(DX - 5, 0.05, DZ - 4, DX + 5, 0.45, DZ + 4, 0xf0e2c8, 0, 0.04);
    g.addPlatform(DX - 5, DX + 5, DZ - 4, DZ + 4, 0.45);
    kit.stairs({ x: DX, z: DZ + 4, y0: 0, width: 4, steps: 2, rise: 0.225, run: 0.5, dir: '+z', mat: 'stone', sideWalls: false });
    kit.wood.add(DX, DZ * 0 + 1.55, DZ, 0.16, 2.2, 0.16, 0x7d5435, 0, 0.08, R);
    kit.wood.add(DX, 2.6, DZ, 3.0, 0.12, 0.12, 0x8a6040, 0, 0.05, R);
    for (const s of [-1, 1]) { kit.accent.add(DX + s * 1.45, 1.85, DZ, 0.03, 1.5, 0.03, 0x3a2a1c, 0, 0); kit.accent.add(DX + s * 1.45, 1.1, DZ, 0.9, 0.08, 0.9, PALETTE.bronze, 0, 0.05); }
    kit.stone.add(DX - 1.45, 1.22, DZ, 0.3, 0.3, 0.3, 0xc9b99a, 0, 0.05, R); kit.stone.add(DX + 1.45, 1.2, DZ, 0.18, 0.18, 0.18, 0xc9b99a, 0, 0.05, R);
    [[-3.4, 0.14], [-2.7, 0.22], [-2.0, 0.3], [2.1, 0.12], [2.7, 0.2], [3.4, 0.28]].forEach(([x, s]) => kit.stone.add(DX + x, 0.45 + s / 2, DZ - 2.5, s, s, s, pickA([0xd8c8a8, 0xb8a88a, 0xa89a7c]), 0, 0.06, R));
    g.addBlocker(DX - 0.3, DX + 0.3, DZ - 0.3, DZ + 0.3);
    const K = { x: -17, z: -62 };
    kit.box('brick', K.x, 0.9, K.z, 3.2, 1.8, 3.2, { tint: 0xd89878, collide: true });
    kit.box('brick', K.x, 2.1, K.z, 2.4, 0.6, 2.4, { tint: 0xc98868 });
    kit.box('brick', K.x, 2.65, K.z, 1.0, 0.5, 1.0, { tint: 0x8a5038 });
    kit.box('accent', K.x + 1.62, 0.7, K.z, 0.08, 0.9, 1.0, { tint: 0x120a07, vary: 0 });
    const fire = makeGlowSprite(0xff7a2a, 2.2, 0.9); fire.position.set(K.x + 1.9, 0.75, K.z); this.add(fire);
    this.updaters.push((dt, t) => { fire.material.opacity = 0.75 + Math.sin(t * 9) * 0.12 + Math.sin(t * 23) * 0.06; });
    kit.wood.add(K.x + 3.3, 0.25, K.z + 1.6, 0.9, 0.5, 0.9, 0xc09068, 0, 0.1, R);
    kit.stone.add(K.x + 3.3, 0.55, K.z + 1.6, 0.6, 0.1, 0.6, 0xd8c8a8, 0, 0.04, R);
    kit.stone.add(K.x + 4.4, 0.18, K.z - 1.4, 1.4, 0.36, 1.0, 0xb89870, 0, 0.1, R);
    for (let i = 0; i < 12; i++) potsAll.push([K.x + 2 + (i % 6) * 0.55, 0, K.z - 3.2 + Math.floor(i / 6) * 0.7, rnd(0.8, 1.0)]);
    const parked = await loadModel('bullock_cart', () => createBullockCart({ cloth: PALETTE.cloth[3] }));
    parked.position.set(16, 0, -62); parked.rotation.y = 0.6; this.root.add(parked);
    g.addBlocker(13.5, 18.5, -65, -59);
    // street furniture: banners, lamps
    for (const [x, z, ci] of [[-6.6, 36, 0], [6.6, 36, 1], [-6.6, -2, 3], [6.6, -24, 4], [-6.6, -46, 2], [6.6, 62, 5]]) {
      const b = createBanner({ uTime: this.uTime, colors: [PALETTE.cloth[ci], PALETTE.ochre, PALETTE.turquoise, PALETTE.indigo], poleH: 4.6 });
      b.position.set(x, 0, z); this.add(b);
    }
    [[-6.7, 22, 1], [6.7, 8, 1], [-6.7, -14, 1], [6.7, -34, 1], [-6.7, 46, 0], [6.7, 46, 0], [-6.7, 72, 0], [6.7, 72, 0], [-22, -70, 0], [22, -70, 0]].forEach(([x, z, light]) => this.add(createLamp({ lamps: this.lamps, x, y: 0, z, light: !!light })));
    this.add(createPots(potsAll));
    kit.build(this.root);

    // ============ nature ============
    this.add(createTrees([...scatter(14, [-110, 110, -150, -100], { seed: 6 }), ...scatter(10, [-90, 90, 94, 130], { seed: 7 }), ...scatter(8, [-35, 35, -100, -92], { seed: 8 })], { uTime: this.uTime, seed: 11 }));
    const ridge = createRidge({ width: 1300, height: 70, color: 0x9a8fb0, seed: 8 }); ridge.position.set(0, 0, -560); this.add(ridge);

    // ============ people ============
    const gy = (x, z) => g.height(x, z);
    const front = (sh, v = -1.2) => wp(sh, v, rnd(-sh.w / 2 + 1.3, sh.w / 2 - 1.3));
    // customers browsing at the shop fronts, each turned toward the goods at their own angle
    shops.filter(() => R() < 0.4).forEach((sh) => {
      const p = randomPerson(R, { carry: R() < 0.08 }); const [x, z] = front(sh, rnd(-1.6, -0.8));
      p.position.set(x, PF, z); p.rotation.y = sh.side * Math.PI / 2 + rnd(-0.5, 0.5); this.add(p);
      anim.push({ p, mode: 'browse', ph: rnd(0, 6), rate: rnd(0.5, 1.2), base: p.rotation.y });
      spots.people.push(p.position);
      if (R() < 0.5) { // a second customer: the pair haggle with the merchant
        const q = randomPerson(R); const [x2, z2] = [x + rnd(-0.4, 0.4), z + rnd(1.0, 1.4) * (R() < 0.5 ? 1 : -1)];
        q.position.set(x2, PF, z2); q.rotation.y = sh.side * Math.PI / 2 + rnd(-0.4, 0.4); this.add(q);
        anim.push({ p: q, mode: 'talk', ph: rnd(0, 6), rate: rnd(1.0, 1.8), base: q.rotation.y });
        spots.people.push(q.position);
      }
      const vd = vendors.find((v) => Math.abs(v.pos.z - sh.zc) < sh.w / 2 && Math.sign(v.pos.x) === sh.side);
      if (vd) spots.groups.push([vd.pos, p.position]);
    });
    // clusters of two or three bargaining out in the street
    for (let k = 0; k < 7; k++) {
      const cx = rnd(-5, 5), cz = rnd(-44, 60), n = R() < 0.5 ? 2 : 3, members = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rnd(-0.3, 0.3), p = randomPerson(R, { carry: R() < 0.06 });
        p.position.set(cx + Math.cos(a) * 0.85, 0, cz + Math.sin(a) * 0.85); p.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a)) + rnd(-0.3, 0.3); this.add(p);
        anim.push({ p, mode: 'talk', ph: rnd(0, 6), rate: rnd(1.0, 2.0), base: p.rotation.y });
        spots.people.push(p.position); members.push(p.position);
      }
      spots.groups.push(members);
    }
    // pedestrians walking both ways along the street, with some weaving between sides
    for (let i = 0; i < 24; i++) {
      const dir = i % 2 ? 1 : -1, x1 = dir * rnd(0.5, 5.8) * (R() < 0.5 ? 1 : -1), x2 = rnd(-5.8, 5.8);
      const a = rnd(-46, 70), b = a + dir * rnd(35, 90);
      const p = randomPerson(R, { carry: i % 11 === 0 }); this.add(p);
      const w = new Walker(p, [[x1, Math.min(78, Math.max(-48, a))], [x2, Math.min(78, Math.max(-48, b))]], { speed: 0.55 + R() * 0.55, groundFn: gy });
      walkers.push(w); spots.people.push(p.position); spots.walkers.push(p.position);
    }
    // plaza crowd
    for (let i = 0; i < 6; i++) {
      const p = randomPerson(R, { carry: i % 6 === 0 }); this.add(p);
      walkers.push(new Walker(p, [[rnd(-22, 22), rnd(-82, -56)], [rnd(-22, 22), rnd(-82, -56)]], { speed: 0.5 + R() * 0.4, groundFn: gy }));
      spots.people.push(p.position); spots.walkers.push(p.position);
    }
    const named = [];
    for (const [x, z, ry] of [[-2.4, -67.8, 1.57], [2.4, -68.4, -1.57], [K.x + 3, K.z + 0.4, 2.2], [K.x + 2.2, K.z + 2.6, 3.4], [12.6, -62, 1.57], [-3.5, 54, Math.PI]]) {
      const p = randomPerson(R); p.position.set(x, g.height(x, z), z); p.rotation.y = ry; this.add(p);
      anim.push({ p, mode: 'talk', ph: rnd(0, 6), rate: rnd(0.8, 1.4), base: ry }); spots.people.push(p.position);
      named.push({ pos: p.position, pitch: 1, name: 'Friend', role: 'trader' });
    }
    // the characters who do the explaining at the non-shop spots
    const speakers = { weights: named[0], kiln: named[2], carts: named[4], greeter: named[5] };
    Object.assign(speakers.weights, { name: 'Vihan', role: 'trader with the scales' });
    Object.assign(speakers.kiln, { name: 'Kaveri', role: 'potter at the kiln' });
    Object.assign(speakers.carts, { name: 'Gopal', role: 'cart driver' });
    Object.assign(speakers.greeter, { name: 'Ravi', role: 'merchant' });

    // ============ ox-carts rolling through the street (they loop back from far off) ============
    this.movers = [];
    for (const [lane, dir, z0, cl] of [[-3.4, -1, 62, PALETTE.cloth[3]], [3.4, 1, -30, PALETTE.cloth[0]]]) {
      const c = await loadModel('bullock_cart', () => createBullockCart({ cloth: cl }));
      c.position.set(lane, 0, z0); c.rotation.y = dir < 0 ? Math.PI / 2 : -Math.PI / 2; this.root.add(c);
      this.movers.push({ c, dir, speed: 1.4 + R() * 0.3, ph: rnd(0, 6) });
      spots.carts.push(c.position);
    }

    // ============ life ============
    const birds = createBirds(10, { center: [0, 45, 0], radius: 85, spread: 14, seed: 5 });
    this.add(birds.group, (dt, t) => birds.update(dt, t));
    const dust = createDust({ count: 320, box: 40, height: 12 });
    this.add(dust.points, (dt) => dust.update(dt, this.app.camera.position, 0.8));

    this.updaters.push((dt, t) => {
      walkers.forEach((w) => w.update(dt));
      for (const m of this.movers) {
        m.c.position.z += m.dir * m.speed * dt;
        if (m.dir < 0 && m.c.position.z < -84) m.c.position.z = 90;
        if (m.dir > 0 && m.c.position.z > 90) m.c.position.z = -84;
        m.c.position.y = Math.abs(Math.sin(t * 5 + m.ph)) * 0.015;
        m.c.rotation.z = Math.sin(t * 4 + m.ph) * 0.006;
      }
      for (const a of anim) {
        const u = a.p.userData, s = Math.sin(t * a.rate + a.ph);
        if (a.mode === 'vendor') {
          const calling = a.v.call > t;
          u.armL.rotation.x = -0.6 + s * 0.5; u.armR.rotation.x = calling ? 0 : -0.5 - s * 0.4;
          u.armR.rotation.z = calling ? 2.3 + Math.sin(t * 6) * 0.2 : 0;
          a.p.rotation.y = a.base + Math.sin(t * 0.3 + a.ph) * 0.18;
        } else if (a.mode === 'talk') {
          const on = Math.sin(t * 0.5 + a.ph * 2) > -0.35;
          u.armR.rotation.x = on ? -0.9 + s * 0.6 : -0.1; u.armL.rotation.x = on ? -0.4 + Math.sin(t * a.rate * 1.3 + a.ph) * 0.4 : 0;
          a.p.rotation.y = a.base + Math.sin(t * 0.8 + a.ph) * 0.2;
        } else {
          const reach = Math.sin(t * 0.35 + a.ph) > 0.2;
          u.armR.rotation.x = reach ? -1.1 + s * 0.15 : -0.1; u.armL.rotation.x = -0.1;
          a.p.rotation.y = a.base + Math.sin(t * 0.25 + a.ph) * 0.25;
        }
      }
    });

    // ============ hotspots & tour ============
    const H = (id, pos, color, radius = 3.6) => this.hotspots.add({
      id, position: new THREE.Vector3(...pos), color, radius, size: 0.95,
      onActivate: () => { this.say('hotspot_' + id, this.app.captions.get('market', 'hotspot_' + id), '#' + color.toString(16).padStart(6, '0')); this.app.audio.blip(880); },
    });
    const find = (kind, side, nth = 1) => shops.filter((s) => s.kind === kind && s.side === side)[nth] || shops.find((s) => s.kind === kind);
    const spot = (sh, y = 2.3) => [sh.side * (S - 1.4), y, sh.zc];
    const potSh = find('pottery', -1), beadSh = find('beads', 1), grainSh = find('grain', -1), textSh = find('textile', 1), genSh = find('general', -1), toolSh = find('tools', 1);
    H('pottery', spot(potSh), PALETTE.terracotta);
    H('beads', spot(beadSh), PALETTE.carnelian);
    H('grain', spot(grainSh), PALETTE.ochre);
    H('textile', spot(textSh), PALETTE.madder);
    H('seals', spot(genSh), PALETTE.indigo);
    H('weights', [DX, 3.5, DZ], PALETTE.bronze, 4.2);
    H('kiln', [K.x, 3.8, K.z], 0xff7a2a, 4.2);
    H('carts', [16, 2.8, -62], PALETTE.turquoise, 4.2);
    // who speaks for each caption key: shop merchants, or the named characters on the plaza
    potSh.vendor.name = 'Dhruv'; beadSh.vendor.name = 'Samar'; grainSh.vendor.name = 'Tarun'; textSh.vendor.name = 'Lakshmi'; genSh.vendor.name = 'Karan';
    const shopFor = { pottery: potSh, beads: beadSh, grain: grainSh, textile: textSh, seals: genSh };
    this.speakerFor = (key) => {
      const k = key.replace(/^(tour|hotspot)_/, '');
      if (shopFor[k]) return shopFor[k].vendor;
      return speakers[k] || speakers.greeter;
    };
    this.bubble = new SpeechBubble(document.getElementById('ui'), this.app);
    this.app.captions.sink = { show: (c, opts, key) => this.say(key, c), hide: () => this.bubble.hide() };
    this.bg = new BackgroundAudio(this.app, { src: `${import.meta.env.BASE_URL}bazaarbgd.mp3`, volume: 0.6 });
    this.bubble.onVisible = (v) => this.bg.duck(v);
    this.updaters.push((dt) => { this.bubble.update(this.app.camera); this.bg.update(dt); });
    const look = (sh, d = 5.2) => ({ pos: [sh.side * (S - d), 1.9, sh.zc + 3.4], look: [sh.side * (S + 0.8), 1.3, sh.zc], hold: 17 });
    this.stops = [
      { id: 'tour_street', pos: [0, 2.6, 80], look: [0, 2.2, 10], hold: 17 },
      { id: 'tour_pottery', ...look(potSh) },
      { id: 'tour_beads', ...look(beadSh) },
      { id: 'tour_grain', ...look(grainSh) },
      { id: 'tour_textile', ...look(textSh) },
      { id: 'tour_weights', pos: [-7, 2.6, -57], look: [DX, 1.2, DZ], hold: 17 },
      { id: 'tour_kiln', pos: [-9, 2.4, -53], look: [K.x, 1.3, K.z], hold: 17 },
    ];
    this.vendorList = vendors;
  }

  /** Called by the audio system when a merchant shouts, so the merchant visibly calls out too. */
  onVendorCall(i) { const v = this.vendorList?.[i]; if (v) v.call = this.time + 1.6; }

  /** A character speaks, one sentence at a time, in a bubble over their head; the fun fact goes to the side card. */
  say(key, c, accent = '#d9a23a') {
    if (!c) return;
    const sp = this.speakerFor(key);
    const sentences = (c.text.match(/[^.!?]+[.!?]+/g) || [c.text]).map((x) => x.trim());
    const anchor = () => this._head.copy(sp.pos).setY(sp.pos.y + 2.25);
    const panel = this.app.ui.panel;
    this.bubble.show(`${sp.name} · ${sp.role}`, sentences, anchor, {
      accent, pitch: sp.f0 ? 0.8 + (sp.f0 - 100) / 160 : 1,
      onSentence: (i, n) => {
        if (i === n - 1 && c.didYouKnow) { panel.show({ title: 'Did you know?', text: c.didYouKnow }, accent); } // stays until the next fact replaces it
      },
    });
    if (sp.pitch === undefined) sp.call = this.time + 3 + sentences.join(' ').length * 0.07; // merchants gesture while they talk
  }
  _hideFact() { clearTimeout(this._factT); this.app.ui.panel.hide(); }

  onEnter() { this.bg?.play(); this.app.captions.show('market', 'enter'); }

  dispose() {
    this.bubble?.hide(); this.bubble?.node.remove(); this._hideFact(); this.bg?.dispose();
    if (this.app.captions.sink) this.app.captions.sink = null;
    if (this.app.audio.marketSource === this) this.app.audio.marketSource = null;
    super.dispose();
  }
}
