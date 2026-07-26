'use client';

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ChevronDown, Loader2, MapPin, Search, Wand2, X } from 'lucide-react';

import type { Operacion } from '@/types/publication';
import { tiposDePropiedad, zonas } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

import { AiSearchDialog } from '@/components/public/AiSearchDialog';
import { Button } from '@/components/ui/Button';

const MAX_TAGS = 5;
const INPUT_RESERVE_PX = 80;
const TAG_GAP_PX = 6;
const sugerenciasIniciales = zonas.slice(0, 5);

/**
 * `SearchPanel` — the home page's primary search widget with a tag-based
 * multi-select input for locations and characteristics (SEARCH-1..8).
 *
 * Tag behaviour:
 * - Press **Enter** to convert the current text into a tag (max 5).
 * - Click a suggestion to add it as a tag.
 * - Each tag shows an **X** button to remove it from the filter.
 * - Tags that don't fit inside the bar are collapsed into a **+N** counter
 *   (measured via ResizeObserver).
 *
 * Why a Client Component?
 * - Owns nine pieces of local state plus a click-outside listener, a
 *   mock-loading timer, and a ResizeObserver for tag overflow. None of that
 *   belongs on the server.
 *
 * Combobox semantics (SEARCH-4):
 * - The input is `role="combobox"` with `aria-controls` pointing at the
 *   suggestion listbox. The listbox carries `role="listbox"` and each
 *   suggestion a `role="option"` with `aria-selected`. WAI-ARIA 1.2 pattern.
 *
 * Keyboard model (SEARCH-4):
 * - ArrowDown/ArrowUp wrap the suggestion list.
 * - Enter adds a tag (text or highlighted suggestion).
 * - Escape closes the dropdown or clears the input.
 * - IME composition (keyCode 229) is short-circuited.
 *
 * Loading state (SEARCH-5):
 * - On submit the button swaps its icon for a spinning `Loader2` for 1 s.
 *   No fetch happens — placeholder until the search endpoint is wired up.
 */
