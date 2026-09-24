# Course design language

Use this guide when adding or revising holes. The obstacles should communicate
their physics before the player takes a shot.

## Obstacle vocabulary

| Visual | Gameplay rule | Course-design use |
| --- | --- | --- |
| Green | Firm turf adds a small rollout bonus while preserving the selected club's handling | Faster final approaches, delicate putts, and a clear visual target around the cup |
| Trees | Finite height; a sufficiently high shot can clear them | Shortcuts, risk/reward lines, and prompts to use Loft |
| Mountains | Infinite height; every club collides with them | Permanent routing, doglegs, and separation between lanes |
| Sand | Airborne shots pass over it; grounded balls lose speed quickly | Punish inaccurate landings without adding a stroke |
| Water | Airborne shots pass over it; landing or rolling into it adds one stroke and resets the ball to its previous lie | Forced carries and high-risk shortcuts |
| Lava | Airborne shots pass over it; landing or rolling into it adds two strokes and resets the ball | Severe punishment around the most rewarding lines |
| Ice | Grounded balls retain almost all their speed; airborne shots are unaffected | Overshoot danger, long banks, and braking puzzles |
| Candy bumper | Reflects grounded/low shots and returns slightly more speed; a high Loft clears it | Bank-shot shortcuts, chip routes, and pinball set pieces |
| Paired rifts | Grounded balls teleport between the two rings while keeping their direction and speed; airborne shots pass over | Finale set pieces and impossible-looking routes |
| Windmill | Rotating sails with infinite height; a sail bats the ball in its own direction of travel. A ball can never come to rest under the sails | Timing gates. Nothing flies over it |
| Sliding block | Moves back and forth on a visible track; 30 px tall, so a Loft clears it. A block that runs into a resting ball shoves it | Traffic to time or to chip over |
| Boost arrows | Accelerate a rolling ball along the arrows, up to a cap | Turbo lanes that extend Power's reach |
| Spring | A rolling ball that crosses it is launched into the air, higher the faster it arrives | A third route over water for ground clubs |
| Star | One per hole. Collected by any ball passing low enough; never affects the score | Rewards for the risky or scenic line |

Do not draw a permanent barrier as a tree. Players should be able to rely on
the visual rule: **trees can be chipped over; mountains cannot**. The plain
dark walls around the edge of the canvas are only the course boundary.

## Hole data

Holes live in `HOLES` in `index.html` and are authored in the landscape
`960 × 480` coordinate space. Portrait mode rotates the same data.

```js
{
  name: 'Example',
  par: 3,
  tee: [70, 240],
  cup: [850, 240],
  greens: [[850, 240, 78, 58]],
  walls: [
    [330, 200, 160, 40, 38, 'trees'],
    [600, 18, 45, 260, undefined, 'mountain'],
  ],
  sands: [[420, 310, 130, 90]],
  waters: [[690, 80, 100, 120]],
  ice: [[180, 70, 280, 70]],
  lava: [[500, 300, 120, 90]],
  bumpers: [[360, 180, 22]],
  portals: [[250, 240], [710, 120]],
  springs: [[300, 150, 20]],                     // [cx, cy, r]
  boosts: [[214, 262, 96, 40, 0]],               // [x, y, w, h, angleDeg]
  sliders: [{ rect: [270, 40, 40, 120], travel: [0, 280], period: 150, phase: 0 }],
  windmills: [{ center: [470, 240], len: 60, hub: 13, blades: 4, speed: .028, phase: .4 }],
  star: [480, 74],
  signs: [[110, 120, 'EASE OFF · ACE']],
}
```

Portrait phones see the same landscape world rotated by the render
transform, so hole data and physics never change with orientation.

Obstacle arrays use `[x, y, width, height, clearanceHeight, type]`:

- A tree obstacle requires a numeric clearance height and the type `'trees'`.
- A mountain uses `undefined` for clearance height and the type `'mountain'`.
- Sand, water, ice, and lava use `[x, y, width, height]`.
- Greens use `[centerX, centerY, radiusX, radiusY]` and should normally contain
  the cup. They rotate with the rest of the course in portrait mode.
- Bumpers use `[centerX, centerY, radius]`. Keep enough clearance around each
  bumper that a successful bank has somewhere useful to travel.
- A pair of rifts uses `portals: [[x1, y1], [x2, y2]]`; use exactly two.
- Keep every obstacle inside the 18 px outer boundary.

Collision still uses the full rectangular footprint. The tree and mountain
renderers only change how that footprint is presented.

## Designing a hole

1. Begin with two viable tee-to-cup routes: a forgiving route that costs a
   setup shot and a dangerous route that can save at least one stroke.
2. Use mountains to separate those routes or create a dogleg. Never let an
   impassable obstacle make the advertised shortcut a dead end.
3. Add trees where a wedge shortcut should compete with the safer route.
4. Place a green around the cup with enough room for an approach to land and a
   miss to roll visibly through. Avoid pointing a long ice lane directly at it.
5. Add hazards to make misses meaningful without obscuring the route. Reserve
   lava for an optional high-reward line or a late-course climax.
6. Check that the intended tree shortcut needs visible loft and that the
   mountain route cannot be cleared by any club.
7. Test both landscape and portrait layouts; the same obstacle data rotates.
8. Update the displayed hole count and total par if the course length changes.

Aim for one memorable decision per hole. A hole is not finished until both its
safe and high-risk/high-reward routes are visually readable and practically
playable.

## Physics facts that shape every hole

- **A clear straight line is an ace.** A rolling ball only lips out above
  7 px/frame, so any shot that would stop within roughly 250 px past the cup
  drops in. The short line on every hole must be narrow (a gap, a bank, a
  rift, timing, a hazard to skim) or blocked outright.
- **What each club's preview shows is part of its identity.** Power's
  preview stops at its first contact. Loft's stops at touchdown, so its
  rollout needs feel. Precision shows the full path, including banks, rifts
  and the timing of moving parts, but its range is only about 200 px.
- **Physics runs at a fixed 60 Hz.** It no longer depends on the display's
  refresh rate, and moving obstacles are functions of the physics tick, so
  the preview and the real shot always agree.

## Golden Hour course

| # | Hole | Par | Signature |
| --- | --- | --- | --- |
| 1 | Runway | 3 | ease off down the ice strip for an ace; the sides are safe |
| 2 | The Old Mill | 3 | time a shot through the windmill; the turbo lane feeds the lower gap |
| 3 | Over the Hedge | 3 | one brave Loft over the hedge, or three shots around |
| 4 | Springboard | 3 | Loft the canal, thread the footbridge, or roll onto the spring and fly (star over the canal) |
| 5 | The Cage | 3 | four candy bumpers around the green, ponds either side |
| 6 | Rush Hour | 3 | three sliding blocks: pick a gap or Loft the traffic |
| 7 | Glacier | 3 | a thin ice bank around the island |
| 8 | Gravity Bloom | 3 | skim the star so gravity bends the roll |
| 9 | Supernova | 5 | rift heist, S-bend, ice, lava |

Verify hole data with `tools/course-solver.js`: paste it into the browser
console on a running game and call `__solve(i)`. It runs the game's own
`stepBall()` over a grid of club × angle × power (at several start ticks, so
moving parts are sampled at different timings) from the tee, and again from the
stopped cells nearest the cup. It reports ace counts, penalties, and two-shot
hole-outs. Re-run it after moving anything.
