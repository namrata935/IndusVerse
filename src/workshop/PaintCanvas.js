/**
 * One drawing surface shared by the pottery and seal activities: a 2D canvas with brush,
 * eraser, undo, clear, pattern bands, shapes, animal silhouettes, Indus-style symbols and
 * borders. The canvas is either drawn on directly (seal) or used as a CanvasTexture on a
 * 3D model and painted through raycast UVs (pot).
 */
export class PaintCanvas {
  constructor(w, h, { bg = '#c9835a' } = {}) {
    this.canvas = document.createElement('canvas'); this.canvas.width = w; this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.w = w; this.h = h; this.bg = bg;
    this.color = '#2a1a14'; this.size = 10; this.tool = 'brush';
    this.history = []; this.onChange = null; this.texture = null; this.textures = [];
    this.fill();
  }
  fill() { this.ctx.fillStyle = this.bg; this.ctx.fillRect(0, 0, this.w, this.h); this.changed(); }
  changed() { if (this.texture) this.texture.needsUpdate = true; for (const t of this.textures) t.needsUpdate = true; this.onChange?.(); }
  pushUndo() { this.history.push(this.ctx.getImageData(0, 0, this.w, this.h)); if (this.history.length > 25) this.history.shift(); }
  undo() { const s = this.history.pop(); if (s) { this.ctx.putImageData(s, 0, 0); this.changed(); } return !!s; }
  clear() { this.pushUndo(); this.fill(); }
  get ink() { return this.tool === 'eraser' ? this.bg : this.color; }
  dot(x, y) { const c = this.ctx; c.fillStyle = this.ink; c.beginPath(); c.arc(x, y, this.size / 2, 0, Math.PI * 2); c.fill(); this.changed(); }
  line(x0, y0, x1, y1) {
    const c = this.ctx; c.strokeStyle = this.ink; c.lineWidth = this.size; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); this.changed();
  }

  // ---- pattern bands that wrap right around a vessel (y = fraction of canvas height from the top) ----
  band(kind, yFrac) {
    this.pushUndo();
    const c = this.ctx, y = yFrac * this.h, s = Math.max(10, this.size * 1.6);
    c.fillStyle = c.strokeStyle = this.color; c.lineWidth = Math.max(2, this.size / 3);
    if (kind === 'bands') {
      for (const dy of [-s * 0.6, 0, s * 0.6]) { c.beginPath(); c.moveTo(0, y + dy); c.lineTo(this.w, y + dy); c.stroke(); }
    } else if (kind === 'dots') {
      const n = Math.round(this.w / (s * 1.7));
      for (let i = 0; i < n; i++) { c.beginPath(); c.arc((i + 0.5) * (this.w / n), y, s * 0.32, 0, Math.PI * 2); c.fill(); }
    } else if (kind === 'triangles') {
      const n = Math.round(this.w / (s * 1.8)), step = this.w / n;
      for (let i = 0; i < n; i++) { c.beginPath(); c.moveTo(i * step + step * 0.1, y + s * 0.5); c.lineTo(i * step + step * 0.5, y - s * 0.6); c.lineTo(i * step + step * 0.9, y + s * 0.5); c.closePath(); c.fill(); }
    }
    this.changed();
  }

  // ---- shapes (drag to size) ----
  shape(kind, x0, y0, x1, y1) {
    const c = this.ctx; c.strokeStyle = c.fillStyle = this.color; c.lineWidth = Math.max(2, this.size * 0.6); c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath();
    if (kind === 'line') { c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
    else if (kind === 'circle') { c.arc(x0, y0, Math.hypot(x1 - x0, y1 - y0), 0, Math.PI * 2); c.stroke(); }
    else if (kind === 'triangle') { c.moveTo((x0 + x1) / 2, y0); c.lineTo(x1, y1); c.lineTo(x0, y1); c.closePath(); c.stroke(); }
    else if (kind === 'square') { c.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)); c.stroke(); }
    this.changed();
  }
  snapshotImage() { return this.ctx.getImageData(0, 0, this.w, this.h); }
  restoreImage(img) { this.ctx.putImageData(img, 0, 0); this.changed(); }

  // ---- stamps ----
  animal(kind, cx, cy, s) { this.pushUndo(); drawAnimal(this.ctx, kind, cx, cy, s, this.color); this.changed(); }
  symbol(kind, cx, cy, s) { this.pushUndo(); drawSymbol(this.ctx, kind, cx, cy, s, this.color, Math.max(3, s * 0.09)); this.changed(); }
  border(style) {
    this.pushUndo();
    const c = this.ctx, m = this.w * 0.035; c.strokeStyle = c.fillStyle = this.color; c.lineWidth = Math.max(3, this.w * 0.012);
    if (style === 'line') c.strokeRect(m, m, this.w - 2 * m, this.h - 2 * m);
    else if (style === 'double') { c.strokeRect(m, m, this.w - 2 * m, this.h - 2 * m); c.strokeRect(m * 2, m * 2, this.w - 4 * m, this.h - 4 * m); }
    else if (style === 'dots') {
      const n = 22, st = (this.w - 2 * m) / n;
      for (let i = 0; i <= n; i++) for (const [x, y] of [[m + i * st, m], [m + i * st, this.h - m], [m, m + i * st], [this.w - m, m + i * st]]) { c.beginPath(); c.arc(x, y, c.lineWidth * 0.9, 0, Math.PI * 2); c.fill(); }
    }
    this.changed();
  }
}

