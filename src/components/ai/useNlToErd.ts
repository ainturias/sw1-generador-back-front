// src/components/ai/useNlToErd.ts
"use client";

import { useMutation, useStorage } from "@liveblocks/react";
import { LiveObject } from "@liveblocks/client";
import {
  LayerType,
  type EntityLayer,
  type RelationLayer,
  type DBAttribute,
  type DBPrimitive,
} from "~/types";

 

/* ======= helpers de formato ======= */
const sanitizeName = (s: string, fallback = "Entity") => {
  const x = (s || "").trim().replace(/[^A-Za-z0-9_]/g, "");
  return x || fallback;
};
 // const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Convierte string de la IA -> tu union DBPrimitive */
function toDBPrimitive(t: string | undefined): DBPrimitive {
  const v = (t || "string").toLowerCase();
  switch (v) {
    case "int":
    case "integer":
      return "int";
    case "long":
      return "long";
    case "double":
    case "float":
      return "double";
    case "boolean":
    case "bool":
      return "boolean";
    case "date":
    case "localdate":
      return "date";
    case "string":
    default:
      return "string";
  }
}

/** type guard: LiveObject -> LiveObject<EntityLayer> si es entidad */
function asLiveEntity(
  lo: any,
): LiveObject<EntityLayer> | null {
  const t = lo?.get?.("type");
  return t === LayerType.Entity ? (lo as LiveObject<EntityLayer>) : null;
}

/** layout simple en grid */
function gridLayout(n: number) {
  const cols = Math.ceil(Math.sqrt(n));
  const startX = 120;
  const startY = 160;
  const dx = 320;
  const dy = 220;
  return Array.from({ length: n }, (_, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    return { x: startX + c * dx, y: startY + r * dy };
  });
}

/* ======= tipos que devuelve la IA ======= */
type AiAttr = { name: string; type?: string; required?: boolean; pk?: boolean };
type AiEntity = { name: string; attributes: AiAttr[] };
type AiRelation = {
  sourceName: string;
  targetName: string;
  sourceCard: "ONE" | "MANY";
  targetCard: "ONE" | "MANY";
  owningSide: "source" | "target";
};
type AiResponse = {
  entities: AiEntity[];
  relations: AiRelation[];
};

export default  function useNlToErd() {
  // si layerIds llega undefined, usa []
  const layerIds = useStorage((root) => root.layerIds) ?? [];

  const clearCanvas = useMutation(({ storage }) => {
    const layers = storage.get("layers");
    const ids = [...(storage.get("layerIds") as any)];
    for (const id of ids) layers.delete(id as string);
    const liveIds = storage.get("layerIds");
    for (let i = liveIds.length - 1; i >= 0; i--) liveIds.delete(i);
  }, []);

  const applyToCanvas = useMutation(
    ({ storage }, data: AiResponse, opts?: { replace?: boolean }) => {
      const replace = !!opts?.replace;

      const liveLayers = storage.get("layers");
      const liveIds = storage.get("layerIds");

      // Indexar existentes por nombre si NO reemplazamos
      const existingByName = new Map<string, string>();
      if (!replace) {
        for (const id of layerIds as string[]) {
          const lo = liveLayers.get(id);
          const e = asLiveEntity(lo);
          if (e) {
            const n = sanitizeName(e.get("name") as string);
            existingByName.set(n, id);
          }
        }
      } else {
        // limpiar todo
        const ids = [...(liveIds as any)];
        for (const id of ids) liveLayers.delete(id);
        for (let i = liveIds.length - 1; i >= 0; i--) liveIds.delete(i);
      }

      // === ENTIDADES ===
      const positions = gridLayout((data.entities ?? []).length);
      const idByName = new Map<string, string>();

      (data.entities ?? []).forEach((ent, i) => {
        const className = sanitizeName(ent?.name, "Entity");

        // Mapea atributos de la IA -> DBAttribute[]
        const attrs: DBAttribute[] = (ent?.attributes ?? []).map((a) => ({
          id: crypto.randomUUID(),
          name: sanitizeName(a?.name || "campo", "campo"),
          type: toDBPrimitive(a?.type),
          required: !!a?.required,
          pk: !!a?.pk,
        }));

        // Garantiza PK
        if (!attrs.some((a) => a.pk)) {
          attrs.unshift({
            id: crypto.randomUUID(),
            name: "id",
            type: "long",
            required: true,
            pk: true,
          });
        }

        // Reusar si existe y NO estamos reemplazando
        const existingId = existingByName.get(className);
        if (existingId) {
          const lo = asLiveEntity(liveLayers.get(existingId));
          if (lo) {
            lo.update({ name: className, attributes: attrs });
            idByName.set(className, existingId);
            return;
          }
        }

        // Crear entidad nueva
        const id = crypto.randomUUID();
        const p = positions[i] ?? { x: 120 + i * 40, y: 120 + i * 40 };
        const entity: EntityLayer = {
          type: LayerType.Entity,
          x: p.x,
          y: p.y,
          width: 240,
          height: 140,
          name: className,
          attributes: attrs,
          opacity: 100,
        };
        liveLayers.set(id, new LiveObject<EntityLayer>(entity));
        liveIds.push(id);
        idByName.set(className, id);
      });

      // === RELACIONES ===
      for (const r of data.relations ?? []) {
        const srcName = sanitizeName(r.sourceName);
        const dstName = sanitizeName(r.targetName);
        const sourceId = idByName.get(srcName);
        const targetId = idByName.get(dstName);
        if (!sourceId || !targetId) continue;

        const rel: RelationLayer = {
          type: LayerType.Relation,
          sourceId,
          targetId,
          sourceCard: r.sourceCard === "MANY" ? "MANY" : "ONE",
          targetCard: r.targetCard === "MANY" ? "MANY" : "ONE",
          owningSide: r.owningSide === "source" ? "source" : "target",
          opacity: 100,
        };
        const id = crypto.randomUUID();
        liveLayers.set(id, new LiveObject<RelationLayer>(rel));
        liveIds.push(id);
      }
    },
    [layerIds],
  );

  async function fromDescription(prompt: string, opts?: { replace?: boolean }) {
    const res = await fetch("/api/ai/nl-to-erd", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json?.error || "No se pudo generar el ERD");
    }
    const data: AiResponse = {
      entities: Array.isArray(json.entities) ? json.entities : [],
      relations: Array.isArray(json.relations) ? json.relations : [],
    };
    applyToCanvas(data, opts);
    console.log("fromDescription", data);
    return data;
  }

  return { fromDescription, clearCanvas };
}
