import { el } from './dom.js';

/** Bottom text bar. Used for the intro, hints, and each guided-tour stop. */
export class CaptionBar {
  constructor(root) {
    this.title = el('h3');
    this.text = el('p');
    this.node = el('div', { id: 'caption', role: 'status', 'aria-live': 'polite' }, this.title, this.text);
    root.append(this.node);
    this._timer = null;
  }
  show({ title = '', text = '' }, { duration = 0, tour = false } = {}) {
    clearTimeout(this._timer);
    this.title.textContent = title;
    this.title.style.display = title ? '' : 'none';
    this.text.textContent = text;
    this.node.classList.toggle('with-tour', tour);
    this.node.classList.add('show');
    if (duration) this._timer = setTimeout(() => this.hide(), duration);
  }
  hide() { clearTimeout(this._timer); this.node.classList.remove('show'); }
}
