import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Grid, OrbitControls, PointerLockControls } from "@react-three/drei";
import * as THREE from "three";
import { useEditor } from "@/store/editor";
import { useSettings } from "@/store/settings";
import { useCatalog } from "@/api/hooks";
import type { ElementModel, Floor } from "@/types";
import { layerColor } from "@/layers/config";
import { plasterTexture, woodFloorTexture } from "./textures";
import { DEFAULT_WALL_THICKNESS_CM } from "@/lib/units";
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

export const M = 0.01; // cm -> metres

interface Props {
  floor: Floor;
}

// build a catalog-icon resolver from catalog rows
export function makeIconOf(catalog: { id: number; icon?: string | null }[] | undefined) {
  const map: Record<number, string> = {};
  for (const c of catalog || []) map[c.id] = c.icon || "";
  return (el: ElementModel) =>
    el.catalog_item_id ? map[el.catalog_item_id] || "" : "";
}

export function Walls({ floor, els }: { floor: Floor; els: ElementModel[] }) {
  const defaultH = floor.wall_height_cm * M;
  const wallTex = useMemo(() => plasterTexture(), []);
  const RAILING_THICK = 0.05; // balcony railing (room with wall_height) is thin

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

    const out: {
      pos: [number, number, number];
      rot: number;
      len: number;
      h: number;
      thick: number;
    }[] = [];

    const pushBox = (
      ax: number, az: number, ux: number, uz: number, rot: number, H: number,
      a: number, b: number, yb: number, yt: number, L: number, thick: number
    ) => {
      const cap = thick / 2; // extend by half-thickness to fill corner joins
      let a2 = a <= 0.001 ? a - cap : a;
      let b2 = b >= L - 0.001 ? b + cap : b;
      const len = b2 - a2;
      const h = yt - yb;
      if (len < 0.02 || h < 0.02) return;
      const mid = (a2 + b2) / 2;
      out.push({
        pos: [ax + ux * mid, (yb + yt) / 2, az + uz * mid],
        rot,
        len,
        h,
        thick,
      });
    };

    const addRun = (p: number[], H: number, closed: boolean, cut: boolean, thick: number) => {
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
          pushBox(ax, az, ux, uz, rot, H, 0, L, 0, H, L, thick);
          continue;
        }
        let cursor = 0;
        for (const op of ons) {
          if (op.t0 > cursor) pushBox(ax, az, ux, uz, rot, H, cursor, op.t0, 0, H, L, thick); // solid before
          if (op.o.isDoor) {
            pushBox(ax, az, ux, uz, rot, H, op.t0, op.t1, Math.min(op.o.top, H), H, L, thick); // lintel
          } else {
            pushBox(ax, az, ux, uz, rot, H, op.t0, op.t1, 0, op.o.sill, L, thick); // sill wall
            pushBox(ax, az, ux, uz, rot, H, op.t0, op.t1, Math.min(op.o.top, H), H, L, thick); // header
          }
          cursor = Math.max(cursor, op.t1);
        }
        if (cursor < L) pushBox(ax, az, ux, uz, rot, H, cursor, L, 0, H, L, thick); // solid after
      }
    };

    for (const el of els) {
      if (!el.points) continue;
      const custom = Number(el.properties?.wall_height ?? 0);
      if (el.kind === "wall") {
        const thick = Number(el.properties?.thickness_cm ?? DEFAULT_WALL_THICKNESS_CM) * M;
        addRun(el.points, custom > 0 ? custom * M : defaultH, false, true, thick);
      } else if (el.kind === "room" && custom > 0) {
        addRun(el.points, custom * M, true, false, RAILING_THICK); // balcony railing, not cut
      }
    }
    return out;
  }, [els, defaultH]);

  return (
    <>
      {boxes.map((s, i) => (
        <mesh key={i} position={s.pos} rotation={[0, -s.rot, 0]} castShadow receiveShadow>
          <boxGeometry args={[s.len, s.h, s.thick]} />
          <meshStandardMaterial map={wallTex} roughness={0.92} metalness={0} color="#f4f5f7" />
        </mesh>
      ))}
    </>
  );
}

