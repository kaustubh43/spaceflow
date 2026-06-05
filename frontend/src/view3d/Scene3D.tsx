import { Suspense, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { FirstPersonControls, Grid, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useEditor } from "@/store/editor";
import type { ElementModel, Floor } from "@/types";
import { layerColor } from "@/layers/config";
import { plasterTexture, woodFloorTexture } from "./textures";
import { Eye, Orbit } from "lucide-react";

const M = 0.01; // cm -> metres

interface Props {
  floor: Floor;
}

function Walls({ floor, els }: { floor: Floor; els: ElementModel[] }) {
  const h = floor.wall_height_cm * M;
  const wallTex = useMemo(() => plasterTexture(), []);
  const segments = useMemo(() => {
    const out: { pos: [number, number, number]; rot: number; len: number }[] = [];
    for (const el of els) {
      if (el.kind !== "wall" || !el.points) continue;
      const p = el.points;
      for (let i = 0; i < p.length - 2; i += 2) {
        const x1 = p[i] * M;
        const z1 = p[i + 1] * M;
        const x2 = p[i + 2] * M;
        const z2 = p[i + 3] * M;
        const len = Math.hypot(x2 - x1, z2 - z1);
        if (len < 0.01) continue;
        out.push({
          pos: [(x1 + x2) / 2, h / 2, (z1 + z2) / 2],
          rot: Math.atan2(z2 - z1, x2 - x1),
          len,
        });
      }
    }
    return out;
  }, [els, h]);

  return (
    <>
      {segments.map((s, i) => (
        <mesh key={i} position={s.pos} rotation={[0, -s.rot, 0]} castShadow receiveShadow>
          <boxGeometry args={[s.len + 0.1, h, 0.12]} />
          <meshStandardMaterial map={wallTex} roughness={0.92} metalness={0} color="#f4f5f7" />
        </mesh>
      ))}
    </>
  );
}

function Items({ els, center }: { els: ElementModel[]; center: [number, number] }) {
  return (
    <>
      {els.map((el) => {
        if (["wall", "room", "plumbing_line", "annotation"].includes(el.kind))
          return null;
        const w = el.width_cm * M;
        const d = el.depth_cm * M;
        const hh = Math.max(el.height_cm * M, 0.05);
        return (
          <mesh
            key={el.id}
            position={[el.x * M, hh / 2, el.y * M]}
            rotation={[0, -(el.rotation_deg * Math.PI) / 180, 0]}
            castShadow
          >
            <boxGeometry args={[w, hh, d]} />
            <meshStandardMaterial color={el.color || layerColor(el.layer)} />
          </mesh>
        );
      })}
    </>
  );
}

export function Scene3D({ floor }: Props) {
  const { elements, order, visibleLayers } = useEditor();
  const [mode, setMode] = useState<"orbit" | "walk">("orbit");
  const floorTex = useMemo(() => woodFloorTexture(), []);

  const els = order
    .map((id) => elements[id])
    .filter((e) => e && visibleLayers.has(e.layer));

  const fw = floor.width_cm * M;
  const fh = floor.height_cm * M;
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
            <Items els={els} center={center} />
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
