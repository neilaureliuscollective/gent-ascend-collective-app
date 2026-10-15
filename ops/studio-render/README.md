# Studio renderer package

This is the deployable Design PNG/PDF raster + Film H.264 worker. It is **not commissioned**. A queue flag is not a running worker. Vercel (request-driven) cannot host the supervised poll loop.

## Exact provisioning decision (not purchased)

**One always-on Fly.io Machine** built from `ops/studio-render/Dockerfile`.

| Item | Choice | Source (2026-10-15) |
| --- | --- | --- |
| Product | Fly Machines | https://docs.fly.io/about/pricing |
| Shape | `shared-cpu-1x`, **2 GB RAM**, region `iad` | 1080p libx264 + librsvg needs more than 256 MB |
| Cost | **$12.70 / 30 days** of continuous runtime in Ashburn/Secaucus | docs.fly.io/about/pricing after 1 Oct 2026 RAM rate |
| Optional IPv4 | +$2.00 / month | same page; IPv6 is enough for worker-to-Supabase |
| Volume | none | temp render dirs are ephemeral |
| Egress | $0.02 / GB North America/Europe | same page |
| Why not Vercel | No durable polling process; function timeout cannot replace a lease/heartbeat worker | Vercel serverless / Fluid Compute is request-driven |
| Why not the founder laptop | The assignment forbids a personal machine remaining online | — |

Do **not** buy, launch, or attach a credit card from this assignment.

## What the image runs

- `scripts/studio-render-worker.mjs --supervised`
- Health `GET /health` on `STUDIO_RENDER_HEALTH_PORT` (8080)
- Concurrency 1, SIGTERM drain 25s, lease recover on idle
- FFmpeg 6.x with libx264/aac from Debian; Inter/Sora/DejaVu from the repo
- Design SVG of bundled static TTF faces is proven in the Node web runtime. Design PNG, and PDF with SVG marks, still need this FFmpeg host. The worker now claims `ai_studio_design_export_jobs` as well as Film jobs. Starting Film jobs alone does not make PNG work on Vercel.
- `/health` is 503 unless preflight rendered bundled fonts, recent queue/database contact succeeded, and `STUDIO_RENDER_IDENTITY` is set. `STUDIO_RENDER_COMMISSIONED=true` is still not readiness by itself.

## Rollback

1. Unset `STUDIO_RENDER_WORKER` and `STUDIO_RENDER_COMMISSIONED` on the web app so Film executes locally or stays queued without claiming hosted success.
2. Stop the Machine (`fly machine stop`). Do not delete credentials from Git.
3. Leave stored `ai_studio_render_jobs` rows; complete objects remain under attempt keys.

## Founder authorization still required to

- Create the Fly app / attach billing
- Set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on the Machine
- Set `STUDIO_RENDER_WORKER=true` and `STUDIO_RENDER_HEALTH_URL` on Vercel
- Set `STUDIO_RENDER_IDENTITY` to the Machine image/app/version identity
- Set `STUDIO_RENDER_COMMISSIONED=true` only after `/health` returns HTTP 200 with `status: ok`, that identity, `queue: connected`, and `film: ffmpeg-libx264-aac`
- Apply hosted migrations `20261016010000`, `20261017010000`, `20261018010000`, `20261019010000`
