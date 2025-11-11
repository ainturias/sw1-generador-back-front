import { NextResponse } from "next/server";
import { gemini, modelName } from "../../../../lib/gemini";

type AiRequest = { prompt: string };

export async function POST(req: Request) {
  try {
    // Validar que se recibió el prompt
    const body = await req.json();
    const { prompt } = body as AiRequest;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: "El campo 'prompt' es requerido y debe contener texto" },
        { status: 400 }
      );
    }

    console.log("🤖 Generando diagrama desde texto:", prompt.substring(0, 100) + "...");

    const system = `
Eres un asistente experto que convierte descripciones en lenguaje natural a diagramas Entidad-Relación.
Devuelve SOLO JSON (sin markdown, sin explicaciones) con este formato exacto:

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
      "sourceCard": "ONE",
      "targetCard": "MANY",
      "owningSide": "target"
    }
  ]
}

**Reglas importantes:**
1. SIEMPRE incluye un atributo "id" (type: "long", pk: true, required: true) en CADA entidad
2. Nombres de entidades en PascalCase (ej: "Cliente", "Pedido", "Producto")
3. Nombres de atributos en camelCase (ej: "nombreCompleto", "fechaNacimiento")
4. Tipos válidos: "string", "int", "long", "double", "boolean", "date", "datetime", "email", "password"
5. Cardinalidades válidas: "ONE" o "MANY"
6. owningSide válido: "source" o "target" (usa "target" por defecto)
7. Si encuentras N:M, crea una entidad intermedia
8. Infiere atributos relevantes según el contexto (ej: Cliente → nombre, email; Producto → nombre, precio)

**Ejemplos:**
- "Un Cliente tiene muchos Pedidos" → Cliente (ONE) → Pedido (MANY)
- "Muchos Estudiantes tienen muchos Cursos" → Crear entidad "Inscripcion" intermedia
- "Una Casa pertenece a un Condominio" → Casa (MANY) → Condominio (ONE)
`.trim();

    // Llamada a Gemini AI
    const result = await gemini.models.generateContent({
      model: modelName,
      contents: `${system}\n\n**Descripción del usuario:**\n${prompt}\n\n**Genera el JSON:**`,
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
      } as any,
    });

    const text = extractTextV120(result);

    if (!text || text.trim().length === 0) {
      console.error("❌ La IA devolvió respuesta vacía");
      return NextResponse.json(
        { error: "La IA no generó ninguna respuesta. Intenta reformular tu descripción." },
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
          error: "La IA no devolvió JSON válido. Intenta ser más específico en tu descripción.", 
          raw: text.substring(0, 500) 
        },
        { status: 502 }
      );
    }

    // Validar estructura básica
    const data = json as any;
    if (!data.entities || !Array.isArray(data.entities)) {
      console.error("❌ JSON no contiene 'entities' válido:", json);
      return NextResponse.json(
        { error: "El JSON generado no tiene el formato esperado (falta 'entities')" },
        { status: 502 }
      );
    }

    console.log(`✅ Diagrama generado: ${data.entities.length} entidades, ${data.relations?.length || 0} relaciones`);

    return NextResponse.json(json);
  } catch (err: any) {
    console.error("❌ Error en /api/ai/nl-to-erd:", err);
    
    // Manejar errores específicos de Gemini
    if (err?.message?.includes("API key")) {
      return NextResponse.json(
        { error: "Error de autenticación con Gemini AI. Verifica tu GEMINI_API_KEY." },
        { status: 500 }
      );
    }
    
    if (err?.message?.includes("quota") || err?.message?.includes("limit")) {
      return NextResponse.json(
        { error: "Se excedió el límite de uso de la API de Gemini. Intenta más tarde." },
        { status: 429 }
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
