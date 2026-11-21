import { el } from '../ui/dom.js';
import { ActivityShell, btn } from '../workshop/ActivityShell.js';
import { MATERIALS, REGIONS, MAP_TITLE, MAP_NOTE, MERCHANTS } from '../data/dockScript.js';

export const MAP_URL = `${import.meta.env.BASE_URL}assets/indus-map.jpg`;   // the supplied reference image, used unchanged

/**
 * The trade routes and raw materials panel. The original image is shown as-is (never redrawn or
 * overlaid) with zoom (wheel, +/-), pan (drag) and reset; materials and regions are picked from lists beside it.
 */
export function runTradeMap(root, ctx) {
  return new Promise((resolve) => {
    let opened = new Set();
    const sh = new ActivityShell(root, { title: MAP_TITLE, artisanName: MERCHANTS.map, avatar: '🗺️', backLabel: '‹ Back to the riverside', onClose: () => { ro.disconnect(); resolve(opened.size); } });
    // ---- viewer
    const img = el('img', { class: 'dk-mapimg', src: MAP_URL, alt: 'Map titled Raw Materials and Trade Networks, showing sources of materials and general directions of exchange around the Indus region', draggable: 'false' });
    const view = el('div', { class: 'dk-mapview', tabindex: '0', 'aria-label': 'Map viewer: drag to pan, scroll or use the buttons to zoom' }, img);
    const S = { k: 1, fit: 1, x: 0, y: 0, nw: 800, nh: 572 };
    const apply = () => { img.style.transform = `translate(${S.x}px, ${S.y}px) scale(${S.k})`; zoomLbl.textContent = Math.round((S.k / S.fit) * 100) + '%'; };
    const clampPan = () => {
      const vw = view.clientWidth, vh = view.clientHeight, w = S.nw * S.k, h = S.nh * S.k;
      S.x = w <= vw ? (vw - w) / 2 : Math.min(0, Math.max(vw - w, S.x));
      S.y = h <= vh ? (vh - h) / 2 : Math.min(0, Math.max(vh - h, S.y));
    };
    const reset = () => { const vw = view.clientWidth, vh = view.clientHeight; if (!vw || !vh) return; S.fit = Math.min(vw / S.nw, vh / S.nh); S.k = S.fit; S.x = (vw - S.nw * S.k) / 2; S.y = (vh - S.nh * S.k) / 2; apply(); };
    const zoomAt = (f, cx, cy) => {
      const nk = Math.min(S.fit * 6, Math.max(S.fit, S.k * f)); const r = nk / S.k;
      S.x = cx - (cx - S.x) * r; S.y = cy - (cy - S.y) * r; S.k = nk; clampPan(); apply();
    };
    const zoomLbl = el('span', { class: 'dk-zoomlbl' }, '100%');
    const bar = el('div', { class: 'dk-zoombar' }, btn('+', () => zoomAt(1.4, view.clientWidth / 2, view.clientHeight / 2), 'sm icon'), btn('−', () => zoomAt(1 / 1.4, view.clientWidth / 2, view.clientHeight / 2), 'sm icon'), btn('Reset', reset, 'sm'), zoomLbl);
    img.addEventListener('load', () => { S.nw = img.naturalWidth || 800; S.nh = img.naturalHeight || 572; img.style.width = S.nw + 'px'; img.style.height = S.nh + 'px'; reset(); });
    img.addEventListener('error', () => { view.replaceChildren(el('p', { class: 'ws-hint' }, 'The map image could not be loaded.')); });
    view.addEventListener('wheel', (e) => { e.preventDefault(); const b = view.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.18 : 1 / 1.18, e.clientX - b.left, e.clientY - b.top); }, { passive: false });
    let drag = null;
    view.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, ox: S.x, oy: S.y }; view.setPointerCapture?.(e.pointerId); view.classList.add('grab'); });
    view.addEventListener('pointermove', (e) => { if (!drag) return; S.x = drag.ox + e.clientX - drag.x; S.y = drag.oy + e.clientY - drag.y; clampPan(); apply(); });
    const end = () => { drag = null; view.classList.remove('grab'); };
    view.addEventListener('pointerup', end); view.addEventListener('pointercancel', end);
    view.addEventListener('dblclick', (e) => { const b = view.getBoundingClientRect(); zoomAt(1.6, e.clientX - b.left, e.clientY - b.top); });
    view.addEventListener('keydown', (e) => { const st = 40; if (e.key === '+' || e.key === '=') zoomAt(1.25, view.clientWidth / 2, view.clientHeight / 2); else if (e.key === '-') zoomAt(1 / 1.25, view.clientWidth / 2, view.clientHeight / 2); else if (e.key === 'ArrowLeft') S.x += st; else if (e.key === 'ArrowRight') S.x -= st; else if (e.key === 'ArrowUp') S.y += st; else if (e.key === 'ArrowDown') S.y -= st; else return; e.preventDefault(); clampPan(); apply(); });
    const ro = new ResizeObserver(() => { if (img.complete && img.naturalWidth) { const keep = S.k / S.fit; const vw = view.clientWidth, vh = view.clientHeight; if (!vw || !vh) return; S.fit = Math.min(vw / S.nw, vh / S.nh); S.k = S.fit * keep; clampPan(); apply(); } });
    ro.observe(view);
    sh.setMain(el('div', { class: 'dk-mapwrap' }, view, bar));
    // ---- lists + info
    const info = el('div', { class: 'dk-info' }), chips = el('div', { class: 'dk-chips' });
    let tab = 'materials';
    const show = (d, btnEl) => { opened.add(d.id); [...chips.children].forEach((c) => c.classList.toggle('on', c === btnEl)); info.replaceChildren(el('b', {}, d.icon + ' ' + d.title), el('p', {}, d.text)); };
    const tabs = el('div', { class: 'ws-row' });
    const fill = () => {
      const list = tab === 'materials' ? MATERIALS : REGIONS;
      chips.replaceChildren(...list.map((d) => { const b = btn(`${d.icon} ${d.title}`, () => show(d, b), 'sm'); return b; }));
      [...tabs.children].forEach((t, i) => t.classList.toggle('on', (i === 0) === (tab === 'materials')));
      info.replaceChildren(el('p', { class: 'ws-hint' }, tab === 'materials' ? 'Pick a material to read how it was used.' : 'Pick a region to read about its connections to the Indus region.'));
    };
    tabs.append(btn('Raw materials', () => { tab = 'materials'; fill(); }, 'sm'), btn('Regions and connections', () => { tab = 'regions'; fill(); }, 'sm'));
    sh.speak('Zoom in and drag the map to look closely. Then choose a material or region beside it.');
    sh.setControls(tabs, chips, info, el('p', { class: 'dk-caveat' }, MAP_NOTE), btn('Done reading ›', () => sh.close(true), 'primary'));
    fill();
  });
}
