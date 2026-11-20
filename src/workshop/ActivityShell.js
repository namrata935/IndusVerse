import { el } from '../ui/dom.js';

/** CSS cursor made from an emoji, so each step can show the tool used for it (hands, brush, hammer...). */
export function emojiCursor(ch, hx = 16, hy = 16) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='36' height='36'><text x='2' y='29' font-size='28'>${ch}</text></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hx} ${hy}, auto`;
}
/** A progress bar: node + set(0..1). */
export function progressBar(label = '') {
  const i = el('i'), txt = el('span', {}, label);
  return { node: el('div', { class: 'ws-prog' }, txt, el('div', { class: 'ws-bar' }, i)), set(p, t) { i.style.width = Math.round(Math.min(1, Math.max(0, p)) * 100) + '%'; if (t !== undefined) txt.textContent = t; } };
}

export const btn = (label, onclick, cls = '') => el('button', { class: 'ws-btn ' + cls, onclick }, label);

/**
 * The full-screen panel every craft activity lives in: a large main area (3D view or canvas),
 * and a side column with the artisan's words and the controls for the current step.
 */
export class ActivityShell {
  constructor(root, { title, artisanName = 'Dhanya the artisan', onClose }) {
    this.onClose = onClose;
    this.main = el('div', { class: 'ws-main' });
    this.say = el('p', { class: 'ws-say' });
    this.note = el('div', { class: 'ws-note' });
    this.controls = el('div', { class: 'ws-controls' });
    this.side = el('aside', { class: 'ws-side' },
      el('div', { class: 'ws-artisan' }, el('div', { class: 'ws-avatar' }, '🏺'), el('b', {}, artisanName)),
      this.say, this.note, this.controls);
    this.title = el('h2', {}, title);
    this.node = el('div', { class: 'ws-overlay' },
      el('div', { class: 'ws-panel' },
        el('header', {}, this.title, el('button', { class: 'ws-back', onclick: () => this.close(false) }, '‹ Back to the workshop')),
        el('div', { class: 'ws-body' }, this.main, this.side)));
    root.append(this.node);
    requestAnimationFrame(() => this.node.classList.add('show'));
    this._esc = (e) => { if (e.key === 'Escape') this.close(false); };
    window.addEventListener('keydown', this._esc);
    this.cleanups = [];
  }
  /** The artisan speaks (side panel). Optional historical note shown below in a quieter box. */
  speak(text, note = '') {
    this.say.textContent = text; this.say.classList.remove('pop'); void this.say.offsetWidth; this.say.classList.add('pop');
    this.note.textContent = note; this.note.style.display = note ? '' : 'none';
  }
  setControls(...nodes) { this.controls.replaceChildren(...nodes.flat().filter(Boolean)); }
  setMain(...nodes) { this.main.replaceChildren(...nodes.filter(Boolean)); }
  onCleanup(fn) { this.cleanups.push(fn); }
  close(completed = false) {
    if (this.closed) return; this.closed = true;
    window.removeEventListener('keydown', this._esc);
    this.cleanups.forEach((f) => { try { f(); } catch {} });
    this.node.classList.remove('show');
    setTimeout(() => this.node.remove(), 250);
    this.onClose?.(completed);
  }
}

/** Colour swatches, brush sizes, brush/eraser, undo, clear — shared by pottery and seal. */
export function paintTools(paint, { colors, onUndo, onClear } = {}) {
  const swatchWrap = el('div', { class: 'ws-row' });
  const sizeWrap = el('div', { class: 'ws-row' });
  const toolWrap = el('div', { class: 'ws-row' });
  const sw = colors.map(([name, hex]) => {
    const b = el('button', { class: 'ws-swatch', title: name, 'aria-label': name, style: `background:${hex}`, onclick: () => { paint.color = hex; paint.tool = 'brush'; sync(); } });
    swatchWrap.append(b); return [hex, b];
  });
  const sizes = [['Fine', 5], ['Medium', 11], ['Bold', 22]].map(([n, v]) => {
    const b = btn(n, () => { paint.size = v; sync(); }, 'sm'); sizeWrap.append(b); return [v, b];
  });
  const brush = btn('Brush', () => { paint.tool = 'brush'; sync(); }, 'sm'), eraser = btn('Eraser', () => { paint.tool = 'eraser'; sync(); }, 'sm');
  toolWrap.append(brush, eraser, btn('↶ Undo', () => { paint.undo(); onUndo?.(); }, 'sm'), btn('Clear', () => { paint.clear(); onClear?.(); }, 'sm'));
  function sync() {
    sw.forEach(([hex, b]) => b.classList.toggle('on', paint.tool === 'brush' && paint.color === hex));
    sizes.forEach(([v, b]) => b.classList.toggle('on', paint.size === v));
    brush.classList.toggle('on', paint.tool === 'brush'); eraser.classList.toggle('on', paint.tool === 'eraser');
  }
  sync();
  return el('div', { class: 'ws-tools' }, el('label', {}, 'Colour'), swatchWrap, el('label', {}, 'Brush size'), sizeWrap, toolWrap);
}
