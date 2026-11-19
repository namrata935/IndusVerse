import * as THREE from 'three';
import { makeGlowSprite } from '../shared/props.js';

/**
 * Glowing interactive markers. Click one (raycast) or walk within its radius to activate it.
 * Each hotspot: {id, position, color, radius, onActivate}. Markers pulse, bob and billboard.
 */
export class Hotspots {
  constructor(parent) {
    this.group = new THREE.Group();
    parent.add(this.group);
    this.items = [];
    this.ray = new THREE.Raycaster();
    this.active = null;
    this.cooldown = 0;
    this.enabled = true;
  }
  add({ id, position, color = 0x1fa6a0, radius = 3, size = 1, onActivate, kind = 'info' }) {
    const g = new THREE.Group();
    g.position.copy(position);
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.2 * size, 0), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42 * size, 0.025 * size, 6, 28), new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity: 0.9 }));
    const halo = makeGlowSprite(color, 2.2 * size, 0.85);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(1.0 * size, 10, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    hit.userData.hotspotId = id;
    g.add(core, ring, halo, hit);
    this.group.add(g);
    const item = { id, position: g.position, color, radius, onActivate, g, core, ring, halo, hit, inside: false, phase: Math.random() * 6, base: position.y, size, kind };
    this.items.push(item);
    return item;
  }
  pick(camera, ndc) {
    if (!this.enabled) return null;
    this.ray.setFromCamera(ndc, camera);
    const hits = this.ray.intersectObjects(this.items.map((i) => i.hit), false);
    return hits.length ? this.items.find((i) => i.hit === hits[0].object) : null;
  }
  activate(item) {
    if (this.cooldown > 0) return;
    this.active = item; this.cooldown = 0.6;
    item.onActivate?.(item);
  }
  update(dt, t, camera) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    const cp = camera.position;
    for (const it of this.items) {
      const k = 1 + 0.12 * Math.sin(t * 3 + it.phase);
      it.g.position.y = it.base + Math.sin(t * 1.6 + it.phase) * 0.12;
      it.core.rotation.y += dt * 1.4; it.core.scale.setScalar(k);
      it.ring.rotation.x = Math.PI / 2 + Math.sin(t + it.phase) * 0.35; it.ring.rotation.z += dt * 0.8;
      it.halo.material.opacity = 0.55 + 0.3 * Math.sin(t * 3 + it.phase);
      if (!this.enabled) continue;
      const d = it.position.distanceTo(cp);
      if (d < it.radius && !it.inside) { it.inside = true; this.activate(it); }
      else if (d > it.radius * 1.5) it.inside = false;
    }
  }
  setEnabled(v) { this.enabled = v; this.group.visible = v; }
  dispose() {
    this.group.traverse((o) => { o.geometry?.dispose(); if (o.material) { o.material.map = null; o.material.dispose(); } });
    this.group.removeFromParent();
    this.items.length = 0;
  }
}
