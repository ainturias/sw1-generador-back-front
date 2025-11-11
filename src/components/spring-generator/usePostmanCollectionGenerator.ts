// src/components/spring-generator/usePostmanCollectionGenerator.ts
"use client";

import { useStorage } from "@liveblocks/react";
import { LayerType } from "~/types";
import type { EntityLayer, RelationLayer } from "~/types";
import { generateRelationNames } from "~/utils/relationNameGenerator";

/* ---------- helpers ---------- */
type Attr = { id: string; name: string; type: string; required?: boolean; pk?: boolean };
type PlainEntity = EntityLayer & { idInCanvas: string };
type PlainRelation = RelationLayer & { idInCanvas: string };

const sampleForType = (name: string, t: string) => {
  const low = (t || "").toLowerCase();
  if (low === "int" || low === "integer") return 1;
  if (low === "long") return 1;
  if (low === "double") return 1;
  if (low === "boolean") return true;
  if (low === "date") return "2024-01-01";
  return name || "text";
};

const camel = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

/* ---------- hook ---------- */
export function usePostmanCollectionGenerator(projectName: string) {
  const layerIds = useStorage((root) => root.layerIds) || [];
  const layersMap = useStorage((root) => root.layers);

  const readRaw = (id: string): any | null => {
    const live: any = layersMap?.get(id);
    if (!live) return null;
    return typeof live.toImmutable === "function" ? live.toImmutable() : live;
  };

  const getEntitiesAndRelations = () => {
    const entities: PlainEntity[] = [];
    const relations: PlainRelation[] = [];
    for (const id of layerIds) {
      const raw = readRaw(id);
      if (!raw) continue;
      if (raw.type === LayerType.Entity) entities.push({ ...(raw as EntityLayer), idInCanvas: id });
      else if (raw.type === LayerType.Relation) relations.push({ ...(raw as RelationLayer), idInCanvas: id });
    }
    return { entities, relations };
  };

  const generatePostman = async () => {
    const { entities, relations } = getEntitiesAndRelations();
    if (!entities.length) {
      alert("No hay entidades en el lienzo.");
      return;
    }

    // Detectar relaciones de herencia
    const inheritanceMap = new Map<string, { parentId: string; relation: PlainRelation }>();
    for (const rel of relations) {
      if (rel.relationType === "generalization") {
        // source = hijo/subclase, target = padre/superclase
        inheritanceMap.set(rel.sourceId, { parentId: rel.targetId, relation: rel });
      }
    }

    // Mapa de entidades por ID
    const byId = new Map(entities.map((e) => [e.idInCanvas, e]));

    const baseUrlVar = "{{baseUrl}}";
    const collection: any = {
      info: {
        name: `API ${projectName}`,
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      },
      variable: [{ key: "baseUrl", value: "http://localhost:8080/api" }],
      item: [] as any[],
    };

    const makeUrl = (path: string) => ({
      raw: `${baseUrlVar}${path}`,
      host: [baseUrlVar],
      path: path.split("/").filter(Boolean),
    });

    const makeRequest = (
      name: string,
      method: "GET" | "POST" | "PUT" | "DELETE",
      path: string,
      body?: any,
    ) => {
      const req: any = {
        name,
        request: {
          method,
          header: [{ key: "Content-Type", value: "application/json" }],
          url: makeUrl(path),
        },
        response: [],
      };
      if (body) req.request.body = { mode: "raw", raw: JSON.stringify(body, null, 2) };
      return req;
    };

    for (const ent of entities) {
      const className = ent.name.replace(/[^A-Za-z0-9]/g, "") || "Entity";
      const varName = camel(className);
      // El backend usa @RequestMapping("/{entity}") en controllers sin prefijo /api
      // Solo si hay contextPath configurado se agrega
      const basePath = `/${varName}`;

      const attrs = (ent.attributes || []) as Attr[];

      // Verificar si es subclase
      const inheritanceInfo = inheritanceMap.get(ent.idInCanvas);
      const isSubclass = !!inheritanceInfo;

      // Body ejemplo (incluir campos heredados si es subclase)
      const bodyExample: Record<string, any> = {};

      // Si es subclase, agregar campos de la superclase
      if (isSubclass && inheritanceInfo) {
        const parentEntity = entities.find(e => e.idInCanvas === inheritanceInfo.parentId);
        if (parentEntity) {
          const parentAttrs = (parentEntity.attributes || []) as Attr[];
          for (const a of parentAttrs) {
            if (a.pk) continue; // No incluir ID del padre
            const rawField = (a.name || "field").replace(/[^A-Za-z0-9_]/g, "");
            const field = rawField.charAt(0).toLowerCase() + rawField.slice(1);
            bodyExample[field] = sampleForType(field, a.type || "string");
          }
        }
      }

      // Agregar campos propios
      for (const a of attrs) {
        if (a.pk) continue;
        const rawField = (a.name || "field").replace(/[^A-Za-z0-9_]/g, "");
        const field = rawField.charAt(0).toLowerCase() + rawField.slice(1);
        bodyExample[field] = sampleForType(field, a.type || "string");
      }

      // ⬅️ Agregar IDs de relaciones MANY→ONE usando generateRelationNames
      const rels = relations.filter(
        rel => (rel.sourceId === ent.idInCanvas || rel.targetId === ent.idInCanvas)
            && rel.relationType !== "generalization"
      );

      for (const rel of rels) {
        const src = byId.get(rel.sourceId);
        const dst = byId.get(rel.targetId);
        if (!src || !dst) continue;

        const srcMany = rel.sourceCard === "MANY";
        const dstMany = rel.targetCard === "MANY";

        // Solo agregar si es una relación ManyToOne desde esta entidad
        const isSourceEntity = rel.sourceId === ent.idInCanvas;
        const thisHasManyToOne =
          (isSourceEntity && srcMany && !dstMany) ||
          (!isSourceEntity && dstMany && !srcMany);

        if (thisHasManyToOne) {
          const other = isSourceEntity ? dst : src;
          const sourceEntity = isSourceEntity ? ent : other;
          const targetEntity = isSourceEntity ? other : ent;

          const { fieldName, inverseName } = generateRelationNames(
            rel.relationType,
            sourceEntity,
            targetEntity,
            rel.sourceCard,
            rel.targetCard
          );

          const currentFieldName = isSourceEntity ? fieldName : inverseName;
          const otherIdAttr = (other.attributes as Attr[] | undefined)?.find((a) => a.pk);
          const otherIdName = (otherIdAttr?.name ?? "id").replace(/[^A-Za-z0-9_]/g, "") || "id";

          // IMPORTANTE: En DTOs, el campo es "{fieldName}{IdName}" con solo el valor del ID
          const dtoFieldName = `${currentFieldName}${otherIdName.charAt(0).toUpperCase() + otherIdName.slice(1)}`;
          bodyExample[dtoFieldName] = 1;  // Solo el ID, no un objeto anidado
        }
      }

      const folder = { name: className, item: [] as any[] };

      folder.item.push(makeRequest(`GET ${className} - lista`, "GET", `${basePath}`));
      folder.item.push(makeRequest(`GET ${className} - por id`, "GET", `${basePath}/:id`));
      folder.item.push(makeRequest(`POST ${className} - crear`, "POST", `${basePath}`, bodyExample));
      folder.item.push(makeRequest(`PUT ${className} - actualizar`, "PUT", `${basePath}/:id`, bodyExample));
      folder.item.push(makeRequest(`DELETE ${className} - eliminar`, "DELETE", `${basePath}/:id`));

      // Agregar endpoints de búsqueda por relaciones ManyToOne usando generateRelationNames
      for (const rel of rels) {
        const src = byId.get(rel.sourceId);
        const dst = byId.get(rel.targetId);
        if (!src || !dst) continue;

        const srcMany = rel.sourceCard === "MANY";
        const dstMany = rel.targetCard === "MANY";

        const isSourceEntity = rel.sourceId === ent.idInCanvas;
        const thisHasManyToOne =
          (isSourceEntity && srcMany && !dstMany) ||
          (!isSourceEntity && dstMany && !srcMany);

        if (thisHasManyToOne) {
          const other = isSourceEntity ? dst : src;
          const sourceEntity = isSourceEntity ? ent : other;
          const targetEntity = isSourceEntity ? other : ent;

          const { fieldName, inverseName } = generateRelationNames(
            rel.relationType,
            sourceEntity,
            targetEntity,
            rel.sourceCard,
            rel.targetCard
          );

          const currentFieldName = isSourceEntity ? fieldName : inverseName;
          const otherIdAttr = (other.attributes as Attr[] | undefined)?.find((a) => a.pk);
          const otherIdName = (otherIdAttr?.name ?? "id").replace(/[^A-Za-z0-9_]/g, "") || "id";

          folder.item.push(
            makeRequest(
              `GET ${className} - por ${currentFieldName}`,
              "GET",
              `${basePath}/${currentFieldName}/:${otherIdName}`,
            ),
          );
        }
      }

      collection.item.push(folder);
    }

    const blob = new Blob([JSON.stringify(collection, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, "_")}_postman.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return generatePostman;
}
