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
| Neon bumper | Reflects grounded/low shots and returns slightly more speed; a high Loft clears it | Bank-shot shortcuts, chip routes, and pinball set pieces |
| Paired rifts | Grounded balls teleport between the two rings while keeping their direction and speed; airborne shots pass over | Finale set pieces and impossible-looking routes |

Do not draw a permanent barrier as a tree. Players should be able to rely on
the visual rule: **trees can be chipped over; mountains cannot**. The plain
dark walls around the edge of the canvas are only the course boundary.

## Hole data

Holes live in `BASE_HOLES` in `index.html` and are authored in the landscape
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
}
```

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

## Two physics facts that shape every hole

- **A clear straight line is an ace.** A rolling ball only lips out above
  7 px/frame; on turf that means any shot that would stop within roughly
  250 px past the cup drops in. So the short line on every hole must be
  narrow (a gap, a bank, a rift, a hazard to skim) or blocked outright, or
  the hole is a free ace.
- **The aim preview shows landing and rollout for Power and Precision, but
  not the rollout of a Loft.** Loft is the club that still needs feel, which
  is why the hedge hole's only ace is a Loft.

## The Neon Nine

| # | Hole | Par | Lesson | Short line | Patient line |
| --- | --- | --- | --- | --- | --- |
| 1 | Runway | 3 | Power + ice rollout | ease off down the ice strip: ace; flat out lips out and slides back | play the sides around the sand |
| 2 | Splash Zone | 3 | carrying water | full drive through the footbridge, then hole out | Loft the canal, approach, putt |
| 3 | Over the Hedge | 3 | height | one Loft over the hedge (rollout unpreviewed) | three shots around the end |
| 4 | The Cage | 3 | banks | drive past the mountain, thread the posts | lay up in a corridor, tap through the door |
| 5 | Glacier | 3 | ice | razor-thin bank off the bottom wall around the island | drive onto the ice, then approach |
| 6 | Island | 3 | commitment | layup to the shore, Loft onto the island, hole the Loft | same, but putt |
| 7 | Wormhole | 3 | rifts | roll into the rift, exit fires at the flag; a miss finds the lake | around the lake along the bottom |
| 8 | Gravity Bloom | 3 | gravity | skim the star so it bends the roll to the green | Loft above the well |
| 9 | Supernova | 5 | everything | rift heist up the left edge into the greenside bunker | canal, S-bend, ice, around the lava |

Hole data is verified with a brute-force solver that runs the game's own
`step()` over a grid of club × angle × power from the tee and again from the
best landing cells, and reports ace windows, penalty counts, and two-shot
hole-outs. Re-run it (`tools/course-solver.js`, pasted into the browser console) after
moving anything.
