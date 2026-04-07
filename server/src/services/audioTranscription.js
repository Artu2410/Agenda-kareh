import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const AUDIO_TRANSCRIPTION_MODEL = process.env.GEMINI_AUDIO_MODEL || process.env.GEMINI_MODEL || 'gemini-1.5-flash-002';
const MAX_INLINE_AUDIO_BYTES = 18 * 1024 * 1024;

const AUDIO_TRANSCRIPTION_PROMPT = [
  'Transcribi este audio de WhatsApp a texto plano en español.',
  'Mantené nombres, obras sociales, horarios, direcciones, diagnósticos y números tal como se entiendan.',
  'No resumas.',
  'No agregues explicaciones.',
  'No uses comillas.',
  'Si el audio es inentendible o no contiene habla clara, respondé solo: NO_IDENTIFICADO',
].join('\n');

const sanitizeTranscription = (value) => String(value || '')
  .replace(/```/g, '')
  .replace(/\s+/g, ' ')
  .trim();

export const transcribeAudioBuffer = async ({ audioBuffer, mimeType }) => {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!audioBuffer?.length) return null;
  if (!String(mimeType || '').startsWith('audio/')) return null;
  if (audioBuffer.length > MAX_INLINE_AUDIO_BYTES) return null;

  const model = genAI.getGenerativeModel({ model: AUDIO_TRANSCRIPTION_MODEL });
  const result = await model.generateContent([
    AUDIO_TRANSCRIPTION_PROMPT,
    {
      inlineData: {
        data: audioBuffer.toString('base64'),
        mimeType,
      },
    },
  ]);

  const transcription = sanitizeTranscription(result?.response?.text?.() || '');
  if (!transcription || transcription.toUpperCase() === 'NO_IDENTIFICADO') {
    return null;
  }

  return transcription;
};
