# Council Round 8: the v7.0.0 room playtest

Same council as [council.md](council.md), [council-round6.md](council-round6.md)
and [council-round7.md](council-round7.md). This round judged suggestions from
a playtest rather than pitches: three minimal-context AI playtesters played
one 9-hole multiplayer room (code ZQPQ) of v7.0.0 together, their suggestions
were merged into S1–S15, and the five judges voted on them independently.

**Owner sign-off (verbatim):** "OK that all looks good. lets move on your
recommendation please" (record the verdict, then build it).

---

## 1. The playtest

| Tester | Profile | Device | Score | Fun |
| --- | --- | --- | --- | --- |
| Mallory (host) | casual party gamer | phone, 390×844 touch | 47 (+13) | 7.5/10 |
| Dev | competitive golfer | laptop, mouse | 38 (+4), won | 7/10 |
| Pat | first golf game ever | phone, 390×844 touch | 41 (+7) | 7/10 |

**Limits.** Headless browsers, no audio, agent reaction times of several
seconds. That inflated the waits and hurt the timed minigames. Dev was down
(503), so the room ran on a local copy of v7.0.0.

**What they loved.** The Sasquack, named balls with one life (the funerals),
goose sabotage from friends (when you are the victim), the units ("3.1 blue
whales"), the commentator's rising hysteria, crazy golf at night, and the
light turning from golden hour to moonlit graveyard.

**What hurt, in their words:**
- **Dev:** "Competitive players will rage-quit over invisible double bogeys."
  Four random ball-moving events in nine holes; tugs lost before he knew
  they had started.
- **Mallory:** waiting 30–120 s behind a half-screen panel looking at empty
  rough; popups stacked and cut off ("INTO TH…"); the wheel and the power-up
  chip disagreed.
- **Pat:** "A newcomer reads that number as a promise." The putt readout ran
  25–30% long for her heavy ball; Help talked about keys she didn't have;
  she played holes 5–9 alone.

## 2. Suggestions put to the council

| # | Suggestion | Raised by |
| --- | --- | --- |
| S1 | Cap random disruptions at one per player per hole, with a warning | Dev |
| S2 | A "get ready" beat before the tug and the reel | Dev, Mallory |
| S3 | Show the attacker what their sabotage did | all three |
| S4 | Two-way reactions and quick chat | all three |
| S5 | Smarter waiting (countdown, chase cam, bottom strip, idle flag) | all three |
| S6 | Keep the group together (soft regroup, or turn-based) | Mallory, Pat |
| S7 | A shared "money putt" | Dev |
| S8 | Fair room standings | Dev, Pat |
| S9 | Honest distances (putt readout, flyover, HUD, club button) | Pat, Mallory |
| S10 | Phone-only hints, teach tempo | all three |
| S11 | One message at a time | Mallory, Pat |
| S12 | Declutter the tee and the overlays | Mallory, Pat |
| S13 | Show each player's golfer and ball in the lobby and scoreboard | Mallory, Pat |
| S14 | Sliding back up lowers power | Dev |
| S15 | The commentator gets the facts right | all three |

## 3. The vote

Judges: Fun Expert (chair, FE), Technical Director (TD), Player Advocate
(PA), Weirdness Curator (WC), Golf Purist (GP). A suggestion passes with 3+
YES of 5. Each judge may veto up to 2; a vetoed suggestion needs 4+ YES.
Priority points come from each judge's top 3 (5, 4, 3).

| # | Suggestion | FE | TD | PA | WC | GP | Result | Pts |
|---|---|---|---|---|---|---|---|---|
| S2 | Minigame "get ready" beat | Y | Y | Y | Y | Y | **ADOPTED 5–0** | 17 |
| S9 | Honest distances | Y | Y | Y | Y | Y | **ADOPTED 5–0** | 14 |
| S3 | Show attacker the sabotage result | Y | Y | Y | Y | N | **ADOPTED 4–1** | 8 |
| S5 | Smarter waiting | Y | Y | Y | Y | Y | **ADOPTED 5–0** | 5 |
| S1 | Cap random disruptions, with a warning | Y | Y | Y | VETO | Y | **ADOPTED 4–1** (overrides the veto) | 4 |
| S4 | Two-way reactions and quick chat | Y | Y | Y | Y | N | **ADOPTED 4–1** | 3 |
| S8 | Fair room standings | Y | Y | Y | Y | Y | **ADOPTED 5–0** | 3 |
| S10 | Phone-only hints, teach tempo | Y | Y | Y | Y | Y | **ADOPTED 5–0** | 3 |
| S11 | One message at a time | Y | Y | Y | Y | Y | **ADOPTED 5–0** | 3 |
| S12 | Declutter tee and overlays | Y | Y | Y | Y | Y | **ADOPTED 5–0** | 0 |
| S15 | Commentator gets facts right | Y | Y | Y | Y | Y | **ADOPTED 5–0** | 0 |
| S7 | Shared "money putt" | Y | Y | Y | Y | Y | **ADOPTED 5–0** (TD: lower priority) | 0 |
| S6 | Keep the group together | Y | N | Y | Y | Y | **ADOPTED 4–1, soft regroup only** | 0 |
| S13 | Golfer and ball in lobby and scoreboard | Y | Y | Y | Y | N | **ADOPTED 4–1** (low priority) | 0 |
| S14 | Slide up to lower power | Y | VETO | N | Y | VETO | **REJECTED 2–3, two vetoes** | 0 |

**Top-3 picks:** FE S5, S2, S3 · TD S9, S2, S4 · PA S2, S9, S10 ·
WC S3, S2, S11 · GP S9, S1, S8.

**Vetoes:** WC vetoed S1 (the cap files the teeth off the game; the warning
half alone would be welcome). TD and GP vetoed S14 (see section 5).

## 4. Binding conditions

- **S1, the disruption cap.**
  - At most one stroke-costing *random* event (wild-goose grab, punt,
    Sasquack and similar) per player per hole.
  - Each gets a ~1 s *visual* warning first ("!" plus a honk wind-up). No new
    input is required, and the warning must not become a guaranteed dodge.
  - A friend's sabotage stays outside the cap (majority; GP wanted it
    counted).
  - Never remove geese. Comedy-only goose moments stay uncapped.
