# iDesigner — Roadmap & Future Plans

Living document of what's done, what's next, and known limitations. Update it as work lands.
For architecture/onboarding see [`.github/context.md`](.github/context.md).

## ✅ Shipped
- Projects (one per house), multi‑floor, JWT auth, role‑based access (owner/editor/contributor/viewer).
- 2D top‑view editor: draw/edit walls & rooms, place catalog items, drag/resize/rotate, snap to grid & corners,
  measure tool, live dimensions, vertex (corner) editing, undo/redo.
- Door & window tools; doors render **open** in 3D (configurable angle); windows at sill height.
- 11 toggleable layers (architecture, furniture, appliances, electrical, plumbing, lighting, HVAC,
  networking, false ceiling, flooring, annotations) with per‑layer hide/lock.
- Specialised editors: electrical switchboard buttons/circuits, plumbing, lighting, HVAC, etc.
- Synced 3D walkthrough with **recognizable furniture models** (not boxes), plaster walls + wood floor,
  orbit + first‑person modes; room‑height → balcony railings.
- Bill of Materials: auto from placed items + manual lines (civil work, labour…), **grouped by category
  with subtotals**, add catalog items without drawing, per‑item cost override, **existing items not charged**.
- Collaboration: comments, snapshots (version history), client‑editable flag.
- Admin settings (app name, currency, default units), dark mode, PNG/PDF export, tooltips.
- Dockerised with repo‑local persistence; idempotent demo seed.
- **Hollow door/window openings** cut into 3D walls (lintels over doors, sill+header for windows).
- **Smart alignment guides**: dragging an item snaps its centre to other items / floor centre with on‑canvas guides.
- **Tests + CI**: backend pytest suite + GitHub Actions (backend tests + frontend build).
- **3D camera UX**: orbit **double‑click‑to‑focus** (pivot jumps to the clicked point) + zoom‑to‑cursor; walkthrough now uses **pointer‑lock** (click to look, WASD to walk, ESC to release) — no more mouse drift.
- **Comprehensive PDF report**: cover + cost summary cards, cropped floor plan, **3D angles of every room** (rendered off‑screen), and a **grouped bill of materials** (per‑category subtotals, project total, existing‑items section). Rupee‑safe text.
- **Dark‑mode canvas + 3D**: dark floor sheet/backdrop + lifted (light) wall/structural colours and grid; furniture colours preserved; 3D view follows the theme with walls kept light.
- **Auto‑save + durable undo**: edits auto‑save (debounced) to the server; save now diffs against a server **baseline** (creates/updates/deletes), so every action — including undoing a *creation* — reconciles correctly. Undo history + unsaved edits persist to `localStorage` per floor and are **restored on reopen** (guarded by a baseline match); the bulk endpoint returns a temp→real `id_map` so history stays valid across saves.
- **Wall thickness**: walls carry `properties.thickness_cm` (default 11.5cm) and render at **true scale** in 2D
  (cm‑scaled Konva stroke, mitre joins) and 3D (per‑wall extruded depth), with an editable thickness control in
  the Properties panel. (Auto‑deriving rooms from enclosed wall loops is tracked in the backlog.)
- **Richer 3D models**: parametric models for microwave, geyser, switchboard, socket, distribution board, CCTV,
  router, ceiling speaker, exhaust fan, and wall sconce (previously plain blocks / wrong model). Wall‑mounted
  fixtures sit at realistic heights via a per‑model `WALL_MODEL_Y` map (socket low, switchboard mid, CCTV high).
- **Snap items to walls**: dragging a furniture/fixture item near a wall snaps it **flush** against the wall face
  (offset = wall thickness/2 + the item's half‑extent projected onto the wall normal, so rotated items still sit
  flush), with the snapped wall highlighted; falls back to centre‑alignment guides when no wall is near.
- **Share links for clients** (tokenized, view‑only, no account): `ShareLink` model + migration 0004; authed
  create/list/revoke under `/projects/{id}/share`; **public** `/shared/{token}` endpoints (project meta + floors +
  elements, scoped to the token, **no costs**); `/catalog` made public so the viewer resolves 3D models. A
  **Share** button opens a modal to generate/copy/revoke links; a public `/shared/:token` route renders a
  read‑only `SharedView` (2D + 3D, layer toggles, floor switcher) with no editing. Revoked/invalid → friendly 404.
- **Asset / image upload** (reference images / mood board): `Asset` model + migration 0005; `POST/GET/DELETE
  /projects/{id}/assets` (multipart, images ≤10 MB, uuid filenames); files served by a **StaticFiles mount at
  `/uploads`**. An **Assets** modal (thumbnail grid, multi‑upload, delete) opens from a header button.

## 🚀 Production readiness
Current state: **feature‑complete MVP, ready for demos / pilots / internal single‑tenant use — not yet hardened for a public production launch.** The gaps below are deployment & security hardening, not application features. Estimated ~1–2 focused days.

