import { GoogleGenAI } from "@google/genai";
import { env } from "~/env";

// Usar la variable validada desde env.js
const key = env.GEMINI_API_KEY;

if (!key) {
  throw new Error("GEMINI_API_KEY no está configurada. Por favor, agrega la variable de entorno en tu archivo .env");
}

export const gemini = new GoogleGenAI({ apiKey: key });

// Modelo rápido y económico; si quieres mejor reasoning usa "gemini-2.0-flash-exp" o "gemini-1.5-pro"
export const modelName = "gemini-2.0-flash-exp";

//! MODELO MAS EFICAZ IMPORTANTE
//export const modelName = "gemini-2.5-pro"; // Modelo más lento pero mejor reasoning