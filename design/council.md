# The Council: how the five signature features were chosen

This is the record of the design process behind the 3D first-person rebuild.
(It lives in `design/`, not `docs/`, because `make upgrade` owns `docs/`.)

## 1. Ideation: five persona designers, 50 pitches

Each designer pitched 10 features independently:

| Persona | Leaned on |
| --- | --- |
| Roguelike / deckbuilder designer | Slay the Spire, Balatro, Hades |
| Immersive-sim / horror designer | Dishonored, Prey, Amnesia, Inscryption |
| Rhythm / music designer | Rhythm Heaven, Thumper, Hi-Fi Rush |
| Party / physics-comedy designer | WarioWare, Goat Sim, Untitled Goose Game |
| Surrealist genre-mashup auteur | Katamari, Superliminal, Cooking Mama, noir, dating sims |

After merging duplicates there were 29 distinct ideas (the beat-synced course
was pitched 5×, ride-the-ball 4×, the shy/runaway cup 4×).

## 2. Judging: five council members

Each judge scored all 29 ideas 1–5 through their own lens, picked a ranked
top-5 *set*, and could veto up to three.

| Judge | Lens |
| --- | --- |
| **Fun Expert (chair)** | moment-to-moment fun; also authored the pass rubric |
| Technical Director | can one engineer build it *well* in Three.js |
| Player Advocate | first-time clarity, frustration, accessibility |
| Weirdness Curator | novelty, identity, "would you tell a friend" |
| Golf Purist | does it still deepen real golf decisions |

### Tally (rank points: 1st = 5 … 5th = 1; sum = total of the five 1–5 scores)

| Idea | Picked by | Rank pts | Score sum | Vetoed by |
| --- | --- | --- | --- | --- |
| **Sniper's Lie** (scope, breath-hold, bullet-cam) | Tech, UX, Golf | **11** | 19 | Weird |
| **Ghost Strokes** (past strokes replay as solid ghosts) | Tech, UX | **9** | 17 | — |
| **Goose Marshal** (a goose steals your ball) | Fun, UX | **8** | 19 | — |
| Shy / Runaway Cup | Tech, Weird | 7 | 17 | Golf |
| **Whisper-to-Hysteria Commentator** | Fun, UX, Weird, Golf | **6** | **20** | — |
| **Ball Permadeath** (named balls, tombstones) | Weird, Golf (+Fun merge) | **6** | **21** | — |
| Hazard Angler (fish your ball out of the water) | Fun, Weird | 5 | 19 | — |
| Ride the Ball | Fun | 5 | 16 | — |
| Beat-synced course | Tech | 5 | 16 | UX (as a swing input) |
| Katamari Ball | Fun, UX | 4 | 17 | — |
| Shot Card Deck | Tech, Golf | 2 | 16 | Weird |

Rule applied: a veto removes an idea unless at least three judges picked it.
That knocks out the Shy Cup (2 picks, Golf veto) and keeps Sniper's Lie
(3 picks). Two merges suggested by the judges themselves were adopted:

- The **Fun Expert** merged Ball Permadeath *into* the Hazard Angler, and the
  **Weirdness Curator** picked both. They became one feature: water no
  longer costs a drop. It starts a fishing fight to save a named ball, and if you
  lose the fight the ball dies.
- The **Fun Expert** merged Sniper's Lie's slow-mo bullet-cam into the
  "dead flight time" problem. The bullet-cam carries the spectacle that
  Ride-the-Ball was after, and it avoids the Technical Director's warning
  about putting the camera inside the ball.

## 3. The five

1. **Sniper's Lie** *(from tactical shooters)*: hold right-click to scope
   the course. The scope has a laser rangefinder and a wind ticker, and it
   sways with your breathing. Hold Shift to hold your breath and steady it.
   A great shot triggers a slow-mo bullet-cam that rides the ball into the
   cup.
2. **Ghost Strokes** *(from Trackmania / Braid)*: you always play alongside a
   rival ghost. In your first round it is **Old Tom**, the club pro buried by
   the first tee, playing a precomputed par round. After that it is the ghost
   of **your own best round**. Your stroke N and the ghost's stroke N launch
   together. The ghost ball is **solid** to yours, in the air and at rest.
   That allows mid-air collisions and golf's long-abolished **stymie**: a
   ghost ball sitting on your putting line. Your own earlier strokes on the
   hole leave faint trails, so you can re-read a missed line.
   On the green the ghost keeps golf etiquette: **you putt, then he does**.
   His ball stays put while you putt, which is what makes the stymie real.
   *(The council first proposed "solid orbs where each earlier stroke
   stopped". That design was dropped because each orb would always sit on
   your current lie: a stroke ends where the next one begins. The Fun Expert
   rewrote the rubric for the revised design.)*
3. **The Goose** *(from Untitled Goose Game)*: every hole has a goose. Leave
   your ball near it and it honks, grabs the ball, and waddles off. Hit it
   with a free "shoo" shot to make it drop the ball, or let it go and see
   where it ends up.
4. **Whisper-to-Hysteria Commentator** *(from golf TV and skate-game
   announcers)*: a hushed golf-broadcast voice, captioned, that gets
   steadily more unhinged as things go wrong.
5. **Five Balls, One Life** *(from XCOM / roguelikes and Stardew fishing)*:
   you carry five named balls, each with a trait that changes its physics.
   A ball in the water becomes a reel-in tension fight. Win and it lives;
   snap the line and it dies, and its tombstone joins a **persistent
   graveyard** by the first tee.

