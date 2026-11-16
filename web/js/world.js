// Scene construction: sky, light, terrain, trees, flag, graveyard, goose and
// ball meshes. Everything is procedural geometry — no asset files.

import * as THREE from 'three';
import { buildTerrainMesh, buildWater, buildGreenMesh } from './terrain.js';
import { fbm } from './course.js';
import { mulberry32, placeTrees, treeColliders, miniRails } from './trees.js';
export { mulberry32, placeTrees, treeColliders };
import { R, CUP_R } from './physics.js';

// ---------------------------------------------------------------- sky
const SKY_VS = `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`;
const SKY_FS = `
uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunCol;
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 c = mix(horizon, mid, smoothstep(-0.02, 0.18, h));
  c = mix(c, top, smoothstep(0.18, 0.75, h));
  float s = max(dot(d, normalize(sunDir)), 0.0);
  c += sunCol * (pow(s, 900.0) * 3.0 + pow(s, 24.0) * 0.45 + pow(s, 4.0) * 0.18);
  if (h < 0.0) c = mix(c, horizon * 0.85, smoothstep(0.0, -0.1, h));
  gl_FragColor = vec4(c, 1.0);
}`;

// Time of day per hole: the sun sinks as the round goes on.
export const LIGHTING = [
  { elev: 20, az: -35, top: 0x3d5fa8, mid: 0x9fb4d8, horizon: 0xffd29a, sun: 0xffe2a8, fog: 0xe9c99b, sunI: 3.0, hemi: 1.0 },
  { elev: 13, az: -20, top: 0x3b4f98, mid: 0xb39ac4, horizon: 0xffbe85, sun: 0xffcf8a, fog: 0xe6b48c, sunI: 2.7, hemi: 0.9 },
  { elev: 11, az: 10,  top: 0x34428e, mid: 0xc48fb0, horizon: 0xffae76, sun: 0xffbf7e, fog: 0xe0a88c, sunI: 2.8, hemi: 1.15 },
  { elev: 7,  az: 25,  top: 0x2c2a6e, mid: 0xb8709a, horizon: 0xff9a5e, sun: 0xffab62, fog: 0xd59482, sunI: 2.7, hemi: 1.25 },
  // [4] the Bowling Green: the last of the sun, warm, long shadows
  { elev: 5,  az: 30,  top: 0x26235f, mid: 0x9b5f92, horizon: 0xff8650, sun: 0xff9a56, fog: 0xc07f7d, sunI: 2.4, hemi: 1.22 },
  { elev: 3,  az: 35,  top: 0x1e1c58, mid: 0x7d4f8a, horizon: 0xff7440, sun: 0xff8a4a, fog: 0xa86a78, sunI: 2.0, hemi: 1.2 },
  // night: the sun disc doubles as the moon
  { elev: 12, az: -12, top: 0x060a1e, mid: 0x15203f, horizon: 0x34446a, sun: 0xb4ccff, fog: 0x18213a, sunI: 0.6, hemi: 0.75, night: true, fogNear: 35, fogFar: 240 },
  // [7] crazy golf: neon night, short fog, a bright hemi so the felt reads
  { elev: 18, az: -25, top: 0x0b0824, mid: 0x251a4f, horizon: 0x5a3a7e, sun: 0xd8c8ff, fog: 0x1c1838, sunI: 0.8, hemi: 1.05, night: true, fogNear: 60, fogFar: 420 },
  { elev: 30, az: 8,   top: 0x04061a, mid: 0x0f1a3e, horizon: 0x283866, sun: 0xe2eaff, fog: 0x121a30, sunI: 0.9, hemi: 0.85, night: true, fogNear: 160, fogFar: 1100 },
];

export function createSky(scene) {
  const uni = {
    top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, horizon: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() },
  };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16),
    new THREE.ShaderMaterial({ uniforms: uni, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false }));
  sky.frustumCulled = false; sky.renderOrder = -1;
  scene.add(sky);
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 400;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  scene.add(sun); scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x4a3a20, 1);
  scene.add(hemi);
  scene.fog = new THREE.Fog(0xe9c99b, 120, 900);
  const sunDir = new THREE.Vector3();
  return {
    sky, sun, hemi, sunDir,
    apply(i) {
      const L = LIGHTING[Math.min(i, LIGHTING.length - 1)];
      const e = L.elev * Math.PI / 180, a = L.az * Math.PI / 180;
      sunDir.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)).normalize();
      uni.top.value.set(L.top); uni.mid.value.set(L.mid); uni.horizon.value.set(L.horizon);
      uni.sunDir.value.copy(sunDir); uni.sunCol.value.set(L.sun);
      sun.color.set(L.sun); sun.intensity = L.sunI; hemi.intensity = L.hemi;
      hemi.color.set(L.mid).lerp(new THREE.Color(0xffffff), 0.35); hemi.groundColor.set(L.night ? 0x1a1a24 : 0x5a4a30); scene.fog.color.set(L.fog);
      scene.fog.near = L.fogNear ?? 120; scene.fog.far = L.fogFar ?? 900;
      return L;
    },
    follow(p) { // keep the shadow frustum around the action
      sun.position.set(p.x + sunDir.x * 150, p.y + sunDir.y * 150, p.z + sunDir.z * 150);
      sun.target.position.copy(p);
    },
  };
}