- **S2, the get-ready card.**
  - Freeze and show a card for about 1–1.2 s, in character, in the device's
    own verb (swipe on phones, Space on desktop). The timer starts only
    after the card.
  - Show progress on every input.
  - Fix legibility, not difficulty. Only the first tug of a session may be
    softer; the reel keeps the rubric's 70% win rate for competent input.
  - A goose theft cancels an in-progress swing (confirmed: `startTug` never
    did).
- **S3, the sabotage payoff.**
  - A toast of 7 words or fewer, naming the victim and the result, in the
    commentator's voice, sent reliably as a state emote.
  - The victim sees who sent it.
  - Each spectator tool gets a one-line explanation.
  - Toast only; no picture-in-picture replay (TD).
- **S4, two-way reactions.**
  - Show reactions from *any* hole (confirmed: `onEmote` dropped reactions
    from other holes).
  - 4–6 preset phrases, absurd and in-world, never free text.
  - Bubbles never cover the ball or the swing pad.
- **S5, smarter waiting.**
  - Must have: a countdown to "Go on without them", a bottom strip instead of
    the half-screen panel, a chase cam on whoever is mid-shot until the ball
    stops, and an idle flag.
  - Dropped: lining up your next tee shot while you watch (TD risk).
  - Block duplicate same-name sessions.
- **S6, the group.** A soft nudge or regroup only, never a forced wait.
  Cheer and heckle tools point at the leaders, never at stragglers. No
  turn-based mode (at most a future host-only option).
- **S7, the money putt.** Only on hole 9 or when a putt can actually change
  the result, at most twice a round. Only waiting or finished players are
  pulled in; nobody's play is interrupted. Spectator emotes never cover the
  putter's screen.
