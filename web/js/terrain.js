import * as THREE from 'three';
import { fbm } from './course.js';

// ---------------------------------------------------------------------------
// Meshes
// ---------------------------------------------------------------------------
const COL = {
  fairway: [0.36, 0.62, 0.22], fairway2: [0.31, 0.56, 0.19],
  green: [0.40, 0.74, 0.30], green2: [0.37, 0.70, 0.27],
  fringe: [0.33, 0.62, 0.24], tee: [0.40, 0.70, 0.28],
  rough: [0.22, 0.42, 0.14], sand: [0.93, 0.80, 0.55], water: [0.20, 0.35, 0.30], oob: [0.17, 0.30, 0.12],
};

export function buildTerrainMesh(course) {
  const [x0, z0, x1, z1] = course.bounds;
  const pad = 70;
  const W = x1 - x0 + pad * 2, D = z1 - z0 + pad * 2;
  const step = 1.25;
  const nx = Math.ceil(W / step), nz = Math.ceil(D / step);
  const geo = new THREE.PlaneGeometry(W, D, nx, nz);
  geo.rotateX(-Math.PI / 2);
  geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const seed = course.hole.seed ?? 7;
  const dir = new THREE.Vector2(course.hole.pin[0] - course.hole.tee[0], course.hole.pin[1] - course.hole.tee[1]).normalize();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    let h = course.height(x, z);
    const s = course.surface(x, z);
    // Out past the boundary the land lifts into a soft bowl so the world has edges.
    const ox = Math.max(0, x0 - x, x - x1), oz = Math.max(0, z0 - z, z - z1);
    const out = Math.hypot(ox, oz);
    if (out > 0) h += out * 0.16 + out * out * 0.0015 + fbm(x * 0.03, z * 0.03, seed + 40, 3) * out * 0.18;
    pos.setY(i, h);
    let c = COL[s] ?? COL.rough;
    const n = fbm(x * 0.2, z * 0.2, seed + 77, 2) * 0.12;
    if (s === 'fairway' || s === 'tee') {
      // Mowing stripes across the line of play.
      const along = x * dir.x + z * dir.y;
      c = (Math.floor(along / 6) % 2 === 0) ? COL.fairway : COL.fairway2;
    } else if (s === 'green') {
      const ang = Math.atan2(z - course.hole.pin[1], x - course.hole.pin[0]);
      c = (Math.floor((ang + Math.PI) / (Math.PI / 6)) % 2 === 0) ? COL.green : COL.green2;
    }
    if (s === 'oob') c = COL.oob;
    const k = 1 + n;
    colors[i * 3] = c[0] * k; colors[i * 3 + 1] = c[1] * k; colors[i * 3 + 2] = c[2] * k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  // the green has its own finer mesh (buildGreenMesh): cut the coarse terrain out under it
  const [gcx, gcz, grx, grz] = course.green;
  mat.onBeforeCompile = sh => {
    sh.uniforms.uGreen = { value: new THREE.Vector4(gcx, gcz, grx * 1.4, grz * 1.4) };
    sh.vertexShader = 'varying vec2 vGW;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xz;');
    sh.fragmentShader = 'uniform vec4 uGreen;\nvarying vec2 vGW;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\n  vec2 gq = (vGW - uGreen.xy) / uGreen.zw; if (dot(gq, gq) < 1.0) discard;');
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

export function buildWater(course) {
  const group = new THREE.Group();
  for (const p of course.ponds) {
    const [cx, cz, rx, rz] = p.e;
    const geo = new THREE.CircleGeometry(1, 48);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x3a7ea0, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.86,
      emissive: 0x1a3550, emissiveIntensity: 0.4,
    });
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(rx * 1.6, 1, rz * 1.6);
    m.position.set(cx, p.level, cz);
    m.userData.water = true;
    group.add(m);
  }
  return group;
}