// Stylised trees for the golden-hour diorama: two-blob "cloud" canopies in a
// warm palette (with the odd autumn tree), two-tier pines, and a gentle sway
// in the wind done in the vertex shader (no per-frame CPU cost).
export const treeTime = { value: 0 };
function swayMaterial(opts) {
  const m = new THREE.MeshStandardMaterial(opts);
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = treeTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = instanceMatrix[3].xyz;
        float ph = ip.x * 0.37 + ip.z * 0.23;
        float sway = (sin(uTime * 1.3 + ph) * 0.6 + sin(uTime * 2.7 + ph * 1.7) * 0.25) * 0.06 * max(0.0, position.y + 0.6);
        transformed.x += sway; transformed.z += sway * 0.6;
      #endif`);
  };
  return m;
}
export function buildTreeMeshes(trees) {
  const g = new THREE.Group();
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.34, 1, 6); trunkGeo.translate(0, 0.5, 0);
  const roundGeo = new THREE.IcosahedronGeometry(1, 1);
  const puffGeo = new THREE.IcosahedronGeometry(0.62, 1);
  const pineGeo = new THREE.ConeGeometry(1, 1.6, 7); pineGeo.translate(0, 0.8, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3d26, roughness: 1 });
  const leafMat = swayMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true });
  const rounds = trees.filter(t => !t.pine), pines = trees.filter(t => t.pine);
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
  const rm = new THREE.InstancedMesh(roundGeo, leafMat, rounds.length || 1);
  const pm = new THREE.InstancedMesh(puffGeo, leafMat, rounds.length || 1);   // a second, lighter blob on top
  const cones = new THREE.InstancedMesh(pineGeo, leafMat, (pines.length || 1) * 2);   // two tiers per pine
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  trees.forEach((t, i) => { m.compose(p.set(t.x, t.y - 0.2, t.z), q.identity(), sc.set(t.s, t.trunkH + 0.4, t.s)); trunks.setMatrixAt(i, m); });
  // warm greens, a few golden and a few autumn trees: the course at sunset
  const leaf = t => {
    const r = (t.hue * 7.13) % 1;
    if (r < 0.07) return col.setHSL(0.04 + t.hue * 0.03, 0.62, 0.42);    // autumn red-orange
    if (r < 0.16) return col.setHSL(0.11 + t.hue * 0.03, 0.62, 0.45);    // golden
    return col.setHSL(0.22 + t.hue * 0.1, 0.42, 0.26 + t.hue * 0.1);
  };
  rounds.forEach((t, i) => {
    q.setFromAxisAngle(p.set(0, 1, 0), t.hue * 6);
    m.compose(p.set(t.x, t.y + t.trunkH + t.canopyR * 0.75, t.z), q, sc.set(t.canopyR, t.canopyR * 0.85, t.canopyR)); rm.setMatrixAt(i, m);
    rm.setColorAt(i, leaf(t));
    const a = t.hue * 9, off = t.canopyR * 0.42;
    m.compose(p.set(t.x + Math.cos(a) * off, t.y + t.trunkH + t.canopyR * 1.25, t.z + Math.sin(a) * off), q, sc.set(t.canopyR, t.canopyR * 0.85, t.canopyR)); pm.setMatrixAt(i, m);
    pm.setColorAt(i, leaf(t).offsetHSL(0.01, 0.04, 0.08));
  });
  pines.forEach((t, i) => {
    const base = t.y + t.trunkH * 0.45, w = t.canopyR * 0.85, h = t.canopyR * 1.15;
    m.compose(p.set(t.x, base, t.z), q.identity(), sc.set(w, h, w)); cones.setMatrixAt(i * 2, m);
    cones.setColorAt(i * 2, col.setHSL(0.33 + t.hue * 0.05, 0.4, 0.17 + t.hue * 0.06));
    m.compose(p.set(t.x, base + h * 0.95, t.z), q.identity(), sc.set(w * 0.68, h * 0.85, w * 0.68)); cones.setMatrixAt(i * 2 + 1, m);
    cones.setColorAt(i * 2 + 1, col.setHSL(0.33 + t.hue * 0.05, 0.42, 0.22 + t.hue * 0.06));
  });
  for (const im of [trunks, rm, pm, cones]) { im.castShadow = true; im.receiveShadow = true; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; g.add(im); }
  if (!rounds.length) { rm.count = 0; pm.count = 0; }
  if (!pines.length) cones.count = 0;
  // hide(fn): shrink away the trees fn(t) picks (a camera move that must see
  // past them), restore the rest. hide(null) brings everything back.
  const saved = [trunks, rm, pm, cones].map(im => im.instanceMatrix.array.slice());
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const slots = trees.map((t, i) => t.pine
    ? [[0, i], [3, pines.indexOf(t) * 2], [3, pines.indexOf(t) * 2 + 1]]
    : [[0, i], [1, rounds.indexOf(t)], [2, rounds.indexOf(t)]]);
  g.userData.hide = fn => {
    const ims = [trunks, rm, pm, cones];
    ims.forEach((im, k) => im.instanceMatrix.array.set(saved[k]));
    if (fn) trees.forEach((t, i) => { if (fn(t)) for (const [k, j] of slots[i]) ims[k].setMatrixAt(j, zero); });
    for (const im of ims) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere?.(); }
  };
  g.userData.trees = trees;
  return g;
}

