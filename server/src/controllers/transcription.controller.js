import { GoogleGenerativeAI } from "@google/generative-ai";
import AppError from "../errors/AppError.js";

const getSystemPrompt = () => `
Eres un asistente experto en transcripción de documentos médicos y farmacéuticos. 
Tu tarea es recibir imágenes de recetas o indicaciones médicas manuscritas y convertirlas en datos estructurados.

INSTRUCCIONES CRÍTICAS:
1. Analiza el texto manuscrito con extrema precaución. 
2. Si un término es totalmente ilegible, coloca "NO_IDENTIFICADO".
3. Utiliza tu conocimiento médico para corregir errores ortográficos menores o completar nombres de fármacos conocidos (ej. si lees "Atorvasta...", completa como "Atorvastatina").
4. Devuelve la información ÚNICAMENTE en formato JSON válido para que pueda ser procesada por un backend.

ESTRUCTURA DEL JSON:
{
  "paciente": { "nombre": "...", "fecha_receta": "..." },
  "medicamentos": [
    {
      "nombre": "Nombre del fármaco",
      "presentacion": "ej. Comprimidos, Jarabe",
      "concentracion": "ej. 500mg",
      "dosis": "ej. 1 cada 8 horas",
      "duracion": "ej. 7 días"
    }
  ],
  "indicaciones_adicionales": "Otras notas del médico",
  "diagnostico_sugerido": "Si figura en la nota",
  "confianza_transcripcion": "valor del 1 al 100"
}

No incluyas explicaciones, saludos ni texto fuera del bloque JSON.
`;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const procesarReceta = async (imageBuffer, mimeType) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new AppError('La API Key de Gemini no está configurada en el servidor.', 500);
  }
  
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = getSystemPrompt();

  const imagePart = {
    inlineData: {
      data: imageBuffer.toString("base64"),
      mimeType
    },
  };

  const result = await model.generateContent([prompt, imagePart]);
  const response = await result.response;
  
  const text = response.text().replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(text);
  } catch(e) {
    console.error("Failed to parse JSON from Gemini:", text);
    throw new AppError("La respuesta de la IA no es un JSON válido.", 500);
  }
}

export const processMedicalRecipe = async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('No se ha subido ninguna imagen.', 400));
  }

  try {
    const { buffer, mimetype } = req.file;
    const transcription = await procesarReceta(buffer, mimetype);
    res.status(200).json(transcription);
  } catch (error) {
    next(error);
  }
};
