import type Konva from "konva";
import jsPDF from "jspdf";

// shared reference to the live Konva stage so toolbar buttons can export it
export const stageHandle: { current: Konva.Stage | null } = { current: null };

// dev-only handle for debugging / automated tests (stripped from prod builds)
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as any).__stageHandle = stageHandle;
}

export function exportPNG(filename: string) {
  const stage = stageHandle.current;
  if (!stage) return;
  const uri = stage.toDataURL({ pixelRatio: 2 });
  const link = document.createElement("a");
  link.download = `${filename}.png`;
  link.href = uri;
  link.click();
}

export function exportPDF(filename: string, title: string) {
  const stage = stageHandle.current;
  if (!stage) return;
  const uri = stage.toDataURL({ pixelRatio: 2 });
  const w = stage.width();
  const h = stage.height();
  const landscape = w >= h;
  const pdf = new jsPDF({
    orientation: landscape ? "landscape" : "portrait",
    unit: "pt",
    format: "a4",
  });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  pdf.setFontSize(16);
  pdf.text(title, 40, 40);
  const margin = 40;
  const availW = pageW - margin * 2;
  const availH = pageH - 80;
  const ratio = Math.min(availW / w, availH / h);
  pdf.addImage(uri, "PNG", margin, 60, w * ratio, h * ratio);
  pdf.save(`${filename}.pdf`);
}
