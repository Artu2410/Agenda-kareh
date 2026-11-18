import { GoogleGenerativeAI } from '@google/generative-ai';

const SPELLCHECK_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash-002';

const SPELLCHECK_PROMPT = [
  'Sos un corrector ortográfico de informes kinésicos escritos en español rioplatense.',
  'Vas a recibir un objeto JSON cuyos valores son textos.',
  'Devolvé EXACTAMENTE el mismo objeto JSON, con las mismas claves, corrigiendo en cada valor solo:',
  '- ortografía, tildes y mayúsculas,',
  '- puntuación evidente.',
  'No cambies el sentido, no agregues ni quites información, no reformules ni resumas.',
  'Mantené siglas, abreviaturas médicas (EVA, TENS, MGT, EPOC, SpO2, etc.), números, nombres propios y el voseo tal cual.',
  'Si un texto no tiene errores, devolvelo idéntico.',
  'Respondé solo con el JSON, sin explicaciones.',
].join('\n');

/**
 * Corrige la ortografía de un objeto plano { clave: texto }.
 * Devuelve null si Gemini no está configurado.
 */
export const correctSpelling = async (texts, { client } = {}) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!client && !apiKey) return null;

  const entries = Object.entries(texts).filter(([, value]) => typeof value === 'string' && value.trim());
  if (entries.length === 0) return {};

  const genAI = client || new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: SPELLCHECK_MODEL,
    generationConfig: { responseMimeType: 'application/json', temperature: 0 },
  });

  const result = await model.generateContent([SPELLCHECK_PROMPT, JSON.stringify(Object.fromEntries(entries))]);
  const raw = String(result?.response?.text?.() || '').replace(/```(?:json)?/g, '').trim();
  const parsed = JSON.parse(raw);

  // Solo se aceptan las claves pedidas y valores de texto; lo demás queda como estaba.
  return Object.fromEntries(entries.map(([key, original]) => {
    const corrected = parsed?.[key];
    return [key, typeof corrected === 'string' && corrected.trim() ? corrected : original];
  }));
};
