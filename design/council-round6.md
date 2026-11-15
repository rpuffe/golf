# Council Round 6: seven holes, a wheel, geese, and a scare

Same council and format as [council.md](council.md): five persona designers
pitch, five judges score through their own lens, and a veto removes an idea
unless at least three judges picked it.

**Owner asks (paraphrased):** three more holes, more unhinged, with a
jumpscare on hole 6. A power-up wheel on every hole. More ways for players in
a room to interact while they wait and spectate. More geese. Every
player-facing instruction is 7 words or fewer. A late agenda item asked the
council to judge the owner's plan for explaining named balls (section 7).

Every player-facing string in this document is 7 words or fewer.

---

## 1. Pitches (merged duplicates in brackets)

| Persona | Holes | Jumpscare | Wheel / interactions |
| --- | --- | --- | --- |
| Roguelike designer | Shy Cup returns; Travelator fairway | Commentator reads your obituary | Mulligan, Double-or-Nothing, Swap Meet |
| Horror designer | **Old Tom's Plot** (graveyard, fog) [×3]; Lights-out hole | **Cup Grab**: Tom bursts from the cup; Scope Face; He's behind you | Haunt: spectators become solid ghosts |
| Rhythm designer | Beat hole (terrain pulses to the goose song) | Booth goes silent, then screams [merged into Cup Grab] | Reactions on the beat |
| Party designer | **Windmill of Spite** [×2]; Pinball bumpers; Goose Parliament | Goose wearing Old Tom's cap | **Be the Goose**; Sic 'Em; Pogo Ball |
| Surrealist auteur | **Moonshot** (low gravity) [×2]; Mirror hole | Fake crash screen with Tom's face | Moon Boots, Ghost Ball, Bucket Cup |
| Golf Purist (judge, asked to pitch) | Mesa green finale | n/a | **Gimme**; Life Ring |

## 2. Judging

### Holes

| Idea | Picked by | Score sum | Veto | Outcome |
| --- | --- | --- | --- | --- |
| **Old Tom's Plot** | Fun, UX, Weird, Golf, Tech | 22 | none | **Hole 6** |
| **Windmill of Spite** | Fun, Weird, Golf | 19 | none | **Hole 5** |
| **Moonshot** (+ mesa green, + Goose Parliament) | Fun, Weird, Tech | 19 | none | **Hole 7** |
| Pinball bumpers | Tech, Fun | 17 | none | Runner-up. A free fallback if the windmill slips (sphere `e: 1.4`) |
| Travelator | Tech | 15 | none | Cut |
| Beat hole | Weird | 14 | Tech | Cut. Old Tom can't plan around music time |
| Shy Cup | Weird | 13 | Golf (again) | Cut |
| Lights-out | Weird | 12 | UX | Cut. You can't read a dark green |
| Mirror hole | Weird | 11 | UX | Cut. Inverted aim breaks muscle memory |

**Debate, short.**
- **Windmill.** The Technical Director objected to a wall-clock windmill:
  Old Tom can't plan for it, and rooms would disagree on its phase. The
  Party designer's fix won the room: **the windmill only spins while a ball
  is in flight**. Its pose is a pure function of the stroke number and the
  sim frame. That makes it deterministic, learnable (you see the start pose
  at address), and identical for Old Tom's stroke N and yours.
- **The Golf Purist** accepted the windmill on two conditions:
  - its tower blocks only the centre line;
  - there is a clear lane on each side.

  Simulation result: aiming 0.10 rad off centre never touches it, and
  aiming 0.05 rad off threads the blades and gets swatted about 15% of the
  time. That is a gamble you choose, not blind luck.
- **Moonshot.** Low gravity applies in the air only. Rolling and putting
  stay at Earth gravity, so the putt ring stays honest. Lift is scaled with
  gravity so the ball doesn't climb forever.

### Jumpscare

| Idea | Picked by | Veto | Outcome |
| --- | --- | --- | --- |
| **Cup Grab** (with the booth-silence merge) | Fun, UX, Weird, Tech, Golf | none | **Winner** |
| Scope Face | Weird, Fun | Tech | Cut. It isn't guaranteed to fire, since not everyone scopes |
| He's Behind You (walk cam) | Weird | UX | Cut. The camera turns away from the ball |
| Fake crash screen | Weird | UX | Cut. Fake system UI erodes trust |
| Lights-out scare | none | UX | Cut. Photosensitivity risk |

The Player Advocate's case for Cup Grab: it fires at hole-out, which every
player reaches exactly once. The stroke is already counted and nothing is in
flight, so it can't cost a stroke or ruin a shot. The Weirdness Curator's
case: turning the payoff moment into the scare is the joke.

### Wheel wedges (14 pitched, 8 kept)

| Wedge | Verdict |
| --- | --- |
| Bucket Cup, Ghost Ball, Life Ring | Kept (good) |
| Moon Boots, Pogo Ball, Sic 'Em | Kept (chaotic) |
| Banana Ball, Goose Magnet | Kept (mildly cursed) |
| Rocket Ball | Merged into Moon Boots (same "+40%" feel) |
| Gale Force | Cut for Goose Magnet (more geese) |
| Mulligan | Tech veto: breaks ghost stroke-N sync |
| Swap Meet | Golf veto: trades a 1 m putt for a bunker |
| Clown Shoes (inverted drift) | UX veto |
| Double or Nothing | Golf veto |

**Seeding debate.** The Golf Purist wanted the same wedge for everyone; the
Weirdness Curator wanted chaos. The compromise is per-player draws from a
per-player shuffle of the 8 wedges:
- Hole 1 always draws a good wedge.
- Each player sees 7 of the 8 wedges once per round. The round is
  near-fair; each hole is chaos.
- The draw is seeded from the room seed and your member id, so a reload
  can't re-roll it, and every client can compute everyone's wedges with no
  message.

### Interactions

| Idea | Picked by | Veto | Outcome |
| --- | --- | --- | --- |
| **Reactions** | Fun, UX, Weird, Tech | none | Kept |
| **Be the Goose** (spectators puppet a goose) | Fun, Weird, Tech | none | Kept, cosmetic only (UX condition) |
| **Gimme** | Golf, UX, Tech | none | Kept. Real etiquette, and it shortens waits |
| **Sic 'Em** (wheel) | Fun, Weird | none | Kept as the wheel's rival wedge |
| Epitaphs on rivals' tombstones | Weird, Golf | none | Runner-up. Cut for time |
| Haunt (solid spectator ghosts) | Weird | UX | Cut. Spectators could park on putting lines |
| Spectator wind gusts | Fun | Tech, Golf | Cut. Breaks the impact-time sim |

---

## 3. Decisions: holes 5–7

Round: 7 holes, **par 27**. Headless check with Old Tom's planner patched
for the new fields: Tom shoots **4 / 3 / 4** on holes 5 / 6 / 7, so his round
totals **25** (−2, in band). Full-power straight carries:

| Hole | Driver carry / total | 7 iron | Wedge |
| --- | --- | --- | --- |
| Holes 5–6 | 131 / 158 m | 97 / 117 m | 59 / 69 m |
| Hole 7 (moon gravity) | 185 / 224 m | 147 / 170 m | 99 / 109 m |

Hole data, the new fields, lighting, geese, the scare spec and the engine
notes are in section 9, the implementation source of truth.

## 4. Decisions: the hole 6 jumpscare

The full spec is in section 9. In short:
- **Trigger:** your first hole-out on hole 6 each round.
- **What appears:** Old Tom lunges up 1.3 m in front of the camera, a single
  cyan vignette fades in and out, and a WebAudio sting plays.
- **What he says:** "Fore."
- **How it ends:** he dissolves into the cup, then the normal celebration
  runs. The scare takes 2.6 s, and any input skips it.
- **Safety:** reduced motion and "Scares off" both get a gentle wave
  instead.

## 5. Decisions: wheel, interactions, geese

Section 9 has the exact effects, durations and message formats.

## 6. Rubric additions

These are appended to fun-rubric.md.

**Amendments to the existing criteria:**
- **1.** The wheel never blocks input and is not a screen.
- **4.** On hole 6, the next hole is playable within 3 s of the scare
  ending, or within 3 s of a skip.
- **5.** Old Tom totals within ±2 of par 27. On hole 6 his ball is hidden
  and not solid, and his race status shows "???".
- **6.** Every hole has at least one goose; 18 adults across the round.
- **9.** Holes 5, 6 and 7 spotlight the windmill, the scare and moon
  gravity respectively.
- **10.** A full injected round finishes in under 10 minutes.
- **7.** Now reads: "HUD shows the active ball's name and trait, and the
  survivors out of 5."

14. **Holes 5–7 are unhinged and fair**
    - The windmill's pose is a pure function of (stroke number, sim frame).
      At address it rests at `strokeNo × step`. Two runs with the same
      inputs give identical frames.
    - Each hole has a lane that avoids its hazard. On hole 5, a drive aimed
      0.10 rad off centre never touches the windmill. A blade hit produces
      a distinct sound, a commentator line and a "SWATTED" banner.
    - On hole 7, air gravity is 0.5 and putting is unchanged: the putt ring
      is within 2% of the flat roll on holes 1 and 7.
    - Night holes: from hole 6's tee, the flag beacon and your ball are
      visible in a screenshot.

15. **The hole 6 jumpscare**
    - It fires exactly once per round, on the hole 6 hole-out (including a
      gimme), and never on any other hole.
    - No frame-to-frame luminance change above 10% of screen average,
      apart from one vignette fade; no strobing.
    - The stroke count is unchanged, and no shot is ever in flight when it
      fires.
    - It lasts 2.6 s or less. Click, Space or Esc skips it within 1 frame.
    - Reduced motion and "Scares off" give the gentle variant.
    - In rooms, others get a toast.

16. **The power-up wheel**
    - Exactly 8 wedges. Every description is 7 words or fewer.
    - It spins on every hole without blocking a swing. Hole 1's wedge is
      always good.
    - Each wedge measurably changes its target: cup radius, collisions with
      tree tags, flight air time, bounce height, side curve, goose radius,
      theft, or penalty.
    - Same room seed and member id give the same 7 wedges after a reload.
    - "Next shot" means the next non-putter player stroke. "This hole"
      effects clear on hole load.

17. **Rooms interact**
    - Reactions, Be the Goose, Gimme and Sic 'Em each work over `emote`.
    - The client never exceeds the server bucket (burst 5, 1.5 s refill).
    - No reaction or honk sound plays during the receiver's backswing,
      scope or fishing.
    - A puppet goose is never solid, never steals, never enters the green,
      and stays at least 6 m from the receiver's ball.
    - A gimme only completes when the receiver accepts it, with 1 m or less
      to go.
    - Stale emotes (wrong round or hole) are ignored.

18. **More geese, still fair**
    - Hole 7's boss is 1.8× size with a lower-key song of the same length.
    - At most 2 thefts per hole per player, and never on the stroke right
      after a theft.
    - Goslings never steal. Hole 6's geese stare at the cup, then flee
      after the scare.

