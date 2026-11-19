import { el } from './dom.js';

/** Right-hand info card for a hotspot: title, 2-3 sentences, "Did you know?". */
export class HotspotPanel {
  constructor(root, labels) {
    this.labels = labels;
    this.title = el('h3'); this.text = el('p'); this.dyk = el('div', { class: 'dyk' });
    this.closeBtn = el('button', { class: 'close', 'aria-label': 'Close', onclick: () => this.hide() }, '×');
    this.node = el('aside', { id: 'panel' }, this.closeBtn, this.title, this.text, this.dyk);
    root.append(this.node);
    this.onClose = null;
  }
  show({ title, text, didYouKnow }, accent = '#1fa6a0') {
    this.title.textContent = title; this.text.textContent = text;
    this.dyk.replaceChildren();
    if (didYouKnow) this.dyk.append(el('b', {}, this.labels.didYouKnow), didYouKnow);
    this.dyk.style.display = didYouKnow ? '' : 'none';
    this.node.style.setProperty('--accent', accent);
    this.node.classList.add('show');
  }
  hide() { if (this.node.classList.contains('show')) { this.node.classList.remove('show'); this.onClose?.(); } }
  get visible() { return this.node.classList.contains('show'); }
}
