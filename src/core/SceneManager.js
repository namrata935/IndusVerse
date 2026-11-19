import gsap from 'gsap';

/**
 * Registers scene classes and swaps them with a fade-to-black transition.
 * Adding a scene = write a BaseScene subclass + `manager.register(MyScene)` (+ a menu entry).
 */
export class SceneManager {
  constructor(app) {
    this.app = app;
    this.registry = new Map();
    this.current = null;
    this.busy = false;
    this.fadeEl = document.getElementById('fade');
  }
  register(SceneClass) { this.registry.set(SceneClass.id, SceneClass); return this; }
  has(id) { return this.registry.has(id); }

  _fade(to, duration = 0.7) {
    return new Promise((res) => gsap.to(this.fadeEl, { opacity: to, duration, ease: 'power2.inOut', onComplete: res }));
  }

  async goTo(id) {
    if (this.busy || !this.registry.has(id)) return;
    if (this.current?.id === id) return;
    this.busy = true;
    const a = this.app;
    a.controls.enabled = false;
    a.ui.menu.hide();
    a.ui.panel.hide();
    a.captions.hide();
    if (this.current) a.audio.blip(330, 0.2);
    if (this.current) await this._fade(1);
    a.ui.hud.setLoading(true);
    await new Promise((r) => setTimeout(r, 30)); // let the overlay paint
    // unload
    if (this.current) {
      a.post.scene = null;
      this.current.dispose();
      this.current = null;
    }
    a.renderer.renderLists.dispose();
    // load
    const Scene = this.registry.get(id);
    const scene = new Scene(a);
    try {
      await scene.load();
    } catch (err) {
      console.error('Scene failed to load', id, err);
    }
    this.current = scene;
    scene.activate();
    history.replaceState(null, '', '#' + id);
    a.ui.hud.setLoading(false);
    a.controls.enabled = true;
    await this._fade(0, 1.0);
    scene.onEnter();
    this.busy = false;
  }

  update(dt) { this.current?.update(dt); }
}