// Distant hills ringing the course so the horizon isn't bare.
export function buildBackdrop(center) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x5b5a7a, roughness: 1, flatShading: true });
  const rng = mulberry32(99);
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2 + rng() * 0.1, d = 520 + rng() * 200;
    const h = 40 + rng() * 90, r = 90 + rng() * 80;
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), mat);
    m.position.set(center.x + Math.cos(a) * d, h / 2 - 12, center.z + Math.sin(a) * d);
    m.rotation.y = rng() * 6;
    g.add(m);
  }
  return g;
}

// ---------------------------------------------------------- flag + cup
export function buildFlag(course, pin) {
  const g = new THREE.Group();
  const y = course.h(pin[0], pin[1]);
  g.position.set(pin[0], y, pin[1]);
  // the cup and rim always draw on top of the green overlay
  const cup = new THREE.Mesh(new THREE.CircleGeometry(CUP_R, 32), new THREE.MeshBasicMaterial({ color: 0x0b0d08, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -12 }));
  cup.rotation.x = -Math.PI / 2; cup.position.y = 0.02; cup.renderOrder = 4;
  const rim = new THREE.Mesh(new THREE.RingGeometry(CUP_R, CUP_R + 0.03, 32), new THREE.MeshBasicMaterial({ color: 0xf4f4ea, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -12 }));
  rim.rotation.x = -Math.PI / 2; rim.position.y = 0.021; rim.renderOrder = 4;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 2.6, 6), new THREE.MeshStandardMaterial({ color: 0xf2efe6 }));
  pole.position.y = 1.3; pole.castShadow = true;
  const clothGeo = new THREE.PlaneGeometry(0.9, 0.55, 10, 4); clothGeo.translate(0.45, 0, 0);
  const cloth = new THREE.Mesh(clothGeo, new THREE.MeshStandardMaterial({ color: 0xff3b4e, side: THREE.DoubleSide, roughness: 0.8 }));
  cloth.position.y = 2.32; cloth.castShadow = true;
  cloth.userData.base = clothGeo.attributes.position.array.slice();
  // a tall beacon so the pin reads from the tee
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 40, 6, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0.18, depthWrite: false }));
  beacon.position.y = 22;
  g.add(cup, rim, pole, cloth, beacon);
  g.userData = { cloth, beacon };
  return g;
}
export function waveFlag(flag, t, wind) {
  const cloth = flag.userData.cloth;
  const pos = cloth.geometry.attributes.position, base = cloth.userData.base;
  const ws = Math.hypot(wind.x, wind.z);
  cloth.rotation.y = Math.atan2(-wind.z, wind.x); // point downwind
  for (let i = 0; i < pos.count; i++) {
    const bx = base[i * 3], by = base[i * 3 + 1];
    const k = bx / 0.9;
    pos.setZ(i, Math.sin(t * (4 + ws) - bx * 7) * 0.09 * k * (0.4 + ws * 0.12));
    pos.setY(i, by - k * k * Math.max(0, 0.25 - ws * 0.03));
  }
  pos.needsUpdate = true;
  cloth.geometry.computeVertexNormals();
}

