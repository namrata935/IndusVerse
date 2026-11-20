import * as THREE from 'three';
import gsap from 'gsap';
import { el } from '../ui/dom.js';
import { ActivityShell, btn, progressBar } from './ActivityShell.js';
import { ModelViewer } from './ModelViewer.js';
import { createDancingGirl } from './DancingGirl.js';

// Each stage: what the visitor is asked to do (task), what has happened once done (done), a fact (note).
const STAGES = [
  { name: 'Wax model', task: 'First we make the sculpture in beeswax. Press and drag your mouse over the wax block to shape the figure, and watch her appear: the legs, the tilt of the head, the hand on the hip, the bangles.', done: 'Beautiful! Every detail is in the wax now, because it will all be copied exactly in bronze.', note: 'The real Dancing Girl is only about 10.5 cm tall, so the wax model would have been tiny and delicate. Beeswax is soft, so fine detail is easy to carve.' },
  { name: 'Clay mould', task: 'Now we cover the wax figure with fine clay. Drag your mouse over the figure, from the feet upwards, to plaster it with clay layer by layer.', done: 'Perfect. When the clay dries, it holds the exact shape of the wax inside. We leave a small opening at the top.', note: 'The clay was probably mixed with sand or plant fibres to keep it from cracking in the heat.' },
  { name: 'Molten bronze', task: 'Time to heat the mould! Click again and again to pump the bellows until the furnace is hot. Then lift the crucible of molten bronze and pour it into the funnel.', done: 'The wax has melted away and the bronze has filled every hollow it left. That is why we call it the lost-wax method!', note: 'Bronze is mostly copper with a little tin. Each cast needs its own mould, so every piece is one of a kind.' },
  { name: 'The finished figure', task: 'Let the mould cool. Then take the hammer and tap the clay to break it open. A few firm taps will do it!', done: 'And here she is, in bronze: the same pose, the same bangles. The mould had to be broken to free her, so there is only ever one.', note: 'The Dancing Girl was found at Mohenjo-daro in 1926. Her pose and her bangles still delight everyone who sees her.' },
];
const ease = (t) => t * t * (3 - 2 * t);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const mats = () => ({
  wax: new THREE.MeshStandardMaterial({ color: 0xeed596, roughness: 0.32, emissive: 0x4a3508, emissiveIntensity: 0.35, transparent: true }),
  molten: new THREE.MeshStandardMaterial({ color: 0xffa040, emissive: 0xff5a12, emissiveIntensity: 2.2, roughness: 0.4 }),
  bronze: new THREE.MeshStandardMaterial({ color: 0xb4732f, metalness: 0.92, roughness: 0.34, envMapIntensity: 1.6 }),
  clay: new THREE.MeshStandardMaterial({ color: 0xb0764f, roughness: 1, flatShading: true, side: THREE.DoubleSide, transparent: true, emissive: 0x000000 }),
});

function mouldGeometry(half) {
  const prof = [[0.0, 0], [0.42, 0], [0.45, 0.06], [0.4, 0.5], [0.38, 0.85], [0.36, 1.1], [0.32, 1.25], [0.2, 1.34], [0.18, 1.6], [0.28, 1.72], [0.12, 1.74], [0.0, 1.74]];
  const geo = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 18, half ? Math.PI : 0, Math.PI);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const n = Math.sin(i * 12.9898) * 43758.5453, j = (n - Math.floor(n) - 0.5) * 0.07; p.setXYZ(i, p.getX(i) * (1 + j), p.getY(i), p.getZ(i) * (1 + j)); }
  geo.computeVertexNormals(); return geo;
}

