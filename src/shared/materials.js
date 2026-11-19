import * as THREE from 'three';
import {
  getBrickTextures, getPlasterTextures, getStoneTextures, getWoodTextures,
  getGroundTextures, getBitumenTextures,
} from './textures.js';
import { PALETTE } from './palette.js';

/**
 * Patches a MeshStandardMaterial so its texture coordinates come from WORLD position
 * (box-projected per dominant face axis). That lets one unit-cube InstancedMesh be
 * scaled to any wall / house / stair size without stretching the brick pattern.
 */
export function useWorldUV(material, scale) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <uv_vertex>',
      `#include <uv_vertex>
      {
        mat4 wm = modelMatrix;
        #ifdef USE_INSTANCING
          wm = wm * instanceMatrix;
        #endif
        vec3 wpos = (wm * vec4(position, 1.0)).xyz;
        vec3 wn = abs(normalize(mat3(wm) * normal));
        vec2 wuv = wn.y > 0.5 ? wpos.xz : (wn.x > wn.z ? vec2(wpos.z, wpos.y) : vec2(wpos.x, wpos.y));
        wuv *= ${scale.toFixed(5)};
        #ifdef USE_MAP
          vMapUv = wuv;
        #endif
        #ifdef USE_NORMALMAP
          vNormalMapUv = wuv;
        #endif
        #ifdef USE_ROUGHNESSMAP
          vRoughnessMapUv = wuv;
        #endif
      }`
    );
  };
  material.customProgramCacheKey = () => 'worldUV' + scale.toFixed(5);
  return material;
}

/**
 * Adds wind sway to a material's vertex shader. mode 'height' sways by local y (reeds, tree
 * crowns); mode 'uvx' sways by uv.x (cloth hanging from a pole at u=0).
 */
export function useWind(material, uTime, { amp = 0.1, speed = 1.6, mode = 'height' } = {}) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    if (prev && prev !== Object.prototype.onBeforeCompile) prev(shader, renderer);
    shader.uniforms.uTime = uTime;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      {
        mat4 wm2 = modelMatrix;
        #ifdef USE_INSTANCING
          wm2 = wm2 * instanceMatrix;
        #endif
        vec3 base = wm2[3].xyz;
        float ph = base.x * 0.35 + base.z * 0.27;
        float w = ${mode === 'uvx' ? 'uv.x' : 'max(position.y, 0.0)'};
        w = ${mode === 'uvx' ? 'w * w' : 'w * w * 0.5'};
        float gust = sin(uTime * ${speed.toFixed(2)} + ph) + 0.5 * sin(uTime * ${(speed * 2.3).toFixed(2)} + ph * 1.7);
        transformed.x += gust * ${amp.toFixed(3)} * w;
        transformed.z += cos(uTime * ${(speed * 0.8).toFixed(2)} + ph) * ${(amp * 0.6).toFixed(3)} * w;
        ${mode === 'uvx' ? 'transformed.y += sin(uTime * 3.0 + position.x * 2.0 + ph) * ' + (amp * 0.4).toFixed(3) + ' * w;' : ''}
      }`
    );
  };
  material.customProgramCacheKey = () => 'wind' + mode + amp + speed + (prev ? 'p' : '');
  return material;
}

function texturedStd(texSet, extra = {}, scale) {
  const m = new THREE.MeshStandardMaterial({
    map: texSet.map,
    normalMap: texSet.normalMap,
    normalScale: new THREE.Vector2(1, 1),
    roughnessMap: texSet.roughnessMap || null,
    roughness: 1,
    metalness: 0,
    ...extra,
  });
  return useWorldUV(m, scale ?? texSet.scale);
}

export const makeBrickMaterial = () => texturedStd(getBrickTextures(), { roughness: 0.95 });
export const makePlasterMaterial = () => texturedStd(getPlasterTextures(), { roughness: 1 });
export const makeStoneMaterial = () => texturedStd(getStoneTextures(), { roughness: 1 });
export const makeWoodMaterial = () => texturedStd(getWoodTextures(), { roughness: 0.9 });
export const makeBitumenMaterial = () => texturedStd(getBitumenTextures(), { roughness: 1, color: 0xffffff });
export function makeGroundMaterial(kind = 'earth') {
  const t = getGroundTextures(kind);
  const m = texturedStd(t, { roughness: 1 });
  return m;
}

/** Plain painted material, flat-shaded low-poly look (clothes, trees, props). */
export function makeFlat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true, ...extra });
}

export function makeMetal(color = PALETTE.bronze) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.85, flatShading: true });
}