// Green-reading chevrons: point downhill, sized by slope.
export function buildSlopeArrows(course) {
  const [cx, cz, rx, rz] = course.green;
  const pts = [];
  const n = { x: 0, y: 1, z: 0 };
  for (let z = cz - rz * 1.3; z <= cz + rz * 1.3; z += 2.4) for (let x = cx - rx * 1.3; x <= cx + rx * 1.3; x += 2.4) {
    const s = course.surf(x, z);
    if (s !== 'green' && s !== 'fringe') continue;
    if (Math.hypot(x - course.hole.pin[0], z - course.hole.pin[1]) < 0.6) continue;
    course.normal(x, z, n);
    const sl = Math.hypot(n.x, n.z);
    if (sl < 0.004) continue;
    pts.push({ x, z, y: course.h(x, z) + 0.03, ang: Math.atan2(n.x, n.z), s: Math.min(1, sl * 25) });
  }
  const shape = new THREE.Shape();
  shape.moveTo(-0.22, -0.1); shape.lineTo(0, 0.14); shape.lineTo(0.22, -0.1); shape.lineTo(0.12, -0.1); shape.lineTo(0, 0.03); shape.lineTo(-0.12, -0.1);
  const geo = new THREE.ShapeGeometry(shape); geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false });
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, pts.length));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  pts.forEach((a, i) => { q.setFromAxisAngle(up, a.ang + Math.PI); m.compose(p.set(a.x, a.y, a.z), q, sc.setScalar(0.3 + a.s * 0.45)); im.setMatrixAt(i, m); });
  im.count = pts.length;
  im.userData.pts = pts;
  return im;
}

// ------------------------------------------------------------ graveyard
function textTexture(lines, w = 256, h = 256, { bg = '#9a9a92', fg = '#2a2a28', font = 'bold 34px Georgia, serif' } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 1500; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; x.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
  lines.forEach((l, i) => {
    x.font = l.font ?? font;
    x.fillText(l.text ?? l, w / 2, h * (0.3 + i * (0.5 / Math.max(1, lines.length - 1 || 1))));
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function buildTombstone(lines, big = false) {
  const g = new THREE.Group();
  const w = big ? 0.9 : 0.5, h = big ? 1.2 : 0.62, d = 0.14;
  const stone = new THREE.MeshStandardMaterial({ color: 0x8d8c86, roughness: 1 });
  const face = new THREE.MeshStandardMaterial({ map: textTexture(lines), roughness: 1 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [stone, stone, stone, stone, face, stone]);
  body.position.y = h / 2;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, d, 16, 1, false, 0, Math.PI), stone);
  top.rotation.z = Math.PI / 2; top.rotation.y = Math.PI / 2; top.position.y = h;
  body.castShadow = top.castShadow = true;
  g.add(body, top);
  g.rotation.z = (Math.random() - 0.5) * 0.12;
  return g;
}

// --------------------------------------------------------------- goose
export function buildGoose() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf6f4ee, roughness: 0.85, emissive: 0x3a3833 });
  const grey = new THREE.MeshStandardMaterial({ color: 0xc9c7c0, roughness: 0.85 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xff8a1e, roughness: 0.6 });
  const black = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), white);
  body.scale.set(1, 0.78, 1.45); body.position.y = 0.5; body.castShadow = true;
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 8), white);
  tail.rotation.x = -Math.PI / 2 - 0.5; tail.position.set(0, 0.6, -0.48);
  const wingL = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), grey); wingL.scale.set(0.35, 0.7, 1.4); wingL.position.set(0.27, 0.55, -0.05);
  const wingR = wingL.clone(); wingR.position.x = -0.27;
  const neckPivot = new THREE.Group(); neckPivot.position.set(0, 0.62, 0.35);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.1, 0.55, 8), white); neck.position.y = 0.26; neck.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), white); head.position.set(0, 0.56, 0.05); head.scale.set(0.9, 0.9, 1.2);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 8), orange); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.54, 0.22);
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), black); eyeL.position.set(0.08, 0.6, 0.1);
  const eyeR = eyeL.clone(); eyeR.position.x = -0.08;
  neckPivot.add(neck, head, beak, eyeL, eyeR);
  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 6), orange); legL.position.set(0.1, 0.15, 0.02);
  const legR = legL.clone(); legR.position.x = -0.1;
  const footGeo = new THREE.BoxGeometry(0.12, 0.02, 0.14);
  const footL = new THREE.Mesh(footGeo, orange); footL.position.set(0.1, 0.01, 0.06);
  const footR = footL.clone(); footR.position.x = -0.1;
  g.add(body, tail, wingL, wingR, neckPivot, legL, legR, footL, footR);
  // the stolen ball rides in the beak
  const carry = new THREE.Group(); carry.position.set(0, 0.5, 0.36); neckPivot.add(carry);
  // the "!" alert
  const alert = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture([{ text: '!', font: 'bold 200px sans-serif' }], 128, 256, { bg: 'rgba(0,0,0,0)', fg: '#ff3b30' }), depthTest: false, transparent: true }));
  alert.scale.set(0.5, 1, 1); alert.position.y = 1.7; alert.visible = false;
  g.add(alert);
  g.userData = { body, neckPivot, wingL, wingR, legL, legR, footL, footR, carry, alert };
  g.scale.setScalar(1.15);
  return g;
}

