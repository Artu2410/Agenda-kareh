import React from 'react';
import {
  Camera,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';

const DEFAULT_ACCEPT = '.jpg,.jpeg,.png,.webp,.gif,.pdf';

const isImageUrl = (url = '') => /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(url);

const ActionLabel = ({ children, disabled = false, tone = 'primary' }) => {
  const toneClass = disabled
    ? 'cursor-not-allowed bg-slate-200 text-slate-500'
    : tone === 'ghost'
      ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      : tone === 'success'
        ? 'border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50'
        : 'bg-teal-600 text-white hover:bg-teal-700';

  return (
    <span className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition ${toneClass}`}>
      {children}
    </span>
  );
};

const DocumentUploadField = ({
  label,
  field,
  value,
  onUpload,
  onRemove,
  uploading = false,
  disabled = false,
  helperText = 'Adjunta una imagen o PDF. También puedes tomar foto con la cámara.',
  accept = DEFAULT_ACCEPT,
}) => (
  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{label}</p>
          <p className="mt-1 text-sm font-bold text-slate-700">
            {value ? 'Archivo disponible' : 'Todavía no hay archivo cargado'}
          </p>
          <p className="mt-2 text-[11px] font-semibold text-slate-400">{helperText}</p>
        </div>

        <div className="flex flex-wrap gap-2 lg:max-w-[18rem] lg:justify-end">
          <label className={disabled ? 'cursor-not-allowed' : 'cursor-pointer'}>
            <ActionLabel disabled={disabled || uploading}>
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? 'Subiendo...' : 'Adjuntar'}
            </ActionLabel>
            <input
              type="file"
              accept={accept}
              disabled={disabled || uploading}
              className="hidden"
              onChange={(event) => onUpload?.(field, event)}
            />
          </label>

          <label className={disabled ? 'cursor-not-allowed' : 'cursor-pointer'}>
            <ActionLabel disabled={disabled || uploading} tone="success">
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
              {uploading ? 'Subiendo...' : 'Cámara'}
            </ActionLabel>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              disabled={disabled || uploading}
              className="hidden"
              onChange={(event) => onUpload?.(field, event)}
            />
          </label>

          {value && (
            <>
              <a href={value} target="_blank" rel="noreferrer">
                <ActionLabel tone="ghost">
                  <ExternalLink size={14} />
                  Abrir
                </ActionLabel>
              </a>
              <a href={value} target="_blank" rel="noreferrer" download>
                <ActionLabel tone="ghost">
                  <Download size={14} />
                  Descargar
                </ActionLabel>
              </a>
              <button
                type="button"
                onClick={() => onRemove?.(field)}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-black text-rose-600 transition hover:bg-rose-50"
              >
                <Trash2 size={14} />
                Quitar
              </button>
            </>
          )}
        </div>
      </div>

      {value && (
        isImageUrl(value) ? (
          <img
            src={value}
            alt={label}
            className="h-44 w-full rounded-3xl border border-slate-200 object-cover"
          />
        ) : (
          <div className="flex h-28 items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white">
            <div className="flex items-center gap-3 text-slate-500">
              <FileText size={22} />
              <span className="text-sm font-bold">Documento listo para abrir o descargar</span>
            </div>
          </div>
        )
      )}
    </div>
  </div>
);

export default DocumentUploadField;
