import * as THREE from 'three';
import gsap from 'gsap';
import { el } from '../ui/dom.js';
import { ActivityShell, btn, paintTools, emojiCursor } from './ActivityShell.js';
import { ModelViewer } from './ModelViewer.js';
import { PaintCanvas, drawAnimal, drawSymbol, SYMBOLS, ANIMALS } from './PaintCanvas.js';

const STONE = '#e6dcc8', INK = '#3a2a1e';
const COLORS = [['Engraving brown', '#3a2a1e'], ['Red ochre', '#a63d22'], ['Lapis blue', '#264f8a'], ['Turquoise', '#1f8a86']];

// Exactly two historical seals (illustrative redrawings, not copies of a particular object).
const HISTORICAL = {
  unicorn: {
    name: 'The Unicorn Seal',
    text: 'This is the most common animal on Harappan seals. It looks like a bull in profile with a single long, curved horn, which is why people call it the “unicorn”. It often stands before a small object that looks like a feeding trough or ritual stand.',
    note: 'Nobody knows for certain what the animal meant. Some scholars think it was a real bull seen side-on, others a mythical creature, perhaps a clan or trading symbol.',
  },
  bull: {
    name: 'The Humped Bull Seal',
    text: 'A powerful zebu bull with a high hump over its shoulders, a heavy dewlap and two curved horns. The craftsman has shown the strong neck and muscles with great care. Cattle mattered enormously to Harappan farmers and traders.',
    note: 'The humped zebu is still common in South Asia today, so this is one of the more familiar animals on Indus seals.',
  },
};

function signs(c, w, y, color) { // a row of Indus-style signs (illustrative, not a reading)
  const kinds = ['jar', 'fish', 'comb', 'doubleV'], step = w / 5;
  kinds.forEach((k, i) => drawSymbol(c, k, step * (i + 1), y, w * 0.12, color, 5));
}
export function historicalSealCanvas(kind) {
  const p = new PaintCanvas(512, 512, { bg: STONE }), c = p.ctx;
  c.strokeStyle = INK; c.lineWidth = 6; c.strokeRect(22, 22, 468, 468);
  signs(c, 512, 96, INK);
  if (kind === 'unicorn') {
    drawAnimal(c, 'bull', 210, 322, 290, INK, { unicorn: true, hump: false, detail: true });
    // the "standard" or trough the animal stands before
    c.strokeStyle = INK; c.lineWidth = 8; c.beginPath(); c.moveTo(414, 372); c.lineTo(414, 430); c.moveTo(384, 430); c.lineTo(444, 430); c.stroke();
    c.beginPath(); c.moveTo(382, 372); c.quadraticCurveTo(414, 340, 446, 372); c.closePath(); c.stroke();
  } else drawAnimal(c, 'bull', 232, 322, 320, INK, { hump: true, detail: true });
  return p;
}

/** Square steatite seal: pale stone block, engraved face (canvas texture) and a perforated boss on the back. */
export function makeSeal(tex, { size = 1.5 } = {}) {
  const g = new THREE.Group();
  const side = new THREE.MeshStandardMaterial({ color: 0xdccfb2, roughness: 0.7 });
  const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
  const block = new THREE.Mesh(new THREE.BoxGeometry(size, size, 0.34), [side, side, side, side, face, side]); block.castShadow = true;
  const boss = new THREE.Mesh(new THREE.BoxGeometry(size * 0.46, size * 0.3, 0.3), side); boss.position.z = -0.3; boss.castShadow = true;
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, size * 0.5, 10), new THREE.MeshStandardMaterial({ color: 0x1a110c })); hole.rotation.z = Math.PI / 2; hole.position.z = -0.3;
  g.add(block, boss, hole); return g;
}

