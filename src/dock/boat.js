import * as THREE from 'three';
import { makeWoodMaterial, makeFlat } from '../shared/materials.js';

/**
 * A flat-bottomed Harappan-style river boat: a lofted hull outline, a dark hold, thwarts,
 * a long steering oar and (optionally) a reed canopy. Origin = waterline, bow toward -z.
 * userData: deckY, hold (the dark hold mesh, brightened while cargo hovers over it). Reuses the shared wood / flat materials.
 */
export const BOAT_DECK = 0.46;

export function createBoat({ length = 9, width = 2.6, canopy = false, trim = 0xc4512c } = {}) {
  const g = new THREE.Group();
  const wood = makeWoodMaterial();
  const L = length / 2, W = width / 2;
  const sh = new THREE.Shape();
  sh.moveTo(-W * 0.82, -L);                       // stern (shape +y = bow)
  sh.lineTo(W * 0.82, -L);
  sh.quadraticCurveTo(W * 1.05, -L * 0.1, W * 0.7, L * 0.55);
  sh.quadraticCurveTo(W * 0.35, L * 0.9, 0, L);
  sh.quadraticCurveTo(-W * 0.35, L * 0.9, -W * 0.7, L * 0.55);
  sh.quadraticCurveTo(-W * 1.05, -L * 0.1, -W * 0.82, -L);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.78, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.04, bevelSegments: 1, curveSegments: 10 });
  geo.rotateX(-Math.PI / 2); geo.translate(0, -0.32, 0);
  // texture coords for the extruded hull are in model units already; tint it a little darker like wet timber
  const hull = new THREE.Mesh(geo, wood); hull.castShadow = hull.receiveShadow = true; g.add(hull);
  // the hold: a dark inset so cargo reads against it
  const hold = new THREE.Shape(); const k = 0.74;
  hold.moveTo(-W * 0.82 * k, -L * 0.9); hold.lineTo(W * 0.82 * k, -L * 0.9); hold.quadraticCurveTo(W * 1.0 * k, -L * 0.1, W * 0.7 * k, L * 0.45); hold.quadraticCurveTo(W * 0.3 * k, L * 0.72, 0, L * 0.78); hold.quadraticCurveTo(-W * 0.3 * k, L * 0.72, -W * 0.7 * k, L * 0.45); hold.quadraticCurveTo(-W * 1.0 * k, -L * 0.1, -W * 0.82 * k, -L * 0.9);
  const holdGeo = new THREE.ShapeGeometry(hold, 8); holdGeo.rotateX(-Math.PI / 2);
  const holdM = new THREE.Mesh(holdGeo, makeFlat(0x3b2616, { side: THREE.DoubleSide })); holdM.position.y = BOAT_DECK + 0.005; holdM.receiveShadow = true; g.add(holdM);
  // painted rail stripe at the bow and stern, thwarts, ropes
  const accent = makeFlat(trim);
  const box = (m, x, y, z, sx, sy, sz, ry = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); b.position.set(x, y, z); b.rotation.y = ry; b.castShadow = b.receiveShadow = true; g.add(b); return b; };
  box(accent, 0, BOAT_DECK + 0.06, L - 0.12, width * 0.82, 0.14, 0.22);
  box(accent, 0, BOAT_DECK + 0.06, -L + 0.45, width * 0.32, 0.14, 0.2);
  for (const z of [1.4, 3.0]) box(wood, 0, BOAT_DECK + 0.14, z, width * 0.86, 0.1, 0.28);
  // long steering oar over the stern
  const oar = box(wood, W * 0.55, 0.95, L + 0.5, 0.1, 0.1, 2.9); oar.rotation.x = 0.28;
  box(wood, W * 0.55, 0.28, L + 1.55, 0.34, 0.06, 0.8);
  // reed bundles curling at the bow
  const reed = makeFlat(0xb4b45a); const bw = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 1.0, 6), reed); bw.position.set(0, BOAT_DECK + 0.45, -L + 0.15); bw.rotation.x = -0.55; g.add(bw);
  if (canopy) {
    const mat = makeFlat(0xc9a468, { side: THREE.DoubleSide });
    for (const [x, z] of [[-W * 0.55, -0.4], [W * 0.55, -0.4], [-W * 0.55, 2.4], [W * 0.55, 2.4]]) box(wood, x, BOAT_DECK + 0.85, z, 0.08, 1.7, 0.08);
    const roofA = box(mat, -W * 0.3, BOAT_DECK + 1.85, 1.0, W * 0.75, 0.06, 3.1); roofA.rotation.z = 0.35;
    const roofB = box(mat, W * 0.3, BOAT_DECK + 1.85, 1.0, W * 0.75, 0.06, 3.1); roofB.rotation.z = -0.35;
  }
  g.userData = { deckY: BOAT_DECK, hold: holdM, dispose() {} };
  return g;
}