// ---------------------------------------------------------------------------
// The green, drawn on its own: a fine mesh on the physics grid (so what you
// see is exactly what a putt rolls over) with crisp mowing stripes, a darker
// collar, a soft edge into the rough and a bright ring of turf at the cup.
// ---------------------------------------------------------------------------
export function buildGreenMesh(course) {
  const [cx, cz, rx, rz] = course.green, pin = course.hole.pin;
  const R = 1.6;                                    // a little past the terrain cut (1.4); the edge fades out
  const rings = 40, segs = 96;
  const pos = [], uv = [], idx = [], alpha = [];
  for (let i = 0; i <= rings; i++) for (let j = 0; j <= segs; j++) {
    const k = (i / rings) * R, a = j / segs * Math.PI * 2;
    const x = cx + Math.cos(a) * rx * k, z = cz + Math.sin(a) * rz * k;
    pos.push(x, course.h(x, z) + 0.004, z);
    uv.push((x - (cx - rx * R)) / (2 * rx * R), (z - (cz - rz * R)) / (2 * rz * R));
    alpha.push(k);
  }
  // wound so the faces point up
  for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) { const a = i * (segs + 1) + j, b = a + segs + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  // paint the turf into a canvas in green-space
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  const toPx = (wx, wz) => [(wx - (cx - rx * R)) / (2 * rx * R) * S, (wz - (cz - rz * R)) / (2 * rz * R) * S];
  const ell = (k, fill) => { const [px, pz] = toPx(cx, cz); x.beginPath(); x.ellipse(px, pz, rx * k / (2 * rx * R) * S, rz * k / (2 * rz * R) * S, 0, 0, Math.PI * 2); x.fillStyle = fill; x.fill(); };
  { // the collar fades softly into the terrain beyond the fringe: no ring, no lip
    const [px, pz] = toPx(cx, cz), r0 = 1.38 / R * (S / 2), r1 = S / 2;
    const g = x.createRadialGradient(px, pz, r0, px, pz, r1); g.addColorStop(0, 'rgba(84,140,58,1)'); g.addColorStop(1, 'rgba(84,140,58,0)');
    x.fillStyle = g; x.beginPath(); x.arc(px, pz, r1, 0, Math.PI * 2); x.fill();
  }
  if (course.hole.mini) { paintMini(x, course, toPx, ell); return finishGreen(geo, c); }
  ell(1.38, '#548c3a');                               // the collar / fringe
  ell(1.0, '#7cc84f');                                // the putting surface
  // diagonal mowing stripes, clipped to the green
  x.save(); { const [px, pz] = toPx(cx, cz); x.beginPath(); x.ellipse(px, pz, S / (2 * R), S / (2 * R) * (rz / rz), 0, 0, Math.PI * 2); x.clip(); }
  x.translate(S / 2, S / 2); x.rotate(Math.PI / 5);
  const stripe = 2.6 / (2 * rx * R) * S;
  for (let s = -S; s < S; s += stripe * 2) { x.fillStyle = 'rgba(255,255,200,0.22)'; x.fillRect(s, -S, stripe, S * 2); x.fillStyle = 'rgba(0,50,0,0.10)'; x.fillRect(s + stripe, -S, stripe, S * 2); }
  x.restore();
  // greenside bunkers: the terrain is cut out under the green overlay, so paint the
  // sand here too (playtest: bunkers by the green looked like grass)
  const [ox, oz] = toPx(0, 0), [ux] = toPx(1, 0), [, uz] = toPx(0, 1);
  for (const bk of course.hole.bunkers ?? []) {
    x.save(); x.setTransform((ux - ox) * bk[2], 0, 0, (uz - oz) * bk[3], ox + (ux - ox) * bk[0], oz + (uz - oz) * bk[1]);
    const g = x.createRadialGradient(0, 0, 0.0, 0, 0, 1.12);
    g.addColorStop(0, '#e9cf92'); g.addColorStop(0.86, '#e2c486'); g.addColorStop(0.9, '#b89a5c'); g.addColorStop(1, 'rgba(84,140,58,0)');
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, 1.12, 0, Math.PI * 2); x.fill();
    x.restore();
  }
  // a crisp edge line and a bright ring of fresh turf round the cup
  { const [px, pz] = toPx(cx, cz); x.beginPath(); x.ellipse(px, pz, S / (2 * R), S / (2 * R), 0, 0, Math.PI * 2); x.strokeStyle = 'rgba(255,245,200,0.6)'; x.lineWidth = 4; x.stroke(); }
  { const [px, pz] = toPx(pin[0], pin[1]), r = 0.9 / (2 * rx * R) * S, g = x.createRadialGradient(px, pz, 0, px, pz, r); g.addColorStop(0, 'rgba(160,230,110,0.55)'); g.addColorStop(1, 'rgba(160,230,110,0)'); x.fillStyle = g; x.beginPath(); x.arc(px, pz, r, 0, Math.PI * 2); x.fill(); }
  // fine grain so it reads as grass, not paint
  for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,220' : '20,60,10'},0.05)`; x.fillRect(Math.random() * S, Math.random() * S, 2, 2); }
  return finishGreen(geo, c);
}
function finishGreen(geo, c) {
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  tex.flipY = false;   // canvas rows run with +z, as the UVs do (crazy golf's lane is not symmetric)
  // no depth offset: it must never draw over the cup
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.82, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true; mesh.renderOrder = 1;
  return mesh;
}
// Crazy golf: a paved patio with a bright felt lane along the hole's path.
function paintMini(x, course, toPx, ell) {
  const h = course.hole, M = h.mini, S = x.canvas.width;
  { const [px, pz] = toPx(course.green[0], course.green[1]), r0 = 1.38 / 1.6 * (S / 2), r1 = S / 2;
    const g = x.createRadialGradient(px, pz, r0, px, pz, r1); g.addColorStop(0, 'rgba(138,131,120,1)'); g.addColorStop(1, 'rgba(138,131,120,0)');
    x.fillStyle = g; x.beginPath(); x.arc(px, pz, r1, 0, Math.PI * 2); x.fill(); }
  ell(1.38, '#8a8378');
  // flagstone joints
  x.strokeStyle = 'rgba(60,55,50,0.35)'; x.lineWidth = 2;
  for (let i = 0; i < S; i += 46) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, S); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(S, i); x.stroke(); }
  // the lane, drawn in world units (the canvas is anisotropic: x and z scale differently)
  const [ox, oz] = toPx(0, 0), [ux] = toPx(1, 0), [, uz] = toPx(0, 1);
  x.save(); x.setTransform(ux - ox, 0, 0, uz - oz, ox, oz);
  const lane = (w, col) => {
    x.beginPath(); x.moveTo(h.path[0][0], h.path[0][1]);
    for (const [px, pz] of h.path.slice(1)) x.lineTo(px, pz);
    x.lineWidth = w; x.lineCap = 'square'; x.lineJoin = 'round'; x.strokeStyle = col; x.stroke();
  };
  lane(M.w + 0.5, '#5b5148');                         // a shadowed kerb under the rails
  lane(M.w, '#2fae5a');                               // the felt
  lane(M.w * 0.92, '#33b862');
  // a tee mat and a bright ring round the cup
  x.fillStyle = '#e8e2d0'; x.fillRect(h.tee[0] - 0.45, h.tee[1] - 0.25, 0.9, 0.5);
  x.fillStyle = '#2a8e4a'; x.fillRect(h.tee[0] - 0.38, h.tee[1] - 0.18, 0.76, 0.36);
  x.beginPath(); x.arc(h.pin[0], h.pin[1], 0.55, 0, Math.PI * 2); x.fillStyle = 'rgba(160,240,140,0.35)'; x.fill();
  x.restore();
  for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,240' : '20,30,20'},0.05)`; x.fillRect(Math.random() * S, Math.random() * S, 2, 2); }
}
