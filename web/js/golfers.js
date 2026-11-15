// Golfers: the five selectable player characters. Procedural low-poly like the
// rest of the scene (primitives only, no asset files), solid and opaque.
//
// Space: origin at the feet, facing +Z. In 'swing' mode the rig turns side-on
// (like Old Tom) so the shot flies toward group +Z and the ball sits at
// g.userData.swingBall: stand them at a ball with golferAddress(). Every
// character shares one rig (two-bone IK arms, hinged legs) and one animator;
// only proportions, costume and a few personality numbers differ.
//
// The look is a toy figure: big heads, big eyes with a glint, chunky hands.
// Clothes detail (stripes, checks, cuffs, socks, soles) is baked into
// per-triangle vertex colours, so it costs no extra meshes, and every material
// carries a soft self-glow plus a fresnel rim taken from its own colour (see
// toy()), so the figures pop off the grass at sunset and stay readable at night.

import * as THREE from 'three';

export const GOLFERS = [
  { id: 'pro', name: 'The Pro', blurb: 'Never misses. Allegedly.' },
  { id: 'birdie', name: 'Grandma Birdie', blurb: 'Eighty-four. Plays off four.' },
  { id: 'kid', name: 'Caddie Kid', blurb: 'Small kid. Enormous bag.' },
  { id: 'bogey', name: 'Sir Bogey', blurb: 'Par is for peasants.' },
  { id: 'mascot', name: 'The Mascot', blurb: 'Big ball. Bigger dreams.' },
];

const BALL_R = 0.07;                       // matches physics.js R
export const GOLFER_IMPACT = 0.55;         // swing k at which the club meets the ball

// Proportions and personality. hipY: hip joint height; sY/sX: shoulder joint
// above the hip / out from the spine; UA/FA: upper arm / forearm; tilt: spine
// tilt at address; club: grip top -> clubhead; hunch: resting spine lean.
// idle / cheer / sulk pick each character's own little performance.
const SPECS = {
  pro: {
    hipY: 0.88, sY: 0.46, sX: 0.205, legGap: 0.095, UA: 0.29, FA: 0.28, neck: 0.06, headS: 1.56,
    tilt: 0.45, club: 0.95, hunch: -0.05, stance: 0.075, jump: 0.2, idle: 'lean',
    cheer: { style: 'pump', P: 0.82, tuck: 0.5 }, sulk: 'palm',
    run: { lean: 0.3, stride: 1, cad: 1, bounce: 0.08, arm: 1.1, sway: 0, knee: 1 },
  },
  birdie: {
    hipY: 0.6, sY: 0.36, sX: 0.15, legGap: 0.065, UA: 0.235, FA: 0.225, neck: 0.04, headS: 1.5,
    tilt: 0.42, club: 0.8, hunch: 0.4, stance: 0.03, jump: 0.1, idle: 'cane',
    cheer: { style: 'hop', P: 0.62, tuck: 0.3 }, sulk: 'tut',
    run: { lean: 0.12, stride: 0.62, cad: 1.5, bounce: 0.03, arm: 0.65, sway: 0.05, knee: 0.8, tuck: 0.12, wiggle: 0.2 },
  },
  kid: {
    hipY: 0.54, sY: 0.3, sX: 0.15, legGap: 0.072, UA: 0.205, FA: 0.195, neck: 0.04, headS: 1.72,
    tilt: 0.36, club: 0.66, hunch: 0, stance: 0.05, jump: 0.3, idle: 'shoulder',
    cheer: { style: 'star', P: 0.7, tuck: 0.3 }, sulk: 'stomp',
    run: { lean: 0.24, stride: 1.12, cad: 1.28, bounce: 0.12, arm: 1.3, sway: 0, knee: 1.15, flail: 0.1 },
  },
  bogey: {
    hipY: 1.02, sY: 0.54, sX: 0.17, legGap: 0.08, UA: 0.34, FA: 0.33, neck: 0.1, headS: 1.52,
    tilt: 0.55, club: 1.02, hunch: -0.06, stance: 0.04, jump: 0.16, idle: 'posh',
    cheer: { style: 'click', P: 0.95, tuck: 0.2 }, sulk: 'huff',
    run: { lean: -0.12, stride: 1.2, cad: 0.82, bounce: 0.08, arm: 0.75, sway: 0, knee: 1.6, chin: -0.18 },
  },
  mascot: {
    hipY: 0.8, sY: 0.41, sX: 0.2, legGap: 0.1, UA: 0.28, FA: 0.27, neck: 0.01, headS: 1.1,
    tilt: 0.4, club: 0.9, hunch: 0, stance: 0.09, jump: 0.32, idle: 'wave',
    cheer: { style: 'spin', P: 0.78, tuck: 0.4 }, sulk: 'droop',
    run: { lean: 0.16, stride: 0.85, cad: 1.12, bounce: 0.1, arm: 1.4, sway: 0.16, knee: 1, out: 0.1 },
  },
};
const FOOT_H = 0.06;
const BAG_Z = -0.5;           // the kid's bag rides diagonally, top over the left shoulder
for (const S of Object.values(SPECS)) { S.TL = S.SL = (S.hipY - FOOT_H) / 2; }

