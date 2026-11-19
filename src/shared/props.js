import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { makeFlat, makeMetal, useWind, makeWoodMaterial } from './materials.js';
import { getPotteryTexture, getClothTexture, getGlowTexture, rng } from './textures.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _e = new THREE.Euler();
const UP = new THREE.Vector3(0, 1, 0);

function shadowed(mesh, cast = true, receive = true) { mesh.castShadow = cast; mesh.receiveShadow = receive; return mesh; }

export function makeGlowSprite(color = 0xffb060, scale = 1, opacity = 1) {
  const m = new THREE.SpriteMaterial({ map: getGlowTexture().map, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(scale);
  return s;
}

/** Low-poly trees: 1 trunk InstancedMesh + 3 canopy InstancedMeshes (wind-swayed). */
export function createTrees(list, { uTime, seed = 9 } = {}) {
  const R = rng(seed);
  const g = new THREE.Group();
  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.24, 1, 6); trunkGeo.translate(0, 0.5, 0);
  const blobGeo = new THREE.IcosahedronGeometry(1, 1);
  const trunks = shadowed(new THREE.InstancedMesh(trunkGeo, makeFlat(0x5a3a26), list.length));
  const mk = () => {
    const mat = makeFlat(0xffffff);
    if (uTime) useWind(mat, uTime, { amp: 0.12, speed: 1.3 });
    return shadowed(new THREE.InstancedMesh(blobGeo, mat, list.length));
  };
  const blobs = [mk(), mk(), mk()];
  const greens = [PALETTE.leaf, PALETTE.leafDark, 0x7fa84a, 0x3f7f4a, 0x9bb34e];
  const offs = [[0, 1, 0, 1], [0.75, 0.72, 0.25, 0.75], [-0.6, 0.78, -0.45, 0.7]];
  list.forEach(([x, y, z, s = 1], i) => {
    const h = (3.4 + R() * 2.2) * s;
    _q.setFromAxisAngle(UP, R() * 6.28);
    _m.compose(_p.set(x, y, z), _q, _s.set(s, h, s));
    trunks.setMatrixAt(i, _m);
    const base = _c.set(greens[Math.floor(R() * greens.length)]).clone();
    offs.forEach(([ox, oy, oz, os], b) => {
      const r = (1.5 + R() * 0.5) * os * s;
      _m.compose(_p.set(x + ox * 1.1 * s, y + h * 0.85 + oy * 1.1 * s, z + oz * 1.1 * s), _q.setFromAxisAngle(UP, R() * 6), _s.set(r, r * 0.8, r));
      blobs[b].setMatrixAt(i, _m);
      blobs[b].setColorAt(i, _c.copy(base).multiplyScalar(0.85 + R() * 0.3));
    });
    trunks.setColorAt?.(i, _c.set(0xffffff));
  });
  [trunks, ...blobs].forEach((m) => { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; g.add(m); });
  return g;
}

/** Instanced reeds / grass blades with strong wind sway. */
export function createReeds(list, { uTime, seed = 5 } = {}) {
  const R = rng(seed);
  const geo = new THREE.ConeGeometry(0.05, 1, 3, 4, true); geo.translate(0, 0.5, 0);
  const mat = makeFlat(0xffffff, { side: THREE.DoubleSide });
  if (uTime) useWind(mat, uTime, { amp: 0.28, speed: 1.9 });
  const mesh = new THREE.InstancedMesh(geo, mat, list.length);
  const cols = [PALETTE.reed, 0x5f9040, 0x9bb44f, 0x3f7a3a, 0xb8b45a];
  list.forEach(([x, y, z], i) => {
    const h = 1.1 + R() * 1.6;
    _e.set((R() - 0.5) * 0.25, R() * 6.28, (R() - 0.5) * 0.25);
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e), _s.set(1, h, 1));
    mesh.setMatrixAt(i, _m);
    mesh.setColorAt(i, _c.set(cols[Math.floor(R() * cols.length)]));
  });
  mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = false; mesh.receiveShadow = true; mesh.frustumCulled = false;
  return mesh;
}

