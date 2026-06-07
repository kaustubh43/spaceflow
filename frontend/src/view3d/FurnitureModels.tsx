import * as THREE from "three";

// Parametric low-poly furniture built from primitives. All dimensions in metres.
// Each model fills a footprint of w (x) × d (z) and rises from y=0 to y=h,
// centred on x/z. Scene3D wraps these in the positioned/rotated group.

type Props = {
  w: number;
  d: number;
  h: number;
  color: string;
  angle?: number; // door open angle (deg)
  swing?: string; // "left" | "right"
};

function shade(hex: string, amt: number): string {
  try {
    const c = new THREE.Color(hex);
    c.offsetHSL(0, 0, amt);
    return `#${c.getHexString()}`;
  } catch {
    return hex;
  }
}

function B({
  s,
  p,
  color,
  rough = 0.7,
}: {
  s: [number, number, number];
  p: [number, number, number];
  color: string;
  rough?: number;
}) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={color} roughness={rough} />
    </mesh>
  );
}

function Cyl({
  r,
  height,
  p,
  color,
  rot,
}: {
  r: number;
  height: number;
  p: [number, number, number];
  color: string;
  rot?: [number, number, number];
}) {
  return (
    <mesh position={p} rotation={rot} castShadow>
      <cylinderGeometry args={[r, r, height, 20]} />
      <meshStandardMaterial color={color} roughness={0.6} />
    </mesh>
  );
}

const LEG = "#3f3f46";

function Chair({ w, d, h, color }: Props) {
  const seatY = Math.min(0.45, h * 0.5);
  const lt = Math.min(w, d) * 0.1;
  const lx = w / 2 - lt;
  const lz = d / 2 - lt;
  return (
    <>
      <B s={[w, 0.06, d]} p={[0, seatY, 0]} color={color} />
      <B s={[w, h - seatY, 0.06]} p={[0, (h + seatY) / 2, -d / 2 + 0.03]} color={color} />
      {[[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]].map(([x, z], i) => (
        <B key={i} s={[lt, seatY, lt]} p={[x, seatY / 2, z]} color={LEG} />
      ))}
    </>
  );
}

function Sofa({ w, d, h, color }: Props) {
  const baseH = h * 0.4;
  const arm = w * 0.12;
  return (
    <>
      <B s={[w, baseH, d]} p={[0, baseH / 2, 0]} color={color} />
      {/* seat cushions */}
      <B s={[w - arm * 2, 0.12, d * 0.7]} p={[0, baseH + 0.06, d * 0.1]} color={shade(color, 0.06)} />
      {/* backrest */}
      <B s={[w, h - baseH, d * 0.28]} p={[0, (h + baseH) / 2, -d / 2 + d * 0.14]} color={color} />
      {/* arms */}
      <B s={[arm, h * 0.62, d]} p={[-w / 2 + arm / 2, h * 0.31, 0]} color={color} />
      <B s={[arm, h * 0.62, d]} p={[w / 2 - arm / 2, h * 0.31, 0]} color={color} />
    </>
  );
}

function Bed({ w, d, h, color }: Props) {
  const frameH = Math.min(0.25, h * 0.4);
  const matH = 0.18;
  return (
    <>
      <B s={[w, frameH, d]} p={[0, frameH / 2, 0]} color={LEG} />
      {/* mattress */}
      <B s={[w - 0.06, matH, d - 0.06]} p={[0, frameH + matH / 2, 0]} color={shade(color, 0.1)} />
      {/* headboard */}
      <B s={[w, h, 0.06]} p={[0, h / 2, -d / 2 + 0.03]} color={color} />
      {/* pillows */}
      <B s={[w * 0.4, 0.08, d * 0.16]} p={[-w * 0.22, frameH + matH + 0.04, -d / 2 + d * 0.18]} color="#fafafa" />
      <B s={[w * 0.4, 0.08, d * 0.16]} p={[w * 0.22, frameH + matH + 0.04, -d / 2 + d * 0.18]} color="#fafafa" />
    </>
  );
}

function Table({ w, d, h, color }: Props) {
  const lt = Math.min(w, d) * 0.08;
  const lx = w / 2 - lt;
  const lz = d / 2 - lt;
  return (
    <>
      <B s={[w, 0.06, d]} p={[0, h - 0.03, 0]} color={color} />
      {[[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]].map(([x, z], i) => (
        <B key={i} s={[lt, h - 0.06, lt]} p={[x, (h - 0.06) / 2, z]} color={shade(color, -0.1)} />
      ))}
    </>
  );
}

function Desk({ w, d, h, color }: Props) {
  return (
    <>
      <B s={[w, 0.05, d]} p={[0, h - 0.025, 0]} color={color} />
      <B s={[0.05, h - 0.05, d]} p={[-w / 2 + 0.05, (h - 0.05) / 2, 0]} color={shade(color, -0.1)} />
      <B s={[0.05, h - 0.05, d]} p={[w / 2 - 0.05, (h - 0.05) / 2, 0]} color={shade(color, -0.1)} />
      <B s={[w, h * 0.35, 0.04]} p={[0, h * 0.5, -d / 2 + 0.02]} color={shade(color, -0.1)} />
    </>
  );
}

