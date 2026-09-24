// Course solver: paste this whole file into the browser console on a running
// game, then run e.g. __solve(1) for hole 2 (zero-based index).
// It drives the real stepBall() physics over a grid of club x angle x power
// from the tee (at several start ticks, so moving parts are sampled at
// different timings), then again from the stopped cells nearest the cup, and
// reports:
//   aces         - hole-in-one samples per club [Power, Loft, Precision]
//   pen          - samples that found water/lava per club
//   birdieCells  - landing cells from which some second shot holes out
//   aceLines     - sample ace shots as [club, angleDeg, power, startTick]
// Options: { angStep:3, powers:[...], t0s:[0, 60], keep:20 }

window.__solve = function (i, opts = {}) {
  const angStep = opts.angStep || 3, powers = opts.powers || [.25,.35,.45,.55,.65,.75,.85,.95,1];
  const t0s = opts.t0s || [0, 60], keep = opts.keep || 20;
  holeIdx = i; loadHole(i); banner = null;
  const quiet = recorderFx({ contacts:0, banks:[], landed:false, portal:null });
  const savedStar = starTaken; starTaken = true;   // stars never change a shot
  function shot(x, y, c, a, p, t0) {
    const b = { x, y, z:0, vx:0, vy:0, vz:0 };
    launch(b, Math.cos(a), Math.sin(a), p, CLUBS[c]);
    let st = 'moving';
    for (let n = 0; n < 3000 && st === 'moving'; n++) st = stepBall(b, t0 + n, quiet);
    return { x:b.x, y:b.y, st };
  }
  function expand(x, y) {
    const out = [];
    for (const t0 of t0s) for (let c = 0; c < 3; c++) for (let a = 0; a < 360; a += angStep) for (const p of powers)
      out.push({ c, a, p, t0, ...shot(x, y, c, a * Math.PI / 180, p, t0) });
    return out;
  }
  const [tx, ty] = HOLES[i].tee, l1 = expand(tx, ty);
  const aces = [0,0,0], pen = [0,0,0];
  for (const r of l1) { if (r.st === 'sunk') aces[r.c]++; if (r.st === 'water' || r.st === 'lava') pen[r.c]++; }
  const cells = new Map();
  for (const r of l1) {
    if (r.st !== 'stopped') continue;
    const k = Math.floor(r.x / 40) + ',' + Math.floor(r.y / 40);
    if (!cells.has(k)) cells.set(k, r);
  }
  const near = [...cells.values()].sort((a, b) => Math.hypot(a.x - cup.x, a.y - cup.y) - Math.hypot(b.x - cup.x, b.y - cup.y)).slice(0, keep);
  const birdies = [];
  for (const c of near) {
    const ok = expand(c.x, c.y).filter(r => r.st === 'sunk').length;
    if (ok) birdies.push({ from:[c.x | 0, c.y | 0], via:[c.c, c.a, c.p], holeouts:ok });
  }
  starTaken = savedStar; loadHole(i); banner = null;
  return { hole:HOLES[i].name, aces, pen, reachableCells:cells.size, birdieCells:birdies.length, birdies:birdies.slice(0, 5),
    aceLines:l1.filter(r => r.st === 'sunk').slice(0, 6).map(r => [r.c, r.a, r.p, r.t0]) };
};
'solver loaded';
