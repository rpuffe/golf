// Deterministic ball physics. A shot is simulated in full at impact (fixed
// 240 Hz step, no randomness) and recorded into a frame buffer; the renderer,
// the slow-mo bullet-cam, the ghost replays and the scope preview all just
// read frames. Pure JS: no Three.js, so Node can run it headless.

import { SURF } from './course.js';

export const R = 0.07;          // ball radius (m) — chunkier than real so it reads in first person
export const CUP_R = 0.24;      // cup radius (m): generous, about 3.4 ball radii, so a good read gets rewarded
export const G = 9.81;
export const DT = 1 / 240;      // physics step
export const REC = 2;           // record every 2nd step -> 120 frames per second of sim
export const FPS = 1 / (DT * REC);
const DRAG = 0.0036;            // quadratic air drag (1/m)
const SIDE_K = 0.055;           // sidespin curve strength
const MAX_T = 28;
const GREEN_SLOPE = 0.5;        // fraction of slope gravity felt while rolling on a green

export const CLUBS = {
  driver: { id: 'driver', name: 'Driver', short: '1W', speed: 47, angle: 15, lift: 0.11, check: 1.0,  curve: 1.0,  range: 125 },
  iron:   { id: 'iron',   name: '7 Iron', short: '7i', speed: 36, angle: 22, lift: 0.09, check: 0.75, curve: 0.75, range: 95 },
  wedge:  { id: 'wedge',  name: 'Wedge',  short: 'SW', speed: 25, angle: 46, lift: 0.05, check: 0.4,  curve: 0.45, range: 58 },
  putter: { id: 'putter', name: 'Putter', short: 'PT', speed: 5,  angle: 0,  lift: 0,    check: 1.0,  curve: 0.12, range: 20 },
};
export const CLUB_ORDER = ['driver', 'iron', 'wedge', 'putter'];

export const NO_TRAIT = { speed: 1, bounce: 1, roll: 1, capture: 1, wind: 1, side: 1 };

// Turn a swing into a launch. Fully deterministic in its inputs.
//   power: 0..1.15 (>1 is an overswing: more speed, less control)
//   drift: -1..1 sideways mouse drift through impact (+ = right / slice)
//   tempo: 0..1 how crisp the downswing was (1 = ideal)
export function launch(clubId, power, dirX, dirZ, drift = 0, tempo = 1, trait = NO_TRAIT) {
  const c = CLUBS[clubId];
  const p = Math.max(0.03, Math.min(1.15, power));
  const t = Math.max(0, Math.min(1, tempo));
  let d = Math.max(-1, Math.min(1, drift));
  if (p > 1) d += Math.sign(d || -1) * (p - 1) * 2.2;     // overswing exaggerates (or adds a hook)
  // a lazy downswing loses speed, but not on the putter: a slow, smooth putt
  // stroke is good technique, so putt distance is power alone (what the ring shows)
  const strike = c.id === 'putter' ? 1 : 0.82 + 0.18 * t;
  // sqrt: distance (~v^2) then scales roughly linearly with power, so a
  // half swing goes about half as far — partial shots are learnable.
  const v = c.speed * Math.sqrt(p) * strike * trait.speed;
  const face = d * 0.11 * (c.id === 'putter' ? 0.35 : 1); // radians the face is open/closed
  const cs = Math.cos(face), sn = Math.sin(face);
  const len = Math.hypot(dirX, dirZ) || 1;
  const fx = dirX / len, fz = dirZ / len;
  // rotate forward by +face toward the right vector (-fz, fx)
  const hx = fx * cs + (-fz) * sn, hz = fz * cs + fx * sn;
  const a = c.angle * Math.PI / 180 * (0.85 + 0.15 * t);
  const pure = Math.abs(drift) < 0.08 && t > 0.85 && p >= 0.55 && p <= 1.0;
  return {
    vx: hx * v * Math.cos(a), vy: v * Math.sin(a), vz: hz * v * Math.cos(a),
    side: d * c.curve * 1.4 * trait.side, lift: c.lift, check: c.check,
    rolling: c.angle === 0, club: c.id, pure, power: p,
  };
}

