// Golden Hour Golf — first-person 3D. Game loop, input, camera, HUD and the
// five council features: Sniper's Lie (scope), Ghost Strokes (rival ghost),
// The Goose, the Whisper-to-Hysteria commentator, and Four Balls, One Life.

import * as THREE from 'three';
import { buildCourse } from './course.js';
import { simulate, launch, frameAt, prepColliders, puttPower, puttMetres, windmillAngle, auraGrowth, CLUBS, CLUB_ORDER, R, CUP_R, FPS } from './physics.js';
import { extraColliders, placeTombs } from './trees.js';
import { GOLFERS, buildGolfer, animateGolfer, golferAddress, buildGolferPortrait, GOLFER_IMPACT } from './golfers.js';
import { buildGooseBreed, buildMonsterGoose, animateMonsterGoose, buildBossCrown, animateBossCrown, MONSTER_GRAB_PICK, MONSTER_THROW_RELEASE } from './geese.js';
import { buildOldTom, animateOldTom, buildScareFace, animateScareFace, oldTomAddress, setOldTomOpacity, SWING_IMPACT } from './characters.js';
import { HOLES, TOTAL_PAR, resolveHole } from './holes.js';
import { planHole } from './oldtom.js';
import * as W from './world.js';
import * as AUDIO from './audio.js';
import { sfx, unlockAudio as unlockAudioOnly, setMuted, isMuted, setWindAmbience, flightSound, gooseSong, GOOSE_SONG_SECS, swingTone } from './audio.js';
const setAmbience = l => AUDIO.setAmbience?.(l);
// every user gesture that unlocks WebAudio also unlocks speech (iOS needs both)
const unlockAudio = () => { unlockAudioOnly(); primeSpeech(); };
import { RoomClient } from './room.js';
import { say, initCommentator, commentator, bumpHysteria, setVoiceEnabled, voiceEnabled, tier, primeSpeech, tomSay } from './commentator.js';

const $ = id => document.getElementById(id);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ============================================================ renderer
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 2600);
camera.rotation.order = 'YXZ';
const env = W.createSky(scene);
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
initCommentator($('caption'));

// ============================================================ data
const TRAITS = [
  { id: 'bouncy', label: 'Bouncy', desc: 'bounces 70% higher', mod: { bounce: 1.7 } },
  { id: 'heavy', label: 'Heavy', desc: 'ignores wind, rolls on', mod: { wind: 0.35, speed: 0.92, roll: 0.8 } },
  { id: 'slippery', label: 'Slippery', desc: 'rolls and rolls', mod: { roll: 0.55, bounce: 1.15 } },
  { id: 'lucky', label: 'Lucky', desc: 'cups love it, a bit lazy', mod: { capture: 1.6, speed: 0.9 } },
  { id: 'feather', label: 'Featherweight', desc: 'flies far, loves wind', mod: { wind: 2.2, speed: 1.1 } },
  { id: 'nervous', label: 'Nervous', desc: 'fast and curvy', mod: { side: 1.8, speed: 1.12 } },
];
// Six signature balls (council round 6, §10.4). You pick four on the title
// card, then choose which living one to play at each tee.
const SIGNATURE = [
  { trait: 'bouncy', name: 'Bounce Springsteen', blurb: 'Bounces 70% higher. Born to run.' },
  { trait: 'heavy', name: 'Sir Thud', blurb: 'Ignores wind. Squashes grass. Rolls on.' },
  { trait: 'slippery', name: 'Butterfingers', blurb: 'Rolls and rolls and rolls.' },
  { trait: 'lucky', name: 'Clover', blurb: 'Cups love her. A bit lazy.' },
  { trait: 'feather', name: 'Lord Floofington', blurb: 'Flies far. Rides every gust.' },
  { trait: 'nervous', name: 'Nervous Nigel', blurb: 'Fast, curvy, deeply anxious.' },
];
const DEFAULT_PICK = ['lucky', 'heavy', 'bouncy', 'feather'];
const RANGE_BALL = { name: 'Range Ball #4471', trait: { id: 'range', label: 'Range ball', desc: 'smells of the bucket', mod: { speed: 0.9, bounce: 0.8 } }, alive: true, range: true };
const JUNK = ['a boot', 'a rubber duck', 'a tin of beans', 'a very old ball called Dennis', 'a traffic cone', "somebody's car keys", 'a small, confused fish', 'a scorecard from 1952'];
const traitOf = b => ({ speed: 1, bounce: 1, roll: 1, capture: 1, wind: 1, side: 1, ...b.trait.mod });
const SURF_LABEL = { tee: 'Tee box', fairway: 'Fairway', fringe: 'Fringe', green: 'Green', rough: 'Rough', sand: 'Bunker', water: 'Water', oob: 'Out of bounds' };

// ============================================================ state
const G = {
  mode: 'title',            // title | address | flight | walk | goose | angler | holed | end
  holeIdx: 0, strokes: 0, holeScores: [], ghostScores: [], roundRec: [], playerName: 'Player',
  course: null, holeDef: null, cup: null, colliders: null, holeGroup: null, flag: null, slope: null,
  ball: { x: 0, y: 0, z: 0 }, lastLie: null, yaw: 0, pitch: -0.18, club: 'driver',
  wind: { x: 0, z: 0 }, windBase: { dir: 0 }, timeScale: 1,
  shot: null, hitstop: 0, shake: 0, fovKick: 0,
  bag: [], ballIdx: 0,
  stats: null, scoped: false, scopeT: 0, breath: 1, holding: false, gasp: 0,
  walk: null, camPos: new THREE.Vector3(), camLook: new THREE.Vector3(), flightCam: null,
  ghost: null, race: { status: 'level', last: 'level', round: 0 },
  trails: [], hintsShown: {}, celebrate: 0, tLast: performance.now() / 1000, time: 0,
  stymieTold: false,
};
const bag = () => G.bag[G.ballIdx] ?? G.rangeBall ?? RANGE_BALL;
// index of the first living ball (or past the end: the range ball)
const nextAliveIdx = () => { const i = G.bag.findIndex(b => b.alive); return i < 0 ? G.bag.length : i; };

// ============================================================ shared meshes
const ballMesh = W.buildBall(0xffffff); scene.add(ballMesh);
const ballGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: W.glowTexture(), color: 0xfff2c0, transparent: true, opacity: 0.7, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
ballGlow.renderOrder = 5; scene.add(ballGlow);
const shooMesh = W.buildBall(0xc8c0b0); shooMesh.visible = false; scene.add(shooMesh);
const GHOST_R = 0.12;  // the ghost's "soul" ball is a little bigger than yours, and solid
const ghostMesh = W.buildBall(0x7ff6ff, true); ghostMesh.scale.setScalar(GHOST_R / R); scene.add(ghostMesh);
ghostMesh.material.opacity = 0.8;
const ghostTag = W.buildLabel('👻 Old Tom', '#bff9ff', 'rgba(10,40,60,0.6)'); ghostTag.visible = false; scene.add(ghostTag);
const rod = W.buildRod(); rod.visible = false; scene.add(rod);
const pinLabel = W.buildLabel('⛳ PIN', '#fff', 'rgba(220,40,60,0.8)'); scene.add(pinLabel);
const club = W.buildClub(); scene.add(club);
const aimRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.25, 40), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
aimRing.rotation.x = -Math.PI / 2; aimRing.renderOrder = 3; scene.add(aimRing);
// Two-line world label drawn into one reusable canvas: redrawn only when its
// text changes (and at most 20 times a second), never re-allocated per frame.
function makeLabel2() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 192;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.renderOrder = 10; s.userData.aspect = 512 / 192; s.visible = false;
  const F = 'ui-rounded, system-ui, sans-serif';
  s.userData.draw = (big, small, color, force) => {
    const key = `${big}|${small}|${color}`;
    if (s.userData.key === key) return;
    const t = performance.now();
    if (!force && t - (s.userData.at ?? 0) < 50) return;
    s.userData.key = key; s.userData.at = t;
    const x = c.getContext('2d'); x.clearRect(0, 0, 512, 192);
    x.font = `bold 62px ${F}`; const w1 = x.measureText(big).width;
    x.font = `bold 40px ${F}`; const w2 = small ? x.measureText(small).width : 0;
    const w = Math.min(506, Math.max(w1, w2) + 56), h = small ? 172 : 96, y0 = (192 - h) / 2;
    x.fillStyle = 'rgba(30,20,50,0.74)'; x.beginPath(); x.roundRect((512 - w) / 2, y0, w, h, 40); x.fill();
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = color; x.font = `bold 62px ${F}`; x.fillText(big, 256, small ? y0 + 52 : 96, 490);
    if (small) { x.fillStyle = '#fff1c9'; x.font = `bold 40px ${F}`; x.fillText(small, 256, y0 + 126, 490); }
    tex.needsUpdate = true;
  };
  scene.add(s);
  return s;
}
const aimLabel = makeLabel2();
// Your balls have names, so they have faces: googly eyes that turn to watch you.
const ballEyes = new THREE.Group();
{
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff }), black = new THREE.MeshBasicMaterial({ color: 0x111111 });
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(R * 0.4, 10, 8), white);
    e.position.set(sx * R * 0.4, R * 0.42, R * 0.7);
    const p = new THREE.Mesh(new THREE.SphereGeometry(R * 0.2, 8, 6), black);
    p.position.set(0, 0, R * 0.28); e.add(p); e.userData.pupil = p;
    ballEyes.add(e);
  }
}
ballMesh.add(ballEyes);
const ballTag = makeLabel2();   // "Hi, I'm Clover." floating over the ball for a few seconds
// Signature animations (council round 6, §10.5): each ball acts out its
// trait. Only the mesh moves; G.ball (the physics lie) never does.
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const BA = { squash: 0, flourish: null, fx: 0, x: false };
function ballSquash() { BA.squash = 0.15; }
function ballFlourish(kind) { BA.flourish = { kind, t: 0 }; }
function ballAnim(dt) {
  const b = bag(), id = b.trait?.id, p = ballMesh.position, k = reduceMotion ? 0.3 : 1;
  ballMesh.scale.setScalar(1); ballMesh.rotation.z = 0;
  if (!ballMesh.visible || G.mode === 'title') return;
  const t = G.time, inFlight = G.shot?.kind === 'player';
  BA.squash = Math.max(0, BA.squash - dt);
  if (G.eggBall) { ballMesh.scale.set(1.25, 1.55, 1.25); ballMesh.material.color.setHex(0xfff6e6); return; }
  ballMesh.material.color.setHex(0xffffff);
  if (BA.squash > 0) ballMesh.scale.set(1 + 0.25 * k, 1 - 0.25 * k, 1 + 0.25 * k);
  BA.fx -= dt;
  const atRest = G.mode === 'address' && !swing.active;
  // nervous near danger trembles twice as hard
  const scared = id === 'nervous' && (liveGeese().some(g => dist2(g, G.ball) < 15) || G.waterNear);
  if (atRest) {
    if (id === 'bouncy') { const u = (t % 1.6) / 0.35; if (u < 1) p.y += 0.06 * k * 4 * u * (1 - u); else if (u < 1.25) ballMesh.scale.set(1 + 0.12 * k, 1 - 0.12 * k, 1 + 0.12 * k); }
    else if (id === 'heavy') { p.y -= 0.008; ballMesh.scale.setScalar(1 + 0.03 * k * Math.sin(t * 2)); }
    else if (id === 'slippery') ballMesh.rotation.z = 0.12 * k * Math.sin(t * Math.PI * 5);
    else if (id === 'lucky' && BA.fx <= 0) { BA.fx = 0.8; burst(p.x, p.y + 0.08, p.z, 3, 0xffe066, { speed: 0.25, up: 0.6, life: 0.7, grav: -0.2 }); }
    else if (id === 'feather') { p.y += 0.01 * k * Math.sin(t * 2.4); ballMesh.rotation.z = clamp(G.wind.x * 0.03, -0.2, 0.2) * k; }
    else if (id === 'nervous') { const a = 0.004 * k * (scared ? 2 : 1); p.x += (Math.random() - 0.5) * a * 2; p.z += (Math.random() - 0.5) * a * 2; }
  } else if (inFlight) {
    if (id === 'lucky' && BA.fx <= 0) { BA.fx = 0.06; burst(p.x, p.y, p.z, 1, 0xffe066, { speed: 0.1, up: 0.1, life: 0.6, grav: 0 }); }
    if (id === 'feather' && BA.fx <= 0 && !G.shot.landed) { BA.fx = 0.35; burst(p.x, p.y, p.z, 1, 0xffffff, { speed: 0.4, up: 0.3, life: 2.5, grav: 0.6 }); }
    if (id === 'slippery' && G.shot.landed && BA.fx <= 0) { BA.fx = 0.12; burst(p.x, p.y - 0.03, p.z, 1, 0xd8fbff, { speed: 0.2, up: 0.2, life: 0.5, grav: 4 }); }
  }
  // a flourish after a rescue or a near miss
  const f = BA.flourish;
  if (f) {
    f.t += dt;
    if (f.kind === 'saved') {
      if (id === 'bouncy') { const u = (f.t % 0.4) / 0.4; p.y += 0.12 * k * 4 * u * (1 - u); }
      else if (id === 'nervous') ballMesh.rotation.z = (f.t < 0.6 ? f.t / 0.6 : Math.max(0, 1 - (f.t - 1.2) / 0.4)) * Math.PI / 2;   // faints, then recovers
      else if (id === 'slippery') ballMesh.rotation.z = f.t * 12;
    }
    if (f.t > 1.6) BA.flourish = null;
  }
}
// trait-flavoured landings, deaths and rescues
function ballLanded(e, first) {
  const id = bag().trait?.id;
  if (id === 'bouncy') { ballSquash(); if (first) burst(e.x, e.y, e.z, 6, 0xffc84a, { speed: 1.2, up: 1.2, life: 0.6 }); sfx.boing?.(); }
  else if (id === 'heavy' && first) { if (camera.position.distanceTo(new THREE.Vector3(e.x, e.y, e.z)) < 30) G.shake = Math.max(G.shake, 0.06); burst(e.x, e.y, e.z, 14, 0x6b4a2b, { speed: 1.6, up: 1.6, life: 0.8 }); sfx.thump?.(); }
  else if (id === 'lucky' && first && Math.hypot(e.x - G.cup.x, e.z - G.cup.z) < 3) burst(e.x, e.y, e.z, 24, 0x4fd39a, { speed: 1.5, up: 2, life: 1 });
  else if (id === 'nervous' && first) burst(e.x, e.y + 0.12, e.z, 1, 0x9fdcff, { speed: 0.1, up: 0.8, life: 0.8, grav: 3 });
}
function ballFarewell(at, died) {
  const id = bag().trait?.id, y = at.y ?? G.course.h(at.x, at.z);
  const col = { bouncy: 0xffc84a, heavy: 0xbfe6ff, slippery: 0xd8fbff, lucky: died ? 0x4fd39a : 0xffe066, feather: 0xffffff, nervous: 0x9fdcff }[id] ?? 0xffffff;
  burst(at.x, y + 0.2, at.z, died ? 20 : 40, col, { speed: id === 'heavy' ? 0.6 : 2, up: id === 'heavy' ? 3 : 2.4, life: id === 'feather' ? 2.2 : 1.2, grav: id === 'feather' ? 0.6 : id === 'heavy' && died ? -1.5 : 3 });
  if (died && id === 'bouncy') sfx.boing?.();
  if (!died) ballFlourish('saved');
}
function updateBallFace(dt) {
  const p = ballMesh.position;
  ballMesh.rotation.set(0, Math.atan2(camera.position.x - p.x, camera.position.z - p.z), 0);
  // googly pupils: they rattle when the ball moves and settle when it rests
  const moving = !!G.shot;
  // wordless acting: the pupils watch an approaching goose, or glance nervously at nearby water
  let look = null;
  const g = liveGeese().find(o => o.state === 'alert' || o.state === 'fetch');
  if (g) look = g;
  else if (G.mode === 'address') {
    const key = `${G.ball.x.toFixed(1)},${G.ball.z.toFixed(1)}`;
    if (G.waterKey !== key) { G.waterKey = key; G.waterNear = null; for (let a = 0; a < 16 && !G.waterNear; a++) for (const d of [6, 12, 18, 25]) { const x = G.ball.x + Math.cos(a * 0.39) * d, z = G.ball.z + Math.sin(a * 0.39) * d; if (G.course.surf(x, z) === 'water') { G.waterNear = { x, z }; break; } } }
    if (G.waterNear && Math.sin(G.time * 0.9) > 0.2) look = G.waterNear;
  }
  let gx = 0;
  if (look) { const yaw = ballMesh.rotation.y, dx = look.x - p.x, dz = look.z - p.z, L = Math.hypot(dx, dz) || 1; gx = clamp((dx * Math.cos(yaw) - dz * Math.sin(yaw)) / L, -1, 1); }
  for (const e of ballEyes.children) {
    const pu = e.userData.pupil, k = moving ? G.time * 23 + e.position.x * 40 : G.time * 0.7 + e.position.x * 9;
    const a = moving ? R * 0.12 : R * 0.04;
    pu.position.x = Math.sin(k) * a + gx * R * 0.13; pu.position.y = Math.cos(k * 1.3) * a;
  }
  // the name tag is event-driven (council round 6): 2 s of the name at each
  // tee, 4 s of "Hi, I'm ..." when a new ball comes into play
  G.ballTagT = Math.max(0, (G.ballTagT ?? 0) - dt);
  ballTag.visible = G.ballTagT > 0 && ballMesh.visible && G.mode === 'address' && !swing.active && !G.scoped;
  if (ballTag.visible) {
    const b = bag(), key = b.name + (G.ballTagFull ? '+' : '');
    if (ballTag.userData.name !== key) { ballTag.userData.name = key; ballTag.userData.draw(G.ballTagFull ? `👀 Hi, I'm ${b.name}.` : `👀 ${b.name}`, G.ballTagFull ? (b.range ? 'Smells of the bucket.' : b.blurb ?? `${b.trait.label}: ${b.trait.desc}`) : '', '#ffe08a', true); }
    { const k = 0.14 + camera.position.distanceTo(p) * 0.035; ballTag.scale.set(k * ballTag.userData.aspect, k, 1); ballTag.position.set(p.x, p.y + 0.12 + k * 0.5, p.z); }
    ballTag.material.opacity = Math.min(1, G.ballTagT);
  }
}
// live carry marker: slides out from the ball as you pull back
const carryRing = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.05, 40), new THREE.MeshBasicMaterial({ color: 0x4fd39a, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
carryRing.rotation.x = -Math.PI / 2; carryRing.renderOrder = 3; carryRing.visible = false; scene.add(carryRing);
// a thin light pillar over the landing spot, so a 150 m carry still reads from the tee
const carryBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 14, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0x4fd39a, transparent: true, opacity: 0.35, depthWrite: false }));
carryBeam.visible = false; scene.add(carryBeam);
const carryLabel = makeLabel2();
const puttRing = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.22, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }));
puttRing.rotation.x = -Math.PI / 2; puttRing.visible = false; scene.add(puttRing);
const aimLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 40 }, () => new THREE.Vector3())),
  new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.25, gapSize: 0.18, transparent: true, opacity: 0.8, depthWrite: false }));
aimLine.renderOrder = 3; scene.add(aimLine);
// Putting reads. A trail of dots shows how a putt at this weight would roll,
// break and all, over its first two-thirds (the last bit is still yours to
// judge). At rest it reads a dead-weight putt at the hole; while you pull back
// it reads the putt you're about to hit. The cup gets a bright pulsing ring.
const READ_N = 30;
const puttRead = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 10).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.95, depthWrite: false }), READ_N);
puttRead.renderOrder = 5; puttRead.visible = false; puttRead.frustumCulled = false; scene.add(puttRead);
const cupMark = new THREE.Mesh(new THREE.RingGeometry(0.17, 0.24, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -16 }));
cupMark.renderOrder = 6; cupMark.visible = false; scene.add(cupMark);
// while you pull back: where the putt will stop, coloured by the result (no text: it reads at a glance)
const puttEnd = new THREE.Mesh(new THREE.RingGeometry(0.09, 0.15, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -16 }));
puttEnd.renderOrder = 6; puttEnd.visible = false; scene.add(puttEnd);
const READ_COL = { short: 0xffe08a, in: 0x5fe08a, long: 0xff6f61 };
const _rm = new THREE.Matrix4(), _rq = new THREE.Quaternion(), _rs = new THREE.Vector3(), _rp = new THREE.Vector3();
let puttReadKey = '';
function updatePuttRead() {
  const base = G.mode === 'goose' && G.gooseLie ? G.gooseLie : G.ball;
  const on = G.club === 'putter' && (G.mode === 'address' || (G.mode === 'goose' && !G.shot)) && !G.walk && !!G.course;
  // the cup ring: always on when you're near the green
  const cd = G.course ? Math.hypot(G.cup.x - base.x, G.cup.z - base.z) : 1e9;
  cupMark.visible = !!G.course && cd < 45 && !['title', 'flyover', 'between', 'end', 'scare'].includes(G.mode);
  if (cupMark.visible) {
    const pulse = 1 + 0.18 * Math.sin(performance.now() / 260);
    cupMark.position.set(G.cup.x, G.course.h(G.cup.x, G.cup.z) + 0.025, G.cup.z);
    cupMark.scale.setScalar(pulse * Math.max(1, camera.position.distanceTo(cupMark.position) * 0.06));
  }
  puttRead.visible = on;
  if (!on) { puttReadKey = ''; puttEnd.visible = false; cupMark.material.color.set(0xffffff); return; }
  const p = swing.active ? (swing.phase === 'back' ? swing.back : swing.peak) : 0;
  const range = puttRange(), d = aimDir();
  const tgt = G.mode === 'goose' ? goose : G.cup;
  const metres = p > 0.02 ? p * range : Math.hypot(tgt.x - base.x, tgt.z - base.z) + 0.35;
  const key = `${base.x.toFixed(2)},${base.z.toFixed(2)},${G.yaw.toFixed(3)},${metres.toFixed(1)},${G.ballIdx},${G.powerUp?.shotLeft ?? 0},${G.holeDef?.windmill ? Math.round(wmPhase() * 4) : 0}`;
  if (key === puttReadKey) return;
  puttReadKey = key;
  const [tr, airGravity, noTrees] = modTrait();
  const L = launch('putter', puttPower(metres), d.x, d.z, 0, 1, tr);
  miniPutt(L, shotMods(false, 'putter'), 'putter');
  const sim = simulate({ course: G.course, cup: G.cup, wind: G.wind, trait: tr, colliders: G.colliders, strokeNo: G.strokes + 1, noAura: auraOff(), wmPhase: wmPhase(), airGravity, noTrees }, base, L);
  const F = sim.frames, n = sim.n;
  // path length, then dots evenly spaced along its first two-thirds
  const cum = [0]; for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(F[i * 3] - F[i * 3 - 3], F[i * 3 + 2] - F[i * 3 - 1]));
  // at rest: a read of the first two-thirds of a dead-weight putt. While pulling:
  // the whole roll to where it stops, so a full pull at a tap-in shows it running past
  const pulling = p > 0.02;
  const total = cum[n - 1] || 0.01, show = total * (pulling ? 1 : 0.66);
  const ex = F[(n - 1) * 3], ez = F[(n - 1) * 3 + 2];
  let verdict = 'short';
  if (sim.result === 'holed') verdict = 'in';
  else if ((ex - tgt.x) * d.x + (ez - tgt.z) * d.z > 0) verdict = Math.hypot(ex - tgt.x, ez - tgt.z) > 0.6 ? 'long' : 'in';
  const col = pulling ? READ_COL[verdict] : READ_COL.short;
  puttRead.material.color.setHex(col);
  puttEnd.visible = pulling && sim.result !== 'holed';
  if (puttEnd.visible) { puttEnd.position.set(ex, G.course.h(ex, ez) + 0.03, ez); puttEnd.material.color.setHex(col); puttEnd.scale.setScalar(Math.max(1, camera.position.distanceTo(puttEnd.position) * 0.08)); }
  cupMark.material.color.setHex(pulling ? col : 0xffffff);
  let j = 0;
  for (let k = 0; k < READ_N; k++) {
    const want = 0.35 + (show - 0.35) * k / (READ_N - 1);
    while (j < n - 1 && cum[j] < want) j++;
    const x = F[j * 3], z = F[j * 3 + 2];
    const fade = 1 - k / READ_N;
    _rm.compose(_rp.set(x, G.course.h(x, z) + 0.02, z), _rq.identity(), _rs.setScalar(want > show ? 0 : 0.03 + 0.025 * (pulling ? 0.6 : fade)));
    puttRead.setMatrixAt(k, _rm);
  }
  puttRead.instanceMatrix.needsUpdate = true;
}
const trailMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
const oldTrailMat = new THREE.LineBasicMaterial({ color: 0xfff4d0, transparent: true, opacity: 0.28, depthWrite: false });
const ghostTrailMat = new THREE.LineBasicMaterial({ color: 0x7ff6ff, transparent: true, opacity: 0.85, depthWrite: false });
function makeTrail(mat, n = 4000) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setDrawRange(0, 0);
  const l = new THREE.Line(g, mat); l.frustumCulled = false; scene.add(l);
  return l;
}
const liveTrail = makeTrail(trailMat), ghostTrail = makeTrail(ghostTrailMat);
function fillTrail(line, shot, upto) {
  const a = line.geometry.attributes.position;
  const n = Math.min(Math.floor(upto) + 1, shot.n, a.count);
  for (let i = 0; i < n; i++) a.setXYZ(i, shot.frames[i * 3], shot.frames[i * 3 + 1], shot.frames[i * 3 + 2]);
  a.needsUpdate = true; line.geometry.setDrawRange(0, n);
}

// ------------------------------------------------------------ particles
const MAXP = 900;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(MAXP * 3), pCol = new Float32Array(MAXP * 3);
const pVel = new Float32Array(MAXP * 3), pLife = new Float32Array(MAXP), pGrav = new Float32Array(MAXP);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, depthWrite: false, map: W.glowTexture(), alphaTest: 0.02 }));   // soft round dots, not squares
particles.frustumCulled = false; scene.add(particles);
let pNext = 0;
function burst(x, y, z, n, color, { speed = 3, up = 2, life = 1.2, grav = 9, spread = 1 } = {}) {
  const c = new THREE.Color(color);
  for (let i = 0; i < n; i++) {
    const k = pNext; pNext = (pNext + 1) % MAXP;
    pPos[k * 3] = x; pPos[k * 3 + 1] = y; pPos[k * 3 + 2] = z;
    const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7) * spread;
    pVel[k * 3] = Math.cos(a) * s; pVel[k * 3 + 1] = up * (0.5 + Math.random()); pVel[k * 3 + 2] = Math.sin(a) * s;
    const v = 0.85 + Math.random() * 0.3;
    pCol[k * 3] = c.r * v; pCol[k * 3 + 1] = c.g * v; pCol[k * 3 + 2] = c.b * v;
    pLife[k] = life * (0.6 + Math.random() * 0.6); pGrav[k] = grav;
  }
}
function updateParticles(dt) {
  for (let k = 0; k < MAXP; k++) {
    if (pLife[k] <= 0) { pPos[k * 3 + 1] = -9999; continue; }
    pLife[k] -= dt;
    pVel[k * 3 + 1] -= pGrav[k] * dt;
    pPos[k * 3] += pVel[k * 3] * dt; pPos[k * 3 + 1] += pVel[k * 3 + 1] * dt; pPos[k * 3 + 2] += pVel[k * 3 + 2] * dt;
  }
  pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
}
const CONFETTI = [0xff6f61, 0xffc84a, 0x4fd39a, 0x5fd3ff, 0xff7aa8, 0xffffff];

// ============================================================ HUD helpers
// On a phone the screen is small: tips, toasts and the power-up chip get out of
// the way after a couple of seconds (playtest: "lots of boxes"). Controls stay.
const narrow = () => matchMedia('(max-width: 760px)').matches;
const hud = {
  banner(html, ms = 1600) {
    const b = $('banner'); b.innerHTML = html; b.classList.add('show');
    clearTimeout(hud._bt); hud._bt = setTimeout(() => b.classList.remove('show'), ms);
  },
  hint(html, ms = 0, { stay = false } = {}) {
    if (html && narrow() && !stay) ms = ms ? Math.min(ms, 4500) : 4500;
    $('hint').innerHTML = html || '';
    clearTimeout(hud._ht); if (html && ms) hud._ht = setTimeout(() => { if ($('hint').innerHTML === html) $('hint').innerHTML = ''; }, ms);
  },
  flash(a = 0.6) { const f = $('flash'); f.style.transition = 'none'; f.style.opacity = a; requestAnimationFrame(() => { f.style.transition = 'opacity .35s'; f.style.opacity = 0; }); },
  toast(html) {
    const el = document.createElement('div'); el.className = 'toast'; el.innerHTML = html;
    $('toasts').appendChild(el); requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, narrow() ? 2800 : 4500);
  },
};
function renderClubs() {
  $('clubs').innerHTML = CLUB_ORDER.map((id, i) => {
    const c = CLUBS[id];
    // (round 8, S9) the same live numbers as the aim label and the putt readout
    const live = id === 'putter' ? (G.course ? honestPutt(1) : null) : G.clubCarry?.[id];
    const range = live != null ? Math.round(live) : c.range;
    return `<button class="club${G.club === id ? ' active' : ''}" data-id="${id}" role="radio" aria-checked="${G.club === id}"><b>${c.short}</b><span>${range} m${c.id === 'putter' ? '' : ' carry'}</span>${coarse ? '' : ` <kbd>${i + 1}</kbd>`}</button>`;
  }).join('');
}
$('clubs').addEventListener('click', e => { const b = e.target.closest('.club'); if (b) setClub(b.dataset.id); });
// The bag as a row of named balls (shown between holes and on the end card).
function bagHTML() {
  const balls = [...G.bag];
  if (G.ballIdx >= G.bag.length) balls.push(bag());
  return `<div class="balls">${balls.map((b, i) =>
    `<div class="ball${b.alive ? '' : ' dead'}${i === G.ballIdx ? ' active' : ''}" title="${esc(b.name)}: ${esc(b.trait.desc)}"><i>${b.alive ? '👀' : '✝'}</i><b>${esc(b.name)}</b>${esc(b.trait.label)}</div>`).join('')}</div>`;
}
function renderBag() {
  const b = bag();
  $('ballLine').querySelector('b').textContent = b.name;
  const pips = G.bag.map(x => x.alive ? '●' : '○').join('');
  $('ballLine').querySelector('span').textContent = `${b.trait.label} ${b.range ? '' : pips}`;
  ballTag.userData.name = '';   // redraw the floating name tag
}
// one ball-to-pin number for the HUD and the flyover card
function pinText(b) { const dp = dist2(b, G.cup); return dp.toFixed(dp < 10 ? 1 : 0); }
function updateHUD() {
  const h = G.holeDef; if (!h) return;
  $('holeLine').innerHTML = `Hole ${G.holeIdx + 1} <small>Par ${h.par}</small>`;
  $('roundLine').textContent = `Shot ${G.strokes + 1} · ${pinText(G.ball)} m to pin`;
  // wind relative to the view: arrow points where the wind blows
  const ws = Math.hypot(G.wind.x, G.wind.z);
  const wAng = Math.atan2(G.wind.x, -G.wind.z) + G.yaw; // screen-space: up = away from camera
  $('windArrow').style.transform = `rotate(${wAng * 180 / Math.PI - 90}deg)`;
  $('windSpeed').textContent = `${ws.toFixed(1)} m/s`;
}

// ============================================================ round + holes
let tomCache = [];   // Old Tom's planned strokes per hole
// The round seed picks crazy golf's obstacle deck. Rooms derive it from the
// room seed and round number, so everyone (and Old Tom) plays the same layout.
let roundSeed = (Math.random() * 4294967296) >>> 0, roundsStarted = 0;
const tomSalt = (Math.random() * 4294967296) >>> 0;   // Old Tom has good days and bad: a new one each visit
const holeAt = i => resolveHole(HOLES[i], roundSeed);
function setRoundSeed() {
  const next = G.room ? (G.room.seed ^ Math.imul(G.room.round || 1, 2654435761)) >>> 0 : roundsStarted ? (Math.random() * 4294967296) >>> 0 : roundSeed;
  roundsStarted++;
  if (next === roundSeed) return;
  roundSeed = next;
  HOLES.forEach((h, i) => { if (h.mini) tomCache[i] = null; });   // Tom replans the deck he'll face
}
let pbGhost = null;  // { total, name, holes: [[{sx,sy,sz,f:[...],holed,pen}]] }
// a saved best round only counts if it was played on this course (9 holes since round 7)
function loadPB() { try { pbGhost = JSON.parse(store.get('ghg3d_pb') || 'null'); } catch { pbGhost = null; } if (pbGhost && pbGhost.holes?.length !== HOLES.length) pbGhost = null; }
loadPB();
const graveyard = () => { try { return JSON.parse(store.get('ghg3d_graveyard') || '[]'); } catch { return []; } };

function shuffle(a, rng) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// In a room everyone gets the same five balls and the same wind (seeded), so
// the race is fair; the goose stays gloriously random per player.
function pickedBalls() {
  let ids = null;
  try { ids = JSON.parse(store.get('ghg3d_bag') || 'null'); } catch { ids = null; }
  if (!Array.isArray(ids) || ids.length !== 4 || !ids.every(id => SIGNATURE.some(b => b.trait === id))) ids = [...DEFAULT_PICK];
  return ids;
}
// Your four, in the order you picked them. (Rooms no longer share a bag:
// everyone picks their own; the wind stays seeded so the race is fair.)
function newBag() {
  return pickedBalls().map(id => { const s = SIGNATURE.find(b => b.trait === id); return { name: s.name, blurb: s.blurb, trait: TRAITS.find(t => t.id === id), alive: true }; });
}

function startRound(startHole = 0) {
  setRoundSeed();
  const rng = G.room ? W.mulberry32(G.room.seed) : Math.random;
  G.holeScores = []; G.ghostScores = []; G.roundRec = []; G.bag = newBag(); G.ballIdx = 0;
  G.rangeBall = { ...RANGE_BALL, alive: true };
  G.windBase.dir = rng() * Math.PI * 2;
  G.race = { status: 'level', last: 'level', round: 0 };
  G.stats = { gooseThefts: 0, gooseHits: 0, ghostHits: 0, ballsLost: 0, ballsSaved: 0, junk: [], bulletCams: 0, longestDrive: 0, pure: 0, swings: 0, moment: null };
  commentator.hysteria = 0;
  loadPB();
  // Race whichever is tougher: Old Tom, or your best round once it beats him.
  const tomTotal = G.room ? 0 : HOLES.reduce((s, _, i) => s + ensureTom(i).length, 0);   // rooms race friends, not Tom
  G.tomTotal = tomTotal;
  G.ghostSource = G.room ? 'room' : pbGhost && pbGhost.total <= tomTotal ? 'pb' : 'oldtom';
  if (G.room) resetRivalsForRound();
  renderBag();
  G.powerUp = null; G.scareDone = false; G.usedGimme = false; G.sasqRound = 0; G.lastLoss = null; G.leaderTaxed = false;
  drawWheelOrder();
  loadHole(startHole);
  for (let k = 0; k < startHole; k++) G.holeScores[k] = HOLES[k].par + 1;   // a late arrival pays a late fee
  if (startHole) { hud.toast(`Late! Bogeys on the ${startHole} hole${startHole === 1 ? '' : 's'} you missed.`); roomSendProgress(); }
}

function disposeGroup(g) {
  g.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.map?.dispose(); m.dispose(); });
  });
  scene.remove(g);
}

function resetTransient() {
  tug.active = false; $('tug').classList.add('hidden'); document.body.classList.remove('tugging', 'angling');
  angler.active = false; angler.reeling = false; $('angler').classList.add('hidden');
  rod.visible = false;
  if (swing.active) cancelSwing();
  setScope(false);
  G.shot = null; G.walk = null; G.hitstop = 0; G.celebrate = 0; G.ghostSolo = null;
  $('letterbox').classList.remove('show'); document.body.classList.remove('bullet');
  shooMesh.visible = false; ballMesh.visible = true;
  flightSound(0);
  if (G.gooseCam) endGooseCam();
}
function loadHole(i) {
  resetTransient();
  G.holeIdx = i;
  const h = holeAt(i);
  G.holeDef = h;
  if (G.holeGroup) disposeGroup(G.holeGroup);
  for (const t of G.trails) { t.geometry.dispose(); scene.remove(t); }
  G.trails = [];
  liveTrail.geometry.setDrawRange(0, 0); ghostTrail.geometry.setDrawRange(0, 0);
  const course = buildCourse(h);
  G.course = course;
  G.cup = { x: h.pin[0], z: h.pin[1] };
  const g = new THREE.Group();
  g.add(W.buildTerrainMesh(course), W.buildGreenMesh(course), W.buildWater(course));
  const trees = W.placeTrees(course, h);
  G.treeMesh = W.buildTreeMeshes(trees); g.add(G.treeMesh);
  G.colliders = prepColliders([...W.treeColliders(trees, course), ...extraColliders(course, h)]);
  G.flag = W.buildFlag(course, h.pin); g.add(G.flag);
  G.slope = W.buildSlopeArrows(course); G.slope.visible = false; g.add(G.slope);
  const mid = { x: (h.tee[0] + h.pin[0]) / 2, z: (h.tee[1] + h.pin[1]) / 2 };
  g.add(W.buildBackdrop(mid));
  // tee markers
  for (const dx of [-3.4, 3.4]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffe9c0 }));
    m.position.set(h.tee[0] + dx, course.h(h.tee[0] + dx, h.tee[1]) + 0.08, h.tee[1]); g.add(m);
  }
  if (i === 0) g.add(buildGraveyard(course, h));
  scene.add(g); G.holeGroup = g;
  G.light = env.apply(i);
  ballMesh.material.emissive.setHex(G.light?.night ? 0x334455 : 0x000000);

  // wind: per-run direction, per-hole strength
  const wr = G.room ? W.mulberry32((G.room.seed ^ Math.imul(i + 1, 2654435761)) >>> 0)() : Math.random();
  const wd = G.windBase.dir + i * 0.9, ws = h.wind * (0.75 + wr * 0.5);
  G.wind = { x: Math.cos(wd) * ws, z: Math.sin(wd) * ws };
  setWindAmbience(ws);
  setAmbience(h.spotlight === 'scare' ? 0.3 : 1);

  G.wheel = null; $('wheel').classList.add('hidden'); G.baitPending = false;
  if (G.sasq) endSasquack(); G.sasqHole = false; G.treeHitAt = null;
  G.knockQ = null; G.teethHole = false; G.teethUsed = false; G.teethTargets = new Set(); G.teethPick = false; G.standMode = false; G.myFan = null; G.putBack = null;
  for (const id of [...fans.keys()]) dropFan(id);
  for (const g of geese) if (g.puppetOf) { if (g.label) scene.remove(g.label); g.puppetOf = null; g.label = null; }
  G.relay = null; G.brood = null; G.hammer = null; G.eggBall = false; if (adoptee) { scene.remove(adoptee.mesh); adoptee = null; }
  G.finalWait = null; $('finalGroup').classList.add('hidden');
  G.powerUp = null; renderPowerChip(); G.sicPending = null; G.sicFrom = null; G.sabReport = null; G.gimmeOffer = null; G.possess = false; $('gimme').classList.add('hidden');
  for (const id of [...puppets.keys()]) dropPuppet(id);
  G.strokes = 0; G.stymieTold = false; G.tomNudged = false; G.ghostGlide = null; G.scared = G.scared && G.holeIdx > 0;
  pickUnit(); lastPreview = ''; G.previewCarry = null; G.clubCarry = null; G.clubCarries = null;
  G.ball = { x: h.tee[0], z: h.tee[1], y: course.h(h.tee[0], h.tee[1]) + R };
  G.lastLie = { ...G.ball };
  aimAtPoint(h.path[1][0], h.path[1][1]);
  G.pitch = -0.17;
  autoClub();
  spawnGeese();
  setupGhost();
  setupHoleExtras(h, g);
  G.docks = computeDocks(course, h);
  for (const d of G.docks) g.add(buildDock(d));
  G.race.status = 'level'; G.race.last = 'level';
  G.mode = 'address';
  snapAddressCam();
  updateHUD();
  hud.hint('');
  G.ballTagT = 2; G.ballTagFull = false; G.idleSince = 0;
  G.playerAt = { x: h.tee[0] - 0.9, z: h.tee[1] + 0.5 };
  for (const r of rivals.values()) { finishRivalShot(r, true); r.trail.geometry.setDrawRange(0, 0); }
  roomSendProgress();
  if (G.booted) startFlyover();
  // plan the rest of Old Tom's round in the background (normally already done on the title card)
  if (!tomCache[i + 1]) setTimeout(() => ensureTom(i + 1), 400);
}

// Control hints: 7 words or fewer, shown on the first shot, then again only
// if the player stalls at address.
// (round 8, S10) "lift to cancel" replaces S14: letting go before the flick cancels the swing
const CONTROL_HINT = coarse => coarse ? '↔ Drag the course to aim<br>↓↑ On the pad: drag down, flick up<br>✋ Lift your finger to cancel' : '↔ Drag sideways to aim<br>↓↑ Drag down, flick up to swing<br>✋ Let go to cancel';
function holeHint() {
  const s = G.holeDef.spotlight;
  if (!G.hintsShown.swing) return CONTROL_HINT(coarse);
  if (s === 'angler') return 'Water ahead. Balls can drown.';
  if (s === 'scope') return coarse ? 'Windy! Tap 🔭 to zoom.' : 'Windy! Hold right-click to zoom.';
  return G.holeDef.hint ?? '';
}
// Called every frame at address: re-show the controls after a long stall.
function updateIdleHint(dt) {
  const now = performance.now();   // wall clock: a slow frame rate mustn't stretch the wait
  if (G.mode !== 'address' || swing.active || G.scoped || !G.idleSince) { G.idleSince = now; G.idleHint = false; return; }
  if (now - G.idleSince > 14000 && !G.idleHint) { hud.hint(CONTROL_HINT(coarse)); G.idleHint = true; }
}

function buildGraveyard(course, h) {
  const g = new THREE.Group();
  const bx = h.tee[0] - 8, bz = h.tee[1] - 9;
  const place = (m, x, z, rot = 0.5) => { m.position.set(x, course.h(x, z) - 0.02, z); m.rotation.y = rot; g.add(m); };
  place(W.buildTombstone([{ text: 'OLD TOM', font: 'bold 44px Georgia, serif' }, 'Club Pro', { text: 'Par was his religion', font: 'italic 22px Georgia, serif' }], true), bx, bz, 0.6);
  const dead = graveyard().slice(-24).reverse();
  dead.forEach((d, k) => {
    const row = Math.floor(k / 6), col = k % 6;
    place(W.buildTombstone([{ text: d.name, font: 'bold 32px Georgia, serif' }, { text: d.trait ?? '', font: 'italic 22px Georgia, serif' }, { text: `Hole ${d.hole} · ${d.date ?? ''}`, font: '18px Georgia, serif' }]),
      bx - 1.6 - col * 1.1, bz + 1.2 + row * 1.2 - col * 0.3, 0.55);
  });
  const fence = new THREE.MeshStandardMaterial({ color: 0x3a2e28 });
  for (let k = 0; k < 9; k++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 0.06), fence);
    place(p, bx + 1.4 - k * 1.1, bz - 1.2 - k * 0.3, 0);
    p.position.y += 0.4;
  }
  const nDead = graveyard().length;
  const sign = W.buildLabel(nDead ? `⚰ ${nDead} BALL${nDead === 1 ? '' : 'S'} LOST` : '⚰ BALL CEMETERY', '#fff', 'rgba(40,30,30,0.75)');
  sign.position.set(bx - 1.5, course.h(bx, bz) + 2.4, bz); sign.scale.set(2.4, 0.6, 1);
  g.add(sign);
  return g;
}

function vars() {
  if (G.room) { const r = closestRival(); return { name: G.playerName, ball: bag().name, ghost: r?.name ?? 'the field', rival: r?.name ?? 'the field' }; }
  return { name: G.playerName, ball: bag().name, ghost: G.ghostSource === 'pb' ? 'your old self' : 'Old Tom' };
}

// ============================================================ aiming + clubs
function fwd(yaw) { return { x: -Math.sin(yaw), z: -Math.cos(yaw) }; }
function aimAtPoint(x, z) { G.yaw = Math.atan2(-(x - G.ball.x), -(z - G.ball.z)); }
function setClub(id) {
  if (!CLUBS[id] || G.club === id) { renderClubs(); return; }
  G.club = id; renderClubs(); sfx.tick();
  for (const [k, m] of Object.entries(club.userData.heads)) m.visible = k === id;
  if (G.mode === 'address' || G.mode === 'goose') snapAddressCam(true);
  G.previewDirty = true;
}
function autoClub() {
  const d = dist2(G.ball, G.cup), s = G.course.surf(G.ball.x, G.ball.z);
  let id = 'driver';
  if ((s === 'green' || s === 'fringe') && d < 26) id = 'putter';
  else if (d < 70) id = 'wedge';
  else if (d < 125) id = 'iron';
  else if (s === 'sand' || s === 'rough') id = 'iron';
  G.club = null; setClub(id);
  renderClubs();
}

// The putter's full stroke scales to the putt: a 2 m tap and a 15 m lag both
// use the whole pull-back, so short putts aren't a 30-pixel twitch. Tiers
// (not a continuous scale) so the feel is learnable: "this is a 6 m putt".
const PUTT_TIERS = [2, 3, 6, 10, 15, 21];   // the smallest keeps a full pull honest on a tap-in
// (round 8, S9) what a pull of `p` really rolls on a flat green, with this
// ball's trait and any power-up: the one number the readout, ring and button use
function honestPutt(p, range = puttRange()) { return puttMetres(puttPower(p * range), modTrait()[0]); }
function puttRange() {
  const base = G.mode === 'goose' && G.gooseLie ? G.gooseLie : G.ball;
  const tgt = G.mode === 'goose' ? goose : G.cup;
  const d = Math.hypot(tgt.x - base.x, tgt.z - base.z) * 1.3;
  return PUTT_TIERS.find(t => t >= d) ?? PUTT_TIERS.at(-1);
}

// ============================================================ ghost (rival)
function ensureTom(i) {
  if (i >= HOLES.length || tomCache[i]) return tomCache[i];
  const h = holeAt(i);
  const here = i === G.holeIdx && G.holeDef?.deckIdx === h.deckIdx && !!G.course;
  const course = here ? G.course : buildCourse(h);
  const cols = here ? G.colliders : prepColliders([...W.treeColliders(W.placeTrees(course, h), course), ...extraColliders(course, h)]);
  // crazy golf's lane is 2.8 m wide: Tom tees up just beside you, not 1.3 m off
  tomCache[i] = planHole(course, h, { x: h.pin[0], z: h.pin[1] }, cols, h.mini ? { x: -0.6, z: 0.3 } : undefined, tomSalt);
  return tomCache[i];
}
function decodeFrames(f) {
  const n4 = Math.floor(f.length / 3);
  const n = Math.max(1, (n4 - 1) * 4 + 1), frames = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i / 4), t = (i % 4) / 4, b = Math.min(n4 - 1, a + 1);
    for (let k = 0; k < 3; k++) frames[i * 3 + k] = lerp(f[a * 3 + k], f[b * 3 + k], t) / 100;
  }
  return { frames, n };
}
function decodePB(holeStrokes) {
  return holeStrokes.map(s => {
    if (s.pen) return { penaltyOnly: true, start: { x: s.sx, y: s.sy, z: s.sz } };
    const { frames, n } = decodeFrames(s.f);
    return { start: { x: s.sx, y: s.sy, z: s.sz }, shot: { frames, n, result: s.res ?? (s.holed ? 'holed' : 'rest') } };
  });
}
function setupGhost() {
  if (G.room) {   // friends are the race; Old Tom sits this one out
    G.ghost = { override: null, strokes: [], played: 0, rest: { x: 1e4, y: -50, z: 1e4 }, holed: false, playing: null };
    G.ghostScores[G.holeIdx] = 0;
    return;
  }
  let strokes;
  if (G.ghostSource === 'pb' && pbGhost?.holes?.[G.holeIdx] && (pbGhost.decks?.[G.holeIdx] ?? null) === (G.holeDef.deckIdx ?? null)) strokes = decodePB(pbGhost.holes[G.holeIdx]);
  else strokes = ensureTom(G.holeIdx).map(s => s.penaltyOnly ? { penaltyOnly: true, start: s.start } : { start: s.start, shot: s.shot });
  const first = strokes[0]?.start ?? { x: G.ball.x - 1.3, z: G.ball.z };
  G.ghost = { override: null, strokes, played: 0, rest: { x: first.x, y: G.course.h(first.x, first.z) + R, z: first.z }, holed: false, playing: null };
  G.ghostScores[G.holeIdx] = strokes.length;
  placeGhostMesh(G.ghost.rest);
}
function ghostHoledBy(n) { return G.ghost.strokes.length <= n && G.ghost.strokes.at(-1)?.shot?.result === 'holed'; }
function ghostRestAfter(n) {
  if (G.ghost.override && G.ghost.override.n === n) return { ...G.ghost.override };
  const st = G.ghost.strokes;
  let pos = { ...G.ghost.rest };
  for (let k = 0; k < Math.min(n, st.length); k++) {
    const s = st[k];
    if (s.penaltyOnly || !s.shot) continue;
    if (s.shot.result === 'holed') return { x: G.cup.x, y: G.course.h(G.cup.x, G.cup.z) - 0.05, z: G.cup.z, holed: true };
    if (s.shot.result === 'water' || s.shot.result === 'oob') { pos = { x: s.start.x, y: G.course.h(s.start.x, s.start.z) + R, z: s.start.z }; continue; }
    const f = frameAt(s.shot, s.shot.n - 1); pos = { x: f.x, y: f.y, z: f.z };
  }
  return pos;
}
function placeGhostMesh(p) { ghostMesh.position.set(p.x, p.y, p.z); }
// On the green the ghost keeps golf etiquette: you putt, then he does. His
// ball stays put while you putt, which is what makes a stymie real.
function isPuttStroke(s) { return s && !s.penaltyOnly && s.shot && ['green', 'fringe'].includes(G.course.surf(s.start.x, s.start.z)); }
// Collision function handed to the sim for the player's stroke N.
function ghostColliderFor(strokeNo, lie) {
  if (G.room || (G.holeDef.spotlight === 'scare' && !G.scareDone)) return null;
  const s = G.ghost.override?.n === strokeNo - 1 ? null : G.ghost.strokes[strokeNo - 1];   // parked on your line: he waits
  const rest = ghostRestAfter(strokeNo - 1);
  const solid = p => !(p.holed) && Math.hypot(p.x - G.cup.x, p.z - G.cup.z) > 0.15 + GHOST_R;
  if (Math.hypot(rest.x - lie.x, rest.z - lie.z) < 0.3) return null;     // overlapping your lie: not solid
  if (s && !s.penaltyOnly && s.shot && !isPuttStroke(s)) {
    const sh = s.shot;
    return f => {
      const p = frameAt(sh, f);
      if (f >= sh.n - 1) { if (sh.result === 'holed' || sh.result === 'water' || sh.result === 'oob') return null; p.vx = p.vy = p.vz = 0; }
      return solid(p) ? p : null;
    };
  }
  if (!solid(rest)) return null;
  const p = { ...rest, vx: 0, vy: 0, vz: 0 };
  return () => p;
}
function raceStatus() {
  const n = G.strokes;
  const holedMe = G.mode === 'holed';
  const gHoled = ghostHoledBy(n);
  if (holedMe && gHoled) { const a = n, b = G.ghost.strokes.length; return a < b ? 'ahead' : a > b ? 'behind' : 'level'; }
  if (gHoled) return 'behind';
  if (holedMe) return 'ahead';
  const gp = ghostRestAfter(n);
  const dm = dist2(G.ball, G.cup), dg = Math.hypot(gp.x - G.cup.x, gp.z - G.cup.z);
  if (Math.abs(dm - dg) < 1) return 'level';
  return dm < dg ? 'ahead' : 'behind';
}
// Old Tom's own voice: solo rounds against him only, after the commentator has had their say.
const tomTalks = () => !G.room && G.ghostSource === 'oldtom';
function tomLater(cls, ms = 3200) { if (tomTalks()) setTimeout(() => { if (tomTalks() && !['title', 'end'].includes(G.mode)) tomSay(cls); }, ms); }

// The race against Old Tom has no HUD panel any more (playtest: too many
// menus). It lives in the commentary, in Old Tom's own body language, and in
// the between-hole card.
function updateRace() {
  if (G.room) { updateRoomRace(); return; }
  const st = raceStatus();
  G.race.last = G.race.status; G.race.status = st;
  if (st !== G.race.last) {
    if (st === 'ahead') { sfx.overtake(); say('overtake', vars(), { bump: -6 }); tomLater('behind', 3800); }
    else if (st === 'behind') { sfx.fallBehind(); setTimeout(() => say('fallBehind', vars(), { bump: 6 }), 1600); tomLater('ahead', 5200); }
  }
}

// ============================================================ geese
// Several geese per hole. Any of them will steal a ball that stops in its
// patch; the thief becomes `goose` for the goose cam and the tug-of-war.
const geese = [];
let goose = null;
const liveGeese = () => geese.slice(0, G.geeseN ?? 1);
function makeGoose(breed = 'embden') {
  const mesh = buildGooseBreed(breed); scene.add(mesh);
  return { mesh, state: 'graze', x: 0, z: 0, yaw: 0, target: null, t: 0, timer: 0, phase: Math.random() * 6, carry: false, frozen: false, home: null, carryT: 0, radius: 9 };
}
function spawnGeese() {
  const h = G.holeDef;
  const defs = h.geese ?? (h.goose ? [h.goose] : []);
  const n = defs.length + (h.goslings ?? 0);
  while (geese.length < n) geese.push(makeGoose());
  G.geeseN = n;
  // three breeds: swap a goose's body if this hole wants a different one
  for (let k = 0; k < n; k++) {
    const want = defs[k]?.breed ?? 'embden', g = geese[k];
    if (g.breed === want && g.mesh) continue;
    if (g.mesh) scene.remove(g.mesh);
    g.mesh = buildGooseBreed(want); scene.add(g.mesh); g.breed = want;
    if (g.crown) { g.crown = null; }
  }
  geese.forEach((g, k) => { g.mesh.visible = k < n; if (g.label) g.label.visible = false; });
  const rng = Math.random;
  for (let k = 0; k < n; k++) {
    const g = geese[k], d = defs[k], gosling = !d;
    const [cx, cz, r] = d ? d.area : [geese[0].home.x, geese[0].home.z, 2];
    const a = rng() * Math.PI * 2, dd = rng() * r;
    Object.assign(g, {
      state: 'graze', x: cx + Math.cos(a) * dd, z: cz + Math.sin(a) * dd, target: null, t: 0, timer: 1 + rng() * 2, carry: false, frozen: false,
      home: { x: cx, z: cz, r }, radius: d?.radius ?? 0, yaw: rng() * 6, fly: 0,
      boss: !!d?.boss, stare: !!d?.stare, gosling, parent: gosling ? geese[0] : null, slot: k - defs.length, escT: 0, ceremony: null, climb: 0,
    });
    if (gosling) { g.x = cx + 1 + g.slot * 0.6; g.z = cz + 1; }
    if (!validLand(g.x, g.z)) { g.x = cx; g.z = cz; }
    g.mesh.scale.setScalar(1.15 * (g.boss ? 1.8 : gosling ? 0.45 : 1));
    g.mesh.userData.carry.clear();
    g.mesh.userData.alert.visible = false;
    if (!g.boss && g.crown) {   // last round's boss is an ordinary goose again (a restart after the finale)
      g.crown.crown.parent?.remove(g.crown.crown); g.crown.aura.parent?.remove(g.crown.aura); g.crown = null;
    }
    if (g.boss && !g.crown) {
      // the boss wears a crown and stands in its own purple aura
      g.crown = buildBossCrown();
      g.mesh.userData.neckPivot.add(g.crown.crown); g.mesh.add(g.crown.aura);
    }
    if (g.boss) {
      g.label ??= W.buildLabel('🪿 THE BOSS', '#fff', 'rgba(120,20,30,0.8)');
      if (!g.label.parent) scene.add(g.label);
      g.label.visible = true;
    }
  }
  goose = null;
  G.thefts = 0; G.lastTheftStroke = -9; G.snatches = 0; G.disrupt = 0;
}
// (round 8, S1) the disruption budget: at most one *random* setback per player
// per hole (a wild goose grab, a curious goose, the Boss, Goose Bait, the
// Sasquack). A friend's goose (Sic 'Em, Teeth) is outside the cap. Geese stay;
// once the budget is spent they just graze and stare.
const disruptionSpent = () => (G.disrupt ?? 0) >= 1;
function spendDisruption() { G.disrupt = (G.disrupt ?? 0) + 1; }
// point + left-normal at fraction t along a polyline
function pathPoint(path, t) {
  const seg = []; let total = 0;
  for (let i = 0; i < path.length - 1; i++) { const L = Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]); seg.push(L); total += L; }
  let d = t * total;
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const k = Math.min(1, d / seg[i]), [ax, az] = path[i], [bx, bz] = path[i + 1], L = seg[i] || 1;
      return { x: ax + (bx - ax) * k, z: az + (bz - az) * k, nx: -(bz - az) / L, nz: (bx - ax) / L };
    }
    d -= seg[i];
  }
}
function gooseCollider() {
  const out = [];
  liveGeese().forEach((g, k) => {
    if (g.carry || g.state === 'flee' || g.fly > 0) return;
    const [dy, r] = g.boss ? [0.75, 0.8] : g.gosling ? [0.18, 0.2] : [0.42, 0.46];
    out.push({ kind: 'sphere', x: g.x, y: G.course.h(g.x, g.z) + dy, z: g.z, r, e: 0.35, tag: 'goose:' + k });
  });
  return out;
}
// playable and visibly dry (not on a bank under the water plane)
function validLand(x, z) { const s = G.course.surf(x, z); return s !== 'water' && s !== 'oob' && G.course.h(x, z) > G.course.waterLevelAt(x, z) + 0.12; }
function pickGooseTarget(g) {
  // waddle away from the player, preferring somewhere annoying
  const away = Math.atan2(g.z - camera.position.z, g.x - camera.position.x);
  for (let k = 0; k < 24; k++) {
    const a = away + (Math.random() - 0.5) * 2.2, d = 14 + Math.random() * 14;
    const x = g.x + Math.cos(a) * d, z = g.z + Math.sin(a) * d;
    let ok = true;
    for (let t = 0.2; t <= 1.0001; t += 0.2) if (!validLand(lerp(g.x, x, t), lerp(g.z, z, t))) { ok = false; break; }
    if (ok) return { x, z };
  }
  return { x: g.x, z: g.z };
}
function updateGeese(dt) { for (const g of liveGeese()) updateGoose(g, dt); }
function updateGoose(g, dt) {
  const u = g.mesh.userData;
  g.phase += dt;
  // the theft clock is wall time, so it stays in step with the song even on a slow frame rate
  if (g.carry) g.carryT = (performance.now() - (g.carryStart ?? performance.now())) / 1000;
  let speed = 0;
  const moveTo = (tx, tz, sp) => {
    const dx = tx - g.x, dz = tz - g.z, d = Math.hypot(dx, dz);
    if (d < 0.15) return true;
    const want = Math.atan2(dx, dz);
    let dy = want - g.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    g.yaw += clamp(dy, -6 * dt, 6 * dt);
    const step = Math.min(d, sp * dt);
    const nx = g.x + dx / d * step, nz = g.z + dz / d * step;
    if (g.fly > 0 || validLand(nx, nz)) { g.x = nx; g.z = nz; } else return true;
    speed = sp;
    return false;
  };
  // the theft lasts exactly one performance of the goose's song, then it's a tug-of-war
  if (g === goose && g.carry && g.state === 'carry' && g.carryT > GOOSE_SONG_SECS) startTug();
  if (g.frozen) {
    const look = G.shot ? shotPos() : G.ball;
    const want = Math.atan2(look.x - g.x, look.z - g.z);
    let dy = want - g.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    g.yaw += clamp(dy, -3 * dt, 3 * dt);
  } else if (g.state === 'graze' && g.stare && !G.scareDone && G.mode === 'address' && dist2(G.ball, G.cup) < 60) {
    // the graveyard: they know something you don't. Frozen, staring at the cup.
    g.yaw = Math.atan2(G.cup.x - g.x, G.cup.z - g.z);
  } else if (g.state === 'graze' && goose?.boss && goose.carry && g !== goose && !g.stare && dist2(g, goose) < 40) {
    // the Goose Parliament escorts its boss in a V
    if ((g.escT -= dt) <= 0) {
      g.escT = 0.5;
      const esc = liveGeese().filter(o => o !== goose && o.state === 'graze' && dist2(o, goose) < 40), i = esc.indexOf(g) + 1;
      const fx = Math.sin(goose.yaw), fz = Math.cos(goose.yaw), side = i % 2 ? 1 : -1, row = Math.ceil(i / 2);
      g.target = { x: goose.x - fx * 1.8 * row + fz * 1.4 * row * side, z: goose.z - fz * 1.8 * row - fx * 1.4 * row * side };
    }
    if (g.target) moveTo(g.target.x, g.target.z, 3.2);
  } else if (g.state === 'graze' && g.gosling) {
    // goslings toddle after the first adult
    const p = g.parent, fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    const tx = p.x - fx * (0.9 + 0.5 * g.slot) + fz * (g.slot % 2 ? 0.5 : -0.5), tz = p.z - fz * (0.9 + 0.5 * g.slot) - fx * (g.slot % 2 ? 0.5 : -0.5);
    if (dist2(g, { x: tx, z: tz }) > 0.4) moveTo(tx, tz, Math.min(4, 1.2 + dist2(g, { x: tx, z: tz })));
  } else if (g.state === 'graze') {
    g.timer -= dt;
    if (g.approach && G.mode === 'address' && canSnatch()) {
      const d = dist2(g, G.ball);
      if (d < 6 && !g.warned) { g.warned = true; sfx.honk(1); hud.hint('🪿 Hurry. A goose is curious.', 4000); g.mesh.userData.alert.visible = true; setTimeout(() => { if (g.state === 'graze') g.mesh.userData.alert.visible = false; }, 900); }
      if (d < 1.0 && !swing.active) { G.snatches = (G.snatches ?? 0) + 1; spendDisruption(); startTheft(g, 0.6); }
      else if (!(swing.active && d < 1.2)) moveTo(G.ball.x, G.ball.z, (g.breed === 'canada' ? 2.0 : g.breed === 'toulouse' ? 1.2 : 1.6));
    } else if (g.target) { if (moveTo(g.target.x, g.target.z, g.curious ? 1.4 : 1.0)) { g.target = null; g.curious = false; } }
    else if (G.mode === 'address' && !g.gosling && dist2(g, G.ball) < 30) {
      // every few seconds it stops pecking and gives your ball a long look
      g.glance = (g.glance ?? 2 + Math.random() * 3) - dt;
      if (g.glance < 1.5 && g.glance > 0) g.yaw += clamp(Math.atan2(Math.sin(Math.atan2(G.ball.x - g.x, G.ball.z - g.z) - g.yaw), Math.cos(Math.atan2(G.ball.x - g.x, G.ball.z - g.z) - g.yaw)), -4 * dt, 4 * dt);
      if (g.glance <= 0) g.glance = 3 + Math.random() * 3;
      if (g.timer <= 0) g.timer = 2 + Math.random() * 3;
    }
    else if (g.timer <= 0) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * g.home.r;
      const tx = g.home.x + Math.cos(a) * d, tz = g.home.z + Math.sin(a) * d;
      if (validLand(tx, tz)) g.target = { x: tx, z: tz };
      g.timer = 2 + Math.random() * 3;
    }
  } else if (g.state === 'alert') {
    g.t -= dt;
    g.yaw = Math.atan2(G.ball.x - g.x, G.ball.z - g.z);
    if (g.t <= 0) { g.state = 'fetch'; u.alert.visible = false; }
  } else if (g.state === 'fetch') {
    if (moveTo(G.ball.x, G.ball.z, g.boss ? 11 : 9) || dist2(g, G.ball) < 0.5) grabBall(g);   // a goose on a mission is fast
  } else if (g.state === 'carry') {
    if (g.target && moveTo(g.target.x, g.target.z, 2.6)) g.target = null;
    if (!g.target && Math.random() < dt * 0.6) g.target = pickGooseTarget(g);
  } else if (g.state === 'relay') {
    if (g.target && moveTo(g.target.x, g.target.z, 7)) g.target = null;
  } else if (g.state === 'tug') {
    // planted, leaning back, head thrashing (driven by the tug state)
  } else if (g.state === 'fly') {
    if (g.ceremony) {   // a V over the mesa, in front of the camera, then off toward the moon
      const c = g.ceremony, t = c.passed ? c.to : c.via;
      if (!c.passed && Math.hypot(t.x - g.x, t.z - g.z) < 3) c.passed = true;
      g.climb = (g.climb ?? 0) + dt * 3.6; moveTo(t.x, t.z, 24);
    }
    else if (moveTo(g.target.x, g.target.z, 16)) landGooseFlight(g);
    speed = 0;
  } else if (g.state === 'flee') {
    g.t -= dt;
    if (g.target) moveTo(g.target.x, g.target.z, 7);
    if (g.t <= 0) { g.state = 'graze'; g.target = null; }
  }
  // animate
  const gy = G.course.h(g.x, g.z);
  if (g.ceremony && g.state !== 'fly' && (g.ceremony.delay -= dt) <= 0) { g.state = 'fly'; g.climb = 0; sfx.honk(1); }
  const flyLift = g.state === 'fly' ? 2.2 + Math.sin(g.phase * 3) * 0.3 + (g.climb ?? 0) : 0;
  g.fly = flyLift;
  g.mesh.position.set(g.x, gy + flyLift, g.z);
  g.mesh.rotation.y = g.yaw;
  const wob = speed > 0 ? Math.sin(g.phase * (6 + speed * 2)) : 0;
  u.body.rotation.z = wob * 0.12;
  u.legL.rotation.x = wob * 0.6; u.legR.rotation.x = -wob * 0.6;
  u.footL.position.z = 0.06 + wob * 0.08; u.footR.position.z = 0.06 - wob * 0.08;
  const peck = g.state === 'graze' && !g.target ? Math.max(0, Math.sin(g.phase * 1.7)) ** 6 : 0;
  // while carrying, it head-bobs on the beat of its own theme song (132 bpm)
  const strut = g.carry && g.state === 'carry' ? Math.abs(Math.sin(g.carryT * Math.PI * 2.2)) * 0.35 : 0;
  const thrash = g.state === 'tug' ? Math.sin(g.phase * 17) * 0.25 * (0.4 + tug.yank) : 0;
  const staring = g.stare && !G.scareDone && g.state === 'graze' && G.mode === 'address' && dist2(G.ball, G.cup) < 60;
  g.perk = Math.max(0, (g.perk ?? 0) - dt);
  const skyward = g.frozen && G.shot && shotPos().y - G.course.h(g.x, g.z) > 5 ? -0.3 : 0;
  u.neckPivot.rotation.x = (staring || g.perk > 0 ? 0 : peck * 1.4) + strut + skyward + (g.state === 'fetch' ? 0.6 : 0) + (g.state === 'alert' || staring || g.perk > 0 ? -0.2 : 0) + (g.state === 'tug' ? -0.35 : 0);
  u.neckPivot.rotation.y = thrash;
  g.mesh.rotation.x = g.state === 'tug' ? -0.18 * (1 - tug.p / 100) + 0.1 : 0;   // leans back while it's winning
  const flap = g.state === 'flee' || g.state === 'fetch' || g.state === 'fly' || g.state === 'relay' || (g.state === 'tug' && tug.yank > 0.3) ? Math.sin(g.phase * 22) * 0.9 : 0;
  u.wingL.rotation.z = -Math.abs(flap); u.wingR.rotation.z = Math.abs(flap);
  if (g.crown) { animateBossCrown(g.crown, g.phase); g.crown.aura.visible = !g.fly; }
  if (g.puppetOf && g.label) scaleLabel(g.label, g.mesh.position, 1.7, 0.04);
  if (g.boss && g.label) { scaleLabel(g.label, g.mesh.position, 3.4, 0.04); g.label.visible = G.mode !== 'title' && dist2(g, camera.position) > 10; }
}
// Fairness: at most two thefts per hole, never on the stroke right after one,
// never near the cup, and every drop is a playable lie with no stroke added.
function maybeGooseSteal() {
  if (G.thefts >= 2 || G.strokes === G.lastTheftStroke + 1) { G.sicPending = null; return false; }
  const s = G.course.surf(G.ball.x, G.ball.z);
  if (s === 'green' || s === 'fringe') return false;   // a sent goose waits for a better moment
  const friend = !!(G.sicPending && G.sicFrom);
  if (!friend && disruptionSpent() && !(G.powerUp?.taxi && !G.powerUp.taxiUsed)) return false;
  const sic = G.sicPending, sicFrom = G.sicFrom; G.sicPending = null; G.sicFrom = null;
  const bait = !!G.baitPending, taxi = !!(G.powerUp?.taxi && !G.powerUp.taxiUsed);
  const forced = !!(sic || bait || taxi);   // a goose that was sent for you ignores its patch
  const mult = 1;
  let best = null;
  for (const g of liveGeese()) {
    if (g.state !== 'graze' || g.frozen || g.gosling || (g.stare && !G.scareDone && !forced)) continue;
    const d = dist2(g, G.ball);
    if ((forced || d <= g.radius * mult) && (!best || d < best.d)) best = { g, d };
  }
  if (!best) return false;
  const g = best.g;
  if (forced && best.d > 45) {
    // a goose sent by a friend arrives with a flap
    const a = Math.random() * Math.PI * 2;
    for (let k = 0; k < 12; k++) { const x = G.ball.x + Math.cos(a + k) * 20, z = G.ball.z + Math.sin(a + k) * 20; if (validLand(x, z)) { g.x = x; g.z = z; break; } }
    burst(g.x, G.course.h(g.x, g.z) + 0.8, g.z, 30, 0xffffff, { speed: 2.5, up: 2, life: 1.2, grav: 2 });
  }
  if (sic) hud.toast(`🪿 ${esc(sic)} sent a goose.`);
  if (bait) { G.baitPending = false; hud.toast('🍞 It smelled the bread.'); }
  g.taxi = false; g.sentBy = sic && sicFrom ? sicFrom : null;   // (S3) whoever sent it hears how it went
  if (taxi && !sic && !bait) { G.powerUp.taxiUsed = true; g.taxi = true; }
  if (!g.sentBy && !g.taxi) spendDisruption();
  startTheft(g, 1.0);   // (S1) a full second of "!" and honk before it moves: you see it coming
  return true;
}
function startTheft(g, alertT = 0.7) {
  goose = g;
  for (const o of liveGeese()) o.approach = false;
  G.thefts++; G.lastTheftStroke = G.strokes;
  if (swing.active) cancelSwing();
  g.state = 'alert'; g.t = alertT;
  g.mesh.userData.alert.visible = true;
  sfx.honk(2);
  hud.banner('🪿 HONK!', 900);
  G.mode = 'gooseFetch';
}
// A curious goose that reaches your ball while you're lining up takes it.
function canSnatch({ teeth = false } = {}) {
  const s = G.course.surf(G.ball.x, G.ball.z);
  return G.thefts < 2 && G.strokes !== G.lastTheftStroke + 1 && G.strokes !== G.lastTheftStroke && G.strokes > 0 && (teeth || ((G.snatches ?? 0) < 1 && !disruptionSpent()))
    && s !== 'green' && s !== 'fringe' && !(G.holeDef.spotlight === 'scare' && !G.scareDone) && !G.powerUp?.immune;
}
function grabBall(g) {
  goose = g;
  g.state = 'carry'; g.carry = true; g.carryT = 0; g.carryStart = performance.now(); g.target = pickGooseTarget(g);
  const held = W.buildBall(0xffffff); held.castShadow = false;
  held.add(ballEyes.clone());
  g.mesh.userData.carry.add(held);
  ballMesh.visible = false;
  G.stats.gooseThefts++;
  sfx.honk(1);
  say('gooseTheft', vars(), { bump: 14 });
  // GOOSE CAM: you watch your ball leave in its beak, to its theme song, and
  // there is nothing you can do about it... until the song ends.
  G.mode = 'gooseCam';
  G.gooseLie = { ...G.ball };
  G.gooseCam = { pos: camera.position.clone(), t: 0 };
  G.stopGooseSong?.(); G.stopGooseSong = gooseSong({ transpose: g.boss ? -5 : 0 });
  if (swing.active) cancelSwing();
  setScope(false);
  $('bulletLbl').textContent = '🪿 GOOSE CAM';
  $('letterbox').classList.add('show'); document.body.classList.add('bullet', 'goosecam');
  hud.hint('');
  if (g.taxi) {
    // Goose Taxi: no song, no tug. It just takes your ball for a short flight somewhere else.
    g.taxi = false; G.stopGooseSong?.(); G.stopGooseSong = null;
    g.state = 'fly'; g.target = taxiSpot(); g.flyT = 0;
    $('bulletLbl').textContent = '🪿 GOOSE TAXI';
    sfx.honk(2);
  }
}
function taxiSpot() {
  for (let k = 0; k < 40; k++) {
    const a = Math.random() * Math.PI * 2, d = 20 + Math.random() * 10;
    const x = G.ball.x + Math.cos(a) * d, z = G.ball.z + Math.sin(a) * d, s = G.course.surf(x, z);
    if (validLand(x, z) && s !== 'green' && s !== 'fringe') return { x, z };
  }
  return { x: G.ball.x, z: G.ball.z };
}
// Life Ring relief: the nearest playable, non-sand lie that isn't nearer the cup
function ringRelief(from) {
  const d0 = dist2(from, G.cup);
  for (let r = 1; r <= 20; r++) for (let k = 0; k < 16; k++) {
    const a = k / 16 * Math.PI * 2, x = from.x + Math.cos(a) * r, z = from.z + Math.sin(a) * r;
    if (validLand(x, z) && G.course.surf(x, z) !== 'sand' && Math.hypot(x - G.cup.x, z - G.cup.z) >= d0 - 0.01) return { x, z };
  }
  return null;
}
function useLifeRing(at) {
  if (!(G.powerUp?.lifeRing > 0) || G.course.surf(at.x, at.z) !== 'sand') return at;
  const p = ringRelief(at); if (!p) return at;
  G.powerUp.lifeRing = 0; renderPowerChip();
  (sfx.lifeRing ?? sfx.catchBall)();
  hud.banner('🛟 SAVED<small>out of the sand, free</small>', 1600);
  return p;
}
function endGooseCam() {
  G.stopGooseSong?.(); G.stopGooseSong = null;
  G.gooseCam = null;
  $('letterbox').classList.remove('show'); document.body.classList.remove('bullet', 'goosecam');
  setTimeout(() => { if (!G.gooseCam) $('bulletLbl').textContent = BULLET_LBL; }, 400);
}
// Nature-documentary tracking shot: three-quarters in front of the goose and
// to one side, so you can see your ball in its beak the whole way.
function gooseViewBlocked(c) {
  const list = G.colliders?.list ?? [];
  const dx = goose.x - c.x, dz = goose.z - c.z, L2 = dx * dx + dz * dz || 1;
  for (const t of list) {
    if (t.kind !== 'cyl' && t.kind !== 'canopy') continue;
    if (t.kind === 'canopy' && (t.y ?? 0) - G.course.h(goose.x, goose.z) > 3.5) continue;   // high canopy is above the shot
    const k = clamp(((t.x - c.x) * dx + (t.z - c.z) * dz) / L2, 0, 1);
    const px = c.x + dx * k - t.x, pz = c.z + dz * k - t.z;
    if (px * px + pz * pz < ((t.r ?? 0.3) + 0.25) ** 2) return true;
  }
  return false;
}
const _beak = new THREE.Vector3();
function updateGooseCam(dt, closeUp = 0) {
  const gc = G.gooseCam; gc.t += dt;
  if (goose.state === 'fly') {
    // airlift: a chase plane behind and above the goose
    const fx = Math.sin(goose.yaw), fz = Math.cos(goose.yaw), gy = G.course.h(goose.x, goose.z) + goose.fly;
    const want = new THREE.Vector3(goose.x - fx * 6, gy + 2.2, goose.z - fz * 6);
    want.y = Math.max(want.y, G.course.h(want.x, want.z) + 1);
    camera.position.lerp(want, 1 - Math.exp(-dt * 4));
    G.camLook.lerp(new THREE.Vector3(goose.x, gy + 0.6, goose.z), 1 - Math.exp(-dt * 8)); camera.lookAt(G.camLook);
    return;
  }
  if (closeUp) {
    // tug-of-war: nose to beak with the goose, your ball between you
    goose.mesh.userData.carry.getWorldPosition(_beak);
    const fx = Math.sin(goose.yaw), fz = Math.cos(goose.yaw);
    const want = new THREE.Vector3(_beak.x + fx * 1.15 - fz * 0.55, _beak.y + 0.12, _beak.z + fz * 1.15 + fx * 0.55);
    want.y = Math.max(want.y, G.course.h(want.x, want.z) + 0.3);
    camera.position.lerp(want, 1 - Math.exp(-dt * 5));
    G.camLook.lerp(_beak, 1 - Math.exp(-dt * 8)); camera.lookAt(G.camLook);
    return;
  }
  const gy = G.course.h(goose.x, goose.z) + (goose.fly ?? 0);
  const fx = Math.sin(goose.yaw), fz = Math.cos(goose.yaw);   // goose forward
  const rx = -fz, rz = fx;                                     // goose right
  const dist = (3.2 - Math.min(1, gc.t / 4) * 1.0) * (camera.aspect < 1 ? 1.7 : 1);   // pushes in as the song builds; wider on a portrait phone
  const sideK = closeUp ? 0.25 : 0.66;
  const spot = side => ({ x: goose.x + (fx * 0.9 + rx * sideK * side) * dist, z: goose.z + (fz * 0.9 + rz * sideK * side) * dist });
  gc.side ??= 1;
  if (gooseViewBlocked(spot(gc.side)) && !gooseViewBlocked(spot(-gc.side))) gc.side = -gc.side;
  const { x: cx, z: cz } = spot(gc.side);
  const want = new THREE.Vector3(cx, Math.max(gy + (closeUp ? 0.95 : 1.0), G.course.h(cx, cz) + 0.6), cz);
  camera.position.lerp(want, 1 - Math.exp(-dt * (gc.t < 0.6 ? 2.5 : 4)));
  G.camLook.lerp(new THREE.Vector3(goose.x + fx * 0.4, gy + (closeUp ? 1.05 : 0.85), goose.z + fz * 0.4), 1 - Math.exp(-dt * 6));
  camera.lookAt(G.camLook);
}

// ------------------------------------------------------------ tug-of-war
// When the song ends the goose plants its feet. Shake the mouse (button held)
// or swipe like mad to yank your ball out of its beak. The goose is strong:
// most people lose, and losing is where the fun is.
const tug = { active: false, p: 35, t: 0, rate: 0, acc: 0, yank: 0, nextYank: 0, last: new Map(), creak: 0 };
const TUG_SECS = 6.5;
// (round 8, S2) The clock starts only after a ~1.1 s get-ready card. Only the
// first tug of a session is softer; after that the goose is as strong as ever.
const READY_SECS = 1.1;
let tugsThisSession = 0;
function readyCard(id, big, verb, hand) {
  const el = $(id);
  el.innerHTML = `${big}<small>GET READY: ${verb}</small><span class="hand">${hand}</span>`;
  el.classList.add('show');
}
function startTug() {
  if (tug.active || !goose) return;
  if (swing.active) cancelSwing();   // a theft mid-backswing must not leave the swing live
  G.stopGooseSong?.(); G.stopGooseSong = null;
  goose.state = 'tug'; goose.target = null;
  // every goose is different: some barely hold on, some are built like a fridge
  let strength = 4 + Math.random() * 70 + (goose.boss ? 8 : 0) + (goose.breed === 'toulouse' ? 10 : goose.breed === 'canada' ? -8 : 0);
  if (tugsThisSession++ === 0) strength = Math.min(strength, 30);
  Object.assign(tug, { active: true, p: 26, t: 0, ready: READY_SECS, rate: 0, acc: 0, yank: 0, nextYank: 1.1 + Math.random() * 0.5, last: new Map(), creak: 0, strength, wall: performance.now() });
  document.body.classList.add('tugging');
  G.mode = 'tug';
  $('bulletLbl').textContent = '🪿 TUG OF WAR';
  $('tugHow').textContent = coarse ? 'Swipe like mad!' : 'Hold click and shake!';
  $('tugFill').style.width = '26%'; $('tugEffort').style.width = '0%';
  $('tugTimer').textContent = `${TUG_SECS.toFixed(1)} s`;
  readyCard('tugReady', `🪿 IT WANTS ${esc(bag().name).toUpperCase()}!`, coarse ? 'SWIPE ↕ LIKE MAD' : 'HOLD CLICK, SHAKE', coarse ? '👆' : '🖱️');
  $('tug').classList.remove('hidden');
  sfx.honk(3);
  say('tugStart', vars(), { bump: 10 });
}
// shaking is measured in screen-sized pixels: a thumb on a phone counts as much as a mouse on a monitor
const tugScale = () => clamp(800 / Math.min(innerWidth, innerHeight), 0.8, 2.2);
function tugInput(px) { if (tug.active) tug.acc += px * tugScale(); }
function updateTug(dt) {
  if (!tug.active) return;
  if (tug.ready > 0) {
    // the get-ready card: nothing moves, nothing counts
    tug.ready -= dt; tug.acc = 0; tug.wall = performance.now();
    if (tug.ready <= 0) $('tugReady').classList.remove('show');
    return;
  }
  tug.t += dt;
  // effort = how fast you're shaking (px/s, smoothed, measured on the wall clock so a slow
  // frame rate can't inflate it); the goose pulls steadily and yanks in bursts
  const now = performance.now(), wdt = Math.max(1e-3, (now - tug.wall) / 1000); tug.wall = now;
  tug.rate = lerp(tug.rate, tug.acc / wdt, 1 - Math.exp(-wdt * 5)); tug.acc = 0;
  tug.nextYank -= dt;
  if (tug.nextYank <= 0) { tug.yank = 1; tug.nextYank = goose.breed === 'canada' ? 0.6 + Math.random() * 0.6 : 0.8 + Math.random() * 0.9; sfx.honk(1); G.shake = Math.max(G.shake, 0.12); }
  tug.yank = Math.max(0, tug.yank - dt * 2.6);
  // tuned in a sim (20k trials per level): ~1500 px/s never wins, a vigorous ~2500 wins
  // about 1 in 8, ~3500 about 1 in 3, and even an all-out frantic shake loses over half the time.
  // The goose eases in over the first second so nobody loses while still reading the panel.
  const you = Math.min(tug.rate, 4200) / 3500 * 44 * (tug.t > 3 ? 0.9 : 1);
  const pull = (tug.strength + tug.yank * 60) * (0.15 + 0.85 * clamp((tug.t - 0.8) / 0.7, 0, 1));
  tug.p = clamp(tug.p + (you - pull) * dt, 0, 100);
  if ((tug.creak -= dt) <= 0 && tug.rate > 600) { (sfx.tugPull ?? sfx.reelClick)(Math.min(1, tug.rate / 5000)); tug.creak = 0.09; }
  G.shake = Math.max(G.shake, Math.min(0.08, tug.rate / 60000));
  $('tugFill').style.width = `${tug.p}%`;
  $('tugEffort').style.width = `${clamp(you / 44 * 100, 0, 100)}%`;   // every swipe shows
  $('tugTimer').textContent = `${Math.max(0, TUG_SECS - tug.t).toFixed(1)} s`;
  if (tug.p >= 100) endTug(true);
  else if (tug.p <= 0 || tug.t >= TUG_SECS) endTug(false);
}
function endTug(won) {
  tug.active = false; $('tugReady').classList.remove('show');
  $('tug').classList.add('hidden'); document.body.classList.remove('tugging');
  const g = goose;
  g.carry = false; g.mesh.userData.carry.clear(); g.mesh.rotation.x = 0;
  const sender = g.sentBy ?? g.puppetOf ?? null; g.sentBy = null;
  if (won) {
    endGooseCam();
    if (sender && !g.puppetOf) reportSabotage(sender, 'won');
    G.stats.tugWins = (G.stats.tugWins ?? 0) + 1;
    if (g.puppetOf) sendEmote('teethx', g.puppetOf, `${myHole()}:tug`, { state: true });
    moment(22, `Won a tug-of-war with a goose on hole ${G.holeIdx + 1}`);
    sfx.catchBall(); hud.banner('🪿 YOINK!<small>your ball, back where it was</small>', GOOSE_BEAT_MS);
    setTimeout(() => ballFlourish('saved'), 900);
    say('tugWin', vars(), { bump: -10 });
    g.state = 'flee'; g.t = 3;
    const a = Math.random() * Math.PI * 2; g.target = { x: g.x + Math.cos(a) * 25, z: g.z + Math.sin(a) * 25 };
    if (!validLand(g.target.x, g.target.z)) g.target = { x: g.home.x, z: g.home.z };
    placeBall(G.gooseLie.x, G.gooseLie.z, 2.0);
    return;
  }
  G.stats.tugLosses = (G.stats.tugLosses ?? 0) + 1;
  // the goose wins, and it is not gracious about it
  tomLater('goose', 4200);
  const outcome = pickLoss(g);
  if (sender) {
    // the result goes back once the ball has a new lie (placeBall), or after 15 s regardless
    const rep = G.sabReport = { to: sender, outcome, at: { ...G.gooseLie } };
    setTimeout(() => { if (G.sabReport === rep) { G.sabReport = null; reportSabotage(rep.to, rep.outcome, -1); } }, 15000);
  }
  if (outcome === 'relay') gooseRelay(g);
  else if (outcome === 'brood') gooseBrood(g);
  else if (outcome === 'pond') goosePond(g);
  else if (outcome === 'stash') gooseStash(g);
  else if (outcome === 'bunker') gooseBunker(g);
  else if (outcome === 'swallow') gooseSwallow(g);
  else goosePunt(g);
}
// ------------------------------------------------------------ what the goose does when it wins
// (council round 6, §11.1) A weighted table, never the same outcome twice in a
// row. Every outcome: no stroke, never closer to the pin, always a playable lie.
const LOSSES = [['punt', 22], ['relay', 18], ['brood', 15], ['pond', 12], ['stash', 13], ['bunker', 10], ['swallow', 10]];
function lossSpot(p) {
  const s = G.course.surf(p.x, p.z);
  const ok = validLand(p.x, p.z) && s !== 'green' && s !== 'fringe' && Math.hypot(p.x - G.cup.x, p.z - G.cup.z) >= Math.hypot(G.gooseLie.x - G.cup.x, G.gooseLie.z - G.cup.z) - 0.01;
  return ok ? { x: p.x, z: p.z } : { x: G.gooseLie.x, z: G.gooseLie.z };
}
function relayPartner(g, within = 60, not = []) {
  let best = null;
  for (const o of liveGeese()) {
    if (o === g || not.includes(o) || o.boss || o.stare || o.gosling || o.state !== 'graze') continue;
    const d = dist2(o, g); if (d > within) continue;
    const score = d - (o.breed === 'canada' ? 1000 : 0);   // Canada geese are the best receivers
    if (!best || score < best.score) best = { o, score };
  }
  return best?.o ?? null;
}
function nearPond(g) {
  for (const p of G.course.ponds) if (Math.hypot(p.e[0] - g.x, p.e[1] - g.z) < 70 + p.e[2]) return p;
  return null;
}
function nearTree(g, within = 50) {
  let best = null;
  for (const c of G.colliders?.list ?? []) {
    if (c.tag !== 'tree' || c.kind !== 'cyl') continue;
    const d = Math.hypot(c.x - g.x, c.z - g.z);
    if (d < within && (!best || d < best.d)) best = { c, d };
  }
  return best?.c ?? null;
}
function pickLoss(g) {
  if (G.forceLoss) { const k = G.forceLoss; G.forceLoss = null; return k; }
  if (g.trick && g.trick !== 'any' && (g.trick !== 'relay' || relayPartner(g))) return g.trick;
  const eligible = key => key === 'relay' ? !!relayPartner(g) : key === 'pond' ? !!nearPond(g)
    : key === 'stash' ? typeof sasquackReady === 'function' && sasquackReady() && !!nearTree(g) : key === 'bunker' ? (G.holeDef.bunkers ?? []).length > 0 : true;
  const fallback = { relay: 'punt', pond: 'relay', stash: 'brood', bunker: 'punt' };
  const roll = () => {
    let r = Math.random() * LOSSES.reduce((s, l) => s + l[1], 0);
    for (const [k, w] of LOSSES) { if ((r -= w) < 0) return k; }
    return 'punt';
  };
  let k = roll();
  if (k === G.lastLoss) k = roll();
  for (let i = 0; i < 3 && !eligible(k); i++) k = fallback[k] ?? 'punt';
  if (!eligible(k)) k = 'punt';
  G.lastLoss = k;
  return k;
}

// Relay: a lateral pass to another goose, who runs off with it. Rugby.
function gooseRelay(g) {
  const to = relayPartner(g);
  if (!to) { goosePunt(g); return; }   // nobody to pass to
  say('tugRelay', vars(), { bump: 14 });
  hud.banner('🏉 TRY!<small>a goose relay</small>', 1600);
  G.mode = 'gooseCam'; $('bulletLbl').textContent = '🏉 GOOSE RUGBY';
  G.relay = { from: g, to, t: 0, phase: 'pass', passes: 1, ball: W.buildBall(0xffffff) };
  G.relay.ball.add(ballEyes.clone()); scene.add(G.relay.ball);
  g.yaw = Math.atan2(to.x - g.x, to.z - g.z);
  g.state = 'graze'; g.timer = 2;
}
const _rb = new THREE.Vector3(), _rb2 = new THREE.Vector3();
function updateRelay(dt) {
  const R = G.relay; if (!R) return;
  R.t += dt;
  if (R.phase === 'pass') {
    const d = dist2(R.from, R.to), dur = clamp(d / 14, 0.5, 1.4), k = clamp((R.t - 0.25) / dur, 0, 1);
    R.from.mesh.userData.neckPivot.rotation.x = -0.6 * Math.min(1, R.t / 0.25);
    R.from.mesh.userData.carry.getWorldPosition(_rb); R.to.mesh.userData.carry.getWorldPosition(_rb2);
    R.ball.position.lerpVectors(_rb, _rb2, k); R.ball.position.y += 4 * k * (1 - k) * Math.max(2, d / 6);
    G.camLook.lerp(R.ball.position, 1 - Math.exp(-dt * 8)); camera.lookAt(G.camLook);
    if (k >= 1) {
      // caught: the receiver runs off with it, away from the pin
      sfx.honk(1);
      scene.remove(R.ball);
      const held = W.buildBall(0xffffff); held.add(ballEyes.clone()); R.to.mesh.userData.carry.add(held);
      goose = R.to; R.to.carry = true;
      const away = Math.atan2(R.to.z - G.cup.z, R.to.x - G.cup.x);
      let tgt = { x: R.to.x, z: R.to.z };
      for (let i = 0; i < 12; i++) { const a = away + (Math.random() - 0.5) * 1.2, x = R.to.x + Math.cos(a) * 14, z = R.to.z + Math.sin(a) * 14; if (validLand(x, z)) { tgt = { x, z }; break; } }
      R.to.state = 'relay'; R.to.target = tgt; R.phase = 'run'; R.t = 0;
    }
  } else if (R.phase === 'run') {
    if (R.t > 2.0 || !R.to.target) {
      // 35%: another lateral, if a third goose is close
      const third = R.passes < 3 && Math.random() < 0.35 ? relayPartner(R.to, 40, [R.from]) : null;
      if (third) {
        R.to.carry = false; R.to.mesh.userData.carry.clear(); R.to.state = 'graze'; R.to.timer = 2;
        G.relay = { from: R.to, to: third, t: 0, phase: 'pass', passes: R.passes + 1, ball: W.buildBall(0xffffff) };
        G.relay.ball.add(ballEyes.clone()); scene.add(G.relay.ball);
        say('tugRelay', vars(), { bump: 4 });
        return;
      }
      // the spike
      const g = R.to; G.relay = null;
      g.carry = false; g.mesh.userData.carry.clear(); g.state = 'graze'; g.timer = 2;
      burst(g.x, G.course.h(g.x, g.z) + 0.6, g.z, 30, 0xffffff, { speed: 3, up: 3, life: 1.4, grav: 2 }); sfx.honk(2);
      endGooseCam();
      const at = lossSpot(g);
      placeBall(at.x, at.z);
    }
  }
}

// Brood: the goose sits on your ball, adores it, and leaves you an egg.
function gooseBrood(g) {
  say('tugBrood', vars(), { bump: 12 });
  hud.banner('🥚 BROODED<small>your ball is an egg now</small>', GOOSE_BEAT_MS);
  G.mode = 'gooseCam'; $('bulletLbl').textContent = '🥚 BROODING';
  G.brood = { g, t: 0 };
  sfx.honk(1);
}
function updateBrood(dt) {
  const B = G.brood; if (!B) return;
  B.t += dt;
  const g = B.g, sit = Math.min(1, B.t / 0.4);
  g.mesh.position.y = G.course.h(g.x, g.z) - 0.25 * sit;
  g.mesh.userData.body.rotation.z = B.t < 1.8 ? Math.sin(B.t * 6 * Math.PI * 2) * 0.1 : 0;
  if (Math.random() < dt * 4 && B.t < 1.8) burst(g.x, G.course.h(g.x, g.z) + 1.0, g.z, 1, 0xff7fa0, { speed: 0.3, up: 0.8, life: 1.2, grav: -0.3 });
  if (B.t >= 1.8) {
    G.brood = null;
    const at = lossSpot(g);
    g.state = 'graze'; g.target = { x: g.x + (g.x - at.x) * 3 + 6, z: g.z + 4 }; g.timer = 3;
    endGooseCam();
    G.eggBall = true;
    placeBall(at.x, at.z);
  }
}
// the egg hatches on its next landing; a gosling adopts you
let adoptee = null;
function hatchEgg(at) {
  if (!G.eggBall) return;
  G.eggBall = false;
  burst(at.x, at.y + 0.05, at.z, 16, 0xfff6e6, { speed: 1.5, up: 2, life: 0.8 });
  burst(at.x, at.y + 0.05, at.z, 10, 0xffe066, { speed: 1, up: 1.5, life: 1.2, grav: 1 });
  sfx.squeak?.(); setTimeout(() => sfx.squeak?.(), 180);
  if (adoptee) scene.remove(adoptee.mesh);
  const mesh = W.buildGoose(); mesh.scale.setScalar(1.15 * 0.45); scene.add(mesh);
  adoptee = { mesh, x: at.x, z: at.z, yaw: 0, phase: 0 };
  hud.toast("🐣 It thinks you're its parent.");
}
function updateAdoptee(dt) {
  const a = adoptee; if (!a) return;
  const p = avatar?.visible ? avatar.position : (G.playerAt ?? G.ball);
  const dx = p.x - a.x, dz = p.z - a.z, d = Math.hypot(dx, dz);
  let sp = 0;
  if (d > 1.2) { sp = Math.min(3, d); const st = Math.min(d - 1.2, sp * dt); a.x += dx / d * st; a.z += dz / d * st; a.yaw = Math.atan2(dx, dz); }
  if (d > 60) { a.x = p.x - 1; a.z = p.z - 1; }   // it can't keep up with a 150 m drive; it catches up
  a.phase += dt;
  const wob = sp ? Math.sin(a.phase * 14) : 0, u = a.mesh.userData;
  u.legL.rotation.x = wob * 0.7; u.legR.rotation.x = -wob * 0.7; u.body.rotation.z = wob * 0.15;
  a.mesh.position.set(a.x, G.course.h(a.x, a.z), a.z); a.mesh.rotation.y = a.yaw;
}

// Pond: a hammer throw into the water; fishing it out is free.
function goosePond(g) {
  const p = nearPond(g);
  say('tugPond', vars(), { bump: 14 });
  hud.banner('🎣 HAMMER THROW<small>free fish, no penalty</small>', GOOSE_BEAT_MS);
  G.mode = 'gooseCam'; $('bulletLbl').textContent = '🎣 HAMMER THROW';
  const [cx, cz, rx, rz] = p.e;
  const vx = g.x - cx, vz = g.z - cz, L = Math.hypot(vx, vz) || 1, k = 0.5 * Math.min(rx, rz);
  let tx = cx + vx / L * k, tz = cz + vz / L * k;
  if (G.course.surf(tx, tz) !== 'water') { tx = cx; tz = cz; }
  const ball = W.buildBall(0xffffff); ball.add(ballEyes.clone()); scene.add(ball);
  G.hammer = { g, t: 0, ball, from: null, to: { x: tx, z: tz }, y0: g.yaw };
}
function updateHammer(dt) {
  const H = G.hammer; if (!H) return;
  H.t += dt;
  const g = H.g;
  if (H.t < 0.7) { g.yaw = H.y0 + (H.t / 0.7) * Math.PI * 4; g.mesh.userData.carry.getWorldPosition(_rb); H.ball.position.copy(_rb); return; }
  if (!H.from) { H.from = H.ball.position.clone(); g.mesh.userData.carry.clear(); g.carry = false; g.state = 'graze'; g.timer = 2; sfx.whoosh(0.8); }
  const k = clamp((H.t - 0.7) / 1.0, 0, 1), wy = G.course.waterLevelAt(H.to.x, H.to.z);
  H.ball.position.set(lerp(H.from.x, H.to.x, k), lerp(H.from.y, wy, k) + 6 * 4 * k * (1 - k), lerp(H.from.z, H.to.z, k));
  G.camLook.lerp(H.ball.position, 1 - Math.exp(-dt * 6)); camera.lookAt(G.camLook);
  if (k >= 1) {
    scene.remove(H.ball); G.hammer = null;
    sfx.water(); burst(H.to.x, wy, H.to.z, 50, 0xbfe6ff, { speed: 2.5, up: 5, life: 1.2 });
    endGooseCam();
    goFishing({ x: H.to.x, y: wy, z: H.to.z }, { ...G.gooseLie }, { free: true, pondToss: true });
  }
}

// a goose outcome stays up long enough to read (playtest: "goes by too fast"); a tap skips it
const GOOSE_BEAT_MS = 3000;
function placeBall(x, z, hold = 2.8) {
  G.ball = { x, z, y: G.course.h(x, z) + R };
  if (G.sabReport) { const rp = G.sabReport; G.sabReport = null; reportSabotage(rp.to, rp.outcome, Math.hypot(x - rp.at.x, z - rp.at.z)); }
  ballMesh.visible = true;
  roomSendProgress();
  burst(x, G.ball.y + 0.5, z, 30, 0xffffff, { speed: 2.5, up: 2, life: 1.4, grav: 2 });
  sfx.feathers();
  hud.hint('');
  linger(hold, startWalk);
}
// A beat to take in what the goose just did (where your ball ended up)
// before your golfer sets off. Click or Space skips it.
function linger(sec, then) {
  G.mode = 'linger';
  const b = new THREE.Vector3(G.ball.x, G.ball.y, G.ball.z);
  // if the ball is far off or behind us, swing round to a viewpoint near it
  const d = camera.position.distanceTo(b);
  const pos = d > 14 ? b.clone().add(new THREE.Vector3(camera.position.x - b.x, 0, camera.position.z - b.z).setLength(9)).setY(Math.max(b.y + 3.5, G.course.h(b.x, b.z) + 3)) : camera.position.clone();
  G.linger = { t: 0, sec, then, look: b, pos };
}
function updateLinger(dt) {
  const L = G.linger;
  L.t += dt;
  camera.position.lerp(L.pos, 1 - Math.exp(-dt * 2.5));
  G.camLook.lerp(L.look, 1 - Math.exp(-dt * 4)); camera.lookAt(G.camLook);
  if (L.t >= L.sec) { G.linger = null; L.then(); }
}
function skipLinger() { if (G.mode === 'linger' && G.linger) G.linger.t = G.linger.sec; }
// Loss 1: the goose drop-kicks your ball. Real physics: it can find water, a tree, or the cup.
function goosePunt(g) {
  endGooseCam();
  say('tugPunt', vars(), { bump: 16 });
  hud.banner('🪿 PUNTED!', GOOSE_BEAT_MS);
  sfx.gooseBonk();
  g.state = 'graze'; g.timer = 2;
  // a spiteful kick: always away from the pin (losing to a goose should never gain you ground)
  const a = Math.atan2(g.z - G.cup.z, g.x - G.cup.x) + (Math.random() - 0.5) * 2.4;
  const tr = traitOf(bag());
  const start = { x: g.x + Math.sin(g.yaw) * 0.5, z: g.z + Math.cos(g.yaw) * 0.5 };
  start.y = G.course.h(start.x, start.z) + R;
  const L = launch('wedge', 0.55 + Math.random() * 0.5, Math.cos(a), Math.sin(a), (Math.random() - 0.5) * 1.6, 1, tr);
  const wmP = wmPhase();
  const sim = simulate({ course: G.course, cup: G.cup, wind: G.wind, trait: tr, colliders: G.colliders, strokeNo: G.strokes + 1, wmPhase: wmP }, start, L);
  G.shot = { sim, t: 0, kind: 'punt', ev: 0, L, start, bullet: null, clubId: 'wedge', landed: false, strokeNo: G.strokes + 1, ball: bag(), wasBullet: false, called: false, wmPhase: wmP };
  G.mode = 'flight';
  G.flightCam = { phase: 0, t: 0.3, pos: camera.position.clone(), look: G.camLook.clone() };
  ballMesh.visible = true;
}
// Loss 2: the goose flies off and drops your ball in the nearest bunker.
function gooseBunker(g) {
  say('tugBunker', vars(), { bump: 12 });
  hud.banner('🪿 AIRLIFTED<small>to the nearest bunker</small>', GOOSE_BEAT_MS);
  const bs = G.holeDef.bunkers ?? [];
  let best = null;
  // the nearest bunker that doesn't bring you closer to the pin, within a short flight
  const lieD = Math.hypot(G.gooseLie.x - G.cup.x, G.gooseLie.z - G.cup.z);
  for (const b of bs) {
    const d = Math.hypot(b[0] - g.x, b[1] - g.z);
    if (Math.hypot(b[0] - G.cup.x, b[1] - G.cup.z) < lieD - 5 || d > 90) continue;
    if (!best || d < best.d) best = { x: b[0], z: b[1], d };
  }
  if (!best) {   // no sand on this hole: deep rough, the wrong way
    const a = Math.atan2(g.z - G.cup.z, g.x - G.cup.x);
    best = { x: g.x + Math.cos(a) * 30, z: g.z + Math.sin(a) * 30 };
    for (let k = 0; k < 20 && !validLand(best.x, best.z); k++) { best.x = lerp(best.x, g.x, 0.2); best.z = lerp(best.z, g.z, 0.2); }
  }
  g.state = 'fly'; g.carry = true;
  const held = W.buildBall(0xffffff); held.add(ballEyes.clone()); g.mesh.userData.carry.add(held);
  g.target = { x: best.x, z: best.z };
  g.flyT = 0;
  G.mode = 'gooseCam';   // keep filming the flight
  $('bulletLbl').textContent = '🪿 AIRLIFT';
  sfx.honk(2);
}
function landGooseFlight(g) {
  g.state = 'graze'; g.timer = 2; g.carry = false; g.fly = 0;
  g.mesh.userData.carry.clear();
  endGooseCam();
  if (g.stash) {
    const tree = g.stash; g.stash = null;
    g.state = 'flee'; g.t = 3; g.target = { x: g.home.x, z: g.home.z };
    // the ball ends up at the foot of the tree, and the tree's resident comes down for it
    let at = { x: tree.x, z: tree.z };
    for (let k = 0; k < 16; k++) { const a = Math.atan2(G.cup.z - tree.z, G.cup.x - tree.x) + Math.PI + (k % 2 ? 1 : -1) * Math.floor(k / 2) * 0.4, x = tree.x + Math.cos(a) * 1.6, z = tree.z + Math.sin(a) * 1.6; if (validLand(x, z)) { at = lossSpot({ x, z }); break; } }
    G.ball = { x: at.x, z: at.z, y: G.course.h(at.x, at.z) + R };
    ballMesh.visible = true;
    startSasquack(tree, { fromTheft: true });
    return;
  }
  const at = useLifeRing(g.target);
  placeBall(at.x, at.z);
  g.target = null;
}
// Loss 3 (rare): the goose swallows your ball. It joins the graveyard.
function gooseSwallow(g) {
  endGooseCam();
  g.state = 'graze'; g.timer = 3;
  const b = bag();
  sfx.gooseBonk(); setTimeout(() => sfx.bell(), 500);
  if (b.range) {
    hud.banner('🪿 GULP…<small>…and spat out. Nobody wants the range ball.</small>', GOOSE_BEAT_MS);
    say('junk', vars(), { bump: 6 });
  } else {
    ballFarewell({ x: g.x, z: g.z, y: G.course.h(g.x, g.z) + 0.6 }, true);
    G.stats.ballsLost++; moment(24, `${b.name} was swallowed by a goose on hole ${G.holeIdx + 1}`);
    b.alive = false;
    const gy = graveyard();
    gy.push({ name: b.name, trait: 'Eaten by a goose', hole: G.holeIdx + 1, date: new Date().toISOString().slice(0, 10) });
    store.set('ghg3d_graveyard', JSON.stringify(gy.slice(-200)));
    say('tugSwallow', vars(), { bump: 22 });
    hud.banner(`🪿 GULP.<small>${esc(b.name)} has been eaten. R.I.P.</small>`, GOOSE_BEAT_MS);
    G.ballIdx = nextAliveIdx();
    renderBag();
    const nb = bag();
    setTimeout(() => { sfx.newBall(); hud.toast(`Hi, I'm <b>${esc(nb.name)}</b>. Be gentle.`); G.ballTagT = 4; G.ballTagFull = true; }, 2600);
  }
  placeBall(g.x + Math.sin(g.yaw) * 0.6, g.z + Math.cos(g.yaw) * 0.6, 2.8);
}

// ============================================================ swing input
const swing = { active: false, src: '', phase: 'back', back: 0, peak: 0, fwd: 0, drift: 0, tDown: 0, angle: 0, follow: 0 };
const SWING_PX = 260;
function canSwing() { return G.mode === 'address' && !G.shot && !G.walk && !G.finalWait; }
function beginSwing(src) {
  if (!canSwing() || swing.active) return;
  if (G.wheel) { hurryWheel(); }
  if (!G.idleHint || G.hintsShown.swing) hud.hint('');
  G.idleHint = false;
  Object.assign(swing, { active: true, src, phase: 'back', back: 0, peak: 0, fwd: 0, drift: 0, tDown: 0, t0: performance.now() });
  carry.samples = G.club !== 'putter' && G.mode === 'address' ? carrySamples() : null;
  carry.last = null;
  swingTone.start();
  $('power').classList.add('show'); $('powerLbl').classList.add('show');
}
function swingMove(dx, dy) {
  if (!swing.active) return;
  if (swing.phase === 'back') {
    if (dy > 0) swing.back = Math.min(1.15, swing.back + dy / SWING_PX);
    else if (dy < -2 && swing.back > 0.04) { swing.phase = 'down'; swing.peak = swing.back; swing.tDown = performance.now(); }
  }
  if (swing.phase === 'down') {
    if (dy < 0) swing.fwd += -dy / SWING_PX;
    swing.drift += dx / (SWING_PX * 0.8);
    if (swing.fwd >= swing.peak) strikeFromSwing();
  }
}
function tempoNow() {
  const dur = (performance.now() - swing.tDown) / 1000;
  const ideal = 0.08 + 0.14 * swing.peak;
  // gentle chips are allowed a gentle tempo
  return clamp(1 - (dur - ideal) / (0.45 + (1 - Math.min(1, swing.peak)) * 0.6), 0, 1);
}
function endSwing() {
  if (!swing.active) return;
  if (swing.src === 'key') {
    // tap 1 done: power is locked; now the accuracy needle sweeps once
    if (swing.phase === 'back') {
      swing.back = Math.min(1.15, (performance.now() - swing.t0) / 1000 * 0.8);   // exact, even on a slow frame
      swing.peak = swing.back; swing.phase = 'acc'; swing.tAcc = performance.now();
    }
    return;
  }
  if (swing.phase === 'back') {
    cancelSwing();
    if (swing.back > 0.08) hud.hint('Now flick up to swing!', 2500);
    return;
  }
  strikeFromSwing();
}
function strikeFromSwing() { finishSwing(swing.peak, tempoNow(), clamp(swing.drift, -1, 1)); }
function keyStrike() {
  if (!swing.active || swing.phase !== 'acc') return;
  swing.drift = (1 - 2 * Math.min(1, (performance.now() - swing.tAcc) / 1000 / 0.7)) * 0.45;
  $('acc').classList.remove('show');
  finishSwing(swing.peak, 1, swing.drift);
}
function cancelSwing() {
  swingTone.stop(); carry.samples = null;
  swing.active = false; hideCancel(); $('acc').classList.remove('show'); $('power').classList.remove('show'); $('powerLbl').classList.remove('show');
}
function finishSwing(power, tempo, drift) {
  const src = swing.src;
  swing.active = false; hideCancel(); swingTone.release();
  $('power').classList.remove('show'); $('powerLbl').classList.remove('show');
  if (power < 0.03) { carry.samples = null; return; }
  if (G.club !== 'putter') {
    showTempoChip(src === 'key' ? 'TIMING' : 'TEMPO', src === 'key' ? 1 - Math.abs(drift) / 0.45 : tempo);
    // (S10) what those dots mean, once per device, 7 words or fewer
    if (store.get('ghg3d_tempoTip') !== '1') { store.set('ghg3d_tempoTip', '1'); setTimeout(() => hud.hint(src === 'key' ? 'TIMING: tap in the green zone.' : 'TEMPO: a smooth, quick flick flies furthest.', 5000), 1200); }
  }
  doShot({ power, tempo, drift });
}
// After impact: how clean was that? (tempo costs up to a third of your carry)
function showTempoChip(label, q) {
  const n = clamp(Math.round(q * 4), 1, 4), el = $('tempoChip');
  el.innerHTML = `${label} <b style="color:${q >= 0.85 ? 'var(--mint)' : q >= 0.5 ? 'var(--sun)' : 'var(--coral)'}">${'●'.repeat(n)}${'○'.repeat(4 - n)}</b>`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(showTempoChip.t); showTempoChip.t = setTimeout(() => el.classList.remove('show'), 1100);
}

// ============================================================ shooting
function aimDir() {
  let yaw = G.yaw;
  if (G.scoped) yaw += G.sway.x;
  return fwd(yaw);
}
function doShot({ power, tempo = 1, drift = 0, clubId = G.club }) {
  const shoo = G.mode === 'goose';
  const d = aimDir();
  setScope(false);
  const ball = shoo ? { name: 'spare ball', trait: RANGE_BALL.trait } : bag();
  const mods = shotMods(true, clubId);
  const trait = traitOf(ball);
  for (const k of ['speed', 'bounce', 'roll', 'wind', 'side', 'capture']) if (mods[k]) trait[k] *= mods[k];
  // putter: the pull-back is metres of flat-green roll (full pull = the tier's range)
  const eff = clubId === 'putter' ? puttPower(power * puttRange()) : power;
  const L = launch(clubId, eff, d.x, d.z, drift, tempo, trait);
  if (!miniPutt(L, mods, clubId) && mods.banana) L.side += (G.holeIdx % 2 ? 1 : -1) * 0.9 * CLUBS[clubId].curve;   // odd holes hook left, even holes slice right
  G.ghostShot = !!mods.noTrees;
  const start = { ...(shoo ? G.gooseLie : G.ball) };
  const strokeNo = G.strokes + 1;
  const world = {
    course: G.course, cup: G.cup, wind: G.wind, trait, colliders: G.colliders,
    dynamic: [...gooseCollider(), ...rivalColliders(start), ...(shoo ? [] : galleryColliders(start)), ...(shoo ? [] : pinColliders())],
    ghost: shoo ? null : ghostColliderFor(strokeNo, start), ghostR: GHOST_R,
    cupR: mods.cupR, airGravity: mods.airGravity, noTrees: mods.noTrees, strokeNo, noAura: auraOff(), wmPhase: wmPhase(),
  };
  if (!shoo) for (const g of liveGeese()) { g.frozen = g.state === 'graze'; g.approach = false; }
  if (!shoo && PINS.def) PINS.before = pinsUp();
  const sim = simulate(world, start, L);
  G.stats.swings++;
  const fan = shoo ? null : fanVerdict(world, start, L, sim);
  G.shotCannon = false;
  if (!shoo && G.room) sendKnocks(sim);
  // the frozen carry mark stays faintly in the world while the ball flies
  carry.flight = false; carry.mark = null; carry.hideAt = 0;
  let called = false;
  if (!shoo && carry.samples && carry.last && clubId !== 'putter') {
    carry.mark = carry.last.pt; carry.markP = carry.last.p; carry.flight = true;
    const firstTouch = sim.events.find(e => (e.type === 'bounce' || e.type === 'land') && e.n === 0);
    const carried = Math.hypot(sim.carry.x - start.x, sim.carry.z - start.z);
    // earned, not given: a pure, near-perfect-tempo strike that lands within 1% of the call
    called = L.pure && tempo >= 0.95 && !!firstTouch && carried >= 20 && Math.hypot(sim.carry.x - carry.mark.x, sim.carry.z - carry.mark.z) < Math.max(0.5, carried * 0.01);
  }
  carry.samples = null;
  if (!shoo) {
    G.lastLie = { ...G.ball };
    G.strokes++;
    recordStroke(start, sim);
    roomSendShot(start, sim, clubId, world.wmPhase);
    G.hintsShown.swing = true; G.treeHitAt = null;
    G.lastShotAt = performance.now(); G.galleryFrom = new Set(); G.gallerySaid = false;
    hud.hint('');
    if (L.pure) G.stats.pure++;
    // ghost stroke N launches in the same frame
    finishGhostSolo();
    if (G.ghostGlide) { placeGhostMesh(G.ghostGlide.to); G.ghostGlide = null; }
    const parked = G.ghost.override?.n === strokeNo - 1;
    const gs = parked ? null : G.ghost.strokes[strokeNo - 1];
    G.ghost.parked = parked;
    G.ghost.playing = gs && !gs.penaltyOnly && gs.shot && !isPuttStroke(gs) ? gs.shot : null;
    G.ghost.deferred = isPuttStroke(gs) ? gs.shot : null;
    if (G.ghost.playing) tomSwingNow();
  }
  const startD = dist2(start, G.cup);
  const endD = Math.hypot(sim.end.x - G.cup.x, sim.end.z - G.cup.z);
  const fromGreen = ['green', 'fringe'].includes(G.course.surf(start.x, start.z));
  let bullet = null;
  const lip = sim.events.find(e => e.type === 'lip');
  if (!shoo && startD >= 3 && (sim.result === 'holed' || (endD < 1 && !fromGreen) || (endD < 2 && startD >= 30) || (lip && startD >= 4))) {
    let fEnd = sim.n - 1, fStart;
    if (lip && sim.result !== 'holed') { fEnd = Math.min(sim.n - 1, lip.frame + Math.round(0.5 * FPS)); fStart = lip.frame - Math.round(0.9 * FPS); }
    else {
      let apexF = 0, ay = -1e9;
      for (let i = 0; i < sim.n; i++) if (sim.frames[i * 3 + 1] > ay) { ay = sim.frames[i * 3 + 1]; apexF = i; }
      fStart = Math.max(apexF, fEnd - Math.round(1.7 * FPS));
    }
    fStart = Math.max(Math.round(0.3 * FPS), Math.min(fStart, fEnd - Math.round(0.55 * FPS)));
    const len = (fEnd - fStart) / FPS;
    if (len >= 0.5) bullet = { fStart, fEnd, speed: clamp(len / 1.7, 0.25, 0.45) };   // 1.7–4 s of slow-mo
  }
  ballMesh.material.transparent = G.ghostShot; ballMesh.material.opacity = G.ghostShot ? 0.5 : 1;
  G.shot = { sim, t: 0, kind: shoo ? 'shoo' : 'player', ev: 0, L, start, bullet, clubId, landed: false, strokeNo, ball, wasBullet: false, called, fan, wmPhase: world.wmPhase };
  G.mode = shoo ? 'goose' : 'flight';
  G.hitstop = 0.085;
  G.shake = L.pure ? 0.12 : 0.35; G.fovKick = L.pure ? 5 : 2;
  swing.follow = 0.001;
  sfx.whoosh(power); sfx.strike(L.pure, clubId);
  if (L.pure && clubId !== 'putter') { hud.flash(0.35); hud.banner('PURE!', 800); }
  else if (!L.pure && clubId !== 'putter' && power >= 0.5 && (Math.abs(drift) > 0.35 || tempo < 0.5)) hud.banner(`<span style="color:#ffb3a8">MISHIT</span><small>${tempo < 0.5 ? 'lazy downswing' : drift > 0 ? 'sliced it' : 'hooked it'}</small>`, 1000);
  if (power > 1.0) say('overswing', vars(), { bump: 4 });
  else if (L.pure && clubId === 'driver' && !shoo) say('pure', vars(), { bump: -4 });
  if (power < 0.12 && clubId !== 'putter' && !shoo) setTimeout(() => say('whiff', vars(), { bump: 8 }), 600);
  shooMesh.visible = shoo;
  G.flightCam = { phase: 0, t: 0, pos: camera.position.clone(), look: G.camLook.clone() };
  if (bullet) G.stats.bulletCams++;
  G.previewHidden = true;
}

function shotPos() {
  const s = G.shot; if (!s) return G.ball;
  const f = frameAt(s.sim, Math.floor(s.t));
  return f;
}

// Process sim events as playback passes them.
function fireEvent(e, shot) {
  const shoo = shot.kind !== 'player';   // a goose punt: no player commentary, no carry call
  if ((e.type === 'bounce' || e.type === 'land') && e.n === 0) shot.landed = true;
  const v = clamp((e.speed ?? 5) / 15, 0.3, 1.2);
  switch (e.type) {
    case 'bounce': case 'land': {
      const s = e.surface;
      if (s === 'sand') { sfx.sand(v); burst(e.x, e.y, e.z, 26, 0xeacc90, { speed: 2.5, up: 3, life: 0.9 }); }
      else if (s === 'green' || s === 'fringe') { sfx.green(v); burst(e.x, e.y, e.z, 6, 0x9ae07a, { speed: 1, up: 1, life: 0.5 }); }
      else if (s === 'rough') { sfx.rough(v); burst(e.x, e.y, e.z, 14, 0x3f6e28, { speed: 1.5, up: 2.5, life: 0.8 }); }
      else { sfx.fairway(v); burst(e.x, e.y, e.z, 8, 0x6fae48, { speed: 1.2, up: 1.6, life: 0.6 }); }
      if (!shoo) ballLanded(e, e.n === 0);
      if (!shoo && e.n === 0) hatchEgg(e);
      if (!shoo && e.n === 0) {
        // the nearest goose hears it land, and honks once
        let near = null;
        for (const g of liveGeese()) { if (g.gosling || g.state !== 'graze') continue; const d = Math.hypot(g.x - e.x, g.z - e.z); if (d < Math.min(2 * g.radius, 30) && (!near || d < near.d)) near = { g, d }; }
        if (near) { near.g.perk = 0.6; near.g.yaw = Math.atan2(e.x - near.g.x, e.z - near.g.z); sfx.honk(1); }
      }
      if (e.n === 0 && !shoo) {
        shot.landed = true;
        if (carry.flight) carry.hideAt = G.time + 1.3;
        if (shot.called) {
          carry.calledT = 1.2; sfx.calledIt();
          G.stats.called = (G.stats.called ?? 0) + 1;
          moment(12 + dist2(shot.start, e) / 10, `Called it: landed on the mark from ${dist2(shot.start, e).toFixed(0)} m`);
          say('calledIt', vars(), { bump: -5 });
        }
      }
      if (e.n === 0 && !shoo && shot.L.club !== 'putter') G.shake = Math.max(G.shake, 0.08);
      break;
    }
    case 'hit':
      if (e.tag?.startsWith('fan:')) { if (!shoo) fanHit(shot, e.tag.slice(4)); break; }
      if (e.tag?.startsWith('rival:')) {
        const r = rivals.get(e.tag.slice(6));
        if (shot.rivalHit || !r) break;
        shot.rivalHit = true;
        sfx.ghostHit(); burst(e.x, e.y, e.z, 30, new THREE.Color(r.hex).getHex(), { speed: 2.5, up: 1.5, life: 1.2, grav: 0.5 });
        moment(30, `Cannoned off ${r.name}'s ball on hole ${G.holeIdx + 1}`);
        G.stats.ghostHits++; say('rivalHit', { ...vars(), rival: r.name }, { bump: 6 }); hud.banner(`💥 HIT ${esc(r.name.toUpperCase())}'S BALL`, 1100);
        break;
      }
      if (e.tag?.startsWith('pin:')) {
        if (shoo) break;
        const f = frameAt(shot.sim, e.frame);
        topple(+e.tag.slice(4), e.speed, f.vx, f.vz);
        if (!shot.saidPins) { shot.saidPins = true; G.shake = Math.max(G.shake, 0.12); }
        break;
      }
      if (e.tag === 'rail' || e.tag === 'bumper') {
        (e.tag === 'bumper' ? (sfx.boing ?? sfx.knock) : sfx.knock)(Math.min(1, 0.3 + e.speed / 4));
        if (e.tag === 'bumper') burst(e.x, e.y + 0.2, e.z, 14, 0xffe066, { speed: 2, up: 1.5, life: 0.6, grav: 3 });
        if (!shoo && (shot.crazyHits = (shot.crazyHits ?? 0) + 1) >= 3 && !shot.saidCrazy) { shot.saidCrazy = true; say('crazy', vars(), { bump: 6 }); }
        break;
      }
      if (e.tag === 'windmill' && G.holeDef.mini) {
        sfx.swat ? sfx.swat() : sfx.knock(1); burst(e.x, e.y + 0.1, e.z, 14, 0xffffff, { speed: 2, up: 1 });
        if (!shoo && !shot.saidCrazy) { shot.saidCrazy = true; say('crazy', vars(), { bump: 8 }); hud.banner('SWATTED', 1000); }
        break;
      }
      if (e.tag === 'tree' && !shoo) G.treeHitAt = { x: e.x, z: e.z };
      if (e.tag === 'windmill') { sfx.swat ? sfx.swat() : sfx.tree(); burst(e.x, e.y, e.z, 20, 0xfff6e0, { speed: 3, up: 2 }); if (!shoo && !shot.saidTree) { shot.saidTree = true; say('windmill', vars(), { bump: 10 }); hud.banner('SWATTED', 1100); G.stats.swatted = (G.stats.swatted ?? 0) + 1; } }
      else if (e.tag === 'tomb') { sfx.tree(); burst(e.x, e.y, e.z, 12, 0x9a9a92, { speed: 2, up: 2 }); if (!shoo && !shot.saidTree) { shot.saidTree = true; say('tomb', vars(), { bump: 6 }); } }
      else if (e.tag === 'tree') { sfx.tree(); burst(e.x, e.y, e.z, 10, 0x6b4a2a, { speed: 2, up: 2 }); if (!shoo && !shot.saidTree) { shot.saidTree = true; say('tree', vars(), { bump: 6 }); } }
      else if (e.tag?.startsWith('goose')) {
        if (shot.gooseHit) break;
        shot.gooseHit = true;
        sfx.gooseBonk(); burst(e.x, e.y + 0.3, e.z, 40, 0xffffff, { speed: 3, up: 3, life: 1.6, grav: 2 });
        const hitG = geese[+e.tag.slice(6)];
        if (shoo || !hitG) break;
        G.stats.gooseHits++; moment(25, `Bonked a goose on hole ${G.holeIdx + 1}`);
        if (hitG.gosling) { sfx.squeak?.(); say('gooseBlock', vars(), { bump: 4 }); }
        else say('gooseBlock', vars(), { bump: 8 });
        if (!hitG.boss) { hitG.state = 'flee'; hitG.t = 2; hitG.frozen = false; hitG.target = { x: hitG.x + 15, z: hitG.z }; }   // the boss does not flee
      }
      break;
    case 'leaves': if (!shoo) G.treeHitAt = { x: e.x, z: e.z }; sfx.leaves(); burst(e.x, e.y, e.z, 18, 0x4e8a30, { speed: 2, up: 1, life: 1.4, grav: 1.5 }); if (!shoo && !shot.saidTree) { shot.saidTree = true; say('tree', vars(), { bump: 5 }); } break;
    case 'ghost':
      sfx.ghostHit(); burst(e.x, e.y, e.z, 30, 0x7ff6ff, { speed: 2.5, up: 1.5, life: 1.2, grav: 0.5 });
      moment(30, `Collided with ${G.ghostSource === 'pb' ? 'your own ghost' : "Old Tom's ghost"} on hole ${G.holeIdx + 1}`);
      G.stats.ghostHits++; say('ghostHit', vars(), { bump: 6 }); hud.banner('👻 GHOST COLLISION', 1100);
      break;
    case 'lip': {
      sfx.lip();
      const lipIn = shot.sim.result === 'holed';
      if (!shoo && !shot.saidLip) { shot.saidLip = true; say(lipIn ? 'lipIn' : 'lip', vars(), { bump: lipIn ? 0 : 10 }); }
      break;
    }
    case 'water': sfx.water(); burst(e.x, e.y, e.z, 50, 0xbfe6ff, { speed: 2.5, up: 5, life: 1.2 }); break;
    case 'aura':
      sfx.whoosh(0.7); burst(e.x, e.y, e.z, 20, 0xb07cff, { speed: 2, up: 1, life: 1.2, grav: 0 });
      if (!shoo) { trailMat.color.set(0xb07cff); if (!G.auraTold) { G.auraTold = true; hud.banner('🌀 THE HONK HOLE', 1600); } }
      break;
    case 'oob': sfx.oob(); break;
    case 'holed': break;
  }
}

function updateShot(dt) {
  const s = G.shot;
  if (G.hitstop > 0) { G.hitstop -= dt; return; }
  let speed = 1;
  const inBullet = s.bullet && s.t >= s.bullet.fStart && s.t < s.bullet.fEnd;
  if (inBullet) {
    if (!s.wasBullet) { s.wasBullet = true; $('letterbox').classList.add('show'); document.body.classList.add('bullet'); sfx.slowmo(); say('bulletcam', vars()); }
    speed = s.bullet.speed;
  } else {
    if (s.wasBullet) { $('letterbox').classList.remove('show'); document.body.classList.remove('bullet'); }
    // Compress dull roll-outs (a slow ball creeping on the green is dead
    // time) but keep the last couple of metres around the cup in real time.
    const p = frameAt(s.sim, Math.floor(s.t));
    const dCup = Math.hypot(p.x - G.cup.x, p.z - G.cup.z), sp = Math.hypot(p.vx, p.vy, p.vz);
    const rolling = s.landed || (s.L.club === 'putter' && s.t > 0.5 * FPS);
    if (rolling && !(dCup < 2.5 && sp < 3)) {
      const remain = (s.sim.n - 1 - s.t) / FPS;
      if (s.L.club === 'putter') speed = clamp(remain / 3, 1, 1.8);   // a putt is the shot you watch: barely compress it
      else {
        speed = clamp(remain / 2.2, 1, 4);
        if (sp < 0.6) speed = Math.max(speed, 3);
      }
    }
    if (s.bullet && s.t < s.bullet.fStart) speed = Math.min(speed, Math.max(1, (s.bullet.fStart - s.t) / FPS));
  }
  s.speed = speed;
  s.t = Math.min(s.sim.n - 1, s.t + dt * FPS * speed * G.timeScale);
  const evs = s.sim.events;
  while (s.ev < evs.length && evs[s.ev].frame <= s.t) fireEvent(evs[s.ev++], s);
  const p = frameAt(s.sim, Math.floor(s.t));
  const mesh = s.kind === 'shoo' ? shooMesh : ballMesh;
  mesh.position.set(p.x, p.y, p.z);
  const sp = Math.hypot(p.vx, p.vy, p.vz);
  flightSound(s.landed ? 0 : sp);
  if (s.kind === 'player') {
    for (const r of rivals.values()) if (r.knock && !r.knock.by && s.t >= r.knock.at) { startKnockAnim(r, { ...r.knock, byHex: ROOM_COLORS[(G.room?.myColor ?? 0) % ROOM_COLORS.length] }); sfx.knock?.(1); hud.banner(G.shotCannon ? '🎱 CANNON!' : `💥 KNOCK-ON<small>${esc(r.name)}'s ball is moving</small>`, 1400); if (G.shotCannon) sfx.calledIt(); say('knockOn', { ...vars(), rival: r.name }, { bump: 6 }); }
    fillTrail(liveTrail, s.sim, s.t);
    if (G.ghost.playing) {
      const gp = frameAt(G.ghost.playing, Math.floor(s.t));
      placeGhostMesh(gp);
      fillTrail(ghostTrail, G.ghost.playing, s.t);
    }
  }
  if (s.t >= s.sim.n - 1) endShot();
}

function endShot() {
  const s = G.shot;
  G.shot = null;
  trailMat.color.set(0xffffff);
  ballMesh.material.transparent = false; ballMesh.material.opacity = 1; G.ghostShot = false;
  carry.flight = false; carry.mark = null;
  flightSound(0);
  $('letterbox').classList.remove('show'); document.body.classList.remove('bullet');
  G.previewHidden = false;
  if (s.kind === 'knock') { endKnock(s); return; }
  if (s.kind === 'punt' || s.kind === 'sasquack') {
    // where the goose's drop-kick ended up. No stroke for the kick itself.
    const end = s.sim.end;
    const tl = makeTrail(oldTrailMat, s.sim.n); fillTrail(tl, s.sim, s.sim.n); G.trails.push(tl);
    liveTrail.geometry.setDrawRange(0, 0);
    if (s.sim.result === 'holed') {
      G.ball = { x: G.cup.x, z: G.cup.z, y: end.y };
      say('tugGooseHoled', vars(), { bump: 20 }); hud.banner('🪿 THE GOOSE HOLED IT', GOOSE_BEAT_MS);
      moment(60, `A goose punted ${bag().name} into the hole on hole ${G.holeIdx + 1}`);
      holeOut(s);
      return;
    }
    if (s.sim.result === 'water') { goFishing(end, s.start, { free: true }); return; }   // the goose did it: no penalty
    if (s.sim.result === 'oob') {
      hud.banner('🪿 PUNTED OUT<small>dropped where the goose stood</small>', GOOSE_BEAT_MS);
      G.ball = { x: s.start.x, z: s.start.z, y: G.course.h(s.start.x, s.start.z) + R };
    } else G.ball = { x: end.x, z: end.z, y: end.y };
    ballMesh.visible = true; ballMesh.position.set(G.ball.x, G.ball.y, G.ball.z);
    linger(2.8, () => afterStroke(true));
    return;
  }
  // ghost finishes its stroke too
  G.ghost.played = s.strokeNo;
  G.ghost.playing = null;
  if (G.ghost.parked) {
    // done stymieing you: Old Tom floats back to where his ball really lies
    G.ghost.parked = false;
    G.ghostGlide = { from: { ...G.ghost.override }, to: ghostRestAfter(s.strokeNo), t: 0 };
  } else if (G.ghost.deferred) { G.ghostSolo = { shot: G.ghost.deferred, t: 0, strokeNo: s.strokeNo }; G.ghost.deferred = null; ghostTrail.geometry.setDrawRange(0, 0); tomSwingNow(); }
  else placeGhostMesh(ghostRestAfter(s.strokeNo));
  for (const g of liveGeese()) if (g.state !== 'flee') g.frozen = false;
  // keep a faint trail of this stroke
  const tl = makeTrail(oldTrailMat, s.sim.n); fillTrail(tl, s.sim, s.sim.n); G.trails.push(tl);
  liveTrail.geometry.setDrawRange(0, 0);
  const sim = s.sim;
  const end = sim.end;
  if (G.eggBall) hatchEgg(end);
  if (s.kind !== 'shoo' && PINS.def) PINS.check = true;
  if (sim.result === 'holed') {
    G.ball = { x: G.cup.x, z: G.cup.z, y: end.y };
    holeOut(s);
    return;
  }
  if ((sim.result === 'water' || sim.result === 'oob') && G.powerUp?.lifeRing > 0) {
    // Life Ring: one free splash or OOB this hole
    G.powerUp.lifeRing = 0; renderPowerChip();
    (sfx.lifeRing ?? sfx.catchBall)();
    hud.banner('🛟 SAVED<small>free drop, no penalty</small>', 1800);
    if (sim.result === 'water') { const sp = shorePoint(end, s.start); G.ball = { x: sp.x, z: sp.z, y: G.course.h(sp.x, sp.z) + R }; }
    else G.ball = { ...G.lastLie };
    afterStroke(true);
    return;
  }
  if (sim.result === 'water') { goFishing(end, s.start); return; }
  if (sim.result === 'oob') {
    G.strokes++;  // stroke and distance
    say('oob', vars(), { bump: 18 });
    hud.banner('OUT OF BOUNDS<small>+1 stroke · replay from your last lie</small>', 2000);
    G.ball = { ...G.lastLie };
    afterStroke(true);
    return;
  }
  G.ball = { x: end.x, z: end.z, y: end.y };
  if (end.surface === 'sand' && G.powerUp?.lifeRing > 0) { const p = useLifeRing(G.ball); G.ball = { x: p.x, z: p.z, y: G.course.h(p.x, p.z) + R }; }
  // outcome commentary
  const surf = end.surface;
  const dpin = dist2(G.ball, G.cup);
  if (s.clubId !== 'putter' || !['green', 'fringe'].includes(G.course.surf(s.start.x, s.start.z))) {
    if (dpin < 1.5) { say('close', vars(), { bump: -12 }); hud.banner(`STIFF!<small>${dpin.toFixed(1)} m</small>`, 1400); burst(G.ball.x, G.ball.y + 0.2, G.ball.z, 30, 0xffc84a, { speed: 2, up: 3 }); }
    else if (surf === 'green' || surf === 'fringe') { say(G.strokes + 1 === G.holeDef.par - 1 && Math.random() < 0.6 ? 'greenBirdie' : 'green', vars(), { bump: -15 }); hud.banner(`ON THE GREEN<small>${dpin.toFixed(1)} m to the pin</small>`, 1400); }
    else if (surf === 'fairway') { say('fairway', vars(), { bump: -12 }); hud.banner(`FAIRWAY<small>${dpin.toFixed(0)} m to go</small>`, 1200); }
    else if (surf === 'rough') { say('rough', vars(), { bump: 9 }); hud.banner(`ROUGH<small>${dpin.toFixed(0)} m to go</small>`, 1200); }
    else if (surf === 'sand' && inGutter(G.ball.x, G.ball.z)) { say('gutter', vars(), { bump: 12 }); hud.banner(`🎳 GUTTER BALL<small>${dpin.toFixed(0)} m to go</small>`, 1400); }
    else if (surf === 'sand') { say('sand', vars(), { bump: 11 }); hud.banner(`BUNKER<small>${dpin.toFixed(0)} m to go</small>`, 1200); }
  } else if (dpin < 1.0) hud.banner(`${dpin.toFixed(1)} m`, 800);
  // drive length stat
  if (s.clubId !== 'putter' && dpin < 1.5) moment(18 + dist2(s.start, end) / 5, `Stuck it to ${dpin.toFixed(1)} m from ${dist2(s.start, end).toFixed(0)} m out`);
  if (s.strokeNo === 1 && s.clubId === 'driver') G.stats.longestDrive = Math.max(G.stats.longestDrive, Math.round(dist2(s.start, end)));
  afterStroke(false);
}

function afterStroke(snapBack) {
  roomSendProgress();
  ballMesh.visible = true;
  ballMesh.position.set(G.ball.x, G.ball.y, G.ball.z);
  updateRace();
  if (!snapBack && maybeSasquack()) { updateHUD(); return; }
  if (!snapBack && maybeGooseSteal()) { updateHUD(); return; }
  // curiosity: nearby geese wander over for a look, but never into their own steal radius
  let approacher = null;
  for (const g of liveGeese()) {
    if (g.gosling || g.stare || g.state !== 'graze' || g.frozen) continue;
    const d = dist2(g, G.ball);
    if (d > Math.min(3 * g.radius, 42)) continue;
    if (!approacher || d < approacher.d) approacher = { g, d };
  }
  for (const g of liveGeese()) {
    if (g.gosling || g.stare || g.state !== 'graze' || g.frozen) continue;
    const d = dist2(g, G.ball);
    if (d > Math.min(3 * g.radius, 42)) continue;
    const ux = (g.x - G.ball.x) / (d || 1), uz = (g.z - G.ball.z) / (d || 1);
    if (approacher?.g === g && canSnatch()) {
      // the nearest one comes right over for your ball
      g.target = { x: G.ball.x + ux * 0.6, z: G.ball.z + uz * 0.6 }; g.curious = true; g.approach = true; g.warned = false;
    } else {
      const keep = Math.max(0.4 * d, 1.1 * g.radius), tx = G.ball.x + ux * keep, tz = G.ball.z + uz * keep;
      if (validLand(tx, tz)) { g.target = { x: tx, z: tz }; g.curious = true; }
    }
  }
  startWalk();
}

function updateGhostSolo(dt) {
  const g = G.ghostSolo; if (!g) return;
  g.t = Math.min(g.shot.n - 1, g.t + dt * FPS * 1.6 * G.timeScale);
  const p = frameAt(g.shot, Math.floor(g.t));
  placeGhostMesh(p); fillTrail(ghostTrail, g.shot, g.t);
  if (g.t >= g.shot.n - 1) {
    if (g.shot.result === 'holed') { sfx.tick(); burst(G.cup.x, p.y + 0.2, G.cup.z, 16, 0x7ff6ff, { speed: 1.5, up: 2, life: 1, grav: 1 }); tomLater('holed', 600); }
    finishGhostSolo();
  }
}
function finishGhostSolo() {
  if (!G.ghostSolo) return;
  placeGhostMesh(ghostRestAfter(G.ghostSolo.strokeNo));
  G.ghostSolo = null;
}

// ============================================================ walking to the ball
// Your golfer sprints to the ball (third person), then the camera drops into
// first person at address. Short hops (putts, drops) keep the quick glide.
function startWalk() {
  G.mode = 'walk';
  aimAtPoint(G.cup.x, G.cup.z);
  autoClub();
  const to = addressCam();
  const from = G.playerAt ?? { x: G.ball.x, z: G.ball.z };
  const stand = { x: G.ball.x - fwd(G.yaw).x * 0.9 + fwd(G.yaw).z * 0.5, z: G.ball.z - fwd(G.yaw).z * 0.9 - fwd(G.yaw).x * 0.5 };
  const dist = Math.hypot(stand.x - from.x, stand.z - from.z);
  if (avatar && dist > 6) {
    const dur = clamp(dist / 16, 1.0, 3.0);
    G.walk = { run: true, t: 0, dur, from: { ...from }, stand, to, dist, camFrom: camera.position.clone(), lookFrom: G.camLook.clone() };
  } else G.walk = { t: 0, from: camera.position.clone(), fromLook: G.camLook.clone(), to, dur: clamp(camera.position.distanceTo(to.pos) / 90, 0.6, 1.4) };
  G.playerAt = { ...stand };
  sfx.drop();
  updateHUD();
}
// run your golfer somewhere (a dock), then carry on with `then`
function runTo(stand, look, then) {
  G.mode = 'walk';
  const from = G.playerAt ?? { x: G.ball.x, z: G.ball.z };
  const dist = Math.hypot(stand.x - from.x, stand.z - from.z);
  const to = { pos: new THREE.Vector3(stand.x, G.course.h(stand.x, stand.z) + 1.7, stand.z), look: look.clone() };
  G.walk = { run: true, t: 0, dur: clamp(dist / 16, 0.8, 3.0), from: { ...from }, stand: { ...stand }, to, dist: Math.max(dist, 1), camFrom: camera.position.clone(), lookFrom: G.camLook.clone(), then };
  G.playerAt = { ...stand };
}
function updateWalk(dt) {
  const w = G.walk;
  w.t += dt / w.dur;
  if (w.run) {
    // the run: avatar along the line, chase cam behind and above, blend into address at the end
    const k = clamp(w.t, 0, 1), e = smooth(k);
    const x = lerp(w.from.x, w.stand.x, e), z = lerp(w.from.z, w.stand.z, e), y = G.course.h(x, z);
    const dx = w.stand.x - w.from.x, dz = w.stand.z - w.from.z, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
    avatar.visible = true;
    avatar.position.set(x, y, z); avatar.rotation.set(0, Math.atan2(ux, uz), 0);
    const speed = w.dist / w.dur * 1.5 * Math.sin(Math.PI * clamp(k, 0.05, 0.95));
    animateGolfer(avatar, performance.now() / 1000, { mode: 'run', speed: clamp(speed, 4, 14) });
    if (Math.random() < 0.4) burst(x, y + 0.05, z, 1, 0xcfbf8f, { speed: 0.4, up: 0.6, life: 0.5, grav: 3 });
    const chase = new THREE.Vector3(x - ux * 4.5, y + 2.4, z - uz * 4.5);
    chase.y = Math.max(chase.y, G.course.h(chase.x, chase.z) + 1);
    const look = new THREE.Vector3(x + ux * 6, y + 1, z + uz * 6);
    const blend = smooth(clamp((k - 0.8) / 0.2, 0, 1));
    const intro = 1 - Math.exp(-w.t * w.dur * 6);
    camera.position.copy(w.camFrom).lerp(chase, intro).lerp(w.to.pos, blend);
    G.camLook.copy(w.lookFrom).lerp(look, intro).lerp(w.to.look, blend);
    camera.lookAt(G.camLook);
    if (w.t >= 1) avatar.visible = false;
  } else {
    const k = smooth(clamp(w.t, 0, 1));
    camera.position.lerpVectors(w.from, w.to.pos, k);
    camera.position.y += Math.sin(k * Math.PI) * 4;
    G.camLook.lerpVectors(w.fromLook, w.to.look, k);
    camera.lookAt(G.camLook);
  }
  if (w.t >= 1 && w.then) { G.walk = null; const fn = w.then; fn(); return; }
  if (w.t >= 1) {
    G.walk = null;
    G.mode = 'address';
    snapAddressCam();
    if (!maybeTomNudge()) checkStymie();
    const s = G.course.surf(G.ball.x, G.ball.z);
    if (G.holeIdx === 0 && G.strokes === 1 && !G.hintsShown.scopeTip && G.mode === 'address') { G.hintsShown.scopeTip = true; hud.hint(coarse ? 'Tap 🔭 to zoom.' : '<b>Right-click</b> to zoom.', 6000); }
    if (G.aura && !G.auraTip && !auraOff() && Math.hypot(G.ball.x - G.holeDef.bossAura.at[0], G.ball.z - G.holeDef.bossAura.at[1]) < 160) { G.auraTip = true; hud.toast('🌀 Right of the Boss slings. Left stalls.'); }
    if ((s === 'green' || s === 'fringe') && !G.hintsShown.green) { G.hintsShown.green = true; hud.hint('White arrows point downhill.', 6000); }
  }
}
// Hole 3's set piece: Old Tom's ghost ball drifts across the green and parks
// on your line. He's a ghost. He cheats.
function maybeTomNudge() {
  if (G.room || G.holeDef.spotlight !== 'stymie' || G.tomNudged || G.mode !== 'address') return false;
  const s = G.course.surf(G.ball.x, G.ball.z), d = dist2(G.ball, G.cup);
  if (!(s === 'green' || s === 'fringe') || d < 3) return false;
  const gp = ghostRestAfter(G.strokes);
  if (gp.holed) return false;
  const k = clamp(1.6 / d, 0.3, 0.55);
  const x = lerp(G.ball.x, G.cup.x, k), z = lerp(G.ball.z, G.cup.z, k);
  const to = { x, y: G.course.h(x, z) + R, z };
  G.tomNudged = true; G.stymieTold = true;
  G.ghost.override = { n: G.strokes, ...to };
  G.ghostGlide = { from: { ...gp }, to, t: 0 };
  sfx.stymie(); say('stymie', vars(), { bump: 6 }); tomLater('stymie', 4200);
  hud.banner(`👻 ${G.ghostSource === 'pb' ? 'YOUR GHOST' : 'OLD TOM'} STYMIES YOU!<small>his ball drifts onto your line</small>`, 2600);
  hud.hint('Ghost ball blocks. Curl around it.', 7000);
  return true;
}
function updateGhostGlide(dt) {
  const g = G.ghostGlide; if (!g) return;
  g.t = Math.min(1, g.t + dt / 1.4);
  const k = smooth(g.t);
  placeGhostMesh({ x: lerp(g.from.x, g.to.x, k), y: lerp(g.from.y, g.to.y, k) + Math.sin(k * Math.PI) * 1.2, z: lerp(g.from.z, g.to.z, k) });
  if (Math.random() < 0.5) burst(ghostMesh.position.x, ghostMesh.position.y, ghostMesh.position.z, 2, 0x7ff6ff, { speed: 0.3, up: 0.3, life: 0.8, grav: 0 });
  if (g.t >= 1) G.ghostGlide = null;
}
function checkStymie() {
  if (G.stymieTold || G.mode !== 'address') return;
  if (G.room) { checkRivalStymie(); return; }
  const gp = ghostRestAfter(G.strokes);
  if (gp.holed) return;
  const ax = G.cup.x - G.ball.x, az = G.cup.z - G.ball.z, L = Math.hypot(ax, az);
  if (L < 1) return;
  const t = ((gp.x - G.ball.x) * ax + (gp.z - G.ball.z) * az) / (L * L);
  if (t <= 0.02 || t >= 0.98) return;
  const off = Math.abs((gp.x - G.ball.x) * az - (gp.z - G.ball.z) * ax) / L;
  if (off < 0.65) {
    G.stymieTold = true;
    const full = off < GHOST_R + R + 0.04;
    sfx.stymie(); say('stymie', vars(), { bump: 6 });
    hud.banner(full ? '👻 STYMIED!<small>the ghost ball is right on your line</small>' : '👻 HALF-STYMIE<small>the ghost ball is crowding your line</small>', 2200);
    hud.hint(full ? 'Ghost ball blocks. Curl around it.' : 'Ghost ball nearby. Mind your line.', 7000);
  }
}

// ------------------------------------------------------------ fishing docks
// Every pond has a dock or two on solid ground by the fairway. A ball in the
// water: your golfer runs to the nearest dock and fishes from the end of it,
// and the ball is dropped on dry land at the foot of the dock (never back in
// the drink, and never on a bank the water plane covers).
function dryLand(x, z, margin = 0.45) {
  const s = G.course.surf(x, z);
  return s !== 'water' && s !== 'oob' && s !== 'sand' && G.course.h(x, z) > G.course.waterLevelAt(x, z) + margin;
}
function computeDocks(course, h) {
  const docks = [];
  for (const p of course.ponds) {
    const [cx, cz, rx, rz] = p.e;
    const cands = [];
    for (let i = 0; i < 64; i++) {
      const a = i / 64 * Math.PI * 2;
      for (const k of [1.7, 1.85, 2.0, 2.2, 2.45]) {
        const x = cx + Math.cos(a) * rx * k, z = cz + Math.sin(a) * rz * k;
        const ox = cx + Math.cos(a) * rx * (k + 0.5), oz = cz + Math.sin(a) * rz * (k + 0.5);
        if (!dryLand(x, z, 0.6) || !dryLand(ox, oz, 0.6)) continue;
        cands.push({ a, x, z, score: course.fairwayDist(x, z) + Math.hypot(x - h.pin[0], z - h.pin[1]) * 0.05 });
        break;
      }
    }
    cands.sort((u, v) => u.score - v.score);
    for (const c of cands) {
      if (docks.some(d => d.pond === p && Math.abs(Math.atan2(Math.sin(d.a - c.a), Math.cos(d.a - c.a))) < 1.2)) continue;
      // the dock runs from the bank toward the pond centre until it's well over the water
      const ux = cx - c.x, uz = cz - c.z, L = Math.hypot(ux, uz) || 1;
      let tip = 0;
      for (let d = 0.5; d < 30; d += 0.5) { const x = c.x + ux / L * d, z = c.z + uz / L * d; if (course.surf(x, z) === 'water') { tip = d + 3; break; } }
      if (!tip) continue;
      const back = { x: c.x - ux / L * 2.2, z: c.z - uz / L * 2.2 };
      const drop = dryLand(back.x, back.z, 0.6) ? back : { x: c.x, z: c.z };
      docks.push({ pond: p, a: c.a, land: { x: c.x, z: c.z }, tip: { x: c.x + ux / L * tip, z: c.z + uz / L * tip }, stand: { x: c.x + ux / L * (tip - 1.2), z: c.z + uz / L * (tip - 1.2) }, drop, level: p.level });
      if (docks.filter(d => d.pond === p).length >= (rx * rz > 300 ? 2 : 1)) break;
    }
  }
  return docks;
}
function buildDock(d) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.95 }), post = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 1 });
  const dx = d.tip.x - d.land.x, dz = d.tip.z - d.land.z, L = Math.hypot(dx, dz);
  const top = Math.max(d.level + 0.35, G.course.h(d.land.x, d.land.z) + 0.15);
  g.position.set(d.land.x, top, d.land.z);
  g.rotation.y = Math.atan2(dx, dz);
  for (let i = 0; i < Math.ceil(L / 0.6); i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.5), wood);
    plank.position.set((Math.random() - 0.5) * 0.06, 0, 0.3 + i * 0.6); plank.rotation.y = (Math.random() - 0.5) * 0.05;
    plank.castShadow = plank.receiveShadow = true; g.add(plank);
  }
  for (let i = 0; i <= Math.ceil(L / 2.4); i++) for (const sx of [-0.7, 0.7]) {
    const z = Math.min(L, i * 2.4), wx = d.land.x + dx / L * z, wz = d.land.z + dz / L * z;
    const ground = Math.min(G.course.h(wx, wz), d.level - 0.6), hgt = top - ground + 0.3;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, hgt, 6), post);
    p.position.set(sx, 0.25 - hgt / 2, z); g.add(p);
  }
  return g;
}
function dockFor(splash) {
  const docks = G.docks ?? [];
  if (!docks.length) return null;
  // nearest dock to the splash that isn't nearer the pin than where the ball went in
  const dPin = Math.hypot(splash.x - G.cup.x, splash.z - G.cup.z);
  const fair = docks.filter(d => Math.hypot(d.drop.x - G.cup.x, d.drop.z - G.cup.z) >= dPin - 2);
  const pool = fair.length ? fair : docks;
  return pool.reduce((b, d) => (!b || Math.hypot(d.stand.x - splash.x, d.stand.z - splash.z) < Math.hypot(b.stand.x - splash.x, b.stand.z - splash.z) ? d : b), null);
}
// splash -> run to the dock -> fish from it
function goFishing(end, from, opts = {}) {
  const dock = dockFor(end);
  ballMesh.visible = false;
  say('water', vars(), { bump: 20 });
  hud.banner(`${esc(bag().name.toUpperCase())}!`, 1100);
  if (!dock || !avatar) { startAngler(end, from, null, opts); return; }
  runTo(dock.stand, new THREE.Vector3(end.x, G.course.waterLevelAt(end.x, end.z), end.z), () => startAngler(end, from, dock, opts));
}

// ============================================================ angler (Four Balls, One Life)
const angler = { active: false, t: 0, tension: 30, progress: 0, reeling: false, ph1: 0, ph2: 0, splash: null, from: null, clickT: 0 };
function startAngler(end, from, dock = null, opts = {}) {
  const free = !!opts.free;
  G.mode = 'angler';
  document.body.classList.add('angling');
  ballMesh.visible = false;
  Object.assign(angler, { active: true, t: 0, tension: 30, progress: 0, reeling: false, ph1: Math.random() * 6, ph2: Math.random() * 6, splash: { x: end.x, z: end.z }, from, dock, free, pondToss: !!opts.pondToss });
  if (avatar) avatar.visible = false;   // first person on the dock: it's your rod
  $('anglerTitle').textContent = `🎣 Save ${bag().name}!`;
  angler.ready = READY_SECS;
  readyCard('anglerReady', `🎣 ${esc(bag().name).toUpperCase()} IS SINKING!`, coarse ? 'HOLD THE BUTTON' : 'HOLD SPACE OR CLICK', '✊');
  $('anglerTimer').textContent = `${(free ? 5 : 7).toFixed(1)} s`; $('reelFill').style.width = '0%';
  setTimeout(() => { if (angler.active) $('angler').classList.remove('hidden'); }, 450);
  // look at the splash
  const lk = new THREE.Vector3(end.x, G.course.waterLevelAt(end.x, end.z), end.z);
  G.walk = null;
  G.anglerLook = lk;
  rod.visible = true;
}
function updateAngler(dt) {
  if (!angler.active) return;
  if (!$('help').classList.contains('hidden') || !$('lb').classList.contains('hidden')) { angler.reeling = false; return; }
  if ($('angler').classList.contains('hidden')) return;
  if (angler.ready > 0) {
    angler.ready -= dt;
    if (angler.ready <= 0) $('anglerReady').classList.remove('show');
    return;
  }
  angler.t += dt * G.timeScale;
  const t = angler.t;
  const pull = 18 + 52 * (0.5 + 0.5 * Math.sin(t * 2.1 + angler.ph1)) * (0.5 + 0.5 * Math.sin(t * 0.9 + angler.ph2));
  const k = dt * G.timeScale;
  angler.tension += (angler.reeling ? 60 + pull : -75 + pull * 0.4) * k;
  angler.tension = Math.max(0, angler.tension);
  const safe = angler.tension >= 20 && angler.tension <= 88;
  angler.progress += (angler.reeling ? (safe ? 46 : 10) : -1.5) * k;
  angler.progress = clamp(angler.progress, 0, 100);
  if (angler.reeling && (angler.clickT -= k) <= 0) { sfx.reelClick(); angler.clickT = 0.07; }
  $('tensionNeedle').style.left = `${clamp(angler.tension, 0, 100)}%`;
  $('reelFill').style.width = `${angler.progress}%`;
  const limit = angler.free ? 5 : 7;
  $('anglerTimer').textContent = `${Math.max(0, limit - t).toFixed(1)} s`;
  // the ball fights back in tugs: a splash, a jolt of tension
  if (Math.floor(t / 1.4) !== Math.floor((t - k) / 1.4)) {
    angler.tension += 9; sfx.splashBob();
    const lk = G.anglerLook; burst(lk.x, lk.y + 0.05, lk.z, 14, 0xdff4ff, { speed: 1.5, up: 2.5, life: 0.7 });
    G.shake = Math.max(G.shake, 0.06);
  }
  if (angler.tension >= 100) endAngler(false, 'snap');
  else if (angler.progress >= 100) endAngler(true);
  else if (t >= limit) endAngler(false, 'slip');
}
function endAngler(won, why) {
  angler.active = false; angler.reeling = false; $('anglerReady').classList.remove('show');
  document.body.classList.remove('angling');
  rod.visible = false;
  $('angler').classList.add('hidden');
  if (!angler.free) G.strokes++; // penalty stroke either way (a goose's splash is on the goose)
  let shore = angler.dock ? angler.dock.drop : shorePoint(angler.splash, angler.from);
  if (angler.pondToss) shore = won ? { x: G.gooseLie.x, z: G.gooseLie.z } : lossSpot(shore);
  if (angler.dock) G.playerAt = { ...angler.dock.drop };
  const b = bag();
  ballFarewell({ x: angler.splash.x, z: angler.splash.z, y: G.course.waterLevelAt(angler.splash.x, angler.splash.z) }, !won && !b.range);
  if (won) {
    G.stats.ballsSaved++; moment(15, `Fished ${b.name} out of the drink`);
    sfx.catchBall();
    const junk = Math.random() < 0.3 ? JUNK[Math.floor(Math.random() * JUNK.length)] : null;
    if (junk) {
      G.stats.junk.push(junk); sfx.junk();
      hud.banner(`🎣 ${esc(b.name)}<small>…and ${esc(junk)}!</small>`, 2200);
      say('junk', vars(), { bump: 4 });
    } else { hud.banner(`🎣 ${esc(b.name)} LIVES!<small>+1 penalty stroke</small>`, 1800); say('saved', vars(), { bump: -6 }); }
  } else if (b.range || angler.free) {
    // the range ball is immortal (and a goose-made splash never kills a ball): nobody wants it, not even the lake
    sfx.snap();
    hud.banner('The range ball sinks…<small>…and bobs straight back up. +1 stroke</small>', 2200);
    say('junk', vars(), { bump: 6 });
  } else {
    G.stats.ballsLost++; moment(20, `Laid ${b.name} to rest on hole ${G.holeIdx + 1}`);
    sfx.snap(); setTimeout(() => sfx.bell(), 300);
    b.alive = false;
    const gy = graveyard();
    gy.push({ name: b.name, trait: b.trait.label, hole: G.holeIdx + 1, date: new Date().toISOString().slice(0, 10) });
    store.set('ghg3d_graveyard', JSON.stringify(gy.slice(-200)));
    say('snap', vars(), { bump: 20 });
    hud.banner(`✝ ${esc(b.name)}<small>${why === 'slip' ? 'slipped the hook' : 'the line snapped'} · ${esc(b.trait.label)} · R.I.P.</small>`, 2600);
    if (!b.range) G.ballIdx = nextAliveIdx();
    renderBag();
    const nb = bag();
    if (G.ballIdx >= G.bag.length) setTimeout(() => say('rangeBall', vars(), { bump: 10 }), 2700);
    else setTimeout(() => { sfx.newBall(); hud.toast(`Hi, I'm <b>${esc(nb.name)}</b>. Be gentle.`); G.ballTagT = 4; G.ballTagFull = true; }, 2700);
  }
  G.ball = { x: shore.x, z: shore.z, y: G.course.h(shore.x, shore.z) + R };
  afterStroke(true);
}
function shorePoint(splash, from) {
  const dx = from.x - splash.x, dz = from.z - splash.z, L = Math.hypot(dx, dz) || 1;
  for (let d = 0; d < L + 40; d += 0.5) {
    const x = splash.x + dx / L * d, z = splash.z + dz / L * d;
    if (validLand(x, z)) {
      // step a little further onto dry grass, if there is some
      const x2 = x + dx / L * 1.5, z2 = z + dz / L * 1.5;
      return validLand(x2, z2) ? { x: x2, z: z2 } : { x, z };
    }
  }
  return { x: from.x, z: from.z };
}

// ============================================================ hole out
function moment(score, text) { if (!G.stats.moment || score > G.stats.moment.score) G.stats.moment = { score, text }; }
function holeOut(s, afterScare) {
  if (G.holeDef.spotlight === 'scare' && !G.scareDone && !afterScare) {
    G.holeScores[G.holeIdx] = G.strokes;   // scored before anything jumps out
    startScare(s); return;
  }
  G.mode = 'holed';
  const from = dist2(s.start, G.cup);
  if (!s.gimme) moment(from * (G.strokes === 1 ? 4 : 1) + (s.wasBullet ? 10 : 0), `${G.strokes === 1 ? 'Ace' : 'Holed'} from ${from.toFixed(from < 10 ? 1 : 0)} m on hole ${G.holeIdx + 1}`);
  ballMesh.visible = false;
  const n = G.strokes, par = G.holeDef.par;
  G.holeScores[G.holeIdx] = n;
  const diff = n - par;
  const name = n === 1 ? 'HOLE IN ONE!' : diff <= -3 ? 'ALBATROSS!' : diff === -2 ? 'EAGLE!' : diff === -1 ? 'BIRDIE!' : diff === 0 ? 'PAR' : diff === 1 ? 'BOGEY' : diff === 2 ? 'DOUBLE BOGEY' : `+${diff}`;
  sfx.holed();
  hud.banner(`${name}<small>${n} stroke${n === 1 ? '' : 's'}${G.room ? '' : ` · ghost ${G.ghost.strokes.length}`}</small>`, 2600);
  roomSendProgress();
  for (let k = 0; k < 6; k++) setTimeout(() => burst(G.cup.x, G.course.h(G.cup.x, G.cup.z) + 0.3, G.cup.z, 40, CONFETTI[k], { speed: 4, up: 6, life: 2, grav: 5 }), k * 90);
  say(n === 1 ? 'ace' : 'holed', vars(), { bump: diff <= 0 ? -40 : -15 });
  updateRace();
  G.race.round += n - G.ghost.strokes.length;
  broadcastHole(G.holeIdx + 1, n);
  G.celebrate = 2.7;
  if (G.holeDef.finale) crownCeremony();
  updateHUD();
}
// The round's last putt: fireworks over the mesa, and the Boss leads its
// geese away across the moon. Under 4 s, and any input skips it.
function crownCeremony() {
  G.celebrate = 4.0;
  const rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [px, pz] = G.holeDef.pin, py = G.course.h(px, pz);
  const n = rm ? 2 : 6;
  for (let k = 0; k < n; k++) setTimeout(() => {
    if (G.mode !== 'holed') return;
    const a = G.crown?.away ?? { x: 0, z: -1 }, side = (k % 3 - 1) * 9, fwd = 14 + (k % 2) * 10;
    const x = px + a.x * fwd - a.z * side, z = pz + a.z * fwd + a.x * side, y = py + 12 + (k % 3) * 3;
    burst(x, y, z, 130, CONFETTI[k % CONFETTI.length], { speed: 9, up: 1, life: 2.4, grav: 2.5, spread: 1 });
    sfx.thump();
  }, 250 + k * 420);
  const sd = env.sunDir, away = Math.hypot(sd.x, sd.z) > 0.05 ? { x: sd.x / Math.hypot(sd.x, sd.z), z: sd.z / Math.hypot(sd.x, sd.z) } : { x: 0, z: -1 };
  G.crown = { t: 0, away };
  const flock = liveGeese().filter(g => !g.gosling && !g.carry && g.state !== 'tug' && Math.hypot(g.x - px, g.z - pz) < 80).sort((a, b) => (a.boss ? 1 : 0) - (b.boss ? 1 : 0));   // the crown leaves last
  flock.forEach((g, k) => {
    const side = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 3;
    const vx = px + away.x * (22 + Math.ceil(k / 2) * 2.5) - away.z * side * 0.35, vz = pz + away.z * (22 + Math.ceil(k / 2) * 2.5) + away.x * side * 0.35;
    g.ceremony = { delay: 0.1 + k * 0.12, via: { x: vx, z: vz }, to: { x: vx + away.x * 900, z: vz + away.z * 900 } };
    g.yaw = Math.atan2(away.x, away.z);
  });
  setTimeout(() => say('finale', vars(), { bump: -20 }), 600);
  if (G.room) sendEmote('finale', '', String(G.holeIdx + 1));
  else tomLater(G.race.round <= 0 ? 'behind' : 'ahead', 2600);
}

// ============================================================ hole flow
// tee: a sweeping flyover with the hole's name -> the power-up wheel -> play
// -> hole out -> the between-hole card (scores live here now, not on the
// HUD). In a room, that card waits for everyone and you watch them play.
function pathLen(path) { let L = 0; for (let i = 0; i < path.length - 1; i++) L += Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]); return L; }
function startFlyover() {
  const h = G.holeDef, len = pathLen(h.path);
  G.mode = 'flyover';
  G.fly = { t: 0, dur: clamp(2.8 + len / 120, 3.4, 5.6) };
  $('flyHole').textContent = `Hole ${G.holeIdx + 1} · Par ${h.par} · ${pinText(G.ball)} m`;   // (S9) the HUD's own number
  $('flyName').textContent = h.name;
  $('flySkip').textContent = coarse ? 'Tap to skip' : 'Click to skip';
  $('flyTitle').classList.add('show'); document.body.classList.add('flying');
  hud.hint('');
  sfx.slowmo();
  updateFlyover(0);
  camera.position.copy(G.fly.pos); camera.lookAt(G.fly.look); G.camLook.copy(G.fly.look);
}
function updateFlyover(dt) {
  const f = G.fly, h = G.holeDef;
  f.t += dt;
  const k = clamp(f.t / f.dur, 0, 1), e = smooth(k);
  // glide from behind the tee, high, down the hole to hang over the green
  const s = -0.12 + 0.95 * e;
  const p = pathPoint(h.path, s), q = pathPoint(h.path, Math.min(1, s + 0.22 + 0.1 * (1 - e)));
  const alt = 30 - 12 * e;
  const pos = new THREE.Vector3(p.x, Math.max(G.course.h(p.x, p.z), 0) + alt, p.z);
  const look = new THREE.Vector3(q.x, G.course.h(q.x, q.z), q.z);
  f.pos = pos; f.look = look;
  if (dt > 0) {
    camera.position.lerp(pos, 1 - Math.exp(-dt * 5));
    G.camLook.lerp(look, 1 - Math.exp(-dt * 5)); camera.lookAt(G.camLook);
  }
  if (f.t >= f.dur) endFlyover();
}
function skipFlyover() { if (G.mode === 'flyover') G.fly.t = G.fly.dur; }
function endFlyover() {
  const h0 = G.holeDef;
  $('flyTitle').classList.remove('show'); document.body.classList.remove('flying');
  G.mode = 'address';
  snapAddressCam();
  hud.flash(0.25);
  if (G.holeIdx === 0 || G.holeScores.filter(Number.isInteger).length === 0) say('tee', vars(), {});
  hud.hint(holeHint()); G.idleSince = 0;
  const first = !G.holeScores.some(Number.isInteger) || G.holeIdx === 0;
  G.ballTagFull = first; G.ballTagT = first ? 4 : 2.5;
  setTimeout(() => { if (G.mode === 'address' && !G.wheel && G.holeDef === h0) startWheel(); }, 300);
  if (h0.deck) hud.toast(`Tonight: ${esc(h0.deck)}.`);
  if (h0.finale) { finaleStakes(); startFinalGroup(); }
}
// The Final Group (council round 7): in a room, the last hole waits for everyone
// still playing to reach its tee (45 s at most, or "Tee off now"), then a shared
// 3-2-1 sends you off together. Only online members count, so a dropout can't stall it.
const finalOthers = () => [...rivals.values()].filter(r => r.online && r.prog && !r.prog.done);
function startFinalGroup() {
  if (!G.room || !finalOthers().length) return;
  G.finalWait = { t0: performance.now(), count: 0, shown: -1, lastN: -1 };
  $('finalGroup').classList.remove('hidden');
  hud.hint('');
}
function finalCountdown() { const F = G.finalWait; if (F && !F.count) { F.count = performance.now(); $('finalGroup').classList.add('hidden'); } }
$('finalGroup').querySelector('button').addEventListener('click', e => { e.stopPropagation(); finalCountdown(); });
function updateFinalGroup() {
  const F = G.finalWait; if (!F) return;
  if (!G.room || !G.holeDef?.finale) { G.finalWait = null; $('finalGroup').classList.add('hidden'); return; }
  const now = performance.now();
  if (!F.count) {
    const waiting = finalOthers().filter(r => (r.prog.hole ?? 0) < HOLES.length);
    if (!waiting.length || now - F.t0 > 45000) { finalCountdown(); return; }
    if (waiting.length !== F.lastN) { F.lastN = waiting.length; $('finalGroup').querySelector('span').textContent = `Final group. Waiting for ${waiting.length}.`; }
    return;
  }
  const k = Math.floor((now - F.count) / 800);
  if (k === F.shown) return;
  F.shown = k;
  if (k < 3) { hud.banner(String(3 - k), 700); sfx.tick(); }
  else { hud.banner('⛳ TEE OFF!', 1200); (sfx.wheelLand ?? sfx.calledIt)(true); G.finalWait = null; }
}
// The last hole raises the stakes: Old Tom's last wager when it's close, and
// the Boss taxes a clear leader (once, never on a green, no stroke added).
function finaleStakes() {
  const n = G.holeIdx, mine = toParThru(G.holeScores, n);
  let lead = -Infinity;
  if (G.room) {
    const others = [...rivals.values()].filter(r => r.online && r.prog);
    if (others.length) lead = Math.min(...others.map(r => toParThru(r.prog.scores, Math.min(n, r.prog.scores?.length ?? 0)))) - mine;
  } else if (G.ghost) {
    const ghost = G.ghostScores.slice(0, n).reduce((a, v, i) => a + (Number.isInteger(v) ? v - HOLES[i].par : 0), 0);
    lead = ghost - mine;
    if (Math.abs(lead) <= 1 && tomTalks()) {
      hud.toast(lead === 0 ? '⚖️ All square. Last hole.' : '⚖️ One in it. Last hole.');
      setTimeout(() => { if (G.holeDef === HOLES_LAST() && G.mode !== 'end') tomSay('final'); }, 1800);
    }
  }
  if (lead >= 2 && !G.leaderTaxed) {
    G.leaderTaxed = true; G.sicPending = 'The Boss';
    setTimeout(() => hud.toast('👑 The Boss taxes the leader.'), 2600);
  }
}
const HOLES_LAST = () => G.holeIdx === HOLES.length - 1 ? G.holeDef : null;

// ------------------------------------------------------------ power-up wheel
// Every hole spins a wheel in the corner (council round 6; re-ruled so every
// wedge matters on every one of the nine holes, see council-round6.md §10 and round 7). It never blocks:
// the effect is live from the moment the hole loads, swinging just snaps the
// wheel to its answer. Draws are seeded per player (and per room member), so
// a reload can't re-roll and everyone sees 7 of the same 8 wedges a round.
const POWERUPS = [
  { id: 'bucket', emoji: '🪣', name: 'Bucket Cup', desc: 'Cup is way bigger this hole.', color: '#4fd39a', kind: 'good', hole: { cupR: 0.45 } },
  { id: 'ghost', emoji: '👻', name: 'Ghost Ball', desc: 'Ghost through all scenery this hole.', color: '#7ff6ff', kind: 'good', hole: { noTrees: true } },
  { id: 'ring', emoji: '🛟', name: 'Life Ring', desc: 'One free escape: sand, water, OOB.', color: '#ff9a3c', kind: 'good', hole: { lifeRing: 1 } },
  { id: 'moon', emoji: '🌙', name: 'Moon Boots', desc: 'Next shot floats on moon gravity.', color: '#9aa8ff', kind: 'chaotic', shot: { airGravity: 0.5 } },
  { id: 'pogo', emoji: '🦘', name: 'Pogo Ball', desc: 'Next shot bounces like a superball.', color: '#ffc84a', kind: 'chaotic', shot: { bounce: 2.2 } },
  { id: 'sic', emoji: '🪿', name: "Sic 'Em", desc: 'A goose mugs the leader.', color: '#f4f4f4', kind: 'chaotic', hole: { sic: true } },
  { id: 'banana', emoji: '🍌', name: 'Banana Ball', desc: 'Next shot swerves hard left.', color: '#ffe066', kind: 'cursed', shot: { banana: true } },
  { id: 'bait', emoji: '🍞', name: 'Goose Bait', desc: 'A goose is coming for your ball.', color: '#ff6f61', kind: 'cursed', hole: { bait: true } },
];
function fnv1a(str) { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function drawWheelOrder() {
  const seed = G.room ? (G.room.seed ^ fnv1a(G.room.me)) >>> 0 : (Math.random() * 4294967296) >>> 0;
  const rng = W.mulberry32(seed);
  const first = ['bucket', 'ghost', 'ring'][Math.floor(rng() * 3)];
  const order = [first, ...shuffle(POWERUPS.map(p => p.id).filter(id => id !== first), rng)];   // all eight, once each
  // crazy golf is all green, where geese never steal: no goose wedge there
  const mi = HOLES.findIndex(h => h.mini), goosey = id => id === 'sic' || id === 'bait';
  if (mi > 0 && mi < order.length && goosey(order[mi])) {
    const j = order.findIndex((id, k) => k > 0 && k !== mi && !goosey(id));
    [order[mi], order[j]] = [order[j], order[mi]];
  }
  while (order.length < HOLES.length) {   // the ninth: a repeat, never the wedge just drawn
    const pool = POWERUPS.map(p => p.id).filter(id => id !== order.at(-1));
    order.push(pool[Math.floor(rng() * pool.length)]);
  }
  G.wheelOrder = order;
}
function startWheel() {
  const id = G.wheelOrder?.[G.holeIdx] ?? POWERUPS[0].id;
  const n = POWERUPS.length, pick = POWERUPS.findIndex(p => p.id === id);
  const disc = $('wheelDisc');
  disc.style.background = `conic-gradient(${POWERUPS.map((p, i) => `${p.color} ${i * 360 / n}deg ${(i + 1) * 360 / n}deg`).join(',')})`;
  disc.innerHTML = POWERUPS.map((p, i) => {
    const a = (i + 0.5) * 360 / n;
    return `<span style="transform: rotate(${a}deg) translate(-50%, -40px) rotate(${-a}deg) translate(0, -50%)">${p.emoji}</span>`;
  }).join('');
  const centre = (pick + 0.5) * 360 / n + (Math.random() - 0.5) * (280 / n);
  const back = G.holeDef.spotlight === 'scare';   // the graveyard: the wheel spins backward. Ominous.
  G.wheel = { t: -0.3, dur: 2.0, to: back ? -(360 * 3 + centre) : 360 * 3 + (360 - centre), pick, shown: false, end: 0, lastTick: 0 };
  $('wheelOut').innerHTML = '';
  $('wheel').classList.remove('hidden', 'chip');
  disc.style.transform = 'rotate(0deg)';
  applyPowerUp(POWERUPS[pick], true);
}
function updateWheel(dt) {
  const w = G.wheel;
  if (!w) return;
  w.t += dt;
  const k = clamp(w.t / w.dur, 0, 1), e = 1 - (1 - k) ** 3;
  const rot = w.to * e;
  $('wheelDisc').style.transform = `rotate(${rot}deg)`;
  const wedge = Math.floor(Math.abs(rot) / (360 / POWERUPS.length));
  if (wedge !== w.lastTick && k < 1) { w.lastTick = wedge; (sfx.wheelTick ?? sfx.tick)(); }
  if (k >= 1 && !w.shown) {
    w.shown = true; w.end = w.t + 3;
    const p = POWERUPS[w.pick];
    landPowerUp(p);   // first: Sic 'Em may turn into Bodyguard
    const pu = G.powerUp ?? p;
    // (S11) the wheel's words and the chip's words come from the same power-up; curses wear a skull
    $('wheelOut').innerHTML = `<b>${pu.kind === 'cursed' ? '☠️ ' : ''}${pu.emoji} ${esc(pu.name)}</b>${esc(powerDesc(pu))}`;
    $('wheelOut').classList.toggle('curse', pu.kind === 'cursed');
    sfx.wheelLand ? sfx.wheelLand(p.kind !== 'cursed') : sfx.calledIt();
  }
  if (w.shown && w.t >= w.end) finishWheel();
}
function hurryWheel() {
  const w = G.wheel; if (!w) return;
  if (!w.shown) w.t = Math.max(w.t, w.dur); else w.end = 0;
}
function finishWheel() {
  $('wheel').classList.add('hidden');
  G.wheel = null;
  renderPowerChip();
  // (S10) the very first tee: the controls go up once the wheel is done, and stay until you swing
  if (!G.hintsShown.swing && G.mode === 'address') hud.hint(CONTROL_HINT(coarse), 0, { stay: true });
}
const powerDesc = p => p.id === 'banana' && G.holeIdx % 2 === 1 ? 'Next shot swerves hard right.'
  : p.id === 'sic' && G.powerUp?.taxi ? 'A goose relocates your next lie.'
  : p.id === 'moon' && G.holeDef?.airGravity ? 'Next shot: moon gravity, squared.' : p.desc;
function applyPowerUp(p, quiet) {
  G.powerUp = { ...p, ...(p.hole ?? {}), shotLeft: p.shot ? 1 : 0, landed: false };
  if (G.powerUp.cupR) setCupVisual(G.powerUp.cupR);
  G.previewDirty = true;
  if (!quiet) { landPowerUp(p); renderPowerChip(); }
}
// the wedge is revealed: anything with a visible side effect happens now
function landPowerUp(p) {
  const pu = G.powerUp; if (!pu || pu.landed) return;
  pu.landed = true;
  if (pu.sic) {
    const target = sicTarget();
    if (target) { sendEmote('sic', target.id, String(G.holeIdx + 1)); hud.toast(`🪿 A goose is on its way to ${esc(target.name)}.`); }
    else { pu.taxi = true; pu.name = 'Goose Taxi'; pu.emoji = '🪿'; }   // solo, or nobody left to mug
  }
  if (pu.bait) { G.baitPending = true; hud.toast('🍞 Your pockets smell of bread.'); }
}
function renderPowerChip() {
  const p = G.powerUp, el = $('powerChip');
  const live = p && p.landed && !G.wheel && (p.hole || p.shotLeft > 0) && !(p.lifeRing === 0);
  el.classList.toggle('hidden', !live);
  if (live) {
    el.innerHTML = `<span class="e">${p.kind === 'cursed' ? '☠️' : ''}${p.emoji}</span> <b>${esc(p.name)}</b> · ${esc(powerDesc(p))}`;
    el.classList.toggle('curse', p.kind === 'cursed');
    el.classList.remove('mini'); clearTimeout(renderPowerChip.t);
    if (narrow()) renderPowerChip.t = setTimeout(() => el.classList.add('mini'), 2500);   // shrinks to its emoji; tap to read it again
  }
}
// physics modifiers for the shot about to be hit. "Next shot" power-ups skip
// putts and are spent by the next full swing.
function shotMods(consume, clubId = G.club) {
  const p = G.powerUp; if (!p) return {};
  const m = { cupR: p.cupR, noTrees: p.noTrees };
  if (p.shotLeft > 0 && (clubId !== 'putter' || G.holeDef?.mini)) {   // crazy golf is all putts: they count there
    Object.assign(m, p.shot);
    if (consume) { p.shotLeft = 0; setTimeout(renderPowerChip, 1500); }
  }
  return m;
}
// Crazy golf: Moon Boots and Pogo turn a putt into a hop, Banana adds curl on the felt.
function miniPutt(L, mods, clubId) {
  if (!G.holeDef?.mini || clubId !== 'putter') return false;
  if (mods.airGravity || mods.bounce) { L.vy = 2.4; L.rolling = false; }
  if (mods.banana) L.curl = (G.holeIdx % 2 ? 1 : -1) * 0.06;
  return true;
}
function setCupVisual(r) {
  const k = r / CUP_R;
  for (const o of G.flag.children) if (o.geometry?.type === 'CircleGeometry' || o.geometry?.type === 'RingGeometry') o.scale.setScalar(k);
}

// ------------------------------------------------------------ between holes
// (round 8, S5) waiting: a visible countdown to "Go on without them", an idle
// flag for anyone who has sent nothing for a while, and a bottom strip instead
// of a half-screen card (tap its title for the full card)
const WAIT_SECS = 45, IDLE_MS = 45000;
const isIdle = r => !!r && r.online && !r.prog?.done && performance.now() - (r.activeAt ?? 0) > IDLE_MS;
function afterHole() {
  if (G.holeIdx + 1 >= HOLES.length) { endRound(); return; }
  G.mode = 'between';
  G.between = { t: 0, render: 0, goAt: 0, watching: null, cam: null };
  for (const r of rivals.values()) r.activeAt ??= performance.now();
  $('between').classList.remove('open');
  renderBetween();
  $('between').classList.remove('hidden'); document.body.classList.add('between');
}
const scoreWord = d => d <= -3 ? 'Albatross' : d === -2 ? 'Eagle' : d === -1 ? 'Birdie' : d === 0 ? 'Par' : d === 1 ? 'Bogey' : d === 2 ? 'Double bogey' : `+${d}`;
// Rivals still playing the hole we just finished (online, same round).
function waitingFor() {
  if (!G.room || !sameRound()) return [];
  const h = G.holeIdx + 1;
  return [...rivals.values()].filter(r => r.online && !r.prog?.done && (r.prog?.scores?.length ?? 0) < h);
}
function renderBetween() {
  const n = G.holeScores[G.holeIdx], par = G.holeDef.par;
  const done = G.holeScores.filter(Number.isInteger);
  const tot = done.reduce((a, b) => a + b, 0), toPar = done.reduce((s, v, i) => s + v - HOLES[i].par, 0);
  $('betweenHead').innerHTML = `Hole ${G.holeIdx + 1}: ${n === 1 ? 'Hole in one!' : scoreWord(n - par)}<small>${n} stroke${n === 1 ? '' : 's'} · round ${tot} (${fmtPar(toPar)})</small>`;
  $('betweenScores').innerHTML = HOLES.map((h, i) => {
    const v = G.holeScores[i], d = Number.isInteger(v) ? v - h.par : 0;
    return `<div class="${!Number.isInteger(v) ? '' : d < 0 ? 'under' : d > 0 ? 'over' : ''}${i === G.holeIdx ? ' cur' : ''}">${i + 1}<b>${Number.isInteger(v) ? v : '·'}</b></div>`;
  }).join('');
  $('betweenBag').innerHTML = bagHTML();
  const st = $('betweenStand');
  if (G.room) {
    const rows = standings();
    st.innerHTML = rows.map(x => `<li class="${x.me ? 'me' : ''}${x.online ? '' : ' off'}"><span class="dot" style="background:${x.hex}"></span>${x.tie ? 'T' : ''}${x.pos}. ${esc(x.name)}${x.idle ? ' 💤' : x.online ? '' : ' 📴'}<b>${fmtPar(x.toPar)}</b><small>${thruTxt(x)}</small></li>`).join('');
  } else st.innerHTML = '';
  const wait = waitingFor(), btn = $('betweenGo');
  document.body.classList.toggle('waiting', wait.length > 0);
  const left = Math.ceil(WAIT_SECS - G.between.t), late = left <= 0 || wait.every(isIdle);
  if (wait.length) {
    const w = G.between.watching;
    $('betweenWait').textContent = `Waiting for ${wait.map(r => r.name + (isIdle(r) ? ' 💤' : '')).join(', ')}…${w ? ` 👀 ${w.name}` : ''}`;
    btn.disabled = !late; btn.textContent = late ? 'Go on without them ▶' : `Go on without them in ${left} s`;
  } else {
    $('betweenWait').textContent = G.room ? 'Everyone is in!' : '';
    btn.disabled = false; btn.textContent = `Hole ${G.holeIdx + 2} ▶`;
  }
  $('emotes').classList.toggle('hidden', !(G.room && rivals.size));
  if (!wait.length && G.elsewhere?.length) $('betweenWait').innerHTML = `📣 ${G.elsewhere.join(' · ')}`;
  renderEmoteButtons();
}
function updateBetween(dt) {
  const b = G.between; b.t += dt;
  const wait = waitingFor();
  if ((b.render -= dt) <= 0) { b.render = 0.5; renderBetween(); }
  if (G.room && !wait.length) {
    if (!b.goAt) b.goAt = b.t + 2;
    if (b.t >= b.goAt) { goNextHole(); return; }
  }
  if (!G.room && b.t > 12) { goNextHole(); return; }
  // spectator cam: follow a friend who's still out there, else circle the cup
  const lively = [...wait].sort((x, y) => isIdle(x) - isIdle(y) || (y.activeAt ?? 0) - (x.activeAt ?? 0));
  let r = b.watching && wait.includes(b.watching) && !isIdle(b.watching) ? b.watching : wait.find(x => x.playing) ?? lively[0] ?? null;
  // a ball in the air always wins the camera, and keeps it until it stops
  if (r && !r.playing && wait.some(x => x.playing)) r = wait.find(x => x.playing);
  const snap = r !== b.watching && r;
  b.watching = r;
  let pos, look;
  const p = r ? (r.playing ? r.playing.pos : rivalPos(r)) : null;
  if (p) {
    if (r.playing) {
      const v = frameAt(r.playing.shot, Math.floor(r.playing.t) + 1), hv = Math.hypot(v.x - p.x, v.z - p.z);
      const dir = hv > 0.02 ? { x: (v.x - p.x) / hv, z: (v.z - p.z) / hv } : b.dir ?? { x: 0, z: -1 };
      b.dir = dir;
      pos = new THREE.Vector3(p.x - dir.x * 7, p.y + 2.8, p.z - dir.z * 7);
      look = new THREE.Vector3(p.x, p.y, p.z);
    } else {
      const dx = G.cup.x - p.x, dz = G.cup.z - p.z, L = Math.hypot(dx, dz) || 1;
      pos = new THREE.Vector3(p.x - dx / L * 3.4 + dz / L * 1.2, p.y + 1.7, p.z - dz / L * 3.4 - dx / L * 1.2);
      look = new THREE.Vector3(p.x + dx / L * 6, p.y + 0.2, p.z + dz / L * 6);
    }
  } else {
    const a = b.t * 0.25, cy = G.course.h(G.cup.x, G.cup.z);
    pos = new THREE.Vector3(G.cup.x + Math.cos(a) * 9, cy + 3.5, G.cup.z + Math.sin(a) * 9);
    look = new THREE.Vector3(G.cup.x, cy + 0.3, G.cup.z);
  }
  pos.y = Math.max(pos.y, G.course.h(pos.x, pos.z) + 0.6);
  if (snap) { camera.position.copy(pos); G.camLook.copy(look); hud.flash(0.15); }   // cut, don't fly 250 m
  camera.position.lerp(pos, 1 - Math.exp(-dt * 2.5));
  G.camLook.lerp(look, 1 - Math.exp(-dt * 4)); camera.lookAt(G.camLook);
}
function goNextHole() {
  if (G.mode !== 'between') return;
  G.elsewhere = [];
  $('between').classList.add('hidden'); document.body.classList.remove('between', 'waiting');
  G.between = null;
  loadHole(G.holeIdx + 1);
}
$('betweenHead').addEventListener('click', () => $('between').classList.toggle('open'));
$('betweenGo').addEventListener('click', () => {
  if (G.mode !== 'between' || $('betweenGo').disabled) return;
  goNextHole();
});
function nextHoleOrEnd() { afterHole(); }

// ============================================================ players affecting players
// Council round 6, §12: Knock-On (your ball moves a friend's), Be the Goose
// with Teeth (a trailing spectator's goose comes for the leader's ball) and
// the Gallery (spectators stand in the rough with umbrellas that are solid).
// All of it rides the relayed `emote` message; the receiver applies it.
const toParThru = (scores, n) => (scores ?? []).slice(0, n).reduce((s, v, i) => s + (Number.isInteger(v) ? v - HOLES[i].par : 0), 0);
const myToPar = () => toParThru(G.holeScores, myHole() - 1);
const theirToPar = r => toParThru(r.prog?.scores, myHole() - 1);

// ---- Knock-On -------------------------------------------------------------
// The knocked ball's roll: the same on every client (no wind, trait or power-up).
function knockSim(start, vx, vz) {
  const sp = Math.hypot(vx, vz); if (sp > 12) { vx *= 12 / sp; vz *= 12 / sp; }
  const s0 = { x: start.x, y: G.course.h(start.x, start.z) + R, z: start.z };
  const wmP = wmPhase();
  const sim = simulate({ course: G.course, cup: G.cup, wind: { x: 0, z: 0 }, colliders: G.colliders, strokeNo: 0, noAura: true, wmPhase: wmP }, s0, { vx, vy: 0, vz, side: 0, lift: 0, check: 0, rolling: true, club: 'putter' });
  sim.wmPhase = wmP;
  // on the green it can't be sent miles: stop it 3 m further from the cup than it started
  const sf = G.course.surf(start.x, start.z);
  if ((sf === 'green' || sf === 'fringe') && sim.result !== 'holed') {
    const d0 = Math.hypot(start.x - G.cup.x, start.z - G.cup.z);
    for (let f = 0; f < sim.n; f++) {
      const x = sim.frames[f * 3], z = sim.frames[f * 3 + 2];
      if (Math.hypot(x - G.cup.x, z - G.cup.z) > d0 + 3) { sim.n = f + 1; sim.result = 'rest'; sim.end = { x, y: sim.frames[f * 3 + 1], z, surface: G.course.surf(x, z) }; break; }
    }
  }
  return sim;
}
// shooter: my shot knocked a friend's ball (called from doShot)
function sendKnocks(sim) {
  const ks = sim.events.filter(e => e.type === 'knock' && e.speed >= 0.3).slice(0, 2);
  for (const e of ks) {
    const id = e.tag.slice(6), r = rivals.get(id), p = r && rivalPos(r);
    if (!p) continue;
    const vx = +e.vx.toFixed(2), vz = +e.vz.toFixed(2);
    sendEmote('knock', id, `${myHole()}:${r.prog?.strokes ?? 0}:${p.x.toFixed(2)}:${p.z.toFixed(2)}:${vx}:${vz}:${e.frame}`, { state: true });
    r.knock = { at: e.frame, sim: knockSim({ x: +p.x.toFixed(2), z: +p.z.toFixed(2) }, vx, vz), by: null };
  }
  if (ks.length >= 2) G.shotCannon = true;
}
function startKnockAnim(r, k) {
  r.playing = { shot: { frames: k.sim.frames, n: k.sim.n, result: k.sim.result }, t: 0, stroke: -1, pos: { x: k.sim.frames[0], y: k.sim.frames[1], z: k.sim.frames[2] }, knock: true, knockHex: k.byHex };
  r.knock = null;
}
// receiver: someone's shot hit my ball
function applyKnockQ() {
  const q = G.knockQ; if (!q) return;
  const senderBusy = q.from.playing && q.from.playing.t < q.f;
  if (senderBusy || swing.active) { if (performance.now() - q.at < 15000) return; }
  G.knockQ = null;
  if (q.strokes !== G.strokes || Math.hypot(G.ball.x - q.x, G.ball.z - q.z) > 0.05 || !['address', 'walk'].includes(G.mode)) return;   // void: things moved on
  G.walk = null;
  const sim = knockSim({ x: q.x, z: q.z }, q.vx, q.vz);
  G.shot = { sim, t: 0, kind: 'knock', ev: 0, L: { club: 'putter' }, start: { ...G.ball }, bullet: null, clubId: 'putter', landed: true, strokeNo: G.strokes + 1, ball: bag(), wasBullet: false, called: false, from: q.from, wmPhase: sim.wmPhase };
  G.mode = 'flight';
  G.flightCam = { phase: 0, t: 0.3, pos: camera.position.clone(), look: G.camLook.clone() };
  ballMesh.visible = true;
  sfx.knock?.(1);
  hud.banner(`💥 KNOCKED BY ${esc(q.from.name.toUpperCase())}`, 1500);
  say('knockedBy', { ...vars(), rival: q.from.name }, { bump: 10 });
}
function endKnock(s) {
  const end = s.sim.end, r = s.from;
  const tl = makeTrail(oldTrailMat, s.sim.n); fillTrail(tl, s.sim, s.sim.n); G.trails.push(tl);
  liveTrail.geometry.setDrawRange(0, 0);
  if (s.sim.result === 'holed') {
    // the old stymie rule: knocked in counts, at your current strokes
    G.ball = { x: G.cup.x, z: G.cup.z, y: end.y };
    hud.banner(`🎱 HOLED BY ${esc(r.name.toUpperCase())}<small>counts, no extra stroke</small>`, 2400);
    say('knockIn', { ...vars(), rival: r.name }, { bump: 18 });
    for (let k = 0; k < 4; k++) setTimeout(() => burst(G.cup.x, G.course.h(G.cup.x, G.cup.z) + 0.3, G.cup.z, 30, new THREE.Color(r.hex).getHex(), { speed: 3, up: 5, life: 1.6, grav: 5 }), k * 90);
    holeOut({ ...s, gimme: true });
    return;
  }
  if (s.sim.result === 'water' || s.sim.result === 'oob') {
    G.ball = { ...s.start }; hud.banner('💥 Put back<small>no penalty</small>', 1500);
  } else {
    G.ball = { x: end.x, z: end.z, y: end.y };
    // only the one who's behind gets the choice to put it back
    if (myToPar() > theirToPar(r)) offerPutBack(s.start);
  }
  ballMesh.visible = true;
  linger(1.2, () => afterStroke(true));
}
function offerPutBack(spot) {
  const el = $('gimme');
  el.innerHTML = `💥 Knocked. Put it back? <button id="gimmeYes">Put back (R)</button>`;
  el.classList.remove('hidden');
  const strokes = G.strokes;
  const take = () => {
    el.classList.add('hidden'); G.putBack = null;
    if (G.strokes !== strokes || !['address', 'walk', 'linger'].includes(G.mode)) return;
    G.ball = { x: spot.x, z: spot.z, y: G.course.h(spot.x, spot.z) + R };
    roomSendProgress(); if (G.mode === 'address') { aimAtPoint(G.cup.x, G.cup.z); snapAddressCam(); } updateHUD();
  };
  $('gimmeYes').onclick = take; G.putBack = take;
  clearTimeout(offerPutBack.t); offerPutBack.t = setTimeout(() => { el.classList.add('hidden'); G.putBack = null; }, 8000);
}
addEventListener('keydown', e => { if (e.code === 'KeyR' && G.putBack && e.target.tagName !== 'INPUT') G.putBack(); });

// ---- Be the Goose, with Teeth ----------------------------------------------
// Only points up: if you're level or behind, your puppet goose can go for the
// ball of the friend you're watching. Hit it first and the goose face-plants.
function canTeeth(w) {
  if (!G.room || !w || !G.possess || G.teethUsed || G.teethTargets?.has(w.id)) return false;
  const p = w.prog; if (!p || !p.rest || p.holed || w.playing || !(p.strokes > 0) || p.hole !== myHole()) return false;
  const sf = G.course.surf(p.rest.x, p.rest.z); if (sf === 'green' || sf === 'fringe') return false;
  if (myToPar() < theirToPar(w)) return false;   // you're ahead: no teeth for you
  return !!G.possessWp && Math.hypot(G.possessWp.x - p.rest.x, G.possessWp.z - p.rest.z) >= 14;
}
// (round 8, S3) sabotage reports back: the sender hears what their goose did,
// in the commentator's voice, 7 words or fewer. Sent as state so it can't be dropped.
function reportSabotage(to, outcome, metres = 0) {
  sendEmote('sabx', to, `${myHole()}:${outcome}:${Math.max(-1, Math.round(metres))}`, { state: true });
}
const SAB_LINES = {
  punt: (n, m) => m > 0 ? `🪿 Your goose punted ${n} ${m} m!` : `🪿 Your goose punted ${n}!`,
  relay: (n, m) => m > 0 ? `🏉 Your geese ran ${n}'s ball ${m} m!` : `🏉 Your geese ran off with it!`,
  brood: n => `🥚 Your goose is sitting on ${n}'s ball.`,
  pond: n => `🎣 Your goose dunked ${n}'s ball!`,
  stash: n => `🌲 Your goose stashed ${n}'s ball!`,
  bunker: n => `🏖️ Your goose bunkered ${n}!`,
  swallow: n => `🪿 Your goose ATE ${n}'s ball!`,
  won: n => `💪 ${n} won the tug. Rude.`,
  seen: n => `🪿 ${n} can see your goose.`,
  honked: n => `📢 ${n} heard that.`,
  gimme: n => `🤝 ${n} took your gimme.`,
};
function onSabotageResult(r, rest) {
  const [outcome, m] = [rest[0], +rest[1]];
  const f = SAB_LINES[outcome]; if (!f) return;
  const line = f(esc(r.name), Number.isFinite(m) ? m : -1);
  if (outcome === 'honked' || outcome === 'seen') feed(line); else { hud.toast(line); sfx.react?.('laugh'); }
}
// one line per spectator tool, the first time you use it this session
const TOOL_TIPS = { possess: 'Tap their course: your goose walks there.', honk: 'Your goose honks at them.', gimme: 'Concede their short putt.', teeth: 'Your goose goes for their ball.', stand: 'Tap the rough: your umbrella blocks balls.' };
function toolTip(act) {
  const seen = (toolTip.seen ??= new Set());
  if (!TOOL_TIPS[act] || seen.has(act)) return;
  seen.add(act); hud.hint(TOOL_TIPS[act], 3500);
}
function sendTeeth(w, trick) {
  if (!canTeeth(w)) return;
  if (sendEmote('teeth', w.id, `${myHole()}:${w.prog.strokes}:${trick}`, { state: true })) { G.teethUsed = true; feed(`🦷 Your goose is on its way to <b>${esc(w.name)}</b>`); }
}
function onTeeth(ev, r, rest) {
  const [strokes, trick] = [+rest[0], rest[1]];
  const p = puppets.get(r.id);
  const ok = strokes === G.strokes && ['address', 'walk'].includes(G.mode) && !G.teethHole && p && theirToPar(r) >= myToPar() && canSnatch({ teeth: true });
  if (!ok) { sendEmote('teethx', r.id, `${myHole()}:void`, { state: true }); return; }
  G.teethHole = true;
  p.hunt = { trick: ['brood', 'relay'].includes(trick) ? trick : 'any', strokes, t: 0, from: r.id };
  // it starts at least 14 m out
  const d = Math.hypot(p.x - G.ball.x, p.z - G.ball.z);
  if (d < 14) {
    for (let k = 0; k < 12; k++) { const a = Math.random() * 6.3, x = G.ball.x + Math.cos(a) * 15, z = G.ball.z + Math.sin(a) * 15; if (validLand(x, z)) { p.x = x; p.z = z; break; } }
    burst(p.x, G.course.h(p.x, p.z) + 0.6, p.z, 20, 0xffffff, { speed: 2, up: 2, life: 1 });
  }
  scene.remove(p.label); p.label = W.buildLabel(`🦷 ${r.name}`, '#fff', 'rgba(170,20,30,0.85)'); scene.add(p.label);
  sfx.honk(2);
  hud.hint(`🦷 ${esc(r.name)}'s goose wants your ball.`, 5000);
  say('teeth', { ...vars(), rival: r.name }, { bump: 12 });
}
function huntPuppet(id, p, dt) {
  const h = p.hunt; h.t += dt;
  const r = rivals.get(h.from);
  if (G.strokes !== h.strokes || !['address', 'walk', 'gooseFetch'].includes(G.mode) || h.t > 25) {
    // too slow: it face-plants
    p.hunt = null; p.faceplant = 0.25;
    burst(p.x, G.course.h(p.x, p.z) + 0.3, p.z, 12, 0xffffff, { speed: 1.5, up: 1.5, life: 1 }); sfx.squeak?.();
    if (G.strokes !== h.strokes && r) say('teethMiss', { ...vars(), rival: r.name }, { bump: -4 });
    sendEmote('teethx', h.from, `${myHole()}:miss`, { state: true });
    return 0;
  }
  const dx = G.ball.x - p.x, dz = G.ball.z - p.z, d = Math.hypot(dx, dz);
  if ((h.tick = (h.tick ?? 0) - dt) <= 0) { sfx.tick(); h.tick = clamp(d / 14, 0.15, 0.8); }
  if (d < 1.0 && G.mode === 'address' && !swing.active && performance.now() - (G.addressAt ?? 0) > 1500) { promotePuppet(id, p); return 0; }
  if (swing.active && d < 1.2) return 0;   // waits, pecking, while you swing
  const st = Math.min(Math.max(0, d - 0.6), 1.7 * dt);
  p.x += dx / d * st; p.z += dz / d * st; p.yaw = Math.atan2(dx, dz);
  return 1.7;
}
function promotePuppet(id, p) {
  const r = rivals.get(p.hunt.from);
  const g = { mesh: p.mesh, state: 'graze', x: p.x, z: p.z, yaw: p.yaw, target: null, t: 0, timer: 0, phase: 0, carry: false, frozen: false, home: { x: p.x, z: p.z, r: 2 }, carryT: 0, radius: 0, breed: 'puppet', puppetOf: p.hunt.from, trick: p.hunt.trick, label: p.label, fly: 0 };
  geese.splice(G.geeseN, 0, g); G.geeseN++;
  puppets.delete(id);
  startTheft(g, 0.3);
  if (r) say('teeth', { ...vars(), rival: r.name }, { bump: 14 });
  sendEmote('teethx', p.hunt.from, `${myHole()}:got`, { state: true });
}

// ---- The Gallery -------------------------------------------------------------
// Spectators stand in the rough with a giant umbrella. Their body and brolly
// are solid in everyone else's shots: a save, a robbery, or a bonk.
const fans = new Map();   // spectator id -> { x, z, at, arrived, next, brolly }
function ropeOk(x, z) {
  if (!validLand(x, z)) return false;
  const sf = G.course.surf(x, z); if (sf !== 'rough' && sf !== 'sand') return false;
  const [cx, cz, rx, rz] = G.course.green;
  if (((x - cx) / (rx + 2)) ** 2 + ((z - cz) / (rz + 2)) ** 2 < 1) return false;
  if (Math.hypot(x - G.holeDef.tee[0], z - G.holeDef.tee[1]) < 12) return false;
  return !nearestTrunk({ x, z }, 1.2);
}
function standTap(e) {
  if (!G.standMode) return false;
  const now = performance.now();
  if ([...rivals.values()].some(r => r.playing)) { feed('☂️ <small>ball in the air</small>'); return true; }
  if (now - (G.standAt ?? 0) < 3000) return true;
  const p = groundAt(e.clientX, e.clientY); if (!p) return true;
  if (!ropeOk(p.x, p.z)) { feed('☂️ Behind the ropes, please.'); return true; }
  if (sendEmote('stand', '', `${myHole()}:${p.x.toFixed(1)}:${p.z.toFixed(1)}`)) { G.standAt = now; G.myFan = { x: +p.x.toFixed(1), z: +p.z.toFixed(1) }; sfx.fwump?.(); }
  return true;
}
function buildBrolly(hex) {
  const g = new THREE.Group();
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: hex, side: THREE.DoubleSide, roughness: 0.7 }));
  canopy.position.y = 1.0; canopy.castShadow = true;
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.1, 6), new THREE.MeshStandardMaterial({ color: 0x2a2a2a }));
  stick.position.y = 0.5;
  g.add(canopy, stick); g.userData.canopy = canopy;
  return g;
}
function onStand(r, rest) {
  const x = +rest[0], z = +rest[1];
  if (!Number.isFinite(x) || !Number.isFinite(z) || !ropeOk(x, z)) return;
  const f = fans.get(r.id) ?? { x, z, at: 0, arrived: false };
  if (swing.active || G.mode === 'flight') { f.next = { x, z }; fans.set(r.id, f); return; }
  Object.assign(f, { x, z, at: performance.now(), arrived: false, next: null }); fans.set(r.id, f);
}
function galleryColliders(lie) {
  const out = [];
  const list = [...fans.entries()].filter(([, f]) => f.arrived && Math.hypot(f.x - lie.x, f.z - lie.z) >= 8).sort((a, b) => b[1].at - a[1].at).slice(0, 4);
  for (const [id, f] of list) {
    const gy = G.course.h(f.x, f.z);
    out.push({ kind: 'cyl', x: f.x, z: f.z, r: 0.28, y0: gy, y1: gy + 1.75, e: 0.3, tag: 'fan:' + id });
    out.push({ kind: 'sphere', x: f.x, y: gy + 1.95, z: f.z, r: 0.85, e: 0.25, tag: 'fan:' + id });
  }
  return out;
}
// did the umbrella help or hurt? compare with the same shot minus the fan
function fanVerdict(world, start, L, sim) {
  const hit = sim.events.find(e => (e.type === 'hit') && e.tag?.startsWith('fan:')); if (!hit) return null;
  const cf = simulate({ ...world, dynamic: world.dynamic.filter(c => !c.tag?.startsWith('fan:')) }, start, L);
  const bad = s => s.result === 'water' || s.result === 'oob';
  const dEnd = s => s.result === 'holed' ? 0 : Math.hypot(s.end.x - G.cup.x, s.end.z - G.cup.z);
  let v = 'bonk';
  if ((bad(cf) && !bad(sim)) || (!bad(sim) && dEnd(sim) <= dEnd(cf) - 5)) v = 'save';
  else if ((bad(sim) && !bad(cf)) || (!bad(cf) && dEnd(cf) <= dEnd(sim) - 5)) v = 'rob';
  return { id: hit.tag.slice(4), v };
}
function fanHit(shot, id) {
  if (shot.fanTold) return; shot.fanTold = true;
  const r = rivals.get(id), f = fans.get(id), v = shot.fan?.v ?? 'bonk';
  sfx.oof?.();
  if (f) f.flip = 0.6;
  if (r) {
    hud.banner(`☂️ OFF ${esc(r.name.toUpperCase())}'S BROLLY${v === 'save' ? '<small>saved from trouble</small>' : v === 'rob' ? '<small>robbed!</small>' : ''}`, 1600);
    say(v === 'save' ? 'fanSave' : v === 'rob' ? 'fanRob' : 'fanBonk', { ...vars(), rival: r.name }, { bump: v === 'rob' ? 8 : 2 });
    sendEmote('fanhit', id, `${myHole()}:${v}`, { state: true });
  }
}
function updateFans(dt) {
  for (const [id, f] of fans) {
    const r = rivals.get(id);
    if (!r || !G.room || (r.prog?.hole ?? 0) > myHole() || performance.now() - f.at > 90000) { dropFan(id); continue; }
    if (f.next && !swing.active && G.mode !== 'flight') { Object.assign(f, f.next, { at: performance.now(), arrived: false }); f.next = null; }
  }
}
function dropFan(id) { const r = rivals.get(id), f = fans.get(id); if (r?.avatar && f?.brolly) r.avatar.remove(f.brolly); fans.delete(id); }
// draw a fan: their golfer jogs to the spot and holds a big umbrella
function updateFanAvatar(r, dt) {
  const f = fans.get(r.id); if (!f) return false;
  const a = rivalAvatar(r);
  if (!f.brolly) { f.brolly = buildBrolly(new THREE.Color(r.hex).getHex()); f.brolly.position.set(0.2, 1.0, 0.1); a.add(f.brolly); }
  a.visible = true;
  r.avatarAt ??= { x: f.x, z: f.z };
  if (Math.hypot(f.x - r.avatarAt.x, f.z - r.avatarAt.z) > 40) { r.avatarAt = { x: f.x, z: f.z }; burst(f.x, G.course.h(f.x, f.z) + 1, f.z, 16, 0xffffff, { speed: 1.5, up: 1.5, life: 0.8 }); }   // from across the course: pop in
  const dx = f.x - r.avatarAt.x, dz = f.z - r.avatarAt.z, d = Math.hypot(dx, dz), wt = performance.now() / 1000;
  if (d > 0.2) {
    const st = Math.min(d, 12 * dt); r.avatarAt.x += dx / d * st; r.avatarAt.z += dz / d * st;
    a.position.set(r.avatarAt.x, G.course.h(r.avatarAt.x, r.avatarAt.z), r.avatarAt.z); a.rotation.set(0, Math.atan2(dx, dz), 0);
    animateGolfer(a, wt, { mode: 'run', speed: 10 });
  } else {
    f.arrived = true;
    a.position.set(f.x, G.course.h(f.x, f.z), f.z);
    a.rotation.set(f.flip > 0 ? -0.4 : 0, Math.atan2(G.ball.x - f.x, G.ball.z - f.z), 0);
    animateGolfer(a, wt, { mode: 'idle' });
  }
  f.flip = Math.max(0, (f.flip ?? 0) - dt);
  f.brolly.userData.canopy.scale.y = f.flip > 0 ? -1 : 1;   // blown inside out
  const near = Math.hypot(f.x - G.ball.x, f.z - G.ball.z) < 8;
  f.brolly.userData.canopy.material.transparent = near; f.brolly.userData.canopy.material.opacity = near ? 0.4 : 1;
  return true;
}

// ============================================================ golfers (player characters)
// Pick one of five on the title card. You see yourself in third person when
// you run to the ball and after a swing; at address the view is first person.
// In a room, friends' golfers stand at their balls and jog between lies.
let avatar = null;
const charId = () => { const c = store.get('ghg3d_char'); return GOLFERS.some(g => g.id === c) ? c : 'pro'; };
const tintHex = color => new THREE.Color(ROOM_COLORS[color % ROOM_COLORS.length]).getHex();
function makeAvatar() {
  if (avatar) scene.remove(avatar);
  avatar = buildGolfer(charId(), G.room ? tintHex(G.room.myColor ?? 0) : undefined);
  avatar.visible = false; scene.add(avatar);
}
function renderCharPick() {
  const cur = charId();
  $('charPick').innerHTML = GOLFERS.map(g => `<button type="button" class="cp${g.id === cur ? ' on' : ''}" data-id="${g.id}" title="${esc(g.blurb)}">${portraits[g.id] ? `<img alt="" src="${portraits[g.id]}">` : '<i>🏌️</i>'}<b>${esc(g.name)}</b></button>`).join('');
  $('charBlurb').textContent = GOLFERS.find(g => g.id === cur)?.blurb ?? '';
}
const portraits = {};
$('charPick').addEventListener('click', e => {
  const b = e.target.closest('.cp'); if (!b) return;
  store.set('ghg3d_char', b.dataset.id); renderCharPick(); sfx.tick?.();
});
function updateAvatar(dt) {
  if (!avatar || G.mode === 'walk') return;
  const s = G.shot, fc = G.flightCam;
  const wt = performance.now() / 1000;
  if (G.mode === 'between' && G.myFan) {
    // spectating from the rough, under your own umbrella
    avatar.visible = true;
    if (!avatar.userData.brolly) { avatar.userData.brolly = buildBrolly(new THREE.Color(ROOM_COLORS[(G.room?.myColor ?? 0) % ROOM_COLORS.length]).getHex()); avatar.userData.brolly.position.set(0.2, 1.0, 0.1); avatar.add(avatar.userData.brolly); }
    avatar.userData.brolly.visible = true;
    avatar.position.set(G.myFan.x, G.course.h(G.myFan.x, G.myFan.z), G.myFan.z);
    animateGolfer(avatar, wt, { mode: 'idle' });
    return;
  }
  if (avatar.userData.brolly) avatar.userData.brolly.visible = false;
  if (G.mode === 'address' && !G.scoped && !G.walk) {
    // at address you see yourself, beside the ball, and the swing is yours:
    // the backswing follows your drag, the downswing your flick
    avatar.visible = true;
    const d = aimDir(), gy = G.course.h(G.ball.x, G.ball.z);
    golferAddress(avatar, { x: G.ball.x, y: gy, z: G.ball.z }, { x: G.ball.x + d.x * 10, z: G.ball.z + d.z * 10 });
    const putt = G.club === 'putter', top = putt ? 0.24 : 0.42;
    let k = 0.06 + 0.02 * Math.sin(wt * 2.2);   // a little waggle while you line it up
    if (swing.active) {
      if (swing.phase === 'back') k = 0.1 + (top - 0.1) * Math.min(1, swing.back);
      else if (swing.phase === 'down') k = top + (GOLFER_IMPACT - top) * clamp(swing.fwd / Math.max(swing.peak, 0.01), 0, 1);
      else k = 0.1 + (top - 0.1) * Math.min(1, swing.back);   // key swing: holding at the top
    }
    animateGolfer(avatar, wt, { mode: 'swing', k });
    return;
  }
  if (s && fc && s.kind === 'player') {
    // after the swing: follow through, then react to where it's going
    avatar.visible = true;
    const st = { x: s.start.x, y: G.course.h(s.start.x, s.start.z), z: s.start.z };
    const d = fwd(G.yaw);
    golferAddress(avatar, st, { x: st.x + d.x * 10, z: st.z + d.z * 10 });
    const k = GOLFER_IMPACT + (1 - GOLFER_IMPACT) * clamp(fc.t / 0.7, 0, 1);
    const res = s.sim.result;
    const mood = !s.landed || fc.t < 1.3 ? null : res === 'holed' || Math.hypot(s.sim.end.x - G.cup.x, s.sim.end.z - G.cup.z) < 3 ? 'cheer' : res === 'water' || res === 'oob' ? 'sulk' : null;
    animateGolfer(avatar, wt, mood ? { mode: mood } : { mode: 'swing', k });
    return;
  }
  avatar.visible = false;
}
// friends' golfers
function rivalAvatar(r) {
  const want = r.prog?.char && GOLFERS.some(g => g.id === r.prog.char) ? r.prog.char : 'pro';
  if (!r.avatar || r.avatarId !== want) {
    if (r.avatar) scene.remove(r.avatar);
    r.avatar = buildGolfer(want, tintHex(r.color ?? 0)); r.avatarId = want; r.avatar.visible = false; r.avatarAt = null;
    scene.add(r.avatar);
  }
  return r.avatar;
}
// (round 8, S12) while you address or swing, friends' golfers near your ball
// fade to translucent ghosts; their balls stay solid and fully visible
function ghostGolfer(a, on) {
  if ((a.userData.ghosted ?? false) === on) return;
  a.userData.ghosted = on;
  a.traverse(o => {
    if (!o.material) return;
    if (!o.userData.ownMat) { o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone(); o.userData.ownMat = true; }
    for (const m of [o.material].flat()) { m.userData.op0 ??= m.opacity; m.userData.tr0 ??= m.transparent; m.transparent = on || m.userData.tr0; m.opacity = on ? 0.28 * m.userData.op0 : m.userData.op0; m.depthWrite = !on; m.needsUpdate = true; }
  });
}
function updateRivalAvatar(r, p, dt) {
  if (updateFanAvatar(r, dt)) return;
  const a = rivalAvatar(r);
  if (!p) { a.visible = false; return; }
  a.visible = true;
  ghostGolfer(a, (G.mode === 'address' || swing.active) && !G.shot && !!r.avatarAt && Math.hypot(r.avatarAt.x - G.ball.x, r.avatarAt.z - G.ball.z) < 6);
  const ball = r.playing ? { x: r.playing.shot.frames[0], z: r.playing.shot.frames[2] } : p;
  const toCup = Math.atan2(G.cup.x - ball.x, G.cup.z - ball.z);
  const want = { x: ball.x - Math.sin(toCup) * 0.9 + Math.cos(toCup) * 0.5, z: ball.z - Math.cos(toCup) * 0.9 - Math.sin(toCup) * 0.5 };
  r.avatarAt ??= { ...want };
  const dx = want.x - r.avatarAt.x, dz = want.z - r.avatarAt.z, d = Math.hypot(dx, dz);
  const wt = performance.now() / 1000;
  if (d > 0.4 && !r.playing) {
    // jog to the new lie
    const step = Math.min(d, (d > 60 ? 30 : 12) * dt);
    r.avatarAt.x += dx / d * step; r.avatarAt.z += dz / d * step;
    a.position.set(r.avatarAt.x, G.course.h(r.avatarAt.x, r.avatarAt.z), r.avatarAt.z);
    a.rotation.set(0, Math.atan2(dx, dz), 0);
    animateGolfer(a, wt, { mode: 'run', speed: 10 });
  } else {
    if (d > 3) r.avatarAt = { ...want };
    golferAddress(a, { x: ball.x, y: G.course.h(ball.x, ball.z), z: ball.z }, G.cup);
    const k = r.playing ? GOLFER_IMPACT + (1 - GOLFER_IMPACT) * clamp(r.playing.t / FPS / 0.7, 0, 1) : null;
    animateGolfer(a, wt, k === null ? { mode: 'idle' } : { mode: 'swing', k });
  }
}

// ------------------------------------------------------------ the Honk Hole (the finale boss)
function buildAura(course, ba) {
  const g = new THREE.Group();
  const [ax, az] = ba.at;
  // a polar grid draped over the terrain: the ring edge and a turning spiral
  const drape = (r0, r1, rings, segs, mat) => {
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= rings; i++) for (let j = 0; j <= segs; j++) {
      const r = r0 + (r1 - r0) * i / rings, a = j / segs * Math.PI * 2, x = ax + Math.cos(a) * r, z = az + Math.sin(a) * r;
      pos.push(x, course.h(x, z) + 0.07, z); uv.push(0.5 + Math.cos(a) * r / (2 * ba.r), 0.5 + Math.sin(a) * r / (2 * ba.r));
    }
    for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) { const a = i * (segs + 1) + j, b = a + segs + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    const m = new THREE.Mesh(geo, mat); m.renderOrder = 2; return m;
  };
  const ring = drape(ba.r - 0.5, ba.r, 1, 96, new THREE.MeshBasicMaterial({ color: 0xb07cff, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }));
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'); x.translate(128, 128); x.strokeStyle = 'rgba(200,160,255,1)'; x.lineWidth = 10;
  for (let arm = 0; arm < 4; arm++) { x.beginPath(); for (let t = 0; t < 1; t += 0.01) { const a = arm * Math.PI / 2 + t * 5, r = t * 124; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.stroke(); }
  const tex = new THREE.CanvasTexture(c); tex.center.set(0.5, 0.5);
  const disc = drape(0.4, ba.r - 0.5, 10, 64, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide, color: 0xb07cff }));
  g.add(ring, disc);
  // feathers drifting inward on the swirl
  const feathers = [];
  const fmat = new THREE.SpriteMaterial({ map: W.glowTexture(), color: 0xf2e8ff, transparent: true, opacity: 0.8, depthWrite: false });
  for (let i = 0; i < 24; i++) { const s = new THREE.Sprite(fmat); s.scale.setScalar(0.35); g.add(s); feathers.push({ s, r: 3 + Math.random() * (ba.r - 3), a: Math.random() * 6.3, y: 0.4 + Math.random() * 2.5 }); }
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.35, 14, 10), new THREE.MeshStandardMaterial({ color: 0xd8dce8, emissive: 0x6a6f80, roughness: 1 }));
  g.add(moon);
  g.userData = { ba, tex, feathers, moon, disc, ring };
  return g;
}
function updateAura(dt) {
  const A = G.aura; if (!A) return;
  const { ba, tex, feathers, moon, disc, ring } = A.userData;
  // the finale's Honk Hole grows from the third stroke: it spins faster and glows harder
  const ak = auraGrowth(ba, G.strokes + 1);
  tex.rotation += 0.5 * ak * dt;
  disc.material.opacity = 0.14 * ak; ring.material.opacity = Math.min(0.75, 0.35 * ak);
  if (ak > 1 && !G.auraGrowTold && G.mode === 'address' && !auraOff()) { G.auraGrowTold = true; hud.toast('🌀 The Honk Hole grows.'); say('bossAngry', vars(), { bump: 8 }); }
  for (const f of feathers) {
    f.r -= 0.5 * ak * dt; if (f.r < 1.2) { f.r = ba.r - 0.5; f.y = 0.4 + Math.random() * 2.5; }
    f.a += (5 / Math.sqrt(f.r)) / f.r * dt;
    const x = ba.at[0] + Math.cos(f.a) * f.r, z = ba.at[1] + Math.sin(f.a) * f.r;
    f.s.position.set(x, G.course.h(x, z) + f.y, z);
  }
  const boss = liveGeese().find(g => g.boss);
  if (boss) { const t = performance.now() / 1000 * Math.PI * 2 / 3, y = G.course.h(boss.x, boss.z) + 2.4; moon.position.set(boss.x + Math.cos(t) * 1.6, y, boss.z + Math.sin(t) * 1.6); }
}
// the aura only works while the boss sits on its throne
function auraOff() {
  const ba = G.holeDef.bossAura; if (!ba) return true;
  const boss = liveGeese().find(g => g.boss);
  return !boss || Math.hypot(boss.x - ba.at[0], boss.z - ba.at[1]) > 3;
}

// ============================================================ the Sasquack
// (council round 6, §11.2) A 3 m goose-yeti lives in the trees. Leave your
// ball near a trunk and it drops out of the canopy, roars, takes your ball,
// pulls a whole pine tree from behind its back, tees up on a mushroom and
// chips you out (about 10 m back, toward the fairway). No stroke. No say.
const sasq = buildMonsterGoose(); sasq.visible = false; scene.add(sasq);
const sasqEyes = new THREE.Group();
for (const sx of [-0.25, 0.25]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe14a })); e.position.x = sx; sasqEyes.add(e); }
sasqEyes.visible = false; scene.add(sasqEyes);
function sasquackReady() { return (G.sasqRound ?? 0) < 3 && !G.sasqHole && G.holeDef.spotlight !== 'scare'; }
function nearestTrunk(p, within) {
  let best = null;
  for (const c of G.colliders?.list ?? []) {
    if (c.tag !== 'tree' || c.kind !== 'cyl') continue;
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    if (d <= within && (!best || d < best.d)) best = { c, d };
  }
  return best?.c ?? null;
}
function maybeSasquack() {
  if (!sasquackReady() || G.powerUp?.noTrees || disruptionSpent()) return false;
  const s = G.course.surf(G.ball.x, G.ball.z);
  if (s === 'green' || s === 'fringe') return false;
  // generous on purpose (playtest: "I can't set it off"): resting among the trunks, or
  // anywhere off the fairway after the ball touched a tree, wakes it
  let tree = s !== 'fairway' && s !== 'tee' ? nearestTrunk(G.ball, 4.5) : null;
  if (!tree && G.treeHitAt && s !== 'fairway' && s !== 'tee') { const t = nearestTrunk(G.treeHitAt, 7); if (t && Math.hypot(t.x - G.ball.x, t.z - G.ball.z) <= 12) tree = t; }
  if (!tree) return false;
  startSasquack(tree);
  return true;
}
// the punch-out, planned at the start (the trees let it through)
function planSasquack() {
  const lieD = dist2(G.ball, G.cup), tr = traitOf(bag());
  // aim at the nearest point on the hole's centre line
  let aim = null;
  for (let t = 0; t <= 1; t += 0.02) { const p = pathPoint(G.holeDef.path, t), d = Math.hypot(p.x - G.ball.x, p.z - G.ball.z); if (!aim || d < aim.d) aim = { x: p.x, z: p.z, d }; }
  const base = Math.atan2(aim.x - G.ball.x, aim.z - G.ball.z);
  const world = { course: G.course, cup: G.cup, wind: G.wind, trait: tr, colliders: G.colliders, noTrees: true, strokeNo: G.strokes + 1, noAura: true };
  let best = null;
  for (const off of [0, -0.3, 0.3, -0.6, 0.6, -1.0, 1.0, -1.5, 1.5, 2.2, -2.2]) for (const club of ['wedge', 'iron']) for (const pw of [0.4, 0.55, 0.7, 0.85]) {
    const yaw = base + off, d = { x: Math.sin(yaw), z: Math.cos(yaw) };
    const L = launch(club, pw, d.x, d.z, 0, 1, tr), sim = simulate(world, G.ball, L);
    if (sim.result !== 'rest') continue;
    const sf = sim.end.surface, endD = Math.hypot(sim.end.x - G.cup.x, sim.end.z - G.cup.z);
    if (endD < lieD - 0.01 || !validLand(sim.end.x, sim.end.z)) continue;
    // best: fairway, about 10 m back; anything playable and not nearer the pin will do
    const tidy = (sf === 'fairway' || sf === 'rough') && endD <= lieD + 25;
    const score = (tidy ? 0 : 100) + (sf === 'fairway' ? 0 : 12) + Math.abs(endD - (lieD + 10));
    if (!best || score < best.score) best = { score, sim, L };
  }
  return best;
}
function startSasquack(tree, { fromTheft = false } = {}) {
  G.sasqHole = true; G.sasqRound = (G.sasqRound ?? 0) + 1;
  if (!fromTheft) spendDisruption();
  if (swing.active) cancelSwing();
  G.mode = 'sasquack';
  const top = tree.y1 ?? G.course.h(tree.x, tree.z) + 5;
  const ux = G.ball.x - tree.x, uz = G.ball.z - tree.z, L = Math.hypot(ux, uz) || 1;
  const camAt = new THREE.Vector3(tree.x + ux / L * 10, G.course.h(tree.x, tree.z) + 2.2, tree.z + uz / L * 10);
  camAt.y = Math.max(camAt.y, G.course.h(camAt.x, camAt.z) + 1.6);
  const shot = sasqShot(tree, ux / L, uz / L, L, camAt);
  G.sasq = { t: 0, tree, top, ux: ux / L, uz: uz / L, camAt, ...shot, plan: planSasquack(), fired: {}, pine: null, mushroom: null, fromTheft };
  $('bulletLbl').textContent = '🦶 SASQUACK CAM';
  $('letterbox').classList.add('show'); document.body.classList.add('bullet');
  setAmbience(0.4); sfx.growl?.();
  sendEmote('sasquack', '', String(G.holeIdx + 1));
  hud.hint('');
}
// Where it lands and where the camera stands for the reveal. It lands just past
// your ball and clear of its own canopy (no leaves over its face), and the hero
// camera is a low three-quarter angle chosen so no other tree is in the way;
// any that still would be are hidden until the Sasquack is gone.
function sasqShot(tree, ux, uz, L, camAt) {
  const all = G.treeMesh?.userData.trees ?? [];
  let own = null; for (const t of all) { const d = Math.hypot(t.x - tree.x, t.z - tree.z); if (!own || d < own.d) own = { t, d }; }
  own = own?.t ?? null;
  const clear = (own?.canopyR ?? 2.8) + 0.9;
  const sd = Math.max(L + 1.0, clear);
  const stand = { x: tree.x + ux * sd, z: tree.z + uz * sd };
  const gy = G.course.h(stand.x, stand.z);
  const segD = (t, a, b) => {   // tree trunk to the a->b segment, on the ground plane
    const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
    const k = clamp(((t.x - a.x) * dx + (t.z - a.z) * dz) / l2, 0, 1);
    return Math.hypot(a.x + dx * k - t.x, a.z + dz * k - t.z);
  };
  const blocks = (t, a, b) => t !== own && segD(t, a, b) < t.canopyR * 0.95 + 0.5;
  let hero = null;
  for (const off of [0.75, -0.75, 1.05, -1.05, 0.4, -0.4, 1.4, -1.4]) {
    const a = Math.atan2(ux, uz) + off, D = 6.2;
    const p = { x: stand.x + Math.sin(a) * D, z: stand.z + Math.cos(a) * D };
    const h = G.course.h(p.x, p.z);
    let score = all.filter(t => blocks(t, p, stand)).length * 10 + Math.abs(off - 0.75) * 0.5;
    if (G.course.surf(p.x, p.z) === 'water') score += 40;
    if (h > gy + 1.5) score += 20;   // inside a hill
    if (!hero || score < hero.score) hero = { score, a, p };
  }
  const heroAt = new THREE.Vector3(hero.p.x, 0, hero.p.z);
  heroAt.y = Math.max(gy + 0.75, G.course.h(heroAt.x, heroAt.z) + 0.6);
  const hidden = t => blocks(t, camAt, stand) || blocks(t, hero.p, stand) || blocks(t, camAt, tree) || segD(t, hero.p, hero.p) < t.canopyR + 0.6;
  G.treeMesh?.userData.hide?.(hidden);
  return { stand, heroAt, heroA: hero.a };
}
// the beats, in seconds: the camera holds on it a good while before it swings
const SQ = { drop: 1.5, land: 1.85, roarEnd: 3.4, grabEnd: 3.8, pine: 3.8, tee: 4.0, throw: 5.4, swing: 5.5 };
function sasqOnce(key, fn) { if (!G.sasq.fired[key]) { G.sasq.fired[key] = true; fn(); } }
function updateSasquack(dt) {
  const S = G.sasq; if (!S) return;
  S.t += dt;
  const t = S.t, tr = S.tree, gy = G.course.h(tr.x, tr.z), wt = performance.now() / 1000;
  if (t > SQ.swing + 6) { endSasquack(); linger(0.8, () => afterStroke(true)); return; }   // never stuck here
  const canopy = new THREE.Vector3(tr.x, S.top - 1.5, tr.z);
  const stand = S.stand, sgy = G.course.h(stand.x, stand.z);
  const chest = new THREE.Vector3(stand.x, sgy + 1.7, stand.z);
  let camWant = S.camAt, lookAt = canopy, rate = 3;
  if (t >= SQ.land) {
    // the hero shot: a low swoop in, then a slow push and drift round it while it roars
    const k = smooth(clamp((t - SQ.land) / (SQ.roarEnd - SQ.land), 0, 1));
    const a = S.heroA + k * 0.22, D = lerp(7.2, 5.0, k);
    camWant = new THREE.Vector3(stand.x + Math.sin(a) * D, Math.max(S.heroAt.y, sgy + lerp(0.55, 0.9, k)), stand.z + Math.cos(a) * D);
    lookAt = chest.clone().setY(sgy + lerp(2.0, 1.6, k)); rate = t < SQ.land + 0.5 ? 4 : 2.5;
    if (t >= SQ.roarEnd) {
      // ease back out so you see it tee your ball up and swing
      const k2 = smooth(clamp((t - SQ.roarEnd) / 0.8, 0, 1)), a2 = S.heroA + 0.22;
      camWant = new THREE.Vector3(stand.x + Math.sin(a2) * lerp(5.0, 7.5, k2), sgy + lerp(0.9, 1.8, k2), stand.z + Math.cos(a2) * lerp(5.0, 7.5, k2));
      lookAt = new THREE.Vector3((stand.x + G.ball.x) / 2, sgy + 1.2, (stand.z + G.ball.z) / 2);
    }
  } else if (t >= SQ.drop) lookAt = new THREE.Vector3(stand.x, S.top - 2, stand.z);
  camera.position.lerp(camWant, 1 - Math.exp(-dt * rate));
  G.camLook.lerp(lookAt, 1 - Math.exp(-dt * 4)); camera.lookAt(G.camLook);
  for (const k of [0, 0.3, 0.6]) if (t >= k) sasqOnce('leaf' + k, () => { burst(canopy.x, canopy.y, canopy.z, 30, 0x4e8a30, { speed: 2, up: 1, life: 1.4, grav: 1.5 }); sfx.leaves(); });
  if (t >= 0.9 && t < 1.5) {
    sasqEyes.visible = !(t > 1.2 && t < 1.28);   // a blink
    sasqEyes.position.set(canopy.x + S.ux * 1.6, canopy.y + 0.3, canopy.z + S.uz * 1.6);
    sasqEyes.lookAt(camera.position);
    sasqOnce('eyes', () => { sfx.tick(); setTimeout(() => sfx.tick(), 150); });
  } else sasqEyes.visible = false;
  if (t >= 1.5) {
    sasqOnce('drop', () => {
      sasq.visible = true; sasq.scale.setScalar(1);
      const gentle = reduceMotion;
      if (!gentle) { G.shake = 0.45; G.fovKick = 6; }
      sfx.roar?.(gentle);
      burst(stand.x, G.course.h(stand.x, stand.z) + 0.2, stand.z, 40, 0xcbb89a, { speed: 3, up: 2, life: 1.2 });
      hud.banner('🦶 THE SASQUACK<small>it lives in the trees</small>', 2200);
      say('sasquack', vars(), { bump: 25 });
    });
    const fall = clamp((t - SQ.drop) / (SQ.land - SQ.drop), 0, 1);
    const y = G.course.h(stand.x, stand.z) + (1 - fall * fall) * (S.top - 3 - G.course.h(stand.x, stand.z));
    sasq.position.set(stand.x, y, stand.z);
    { // it faces the hero camera
      const fy = Math.atan2(S.heroAt.x - stand.x, S.heroAt.z - stand.z);
      sasq.rotation.y = t < SQ.roarEnd ? fy : Math.atan2(G.ball.x - stand.x, G.ball.z - stand.z) * 0.5 + fy * 0.5;
    }
    let state = { mode: 'idle' };
    if (t < SQ.land) state = { mode: 'idle' };
    else if (t < SQ.roarEnd) state = { mode: 'roar' };
    else if (t < SQ.grabEnd) state = { mode: 'grab', k: clamp((t - SQ.roarEnd) / 0.4, 0, 1) };
    else if (t < SQ.throw) state = { mode: 'idle' };
    else if (t < SQ.throw + 0.35) state = { mode: 'throw', k: clamp((t - SQ.throw) / 0.35, 0, 1) * MONSTER_THROW_RELEASE * 1.4 };
    else state = { mode: 'dance' };
    animateMonsterGoose(sasq, wt, state);
    if (t >= SQ.land + 0.9) sasqOnce('roar2', () => { sfx.roar?.(reduceMotion); if (!reduceMotion) G.shake = Math.max(G.shake, 0.3); });   // a second, bigger roar for the close-up
    if (t >= SQ.roarEnd + 0.4 * MONSTER_GRAB_PICK) sasqOnce('grab', () => { ballMesh.visible = false; const b = W.buildBall(0xffffff); b.add(ballEyes.clone()); sasq.userData.carry.add(b); });
    if (t >= SQ.pine) sasqOnce('pine', () => {
      // a whole pine tree, from behind its back
      const pine = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 3, 7), new THREE.MeshStandardMaterial({ color: 0x5a3d26 })); trunk.position.y = -1.2;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.4, 8), new THREE.MeshStandardMaterial({ color: 0x2f5a2a, flatShading: true })); cone.position.y = 1.2;
      pine.add(trunk, cone); pine.rotation.z = Math.PI;   // held by the top, roots-down swing end
      sasq.userData.handL.add(pine); S.pine = pine;
      sfx.tugPull?.(1); setTimeout(() => sfx.tick(), 200);
    });
    if (t >= SQ.tee) sasqOnce('tee', () => {
      sasq.userData.carry.clear(); ballMesh.visible = true;
      const m = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.18, 8), new THREE.MeshStandardMaterial({ color: 0xf2ead8 })); stem.position.y = 0.09;
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd8402e })); cap.position.y = 0.17;
      m.add(stem, cap); m.position.set(G.ball.x, G.course.h(G.ball.x, G.ball.z), G.ball.z); G.holeGroup.add(m); S.mushroom = m;
      ballMesh.position.y += 0.22;
    });
    if (S.pine && t < SQ.throw) S.pine.rotation.x = Math.sin(t * 6) * 0.3;   // waggle
    if (t >= SQ.swing) sasqOnce('swing', () => {
      sfx.swat?.();
      if (!S.plan) {
        hud.banner('🦶 IT LEFT IT.', 1400);
        endSasquack(); linger(1.4, () => afterStroke(true));
        return;
      }
      hud.banner('🦶 FOOOORE!', 1200); sfx.honk(3);
      if (S.mushroom) G.holeGroup.remove(S.mushroom);
      const start = { ...G.ball };
      G.shot = { sim: S.plan.sim, t: 0, kind: 'sasquack', ev: 0, L: S.plan.L, start, bullet: null, clubId: 'wedge', landed: false, strokeNo: G.strokes + 1, ball: bag(), wasBullet: false, called: false };
      G.mode = 'flight';
      G.flightCam = { phase: 0, t: 0.3, pos: camera.position.clone(), look: G.camLook.clone() };
      // it plants the pine roots-up as a souvenir and climbs back into its tree
      const souvenir = S.pine; if (souvenir) { sasq.userData.handL.remove(souvenir); souvenir.position.set(tr.x + S.ux * 2, gy + 1.2, tr.z + S.uz * 2); souvenir.rotation.set(Math.PI, 0, 0.1); G.holeGroup.add(souvenir); }
      endSasquack(true);
    });
  }
}
function endSasquack(climbing = false) {
  G.treeMesh?.userData.hide?.(null);   // the trees it hid come back
  $('letterbox').classList.remove('show'); document.body.classList.remove('bullet');
  setAmbience(1);
  if (G.sasq?.mushroom && G.sasq.mushroom.parent) G.sasq.mushroom.parent.remove(G.sasq.mushroom);
  const S = G.sasq; G.sasq = null;
  if (climbing && S) { burst(S.tree.x, S.top - 1.5, S.tree.z, 30, 0x4e8a30, { speed: 2, up: 1, life: 1.4, grav: 1.5 }); setTimeout(() => { sasq.visible = false; }, 600); }
  else sasq.visible = false;
}
function skipSasquack() { if (G.sasq && G.sasq.t > SQ.drop && G.sasq.t < SQ.throw) G.sasq.t = SQ.throw; }
// a goose flies your ball up a tree... where something lives
function gooseStash(g) {
  const tree = nearTree(g);
  say('tugStash', vars(), { bump: 14 });
  hud.banner('🌲 STASHED<small>something lives up there</small>', GOOSE_BEAT_MS);
  g.state = 'fly'; g.carry = true; g.stash = tree;
  const held = W.buildBall(0xffffff); held.add(ballEyes.clone()); g.mesh.userData.carry.add(held);
  g.target = { x: tree.x, z: tree.z }; g.flyT = 0;
  G.mode = 'gooseCam'; $('bulletLbl').textContent = '🌲 STASH';
  sfx.honk(2);
}

// ============================================================ hole extras
// The windmill and turnstile, crazy golf, the bowling pins, and the graveyard.
function setupHoleExtras(h, group) {
  G.windmill = null; G.aura = null; G.auraTold = false; G.auraTip = false; G.auraGrowTold = false; G.crown = null;
  if (h.bossAura) { G.aura = buildAura(G.course, h.bossAura); group.add(G.aura); }
  if (h.windmill) {
    const flat = h.windmill.axis === 'y';
    const m = flat ? W.buildTurnstile(G.course, h.windmill) : W.buildWindmill(G.course, h.windmill);
    group.add(m);
    G.windmill = { def: h.windmill, rotor: m.userData.rotor, angle: windmillAngle(h.windmill, 1, 0), creakT: 0, flat };
    setRotor(G.windmill);
  }
  if (h.mini) group.add(W.buildCrazyGolf(G.course, h));
  rackPins(h);
  if (h.tombs) {
    // a few engraved stones, cloned (shared geometry and textures) across the plot
    const dead = graveyard().slice(-5).map(d => d.name);
    const names = [...dead, 'HERE LIES PAR', 'GERALD (AGAIN)', 'A GOOD LIE', 'FORE', 'MULLIGAN'].slice(0, 6);
    const variants = names.map(n => W.buildTombstone([{ text: n, font: 'bold 30px Georgia, serif' }, { text: 'R.I.P.', font: 'italic 24px Georgia, serif' }]));
    for (const t of placeTombs(G.course, h)) {
      const m = variants[t.k % variants.length].clone();
      m.position.set(t.x, t.y - 0.03, t.z);
      m.rotation.set(0, t.rot + Math.atan2(h.tee[0] - t.x, h.tee[1] - t.z), t.lean);
      m.scale.setScalar(1.25);
      group.add(m);
    }
  }
}
// The windmill never stops. Each shot starts from the blades' phase at that
// instant (sent with the shot in a room), so the physics and the mesh agree.
function wmPhase() { const wm = G.windmill; return wm ? ((wm.angle % TAU) + TAU) % TAU : undefined; }
const TAU = Math.PI * 2;
function updateWindmill(dt) {
  const wm = G.windmill; if (!wm) return;
  const w = TAU / wm.def.period;
  let a = null;
  if (G.shot && G.shot.wmPhase !== undefined) a = G.shot.wmPhase + w * G.shot.t / FPS;
  else {
    const rp = [...rivals.values()].find(r => r.playing && r.playing.stroke > 0 && r.playing.wm !== undefined);
    if (rp) a = rp.playing.wm + w * rp.playing.t / FPS;
  }
  if (a === null) a = wm.angle + w * dt;
  // a friend's shot can start at another phase: swing the blades there quickly, not in one jump
  const d = Math.atan2(Math.sin(a - wm.angle - w * dt), Math.cos(a - wm.angle - w * dt));
  wm.angle = Math.abs(d) > 0.02 ? wm.angle + w * dt + d * (1 - Math.exp(-dt * 10)) : a;
  setRotor(wm);
}
// the windmill turns in its face plane; crazy golf's turnstile lies flat (physics: +angle runs +x toward +z)
function setRotor(wm) { if (wm.flat) wm.rotor.rotation.y = -wm.angle; else wm.rotor.rotation.z = wm.angle; }

// ============================================================ the Bowling Green
// Ten geese racked like pins where a pure drive stops. Each is a plough
// sphere in your shot (a heavy ball through light pins: it keeps going); the
// topple and the cascade are cosmetic. Everyone has their own rack.
const PINS = { list: [], def: null, before: 0 };
function rackPins(h) {
  for (const p of PINS.list) scene.remove(p.mesh);
  PINS.list = []; PINS.def = h.bowling ?? null; PINS.before = 0; PINS.done = false; PINS.pending = 0; PINS.check = false;
  const b = h.bowling; if (!b) return;
  let k = 0;
  for (let r = 0; r < b.rows; r++) for (let i = 0; i <= r; i++, k++) {
    const x = b.at[0] + (i - r / 2) * b.gap, z = b.at[1] - r * b.row, y = G.course.h(x, z);
    const mesh = buildGooseBreed(k === b.kingpin ? 'toulouse' : 'embden');
    mesh.position.set(x, y, z); mesh.rotation.order = 'YXZ'; mesh.rotation.y = (Math.random() - 0.5) * 0.3;   // facing the tee, give or take
    scene.add(mesh);
    PINS.list.push({ k, x, z, y, mesh, down: false, fall: 0, yaw: 0 });
  }
}
const pinsUp = () => PINS.list.filter(p => !p.down).length;
function pinColliders() {
  return PINS.list.filter(p => !p.down).map(p => ({ kind: 'sphere', x: p.x, y: p.y + 0.42, z: p.z, r: 0.46, e: 0.35, plow: true, tag: 'pin:' + p.k }));
}
function topple(k, e, dx = 0, dz = -1) {
  const p = PINS.list[k]; if (!p || p.down) return;
  p.down = true; p.fall = 0.001; p.yaw = Math.atan2(dx, dz) + (Math.random() - 0.5) * 0.6;
  sfx.honk(1.5); sfx.feathers?.();
  burst(p.x, p.y + 0.7, p.z, 18, 0xffffff, { speed: 2.4, up: 2, life: 1.3, grav: 2 });
  // the cascade: pins beside or behind it go too, while there's energy left
  const e2 = e * 0.8;   // tuned in playtests: a centred hit at roll-out speed (~5 m/s) clears the rack
  if (e2 <= 1.8) return;
  for (const q of PINS.list) {
    if (q.down || Math.hypot(q.x - p.x, q.z - p.z) > 1.3 || q.z > p.z + 0.1) continue;
    PINS.pending++;
    setTimeout(() => { PINS.pending--; topple(q.k, e2, q.x - p.x, q.z - p.z); }, 120);
  }
}
function updatePins(dt) {
  let falling = PINS.pending > 0;
  for (const p of PINS.list) {
    if (!p.fall || p.fall >= 1) continue;
    falling = true;
    p.fall = Math.min(1, p.fall + dt / 0.25);
    p.mesh.rotation.y = p.yaw; p.mesh.rotation.x = 1.35 * p.fall * p.fall;   // the faceplant
  }
  // the verdict waits for the last pin to land (the cascade can outlast the roll)
  if (PINS.check && !falling) { PINS.check = false; bowlingVerdict(); }
}
// After a shot: strike, spare, or into the gutter.
function bowlingVerdict() {
  if (!PINS.def || PINS.done) return false;
  const up = pinsUp();
  if (up === 0 && PINS.before > 0) {
    PINS.done = true;
    const strike = PINS.before === PINS.list.length;
    hud.banner(strike ? '🎳 STRIKE!' : '🎳 SPARE', 1800);
    for (let k = 0; k < 4; k++) setTimeout(() => burst(PINS.def.at[0], G.course.h(PINS.def.at[0], PINS.def.at[1]) + 1, PINS.def.at[1] - 1.5, 40, CONFETTI[k], { speed: 4, up: 6, life: 2, grav: 5 }), k * 90);
    say('strike', vars(), { bump: strike ? -20 : -8 });
    if (strike) moment(40, `Bowled a strike with ten geese on hole ${G.holeIdx + 1}`);
    return true;
  }
  PINS.before = up;
  return false;
}
function inGutter(x, z) {
  const b = PINS.def; if (!b) return false;
  return (b.gutters ?? []).some(i => { const e = G.holeDef.bunkers[i]; return e && ((x - e[0]) / e[2]) ** 2 + ((z - e[1]) / e[3]) ** 2 < 1; });
}

// ============================================================ Old Tom, in person
// The ghost of the club pro stands at his ball. He mirrors your backswing,
// follows through as his ghost ball launches with yours, glides to his next
// lie, and gloats when he's ahead. Solo only (rooms race friends).
const tom = buildOldTom(); tom.visible = false; scene.add(tom);
// the close-up scare face rides on the camera (so the camera must be in the scene)
const scareFace = buildScareFace(); scareFace.visible = false; camera.add(scareFace); scene.add(camera);
const TOM = { follow: -1, init: false };
const _tomTmp = new THREE.Object3D();
function tomSwingNow() { TOM.follow = 0; }
function updateOldTom(dt) {
  if (G.mode === 'scare') return;
  const show = !!G.ghost && !G.room && G.ghostSource === 'oldtom' && !['title', 'end', 'flyover'].includes(G.mode) && G.holeDef?.spotlight !== 'scare';
  tom.visible = show;
  if (!show) { TOM.init = false; return; }
  const n = G.ghostSolo ? G.ghostSolo.strokeNo - 1 : G.shot?.kind === 'player' ? G.shot.strokeNo - 1 : G.strokes;
  const lie = ghostRestAfter(n);
  const wt = performance.now() / 1000;
  let state = { mode: 'idle' }, faceCam = true;
  if (lie.holed || G.ghost.strokes.length <= n) {
    // finished: waits by the cup
    const dx = camera.position.x - G.cup.x, dz = camera.position.z - G.cup.z, L = Math.hypot(dx, dz) || 1;
    _tomTmp.position.set(G.cup.x + dx / L * 1.6 - dz / L * 1.2, G.course.h(G.cup.x, G.cup.z), G.cup.z + dz / L * 1.6 + dx / L * 1.2);
    if (G.race.status === 'behind') state = { mode: 'gloat' };
  } else {
    oldTomAddress(_tomTmp, { x: lie.x, y: G.course.h(lie.x, lie.z), z: lie.z }, G.cup);
    if (dist2(lie, G.ball) < 5) {
      // sharing your tee: he waits a polite few paces back, not in your face
      const f = fwd(G.yaw);
      _tomTmp.position.set(G.ball.x + f.x * 3 + f.z * 5.5, 0, G.ball.z + f.z * 3 - f.x * 5.5);
      _tomTmp.position.y = G.course.h(_tomTmp.position.x, _tomTmp.position.z);
    }
    if (dist2(lie, G.ball) < 5) { TOM.follow = -1; /* sharing your tee: he watches from the side */ }
    else if (TOM.follow >= 0) {
      TOM.follow += dt / 0.7;
      state = { mode: 'swing', k: SWING_IMPACT + (1 - SWING_IMPACT) * Math.min(1, TOM.follow) }; faceCam = false;
      if (TOM.follow > 1.8) TOM.follow = -1;
    } else if (swing.active && G.ghost.strokes[G.strokes] && !G.ghost.strokes[G.strokes].penaltyOnly) {
      const b = swing.phase === 'back' ? swing.back : swing.peak;
      state = { mode: 'swing', k: 0.1 + 0.32 * Math.min(1, b) }; faceCam = false;
    } else if (G.race.status === 'behind' && Math.sin(wt * 0.7) > 0.6) state = { mode: 'gloat' };
  }
  if (faceCam) _tomTmp.rotation.set(0, Math.atan2(camera.position.x - _tomTmp.position.x, camera.position.z - _tomTmp.position.z), 0);
  if (!TOM.init || tom.position.distanceTo(_tomTmp.position) > 250) { tom.position.copy(_tomTmp.position); tom.rotation.copy(_tomTmp.rotation); TOM.init = true; }
  else {
    tom.position.lerp(_tomTmp.position, 1 - Math.exp(-dt * (state.mode === 'swing' ? 20 : 2.2)));
    let dy = _tomTmp.rotation.y - tom.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    tom.rotation.y += dy * (1 - Math.exp(-dt * (state.mode === 'swing' ? 20 : 4)));
  }
  animateOldTom(tom, wt, state);
}

// ============================================================ the graveyard: the scare
// Holing out on Old Tom's Plot wakes him up. Once per round, never during a
// shot, never costs a stroke. Skippable; a gentle version for reduced motion
// or "Scares off". No strobing: one cyan vignette, that's all.
const gentleScare = () => matchMedia('(prefers-reduced-motion: reduce)').matches || store.get('ghg3d_noscare') === '1';
function startScare(s) {
  G.scareDone = true;
  G.mode = 'scare';
  G.scare = { t: 0, s, gentle: gentleScare(), fired: false, laughed: false, dissolved: false, began: performance.now() };
  document.body.classList.add('scare');
  sfx.tick();
  setAmbience?.(0);
  ballMesh.visible = false;
  sendEmote('scared', '', '6', { state: true });
}
// The build: lights die, fog rolls in, a heartbeat slows, the camera creeps to
// the cup and Old Tom whispers "Fore." from somewhere. Dead silence while the
// camera slowly turns round to look behind you... and he's RIGHT THERE. Then
// darkness, and a laugh. (No strobing: one vignette, one fade to black.)
const SCARE = { whisper: 0.9, turn: 1.7, fire: 2.45, black: 3.45, laugh: 3.7, end: 4.2 };
function updateScare(dt) {
  const sc = G.scare;
  sc.t0 ??= performance.now();
  const t = sc.t = (performance.now() - sc.t0) / 1000;   // wall clock: the timing is the scare
  const cupV = new THREE.Vector3(G.cup.x, G.course.h(G.cup.x, G.cup.z), G.cup.z);
  const wt = performance.now() / 1000;
  if (!sc.dim0) { sc.dim0 = { sun: env.sun.intensity, hemi: env.hemi.intensity, far: scene.fog.far, cam: camera.position.clone() }; }
  // the dimming and the fog, over the first 1.5 s
  const dim = smooth(clamp(t / 1.5, 0, 1));
  env.sun.intensity = sc.dim0.sun * (1 - 0.75 * dim); env.hemi.intensity = sc.dim0.hemi * (1 - 0.55 * dim);
  scene.fog.far = lerp(sc.dim0.far, 70, dim);
  for (const hb of [0.25, 0.85, 1.6]) if (t >= hb) sasqOnceScare('hb' + hb, () => sfx.heartbeat());
  if (t >= SCARE.whisper) sasqOnceScare('whisper', () => { if (!tomSay('fore', { force: true })) sfx.ghostLaugh?.(); });
  if (sc.gentle) {
    // the gentle version: he rises slowly by the cup and waves
    if (t < SCARE.fire) { G.camLook.lerp(cupV, 1 - Math.exp(-dt * 3)); camera.lookAt(G.camLook); }
    if (t >= SCARE.fire) sasqOnceScare('rise', () => {
      tom.visible = true; setOldTomOpacity(tom, 1); sc.baseY = cupV.y;
      tom.position.set(cupV.x, cupV.y - 0.6, cupV.z); tom.rotation.set(0, Math.atan2(camera.position.x - cupV.x, camera.position.z - cupV.z), 0);
      sfx.scare?.(true);
    });
    if (t >= SCARE.fire) { tom.position.y = sc.baseY - (1 - smooth(clamp((t - SCARE.fire) / 1.0, 0, 1))) * 0.6; animateOldTom(tom, wt, { mode: 'gloat' }); G.camLook.lerp(cupV, 1 - Math.exp(-dt * 3)); camera.lookAt(G.camLook); }
    if (t >= SCARE.black) setOldTomOpacity(tom, 1 - clamp((t - SCARE.black) / 0.6, 0, 1));
    if (t >= SCARE.end) endScare();
    return;
  }
  if (t < SCARE.turn) {
    // creep toward the cup and drop low, as if to look in
    const k = smooth(t / SCARE.turn), d = new THREE.Vector3().subVectors(cupV, sc.dim0.cam);
    camera.position.copy(sc.dim0.cam).addScaledVector(d, 0.35 * k); camera.position.y = lerp(sc.dim0.cam.y, cupV.y + 0.9, k);
    G.camLook.lerp(cupV, 1 - Math.exp(-dt * 3)); camera.lookAt(G.camLook);
  } else if (t < SCARE.fire) {
    // ...a slow turn to look behind you
    if (!sc.turnFrom) { sc.turnFrom = G.camLook.clone(); }
    const k = smooth((t - SCARE.turn) / (SCARE.fire - SCARE.turn));
    const back = new THREE.Vector3().subVectors(camera.position, cupV).setY(0).normalize();
    const behind = camera.position.clone().addScaledVector(back, 6); behind.y = camera.position.y + 0.2;
    G.camLook.copy(sc.turnFrom).lerp(behind, k); camera.lookAt(G.camLook);
    camera.rotation.z += Math.sin(k * Math.PI) * 0.05;   // a slight lean, wrong-footed
  }
  if (t >= SCARE.fire) {
    sasqOnceScare('fire', () => {
      scareFace.visible = true; scareFace.position.set(0, -0.02, -0.75); scareFace.userData.fade.value = 1;
      G.shake = 0.6; G.fovKick = 10;
      const f = $('scareFlash'); f.classList.add('show', 'blood'); setTimeout(() => f.classList.remove('show'), 260);
      sfx.scare?.(false); sfx.roar?.(false);
    });
    // it screams and pushes closer until it fills your view
    const k = clamp((t - SCARE.fire) / (SCARE.black - SCARE.fire), 0, 1);
    scareFace.position.z = lerp(-0.75, -0.42, smooth(k));
    animateScareFace(scareFace, wt, clamp((t - SCARE.fire) / 1.0, 0, 1));
  }
  if (t >= SCARE.black) sasqOnceScare('black', () => { $('scareBlack').classList.add('show'); });
  if (t >= SCARE.laugh) sasqOnceScare('laugh', () => { scareFace.visible = false; sfx.ghostLaugh?.(); tomSay('laugh', { force: true }); });
  if (t >= SCARE.end) endScare();
}
// every beat is cosmetic: a sound or a voice that fails (an iPhone audio hiccup)
// must never stop the clock, or the scare never ends
function sasqOnceScare(key, fn) { const sc = G.scare; sc.once ??= {}; if (!sc.once[key]) { sc.once[key] = true; try { fn(); } catch (e) { console.warn('scare beat', key, e); } } }
function skipScare() {
  if (G.mode !== 'scare' || !G.scare) return;
  if (!G.scare.t0) G.scare.t0 = performance.now();
  G.scare.t0 -= Math.max(0, SCARE.end - G.scare.t) * 1000;
}
// The frame loop runs the scare first, inside a guard: if anything throws, or it
// somehow outlives its own length, it ends and play carries on to the next hole.
function runScare(dt) {
  const sc = G.scare;
  try {
    if (!sc) throw new Error('scare mode without a scare');
    if (performance.now() - sc.began > (SCARE.end + 5) * 1000) throw new Error('scare overran');
    updateScare(dt);
  } catch (e) { console.warn('scare recovered:', e); endScare(); }
}
function endScare() {
  const sc = G.scare; G.scare = null;
  const safe = fn => { try { fn(); } catch (e) { console.warn('endScare', e); } };
  safe(() => { tom.visible = false; setOldTomOpacity(tom, 1); scareFace.visible = false; });
  safe(() => { $('scareBlack').classList.remove('show'); $('scareFlash').classList.remove('show', 'blood'); });
  safe(() => { if (sc?.dim0) { env.sun.intensity = sc.dim0.sun; env.hemi.intensity = sc.dim0.hemi; scene.fog.far = sc.dim0.far; } });
  document.body.classList.remove('scare');
  G.shake = 0; G.fovKick = 0;
  safe(() => setAmbience?.(1));
  safe(() => burst(G.cup.x, G.course.h(G.cup.x, G.cup.z) + 0.3, G.cup.z, 80, 0x7ff6ff, { speed: 2, up: 3, life: 1.6, grav: 2 }));
  safe(() => { for (const g of liveGeese()) { g.state = 'flee'; g.t = 3.2; g.frozen = false; const a = Math.random() * 6.3; g.target = { x: g.x + Math.cos(a) * 30, z: g.z + Math.sin(a) * 30 }; } });
  commentator.hysteria = 100;
  if (G.mode !== 'scare') return;   // already moved on
  G.scareDone = true;
  try { holeOut(sc?.s ?? { start: { ...G.ball }, wasBullet: false, gimme: true }, true); }
  catch (e) { console.warn('holeOut after scare', e); G.mode = 'holed'; G.celebrate = 2.7; }   // the hole still ends
  if (G.mode === 'scare') { G.mode = 'holed'; G.celebrate = 2.7; }
  // the "Par, I think" gag only when it was a par; otherwise the desk line without a score
  safe(() => say(G.holeScores[G.holeIdx] === G.holeDef.par ? 'scared' : 'scaredOff', vars(), {}));
}

// ============================================================ room interactions
// Council round 6: reactions (📯👏😱😂), Be the Goose (steer a harmless
// puppet goose around a friend's hole while you spectate), gimmes, Sic 'Em
// (a wheel wedge), and the scare notice. All ride the server's rate-limited
// `emote` relay; the client mirrors its bucket so buttons grey out honestly.
const REACTS = { honk: '📯', clap: '👏', gasp: '😱', laugh: '😂' };
// (round 8, S4) quick chat: a fixed list sent as ids, never free text
const CHATS = { goose: '🪿 Respect the goose.', tom: '👻 Old Tom would never.', luck: '🍀 Lucky. Pure luck.', rip: '🕯️ Pour one out for that ball.', fore: '📣 FORE! Sorry.' };
const emoteBucket = { tokens: 5, at: 0 };
function emoteTokens() {
  const now = performance.now();
  emoteBucket.tokens = Math.min(5, emoteBucket.tokens + (now - (emoteBucket.at || now)) / 1500); emoteBucket.at = now;
  return emoteBucket.tokens;
}
function sendEmote(kind, to = '', arg = '', { state = false } = {}) {
  if (!G.room || G.room.closed || !G.room.inRound) return false;
  // game-state messages may spend the last token; chatter must leave one spare for them
  if (emoteTokens() < (state ? 1 : 2)) return false;
  emoteBucket.tokens -= 1;
  G.room.client.send({ type: 'emote', kind, to, arg: String(arg).slice(0, 64), round: G.room.round });
  return true;
}
const myHole = () => G.holeIdx + 1;
const reactMuted = () => store.get('ghg3d_mutereact') === '1';
const busy = () => swing.active || G.scoped || G.mode === 'angler' || G.mode === 'tug';
function sendReact(kind) {
  const now = performance.now();
  if (now - (G.lastReactAt ?? 0) < 2000) return;
  if (!sendEmote('react', '', `${myHole()}:${kind}`)) return;
  G.lastReactAt = now;
  feed(`<b>You</b> ${REACTS[kind]}`);
  renderEmoteButtons();
}
function sendChat(id) {
  const now = performance.now();
  if (!CHATS[id] || now - (G.lastReactAt ?? 0) < 2000) return;
  if (!sendEmote('chat', '', `${myHole()}:${id}`)) return;
  G.lastReactAt = now;
  feed(`<b>You</b>: ${esc(CHATS[id])}`);
  renderEmoteButtons();
}
// a speech bubble over a friend's ball on your hole; never when it would sit over yours
function bubble(r, text) {
  if (!r.mesh?.visible || r.prog?.hole !== myHole() || dist2(r.mesh.position, G.ball) < 4) return;
  if (r.bubble) scene.remove(r.bubble);
  r.bubble = W.buildLabel(text, '#ffffff', 'rgba(20,16,40,0.88)'); scene.add(r.bubble);
  r.bubbleUntil = performance.now() + 2800;
}
function feed(html) {
  const el = document.createElement('div'); el.innerHTML = html;
  $('emoteFeed').appendChild(el);
  setTimeout(() => el.remove(), 2600);
  while ($('emoteFeed').children.length > 4) $('emoteFeed').firstChild.remove();
}
const reactSound = { bySender: new Map(), recent: [] };
function onEmote(ev) {
  if (!G.room || ev.round !== G.room.round || !G.room.inRound) return;
  const r = rivals.get(ev.from); if (!r) return;
  r.activeAt = performance.now();
  const [hs, ...rest] = String(ev.arg ?? '').split(':');
  const hole = +hs;
  if (hole === myHole() && ev.kind === 'knock') {
    const [strokes, x, z, vx, vz, f] = rest.map(Number);
    if (![strokes, x, z, vx, vz, f].every(Number.isFinite)) return;
    if (ev.to === G.room.me) G.knockQ = { from: r, strokes, x, z, vx, vz, f, at: performance.now() };
    else { const t = rivals.get(ev.to); if (t) t.knock = { at: f, sim: knockSim({ x, z }, vx, vz), by: r, byHex: r.hex }; }
    return;
  }
  if (hole === myHole() && ev.kind === 'teeth') (G.teethTargets ??= new Set()).add(ev.to);
  if (ev.to && ev.to !== G.room.me) return;
  const dot = `<span style="color:${r.hex}">●</span> <b>${esc(r.name)}</b>`;
  if (ev.kind === 'scared') { hud.toast(`👻 Old Tom got ${esc(r.name)}.`); return; }
  if (ev.kind === 'sasquack') { hud.toast(`🦶 ${esc(r.name)} met the Sasquack.`); return; }
  if (ev.kind === 'finale') { hud.toast(`🎆 ${esc(r.name)} has finished.`); return; }
  // (round 8, S4) reactions and quick chat land from any hole; everything else is hole-local
  if (hole !== myHole() && !['react', 'chat', 'sabx'].includes(ev.kind)) return;
  if (ev.kind === 'chat') {
    const id = rest[0]; if (!CHATS[id]) return;
    feed(`${dot}: ${esc(CHATS[id])}`); bubble(r, CHATS[id]);
    return;
  }
  if (ev.kind === 'react') {
    const kind = rest[0]; if (!REACTS[kind]) return;
    feed(`${dot} ${REACTS[kind]}`); bubble(r, REACTS[kind]);
    const now = performance.now();
    reactSound.recent = reactSound.recent.filter(t => now - t < 5000);
    if (!reactMuted() && !busy() && now - (reactSound.bySender.get(ev.from) ?? 0) > 4000 && reactSound.recent.length < 3) {
      reactSound.bySender.set(ev.from, now); reactSound.recent.push(now);
      sfx.react?.(kind);
    }
    // the gallery: two different friends reacting within 3 s of your shot
    if (G.lastShotAt && now - G.lastShotAt < 3000) {
      (G.galleryFrom ??= new Set()).add(ev.from);
      if (G.galleryFrom.size >= 2 && !G.gallerySaid) { G.gallerySaid = true; say('gallery', vars(), { bump: 3 }); }
    }
  } else if (ev.kind === 'possess') {
    const [x, z, honk] = rest.map(Number);
    if (Number.isFinite(x) && Number.isFinite(z)) puppetGo(r, x, z, honk === 1);
  } else if (ev.kind === 'gimme') {
    const strokes = +rest[0];
    if (strokes !== G.strokes || G.mode !== 'address') return;
    if (dist2(G.ball, G.cup) > 1.05 || !['green', 'fringe'].includes(G.course.surf(G.ball.x, G.ball.z))) return;
    offerGimme(r);
  } else if (ev.kind === 'teeth') {
    onTeeth(ev, r, rest);
  } else if (ev.kind === 'teethx') {
    const res = rest[0];
    hud.toast(res === 'got' ? `🦷 Got it! ${esc(r.name)}'s ball is goose food.` : res === 'miss' ? '🦷 Too slow.' : res === 'tug' ? `🦷 ${esc(r.name)} won the tug.` : '🦷 Not this time.');
  } else if (ev.kind === 'stand') {
    onStand(r, rest);
  } else if (ev.kind === 'fanhit') {
    const v = rest[0];
    hud.toast(v === 'save' ? `☂️ You saved ${esc(r.name)}!` : v === 'rob' ? `☂️ You robbed ${esc(r.name)}.` : '☂️ Bonk.');
  } else if (ev.kind === 'sic') {
    if (!G.sicPending) { G.sicPending = r.name; G.sicFrom = r.id; }
  } else if (ev.kind === 'sabx') {
    onSabotageResult(r, rest);
  }
}

// ---- spectator controls (between holes, watching a friend)
function renderEmoteButtons() {
  const box = $('emotes');
  if (!G.room || G.mode !== 'between') { box.innerHTML = ''; return; }
  const low = emoteTokens() < 1;
  const w = G.between?.watching;
  let html = Object.entries(REACTS).map(([k, e], i) => `<button data-react="${k}" ${low ? 'disabled' : ''} title="${k} (${i + 1})">${e}</button>`).join('')
    + `<button data-act="chat" aria-expanded="${!!G.chatPick}">💬</button>`;
  if (G.chatPick) {
    html += Object.entries(CHATS).map(([k, t]) => `<button data-chat="${k}" ${low ? 'disabled' : ''}>${esc(t)}</button>`).join('');
    if (box.dataset.html !== html) { box.innerHTML = html; box.dataset.html = html; }
    return;
  }
  if (w) {
    html += `<button data-act="possess" title="${TOOL_TIPS.possess}" ${low ? 'disabled' : ''}>${G.possess ? '🪿 Tap the course' : '🪿 Be the goose'}</button>`;
    const p = w.prog;
    const gimmeable = p && !w.playing && p.rest && !p.holed && p.hole === myHole() && Math.hypot(p.rest.x - G.cup.x, p.rest.z - G.cup.z) <= 1.0 && G.course.surf(p.rest.x, p.rest.z) !== 'rough';
    if (gimmeable && G.gimmeSent !== `${w.id}:${p.strokes}`) html += `<button data-act="gimme">🤝 Gimme</button>`;
    if (G.possess) html += `<button data-act="honk">📢 Honk</button>`;
    if (G.teethPick) html += ['brood|🥚 Brood it', 'relay|🏉 Relay it', 'any|🎲 Surprise me'].map(x => { const [k, l] = x.split('|'); return `<button data-teeth="${k}">${l}</button>`; }).join('');
    else if (canTeeth(w)) html += `<button data-act="teeth">🦷 Go for the ball</button>`;
  }
  const flying = [...rivals.values()].some(r => r.playing);
  html += `<button data-act="stand" ${flying ? 'disabled' : ''}>${flying ? '☂️ Ball in the air' : G.standMode ? '☂️ Tap the rough' : '☂️ Stand here'}</button>`;
  if (box.dataset.html !== html) { box.innerHTML = html; box.dataset.html = html; }
}
$('emotes').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  unlockAudio();
  if (b.dataset.react) { sendReact(b.dataset.react); return; }
  if (b.dataset.chat) { sendChat(b.dataset.chat); G.chatPick = false; renderEmoteButtons(); return; }
  if (b.dataset.act === 'chat') { G.chatPick = !G.chatPick; renderEmoteButtons(); return; }
  toolTip(b.dataset.act);
  if (b.dataset.act === 'stand') { G.standMode = !G.standMode; G.possess = false; G.teethPick = false; renderEmoteButtons(); return; }
  const w = G.between?.watching; if (!w) return;
  if (b.dataset.teeth) { sendTeeth(w, b.dataset.teeth); G.teethPick = false; renderEmoteButtons(); return; }
  if (b.dataset.act === 'teeth') { G.teethPick = true; renderEmoteButtons(); return; }
  if (b.dataset.act === 'possess') { G.possess = !G.possess; G.standMode = false; renderEmoteButtons(); }
  else if (b.dataset.act === 'honk') { if (G.possessWp && sendEmote('possess', w.id, `${myHole()}:${G.possessWp.x.toFixed(1)}:${G.possessWp.z.toFixed(1)}:1`)) sfx.honk(1); }
  else if (b.dataset.act === 'gimme') {
    const p = w.prog;
    if (sendEmote('gimme', w.id, `${myHole()}:${p.strokes}`)) { G.gimmeSent = `${w.id}:${p.strokes}`; feed(`🤝 Gimme offered to <b>${esc(w.name)}</b>`); }
  }
  renderEmoteButtons();
});
// Be the Goose: tap the course to send your puppet goose there
function groundAt(clientX, clientY) {
  const ndc = new THREE.Vector2(clientX / innerWidth * 2 - 1, -(clientY / innerHeight) * 2 + 1);
  const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, camera);
  const o = ray.ray.origin, d = ray.ray.direction;
  for (let t = 1; t < 400; t += t < 40 ? 0.5 : 2) {
    const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
    if (y <= G.course.h(x, z)) return { x, z };
  }
  return null;
}
function possessTap(e) {
  const w = G.between?.watching; if (!w || !G.possess) return false;
  const now = performance.now();
  if (now - (G.possessAt ?? 0) < 2000) { feed('🪿 <small>the goose is busy</small>'); return true; }
  const p = groundAt(e.clientX, e.clientY); if (!p) return true;
  if (sendEmote('possess', w.id, `${myHole()}:${p.x.toFixed(1)}:${p.z.toFixed(1)}:0`)) {
    G.possessAt = now; G.possessWp = p;
    burst(p.x, G.course.h(p.x, p.z) + 0.2, p.z, 14, new THREE.Color(ROOM_COLORS[(G.room.myColor ?? 0) % ROOM_COLORS.length]).getHex(), { speed: 1.5, up: 2, life: 0.8 });
  }
  return true;
}
addEventListener('keydown', e => {
  if (G.mode !== 'between' || !G.room || e.target.tagName === 'INPUT') return;
  const k = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
  if (k >= 0) sendReact(Object.keys(REACTS)[k]);
});

// ---- on the receiving end of Be the Goose: a puppet goose wearing your friend's colour
const puppets = new Map();   // sender id -> { mesh, label, x, z, target, idle }
function puppetGo(r, x, z, honk) {
  let p = puppets.get(r.id);
  if (p?.hunt) return;   // a hunting goose takes no orders
  if (!p) {
    if (puppets.size >= 3) return;
    const mesh = W.buildGoose(); scene.add(mesh);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.035, 6, 14), new THREE.MeshStandardMaterial({ color: r.hex }));
    collar.rotation.x = Math.PI / 2; collar.position.set(0, 0.2, 0); mesh.userData.neckPivot.add(collar);
    const label = W.buildLabel(`🪿 ${r.name}`, r.hex); scene.add(label);
    // it waddles in from the edge of your view
    // it waddles in where you can see it: ahead of the camera, off to one side
    const f = new THREE.Vector3(); camera.getWorldDirection(f); f.y = 0; f.normalize();
    const side = Math.random() < 0.5 ? -1 : 1;
    p = { mesh, label, x: camera.position.x + f.x * 14 - f.z * 5 * side, z: camera.position.z + f.z * 14 + f.x * 5 * side, yaw: 0, target: null, idle: 0, phase: 0 };
    for (let k = 0; k < 10 && !validLand(p.x, p.z); k++) { p.x = lerp(p.x, G.ball.x, 0.3); p.z = lerp(p.z, G.ball.z, 0.3); }
    puppets.set(r.id, p);
    hud.toast(`🪿 <b>${esc(r.name)}</b> is a goose now.`);
    reportSabotage(r.id, 'seen');
  }
  // clamp: playable land, off the green, never crowding your ball
  const g = G.course.green;
  if (((x - g[0]) / (g[2] + 4)) ** 2 + ((z - g[1]) / (g[3] + 4)) ** 2 < 1) { const a = Math.atan2(z - g[1], x - g[0]); x = g[0] + Math.cos(a) * (g[2] + 4.5); z = g[1] + Math.sin(a) * (g[3] + 4.5); }
  const db = Math.hypot(x - G.ball.x, z - G.ball.z);
  if (db < 6) { x = G.ball.x + (x - G.ball.x) / (db || 1) * 6; z = G.ball.z + (z - G.ball.z) / (db || 1) * 6; }
  if (!validLand(x, z)) return;
  p.target = { x, z }; p.idle = 0;
  if (honk) {
    const onGreen = ['green', 'fringe'].includes(G.course.surf(G.ball.x, G.ball.z));
    if (busy() || onGreen) feed(`<span style="color:${r.hex}">🪿</span> HONK`);
    else { sfx.react?.('honk'); G.shake = Math.max(G.shake, 0.05); feed(`<span style="color:${r.hex}">🪿</span> <b>${esc(r.name)}</b>: HONK`); }
    const now = performance.now();
    if (now - (p.ackAt ?? 0) > 6000) { p.ackAt = now; reportSabotage(r.id, 'honked'); }
  }
}
function updatePuppets(dt) {
  for (const [id, p] of puppets) {
    p.idle += dt; p.phase += dt;
    let speed = 0;
    if (p.hunt) { p.idle = 0; speed = huntPuppet(id, p, dt); if (!puppets.has(id)) continue; }
    else if (p.target) {
      const dx = p.target.x - p.x, dz = p.target.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.2) p.target = null;
      else { const st = Math.min(d, 3 * dt); p.x += dx / d * st; p.z += dz / d * st; p.yaw = Math.atan2(dx, dz); speed = 3; }
    }
    const y = G.course.h(p.x, p.z);
    p.mesh.position.set(p.x, y, p.z); p.mesh.rotation.y = p.yaw;
    const u = p.mesh.userData, wob = speed ? Math.sin(p.phase * 12) : 0;
    u.legL.rotation.x = wob * 0.6; u.legR.rotation.x = -wob * 0.6; u.body.rotation.z = wob * 0.12;
    if (p.faceplant !== undefined) { p.faceplant = Math.max(0, p.faceplant - dt); p.mesh.rotation.x = 1.2 * (1 - p.faceplant / 0.25); }
    scaleLabel(p.label, p.mesh.position, 1.7, 0.04);
    if (p.idle > 20 || !G.room || G.mode === 'holed' || G.mode === 'between') dropPuppet(id);
  }
}
function dropPuppet(id) {
  const p = puppets.get(id); if (!p) return;
  scene.remove(p.mesh, p.label); p.label.material.map?.dispose(); p.label.material.dispose();
  puppets.delete(id);
}
// ---- gimme
function offerGimme(r) {
  G.gimmeFrom = r.id;
  const el = $('gimme');
  el.innerHTML = `🤝 <b>${esc(r.name)}</b>: gimme? <button id="gimmeYes">Take it (G)</button>`;
  el.classList.remove('hidden');
  const strokes = G.strokes;
  const take = () => { if (G.mode === 'address' && G.strokes === strokes) acceptGimme(); el.classList.add('hidden'); };
  $('gimmeYes').onclick = take;
  G.gimmeOffer = take;
  clearTimeout(offerGimme.t); offerGimme.t = setTimeout(() => { el.classList.add('hidden'); G.gimmeOffer = null; }, 8000);
}
function acceptGimme() {
  G.gimmeOffer = null; $('gimme').classList.add('hidden');
  if (G.gimmeFrom) { reportSabotage(G.gimmeFrom, 'gimme'); G.gimmeFrom = null; }
  G.strokes++; G.usedGimme = true;
  const start = { ...G.ball };
  G.ball = { x: G.cup.x, z: G.cup.z, y: G.course.h(G.cup.x, G.cup.z) - 0.05 };
  hud.banner('GIMME<small>picked up, counts as holed</small>', 1600);
  holeOut({ start, wasBullet: false, gimme: true });
}
addEventListener('keydown', e => { if (e.code === 'KeyG' && G.gimmeOffer && e.target.tagName !== 'INPUT') G.gimmeOffer(); });
// ---- Sic 'Em: the best-placed friend still on this hole gets a goose
function sicTarget() {
  if (!G.room || !sameRound()) return null;
  const rows = standings().filter(x => !x.me);
  const cand = rows.map(x => ({ x, r: rivals.get(x.id) })).filter(({ r }) => r && r.online && r.prog && r.prog.hole === myHole() && !r.prog.holed && !r.prog.done);
  cand.sort((a, b) => a.x.toPar - b.x.toPar || (a.r.prog.strokes ?? 0) - (b.r.prog.strokes ?? 0) || (a.r.id < b.r.id ? -1 : 1));
  return cand[0]?.r ?? null;
}
// ---- in-play reaction strip (rooms only, hidden during your swing)
function updateReactBar() {
  const show = !!G.room && G.room.inRound && ['address', 'flight', 'walk'].includes(G.mode) && !swing.active && !G.scoped;
  $('reactBar').classList.toggle('hidden', !show);
  if (!show) $('reactBar').classList.remove('open');
}
$('chatMenu').innerHTML = Object.entries(REACTS).map(([k, e]) => `<button data-react="${k}" aria-label="${k}">${e}</button>`).join('')
  + Object.entries(CHATS).map(([k, t]) => `<button class="phrase" data-chat="${k}">${esc(t)}</button>`).join('');
$('reactBar').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  unlockAudio();
  if (b.id === 'chatToggle') { $('reactBar').classList.toggle('open'); clearTimeout(updateReactBar.t); updateReactBar.t = setTimeout(() => $('reactBar').classList.remove('open'), 6000); return; }
  if (b.dataset.react) sendReact(b.dataset.react); else if (b.dataset.chat) sendChat(b.dataset.chat);
  $('reactBar').classList.remove('open');
});

// ============================================================ camera
function addressCam() {
  const f = fwd(G.yaw);
  const putt = G.club === 'putter';
  const portrait = camera.aspect < 1;
  const back = (putt ? 1.75 : 2.35) * (portrait ? 1.5 : 1), up = (putt ? 1.2 : 1.5) * (portrait ? 1.15 : 1);
  const base = G.mode === 'goose' && G.gooseLie ? G.gooseLie : G.ball;
  // a little to the side of the line, so your golfer stands left of frame (TV angle);
  // a phone in portrait is too narrow for that, so it frames golfer and ball centred
  const side = avatar ? (putt ? 0.45 : 0.75) * (portrait ? -0.25 : 1) : 0;
  const pos = new THREE.Vector3(base.x - f.x * back - f.z * side, 0, base.z - f.z * back + f.x * side);
  pos.y = Math.max(base.y + up, G.course.h(pos.x, pos.z) + 1.1);
  const look = new THREE.Vector3(base.x + f.x * 20 - f.z * side, base.y + 20 * Math.tan(G.pitch) + (up - 0.2), base.z + f.z * 20 + f.x * side);
  return { pos, look };
}
function snapAddressCam(keepPitch) {
  const a = addressCam();
  camera.position.copy(a.pos);
  G.camLook.copy(a.look);
  camera.rotation.set(G.pitch, G.yaw, 0);
}
G.sway = { x: 0, y: 0 };
function updateAddressCam(dt) {
  const a = addressCam();
  camera.position.lerp(a.pos, 1 - Math.exp(-dt * 14));
  let yaw = G.yaw, pitch = G.pitch;
  if (G.scoped) {
    const amp = (G.holding ? 0.12 : 1) * (G.gasp > 0 ? 2.6 : 1) * 0.011;
    G.swayAmp = amp;
    const wt = performance.now() / 1000;   // wall clock: breathing doesn't slow with the frame rate
    G.sway.x = (Math.sin(wt * 1.7) * 0.7 + Math.sin(wt * 3.1 + 1) * 0.3) * amp;
    G.sway.y = (Math.sin(wt * 2.4 + 2) * 0.6 + Math.cos(wt * 1.3) * 0.4) * amp;
    yaw += G.sway.x; pitch += G.sway.y;
  } else { G.sway.x = G.sway.y = 0; }
  camera.rotation.set(pitch, yaw, 0);
  const f = fwd(yaw);
  G.camLook.set(camera.position.x + f.x * 20, camera.position.y + Math.tan(pitch) * 20, camera.position.z + f.z * 20);
}
function updateFlightCam(dt) {
  const s = G.shot, fc = G.flightCam;
  fc.t += dt;
  const p = frameAt(s.sim, Math.floor(s.t));
  const bp = new THREE.Vector3(p.x, p.y, p.z);
  const inBullet = s.bullet && s.t >= s.bullet.fStart && s.t < s.bullet.fEnd;
  const putt = s.L.club === 'putter';
  let wantPos, wantLook;
  const hv = Math.hypot(p.vx, p.vz);
  const dir = hv > 0.3 ? { x: p.vx / hv, z: p.vz / hv } : fwd(G.yaw);
  if (inBullet) {
    wantPos = new THREE.Vector3(p.x - dir.x * 1.4 + dir.z * 0.35, p.y + 0.32, p.z - dir.z * 1.4 - dir.x * 0.35);
    wantLook = bp.clone().lerp(new THREE.Vector3(G.cup.x, G.course.h(G.cup.x, G.cup.z), G.cup.z), 0.25);
  } else if (fc.t < (putt ? 99 : 0.25) || s.kind === 'shoo') {
    // first person: stay put, turn the head to follow the ball (eased, so impact doesn't stare at the turf)
    wantPos = fc.pos; wantLook = fc.look.clone().lerp(bp, smooth(clamp(fc.t / 0.45, 0, 1)));
  } else {
    const back = 7 + Math.min(10, hv * 0.15);
    wantPos = new THREE.Vector3(p.x - dir.x * back, p.y + 2.8, p.z - dir.z * back);
    wantLook = bp;
  }
  wantPos.y = Math.max(wantPos.y, G.course.h(wantPos.x, wantPos.z) + 0.35);
  const k = inBullet ? 1 - Math.exp(-dt * 10) : 1 - Math.exp(-dt * (fc.t < 1.2 ? 2.5 + fc.t * 3 : 5.5));
  camera.position.lerp(wantPos, k);
  G.camLook.lerp(wantLook, inBullet ? 1 - Math.exp(-dt * 12) : 1 - Math.exp(-dt * 8));
  camera.lookAt(G.camLook);
}

// ============================================================ aim preview
let lastPreview = '';
function updatePreview() {
  updatePuttRead();
  const show = (G.mode === 'address' || (G.mode === 'goose' && !G.shot)) && !G.walk && !swing.active;
  aimLine.visible = show;
  aimRing.visible = aimLabel.visible = show && G.club !== 'putter' && !!lastPreview;
  if (!show) return;
  const base = G.mode === 'goose' ? G.gooseLie : G.ball;
  const d = aimDir();
  // short dashed aim line on the ground
  const pts = aimLine.geometry.attributes.position;
  const len = G.club === 'putter' ? 3 : 9;
  for (let i = 0; i < pts.count; i++) {
    const t = (i / (pts.count - 1)) * len;
    const x = base.x + d.x * t, z = base.z + d.z * t;
    pts.setXYZ(i, x, G.course.h(x, z) + 0.04, z);
  }
  pts.needsUpdate = true; aimLine.computeLineDistances();
  const key = `${base.x.toFixed(2)},${base.z.toFixed(2)},${G.yaw.toFixed(3)},${G.wind.x.toFixed(2)},${G.ballIdx},${G.powerUp?.id}${G.powerUp?.shotLeft}`;
  const nowMs = performance.now();
  if (key !== lastPreview || G.previewDirty) {
    // only re-simulate once the aim has settled for 80 ms (cheap on a weak laptop)
    if (key !== G.previewKeyPending) { G.previewKeyPending = key; G.previewKeyAt = nowMs; }
    if (nowMs - G.previewKeyAt >= 80 || !lastPreview || G.previewDirty) {
      lastPreview = key; G.previewDirty = false;
      const [tr, airGravity, noTrees] = modTrait();
      // every club's full-power carry from here: the aim label and the club buttons share them
      G.clubCarries = {}; G.clubCarry = {};
      for (const id of CLUB_ORDER) {
        if (id === 'putter') continue;
        const L1 = launch(id, 1, d.x, d.z, 0, 1, tr);
        if (G.powerUp?.shotLeft && G.powerUp.shot?.banana) L1.side += (G.holeIdx % 2 ? 1 : -1) * 0.9 * CLUBS[id].curve;
        const sim = simulate({ course: G.course, cup: { x: 1e5, z: 1e5 }, wind: G.wind, trait: tr, colliders: G.colliders, untilCarry: true, airGravity, noTrees, strokeNo: G.strokes + 1, noAura: auraOff(), wmPhase: wmPhase() }, base, L1);
        G.clubCarries[id] = { x: sim.carry.x, z: sim.carry.z };
        G.clubCarry[id] = Math.hypot(sim.carry.x - base.x, sim.carry.z - base.z);
      }
      renderClubs();
    }
  }
  if (G.club === 'putter') return;
  G.previewCarry = G.clubCarries?.[G.club] ?? null;
  const c = G.previewCarry; if (!c) return;
  const y = G.course.h(c.x, c.z) + 0.05;
  aimRing.position.set(c.x, y, c.z);
  const dd = Math.hypot(c.x - base.x, c.z - base.z);
  aimRing.scale.setScalar(0.8 + dd * 0.04);
  aimLabel.userData.draw(`100% · ${dd.toFixed(0)} m`, coarse && dd < 40 ? '' : unitText(dd), '#ffe08a');
  aimLabel.visible = !G.scoped;
  scaleLabel(aimLabel, aimRing.position, 1.2 + dd * 0.05, 0.055);
}

// ============================================================ carry indicator ("Carry, in Geese")
// The council's pick: a live landing ring as you pull back, honest metres,
// plus one absurd unit per hole. Carry only, at perfect tempo and no drift:
// roll, tempo and curve stay your problem.
const UNITS = [
  { m: 0.9, t: n => `${n} geese, nose to tail` },
  { m: 1.8, t: n => `${n} Old Toms, laid end to end` },
  { m: 0.14, t: n => `${n} of your chunky balls` },
  { m: 0.65, t: n => `${n} baguettes` },
  { m: 18.3, t: n => `${n} bowling lanes` },
  { m: 12, t: n => `${n} buses (single-decker)` },
  { m: 25, t: n => `${n} blue whales, politely queued` },
  { m: 343, t: n => `${n} s of the commentator screaming` },
  { grave: true, t: (n, dead) => `${n} graveyards (${dead} plot${dead === 1 ? '' : 's'})` },
];
function pickUnit() {
  const dead = graveyard().length;
  const pool = UNITS.filter(u => (!u.grave || dead > 0) && u !== G.unit);
  G.unit = pool[Math.floor(Math.random() * pool.length)];
}
function unitText(m) {
  const u = G.unit ?? UNITS[0], dead = graveyard().length;
  const n = m / (u.grave ? Math.max(1, dead) : u.m);
  return u.t(n < 10 ? n.toFixed(1) : Math.round(n).toLocaleString('en'), dead);
}
const carry = { samples: null, last: null, mark: null, markP: 0, flight: false, hideAt: 0, calledT: 0 };
const CARRY_P = [0.25, 0.5, 0.75, 1.0, 1.15];
// the ball's trait with any active power-up applied (the carry marker stays honest)
function modTrait() {
  const m = shotMods(false), t = traitOf(bag());
  for (const k of ['speed', 'bounce', 'roll', 'wind', 'side', 'capture']) if (m[k]) t[k] *= m[k];
  return [t, m.airGravity, m.noTrees];
}
function carrySamples() {
  const base = G.ball, d = aimDir(), [tr, airGravity, noTrees] = modTrait();
  const world = { course: G.course, cup: { x: 1e5, z: 1e5 }, wind: G.wind, trait: tr, colliders: G.colliders, untilCarry: true, airGravity, noTrees, strokeNo: G.strokes + 1, noAura: auraOff() };
  const ban = G.powerUp?.shotLeft && G.powerUp.shot?.banana ? (G.holeIdx % 2 ? 1 : -1) * 0.9 * CLUBS[G.club].curve : 0;
  const S = CARRY_P.map(p => { const L = launch(G.club, p, d.x, d.z, 0, 1, tr); L.side += ban; const sim = simulate(world, base, L); return { p, x: sim.carry.x, z: sim.carry.z }; });
  S.base = { x: base.x, z: base.z };
  return S;
}
function carryAt(p) {
  const S = carry.samples, b = S.base;
  if (p <= S[0].p) { const k = Math.max(0, p) / S[0].p; return { x: lerp(b.x, S[0].x, k), z: lerp(b.z, S[0].z, k) }; }
  for (let i = 1; i < S.length; i++) {
    if (p <= S[i].p || i === S.length - 1) { const a = S[i - 1], c = S[i], k = clamp((p - a.p) / (c.p - a.p), 0, 1); return { x: lerp(a.x, c.x, k), z: lerp(a.z, c.z, k) }; }
  }
}
const powerColor = p => p > 1 ? '#ff6f61' : p >= 0.8 ? '#ffc84a' : '#4fd39a';
function updateCarryIndicator(dt) {
  const inflight = !!G.shot;
  if (inflight !== document.body.classList.contains('inflight')) document.body.classList.toggle('inflight', inflight);
  carry.calledT = Math.max(0, carry.calledT - dt);
  let pt = null, p = 0, frozen = false;
  if (swing.active && carry.samples) {
    p = swing.phase === 'back' ? swing.back : swing.peak;
    frozen = swing.phase !== 'back';
    if (p > 0.02) { pt = carryAt(p); carry.last = { pt, p }; }
  } else if (carry.calledT > 0 && carry.mark) { pt = carry.mark; p = carry.markP; frozen = true; }   // only to celebrate "called it"
  // (playtest: the frozen carry mark left on the fairway in flight read as a crosshair; it goes at impact)
  // the theremin follows predicted carry (putts: their roll distance, scaled up so you can hear it)
  if (swing.active) {
    if (swing.phase === 'back') swingTone.set(carry.samples ? (pt ? Math.hypot(pt.x - G.ball.x, pt.z - G.ball.z) : 0) : honestPutt(swing.back) * 6);
    else swingTone.release();
  }
  carryRing.visible = carryBeam.visible = !!pt; carryLabel.visible = !!pt && !G.scoped;
  if (!pt) return;
  const b = carry.samples?.base ?? G.lastLie ?? G.ball;
  const dd = Math.hypot(pt.x - b.x, pt.z - b.z);
  const col = carry.calledT > 0 ? '#ffffff' : powerColor(p);
  const y = G.course.h(pt.x, pt.z) + 0.06;
  carryRing.position.set(pt.x, y, pt.z);
  const pulse = carry.calledT > 0 ? 1 + Math.sin((1.2 - carry.calledT) * 18) * 0.25 + (1.2 - carry.calledT) * 0.6 : 1;
  carryRing.scale.setScalar((0.8 + dd * 0.04) * pulse);
  carryRing.material.color.set(col);
  carryBeam.material.color.set(col);
  carryBeam.scale.set(1 + dd * 0.012, 1, 1 + dd * 0.012);
  carryBeam.position.set(pt.x, y + 7, pt.z);
  carryBeam.material.opacity = frozen ? 0.18 : 0.35;
  carryBeam.visible = dd > 25;
  carryRing.material.opacity = carry.calledT > 0 ? 0.95 : frozen ? (G.shot ? 0.35 : 0.6) : 0.9;
  const big = carry.calledT > 0 ? 'CALLED IT!' : `${Math.round(dd)} m${p > 1 ? ' · OVERCOOKED' : ''}`;
  carryLabel.userData.draw(big, coarse && dd < 40 ? '' : unitText(dd), col, carry.calledT > 0);
  carryLabel.material.opacity = carry.calledT > 0 ? 1 : frozen ? 0.6 : 1;
  scaleLabel(carryLabel, carryRing.position, 1.2 + dd * 0.05, 0.065);
}
// screen rectangle of a label sprite, in NDC units
function labelRect(sp) {
  const v = sp.position.clone().project(camera);
  const d = Math.max(0.1, camera.position.distanceTo(sp.position)), k = d * Math.tan(camera.fov * Math.PI / 360);
  return { x: v.x, y: v.y, hw: sp.scale.x / 2 / (k * camera.aspect), hh: sp.scale.y / 2 / k, k, front: v.z < 1 };
}
// when the pin tag and the carry label would overlap on screen (a narrow phone,
// aiming at the flag), lift the pin tag clear above the carry label
function unstackLabels(low, high) {
  const a = labelRect(low), b = labelRect(high);
  if (!a.front || !b.front) return;
  const gap = 0.012;
  if (Math.abs(a.x - b.x) > a.hw + b.hw + gap) return;
  const need = (a.y + a.hh + gap) - (b.y - b.hh);
  if (need > 0) high.position.y += need * b.k;
}
function scaleLabel(sprite, pos, lift, minScreen) {
  const d = camera.position.distanceTo(pos);
  const s = Math.max(0.5, d * minScreen * (G.scoped ? 0.2 : 1));
  sprite.scale.set(s * (sprite.userData.aspect ?? 4), s, 1);
  sprite.position.set(pos.x, pos.y + lift + s * 0.6, pos.z);
}

// ============================================================ scope
function setScope(on) {
  if (on && !(G.mode === 'address' || G.mode === 'goose')) return;
  if (G.scoped === on) return;
  G.scoped = on;
  sfx.scope(on);
  $('scope').classList.toggle('show', on);
  $('hint').style.visibility = on ? 'hidden' : '';
  $('caption').style.opacity = on ? '0.55' : '';
  if (on) {
    G.preScopePitch = G.pitch;
    // level the scope on the predicted carry (or the pin when putting)
    const tgt = G.club !== 'putter' && aimRing.visible ? aimRing.position : new THREE.Vector3(G.cup.x, G.course.h(G.cup.x, G.cup.z), G.cup.z);
    const dx = tgt.x - camera.position.x, dz = tgt.z - camera.position.z;
    G.pitch = clamp(Math.atan2(tgt.y + 0.05 - camera.position.y, Math.hypot(dx, dz)), -0.75, 0.5);
  } else if (G.preScopePitch !== undefined) G.pitch = G.preScopePitch;
  if (!on) { G.holding = false; }
  if (on && !G.hintsShown.scope) { G.hintsShown.scope = true; }
}
function rangefind() {
  // march the view ray across the baked heightfield
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  const o = camera.position;
  let prev = 0;
  for (let t = 1; t < 700; t += t < 50 ? 0.5 : 1.5) {
    const x = o.x + dir.x * t, y = o.y + dir.y * t, z = o.z + dir.z * t;
    if (y <= G.course.h(x, z)) {
      let a = prev, b = t;
      for (let k = 0; k < 12; k++) { const m = (a + b) / 2; if (o.y + dir.y * m <= G.course.h(o.x + dir.x * m, o.z + dir.z * m)) b = m; else a = m; }
      const hx = o.x + dir.x * b, hz = o.z + dir.z * b;
      const base = G.mode === 'goose' ? G.gooseLie : G.ball;
      return { d: Math.hypot(hx - base.x, hz - base.z), elev: G.course.h(hx, hz) - (base.y - R), surf: G.course.surf(hx, hz) };
    }
    prev = t;
  }
  return null;
}
function updateScope(dt) {
  const target = G.scoped ? 14 : 70;
  const fov = lerp(camera.fov, target + G.fovKick, 1 - Math.exp(-dt * 12));
  G.fovKick = Math.max(0, G.fovKick - dt * 20);
  if (Math.abs(fov - camera.fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  // breath: hold Shift for up to 4 s, then gasp for 2 s
  if (G.scoped && G.holding && G.gasp <= 0) {
    G.breath -= dt / 4;
    if (Math.floor(G.time * 1.6) !== Math.floor((G.time - dt) * 1.6)) sfx.heartbeat();
    if (G.breath <= 0) { G.breath = 0; G.gasp = 2; G.holding = false; sfx.gasp(); }
  } else {
    if (G.gasp > 0) G.gasp -= dt;
    G.breath = Math.min(1, G.breath + dt / 3);
  }
  $('breathFill').style.width = `${G.breath * 100}%`;
  $('breath').classList.toggle('gasp', G.gasp > 0);
  if (!G.scoped) return;
  const r = rangefind();
  if (r) G.rangeShown = G.rangeShown == null || Math.abs(G.rangeShown - r.d) > 25 ? r.d : lerp(G.rangeShown, r.d, 1 - Math.exp(-dt * 8));
  $('rangeDist').textContent = r ? `${G.rangeShown.toFixed(1)} m` : '— m';
  let carryLine = '';
  if (G.club !== 'putter') {
    const live = swing.active && carry.last, c = live ? carry.last.pt : G.previewCarry;
    if (c) { const m = Math.hypot(c.x - G.ball.x, c.z - G.ball.z); carryLine = `<br>CARRY ${live ? Math.round(carry.last.p * 100) + '%' : '100%'} ${m.toFixed(0)} m · ${esc(unitText(m))}`; }
  }
  $('rangeElev').innerHTML = (r ? `ELEV ${r.elev >= 0 ? '+' : ''}${r.elev.toFixed(1)} m · ${(SURF_LABEL[r.surf] ?? '').toUpperCase()}` : 'NO TARGET') + carryLine;
  // wind relative to the line of aim
  const f = fwd(G.yaw), rx = -f.z, rz = f.x;
  const head = -(G.wind.x * f.x + G.wind.z * f.z), cross = G.wind.x * rx + G.wind.z * rz;
  $('scopeWind').innerHTML = `WIND ${Math.hypot(G.wind.x, G.wind.z).toFixed(1)} m/s<br>${head >= 0 ? 'HEAD' : 'TAIL'} ${Math.abs(head).toFixed(1)} · ${cross >= 0 ? 'R→' : '←L'} ${Math.abs(cross).toFixed(1)}`;
}

// ============================================================ club viewmodel
function updateClub(dt) {
  const show = G.mode === 'address' || (G.mode === 'goose' && !G.walk) || (G.shot && G.flightCam?.t < 0.6) || G.hitstop > 0;
  club.visible = show && !G.scoped && !avatar?.visible;
  {
    const p = swing.active ? (swing.phase === 'back' ? swing.back : swing.peak) : 0;
    $('powerFill').style.height = `${Math.min(1.15, p) / 1.15 * 100}%`;
    const putt = G.club === 'putter';
    if (putt) { const b0 = G.mode === 'goose' && G.gooseLie ? G.gooseLie : G.ball; $('powerLbl').innerHTML = `${honestPutt(p).toFixed(1)} m<small>hole ${dist2(b0, G.cup).toFixed(1)} m</small>`; }
    else {
      const pt = carry.samples && p > 0.02 ? carryAt(p) : null, m = pt ? Math.round(Math.hypot(pt.x - G.ball.x, pt.z - G.ball.z)) : 0;
      $('powerLbl').innerHTML = carry.samples ? `${m} m<small>${m >= 5 ? esc(unitText(m)) : `${Math.round(p * 100)}%`}</small>` : `${Math.round(p * 100)}%`;
    }
    $('powerLbl').style.color = p > 1 ? '#ff6f61' : '#fff';
    // flat-green roll distance for this stroke: you still have to read the slope
    puttRing.visible = putt && swing.active && p > 0.01;
    if (puttRing.visible) {
      const base = G.mode === 'goose' && G.gooseLie ? G.gooseLie : G.ball, d = aimDir(), L = honestPutt(p);
      const x = base.x + d.x * L, z = base.z + d.z * L;
      puttRing.position.set(x, G.course.h(x, z) + 0.03, z);
    }
  }
  if (!club.visible) return;
  const base = G.mode === 'goose' && G.gooseLie ? G.gooseLie : G.ball;
  const f = fwd(G.yaw);
  const putt = G.club === 'putter';
  // hands sit a touch left of and behind the ball; the head rests just behind it
  const handBack = putt ? 0.62 : 0.78, handUp = putt ? 0.82 : 0.9, side = 0.16;
  club.position.set(base.x - f.x * handBack + f.z * side, base.y + handUp, base.z - f.z * handBack - f.x * side);
  const a0 = Math.atan2(handBack, handUp);
  let ang = a0;
  if (swing.active) {
    const b = swing.phase === 'back' ? swing.back : Math.max(0, swing.peak - swing.fwd);
    ang = a0 - Math.min(b, 0.95) * (putt ? 0.9 : 2.3);   // stops short of swinging the head through the camera
  } else if (swing.follow > 0) {
    swing.follow += dt * 3;
    ang = a0 + Math.min(1, swing.follow) * (putt ? 0.5 : 2.2);
    if (swing.follow > 1.4) swing.follow = 0;
  }
  club.rotation.set(ang, G.yaw, 0, 'YXZ');
}

// ============================================================ input
// One gesture everywhere: drag sideways to aim, drag down then flick up to
// swing. Phones keep their swing pad (the playtest favourite). With a mouse
// the whole course is the pad, and the first few pixels of a drag decide
// whether it's an aim (sideways) or a swing (down). No pointer lock.
const coarse = matchMedia('(pointer: coarse)').matches;
// (round 8, S10) phones only hear about phone controls: desktop strings are
// rewritten or removed from the page itself (screen readers read hidden text)
const BULLET_LBL = coarse ? '● BULLET CAM · TAP TO SKIP' : '● BULLET CAM · CLICK TO SKIP';
function phoneCopy() {
  $('bulletLbl').textContent = BULLET_LBL;
  if (!coarse) return;
  $('acc').querySelector('span')?.remove();   // the key swing's needle: no Space bar here
  $('breath').innerHTML = '<div id="breathBar"><div id="breathFill"></div></div>'; $('breath').style.display = 'none';   // steadying is a Shift key thing
  $('helpRows').innerHTML = [
    ['Aim', 'Drag the course sideways.'], ['Swing', 'On the pad: drag down, flick up.'], ['Curve', 'Flick up at an angle.'],
    ['Cancel', 'Lift your finger before the flick.'], ['Club', 'Tap a club.'], ['Zoom', 'Tap 🔭.'], ['Sound', 'Tap 🔊 and 🎙️.'],
  ].map(([a, b]) => `<tr><td><b>${a}</b></td><td>${b}</td></tr>`).join('');
}
phoneCopy();
function lockPointer() { /* pointer lock retired: drag-to-aim works everywhere */ }
function inGame() { return !['title', 'end'].includes(G.mode) && $('help').classList.contains('hidden') && $('lb').classList.contains('hidden'); }
let dragging = null;
// Backing out of a swing: slide onto the ✕ strip (it appears beside your
// finger or cursor as you start), press Esc, or right-click.
const cancelEl = $('swingCancel');
function showCancel(x, y) {
  const w = 84, h = 300;
  let left = x - 150 - w / 2;
  if (left < 8) left = x + 110 - w / 2;
  left = clamp(left, 8, innerWidth - w - 8);
  cancelEl.style.left = `${left}px`; cancelEl.style.top = `${clamp(y - 90, 8, innerHeight - h - 8)}px`;
  cancelEl.classList.add('show'); cancelEl.classList.remove('hot');
}
function hideCancel() { cancelEl.classList.remove('show', 'hot'); }
function overCancel(x, y) {
  if (!cancelEl.classList.contains('show')) return false;
  const r = cancelEl.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}
function userCancel() {
  if (!swing.active) return;
  cancelSwing(); sfx.tick();
  hud.banner('<small>swing cancelled</small>', 700);
  if (dragging?.mode === 'swing') dragging.mode = 'dead';
}
function tugMove(e) {
  const l = tug.last.get(e.pointerId);
  if (l) tugInput(Math.hypot(e.clientX - l.x, e.clientY - l.y));
  tug.last.set(e.pointerId, { x: e.clientX, y: e.clientY });
}
canvas.addEventListener('pointerdown', e => {
  unlockAudio();
  if (!inGame()) return;
  if (G.mode === 'tug') { tug.last.set(e.pointerId, { x: e.clientX, y: e.clientY }); return; }
  if (G.mode === 'gooseCam' && goose?.state === 'fly') { goose.x = goose.target.x; goose.z = goose.target.z; landGooseFlight(goose); return; }   // skip the airlift
  if (G.mode === 'between' && (standTap(e) || possessTap(e))) return;
  if (G.mode === 'angler') { angler.reeling = true; return; }
  if (G.mode === 'flyover') { skipFlyover(); return; }
  if (G.mode === 'scare') { skipScare(); return; }
  if (G.mode === 'linger') { skipLinger(); return; }
  if (G.mode === 'sasquack') { skipSasquack(); return; }
  if (G.shot && G.shot.bullet && G.shot.wasBullet) { G.shot.t = G.shot.sim.n - 1; return; } // skip bullet cam
  if (G.mode === 'holed') { G.celebrate = Math.min(G.celebrate, 0.2); return; }
  if (e.button === 2) { if (swing.active) userCancel(); else setScope(true); return; }
  if (e.button !== 0) return;
  dragging = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, id: e.pointerId, mode: coarse ? 'aim' : 'pending' };
  try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
});
addEventListener('pointermove', e => {
  if (G.mode === 'tug') { if (e.buttons || e.pointerType === 'touch') tugMove(e); return; }
  if (!dragging || dragging.id !== e.pointerId) return;
  const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
  dragging.x = e.clientX; dragging.y = e.clientY;
  if (dragging.mode === 'pending') {
    const tx = e.clientX - dragging.x0, ty = e.clientY - dragging.y0;
    if (Math.hypot(tx, ty) < 7) return;
    if (ty > Math.abs(tx) * 0.9 && canSwing()) {
      dragging.mode = 'swing'; beginSwing('mouse'); showCancel(dragging.x0, dragging.y0);
      swingMove(tx * 1.4, ty * 1.4);
    } else { dragging.mode = 'aim'; look(tx * 1.6, ty * 1.6); }
    return;
  }
  if (dragging.mode === 'swing') {
    if (overCancel(e.clientX, e.clientY)) { userCancel(); return; }
    swingMove(dx * 1.4, dy * 1.4);
  } else if (dragging.mode === 'aim') look(dx * 1.6, dy * 1.6);
});
function pointerEnd(e, cancelled) {
  tug.last.delete(e.pointerId);
  if (G.mode === 'angler') angler.reeling = false;
  if (e.button === 2) setScope(false);
  if (dragging && dragging.id === e.pointerId) {
    if (dragging.mode === 'swing' && swing.active) { if (cancelled) cancelSwing(); else endSwing(); }
    dragging = null;
  }
}
addEventListener('pointerup', e => pointerEnd(e, false));
addEventListener('pointercancel', e => pointerEnd(e, true));
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => {
  if (!inGame()) return;
  e.preventDefault();
  const i = CLUB_ORDER.indexOf(G.club) + (e.deltaY > 0 ? 1 : -1);
  setClub(CLUB_ORDER[(i + 4) % 4]);
}, { passive: false });
function look(dx, dy) {
  if (!(G.mode === 'address' || G.mode === 'wheel')) return;
  const sens = 0.0022 * (G.scoped ? 0.16 : 1);
  G.yaw -= dx * sens;
  G.pitch = clamp(G.pitch - dy * sens, -0.75, 0.5);
}
const touchSwing = $('touchSwing');
touchSwing.addEventListener('pointerdown', e => {
  unlockAudio();
  if (G.mode === 'tug') { tug.last.set(e.pointerId, { x: e.clientX, y: e.clientY }); return; }
  if (G.mode === 'angler') { angler.reeling = true; return; }
  if (G.mode === 'flyover') { skipFlyover(); return; }
  if (G.mode === 'wheel') { hurryWheel(); return; }
  if (!canSwing()) return;
  beginSwing('touch');
  dragging = { x: e.clientX, y: e.clientY, id: e.pointerId, mode: 'swing' };
  showCancel(e.clientX, e.clientY);
  try { touchSwing.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
});
$('angler').addEventListener('pointerdown', e => { e.preventDefault(); unlockAudio(); if (G.mode === 'angler') angler.reeling = true; });
$('reelBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); unlockAudio(); if (G.mode === 'angler') { angler.reeling = true; $('reelBtn').classList.add('on'); } });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) $('reelBtn').addEventListener(ev, () => { angler.reeling = false; $('reelBtn').classList.remove('on'); });
$('touchScope').addEventListener('pointerdown', e => { e.preventDefault(); setScope(!G.scoped); });

const keys = {};
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  keys[e.code] = true;
  if (!inGame()) return;
  if (e.code === 'Escape' && swing.active) { userCancel(); return; }
  if ((e.code === 'Escape' || e.code === 'Space') && G.mode === 'scare') { e.preventDefault(); skipScare(); return; }
  if (e.code === 'Space') {
    e.preventDefault();
    if (e.repeat) return;
    unlockAudio();
    if (G.mode === 'tug') { tugInput(450 / tugScale()); return; }
    if (G.mode === 'flyover') { skipFlyover(); return; }
    if (G.mode === 'wheel') { hurryWheel(); return; }
    if (G.mode === 'between') { $('betweenGo').click(); return; }
    if (G.mode === 'linger') { skipLinger(); return; }
    if (G.mode === 'sasquack') { skipSasquack(); return; }
    if (G.mode === 'angler') { angler.reeling = true; return; }
    if (G.shot?.wasBullet) { G.shot.t = G.shot.sim.n - 1; return; }
    if (G.mode === 'holed') { G.celebrate = Math.min(G.celebrate, 0.2); return; }
    if (swing.active && swing.src === 'key' && swing.phase === 'acc') { keyStrike(); return; }
    beginSwing('key');
  }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { if (G.scoped && G.gasp <= 0) G.holding = true; }
  if (e.code === 'KeyZ' && !e.repeat) setScope(true);
  if (/^Digit[1-4]$/.test(e.code)) setClub(CLUB_ORDER[+e.code.slice(5) - 1]);
  if (e.code === 'KeyQ' || e.code === 'KeyE') { const i = CLUB_ORDER.indexOf(G.club) + (e.code === 'KeyE' ? 1 : -1); setClub(CLUB_ORDER[(i + 4) % 4]); }
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'KeyV') toggleVoice();
  if (e.code === 'KeyH') openHelp();
});
addEventListener('keyup', e => {
  keys[e.code] = false;
  if (e.code === 'Space') { if (G.mode === 'angler') angler.reeling = false; else if (swing.active && swing.src === 'key') endSwing(); }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') G.holding = false;
  if (e.code === 'KeyZ') setScope(false);
});
function keyAim(dt) {
  if (!(G.mode === 'address' || G.mode === 'wheel') || swing.active && swing.src !== 'key') return;
  const s = (G.scoped ? 0.06 : 0.9) * dt;
  if (keys.KeyA || keys.ArrowLeft) G.yaw += s;
  if (keys.KeyD || keys.ArrowRight) G.yaw -= s;
  if (keys.KeyW || keys.ArrowUp) G.pitch = clamp(G.pitch + s * 0.7, -0.75, 0.5);
  if (keys.KeyS || keys.ArrowDown) G.pitch = clamp(G.pitch - s * 0.7, -0.75, 0.5);
  if (swing.active && swing.src === 'key') {
    if (swing.phase === 'back') {
      const held = (performance.now() - swing.t0) / 1000;
      swing.back = Math.min(1.15, held * 0.8);
      $('acc').classList.add('show'); $('accNeedle').style.left = '96%';
    } else if (swing.phase === 'acc') {
      // classic second tap: the needle sweeps right -> left once; tap Space on the centre
      const k = (performance.now() - swing.tAcc) / 1000 / 0.7;
      swing.drift = (1 - 2 * Math.min(1, k)) * 0.45;
      $('accNeedle').style.left = `${50 + swing.drift / 0.45 * 46}%`;
      if (k >= 1) keyStrike();   // never tapped: a big hook
    }
  }
}
function toggleMute() { setMuted(!isMuted()); $('muteBtn').textContent = isMuted() ? '🔇' : '🔊'; }
function toggleVoice() { setVoiceEnabled(!voiceEnabled()); $('voiceBtn').style.opacity = voiceEnabled() ? 1 : 0.4; hud.toast(voiceEnabled() ? 'Commentator voice on' : 'Commentator voice off (captions stay)'); }
$('muteBtn').addEventListener('click', toggleMute);
$('voiceBtn').addEventListener('click', toggleVoice);
function openHelp() { if (document.pointerLockElement) document.exitPointerLock(); $('help').classList.remove('hidden'); }
$('helpBtn').addEventListener('click', openHelp);
$('helpClose').addEventListener('click', () => $('help').classList.add('hidden'));
$('noScare').checked = store.get('ghg3d_noscare') === '1';
$('noScare').addEventListener('change', e => store.set('ghg3d_noscare', e.target.checked ? '1' : '0'));
$('muteReact').checked = store.get('ghg3d_mutereact') === '1';
$('muteReact').addEventListener('change', e => store.set('ghg3d_mutereact', e.target.checked ? '1' : '0'));

// ============================================================ title / end
$('name').value = store.get('ghg_name') || store.get('golf_name') || '';
// ---- ball picker (title card): exactly four lit; a fifth tap unlights the oldest pick
function renderBallPick() {
  const ids = pickedBalls();
  $('ballPick').innerHTML = SIGNATURE.map(b => `<button type="button" class="bp${ids.includes(b.trait) ? ' on' : ''}" data-id="${b.trait}" title="${esc(b.blurb)}"><i>👀</i><b>${esc(b.name)}</b><small>${esc(b.blurb)}</small></button>`).join('');
}
$('ballPick').addEventListener('click', e => {
  const btn = e.target.closest('.bp'); if (!btn) return;
  let ids = pickedBalls().filter(id => id !== btn.dataset.id);
  if (ids.length === 4 || !btn.classList.contains('on')) { ids.push(btn.dataset.id); if (ids.length > 4) ids.shift(); }
  if (ids.length < 4) { ids = pickedBalls(); }   // tapping a lit ball with only four lit: keep the four
  store.set('ghg3d_bag', JSON.stringify(ids));
  renderBallPick(); sfx.tick?.();
});
renderBallPick();
renderCharPick();
setTimeout(() => { try { for (const g of GOLFERS) portraits[g.id] = buildGolferPortrait(g.id); } catch { /* emoji fallback */ } renderCharPick(); }, 300);
// ---- tee chooser: which living ball plays this hole (no switching mid-hole, like real golf)
function renderBallChoose() {
  const show = G.mode === 'address' && G.strokes === 0 && G.bag.filter(b => b.alive).length > 1 && !swing.active;
  $('ballChoose').classList.toggle('hidden', !show);
  if (!show) return;
  const html = G.bag.map((b, i) => `<button class="bc${i === G.ballIdx ? ' active' : ''}${b.alive ? '' : ' dead'}" data-i="${i}" ${b.alive ? '' : 'disabled'}><i>${b.alive ? '👀' : '✝'}</i>${esc(b.name.split(' ').at(-1))}</button>`).join('');
  if ($('ballChoose').dataset.html !== html) { $('ballChoose').innerHTML = html; $('ballChoose').dataset.html = html; }
}
$('ballChoose').addEventListener('click', e => {
  const b = e.target.closest('.bc'); if (!b || b.disabled || G.strokes !== 0) return;
  G.ballIdx = +b.dataset.i; renderBag(); G.previewDirty = true;
  G.ballTagFull = true; G.ballTagT = 3; sfx.newBall?.();
  roomSendProgress();
});
function playerNameNow() { return $('name').value.trim().slice(0, 20) || G.playerName || 'Player'; }
function beginPlay(startHole = 0) {
  unlockAudio();
  G.playerName = playerNameNow();
  store.set('ghg_name', G.playerName);
  $('name').blur();
  $('title').classList.add('hidden'); $('end').classList.add('hidden');
  $('hud').classList.remove('hidden');
  canvas.focus({ preventScroll: true });
  if (coarse) { touchSwing.classList.remove('hidden'); $('touchScope').classList.remove('hidden'); }
  G.booted = true;
  makeAvatar();
  startRound(startHole);
}
$('play').addEventListener('click', () => { if (G.room) leaveRoom(); beginPlay(); });
$('name').addEventListener('keydown', e => { if (e.key === 'Enter') (G.room ? $('roomStart') : $('play')).click(); });

async function endRound() {
  G.mode = 'end';
  $('between').classList.add('hidden'); $('powerChip').classList.add('hidden'); document.body.classList.remove('between', 'waiting');
  if (G.room) { roomSendProgress(); G.room.inRound = false; }
  if (document.pointerLockElement) document.exitPointerLock();
  const total = G.holeScores.reduce((s, v) => s + v, 0);
  const ghostTotal = G.ghostScores.reduce((s, v) => s + v, 0);
  const diff = total - TOTAL_PAR;
  // save the new ghost if this beat the old one
  let newGhost = false;
  if (!G.usedGimme && (!pbGhost || total < pbGhost.total)) {
    try {
      const holes = G.roundRec.map(hs => hs.map(r => r.pen ? r : { sx: r.sx, sy: r.sy, sz: r.sz, holed: r.holed, res: r.res, f: r.f }));
      store.set('ghg3d_pb', JSON.stringify({ total, name: G.playerName, holes, decks: HOLES.map((_, i) => holeAt(i).deckIdx ?? null) }));
      newGhost = true;
    } catch { /* storage full or unavailable */ }
  }
  const rows = HOLES.map((h, i) => {
    const me = G.holeScores[i], gh = G.ghostScores[i], d = me - h.par;
    return `<tr><td>${i + 1}</td><td>${h.par}</td><td class="${d < 0 ? 'under' : d > 0 ? 'over' : ''}">${me}</td>${G.room ? '' : `<td>${gh}</td>`}</tr>`;
  }).join('');
  const st = G.stats;
  const ghostName = G.ghostSource === 'pb' ? 'your old ghost' : 'Old Tom';
  const beat = G.room ? `Room ${G.room.code}` : total < ghostTotal ? `You beat ${ghostName} by ${ghostTotal - total}!` : total === ghostTotal ? `Dead level with ${ghostName}.` : `${G.ghostSource === 'pb' ? 'Your old ghost' : 'Old Tom'} won by ${total - ghostTotal}.`;
  const ghostNote = G.room ? '' : total <= (G.tomTotal ?? 99) && newGhost ? '<br><b>Your round is the new ghost to beat.</b>'
    : total > (G.tomTotal ?? 99) ? `<br>Beat Old Tom's ${G.tomTotal} and your own ghost becomes the rival.` : '';
  const tiles = [
    [st.longestDrive, st.longestDrive + ' m', 'longest drive'], [st.gooseThefts, st.gooseThefts, 'goose thefts'], [st.gooseHits, st.gooseHits, 'geese bonked'],
    [st.ghostHits, st.ghostHits, 'ghost collisions'], [st.ballsLost, st.ballsLost, 'balls lost'], [st.ballsSaved, st.ballsSaved, 'balls fished out'],
    [st.tugWins, st.tugWins, 'geese out-pulled'], [st.tugLosses, st.tugLosses, 'tugs lost to geese'], [st.bulletCams, st.bulletCams, 'bullet cams'], [st.called, st.called, 'called it'], [st.pure, st.pure, 'pure strikes'], [graveyard().length, graveyard().length, 'in the graveyard'],
  ].filter(t => t[0]).slice(0, 6);
  const moment = G.stats.moment ? `<div class="sub">⭐ Moment of the round: <b>${esc(G.stats.moment.text)}</b></div>` : '';
  // Solo: the essentials only (playtest: "very wordy"). Rooms keep the full card.
  if (!G.room) {
    const fmt = d => d === 0 ? 'E' : d > 0 ? '+' + d : String(d);
    const cell = (v, par) => `<td class="${v < par ? 'under' : v > par ? 'over' : ''}">${v ?? '–'}</td>`;
    const line = G.stats.moment ? `<div class="sub">⭐ ${esc(G.stats.moment.text)}</div>` : '';
    $('endBody').innerHTML = `
    <div class="big">${total} <small style="font-size:24px">${fmt(diff)}</small></div>
    <div class="sub"><b>${esc(beat)}</b></div>
    <table class="sc wide">
      <tr><th>Hole</th>${HOLES.map((_, i) => `<th>${i + 1}</th>`).join('')}<th>Tot</th></tr>
      <tr><td>Par</td>${HOLES.map(h => `<td>${h.par}</td>`).join('')}<td>${TOTAL_PAR}</td></tr>
      <tr><td>You</td>${HOLES.map((h, i) => cell(G.holeScores[i], h.par)).join('')}<td><b>${total}</b></td></tr>
      <tr><td>👻</td>${HOLES.map((h, i) => `<td>${G.ghostScores[i] ?? '–'}</td>`).join('')}<td>${ghostTotal}</td></tr>
    </table>
    ${line}
    <button class="go" id="again">Play again ⛳</button>
    <button class="alt" id="share">Copy result</button> <span id="shareMsg"></span>`;
  } else $('endBody').innerHTML = `
    <h2>${diff < 0 ? 'Under par!' : diff === 0 ? 'Level par' : 'Round complete'}</h2>
    <div class="big">${total}</div>
    <div class="sub">${diff === 0 ? 'E' : diff > 0 ? '+' + diff : diff} · ${esc(beat)}${ghostNote}</div>
    ${moment}
    ${G.room ? '<h4 style="margin-top:12px">Room standings</h4><ol class="standings" id="roomFinal"></ol><div class="sub" id="roomFinalNote"></div>' : ''}
    <table class="sc"><tr><th>Hole</th><th>Par</th><th>You</th>${G.room ? '' : '<th>👻</th>'}</tr>${rows}
    <tr><th>Total</th><th>${TOTAL_PAR}</th><th>${total}</th>${G.room ? '' : `<th>${ghostTotal}</th>`}</tr></table>
    ${tiles.length ? `<div class="stats">${tiles.map(t => `<div><b>${t[1]}</b>${t[2]}</div>`).join('')}</div>` : ''}
    ${st.junk.length ? `<div class="sub">Fished out: ${st.junk.map(esc).join(', ')}</div>` : ''}
    <div class="boards"><div><h4>Today</h4><ol id="bToday"><li>loading…</li></ol></div><div><h4>All-time</h4><ol id="bAll"><li>loading…</li></ol></div></div>
    <button class="go" id="again">${G.room ? 'Back to the room 👥' : 'Play again ⛳'}</button>
    <button class="alt" id="share">Copy result</button> <span id="shareMsg"></span>`;
  $('end').classList.remove('hidden');
  $('again').addEventListener('click', () => {
    $('end').classList.add('hidden');
    if (G.room) { showTitle(); openRoomPanel(); return; }
    startRound(); lockPointer();
  });
  if (G.room) renderRoomFinal();
  $('share').addEventListener('click', async () => {
    const t = `⛳ Golden Hour Golf 3D: ${total} (${diff === 0 ? 'E' : diff > 0 ? '+' + diff : diff}) · ${beat} · 🪿×${st.gooseThefts} ✝×${st.ballsLost}\n${location.origin}`;
    try { await navigator.clipboard.writeText(t); $('shareMsg').textContent = 'Copied!'; } catch { $('shareMsg').textContent = t; }
  });
  let data = null;
  const complete = HOLES.every((_, i) => Number.isInteger(G.holeScores[i]) && G.holeScores[i] > 0) && G.roundRec.length === HOLES.length;
  if (!complete) { renderBoard('bToday', null); renderBoard('bAll', null); return; }   // (solo has no boards on the card: the 🏆 button has them)
  try {
    const r = await fetch('/api/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: G.playerName, strokes: total }) });
    if (r.ok) data = await r.json();
  } catch { /* offline */ }
  renderBoard('bToday', data?.today); renderBoard('bAll', data?.allTime);
}
function renderBoard(id, rows) {
  const el = $(id); if (!el) return;
  if (!rows) { el.innerHTML = '<li>offline</li>'; return; }
  if (!rows.length) { el.innerHTML = '<li>be the first!</li>'; return; }
  el.innerHTML = rows.map((s, i) => `<li class="${s.name === G.playerName ? 'me' : ''}"><span>${i + 1}. ${esc(s.name)}</span><b>${Number(s.strokes) | 0}</b></li>`).join('');
}
$('lbBtn').addEventListener('click', async () => {
  $('lb').classList.remove('hidden');
  $('lbBoards').innerHTML = '<div><h4>Today</h4><ol id="lbT"><li>loading…</li></ol></div><div><h4>All-time</h4><ol id="lbA"><li>loading…</li></ol></div>';
  try { const r = await fetch('/api/leaderboard'); const d = await r.json(); renderBoard('lbT', d.today); renderBoard('lbA', d.allTime); }
  catch { renderBoard('lbT', null); renderBoard('lbA', null); }
});
$('lbClose').addEventListener('click', () => $('lb').classList.add('hidden'));

// ------------------------------------------------- record strokes for the PB ghost
// 120 Hz sim frames -> 30 Hz centimetre ints (about 4 KB of JSON for a drive)
function encodeFrames(sim) {
  const f = [];
  for (let i = 0; i < sim.n; i += 4) f.push(Math.round(sim.frames[i * 3] * 100), Math.round(sim.frames[i * 3 + 1] * 100), Math.round(sim.frames[i * 3 + 2] * 100));
  const li = sim.n - 1;
  if (li % 4) f.push(Math.round(sim.frames[li * 3] * 100), Math.round(sim.frames[li * 3 + 1] * 100), Math.round(sim.frames[li * 3 + 2] * 100));
  return f;
}
function recordStroke(start, sim) {
  const rec = G.roundRec[G.holeIdx] ?? (G.roundRec[G.holeIdx] = []);
  const f = encodeFrames(sim);
  rec.push({ sx: start.x, sy: start.y, sz: start.z, holed: sim.result === 'holed', res: sim.result, f });
  if (sim.result === 'water' || sim.result === 'oob') rec.push({ pen: true, sx: start.x, sy: start.y, sz: start.z });
}

// ============================================================ live feed (SSE)
const CLIENT_ID = Math.random().toString(36).slice(2) + Date.now().toString(36);
function connectLive() {
  let es; try { es = new EventSource('/api/events'); } catch { return; }
  es.addEventListener('holeout', ev => {
    let d; try { d = JSON.parse(ev.data); } catch { return; }
    if (!d || d.id === CLIENT_ID || typeof d.name !== 'string') return;
    if (G.room && [...rivals.values()].some(r => r.name === d.name)) return;
    const par = HOLES[d.hole - 1]?.par; if (!par) return;
    const diff = d.strokes - par;
    const verb = d.strokes === 1 ? 'aced' : diff <= -2 ? 'eagled' : diff === -1 ? 'birdied' : diff === 0 ? 'parred' : null;
    // other people's rounds wait for the between-hole card (fewer pop-ups mid-shot)
    (G.elsewhere ??= []).push(verb ? `<b>${esc(d.name)}</b> ${verb} hole ${d.hole}` : `<b>${esc(d.name)}</b> finished hole ${d.hole} in ${d.strokes}`);
    G.elsewhere = G.elsewhere.slice(-2);
  });
}
function broadcastHole(hole, strokes) {
  fetch('/api/hole', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: CLIENT_ID, name: G.playerName, hole, strokes }) }).catch(() => {});
}

// ============================================================ main loop
let fpsAcc = 0, fpsN = 0; G.fps = 60;
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now() / 1000;
  const rawDt = now - G.tLast;
  const dt = Math.min(0.05, rawDt); G.tLast = now; G.time += dt;
  fpsAcc += rawDt; fpsN++;
  if (fpsAcc > 1) {
    G.fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0;
    // adaptive quality: step the resolution down while we're under ~45 fps
    if (!document.hidden && G.mode !== 'title') {
      G.slowSecs = G.fps < 45 ? (G.slowSecs ?? 0) + 1 : 0;
      if (G.slowSecs >= 3 && renderer.getPixelRatio() > 0.75) {
        renderer.setPixelRatio(Math.max(0.75, renderer.getPixelRatio() - 0.25)); resize(); G.slowSecs = 0;
        if (renderer.getPixelRatio() <= 1) { renderer.shadowMap.type = THREE.PCFShadowMap; }
      }
    }
  }
  if (G.course) {
    keyAim(dt);
    if (G.shot) updateShot(dt);
    if (G.ghostSolo && !G.shot) updateGhostSolo(dt);
    if (G.ghostGlide) updateGhostGlide(dt);
    if (G.mode === 'scare') runScare(dt);
    else if (G.mode === 'flyover') updateFlyover(dt);
    else if (G.mode === 'walk' && G.walk) updateWalk(dt);
    else if (G.shot && G.flightCam) updateFlightCam(dt);
    else if (G.mode === 'angler') {
      const lk = G.anglerLook, dk = angler.dock;
      const want = dk ? new THREE.Vector3(dk.stand.x, Math.max(dk.level + 0.35, G.course.h(dk.land.x, dk.land.z) + 0.15) + 1.55, dk.stand.z) : new THREE.Vector3(lk.x - fwd(G.yaw).x * 9, lk.y + 4, lk.z - fwd(G.yaw).z * 9);
      camera.position.lerp(want, 1 - Math.exp(-dt * (dk ? 6 : 2))); G.camLook.lerp(lk, 1 - Math.exp(-dt * 4)); camera.lookAt(G.camLook);
      updateAngler(dt);
      W.updateRod(rod, camera, lk, G.time, angler.tension, angler.progress);
      if (Math.random() < dt * 3) burst(lk.x, lk.y + 0.05, lk.z, 4, 0xdff4ff, { speed: 0.8, up: 1.2, life: 0.6 });
    } else if (G.mode === 'holed' && G.crown) {
      // the crown ceremony: pull back behind the cup and look up past the mesa,
      // toward the moon, where the fireworks burst and the geese fly
      G.celebrate -= dt; G.crown.t += dt;
      const a = G.crown.away, cy = G.course.h(G.cup.x, G.cup.z);
      const pos = new THREE.Vector3(G.cup.x - a.x * 16, cy + 5, G.cup.z - a.z * 16);
      const look = new THREE.Vector3(G.cup.x + a.x * 30, cy + 9 + Math.min(1, G.crown.t / 3) * 6, G.cup.z + a.z * 30);
      camera.position.lerp(pos, 1 - Math.exp(-dt * 1.6)); G.camLook.lerp(look, 1 - Math.exp(-dt * 2)); camera.lookAt(G.camLook);
      if (G.celebrate <= 0) afterHole();
    } else if (G.mode === 'holed') {
      G.celebrate -= dt;
      const c = new THREE.Vector3(G.cup.x, G.course.h(G.cup.x, G.cup.z), G.cup.z);
      G.camLook.lerp(c, 1 - Math.exp(-dt * 3)); camera.lookAt(G.camLook);
      if (G.celebrate <= 0) afterHole();
    } else if (G.mode === 'linger' && G.linger) {
      updateLinger(dt);
    } else if (G.mode === 'sasquack' && G.sasq) {
      updateSasquack(dt);
    } else if (G.mode === 'between') {
      updateBetween(dt);
    } else if ((G.mode === 'gooseCam' || G.mode === 'tug') && G.gooseCam) {
      updateGooseCam(dt, G.mode === 'tug');
      updateTug(dt);
    } else if (G.mode === 'gooseFetch') {
      const gp = new THREE.Vector3(goose.x, G.course.h(goose.x, goose.z) + 0.6, goose.z);
      const a = addressCam(); camera.position.lerp(a.pos, 1 - Math.exp(-dt * 3));
      G.camLook.lerp(gp, 1 - Math.exp(-dt * 4)); camera.lookAt(G.camLook);
    } else if (G.mode === 'address' || G.mode === 'wheel' || G.mode === 'title') updateAddressCam(dt);
    updateWheel(dt);
    updateIdleHint(dt);
    if (!G.shot || G.shot.kind === 'shoo') ballMesh.position.set(G.ball.x, G.ball.y, G.ball.z);
    // camera shake
    if (G.shake > 0) {
      camera.position.x += (Math.random() - 0.5) * G.shake * 0.25;
      camera.position.y += (Math.random() - 0.5) * G.shake * 0.25;
      G.shake = Math.max(0, G.shake - dt * 1.5);
    }
    updateGeese(dt);
    updateRelay(dt); updateBrood(dt); updateHammer(dt); updateAdoptee(dt);
    updateWindmill(dt);
    updateAura(dt);
    updatePins(dt);
    updateFinalGroup();
    updatePuppets(dt);
    updateFans(dt);
    applyKnockQ();
    if (G.mode === 'address' && G.prevMode !== 'address') G.addressAt = performance.now();
    G.prevMode = G.mode;
    updateReactBar();
    renderBallChoose();
    updateOldTom(dt);
    updateAvatar(dt);
    updateClub(dt);
    updateBallFace(dt);
    ballAnim(dt);
    updateCarryIndicator(dt);
    updateScope(dt);
    updatePreview();
    updateParticles(dt);
    W.waveFlag(G.flag, G.time, G.wind);
    W.treeTime.value = G.time * (0.6 + Math.min(1.5, Math.hypot(G.wind.x, G.wind.z) / 5));
    G.flag.userData.beacon.material.opacity = G.scoped ? 0.05 : 0.18;
    const pinPos = new THREE.Vector3(G.cup.x, G.course.h(G.cup.x, G.cup.z) + 2.6, G.cup.z);
    const pd = camera.position.distanceTo(pinPos);
    pinLabel.visible = G.mode !== 'title' && pd > 35 && !G.scoped;
    if (pinLabel.visible) {
      const t = `⛳ ${dist2(G.ball, G.cup).toFixed(0)} m`;
      if (pinLabel.userData.text !== t) { pinLabel.userData.text = t; const nl = W.buildLabel(t, '#fff', 'rgba(220,40,60,0.8)'); pinLabel.material.map.dispose(); pinLabel.material.dispose(); pinLabel.material = nl.material; }
      scaleLabel(pinLabel, pinPos, 0.6, 0.04);
      pinLabel.position.y += pinLabel.scale.y * 1.6;   // sit above the goose label when they line up
      if (aimLabel.visible) unstackLabels(aimLabel, pinLabel);
    }
    const onGreen = ['green', 'fringe'].includes(G.course.surf(G.ball.x, G.ball.z)) && (G.mode === 'address');
    G.slope.visible = onGreen;
    if (onGreen) G.slope.material.opacity = 0.5 + 0.2 * Math.sin(G.time * 3);
    // labels + glow
    updateRivals(dt);
    ghostMesh.visible = G.mode !== 'title' && !G.room && G.holeDef.spotlight !== 'scare';
    // Old Tom's ghost ball is part of the show (playtest: "see the ghost more"):
    // a bright soul ball, a halo that grows with distance, and his name above it
    const gHalo = ghostMesh.children[0], gdist = camera.position.distanceTo(ghostMesh.position);
    if (gHalo) { gHalo.material.opacity = clamp(0.3 + gdist / 60, 0.3, 0.7); gHalo.scale.setScalar(R * 4.5 * Math.max(1, gdist * 0.05)); }
    ghostTag.visible = ghostMesh.visible && G.ghostSource === 'oldtom' && gdist > 5 && ['address', 'flight', 'walk', 'linger'].includes(G.mode);
    if (ghostTag.visible) { const k = Math.max(0.6, gdist * 0.06); ghostTag.position.set(ghostMesh.position.x, ghostMesh.position.y + 0.35 + k * 0.35, ghostMesh.position.z); ghostTag.scale.set(k * 1.6, k * 0.4, 1); }
    const bd = camera.position.distanceTo(ballMesh.position);
    ballGlow.position.copy(ballMesh.position);
    ballGlow.scale.setScalar(Math.max(0.4, bd * 0.03));
    ballGlow.visible = ballMesh.visible && bd > 14;
    ballGlow.material.opacity = clamp((bd - 14) / 30, 0, 0.8);
    env.follow(G.shot ? new THREE.Vector3().copy(ballMesh.position) : new THREE.Vector3(G.ball.x, G.ball.y, G.ball.z));
    if (G.mode === 'address' && Math.random() < dt * 0.5) updateHUD();
    if (G.mode === 'address' || G.mode === 'walk') {
      // the booth calms down between shots, but only as far as the round lets it
      const over = Math.max(0, G.strokes - G.holeDef.par + 1), roundOver = Math.max(0, G.holeScores.reduce((s, v, i) => s + v - HOLES[i].par, 0));
      const floor = Math.min(70, over * 14 + roundOver * 5);
      if (commentator.hysteria > floor) bumpHysteria(-Math.min(dt * 0.8, commentator.hysteria - floor));
    }
    if (G.holeDef.spotlight === 'scare' && !G.scareDone && commentator.hysteria > 33) commentator.hysteria = 33;   // the graveyard hush
  }
  renderer.render(scene, camera);
}

// ============================================================ multiplayer rooms
// Each player simulates their own shots; the room relays the recorded frames.
// A rival's shot on your hole plays back the moment it arrives (one network
// hop behind them, so you watch it fly together), and their resting ball is
// solid in your world. Standings are golf-style: to par over completed holes.
const ROOM_COLORS = ['#ff7aa8', '#5fd3ff', '#ffc84a', '#4fd39a', '#c79bff', '#ff9a3c', '#f4f4f4', '#a0e060'];
const rivals = new Map();   // member id -> { mesh, label, trail, prog, playing, ... }
const fmtPar = v => v === 0 ? 'E' : v > 0 ? `+${v}` : `−${-v}`;
const ordinal = n => n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');

function rivalFor(m) {
  let r = rivals.get(m.id);
  if (!r) {
    const hex = ROOM_COLORS[m.color % ROOM_COLORS.length], col = new THREE.Color(hex).getHex();
    const mesh = W.buildBall(col, true); mesh.scale.setScalar(GHOST_R / R); mesh.visible = false; scene.add(mesh);
    const trail = makeTrail(new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.6, depthWrite: false }));
    r = { id: m.id, hex, mesh, trail, label: null, labelName: '', prog: null, playing: null, online: true, scoresSeen: 0 };
    rivals.set(m.id, r);
  }
  r.name = m.name; r.online = m.online; r.color = m.color;
  if (r.labelName !== m.name) {
    if (r.label) { scene.remove(r.label); r.label.material.map?.dispose(); r.label.material.dispose(); }
    r.label = W.buildLabel(m.name, r.hex); r.label.visible = false; scene.add(r.label); r.labelName = m.name;
  }
  return r;
}
function dropRival(id) {
  const r = rivals.get(id); if (!r) return;
  if (r.avatar) scene.remove(r.avatar);
  scene.remove(r.mesh, r.trail); r.trail.geometry.dispose(); r.trail.material.dispose();
  if (r.label) { scene.remove(r.label); r.label.material.map?.dispose(); r.label.material.dispose(); }
  rivals.delete(id);
}
function resetRivalsForRound() {
  G.room.seen = new Set(); G.room.lastPos = null;
  for (const r of rivals.values()) { r.playing = null; r.trail.geometry.setDrawRange(0, 0); }
}
// Rivals only count when they're playing the same round as us.
const sameRound = () => G.room && !G.room.closed && G.room.playingRound === G.room.round;
function rivalPos(r) {
  if (!sameRound() || !G.room.inRound) return null;
  if (r.playing) return r.playing.pos;
  const p = r.prog;
  if (!p || p.hole !== G.holeIdx + 1 || p.holed || !p.rest) return null;
  return p.rest;
}
function closestRival() {
  if (!G.room) return null;
  const rows = standings(), me = rows.find(x => x.me);
  let best = null;
  for (const x of rows) if (!x.me && (!best || Math.abs(x.toPar - me.toPar) < Math.abs(best.toPar - me.toPar))) best = x;
  return best;
}
function rivalColliders(lie) {
  const out = [];
  for (const r of rivals.values()) {
    if (r.playing) continue;
    const p = rivalPos(r);
    if (!p || Math.hypot(p.x - lie.x, p.z - lie.z) < 0.3 || Math.hypot(p.x - G.cup.x, p.z - G.cup.z) < 0.15 + GHOST_R) continue;
    out.push({ kind: 'sphere', x: p.x, y: p.y, z: p.z, r: GHOST_R, e: 0.9, tag: 'rival:' + r.id, push: true });
  }
  return out;
}
function checkRivalStymie() {
  const ax = G.cup.x - G.ball.x, az = G.cup.z - G.ball.z, L = Math.hypot(ax, az);
  if (L < 1) return;
  for (const r of rivals.values()) {
    const p = !r.playing && rivalPos(r); if (!p) continue;
    const t = ((p.x - G.ball.x) * ax + (p.z - G.ball.z) * az) / (L * L);
    if (t <= 0.02 || t >= 0.98) continue;
    const off = Math.abs((p.x - G.ball.x) * az - (p.z - G.ball.z) * ax) / L;
    if (off >= 0.65) continue;
    G.stymieTold = true;
    const full = off < GHOST_R + R + 0.04;
    sfx.stymie(); say('roomStymie', { ...vars(), rival: r.name }, { bump: 6 });
    hud.banner(`${full ? 'STYMIED' : 'HALF-STYMIE'}<small>${esc(r.name)}'s ball is ${full ? 'right on' : 'crowding'} your line</small>`, 2200);
    hud.hint(`${esc(r.name)}'s ball blocks. Go around.`, 7000);
    return;
  }
}
function finishRivalShot(r, silent) {
  const pl = r.playing; if (!pl) return;
  r.playing = null;
  if (pl.knock && r.prog) {
    // until their own progress arrives, show the ball where the knock left it
    const e = frameAt(pl.shot, pl.shot.n - 1);
    r.prog = { ...r.prog, rest: pl.shot.result === 'holed' ? null : { x: e.x, y: e.y, z: e.z }, holed: pl.shot.result === 'holed' };
  }
  if (silent) return;
  const end = frameAt(pl.shot, pl.shot.n - 1);
  const col = new THREE.Color(r.hex).getHex();
  if (pl.shot.result === 'holed') { sfx.tick(); burst(G.cup.x, G.course.h(G.cup.x, G.cup.z) + 0.25, G.cup.z, 24, col, { speed: 1.6, up: 2.4, life: 1.1, grav: 2 }); }
  else if (pl.shot.result === 'water') burst(end.x, end.y, end.z, 26, 0xbfe6ff, { speed: 2, up: 4, life: 1 });
}
function updateRivals(dt) {
  const show = G.room && G.room.inRound && !['title', 'end'].includes(G.mode);
  for (const r of rivals.values()) {
    if (r.knock?.by && (!r.knock.by.playing || r.knock.by.playing.t >= r.knock.at)) startKnockAnim(r, r.knock);
    const pl = r.playing;
    if (pl) {
      // real time while airborne; a long roll-out is compressed a little, like ours
      const remain = (pl.shot.n - 1 - pl.t) / FPS;
      const sp = pl.t > 2 * FPS ? clamp(remain / 2.5, 1, 2.5) : 1;
      pl.t = Math.min(pl.shot.n - 1, pl.t + dt * FPS * sp * G.timeScale);
      pl.pos = frameAt(pl.shot, Math.floor(pl.t));
      fillTrail(r.trail, pl.shot, pl.t);
      if (pl.t >= pl.shot.n - 1) finishRivalShot(r);
    }
    const p = show ? rivalPos(r) : null;
    updateRivalAvatar(r, p, dt);
    r.mesh.visible = !!p;
    r.trail.visible = !!show;
    if (!p) { if (r.label) r.label.visible = false; continue; }
    let x = p.x, y = p.y, z = p.z;
    // sharing your lie (both on the tee): stand them politely to one side
    if (!r.playing && Math.hypot(x - G.ball.x, z - G.ball.z) < 0.4) {
      const f = fwd(G.yaw), k = 0.55 * (1 + (r.color % 3));
      x += f.z * k; z -= f.x * k; y = G.course.h(x, z) + R;
    }
    r.mesh.position.set(x, y, z);
    const halo = r.mesh.children[0];
    if (halo) halo.material.opacity = clamp((camera.position.distanceTo(r.mesh.position) - 3) / 10, 0.05, 0.35);
    if (r.label) { scaleLabel(r.label, r.mesh.position, 0.4, 0.035); r.label.visible = camera.position.distanceTo(r.mesh.position) > 6; }
    if (r.bubble) {
      if (performance.now() > r.bubbleUntil) { scene.remove(r.bubble); r.bubble = null; }
      else scaleLabel(r.bubble, r.mesh.position, 1.2, 0.045);
    }
  }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) for (const r of rivals.values()) if (r.playing) finishRivalShot(r, true); });

function standings() {
  const par = i => HOLES[i]?.par ?? 0;
  const myScores = G.holeScores.filter(Number.isInteger);
  const rows = [{ id: G.room?.me, me: true, name: G.playerName, hex: ROOM_COLORS[(G.room?.myColor ?? 2) % ROOM_COLORS.length], scores: myScores, hole: G.holeIdx + 1, done: G.mode === 'end' || myScores.length === HOLES.length, online: true }];
  if (sameRound()) for (const r of rivals.values()) {
    const p = r.prog ?? {};
    rows.push({ id: r.id, name: r.name, hex: r.hex, scores: Array.isArray(p.scores) ? p.scores : [], hole: p.hole ?? 0, done: !!p.done, online: r.online, idle: isIdle(r) });
  }
  for (const x of rows) { x.toPar = x.scores.reduce((s, v, i) => s + v - par(i), 0); x.thru = x.scores.length; x.total = x.scores.reduce((a, b) => a + b, 0); }
  // (round 8, S8) finished cards first, then everyone still out there by to-par
  // and how far they've got: "+5 thru 4" never outranks a finished round
  rows.sort((a, b) => (b.done - a.done) || a.toPar - b.toPar || b.thru - a.thru || (a.me ? -1 : b.me ? 1 : 0));
  rows.forEach((x, i) => { const y = rows[i - 1]; x.pos = y && y.done === x.done && y.toPar === x.toPar && (x.done || y.thru === x.thru) ? y.pos : i + 1; });
  for (const x of rows) x.tie = rows.filter(y => y.pos === x.pos).length > 1;
  return rows;
}
const thruTxt = x => x.done ? 'F' : x.thru ? `thru ${x.thru}` : x.hole ? `on ${x.hole}` : '—';
function updateRoomRace() {
  if (!G.room || !G.holeDef) return;
  const rows = standings(), me = rows.find(x => x.me);
  // (round 8, S15) a lead call compares two cards only over the holes both have
  // finished, and only when that shared stretch grows: no "moves past" a
  // friend who is three holes behind
  const cmp = (G.room.cmp ??= new Map());
  let call = null;
  if (G.room.inRound) for (const x of rows) {
    if (x.me) continue;
    const n = Math.min(me.thru, x.thru), d = toParThru(me.scores, n) - toParThru(x.scores, n);   // >0: I'm behind
    const was = cmp.get(x.id);
    cmp.set(x.id, { n, d });
    if (!was || n <= was.n || n === 0) continue;
    const s0 = Math.sign(was.d), s1 = Math.sign(d);
    if (s0 === s1) continue;
    const c = s1 < 0 && s0 > 0 ? 'roomOvertake' : s1 === 0 ? 'roomLevel' : s1 > 0 && s0 <= 0 ? 'roomFallBehind' : s1 < 0 ? 'roomOvertake' : null;
    if (c && (!call || c === 'roomOvertake')) call = { c, name: x.name };
  }
  if (call?.c === 'roomOvertake') { sfx.overtake(); say('roomOvertake', { ...vars(), rival: call.name }, { bump: -6 }); }
  else if (call?.c === 'roomLevel') { sfx.tick(); say('roomLevel', { ...vars(), rival: call.name }, { bump: -3 }); }
  else if (call?.c === 'roomFallBehind') { sfx.fallBehind(); setTimeout(() => say('roomFallBehind', { ...vars(), rival: call.name }, { bump: 6 }), 1200); }
  G.room.lastPos = me.pos;
  // standings live on the between-hole card and the end card, not the HUD
  if (G.mode === 'between') renderBetween();
  if (G.mode === 'end') renderRoomFinal();
}
function renderRoomFinal() {
  const el = $('roomFinal'); if (!el || !G.room) return;
  const rows = standings();
  el.innerHTML = rows.map(x => `<li class="${x.me ? 'me' : ''}${x.online ? '' : ' off'}"><span class="dot" style="background:${x.hex}"></span>${x.tie ? 'T' : ''}${x.pos}. ${esc(x.name)}${x.idle ? ' 💤' : x.online ? '' : ' 📴'}<b>${fmtPar(x.toPar)}</b><small>${x.done ? `${x.total} strokes` : thruTxt(x)}</small></li>`).join('');
  const waiting = rows.filter(x => !x.done && x.online).length, out = rows.filter(x => !x.done).length;
  const me = rows.find(x => x.me);
  // a place is only ever read off this same list, among the finished cards
  $('roomFinalNote').textContent = rows.length === 1 ? 'Nobody else finished this round.'
    : waiting ? `Waiting on ${waiting} player${waiting === 1 ? '' : 's'}…`
    : me.pos === 1 ? (me.tie ? 'A shared victory. Insufferable, all of you.' : out ? 'Top of the finished cards! 🏆' : 'You won the room! 🏆')
    : `${ordinal(me.pos)} place. There's always next round.`;
}

// ---- sending
function roomProgress(extra = {}) {
  if (!G.room?.inRound || !sameRound()) return null;
  const holed = G.mode === 'holed' || G.mode === 'end';
  return {
    hole: G.holeIdx + 1, strokes: G.strokes, scores: G.holeScores.filter(Number.isInteger),
    rest: holed ? null : { x: G.ball.x, y: G.ball.y, z: G.ball.z }, holed, done: G.mode === 'end', ball: bag().name, char: charId(), ...extra,
  };
}
function roomSendProgress() {
  const p = roomProgress(); if (!p) return;
  G.room.client.send({ type: 'progress', round: G.room.playingRound, progress: p });
  updateRoomRace();
}
function roomSendShot(start, sim, clubId, wmP) {
  const p = roomProgress({ rest: sim.result === 'rest' ? { x: sim.end.x, y: sim.end.y, z: sim.end.z } : null, holed: sim.result === 'holed' });
  if (!p) return;
  G.room.client.send({ type: 'shot', round: G.room.playingRound, hole: G.holeIdx + 1, stroke: G.strokes, start: { x: start.x, y: start.y, z: start.z }, res: sim.result, club: clubId, f: encodeFrames(sim), wm: Math.round((wmP ?? 0) * 1000), progress: p });
}

// ---- receiving
function onRoomState(st) {
  if (!G.room) return;
  Object.assign(G.room, { code: st.code, hostId: st.hostId, started: st.started, round: st.round, seed: st.seed, members: st.members });
  const ids = new Set();
  for (const m of st.members) {
    if (m.id === G.room.me) { G.room.myColor = m.color; continue; }
    ids.add(m.id);
    const r = rivalFor(m);
    r.prog = m.progress; r.scoresSeen = m.progress?.scores?.length ?? 0;
  }
  for (const id of [...rivals.keys()]) if (!ids.has(id)) dropRival(id);
  renderLobby();
  updateRoomRace();
}
function onRoomShot(ev) {
  if (!G.room || ev.round !== G.room.round) return;
  const key = `${ev.from}:${ev.round}:${ev.hole}:${ev.stroke}`;
  if (G.room.seen.has(key)) return;
  G.room.seen.add(key);
  const r = rivals.get(ev.from); if (!r) return;
  r.activeAt = performance.now();
  if (ev.progress) r.prog = ev.progress;
  if (sameRound() && G.room.inRound && ev.hole === G.holeIdx + 1 && Array.isArray(ev.f) && ev.f.length >= 3) {
    if (r.playing) finishRivalShot(r, true);
    const { frames, n } = decodeFrames(ev.f);
    r.playing = { shot: { frames, n, result: ev.res }, t: 0, stroke: ev.stroke, pos: { x: frames[0], y: frames[1], z: frames[2] }, wm: typeof ev.wm === 'number' ? ev.wm / 1000 : undefined };
    if (dist2(r.playing.pos, G.ball) < 40) sfx.strike(false, ev.club);   // you hear a friend's shot nearby
  }
  updateRoomRace();
}
function onRoomProgress(ev) {
  if (!G.room || ev.round !== G.room.round) return;
  const r = rivals.get(ev.from); if (!r) return;
  r.prog = ev.progress; r.activeAt = performance.now();
  const sc = ev.progress?.scores ?? [];
  if (sc.length > r.scoresSeen && sameRound() && G.room.inRound) {
    const hole = sc.length, strokes = sc[hole - 1], par = HOLES[hole - 1]?.par;
    if (par) {
      const diff = strokes - par;
      const verb = strokes === 1 ? 'ACED' : diff <= -2 ? 'eagled' : diff === -1 ? 'birdied' : diff === 0 ? 'parred' : diff === 1 ? 'bogeyed' : null;
      hud.toast(`<span style="color:${r.hex}">●</span> <b>${esc(r.name)}</b> ${verb ? `${verb} hole ${hole}` : `took ${strokes} on hole ${hole}`}`);
      if (hole === G.holeIdx + 1 || diff <= -1) say('rivalHoled', { ...vars(), rival: r.name }, { bump: diff <= -1 ? 5 : 2 });
    }
  }
  r.scoresSeen = sc.length;
  updateRoomRace();
}
function onRoomStart(ev) {
  if (!G.room) return;
  G.room.round = ev.round; G.room.seed = ev.seed; G.room.started = true;
  if (G.room.inRound && G.room.playingRound === ev.round) return;   // already playing it (host got the reply first)
  if (G.room.inRound) { hud.toast(`The host started round ${ev.round}. Finish up, then head back to the room.`); return; }
  G.room.joinInProgress = false;
  beginRoomRound();
}
function beginRoomRound() {
  // joining a round in progress: start on the hole the slowest player is on
  const others = [...rivals.values()].filter(r => r.online && r.prog && r.prog.hole > 0 && !r.prog.done);
  const joining = G.room.inRound === false && G.room.playingRound !== G.room.round && G.room.joinInProgress;
  G.room.playingRound = G.room.round; G.room.inRound = true;
  for (const r of rivals.values()) r.scoresSeen = r.prog?.scores?.length ?? 0;
  let start = 0;
  if (joining && others.length) start = clamp(Math.min(...others.map(r => r.prog.scores?.length ?? 0)), 0, HOLES.length - 1);
  beginPlay(start);
}

// ---- lobby UI
function showTitle() {
  G.mode = 'title';
  $('hud').classList.add('hidden'); touchSwing.classList.add('hidden'); $('touchScope').classList.add('hidden');
  $('title').classList.remove('hidden');
}
function roomErr(t) { $('roomErr').textContent = t || ''; }
function openRoomPanel() {
  $('roomPanel').classList.remove('hidden'); $('roomBtn').classList.add('hidden');
  renderLobby();
}
function renderLobby() {
  const inRoom = !!G.room;
  $('roomJoin').classList.toggle('hidden', inRoom);
  $('roomLobby').classList.toggle('hidden', !inRoom);
  $('play').textContent = inRoom ? 'Leave and play solo' : 'Tee off ⛳';
  $('play').classList.toggle('go', !inRoom); $('play').classList.toggle('alt', inRoom);
  if (!inRoom) return;
  $('roomCodeShow').textContent = G.room.code;
  $('roomMembers').innerHTML = (G.room.members ?? []).map(m => `<li class="${m.online ? '' : 'off'}"><span class="dot" style="background:${ROOM_COLORS[m.color % ROOM_COLORS.length]}"></span>${esc(m.name)}${m.id === G.room.me ? ' (you)' : ''}${m.host ? ' 👑' : ''}${m.online ? '' : ' · away'}</li>`).join('');
  const host = G.room.hostId === G.room.me;
  const joinable = G.room.started && G.room.playingRound !== G.room.round;
  const btn = $('roomStart');
  btn.classList.toggle('hidden', !host && !joinable);
  btn.disabled = false;
  btn.textContent = joinable && !host ? `Join round ${G.room.round} in progress ⛳` : G.room.started ? `Start round ${G.room.round + 1} for everyone ⛳` : 'Start the round for everyone ⛳';
  $('roomWait').classList.toggle('hidden', host || joinable);
  const hostName = (G.room.members ?? []).find(m => m.host)?.name ?? 'the host';
  $('roomWait').textContent = !G.room.started ? `Waiting for ${hostName} to start…`
    : G.room.playingRound === G.room.round && !G.room.inRound ? `Round over. Waiting for ${hostName} to start round ${G.room.round + 1}…`
    : 'Everyone is mid-round. The host can start the next one.';
  $('roomNet').textContent = G.room.closed ? 'Room closed' : G.room.client.connected ? `● connected · ${(G.room.members ?? []).filter(m => m.online).length} online` : 'connecting…';
}
function needName() {
  const n = $('name').value.trim();
  if (!n) { roomErr('Pick a name first, so your friends know who is winning.'); $('name').focus(); return null; }
  return n.slice(0, 20);
}
function enterRoom(client, st) {
  G.room = { client, code: st.code, me: st.you, round: st.round, seed: st.seed, started: st.started, hostId: st.hostId, members: st.members, playingRound: 0, inRound: false, seen: new Set(), lastPos: null };
  try { history.replaceState(null, '', `?room=${st.code}`); } catch { /* sandboxed */ }
  onRoomState(st);
  openRoomPanel();
}
function makeClient() {
  return new RoomClient({
    name: () => playerNameNow(),
    onState: onRoomState, onShot: onRoomShot, onProgress: onRoomProgress, onStart: onRoomStart, onEmote,
    onConn: () => { renderLobby(); updateRoomRace(); },
    onClosed: why => {
      if (!G.room) return;
      G.room.closed = true;
      hud.toast(`${esc(why)}. You can keep playing; the room is gone.`);
      renderLobby(); updateRoomRace();
    },
  });
}
async function roomAction(fn) {
  const name = needName(); if (!name) return;
  roomErr(''); store.set('ghg_name', name);
  for (const b of ['roomCreate', 'roomJoinBtn']) $(b).disabled = true;
  const client = makeClient();
  try { enterRoom(client, await fn(client, name)); }
  catch (e) {
    roomErr(e.message);
    // (round 8, S5) one seat per name: "is that you?" takes the seat over
    if (e.nameTaken) {
      $('roomErr').innerHTML = `<b>${esc(name)}</b> is already in this room. <button type="button" id="roomMe">That's me</button>`;
      $('roomMe').onclick = () => roomAction((c, n) => c.join($('roomCode').value.trim().toUpperCase() || G.lastRoomCode, n, { takeover: true }));
    }
  }
  finally { for (const b of ['roomCreate', 'roomJoinBtn']) $(b).disabled = false; }
}
function leaveRoom() {
  if (!G.room) return;
  G.room.client.leave();
  G.room = null;
  for (const id of [...rivals.keys()]) dropRival(id);
  try { history.replaceState(null, '', location.pathname); } catch { /* sandboxed */ }
  renderLobby();
}
$('roomBtn').addEventListener('click', () => { unlockAudio(); openRoomPanel(); $('roomCode').focus(); });
$('roomCreate').addEventListener('click', () => roomAction((c, name) => c.create(name)));
$('roomJoinBtn').addEventListener('click', () => {
  const code = $('roomCode').value.trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) { roomErr('Room codes are four letters.'); return; }
  roomAction((c, name) => c.join(code, name));
});
$('roomCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('roomJoinBtn').click(); });
$('roomCode').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); });
$('roomCopy').addEventListener('click', async () => {
  const url = `${location.origin}/?room=${G.room.code}`;
  try { await navigator.clipboard.writeText(url); $('roomCopy').textContent = 'Copied!'; } catch { $('roomCopy').textContent = url; }
  setTimeout(() => { $('roomCopy').textContent = 'Copy invite link'; }, 2000);
});
$('roomStart').addEventListener('click', async () => {
  if (!G.room || G.room.closed) return;
  unlockAudio();
  G.playerName = playerNameNow();
  if (G.room.hostId !== G.room.me) { if (G.room.started) { G.room.joinInProgress = true; beginRoomRound(); } return; }
  const btn = $('roomStart'); btn.disabled = true; btn.textContent = 'Starting…';
  const res = await G.room.client.send({ type: 'start' });
  if (!G.room) return;
  if (!res) { btn.disabled = false; roomErr("Couldn't start the round. Check your connection and try again."); renderLobby(); return; }
  onRoomStart(res);   // normally the SSE start event already did this
});
$('roomLeave').addEventListener('click', () => { leaveRoom(); $('roomCode').value = ''; });
// ?room=CODE: rejoin silently after a reload, or prefill the code for a new invitee
(function roomFromURL() {
  const code = new URLSearchParams(location.search).get('room')?.toUpperCase();
  if (!code || !/^[A-Z]{4}$/.test(code)) return;
  $('roomCode').value = code;
  openRoomPanel();
  const saved = RoomClient.saved();
  if (saved?.code === code && $('name').value.trim()) roomAction((c, name) => c.join(code, name));
  else roomErr($('name').value.trim() ? 'You were invited to this room. Press Join.' : 'You were invited to this room. Enter your name, then press Join.');
})();

// ============================================================ automation hook (QA + fun council)
window.golf = {
  state() {
    const gp = G.ghost ? ghostMesh.position : null;
    return {
      mode: G.mode, hole: G.holeIdx + 1, holeName: G.holeDef?.name, par: G.holeDef?.par, strokes: G.strokes,
      holeScores: [...G.holeScores], ghostScores: [...(G.ghostScores ?? [])],
      ball: { ...G.ball, rest: !G.shot, surface: G.course?.surf(G.ball.x, G.ball.z), toPin: G.course ? dist2(G.ball, G.cup) : null },
      ballName: bag().name, ballTrait: bag().trait.id, bag: G.bag.map(b => ({ name: b.name, trait: b.trait.id, alive: b.alive })),
      club: G.club, yaw: G.yaw, wind: { ...G.wind }, puttRange: G.course ? puttRange() : null,
      hysteria: commentator.hysteria, tier: tier(), caption: commentator.lastLine, captionClass: commentator.lastClass, captions: commentator.history.length,
      goose: (goose ?? geese[0]) ? (g => ({ state: g.state, x: g.x, z: g.z, carrying: g.carry, frozen: g.frozen }))(goose ?? geese[0]) : null,
      geese: liveGeese().map(g => ({ state: g.state, x: g.x, z: g.z, y: g.mesh.position.y, vis: g.mesh.visible, cer: !!g.ceremony })), cam: { x: camera.position.x, y: camera.position.y, z: camera.position.z }, tug: { active: tug.active, p: tug.p, t: tug.t, rate: tug.rate },
      ghost: G.ghost ? { source: G.ghostSource, x: gp.x, y: gp.y, z: gp.z, stroke: G.ghost.played, total: G.ghost.strokes.length, race: G.race.status } : null,
      windmill: G.windmill ? G.windmill.angle : null, scareActive: !!G.scare, pins: PINS.def ? pinsUp() : null, finalWait: G.finalWait ? (G.finalWait.count ? 'countdown' : 'waiting') : null, deck: G.holeDef?.deck ?? null, wheelOrder: G.wheelOrder, auraK: G.holeDef?.bossAura ? auraGrowth(G.holeDef.bossAura, G.strokes + 1) : null, crown: !!G.crown, sicPending: G.sicPending ?? null,
      scoped: G.scoped, breath: G.breath, gasp: G.gasp, holding: G.holding, sway: { ...G.sway }, swayAmp: G.swayAmp ?? 0, fov: camera.fov,
      angler: { active: angler.active, tension: angler.tension, progress: angler.progress, t: angler.t, ready: angler.ready }, clubCarry: G.clubCarry, swinging: swing.active,
      shot: G.shot ? { t: G.shot.t, n: G.shot.sim.n, result: G.shot.sim.result, bullet: !!G.shot.bullet, inBullet: !!G.shot.wasBullet, kind: G.shot.kind } : null,
      stats: G.stats ? { ...G.stats } : null, fps: G.fps, cup: G.cup, graveyard: graveyard().length,
    };
  },
  start(name = 'Robot') { $('name').value = name; $('play').click(); },
  swing({ club, power = 1, tempo = 1, drift = 0, yaw } = {}) {
    if (!canSwing()) return false;
    if (club) setClub(club);
    if (yaw !== undefined) G.yaw = yaw;
    doShot({ power, tempo, drift });
    return true;
  },
  // full simulated mouse swing: pixels pulled back, ms on the downswing, px of sideways drift
  mouseSwing(backPx = 260, downMs = 120, driftPx = 0) {
    if (!canSwing()) return false;
    beginSwing('mouse');
    swingMove(0, backPx);
    swingMove(0, -3);
    swing.tDown = performance.now() - downMs;
    swingMove(driftPx, -(backPx + 10));
    return true;
  },
  aim(x, z) { aimAtPoint(x, z); }, aimPin() { aimAtPoint(G.cup.x, G.cup.z); },
  // hold a mouse backswing at power p (for screenshots of the live carry marker), then strike
  windup(p) { if (!swing.active) { if (!canSwing()) return false; beginSwing('mouse'); } swingMove(0, Math.max(0, p - swing.back) * SWING_PX); return true; },
  strike(downMs = 120, driftPx = 0) { if (!swing.active) return false; swingMove(0, -3); swing.tDown = performance.now() - downMs; swingMove(driftPx, -(swing.peak * SWING_PX + 10)); return true; },
  place(x, z) { G.ball = { x, z, y: G.course.h(x, z) + R }; G.lastLie = { ...G.ball }; aimAtPoint(G.cup.x, G.cup.z); autoClub(); snapAddressCam(); updateHUD(); roomSendProgress(); },
  placeGhost(x, z) { G.ghost.rest = { x, y: G.course.h(x, z) + R, z }; G.ghost.strokes = G.ghost.strokes.slice(0, G.strokes); placeGhostMesh(G.ghost.rest); G.ghost._override = true; },
  placeGoose(x, z, k = 0) { const g = geese[k]; g.x = x; g.z = z; g.state = 'graze'; g.target = null; for (const o of liveGeese()) if (o !== g) { o.x += 400; o.home = { x: o.x, z: o.z, r: 1 }; } },
  tugShake(px) { tugInput(px); },
  forceTheft() { const g = liveGeese().find(x => !x.gosling); if (!g || G.mode !== 'address') return false; g.x = G.ball.x + 1.2; g.z = G.ball.z; goose = g; G.thefts++; grabBall(g); return true; },
  docks: () => (G.docks ?? []).map(d => ({ stand: d.stand, drop: d.drop })),
  lieCheck: () => ({ surf: G.course.surf(G.ball.x, G.ball.z), aboveWater: +(G.course.h(G.ball.x, G.ball.z) - G.course.waterLevelAt(G.ball.x, G.ball.z)).toFixed(2), strokes: G.strokes }),
  forceLoss(k) { G.forceLoss = k; },
  sasquackAt() { const t = nearestTrunk(G.ball, 400); if (!t) return false; const a = Math.atan2(G.cup.z - t.z, G.cup.x - t.x); this.place(t.x + Math.cos(a) * 1.5, t.z + Math.sin(a) * 1.5); G.sasqHole = false; return maybeSasquack(); },
  standAt(x, z) { if (sendEmote('stand', '', `${myHole()}:${x.toFixed(1)}:${z.toFixed(1)}`)) { G.myFan = { x, z }; return true; } return false; },
  possessAt(id, x, z) { return sendEmote('possess', id, `${myHole()}:${x.toFixed(1)}:${z.toFixed(1)}:0`); },
  teethAt(id, strokes, trick = 'brood') { return sendEmote('teeth', id, `${myHole()}:${strokes}:${trick}`, { state: true }); },
  fanShot() {
    // find a club/power from here whose flight hits a fan (QA)
    const d = aimDir();
    for (const club of ['wedge', 'iron']) for (let p = 0.15; p <= 0.9; p += 0.025) {
      const L = launch(club, p, d.x, d.z, 0, 1, traitOf(bag()));
      const world = { course: G.course, cup: G.cup, wind: G.wind, trait: traitOf(bag()), colliders: G.colliders, dynamic: galleryColliders(G.ball), strokeNo: G.strokes + 1, noAura: true };
      const sim = simulate(world, G.ball, L);
      if (sim.events.some(e => e.tag?.startsWith('fan:'))) return { club, p };
    }
    return null;
  },
  pvp: () => ({ shotKind: G.shot?.kind, shotT: G.shot ? +(G.shot.t / FPS).toFixed(2) : null, shotN: G.shot?.sim.n, fan: G.shot?.fan,  fans: [...fans.entries()].map(([id, f]) => ({ id, arrived: f.arrived })), puppets: [...puppets.values()].map(p => ({ hunt: !!p.hunt })), knockQ: !!G.knockQ, teethHole: !!G.teethHole }),
  jumpTo(i) { for (let k = 0; k < i; k++) G.holeScores[k] = HOLES[k].par; loadHole(i); },
  useBall(i) { if (G.bag?.[i]?.alive) { G.ballIdx = i; renderBag(); } return G.bag?.[G.ballIdx]?.name; },
  newRoundSeed() { roundsStarted = Math.max(1, roundsStarted); setRoundSeed(); return roundSeed; },
  scareNow() { G.scareDone = false; holeOut({ start: { ...G.ball }, wasBullet: false }); }, tug: () => ({ ...tug, last: undefined }),
  skip() {
    skipLinger();
    if (G.shot) G.shot.t = G.shot.sim.n - 1; if (G.walk) G.walk.t = 1; if (G.mode === 'holed') G.celebrate = 0;
    if (G.mode === 'flyover') skipFlyover();
    if (G.mode === 'wheel') { hurryWheel(); hurryWheel(); }
    if (G.mode === 'between' && !waitingFor().length) goNextHole();
  },
  powerUp: id => { const p = POWERUPS.find(x => x.id === id); if (p) applyPowerUp(p); return G.powerUp; },
  emote: (kind, to, arg) => sendEmote(kind, to, arg),
  setTimeScale(s) { G.timeScale = s; },
  reel(on) { angler.reeling = !!on; },
  scope(on) { setScope(!!on); }, hold(on) { G.holding = !!on && G.gasp <= 0; },
  rangefind, loadHole: i => loadHole(i), setWind(x, z) { G.wind = { x, z }; G.previewDirty = true; },
  holes: HOLES, simulate: (club, power, yaw, tempo = 1, drift = 0, traitId) => {
    const t = traitId ? { speed: 1, bounce: 1, roll: 1, capture: 1, wind: 1, side: 1, ...(TRAITS.find(x => x.id === traitId)?.mod ?? {}) } : traitOf(bag());
    const d = fwd(yaw ?? G.yaw), L = launch(club, club === 'putter' ? puttPower(power * puttRange()) : power, d.x, d.z, drift, tempo, t);
    const s = simulate({ course: G.course, cup: G.cup, wind: G.wind, trait: t, colliders: G.colliders }, G.ball, L);
    return { carry: Math.hypot(s.carry.x - G.ball.x, s.carry.z - G.ball.z), total: Math.hypot(s.end.x - G.ball.x, s.end.z - G.ball.z), end: s.end, result: s.result, apex: s.apex, carryPt: s.carry, bounces: s.events.filter(e => e.type === 'bounce').length, maxBounce: Math.max(0, ...s.events.filter(e => e.type === 'bounce').map(e => e.speed)) };
  },
  ghostAt: n => ghostRestAfter(n),
  checkStymie() { G.stymieTold = false; if (!maybeTomNudge()) checkStymie(); return G.stymieTold; },
  room() {
    if (!G.room) return null;
    return { puppets: puppets.size, waitingFor: waitingFor().map(r => r.name), watching: G.between?.watching?.name ?? null, sic: G.sicPending ?? null, wheel: G.wheelOrder, code: G.room.code, me: G.room.me, host: G.room.hostId === G.room.me, round: G.room.round, playingRound: G.room.playingRound, inRound: G.room.inRound, connected: G.room.client.connected, closed: !!G.room.closed,
      standings: standings().map(x => ({ name: x.name, me: !!x.me, toPar: x.toPar, thru: x.thru, pos: x.pos, done: x.done })),
      rivals: [...rivals.values()].map(r => ({ name: r.name, online: r.online, visible: r.mesh.visible, playing: !!r.playing, pos: r.mesh.visible ? { x: r.mesh.position.x, y: r.mesh.position.y, z: r.mesh.position.z } : null, prog: r.prog })) };
  },
  bag: () => G.bag.map(b => b.name), windNow: () => ({ ...G.wind }),
};

// ============================================================ boot
// Title screen: hole 1 sits behind the card with Old Tom planned.
G.stats = { gooseThefts: 0, gooseHits: 0, ghostHits: 0, ballsLost: 0, ballsSaved: 0, junk: [], bulletCams: 0, longestDrive: 0, pure: 0, swings: 0 };
G.bag = newBag(); G.ghostSource = 'oldtom';
loadHole(0);
G.mode = 'title';
renderClubs(); renderBag();
connectLive();
requestAnimationFrame(frame);
// Old Tom plans holes 2-7 while the player reads the title card.
HOLES.forEach((_, i) => { if (i) setTimeout(() => ensureTom(i), 600 + i * 300); });

$('powerChip').addEventListener('click', () => { const el = $('powerChip'); el.classList.remove('mini'); clearTimeout(renderPowerChip.t); if (narrow()) renderPowerChip.t = setTimeout(() => el.classList.add('mini'), 2500); });
