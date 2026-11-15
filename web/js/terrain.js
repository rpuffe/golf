import * as THREE from 'three';
import { fbm } from './course.js';

// ---------------------------------------------------------------------------
// Meshes
// ---------------------------------------------------------------------------
const COL = {
  fairway: [0.36, 0.62, 0.22], fairway2: [0.31, 0.56, 0.19],
  green: [0.40, 0.74, 0.30], green2: [0.37, 0.70, 0.27],
  fringe: [0.33, 0.62, 0.24], tee: [0.40, 0.70, 0.28],
  rough: [0.22, 0.42, 0.14], sand: [0.93, 0.80, 0.55], water: [0.20, 0.35, 0.30], oob: [0.17, 0.30, 0.12],
};

export function buildTerrainMesh(course) {
  const [x0, z0, x1, z1] = course.bounds;
  const pad = 70;
  const W = x1 - x0 + pad * 2, D = z1 - z0 + pad * 2;
  const step = 1.25;
  const nx = Math.ceil(W / step), nz = Math.ceil(D / step);
  const geo = new THREE.PlaneGeometry(W, D, nx, nz);
  geo.rotateX(-Math.PI / 2);
  geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const seed = course.hole.seed ?? 7;
  const dir = new THREE.Vector2(course.hole.pin[0] - course.hole.tee[0], course.hole.pin[1] - course.hole.tee[1]).normalize();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    let h = course.height(x, z);
    const s = course.surface(x, z);
    // Out past the boundary the land lifts into a soft bowl so the world has edges.
    const ox = Math.max(0, x0 - x, x - x1), oz = Math.max(0, z0 - z, z - z1);
    const out = Math.hypot(ox, oz);
    if (out > 0) h += out * 0.16 + out * out * 0.0015 + fbm(x * 0.03, z * 0.03, seed + 40, 3) * out * 0.18;
    pos.setY(i, h);
    let c = COL[s] ?? COL.rough;
    const n = fbm(x * 0.2, z * 0.2, seed + 77, 2) * 0.12;
    if (s === 'fairway' || s === 'tee') {
      // Mowing stripes across the line of play.
      const along = x * dir.x + z * dir.y;
      c = (Math.floor(along / 6) % 2 === 0) ? COL.fairway : COL.fairway2;
    } else if (s === 'green') {
      const ang = Math.atan2(z - course.hole.pin[1], x - course.hole.pin[0]);
      c = (Math.floor((ang + Math.PI) / (Math.PI / 6)) % 2 === 0) ? COL.green : COL.green2;
    }
    if (s === 'oob') c = COL.oob;
    const k = 1 + n;
    colors[i * 3] = c[0] * k; colors[i * 3 + 1] = c[1] * k; colors[i * 3 + 2] = c[2] * k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

export function buildWater(course) {
  const group = new THREE.Group();
  for (const p of course.ponds) {
    const [cx, cz, rx, rz] = p.e;
    const geo = new THREE.CircleGeometry(1, 48);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x3a7ea0, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.86,
      emissive: 0x1a3550, emissiveIntensity: 0.4,
    });
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(rx * 1.6, 1, rz * 1.6);
    m.position.set(cx, p.level, cz);
    m.userData.water = true;
    group.add(m);
  }
  return group;
}
