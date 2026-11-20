/** Looks up text in captions.json (keyed by scene id, then caption id) and drives the caption bar. */
export class Captions {
  constructor(data, bar) { this.data = data; this.bar = bar; this.sink = null; } // a scene may set `sink` ({show(c, opts, key), hide()}) to present captions its own way
  get(sceneId, key) { return this.data[sceneId]?.[key] ?? null; }
  show(sceneId, key, opts) {
    const c = this.get(sceneId, key);
    if (c) (this.sink ?? this.bar).show(c, opts, key);
    return c;
  }
  hide() { this.bar.hide(); this.sink?.hide(); }
}