## 4. Base golf non-negotiables (Golf Purist + Player Advocate)

- A deterministic, learnable mouse swing: pull back, push through. Depth
  sets power, tempo is checked, and sideways drift on the push curves the
  ball. There is also a keyboard swing (hold and release Space) and a touch
  fallback.
- Honest flight and roll on every surface. The ball checks on the green,
  releases on the fairway, dies in the rough, and plugs in the sand.
- Wind you can see, and greens with visible slope.
- After the shot, the camera follows the ball and never cuts away before it
  stops.
- A club ladder (Driver / Iron / Wedge / Putter) with no overlapping gaps.
- A safe line and a greedy line on every hole.
- Captions for every spoken line, and every audio cue has a visual
  equivalent. The weird features never cost more than one stroke.

The pass bar is the Fun Expert's rubric in [fun-rubric.md](fun-rubric.md).

## 5. Playtest loop

The demo was held to the Fun Expert's rubric and went through repeated
review rounds. Three reviewers ran headless Chromium through the
`window.golf` automation hook:

- **QA engineer:** verified each rubric criterion with measurements.
- **Chaos-monkey QA:** tried to break the game.
- **Fun Council chair:** played rounds with deliberately sloppy, human-like
  input and judged the fun.

Round 1 failed two criteria, Old Tom and pacing/feature exposure, and was
partial on three more:

- **Old Tom:** he shot 13 on par 16, which is inhumanly good.
- **Pacing:** green roll-outs crept along, and the goose was rarely met.

That round led to these changes:

- Old Tom got human error and a fixed breeze.
- The ghost now putts after you.
- Dull roll-outs are compressed.
- The goose patrols hole 1's landing zone.
- Captions got priorities, and hysteria decays between shots.
- The Space swing got an accuracy needle.
- The bullet-cam triggers more widely.
- The chase cam is faster.

**Round 2:** 8 PASS, 2 PARTIAL.

- The commentator never left its whisper.
- Hole 3 produced a stymie on only 1.6% of approaches.
- The QA re-check also caught two regressions: race lines were being
  silenced, and the Space swing was rigged.

The fixes:

- Hysteria now decays only to a floor set by how the hole is going, so a
  bad hole builds to the top tier.
- Hole 3 got its set piece: once you reach the green, Old Tom's ghost ball
  drifts onto your line and waits there while you putt. He's a ghost; he
  cheats.
- The Space swing became a classic two-tap: power first, then accuracy.
- You race the tougher of Old Tom and your own best round.

**Round 3:** 9 PASS, 1 PARTIAL. The goose could hold your ball hostage
forever, because its 10 s clock paused while it watched each shoo. The
theft clock now never pauses. A shoo from close range uses the putter, the
server validates submitted rounds, and the hole 3 green was softened.

**Round 4: PASS, 10 of 10.** The goose reliably releases the ball at 10 s,
even through 20 missed shoos, and auto-selected shoos hit 6 of 6 times. A
full round of human-like play regressed nothing. The chair's verdict: the
goose theft and shoo, the hysteria arc, the eulogies, the hole 3 stymie set
piece and the frequent bullet-cams make for a short, funny round with a
reason to play it again.

## Round 5 (November 2026): multiplayer, putting, distance indicator, goose cam

**Owner requests:** live multiplayer rooms, better-feeling putting with a
bigger cup, a slightly absurd shot-distance indicator, and a goose that takes
over the camera, with a song.

**Council pick for the indicator: "Carry, in Geese."** The Weirdness Curator
pitched six takes, and the Player Advocate killed the mole, the tape measure
and the hazard float. The pick:
- a live ring, pillar and label that slide out to the predicted carry as you
  pull back, in honest metres;
- one absurd unit per hole (geese, baguettes, blue whales, seconds of
  commentator screaming…);
- a backswing theremin and a "CALLED IT" chime;
- a tempo chip after impact.

**Playtest verdict (headless, ~200 ms simulated RTT): 8/10.**
- Rooms: pass. A friend's shot started playback a median 236 ms after the
  hit, and the room recovered from a network outage in 683 ms.
- Goose cam: pass.
- Putting: partial. Hard putts always dropped.
- Carry indicator: partial. CALLED IT fired on about half of swings, and the
  absurd unit was unreadable.

**Fixes made after the verdict:**
- **Putting:**
  - The pull-back now maps to metres through a flat-green roll table
    measured from the sim.
  - Greens feel half their visual slope.
  - Default green undulation dropped from 0.5 to 0.28.
  - Cup capture speed is now 1.0 m/s.
  - Measured result: from 3 m, putts paced 0.2–1 m past the cup hole 26–32
    of 32. Rammed putts hole 0–17 of 32.
- **CALLED IT:** needs a pure strike with tempo ≥ 0.95, landing within 1%
  of the call (minimum 0.5 m). A consistent simulated player gets it on
  about 13–30% of swings.
- **Absurd unit:** now shown in the HUD readout by the power bar, and larger
  in the world label.
- **Goose cam:** switches sides when a tree trunk would block the shot.
- **Room commentary:**
  - Stymies by a friend get their own lines that name them.
  - Draws level with {rival} gets its own line.
  - The lobby says "Round over" once you've finished.

Old Tom still totals 14 against par 16.
