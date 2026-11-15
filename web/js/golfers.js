// Golfers: the five selectable player characters. Procedural low-poly like the
// rest of the scene (primitives only, no asset files), solid and opaque.
//
// Space: origin at the feet, facing +Z. In 'swing' mode the rig turns side-on
// (like Old Tom) so the shot flies toward group +Z and the ball sits at
// g.userData.swingBall: stand them at a ball with golferAddress(). Every
// character shares one rig (two-bone IK arms, hinged legs) and one animator;
// only proportions, costume and a few personality numbers differ.

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
const SPECS = {
  pro: {
    hipY: 0.95, sY: 0.48, sX: 0.205, legGap: 0.095, UA: 0.3, FA: 0.29, neck: 0.07, headS: 1.0,
    tilt: 0.45, club: 0.95, hunch: -0.05, stance: 0.075, jump: 0.17, idle: 'lean',
    run: { lean: 0.3, stride: 1, cad: 1, bounce: 0.07, arm: 1, sway: 0, knee: 1 },
  },
  birdie: {
    hipY: 0.6, sY: 0.36, sX: 0.15, legGap: 0.065, UA: 0.235, FA: 0.225, neck: 0.04, headS: 1.08,
    tilt: 0.42, club: 0.8, hunch: 0.4, stance: 0.03, jump: 0.09, idle: 'cane',
    run: { lean: 0.12, stride: 0.62, cad: 1.5, bounce: 0.05, arm: 0.55, sway: 0.06, knee: 0.8, tuck: 0.12 },
  },
  kid: {
    hipY: 0.54, sY: 0.3, sX: 0.15, legGap: 0.072, UA: 0.205, FA: 0.195, neck: 0.04, headS: 1.4,
    tilt: 0.36, club: 0.66, hunch: 0, stance: 0.05, jump: 0.24, idle: 'shoulder',
    run: { lean: 0.22, stride: 1.12, cad: 1.28, bounce: 0.1, arm: 1.15, sway: 0, knee: 1.1 },
  },
  bogey: {
    hipY: 1.02, sY: 0.54, sX: 0.17, legGap: 0.08, UA: 0.34, FA: 0.33, neck: 0.12, headS: 1.1,
    tilt: 0.55, club: 1.02, hunch: -0.06, stance: 0.04, jump: 0.11, idle: 'posh',
    run: { lean: -0.1, stride: 1.2, cad: 0.82, bounce: 0.07, arm: 0.75, sway: 0, knee: 1.55 },
  },
  mascot: {
    hipY: 0.8, sY: 0.41, sX: 0.2, legGap: 0.1, UA: 0.28, FA: 0.27, neck: 0.01, headS: 1.0,
    tilt: 0.4, club: 0.9, hunch: 0, stance: 0.09, jump: 0.28, idle: 'wave',
    run: { lean: 0.16, stride: 0.85, cad: 1.12, bounce: 0.09, arm: 1.35, sway: 0.15, knee: 1, out: 0.1 },
  },
};
const FOOT_H = 0.06;
const BAG_Z = -0.5;           // the kid's bag rides diagonally, top over the left shoulder
for (const S of Object.values(SPECS)) { S.TL = S.SL = (S.hipY - FOOT_H) / 2; }

// ---------------------------------------------------------------- helpers
function mat(color, { rough = 0.8, metal = 0, glow = 0.12, flat = false, side, map } = {}) {
  const c = new THREE.Color(color);
  const m = new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal, emissive: c.clone().multiplyScalar(glow), flatShading: flat, map: map || null });
  if (side) m.side = side;
  return m;
}
const V2 = pts => pts.map(p => new THREE.Vector2(p[0], p[1]));
const sph = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);
const cap = (r, len, rs = 8) => new THREE.CapsuleGeometry(r, len, 2, rs);
function mesh(geo, m, parent, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, m); o.position.set(x, y, z);
  if (parent) parent.add(o);
  return o;
}

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

// A half-torus: rotation.z = PI is a smile, 0 a frown / handlebar.
const arc = (r, tube) => new THREE.TorusGeometry(r, tube, 4, 10, Math.PI);

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
    const shin = mesh(look.shinGeo, M.shin, knee, 0, -S.SL / 2, 0);
    const ankle = new THREE.Group(); ankle.position.y = -S.SL; knee.add(ankle);
    const shoe = mesh(look.shoeGeo, M.shoe, ankle, 0, -FOOT_H / 2, look.shoeZ ?? 0.045);
    legs[key] = { hip, knee, ankle, thigh, shin, shoe };
  }

  // torso pivots at the hips
  const torso = new THREE.Group(); torso.position.y = S.hipY; rig.add(torso);
  const chest = mesh(new THREE.LatheGeometry(V2(look.torso), 12), M.shirt, torso);
  chest.scale.z = look.torsoZ ?? 0.78;
  // hips (pants / skirt) follow the torso only partly, so a hunch doesn't tip the skirt
  const hips = new THREE.Group(); hips.position.y = S.hipY; rig.add(hips);
  const pelvis = look.pelvisGeo ? mesh(look.pelvisGeo, M.pelvis ?? M.thigh, hips, 0, look.pelvisY ?? 0, 0) : null;
  if (pelvis && look.pelvisScale) pelvis.scale.set(...look.pelvisScale);
  const neck = S.neck > 0.02 ? mesh(new THREE.CylinderGeometry(0.045, 0.05, S.neck + 0.06, 8), M.skin, torso, 0, S.sY + S.neck / 2, 0) : null;

  // arms: two capsules each, solved to the hands every frame
  const mkArm = (s, handMat) => {
    const up = mesh(cap(look.armR ?? 0.045, S.UA), M.sleeve, torso);
    const fo = mesh(cap(look.foR ?? 0.038, S.FA), M.forearm ?? M.sleeve, torso);
    const hand = mesh(sph(look.handR ?? 0.046, 8, 6), handMat, torso);
    return { up, fo, hand, UA: S.UA, FA: S.FA, shoulder: new THREE.Vector3(s * S.sX, S.sY, 0) };
  };
  const armL = mkArm(1, M.handL ?? M.hand), armR = mkArm(-1, M.hand);

  // head: pivot at the top of the neck
  const head = new THREE.Group(); head.position.set(0, S.sY + S.neck, 0.01); head.scale.setScalar(S.headS); torso.add(head);

  // the club: pivot = top of the grip, shaft along -Y, iron head at -club
  const club = new THREE.Group(); rig.add(club);
  mesh(new THREE.CylinderGeometry(0.017, 0.015, 0.24, 8), M.grip, club, 0, -0.12, 0);
  mesh(new THREE.CylinderGeometry(0.008, 0.009, S.club - 0.24, 6), M.steel, club, 0, -0.24 - (S.club - 0.24) / 2, 0);
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