// Bucket colliders into a 10 m grid once so each physics step only tests
// the handful near the ball (a hole has hundreds of trees).
const CELL = 10;
export function prepColliders(list) {
  const cells = new Map();
  for (const c of list) {
    const r = (c.r ?? 0) + 0.5;
    const i0 = Math.floor((c.x - r) / CELL), i1 = Math.floor((c.x + r) / CELL);
    const j0 = Math.floor((c.z - r) / CELL), j1 = Math.floor((c.z + r) / CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = i * 100003 + j;
      let b = cells.get(k); if (!b) cells.set(k, b = []);
      b.push(c);
    }
  }
  return { cells, list };
}
const EMPTY = [];

// world: { course, wind:{x,z}, cup:{x,z}, colliders: prepColliders(...) | [...], ghost:(frame)=>{x,y,z}|null, trait }
// collider kinds: {kind:'sphere', x,y,z,r, e, tag} (hard) · {kind:'canopy', x,y,z,r, tag} (soft)
//                 {kind:'cyl', x,z,r,y0,y1, e, tag}
export function simulate(world, start, L) {
  const { course } = world;
  const trait = world.trait ?? NO_TRAIT;
  const wind = world.wind ?? { x: 0, z: 0 };
  const cup = world.cup;
  const cupY = course.h(cup.x, cup.z);
  // power-up hooks: a bigger cup, lighter gravity (all optional, default to normal golf)
  const CR = world.cupR ?? CUP_R, Gs = G * (world.gravity ?? 1);
  const maxFrames = Math.ceil(MAX_T * FPS) + 2;
  const frames = new Float32Array(maxFrames * 3);
  const events = [];
  let x = start.x, z = start.z, y = start.y ?? course.h(x, z) + R;
  let vx = L.vx, vy = L.vy, vz = L.vz;
  let side = L.side, lift = L.lift;
  let air = !L.rolling;
  let bounces = 0, lipping = false, inCanopy = new Set(), touchedGhost = false;
  const knocked = new Set();   // rival balls this shot has knocked away (they're rolling now, not here)
  let fi = 0, step = 0, result = 'rest', apex = y, carry = null;
  const n = { x: 0, y: 1, z: 0 };
  let grid = world.colliders ?? [];
  if (Array.isArray(grid)) grid = prepColliders(grid);
  const extra = world.dynamic ?? EMPTY;   // few, unbucketed (the geese, rival balls)
  const noTrees = !!world.noTrees;          // Ghost Ball power-up: through trees, tombstones and the windmill
  const ag = (course.hole?.airGravity ?? 1) * (world.airGravity ?? 1);   // moon gravity, in the air only
  // Hole 5's windmill: blades sweep the plane z = pz, turning only while a ball
  // flies. The angle is a pure function of the stroke number and sim time, so
  // the player, the preview, rivals and Old Tom all see the same blades.
  const wm = course.hole?.windmill;
  const wmD = wm ? { hx: wm.at[0], hy: course.h(wm.at[0], wm.at[1]) + wm.hubH, pz: wm.at[1] + wm.face, len: wm.len, n: wm.blades, w: 2 * Math.PI / wm.period, th0: world.wmPhase ?? (world.strokeNo ?? 1) * wm.step } : null;
  let swatted = false;
  // Hole 7's boss goose bends space: the Honk Hole, a horizontal whirlpool
  // around its throne (pulls in, swirls anticlockwise). Deterministic, so the
  // carry preview, rivals and Old Tom all see the same bend.
  const ba = !world.noAura && course.hole?.bossAura;
  const baY = ba ? course.h(ba.at[0], ba.at[1]) : 0;
  let auraTold = false;
  const aura = (x, y, z, out) => {
    const dx = ba.at[0] - x, dz = ba.at[1] - z, r = Math.hypot(dx, dz);
    if (r >= ba.r || r < 1e-3) { out.x = out.z = out.f = 0; return out; }
    const ux = dx / r, uz = dz / r;
    const hk = Math.max(0, Math.min(1, (ba.top + ba.fade - (y - baY)) / ba.fade));
    const c = Math.max(0, Math.min(1, (r - 0.5) / (ba.core - 0.5))), ck = c * c * (3 - 2 * c);
    const f = (1 - r / ba.r) * ck * hk;
    out.x = f * (ba.pull * ux + ba.swirl * -uz); out.z = f * (ba.pull * uz + ba.swirl * ux); out.f = f;
    return out;
  };
  const A = { x: 0, z: 0, f: 0 };
  const ev = (type, extra = {}) => events.push({ type, frame: fi, x, y, z, ...extra });
  const rec = () => { frames[fi * 3] = x; frames[fi * 3 + 1] = y; frames[fi * 3 + 2] = z; fi++; };
  rec();

  outer:
  for (step = 1; step <= MAX_T / DT; step++) {
    // ------------------------------------------------------------- forces
    if (air) {
      const w = trait.wind;
      const rx = vx - wind.x * w, rz = vz - wind.z * w;
      const sp = Math.hypot(rx, vy, rz);
      let ax = -DRAG * sp * rx, ay = (-Gs + lift * sp) * ag - DRAG * sp * vy, az = -DRAG * sp * rz;
      ax += side * SIDE_K * (-vz); az += side * SIDE_K * vx;
      if (ba) { aura(x, y, z, A); ax += A.x; az += A.z; if (!auraTold && A.f > 0.15) { auraTold = true; ev('aura', { speed: A.f }); } }
      lift *= 0.9993;
      vx += ax * DT; vy += ay * DT; vz += az * DT;
      x += vx * DT; y += vy * DT; z += vz * DT;
      if (y > apex) apex = y;
    } else {
      course.normal(x, z, n);
      const s = course.surf(x, z);
      // gravity along the slope. Greens play at about half their visual slope
      // (arcade putting): you still read the break and the hill, but a 2%
      // uphill putt costs ~12% of its roll, not 25%, so the roll ring stays a fair guide.
      const gk = s === 'green' || s === 'fringe' ? GREEN_SLOPE : 1;
      const gn = -G * n.y;                      // g·n
      let ax = -gn * n.x * gk, ay = (-G - gn * n.y) * gk, az = -gn * n.z * gk;
      if (ba && s !== 'green' && s !== 'fringe' && Math.hypot(vx, vy, vz) > 0.35) {
        // on the ground it only nudges, capped below rolling friction so every ball still stops
        aura(x, y, z, A);
        const m = Math.hypot(A.x, A.z);
        if (m > 0) { const k = Math.min(m * ba.ground, 0.8 * (SURF[s] ?? SURF.rough).roll) / m; ax += A.x * k; az += A.z * k; }
        if (!auraTold && A.f > 0.15) { auraTold = true; ev('aura', { speed: A.f }); }
      }
      vx += ax * DT; vy += ay * DT; vz += az * DT;
      // keep velocity in the tangent plane
      const vn = vx * n.x + vy * n.y + vz * n.z;
      vx -= vn * n.x; vy -= vn * n.y; vz -= vn * n.z;
      // rolling resistance
      let decel = (SURF[s] ?? SURF.rough).roll * (s === 'green' || s === 'fringe' || s === 'fairway' ? trait.roll : 1);
      const sp = Math.hypot(vx, vy, vz);
      // a slow ball "dies": grass grips harder in the last metre of roll
      decel *= 1 + 0.8 * Math.max(0, 1 - sp / 0.9);
      const slopeAcc = G * gk * Math.sqrt(Math.max(0, 1 - n.y * n.y));
      if ((sp < 0.05 && slopeAcc < decel * 0.95) || (sp < 0.12 && slopeAcc < decel * 1.4)) { vx = vy = vz = 0; result = 'rest'; break outer; }
      const k = sp > decel * DT ? (sp - decel * DT) / sp : 0;
      vx *= k; vy *= k; vz *= k;
      x += vx * DT; z += vz * DT;
      const gy = course.h(x, z) + R;
      const ny = y + vy * DT;
      if (ny > gy + 0.035 && sp > 2) { air = true; y = ny; }   // launched off a crest
      else y = gy;
    }

    // --------------------------------------------------------- colliders
    const bucket = grid.cells.get(Math.floor(x / CELL) * 100003 + Math.floor(z / CELL)) ?? EMPTY;
    for (let ci = 0, cn = bucket.length + extra.length; ci < cn; ci++) {
      const c = ci < bucket.length ? bucket[ci] : extra[ci - bucket.length];
      if (noTrees && (c.tag === 'tree' || c.tag === 'tomb' || c.tag === 'windmill')) continue;
      if (c.push && knocked.has(c)) continue;
      if (c.kind === 'sphere') {
        const dx = x - c.x, dy = y - c.y, dz = z - c.z, rr = c.r + R;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < rr * rr) {
          const d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d, nz = dz / d;
          const vn = vx * nx + vy * ny + vz * nz;
          if (vn < 0 && c.push) {
            // Knock-On: an equal-mass exchange with a friend's resting ball, which leaves along -n
            const k = (1 + (c.e ?? 0.9)) / 2;
            const tvx = k * vn * nx, tvz = k * vn * nz;
            vx -= k * vn * nx; vy -= k * vn * ny; vz -= k * vn * nz;
            knocked.add(c);
            ev('knock', { tag: c.tag, vx: tvx, vz: tvz, speed: Math.hypot(tvx, tvz) });
            continue;
          }
          if (vn < 0) {
            const e = c.e ?? 0.5;
            vx -= (1 + e) * vn * nx; vy -= (1 + e) * vn * ny; vz -= (1 + e) * vn * nz;
            ev('hit', { tag: c.tag, speed: -vn });
            if (ny > 0.2 && !air) air = true;
          }
          x = c.x + nx * rr; y = c.y + ny * rr; z = c.z + nz * rr;
        }
      } else if (c.kind === 'cyl') {
        if (y < c.y0 || y > c.y1 + R) continue;
        const dx = x - c.x, dz = z - c.z, rr = c.r + R, d2 = dx * dx + dz * dz;
        if (d2 < rr * rr) {
          const d = Math.sqrt(d2) || 1e-6, nx = dx / d, nz = dz / d;
          const vn = vx * nx + vz * nz;
          if (vn < 0) {
            const e = c.e ?? 0.45;
            vx -= (1 + e) * vn * nx; vz -= (1 + e) * vn * nz;
            ev('hit', { tag: c.tag, speed: -vn });
          }
          x = c.x + nx * rr; z = c.z + nz * rr;
        }
      } else if (c.kind === 'canopy') {
        const dx = x - c.x, dy = (y - c.y) * 1.25, dz = z - c.z;
        const inside = dx * dx + dy * dy + dz * dz < c.r * c.r;
        if (inside) {
          if (!inCanopy.has(c)) { inCanopy.add(c); ev('leaves', { tag: c.tag, speed: Math.hypot(vx, vy, vz) }); }
          const k = 1 - 3.2 * DT;
          vx *= k; vz *= k; if (vy > 0) vy *= k;
          lift = 0; side *= 0.98;
        } else inCanopy.delete(c);
      }
    }
    if (wmD && !noTrees && Math.abs(z - wmD.pz) < 1.0 && (x - wmD.hx) ** 2 + (y - wmD.hy) ** 2 < (wmD.len + 1) ** 2) {
      const th = wmD.th0 + wmD.w * step * DT, rr = 0.8 + R;
      blades:
      for (let b = 0; b < wmD.n; b++) {
        const a = th + b * 2 * Math.PI / wmD.n, ca = Math.cos(a), sa = Math.sin(a);
        for (let k = 1; k <= 5; k++) {
          const rho = wmD.len * k / 5, sx = wmD.hx + ca * rho, sy = wmD.hy + sa * rho;
          const ex = x - sx, ey = y - sy, ez = z - wmD.pz, d2 = ex * ex + ey * ey + ez * ez;
          if (d2 >= rr * rr) continue;
          const d = Math.sqrt(d2) || 1e-6, nx = ex / d, ny = ey / d, nz = ez / d;
          const bvx = -wmD.w * rho * sa, bvy = wmD.w * rho * ca;
          const vn = (vx - bvx) * nx + (vy - bvy) * ny + vz * nz;
          if (vn < 0) {
            vx -= 1.7 * vn * nx; vy -= 1.7 * vn * ny; vz -= 1.7 * vn * nz; air = true;
            if (!swatted) { swatted = true; ev('hit', { tag: 'windmill', speed: -vn }); }
          }
          x = sx + nx * rr; y = sy + ny * rr; z = wmD.pz + nz * rr;
          break blades;
        }
      }
    }
    // Rival ghost ball: solid, one-way.
    if (world.ghost) {
      const gp = world.ghost(fi);
      if (gp) {
        const dx = x - gp.x, dy = y - gp.y, dz = z - gp.z, rr = R + (world.ghostR ?? R);
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < rr * rr && d2 > 1e-10) {
          const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, nz = dz / d;
          const rvx = vx - gp.vx, rvy = vy - gp.vy, rvz = vz - gp.vz;
          const vn = rvx * nx + rvy * ny + rvz * nz;
          if (vn < 0) {
            vx -= 1.85 * vn * nx; vy -= 1.85 * vn * ny; vz -= 1.85 * vn * nz;
            if (!touchedGhost) ev('ghost', { speed: -vn });
            touchedGhost = true;
            if (!air && ny > 0.3) air = true;
          }
          x = gp.x + nx * rr; y = gp.y + ny * rr; z = gp.z + nz * rr;
        } else touchedGhost = false;
      }
    }

    // -------------------------------------------------------------- ground
    const s = course.surf(x, z);
    if (s === 'oob') {
      const gy = course.h(x, z) + R;
      if (!air || y <= gy) { result = 'oob'; ev('oob'); break outer; }
    }
    const wl = course.waterLevelAt(x, z);
    if (s === 'water' && y - R <= wl + 0.02) { y = wl; result = 'water'; ev('water', { speed: Math.hypot(vx, vy, vz) }); break outer; }

    const gy = course.h(x, z) + R;
    if (air && y <= gy) {
      course.normal(x, z, n);
      const vn = vx * n.x + vy * n.y + vz * n.z;
      y = gy;
      if (vn < 0) {
        const surf = SURF[s] ?? SURF.rough;
        if (carry === null) { carry = { x, z, frame: fi, surface: s }; if (world.untilCarry) break outer; }
        const e = Math.min(0.8, surf.bounce * trait.bounce);
        const skid = bounces === 0 ? surf.skid * L.check + (1 - L.check) * 0.25 : surf.skid;
        const tx = vx - vn * n.x, ty = vy - vn * n.y, tz = vz - vn * n.z;
        const bvn = -vn * e;
        if (bvn > 0.9) {
          vx = tx * skid + bvn * n.x; vy = ty * skid + bvn * n.y; vz = tz * skid + bvn * n.z;
          ev('bounce', { surface: s, speed: -vn, n: bounces });
        } else {
          vx = tx * skid; vy = ty * skid; vz = tz * skid;
          air = false;
          ev('land', { surface: s, speed: -vn, n: bounces });
        }
        bounces++;
        side *= 0.3; lift = 0;
      }
    }

    // ----------------------------------------------------------------- cup
    const cdx = x - cup.x, cdz = z - cup.z, cd = Math.hypot(cdx, cdz);
    if (cd < CR) {
      const sp = Math.hypot(vx, vy, vz);
      if (!air && cd < CR - R * 0.4) {
        if (sp < 1.0 * trait.capture) { result = 'holed'; ev('holed', { speed: sp }); x = cup.x; z = cup.z; y = cupY - 0.05; break outer; }
        if (!lipping) {
          lipping = true;
          // lip-out: deflect by how off-centre we are, lose speed
          const cross = (cdx * vz - cdz * vx) / (cd * sp || 1);
          const ang = Math.max(-0.5, Math.min(0.5, cross * 0.9 + 0.08));
          const c = Math.cos(ang), sn = Math.sin(ang);
          const nvx = vx * c - vz * sn, nvz = vx * sn + vz * c;
          vx = nvx * 0.72; vz = nvz * 0.72; vy *= 0.72;
          ev('lip', { speed: sp });
        }
      } else if (air && vy < 0 && y - R < cupY + 0.12 && sp < 9) {
        result = 'holed'; ev('holed', { speed: sp, dunk: true }); x = cup.x; z = cup.z; y = cupY - 0.05; break outer;
      }
    } else if (cd > CR + 0.1) lipping = false;

    if (step % REC === 0) {
      rec();
      if (fi >= maxFrames - 1) break;
    }
  }
  rec();
  if (result === 'rest') ev('rest', { surface: course.surf(x, z) });
  return {
    frames, n: fi, events, result, apex,
    carry: carry ?? { x, z, frame: fi - 1, surface: course.surf(x, z) },
    end: { x, y, z, surface: course.surf(x, z) },
  };
}

