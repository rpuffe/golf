// Tree placement + colliders. Pure JS (no Three.js) so the Old Tom planner
// and headless tests see exactly the trees the player sees.

import { fbm } from './course.js';

export function mulberry32(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// --------------------------------------------------------------- trees
export function placeTrees(course, holeDef) {
  const rng = mulberry32((holeDef.seed ?? 1) * 104729);
  const [x0, z0, x1, z1] = course.bounds;
  const fw = holeDef.fairwayWidth ?? 22;
  const out = [];
  const ok = (x, z, clearance) => {
    if (course.fairwayDist(x, z) < fw * 0.5 + clearance) return false;
    const g = course.green;
    if (((x - g[0]) / (g[2] * 2.2)) ** 2 + ((z - g[1]) / (g[3] * 2.2)) ** 2 < 1) return false;
    if (Math.hypot(x - holeDef.tee[0], z - holeDef.tee[1]) < 16) return false;
    const s = course.surface(x, z);
    if (s === 'water' || s === 'sand') return false;
    for (const p of course.ponds) if (((x - p.e[0]) / (p.e[2] + 4)) ** 2 + ((z - p.e[1]) / (p.e[3] + 4)) ** 2 < 1) return false;
    return true;
  };
  const step = 7 / Math.sqrt(holeDef.trees?.density ?? 1);
  for (let z = z0 - 40; z < z1 + 40; z += step) for (let x = x0 - 40; x < x1 + 40; x += step) {
    const px = x + (rng() - 0.5) * step, pz = z + (rng() - 0.5) * step;
    const n = fbm(px * 0.03, pz * 0.03, (holeDef.seed ?? 1) + 5, 2);
    if (n < -0.08 && rng() < 0.75) { rng(); continue; }
    if (!ok(px, pz, 5 + rng() * 6)) { rng(); continue; }
    out.push(makeTree(course, px, pz, rng));
  }
  for (const [cx, cz, r] of holeDef.trees?.clumps ?? []) {
    for (let i = 0; i < r * 1.1; i++) {
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * r;
      const px = cx + Math.cos(a) * d, pz = cz + Math.sin(a) * d;
      if (Math.hypot(px - holeDef.tee[0], pz - holeDef.tee[1]) < 16) continue;
      out.push(makeTree(course, px, pz, rng));
    }
  }
  return out;
}
function makeTree(course, x, z, rng) {
  const pine = rng() < 0.4;
  const s = 0.8 + rng() * 0.6;
  const y = course.h(x, z);
  return { x, z, y, pine, s, trunkH: (pine ? 2.2 : 3.0) * s, canopyR: (pine ? 2.0 : 2.8) * s, hue: rng() };
}
export function treeColliders(trees, course) {
  const [x0, z0, x1, z1] = course.bounds;
  const cs = [];
  for (const t of trees) {
    if (t.x < x0 - 3 || t.x > x1 + 3 || t.z < z0 - 3 || t.z > z1 + 3) continue;
    cs.push({ kind: 'cyl', x: t.x, z: t.z, r: 0.28 * t.s, y0: t.y - 1, y1: t.y + t.trunkH + 1, e: 0.4, tag: 'tree' });
    const cy = t.y + t.trunkH + t.canopyR * (t.pine ? 1.0 : 0.75);
    cs.push({ kind: 'canopy', x: t.x, y: cy, z: t.z, r: t.canopyR * (t.pine ? 0.8 : 1), tag: 'tree' });
  }
  return cs;
}

// --------------------------------------------------------------- the graveyard tombstones
export function placeTombs(course, holeDef) {
  const T = holeDef.tombs; if (!T) return [];
  const rng = mulberry32((holeDef.seed ?? 1) * 31337);
  const [cx, cz, rx, rz] = T.area, g = course.green, out = [];
  for (let tries = 0; tries < 2000 && out.length < T.n; tries++) {
    const x = cx + (rng() * 2 - 1) * rx, z = cz + (rng() * 2 - 1) * rz;
    if (((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2 > 1) continue;
    if (course.fairwayDist(x, z) < (T.clear ?? 5)) continue;
    if (Math.hypot(x - holeDef.tee[0], z - holeDef.tee[1]) < 16) continue;
    if (((x - g[0]) / (g[2] * 1.6)) ** 2 + ((z - g[1]) / (g[3] * 1.6)) ** 2 < 1) continue;
    const s = course.surf(x, z);
    if (s === 'water' || s === 'sand' || s === 'oob') continue;
    out.push({ x, z, y: course.h(x, z), rot: (rng() - 0.5) * 0.7, lean: (rng() - 0.5) * 0.2, k: out.length });
  }
  return out;
}
// Colliders beyond the trees: the windmill tower and the tombstones. Shared
// by the game and Old Tom's planner so both play the same course.
export function extraColliders(course, holeDef) {
  const cs = [];
  const wm = holeDef.windmill;
  if (wm) { const h = course.h(wm.at[0], wm.at[1]); cs.push({ kind: 'cyl', x: wm.at[0], z: wm.at[1], r: wm.tower, y0: h - 1, y1: h + wm.towerH, e: 0.4, tag: 'windmill' }); }
  for (const t of placeTombs(course, holeDef)) cs.push({ kind: 'cyl', x: t.x, z: t.z, r: 0.38, y0: t.y - 1, y1: t.y + 1.2, e: 0.5, tag: 'tomb' });
  if (holeDef.mini) cs.push(...miniColliders(course, holeDef));
  return cs;
}

// ---------------------------------------------------------------- crazy golf
// The rails as segments in XZ: each side of the lane offset by half its width
// plus the rail, outer corners closed, and end caps behind the tee and past
// the cup. Shared by the colliders and the meshes so they always agree.
export function miniRails(holeDef) {
  const M = holeDef.mini, P = holeDef.path, off = M.w / 2 + M.rail;
  const segs = [];
  const dirs = [];
  for (let i = 0; i < P.length - 1; i++) {
    const dx = P[i + 1][0] - P[i][0], dz = P[i + 1][1] - P[i][1], l = Math.hypot(dx, dz) || 1;
    dirs.push([dx / l, dz / l]);
  }
  for (const side of [-1, 1]) {
    let prev = null;
    for (let i = 0; i < P.length - 1; i++) {
      const [ux, uz] = dirs[i], nx = -uz * side, nz = ux * side;
      const a = [P[i][0] + nx * off, P[i][1] + nz * off], b = [P[i + 1][0] + nx * off, P[i + 1][1] + nz * off];
      if (i === 0) { a[0] -= ux * 0.6; a[1] -= uz * 0.6; }
      if (i === P.length - 2) { b[0] += ux * 0.8; b[1] += uz * 0.8; }
      if (prev) segs.push([prev[0], prev[1], a[0], a[1]]);   // close the corner
      segs.push([a[0], a[1], b[0], b[1]]);
      prev = b;
    }
  }
  // end caps
  const [u0x, u0z] = dirs[0], [u1x, u1z] = dirs.at(-1);
  const t0 = [P[0][0] - u0x * 0.6, P[0][1] - u0z * 0.6], t1 = [P.at(-1)[0] + u1x * 0.8, P.at(-1)[1] + u1z * 0.8];
  segs.push([t0[0] + u0z * off, t0[1] - u0x * off, t0[0] - u0z * off, t0[1] + u0x * off]);
  segs.push([t1[0] + u1z * off, t1[1] - u1x * off, t1[0] - u1z * off, t1[1] + u1x * off]);
  return segs;
}
function miniColliders(course, holeDef) {
  const M = holeDef.mini, cs = [];
  for (const [x1, z1, x2, z2] of miniRails(holeDef)) {
    // the rail's top follows the highest felt along it (the Camel's humps)
    let top = -Infinity, bot = Infinity;
    for (let k = 0; k <= 8; k++) { const h = course.h(x1 + (x2 - x1) * k / 8, z1 + (z2 - z1) * k / 8); top = Math.max(top, h); bot = Math.min(bot, h); }
    cs.push({ kind: 'wall', x1, z1, x2, z2, x: (x1 + x2) / 2, z: (z1 + z2) / 2, br: Math.hypot(x2 - x1, z2 - z1) / 2, r: M.rail, y0: bot - 0.2, y1: top + M.railH, e: 0.7, tag: 'rail' });
  }
  for (const [x, z, r] of holeDef.bumpers ?? []) { const h = course.h(x, z); cs.push({ kind: 'cyl', x, z, r, y0: h - 0.5, y1: h + 0.5, e: 1.3, tag: 'bumper' }); }
  return cs;
}
