import { Camera, Color, Point, Side, XYWH } from "./types";

/** Seguro con undefined/null */
export function colorToCss(color?: Partial<Color> | null) {
  const r = Math.max(0, Math.min(255, color?.r ?? 30));
  const g = Math.max(0, Math.min(255, color?.g ?? 30));
  const b = Math.max(0, Math.min(255, color?.b ?? 30));
  return `#${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function hexToRgb(hex: string): Color {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

const COLORS = ["#DC2626", "#D97706", "#059669", "#7C3AED", "#DB2777"];
export function connectionIdToColor(connectionId: number): string {
  return COLORS[connectionId % COLORS.length]!;
}

export function resizeBounds(bounds: XYWH, corner: Side, point: Point): XYWH {
  const result = { ...bounds };

  if (corner === Side.Left || (corner & Side.Left) !== 0) {
    result.x = Math.min(point.x, bounds.x + bounds.width);
    result.width = Math.abs(bounds.x + bounds.width - point.x);
  }
  if (corner === Side.Right || (corner & Side.Right) !== 0) {
    result.x = Math.min(point.x, bounds.x);
    result.width = Math.abs(point.x - bounds.x);
  }
  if (corner === Side.Top || (corner & Side.Top) !== 0) {
    result.y = Math.min(point.y, bounds.y + bounds.height);
    result.height = Math.abs(bounds.y + bounds.height - point.y);
  }
  if (corner === Side.Bottom || (corner & Side.Bottom) !== 0) {
    result.y = Math.min(point.y, bounds.y);
    result.height = Math.abs(point.y - bounds.y);
  }
  return result;
}

/** Pointer → coordenadas canvas */
export const pointerEventToCanvasPoint = (
  e: React.PointerEvent,
  camera: Camera,
): Point => ({
  x: Math.round(e.clientX) - camera.x,
  y: Math.round(e.clientY) - camera.y,
});

/**
 * Intersección con rectángulo: SOLO capas con bounding box (x,y,width,height),
 * es decir, Entidades. Ignora relaciones.
 */
export function findIntersectionLayersWithRectangle(
  layerIds: readonly string[],
  layers: ReadonlyMap<string, any>,
  a: Point,
  b: Point,
) {
  const rect = {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };

  const ids: string[] = [];
  for (const layerId of layerIds) {
    const layer: any = layers.get(layerId);
    if (
      !layer ||
      typeof layer.x !== "number" ||
      typeof layer.y !== "number" ||
      typeof layer.width !== "number" ||
      typeof layer.height !== "number"
    ) {
      continue; // no tiene bounding box (p.ej., Relation)
    }

    const { x, y, width, height } = layer;
    if (
      rect.x + rect.width > x &&
      rect.x < x + width &&
      rect.y + rect.height > y &&
      rect.y < y + height
    ) {
      ids.push(layerId);
    }
  }
  return ids;
}
