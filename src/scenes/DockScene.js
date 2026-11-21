import * as THREE from 'three';
import gsap from 'gsap';
import { BaseScene } from '../core/BaseScene.js';
import { BuildKit } from '../shared/builders.js';
import { PALETTE } from '../shared/palette.js';
import { rng } from '../shared/textures.js';
import { createGround, createRidge, scatter } from '../shared/nature.js';
import { createTrees, createReeds, createPots, createLamp, createBirds, createBanner, createAwning, createGrainHeap, makeGlowSprite } from '../shared/props.js';
import { createWater } from '../shared/water.js';
import { randomPerson, Walker } from '../shared/people.js';
import { makeLabel } from '../shared/labels.js';
import { el } from '../ui/dom.js';
import { DialogueBox } from '../ui/DialogueBox.js';
import { Artisan } from '../workshop/Artisan.js';
import { createBoat } from '../dock/boat.js';
import { runWeighing } from '../dock/weighActivity.js';
import { runTradeMap, MAP_URL } from '../dock/mapActivity.js';
import { createCargoItem, CARGO_KINDS } from '../dock/cargo3d.js';
import { SCRIPT, MERCHANT, MERCHANTS, FACTS, CARGO_INFO } from '../data/dockScript.js';

// ---- layout (metres). The river runs east-west north of the quay (z < -4); the visitor arrives from the south. ----
const QUAY = { x0: -52, x1: 52, z0: -4, z1: 9, top: 0.45 };
const RIVER_Z = -30, WATER_Y = 0.07;
const PIER = { x0: -2.2, x1: 2.2, z0: -26, z1: -4 };
const BOAT_A = { x: -4.2, z: -13 }, BOAT_B = { x: 4.2, z: -13 };      // either side of the pier: cargo boat, passenger boat
const CARGO_HOME = CARGO_KINDS.map((k, i) => [(i % 4) * 1.0 - 1.5, 0.45, -9.6 - Math.floor(i / 4) * 1.4]);   // goods lined up on the pier
const HOLD_SLOTS = [-1.8, -0.4, 1.0, 2.4].flatMap((z) => [[-0.5, z], [0.5, z]]);                          // set-down places in the boat (boat-local x, z)
const STATIONS = {
  cargo: { name: 'Load the boat', stand: [-6.4, 2.6], look: [-8.4, -1.4], spot: [-7.6, 2.4, 0.4], color: PALETTE.terracotta },
  weigh: { name: 'Weighing station', stand: [18, 4.4], look: [18, 0.5], spot: [18, 2.3, 3.2], color: PALETTE.ochre },
  map: { name: 'Trade routes map', stand: [-21, 7.4], look: [-20, 2.4], spot: [-21.5, 2.3, 4.6], color: PALETTE.lapis },
  journey: { name: 'River journey', stand: [0, -5.4], look: [1.8, -7.4], spot: [1.2, 1.8, -8.6], color: PALETTE.turquoise },
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * The River, the Dockyard and Dusk. A lively riverside trading area (inspired by the evidence, not a
 * confirmed Mohenjo-daro dockyard): moored boats, porters and traders, a boat-loading task, a weighing
 * station, the Harappan trade-routes map, a guided river journey, and a day-to-dusk transition.
 */
export class DockScene extends BaseScene {
  static id = 'dock';
  static accent = PALETTE.madder;
  static settings = {
    ui: 'scene', timeSlider: true,
    camera: { pos: [0, 1.7, 24], yaw: 0, pitch: 0.02, mode: 'walk', eye: 1.7, speed: 3.6 },
    lighting: {
      time: 10.5, sky: { turbidity: 3.4, rayleigh: 1.5, mie: 0.006, mieG: 0.82 }, fogDensity: 0.0032, fogTint: 0xf0dcc0,
      shadowSize: 70, azimuthOffset: 1.5, exposure: 0.58, sunBoost: 1.0, hemiBoost: 1.6, moon: 1.3, nightHemi: 1.2,
    },
    audio: { wind: 0.12, water: 0.7, birds: 0.5, crackle: 1, dock: 1, waterPos: [0, 0.2, -18] },
    look: { bloom: { strength: 0.3, threshold: 0.9, radius: 0.6 }, saturation: 1.15, contrast: 1.06, vignette: 0.3 },
    bounds: { minX: -150, maxX: 150, minZ: -84, maxZ: 64 },
  };

  async init() {
    const R = rng(91), rnd = (a, b) => a + R() * (b - a);
    const g = this.ground, kit = new BuildKit(g, 17); kit.R = R;
    const potsAll = [];
    this.dead = false; this.busy = false; this.started = false; this.visited = new Set(); this.hour = this.settings.lighting.time;
    this.dusk = 0; this.settled = false; this.journeyOn = false; this.walkers = []; this.floaters = []; this.workers = []; this.ambientBoats = [];
    this.audioSpots = { people: [], cargo: [], boats: [] };
    this.app.audio.dockSource = this;

    // ============ ground, river, quay ============
    this.add(createGround(900, 'earth'));
    const river = createWater({ width: 700, depth: 52, color: 0x0e7f93, opacity: 0.94, repeat: [70, 5], rippleRings: 10, reflect: 0.9 });
    river.group.position.set(0, WATER_Y, RIVER_Z); this.river = river;
    this.lighting.onEnv((e) => river.setEnv(e));
    this.add(river.group, (dt) => river.update(dt));
    kit.stone.addMM(QUAY.x0, 0, QUAY.z0, QUAY.x1, QUAY.top, QUAY.z1, 0xe0cfae, 0, 0.04);             // the stone quay
    kit.stone.addMM(QUAY.x0, 0.2, QUAY.z0 - 0.15, QUAY.x1, QUAY.top + 0.12, QUAY.z0 + 0.4, 0xefe2c6, 0, 0.05);   // river-edge lip
    kit.stone.addMM(-40, 0, QUAY.z1, 40, 0.05, 44, 0xd9c49c, 0, 0.05);                                // paved plaza
    kit.stone.addMM(QUAY.x0, 0, QUAY.z1 - 0.2, QUAY.x1, QUAY.top - 0.05, QUAY.z1 + 0.3, 0xcdb88e, 0, 0.06);       // step up to the quay
    g.addPlatform(QUAY.x0, QUAY.x1, QUAY.z0, QUAY.z1, QUAY.top);
    // the river is not walkable, apart from the pier
    g.addBlocker(-160, PIER.x0, -90, QUAY.z0 - 0.25); g.addBlocker(PIER.x1, 160, -90, QUAY.z0 - 0.25); g.addBlocker(PIER.x0, PIER.x1, -90, PIER.z0);
    // the pier: timber deck on posts
    kit.wood.addMM(PIER.x0, QUAY.top - 0.08, PIER.z0, PIER.x1, QUAY.top, PIER.z1 + 0.4, 0xb68a5a, 0, 0.08);
    for (let z = PIER.z1 - 1; z > PIER.z0; z -= 1.1) kit.accent.addMM(PIER.x0, QUAY.top, z, PIER.x1, QUAY.top + 0.02, z - 0.05, 0x6a4a30, 0, 0.1);
    for (let z = -6; z >= PIER.z0 + 0.5; z -= 4) for (const x of [PIER.x0 + 0.1, PIER.x1 - 0.1]) kit.wood.add(x, 0.45, z, 0.26, 1.7, 0.26, 0x6a4a30, 0, 0.1, R);
    g.addPlatform(PIER.x0, PIER.x1, PIER.z0, QUAY.z0 + 0.2, QUAY.top);
    // mooring posts along the quay edge
    for (let x = -48; x <= 48; x += 6) kit.wood.add(x, QUAY.top + 0.3, QUAY.z0 + 0.45, 0.26, 0.7, 0.26, 0x6a4a30, 0, 0.12, R);

    // ============ boats: two at the pier (cargo, passenger), more along the quay, two sailing ============
    const floater = (boat, x, z, yaw, o = {}) => { boat.position.set(x, WATER_Y, z); boat.rotation.y = yaw; boat.userData.ph = rnd(0, 6); boat.userData.o = o; this.add(boat); this.floaters.push(boat); this.audioSpots.boats.push(boat.position); return boat; };
    this.boatA = floater(createBoat({ length: 9, width: 2.6, trim: PALETTE.terracotta }), BOAT_A.x, BOAT_A.z, 0);
    this.boatB = floater(createBoat({ length: 9, width: 2.6, canopy: true, trim: PALETTE.turquoise }), BOAT_B.x, BOAT_B.z, 0);
    const lay = (x, color, len = 8) => floater(createBoat({ length: len, width: 2.3, trim: color }), x, -5.7, Math.PI / 2);
    this.boatC = lay(-27, PALETTE.lapis); lay(-40, PALETTE.ochre, 7); this.boatE = lay(27, PALETTE.madder); lay(40, PALETTE.indigo, 7.5);
    this.sailers = [[-38, 1.0, 1], [-46, 1.35, -1]].map(([z, spd, dir], i) => {
      const b = floater(createBoat({ length: 8, width: 2.3, canopy: i === 0, trim: i ? PALETTE.ochre : PALETTE.lapis }), -140 * dir, z, dir > 0 ? -Math.PI / 2 : Math.PI / 2);
      b.userData.sail = { z, dir, speed: 2.2 + i * 0.6 }; this.ambientBoats.push(b); return b;
    });
    this.startAmbientBoats();
    for (const [bx, s] of [[BOAT_A.x, -1], [BOAT_B.x, 1]]) for (const z of [-9.8, -16.2]) kit.accent.addMM(Math.min(bx + s * 1.25, s < 0 ? -2.1 : 2.1), 0.5, z - 0.02, Math.max(bx + s * 1.25, s < 0 ? -2.1 : 2.1), 0.56, z + 0.02, 0x3a2a1e, 0, 0);

    // ============ cargo, stalls, buildings, banners, lamps ============
    // goods stacked on the quay beside each boat
    const heaps = [[-10.4, 1.4], [-12.2, 3.2], [-9.2, 4.4], [30.5, 2.4], [24, 3.5], [-30, 2.6]];
    for (const [x, z] of heaps) { for (let i = 0; i < 5; i++) potsAll.push([x + (i % 3) * 0.55 - 0.5, QUAY.top, z + Math.floor(i / 3) * 0.55, rnd(0.95, 1.4)]); this.audioSpots.cargo.push(new THREE.Vector3(x, 0.8, z)); }
    for (const [x, z, c] of [[-8.1, 4.8, 0xc4985a], [-7.3, 5.4, 0xb88a4a], [29.2, 4.6, 0xd0a868], [23.4, 5.2, 0xc4985a], [-14, 1, 0xb88a4a], [32, 0.8, 0xd0a868]]) for (let i = 0; i < 3; i++) kit.box('accent', x + i * 0.62, QUAY.top + 0.28, z, 0.58, 0.56, 0.58, { tint: c, vary: 0.1 });
    for (const [x, z] of [[-13.3, 0.4], [-11.5, 5.3], [34.4, 3.4]]) { const h = createGrainHeap(); h.position.set(x, QUAY.top, z); h.scale.setScalar(1.3); this.add(h); }
    kit.box('accent', -9.5, QUAY.top + 0.04, 0.8, 2.6, 0.06, 1.8, { tint: 0xc9a468, vary: 0.05 });
    // two plaza stalls
    for (const [x, z, ci] of [[-30, 15, 0], [32, 15, 1]]) {
      const a = createAwning({ uTime: this.uTime, w: 5, d: 3, colors: [PALETTE.cloth[ci], PALETTE.ochre, PALETTE.turquoise, PALETTE.indigo] }); a.position.set(x, 0, z); this.add(a);
      kit.box('accent', x, 0.5, z, 3.8, 1.0, 1.0, { tint: 0xcaa07a, collide: true }); for (let i = 0; i < 4; i++) potsAll.push([x - 1.5 + i * 0.9, 1.0, z, 0.9]);
    }
    // the warehouse and the rows of houses behind the plaza
    kit.house({ x: -38, z: 22, w: 14, d: 8, h: 4.4, rot: Math.PI, mat: 'brick', collide: true }); kit.house({ x: 40, z: 24, w: 12, d: 8, h: 4.2, rot: Math.PI, mat: 'plaster', collide: true });
    for (let x = -66; x <= 66; x += 13) kit.house({ x: x + rnd(-1.5, 1.5), z: 44 + rnd(-1, 2), w: rnd(8, 11), d: rnd(7, 9), h: rnd(3.6, 5), rot: Math.PI, mat: R() < 0.3 ? 'plaster' : 'brick', collide: true, upper: R() < 0.15 });
    for (const [x, z, ci] of [[-3.6, 8.4, 0], [3.6, 8.4, 1], [-46, 7.6, 3], [46, 7.6, 4]]) { const b = createBanner({ uTime: this.uTime, colors: [PALETTE.cloth[ci], PALETTE.ochre, PALETTE.turquoise, PALETTE.indigo], poleH: 4.4 }); b.position.set(x, QUAY.top, z); this.add(b); }
    // quay lamps (real light) and plaza lamps (glow): lit by the day/night rig, so the dusk lights them
    [[-20, 0.2], [-8, 4.2], [8, 4.2], [20, 0.2], [32, 4.6], [-32, 4.6], [-2.45, -10], [2.45, -10], [-2.45, -20], [2.45, -20]].forEach(([x, z]) => this.add(createLamp({ lamps: this.lamps, x, y: QUAY.top, z, light: true })));
    [[-44, 6], [44, 6], [-14, 18], [14, 18], [0, 26], [-26, 30], [26, 30]].forEach(([x, z]) => this.add(createLamp({ lamps: this.lamps, x, y: z > 9 ? 0 : QUAY.top, z, light: false })));
    // a brazier at the weighing stall: glow follows the lamp factor
    const braz = makeGlowSprite(0xff7a2a, 1.6, 0.9); braz.position.set(21.6, 1.1, 1.0); this.add(braz); this.updaters.push((dt, t) => { braz.material.opacity = (0.25 + 0.75 * this.lighting.lampFactor) * (0.85 + Math.sin(t * 9) * 0.1); });
    kit.box('brick', 21.6, 0.6, 1.0, 0.7, 0.4, 0.7, { tint: 0xc98868 }); kit.box('accent', 21.6, 0.82, 1.0, 0.5, 0.05, 0.5, { tint: 0x120a07, vary: 0 });

    // ============ nature: trees, reeds, ridge, birds ============
    this.add(createTrees([...scatter(34, [-150, 150, -98, -62], { seed: 3 }), ...scatter(14, [-130, 130, 56, 100], { seed: 4 }), [-55, 0, 12, 1.2], [56, 0, 14, 1.2], [-58, 0, 28, 1.1], [58, 0, 30, 1.1]], { uTime: this.uTime, seed: 9 }));
    const reeds = [];
    for (let i = 0; i < 900; i++) reeds.push([(R() - 0.5) * 320, WATER_Y, -58 + R() * 5]);                      // far bank
    for (let i = 0; i < 260; i++) { const s = R() < 0.5 ? -1 : 1; reeds.push([s * (53 + R() * 70), WATER_Y, -5.5 + R() * 3]); }  // near bank beyond the quay
    this.add(createReeds(reeds, { uTime: this.uTime, seed: 4 }));
    const ridge = createRidge({ width: 1300, height: 60, color: 0x9a8fb0, seed: 6 }); ridge.position.set(0, 0, -540); this.add(ridge);
    const birds = createBirds(12, { center: [0, 34, -30], radius: 90, spread: 14, seed: 8 }); this.add(birds.group, (dt, t) => birds.update(dt, t));
    this.add(createPots(potsAll));
    kit.build(this.root);

    // ============ people: merchants (reusing the shared Artisan NPC), porters, loaders ============
    const npc = (x, z, heading, look) => { const a = new Artisan(new THREE.Vector3(x, QUAY.top, z), { heading, ...look }); this.add(a.root, (dt, t) => a.update(dt, t)); a.root.userData.dispose = () => {}; this.audioSpots.people.push(a.pos); return a; };
    this.guide = npc(0, 6.2, Math.PI, { cloth: PALETTE.lapis, sash: PALETTE.ochre, band: PALETTE.carnelian, skin: PALETTE.skin[2] });
    this.npcs = {
      trader: npc(-8.4, -1.4, Math.PI, { cloth: PALETTE.terracotta, sash: PALETTE.turquoise, band: PALETTE.lapis, skin: PALETTE.skin[1] }),
      weigh: npc(18, 0.5, 0, { cloth: PALETTE.cloth[2], sash: PALETTE.indigo, band: PALETTE.madder, skin: PALETTE.skin[0] }),
      map: npc(-19.4, 3.2, 0, { cloth: PALETTE.cloth[3], sash: PALETTE.ochre, band: PALETTE.indigo, skin: PALETTE.skin[3] }),
      ferry: npc(1.7, -6.6, Math.PI, { cloth: PALETTE.cloth[4], sash: PALETTE.ochre, band: PALETTE.lapis, skin: PALETTE.skin[1] }),
    };
    // a model of the weighing beam on the stall table, and the trade board with the supplied map
    this.buildWeighingStall(g); this.buildMapBoard(g);
    const sell = (x, z, ry, mode) => { const p = randomPerson(R); p.position.set(x, QUAY.top, z); p.rotation.y = ry; this.add(p); this.workers.push({ p, mode, ph: rnd(0, 6) }); this.audioSpots.people.push(p.position); return p; };
    // loaders working on the boat moored on the quay, and traders bargaining
    for (const [x, z, ry] of [[24.4, -5.7, Math.PI / 2], [29.6, -5.7, -Math.PI / 2]]) { const p = randomPerson(R); p.position.set(x, WATER_Y + 0.5, z); p.rotation.y = ry; this.add(p); this.workers.push({ p, mode: 'lift', ph: rnd(0, 6), boat: this.boatE }); this.audioSpots.people.push(p.position); }
    sell(-12, 0.8, -0.8, 'talk'); sell(-11.2, 1.6, 2.4, 'talk'); sell(7, 2.8, 0.3, 'talk'); sell(8.2, 3.6, -2.5, 'talk'); sell(-31.5, 14, 0, 'talk'); sell(33.5, 14, 0, 'talk');
    const person = (route, o = {}) => { const p = randomPerson(R, { carry: !!o.carry }); this.add(p); const w = new Walker(p, route, { speed: o.speed ?? 0.5 + R() * 0.5, groundFn: (x, z) => g.height(x, z) }); w.base = w.speed; this.walkers.push(w); this.audioSpots.people.push(p.position); return w; };
    person([[-46, 6.8], [46, 6.8]]); person([[46, 8.2], [-46, 8.2]]); person([[-34, 5.6], [10, 5.6]], { carry: true }); person([[8, 5.4], [-3, -1.4], [-3, 5]], {}); person([[-9, 5], [-28, 5], [-28, -3.2]], { carry: true, speed: 0.7 }); person([[36, 5], [27, -2.4], [27, -3.4]], { carry: true, speed: 0.7 });
    person([[-8, 14], [10, 22]]); person([[-20, 30], [24, 30]]); person([[2.0, -4.5], [2.0, -22]], { speed: 0.55 });
    this.updaters.push((dt, t) => {
      for (const w of this.walkers) { w.speed = w.base * (1 - 0.88 * this.dusk); w.update(dt); }
      for (const w of this.workers) {
        const u = w.p.userData, s = Math.sin(t * (w.mode === 'lift' ? 3.4 : 2.0) + w.ph), k = 1 - this.dusk * 0.85;
        if (w.mode === 'lift') { u.armR.rotation.x = -1.2 * k + s * 0.55 * k; u.armL.rotation.x = -1.2 * k - s * 0.55 * k; if (w.boat) w.p.position.y = w.boat.position.y + 0.5; }
        else { u.armR.rotation.x = -0.9 + s * 0.3 * k; u.armL.rotation.x = -0.3 + Math.sin(t * 1.4 + w.ph) * 0.18 * k; w.p.rotation.y += Math.sin(t * 0.5 + w.ph) * 0.0015; }
      }
    });
    // floating: gentle bobbing that calms at dusk as the boats settle
    this.updaters.push((dt, t) => { const calm = 1 - 0.55 * this.dusk; for (const b of this.floaters) { const p = b.userData.ph; b.position.y = WATER_Y - (b.userData.sink || 0) + Math.sin(t * 1.15 + p) * 0.035 * calm; b.rotation.z = Math.sin(t * 0.9 + p * 1.3) * 0.018 * calm; b.rotation.x = Math.sin(t * 0.7 + p) * 0.01 * calm; } });
    // river colour follows the sky: teal by day, a warm violet at dusk (the reflection map itself is the live sky)
    const dayC = new THREE.Color(0x0e7f93), duskC = new THREE.Color(0x9a6f82), tmp = new THREE.Color();
    this.updaters.push(() => { river.materials[0].color.copy(tmp.copy(dayC).lerp(duskC, this.dusk)); river.materials[0].envMapIntensity = 0.9 + this.dusk * 0.7; });
    this.updaters.push(() => this.updateDusk());
    this.updaters.push((dt) => this.updateJourney(dt));

    // ============ hotspots (enabled once the welcome is over) ============
    this.labels = [];
    for (const [id, s] of Object.entries(STATIONS)) {
      this.hotspots.add({ id, position: new THREE.Vector3(...s.spot), color: s.color, radius: id === 'journey' ? 2.4 : 3.0, size: 1.0, onActivate: () => this.startFlow(id) });
      const lab = makeLabel(s.name, s.color); lab.position.set(s.spot[0], s.spot[1] + 1.0, s.spot[2]); lab.visible = false; this.add(lab); this.labels.push({ lab, s });
    }
    this.hotspots.setEnabled(false);
    this.updaters.push(() => { const cp = this.app.camera.position; for (const { lab } of this.labels) { const d = lab.position.distanceTo(cp); lab.visible = !this.busy && !this.journeyOn && d < 26; lab.material.opacity = Math.max(0, Math.min(0.95, (26 - d) / 9)); const k = Math.max(0.28, Math.min(1.1, d / 15)); lab.scale.set(6 * k, 1.1 * k, 1); } });

    // ============ trade goods on the pier (real 3D objects, picked up and carried to the boat) ============
    this.cargo = CARGO_KINDS.map((k, i) => { const it = createCargoItem(k, i); it.position.set(...CARGO_HOME[i]); it.rotation.y = i * 1.3; it.userData.home = it.position.clone(); it.userData.homeRot = it.rotation.y; this.add(it); this.audioSpots.cargo.push(it.position); return it; });

    // ============ UI ============
    const ui = document.getElementById('ui');
    this.dlg = new DialogueBox(ui);
    this.objective = el('div', { id: 'objective' }); ui.append(this.objective);
    this.guideBtn = el('button', { id: 'guide-btn', class: 'btn primary', onclick: () => this.guideMenu() }, '💬 Talk to the merchant');
    ui.append(this.guideBtn);
    this.jui = el('div', { id: 'journey-ui' }, this.jcap = el('div', { class: 'cap' }), el('button', { class: 'btn', onclick: () => this.endJourney(true) }, SCRIPT.journey.leave));
    ui.append(this.jui);
    this._escKey = (e) => { if (e.code === 'Escape' && this.journeyOn) this.endJourney(true); };
    window.addEventListener('keydown', this._escKey);
    this.sfx = this._makeSfx();
    this.cargoUi = this.makeCargoUi(ui);
    this.setupTalkers();
    this.debug = { skip: () => { this.started = true; this.setObjective(''); this.enableHotspots(); }, menu: () => this.guideMenu(), flow: (k) => this.startFlow(k), dusk: () => this.duskFlow(true), journey: () => this.journeyFlow(true), mapUrl: MAP_URL };
    this.setObjective('Walk up to the merchant at the quay');
  }

  // ---------------------------------------------------------------- scenery helpers
  buildWeighingStall(g) {
    const a = createAwning({ uTime: this.uTime, w: 5.6, d: 3.2, colors: [PALETTE.ochre, PALETTE.madder, PALETTE.turquoise, PALETTE.indigo] }); a.position.set(18, QUAY.top, 1.2); this.add(a);
    const table = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.9, 1.1), new THREE.MeshStandardMaterial({ color: 0xcaa07a, roughness: 0.9 })); table.position.set(18, QUAY.top + 0.45, 1.9); table.castShadow = table.receiveShadow = true; this.add(table);
    g.addBlocker(16.1, 19.9, 1.3, 2.5);
    const m = new THREE.MeshStandardMaterial({ color: 0x8a5a30, roughness: 0.8 }), stone = new THREE.MeshStandardMaterial({ color: 0xb8b0a0, roughness: 0.9 });
    const scale = new THREE.Group(); scale.position.set(18, QUAY.top + 0.9, 1.9); this.add(scale);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.06), m); post.position.y = 0.3; scale.add(post);
    const beam = new THREE.Group(); beam.position.y = 0.6; scale.add(beam); const bm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.05), m); beam.add(bm);
    for (const s of [-1, 1]) { const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.12, 0.04, 12), m); pan.position.set(s * 0.45, -0.3, 0); beam.add(pan); const str = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.3, 0.01), m); str.position.set(s * 0.45, -0.15, 0); beam.add(str); }
    for (let i = 0; i < 6; i++) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.12 + (i % 3) * 0.02, 0.12, 0.12), stone); w.position.set(16.9 + i * 0.28, QUAY.top + 0.96, 2.2); w.castShadow = true; this.add(w); }
    this.updaters.push((dt, t) => { beam.rotation.z = Math.sin(t * 0.9) * 0.05; });
  }
  buildMapBoard(g) {
    const W = 5.2, H = W * (572 / 800), x = -23.2, z = 1.2, y = QUAY.top + 2.9;
    const tex = new THREE.TextureLoader().load(MAP_URL, undefined, undefined, () => {}); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); board.position.set(x, y, z + 0.09);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, H + 0.3, 0.14), new THREE.MeshStandardMaterial({ color: 0x6a4a30, roughness: 0.9 })); frame.position.set(x, y, z); frame.castShadow = true;
    const postM = new THREE.MeshStandardMaterial({ color: 0x5a3a26, roughness: 0.9 });
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.18, y + H / 2, 0.18), postM); p.position.set(x + s * (W / 2 + 0.1), (y + H / 2) / 2, z); p.castShadow = true; this.add(p); }
    this.add(board); this.add(frame); g.addBlocker(x - W / 2 - 0.3, x + W / 2 + 0.3, z - 0.3, z + 0.3);
  }
  _makeSfx() {
    const a = this.app.audio, cam = () => this.app.camera.position;
    return {
      place: () => { a.blip(420, 0.08, 0.05); a.dock?.thud(cam()); }, bad: () => a.blip(170, 0.16, 0.05), tick: () => a.blip(950, 0.05, 0.03),
      chime: () => { a.blip(784, 0.18, 0.06); setTimeout(() => a.blip(1046, 0.25, 0.06), 140); },
    };
  }

  /** The bottom card shown while loading: the picked good's trade description, progress and a stop button. */
  makeCargoUi(ui) {
    const title = el('b', {}), use = el('p', {}), who = el('p', {}), prog = el('span', { class: 'cg-prog' }), hint = el('p', { class: 'cg-hint' });
    const stop = el('button', { class: 'ws-btn sm', onclick: () => api.onStop?.() }, SCRIPT.cargo.stop);
    const node = el('div', { id: 'cargo-ui' }, el('div', { class: 'cg-top' }, title, prog, stop), hint, use, who);
    ui.append(node);
    const api = {
      node, onStop: null,
      show() { node.classList.add('show'); }, hide() { node.classList.remove('show'); },
      setProgress(n, t) { prog.textContent = `${n} / ${t} loaded`; },
      setHint(t, n, tot) { title.textContent = 'Trade goods'; hint.textContent = t; hint.style.display = ''; use.textContent = ''; who.textContent = ''; api.setProgress(n, tot); },
      showItem(d, n, tot) { title.textContent = d.title; hint.style.display = 'none'; use.replaceChildren(el('b', {}, 'How it was used in trade: '), d.use); who.replaceChildren(el('b', {}, 'With whom: '), d.who); api.setProgress(n, tot); },
    };
    return api;
  }

  // ---------------------------------------------------------------- click a person: one fun fact
  /** Every person gets an invisible hit capsule and one fact; clicking them shows that single line. */
  setupTalkers() {
    const named = [[this.guide.root, MERCHANT], [this.npcs.trader.root, 'Mira the boat merchant'], [this.npcs.weigh.root, MERCHANTS.weigh], [this.npcs.map.root, MERCHANTS.map], [this.npcs.ferry.root, 'Kavi the boatman']];
    const others = [...this.workers.filter((w) => w.mode !== 'lift').map((w) => w.p), ...this.walkers.map((w) => w.p)].map((p) => [p, 'A trader']);
    this.talkers = []; let i = 0;
    for (const [root, name] of [...named, ...others]) {
      const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.9, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      hit.position.y = 0.95; root.add(hit); this.talkers.push({ hit, name, fact: FACTS[i++ % FACTS.length], root });
    }
    const dom = this.app.renderer.domElement, ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
    this._pd = (e) => { down = { x: e.clientX, y: e.clientY }; };
    this._pu = (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return; down = null;
      if (this.busy || this.journeyOn || this.dead || this.app.paused || this.dlg.visible || !this.app.controls.enabled) return;
      ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1); ray.setFromCamera(ndc, this.app.camera);
      const hit = ray.intersectObjects(this.talkers.map((t) => t.hit), false)[0]; if (!hit || hit.distance > 30) return;
      this.funFact(this.talkers.find((t) => t.hit === hit.object));
    };
    dom.addEventListener('pointerdown', this._pd); dom.addEventListener('pointerup', this._pu);
  }
  async funFact(t) {
    this.busy = true; this.lock(true); this.hotspots.setEnabled(false);
    const a = [this.guide, ...Object.values(this.npcs)].find((n) => n.root === t.root);
    if (a) { a.faceToward(this.app.camera.position); a.setMode('talk'); } else { const c = this.app.camera.position; t.root.rotation.y = Math.atan2(c.x - t.root.position.x, c.z - t.root.position.z); }
    await this.say(t.name, t.fact, 'Thanks ›'); this.dlg.hide(); a?.setMode('idle');
    this.busy = false; this.lock(false); this.enableHotspots();
  }

  // ---------------------------------------------------------------- small helpers
  setObjective(t) { this.objective.textContent = t || ''; this.objective.classList.toggle('show', !!t); }
  say(who, text, label) { return this.dlg.say(who, text, label); }
  async sayAll(who, lines, last) { for (let i = 0; i < lines.length; i++) await this.say(who, lines[i], i === lines.length - 1 && last ? last : undefined); }
  lock(on) { this.app.controls.enabled = !on; }
  setTime(h) { this.hour = h; super.setTime(h); }
  enableHotspots() { const cp = this.app.camera.position; for (const h of this.hotspots.items) h.inside = h.position.distanceTo(cp) < h.radius * 1.5; this.hotspots.setEnabled(true); }
  /** Smoothly walk the visitor's view to a spot, facing a point (no teleporting). */
  glide(x, z, look, dur = 1.8) {
    const c = this.app.controls, g = this.ground, yaw = Math.atan2(-(look[0] - x), -(look[1] - z)); let dy = yaw - c.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    gsap.killTweensOf(c.pos); gsap.killTweensOf(c);
    gsap.to(c.pos, { x, z, duration: dur, ease: 'power2.inOut', onUpdate: () => { c.footY = g.height(c.pos.x, c.pos.z); c.pos.y = c.footY + c.eye; c.apply(); } });
    return new Promise((res) => gsap.to(c, { duration: dur, ease: 'power2.inOut', yaw: c.yaw + dy, pitch: 0.03, onUpdate: () => c.apply(), onComplete: res }));
  }
  openActivity(runner) {
    this.app.controls.enabled = false; this.dlg.hide(); this.app.paused = true;
    return new Promise((resolve) => {
      const run = runner(document.getElementById('ui'), { sfx: this.sfx, app: this.app });
      this.activity = { close: () => document.querySelector('.ws-overlay .ws-back')?.click() };
      run.then((r) => { this.activity = null; this.app.paused = false; resolve(r); });
    });
  }

  // ---------------------------------------------------------------- story
  update(dt) {
    super.update(dt);
    if (this.dead) return;
    if (!this.started && this.app.camera.position.distanceTo(this.guide.pos) < 10) { this.started = true; this.welcome(); }
    // merchants turn to face the visitor when close and idle
    if (!this.busy && !this.journeyOn) { const cp = this.app.camera.position; for (const a of [this.guide, ...Object.values(this.npcs)]) if (!a.walk && a.mode === 'idle' && a.pos.distanceTo(cp) < 12) a.faceToward(cp); }
  }
  async welcome() {
    this.setObjective(''); this.lock(true); this.busy = true;
    const g = this.guide; g.faceToward(this.app.camera.position); await wait(300); g.setMode('wave'); await wait(900); g.setMode('talk');
    await this.sayAll(MERCHANT, SCRIPT.welcome); g.setMode('idle');
    this.busy = false; await this.guideMenu(true);
  }
  async guideMenu(first = false, question = SCRIPT.menuQuestion) {
    if ((this.busy && !first) || this.journeyOn) return;
    this.busy = true; this.lock(true); this.hotspots.setEnabled(false); this.app.ui.panel.hide();
    this.guide.faceToward(this.app.camera.position); this.guide.setMode('talk');
    const M = SCRIPT.menu, mark = (k, l) => (this.visited.has(k) ? '✓ ' : '') + l;
    const pick = await this.dlg.ask(MERCHANT, question, [
      { value: 'cargo', label: mark('cargo', M.cargo) }, { value: 'weigh', label: mark('weigh', M.weigh) }, { value: 'map', label: mark('map', M.map) },
      { value: 'journey', label: mark('journey', M.journey) }, { value: 'dusk', label: M.dusk }, { value: 'free', label: M.free }]);
    this.dlg.hide(); this.guide.setMode('idle'); this.busy = false;
    if (pick === 'free') return this.freeRoam();
    return pick === 'dusk' ? this.duskFlow() : this.startFlow(pick, true);
  }
  freeRoam() { this.busy = false; this.lock(false); this.enableHotspots(); this.setObjective('Explore freely: walk to a glowing marker, or talk to the merchant'); setTimeout(() => !this.busy && this.setObjective(''), 7000); }
  async startFlow(id, fromMenu = false) {
    if (this.busy || this.dead || this.journeyOn) return;
    this.busy = true; this.lock(true); this.hotspots.setEnabled(false); this.setObjective(''); this.app.ui.panel.hide();
    try {
      if (id === 'journey') await this.journeyFlow(); else await this[id + 'Flow']();
    } catch (e) { console.error('dock flow failed', id, e); this.app.paused = false; }
    if (this.dead || this.journeyOn) return;
    this.visited.add(id); this.busy = false; this.lock(false);
    await this.guideMenu(true, SCRIPT.menuDone);
  }
  /** Walk the visitor to a station and have its merchant turn to them. */
  async approach(id) {
    const s = STATIONS[id], n = id === 'journey' ? this.npcs.ferry : id === 'cargo' ? this.npcs.trader : this.npcs[id];
    n.faceToward(this.app.camera.position); await this.glide(s.stand[0], s.stand[1], s.look); n.faceToward(this.app.camera.position); n.setMode('talk'); return n;
  }
  async cargoFlow() {
    const n = await this.approach('cargo'), who = MERCHANTS.trader;
    if (this.cargoBusy) { await this.say(who, SCRIPT.cargo.repeat); n.setMode('idle'); this.dlg.hide(); return; }
    await this.sayAll(who, SCRIPT.cargo.greet, 'Let us load it ›'); this.dlg.hide(); n.setMode('idle');
    const c = this.app.controls, saved = { x: c.pos.x, y: c.pos.y, z: c.pos.z, yaw: c.yaw, pitch: c.pitch };
    await this.cameraTo([0.6, 3.5, -5.5], [-1.8, -0.9, -10.4], 1.8);                 // the view moves in over the pier and the boat
    const loaded = await this.loadActivity();
    await this.cameraTo([saved.x, saved.y, saved.z], null, 1.6, saved);              // and back to normal exploration
    c.footY = this.ground.height(c.pos.x, c.pos.z); c.pos.y = c.footY + c.eye; c.apply();
    n.faceToward(this.app.camera.position); n.setMode('talk'); this.lock(true);
    if (!loaded) { await this.say(who, SCRIPT.cargo.early); n.setMode('idle'); this.dlg.hide(); return; }
    await this.sayAll(who, SCRIPT.cargo.thanks); this.dlg.hide(); n.setMode('idle');
    this.departBoat(); await this.watchBoat(this.boatA, 6.5);
    this.lock(true); n.faceToward(this.app.camera.position); n.setMode('talk'); await this.say(who, SCRIPT.cargo.departing); n.setMode('idle'); this.dlg.hide();
  }
  /** Smooth camera move; look = [x,y,z] target, or an explicit {yaw,pitch} to restore. */
  cameraTo(pos, look, dur, restore = null) {
    const c = this.app.controls; gsap.killTweensOf(c.pos); gsap.killTweensOf(c);
    let yaw, pitch;
    if (restore) { yaw = restore.yaw; pitch = restore.pitch; } else { const dx = look[0] - pos[0], dy = look[1] - pos[1], dz = look[2] - pos[2]; yaw = Math.atan2(-dx, -dz); pitch = Math.atan2(dy, Math.hypot(dx, dz)); }
    let dy2 = yaw - c.yaw; dy2 = Math.atan2(Math.sin(dy2), Math.cos(dy2));
    gsap.to(c.pos, { x: pos[0], y: pos[1], z: pos[2], duration: dur, ease: 'power2.inOut', onUpdate: () => c.apply() });
    return new Promise((res) => gsap.to(c, { yaw: c.yaw + dy2, pitch, duration: dur, ease: 'power2.inOut', onUpdate: () => c.apply(), onComplete: res }));
  }
  /** Pick up a good with the mouse, drag it through the 3D scene, and let go over the boat to set it down. Resolves true when all are loaded. */
  loadActivity() {
    const dom = this.app.renderer.domElement, cam = this.app.camera, boat = this.boatA, ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hit = new THREE.Vector3();
    const planeY = WATER_Y + boat.userData.deckY + 0.6, plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY), free = HOLD_SLOTS.map(() => true), local = new THREE.Vector3();
    let drag = null, placed = 0, finished = false;
    const info = this.cargoUi;
    this.lock(true); this.hotspots.setEnabled(false); this.cargo.forEach((it) => { it.userData.placed = false; });
    info.show(); info.setHint(SCRIPT.cargo.hint, placed, this.cargo.length);
    const pointer = (e) => { ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1); ray.setFromCamera(ndc, cam); };
    const rootOf = (o) => { while (o && o.userData.kind === undefined) o = o.parent; return o; };
    const overHold = (p) => { boat.updateMatrixWorld(true); local.copy(p); boat.worldToLocal(local); return Math.abs(local.x) < 1.3 && local.z > -3.4 && local.z < 4.0 ? local : null; };
    const hold = boat.userData.hold, lightHold = (on) => { hold.emissive?.set?.(on ? 0x6a4a10 : 0x000000); };
    return new Promise((resolve) => {
      const done = (ok) => { if (finished) return; finished = true; cleanup(); lightHold(false); info.hide(); resolve(ok); };
      const onDown = (e) => {
        if (drag || e.button > 0) return; pointer(e);
        const h = ray.intersectObjects(this.cargo.filter((i) => !i.userData.placed), true)[0]; if (!h) return;
        const it = rootOf(h.object); if (!it) return; e.preventDefault(); dom.setPointerCapture?.(e.pointerId);
        gsap.killTweensOf(it.position); gsap.killTweensOf(it.rotation);
        drag = { it }; info.showItem(CARGO_INFO[it.userData.kind], placed, this.cargo.length); this.sfx.tick(); dom.style.cursor = 'grabbing';
      };
      const onMove = (e) => {
        pointer(e);
        if (!drag) { const h = ray.intersectObjects(this.cargo.filter((i) => !i.userData.placed), true)[0]; dom.style.cursor = h ? 'grab' : ''; return; }
        if (ray.ray.intersectPlane(plane, hit) && hit.distanceTo(cam.position) < 30) {
          const it = drag.it; it.position.lerp(hit, 0.55); it.rotation.y += 0.04; lightHold(!!overHold(it.position));
        }
      };
      const onUp = () => {
        if (!drag) return; const it = drag.it; drag = null; dom.style.cursor = ''; lightHold(false);
        const l = overHold(it.position);
        if (l) { // nearest free set-down place in the boat
          let best = -1, bd = 1e9; HOLD_SLOTS.forEach(([x, z], i) => { if (!free[i]) return; const d = Math.hypot(x - l.x, z - l.z); if (d < bd) { bd = d; best = i; } });
          if (best >= 0) { this.placeCargo(it, boat, HOLD_SLOTS[best]); free[best] = false; it.userData.placed = true; placed++; boat.userData.sink = placed * 0.03; info.setProgress(placed, this.cargo.length);
            if (placed === this.cargo.length) setTimeout(() => done(true), 900); return; }
        }
        gsap.to(it.position, { x: it.userData.home.x, y: it.userData.home.y, z: it.userData.home.z, duration: 0.6, ease: 'power2.inOut' }); gsap.to(it.rotation, { y: it.userData.homeRot, duration: 0.6 });
      };
      const onKey = (e) => { if (e.code === 'Escape') { e.stopPropagation(); stop(); } };
      const stop = () => { if (placed < this.cargo.length) this.resetCargo(true); boat.userData.sink = 0; done(false); };
      info.onStop = stop;
      const cleanup = () => { dom.removeEventListener('pointerdown', onDown); dom.removeEventListener('pointermove', onMove); dom.removeEventListener('pointerup', onUp); dom.removeEventListener('pointercancel', onUp); window.removeEventListener('keydown', onKey, true); dom.style.cursor = ''; };
      dom.addEventListener('pointerdown', onDown); dom.addEventListener('pointermove', onMove); dom.addEventListener('pointerup', onUp); dom.addEventListener('pointercancel', onUp); window.addEventListener('keydown', onKey, true);
      this._cancelCargo = stop;
    });
  }
  /** Set the good down in the boat: an arc into the hold, a small settle, then it travels with the boat. */
  placeCargo(it, boat, [sx, sz]) {
    boat.attach(it); const L = it.position.clone(), top = new THREE.Vector3(sx, boat.userData.deckY + 0.55, sz);
    const T = { k: 0 }; const y0 = it.position.y;
    gsap.to(T, { k: 1, duration: 0.45, ease: 'power2.in', onUpdate: () => { it.position.set(L.x + (sx - L.x) * T.k, y0 + (boat.userData.deckY - y0) * T.k + Math.sin(T.k * Math.PI) * 0.25, L.z + (sz - L.z) * T.k); },
      onComplete: () => { it.position.set(sx, boat.userData.deckY + 0.02, sz); gsap.fromTo(it.scale, { y: 0.9 }, { y: 1, duration: 0.35, ease: 'elastic.out(1,0.4)' }); this.sfx.place(); } });
    gsap.to(it.rotation, { y: it.rotation.y + (Math.random() - 0.5) * 0.8, duration: 0.45 }); void top;
  }
  /** Return every good to its place on the pier (animated or instant). */
  resetCargo(animate = false) {
    for (const it of this.cargo) {
      if (!it.userData.placed && it.parent === this.root) { if (animate) gsap.to(it.position, { x: it.userData.home.x, y: it.userData.home.y, z: it.userData.home.z, duration: 0.5 }); continue; }
      gsap.killTweensOf(it.position); gsap.killTweensOf(it.rotation); this.root.attach(it); it.scale.set(1, 1, 1); it.userData.placed = false;
      if (animate) { const p = it.userData.home; gsap.to(it.position, { x: p.x, y: p.y + 0.4, z: p.z, duration: 0.5, onComplete: () => gsap.to(it.position, { y: p.y, duration: 0.2 }) }); } else it.position.copy(it.userData.home);
      it.rotation.set(0, it.userData.homeRot, 0);
    }
  }
  /** The loaded boat casts off along a predefined path, then returns empty a while later. */
  departBoat() {
    const b = this.boatA, out = this._boatPath([[BOAT_A.x, BOAT_A.z], [BOAT_A.x, -19], [-1, -27], [14, -32], [48, -34], [95, -33], [150, -31]]);
    this.cargoBusy = true; const S = { u: 0 };
    gsap.to(S, { u: 1, duration: 26, ease: 'power2.in', onUpdate: () => this._place(b, out, S.u), onComplete: () => {
      b.visible = false; this.resetCargo(false); b.userData.sink = 0;
      setTimeout(() => {
        if (this.dead) return;
        const back = this._boatPath([[150, -31], [95, -33], [48, -34], [14, -32], [-1, -27], [BOAT_A.x - 0.6, -20], [BOAT_A.x, BOAT_A.z - 1.5]]); b.visible = true; const T = { u: 0 };
        gsap.to(T, { u: 1, duration: 22, ease: 'power2.out', onUpdate: () => this._place(b, back, T.u), onComplete: () => { b.position.set(BOAT_A.x, WATER_Y, BOAT_A.z); b.rotation.y = 0; this.cargoBusy = false; } });
      }, 4000);
    } });
  }
  /** The visitor's view follows the departing boat for a few seconds. */
  async watchBoat(boat, secs) {
    const c = this.app.controls, t0 = performance.now(); this.lock(true);
    await new Promise((res) => {
      const tick = () => {
        if (this.dead) return res();
        const dx = boat.position.x - c.pos.x, dz = boat.position.z - c.pos.z, yaw = Math.atan2(-dx, -dz); let dy = yaw - c.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        c.yaw += dy * 0.06; c.pitch += (0.02 - c.pitch) * 0.05; c.apply();
        if ((performance.now() - t0) / 1000 > secs) return res(); requestAnimationFrame(tick);
      }; tick();
    });
  }
  async weighFlow() {
    const n = await this.approach('weigh'), who = MERCHANTS.weigh;
    await this.sayAll(who, SCRIPT.weigh.greet, 'Let me try ›'); this.dlg.hide(); n.setMode('craft');
    const solved = await this.openActivity(runWeighing);
    n.faceToward(this.app.camera.position); n.setMode('talk'); this.lock(true);
    await this.say(who, solved ? SCRIPT.weigh.done : SCRIPT.weigh.early); n.setMode('idle'); this.dlg.hide();
  }
  async mapFlow() {
    const n = await this.approach('map'), who = MERCHANTS.map;
    await this.sayAll(who, SCRIPT.map.greet, 'Show me the map ›'); this.dlg.hide();
    const seen = await this.openActivity(runTradeMap);
    n.faceToward(this.app.camera.position); n.setMode('talk'); this.lock(true);
    if (seen) await this.sayAll(who, SCRIPT.map.after);
    n.setMode('idle'); this.dlg.hide();
  }

  // ---------------------------------------------------------------- boats
  startAmbientBoats() { for (const b of this.ambientBoats) this.sail(b); }
  sail(b) {
    const s = b.userData.sail; gsap.killTweensOf(b.position);
    const from = b.position.x, to = s.dir > 0 ? 150 : -150, dur = Math.max(1, Math.abs(to - from) / s.speed);
    b.userData.tween = gsap.to(b.position, { x: to, z: s.z, duration: dur, ease: 'none', onComplete: () => { b.position.x = -150 * s.dir; this.sail(b); } });
  }
  /** At dusk the sailing boats come in and settle at the bank; in daylight they sail again. */
  setSettled(on) {
    if (on === this.settled) return; this.settled = on;
    if (on) {
      [[-14.5, -5.7, Math.PI / 2], [12.5, -5.7, Math.PI / 2]].forEach(([x, z, yaw], i) => { const b = this.sailers[i]; b.userData.tween?.kill(); gsap.killTweensOf(b.position); gsap.killTweensOf(b.rotation);
        const dist = Math.hypot(b.position.x - x, b.position.z - z);
        gsap.to(b.position, { x, z, duration: Math.max(8, dist / 7), ease: 'power2.inOut' }); gsap.to(b.rotation, { y: yaw, duration: 6, delay: 1, ease: 'power2.inOut' }); });
    } else {
      this.sailers.forEach((b, i) => { gsap.killTweensOf(b.position); gsap.killTweensOf(b.rotation); b.rotation.y = b.userData.sail.dir > 0 ? -Math.PI / 2 : Math.PI / 2; b.position.set(-140 * b.userData.sail.dir, WATER_Y, b.userData.sail.z); });
      this.startAmbientBoats();
    }
  }
  _boatPath(pts) { return new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, WATER_Y, z)), false, 'catmullrom', 0.4); }
  _place(boat, curve, u) {
    const p = curve.getPointAt(Math.min(1, Math.max(0, u))), t = curve.getTangentAt(Math.min(1, Math.max(0, u)));
    boat.position.x = p.x; boat.position.z = p.z; boat.rotation.y = Math.atan2(-t.x, -t.z);
  }
  // ---------------------------------------------------------------- guided river journey
  async journeyFlow(force = false) {
    const n = await this.approach('journey'), who = 'Kavi the boatman';
    n.setMode('talk'); const pick = await this.dlg.ask(who, SCRIPT.journey.ask, [{ value: 'yes', label: SCRIPT.journey.boardChoices.yes }, { value: 'no', label: SCRIPT.journey.boardChoices.no }]);
    this.dlg.hide(); n.setMode('idle');
    if (pick !== 'yes' && !force) return;
    await this.beginJourney();
    // the flow resumes (menu) only when the journey has ended
    await new Promise((res) => { this._journeyDone = res; });
  }
  async beginJourney() {
    const c = this.app.controls, b = this.boatB, seat = new THREE.Vector3(0, b.userData.deckY + 1.5, -1.3);
    this.journeyOn = true; this.busy = true; this.lock(true); this.hotspots.setEnabled(false); this.guideBtn.style.display = 'none';
    this._saved = { speed: c.speed, pos: c.pos.clone(), yaw: c.yaw };
    // climb aboard: the view glides to the passenger seat under the canopy, looking along the bow
    b.updateMatrixWorld(true); const target = b.localToWorld(seat.clone());
    await new Promise((res) => {
      gsap.killTweensOf(c.pos); gsap.killTweensOf(c);
      gsap.to(c.pos, { x: target.x, y: target.y, z: target.z, duration: 1.8, ease: 'power2.inOut', onUpdate: () => c.apply() });
      let dy = 0 - c.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      gsap.to(c, { yaw: c.yaw + dy, pitch: 0.0, duration: 1.8, ease: 'power2.inOut', onUpdate: () => c.apply(), onComplete: res });
    });
    if (!this.journeyOn) return;
    c.speed = 0; this.lock(false); this._rel = 0; this._lastYaw = c.yaw; this.journeyBoatYaw = b.rotation.y; this.jui.classList.add('show');
    const curve = this._boatPath([[BOAT_B.x, BOAT_B.z], [BOAT_B.x, -21], [9, -30], [-6, -36], [-50, -34], [-100, -30], [-128, -35], [-104, -43], [-50, -45], [4, -40], [12, -30], [BOAT_B.x + 1, -22]]);
    this._jh0 = this.hour; this.jcurve = curve; this.jlen = curve.getLength(); this.jS = { u: 0 }; this.jLine = -1;
    gsap.to(this.jS, { u: 1, duration: this.jlen / 4.2, ease: 'sine.inOut', onComplete: () => this.endJourney(false) });
  }
  updateJourney() {
    if (!this.journeyOn || !this.jcurve || !this.jS) return;
    const c = this.app.controls, b = this.boatB, u = this.jS.u;
    this._place(b, this.jcurve, u); b.updateMatrixWorld(true);
    const eye = b.localToWorld(new THREE.Vector3(0, b.userData.deckY + 1.5, -1.3)); eye.y += Math.sin(this.time * 1.15 + b.userData.ph) * 0.03;
    // keep the visitor's own look direction relative to the boat
    this._rel += c.yaw - this._lastYaw; c.yaw = b.rotation.y + this._rel; this._lastYaw = c.yaw; c.pitch = Math.max(-1.1, Math.min(1.1, c.pitch));
    c.pos.copy(eye); c.apply();
    // the sun sets during the ride: the hour eases towards dusk as the boat sails
    if (this._jh0 < 17.6) { const h = this._jh0 + (18.1 - this._jh0) * sstep(0.04, 0.92, u); this.setTime(h); const sl = this.app.ui.hud.slider; sl.value = String(h); this.app.ui.hud._fmt(h); }
    const L = SCRIPT.journey.lines, idx = Math.min(L.length - 1, Math.floor(u * L.length * 0.999));
    if (idx !== this.jLine) { this.jLine = idx; this.jcap.textContent = L[idx]; }
  }
  /** Finish (or abandon) the journey: fade, put the boat back at its mooring, return the visitor to the pier. */
  async endJourney(early) {
    if (!this.journeyOn || this._ending) return; this._ending = true;
    gsap.killTweensOf(this.jS); this.jui.classList.remove('show');
    const fade = document.getElementById('fade'), c = this.app.controls;
    await new Promise((r) => gsap.to(fade, { opacity: 1, duration: 0.6, onComplete: r }));
    this.boatB.position.set(BOAT_B.x, WATER_Y, BOAT_B.z); this.boatB.rotation.y = 0;
    c.speed = this._saved?.speed ?? 3.6; c.mode = 'walk'; c.pos.set(0.6, QUAY.top + c.eye, -8.4); c.footY = QUAY.top; c.yaw = Math.PI * 0.95; c.pitch = 0.02; c.apply();
    this.jcurve = null; this.journeyOn = false; this.guideBtn.style.display = '';
    await new Promise((r) => gsap.to(fade, { opacity: 0, duration: 0.9, onComplete: r }));
    this._ending = false; this.lock(true);
    const n = this.npcs.ferry; n.faceToward(this.app.camera.position); n.setMode('talk'); await this.say('Kavi the boatman', SCRIPT.journey.end); n.setMode('idle'); this.dlg.hide();
    this.lock(false); this.busy = false; const done = this._journeyDone; this._journeyDone = null; if (done) done();
    else { this.visited.add('journey'); this.guideMenu(true, SCRIPT.menuDone); }
  }

  // ---------------------------------------------------------------- day to dusk
  async duskFlow(force = false) {
    this.busy = true; this.lock(true); this.hotspots.setEnabled(false);
    this.guide.faceToward(this.app.camera.position); this.guide.setMode('talk');
    if (this.hour > 17.4 && !force) { await this.say(MERCHANT, SCRIPT.dusk.back); this.guide.setMode('idle'); this.dlg.hide(); this.busy = false; return this.guideMenu(true, SCRIPT.menuDone); }
    const pick = force ? 'yes' : await this.dlg.ask(MERCHANT, SCRIPT.dusk.ask, [{ value: 'yes', label: SCRIPT.dusk.choices.yes }, { value: 'no', label: SCRIPT.dusk.choices.no }]);
    this.dlg.hide(); this.guide.setMode('idle'); this.busy = false;
    if (pick !== 'yes') return this.guideMenu(true, SCRIPT.menuDone);
    this.lock(false); this.setObjective('The sun is setting. Look around.');
    await this.sunset();
    this.guide.faceToward(this.app.camera.position); this.busy = true; this.lock(true); this.guide.setMode('talk');
    await this.say(MERCHANT, SCRIPT.dusk.line); this.guide.setMode('idle'); this.dlg.hide(); this.busy = false; this.lock(false); this.setObjective('');
    this.visited.add('dusk'); this.enableHotspots();
  }
  /** Interpolate the hour: the existing day/night rig drives sky, sun, fog, lamps and the reflection map. */
  sunset() {
    const S = { h: this.hour }, slider = this.app.ui.hud.slider;
    gsap.killTweensOf(this._ts || {}); this._ts = S;
    return new Promise((res) => gsap.to(S, { h: 18.1, duration: 18, ease: 'sine.inOut', onUpdate: () => { this.setTime(S.h); slider.value = String(S.h); this.app.ui.hud._fmt(S.h); }, onComplete: res }));
  }
  /** 0 by day, rising from late afternoon to full dusk at the horizon. */
  updateDusk() {
    this.dusk = sstep(15.2, 18.1, this.hour);
    this.setSettled(this.hour > 17.0 ? true : this.hour < 15.5 ? false : this.settled);
    this.app.audio.target.birds = 0.5 * (1 - this.dusk * 0.7);
  }

  onEnter() {}
  dispose() {
    this.dead = true; this.activity?.close(); this.app.paused = false;
    gsap.killTweensOf(this.app.controls); gsap.killTweensOf(this.app.controls.pos); gsap.killTweensOf(this._ts || {}); gsap.killTweensOf(this.jS || {});
    for (const b of [...this.floaters]) { gsap.killTweensOf(b.position); gsap.killTweensOf(b.rotation); }
    window.removeEventListener('keydown', this._escKey);
    const dom = this.app.renderer.domElement; dom.removeEventListener('pointerdown', this._pd); dom.removeEventListener('pointerup', this._pu);
    this.cargoUi?.node.remove(); this.dlg?.dispose(); this.objective?.remove(); this.guideBtn?.remove(); this.jui?.remove();
    gsap.set(document.getElementById('fade'), { opacity: 0 });
    if (this.app.audio.dockSource === this) this.app.audio.dockSource = null;
    this.app.controls.speed = this._saved?.speed ?? this.app.controls.speed;
    this.app.controls.enabled = true;
    super.dispose();
  }
}
