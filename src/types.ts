export type Color = { r: number; g: number; b: number };

export type Camera = { x: number; y: number; zoom: number };
export type Point = { x: number; y: number };
export type XYWH = { x: number; y: number; width: number; height: number };


export enum CanvasMode {
  None,
  Pressing,
  Translating,
  Resizing,
  Dragging,
  SelectionNet,
  Inserting,
  RightClick,
  Linking,
}

// 👉 solo lo necesario
export enum LayerType {
  Entity = "Entity",
  Relation = "Relation",
}

export type Anchor = "L" | "R" | "T" | "B";

export type Attribute = {
  id: string;
  name: string;
  type: string;
  required?: boolean;
  pk?: boolean;
};

export type DBPrimitive =
  | "string" | "int" | "long" | "float" | "double" | "boolean"
  | "date" | "datetime" | "uuid" | "email" | "password";

export type Cardinality = "ONE" | "MANY";

// Tipos de relaciones UML 3.5
export type RelationType =
  | "association"      // Asociación simple (línea)
  | "aggregation"      // Agregación (diamante vacío)
  | "composition"      // Composición (diamante lleno)
  | "generalization"   // Generalización/Herencia (triángulo vacío)
  | "realization"      // Realización/Implementación (triángulo vacío, línea punteada)
  | "dependency";      // Dependencia (flecha, línea punteada)

export type DBAttribute = {
  id: string;
  name: string;
  type?: DBPrimitive;
  required?: boolean;
  unique?: boolean;
  length?: number;
  pk?: boolean;
};

export type EntityLayer = {
  type: LayerType.Entity;
  x: number; y: number;
  width: number; height: number;
  name: string;
  attributes: DBAttribute[];
  opacity?: number;
};

export type RelationLayer = {
  type: LayerType.Relation;
  sourceId: string;
  targetId: string;
  relationType: RelationType;  // Tipo de relación UML
  relationName?: string;       // Nombre de la relación (ej: "compras", "clientes")
  inverseName?: string;        // Nombre inverso (ej: "compradoPor", "perteneceA")
  sourceCard: Cardinality;
  targetCard: Cardinality;
  owningSide?: "source" | "target";
  opacity?: number;
};

export type Layer = EntityLayer | RelationLayer;

// Configuración del proyecto para generación de código
export type ProjectConfig = {
  // Información básica
  projectName: string;          // Nombre del proyecto (ej: "mi-proyecto")
  description?: string;         // Descripción del proyecto

  // Configuración Java/Spring Boot
  groupId: string;              // com.ejemplo.proyecto
  artifactId: string;           // mi-proyecto
  version: string;              // 1.0.0
  javaVersion: string;          // 17, 21
  springBootVersion: string;    // 3.2.0
  packaging: "jar" | "war";     // Tipo de empaquetado

  // Base de datos
  database: "mysql" | "postgresql" | "h2" | "oracle";
  databaseName?: string;        // Nombre de la base de datos
  databaseHost?: string;        // Host de la BD (default: localhost)
  databasePort?: number;        // Puerto de la BD (default: 5432 para PostgreSQL)
  databaseUsername?: string;    // Usuario de la BD
  databasePassword?: string;    // Contraseña de la BD

  // Servidor
  serverPort: number;           // 8080
  contextPath?: string;         // /api

  // Flutter (opcional)
  flutterEnabled: boolean;
  flutterVersion?: string;      // 3.16.0
  flutterPackageName?: string;  // com.ejemplo.proyecto_app
  flutterBaseUrl?: string;      // http://localhost:8080/api
};


export enum Side { Top = 1, Bottom = 2, Left = 4, Right = 8 }



export type CanvasState =
  | { mode: CanvasMode.None }
  | { mode: CanvasMode.Pressing; origin: Point }
  | { mode: CanvasMode.Translating; current: Point }
  | { mode: CanvasMode.Resizing; initialBounds: XYWH; corner: Side }
  | { mode: CanvasMode.Dragging; origin: Point | null }
  | { mode: CanvasMode.SelectionNet; origin: Point; current: Point }
  | { mode: CanvasMode.Inserting; layerType: LayerType }
  | { mode: CanvasMode.RightClick }
  | {
      mode: CanvasMode.Linking;
      fromEntityId: string;
      fromAnchor: Anchor;
      relationType: RelationType; // Tipo de relación que se está creando
      /** punto actual del cursor mientras se dibuja la relación */
      current?: Point;
    };
