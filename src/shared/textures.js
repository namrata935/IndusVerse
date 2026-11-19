import * as THREE from 'three';

/** Small deterministic PRNG so procedural textures are identical every load. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Tileable value-noise fbm, returns Float32Array(size*size) in 0..1. */
export function fbm(size, baseCells, octaves, rand, persistence = 0.5) {
  const out = new Float32Array(size * size);
  let amp = 1, total = 0, cells = baseCells;
  for (let o = 0; o < octaves; o++) {
    const grid = new Float32Array(cells * cells);
    for (let i = 0; i < grid.length; i++) grid[i] = rand();
    for (let y = 0; y < size; y++) {
      const fy = (y / size) * cells, y0 = Math.floor(fy), ty = smooth(fy - y0);
      const ya = y0 % cells, yb = (y0 + 1) % cells;
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * cells, x0 = Math.floor(fx), tx = smooth(fx - x0);
        const xa = x0 % cells, xb = (x0 + 1) % cells;
        const v00 = grid[ya * cells + xa], v10 = grid[ya * cells + xb];
        const v01 = grid[yb * cells + xa], v11 = grid[yb * cells + xb];
        const v = (v00 + (v10 - v00) * tx) * (1 - ty) + (v01 + (v11 - v01) * tx) * ty;
        out[y * size + x] += v * amp;
      }
    }
    total += amp;
    amp *= persistence;
    cells *= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

/** Height field -> tangent-space normal map canvas (wraps for tiling). */
function heightToNormal(h, size, strength) {
  const c = makeCanvas(size), ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const at = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      let nx = -dx * strength, ny = dy * strength, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const i = (y * size + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function grayCanvas(values, size, lo = 0, hi = 255) {
  const c = makeCanvas(size), ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = lo + clamp01(values[i]) * (hi - lo);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function tex(canvas, { srgb = false, repeat = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ---------------------------------------------------------------------------
// Cache: each scene's disposal clears it, so nothing leaks across scenes.
// ---------------------------------------------------------------------------
const cache = new Map();
function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}
export function disposeTextureCache() {
  for (const set of cache.values()) {
    for (const v of Object.values(set)) if (v && v.isTexture) v.dispose();
    if (set && set.isTexture) set.dispose();
  }
  cache.clear();
}

/**
 * Baked-brick texture. One tile covers 1.2m x 1.2m (4 x 8 bricks, 1:2 face ratio).
 * Mix of terracotta, red-orange, deep brown and occasional dark-fired bricks.
 */
export function getBrickTextures() {
  return cached('brick', () => {
    const S = 512, COLS = 4, ROWS = 8;
    const R = rng(7);
    const palette = [
      [0xb5573a, 0.3], [0xc4512c, 0.22], [0x9e4a32, 0.16], [0x6e3a26, 0.16], [0xc9764d, 0.1], [0x43271f, 0.06],
    ].map(([h, w]) => ({ c: hex(h), w }));
    const pick = () => {
      let r = R(), acc = 0;
      for (const p of palette) { acc += p.w; if (r <= acc) return p.c; }
      return palette[0].c;
    };
    const brickCol = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const base = pick();
      const v = 0.88 + R() * 0.24;
      brickCol.push([base[0] * v, base[1] * v, base[2] * v]);
    }
    const blotch = fbm(S, 4, 4, R);
    const fine = fbm(S, 64, 2, R);
    const weather = fbm(S, 8, 3, R);
    const bw = S / COLS, bh = S / ROWS, gap = 5;
    const c = makeCanvas(S), ctx = c.getContext('2d');
    const img = ctx.createImageData(S, S);
    const height = new Float32Array(S * S);
    const rough = new Float32Array(S * S);
    const mortar = hex(0xc9b08c);
    for (let y = 0; y < S; y++) {
      const row = Math.floor(y / bh), ly = y - row * bh;
      const off = (row % 2) * (bw / 2);
      for (let x = 0; x < S; x++) {
        const xo = (x + off) % S;
        const col = Math.floor(xo / bw), lx = xo - col * bw;
        const d = Math.min(lx, bw - lx, ly, bh - ly);
        const idx = y * S + x;
        const n = blotch[idx], f = fine[idx], w = weather[idx];
        let col3;
        if (d < gap) {
          const m = 0.82 + f * 0.3;
          col3 = [mortar[0] * m, mortar[1] * m, mortar[2] * m];
          height[idx] = 0.15 + f * 0.1;
          rough[idx] = 1;
        } else {
          const b = brickCol[row * COLS + col];
          const edge = clamp01((d - gap) / 7);
          const shade = (0.8 + n * 0.45) * (0.9 + f * 0.2) * (0.78 + edge * 0.22);
          col3 = [b[0] * shade, b[1] * shade, b[2] * shade];
          // pale salt weathering in patches
          const salt = clamp01((w - 0.62) * 4) * 0.35;
          col3 = mix(col3, [200, 180, 150], salt);
          height[idx] = 0.55 + edge * 0.35 + f * 0.1 - salt * 0.1;
          rough[idx] = 0.75 + f * 0.25;
        }
        const i = idx * 4;
        img.data[i] = col3[0]; img.data[i + 1] = col3[1]; img.data[i + 2] = col3[2]; img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return {
      map: tex(c, { srgb: true }),
      normalMap: tex(heightToNormal(height, S, 1.5)),
      roughnessMap: tex(grayCanvas(rough, S, 120, 255)),
      scale: 1 / 1.2,
    };
  });
}

/** Pale lime plaster with soft mottling and hairline cracks. */
export function getPlasterTextures() {
  return cached('plaster', () => {
    const S = 256, R = rng(21);
    const a = fbm(S, 3, 4, R), b = fbm(S, 24, 2, R);
    const c = makeCanvas(S), ctx = c.getContext('2d');
    const img = ctx.createImageData(S, S);
    const h = new Float32Array(S * S);
    const c1 = hex(0xe9d9b8), c2 = hex(0xd6b790), c3 = hex(0xe2c9b6);
    for (let i = 0; i < S * S; i++) {
      const base = mix(mix(c1, c2, a[i]), c3, b[i] * 0.5);
      const v = 0.92 + b[i] * 0.14;
      img.data[i * 4] = base[0] * v; img.data[i * 4 + 1] = base[1] * v; img.data[i * 4 + 2] = base[2] * v; img.data[i * 4 + 3] = 255;
      h[i] = a[i] * 0.6 + b[i] * 0.4;
    }
    ctx.putImageData(img, 0, 0);
    ctx.strokeStyle = 'rgba(90,60,40,0.25)';
    ctx.lineWidth = 1;
    for (let k = 0; k < 7; k++) {
      let x = R() * S, y = R() * S;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let s = 0; s < 8; s++) { x += (R() - 0.5) * 30; y += R() * 14; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    return {
      map: tex(c, { srgb: true }),
      normalMap: tex(heightToNormal(h, S, 1.4)),
      roughnessMap: tex(grayCanvas(b, S, 200, 255)),
      scale: 1 / 2,
    };
  });
}

/** Large pale dressed stone blocks (grey-warm) for foundations and thresholds. */
export function getStoneTextures() {
  return cached('stone', () => {
    const S = 512, R = rng(33), ROWS = 4;
    const n = fbm(S, 6, 4, R), f = fbm(S, 64, 2, R);
    const c = makeCanvas(S), ctx = c.getContext('2d');
    const img = ctx.createImageData(S, S);
    const h = new Float32Array(S * S), rough = new Float32Array(S * S);
    const rowH = S / ROWS;
    const blocks = [];
    for (let r = 0; r < ROWS; r++) {
      const cuts = [0]; let x = R() * 60;
      while (x < S) { cuts.push(x); x += 110 + R() * 130; }
      blocks.push(cuts);
    }
    const tints = [hex(0xe0d2bb), hex(0xd2c2aa), hex(0xe8d8bd), hex(0xc4b9a6)];
    for (let y = 0; y < S; y++) {
      const r = Math.floor(y / rowH), ly = y - r * rowH;
      const cuts = blocks[r];
      for (let x = 0; x < S; x++) {
        let bi = 0;
        for (let k = 0; k < cuts.length; k++) if (x >= cuts[k]) bi = k;
        const lx = x - cuts[bi];
        const nextCut = cuts[bi + 1] ?? (S + cuts[1 % cuts.length]);
        const d = Math.min(lx, nextCut - x, ly, rowH - ly);
        const idx = y * S + x;
        const t = tints[(r * 3 + bi) % tints.length];
        const edge = clamp01(d / 8);
        const v = (0.78 + n[idx] * 0.4) * (0.9 + f[idx] * 0.2) * (0.6 + edge * 0.4);
        img.data[idx * 4] = t[0] * v; img.data[idx * 4 + 1] = t[1] * v; img.data[idx * 4 + 2] = t[2] * v; img.data[idx * 4 + 3] = 255;
        h[idx] = 0.3 + edge * 0.6 + f[idx] * 0.15;
        rough[idx] = 0.7 + f[idx] * 0.3;
      }
    }
    ctx.putImageData(img, 0, 0);
    return { map: tex(c, { srgb: true }), normalMap: tex(heightToNormal(h, S, 2)), roughnessMap: tex(grayCanvas(rough, S, 150, 255)), scale: 1 / 2 };
  });
}

/** Planks / timber. */
export function getWoodTextures() {
  return cached('wood', () => {
    const S = 256, R = rng(5);
    const n = fbm(S, 4, 3, R), f = fbm(S, 48, 2, R);
    const c = makeCanvas(S), ctx = c.getContext('2d');
    const img = ctx.createImageData(S, S);
    const h = new Float32Array(S * S);
    const dark = hex(0x4a2d1d), light = hex(0x8a5a38);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = y * S + x;
      const plank = Math.floor(x / 64);
      const grain = 0.5 + 0.5 * Math.sin(y * 0.5 + n[i] * 22 + plank * 3);
      const seam = x % 64 < 2 ? 0.45 : 1;
      const col = mix(dark, light, clamp01(n[i] * 0.7 + grain * 0.3));
      const v = seam * (0.85 + f[i] * 0.25);
      img.data[i * 4] = col[0] * v; img.data[i * 4 + 1] = col[1] * v; img.data[i * 4 + 2] = col[2] * v; img.data[i * 4 + 3] = 255;
      h[i] = grain * 0.3 + seam * 0.7;
    }
    ctx.putImageData(img, 0, 0);
    return { map: tex(c, { srgb: true }), normalMap: tex(heightToNormal(h, S, 1.5)), scale: 1 / 1.0 };
  });
}

/** Packed earth / dust ground, optionally with green vegetation patches. */
export function getGroundTextures(kind = 'earth') {
  return cached('ground-' + kind, () => {
    const S = 512, R = rng(kind === 'earth' ? 11 : 12);
    const n = fbm(S, 4, 5, R), f = fbm(S, 96, 2, R), p = fbm(S, 5, 3, R);
    const c = makeCanvas(S), ctx = c.getContext('2d');
    const img = ctx.createImageData(S, S);
    const h = new Float32Array(S * S);
    const dustA = hex(0xb08457), dustB = hex(0x8a6240), clay = hex(0xa4603f), grass = hex(0x5e8a3a), grass2 = hex(0x7aa046);
    for (let i = 0; i < S * S; i++) {
      let col = mix(mix(dustA, dustB, n[i]), clay, clamp01((p[i] - 0.55) * 3) * 0.6);
      if (kind === 'grass') {
        const g = clamp01((p[i] - 0.28) * 4);
        col = mix(col, mix(grass, grass2, f[i]), g);
      } else {
        const g = clamp01((p[i] - 0.5) * 4) * 0.7; // scrub & grass patches
        col = mix(col, grass, g);
      }
      const v = 0.85 + f[i] * 0.3;
      img.data[i * 4] = col[0] * v; img.data[i * 4 + 1] = col[1] * v; img.data[i * 4 + 2] = col[2] * v; img.data[i * 4 + 3] = 255;
      h[i] = n[i] * 0.5 + f[i] * 0.5;
    }
    ctx.putImageData(img, 0, 0);
    return { map: tex(c, { srgb: true }), normalMap: tex(heightToNormal(h, S, 1.6)), scale: 1 / 6 };
  });
}

/** Tileable water normal map. Integer wave numbers keep it seamless. */
export function getWaterNormal() {
  return cached('water', () => {
    const S = 256, R = rng(77);
    const h = new Float32Array(S * S);
    const waves = [];
    for (let i = 0; i < 14; i++) {
      const kx = Math.round((R() - 0.5) * 18), ky = Math.round((R() - 0.5) * 18);
      if (!kx && !ky) continue;
      waves.push({ kx, ky, ph: R() * 6.28, a: 1 / (1 + Math.hypot(kx, ky) * 0.35) });
    }
    const n = fbm(S, 16, 3, R);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let v = 0;
      for (const w of waves) v += Math.sin(((w.kx * x + w.ky * y) / S) * 6.2832 + w.ph) * w.a;
      h[y * S + x] = v * 0.12 + n[y * S + x] * 0.5;
    }
    return { normalMap: tex(heightToNormal(h, S, 3.2)) };
  });
}

/** Dark bitumen lining with glossy blotches. */
export function getBitumenTextures() {
  return cached('bitumen', () => {
    const S = 256, R = rng(91);
    const n = fbm(S, 5, 4, R), f = fbm(S, 40, 2, R);
    const c = makeCanvas(S), ctx = c.getContext('2d');
    const img = ctx.createImageData(S, S);
    const rough = new Float32Array(S * S), h = new Float32Array(S * S);
    for (let i = 0; i < S * S; i++) {
      const v = 0.6 + n[i] * 0.9;
      img.data[i * 4] = 28 * v + 6; img.data[i * 4 + 1] = 24 * v + 8; img.data[i * 4 + 2] = 26 * v + 14; img.data[i * 4 + 3] = 255;
      rough[i] = 0.25 + n[i] * 0.5;
      h[i] = f[i];
    }
    ctx.putImageData(img, 0, 0);
    return { map: tex(c, { srgb: true }), normalMap: tex(heightToNormal(h, S, 1.2)), roughnessMap: tex(grayCanvas(rough, S, 0, 255)), scale: 1 / 2 };
  });
}

/** Red-slip pottery with black painted bands, zig-zags and pipal-leaf marks. Wraps around lathe geometry. */
export function getPotteryTexture() {
  return cached('pottery', () => {
    const W = 512, H = 256;
    const c = makeCanvas(W, H), ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#b94a2c'); g.addColorStop(1, '#9a3a22');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const R = rng(4);
    for (let i = 0; i < 1200; i++) { ctx.fillStyle = `rgba(${60 + R() * 40},20,10,${R() * 0.08})`; ctx.fillRect(R() * W, R() * H, 2 + R() * 3, 2 + R() * 3); }
    ctx.fillStyle = '#17110f';
    [[30, 10], [70, 6], [200, 12], [226, 5]].forEach(([y, h]) => ctx.fillRect(0, y, W, h));
    ctx.strokeStyle = '#17110f'; ctx.lineWidth = 6; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let x = 0; x <= W; x += 16) ctx.lineTo(x, 108 + (x / 16 % 2 ? 22 : -22));
    ctx.stroke();
    for (let x = 16; x < W; x += 64) { // leaf motif
      ctx.beginPath(); ctx.ellipse(x, 160, 8, 18, 0, 0, 6.28); ctx.fill();
    }
    const t = tex(c, { srgb: true });
    return { map: t };
  });
}

/** Striped woven cloth used for awnings / banners. */
export function getClothTexture(colors = [0xc23b22, 0x2d2f6b, 0xd9a23a, 0x1fa6a0]) {
  return cached('cloth-' + colors.join(','), () => {
    const S = 128, c = makeCanvas(S), ctx = c.getContext('2d');
    const R = rng(colors[0]);
    const stripes = [16, 4, 10, 4, 16, 4, 10, 4];
    let x = 0, i = 0;
    while (x < S) {
      const w = stripes[i % stripes.length] * 1.5;
      ctx.fillStyle = '#' + colors[i % colors.length].toString(16).padStart(6, '0');
      ctx.fillRect(x, 0, w, S); x += w; i++;
    }
    for (let k = 0; k < S; k += 2) { ctx.fillStyle = `rgba(0,0,0,${0.06 + R() * 0.06})`; ctx.fillRect(0, k, S, 1); }
    return { map: tex(c, { srgb: true }) };
  });
}

/** Soft round sprite for glows / dust. */
export function getGlowTexture() {
  return cached('glow', () => {
    const S = 128, c = makeCanvas(S), ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    return { map: tex(c, { srgb: true, repeat: false }) };
  });
}

/** Canvas sign for the portal plaques (numeral + simple motif). */
export function makeSignTexture(number, hexColor) {
  const S = 256, c = makeCanvas(S), ctx = c.getContext('2d');
  const col = '#' + hexColor.toString(16).padStart(6, '0');
  ctx.fillStyle = col; ctx.fillRect(0, 0, S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S * 0.7);
  g.addColorStop(0, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(255,240,210,0.9)'; ctx.lineWidth = 8; ctx.strokeRect(18, 18, S - 36, S - 36);
  ctx.fillStyle = 'rgba(255,248,230,0.95)';
  ctx.font = '700 150px "Georgia", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(number), S / 2, S / 2 + 8);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
