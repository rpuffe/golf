# ⛳ Golden Hour Golf

A first-person 3D golf game for the browser, played at sunset, with a live
leaderboard and real-time social toasts. It is deployed on
[flightdeck](./CLAUDE.md).

Four holes (par 16) are played from behind the ball in first person, with a
mouse swing: pull back, then push through. On top of real golf, five odd
features came out of a design council (see [design/council.md](design/council.md)):

| Feature | Borrowed from | What it does |
| --- | --- | --- |
| 🔭 **Sniper's Lie** | tactical shooters | Right-click to scope. The scope has a laser rangefinder, a wind ticker and breathing sway, and Shift holds your breath. Great shots trigger a slow-mo **bullet-cam** into the cup. |
| 👻 **Ghost Strokes** | Trackmania / Braid | You race a ghost stroke for stroke: **Old Tom**, the club pro buried by the first tee, and later your own best round. The ghost ball is **solid**, so it can collide with your ball mid-air or **stymie** your putt. |
| 🪿 **The Goose** | Untitled Goose Game | Every hole has a goose. Stop your ball near it and it steals the ball. **Goose cam** then follows it as it struts off to its own theme song, ball in beak. You get no say, and it drops the ball when the song ends (no penalty). |
| 🎙 **Whisper-to-Hysteria Commentator** | golf TV / skate-game announcers | A hushed, captioned broadcast voice that comes unglued as things go wrong. |
| 🎣 **Five Balls, One Life** | XCOM / roguelikes + Stardew fishing | You carry five named balls, each with a physics trait. Water starts a reel-in fight: snap the line and the ball dies, and its tombstone joins a persistent graveyard by the first tee. |

Also in the game:

- **👥 Rooms (live multiplayer).** Create a room, share the 4-letter code or
  link, and play the same holes at the same time with 2–8 friends. Their
  balls fly in your world as they hit, and their resting balls are solid.
- **📏 Carry, in Geese.** While you pull back, a live ring shows where the
  ball will land, in metres and in one absurd unit per hole.
- **⛳ Putting** scales the putter's stroke to the putt (3/6/10/15/21 m
  tiers), shows the flat-green roll distance, and uses a generous cup.

- **dev**: https://golf-dev.fd.robertpuffe.com (deploys on push to `main`)
- **prod**: https://golf.fd.robertpuffe.com (promoted by tagging `v*`)

## Controls

| Action | Mouse / keyboard |
| --- | --- |
| Aim / look | Click the course to capture the mouse, then move it. A/D or the arrow keys also aim, and W/S look up and down. |
| Swing | Hold left mouse, pull back (power: watch the carry ring), then push forward fast (tempo). Sideways drift on the push curves the ball. |
| Putt | Same swing. The whole pull-back covers the putter's range for this putt (on the club button), and the white ring shows the flat-green roll. |
| Easy swing | Hold Space for power and release it, then tap Space as the accuracy needle crosses the centre |
| Club | 1–4, Q/E or the scroll wheel |
| Scope / steady | Hold right mouse or Z, and hold Shift to hold your breath |
| Reel (angler) | Hold mouse or Space, and keep the needle in the green |
| Sound / voice / help | M / V / H |

Touch devices get a drag-to-aim view plus an on-screen swing pad.

## How it works

One Go binary does everything. It serves the client (`web/`, embedded at
build time) and a small JSON + SSE API. There is no framework and no
database: durable state lives in S3, and live state lives in memory.

```
browser (web/: Three.js game)
  │  POST /api/rooms, /api/rooms/{code}/join → room membership
  │  GET  /api/rooms/{code}/events → SSE: roster, start, shot, progress
  │  POST /api/rooms/{code}/send   → relay a shot / progress / start / leave
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
| `js/holes.js` | the four holes as data (tee, pin, fairway path, hills, bunkers, ponds, goose area, wind) |
| `js/course.js` | analytic terrain height and surface type, baked into 0.5 m grids for the physics |
| `js/physics.js` | the deterministic ball sim (240 Hz step, drag, lift, sidespin, bounce/roll per surface, cup capture and lip-outs, trees, the goose, and the solid ghost) |
| `js/oldtom.js` | Old Tom: a seeded brute-force planner that plays each hole in the sim to make the round-1 ghost |
| `js/terrain.js`, `js/world.js` | meshes: terrain, water, trees, sky, flag, green-reading chevrons, graveyard, goose, club, fishing rod |
| `js/audio.js` | the WebAudio synth, with a distinct sound for each outcome |
| `js/commentator.js` | captioned speechSynthesis commentary in three hysteria tiers |
| `js/main.js` | the game: input, swing, camera, scope, goose AI and goose cam, ghost race, angler, carry indicator, rooms UI, HUD and flow |
| `js/room.js` | room networking: create/join, SSE with resync, an ordered retrying send queue |

A shot is simulated in full at impact and then played back. That makes the
bullet-cam, ghost replays and the aim preview exact, and it lets the ghost
collide with your ball deterministically. `window.golf` is an automation hook
used by the headless QA and fun-council playtests.

### Scores & storage (`store.go`)

Every finished round is written **append-only**, one object per round, so
concurrent players never overwrite each other. The leaderboard shows each
player's best (fewest) strokes. 3D rounds are stored under `scores-3d/`.
Rounds from the old 2D course stay untouched under `scores/` but are no
longer read. With no bucket (local dev, `make preflight`), scores go to an
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
- **Fairness.** A room seed gives everyone the same balls and wind.
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
| `GET /api/rooms/{code}/events?id=&token=` | — (SSE) | `roster`, `start`, `shot`, `progress` events |
| `POST /api/rooms/{code}/send` | `{ id, token, seq, type, … }` | `204` (`200` + `{ round, seed }` for `start`) |
| `GET /api/events` | — (SSE) | `event: holeout` stream |

## Running locally

```sh
WEB_DIR=web go run .     # http://localhost:8080, serves web/ from disk (edit + reload)
go run .                 # serves the embedded copy, like production
make preflight           # validate manifest, build, boot + healthcheck, Trivy scan
```

`STORAGE_BUCKET` is unset locally, so scores live in memory and reset on
restart. Set `PORT` to override the listen port (default `8080`).

## Design records

- [design/council.md](design/council.md): how five persona designers pitched
  50 features and a five-judge council picked these five.
- [design/fun-rubric.md](design/fun-rubric.md): the Fun Expert's ten pass
  criteria that the demo is held to.

## Deploying

flightdeck handles build, scan, deploy, TLS and DNS. Push to `main` to deploy
dev, and tag `v*` to promote that exact image to prod. Always run
`make preflight` first.
