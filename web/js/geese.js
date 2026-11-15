// Geese: three breeds on buildGoose()'s rig, the tree monster goose, and the
// boss crown. Procedural low-poly like the rest of the scene (primitives only,
// no asset files).
//
// Breeds (buildGooseBreed): drop-in replacements for world.js buildGoose().
// Same userData parts (body, neckPivot, wingL, wingR, legL, legR, footL,
// footR, carry, alert), same origin (feet), facing (+Z), root scale (1.15) and
// the same carry point in the beak, so main.js animates every breed with the
// code it already has. The differences main.js may notice:
//   - body is a Group (belly, breast and tail ride its wobble), not one Mesh.
//   - wingL/wingR are Groups hinged at the lower edge of the folded wing, so
//     main.js's rotation.z = -|flap| (L) / +|flap| (R) swings them outward.
//   - legs use Euler order 'YXZ' with rotation.y = PI, so main.js's
//     legL.rotation.x = +wob swings the bottom of the leg forward, in step
//     with footL.position.z = 0.06 + wob * 0.08 (the old legs went backward).
//
// Monster (buildMonsterGoose / animateMonsterGoose): a 3 m yeti-goose. Origin
// at the feet, facing +Z. animateMonsterGoose never touches g.position,
// g.rotation or g.scale; it poses an inner rig and keeps the lowest foot on
// y = 0 by itself.

import * as THREE from 'three';

// ---------------------------------------------------------------- helpers
function mat(color, { rough = 0.85, metal = 0, glow = 0.12, flat = false, map = null, vc = false, side } = {}) {
  const c = new THREE.Color(color);
  const m = new THREE.MeshStandardMaterial({
    color: c, roughness: rough, metalness: metal, flatShading: flat, vertexColors: vc,
    emissive: map ? new THREE.Color(glow, glow, glow) : c.clone().multiplyScalar(glow), emissiveMap: map, map,
  });
  if (side) m.side = side;
  return m;
}
const sph = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
function mesh(geo, m, parent, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, m); o.position.set(x, y, z);
  if (parent) parent.add(o);
  return o;
}
function group(parent, x = 0, y = 0, z = 0) {
  const o = new THREE.Group(); o.position.set(x, y, z);
  if (parent) parent.add(o);
  return o;
}
function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _up = new THREE.Vector3(0, 1, 0);
// a matrix from position, euler and scale
function M(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
}

