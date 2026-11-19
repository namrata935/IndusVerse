import * as THREE from 'three';
import { getWaterNormal } from './textures.js';

/**
 * Animated water: two counter-scrolling normal-map layers (interference gives ripples),
 * sky reflections via an env map, plus expanding ring ripples spawned at random.
 */
export function createWater({ width, depth, color = 0x1aa5a8, opacity = 0.82, repeat = [3, 2], envMap = null, reflect = 1.3, rippleRings = 5, segments = 1 }) {
  const { normalMap } = getWaterNormal();
  const group = new THREE.Group();
  const nmA = normalMap.clone(); nmA.needsUpdate = true; nmA.repeat.set(repeat[0], repeat[1]);
  const nmB = normalMap.clone(); nmB.needsUpdate = true; nmB.repeat.set(repeat[0] * 1.7, repeat[1] * 1.7);
  const geo = new THREE.PlaneGeometry(width, depth, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const matA = new THREE.MeshPhysicalMaterial({
    color, roughness: 0.06, metalness: 0.0, transparent: true, opacity, normalMap: nmA,
    normalScale: new THREE.Vector2(0.55, 0.55), envMap, envMapIntensity: reflect, clearcoat: reflect > 0.8 ? 0.35 : 0.0, clearcoatRoughness: 0.05,
    specularIntensity: 1,
  });
  const base = new THREE.Mesh(geo, matA);
  base.receiveShadow = true;
  const matB = new THREE.MeshStandardMaterial({
    color: 0xcff6f4, roughness: 0.1, transparent: true, opacity: 0.09, normalMap: nmB,
    normalScale: new THREE.Vector2(0.9, 0.9), envMap, envMapIntensity: reflect * 0.7, depthWrite: false,
  });
  const top = new THREE.Mesh(geo, matB);
  top.position.y = 0.004;
  group.add(base, top);

  // expanding ripple rings
  const rings = [];
  const ringGeo = new THREE.RingGeometry(0.92, 1, 40);
  ringGeo.rotateX(-Math.PI / 2);
  for (let i = 0; i < rippleRings; i++) {
    const m = new THREE.MeshBasicMaterial({ color: 0xe9fbff, transparent: true, opacity: 0, depthWrite: false });
    const r = new THREE.Mesh(ringGeo, m);
    r.position.y = 0.012;
    r.userData = { age: Math.random() * 3, life: 2.6 + Math.random() * 1.5 };
    group.add(r);
    rings.push(r);
  }
  const place = (r) => {
    r.position.x = (Math.random() - 0.5) * (width - 1);
    r.position.z = (Math.random() - 0.5) * (depth - 1);
    r.userData.age = 0;
    r.userData.life = 2.4 + Math.random() * 1.8;
  };
  rings.forEach(place);
  let t = 0;
  const update = (dt) => {
    t += dt;
    nmA.offset.set(t * 0.012, t * 0.02);
    nmB.offset.set(-t * 0.018, t * 0.009);
    for (const r of rings) {
      r.userData.age += dt;
      const k = r.userData.age / r.userData.life;
      if (k >= 1) { place(r); continue; }
      const s = 0.1 + k * 1.1;
      r.scale.set(s, 1, s);
      r.material.opacity = (1 - k) * (k < 0.1 ? k * 10 : 1) * 0.5;
    }
  };
  const setEnv = (env) => { matA.envMap = env; matB.envMap = env; matA.needsUpdate = true; matB.needsUpdate = true; };
  group.userData.dispose = () => { nmA.dispose(); nmB.dispose(); };
  return { group, update, setEnv, materials: [matA, matB] };
}