### 🔴 Blockers (must fix before any public deployment)
- **Everything runs in dev mode.**
  - Frontend `Dockerfile` runs `npm run dev` (Vite dev server, HMR, bind‑mounted source). Prod needs `vite build` → static bundle served by nginx/Caddy.
  - Backend `entrypoint.sh` runs `uvicorn --reload` (single worker, hot‑reload, `./backend:/app` bind mount). Prod needs gunicorn/uvicorn with multiple workers, no reload, and code baked into the image (no source volume).
- **Insecure secret defaults with no enforcement.** `core/config.py` defaults `SECRET_KEY="change-me-to-a-long-random-string"` and the DB password to `idesigner_dev_password`; nothing fails if they aren't overridden → a deploy can ship with a publicly‑known JWT signing key (token forgery → account takeover). Must hard‑error on startup if the secret is still the default.
- **Demo seed defaults to ON in prod.** `SEED_DEMO=true` is the default, creating known accounts (`designer@idesigner.app`/`demo1234`, `client@…`). Should default off and be explicit opt‑in.
- **CORS hardcoded to localhost.** `CORS_ORIGINS` only lists `localhost:5173`; must be env‑driven for a real domain.
- **No TLS, and Postgres is exposed.** All ports are plain HTTP; `5432` is published to the host in `docker-compose.yml`. Prod needs HTTPS termination and the DB not publicly exposed.

### 🟡 Should‑fix before real users
- **No login rate‑limiting / brute‑force protection** on the auth endpoints.
- **Refresh‑token lifecycle** — verify rotation/revocation rather than a single long‑lived token.
- **Uploads on a local disk volume**, served by the app — uuid filenames are unguessable (good), but no size/disk quota story and no object storage (S3) for horizontal scaling.
- **No error tracking / structured logging / metrics** (Sentry, request logs). `/api/health` exists (good start).
- **No DB backup strategy** — the repo‑local `./data/postgres` volume is convenient for dev, not a backup plan.
- **Thin test coverage** — 17 backend tests + a frontend build check, no e2e.

### 🟢 Already solid
- Clean architecture, role‑based auth, explicit Alembic migrations, JWT, full 2D/3D/PDF/share/assets feature set, dark mode, auto‑save with durable undo, CI on each push. The *application* is in good shape.

### Suggested first slice
Production compose + Dockerfiles + fail‑closed config (blockers 1–4): multi‑stage frontend build behind a reverse proxy, a non‑reload backend image, and fail‑closed secret/CORS/seed config, then TLS and rate‑limiting.

## 🔜 Next up (high value)
- On‑canvas **dimension chains** (item‑to‑item / item‑to‑wall clearance measurements while editing).
- Optional **glTF model slot** per catalog item (load real meshes for hero pieces).
- Use uploaded **assets as textures / custom catalog thumbnails** (upload + storage already shipped).

## 🧭 Backlog / ideas
- **Auto‑derive rooms** from enclosed wall loops (detect cycles in the wall graph, fill as room polygons).
- Real‑time multi‑user editing (WebSocket/CRDT) so designer + client can co‑edit live.
- PDF export upgrade: title block, dimensioned drawings, per‑layer sheets, BOM appendix.
- Cost templates & rate cards per region; export BOM to Excel/CSV; quote vs. final tracking.
- Measurement constraints (lock wall lengths/angles), guides, ortho mode.
- Lighting simulation / day‑night toggle in 3D; furniture material picker (color + texture per item).
- Mobile/tablet‑friendly view‑only client mode.
- Templates: start a project from common layouts (1BHK/2BHK/3BHK).
- Audit log of changes; comment mentions/notifications.

## ⚠️ Known limitations (today)
- Walls render at real thickness now, but rooms are **not auto‑derived** from enclosed wall loops (draw rooms separately). 3D walls cut openings for doors/windows.
- 3D models are parametric primitives (no glTF yet); a catalog item with an unmapped icon still falls back to a block.
- Snapshot restore replaces all elements on matching floors (no per‑element merge/diff).
- Initial DB schema is built via `create_all` in migration 0001; keep new changes as explicit migrations.
- Headless WebGL needs swiftshader flags (see context.md) — affects automated 3D screenshots only.

## Conventions for contributors
- Geometry in **centimetres**; rect/point `x,y` is the **centre**. Format currency via `useMoney()`.
- Adding a layer = `LayerType` enum (backend) + `LAYERS` entry (`frontend/src/layers/config.ts`).
- Adding a catalog preset = a row in `backend/app/seed_data.py` (set `icon` to map a 3D model in `FurnitureModels.tsx`).
- Schema change = new Alembic migration. Restart the frontend container after editing `tailwind.config.js`.
- Verify with `tsc --noEmit`, curl + JWT, and (for visuals) headless‑Chrome CDP screenshots.
