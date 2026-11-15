# Fun Council Pass Rubric

Written by the council's Fun Expert (chair) for the final five features. To
pass, the demo must meet all 10 criteria.

Automation checks use a JS hook, `window.golf`:

- **Exposed state:** hole, strokes, ball position and rest state, active ball
  name, hysteria level, goose state, wind, current caption, and the ghost's
  source, position, stroke and per-hole race status.
- **Injected input:** a swing (`club`, `tempo`, `drift`) and a placement for
  the ball or the ghost.

1. **Time-to-fun**
   - The first ball is struck at most 20 s after page load.
   - At most one dismissable screen comes before it.
   - No instruction text before the first swing is longer than 25 words.
   - A screenshot of the hole-1 tee shows the fairway, the flag, the goose
     and Old Tom's tombstone or ghost.

2. **Swing feel is analog**
   - Three injected swings with different tempos give carry distances that
     spread by at least 30%.
   - Changing only `drift` moves the landing point sideways by at least 10%
     of carry.
   - The Space hold/release swing also works.
   - Impact has hitstop or a camera kick of at least 50 ms, plus a strike
     sound.
   - A pure strike and a mishit use different audio and visuals.

3. **Scope is readable and honest**
   - Holding right-click shows a rangefinder that updates as the reticle
     moves. Its distance is within 2% of the true terrain distance, and its
     elevation is within 1 m.
   - The wind ticker shows the same wind the physics uses (code check).
   - Holding Shift cuts sway by at least 50%.
   - Breath runs out after a capped time, and then the sway gets worse.
   - Scoping never costs a stroke.

4. **Hole-out payoff (bullet-cam)**
   - Holing out, or stopping within 1 m on a shot from off the green,
     triggers a slow-mo chase cam that lasts 1.5–4 s. A click skips it.
   - It never triggers on a routine putt shorter than 3 m.
   - After a hole-out there is a fanfare and particles, and the next hole is
     playable within 3 s.

5. **Ghost Strokes: the race and the stymie**
   - **Round-1 rival:** The ghost is "Old Tom" (`ghost.source === 'oldtom'`).
     He plays a precomputed, deterministic round that totals within ±2 of
     par.
   - **Your best round:** After you finish a round and reload, the ghost is
     `'pb'`, using your saved best total. If storage is unavailable it falls
     back to Old Tom.
   - **Sync:** Your stroke N and the ghost's stroke N launch within 1 frame
     of each other, starting with the first tee shot. Once the ghost holes
     out, it stays in the cup.
   - **Solid, one-way:**
     - Test: rest the ghost on a putting line and putt into it. The player's
       ball deflects by at least 20°, and the ghost does not move.
     - Collisions in flight are handled too (code check).
   - **Fair:** A ghost that overlaps the player's lie, or sits within 0.15 m
     of the cup, is not solid.
   - **Readable:** In a screenshot the ghost is translucent and tinted
     differently from the player's ball.
   - **Race HUD:** It shows ahead, level or behind, and updates after every
     stroke.
   - **Trails:** Your own earlier strokes leave faint trails that the ball
     passes through. They clear at the end of the hole.

6. **The Goose works and plays fair**
   - There is a goose on every hole.
   - When a ball stops within its radius, it honks, grabs the ball and
     waddles off, and `goose.state` changes.
   - **Goose cam** (owner request, November 2026): once it has the ball,
     the camera follows the goose in a side-on tracking shot. You can see
     your ball in its beak, but you have no say in where it goes. The goose's
     theme song plays (synthesized, about 7.7 s), it head-bobs on the beat,
     and it drops the ball when the song ends, always on a playable lie. The
     theft adds no stroke. This replaces the old free shoo shot.
   - A shot that hits the goose produces a honk, feathers and a deflection.

7. **Five Balls, One Life**
   - The HUD shows 5 named balls.
   - Under the same injected swing, each trait changes carry or bounce by at
     least 10%.
   - Water always starts the reel-in minigame:
     - It lasts 10 s or less.
     - Competent injected input wins at least 70% of the time.
     - A win adds 1 stroke and drops the ball at the shore.
     - Snapping the line kills the ball. A eulogy names it, and a tombstone
       appears by hole 1's tee that survives a reload.
   - Some catches are junk.
   - Once all 5 balls are dead, "Range Ball #4471" takes over.

