import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import jsPDF from "jspdf";
import { api } from "@/lib/api";
import { FloorScene, M, makeIconOf } from "@/view3d/Scene3D";
import { stageHandle } from "@/editor2d/stageHandle";
import { useEditor } from "@/store/editor";
import { useSettings } from "@/store/settings";
import type {
  BOMReport,
  CatalogItem,
  ElementModel,
  Floor,
  Project,
} from "@/types";

// A comprehensive, client-ready PDF: title + cost summary, the 2D floor plan,
// 3D angles of every room (rendered off-screen), and a grouped bill of materials.

type Shot = {
  label: string;
  pos: [number, number, number];
  target: [number, number, number];
};

const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const REND_W = 1200;
const REND_H = 820;
const REND_ASPECT = REND_W / REND_H;

// ---------- off-screen 3D capture ----------

function Capturer({
  shots,
  onDone,
}: {
  shots: Shot[];
  onDone: (imgs: string[]) => void;
}) {
  const { gl, scene, size } = useThree();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // let the scene graph + generated textures settle
      await raf();
      await raf();
      const cam = new THREE.PerspectiveCamera(48, size.width / size.height, 0.05, 2000);
      const imgs: string[] = [];
      for (const s of shots) {
        if (cancelled) return;
        cam.position.set(...s.pos);
        cam.up.set(0, 1, 0);
        cam.lookAt(new THREE.Vector3(...s.target));
        cam.updateProjectionMatrix();
        gl.render(scene, cam);
        imgs.push(gl.domElement.toDataURL("image/jpeg", 0.82));
      }
      if (!cancelled) onDone(imgs);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function render3DShots(
  floor: Floor,
  els: ElementModel[],
  iconOf: (el: ElementModel) => string,
  shots: Shot[]
): Promise<string[]> {
  return new Promise((resolve) => {
    const host = document.createElement("div");
    host.style.cssText = `position:fixed;left:-10000px;top:0;width:${REND_W}px;height:${REND_H}px;pointer-events:none;opacity:0;`;
    document.body.appendChild(host);
    const root = createRoot(host);
    const finish = (imgs: string[]) => {
      resolve(imgs);
      setTimeout(() => {
        root.unmount();
        host.remove();
      }, 30);
    };
    root.render(
      <Canvas
        frameloop="never"
        dpr={1}
        shadows
        gl={{ preserveDrawingBuffer: true, antialias: true }}
      >
        <color attach="background" args={["#eef2f7"]} />
        <FloorScene floor={floor} els={els} iconOf={iconOf} />
        <Capturer shots={shots} onDone={finish} />
      </Canvas>
    );
    // safety timeout so a WebGL failure never hangs the export
    setTimeout(() => finish([]), 8000);
  });
}

function buildShots(floor: Floor, els: ElementModel[]): Shot[] {
  const fw = floor.width_cm * M;
  const fh = floor.height_cm * M;
  const ceiling = floor.wall_height_cm * M;
  const toWorld = (xcm: number, ycm: number): [number, number] => [
    xcm * M - fw / 2,
    ycm * M - fh / 2,
  ];
  const shots: Shot[] = [];

  // overall aerial / isometric of the whole floor
  const diag = Math.hypot(fw, fh);
  const od = diag * 0.62 + 2;
  shots.push({
    label: "Overall view",
    pos: [od, ceiling * 1.4 + diag * 0.45, od],
    target: [0, ceiling * 0.25, 0],
  });

  const rooms = els
    .filter((e) => e.kind === "room" && e.points && e.points.length >= 6)
    .map((r) => {
      const xs = r.points!.filter((_, i) => i % 2 === 0);
      const ys = r.points!.filter((_, i) => i % 2 === 1);
      const minx = Math.min(...xs),
        maxx = Math.max(...xs),
        miny = Math.min(...ys),
        maxy = Math.max(...ys);
      const rw = (maxx - minx) * M;
      const rd = (maxy - miny) * M;
      return {
        name: r.name || "Room",
        cx: (minx + maxx) / 2,
        cy: (miny + maxy) / 2,
        rw,
        rd,
        area: rw * rd,
      };
    })
    .sort((a, b) => b.area - a.area)
    .slice(0, 12);

  for (const r of rooms) {
    const [wx, wz] = toWorld(r.cx, r.cy);
    const rdiag = Math.hypot(r.rw, r.rd);
    const d = rdiag * 0.75 + 1.6;
    shots.push({
      label: r.name,
      pos: [wx + d * 0.72, ceiling * 1.25 + rdiag * 0.5, wz + d * 0.72],
      target: [wx, ceiling * 0.32, wz],
    });
  }
  return shots;
}

// ---------- PDF assembly ----------

type RGB = [number, number, number];
const BRAND: RGB = [79, 70, 229];
const INK: RGB = [30, 41, 59];
const MUTE: RGB = [100, 116, 139];
const WHITE: RGB = [255, 255, 255];
const TINT: RGB = [224, 231, 255];

function fitBox(imgW: number, imgH: number, boxW: number, boxH: number) {
  const s = Math.min(boxW / imgW, boxH / imgH);
  const w = imgW * s;
  const h = imgH * s;
  return { w, h };
}

function buildPdf(
  project: Project,
  floor: Floor,
  planImg: string | null,
  planSize: { w: number; h: number } | null,
  shots: Shot[],
  imgs: string[],
  bom: BOMReport | null,
  money: (v: number) => string
) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const PW = pdf.internal.pageSize.getWidth();
  const PH = pdf.internal.pageSize.getHeight();
  const MX = 40;
  const cW = PW - MX * 2;
  let y = 0;

  const ensure = (space: number) => {
    if (y + space > PH - MX) {
      pdf.addPage();
      y = MX;
    }
  };
  const sectionTitle = (txt: string) => {
    ensure(40);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(...INK);
    pdf.text(txt, MX, y + 4);
    pdf.setDrawColor(...BRAND);
    pdf.setLineWidth(2);
    pdf.line(MX, y + 10, MX + 40, y + 10);
    y += 28;
  };

  // ---- title banner ----
  pdf.setFillColor(...BRAND);
  pdf.rect(0, 0, PW, 92, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.text(project.name, MX, 48);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  const sub = [
    project.client_name ? `Client: ${project.client_name}` : null,
    floor.name,
    new Date().toLocaleDateString(),
  ]
    .filter(Boolean)
    .join("    ·    ");
  pdf.text(sub, MX, 70);
  y = 116;

  // ---- cost summary cards ----
  if (bom) {
    const cards: { label: string; value: string; accent?: boolean }[] = [
      { label: "Project Total", value: money(bom.grand_total), accent: true },
      { label: "Charged Items", value: money(bom.charged_total) },
      { label: "Existing (not charged)", value: money(bom.existing_value) },
    ];
    const gap = 12;
    const cwid = (cW - gap * (cards.length - 1)) / cards.length;
    cards.forEach((c, i) => {
      const cx = MX + i * (cwid + gap);
      if (c.accent) pdf.setFillColor(...BRAND);
      else pdf.setFillColor(241, 245, 249);
      pdf.roundedRect(cx, y, cwid, 56, 6, 6, "F");
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(...(c.accent ? TINT : MUTE));
      pdf.text(c.label.toUpperCase(), cx + 12, y + 20);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(15);
      pdf.setTextColor(...(c.accent ? WHITE : INK));
      pdf.text(c.value, cx + 12, y + 42);
    });
    y += 56 + 24;
  }

  // ---- floor plan ----
  if (planImg && planSize) {
    sectionTitle("Floor Plan");
    const boxH = 300;
    const { w, h } = fitBox(planSize.w, planSize.h, cW, boxH);
    ensure(h + 10);
    pdf.setFillColor(255, 255, 255);
    pdf.rect(MX, y, cW, h + 8, "F");
    // plan is captured as PNG (transparent background); a JPEG would go black
    pdf.addImage(planImg, "PNG", MX + (cW - w) / 2, y + 4, w, h);
    y += h + 24;
  }

  // ---- 3D views ----
  if (imgs.length) {
    sectionTitle("3D Views");
    // two images per row
    const gap = 14;
    const colW = (cW - gap) / 2;
    const imgBoxH = 150;
    let col = 0;
    let rowY = y;
    for (let i = 0; i < imgs.length; i++) {
      if (col === 0) {
        ensure(imgBoxH + 28);
        rowY = y;
      }
      const cx = MX + col * (colW + gap);
      const { w, h } = fitBox(REND_ASPECT, 1, colW, imgBoxH);
      pdf.setFillColor(238, 242, 247);
      pdf.roundedRect(cx, rowY, colW, imgBoxH, 4, 4, "F");
      pdf.addImage(
        imgs[i],
        "JPEG",
        cx + (colW - w) / 2,
        rowY + (imgBoxH - h) / 2,
        w,
        h
      );
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(...INK);
      pdf.text(shots[i]?.label ?? `View ${i + 1}`, cx + 2, rowY + imgBoxH + 14);
      col++;
      if (col === 2) {
        col = 0;
        y = rowY + imgBoxH + 28;
      }
    }
    if (col === 1) y = rowY + imgBoxH + 28;
  }

  // ---- bill of materials ----
  if (bom && bom.lines.length) {
    pdf.addPage();
    y = MX;
    sectionTitle("Bill of Materials");

    const qtyX = MX + cW * 0.5;
    const rateX = MX + cW * 0.68;
    const amtRight = PW - MX;
    const rowH = 17;

    const headerRow = () => {
      pdf.setFillColor(...BRAND);
      pdf.rect(MX, y, cW, rowH, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.setTextColor(255, 255, 255);
      pdf.text("ITEM", MX + 6, y + 12);
      pdf.text("QTY", qtyX, y + 12);
      pdf.text("RATE", rateX, y + 12);
      pdf.text("AMOUNT", amtRight - 4, y + 12, { align: "right" });
      y += rowH;
    };
    headerRow();

    const charged = bom.lines.filter((l) => !l.is_existing);
    const groups = new Map<string, typeof charged>();
    for (const l of charged) {
      const k = l.category || "Other";
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(l);
    }

    let stripe = false;
    for (const [cat, lines] of groups) {
      ensure(rowH * 2);
      // category band
      pdf.setFillColor(226, 232, 240);
      pdf.rect(MX, y, cW, rowH, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(...INK);
      pdf.text(cat, MX + 6, y + 12);
      y += rowH;

      let subtotal = 0;
      for (const l of lines) {
        ensure(rowH);
        if (stripe) {
          pdf.setFillColor(248, 250, 252);
          pdf.rect(MX, y, cW, rowH, "F");
        }
        stripe = !stripe;
        subtotal += l.total_cost;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        pdf.setTextColor(...INK);
        const name = l.name.length > 52 ? l.name.slice(0, 50) + "…" : l.name;
        pdf.text(name, MX + 6, y + 12);
        pdf.text(`${l.quantity} ${l.unit || ""}`.trim(), qtyX, y + 12);
        pdf.text(money(l.unit_cost), rateX, y + 12);
        pdf.text(money(l.total_cost), amtRight - 4, y + 12, { align: "right" });
        y += rowH;
      }
      // subtotal
      ensure(rowH);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.setTextColor(...MUTE);
      pdf.text(`Subtotal — ${cat}`, qtyX, y + 12);
      pdf.setTextColor(...INK);
      pdf.text(money(subtotal), amtRight - 4, y + 12, { align: "right" });
      pdf.setDrawColor(...MUTE);
      pdf.setLineWidth(0.4);
      pdf.line(MX, y, PW - MX, y);
      y += rowH + 4;
    }

    // grand total
    ensure(rowH + 6);
    pdf.setFillColor(...BRAND);
    pdf.rect(MX, y, cW, rowH + 4, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(255, 255, 255);
    pdf.text("PROJECT TOTAL", MX + 6, y + 14);
    pdf.text(money(bom.grand_total), amtRight - 4, y + 14, { align: "right" });
    y += rowH + 4 + 14;

    // existing items (not charged)
    const existing = bom.lines.filter((l) => l.is_existing);
    if (existing.length) {
      ensure(rowH * 2);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(...INK);
      pdf.text("Existing items (provided — not charged)", MX, y + 10);
      y += rowH + 2;
      for (const l of existing) {
        ensure(rowH);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        pdf.setTextColor(...MUTE);
        const name = l.name.length > 52 ? l.name.slice(0, 50) + "…" : l.name;
        pdf.text(name, MX + 6, y + 12);
        pdf.text(`${l.quantity} ${l.unit || ""}`.trim(), qtyX, y + 12);
        pdf.text(money(l.total_cost), amtRight - 4, y + 12, { align: "right" });
        y += rowH;
      }
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(8);
      pdf.setTextColor(...MUTE);
      pdf.text(
        `Indicative value of existing items: ${money(bom.existing_value)} (not billed)`,
        MX,
        y + 12
      );
      y += rowH;
    }
  }

  // ---- page footers ----
  const pages = pdf.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...MUTE);
    pdf.text(`${project.name} — ${floor.name}`, MX, PH - 18);
    pdf.text(`Page ${p} of ${pages}`, PW - MX, PH - 18, { align: "right" });
  }

  pdf.save(`${project.name} — ${floor.name}.pdf`);
}

// ---------- orchestrator ----------

export async function generateProjectReport(project: Project, floor: Floor) {
  const ed = useEditor.getState();
  const els = ed.order
    .map((id) => ed.elements[id])
    .filter((e): e is ElementModel => !!e && ed.visibleLayers.has(e.layer));

  const settings = useSettings.getState().settings;
  // jsPDF's built-in Helvetica is WinAnsi-only, so the ₹ glyph renders as junk.
  // Swap it (and any other non-Latin1 char) for an ASCII-safe currency label.
  const pdfSafe = (s: string) =>
    s.replace(/₹/g, "Rs ").replace(/[^\x00-\xFF]/g, "");
  const money = (v: number) => {
    let out: string;
    try {
      out = new Intl.NumberFormat(settings.currency_locale, {
        style: "currency",
        currency: settings.currency_code,
        maximumFractionDigits: 0,
      }).format(v);
    } catch {
      out = `${settings.currency_symbol}${Math.round(v).toLocaleString()}`;
    }
    return pdfSafe(out);
  };

  const [catalog, bom] = await Promise.all([
    api
      .get<CatalogItem[]>("/catalog")
      .then((r) => r.data)
      .catch(() => [] as CatalogItem[]),
    api
      .get<BOMReport>(`/projects/${project.id}/bom`)
      .then((r) => r.data)
      .catch(() => null),
  ]);
  const iconOf = makeIconOf(catalog);

  // capture the 2D plan from the live Konva stage (switch to 2D if needed)
  const prevView = ed.view;
  if (prevView !== "2d") ed.setView("2d");
  for (let i = 0; i < 80 && !stageHandle.current; i++) await raf();
  await raf();
  await raf();
  const stage = stageHandle.current;
  let planImg: string | null = null;
  let planSize: { w: number; h: number } | null = null;
  if (stage) {
    // crop to the drawn elements (named "el-…") so the plan fills the page
    const nodes = stage.find((n: any) => n.name?.().startsWith("el-")) as any[];
    if (nodes.length) {
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
      for (const n of nodes) {
        const r = n.getClientRect();
        x1 = Math.min(x1, r.x);
        y1 = Math.min(y1, r.y);
        x2 = Math.max(x2, r.x + r.width);
        y2 = Math.max(y2, r.y + r.height);
      }
      const pad = 36;
      const w = x2 - x1 + pad * 2;
      const h = y2 - y1 + pad * 2;
      planImg = stage.toDataURL({ x: x1 - pad, y: y1 - pad, width: w, height: h, pixelRatio: 2 });
      planSize = { w, h };
    } else {
      planImg = stage.toDataURL({ pixelRatio: 1.5 });
      planSize = { w: stage.width(), h: stage.height() };
    }
  }

  // render 3D angles off-screen
  const shots = buildShots(floor, els);
  const imgs = await render3DShots(floor, els, iconOf, shots);

  if (prevView !== "2d") ed.setView(prevView);

  buildPdf(project, floor, planImg, planSize, shots, imgs, bom, money);
}
