// Characters: Old Tom, the dead club pro whose ghost races you round the
// course ("Par was his religion"). Procedural low-poly like the rest of the
// scene: primitives only, no asset files.
//
// Space: origin at his feet, he faces +Z, ~1.75 m tall. In 'swing' mode the
// rig turns side-on so the shot flies toward local +Z and the ball sits at
// SWING_BALL (use oldTomAddress() to stand him at a ball). The ghost look is
// one tiny rim-lit ShaderMaterial (fog-aware, no scene lights, no shadows),
// instanced per colour so every part shares a single program.

import * as THREE from 'three';

export const GHOST_CYAN = 0x7ff6ff;
// Ball centre (group-local) his club meets at k = SWING_IMPACT in 'swing' mode.
export const SWING_BALL = new THREE.Vector3(-0.815, 0.07, 0);
export const SWING_IMPACT = 0.55;

// ---------------------------------------------------------------- material
const VS = `
#include <common>
#include <fog_pars_vertex>
varying vec3 vN; varying vec3 vV; varying vec2 vUv;
void main(){
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = -mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FS = `
#include <common>
#include <fog_pars_fragment>
uniform vec3 uColor; uniform vec3 uRim; uniform vec3 uArgyleColor;
uniform float uAlpha; uniform float uFade; uniform float uArgyle; uniform float uGlow;
varying vec3 vN; varying vec3 vV; varying vec2 vUv;
void main(){
  vec3 n = normalize(vN); vec3 v = normalize(vV);
  float rim = pow(1.0 - abs(dot(n, v)), 2.2);
  vec3 c = uColor * (0.74 + 0.26 * (n.y * 0.5 + 0.5));
  if (uArgyle > 0.0) {
    vec2 p = vUv * vec2(uArgyle, uArgyle * 0.9);
    vec2 q = vec2(p.x + p.y, p.x - p.y);
    float chk = mod(floor(q.x) + floor(q.y), 2.0);
    float line = 1.0 - smoothstep(0.03, 0.07, min(abs(fract(q.x) - 0.5), abs(fract(q.y) - 0.5)));
    c = mix(c, uArgyleColor, chk * 0.55);
    c = mix(c, vec3(1.0), line * 0.35);
  }
  c = mix(c, uRim * 1.25, rim) + uColor * uGlow;
  gl_FragColor = vec4(c, clamp(uAlpha + rim * 0.4 + uGlow * 0.3, 0.0, 1.0) * uFade);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

function ghostMat(color, { alpha = 0.6, rim = 0xb4fbff, argyle = 0, argyleColor = 0x2a8fb0, glow = 0, fade, depthWrite = true } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uColor: { value: new THREE.Color(color) }, uRim: { value: new THREE.Color(rim) },
      uArgyleColor: { value: new THREE.Color(argyleColor) },
      uAlpha: { value: alpha }, uArgyle: { value: argyle }, uGlow: { value: glow },
      uFade: fade,                        // shared {value} so one write fades the whole ghost
    },
    vertexShader: VS, fragmentShader: FS,
    transparent: true, depthWrite, fog: true,
  });
}

let _glow = null;
function glow() {
  if (_glow) return _glow;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  return (_glow = new THREE.CanvasTexture(c));
}
function glowSprite(color, opacity) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  return s;
}

// One half of the walrus moustache (tip on +x); mirror with scale.x = -1.
let _tash = null;
function tashGeo() {
  if (_tash) return _tash;
  const s = new THREE.Shape();
  s.moveTo(0, 0.014);
  s.bezierCurveTo(0.03, 0.026, 0.07, 0.016, 0.095, -0.018);
  s.bezierCurveTo(0.112, -0.04, 0.12, -0.075, 0.112, -0.102);
  s.bezierCurveTo(0.098, -0.078, 0.084, -0.052, 0.06, -0.04);
  s.bezierCurveTo(0.04, -0.03, 0.02, -0.034, 0, -0.028);
  s.lineTo(0, 0.014);
  _tash = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 2, curveSegments: 8 });
  _tash.translate(0, 0, -0.006);
  return _tash;
}
function buildTash(mat, scale = 1) {
  const g = new THREE.Group();
  const a = new THREE.Mesh(tashGeo(), mat); a.rotation.y = 0.42;
  const b = new THREE.Mesh(tashGeo(), mat); b.scale.x = -1; b.rotation.y = -0.42;
  g.add(a, b); g.scale.setScalar(scale);
  return { g, a, b };
}

