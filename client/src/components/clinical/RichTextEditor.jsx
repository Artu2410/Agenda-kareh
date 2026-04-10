import { useEffect, useRef, useState } from 'react';
import { Bold, Eraser, Highlighter, List, Underline } from 'lucide-react';
import {
  isClinicalRichTextEmpty,
  normalizeClinicalRichTextHtml,
  sanitizeClinicalRichTextHtml,
} from '@/utils/clinicalRichText';

const HIGHLIGHT_OPTIONS = [
  { label: 'Amarillo', color: '#fde68a' },
  { label: 'Celeste', color: '#bfdbfe' },
  { label: 'Rosa', color: '#fecdd3' },
];

const execEditorCommand = (command, value = null) => {
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') {
    return;
  }

  if (command === 'hiliteColor') {
    document.execCommand('styleWithCSS', false, true);
  }

  document.execCommand(command, false, value);
};

const ToolbarButton = ({ children, title, onClick, style = {}, swatch = null }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
    style={style}
  >
    <span className="flex items-center gap-2">
      {swatch && <span className="h-3 w-3 rounded-full border border-slate-300" style={{ backgroundColor: swatch }} />}
      {children}
    </span>
  </button>
);

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Escribe aquí...',
}) {
  const editorRef = useRef(null);
  const lastHtmlRef = useRef('');
  const [isFocused, setIsFocused] = useState(false);
  const normalizedValue = normalizeClinicalRichTextHtml(value);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    if (lastHtmlRef.current === normalizedValue) return;

    editor.innerHTML = normalizedValue;
    lastHtmlRef.current = normalizedValue;
  }, [normalizedValue]);

  const emitChange = () => {
    const editor = editorRef.current;
    if (!editor) return;

    const nextHtml = sanitizeClinicalRichTextHtml(editor.innerHTML);
    lastHtmlRef.current = nextHtml;
    onChange(nextHtml);
  };

  const focusEditor = () => {
    editorRef.current?.focus();
  };

  const handleCommand = (command, valueArg = null) => {
    focusEditor();
    execEditorCommand(command, valueArg);
    emitChange();
  };

  const handlePaste = (event) => {
    event.preventDefault();
    const pastedText = event.clipboardData?.getData('text/plain') || '';
    execEditorCommand('insertText', pastedText);
    emitChange();
  };

  return (
    <div className="rounded-[2rem] border border-[#efe4d2] bg-[#fffdf8] p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap gap-2">
        <ToolbarButton title="Negrita" onClick={() => handleCommand('bold')}>
          <Bold size={16} />
        </ToolbarButton>
        <ToolbarButton title="Subrayado" onClick={() => handleCommand('underline')}>
          <Underline size={16} />
        </ToolbarButton>
        <ToolbarButton title="Viñetas" onClick={() => handleCommand('insertUnorderedList')}>
          <List size={16} />
        </ToolbarButton>
        {HIGHLIGHT_OPTIONS.map((option) => (
          <ToolbarButton
            key={option.color}
            title={`Resaltar ${option.label.toLowerCase()}`}
            onClick={() => handleCommand('hiliteColor', option.color)}
            swatch={option.color}
          >
            <Highlighter size={16} />
          </ToolbarButton>
        ))}
        <ToolbarButton title="Quitar formato" onClick={() => handleCommand('removeFormat')}>
          <Eraser size={16} />
        </ToolbarButton>
      </div>

      <div className="relative">
        {!isFocused && isClinicalRichTextEmpty(normalizedValue) && (
          <div className="pointer-events-none absolute left-0 top-0 px-1 text-sm leading-8 text-slate-300">
            {placeholder}
          </div>
        )}

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={emitChange}
          onPaste={handlePaste}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            emitChange();
          }}
          className="min-h-[220px] w-full bg-transparent px-1 text-base leading-8 text-slate-700 outline-none [&_li]:mb-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6"
          style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
        />
      </div>
    </div>
  );
}