8. **The commentator makes reactions distinct**
   - Every outcome class gets its own sound, a visual cue and a commentator
     line with a caption. The classes are fairway, rough, sand, water, out of
     bounds, green, holed, goose theft, goose hit, ghost collision, stymie,
     overtaking or falling behind the ghost, line snap and junk.
   - Captions appear even when speechSynthesis is stubbed out.
   - Hysteria rises on bad events and decays on good ones. It has at least 3
     tiers that differ in pitch, rate and wording.
   - The same line never plays twice in a row, and speech never blocks
     input.

9. **Failure is entertaining and holes differ**
   - After any shot, no more than 4 s pass without player input or a new
     event.
   - A failed shot costs at most 12 s of wall-clock time and gets an
     escalated line.
   - Each hole spotlights a different feature:
     - Hole 1: the goose.
     - Hole 2: the water and the angler.
     - Hole 3: the sloped green. Old Tom's precomputed approach rests on the
       green, which makes a stymie likely.
     - Hole 4: the scope and wind on the carry.
   - Every feature has appeared by the end of hole 2, except the stymie.

10. **Replay pull and robustness**
    - The end screen shows:
      - your total against the ghost's, hole by hole;
      - the leaderboard;
      - the graveyard count;
      - at least one highlight (best bullet-cam, ghost collisions, goose
        thefts, balls lost).
    - Beating the ghost explicitly sets the new ghost for next time.
    - One click restarts and reaches the first shot within 5 s.
    - Wind and goose start positions change between runs.
    - A full injected round finishes in under 6 minutes with zero console
      errors, at 45 fps or better on a mid-range laptop.

11. **Putting feels controllable** (added November 2026)
    - The putter's full stroke scales to the putt in learnable tiers
      (3/6/10/15/21 m), shown on the club button. A 2 m putt uses most of
      the pull-back, not a 30-pixel twitch.
    - While you pull back, a white ring and a "4.2 m" readout show the
      flat-green roll distance. You still have to read the slope.
    - Tempo never changes putt distance; only power does.
    - The cup is generous (radius 0.24 m). A decent read holes nearly every
      1.5 m putt, and most 3 m putts finish in or within tap-in range.

12. **Carry, in Geese: the distance indicator** (Fun Council pick)
    - During the backswing, a live ring, a light pillar and a label slide
      out to the predicted carry. They show honest metres and one absurd
      unit per hole (geese, baguettes, blue whales, seconds of commentator
      screaming…).
    - The ring is green, then yellow, then red past 100% ("OVERCOOKED").
    - It freezes on the downswing and stays faintly visible in flight.
    - Landing within about 2.5% of the mark: "CALLED IT!", a chime, a line
      from the commentator and an end-screen tile.
    - Carry only: tempo, drift and roll are never previewed.
    - A theremin tone follows the predicted carry while you pull back. A
      tempo chip after impact shows how clean the strike was.

13. **Rooms: live multiplayer** (added November 2026)
    - Create a room, share a 4-letter code or link, and the host starts a
      round for everyone. Everyone gets the same five balls and the same
      wind, and the goose stays random.
    - A friend's shot on your hole plays back as it arrives, about 0.25 s
      after they hit it at normal latency. Their resting ball is solid: you
      can be stymied by it and carom off it.
    - Golf-style standings (to par, "thru N") sit top-right, with
      commentary when you overtake or fall behind a named friend.
    - The room survives latency, jitter, a dropped connection mid-shot and a
      page reload. Late joiners can jump into a round in progress.

## Round 6 additions

Criteria 14–20 (holes 5–7, the hole 6 jumpscare, the power-up wheel, room
interactions, more geese, the seven-word rule) and the amendments to 1, 4
and 5 (par 27, a 10-minute round, hole 6 exempt from the 3 s rule until
the scare ends) live in [council-round6.md](council-round6.md), section 6.
The owner's tug-of-war (after the goose's song) is judged with criterion 6:
it must be winnable by frantic shaking, lost more often than won by a
typical effort, and every loss must end on a playable lie with no stroke added.
