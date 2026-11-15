# Council Round 7: nine holes, crazy golf, goose bowling, a bigger finale

Same council and format as [council.md](council.md) and
[council-round6.md](council-round6.md): five persona designers pitch, five
judges score through their own lens, and a veto removes an idea unless at
least three judges picked it.

**Owner ask (verbatim):** "We need to make this a 9 hole course. Can we make
one hole just a random mini golf hole, then another novel hole that the fun
council thinks would be super funny, then scale up the stakes of the last
hole."

**Binding playtest rules** (every pitch was checked against these):
- Greens mostly flat. A raised green only on the final hole.
- The cup is clearly visible from the tee and from every normal lie.
- Plays on an iPhone in portrait.
- Every wheel wedge is valid on every hole.
- Old Tom's planner can play it, and his course total stays within ±2 of par.
- Original designs only, no recreated levels or IP.
- Player-facing strings stay at 7 words or fewer (round 6 rule).

---

## 1. Pitches (merged duplicates in brackets)

| Persona | (a) Mini-golf hole | (b) Funny hole | (c) Finale stakes | (d) Order |
| --- | --- | --- | --- | --- |
| Roguelike | **Obstacle Deck**: three authored layouts, one drawn per round from the seed [×2] | Tax Man: every stroke costs a ball | **The Honk Hole grows every stroke** | Scare at 7 |
| Horror | Haunted crazy golf, flickering lights | Gerald's Funeral procession | Old Tom's last wager | Scare at 7: "later, when they've relaxed" |
| Rhythm | Turnstile on the beat [merged into Deck] | Commentator karaoke | Every goose sings the finale | Scare at 6 |
| Party | **Pinball crazy golf** (bumpers) [merged into Deck] | **Ten-Goose Bowling** [×2]; Goose Crossing conga | **Final Group** shared tee shot; **the Boss taxes the leader** | Bowling mid-round |
| Surrealist | Fully procedural layout each round | Giant's Picnic (you are tiny); the cup is in a wedding cake | **Crown ceremony**: the geese fly across the moon | Crazy golf right after the graveyard |
| Golf Purist (asked to pitch) | Real par 2, true bank shots off the rails | Road hole through traffic | **Launch-pad tee, par 5, eagle line through the slingshot** | Keep 1–4 untouched |

**What "random" means.** Three readings came up:
1. A classic crazy-golf hole that feels random to find on a golf course.
2. Its obstacles reshuffle every round.
3. The whole layout is generated from a seed.

The council kept the first two and cut the third (see section 2).

## 2. Judging

### (a) Crazy golf

| Idea | Picked by | Score sum | Veto | Outcome |
| --- | --- | --- | --- | --- |
| **Obstacle Deck** (Turnstile / Pinball / Camel), seeded per round | Fun, Tech, Golf, UX | 21 | none | **Winner** |
| Real rails with bank shots | Golf, UX, Tech | 19 | none | **Merged in**: a true `wall` collider, not post chains |
| Fully procedural layout | Weird | 12 | Tech, Golf | Cut. Par and Tom can't be verified per seed |
| Haunted, flickering | Weird | 11 | UX | Cut. Photosensitivity, and you can't read a dark lane |
| Turnstile on the beat | Weird | 13 | Tech | Merged: it turns only while a ball moves (the windmill rule) |

**Debate, short.**
- **Seeding.** The Technical Director's case: authored decks keep Tom and par
  verifiable. A deck is a pure function of the round seed, so every room
  member sees the same hole with no new message, and Old Tom plans whichever
  deck is drawn.
- **Wheel validity.** The Player Advocate caught a real problem. "Next shot"
  wedges (Moon Boots, Pogo, Banana) skip putts today, so on a putter-only
  hole they would never fire. The fix: on a `mini` hole they apply to putts.
  - Moon and Pogo turn the putt into a **hop**.
  - Banana adds **curl** on the felt.
  - Hopping over a rail is OOB, which is exactly what the Life Ring is for.