// Merge several (geometry, matrix, colour) parts into ONE vertex-coloured,
// non-indexed geometry: one draw call per rigid part, however many pieces.
class Builder {
  constructor() { this.parts = []; }
  add(geo, m, color) { this.parts.push([geo, m ?? new THREE.Matrix4(), new THREE.Color(color)]); return this; }
  build() {
    const gs = this.parts.map(([geo, m, c]) => [(geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(m), c]);
    const n = gs.reduce((s, [g]) => s + g.attributes.position.count, 0);
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
    let o = 0;
    for (const [g, c] of gs) {
      const k = g.attributes.position.count;
      pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
      for (let i = 0; i < k; i++) { col[(o + i) * 3] = c.r; col[(o + i) * 3 + 1] = c.g; col[(o + i) * 3 + 2] = c.b; }
      o += k; g.dispose();
    }
    for (const [geo] of this.parts) geo.dispose();
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    out.computeBoundingSphere();
    return out;
  }
}

// A tube along a curve whose radius follows r(u), u in 0..1.
function taperTube(points, r, segs = 12, radial = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const geo = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  const pos = geo.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
  const rf = typeof r === 'function' ? r : (Array.isArray(r) ? u => r[0] + (r[1] - r[0]) * u : () => r);
  for (let i = 0; i <= segs; i++) {
    curve.getPointAt(i / segs, c);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(rf(i / segs)).add(c);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

// Where a ray from an ellipsoid's centre leaves its surface.
function onEllipsoid(c, r, dir, push = 0) {
  const d = new THREE.Vector3(...dir).normalize();
  const t = 1 / Math.sqrt((d.x / r[0]) ** 2 + (d.y / r[1]) ** 2 + (d.z / r[2]) ** 2);
  return new THREE.Vector3(c[0] + d.x * (t + push), c[1] + d.y * (t + push), c[2] + d.z * (t + push));
}

// Canvas textures, cached. Spheres map canvas rows to latitude, so:
// - gradTex(stops) on an unrotated body: back (top row) -> belly (bottom row);
// - barTex on a wing whose geometry was turned pole-forward: rows run front -> back.
const _tex = new Map();
function canvasTex(key, w, h, draw) {
  if (_tex.has(key)) return _tex.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  _tex.set(key, t);
  return t;
}
const hex = n => '#' + n.toString(16).padStart(6, '0');
function gradTex(key, stops) {
  return canvasTex('grad:' + key, 8, 128, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    for (const [s, col] of stops) g.addColorStop(s, hex(col));
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
}
// Feather rows: dark feathers with pale scalloped edges, darker primaries at the back.
function barTex(key, base, edge, tip, rows = 6) {
  return canvasTex('bar:' + key, 128, 256, (x, w, h) => {
    x.fillStyle = hex(base); x.fillRect(0, 0, w, h);
    x.strokeStyle = hex(edge); x.lineWidth = 3;
    for (let i = 1; i <= rows; i++) {
      const y = h * 0.3 + (h * 0.48) * (i / rows);
      x.beginPath();
      for (let u = 0; u <= w; u += 16) x.arc(u + 8, y - 6, 8, 0.1 * Math.PI, 0.9 * Math.PI);
      x.stroke();
    }
    x.fillStyle = hex(tip); x.fillRect(0, h * 0.8, w, h * 0.2);
  });
}

// webbed goose foot, flat, origin at its middle, toes toward +z
function webFootGeo(w, len, thick) {
  const s = new THREE.Shape();
  const hw = w / 2, heel = -len * 0.45, tip = len * 0.55;
  s.moveTo(0, heel);
  s.lineTo(hw * 0.35, heel + len * 0.12);
  s.lineTo(hw, tip * 0.88);
  s.quadraticCurveTo(hw * 0.62, tip * 0.62, hw * 0.42, tip * 0.78);
  s.lineTo(0, tip);
  s.lineTo(-hw * 0.42, tip * 0.78);
  s.quadraticCurveTo(-hw * 0.62, tip * 0.62, -hw, tip * 0.88);
  s.lineTo(-hw * 0.35, heel + len * 0.12);
  s.lineTo(0, heel);
  const geo = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 3 });
  geo.rotateX(Math.PI / 2); geo.translate(0, thick / 2, 0);
  geo.computeVertexNormals();
  return geo;
}

// the "!" over a goose that has spotted your ball
let _bang = null;
function bangSprite() {
  _bang ??= canvasTex('bang', 128, 256, (x, w, h) => {
    x.fillStyle = '#ff3b30'; x.font = 'bold 200px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('!', w / 2, h * 0.5);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: _bang, depthTest: false, transparent: true }));
  s.scale.set(0.5, 1, 1); s.position.y = 1.7; s.visible = false;
  return s;
}

// ================================================================ breeds
// Shared geometry (pre-scale goose units; the root is scaled 1.15):
// neckPivot at (0, 0.62, 0.35); head centre (0, 0.56, 0.05) in neckPivot;
// beak tip ~ (0, 0.535, 0.32); carry (0, 0.5, 0.36) in neckPivot.
const BREEDS = {
  embden: {
    bodyR: 0.32, bodyY: 0.5, bodyS: [1, 0.8, 1.45],
    back: 0xf3f1ea, flank: 0xf7f5ef, belly: 0xffffff,
    breast: [0xfbfaf5, [0, 0.47, 0.2], [0.24, 0.23, 0.23]],
    paunch: [0xf5f3ec, [0, 0.36, -0.06], [0.23, 0.14, 0.3]],
    wing: { base: 0xe9e6de, edge: 0xfaf9f5, tip: 0xd6d2c8 },
    tail: 0xefede6, vent: null,
    neck: 0xf6f4ee, neckR: [0.1, 0.07], neckFrom: -0.06,
    head: 0xf8f6f0, headS: [0.86, 0.88, 1.24],
    beak: 0xff8a1e, beakR: 0.05, nail: 0xf59a52,
    eye: 0x1d2a4a, legs: 0xff8a1e, legH: 0.3, glow: 0.2,
  },
  toulouse: {
    bodyR: 0.335, bodyY: 0.47, bodyS: [1.12, 0.82, 1.4],
    back: 0x575551, flank: 0x7d7a74, belly: 0xe4e2dd,
    breast: [0x8a8680, [0, 0.43, 0.21], [0.27, 0.25, 0.24]],
    paunch: [0xe9e5dd, [0, 0.27, -0.05], [0.3, 0.19, 0.38]],     // the low, nearly-dragging keel
    wing: { base: 0x4a4744, edge: 0x908b84, tip: 0x2c2a28 },
    tail: 0x4a4744, vent: 0xf2efe9,
    neck: 0x77736d, neckR: [0.125, 0.082], neckFrom: -0.06,
    head: 0x7a766f, headS: [0.95, 0.9, 1.18],
    beak: 0xf07a28, beakR: 0.058, nail: 0xd9a070,
    dewlap: 0x837f78,
    eye: 0x1a1410, legs: 0xf07a28, legH: 0.26, glow: 0.13,
  },
  canada: {
    bodyR: 0.31, bodyY: 0.5, bodyS: [0.88, 0.72, 1.55],
    back: 0x5e4836, flank: 0x856a52, belly: 0xd8ccb6,
    breast: [0xcfc1a8, [0, 0.47, 0.22], [0.2, 0.2, 0.2]],
    paunch: [0xe4dccb, [0, 0.39, -0.05], [0.2, 0.12, 0.3]],
    wing: { base: 0x5a4431, edge: 0x7a6650, tip: 0x241e1a, rows: 4 },
    tail: 0x161616, vent: 0xffffff,
    neck: 0x141414, neckR: [0.088, 0.06], neckFrom: -0.17,             // starts low in a slim body: reads long
    head: 0x161616, headS: [0.82, 0.86, 1.24], chinstrap: 0xffffff,
    beak: 0x1c1c1c, beakR: 0.046, nail: 0x0c0c0c,
    eye: 0x050505, legs: 0x262626, legH: 0.31, glow: 0.12,
  },
};
export const GOOSE_BREEDS = Object.keys(BREEDS);

export function buildGooseBreed(breed = 'embden') {
  const S = BREEDS[breed] ?? BREEDS.embden;
  const key = BREEDS[breed] ? breed : 'embden';
  const g = new THREE.Group(); g.name = 'Goose:' + key;
  const G = S.glow;
  const plain = c => mat(c, { glow: G });

  // body: a Group at the body centre, so main.js's rotation.z wobbles the lot
  const body = group(g, 0, S.bodyY, 0);
  const bodyMat = mat(0xffffff, { map: gradTex(key, [[0, S.back], [0.42, S.flank], [0.7, S.belly], [1, S.belly]]), glow: G });
  const core = mesh(sph(S.bodyR, 20, 14), bodyMat, body); core.scale.set(...S.bodyS);
  const [bc, bp, br] = S.breast;
  const breast = mesh(sph(1, 20, 14), plain(bc), body, bp[0], bp[1] - S.bodyY, bp[2]); breast.scale.set(...br);
  const [pc, pp, pr] = S.paunch;
  const paunch = mesh(sph(1, 20, 14), plain(pc), body, pp[0], pp[1] - S.bodyY, pp[2]); paunch.scale.set(...pr);
  // tail: a flat fan tipped up a little
  const tailGeo = new THREE.ConeGeometry(0.15, 0.22, 8); tailGeo.translate(0, 0.11, 0);
  const tail = mesh(tailGeo, plain(S.tail), body, 0, 0.08, -S.bodyR * S.bodyS[2] + 0.06);
  tail.rotation.x = -Math.PI / 2 + 0.38; tail.scale.set(1.25, 1, 0.42);
  if (S.vent) {   // pale undertail (Toulouse) / white rump band (Canada)
    const v = mesh(sph(1, 12, 8), plain(S.vent), body, 0, key === 'canada' ? 0.05 : -0.04, -S.bodyR * S.bodyS[2] + 0.08);
    v.scale.set(key === 'canada' ? 0.17 : 0.2, key === 'canada' ? 0.09 : 0.12, 0.11);
  }

  // wings: hinged at the lower edge of the folded wing
  const wingTex = barTex(key, S.wing.base, S.wing.edge, S.wing.tip, S.wing.rows);
  const wingMat = mat(0xffffff, { map: wingTex, glow: G });
  const tipMat = plain(S.wing.tip);
  const wingGeo = sph(0.22, 14, 12); wingGeo.rotateX(Math.PI / 2);     // pole forward: canvas rows run front -> back
  const wx = S.bodyR * S.bodyS[0] * 0.86, wy = S.bodyY - 0.08;
  const mkWing = s => {
    const w = group(g, s * wx, wy, -0.05);
    const m = mesh(wingGeo, wingMat, w, 0, 0.12, 0); m.scale.set(0.36, 0.7, 1.38);
    const prim = mesh(new THREE.ConeGeometry(0.06, 0.3, 6), tipMat, w, -s * 0.03, 0.16, -0.36);
    prim.rotation.x = -Math.PI / 2 + 0.25; prim.scale.set(0.5, 1, 1);
    return w;
  };
  const wingL = mkWing(1), wingR = mkWing(-1);

  // neck + head (all in neckPivot so the head peck/strut stays as before)
  const neckPivot = group(g, 0, 0.62, 0.35);
  const neckMat = plain(S.neck);
  mesh(taperTube([[0, S.neckFrom, -0.06], [0, 0.16, -0.025], [0, 0.34, 0.02], [0, 0.5, 0.035]], S.neckR, 12, 9), neckMat, neckPivot);
  const head = mesh(sph(0.12, 16, 12), plain(S.head), neckPivot, 0, 0.56, 0.05); head.scale.set(...S.headS);
  // a little brow ridge so the head is not a ball
  const ridge = mesh(sph(0.07, 10, 8), plain(S.head), neckPivot, 0, 0.6, 0.11); ridge.scale.set(1.15, 0.7, 1.3);
  const beakGeo = new THREE.ConeGeometry(S.beakR, 0.2, 10); beakGeo.rotateX(Math.PI / 2);
  const beak = mesh(beakGeo, mat(S.beak, { rough: 0.55, glow: G }), neckPivot, 0, 0.535, 0.22); beak.scale.set(1.05, 0.74, 1);
  const nail = mesh(sph(0.015, 8, 6), mat(S.nail, { rough: 0.5, glow: G }), neckPivot, 0, 0.537, 0.305); nail.scale.set(1, 0.6, 1.4);
  if (S.chinstrap) {   // Canada: the white cheek patch that wraps under the chin
    const strap = mesh(sph(1, 16, 10), plain(S.chinstrap), neckPivot, 0, 0.525, 0.035);
    strap.scale.set(0.112, 0.07, 0.1);
  }
  if (S.dewlap) {      // Toulouse: the heavy fold of skin under the bill
    const dew = mesh(sph(1, 12, 10), plain(S.dewlap), neckPivot, 0, 0.42, 0.09);
    dew.scale.set(0.06, 0.13, 0.085);
    const dew2 = mesh(sph(1, 10, 8), plain(S.dewlap), neckPivot, 0, 0.3, 0.05);
    dew2.scale.set(0.05, 0.09, 0.06);
  }
  const eyeMat = mat(S.eye, { rough: 0.25, glow: 0.02 });
  const shine = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const s of [1, -1]) {
    const e = mesh(sph(0.022, 8, 6), eyeMat, neckPivot, s * 0.083, 0.6, 0.1);
    if (key !== 'canada') mesh(sph(0.007, 6, 4), shine, e, s * 0.012, 0.008, 0.012);
  }

  // legs: Euler 'YXZ' + y = PI so +rotation.x swings the leg bottom forward
  const legMat = mat(S.legs, { rough: 0.6, glow: G });
  const legGeo = new THREE.CylinderGeometry(0.028, 0.024, S.legH, 7);
  const mkLeg = s => { const l = mesh(legGeo, legMat, g, s * 0.1, S.legH / 2, 0.02); l.rotation.set(0, Math.PI, 0, 'YXZ'); return l; };
  const legL = mkLeg(1), legR = mkLeg(-1);
  const footGeo = webFootGeo(0.15, 0.17, 0.018);
  const footL = mesh(footGeo, legMat, g, 0.1, 0.01, 0.06);
  const footR = mesh(footGeo, legMat, g, -0.1, 0.01, 0.06);

  // the stolen ball rides in the beak (same point as buildGoose)
  const carry = group(neckPivot, 0, 0.5, 0.36);
  const alert = bangSprite(); g.add(alert);

  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.userData = { body, neckPivot, wingL, wingR, legL, legR, footL, footR, carry, alert };
  g.scale.setScalar(1.15);
  return g;
}

// ================================================================ the tree monster goose
// Dimensions in metres. Hips at y = 1.0, shoulders ~2.0, head top ~3.0.
const MON = { hipY: 1.0, hipX: 0.34, T: 0.48, S: 0.42, ankle: 0.1, UA: 0.62, FA: 0.58 };
const FUR = [0xffffff, 0xf6f8fb, 0xedf1f7, 0xe2e8f1];
const FUR_CORE = 0xd6dde8;

// shaggy clumped fur: a core ellipsoid plus low-poly tufts drooping off its surface
function fur(B, c, rad, { n = 40, tuft = 0.12, len = 0.22, droop = 0.8, seed = 1, below = -2 } = {}) {
  const ico = new THREE.IcosahedronGeometry(1, 1);
  B.add(ico, M(c[0], c[1], c[2], 0, 0, 0, rad[0], rad[1], rad[2]), FUR_CORE);
  const R = rng(seed), d = new THREE.Vector3(), nrm = new THREE.Vector3(), dir = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const u = R() * 2 - 1, a = R() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    d.set(s * Math.cos(a), u, s * Math.sin(a));
    if (d.y < below) continue;
    const p = new THREE.Vector3(c[0] + d.x * rad[0], c[1] + d.y * rad[1], c[2] + d.z * rad[2]);
    nrm.set(d.x / rad[0], d.y / rad[1], d.z / rad[2]).normalize();
    // a lock of fur lying flat on the body, its tip hanging down
    dir.copy(nrm).multiplyScalar(0.55); dir.y -= droop * (1 - Math.max(0, nrm.y) * 0.9);
    dir.x += (R() - 0.5) * 0.35; dir.z += (R() - 0.5) * 0.35; dir.normalize();
    const h = len * (0.75 + R() * 0.6), w = tuft * (0.9 + R() * 0.5);
    const zx = nrm.clone().addScaledVector(dir, -nrm.dot(dir));
    if (zx.lengthSq() < 1e-4) zx.set(0, 0, 1);
    zx.normalize();
    const xx = new THREE.Vector3().crossVectors(dir, zx);
    const m = new THREE.Matrix4().makeBasis(xx, dir, zx).multiply(new THREE.Matrix4().makeScale(1, 1, 0.55));
    m.setPosition(p.clone().addScaledVector(nrm, w * 0.12).addScaledVector(dir, h * 0.32));
    B.add(new THREE.ConeGeometry(w, h, 5, 1), m, FUR[Math.floor(R() * FUR.length)]);
  }
}

// a big orange goose-hand, built for side s (+1 = left, at +x); palm faces the body
function buildHand(parent, s, skin) {
  const hand = group(parent, 0, 0, 0);
  const palmB = new Builder();
  palmB.add(sph(1, 12, 10), M(0, -0.13, 0, 0, 0, 0, 0.085, 0.16, 0.15), 0xff9a2e);
  palmB.add(sph(1, 10, 8), M(0, -0.25, 0, 0, 0, 0, 0.05, 0.06, 0.15), 0xff9228);   // webbing between the fingers
  // furry cuff over the wrist
  fur(palmB, [0, 0.0, 0], [0.12, 0.08, 0.15], { n: 14, tuft: 0.07, len: 0.12, droop: 0.8, seed: 40 + s });
  mesh(palmB.build(), skin, hand);
  const fingers = [];
  for (const [z, len] of [[-0.095, 0.17], [0, 0.2], [0.095, 0.17]]) {
    const f = group(hand, 0, -0.25, z);
    const fb = new Builder();
    fb.add(new THREE.CapsuleGeometry(0.048, len, 3, 8), M(0, -len / 2 - 0.02, 0), 0xff9a2e);
    fb.add(sph(0.03, 8, 6), M(0, -len - 0.06, 0.0, 0, 0, 0, 1, 0.7, 1), 0x3b2a22);   // a stubby claw
    mesh(fb.build(), skin, f);
    fingers.push(f);
  }
  const thumb = group(hand, -s * 0.03, -0.1, 0.13);
  const tb = new Builder();
  tb.add(new THREE.CapsuleGeometry(0.045, 0.12, 3, 8), M(0, -0.08, 0.02), 0xff9a2e);
  tb.add(sph(0.028, 8, 6), M(0, -0.17, 0.035, 0, 0, 0, 1, 0.7, 1), 0x3b2a22);
  mesh(tb.build(), skin, thumb);
  thumb.rotation.x = 0.6;
  hand.userData = { fingers, thumb, s };
  return hand;
}

export function buildMonsterGoose() {
  const g = new THREE.Group(); g.name = 'MonsterGoose';
  const furMat = mat(0xffffff, { vc: true, flat: true, rough: 1, glow: 0 }); furMat.emissive.setHex(0x464b58);
  const skin = mat(0xffffff, { vc: true, rough: 0.55, glow: 0 }); skin.emissive.setHex(0x3a1c06);
  const feather = mat(0xffffff, { vc: true, rough: 0.8, glow: 0 }); feather.emissive.setHex(0x3a3c40);
  const rig = group(g);   // posed by animateMonsterGoose (hop, shake); g itself is main.js's

  // ---- body: the torso pivots at the hips
  const body = group(rig, 0, MON.hipY, 0);
  const tb = new Builder();
  fur(tb, [0, 0.42, 0.06], [0.6, 0.6, 0.52], { n: 70, seed: 1, tuft: 0.15, len: 0.28 });        // pot belly
  fur(tb, [0, 0.92, 0.0], [0.7, 0.42, 0.5], { n: 60, seed: 2, tuft: 0.15, len: 0.26 });         // chest + shoulders
  fur(tb, [0, 1.04, -0.14], [0.52, 0.34, 0.38], { n: 30, seed: 3, tuft: 0.14, len: 0.24 });     // the hulking back hump
  fur(tb, [0, 0.08, -0.02], [0.5, 0.26, 0.42], { n: 30, seed: 4, tuft: 0.14, len: 0.3, droop: 0.9 }); // hips: a shaggy skirt
  // a perky goose tail on the bum
  for (const [a, y] of [[-0.45, 0.32], [0, 0.36], [0.45, 0.32]]) {
    const f = new THREE.ConeGeometry(0.09, 0.42, 5); f.translate(0, 0.21, 0);
    tb.add(f, M(a * 0.18, y, -0.52, -0.9, 0, -a, 1, 1, 0.4), 0xf6f7f9);
  }
  mesh(tb.build(), furMat, body);

  // ---- neck and head
  const neck = group(body, 0, 1.2, 0.14); neck.rotation.x = 0.12;
  const nb = new Builder();
  fur(nb, [0, 0.2, 0.02], [0.27, 0.34, 0.27], { n: 36, seed: 5, tuft: 0.11, len: 0.2, droop: 0.4 });
  mesh(nb.build(), furMat, neck);
  const gulp = mesh(sph(0.11, 10, 8), feather, neck, 0, 0.3, 0.25);   // the lump of a swallowed ball
  gulp.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(gulp.geometry.attributes.position.count * 3).fill(0.95), 3));
  gulp.visible = false;

