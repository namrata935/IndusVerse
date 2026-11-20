import * as THREE from 'three';

/**
 * A stylised low-poly "Dancing Girl" (the famous bronze from Mohenjo-daro): slim figure,
 * one hand on the hip, the other arm bent forward, weight on one leg, chin lifted, hair in a
 * bun, a heavy necklace and a stack of bangles on the arm. Built from primitives and scaled
 * so it is about 1.5 units tall with its feet at y = 0. One builder, reused for every stage.
 */
export function createDancingGirl(material, bangleMaterial = material) {
  const g = new THREE.Group(), parts = [], bangles = [];
  const add = (mesh, mat = material) => { mesh.material = mat; mesh.castShadow = true; g.add(mesh); (mat === material ? parts : bangles).push(mesh); return mesh; };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const limb = (a, b, r1, r2, seg = 10) => {
    const len = a.distanceTo(b), m = new THREE.Mesh(new THREE.CylinderGeometry(r2 * 1.3, r1 * 1.3, len, seg));
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
    return add(m);
  };
  const ball = (p, rx, ry = rx, rz = rx) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10)); m.scale.set(rx * 1.15, ry * 1.12, rz * 1.15); m.position.copy(p); return add(m); };
  const ring = (p, dir, r, tube = 0.012) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, 16)); m.position.copy(p);
    m.quaternion.setFromUnitVectors(V(0, 0, 1), dir.clone().normalize()); return add(m, bangleMaterial);
  };

  // legs: left carries the weight, right knee is bent and the foot lifted behind
  const hipL = V(-0.075, 0.82, 0), kneeL = V(-0.085, 0.43, 0.02), ankL = V(-0.09, 0.05, 0);
  const hipR = V(0.075, 0.82, 0), kneeR = V(0.15, 0.47, 0.13), ankR = V(0.1, 0.12, -0.1);
  limb(hipL, kneeL, 0.062, 0.045); limb(kneeL, ankL, 0.045, 0.03);
  limb(hipR, kneeR, 0.062, 0.045); limb(kneeR, ankR, 0.045, 0.028);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.17))).position.set(-0.09, 0.02, 0.04);
  const toe = add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.15))); toe.position.set(0.1, 0.09, -0.04); toe.rotation.x = 0.6;
  // pelvis, waist, torso
  ball(V(0, 0.84, 0), 0.115, 0.08, 0.08);
  const torso = new THREE.Group(); torso.rotation.z = 0.09; torso.position.set(0, 0.84, 0); g.add(torso);
  const tmp = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.075, 0.44, 12)); tmp.position.y = 0.22; tmp.material = material; tmp.castShadow = true; torso.add(tmp); parts.push(tmp);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), material); chest.scale.set(0.125, 0.085, 0.085); chest.position.y = 0.4; chest.castShadow = true; torso.add(chest); parts.push(chest);
  const neckBase = V(0.02, 1.26, 0);
  limb(neckBase, V(0.0, 1.38, 0.01), 0.04, 0.034, 8);
  ball(V(0.0, 1.46, 0.015), 0.07, 0.085, 0.075).rotation.x = -0.2;                  // head, chin lifted
  ball(V(0.0, 1.5, -0.075), 0.06, 0.06, 0.05);                                       // hair bun
  const tail = ball(V(0.0, 1.43, -0.07), 0.05, 0.1, 0.04); tail.rotation.x = 0.2;
  // arms: right hand on hip, left arm bent forward and heavily bangled
  const shR = V(0.15, 1.24, 0), elR = V(0.27, 1.04, -0.02), haR = V(0.13, 0.9, 0.03);
  limb(shR, elR, 0.034, 0.028, 8); limb(elR, haR, 0.028, 0.02, 8); ball(haR, 0.03);
  const shL = V(-0.13, 1.25, 0), elL = V(-0.21, 1.02, 0.07), haL = V(-0.09, 0.84, 0.27);
  limb(shL, elL, 0.034, 0.028, 8); limb(elL, haL, 0.028, 0.02, 8); ball(haL, 0.03);
  for (let i = 0; i < 9; i++) { const t = 0.12 + i * 0.09, p = elL.clone().lerp(haL, t), d = haL.clone().sub(elL); ring(p, d, 0.05, 0.016); }  // bangle stack
  for (let i = 0; i < 4; i++) { const p = shR.clone().lerp(elR, 0.3 + i * 0.12); ring(p, elR.clone().sub(shR), 0.055, 0.016); }
  // necklace and pendant
  const neck = ring(V(0, 1.31, 0.01), V(0, 1, 0.25), 0.065, 0.014); neck.scale.set(1, 1, 1);
  const pend = ball(V(0, 1.2, 0.05), 0.022); bangles.push(pend);
  g.userData = { parts, bangles };
  return g;
}

/** Same figure, new materials (shares nothing but the recipe). */
export function setFigureMaterial(fig, mat, bangleMat = mat) {
  fig.traverse((o) => { if (o.isMesh) o.material = fig.userData.bangles.includes(o) ? bangleMat : mat; });
}
