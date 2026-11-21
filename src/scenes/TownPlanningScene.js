import * as THREE from 'three';
import gsap from 'gsap';
import { BaseScene } from '../core/BaseScene.js';
import { BuildKit } from '../shared/builders.js';
import { PALETTE } from '../shared/palette.js';
import { rng } from '../shared/textures.js';
import { createGround, createRidge, scatter } from '../shared/nature.js';
import { makeBrickMaterial } from '../shared/materials.js';
import { createTrees, createPots, createLamp, createBirds, createDust, createBanner, makeGlowSprite } from '../shared/props.js';
import { randomPerson, Walker } from '../shared/people.js';
import { el } from '../ui/dom.js';
import { makeLabel } from '../shared/labels.js';
import { DialogueBox } from '../ui/DialogueBox.js';
import { CityOverview } from '../ui/CityOverview.js';
import { Artisan } from '../workshop/Artisan.js';
import { GUIDE, SCRIPT, POIS, OVERVIEW } from '../data/townScript.js';

// ---- the planned grid (metres). N-S streets at x = XL, E-W streets at z = ZL. ----
const XL = [-60, -30, 0, 30, 60, 90], ZL = [-60, -30, 0, 30, 60];
const MAIN_X = new Set([-60, 0, 60]), MAIN_Z = new Set([0]);
const hw = (main) => (main ? 4.5 : 1.6);                          // half street width
const HOUSE = { x0: 6, x1: 24, z0: 34, z1: 52 };                  // the one explorable house (door on its west wall)
const DOOR_Z = 43;
const CIT = { x0: -150, x1: -95, z0: -35, z1: 35, top: 7 };       // the raised western mound
const POOL = { x0: -131, x1: -119, z0: -4, z1: 4, floor: 4.6 };
const nearest = (arr, v) => arr.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
// inside the house: rooms, where the guide stands in each, and the doorway waypoints from each room to the courtyard hub
const HUB = [13.2, 42];
const ROOMS = {
  hall: { stand: [8.5, 41.8], toHub: [[9, 43], [12, 43]] },
  court: { stand: HUB, toHub: [] },
  living: { stand: [16.4, 36.4], toHub: [[15, 38.5], [15, 40], [14.2, 41.2]] },
  kitchen: { stand: [15.6, 48.2], toHub: [[15.6, 47.5], [15, 46], [13.2, 45]] },
  family: { stand: [20.6, 42.4], toHub: [[21, 43], [18, 43], [16.7, 43.8], [15, 44.9], [13.2, 44.2]] },
  bath: { stand: [10.2, 48.8], toHub: [[9, 47], [9, 45], [9, 43], [12, 43]] },
};
const ENTER = [[3, DOOR_Z], [9, DOOR_Z], [12, DOOR_Z], HUB];
const roomOf = (p) => (p.x < 12 ? (p.z > 46 ? 'bath' : 'hall') : p.x < 18 ? (p.z < 40 ? 'living' : p.z > 46 ? 'kitchen' : 'court') : 'family');
const roomPath = (a, b) => (a === b ? [] : [...ROOMS[a].toHub, HUB, ...[...ROOMS[b].toHub].reverse(), ROOMS[b].stand]);
const INSIDE_IDS = new Set(['courtyard', 'houseWell', 'rooms', 'kitchen', 'bath']);
const inHouse = (p) => p.x > HOUSE.x0 - 0.5 && p.x < HOUSE.x1 && p.z > HOUSE.z0 && p.z < HOUSE.z1;

/**
 * Town Planning. A grid-planned Lower Town (main streets, lanes, brick houses, wells and
 * drains), one explorable house, and the raised Citadel mound to the west. A city guide leads
 * three experiences: a tour of the city's features, the inside of a Harappan house, and an
 * interactive Citadel vs Lower Town comparison.
 */
export class TownPlanningScene extends BaseScene {
  static id = 'townPlanning';
  static accent = PALETTE.terracotta;
  static settings = {
    ui: 'scene', timeSlider: true,
    camera: { pos: [0, 1.7, 68], yaw: 0, pitch: 0.04, mode: 'walk', eye: 1.7, speed: 3.6 },
    lighting: {
      time: 10, sky: { turbidity: 3.2, rayleigh: 1.5, mie: 0.005, mieG: 0.8 }, fogDensity: 0.0026, fogTint: 0xf0dcc0,
      shadowSize: 70, azimuthOffset: 0.4, exposure: 0.58, sunBoost: 1.0, hemiBoost: 1.5, moon: 0.9, nightHemi: 0.7,
    },
    audio: { wind: 0.3, birds: 0.5 },
    look: { bloom: { strength: 0.25, threshold: 0.92, radius: 0.6 }, saturation: 1.15, contrast: 1.06, vignette: 0.28 },
    bounds: { minX: -160, maxX: 120, minZ: -80, maxZ: 90 },
  };

