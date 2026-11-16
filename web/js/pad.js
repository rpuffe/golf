// Game controller support (Gamepad API, standard mapping: Xbox and friends).
//
// Pure parts live here so they can be tested in Node: reading a pad into a
// tidy snapshot with button edges, the stick swing, and spatial focus
// navigation for menus. main.js decides what each input does in each mode.
//
// Standard mapping: buttons 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT,
// 8 View, 9 Menu, 10 LS, 11 RS, 12-15 D-pad up/down/left/right.
// Axes 0/1 left stick x/y, 2/3 right stick x/y (y is +1 pulled toward you).

export const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
export const DZ = 0.18;   // radial dead zone: a resting Xbox stick drifts up to ~0.1

// Glyphs for on-screen prompts (text-safe: no images, no fonts to load).
export const GLYPH = { A: 'Ⓐ', B: 'Ⓑ', X: 'Ⓧ', Y: 'Ⓨ', LB: 'LB', RB: 'RB', LT: 'LT', RT: 'RT', LS: 'L', RS: 'R', MENU: '☰', VIEW: '⧉' };

const dead = (x, y) => { const m = Math.hypot(x, y); if (m < DZ) return [0, 0]; const k = (m - DZ) / (1 - DZ) / m; return [x * k, y * k]; };

// The first connected pad, as a snapshot: sticks (dead-zoned), triggers 0..1,
// buttons held, and which were pressed/released since the last read.
export function readPad(pads, prev) {
  const gp = [...(pads ?? [])].find(p => p && p.connected && (p.mapping === 'standard' || p.buttons.length >= 16));
  if (!gp) return null;
  const val = i => { const b = gp.buttons[i]; return b ? (typeof b === 'object' ? b.value || (b.pressed ? 1 : 0) : b) : 0; };
  const down = gp.buttons.map((b, i) => (typeof b === 'object' ? b.pressed : b > 0.5) || (i === BTN.LT || i === BTN.RT ? val(i) > 0.5 : false));
  const [lx, ly] = dead(gp.axes[0] ?? 0, gp.axes[1] ?? 0);
  const rawR = [gp.axes[2] ?? 0, gp.axes[3] ?? 0];
  const [rx, ry] = dead(rawR[0], rawR[1]);
  const was = prev?.down ?? [];
  return {
    id: gp.id, lx, ly, rx, ry, rawR, lt: val(BTN.LT), rt: val(BTN.RT), down,
    pressed: down.map((d, i) => d && !was[i]), released: down.map((d, i) => !d && !!was[i]),
    active: down.some(Boolean) || Math.hypot(lx, ly) > 0 || Math.hypot(rx, ry) > 0,
  };
}

// ---- the stick swing --------------------------------------------------------
// Pull the right stick toward you to wind up (how far = power, like the
// mouse drag), then push it forward to strike. Tempo is the time from leaving
// the top to the push, exactly as the mouse flick measures it, and the push's
// angle curves the ball as a slanted flick does. Deterministic: the same stick
// path always gives the same shot. Letting the stick spring back to centre
// (no push) cancels at no cost; so does B.
export const SWING = { rise: 0.05, leave: 0.12, push: 0.5, settle: 0.25, over: 1.15 };
export function stickPower(depth, over = false) {
  // depth is the dead-zoned pull, 0..1; full deflection (a little short of the rim) is 100%
  return Math.min(over ? SWING.over : 1, Math.max(0, depth / 0.95) * (over ? SWING.over : 1));
}
export function newStickSwing() { return { phase: 'idle', back: 0, tTop: 0, tDown: 0, restAt: undefined }; }
// One step. stick: {x, y} dead-zoned right stick; over: right stick clicked in.
// Returns null or an event: begin | back | down | strike {power, drift, tDown} | cancel.
export function stepStickSwing(s, stick, now, { over = false, allowed = true } = {}) {
  const depth = Math.max(0, stick.y), push = Math.max(0, -stick.y), mag = Math.hypot(stick.x, stick.y);
  const p = stickPower(depth, over);
  if (s.phase === 'idle') {
    if (allowed && p > SWING.rise && push === 0) { Object.assign(s, { phase: 'back', back: p, tTop: now }); return { type: 'begin', back: p }; }
    return null;
  }
  if (s.phase === 'back') {
    // tTop: the last moment the stick was still at the top (holding there is free, like the mouse)
    if (p >= s.back) { s.tTop = now; s.back = p; return { type: 'back', back: s.back }; }
    if (p >= s.back - SWING.leave && push === 0) { s.tTop = now; return null; }
    if (p < s.back - SWING.leave || push > 0) {
      // leaving the top: tempo runs from the last moment at the top
      Object.assign(s, { phase: 'down', tDown: s.tTop, restAt: undefined });
      if (push >= SWING.push) return strike(s, stick);
      return { type: 'down', tDown: s.tDown };
    }
    return null;
  }
  if (s.phase === 'down') {
    if (push >= SWING.push) return strike(s, stick);
    if (p > s.back - 0.04 && push === 0) { s.phase = 'back'; s.back = Math.max(s.back, p); s.tTop = now; return { type: 'back', back: s.back }; }   // wound up again
    // the stick sprang back to centre and stayed there: no swing, no cost
    if (mag === 0) { s.restAt ??= now; if (now - s.restAt >= SWING.settle) return reset(s, 'cancel'); }
    else s.restAt = undefined;
    return null;
  }
  return null;
}
function strike(s, stick) {
  const push = Math.max(0.35, -stick.y);
  // a 45-degree push at full power hooks or slices as hard as a 45-degree mouse flick
  const drift = Math.max(-1, Math.min(1, (stick.x / push) * s.back / 0.8));
  const ev = { type: 'strike', power: s.back, drift, tDown: s.tDown };
  reset(s); return ev;
}
function reset(s, type = null) { Object.assign(s, newStickSwing()); return type ? { type } : null; }

// ---- spatial focus navigation ---------------------------------------------------
const FOCUSABLE = 'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])';
export function navTargets(root) {
  if (!root) return [];
  return [...root.querySelectorAll(FOCUSABLE)].filter(el => {
    if (el.disabled || el.closest('.hidden') || el.getAttribute('aria-hidden') === 'true') return false;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.pointerEvents !== 'none' && +cs.opacity > 0.05;
  });
}
// the nearest target in a direction (dx, dy one of -1/0/1), favouring the straight line
export function navPick(from, targets, dx, dy) {
  if (!from) return targets[0] ?? null;
  const a = from.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best = null;
  for (const el of targets) {
    if (el === from) continue;
    const b = el.getBoundingClientRect(), bx = b.left + b.width / 2, by = b.top + b.height / 2;
    const along = (bx - ax) * dx + (by - ay) * dy, across = Math.abs((bx - ax) * dy) + Math.abs((by - ay) * dx);
    if (along <= 4) continue;
    const score = along + across * 2.2;
    if (!best || score < best.score) best = { el, score };
  }
  return best?.el ?? null;
}
