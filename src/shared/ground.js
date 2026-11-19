/**
 * Tiny height + collision map. Scenes register platforms, stairs, holes (the pool) and
 * blocking rectangles; CameraController queries it every frame while walking.
 * Movement uses a "step limit": you may climb or drop at most ~0.6m between frames, so
 * stairs are walkable while walls, platform edges and deep pools are not.
 */
export class GroundMap {
  constructor() {
    this.platforms = [];
    this.stairs = [];
    this.holes = [];
    this.blockers = []; // {minX,maxX,minZ,maxZ}
  }
  addPlatform(minX, maxX, minZ, maxZ, top) { this.platforms.push({ minX, maxX, minZ, maxZ, top }); }
  addHole(minX, maxX, minZ, maxZ, floor) { this.holes.push({ minX, maxX, minZ, maxZ, floor }); }
  addBlocker(minX, maxX, minZ, maxZ) { this.blockers.push({ minX, maxX, minZ, maxZ }); }
  /** Stairs ascending along `dir` ('+x','-x','+z','-z'); (x,z) is the bottom edge centre. */
  addStairs({ x, z, width, steps, rise, run, dir, y0 }) {
    const d = { '+x': [1, 0], '-x': [-1, 0], '+z': [0, 1], '-z': [0, -1] }[dir];
    this.stairs.push({ x, z, width, steps, rise, run, d, y0 });
  }
  _stairHeight(s, px, pz) {
    const rx = px - s.x, rz = pz - s.z;
    const along = rx * s.d[0] + rz * s.d[1];
    const across = Math.abs(rx * -s.d[1] + rz * s.d[0]);
    if (across > s.width / 2 || along < 0 || along > s.steps * s.run) return null;
    return s.y0 + Math.min(s.steps, Math.floor(along / s.run) + 1) * s.rise;
  }
  height(x, z) {
    let h = 0;
    for (const p of this.platforms) if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ) h = Math.max(h, p.top);
    let inHole = null;
    for (const p of this.holes) if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ) inHole = p;
    if (inHole) h = inHole.floor;
    for (const s of this.stairs) {
      const sh = this._stairHeight(s, x, z);
      if (sh !== null && (inHole || sh > h - 0.01)) h = Math.max(inHole ? inHole.floor : 0, sh);
    }
    return h;
  }
  /** Returns true if circle (x,z,r) overlaps a blocker. */
  blocked(x, z, r) {
    for (const b of this.blockers) {
      const cx = Math.max(b.minX, Math.min(x, b.maxX)), cz = Math.max(b.minZ, Math.min(z, b.maxZ));
      if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return true;
    }
    return false;
  }
}