// Translucent self-sorting: big "core" volumes draw first (renderOrder 0) and
// write depth, so details (face, arms, cap, club; renderOrder 1) on the far side
// of the body are hidden instead of showing through - from behind you see the
// back of his head, not his moustache. Glows go first / last. No shadows: ghost.
function layer(root, core, under, over) {
  root.traverse(m => { if (m.isMesh) { m.renderOrder = 1; m.castShadow = m.receiveShadow = false; } });
  for (const m of core) m.renderOrder = 0;
  if (under) under.renderOrder = -1;
  for (const m of over) m.renderOrder = 2;
}

// Flat cap: a squashed hemisphere crown, a half-disc brim, a button.
function buildCap(mat, r = 0.135) {
  const g = new THREE.Group();
  const crown = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  crown.scale.set(1.02, 0.5, 1.1); crown.position.z = r * 0.12;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.88, r * 0.88, r * 0.09, 14, 1, false, -Math.PI / 2, Math.PI), mat);
  brim.scale.z = 0.95; brim.position.set(0, r * 0.03, r * 0.62); brim.rotation.x = 0.12;
  const button = new THREE.Mesh(new THREE.SphereGeometry(r * 0.11, 6, 4), mat);
  button.position.set(0, r * 0.5, r * 0.14);
  g.add(crown, brim, button);
  return { g, crown, brim };
}

// ---------------------------------------------------------------- Old Tom
const UA = 0.3, FA = 0.29;                 // upper arm / forearm (joint to joint)
const HIP_Y = 0.88, SHOULDER = new THREE.Vector3(0.19, 0.44, 0), HEAD_S = 1.15;
const TILT = 0.45;                         // spine tilt at address
const CLUB_LEN = 0.905;                    // grip top -> clubhead centre
const _S = new THREE.Vector3(0, HIP_Y + SHOULDER.y * Math.cos(TILT), SHOULDER.y * Math.sin(TILT)); // shoulder centre at address
const _D = new THREE.Vector3().subVectors(SWING_BALL.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2), _S);
const HAND_R = _D.length() - CLUB_LEN;    // radius of the hands' arc
_D.normalize();                            // shoulders -> ball, in the swing plane
const _B = new THREE.Vector3(-1, 0, 0);    // away from target (rig space)