19. **Seven words**
    - Every player-facing string added by these features (hints, wedge
      text, toasts, captions, tags) is 7 words or fewer. Automated scan of
      the string tables.

20. **Ball names land**
    - A first-time tester can name their ball after hole 1.
    - The tag never overlaps the wheel card.
    - No round-start toast.

---

## 7. Ball names (owner's late agenda item; spec section 5)

**The plan:**
- googly eyes on the ball;
- a 6 s tag with the name and trait;
- a HUD line;
- a round-start toast;
- a title-card line.

**Debate.**
- **Fun Expert:** the googly eyes are the best idea here. They make the ball
  a character with no text at all, and the pupils rattling in flight are
  perfect. Spend effort on the eyes acting, not on more labels.
- **Player Advocate:** five surfaces say the same thing. The toast and the
  title overlap. The title line is 9 words, which breaks the 7-word rule.
  The 6 s tag lands at the same moment as the new wheel card, which is
  exactly the "too many menus" complaint. "4 left" is ambiguous: 4 more,
  or 4 including this one?
- **Golf Purist:** the trait matters for decisions (a Bouncy ball changes
  club choice), so it must be readable on demand in the HUD, not only
  floating for 6 s.
- **Technical Director:** the eyes are cheap: two white spheres and
  billboarded pupils, with no collider. Keep eyes off ghost and rival balls
  so the ghost readability rule holds.
- **Weirdness Curator:** it's funnier if the ball introduces itself.

**Verdict: eyes yes, tag event-based, fewer surfaces.**

1. **Keep the googly eyes.** Add three acting beats, all wordless:
   - At address, the pupils glance at water within 25 m.
   - The pupils track the goose while it's alert or fetching.
   - The eyes turn to X's when the line snaps.
2. **The tag is event-based, not permanent and not 6 s per hole.**
   - **New ball in play** (round start, after a death, Range Ball): 4 s,
     two lines: "👀 Hi, I'm Margaret." and "Bouncy: bounces 70% higher".
   - **Hole start:** the name line only, for 2 s, finished before the
     wheel lands at 2.3 s.
   - **Peril:** a water splash pops "MARGARET!" over the splash, and the
     fishing title reads "Save Margaret!".
3. **HUD line:** "● Margaret · Bouncy" plus five pips (●●●●○) for the
   survivors, instead of "4 left".
4. **Drop the round-start toast.** The intro tag and the title already
   cover it, and the wheel card is up then.
5. **Title card:** "Five named balls. One life each." (6 words).
6. **Successor intro after a death:** "Hi, I'm Doris. Be gentle."

---

## 8. Server and platform follow-ups the spec depends on

- `main.go` `minRoundStrokes` goes from 4 to 7. Comments that say
  "4 holes, par 16" need updating.
- `store.go` `scorePrefix` moves to a new prefix (for example
  `scores-3d7/`), because 4-hole totals aren't comparable.
- A PB ghost is ignored unless `pbGhost.holes.length === HOLES.length`.
- Emote facts from `rooms.go`:
  - `arg` is a **string** of at most 64 bytes;
  - `kind` matches `[a-z0-9_-]`, at most 24 bytes;
  - the event carries `round`;
  - the bucket bursts 5 and refills one token every 1.5 s;
  - the server rejects `to` when it equals the sender.

## 9. Final implementation spec

Round: 7 holes, par 27. Tom's planner, patched in a scratch copy, shoots 4/3/4 on holes 5–7, for a total of 25.

### 1. Holes 5–7

```js
{ name: 'The Windmill of Spite', par: 4, seed: 67, spotlight: 'windmill',
  tee: [0, 0], pin: [-12, -292], path: [[0, -6], [0, -160], [-12, -292]],
  fairwayWidth: 36, bounds: [-60, -322, 60, 14],
  greenSize: [14, 12], greenTilt: [0.012, -0.01],
  hills: [[-40, -60, 26, 3], [42, -150, 30, 4], [-30, -310, 22, 3]],
  bunkers: [[14, -168, 6, 4], [-26, -276, 4, 3], [2, -306, 5, 2.5]], ponds: [],
  trees: { density: 0.8 },
  windmill: { at: [0, -100], hubH: 9, len: 8.5, blades: 4, period: 5, step: 0.9, tower: 2.4, towerH: 12, face: 2.6 },
  geese: [{ area: [-6, -175, 14], radius: 9 }, { area: [10, -205, 10], radius: 9 }, { area: [-14, -268, 8], radius: 9 }],
  wind: 3.5, hint: 'It only spins when you swing.' },
{ name: "Old Tom's Plot", par: 3, seed: 79, spotlight: 'scare',
  tee: [0, 0], pin: [6, -136], path: [[0, -6], [0, -60], [6, -136]],
  fairwayWidth: 20, bounds: [-42, -162, 46, 14],
  greenSize: [13, 11], greenTilt: [-0.01, 0.012],
  hills: [[-26, -70, 18, 2.5], [28, -120, 16, 3]],
  bunkers: [[-4, -124, 3.2, 1.2], [15, -142, 4, 2.5]], ponds: [],   // first bunker = "the open grave"
  trees: { density: 0.5, clumps: [[-24, -110, 9], [30, -60, 8]] },
  tombs: { area: [2, -80, 34, 60], n: 46, clear: 5 },
  geese: [{ area: [-12, -150, 5], radius: 9, stare: true }, { area: [18, -128, 5], radius: 9, stare: true }],
  wind: 1.5, hint: 'Shh. Old Tom is resting.' },
{ name: 'Moonshot', par: 4, seed: 97, spotlight: 'moon',
  tee: [0, 0], pin: [20, -330], path: [[0, -6], [-6, -190], [20, -330]],
  fairwayWidth: 30, bounds: [-70, -360, 80, 14],
  greenSize: [16, 13], greenTilt: [0.008, 0.01], greenBumps: 0.2,
  hills: [[20, -330, 34, 9], [-40, -110, 30, 4], [55, -230, 26, 4]],   // green on a 9 m mesa
  bunkers: [[4, -312, 4, 3], [38, -322, 3.5, 4], [-20, -200, 6, 4]],
  ponds: [[-2, -255, 40, 16]], trees: { density: 0.6 },
  airGravity: 0.5,
  geese: [{ area: [14, -300, 10], radius: 14, boss: true }, { area: [0, -300, 8], radius: 9 }, { area: [30, -300, 8], radius: 9 },
          { area: [-8, -180, 12], radius: 9 }, { area: [16, -150, 12], radius: 9 }],
  goslings: 3, wind: 4, hint: 'Moon gravity. Everything floats.' },
```

**Hooks**
- **Hole 5:** a giant mini-golf windmill that only turns while a ball flies. The tower blocks the centre line, the blades swat balls back toward the tee, and there is a clear lane on each side.
- **Hole 6:** a foggy graveyard with 46 tombstones, a silent commentator, staring geese and a missing ghost. Then the scare.
- **Hole 7:** moon gravity, a mesa green, a crater lake and the Goose Parliament.

**New fields**
- **`windmill`**
  - Static tower: a cyl collider `{x, z, r: tower, y0: h-1, y1: h+towerH, e: 0.4, tag: 'windmill'}`.
  - Moving blades, in `simulate`:
    - Hub `(at[0], h(at)+hubH)`. The blade plane is at `z = at[1] + face`.
    - `θ = world.strokeNo * step + (2π/period) * stepIdx * DT`.
    - Test only when `|z - planeZ| < 1` and the distance to the hub is under `len + 1`.
    - Each blade is 5 kinematic spheres, r 0.8, at `ρ = len*k/5`, with velocity `ω ρ (-sin a, cos a, 0)`.
    - Response: relative normal velocity, `v -= 1.7 * vn * n`. Set `air = true`. Emit `hit` with tag `'windmill'` once per shot.
  - Pass `world.strokeNo`:
    - player: `strokeNo`;
    - carry preview: `G.strokes + 1`;
    - Old Tom: `planStroke(..., strokes.length + 1)`, so it matches the ghost's stroke index.
  - Mesh: a white and red tower plus a rotor group.
    - In flight: `rotation.z = θ(strokeNo, shot.t / FPS)`.
    - During a rival's playback: use `ev.stroke`.
    - Idle: ease to `(G.strokes + 1) * step` over 1 s, with a creak.
  - Feedback: `sfx.thwack`, commentator class `windmill`, and the banner "SWATTED".
- **`tombs`**
  - Add `placeTombs(course, hole)` in trees.js (so Old Tom sees them too). Use `rng = mulberry32(seed*31337)` and rejection-sample inside the ellipse, at most 2000 tries.
  - Reject a sample if any of these holds:
    - `fairwayDist < clear`;
    - within 16 m of the tee;
    - inside the green ellipse ×1.6;
    - on water, sand or OOB.
  - Collider: `cyl r 0.38, y0 h-1, y1 h+1.2, e 0.5, tag 'tomb'`.
  - Mesh: `W.buildTombstone`. The text is cosmetic: graveyard names first, then "HERE LIES PAR".
  - Add a shared `extraColliders(course, hole)` that returns the tower and the tombs, and use it in both `loadHole` and `ensureTom`.
- **`airGravity`:** in the air phase, `ay = (-G + lift*sp) * ag - DRAG*sp*vy`, where `ag = (course.hole?.airGravity ?? 1) * (world.airGravity ?? 1)`. Rolling is unchanged.
- **`hint`:** shown by `holeHint()` for holes 5–7.
- **Hole 6 specials** (`spotlight === 'scare'`):
  - Before the scare:
    - Old Tom's ghost ball is hidden and not solid.
    - The race HUD shows "👻 Old Tom: ???".
    - Hysteria is capped at 33.
    - Ambience is set to 0.3.
  - The wheel spins backward (cosmetic).

**LIGHTING[4..6]**
```js
{ elev: 3,  az: 35,  top: 0x1e1c58, mid: 0x7d4f8a, horizon: 0xff7440, sun: 0xff8a4a, fog: 0xa86a78, sunI: 2.0, hemi: 1.2 },
{ elev: 12, az: -12, top: 0x060a1e, mid: 0x15203f, horizon: 0x34446a, sun: 0xb4ccff, fog: 0x18213a, sunI: 0.6, hemi: 0.75, night: true, fogNear: 35, fogFar: 240 },
{ elev: 30, az: 8,   top: 0x04061a, mid: 0x0f1a3e, horizon: 0x283866, sun: 0xe2eaff, fog: 0x121a30, sunI: 0.9, hemi: 0.85, night: true, fogNear: 160, fogFar: 1100 },
```
- `apply()` reads `fog.near` and `fog.far` from `fogNear ?? 120` and `fogFar ?? 900`. The sun disc doubles as the moon.
- When `night` is set:
  - the ball gets emissive `0x334455` and `ballGlow` always shows, at opacity 0.5 or more;
  - the flag beacon opacity is 0.4;
  - the hemisphere ground colour is `0x1a1a24`.

### 1b. Hole 6 jumpscare

- **Trigger:** `holeOut()` when `spotlight === 'scare' && !G.scareDone`. Set `G.scareDone = true`, and reset it in `startRound`.
  - It fires once per round and is guaranteed, because every hole 6 ends in a hole-out (gimmes included).
  - The stroke is already scored and nothing is in flight.
