# ⛳ Mini Golf

A tiny browser mini-golf game with a live leaderboard and real-time social
notifications, deployed on [flightdeck](./CLAUDE.md).

Play three hand-designed holes, drag-to-putt, and race for the fewest strokes.
Scores persist to S3, and while you play you get a toast whenever another
player currently online finishes a hole.

- **dev**: https://golf-dev.fd.robertpuffe.com (deploys on push to `main`)
- **prod**: https://golf.fd.robertpuffe.com (promoted by tagging `v*`)

## How it works

One Go binary does everything: it serves the game (a single embedded
`index.html`) and exposes a small JSON + SSE API. No framework, no database —
durable state lives in S3, live state lives in memory.

```
browser (index.html: canvas game)
  │  GET /                 → the game page
  │  POST /api/score       → save a finished round, get leaderboards back
  │  GET  /api/leaderboard → { allTime, today }
  │  POST /api/hole        → "I just finished a hole" (broadcast)
  │  GET  /api/events      → SSE stream of everyone's hole-outs
  ▼
Go server (main.go)
  ├── Store  (store.go) ── S3 when STORAGE_BUCKET is set, else in-memory
  └── Hub    (hub.go)  ──── in-memory SSE fan-out (ephemeral)
```

### The game (`index.html`)

Pure canvas, no assets. The whole thing is one file embedded into the binary
at build time (`//go:embed index.html`).

- **Course**: three holes defined as data (`HOLES` — tee, cup, and wall
  rectangles). Walls plus the outer border are axis-aligned rectangles.
- **Physics**: drag back from the ball to aim (slingshot), release to putt.
  The ball rolls with friction and bounces off walls (circle-vs-rectangle
  reflection), sub-stepped so fast shots can't tunnel through a wall. It drops
  when it reaches the cup slowly enough.
- **Flow**: enter a name → play 3 holes → a round-complete card shows your
  score vs par and the **Today** and **All-time** leaderboards.

### Scores & storage (`store.go`)

Every finished round is written **append-only** — one object (or one slice
element) per round — so concurrent players never overwrite each other. A
leaderboard is computed by reading all rounds and taking each player's best
(fewest) strokes.

- With `storage: s3` in the manifest, the platform injects `STORAGE_BUCKET`
  and rounds are stored at `scores/<YYYY-MM-DD>/<ts>-<rand>.json`.
- With no bucket (local dev, `make preflight`), it falls back to an in-memory
  store. The healthcheck never touches S3, so a slow/absent bucket can't fail
  a deploy — see [docs/contract.md](docs/contract.md).

"Today" is bucketed by UTC day.

### Live social feed (`hub.go`)

When you sink a hole the browser POSTs `/api/hole`, and the server fans that
event out over Server-Sent Events to every browser currently connected to
`/api/events`. Other players see a toast like *"Alice finished hole 2 in 3
strokes"*. Each browser has a random client id so it ignores its own events.

This is **ephemeral and in-memory** — nothing is stored, and only players
online *right now* receive events, which is exactly the "playing at the same
time" behavior we want. SSE (not websockets) because the feed is
one-directional and rides plain HTTP through the load balancer; a 25s
heartbeat keeps the stream under the ALB's 60s idle timeout.

> **Scaling note:** the hub is per-instance, so two players on *different*
> Fargate tasks wouldn't see each other. At a single task (today's setup)
> everyone shares one instance, so it works. To run multiple tasks, swap the
> in-memory hub for a shared broker (e.g. Redis pub/sub) behind the same
> `/api/events` interface — the frontend wouldn't change.

## API

| Method & path        | Body                              | Returns                          |
| -------------------- | --------------------------------- | -------------------------------- |
| `GET /`              | —                                 | the game page                    |
| `GET /healthz`       | —                                 | `200 ok` (never touches S3)      |
| `POST /api/score`    | `{ name, strokes }`               | `{ allTime, today }` leaderboards |
| `GET /api/leaderboard` | —                               | `{ allTime, today }`             |
| `POST /api/hole`     | `{ id, name, hole, strokes }`     | `204` (broadcasts to others)     |
| `GET /api/events`    | — (SSE)                           | `event: holeout` stream          |

Leaderboard rows are `{ name, strokes }`, best-per-player, ascending, top 10.

## Running locally

```sh
go run .                       # http://localhost:8080 (in-memory store)
# or the exact image CI builds + all its gates:
make preflight                 # validate manifest, build, boot + healthcheck, Trivy scan
```

`STORAGE_BUCKET` is unset locally, so scores live in memory and reset on
restart. Set `PORT` to override the listen port (default `8080`).

## Layout

| File                 | What it is                                             |
| -------------------- | ------------------------------------------------------ |
| `index.html`         | the entire game (canvas + UI), embedded into the binary |
| `main.go`            | HTTP server, routes, score validation                  |
| `store.go`           | `Store` interface + S3 and in-memory implementations   |
| `hub.go`             | SSE hub for the live social feed                        |
| `Dockerfile`         | multi-stage Go build → distroless static image         |
| `app-manifest.yaml`  | flightdeck service config (name, port, `storage: s3`)  |

## Deploying

flightdeck handles build, scan, deploy, TLS, and DNS. Push to `main` deploys
dev; tag `v*` promotes that exact image to prod. Always run `make preflight`
first — it mirrors CI's gates locally. See [CLAUDE.md](CLAUDE.md) and
[docs/pipeline.md](docs/pipeline.md).
