import { RelationLayer, EntityLayer, RelationType } from "~/types";

/**
 * Convierte un nombre de clase a plural simple (inglés/español)
 */
function pluralize(name: string): string {
  const lower = name.toLowerCase();

  // Reglas especiales comunes
  const irregulars: Record<string, string> = {
    person: "people",
    persona: "personas",
    child: "children",
    user: "users",
    usuario: "usuarios",
    producto: "productos",
    pedido: "pedidos",
    cliente: "clientes",
    empleado: "empleados",
    departamento: "departamentos",
  };

  if (irregulars[lower]) {
    return irregulars[lower];
  }

  // Si termina en vocal, añadir 's'
  if (/[aeiou]$/.test(lower)) {
    return lower + "s";
  }

  // Si termina en consonante, añadir 'es' (español) o 's' (inglés)
  return lower + "s";
}

/**
 * Convierte a camelCase
 */
function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

/**
 * Genera nombres automáticos para una relación basándose en el tipo y las entidades
 */
export function generateRelationNames(
  relationType: RelationType,
  sourceEntity: EntityLayer,
  targetEntity: EntityLayer,
  sourceCard: "ONE" | "MANY" = "ONE",
  targetCard: "ONE" | "MANY" = "ONE"
): { fieldName: string; inverseName: string } {

  // Para herencia y dependencia, no se necesitan nombres de campos
  if (relationType === "generalization" || relationType === "realization" || relationType === "dependency") {
    return { fieldName: "", inverseName: "" };
  }

  const sourceName = toCamelCase(sourceEntity.name);
  const targetName = toCamelCase(targetEntity.name);

  // Agregación y Composición: El "Todo" tiene "Partes"
  if (relationType === "aggregation" || relationType === "composition") {
    // Source (Todo) tiene muchos Target (Partes)
    return {
      fieldName: pluralize(targetName),      // departamento.empleados
      inverseName: sourceName,                // empleado.departamento
    };
  }

  // Asociación: Depende de las cardinalidades
  if (relationType === "association") {
    if (sourceCard === "ONE" && targetCard === "MANY") {
      // 1:N - Source tiene muchos Target
      return {
        fieldName: pluralize(targetName),    // cliente.pedidos
        inverseName: sourceName,              // pedido.cliente
      };
    } else if (sourceCard === "MANY" && targetCard === "ONE") {
      // N:1 - Muchos Source tienen un Target
      return {
        fieldName: targetName,                // pedido.cliente
        inverseName: pluralize(sourceName),  // cliente.pedidos
      };
    } else if (sourceCard === "MANY" && targetCard === "MANY") {
      // N:M - Muchos a Muchos (aunque no deberíamos llegar aquí si creamos clase intermedia)
      return {
        fieldName: pluralize(targetName),
        inverseName: pluralize(sourceName),
      };
    } else {
      // 1:1
      return {
        fieldName: targetName,
        inverseName: sourceName,
      };
    }
  }

  // Por defecto
  return {
    fieldName: targetName,
    inverseName: sourceName,
  };
}

/**
 * Convierte tipo de dato del diagrama a tipo Java
 */
export function toJavaType(diagramType: string): string {
  const typeMap: Record<string, string> = {
    string: "String",
    int: "Integer",
    long: "Long",
    float: "Float",
    double: "Double",
    boolean: "Boolean",
    date: "LocalDate",
    datetime: "LocalDateTime",
    uuid: "UUID",
    email: "String",
    password: "String",
  };

  return typeMap[diagramType.toLowerCase()] || "String";
}

/**
 * Convierte tipo de dato del diagrama a tipo de columna SQL (PostgreSQL)
 */
export function toSQLType(diagramType: string): string {
  const typeMap: Record<string, string> = {
    string: "VARCHAR(255)",
    int: "INTEGER",
    long: "BIGINT",
    float: "REAL",
    double: "DOUBLE PRECISION",
    boolean: "BOOLEAN",
    date: "DATE",
    datetime: "TIMESTAMP",
    uuid: "UUID",
    email: "VARCHAR(255)",
    password: "VARCHAR(255)",
  };

  return typeMap[diagramType.toLowerCase()] || "VARCHAR(255)";
}

/**
 * Convierte nombre de clase a nombre de tabla (snake_case plural)
 */
export function toTableName(className: string): string {
  // Convierte CamelCase a snake_case
  const snake = className
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "");

  return pluralize(snake);
}

/**
 * Convierte nombre de campo a nombre de columna (snake_case)
 */
export function toColumnName(fieldName: string): string {
  return fieldName
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "");
}

/**
 * Convierte tipo de dato del diagrama a tipo Dart (Flutter)
 */
export function toDartType(diagramType: string): string {
  const typeMap: Record<string, string> = {
    string: "String",
    int: "int",
    long: "int",
    float: "double",
    double: "double",
    boolean: "bool",
    date: "DateTime",
    datetime: "DateTime",
    uuid: "String",
    email: "String",
    password: "String",
  };

  return typeMap[diagramType.toLowerCase()] || "String";
}

/**
 * Convierte nombre de clase a snake_case para archivos Dart
 */
export function toSnakeCase(className: string): string {
  return className
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "");
}
