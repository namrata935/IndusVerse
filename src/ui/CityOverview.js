import { el } from './dom.js';

/** Side panel for the Citadel vs Lower Town comparison: tabs, explanation, guide's note, side-by-side table. */
export class CityOverview {
  constructor(root, { onTab, onClose }) {
    this.tabs = {};
    const tab = (id, label) => (this.tabs[id] = el('button', { class: 'ov-tab', onclick: () => onTab(id) }, label));
    this.title = el('h3'); this.text = el('p'); this.guideNote = el('div', { class: 'ov-guide' });
    this.table = el('table', { class: 'ov-table' });
    this.foot = el('p', { class: 'ov-foot' }, 'Boundaries in this model are simplified. Activities were not exclusively restricted to one area.');
    this.node = el('aside', { id: 'overview' },
      el('div', { class: 'ov-tabs' }, tab('citadel', 'Citadel'), tab('lower', 'Lower Town'), tab('compare', 'Compare')),
      this.title, this.text, this.table, this.guideNote, this.foot,
      el('button', { class: 'btn primary ov-close', onclick: onClose }, '‹ Back to the city'));
    root.append(this.node);
  }
  get visible() { return this.node.classList.contains('show'); }
  setTab(id, data) {
    for (const [k, b] of Object.entries(this.tabs)) b.classList.toggle('on', k === id);
    this.title.textContent = data.title; this.text.textContent = data.text;
    this.guideNote.replaceChildren(el('b', {}, 'The guide adds'), data.guide);
    this.table.replaceChildren();
    if (data.rows) {
      this.table.append(el('tr', {}, el('th', {}), el('th', { class: 'c' }, 'Citadel'), el('th', { class: 'l' }, 'Lower Town')),
        ...data.rows.map(([a, b, c]) => el('tr', {}, el('td', { class: 'k' }, a), el('td', {}, b), el('td', {}, c))));
    }
    this.table.style.display = data.rows ? '' : 'none';
  }
  show() { this.node.classList.add('show'); }
  hide() { this.node.classList.remove('show'); }
  dispose() { this.node.remove(); }
}
