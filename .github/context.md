# iDesigner — Agent Context

Onboarding for AI agents / new devs. Read this before diving into the code; it captures
the architecture, conventions, and gotchas that aren't obvious from any single file.

## What this is
A web app for interior designers. **One house = one project.** Designers draw a top‑down
floor plan, place furniture/appliances/fixtures, organise them into **toggleable layers**,
and present a synced **3D walkthrough** to clients. Designers and clients log in with
role‑based access.

## Run it
```bash
cp .env.example .env        # first time only
docker compose up --build
```
- App: http://localhost:5173 · API + docs: http://localhost:8000/docs · Postgres: 5432
- Demo logins: `designer@idesigner.app` / `demo1234` (full edit), `client@idesigner.app` / `demo1234` (contributor).
- Data persists in repo‑local volumes: `./data/postgres`, `./data/uploads` (git‑ignored). Delete `./data` to hard‑reset.
- Both services hot‑reload (uvicorn `--reload`, Vite HMR) via bind mounts.

## Stack
| | |
|---|---|
| Backend | FastAPI · SQLAlchemy 2.0 · Alembic · PostgreSQL 16 · JWT (python‑jose) · passlib/bcrypt |
| Frontend | React 18 + TypeScript + Vite · TailwindCSS (darkMode: "class") · Zustand · TanStack Query · axios |
| 2D editor | **react‑konva** (HTML canvas) | 
| 3D view | **three.js** via **@react‑three/fiber** + **drei** |

## Repo layout
```
backend/
  app/
    core/        config.py (pydantic-settings), security.py (JWT + bcrypt)
    db/          base.py (Base + TimestampMixin), session.py (engine, get_db)
    models/      user, project (+ProjectMembership), floor, element, catalog,
                 collaboration (Comment, Snapshot), cost (CostItem), settings (AppSettings), enums
    schemas/     pydantic request/response models
    api/
      deps.py    get_current_user, require_project_role(min_role) dependency factory
      routes/    auth, projects, floors, elements, catalog, comments, reports, settings
    seed.py      idempotent demo seed (catalog + sample house); seed_data.py = CATALOG presets
  alembic/versions/  0001_initial (create_all), 0002_cost_existing, 0003_app_settings
  entrypoint.sh  alembic upgrade head → python -m app.seed → uvicorn
frontend/
  src/
    lib/         api.ts (axios + JWT refresh), units.ts (formatting, polygonArea)
    store/       auth.ts, editor.ts (the editor brain), settings.ts (app settings + theme + useMoney)
    api/hooks.ts TanStack Query hooks for every endpoint
    layers/config.ts   LAYERS list (the layer system source of truth)
    editor2d/    Canvas2D.tsx (Konva stage), ElementShape.tsx, stageHandle.ts (PNG/PDF export)
    view3d/      Scene3D.tsx, FurnitureModels.tsx (parametric models), textures.ts
    panels/      LayerPanel, CatalogPanel, PropertiesPanel, CommentsPanel, Modals (BOM/Floor/Admin/Members/Snapshots)
    pages/       Login, Register, Dashboard, ProjectEditor (assembles everything)
    components/  Tooltip, ErrorBoundary
```

## Data model (the important part)
- **Project** → has many **Floor** → has many **Element**. A Project also has **ProjectMembership**
  (user↔role), **CostItem** (manual BOM lines), **Snapshot** (version history). **Comment** hangs off a Floor/Element.
- **Element is the generic unit** of everything on a plan, distinguished by `kind` + `layer`:
  - `kind`: wall, room, door, window, item, switchboard, electrical_point, plumbing_line,
    plumbing_fixture, light, hvac_unit, network_point, annotation.
  - **Geometry (all in centimetres):**
    - Rect/point items use `x, y` = **CENTRE of the footprint**, `width_cm` × `depth_cm`, `height_cm`, `rotation_deg`.
    - Polyline/polygon items (wall, room, plumbing_line) use `points` = flat `[x1,y1,x2,y2,…]`. `x/y` ignored.
  - `properties` (JSONB) holds kind‑specific data: switchboard `buttons[]`+`circuit`, door `open_angle`+`swing`,
    window `sill_cm`, wall/room `wall_height` (3D), appliance `power_w`, etc.
  - `is_existing` (client already owns it → shown but **not charged** in BOM), `unit_cost_override`,
    `catalog_item_id`, `client_editable`.