export function buildOldTom() {
  const fade = { value: 1 };
  const M = {
    skin: ghostMat(0xd8fcff, { alpha: 0.56, fade }),
    shirt: ghostMat(0xc4f6fc, { alpha: 0.55, fade }),
    vest: ghostMat(0x5ed6e6, { alpha: 0.62, argyle: 7, argyleColor: 0x1f86a8, fade }),
    knick: ghostMat(0x93e4ee, { alpha: 0.52, fade }),
    shoe: ghostMat(0x3fb0c8, { alpha: 0.42, fade }),
    sock: ghostMat(0xb6f4fa, { alpha: 0.48, argyle: 5, argyleColor: 0x2f9fbd, fade }),
    cap: ghostMat(0x3fb0c8, { alpha: 0.7, fade }),
    hair: ghostMat(0xffffff, { alpha: 0.88, rim: 0xffffff, fade }),
    dark: ghostMat(0x052433, { alpha: 0.9, rim: 0x0d4a60, fade }),
    eye: ghostMat(0x052433, { alpha: 0.92, rim: 0x0d4a60, fade }),
    club: ghostMat(0xc8fbff, { alpha: 0.72, fade }),
  };
  const g = new THREE.Group(); g.name = 'OldTom';
  const rig = new THREE.Group(); g.add(rig);

  // legs: plus-fours bagging over the knee, argyle socks, brogues
  const knickGeo = new THREE.LatheGeometry([[0.001, 0.35], [0.05, 0.355], [0.095, 0.39], [0.118, 0.47], [0.112, 0.6], [0.1, 0.74], [0.11, 0.9]].map(p => new THREE.Vector2(p[0], p[1])), 12);
  const sockGeo = new THREE.CylinderGeometry(0.048, 0.04, 0.32, 10);
  const shoeGeo = new THREE.SphereGeometry(0.06, 10, 6);
  const legs = {};
  for (const [s, key] of [[1, 'L'], [-1, 'R']]) {
    const k = new THREE.Mesh(knickGeo, M.knick); k.position.x = s * 0.1;
    const sock = new THREE.Mesh(sockGeo, M.sock); sock.position.set(s * 0.1, 0.22, 0);
    const shoe = new THREE.Mesh(shoeGeo, M.shoe); shoe.scale.set(0.9, 0.55, 1.7); shoe.position.set(s * 0.1, 0.035, 0.045);
    rig.add(k, sock, shoe);
    legs[key] = k;
  }

  // torso: a pot-bellied argyle jersey, lathed
  const torso = new THREE.Group(); torso.position.y = HIP_Y; rig.add(torso);
  const torsoGeo = new THREE.LatheGeometry([[0.001, -0.07], [0.16, -0.06], [0.2, 0.05], [0.218, 0.17], [0.205, 0.3], [0.19, 0.4], [0.16, 0.47], [0.09, 0.53], [0.001, 0.545]].map(p => new THREE.Vector2(p[0], p[1])), 16);
  const jersey = new THREE.Mesh(torsoGeo, M.vest); jersey.scale.z = 0.82;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.09, 8), M.skin); neck.position.y = 0.54;
  const tie = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.15, 0.02), M.cap); tie.position.set(0, 0.44, 0.13); tie.rotation.x = -0.45;
  torso.add(jersey, neck, tie);

  // arms: two capsules each, solved to the hands every frame
  const upGeo = new THREE.CapsuleGeometry(0.046, UA, 3, 8), foGeo = new THREE.CapsuleGeometry(0.038, FA, 3, 8);
  const handGeo = new THREE.SphereGeometry(0.046, 8, 6);
  const mkArm = s => {
    const up = new THREE.Mesh(upGeo, M.shirt), fo = new THREE.Mesh(foGeo, M.shirt), hand = new THREE.Mesh(handGeo, M.skin);
    torso.add(up, fo, hand);
    return { up, fo, hand, shoulder: new THREE.Vector3(s * SHOULDER.x, SHOULDER.y, SHOULDER.z) };
  };
  const armL = mkArm(1), armR = mkArm(-1);

  // head
  const head = new THREE.Group(); head.position.set(0, 0.555, 0.01); head.scale.setScalar(HEAD_S); torso.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12), M.skin); skull.position.y = 0.13; skull.scale.set(0.95, 1.05, 1);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), M.skin); nose.position.set(0, 0.125, 0.115); nose.scale.set(0.9, 1.1, 1.05);
  const earGeo = new THREE.SphereGeometry(0.03, 8, 6);
  const earL = new THREE.Mesh(earGeo, M.skin); earL.scale.set(0.45, 1, 0.8); earL.position.set(0.108, 0.125, -0.005);
  const earR = earL.clone(); earR.position.x = -0.108;
  const eyeGeo = new THREE.SphereGeometry(0.017, 8, 6);
  const eyeL = new THREE.Mesh(eyeGeo, M.eye); eyeL.position.set(0.042, 0.158, 0.098);
  const eyeR = eyeL.clone(); eyeR.position.x = -0.042;
  const browGeo = new THREE.CapsuleGeometry(0.015, 0.045, 2, 6);
  const browL = new THREE.Mesh(browGeo, M.hair); browL.position.set(0.046, 0.188, 0.1); browL.rotation.z = Math.PI / 2 - 0.28;
  const browR = new THREE.Mesh(browGeo, M.hair); browR.position.set(-0.046, 0.188, 0.1); browR.rotation.z = Math.PI / 2 + 0.28;
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), M.dark); mouth.position.set(0, 0.062, 0.097); mouth.scale.set(1.2, 0.2, 0.55);
  const jaw = new THREE.Group(); jaw.position.set(0, 0.075, 0.01);
  const chin = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), M.skin); chin.position.set(0, -0.03, 0.06); chin.scale.set(1.15, 0.7, 0.9);
  jaw.add(chin);
  const tash = buildTash(M.hair); tash.g.position.set(0, 0.092, 0.112);
  const cap = buildCap(M.cap); cap.g.position.set(0, 0.205, 0.0); cap.g.rotation.x = 0.13;
  const eyeGlowL = glowSprite(GHOST_CYAN, 0); eyeGlowL.position.copy(eyeL.position).z += 0.032; eyeGlowL.scale.setScalar(0.05); eyeGlowL.visible = false;
  const eyeGlowR = eyeGlowL.clone(); eyeGlowR.material = eyeGlowL.material; eyeGlowR.position.x = -eyeGlowL.position.x;
  const face = new THREE.Object3D(); face.position.set(0, 0.13, 0.13);   // world anchor for the caller
  head.add(skull, nose, earL, earR, eyeL, eyeR, browL, browR, mouth, jaw, tash.g, cap.g, eyeGlowL, eyeGlowR, face);

  // the club: hickory shaft, mashie blade. Pivot = top of the grip, shaft along -Y.
  const club = new THREE.Group(); rig.add(club);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.015, 0.2, 8), M.cap); grip.position.y = -0.1;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.72, 6), M.club); shaft.position.y = -0.56;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.045, 0.024), M.club); blade.position.set(-0.034, -CLUB_LEN, 0);
  club.add(grip, shaft, blade);

  // a soft halo so he reads at distance and at dusk
  const halo = glowSprite(GHOST_CYAN, 0.24); halo.scale.set(1.6, 2.4, 1); halo.position.y = 0.95; rig.add(halo);

  layer(rig, [skull, jersey, legs.L, legs.R], halo, [eyeGlowL, eyeGlowR]);

  g.userData = {
    rig, body: torso, torso, head, skull, face, jaw, mouth, chin, nose, eyeL, eyeR, eyeGlowL, eyeGlowR, browL, browR,
    moustache: tash.g, moustacheL: tash.a, moustacheR: tash.b, cap: cap.g, capBrim: cap.brim,
    armL, armR, handL: armL.hand, handR: armR.hand, club, clubHead: blade, legL: legs.L, legR: legs.R, halo,
    materials: M, fade, swingBall: SWING_BALL.clone(), impactK: SWING_IMPACT,
  };
  animateOldTom(g, 0, { mode: 'idle' });
  return g;
}