export function SearchPanel() {
  // ── State ────────────────────────────────────────────────────────────
  const [operacion, setOperacion] = useState<Operacion>('alquilar');
  const [tipo, setTipo] = useState('');
  const [inputText, setInputText] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [sugerenciasAbiertas, setSugerenciasAbiertas] = useState(false);
  const [resaltado, setResaltado] = useState(0);
  const [buscando, setBuscando] = useState(false);
  const [modalIa, setModalIa] = useState(false);
  const [visibleCount, setVisibleCount] = useState(MAX_TAGS);

  const contenedor = useRef<HTMLDivElement>(null);
  const tagsRowRef = useRef<HTMLDivElement>(null);
  const tagElementsRef = useRef<(HTMLSpanElement | null)[]>([]);

  // ── Suggestions ─────────────────────────────────────────────────────
  const sugerencias = useMemo(() => {
    const q = inputText.trim().toLowerCase();
    if (!q) return sugerenciasIniciales;
    const matches = zonas.filter((z) => z.toLowerCase().includes(q));
    // Exclude zones already present as tags
    const tagSet = new Set(tags.map((t) => t.toLowerCase()));
    return matches.filter((z) => !tagSet.has(z.toLowerCase())).slice(0, 6);
  }, [inputText, tags]);

  // ── Tag helpers ─────────────────────────────────────────────────────
  const addTag = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || tags.length >= MAX_TAGS) return;
      if (tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) return;
      setTags((prev) => [...prev, trimmed]);
      setInputText('');
      setSugerenciasAbiertas(false);
      setResaltado(0);
    },
    [tags],
  );

  const removeTag = useCallback((index: number) => {
    setTags((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ── Overflow measurement ────────────────────────────────────────────
  useEffect(() => {
    const row = tagsRowRef.current;
    if (!row) return;

    const observer = new ResizeObserver(() => {
      const availableWidth = row.clientWidth - INPUT_RESERVE_PX;
      let accumulated = 0;
      let count = 0;

      for (let i = 0; i < tags.length; i++) {
        const el = tagElementsRef.current[i];
        if (!el) break;
        const tagWidth = el.offsetWidth + TAG_GAP_PX;
        if (accumulated + tagWidth <= availableWidth) {
          accumulated += tagWidth;
          count++;
        } else {
          break;
        }
      }

      setVisibleCount(Math.max(0, count));
    });

    observer.observe(row);
    return () => observer.disconnect();
  }, [tags]);

  // Reset ref array when tags change so stale elements aren't measured
  useEffect(() => {
    tagElementsRef.current = tagElementsRef.current.slice(0, tags.length);
  }, [tags]);

  // ── Click outside ───────────────────────────────────────────────────
  useEffect(() => {
    const alClickear = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) {
        setSugerenciasAbiertas(false);
      }
    };
    document.addEventListener('mousedown', alClickear);
    return () => document.removeEventListener('mousedown', alClickear);
  }, []);

  // ── Submit ──────────────────────────────────────────────────────────
  function buscar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSugerenciasAbiertas(false);
    setBuscando(true);
    window.setTimeout(() => setBuscando(false), 1000);
  }

  // ── Keyboard ────────────────────────────────────────────────────────
  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;

    if (e.key === 'Enter') {
      // If a suggestion is highlighted, add it as a tag
      if (sugerenciasAbiertas && sugerencias[resaltado]) {
        e.preventDefault();
        addTag(sugerencias[resaltado]);
        return;
      }
      // Otherwise add the raw text as a tag
      if (inputText.trim()) {
        e.preventDefault();
        addTag(inputText);
        return;
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSugerenciasAbiertas(true);
      setResaltado((i) => (i + 1) % Math.max(sugerencias.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setResaltado((i) =>
        i === 0 ? Math.max(sugerencias.length - 1, 0) : i - 1,
      );
    } else if (e.key === 'Escape') {
      if (sugerenciasAbiertas) {
        setSugerenciasAbiertas(false);
      } else if (inputText) {
        setInputText('');
        setResaltado(0);
      }
    }
  }

  const hiddenCount = tags.length - visibleCount;

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
      <form
        onSubmit={buscar}
        className="min-w-0 flex-1"
        aria-label="Búsqueda de propiedades"
      >
        {/* ── Operation toggle ───────────────────────────────────────── */}
        <div
          role="radiogroup"
          aria-label="Tipo de operación"
          className="glass-panel mb-3 inline-flex rounded-full border border-border/70 p-1"
        >
          {(['alquilar', 'comprar'] as const).map((op) => (
            <button
              key={op}
              type="button"
              role="radio"
              aria-checked={operacion === op}
              onClick={() => setOperacion(op)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm capitalize transition-all duration-300 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                operacion === op
                  ? 'bg-primary text-primary-foreground shadow-[0_8px_20px_-12px_color-mix(in_oklch,var(--primary)_80%,transparent)]'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {op}
            </button>
          ))}
        </div>

        {/* ── Search bar ─────────────────────────────────────────────── */}
        <div
          ref={contenedor}
          className="glass-panel relative flex flex-col gap-1 rounded-[1.75rem] border border-border/70 p-2 sm:h-[4.5rem] sm:flex-row sm:items-center sm:rounded-full sm:pl-5"
        >
          {/* Property type select */}
          <label className="relative flex min-w-0 shrink-0 items-center sm:w-44">
            <span className="sr-only">¿Qué buscás?</span>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full appearance-none rounded-full bg-transparent py-3 pr-8 pl-3 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none sm:pl-1"
            >
              <option value="">¿Qué buscás?</option>
              {tiposDePropiedad.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden
              className="pointer-events-none absolute right-3 size-4 text-muted-foreground sm:right-4"
            />
          </label>

          <span
            aria-hidden
            className="hidden h-8 w-px shrink-0 bg-border sm:block"
          />

          {/* ── Tag + input zone ─────────────────────────────────────── */}
          <div className="relative min-w-0 flex-1">
            <div
              ref={tagsRowRef}
              className="flex h-12 items-center gap-1.5 overflow-hidden"
            >
              {/* MapPin icon — visible only when there are no tags */}
              {tags.length === 0 && (
                <MapPin
                  aria-hidden
                  className="absolute left-3 top-1/2 z-10 size-4 shrink-0 -translate-y-1/2 text-muted-foreground"
                />
              )}

              {/* Visible tags */}
              {tags.slice(0, visibleCount).map((tag, i) => (
                <span
                  key={`${tag}-${i}`}
                  ref={(el) => {
                    tagElementsRef.current[i] = el;
                  }}
                  data-tag-index={i}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary/80 px-2.5 py-1 text-xs font-medium text-secondary-foreground"
                >
                  <span className="max-w-[8ch] truncate">{tag}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTag(i);
                    }}
                    className="grid size-4 shrink-0 place-items-center rounded-full transition-colors hover:bg-foreground/10"
                    aria-label={`Quitar ${tag}`}
                  >
                    <X aria-hidden className="size-3" />
                  </button>
                </span>
              ))}

              {/* Hidden tags counter */}
              {hiddenCount > 0 && (
                <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  +{hiddenCount}
                </span>
              )}

              {/* Text input */}
              <input
                type="text"
                value={inputText}
                role="combobox"
                aria-expanded={sugerenciasAbiertas}
                aria-autocomplete="list"
                aria-controls="sugerencias-zona"
                aria-label="Zona, barrio o característica"
                placeholder={
                  tags.length === 0
                    ? 'Zona, barrio, dirección o característica'
                    : ''
                }
                onChange={(e) => {
                  setInputText(e.target.value);
                  setSugerenciasAbiertas(true);
                  setResaltado(0);
                }}
                onFocus={() => {
                  if (inputText || tags.length < MAX_TAGS) {
                    setSugerenciasAbiertas(true);
                  }
                }}
                onKeyDown={handleInputKeyDown}
                className={cn(
                  'h-full bg-transparent text-sm placeholder:text-muted-foreground focus-visible:outline-none',
                  tags.length === 0
                    ? 'w-full rounded-full pl-9 pr-3'
                    : 'min-w-[60px] flex-1 rounded-full pl-1 pr-3',
                )}
              />
            </div>

            {/* ── Suggestions dropdown ────────────────────────────────── */}
            {sugerenciasAbiertas && (
              <div
                id="sugerencias-zona"
                role="listbox"
                className="glass-panel absolute top-[calc(100%+0.75rem)] left-0 z-30 w-full min-w-64 rounded-3xl border border-border/70 p-1.5"
              >
                {sugerencias.length > 0 ? (
                  sugerencias.map((zona, i) => (
                    <button
                      key={zona}
                      type="button"
                      role="option"
                      aria-selected={i === resaltado}
                      onMouseEnter={() => setResaltado(i)}
                      onClick={() => addTag(zona)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-sm transition-colors',
                        i === resaltado
                          ? 'bg-secondary text-secondary-foreground'
                          : 'text-muted-foreground',
                      )}
                    >
                      <MapPin aria-hidden className="size-4 shrink-0" />
                      {zona}
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-3 text-sm text-muted-foreground">
                    {inputText.trim()
                      ? `No encontramos "${inputText.trim()}". Presioná Enter para agregarlo como filtro.`
                      : 'Escribí para buscar zonas o características.'}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Search button */}
          <Button
            type="submit"
            size="lg"
            disabled={buscando}
            className="h-12 shrink-0 rounded-full px-6 shadow-[0_14px_30px_-16px_color-mix(in_oklch,var(--primary)_85%,transparent)]"
          >
            {buscando ? <Loader2 className="animate-spin" /> : <Search />}
            Buscar
          </Button>
        </div>
      </form>

      {/* ── AI search button ──────────────────────────────────────────── */}
      <div className="relative shrink-0 lg:self-end">
        <div
          aria-hidden
          className="absolute -inset-px rounded-[1.75rem] bg-gradient-to-br from-primary via-primary/50 to-copper opacity-70 blur-[6px] transition-opacity duration-500 group-hover:opacity-100 sm:rounded-full"
        />
        <button
          type="button"
          onClick={() => setModalIa(true)}
          className="group relative flex w-full items-center justify-start gap-3 rounded-[1.75rem] border border-primary/25 bg-card/85 px-6 text-left backdrop-blur-xl transition-transform duration-300 hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:translate-y-0 sm:h-[4.5rem] sm:rounded-full lg:w-auto"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-copper text-primary-foreground">
            <Wand2 aria-hidden className="size-5" />
          </span>
          <span className="grid py-3 sm:py-0">
            <span className="text-sm font-medium">Buscar con IA</span>
            <span className="text-xs text-muted-foreground">
              Describilo en tus palabras
            </span>
          </span>
        </button>
      </div>

      <AiSearchDialog open={modalIa} onOpenChange={setModalIa} />
    </div>
  );
}
