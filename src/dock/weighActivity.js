import { el } from '../ui/dom.js';
import { ActivityShell, btn } from '../workshop/ActivityShell.js';
import { WEIGHTS, GOODS, WEIGH_INFO, MERCHANTS } from '../data/dockScript.js';

/**
 * The weighing station: a balance scale with a CSS-animated beam. Pick goods for the left
 * pan, click standard weights onto the right pan until the beam is level. No physics:
 * the tilt is just the difference between the two totals.
 * Resolves with the number of goods balanced when the panel closes.
 */
export function runWeighing(root, ctx) {
  return new Promise((resolve) => {
    let goods = GOODS[0], right = [], solved = new Set(), hint = false;
    const sh = new ActivityShell(root, { title: 'The Weighing Station', artisanName: MERCHANTS.weigh, avatar: '⚖️', backLabel: '‹ Back to the riverside', onClose: () => resolve(solved.size) });
    // ---- the scale
    const BEAM = 440, PIVOT = { x: 50, y: 78 };            // percent of the stage width, px from top
    const beam = el('div', { class: 'dk-beam' }), post = el('div', { class: 'dk-post' }), base = el('div', { class: 'dk-base' });
    const leftPan = el('div', { class: 'dk-pan left' }), rightPan = el('div', { class: 'dk-pan right' });
    const verdict = el('div', { class: 'dk-verdict' }, 'Add a weight');
    const stage = el('div', { class: 'dk-stage' }, post, base, beam, leftPan, rightPan, verdict);
    const total = () => right.reduce((a, b) => a + b, 0);
    function layout() {
      const diff = goods.units - total(), ang = Math.max(-14, Math.min(14, diff * 1.6)) * (diff === 0 ? 0 : 1);   // + = left heavier
      beam.style.transform = `translate(-50%, 0) rotate(${-ang}deg)`;
      const r = (BEAM / 2) * Math.cos((ang * Math.PI) / 180), dy = (BEAM / 2) * Math.sin((ang * Math.PI) / 180);
      leftPan.style.left = `calc(${PIVOT.x}% - ${r}px)`; rightPan.style.left = `calc(${PIVOT.x}% + ${r}px)`;
      leftPan.style.top = `${PIVOT.y + dy}px`; rightPan.style.top = `${PIVOT.y - dy}px`;
      const ok = diff === 0 && right.length > 0;
      stage.classList.toggle('ok', ok);
      verdict.textContent = ok ? '✔ Balanced!' : right.length === 0 ? 'Add a weight' : diff > 0 ? 'The goods are heavier' : 'The weights are heavier';
      return ok;
    }
    function render() {
      leftPan.replaceChildren(el('div', { class: 'dk-string' }), el('div', { class: 'dk-tray2' }, el('span', { class: 'dk-big' }, goods.icon), el('small', {}, hint ? `${goods.units} units` : goods.name)));
      rightPan.replaceChildren(el('div', { class: 'dk-string' }), el('div', { class: 'dk-tray2' }, ...right.map((w, i) => el('button', { class: 'dk-w small', title: 'Take this weight off', onclick: () => { right.splice(i, 1); update(); ctx.sfx?.tick(); } }, String(w)))));
      const ok = layout();
      if (ok && !solved.has(goods.id)) { solved.add(goods.id); ctx.sfx?.chime(); sh.speak(`Balanced! The ${goods.name.toLowerCase().replace(/^an? /, '')} weighs ${goods.units} units. ` + (solved.size >= 2 ? 'You are getting the hang of this.' : 'See how the same few cubes can weigh many things?')); sync(); }
    }
    function update() { render(); }
    // ---- the controls
    const goodsRow = el('div', { class: 'ws-row' });
    const weightsRow = el('div', { class: 'dk-weights' });
    const infoBox = el('div', { class: 'dk-info' });
    const finishBtn = btn('I understand ›', () => sh.close(true), 'primary');
    function sync() {
      goodsRow.replaceChildren(...GOODS.map((g) => { const b = btn(`${g.icon} ${g.name}${solved.has(g.id) ? ' ✓' : ''}`, () => { goods = g; right = []; hint = false; sh.speak(g.say); update(); sync(); }, 'sm'); b.classList.toggle('on', g.id === goods.id); return b; }));
      finishBtn.disabled = solved.size === 0;
    }
    weightsRow.append(...WEIGHTS.map((w) => el('button', { class: 'dk-w', title: `Add the ${w}-unit weight`, onclick: () => { if (right.length < 9) { right.push(w); update(); ctx.sfx?.tick(); } } }, el('b', {}, String(w)), el('small', {}, w === 1 ? 'unit' : 'units'))));
    const learn = el('div', { class: 'dk-learn' }, el('label', {}, 'Why standard weights mattered'),
      ...WEIGH_INFO.map((s) => el('button', { class: 'ws-btn sm', onclick: (e) => { [...learn.querySelectorAll('button')].forEach((b) => b.classList.remove('on')); e.currentTarget.classList.add('on'); infoBox.replaceChildren(el('b', {}, s.title), el('p', {}, s.text)); } }, s.title)));
    sh.setMain(el('div', { class: 'dk-weigh' }, stage, el('div', { class: 'dk-shelf' }, el('label', {}, 'Standard weights (click to add)'), weightsRow)));
    sh.setControls(el('label', { class: 'ws-hint' }, 'Choose goods for the left pan'), goodsRow,
      el('div', { class: 'ws-row' }, btn('Clear weights', () => { right = []; update(); }, 'sm'), btn('Hint', () => { hint = !hint; update(); }, 'sm')),
      learn, infoBox, finishBtn);
    sh.speak(GOODS[0].say, 'Chert cubes in a regular series of ratios have been found at many Harappan sites. Researchers see them as a sign of shared standards.');
    sync(); update();
    // the container is laid out after it is attached, so re-run once more
    requestAnimationFrame(() => requestAnimationFrame(update));
  });
}
