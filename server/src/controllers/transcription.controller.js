import { GoogleGenerativeAI } from '@google/generative-ai';
import { AppError } from '../errors/AppError.js';

const buildPrompt = () => `
Eres un asistente experto en transcripcion de documentos medicos y farmaceuticos.
Tu tarea es recibir imagenes de recetas o indicaciones medicas manuscritas y convertirlas en datos estructurados.

INSTRUCCIONES CRITICAS:
1. Analiza el texto manuscrito con extrema precaucion.
2. Si un termino es ilegible, coloca "NO_IDENTIFICADO".
3. Usa conocimiento medico para corregir errores ortograficos menores o completar nombres de farmacos conocidos.
4. Devuelve la informacion unicamente en formato JSON valido.

ESTRUCTURA DEL JSON:
{
  "paciente": { "nombre": "...", "fecha_receta": "..." },
  "medicamentos": [
    {
      "nombre": "Nombre del farmaco",
      "presentacion": "Comprimidos, Jarabe, etc",
      "concentracion": "500mg",
      "dosis": "1 cada 8 horas",
      "duracion": "7 dias"
    }
  ],
  "indicaciones_adicionales": "Otras notas del medico",
  "diagnostico_sugerido": "Si figura en la nota",
  "confianza_transcripcion": "valor del 1 al 100"
}

No incluyas explicaciones ni texto fuera del bloque JSON.
`;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash-002';

const callGemini = async (imageBuffer, mimeType) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new AppError('Gemini API Key no configurada en el servidor.', 500);
  }

  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  const prompt = buildPrompt();
  const imagePart = {
    inlineData: {
      data: imageBuffer.toString('base64'),
      mimeType
    }
  };

  const result = await model.generateContent([prompt, imagePart]);
  const text = result.response.text().replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error('No se pudo parsear el JSON devuelto por Gemini:', text);
    throw new AppError('La respuesta de la IA no es un JSON valido.', 502);
  }
};

export const processMedicalRecipe = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No se ha subido ninguna imagen.' });
  }

  try {
    const transcription = await callGemini(req.file.buffer, req.file.mimetype);
    return res.status(200).json(transcription);
  } catch (error) {
    // Log detalle y devuelvo mensaje legible
    console.error(`Error procesando transcripcion (modelo ${GEMINI_MODEL}):`, error);
    const status = error?.statusCode || 500;
    const message = error?.message || 'Error interno al procesar la transcripcion.';
    return res.status(status).json({ message });
  }
};