function Counter({ w, d, h, color }: Props) {
  return (
    <>
      <B s={[w, h - 0.04, d]} p={[0, (h - 0.04) / 2, 0]} color={color} />
      <B s={[w + 0.04, 0.05, d + 0.04]} p={[0, h - 0.02, 0]} color="#52525b" rough={0.4} />
    </>
  );
}

function Cabinet({ w, d, h, color }: Props) {
  return (
    <>
      <B s={[w, h, d]} p={[0, h / 2, 0]} color={color} />
      {/* door seam + handles */}
      <B s={[0.015, h * 0.95, 0.02]} p={[0, h / 2, d / 2]} color={shade(color, -0.25)} />
      <B s={[0.04, 0.12, 0.03]} p={[-w * 0.06, h * 0.5, d / 2 + 0.01]} color="#71717a" />
      <B s={[0.04, 0.12, 0.03]} p={[w * 0.06, h * 0.5, d / 2 + 0.01]} color="#71717a" />
    </>
  );
}

function Tv({ w, d, h, color }: Props) {
  // thin screen on a small stand
  const standH = h * 0.12;
  return (
    <>
      <B s={[w * 0.3, standH, d]} p={[0, standH / 2, 0]} color="#27272a" />
      <B s={[w, h - standH, Math.min(d, 0.05)]} p={[0, (h + standH) / 2, 0]} color="#0a0a0a" rough={0.3} />
      <B s={[w * 0.92, (h - standH) * 0.86, 0.01]} p={[0, (h + standH) / 2, 0.03]} color="#1e3a5f" rough={0.2} />
    </>
  );
}

function Fridge({ w, d, h, color }: Props) {
  return (
    <>
      <B s={[w, h, d]} p={[0, h / 2, 0]} color={color} />
      <B s={[w * 0.95, 0.03, 0.02]} p={[0, h * 0.62, d / 2]} color={shade(color, -0.3)} />
      <B s={[0.03, h * 0.3, 0.04]} p={[w / 2 - 0.06, h * 0.45, d / 2 + 0.01]} color="#d4d4d8" />
      <B s={[0.03, h * 0.2, 0.04]} p={[w / 2 - 0.06, h * 0.78, d / 2 + 0.01]} color="#d4d4d8" />
    </>
  );
}

function ApplianceRound({ w, d, h, color }: Props) {
  return (
    <>
      <B s={[w, h, d]} p={[0, h / 2, 0]} color={color} />
      <Cyl r={Math.min(w, h) * 0.32} height={0.04} p={[0, h * 0.55, d / 2]} color="#1f2937" rot={[Math.PI / 2, 0, 0]} />
      <Cyl r={Math.min(w, h) * 0.24} height={0.05} p={[0, h * 0.55, d / 2 + 0.01]} color="#93c5fd" rot={[Math.PI / 2, 0, 0]} />
    </>
  );
}

function Wc({ w, d, h, color }: Props) {
  return (
    <>
      {/* tank */}
      <B s={[w, h * 0.7, d * 0.25]} p={[0, h * 0.35, -d / 2 + d * 0.12]} color={color} />
      {/* pedestal */}
      <B s={[w * 0.4, h * 0.45, d * 0.4]} p={[0, h * 0.22, d * 0.1]} color={color} />
      {/* bowl */}
      <Cyl r={w * 0.42} height={h * 0.2} p={[0, h * 0.5, d * 0.12]} color={color} />
    </>
  );
}

function Basin({ w, d, h, color }: Props) {
  return (
    <>
      <B s={[w * 0.18, h, d * 0.18]} p={[0, h / 2, 0]} color="#cbd5e1" />
      <Cyl r={Math.min(w, d) * 0.42} height={h * 0.22} p={[0, h - h * 0.1, 0]} color={color} />
      <Cyl r={0.015} height={0.12} p={[0, h + 0.06, -d * 0.28]} color="#9ca3af" />
    </>
  );
}

function Shower({ w, d, color }: Props) {
  return (
    <>
      <B s={[w, 0.08, d]} p={[0, 0.04, 0]} color="#cbd5e1" rough={0.3} />
      <Cyl r={0.015} height={1.9} p={[-w / 2 + 0.1, 0.95, -d / 2 + 0.1]} color="#9ca3af" />
      <Cyl r={0.06} height={0.03} p={[-w / 2 + 0.1, 1.9, -d / 2 + 0.2]} color={color} rot={[Math.PI / 2, 0, 0]} />
    </>
  );
}

