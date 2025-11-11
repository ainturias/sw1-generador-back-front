// src/app/api/ai/audio-to-erd/route.ts
import { NextRequest, NextResponse } from "next/server";
import { gemini, modelName } from "../../../../lib/gemini";

// Aumentar el límite de tamaño del body para audio
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No se proporcionó archivo de audio" },
        { status: 400 }
      );
    }

    // Validar formato de audio
    const validFormats = [
      "audio/wav",
      "audio/mp3",
      "audio/mpeg",
      "audio/mp4",
      "audio/aac",
      "audio/ogg",
      "audio/flac",
      "audio/x-m4a",
      "audio/webm",           // Grabación desde navegador
      "audio/webm;codecs=opus", // Variante de WebM
      "audio/x-matroska",     // Otro formato de contenedor
    ];

    if (!validFormats.includes(audioFile.type)) {
      return NextResponse.json(
        { error: `Formato de audio no soportado: ${audioFile.type}` },
        { status: 400 }
      );
    }

    // Validar tamaño (máximo 20MB)
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (audioFile.size > maxSize) {
      return NextResponse.json(
        { error: "El archivo de audio es demasiado grande (máximo 20MB)" },
        { status: 400 }
      );
    }

    console.log(`📁 Procesando audio: ${audioFile.name} (${(audioFile.size / 1024 / 1024).toFixed(2)}MB)`);

    // Convertir audio a base64
    const bytes = await audioFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Audio = buffer.toString("base64");

    // Prompt para Gemini
    const prompt = `Eres un experto en análisis de diagramas de Entidad-Relación (ERD).

Analiza el siguiente audio donde el usuario describe un sistema de base de datos y genera un diagrama ERD.

INSTRUCCIONES:
1. Identifica todas las ENTIDADES mencionadas
2. Extrae los ATRIBUTOS de cada entidad con sus tipos de datos
3. Identifica las RELACIONES entre entidades
4. Determina las CARDINALIDADES (ONE o MANY)
5. Identifica el tipo de relación UML (association, composition, aggregation, generalization, realization)

REGLAS:
- Si no se menciona tipo de dato, usa "string"
- Si no se menciona cardinalidad, asume ONE:MANY
- El primer atributo de cada entidad es la clave primaria (pk: true)
- Para relaciones de herencia, usa "generalization"
- Para relaciones de composición (parte-todo fuerte), usa "composition"
- Para relaciones de agregación (parte-todo débil), usa "aggregation"

FORMATO DE SALIDA (JSON estricto):
{
  "entities": [
    {
      "name": "NombreEntidad",
      "attributes": [
        {"name": "id", "type": "long", "pk": true},
        {"name": "nombre", "type": "string", "required": true}
      ]
    }
  ],
  "relations": [
    {
      "sourceEntity": "EntidadOrigen",
      "targetEntity": "EntidadDestino",
      "relationType": "association",
      "sourceCard": "ONE",
      "targetCard": "MANY"
    }
  ]
}

TIPOS DE DATOS VÁLIDOS: string, int, long, float, double, boolean, date, datetime, email, password

Responde SOLO con el JSON, sin explicaciones adicionales.`;

    // Llamar a Gemini con audio
    const result = await gemini.models.generateContent({
      model: modelName,
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: audioFile.type,
                data: base64Audio,
              },
            },
          ],
        },
      ],
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
      } as any,
    });

    const text = extractTextV120(result);

    console.log("🤖 Respuesta de Gemini:", text.substring(0, 200));

    // Limpiar y parsear respuesta
    let cleanedText = text.trim();
    
    // Remover markdown code blocks si existen
    if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    }

    // Parsear JSON
    const diagram = JSON.parse(cleanedText);

    // Validar estructura
    if (!diagram.entities || !Array.isArray(diagram.entities)) {
      throw new Error("Formato de respuesta inválido: falta array de entidades");
    }

    if (!diagram.relations || !Array.isArray(diagram.relations)) {
      throw new Error("Formato de respuesta inválido: falta array de relaciones");
    }

    console.log("✅ Diagrama generado exitosamente");
    console.log(`   - Entidades: ${diagram.entities.length}`);
    console.log(`   - Relaciones: ${diagram.relations.length}`);

    return NextResponse.json({
      success: true,
      diagram,
      message: `Diagrama generado con ${diagram.entities.length} entidades y ${diagram.relations.length} relaciones`,
    });
  } catch (error: any) {
    console.error("❌ Error procesando audio:", error);

    if (error.message?.includes("JSON")) {
      return NextResponse.json(
        {
          error: "Error al interpretar el audio",
          details: "No se pudo generar un diagrama válido. Intenta describir el sistema con más claridad.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        error: "Error procesando el audio",
        details: error.message || "Error desconocido",
      },
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

