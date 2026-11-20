import * as THREE from 'three';
import gsap from 'gsap';
import { el } from '../ui/dom.js';
import { ActivityShell, btn, paintTools, progressBar } from './ActivityShell.js';
import { ModelViewer } from './ModelViewer.js';
import { PaintCanvas } from './PaintCanvas.js';

// Exactly two vessel shapes. Profiles are (radius, height) from the base up to the rim.
const SHAPES = {
  bowl: { name: 'Small Bowl', pts: [[0, 0], [0.32, 0], [0.5, 0.1], [0.68, 0.3], [0.78, 0.52], [0.8, 0.7]], canvas: [1024, 300], scale: 1.25, blurb: 'A small bowl for eating, drinking and serving.' },
  jar: { name: 'Tall Storage Jar', pts: [[0, 0], [0.34, 0], [0.54, 0.5], [0.66, 1.0], [0.6, 1.5], [0.38, 1.9], [0.34, 2.05], [0.42, 2.2]], canvas: [1024, 640], scale: 0.9, blurb: 'A tall jar for storing grain, water and oil.' },
};
const COLORS = [['Black', '#2a1a14'], ['Red ochre', '#a63d22'], ['Cream slip', '#f2e4c4'], ['Blue-green', '#2b7a78']];
const CLAY = '#b98963';
const ease = (t) => t * t * (3 - 2 * t);

/** Lathe geometry with the profile resampled evenly by length so UV v follows the surface. */
function potGeometry(shape) {
  const curve = new THREE.SplineCurve(shape.pts.map(([r, y]) => new THREE.Vector2(r, y)));
  const pts = curve.getSpacedPoints(48).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
  return new THREE.LatheGeometry(pts, 64);
}

