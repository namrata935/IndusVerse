import { el } from './dom.js';

/**
 * Bottom dialogue panel: a speaker name, text that types out, and either a Continue button or a
 * list of reply choices. Awaitable: `await say(...)` and `const v = await ask(...)`.
 * Clicking the text (or Space / Enter) first finishes the typing, then advances.
 */
export class DialogueBox {
  constructor(root) {
    this.who = el('b', { class: 'who' }); this.text = el('p'); this.actions = el('div', { class: 'actions' });
    this.node = el('div', { id: 'dialogue', role: 'dialog', 'aria-live': 'polite' }, this.who, this.text, this.actions);
    root.append(this.node);
    this._typing = null; this._onSkip = null;
    this.text.addEventListener('click', () => this._skipTyping());
    this._key = (e) => {
      if (!this.visible || (e.key !== ' ' && e.key !== 'Enter')) return;
      e.preventDefault();
      if (this._typing) this._skipTyping(); else this._primary?.click();
    };
    window.addEventListener('keydown', this._key);
  }
  get visible() { return this.node.classList.contains('show'); }
  _type(text) {
    return new Promise((res) => {
      this.text.textContent = ''; let i = 0; const total = text.length;
      const step = () => { i = Math.min(total, i + 2); this.text.textContent = text.slice(0, i); if (i >= total) { this._typing = null; res(); } };
      this._typing = { done: () => { clearInterval(this._timer); this.text.textContent = text; this._typing = null; res(); } };
      clearInterval(this._timer); this._timer = setInterval(() => { step(); if (!this._typing) clearInterval(this._timer); }, 16);
    });
  }
  _skipTyping() { this._typing?.done(); }
  async _show(who, text) {
    this.who.textContent = who; this.node.classList.add('show'); this.actions.replaceChildren(); this._primary = null;
    await this._type(text);
  }
  async say(who, text, label = 'Continue ›') {
    await this._show(who, text);
    return new Promise((res) => {
      const b = el('button', { class: 'ws-btn primary', onclick: () => { this._primary = null; res(); } }, label);
      this._primary = b; this.actions.append(b); b.focus({ preventScroll: true });
    });
  }
  async ask(who, text, choices) {
    await this._show(who, text);
    return new Promise((res) => {
      this.actions.replaceChildren(...choices.map(({ label, value }, i) => {
        const b = el('button', { class: 'ws-btn choice', onclick: () => { this._primary = null; res(value); } }, label);
        return b;
      }));
    });
  }
  hide() { clearInterval(this._timer); this._typing = null; this.node.classList.remove('show'); this._primary = null; }
  dispose() { this.hide(); window.removeEventListener('keydown', this._key); this.node.remove(); }
}
