// src/components/spring-generator/useSpringBootGenerator.ts
"use client";

import JSZip from "jszip";
import { useStorage } from "@liveblocks/react";
import { LayerType } from "~/types";
import type { EntityLayer, RelationLayer, ProjectConfig } from "~/types";
import { generateRelationNames, toJavaType, toTableName, toColumnName } from "~/utils/relationNameGenerator";

type Attr = { id: string; name: string; type: string; required?: boolean; pk?: boolean };

type PlainEntity = EntityLayer & { idInCanvas: string };
type PlainRelation = RelationLayer & { idInCanvas: string };

export function useSpringBootGenerator(projectName: string) {
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

  const generateSpringBootZip = async () => {
    const { entities, relations } = getEntitiesAndRelations();

    if (!entities.length) {
      alert("No hay entidades en el lienzo.");
      return;
    }

    // Usar ProjectConfig o valores por defecto
    const config = projectConfig?.toImmutable?.() ?? projectConfig;
    const basePkg = config?.groupId ?? "com.example.demo";
    const artifactId = config?.artifactId ?? projectName.replace(/\s+/g, "-").toLowerCase();
    const version = config?.version ?? "1.0.0";
    const javaVersion = config?.javaVersion ?? "17";
    const springBootVersion = config?.springBootVersion ?? "3.2.0";
    const database = config?.database ?? "h2";
    const databaseName = config?.databaseName ?? "testdb";
    const serverPort = config?.serverPort ?? 8080;
    const contextPath = config?.contextPath ?? "";

    const zip = new JSZip();

    // ── estructura base del proyecto
    const pkgPath = basePkg.replace(/\./g, "/");
    const root = `spring-${artifactId}`;

    // pom.xml
    zip.file(
      `${root}/pom.xml`,
      `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>${basePkg}</groupId>
  <artifactId>${artifactId}</artifactId>
  <version>${version}</version>
  <name>${config?.projectName ?? projectName}</name>
  <description>${config?.description ?? "Generado desde diagrama UML"}</description>
  <properties>
    <java.version>${javaVersion}</java.version>
    <spring-boot.version>${springBootVersion}</spring-boot.version>
  </properties>
  <dependencyManagement>
    <dependencies>
      <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-dependencies</artifactId>
        <version>\${spring-boot.version}</version>
        <type>pom</type>
        <scope>import</scope>
      </dependency>
    </dependencies>
  </dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>
    ${
      database === "h2"
        ? `<dependency>
      <groupId>com.h2database</groupId>
      <artifactId>h2</artifactId>
      <scope>runtime</scope>
    </dependency>`
        : database === "mysql"
        ? `<dependency>
      <groupId>com.mysql</groupId>
      <artifactId>mysql-connector-j</artifactId>
      <scope>runtime</scope>
    </dependency>`
        : database === "postgresql"
        ? `<dependency>
      <groupId>org.postgresql</groupId>
      <artifactId>postgresql</artifactId>
      <scope>runtime</scope>
    </dependency>`
        : database === "oracle"
        ? `<dependency>
      <groupId>com.oracle.database.jdbc</groupId>
      <artifactId>ojdbc8</artifactId>
      <scope>runtime</scope>
    </dependency>`
        : ""
    }
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-validation</artifactId>
    </dependency>
  </dependencies>
  <build>
    <plugins>
      <plugin>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-maven-plugin</artifactId>
        <version>\${spring-boot.version}</version>
      </plugin>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-compiler-plugin</artifactId>
        <version>3.13.0</version>
        <configuration>
            <parameters>true</parameters>
        </configuration>
      </plugin>
    </plugins>
  </build>
</project>`
    );

    // application.properties con credenciales configurables
    const dbHost = config?.databaseHost ?? "localhost";
    const dbPort = config?.databasePort ?? (database === "postgresql" ? 5432 : database === "mysql" ? 3306 : database === "oracle" ? 1521 : 3306);
    const dbUser = config?.databaseUsername ?? (database === "h2" ? "sa" : "postgres");
    const dbPassword = config?.databasePassword ?? (database === "h2" ? "" : "password");

    const datasourceUrl =
      database === "h2"
        ? `jdbc:h2:mem:${databaseName}`
        : database === "mysql"
        ? `jdbc:mysql://${dbHost}:${dbPort}/${databaseName}`
        : database === "postgresql"
        ? `jdbc:postgresql://${dbHost}:${dbPort}/${databaseName}`
        : database === "oracle"
        ? `jdbc:oracle:thin:@${dbHost}:${dbPort}:${databaseName}`
        : `jdbc:h2:mem:${databaseName}`;

    zip.file(
      `${root}/src/main/resources/application.properties`,
      `# Server Configuration
server.port=${serverPort}${contextPath ? `\nserver.servlet.context-path=${contextPath}` : ""}

# Database Configuration
spring.datasource.url=${datasourceUrl}
spring.datasource.username=${dbUser}
spring.datasource.password=${dbPassword}
${database === "h2" ? "spring.h2.console.enabled=true" : ""}

# JPA Configuration
spring.jpa.hibernate.ddl-auto=none
spring.jpa.show-sql=true
spring.jpa.properties.hibernate.format_sql=true
spring.jpa.properties.hibernate.dialect=${database === "postgresql" ? "org.hibernate.dialect.PostgreSQLDialect" : database === "mysql" ? "org.hibernate.dialect.MySQLDialect" : "org.hibernate.dialect.H2Dialect"}

# Logging
logging.level.org.hibernate.SQL=DEBUG
logging.level.org.hibernate.type.descriptor.sql.BasicBinder=TRACE`
    );

    // Application
    zip.file(
      `${root}/src/main/java/${pkgPath}/DemoApplication.java`,
      `package ${basePkg};

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class DemoApplication {
  public static void main(String[] args) {
    SpringApplication.run(DemoApplication.class, args);
  }
}`
    );

    // ── directorios por capa
    const modelDir = `${root}/src/main/java/${pkgPath}/model`;
    const dtoDir = `${root}/src/main/java/${pkgPath}/dto`;
    const mapperDir = `${root}/src/main/java/${pkgPath}/mapper`;
    const repoDir = `${root}/src/main/java/${pkgPath}/repository`;
    const svcDir = `${root}/src/main/java/${pkgPath}/service`;
    const ctrlDir = `${root}/src/main/java/${pkgPath}/controller`;

    const byId = new Map(entities.map((e) => [e.idInCanvas, e]));

    // Detectar relaciones de herencia
    const inheritanceMap = new Map<string, { parentId: string; relation: PlainRelation }>();
    for (const rel of relations) {
      if (rel.relationType === "generalization") {
        // source = hijo/subclase, target = padre/superclase
        inheritanceMap.set(rel.sourceId, { parentId: rel.targetId, relation: rel });
      }
    }

    // Mapa relaciones por entidad
    const relsByEntity: Record<
      string,
      Array<{
        other: PlainEntity;
        srcMany: boolean;
        dstMany: boolean;
        owningSide: "source" | "target";
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
      const owning: "source" | "target" =
        rel.owningSide === "source" ? "source" : "target";

      (relsByEntity[src.idInCanvas] ||= []).push({
        other: dst,
        srcMany,
        dstMany,
        owningSide: owning,
        isSource: true,
        relation: rel,
      });
      (relsByEntity[dst.idInCanvas] ||= []).push({
        other: src,
        srcMany,
        dstMany,
        owningSide: owning,
        isSource: false,
        relation: rel,
      });
    }

    for (const ent of entities) {
      const className = ent.name.replace(/[^A-Za-z0-9]/g, "") || "Entity";
      const varName = className.charAt(0).toLowerCase() + className.slice(1);

      const attrs = (ent.attributes || []) as Attr[];
      const idAttr = attrs.find((a) => a.pk);
      const idName = (idAttr?.name ?? "id").replace(/[^A-Za-z0-9_]/g, "") || "id";
      const idTypeJava = toJavaType(idAttr?.type ?? "Long");

      // Verificar si es subclase o superclase
      const inheritanceInfo = inheritanceMap.get(ent.idInCanvas);
      const isSubclass = !!inheritanceInfo;
      const isSuperclass = Array.from(inheritanceMap.values()).some(
        info => info.parentId === ent.idInCanvas
      );

      // ===== MODEL =====
      let fields = "";
      const tableName = toTableName(ent.name);
      let classAnnotations = `@Entity\n@Table(name = "${tableName}")\n`;
      let extendsClause = "";

      if (isSubclass) {
        // Esta es una subclase - no genera ID, lo hereda
        const parentEntity = byId.get(inheritanceInfo.parentId);
        if (parentEntity) {
          const parentClassName = parentEntity.name.replace(/[^A-Za-z0-9]/g, "") || "Entity";
          extendsClause = ` extends ${parentClassName}`;
          // No generamos el ID aquí, se hereda del padre
        }
      } else if (isSuperclass) {
        // Esta es una superclase - ID protected para que hereden las subclases
        classAnnotations += "@Inheritance(strategy = InheritanceType.JOINED)\n";
        fields = `  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  protected ${idTypeJava} ${idName};\n`;
      } else {
        // Clase normal
        fields = `  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private ${idTypeJava} ${idName};\n`;
      }

      // Atributos simples (protected si es superclase, private si no)
      const fieldVisibility = isSuperclass ? "protected" : "private";
      for (const a of attrs) {
        if (a.pk) continue;
        const j = toJavaType(a.type ?? "String");
        // Normalizar nombre de campo a camelCase (primera letra minúscula)
        const rawName = (a.name || "field").replace(/[^A-Za-z0-9_]/g, "");
        const n = rawName.charAt(0).toLowerCase() + rawName.slice(1);
        const columnName = toColumnName(a.name || "field");
        fields += `  @Column(name = "${columnName}")\n`;
        fields += `  ${fieldVisibility} ${j} ${n};\n`;
      }

      // Relaciones y acceso extra
      const rels = relsByEntity[ent.idInCanvas] || [];
      const relationAccessors: string[] = [];
      const manyToOneFinders: Array<{
        fieldName: string;
        targetIdType: string;
        targetIdFieldName: string;
      }> = [];

      for (const r of rels) {
        const otherName = r.other.name.replace(/[^A-Za-z0-9]/g, "") || "Other";
        const relation = r.relation;

        // Saltar relaciones de herencia (ya se manejan con extends)
        if (relation.relationType === "generalization") {
          continue;
        }

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

        // Determinar qué nombre usar en esta entidad
        const currentFieldName = isSourceEntity ? fieldName : inverseName;
        const otherFieldName = isSourceEntity ? inverseName : fieldName;

        // Determinar el tipo de relación por cardinalidad
        const thisHasManyToOne =
          (r.isSource && r.srcMany && !r.dstMany) ||
          (!r.isSource && r.dstMany && !r.srcMany);

        const thisHasOneToMany =
          (r.isSource && !r.srcMany && r.dstMany) ||
          (!r.isSource && !r.dstMany && r.srcMany);

        const thisIsOneToOne = !r.srcMany && !r.dstMany;
        const isManyToMany = r.srcMany && r.dstMany;

        // Determinar cascade según tipo UML y tipo de relación JPA
        let cascadeForOneToMany = "";
        let cascadeForManyToOne = "";
        let cascadeForOneToOne = "";

        if (relation.relationType === "composition") {
          // Composición: La relación es unidireccional en cuanto a eliminación
          // - Lado "TODO" (OneToMany): CASCADE ALL + orphanRemoval
          // - Lado "PARTE" (ManyToOne): SOLO PERSIST/MERGE (sin REMOVE)
          // Esto evita que eliminar una "parte" elimine el "todo"
          cascadeForOneToMany = "cascade = CascadeType.ALL, orphanRemoval = true";
          cascadeForOneToOne = "cascade = CascadeType.ALL, orphanRemoval = true";
          cascadeForManyToOne = "cascade = {CascadeType.PERSIST, CascadeType.MERGE}";
        } else if (relation.relationType === "aggregation") {
          // Agregación: CASCADE limitado en ambos lados
          cascadeForOneToMany = "cascade = {CascadeType.PERSIST, CascadeType.MERGE}";
          cascadeForOneToOne = "cascade = {CascadeType.PERSIST, CascadeType.MERGE}";
          cascadeForManyToOne = "cascade = {CascadeType.PERSIST, CascadeType.MERGE}";
        } else {
          // Asociación, Realización, Dependencia: CASCADE limitado
          cascadeForOneToMany = "cascade = {CascadeType.PERSIST, CascadeType.MERGE}";
          cascadeForOneToOne = "cascade = {CascadeType.PERSIST, CascadeType.MERGE}";
          cascadeForManyToOne = "cascade = {CascadeType.PERSIST, CascadeType.MERGE}";
        }

        if (isManyToMany) {
          // @ManyToMany - Solo el lado "owner" tiene @JoinTable
          const isOwner = r.isSource ? r.owningSide === "source" : r.owningSide === "target";

          const srcTable = toTableName(r.isSource ? ent.name : r.other.name);
          const dstTable = toTableName(r.isSource ? r.other.name : ent.name);
          const junctionTableName = [srcTable, dstTable].sort().join("_");

          const cascadeClause = cascadeForManyToOne ? `, ${cascadeForManyToOne}` : "";

          if (isOwner) {
            // Lado owner con @JoinTable
            fields += `
  @ManyToMany${cascadeClause}
  @JoinTable(
    name = "${junctionTableName}",
    joinColumns = @JoinColumn(name = "${srcTable.replace(/_/g, "")}_id"),
    inverseJoinColumns = @JoinColumn(name = "${dstTable.replace(/_/g, "")}_id")
  )
  private java.util.Set<${otherName}> ${currentFieldName} = new java.util.HashSet<>();\n`;
          } else {
            // Lado inverso con mappedBy
            fields += `
  @ManyToMany(mappedBy = "${otherFieldName}"${cascadeClause})
  private java.util.Set<${otherName}> ${currentFieldName} = new java.util.HashSet<>();\n`;
          }

          relationAccessors.push(
            `  public java.util.Set<${otherName}> get${capitalize(currentFieldName)}(){ return this.${currentFieldName}; }
  public void set${capitalize(currentFieldName)}(java.util.Set<${otherName}> ${currentFieldName}){ this.${currentFieldName} = ${currentFieldName}; }`,
          );
        } else if (thisIsOneToOne) {
          // @OneToOne - la FK puede estar en cualquier lado
          const isOwner = !r.isSource; // Por convención, ponemos FK en el lado "target"

          const cascadeClause = cascadeForOneToOne ? `, ${cascadeForOneToOne}` : "";

          if (isOwner) {
            // Lado con FK
            fields += `
  @OneToOne(fetch = FetchType.LAZY${cascadeClause})
  @JoinColumn(name = "${currentFieldName}_id", unique = true)
  private ${otherName} ${currentFieldName};\n`;
          } else {
            // Lado sin FK (mappedBy)
            fields += `
  @OneToOne(mappedBy = "${otherFieldName}"${cascadeClause})
  private ${otherName} ${currentFieldName};\n`;
          }

          relationAccessors.push(
            `  public ${otherName} get${capitalize(currentFieldName)}(){ return this.${currentFieldName}; }
  public void set${capitalize(currentFieldName)}(${otherName} ${currentFieldName}){ this.${currentFieldName} = ${currentFieldName}; }`,
          );
        } else if (thisHasManyToOne) {
          // @ManyToOne - este lado tiene la FK (NO soporta orphanRemoval)
          const cascadeClause = cascadeForManyToOne ? `, ${cascadeForManyToOne}` : "";

          // Usar @JsonIgnore para evitar bucles infinitos y problemas con proxies de Hibernate
          fields += `
  @ManyToOne(fetch = FetchType.LAZY${cascadeClause})
  @JoinColumn(name = "${currentFieldName}_id")
  @com.fasterxml.jackson.annotation.JsonIgnore
  private ${otherName} ${currentFieldName};\n`;

          relationAccessors.push(
            `  public ${otherName} get${capitalize(currentFieldName)}(){ return this.${currentFieldName}; }
  public void set${capitalize(currentFieldName)}(${otherName} ${currentFieldName}){ this.${currentFieldName} = ${currentFieldName}; }`,
          );

          // Para generar repo/service/controller de filtrado por padre
          const otherIdAttr = (r.other.attributes as Attr[] | undefined)?.find((a) => a.pk);
          const otherIdType = toJavaType(otherIdAttr?.type ?? "Long");
          const otherIdFieldName = (otherIdAttr?.name ?? "id").replace(/[^A-Za-z0-9_]/g, "") || "id";
          manyToOneFinders.push({
            fieldName: currentFieldName,
            targetIdType: otherIdType,
            targetIdFieldName: otherIdFieldName
          });
        } else if (thisHasOneToMany) {
          // @OneToMany - mappedBy apunta al campo del lado MANY
          const cascadeClause = cascadeForOneToMany ? `, ${cascadeForOneToMany}` : "";

          fields += `
  @OneToMany(mappedBy = "${otherFieldName}"${cascadeClause})
  private java.util.List<${otherName}> ${currentFieldName} = new java.util.ArrayList<>();\n`;

          relationAccessors.push(
            `  public java.util.List<${otherName}> get${capitalize(currentFieldName)}(){ return this.${currentFieldName}; }
  public void set${capitalize(currentFieldName)}(java.util.List<${otherName}> ${currentFieldName}){ this.${currentFieldName} = ${currentFieldName}; }`,
          );
        }
      }

      const baseAccessors = [
        { name: idName, type: idTypeJava },
        ...attrs
          .filter((a) => !a.pk)
          .map((a) => {
            const rawName = (a.name || "field").replace(/[^A-Za-z0-9_]/g, "");
            const normalizedName = rawName.charAt(0).toLowerCase() + rawName.slice(1);
            return {
              name: normalizedName,
              type: toJavaType(a.type || "String"),
            };
          }),
      ]
        .map(({ name, type }) => {
          const N = capitalize(name);
          return `  public ${type} get${N}(){ return this.${name}; }
  public void set${N}(${type} ${name}){ this.${name} = ${name}; }`;
        })
        .join("\n");

      const model = `package ${basePkg}.model;

import jakarta.persistence.*;
import java.time.*;
import java.util.*;

${classAnnotations}public class ${className}${extendsClause} {

${fields}
  // getters & setters
${baseAccessors}
${relationAccessors.length ? "\n" + relationAccessors.join("\n") : ""}
}
`;
      zip.file(`${modelDir}/${className}.java`, model);

      // ===== DTO =====
      // Generar DTO con solo los campos básicos + IDs de las relaciones ManyToOne
      let dtoFields = "";
      let dtoAccessors = "";

      // Campos básicos (ID + atributos propios + atributos heredados)
      const dtoFieldsList: Array<{name: string, type: string}> = [
        { name: idName, type: idTypeJava }
      ];

      // Si es subclase, agregar campos de la superclase
      if (isSubclass && inheritanceInfo) {
        const parentEntity = byId.get(inheritanceInfo.parentId);
        if (parentEntity) {
          const parentAttrs = (parentEntity.attributes || []) as Attr[];
          for (const a of parentAttrs) {
            if (a.pk) continue; // No incluir ID del padre (se hereda)
            const rawName = (a.name || "field").replace(/[^A-Za-z0-9_]/g, "");
            const normalizedName = rawName.charAt(0).toLowerCase() + rawName.slice(1);
            dtoFieldsList.push({
              name: normalizedName,
              type: toJavaType(a.type || "String")
            });
          }
        }
      }

      // Agregar campos propios de la entidad
      for (const a of attrs) {
        if (a.pk) continue;
        const rawName = (a.name || "field").replace(/[^A-Za-z0-9_]/g, "");
        const normalizedName = rawName.charAt(0).toLowerCase() + rawName.slice(1);
        dtoFieldsList.push({
          name: normalizedName,
          type: toJavaType(a.type || "String")
        });
      }

      // Agregar IDs de relaciones ManyToOne
      for (const r of rels) {
        const relation = r.relation;
        if (relation.relationType === "generalization") continue;

        const thisHasManyToOne =
          (r.isSource && r.srcMany && !r.dstMany) ||
          (!r.isSource && r.dstMany && !r.srcMany);

        if (thisHasManyToOne) {
          const otherIdAttr = (r.other.attributes as Attr[] | undefined)?.find((a) => a.pk);
          const otherIdName = (otherIdAttr?.name ?? "id").replace(/[^A-Za-z0-9_]/g, "") || "id";
          const otherIdType = toJavaType(otherIdAttr?.type ?? "Long");
          const otherName = r.other.name.replace(/[^A-Za-z0-9]/g, "") || "Other";

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

          dtoFieldsList.push({ name: `${currentFieldName}${capitalize(otherIdName)}`, type: otherIdType });
        }
      }

      // Generar fields y accessors para el DTO
      for (const {name, type} of dtoFieldsList) {
        dtoFields += `  private ${type} ${name};\n`;
        const N = capitalize(name);
        dtoAccessors += `  public ${type} get${N}(){ return this.${name}; }
  public void set${N}(${type} ${name}){ this.${name} = ${name}; }\n`;
      }

      const dto = `package ${basePkg}.dto;

import java.time.*;
import java.util.*;

public class ${className}DTO {

${dtoFields}
  // getters & setters
${dtoAccessors}}
`;
      zip.file(`${dtoDir}/${className}DTO.java`, dto);

      // ===== MAPPER =====
      // Generar mapper para Entity <-> DTO
      let toEntityMappings = "";
      let toDTOMappings = "";
      const relatedEntityImports = new Set<string>();

      // Mapeos básicos
      for (const {name} of dtoFieldsList) {
        const N = capitalize(name);
        const isRelationId = name.includes(capitalize(idName)) && name !== idName;

        if (!isRelationId) {
          // Campo simple
          toEntityMappings += `    entity.set${N}(dto.get${N}());\n`;
          toDTOMappings += `    dto.set${N}(entity.get${N}());\n`;
        }
      }

      // Mapeos de relaciones ManyToOne
      for (const r of rels) {
        const relation = r.relation;
        if (relation.relationType === "generalization") continue;

        const thisHasManyToOne =
          (r.isSource && r.srcMany && !r.dstMany) ||
          (!r.isSource && r.dstMany && !r.srcMany);

        if (thisHasManyToOne) {
          const otherName = r.other.name.replace(/[^A-Za-z0-9]/g, "") || "Other";
          const otherIdAttr = (r.other.attributes as Attr[] | undefined)?.find((a) => a.pk);
          const otherIdName = (otherIdAttr?.name ?? "id").replace(/[^A-Za-z0-9_]/g, "") || "id";

          // Agregar import de la entidad relacionada
          relatedEntityImports.add(otherName);

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
          const fieldNameCap = capitalize(currentFieldName);
          const dtoIdField = `${currentFieldName}${capitalize(otherIdName)}`;
          const dtoIdFieldCap = capitalize(dtoIdField);

          // Entity -> DTO: extraer solo el ID
          toDTOMappings += `    if (entity.get${fieldNameCap}() != null) {
      dto.set${dtoIdFieldCap}(entity.get${fieldNameCap}().get${capitalize(otherIdName)}());
    }\n`;

          // DTO -> Entity: crear referencia solo con ID
          toEntityMappings += `    if (dto.get${dtoIdFieldCap}() != null) {
      ${otherName} ref = new ${otherName}();
      ref.set${capitalize(otherIdName)}(dto.get${dtoIdFieldCap}());
      entity.set${fieldNameCap}(ref);
    }\n`;
        }
      }

      // Generar imports de entidades relacionadas
      const relatedImports = Array.from(relatedEntityImports)
        .map(entity => `import ${basePkg}.model.${entity};`)
        .join("\n");

      const mapper = `package ${basePkg}.mapper;

import ${basePkg}.model.${className};
import ${basePkg}.dto.${className}DTO;
${relatedImports ? relatedImports + "\n" : ""}import java.util.List;
import java.util.stream.Collectors;

public class ${className}Mapper {

  public static ${className}DTO toDTO(${className} entity) {
    if (entity == null) return null;
    ${className}DTO dto = new ${className}DTO();
${toDTOMappings}    return dto;
  }

  public static ${className} toEntity(${className}DTO dto) {
    if (dto == null) return null;
    ${className} entity = new ${className}();
${toEntityMappings}    return entity;
  }

  public static void updateEntityFromDTO(${className}DTO dto, ${className} entity) {
    if (dto == null || entity == null) return;
${toEntityMappings}  }

  public static List<${className}DTO> toDTOList(List<${className}> entities) {
    if (entities == null) return null;
    return entities.stream().map(${className}Mapper::toDTO).collect(Collectors.toList());
  }

  public static List<${className}> toEntityList(List<${className}DTO> dtos) {
    if (dtos == null) return null;
    return dtos.stream().map(${className}Mapper::toEntity).collect(Collectors.toList());
  }
}
`;
      zip.file(`${mapperDir}/${className}Mapper.java`, mapper);

      // ===== REPOSITORY =====
      // Extendemos con findBy<ManyToOneField>_<IdField> usando Spring Data JPA property expressions
      let extraRepoMethods = "";
      for (const f of manyToOneFinders) {
        extraRepoMethods += `\n  java.util.List<${className}> findBy${capitalize(f.fieldName)}_${capitalize(f.targetIdFieldName)}(${f.targetIdType} ${f.targetIdFieldName});`;
      }

      const repo = `package ${basePkg}.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ${basePkg}.model.${className};

public interface ${className}Repository extends JpaRepository<${className}, ${idTypeJava}> {${extraRepoMethods}
}
`;
      zip.file(`${repoDir}/${className}Repository.java`, repo);

      // ===== SERVICE =====
      let extraService = "";
      for (const f of manyToOneFinders) {
        extraService += `
  public java.util.List<${className}> findBy${capitalize(f.fieldName)}(${f.targetIdType} ${f.targetIdFieldName}){
    return repo.findBy${capitalize(f.fieldName)}_${capitalize(f.targetIdFieldName)}(${f.targetIdFieldName});
  }`;
      }

      // Generar imports de repositorios relacionados y método de resolución
      const relatedRepoImports = Array.from(relatedEntityImports)
        .map(entity => `import ${basePkg}.repository.${entity}Repository;`)
        .join("\n");

      const relatedRepoFields = Array.from(relatedEntityImports)
        .map(entity => `  private final ${entity}Repository ${entity.charAt(0).toLowerCase() + entity.slice(1)}Repository;`)
        .join("\n");

      const constructorParams = Array.from(relatedEntityImports)
        .map(entity => `${entity}Repository ${entity.charAt(0).toLowerCase() + entity.slice(1)}Repository`)
        .join(", ");

      const constructorAssignments = Array.from(relatedEntityImports)
        .map(entity => {
          const varName = entity.charAt(0).toLowerCase() + entity.slice(1);
          return `    this.${varName}Repository = ${varName}Repository;`;
        })
        .join("\n");

      const hasRelations = relatedEntityImports.size > 0;

      // Generar imports de entidades relacionadas para el Service
      const relatedEntityServiceImports = Array.from(relatedEntityImports)
        .map(entity => `import ${basePkg}.model.${entity};`)
        .join("\n");

      const service = `package ${basePkg}.service;

import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ${basePkg}.model.${className};
import ${basePkg}.repository.${className}Repository;
${relatedRepoImports ? relatedRepoImports + "\n" : ""}${relatedEntityServiceImports ? relatedEntityServiceImports + "\n" : ""}
@Service
@Transactional
public class ${className}Service {
  private final ${className}Repository repo;
${hasRelations ? relatedRepoFields : ""}

  public ${className}Service(${className}Repository repo${hasRelations ? ", " + constructorParams : ""}) {
    this.repo = repo;
${hasRelations ? constructorAssignments : ""}
  }

  public List<${className}> findAll(){ return repo.findAll(); }
  public ${className} findById(${idTypeJava} id){ return repo.findById(id).orElse(null); }

  public ${className} save(${className} e){
    // Resolver referencias de entidades relacionadas antes de guardar
    // El Mapper crea referencias "stub" con solo el ID, necesitamos cargar la entidad completa
${Array.from(relatedEntityImports).map(entity => {
    const rel = rels.find(r => r.other.name.replace(/[^A-Za-z0-9]/g, "") === entity);
    if (!rel) return "";
    const relation = rel.relation;
    if (relation.relationType === "generalization") return "";

    const thisHasManyToOne =
      (rel.isSource && rel.srcMany && !rel.dstMany) ||
      (!rel.isSource && rel.dstMany && !rel.srcMany);

    if (!thisHasManyToOne) return "";

    const isSourceEntity = relation.sourceId === ent.idInCanvas;
    const sourceEntity = isSourceEntity ? ent : rel.other;
    const targetEntity = isSourceEntity ? rel.other : ent;
    const { fieldName, inverseName } = generateRelationNames(
      relation.relationType,
      sourceEntity,
      targetEntity,
      relation.sourceCard,
      relation.targetCard
    );
    const currentFieldName = isSourceEntity ? fieldName : inverseName;
    const fieldNameCap = capitalize(currentFieldName);
    const otherIdAttr = (rel.other.attributes as Attr[] | undefined)?.find((a) => a.pk);
    const otherIdName = (otherIdAttr?.name ?? "id").replace(/[^A-Za-z0-9_]/g, "") || "id";
    const varName = entity.charAt(0).toLowerCase() + entity.slice(1);

    return `    if (e.get${fieldNameCap}() != null) {
      ${entity} current = e.get${fieldNameCap}();
      // Si la referencia tiene ID, cargar la entidad completa desde la BD
      if (current.get${capitalize(otherIdName)}() != null) {
        ${entity} resolved = ${varName}Repository.findById(current.get${capitalize(otherIdName)}())
          .orElseThrow(() -> new RuntimeException("${entity} con id " + current.get${capitalize(otherIdName)}() + " no encontrado"));
        e.set${fieldNameCap}(resolved);
      }
    }`;
  }).filter(s => s).join("\n")}
    return repo.save(e);
  }

  public void delete(${idTypeJava} id){ repo.deleteById(id); }${extraService}
}
`;
      zip.file(`${svcDir}/${className}Service.java`, service);

      // ===== CONTROLLER =====
      const setterId = "set" + capitalize(idName);

      let extraEndpoints = "";
      for (const f of manyToOneFinders) {
        // /api/<entity>/<field>/{idField}
        extraEndpoints += `

  @GetMapping("/${f.fieldName}/{${f.targetIdFieldName}}")
  public java.util.List<${className}DTO> by${capitalize(f.fieldName)}(@PathVariable ${f.targetIdType} ${f.targetIdFieldName}){
    return ${className}Mapper.toDTOList(service.findBy${capitalize(f.fieldName)}(${f.targetIdFieldName}));
  }`;
      }

      const controller = `package ${basePkg}.controller;

import java.util.List;
import org.springframework.web.bind.annotation.*;
import ${basePkg}.dto.${className}DTO;
import ${basePkg}.mapper.${className}Mapper;
import ${basePkg}.service.${className}Service;

@RestController
@RequestMapping("/${varName}")
@CrossOrigin
public class ${className}Controller {
  private final ${className}Service service;

  public ${className}Controller(${className}Service service) {
    this.service = service;
  }

  @GetMapping
  public List<${className}DTO> all(){
    return ${className}Mapper.toDTOList(service.findAll());
  }

  @GetMapping("/{id}")
  public ${className}DTO byId(@PathVariable ${idTypeJava} id){
    return ${className}Mapper.toDTO(service.findById(id));
  }${extraEndpoints}

  @PostMapping
  public ${className}DTO create(@RequestBody ${className}DTO dto){
    return ${className}Mapper.toDTO(service.save(${className}Mapper.toEntity(dto)));
  }

  @PutMapping("/{id}")
  public ${className}DTO update(@PathVariable ${idTypeJava} id, @RequestBody ${className}DTO dto){
    dto.${setterId}(id);
    return ${className}Mapper.toDTO(service.save(${className}Mapper.toEntity(dto)));
  }

  @DeleteMapping("/{id}")
  public void delete(@PathVariable ${idTypeJava} id){ service.delete(id); }
}
`;
      zip.file(`${ctrlDir}/${className}Controller.java`, controller);
    }

    // Descargar ZIP
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, "_")}_spring_boot.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return generateSpringBootZip;
}

/* ========== helpers locales ========== */
function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
