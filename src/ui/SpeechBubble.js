import * as THREE from 'three';
import { el } from './dom.js';

/**
 * A speech bubble that floats above a character's head and follows it on screen, saying one
 * sentence at a time. Text only: no voice.
 * Falls back to a bottom-centre bubble when the speaker is off-screen or behind the camera.
 */
export class SpeechBubble {
  constructor(root, app) {
    this.app = app;
    this.name = el('b', { class: 'who' }); this.text = el('p');
    this.closeBtn = el('button', { class: 'x', 'aria-label': 'Close', onclick: () => this.hide() }, '×');
    this.next = el('span', { class: 'next' }, 'click for next ▸');
    this.node = el('div', { id: 'bubble', role: 'status', 'aria-live': 'polite', onclick: (e) => { if (e.target !== this.closeBtn) this._skip?.(); } }, this.closeBtn, this.name, this.text, this.next);
    root.append(this.node);
    this.anchor = null; this.visible = false; this._timer = null; this._token = 0; this._v = new THREE.Vector3();
    this.onVisible = null;
    window.addEventListener('keydown', (e) => {
      if (!this.visible) return;
      if (e.key === 'Escape') this.hide();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') this._skip?.();
    });
  }
  /**
   * who: label shown above the text. sentences: array of strings, shown one by one.
   * anchor: () => world position of the speaker's head.
   */
  show(who, sentences, anchor, { accent = '#d9a23a', pitch = 1, onSentence = null, onDone = null } = {}) {
    this._stop();
    const token = ++this._token;
    this.name.textContent = who; this.anchor = anchor;
    this.node.style.setProperty('--accent', accent);
    this.visible = true; this.node.classList.add('show'); this.onVisible?.(true);
    let i = 0;
    const next = () => {
      if (token !== this._token) return;
      if (i >= sentences.length) { this._timer = setTimeout(() => { if (token === this._token) { onDone?.(); this.hide(); } }, 1200); return; }
      const s = sentences[i];
      this.text.textContent = s;
      this.node.classList.remove('pop'); void this.node.offsetWidth; this.node.classList.add('pop');
      onSentence?.(i, sentences.length);
      i++;
      let advanced = false;
      const go = () => { if (advanced || token !== this._token) return; advanced = true; clearTimeout(this._timer); this._timer = setTimeout(next, 250); };
      this._skip = go;
      this._timer = setTimeout(go, 1000 + s.length * 45); // reading time
    };
    next();
  }
  hide() {
    this._token++; this._stop();
    if (this.visible) { this.visible = false; this.anchor = null; this.node.classList.remove('show'); this.onVisible?.(false); }
  }
  _stop() { clearTimeout(this._timer); }

  update(camera) {
    if (!this.visible || !this.anchor) return;
    const v = this._v.copy(this.anchor()).project(camera);
    const W = window.innerWidth, H = window.innerHeight;
    const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
    const off = v.z > 1 || x < 0 || x > W || y < 0 || y > H;
    this.node.classList.toggle('pinned', off);
    if (off) { this.node.style.left = '50%'; this.node.style.top = ''; return; }
    const bw = this.node.offsetWidth, bh = this.node.offsetHeight;
    const cx = Math.min(Math.max(x, bw / 2 + 12), W - bw / 2 - 12);
    const top = Math.max(y - 12 - bh, 70);
    this.node.style.left = cx + 'px'; this.node.style.top = top + 'px';
    this.node.style.setProperty('--tx', Math.min(Math.max(x - cx, -bw / 2 + 24), bw / 2 - 24) + 'px');
  }
}
