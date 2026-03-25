import { useEffect, useState } from 'react';
import { NotebookPen, RotateCcw, Save } from 'lucide-react';

const NOTES_TITLE_KEY = 'kareh_notes_title';
const NOTES_BODY_KEY = 'kareh_notes_body';
const NOTES_SAVED_AT_KEY = 'kareh_notes_saved_at';

const readStoredValue = (key, fallback = '') => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};

const formatSavedAt = (value) => {
  if (!value) return 'Todavía no guardaste notas.';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Todavía no guardaste notas.';
  return `Guardado automático: ${date.toLocaleString('es-AR')}`;
};

export default function NotesPage() {
  const [title, setTitle] = useState(() => readStoredValue(NOTES_TITLE_KEY, 'Notas internas'));
  const [body, setBody] = useState(() => readStoredValue(NOTES_BODY_KEY, ''));
  const [savedAt, setSavedAt] = useState(() => readStoredValue(NOTES_SAVED_AT_KEY, ''));

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        localStorage.setItem(NOTES_TITLE_KEY, title);
        localStorage.setItem(NOTES_BODY_KEY, body);
        const nextSavedAt = new Date().toISOString();
        localStorage.setItem(NOTES_SAVED_AT_KEY, nextSavedAt);
        setSavedAt(nextSavedAt);
      } catch {
        // Silencioso: si falla storage, la UI sigue utilizable.
      }
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [title, body]);

  const handleReset = () => {
    setTitle('Notas internas');
    setBody('');
  };

  return (
    <div className="flex-1 overflow-auto bg-[radial-gradient(circle_at_top,_rgba(13,148,136,0.14),_transparent_40%),linear-gradient(180deg,#fffdf7_0%,#f8fafc_100%)] px-4 py-4 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[2rem] border border-[#eadfcb] bg-[#fff7e9] p-5 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.35)] sm:p-8">
            <div className="inline-flex items-center gap-3 rounded-full bg-white px-4 py-2 text-[#8a5a00] shadow-sm">
              <NotebookPen size={18} />
              <span className="text-xs font-black uppercase tracking-[0.24em]">Block de notas</span>
            </div>

            <h1 className="mt-6 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Espacio rápido para ideas, pendientes y recordatorios.</h1>
            <p className="mt-4 max-w-md text-sm font-semibold leading-6 text-slate-600">
              Este tablero queda guardado en el navegador de la clínica. Sirve para dejar recordatorios internos, mensajes de seguimiento o tareas cortas del día.
            </p>

            <div className="mt-8 space-y-4 rounded-[1.75rem] bg-white/80 p-5 shadow-sm">
              <div className="flex items-center gap-3 text-slate-700">
                <Save size={16} className="text-teal-600" />
                <p className="text-sm font-bold">{formatSavedAt(savedAt)}</p>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
              >
                <RotateCcw size={14} />
                Limpiar hoja
              </button>
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.35)] sm:p-6">
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Título de la nota"
              className="w-full border-b border-slate-200 pb-4 text-2xl font-black tracking-tight text-slate-900 outline-none placeholder:text-slate-300 sm:text-3xl"
            />

            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={`Escribe aquí...\n\n- Llamar a pacientes pendientes\n- Confirmar cobertura\n- Recordar pedido de credenciales`}
              className="mt-6 min-h-[52vh] w-full resize-none rounded-[1.75rem] border border-[#efe4d2] bg-[#fffdf8] p-4 font-medium leading-7 text-slate-700 outline-none placeholder:text-slate-300 focus:border-teal-300 sm:min-h-[60vh] sm:p-6"
            />
          </section>
        </div>
      </div>
    </div>
  );
}
