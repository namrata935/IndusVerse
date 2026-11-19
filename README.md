# IndusVerse — Mohenjo-daro in 3D (Phase 1)

An interactive, fully procedural 3D experience set in an Indus Valley Civilization city, built with
**Vite + Three.js + GSAP**. No external assets are required: every brick, house, texture, sound and
person is generated in code.

**Phase 1 contains:** project foundation, the entry street (golden-hour dawn), the scene menu, and one
complete scene — **The Great Bath and the Citadel**. The other four scenes are menu entries marked
"Coming soon" (each has a stub scene file).

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build into dist/
```

Deep link to a scene: `http://localhost:5173/#greatBath` (or `#entry`).

## Controls

| Input | Action |
|---|---|
| `W A S D` / arrows | walk (Shift = faster) |
| Drag mouse | look around |
| `F` | toggle fly mode (`Q` / `E` = down / up) |
| Click a glowing marker | open its info panel (or walk close to it) |
| `M` | mute / unmute · `H` show / hide help · `Esc` exit tour / close panel |
| HUD | quality (Low/Medium/High), time-of-day slider (Great Bath), guided tour, menu |

## Project structure

```
index.html
src/
  main.js                 app bootstrap, renderer, UI wiring, main loop
  core/
    BaseScene.js          base class: settings, init(), update(dt), dispose()
    SceneManager.js       register / load / unload with fade transition + full disposal
  scenes/
    EntryScene.js         the street at dawn, five portals
    GreatBathScene.js     Scene 1 — citadel, Great Bath, Granary, guided tour, hotspots
    ComingSoonScene.js    shared placeholder; TownPlanning/Drainage/Market/Dock extend it
  systems/
    CameraController.js   walk / fly camera, collision, ground following
    Tour.js               CatmullRom guided tour (GSAP)
    Hotspots.js           glowing markers, raycast click + proximity
    Captions.js           looks up captions.json and drives the caption bar
    Lighting.js           day/night rig: Sky shader, sun, hemisphere, fog, lamp flicker, PMREM env
    Audio.js              synthesised wind / water (3D positional) / birds / crackle, mute
    PostProcessing.js     EffectComposer: GTAO, bloom, colour grade + vignette, ACES output
  shared/                 reusable builders used by every scene
    textures.js           canvas-generated brick, plaster, stone, wood, ground, water normal, bitumen, pottery, cloth
    materials.js          world-space-UV patch, wind-sway patch, material factories
    builders.js           BuildKit: instanced boxes → walls, houses, stairs, colonnades
    props.js              trees, reeds, pots, bullock cart, lamps, banners, awnings, birds, dust
    people.js             low-poly figures + Walker
    water.js              animated water + ripple rings
    nature.js, ground.js, models.js, palette.js
  ui/                     CaptionBar, HotspotPanel, SceneMenu, Minimap, ControlsHelp, Hud, style.css
  data/captions.json      ALL text, keyed by scene and caption id
public/models/            drop .glb files here (see "GLB models")
```

## Adding a new scene

1. Create `src/scenes/MyScene.js`:

   ```js
   import { BaseScene } from '../core/BaseScene.js';
   export class MyScene extends BaseScene {
     static id = 'myScene';
     static settings = {
       camera: { pos: [0, 1.7, 10], yaw: 0 },
       lighting: { time: 15, sky: { turbidity: 3, rayleigh: 1.5, mie: 0.005, mieG: 0.8 }, fogDensity: 0.003 },
       audio: { wind: 0.3, birds: 0.4 }, timeSlider: true,
       bounds: { minX: -80, maxX: 80, minZ: -80, maxZ: 80 },
     };
     async init() {
       // build into this.root with the shared builders (BuildKit, createWater, createTrees, …)
       // register collisions via this.ground, markers via this.hotspots.add({...})
     }
     update(dt) { super.update(dt); /* animate */ }
     getTourStops() { return null; }   // or an array of {id,pos,look,hold}
   }
   ```
2. Register it in `src/main.js` (`manager.register(MyScene)`) — or replace one of the four stubs.
3. Add a card in `captions.json → menu` (`"available": true`) and captions under its id.
4. Everything created through `this.add(...)`, the shared builders and the scene's own materials/geometries is
   disposed automatically on exit (`BaseScene.dispose`). Put per-frame code in `update` or
   `this.updaters.push(fn)`.

## GLB models

`loadModel('name', fallbackFn)` (in `src/shared/models.js`) tries `/public/models/name.glb` and falls back to the
procedural object if missing. The entry street and Great Bath already load `bullock_cart` this way, so
dropping `public/models/bullock_cart.glb` replaces the procedural cart.

## Quality settings

| Level | Post-processing | Shadow map | Pixel ratio |
|---|---|---|---|
| Low | off (direct render, ACES + sRGB) | 1024 | 1 |
| Medium (default) | bloom + grade + vignette, 4× MSAA | 2048 | ≤ 1.25 |
| High | + GTAO ambient occlusion | 4096 | ≤ 1.75 |

## CG concepts → where they appear

- **Modelling** — everything is procedural: `BoxGeometry` (walls, houses, stairs), `ExtrudeGeometry` (portal seals,
  hill ridges), `LatheGeometry` (pottery), cylinders/cones/icospheres (carts, trees, people). Repeated objects
  use `InstancedMesh` (`BoxBatch` — one draw call per material).
- **Transformations** — instance matrices composed from translate/rotate/scale (`builders.js`, `props.js`);
  scene-graph hierarchy for people (limbs under body under root) and carts (bullock heads, wheels); billboarded
  hotspot halos; camera yaw/pitch (Euler YXZ).
- **Animation** — walkers with swinging limbs and bob, ping-pong/loop paths, flapping birds, hotspot pulse/bob,
  scrolling water normal maps and expanding ring ripples, GSAP-driven tour on CatmullRom splines (position and
  look-at curves), camera fades, wind sway done in the vertex shader (trees, reeds, banners, awnings).
- **Lighting** — physically-based Sky shader, directional sun with PCFSoft shadow maps that follow the viewer,
  hemisphere fill (blue-tinted shadows), time-of-day sun colour/intensity/azimuth, exponential fog, flickering
  point lights (lamps at dusk), PMREM environment for water reflections, ACES filmic tone mapping.
- **Materials & textures** — canvas-generated albedo, normal and roughness maps (brick with mortar and weathering,
  plaster, stone, wood, bitumen, ground), world-space "box" UVs injected with `onBeforeCompile` so scaled
  instances never stretch; per-instance colour variation.
- **Post-processing** — render target → GTAO → bloom → custom grade/vignette shader → output pass.
- **Sound** — Web Audio synthesis: filtered-noise wind with LFO gusts, water through a 3D `PannerNode` that tracks
  the camera listener, random chirps, lamp crackle; mute toggle. No voice-over.

## Notes on historical content

Captions (in `src/data/captions.json`) deliberately hedge where scholars disagree — e.g. the Great Bath's
ritual purpose and the "Granary"'s true function. Reconstructions of roofs, upper floors and the Granary's
superstructure are illustrative, not archaeological fact.