// ---------------------------------------------------------------- toy finish
// A soft self-glow and a fresnel rim, both from the surface's own colour
// (after vertex colours and maps), so painted stripes rim too. One closure
// source for every material, so they all share a program per variant.
const RIM = 0.5;
function toy(m, glow, rim) {
  const u = { uGlow: { value: glow }, uRim: { value: rim } };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uGlow;\nuniform float uRim;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { float fr = 1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0);
          totalEmissiveRadiance += diffuseColor.rgb * uGlow + mix(diffuseColor.rgb, vec3(1.0), 0.45) * (uRim * fr * fr * fr); }`);
  };
  m.userData.toy = u;
  return m;
}
function mat(color, { rough = 0.75, metal = 0, glow = 0.12, rim = RIM, flat = false, side, map, vc = false } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, flatShading: flat, map: map || null, vertexColors: vc });
  if (side) m.side = side;
  return toy(m, glow, rim);
}

// ---------------------------------------------------------------- geometry helpers
const V2 = pts => pts.map(p => new THREE.Vector2(p[0], p[1]));
const sph = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);
const cap = (r, len, rs = 8) => new THREE.CapsuleGeometry(r, len, 2, rs);
function mesh(geo, m, parent, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, m); o.position.set(x, y, z);
  if (parent) parent.add(o);
  return o;
}
const shade = (hex, k) => new THREE.Color(hex).multiplyScalar(k).getHex();

// Flat per-triangle colours picked from the triangle's centroid (and normal):
// stripes, checks, cuffs and soles without a single extra mesh.
const _c = new THREE.Color(), _ta = new THREE.Vector3(), _tb = new THREE.Vector3(), _tc = new THREE.Vector3(), _tn = new THREE.Vector3();
function paint(geo, fn) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i += 3) {
    _ta.fromBufferAttribute(p, i); _tb.fromBufferAttribute(p, i + 1); _tc.fromBufferAttribute(p, i + 2);
    const cx = (_ta.x + _tb.x + _tc.x) / 3, cy = (_ta.y + _tb.y + _tc.y) / 3, cz = (_ta.z + _tb.z + _tc.z) / 3;
    _tb.sub(_ta); _tc.sub(_ta); _tn.crossVectors(_tb, _tc).normalize();
    _c.set(fn(cx, cy, cz, _tn));
    for (let k = 0; k < 3; k++) { col[(i + k) * 3] = _c.r; col[(i + k) * 3 + 1] = _c.g; col[(i + k) * 3 + 2] = _c.b; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const solid = (geo, hex) => paint(geo, () => hex);
// Concatenate painted geometries into one (one mesh, one draw call).
function merge(list) {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, o); nor.set(g.attributes.normal.array, o); col.set(g.attributes.color.array, o);
    o += g.attributes.position.count * 3; g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}
// A capsule (Y axis, centred) with extra rings at fractions of its straight
// part, painted by fn(f, x, z) where f runs 0 (bottom) .. 1 (top) along it.
function capsule(r, len, rs, cuts, fn) {
  const pts = [], h = len / 2;
  for (let i = 0; i <= 2; i++) { const a = -Math.PI / 2 + i * Math.PI / 4; pts.push(new THREE.Vector2(Math.max(1e-4, Math.cos(a) * r), -h + Math.sin(a) * r)); }
  for (const f of cuts) pts.push(new THREE.Vector2(r, -h + f * len));
  for (let i = 0; i <= 2; i++) { const a = i * Math.PI / 4; pts.push(new THREE.Vector2(Math.max(1e-4, Math.cos(a) * r), h + Math.sin(a) * r)); }
  return paint(new THREE.LatheGeometry(pts, rs), (x, y, z) => fn((y + h) / len, x, z));
}
// A lathe body with extra rows at the given heights, painted by fn(x, y, z, angle).
function lathe(profile, ys, fn, segs = 12) {
  const pts = profile.slice();
  for (const y of ys) {
    const i = pts.findIndex((p, j) => j < pts.length - 1 && p[1] <= y && pts[j + 1][1] > y);
    if (i < 0) continue;
    const a = pts[i], b = pts[i + 1], u = (y - a[1]) / (b[1] - a[1]);
    pts.splice(i + 1, 0, [a[0] + (b[0] - a[0]) * u, y]);
  }
  return paint(new THREE.LatheGeometry(V2(pts), segs), (x, y, z) => fn(x, y, z, Math.atan2(x, z)));
}
// radius of a lathe profile at height y (to sit buttons on a chest)
function profR(profile, y) {
  for (let i = 0; i < profile.length - 1; i++) {
    const a = profile[i], b = profile[i + 1];
    if (a[1] <= y && b[1] >= y) return a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]);
  }
  return 0;
}
// An ellipsoid shoe: sole, upper, and optional toe cap / heel / saddle / stripe colours.
function shoe(r, sx, sy, sz, c) {
  const g = new THREE.SphereGeometry(r, 10, 8); g.scale(sx, sy, sz);
  const hy = r * sy, hz = r * sz;
  return paint(g, (x, y, z) => y < -0.7 * hy ? c.sole
    : c.toe != null && z > 0.5 * hz ? c.toe
    : c.heel != null && z < -0.55 * hz ? c.heel
    : c.mid != null && Math.abs(z) < 0.3 * hz ? c.mid
    : c.band != null && y < 0.15 * hy && y > -0.7 * hy && Math.abs(z) < 0.5 * hz ? c.band
    : c.upper);
}
// checks for tweed: alternate two tones by row band and lathe column
const check = (y, ang, a, b, step = 0.05) => ((Math.floor(y / step) + Math.floor((ang + Math.PI) / (Math.PI / 6) + 1e-3)) & 1) ? a : b;

// argyle socks for Sir Bogey: one tiny shared canvas texture
let _argyle = null;
function argyle() {
  if (_argyle) return _argyle;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#2f7a52'; x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#e8c547';
  x.beginPath(); x.moveTo(32, 0); x.lineTo(64, 32); x.lineTo(32, 64); x.lineTo(0, 32); x.closePath(); x.fill();
  x.strokeStyle = '#b8323c'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(0, 0); x.lineTo(64, 64); x.moveTo(64, 0); x.lineTo(0, 64); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2);
  return (_argyle = t);
}

// ---------------------------------------------------------------- shared rig
function buildRig(S, M, look) {
  const g = new THREE.Group();
  const rig = new THREE.Group(); g.add(rig);

  // legs: hip -> thigh -> knee -> shin -> ankle -> shoe
  const legs = {};
  for (const [s, key] of [[1, 'L'], [-1, 'R']]) {
    const hip = new THREE.Group(); hip.position.set(s * S.legGap, S.hipY, 0); rig.add(hip);
    const thigh = mesh(look.thighGeo, M.thigh, hip, 0, -S.TL / 2, 0);
    const knee = new THREE.Group(); knee.position.y = -S.TL; hip.add(knee);
    const shin = mesh((s > 0 && look.shinGeoL) || look.shinGeo, M.shin, knee, 0, -S.SL / 2, 0);
    const ankle = new THREE.Group(); ankle.position.y = -S.SL; knee.add(ankle);
    const shoe = mesh(look.shoeGeo, M.shoe, ankle, 0, -FOOT_H / 2, look.shoeZ ?? 0.045);
    legs[key] = { hip, knee, ankle, thigh, shin, shoe };
  }

  // torso pivots at the hips
  const torso = new THREE.Group(); torso.position.y = S.hipY; rig.add(torso);
  const chest = mesh(look.torsoGeo, M.shirt, torso);
  chest.scale.z = look.torsoZ ?? 0.78;
  // hips (pants / skirt) follow the torso only partly, so a hunch doesn't tip the skirt
  const hips = new THREE.Group(); hips.position.y = S.hipY; rig.add(hips);
  const pelvis = look.pelvisGeo ? mesh(look.pelvisGeo, M.pelvis ?? M.thigh, hips, 0, look.pelvisY ?? 0, 0) : null;
  if (pelvis && look.pelvisScale) pelvis.scale.set(...look.pelvisScale);
  const neck = S.neck > 0.02 ? mesh(new THREE.CylinderGeometry(0.05, 0.055, S.neck + 0.06, 8), M.skin, torso, 0, S.sY + S.neck / 2, 0) : null;

  // arms: two capsules each, solved to the hands every frame; chunky mitts
  const upGeo = look.upGeo ?? cap(look.armR ?? 0.045, S.UA), foGeo = look.foGeo ?? cap(look.foR ?? 0.038, S.FA);
  const handGeo = sph(look.handR ?? 0.05, 8, 6);
  const mkArm = (s, handMat) => {
    const up = mesh(upGeo, M.sleeve, torso);
    const fo = mesh(foGeo, M.forearm ?? M.sleeve, torso);
    const hand = mesh(handGeo, handMat, torso);
    return { up, fo, hand, UA: S.UA, FA: S.FA, shoulder: new THREE.Vector3(s * S.sX, S.sY, 0) };
  };
  const armL = mkArm(1, M.handL ?? M.hand), armR = mkArm(-1, M.hand);

  // head: pivot at the top of the neck
  const head = new THREE.Group(); head.position.set(0, S.sY + S.neck, 0.01); head.scale.setScalar(S.headS); torso.add(head);

  // the club: pivot = top of the grip, shaft along -Y, iron head at -club
  const club = new THREE.Group(); rig.add(club);
  mesh(new THREE.CylinderGeometry(0.017, 0.015, 0.24, 8), M.grip, club, 0, -0.12, 0);
  mesh(new THREE.CylinderGeometry(0.0105, 0.011, S.club - 0.24, 6), M.steel, club, 0, -0.24 - (S.club - 0.24) / 2, 0);
  const clubHead = mesh(new THREE.BoxGeometry(0.1, 0.05, 0.028), M.steel, club, -0.036, -S.club, 0);

  return { g, rig, torso, hips, chest, pelvis, neck, head, armL, armR, club, clubHead, legL: legs.L, legR: legs.R };
}

// Swing geometry: shoulders at address, the ball in rig space, the hands' arc.
function swingGeom(S) {
  const Sc = new THREE.Vector3(0, S.hipY + S.sY * Math.cos(S.tilt), S.sY * Math.sin(S.tilt));
  const HR = 0.77 * (S.UA + S.FA);
  const L = S.club + HR, dy = Sc.y - BALL_R;
  const z = Sc.z + Math.sqrt(Math.max(0.04, L * L - dy * dy));
  const ballRig = new THREE.Vector3(0, BALL_R, z);
  const D = new THREE.Vector3().subVectors(ballRig, Sc);
  const hr = D.length() - S.club;
  D.normalize();
  return { Sc, D, HR: hr, B: new THREE.Vector3(-1, 0, 0), ball: new THREE.Vector3(-z, BALL_R, 0) };
}

// ---------------------------------------------------------------- faces
const C_WHITE = 0xfdfaf2, C_PUPIL = 0x1c1412, C_MOUTH = 0x4a1820, C_TEETH = 0xfbf7ee, C_TONGUE = 0xe0606e;
const _fq = new THREE.Quaternion(), _fz = new THREE.Vector3(0, 0, 1);

// The D-shaped mouth: a half-disc with horizontal rows (teeth along the flat
// edge, tongue in the bowl), curved onto a sphere of radius R. Its origin is the
// middle of the flat edge; rotation.z = PI is a smile, 0 a frown.
function mouthGeo(r, R, gap) {
  const g = new THREE.PlaneGeometry(2, 1, 8, 4), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i), v = p.getY(i) + 0.5, x = u * r * Math.sqrt(Math.max(0, 1 - v * v)), y = v * r;
    p.setXYZ(i, x, y, Math.sqrt(Math.max(0, R * R - x * x - y * y)) - R);
  }
  g.computeVertexNormals();
  return paint(g, (x, y) => y < r * 0.25 ? (gap && Math.abs(x) < r * 0.12 ? C_MOUTH : C_TEETH) : y > r * 0.5 && Math.abs(x) < r * 0.45 ? C_TONGUE : C_MOUTH);
}

// A head-space point on the skull ellipsoid and its outward normal.
function skullPt(o, x, y) {
  const a = 0.115 * o.skullS[0], b = 0.115 * o.skullS[1], c = 0.115 * o.skullS[2], dy = y - o.skullY;
  const z = c * Math.sqrt(Math.max(0.02, 1 - (x / a) ** 2 - (dy / b) ** 2));
  return { p: new THREE.Vector3(x, y, z), n: new THREE.Vector3(x / (a * a), dy / (b * b), z / (c * c)).normalize() };
}

// Skull, nose, ears, toy eyes (whites + pupils-with-glints, one merged mesh
// each, in a group that blinks), two brows, the D-mouth, optional blush.
function buildFace(head, M, opt = {}) {
  const o = {
    skullY: 0.12, skullS: [0.95, 1.05, 1], eyeY: 0.142, eyeX: 0.044, eyeR: 0.026, pupR: 0.015, mouthY: 0.07, mouthR: 0.042,
    browY: null, browLen: 0.034, browTilt: 0.08, eyes: true, nose: true, ears: true, cheeks: null, freckles: false, gap: false, ...opt,
  };
  const F = { unit: 1, look: o.eyeR * 0.3, browBase: [] };
  F.skull = mesh(sph(0.115, 14, 10), M.skin, head, 0, o.skullY, 0); F.skull.scale.set(...o.skullS);
  if (o.nose) { F.nose = mesh(sph(0.026, 8, 6), M.skin, head, 0, o.skullY - 0.005, 0.115 * o.skullS[2]); F.nose.scale.set(0.9, 1, 1.1); }
  if (o.ears) {
    const earGeo = sph(0.03, 8, 6), ex = 0.108 * o.skullS[0] / 0.95;
    F.earL = mesh(earGeo, M.skin, head, ex, o.skullY, -0.005); F.earL.scale.set(0.45, 1, 0.8);
    F.earR = mesh(earGeo, M.skin, head, -ex, o.skullY, -0.005); F.earR.scale.set(0.45, 1, 0.8);
  }
  if (o.eyes) {
    const eyes = new THREE.Group(); eyes.position.y = o.eyeY; head.add(eyes);
    const whites = [], pupils = [];
    for (const s of [1, -1]) {
      const { p, n } = skullPt(o, s * o.eyeX, o.eyeY);
      _fq.setFromUnitVectors(_fz, n);
      const w = sph(o.eyeR, 10, 6); w.scale(1, 1.12, 0.5); w.applyQuaternion(_fq);
      w.translate(p.x - n.x * o.eyeR * 0.05, -n.y * o.eyeR * 0.05, p.z - n.z * o.eyeR * 0.05);
      whites.push(solid(w, C_WHITE));
      const c = p.clone().addScaledVector(n, o.eyeR * 0.42); c.y -= o.eyeY;
      const pu = sph(o.pupR, 8, 5); pu.scale(1, 1.1, 0.5); pu.applyQuaternion(_fq); pu.translate(c.x, c.y, c.z);
      pupils.push(solid(pu, C_PUPIL));
      const gl = sph(o.pupR * 0.34, 5, 3); gl.translate(c.x + o.pupR * 0.38, c.y + o.pupR * 0.42, c.z + o.pupR * 0.42);
      pupils.push(solid(gl, 0xffffff));
    }
    F.eyes = eyes;
    F.whites = mesh(merge(whites), M.eyeW, eyes);
    F.pupils = mesh(merge(pupils), M.pupil, eyes);
  }
  // brows
  const by = o.browY ?? o.eyeY + o.eyeR * 1.15 + 0.014, browGeo = cap(0.0085, o.browLen, 6);
  for (const s of [1, -1]) {
    const { p, n } = skullPt(o, s * o.eyeX, by);
    const b = mesh(browGeo, M.brow, head, p.x + n.x * 0.006, p.y + n.y * 0.006, p.z + n.z * 0.006);
    b.rotation.set(-0.25, 0, Math.PI / 2 + s * o.browTilt);
    F[s > 0 ? 'browL' : 'browR'] = b;
  }
  // mouth
  {
    const { p, n } = skullPt(o, 0, o.mouthY);
    F.mouth = mesh(mouthGeo(o.mouthR, 0.115 * o.skullS[2], o.gap), M.mouth, head, p.x + n.x * 0.002, p.y + n.y * 0.002, p.z + n.z * 0.002);
    F.mouth.rotation.set(Math.atan2(-n.y, n.z), 0, Math.PI);
    F.mouthY = F.mouth.position.y;
  }
  // rosy cheeks (and freckles)
  if (o.cheeks != null) {
    const parts = [];
    for (const s of [1, -1]) {
      const { p, n } = skullPt(o, s * 0.07, o.mouthY + 0.03);
      _fq.setFromUnitVectors(_fz, n);
      const c = sph(0.021, 7, 5); c.scale(1, 0.72, 0.3); c.applyQuaternion(_fq); c.translate(p.x, p.y, p.z);
      parts.push(solid(c, o.cheeks));
      if (o.freckles) for (const [dx, dy] of [[-0.012, 0.012], [0.004, 0.016], [0.014, 0.008]]) {
        const q = skullPt(o, s * 0.07 + dx, o.mouthY + 0.03 + dy);
        const f = sph(0.0042, 4, 3); f.translate(q.p.x + q.n.x * 0.004, q.p.y + q.n.y * 0.004, q.p.z + q.n.z * 0.004);
        parts.push(solid(f, 0x9a4a28));
      }
    }
    F.cheeks = mesh(merge(parts), M.paint, head);
  }
  return F;
}
function faceMats(M, brow) {
  M.eyeW = mat(C_WHITE, { glow: 0.3, rim: 0.2, rough: 0.4 });
  M.pupil = mat(0xffffff, { vc: true, glow: 0.12, rim: 0, rough: 0.3 });
  M.mouth = mat(0xffffff, { vc: true, glow: 0.05, rim: 0 });
  M.brow = mat(brow, { glow: 0.04 });
}
function storeBrows(F) {
  F.browBase = [F.browL, F.browR].map(b => ({ y: b.position.y, rz: b.rotation.z }));
}

// ---------------------------------------------------------------- characters
const BUILDERS = {
  // The Pro: visor, tour polo with a chest stripe, slacks, saddle shoes, shades,
  // a glove. Tint: the polo.
  pro(S, tint) {
    const shirt = tint ?? 0x2f86d6, white = 0xf8f8f4;
    const M = {
      skin: mat(0x9a6440), hand: mat(0x9a6440), handL: mat(0xf6f3ea), paint: mat(0xffffff, { vc: true, glow: 0.13 }),
      thigh: mat(0x37415e), shin: mat(0x37415e), white: mat(white, { side: THREE.DoubleSide }), brim: mat(0xffffff, { vc: true, side: THREE.DoubleSide }),
      hair: mat(0x24170f), shades: mat(0xffffff, { vc: true, rough: 0.2, metal: 0.6, glow: 0.05 }),
      belt: mat(0x1e1e22), gold: mat(0xe0b74a, { rough: 0.3, metal: 0.7, glow: 0.2 }),
      grip: mat(0x1d1d22, { rough: 0.9 }), steel: mat(0xc8ccd2, { rough: 0.3, metal: 0.8, glow: 0.05 }),
    };
    faceMats(M, 0x24170f);
    M.shirt = M.sleeve = M.shoe = M.paint; M.forearm = M.skin;
    const prof = [[0.001, -0.08], [0.15, -0.07], [0.158, 0.05], [0.172, 0.2], [0.205, 0.36], [0.2, 0.45], [0.15, 0.52], [0.06, 0.55], [0.001, 0.555]];
    const look = {
      torsoGeo: lathe(prof, [0.27, 0.315, 0.335], (x, y) => y > 0.27 && y < 0.315 ? white : y > 0.315 && y < 0.335 ? 0x1e2a4a : shirt),
      torsoZ: 0.72, handR: 0.056,
      upGeo: capsule(0.056, S.UA, 8, [0.72], f => f > 0.72 ? white : shirt), foGeo: cap(0.045, S.FA),
      thighGeo: cap(0.082, S.TL - 0.04), shinGeo: cap(0.068, S.SL - 0.06),
      shoeGeo: shoe(0.062, 0.95, 0.58, 1.75, { upper: white, sole: 0x2a2a30, mid: 0x1e1e24 }),
      pelvisGeo: sph(0.17, 12, 8), pelvisScale: [1, 0.55, 0.82], pelvisY: -0.02,
    };
    const R = buildRig(S, M, look);
    const H = buildFace(R.head, M, { eyes: false, browY: 0.176, browLen: 0.04, browTilt: 0.05 });
    // a crop of hair, then the visor over it: open band + forward brim (green underside)
    const hair = mesh(sph(0.12, 12, 8), M.hair, R.head, 0, 0.15, -0.012); hair.scale.set(1, 0.72, 1.02);
    const visor = new THREE.Group(); visor.position.set(0, 0.205, 0.004); visor.rotation.x = 0.1; R.head.add(visor);
    mesh(new THREE.CylinderGeometry(0.112, 0.118, 0.036, 16, 1, true), M.white, visor);
    const brimGeo = paint(new THREE.CylinderGeometry(0.13, 0.13, 0.01, 14, 1, false, -Math.PI / 2, Math.PI), (x, y, z, n) => n.y < -0.5 ? 0x2f6b3a : white);
    const brim = mesh(brimGeo, M.brim, visor, 0, -0.012, 0.085);
    brim.scale.z = 0.95; brim.rotation.x = 0.2;
    // wraparound shades with a glint
    const shadesGeo = paint(new THREE.BoxGeometry(0.155, 0.038, 0.025, 12, 1, 1), (x, y, z, n) => n.z > 0.5 && ((x > 0.018 && x < 0.034) || (x > 0.042 && x < 0.05) || (x < -0.034 && x > -0.05)) ? 0x8aa0c0 : 0x15181e);
    const shades = mesh(shadesGeo, M.shades, R.head, 0, 0.143, 0.104);
    H.mouthS = 1.25;
    // polo collar, placket buttons, belt and a gold buckle
    const collar = mesh(new THREE.TorusGeometry(0.068, 0.02, 5, 12), M.white, R.torso, 0, S.sY + 0.06, 0.005); collar.rotation.x = Math.PI / 2 + 0.25;
    const bz = y => profR(prof, y) * look.torsoZ + 0.004;
    const buttons = mesh(merge([0.44, 0.4].map(y => solid(sph(0.011, 6, 4).translate(0, y, bz(y)), white))), M.paint, R.torso);
    const belt = mesh(new THREE.CylinderGeometry(0.162, 0.162, 0.045, 12), M.belt, R.torso, 0, 0.015, 0); belt.scale.z = 0.8;
    const buckle = mesh(new THREE.BoxGeometry(0.05, 0.036, 0.012), M.gold, R.torso, 0, 0.015, 0.132);
    return { R, M, H, parts: { visor, brim, shades, hair, collar, belt, buckle, buttons }, extra: null };
  },

  // Grandma Birdie: straw sun hat with a flower, cardigan over a blouse, pearls,
  // a pleated skirt, glasses, a bun. Tint: the cardigan.
  birdie(S, tint) {
    const card = tint ?? 0xc36fae, rib = shade(card, 0.72), blouse = 0xf7f1e3;
    const M = {
      skin: mat(0xf2cdb0), hand: mat(0xf2cdb0), paint: mat(0xffffff, { vc: true, glow: 0.13 }),
      thigh: mat(0xd9b49a), shin: mat(0xd9b49a), hair: mat(0xeceaf2, { glow: 0.2 }),
      straw: mat(0xffffff, { vc: true, glow: 0.16 }), ribbon: mat(0x6fb2e6), specs: mat(0x8a2b45, { rough: 0.4 }), pearl: mat(0xffffff, { vc: true, rough: 0.25, glow: 0.25 }),
      grip: mat(0x6a3e22, { rough: 0.9 }), steel: mat(0xc8ccd2, { rough: 0.3, metal: 0.8, glow: 0.05 }),
    };
    faceMats(M, 0xb8b4c0);
    M.shirt = M.sleeve = M.shoe = M.pelvis = M.paint;
    const prof = [[0.001, -0.06], [0.16, -0.05], [0.185, 0.06], [0.18, 0.18], [0.165, 0.28], [0.13, 0.355], [0.06, 0.4], [0.001, 0.41]];
    const look = {
      // cardigan: ribbed hem, a blouse V at the neck
      torsoGeo: lathe(prof, [0.0, 0.22, 0.27, 0.32], (x, y, z, a) => y < 0.0 ? rib : z > 0 && Math.abs(a) < (y - 0.2) * 2.6 ? blouse : card),
      torsoZ: 0.85, handR: 0.044,
      upGeo: capsule(0.044, S.UA, 8, [], () => card), foGeo: capsule(0.037, S.FA, 8, [0.78], f => f > 0.78 ? rib : card),
      thighGeo: cap(0.04, S.TL - 0.02), shinGeo: cap(0.034, S.SL - 0.03),
      shoeGeo: shoe(0.052, 0.9, 0.62, 1.5, { upper: 0x5b3a2c, sole: 0x2e1d16, toe: 0x6e4836 }),
      // A-line pleated skirt from the waist to below the knee, cream hem stripe
      pelvisGeo: paint(new THREE.CylinderGeometry(0.15, 0.225, 0.4, 12, 5), (x, y, z) => y < -0.12 && y > -0.2 ? 0xeee4d0 : ((Math.floor((Math.atan2(x, z) + Math.PI) / (Math.PI / 6) + 1e-3)) & 1) ? 0x55607e : 0x48526e),
      pelvisY: -0.17, pelvisScale: [1, 1, 0.85],
    };
    const R = buildRig(S, M, look);
    const H = buildFace(R.head, M, { ears: false, eyeR: 0.021, pupR: 0.013, eyeX: 0.042, eyeY: 0.14, cheeks: 0xff8fa0, browY: 0.178 });
    // silver hair puffing out under the hat, a bun behind
    const hair = mesh(sph(0.122, 12, 8), M.hair, R.head, 0, 0.15, -0.025); hair.scale.set(1.05, 0.7, 1.02);
    const bun = mesh(sph(0.055, 8, 6), M.hair, R.head, 0, 0.16, -0.125);
    // glasses
    const ring = new THREE.TorusGeometry(0.027, 0.0055, 4, 12);
    const glassL = mesh(ring, M.specs, R.head, 0.042, 0.14, 0.117);
    const glassR = mesh(ring, M.specs, R.head, -0.042, 0.14, 0.117);
    // the woven sun hat, tipped back a touch, flower on the side
    const hat = new THREE.Group(); hat.position.set(0, 0.215, -0.01); hat.rotation.x = -0.12; R.head.add(hat);
    const weave = (x, y, z) => ((Math.floor((Math.atan2(x, z) + Math.PI) / (Math.PI / 9) + 1e-3) + Math.floor(Math.hypot(x, z) / 0.045)) & 1) ? 0xf0d68c : 0xdcbd6c;
    const brim = mesh(paint(new THREE.CylinderGeometry(0.25, 0.26, 0.012, 18, 1), weave), M.straw, hat);
    const crown = mesh(paint(sph(0.118, 14, 8), (x, y, z) => ((Math.floor((Math.atan2(x, z) + Math.PI) / (Math.PI / 7) + 1e-3) + Math.floor(y / 0.03 + 10)) & 1) ? 0xf0d68c : 0xdcbd6c), M.straw, hat); crown.scale.set(1, 0.78, 1);
    const band = mesh(new THREE.CylinderGeometry(0.121, 0.121, 0.032, 14), M.ribbon, hat, 0, 0.022, 0);
    const flower = new THREE.Group(); flower.position.set(0.1, 0.045, 0.06); flower.rotation.set(0.3, 0.9, -0.3); hat.add(flower);
    const fl = [solid(sph(0.022, 8, 6).translate(0, 0, 0.012), 0xffd23f)];
    for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5 + 0.4; fl.push(solid(sph(0.026, 8, 6).scale(1, 1, 0.45).translate(Math.cos(a) * 0.03, Math.sin(a) * 0.03, 0), 0xff7aa0)); }
    mesh(merge(fl), M.paint, flower);
    // cardigan buttons and a string of pearls
    const bz = y => profR(prof, y) * look.torsoZ + 0.004;
    const buttons = mesh(merge([0.2, 0.13, 0.06].map(y => solid(sph(0.013, 6, 4).translate(0, y, bz(y)), blouse))), M.paint, R.torso);
    const pearls = [];
    for (let i = 0; i < 9; i++) {
      const a = (i - 4) / 4 * 1.25, y = 0.352 - 0.04 * Math.cos(a);
      pearls.push(new THREE.SphereGeometry(0.0115, 6, 3).translate(Math.sin(a) * 0.1, y, Math.cos(a) * (profR(prof, y) * look.torsoZ + 0.006)));
    }
    const necklace = mesh(merge(pearls.map(p => solid(p, 0xfff8ec))), M.pearl, R.torso);
    const extra = (U, t, mode, ph) => {
      // the flower nods along with her
      flower.rotation.z = -0.3 + (mode === 'run' ? 0.25 * Math.sin(ph * 2) : mode === 'sulk' ? -0.5 : 0.08 * Math.sin(t * 1.3));
    };
    return { R, M, H, parts: { hat, brim, crown, band, flower, hair, bun, glassL, glassR, buttons, necklace }, extra };
  },

  // The Caddie Kid: big head, backwards cap, striped tee, baggy shorts, tube
  // socks, a plaster on one knee, and a bag bigger than them. Tint: cap, bag, stripe.
  kid(S, tint) {
    const t = tint ?? 0xe8473a, tee = 0xffc93c, skin = 0xd99a6c, sock = 0xf6f6f2;
    const M = {
      skin: mat(skin), hand: mat(skin), paint: mat(0xffffff, { vc: true, glow: 0.14 }), pelvis: mat(0x4a7cc0),
      hair: mat(0xd2672a), capM: mat(0xffffff, { vc: true }),
      pomA: mat(0x3fa7ff, { glow: 0.2 }), pomB: mat(0xffe14d, { glow: 0.2 }), pomC: mat(0x43c06a, { glow: 0.2 }),
      grip: mat(0x1d1d22, { rough: 0.9 }), steel: mat(0xc8ccd2, { rough: 0.3, metal: 0.8, glow: 0.05 }),
    };
    faceMats(M, 0xb0521e);
    M.shirt = M.sleeve = M.shoe = M.thigh = M.shin = M.paint; M.forearm = M.skin;
    const shinPaint = plaster => (f, x, z) => f < 0.36 ? sock : f < 0.44 ? t : f < 0.5 ? sock : plaster && f > 0.76 && f < 0.9 && z > 0 && Math.abs(x) < 0.03 ? 0xf2d0a0 : skin;
    const look = {
      // ringer tee: a band of the team colour across the chest, coloured collar
      torsoGeo: lathe([[0.001, -0.06], [0.135, -0.05], [0.145, 0.08], [0.145, 0.2], [0.14, 0.27], [0.1, 0.33], [0.05, 0.355], [0.001, 0.36]], [0.12, 0.19, 0.335],
        (x, y) => (y > 0.12 && y < 0.19) || y > 0.335 ? t : tee),
      torsoZ: 0.8, handR: 0.046,
      upGeo: capsule(0.047, S.UA, 8, [0.68], f => f > 0.68 ? t : tee), foGeo: cap(0.034, S.FA),
      thighGeo: paint(new THREE.CylinderGeometry(0.07, 0.083, S.TL + 0.04, 10, 6), (x, y) => y < -(S.TL + 0.04) / 3 ? 0x6f9be0 : 0x4a7cc0),
      shinGeo: capsule(0.038, S.SL - 0.03, 8, [0.36, 0.44, 0.5], shinPaint(false)),
      shinGeoL: capsule(0.038, S.SL - 0.03, 8, [0.36, 0.44, 0.5, 0.76, 0.9], shinPaint(true)),
      shoeGeo: shoe(0.07, 1, 0.64, 1.55, { upper: 0xf6f6f2, sole: 0xd9a066, band: t }), shoeZ: 0.035,
      pelvisGeo: sph(0.15, 12, 8), pelvisScale: [1, 0.55, 0.82], pelvisY: -0.02,
    };
    const R = buildRig(S, M, look);
    const H = buildFace(R.head, M, { eyeY: 0.136, eyeX: 0.046, eyeR: 0.03, pupR: 0.017, mouthY: 0.072, cheeks: 0xf27a6a, freckles: true, gap: true });
    H.earL.scale.set(0.5, 1.15, 0.9); H.earR.scale.set(0.5, 1.15, 0.9);
    // backwards cap: panelled crown with a button, brim off the back, a ginger tuft through the strap gap
    const capG = new THREE.Group(); capG.position.set(0, 0.165, 0); capG.rotation.x = -0.12; R.head.add(capG);
    const crownGeo = paint(new THREE.SphereGeometry(0.128, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2), (x, y, z) => y > 0.122 ? 0xf6f6f2 : (Math.floor((Math.atan2(x, z) + Math.PI) / (Math.PI / 3) + 1e-3) & 1) ? t : shade(t, 0.82));
    const crown = mesh(crownGeo, M.capM, capG); crown.scale.set(1.04, 0.72, 1.08);
    const brim = mesh(solid(new THREE.CylinderGeometry(0.11, 0.11, 0.012, 14, 1, false, Math.PI / 2, Math.PI), shade(t, 0.82)), M.capM, capG, 0, 0.004, -0.085);
    brim.rotation.x = -0.15;
    const tuft = mesh(sph(0.045, 8, 6), M.hair, R.head, 0, 0.215, 0.085); tuft.scale.set(1.2, 0.6, 0.8);
    // THE BAG: on the back, taller than its owner, pom-pom headcovers on top (one merged body)
    const bag = new THREE.Group(); bag.position.set(-0.05, 0.3, -0.25); bag.rotation.set(-0.14, 0, BAG_Z); R.torso.add(bag);
    const bagGeo = merge([
      lathe([[0.001, -0.56], [0.14, -0.56], [0.1446, 0.16], [0.1462, 0.24], [0.15, 0.56], [0.001, 0.56]], [], (x, y) => y > 0.16 && y < 0.24 ? 0xf4f1ea : t),
      solid(new THREE.CylinderGeometry(0.157, 0.157, 0.1, 12).translate(0, 0.5, 0), 0xf4f1ea),
      solid(new THREE.CylinderGeometry(0.147, 0.147, 0.09, 12).translate(0, -0.53, 0), 0x2a2a30),
      solid(new THREE.BoxGeometry(0.15, 0.36, 0.06).translate(0, -0.12, -0.14), 0xf4f1ea),
    ]);
    const bagBody = mesh(bagGeo, M.paint, bag);
    const poms = [];
    for (const [x, y, z, m] of [[0.05, 0.62, 0.04, M.pomA], [-0.06, 0.64, 0.02, M.pomB], [0.0, 0.6, -0.07, M.pomC]]) { poms.push(mesh(sph(0.075, 10, 8), m, bag, x, y, z)); }
    // the strap across the chest
    const strap = mesh(solid(new THREE.BoxGeometry(0.045, 0.5, 0.02), 0x2a2a30), M.paint, R.torso, 0.005, 0.18, 0.12); strap.rotation.z = 0.62;
    strap.rotation.x = -0.12;
    const extra = (U, tt, mode, ph) => {
      // the bag lags and bounces behind the kid
      if (mode === 'run') { bag.rotation.z = BAG_Z + 0.12 * Math.sin(ph); bag.rotation.x = -0.22 - 0.08 * Math.abs(Math.cos(ph)); }
      else if (mode === 'cheer') { bag.rotation.z = BAG_Z + 0.1 * Math.sin(tt * 9); bag.rotation.x = -0.14 - 0.06 * U._air; }
      else { bag.rotation.z = BAG_Z; bag.rotation.x = -0.14; }
      for (let i = 0; i < 3; i++) poms[i].position.y = 0.6 + [0.02, 0.04, 0][i] + (mode === 'run' ? 0.025 * Math.sin(ph * 2 + i) : mode === 'cheer' ? 0.05 * U._air * (1 + i * 0.4) : 0);
    };
    return { R, M, H, parts: { cap: capG, capBrim: brim, tuft, bag, bagBody, poms, strap }, extra };
  },

  // Sir Bogey: tall and lanky; tweed check jacket and cap, plus-fours, argyle
  // socks, spectator brogues, a long striped scarf, a monocle, heavy lids.
  // Tint: the scarf.
  bogey(S, tint) {
    const scarf = tint ?? 0xc8323c;
    const M = {
      skin: mat(0xf4cbb6), hand: mat(0xf4cbb6), paint: mat(0xffffff, { vc: true, glow: 0.12 }), nose: mat(0xeea08a),
      shin: mat(0xffffff, { map: argyle(), glow: 0.1 }),
      hair: mat(0x8a8580), tash: mat(0x6b625c), fringe: mat(0xbdb6ae),
      gold: mat(0xe0b74a, { rough: 0.3, metal: 0.7, glow: 0.18 }), brass: mat(0xffffff, { vc: true, rough: 0.3, metal: 0.7, glow: 0.18 }),
      glass: mat(0xcfe8ff, { rough: 0.05, metal: 0.2, glow: 0.35 }),
      grip: mat(0x6a3e22, { rough: 0.9 }), steel: mat(0xc8ccd2, { rough: 0.3, metal: 0.8, glow: 0.05 }),
    };
    faceMats(M, 0x8a8580);
    M.shirt = M.sleeve = M.shoe = M.thigh = M.pelvis = M.paint;
    const tweed = (y, a) => check(y, a, 0x7d5b3d, 0x6b4c31);
    const kTop = S.TL;
    const prof = [[0.001, -0.07], [0.13, -0.06], [0.132, 0.1], [0.138, 0.28], [0.158, 0.44], [0.15, 0.52], [0.1, 0.58], [0.04, 0.6], [0.001, 0.605]];
    const look = {
      torsoGeo: lathe(prof, [0.0, 0.05, 0.15, 0.2, 0.25, 0.35, 0.4], (x, y, z, a) => tweed(y, a)),
      torsoZ: 0.74, handR: 0.046,
      upGeo: capsule(0.042, S.UA, 8, [0.25, 0.5, 0.75], (f, x, z) => tweed(f * 0.2, Math.atan2(x, z))),
      foGeo: capsule(0.036, S.FA, 8, [0.25, 0.5, 0.75, 0.88], (f, x, z) => f > 0.88 ? 0xf4f0e6 : tweed(f * 0.2, Math.atan2(x, z))),
      // plus-fours: baggy check breeches ballooning over the knee
      thighGeo: lathe([[0.001, -kTop / 2 - 0.12], [0.045, -kTop / 2 - 0.115], [0.082, -kTop / 2 - 0.07], [0.092, -kTop / 2 + 0.02], [0.08, 0], [0.07, kTop / 2], [0.072, kTop / 2 + 0.03], [0.001, kTop / 2 + 0.04]],
        [-0.15, -0.1, -0.05, 0.05, 0.1, 0.15], (x, y, z, a) => check(y + 1, a, 0xc2a66c, 0xb0955c), 10),
      shinGeo: cap(0.04, S.SL - 0.04),
      // spectator brogues: white saddle, brown toe and heel
      shoeGeo: shoe(0.062, 0.85, 0.52, 2.05, { upper: 0xf2ede2, sole: 0x2a1a12, toe: 0x5a3320, heel: 0x5a3320 }), shoeZ: 0.06,
      pelvisGeo: sph(0.14, 12, 8), pelvisScale: [1, 0.6, 0.85], pelvisY: -0.01,
    };
    look.pelvisGeo = solid(look.pelvisGeo, 0xb0955c);
    const R = buildRig(S, M, look);
    const fo = { skullY: 0.13, skullS: [0.88, 1.15, 0.98], eyeY: 0.15, eyeX: 0.044, eyeR: 0.022, pupR: 0.013, mouthY: 0.08, mouthR: 0.03, browY: 0.178, browLen: 0.044, browTilt: 0.15 };
    const H = buildFace(R.head, M, fo);
    // a long aristocratic nose
    H.nose.geometry.dispose(); H.nose.geometry = new THREE.ConeGeometry(0.024, 0.1, 8); H.nose.material = M.nose;
    H.nose.rotation.x = Math.PI / 2 + 0.12; H.nose.position.set(0, 0.125, 0.155); H.nose.scale.set(1, 1, 1);
    // heavy lids: the upper halves of his eyes stay hooded, unimpressed
    const lids = [];
    for (const s of [1, -1]) {
      const { p, n } = skullPt(fo, s * fo.eyeX, fo.eyeY);
      _fq.setFromUnitVectors(_fz, n);
      const l = new THREE.SphereGeometry(fo.eyeR * 1.12, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2);
      l.rotateX(0.5); l.scale(1, 1.05, 0.62); l.applyQuaternion(_fq); l.translate(p.x, p.y + 0.003, p.z);
      lids.push(solid(l, 0xeab8a2));
    }
    const lid = mesh(merge(lids), M.paint, R.head);
    // a grey fringe round the back of the head
    const fringe = mesh(sph(0.112, 12, 8), M.fringe, R.head, 0, 0.115, -0.03); fringe.scale.set(0.98, 0.7, 0.95);
    // handlebar moustache; brows: one permanently raised over the monocle
    const tash = mesh(new THREE.TorusGeometry(0.058, 0.014, 4, 12, Math.PI), M.tash, R.head, 0, 0.1, 0.112); tash.scale.set(1, 0.5, 1);
    H.browR.position.y += 0.014; H.browR.rotation.z += 0.15;
    // monocle on his right eye
    const monocle = new THREE.Group(); monocle.position.set(-0.044, 0.15, 0.118); R.head.add(monocle);
    mesh(new THREE.TorusGeometry(0.028, 0.006, 4, 14), M.gold, monocle);
    const lens = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.003, 12), M.glass, monocle); lens.rotation.x = Math.PI / 2;
    // tweed flat cap
    const capG = new THREE.Group(); capG.position.set(0, 0.2, -0.005); capG.rotation.x = 0.12; R.head.add(capG);
    const crown = mesh(paint(new THREE.SphereGeometry(0.13, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2), (x, y, z) => check(y * 2.5, Math.atan2(x, z), 0x8a6c48, 0x765a3a)), M.paint, capG, 0, 0, 0.012); crown.scale.set(1.02, 0.48, 1.12);
    const brim = mesh(solid(new THREE.CylinderGeometry(0.11, 0.11, 0.012, 14, 1, false, -Math.PI / 2, Math.PI), 0x765a3a), M.paint, capG, 0, 0.004, 0.08); brim.rotation.x = 0.14;
    // brass jacket buttons
    const bz = y => profR(prof, y) * look.torsoZ + 0.004;
    const buttons = mesh(merge([0.2, 0.3].map(y => solid(sph(0.013, 6, 4).translate(0, y, bz(y)), 0xe0b74a))), M.brass, R.torso);
    // the scarf: a wrap round the neck, one tail down the front, one long tail down the back; striped ends
    const stripes = (len, segs) => paint(new THREE.BoxGeometry(1, len, 1, 1, segs, 1), (x, y) => { const r = Math.floor((y + len / 2) / (len / segs)); return r === 1 || r === 3 ? 0xf6f0e2 : scarf; });
    const wrap = mesh(new THREE.TorusGeometry(0.068, 0.034, 6, 12), mat(scarf), R.torso, 0, S.sY + 0.05, 0); wrap.rotation.x = Math.PI / 2;
    const tailF = new THREE.Group(); tailF.position.set(0.05, S.sY + 0.04, 0.07); R.torso.add(tailF);
    const tailFm = mesh(stripes(0.42, 8), M.paint, tailF, 0, -0.21, 0); tailFm.scale.set(0.075, 1, 0.022);
    const tailB = new THREE.Group(); tailB.position.set(-0.04, S.sY + 0.06, -0.07); R.torso.add(tailB);
    const tailBm = mesh(stripes(0.62, 11), M.paint, tailB, 0, -0.31, 0); tailBm.scale.set(0.09, 1, 0.03);
    const extra = (U, t, mode, ph, speed) => {
      // the back tail streams out behind when he runs, flaps when he cheers
      if (mode === 'run') {
        const lift = Math.min(1.1, 0.45 + 0.06 * speed);
        tailB.rotation.set(lift + 0.18 * Math.sin(ph * 2 + 1), 0.25 * Math.sin(ph * 2), 0.35 + 0.15 * Math.sin(ph * 4));
        tailF.rotation.set(0.5 + 0.15 * Math.sin(ph * 2), 0, 0.2 * Math.sin(ph));
      } else if (mode === 'cheer') {
        tailB.rotation.set(0.3 + 0.7 * U._air, 0, 0.2 * Math.sin(t * 7)); tailF.rotation.set(-0.15 + 0.5 * U._air, 0, 0);
      } else {
        tailB.rotation.set(0.12 + 0.03 * Math.sin(t * 1.1), 0, 0.03 * Math.sin(t * 0.7));
        tailF.rotation.set(-0.12 + 0.02 * Math.sin(t * 1.3), 0, 0.02 * Math.sin(t * 0.9));
      }
      if (mode === 'swing') { tailF.rotation.set(-0.35, 0, 0); }
      // monocle-side brow twitches up in disdain now and then; the tash bristles with it
      const tw = (t % 4.3) < 0.3 ? Math.sin((t % 4.3) / 0.3 * Math.PI) : 0;
      H.browR.position.y += 0.012 * tw;
      tash.scale.set(1 + 0.08 * tw + 0.1 * U._huff, 0.5 + 0.12 * tw + 0.15 * U._huff, 1);
      tash.rotation.z = mode === 'sulk' ? 0.08 * Math.sin(t * 13) * U._huff : 0;
    };
    return { R, M, H, parts: { cap: capG, capBrim: brim, monocle, tash, lid, buttons, scarf: wrap, scarfTailF: tailF, scarfTailB: tailB, scarfTailFMesh: tailFm, scarfTailBMesh: tailBm }, extra };
  },

  // The Mascot: a person in a giant golf-ball head with googly eyes. Team
  // jersey with a white yoke and striped sleeves, tube socks, clown sneakers.
  // Tint: the jersey.
  mascot(S, tint) {
    const jer = tint ?? 0xf26b2a, white = 0xfbfaf6;
    const M = {
      skin: mat(0xc98e66), hand: mat(0xffffff, { glow: 0.18 }), paint: mat(0xffffff, { vc: true, glow: 0.14 }),
      thigh: mat(0x2e3550), pelvis: mat(0x2e3550),
      ball: mat(0xfbfaf6, { flat: true, rough: 0.55, glow: 0.18 }), white: mat(0xffffff, { glow: 0.28, rim: 0.25 }), dark: mat(0x111111, { glow: 0, rim: 0.2 }),
      grip: mat(0x1d1d22, { rough: 0.9 }), steel: mat(0xc8ccd2, { rough: 0.3, metal: 0.8, glow: 0.05 }),
    };
    faceMats(M, 0x333333);
    M.shirt = M.sleeve = M.shoe = M.shin = M.paint; M.forearm = M.skin;
    const look = {
      torsoGeo: lathe([[0.001, -0.07], [0.17, -0.06], [0.21, 0.08], [0.215, 0.2], [0.2, 0.32], [0.16, 0.4], [0.07, 0.445], [0.001, 0.45]], [-0.04, 0.0, 0.35],
        (x, y) => y > 0.35 || (y > -0.04 && y < 0.0) ? white : jer),
      torsoZ: 0.85, handR: 0.072,
      upGeo: capsule(0.056, S.UA, 8, [0.5, 0.6, 0.72, 0.82], f => (f > 0.5 && f < 0.6) || (f > 0.72 && f < 0.82) ? white : jer), foGeo: cap(0.044, S.FA),
      thighGeo: cap(0.088, S.TL - 0.06),
      shinGeo: capsule(0.057, S.SL - 0.05, 8, [0.62, 0.72, 0.8, 0.9], f => (f > 0.62 && f < 0.72) || (f > 0.8 && f < 0.9) ? jer : white),
      shoeGeo: shoe(0.088, 1, 0.58, 1.55, { upper: 0xe23b3b, sole: 0xf4f2ec, toe: 0xf4f2ec }), shoeZ: 0.06,
      pelvisGeo: sph(0.2, 12, 8), pelvisScale: [1, 0.55, 0.85], pelvisY: -0.02,
    };
    const R = buildRig(S, M, look);
    // the giant ball head: a faceted icosphere reads as dimpled
    const HR = 0.34, HY = 0.24;
    const ball = mesh(new THREE.IcosahedronGeometry(HR, 2), M.ball, R.head, 0, HY, 0);
    const eyeGeo = sph(0.095, 12, 8), pupGeo = sph(0.046, 10, 8);
    const eyeL = mesh(eyeGeo, M.white, R.head, 0.12, HY + 0.08, 0.27); eyeL.scale.set(1, 1, 0.55);
    const eyeR = mesh(eyeGeo, M.white, R.head, -0.12, HY + 0.08, 0.27); eyeR.scale.set(1, 1, 0.55);
    const pupL = mesh(pupGeo, M.dark, R.head, 0.12, HY + 0.08, 0.315);
    const pupR = mesh(pupGeo, M.dark, R.head, -0.12, HY + 0.08, 0.315);
    // a big D grin curved onto the ball
    const n = new THREE.Vector3(0, -0.05, HR).normalize();
    const mouth = mesh(mouthGeo(0.135, HR, false), M.mouth, R.head, n.x * HR, HY + n.y * HR + 0.004, n.z * HR + 0.004);
    mouth.rotation.set(Math.atan2(-n.y, n.z), 0, Math.PI);
    const browGeo = cap(0.016, 0.07, 6);
    const browL = mesh(browGeo, M.brow, R.head, 0.12, HY + 0.2, 0.25); browL.rotation.set(-0.5, 0, Math.PI / 2 - 0.15);
    const browR = mesh(browGeo, M.brow, R.head, -0.12, HY + 0.2, 0.25); browR.rotation.set(-0.5, 0, Math.PI / 2 + 0.15);
    const H = { unit: 2.6, mouthOpen: 1.3, mouthS: 1.25, skull: ball, eyeL, eyeR, mouth, mouthY: mouth.position.y, pupilL: pupL, pupilR: pupR, browL, browR,
      blinkers: [eyeL, eyeR, pupL, pupR] };
    // a white chest disc, like a team crest, with a coloured ring
    const crest = mesh(paint(new THREE.CylinderGeometry(0.075, 0.075, 0.01, 14, 1), (x, y, z) => Math.hypot(x, z) > 0.05 && y > 0 ? shade(jer, 0.75) : white), M.paint, R.torso, 0, 0.27, 0.165); crest.rotation.x = Math.PI / 2 - 0.25;
    const extra = (U, t, mode, ph, speed) => {
      // googly pupils: rattle when moving, drift when idle, droop when sulking
      const moving = mode === 'run' || mode === 'cheer' || (mode === 'swing' && U._swingK > 0.5 && U._swingK < 0.8);
      for (const [p, sx] of [[pupL, 1], [pupR, -1]]) {
        const k = moving ? t * 23 + sx * 2.1 : t * 0.7 + sx * 0.4, a = moving ? 0.03 : 0.012;
        let ox = Math.sin(k) * a, oy = Math.cos(k * 1.3) * a;
        if (mode === 'sulk') oy -= 0.035;
        if (mode === 'swing') { ox += -0.02; oy -= 0.03; }   // eye on the ball
        if (mode === 'idle') ox += 0.03 * U._look;
        p.position.set(sx * 0.12 + ox, HY + 0.08 + oy, 0.315);
      }
    };
    return { R, M, H, parts: { ball, crest }, extra, noFaceMouth: true };
  },
};

// ---------------------------------------------------------------- build
export function buildGolfer(id, tint) {
  const S = SPECS[id] ?? SPECS.pro;
  const key = SPECS[id] ? id : 'pro';
  const { R, M, H, parts, extra } = BUILDERS[key](S, tint);
  const g = R.g; g.name = 'Golfer:' + key;
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  storeBrows(H);
  const sw = swingGeom(S);
  g.userData = {
    id: key, spec: S, rig: R.rig, body: R.torso, torso: R.torso, hips: R.hips, chest: R.chest, pelvis: R.pelvis, neck: R.neck,
    head: R.head, ...H, face: H, ...parts,
    armL: R.armL, armR: R.armR, handL: R.armL.hand, handR: R.armR.hand,
    legL: R.legL, legR: R.legR, club: R.club, clubHead: R.clubHead,
    materials: M, extra, sw, swingBall: sw.ball.clone(), impactK: GOLFER_IMPACT,
    _phase: 0, _lastT: null, _swingK: 0, _air: 0, _huff: 0, _look: 0,
  };
  animateGolfer(g, 0, { mode: 'idle' });
  return g;
}

// Stand a golfer at a ball (ground-level y) so their swing sends it toward target.
export function golferAddress(g, ball, target) {
  const yaw = Math.atan2(target.x - ball.x, target.z - ball.z);
  g.rotation.set(0, yaw, 0);
  const off = g.userData.swingBall.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  g.position.set(ball.x - off.x, ball.y, ball.z - off.z);
  return g;
}

// ---------------------------------------------------------------- animation
const _up = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _e = new THREE.Vector3(), _p = new THREE.Vector3();
const _tL = new THREE.Vector3(), _tR = new THREE.Vector3(), _pL = new THREE.Vector3(), _pR = new THREE.Vector3();
const _co = new THREE.Vector3(), _cd = new THREE.Vector3(), _cf = new THREE.Vector3();
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
const clamp01 = x => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const u = clamp01((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const lerp = (a, b, u) => a + (b - a) * u;
const pulse = (a, b, c, d, x) => smooth(a, b, x) * (1 - smooth(c, d, x));   // up over a..b, down over c..d

function seg(mesh, a, b, len) {
  mesh.position.lerpVectors(a, b, 0.5);
  _v.subVectors(b, a); const d = _v.length();
  mesh.quaternion.setFromUnitVectors(_up, _v.divideScalar(d || 1));
  mesh.scale.set(1, d / len, 1);
}
// Two-bone arm: shoulder -> T (torso space), elbow bends toward pole.
function solveArm(arm, T, pole) {
  const S = arm.shoulder, UA = arm.UA, FA = arm.FA;
  _w.subVectors(T, S); const d = _w.length(); _w.divideScalar(d || 1);
  if (d >= UA + FA - 1e-4) _e.copy(S).addScaledVector(_w, d * UA / (UA + FA));
  else {
    const along = (UA * UA - FA * FA + d * d) / (2 * d), h = Math.sqrt(Math.max(0, UA * UA - along * along));
    _p.copy(pole).addScaledVector(_w, -pole.dot(_w)).normalize();
    _e.copy(S).addScaledVector(_w, along).addScaledVector(_p, h);
  }
  seg(arm.up, S, _e, UA); seg(arm.fo, _e, T, FA);
  arm.hand.position.copy(T);
}
// Club pivot at origin (rig space), shaft pointing along dir, face roughly toward face.
function orientClub(club, origin, dir, face) {
  club.position.copy(origin);
  _y.copy(dir).negate().normalize();
  _z.copy(face).addScaledVector(_y, -face.dot(_y)).normalize();
  _x.crossVectors(_y, _z);
  club.quaternion.setFromRotationMatrix(_m.makeBasis(_x, _y, _z));
}
function rigToTorso(torso, v) { torso.updateMatrix(); return v.applyMatrix4(_m.copy(torso.matrix).invert()); }
function torsoToRig(torso, v) { torso.updateMatrix(); return v.applyMatrix4(torso.matrix); }
function dirToTorso(torso, v) { return v.applyQuaternion(_q.copy(torso.quaternion).invert()); }
function dirToRig(torso, v) { return v.applyQuaternion(torso.quaternion); }
// a point given in head space, in rig space (for a hand to touch the face / visor)
function headToRig(head, torso, v) { head.updateMatrix(); v.applyMatrix4(head.matrix); return torsoToRig(torso, v); }

// Swing timeline (as Old Tom): a = hands' angle round the arc (+ back, - through), h = wrist cock.
const A_TOP = 2.3, A_FIN = -2.55, HINGE = 1.65;
function swingPose(k) {
  let a, h, f = 0;
  if (k < 0.1) { a = 0.05 * Math.sin(k / 0.1 * Math.PI * 2); h = 0; }
  else if (k < 0.42) { const u = (k - 0.1) / 0.32; a = A_TOP * (0.5 - 0.5 * Math.cos(u * Math.PI)); h = HINGE * smooth(0.05, 0.75, u); }
  else if (k < 0.46) { a = A_TOP; h = HINGE; }
  else if (k < GOLFER_IMPACT) { const u = (k - 0.46) / (GOLFER_IMPACT - 0.46); a = A_TOP * (1 - u * u); h = HINGE * (1 - u * u * u); }
  else if (k < 0.74) { const u = (k - GOLFER_IMPACT) / (0.74 - GOLFER_IMPACT); f = 1 - (1 - u) * (1 - u); a = A_FIN * f; h = -HINGE * Math.pow(f, 0.7); }
  else { f = 1; a = A_FIN; h = -HINGE; }
  return { a, h, f };
}

// How far each foot sits above the ground given the current leg angles.
function legLift(S, L) {
  const a = L.hip.rotation.x, b = a + L.knee.rotation.x, c = Math.cos(L.hip.rotation.z);
  return (S.TL + S.SL) - (S.TL * Math.cos(a) + S.SL * Math.cos(b)) * c;
}
function feetFlat(L, amt = 0.85) { L.ankle.rotation.x = -(L.hip.rotation.x + L.knee.rotation.x) * amt; }

// Glances left and right now and then; 0 most of the time.
function glance(t, seed) {
  const p = (t * 0.16 + seed) % 1;
  return smooth(0.12, 0.2, p) * (1 - smooth(0.32, 0.4, p)) - smooth(0.6, 0.68, p) * (1 - smooth(0.8, 0.88, p));
}

// The face's expression for this frame; each mode sets what it needs.
// up: brow raise; tilt: + cross / focused, - sad / pleading; open/wide: mouth;
// frown: mouth upside down; eye: lid opening (1 = normal); lx/ly: pupils' gaze.
const _X = { up: 0, tilt: 0, open: 0.6, wide: 1, frown: false, eye: 1, lx: 0, ly: 0 };
function resetExpr() { Object.assign(_X, { up: 0, tilt: 0, open: 0.6, wide: 1, frown: false, eye: 1, lx: 0, ly: 0 }); }
function animateFace(U, t, seed) {
  const F = U.face, u = F.unit ?? 1;
  // blinks every few seconds; some characters double-blink
  const per = 3.3 + seed * 1.7, bp = (t + seed * 11) % per;
  let bl = bp < 0.13 ? Math.sin(bp / 0.13 * Math.PI) : 0;
  if (seed > 0.4 && bp > 0.2 && bp < 0.33) bl = Math.sin((bp - 0.2) / 0.13 * Math.PI);
  const open = Math.max(0.07, _X.eye * (1 - 0.95 * bl));
  if (F.eyes) { F.eyes.scale.y = open; F.pupils.position.set(_X.lx * F.look, _X.ly * F.look, 0); }
  if (F.blinkers) for (let i = 0; i < F.blinkers.length; i++) F.blinkers[i].scale.y = open;
  const B = F.browBase;
  for (const [b, base, s] of [[F.browL, B[0], 1], [F.browR, B[1], -1]]) {
    b.position.y = base.y + (_X.up - 0.006 * Math.max(0, _X.tilt)) * u;
    b.rotation.z = base.rz + s * _X.tilt;
  }
  const m = F.mouth, mS = F.mouthS ?? 1;
  m.rotation.z = _X.frown ? 0 : Math.PI;
  m.scale.set(_X.wide * mS, _X.open, 1);
  m.position.y = F.mouthY - (_X.frown ? 0.012 * u : 0);
}

// state: { mode: 'idle' } | { mode: 'run', speed } | { mode: 'swing', k } | { mode: 'cheer' } | { mode: 'sulk' }
export function animateGolfer(g, t, state = { mode: 'idle' }) {
  const U = g.userData, S = U.spec;
  const { rig, torso, head, legL, legR, armL, armR, club } = U;
  const mode = state?.mode ?? 'idle';
  const reach = S.UA + S.FA;
  const seed = { pro: 0.1, birdie: 0.35, kid: 0.6, bogey: 0.8, mascot: 0.2 }[U.id] ?? 0;

  // defaults; each mode overrides what it needs
  rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0); rig.scale.set(1, 1, 1);
  torso.rotation.set(S.hunch, 0, 0);
  head.rotation.set(-S.hunch * 0.85, 0, 0);
  for (const [L, s] of [[legL, 1], [legR, -1]]) { L.hip.rotation.set(0, 0, s * S.stance); L.knee.rotation.set(0, 0, 0); L.ankle.rotation.set(0, 0, 0); }
  resetExpr();
  U._air = 0; U._huff = 0; U._look = 0;
  _pL.set(1, -0.6, -0.6); _pR.set(-1, -0.6, -0.6);
  let handsInTorso = false, polesInTorso = false, liftFix = true, ph = U._phase, speed = 0;

  if (mode === 'swing') {
    const k = clamp01(state?.k ?? 0); U._swingK = k;
    const { a, h, f } = swingPose(k), W = U.sw;
    rig.rotation.y = -Math.PI / 2;                       // side-on: rig +X (their left) becomes group +Z
    const shift = 0.06 * smooth(0.42, 0.6, k) - 0.02 * smooth(0.1, 0.4, k);
    rig.position.z = shift;
    // athletic knee flex; the trail knee kicks in toward the target on the follow-through
    for (const [L, s] of [[legL, 1], [legR, -1]]) { L.hip.rotation.set(-0.16, 0, s * (S.stance + 0.06)); L.knee.rotation.x = 0.32; }
    legR.knee.rotation.x += 0.6 * f; legR.hip.rotation.x -= 0.12 * f; legR.hip.rotation.y = -0.55 * f;
    const drop = legLift(S, legL);
    rig.position.y = -drop;
    feetFlat(legL); feetFlat(legR, 0.35);
    liftFix = false;
    // a bigger shoulder coil at the top and a full, held finish (chest to the target)
    const turn = a > 0 ? -1.4 * (a / A_TOP) : 1.6 * (a / A_FIN);
    torso.rotation.x = lerp(S.tilt, 0.06, smooth(GOLFER_IMPACT, 0.85, k));
    torso.rotation.y = turn;
    torso.rotation.z = a > 0 ? 0.1 * (a / A_TOP) : -0.2 * (a / A_FIN);
    head.rotation.y = -turn * 0.8 * (1 - f) + 0.3 * f;
    head.rotation.x = lerp(0.22, -0.18, f);
    const b = a + h;
    _co.copy(W.Sc).addScaledVector(W.D, W.HR * Math.cos(a)).addScaledVector(W.B, W.HR * Math.sin(a));
    _cd.copy(W.D).multiplyScalar(Math.cos(b)).addScaledVector(W.B, Math.sin(b));
    _cf.copy(W.D).multiplyScalar(Math.sin(b)).addScaledVector(W.B, -Math.cos(b));
    _co.x -= shift; _co.y += drop;                       // hands stay on the arc to the ball, not the weight shift / knee flex
    orientClub(club, _co, _cd, _cf);
    _tL.copy(_co).addScaledVector(_cd, 0.045); _tR.copy(_co).addScaledVector(_cd, 0.125);
    _pL.set(0.3, -1, 0); _pR.set(-0.3, -1, 0);
    // focus over the ball, a grimace of effort through it, then pleased with themselves
    const eff = pulse(0.44, 0.5, 0.58, 0.66, k), proud = smooth(0.62, 0.78, k);
    _X.tilt = 0.22 * (1 - proud) + 0.15 * eff; _X.ly = -1 + proud; _X.eye = 1 - 0.55 * eff;
    _X.open = lerp(0.22, 0.38, eff) + 0.3 * proud; _X.wide = lerp(0.7, 1.05, Math.max(eff, proud)); _X.up = 0.006 * proud;
  } else if (mode === 'run') {
    const Rn = S.run;
    speed = Math.max(0, state?.speed ?? 6);
    const sp = Math.min(speed, 14);
    const freq = (1.2 + 0.13 * sp) * Rn.cad;            // strides per second
    if (Number.isFinite(state?.phase)) U._phase = state.phase;
    else if (U._lastT == null || t < U._lastT || t - U._lastT > 0.25) U._phase = t * freq * Math.PI * 2;
    else U._phase += (t - U._lastT) * freq * Math.PI * 2;
    ph = U._phase;
    const sL = Math.sin(ph), cL = Math.cos(ph);
    const amp = Math.min(1.05, (0.44 + 0.045 * sp) * Rn.stride);
    const kA = (0.85 + 0.05 * sp) * Rn.knee;
    legL.hip.rotation.x = -amp * sL; legR.hip.rotation.x = amp * sL;
    legL.knee.rotation.x = 0.15 + kA * Math.pow(Math.max(0, cL), 0.8) + 0.3 * Math.max(0, -sL);
    legR.knee.rotation.x = 0.15 + kA * Math.pow(Math.max(0, -cL), 0.8) + 0.3 * Math.max(0, sL);
    legL.hip.rotation.z = S.stance * 0.5; legR.hip.rotation.z = -S.stance * 0.5;
    feetFlat(legL, 0.6); feetFlat(legR, 0.6);
    const lean = S.hunch + Rn.lean + (Rn.lean > 0 ? 0.012 * sp : 0);
    const bounce = Math.abs(sL), sq = 1 - bounce;        // sq peaks as the legs pass: the body squashes down onto them
    torso.rotation.x = lean + 0.04 * sq;
    torso.rotation.y = 0.26 * sL * Rn.arm;
    rig.rotation.z = Rn.sway * sL;
    rig.rotation.y = (Rn.wiggle ?? 0) * sL;              // Birdie's speed-walk hip wiggle
    rig.position.y = Rn.bounce * bounce * Math.min(1, 0.4 + sp / 8);
    rig.scale.set(1 + 0.025 * sq, 1 - 0.04 * sq + 0.02 * bounce, 1 + 0.025 * sq);
    // big heads bob with a little lag
    head.rotation.x = -lean * 0.75 + 0.07 * Math.sin(ph * 2 - 0.9) + (Rn.chin ?? 0);
    head.rotation.y = -torso.rotation.y * 0.8;
    head.rotation.z = -rig.rotation.z * 0.6 + 0.04 * Math.sin(ph);
    // pumping arms, elbows bent; the club rides in the right hand, level, head first
    const fR = Math.max(-1.3, Math.min(1.3, sL * Rn.arm)), fL = -fR;
    const out = Rn.out ?? 0, tuck = Rn.tuck ?? 0, flail = Rn.flail ?? 0;
    for (const [T, f, s] of [[_tL, fL, 1], [_tR, fR, -1]]) {
      const hy = S.sY - reach * (0.74 - 0.36 * Math.max(0, f) + 0.04 * Math.max(0, -f) - tuck);
      T.set(s * (S.sX + 0.02 + out - tuck * 0.3 + flail * (1 + Math.sin(ph * 2 + s))), hy, 0.05 + f * reach * 0.56);
    }
    handsInTorso = true;
    _pL.set(0.25 + out * 3, -0.3, -1); _pR.set(-0.25 - out * 3, -0.3, -1); polesInTorso = true;
    _cd.set(-0.32 - 0.25 * Math.max(0, -fR), -0.08 + 0.3 * fR, 1).normalize();   // head flared out, clear of the hip
    dirToRig(torso, _cd);
    _v.copy(_tR); torsoToRig(torso, _v);
    _co.copy(_v).addScaledVector(_cd, -0.38 * S.club);
    _cf.set(0, 1, 0);
    orientClub(club, _co, _cd, _cf);
    _X.tilt = 0.14; _X.open = 0.62 + 0.12 * sq; _X.wide = 0.95; _X.up = 0.002;
  } else if (mode === 'cheer') {
    // crouch, spring, airborne (each their own way), land with a squash, again
    const C = S.cheer, P = C.P, n = Math.floor((t + seed) / P), u = ((t + seed) / P) % 1;
    const crouch = pulse(0, 0.14, 0.16, 0.22, u) + pulse(0.72, 0.78, 0.82, 1, u) * 0.8;
    const au = clamp01((u - 0.2) / 0.52), air = u > 0.2 && u < 0.72 ? 4 * au * (1 - au) : 0;
    const inAir = u > 0.2 && u < 0.72 ? 1 : 0;
    U._air = air;
    for (const L of [legL, legR]) { L.hip.rotation.x = -0.5 * crouch - 0.4 * C.tuck * air; L.knee.rotation.x = 1.0 * crouch + 0.8 * C.tuck * air; }
    const style = C.style;
    if (style === 'star' || style === 'spin') { legL.hip.rotation.z += 0.42 * air; legR.hip.rotation.z -= 0.42 * air; }
    if (style === 'click') { legL.hip.rotation.z += 0.22 * air; legR.hip.rotation.z += 0.5 * air; legL.knee.rotation.x += 0.25 * air; legR.knee.rotation.x += 0.25 * air; }
    if (style === 'hop') { legR.hip.rotation.x += 0.35 * air; legR.knee.rotation.x += 1.3 * air; }   // a kick of the heel behind
    const ff = lerp(0.9, 0.5, Math.min(1, air * 5)); feetFlat(legL, ff); feetFlat(legR, ff);
    liftFix = false;
    const lift = Math.min(legLift(S, legL), legLift(S, legR));
    rig.position.y = S.jump * air - lift * Math.max(0, 1 - air * 4);
    // stretch on take-off, squash on landing
    const st = 0.09 * pulse(0.18, 0.26, 0.32, 0.45, u) - 0.1 * pulse(0.7, 0.75, 0.78, 0.9, u) - 0.05 * pulse(0.02, 0.12, 0.16, 0.2, u);
    rig.scale.set(1 - st * 0.5, 1 + st, 1 - st * 0.5);
    if (style === 'spin' && (n & 1)) rig.rotation.y = Math.PI * 2 * smooth(0.2, 0.7, u);
    torso.rotation.x = S.hunch * 0.4 - 0.12 + 0.3 * crouch;
    head.rotation.x = -0.32 + 0.25 * crouch;
    head.rotation.z = 0.12 * Math.sin(t * 5);
    const wave = 0.05 * Math.sin(t * 13);
    if (style === 'pump') {
      // the club punched to the sky, the other fist pumped down on every landing: yes!
      _tR.set(-S.sX - 0.06, S.sY + reach * 0.96, 0.04);
      const fist = 1 - pulse(0.66, 0.74, 0.86, 1, u);
      _tL.set(S.sX + 0.1, lerp(S.sY - reach * 0.45, S.sY + reach * 0.55, fist), lerp(0.22, 0.12, fist));
      _pL.set(1, -0.6, 0.3); _pR.set(-1, -0.2, -0.3);
      _cd.set(-0.12, 1, 0.08);
    } else if (style === 'click') {
      // the club held aloft, other hand on hip, heels clicked at the top
      _tR.set(-S.sX - 0.08, S.sY + reach * 0.95, 0.04);
      _tL.set(S.sX + 0.06, 0.06, 0.04); _pL.set(1, 0.2, -0.4); _pR.set(-1, -0.2, -0.3);
      _cd.set(-0.1, 1, 0.1);
    } else if (style === 'hop') {
      // both hands up and waving, a happy little hop
      _tL.set(S.sX + 0.24 + wave, S.sY + reach * 0.72, 0.1); _tR.set(-S.sX - 0.24 - wave, S.sY + reach * 0.72, 0.1);
      _pL.set(1, -0.6, -0.2); _pR.set(-1, -0.6, -0.2);
      _cd.set(-0.5, 1, 0.3);
      _X.eye = 0.3;   // eyes screwed up with delight
    } else {
      // star jump: arms flung wide
      const w = 0.4 + 0.6 * smooth(0.15, 0.35, u) * (1 - smooth(0.7, 0.85, u));
      _tL.set(S.sX + reach * 0.62 * w, S.sY + reach * (0.35 + 0.45 * w), 0.06); _tR.set(-S.sX - reach * 0.62 * w, S.sY + reach * (0.35 + 0.45 * w), 0.06);
      _pL.set(0, -1, -0.4); _pR.set(0, -1, -0.4);
      _cd.set(-0.6, 1, 0.1);
    }
    handsInTorso = true; polesInTorso = true;
    _cd.z += 0.15 * Math.sin(t * 11); _cd.normalize(); dirToRig(torso, _cd);
    _v.copy(_tR); torsoToRig(torso, _v);
    _co.copy(_v).addScaledVector(_cd, -0.05);
    _cf.set(0, 0, 1);
    orientClub(club, _co, _cd, _cf);
    _X.up = 0.012; _X.tilt = -0.08; _X.open = (U.mouthOpen ?? 1.25) * (0.85 + 0.15 * air); _X.wide = 1.15;
    if (_X.eye === 1) _X.eye = 1.12;
  } else if (mode === 'sulk') {
    // a sharp breath in, then a long heavy slump; a shake of the head; and each their own grump
    const style = S.sulk, P = 3.2, u = ((t + seed * 5) / P) % 1;
    const inhale = pulse(0, 0.1, 0.12, 0.4, u);
    const shake = pulse(0.45, 0.5, 0.8, 0.88, u) * Math.sin((u - 0.45) * Math.PI * 2 * 7);
    const deep = style === 'droop' ? 1.35 : style === 'huff' ? 0.25 : style === 'tut' ? 0.45 : style === 'stomp' ? 0.6 : 1;
    torso.rotation.x = S.hunch + (0.44 - 0.2 * inhale) * deep;
    torso.rotation.z = 0.05;
    head.rotation.x = (0.45 - S.hunch * 0.5) * deep - 0.22 * inhale;
    head.rotation.y = 0.3 * shake;
    rig.position.x = 0.015 * Math.sin(t * 0.6);
    for (const L of [legL, legR]) { L.hip.rotation.x = -0.1; L.knee.rotation.x = 0.2; }
    // arms dangle under gravity from the slumped shoulders (shrugging up on the breath)
    for (const [T, arm, s] of [[_tL, armL, 1], [_tR, armR, -1]]) {
      T.copy(arm.shoulder); torsoToRig(torso, T);
      T.x += s * 0.03; T.y -= reach * 0.93 - 0.05 * inhale; T.z += 0.05;
    }
    _pL.set(0.4, 0, -1); _pR.set(-0.4, 0, -1);
    _X.tilt = -0.32; _X.frown = true; _X.open = 0.32; _X.wide = 0.75; _X.eye = 0.62; _X.ly = -0.8; _X.up = 0.003;
    if (style === 'palm') {
      // the facepalm
      const palm = pulse(0.42, 0.52, 0.88, 0.98, u);
      if (palm > 0) {
        _v.set(0.02, 0.18, 0.15); headToRig(head, torso, _v);
        _tL.lerp(_v, palm); _pL.set(1, -0.5, 0.3);
        head.rotation.x += 0.12 * palm; _X.eye = lerp(0.62, 0.1, palm);
      }
    } else if (style === 'tut') {
      // hand on hip, tut-tut-tut
      _tL.set(S.sX + 0.1, S.hipY + 0.06, 0.06); _pL.set(1, 0, -0.3);
      head.rotation.y = 0.22 * Math.sin(t * 9) * pulse(0.4, 0.45, 0.85, 0.9, u);
      _X.tilt = 0.12; _X.frown = true; _X.ly = 0; _X.eye = 0.8;
    } else if (style === 'stomp') {
      // a foot stomped three times, sharp
      const sp = pulse(0.45, 0.47, 0.8, 0.82, u) * Math.max(0, Math.sin((u - 0.45) * Math.PI * 2 * 4.3));
      legL.hip.rotation.x -= 0.55 * sp; legL.knee.rotation.x += 0.9 * sp;
      rig.position.y -= 0.01 * (1 - sp) * pulse(0.45, 0.47, 0.8, 0.82, u);
      _tL.y -= 0.03; _tR.y -= 0.03;
      _X.tilt = 0.22; _X.eye = 0.85;
    } else if (style === 'huff') {
      // chin up, turned away: harrumph
      U._huff = pulse(0.0, 0.08, 0.3, 0.5, u);
      head.rotation.x = -0.25 - 0.1 * U._huff; head.rotation.y = 0.5 + 0.08 * shake;
      _v.set(0.05, 0.1, -0.2); torsoToRig(torso, _v); _tL.copy(_v); _pL.set(1, 0, 0.2);
      _X.tilt = 0.3; _X.frown = true; _X.ly = 0; _X.lx = -1; _X.eye = 0.8;
    } else if (style === 'droop') {
      // the head is very heavy today
      head.rotation.x += 0.1; head.rotation.z = 0.15 * Math.sin(t * 0.9);
      _tL.z += 0.02 * Math.sin(t * 1.6); _tR.z -= 0.02 * Math.sin(t * 1.6);
    }
    // scuffing a toe in the turf
    const sc = (t % 3.6) / 0.7;
    if (sc < 1 && style !== 'stomp') { legL.hip.rotation.x -= 0.3 * Math.sin(sc * Math.PI); legL.knee.rotation.x += 0.25 * Math.sin(sc * Math.PI); }
    feetFlat(legR); legL.ankle.rotation.x = -(legL.hip.rotation.x + legL.knee.rotation.x) * 0.6;
    // the club drags behind on the ground
    const gy = BALL_R * 0.4, dy = _tR.y - gy;
    const back = Math.sqrt(Math.max(0, S.club * S.club - dy * dy));
    _cd.set(-0.05, -dy, -back).normalize();
    _co.copy(_tR).addScaledVector(_cd, -0.04);
    _cf.set(-1, 0, 0);
    orientClub(club, _co, _cd, _cf);
  } else {
    // idle: breathing, a slow weight shift, the odd look around, and a habit
    const w = Math.sin(t * 0.45 + seed * 6);
    const br = Math.sin(t * 1.7 + seed * 3);
    rig.position.x = 0.02 * w;
    rig.rotation.z = -0.02 * w;
    legL.hip.rotation.z += 0.02 * w; legR.hip.rotation.z += 0.02 * w;
    torso.rotation.x = S.hunch + 0.015 * br;
    torso.rotation.z = 0.02 * w;
    const gl = glance(t, seed);
    head.rotation.y = 0.55 * gl;
    head.rotation.x = -S.hunch * 0.85 + 0.03 * Math.sin(t * 0.7);
    _X.lx = gl * 1.1; U._look = gl;
    const style = S.idle;
    if (style === 'lean' || style === 'wave') {
      // leaning on the club, planted out front-right; left hand on the hip
      _cd.set(-0.1, -1, 0.12).normalize(); _cf.set(0, 0, 1);
      _co.set(-(S.sX + 0.17), 0.015, 0.3).addScaledVector(_cd, -S.club);
      orientClub(club, _co, _cd, _cf);
      _tR.copy(_co).addScaledVector(_cd, 0.035);
      _tL.set(S.sX + 0.02, S.hipY + 0.07, 0.07);
      _pL.set(1, 0.1, -0.4); _pR.set(-1, -0.3, -0.6);
      if (style === 'lean') {
        torso.rotation.x = S.hunch - 0.03 + 0.015 * br;   // chest out
        // now and then: a cool tip of the visor and a grin
        const tip = pulse(0, 0.25, 0.9, 1.25, (t + seed * 13) % 7.5);
        if (tip > 0) {
          head.rotation.x += 0.1 * tip * (1 + Math.sin(t * 6) * 0.3); head.rotation.y *= 1 - tip;
          _v.set(0.06, 0.2, 0.17); headToRig(head, torso, _v);
          _tL.lerp(_v, tip); _pL.set(1, -0.1, -0.2);
          _X.open = 0.6 + 0.25 * tip; _X.up = 0.005 * tip;
        }
      }
      if (style === 'wave') {
        const p = (t + seed * 9) % 5.5, up = smooth(0, 0.35, p) * (1 - smooth(2.2, 2.6, p));
        if (up > 0) {
          _v.set(S.sX + 0.28 + 0.1 * Math.sin(t * 9) * up, S.sY + reach * 0.75, 0.12);
          torsoToRig(torso, _v);
          _tL.lerp(_v, up);
          _pL.set(1, -0.4, 0);
          head.rotation.z = 0.12 * up * Math.sin(t * 4.5);
          _X.open = 0.6 + 0.4 * up; _X.up = 0.006 * up;
        } else head.rotation.z = 0.05 * Math.sin(t * 2.1);   // the big head wobbles a bit
      }
    } else if (style === 'cane') {
      // both hands stacked on the club like a walking stick, bent over it, humming
      _cd.set(0, -1, 0.12).normalize(); _cf.set(0, 0, 1);
      _co.set(0.0, 0.015, 0.36).addScaledVector(_cd, -S.club);
      orientClub(club, _co, _cd, _cf);
      _tR.copy(_co).addScaledVector(_cd, 0.06);
      _tL.copy(_co); _tL.y += 0.025; _tL.z -= 0.01;
      _pL.set(1, -0.2, 0); _pR.set(-1, -0.2, 0);
      torso.rotation.x = S.hunch + 0.08 + 0.02 * br;
      torso.rotation.z += 0.035 * Math.sin(t * 2.3);
      head.rotation.x = -(S.hunch + 0.08) * 0.9 + 0.04 * Math.sin(t * 0.7);
      head.rotation.z = 0.09 * Math.sin(t * 2.3 + 0.6);
      // a spry little toe-tap, eyes closed, enjoying the tune
      const tp = (t + 1) % 3.1;
      if (tp < 0.5) { legR.hip.rotation.x = -0.12 * Math.sin(tp / 0.5 * Math.PI * 2) ** 2; legR.knee.rotation.x = 0.2 * Math.sin(tp / 0.5 * Math.PI); }
      const hum = pulse(0, 0.2, 1.6, 1.9, (t + 2.4) % 6.2);
      _X.eye = 1 - 0.75 * hum; _X.open = 0.6 + 0.12 * hum; _X.up = 0.004 * hum;
    } else if (style === 'shoulder') {
      // club over the right shoulder, thumb hooked in the bag strap, can't stand still
      const bob = Math.abs(Math.sin(t * 3.2));
      rig.position.y = 0.015 * bob;
      for (const L of [legL, legR]) { L.ankle.rotation.x = 0.12 * bob; }
      // ...and every few seconds a little hop on the spot
      const hp = (t + seed * 7) % 4.2, hop = hp < 0.36 ? Math.sin(hp / 0.36 * Math.PI) : 0;
      rig.position.y += 0.07 * hop;
      for (const L of [legL, legR]) { L.knee.rotation.x += 0.4 * hop; L.hip.rotation.x -= 0.2 * hop; }
      head.rotation.y = 0.7 * glance(t * 1.7, seed);
      _X.lx = head.rotation.y * 2;
      _tR.set(-S.sX - 0.03, S.sY + 0.02, 0.13);
      handsInTorso = true;
      _tL.set(0.04, S.sY - 0.08, 0.15);
      _pL.set(1, -0.5, 0.2); _pR.set(-1, -0.6, 0); polesInTorso = true;
      _cd.set(-0.18, 0.42, -1).normalize(); dirToRig(torso, _cd);
      _v.copy(_tR); torsoToRig(torso, _v);
      _co.copy(_v).addScaledVector(_cd, -0.06);
      _cf.set(0, 1, 0);
      orientClub(club, _co, _cd, _cf);
      head.rotation.z = 0.08 * Math.sin(t * 1.6);
      _X.open = 0.7 + 0.3 * hop; _X.up = 0.006 * hop;
    } else if (style === 'posh') {
      // chin up, club as a walking stick at arm's length, other hand behind the back
      _cd.set(-0.2, -1, 0.06).normalize(); _cf.set(0, 0, 1);
      _co.set(-(S.sX + 0.2), 0.015, 0.2).addScaledVector(_cd, -S.club);
      orientClub(club, _co, _cd, _cf);
      _tR.copy(_co).addScaledVector(_cd, 0.035);
      _pR.set(-1, -0.3, -0.3);
      // now and then a harrumph: chest puffed, chin snapped up
      const hp = pulse(0, 0.1, 0.5, 0.9, (t + 3) % 5.8);
      U._huff = hp;
      torso.rotation.x = S.hunch + 0.012 * br - 0.07 * hp;
      _v.set(0.05, 0.1, -0.2); torsoToRig(torso, _v); _tL.copy(_v);
      _pL.set(1, 0, 0.2);
      head.rotation.x = -0.18 + 0.03 * Math.sin(t * 0.7) - 0.12 * hp;
      _X.open = 0.45; _X.wide = 0.8; _X.tilt = 0.06 * hp; _X.up = -0.002;
    }
  }

  // keep the planted foot on the ground
  if (liftFix) rig.position.y -= Math.min(legLift(S, legL), legLift(S, legR));

  if (!handsInTorso) { rigToTorso(torso, _tL); rigToTorso(torso, _tR); }
  if (!polesInTorso) { dirToTorso(torso, _pL); dirToTorso(torso, _pR); }
  solveArm(armL, _tL, _pL); solveArm(armR, _tR, _pR);

  U.hips.rotation.set(torso.rotation.x * 0.3, torso.rotation.y * 0.45, torso.rotation.z * 0.5);
  animateFace(U, t, seed);
  if (U.extra) U.extra(U, t, mode, ph, speed);
  U._lastT = t;
}

// ---------------------------------------------------------------- portraits
// A small transparent PNG data URL of the character's head and shoulders, for
// the character-select card. Uses one short-lived offscreen renderer.
let _pr = null, _prTimer = 0;
const PORTRAIT = { pro: [1.4, 0.08], birdie: [1.7, 0.1], kid: [1.65, 0.16], bogey: [1.35, 0.1], mascot: [2.25, 0.2] };   // camera distance, aim above the neck
export function buildGolferPortrait(id, { size = 192, tint } = {}) {
  if (!_pr) {
    const c = document.createElement('canvas');
    _pr = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: true });
    _pr.toneMapping = THREE.ACESFilmicToneMapping; _pr.toneMappingExposure = 1.05;
  }
  clearTimeout(_prTimer);
  _prTimer = setTimeout(() => { _pr?.dispose(); _pr?.forceContextLoss(); _pr = null; }, 2000);
  _pr.setPixelRatio(1); _pr.setSize(size, size, false);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff0dc, 0x6a5a70, 1.4));
  const key = new THREE.DirectionalLight(0xffd9a8, 2.4); key.position.set(1.5, 2, 3); scene.add(key);
  const g = buildGolfer(id, tint); scene.add(g);
  animateGolfer(g, 0, { mode: 'idle' });
  // face the camera, eyes on the viewer, no blink
  const U = g.userData; U.head.rotation.y = 0.12;
  if (U.face.eyes) { U.face.eyes.scale.y = 1; U.face.pupils.position.set(U.face.look * 0.6, 0, 0); }
  if (U.face.blinkers) for (const m of U.face.blinkers) m.scale.y = 1;
  g.updateMatrixWorld(true);
  const P = PORTRAIT[g.userData.id];
  const c = g.userData.head.getWorldPosition(new THREE.Vector3()); c.y += P[1];
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 20);
  const dist = P[0];
  cam.position.set(c.x + dist * 0.28, c.y + dist * 0.1, c.z + dist * 0.95); cam.lookAt(c);
  _pr.setClearColor(0x000000, 0);
  _pr.render(scene, cam);
  const url = _pr.domElement.toDataURL('image/png');
  g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); } });
  return url;
}