// Stand Tom at a ball (ground-level y) so his swing sends it toward target.
export function oldTomAddress(g, ball, target) {
  const yaw = Math.atan2(target.x - ball.x, target.z - ball.z);
  g.rotation.set(0, yaw, 0);
  const off = SWING_BALL.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  g.position.set(ball.x - off.x, ball.y, ball.z - off.z);
  return g;
}

// Fade the whole ghost (0..1); cheap, one shared uniform.
export function setOldTomOpacity(g, o) { g.userData.fade.value = o; }

// ---------------------------------------------------------------- animation
const _up = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _e = new THREE.Vector3(), _p = new THREE.Vector3();
const _tL = new THREE.Vector3(), _tR = new THREE.Vector3(), _pL = new THREE.Vector3(), _pR = new THREE.Vector3();
const _co = new THREE.Vector3(), _cd = new THREE.Vector3(), _cf = new THREE.Vector3();
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
const EYE_DARK = new THREE.Color(0x052433), EYE_HOT = new THREE.Color(0x0e5566);   // sockets stay hollow; the sprites burn
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
  const S = arm.shoulder;
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
// rig-space points/directions -> torso space (call after the torso is posed)
function rigToTorso(torso, v) { torso.updateMatrix(); return v.applyMatrix4(_m.copy(torso.matrix).invert()); }
function dirToTorso(torso, v) { return v.applyQuaternion(_q.copy(torso.quaternion).invert()); }

// Swing timeline: α = hands' angle round the arc (+ back, − through), hinge = wrist cock.
const A_TOP = 2.3, A_FIN = -2.55, HINGE = 1.65;
function swingPose(k) {
  let a, h, f = 0;                          // f: follow-through progress
  if (k < 0.1) { a = 0.05 * Math.sin(k / 0.1 * Math.PI * 2); h = 0; }
  else if (k < 0.42) { const u = (k - 0.1) / 0.32; a = A_TOP * (0.5 - 0.5 * Math.cos(u * Math.PI)); h = HINGE * smooth(0.05, 0.75, u); }
  else if (k < 0.46) { a = A_TOP; h = HINGE; }
  else if (k < SWING_IMPACT) { const u = (k - 0.46) / (SWING_IMPACT - 0.46); a = A_TOP * (1 - u * u); h = HINGE * (1 - u * u * u); }
  else if (k < 0.74) { const u = (k - SWING_IMPACT) / (0.74 - SWING_IMPACT); f = 1 - (1 - u) * (1 - u); a = A_FIN * f; h = -HINGE * Math.pow(f, 0.7); }
  else { f = 1; a = A_FIN; h = -HINGE; }
  return { a, h, f };
}

