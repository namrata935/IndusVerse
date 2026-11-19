/** Looks up text in captions.json (keyed by scene id, then caption id) and drives the caption bar. */
export class Captions {
  constructor(data, bar) { this.data = data; this.bar = bar; }
  get(sceneId, key) { return this.data[sceneId]?.[key] ?? null; }
  show(sceneId, key, opts) {
    const c = this.get(sceneId, key);
    if (c) this.bar.show(c, opts);
    return c;
  }
  hide() { this.bar.hide(); }
}