// ---------------------------------------------------------------- characters
function headBasics(head, M, { skullY = 0.12, eyeY = 0.14, eyeX = 0.042, mouthY = 0.075, nose = true, ears = true } = {}) {
  const skull = mesh(sph(0.115, 14, 10), M.skin, head, 0, skullY, 0); skull.scale.set(0.95, 1.05, 1);
  const eyeGeo = sph(0.016, 8, 6);
  const eyeL = mesh(eyeGeo, M.dark, head, eyeX, eyeY, 0.1);
  const eyeR = mesh(eyeGeo, M.dark, head, -eyeX, eyeY, 0.1);
  const mouth = mesh(arc(0.03, 0.007), M.mouth, head, 0, mouthY, 0.098); mouth.rotation.z = Math.PI;
  const out = { skull, eyeL, eyeR, mouth, mouthY };
  if (nose) { out.nose = mesh(sph(0.026, 8, 6), M.skin, head, 0, skullY - 0.005, 0.115); out.nose.scale.set(0.9, 1, 1.1); }
  if (ears) {
    const earGeo = sph(0.03, 8, 6);
    out.earL = mesh(earGeo, M.skin, head, 0.108, skullY, -0.005); out.earL.scale.set(0.45, 1, 0.8);
    out.earR = mesh(earGeo, M.skin, head, -0.108, skullY, -0.005); out.earR.scale.set(0.45, 1, 0.8);
  }
  return out;
}

