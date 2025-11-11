// src/components/canvas/Entity.tsx
"use client";

import { memo, useState } from "react";
import { useMutation } from "@liveblocks/react";
import { LiveObject } from "@liveblocks/client";
import { nanoid } from "nanoid";
import type { EntityLayer } from "~/types";

type Props = {
  id: string;
  layer: EntityLayer;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onStartLink?: (entityId: string, anchor: "L" | "R" | "T" | "B") => void;
};

const HEADER_H = 28;
const ROW_H = 20;
const PADDING = 8;

export default memo(function Entity({
  id,
  layer,
  onPointerDown,
  onStartLink,
}: Props) {
  const [isHovered, setIsHovered] = useState(false);

  // --- Render ---
  const { x, y, width, height, name, attributes } = layer;
  const bodyH = Math.max(
    height - HEADER_H,
    ROW_H * (attributes?.length ?? 0) + PADDING * 2,
  );

  // Coordenadas para handles (para relaciones)
  const midY = HEADER_H + bodyH / 2;
  const midX = width / 2;

  return (
    <g
      className="entity"
      transform={`translate(${x}, ${y})`}
      onPointerDown={(e) => onPointerDown(e, id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ cursor: "move" }}
    >
      {/* Sombra */}
      <rect
        x={2}
        y={2}
        width={width}
        height={HEADER_H + bodyH}
        rx={8}
        fill="rgba(0, 0, 0, 0.1)"
        filter="blur(3px)"
      />

      {/* cuerpo */}
      <rect
        x={0}
        y={HEADER_H}
        width={width}
        height={bodyH}
        rx={8}
        ry={8}
        fill="#FFFBEB"
        stroke="#E5E7EB"
        strokeWidth={2}
      />
      {/* header */}
      <rect
        x={0}
        y={0}
        width={width}
        height={HEADER_H}
        rx={8}
        ry={8}
        fill="#FDE047"
        stroke="#FACC15"
        strokeWidth={2}
      />
      {/* Línea divisora entre header y body */}
      <line
        x1={0}
        y1={HEADER_H}
        x2={width}
        y2={HEADER_H}
        stroke="#E5E7EB"
        strokeWidth={2}
      />
      {/* título */}
      <text
        x={PADDING}
        y={HEADER_H / 2 + 4}
        fontSize={13}
        fontWeight={700}
        fill="#1F2937"
        style={{ userSelect: "none" }}
      >
        {name}
      </text>

      {/* atributos */}
      {(attributes ?? []).map((attr, idx) => {
        const top = HEADER_H + PADDING + idx * ROW_H + 2;

        return (
          <g key={attr.id}>
            {/* Icono de PK o bullet point */}
            <text
              x={PADDING}
              y={top + 12}
              fontSize={11}
              fill={attr.pk ? "#F59E0B" : "#6B7280"}
              style={{ userSelect: "none" }}
            >
              •
            </text>
            {/* Nombre del atributo */}
            <text
              x={PADDING + 16}
              y={top + 12}
              fontSize={12}
              fill="#1F2937"
              fontWeight={attr.pk ? 600 : 400}
              style={{ userSelect: "none" }}
            >
              {attr.name}
            </text>
            {/* Tipo del atributo */}
            <text
              x={PADDING + 16 + attr.name.length * 7}
              y={top + 12}
              fontSize={11}
              fill="#6B7280"
              fontStyle="italic"
              style={{ userSelect: "none" }}
            >
              : {attr.type ?? "string"}
            </text>
            {/* Indicador de requerido */}
            {attr.required && (
              <text
                x={PADDING + 16 + attr.name.length * 7 + (attr.type ?? "string").length * 6 + 10}
                y={top + 12}
                fontSize={11}
                fill="#EF4444"
                fontWeight={700}
                style={{ userSelect: "none" }}
              >
                *
              </text>
            )}
          </g>
        );
      })}

      {/* ====== HANDLES (fuera del map) - Solo visibles en hover ====== */}
      {onStartLink && isHovered && (
        <>
          {/* izquierda */}
          <circle
            cx={0}
            cy={midY}
            r={6}
            fill="#3b82f6"
            stroke="white"
            strokeWidth={1.5}
            style={{ cursor: "crosshair" }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onStartLink(id, "L");
            }}
          />
          {/* derecha */}
          <circle
            cx={width}
            cy={midY}
            r={6}
            fill="#3b82f6"
            stroke="white"
            strokeWidth={1.5}
            style={{ cursor: "crosshair" }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onStartLink(id, "R");
            }}
          />
          {/* arriba */}
          <circle
            cx={midX}
            cy={HEADER_H}
            r={6}
            fill="#3b82f6"
            stroke="white"
            strokeWidth={1.5}
            style={{ cursor: "crosshair" }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onStartLink(id, "T");
            }}
          />
          {/* abajo */}
          <circle
            cx={midX}
            cy={HEADER_H + bodyH}
            r={6}
            fill="#3b82f6"
            stroke="white"
            strokeWidth={1.5}
            style={{ cursor: "crosshair" }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onStartLink(id, "B");
            }}
          />
        </>
      )}
      {/* ====== FIN HANDLES ====== */}

      {/* === HITBOX para asegurar el click en modo Linking === */}
      <rect
        className="entity-hit"
        x={0}
        y={0}
        width={width}
        height={HEADER_H + bodyH}
        fill="transparent"
        pointerEvents="all"
        onPointerDown={(e) => {
          // Cuando el SVG está en modo Linking, esta hitbox captura el click
          onPointerDown(e, id);
        }}
      />
    </g>
  );
});
