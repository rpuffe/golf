// Golden Hour Golf — first-person 3D. Game loop, input, camera, HUD and the
// five council features: Sniper's Lie (scope), Ghost Strokes (rival ghost),
// The Goose, the Whisper-to-Hysteria commentator, and Five Balls, One Life.

import * as THREE from 'three';
import { buildCourse } from './course.js';
import { simulate, launch, frameAt, prepColliders, puttPower, CLUBS, CLUB_ORDER, R, CUP_R, FPS } from './physics.js';
import { HOLES, TOTAL_PAR } from './holes.js';
import { planHole } from './oldtom.js';
import * as W from './world.js';
import { sfx, unlockAudio, setMuted, isMuted, setWindAmbience, flightSound, gooseSong, GOOSE_SONG_SECS, swingTone } from './audio.js';
import { RoomClient } from './room.js';
import { say, initCommentator, commentator, bumpHysteria, setVoiceEnabled, voiceEnabled, tier } from './commentator.js';

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
const BALL_NAMES = ['Gerald', 'Doris', 'Big Steve', 'Penelope', 'Kevin', 'Margaret', 'Sir Reginald', 'Tiny Tim', 'Brenda', 'Clive', 'Dot', 'Barry', 'Agnes', 'Nigel', 'Wendy', 'Pip'];
const TRAITS = [
  { id: 'bouncy', label: 'Bouncy', desc: 'bounces 70% higher', mod: { bounce: 1.7 } },
  { id: 'heavy', label: 'Heavy', desc: 'ignores wind, rolls on', mod: { wind: 0.35, speed: 0.92, roll: 0.8 } },
  { id: 'slippery', label: 'Slippery', desc: 'rolls and rolls', mod: { roll: 0.55, bounce: 1.15 } },
  { id: 'lucky', label: 'Lucky', desc: 'cups love it, a bit lazy', mod: { capture: 1.6, speed: 0.9 } },
  { id: 'feather', label: 'Featherweight', desc: 'flies far, loves wind', mod: { wind: 2.2, speed: 1.1 } },
  { id: 'nervous', label: 'Nervous', desc: 'fast and curvy', mod: { side: 1.8, speed: 1.12 } },
];
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

// ============================================================ shared meshes
const ballMesh = W.buildBall(0xffffff); scene.add(ballMesh);
const ballGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: W.glowTexture(), color: 0xfff2c0, transparent: true, opacity: 0.7, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
ballGlow.renderOrder = 5; scene.add(ballGlow);
const shooMesh = W.buildBall(0xc8c0b0); shooMesh.visible = false; scene.add(shooMesh);
const GHOST_R = 0.12;  // the ghost's "soul" ball is a little bigger than yours, and solid
const ghostMesh = W.buildBall(0x7ff6ff, true); ghostMesh.scale.setScalar(GHOST_R / R); scene.add(ghostMesh);
const ghostLabel = W.buildLabel('👻 OLD TOM', '#bffcff'); scene.add(ghostLabel);
const rod = W.buildRod(); rod.visible = false; scene.add(rod);
const pinLabel = W.buildLabel('⛳ PIN', '#fff', 'rgba(220,40,60,0.8)'); scene.add(pinLabel);
const club = W.buildClub(); scene.add(club);
const gooseMesh = W.buildGoose(); scene.add(gooseMesh);
const gooseLabel = W.buildLabel('🪿 GOOSE', '#ffffff', 'rgba(200,60,40,0.75)'); scene.add(gooseLabel);
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
const trailMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
const oldTrailMat = new THREE.LineBasicMaterial({ color: 0xfff4d0, transparent: true, opacity: 0.28, depthWrite: false });
const ghostTrailMat = new THREE.LineBasicMaterial({ color: 0x7ff6ff, transparent: true, opacity: 0.5, depthWrite: false });
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
const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.13, vertexColors: true, transparent: true, depthWrite: false }));
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
const hud = {
  banner(html, ms = 1600) {
    const b = $('banner'); b.innerHTML = html; b.classList.add('show');
    clearTimeout(hud._bt); hud._bt = setTimeout(() => b.classList.remove('show'), ms);
  },
  hint(html) { $('hint').innerHTML = html || ''; },
  flash(a = 0.6) { const f = $('flash'); f.style.transition = 'none'; f.style.opacity = a; requestAnimationFrame(() => { f.style.transition = 'opacity .35s'; f.style.opacity = 0; }); },
  toast(html) {
    const el = document.createElement('div'); el.className = 'toast'; el.innerHTML = html;
    $('toasts').appendChild(el); requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 4500);
  },
};
function renderClubs() {
  $('clubs').innerHTML = CLUB_ORDER.map((id, i) => {
    const c = CLUBS[id];
    const range = id === 'putter' && G.course ? puttRange() : c.range;
    return `<button class="club${G.club === id ? ' active' : ''}" data-id="${id}" role="radio" aria-checked="${G.club === id}"><b>${c.short}</b><span>${range} m${c.id === 'putter' ? '' : ' carry'}</span> <kbd>${i + 1}</kbd></button>`;
  }).join('');
}
$('clubs').addEventListener('click', e => { const b = e.target.closest('.club'); if (b) setClub(b.dataset.id); });
function renderBag() {
  const balls = [...G.bag];
  if (G.ballIdx >= G.bag.length) balls.push(bag());
  $('bag').innerHTML = balls.map((b, i) =>
    `<div class="ball${b.alive ? '' : ' dead'}${i === G.ballIdx ? ' active' : ''}" title="${esc(b.name)}: ${esc(b.trait.desc)}"><i></i><b>${esc(b.name)}</b>${esc(b.trait.label)}</div>`).join('');
}
function updateHUD() {
  const h = G.holeDef; if (!h) return;
  $('holeName').textContent = h.name;
  $('holeLine').innerHTML = `Hole ${G.holeIdx + 1}/${HOLES.length} <small>Par ${h.par}</small>`;
  const done = G.holeScores.reduce((s, v) => s + v, 0), parDone = HOLES.slice(0, G.holeScores.length).reduce((s, x) => s + x.par, 0);
  const d = done - parDone;
  $('roundLine').textContent = `Stroke ${G.strokes + 1} · Round ${done} (${d === 0 ? 'E' : d > 0 ? '+' + d : d})`;
  const dp = dist2(G.ball, G.cup);
  const s = G.course.surf(G.ball.x, G.ball.z);
  $('lieDist').innerHTML = `${dp.toFixed(dp < 10 ? 1 : 0)} m <small>to pin</small>`;
  $('lieSurf').textContent = `${SURF_LABEL[s] ?? s} · ${bag().name}`;
  // wind relative to the view: arrow points where the wind blows
  const ws = Math.hypot(G.wind.x, G.wind.z);
  const wAng = Math.atan2(G.wind.x, -G.wind.z) + G.yaw; // screen-space: up = away from camera
  $('windArrow').style.transform = `rotate(${wAng * 180 / Math.PI - 90}deg)`;
  $('windSpeed').textContent = `${ws.toFixed(1)} m/s`;
}

// ============================================================ round + holes
let tomCache = [];   // Old Tom's planned strokes per hole
let pbGhost = null;  // { total, name, holes: [[{sx,sy,sz,f:[...],holed,pen}]] }
function loadPB() { try { pbGhost = JSON.parse(store.get('ghg3d_pb') || 'null'); } catch { pbGhost = null; } }
loadPB();
const graveyard = () => { try { return JSON.parse(store.get('ghg3d_graveyard') || '[]'); } catch { return []; } };

function shuffle(a, rng) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// In a room everyone gets the same five balls and the same wind (seeded), so
// the race is fair; the goose stays gloriously random per player.
function newBag(rng = Math.random) {
  const names = shuffle([...BALL_NAMES], rng).slice(0, 5);
  const traits = shuffle([...TRAITS], rng).slice(0, 5);
  return names.map((n, i) => ({ name: n, trait: traits[i], alive: true }));
}

function startRound() {
  const rng = G.room ? W.mulberry32(G.room.seed) : Math.random;
  G.holeScores = []; G.ghostScores = []; G.roundRec = []; G.bag = newBag(rng); G.ballIdx = 0;
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
  ghostLabel.material.map.dispose();
  const lbl = W.buildLabel(G.ghostSource === 'pb' ? `👻 YOUR BEST (${pbGhost.total})` : '👻 OLD TOM', '#bffcff');
  ghostLabel.material = lbl.material;
  $('raceWho').textContent = G.room ? `🏁 Room ${G.room.code}` : G.ghostSource === 'pb' ? `👻 vs your best (${pbGhost.total})` : '👻 vs Old Tom';
  renderBag();
  loadHole(0);
  say('tee', vars(), {});
}