/** Red-slip painted pottery (lathe) — instanced jars of 3 profiles. */
export function createPots(list) {
  const tex = getPotteryTexture().map;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0 });
  const profiles = [
    [[0, 0], [0.22, 0], [0.3, 0.2], [0.34, 0.45], [0.26, 0.7], [0.14, 0.82], [0.17, 0.9], [0, 0.9]],
    [[0, 0], [0.15, 0], [0.22, 0.12], [0.26, 0.3], [0.2, 0.46], [0.22, 0.52], [0, 0.52]],
    [[0, 0], [0.18, 0], [0.4, 0.15], [0.46, 0.3], [0.4, 0.5], [0.46, 0.55], [0, 0.55]],
  ];
  const g = new THREE.Group();
  const buckets = profiles.map(() => []);
  list.forEach((p, i) => buckets[i % 3].push(p));
  buckets.forEach((arr, k) => {
    if (!arr.length) return;
    const geo = new THREE.LatheGeometry(profiles[k].map(([r, y]) => new THREE.Vector2(r, y)), 14);
    const mesh = shadowed(new THREE.InstancedMesh(geo, mat, arr.length));
    arr.forEach(([x, y, z, s = 1], i) => {
      _m.compose(_p.set(x, y, z), _q.setFromAxisAngle(UP, Math.random() * 6.28), _s.setScalar(s));
      mesh.setMatrixAt(i, _m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    g.add(mesh);
  });
  return g;
}

/** Bullock cart with hooped cloth hood, two zebu-like bullocks and a load. */
export function createBullockCart({ cloth = PALETTE.cloth[0], uTime } = {}) {
  const g = new THREE.Group();
  const wood = makeWoodMaterial();
  const ring = makeFlat(0x3a2a20);
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = shadowed(new THREE.Mesh(geo, mat)); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m; };
  add(new THREE.BoxGeometry(2.0, 0.12, 1.2), wood, 0, 0.78, 0);
  for (const z of [-0.6, 0.6]) add(new THREE.BoxGeometry(2.0, 0.28, 0.08), wood, 0, 0.98, z);
  add(new THREE.BoxGeometry(0.08, 0.28, 1.2), wood, -1.0, 0.98, 0);
  // wheels (solid disc + hub + rim) – chunky Indus-style
  const wheelGeo = new THREE.CylinderGeometry(0.58, 0.58, 0.1, 16);
  const hubGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.2, 8);
  for (const z of [-0.7, 0.7]) {
    add(wheelGeo, wood, -0.2, 0.58, z, Math.PI / 2, 0, 0);
    add(new THREE.TorusGeometry(0.58, 0.04, 5, 16), ring, -0.2, 0.58, z, 0, 0, 0);
    add(hubGeo, ring, -0.2, 0.58, z, Math.PI / 2, 0, 0);
  }
  // shaft + yoke
  add(new THREE.BoxGeometry(2.2, 0.08, 0.1), wood, 1.9, 0.75, 0);
  add(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 6), wood, 3.0, 1.15, 0, Math.PI / 2, 0, 0);
  // cloth hood
  const hoodTex = getClothTexture([cloth, PALETTE.ochre, PALETTE.indigo]).map;
  const hoodMat = new THREE.MeshStandardMaterial({ map: hoodTex, side: THREE.DoubleSide, roughness: 0.95 });
  add(new THREE.CylinderGeometry(0.62, 0.62, 1.9, 12, 1, true, 0, Math.PI), hoodMat, 0, 0.84, 0, 0, 0, Math.PI / 2);
  // load: pots and sacks
  add(new THREE.SphereGeometry(0.3, 7, 5), makeFlat(PALETTE.ochre), 0.55, 1.0, 0.25);
  add(new THREE.SphereGeometry(0.28, 7, 5), makeFlat(0xc9a36b), 0.6, 1.0, -0.3);
  // bullocks
  const hide = [makeFlat(0xe9dcc4), makeFlat(0x9c6a43)];
  const horn = makeFlat(0xf0e6cf);
  [-0.42, 0.42].forEach((z, i) => {
    const b = new THREE.Group(); b.position.set(3.0, 0, z);
    const part = (geo, mat, x, y, zz, rx = 0, ry = 0, rz = 0) => { const m = shadowed(new THREE.Mesh(geo, mat)); m.position.set(x, y, zz); m.rotation.set(rx, ry, rz); b.add(m); return m; };
    part(new THREE.BoxGeometry(1.5, 0.7, 0.55), hide[i], 0.35, 1.0, 0);
    part(new THREE.SphereGeometry(0.28, 6, 5), hide[i], -0.2, 1.4, 0);        // hump
    part(new THREE.BoxGeometry(0.5, 0.36, 0.34), hide[i], 1.25, 1.25, 0, 0, 0, -0.3); // head
    part(new THREE.ConeGeometry(0.05, 0.4, 5), horn, 1.2, 1.55, 0.18, 0.5, 0, 0.4);
    part(new THREE.ConeGeometry(0.05, 0.4, 5), horn, 1.2, 1.55, -0.18, -0.5, 0, 0.4);
    for (const [lx, lz] of [[-0.25, -0.18], [-0.25, 0.18], [0.9, -0.18], [0.9, 0.18]]) part(new THREE.BoxGeometry(0.16, 0.7, 0.16), hide[i], lx, 0.35, lz);
    b.userData.head = b.children[2];
    g.add(b);
  });
  g.userData.dispose = () => { wood.dispose(); hoodMat.dispose(); };
  return g;
}