export function runBronze(root, ctx) {
  return new Promise((resolve) => {
    let completed = false, tl = null, stage = 0, stageDone = false, stageFrame = null;
    const sh = new ActivityShell(root, { title: 'Bronze Casting: The Dancing Girl', onClose: () => { tl?.kill(); ctx.sfx?.furnace(0); v.dispose(); resolve(completed); } });
    const v = new ModelViewer(sh.main, { distance: 6.2, height: 1.1 });
    v.tilt = 0.08; v.rotateMode = false;
    const M = mats();
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.2, 48), new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.9 })); floor.position.y = -0.1; floor.receiveShadow = true; v.scene.add(floor);

    // one Dancing Girl model, two instances: wax first, then metal
    const waxFig = createDancingGirl(M.wax), metalFig = createDancingGirl(M.molten, M.molten);
    const waxParts = [...waxFig.userData.parts, ...waxFig.userData.bangles]; waxParts.forEach((m) => { m.userData.s = m.scale.clone(); });
    v.pivot.add(waxFig, metalFig);
    const lump = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.5), M.wax); lump.position.y = 0.2; lump.castShadow = true; v.pivot.add(lump);
    const mouldA = new THREE.Mesh(mouldGeometry(false), M.clay), mouldB = new THREE.Mesh(mouldGeometry(true), M.clay);
    const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.08, 0.2, 14, 1, true), M.clay); funnel.position.y = 1.82;
    const mould = new THREE.Group(); mould.add(mouldA, mouldB, funnel); v.pivot.add(mould);
    [mouldA, mouldB, funnel].forEach((m) => { m.castShadow = true; });
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.9, 10), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 0.95; v.pivot.add(hit);
    const target = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.025, 8, 24), new THREE.MeshBasicMaterial({ color: 0xffe08a, toneMapped: false })); target.rotation.x = Math.PI / 2; target.position.set(0, 1.97, 0); target.visible = false; v.pivot.add(target);
    const crucible = new THREE.Group(); crucible.visible = false; v.scene.add(crucible);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.17, 0.34, 14), new THREE.MeshStandardMaterial({ color: 0x4a3a30, roughness: 0.9 })); const lava = new THREE.Mesh(new THREE.CircleGeometry(0.26, 14), M.molten); lava.rotation.x = -Math.PI / 2; lava.position.y = 0.17;
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6), new THREE.MeshStandardMaterial({ color: 0x5a3a26 })); handle.rotation.z = Math.PI / 2; handle.position.x = 0.55;
    crucible.add(cup, lava, handle);
    const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 8), M.molten); stream.visible = false; v.scene.add(stream);
    const drips = []; for (let i = 0; i < 7; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), M.wax); d.visible = false; v.pivot.add(d); drips.push(d); }
    const glow = v.warm; glow.position.set(0.8, 1.2, 1.4);
    const S = { heat: 0 };
    const heat = (h) => { M.clay.emissive.setRGB(0.9 * h, 0.28 * h, 0.02 * h); M.clay.emissiveIntensity = h; glow.intensity = h * (22 + Math.sin(performance.now() * 0.02) * 4); M.clay.color.setHex(h > 0.5 ? 0xb06a40 : 0xb0764f); };
    v.onFrame((dt, t) => { if (S.heat > 0.01 || glow.intensity > 0.1) heat(S.heat); target.scale.setScalar(1 + Math.sin(t * 6) * 0.12); stageFrame?.(dt, t); });

    // ---- the state of the scene after stage k has been completed (k = 0: empty table) ----
    const applyState = (k) => {
      tl?.kill(); stageFrame = null; v.hooks = {}; stream.visible = false; target.visible = false; crucible.visible = false; lump.visible = false;
      drips.forEach((d) => { d.visible = false; }); ctx.sfx?.furnace(k === 3 ? 1 : 0);
      waxFig.visible = k >= 1 && k <= 2; waxFig.scale.set(1, 1, 1); waxParts.forEach((m) => m.scale.copy(m.userData.s)); M.wax.opacity = 1;
      mould.visible = k >= 2 && k <= 3; mould.scale.set(1, 1, 1);
      for (const m of [mouldA, mouldB]) { m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); }
      mould.position.set(0, 0, 0); M.clay.opacity = k === 2 ? 0.92 : 0.55; S.heat = k === 3 ? 1 : 0; heat(S.heat);
      metalFig.visible = k >= 3; metalFig.scale.set(1, 1, 1); metalFig.traverse((o) => { if (o.isMesh) o.material = k === 3 ? M.molten : M.bronze; });
      M.molten.emissiveIntensity = k === 3 ? 2.2 : 0; v.autoSpin = k === 4 ? 0.5 : 0; v.rotateMode = k === 4;
      if (k === 4) mould.visible = false;
      if (k === 0) { waxFig.visible = false; mould.visible = false; metalFig.visible = false; }
    };

    // ---- UI ----
    const dots = el('div', { class: 'ws-steps' }, ...STAGES.map((s, i) => el('div', { class: 'ws-step' }, el('i', {}, String(i + 1)), el('span', {}, s.name))));
    const next = btn('Next stage ›', () => go(stage + 1), 'primary'), prev = btn('‹ Previous', () => go(stage - 1)), restart = btn('↺ Restart', () => go(1), 'sm');
    let prog = progressBar();
    const paintControls = (extra) => {
      const finalStage = stage === 4 && stageDone;
      sh.setControls(dots, prog.node, extra, finalStage ? [el('div', { class: 'ws-row' }, prev, restart), el('p', { class: 'ws-hint' }, 'Drag to turn the sculpture around. Scroll to zoom.'), btn('Return to the workshop', () => sh.close(true), 'primary')]
        : [el('div', { class: 'ws-row' }, prev, next), restart]);
    };
    const markDots = () => [...dots.children].forEach((d, i) => { d.classList.toggle('on', i + 1 === stage); d.classList.toggle('done', i + 1 < stage || (i + 1 === stage && stageDone)); });
    /** Called when the visitor has completed the stage's task. */
    const complete = (k) => {
      stageDone = true; tl?.kill(); v.hooks = {}; stageFrame = null; v.canvas.style.cursor = ''; ctx.sfx?.chime();
      applyState(k); if (k === 4) { completed = true; }
      prog.set(1, 'Stage complete!'); next.disabled = k === 4; markDots();
      sh.speak(STAGES[k - 1].done, STAGES[k - 1].note); paintControls();
    };
    const go = (k) => {
      stage = clamp(k, 1, 4); stageDone = false; next.disabled = true; prev.disabled = stage === 1;
      prog = progressBar(); applyState(stage - 1); markDots();
      gsap.to(v, { distance: stage === 3 ? 7.6 : 5.4, duration: 1.2, ease: 'power2.inOut' }); gsap.to(v.target, { y: stage === 3 ? 1.5 : 0.95, duration: 1.2, ease: 'power2.inOut' });
      sh.speak(STAGES[stage - 1].task, STAGES[stage - 1].note); paintControls();
      [stage1, stage2, stage3, stage4][stage - 1]();
    };

    // ---------------------------------------------------------------- stage 1: shape the wax by dragging over it
    const stage1 = () => {
      waxFig.visible = true; lump.visible = true; waxParts.forEach((m) => m.scale.setScalar(0.001)); lump.scale.set(1, 1, 1);
      prog.set(0, 'Shape the wax: press and drag over it'); v.setCursor('✋');
      let p = 0, press = false, last = null;
      const show = () => {
        const N = waxParts.length;
        waxParts.forEach((m, i) => { const f = ease(clamp(p * (N + 5) - i, 0, 1)); m.scale.set(m.userData.s.x * f + 0.001, m.userData.s.y * f + 0.001, m.userData.s.z * f + 0.001); });
        lump.scale.set(Math.max(0.001, 1 - p * 0.95), Math.max(0.001, 1 - p), Math.max(0.001, 1 - p * 0.95));
      };
      v.hooks.down = (e) => { press = true; last = [e.clientX, e.clientY]; };
      v.hooks.move = (e) => {
        if (!press || stageDone) return;
        const d = Math.hypot(e.clientX - last[0], e.clientY - last[1]); last = [e.clientX, e.clientY];
        if (!v.pick(e, [hit])) return;
        p = Math.min(1, p + d / 1000); show(); prog.set(p, `Shaping the wax… ${Math.round(p * 100)}%`);
        if (p >= 1) complete(1);
      };
      v.hooks.up = () => { press = false; };
    };

    // ---------------------------------------------------------------- stage 2: plaster the clay mould on
    const stage2 = () => {
      mould.visible = true; M.clay.opacity = 0.95; mould.scale.set(1, 0.001, 1); v.tilt = 0.08;
      prog.set(0, 'Cover the figure with clay: drag up and down over it'); v.setCursor('🧱');
      let p = 0, press = false, last = null;
      v.hooks.down = (e) => { press = true; last = [e.clientX, e.clientY]; };
      v.hooks.move = (e) => {
        if (!press || stageDone) return;
        const d = Math.hypot(e.clientX - last[0], e.clientY - last[1]); last = [e.clientX, e.clientY];
        if (!v.pick(e, [hit])) return;
        p = Math.min(1, p + d / 900); mould.scale.y = Math.max(0.001, ease(p)); prog.set(p, `Applying clay… ${Math.round(p * 100)}%`);
        if (p >= 1) complete(2);
      };
      v.hooks.up = () => { press = false; };
    };

    // ---------------------------------------------------------------- stage 3: bellows, melting wax, pour the metal
    const stage3 = () => {
      prog.set(0, 'Furnace heat: click to pump the bellows'); v.setCursor('🌬️'); ctx.sfx?.furnace(0.4);
      const st = { heat: 0, phase: 'heat', fill: 0, dragging: false, pouring: false };
      v.hooks.down = (e) => {
        if (st.phase === 'heat') { st.heat = Math.min(1, st.heat + 0.085); ctx.sfx?.hiss(); if (st.heat >= 0.995) { st.phase = 'melt'; S.heat = 1; M.clay.opacity = 0.52; prog.set(1, 'Hot enough!'); melt(); } }
        else if (st.phase === 'pour') { const p = v.planePoint(e, 0); if (p && Math.hypot(p.x - crucible.position.x, p.y - crucible.position.y) < 0.9) st.dragging = true; }
      };
      v.hooks.move = (e) => { if (st.phase !== 'pour' || !st.dragging) return; const p = v.planePoint(e, 0); if (p) { crucible.position.x = clamp(p.x, -2, 2.3); crucible.position.y = clamp(p.y, 1.6, 4.2); } };
      v.hooks.up = () => { st.dragging = false; };
      const lip = new THREE.Vector3(), mouth = new THREE.Vector3(0, 2.0, 0);
      stageFrame = (dt) => {
        if (st.phase === 'heat') {
          st.heat = Math.max(0, st.heat - dt * 0.07); S.heat = st.heat; M.clay.opacity = 0.92 - st.heat * 0.4;
          prog.set(st.heat, st.heat < 1 ? `Furnace heat ${Math.round(st.heat * 100)}%: keep pumping!` : 'Hot enough!');
        } else if (st.phase === 'pour') {
          const near = Math.abs(crucible.position.x + 0.05) < 0.5 && crucible.position.y > 2.1 && crucible.position.y < 3.1;
          st.pouring = st.dragging && near;
          crucible.rotation.z += ((st.pouring ? -0.95 : st.dragging ? -0.1 : 0) - crucible.rotation.z) * Math.min(1, dt * 6);
          if (st.pouring) {
            st.fill = Math.min(1, st.fill + dt * 0.32); metalFig.scale.y = Math.max(0.001, ease(st.fill));
            lip.set(crucible.position.x - 0.3, crucible.position.y - 0.05, 0); stream.visible = true;
            const len = lip.y - mouth.y; stream.scale.set(1, Math.max(0.01, len), 1); stream.position.set((lip.x + mouth.x) / 2, (lip.y + mouth.y) / 2, 0);
            prog.set(st.fill, `Pouring… ${Math.round(st.fill * 100)}%`);
            if (st.fill >= 1) { stageFrame = null; st.phase = 'done'; stream.visible = false; target.visible = false; complete(3); }
          } else { stream.visible = false; }
        }
      };
      const melt = () => {
        v.setCursor(''); sh.speak('The furnace is roaring and the mould is glowing! Watch the wax melt and run out of the bottom.');
        prog.set(1, 'Melting the wax…');
        tl = gsap.timeline();
        tl.to(waxFig.scale, { y: 0.04, duration: 2.2, ease: 'power1.in' }).to(M.wax, { opacity: 0.0, duration: 0.8 }, '-=0.5');
        drips.forEach((d, i) => tl.fromTo(d.position, { x: (i - 3) * 0.08, y: 0.1, z: 0.38 }, { y: -0.05, z: 0.7 + i * 0.05, duration: 0.7, ease: 'power1.in', onStart: () => { d.visible = true; M.wax.opacity = 1; } }, 0.6 + i * 0.12));
        tl.add(() => {
          waxFig.visible = false; M.wax.opacity = 1; drips.forEach((d) => { d.visible = false; });
          metalFig.visible = true; metalFig.scale.set(1, 0.001, 1); M.molten.emissiveIntensity = 2.2;
          crucible.visible = true; crucible.position.set(1.7, 3.0, 0); crucible.rotation.z = 0; target.visible = true; v.canvas.style.cursor = '';
          v.setCursor('🥄', 16, 16); ctx.sfx?.furnace(1);
          sh.speak('Now the molten bronze is ready! Click and hold the glowing crucible, drag it over the funnel at the top of the mould (follow the golden ring), and keep holding to pour.');
          prog.set(0, 'Drag the crucible to the golden ring, and hold to pour'); st.phase = 'pour';
        });
      };
    };

    // ---------------------------------------------------------------- stage 4: cool, then break the mould open with a hammer
    const stage4 = () => {
      prog.set(0, 'The mould is cooling…');
      const st = { hits: 0, ready: false };
      tl = gsap.timeline();
      tl.to(S, { heat: 0, duration: 2.4, ease: 'sine.out', onStart: () => ctx.sfx?.furnace(0) })
        .to(M.molten, { emissiveIntensity: 0, duration: 2.4 }, '<')
        .add(() => { metalFig.traverse((o) => { if (o.isMesh) o.material = M.bronze; }); heat(0); M.clay.opacity = 1; st.ready = true; v.setCursor('🔨', 6, 28); prog.set(0, 'Tap the mould with the hammer: click on it (0 / 4)'); sh.speak('Cool at last! Now take the hammer and tap the clay. Click on the mould, a few firm taps will crack it open.'); });
      v.hooks.down = (e) => {
        if (!st.ready || stageDone) return;
        if (!v.pick(e, [mouldA, mouldB, funnel])) return;
        st.hits++; ctx.sfx?.thud(); prog.set(st.hits / 4, `Tap the mould with the hammer: click on it (${st.hits} / 4)`);
        gsap.fromTo(mould.position, { x: -0.05 }, { x: 0, duration: 0.25, ease: 'elastic.out(2,0.3)' });
        M.clay.color.setRGB(0.55 - st.hits * 0.05, 0.36 - st.hits * 0.03, 0.25 - st.hits * 0.02);
        if (st.hits >= 4) {
          st.ready = false; v.canvas.style.cursor = '';
          tl = gsap.timeline();
          tl.to(mouldA.position, { x: 0.9, y: -0.2, duration: 1.1, ease: 'power2.in' }).to(mouldB.position, { x: -0.9, y: -0.2, duration: 1.1, ease: 'power2.in' }, '<')
            .to(mouldA.rotation, { z: -0.4, duration: 1.1 }, '<').to(mouldB.rotation, { z: 0.4, duration: 1.1 }, '<')
            .to(M.clay, { opacity: 0, duration: 0.6 }, '-=0.5')
            .add(() => { M.clay.color.setHex(0xb0764f); complete(4); });
        }
      };
    };

    sh.node._dbg = { v, crucible, hit, mouldA };
    applyState(0);
    sh.speak('Now, let us explore the art of bronze casting! Our craftsmen work with metals to create tools, ornaments and sculptures. One remarkable example is the bronze figure known today as the Dancing Girl, discovered right here at Mohenjo-daro. Let me show you how a sculpture like this could be made with the lost-wax technique, and you will do each step yourself!', 'The “lost-wax” method: model in wax, cover in clay, melt the wax away, pour in the metal, break the mould.');
    sh.setControls(el('p', { class: 'ws-hint' }, 'Four stages: wax, clay mould, molten bronze, and the finished sculpture. Each one is hands-on.'), btn('Begin: stage 1 ›', () => go(1), 'primary'));
  });
}