/** Clay impression: mirrored design raised from a clay surface. */
function impressionTextures(p) {
  const w = 512, h = 512, col = document.createElement('canvas'), bmp = document.createElement('canvas');
  col.width = bmp.width = w; col.height = bmp.height = h;
  const cc = col.getContext('2d'), bc = bmp.getContext('2d');
  const src = p.ctx.getImageData(0, 0, p.w, p.h).data, bgc = hex(p.bg);
  const cd = cc.createImageData(w, h), bd = bc.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = Math.floor((w - 1 - x) * p.w / w), sy = Math.floor(y * p.h / h), si = (sy * p.w + sx) * 4, di = (y * w + x) * 4;
    const d = (Math.abs(src[si] - bgc[0]) + Math.abs(src[si + 1] - bgc[1]) + Math.abs(src[si + 2] - bgc[2])) / 3;
    const ink = d > 28 ? 1 : 0, n = 0.92 + Math.random() * 0.1;
    // design stands proud (lighter); the surrounding clay is pressed flat and a touch darker
    cd.data.set([(ink ? 214 : 178) * n, (ink ? 160 : 118) * n, (ink ? 112 : 78) * n, 255], di);
    bd.data.set([ink ? 255 : 40, ink ? 255 : 40, ink ? 255 : 40, 255], di);
  }
  cc.putImageData(cd, 0, 0); bc.putImageData(bd, 0, 0);
  const t = new THREE.CanvasTexture(col); t.colorSpace = THREE.SRGBColorSpace; const b = new THREE.CanvasTexture(bmp);
  return [t, b];
}
function hex(s) { const n = parseInt(s.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

function clayTray() {
  const rough = new THREE.MeshStandardMaterial({ color: 0xa8714a, roughness: 0.95 });
  const top = new THREE.MeshStandardMaterial({ color: 0xb87c52, roughness: 0.95, bumpScale: 4 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.3, 2.2), [rough, rough, top, rough, rough, rough]); slab.receiveShadow = slab.castShadow = true; slab.position.y = 0.15;
  return { slab, top };
}

export function runSeal(root, ctx) {
  return new Promise((resolve) => {
    let completed = false, viewer = null, preview = null, tl = null;
    const seen = new Set();
    const sh = new ActivityShell(root, { title: 'Harappan Seal Making', onClose: () => { tl?.kill(); viewer?.dispose(); preview?.dispose(); resolve(completed); } });
    const fresh = (o) => { tl?.kill(); viewer?.dispose(); preview?.dispose(); preview = null; sh.main.replaceChildren(); viewer = new ModelViewer(sh.main, o); return viewer; };
    const stage = (v, y = 0, r = 2.4) => { const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.2, 56), new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.9 })); t.position.y = y - 0.1; t.receiveShadow = true; v.scene.add(t); };
    const texFor = (p) => { const t = new THREE.CanvasTexture(p.canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; p.textures.push(t); return t; };

    // ======================================================== MODE A: historical seals
    let shown = null, impr = null;
    const explore = (kind) => {
      const info = HISTORICAL[kind] || null;
      const v = fresh({ distance: 6.2, height: 0.9 }); stage(v); v.tilt = 0.12; v.autoSpin = 0;
      if (!info) {
        sh.speak('Seals are among the most important finds from Harappan cities. Each is a small square of carved stone, and they tell us a lot about trade and identity. Let us look at two famous kinds.', 'The Indus script on these seals has not been deciphered. Any “translation” you may read elsewhere is only a guess, so I will not invent one!');
        v.target.y = 0.6; v.distance = 8;
        sh.setControls(el('div', { class: 'ws-choices' },
          ...Object.entries(HISTORICAL).map(([k, s]) => el('button', { class: 'ws-choice', onclick: () => explore(k) }, el('b', {}, s.name), el('span', {}, k === 'unicorn' ? 'A single-horned animal beside a stand.' : 'A mighty zebu bull with a high hump.')))),
          createBtn());
        return;
      }
      shown = kind; seen.add(kind);
      const p = historicalSealCanvas(kind), tex = texFor(p), seal = makeSeal(tex, { size: 2 }); seal.position.y = 1.2; v.pivot.add(seal);
      const { slab, top } = clayTray(); slab.position.set(0, 0.15, 0); slab.visible = false; v.pivot.add(slab);
      const [it, ib] = impressionTextures(p); let impOn = false;
      const toggle = btn('Show the clay impression', () => {
        impOn = !impOn; seal.visible = !impOn; slab.visible = impOn;
        if (impOn) { top.map = it; top.bumpMap = ib; top.color.set(0xffffff); top.needsUpdate = true; slab.position.y = 0.15; slab.rotation.set(0, 0, 0); v.tilt = 0.9; v.target.y = 0.3; v.distance = 7.5; }
        else { v.tilt = 0.12; v.target.y = 0.9; v.distance = 6.2; }
        toggle.textContent = impOn ? 'Show the carved seal' : 'Show the clay impression';
      }, 'sm');
      v.autoSpin = 0.45; v.rotateMode = true;
      sh.speak(info.text, info.note);
      sh.setControls(el('div', { class: 'ws-choices' }, ...Object.entries(HISTORICAL).map(([k, s]) => el('button', { class: 'ws-choice' + (k === kind ? ' on' : ''), onclick: () => explore(k) }, el('b', {}, s.name)))),
        toggle, el('p', { class: 'ws-hint' }, 'Seals like this were pressed into clay or used to mark goods, which is why archaeologists see them as evidence of trade and ownership. Drag to turn the seal.'), createBtn());
    };
    function createBtn() {
      const ready = seen.size >= 2;
      const b = btn('Create My Own Seal ›', () => ready && design(), 'primary');
      b.disabled = !ready; b.title = ready ? '' : 'Look at both historical seals first';
      return el('div', {}, b, ready ? null : el('p', { class: 'ws-hint' }, 'Look at both seals first, then you can create your own.'));
    }

    // ======================================================== MODE B: design your own seal
    let paint = null;
    const design = () => {
      tl?.kill(); viewer?.dispose(); viewer = null; preview?.dispose(); sh.main.replaceChildren();
      if (!paint) { paint = new PaintCanvas(512, 512, { bg: STONE }); paint.color = INK; paint.size = 11; }
      const cv = paint.canvas; cv.className = 'ws-seal-canvas';
      sh.main.append(el('div', { class: 'ws-canvas-wrap' }, cv));
      let tool = 'brush', start = null, base = null, last = null, stampSize = 150;
      const pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * paint.w / r.width, (e.clientY - r.top) * paint.h / r.height]; };
      cv.onpointerdown = (e) => {
        cv.setPointerCapture(e.pointerId); const p = pos(e);
        if (tool.startsWith('animal:')) { paint.animal(tool.slice(7), p[0], p[1], stampSize * 1.5); return; }
        if (tool.startsWith('symbol:')) { paint.symbol(tool.slice(7), p[0], p[1], stampSize); return; }
        paint.pushUndo();
        if (tool === 'brush' || tool === 'eraser') { paint.tool = tool; last = p; paint.dot(...p); }
        else { start = p; base = paint.snapshotImage(); }
      };
      cv.onpointermove = (e) => {
        const p = pos(e);
        if (last) { paint.line(last[0], last[1], p[0], p[1]); last = p; }
        else if (start) { paint.restoreImage(base); paint.shape(tool.slice(6), start[0], start[1], p[0], p[1]); }
      };
      cv.onpointerup = () => { last = null; start = null; base = null; if (tool === 'eraser') paint.tool = 'eraser'; };
      const toolBtns = new Map();
      const T = (id, label) => { const b = btn(label, () => setTool(id), 'sm'); toolBtns.set(id, b); return b; };
      const setTool = (id) => { tool = id; if (id === 'brush') paint.tool = 'brush'; toolBtns.forEach((b, k) => b.classList.toggle('on', k === id)); cv.style.cursor = id.startsWith('animal:') || id.startsWith('symbol:') ? emojiCursor('📌', 8, 28) : id === 'eraser' ? emojiCursor('🧽', 14, 20) : id.startsWith('shape:') ? emojiCursor('📐', 6, 28) : emojiCursor('⛏️', 4, 28); };
      const sym = (k) => { const c = document.createElement('canvas'); c.width = c.height = 36; drawSymbol(c.getContext('2d'), k, 18, 18, 34, '#3a2a1e', 3); const b = el('button', { class: 'ws-btn sm icon', title: k, onclick: () => setTool('symbol:' + k) }, c); toolBtns.set('symbol:' + k, b); return b; };
      const border = (k, l) => btn(l, () => paint.border(k), 'sm');
      const pv = el('div', { class: 'ws-preview' });
      sh.speak('This is your seal. Carve your own design: maybe an animal, some symbols, a border. Remember that a seal is pressed into clay, so the impression comes out as a mirror image!', 'Real seals were carved with fine copper tools and stone drills, and then sometimes baked to harden the surface.');
      sh.setControls(pv,
        paintTools(paint, { colors: COLORS }),
        el('div', { class: 'ws-tools' },
          el('label', {}, 'Tools'), el('div', { class: 'ws-row' }, T('brush', '✎ Freehand'), T('eraser', 'Eraser')),
          el('label', {}, 'Shapes (drag on the seal)'), el('div', { class: 'ws-row' }, T('shape:circle', '◯ Circle'), T('shape:line', '／ Line'), T('shape:triangle', '△ Triangle'), T('shape:square', '▢ Square')),
          el('label', {}, 'Animal silhouettes (click to place)'), el('div', { class: 'ws-row' }, ...ANIMALS.map((a) => T('animal:' + a, a[0].toUpperCase() + a.slice(1)))),
          el('label', {}, 'Indus-style symbols (click to place)'), el('div', { class: 'ws-row' }, ...SYMBOLS.map(sym)),
          el('label', {}, 'Stamp size'), el('input', { type: 'range', min: 70, max: 260, value: stampSize, oninput: (e) => { stampSize = +e.target.value; } }),
          el('label', {}, 'Borders'), el('div', { class: 'ws-row' }, border('line', 'Line'), border('double', 'Double'), border('dots', 'Dotted'))),
        btn('Finish and view my seal ›', () => view(), 'primary'),
        btn('‹ Back to the historical seals', () => explore(null)));
      setTool('brush');
      preview = new ModelViewer(pv, { distance: 4.6, height: 0.7 }); preview.autoSpin = 0.6; preview.tilt = 0.1;
      const seal = makeSeal(texFor(paint), { size: 1.5 }); seal.position.y = 0.8; preview.pivot.add(seal);
    };

    // ======================================================== view + press it into clay yourself
    const view = () => {
      const v = fresh({ distance: 12.5, height: 0.8 }); stage(v, 0, 3.7); v.tilt = 0.3; v.rotateMode = true; v.autoSpin = 0; v.target.set(0.1, 0.7, 0);
      const HOME = [-1.6, 0.95], PRESS_Y = 0.3 + 0.17 + 0.02, HOVER_Y = 1.9, SLAB_X = 1.7;
      const sealG = new THREE.Group(), seal = makeSeal(texFor(paint), { size: 1.8 }); sealG.add(seal); sealG.position.set(HOME[0], HOME[1], 0); v.pivot.add(sealG);
      const { slab, top } = clayTray(); slab.position.set(SLAB_X, 0.15, 0); v.pivot.add(slab);
      const [it, ib] = impressionTextures(paint); const plain = slab.material[2];
      sh.node._dbg = { v, sealG };
      let phase = 'view', pressing = false, stamped = false, startY = 0, startSealY = 0;
      const pressBar = el('p', { class: 'ws-hint' }, '');
      const prepBtn = btn('Pick up the seal and press it into the clay ›', () => prepare(), 'primary');
      sh.speak('What a fine design! This is your seal. Look at it from all sides, then we will press it into clay to see how it would mark a bundle of goods.', 'Merchants may have pressed seals into lumps of clay used to fasten bundles or storage jars. A broken seal impression would show if someone had tampered with the goods.');
      sh.setControls(el('p', { class: 'ws-hint' }, 'Drag to turn the seal. Scroll to zoom.'), prepBtn, btn('‹ Edit my design', () => design()), btn('Make a new seal', () => { paint.pushUndo(); paint.clear(); design(); }), btn('Return to the workshop', () => sh.close(completed)));
      v.canvas.style.cursor = '';
      const prepare = () => {
        phase = 'moving'; v.rotateMode = false; v.autoSpin = 0; prepBtn.disabled = true;
        const yaw0 = Math.atan2(Math.sin(v.yaw), Math.cos(v.yaw));
        tl = gsap.timeline();
        tl.to(v, { yaw: yaw0 - Math.round(yaw0 / (Math.PI * 2)) * Math.PI * 2, tilt: 0.38, duration: 0.7, ease: 'power2.inOut' })
          .to(sealG.position, { y: HOVER_Y, duration: 0.5, ease: 'power2.out' }, '<')
          .to(sealG.position, { x: SLAB_X, duration: 0.7, ease: 'power2.inOut' })
          .to(sealG.rotation, { x: Math.PI / 2, duration: 0.7, ease: 'power2.inOut' }, '<')
          .add(() => {
            phase = 'press'; v.canvas.style.cursor = emojiCursor('✊', 16, 16);
            sh.speak('Now you do it! Hold the mouse button and drag downward to press the seal firmly into the clay. Then let go to lift it away.');
            sh.setControls(pressBar, btn('‹ Edit my design', () => design()), btn('Return to the workshop', () => sh.close(completed)));
            pressBar.textContent = 'Click, hold and drag DOWN to press.';
          });
      };
      v.hooks.down = (e) => {
        if (phase !== 'press') return;
        pressing = true; startY = e.clientY; startSealY = sealG.position.y; tl?.kill();
        gsap.to(sealG.position, { x: SLAB_X, duration: 0.15 });
      };
      v.hooks.move = (e) => {
        if (phase !== 'press' || !pressing) return;
        const y = Math.max(PRESS_Y, Math.min(HOVER_Y, startSealY - (e.clientY - startY) * 0.014));
        sealG.position.y = y;
        if (y <= PRESS_Y + 0.03 && !stamped) {
          stamped = true; completed = true;
          top.map = it; top.bumpMap = ib; top.color.set(0xb57d55); top.needsUpdate = true; slab.material[2] = top;
          ctx.sfx?.thud(); ctx.sfx?.chime(); gsap.fromTo(slab.scale, { y: 0.88 }, { y: 1, duration: 0.35, ease: 'back.out(3)' });
          pressBar.textContent = 'Pressed! Now release the mouse to lift the seal.';
          sh.speak('Well pressed! Lift the seal away slowly and look at what it left behind.', 'Harappan seals have been found far from the Indus, in Mesopotamia, which shows how widely these traders travelled.');
        }
      };
      v.hooks.up = () => {
        if (phase !== 'press' || !pressing) return; pressing = false;
        if (stamped) {
          tl = gsap.timeline();
          tl.to(sealG.position, { y: HOVER_Y, duration: 0.6, ease: 'power2.out' }).to(sealG.position, { x: -1.6, y: 1.5, duration: 0.8, ease: 'power2.inOut' })
            .to(sealG.rotation, { x: 0.4, duration: 0.8 }, '<').to(v, { tilt: 0.75, duration: 0.9 }, '<')
            .add(() => {
              sh.speak('There it is! See how the picture is reversed? The carving is a mirror image, so the clay shows it the right way round. You can press again if you like!', 'Clay impressions like this were used to mark ownership.');
              sh.setControls(el('p', { class: 'ws-hint' }, 'You can drag the seal into the clay again.'), btn('Press it again', () => { stamped = false; slab.material[2] = plain; sealG.rotation.x = Math.PI / 2; gsap.to(sealG.position, { x: SLAB_X, y: HOVER_Y, duration: 0.6 }); gsap.to(v, { tilt: 0.38, duration: 0.6 }); pressBar.textContent = 'Click, hold and drag DOWN to press.'; sh.speak('Go on, press it again!'); }, 'primary'), btn('‹ Edit my design', () => design()), btn('Make a new seal', () => { paint.pushUndo(); paint.clear(); design(); }), btn('Return to the workshop', () => sh.close(completed)));
              v.rotateMode = true; v.canvas.style.cursor = '';
            });
        } else gsap.to(sealG.position, { y: HOVER_Y, duration: 0.4 });
      };
    };

    explore(null);
  });
}