function disposeGroup(g) {
  g.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.map?.dispose(); m.dispose(); });
  });
  scene.remove(g);
}

function resetTransient() {
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
  const h = HOLES[i];
  G.holeDef = h;
  if (G.holeGroup) disposeGroup(G.holeGroup);
  for (const t of G.trails) { t.geometry.dispose(); scene.remove(t); }
  G.trails = [];
  liveTrail.geometry.setDrawRange(0, 0); ghostTrail.geometry.setDrawRange(0, 0);
  const course = buildCourse(h);
  G.course = course;
  G.cup = { x: h.pin[0], z: h.pin[1] };
  const g = new THREE.Group();
  g.add(W.buildTerrainMesh(course), W.buildWater(course));
  const trees = W.placeTrees(course, h);
  g.add(W.buildTreeMeshes(trees));
  G.colliders = prepColliders(W.treeColliders(trees, course));
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
  env.apply(i);

  // wind: per-run direction, per-hole strength
  const wr = G.room ? W.mulberry32((G.room.seed ^ Math.imul(i + 1, 2654435761)) >>> 0)() : Math.random();
  const wd = G.windBase.dir + i * 0.9, ws = h.wind * (0.75 + wr * 0.5);
  G.wind = { x: Math.cos(wd) * ws, z: Math.sin(wd) * ws };
  setWindAmbience(ws);

  G.strokes = 0; G.stymieTold = false; G.tomNudged = false; G.ghostGlide = null;
  pickUnit(); lastPreview = ''; G.previewCarry = null;
  G.ball = { x: h.tee[0], z: h.tee[1], y: course.h(h.tee[0], h.tee[1]) + R };
  G.lastLie = { ...G.ball };
  aimAtPoint(h.path[1][0], h.path[1][1]);
  G.pitch = -0.17;
  autoClub();
  spawnGoose();
  setupGhost();
  G.race.status = 'level'; G.race.last = 'level';
  renderRace();
  G.mode = 'address';
  snapAddressCam();
  updateHUD();
  if (i > 0) hud.banner(`Hole ${i + 1}<small>${esc(h.name)} · Par ${h.par}</small>`, 2200);
  hud.hint(holeHint());
  for (const r of rivals.values()) { finishRivalShot(r, true); r.trail.geometry.setDrawRange(0, 0); }
  roomSendProgress();
  // plan the rest of Old Tom's round in the background (normally already done on the title card)
  if (!tomCache[i + 1]) setTimeout(() => ensureTom(i + 1), 400);
}

