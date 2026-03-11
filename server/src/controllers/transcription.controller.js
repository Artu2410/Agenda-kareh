import { GoogleGenerativeAI } from '@google/generative-ai';

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

export const processMedicalRecipe = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No se ha subido ninguna imagen.' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ message: 'Gemini API Key no configurada en el servidor.' });
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = buildPrompt();
    const imagePart = {
      inlineData: {
        data: req.file.buffer.toString('base64'),
        mimeType: req.file.mimetype
      }
    };

    const result = await model.generateContent([prompt, imagePart]);
    const text = result.response.text().replace(/```json|```/g, '').trim();

    try {
      const parsed = JSON.parse(text);
      return res.status(200).json(parsed);
    } catch (parseError) {
      console.error('No se pudo parsear el JSON devuelto por Gemini:', text);
      return res.status(500).json({ message: 'La respuesta de la IA no es un JSON valido.' });
    }
  } catch (error) {
    console.error('Error procesando transcripcion:', error);
    return res.status(500).json({ message: 'Error interno al procesar la transcripcion.' });
  }
};