// ------------------------------------------------------------------------------------------------
// Vector drawings shared by the stamp tool and the historical seal pictures. All are drawn in a
// roughly 100x100 box scaled by s/100, centred on (cx, cy), facing right.
// ------------------------------------------------------------------------------------------------
function ell(c, x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); c.fill(); }
function leg(c, x, y0, y1, w) { c.fillRect(x - w / 2, y0, w, y1 - y0); }

export function drawAnimal(c, kind, cx, cy, size, color, { unicorn = false, hump = true, detail = false } = {}) {
  c.save(); c.translate(cx, cy); const k = size / 100; c.scale(k, k);
  c.fillStyle = c.strokeStyle = color; c.lineCap = 'round'; c.lineJoin = 'round';
  if (kind === 'bull') {
    ell(c, -6, 0, 34, 16);                                    // body
    if (hump) ell(c, 14, -17, 15, 11);                        // hump over the shoulders
    for (const x of [-32, -22, 12, 22]) leg(c, x, 8, 42, 7);  // legs
    c.beginPath(); c.moveTo(22, -14); c.lineTo(40, -14); c.lineTo(58, 2); c.lineTo(64, 18); c.lineTo(54, 22); c.lineTo(42, 14); c.lineTo(28, 14); c.closePath(); c.fill(); // neck + lowered head
    c.beginPath(); c.moveTo(26, 8); c.lineTo(40, 30); c.lineTo(46, 12); c.closePath(); c.fill();                                                                         // dewlap
    c.lineWidth = 4.5;
    if (unicorn) { c.beginPath(); c.moveTo(46, -9); c.quadraticCurveTo(70, -14, 74, -42); c.stroke(); }               // one long horn
    else { c.beginPath(); c.moveTo(48, -8); c.quadraticCurveTo(68, -12, 66, -34); c.stroke(); c.beginPath(); c.moveTo(42, -12); c.quadraticCurveTo(56, -20, 52, -38); c.stroke(); }
    c.lineWidth = 3.5; c.beginPath(); c.moveTo(-38, -8); c.quadraticCurveTo(-52, 6, -46, 32); c.stroke();               // tail
    if (detail) { c.save(); c.strokeStyle = '#e6dcc8'; c.lineWidth = 1.8; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(26 + i * 3, -6 + i * 2.4); c.lineTo(32 + i * 3, 6 + i * 1.8); c.stroke(); } c.restore(); }
  } else if (kind === 'fish') {
    ell(c, 0, 0, 38, 18);
    c.beginPath(); c.moveTo(-30, 0); c.lineTo(-56, -20); c.lineTo(-56, 20); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(-6, -15); c.lineTo(8, -32); c.lineTo(16, -14); c.closePath(); c.fill();
    c.fillStyle = '#e6dcc8'; c.beginPath(); c.arc(24, -4, 3.4, 0, Math.PI * 2); c.fill();
  } else if (kind === 'elephant') {
    ell(c, -4, -4, 34, 24);
    for (const x of [-26, -10, 12, 26]) leg(c, x, 10, 46, 11);
    ell(c, 36, -14, 17, 18);                                  // head
    c.lineWidth = 9; c.beginPath(); c.moveTo(46, -4); c.quadraticCurveTo(58, 24, 48, 42); c.stroke(); // trunk
    ell(c, 26, -14, 9, 14);                                   // ear
    c.lineWidth = 3; c.beginPath(); c.moveTo(-38, -10); c.quadraticCurveTo(-48, 6, -42, 24); c.stroke();
  } else if (kind === 'bird') {
    ell(c, -2, 6, 26, 14, -0.3);
    c.lineWidth = 6; c.beginPath(); c.moveTo(14, 0); c.quadraticCurveTo(30, -14, 28, -30); c.stroke();
    ell(c, 30, -34, 8, 7);
    c.lineWidth = 2.6; for (let a = -0.7; a <= 0.71; a += 0.28) { c.beginPath(); c.moveTo(-22, 10); c.lineTo(-22 - Math.cos(a) * 46, 10 - Math.sin(a) * 46); c.stroke(); ell(c, -22 - Math.cos(a) * 46, 10 - Math.sin(a) * 46, 4, 4); }
    leg(c, -4, 18, 44, 4); leg(c, 6, 18, 44, 4);
  }
  c.restore();
}