const BUILDERS = {
  // The Pro: visor, polo, slacks, shades, a glove. Tint: the polo.
  pro(S, tint) {
    const M = {
      skin: mat(0x9a6440), hand: mat(0x9a6440), handL: mat(0xf6f3ea), shirt: mat(tint ?? 0x2f86d6), sleeve: null,
      thigh: mat(0x37415e), shin: mat(0x37415e), shoe: mat(0xf4f2ec, { rough: 0.5 }), white: mat(0xf8f8f4, { side: THREE.DoubleSide }),
      hair: mat(0x24170f), dark: mat(0x1a1410, { glow: 0 }), mouth: mat(0x3a1a12, { glow: 0 }), shades: mat(0x15181e, { rough: 0.2, metal: 0.6, glow: 0 }),
      belt: mat(0x1e1e22), grip: mat(0x1d1d22, { rough: 0.9 }), steel: mat(0xc8ccd2, { rough: 0.3, metal: 0.8, glow: 0.05 }),
    };
    M.sleeve = M.shirt; M.forearm = M.skin;
    const look = {
      torso: [[0.001, -0.08], [0.15, -0.07], [0.158, 0.05], [0.172, 0.2], [0.205, 0.36], [0.2, 0.45], [0.15, 0.52], [0.06, 0.55], [0.001, 0.555]],
      torsoZ: 0.72, armR: 0.05, foR: 0.04,
      thighGeo: cap(0.078, S.TL - 0.04), shinGeo: cap(0.064, S.SL - 0.06),
      shoeGeo: (() => { const s = sph(0.06, 10, 6); s.scale(0.95, 0.55, 1.75); return s; })(),
      pelvisGeo: sph(0.17, 12, 8), pelvisScale: [1, 0.55, 0.82], pelvisY: -0.02,
    };
    const R = buildRig(S, M, look);
    const H = headBasics(R.head, M);
    // a crop of hair, then the visor over it: open band + forward brim
    const hair = mesh(sph(0.12, 12, 8), M.hair, R.head, 0, 0.15, -0.012); hair.scale.set(1, 0.72, 1.02);
    const visor = new THREE.Group(); visor.position.set(0, 0.205, 0.004); visor.rotation.x = 0.1; R.head.add(visor);
    mesh(new THREE.CylinderGeometry(0.112, 0.118, 0.036, 16, 1, true), M.white, visor);
    const brim = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.01, 14, 1, false, -Math.PI / 2, Math.PI), M.white, visor, 0, -0.012, 0.085);
    brim.scale.z = 0.95; brim.rotation.x = 0.2;
    const shades = mesh(new THREE.BoxGeometry(0.15, 0.036, 0.025), M.shades, R.head, 0, 0.143, 0.104);
    H.mouthS = 1.3; H.eyeL.visible = H.eyeR.visible = false;   // shades on; a big grin
    // polo collar and belt
    const collar = mesh(new THREE.TorusGeometry(0.068, 0.02, 5, 12), M.white, R.torso, 0, S.sY + 0.06, 0.005); collar.rotation.x = Math.PI / 2 + 0.25;
    const belt = mesh(new THREE.CylinderGeometry(0.162, 0.162, 0.045, 12), M.belt, R.torso, 0, 0.015, 0); belt.scale.z = 0.8;
    return { R, M, H, parts: { visor, brim, shades, hair, collar, belt }, extra: null };
  },

  // Grandma Birdie: sun hat with a flower, cardigan, glasses, a bun. Tint: the cardigan.
  birdie(S, tint) {
    const M = {
      skin: mat(0xf2cdb0), hand: mat(0xf2cdb0), shirt: mat(tint ?? 0xc36fae), sleeve: null,
      thigh: mat(0xd9b49a), shin: mat(0xd9b49a), shoe: mat(0x5b3a2c), pelvis: mat(0x55607e),
      dark: mat(0x241a18, { glow: 0 }), mouth: mat(0x7a2c34, { glow: 0 }), hair: mat(0xeceaf2, { glow: 0.2 }),
      straw: mat(0xf0d68c, { glow: 0.16 }), ribbon: mat(0x6fb2e6), petal: mat(0xff7aa0, { glow: 0.2 }), yolk: mat(0xffd23f, { glow: 0.2 }),
      specs: mat(0x8a2b45, { rough: 0.4 }), button: mat(0xf7f1e3),
      grip: mat(0x6a3e22, { rough: 0.9 }), steel: mat(0xc8ccd2, { rough: 0.3, metal: 0.8, glow: 0.05 }),
    };
    M.sleeve = M.shirt;
    const look = {
      torso: [[0.001, -0.06], [0.16, -0.05], [0.185, 0.06], [0.18, 0.18], [0.165, 0.28], [0.13, 0.355], [0.06, 0.4], [0.001, 0.41]],
      torsoZ: 0.85, armR: 0.042, foR: 0.035, handR: 0.038,
      thighGeo: cap(0.04, S.TL - 0.02), shinGeo: cap(0.034, S.SL - 0.03),
      shoeGeo: (() => { const s = sph(0.05, 10, 6); s.scale(0.9, 0.6, 1.5); return s; })(),
      // A-line skirt from the waist to below the knee
      pelvisGeo: new THREE.CylinderGeometry(0.15, 0.225, 0.4, 12), pelvisY: -0.17, pelvisScale: [1, 1, 0.85],
    };
    const R = buildRig(S, M, look);
    const H = headBasics(R.head, M, { ears: false });
    // silver hair puffing out under the hat, a bun behind
    const hair = mesh(sph(0.122, 12, 8), M.hair, R.head, 0, 0.15, -0.025); hair.scale.set(1.05, 0.7, 1.02);
    const bun = mesh(sph(0.055, 8, 6), M.hair, R.head, 0, 0.16, -0.125);
    // glasses
    const ring = new THREE.TorusGeometry(0.026, 0.0055, 4, 12);
    const glassL = mesh(ring, M.specs, R.head, 0.042, 0.14, 0.108);
    const glassR = mesh(ring, M.specs, R.head, -0.042, 0.14, 0.108);
    // the sun hat, tipped back a touch, flower on the side
    const hat = new THREE.Group(); hat.position.set(0, 0.215, -0.01); hat.rotation.x = -0.12; R.head.add(hat);
    const brim = mesh(new THREE.CylinderGeometry(0.25, 0.26, 0.012, 18), M.straw, hat);
    const crown = mesh(sph(0.118, 14, 8, ), M.straw, hat, 0, 0.0, 0); crown.scale.set(1, 0.78, 1);
    const band = mesh(new THREE.CylinderGeometry(0.121, 0.121, 0.032, 14), M.ribbon, hat, 0, 0.022, 0);
    const flower = new THREE.Group(); flower.position.set(0.1, 0.045, 0.06); flower.rotation.set(0.3, 0.9, -0.3); hat.add(flower);
    mesh(sph(0.022, 8, 6), M.yolk, flower, 0, 0, 0.012);
    const petGeo = sph(0.028, 8, 6);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; const p = mesh(petGeo, M.petal, flower, Math.cos(a) * 0.03, Math.sin(a) * 0.03, 0); p.scale.set(1, 1, 0.45); }
    // two cardigan buttons
    mesh(sph(0.013, 6, 4), M.button, R.torso, 0, 0.27, 0.115);
    mesh(sph(0.013, 6, 4), M.button, R.torso, 0, 0.17, 0.142);
    const extra = (U, t, mode, ph) => {
      // the flower nods along with her
      flower.rotation.z = -0.3 + (mode === 'run' ? 0.25 * Math.sin(ph * 2) : 0.08 * Math.sin(t * 1.3));
    };
    return { R, M, H, parts: { hat, brim, crown, band, flower, hair, bun, glassL, glassR }, extra };
  },

  // The Caddie Kid: big head, backwards cap, baggy shorts, and a bag bigger than them.
  // Tint: the cap and the bag.
  kid(S, tint) {
    const t = tint ?? 0xe8473a;
    const M = {
      skin: mat(0xd99a6c), hand: mat(0xd99a6c), shirt: mat(0xffc93c, { glow: 0.14 }), sleeve: null,
      thigh: mat(0x4a7cc0), shin: mat(0xd99a6c), shoe: mat(0xf2f2f2, { rough: 0.6 }), pelvis: mat(0x4a7cc0),
      dark: mat(0x1d1512, { glow: 0 }), mouth: mat(0x5a1f1a, { glow: 0 }), hair: mat(0xd2672a), cap: mat(t), bag: mat(t, { rough: 0.6 }),
      bagTrim: mat(0xf4f1ea), bagBase: mat(0x2a2a30), pomA: mat(0x3fa7ff, { glow: 0.2 }), pomB: mat(0xffe14d, { glow: 0.2 }), pomC: mat(0x43c06a, { glow: 0.2 }),
      grip: mat(0x1d1d22, { rough: 0.9 }), steel: mat(0xc8ccd2, { rough: 0.3, metal: 0.8, glow: 0.05 }),
    };
    M.sleeve = M.shirt; M.forearm = M.skin;
    const look = {
      torso: [[0.001, -0.06], [0.135, -0.05], [0.145, 0.08], [0.145, 0.2], [0.14, 0.27], [0.1, 0.33], [0.05, 0.355], [0.001, 0.36]],
      torsoZ: 0.8, armR: 0.045, foR: 0.032, handR: 0.038,
      thighGeo: new THREE.CylinderGeometry(0.068, 0.08, S.TL + 0.04, 10), shinGeo: cap(0.036, S.SL - 0.03),
      shoeGeo: (() => { const s = sph(0.068, 10, 6); s.scale(1, 0.62, 1.55); return s; })(), shoeZ: 0.035,
      pelvisGeo: sph(0.15, 12, 8), pelvisScale: [1, 0.55, 0.82], pelvisY: -0.02,
    };
    const R = buildRig(S, M, look);
    const H = headBasics(R.head, M, { eyeY: 0.135, eyeX: 0.045 });
    H.earL.scale.set(0.5, 1.15, 0.9); H.earR.scale.set(0.5, 1.15, 0.9);
    // backwards cap: crown, brim off the back, and a ginger tuft through the strap gap
    const capG = new THREE.Group(); capG.position.set(0, 0.165, 0); capG.rotation.x = -0.12; R.head.add(capG);
    const crown = mesh(new THREE.SphereGeometry(0.128, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), M.cap, capG); crown.scale.set(1.04, 0.72, 1.08);
    const brim = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.012, 14, 1, false, Math.PI / 2, Math.PI), M.cap, capG, 0, 0.004, -0.085);
    brim.rotation.x = -0.15;
    const tuft = mesh(sph(0.045, 8, 6), M.hair, R.head, 0, 0.215, 0.085); tuft.scale.set(1.2, 0.6, 0.8);
    // THE BAG: on the back, taller than its owner, pom-pom headcovers on top
    const bag = new THREE.Group(); bag.position.set(-0.05, 0.3, -0.25); bag.rotation.set(-0.14, 0, BAG_Z); R.torso.add(bag);
    mesh(new THREE.CylinderGeometry(0.15, 0.14, 1.12, 12), M.bag, bag);
    mesh(new THREE.CylinderGeometry(0.157, 0.157, 0.1, 12), M.bagTrim, bag, 0, 0.5, 0);
    mesh(new THREE.CylinderGeometry(0.147, 0.147, 0.09, 12), M.bagBase, bag, 0, -0.53, 0);
    const pocket = mesh(new THREE.BoxGeometry(0.15, 0.36, 0.06), M.bagTrim, bag, 0, -0.12, -0.14);
    const poms = [];
    for (const [x, y, z, m] of [[0.05, 0.62, 0.04, M.pomA], [-0.06, 0.64, 0.02, M.pomB], [0.0, 0.6, -0.07, M.pomC]]) { poms.push(mesh(sph(0.075, 10, 8), m, bag, x, y, z)); }
    // the strap across the chest
    const strap = mesh(new THREE.BoxGeometry(0.045, 0.5, 0.02), M.bagBase, R.torso, 0.005, 0.18, 0.12); strap.rotation.z = 0.62;
    strap.rotation.x = -0.12;
    const extra = (U, t, mode, ph) => {
      // the bag lags and bounces behind the kid
      if (mode === 'run') { bag.rotation.z = BAG_Z + 0.1 * Math.sin(ph); bag.rotation.x = -0.22 - 0.06 * Math.abs(Math.cos(ph)); }
      else { bag.rotation.z = BAG_Z; bag.rotation.x = -0.14; }
      for (let i = 0; i < 3; i++) poms[i].position.y = 0.6 + [0.02, 0.04, 0][i] + (mode === 'run' ? 0.02 * Math.sin(ph * 2 + i) : 0);
    };
    return { R, M, H, parts: { cap: capG, capBrim: brim, tuft, bag, pocket, poms, strap }, extra };
  },

  // Sir Bogey: tall and lanky; tweed cap, plus-fours, argyle socks, a long scarf, a monocle.
  // Tint: the scarf.
  bogey(S, tint) {
    const M = {
      skin: mat(0xf4cbb6), hand: mat(0xf4cbb6), shirt: mat(0x7d5b3d), sleeve: null, nose: mat(0xeea08a),
      thigh: mat(0xc2a66c), shin: mat(0xffffff, { map: argyle(), glow: 0.1 }), shoe: mat(0x5a3320, { rough: 0.5 }), pelvis: mat(0xc2a66c),
      dark: mat(0x1d1512, { glow: 0 }), mouth: mat(0x6a2a2a, { glow: 0 }), hair: mat(0x8a8580), tash: mat(0x6b625c), fringe: mat(0xbdb6ae),
      cap: mat(0x8a6c48), scarf: mat(tint ?? 0xc8323c), gold: mat(0xe0b74a, { rough: 0.3, metal: 0.7, glow: 0.15 }),
      glass: mat(0xcfe8ff, { rough: 0.05, metal: 0.2, glow: 0.35 }),
      grip: mat(0x6a3e22, { rough: 0.9 }), steel: mat(0xc8ccd2, { rough: 0.3, metal: 0.8, glow: 0.05 }),
    };
    M.sleeve = M.shirt;
    const kTop = S.TL;
    const look = {
      torso: [[0.001, -0.07], [0.13, -0.06], [0.132, 0.1], [0.138, 0.28], [0.158, 0.44], [0.15, 0.52], [0.1, 0.58], [0.04, 0.6], [0.001, 0.605]],
      torsoZ: 0.74, armR: 0.042, foR: 0.036, handR: 0.042,
      // plus-fours: baggy breeches ballooning over the knee
      thighGeo: (() => { const l = new THREE.LatheGeometry(V2([[0.001, -kTop / 2 - 0.12], [0.045, -kTop / 2 - 0.115], [0.082, -kTop / 2 - 0.07], [0.092, -kTop / 2 + 0.02], [0.08, 0], [0.07, kTop / 2], [0.072, kTop / 2 + 0.03], [0.001, kTop / 2 + 0.04]]), 10); return l; })(),
      shinGeo: cap(0.04, S.SL - 0.04),
      shoeGeo: (() => { const s = sph(0.06, 10, 6); s.scale(0.85, 0.5, 2.05); return s; })(), shoeZ: 0.06,
      pelvisGeo: sph(0.14, 12, 8), pelvisScale: [1, 0.6, 0.85], pelvisY: -0.01,
    };
    const R = buildRig(S, M, look);
    const H = headBasics(R.head, M, { skullY: 0.13, eyeY: 0.15 });
    H.skull.scale.set(0.88, 1.15, 0.98);
    // a long aristocratic nose
    H.nose.geometry.dispose(); H.nose.geometry = new THREE.ConeGeometry(0.024, 0.1, 8); H.nose.material = M.nose;
    H.nose.rotation.x = Math.PI / 2 + 0.12; H.nose.position.set(0, 0.125, 0.155); H.nose.scale.set(1, 1, 1);
    // a grey fringe round the back of the head
    const fringe = mesh(sph(0.112, 12, 8), M.fringe, R.head, 0, 0.115, -0.03); fringe.scale.set(0.98, 0.7, 0.95);
    // handlebar moustache, bushy brows (one permanently raised over the monocle)
    const tash = mesh(new THREE.TorusGeometry(0.058, 0.014, 4, 12, Math.PI), M.tash, R.head, 0, 0.1, 0.112); tash.scale.set(1, 0.5, 1);
    const browGeo = cap(0.012, 0.04, 6);
    const browL = mesh(browGeo, M.hair, R.head, 0.044, 0.178, 0.104); browL.rotation.z = Math.PI / 2 - 0.15;
    const browR = mesh(browGeo, M.hair, R.head, -0.044, 0.192, 0.1); browR.rotation.z = Math.PI / 2 + 0.3;
    // monocle on his right eye
    const monocle = new THREE.Group(); monocle.position.set(-0.044, 0.15, 0.112); R.head.add(monocle);
    mesh(new THREE.TorusGeometry(0.028, 0.006, 4, 14), M.gold, monocle);
    const lens = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.003, 12), M.glass, monocle); lens.rotation.x = Math.PI / 2;
    // tweed flat cap
    const capG = new THREE.Group(); capG.position.set(0, 0.2, -0.005); capG.rotation.x = 0.12; R.head.add(capG);
    const crown = mesh(new THREE.SphereGeometry(0.13, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), M.cap, capG, 0, 0, 0.012); crown.scale.set(1.02, 0.48, 1.12);
    const brim = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.012, 14, 1, false, -Math.PI / 2, Math.PI), M.cap, capG, 0, 0.004, 0.08); brim.rotation.x = 0.14;
    // the scarf: a wrap round the neck, one tail down the front, one long tail down the back
    const wrap = mesh(new THREE.TorusGeometry(0.068, 0.034, 6, 12), M.scarf, R.torso, 0, S.sY + 0.05, 0); wrap.rotation.x = Math.PI / 2;
    const tailF = new THREE.Group(); tailF.position.set(0.05, S.sY + 0.04, 0.07); R.torso.add(tailF);
    const tailFm = mesh(new THREE.BoxGeometry(0.075, 0.42, 0.022), M.scarf, tailF, 0, -0.21, 0);
    const tailB = new THREE.Group(); tailB.position.set(-0.04, S.sY + 0.06, -0.07); R.torso.add(tailB);
    const tailBm = mesh(new THREE.BoxGeometry(0.09, 0.62, 0.03), M.scarf, tailB, 0, -0.31, 0);
    const extra = (U, t, mode, ph, speed) => {
      // the back tail streams out behind when he runs, droops when he sulks
      if (mode === 'run') {
        const lift = Math.min(1.1, 0.45 + 0.06 * speed);
        tailB.rotation.set(lift + 0.18 * Math.sin(ph * 2 + 1), 0.25 * Math.sin(ph * 2), 0.35 + 0.15 * Math.sin(ph * 4));
        tailF.rotation.set(0.5 + 0.15 * Math.sin(ph * 2), 0, 0.2 * Math.sin(ph));
      } else if (mode === 'cheer') {
        tailB.rotation.set(0.35 + 0.25 * Math.sin(t * 5.5), 0, 0); tailF.rotation.set(-0.15 + 0.15 * Math.sin(t * 5.5), 0, 0);
      } else {
        tailB.rotation.set(0.12 + 0.03 * Math.sin(t * 1.1), 0, 0.03 * Math.sin(t * 0.7));
        tailF.rotation.set(-0.12 + 0.02 * Math.sin(t * 1.3), 0, 0.02 * Math.sin(t * 0.9));
      }
      if (mode === 'swing') { tailF.rotation.set(-0.35, 0, 0); }
      // monocle-side brow: raised, and it twitches up in disdain now and then
      const tw = (t % 4.3) < 0.3 ? Math.sin((t % 4.3) / 0.3 * Math.PI) : 0;
      browR.position.y = (mode === 'sulk' ? 0.18 : 0.192) + 0.012 * tw;
    };
    return { R, M, H, parts: { cap: capG, capBrim: brim, monocle, tash, browL, browR, scarf: wrap, scarfTailF: tailF, scarfTailB: tailB, scarfTailFMesh: tailFm, scarfTailBMesh: tailBm }, extra };
  },

  // The Mascot: a person in a giant golf-ball head with googly eyes. Tint: the jersey.
  mascot(S, tint) {
    const M = {
      skin: mat(0xc98e66), hand: mat(0xffffff, { glow: 0.16 }), shirt: mat(tint ?? 0xf26b2a), sleeve: null,
      thigh: mat(0x2e3550), shin: mat(0xf6f6f6), shoe: mat(0xe23b3b, { rough: 0.5 }), pelvis: mat(0x2e3550),
      ball: mat(0xfbfaf6, { flat: true, rough: 0.55, glow: 0.18 }), white: mat(0xffffff, { glow: 0.25 }), dark: mat(0x111111, { glow: 0 }),
      mouth: mat(0x2a1414, { glow: 0 }), brow: mat(0x333333, { glow: 0 }),
      grip: mat(0x1d1d22, { rough: 0.9 }), steel: mat(0xc8ccd2, { rough: 0.3, metal: 0.8, glow: 0.05 }),
    };
    M.sleeve = M.shirt; M.forearm = M.skin;
    const look = {
      torso: [[0.001, -0.07], [0.17, -0.06], [0.21, 0.08], [0.215, 0.2], [0.2, 0.32], [0.16, 0.4], [0.07, 0.445], [0.001, 0.45]],
      torsoZ: 0.85, armR: 0.052, foR: 0.04, handR: 0.068,
      thighGeo: cap(0.085, S.TL - 0.06), shinGeo: cap(0.055, S.SL - 0.05),
      shoeGeo: (() => { const s = sph(0.085, 10, 6); s.scale(1, 0.55, 1.55); return s; })(), shoeZ: 0.06,
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
    const mouth = mesh(new THREE.TorusGeometry(0.12, 0.02, 5, 14, Math.PI), M.mouth, R.head, 0, HY - 0.05, 0.292); mouth.rotation.z = Math.PI; mouth.rotation.x = 0.1;
    const browGeo = cap(0.016, 0.07, 6);
    const browL = mesh(browGeo, M.brow, R.head, 0.12, HY + 0.2, 0.25); browL.rotation.set(-0.5, 0, Math.PI / 2 - 0.15);
    const browR = mesh(browGeo, M.brow, R.head, -0.12, HY + 0.2, 0.25); browR.rotation.set(-0.5, 0, Math.PI / 2 + 0.15);
    const H = { mouthOpen: 1.5, skull: ball, eyeL, eyeR, mouth, mouthY: HY - 0.05, pupilL: pupL, pupilR: pupR, browL, browR };
    // a white chest disc, like a team crest
    const crest = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.01, 14), M.white, R.torso, 0, 0.27, 0.165); crest.rotation.x = Math.PI / 2 - 0.25;
    const extra = (U, t, mode, ph, speed) => {
      // googly pupils: rattle when moving, drift when idle, droop when sulking
      const moving = mode === 'run' || mode === 'cheer' || (mode === 'swing' && U._swingK > 0.5 && U._swingK < 0.8);
      for (const [p, sx] of [[pupL, 1], [pupR, -1]]) {
        const k = moving ? t * 23 + sx * 2.1 : t * 0.7 + sx * 0.4, a = moving ? 0.03 : 0.012;
        let ox = Math.sin(k) * a, oy = Math.cos(k * 1.3) * a;
        if (mode === 'sulk') oy -= 0.035;
        if (mode === 'swing') { ox += -0.02; oy -= 0.03; }   // eye on the ball
        p.position.set(sx * 0.12 + ox, HY + 0.08 + oy, 0.315);
      }
      const sad = mode === 'sulk' ? 1 : 0, glee = mode === 'cheer' ? 1 : 0;
      browL.rotation.z = Math.PI / 2 - 0.15 - 0.45 * sad + 0.2 * glee; browR.rotation.z = Math.PI / 2 + 0.15 + 0.45 * sad - 0.2 * glee;
      browL.position.y = browR.position.y = HY + 0.2 + 0.03 * glee;
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
  const sw = swingGeom(S);
  g.userData = {
    id: key, spec: S, rig: R.rig, body: R.torso, torso: R.torso, hips: R.hips, chest: R.chest, pelvis: R.pelvis, neck: R.neck,
    head: R.head, ...H, ...parts,
    armL: R.armL, armR: R.armR, handL: R.armL.hand, handR: R.armR.hand,
    legL: R.legL, legR: R.legR, club: R.club, clubHead: R.clubHead,
    materials: M, extra, sw, swingBall: sw.ball.clone(), impactK: GOLFER_IMPACT,
    _phase: 0, _lastT: null, _swingK: 0,
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

// state: { mode: 'idle' } | { mode: 'run', speed } | { mode: 'swing', k } | { mode: 'cheer' } | { mode: 'sulk' }
export function animateGolfer(g, t, state = { mode: 'idle' }) {
  const U = g.userData, S = U.spec;
  const { rig, torso, head, legL, legR, armL, armR, club } = U;
  const mode = state?.mode ?? 'idle';
  const reach = S.UA + S.FA;
  const seed = { pro: 0.1, birdie: 0.35, kid: 0.6, bogey: 0.8, mascot: 0.2 }[U.id] ?? 0;

  // defaults; each mode overrides what it needs
  rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0);
  torso.rotation.set(S.hunch, 0, 0);
  head.rotation.set(-S.hunch * 0.85, 0, 0);
  for (const [L, s] of [[legL, 1], [legR, -1]]) { L.hip.rotation.set(0, 0, s * S.stance); L.knee.rotation.set(0, 0, 0); L.ankle.rotation.set(0, 0, 0); }
  const mouth = U.mouth, mS = U.mouthS ?? 1; mouth.rotation.z = Math.PI; mouth.scale.set(mS, 1, 1); mouth.position.y = U.mouthY;
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
    legR.knee.rotation.x += 0.55 * f; legR.hip.rotation.x -= 0.1 * f; legR.hip.rotation.y = -0.5 * f;
    const drop = legLift(S, legL);
    rig.position.y = -drop;
    feetFlat(legL); feetFlat(legR, 0.4);
    liftFix = false;
    const turn = a > 0 ? -1.25 * (a / A_TOP) : 1.5 * (a / A_FIN);
    torso.rotation.x = lerp(S.tilt, 0.1, smooth(GOLFER_IMPACT, 0.85, k));
    torso.rotation.y = turn;
    torso.rotation.z = a > 0 ? 0.1 * (a / A_TOP) : -0.18 * (a / A_FIN);
    head.rotation.y = -turn * 0.8 * (1 - f) + 0.25 * f;
    head.rotation.x = lerp(0.22, -0.15, f);
    const b = a + h;
    _co.copy(W.Sc).addScaledVector(W.D, W.HR * Math.cos(a)).addScaledVector(W.B, W.HR * Math.sin(a));
    _cd.copy(W.D).multiplyScalar(Math.cos(b)).addScaledVector(W.B, Math.sin(b));
    _cf.copy(W.D).multiplyScalar(Math.sin(b)).addScaledVector(W.B, -Math.cos(b));
    _co.x -= shift; _co.y += drop;                       // hands stay on the arc to the ball, not the weight shift / knee flex
    orientClub(club, _co, _cd, _cf);
    _tL.copy(_co).addScaledVector(_cd, 0.045); _tR.copy(_co).addScaledVector(_cd, 0.125);
    _pL.set(0.3, -1, 0); _pR.set(-0.3, -1, 0);
    if (k > 0.6) { mouth.scale.set(1.15 * mS, 1.3, 1); }
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
    const amp = Math.min(1.05, (0.42 + 0.045 * sp) * Rn.stride);
    const kA = (0.8 + 0.05 * sp) * Rn.knee;
    legL.hip.rotation.x = -amp * sL; legR.hip.rotation.x = amp * sL;
    legL.knee.rotation.x = 0.15 + kA * Math.pow(Math.max(0, cL), 0.8) + 0.3 * Math.max(0, -sL);
    legR.knee.rotation.x = 0.15 + kA * Math.pow(Math.max(0, -cL), 0.8) + 0.3 * Math.max(0, sL);
    legL.hip.rotation.z = S.stance * 0.5; legR.hip.rotation.z = -S.stance * 0.5;
    feetFlat(legL, 0.6); feetFlat(legR, 0.6);
    const lean = S.hunch + Rn.lean + (Rn.lean > 0 ? 0.012 * sp : 0);
    torso.rotation.x = lean;
    torso.rotation.y = 0.2 * sL * Rn.arm;
    rig.rotation.z = Rn.sway * sL;
    rig.position.y = Rn.bounce * Math.abs(sL) * Math.min(1, 0.4 + sp / 8);
    head.rotation.x = -lean * 0.75 + 0.04 * Math.sin(ph * 2);
    head.rotation.y = -torso.rotation.y * 0.8;
    head.rotation.z = -rig.rotation.z * 0.6;
    // pumping arms, elbows bent; the club rides in the right hand, level, head first
    const fR = Math.max(-1.3, Math.min(1.3, sL * Rn.arm)), fL = -fR;
    const out = Rn.out ?? 0, tuck = Rn.tuck ?? 0;
    for (const [T, f, s] of [[_tL, fL, 1], [_tR, fR, -1]]) {
      const hy = S.sY - reach * (0.74 - 0.32 * Math.max(0, f) + 0.04 * Math.max(0, -f) - tuck);
      T.set(s * (S.sX + 0.02 + out - tuck * 0.3), hy, 0.05 + f * reach * 0.52);
    }
    handsInTorso = true;
    _pL.set(0.25 + out * 3, -0.3, -1); _pR.set(-0.25 - out * 3, -0.3, -1); polesInTorso = true;
    _cd.set(-0.32 - 0.25 * Math.max(0, -fR), -0.08 + 0.3 * fR, 1).normalize();   // head flared out, clear of the hip
    dirToRig(torso, _cd);
    _v.copy(_tR); torsoToRig(torso, _v);
    _co.copy(_v).addScaledVector(_cd, -0.38 * S.club);
    _cf.set(0, 1, 0);
    orientClub(club, _co, _cd, _cf);
    mouth.scale.set(1.1 * mS, 1.5, 1);
  } else if (mode === 'cheer') {
    const b = Math.abs(Math.sin(t * 5.5));
    rig.position.y = S.jump * b;
    for (const L of [legL, legR]) { L.hip.rotation.x = -0.35 * b; L.knee.rotation.x = 0.7 * b; }
    feetFlat(legL, 0.5); feetFlat(legR, 0.5);
    torso.rotation.x = S.hunch * 0.4 - 0.12;
    head.rotation.x = -0.3;
    head.rotation.z = 0.1 * Math.sin(t * 2.75);
    const pump = 0.05 * Math.sin(t * 11);
    _tL.set(S.sX + 0.16, S.sY + reach * 0.9 + pump, 0.06);
    _tR.set(-S.sX - 0.16, S.sY + reach * 0.9 - pump, 0.06);
    handsInTorso = true;
    _pL.set(1, -0.2, -0.3); _pR.set(-1, -0.2, -0.3); polesInTorso = true;
    _cd.set(-0.35, 1, 0.15 + 0.2 * Math.sin(t * 11)).normalize(); dirToRig(torso, _cd);
    _v.copy(_tR); torsoToRig(torso, _v);
    _co.copy(_v).addScaledVector(_cd, -0.05);
    _cf.set(0, 0, 1);
    orientClub(club, _co, _cd, _cf);
    mouth.scale.set(1.25 * mS, U.mouthOpen ?? 2.4, 1);
  } else if (mode === 'sulk') {
    const sigh = Math.sin(t * 0.8);
    torso.rotation.x = S.hunch + 0.42 + 0.04 * sigh;
    torso.rotation.z = 0.05;
    head.rotation.x = 0.42 - S.hunch * 0.5;
    head.rotation.y = 0.12 * Math.sin(t * 0.3);
    rig.position.x = 0.015 * Math.sin(t * 0.6);
    for (const L of [legL, legR]) { L.hip.rotation.x = -0.1; L.knee.rotation.x = 0.2; }
    // scuffing a toe in the turf
    const sc = (t % 3.6) / 0.7;
    if (sc < 1) { legL.hip.rotation.x -= 0.3 * Math.sin(sc * Math.PI); legL.knee.rotation.x += 0.25 * Math.sin(sc * Math.PI); }
    feetFlat(legR); legL.ankle.rotation.x = -(legL.hip.rotation.x + legL.knee.rotation.x) * 0.6;
    // arms dangle under gravity from the slumped shoulders
    for (const [T, arm, s] of [[_tL, armL, 1], [_tR, armR, -1]]) {
      T.copy(arm.shoulder); torsoToRig(torso, T);
      T.x += s * 0.03; T.y -= reach * 0.93; T.z += 0.05;
    }
    _pL.set(0.4, 0, -1); _pR.set(-0.4, 0, -1);
    // the club drags behind on the ground
    const gy = BALL_R * 0.4, dy = _tR.y - gy;
    const back = Math.sqrt(Math.max(0, S.club * S.club - dy * dy));
    _cd.set(-0.05, -dy, -back).normalize();
    _co.copy(_tR).addScaledVector(_cd, -0.04);
    _cf.set(-1, 0, 0);
    orientClub(club, _co, _cd, _cf);
    mouth.rotation.z = 0; mouth.position.y = U.mouthY - 0.02;
  } else {
    // idle: breathing, a slow weight shift, the odd look around
    const w = Math.sin(t * 0.45 + seed * 6);
    const br = Math.sin(t * 1.7 + seed * 3);
    rig.position.x = 0.02 * w;
    rig.rotation.z = -0.02 * w;
    legL.hip.rotation.z += 0.02 * w; legR.hip.rotation.z += 0.02 * w;
    torso.rotation.x = S.hunch + 0.015 * br;
    torso.rotation.z = 0.02 * w;
    head.rotation.y = 0.55 * glance(t, seed);
    head.rotation.x = -S.hunch * 0.85 + 0.03 * Math.sin(t * 0.7);
    const style = S.idle;
    if (style === 'lean' || style === 'wave') {
      // leaning on the club, planted out front-right; left hand on the hip
      _cd.set(-0.1, -1, 0.12).normalize(); _cf.set(0, 0, 1);
      _co.set(-(S.sX + 0.17), 0.015, 0.3).addScaledVector(_cd, -S.club);
      orientClub(club, _co, _cd, _cf);
      _tR.copy(_co).addScaledVector(_cd, 0.035);
      _tL.set(S.sX + 0.02, S.hipY + 0.07, 0.07);
      _pL.set(1, 0.1, -0.4); _pR.set(-1, -0.3, -0.6);
      if (style === 'lean') torso.rotation.x = S.hunch - 0.03 + 0.015 * br;   // chest out
      if (style === 'wave') {
        const p = (t + seed * 9) % 5.5, up = smooth(0, 0.35, p) * (1 - smooth(2.2, 2.6, p));
        if (up > 0) {
          _v.set(S.sX + 0.28 + 0.1 * Math.sin(t * 9) * up, S.sY + reach * 0.75, 0.12);
          torsoToRig(torso, _v);
          _tL.lerp(_v, up);
          _pL.set(1, -0.4, 0);
          head.rotation.z = 0.12 * up * Math.sin(t * 4.5);
        }
      }
    } else if (style === 'cane') {
      // both hands stacked on the club like a walking stick, bent over it
      _cd.set(0, -1, 0.12).normalize(); _cf.set(0, 0, 1);
      _co.set(0.0, 0.015, 0.36).addScaledVector(_cd, -S.club);
      orientClub(club, _co, _cd, _cf);
      _tR.copy(_co).addScaledVector(_cd, 0.06);
      _tL.copy(_co); _tL.y += 0.025; _tL.z -= 0.01;
      _pL.set(1, -0.2, 0); _pR.set(-1, -0.2, 0);
      torso.rotation.x = S.hunch + 0.08 + 0.02 * br;
      head.rotation.x = -(S.hunch + 0.08) * 0.9 + 0.04 * Math.sin(t * 0.7);
      // a spry little toe-tap
      const tp = (t + 1) % 3.1;
      if (tp < 0.5) { legR.hip.rotation.x = -0.12 * Math.sin(tp / 0.5 * Math.PI * 2) ** 2; legR.knee.rotation.x = 0.2 * Math.sin(tp / 0.5 * Math.PI); }
    } else if (style === 'shoulder') {
      // club over the right shoulder, thumb hooked in the bag strap, can't stand still
      const bob = Math.abs(Math.sin(t * 3.2));
      rig.position.y = 0.015 * bob;
      for (const L of [legL, legR]) { L.ankle.rotation.x = 0.12 * bob; }
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
    } else if (style === 'posh') {
      // chin up, club as a walking stick at arm's length, other hand behind the back
      _cd.set(-0.2, -1, 0.06).normalize(); _cf.set(0, 0, 1);
      _co.set(-(S.sX + 0.2), 0.015, 0.2).addScaledVector(_cd, -S.club);
      orientClub(club, _co, _cd, _cf);
      _tR.copy(_co).addScaledVector(_cd, 0.035);
      _pR.set(-1, -0.3, -0.3);
      torso.rotation.x = S.hunch + 0.012 * br;
      _v.set(0.05, 0.1, -0.2); torsoToRig(torso, _v); _tL.copy(_v);
      _pL.set(1, 0, 0.2);
      head.rotation.x = -0.18 + 0.03 * Math.sin(t * 0.7);
    }
  }

  // keep the planted foot on the ground
  if (liftFix) rig.position.y -= Math.min(legLift(S, legL), legLift(S, legR));

  if (!handsInTorso) { rigToTorso(torso, _tL); rigToTorso(torso, _tR); }
  if (!polesInTorso) { dirToTorso(torso, _pL); dirToTorso(torso, _pR); }
  solveArm(armL, _tL, _pL); solveArm(armR, _tR, _pR);

  U.hips.rotation.set(torso.rotation.x * 0.3, torso.rotation.y * 0.45, torso.rotation.z * 0.5);
  if (U.extra) U.extra(U, t, mode, ph, speed);
  U._lastT = t;
}

// ---------------------------------------------------------------- portraits
// A small transparent PNG data URL of the character's head and shoulders, for
// the character-select card. Uses one short-lived offscreen renderer.
let _pr = null, _prTimer = 0;
const PORTRAIT = { pro: [0.95, 0.07], birdie: [1.3, 0.06], kid: [1.4, 0.12], bogey: [1.0, 0.07], mascot: [2.1, 0.18] };   // camera distance, aim above the neck
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