// A label sprite that stays readable at distance (scaled in the frame loop).
export function buildLabel(text, color = '#ffffff', bg = 'rgba(30,20,50,0.72)') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const x = c.getContext('2d');
  x.font = 'bold 54px ui-rounded, system-ui, sans-serif';
  const w = Math.min(500, x.measureText(text).width + 60);
  x.fillStyle = bg; x.beginPath(); x.roundRect((512 - w) / 2, 22, w, 84, 42); x.fill();
  x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.renderOrder = 10;
  s.userData.aspect = 4;
  return s;
}

// ------------------------------------------------------------- balls
export function buildBall(color = 0xffffff, ghost = false) {
  const mat = ghost
    ? new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false })
    : new THREE.MeshStandardMaterial({ color, roughness: 0.35 });
  const m = new THREE.Mesh(new THREE.SphereGeometry(R, 18, 14), mat);
  m.castShadow = !ghost;
  if (ghost) {
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(R * 4.5);
    m.add(halo);
  }
  return m;
}
let _glow = null;
export function glowTexture() {
  if (_glow) return _glow;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  _glow = new THREE.CanvasTexture(c);
  return _glow;
}

// ------------------------------------------------------------- club
export function buildClub() {
  const g = new THREE.Group();                        // pivot = hands
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.011, 1.05, 6), new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 0.8, roughness: 0.3 }));
  shaft.position.y = -0.525;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.014, 0.26, 8), new THREE.MeshStandardMaterial({ color: 0x1d1d22, roughness: 0.9 }));
  grip.position.y = -0.1;
  const glove = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.075), new THREE.MeshStandardMaterial({ color: 0xf6f3ea, roughness: 0.8 }));
  glove.position.y = -0.05;
  const glove2 = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.09, 0.07), new THREE.MeshStandardMaterial({ color: 0xc98e66, roughness: 0.8 }));
  glove2.position.set(0, -0.14, 0.004);
  const heads = {
    driver: new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), new THREE.MeshStandardMaterial({ color: 0x23232b, metalness: 0.5, roughness: 0.35 })),
    wood: new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), new THREE.MeshStandardMaterial({ color: 0x6b3a1e, metalness: 0.4, roughness: 0.4 })),
    iron: new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.09), new THREE.MeshStandardMaterial({ color: 0xd0d4da, metalness: 0.9, roughness: 0.25 })),
    wedge: new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.07, 0.085), new THREE.MeshStandardMaterial({ color: 0xb08a5a, metalness: 0.8, roughness: 0.3 })),
    putter: new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 0.12), new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.9, roughness: 0.2 })),
  };
  heads.driver.scale.set(0.8, 0.6, 1.2); heads.wood.scale.set(0.75, 0.5, 1.1);
  // heads lie across the line of aim (heel to toe sideways), not pointing at the target
  for (const h of Object.values(heads)) { h.position.y = -1.06; h.rotation.y = Math.PI / 2; h.castShadow = true; g.add(h); }
  g.add(shaft, grip, glove, glove2);
  g.userData.heads = heads;
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// Fishing rod held in first person, with a line to the bobber.
export function buildRod() {
  const g = new THREE.Group();
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.014, 1, 6), new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.6 }));
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 12), new THREE.MeshStandardMaterial({ color: 0xc0c4ca, metalness: 0.8, roughness: 0.3 }));
  const lineGeo = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 24 }, () => new THREE.Vector3()));
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
  line.frustumCulled = false;
  const bob = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), new THREE.MeshStandardMaterial({ color: 0xff3b30, roughness: 0.4 }));
  const bobTop = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  bobTop.position.y = 0.09; bob.add(bobTop);
  g.add(rod, reel, line, bob);
  g.userData = { rod, reel, line, bob };
  return g;
}
const _tip = new THREE.Vector3(), _base = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3();
export function updateRod(g, cam, target, t, tension, progress) {
  const { rod, reel, line, bob } = g.userData;
  cam.getWorldDirection(_f); _r.crossVectors(_f, cam.up).normalize();
  _base.copy(cam.position).addScaledVector(_f, 0.5).addScaledVector(_r, 0.28); _base.y -= 0.45;
  const bend = Math.min(1, tension / 100);
  _tip.copy(_base).addScaledVector(_f, 1.3 - bend * 0.25).addScaledVector(_r, 0.05); _tip.y += 0.75 - bend * 0.35;
  stretch(rod, _base, _tip); rod.position.lerpVectors(_base, _tip, 0.5);
  reel.position.copy(_base).addScaledVector(_f, 0.15);
  // the bobber comes toward the shore as you reel
  const bp = new THREE.Vector3().lerpVectors(target, new THREE.Vector3(_base.x, target.y, _base.z), progress / 100 * 0.7);
  bp.y = target.y + Math.sin(t * 7) * 0.05 * (1 + bend * 2) - bend * 0.08;
  bp.x += Math.sin(t * 13) * 0.04 * bend; bp.z += Math.cos(t * 11) * 0.04 * bend;
  bob.position.copy(bp);
  const pos = line.geometry.attributes.position;
  const sag = (1 - bend) * 1.2;
  for (let i = 0; i < pos.count; i++) {
    const k = i / (pos.count - 1);
    pos.setXYZ(i, _tip.x + (bp.x - _tip.x) * k, _tip.y + (bp.y - _tip.y) * k - Math.sin(k * Math.PI) * sag, _tip.z + (bp.z - _tip.z) * k);
  }
  pos.needsUpdate = true;
}