  const head = group(neck, 0, 0.44, 0.06);
  const HC = [0, 0.08, 0.04], HR = [0.23, 0.22, 0.29];
  const hb = new Builder();
  hb.add(sph(1, 18, 14), M(...HC, 0, 0, 0, ...HR), 0xffffff);
  hb.add(sph(1, 12, 10), M(0, 0.0, 0.15, 0, 0, 0, 0.19, 0.15, 0.2), 0xf7f8fa);                  // jowls
  for (const [a, h] of [[-0.35, 0.16], [0, 0.22], [0.4, 0.15]]) {                                // the cowlick
    const f = new THREE.ConeGeometry(0.035, h, 4); f.translate(0, h / 2, 0);
    hb.add(f, M(a * 0.06, 0.27, -0.02 + a * 0.02, -0.35, 0, -a), 0xffffff);
  }
  mesh(hb.build(), feather, head);

  // beady angry eyes
  const eyeB = () => { const b = new Builder(); b.add(sph(0.058, 12, 10), null, 0x0b0b0e); b.add(sph(0.018, 6, 5), M(0.014, 0.024, 0.045), 0xffffff); return b.build(); };
  const eyeMat = mat(0xffffff, { vc: true, rough: 0.2, glow: 0 });
  const eyeL = mesh(eyeB(), eyeMat, head); eyeL.position.copy(onEllipsoid(HC, HR, [0.55, 0.12, 0.8], -0.022));
  const eyeR = mesh(eyeB(), eyeMat, head); eyeR.position.copy(onEllipsoid(HC, HR, [-0.55, 0.12, 0.8], -0.022));
  eyeR.scale.x = -1;
  // the unibrow: one thick V, low in the middle
  const browPts = [[0.85, 0.62, 0.55], [0.5, 0.42, 0.85], [0.18, 0.3, 1], [0, 0.26, 1], [-0.18, 0.3, 1], [-0.5, 0.42, 0.85], [-0.85, 0.62, 0.55]]
    .map(d => onEllipsoid(HC, HR, d, 0.012).toArray());
  const brow = group(head, 0, 0, 0);
  mesh(taperTube(browPts, u => 0.022 + 0.016 * Math.sin(u * Math.PI), 18, 7), mat(0x3a3d48, { rough: 1, glow: 0.05 }), brow);

