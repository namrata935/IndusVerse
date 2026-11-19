import { el } from './dom.js';

export class ControlsHelp {
  constructor(root) {
    this.node = el('div', { id: 'help', class: 'hidden' },
      el('h4', {}, 'Controls'),
      el('div', {}, el('kbd', {}, 'W'), ' ', el('kbd', {}, 'A'), ' ', el('kbd', {}, 'S'), ' ', el('kbd', {}, 'D'), '  move'),
      el('div', {}, 'Drag mouse  look around'),
      el('div', {}, el('kbd', {}, 'Shift'), '  walk faster'),
      el('div', {}, el('kbd', {}, 'F'), '  toggle fly mode (Q / E = down / up)'),
      el('div', {}, 'Click glowing markers for details'),
      el('div', {}, el('kbd', {}, 'M'), '  mute   ', el('kbd', {}, 'H'), '  hide this help'));
    root.append(this.node);
  }
  toggle(force) { this.node.classList.toggle('hidden', force === undefined ? !this.node.classList.contains('hidden') : !force); }
}
