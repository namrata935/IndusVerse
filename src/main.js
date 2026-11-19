import * as THREE from 'three';
import './ui/style.css';
import captionData from './data/captions.json';
import { SceneManager } from './core/SceneManager.js';
import { PostProcessing, QUALITY } from './systems/PostProcessing.js';
import { CameraController } from './systems/CameraController.js';
import { AudioSystem } from './systems/Audio.js';
import { Captions } from './systems/Captions.js';
import { Tour } from './systems/Tour.js';
import { CaptionBar } from './ui/CaptionBar.js';
import { HotspotPanel } from './ui/HotspotPanel.js';
import { SceneMenu } from './ui/SceneMenu.js';
import { Minimap } from './ui/Minimap.js';
import { ControlsHelp } from './ui/ControlsHelp.js';
import { Hud } from './ui/Hud.js';
import { EntryScene } from './scenes/EntryScene.js';
import { GreatBathScene } from './scenes/GreatBathScene.js';
import { TownPlanningScene } from './scenes/TownPlanningScene.js';
import { DrainageScene } from './scenes/DrainageScene.js';
import { MarketScene } from './scenes/MarketScene.js';
import { DockScene } from './scenes/DockScene.js';

// ---------------------------------------------------------------- renderer
const host = document.getElementById('canvas-host');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.append(renderer.domElement);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1500);

let qualityKey = 'medium';
try { qualityKey = localStorage.getItem('indusverse.quality') || (window.devicePixelRatio > 2.5 ? 'medium' : 'medium'); } catch {}
if (!QUALITY[qualityKey]) qualityKey = 'medium';

// ---------------------------------------------------------------- app container (shared by systems & scenes)
const app = { renderer, camera, quality: QUALITY[qualityKey], data: captionData, getSceneId: () => manager.current?.id };
app.post = new PostProcessing(renderer, app);
app.controls = new CameraController(camera, renderer.domElement);
app.audio = new AudioSystem();
app.tour = new Tour(app);

// ---------------------------------------------------------------- UI
const uiRoot = document.getElementById('ui');
const L = captionData.ui;
const captionBar = new CaptionBar(uiRoot);
app.captions = new Captions(captionData, captionBar);
const manager = (app.sceneManager = new SceneManager(app));
const help = new ControlsHelp(uiRoot);

const openMenu = (highlight) => {
  app.ui.panel.hide();
  app.tour.stop(true);
  app.controls.enabled = false;
  app.ui.menu.setCloseLabel(manager.current?.id === 'entry' ? 'Keep exploring the street' : 'Keep exploring here');
  app.ui.menu.show(typeof highlight === 'string' ? highlight : manager.current?.id);
  app.audio.blip(740);
};
const startTour = () => {
  const s = manager.current, stops = s?.getTourStops?.();
  if (stops) app.tour.start(s.id, stops, { onEnd: () => {} });
};

const hud = new Hud(uiRoot, L, {
  openMenu: () => openMenu(),
  goEntry: () => manager.goTo('entry'),
  startTour,
  tourSkip: () => app.tour.next(),
  tourPrev: () => app.tour.prev(),
  tourExit: () => app.tour.stop(),
  setQuality: (k) => setQuality(k),
  toggleMute: () => app.audio.toggleMute(),
  toggleHelp: () => help.toggle(),
  setTime: (h) => manager.current?.setTime(h),
});
hud.quality.value = qualityKey;
hud.setMuted(app.audio.muted);
app.audio.onMuteChange = (m) => hud.setMuted(m);
const panel = new HotspotPanel(uiRoot, L);
const minimap = new Minimap(uiRoot);
const menu = new SceneMenu(uiRoot, captionData.menu, L, {
  onSelect: (id) => manager.goTo(id),
  onClose: () => { if (!manager.busy) app.controls.enabled = true; },
});
app.ui = { hud, panel, menu, minimap, help, captions: captionBar, openMenu };

function setQuality(k) {
  qualityKey = k; app.quality = QUALITY[k];
  try { localStorage.setItem('indusverse.quality', k); } catch {}
  app.post.setQuality(k);
  manager.current?.lighting?.applyQuality(app.quality.shadowSize);
  if (manager.current) app.post.setScene(manager.current.scene, camera), app.post.applyLook(manager.current.settings.look);
}

// ---------------------------------------------------------------- scenes
[EntryScene, GreatBathScene, TownPlanningScene, DrainageScene, MarketScene, DockScene].forEach((S) => manager.register(S));

// ---------------------------------------------------------------- input glue
const ndc = new THREE.Vector2();
const toNdc = (e) => ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
app.controls.onClick = (e) => {
  const hs = manager.current?.hotspots;
  if (!hs || app.tour.active) return;
  const hit = hs.pick(camera, toNdc(e));
  if (hit) { hs.cooldown = 0; hs.activate(hit); }
};
app.controls.onHover = (e) => {
  const hs = manager.current?.hotspots;
  renderer.domElement.classList.toggle('hot', !!(hs && !app.tour.active && hs.pick(camera, toNdc(e))));
};
const gesture = () => app.audio.ensure();
window.addEventListener('pointerdown', gesture);
window.addEventListener('keydown', gesture);
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.code === 'KeyM') app.audio.toggleMute();
  if (e.code === 'KeyH') help.toggle();
  if (e.code === 'Escape') { app.tour.stop(); panel.hide(); }
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  app.post.resize();
});

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
const _dir = new THREE.Vector3();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  app.controls.update(dt);
  app.tour.update();
  manager.update(dt);
  const cur = manager.current;
  if (cur) {
    app.audio.update(dt, camera, cur.lighting ? cur.lighting.lampFactor : 0);
    camera.getWorldDirection(_dir);
    minimap.update(dt, camera, Math.atan2(-_dir.x, -_dir.z));
  }
  app.post.render();
}
app.post.setQuality(qualityKey);
renderer.setAnimationLoop(frame);

const start = (location.hash || '').slice(1);
manager.goTo(manager.has(start) ? start : 'entry');

window.__indus = app; // handy for debugging in the console