  // the beak: two mandibles hinged at the mouth corner, with goose "teeth"
  const ORANGE = 0xff8a1e, TOOTH = 0xfff4d6;
  const beakTop = group(head, 0, 0.0, 0.25);
  const bt = new Builder();
  const upper = new THREE.ConeGeometry(0.17, 0.52, 12); upper.rotateX(Math.PI / 2);
  bt.add(upper, M(0, 0.035, 0.22, 0, 0, 0, 1, 0.46, 1), ORANGE);
  bt.add(sph(0.035, 8, 6), M(0, 0.03, 0.43, 0, 0, 0, 1, 0.45, 1.3), 0xe0701a);                     // the nail at the tip
  for (const s of [1, -1]) bt.add(sph(0.018, 6, 4), M(s * 0.05, 0.085, 0.1, 0, 0, 0, 1, 0.5, 1.6), 0x5a2a08);   // nostrils
  for (let i = 0; i < 6; i++) {
    const z = 0.04 + i * 0.06, r = 0.17 * (0.48 - z) / 0.52 * 0.88;
    for (const s of [1, -1]) { const t = new THREE.ConeGeometry(0.019, 0.05, 4); t.rotateX(Math.PI); bt.add(t, M(s * r, -0.02, z), TOOTH); }
  }
  mesh(bt.build(), skin, beakTop);
  const beakBottom = group(head, 0, -0.03, 0.25);
  const bb = new Builder();
  const lower = new THREE.ConeGeometry(0.14, 0.44, 12); lower.rotateX(Math.PI / 2);
  bb.add(lower, M(0, -0.045, 0.18, 0, 0, 0, 1, 0.36, 1), 0xf47f18);
  bb.add(sph(1, 10, 8), M(0, -0.01, 0.12, 0, 0, 0, 0.1, 0.035, 0.2), 0x8a1f2a);                   // mouth
  bb.add(sph(1, 10, 8), M(0, 0.0, 0.14, 0, 0, 0, 0.07, 0.03, 0.14), 0xff8aa0);                    // tongue
  for (let i = 0; i < 5; i++) {
    const z = 0.04 + i * 0.065, r = 0.14 * (0.4 - z) / 0.44 * 0.85;
    for (const s of [1, -1]) bb.add(new THREE.ConeGeometry(0.016, 0.04, 4), M(s * r, -0.01, z), TOOTH);
  }
  mesh(bb.build(), skin, beakBottom);
  const mouth = group(beakBottom, 0, 0.02, 0.14);   // where an eaten ball sits

