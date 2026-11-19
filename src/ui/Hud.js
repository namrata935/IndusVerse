import { el } from './dom.js';
import { QUALITY } from '../systems/PostProcessing.js';

/** Top bar (nav, quality, mute, help), tour bar, time slider, coming-soon overlay. */
export class Hud {
  constructor(root, labels, handlers) {
    this.labels = labels;
    this.btnChoose = el('button', { class: 'btn primary', onclick: handlers.openMenu }, labels.chooseButton);
    this.btnBack = el('button', { class: 'btn hidden', onclick: handlers.openMenu }, labels.backToMenu);
    this.btnEntry = el('button', { class: 'btn hidden', onclick: handlers.goEntry }, labels.toEntry);
    this.btnTour = el('button', { class: 'btn hidden', onclick: handlers.startTour }, labels.tourStart);
    this.quality = el('select', { class: 'btn', 'aria-label': 'Graphics quality', onchange: (e) => handlers.setQuality(e.target.value) },
      ...Object.entries(QUALITY).map(([k, q]) => el('option', { value: k }, 'Quality: ' + q.label)));
    this.btnMute = el('button', { class: 'btn', 'aria-label': 'Toggle sound', onclick: handlers.toggleMute }, '🔊');
    this.btnHelp = el('button', { class: 'btn', 'aria-label': 'Controls help', onclick: handlers.toggleHelp }, '?');
    root.append(el('header', { class: 'topbar' },
      el('div', { class: 'brand' }, 'IndusVerse', el('small', {}, 'Mohenjo-daro · c. 2500 BCE')),
      this.btnChoose, this.btnBack, this.btnEntry, this.btnTour,
      el('div', { class: 'spacer' }), this.quality, this.btnMute, this.btnHelp));

    // tour bar
    this.dots = el('div', { class: 'dots' });
    this.tourbar = el('div', { id: 'tourbar', class: 'hidden' },
      el('button', { class: 'btn', onclick: handlers.tourPrev }, '‹ Back'), this.dots,
      el('button', { class: 'btn primary', onclick: handlers.tourSkip }, labels.tourSkip + ' ›'),
      el('button', { class: 'btn', onclick: handlers.tourExit }, labels.tourExit));
    root.append(this.tourbar);

    // time slider
    this.timeLabel = el('span', {}, '10:00');
    this.slider = el('input', { type: 'range', min: '5', max: '20', step: '0.05', value: '10', 'aria-label': 'Time of day', oninput: (e) => { handlers.setTime(parseFloat(e.target.value)); this._fmt(parseFloat(e.target.value)); } });
    this.timebox = el('div', { id: 'timebox', class: 'hidden' }, el('label', {}, 'Time of day ', this.timeLabel), this.slider);
    root.append(this.timebox);

    // coming-soon placeholder (stub scenes)
    this.comingTitle = el('h2'); this.comingBody = el('p');
    this.coming = el('div', { id: 'coming', class: 'hidden' }, el('div', {}, this.comingTitle, this.comingBody,
      el('button', { class: 'btn primary', onclick: handlers.openMenu }, labels.backToMenu), ' ',
      el('button', { class: 'btn', onclick: handlers.goEntry }, labels.toEntry)));
    root.append(this.coming);
    this.loading = el('div', { id: 'loading' }, 'Loading…');
    root.append(this.loading);
  }
  _fmt(h) { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); this.timeLabel.textContent = `${String(hh).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`; }
  setMuted(m) { this.btnMute.textContent = m ? '🔇' : '🔊'; }
  setMode(kind, { timeSlider = false, time = 10, hasTour = false } = {}) {
    this.btnChoose.classList.toggle('hidden', kind !== 'entry');
    this.btnBack.classList.toggle('hidden', kind !== 'scene');
    this.btnEntry.classList.toggle('hidden', kind === 'entry');
    this.btnTour.classList.toggle('hidden', !hasTour);
    this.timebox.classList.toggle('hidden', !timeSlider);
    this.coming.classList.toggle('hidden', kind !== 'soon');
    if (timeSlider) { this.slider.value = String(time); this._fmt(time); }
  }
  setTour(active, total = 0, index = 0) {
    this.tourbar.classList.toggle('hidden', !active);
    if (active) {
      if (this.dots.children.length !== total) this.dots.replaceChildren(...Array.from({ length: total }, () => el('i')));
      [...this.dots.children].forEach((d, i) => d.classList.toggle('on', i === index));
    }
    this.btnTour.classList.toggle('hidden', active || this.btnTour.dataset.off === '1');
  }
  showComing(title, body) { this.comingTitle.textContent = title; this.comingBody.textContent = body; }
  setLoading(on) { this.loading.classList.toggle('show', on); }
}
