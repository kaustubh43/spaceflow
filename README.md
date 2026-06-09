# iDesigner 🛋️

A web app for interior designers. Each **house is a project**: draw the floor plan
top‑down, place furniture / appliances / fixtures, organise everything into
**toggleable layers** (electrical, plumbing, lighting…), and present a synced
**3D walkthrough** to clients. Designers and clients log in with role‑based access.

Built with **React + Konva (2D) + Three.js (3D)** on the front end and
**FastAPI + PostgreSQL** on the back. Fully dockerised, with the database and
uploads stored in **repo‑local volumes** so your data survives reboots.

---

## Quick start

```bash
cp .env.example .env          # (already done if .env exists)
docker compose up --build
```

Then open:

| Service        | URL                              |
| -------------- | -------------------------------- |
| App (frontend) | http://localhost:5173            |
| API docs       | http://localhost:8000/docs       |
| Postgres       | localhost:5432                   |

A demo project is seeded automatically. Log in with:

- **Designer:** `designer@idesigner.app` / `demo1234` (full edit)
- **Client:**  `client@idesigner.app` / `demo1234` (comment + tweak client‑editable items)

> Data lives in `./data/postgres` and `./data/uploads` inside the repo. Delete the
> `./data` folder to reset everything; it is git‑ignored.

---

## Features

- **Projects (one per house)** with multiple **floors / levels**.
- **2D top‑view editor** (Konva): draw walls (with real, editable **thickness**) & rooms, place catalog items,
  drag / resize / rotate, snap‑to‑grid, alignment guides, live dimensions, measure tool.
- **Synced 3D view** (react‑three‑fiber): walls extrude to height with **hollow door/window
  openings** and recognizable furniture models; **orbit** (double‑click to focus a spot,
  zoom‑to‑cursor) **and** a first‑person **walkthrough** (pointer‑lock: click to look, WASD, ESC).
- **Auto‑save + durable undo/redo** — edits save themselves automatically, and the undo
  history (plus any unsaved changes) survives **closing and reopening** the project.
- **Dark mode** across the whole app, including the 2D canvas and the 3D view.
- **Toggleable layers** — Architecture, Furniture, Appliances, Electrical,
  Plumbing, Lighting, HVAC, Networking/Security, False Ceiling, Flooring,
  Annotations. Each can be hidden / locked.
- **Specialised editors** — electrical switchboards with per‑button info &
  circuits; plumbing fixtures; lighting wattage; HVAC capacity, etc.
- **Catalog** of ready presets (TV unit, cupboard, bed, fridge, WC, sink, AC…)
  with default dimensions and costs.
- **Bill of Materials** + cost estimate auto‑generated from placed items.
- **Collaboration** — role‑based access (owner / editor / contributor / viewer),
  comments, and items can be flagged *client‑editable*.
- **Share links** — generate a tokenized, **view‑only** link (no account needed) so clients can browse the
  2D plan and 3D walkthrough; costs are never exposed, and links can be revoked anytime.
- **Reference images / mood board** — upload images per project to keep inspiration alongside the design.
- **Version snapshots** (save / restore), **PNG export**, and a **comprehensive PDF report**
  (cover + cost summary, floor plan, a 3D angle of every room, and a grouped bill of materials).

## Roles

| Role          | Can do                                                            |
| ------------- | ----------------------------------------------------------------- |
| `owner`       | Everything, incl. managing members and deleting the project       |
| `editor`      | Full edit of the design                                           |
| `contributor` | Move / edit only items the designer flagged *client‑editable*; comment |
| `viewer`      | Read‑only + comment                                               |

## Architecture

```
backend/   FastAPI · SQLAlchemy · Alembic · JWT auth · Postgres
frontend/  React · Vite · TypeScript · Tailwind · Konva (2D) · three (3D) · Zustand · React Query
data/      repo-local Docker volumes (postgres + uploads) — git-ignored
```

### Backend layout
- `app/models` – SQLAlchemy models (users, projects, floors, elements, catalog, comments, snapshots,
  cost items, app settings, share links, assets)
- `app/api/routes` – auth, projects, floors, elements, catalog, comments, reports (BOM + snapshots),
  settings, share (authed + public view‑only), assets (image upload, served from `/uploads`)
- `app/seed.py` – idempotent catalog + demo‑house seed (runs on boot via `entrypoint.sh`)

### Data model in one line
A **Project** has **Floors**; each Floor has **Elements**. An Element is a generic
placed object (`kind` + `layer` + geometry + free‑form `properties`), which keeps
the layer system fully extensible — adding a new layer is one enum entry.

## For contributors / agents
- **[.github/context.md](.github/context.md)** — architecture, data model, conventions & gotchas (read this first).
- **[.github/plan.md](.github/plan.md)** — roadmap, known limitations, and what's next.

## Development notes

- Both containers run with hot reload (uvicorn `--reload`, Vite HMR) and bind‑mount
  the source, so edits on the host reflect live.
- Migrations run automatically on backend start (`alembic upgrade head`).
- To add a catalog preset, edit `backend/app/seed_data.py`.
```