function Sink({ w, d, h, color }: Props) {
  return (
    <>
      <B s={[w, h, d]} p={[0, h / 2, 0]} color="#9ca3af" rough={0.4} />
      <B s={[w * 0.8, h * 0.4, d * 0.7]} p={[0, h * 0.8, 0]} color={shade(color, -0.2)} />
      <Cyl r={0.02} height={0.18} p={[0, h + 0.09, -d * 0.32]} color="#6b7280" />
    </>
  );
}

function CeilingLight({ w, d, color }: Props) {
  const r = Math.max(w, d) / 2;
  return <Cyl r={r} height={0.05} p={[0, -0.03, 0]} color={color} />;
}

function Pendant({ w, color, h }: Props) {
  return (
    <>
      <Cyl r={0.008} height={h} p={[0, -h / 2, 0]} color="#52525b" />
      <Cyl r={w / 2} height={w * 0.6} p={[0, -h, 0]} color={color} />
    </>
  );
}

function Fan({ w, color }: Props) {
  return (
    <>
      <Cyl r={0.09} height={0.12} p={[0, 0, 0]} color="#52525b" />
      <B s={[w, 0.02, 0.14]} p={[0, 0, 0]} color={color} />
      <B s={[0.14, 0.02, w]} p={[0, 0, 0]} color={color} />
    </>
  );
}

function Door({ w, h, color, angle = 90, swing = "left" }: Props) {
  // leaf hinged at one jamb, swung open by `angle` so walkthroughs look natural
  const dir = swing === "right" ? -1 : 1;
  const a = dir * (Math.min(Math.max(angle, 0), 120) * Math.PI) / 180;
  const hingeX = (dir * -w) / 2;
  return (
    <>
      {/* jambs / frame */}
      <B s={[0.06, h, 0.14]} p={[-w / 2, h / 2, 0]} color="#e2e2e6" />
      <B s={[0.06, h, 0.14]} p={[w / 2, h / 2, 0]} color="#e2e2e6" />
      <B s={[w + 0.12, 0.08, 0.14]} p={[0, h, 0]} color="#e2e2e6" />
      {/* swinging leaf */}
      <group position={[hingeX, h / 2, 0]} rotation={[0, a, 0]}>
        <mesh position={[(dir * w) / 2, 0, 0]} castShadow>
          <boxGeometry args={[w, h - 0.06, 0.04]} />
          <meshStandardMaterial color={color} roughness={0.55} />
        </mesh>
        {/* handle */}
        <mesh position={[dir * (w - 0.08), 0, 0.05]} castShadow>
          <boxGeometry args={[0.03, 0.03, 0.08]} />
          <meshStandardMaterial color="#c9ccd1" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>
    </>
  );
}

function Window({ w, h, color }: Props) {
  // thin frame + see-through glass so the wall opening actually reads
  const f = 0.06;
  return (
    <>
      <B s={[w, f, 0.1]} p={[0, h - f / 2, 0]} color="#eef1f4" />
      <B s={[w, f, 0.1]} p={[0, f / 2, 0]} color="#eef1f4" />
      <B s={[f, h, 0.1]} p={[-w / 2 + f / 2, h / 2, 0]} color="#eef1f4" />
      <B s={[f, h, 0.1]} p={[w / 2 - f / 2, h / 2, 0]} color="#eef1f4" />
      <B s={[f * 0.7, h, 0.05]} p={[0, h / 2, 0]} color="#eef1f4" />
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w - 2 * f, h - 2 * f, 0.01]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.18}
          roughness={0.05}
          metalness={0.1}
        />
      </mesh>
    </>
  );
}

function Ac({ w, h, d, color }: Props) {
  return (
    <>
      <B s={[w, h, d]} p={[0, 0, 0]} color={color} rough={0.4} />
      <B s={[w * 0.85, h * 0.18, 0.01]} p={[0, -h * 0.25, d / 2]} color="#94a3b8" />
    </>
  );
}

const BUILDERS: Record<string, (p: Props) => JSX.Element> = {
  chair: Chair,
  sofa: Sofa,
  bed: Bed,
  table: Table,
  desk: Desk,
  counter: Counter,
  cabinet: Cabinet,
  tv: Tv,
  fridge: Fridge,
  appliance_round: ApplianceRound,
  wc: Wc,
  basin: Basin,
  shower: Shower,
  sink: Sink,
  ceiling_light: CeilingLight,
  pendant: Pendant,
  fan: Fan,
  ac: Ac,
  door: Door,
  window: Window,
};

// model placement metadata
export const CEILING_MODELS = new Set(["ceiling_light", "pendant", "fan"]);
export const WALL_MODELS = new Set(["ac"]);

export function FurnitureModel({ model, ...props }: Props & { model: string }) {
  const Builder = BUILDERS[model];
  if (!Builder) {
    // fallback: a simple block
    return (
      <mesh position={[0, props.h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[props.w, props.h, props.d]} />
        <meshStandardMaterial color={props.color} roughness={0.7} />
      </mesh>
    );
  }
  return <Builder {...props} />;
}
