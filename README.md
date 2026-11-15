# ⛳ Golden Hour Golf

A first-person 3D golf game for the browser, played at sunset, with a live
leaderboard and real-time social toasts. It is deployed on
[flightdeck](./CLAUDE.md).

Nine holes (par 34) are played from behind the ball in first person. One
gesture swings on every device: drag down, then flick up. On top of real
golf, five odd features came out of a design council (see
[design/council.md](design/council.md)), and a second council round added
more (see [design/council-round6.md](design/council-round6.md)), and a
third took the course to nine holes (see
[design/council-round7.md](design/council-round7.md)):

| Feature | Borrowed from | What it does |
| --- | --- | --- |
| 🔭 **Sniper's Lie** | tactical shooters | Right-click to scope. The scope has a laser rangefinder, a wind ticker and breathing sway, and Shift holds your breath. Great shots trigger a slow-mo **bullet-cam** into the cup. |
| 👻 **Ghost Strokes** | Trackmania / Braid | You race a ghost stroke for stroke: **Old Tom**, the club pro buried by the first tee (a translucent ghost golfer who mirrors your backswing), and later your own best round. The ghost ball is **solid**, so it can collide with your ball mid-air or **stymie** your putt. |
| 🪿 **The Geese** | Untitled Goose Game | Every hole has geese (and goslings, and on the last hole a boss). Stop your ball near one and it steals the ball. **Goose cam** follows it as it struts off to its own theme song, ball in beak. When the song ends it's a **tug-of-war**: shake the mouse or swipe like mad. Most people lose, and the goose then punts the ball, airlifts it to a bunker, or (rarely) eats it. No penalty strokes. |
| 🎙 **Whisper-to-Hysteria Commentator** | golf TV / skate-game announcers | A hushed, captioned broadcast voice that comes unglued as things go wrong. Every line is voice-acted (ElevenLabs): whispered when calm, sarcastic or delighted when rattled, shouted when hysterical. |
| 🎣 **Four Balls, One Life** | XCOM / roguelikes + Stardew fishing | You carry four named balls, each with a physics trait. Water starts a reel-in fight: snap the line and the ball dies, and its tombstone joins a persistent graveyard by the first tee. |

Also in the game:

- **🏌️ Golfers.** Pick one of five on the title card (The Pro, Grandma
  Birdie, Caddie Kid, Sir Bogey, The Mascot). You watch them sprint to the
  ball after each shot; in rooms your friends' golfers stand at their balls.
- **🎬 Hole flyovers.** Each hole opens with a sweeping camera shot and its name.
- **🎡 Power-up wheel.** Every hole spins a wheel in the corner: Bucket Cup,
  Ghost Ball, Life Ring, Moon Boots, Pogo Ball, Sic 'Em (Goose Taxi when
  solo), Banana Ball or Goose Bait. Every wedge matters on every hole, and it
  never blocks play.
- **⛳ The nine holes.**
  1. The Welcome Committee (par 4): the goose meets your drive.
  2. Gerald's Lake (par 3): carry the water, or fish for your ball.
  3. Old Tom's Stymie (par 4): his ghost parks on your putting line.
  4. Sunset Strip (par 5): wind, and the scope over a long carry.
  5. The Bowling Green (par 4): ten geese racked like pins where a pure
     drive stops, with gutter bunkers either side. Strike, spare, gutter ball.
  6. The Windmill of Spite (par 4): its sails never stop; every shot starts
     from where the blades are, and rooms share that phase.
  7. Old Tom's Plot (par 3): a foggy graveyard, and a jumpscare when you hole
     out (a gentle version for reduced motion or "Scares off").
  8. Crazy Golf (par 2): a felt lane between rails. Each round draws one of
     three layouts (The Turnstile, Pinball, The Camel), the same for everyone
     in a room. Moon Boots and Pogo turn a putt into a hop; Banana curls it.
  9. The Last Moonshot (par 5): a launch-pad tee, moon gravity, a moat round
     a mesa green, and the Boss's Honk Hole, which grows stronger every stroke
     from the third. A clear leader gets taxed by the Boss, and the round ends
     with fireworks as the geese fly off across the moon.
