import { Suspense, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { FirstPersonControls, Grid, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useEditor } from "@/store/editor";
import { useCatalog } from "@/api/hooks";
import type { ElementModel, Floor } from "@/types";
import { layerColor } from "@/layers/config";
import { plasterTexture, woodFloorTexture } from "./textures";
import {
  CEILING_MODELS,
  FurnitureModel,
  WALL_MODELS,
} from "./FurnitureModels";
import { Eye, Orbit } from "lucide-react";

// catalog icon -> furniture model key
const ICON_MODEL: Record<string, string> = {
  sofa: "sofa", chair: "chair", table: "table", bed: "bed", desk: "desk",
  shelf: "cabinet", wardrobe: "cabinet", counter: "counter", tv: "tv",
  fridge: "fridge", washer: "appliance_round", dishwasher: "appliance_round",
  wc: "wc", basin: "basin", shower: "shower", sink: "sink",
  light: "ceiling_light", spot: "ceiling_light", pendant: "pendant",
  ac: "ac", fan: "fan",
};
const KIND_MODEL: Record<string, string> = {
  light: "ceiling_light",
  hvac_unit: "ac",
  door: "door",
  window: "window",
};

const M = 0.01; // cm -> metres

interface Props {
  floor: Floor;
}

function Walls({ floor, els }: { floor: Floor; els: ElementModel[] }) {
  const defaultH = floor.wall_height_cm * M;
  const wallTex = useMemo(() => plasterTexture(), []);
  const THICK = 0.12;
  const CAP = 0.06; // small overlap to fill corner joins

  const boxes = useMemo(() => {
    // openings (doors/windows) in metres, to be cut out of wall runs
    const openings = els
      .filter((e) => e.kind === "door" || e.kind === "window")
      .map((e) => {
        const sill = e.kind === "window" ? Number(e.properties?.sill_cm ?? 90) * M : 0;
        return {
          x: e.x * M,
          z: e.y * M,
          w: e.width_cm * M,
          isDoor: e.kind === "door",
          sill,
          top: sill + e.height_cm * M, // door: height from floor; window: sill+height
        };
      });

    const out: { pos: [number, number, number]; rot: number; len: number; h: number }[] = [];

    const pushBox = (
      ax: number, az: number, ux: number, uz: number, rot: number, H: number,
      a: number, b: number, yb: number, yt: number, L: number
    ) => {
      let a2 = a <= 0.001 ? a - CAP : a;
      let b2 = b >= L - 0.001 ? b + CAP : b;
      const len = b2 - a2;
      const h = yt - yb;
      if (len < 0.02 || h < 0.02) return;
      const mid = (a2 + b2) / 2;
      out.push({
        pos: [ax + ux * mid, (yb + yt) / 2, az + uz * mid],
        rot,
        len,
        h,
      });
    };

    const addRun = (p: number[], H: number, closed: boolean, cut: boolean) => {
      const count = closed ? p.length : p.length - 2;
      for (let i = 0; i < count; i += 2) {
        const ax = p[i] * M, az = p[i + 1] * M;
        const bx = p[(i + 2) % p.length] * M, bz = p[(i + 3) % p.length] * M;
        const L = Math.hypot(bx - ax, bz - az);
        if (L < 0.01) continue;
        const ux = (bx - ax) / L, uz = (bz - az) / L;
        const rot = Math.atan2(bz - az, bx - ax);

        // openings that lie on this segment
        const ons = cut
          ? openings
              .map((o) => {
                const dx = o.x - ax, dz = o.z - az;
                const t = dx * ux + dz * uz;
                const perp = Math.abs(dx * -uz + dz * ux);
                return { o, t, perp };
              })
              .filter((r) => r.perp <= 0.35 && r.t >= -r.o.w / 2 && r.t <= L + r.o.w / 2)
              .map((r) => ({
                o: r.o,
                t0: Math.max(0, r.t - r.o.w / 2),
                t1: Math.min(L, r.t + r.o.w / 2),
              }))
              .sort((m, n) => m.t0 - n.t0)
          : [];

        if (ons.length === 0) {
          pushBox(ax, az, ux, uz, rot, H, 0, L, 0, H, L);
          continue;
        }
        let cursor = 0;
        for (const op of ons) {
          if (op.t0 > cursor) pushBox(ax, az, ux, uz, rot, H, cursor, op.t0, 0, H, L); // solid before
          if (op.o.isDoor) {
            pushBox(ax, az, ux, uz, rot, H, op.t0, op.t1, Math.min(op.o.top, H), H, L); // lintel
          } else {
            pushBox(ax, az, ux, uz, rot, H, op.t0, op.t1, 0, op.o.sill, L); // sill wall
            pushBox(ax, az, ux, uz, rot, H, op.t0, op.t1, Math.min(op.o.top, H), H, L); // header
          }
          cursor = Math.max(cursor, op.t1);
        }
        if (cursor < L) pushBox(ax, az, ux, uz, rot, H, cursor, L, 0, H, L); // solid after
      }
    };

    for (const el of els) {
      if (!el.points) continue;
      const custom = Number(el.properties?.wall_height ?? 0);
      if (el.kind === "wall") {
        addRun(el.points, custom > 0 ? custom * M : defaultH, false, true);
      } else if (el.kind === "room" && custom > 0) {
        addRun(el.points, custom * M, true, false); // balcony railing, not cut
      }
    }
    return out;
  }, [els, defaultH]);

  return (
    <>
      {boxes.map((s, i) => (
        <mesh key={i} position={s.pos} rotation={[0, -s.rot, 0]} castShadow receiveShadow>
          <boxGeometry args={[s.len, s.h, THICK]} />
          <meshStandardMaterial map={wallTex} roughness={0.92} metalness={0} color="#f4f5f7" />
        </mesh>
      ))}
    </>
  );
}

function Items({
  els,
  iconOf,
  ceilingY,
}: {
  els: ElementModel[];
  iconOf: (el: ElementModel) => string;
  ceilingY: number;
}) {
  return (
    <>
      {els.map((el) => {
        if (["wall", "room", "plumbing_line", "annotation"].includes(el.kind))
          return null;
        const w = el.width_cm * M;
        const d = el.depth_cm * M;
        const hh = Math.max(el.height_cm * M, 0.05);
        const model =
          ICON_MODEL[iconOf(el)] || KIND_MODEL[el.kind] || "box";
        const color = el.color || layerColor(el.layer);

        // vertical placement: ceiling-mounted, wall-mounted, sill, or on the floor
        let y = 0;
        if (CEILING_MODELS.has(model)) y = ceilingY - 0.05;
        else if (WALL_MODELS.has(model)) y = ceilingY * 0.78;
        else if (model === "window") y = Number(el.properties?.sill_cm ?? 90) * M;

        return (
          <group
            key={el.id}
            position={[el.x * M, y, el.y * M]}
            rotation={[0, -(el.rotation_deg * Math.PI) / 180, 0]}
          >
            <FurnitureModel
              model={model}
              w={w}
              d={d}
              h={hh}
              color={color}
              angle={Number(el.properties?.open_angle ?? 90)}
              swing={el.properties?.swing ?? "left"}
            />
          </group>
        );
      })}
    </>
  );
}

export function Scene3D({ floor }: Props) {
  const { elements, order, visibleLayers } = useEditor();
  const { data: catalog } = useCatalog();
  const [mode, setMode] = useState<"orbit" | "walk">("orbit");
  const floorTex = useMemo(() => woodFloorTexture(), []);

  const iconMap = useMemo(() => {
    const m: Record<number, string> = {};
    for (const c of catalog || []) m[c.id] = c.icon || "";
    return m;
  }, [catalog]);
  const iconOf = (el: ElementModel) =>
    el.catalog_item_id ? iconMap[el.catalog_item_id] || "" : "";

  const els = order
    .map((id) => elements[id])
    .filter((e) => e && visibleLayers.has(e.layer));

  const fw = floor.width_cm * M;
  const fh = floor.height_cm * M;
  const ceilingY = floor.wall_height_cm * M;
  const center: [number, number] = [fw / 2, fh / 2];

  useMemo(() => {
    floorTex.repeat.set(Math.max(2, fw / 1.2), Math.max(2, fh / 1.2));
  }, [floorTex, fw, fh]);

  return (
    <div className="relative h-full w-full bg-gradient-to-b from-slate-200 to-slate-400">
      <Canvas shadows camera={{ position: [fw / 2, 6, fh + 4], fov: 55 }}>
        {/* self-contained lighting — no external HDR dependency, works offline */}
        <ambientLight intensity={0.75} />
        <hemisphereLight args={["#ffffff", "#b9c2cf", 0.6]} />
        <directionalLight
          position={[fw, 12, fh]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <directionalLight position={[-fw, 8, -fh]} intensity={0.4} />

        <Suspense fallback={null}>
          <group position={[-center[0], 0, -center[1]]}>
            {/* floor slab */}
            <mesh
              position={[fw / 2, -0.02, fh / 2]}
              rotation={[-Math.PI / 2, 0, 0]}
              receiveShadow
            >
              <planeGeometry args={[fw, fh]} />
              <meshStandardMaterial
                map={floorTex}
                roughness={0.7}
                side={THREE.DoubleSide}
              />
            </mesh>
            <Walls floor={floor} els={els} />
            <Items els={els} iconOf={iconOf} ceilingY={ceilingY} />
          </group>
        </Suspense>

        <Grid
          args={[40, 40]}
          cellSize={1}
          cellColor="#cbd5e1"
          sectionColor="#94a3b8"
          position={[0, -0.03, 0]}
          infiniteGrid
          fadeDistance={40}
        />

        {mode === "orbit" ? (
          <OrbitControls makeDefault target={[0, 1, 0]} maxPolarAngle={Math.PI / 2.05} />
        ) : (
          <FirstPersonControls
            lookSpeed={0.1}
            movementSpeed={5}
            heightMin={1.5}
            heightMax={1.5}
          />
        )}
      </Canvas>

      <div className="absolute left-3 top-3 flex gap-1 rounded-lg bg-white/90 p-1 shadow backdrop-blur">
        <button
          className={`btn px-2 py-1 ${mode === "orbit" ? "bg-brand-600 text-white" : "text-ink-600"}`}
          onClick={() => setMode("orbit")}
        >
          <Orbit className="h-4 w-4" /> Orbit
        </button>
        <button
          className={`btn px-2 py-1 ${mode === "walk" ? "bg-brand-600 text-white" : "text-ink-600"}`}
          onClick={() => setMode("walk")}
        >
          <Eye className="h-4 w-4" /> Walkthrough
        </button>
      </div>
      {mode === "walk" && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded bg-white/90 px-3 py-1 text-xs text-ink-600 shadow">
          Move with W/A/S/D · look with mouse
        </div>
      )}
    </div>
  );
}