- **Geese.** Geese never steal on a green. Crazy golf is all green, so Sic
  'Em and Goose Bait would be dead. On `mini` holes, theft is allowed more
  than 5 m from the cup.
- **Ponds and bunkers are out.** The terrain carves them 2.6 m and 0.9 m
  deep, which reads as a pit at crazy-golf scale. A prototype moat swallowed
  every putt. The hazards are rails, bumpers, humps and the turnstile.

### (b) The super-funny hole

| Idea | Picked by | Score sum | Veto | Outcome |
| --- | --- | --- | --- | --- |
| **Ten-Goose Bowling** ("The Bowling Green") | Fun, Weird, UX, Golf, Tech | 23 | none | **Winner** |
| Goose Crossing (conga line on a loop) | Fun, Weird | 18 | none | Runner-up. Kinematic geese need render/sim sync |
| Giant's Picnic | Weird | 15 | Tech | Cut. Art cost |
| Wedding cake cup | Weird | 14 | Golf | Cut. Raised green before the final |
| Road hole with traffic | Golf | 12 | UX | Cut. Random cars, no fair read |
| Commentator karaoke | Fun | 11 | Tech | Cut. Too many voice clips |
| Tax Man | none | 9 | Golf | Cut |

**Why bowling won.**
- **Weirdness Curator:** "Bowling green" is already a real phrase, and here it
  means a bowling lane with ten geese for pins. You tell a friend about that.
- **Golf Purist:** the joke sits exactly where a pure drive stops (it rests
  at 147–156 m). The greedy line is the bowling ball. The safe line is an
  iron laid up short, then a flight over the pins. The gutters are real
  bunkers.
- **Technical Director:** the pins are ten static spheres with a new `plow`
  flag. The ball loses 25% of its speed per pin and keeps going, like a heavy
  ball through light pins. The topple cascade is cosmetic. No new engine.

### (c) Finale escalation

| Idea | Picked by | Score sum | Veto | Outcome |
| --- | --- | --- | --- | --- |
| **Launch-pad tee, par 5, moat-guarded mesa** | Golf, Fun, UX | 20 | none | **Kept** |
| **The Honk Hole grows each stroke** | Fun, Tech, Golf, Weird | 21 | none | **Kept**. Deterministic: a function of `strokeNo` |
| **Crown ceremony** (fireworks, geese across the moon, Tom tips his cap) | Weird, Fun, UX | 19 | none | **Kept** |
| **Final Group** (rooms wait at the 9th tee, then a 3-2-1 shared tee shot) | Fun, Weird, UX | 18 | none | **Kept**, capped at 45 s |
| **The Boss taxes the leader** | Fun, Weird | 16 | none | **Kept** with Golf's condition: only a lead of 2+, once |
| Tom's last wager (one Tom line on the 9th tee) | UX, Weird | 15 | none | Kept. One clip |
| Double points on the last hole | Fun | 12 | Golf | Cut. Breaks par and the leaderboard |
| Sudden-death playoff | Weird | 13 | Tech, UX | Cut. The Final Group gives the drama for less code |
| The Boss moves the cup | Weird | 10 | Golf (third time) | Cut |

### (d) Running order

| Option | Order (new holes in bold) | Picked by | Outcome |
| --- | --- | --- | --- |
| A | 1–6 as now, **7 Bowling**, **8 Crazy Golf**, 9 Finale | Rhythm, Tech | Cut. Four night holes in a row (6–9), which UX vetoed for iPhone readability |
| **B** | 1–4, **5 Bowling**, 6 Windmill, 7 Plot (scare), **8 Crazy Golf**, 9 Finale | Fun, UX, Weird, Golf, Horror | **Winner** |
| C | 1–4, **5 Crazy Golf**, 6 Plot, 7 Windmill, **8 Bowling**, 9 Finale | Party | Cut. Puts the windmill next to crazy golf, too samey |

The case for B:
- The bowling laugh lands at the middle of the round, in warm light where
  white geese read best.
- The windmill becomes the last light before the dark.
- The scare moves to 7, the act 3 opener.
- Crazy golf at 8 is a neon palate cleanser. It is short (about 40 s), so a
  room bunches up again just before the Final Group.
