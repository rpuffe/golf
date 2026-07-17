# Plan: Hybrid mini/real golf — the "third dimension" par 3

## Context

The game today (`index.html`, one self-contained file) is a **flat top-down putt-only**
mini-golf game: the ball is `x, y, vx, vy` on a single ground plane, walls are
rectangles that reflect it, and every shot is the same slingshot drag scaled to a
fixed `MAX_SPEED`. There is no notion of height, so every hole is a pool-table puzzle.

We want a hybrid between real golf and mini golf: a **par-3 hole** played with three
clubs — **driver** (long, low, rolls far), **wedge** (high loft, clears hazards),
and **putter** (stays on the ground, dead accurate). This requires adding a real
**height axis** to the ball so shots can *fly over* hazards. Intended line for the
hole: **drive down the fairway → wedge over the sand → putt it home.**

Scope decisions (confirmed with user):
- Replace the current 3-hole flat course with **one** par-3 showcase hole.
- Club switching via **on-screen chips + keyboard** (1/2/3, or C to cycle).

## Core mechanic: add `z` (height) + `vz` (vertical velocity)

- Ball gains `z` and `vz`. Gravity (`GRAVITY`) pulls `vz` down each step.
- **Grounded (`z === 0`)** → behaves like today: ground friction, wall bounces,
  sand penalty, can drop in the cup.
- **Airborne (`z > 0`)** → gravity arc; **skips walls/sand whose height it's above**.
  This is what lets the wedge carry the bunker.
- On touchdown, horizontal speed is damped (`LAND_DAMP`) so loft trades for roll.

## Clubs (config table, drives launch + roll)

| Club | `speed` (horiz) | `loft` (vz) | `friction` (roll) | Role |
|------|----------------|-------------|-------------------|------|
| Driver | 15 | 3.4 | 0.988 | Long & low — tee shot, big roll |
| Wedge | 10.5 | 9 | 0.978 | High arc — clears sand/ridge |
| Putter | 9 | 0 | 0.972 | Grounded, precise — the green |

Power still comes from drag length; the club sets the speed/loft split and roll.

## Hazards get height

- Walls carry an optional 5th element = **height**. Collision only fires when
  `ball.z < wallHeight`. Outer boundary walls omit it → treated as infinite (never
  fly off the board).
- New **sand** hazard: ground-level rects. While the ball is rolling (`z === 0`)
  inside one, apply heavy `SAND_FRICTION` so it bogs down. Fly over it and it's safe.

## The hole (authored in landscape 720×480, auto-rotated for portrait)

- Tee left `[70,240]`, cup right on the green `[625,240]`.
- **Sand band** across the fairway (`~x 300–420`, full height) — must be carried.
- A low **ridge wall** just past the sand (height ~34) — the wedge flies over it;
  driver/putter can't. Demonstrates the wall-height flyover.

## Rendering the height (fake-3D)

- Draw the ball's **shadow on the ground** at `(x, y)`, and the **ball body lifted**
  to `y − z`, slightly larger the higher it is. The gap reads instantly as altitude.
- Draw sand bunkers on the turf. For lofted clubs, show a **predicted carry ring**
  at the aim's landing point so players can judge the chip.

## Club selector UX

- Three tappable **club chips** below the canvas (mobile-friendly), active one
  highlighted; keys **1/2/3** select, **C** cycles. Active club shown via the chips.
- Each hole starts on **driver**.

## Files & functions to touch (all in `index.html`)

- **Constants block** (`R, CUP_R, …`): drop `MAX_SPEED`/`FRICTION`, add
  `GRAVITY, LAND_DAMP, SAND_FRICTION, CLUBS, currentClub`.
- **`BASE_HOLES` + rotate helpers** (`rotatePoint`, `rotateWall`, `HOLES` map):
  single hole with `sands` + heighted `walls`; carry height through portrait rotation.
- **`loadHole`**: init `z/vz`, set `sands`, reset club to driver.
- **`onUp`**: club-based launch (`vx, vy, vz` from club + power).
- **`step`**: vertical integration, height-aware wall collision, sand drag,
  cup only when grounded; add `inSand()` helper.
- **`sink`**: reset `z/vz`.
- **`draw`**: shadow + lifted ball, sand rendering, carry-ring preview.
- **HTML/CSS/copy**: add `#clubs` chips + styles, HUD `1/1`, start subtitle,
  how-it-works bullets, hint text; nudge canvas max-height for the new chip row.

## Verification

Run the app locally and play the intended line in the browser preview:
1. **Driver** off the tee — should fly low and roll a long way; lay up short of the sand.
2. **Wedge** — high arc, shadow gap grows, carries the sand + ridge onto the green.
3. **Putter** — stays flat, rolls accurately into the cup.
Failure cases to confirm: putting/driving *into* the sand bogs down; a low driver
into the ridge bounces; a ball can't fly off the board edge; portrait (mobile)
layout rotates the hole correctly and chips are tappable.

Leaderboard/SSE untouched — becomes fewest strokes on the one hole.
