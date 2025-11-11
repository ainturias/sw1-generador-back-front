"use client";

import { useStorage } from "@liveblocks/react";
import { LayerType } from "~/types";
import type { EntityLayer, RelationLayer } from "~/types";
import { generateRelationNames, toSQLType, toTableName, toColumnName } from "~/utils/relationNameGenerator";

type Attr = { id: string; name: string; type: string; required?: boolean; pk?: boolean };
type PlainEntity = EntityLayer & { idInCanvas: string };
type PlainRelation = RelationLayer & { idInCanvas: string };

export function usePostgreSQLGenerator(projectName: string) {
  const layerIds = useStorage((root) => root.layerIds) || [];
  const layersMap = useStorage((root) => root.layers);
  const projectConfig = useStorage((root) => root.projectConfig);

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

      if (raw.type === LayerType.Entity) {
        entities.push({ ...(raw as EntityLayer), idInCanvas: id });
      } else if (raw.type === LayerType.Relation) {
        relations.push({ ...(raw as RelationLayer), idInCanvas: id });
      }
    }
    return { entities, relations };
  };

  /**
   * Ordenación topológica de entidades basada en dependencias (Foreign Keys)
   * Utiliza el algoritmo de Kahn para detectar dependencias circulares
   * 
   * @param entities Lista de entidades sin ordenar
   * @param relsByEntity Mapa de relaciones por entidad
   * @param inheritanceMap Mapa de herencia (subclase -> padre)
   * @param byId Mapa de entidades por ID
   * @returns Lista de entidades ordenadas topológicamente
   */
  const topologicalSort = (
    entities: PlainEntity[],
    relsByEntity: Record<string, Array<{
      other: PlainEntity;
      srcMany: boolean;
      dstMany: boolean;
      isSource: boolean;
      relation: PlainRelation;
    }>>,
    inheritanceMap: Map<string, { parentId: string; relation: PlainRelation }>,
    byId: Map<string, PlainEntity>
  ): PlainEntity[] => {
    // Construir grafo de dependencias: entityId -> [entidades de las que depende]
    const dependencies = new Map<string, Set<string>>();
    
    for (const ent of entities) {
      const deps = new Set<string>();
      
      // Dependencia por herencia: la subclase depende del padre
      const inheritanceInfo = inheritanceMap.get(ent.idInCanvas);
      if (inheritanceInfo) {
        deps.add(inheritanceInfo.parentId);
      }
      
      // Dependencias por Foreign Keys
      const rels = relsByEntity[ent.idInCanvas] || [];
      for (const r of rels) {
        const relation = r.relation;
        
        // Ignorar herencia (ya la procesamos arriba)
        if (relation.relationType === "generalization") continue;
        
        // Determinar si esta entidad tiene una FK hacia la otra
        const thisHasManyToOne =
          (r.isSource && r.srcMany && !r.dstMany) ||
          (!r.isSource && r.dstMany && !r.srcMany);
        
        const thisIsOneToOne = !r.srcMany && !r.dstMany && !r.isSource;
        
        if (thisHasManyToOne || thisIsOneToOne) {
          // Esta entidad depende de la otra (tiene FK hacia ella)
          deps.add(r.other.idInCanvas);
        }
      }
      
      dependencies.set(ent.idInCanvas, deps);
    }
    
    // Algoritmo de Kahn para ordenación topológica
    const sorted: PlainEntity[] = [];
    const remaining = new Set(entities.map(e => e.idInCanvas));
    
    while (remaining.size > 0) {
      // Buscar entidades sin dependencias pendientes
      const noDeps: string[] = [];
      
      for (const id of remaining) {
        const deps = dependencies.get(id) || new Set();
        // Verificar si todas las dependencias ya fueron procesadas
        const hasUnresolvedDeps = Array.from(deps).some(depId => remaining.has(depId));
        if (!hasUnresolvedDeps) {
          noDeps.push(id);
        }
      }
      
      // Si no hay entidades sin dependencias, hay un ciclo o error
      if (noDeps.length === 0) {
        console.warn(
          "⚠️ Advertencia: Posible dependencia circular detectada en las tablas. " +
          "Se usará el orden original para las tablas restantes."
        );
        // Agregar las restantes en el orden original
        for (const id of remaining) {
          const entity = byId.get(id);
          if (entity) sorted.push(entity);
        }
        break;
      }
      
      // Agregar entidades sin dependencias al resultado
      for (const id of noDeps) {
        const entity = byId.get(id);
        if (entity) sorted.push(entity);
        remaining.delete(id);
      }
    }
    
    return sorted;
  };

  const generatePostgreSQLScript = () => {
    const { entities, relations } = getEntitiesAndRelations();

    if (!entities.length) {
      alert("No hay entidades en el lienzo.");
      return;
    }

    const config = projectConfig;
    const databaseName = config?.databaseName ?? projectName.replace(/\s+/g, "_").toLowerCase();

    let sql = `-- PostgreSQL Database Script
-- Generado desde diagrama UML
-- Database: ${databaseName}
-- Date: ${new Date().toISOString()}

-- ==================================================
-- REGLAS DE MAPEO UML A POSTGRESQL
-- ==================================================
--
-- 1. ASOCIACIÓN (association):
--    - 1:N → Foreign Key en el lado "muchos" con ON DELETE SET NULL
--    - 1:1 → Foreign Key con UNIQUE constraint y ON DELETE SET NULL
--    - N:M → Tabla intermedia con FK compuestas (debe crearse manualmente)
--
-- 2. COMPOSICIÓN (composition) - Diamante relleno:
--    - Foreign Key con ON DELETE CASCADE
--    - La parte NO puede existir sin el todo
--
-- 3. AGREGACIÓN (aggregation) - Diamante vacío:
--    - Foreign Key con ON DELETE SET NULL
--    - La parte PUEDE existir sin el todo
--
-- 4. GENERALIZACIÓN (generalization) - Herencia:
--    - La tabla hija tiene FK que también es PK
--    - FK con ON DELETE CASCADE hacia la tabla padre
--
-- 5. REALIZACIÓN (realization) - Implementación:
--    - Similar a asociación: ON DELETE SET NULL
--
-- 6. DEPENDENCIA (dependency):
--    - No se mapea a nivel de base de datos
--    - Se implementa a nivel de aplicación
--
-- ==================================================

-- ==================================================
-- 1. DROP Y CREATE DATABASE
-- ==================================================

DROP DATABASE IF EXISTS ${databaseName};
CREATE DATABASE ${databaseName};

\\c ${databaseName};

-- ==================================================
-- 2. DROP TABLES (en orden inverso por FKs)
-- ==================================================

`;

    // ==================================================
    // ORDENACIÓN TOPOLÓGICA DE ENTIDADES
    // ==================================================
    // Necesitamos ordenar las entidades según sus dependencias para:
    // 1. DROP en orden inverso (las dependientes primero)
    // 2. CREATE en orden directo (las independientes primero)
    
    const byId = new Map(entities.map((e) => [e.idInCanvas, e]));

    // Mapa de relaciones por entidad
    const relsByEntity: Record<
      string,
      Array<{
        other: PlainEntity;
        srcMany: boolean;
        dstMany: boolean;
        isSource: boolean;
        relation: PlainRelation;
      }>
    > = {};

    for (const rel of relations) {
      const src = byId.get(rel.sourceId);
      const dst = byId.get(rel.targetId);
      if (!src || !dst) continue;

      const srcMany = rel.sourceCard === "MANY";
      const dstMany = rel.targetCard === "MANY";

      (relsByEntity[src.idInCanvas] ||= []).push({
        other: dst,
        srcMany,
        dstMany,
        isSource: true,
        relation: rel,
      });
      (relsByEntity[dst.idInCanvas] ||= []).push({
        other: src,
        srcMany,
        dstMany,
        isSource: false,
        relation: rel,
      });
    }

    // Detectar relaciones de herencia para cada entidad
    const inheritanceMap = new Map<string, { parentId: string; relation: PlainRelation }>();
    for (const rel of relations) {
      if (rel.relationType === "generalization") {
        // En UML, la flecha de herencia apunta desde la subclase hacia la superclase
        // Por lo tanto: source = hijo/subclase, target = padre/superclase
        inheritanceMap.set(rel.sourceId, { parentId: rel.targetId, relation: rel });
      }
    }

    // Ordenar entidades topológicamente
    const sortedEntities = topologicalSort(entities, relsByEntity, inheritanceMap, byId);

    // Drop tables en orden inverso (las dependientes primero)
    for (let i = sortedEntities.length - 1; i >= 0; i--) {
      const ent = sortedEntities[i];
      if (!ent) continue;
      const tableName = toTableName(ent.name);
      sql += `DROP TABLE IF EXISTS ${tableName} CASCADE;\n`;
    }

    sql += `\n-- ==================================================
-- 3. CREATE TABLES
-- ==================================================

`;

    // Generar CREATE TABLE para cada entidad (en orden topológico)
    for (const ent of sortedEntities) {
      const tableName = toTableName(ent.name);
      const attrs = (ent.attributes || []) as Attr[];
      const idAttr = attrs.find((a) => a.pk);
      const idName = toColumnName(idAttr?.name ?? "id");
      const idType = toSQLType(idAttr?.type ?? "long");

      // Verificar si esta entidad es una subclase (herencia)
      const inheritanceInfo = inheritanceMap.get(ent.idInCanvas);
      const isSubclass = !!inheritanceInfo;

      sql += `-- Tabla: ${ent.name}`;
      if (isSubclass) {
        const parentEntity = byId.get(inheritanceInfo.parentId);
        sql += ` (HERENCIA desde ${parentEntity?.name ?? 'desconocido'})`;
      }
      sql += `\n`;
      sql += `CREATE TABLE ${tableName} (\n`;

      if (isSubclass) {
        // Para subclases, el PK es también FK a la superclase
        const parentEntity = byId.get(inheritanceInfo.parentId);
        if (parentEntity) {
          const parentTableName = toTableName(parentEntity.name);
          const parentIdAttr = (parentEntity.attributes as Attr[] | undefined)?.find((a) => a.pk);
          const parentIdName = toColumnName(parentIdAttr?.name ?? "id");

          sql += `    -- PK heredado de ${parentEntity.name}\n`;
          sql += `    ${idName} BIGINT PRIMARY KEY`;
          sql += `,\n    CONSTRAINT fk_${tableName}_${idName} FOREIGN KEY (${idName})`;
          sql += `\n        REFERENCES ${parentTableName}(${parentIdName}) ON DELETE CASCADE`;
        } else {
          // Fallback si no se encuentra el padre
          sql += `    ${idName} BIGSERIAL PRIMARY KEY`;
        }
      } else {
        // Para clases normales, PK con BIGSERIAL (compatible con Long de Java)
        sql += `    ${idName} BIGSERIAL PRIMARY KEY`;
      }

      // Atributos simples (no PK)
      for (const a of attrs) {
        if (a.pk) continue;
        const colName = toColumnName(a.name || "field");
        const colType = toSQLType(a.type ?? "string");
        const nullable = a.required ? " NOT NULL" : "";
        sql += `,\n    ${colName} ${colType}${nullable}`;
      }

      // Foreign Keys para relaciones
      const rels = relsByEntity[ent.idInCanvas] || [];
      for (const r of rels) {
        const relation = r.relation;
        const isSourceEntity = relation.sourceId === ent.idInCanvas;
        const sourceEntity = isSourceEntity ? ent : r.other;
        const targetEntity = isSourceEntity ? r.other : ent;

        // Saltar relaciones de herencia ya procesadas
        const isGeneralization = relation.relationType === "generalization";
        if (isGeneralization) {
          continue; // Ya se procesó como parte del PK
        }

        const { fieldName, inverseName } = generateRelationNames(
          relation.relationType,
          sourceEntity,
          targetEntity,
          relation.sourceCard,
          relation.targetCard
        );

        const currentFieldName = isSourceEntity ? fieldName : inverseName;

        // MANY -> ONE (este lado tiene FK)
        const thisHasManyToOne =
          (r.isSource && r.srcMany && !r.dstMany) ||
          (!r.isSource && r.dstMany && !r.srcMany);

        // ONE -> ONE (puede ir en cualquier lado, por convención lo ponemos en el lado "target")
        const thisIsOneToOne = !r.srcMany && !r.dstMany && !r.isSource;

        if (thisHasManyToOne || thisIsOneToOne) {
          const fkColumnName = toColumnName(currentFieldName) + "_id";
          const otherTableName = toTableName(r.other.name);
          const otherIdAttr = (r.other.attributes as Attr[] | undefined)?.find((a) => a.pk);
          const otherIdName = toColumnName(otherIdAttr?.name ?? "id");

          // Determinar ON DELETE según el tipo de relación UML
          let onDeleteClause = "";
          let relationComment = "";
          if (relation.relationType === "composition") {
            onDeleteClause = " ON DELETE CASCADE";
            relationComment = " -- COMPOSICIÓN: eliminar en cascada";
          } else if (relation.relationType === "aggregation") {
            onDeleteClause = " ON DELETE SET NULL";
            relationComment = " -- AGREGACIÓN: la parte puede existir sola";
          } else if (relation.relationType === "association") {
            onDeleteClause = " ON DELETE SET NULL";
            relationComment = thisIsOneToOne ? " -- ASOCIACIÓN 1:1" : " -- ASOCIACIÓN 1:N";
          } else if (relation.relationType === "realization") {
            onDeleteClause = " ON DELETE SET NULL";
            relationComment = " -- REALIZACIÓN/IMPLEMENTACIÓN";
          } else {
            onDeleteClause = " ON DELETE SET NULL";
            relationComment = "";
          }

          // Para relación 1:1, agregar UNIQUE
          const uniqueConstraint = thisIsOneToOne ? " UNIQUE" : "";

          // Agregar comentario en línea separada para evitar conflictos de sintaxis
          if (relationComment) {
            sql += `,\n    ${relationComment.trim()}\n    ${fkColumnName} BIGINT${uniqueConstraint}`;
          } else {
            sql += `,\n    ${fkColumnName} BIGINT${uniqueConstraint}`;
          }
          sql += `,\n    CONSTRAINT fk_${tableName}_${fkColumnName} FOREIGN KEY (${fkColumnName})`;
          sql += `\n        REFERENCES ${otherTableName}(${otherIdName})${onDeleteClause}`;
        }
      }

      sql += `\n);\n\n`;
    }

    sql += `-- ==================================================
-- 4. CREATE INDEXES (para mejorar rendimiento)
-- ==================================================

`;

    // Crear índices en las Foreign Keys (mejora el rendimiento de JOINs)
    for (const ent of sortedEntities) {
      const tableName = toTableName(ent.name);
      const rels = relsByEntity[ent.idInCanvas] || [];

      for (const r of rels) {
        const relation = r.relation;

        // Saltar herencia (ya tiene índice implícito en PK)
        if (relation.relationType === "generalization") continue;

        const isSourceEntity = relation.sourceId === ent.idInCanvas;
        const sourceEntity = isSourceEntity ? ent : r.other;
        const targetEntity = isSourceEntity ? r.other : ent;

        const { fieldName, inverseName } = generateRelationNames(
          relation.relationType,
          sourceEntity,
          targetEntity,
          relation.sourceCard,
          relation.targetCard
        );

        const currentFieldName = isSourceEntity ? fieldName : inverseName;

        const thisHasManyToOne =
          (r.isSource && r.srcMany && !r.dstMany) ||
          (!r.isSource && r.dstMany && !r.srcMany);

        const thisIsOneToOne = !r.srcMany && !r.dstMany && !r.isSource;

        // Crear índice para ManyToOne y OneToOne (mejora JOINs)
        if (thisHasManyToOne || thisIsOneToOne) {
          const fkColumnName = toColumnName(currentFieldName) + "_id";
          sql += `CREATE INDEX idx_${tableName}_${fkColumnName} ON ${tableName}(${fkColumnName});\n`;
        }
      }
    }

    sql += `\n-- ==================================================
-- 5. INSERT SAMPLE DATA (opcional - descomentar si deseas)
-- ==================================================

`;

    for (const ent of sortedEntities) {
      const tableName = toTableName(ent.name);
      sql += `-- INSERT INTO ${tableName} (...) VALUES (...);\n`;
    }

    const dbHost = config?.databaseHost ?? "localhost";
    const dbPort = config?.databasePort ?? 5432;
    const dbUser = config?.databaseUsername ?? "postgres";

    sql += `\n-- ==================================================
-- 6. INSTRUCCIONES DE USO
-- ==================================================

-- Para ejecutar este script en PostgreSQL:
-- 1. Abre una terminal o pgAdmin
-- 2. Ejecuta: psql -U ${dbUser} -h ${dbHost} -p ${dbPort}
-- 3. Copia y pega este script completo
-- 4. El script creará la base de datos '${databaseName}'
-- 5. Todas las tablas se crearán automáticamente

-- Para conectar Spring Boot:
-- Las credenciales están configuradas en application.properties:
--   - URL: jdbc:postgresql://${dbHost}:${dbPort}/${databaseName}
--   - Usuario: ${dbUser}
--   - Password: (configurado en el modal de configuración)

-- NOTA: Asegúrate de tener PostgreSQL instalado y ejecutándose
-- NOTA: Las credenciales deben coincidir con las configuradas en el modal

-- COMPATIBILIDAD:
-- - BIGSERIAL/BIGINT mapea a Long en Java/JPA
-- - ON DELETE CASCADE para composición y herencia
-- - ON DELETE SET NULL para asociación y agregación
-- - UNIQUE constraint para relaciones 1:1

-- Script completado exitosamente
-- ==================================================
`;

    // Descargar archivo SQL
    const blob = new Blob([sql], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${databaseName}_schema.sql`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return generatePostgreSQLScript;
}