- **Hold the normal payoff:** set `G.mode = 'scare'` and defer the banner, confetti, `sfx.holed` and commentary. Add `body.scare` to hide the HUD.

| Time | What happens |
| --- | --- |
| 0.0 s | Soft plink. Ambience bus ramps to 0 over 0.3 s. The camera eases to look at the cup. |
| 0.9 s | **Scare.** Old Tom's model appears at `camera + dirToCup*1.3`, `y = eye - 0.3`, facing the camera. He rises from 1.2 m lower in 0.12 s, with his head at about 45% of frame height. |
| 0.9 s | Camera: `G.shake = 0.5`, decaying over 0.6 s. FOV +8, back to normal over 0.4 s. |
| 0.9 s | One cyan radial vignette (edges `rgba(127,246,255,.55)`): fades in over 0.15 s and out over 0.8 s. No white, no repeats. |
| 0.9 s | `sfx.scare()`, with three layers. **Sub:** sine 80→30 Hz, 0.6 s, peak 0.6. **Stab:** saws at 233, 247 and 349 Hz, ±25 cents, gliding up ×1.5 over 0.18 s, through a 2.5 kHz lowpass, peak 0.22, 1 s decay. **Shriek:** bandpass noise 1.8→5.2 kHz, Q 6, 0.7 s, peak 0.25. |
| 1.4 s | Caption "👻 Old Tom: Fore." plus a laugh: square blips at 220, 196 and 174 Hz, 0.12 s each. |
| 2.1–2.6 s | He dissolves into 80 cyan particles that stream into the cup. Ambience fades back over 1 s. |
| 2.6 s | The normal hole-out runs. Commentator class `scared` (for example "WHAT WAS THAT. Par, I think."), with hysteria set to 100. All geese flee. `G.celebrate = 2.7`. |

- **Skip:** click, Space or Esc at any time jumps straight to 2.6 s.
- **Gentle variant:** used when `prefers-reduced-motion` is set or "Scares off" is chosen in help (`ghg3d_noscare`). Tom rises slowly at the cup and waves, with no shake, FOV kick or shriek, and the sting at −10 dB.
- **Rooms:** send `emote scared`. Receivers get the toast "👻 Old Tom got {name}." If they are spectating that player, they see the gentle variant.

### 2. Power-up wheel

**UI**
- A HUD wheel in the bottom-left starts 0.3 s after hole load. On hole 1 it starts after the title is dismissed.
- It spins for 2.0 s: ease-out, 3 turns, then the target wedge.
- A result card shows for 3 s, then shrinks to a chip.
- It never blocks input. Swinging snaps it to the result. The effect is active from hole load.
- Sounds: slowing ticks. On landing: a rising arpeggio (good), a kazoo wobble (chaotic) or a falling trombone saw (cursed).

**Draw**
- Seed: `rng = mulberry32(room ? (room.seed ^ fnv1a(memberId)) >>> 0 : random)`, created at `startRound`.
- Hole 1: `['bucket', 'ghost', 'ring'][floor(rng()*3)]`.
- Holes 2–7: the first 6 of `shuffle(remaining 7, rng)`, using the existing `shuffle`.
- Why: the draw is per player, so rival curses don't all fire at once and you get "ha, you got cursed" moments. Over a round everyone sees 7 of the same 8, so it is near-fair. A reload can't re-roll it, and clients can compute rivals' wedges and show their emoji in the standings, with no message needed.
- **"Next shot"** means the next non-putter, non-shoo player stroke; the chip poofs when it is used. **"This hole"** effects clear on `loadHole`. Nothing carries over to the next hole.