/** Oil-lamp post: carved wood + bronze bowl, glowing flame and a flickering point light. */
export function createLamp({ lamps, x = 0, y = 0, z = 0, height = 1.7, light = true, color = 0xffa24a }) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const post = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, height, 6), makeFlat(0x5a3a26)));
  post.position.y = height / 2;
  const bowl = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.1, 0.14, 8), makeMetal(PALETTE.bronze)));
  bowl.position.y = height + 0.05;
  const flame = makeGlowSprite(color, 0.55, 1);
  flame.position.y = height + 0.28;
  g.add(post, bowl, flame);
  let l = null;
  if (light) {
    l = new THREE.PointLight(color, 0, 14, 1.6);
    l.position.y = height + 0.3;
    g.add(l);
  }
  const rec = { light: l, flame, seed: Math.random() * 100, base: 14 };
  lamps.push(rec);
  return g;
}

/** Cloth banner on a pole: segmented plane with wind shader. */
export function createBanner({ uTime, colors = PALETTE.cloth, w = 1.2, h = 2.2, poleH = 3.6 }) {
  const g = new THREE.Group();
  const pole = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, poleH, 6), makeFlat(0x4a2d1d)));
  pole.position.y = poleH / 2;
  const tex = getClothTexture(colors.slice(0, 4)).map;
  const mat = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.95 });
  useWind(mat, uTime, { amp: 0.35, speed: 2.2, mode: 'uvx' });
  const geo = new THREE.PlaneGeometry(w, h, 10, 12);
  geo.translate(w / 2, 0, 0);
  const cloth = shadowed(new THREE.Mesh(geo, mat), true, false);
  cloth.position.set(0.05, poleH - h / 2 - 0.1, 0);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), makeMetal(PALETTE.copper));
  crown.position.y = poleH + 0.05;
  g.add(pole, cloth, crown);
  return g;
}

export function createAwning({ uTime, w = 4, d = 2.5, colors = [0xc23b22, 0xd9a23a, 0x1fa6a0, 0x2d2f6b] }) {
  const g = new THREE.Group();
  const tex = getClothTexture(colors).map;
  const mat = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.95 });
  useWind(mat, uTime, { amp: 0.06, speed: 1.8, mode: 'uvx' });
  const geo = new THREE.PlaneGeometry(w, d, 12, 6); geo.rotateX(-Math.PI / 2 + 0.18);
  const sheet = shadowed(new THREE.Mesh(geo, mat), true, true);
  sheet.position.set(0, 2.6, 0);
  g.add(sheet);
  const wood = makeFlat(0x5a3a26);
  for (const [px, pz, ph] of [[-w / 2, -d / 2, 2.7], [w / 2, -d / 2, 2.7], [-w / 2, d / 2, 2.3], [w / 2, d / 2, 2.3]]) {
    const p = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, ph, 5), wood)); p.position.set(px, ph / 2, pz); g.add(p);
  }
  return g;
}

