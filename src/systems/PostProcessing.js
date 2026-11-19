import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/** Colour grade (saturation/contrast, warm highlights / cool shadows) + vignette, in linear HDR. */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, saturation: { value: 1.14 }, contrast: { value: 1.08 }, vignette: { value: 0.32 },
    shadowTint: { value: new THREE.Color(0.9, 0.98, 1.12) }, highlightTint: { value: new THREE.Color(1.1, 1.02, 0.92) },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float saturation, contrast, vignette; uniform vec3 shadowTint, highlightTint;
    varying vec2 vUv;
    void main(){
      vec4 tex = texture2D(tDiffuse, vUv);
      vec3 c = tex.rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = max((c - 0.18) * contrast + 0.18, 0.0);
      c = mix(vec3(l), c, saturation);
      c *= mix(shadowTint, highlightTint, smoothstep(0.03, 0.9, l));
      vec2 d = vUv - 0.5; float v = smoothstep(0.85, 0.2, length(d * vec2(1.0, 0.85)));
      c *= mix(1.0 - vignette, 1.0, v);
      gl_FragColor = vec4(c, tex.a);
    }`,
};

export const QUALITY = {
  low: { label: 'Low', post: false, ao: false, shadowSize: 1024, pixelRatio: 1 },
  medium: { label: 'Medium', post: true, ao: false, shadowSize: 2048, pixelRatio: 1.25 },
  high: { label: 'High', post: true, ao: true, shadowSize: 4096, pixelRatio: 1.75 },
};

/**
 * EffectComposer pipeline: Render -> (GTAO) -> Bloom -> Grade/Vignette -> Output (ACES + sRGB).
 * Low quality bypasses the composer entirely and renders straight to the canvas
 * (the renderer's own ACES tone mapping + sRGB output still apply).
 */
export class PostProcessing {
  constructor(renderer, app) {
    this.renderer = renderer; this.app = app;
    this.composer = null; this.passes = {};
    this.settings = QUALITY.medium;
    this.scene = null; this.camera = null;
  }
  setQuality(key) {
    this.settings = QUALITY[key];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.settings.pixelRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this._build();
  }
  setScene(scene, camera) { this.scene = scene; this.camera = camera; this._build(); }
  _build() {
    this._disposeComposer();
    if (!this.settings.post || !this.scene) return;
    const w = window.innerWidth, h = window.innerHeight, pr = this.renderer.getPixelRatio();
    const rt = new THREE.WebGLRenderTarget(w * pr, h * pr, { type: THREE.HalfFloatType, samples: this.settings.ao ? 0 : 4 });
    const comp = new EffectComposer(this.renderer, rt);
    comp.setPixelRatio(pr); comp.setSize(w, h);
    comp.addPass(new RenderPass(this.scene, this.camera));
    if (this.settings.ao) {
      try {
        const ao = new GTAOPass(this.scene, this.camera, w, h);
        ao.output = GTAOPass.OUTPUT.Default;
        ao.updateGtaoMaterial({ radius: 1.6, distanceExponent: 1.5, thickness: 1.2, scale: 1.0, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
        ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
        // GTAO re-renders the scene with a normal override material; sprites, points and transparent
        // meshes (glows, water, dust) would show up as black quads, so hide them during that pass only.
        const origRender = ao.render.bind(ao), scene = this.scene;
        ao.render = (...args) => {
          const hidden = [];
          scene.traverse((o) => { if (o.visible && (o.isSprite || o.isPoints || (o.isMesh && o.material && !Array.isArray(o.material) && (o.material.transparent || o.material.blending === THREE.AdditiveBlending)))) { o.visible = false; hidden.push(o); } });
          origRender(...args);
          hidden.forEach((o) => { o.visible = true; });
        };
        comp.addPass(ao); this.passes.ao = ao;
      } catch (e) { console.warn('GTAO unavailable', e); }
    }
    const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.32, 0.7, 0.92);
    comp.addPass(bloom); this.passes.bloom = bloom;
    const grade = new ShaderPass(GradeShader); comp.addPass(grade); this.passes.grade = grade;
    comp.addPass(new OutputPass());
    this.composer = comp;
  }
  /** Per-scene look overrides. */
  applyLook({ bloom, saturation, contrast, vignette } = {}) {
    const p = this.passes;
    if (p.bloom && bloom) { p.bloom.strength = bloom.strength ?? p.bloom.strength; p.bloom.threshold = bloom.threshold ?? p.bloom.threshold; p.bloom.radius = bloom.radius ?? p.bloom.radius; }
    if (p.grade) {
      if (saturation !== undefined) p.grade.uniforms.saturation.value = saturation;
      if (contrast !== undefined) p.grade.uniforms.contrast.value = contrast;
      if (vignette !== undefined) p.grade.uniforms.vignette.value = vignette;
    }
  }
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
  }
  render() {
    if (!this.scene) return;
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
  _disposeComposer() {
    if (!this.composer) return;
    for (const p of this.composer.passes) p.dispose?.();
    this.composer.renderTarget1.dispose(); this.composer.renderTarget2.dispose();
    this.composer = null; this.passes = {};
  }
  dispose() { this._disposeComposer(); }
}