  // ---- arms
  const mkArm = s => {
    const arm = group(body, s * 0.66, 0.98, -0.02);
    const ub = new Builder();
    fur(ub, [0, -0.04, 0], [0.24, 0.2, 0.24], { n: 18, seed: 10 + s, tuft: 0.12, len: 0.22 });    // shoulder
    fur(ub, [0, -0.32, 0], [0.19, 0.34, 0.19], { n: 34, seed: 12 + s, tuft: 0.11, len: 0.22 });
    mesh(ub.build(), furMat, arm);
    const elbow = group(arm, 0, -MON.UA, 0);
    const fb = new Builder();
    fur(fb, [0, -0.27, 0], [0.18, 0.33, 0.18], { n: 34, seed: 14 + s, tuft: 0.11, len: 0.24 });
    fur(fb, [0, -0.5, 0], [0.16, 0.1, 0.16], { n: 16, seed: 16 + s, tuft: 0.08, len: 0.2, droop: 1.2 });   // shaggy cuff
    mesh(fb.build(), furMat, elbow);
    const hand = buildHand(group(elbow, 0, -MON.FA, 0), s, skin);
    arm.userData = { elbow, hand };
    return arm;
  };
  const armL = mkArm(1), armR = mkArm(-1);
  const handL = armL.userData.hand, handR = armR.userData.hand;
  const carry = group(handR, 0.09, -0.2, 0.05);    // between the palm and the curled fingers