export function drawSymbol(c, kind, cx, cy, size, color, lw = 4) {
  c.save(); c.translate(cx, cy); const k = size / 100; c.scale(k, k);
  c.strokeStyle = c.fillStyle = color; c.lineWidth = lw / k; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath();
  if (kind === 'jar') { c.moveTo(-18, -34); c.quadraticCurveTo(-34, 0, -14, 30); c.lineTo(14, 30); c.quadraticCurveTo(34, 0, 18, -34); c.stroke(); c.beginPath(); c.moveTo(-18, -34); c.lineTo(18, -34); c.stroke(); }
  else if (kind === 'fish') { c.ellipse(0, 0, 30, 16, 0, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.moveTo(-8, -16); c.lineTo(-8, 16); c.moveTo(8, -16); c.lineTo(8, 16); c.stroke(); }
  else if (kind === 'comb') { c.moveTo(-26, -30); c.lineTo(26, -30); c.stroke(); for (let x = -22; x <= 22; x += 11) { c.beginPath(); c.moveTo(x, -30); c.lineTo(x, 30); c.stroke(); } }
  else if (kind === 'doubleV') { c.moveTo(-26, -30); c.lineTo(0, 30); c.lineTo(26, -30); c.stroke(); c.beginPath(); c.moveTo(-14, -30); c.lineTo(0, 4); c.lineTo(14, -30); c.stroke(); }
  else if (kind === 'wheel') { c.arc(0, 0, 28, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.moveTo(-28, 0); c.lineTo(28, 0); c.moveTo(0, -28); c.lineTo(0, 28); c.stroke(); }
  else if (kind === 'zigzag') { c.moveTo(-34, 14); for (let i = 0; i < 6; i++) c.lineTo(-34 + (i + 1) * 11.5, i % 2 ? 14 : -14); c.stroke(); }
  c.restore();
}
export const SYMBOLS = ['jar', 'fish', 'comb', 'doubleV', 'wheel', 'zigzag'];
export const ANIMALS = ['bull', 'fish', 'elephant', 'bird'];
