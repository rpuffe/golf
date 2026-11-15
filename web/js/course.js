// Procedural terrain for one hole: an analytic height function and a surface
// classifier (pure math, no Three.js, so Node can run the physics headless). Everything is derived from the
// hole's data object, so the physics and the picture always agree.
//
// World units are metres. +Y is up. Holes are authored on the XZ plane.


// ---------------------------------------------------------------------------
// Small deterministic noise (value noise + fbm), seeded per hole.
// ---------------------------------------------------------------------------
function hash2(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function smooth(t) { return t * t * (3 - 2 * t); }
export function valueNoise(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = smooth(x - ix), fz = smooth(z - iz);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fz;
}
export function fbm(x, z, seed, oct = 4) {
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += amp * (valueNoise(x * f, z * f, seed + i * 17) - 0.5); amp *= 0.5; f *= 2.03; }
  return s;
}

// Distance from point to a polyline, plus the parameter along it (0..1).
function distToPath(x, z, path) {
  let best = Infinity, bestT = 0, acc = 0, total = 0;
  for (let i = 0; i < path.length - 1; i++) total += Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]);
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i], [bx, bz] = path[i + 1];
    const dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz, len = Math.sqrt(len2);
    let t = len2 ? ((x - ax) * dx + (z - az) * dz) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
    if (d < best) { best = d; bestT = (acc + t * len) / (total || 1); }
    acc += len;
  }
  return [best, bestT];
}

const ell = (x, z, e) => ((x - e[0]) / e[2]) ** 2 + ((z - e[1]) / e[3]) ** 2; // <1 inside

// ---------------------------------------------------------------------------
// Surfaces and their ball-physics parameters.
// bounce: normal restitution; skid: tangential speed kept on a bounce;
// roll: rolling deceleration (m/s^2).
// ---------------------------------------------------------------------------
export const SURF = {
  tee:     { name: 'Tee',     bounce: 0.36, skid: 0.62, roll: 2.40 },
  fairway: { name: 'Fairway', bounce: 0.36, skid: 0.62, roll: 2.40 },
  fringe:  { name: 'Fringe',  bounce: 0.28, skid: 0.62, roll: 1.50 },
  green:   { name: 'Green',   bounce: 0.24, skid: 0.62, roll: 0.62 },
  rough:   { name: 'Rough',   bounce: 0.22, skid: 0.50, roll: 5.50 },
  sand:    { name: 'Sand',    bounce: 0.04, skid: 0.15, roll: 9.00 },
  water:   { name: 'Water',   bounce: 0, skid: 0, roll: 99 },
  oob:     { name: 'Out of bounds', bounce: 0.2, skid: 0.5, roll: 4 },
};