  // ---- legs: hip -> knee -> ankle -> a huge flat webbed foot
  const mkLeg = s => {
    const leg = group(rig, s * MON.hipX, MON.hipY, 0);
    const lb = new Builder();
    fur(lb, [0, -0.22, 0], [0.27, 0.33, 0.27], { n: 36, seed: 20 + s, tuft: 0.13, len: 0.24 });
    mesh(lb.build(), furMat, leg);
    const knee = group(leg, 0, -MON.T, 0);
    const kb = new Builder();
    fur(kb, [0, -0.2, 0], [0.22, 0.25, 0.22], { n: 34, seed: 22 + s, tuft: 0.12, len: 0.22, droop: 0.9, below: -0.4 });
    fur(kb, [0, -0.3, 0.02], [0.23, 0.08, 0.25], { n: 18, seed: 24 + s, tuft: 0.1, len: 0.16, droop: 0.6 });   // bell-bottoms
    mesh(kb.build(), furMat, knee);
    const foot = group(knee, 0, -MON.S, 0);
    const ftb = new Builder();
    ftb.add(webFootGeo(0.56, 0.86, 0.07), M(0, -MON.ankle + 0.035, 0.22), 0xff8a1e);
    for (const [x, z] of [[0.27, 0.58], [0, 0.69], [-0.27, 0.58]]) ftb.add(sph(0.045, 8, 6), M(x, -MON.ankle + 0.05, z, 0, 0, 0, 1, 0.6, 1.3), 0x3b2a22);
    ftb.add(sph(1, 10, 8), M(0, -0.04, 0.02, 0, 0, 0, 0.14, 0.07, 0.17), 0xf47f18);   // ankle knob under the fur
    mesh(ftb.build(), skin, foot);
    leg.userData = { knee, foot };
    return leg;
  };
  const legL = mkLeg(1), legR = mkLeg(-1);

  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.userData = {
    rig, body, neck, head, beakTop, beakBottom, mouth, brow, gulp,
    armL, armR, handL, handR, carry, legL, legR, eyeL, eyeR,
  };
  animateMonsterGoose(g, 0, { mode: 'idle' });
  return g;
}

// k at which the grab's hand is on the ground, the eat's ball drops into the
// beak, and the throw lets go
export const MONSTER_GRAB_PICK = 0.5;
export const MONSTER_EAT_SWALLOW = 0.42;
export const MONSTER_THROW_RELEASE = 0.56;

const sm = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const seg = (k, a, b) => sm((k - a) / (b - a));
const mix = (a, b, t) => a + (b - a) * t;
const arm = (fwd = 0.1, out = 0.16, bend = 0.3, curl = 0.35, twist = 0, wrist = 0) => ({ fwd, out, bend, curl, twist, wrist });
const leg = (fwd = 0, knee = 0.06, out = 0.04, toe = 0) => ({ fwd, knee, out, toe });

