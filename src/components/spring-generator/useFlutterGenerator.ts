// src/components/spring-generator/useFlutterGenerator.ts
"use client";

import JSZip from "jszip";
import { useStorage } from "@liveblocks/react";
import { LayerType } from "~/types";
import type { EntityLayer, RelationLayer, ProjectConfig } from "~/types";
import { generateRelationNames, toDartType, toSnakeCase } from "~/utils/relationNameGenerator";

type Attr = { id: string; name: string; type: string; required?: boolean; pk?: boolean };

type PlainEntity = EntityLayer & { idInCanvas: string };
type PlainRelation = RelationLayer & { idInCanvas: string };

export function useFlutterGenerator(projectName: string) {
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

  const generateFlutterZip = async () => {
    const { entities, relations } = getEntitiesAndRelations();

    if (!entities.length) {
      alert("No hay entidades en el lienzo.");
      return;
    }


    // Usar ProjectConfig o valores por defecto
    const config = projectConfig;
    // Limpiar el nombre del paquete: solo letras minúsculas, números y guiones bajos
    const flutterPackageName = (config?.flutterPackageName ?? projectName)
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")  // Reemplazar caracteres no válidos con _
      .replace(/^_+|_+$/g, "")       // Eliminar _ al inicio y al final
      .replace(/_+/g, "_");          // Reemplazar múltiples _ con uno solo
    const flutterVersion = config?.flutterVersion ?? "3.16.0";
    
    // ✅ Usar la baseUrl configurada o construirla automáticamente
    const serverPort = config?.serverPort ?? 8080;
    const contextPath = config?.contextPath ?? "";
    const baseUrl = config?.flutterBaseUrl ?? `http://localhost:${serverPort}${contextPath}`;

    const zip = new JSZip();

    // Estructura base del proyecto Flutter
    const root = `flutter-${flutterPackageName}`;

    // ========== PUBSPEC.YAML ==========
    zip.file(
      `${root}/pubspec.yaml`,
      generatePubspec(flutterPackageName, config?.description ?? "Generated Flutter app")
    );

    // ========== API CONFIG ==========
    zip.file(
      `${root}/lib/config/api_config.dart`,
      generateApiConfig(baseUrl)
    );

    // ========== README ==========
    zip.file(
      `${root}/README.md`,
      generateReadme(flutterPackageName, baseUrl)
    );

    const byId = new Map(entities.map((e) => [e.idInCanvas, e]));

    // Detectar relaciones de herencia
    const inheritanceMap = new Map<string, { parentId: string; relation: PlainRelation }>();
    for (const rel of relations) {
      if (rel.relationType === "generalization") {
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
      const owning: "source" | "target" = rel.owningSide === "source" ? "source" : "target";

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

    // Generar archivos para cada entidad
    for (const ent of entities) {
      const className = ent.name.replace(/[^A-Za-z0-9]/g, "") || "Entity";
      const snakeName = toSnakeCase(className);
      const attrs = (ent.attributes || []) as Attr[];
      const idAttr = attrs.find((a) => a.pk);
      const idName = (idAttr?.name ?? "id").replace(/[^A-Za-z0-9_]/g, "") || "id";
      const idTypeDart = toDartType(idAttr?.type ?? "int");

      const inheritanceInfo = inheritanceMap.get(ent.idInCanvas);
      const isSubclass = !!inheritanceInfo;

      const rels = relsByEntity[ent.idInCanvas] || [];

      // ========== MODEL ==========
      zip.file(
        `${root}/lib/models/${snakeName}_model.dart`,
        generateModel(ent, attrs, idName, idTypeDart, rels, byId, inheritanceInfo, inheritanceMap)
      );

      // ========== SERVICE ==========
      zip.file(
        `${root}/lib/services/${snakeName}_service.dart`,
        generateService(ent, className, snakeName, idName, idTypeDart, rels, byId)
      );

      // ========== PROVIDER ==========
      zip.file(
        `${root}/lib/providers/${snakeName}_provider.dart`,
        generateProvider(className, snakeName)
      );

      // ========== SCREENS ==========
      zip.file(
        `${root}/lib/screens/${snakeName}_list_screen.dart`,
        generateListScreen(ent, className, snakeName, attrs, rels, byId)
      );

      zip.file(
        `${root}/lib/screens/${snakeName}_detail_screen.dart`,
        generateDetailScreen(ent, className, snakeName, attrs, idName, rels, byId)
      );

      zip.file(
        `${root}/lib/screens/${snakeName}_form_screen.dart`,
        generateFormScreen(ent, className, snakeName, attrs, idName, idTypeDart, rels, byId, inheritanceInfo)
      );

      // ========== WIDGET ==========
      zip.file(
        `${root}/lib/widgets/${snakeName}_card.dart`,
        generateCard(ent, className, snakeName, attrs)
      );
    }

    // ========== MAIN.DART ==========
    zip.file(
      `${root}/lib/main.dart`,
      generateMain(flutterPackageName, entities)
    );

    // Descargar ZIP
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, "_")}_flutter.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return generateFlutterZip;
}

/* ========== GENERATORS ========== */

function generatePubspec(packageName: string, description: string): string {
  return `name: ${packageName}
description: ${description}
publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: '>=3.0.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter

  # HTTP client
  http: ^1.1.0

  # State management
  provider: ^6.1.0

  # Date formatting
  intl: ^0.18.1

  # Icons
  cupertino_icons: ^1.0.2

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.0

flutter:
  uses-material-design: true
`;
}

function generateApiConfig(baseUrl: string): string {
  return `// lib/config/api_config.dart

class ApiConfig {
  // Base URL del backend Spring Boot
  static const String baseUrl = '${baseUrl}';

  // Timeout para peticiones HTTP
  static const Duration timeout = Duration(seconds: 30);

  // Headers comunes
  static Map<String, String> get headers => {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}
`;
}

function generateReadme(packageName: string, baseUrl: string): string {
  return `# ${packageName.toUpperCase()}

Flutter frontend generado automáticamente desde diagrama UML.

## Configuración

1. **Instalar dependencias:**
   \`\`\`bash
   flutter pub get
   \`\`\`

2. **Configurar la URL del backend:**
   - Edita \`lib/config/api_config.dart\`
   - Cambia \`baseUrl\` si tu backend no está en \`${baseUrl}\`

3. **Ejecutar la aplicación:**
   \`\`\`bash
   flutter run
   \`\`\`

## Estructura del Proyecto

- **models/**: Modelos de datos (clases Dart que representan las entidades)
- **services/**: Servicios HTTP (llamadas a la API REST)
- **providers/**: Gestión de estado con Provider
- **screens/**: Pantallas de la aplicación (lista, detalle, formulario)
- **widgets/**: Widgets reutilizables (cards, forms)
- **config/**: Configuración de la aplicación

## Endpoints del Backend

Asegúrate de que tu backend Spring Boot esté corriendo en \`${baseUrl}\`

## Generado con

Este proyecto fue generado automáticamente desde un diagrama UML usando el generador de Flutter.
`;
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function generateModel(
  ent: PlainEntity,
  attrs: Attr[],
  idName: string,
  idTypeDart: string,
  rels: Array<{
    other: PlainEntity;
    srcMany: boolean;
    dstMany: boolean;
    isSource: boolean;
    relation: PlainRelation;
  }>,
  byId: Map<string, PlainEntity>,
  inheritanceInfo: { parentId: string; relation: PlainRelation } | undefined,
  inheritanceMap: Map<string, { parentId: string; relation: PlainRelation }>
): string {
  const className = ent.name.replace(/[^A-Za-z0-9]/g, "") || "Entity";
  const isSubclass = !!inheritanceInfo;

  // Fields
  let fields = `  final ${idTypeDart}? ${idName};\n`;

  // Si es subclase, agregar campos del padre
  if (isSubclass && inheritanceInfo) {
    const parentEntity = byId.get(inheritanceInfo.parentId);
    if (parentEntity) {
      const parentAttrs = (parentEntity.attributes || []) as Attr[];
      for (const a of parentAttrs) {
        if (a.pk) continue;
        const dartType = toDartType(a.type ?? "String");
        const rawFieldName = (a.name || "field").replace(/[^A-Za-z0-9_]/g, "");
        const fieldName = rawFieldName.charAt(0).toLowerCase() + rawFieldName.slice(1);
        const nullable = !a.required ? "?" : "";
        fields += `  final ${dartType}${nullable} ${fieldName};\n`;
      }
    }
  }

  // Campos propios
  for (const a of attrs) {
    if (a.pk) continue;
    const dartType = toDartType(a.type ?? "String");
    const rawFieldName = (a.name || "field").replace(/[^A-Za-z0-9_]/g, "");
    const fieldName = rawFieldName.charAt(0).toLowerCase() + rawFieldName.slice(1);
    const nullable = !a.required ? "?" : "";
    fields += `  final ${dartType}${nullable} ${fieldName};\n`;
  }

  // Agregar IDs de relaciones ManyToOne
  const manyToOneFields: Array<{name: string, type: string, required: boolean}> = [];
  for (const r of rels) {
    const relation = r.relation;
    if (relation.relationType === "generalization") continue;

    const thisHasManyToOne =
      (r.isSource && r.srcMany && !r.dstMany) ||
      (!r.isSource && r.dstMany && !r.srcMany);

    if (thisHasManyToOne) {
      const otherIdAttr = (r.other.attributes as Attr[] | undefined)?.find((a) => a.pk);
      const otherIdName = (otherIdAttr?.name ?? "id").replace(/[^A-Za-z0-9_]/g, "") || "id";
      const otherIdType = toDartType(otherIdAttr?.type ?? "int");

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

      const fieldIdName = `${currentFieldName}${capitalize(otherIdName)}`;
      manyToOneFields.push({name: fieldIdName, type: otherIdType, required: false});
      fields += `  final ${otherIdType}? ${fieldIdName};\n`;
    }
  }

  // Constructor parameters
  let constructorParams = `this.${idName}`;

  if (isSubclass && inheritanceInfo) {
    const parentEntity = byId.get(inheritanceInfo.parentId);
    if (parentEntity) {
      const parentAttrs = (parentEntity.attributes || []) as Attr[];
      for (const a of parentAttrs) {
        if (a.pk) continue;
        const rawFieldName = (a.name || "field").replace(/[^A-Za-z0-9_]/g, "");
        const fieldName = rawFieldName.charAt(0).toLowerCase() + rawFieldName.slice(1);
        constructorParams += `, ${a.required ? 'required ' : ''}this.${fieldName}`;
      }
    }
  }

  for (const a of attrs) {
    if (a.pk) continue;
    const rawFieldName = (a.name || "field").replace(/[^A-Za-z0-9_]/g, "");
    const fieldName = rawFieldName.charAt(0).toLowerCase() + rawFieldName.slice(1);
    constructorParams += `, ${a.required ? 'required ' : ''}this.${fieldName}`;
  }

  for (const f of manyToOneFields) {
    constructorParams += `, this.${f.name}`;
  }

  // fromJson
  let fromJsonFields = `      ${idName}: json['${idName}']`;

  if (isSubclass && inheritanceInfo) {
    const parentEntity = byId.get(inheritanceInfo.parentId);
    if (parentEntity) {
      const parentAttrs = (parentEntity.attributes || []) as Attr[];
      for (const a of parentAttrs) {
        if (a.pk) continue;
        const rawFieldName = (a.name || "field").replace(/[^A-Za-z0-9_]/g, "");
        const fieldName = rawFieldName.charAt(0).toLowerCase() + rawFieldName.slice(1);
        const dartType = toDartType(a.type ?? "String");
        if (dartType === "DateTime") {
          fromJsonFields += `,\n      ${fieldName}: json['${fieldName}'] != null ? DateTime.parse(json['${fieldName}']) : null`;
        } else {
          fromJsonFields += `,\n      ${fieldName}: json['${fieldName}']`;
        }
      }
    }
  }

  for (const a of attrs) {
    if (a.pk) continue;
    const rawFieldName = (a.name || "field").replace(/[^A-Za-z0-9_]/g, "");
    const fieldName = rawFieldName.charAt(0).toLowerCase() + rawFieldName.slice(1);
    const dartType = toDartType(a.type ?? "String");
    if (dartType === "DateTime") {
      fromJsonFields += `,\n      ${fieldName}: json['${fieldName}'] != null ? DateTime.parse(json['${fieldName}']) : null`;
    } else {
      fromJsonFields += `,\n      ${fieldName}: json['${fieldName}']`;
    }
  }

  for (const f of manyToOneFields) {
    fromJsonFields += `,\n      ${f.name}: json['${f.name}']`;
  }

  // toJson
  let toJsonFields = `      '${idName}': ${idName}`;

  if (isSubclass && inheritanceInfo) {
    const parentEntity = byId.get(inheritanceInfo.parentId);
    if (parentEntity) {
      const parentAttrs = (parentEntity.attributes || []) as Attr[];
      for (const a of parentAttrs) {
        if (a.pk) continue;
        const rawFieldName = (a.name || "field").replace(/[^A-Za-z0-9_]/g, "");
        const fieldName = rawFieldName.charAt(0).toLowerCase() + rawFieldName.slice(1);
        const dartType = toDartType(a.type ?? "String");
        if (dartType === "DateTime") {
          toJsonFields += `,\n      '${fieldName}': ${fieldName}?.toIso8601String()`;
        } else {
          toJsonFields += `,\n      '${fieldName}': ${fieldName}`;
        }
      }
    }
  }

  for (const a of attrs) {
    if (a.pk) continue;
    const rawFieldName = (a.name || "field").replace(/[^A-Za-z0-9_]/g, "");
    const fieldName = rawFieldName.charAt(0).toLowerCase() + rawFieldName.slice(1);
    const dartType = toDartType(a.type ?? "String");
    if (dartType === "DateTime") {
      toJsonFields += `,\n      '${fieldName}': ${fieldName}?.toIso8601String()`;
    } else {
      toJsonFields += `,\n      '${fieldName}': ${fieldName}`;
    }
  }

  for (const f of manyToOneFields) {
    toJsonFields += `,\n      '${f.name}': ${f.name}`;
  }

  return `// lib/models/${toSnakeCase(className)}_model.dart

class ${className} {
${fields}
  ${className}({
    ${constructorParams},
  });

  factory ${className}.fromJson(Map<String, dynamic> json) {
    return ${className}(
${fromJsonFields},
    );
  }

  Map<String, dynamic> toJson() {
    return {
${toJsonFields},
    };
  }

  ${className} copyWith({
    ${idTypeDart}? ${idName}${attrs.filter(a => !a.pk).length > 0 || manyToOneFields.length > 0 ? ',' : ''}
    ${attrs.filter(a => !a.pk).map(a => {
      const rawFieldName = (a.name || "field").replace(/[^A-Za-z0-9_]/g, "");
      const fieldName = rawFieldName.charAt(0).toLowerCase() + rawFieldName.slice(1);
      const dartType = toDartType(a.type ?? "String");
      return `${dartType}? ${fieldName}`;
    }).join(',\n    ')}${manyToOneFields.length > 0 && attrs.filter(a => !a.pk).length > 0 ? ',' : ''}
    ${manyToOneFields.map(f => `${f.type}? ${f.name}`).join(',\n    ')}${manyToOneFields.length > 0 || attrs.filter(a => !a.pk).length > 0 ? '' : ''}
  }) {
    return ${className}(
      ${idName}: ${idName} ?? this.${idName}${attrs.filter(a => !a.pk).length > 0 || manyToOneFields.length > 0 ? ',' : ''}
      ${attrs.filter(a => !a.pk).map(a => {
        const rawFieldName = (a.name || "field").replace(/[^A-Za-z0-9_]/g, "");
        const fieldName = rawFieldName.charAt(0).toLowerCase() + rawFieldName.slice(1);
        return `${fieldName}: ${fieldName} ?? this.${fieldName}`;
      }).join(',\n      ')}${manyToOneFields.length > 0 && attrs.filter(a => !a.pk).length > 0 ? ',' : ''}
      ${manyToOneFields.map(f => `${f.name}: ${f.name} ?? this.${f.name}`).join(',\n      ')}${manyToOneFields.length > 0 || attrs.filter(a => !a.pk).length > 0 ? '' : ''}
    );
  }
}
`;
}

function generateService(
  ent: PlainEntity,
  className: string,
  snakeName: string,
  idName: string,
  idTypeDart: string,
  rels: Array<{
    other: PlainEntity;
    srcMany: boolean;
    dstMany: boolean;
    isSource: boolean;
    relation: PlainRelation;
  }>,
  byId: Map<string, PlainEntity>
): string {
  const varName = className.charAt(0).toLowerCase() + className.slice(1);

  // Métodos de filtrado para relaciones ManyToOne
  let filterMethods = "";
  for (const r of rels) {
    const relation = r.relation;
    if (relation.relationType === "generalization") continue;

    const thisHasManyToOne =
      (r.isSource && r.srcMany && !r.dstMany) ||
      (!r.isSource && r.dstMany && !r.srcMany);

    if (thisHasManyToOne) {
      const otherIdAttr = (r.other.attributes as Attr[] | undefined)?.find((a) => a.pk);
      const otherIdName = (otherIdAttr?.name ?? "id").replace(/[^A-Za-z0-9_]/g, "") || "id";
      const otherIdType = toDartType(otherIdAttr?.type ?? "int");

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

      filterMethods += `
  // Obtener ${className} por ${currentFieldName}
  Future<List<${className}>> getBy${capitalize(currentFieldName)}(${otherIdType} ${otherIdName}) async {
    try {
      final response = await http.get(
        Uri.parse('\${ApiConfig.baseUrl}/${varName}/${currentFieldName}/\${${otherIdName}}'),
        headers: ApiConfig.headers,
      ).timeout(ApiConfig.timeout);

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        return data.map((json) => ${className}.fromJson(json)).toList();
      } else {
        throw Exception('Error al cargar ${className}: \${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Error de conexión: \$e');
    }
  }
`;
    }
  }

  return `// lib/services/${snakeName}_service.dart

import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import '../models/${snakeName}_model.dart';

class ${className}Service {
  // Obtener todos
  Future<List<${className}>> getAll() async {
    try {
      final response = await http.get(
        Uri.parse('\${ApiConfig.baseUrl}/${varName}'),
        headers: ApiConfig.headers,
      ).timeout(ApiConfig.timeout);

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        return data.map((json) => ${className}.fromJson(json)).toList();
      } else {
        throw Exception('Error al cargar ${className}: \${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Error de conexión: \$e');
    }
  }

  // Obtener por ID
  Future<${className}?> getById(${idTypeDart} ${idName}) async {
    try {
      final response = await http.get(
        Uri.parse('\${ApiConfig.baseUrl}/${varName}/\${${idName}}'),
        headers: ApiConfig.headers,
      ).timeout(ApiConfig.timeout);

      if (response.statusCode == 200) {
        return ${className}.fromJson(json.decode(response.body));
      } else if (response.statusCode == 404) {
        return null;
      } else {
        throw Exception('Error al cargar ${className}: \${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Error de conexión: \$e');
    }
  }${filterMethods}

  // Crear
  Future<${className}> create(${className} ${varName}) async {
    try {
      final response = await http.post(
        Uri.parse('\${ApiConfig.baseUrl}/${varName}'),
        headers: ApiConfig.headers,
        body: json.encode(${varName}.toJson()),
      ).timeout(ApiConfig.timeout);

      if (response.statusCode == 200 || response.statusCode == 201) {
        return ${className}.fromJson(json.decode(response.body));
      } else {
        throw Exception('Error al crear ${className}: \${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Error de conexión: \$e');
    }
  }

  // Actualizar
  Future<${className}> update(${idTypeDart} ${idName}, ${className} ${varName}) async {
    try {
      final response = await http.put(
        Uri.parse('\${ApiConfig.baseUrl}/${varName}/\${${idName}}'),
        headers: ApiConfig.headers,
        body: json.encode(${varName}.toJson()),
      ).timeout(ApiConfig.timeout);

      if (response.statusCode == 200) {
        return ${className}.fromJson(json.decode(response.body));
      } else {
        throw Exception('Error al actualizar ${className}: \${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Error de conexión: \$e');
    }
  }

  // Eliminar
  Future<void> delete(${idTypeDart} ${idName}) async {
    try {
      final response = await http.delete(
        Uri.parse('\${ApiConfig.baseUrl}/${varName}/\${${idName}}'),
        headers: ApiConfig.headers,
      ).timeout(ApiConfig.timeout);

      if (response.statusCode != 200 && response.statusCode != 204) {
        throw Exception('Error al eliminar ${className}: \${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Error de conexión: \$e');
    }
  }
}
`;
}

function generateProvider(className: string, snakeName: string): string {
  const varName = className.charAt(0).toLowerCase() + className.slice(1);
  const varNamePlural = varName + "s";

  return `// lib/providers/${snakeName}_provider.dart

import 'package:flutter/foundation.dart';
import '../models/${snakeName}_model.dart';
import '../services/${snakeName}_service.dart';

class ${className}Provider with ChangeNotifier {
  final ${className}Service _service = ${className}Service();

  List<${className}> _${varNamePlural} = [];
  bool _isLoading = false;
  String? _error;

  List<${className}> get ${varNamePlural} => _${varNamePlural};
  bool get isLoading => _isLoading;
  String? get error => _error;

  // Cargar todos
  Future<void> loadAll() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _${varNamePlural} = await _service.getAll();
      _error = null;
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Crear
  Future<${className}?> create(${className} ${varName}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final created = await _service.create(${varName});
      _${varNamePlural}.add(created);
      _error = null;
      notifyListeners();
      return created;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return null;
    } finally {
      _isLoading = false;
    }
  }

  // Actualizar
  Future<${className}?> update(${className} ${varName}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final updated = await _service.update(${varName}.id!, ${varName});
      final index = _${varNamePlural}.indexWhere((e) => e.id == ${varName}.id);
      if (index != -1) {
        _${varNamePlural}[index] = updated;
      }
      _error = null;
      notifyListeners();
      return updated;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return null;
    } finally {
      _isLoading = false;
    }
  }

  // Eliminar
  Future<bool> delete(int id) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      await _service.delete(id);
      _${varNamePlural}.removeWhere((e) => e.id == id);
      _error = null;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    } finally {
      _isLoading = false;
    }
  }

  // Limpiar error
  void clearError() {
    _error = null;
    notifyListeners();
  }
}
`;
}

function generateListScreen(
  ent: PlainEntity,
  className: string,
  snakeName: string,
  attrs: Attr[],
  rels: Array<any>,
  byId: Map<string, PlainEntity>
): string {
  const varNamePlural = className.charAt(0).toLowerCase() + className.slice(1) + "s";

  // Encontrar el primer campo string para mostrar en la lista
  const firstStringAttr = attrs.find(a => !a.pk && (a.type === "string" || a.type === "email"));
  const rawDisplayField = firstStringAttr ? (firstStringAttr.name || "name").replace(/[^A-Za-z0-9_]/g, "") : "id";
  const displayField = rawDisplayField.charAt(0).toLowerCase() + rawDisplayField.slice(1);

  return `// lib/screens/${snakeName}_list_screen.dart

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/${snakeName}_provider.dart';
import '../widgets/${snakeName}_card.dart';
import '${snakeName}_detail_screen.dart';
import '${snakeName}_form_screen.dart';

class ${className}ListScreen extends StatefulWidget {
  const ${className}ListScreen({Key? key}) : super(key: key);

  @override
  State<${className}ListScreen> createState() => _${className}ListScreenState();
}

class _${className}ListScreenState extends State<${className}ListScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<${className}Provider>().loadAll();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.transparent,
        flexibleSpace: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Colors.deepPurple.shade700,
                Colors.deepPurple.shade500,
                Colors.purple.shade400,
              ],
            ),
          ),
        ),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.2),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.dashboard_customize_rounded, size: 20),
            ),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '${className}',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 20,
                    letterSpacing: 0.5,
                  ),
                ),
                Text(
                  'Panel de Control',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: Colors.white.withOpacity(0.8),
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 8),
            child: IconButton(
              icon: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.refresh_rounded, size: 20),
              ),
              onPressed: () => context.read<${className}Provider>().loadAll(),
              tooltip: 'Actualizar',
            ),
          ),
        ],
      ),
      body: Consumer<${className}Provider>(
        builder: (context, provider, child) {
          if (provider.isLoading && provider.${varNamePlural}.isEmpty) {
            return Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.deepPurple.shade50,
                    const Color(0xFFF5F7FA),
                  ],
                ),
              ),
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.deepPurple.withOpacity(0.1),
                            blurRadius: 30,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          SizedBox(
                            width: 60,
                            height: 60,
                            child: CircularProgressIndicator(
                              strokeWidth: 3,
                              valueColor: AlwaysStoppedAnimation<Color>(
                                Colors.deepPurple.shade400,
                              ),
                            ),
                          ),
                          Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: Colors.deepPurple.shade50,
                              shape: BoxShape.circle,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                    Text(
                      'Cargando datos...',
                      style: TextStyle(
                        color: Colors.grey.shade700,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.3,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Por favor espera un momento',
                      style: TextStyle(
                        color: Colors.grey.shade500,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
            );
          }

          if (provider.error != null) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: Colors.red.shade50,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        Icons.error_outline_rounded,
                        size: 64,
                        color: Colors.red.shade400,
                      ),
                    ),
                    const SizedBox(height: 24),
                    Text(
                      'Oops!',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: Colors.grey.shade800,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '\${provider.error}',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.grey.shade600,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton.icon(
                      onPressed: () => provider.loadAll(),
                      icon: const Icon(Icons.refresh_rounded),
                      label: const Text('Reintentar'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.deepPurple.shade700,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }

          if (provider.${varNamePlural}.isEmpty) {
            return Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.deepPurple.shade50,
                    const Color(0xFFF5F7FA),
                  ],
                ),
              ),
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(32),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.deepPurple.withOpacity(0.15),
                            blurRadius: 40,
                            offset: const Offset(0, 15),
                          ),
                        ],
                      ),
                      child: Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [
                              Colors.deepPurple.shade100,
                              Colors.purple.shade50,
                            ],
                          ),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          Icons.inventory_2_rounded,
                          size: 56,
                          color: Colors.deepPurple.shade400,
                        ),
                      ),
                    ),
                    const SizedBox(height: 32),
                    Text(
                      'Sin Registros',
                      style: TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                        color: Colors.grey.shade800,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Comienza agregando tu primer elemento',
                      style: TextStyle(
                        color: Colors.grey.shade600,
                        fontSize: 15,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.deepPurple.shade50,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.touch_app_rounded, size: 16, color: Colors.deepPurple.shade600),
                          const SizedBox(width: 6),
                          Text(
                            'Toca el botón flotante',
                            style: TextStyle(
                              color: Colors.deepPurple.shade700,
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            );
          }

          return RefreshIndicator(
            color: Colors.deepPurple.shade600,
            backgroundColor: Colors.white,
            strokeWidth: 3,
            onRefresh: () => provider.loadAll(),
            child: CustomScrollView(
              physics: const BouncingScrollPhysics(),
              slivers: [
                // Espacio para el AppBar
                const SliverToBoxAdapter(
                  child: SizedBox(height: 120),
                ),
                // Header con estadísticas
                SliverToBoxAdapter(
                  child: Container(
                    margin: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          Colors.white,
                          Colors.deepPurple.shade50.withOpacity(0.3),
                        ],
                      ),
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.deepPurple.withOpacity(0.08),
                          blurRadius: 20,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [Colors.deepPurple.shade400, Colors.purple.shade300],
                            ),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: const Icon(Icons.analytics_rounded, color: Colors.white, size: 24),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Total de Registros',
                                style: TextStyle(
                                  color: Colors.grey.shade600,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '\${provider.${varNamePlural}.length}',
                                style: TextStyle(
                                  color: Colors.grey.shade900,
                                  fontSize: 28,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: -0.5,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Icon(Icons.trending_up_rounded, color: Colors.green.shade400, size: 32),
                      ],
                    ),
                  ),
                ),
                // Grid de items
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 100),
                  sliver: SliverGrid(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      childAspectRatio: 0.85,
                      crossAxisSpacing: 16,
                      mainAxisSpacing: 16,
                    ),
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        final item = provider.${varNamePlural}[index];
                        return TweenAnimationBuilder(
                          duration: Duration(milliseconds: 200 + (index * 50)),
                          tween: Tween<double>(begin: 0, end: 1),
                          builder: (context, double value, child) {
                            return Transform.scale(
                              scale: value,
                              child: Opacity(
                                opacity: value,
                                child: ${className}Card(
                                  ${className.charAt(0).toLowerCase() + className.slice(1)}: item,
                                  onTap: () {
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (context) => ${className}DetailScreen(
                                          ${className.charAt(0).toLowerCase() + className.slice(1)}: item,
                                        ),
                                      ),
                                    );
                                  },
                                ),
                              ),
                            );
                          },
                        );
                      },
                      childCount: provider.${varNamePlural}.length,
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
      floatingActionButton: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: Colors.deepPurple.withOpacity(0.4),
              blurRadius: 20,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: FloatingActionButton.extended(
          onPressed: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => const ${className}FormScreen(),
              ),
            ).then((_) => context.read<${className}Provider>().loadAll());
          },
          backgroundColor: Colors.transparent,
          elevation: 0,
          label: Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [Colors.deepPurple.shade600, Colors.purple.shade400],
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.add_rounded, size: 18, color: Colors.white),
                ),
                const SizedBox(width: 8),
                const Text(
                  'Crear Nuevo',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                    color: Colors.white,
                    letterSpacing: 0.3,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
`;
}

function generateDetailScreen(
  ent: PlainEntity,
  className: string,
  snakeName: string,
  attrs: Attr[],
  idName: string,
  rels: Array<any>,
  byId: Map<string, PlainEntity>
): string {
  const varName = className.charAt(0).toLowerCase() + className.slice(1);

  // Generar la visualización de campos
  let fieldWidgets = "";
  let hasManyToOneRelations = false;
  
  for (const a of attrs) {
    if (a.pk) continue;
    const rawFieldName = (a.name || "field").replace(/[^A-Za-z0-9_]/g, "");
    const fieldName = rawFieldName.charAt(0).toLowerCase() + rawFieldName.slice(1);
    const dartType = toDartType(a.type ?? "String");

    if (dartType === "DateTime") {
      fieldWidgets += `          _buildDetailRow('${a.name}', current${className}.${fieldName} != null ? DateFormat('yyyy-MM-dd HH:mm').format(current${className}.${fieldName}!) : 'N/A'),\n`;
    } else if (dartType === "bool") {
      fieldWidgets += `          _buildDetailRow('${a.name}', current${className}.${fieldName} == true ? 'Sí' : 'No'),\n`;
    } else {
      fieldWidgets += `          _buildDetailRow('${a.name}', current${className}.${fieldName}?.toString() ?? 'N/A'),\n`;
    }
  }

  // Agregar campos de relaciones ManyToOne (Foreign Keys)
  for (const r of rels) {
    const relation = r.relation;
    if (relation.relationType === "generalization") continue;

    const thisHasManyToOne =
      (r.isSource && r.srcMany && !r.dstMany) ||
      (!r.isSource && r.dstMany && !r.srcMany);

    if (thisHasManyToOne) {
      hasManyToOneRelations = true;
      const otherIdAttr = (r.other.attributes as Attr[] | undefined)?.find((a) => a.pk);
      const otherIdName = (otherIdAttr?.name ?? "id").replace(/[^A-Za-z0-9_]/g, "") || "id";

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
      const fieldIdName = `${currentFieldName}${capitalize(otherIdName)}`;

      // Agregar fila con enlace clickable a la entidad relacionada
      const otherClassName = r.other.name.replace(/[^A-Za-z0-9]/g, "") || "Other";
      const otherSnakeName = toSnakeCase(otherClassName);

      fieldWidgets += `          _buildRelationRow('${r.other.name}', current${className}.${fieldIdName}, '${otherSnakeName}', context),\n`;
    }
  }

  const needsDateFormat = attrs.some(a => !a.pk && (a.type === "date" || a.type === "datetime"));

  return `// lib/screens/${snakeName}_detail_screen.dart

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';${needsDateFormat ? "\nimport 'package:intl/intl.dart';" : ""}
import '../models/${snakeName}_model.dart';
import '../providers/${snakeName}_provider.dart';
import '${snakeName}_form_screen.dart';

class ${className}DetailScreen extends StatelessWidget {
  final ${className} ${varName};

  const ${className}DetailScreen({
    Key? key,
    required this.${varName},
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Consumer<${className}Provider>(
      builder: (context, provider, child) {
        // Buscar el objeto actualizado en el provider
        final current${className} = provider.${varName}s.firstWhere(
          (item) => item.${idName} == ${varName}.${idName},
          orElse: () => ${varName}, // Si no se encuentra, usar el original
        );

        return Scaffold(
          backgroundColor: Colors.grey.shade100,
          appBar: AppBar(
            elevation: 0,
            backgroundColor: Colors.deepPurple.shade700,
            foregroundColor: Colors.white,
            title: Text(
              '${className} #\${current${className}.${idName}}',
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 20,
              ),
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.edit_rounded),
                tooltip: 'Editar',
                onPressed: () async {
                  await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => ${className}FormScreen(${varName}: current${className}),
                    ),
                  );
                },
              ),
              IconButton(
                icon: const Icon(Icons.delete_rounded),
                tooltip: 'Eliminar',
                onPressed: () => _confirmDelete(context, current${className}),
              ),
              const SizedBox(width: 8),
            ],
          ),
          body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Colors.deepPurple.shade50.withOpacity(0.3),
              Colors.white,
              Colors.purple.shade50.withOpacity(0.2),
            ],
          ),
        ),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Hero Header Card with glassmorphism
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(28),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(28),
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Colors.deepPurple.shade600,
                      Colors.deepPurple.shade700,
                      Colors.purple.shade600,
                    ],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.deepPurple.withOpacity(0.4),
                      blurRadius: 24,
                      offset: const Offset(0, 8),
                      spreadRadius: 2,
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.25),
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(
                              color: Colors.white.withOpacity(0.3),
                              width: 2,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.1),
                                blurRadius: 10,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: const Icon(
                            Icons.account_tree_rounded,
                            color: Colors.white,
                            size: 36,
                          ),
                        ),
                        const SizedBox(width: 20),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                '${className}',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 28,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: -0.5,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                                decoration: BoxDecoration(
                                  color: Colors.white.withOpacity(0.2),
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(
                                    color: Colors.white.withOpacity(0.3),
                                    width: 1,
                                  ),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Container(
                                      width: 8,
                                      height: 8,
                                      decoration: const BoxDecoration(
                                        color: Colors.white,
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Text(
                                      'ID: \${current${className}.${idName}}',
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 15,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // Details Section with modern cards
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(
                    color: Colors.deepPurple.shade100.withOpacity(0.5),
                    width: 1.5,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.deepPurple.withOpacity(0.08),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                      spreadRadius: 2,
                    ),
                    BoxShadow(
                      color: Colors.white.withOpacity(0.9),
                      blurRadius: 8,
                      offset: const Offset(-4, -4),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                Colors.deepPurple.shade400,
                                Colors.purple.shade500,
                              ],
                            ),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(
                            Icons.analytics_outlined,
                            color: Colors.white,
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Text(
                          'Información Detallada',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: Colors.grey.shade900,
                            letterSpacing: -0.5,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    Container(
                      height: 2,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            Colors.deepPurple.shade200,
                            Colors.purple.shade200.withOpacity(0.3),
                            Colors.transparent,
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
${fieldWidgets}                ],
                ),
              ),

              const SizedBox(height: 24),

              // Action Buttons with modern design
              Row(
                children: [
                  Expanded(
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            Colors.deepPurple.shade600,
                            Colors.purple.shade600,
                          ],
                        ),
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.deepPurple.withOpacity(0.3),
                            blurRadius: 12,
                            offset: const Offset(0, 6),
                          ),
                        ],
                      ),
                      child: ElevatedButton.icon(
                        onPressed: () async {
                          await Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) => ${className}FormScreen(${varName}: current${className}),
                            ),
                          );
                        },
                        icon: const Icon(Icons.edit_rounded, size: 20),
                        label: const Text(
                          'Editar',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 16,
                          ),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.transparent,
                          foregroundColor: Colors.white,
                          shadowColor: Colors.transparent,
                          padding: const EdgeInsets.symmetric(vertical: 18),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: Colors.red.shade400,
                          width: 2,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.red.withOpacity(0.2),
                            blurRadius: 12,
                            offset: const Offset(0, 6),
                          ),
                        ],
                      ),
                      child: OutlinedButton.icon(
                        onPressed: () => _confirmDelete(context, current${className}),
                        icon: Icon(Icons.delete_rounded, size: 20, color: Colors.red.shade600),
                        label: Text(
                          'Eliminar',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 16,
                            color: Colors.red.shade600,
                          ),
                        ),
                        style: OutlinedButton.styleFrom(
                          backgroundColor: Colors.transparent,
                          side: BorderSide.none,
                          padding: const EdgeInsets.symmetric(vertical: 18),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
        );
      },
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Colors.grey.shade50,
            Colors.white,
          ],
        ),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: Colors.grey.shade200,
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.08),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Colors.deepPurple.shade100,
                  Colors.purple.shade100,
                ],
              ),
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: Colors.deepPurple.withOpacity(0.15),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Icon(
              Icons.subject_rounded,
              color: Colors.deepPurple.shade700,
              size: 20,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label.toUpperCase(),
                  style: TextStyle(
                    fontSize: 11,
                    color: Colors.grey.shade500,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 15,
                    color: Colors.grey.shade900,
                    fontWeight: FontWeight.w600,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRelationRow(String label, int? value, String entityType, BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Colors.purple.shade50.withOpacity(0.5),
            Colors.white,
          ],
        ),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: Colors.purple.shade200.withOpacity(0.6),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.purple.withOpacity(0.1),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Colors.purple.shade300,
                  Colors.purple.shade500,
                ],
              ),
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: Colors.purple.withOpacity(0.25),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: const Icon(
              Icons.account_tree_rounded,
              color: Colors.white,
              size: 20,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label.toUpperCase(),
                  style: TextStyle(
                    fontSize: 11,
                    color: Colors.purple.shade600,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(height: 8),
                value != null
                    ? InkWell(
                        onTap: () {
                          // TODO: Navegar a la pantalla de detalle de la entidad relacionada
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Row(
                                children: [
                                  const Icon(Icons.info_outline, color: Colors.white),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text('ID: \$value - Navegación a \$label pendiente'),
                                  ),
                                ],
                              ),
                              backgroundColor: Colors.purple.shade700,
                              behavior: SnackBarBehavior.floating,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                          );
                        },
                        borderRadius: BorderRadius.circular(10),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                Colors.purple.shade100,
                                Colors.purple.shade50,
                              ],
                            ),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: Colors.purple.shade300,
                              width: 1.5,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                padding: const EdgeInsets.all(4),
                                decoration: BoxDecoration(
                                  color: Colors.purple.shade700,
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(
                                  Icons.arrow_forward_rounded,
                                  size: 14,
                                  color: Colors.white,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                'ID: \$value',
                                style: TextStyle(
                                  color: Colors.purple.shade800,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 14,
                                ),
                              ),
                            ],
                          ),
                        ),
                      )
                    : Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade100,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: Colors.grey.shade300,
                            width: 1,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.block_rounded,
                              size: 16,
                              color: Colors.grey.shade400,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              'Sin asignar',
                              style: TextStyle(
                                color: Colors.grey.shade500,
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmDelete(BuildContext context, ${className} item) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(Icons.warning_rounded, color: Colors.red.shade700, size: 24),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Text(
                'Confirmar eliminación',
                style: TextStyle(fontSize: 18),
              ),
            ),
          ],
        ),
        content: const Text(
          '¿Está seguro de que desea eliminar este elemento? Esta acción no se puede deshacer.',
          style: TextStyle(fontSize: 15),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            style: TextButton.styleFrom(
              foregroundColor: Colors.grey.shade700,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            ),
            child: const Text('Cancelar', style: TextStyle(fontWeight: FontWeight.w600)),
          ),
          ElevatedButton.icon(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red.shade700,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              elevation: 0,
            ),
            icon: const Icon(Icons.delete_rounded, size: 18),
            label: const Text('Eliminar', style: TextStyle(fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );

    if (confirmed == true && context.mounted) {
      final success = await context.read<${className}Provider>().delete(item.${idName}!);
      if (success && context.mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Row(
              children: [
                Icon(Icons.check_circle_rounded, color: Colors.white),
                SizedBox(width: 12),
                Text('Elemento eliminado correctamente', style: TextStyle(fontWeight: FontWeight.w600)),
              ],
            ),
            backgroundColor: Colors.green.shade700,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            margin: const EdgeInsets.all(16),
          ),
        );
      }
    }
  }
}
`;
}

function generateFormScreen(
  ent: PlainEntity,
  className: string,
  snakeName: string,
  attrs: Attr[],
  idName: string,
  idTypeDart: string,
  rels: Array<any>,
  byId: Map<string, PlainEntity>,
  inheritanceInfo: { parentId: string; relation: PlainRelation } | undefined
): string {
  const varName = className.charAt(0).toLowerCase() + className.slice(1);

  // Generar controladores y campos de formulario
  let controllers = "";
  let controllerInits = "";
  let controllerDisposes = "";
  let formFields = "";

  // Si es subclase, incluir campos del padre
  if (inheritanceInfo) {
    const parentEntity = byId.get(inheritanceInfo.parentId);
    if (parentEntity) {
      const parentAttrs = (parentEntity.attributes || []) as Attr[];
      for (const a of parentAttrs) {
        if (a.pk) continue;
        const rawFieldName = (a.name || "field").replace(/[^A-Za-z0-9_]/g, "");
        const fieldName = rawFieldName.charAt(0).toLowerCase() + rawFieldName.slice(1);
        const dartType = toDartType(a.type ?? "String");

        if (dartType === "DateTime") {
          controllers += `  DateTime? _${fieldName};\n`;
          controllerInits += `    _${fieldName} = widget.${varName}?.${fieldName};\n`;
          formFields += `          _buildDateField('${a.name}', _${fieldName}, (date) => setState(() => _${fieldName} = date)),\n`;
        } else if (dartType === "bool") {
          controllers += `  bool _${fieldName} = false;\n`;
          controllerInits += `    _${fieldName} = widget.${varName}?.${fieldName} ?? false;\n`;
          formFields += `          Container(\n            decoration: BoxDecoration(\n              borderRadius: BorderRadius.circular(14),\n              gradient: LinearGradient(\n                begin: Alignment.topLeft,\n                end: Alignment.bottomRight,\n                colors: [\n                  Colors.white,\n                  Colors.deepPurple.shade50.withOpacity(0.1),\n                ],\n              ),\n              border: Border.all(\n                color: Colors.deepPurple.shade200.withOpacity(0.5),\n                width: 1.5,\n              ),\n              boxShadow: [\n                BoxShadow(\n                  color: Colors.deepPurple.withOpacity(0.05),\n                  blurRadius: 8,\n                  offset: const Offset(0, 2),\n                ),\n              ],\n            ),\n            child: SwitchListTile(\n              title: Row(\n                children: [\n                  Icon(\n                    Icons.toggle_on_outlined,\n                    color: Colors.deepPurple.shade400,\n                    size: 24,\n                  ),\n                  const SizedBox(width: 12),\n                  Text(\n                    '${a.name}',\n                    style: TextStyle(\n                      fontWeight: FontWeight.w600,\n                      color: Colors.grey.shade700,\n                    ),\n                  ),\n                ],\n              ),\n              value: _${fieldName},\n              onChanged: (value) => setState(() => _${fieldName} = value),\n              activeColor: Colors.deepPurple.shade600,\n              activeTrackColor: Colors.deepPurple.shade200,\n              contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),\n            ),\n          ),\n          const SizedBox(height: 18),\n`;
        } else {
          controllers += `  final _${fieldName}Controller = TextEditingController();\n`;
          controllerInits += `    _${fieldName}Controller.text = widget.${varName}?.${fieldName}?.toString() ?? '';\n`;
          controllerDisposes += `    _${fieldName}Controller.dispose();\n`;

          const keyboardType = dartType === "int" || dartType === "double" ? "TextInputType.number" : "TextInputType.text";
          formFields += `          Container(\n            decoration: BoxDecoration(\n              borderRadius: BorderRadius.circular(14),\n              gradient: LinearGradient(\n                begin: Alignment.topLeft,\n                end: Alignment.bottomRight,\n                colors: [\n                  Colors.white,\n                  Colors.deepPurple.shade50.withOpacity(0.1),\n                ],\n              ),\n              boxShadow: [\n                BoxShadow(\n                  color: Colors.deepPurple.withOpacity(0.05),\n                  blurRadius: 8,\n                  offset: const Offset(0, 2),\n                ),\n              ],\n            ),\n            child: TextFormField(\n              controller: _${fieldName}Controller,\n              decoration: InputDecoration(\n                labelText: '${a.name}',\n                labelStyle: TextStyle(\n                  color: Colors.grey.shade600,\n                  fontWeight: FontWeight.w600,\n                ),\n                filled: true,\n                fillColor: Colors.transparent,\n                prefixIcon: Icon(\n                  Icons.text_fields_rounded,\n                  color: Colors.deepPurple.shade400,\n                ),\n                border: OutlineInputBorder(\n                  borderRadius: BorderRadius.circular(14),\n                  borderSide: BorderSide.none,\n                ),\n                enabledBorder: OutlineInputBorder(\n                  borderRadius: BorderRadius.circular(14),\n                  borderSide: BorderSide(\n                    color: Colors.deepPurple.shade200.withOpacity(0.5),\n                    width: 1.5,\n                  ),\n                ),\n                focusedBorder: OutlineInputBorder(\n                  borderRadius: BorderRadius.circular(14),\n                  borderSide: BorderSide(\n                    color: Colors.deepPurple.shade600,\n                    width: 2,\n                  ),\n                ),\n                errorBorder: OutlineInputBorder(\n                  borderRadius: BorderRadius.circular(14),\n                  borderSide: const BorderSide(\n                    color: Colors.red,\n                    width: 1.5,\n                  ),\n                ),\n                focusedErrorBorder: OutlineInputBorder(\n                  borderRadius: BorderRadius.circular(14),\n                  borderSide: const BorderSide(\n                    color: Colors.red,\n                    width: 2,\n                  ),\n                ),\n              ),\n              keyboardType: ${keyboardType},\n              ${a.required ? "validator: (value) => value?.isEmpty ?? true ? 'Campo requerido' : null," : ""}\n            ),\n          ),\n          const SizedBox(height: 18),\n`;
        }
      }
    }
  }

  // Campos propios
  for (const a of attrs) {
    if (a.pk) continue;
    const rawFieldName = (a.name || "field").replace(/[^A-Za-z0-9_]/g, "");
    const fieldName = rawFieldName.charAt(0).toLowerCase() + rawFieldName.slice(1);
    const dartType = toDartType(a.type ?? "String");

    if (dartType === "DateTime") {
      controllers += `  DateTime? _${fieldName};\n`;
      controllerInits += `    _${fieldName} = widget.${varName}?.${fieldName};\n`;
      formFields += `          _buildDateField('${a.name}', _${fieldName}, (date) => setState(() => _${fieldName} = date)),\n`;
    } else if (dartType === "bool") {
      controllers += `  bool _${fieldName} = false;\n`;
      controllerInits += `    _${fieldName} = widget.${varName}?.${fieldName} ?? false;\n`;
      formFields += `          Container(\n            decoration: BoxDecoration(\n              borderRadius: BorderRadius.circular(14),\n              gradient: LinearGradient(\n                begin: Alignment.topLeft,\n                end: Alignment.bottomRight,\n                colors: [\n                  Colors.white,\n                  Colors.deepPurple.shade50.withOpacity(0.1),\n                ],\n              ),\n              border: Border.all(\n                color: Colors.deepPurple.shade200.withOpacity(0.5),\n                width: 1.5,\n              ),\n              boxShadow: [\n                BoxShadow(\n                  color: Colors.deepPurple.withOpacity(0.05),\n                  blurRadius: 8,\n                  offset: const Offset(0, 2),\n                ),\n              ],\n            ),\n            child: SwitchListTile(\n              title: Row(\n                children: [\n                  Icon(\n                    Icons.toggle_on_outlined,\n                    color: Colors.deepPurple.shade400,\n                    size: 24,\n                  ),\n                  const SizedBox(width: 12),\n                  Text(\n                    '${a.name}',\n                    style: TextStyle(\n                      fontWeight: FontWeight.w600,\n                      color: Colors.grey.shade700,\n                    ),\n                  ),\n                ],\n              ),\n              value: _${fieldName},\n              onChanged: (value) => setState(() => _${fieldName} = value),\n              activeColor: Colors.deepPurple.shade600,\n              activeTrackColor: Colors.deepPurple.shade200,\n              contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),\n            ),\n          ),\n          const SizedBox(height: 18),\n`;
    } else {
      controllers += `  final _${fieldName}Controller = TextEditingController();\n`;
      controllerInits += `    _${fieldName}Controller.text = widget.${varName}?.${fieldName}?.toString() ?? '';\n`;
      controllerDisposes += `    _${fieldName}Controller.dispose();\n`;

      const keyboardType = dartType === "int" || dartType === "double" ? "TextInputType.number" :
                          a.type === "email" ? "TextInputType.emailAddress" : "TextInputType.text";
      const obscureText = a.type === "password" ? "true" : "false";
      const iconName = a.type === "email" ? "Icons.email_outlined" : 
                       a.type === "password" ? "Icons.lock_outline_rounded" :
                       dartType === "int" || dartType === "double" ? "Icons.numbers_rounded" :
                       "Icons.text_fields_rounded";
      formFields += `          Container(\n            decoration: BoxDecoration(\n              borderRadius: BorderRadius.circular(14),\n              gradient: LinearGradient(\n                begin: Alignment.topLeft,\n                end: Alignment.bottomRight,\n                colors: [\n                  Colors.white,\n                  Colors.deepPurple.shade50.withOpacity(0.1),\n                ],\n              ),\n              boxShadow: [\n                BoxShadow(\n                  color: Colors.deepPurple.withOpacity(0.05),\n                  blurRadius: 8,\n                  offset: const Offset(0, 2),\n                ),\n              ],\n            ),\n            child: TextFormField(\n              controller: _${fieldName}Controller,\n              decoration: InputDecoration(\n                labelText: '${a.name}',\n                labelStyle: TextStyle(\n                  color: Colors.grey.shade600,\n                  fontWeight: FontWeight.w600,\n                ),\n                filled: true,\n                fillColor: Colors.transparent,\n                prefixIcon: Icon(\n                  ${iconName},\n                  color: Colors.deepPurple.shade400,\n                ),\n                border: OutlineInputBorder(\n                  borderRadius: BorderRadius.circular(14),\n                  borderSide: BorderSide.none,\n                ),\n                enabledBorder: OutlineInputBorder(\n                  borderRadius: BorderRadius.circular(14),\n                  borderSide: BorderSide(\n                    color: Colors.deepPurple.shade200.withOpacity(0.5),\n                    width: 1.5,\n                  ),\n                ),\n                focusedBorder: OutlineInputBorder(\n                  borderRadius: BorderRadius.circular(14),\n                  borderSide: BorderSide(\n                    color: Colors.deepPurple.shade600,\n                    width: 2,\n                  ),\n                ),\n                errorBorder: OutlineInputBorder(\n                  borderRadius: BorderRadius.circular(14),\n                  borderSide: const BorderSide(\n                    color: Colors.red,\n                    width: 1.5,\n                  ),\n                ),\n                focusedErrorBorder: OutlineInputBorder(\n                  borderRadius: BorderRadius.circular(14),\n                  borderSide: const BorderSide(\n                    color: Colors.red,\n                    width: 2,\n                  ),\n                ),\n              ),\n              keyboardType: ${keyboardType},\n              obscureText: ${obscureText},\n              ${a.required ? "validator: (value) => value?.isEmpty ?? true ? 'Campo requerido' : null," : ""}\n            ),\n          ),\n          const SizedBox(height: 18),\n`;
    }
  }

  // Campos para relaciones ManyToOne (Foreign Keys)
  const manyToOneRelations: Array<{fieldIdName: string, otherClassName: string, otherSnakeName: string, otherIdType: string, fieldDisplayName: string}> = [];

  for (const r of rels) {
    const relation = r.relation;
    if (relation.relationType === "generalization") continue;

    const thisHasManyToOne =
      (r.isSource && r.srcMany && !r.dstMany) ||
      (!r.isSource && r.dstMany && !r.srcMany);

    if (thisHasManyToOne) {
      const otherClassName = r.other.name.replace(/[^A-Za-z0-9]/g, "") || "Other";
      const otherSnakeName = toSnakeCase(otherClassName);
      const otherIdAttr = (r.other.attributes as Attr[] | undefined)?.find((a) => a.pk);
      const otherIdName = (otherIdAttr?.name ?? "id").replace(/[^A-Za-z0-9_]/g, "") || "id";
      const otherIdType = toDartType(otherIdAttr?.type ?? "int");

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
      const fieldIdName = `${currentFieldName}${capitalize(otherIdName)}`;

      manyToOneRelations.push({
        fieldIdName,
        otherClassName,
        otherSnakeName,
        otherIdType,
        fieldDisplayName: r.other.name
      });

      // Agregar variable de estado para el dropdown
      controllers += `  ${otherIdType}? _${fieldIdName};\n`;
      controllers += `  List<${otherClassName}> _${otherClassName.charAt(0).toLowerCase() + otherClassName.slice(1)}Options = [];\n`;

      // Inicializar con el valor actual
      controllerInits += `    _${fieldIdName} = widget.${varName}?.${fieldIdName};\n`;
      controllerInits += `    _load${otherClassName}Options();\n`;

      // Agregar campo dropdown en el formulario
      const optionsVarName = `${otherClassName.charAt(0).toLowerCase() + otherClassName.slice(1)}Options`;
      formFields += `          DropdownButtonFormField<${otherIdType}>(\n`;
      formFields += `            value: _${fieldIdName},\n`;
      formFields += `            decoration: InputDecoration(\n`;
      formFields += `              labelText: '${r.other.name}',\n`;
      formFields += `              filled: true,\n`;
      formFields += `              fillColor: Colors.grey.shade50,\n`;
      formFields += `              border: OutlineInputBorder(\n`;
      formFields += `                borderRadius: BorderRadius.circular(12),\n`;
      formFields += `                borderSide: BorderSide.none,\n`;
      formFields += `              ),\n`;
      formFields += `              enabledBorder: OutlineInputBorder(\n`;
      formFields += `                borderRadius: BorderRadius.circular(12),\n`;
      formFields += `                borderSide: BorderSide(color: Colors.grey.shade300),\n`;
      formFields += `              ),\n`;
      formFields += `              focusedBorder: OutlineInputBorder(\n`;
      formFields += `                borderRadius: BorderRadius.circular(12),\n`;
      formFields += `                borderSide: BorderSide(color: Colors.deepPurple.shade700, width: 2),\n`;
      formFields += `              ),\n`;
      formFields += `              prefixIcon: Icon(Icons.link_rounded, color: Colors.purple.shade700),\n`;
      formFields += `            ),\n`;
      formFields += `            items: _${optionsVarName}.map((item) => DropdownMenuItem<${otherIdType}>(\n`;
      formFields += `              value: item.${otherIdName},\n`;
      formFields += `              child: Text(item.${otherIdName}?.toString() ?? 'ID: \${item.${otherIdName}}'),\n`;
      formFields += `            )).toList(),\n`;
      formFields += `            onChanged: (value) => setState(() => _${fieldIdName} = value),\n`;
      formFields += `            validator: (value) => value == null ? 'Seleccione ${r.other.name}' : null,\n`;
      formFields += `          ),\n`;
      formFields += `          const SizedBox(height: 16),\n`;
    }
  }

  // Generar código para construir el objeto
  let buildObjectFields = `        ${idName}: widget.${varName}?.${idName}`;

  if (inheritanceInfo) {
    const parentEntity = byId.get(inheritanceInfo.parentId);
    if (parentEntity) {
      const parentAttrs = (parentEntity.attributes || []) as Attr[];
      for (const a of parentAttrs) {
        if (a.pk) continue;
        const rawFieldName = (a.name || "field").replace(/[^A-Za-z0-9_]/g, "");
        const fieldName = rawFieldName.charAt(0).toLowerCase() + rawFieldName.slice(1);
        const dartType = toDartType(a.type ?? "String");

        if (dartType === "DateTime" || dartType === "bool") {
          buildObjectFields += `,\n        ${fieldName}: _${fieldName}`;
        } else if (dartType === "int") {
          buildObjectFields += `,\n        ${fieldName}: int.tryParse(_${fieldName}Controller.text)`;
        } else if (dartType === "double") {
          buildObjectFields += `,\n        ${fieldName}: double.tryParse(_${fieldName}Controller.text)`;
        } else {
          buildObjectFields += `,\n        ${fieldName}: _${fieldName}Controller.text`;
        }
      }
    }
  }

  for (const a of attrs) {
    if (a.pk) continue;
    const rawFieldName = (a.name || "field").replace(/[^A-Za-z0-9_]/g, "");
    const fieldName = rawFieldName.charAt(0).toLowerCase() + rawFieldName.slice(1);
    const dartType = toDartType(a.type ?? "String");

    if (dartType === "DateTime" || dartType === "bool") {
      buildObjectFields += `,\n        ${fieldName}: _${fieldName}`;
    } else if (dartType === "int") {
      buildObjectFields += `,\n        ${fieldName}: int.tryParse(_${fieldName}Controller.text)`;
    } else if (dartType === "double") {
      buildObjectFields += `,\n        ${fieldName}: double.tryParse(_${fieldName}Controller.text)`;
    } else {
      buildObjectFields += `,\n        ${fieldName}: _${fieldName}Controller.text`;
    }
  }

  // Agregar Foreign Keys (ManyToOne)
  for (const rel of manyToOneRelations) {
    buildObjectFields += `,\n        ${rel.fieldIdName}: _${rel.fieldIdName}`;
  }

  const needsDateFormat = attrs.some(a => !a.pk && (a.type === "date" || a.type === "datetime")) ||
    (inheritanceInfo && byId.get(inheritanceInfo.parentId)?.attributes?.some((a: any) => !a.pk && (a.type === "date" || a.type === "datetime")));

  // Generar imports para las entidades relacionadas
  const relatedImports = manyToOneRelations.map(rel =>
    `import '../models/${rel.otherSnakeName}_model.dart';\nimport '../services/${rel.otherSnakeName}_service.dart';`
  ).join('\n');

  return `// lib/screens/${snakeName}_form_screen.dart

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';${needsDateFormat ? "\nimport 'package:intl/intl.dart';" : ""}
import '../models/${snakeName}_model.dart';
import '../providers/${snakeName}_provider.dart';
${relatedImports}

class ${className}FormScreen extends StatefulWidget {
  final ${className}? ${varName};

  const ${className}FormScreen({
    Key? key,
    this.${varName},
  }) : super(key: key);

  @override
  State<${className}FormScreen> createState() => _${className}FormScreenState();
}

class _${className}FormScreenState extends State<${className}FormScreen> {
  final _formKey = GlobalKey<FormState>();
${controllers}
  @override
  void initState() {
    super.initState();
${controllerInits}  }

  @override
  void dispose() {
${controllerDisposes}    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.${varName} != null;

    return Scaffold(
      backgroundColor: Colors.grey.shade100,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.deepPurple.shade700,
        foregroundColor: Colors.white,
        title: Text(
          isEdit ? 'Editar ${className}' : 'Crear ${className}',
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 20,
          ),
        ),
      ),
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Colors.deepPurple.shade50.withOpacity(0.3),
              Colors.white,
              Colors.purple.shade50.withOpacity(0.2),
            ],
          ),
        ),
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              // Hero Header Card
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Colors.deepPurple.shade600,
                      Colors.deepPurple.shade700,
                      Colors.purple.shade600,
                    ],
                  ),
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.deepPurple.withOpacity(0.4),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                      spreadRadius: 2,
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.25),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: Colors.white.withOpacity(0.3),
                          width: 2,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.1),
                            blurRadius: 8,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Icon(
                        isEdit ? Icons.edit_document : Icons.note_add_rounded,
                        color: Colors.white,
                        size: 30,
                      ),
                    ),
                    const SizedBox(width: 18),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            isEdit ? 'Editar Información' : 'Nuevo Registro',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.5,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.2),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: Colors.white.withOpacity(0.3),
                                width: 1,
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: const [
                                Icon(
                                  Icons.info_outline,
                                  color: Colors.white,
                                  size: 14,
                                ),
                                SizedBox(width: 6),
                                Text(
                                  'Complete los campos',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // Form Fields Card with glassmorphism
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(
                    color: Colors.deepPurple.shade100.withOpacity(0.5),
                    width: 1.5,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.deepPurple.withOpacity(0.08),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                      spreadRadius: 2,
                    ),
                    BoxShadow(
                      color: Colors.white.withOpacity(0.9),
                      blurRadius: 8,
                      offset: const Offset(-4, -4),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                Colors.deepPurple.shade400,
                                Colors.purple.shade500,
                              ],
                            ),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(
                            Icons.edit_note_rounded,
                            color: Colors.white,
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Text(
                          'Datos del Formulario',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: Colors.grey.shade900,
                            letterSpacing: -0.5,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    Container(
                      height: 2,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            Colors.deepPurple.shade200,
                            Colors.purple.shade200.withOpacity(0.3),
                            Colors.transparent,
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
${formFields}                  ],
                ),
              ),

              const SizedBox(height: 28),

              // Submit Button with gradient and shadow
              Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Colors.deepPurple.shade600,
                      Colors.deepPurple.shade700,
                      Colors.purple.shade600,
                    ],
                  ),
                  borderRadius: BorderRadius.circular(18),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.deepPurple.withOpacity(0.4),
                      blurRadius: 16,
                      offset: const Offset(0, 8),
                      spreadRadius: 1,
                    ),
                  ],
                ),
                child: ElevatedButton(
                  onPressed: _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.transparent,
                    foregroundColor: Colors.white,
                    shadowColor: Colors.transparent,
                    padding: const EdgeInsets.symmetric(vertical: 20),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(18),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.2),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          isEdit ? Icons.check_circle_outline : Icons.add_circle_outline,
                          size: 24,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Text(
                        isEdit ? 'Guardar Cambios' : 'Crear Registro',
                        style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

${manyToOneRelations.map(rel => {
    const optionsVarName = `${rel.otherClassName.charAt(0).toLowerCase() + rel.otherClassName.slice(1)}Options`;
    return `
  Future<void> _load${rel.otherClassName}Options() async {
    try {
      final service = ${rel.otherClassName}Service();
      final items = await service.getAll();
      if (mounted) {
        setState(() {
          _${optionsVarName} = items;
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error al cargar ${rel.fieldDisplayName}: \$e')),
        );
      }
    }
  }`;
  }).join('\n')}

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final ${varName} = ${className}(
${buildObjectFields},
    );

    final provider = context.read<${className}Provider>();
    final result = widget.${varName} != null
        ? await provider.update(${varName})
        : await provider.create(${varName});

    if (result != null && mounted) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.check_circle_rounded, color: Colors.white),
              const SizedBox(width: 12),
              Text(
                widget.${varName} != null ? 'Actualizado correctamente' : 'Creado correctamente',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ],
          ),
          backgroundColor: Colors.green.shade700,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          margin: const EdgeInsets.all(16),
        ),
      );
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.error_rounded, color: Colors.white),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Error: \${provider.error}',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
          backgroundColor: Colors.red.shade700,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          margin: const EdgeInsets.all(16),
        ),
      );
    }
  }${needsDateFormat ? `

  Widget _buildDateField(String label, DateTime? value, Function(DateTime?) onChanged) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          decoration: BoxDecoration(
            color: Colors.grey.shade50,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.grey.shade300),
          ),
          child: ListTile(
            title: Text(
              label,
              style: TextStyle(
                fontSize: 12,
                color: Colors.grey.shade700,
                fontWeight: FontWeight.w500,
              ),
            ),
            subtitle: Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Row(
                children: [
                  Icon(Icons.calendar_today_rounded, size: 16, color: Colors.deepPurple.shade700),
                  const SizedBox(width: 8),
                  Text(
                    value != null ? DateFormat('yyyy-MM-dd').format(value) : 'Seleccionar fecha',
                    style: TextStyle(
                      fontSize: 16,
                      color: value != null ? Colors.grey.shade800 : Colors.grey.shade500,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            trailing: Icon(Icons.edit_calendar_rounded, color: Colors.deepPurple.shade700),
            onTap: () async {
              final date = await showDatePicker(
                context: context,
                initialDate: value ?? DateTime.now(),
                firstDate: DateTime(2000),
                lastDate: DateTime(2100),
                builder: (context, child) {
                  return Theme(
                    data: Theme.of(context).copyWith(
                      colorScheme: ColorScheme.light(
                        primary: Colors.deepPurple.shade700,
                      ),
                    ),
                    child: child!,
                  );
                },
              );
              if (date != null) {
                onChanged(date);
              }
            },
          ),
        ),
        const SizedBox(height: 16),
      ],
    );
  }` : ""}
}
`;
}

function generateCard(
  ent: PlainEntity,
  className: string,
  snakeName: string,
  attrs: Attr[]
): string {
  const varName = className.charAt(0).toLowerCase() + className.slice(1);
  const idAttr = attrs.find(a => a.pk);
  const idName = (idAttr?.name ?? "id").replace(/[^A-Za-z0-9_]/g, "") || "id";

  // Encontrar el primer campo string para mostrar
  const firstStringAttr = attrs.find(a => !a.pk && (a.type === "string" || a.type === "email"));
  const rawDisplayField = firstStringAttr ? (firstStringAttr.name || "name").replace(/[^A-Za-z0-9_]/g, "") : idName;
  const displayField = rawDisplayField.charAt(0).toLowerCase() + rawDisplayField.slice(1);

  // Encontrar un segundo campo para el subtitle
  const secondAttr = attrs.find(a => !a.pk && a.name !== firstStringAttr?.name);
  const rawSubtitleField = secondAttr ? (secondAttr.name || "").replace(/[^A-Za-z0-9_]/g, "") : "";
  const subtitleField = rawSubtitleField ? rawSubtitleField.charAt(0).toLowerCase() + rawSubtitleField.slice(1) : null;

  return `// lib/widgets/${snakeName}_card.dart

import 'package:flutter/material.dart';
import '../models/${snakeName}_model.dart';

class ${className}Card extends StatelessWidget {
  final ${className} ${varName};
  final VoidCallback? onTap;

  const ${className}Card({
    Key? key,
    required this.${varName},
    this.onTap,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Colors.white,
            Colors.deepPurple.shade50.withOpacity(0.3),
          ],
        ),
        border: Border.all(
          color: Colors.deepPurple.shade100.withOpacity(0.5),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.deepPurple.withOpacity(0.08),
            blurRadius: 20,
            offset: const Offset(0, 8),
            spreadRadius: 2,
          ),
          BoxShadow(
            color: Colors.white.withOpacity(0.9),
            blurRadius: 8,
            offset: const Offset(-4, -4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(24),
          onTap: onTap,
          splashColor: Colors.deepPurple.shade100.withOpacity(0.3),
          highlightColor: Colors.deepPurple.shade50.withOpacity(0.2),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Icon header with gradient background
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            Colors.deepPurple.shade400,
                            Colors.deepPurple.shade600,
                          ],
                        ),
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.deepPurple.withOpacity(0.3),
                            blurRadius: 8,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: const Icon(
                        Icons.dashboard_rounded,
                        color: Colors.white,
                        size: 24,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            Colors.deepPurple.shade50,
                            Colors.purple.shade50,
                          ],
                        ),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: Colors.deepPurple.shade200.withOpacity(0.5),
                          width: 1,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.fiber_manual_record,
                            size: 8,
                            color: Colors.deepPurple.shade400,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            'ID: \${${varName}.${idName}}',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: Colors.deepPurple.shade700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                
                const Spacer(),
                
                // Content section
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      ${varName}.${displayField}?.toString() ?? 'Sin nombre',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: Colors.grey.shade900,
                        letterSpacing: -0.3,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),${subtitleField ? `
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        ${varName}.${subtitleField}?.toString() ?? '',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey.shade600,
                          fontWeight: FontWeight.w500,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),` : ""}
                  ],
                ),
                
                const SizedBox(height: 16),
                
                // Action button
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        Colors.deepPurple.shade100.withOpacity(0.5),
                        Colors.purple.shade100.withOpacity(0.3),
                      ],
                    ),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: Colors.deepPurple.shade200.withOpacity(0.4),
                      width: 1,
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.visibility_outlined,
                        size: 16,
                        color: Colors.deepPurple.shade700,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'Ver detalles',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: Colors.deepPurple.shade700,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Icon(
                        Icons.arrow_forward_ios_rounded,
                        size: 12,
                        color: Colors.deepPurple.shade600,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
`;
}

function generateMain(packageName: string, entities: PlainEntity[]): string {
  // Generar imports y providers
  const imports = entities.map(e => {
    const className = e.name.replace(/[^A-Za-z0-9]/g, "") || "Entity";
    const snakeName = toSnakeCase(className);
    return `import 'providers/${snakeName}_provider.dart';\nimport 'screens/${snakeName}_list_screen.dart';`;
  }).join('\n');

  const providers = entities.map(e => {
    const className = e.name.replace(/[^A-Za-z0-9]/g, "") || "Entity";
    return `        ChangeNotifierProvider(create: (_) => ${className}Provider()),`;
  }).join('\n');

  const entityCards = entities.map((e, i) => {
    const className = e.name.replace(/[^A-Za-z0-9]/g, "") || "Entity";
    const icons = ['dashboard', 'people', 'inventory', 'shopping_cart', 'article', 'folder', 'category', 'label'];
    const colors = ['blue', 'purple', 'green', 'orange', 'red', 'teal', 'indigo', 'pink'];
    const icon = icons[i % icons.length];
    const color = colors[i % colors.length];

    return `          _buildEntityCard(
            context,
            '${className}',
            Icons.${icon}_rounded,
            Colors.${color}.shade700,
            () => Navigator.push(
              context,
              MaterialPageRoute(builder: (context) => const ${className}ListScreen()),
            ),
          ),`;
  }).join('\n');

  return `// lib/main.dart

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
${imports}

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
${providers}
      ],
      child: MaterialApp(
        title: '${packageName}',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          primarySwatch: Colors.deepPurple,
          useMaterial3: true,
        ),
        home: const HomeScreen(),
      ),
    );
  }
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey.shade100,
      body: CustomScrollView(
        slivers: [
          // Modern App Bar with gradient
          SliverAppBar(
            expandedHeight: 200,
            floating: false,
            pinned: true,
            elevation: 0,
            flexibleSpace: FlexibleSpaceBar(
              title: const Text(
                '${packageName}',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 24,
                ),
              ),
              background: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Colors.deepPurple.shade700, Colors.deepPurple.shade500],
                  ),
                ),
                child: Stack(
                  children: [
                    Positioned(
                      right: -50,
                      top: -50,
                      child: Container(
                        width: 200,
                        height: 200,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white.withOpacity(0.1),
                        ),
                      ),
                    ),
                    Positioned(
                      left: -30,
                      bottom: -30,
                      child: Container(
                        width: 150,
                        height: 150,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white.withOpacity(0.1),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // Content
          SliverPadding(
            padding: const EdgeInsets.all(16),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                // Welcome message
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.05),
                        blurRadius: 10,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.deepPurple.shade50,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Icon(Icons.apps_rounded, color: Colors.deepPurple.shade700, size: 28),
                          ),
                          const SizedBox(width: 16),
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Bienvenido',
                                  style: TextStyle(
                                    fontSize: 22,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                SizedBox(height: 4),
                                Text(
                                  'Seleccione una entidad para comenzar',
                                  style: TextStyle(
                                    color: Colors.grey,
                                    fontSize: 14,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 24),

                // Entity cards list
                Column(
                  children: [
${entityCards}
                  ],
                ),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEntityCard(BuildContext context, String title, IconData icon, Color color, VoidCallback onTap) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Colors.white,
            color.withOpacity(0.05),
          ],
        ),
        border: Border.all(
          color: color.withOpacity(0.2),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: color.withOpacity(0.15),
            blurRadius: 12,
            offset: const Offset(0, 4),
            spreadRadius: 1,
          ),
          BoxShadow(
            color: Colors.white.withOpacity(0.9),
            blurRadius: 8,
            offset: const Offset(-2, -2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: onTap,
          splashColor: color.withOpacity(0.1),
          highlightColor: color.withOpacity(0.05),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              children: [
                // Icon container with gradient
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        color.withOpacity(0.8),
                        color,
                      ],
                    ),
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: color.withOpacity(0.3),
                        blurRadius: 8,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Icon(
                    icon,
                    size: 32,
                    color: Colors.white,
                  ),
                ),
                
                const SizedBox(width: 20),
                
                // Title and subtitle
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: Colors.grey.shade900,
                          letterSpacing: -0.3,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: color.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                            color: color.withOpacity(0.3),
                            width: 1,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.list_alt_rounded,
                              size: 14,
                              color: color,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              'Ver listado',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: color,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                
                // Arrow icon
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.arrow_forward_ios_rounded,
                    size: 18,
                    color: color,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
`;
}

