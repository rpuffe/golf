# Council Round 9: the Boss fight (hole 9, "The Last Moonshot")

Same council and rules as rounds 1–8. A suggestion passes with 3 or more YES
votes out of 5. Each judge has up to two vetoes, and a vetoed option needs 4
or more YES to survive. The judges are Fun Expert (FE, chair), Technical
Director (TD), Player Advocate (PA), Weirdness Curator (WC) and Golf Purist
(GP).

**Owner ask (verbatim):** "we also need to make sure that the player has to
interact with the boss at the end … where you have to interact with the boss
first before the hole is unlocked for you to do. You also need to take into
account Old Tom if you're playing single player." The owner also approved a
**goose airstrike** on hole 9: a military-shooter parody that names and copies
nothing real.

## What the Technical Director found in the code before the vote

- **The throne is not on the green.** It sits about 36 m short of the cup, at
  the foot of the mesa, and its aura never reaches the green.
- **The aura switches off with distance.** `auraOff()` already turns the aura
  off when the boss is more than 3 m from the throne, so moving it off its
  throne kills the Honk Hole for free.
- **The boss can be hit by a putt.** Its collider is a sphere with r 0.8,
  centred 0.75 m above the ground, so it reaches the turf.
- **The "shoo" spare-ball path is almost there but unused.** It was missing
  three things:
  - `canSwing()` has to accept it;
  - `endShot()` needs a branch for it;
  - `doShot()` must not consume power-ups on it.
- **Old Tom never sees geese**, because his planner passes no dynamic
  colliders.
- **`strike` is already taken** by bowling, so the airstrike is `honkStrike`.
- **Gimmes ignore the gate.** `acceptGimme()` could hole you out through a
  sealed cup.

## Q1. How do you "interact with the Boss"?

| # | Option | FE | TD | PA | WC | GP | Result |
|---|---|---|---|---|---|---|---|
| A | Throne bonk, required: hit the enthroned Boss in play to unlock | N | Y | VETO | Y | VETO | **REJECTED** (survives as a bonus inside D) |
| B | Boss duel minigame on the green | Y | N | N | Y | VETO | **REJECTED** |
| C | Cup moves into the Boss's nest | Y | N | Y | Y | VETO | **REJECTED** (its picture is merged into D) |
| D | **The Boss guards the cup** | Y | Y | Y | Y | Y | **ADOPTED 5–0** |
| E | Tribute: feed the Boss a named ball | N | Y | VETO | Y | N | **REJECTED** |

How option D works:
- The cup is sealed until you bonk the Boss.
- Inside 30 m, the Boss flies over and sits on the cup.
- You get free bonk shots: the spare ball, no stroke. After three misses it
  yields.
- A real stroke that bonks the Boss on its throne opens the cup early and
  kills the Honk Hole.

## Q2. Multiplayer

| # | Option | Result |
|---|---|---|
| M1 | **Individual gates:** every player bonks their own Boss. Friends get a toast, and the first bonker gets the credit | **ADOPTED 5–0** |
| M2 | Room raid with a shared Boss HP bar | REJECTED (shared state, forced waiting) |
| M3 | First bonk opens everyone's cup | REJECTED |

## Q3. Old Tom (solo)

Option T3 was adopted 5–0, in two parts:
- **The seal:** his planner obeys the same seal. From more than 30 m out he
  cannot hole.
- **A cosmetic "ghost bonk":** when his ball first rests within 30 m, a toast
  ("👻 Old Tom bonked the Boss.") and his line "Bonked that bird in
  fifty-two, too."

Bonks are free for both of you, so the race stays fair.

## Q4. The goose airstrike: the "Honk Strike"

Option S-C was adopted 5–0. It is a scripted Honk Strike on the approach,
once per player per round:
- **When:** at an address 40–250 m from the cup, off the green, while the Boss
  is still on its throne.
- **Warning:** a 1.1 s card ("📻 HONK STRIKE!"), then a 7 s clock and a red
  drop-zone reticle 8 m across. Gander Squadron, five geese in a V, comes in
  over the moon.
- **Escape:** any swing launched before the clock ends escapes. The eggs land
  behind you: "😎 Never look back at explosions."
- **Caught:** "💥 EGGED!", and the ball is blown 10–20 m away from the pin,
  never closer. It never costs a stroke.

Rejected options:
- random strikes anywhere on the hole;
- the Boss's revenge on the green (it can't be escaped there);
- friends calling strikes on each other (minuted for a later round).

**Owner override of a council condition.** The council voted 3–2 to count a
caught strike against the S1 budget, the one random setback per hole. On the
playtest the owner noted that "if I get picked up by a goose early on in the
hole, I am ignored by the boss". The Boss must never ignore you, so the strike
is outside that budget. It is scripted, telegraphed and escapable, so it is
not a random setback.

## Built, and where

- **`physics.js`:** `world.cupSealed` stops capture and lip-outs, and emits
  `sealed` once ("🔒 SEALED · Bonk the Boss first.").
- **`oldtom.js`:**
  - `cupSealed` applies when he is more than `bossGate.r` from the cup.
  - His mishit check now tests his real error (`ERR.full`), so his tee shots
    stop finding the crater lake.
  - On crazy golf he always putts, with steadier hands.
  - Round mean 37.6 on par 35.
- **`holes.js`:** hole 9 gets `bossGate: { r: 30, tries: 3, hitR: 1.3 }`,
  `honkStrike: { band: [40, 250], r: 8, clock: 7 }` and a new tee hint.
- **`main.js`:**
  - the gate: `resetBossGate`, the lid, `maybeBossGuard`, `enterBonk`,
    `endBonk`, `bossBonk`, `bossYield`, `maybeGhostBonk`;
  - the strike: `maybeHonkStrike`, `updateHonkStrike`, `strikeImpact`,
    `strikeBlast`;
  - the `guard` goose state;
  - the `bossbonk` and `honkstrike` room emotes;
  - gimmes and thefts respect the gate and the strike.
- **Never a softlock:** if the Boss is missing or busy (mid-theft), the cup
  opens. If its flight is held up, it lands on the cup after 4 s regardless.
- **Commentator:** new classes `bossGuard`, `bossBonk`, `bossYield` and
  `honkStrike`, plus Tom's `bonk` line, with 16 clips.

Not built: the crown landing on your ball (condition 12, marked "the first
thing to cut").