| # | Wedge | Text (≤7 words) | Effect | Implementation |
| --- | --- | --- | --- | --- |
| 1 | 🪣 Bucket Cup (good) | "Cup is way bigger this hole." | this hole: cup radius 0.45 | `world.cupR`; `simulate` uses `cupR ?? CUP_R` in all cup tests; scale the cup mesh in x and z |
| 2 | 👻 Ghost Ball (good) | "Next shot ghosts through trees." | next shot | `world.noTrees`: skip colliders tagged `tree` or `tomb`; ball opacity 0.5 in flight |
| 3 | 🛟 Life Ring (good) | "One free splash or OOB." | this hole, once | in `endShot`: water → `G.ball = shorePoint()`, no angler, no stroke; OOB → no +1, replay from the last lie; banner "🛟 SAVED" |
| 4 | 🌙 Moon Boots (chaotic) | "Next shot floats on moon gravity." | next shot | `world.airGravity = 0.5` (it stacks on hole 7) |
| 5 | 🦘 Pogo Ball (chaotic) | "Next shot bounces like a superball." | next shot | `trait.bounce *= 2.2` (the sim's 0.8 cap still applies) |
| 6 | 🪿 Sic 'Em (chaotic) | "A goose mugs the leader." | this hole | see the targeting rules below |
| 7 | 🍌 Banana Ball (cursed) | "Next shot swerves hard left." ("right" on even holes) | next shot | `L.side += ∓0.9 * CLUBS[club].curve`; negative on odd holes |
| 8 | 🧲 Goose Magnet (cursed) | "Every goose wants your ball." | this hole | steal radius ×2; theft caps still apply |

**Sic 'Em targeting**
- When the wheel lands, the target is the best-placed rival on my hole who hasn't holed out and is online. Ties go to the lowest strokes this hole, then the lowest id.
- Send `emote sic`.
- If there's no valid target, or in solo, it becomes **🪿 Bodyguard**, "Geese ignore your ball this hole.": `G.gooseImmune` makes `maybeGooseSteal` return false.

**The receiver of a Sic 'Em**
- One pending Sic at a time; extras are dropped.
- It fires on the next rest that is not holed, not on the green or fringe, and not water or OOB.
- The nearest adult goose ignores its radius and goes alert, then fetches. If it is more than 45 m away, it first teleports 20 m from the ball with a flap.
- It obeys the theft caps and fizzles at hole end.
- Toast: "🪿 {name} sent a goose."

### 3. Room interactions

Format: `{type:'emote', kind, to?, arg}`. `arg` is a string of at most 64 bytes. Drop an emote if `ev.round !== G.room.round`, its hole doesn't match yours, or `to` isn't you. The client mirrors the server bucket (burst 5, refill 1.5 s) and greys out buttons when the bucket is empty. A 429 is dropped, not retried.

| Interaction | When | Message | Receiver effect | Anti-grief |
| --- | --- | --- | --- | --- |
| **Reactions** 📯👏😱😂 | Both. Keys 1–4 while spectating; buttons only during your own play, hidden during your backswing | `react`, `arg "h:honk\|clap\|gasp\|laugh"`, no `to` | An emoji pops over the sender's marker or standings row, with a synth sound at 40%. Two or more different senders within 3 s of your shot trigger the commentator class `gallery` ("The gallery has opinions.") | 1 per 2 s per sender. Receiver plays at most 1 sound per sender per 4 s and at most 3 per 5 s. Sound is muted (visual only) during swing, scope or fishing. A "Mute reactions" toggle |
| **Be the Goose** | Spectating only, targeting the player you watch | `possess`, `to`, `arg "h:x:z:honk"` (x and z to 0.1 m) | A puppet goose with a "🪿 {name}" tag and a collar in the room colour walks at 3 m/s to the waypoint. A honk plays the existing honk at 50% | Waypoints at most 1 per 2 s. Clamped by the receiver: valid land, never within 4 m of the green ellipse, at least 6 m from the receiver's ball. Never solid, never steals. At most 3 per receiver. Despawns after 20 s idle or at hole-out. Honks become a visual "HONK" during swing or scope, or while on the green |
| **Gimme** | Spectating, when the watched ball rests on the green 1.0 m or less from the cup | `gimme`, `to`, `arg "h:strokes"` | A chip "{name}: gimme? (G)" for 8 s. Accepting adds `G.strokes++`, then `holeOut` with a gimme flag (no bullet cam, banner "GIMME") | Valid only if the receiver's hole and strokes match and the ball hasn't moved. One offer per sender per stroke |
| **Sic 'Em** | Wheel result, during your own play | `sic`, `to`, `arg "h"` | As in section 2 | One per hole per receiver, theft caps, never on the green |
| (system) scare | Automatic | `scared`, `arg "6"` | As in 1b | none |

### 4. Geese

Hole data changes from `goose:` to `geese: [{area, radius, boss?, stare?}]`, plus `goslings: n`. Treat a legacy `goose` as `[goose]`. The engine changes from a single `goose` object to a `geese[]` array, each with its own mesh and label. `G.thief` is whichever goose is carrying, the goose cam follows `G.thief`, and every goose appears in `gooseCollider()`.

| Hole | Adults | Extra |
| --- | --- | --- |
| 1 | `[-2, -158, 14] r42` | 2 goslings |
| 2 | `[-22, -108, 6] r9`, `[14, -124, 5] r9` | none |
| 3 | `[-10, -150, 10] r9`, `[-50, -196, 5] r9` | none |
| 4 | `[4, -330, 12] r9`, `[-12, -150, 12] r9`, `[38, -370, 5] r9` | none |
| 5–7 | as in the data above | 3 goslings on hole 7 |

That is 18 adults and 5 goslings.

**Variants, all within the existing graze, alert, fetch, carry and flee states**
- **Boss** (hole 7):
  - 1.8× scale; collider r 0.8 at y + 0.75; steal radius 14; alert 0.4 s; fetch at 11 m/s.
  - Label "🪿 THE BOSS".
  - Song: `gooseSong({transpose: -5})`, same length as the normal song.
  - When hit, it honks, sheds feathers and deflects the ball, but **doesn't flee**.
  - While it carries, every goose and gosling within 40 m grazes toward V-formation offsets behind it, re-targeted every 0.5 s (the escort).
- **Gosling:**
  - 0.45× scale; sphere collider r 0.2.
  - Grazes toward its parent (the first adult) plus an offset.
  - Never steals. When hit, it squeaks and flees.
- **Stare** (hole 6):
  - While you are in address with the ball within 60 m of the cup, these geese are frozen facing the cup, in an alert pose with no "!".
  - They flee 3.2 s after the scare.

**Fairness**
- At most 2 thefts per hole per player.
- No theft on the stroke right after a theft.
- Goose Magnet doubles the radius only, not the caps.
- The drop is always on a playable lie, and no stroke is added.

### 5. Ball names

- **Keep the eyes.** Add wordless acting beats:
  - the pupils glance at water within 25 m at address;
  - the pupils track the goose while it's alert or fetching;
  - the eyes turn to X's when the line snaps.
- Keep eyes off the ghost and rival balls.
- **Tag (event-based):**
  - **New ball in play:** 4 s, "👀 Hi, I'm Margaret." over the trait line.
  - **Hole start:** the name only, for 2 s, gone before the wheel lands.
  - **Splash:** "MARGARET!", and the fishing title "Save Margaret!".
- **HUD:** "● Margaret · Bouncy ●●●●○", replacing "4 left".
- **Cut** the round-start toast.
- **Title:** "Five named balls. One life each." The current line is 9 words.
- **Successor intro:** "Hi, I'm Doris. Be gentle."

### Server follow-ups

- `minRoundStrokes` goes from 4 to 7.
- `scorePrefix` moves to a new prefix.
- A PB ghost is ignored unless `holes.length === 7`.
- Update the comments that say "4 holes, par 16".

## 10. Wheel re-ruling (owner feedback)

**Owner:** every wedge must be valid on every map ("a free water hit isn't
valid on all maps"). Later in the same review: named balls need a picker and
their own animations, and the geese should care more about the ball.

**The rule.** A wedge is valid only if its effect can change the outcome on
all 7 holes, whichever hole it lands on, in both solo and rooms.

### 10.1 Verdicts on the current wedges

| Wedge | Verdict | Why |
| --- | --- | --- |
| 🪣 Bucket Cup | Valid | Every hole ends at a cup |
| 👻 Ghost Ball | Valid but weak: **rework** | Trees are on every hole, but "next shot" is spent on the tee shot, where the fairway is clear. Ignores the windmill |
| 🛟 Life Ring | **Invalid** | No water on holes 1, 3, 5 and 6; OOB almost never happens |
| 🌙 Moon Boots | Valid; **text fix** | It stacks to ¼ gravity on hole 7, but "floats on moon gravity" reads as a dud there |
| 🦘 Pogo Ball | Valid | Every hole has ground |
| 🪿 Sic 'Em | **Invalid** | Hole 6 geese are `stare`, and `maybeGooseSteal` skips them, so the Sic is cleared and fizzles. Its solo form, Bodyguard, is chance-only and does nothing on hole 6 |
| 🍌 Banana Ball | Valid | Every non-putter club has `curve > 0` |
| 🧲 Goose Magnet | **Invalid** | Does nothing on hole 6 (stare geese never steal), and is chance-only elsewhere |

**Pitches judged**
- **Bread Crumbs** ("you win the next tug"): invalid on its own. A theft is
  chance, and impossible on hole 6. The tug-of-war idea lives on in Goose
  Bait instead.
- **Commentator wedges:** invalid. The booth is silent on hole 6.
- **Old Tom wedges:** invalid. Tom isn't in rooms.
- **Blindfold** (no aim line): valid everywhere. It's the cursed runner-up.

### 10.2 The final 8

Every new wedge also breaks the hole 6 stare: in `maybeGooseSteal`, change
the skip to `(g.stare && !G.scareDone && !forced)`, where
`forced = sic || bait || taxi`.

| # | Wedge | Text | Kind | Duration | Implementation |
| --- | --- | --- | --- | --- | --- |
| 1 | 🪣 Bucket Cup | Cup is way bigger this hole. | good | this hole | Unchanged |
| 2 | 👻 Ghost Ball | Ghost through all scenery this hole. | good | this hole | Move `noTrees` from `shot` to `hole`. `shotMods`: `m.noTrees = p.noTrees`. physics.js L161: also skip `tag === 'windmill'`; wrap the blade test (`if (wmD && …)`) in `!noTrees`. The 0.5-opacity flight already keys off `G.ghostShot` |
| 3 | 🛟 Life Ring | One free escape: sand, water, OOB. | good | this hole, once | Add `ringRelief(x, z)`: spiral 16 angles × 1–20 m, nearest `validLand` that isn't sand and isn't nearer the cup. In `endShot`, after `G.ball = end`: `if (end.surface === 'sand' && lifeRing)`, relieve, banner "🛟 SAVED". Same check in `landGooseFlight`, which saves you from a goose airlift. Water and OOB code unchanged |
| 4 | 🌙 Moon Boots | Next shot floats on moon gravity. | chaotic | next shot | Unchanged. In `powerDesc`, when `G.holeDef.airGravity` is set: "Next shot: moon gravity, squared." |
| 5 | 🦘 Pogo Ball | Next shot bounces like a superball. | chaotic | next shot | Unchanged |
| 6 | 🪿 Sic 'Em | A goose mugs the leader. | chaotic | this hole | Unchanged in rooms, plus the stare fix. **When there's no target, it becomes 🪿 Goose Taxi** (below) |
| 7 | 🍌 Banana Ball | Next shot swerves hard left. | cursed | next shot | Unchanged |
| 8 | 🍞 Goose Bait | A goose is coming for your ball. | cursed | this hole | `landPowerUp`: `G.baitPending = true`. `maybeGooseSteal` treats it like a Sic: ignore the radius, teleport the goose in if it's over 45 m away, toast "🍞 Your pockets smell of bread." Clear it in `loadHole`. All the caps still apply. It waits off the green, so a par-3 green in regulation dodges it, and that's earned |

**Goose Taxi** (Sic 'Em in solo, or with no valid target): "A goose
relocates your next lie."
- `landPowerUp` sets `G.taxiPending`. `maybeGooseSteal` handles it like a
  Sic and marks `g.taxi`.
- In `grabBall`, after the goose cam is set up:
  `if (g.taxi) { g.taxi = false; g.state = 'fly'; g.target = taxiSpot(); label '🪿 GOOSE TAXI'; }`
- `taxiSpot`: a random angle, 20–30 m from `G.gooseLie`, `validLand`, not
  green. Up to 24 tries, falling back to the lie.
- `landGooseFlight` places the ball and calls `roomSendProgress`.
- About 30 lines. It's per-client, so it's room-safe.

Remove Bodyguard (`immune`).

**The hole 1 subset stays `['bucket', 'ghost', 'ring']`.** All three are
now valid, and hole 1 has 3 bunkers and 0.9 tree density.

### 10.3 Ball picker

**Bag:** 4 signature balls, chosen from 6.

| Trait | Name | Blurb |
| --- | --- | --- |
| bouncy | Bounce Springsteen | Bounces 70% higher. Born to run. |
| heavy | Sir Thud | Ignores wind. Squashes grass. Rolls on. |
| slippery | Butterfingers | Rolls and rolls and rolls. |
| lucky | Clover | Cups love her. A bit lazy. |
| feather | Lord Floofington | Flies far. Rides every gust. |
| nervous | Nervous Nigel | Fast, curvy, deeply anxious. |

**Title card**
- A row of 6 ball chips sits under the name input. Exactly 4 are lit, and
  tapping a 5th unlights the oldest.
- The selection is stored in `ghg3d_bag`. First-run default: Clover, Sir
  Thud, Bounce Springsteen and Lord Floofington.
- Copy: "Four named balls. One life each."
- There's no extra screen: Tee off still starts immediately.

**At the tee**
- A `#balls` row sits above `#clubs`, shown only while `G.strokes === 0` in
  address. It holds the living balls, with the current one preselected.
  Swinging hides it.

**Mid-hole**
- **No switching** (the one-ball rule).
- A death auto-advances to the next living ball, then the range ball.

**Rooms**
- Everyone picks their own bag; `newBag` is no longer seeded. Wind stays
  seeded.
- Everyone chooses from the same 6, so the race is still fair.

### 10.4 Signature animations

**How it's built**
- `ballAnim(dt)` runs in `updateBallFace`, keyed on `bag().trait.id`.
- It's cosmetic only: an offset on the mesh's position, scale and rotation
  after the sim pose is applied. `G.ball` is never touched.
- Landings hook `fireEvent` `bounce`/`land`. Deaths and saves hook
  `startAngler`/`endAngler` and `gooseSwallow`.
- Reduced motion scales everything ×0.3.
- Only your own ball animates.

| Ball | Address | Flight / landing | Death / save |
| --- | --- | --- | --- |
| Bouncy | Hops 6 cm every 1.6 s; squashes to y 0.8 on contact | Each bounce: squash (1.25, 0.75, 1.25), easing out over 0.15 s; burst of 6 particles, 0xffc84a | Dies: one last 0.5 m boing, then sinks. Saved: a triple hop |
| Heavy | Sits 8 mm low; breathes y ±3% over 3 s | First land: `G.shake ≥ 0.06` if within 30 m; dirt burst of 14, 0x6b4a2b, up 1.5 | Dies: drops like a stone, bubble burst of 20, 0xbfe8ff. Saved: two dust puffs |
| Slippery | Wobbles rot.z ±0.12 at 2.5 Hz; slides ±1.5 cm | While rolling: a drip every 0.2 s, 0xd8fbff | Dies: spins in (rot.y 8 rad/s). Saved: squirts out of the hands, one hop |
| Lucky | 3 sparkles every 0.8 s, 0xffe066 | Sparkle trail every 0.1 s. Landing within 3 m of the cup: burst of 24, 0x4fd39a | Dies: green burst of 30, rising. Saved: gold burst of 40 |
| Feather | Bobs 1 cm at 1.8 Hz; leans downwind | Sheds a feather every 0.35 s (white, grav 0.6, life 2.5). Lands in a soft puff of 8 | Dies: floats 1.5 s before it sinks. Saved: feather burst of 20 |
| Nervous | Trembles ±4 mm; pupils dart to a new spot every 0.4–0.9 s; doubles near geese or water | Maximum pupil rattle; a sweat drop of 3 on landing, 0x9fdcff | Dies: X eyes. Saved: faints, rot.z 90° over 0.3 s, then recovers |

### 10.5 Geese, more interested in the ball

**In flight:** graze geese already turn to face the ball (`frozen`). Add a
neck tilt of `neckPivot.rotation.x -= 0.3` while the ball is more than 5 m
above the ground.

**Landing honk**
- On the first `land` event, the nearest adult graze goose within
  `min(1.5 × radius, 20 m)` honks once with `sfx.honk(1)`.
- It also holds the alert pose for 0.6 s, with no "!".

**Curious waddle**
- In `afterStroke`, when there's no theft: adult, non-stare graze geese
  within `min(2.5 × radius, 30 m)` get a target 60% of the way toward the
  ball, at 1.4 m/s.
- They stop at `1.1 × radius` from the ball. Curiosity never puts a goose
  inside its own steal radius, so hole 1 (r 26) is unchanged.

**At address**
- Geese within 30 m glance at the ball for 1.5 s every 3–6 s.

**Steal radius**
- 9 → 11 on holes 2–5 and 7.
- Holes 1 and 6 are unchanged.
- The caps are untouched: 2 thefts per hole, none right after a theft,
  never on the green.

## 11. Geese, round 2 (owner playtest)

**Owner:** the tug loss is "always the sand trap"; add a tree-dwelling monster
goose; the boss needs a power that touches nearly every ball; geese should
be more curious; breeds are optional.

**Council verdicts on the pitched ideas.** Egg swap: **yes**, merged with
"sits on it like an egg" into one outcome (Fun, Weird). Relay: **yes** (Fun).
Water toss: **yes**, but the fishing is free and can't kill the ball (UX: a
goose must never cost a stroke). Tree stash: **yes**, as the second door into
the Sasquack (Weird). Golf Purist accepted all of it on one condition: the
Sasquack punch-out costs about 10 m, like a real chip-out sideways.

### 11.1 Tug-loss table (`endTug(false)` → new `pickLoss(g)`)

| Key | Weight | Eligible when | Else | What happens (after the tug) | Banner (≤7 words) |
| --- | --- | --- | --- | --- | --- |
| `punt` | 22 | always | — | Unchanged `goosePunt` | 🪿 PUNTED! |
| `relay` | 18 | another adult (not boss/stare, `graze`) within 60 m of the thief | `punt` | See below | 🏉 TRY!<small>a goose relay</small> |
| `brood` | 15 | always | — | Egg swap, below | 🥚 BROODED<small>your ball is an egg now</small> |
| `pond` | 12 | a pond ellipse centre within 70 m + its `rx` | `relay` | Hammer throw + free fishing | 🎣 HAMMER THROW<small>free fish, no penalty</small> |
| `stash` | 13 | a `tree` trunk within 50 m, Sasquack caps free, not hole 6 | `brood` | Flies it into a tree → Sasquack (11.2) | 🌲 STASHED<small>something lives up there</small> |
| `bunker` | 10 | existing bunker rule finds one | `punt` | Unchanged `gooseBunker` | unchanged |
| `swallow` | 10 | always | — | Unchanged `gooseSwallow` | unchanged |

- Weighted pick with `Math.random()`. If the pick equals `G.lastLoss`, re-roll once. Store `G.lastLoss` (reset in `startRound`). Canada geese are preferred relay receivers (pick the nearest Canada first, else the nearest adult).
- **Shared drop rule** `lossSpot(p)`: accept `p` only if `validLand`, surface not green/fringe, and `dist(p, cup) ≥ dist(G.gooseLie, cup) − 0.01`; otherwise use `G.gooseLie`. Every new outcome ends in `placeBall(spot)`.
- **Bug fix (existing):** a punt into water calls `startAngler`, whose `endAngler` adds a penalty stroke. Goose-caused splashes set `angler.free = true`: no `G.strokes++`, timer 5 s instead of 7, and a loss never kills the ball.

**Relay** (~60 lines, new goose state `pass`):
- 0.0 s: thief faces the receiver; neck flick (`neckPivot.rotation.x` −0.6 over 0.25 s).
- 0.25 s: a scripted ball arc (not the sim): lerp beak → receiver beak, `y += 4·k(1−k)·max(2, d/6)`, duration `clamp(d/14, 0.5, 1.4)`. Camera holds position; look lerps to the airborne ball (rate 8).
- Catch: receiver `honk(1)`, becomes `goose` (camera follows it), runs at 7 m/s, wings flapping, to `receiver + 14 m` along the away-from-cup direction ±0.6 rad (validLand, up to 12 tries). 35% chance of a second pass if a third adult is within 40 m.
- Arrival or 2.0 s: it spikes the ball, 30 white feathers, `sfx.honk(2)`, `placeBall(lossSpot(here))`.

**Brood / egg swap** (~70 lines):
- 0.0 s: the goose sits: mesh y −0.25 over 0.4 s, wiggles (`body.rotation.z` ±0.1 at 6 Hz) for 1.4 s, `honk(1)`, 6 heart particles 0xff7fa0.
- 1.8 s: it stands and grazes off 8 m. Left behind at `lossSpot(goose)`: an egg mesh (`W.buildBall(0xfff6e6)` scaled (1.25, 1.55, 1.25), **eyes kept**). Set `G.eggBall = true`; `ballMesh` swaps its look to the egg. Physics are unchanged.
- The next player stroke: at its first `bounce`/`land` (`e.n === 0`), or at rest for a putt, the egg cracks: 16 shell bits 0xfff6e6 and 10 fluff 0xffe066, a two-tick noise crack (bandpass 3 kHz, 60 ms) and `sfx.squeak`. The ball reappears. A cosmetic gosling (reuse the gosling mesh, 0.45×) spawns there, follows `G.playerAt` 1.2 m behind at ≤3 m/s, squeaks on hole-out, and is removed in `loadHole`. Toast "🐣 It thinks you're its parent."

**Pond** (~45 lines): the goose spins 2 turns in 0.7 s (hammer throw); the ball arcs (apex +6 m, 1.0 s) to `pondCentre + (goose − pondCentre)·0.5·min(rx, rz)/|…|` (or the centre if that point isn't water). Splash, then `startAngler(splash, G.gooseLie)` with `angler.free`. Title "🎣 Save {ball}! Free." Win → `placeBall(G.gooseLie)`. Lose → `shorePoint(splash, splash + (splash − cup)̂·40)` through `lossSpot`, banner "🎣 SPAT OUT<small>an unimpressed fish</small>".

**Stash** (~25 lines): `g.state = 'fly'`, `g.stash = tree`, target = trunk. In `landGooseFlight`, when `g.stash`: put the held ball in the canopy (visible), send the goose home (`flee`), and call `startSasquack(tree, { fromTheft: true })`.

### 11.2 The Sasquack (tree monster)

**Trigger** (`maybeSasquack()`, called in `afterStroke(false)` *before* `maybeGooseSteal`):
- A player shot, result `rest`, surface not green/fringe, `spotlight !== 'scare'`, Ghost Ball not active.
- Either the nearest `tree` cyl is ≤ 3.0 m (horizontal) from the rest point, **or** the shot had a `hit`/`leaves` event tagged `tree` and the ball rests in the rough ≤ 9 m from the trunk nearest that event.
- Caps: once per hole (`G.sasqHole`, reset in `loadHole`), 3 per round (`G.sasqRound`, reset in `startRound`). A stash counts toward both. It is not a theft, and doesn't touch the theft caps.

**Punch-out plan, at t = 0** (deterministic, ~40 sims): from the lie, aim at the nearest `path` point. Offsets [0, ±0.3, ±0.6] rad × clubs [wedge, iron] × power [0.4, 0.55, 0.7, 0.85], with `world = {…, noTrees: true}` ("the trees let it through"). Accept a `rest` on fairway or rough with `lieD ≤ endD ≤ lieD + 25`. Score `(fairway ? 0 : 12) + |endD − (lieD + 10)|`; take the lowest. If none is accepted, it pats the ball, leaves it, and the banner reads "🦶 IT LEFT IT."

| t (s) | Beat | Camera / sound |
| --- | --- | --- |
| 0.0 | `G.mode = 'sasquack'`, letterbox, label "🦶 SASQUACK CAM". Leaf bursts (30, 0x4e8a30) at the canopy at 0, 0.3, 0.6 | Ease (rate 3) to trunk + 10 m toward the ball, y + 2.2, looking at the canopy (flip ±40° if `gooseViewBlocked`). Ambience to 0.4. `sfx.leaves` ×3 plus a 55 Hz sine growl, 1.2 s, gain 0.25, 7 Hz tremolo |
| 0.9 | Two yellow emissive eyes in the canopy; they blink at 1.2 | two soft ticks |
| 1.5 | It drops (0.35 s fall) to trunk + 1.5 m toward the ball. Dust 40, 0xcbb89a. Banner "🦶 THE SASQUACK<small>it lives in the trees</small>" | `G.shake = 0.45`, FOV +6 (back over 0.5 s). New `sfx.roar()`: saw 140→90 Hz through a 600 Hz bandpass plus noise, 1.1 s, gain 0.35. Commentator `sasquack`, bump +25 |
| 2.2 | `roar` clip, chest beat; `grab` picks up the ball between two fingers, sniffs | look at chest height (y + 1.8) |
| 3.0 | Pulls a **whole pine tree from behind its back** (trunk r 0.18 × 3 m + cone r 1.2 × 2.4 m, 0x2f5a2a) | wood creak (`sfx.tugPull`) and a pop |
| 3.2–4.3 | Tees the ball on a mushroom, two waggles (±0.3 rad), glances at the camera | — |
| 4.4 | Swing: 2.2 rad in 0.18 s. At 4.5 the planned shot launches as `G.shot.kind = 'sasquack'` (handled like `punt` in `endShot`: no stroke) | normal flight cam; `thwack`; caption "🦶 FOOOORE!" (a honk 12 semitones down) |
| flight | It rams the pine into the ground **roots-up** 2 m from the trunk (cosmetic, no collider, lives in `G.holeGroup`), waves, and climbs back up (0.6 s fade, leaf burst) | — |
| rest | `linger(1.4, () => afterStroke(true))` | — |

- **Skip:** click or Space after 1.5 s jumps to 4.4.
- **Counterplay: none, by design.** It's pure spectacle. The tug is the skill game; the way to avoid the Sasquack is to stay out of the trees.
- **Reduced motion:** no shake or FOV kick, and the roar at −10 dB.
- **Rooms:** per-client. Send `emote sasquack`, arg the hole number; receivers toast "🦶 {name} met the Sasquack." Rivals see only the ball's new rest, via `roomSendProgress`.
- **Model hooks assumed:** `W.buildSasquack()` → group with clips `drop/roar/grab/swing/run` and a hand anchor.
- ~120 lines: `maybeSasquack`, `startSasquack`, `updateSasquack` (main-loop branch beside `scare`), `skipSasquack`, and the `endShot` kind check.

**Commentator `sasquack`** (PRIO 4):
```js
sasquack: [
  ['Something in the trees has taken an interest in {ball}.', 'That is not a goose. That is a GOOSE. It has arms, {name}.', 'IT HAS ARMS! WHY DOES THE GOOSE HAVE ARMS! WHO HAS BEEN FEEDING IT!'],
  ['And the Sasquack will play this one for {name}. With a tree.', 'It pulled a pine tree out of nowhere. It is taking a practice swing.', 'IT IS GOLFING WITH A TREE! ITS TEMPO IS BETTER THAN {name}! I AM GOING HOME!'],
],
```
One entry each for the new tug outcomes:
- `tugRelay`: 'A lateral pass. The geese are organised.' / 'They are PASSING it! It is a team sport now!' / 'IT IS RUGBY! THE GEESE PLAY RUGBY! TRY! TRY!'
- `tugBrood`: 'The goose is... sitting on {ball}.' / 'It is BROODING on {ball}. That is not an egg!' / 'IT LAID AN EGG! {ball} IS AN EGG NOW! SCIENCE IS OVER!'
- `tugPond`: 'A hammer throw. Into the water.' / 'Olympic form from the goose! Into the drink!' / 'IT THREW {ball} IN THE LAKE! GET THE ROD! IT IS FREE! GET IT!'
- `tugStash`: 'The goose has hidden {ball} up a tree.' / 'Up the tree! Why the tree? What is in the tree?' / 'DO NOT GO IN THE TREES! NOBODY GOES IN THE TREES!'

### 11.3 The Boss: the Honk Hole (hole 7)

The boss has its own gravity: a whirlpool of feathers centred on its throne.
Add this to the hole 7 data, so `simulate`, the carry preview and Old Tom all
see it, the same way they see `windmill`:
```js
bossAura: { at: [14, -300], r: 22, core: 3, pull: 3.5, swirl: 5.0, top: 18, fade: 12, ground: 0.3 },
```
In `simulate`, `ba = !world.noAura && course.hole?.bossAura`, `baY = h(at)`. Every step, while `r = hypot(at − (x, z)) < ba.r`:
```
u   = (at − (x,z)) / r                       // inward
hk  = clamp((ba.top + ba.fade − (y − baY)) / ba.fade, 0, 1)   // full to 18 m up, gone at 30 m
c   = clamp((r − 0.5) / (ba.core − 0.5), 0, 1); ck = c*c*(3 − 2c)
f   = (1 − r/ba.r) · ck · hk
a   = f · ( ba.pull·u + ba.swirl·(−u.z, u.x) )   // horizontal only, m/s²
air:    ax += a.x; az += a.z
ground: only if surface ∉ {green, fringe} and sp > 0.35:
        a ← â · min(|a|·ba.ground, 0.8 · SURF[s].roll)   // added before the tangent projection
```
- The tangent `(−u.z, u.x)` makes the ball's left side (x < 14 when heading −z) a headwind and the right side a tailwind.
- Worked example: a 25 m/s ball passing 8 m left loses about 2.3 m/s and is pulled about 1.6 m/s inward, so it ends roughly 5 m off. Balls that land inside the ring roll toward the throne.
- The ground cap guarantees every ball still stops. Putts on the green are never touched (the green's front edge is 17 m away).
- Emit `ev('aura')` once per shot, the first time `f > 0.15`. `fireEvent`: whoosh, 20 particles 0xb07cff, live trail tinted 0xb07cff for that shot. On the first one per hole, banner "🌀 THE HONK HOLE".
- **Player gating:** pass `noAura: true` if the boss is more than 3 m from `at` at impact. The boss's `home.r` drops from 10 to 2 (it sits on its throne), and after any boss outcome it walks home at 11 m/s.
- **Visuals:**
  - a terrain-draped ring (r 21.5–22, 0xb07cff, opacity 0.35);
  - a draped disc with a 4-arm spiral canvas texture (opacity 0.12, `depthWrite:false`), `rotation.y += 0.5·dt`;
  - 24 feather sprites spiralling inward at 0.5 m/s, with tangential speed `5/√r`;
  - a small moon (r 0.35, 0xd8dce8, emissive) orbiting the boss's head at 1.6 m, once every 3 s.
- **Counterplay** (one toast on the first hole 7 address within 160 m: "🌀 Right of the Boss slings. Left stalls."):
  - fly over it, above 30 m;
  - use the right-hand slingshot;
  - lay up 22 m or more short, then wedge over the top.
  - The carry ring already shows the bend. Ghost Ball doesn't cancel it.
- Boss steal radius 14 → **16**; the caps are unchanged.
- **Tom gate:** run `planHole` for hole 7 headless. Accept Tom ≤ 5 (today he shoots 4). If he shoots more, scale `pull` and `swirl` by ×0.8 and retest.
- ~45 lines in physics.js, ~50 in main.js/world.js.

### 11.4 Curiosity

| Knob | Old | New |
| --- | --- | --- |
| Steal radius, holes 2–5 and 7 | 11 | **14** (hole 1 stays 26, hole 6 stays 9, boss 16) |
| Landing-honk range | min(1.5r, 20) | min(2r, 30) |
| Curious range (afterStroke) | min(2.5r, 30), stop at 1.1r | min(3r, 42) |
| The **nearest** eligible goose | stops short | an **approacher**: targets the ball −0.6 m, walks at 1.6 m/s (breed-adjusted) |
| The others in range | — | the old 60%-toward glance |

- **Address snatch:** in `updateGoose` graze, when `g.approach` and `dist(g, ball) < 1.0`, `G.mode === 'address'` and `!swing.active`, call the new `startTheft(g)`, factored out of `maybeGooseSteal`, with alert 0.3 s.
- **Snatch caps:** all the theft caps, plus not when `G.strokes === G.lastTheftStroke` (a goose-placed lie), not on the tee (`G.strokes === 0`), not green/fringe, not hole 6 pre-scare, and at most 1 snatch per hole.
- **Warning** at 6 m: "?" over the goose, `honk(1)`, hint "🪿 Hurry. A goose is curious." Mid-backswing it waits, pecking, at 1.2 m.
- ~40 lines.

### 11.5 Breeds (`breed` per goose def; `W.buildGoose(breed)` recolours, ~30 lines)

| Breed | Look | Where | Behaviour |
| --- | --- | --- | --- |
| Embden | current white | holes 1, 5 (all), the hole 7 boss | baseline |
| Toulouse | body 0x8f8b84, wings 0x6e6a64, belly 0xe8e4dc, dewlap sphere | holes 3, 6; hole 4 `[-12,-150]` | approach 1.2 m/s; tug strength +10 |
| Canada | body 0x8a7560, wings 0x5e4c3c, neck/head/tail 0x1a1a1a, white chinstrap (flattened sphere on the cheek), black beak | hole 2; hole 4 `[4,-330]` and `[38,-370]`; the 4 hole 7 escorts (the V) | approach 2.0 m/s; tug yanks every 0.6–1.2 s, strength −8; preferred relay receiver |

Goslings stay yellow.

## 12. Multiplayer: players affecting players

**Owner:** "a couple more multiplayer features that would increase fun… what
would be the most fun if a group of friends played, so they can interact with
each other. No more chat stuff or reactions, more how one player can impact
the other."

**Ground rules the council was given.** Each client simulates its own shots
and relays frames; there is no server game logic. Anything that touches
another player's ball must happen *inside their sim*: a collider or world
param they hold before they swing, or a deterministic re-sim every client can
run from the same few numbers. Everything rides `emote` (`kind`, `to`, `arg`
≤ 64 bytes; burst 5, +1 per 1.5 s; relayed to everyone but the sender, even
when targeted). Latency is 100–250 ms.

### 12.1 Pitches (30; every one changes someone else's game)

| # | Persona | Pitch (hook) | Over the wire |
| --- | --- | --- | --- |
| R1 | Roguelike | **Hex Deck**: last place throws a hex at the leader | `hex`, to, `h:id`; receiver queues a one-shot `shotMods` and shows it on the power chip |
| R2 | Roguelike | **Swap Meet**: trade ball traits for one shot | `swap`, to, `h:trait`; both set a one-shot trait override |
| R3 | Roguelike | **Regift**: hand your wheel wedge to a friend | `gift`, to, `h:wedge`; receiver `applyPowerUp` |
| R4 | Roguelike | **Bounty**: their bogey refunds you a stroke | score-only; needs server-side validation changes |
| R5 | Roguelike | **Caddie's Revenge**: you pick their next club | `club`, to; receiver locks `G.club` for one stroke |
| R6 | Roguelike | **Roquet**: hit their ball, earn a bonus stroke | `knock` + free stroke (merged into P1) |
| H1 | Horror | **Poltergeist**: drop a tombstone on a straggler's fairway | `tomb`, `h:x:z`; receiver adds a `cyl` to `G.colliders` |
| H2 | Horror | **Lights Out**: black out their next flight cam | camera only |
| H3 | Horror | **Cold Hands**: their swing trembles | `chill`; noise on swing input |
| H4 | Horror | **The Hand in the Cup**: one lip-out, guaranteed-ish | `hand`; receiver `cupR ×0.7` for one putt |
| H5 | Horror | **Haunt, revisited**: spectators stand on the course, solid | `stand`, `h:x:z`; collider (merged into P5) |
| H6 | Horror | **Fog Bank**: fog over their hole for a shot | `fog`; env fog distance |
| M1 | Rhythm | **Wind Sock**: twist their wind 30° before they swing | `wind`, to, `h:deg`; locked at backswing |
| M2 | Rhythm | **Shot Clock**: a ticking deadline on a dawdler | `clock`, to (merged into P2's approach timer) |
| M3 | Rhythm | **Duet Putt**: two players stroke one putt | needs real-time input; impossible on the bucket |
| M4 | Rhythm | **Drumroll**: spectators hold a roll over the putt | cosmetic (a reaction; out of scope) |
| M5 | Rhythm | **Echo Swing**: your tempo becomes their needle target | `echo`, to, `h:tempo` |
| M6 | Rhythm | **Conductor**: set a straggler's green speed | `stimp`, to, `h:k`; world `greenRoll` multiplier |
| P1 | Party | **Billiards / Knock-On**: your ball actually moves theirs | `knock`, to, contact velocity; every client re-sims |
| P2 | Party | **Be the Goose, with Teeth**: the puppet can steal | `teeth`, to; receiver turns the puppet into a thief |
| P3 | Party | **Bumper Drop**: a pinball bumper on their hole | `bump`, `h:x:z`; sphere collider, `e 1.4` |
| P4 | Party | **Hot Potato Egg**: whoever holds the egg at hole-out takes +1 | `egg`, to; stroke penalty |
| P5 | Party | **The Gallery**: stand on the course with a brolly; balls bounce off you | `stand`, `h:x:z`; cyl + sphere colliders |
| P6 | Party | **Pass the Goose**: lose a tug, it flies on to a rival | `passgoose`, to; a forced theft like Sic 'Em |
| S1 | Surrealist | **Pin Hex**: move a straggler's pin across the green | `pin`, to; moves `G.cup` |
| S2 | Surrealist | **Mirror Hole**: flip their aim for one shot | `mirror`, to |
| S3 | Surrealist | **Beach Ball**: their ball is 3× size for a shot | changes `R`, which is a physics constant |
| S4 | Surrealist | **Moon a Friend**: gift them moon gravity | `moon`, to; `shotMods.airGravity` |
| S5 | Surrealist | **Photobomb**: your golfer appears in their bullet cam | cosmetic |
| S6 | Surrealist | **Lie Swap**: play each other's lie for one stroke | `swaplie`; races on both sides |

### 12.2 Scores (1–5), picks and vetoes

Same rule as before: a veto removes an idea unless at least three judges
picked it.

| Idea | Fun | Tech | UX | Weird | Golf | Sum | Picked by | Vetoed by |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **P1 Knock-On** (+R6) | 5 | 4 | 4 | 3 | 5 | **21** | Fun, Tech, UX, Golf | — |
| **P2 Teeth** (+M2) | 5 | 4 | 3 | 5 | 2 | **19** | Fun, Tech, Weird | Golf |
| **P5 Gallery** (+H5) | 3 | 4 | 5 | 2 | 5 | **19** | Tech, UX, Golf | Weird |
| P3 Bumper Drop | 4 | 4 | 3 | 4 | 2 | 17 | Fun, Weird | — |
| M6 Conductor | 2 | 4 | 4 | 2 | 4 | 16 | UX, Golf | — |
| R3 Regift | 3 | 5 | 4 | 1 | 3 | 16 | Tech, UX | — |
| S4 Moon a Friend | 3 | 5 | 4 | 3 | 1 | 16 | Tech, UX | — |
| H4 Hand in the Cup | 3 | 4 | 2 | 4 | 3 | 16 | Weird, Golf | — |
| R1 Hex Deck | 4 | 4 | 2 | 4 | 1 | 15 | Fun, Weird | Golf |
| R5 Caddie's Revenge | 2 | 5 | 3 | 1 | 4 | 15 | Golf | — |
| P6 Pass the Goose | 4 | 3 | 2 | 4 | 1 | 14 | Fun | — |
| M1 Wind Sock | 3 | 4 | 3 | 2 | 1 | 13 | — | Weird |
| H1 Poltergeist | 3 | 4 | 2 | 3 | 1 | 13 | — | — |
| R2 Swap Meet | 3 | 3 | 3 | 2 | 2 | 13 | — | — |
| S6 Lie Swap | 4 | 1 | 2 | 5 | 1 | 13 | Weird | Tech |
| S2 Mirror Hole | 2 | 5 | 2 | 3 | 1 | 13 | — | Golf |
| S1 Pin Hex | 3 | 2 | 3 | 3 | 2 | 13 | — | Tech |
| P4 Hot Potato Egg | 4 | 3 | 1 | 4 | 1 | 13 | — | UX |
| H6 Fog Bank | 2 | 4 | 2 | 3 | 1 | 12 | — | — |
| M5 Echo Swing | 2 | 4 | 2 | 3 | 1 | 12 | — | — |
| H2 Lights Out | 3 | 5 | 1 | 2 | 1 | 12 | — | UX |
| H3 Cold Hands | 2 | 4 | 1 | 2 | 1 | 10 | — | UX |
| S3 Beach Ball | 4 | 1 | 2 | 5 | 1 | 13 | — | Tech |
| R4 Bounty | 2 | 2 | 3 | 1 | 2 | 10 | — | Fun, Weird |
| S5 Photobomb | 2 | 5 | 4 | 3 | 1 | 15 | — | Fun |
| M3 Duet Putt | 4 | 1 | 2 | 4 | 2 | 13 | — | Fun |

### 12.3 The argument

**Downtime first (Fun Expert, chair).** "The people on the between-hole cam
are the most bored people in this game, and right now all they can do is
puppet a harmless goose. At least one winner must give the spectator a *real*
lever on the player they're watching. And at least one must live inside play
itself, so two friends on the same green feel each other."

**Who is actually spectating (Player Advocate).** "Look at who finishes a
hole first: whoever took the fewest strokes on it. So the spectators are
usually the people doing well, and the person still out there is the one
having a bad time. Every spectator weapon punches down. Poltergeist, Bumper
Drop, Hex on a straggler, Pin Hex: I'm not vetoing all of them, but I won't
vote for any that doesn't answer that." This one observation shaped
everything below.

**Hex Deck vs Teeth (the catch-up fight).** Fun and Weird loved the Hex Deck
as Mario Kart's blue shell. Golf Purist vetoed it: "Random curses on the
leader are a lottery that punishes playing well. The wheel already does
chaos." Fun fought back: "Then where's the catch-up?" The deal: Fun dropped
Hex, and Teeth inherits its catch-up rule. **Teeth only point up.** You can
send a real goose only at someone level with you or ahead of you. Golf still
vetoed Teeth ("a goose sent by a man is not rub of the green"), but with
three picks it survives. Golf's price, accepted: Teeth never costs a stroke,
and the player can always beat it by just hitting the ball.

**Knock-On (near consensus).** Golf Purist brought the history: "Until 1952
the stymie was legal. If your ball knocked your opponent's ball into the
hole, it counted as holed at their previous stroke. That's not a gimmick,
it's our sport's own lost rule." Tech: "And it's the only idea where one
player moves another player's ball in *physics*, deterministically. The
shooter's sim already treats rival balls as solid spheres. Make them movable,
emit the contact velocity, and every client re-sims the knocked ball from the
same inputs." Player Advocate set three conditions:
1. a knock on the green can't drive a ball more than 3 m farther from the cup;
2. water or OOB means the ball goes back, free;
3. a trailing player may put a knocked ball back.

Weird scored it 3 ("it's correct, not strange") but stopped objecting at
**CANNON** (two balls in one shot).

**Gallery vs Bumper Drop.** Tech: "These are the same code: a solid at x:z."
Advocate: "A bumper is dropped and forgotten. A friend standing there has a
face, the bonk has a victim, and behind-the-ropes placement means most hits
are rescues." Weirdness Curator vetoed the Gallery ("a person standing in the
rough is the least weird idea in this document"). It had three picks (Tech,
UX, Golf), so it stood, and Weird extracted the brolly: every spectator holds
a giant golf umbrella that flips inside out when hit. Fun conceded the
Bumper: "The bonk needs a victim."

**2 players vs 5.**
- **Knock-On** scales with crowding. It's rare in 2p (one ball to hit) and
  common on 5p greens. That is right: a crowded green should be a
  billiard table.
- **Teeth** in 2p works only when the trailing player finishes first. Then
  the leader has a goose to beat, and it's the best comeback moment in the
  game. In 5p, the first spectator to send it claims the target; the
  broadcast greys everyone else's button.
- **Gallery** gives the leaders a job. In 2p, the leader decides whether to
  help their only rival or loom behind the green. Everyone's verdict
  ("SAVED", "ROBBED") is public, which keeps the trolling honest.

**Cut with regret:** Regift (Tech/UX: "lovely, but it's the wheel again"),
Conductor (green speed; runner-up for a later round), Hand in the Cup
(Weird/Golf runner-up). Hard no: Duet Putt and Shot Clock as a separate
system (the bucket can't carry real-time input), Lie Swap and Pin Hex (races
on shared state), Lights Out and Cold Hands (accessibility), Hot Potato (a
stroke penalty for luck).

### 12.4 Decision

Build three, in this order:
1. **Knock-On**: players in play affect each other.
2. **Teeth**: trailing spectators press the leaders.
3. **The Gallery**: any spectator can save or rob a friend.

Together: **your standing picks your spectator role.** If you're behind, you
get a goose with teeth. Anyone can take a brolly.

**Shared plumbing (~10 lines).**
- `sendEmote(kind, to, arg, { state })` gets an emote reserve. State kinds
  (`knock`, `teethx`, `fanhit`) may spend the last token. Everything else
  (reactions, `possess`, `stand`, `teeth`) needs ≥ 2 tokens, so a reaction
  spammer can't drop a knock.
- `toParThru(id, n)`: to-par over holes 1..n from `standings()` scores. Use
  it with `n = myHole() − 1` wherever "ahead/behind" is compared, so a
  finished spectator isn't compared against an unfinished hole.

### 12.5 Spec: Knock-On (~165 lines: physics 15, main 135, lines 15)

**Flow**
- **Shooter** hits a resting rival ball:
  - a billiard *clack*;
  - their ball rolls away;
  - banner "💥 KNOCK-ON<small>{rival}'s ball is moving</small>";
  - for two knocks, "🎱 CANNON!".
- **Target**:
  - the flight cam briefly follows their own ball;
  - banner "💥 KNOCKED BY {RIVAL}";
  - if knocked in: "🎱 HOLED BY {RIVAL}<small>counts, no extra stroke</small>";
  - if the target trails the knocker: chip "Knocked. Put it back? (R)" for 8 s.

**physics.js**
- Add `const knocked = new Set()` beside `inCanopy`.
- At the top of the collider loop: `if (c.push && knocked.has(c)) continue;`.
- In the sphere branch, when `vn < 0 && c.push`, replace the bounce with an
  equal-mass exchange:
  ```js
  const k = (1 + (c.e ?? 0.9)) / 2;
  const tvx = k * vn * nx, tvz = k * vn * nz;   // target leaves along −n
  vx -= k * vn * nx; vy -= k * vn * ny; vz -= k * vn * nz;
  knocked.add(c);
  ev('knock', { tag: c.tag, vx: tvx, vz: tvz, speed: Math.hypot(tvx, tvz) });
  continue;
  ```
  After a knock, the target is gone from this sim; it's rolling now.
- `rivalColliders`: add `push: true`, `e: 0.9`.

**`knockSim(start, vx, vz)`** must be identical on every client.
- Clamp the speed to 12 m/s.
- Call:
  ```js
  simulate(
    { course: G.course, cup: G.cup, wind: { x: 0, z: 0 }, colliders: G.colliders, strokeNo: 0 },
    start,
    { vx, vy: 0, vz, side: 0, lift: 0, check: 0, rolling: true },
  )
  ```
  It uses no trait, no `dynamic` and no player power-ups.
- **Green cap:** if `start` is on green or fringe, truncate the frames at the
  first frame whose cup distance exceeds `d0 + 3`. Rest there.

**Send** (in `doShot`, after `simulate`)
- Take up to 2 `knock` events with `speed ≥ 0.3`. Round `vx` and `vz` to
  0.01 and use those rounded values locally too.
- Send
  `sendEmote('knock', rid, `${h}:${prog.strokes}:${x.toFixed(2)}:${z.toFixed(2)}:${vx}:${vz}:${e.frame}`, {state:true})`
  (~38 bytes), where `x`, `z` is `rivalPos(r)`.
- Locally, queue `r.knock = { at: e.frame, sim: knockSim(p, vx, vz) }`.
  Start it when `G.shot.t ≥ at`.

**Receive** (`onEmote`, *before* the `ev.to !== me` filter)
- **Hole ≠ mine:** ignore.
- **`to` is another player:** queue the same animation on `rivals.get(ev.to)`.
  It starts when the sender's `r.playing.t ≥ f`, or now if their playback
  is over.
- **Animation:** set `target.playing = { shot: { frames, n, result }, t: 0, stroke: -1, pos }`.
  When it ends, write a provisional `target.prog.rest = end`
  (`holed: true` if holed) so the ball doesn't snap back before their real
  progress arrives.
- **`to` is me:** `G.knockQ = {r, strokes, x, z, vx, vz, f}`. In the main
  update, apply it when the sender's playback reaches `f` *and*
  `!swing.active`.
- **Void (silently; progress reconciles everyone):**
  - `strokes !== G.strokes`;
  - `dist(G.ball, {x,z}) > 0.05`;
  - the mode isn't address or walk;
  - you struck first.
- **Apply:** `G.walk = null`, then build `G.shot` as in `goosePunt`, with
  `kind: 'knock'`, `G.mode = 'flight'` and the flight cam.
- **`endShot`:** `if (s.kind === 'knock') return endKnock(s)`.
  - **holed:** `G.ball = cup`, banner, `say('knockIn')`, then `holeOut(s)`.
    No stroke is added.
  - **water or oob:** `G.ball = s.start`, banner "💥 Put back<small>no penalty</small>".
  - **rest:** `G.ball = end`. If `toParThru(me) > toParThru(r)`, offer the
    put-back chip (key R); accepting restores `s.start`.
  - Then `linger(1.2, () => afterStroke(true))`, which sends progress.

**Limits**
- Only resting balls on your hole (`rivalColliders` already skips flying
  balls and cup-side balls).
- At most 2 knocks a shot.
- Never a stroke penalty.
- Never applied mid-swing.
- A knock-in always counts. That's the gift.

**Visuals and sound**
- 18-particle burst at contact in the shooter's colour; the knocked ball
  trails in the shooter's colour.
- `sfx.knock(v)`: triangle 2.6 kHz + 3.1 kHz for 40 ms, plus a 30 ms
  highpass noise.
- CANNON: `sfx.calledIt`.
- Holed-by: `sfx.holed`, plus confetti in the knocker's colour.
- PRIO: `knockOn` 3, `knockedBy` 3, `knockIn` 4.

```js
knockOn: [
  ['A little contact there. {rival} will not enjoy that.', 'Oh, it has clattered into {rival}! Billiards!', 'IT HIT {rival}! IT IS SNOOKER NOW! NOBODY IS SAFE!'],
  ['{name} has moved {rival} on. Rub of the green.', 'Knocked {rival} clean off the spot! Cheeky!', 'CLACK! {name} IS PLAYING POOL WITH A FRIENDSHIP!'],
],
knockedBy: [['And {rival} has moved {name}\'s ball for them.', '{rival} has knocked {name} sideways! Literally!', '{rival} HIT THE BALL! THE BALL IS MOVING! THIS IS AN ASSAULT!']],
knockIn: [['Knocked in by {rival}. Under the old rules, that counts.', '{rival} has holed it for {name}! Is that allowed? It is!', '{rival} PUTTED {name} IN! NINETEEN FIFTY-ONE RULES! IT COUNTS!']],
```

### 12.6 Spec: Be the Goose, with Teeth (~110 lines)

**Flow (spectator)**
- While possessing, a new button appears: **"🦷 Go for the ball"**. It shows
  only when all of these hold:
  - the watched player `w` is level with you or ahead of you
    (`toParThru(me) ≥ toParThru(w)`);
  - `w` is at rest with `strokes > 0`, off the green and fringe;
  - nobody has sent Teeth at `w` this hole (you see others' `teeth` in the
    broadcast);
  - your puppet's waypoint is ≥ 14 m from `w`'s ball.
- Tapping it swaps in three chips: "🥚 Brood it", "🏉 Relay it",
  "🎲 Surprise me".
- Results arrive as toasts: "🦷 Got it!", "🦷 Too slow.",
  "🦷 They won the tug.".

**Flow (target)**
- Their collar pulses red and the label becomes "🦷 {rival}".
- `honk(2)`, and the hint "🦷 {rival}'s goose wants your ball."
- It walks in at 1.7 m/s from 14 m or more (about 8 s). Footstep ticks
  quicken as it closes.
- **Hit the ball first and it face-plants.**

**Messages**
- `teeth`: to `w`, `arg h:strokes:trick`, where trick is `brood|relay|any`.
- `teethx`: to the sender, `arg h:got|miss|tug|void`, sent with
  `{state:true}`.

**Receiver**
- **Validate:**
  - the hole matches, `strokes === G.strokes`, the mode is address or walk;
  - `!G.teethHole` and `puppets.has(from)`;
  - the sender is not behind me (`toParThru`);
  - `canSnatch({ teeth: true })`: today's caps minus the `G.snatches`
    limit. That means no tee, no green or fringe, no hole 6 before the
    scare, at most 2 thefts, and no theft right after a theft.
  - On failure, send `teethx void`.
- **Start the hunt:** `G.teethHole = true; p.hunt = { trick, strokes, t: 0 }`.
  If the puppet is within 14 m, relocate it to 14 m (a `validLand` ring,
  12 tries) with a feather burst.
- **`updatePuppets`, while `p.hunt`:**
  - target = ball − 0.6 m toward the goose, speed 1.7;
  - skip the green and 6 m clamps; no idle despawn.
  - Ball struck (`G.strokes` changed) or mode left address/walk: face-plant
    (`body.rotation.x → 1.2` over 0.25 s, 12 feathers, `sfx.squeak`), then
    send `teethx miss`.
  - `hunt.t > 25 s`: give up the same way.
  - `d < 1.0`, `G.mode === 'address'`, `!swing.active` and
    `now − G.addressAt > 1.5 s` (new `G.addressAt`, set on entering
    address): call `promotePuppet(id)`.
  - While swinging, it waits pecking at 1.2 m.
- **`promotePuppet(id)`:**
  - build a goose object on `p.mesh` with `radius 0`,
    `home {x, z, r: 2}`, `breed: 'puppet'` (forces a rebuild next hole),
    `puppetOf`, `trick` and `label`;
  - `geese.splice(G.geeseN, 0, g); G.geeseN++; puppets.delete(id)`;
  - `startTheft(g, 0.3)`, `say('teeth', …, {bump: 14})`, send `teethx got`.
- **`pickLoss`:** after the `forceLoss` line,
  `if (g.trick && g.trick !== 'any' && eligible(g.trick)) return g.trick;`.
- **`endTug(true)`** with `g.puppetOf`: send `teethx tug`.
- **`loadHole`:** dispose puppet labels and clear `puppetOf`.

**Limits**
- One Teeth per target per hole, and one per sender per hole.
- Every theft cap still applies.
- Never a stroke; never mid-swing; 1.5 s address grace.
- It points up only.
- The tug stays AI-strength; the bucket can't carry a PvP tug.

**Sender view (optional, ~15 lines):** the sender's own puppet walks the same
1.7 m/s line locally, so they watch it close in. On `got`, the spectator cam
holds on it for 2 s.

```js
teeth: [
  ['A goose with a familiar walk. That is {rival}.', 'That goose is {rival}! It wants {name}\'s ball!', '{rival} HAS BECOME A GOOSE AND IS COMING FOR {name}! HIT IT! HIT IT NOW!'],
  ['The goose is wearing {rival}\'s colours. Hurry, {name}.', '{rival}, in goose form, is closing in!', 'IT IS {rival}! IN A GOOSE! WHY IS {rival} A GOOSE!'],
],
teethMiss: [['And {name} plays before the goose arrives.', 'Too slow, {rival}! The goose face-plants!', '{name} HIT IT FIRST! THE GOOSE HAS FALLEN OVER! LOOK AT IT!']],
```
PRIO: `teeth` 3, `teethMiss` 2.

### 12.7 Spec: The Gallery (~140 lines)

**Flow (spectator)**
- **"☂️ Stand here"** toggles stand mode. It is mutually exclusive with
  possess.
- Tap the course and your golfer jogs there, opening a giant umbrella in
  your room colour (a *fwump*).
- An invalid tap feeds "☂️ Behind the ropes, please."
- Moves are limited to 1 per 3 s. They're locked, with the button reading
  "☂️ Ball in the air", while any ball on the hole is in flight
  (`r.playing`).
- Results arrive as toasts: "☂️ You saved {rival}!",
  "☂️ You robbed {rival}.", "☂️ Bonk.".
- When the watched playback passes within 1.2 m of your own body, your golfer
  flinches and you hear `sfx.oof` (cosmetic).

**Messages**
- `stand`: no `to`, `arg h:x:z` (0.1 m). Every client still on hole `h`
  places it at the same spot.
- `fanhit`: to the spectator, `arg h:save|rob|bonk`, sent with `{state:true}`.

**`ropeOk(x, z)`** is shared, deterministic, and checked by both sender and
receiver:
- `validLand`;
- surface `rough` or `sand`;
- outside the green ellipse grown by 2 m;
- ≥ 12 m from the tee;
- ≥ 1.2 m from any tree trunk.

**Receiver**
- `fans: Map<id, {x, z, at, arrived, next, idle}>`.
- The body reuses `rivalAvatar(r)` (shown even though r has holed), plus a
  child from `buildBrolly(hex)`: a half-sphere canopy, r 0.9, 8 segments,
  with a 1 m stick.
- It jogs at 12 m/s like `updateRivalAvatar` and is `arrived` within 0.2 m.
- A `stand` that arrives while `swing.active` or `G.mode === 'flight'` goes
  in `fan.next`, applied on return to address or walk.
- **`galleryColliders(lie)`**, appended to `dynamic` in `doShot`:
  - only for each arrived fan ≥ 8 m from `lie`; a fan closer than 8 m is
    drawn at 40% opacity and is not solid;
  - body: `{kind:'cyl', x, z, r:0.28, y0:gy, y1:gy+1.75, e:0.3, tag:'fan:'+id}`;
  - brolly: `{kind:'sphere', x, y:gy+1.95, z, r:0.85, e:0.25, tag:'fan:'+id}`.
  - At most 4 fans are solid (the most recent movers).
- **Verdict:** if the sim has a `hit` tagged `fan:`, re-run `simulate` with
  the same `L` and the fan colliders filtered out (the counterfactual).
  Compare the real result with the counterfactual:

  | Verdict | When |
  | --- | --- |
  | `save` | water/OOB without the fan but rest/holed with it, or it ends ≥ 5 m closer to the cup |
  | `rob` | the reverse |
  | `bonk` | anything else |

  Store the verdict on `G.shot.fan`.
- **`fireEvent` `hit` with tag `fan:`:**
  - `sfx.oof()`: sine 300→140 Hz for 0.18 s, plus a 50 ms noise;
  - the brolly flips inside out (`scale.y = −1` for 0.6 s);
  - the golfer flinches (`rotation.x −0.4`);
  - banner "☂️ OFF {RIVAL}'S BROLLY<small>saved from the water</small>"
    (or "robbed!");
  - `say('fanSave'|'fanRob'|'fanBonk')`, then send `fanhit`.
- **Despawn:** the fan goes when that spectator's progress shows a later
  hole, on `loadHole`, or after 90 s idle.

**Limits**
- One body per spectator.
- Rough or sand only; never fairway, green, fringe or water.
- ≥ 8 m from your ball to be solid.
- Never moves mid-swing or mid-flight.
- No stroke penalty in itself.
- **Bias:** a ball only reaches the rough if it's already leaving the
  fairway, so most hits are rescues. The public verdict keeps robbery
  socially expensive.

```js
fanSave: [['Off {rival}\'s umbrella, and back into play.', 'Saved by {rival}\'s brolly! What a friend!', '{rival} TOOK ONE FOR THE TEAM! RIGHT IN THE UMBRELLA! HERO!']],
fanRob: [['That has struck {rival} in the gallery. Unlucky, {name}.', 'Off {rival}! That was going somewhere nice!', '{rival} WAS STANDING THERE ON PURPOSE! I SAW IT! WE ALL SAW IT!']],
fanBonk: [['A spectator has been struck. {rival} is fine.', 'Right off {rival}! Somebody check on {rival}!', 'IT HIT {rival}! THE UMBRELLA HAS INVERTED! THE GALLERY IS DOWN!']],
```
PRIO: all three at 3.

### 12.8 Before shipping

- **Determinism gate (Tech):**
  - Two headless pages run `knockSim` from the same rest and velocity; the
    end points must match bit for bit.
  - A 5-bot room round: log the knocks per round (expect 1–3) and assert
    that every target's progress matches the animation the other clients
    played.
- **Teeth:**
  - A forced `teeth` at a bot that dawdles 10 s must steal.
  - A bot that swings within 3 s must produce `miss`.
  - The 2-thefts cap holds.
- **Gallery:**
  - Place a fan on the water side of hole 2's landing area and hit 20 sliced
    drives. Count the saves; the counterfactual must agree with a no-fan
    run.
- **Voice:** regenerate clips with `tools/voices/gen.mjs` for the eight new
  classes. Names are spoken as "the golfer" and "their rival", and every
  line above still reads correctly with them.
- No server changes are needed. Every new kind is ≤ 24 bytes and every arg
  ≤ 40.
