import * as THREE from 'three';

/** A floating name label (canvas sprite) used above points of interest. */
export function makeLabel(text, color = 0xffffff) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d');
  let fs = 38; x.font = `700 ${fs}px Georgia, serif`; while (x.measureText(text).width > 440 && fs > 18) { fs -= 2; x.font = `700 ${fs}px Georgia, serif`; }
  x.textAlign = 'center'; x.textBaseline = 'middle';
  const w = Math.min(500, x.measureText(text).width + 40);
  x.fillStyle = 'rgba(40,22,12,0.78)'; x.beginPath(); x.roundRect?.(256 - w / 2, 8, w, 80, 24); if (!x.roundRect) x.rect(256 - w / 2, 8, w, 80); x.fill();
  x.strokeStyle = '#' + new THREE.Color(color).getHexString(); x.lineWidth = 4; x.stroke();
  x.fillStyle = '#fff2d8'; x.fillText(text, 256, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, opacity: 0.95 })); s.scale.set(6, 1.1, 1); s.renderOrder = 10; return s;
}
