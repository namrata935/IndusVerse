import gsap from 'gsap';
import { el } from './dom.js';

/** Full-screen overlay with one card per scene. Unavailable scenes are marked "Coming soon". */
export class SceneMenu {
  constructor(root, menuData, ui, { onSelect, onClose }) {
    this.menuData = menuData; this.ui = ui; this.onSelect = onSelect; this.onClose = onClose;
    this.cards = new Map();
    this.cardsEl = el('div', { class: 'cards' });
    this.closeBtn = el('button', { class: 'btn close-menu', onclick: () => this.hide() }, 'Keep exploring the street');
    this.node = el('section', { id: 'menu', 'aria-label': 'Scene selection' },
      el('h2', {}, 'Choose a place to explore'),
      el('p', { class: 'sub' }, 'Five places in the great city of Mohenjo-daro. Pick one to step inside.'),
      this.cardsEl, this.closeBtn);
    root.append(this.node);
    Object.keys(menuData).forEach((id, i) => {
      const d = menuData[id];
      const card = el('button', {
        class: 'card' + (d.available ? '' : ' soon'), style: `--accent:${d.accent}`, 'data-scene': id,
        'aria-disabled': d.available ? 'false' : 'true', onclick: () => { if (d.available) onSelect(id); },
      }, el('div', { class: 'num' }, String(i + 1)), el('h3', {}, d.title), el('p', {}, d.description),
        el('span', { class: 'tag' }, d.available ? 'Enter' : ui.comingSoon));
      this.cardsEl.append(card);
      this.cards.set(id, card);
    });
    this.visible = false;
    window.addEventListener('keydown', (e) => { if (this.visible && e.key === 'Escape') this.hide(); });
  }
  show(highlight) {
    this.visible = true;
    this.node.classList.add('show');
    this.cards.forEach((c, id) => c.classList.toggle('focus', id === highlight));
    gsap.fromTo([...this.cards.values()], { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.55, stagger: 0.07, ease: 'power3.out', clearProps: 'transform' });
    (this.cards.get(highlight) ?? this.cards.values().next().value)?.focus({ preventScroll: true });
  }
  hide() {
    if (!this.visible) return;
    this.visible = false;
    this.node.classList.remove('show');
    this.onClose?.();
  }
  setCloseLabel(t) { this.closeBtn.textContent = t; }
}