- **S8, standings.** Finished players rank first; unfinished players are
  listed as "thru N". "Nth place" is read from the same list (confirmed
  sorting bug in `standings()`).
- **S9, honest numbers.**
  - One source for each number.
  - The putt readout includes the ball trait and power-up and matches the
    stop ring (confirmed: `puttPower` ignored the trait).
  - Slope stays the player's read.
  - The flyover, HUD and club button agree.
  - Find the cause before tuning, then re-run rubric 11 and 12.
- **S10, phone teaching.**
  - Remove desktop strings from the page on touch devices, not just
    visually (screen readers read them).
  - Show the aim and swing hint on hole 1, stroke 1.
  - A one-time tempo tip of 7 words or fewer.
  - Add "lift to cancel" to the swing hint (replaces S14).
- **S11, one message at a time.** A bounded queue with one pending line;
  lines older than ~2 s are dropped. Critical prompts jump the queue. The
  wheel result and the chip always agree. Curses get colour plus an icon.
- **S12, declutter.** In order: fix the invisible bullet-cam label that eats
  taps (`pointer-events` was never turned off); hide the overlays drawn over
  Help and the end card; show other golfers as translucent ghosts during
  your own swing. Friends' resting balls stay fully visible and solid.
- **S13, who's who.** A 2D portrait plus a shape or icon as well as colour.
  Show ball names. The invite hint is not red. Low priority.
- **S15, facts.** Score words come from the same source as the scorecard.
  Lead calls compare players only over holes both have finished. The
  deliberate "Par, I think" Old Tom gag stays, but never overrides the real
  result.

## 5. Rejected

- **S14, slide up to lower power.** In `swingMove` any upward slide over
  2 px already starts the downswing. Guessing intent from drag speed would
  make the swing non-deterministic and break the tempo check (a council
  non-negotiable). Lifting a finger mid-backswing already cancels, so the
  replacement is to make "lift to cancel" (and Esc) discoverable, folded
  into S10.

## 6. Code findings from the ballots

The Technical Director checked each bug report against the code; the Golf
Purist and Player Advocate confirmed S9 independently.

| Finding | Where |
| --- | --- |
| The tug and reel clocks start the moment the panel opens | `startTug` (`TUG_SECS` 6.5), the angler reel |
| A theft mid-backswing leaves the swing live | `startTug` never calls `cancelSwing()` |
| Putt metres are flat-roll for a *standard* ball | `puttPower` ignores the ball trait and power-ups; the stop ring includes them |
| Club button prints the static range, HUD prints live carry | `CLUBS.range` vs the sim carry; the flyover uses a third measure |
| "+5 thru 4" ties with or beats "+5 thru 8" | `standings()` sorts on to-par, then thru |
| "Nth place" counts only online unfinished players | end card note |
| Reactions from other holes are dropped | `onEmote`: `if (hole !== myHole()) return;` |
| Possess, punt and Sic 'Em never report back | only `teethx` and `fanhit` send results |
| The bullet-cam label eats taps on the chip | `#bulletLbl` is `opacity:0` without `pointer-events:none` |
| The swing pad and scope float over Help and the end card | hide rules cover between, tug and bullet only |
| Hard-coded score words | commentator.js: "a look at birdie" in the green tier, "Par, I think" in `scared` |
| Lead calls compare different thru counts | rival lead-change lines |
| "Go on without them" timing is invisible | `late = t > 45` |

## 7. Build order

By priority points, plus the TD's bug-sweep note:

1. S2 (and the `startTug` swing cancel)
2. S9
3. Bug sweep: S8, S12, S15, plus the S4 emote filter
4. S3
5. S5
6. S1
7. S10 and S11
8. S4 quick chat
9. S7
10. S6 (soft regroup only)
11. S13

## 8. Sources

The ballots and playtest reports lived in a temporary playtest folder and are
summarised above rather than copied: five ballots (Fun Expert, Technical
Director, Player Advocate, Weirdness Curator, Golf Purist) and three reports
(Mallory, Dev, Pat).
