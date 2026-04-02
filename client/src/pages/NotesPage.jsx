import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NotebookPen, Plus, RefreshCcw, RotateCcw, Save, Trash2 } from 'lucide-react';
import api from '../services/api';
import { useConfirmModal } from '../components/ConfirmModal';

const NOTES_STORAGE_KEY = 'kareh_notes_collection_v2';
const NOTES_SELECTED_KEY = 'kareh_notes_selected_v2';
const LEGACY_NOTES_TITLE_KEY = 'kareh_notes_title';
const LEGACY_NOTES_BODY_KEY = 'kareh_notes_body';
const LEGACY_NOTES_SAVED_AT_KEY = 'kareh_notes_saved_at';

const readStoredValue = (key, fallback = '') => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};

const isValidDate = (value) => {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const formatSavedAt = (value, fallback = 'Todavía no actualizaste esta nota.') => {
  if (!isValidDate(value)) return fallback;
  return new Date(value).toLocaleString('es-AR');
};

const createNoteId = () => (
  globalThis.crypto?.randomUUID?.() || `note-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
);

const createNote = (overrides = {}) => ({
  id: createNoteId(),
  title: 'Nueva nota',
  body: '',
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const getNotePreview = (value) => {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  return normalized || 'Sin contenido todavía.';
};

const normalizeNote = (note) => ({
  id: String(note?.id || createNoteId()),
  title: String(note?.title || '').trim() || 'Nota sin titulo',
  body: String(note?.body || ''),
  updatedAt: isValidDate(note?.updatedAt) ? note.updatedAt : new Date().toISOString(),
});

const serializeNotesSnapshot = (notes) => JSON.stringify(
  notes.map((note) => ({
    id: note.id,
    title: note.title,
    body: note.body,
    updatedAt: note.updatedAt,
  })),
);

const persistNotesLocally = (notes, selectedNoteId) => {
  try {
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
    localStorage.setItem(NOTES_SELECTED_KEY, selectedNoteId || '');
    localStorage.removeItem(LEGACY_NOTES_TITLE_KEY);
    localStorage.removeItem(LEGACY_NOTES_BODY_KEY);
    localStorage.removeItem(LEGACY_NOTES_SAVED_AT_KEY);
  } catch {
    // Mantener la UI operativa aunque falle el cache local.
  }
};

const getInitialNotesState = () => {
  try {
    const rawNotes = localStorage.getItem(NOTES_STORAGE_KEY);
    const storedSelectedId = localStorage.getItem(NOTES_SELECTED_KEY) || '';

    if (rawNotes) {
      const parsed = JSON.parse(rawNotes);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const normalizedNotes = parsed.map(normalizeNote);
        const selectedNoteId = normalizedNotes.some((note) => note.id === storedSelectedId)
          ? storedSelectedId
          : normalizedNotes[0].id;
        return { notes: normalizedNotes, selectedNoteId };
      }
    }
  } catch {
    // Si falla la lectura, se arma un estado limpio.
  }

  const legacyTitle = readStoredValue(LEGACY_NOTES_TITLE_KEY, '').trim();
  const legacyBody = readStoredValue(LEGACY_NOTES_BODY_KEY, '');
  const legacySavedAt = readStoredValue(LEGACY_NOTES_SAVED_AT_KEY, '');

  if (legacyTitle || legacyBody) {
    const migratedNote = createNote({
      title: legacyTitle || 'Notas internas',
      body: legacyBody,
      updatedAt: isValidDate(legacySavedAt) ? legacySavedAt : new Date().toISOString(),
    });
    return { notes: [migratedNote], selectedNoteId: migratedNote.id };
  }

  const firstNote = createNote({ title: 'Notas internas' });
  return { notes: [firstNote], selectedNoteId: firstNote.id };
};

const mapServerNotes = (payload) => (
  Array.isArray(payload) && payload.length > 0
    ? payload.map(normalizeNote)
    : []
);

export default function NotesPage() {
  const initialState = useMemo(() => getInitialNotesState(), []);
  const { ConfirmModalComponent, openModal: openConfirmModal } = useConfirmModal();
  const [notes, setNotes] = useState(initialState.notes);
  const [selectedNoteId, setSelectedNoteId] = useState(initialState.selectedNoteId);
  const [isRemoteReady, setIsRemoteReady] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('Sincronizando con la clínica...');
  const lastSyncedSnapshotRef = useRef('');
  const lastLocalEditAtRef = useRef(0);

  const selectedNote = notes.find((note) => note.id === selectedNoteId) || notes[0] || null;
  const selectedNoteSafeId = selectedNote?.id || '';

  useEffect(() => {
    if (!selectedNote && notes[0]) {
      setSelectedNoteId(notes[0].id);
    }
  }, [notes, selectedNote]);

  useEffect(() => {
    persistNotesLocally(notes, selectedNoteSafeId);
  }, [notes, selectedNoteSafeId]);

  const applyRemoteNotes = useCallback((remoteNotes) => {
    const normalizedNotes = remoteNotes.length > 0 ? remoteNotes : [createNote({ title: 'Notas internas' })];

    lastSyncedSnapshotRef.current = serializeNotesSnapshot(normalizedNotes);
    setNotes(normalizedNotes);
    setSelectedNoteId((currentSelectedId) => {
      const nextSelectedId = normalizedNotes.some((note) => note.id === currentSelectedId)
        ? currentSelectedId
        : normalizedNotes[0].id;
      persistNotesLocally(normalizedNotes, nextSelectedId);
      return nextSelectedId;
    });
  }, []);

  const syncNotesToServer = useCallback(async (nextNotes, { showRefreshing = false } = {}) => {
    if (showRefreshing) {
      setIsRefreshing(true);
    } else {
      setIsSyncing(true);
    }

    try {
      const payload = {
        notes: nextNotes.map((note, index) => ({
          ...normalizeNote(note),
          sortOrder: index,
        })),
      };

      const response = await api.put('/notes/sync', payload);
      const syncedNotes = mapServerNotes(response.data);
      applyRemoteNotes(syncedNotes);
      setSyncStatus('Sincronizado entre dispositivos');
      return syncedNotes;
    } finally {
      setIsSyncing(false);
      setIsRefreshing(false);
    }
  }, [applyRemoteNotes]);

  const refreshNotesFromServer = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setIsRefreshing(true);

    try {
      const response = await api.get('/notes');
      const remoteNotes = mapServerNotes(response.data);

      if (remoteNotes.length > 0) {
        applyRemoteNotes(remoteNotes);
        setSyncStatus('Sincronizado entre dispositivos');
        return remoteNotes;
      }

      const seededNotes = initialState.notes.length > 0 ? initialState.notes.map(normalizeNote) : [createNote({ title: 'Notas internas' })];
      await syncNotesToServer(seededNotes, { showRefreshing: false });
      return seededNotes;
    } catch (error) {
      console.error('Error syncing notes:', error);
      setSyncStatus('Trabajando con cache local');
      return initialState.notes;
    } finally {
      setIsRefreshing(false);
      setIsRemoteReady(true);
    }
  }, [applyRemoteNotes, initialState.notes, syncNotesToServer]);

  useEffect(() => {
    refreshNotesFromServer();
  }, [refreshNotesFromServer]);

  useEffect(() => {
    if (!isRemoteReady) return undefined;

    const snapshot = serializeNotesSnapshot(notes);
    if (snapshot === lastSyncedSnapshotRef.current) return undefined;

    lastLocalEditAtRef.current = Date.now();
    setSyncStatus('Guardando cambios...');

    const timeoutId = window.setTimeout(() => {
      syncNotesToServer(notes).catch((error) => {
        console.error('Error saving notes:', error);
        setSyncStatus('No se pudo sincronizar. Se mantiene la copia local.');
      });
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [isRemoteReady, notes, syncNotesToServer]);

  useEffect(() => {
    if (!isRemoteReady) return undefined;

    const refreshIfIdle = () => {
      if (Date.now() - lastLocalEditAtRef.current < 3000) return;
      refreshNotesFromServer({ silent: true }).catch(() => {
        // Mantener silencioso el polling.
      });
    };

    const intervalId = window.setInterval(refreshIfIdle, 15000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshIfIdle();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isRemoteReady, refreshNotesFromServer]);

  const handleCreateNote = () => {
    const newNote = createNote();
    setNotes((prev) => [newNote, ...prev]);
    setSelectedNoteId(newNote.id);
  };

  const handleUpdateSelectedNote = (field, value) => {
    if (!selectedNoteSafeId) return;
    const nextUpdatedAt = new Date().toISOString();

    setNotes((prev) => prev.map((note) => (
      note.id === selectedNoteSafeId
        ? { ...note, [field]: value, updatedAt: nextUpdatedAt }
        : note
    )));
  };

  const handleResetSelectedNote = () => {
    if (!selectedNoteSafeId) return;
    const nextUpdatedAt = new Date().toISOString();

    setNotes((prev) => prev.map((note) => (
      note.id === selectedNoteSafeId
        ? { ...note, title: 'Nota sin titulo', body: '', updatedAt: nextUpdatedAt }
        : note
    )));
  };

  const handleDeleteSelectedNote = () => {
    if (!selectedNote) return;

    openConfirmModal({
      title: 'Eliminar nota',
      message: 'Esta nota se eliminará para todos los dispositivos conectados. ¿Deseas continuar?',
      confirmText: 'Eliminar',
      danger: true,
      icon: Trash2,
      onConfirm: async () => {
        setNotes((prev) => {
          const remainingNotes = prev.filter((note) => note.id !== selectedNote.id);
          if (remainingNotes.length > 0) {
            setSelectedNoteId(remainingNotes[0].id);
            return remainingNotes;
          }

          const replacementNote = createNote({ title: 'Notas internas' });
          setSelectedNoteId(replacementNote.id);
          return [replacementNote];
        });
      },
    });
  };

  return (
    <div className="flex-1 overflow-auto bg-[radial-gradient(circle_at_top,_rgba(13,148,136,0.14),_transparent_40%),linear-gradient(180deg,#fffdf7_0%,#f8fafc_100%)] px-4 py-4 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <section className="rounded-[2rem] border border-[#eadfcb] bg-[#fff7e9] p-5 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.35)] sm:p-8">
            <div className="inline-flex items-center gap-3 rounded-full bg-white px-4 py-2 text-[#8a5a00] shadow-sm">
              <NotebookPen size={18} />
              <span className="text-xs font-black uppercase tracking-[0.24em]">Panel de notas</span>
            </div>

            <h1 className="mt-6 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              Varias notas internas, sincronizadas entre dispositivos.
            </h1>
            <p className="mt-4 max-w-lg text-sm font-semibold leading-6 text-slate-600">
              Cada nota mantiene su propio título, contenido y fecha de última actualización. La información queda
              guardada en la clínica y además se conserva como respaldo en este navegador.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-600">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-teal-700 shadow-sm">
                <Save size={13} />
                {syncStatus}
              </span>
              {(isSyncing || isRefreshing) && (
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-white">
                  <RefreshCcw size={13} className="animate-spin" />
                  Actualizando
                </span>
              )}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleCreateNote}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-teal-700"
              >
                <Plus size={14} />
                Nueva nota
              </button>
              <button
                type="button"
                onClick={handleResetSelectedNote}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
              >
                <RotateCcw size={14} />
                Limpiar actual
              </button>
              <button
                type="button"
                onClick={() => refreshNotesFromServer()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
              >
                <RefreshCcw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                Recargar
              </button>
              <button
                type="button"
                onClick={handleDeleteSelectedNote}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-red-600 transition hover:border-red-300 hover:bg-red-100"
              >
                <Trash2 size={14} />
                Eliminar nota
              </button>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.5rem] bg-white/80 p-5 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Notas guardadas</p>
                <p className="mt-2 text-3xl font-black text-slate-900">{notes.length}</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">Se ven igual en cualquier dispositivo logueado.</p>
              </div>

              <div className="rounded-[1.5rem] bg-white/80 p-5 shadow-sm">
                <div className="flex items-center gap-3 text-slate-700">
                  <Save size={16} className="text-teal-600" />
                  <p className="text-sm font-bold">Última actualización</p>
                </div>
                <p className="mt-3 text-lg font-black text-slate-900">
                  {selectedNote ? formatSavedAt(selectedNote.updatedAt) : 'Sin nota seleccionada'}
                </p>
              </div>
            </div>

            <div className="mt-8 space-y-3 rounded-[1.75rem] bg-white/70 p-4 shadow-sm">
              {notes.map((note) => {
                const isActive = note.id === selectedNoteSafeId;

                return (
                  <button
                    type="button"
                    key={note.id}
                    onClick={() => setSelectedNoteId(note.id)}
                    className={`w-full rounded-[1.4rem] border px-4 py-4 text-left transition ${
                      isActive
                        ? 'border-teal-300 bg-teal-50 shadow-[0_16px_30px_-24px_rgba(13,148,136,0.5)]'
                        : 'border-transparent bg-white hover:border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-black text-slate-900">{note.title || 'Nota sin titulo'}</p>
                        <p className="mt-1 line-clamp-2 text-sm font-medium leading-6 text-slate-500">
                          {getNotePreview(note.body)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                        {isActive ? 'Activa' : 'Nota'}
                      </span>
                    </div>
                    <p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                      Actualizada: {formatSavedAt(note.updatedAt, 'Sin fecha')}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.35)] sm:p-6">
            {selectedNote ? (
              <>
                <div className="flex flex-col gap-4 border-b border-slate-100 pb-5">
                  <input
                    type="text"
                    value={selectedNote.title}
                    onChange={(event) => handleUpdateSelectedNote('title', event.target.value)}
                    placeholder="Título de la nota"
                    className="w-full text-2xl font-black tracking-tight text-slate-900 outline-none placeholder:text-slate-300 sm:text-3xl"
                  />

                  <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-500">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                      Guardado automático
                    </span>
                    <span>Última actualización: {formatSavedAt(selectedNote.updatedAt, 'Sin fecha')}</span>
                  </div>
                </div>

                <textarea
                  value={selectedNote.body}
                  onChange={(event) => handleUpdateSelectedNote('body', event.target.value)}
                  placeholder={`Escribe aquí...\n\n- Llamar a pacientes pendientes\n- Confirmar cobertura\n- Recordar pedido de credenciales`}
                  className="mt-6 min-h-[52vh] w-full resize-none rounded-[1.75rem] border border-[#efe4d2] bg-[#fffdf8] p-4 font-medium leading-7 text-slate-700 outline-none placeholder:text-slate-300 focus:border-teal-300 sm:min-h-[60vh] sm:p-6"
                />
              </>
            ) : (
              <div className="flex min-h-[60vh] items-center justify-center rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50 text-center">
                <div className="max-w-sm px-6">
                  <p className="text-lg font-black text-slate-700">No hay una nota seleccionada.</p>
                  <p className="mt-2 text-sm font-medium text-slate-500">
                    Crea una nueva nota o elige una del listado de la izquierda.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
      {ConfirmModalComponent}
    </div>
  );
}
