import * as THREE from 'three';
import { getPotteryTexture } from '../shared/textures.js';
import { PALETTE } from '../shared/palette.js';

/**
 * Real 3D trade goods for the boat-loading interaction. Each is a small group with its base at y = 0.
 * Kinds: sack (stitched cloth sack tied with rope), beads (woven basket heaped with coloured beads),
 * jar (red-slip pottery jar), bowls (a stack of pottery bowls), basket (woven basket of cloth and goods).
 */
let weave = null;
function weaveMap() {
  if (weave) return weave;
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#b8884a'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#d4a866' : '#9a6c36'; if ((i + j) % 2) x.fillRect(i * 16, j * 16 + 2, 16, 11); else x.fillRect(i * 16 + 2, j * 16, 11, 16); }
  weave = new THREE.CanvasTexture(c); weave.wrapS = weave.wrapT = THREE.RepeatWrapping; weave.colorSpace = THREE.SRGBColorSpace; return weave;
}
const mat = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...o });
const mesh = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; return o; };

function basketShell(r0, r1, h) {
  const t = weaveMap().clone(); t.needsUpdate = true; t.repeat.set(5, 2);
  const m = mat({ map: t, side: THREE.DoubleSide });
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(r1, r0, h, 20, 1, true), m, 0, h / 2, 0));
  g.add(mesh(new THREE.CircleGeometry(r0, 16).rotateX(-Math.PI / 2), m, 0, 0.01, 0));
  const rim = mesh(new THREE.TorusGeometry(r1, 0.022, 6, 24).rotateX(Math.PI / 2), mat({ color: 0x8a5a2a }), 0, h, 0); g.add(rim);
  return g;
}
function sack(tone = 0xc8a46c) {
  const g = new THREE.Group(), t = weaveMap().clone(); t.needsUpdate = true; t.repeat.set(3, 3);
  const body = new THREE.SphereGeometry(0.33, 18, 14); const p = body.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = Math.sin(x * 19) * Math.cos(z * 17) * 0.018; p.setXYZ(i, x * 1.05 + n, y * 1.2 + (y < 0 ? n : 0), z * 0.92 + n); }
  body.computeVertexNormals();
  const m = mat({ color: tone, map: t, roughness: 0.95 });
  g.add(mesh(body, m, 0, 0.36, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.12, 10), m, 0, 0.68, 0));
  g.add(mesh(new THREE.ConeGeometry(0.15, 0.14, 10, 1, true), mat({ color: tone, map: t, side: THREE.DoubleSide }), 0, 0.82, 0));
  g.add(mesh(new THREE.TorusGeometry(0.115, 0.022, 6, 14).rotateX(Math.PI / 2), mat({ color: 0x5a3a22 }), 0, 0.72, 0));
  g.add(mesh(new THREE.BoxGeometry(0.02, 0.5, 0.012), mat({ color: 0x4a3322 }), 0.18, 0.38, 0.29));      // stitched seam
  return g;
}
function beads() {
  const g = basketShell(0.2, 0.3, 0.26);
  const cols = [0xc0392b, 0x2d4ea0, 0x1fa6a0, 0xe0a030, 0xf2ead8, 0x8a3a2a].map((c) => new THREE.Color(c));
  const N = 140, inst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.032, 8, 6), mat({ roughness: 0.3, metalness: 0.05 }), N), M = new THREE.Matrix4();
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.27, y = 0.19 + (1 - r / 0.27) * 0.1 + Math.random() * 0.03;
    inst.setMatrixAt(i, M.makeTranslation(Math.cos(a) * r, y, Math.sin(a) * r)); inst.setColorAt(i, cols[i % cols.length]);
  }
  inst.castShadow = true; g.add(inst);
  const str = mesh(new THREE.TorusGeometry(0.13, 0.012, 6, 20, Math.PI * 1.4), mat({ color: 0xc0392b, roughness: 0.4 }), 0.06, 0.33, 0.18); str.rotation.set(0.6, 0.4, 0.2); g.add(str);   // a strand hanging over the rim
  return g;
}
const potMat = () => mat({ map: getPotteryTexture().map, roughness: 0.55 });
const lathe = (prof, segs = 18) => new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), segs);
function jar() {
  const g = new THREE.Group();
  g.add(mesh(lathe([[0, 0], [0.14, 0], [0.27, 0.1], [0.36, 0.3], [0.33, 0.52], [0.2, 0.68], [0.15, 0.78], [0.19, 0.86], [0.16, 0.88], [0.12, 0.8], [0, 0.8]]), potMat()));
  for (const s of [-1, 1]) g.add(mesh(new THREE.TorusGeometry(0.07, 0.018, 6, 10, Math.PI).rotateZ(s > 0 ? -Math.PI / 2 : Math.PI / 2), mat({ color: 0x8a3a22 }), s * 0.3, 0.58, 0));
  return g;
}
function bowls() {
  const g = new THREE.Group(), m = potMat();
  for (let i = 0; i < 3; i++) { const b = mesh(lathe([[0, 0], [0.1, 0], [0.22, 0.05], [0.32, 0.17], [0.3, 0.18], [0.2, 0.08], [0.1, 0.03], [0, 0.03]], 20), m, (i - 1) * 0.04, i * 0.06, 0); b.rotation.y = i; g.add(b); }
  g.add(mesh(lathe([[0, 0], [0.12, 0], [0.26, 0.04], [0.4, 0.2], [0.38, 0.22], [0.24, 0.09], [0.12, 0.04], [0, 0.04]], 22), m, 0.05, 0.18, 0.02));
  return g;
}
function basket() {
  const g = basketShell(0.24, 0.34, 0.3);
  const cloth = [0x2d2f6b, 0x9d2235, 0xd9a23a, 0x1fa6a0];
  cloth.forEach((c, i) => { const b = mesh(new THREE.BoxGeometry(0.4 - i * 0.02, 0.07, 0.3), mat({ color: c, roughness: 1 }), 0, 0.22 + i * 0.07, 0); b.rotation.y = i * 0.35; g.add(b); });
  for (const [x, z] of [[-0.1, 0.08], [0.12, -0.06]]) g.add(mesh(new THREE.SphereGeometry(0.07, 10, 8), mat({ color: 0xb4482a, roughness: 0.5 }), x, 0.55, z));
  g.add(mesh(new THREE.BoxGeometry(0.2, 0.04, 0.06), mat({ color: PALETTE.copper, metalness: 0.7, roughness: 0.4 }), 0.0, 0.56, -0.12));
  const h = mesh(new THREE.TorusGeometry(0.3, 0.02, 6, 20, Math.PI), mat({ color: 0x8a5a2a }), 0, 0.3, 0); g.add(h);
  return g;
}
const MAKERS = { sack, beads, jar, bowls, basket };

/** Eight items: two sacks, two bead baskets, a jar, a stack of bowls, two goods baskets. */
export const CARGO_KINDS = ['sack', 'beads', 'jar', 'bowls', 'sack', 'basket', 'beads', 'basket'];
export function createCargoItem(kind, i) {
  const g = kind === 'sack' ? sack(i % 2 ? 0xc8a46c : 0xb98f55) : MAKERS[kind]();
  g.userData.kind = kind; g.userData.idx = i; return g;
}
