/**
 * Looping background track played through a plain <audio> element (streams, so a big file is fine).
 * Starts after the first user gesture, follows the app's mute state, fades in/out, and ducks
 * while a character is speaking.
 */
export class BackgroundAudio {
  constructor(app, { src, volume = 0.6 }) {
    this.app = app; this.volume = volume; this.ducked = false; this.wantPlay = false; this.level = 0; this.dead = false;
    this.audio = new Audio(src); this.audio.loop = true; this.audio.preload = 'auto'; this.audio.volume = 0;
    this._gesture = () => this.play();
    window.addEventListener('pointerdown', this._gesture); window.addEventListener('keydown', this._gesture);
  }
  play() {
    this.wantPlay = true;
    if (this.audio.paused) this.audio.play().catch(() => {}); // blocked until a gesture; retried on the next one
  }
  duck(on) { this.ducked = on; }
  update(dt = 1 / 60) {
    if (this.dead) return;
    const target = this.app.audio.muted || !this.wantPlay ? 0 : this.volume * (this.ducked ? 0.3 : 1);
    this.level += (target - this.level) * Math.min(1, dt * 3);
    this.audio.volume = Math.max(0, Math.min(1, this.level));
  }
  dispose() {
    this.dead = true;
    window.removeEventListener('pointerdown', this._gesture); window.removeEventListener('keydown', this._gesture);
    this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load();
  }
}