- **🦶 The Sasquack.** Leave your ball by a tree trunk and a 3 m goose-yeti
  drops out of the canopy, roars at a low hero camera (trees in the shot are
  hidden), pulls out a pine tree and chips you out.
- **🪿 Smarter geese.** Three breeds, a curious goose that snatches your ball
  while you line up, a boss whose "Honk Hole" whirlpool bends every shot
  near it on the last hole, and seven ways to lose a tug-of-war (punt, relay,
  brood, hammer throw, tree stash, bunker, swallow).
- **🎣 Fishing docks.** A splash sends your golfer to the pond's dock; the
  rescued ball is dropped on dry land.
- **👀 Named balls.** Pick four of six signature balls on the title card
  (Bounce Springsteen, Sir Thud, Butterfingers, Clover, Lord Floofington,
  Nervous Nigel), then choose which one plays each hole at the tee. Each has
  googly eyes and its own animation: Bounce hops, Sir Thud shakes the
  ground, Clover sparkles, Lord Floofington sheds feathers in flight,
  Nervous Nigel trembles near geese and water.
- **👥 Rooms (live multiplayer).** Create a room, share the 4-letter code or
  link, and play the same holes at the same time with 2–8 friends. Their
  balls fly in your world as they hit, and their resting balls are solid.
  Everyone finishes a hole before anyone moves on; while you wait you watch
  the others, react (📯👏😱😂), offer a gimme, or **be the goose**: steer a
  puppet goose around a friend's hole. Scores show between holes. Players
  affect each other:
  - **Knock-On:** your ball moves a friend's resting ball (knock it in and it
    counts for them).
  - **Teeth:** if you're level or behind, your puppet goose can go for the
    leader's ball. Hit it first and the goose face-plants.
  - **The Gallery:** stand in the rough with a giant umbrella. It's solid:
    it saves some shots and robs others.
- **📏 Carry, in Geese.** While you pull back, a live ring shows where the
  ball will land, in metres and in one absurd unit per hole.
- **⛳ Putting** scales the putter's stroke to the putt (2/3/6/10/15/21 m
  tiers), shows the flat-green roll distance, and uses a generous cup. At
  rest, gold dots read the first two-thirds of a dead-weight putt, break
  included. While you pull back they run the whole roll to a stop ring,
  coloured green (it drops), gold (short) or red (well past), and the cup's
  pulsing ring takes the same colour.
- **👻 Old Tom's ghost ball** races yours in solo rounds: a bright soul ball
  with a halo and a name tag. He has good days and bad (about par +3).

- **dev**: https://golf-dev.fd.robertpuffe.com (deploys on push to `main`)
- **prod**: https://golf.fd.robertpuffe.com (promoted by tagging `v*`)

## Controls

| Action | Mouse / keyboard |
| --- | --- |
| Aim / look | Drag sideways on the course (the first few pixels of a drag decide: sideways aims, down swings). A/D or the arrow keys also aim, and W/S look up and down. |
| Swing | Drag down (power: watch the carry ring), then flick up fast (tempo). Flicking at an angle curves the ball. |
| Cancel a swing | Slide onto the ✕ strip that appears beside the cursor, press Esc, or right-click. |
| Putt | Same swing. The whole pull-back covers the putter's range for this putt (on the club button), the white ring shows the flat-green roll, and the gold dots read the break. |
| Easy swing | Hold Space for power and release it, then tap Space as the accuracy needle crosses the centre |
| Club | 1–4, Q/E or the scroll wheel |
| Scope / steady | Hold right mouse or Z, and hold Shift to hold your breath |
| Reel (angler) | Hold the big reel button, the mouse or Space, and keep the needle in the green |
| Tug-of-war | Hold the button and shake the mouse, swipe hard, or mash Space |
| Sound / voice / help | M / V / H |

Touch devices drag the course to aim and swing on an on-screen pad, with the
same ✕ strip to back out. On-screen instructions are seven words or fewer.

## How it works

One Go binary does everything. It serves the client (`web/`, embedded at
build time) and a small JSON + SSE API. There is no framework and no
database: durable state lives in S3, and live state lives in memory.