// state: { mode: 'idle'|'run'|'roar'|'grab'|'eat'|'dance'|'throw', speed (m/s, run), k (0..1: grab/eat/throw) }
export function animateMonsterGoose(g, t, state = { mode: 'idle' }) {
  const u = g.userData, mode = state.mode ?? 'idle', k = Math.min(1, Math.max(0, state.k ?? 0));
  const P = {
    hop: 0, lean: 0.1, sway: 0, twist: 0, breath: 0, shakeZ: 0, shakeY: 0,
    neck: 0.12, headX: 0, headY: 0, headZ: 0, gape: 0.04, upper: 0, brow: 1, browY: 0, blink: true, gulp: -1,
    aL: arm(), aR: arm(), lL: leg(), lR: leg(),
  };
  if (mode === 'idle') {
    const b = Math.sin(t * 1.5);
    P.breath = b; P.sway = Math.sin(t * 0.7) * 0.05; P.lean = 0.12 + b * 0.015;
    P.headY = Math.sin(t * 0.43) * 0.45; P.headX = Math.sin(t * 0.31) * 0.08; P.neck = 0.14 - b * 0.03;
    P.gape = 0.04 + Math.max(0, Math.sin(t * 0.9 - 1)) ** 8 * 0.25;   // the odd silent honk
    P.aL = arm(0.12 + Math.sin(t * 0.7 + 0.6) * 0.06, 0.2 + b * 0.03, 0.35, 0.35);
    P.aR = arm(0.12 + Math.sin(t * 0.7 + 0.9) * 0.06, 0.2 + b * 0.03, 0.35, 0.35);
    P.lL = leg(0.02, 0.12, 0.06); P.lR = leg(-0.02, 0.12, 0.06);
  } else if (mode === 'run') {
    const sp = Math.max(2, state.speed ?? 6), f = sp / 2.6, p = t * Math.PI * 2 * f, sw = Math.sin(p), cw = Math.cos(p);
    P.lean = 0.18 + Math.min(0.12, sp * 0.012); P.hop = Math.abs(cw) * 0.16; P.twist = sw * 0.16; P.sway = sw * 0.06;
    P.neck = 0.25; P.headX = -0.1 + Math.sin(p * 2) * 0.1; P.headY = -sw * 0.12;
    P.gape = 0.45 + Math.sin(p * 2) * 0.3; P.brow = 1.1;
    // SkiFree: both arms up over the head, flailing out of phase
    P.aL = arm(2.8 + sw * 0.3, 0.45 + Math.sin(p * 2 + 0.5) * 0.3, 0.55 + Math.sin(p + 1) * 0.4, 0.05, 0, Math.sin(p * 2) * 0.6);
    P.aR = arm(2.8 - sw * 0.3, 0.45 + Math.sin(p * 2 + 2.1) * 0.3, 0.55 - Math.sin(p + 1) * 0.4, 0.05, 0, -Math.sin(p * 2) * 0.6);
    const st = 0.75 + Math.min(0.25, sp * 0.02);
    P.lL = leg(sw * st, 0.2 + Math.max(0, cw) * 1.3, 0.05, -0.2);
    P.lR = leg(-sw * st, 0.2 + Math.max(0, -cw) * 1.3, 0.05, -0.2);
  } else if (mode === 'roar') {
    const sh = Math.sin(t * 47), sh2 = Math.sin(t * 39 + 1);
    P.lean = -0.14; P.shakeZ = sh * 0.025; P.shakeY = sh2 * 0.03; P.breath = 1;
    P.neck = 0.35; P.headX = -0.32 + sh2 * 0.03; P.headY = sh * 0.09; P.headZ = sh2 * 0.06;
    P.gape = 1; P.upper = 1; P.brow = 1.35; P.browY = -0.015; P.blink = false;
    P.aL = arm(2.15 + sh * 0.06, 0.95, 0.75, 0, 0.3, 0.3); P.aR = arm(2.15 - sh * 0.06, 0.95, 0.75, 0, 0.3, 0.3);
    P.lL = leg(0.05, 0.3, 0.22); P.lR = leg(-0.05, 0.3, 0.22);
  } else if (mode === 'grab') {
    const r = k < MONSTER_GRAB_PICK ? sm(k / MONSTER_GRAB_PICK) : 1 - seg(k, MONSTER_GRAB_PICK, 1);   // reach down, then scoop up
    const hold = seg(k, 0.44, 0.58), lift = seg(k, 0.55, 1);
    P.lean = mix(0.1, 1.2, r); P.neck = mix(0.12, 0.45, r); P.headX = mix(0, 0.55, r) - lift * 0.15;
    P.gape = 0.08 + r * 0.25 + lift * 0.3; P.brow = 1.2;
    P.aR = arm(mix(0.2, 1.45, r) + lift * 0.6, mix(0.15, -0.08, r), mix(0.3, 0.15, r) + lift * 1.45, 0.05 + hold * 0.8, 0, mix(0, -1.0, r) * (1 - lift));
    P.aL = arm(mix(0.1, 0.6, r), mix(0.2, 0.75, r), 0.6, 0.3);
    P.lL = leg(mix(0, 0.3, r), mix(0.1, 1.05, r), 0.12); P.lR = leg(mix(0, -0.1, r), mix(0.1, 0.8, r), 0.12);
  } else if (mode === 'eat') {
    const up = seg(k, 0, 0.32), drop = seg(k, 0.32, MONSTER_EAT_SWALLOW + 0.04), shut = seg(k, 0.46, 0.56), down = seg(k, 0.5, 0.75), pat = seg(k, 0.6, 0.75) * (1 - seg(k, 0.92, 1));
    P.lean = 0.1 - up * 0.2 + down * 0.15;
    P.neck = mix(0.12, -0.2, up) + down * 0.3; P.headX = mix(0, -1.0, up) * (1 - down) + Math.sin(k * 40) * 0.06 * shut * (1 - down);
    P.gape = mix(0.05, 1, up) * (1 - shut) + 0.05; P.upper = up * (1 - shut) * 0.6;
    P.gulp = shut > 0 ? seg(k, 0.5, 0.9) : -1; P.brow = mix(1, 0.4, down); P.browY = down * 0.02;
    P.blink = k < 0.6;
    P.aR = arm(mix(0.3, 2.45, up) - drop * 0.15 - down * 1.7, mix(0.1, -0.45, up) * (1 - down) + 0.15 * down, mix(1.2, 0.5, up) * (1 - down) + 0.4 * down, mix(0.8, 0.15, drop), 0, 0.3 * up);
    P.aL = arm(0.2 + pat * 0.7, 0.25 - pat * 0.25, 0.4 + pat * 1.1 + Math.sin(k * 60) * 0.25 * pat, 0.1);
    P.lL = leg(0.03, 0.1, 0.08); P.lR = leg(-0.03, 0.1, 0.08);
    if (k > 0.75) { const w = (k - 0.75) * 4; P.hop = Math.abs(Math.sin(w * Math.PI * 2)) * 0.05; P.headY = Math.sin(w * Math.PI * 2) * 0.12; }
  } else if (mode === 'dance') {
    const p = t * Math.PI * 2 * 1.1, s1 = Math.sin(p), beat = Math.abs(Math.sin(p));
    P.hop = beat * 0.22; P.lean = 0.02; P.sway = s1 * 0.16; P.twist = Math.sin(p * 0.5) * 0.35;
    P.neck = 0.1; P.headZ = s1 * 0.3; P.headX = -0.12 + Math.cos(p * 2) * 0.12; P.headY = Math.sin(p * 0.5) * 0.3;
    P.gape = 0.35 + 0.35 * Math.abs(Math.sin(p * 2)); P.brow = 0.25; P.browY = 0.035;
    const pump = Math.sin(p * 2);
    P.aL = arm(2.4 + pump * 0.35, 0.5 + s1 * 0.25, 1.2 - pump * 0.4, 0.8, 0, s1 * 0.5);
    P.aR = arm(2.4 - pump * 0.35, 0.5 - s1 * 0.25, 1.2 + pump * 0.4, 0.8, 0, -s1 * 0.5);
    P.lL = leg(Math.max(0, s1) * 0.8, 0.1 + Math.max(0, s1) * 1.5, 0.12, 0.2);
    P.lR = leg(Math.max(0, -s1) * 0.8, 0.1 + Math.max(0, -s1) * 1.5, 0.12, 0.2);
  } else if (mode === 'throw') {
    const wind = seg(k, 0, 0.42), whip = seg(k, 0.42, MONSTER_THROW_RELEASE + 0.06), fol = seg(k, MONSTER_THROW_RELEASE, 0.85), rec = seg(k, 0.85, 1);
    P.lean = 0.08 - wind * 0.28 + whip * 0.55 - rec * 0.2;
    P.twist = -wind * 0.45 + whip * 0.75 - rec * 0.2;
    P.neck = 0.12 + whip * 0.2; P.headX = -wind * 0.2 + whip * 0.25; P.headY = wind * 0.3 - whip * 0.4;
    P.gape = 0.1 + whip * (1 - fol) * 0.9 + fol * 0.3; P.brow = 1.3;
    P.aR = arm(mix(0.2, 3.45, wind) - whip * 1.9 - fol * 0.9 + rec * 0.3, mix(0.15, 0.35, wind) - whip * 0.3, mix(0.5, 1.5, wind) * (1 - whip) + 0.15, (1 - seg(k, MONSTER_THROW_RELEASE - 0.02, MONSTER_THROW_RELEASE + 0.02)) * 0.85, 0, wind * 0.5 - whip * 0.9);
    P.aL = arm(mix(0.1, 1.5, wind) - whip * 1.1, 0.3 + whip * 0.4, 0.3, 0.1);
    P.lL = leg(mix(0, 0.5, wind), 0.15 + wind * 0.25, 0.1); P.lR = leg(mix(0, -0.3, wind) - whip * 0.2, 0.2 + whip * 0.3, 0.08);
  }

  // ---- apply
  u.rig.rotation.set(0, P.shakeY, P.shakeZ);
  u.body.rotation.set(P.lean, P.twist, P.sway);
  u.body.scale.set(1 + P.breath * 0.015, 1 + P.breath * 0.02, 1 + P.breath * 0.025);
  u.neck.rotation.set(P.neck, 0, 0);
  u.head.rotation.set(P.headX, P.headY, P.headZ, 'YXZ');
  u.beakBottom.rotation.x = P.gape * 0.85;
  u.beakTop.rotation.x = -P.gape * 0.12 - P.upper * 0.22;
  u.brow.scale.set(1, P.brow, 1); u.brow.position.y = P.browY;
  const bl = P.blink && ((t * 0.29) % 1) < 0.04 ? 0.12 : 1;
  u.eyeL.scale.y = u.eyeR.scale.y = bl;
  u.gulp.visible = P.gulp >= 0;
  if (P.gulp >= 0) { u.gulp.position.set(0, mix(0.5, 0.02, P.gulp), 0.27 - P.gulp * 0.03); u.gulp.scale.setScalar(1 - P.gulp * 0.4); }
  for (const [a, A, s] of [[u.armL, P.aL, 1], [u.armR, P.aR, -1]]) {
    a.rotation.set(-A.fwd, s * A.twist, s * A.out);
    a.userData.elbow.rotation.set(-A.bend, 0, 0);
    const h = a.userData.hand;
    h.parent.rotation.set(A.wrist * 0.5, 0, s * A.wrist * 0.3);
    for (const f of h.userData.fingers) f.rotation.set(0, 0, -s * A.curl * 1.5);
    h.userData.thumb.rotation.set(0.6 + A.curl * 0.6, 0, s * A.curl * 0.5);
  }
  let reach = 0;
  for (const [l, L, s] of [[u.legL, P.lL, 1], [u.legR, P.lR, -1]]) {
    l.rotation.set(-L.fwd, 0, s * L.out);
    l.userData.knee.rotation.set(L.knee, 0, 0);
    l.userData.foot.rotation.set(L.fwd - L.knee + L.toe, 0, -s * L.out);   // keep the sole flat unless told otherwise
    reach = Math.max(reach, (MON.T * Math.cos(L.fwd) + MON.S * Math.cos(L.fwd - L.knee)) * Math.cos(L.out));
  }
  u.rig.position.y = reach - (MON.T + MON.S) + P.hop;    // the lowest foot stays on the ground
}