export function Items({
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

// Orbit with double-click-to-focus: the pivot smoothly moves to whatever point
// you double-click (a wall corner, a piece of furniture), so you're no longer
// stuck orbiting the centre of the plan. Wheel zooms toward the cursor.
function FocusOrbitControls() {
  const { camera, gl, scene } = useThree();
  const controls = useRef<any>(null);
  const desired = useRef<THREE.Vector3 | null>(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);

  useEffect(() => {
    const dom = gl.domElement;
    const onDbl = (e: MouseEvent) => {
      const rect = dom.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(scene.children, true);
      if (hits.length) desired.current = hits[0].point.clone();
    };
    dom.addEventListener("dblclick", onDbl);
    return () => dom.removeEventListener("dblclick", onDbl);
  }, [camera, gl, scene, raycaster]);

  useFrame(() => {
    const c = controls.current;
    if (desired.current && c) {
      c.target.lerp(desired.current, 0.18);
      if (c.target.distanceTo(desired.current) < 0.01) desired.current = null;
      c.update();
    }
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={[0, 1, 0]}
      zoomToCursor
      screenSpacePanning
      panSpeed={0.9}
      minDistance={0.8}
      maxDistance={80}
      maxPolarAngle={Math.PI / 2.05}
    />
  );
}

// First-person walkthrough: pointer-lock so the view only turns when you
// actively move the mouse (no continuous drift). WASD / arrows to walk; ESC to
// release the pointer. Eye height stays locked.
function Walkthrough({ eyeY = 1.6 }: { eyeY?: number }) {
  const { camera } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const dir = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    camera.position.y = eyeY;
    const down = (e: KeyboardEvent) => (keys.current[e.code] = true);
    const up = (e: KeyboardEvent) => (keys.current[e.code] = false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      keys.current = {};
    };
  }, [camera, eyeY]);

  useFrame((_, delta) => {
    const speed = 3.5 * delta;
    camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    right.crossVectors(dir, camera.up).normalize();
    const k = keys.current;
    if (k["KeyW"] || k["ArrowUp"]) camera.position.addScaledVector(dir, speed);
    if (k["KeyS"] || k["ArrowDown"]) camera.position.addScaledVector(dir, -speed);
    if (k["KeyA"] || k["ArrowLeft"]) camera.position.addScaledVector(right, -speed);
    if (k["KeyD"] || k["ArrowRight"]) camera.position.addScaledVector(right, speed);
    camera.position.y = eyeY; // stay at eye level
  });

  return <PointerLockControls />;
}

// Lights + floor slab + walls + items, centred on the world origin. Shared by
// the live 3D view and the off-screen PDF report renderer so they stay in sync.
export function FloorScene({
  floor,
  els,
  iconOf,
}: {
  floor: Floor;
  els: ElementModel[];
  iconOf: (el: ElementModel) => string;
}) {
  const floorTex = useMemo(() => woodFloorTexture(), []);
  const fw = floor.width_cm * M;
  const fh = floor.height_cm * M;
  const ceilingY = floor.wall_height_cm * M;
  const center: [number, number] = [fw / 2, fh / 2];

  useMemo(() => {
    floorTex.repeat.set(Math.max(2, fw / 1.2), Math.max(2, fh / 1.2));
  }, [floorTex, fw, fh]);

  return (
    <>
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
            <meshStandardMaterial map={floorTex} roughness={0.7} side={THREE.DoubleSide} />
          </mesh>
          <Walls floor={floor} els={els} />
          <Items els={els} iconOf={iconOf} ceilingY={ceilingY} />
        </group>
      </Suspense>
    </>
  );
}

export function Scene3D({ floor }: Props) {
  const { elements, order, visibleLayers } = useEditor();
  const { data: catalog } = useCatalog();
  const dark = useSettings((s) => s.theme === "dark");
  const [mode, setMode] = useState<"orbit" | "walk">("orbit");

  const iconOf = useMemo(() => makeIconOf(catalog), [catalog]);

  const els = order
    .map((id) => elements[id])
    .filter((e) => e && visibleLayers.has(e.layer));

  const fw = floor.width_cm * M;
  const fh = floor.height_cm * M;

  return (
    <div className="relative h-full w-full bg-gradient-to-b from-slate-200 to-slate-400 dark:from-slate-800 dark:to-slate-950">
      <Canvas shadows camera={{ position: [fw / 2, 6, fh + 4], fov: 55 }}>
        <FloorScene floor={floor} els={els} iconOf={iconOf} />

        <Grid
          args={[40, 40]}
          cellSize={1}
          cellColor={dark ? "#334155" : "#cbd5e1"}
          sectionColor={dark ? "#475569" : "#94a3b8"}
          position={[0, -0.03, 0]}
          infiniteGrid
          fadeDistance={40}
        />

        {mode === "orbit" ? <FocusOrbitControls /> : <Walkthrough />}
      </Canvas>

      <div className="absolute left-3 top-3 flex gap-1 rounded-lg bg-white/90 p-1 shadow backdrop-blur dark:bg-slate-800/90">
        <button
          className={`btn px-2 py-1 ${mode === "orbit" ? "bg-brand-600 text-white" : "text-ink-600 dark:text-slate-300"}`}
          onClick={() => setMode("orbit")}
        >
          <Orbit className="h-4 w-4" /> Orbit
        </button>
        <button
          className={`btn px-2 py-1 ${mode === "walk" ? "bg-brand-600 text-white" : "text-ink-600 dark:text-slate-300"}`}
          onClick={() => setMode("walk")}
        >
          <Eye className="h-4 w-4" /> Walkthrough
        </button>
      </div>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded bg-white/90 px-3 py-1 text-xs text-ink-600 shadow dark:bg-slate-800/90 dark:text-slate-300">
        {mode === "walk"
          ? "Click to look around · W/A/S/D to walk · ESC to release"
          : "Double-click to focus a spot · drag to orbit · right-drag to pan · scroll to zoom"}
      </div>
    </div>
  );
}