export function runPottery(root, ctx) {
  return new Promise((resolve) => {
    let completed = false, viewer = null, tl = null;
    const sh = new ActivityShell(root, { title: 'Pottery Making', onClose: () => { tl?.kill(); viewer?.dispose(); ctx.sfx?.wheel(0); ctx.sfx?.kiln(0); resolve(completed); } });
    const fresh = () => { tl?.kill(); viewer?.dispose(); sh.main.replaceChildren(); viewer = new ModelViewer(sh.main, { distance: 7, height: 0.9 }); return viewer; };
    const table = (v, y = 0, r = 2.4) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.2, 56), new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.9 })); m.position.y = y - 0.1; m.receiveShadow = true; v.scene.add(m); return m; };
    const clayMat = (map) => new THREE.MeshStandardMaterial({ color: map ? 0xffffff : 0xb98963, map, roughness: 0.85, side: THREE.DoubleSide });
    const proxy = (r, h) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12), new THREE.MeshBasicMaterial({ visible: false })); m.position.y = h / 2; return m; };

    // ---------------------------------------------------------------- 1. choose a shape
    const chooseStage = () => {
      const v = fresh(); table(v); v.autoSpin = 0.25; v.tilt = 0.18; v.distance = 9.5; v.target.y = 0.8;
      const meshes = {}, place = { bowl: [-1.5, 0.4], jar: [1.6, -0.2] };
      for (const [id, s] of Object.entries(SHAPES)) {
        const m = new THREE.Mesh(potGeometry(s), clayMat()); m.castShadow = true; m.scale.setScalar(s.scale);
        const g = new THREE.Group(); g.position.set(place[id][0], 0, place[id][1]); g.add(m); g.userData.id = id; v.pivot.add(g); meshes[id] = g;
      }
      v.rotateMode = true; let hover = null;
      v.hooks.hover = (e) => { const h = v.pick(e, Object.values(meshes)); let id = null; if (h) { let o = h.object; while (o && !o.userData.id) o = o.parent; id = o?.userData.id ?? null; } hover = id; v.canvas.style.cursor = id ? 'pointer' : ''; };
      v.canvas.addEventListener('click', () => { if (hover) shapeStage(hover); });
      v.onFrame(() => { for (const [id, g] of Object.entries(meshes)) g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, hover === id ? 1.08 : 1, 0.15)); });
      sh.speak('Pottery matters a great deal to us! We use vessels for storing grain, carrying water, cooking and everyday tasks. Which one shall we make today?', 'Harappan potters used the wheel and fired their vessels in kilns. Plain red pots and painted ones have been found across the Indus cities.');
      sh.setControls(el('div', { class: 'ws-choices' }, ...Object.entries(SHAPES).map(([id, s]) => el('button', { class: 'ws-choice', onclick: () => shapeStage(id) }, el('b', {}, s.name), el('span', {}, s.blurb)))));
    };

    // ---------------------------------------------------------------- 2. shape it yourself on the wheel
    const shapeStage = (id) => {
      const s = SHAPES[id], v = fresh(); v.autoSpin = 0; v.rotateMode = false; v.tilt = 0.22; table(v);
      v.distance = id === 'jar' ? 8.2 : 6.4; v.target.y = id === 'jar' ? 1.2 : 0.5;
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.18, 48), new THREE.MeshStandardMaterial({ color: 0x9c6a44, roughness: 0.8 })); wheel.position.y = 0.09; wheel.castShadow = wheel.receiveShadow = true;
      const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.5, 16), new THREE.MeshStandardMaterial({ color: 0x6a4a34 })); stub.position.y = -0.1; v.scene.add(stub);
      const pot = new THREE.Mesh(potGeometry(s), new THREE.MeshStandardMaterial({ color: 0x9a7a62, roughness: 0.55, side: THREE.DoubleSide })); pot.castShadow = true; pot.position.y = 0.18;
      const spin = new THREE.Group(); spin.add(wheel, pot); v.scene.add(spin);
      const hands = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.35, 4, 8), new THREE.MeshStandardMaterial({ color: 0x8a5a3c, roughness: 0.7 })); hands.visible = false; v.scene.add(hands);
      const hit = proxy(1.1, id === 'jar' ? 2.6 : 1.4); hit.position.y = 0.2 + (id === 'jar' ? 1.3 : 0.7); v.scene.add(hit);
      sh.node._dbg = { v, hit };
      const st = { p: 0, press: false, done: false, wob: 0 };
      const bar = progressBar('Shape the clay: drag your mouse up and down the spinning clay'); ctx.sfx?.wheel(0.6);
      v.setCursor('🤲'); ctx.sfx?.wheel(0.5);
      let last = null;
      v.hooks.down = (e) => { st.press = true; last = [e.clientX, e.clientY]; ctx.sfx?.wheel(1); };
      v.hooks.move = (e) => {
        if (!st.press || st.done) return;
        const dx = e.clientX - last[0], dy = e.clientY - last[1]; last = [e.clientX, e.clientY];
        const h = v.pick(e, [hit]); if (!h) { hands.visible = false; return; }
        st.p = Math.min(1, st.p + (Math.max(0, -dy) + 0.35 * Math.max(0, dy) + 0.25 * Math.abs(dx)) / 620); st.wob = Math.min(1, st.wob + Math.abs(dx) / 120);
        hands.visible = true; hands.position.copy(h.point); hands.position.x += 0.12; hands.rotation.z = -0.15;
        bar.set(st.p, st.p < 1 ? `Shaping… ${Math.round(st.p * 100)}%` : 'Shaped!');
        if (st.p >= 1) finish();
      };
      v.hooks.up = () => { st.press = false; hands.visible = false; if (!st.done) ctx.sfx?.wheel(0.5); };
      v.onFrame((dt, t) => {
        spin.rotation.y += dt * (st.press ? 5 : 1.6); st.wob *= 0.94;
        const e = ease(st.p), k = s.scale, w = (0.3 + 0.7 * e) * (1 + Math.sin(t * 18) * 0.05 * st.wob * (1 - st.p));
        pot.scale.set(k * w, k * Math.max(0.12, e), k * w);
      });
      const finish = () => {
        st.done = true; st.p = 1; hands.visible = false; ctx.sfx?.wheel(0);
        gsap.to(st, { wob: 0, duration: 0.5 });
        sh.speak('There! A fine vessel, smooth and even. Now comes the part where you can make it your own.', 'The potter’s wheel let Harappan craftspeople make thin-walled, evenly shaped vessels in large numbers.');
        sh.setControls(btn('Decorate your pot ›', () => decorateStage(id), 'primary'));
      };
      sh.speak('Here is the lump of clay on the wheel. Press your hands against it as it spins, and draw the clay upward to shape the vessel. Move your mouse up and down the clay!', 'The potter’s wheel let Harappan craftspeople make thin-walled, evenly shaped vessels in large numbers.');
      sh.setControls(bar.node);
    };

    // ---------------------------------------------------------------- 3. decorate
    let paint = null;
    const decorateStage = (id) => {
      ctx.sfx?.wheel(0);
      const s = SHAPES[id], v = fresh(); table(v);
      paint = new PaintCanvas(s.canvas[0], s.canvas[1], { bg: CLAY }); paint.color = COLORS[0][1]; paint.size = 11;
      const tex = new THREE.CanvasTexture(paint.canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; paint.texture = tex;
      const potMesh = new THREE.Mesh(potGeometry(s), clayMat(tex)); potMesh.castShadow = true; potMesh.scale.setScalar(s.scale); v.pivot.add(potMesh);
      v.distance = id === 'jar' ? 8.4 : 6; v.target.y = id === 'jar' ? 1.1 : 0.4; v.tilt = 0.25; v.rotateMode = false;
      let last = null;
      const toPx = (uv) => [uv.x * paint.w, (1 - uv.y) * paint.h];
      v.hooks.down = (e) => { paint.pushUndo(); const h = v.pick(e, [potMesh]); if (h?.uv) { last = toPx(h.uv); paint.dot(...last); } else last = null; };
      v.hooks.move = (e) => {
        const h = v.pick(e, [potMesh]); if (!h?.uv) { last = null; return; }
        const p = toPx(h.uv);
        if (last && Math.abs(p[0] - last[0]) < paint.w / 2) paint.line(last[0], last[1], p[0], p[1]); else paint.dot(...p);
        last = p;
      };
      v.hooks.up = () => { last = null; };
      let height = 0.45;
      const modeBtns = [btn('🖌️ Paint on the pot', () => setMode(false), 'sm'), btn('🤲 Turn the pot', () => setMode(true), 'sm')];
      const setMode = (rot) => { v.rotateMode = rot; modeBtns[0].classList.toggle('on', !rot); modeBtns[1].classList.toggle('on', rot); v.setCursor(rot ? '🤲' : '🖌️', rot ? 16 : 3, rot ? 16 : 30); };
      setMode(false);
      const slider = el('input', { type: 'range', min: 0.08, max: 0.92, step: 0.01, value: height, oninput: (e) => { height = +e.target.value; } });
      const pat = (k, label) => btn(label, () => paint.band(k, height), 'sm');
      sh.speak('Now it is your turn! Paint patterns on the surface with your mouse. Drag with the right mouse button, or press “Turn the pot”, to see the other side.', 'Painted Harappan pottery often shows geometric motifs such as intersecting circles, fish-scale patterns and bands, usually in black on a red surface.');
      sh.setControls(
        el('div', { class: 'ws-row' }, ...modeBtns),
        paintTools(paint, { colors: COLORS }),
        el('div', { class: 'ws-tools' }, el('label', {}, 'Patterns (drawn around the pot at the height below)'), el('div', { class: 'ws-row' }, pat('dots', '● Dots'), pat('triangles', '▲ Triangles'), pat('bands', '☰ Bands')), el('label', {}, 'Pattern height'), slider),
        btn('Finished! Fire the pot ›', () => fireStage(id), 'primary'));
    };

    // ---------------------------------------------------------------- 4. fire it: carry it to the kiln, then work the bellows
    const fireStage = (id) => {
      const s = SHAPES[id], v = fresh(); v.rotateMode = false; v.tilt = 0.12; v.distance = 17; v.target.set(0.8, 1.0, 0); v.autoSpin = 0;
      table(v, 0, 5.2);
      const brick = new THREE.MeshStandardMaterial({ color: 0xb4583a, roughness: 0.95 });
      const kiln = new THREE.Group(); kiln.position.set(3.4, 0, 0);
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 2.8), brick); body.position.y = 1.3; body.castShadow = true;
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.3, 1.3), new THREE.MeshStandardMaterial({ color: 0x1a0c08, emissive: 0xff5a14, emissiveIntensity: 0.2 })); mouth.position.set(-1.32, 0.85, 0);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 0.9, 12), brick); top.position.y = 3.05;
      kiln.add(body, mouth, top); v.scene.add(kiln);
      // a wooden board to carry the pot on, and a pair of bellows by the fire door
      const board = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 1.4), new THREE.MeshStandardMaterial({ color: 0xa87848, roughness: 0.9 })); board.position.set(-1.6, 0.04, 0); v.scene.add(board);
      const bellows = new THREE.Group(); bellows.position.set(1.15, 0.4, 1.7);
      const bb = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.5), new THREE.MeshStandardMaterial({ color: 0x7a4a2a, roughness: 0.9 })); const bn = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.9, 8), new THREE.MeshStandardMaterial({ color: 0x4a3a30 })); bn.rotation.z = Math.PI / 2; bn.position.set(-0.8, 0, -0.1);
      bellows.add(bb, bn); v.scene.add(bellows);
      const fireLight = v.warm; fireLight.position.set(1.4, 1, 0.6);
      const potG = new THREE.Group(); potG.position.set(-1.6, 0.08, 0); v.scene.add(potG);
      const fired = firedTexture(paint), tex = new THREE.CanvasTexture(paint.canvas); tex.colorSpace = THREE.SRGBColorSpace;
      const mat = clayMat(tex), pm = new THREE.Mesh(potGeometry(s), mat); pm.scale.setScalar(s.scale * 0.9); pm.castShadow = true; potG.add(pm);
      sh.node._dbg = { v, potG };
      const st = { heat: 0, glow: 0, phase: 'carry', hold: 0 }, bar = progressBar('Kiln temperature'); bar.node.style.display = 'none';
      let dragging = false;
      v.setCursor('🤲');
      sh.speak('First, carry your pot to the kiln. Pick it up with your mouse and drag it to the fire door on the right!', 'Harappan potters fired their pots in kilns, which could reach very high temperatures.');
      sh.setControls(el('p', { class: 'ws-hint' }, 'Drag the pot to the kiln, then release.'), bar.node);
      v.hooks.down = (e) => {
        if (st.phase === 'carry') { if (v.pick(e, [potG])) dragging = true; }
        else if (st.phase === 'stoke') { st.heat = Math.min(1, st.heat + 0.075); ctx.sfx?.hiss(); gsap.fromTo(bellows.scale, { x: 0.7 }, { x: 1, duration: 0.25 }); if (st.heat >= 0.995) { st.phase = 'baking'; st.glow = 1; bake(); } }
      };
      v.hooks.move = (e) => { if (!dragging) return; const p = v.planePoint(e, 0); if (p) { potG.position.x = Math.min(1.9, Math.max(-2.1, p.x)); potG.position.y = 0.08 + Math.max(0, 0.5 * Math.sin(Math.min(1, (p.x + 2.1) / 3.5) * Math.PI)); } };
      v.hooks.up = () => {
        if (!dragging) return; dragging = false;
        if (potG.position.x > 0.7) intoKiln(); else gsap.to(potG.position, { x: -1.6, y: 0.08, duration: 0.4 });
      };
      v.onFrame((dt) => {
        if (st.phase === 'stoke') {
          st.heat = Math.max(0, st.heat - dt * 0.07); st.glow += (st.heat - st.glow) * Math.min(1, dt * 4);
          bar.set(st.heat, st.heat < 1 ? `Kiln temperature ${Math.round(st.heat * 100)}%: click to work the bellows!` : 'Hot enough!');
        }
        mouth.material.emissiveIntensity = 0.2 + st.glow * 3.2; fireLight.intensity = st.glow * (28 + Math.sin(performance.now() * 0.02) * 4); body.material.emissive.setRGB(0.4 * st.glow, 0.08 * st.glow, 0);
      });
      const intoKiln = () => {
        st.phase = 'moving';
        tl = gsap.timeline();
        tl.to(potG.position, { x: 2.3, y: 0.5, duration: 0.9, ease: 'power1.inOut' }).to(potG.scale, { x: 0.45, y: 0.45, z: 0.45, duration: 0.9 }, '<')
          .add(() => {
            potG.visible = false; st.phase = 'stoke'; v.setCursor('🌬️');
            sh.speak('In it goes! Now the fire needs air. Click again and again to work the bellows until the kiln is hot enough. Do not let it cool down!', 'Firing turns soft clay into hard, durable ceramic, which is why so many Harappan sherds survive today.');
            sh.setControls(el('p', { class: 'ws-hint' }, 'Click repeatedly on the kiln area to pump the bellows.'), bar.node); bar.node.style.display = ''; ctx.sfx?.kiln(1);
          });
      };
      const bake = () => {
        v.setCursor(''); bar.set(1, 'Hot enough! Baking…'); ctx.sfx?.kiln(1);
        sh.speak('The kiln is roaring! Hold on… the heat is driving out the last of the water and hardening the clay.');
        tl = gsap.timeline();
        tl.to({}, { duration: 2.4 })
          .add(() => { tex.dispose(); mat.map = fired; mat.needsUpdate = true; potG.visible = true; potG.position.set(2.3, 0.5, 0); sh.speak('The kiln has cooled… and here comes your pot!'); st.heat = 0; })
          .to(potG.scale, { x: 1, y: 1, z: 1, duration: 1.1 })
          .to(potG.position, { x: -0.2, y: 0.08, duration: 1.3, ease: 'power1.inOut' }, '<')
          .to(st, { glow: 0, duration: 1.5 }, '<')
          .add(() => { st.phase = 'done'; ctx.sfx?.kiln(0); doneStage(id, fired); });
      };
    };
    const firedTexture = (p) => {
      const c = document.createElement('canvas'); c.width = p.w; c.height = p.h; const g = c.getContext('2d');
      g.filter = 'saturate(1.45) contrast(1.08)'; g.drawImage(p.canvas, 0, 0); g.filter = 'none';
      g.globalCompositeOperation = 'multiply'; g.fillStyle = '#f0a070'; g.fillRect(0, 0, p.w, p.h);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
    };

    // ---------------------------------------------------------------- 5. done
    const doneStage = (id, firedTex) => {
      const s = SHAPES[id], v = fresh(); table(v); v.autoSpin = 0.5; v.rotateMode = true; v.tilt = 0.25; v.setCursor('🤲');
      const m = new THREE.Mesh(potGeometry(s), new THREE.MeshStandardMaterial({ map: firedTex, roughness: 0.5, side: THREE.DoubleSide })); m.scale.setScalar(s.scale); m.castShadow = true; v.pivot.add(m);
      v.distance = id === 'jar' ? 8.4 : 6; v.target.y = id === 'jar' ? 1.1 : 0.4;
      completed = true; ctx.sfx?.chime();
      sh.speak('Beautiful! Your vessel is finished, and no two painted pots are ever quite alike. Turn it around and admire your work.', 'Our potters often decorate vessels with geometric patterns. These designs give each vessel its own character.');
      sh.setControls(el('p', { class: 'ws-hint' }, 'Drag to turn it. Scroll to zoom.'), btn('Create another pot', () => chooseStage(), 'primary'), btn('Return to the workshop', () => sh.close(true)));
    };

    chooseStage();
  });
}
