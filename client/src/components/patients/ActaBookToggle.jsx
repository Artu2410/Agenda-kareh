import React, { useState } from 'react';
import { BookCheck } from 'lucide-react';
import api from '../../services/api';
import { showErrorToast } from '../toastHelpers';

/**
 * Casilla "pasado al libro de actas" con folio opcional.
 * `onChange` recibe { actaBookRecordedAt, actaBookFolio } ya guardados.
 * Solo importa si está pasado o no; la fecha queda guardada pero no se muestra.
 * `onRequestUnmark(confirm)` permite pedir confirmación antes de desmarcar.
 */
export default function ActaBookToggle({ patient, onChange, onRequestUnmark, compact = false }) {
  const [saving, setSaving] = useState(false);
  const [folio, setFolio] = useState(patient.actaBookFolio || '');
  const recorded = Boolean(patient.actaBookRecordedAt);

  const save = async (nextRecorded, nextFolio) => {
    setSaving(true);
    try {
      const { data } = await api.patch(`/patients/${patient.id}/acta-book`, {
        recorded: nextRecorded,
        folio: nextRecorded ? (nextFolio.trim() || null) : null,
      });
      setFolio(data.actaBookFolio || '');
      onChange?.({ actaBookRecordedAt: data.actaBookRecordedAt, actaBookFolio: data.actaBookFolio });
    } catch (error) {
      setFolio(patient.actaBookFolio || '');
      showErrorToast(error?.friendlyMessage || 'No se pudo actualizar el libro de actas.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = () => {
    if (saving) return;
    if (!recorded) {
      void save(true, folio);
      return;
    }
    const unmark = () => save(false, '');
    if (onRequestUnmark) onRequestUnmark(unmark);
    else void unmark();
  };

  const handleFolioCommit = () => {
    if (!recorded || saving) return;
    if (folio.trim() === (patient.actaBookFolio || '')) return;
    void save(true, folio);
  };

  return (
    <div className={`flex ${compact ? 'flex-row flex-wrap items-center' : 'flex-col'} gap-1.5`}>
      <label className={`inline-flex cursor-pointer items-center gap-2 text-xs font-black uppercase ${recorded ? 'text-emerald-700' : 'text-slate-500'}`}>
        <input
          type="checkbox"
          className="h-4 w-4 accent-emerald-600"
          checked={recorded}
          disabled={saving}
          onChange={handleToggle}
          aria-label={`Pasado al libro de actas: ${patient.fullName}`}
        />
        {recorded ? <><BookCheck size={14} /> En libro</> : 'Pendiente'}
      </label>
      {recorded && (
        <input
          type="text"
          value={folio}
          maxLength={40}
          disabled={saving}
          placeholder="Folio"
          onChange={(event) => setFolio(event.target.value)}
          onBlur={handleFolioCommit}
          onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
          className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-400"
          aria-label={`Folio del libro de actas: ${patient.fullName}`}
        />
      )}
    </div>
  );
}