export function animateOldTom(g, t, state = { mode: 'idle' }) {
  const U = g.userData, { rig, torso, head, jaw, mouth, armL, armR, club } = U;
  const mode = state?.mode ?? 'idle', k = clamp01(state?.k ?? 0);
  // defaults; each mode overrides what it needs
  rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0);
  torso.rotation.set(0, 0, 0); head.rotation.set(0, 0, 0); head.scale.setScalar(HEAD_S); head.position.set(0, 0.555, 0.01);
  jaw.rotation.set(0, 0, 0); mouth.scale.set(1.2, 0.2, 0.55); mouth.position.set(0, 0.062, 0.097);
  U.moustacheL.rotation.z = 0; U.moustacheR.rotation.z = 0; U.moustache.scale.setScalar(1);
  U.browL.rotation.z = Math.PI / 2 - 0.28; U.browR.rotation.z = Math.PI / 2 + 0.28;
  U.browL.position.y = U.browR.position.y = 0.188;
  U.eyeL.scale.setScalar(1); U.eyeR.scale.setScalar(1);
  U.cap.rotation.x = 0.13; U.cap.position.y = 0.205;
  let eyeHot = 0;
  _pL.set(1, -0.6, -0.6); _pR.set(-1, -0.6, -0.6);   // elbows out and back
  let handsInTorso = false;

  if (mode === 'swing') {
    const { a, h, f } = swingPose(k);
    rig.rotation.y = -Math.PI / 2;                     // side-on: rig +X (his left) becomes group +Z
    const shift = 0.06 * smooth(0.42, 0.6, k) - 0.02 * smooth(0.1, 0.4, k);
    rig.position.z = shift;                            // weight shift toward the target (group +Z)
    rig.position.y = 0.01 * Math.sin(t * 1.6);
    const turn = a > 0 ? -1.25 * (a / A_TOP) : 1.5 * (a / A_FIN);
    torso.rotation.x = lerp(TILT, 0.1, smooth(SWING_IMPACT, 0.85, k));
    torso.rotation.y = turn;
    torso.rotation.z = a > 0 ? 0.1 * (a / A_TOP) : -0.18 * (a / A_FIN);
    head.rotation.y = -turn * 0.8 * (1 - f) + 0.25 * f;
    head.rotation.x = lerp(0.22, -0.15, f);
    const b = a + h;
    _co.copy(_S).addScaledVector(_D, HAND_R * Math.cos(a)).addScaledVector(_B, HAND_R * Math.sin(a));
    _cd.copy(_D).multiplyScalar(Math.cos(b)).addScaledVector(_B, Math.sin(b));
    _cf.copy(_D).multiplyScalar(Math.sin(b)).addScaledVector(_B, -Math.cos(b));
    _co.x -= shift;                                     // hands stay on the arc to the ball, not the weight shift
    orientClub(club, _co, _cd, _cf);
    _tL.copy(_co).addScaledVector(_cd, 0.045); _tR.copy(_co).addScaledVector(_cd, 0.125);
    _pL.set(0.3, -1, 0); _pR.set(-0.3, -1, 0);
    // a twitch of satisfaction once it's struck
    const tw = smooth(0.62, 0.7, k) * (1 - smooth(0.8, 0.95, k));
    U.moustacheL.rotation.z = 0.25 * tw; U.moustacheR.rotation.z = -0.25 * tw;
  } else if (mode === 'gloat') {
    rig.position.y = 0.22 + 0.06 * Math.sin(t * 3);
    rig.rotation.y = t * 1.6;
    rig.rotation.z = 0.06 * Math.sin(t * 3 + 1);
    const pump = 0.05 * Math.sin(t * 6);
    torso.rotation.x = -0.12;
    head.rotation.x = -0.32 + 0.05 * Math.sin(t * 14);
    jaw.rotation.x = 0.28 + 0.18 * Math.sin(t * 14);   // "ho ho ho"
    mouth.scale.set(1.1, 0.9 + 0.5 * Math.sin(t * 14), 0.6); mouth.position.y = 0.05;
    U.moustache.scale.setScalar(1.05 + 0.04 * Math.sin(t * 14));
    U.moustacheL.rotation.z = 0.3; U.moustacheR.rotation.z = -0.3;
    U.browL.position.y = U.browR.position.y = 0.198;
    _tL.set(0.36, HIP_Y + 0.9 + pump, 0.1); _tR.set(-0.36, HIP_Y + 0.9 - pump, 0.1);
    _cd.set(-0.35, 1, 0.15).normalize(); _cf.set(0, 0, 1);
    _co.copy(_tR).addScaledVector(_cd, -0.05);
    orientClub(club, _co, _cd, _cf);
    _pL.set(1, -0.4, -0.3); _pR.set(-1, -0.4, -0.3);
  } else if (mode === 'scare') {
    const e = 1 - Math.pow(1 - smooth(0, 0.35, k), 3), shake = 0.012 * smooth(0.2, 0.4, k);
    rig.position.set(Math.sin(t * 53) * shake, 0.06 * (1 - e), 0.55 * e);
    torso.rotation.x = 0.72 * e;
    head.rotation.x = -0.6 * e + Math.sin(t * 41) * shake * 3;
    U.cap.rotation.x = 0.13 - 0.55 * e; U.cap.position.y = 0.205 + 0.07 * e;   // cap pops up in fright
    head.rotation.z = Math.sin(t * 37) * shake * 4;
    head.scale.setScalar(HEAD_S * (1 + 1.3 * e));
    head.position.y = 0.555 - 0.03 * e;
    jaw.rotation.x = 0.75 * e;
    mouth.scale.set(1.2 + 0.3 * e, 0.2 + 2.2 * e, 0.55); mouth.position.set(0, 0.062 - 0.04 * e, 0.097 - 0.012 * e);
    U.moustacheL.rotation.z = 0.35 * e; U.moustacheR.rotation.z = -0.35 * e;
    U.browL.rotation.z = Math.PI / 2 - 0.28 + 0.7 * e; U.browR.rotation.z = Math.PI / 2 + 0.28 - 0.7 * e;   // kindly -> furious
    U.browL.position.y = U.browR.position.y = 0.188 - 0.01 * e;
    U.eyeL.scale.set(1 + 0.6 * e, 1 + 0.9 * e, 1); U.eyeR.scale.set(1 + 0.6 * e, 1 + 0.9 * e, 1);
    eyeHot = e;
    // claws forward at face height (torso space), fingers trembling
    _tL.set(0.24, 0.52 + Math.sin(t * 47) * shake, 0.5); _tR.set(-0.24, 0.52 + Math.sin(t * 43) * shake, 0.5);
    _tL.lerpVectors(_v.set(0.24, 0.0, 0.08), _tL, e); _tR.lerpVectors(_w.set(-0.24, 0.0, 0.08), _tR, e);
    handsInTorso = true;
    _pL.set(1, -0.3, 0); _pR.set(-1, -0.3, 0);
    // the club drops from his hand and hangs at his side
    _cd.set(-0.15, -1, 0.35).normalize(); _cf.set(1, 0, 0);
    torso.updateMatrix(); _co.copy(_tR).applyMatrix4(torso.matrix);
    orientClub(club, _co, _cd, _cf);
  } else {
    // idle: hovering, leaning on his club, hand on hip, the odd moustache twitch
    rig.position.y = 0.06 + 0.025 * Math.sin(t * 1.6);
    rig.rotation.z = 0.03 * Math.sin(t * 0.9);
    rig.rotation.y = 0.08 * Math.sin(t * 0.4);
    torso.rotation.x = 0.05 + 0.02 * Math.sin(t * 1.6 + 0.6);
    head.rotation.y = 0.3 * Math.sin(t * 0.5) * Math.sin(t * 0.23);
    head.rotation.x = 0.04 * Math.sin(t * 0.7);
    _cd.set(-0.1, -1, 0.12).normalize(); _cf.set(0, 0, 1);
    _co.set(-0.36, 0.01, 0.3).addScaledVector(_cd, -CLUB_LEN);
    orientClub(club, _co, _cd, _cf);
    _tR.copy(_co).y += 0.035;
    _tL.set(0.21, HIP_Y + 0.06, 0.07);                  // hand on hip
    _pL.set(1, 0.1, -0.4); _pR.set(-1, -0.3, -0.6);
    const ph = (t + 1.3) % 3.7;
    if (ph < 0.45) {
      const tw = Math.sin(ph / 0.45 * Math.PI * 4) * (1 - ph / 0.45);
      U.moustacheL.rotation.z = 0.28 * tw;
      U.moustacheR.rotation.z = -0.14 * tw;
      U.browL.position.y = 0.188 + 0.006 * Math.abs(tw);
    }
  }

  if (!handsInTorso) { rigToTorso(torso, _tL); rigToTorso(torso, _tR); }
  dirToTorso(torso, _pL); dirToTorso(torso, _pR);
  solveArm(armL, _tL, _pL); solveArm(armR, _tR, _pR);

  // eyes: dark beads -> burning lamps
  const em = U.materials.eye.uniforms;
  em.uColor.value.copy(EYE_DARK).lerp(EYE_HOT, eyeHot); em.uGlow.value = eyeHot * 0.25;
  U.eyeGlowL.visible = U.eyeGlowR.visible = eyeHot > 0.01;
  U.eyeGlowL.material.opacity = eyeHot * (0.85 + 0.15 * Math.sin(t * 50));
  U.halo.material.opacity = 0.24 + 0.16 * eyeHot;
}

