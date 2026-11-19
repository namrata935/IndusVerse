import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

/**
 * Load /public/models/<name>.glb. If the file is missing (Vite's dev server answers unknown
 * URLs with index.html, so we sniff the "glTF" magic bytes) or fails to parse, the procedural
 * `fallback()` object is returned instead — scenes never break for lack of assets.
 *
 *   const cart = await loadModel('bullock_cart', () => createBullockCart());
 */
export async function loadModel(name, fallback, { scale = 1 } = {}) {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}models/${name}.glb`);
    if (!res.ok) throw new Error('missing');
    const buf = await res.arrayBuffer();
    const magic = new TextDecoder().decode(buf.slice(0, 4));
    if (magic !== 'glTF') throw new Error('not a glb');
    const gltf = await new Promise((resolve, reject) => loader.parse(buf, '', resolve, reject));
    const obj = gltf.scene;
    obj.scale.multiplyScalar(scale);
    obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return obj;
  } catch {
    return fallback();
  }
}
