// src/components/canvas/Relation.tsx
"use client";

import { memo } from "react";
import { useStorage, useMutation, useSelf } from "@liveblocks/react";
import type { EntityLayer, RelationLayer, RelationType } from "~/types";

type Props = {
  id: string;
  layer: RelationLayer;
  onPointerDown?: (e: React.PointerEvent, id: string) => void;
};

function centerOf(e: EntityLayer) {
  return { x: e.x + e.width / 2, y: e.y + e.height / 2 };
}

function intersectRectEdge(
  from: { x: number; y: number },
  rect: { x: number; y: number; width: number; height: number },
  to: { x: number; y: number },
) {
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  let bestT = Number.POSITIVE_INFINITY;
  let hit = from;

  if (dx !== 0) {
    const tL = (left - from.x) / dx;
    const yL = from.y + tL * dy;
    if (tL > 0 && yL >= top && yL <= bottom && tL < bestT) {
      bestT = tL;
      hit = { x: left, y: yL };
    }
    const tR = (right - from.x) / dx;
    const yR = from.y + tR * dy;
    if (tR > 0 && yR >= top && yR <= bottom && tR < bestT) {
      bestT = tR;
      hit = { x: right, y: yR };
    }
  }

  if (dy !== 0) {
    const tT = (top - from.y) / dy;
    const xT = from.x + tT * dx;
    if (tT > 0 && xT >= left && xT <= right && tT < bestT) {
      bestT = tT;
      hit = { x: xT, y: top };
    }
    const tB = (bottom - from.y) / dy;
    const xB = from.x + tB * dx;
    if (tB > 0 && xB >= left && xB <= right && tB < bestT) {
      bestT = tB;
      hit = { x: xB, y: bottom };
    }
  }

  return hit;
}

function lerp(a: { x: number; y: number }, b: { x: number; y: number }, t: number) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

// Calcular ángulo de la línea para rotar los símbolos
function getAngle(from: { x: number; y: number }, to: { x: number; y: number }) {
  return Math.atan2(to.y - from.y, to.x - from.x) * (180 / Math.PI);
}

// Renderizar símbolo al inicio (source) según el tipo
function renderSourceSymbol(
  relationType: RelationType,
  p1: { x: number; y: number },
  p2: { x: number; y: number },
) {
  const angle = getAngle(p1, p2);

  if (relationType === "aggregation") {
    // Diamante vacío - centrado en la línea
    const w = 16; // ancho total del diamante (aumentado)
    const h = 11;  // altura total del diamante (aumentado)
    // Puntos del diamante centrado: punta izquierda, arriba, punta derecha, abajo
    const points = `0,0 ${w/2},${-h/2} ${w},0 ${w/2},${h/2}`;
    return (
      <g transform={`translate(${p1.x}, ${p1.y}) rotate(${angle})`}>
        <polygon points={points} fill="white" stroke="#475569" strokeWidth={1.8} />
      </g>
    );
  }

  if (relationType === "composition") {
    // Diamante lleno (negro) - centrado en la línea
    const w = 16; // ancho total del diamante (aumentado)
    const h = 11;  // altura total del diamante (aumentado)
    // Puntos del diamante centrado: punta izquierda, arriba, punta derecha, abajo
    const points = `0,0 ${w/2},${-h/2} ${w},0 ${w/2},${h/2}`;
    return (
      <g transform={`translate(${p1.x}, ${p1.y}) rotate(${angle})`}>
        <polygon points={points} fill="#000000" stroke="#000000" strokeWidth={1.8} />
      </g>
    );
  }

  return null;
}

// Renderizar símbolo al final (target) según el tipo
function renderTargetSymbol(
  relationType: RelationType,
  p1: { x: number; y: number },
  p2: { x: number; y: number },
) {
  const angle = getAngle(p1, p2);

  if (relationType === "generalization" || relationType === "realization") {
    // Triángulo vacío (herencia/implementación) - la punta toca el borde
    const arrowSize = 14;
    const arrowWidth = 11;
    // Punta en (0,0), base hacia atrás
    const points = `0,0 ${-arrowSize},${-arrowWidth / 2} ${-arrowSize},${arrowWidth / 2}`;
    return (
      <g transform={`translate(${p2.x}, ${p2.y}) rotate(${angle})`}>
        <polygon points={points} fill="white" stroke="#475569" strokeWidth={1.5} />
      </g>
    );
  }

  if (relationType === "dependency") {
    // Flecha simple abierta para dependencia (solo líneas, sin relleno)
    const arrowSize = 13;
    const arrowWidth = 10;
    return (
      <g transform={`translate(${p2.x}, ${p2.y}) rotate(${angle})`}>
        <line x1={0} y1={0} x2={-arrowSize} y2={-arrowWidth / 2} stroke="#475569" strokeWidth={1.5} />
        <line x1={0} y1={0} x2={-arrowSize} y2={arrowWidth / 2} stroke="#475569" strokeWidth={1.5} />
      </g>
    );
  }

  // Association no tiene flecha, solo línea simple
  return null;
}

// Obtener estilo de línea según el tipo
function getLineStyle(relationType: RelationType) {
  if (relationType === "realization" || relationType === "dependency") {
    return { strokeDasharray: "8 5" }; // Línea punteada más visible
  }
  return { strokeDasharray: "none" };
}

