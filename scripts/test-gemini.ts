// Script para probar la configuración de Gemini AI
// Ejecutar con: npx tsx scripts/test-gemini.ts

import { GoogleGenAI } from "@google/genai";

async function testGeminiConnection() {
  console.log("🧪 Probando conexión con Gemini AI...\n");

  // Verificar API key
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error("❌ ERROR: GEMINI_API_KEY no está configurada");
    console.log("\n📝 Instrucciones:");
    console.log("1. Crea un archivo .env en la raíz del proyecto");
    console.log("2. Agrega: GEMINI_API_KEY=\"tu-api-key-aqui\"");
    console.log("3. Obtén tu API key en: https://aistudio.google.com/app/apikey");
    process.exit(1);
  }

  console.log("✅ API Key encontrada:", apiKey.substring(0, 10) + "..." + apiKey.substring(apiKey.length - 4));

  try {
    const gemini = new GoogleGenAI({ apiKey });
    const modelName = "gemini-2.0-flash-exp";

    console.log(`\n🤖 Enviando petición de prueba al modelo ${modelName}...`);

    const result = await gemini.models.generateContent({
      model: modelName,
      contents: `
Eres un asistente que convierte descripciones a diagramas ER.
Devuelve SOLO JSON:

{
  "entities": [
    {
      "name": "NombreEntidad",
      "attributes": [
        { "name": "id", "type": "long", "pk": true, "required": true },
        { "name": "campo", "type": "string", "required": false }
      ]
    }
  ],
  "relations": [
    {
      "sourceName": "EntidadA",
      "targetName": "EntidadB",
      "sourceCard": "ONE",
      "targetCard": "MANY",
      "owningSide": "target"
    }
  ]
}

Descripción: Un Cliente tiene muchos Pedidos
`,
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
      } as any,
    });

    // Extraer texto
    let text = "";
    if (typeof result?.text === "string") {
      text = result.text;
    } else if (typeof result?.text === "function") {
      text = result.text();
    } else if (typeof result?.response?.text === "function") {
      text = result.response.text();
    } else if (typeof result?.response?.text === "string") {
      text = result.response.text;
    } else {
      const parts = result?.candidates?.[0]?.content?.parts;
      if (Array.isArray(parts)) {
        text = parts.map((p: any) => p?.text ?? "").join("");
      }
    }

    if (!text) {
      console.error("❌ ERROR: La IA no devolvió ninguna respuesta");
      process.exit(1);
    }

    console.log("\n✅ Respuesta recibida de la IA:");
    console.log("─".repeat(50));
    console.log(text);
    console.log("─".repeat(50));

    // Parsear JSON
    try {
      const json = JSON.parse(text);
      console.log("\n✅ JSON válido parseado correctamente");
      console.log(`📊 Entidades generadas: ${json.entities?.length || 0}`);
      console.log(`🔗 Relaciones generadas: ${json.relations?.length || 0}`);

      if (json.entities && json.entities.length > 0) {
        console.log("\n📋 Entidades:");
        json.entities.forEach((entity: any) => {
          console.log(`   • ${entity.name} (${entity.attributes?.length || 0} atributos)`);
        });
      }

      if (json.relations && json.relations.length > 0) {
        console.log("\n🔗 Relaciones:");
        json.relations.forEach((rel: any) => {
          console.log(`   • ${rel.sourceName} (${rel.sourceCard}) → ${rel.targetName} (${rel.targetCard})`);
        });
      }

      console.log("\n✅ ¡TEST EXITOSO! La configuración de Gemini AI está correcta.");
      console.log("🎉 Ahora puedes usar la funcionalidad de IA en la aplicación.");
      
    } catch (parseError) {
      console.error("\n❌ ERROR: La IA no devolvió JSON válido");
      console.error("Texto recibido:", text.substring(0, 200));
      process.exit(1);
    }

  } catch (error: any) {
    console.error("\n❌ ERROR al conectar con Gemini AI:");
    console.error(error.message);
    
    if (error.message.includes("API key")) {
      console.log("\n💡 Verifica que tu GEMINI_API_KEY sea válida");
      console.log("   Ve a: https://aistudio.google.com/app/apikey");
    }
    
    if (error.message.includes("quota") || error.message.includes("limit")) {
      console.log("\n💡 Has excedido el límite de requests. Espera un momento e intenta de nuevo.");
    }
    
    process.exit(1);
  }
}

// Ejecutar test
testGeminiConnection().catch(console.error);