function holeHint() {
  const s = G.holeDef.spotlight;
  if (G.holeIdx === 0 && !G.hintsShown.swing) return coarse ? 'Drag the course to aim. On the <b>swing pad</b>, drag down, then flick up.' : '<b>Hold left mouse</b>, pull back, push forward to swing · or <b>Space</b>: hold, release, tap';
  if (s === 'angler') return "Water ahead. Lose a ball in it and you'll have to <b>reel it back in</b>.";
  if (s === 'stymie') return 'The ghost ball is <b>solid</b>. If it sits on your line, curl around it or chip over.';
  if (s === 'scope') return 'Strong wind. <b>Right-click</b> to scope the carry, and hold <b>Shift</b> to steady.';
  return '';
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
const PUTT_TIERS = [3, 6, 10, 15, 21];
function puttRange() {
  const base = G.mode === 'goose' && G.gooseLie ? G.gooseLie : G.ball;
  const tgt = G.mode === 'goose' ? goose : G.cup;
  const d = Math.hypot(tgt.x - base.x, tgt.z - base.z) * 1.3;
  return PUTT_TIERS.find(t => t >= d) ?? PUTT_TIERS.at(-1);
}

// ============================================================ ghost (rival)
function ensureTom(i) {
  if (i >= HOLES.length || tomCache[i]) return tomCache[i];
  const h = HOLES[i];
  const course = i === G.holeIdx ? G.course : buildCourse(h);
  const cols = i === G.holeIdx ? G.colliders : prepColliders(W.treeColliders(W.placeTrees(course, h), course));
  tomCache[i] = planHole(course, h, { x: h.pin[0], z: h.pin[1] }, cols);
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
  if (G.ghostSource === 'pb' && pbGhost?.holes?.[G.holeIdx]) strokes = decodePB(pbGhost.holes[G.holeIdx]);
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
  if (G.room) return null;
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
function renderRace() {
  if (G.room) { updateRoomRace(); return; }
  const st = G.race.status;
  const el = $('raceStatus'); el.className = st;
  el.textContent = st === 'ahead' ? 'AHEAD ▲' : st === 'behind' ? 'BEHIND ▼' : 'LEVEL ●';
  const gp = ghostRestAfter(G.strokes);
  const gd = gp.holed ? 'holed out' : `${Math.hypot(gp.x - G.cup.x, gp.z - G.cup.z).toFixed(0)} m out`;
  const gs = Math.min(G.strokes, G.ghost?.strokes.length ?? 0);
  const roundDiff = G.race.round;
  $('raceDetail').textContent = `ghost: ${gs} stroke${gs === 1 ? '' : 's'}, ${gd}` + (G.holeIdx > 0 ? ` · round ${roundDiff === 0 ? 'level' : roundDiff < 0 ? `you −${-roundDiff}` : `you +${roundDiff}`}` : '');
}
function updateRace() {
  if (G.room) { updateRoomRace(); return; }
  const st = raceStatus();
  G.race.last = G.race.status; G.race.status = st;
  if (st !== G.race.last) {
    if (st === 'ahead') { sfx.overtake(); say('overtake', vars(), { bump: -6 }); }
    else if (st === 'behind') { sfx.fallBehind(); setTimeout(() => say('fallBehind', vars(), { bump: 6 }), 1600); }
  }
  renderRace();
}

// ============================================================ goose
const goose = { state: 'graze', x: 0, z: 0, yaw: 0, target: null, t: 0, timer: 0, phase: 0, carry: false, frozen: false, home: null, carryT: 0, holding: null };
function spawnGoose() {
  const [cx, cz, r] = G.holeDef.goose.area;
  const a = Math.random() * Math.PI * 2, d = Math.random() * r;
  Object.assign(goose, { state: 'graze', x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d, target: null, t: 0, timer: 1 + Math.random() * 2, carry: false, frozen: false, home: { x: cx, z: cz, r }, holding: null });
  goose.yaw = Math.random() * 6;
  gooseMesh.userData.carry.clear();
  gooseMesh.userData.alert.visible = false;
}
function gooseCollider() {
  if (goose.carry || goose.state === 'flee') return [];
  return [{ kind: 'sphere', x: goose.x, y: G.course.h(goose.x, goose.z) + 0.42, z: goose.z, r: 0.46, e: 0.35, tag: 'goose' }];
}
function validLand(x, z) { const s = G.course.surf(x, z); return s !== 'water' && s !== 'oob'; }
function pickGooseTarget() {
  // waddle away from the player, preferring somewhere annoying
  const away = Math.atan2(goose.z - camera.position.z, goose.x - camera.position.x);
  for (let k = 0; k < 24; k++) {
    const a = away + (Math.random() - 0.5) * 2.2, d = 14 + Math.random() * 14;
    const x = goose.x + Math.cos(a) * d, z = goose.z + Math.sin(a) * d;
    let ok = true;
    for (let t = 0.2; t <= 1.0001; t += 0.2) if (!validLand(lerp(goose.x, x, t), lerp(goose.z, z, t))) { ok = false; break; }
    if (ok) return { x, z };
  }
  return { x: goose.x, z: goose.z };
}
function updateGoose(dt) {
  const u = gooseMesh.userData;
  goose.phase += dt;
  // the theft clock is wall time, so it stays in step with the song even on a slow frame rate
  if (goose.carry) goose.carryT = (performance.now() - (goose.carryStart ?? performance.now())) / 1000;
  let speed = 0;
  const moveTo = (tx, tz, sp) => {
    const dx = tx - goose.x, dz = tz - goose.z, d = Math.hypot(dx, dz);
    if (d < 0.15) return true;
    const want = Math.atan2(dx, dz);
    let dy = want - goose.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    goose.yaw += clamp(dy, -6 * dt, 6 * dt);
    const step = Math.min(d, sp * dt);
    const nx = goose.x + dx / d * step, nz = goose.z + dz / d * step;
    if (validLand(nx, nz)) { goose.x = nx; goose.z = nz; } else return true;
    speed = sp;
    return false;
  };
  // the theft lasts exactly one performance of the goose's song
  if (goose.carry && goose.carryT > GOOSE_SONG_SECS && !(G.shot && G.shot.kind === 'shoo')) {
    if (swing.active) cancelSwing();
    gooseDrop(false);
  }
  if (goose.frozen) {
    // watching: turn toward the action
    const look = G.shot ? shotPos() : G.ball;
    const want = Math.atan2(look.x - goose.x, look.z - goose.z);
    let dy = want - goose.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    goose.yaw += clamp(dy, -3 * dt, 3 * dt);
  } else if (goose.state === 'graze') {
    goose.timer -= dt;
    if (goose.target) { if (moveTo(goose.target.x, goose.target.z, 1.0)) goose.target = null; }
    else if (goose.timer <= 0) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * goose.home.r;
      const tx = goose.home.x + Math.cos(a) * d, tz = goose.home.z + Math.sin(a) * d;
      if (validLand(tx, tz)) goose.target = { x: tx, z: tz };
      goose.timer = 2 + Math.random() * 3;
    }
  } else if (goose.state === 'alert') {
    goose.t -= dt;
    const want = Math.atan2(G.ball.x - goose.x, G.ball.z - goose.z);
    goose.yaw = want;
    if (goose.t <= 0) { goose.state = 'fetch'; u.alert.visible = false; }
  } else if (goose.state === 'fetch') {
    if (moveTo(G.ball.x, G.ball.z, 9) || dist2(goose, G.ball) < 0.5) grabBall();   // a goose on a mission is fast
  } else if (goose.state === 'carry') {
    if (goose.target && moveTo(goose.target.x, goose.target.z, 2.6)) goose.target = null;
    if (!goose.target && Math.random() < dt * 0.6) goose.target = pickGooseTarget();

  } else if (goose.state === 'flee') {
    goose.t -= dt;
    if (goose.target) moveTo(goose.target.x, goose.target.z, 7);
    if (goose.t <= 0) { goose.state = 'graze'; goose.target = null; }
  }
  // animate
  const gy = G.course.h(goose.x, goose.z);
  gooseMesh.position.set(goose.x, gy, goose.z);
  gooseMesh.rotation.y = goose.yaw;
  const wob = speed > 0 ? Math.sin(goose.phase * (6 + speed * 2)) : 0;
  u.body.rotation.z = wob * 0.12;
  u.legL.rotation.x = wob * 0.6; u.legR.rotation.x = -wob * 0.6;
  u.footL.position.z = 0.06 + wob * 0.08; u.footR.position.z = 0.06 - wob * 0.08;
  const peck = goose.state === 'graze' && !goose.target ? Math.max(0, Math.sin(goose.phase * 1.7)) ** 6 : 0;
  // while carrying, it head-bobs on the beat of its own theme song (132 bpm)
  const strut = goose.carry ? Math.abs(Math.sin(goose.carryT * Math.PI * 2.2)) * 0.35 : 0;
  u.neckPivot.rotation.x = peck * 1.4 + strut + (goose.state === 'fetch' ? 0.6 : 0) + (goose.state === 'alert' ? -0.2 : 0);
  const flap = goose.state === 'flee' || goose.state === 'fetch' ? Math.sin(goose.phase * 22) * 0.9 : 0;
  u.wingL.rotation.z = -Math.abs(flap); u.wingR.rotation.z = Math.abs(flap);
  scaleLabel(gooseLabel, gooseMesh.position, 1.9, 0.045);
  gooseLabel.visible = G.mode !== 'title' && dist2(goose, camera.position) > 14;
}
function maybeGooseSteal() {
  const r = G.holeDef.goose.radius ?? 9;
  if (goose.state !== 'graze' || goose.frozen) return false;
  if (dist2(goose, G.ball) > r) return false;
  const s = G.course.surf(G.ball.x, G.ball.z);
  if ((s === 'green' || s === 'fringe') && dist2(G.ball, G.cup) < 5) return false;
  goose.state = 'alert'; goose.t = 0.7;
  gooseMesh.userData.alert.visible = true;
  sfx.honk(2);
  hud.banner('🪿 HONK!', 900);
  G.mode = 'gooseFetch';
  return true;
}
function grabBall() {
  goose.state = 'carry'; goose.carry = true; goose.carryT = 0; goose.carryStart = performance.now(); goose.target = pickGooseTarget();
  const held = W.buildBall(0xffffff); held.castShadow = false;
  gooseMesh.userData.carry.add(held);
  ballMesh.visible = false;
  G.stats.gooseThefts++;
  sfx.honk(1);
  say('gooseTheft', vars(), { bump: 14 });
  // GOOSE CAM: you watch your ball leave in its beak, to its theme song, and
  // there is nothing you can do about it. It drops the ball when the song ends.
  G.mode = 'gooseCam';
  G.gooseLie = { ...G.ball };
  G.gooseCam = { pos: camera.position.clone(), t: 0 };
  G.stopGooseSong?.(); G.stopGooseSong = gooseSong();
  if (swing.active) cancelSwing();
  setScope(false);
  $('bulletLbl').textContent = '🪿 GOOSE CAM · THE GOOSE IS IN CHARGE NOW';
  $('letterbox').classList.add('show'); document.body.classList.add('bullet');   // same cinematic framing as the bullet cam
  hud.hint('');
}
function endGooseCam() {
  G.stopGooseSong?.(); G.stopGooseSong = null;
  G.gooseCam = null;
  $('letterbox').classList.remove('show'); document.body.classList.remove('bullet');
  setTimeout(() => { if (!G.gooseCam) $('bulletLbl').textContent = '● BULLET CAM — CLICK TO SKIP'; }, 400);
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
function updateGooseCam(dt) {
  const gc = G.gooseCam; gc.t += dt;
  const gy = G.course.h(goose.x, goose.z);
  const fx = Math.sin(goose.yaw), fz = Math.cos(goose.yaw);   // goose forward
  const rx = -fz, rz = fx;                                     // goose right
  const dist = 3.2 - Math.min(1, gc.t / 4) * 1.0;              // pushes in as the song builds
  // film from whichever side has a clear view (a trunk between camera and goose ruins the shot)
  const spot = side => ({ x: goose.x + (fx * 0.75 + rx * 0.66 * side) * dist, z: goose.z + (fz * 0.75 + rz * 0.66 * side) * dist });
  gc.side ??= 1;
  if (gooseViewBlocked(spot(gc.side)) && !gooseViewBlocked(spot(-gc.side))) gc.side = -gc.side;
  const { x: cx, z: cz } = spot(gc.side);
  const want = new THREE.Vector3(cx, Math.max(gy + 1.0, G.course.h(cx, cz) + 0.8), cz);
  camera.position.lerp(want, 1 - Math.exp(-dt * (gc.t < 0.6 ? 2.5 : 4)));
  G.camLook.lerp(new THREE.Vector3(goose.x + fx * 0.35, gy + 0.85, goose.z + fz * 0.35), 1 - Math.exp(-dt * 6));
  camera.lookAt(G.camLook);
}
function gooseDrop(hit) {
  if (!goose.carry) return;
  endGooseCam();
  goose.carry = false; goose.frozen = false;
  gooseMesh.userData.carry.clear();
  let x = goose.x, z = goose.z;
  for (let k = 0; k < 60 && !validLand(x, z); k++) { x = lerp(x, G.gooseLie.x, 0.1); z = lerp(z, G.gooseLie.z, 0.1); }
  if (G.course.surf(x, z) === 'sand') { /* a bunker is rude but playable */ }
  G.ball = { x, z, y: G.course.h(x, z) + R };
  roomSendProgress();
  ballMesh.visible = true;
  burst(x, G.ball.y + 0.5, z, 30, 0xffffff, { speed: 2.5, up: 2, life: 1.4, grav: 2 });
  sfx.feathers();
  if (hit) {
    goose.state = 'flee'; goose.t = 3.2;
    const a = Math.random() * Math.PI * 2; goose.target = { x: goose.x + Math.cos(a) * 25, z: goose.z + Math.sin(a) * 25 };
    if (!validLand(goose.target.x, goose.target.z)) goose.target = { x: goose.home.x, z: goose.home.z };
  } else {
    goose.state = 'graze'; goose.timer = 2;
    say('gooseDrop', vars(), { bump: -3 });
  }
  hud.hint('');
  startWalk();
}

// ============================================================ swing input
const swing = { active: false, src: '', phase: 'back', back: 0, peak: 0, fwd: 0, drift: 0, tDown: 0, angle: 0, follow: 0 };
const SWING_PX = 260;
function canSwing() { return (G.mode === 'address' || G.mode === 'goose') && !G.shot && !G.walk; }
function beginSwing(src) {
  if (!canSwing() || swing.active) return;
  Object.assign(swing, { active: true, src, phase: 'back', back: 0, peak: 0, fwd: 0, drift: 0, tDown: 0, t0: performance.now() });
  if (G.mode === 'goose') goose.frozen = true;  // the goose sees you winding up and freezes
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
    if (swing.back > 0.08) hud.hint('Pull back, then <b>push the mouse forward</b> to strike.');
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
  swing.active = false; $('acc').classList.remove('show'); $('power').classList.remove('show'); $('powerLbl').classList.remove('show');
  if (G.mode === 'goose') goose.frozen = false;
}
function finishSwing(power, tempo, drift) {
  const src = swing.src;
  swing.active = false; swingTone.release();
  $('power').classList.remove('show'); $('powerLbl').classList.remove('show');
  if (power < 0.03) { if (G.mode === 'goose') goose.frozen = false; carry.samples = null; return; }
  if (G.club !== 'putter') showTempoChip(src === 'key' ? 'TIMING' : 'TEMPO', src === 'key' ? 1 - Math.abs(drift) / 0.45 : tempo);
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
  const trait = traitOf(ball);
  // putter: the pull-back is metres of flat-green roll (full pull = the tier's range)
  const eff = clubId === 'putter' ? puttPower(power * puttRange()) : power;
  const L = launch(clubId, eff, d.x, d.z, drift, tempo, trait);
  const start = { ...(shoo ? G.gooseLie : G.ball) };
  const strokeNo = G.strokes + 1;
  const world = {
    course: G.course, cup: G.cup, wind: G.wind, trait, colliders: G.colliders,
    dynamic: shoo ? [{ kind: 'sphere', x: goose.x, y: G.course.h(goose.x, goose.z) + 0.55, z: goose.z, r: 0.75, e: 0.3, tag: 'goose' }] : [...gooseCollider(), ...rivalColliders(start)],
    ghost: shoo ? null : ghostColliderFor(strokeNo, start), ghostR: GHOST_R,
  };
  if (!shoo) { goose.frozen = goose.state === 'graze'; }
  const sim = simulate(world, start, L);
  G.stats.swings++;
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
    roomSendShot(start, sim, clubId);
    G.hintsShown.swing = true;
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
  G.shot = { sim, t: 0, kind: shoo ? 'shoo' : 'player', ev: 0, L, start, bullet, clubId, landed: false, strokeNo, ball, wasBullet: false, called };
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
  const shoo = shot.kind === 'shoo';
  const v = clamp((e.speed ?? 5) / 15, 0.3, 1.2);
  switch (e.type) {
    case 'bounce': case 'land': {
      const s = e.surface;
      if (s === 'sand') { sfx.sand(v); burst(e.x, e.y, e.z, 26, 0xeacc90, { speed: 2.5, up: 3, life: 0.9 }); }
      else if (s === 'green' || s === 'fringe') { sfx.green(v); burst(e.x, e.y, e.z, 6, 0x9ae07a, { speed: 1, up: 1, life: 0.5 }); }
      else if (s === 'rough') { sfx.rough(v); burst(e.x, e.y, e.z, 14, 0x3f6e28, { speed: 1.5, up: 2.5, life: 0.8 }); }
      else { sfx.fairway(v); burst(e.x, e.y, e.z, 8, 0x6fae48, { speed: 1.2, up: 1.6, life: 0.6 }); }
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
      if (e.tag?.startsWith('rival:')) {
        const r = rivals.get(e.tag.slice(6));
        if (shot.rivalHit || !r) break;
        shot.rivalHit = true;
        sfx.ghostHit(); burst(e.x, e.y, e.z, 30, new THREE.Color(r.hex).getHex(), { speed: 2.5, up: 1.5, life: 1.2, grav: 0.5 });
        moment(30, `Cannoned off ${r.name}'s ball on hole ${G.holeIdx + 1}`);
        G.stats.ghostHits++; say('rivalHit', { ...vars(), rival: r.name }, { bump: 6 }); hud.banner(`💥 HIT ${esc(r.name.toUpperCase())}'S BALL`, 1100);
        break;
      }
      if (e.tag === 'tree') { sfx.tree(); burst(e.x, e.y, e.z, 10, 0x6b4a2a, { speed: 2, up: 2 }); if (!shoo && !shot.saidTree) { shot.saidTree = true; say('tree', vars(), { bump: 6 }); } }
      else if (e.tag === 'goose') {
        if (shot.gooseHit) break;
        shot.gooseHit = true;
        sfx.gooseBonk(); burst(e.x, e.y + 0.3, e.z, 40, 0xffffff, { speed: 3, up: 3, life: 1.6, grav: 2 });
        if (shoo) { moment(25, `Bonked the goose on hole ${G.holeIdx + 1}`); G.stats.gooseHits++; say('gooseHit', vars(), { bump: -8 }); hud.banner('🪿 BONK!', 900); gooseDrop(true); }
        else { say('gooseBlock', vars(), { bump: 8 }); goose.state = 'flee'; goose.t = 2; goose.frozen = false; goose.target = { x: goose.x + 15, z: goose.z }; }
      }
      break;
    case 'leaves': sfx.leaves(); burst(e.x, e.y, e.z, 18, 0x4e8a30, { speed: 2, up: 1, life: 1.4, grav: 1.5 }); if (!shoo && !shot.saidTree) { shot.saidTree = true; say('tree', vars(), { bump: 5 }); } break;
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
  carry.flight = false; carry.mark = null;
  flightSound(0);
  $('letterbox').classList.remove('show'); document.body.classList.remove('bullet');
  G.previewHidden = false;
  if (s.kind === 'shoo') {
    shooMesh.visible = false;
    if (!s.gooseHit && goose.carry) {
      goose.frozen = false;
      say('shooMiss', vars(), { bump: 4 });
      if (goose.carryT > 10) gooseDrop(false);
    }
    return;
  }
  // ghost finishes its stroke too
  G.ghost.played = s.strokeNo;
  G.ghost.playing = null;
  if (G.ghost.parked) {
    // done stymieing you: Old Tom floats back to where his ball really lies
    G.ghost.parked = false;
    G.ghostGlide = { from: { ...G.ghost.override }, to: ghostRestAfter(s.strokeNo), t: 0 };
  } else if (G.ghost.deferred) { G.ghostSolo = { shot: G.ghost.deferred, t: 0, strokeNo: s.strokeNo }; G.ghost.deferred = null; ghostTrail.geometry.setDrawRange(0, 0); }
  else placeGhostMesh(ghostRestAfter(s.strokeNo));
  if (goose.state !== 'flee') goose.frozen = false;
  // keep a faint trail of this stroke
  const tl = makeTrail(oldTrailMat, s.sim.n); fillTrail(tl, s.sim, s.sim.n); G.trails.push(tl);
  liveTrail.geometry.setDrawRange(0, 0);
  const sim = s.sim;
  const end = sim.end;
  if (sim.result === 'holed') {
    G.ball = { x: G.cup.x, z: G.cup.z, y: end.y };
    holeOut(s);
    return;
  }
  if (sim.result === 'water') { startAngler(end, s.start); return; }
  if (sim.result === 'oob') {
    G.strokes++;  // stroke and distance
    say('oob', vars(), { bump: 18 });
    hud.banner('OUT OF BOUNDS<small>+1 stroke · replay from your last lie</small>', 2000);
    G.ball = { ...G.lastLie };
    afterStroke(true);
    return;
  }
  G.ball = { x: end.x, z: end.z, y: end.y };
  // outcome commentary
  const surf = end.surface;
  const dpin = dist2(G.ball, G.cup);
  if (s.clubId !== 'putter' || !['green', 'fringe'].includes(G.course.surf(s.start.x, s.start.z))) {
    if (dpin < 1.5) { say('close', vars(), { bump: -12 }); hud.banner(`STIFF!<small>${dpin.toFixed(1)} m</small>`, 1400); burst(G.ball.x, G.ball.y + 0.2, G.ball.z, 30, 0xffc84a, { speed: 2, up: 3 }); }
    else if (surf === 'green' || surf === 'fringe') { say('green', vars(), { bump: -15 }); hud.banner(`ON THE GREEN<small>${dpin.toFixed(1)} m to the pin</small>`, 1400); }
    else if (surf === 'fairway') { say('fairway', vars(), { bump: -12 }); hud.banner(`FAIRWAY<small>${dpin.toFixed(0)} m to go</small>`, 1200); }
    else if (surf === 'rough') { say('rough', vars(), { bump: 9 }); hud.banner(`ROUGH<small>${dpin.toFixed(0)} m to go</small>`, 1200); }
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
  if (!snapBack && maybeGooseSteal()) { updateHUD(); return; }
  startWalk();
}

function updateGhostSolo(dt) {
  const g = G.ghostSolo; if (!g) return;
  g.t = Math.min(g.shot.n - 1, g.t + dt * FPS * 1.6 * G.timeScale);
  const p = frameAt(g.shot, Math.floor(g.t));
  placeGhostMesh(p); fillTrail(ghostTrail, g.shot, g.t);
  if (g.t >= g.shot.n - 1) {
    if (g.shot.result === 'holed') { sfx.tick(); burst(G.cup.x, p.y + 0.2, G.cup.z, 16, 0x7ff6ff, { speed: 1.5, up: 2, life: 1, grav: 1 }); }
    finishGhostSolo();
  }
}
function finishGhostSolo() {
  if (!G.ghostSolo) return;
  placeGhostMesh(ghostRestAfter(G.ghostSolo.strokeNo));
  G.ghostSolo = null;
}

// ============================================================ walking to the ball
function startWalk() {
  G.mode = 'walk';
  aimAtPoint(G.cup.x, G.cup.z);
  autoClub();
  const to = addressCam();
  G.walk = { t: 0, from: camera.position.clone(), fromLook: G.camLook.clone(), to, dur: clamp(camera.position.distanceTo(to.pos) / 90, 0.6, 1.4) };
  sfx.drop();
  updateHUD();
}
function updateWalk(dt) {
  const w = G.walk;
  w.t += dt / w.dur;
  const k = smooth(clamp(w.t, 0, 1));
  camera.position.lerpVectors(w.from, w.to.pos, k);
  camera.position.y += Math.sin(k * Math.PI) * 4;
  G.camLook.lerpVectors(w.fromLook, w.to.look, k);
  camera.lookAt(G.camLook);
  if (w.t >= 1) {
    G.walk = null;
    G.mode = goose.carry ? 'goose' : 'address';
    snapAddressCam();
    if (!maybeTomNudge()) checkStymie();
    const s = G.course.surf(G.ball.x, G.ball.z);
    if (G.holeIdx === 0 && G.strokes === 1 && !G.hintsShown.scopeTip && G.mode === 'address') { G.hintsShown.scopeTip = true; hud.hint('Tip: <b>right-click</b> (or Z) to scope the pin: rangefinder + wind.'); }
    if ((s === 'green' || s === 'fringe') && !G.hintsShown.green) { G.hintsShown.green = true; hud.hint('On the green. The <b>white chevrons</b> point downhill.'); }
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
  sfx.stymie(); say('stymie', vars(), { bump: 6 });
  hud.banner(`👻 ${G.ghostSource === 'pb' ? 'YOUR GHOST' : 'OLD TOM'} STYMIES YOU!<small>his ball drifts onto your line</small>`, 2600);
  hud.hint('<b>Stymie:</b> the ghost ball is solid. Curl a putt around it, or chip over it with the wedge (1–4 to switch).');
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
    hud.hint(full ? '<b>Stymie:</b> the ghost ball is solid. Curl a putt around it, or chip over it with the wedge.'
      : '<b>Half-stymie:</b> the solid ghost ball is near your line. Mind the break, or use it as a backstop.');
  }
}

// ============================================================ angler (Five Balls, One Life)
const angler = { active: false, t: 0, tension: 30, progress: 0, reeling: false, ph1: 0, ph2: 0, splash: null, from: null, clickT: 0 };
function startAngler(end, from) {
  G.mode = 'angler';
  ballMesh.visible = false;
  Object.assign(angler, { active: true, t: 0, tension: 30, progress: 0, reeling: false, ph1: Math.random() * 6, ph2: Math.random() * 6, splash: { x: end.x, z: end.z }, from });
  say('water', vars(), { bump: 20 });
  hud.banner('SPLASH!', 900);
  $('anglerTitle').textContent = `🎣 Reel in ${bag().name}!`;
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
  $('anglerTimer').textContent = `${Math.max(0, 7 - t).toFixed(1)} s`;
  // the ball fights back in tugs: a splash, a jolt of tension
  if (Math.floor(t / 1.4) !== Math.floor((t - k) / 1.4)) {
    angler.tension += 9; sfx.splashBob();
    const lk = G.anglerLook; burst(lk.x, lk.y + 0.05, lk.z, 14, 0xdff4ff, { speed: 1.5, up: 2.5, life: 0.7 });
    G.shake = Math.max(G.shake, 0.06);
  }
  if (angler.tension >= 100) endAngler(false, 'snap');
  else if (angler.progress >= 100) endAngler(true);
  else if (t >= 7) endAngler(false, 'slip');
}
function endAngler(won, why) {
  angler.active = false; angler.reeling = false;
  rod.visible = false;
  $('angler').classList.add('hidden');
  G.strokes++; // penalty stroke either way
  const shore = shorePoint(angler.splash, angler.from);
  const b = bag();
  if (won) {
    G.stats.ballsSaved++; moment(15, `Fished ${b.name} out of the drink`);
    sfx.catchBall();
    const junk = Math.random() < 0.3 ? JUNK[Math.floor(Math.random() * JUNK.length)] : null;
    if (junk) {
      G.stats.junk.push(junk); sfx.junk();
      hud.banner(`🎣 ${esc(b.name)}<small>…and ${esc(junk)}!</small>`, 2200);
      say('junk', vars(), { bump: 4 });
    } else { hud.banner(`🎣 ${esc(b.name)} LIVES!<small>+1 penalty stroke</small>`, 1800); say('saved', vars(), { bump: -6 }); }
  } else if (b.range) {
    // the range ball is immortal: nobody wants it, not even the lake
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
    if (!b.range) G.ballIdx++;
    renderBag();
    const nb = bag();
    if (G.ballIdx >= G.bag.length) setTimeout(() => say('rangeBall', vars(), { bump: 10 }), 2700);
    else setTimeout(() => { sfx.newBall(); hud.toast(`New ball: <b>${esc(nb.name)}</b> (${esc(nb.trait.label)}: ${esc(nb.trait.desc)})`); }, 2700);
  }
  G.ball = { x: shore.x, z: shore.z, y: G.course.h(shore.x, shore.z) + R };
  afterStroke(true);
}
function shorePoint(splash, from) {
  const dx = from.x - splash.x, dz = from.z - splash.z, L = Math.hypot(dx, dz) || 1;
  for (let d = 0; d < L + 40; d += 0.5) {
    const x = splash.x + dx / L * d, z = splash.z + dz / L * d;
    const s = G.course.surf(x, z);
    if (s !== 'water' && s !== 'oob') return { x: x + dx / L * 1.5, z: z + dz / L * 1.5 };
  }
  return { x: from.x, z: from.z };
}

// ============================================================ hole out
function moment(score, text) { if (!G.stats.moment || score > G.stats.moment.score) G.stats.moment = { score, text }; }
function holeOut(s) {
  G.mode = 'holed';
  const from = dist2(s.start, G.cup);
  moment(from * (G.strokes === 1 ? 4 : 1) + (s.wasBullet ? 10 : 0), `${G.strokes === 1 ? 'Ace' : 'Holed'} from ${from.toFixed(from < 10 ? 1 : 0)} m on hole ${G.holeIdx + 1}`);
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
  renderRace();
  broadcastHole(G.holeIdx + 1, n);
  G.celebrate = 2.7;
  updateHUD();
}
function nextHoleOrEnd() {
  if (G.holeIdx + 1 < HOLES.length) loadHole(G.holeIdx + 1);
  else endRound();
}

// ============================================================ camera
function addressCam() {
  const f = fwd(G.yaw);
  const putt = G.club === 'putter';
  const back = putt ? 1.75 : 2.35, up = putt ? 1.2 : 1.5;
  const base = G.mode === 'goose' && G.gooseLie ? G.gooseLie : G.ball;
  const pos = new THREE.Vector3(base.x - f.x * back, 0, base.z - f.z * back);
  pos.y = Math.max(base.y + up, G.course.h(pos.x, pos.z) + 1.1);
  const look = new THREE.Vector3(base.x + f.x * 20, base.y + 20 * Math.tan(G.pitch) + (up - 0.2), base.z + f.z * 20);
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
  if (G.club === 'putter') return;
  const key = `${base.x.toFixed(2)},${base.z.toFixed(2)},${G.yaw.toFixed(3)},${G.club},${G.wind.x.toFixed(2)},${G.ballIdx}`;
  const nowMs = performance.now();
  if (key !== lastPreview || G.previewDirty) {
    // only re-simulate once the aim has settled for 80 ms (cheap on a weak laptop)
    if (key !== G.previewKeyPending) { G.previewKeyPending = key; G.previewKeyAt = nowMs; }
    if (nowMs - G.previewKeyAt >= 80 || !lastPreview || G.previewDirty) {
      lastPreview = key; G.previewDirty = false;
      const sim = simulate({ course: G.course, cup: { x: 1e5, z: 1e5 }, wind: G.wind, trait: traitOf(bag()), colliders: G.colliders, untilCarry: true }, base, launch(G.club, 1, d.x, d.z, 0, 1, traitOf(bag())));
      G.previewCarry = { x: sim.carry.x, z: sim.carry.z };
    }
  }
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
function carrySamples() {
  const base = G.ball, d = aimDir(), tr = traitOf(bag());
  const world = { course: G.course, cup: { x: 1e5, z: 1e5 }, wind: G.wind, trait: tr, colliders: G.colliders, untilCarry: true };
  const S = CARRY_P.map(p => { const sim = simulate(world, base, launch(G.club, p, d.x, d.z, 0, 1, tr)); return { p, x: sim.carry.x, z: sim.carry.z }; });
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
  carry.calledT = Math.max(0, carry.calledT - dt);
  let pt = null, p = 0, frozen = false;
  if (swing.active && carry.samples) {
    p = swing.phase === 'back' ? swing.back : swing.peak;
    frozen = swing.phase !== 'back';
    if (p > 0.02) { pt = carryAt(p); carry.last = { pt, p }; }
  } else if (G.shot?.kind === 'player' && carry.flight && carry.mark && (!carry.hideAt || G.time < carry.hideAt)) {
    pt = carry.mark; p = carry.markP; frozen = true;
  }
  // the theremin follows predicted carry (putts: their roll distance, scaled up so you can hear it)
  if (swing.active) {
    if (swing.phase === 'back') swingTone.set(carry.samples ? (pt ? Math.hypot(pt.x - G.ball.x, pt.z - G.ball.z) : 0) : swing.back * puttRange() * 6);
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
  club.visible = show && !G.scoped;
  {
    const p = swing.active ? (swing.phase === 'back' ? swing.back : swing.peak) : 0;
    $('powerFill').style.height = `${Math.min(1.15, p) / 1.15 * 100}%`;
    const putt = G.club === 'putter';
    if (putt) $('powerLbl').textContent = `${(p * puttRange()).toFixed(1)} m`;
    else {
      const pt = carry.samples && p > 0.02 ? carryAt(p) : null, m = pt ? Math.round(Math.hypot(pt.x - G.ball.x, pt.z - G.ball.z)) : 0;
      $('powerLbl').innerHTML = carry.samples ? `${m} m<small>${m >= 5 ? esc(unitText(m)) : `${Math.round(p * 100)}%`}</small>` : `${Math.round(p * 100)}%`;
    }
    $('powerLbl').style.color = p > 1 ? '#ff6f61' : '#fff';
    // flat-green roll distance for this stroke: you still have to read the slope
    puttRing.visible = putt && swing.active && p > 0.01;
    if (puttRing.visible) {
      const base = G.mode === 'goose' && G.gooseLie ? G.gooseLie : G.ball, d = aimDir(), L = p * puttRange();
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
let locked = false;
const coarse = matchMedia('(pointer: coarse)').matches;
function lockPointer() {
  if (coarse || locked) return;
  const fallback = () => { try { const q = canvas.requestPointerLock(); q?.catch?.(() => {}); } catch { /* not allowed here */ } };
  try {
    const p = canvas.requestPointerLock({ unadjustedMovement: true });
    if (p?.catch) p.catch(fallback);
  } catch { fallback(); }
}
function inGame() { return !['title', 'end'].includes(G.mode) && $('help').classList.contains('hidden') && $('lb').classList.contains('hidden'); }
canvas.addEventListener('click', () => { if (inGame()) lockPointer(); });
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (!locked) { if (swing.active) cancelSwing(); setScope(false); }
  if (!locked && inGame() && !coarse) hud.hint(G.hintsShown.lockedOnce ? 'Click the course to aim with the mouse' : holeHint());
  if (locked) { G.hintsShown.lockedOnce = true; if (/Click the course/.test($('hint').innerHTML)) hud.hint(''); }
});
let dragging = null; // non-locked mouse / touch drag
canvas.addEventListener('pointerdown', e => {
  unlockAudio();
  if (!inGame()) return;
  if (G.mode === 'angler') { angler.reeling = true; return; }
  if (G.shot && G.shot.bullet && G.shot.wasBullet) { G.shot.t = G.shot.sim.n - 1; return; } // skip bullet cam
  if (G.mode === 'holed') { G.celebrate = Math.min(G.celebrate, 0.2); return; }
  if (e.button === 2) { setScope(true); return; }
  if (e.button !== 0) return;
  if (!locked && !coarse) return; // first click locks the pointer
  if (coarse) { dragging = { x: e.clientX, y: e.clientY, id: e.pointerId, mode: 'aim' }; canvas.setPointerCapture(e.pointerId); return; }
  beginSwing('mouse');
});
addEventListener('pointermove', e => {
  if (locked) {
    if (swing.active && swing.src === 'mouse') swingMove(e.movementX, e.movementY);
    else if (inGame() && (G.mode === 'address' || G.mode === 'goose' || G.mode === 'flight')) look(e.movementX, e.movementY);
    return;
  }
  if (dragging && dragging.id === e.pointerId) {
    const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
    dragging.x = e.clientX; dragging.y = e.clientY;
    if (dragging.mode === 'swing') swingMove(dx * 1.4, dy * 1.4);
    else look(dx * 1.6, dy * 1.6);
  }
});
addEventListener('pointerup', e => {
  if (G.mode === 'angler') angler.reeling = false;
  if (e.button === 2) setScope(false);
  if (dragging && dragging.id === e.pointerId) { if (dragging.mode === 'swing') endSwing(); dragging = null; return; }
  if (e.button === 0 && swing.active && swing.src === 'mouse') endSwing();
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => {
  if (!inGame()) return;
  e.preventDefault();
  const i = CLUB_ORDER.indexOf(G.club) + (e.deltaY > 0 ? 1 : -1);
  setClub(CLUB_ORDER[(i + 4) % 4]);
}, { passive: false });
function look(dx, dy) {
  if (G.mode === 'flight') return;
  const sens = 0.0022 * (G.scoped ? 0.16 : 1);
  G.yaw -= dx * sens;
  G.pitch = clamp(G.pitch - dy * sens, -0.75, 0.5);
}
const touchSwing = $('touchSwing');
touchSwing.addEventListener('pointerdown', e => {
  unlockAudio();
  if (G.mode === 'angler') { angler.reeling = true; return; }
  beginSwing('touch');
  dragging = { x: e.clientX, y: e.clientY, id: e.pointerId, mode: 'swing' };
  touchSwing.setPointerCapture(e.pointerId);
});
$('angler').addEventListener('pointerdown', e => { e.preventDefault(); unlockAudio(); if (G.mode === 'angler') angler.reeling = true; });
$('touchScope').addEventListener('pointerdown', e => { e.preventDefault(); setScope(!G.scoped); });

const keys = {};
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  keys[e.code] = true;
  if (!inGame()) return;
  if (e.code === 'Space') {
    e.preventDefault();
    if (e.repeat) return;
    unlockAudio();
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
  if (!(G.mode === 'address' || G.mode === 'goose') || swing.active && swing.src !== 'key') return;
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

// ============================================================ title / end
$('name').value = store.get('ghg_name') || store.get('golf_name') || '';
function playerNameNow() { return $('name').value.trim().slice(0, 20) || G.playerName || 'Player'; }
function beginPlay() {
  unlockAudio();
  G.playerName = playerNameNow();
  store.set('ghg_name', G.playerName);
  $('name').blur();
  $('title').classList.add('hidden'); $('end').classList.add('hidden');
  $('hud').classList.remove('hidden');
  canvas.focus({ preventScroll: true });
  if (coarse) { touchSwing.classList.remove('hidden'); $('touchScope').classList.remove('hidden'); }
  startRound();
  lockPointer();
}
$('play').addEventListener('click', () => { if (G.room) leaveRoom(); beginPlay(); });
$('name').addEventListener('keydown', e => { if (e.key === 'Enter') (G.room ? $('roomStart') : $('play')).click(); });

async function endRound() {
  G.mode = 'end';
  if (G.room) { roomSendProgress(); G.room.inRound = false; }
  if (document.pointerLockElement) document.exitPointerLock();
  const total = G.holeScores.reduce((s, v) => s + v, 0);
  const ghostTotal = G.ghostScores.reduce((s, v) => s + v, 0);
  const diff = total - TOTAL_PAR;
  // save the new ghost if this beat the old one
  let newGhost = false;
  if (!pbGhost || total < pbGhost.total) {
    try {
      const holes = G.roundRec.map(hs => hs.map(r => r.pen ? r : { sx: r.sx, sy: r.sy, sz: r.sz, holed: r.holed, res: r.res, f: r.f }));
      store.set('ghg3d_pb', JSON.stringify({ total, name: G.playerName, holes }));
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
    [st.bulletCams, st.bulletCams, 'bullet cams'], [st.called, st.called, 'called it'], [st.pure, st.pure, 'pure strikes'], [graveyard().length, graveyard().length, 'in the graveyard'],
  ].filter(t => t[0]).slice(0, 6);
  const moment = G.stats.moment ? `<div class="sub">⭐ Moment of the round: <b>${esc(G.stats.moment.text)}</b></div>` : '';
  $('endBody').innerHTML = `
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
  if (!complete) { renderBoard('bToday', null); renderBoard('bAll', null); return; }
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
    hud.toast(verb ? `<b>${esc(d.name)}</b> ${verb} hole ${d.hole}` : `<b>${esc(d.name)}</b> finished hole ${d.hole} in ${d.strokes}`);
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
    if (G.mode === 'walk' && G.walk) updateWalk(dt);
    else if (G.shot && G.flightCam && G.shot.kind === 'player') updateFlightCam(dt);
    else if (G.mode === 'angler') {
      const lk = G.anglerLook; camera.position.lerp(new THREE.Vector3(lk.x - fwd(G.yaw).x * 9, lk.y + 4, lk.z - fwd(G.yaw).z * 9), 1 - Math.exp(-dt * 2)); G.camLook.lerp(lk, 1 - Math.exp(-dt * 4)); camera.lookAt(G.camLook);
      updateAngler(dt);
      W.updateRod(rod, camera, lk, G.time, angler.tension, angler.progress);
      if (Math.random() < dt * 3) burst(lk.x, lk.y + 0.05, lk.z, 4, 0xdff4ff, { speed: 0.8, up: 1.2, life: 0.6 });
    } else if (G.mode === 'holed') {
      G.celebrate -= dt;
      const c = new THREE.Vector3(G.cup.x, G.course.h(G.cup.x, G.cup.z), G.cup.z);
      G.camLook.lerp(c, 1 - Math.exp(-dt * 3)); camera.lookAt(G.camLook);
      if (G.celebrate <= 0) nextHoleOrEnd();
    } else if (G.mode === 'gooseCam' && G.gooseCam) {
      updateGooseCam(dt);
    } else if (G.mode === 'gooseFetch') {
      const gp = new THREE.Vector3(goose.x, G.course.h(goose.x, goose.z) + 0.6, goose.z);
      const a = addressCam(); camera.position.lerp(a.pos, 1 - Math.exp(-dt * 3));
      G.camLook.lerp(gp, 1 - Math.exp(-dt * 4)); camera.lookAt(G.camLook);
    } else if (G.mode === 'address' || G.mode === 'goose' || G.mode === 'title') updateAddressCam(dt);
    if (!G.shot || G.shot.kind === 'shoo') ballMesh.position.set(G.ball.x, G.ball.y, G.ball.z);
    // camera shake
    if (G.shake > 0) {
      camera.position.x += (Math.random() - 0.5) * G.shake * 0.25;
      camera.position.y += (Math.random() - 0.5) * G.shake * 0.25;
      G.shake = Math.max(0, G.shake - dt * 1.5);
    }
    updateGoose(dt);
    updateClub(dt);
    updateCarryIndicator(dt);
    updateScope(dt);
    updatePreview();
    updateParticles(dt);
    W.waveFlag(G.flag, G.time, G.wind);
    G.flag.userData.beacon.material.opacity = G.scoped ? 0.05 : 0.18;
    const pinPos = new THREE.Vector3(G.cup.x, G.course.h(G.cup.x, G.cup.z) + 2.6, G.cup.z);
    const pd = camera.position.distanceTo(pinPos);
    pinLabel.visible = G.mode !== 'title' && pd > 35 && !G.scoped;
    if (pinLabel.visible) {
      const t = `⛳ ${dist2(G.ball, G.cup).toFixed(0)} m`;
      if (pinLabel.userData.text !== t) { pinLabel.userData.text = t; const nl = W.buildLabel(t, '#fff', 'rgba(220,40,60,0.8)'); pinLabel.material.map.dispose(); pinLabel.material.dispose(); pinLabel.material = nl.material; }
      scaleLabel(pinLabel, pinPos, 0.6, 0.04);
      pinLabel.position.y += pinLabel.scale.y * 1.6;   // sit above the goose label when they line up
    }
    const onGreen = ['green', 'fringe'].includes(G.course.surf(G.ball.x, G.ball.z)) && (G.mode === 'address');
    G.slope.visible = onGreen;
    if (onGreen) G.slope.material.opacity = 0.3 + 0.2 * Math.sin(G.time * 3);
    // labels + glow
    updateRivals(dt);
    ghostMesh.visible = G.mode !== 'title' && !G.room;
    const gHalo = ghostMesh.children[0];
    if (gHalo) gHalo.material.opacity = clamp((camera.position.distanceTo(ghostMesh.position) - 3) / 10, 0.05, 0.35);
    scaleLabel(ghostLabel, ghostMesh.position, 0.4, 0.04);
    ghostLabel.visible = G.mode !== 'title' && !G.room && camera.position.distanceTo(ghostMesh.position) > 4;
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
    out.push({ kind: 'sphere', x: p.x, y: p.y, z: p.z, r: GHOST_R, e: 0.85, tag: 'rival:' + r.id });
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
    hud.hint(`<b>Stymie:</b> ${esc(r.name)}'s ball is solid here. Curl round it, chip over it, or knock it for a carom.`);
    return;
  }
}
function finishRivalShot(r, silent) {
  const pl = r.playing; if (!pl) return;
  r.playing = null;
  if (silent) return;
  const end = frameAt(pl.shot, pl.shot.n - 1);
  const col = new THREE.Color(r.hex).getHex();
  if (pl.shot.result === 'holed') { sfx.tick(); burst(G.cup.x, G.course.h(G.cup.x, G.cup.z) + 0.25, G.cup.z, 24, col, { speed: 1.6, up: 2.4, life: 1.1, grav: 2 }); }
  else if (pl.shot.result === 'water') burst(end.x, end.y, end.z, 26, 0xbfe6ff, { speed: 2, up: 4, life: 1 });
}
function updateRivals(dt) {
  const show = G.room && G.room.inRound && !['title', 'end'].includes(G.mode);
  for (const r of rivals.values()) {
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
  }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) for (const r of rivals.values()) if (r.playing) finishRivalShot(r, true); });

function standings() {
  const par = i => HOLES[i]?.par ?? 0;
  const myScores = G.holeScores.filter(Number.isInteger);
  const rows = [{ id: G.room?.me, me: true, name: G.playerName, hex: ROOM_COLORS[(G.room?.myColor ?? 2) % ROOM_COLORS.length], scores: myScores, hole: G.holeIdx + 1, done: G.mode === 'end' || myScores.length === HOLES.length, online: true }];
  if (sameRound()) for (const r of rivals.values()) {
    const p = r.prog ?? {};
    rows.push({ id: r.id, name: r.name, hex: r.hex, scores: Array.isArray(p.scores) ? p.scores : [], hole: p.hole ?? 0, done: !!p.done, online: r.online });
  }
  for (const x of rows) { x.toPar = x.scores.reduce((s, v, i) => s + v - par(i), 0); x.thru = x.scores.length; x.total = x.scores.reduce((a, b) => a + b, 0); }
  rows.sort((a, b) => a.toPar - b.toPar || b.thru - a.thru || (a.me ? -1 : b.me ? 1 : 0));
  rows.forEach((x, i) => { x.pos = i > 0 && rows[i - 1].toPar === x.toPar ? rows[i - 1].pos : i + 1; });
  for (const x of rows) x.tie = rows.filter(y => y.pos === x.pos).length > 1;
  return rows;
}
const thruTxt = x => x.done ? 'F' : x.thru ? `thru ${x.thru}` : x.hole ? `on ${x.hole}` : '—';
function updateRoomRace() {
  if (!G.room || !G.holeDef) return;
  const rows = standings(), me = rows.find(x => x.me), n = rows.length;
  if (G.room.inRound && n > 1 && G.room.lastPos && me.pos !== G.room.lastPos) {
    const tiedWith = rows.find(x => !x.me && x.pos === me.pos);
    if (me.pos < G.room.lastPos) {
      const passed = rows.find(x => !x.me && x.pos > me.pos);
      if (tiedWith) { sfx.tick(); say('roomLevel', { ...vars(), rival: tiedWith.name }, { bump: -3 }); }
      else if (passed) { sfx.overtake(); say('roomOvertake', { ...vars(), rival: passed.name }, { bump: -6 }); }
    } else {
      const ahead = rows.filter(x => !x.me && x.pos < me.pos).at(-1);
      if (ahead) { sfx.fallBehind(); setTimeout(() => say('roomFallBehind', { ...vars(), rival: ahead.name }, { bump: 6 }), 1200); }
    }
  }
  G.room.lastPos = me.pos;
  const net = G.room.closed ? ' · closed' : G.room.client.connected ? '' : ' · reconnecting…';
  $('raceWho').textContent = `🏁 Room ${G.room.code}${net}`;
  const el = $('raceStatus');
  el.className = n === 1 ? 'level' : me.pos === 1 ? 'ahead' : me.pos === rows.at(-1).pos ? 'behind' : 'level';
  const allSquare = n > 1 && rows.every(x => x.toPar === me.toPar);
  if (allSquare) el.className = 'level';
  el.textContent = n === 1 ? 'WAITING FOR FRIENDS' : allSquare ? 'ALL SQUARE' : `${me.tie ? 'TIED ' : ''}${ordinal(me.pos).toUpperCase()} OF ${n}`;
  $('raceDetail').innerHTML = rows.slice(0, 6).map(x => `<div class="rrow${x.me ? ' me' : ''}${x.online ? '' : ' off'}"><i style="background:${x.hex}"></i>${esc(x.name)}<b>${fmtPar(x.toPar)}</b><small>${thruTxt(x)}</small></div>`).join('');
  if (G.mode === 'end') renderRoomFinal();
}
function renderRoomFinal() {
  const el = $('roomFinal'); if (!el || !G.room) return;
  const rows = standings();
  el.innerHTML = rows.map(x => `<li class="${x.me ? 'me' : ''}${x.online ? '' : ' off'}"><span class="dot" style="background:${x.hex}"></span>${x.tie ? 'T' : ''}${x.pos}. ${esc(x.name)}<b>${fmtPar(x.toPar)}</b><small>${x.done ? `${x.total} strokes` : thruTxt(x)}</small></li>`).join('');
  const waiting = rows.filter(x => !x.done && x.online).length;
  const me = rows.find(x => x.me);
  $('roomFinalNote').textContent = rows.length === 1 ? 'Nobody else finished this round.'
    : waiting ? `Waiting on ${waiting} player${waiting === 1 ? '' : 's'}…` : me.pos === 1 ? (me.tie ? 'A shared victory. Insufferable, all of you.' : 'You won the room! 🏆') : `${ordinal(me.pos)} place. There's always next round.`;
}

// ---- sending
function roomProgress(extra = {}) {
  if (!G.room?.inRound || !sameRound()) return null;
  const holed = G.mode === 'holed' || G.mode === 'end';
  return {
    hole: G.holeIdx + 1, strokes: G.strokes, scores: G.holeScores.filter(Number.isInteger),
    rest: holed ? null : { x: G.ball.x, y: G.ball.y, z: G.ball.z }, holed, done: G.mode === 'end', ball: bag().name, ...extra,
  };
}
function roomSendProgress() {
  const p = roomProgress(); if (!p) return;
  G.room.client.send({ type: 'progress', round: G.room.playingRound, progress: p });
  updateRoomRace();
}
function roomSendShot(start, sim, clubId) {
  const p = roomProgress({ rest: sim.result === 'rest' ? { x: sim.end.x, y: sim.end.y, z: sim.end.z } : null, holed: sim.result === 'holed' });
  if (!p) return;
  G.room.client.send({ type: 'shot', round: G.room.playingRound, hole: G.holeIdx + 1, stroke: G.strokes, start: { x: start.x, y: start.y, z: start.z }, res: sim.result, club: clubId, f: encodeFrames(sim), progress: p });
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
  if (ev.progress) r.prog = ev.progress;
  if (sameRound() && G.room.inRound && ev.hole === G.holeIdx + 1 && Array.isArray(ev.f) && ev.f.length >= 3) {
    if (r.playing) finishRivalShot(r, true);
    const { frames, n } = decodeFrames(ev.f);
    r.playing = { shot: { frames, n, result: ev.res }, t: 0, pos: { x: frames[0], y: frames[1], z: frames[2] } };
    if (dist2(r.playing.pos, G.ball) < 40) sfx.strike(false, ev.club);   // you hear a friend's shot nearby
  }
  updateRoomRace();
}
function onRoomProgress(ev) {
  if (!G.room || ev.round !== G.room.round) return;
  const r = rivals.get(ev.from); if (!r) return;
  r.prog = ev.progress;
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
  beginRoomRound();
}
function beginRoomRound() {
  G.room.playingRound = G.room.round; G.room.inRound = true;
  for (const r of rivals.values()) r.scoresSeen = r.prog?.scores?.length ?? 0;
  beginPlay();
  if (!coarse) hud.hint('Click the course to aim with the mouse');
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
    onState: onRoomState, onShot: onRoomShot, onProgress: onRoomProgress, onStart: onRoomStart,
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
  catch (e) { roomErr(e.message); }
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
  if (G.room.hostId !== G.room.me) { if (G.room.started) beginRoomRound(); return; }
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
      goose: { state: goose.state, x: goose.x, z: goose.z, carrying: goose.carry, frozen: goose.frozen },
      ghost: G.ghost ? { source: G.ghostSource, x: gp.x, y: gp.y, z: gp.z, stroke: G.ghost.played, total: G.ghost.strokes.length, race: G.race.status } : null,
      scoped: G.scoped, breath: G.breath, gasp: G.gasp, holding: G.holding, sway: { ...G.sway }, swayAmp: G.swayAmp ?? 0, fov: camera.fov,
      angler: { active: angler.active, tension: angler.tension, progress: angler.progress, t: angler.t },
      shot: G.shot ? { t: G.shot.t, n: G.shot.sim.n, result: G.shot.sim.result, bullet: !!G.shot.bullet, inBullet: !!G.shot.wasBullet, kind: G.shot.kind } : null,
      stats: G.stats ? { ...G.stats } : null, fps: G.fps, cup: G.cup, graveyard: graveyard().length,
    };
  },
  start(name = 'Robot') { $('name').value = name; $('play').click(); },
  swing({ club, power = 1, tempo = 1, drift = 0, yaw } = {}) {
    if (!canSwing()) return false;
    if (club) setClub(club);
    if (yaw !== undefined) G.yaw = yaw;
    if (G.mode === 'goose') goose.frozen = true;
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
  place(x, z) { G.ball = { x, z, y: G.course.h(x, z) + R }; G.lastLie = { ...G.ball }; aimAtPoint(G.cup.x, G.cup.z); autoClub(); snapAddressCam(); updateHUD(); },
  placeGhost(x, z) { G.ghost.rest = { x, y: G.course.h(x, z) + R, z }; G.ghost.strokes = G.ghost.strokes.slice(0, G.strokes); placeGhostMesh(G.ghost.rest); G.ghost._override = true; },
  placeGoose(x, z) { goose.x = x; goose.z = z; goose.state = 'graze'; goose.target = null; },
  skip() { if (G.shot) G.shot.t = G.shot.sim.n - 1; if (G.walk) G.walk.t = 1; if (G.mode === 'holed') G.celebrate = 0; },
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
    return { code: G.room.code, me: G.room.me, host: G.room.hostId === G.room.me, round: G.room.round, playingRound: G.room.playingRound, inRound: G.room.inRound, connected: G.room.client.connected, closed: !!G.room.closed,
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
// Old Tom plans holes 2-4 while the player reads the title card.
[1, 2, 3].forEach((i, k) => setTimeout(() => ensureTom(i), 600 + k * 250));