export default memo(function Relation({ id, layer, onPointerDown }: Props) {
  const src = useStorage((root) => root.layers.get(layer.sourceId)) as EntityLayer | undefined;
  const dst = useStorage((root) => root.layers.get(layer.targetId)) as EntityLayer | undefined;
  const selection = useSelf((me) => me.presence.selection);
  const isSelected = selection?.includes(id) ?? false;

  if (!src || !dst) return null;

  const c1 = centerOf(src);
  const c2 = centerOf(dst);

  const p1Original = intersectRectEdge(c1, src, c2);
  const p2Original = intersectRectEdge(c2, dst, c1);

  let p1 = p1Original;
  let p2 = p2Original;

  // Ajustar puntos para que no se solapen con los símbolos
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / len;
  const uy = dy / len;

  // Ajustar p1 si hay símbolo en source (diamantes)
  if (layer.relationType === "aggregation" || layer.relationType === "composition") {
    const diamondOffset = 16; // Offset igual al ancho del diamante
    p1 = { x: p1.x + ux * diamondOffset, y: p1.y + uy * diamondOffset };
  }

  // Ajustar p2 si hay símbolo en target (solo para dependency que tiene flecha abierta)
  if (layer.relationType === "dependency") {
    const arrowOffset = 13; // Offset para flecha abierta (igual al tamaño)
    p2 = { x: p2.x - ux * arrowOffset, y: p2.y - uy * arrowOffset };
  }
  // Generalization, Realization y Association no tienen offset, van directo al borde

  const toggleSrc = useMutation(
    ({ storage }) => {
      const lo: any = storage.get("layers").get(id);
      lo?.update({ sourceCard: lo.get("sourceCard") === "ONE" ? "MANY" : "ONE" });
    },
    [id],
  );

  const toggleDst = useMutation(
    ({ storage }) => {
      const lo: any = storage.get("layers").get(id);
      lo?.update({ targetCard: lo.get("targetCard") === "ONE" ? "MANY" : "ONE" });
    },
    [id],
  );

  const toggleOwner = useMutation(
    ({ storage }) => {
      const lo: any = storage.get("layers").get(id);
      if (!lo) return;
      const cur = lo.get("owningSide");
      lo.update({ owningSide: cur === "source" ? "target" : "source" });
    },
    [id],
  );

  const removeSelf = useMutation(
    ({ storage }) => {
      const layers = storage.get("layers");
      const list = storage.get("layerIds");
      layers.delete(id);
      for (let i = 0; i < list.length; i++) {
        if (list.get(i) === id) {
          list.delete(i);
          break;
        }
      }
    },
    [id],
  );

  const label = (c: "ONE" | "MANY") => (c === "ONE" ? "1" : "N");
  const lblSrc = lerp(p1, p2, 0.1);  // Más cerca del source (10% de distancia)
  const lblDst = lerp(p2, p1, 0.1);  // Más cerca del target (10% de distancia)
  const owner = layer.owningSide;
  const mid = lerp(p1, p2, 0.5);

  const lineStyle = getLineStyle(layer.relationType);

  // Para generalization y realization no mostrar cardinalidades
  const showCardinality =
    layer.relationType !== "generalization" && layer.relationType !== "realization";

  return (
    <g
      className="relation"
      onPointerDown={(e) => onPointerDown?.(e, id)}
      pointerEvents="stroke"
      stroke="#475569"
      fill="none"
    >
      {/* línea visible */}
      <line
        x1={p1.x}
        y1={p1.y}
        x2={p2.x}
        y2={p2.y}
        strokeWidth={1.5}
        strokeDasharray={lineStyle.strokeDasharray}
      />

      {/* hit area invisible para seleccionar fácil */}
      <line
        x1={p1.x}
        y1={p1.y}
        x2={p2.x}
        y2={p2.y}
        strokeWidth={12}
        stroke="transparent"
        pointerEvents="stroke"
        onPointerDown={(e) => onPointerDown?.(e, id)}
      />

      {/* Símbolos UML según el tipo */}
      {renderSourceSymbol(layer.relationType, p1Original, p2Original)}
      {renderTargetSymbol(layer.relationType, p1Original, p2Original)}

      {/* extremos (owner con clic derecho) - solo visibles cuando la relación está seleccionada */}
      {showCardinality && isSelected && (
        <>
          <circle
            cx={p1.x}
            cy={p1.y}
            r={4}
            fill={owner === "source" ? "#0ea5e9" : "#fff"}
            stroke="#0ea5e9"
            strokeWidth={1.5}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleOwner();
            }}
          />
          <circle
            cx={p2.x}
            cy={p2.y}
            r={4}
            fill={owner === "target" ? "#0ea5e9" : "#fff"}
            stroke="#0ea5e9"
            strokeWidth={1.5}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleOwner();
            }}
          />
        </>
      )}

      {/* etiquetas 1/N – solo para tipos que tienen cardinalidad */}
      {showCardinality && (
        <>
          <text
            x={lblSrc.x}
            y={lblSrc.y}
            fontSize={12}
            fill="#334155"
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => {
              e.stopPropagation();
              toggleSrc();
            }}
          >
            {label(layer.sourceCard)}
          </text>
          <text
            x={lblDst.x}
            y={lblDst.y}
            fontSize={12}
            fill="#334155"
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => {
              e.stopPropagation();
              toggleDst();
            }}
          >
            {label(layer.targetCard)}
          </text>
        </>
      )}
    </g>
  );
});