// ================================================================ boss crown
// crown: parent it to a goose's neckPivot (it sits on the head out of the box);
// aura: parent it to the goose root (a flat ring at its feet). Both are in
// goose units, so they inherit the boss's 1.15 * 1.8 root scale.
export function buildBossCrown() {
  const crown = new THREE.Group(); crown.name = 'BossCrown';
  const gb = new Builder();
  gb.add(new THREE.CylinderGeometry(0.068, 0.062, 0.04, 18, 1, true), M(0, 0.02, 0), 0xffffff);
  gb.add(new THREE.TorusGeometry(0.066, 0.007, 5, 20), M(0, 0.0, 0, Math.PI / 2), 0xffffff);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const c = new THREE.ConeGeometry(0.021, 0.06, 4); c.translate(0, 0.03, 0);
    gb.add(c, M(Math.sin(a) * 0.066, 0.038, Math.cos(a) * 0.066, 0, a, 0), 0xffffff);
    gb.add(sph(0.01, 6, 5), M(Math.sin(a) * 0.066, 0.1, Math.cos(a) * 0.066), 0xffffff);
  }
  const band = new THREE.Mesh(gb.build(), new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xffc928, metalness: 0.85, roughness: 0.28, emissive: 0x6a4200, side: THREE.DoubleSide }));
  const jb = new Builder();
  jb.add(new THREE.SphereGeometry(0.06, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(0, 0.008, 0, 0, 0, 0, 1, 0.75, 1), 0xb0122e);   // velvet cap
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + Math.PI / 5; jb.add(sph(0.012, 8, 6), M(Math.sin(a) * 0.069, 0.02, Math.cos(a) * 0.069), i % 2 ? 0x2f7bff : 0xff2b4a); }
  jb.add(sph(0.016, 8, 6), M(0, 0.02, 0.071), 0x2ee88a);
  const jewels = new THREE.Mesh(jb.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, emissive: 0x2a0810 }));
  band.castShadow = jewels.castShadow = true;
  crown.add(band, jewels);
  crown.position.set(0, 0.655, 0.035); crown.rotation.set(-0.12, 0, 0.2);

  const tex = canvasTex('aura', 256, 256, (x, w) => {
    const h = w / 2, gr = x.createRadialGradient(h, h, 0, h, h, h);
    gr.addColorStop(0, 'rgba(255,220,120,0)'); gr.addColorStop(0.56, 'rgba(255,220,120,0)');
    gr.addColorStop(0.68, 'rgba(255,236,160,1)'); gr.addColorStop(0.8, 'rgba(255,190,70,0.55)'); gr.addColorStop(1, 'rgba(255,150,40,0)');
    x.fillStyle = gr; x.fillRect(0, 0, w, w);
    x.strokeStyle = 'rgba(255,255,220,0.9)'; x.lineWidth = 5; x.lineCap = 'round';
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; x.beginPath(); x.moveTo(h + Math.cos(a) * h * 0.74, h + Math.sin(a) * h * 0.74); x.lineTo(h + Math.cos(a) * h * 0.9, h + Math.sin(a) * h * 0.9); x.stroke(); }
  });
  const aura = new THREE.Mesh(new THREE.RingGeometry(0.48, 0.85, 64, 1),
    new THREE.MeshBasicMaterial({ map: tex, color: 0xffd060, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  // RingGeometry UVs are planar over the outer radius, so the gradient's 0.56 stop is the inner edge
  aura.rotation.x = -Math.PI / 2; aura.position.y = 0.025; aura.renderOrder = 2; aura.name = 'BossAura';
  return { crown, aura };
}

// optional: a slow spin and pulse on the aura, a bob on the crown
export function animateBossCrown({ crown, aura }, t) {
  if (aura) { aura.rotation.z = t * 0.6; aura.material.opacity = 0.6 + 0.25 * Math.sin(t * 3); aura.scale.setScalar(1 + 0.04 * Math.sin(t * 3)); }
  if (crown) crown.rotation.z = 0.2 + Math.sin(t * 2.2) * 0.05;
}