// First-person forearms: sleeve + skin cylinders stretched shoulder -> grip.
export function buildArms() {
  const g = new THREE.Group();
  const mk = () => {
    const a = new THREE.Group();
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1, 10), new THREE.MeshStandardMaterial({ color: 0xff9a3c, roughness: 0.9 }));
    sleeve.position.y = 0.5; sleeve.scale.y = 0.45; sleeve.position.y = 0.225;
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.05, 1, 10), new THREE.MeshStandardMaterial({ color: 0xc98e66, roughness: 0.8 }));
    fore.scale.y = 0.6; fore.position.y = 0.7;
    a.add(sleeve, fore);
    g.add(a);
    return a;
  };
  g.userData.l = mk(); g.userData.r = mk();
  return g;
}
const _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
export function stretch(obj, a, b) {
  _d.subVectors(b, a);
  const len = _d.length();
  obj.position.copy(a);
  obj.quaternion.setFromUnitVectors(_up, _d.normalize());
  obj.scale.set(1, len, 1);
}

export { textTexture, buildTerrainMesh, buildWater, buildGreenMesh };

// ------------------------------------------------------------- windmill (hole 5)
// A giant mini-golf windmill: white tower, red cap, four lattice sails. The
// rotor is returned separately so the game can set its angle every frame.
export function buildWindmill(course, wm) {
  const g = new THREE.Group();
  const h = course.h(wm.at[0], wm.at[1]);
  g.position.set(wm.at[0], h, wm.at[1]);
  const white = new THREE.MeshStandardMaterial({ color: 0xf3ede2, roughness: 0.9 });
  const red = new THREE.MeshStandardMaterial({ color: 0xc8402e, roughness: 0.8 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.9 });
  const sail = new THREE.MeshStandardMaterial({ color: 0xfff6e0, roughness: 1, side: THREE.DoubleSide });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(wm.tower * 0.8, wm.tower * 1.05, wm.towerH, 8), white);
  tower.position.y = wm.towerH / 2; tower.castShadow = tower.receiveShadow = true;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(wm.tower * 1.25, 3.2, 8), red);
  cap.position.y = wm.towerH + 1.5; cap.castShadow = true;
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.2), wood);
  door.position.set(0, 1.1, wm.tower * 1.0);
  g.add(tower, cap, door);
  if (wm.sign) {
    // a sign on the tower's face, between the door and the sails (owner: the Lookers windmill)
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
    new THREE.TextureLoader().load(wm.sign, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; mat.map = t; mat.needsUpdate = true; });
    const w = wm.tower * 2.1, hgt = w / 1.575, y = wm.towerH * 0.42;
    const back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, hgt + 0.3, 0.2), new THREE.MeshStandardMaterial({ color: 0xfaf3e6, emissive: 0x2a2620, roughness: 0.6 }));
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), mat);
    const zf = wm.tower * 0.98 + 0.25;
    back.position.set(0, y, zf); pic.position.set(0, y, zf + 0.11);
    g.add(back, pic);
  }
  const rotor = new THREE.Group();
  rotor.position.set(0, wm.hubH, wm.face);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.8, 12), red);
  hub.rotation.x = Math.PI / 2; rotor.add(hub);
  for (let b = 0; b < wm.blades; b++) {
    const arm = new THREE.Group(); arm.rotation.z = b * 2 * Math.PI / wm.blades;
    const spar = new THREE.Mesh(new THREE.BoxGeometry(wm.len, 0.35, 0.35), wood); spar.position.x = wm.len / 2;
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(wm.len * 0.78, 1.5), sail); cloth.position.set(wm.len * 0.56, 0.85, 0.05);
    spar.castShadow = cloth.castShadow = true;
    arm.add(spar, cloth); rotor.add(arm);
  }
  g.add(rotor);
  g.userData.rotor = rotor;
  return g;
}