// Position + velocity of a recorded shot at frame f (clamped); used for ghosts.
export function frameAt(shot, f) {
  const i = Math.max(0, Math.min(shot.n - 1, f));
  const j = Math.min(shot.n - 1, i + 1);
  const F = shot.frames;
  return {
    x: F[i * 3], y: F[i * 3 + 1], z: F[i * 3 + 2],
    vx: (F[j * 3] - F[i * 3]) * FPS, vy: (F[j * 3 + 1] - F[i * 3 + 1]) * FPS, vz: (F[j * 3 + 2] - F[i * 3 + 2]) * FPS,
  };
}

// Flat-green roll distance for a putter power, measured once from the sim
// itself, so "the ring says 3.0 m" means the ball really rolls 3.0 m on the
// flat (the last metre of a dying putt is slower than a linear fit suggests).
const FLAT_GREEN = {
  h: () => 0, surf: () => 'green', waterLevelAt: () => -1e9,
  normal: (x, z, n) => { n.x = 0; n.y = 1; n.z = 0; return n; },
};
const PUTT_TABLE = (() => {
  const t = [[0, 0]];
  for (let p = 0.004; p <= 1.16; p *= 1.12) {
    const s = simulate({ course: FLAT_GREEN, cup: { x: 1e5, z: 1e5 } }, { x: 0, y: R, z: 0 }, launch('putter', p, 1, 0));
    t.push([p, s.end.x]);
  }
  return t;
})();
// power that rolls `metres` on a flat green (monotonic table, linear between samples)
export function puttPower(metres) {
  const T = PUTT_TABLE;
  if (metres <= 0) return 0;
  for (let i = 1; i < T.length; i++) {
    if (metres <= T[i][1]) { const [p0, d0] = T[i - 1], [p1, d1] = T[i]; return p0 + (p1 - p0) * (metres - d0) / ((d1 - d0) || 1); }
  }
  const [pa, da] = T[T.length - 2], [pb, db] = T[T.length - 1];
  return Math.min(1.15, pb + (pb - pa) * (metres - db) / ((db - da) || 1));
}

// Windmill rotor angle for stroke `strokeNo` at `t` seconds into the shot (matches simulate()).
export function windmillAngle(wm, strokeNo, t) { return strokeNo * wm.step + (2 * Math.PI / wm.period) * t; }
