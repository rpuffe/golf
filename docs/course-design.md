# Course design language

Use this guide when adding or revising holes. The obstacles should communicate
their physics before the player takes a shot.

## Obstacle vocabulary

| Visual | Gameplay rule | Course-design use |
| --- | --- | --- |
| Trees | Finite height; a sufficiently high shot can clear them | Shortcuts, risk/reward lines, and prompts to use the wedge |
| Mountains | Infinite height; every club collides with them | Permanent routing, doglegs, and separation between lanes |
| Sand | Airborne shots pass over it; grounded balls lose speed quickly | Punish inaccurate landings without adding a stroke |
| Water | Airborne shots pass over it; landing or rolling into it adds one stroke and resets the ball to its previous lie | Forced carries and high-risk shortcuts |

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
}
```

Obstacle arrays use `[x, y, width, height, clearanceHeight, type]`:

- A tree obstacle requires a numeric clearance height and the type `'trees'`.
- A mountain uses `undefined` for clearance height and the type `'mountain'`.
- Sand and water use `[x, y, width, height]`.
- Keep every obstacle inside the 18 px outer boundary.

Collision still uses the full rectangular footprint. The tree and mountain
renderers only change how that footprint is presented.

## Designing a hole

1. Begin with a clear tee-to-cup route that cannot trap the ball.
2. Use mountains to shape the required route or create a dogleg.
3. Add trees where a wedge shortcut should compete with the safer route.
4. Add sand or water to make misses meaningful without obscuring the route.
5. Check that the intended tree shortcut needs visible loft and that the
   mountain route cannot be cleared by any club.
6. Test both landscape and portrait layouts; the same obstacle data rotates.
7. Update the displayed hole count and total par if the course length changes.

Aim for one memorable decision per hole. Reusing the visual language is good;
reusing the same obstacle arrangement is not.
