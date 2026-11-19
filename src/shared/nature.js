import * as THREE from 'three';
import { rng } from './textures.js';
import { makeGroundMaterial } from './materials.js';

/** Flat-shaded silhouette ridge (extruded outline) for far-off hills. */
export function createRidge({ width = 900, height = 40, color = 0x7a86a8, seed = 1, depth = 6 }) {
  const R = rng(seed);
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, -20);
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const x = -width / 2 + (i / n) * width;
    const hh = height * (0.35 + 0.65 * Math.abs(Math.sin(i * 0.45 + seed) * 0.6 + (R() - 0.5) * 0.8));
    shape.lineTo(x, hh);
  }
  shape.lineTo(width / 2, -20);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }));
  return mesh;
}

/** Large ground plane with world-projected texture (dusty earth or grassy). */
export function createGround(size = 800, kind = 'earth', y = 0) {
  const geo = new THREE.PlaneGeometry(size, size);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, makeGroundMaterial(kind));
  mesh.position.y = y;
  mesh.receiveShadow = true;
  return mesh;
}

/** Scatter helper: returns [x,y,z] points inside a rect avoiding rectangles. */
export function scatter(count, rect, { avoid = [], y = 0, seed = 2 } = {}) {
  const R = rng(seed);
  const out = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 40) {
    const x = rect[0] + R() * (rect[1] - rect[0]), z = rect[2] + R() * (rect[3] - rect[2]);
    if (avoid.some((a) => x > a[0] && x < a[1] && z > a[2] && z < a[3])) continue;
    out.push([x, typeof y === 'function' ? y(x, z) : y, z]);
  }
  return out;
}
