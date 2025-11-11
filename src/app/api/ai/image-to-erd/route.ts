import { NextResponse } from "next/server";
import { gemini, modelName } from "../../../../lib/gemini";

type ImageToErdRequest = {
  imageData: string; // Base64 string
  mimeType: string;  // image/png, image/jpeg, etc.
};

export async function POST(req: Request) {
  try {
    // Validar que se recibió la imagen
    const body = await req.json();
    const { imageData, mimeType } = body as ImageToErdRequest;

    if (!imageData || typeof imageData !== "string") {
      return NextResponse.json(
        { error: "El campo 'imageData' es requerido (base64)" },
        { status: 400 }
      );
    }

    if (!mimeType || !mimeType.startsWith("image/")) {
      return NextResponse.json(
        { error: "El campo 'mimeType' debe ser un tipo de imagen válido (image/png, image/jpeg, etc.)" },
        { status: 400 }
      );
    }

    console.log("📸 Procesando imagen de diagrama con IA...");
    console.log("   Tipo: ", mimeType);
    console.log("   Tamaño: ", (imageData.length / 1024).toFixed(2), "KB");

    const systemPrompt = `
Eres un asistente experto en análisis de diagramas UML y Entidad-Relación.
Tu tarea es analizar la imagen proporcionada y extraer la estructura del diagrama.

**Analiza cuidadosamente:**
1. Identifica todas las ENTIDADES (cajas/rectángulos con nombres)
2. Identifica los ATRIBUTOS de cada entidad (campos dentro de las cajas)
3. Identifica los tipos de RELACIONES entre entidades (líneas conectoras) 
4. Identifica las CARDINALIDADES (1, *, 0..1, 1..*, etc.)

**Devuelve SOLO JSON (sin markdown, sin explicaciones) con este formato:**

{
  "entities": [
    {
      "name": "NombreEntidad",
      "attributes": [
        { "name": "id", "type": "long", "pk": true, "required": true },
        { "name": "nombreCampo", "type": "string", "required": false }
      ]
    }
  ],
  "relations": [
    {
      "sourceName": "EntidadOrigen",
      "targetName": "EntidadDestino",
      "relationType": "association",
      "sourceCard": "ONE",
      "targetCard": "MANY",
      "owningSide": "target"
    }
  ]
}

**Reglas de interpretación:**

1. **Entidades:**
   - Nombres en PascalCase (ej: "Persona", "Casa", "Condominio")
   - SIEMPRE incluye un atributo "id" (type: "long", pk: true, required: true) aunque no esté en la imagen

2. **Atributos:**
   - Nombres en camelCase (ej: "nombre", "precio", "direccion")
   - Infiere tipos de datos según el nombre:
     - "id", "codigo", "numero" → "long"
     - "nombre", "descripcion", "direccion" → "string"
     - "precio", "costo", "monto" → "double"
     - "fecha", "date" → "date"
     - "fechaHora", "timestamp" → "datetime"
     - "email", "correo" → "email"
     - "activo", "habilitado" → "boolean"
     - Por defecto → "string"
   - Si no hay atributos en la imagen, infiere 2-3 atributos básicos según el tipo de entidad

3. **Cardinalidades:**
   - "1" → "ONE"
   - "*", "N", "muchos", "varios" → "MANY"
   - "0..1" → "ONE" (opcional)
   - "1..*" → "MANY"
   - Si no está clara, usa "ONE" para el origen y "MANY" para el destino

4. **Tipos de Relaciones UML (IMPORTANTE - Analiza el estilo de la línea):**
   
   **"association"** (Asociación - línea simple):
   - Línea continua simple ─────
   - Es el tipo por defecto si no identificas claramente otro
   
   **"aggregation"** (Agregación - diamante vacío):
   - Línea con diamante VACÍO/BLANCO al inicio ◇─────
   - El diamante está del lado del "todo" (contenedor)
   - Relación "tiene-un" débil
   
   **"composition"** (Composición - diamante lleno):
   - Línea con diamante LLENO/NEGRO al inicio ◆─────
   - El diamante está del lado del "todo" (contenedor)
   - Relación "es-parte-de" fuerte
   - El "todo" es responsable del ciclo de vida de las "partes"
   
   **"generalization"** (Herencia/Generalización - triángulo vacío):
   - Línea continua con triángulo VACÍO al final ─────▷
   - Flecha con triángulo vacío →▷
   - El triángulo apunta hacia la clase padre/superclase
   - Representa herencia: "es-un-tipo-de"
   
   **"realization"** (Implementación/Realización - triángulo punteado):
   - Línea PUNTEADA con triángulo vacío ┈┈┈┈┈▷
   - Flecha punteada con triángulo ┈┈→▷
   - Representa implementación de interfaz
   
   **"dependency"** (Dependencia - flecha punteada):
   - Línea PUNTEADA con flecha simple ┈┈┈┈→
   - Flecha punteada sin triángulo
   - Relación débil de uso/dependencia

5. **Relaciones:**
   - sourceName: La entidad de donde parte la línea
   - targetName: La entidad a donde llega la línea
   - relationType: Analiza CUIDADOSAMENTE el ESTILO de la línea (ver punto 4)
   - sourceCard/targetCard: Las cardinalidades
   - owningSide: "target" por defecto (el lado "MANY" es el dueño de la FK)

6. **Casos especiales:**
   - Si ves notación "1:N" o "1→N" → sourceCard="ONE", targetCard="MANY"
   - Si ves "N:M" → Puedes crear una entidad intermedia O usar relationType="association" con ambos MANY
   - Para herencia (generalization): sourceCard="ONE", targetCard="ONE"
   - Para dependencia/realización: sourceCard="ONE", targetCard="ONE"
   - Si no puedes leer algo, haz tu mejor interpretación pero SIEMPRE identifica el relationType

**Tipos válidos:**
"string", "int", "long", "double", "boolean", "date", "datetime", "email", "password"

**Tipos de relación válidos:**
"association", "aggregation", "composition", "generalization", "realization", "dependency"

**Ejemplos de salida correcta:**

Ejemplo 1 - Asociación simple:
{
  "entities": [...],
  "relations": [
    {
      "sourceName": "Persona",
      "targetName": "Casa",
      "relationType": "association",
      "sourceCard": "ONE",
      "targetCard": "MANY",
      "owningSide": "target"
    }
  ]
}

Ejemplo 2 - Composición (diamante lleno):
{
  "relations": [
    {
      "sourceName": "Casa",
      "targetName": "Habitacion",
      "relationType": "composition",
      "sourceCard": "ONE",
      "targetCard": "MANY",
      "owningSide": "target"
    }
  ]
}

Ejemplo 3 - Herencia (triángulo vacío):
{
  "relations": [
    {
      "sourceName": "Empleado",
      "targetName": "Persona",
      "relationType": "generalization",
      "sourceCard": "ONE",
      "targetCard": "ONE",
      "owningSide": "source"
    }
  ]
}

Ejemplo 4 - Agregación (diamante vacío):
{
  "relations": [
    {
      "sourceName": "Departamento",
      "targetName": "Empleado",
      "relationType": "aggregation",
      "sourceCard": "ONE",
      "targetCard": "MANY",
      "owningSide": "target"
    }
  ]
}
`.trim();

    // Llamada a Gemini Vision API
    const result = await gemini.models.generateContent({
      model: modelName,
      contents: [
        {
          role: "user",
          parts: [
            { text: systemPrompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: imageData,
              },
            },
          ],
        },
      ],
      config: {
        temperature: 0.1, // Más determinista para análisis de imágenes
        responseMimeType: "application/json",
      } as any,
    });

    const text = extractTextV120(result);

    if (!text || text.trim().length === 0) {
      console.error("❌ La IA devolvió respuesta vacía");
      return NextResponse.json(
        {
          error:
            "La IA no pudo analizar la imagen. Asegúrate de que sea un diagrama claro con entidades y relaciones visibles.",
        },
        { status: 502 }
      );
    }

    console.log("✅ Respuesta de la IA recibida:", text.substring(0, 200) + "...");

    // Parsear JSON
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (parseError) {
      console.error("❌ Error al parsear JSON:", parseError);
      console.error("Texto recibido:", text);
      return NextResponse.json(
        {
          error:
            "La IA no pudo interpretar la imagen correctamente. Intenta con una imagen más clara o con mejor iluminación.",
          raw: text.substring(0, 500),
        },
        { status: 502 }
      );
    }

    // Validar estructura básica
    const data = json as any;
    if (!data.entities || !Array.isArray(data.entities)) {
      console.error("❌ JSON no contiene 'entities' válido:", json);
      return NextResponse.json(
        {
          error:
            "No se pudieron identificar entidades en la imagen. Asegúrate de que el diagrama tenga cajas/rectángulos con nombres.",
        },
        { status: 502 }
      );
    }

    if (data.entities.length === 0) {
      return NextResponse.json(
        {
          error:
            "No se encontraron entidades en la imagen. Verifica que el diagrama sea visible y tenga elementos reconocibles.",
        },
        { status: 502 }
      );
    }

    console.log(
      `✅ Diagrama procesado: ${data.entities.length} entidades, ${data.relations?.length || 0} relaciones`
    );

    // Log de entidades encontradas
    console.log("📋 Entidades detectadas:");
    data.entities.forEach((entity: any) => {
      console.log(`   • ${entity.name} (${entity.attributes?.length || 0} atributos)`);
    });

    return NextResponse.json(json);
  } catch (err: any) {
    console.error("❌ Error en /api/ai/image-to-erd:", err);

    // Manejar errores específicos de Gemini
    if (err?.message?.includes("API key")) {
      return NextResponse.json(
        {
          error: "Error de autenticación con Gemini AI. Verifica tu GEMINI_API_KEY.",
        },
        { status: 500 }
      );
    }

    if (err?.message?.includes("quota") || err?.message?.includes("limit")) {
      return NextResponse.json(
        {
          error: "Se excedió el límite de uso de la API de Gemini. Intenta más tarde.",
        },
        { status: 429 }
      );
    }

    if (err?.message?.includes("image") || err?.message?.includes("format")) {
      return NextResponse.json(
        {
          error:
            "Formato de imagen no válido. Usa PNG, JPEG, WebP o GIF. Tamaño máximo: 4MB.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: err?.message ?? "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/** Extrae texto robustamente para @google/genai v1.20 */
function extractTextV120(res: any): string {
  // Doc de 1.20 muestra "response.text" o "response.text()".
  if (typeof res?.text === "string") return res.text;
  if (typeof res?.text === "function") return res.text();
  if (typeof res?.response?.text === "function") return res.response.text();
  if (typeof res?.response?.text === "string") return res.response.text;

  // Fallback: candidates -> content -> parts -> text
  const parts = res?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const txt = parts.map((p: any) => p?.text ?? "").join("");
    if (txt) return txt;
  }
  return "";
}