/** Birds circling above a point. */
export function createBirds(count, { center = [0, 25, 0], radius = 40, spread = 10, seed = 12 } = {}) {
  const R = rng(seed);
  const g = new THREE.Group();
  const bodyGeo = new THREE.ConeGeometry(0.1, 0.5, 5); bodyGeo.rotateX(Math.PI / 2);
  const wingGeo = new THREE.PlaneGeometry(0.7, 0.22); wingGeo.translate(0.35, 0, 0);
  const birds = [];
  for (let i = 0; i < count; i++) {
    const white = R() < 0.6;
    const mat = new THREE.MeshStandardMaterial({ color: white ? 0xf6f1e6 : 0x8a6a52, roughness: 0.9, side: THREE.DoubleSide, flatShading: true });
    const b = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, mat);
    const wl = new THREE.Mesh(wingGeo, mat), wr = new THREE.Mesh(wingGeo, mat);
    wr.rotation.y = Math.PI;
    b.add(body, wl, wr);
    b.scale.setScalar(1.1 + R() * 0.6);
    b.userData = { a: R() * 6.28, r: radius * (0.5 + R() * 0.6), s: (0.12 + R() * 0.12) * (R() < 0.5 ? 1 : -1), h: center[1] + (R() - 0.5) * spread, ph: R() * 6, wl, wr, mat };
    g.add(b); birds.push(b);
  }
  const update = (dt, t) => {
    for (const b of birds) {
      const u = b.userData;
      u.a += u.s * dt * 0.7;
      const x = center[0] + Math.cos(u.a) * u.r, z = center[2] + Math.sin(u.a * 1.3) * u.r * 0.8;
      b.position.set(x, u.h + Math.sin(t * 0.5 + u.ph) * 1.5, z);
      b.rotation.y = -u.a * 1.0 + (u.s > 0 ? Math.PI : 0) - Math.PI / 2 + Math.cos(u.a * 1.3) * 0.0;
      const f = Math.sin(t * 7 + u.ph) * 0.6;
      u.wl.rotation.z = f; u.wr.rotation.z = -f;
    }
  };
  g.userData.dispose = () => birds.forEach((b) => b.userData.mat.dispose());
  return { group: g, update };
}

/** Floating dust motes that wrap around the viewer, catching warm light. */
export function createDust({ count = 260, box = 40, height = 14, color = 0xffe2b0, size = 0.07 } = {}) {
  const pos = new Float32Array(count * 3), vel = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * box; pos[i * 3 + 1] = Math.random() * height; pos[i * 3 + 2] = (Math.random() - 0.5) * box;
    vel[i * 3] = 0.15 + Math.random() * 0.3; vel[i * 3 + 1] = (Math.random() - 0.4) * 0.12; vel[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ map: getGlowTexture().map, color, size, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  const world = new Float32Array(pos);
  const update = (dt, focus, wind = 1) => {
    const p = geo.attributes.position.array;
    for (let i = 0; i < count; i++) {
      world[i * 3] += vel[i * 3] * dt * wind; world[i * 3 + 1] += vel[i * 3 + 1] * dt; world[i * 3 + 2] += vel[i * 3 + 2] * dt * wind;
      // wrap relative to focus point
      for (let a = 0; a < 3; a++) {
        const c = a === 1 ? Math.max(height / 2, focus.y) - 1 : (a === 0 ? focus.x : focus.z);
        const half = (a === 1 ? height : box) / 2;
        let d = world[i * 3 + a] - c;
        if (d > half) world[i * 3 + a] -= half * 2; else if (d < -half) world[i * 3 + a] += half * 2;
        p[i * 3 + a] = world[i * 3 + a];
      }
    }
    geo.attributes.position.needsUpdate = true;
  };
  return { points: pts, update };
}

/** Pile of grain: low cone with a rim of sacks. */
export function createGrainHeap(color = PALETTE.ochre) {
  const g = new THREE.Group();
  const heap = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.8, 0.7, 9), makeFlat(color)));
  heap.position.y = 0.35;
  g.add(heap);
  return g;
}