// ---------------------------------------------------------------- jumpscare face
// A separate, more grotesque close-up head. Origin at the face centre, it looks
// down +Z and is ~0.7 m tall: parent it to the camera at (0, 0, -0.6) (the camera
// must itself be in the scene) and toggle .visible. Drive it with animateScareFace.
export function buildScareFace() {
  const fade = { value: 1 };
  const M = {
    skin: ghostMat(0x8fe3ee, { alpha: 0.74, rim: 0xd8ffff, fade }),
    hair: ghostMat(0xf2ffff, { alpha: 0.92, rim: 0xffffff, fade }),
    cap: ghostMat(0x2a93ad, { alpha: 0.8, fade }),
    hole: ghostMat(0x010d15, { alpha: 0.95, rim: 0x063346, fade }),
    shade: ghostMat(0x0b3a4a, { alpha: 0.45, rim: 0x8fe3ee, fade }),
    eye: ghostMat(0xeaffff, { alpha: 1, rim: 0xffffff, glow: 1.4, fade }),
    tooth: ghostMat(0xe8fff0, { alpha: 0.95, fade }),
  };
  const g = new THREE.Group(); g.name = 'OldTomScare';
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.25, 22, 16), M.skin); skull.scale.set(0.84, 1.22, 0.8);
  const chin = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), M.skin); chin.position.set(0, -0.42, 0.02); chin.scale.set(0.95, 0.62, 0.85);
  const cheekGeo = new THREE.SphereGeometry(0.07, 10, 8);
  const cheekL = new THREE.Mesh(cheekGeo, M.shade); cheekL.position.set(0.125, -0.1, 0.15); cheekL.scale.set(0.55, 1.2, 0.4);
  const cheekR = new THREE.Mesh(cheekGeo, M.shade); cheekR.position.set(-0.125, -0.1, 0.15); cheekR.scale.set(0.55, 1.2, 0.4);
  const sockGeo = new THREE.SphereGeometry(0.08, 12, 10);
  const sockL = new THREE.Mesh(sockGeo, M.hole); sockL.position.set(0.092, 0.07, 0.17); sockL.scale.set(0.8, 1.1, 0.5); sockL.rotation.z = 0.5;
  const sockR = new THREE.Mesh(sockGeo, M.hole); sockR.position.set(-0.092, 0.07, 0.17); sockR.scale.set(0.9, 0.95, 0.5); sockR.rotation.z = -0.25;
  const pupGeo = new THREE.SphereGeometry(0.016, 10, 8);
  const eyeL = new THREE.Mesh(pupGeo, M.eye); eyeL.position.set(0.094, 0.055, 0.205);
  const eyeR = new THREE.Mesh(pupGeo, M.eye); eyeR.position.set(-0.094, 0.055, 0.205);
  const glowL = glowSprite(GHOST_CYAN, 0.9); glowL.position.set(0.094, 0.055, 0.23); glowL.scale.setScalar(0.16);
  const glowR = glowSprite(GHOST_CYAN, 0.9); glowR.position.set(-0.094, 0.055, 0.23); glowR.scale.setScalar(0.16);
  const browGeo = new THREE.CapsuleGeometry(0.028, 0.11, 2, 8);
  const browL = new THREE.Mesh(browGeo, M.hair); browL.position.set(0.09, 0.17, 0.2); browL.rotation.z = Math.PI / 2 + 0.5;
  const browR = new THREE.Mesh(browGeo, M.hair); browR.position.set(-0.09, 0.17, 0.2); browR.rotation.z = Math.PI / 2 - 0.5;
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), M.skin); nose.position.set(0, -0.01, 0.215); nose.scale.set(0.85, 1.2, 0.9);
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), M.hole); mouth.position.set(0, -0.27, 0.13); mouth.scale.set(0.78, 1.6, 0.5);
  const throat = glowSprite(GHOST_CYAN, 0.35); throat.position.set(0, -0.3, 0.19); throat.scale.set(0.12, 0.2, 1);
  const teeth = new THREE.Group(); teeth.position.set(0, -0.27, 0.165);
  const toothGeo = new THREE.ConeGeometry(0.014, 0.05, 4);
  // crooked upper fangs hang from the top of the mouth, two stumps poke up from below
  [[-0.04, 0.115, Math.PI + 0.15], [-0.012, 0.125, Math.PI - 0.1], [0.022, 0.12, Math.PI + 0.05], [0.05, 0.105, Math.PI - 0.2], [-0.03, -0.13, 0.2], [0.035, -0.135, -0.15]]
    .forEach(([x, y, r]) => { const tt = new THREE.Mesh(toothGeo, M.tooth); tt.position.set(x, y, 0.02 - Math.abs(x) * 0.4); tt.rotation.z = r; teeth.add(tt); });
  const tash = buildTash(M.hair, 1.75); tash.g.position.set(0, -0.06, 0.212);
  const cap = buildCap(M.cap, 0.235); cap.g.position.set(0, 0.255, -0.05); cap.g.rotation.x = 0.16;
  const inner = new THREE.Group(); inner.position.y = 0.06; g.add(inner);
  inner.add(skull, chin, cheekL, cheekR, sockL, sockR, eyeL, eyeR, glowL, glowR, browL, browR, nose, mouth, throat, teeth, tash.g, cap.g);
  layer(g, [skull, chin], null, [glowL, glowR, throat]);
  g.userData = { skull, chin, mouth, throat, teeth, eyeL, eyeR, glowL, glowR, browL, browR, moustache: tash.g, moustacheL: tash.a, moustacheR: tash.b, cap: cap.g, materials: M, fade };
  animateScareFace(g, 0, 1);
  return g;
}