// ------------------------------------------------------------- billboards (hole 5)
// Two posts, a frame, and the picture, turned to face the fairway back toward
// the tee. Textures load in the background; the frame shows until they arrive.
export function buildBillboards(course, list) {
  const g = new THREE.Group(), loader = new THREE.TextureLoader();
  const wood = new THREE.MeshStandardMaterial({ color: 0x4a3426, roughness: 0.85 });
  for (const b of list ?? []) {
    const [x, z] = b.at, y = course.h(x, z), lift = 2.6;
    const board = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    loader.load(b.img, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; mat.map = t; mat.needsUpdate = true; });
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.h), mat);
    pic.position.y = lift + b.h / 2;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.5, b.h + 0.5, 0.25), new THREE.MeshStandardMaterial({ color: b.light ? 0xf4efe4 : 0x2b2230, roughness: 0.6 }));
    frame.position.set(0, lift + b.h / 2, -0.15);
    board.add(frame, pic);
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, lift + b.h * 0.6, 0.35), wood);
      post.position.set(sx * b.w * 0.32, (lift + b.h * 0.6) / 2 - 0.3, -0.35); post.castShadow = true; board.add(post);
    }
    board.position.set(x, y, z);
    board.rotation.y = Math.atan2(0 - x, (z + 60) - z);   // face a point down the fairway toward the tee
    board.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.add(board);
  }
  return g;
}