```
browser (web/: Three.js game)
  │  POST /api/rooms, /api/rooms/{code}/join → room membership
  │  GET  /api/rooms/{code}/events → SSE: roster, start, shot, progress
  │  POST /api/rooms/{code}/send   → relay a shot / progress / start / leave / emote
  │  GET /                 → web/index.html (+ /js/*, /lib/three.module.min.js)
  │  POST /api/score       → save a finished round, get leaderboards back
  │  GET  /api/leaderboard → { allTime, today }
  │  POST /api/hole        → "I just finished a hole" (broadcast)
  │  GET  /api/events      → SSE stream of everyone's hole-outs
  ▼
Go server (main.go)
  ├── Store  (store.go) ── S3 when STORAGE_BUCKET is set, else in-memory
  ├── Hub    (hub.go)  ──── in-memory SSE fan-out (ephemeral)
  └── Rooms  (rooms.go) ─── in-memory multiplayer rooms (ephemeral)
```

### The client (`web/`)

Every mesh is procedural and every sound is synthesized with WebAudio, so the
game uses no asset files. Three.js r170 is vendored at
`web/lib/three.module.min.js` because the CSP only allows same-origin
scripts.

| File | What it is |
| --- | --- |
| `js/holes.js` | the nine holes as data (tee, pin, fairway path, hills, bunkers, ponds, geese, wind, plus the windmill, tombstones, bowling pins, crazy-golf decks and moon gravity) |
| `js/course.js` | analytic terrain height and surface type, baked into 0.5 m grids for the physics |
| `js/physics.js` | the deterministic ball sim (240 Hz step, drag, lift, sidespin, bounce/roll per surface, cup capture and lip-outs, trees, the goose, and the solid ghost) |
| `js/oldtom.js` | Old Tom: a seeded brute-force planner that plays each hole in the sim to make the round-1 ghost |
| `js/characters.js` | Old Tom's ghost-golfer model (idle, swing, gloat, scare) and the hole-7 scare face |
| `js/geese.js` | goose breeds (Embden, Toulouse, Canada), the Sasquack and the boss's crown |
| `js/golfers.js` | the five player golfers: one shared rig and animator (idle, run, swing, cheer, sulk) plus title-card portraits |
| `js/trees.js` | tree and tombstone placement, plus their colliders (shared with Old Tom's planner) |
| `js/terrain.js`, `js/world.js` | meshes: terrain, water, trees, sky, flag, green-reading chevrons, graveyard, goose, club, fishing rod |
| `js/audio.js` | the WebAudio synth, with a distinct sound for each outcome |
| `js/commentator.js` | captioned commentary in three hysteria tiers; plays the pre-generated clip for a line, else falls back to speechSynthesis |
| `js/voice.js` | the rules shared by the game and the generator for turning a caption into its spoken text and clip key |
| `voice/` | the generated commentator clips (`<key>.mp3`) and `index.json` |
| `js/main.js` | the game: input, swing, camera, scope, geese and goose cam, tug-of-war, ghost race and Old Tom, angler, carry indicator, power-up wheel, flyovers, between-hole card, room interactions, HUD and flow |
| `js/room.js` | room networking: create/join, SSE with resync, an ordered retrying send queue |

A shot is simulated in full at impact and then played back. That makes the
bullet-cam, ghost replays and the aim preview exact, and it lets the ghost
collide with your ball deterministically. `window.golf` is an automation hook
used by the headless QA and fun-council playtests.

### Scores & storage (`store.go`)

Every finished round is written **append-only**, one object per round, so
concurrent players never overwrite each other. The leaderboard shows each
player's best (fewest) strokes. Rounds on the 9-hole course are stored under
`scores-3d9/`. Older rounds stay untouched under `scores/` (the 2D course),
`scores-3d/` (the 4-hole course) and `scores-3d7/` (the 7-hole course) but
are no longer read. With no bucket (local dev, `make preflight`), scores go to an
in-memory store. The healthcheck never touches S3.

Your personal-best ghost and the graveyard live in the browser's
`localStorage`.

### Rooms (`rooms.go`, `web/js/room.js`)

Every player simulates their own shots. The ball sim is deterministic, but
browsers may differ in the last bit of `Math.sin`, so the server never runs
physics.

- **Relaying shots.** At impact, the shooter sends the shot's recorded
  frames (30 Hz, centimetre integers, about 4 KB for a drive). The server
  relays them to the room, and everyone else plays them back on arrival.
- **Resyncing.** Each member's progress snapshot (hole, strokes, scores,
  resting ball) rides along with every shot and is kept by the server.
  Every SSE (re)connect starts with the full roster, so a dropped connection
  or a page reload resyncs from one message.