// ---------------------------------------------------------------------------
// Build the analytic course (height + surface) from hole data.
// ---------------------------------------------------------------------------
export function buildCourse(hole) {
  const seed = hole.seed ?? 7;
  const pin = hole.pin, tee = hole.tee;
  const fwW = hole.fairwayWidth ?? 22;
  const green = [pin[0], pin[1], hole.greenSize?.[0] ?? 13, hole.greenSize?.[1] ?? 11];
  const greenTilt = hole.greenTilt ?? [0, 0]; // metres of rise per metre (x, z)
  const B = hole.bounds; // [minX, minZ, maxX, maxZ]

  function fairwayDist(x, z) {
    const [d] = distToPath(x, z, hole.path);
    return d + fbm(x * 0.06, z * 0.06, seed + 3, 2) * 8;
  }

  function rawHeight(x, z) {
    let h = fbm(x * 0.012, z * 0.012, seed, 4) * (hole.roll ?? 9);  // big rolling land
    h += fbm(x * 0.05, z * 0.05, seed + 9, 3) * 1.2;                  // small undulation
    for (const [hx, hz, r, ht] of hole.hills ?? []) {
      const d2 = ((x - hx) ** 2 + (z - hz) ** 2) / (r * r);
      h += ht * Math.exp(-d2 * 2.2);
    }
    // Rough rises gently away from the fairway so shots funnel back a bit.
    const fd = fairwayDist(x, z);
    h += Math.max(0, fd - fwW * 0.5) * (hole.banking ?? 0.06);
    return h;
  }

  // Greens and tees get flattened toward a planar base so putts are readable.
  const greenBase = rawHeight(pin[0], pin[1]);
  const teeBase = rawHeight(tee[0], tee[1]);
  function height(x, z) {
    let h = rawHeight(x, z);
    const ge = ell(x, z, [green[0], green[1], green[2] * 1.5, green[3] * 1.5]);
    if (ge < 1) {
      const plane = greenBase + (x - pin[0]) * greenTilt[0] + (z - pin[1]) * greenTilt[1]
        + fbm(x * 0.09, z * 0.09, seed + 21, 2) * (hole.greenBumps ?? 0.28);
      const w = smooth(Math.min(1, (1 - ge) * 2.2));
      h = h + (plane - h) * w;
    }
    const td = Math.hypot(x - tee[0], z - tee[1]);
    if (td < 7) h = h + (teeBase + 0.25 - h) * smooth(Math.min(1, (7 - td) / 3));
    for (const b of hole.bunkers ?? []) {
      const e = ell(x, z, b);
      if (e < 1.3) h -= 0.9 * smooth(Math.min(1, (1.3 - e) / 0.8));
    }
    for (const p of hole.ponds ?? []) {
      const e = ell(x, z, p);
      if (e < 1.6) h -= 2.6 * smooth(Math.min(1, (1.6 - e) / 1.0));
    }
    for (const r of hole.ridges ?? []) { // [x1,z1,x2,z2,width,height]
      const [d] = distToPath(x, z, [[r[0], r[1]], [r[2], r[3]]]);
      if (d < r[4]) h += r[5] * smooth(1 - d / r[4]);
    }
    return h;
  }

  // Water level per pond: just under its rim.
  const ponds = (hole.ponds ?? []).map(p => ({ e: p, level: rawHeight(p[0], p[1]) - 0.75 }));

  function surface(x, z) {
    if (x < B[0] || x > B[2] || z < B[1] || z > B[3]) return 'oob';
    for (const p of ponds) if (ell(x, z, p.e) < 1 && height(x, z) < p.level + 0.05) return 'water';
    for (const b of hole.bunkers ?? []) if (ell(x, z, b) < 1) return 'sand';
    const ge = ell(x, z, green);
    if (ge < 1) return 'green';
    if (ge < 1.45) return 'fringe';
    if (Math.hypot(x - tee[0], z - tee[1]) < 4.5) return 'tee';
    if (fairwayDist(x, z) < fwW * 0.5) return 'fairway';
    return 'rough';
  }


  function waterLevelAt(x, z) {
    for (const p of ponds) if (ell(x, z, p.e) < 1.6) return p.level;
    return -Infinity;
  }

  // Bake height + surface into grids so the physics (thousands of samples per
  // shot) never touches the noise functions. Bilinear height, nearest surface.
  const CELL = 0.5, M = 4;
  const gx0 = B[0] - M, gz0 = B[1] - M;
  const NX = Math.ceil((B[2] - B[0] + 2 * M) / CELL) + 1;
  const NZ = Math.ceil((B[3] - B[1] + 2 * M) / CELL) + 1;
  const hGrid = new Float32Array(NX * NZ);
  const sGrid = new Uint8Array(NX * NZ);
  const SURF_IDS = Object.keys(SURF);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const x = gx0 + i * CELL, z = gz0 + j * CELL;
    hGrid[j * NX + i] = height(x, z);
    sGrid[j * NX + i] = SURF_IDS.indexOf(surface(x, z));
  }
  function h(x, z) {
    let fx = (x - gx0) / CELL, fz = (z - gz0) / CELL;
    fx = Math.max(0, Math.min(NX - 1.001, fx)); fz = Math.max(0, Math.min(NZ - 1.001, fz));
    const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, k = j * NX + i;
    const a = hGrid[k], b = hGrid[k + 1], c = hGrid[k + NX], d = hGrid[k + NX + 1];
    return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
  }
  function surf(x, z) {
    if (x < B[0] || x > B[2] || z < B[1] || z > B[3]) return 'oob';
    const i = Math.round((x - gx0) / CELL), j = Math.round((z - gz0) / CELL);
    return SURF_IDS[sGrid[j * NX + i]];
  }
  const E = 0.3;
  function normal(x, z, out = { x: 0, y: 1, z: 0 }) {
    const nx = h(x - E, z) - h(x + E, z), nz = h(x, z - E) - h(x, z + E), ny = 2 * E;
    const l = Math.hypot(nx, ny, nz);
    out.x = nx / l; out.y = ny / l; out.z = nz / l;
    return out;
  }

  return { hole, height, surface, h, surf, normal, ponds, waterLevelAt, green, fairwayDist, bounds: B };
}