// ------------------------------------------------------------- crazy golf (hole 8)
// White timber rails with red caps along the felt, red-and-white bumpers, a
// sign, and string lights (emissive bulbs only: no point lights, so phones
// stay fast). Every prop is under 0.6 m so the cup reads from anywhere.
export function buildCrazyGolf(course, h) {
  const g = new THREE.Group(), M = h.mini;
  const timber = new THREE.MeshStandardMaterial({ color: 0xf4efe4, roughness: 0.8 });
  const cap = new THREE.MeshStandardMaterial({ color: 0xd6362e, roughness: 0.6 });
  for (const [x1, z1, x2, z2] of miniRails(h)) {
    const len = Math.hypot(x2 - x1, z2 - z1), mx = (x1 + x2) / 2, mz = (z1 + z2) / 2, yaw = Math.atan2(x2 - x1, z2 - z1);
    let top = -Infinity, bot = Infinity;
    for (let k = 0; k <= 8; k++) { const y = course.h(x1 + (x2 - x1) * k / 8, z1 + (z2 - z1) * k / 8); top = Math.max(top, y); bot = Math.min(bot, y); }
    const hgt = top + M.railH - (bot - 0.05);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(M.rail * 2, hgt, len + M.rail * 2), timber);
    rail.position.set(mx, bot - 0.05 + hgt / 2, mz); rail.rotation.y = yaw; rail.castShadow = rail.receiveShadow = true;
    const c = new THREE.Mesh(new THREE.BoxGeometry(M.rail * 2.4, 0.04, len + M.rail * 2.4), cap);
    c.position.set(mx, bot - 0.05 + hgt + 0.02, mz); c.rotation.y = yaw;
    g.add(rail, c);
  }
  const red = new THREE.MeshStandardMaterial({ color: 0xe8413a, roughness: 0.4, emissive: 0x401010 });
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, emissive: 0x303030 });
  for (const [x, z, r] of h.bumpers ?? []) {
    const y = course.h(x, z);
    for (let k = 0; k < 3; k++) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.1, 20), k % 2 ? white : red);
      band.position.set(x, y + 0.05 + k * 0.1, z); band.castShadow = true; g.add(band);
    }
    const top = new THREE.Mesh(new THREE.SphereGeometry(r * 0.55, 14, 10), new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0xffc030, emissiveIntensity: 0.8 }));
    top.position.set(x, y + 0.32, z); g.add(top);
  }
  // the Block Party: chunky toy-voxel cubes, a pixel pattern on every face
  const pix = (base) => {
    const c = document.createElement('canvas'); c.width = c.height = 8;
    const x = c.getContext('2d'), rng = mulberry32(base);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const k = 0.82 + rng() * 0.3; x.fillStyle = `rgb(${Math.min(255, ((base >> 16) & 255) * k) | 0},${Math.min(255, ((base >> 8) & 255) * k) | 0},${Math.min(255, (base & 255) * k) | 0})`; x.fillRect(i, j, 1, 1); }
    const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  const blockCols = [0xff6b5a, 0xffc93c, 0x4fb6ff, 0x7bd96b, 0xc58bff];
  (h.blocks ?? []).forEach(([x, z, s], i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), new THREE.MeshStandardMaterial({ map: pix(blockCols[i % blockCols.length]), roughness: 0.7, emissive: 0x181818 }));
    m.position.set(x, course.h(x, z) + s / 2, z); m.castShadow = m.receiveShadow = true; g.add(m);
  });
  // string lights on posts down both sides of the lane
  const bulbCols = [0xff5a7a, 0xffd34a, 0x5ad1ff, 0x8aff7a];
  const bulbGeo = new THREE.SphereGeometry(0.06, 8, 6), postMat = new THREE.MeshStandardMaterial({ color: 0x3a3030 });
  const P = h.path, off = M.w / 2 + 1.4;
  const posts = [];
  for (const side of [-1, 1]) for (let i = 0; i < P.length - 1; i++) {
    const dx = P[i + 1][0] - P[i][0], dz = P[i + 1][1] - P[i][1], l = Math.hypot(dx, dz);
    for (let t = 0; t <= (i === P.length - 2 ? 1 : 0.99); t += 0.5) posts.push([P[i][0] + dx * t - dz / l * off * side, P[i][1] + dz * t + dx / l * off * side, side]);
  }
  for (const [x, z] of posts) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.4, 6), postMat); p.position.set(x, course.h(x, z) + 1.2, z); g.add(p); }
  for (const side of [-1, 1]) {
    const ps = posts.filter(p => p[2] === side);
    for (let i = 0; i < ps.length - 1; i++) {
      const [ax, az] = ps[i], [bx, bz] = ps[i + 1], ay = course.h(ax, az) + 2.35, by = course.h(bx, bz) + 2.35;
      for (let k = 0; k < 8; k++) {
        const t = (k + 0.5) / 8, sag = Math.sin(t * Math.PI) * 0.35;
        const b = new THREE.Mesh(bulbGeo, new THREE.MeshBasicMaterial({ color: bulbCols[(i * 8 + k) % 4] }));
        b.position.set(ax + (bx - ax) * t, ay + (by - ay) * t - sag, az + (bz - az) * t); g.add(b);
      }
    }
  }
  const sign = buildLabel(h.deck ? `CRAZY GOLF · ${h.deck.replace(/^The /, '').toUpperCase()}` : 'CRAZY GOLF', '#ffe066', 'rgba(60,20,90,0.85)');
  sign.position.set(h.tee[0] - 3.2, course.h(h.tee[0] - 3.2, h.tee[1] - 1) + 2.0, h.tee[1] - 1); sign.scale.set(3.2, 0.8, 1);
  g.add(sign);
  return g;
}
// The turnstile: a post and three striped arms sweeping the felt. The rotor
// turns with rotation.y = -angle, matching the flat windmill in physics.
export function buildTurnstile(course, wm) {
  const g = new THREE.Group();
  const y = course.h(wm.at[0], wm.at[1]);
  g.position.set(wm.at[0], y, wm.at[1]);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(wm.tower, wm.tower * 1.2, wm.towerH, 12), new THREE.MeshStandardMaterial({ color: 0xffe066, roughness: 0.5 }));
  post.position.y = wm.towerH / 2; post.castShadow = true;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(wm.tower * 1.4, 12, 10), new THREE.MeshStandardMaterial({ color: 0xe8413a, emissive: 0x501010 }));
  knob.position.y = wm.towerH;
  g.add(post, knob);
  const rotor = new THREE.Group(); rotor.position.y = wm.hubH;
  const red = new THREE.MeshStandardMaterial({ color: 0xe8413a, roughness: 0.5 }), white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  for (let b = 0; b < wm.blades; b++) {
    const arm = new THREE.Group(); arm.rotation.y = -b * 2 * Math.PI / wm.blades;
    for (let k = 0; k < 5; k++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(wm.bladeR * 0.8, wm.bladeR * 0.8, wm.len / 5, 10), k % 2 ? white : red);
      seg.rotation.z = Math.PI / 2; seg.position.x = wm.len * (k + 0.5) / 5; seg.castShadow = true;
      arm.add(seg);
    }
    rotor.add(arm);
  }
  g.add(rotor);
  g.userData.rotor = rotor;
  return g;
}