- **Ordering and retries.** Sends go through a one-at-a-time queue with
  per-member sequence numbers. A progress update never overtakes its shot,
  and the server ignores retries it has already seen.
- **Fairness.** A room seed gives everyone the same balls and wind. Each
  player's power-up wheel is seeded from the room seed and their id.
- **Emotes.** Reactions, Be the Goose, gimmes and Sic 'Em ride one
  `emote` message type: relayed to the room and rate-limited per member
  (burst 5, one more every 1.5 s).
- **Limits:**
  - 8 players per room and 300 rooms per server.
  - Rooms close after 30 idle minutes.
  - Like the hub, rooms live in memory. A deploy (stop-then-start) ends
    them, and clients carry on solo.

### Live social feed (`hub.go`)

When you sink a hole, the browser POSTs `/api/hole`, and everyone else who is
online gets a toast over Server-Sent Events. Nothing is stored. The hub is
per-instance, which is fine for a single Fargate task.

## API

| Method & path | Body | Returns |
| --- | --- | --- |
| `GET /` | — | the game page |
| `GET /healthz` | — | `200 ok` (never touches S3) |
| `POST /api/score` | `{ name, strokes }` | `{ allTime, today }` leaderboards |
| `GET /api/leaderboard` | — | `{ allTime, today }` |
| `POST /api/hole` | `{ id, name, hole, strokes }` | `204` (broadcast to others) |
| `POST /api/rooms` | `{ name }` | room state + `{ you, token }` (creator is host) |
| `POST /api/rooms/{code}/join` | `{ name, id?, token? }` | room state + `{ you, token }` (id/token rejoin) |
| `GET /api/rooms/{code}/events?id=&token=` | — (SSE) | `roster`, `start`, `shot`, `progress`, `emote` events |
| `POST /api/rooms/{code}/send` | `{ id, token, seq, type, … }` | `204` (`200` + `{ round, seed }` for `start`; `429` when an `emote` is over the rate limit) |
| `GET /api/events` | — (SSE) | `event: holeout` stream |

## Running locally

```sh
WEB_DIR=web go run .     # http://localhost:8080, serves web/ from disk (edit + reload)
go run .                 # serves the embedded copy, like production
make preflight           # validate manifest, build, boot + healthcheck, Trivy scan
```

`STORAGE_BUCKET` is unset locally, so scores live in memory and reset on
restart. Set `PORT` to override the listen port (default `8080`).

## Commentator voices

The commentator's lines are generated once with ElevenLabs (`eleven_v3`,
with inline emotion tags) and shipped as small MP3s in `web/voice/`.

```bash
node tools/voices/gen.mjs --dry   # how many lines are missing, characters, rough cost
node tools/voices/gen.mjs         # generate only the missing clips
```

The key is read from `ELEVENLABS_API_KEY` in `.env` (gitignored) and never
printed. The voices are set in `web/js/voice.js`: the commentator is
Nathaniel (a British live football commentator from the ElevenLabs voice
library), and Old Tom is Sean (an old Scotsman), who speaks a few lines of
his own in solo rounds and says "Fore." in the hole-7 scare. Lines that name
a ball also get a generic "the ball" clip, which plays when that ball's own
clip is missing. `--prune` deletes clips no line uses any more. Player names can't be pre-recorded, so a spoken line says
"the golfer" or "their rival" where its caption shows the name. Ball names
and Old Tom are voiced for real. Edit a line in `commentator.js` and re-run:
only that clip is regenerated. Lines without a clip fall back to the
browser's speech.

## Design records

- [design/council.md](design/council.md): how five persona designers pitched
  50 features and a five-judge council picked these five.
- [design/fun-rubric.md](design/fun-rubric.md): the Fun Expert's ten pass
  criteria that the demo is held to.

## Deploying

flightdeck handles build, scan, deploy, TLS and DNS. Push to `main` to deploy
dev, and tag `v*` to promote that exact image to prod. Always run
`make preflight` first.
