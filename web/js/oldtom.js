// Old Tom, the club pro buried by the first tee, plays every hole once in the
// physics sim and leaves a deterministic ghost round for round-1 players to
// race. Pure JS (no Three.js): it's a brute-force search over club, power and
// aim for each stroke, scored on where the ball ends up.

import { simulate, launch, prepColliders } from './physics.js';

// Tom's human error: [power, line] as fractions / radians, putts and full swings
export const ERR = { putt: [0.22, 0.04], full: [0.13, 0.08] };
const PEN = { water: 400, oob: 400, sand: 14, rough: 7, green: -4, fringe: 0, fairway: 0, tee: 0 };

function score(course, cup, shot, lie, mode) {
  if (shot.result === 'holed') return -1000;
  if (shot.result === 'water' || shot.result === 'oob') return 1e6;
  const d = Math.hypot(shot.end.x - cup.x, shot.end.z - cup.z);
  if (mode === 'stymie') {
    // Hole 3: Tom parks his approach on the green ~3 m short of the cup,
    // on the line in from the fairway, so his ball sits where your putt goes.
    const fx = cup.x - lie.x, fz = cup.z - lie.z, fl = Math.hypot(fx, fz) || 1;
    const tx = cup.x - fx / fl * 3.2, tz = cup.z - fz / fl * 3.2;
    const off = Math.hypot(shot.end.x - tx, shot.end.z - tz);
    return shot.end.surface === 'green' ? off : off + 30;
  }
  return d + (PEN[shot.end.surface] ?? 5);
}

// One stroke: returns the chosen {start, L, shot}.
// Tiny seeded PRNG so Tom's human error is identical on every machine.
function mulberry32(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function planStroke(course, cup, colliders, lie, stroke, holeDef, rng, wind, strokeNo = stroke) {
  const holePar = holeDef.par;
  const dx = cup.x - lie.x, dz = cup.z - lie.z, dist = Math.hypot(dx, dz);
  const surf = course.surf(lie.x, lie.z);
  const base = Math.atan2(dz, dx);
  const world = { course, cup, colliders, wind, strokeNo };
  const putting = (surf === 'green' || surf === 'fringe') && dist < 24;
  const mode = holeDef.spotlight === 'stymie' && !putting && dist < 140 ? 'stymie' : 'normal';
  const cands = [];
  const tryShot = (club, power, ang) => {
    const L = launch(club, power, Math.cos(ang), Math.sin(ang), 0, 1);
    const shot = simulate(world, lie, L);
    cands.push({ s: score(course, cup, shot, lie, mode), club, power, ang });
  };
  if (putting) {
    // Putt: fine power search straight at the hole plus small break offsets.
    if (holeDef.mini) {
      // crazy golf: a wide fan so he finds the bank shots off the rails
      for (const off of [0, -0.03, 0.03, -0.06, 0.06, -0.1, 0.1, -0.15, 0.15, -0.22, 0.22, -0.3, 0.3])
        for (let p = 0.04; p <= 1.15; p += 0.03) tryShot('putter', p, base + off);
    } else for (const off of [0, -0.02, 0.02, -0.045, 0.045, -0.08, 0.08])
      for (let p = 0.04; p <= 1.0; p += 0.02) tryShot('putter', p, base + off);
  } else {
    const clubs = dist > 125 ? ['driver', 'iron'] : dist > 70 ? ['iron', 'wedge', 'driver'] : ['wedge', 'iron'];
    if (stroke === 1 && holePar >= 4) clubs.splice(0, clubs.length, 'driver', 'iron');
    for (const club of clubs)
      for (const off of [0, -0.06, 0.06, -0.13, 0.13])
        for (let p = 0.25; p <= 1.0001; p += 0.05) tryShot(club, Math.min(1, p), base + off);
  }
  // A real pro picks the shot that still works when he mishits it a bit:
  // re-test the best few with power/line errors and keep the best worst case.
  cands.sort((a, b) => a.s - b.s);
  let best = null;
  for (const c of cands.slice(0, 10)) {
    let worst = c.s;
    const dp = c.club === 'putter' ? 0.06 : 0.07, da = c.club === 'putter' ? 0.012 : 0.04;
    for (const [ep, ea] of [[dp, 0], [-dp, 0], [0, da], [0, -da]]) {
      const L = launch(c.club, c.power * (1 + ep), Math.cos(c.ang + ea), Math.sin(c.ang + ea), 0, 1);
      worst = Math.max(worst, score(course, cup, simulate(world, lie, L), lie, mode));
    }
    const s = (c.s + worst * 2) / 3;
    if (!best || s < best.s) best = { ...c, s };
  }
  // Tom picks the right shot, then swings like a human: a little off on
  // power and line. Deterministic (seeded), so his ghost is the same for all.
  const putt = best.club === 'putter';
  const e1 = rng() * 2 - 1, e2 = rng() * 2 - 1;
  const sharp = mode === 'stymie' ? 0.3 : 1;                 // he means it on hole 3
  // tuned so he shoots a few over par (playtest: "make the ghost easier to beat")
  const ep = e1 * (putt ? ERR.putt[0] : ERR.full[0]) * sharp, ea = e2 * (putt ? ERR.putt[1] : ERR.full[1]) * sharp;
  const L = launch(best.club, best.power * (1 + ep), Math.cos(best.ang + ea), Math.sin(best.ang + ea), 0, 1);
  const shot = simulate(world, lie, L);
  return { start: { x: lie.x, z: lie.z, y: course.h(lie.x, lie.z) + 0.07 }, L, shot, putt };
}

// Plan the whole hole. Returns an array of strokes; the last one is holed
// unless Tom gave up (cap 8).
// `salt` varies his round (solo rounds pass the round seed) so he has good days and bad.
export function planHole(course, holeDef, cup, colliders, teeOffset = { x: -1.3, z: 0 }, salt = 0) {
  const rng = mulberry32(((holeDef.seed ?? 1) * 7919) ^ salt);
  // Tom played on a day with this hole's usual breeze (fixed, so his ghost is
  // the same for everyone even though your wind varies per round).
  const wa = (holeDef.seed ?? 1) * 1.7, ws = (holeDef.wind ?? 0) * 0.8;
  const wind = { x: Math.cos(wa) * ws, z: Math.sin(wa) * ws };
  if (Array.isArray(colliders)) colliders = prepColliders(colliders);
  let lie = { x: holeDef.tee[0] + teeOffset.x, z: holeDef.tee[1] + teeOffset.z };
  const strokes = [];
  for (let k = 1; k <= 8; k++) {
    const st = planStroke(course, cup, colliders, lie, k, holeDef, rng, wind, strokes.length + 1);
    strokes.push(st);
    if (st.shot.result === 'holed') break;
    if (st.shot.result === 'water' || st.shot.result === 'oob') {
      st.penalty = 1; // stroke and distance: the ghost replays from the same lie
      strokes.push({ ...st, penaltyOnly: true });
      lie = { x: st.start.x, z: st.start.z };
      continue;
    }
    lie = { x: st.shot.end.x, z: st.shot.end.z };
  }
  return strokes;
}
