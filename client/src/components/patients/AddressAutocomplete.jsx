import React, { useEffect, useId, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { MIN_ADDRESS_QUERY_LENGTH, searchAddressSuggestions } from '../../services/georef';

const SEARCH_DELAY_MS = 400;

/**
 * Domicilio con sugerencias de Georef: al elegir una, completa la dirección y la
 * localidad. Los dos campos se pueden escribir a mano igual (el servicio es una ayuda).
 * `onChange` recibe solo lo que cambió: { address }, { locality } o ambos.
 */
export default function AddressAutocomplete({
  address = '',
  locality = '',
  onChange,
  inputClassName,
  labelClassName,
  className = '',
}) {
  const listId = useId();
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [status, setStatus] = useState('idle'); // idle | loading | empty | error
  const [query, setQuery] = useState(null); // solo lo que tipeó la persona dispara búsquedas
  const inputRef = useRef(null);

  useEffect(() => {
    if (!query) return undefined;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const results = await searchAddressSuggestions(query, { signal: controller.signal });
        setSuggestions(results);
        setActiveIndex(results.length ? 0 : -1);
        setStatus(results.length ? 'idle' : 'empty');
      } catch (error) {
        if (error?.name === 'AbortError') return;
        setSuggestions([]);
        setStatus('error');
      }
    }, SEARCH_DELAY_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const selectSuggestion = (suggestion) => {
    onChange({
      address: suggestion.needsNumber ? `${suggestion.address} ` : suggestion.address,
      ...(suggestion.locality ? { locality: suggestion.locality } : {}),
    });
    setSuggestions([]);
    setOpen(false);
    setStatus('idle');
    setQuery(null);
    // Calle sin altura: queda el cursor para escribir el número (y vuelve a sugerir).
    if (suggestion.needsNumber) inputRef.current?.focus();
  };

  const handleKeyDown = (event) => {
    if (!open || !suggestions.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  const showList = open && suggestions.length > 0;
  const helper = {
    loading: 'Buscando direcciones…',
    empty: 'Sin sugerencias: podés escribir la dirección igual.',
    error: 'No se pudo consultar el servicio de direcciones. Escribila a mano.',
  }[status];

  return (
    <div className={`grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr] ${className}`}>
      <div className="relative space-y-1">
        <label htmlFor={`${listId}-address`} className={labelClassName}>Dirección</label>
        <div className="relative">
          <input
            ref={inputRef}
            id={`${listId}-address`}
            type="text"
            role="combobox"
            aria-label="Dirección"
            aria-autocomplete="list"
            aria-expanded={showList}
            aria-controls={`${listId}-list`}
            aria-activedescendant={showList && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
            autoComplete="off"
            placeholder="Calle y altura"
            className={inputClassName}
            value={address}
            onChange={(event) => {
              const { value } = event.target;
              onChange({ address: value });
              setOpen(true);
              if (value.trim().length < MIN_ADDRESS_QUERY_LENGTH) {
                setQuery(null);
                setSuggestions([]);
                setStatus('idle');
              } else {
                setQuery(value);
                setStatus('loading');
              }
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={handleKeyDown}
          />
          {status === 'loading' && (
            <Loader2 size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
          )}
        </div>
        {showList && (
          <ul
            id={`${listId}-list`}
            role="listbox"
            aria-label="Sugerencias de dirección"
            className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-xl"
          >
            {suggestions.map((suggestion, index) => (
              <li
                key={suggestion.label}
                id={`${listId}-option-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                // mousedown en vez de click: el input todavía no perdió el foco.
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectSuggestion(suggestion);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={`flex min-h-11 cursor-pointer items-start gap-2 rounded-xl px-3 py-2 ${index === activeIndex ? 'bg-teal-50' : ''}`}
              >
                <MapPin size={14} className="mt-0.5 shrink-0 text-teal-600" />
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-slate-700">
                    {suggestion.address}
                    {suggestion.needsNumber && <span className="ml-1 text-[10px] font-black uppercase text-slate-400">· falta altura</span>}
                  </span>
                  {suggestion.locality && (
                    <span className="block text-[11px] font-semibold text-slate-500">{suggestion.locality}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {helper && !showList && (
          <p role="status" className="ml-1 text-[10px] font-semibold text-slate-400">{helper}</p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor={`${listId}-locality`} className={labelClassName}>Localidad</label>
        <input
          id={`${listId}-locality`}
          type="text"
          aria-label="Localidad"
          autoComplete="address-level2"
          className={inputClassName}
          value={locality}
          onChange={(event) => onChange({ locality: event.target.value })}
        />
      </div>
    </div>
  );
}
