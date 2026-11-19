import { el } from './dom.js';

/** Simple top-down map: scene bounds, blockers, hotspots and the viewer with a heading cone. */
export class Minimap {
  constructor(root) {
    this.canvas = el('canvas', { id: 'minimap', width: 300, height: 300 });
    root.append(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.cfg = null; this.hotspots = []; this.ground = null; this.acc = 0;
  }
  setScene(cfg, ground, hotspots) { this.cfg = cfg; this.ground = ground; this.hotspots = hotspots; this.canvas.classList.toggle('hidden', !cfg); this._static = null; }
  update(dt, camera, yaw) {
    if (!this.cfg || (this.acc += dt) < 0.06) return;
    this.acc = 0;
    const { ctx, canvas } = this, W = canvas.width, c = this.cfg;
    const sx = (x) => ((x - c.minX) / (c.maxX - c.minX)) * W, sz = (z) => ((z - c.minZ) / (c.maxZ - c.minZ)) * W;
    ctx.clearRect(0, 0, W, W);
    ctx.fillStyle = 'rgba(217,162,58,0.12)'; ctx.fillRect(0, 0, W, W);
    ctx.fillStyle = 'rgba(181,87,58,0.55)';
    for (const b of this.ground?.blockers ?? []) ctx.fillRect(sx(b.minX), sz(b.minZ), Math.max(1.5, sx(b.maxX) - sx(b.minX)), Math.max(1.5, sz(b.maxZ) - sz(b.minZ)));
    ctx.fillStyle = 'rgba(31,166,160,0.5)';
    for (const h of this.ground?.holes ?? []) ctx.fillRect(sx(h.minX), sz(h.minZ), sx(h.maxX) - sx(h.minX), sz(h.maxZ) - sz(h.minZ));
    for (const h of this.hotspots) {
      ctx.fillStyle = '#' + h.color.toString(16).padStart(6, '0');
      ctx.beginPath(); ctx.arc(sx(h.position.x), sz(h.position.z), 6, 0, 6.3); ctx.fill();
    }
    const px = sx(camera.position.x), pz = sz(camera.position.z);
    ctx.save(); ctx.translate(px, pz); ctx.rotate(-yaw);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 40, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, 6.3); ctx.fill();
    ctx.restore();
  }
}