  async init() {
    const R = rng(33), rnd = (a, b) => a + R() * (b - a), pickA = (a) => a[Math.floor(R() * a.length)];
    const g = this.ground, kit = new BuildKit(g, 41); kit.R = R;
    const potsAll = [], walkers = [];
    this.pois = []; this.highlights = []; this.busy = false; this.mode = 'free'; this.dead = false; this.started = false; this.houseIntroDone = false;

    // ============ terrain, streets, drains ============
    this.add(createGround(900, 'earth'));
    for (const x of XL) { const w = hw(MAIN_X.has(x)); kit.stone.addMM(x - w, 0, -62, x + w, 0.05, 62, MAIN_X.has(x) ? 0xe3cba4 : 0xd6bc94, 0, 0.05); }
    for (const z of ZL) { const w = hw(MAIN_Z.has(z)); kit.stone.addMM(-62, 0, z - w, 92, 0.05, z + w, MAIN_Z.has(z) ? 0xe3cba4 : 0xd6bc94, 0, 0.05); }
    kit.stone.addMM(-5, 0, 62, 5, 0.05, 92, 0xe3cba4, 0, 0.05);                 // approach from the south
    kit.stone.addMM(-96, 0, -4.5, -62, 0.05, 4.5, 0xe3cba4, 0, 0.05);            // the avenue climbs towards the Citadel
    // covered brick drains run along both edges of the main streets and one side of each lane
    const drain = (x0, z0, x1, z1) => kit.accent.addMM(x0, 0.05, z0, x1, 0.1, z1, 0x3a2a20, 0, 0.1);
    for (const x of XL) {
      const w = hw(MAIN_X.has(x));
      if (MAIN_X.has(x)) { drain(x - w + 0.5, -62, x - w + 0.9, 62); drain(x + w - 0.9, -62, x + w - 0.5, 62); } else drain(x + w - 0.6, -62, x + w - 0.3, 62);
    }
    for (const z of ZL) { const w = hw(MAIN_Z.has(z)); if (MAIN_Z.has(z)) { drain(-62, z - w + 0.5, 92, z - w + 0.9); drain(-62, z + w - 0.9, 92, z + w - 0.5); } else drain(-62, z + w - 0.6, 92, z + w - 0.3); }
    for (const x of [-60, 0, 60]) for (let z = -54; z <= 54; z += 12) for (const s of [-1, 1]) kit.stone.add(x + s * 3.8, 0.1, z, 0.7, 0.06, 0.7, 0xc9b99a, 0, 0.05, R); // inspection covers

    // ============ the planned blocks of houses (two rows per block, facing the streets) ============
    const reserved = [[HOUSE.x0 - 2, HOUSE.z0 - 2, HOUSE.x1 + 2, HOUSE.z1 + 2], [33, 4.5, 42, 12.5], [-28, 31.5, -19, 39.5]];
    const clash = (a) => reserved.some((r) => a[0] < r[2] && a[2] > r[0] && a[1] < r[3] && a[3] > r[1]);
    this.blocks = [];
    for (let i = 0; i < XL.length - 1; i++) for (let j = 0; j < ZL.length - 1; j++) {
      const x0 = XL[i] + hw(MAIN_X.has(XL[i])) + 0.4, x1 = XL[i + 1] - hw(MAIN_X.has(XL[i + 1])) - 0.4;
      const z0 = ZL[j] + hw(MAIN_Z.has(ZL[j])) + 0.4, z1 = ZL[j + 1] - hw(MAIN_Z.has(ZL[j + 1])) - 0.4;
      this.blocks.push([x0, z0, x1, z1]);
      const d = (z1 - z0) / 2 - 0.25;
      for (const [zc, rot] of [[z0 + d / 2, Math.PI], [z1 - d / 2, 0]]) {
        let x = x0;
        while (x < x1 - 5.5) {
          let w = rnd(7, 10); if (x + w > x1 - 4) w = x1 - x;
          if (!clash([x, zc - d / 2, x + w, zc + d / 2])) kit.house({ x: x + w / 2, z: zc, w, d, h: rnd(3.5, 4.6), rot, mat: R() < 0.2 ? 'plaster' : 'brick', upper: R() < 0.12, collide: true });
          x += w + 0.35;
        }
      }
    }

    // ============ wells (brick rings round dark water) ============
    const brick = makeBrickMaterial(), wellMeshes = [];
    const makeWell = (x, y, z, r = 0.95) => {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, 0.95, 24, 1, true), brick); ring.material.side = THREE.DoubleSide; ring.position.set(x, y + 0.47, z); ring.castShadow = ring.receiveShadow = true;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.12, 8, 24), brick); rim.rotation.x = Math.PI / 2; rim.position.set(x, y + 0.95, z);
      const water = new THREE.Mesh(new THREE.CircleGeometry(r * 0.95, 20), new THREE.MeshBasicMaterial({ color: 0x0b1a22 })); water.rotation.x = -Math.PI / 2; water.position.set(x, y + 0.3, z);
      this.add(ring); this.add(rim); this.add(water); g.addBlocker(x - r - 0.1, x + r + 0.1, z - r - 0.1, z + r + 0.1);
      kit.stone.add(x, y + 0.04, z, r * 3.2, 0.08, r * 3.2, 0xd8c8a8, 0, 0.05, R);                           // stone apron round the well
    };
    makeWell(37.5, 0, 8.5); makeWell(-23.5, 0, 35.5);
    for (const [x, z] of [[34.4, 11], [40.6, 6.2], [-26.4, 38], [-20.6, 33]]) potsAll.push([x, 0, z, 1.0]);

    // ============ the one explorable house ============
    this.buildHouse(kit, g, potsAll, makeWell, R);

    // ============ the Citadel: a raised mound to the west ============
    this.buildCitadel(kit, g, R, rnd);

    // ============ street life & scenery ============
    this.add(createTrees([...scatter(16, [-150, 120, -140, -78], { seed: 3 }), ...scatter(14, [-110, 130, 80, 140], { seed: 4, avoid: [[-8, 8, 60, 140]] }), ...scatter(10, [96, 130, -60, 70], { seed: 5 })], { uTime: this.uTime, seed: 9 }));
    const ridge = createRidge({ width: 1400, height: 70, color: 0x9a8fb0, seed: 8 }); ridge.position.set(0, 0, -560); this.add(ridge);
    [[-4.4, 20], [4.4, -20], [-4.4, -44], [4.4, 50], [26, 3], [-4.4, 60], [4.4, 60], [4.4, 30], [-4.4, 8], [4.4, -6]].forEach(([x, z]) => this.add(createLamp({ lamps: this.lamps, x, y: 0, z, light: true })));
    // more street lamps (glow only) along the main streets and lanes so the grid reads at night
    for (const [x, z] of [[-64.4, 20], [-55.6, -20], [55.6, 20], [64.4, -20], [55.6, 50], [-28.4, 3], [31.6, -3], [-28.4, -40], [31.6, 40], [-30, 28.4], [30, -28.4], [60, 3], [-60, -3], [12, 3], [-12, -3], [45, 3], [-45, -3], [75, 3], [-75, -3]]) this.add(createLamp({ lamps: this.lamps, x, y: 0, z, light: false }));
    for (const [x, z, ci] of [[-4.6, 64, 0], [4.6, 64, 1], [-4.6, 2, 3], [4.6, 2, 4]]) { const b = createBanner({ uTime: this.uTime, colors: [PALETTE.cloth[ci], PALETTE.ochre, PALETTE.turquoise, PALETTE.indigo], poleH: 4.4 }); b.position.set(x, 0, z); this.add(b); }
    this.add(createPots(potsAll));
    kit.build(this.root);
    const routes = [[[-3, 60], [-3, -58]], [[3, -58], [3, 56]], [[-58, 2], [88, 2]], [[88, -2], [-58, -2]], [[28, 56], [28, -56]], [[-28, -56], [-28, 56]], [[60, 2], [60, -50]], [[-62, 30], [-62, -30]], [[-1, 14], [-1, -30]], [[88, 28.6], [32, 28.6]]];
    routes.forEach((r, i) => { const p = randomPerson(R, { carry: i % 4 === 0 }); this.add(p); walkers.push(new Walker(p, r, { speed: 0.5 + R() * 0.5, groundFn: (x, z) => g.height(x, z) })); });
    const birds = createBirds(10, { center: [0, 45, 0], radius: 90, spread: 14, seed: 5 }); this.add(birds.group, (dt, t) => birds.update(dt, t));
    const dust = createDust({ count: 260, box: 40, height: 12 }); this.add(dust.points, (dt) => dust.update(dt, this.app.camera.position, 0.7));
    this.updaters.push((dt) => walkers.forEach((w) => w.update(dt)));
    // name labels fade in as you get close, so the street is not cluttered from afar
    this.updaters.push(() => {
      const cp = this.app.camera.position, inside = inHouse(cp), maxD = inside ? 12 : 30;
      for (const p of this.pois) {
        const d = p.lab.position.distanceTo(cp), indoor = INSIDE_IDS.has(p.id);
        const show = this.mode !== 'overview' && d < maxD && indoor === inside;      // inside: only house labels; outside: only street labels
        p.lab.visible = show; if (p.hot) p.hot.g.visible = indoor === inside;           // markers follow the same rule
        p.lab.material.opacity = Math.max(0, Math.min(0.95, (maxD - d) / 8));
        const k = Math.max(0.28, Math.min(1.1, d / 15)); p.lab.scale.set(6 * k, 1.1 * k, 1);
      }
    });

    // ============ the guide ============
    this.guide = new Artisan(new THREE.Vector3(2.4, 0, 58), { heading: Math.PI, cloth: PALETTE.lapis, sash: PALETTE.ochre, band: PALETTE.carnelian, skin: PALETTE.skin[2] });
    this.guide.speed = 3.2;
    this.add(this.guide.root, (dt, t) => this.guide.update(dt, t));
    this.guide.root.userData.dispose = () => {};

    // ============ points of interest: hotspots, labels, highlights ============
    const box = (cx, cy, cz, sx, sy, sz) => [cx, cy, cz, sx, sy, sz];
    const POI = (id, pos, color, hl, extra = {}) => {
      const d = POIS[id];
      const hot = this.hotspots.add({ id, position: new THREE.Vector3(...pos), color, radius: extra.radius ?? 4.2, size: 1.0, onActivate: () => this.onPoi(id) });
      const lab = this.makeLabel(d.title, color); lab.position.set(pos[0], pos[1] + 1.0, pos[2]); this.add(lab);
      this.pois.push({ id, hl, color, stand: extra.stand, hot, lab });
    };
    POI('mainStreet', [0, 2.4, 40], PALETTE.ochre, [box(0, 0.2, 0, 9, 0.4, 124)], { stand: [0, 40] });
    POI('lanes', [30, 2.4, 20], PALETTE.turquoise, [box(30, 0.2, 0, 3.2, 0.4, 124), box(15, 0.2, 30, 154, 0.4, 3.2)], { stand: [30, 20] });
    POI('houses', [-15, 3.2, 7.6], PALETTE.terracotta, [box(-15, 2.2, 14, 26, 4.4, 12)], { stand: [-15, 0] });
    POI('streetWell', [37.5, 2.6, 8.5], PALETTE.lapis, [box(37.5, 0.6, 8.5, 2.6, 1.3, 2.6)], { stand: [36, 0], radius: 3.6 });
    POI('drains', [4.2, 1.6, 22], PALETTE.carnelian, [box(3.7, 0.15, 0, 0.9, 0.3, 124), box(-3.7, 0.15, 0, 0.9, 0.3, 124)], { stand: [0, 22], radius: 3.2 });
    POI('houseDoor', [3.8, 2.6, DOOR_Z], PALETTE.madder, [box(15, 2, 43, 18, 4, 18)], { stand: [0, DOOR_Z], radius: 3.4 });
    POI('courtyard', [15, 2.2, 41.4], PALETTE.ochre, [box(15, 0.1, 43, 6, 0.3, 6)], { radius: 3.4 });
    POI('houseWell', [15, 2.0, 44.2], PALETTE.lapis, [box(15, 0.5, 43, 2.2, 1.1, 2.2)], { radius: 1.6 });
    POI('rooms', [21, 2.4, 43], PALETTE.terracotta, [box(21, 1.8, 43, 5.4, 3.6, 5.4), box(15, 1.8, 37, 5.4, 3.6, 5.4)], { radius: 3.0 });
    POI('kitchen', [15, 2.2, 49], PALETTE.bronze, [box(15, 1.8, 49, 5.4, 3.6, 5.4)], { radius: 2.8 });
    POI('bath', [9, 2.2, 49.2], PALETTE.turquoise, [box(9, 0.2, 49, 5.4, 0.5, 5.4), box(4.6, 0.15, 49, 2.6, 0.3, 0.8)], { radius: 2.8 });
    this.hotspots.items.forEach((h) => { const p = this.pois.find((q) => q.id === h.id); if (p) p.hot = h; });

    // ============ overview (Citadel vs Lower Town): coloured regions + labels, hidden until opened ============
    this.buildOverviewMarkers();

    // ============ UI ============
    const ui = document.getElementById('ui');
    this.dlg = new DialogueBox(ui);
    this.objective = el('div', { id: 'objective' }); ui.append(this.objective);
    this.guideBtn = el('button', { id: 'guide-btn', class: 'btn primary', onclick: () => this.guideMenu() }, '💬 Ask the guide');
    ui.append(this.guideBtn);
    this.overview = new CityOverview(ui, { onTab: (t) => this.overviewTab(t), onClose: () => this.closeOverview() });
    this._dyk = this.app.data.ui.didYouKnow; this.app.data.ui.didYouKnow = 'The guide adds';
    this.setObjective('Walk up to the guide at the end of Main Street');
    this.debug = { skip: () => { this.started = true; this.setObjective(''); this.guide.pos.set(0, 0, 50); this.freeRoam(); }, menu: () => this.guideMenu(), overview: () => this.openOverview(), house: () => this.houseTour(), explain: (id) => this.explain(id), tour: () => this.runTour() };
  }

  // ---------------------------------------------------------------- the explorable house
  buildHouse(kit, g, pots, makeWell, R) {
    const { x0, x1, z0, z1 } = HOUSE, H = 3.6, T = 0.5, rnd = (a, b) => a + R() * (b - a);
    const tint = () => [0xffffff, 0xf4d8c8, 0xe6b8a0][Math.floor(R() * 3)];
    const seg = (a, b, fn) => { if (b - a > 0.05) fn(a, b); };
    const hwall = (z, a0, a1, gaps = [], h = H) => { let c = a0; for (const [ga, gb] of gaps) { seg(c, ga, (p, q) => kit.box('brick', (p + q) / 2, h / 2, z, q - p, h, T, { tint: tint(), collide: true })); kit.box('brick', (ga + gb) / 2, (2.5 + h) / 2, z, gb - ga, h - 2.5, T, { tint: tint() }); c = gb; } seg(c, a1, (p, q) => kit.box('brick', (p + q) / 2, h / 2, z, q - p, h, T, { tint: tint(), collide: true })); };
    const vwall = (x, a0, a1, gaps = [], h = H) => { let c = a0; for (const [ga, gb] of gaps) { seg(c, ga, (p, q) => kit.box('brick', x, h / 2, (p + q) / 2, T, h, q - p, { tint: tint(), collide: true })); kit.box('brick', x, (2.5 + h) / 2, (ga + gb) / 2, T, h - 2.5, gb - ga, { tint: tint() }); c = gb; } seg(c, a1, (p, q) => kit.box('brick', x, h / 2, (p + q) / 2, T, h, q - p, { tint: tint(), collide: true })); };
    const door = (c) => [c - 0.8, c + 0.8];
    // outer walls: street door on the west side; the bathing drain passes through a low opening
    vwall(x0, z0, z1, [door(DOOR_Z), [48.85, 49.15]]); kit.box('brick', x0, 1.6, 49, T, 2.6, 0.3, { tint: 0xe6b8a0, collide: true });
    kit.box('wood', x0 - 0.05, 1.4, DOOR_Z - 0.95, 0.2, 2.8, 0.2, { tint: 0x8a5a3a }); kit.box('wood', x0 - 0.05, 1.4, DOOR_Z + 0.95, 0.2, 2.8, 0.2, { tint: 0x8a5a3a }); kit.box('accent', x0 - 0.2, 2.9, DOOR_Z, 0.18, 0.22, 2.4, { tint: PALETTE.lapis, vary: 0.04 });
    kit.stone.add(x0 - 0.8, 0.07, DOOR_Z, 1.0, 0.14, 2.0, 0xe0d4b8, 0, 0.05, R);                 // threshold
    hwall(z0, x0, x1); hwall(z1, x0, x1); vwall(x1, z0, z1);
    // inner walls round the courtyard (centre cell) and between rooms, each with a doorway
    hwall(40, x0, 12, []); hwall(46, x0, 12, [door(9)]);                                        // entry hall: north, south (to bathing room)
    vwall(12, 40, 46, [door(DOOR_Z)]);                                                          // entry hall -> courtyard
    hwall(40, 12, 18, [door(15)]); hwall(46, 12, 18, [door(15)]);                               // courtyard north (living room) / south (kitchen)
    vwall(18, 40, 46, [door(DOOR_Z)]);                                                          // courtyard -> family room
    hwall(40, 18, x1, []); hwall(46, 18, x1, []);                                               // family room north / south
    vwall(12, z0, 40, []); vwall(18, z0, 40, []); vwall(12, 46, z1, []); vwall(18, 46, z1, []); // corner cells are sealed off
    // brick floors, flat roofs over every room (the courtyard stays open), parapets
    kit.brick.addMM(x0 + 0.25, 0, z0 + 0.25, x1 - 0.25, 0.06, z1 - 0.25, 0xe0b090, 0, 0.1);
    const roof = (a, b, c, d) => kit.plaster.addMM(a, H, b, c, H + 0.3, d, 0xe6c9a0, 0, 0.05);
    roof(x0 - 0.2, z0 - 0.2, x1 + 0.2, 40); roof(x0 - 0.2, 46, x1 + 0.2, z1 + 0.2); roof(x0 - 0.2, 40, 12, 46); roof(18, 40, x1 + 0.2, 46);
    const par = (a, b, c, d) => kit.brick.addMM(a, H + 0.3, b, c, H + 0.75, d, 0xd9a07c, 0, 0.08);
    par(x0 - 0.2, z0 - 0.2, x1 + 0.2, z0 + 0.1); par(x0 - 0.2, z1 - 0.1, x1 + 0.2, z1 + 0.2); par(x0 - 0.2, z0, x0 + 0.1, 40); par(x0 - 0.2, 46, x0 + 0.1, z1); par(x1 - 0.1, z0, x1 + 0.2, z1);
    // courtyard: well, oven, grinding stone, jars
    makeWell(15, 0, 43, 0.85);
    kit.box('brick', 12.9, 0.3, 40.9, 0.9, 0.6, 0.9, { tint: 0xd89878 }); kit.box('accent', 12.9, 0.62, 40.9, 0.55, 0.05, 0.55, { tint: 0x120a07, vary: 0 });     // clay oven
    kit.stone.add(17.2, 0.12, 41, 0.9, 0.24, 0.5, 0xb0a088, 0, 0.1, R);                                                                                      // grinding stone
    for (const [x, z] of [[17.3, 44.6], [17.5, 45.2], [12.8, 45.3]]) pots.push([x, 0, z, 1.2]);
    kit.accent.addMM(13.3, 0.06, 44.4, 14.3, 0.08, 45.4, 0xb89868, 0, 0.04);
    // living room (north): mats, low platform, jars
    kit.accent.addMM(13, 0.06, 35, 17, 0.08, 38, 0xc9a468, 0, 0.05); kit.accent.addMM(13.4, 0.08, 35.4, 16.6, 0.09, 36.2, PALETTE.madder, 0, 0.05);
    kit.box('brick', 17.2, 0.25, 34.8, 1.2, 0.5, 1.4, { tint: 0xe6b8a0 }); for (const [x, z] of [[12.8, 34.7], [13.2, 34.5], [17.3, 38.6]]) pots.push([x, 0, z, 1.0]);
    // family room (east): mats, big storage jars, baskets, a loom frame
    kit.accent.addMM(19, 0.06, 41, 23, 0.08, 45, 0xc9a468, 0, 0.05); kit.accent.addMM(19.4, 0.08, 41.4, 22.6, 0.09, 42.4, PALETTE.lapis, 0, 0.05);
    for (const z of [41, 42.2, 43.4]) pots.push([23.3, 0, z, 1.5]); for (const [x, z] of [[19.5, 45.4], [20.6, 45.5]]) kit.box('accent', x, 0.3, z, 0.7, 0.6, 0.7, { tint: 0xc4985a, vary: 0.1 });
    kit.box('accent', 20.5, 1.0, 40.6, 2.2, 0.08, 0.1, { tint: 0x8a5a3a }); kit.box('accent', 19.4, 0.5, 40.6, 0.1, 1.0, 0.1, { tint: 0x8a5a3a }); kit.box('accent', 21.6, 0.5, 40.6, 0.1, 1.0, 0.1, { tint: 0x8a5a3a });
    // kitchen (south): hearth, grinding stones, jars and baskets
    kit.box('brick', 17.2, 0.35, 48.8, 1.2, 0.7, 1.2, { tint: 0xd89878, collide: true }); kit.box('accent', 17.2, 0.72, 48.8, 0.9, 0.05, 0.9, { tint: 0x120a07, vary: 0 });
    const hearth = makeGlowSprite(0xff7a2a, 1.1, 0.8); hearth.position.set(17.2, 0.95, 48.8); this.add(hearth); this.updaters.push((dt, t) => { hearth.material.opacity = 0.6 + Math.sin(t * 8) * 0.12; });
    kit.stone.add(13, 0.12, 50.8, 1.0, 0.24, 0.6, 0xb0a088, 0, 0.1, R); for (const [x, z] of [[12.6, 47.2], [13.5, 47.2], [14.4, 47.3], [14.2, 51.2]]) pots.push([x, 0, z, 1.3]);
    kit.box('accent', 16.4, 0.25, 50.9, 0.8, 0.5, 0.8, { tint: 0xc4985a, vary: 0.1 });
    // bathing room (south-west): raised brick bathing platform, a shallow channel, water jars and the drain out to the street
    kit.box('brick', 8.6, 0.1, 49, 2.6, 0.2, 2.6, { tint: 0xe6b8a0 });
    kit.accent.addMM(8.0, 0.2, 47.6, 9.2, 0.23, 50.4, 0x6a4a34, 0, 0.05);
    kit.accent.addMM(7.0, 0.07, 48.85, 9.0, 0.11, 49.15, 0x24160f, 0, 0.1);                       // channel in the floor
    kit.accent.addMM(x0 - 0.3, 0.07, 48.85, 7.0, 0.11, 49.15, 0x24160f, 0, 0.1);                  // runs out through the wall...
    kit.accent.addMM(4.0, 0.06, 48.85, x0 - 0.3, 0.1, 49.15, 0x24160f, 0, 0.1);                   // ...across the street edge...
    kit.accent.addMM(3.5, 0.06, 46, 3.9, 0.1, 52, 0x24160f, 0, 0.1);                             // ...and into the street drain
    for (const [x, z] of [[10.9, 47.0], [11.2, 47.7], [10.8, 51.2]]) pots.push([x, 0, z, 1.1]);
    kit.accent.addMM(6.6, 0.06, 46.6, 7.4, 0.08, 47.4, 0x6a4a34, 0, 0.05);
    // warm light in the rooms
    for (const [x, y, z, i] of [[9, 2.6, 43, 7], [15, 2.6, 37.2, 6], [21, 2.6, 43, 6], [15, 2.6, 49.2, 6], [9, 2.6, 49.2, 5]]) { const L = new THREE.PointLight(0xffd9a0, i, 9, 1.5); L.position.set(x, y, z); this.add(L); }
    this.add(this._lampAt(15, 41.8)); this.add(this._lampAt(9.4, 41.2));
    // a resident grinding grain in the courtyard
    const person = randomPerson(R); person.position.set(17.2, 0, 41.9); person.rotation.y = Math.PI; this.add(person);
    this.updaters.push((dt, t) => { const u = person.userData; u.armR.rotation.x = -1.0 + Math.sin(t * 4) * 0.3; u.armL.rotation.x = -0.9 + Math.sin(t * 4 + 1.5) * 0.25; });
  }
  _lampAt(x, z) { const l = createLamp({ lamps: this.lamps, x, y: 0, z, light: false }); return l; }

  // ---------------------------------------------------------------- the Citadel mound
  buildCitadel(kit, g, R, rnd) {
    const { x0, x1, z0, z1, top } = CIT, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, W = x1 - x0, D = z1 - z0, A = 0xf0c8b4;
    kit.box('brick', cx, POOL.floor / 2, cz, W, POOL.floor, D, { tint: A, vary: 0 });
    for (const [a0, b0, a1, b1] of [[x0, z0, POOL.x0, z1], [POOL.x1, z0, x1, z1], [POOL.x0, POOL.z1, POOL.x1, z1], [POOL.x0, z0, POOL.x1, POOL.z0]]) kit.brick.addMM(a0, POOL.floor, b0, a1, top, b1, A, 0, 0.04);
    for (const [px, pz, sx, sz] of [[cx, z1 + 0.6, W + 2, 1.2], [cx, z0 - 0.6, W + 2, 1.2], [x0 - 0.6, cz, 1.2, D], [x1 + 0.6, cz, 1.2, D]]) kit.stone.add(px, 0.5, pz, sx, 1.0, sz, 0xffffff, 0, 0.08, R);
    g.addPlatform(x0, x1, z0, z1, top); g.addHole(POOL.x0, POOL.x1, POOL.z0, POOL.z1, POOL.floor); g.addBlocker(POOL.x0 + 0.5, POOL.x1 - 0.5, POOL.z0, POOL.z1);
    kit.stone.addMM(x0, top, z0, x1, top + 0.05, z1, 0xe8d8b8, 0, 0.02);
    for (const [a, b, c, d] of [[POOL.x0 - 0.5, POOL.z0 - 0.5, POOL.x1 + 0.5, POOL.z0], [POOL.x0 - 0.5, POOL.z1, POOL.x1 + 0.5, POOL.z1 + 0.5], [POOL.x0 - 0.5, POOL.z0, POOL.x0, POOL.z1], [POOL.x1, POOL.z0, POOL.x1 + 0.5, POOL.z1]]) kit.stone.addMM(a, top, b, c, top + 0.14, d, 0xf4ead8, 0, 0.05);
    kit.stone.addMM(POOL.x0, POOL.floor, POOL.z0, POOL.x1, POOL.floor + 0.08, POOL.z1, 0x3a4a52, 0, 0.1);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(POOL.x1 - POOL.x0, POOL.z1 - POOL.z0).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0b9da3, transparent: true, opacity: 0.85, roughness: 0.15, metalness: 0.1 })); water.position.set((POOL.x0 + POOL.x1) / 2, top - 0.9, 0); this.add(water);
    kit.colonnade({ x1: POOL.x0 - 3, z1: POOL.z0 - 3.5, x2: POOL.x1 + 3, z2: POOL.z0 - 3.5, y0: top, h: 3.2, spacing: 3 }); kit.colonnade({ x1: POOL.x0 - 3, z1: POOL.z1 + 3.5, x2: POOL.x1 + 3, z2: POOL.z1 + 3.5, y0: top, h: 3.2, spacing: 3 });
    kit.brick.addMM(POOL.x0 - 3.4, top + 3.6, POOL.z0 - 4, POOL.x1 + 3.4, top + 4.0, POOL.z0 - 3, 0xd8a890, 0, 0.05); kit.brick.addMM(POOL.x0 - 3.4, top + 3.6, POOL.z1 + 3, POOL.x1 + 3.4, top + 4.0, POOL.z1 + 4, 0xd8a890, 0, 0.05);
    // a large ribbed building to the north-west (often called the Granary), towers and a few houses
    for (let i = 0; i < 6; i++) kit.brick.addMM(x0 + 6, top, z0 + 4 + i * 2.4, x0 + 26, top + 1.8, z0 + 5.6 + i * 2.4, 0xf0c0a8, 0, 0.1);
    kit.accent.addMM(x0 + 5.6, top + 1.8, z0 + 3.6, x0 + 26.4, top + 2.1, z0 + 19, 0xf2d6b8, 0, 0.04);
    for (const [x, z] of [[x0 + 3, z0 + 3], [x1 - 3, z0 + 3], [x0 + 3, z1 - 3], [x1 - 3, z1 - 3]]) { kit.box('brick', x, top + 2.6, z, 4.4, 5.2, 4.4, { tint: 0xf0b8a0, collide: true }); kit.box('plaster', x, top + 5.5, z, 4.9, 0.6, 4.9, { tint: 0xdbe8f4 }); }
    for (const [x, z, w, d] of [[x0 + 12, z1 - 9, 9, 7], [x0 + 30, z1 - 8, 9, 7], [x0 + 14, 1, 8, 7], [x0 + 44, 12, 7, 8], [x0 + 44, -14, 7, 8]]) kit.house({ x, z, w, d, h: rnd(4, 5.2), y0: top, rot: R() < 0.5 ? 0 : Math.PI, mat: R() < 0.5 ? 'plaster' : 'brick', collide: true });
    // the stair up from the avenue, and a banner
    kit.stairs({ x: -85, z: 0, y0: 0, width: 6, steps: 24, rise: top / 24, run: 0.42, dir: '-x', tint: 0xffe0cc });
    const b = createBanner({ uTime: this.uTime, colors: [PALETTE.cloth[3], PALETTE.ochre, PALETTE.turquoise, PALETTE.indigo], poleH: 4.6 }); b.position.set(x1 - 3, top, 8); this.add(b);
  }

  // ---------------------------------------------------------------- labels, highlights, overview markers
  makeLabel(text, color = 0xffffff) { return makeLabel(text, color); }
  /** Pulsing glow over the structure being explained. */
  highlight(boxes, color = 0xffd070, secs = 7) {
    this.clearHighlight();
    for (const [cx, cy, cz, sx, sy, sz] of boxes) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
      m.position.set(cx, cy, cz); m.renderOrder = 5; this.root.add(m); this.highlights.push(m);
      gsap.to(m.material, { opacity: 0.35, duration: 0.5 });
    }
    clearTimeout(this._hlT); this._hlT = setTimeout(() => this.clearHighlight(), secs * 1000);
  }
  clearHighlight() {
    for (const m of this.highlights) { const mm = m; gsap.to(mm.material, { opacity: 0, duration: 0.4, onComplete: () => { mm.removeFromParent(); mm.geometry.dispose(); mm.material.dispose(); } }); }
    this.highlights = [];
  }
  buildOverviewMarkers() {
    this.ov = new THREE.Group(); this.ov.visible = false; this.root.add(this.ov);
    const flat = (x0, z0, x1, z1, y, color) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
      m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); m.renderOrder = 4; this.ov.add(m); return m;
    };
    this.regions = { citadel: flat(CIT.x0, CIT.z0, CIT.x1, CIT.z1, CIT.top + 0.2, 0xffc23a), lower: flat(-62, -62, 92, 62, 0.25, 0x1fa6a0) };
    this.streetMarks = [];
    for (const x of XL) { const w = hw(MAIN_X.has(x)); this.streetMarks.push(flat(x - w, -62, x + w, 62, 0.4, 0xffc23a)); }
    for (const z of ZL) { const w = hw(MAIN_Z.has(z)); this.streetMarks.push(flat(-62, z - w, 92, z + w, 0.41, 0xffc23a)); }
    this.houseMarks = this.blocks.map(([x0, z0, x1, z1]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 5.2, z1 - z0), new THREE.MeshBasicMaterial({ color: 0xff6a3a, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending })); m.position.set((x0 + x1) / 2, 2.6, (z0 + z1) / 2); m.renderOrder = 5; this.ov.add(m); return m; });
    const L = (t, p, c, s = 1) => { const l = this.makeLabel(t, c); l.position.set(...p); l.scale.set(30 * s, 5.6 * s, 1); this.ov.add(l); return l; };
    this.ovLabels = { citadel: L('The Citadel (raised mound)', [-122, 24, 0], 0xffc23a, 0.9), lower: L('Lower Town', [15, 22, 0], 0x1fa6a0, 1.2), bath: L('Great Bath', [-125, 14, 0], 0xffe0a0, 0.7), streets: L('Main streets and lanes', [30, 14, 36], 0xffc23a, 0.8), houses: L('Houses and courtyards', [-30, 18, -30], 0xff9a6a, 0.8) };
    Object.values(this.ovLabels).forEach((l) => { l.visible = false; });
  }

  // ---------------------------------------------------------------- guide helpers
  setObjective(t) { this.objective.textContent = t || ''; this.objective.classList.toggle('show', !!t); }
  say(text, label) { return this.dlg.say(GUIDE, text, label); }
  async sayAll(lines, lastLabel) { for (let i = 0; i < lines.length; i++) await this.say(lines[i], i === lines.length - 1 && lastLabel ? lastLabel : undefined); }
  lock(on) { this.app.controls.enabled = !on; }
  /** Route along street centre-lines only (no pathfinding): out to a street, along the grid, then to the stand point. */
  streetRoute(from, to) {
    const onLine = (p) => (Math.abs(p.x - nearest(XL, p.x)) <= Math.abs(p.z - nearest(ZL, p.z)) ? [nearest(XL, p.x), p.z] : [p.x, nearest(ZL, p.z)]);
    const node = (a) => (XL.includes(a[0]) ? [a[0], nearest(ZL, a[1])] : [nearest(XL, a[0]), a[1]]);
    const pts = [];
    let A = from;
    if (inHouse(from)) { pts.push([9, DOOR_Z], [3, DOOR_Z], [0, DOOR_Z]); A = { x: 0, z: DOOR_Z }; }
    const a = onLine(A), na = node(a), b = to, nb = node(b);
    const vert = (q) => XL.includes(q[0]), horz = (q) => ZL.includes(q[1]);
    if (vert(a) && vert(b) && a[0] === b[0]) pts.push(a, b);
    else if (horz(a) && horz(b) && a[1] === b[1]) pts.push(a, b);
    else if (vert(a) && horz(b)) pts.push(a, [a[0], b[1]], b);
    else if (horz(a) && vert(b)) pts.push(a, [b[0], a[1]], b);
    else pts.push(a, na, [na[0], nb[1]], nb, b);
    return pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 0.1);
  }
  guideTo(x, z, { into = null } = {}) {
    const g = this.guide; const path = this.streetRoute({ x: g.pos.x, z: g.pos.z }, [x, z]);
    if (inHouse(g.pos)) path.unshift(...roomPath(roomOf(g.pos), 'hall'));       // leave through the rooms and doorways, not the walls
    if (into) path.push(...into);
    return g.walkTo(path);
  }
  playerNear(x, z, r = 9) { const c = this.app.camera.position; return Math.hypot(c.x - x, c.z - z) < r; }
  async waitPlayerNear(x, z, r = 12, maxMs = 8000) {
    const t0 = performance.now();
    while (!this.dead && !this.playerNear(x, z, r) && performance.now() - t0 < maxMs) await wait(300);
  }
  async guideSpeaks(lines) { this.guide.faceToward(this.app.camera.position); this.guide.setMode('talk'); await this.sayAll(lines); this.guide.setMode('idle'); }

  // ---------------------------------------------------------------- story and interaction
  update(dt) {
    super.update(dt);
    if (this.dead) return;
    const cam = this.app.camera.position;
    if (!this.started && cam.distanceTo(this.guide.pos) < 10) { this.started = true; this.welcome(); }
    if (this.started && !this.guide.walk && this.guide.mode === 'idle' && !this.busy) this.guide.faceToward(cam);   // always turn to the visitor
    // the guide keeps the visitor company while they explore on their own
    if (this.started && !this.busy && this.mode === 'free' && !this.guide.walk && (this._follow = (this._follow ?? 0) - dt) < 0) {
      this._follow = 2.5;
      const inside = inHouse(cam), gIn = inHouse(this.guide.pos);
      if (inside && !gIn) { this.guideTo(0, DOOR_Z, { into: ENTER }); }
      else if (inside) {
        // keep the visitor company: move to whichever room they are in (the courtyard while they are in the entry hall)
        this._follow = 0.8;
        const want = roomOf(cam) === 'hall' ? 'court' : roomOf(cam), have = roomOf(this.guide.pos);
        if (want !== have) this.guide.walkTo(roomPath(have, want));
      } else if (!inside) {
        const tgt = [nearest(XL, cam.x) === 0 && Math.abs(cam.x) < 8 ? 0 : (Math.abs(cam.x - nearest(XL, cam.x)) < 6 ? nearest(XL, cam.x) : cam.x), cam.z];
        if (cam.x < -62) return;
        if (Math.hypot(this.guide.pos.x - cam.x, this.guide.pos.z - cam.z) > 16 || gIn) { const p = Math.abs(cam.x - nearest(XL, cam.x)) <= Math.abs(cam.z - nearest(ZL, cam.z)) ? [nearest(XL, cam.x), cam.z] : [cam.x, nearest(ZL, cam.z)]; this.guideTo(Math.max(-60, Math.min(90, p[0] + 2.5)), Math.max(-58, Math.min(58, p[1] + 3)), {}); }
        void tgt;
      }
    }
  }
  async welcome() {
    this.setObjective(''); this.lock(true); this.busy = true;
    const g = this.guide; g.faceToward(this.app.camera.position); await wait(300); g.setMode('wave'); await wait(900); g.setMode('talk');
    await this.sayAll(SCRIPT.welcome); g.setMode('idle');
    this.busy = false; await this.guideMenu(true);
  }
  /** The guide's menu: always available from the button, so nothing has to be done in a fixed order. */
  async guideMenu(first = false) {
    if (this.busy && !first) return;
    this.busy = true; this.lock(true); this.clearHighlight(); this.app.ui.panel.hide(); this.hotspots.setEnabled(false);
    this.guide.faceToward(this.app.camera.position); this.guide.setMode('talk');
    const pick = await this.dlg.ask(GUIDE, SCRIPT.menuQuestion, [
      { value: 'tour', label: SCRIPT.menu.tour }, { value: 'house', label: SCRIPT.menu.house }, { value: 'overview', label: SCRIPT.menu.overview }, { value: 'free', label: SCRIPT.menu.free }]);
    this.dlg.hide(); this.guide.setMode('idle'); this.busy = false;
    if (pick === 'tour') return this.runTour();
    if (pick === 'house') return this.houseTour();
    if (pick === 'overview') return this.openOverview();
    return this.freeRoam();
  }
  freeRoam() { this.busy = false; this.mode = 'free'; this.lock(false); this.hotspots.setEnabled(true); this.guide.setMode('idle'); this.setObjective('Explore freely: walk to a glowing marker, or ask the guide'); setTimeout(() => this.mode === 'free' && this.setObjective(''), 7000); }

  /** A guided tour: the guide walks ahead along the streets; at each stop they explain and the structure glows. */
  async runTour() {
    this.busy = true; this.mode = 'tour'; this.hotspots.setEnabled(false); this.lock(false); this.app.ui.panel.hide();
    for (const id of ['mainStreet', 'lanes', 'houses', 'streetWell', 'drains']) {
      if (this.dead || this.mode !== 'tour') return;
      const poi = this.pois.find((p) => p.id === id), [sx, sz] = poi.stand;
      this.setObjective('Follow the guide'); this.guide.setMode('idle');
      await this.guideTo(sx, sz); await this.waitPlayerNear(sx, sz, 14);
      if (this.mode !== 'tour') return;
      this.setObjective(''); this.lock(true);
      const d = POIS[id]; this.highlight(poi.hl, poi.color, 12);
      this.guide.point(new THREE.Vector3(...(id === 'drains' ? [3.7, 0, sz] : id === 'houses' ? [-15, 0, 12] : id === 'streetWell' ? [37.5, 0, 8.5] : [sx, 0, sz - 12])));
      this.app.ui.panel.show({ title: d.title, text: d.text, didYouKnow: d.guide }, '#' + new THREE.Color(poi.color).getHexString());
      this.guide.faceToward(this.app.camera.position); this.guide.setMode('talk');
      await this.say(d.text, id === 'drains' ? 'Done ›' : 'Next stop ›'); this.guide.setMode('idle'); this.dlg.hide(); this.lock(false);
    }
    this.clearHighlight(); this.app.ui.panel.hide(); this.mode = 'free';
    this.busy = false; this.guide.faceToward(this.app.camera.position);
    const more = await (async () => { this.busy = true; this.lock(true); const v = await this.dlg.ask(GUIDE, 'That is how the city is planned. What would you like next?', [{ value: 'house', label: SCRIPT.menu.house }, { value: 'overview', label: SCRIPT.menu.overview }, { value: 'free', label: SCRIPT.menu.free }]); this.dlg.hide(); this.busy = false; return v; })();
    if (more === 'house') return this.houseTour(); if (more === 'overview') return this.openOverview(); return this.freeRoam();
  }

  /** The guide leads to the door, introduces the house, then waits in the courtyard. */
  async houseTour() {
    this.busy = true; this.mode = 'tour'; this.hotspots.setEnabled(false); this.lock(false); this.app.ui.panel.hide(); this.clearHighlight();
    if (!inHouse(this.app.camera.position)) {
      this.setObjective('Follow the guide to the house'); await this.guideTo(0, DOOR_Z); await this.waitPlayerNear(2.5, DOOR_Z, 14);
    }
    this.setObjective(''); this.lock(true);
    const poi = this.pois.find((p) => p.id === 'houseDoor'); this.highlight(poi.hl, poi.color, 10);
    this.guide.point(new THREE.Vector3(8, 0, DOOR_Z)); await wait(300);
    await this.sayAll(SCRIPT.houseIntro);
    this.houseIntroDone = true; this.dlg.hide(); this.lock(false); this.guide.setMode('idle');
    this.setObjective('Walk through the doorway and explore the house');
    this.mode = 'free'; this.busy = false; this.hotspots.setEnabled(true);
    await this.guideTo(0, DOOR_Z, { into: ENTER });
    this.guide.faceToward(this.app.camera.position);
    setTimeout(() => !this.busy && this.setObjective(''), 9000);
  }

  onPoi(id) {
    if (this.busy || this.mode === 'overview') return;
    if (id === 'houseDoor' && !this.houseIntroDone) { this.houseTour(); return; }
    this.explain(id);
  }
  /** Free exploration: name + explanation in the info card, glow on the structure, the guide adds context. */
  explain(id) {
    const d = POIS[id], poi = this.pois.find((p) => p.id === id); if (!d || !poi) return;
    this.app.ui.panel.show({ title: d.title, text: d.text, didYouKnow: d.guide }, '#' + new THREE.Color(poi.color).getHexString());
    this.highlight(poi.hl, poi.color, 8); this.app.audio.blip(880);
    const g = this.guide; if (this.playerNear(g.pos.x, g.pos.z, 20)) { g.point(new THREE.Vector3(poi.hl[0][0], 0, poi.hl[0][2])); clearTimeout(this._gT); this._gT = setTimeout(() => { g.faceToward(this.app.camera.position); g.setMode('idle'); }, 3500); }
  }

  // ---------------------------------------------------------------- Citadel vs Lower Town
  async openOverview() {
    this.busy = true; this.mode = 'overview'; this.hotspots.setEnabled(false); this.app.ui.panel.hide(); this.clearHighlight(); this.lock(true); this.setObjective('');
    this.guide.faceToward(this.app.camera.position); this.guide.setMode('talk');
    await this.sayAll(SCRIPT.overviewIntro, 'Show me ›'); this.dlg.hide(); this.guide.setMode('idle');
    const c = this.app.controls; this._saved = { pos: c.pos.clone(), yaw: c.yaw, pitch: c.pitch };
    if (this.scene.fog?.density !== undefined) { this._fog0 = this.scene.fog.density; gsap.to(this.scene.fog, { density: 0.0005, duration: 1 }); }
    this.ov.visible = true; Object.values(this.ovLabels).forEach((l) => { l.visible = false; });
    this.guideBtn.style.display = 'none'; this.overview.show();
    this.overviewTab('compare');
  }
  overviewTab(tab) {
    const data = tab === 'citadel' ? OVERVIEW.citadel : tab === 'lower' ? OVERVIEW.lower : OVERVIEW.compare;
    this.overview.setTab(tab, data); this.ovTab = tab;
    const fade = (mesh, o) => gsap.to(mesh.material, { opacity: o, duration: 0.6 });
    const cit = tab !== 'lower', low = tab !== 'citadel';
    fade(this.regions.citadel, cit ? (tab === 'citadel' ? 0.55 : 0.45) : 0); fade(this.regions.lower, low ? (tab === 'lower' ? 0.3 : 0.28) : 0);
    this.streetMarks.forEach((m) => fade(m, tab === 'lower' ? 0.7 : 0)); this.houseMarks.forEach((m) => fade(m, tab === 'lower' ? 0.22 : 0));
    const L = this.ovLabels; L.citadel.visible = cit; L.bath.visible = tab === 'citadel'; L.lower.visible = low; L.streets.visible = tab === 'lower'; L.houses.visible = tab === 'lower';
    // slightly emphasise the Citadel's height by lifting its highlight, and look at it from the side
    gsap.to(this.regions.citadel.position, { y: tab === 'citadel' ? CIT.top + 1.2 : CIT.top + 0.2, duration: 0.8 });
    const views = { compare: [[-8, 150, 150], [28, 0, -4]], citadel: [[-62, 40, 66], [-100, 4, 0]], lower: [[55, 100, 112], [48, 0, 2]] };
    this.flyCamera(...views[tab]);
  }
  flyCamera(pos, look, dur = 1.8) {
    const c = this.app.controls, dx = look[0] - pos[0], dy = look[1] - pos[1], dz = look[2] - pos[2];
    const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz));
    let dyaw = yaw - c.yaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    gsap.killTweensOf(c); gsap.killTweensOf(c.pos);
    gsap.to(c.pos, { x: pos[0], y: pos[1], z: pos[2], duration: dur, ease: 'power2.inOut', onUpdate: () => { c.footY = c.pos.y - c.eye; c.apply(); } });
    gsap.to(c, { yaw: c.yaw + dyaw, pitch, duration: dur, ease: 'power2.inOut', onUpdate: () => c.apply() });
  }
  closeOverview() {
    const s = this._saved; this.overview.hide(); this.guideBtn.style.display = '';
    if (this._fog0 !== undefined && this.scene.fog) gsap.to(this.scene.fog, { density: this._fog0, duration: 1 });
    const fade = (mesh) => gsap.to(mesh.material, { opacity: 0, duration: 0.4 });
    Object.values(this.regions).forEach(fade); this.streetMarks.forEach(fade); this.houseMarks.forEach(fade); Object.values(this.ovLabels).forEach((l) => { l.visible = false; });
    gsap.to(this.regions.citadel.position, { y: CIT.top + 0.2, duration: 0.4 });
    if (s) this.flyCamera([s.pos.x, s.pos.y, s.pos.z], [s.pos.x - Math.sin(s.yaw) * 10, s.pos.y + Math.sin(s.pitch) * 10, s.pos.z - Math.cos(s.yaw) * 10], 1.6);
    setTimeout(() => {
      if (this.dead) return;
      this.ov.visible = false; if (s) { const c = this.app.controls; c.pos.copy(s.pos); c.yaw = s.yaw; c.pitch = s.pitch; c.footY = 0; c.apply(); }
      this.mode = 'free'; this.busy = false; this.lock(false); this.hotspots.setEnabled(true); this.setObjective('Back in the city. Ask the guide whenever you like.'); setTimeout(() => this.mode === 'free' && this.setObjective(''), 5000);
    }, 1700);
  }

  dispose() {
    this.dead = true; clearTimeout(this._hlT); clearTimeout(this._gT);
    gsap.killTweensOf(this.app.controls); gsap.killTweensOf(this.app.controls.pos);
    this.dlg?.dispose(); this.objective?.remove(); this.guideBtn?.remove(); this.overview?.dispose();
    if (this._dyk) this.app.data.ui.didYouKnow = this._dyk;
    this.app.controls.enabled = true;
    super.dispose();
  }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