// k: 0 -> 1 over the scare (pops in fast, then screams and shudders).
export function animateScareFace(f, t, k = 1) {
  const U = f.userData;
  const pop = smooth(0, 0.18, k), s = 0.6 + 0.4 * pop + 0.08 * Math.sin(Math.min(1, k / 0.25) * Math.PI);
  f.scale.setScalar(s * 0.86);
  f.rotation.set(Math.sin(t * 31) * 0.03, Math.sin(t * 23) * 0.04, Math.sin(t * 37) * 0.05);
  const scream = 1 + 0.1 * Math.sin(t * 34), open = 0.55 + 0.45 * pop;
  U.mouth.scale.set(0.78 * (1 + 0.05 * Math.sin(t * 29)), 1.6 * scream * open, 0.5);
  U.mouth.position.y = -0.27 - 0.06 * (scream * open - 1);
  U.chin.position.y = -0.42 - 0.05 * pop * scream;
  U.teeth.children.forEach((c, i) => { if (i > 3) c.position.y = -0.13 - 0.06 * pop * scream; });
  U.moustacheL.rotation.z = 0.2 + 0.08 * Math.sin(t * 40); U.moustacheR.rotation.z = -0.2 - 0.08 * Math.sin(t * 43);
  const flick = 0.75 + 0.25 * Math.sin(t * 57) * Math.sin(t * 13);
  U.glowL.material.opacity = U.glowR.material.opacity = flick;
  U.glowL.scale.setScalar(0.16 * (0.9 + 0.2 * flick)); U.glowR.scale.copy(U.glowL.scale);
  U.throat.material.opacity = 0.25 + 0.15 * flick;
  U.fade.value = smooth(0, 0.06, k);
}
