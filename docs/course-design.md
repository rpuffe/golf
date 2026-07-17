# Course design language

Use this guide when adding or revising holes. The obstacles should communicate
their physics before the player takes a shot.

## Obstacle vocabulary

| Visual | Gameplay rule | Course-design use |
| --- | --- | --- |
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
4. Add hazards to make misses meaningful without obscuring the route. Reserve
   lava for an optional high-reward line or a late-course climax.
5. Check that the intended tree shortcut needs visible loft and that the
   mountain route cannot be cleared by any club.
6. Test both landscape and portrait layouts; the same obstacle data rotates.
7. Update the displayed hole count and total par if the course length changes.

Aim for one memorable decision per hole. A hole is not finished until both its
safe and high-risk/high-reward routes are visually readable and practically
playable. The After Dark Gauntlet introduces ice, lava, and rifts separately
before combining them on the final three holes.

`Lucky Spiral` is the intentional exception to ordinary free-ball movement: a
fast grounded ball entering its marked icy rail follows two tightening laps.
The final release has a controlled random chance to hole out. Its safe route is
still fully player-driven: Loft can clear the 28 px bumper rails in stages.