- **CatalogItem**: reusable preset (name, category, layer, kind, default dims, color, **icon**, unit_cost).
  The `icon` string maps to a 3D model (see below). Edit presets in `backend/app/seed_data.py`.
- **AppSettings**: single row (id=1) — app name, currency (code/symbol/locale), default units, accent. Designer‑only edit.

## Roles & permissions
`MembershipRole` rank: viewer < contributor < editor < owner (see `api/deps.py ROLE_RANK`).
- viewer: read + comment · contributor: edit only `client_editable` elements (can't add/delete) ·
  editor: full edit · owner: + manage members + delete project.
- Enforced by `require_project_role(min_role)` dep; element‑level contributor checks live in `routes/elements.py`.

## Key API endpoints (prefix `/api`)
- `auth/`: register, login, login‑form (OAuth2 for Swagger), refresh, me
- `projects/` CRUD + `/{id}/members` · `projects/{id}/floors/` CRUD
- `projects/{id}/floors/{fid}/elements/` CRUD + **`/bulk`** (editor saves all changes in one call)
- `catalog/` (read) · `.../comments/` CRUD
- `projects/{id}/bom` (grouped report) · `bom/item-override` (set cost/existing for all elements of a catalog item) ·
  `cost-items/` CRUD (manual BOM lines) · `snapshots/` (+ `/restore`) · `settings` (GET/PUT)

## Frontend editor architecture
- **`store/editor.ts` is the brain.** Holds `elements` map + `order`, `dirty`/`deletes` sets, selection,
  `visibleLayers`/`lockedLayers`, current `tool`, `view` (2d/3d), and **undo/redo** (`past`/`future`
  history with coalesced edits — see `recordHistory`). `save()` diffs dirty/deletes → `/elements/bulk`.
  Unsaved elements get **negative temp ids**.
- **Canvas2D**: world units = cm; a scaled Konva layer is the "camera" (pan/zoom in component state).
  `snapWorld()` snaps to nearby wall/room vertices then the grid. Drawing walls/rooms uses a draft array,
  finished via Enter / double‑click / clicking the first point / the floating Finish button. Selected
  wall/room shows **draggable vertex handles**.
- **Scene3D**: extrudes walls (per‑element `properties.wall_height`, else `floor.wall_height_cm`); a room
  with `wall_height` becomes a railing (balconies). Items render via **FurnitureModels** — parametric
  primitives chosen by `ICON_MODEL[catalogIcon]` → `KIND_MODEL[kind]` → box fallback. Doors render open
  (`open_angle`/`swing`), windows at `sill_cm`. Wrapped in an **ErrorBoundary** (WebGL may be unavailable).
- **Layers**: `layers/config.ts` `LAYERS` is the single source. Adding a layer = add to `LayerType`
  enum (backend) + a `LAYERS` entry (frontend). Everything else is data‑driven.
- **Money**: always format via `useMoney()` (respects configured currency); never hardcode ₹/$.

## Conventions & gotchas
- **x/y are element centres in cm.** Don't assume top‑left.
- **Tailwind config changes require a frontend container restart** (HMR won't reload `tailwind.config.js`/PostCSS).
  Using a Tailwind class whose color shade isn't defined makes `index.css` 500 and **blanks the whole app** — define shades in the config.
- **Initial migration uses `Base.metadata.create_all`**; subsequent schema changes get an explicit Alembic migration.
- **bcrypt is pinned `<4.1`** so passlib can read its version (avoids a noisy boot traceback).
- **Seed is idempotent** (guards on project name). To refresh the demo: delete the `Sample 2BHK Apartment`
  project (DB cascade clears its rows) then `docker compose exec backend python -m app.seed`.
- Don't touch user‑created projects when reseeding (the demo is matched by name only).

## How to verify changes
1. `docker compose exec frontend npx tsc --noEmit` — typecheck (Vite doesn't typecheck at runtime).
2. Hit the API with curl + a demo JWT for backend changes.
3. For UI/visual proof, drive headless Chrome over CDP. **WebGL (3D) needs software rendering** in headless:
   launch with `--headless=new --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --remote-debugging-port=9222`,
   then inject tokens into `localStorage` (`idesigner_access`/`idesigner_refresh`) and screenshot.
