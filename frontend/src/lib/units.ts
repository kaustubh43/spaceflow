// All geometry is stored in centimetres. These helpers format for display.

export function formatLength(cm: number, units: string): string {
  if (units === "in") {
    const inches = cm / 2.54;
    const feet = Math.floor(inches / 12);
    const rem = Math.round(inches % 12);
    return feet > 0 ? `${feet}'${rem}"` : `${rem}"`;
  }
  if (cm >= 100) return `${(cm / 100).toFixed(2)} m`;
  return `${Math.round(cm)} cm`;
}

export function formatArea(sqCm: number, units: string): string {
  if (units === "in") {
    const sqFt = sqCm / 929.0304;
    return `${sqFt.toFixed(1)} ft²`;
  }
  return `${(sqCm / 10000).toFixed(2)} m²`;
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

// shoelace area for a flat [x1,y1,x2,y2,...] polygon (cm² )
export function polygonArea(points: number[]): number {
  let area = 0;
  const n = points.length / 2;
  for (let i = 0; i < n; i++) {
    const x1 = points[i * 2];
    const y1 = points[i * 2 + 1];
    const x2 = points[((i + 1) % n) * 2];
    const y2 = points[((i + 1) % n) * 2 + 1];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area / 2);
}
