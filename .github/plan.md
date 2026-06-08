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

## 🔜 Next up (high value)
- **Wall thickness & auto‑join**: walls are zero‑width polylines (rendered with stroke). Give them real
  thickness, mitre joins at corners, and derive rooms from enclosed walls automatically.
- **Snap items to walls/edges** and on‑canvas dimension chains (item‑to‑item alignment guides already shipped).
- **Share links for clients** (tokenized, no account) in addition to full accounts.
- **Asset/image upload** (textures, mood boards, custom catalog thumbnails) — `uploads/` volume already exists.
- **Richer 3D models** for appliances/electrical (currently simple blocks): AC vanes, kitchen chimney,
  detailed fixtures; optional glTF model slot per catalog item.

## 🧭 Backlog / ideas
- Real‑time multi‑user editing (WebSocket/CRDT) so designer + client can co‑edit live.
- PDF export upgrade: title block, dimensioned drawings, per‑layer sheets, BOM appendix.
- Cost templates & rate cards per region; export BOM to Excel/CSV; quote vs. final tracking.
- Measurement constraints (lock wall lengths/angles), guides, ortho mode.
- Lighting simulation / day‑night toggle in 3D; furniture material picker (color + texture per item).
- Mobile/tablet‑friendly view‑only client mode.
- Templates: start a project from common layouts (1BHK/2BHK/3BHK).
- Audit log of changes; comment mentions/notifications.

## ⚠️ Known limitations (today)
- Walls are stroke‑rendered polylines in 2D (no true thickness). 3D walls now cut openings for doors/windows.
- 3D camera starts zoomed out; furniture for appliances/electrical falls back to blocks.
- Snapshot restore replaces all elements on matching floors (no per‑element merge/diff).
- Initial DB schema is built via `create_all` in migration 0001; keep new changes as explicit migrations.
- Headless WebGL needs swiftshader flags (see context.md) — affects automated 3D screenshots only.

## Conventions for contributors
- Geometry in **centimetres**; rect/point `x,y` is the **centre**. Format currency via `useMoney()`.
- Adding a layer = `LayerType` enum (backend) + `LAYERS` entry (`frontend/src/layers/config.ts`).
- Adding a catalog preset = a row in `backend/app/seed_data.py` (set `icon` to map a 3D model in `FurnitureModels.tsx`).
- Schema change = new Alembic migration. Restart the frontend container after editing `tailwind.config.js`.
- Verify with `tsc --noEmit`, curl + JWT, and (for visuals) headless‑Chrome CDP screenshots.