- Night holes stay at three: 7–9.
- Holes 1–4 keep their rubric spotlights (criterion 9).

## 3. Decisions

**Round:** 9 holes, **par 34**. Old Tom was checked headless (Node, the real
`planHole`):

| Hole | Par | Tom | Note |
| --- | --- | --- | --- |
| 1–4 | 16 | 16 | unchanged |
| 5 The Bowling Green | 4 | 4 | seed 115. Seeds 113/114 gave 5/3, so keep 115 |
| 6 Windmill of Spite | 4 | 5 | today's working tree |
| 7 Old Tom's Plot | 3 | 3 | |
| 8 Crazy Golf | 2 | 2 | Pinball and Camel prototypes, rails emulated with posts. **Turnstile unverified** |
| 9 The Last Moonshot | 5 | 5 | also 5 with the aura forced to ×1.6 and ×2.2 for the whole hole |
| **Total** | **34** | **35** | **+1, in band** |

**Spotlights:**
- 5: bowling
- 6: windmill
- 7: scare
- 8: `mini`
- 9: moon, plus `finale: true`

**Wheel:** 9 draws. Hole 1 is still a good wedge. Each player sees all 8
wedges once, plus one repeat on hole 9 (any wedge except hole 8's).

**Validity of every wedge on the new or changed holes:**

| Wedge | 5 Bowling | 8 Crazy Golf | 9 Finale |
| --- | --- | --- | --- |
| Bucket Cup | yes | yes (an ace gets likelier) | yes |
| Ghost Ball | yes (trees) | through bumpers and the turnstile; **rails stay solid** | yes |
| Life Ring | gutters, OOB | OOB (a hop or chip over the rail) | lake, moat |
| Moon Boots | yes | **putt hop** with moon gravity (floats over bumpers) | "squared" (exists) |
| Pogo | yes (bounce over the pins) | **putt hop**, superball bounces | yes |
| Banana | yes | **curl** on the felt | yes |
| Sic 'Em / Taxi | lane attendants | the lane goose, more than 5 m from the cup | yes |
| Goose Bait | lane attendants | the lane goose | yes |

---

## 4. Implementation spec

The hole data below is the source of truth. Tom's numbers are from section 3.

### 4.1 `holes.js`: the new order

`HOLES = [h1, h2, h3, h4, BOWLING, WINDMILL, PLOT, CRAZY, FINALE]`. Holes 1–4,
the Windmill and the Plot keep their data unchanged.

```js
{ name: 'The Bowling Green', par: 4, seed: 115, spotlight: 'bowling',
  tee: [0, 0], pin: [0, -276], path: [[0, -6], [0, -200], [0, -276]],
  fairwayWidth: 16, banking: 0.1, bounds: [-50, -304, 50, 14],
  greenSize: [14, 12], greenTilt: [0.01, -0.012],
  hills: [[-38, -90, 26, 3], [38, -120, 26, 3], [0, -296, 22, 1.0]],
  bunkers: [[-10.5, -140, 2.2, 26], [10.5, -140, 2.2, 26],          // the gutters
            [-9, -286, 4, 3], [9, -264, 3.5, 4]],
  ponds: [], trees: { density: 0.8 },
  bowling: { at: [0, -140], gap: 1.15, row: 1.0, rows: 4, kingpin: 'toulouse', gutters: [0, 1] },
  geese: [{ area: [-14, -250, 6], radius: 14 }, { area: [14, -228, 6], radius: 14 }],  // lane attendants (embden)
  wind: 2, hint: 'Ten geese. One ball. Bowl.' },

{ name: 'Crazy Golf', par: 2, seed: 131, spotlight: 'mini',
  tee: [0, 0], pin: [2.2, -16], path: [[0, 0], [0, -8], [2.2, -16]],
  fairwayWidth: 40, roll: 0, banking: 0, teeLift: 0, bounds: [-30, -40, 30, 12],
  greenSize: [8, 13], greenCenter: [1, -8], greenTilt: [0, 0], greenBumps: 0,
  hills: [], bunkers: [], ponds: [], trees: { density: 0.5 },
  mini: { w: 2.8, rail: 0.09, railH: 0.22, oobPad: 0.6, decks: [
    { deck: 'The Turnstile',   // a ground-level rotor: the windmill rule, turned flat
      windmill: { axis: 'y', at: [0.7, -11.6], hubH: 0.14, len: 1.25, blades: 3, period: 2.4, step: 1.3, bladeR: 0.11, tower: 0.12, towerH: 0.5, face: 0 } },
    { deck: 'Pinball', bumpers: [[0.5, -4, 0.28], [-0.6, -6, 0.28], [0.9, -7, 0.28], [0.0, -13.5, 0.28], [2.4, -13.0, 0.28]] },
    { deck: 'The Camel', ridges: [[-1.6, -5, 1.6, -5, 0.9, 0.25], [-0.8, -12.4, 3.6, -11.2, 0.9, 0.32]] },
  ] },
  geese: [{ area: [0.3, -5, 1.2], radius: 4 }],
  wind: 0, hint: 'Crazy golf. Putter only, in spirit.' },

{ name: 'The Last Moonshot', par: 5, seed: 97, spotlight: 'moon', finale: true,
  tee: [0, 0], pin: [24, -420], path: [[0, -6], [-10, -200], [24, -420]],
  fairwayWidth: 30, bounds: [-75, -452, 85, 14],
  greenSize: [16, 13], greenTilt: [0.008, 0.01], greenBumps: 0.2,
  hills: [[0, 6, 26, 12], [24, -420, 34, 9], [-36, -300, 24, 3], [62, -250, 26, 4]],  // 12 m launch pad, 9 m mesa
  bunkers: [[6, -404, 4, 3], [44, -412, 3.5, 4], [-26, -292, 6, 4]],
  ponds: [[-6, -168, 34, 13], [8, -372, 30, 9]],                                     // crater lake, the moat
  trees: { density: 0.6 }, airGravity: 0.5,
  bossAura: { at: [16, -385], r: 24, core: 3, pull: 3.5, swirl: 5.0, top: 18, fade: 12, ground: 0.3, grow: 0.3, growMax: 2.2 },
  geese: [{ area: [16, -385, 2], radius: 16, boss: true }, { area: [2, -390, 8], radius: 14 }, { area: [32, -392, 8], radius: 14 },
          { area: [-14, -210, 12], radius: 14, breed: 'canada' }, { area: [10, -240, 12], radius: 14 }, { area: [-30, -300, 10], radius: 14 }],
  goslings: 3, wind: 4, hint: 'Last hole. The Honk Hole grows.' },
```

Measured on the finale:
- A pure moon driver from the pad carries 205 m and runs to 241 m.
- The pad tee sits at 10.8 m and the mesa green at 10.7 m, so the cup is in
  sight from the tee.
- Tom's line: the drive carries the lake, an iron lays up, a wedge goes
  right of the moat, a wedge reaches the mesa, then one putt.

**Deck draw.** Add a pure helper in `holes.js`, importing `mulberry32` from
trees.js:

```js
export function resolveHole(h, seed) {
  const d = h.mini?.decks; if (!d) return h;
  const k = Math.floor(mulberry32((seed ^ 0x51ed27) >>> 0)() * d.length);
  return { ...h, ...d[k], deckIdx: k };
}
```

### 4.2 Physics (`physics.js`), about 45 lines

1. **`wall` collider** (crazy-golf rails). A vertical capsule segment:
   `{kind:'wall', x1,z1,x2,z2, r, y0,y1, e:0.7, tag:'rail', x,z,br}`.
   - `x,z` is the midpoint and `br` is half the length.
   - In `prepColliders`, use `const r = (c.br ?? c.r ?? 0) + 0.5`.
   - Keep segments ≤ 10 m.
   - Test: take the closest point on the segment. If it is within `r+R` and
     `y` is in range, reflect the normal velocity, `v -= (1+e)·vn·n`, emit
     `hit` with the tag, and push the ball out. This is the `cyl` branch with
     a segment instead of a centre.
2. **`plow` sphere** (bowling pins). In the sphere branch:
   `if (c.plow) { if (!knocked.has(c)) { knocked.add(c); vx*=.75; vy*=.75; vz*=.75; ev('hit',{tag:c.tag,speed}); } continue; }`.
   Extend the existing `c.push && knocked.has(c)` skip to `(c.push || c.plow)`.
3. **Windmill `axis: 'y'`** (the turnstile).
   - `wmY = wm.axis === 'y'`, and the blade plane is `pz = at[1]`.
   - Near test: `|y-hy| < 0.6` and the XZ distance to the hub is under `len+1`.
   - Sample point `(hx+ca·ρ, hy, pz+sa·ρ)`, blade velocity `(-ωρ·sa, 0, ωρ·ca)`.
     Include `vz - bvz` in `vn`.
   - Sphere radius is `wm.bladeR ?? 0.8`.
   - Don't force `air = true` when `wmY`.
   - The phase is the same as today (`th0 = wmPhase ?? strokeNo·step`), so
     Tom, the preview and rooms already agree.
4. **Aura growth.** Compute
   `const ak = Math.min(ba.growMax ?? 1, 1 + (ba.grow ?? 0) * Math.max(0, (world.strokeNo ?? 1) - 2))`
   once per shot, and multiply `pull` and `swirl` by `ak` inside `aura()`.
   - Strokes 1–2 are unchanged, stroke 3 is ×1.3, stroke 4 ×1.6, and it caps
     at ×2.2.
   - `strokeNo` is already passed by the player, the preview and Tom.
5. **Curl.** In the ground branch:
   `if (L.curl) { const sp = Math.hypot(vx, vz); ax += L.curl * sp * -vz; az += L.curl * sp * vx; }`.
   - Constant curvature (rad/m); positive curls right.
   - Only Banana on a `mini` putt sets it.
6. **Ghost Ball list.** Add `'bumper'` to the `noTrees` skip tags. Never add
   `'rail'`.

### 4.3 Terrain (`course.js`, `terrain.js`, `trees.js`)

- **`course.js`**
  - `green = [...(hole.greenCenter ?? pin), …]`, so the crazy-golf lane sits
    in the flat middle of the green.
  - The tee lift becomes `teeBase + (hole.teeLift ?? 0.25)`.
  - **Lane mask.** In `surface()`, right after the bounds check: on `mini`,
    inside green×1.45, if `distToPath(x,z,path)[0] > w/2 + oobPad`, return
    `'oob'`.
    - The 0.6 m pad keeps the 0.5 m nearest-cell surface grid from calling
      a ball OOB while it hugs a rail.
- **`trees.js extraColliders(course, h)`** (Tom sees all of these)
  - Mini rails: offset each `path` segment by ±(w/2 + rail) and push walls
    with `y0 = h-0.2` and `y1 = h + railH`.
  - Close each outer corner with a short wall between consecutive offset
    endpoints.
  - Add end caps 0.6 m behind the tee and 0.8 m past the cup.
  - Bumpers: `{kind:'sphere', x, y: h+0.2, z, r, e: 1.4, tag: 'bumper'}`.
  - The turnstile post comes from the existing windmill `cyl` (r 0.12).
- **`terrain.js buildGreenMesh`**
  - On `mini`, paint the canvas outside the lane as paving (`#8a8378`).
  - Stroke the lane along `path` in felt (`#2fae5a`), with `lineWidth = w`
    in pixels and round joins.
- **`world.js buildCrazyGolf(course, h)`** (~60 lines, a new export)
  - Rails as boxes: white timber with red caps.
  - Bumpers as red/white cylinders.
  - A "CRAZY GOLF" `buildLabel` sign.
  - String lights: emissive spheres, no point lights, which keeps the iPhone
    fast.
  - `buildTurnstile`: a post plus 3 striped arms. The rotor turns with
    `rotation.y = -angle`; check the sign by eye against the physics.

Every crazy-golf obstacle is ≤ 0.6 m tall, so the cup and flag stay visible
over everything from a 1.6 m eye height.

### 4.4 `main.js` wiring

- **Round seed and decks**
  - Set `G.roundSeed` at boot and on each restart: in rooms,
    `G.room.seed ^ Math.imul(G.room.round, 2654435761)`; solo, random.
  - `loadHole` and `ensureTom` use `resolveHole(HOLES[i], G.roundSeed)`.
  - `startRound` deletes `tomCache[i]` for `mini` holes.
  - `ensureTom` passes `teeOffset {x: -0.6, z: 0.3}` on `mini`, because
    −1.3 m is outside the 2.8 m lane.
  - Save `deckIdx` per hole in the PB. On a deck mismatch, the ghost for that
    hole is Old Tom.
  - Toast at the tee: "Tonight: The Turnstile." (≤ 7 words).
- **`oldtom.js`.** On `holeDef.mini`, the putt fan is
  `[0, ±0.03, ±0.06, ±0.1, ±0.15, ±0.22, ±0.3]` × power 0.04–1.15 in steps of
  0.03, which is about 500 sims a stroke. Without it, bank lines go
  unexplored.
- **Mini rules**
  - `shotMods`: change `clubId !== 'putter'` to
    `(clubId !== 'putter' || G.holeDef.mini)`.
  - In the shot and preview paths, a helper `miniPutt(L, mods)`:
    - Moon or Pogo: `L.vy = 2.4; L.rolling = false` (a hop).
    - Banana: `L.curl = (G.holeIdx % 2 ? 1 : -1) * 0.06`.
  - `canSnatch` and `maybeGooseSteal`: on `mini`, treat green as stealable
    more than 5 m from the cup.
  - `pickLoss` on `mini` always returns `'brood'`. Punt, relay, pond, bunker
    and stash can't be trusted in a 2.8 m lane.
  - `taxiSpot` and the Gallery fan placement must stay inside the lane
    (taxi) or outside the rails (fans).
- **Bowling**
  - Pins are 10 cosmetic goose meshes (`buildGooseBreed`: 9 `embden`, and
    `toulouse` for the kingpin, the 5-pin). They are not in `geese`, so no
    AI, curiosity or theft applies.
  - Positions: row `r` sits at `at.z - r·row` and pin `i` at
    `x = (i - r/2)·gap`.
  - A `pinColliders()` function returns the up pins as
    `{kind:'sphere', y:h+0.42, r:0.46, e:0.35, plow:true, tag:'pin:k'}`.
    Splice it into the shot's `dynamic` (line ~1567), the way geese go in.
    - Tom and the carry preview never see pins: a ghost passes through
      geese, as on every hole.
  - On a `hit` with tag `pin:k`, call `topple(k, speed)`:
    - The mesh tips with `rotation.x → 1.35` over 0.25 s (the faceplant
      code), with a honk and feathers.
    - It cascades to pins within 1.3 m that are beside or behind it, after
      0.12 s, with `e·0.68`, while `e > 2.0`.
    - Target: a pure drive into the head pin strikes about 1 in 3. Tune the
      decay, not the colliders.
  - After the shot:
    - 10 down: banner "🎳 STRIKE!", commentator class `strike`, confetti,
      `moment(40)`.
    - The rest cleared on a later stroke: "🎳 SPARE".
    - Ending in a `gutters` bunker: class `gutter` instead of `sand`.
  - Pins re-rack at `loadHole`. Each player has their own pins: rival
    playback never knocks yours.
- **Crazy-golf chatter.** A shot with ≥ 3 `rail`/`bumper` hits, or any
  turnstile swat, says class `crazy`, not `windmill`. The hit sound is
  `sfx.thwack`, pitched up.
- **Wheel.** `drawWheelOrder`: `[first, ...shuffle(others, rng)]` (8), then
  push a 9th that is not equal to the 8th.
- **Finale**
  - **Aura feedback.** At address, read `ak` for `G.strokes + 1` and scale
    the aura spiral's spin and opacity by it.
    - From stroke 3: toast "🌀 The Honk Hole grows." once, and commentator
      class `bossAngry`.
  - **Tom's last wager** (solo). If you are within 1 of Tom thru 8, Tom says
    `TOM_LINES.final` at the tee and the race chip reads "ALL SQUARE · LAST
    HOLE".
  - **The Boss taxes the leader**, once:
    - In rooms, if you lead by 2+ to par, set `G.sicPending = 'The Boss'`
      at load. The existing forced theft fires on your first rest off the
      green.
    - Solo, the same applies if you lead Tom by 2+.
    - Toast: "👑 The Boss taxes the leader."
  - **Final Group** (rooms, 2+ online players not finished):
    - At load, `G.mode = 'finalWait'`: you can look and scope, but not
      swing. The HUD shows "Final group. Waiting for 2." and a "Tee off now"
      button.
    - It ends when every online, unfinished member's progress shows hole 9,
      or after 45 s.
    - Then the banners "3", "2", "1", "TEE OFF!". Swings stream to everyone
      over the existing rival playback.
    - No server change: progress already carries `hole`.
  - **Crown ceremony.** In `holeOut` on `finale`, before `endRound`. Under
    4 s, and any input skips it.
    - 6 firework `burst`s over the mesa.
    - The boss and its geese take off (`fly`) toward `sunDir` in a V across
      the moon. The crown leaves last.
    - The commentator says `finale`.
    - Solo: Old Tom's gentle-scare model rises at the fringe and tips his
      cap, then says `ahead` or `behind`.
    - Rooms: send `emote finale`. Others get the toast "🎆 {name} has
      finished."
    - Reduced motion: two bursts, no shake.

### 4.5 Lighting (`world.js LIGHTING`, 9 entries in course order)

`env.apply(i)` stays index-based. Insert the two new rows, so indices 0–3 are
unchanged, the old index 4 becomes 5, the old 5 becomes 6 and the old 6
becomes 8:

```js
// [4] Bowling Green: the last of the sun, warm, long shadows
{ elev: 5, az: 30, top: 0x26235f, mid: 0x9b5f92, horizon: 0xff8650, sun: 0xff9a56, fog: 0xc07f7d, sunI: 2.4, hemi: 1.22 },
// [7] Crazy Golf: neon night, short fog, bright hemi so the felt reads
{ elev: 18, az: -25, top: 0x0b0824, mid: 0x251a4f, horizon: 0x5a3a7e, sun: 0xd8c8ff, fog: 0x1c1838, sunI: 0.8, hemi: 1.05, night: true, fogNear: 60, fogFar: 420 },
```

### 4.6 Commentator (pre-generated clips: **16 new**, regenerate once)

Run `tools/voices/gen.mjs` (the operator holds the ElevenLabs key). Until the
clips exist the captions still show, just silently. Add each class to `PRIO`:

| Class | Calm / rattled / hysterical | PRIO |
| --- | --- | --- |
| `strike` | "A strike. Ten geese, all down." / "STRIKE! All ten! The geese are furious!" / "STRIKE! TEN GEESE! I HAVE NEVER BEEN SO PROUD!" | 4 |
| `gutter` | "Into the gutter. Unlucky." / "Gutter ball! In golf! That is a first." / "GUTTER BALL! WRONG SPORT! WRONG SPORT ENTIRELY!" | 2 |
| `crazy` | "Off the woodwork. Classic crazy golf." / "It is a pinball machine in there!" / "IT HIT EVERYTHING! THIS IS NOT GOLF, IT IS AN ARCADE!" | 2 |
| `bossAngry` | "The Honk Hole is getting stronger." / "The whirlpool is growing! Hurry, {name}!" / "IT IS GROWING! THE HONK HOLE IS HUNGRY!" | 3 |
| `finale` | "And that is the round. What a day." / "That is the round! Fetch me a lie-down!" / "THE ROUND IS OVER! I HAVE NO VOICE LEFT! GOODNIGHT!" | 4 |
| Tom `final` | "[gravely] Last hole. Loser buys the drinks." | n/a |

Add `strike` to `POSITIVE` in voice.js (excited, not sarcastic).

### 4.7 Server and docs

- `main.go`: `minRoundStrokes = 9`, and update the comment.
- `store.go`: `scorePrefix = "scores-3d9/"`. Par changed, so the board starts
  fresh. Update the comment.
- `rooms.go`: no change. Holes up to 18 already validate, and `Wm` covers the
  turnstile phase.
- The PB ghost invalidates itself (`holes.length !== HOLES.length`).
- README: "Nine holes (par 34)", and the scare is now on hole 7.
- Rubric amendments:
  - criterion 9's hole list becomes 5 bowling, 6 windmill, 7 scare,
    8 crazy golf, 9 finale;
  - round time is ≤ 12 min;
  - the 3 s rule is waived for the scare hole and for the crown ceremony
    (≤ 4 s, skippable).

### 4.8 The nine holes, one line each

1. **The Welcome Committee** (par 4): the goose meets your drive.
2. **Gerald's Lake** (par 3): carry the water, or fish for your ball.
3. **Old Tom's Stymie** (par 4): his ghost parks on your putting line.
4. **Sunset Strip** (par 5): wind and the scope over a long carry.
5. **The Bowling Green** (par 4, new): your drive rolls into ten goose pins, with gutters either side.
6. **The Windmill of Spite** (par 4): giant blades that only turn while you swing.
7. **Old Tom's Plot** (par 3, moved from 6): the foggy graveyard and the scare.
8. **Crazy Golf** (par 2, new): a felt lane with rails, and tonight's deck (Turnstile, Pinball or Camel).
9. **The Last Moonshot** (par 5, finale): launch-pad tee, moon gravity, moat-ringed mesa, a Honk Hole that grows, then the crown ceremony.

### 4.9 New code, by file (about 400 lines)

| File | Pieces |
| --- | --- |
| physics.js | `wall` kind + `br` bucketing; `plow`; windmill `axis:'y'` + `bladeR`; aura `grow`; ground `curl`; `bumper` added to the Ghost Ball list |
| course.js | `greenCenter`, `teeLift`, `mini` lane mask |
| trees.js | rails, end caps and bumpers in `extraColliders` |
| holes.js | 2 new holes, the finale rewrite, the reorder, `resolveHole` |
| terrain.js / world.js | felt/paving paint; `buildCrazyGolf`, `buildTurnstile`; 2 LIGHTING rows |
| oldtom.js | the `mini` putt fan |
| main.js | decks + Tom cache + PB; mini wheel/theft/loss rules; bowling pins, cascade, strike, spare, gutter; 9-draw wheel; aura feedback; last wager; leader tax; Final Group; crown ceremony |
| commentator.js / voice.js | 5 classes + 1 Tom line (16 clips) |
| main.go / store.go | `minRoundStrokes`, `scorePrefix` |

### 4.10 Risks (check these first)

1. **Turnstile Tom is unverified.** Run `planHole` on all three decks once
   the code exists. If the Turnstile shoots over 3, slow `period` to 3.0.
2. **The lane mask against the 0.5 m surface grid.** Roll a ball along both
   rails headless and assert it never returns `oob`. Raise `oobPad` if it
   does.
3. **Geese in a 2.8 m lane.** Goose Taxi targets, gallery fans and Be the
   Goose puppets can block the whole lane. Clamp all three.
4. **Bowling ghost readability.** Tom's frames pass through standing pins.
   This is accepted (he's a ghost), but check that it doesn't read as a bug.
5. **Final Group stalls.** The 45 s cap and "Tee off now" must survive a
   member who disconnects or reloads mid-wait. Count online members only.
6. **The Leader Tax** is the only rubber band in the game. It fires once, adds
   no stroke, and never fires on a green. If playtesters call it unfair, cut
   it first.
7. **Night on an iPhone.** Holes 7–9 are dark. Check the crazy-golf felt and
   the mesa beacon in a portrait screenshot before shipping.
