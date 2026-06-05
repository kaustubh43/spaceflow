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
- **2D top‑view editor** (Konva): draw walls & rooms, place catalog items,
  drag / resize / rotate, snap‑to‑grid, live dimensions, measure tool.
- **Synced 3D view** (react‑three‑fiber): walls extrude to height, furniture as
  volumes, orbit camera **and** a first‑person walkthrough (WASD).
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
- **Version snapshots** (save / restore) and **PNG / PDF export**.

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
- `app/models` – SQLAlchemy models (users, projects, floors, elements, catalog, comments, snapshots)
- `app/api/routes` – auth, projects, floors, elements, catalog, comments, reports (BOM + snapshots)
- `app/seed.py` – idempotent catalog + demo‑house seed (runs on boot via `entrypoint.sh`)

### Data model in one line
A **Project** has **Floors**; each Floor has **Elements**. An Element is a generic
placed object (`kind` + `layer` + geometry + free‑form `properties`), which keeps
the layer system fully extensible — adding a new layer is one enum entry.

## Development notes

- Both containers run with hot reload (uvicorn `--reload`, Vite HMR) and bind‑mount
  the source, so edits on the host reflect live.
- Migrations run automatically on backend start (`alembic upgrade head`).
- To add a catalog preset, edit `backend/app/seed_data.py`.
```
