'use client';

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ChevronDown, Loader2, MapPin, Search, Tags, Wand2, X } from 'lucide-react';

import type { Operacion } from '@/types/publication';
import { caracteristicas, tiposDePropiedad, zonas } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

import { AiSearchDialog } from '@/components/public/AiSearchDialog';
import { Button } from '@/components/ui/Button';

const MAX_TAGS = 4;
const SUGGESTION_LIMIT = 4;
const BLUR_DELAY_MS = 100;
const DROPDOWN_Z = 'z-50';

/**
 * `SearchPanel` — the home page's primary search widget with two independent
 * tag-based multi-select inputs (locations and characteristics).
 *
 * Layout (desktop, `sm:` up):
 *   `[tipo select] | [MapPin location tags+input] | divider
 *    | [Tags features tags+input] | [search button]`
 *
 * Mobile: the row stacks vertically, each input becomes full width and the
 * dividers are hidden.
 *
 * Tag behaviour (per input, max 4, case-insensitive dedupe):
 * - Press **Enter** to convert the current text into a tag.
 * - Click a suggestion to add it as a tag.
 * - Each tag shows an **X** button to remove it from the filter.
 * - Tags that don't fit inside the bar are clipped by `overflow-hidden`
 *   on the flex row; removing a visible tag lets a previously hidden tag
 *   come back into view (SRT-6). There is no `+N` counter (SRT-5).
 *
 * Why a Client Component?
 * - Owns local state for two input groups plus a click-outside listener and
 *   a mock-loading timer. None of that belongs on the server.
 *
 * Combobox semantics (SEARCH-4, SRT-8):
 * - Each input is `role="combobox"` with its own `aria-controls` pointing
 *   at a uniquely-id'd listbox (`sugerencias-direccion` /
 *   `sugerencias-caracteristica`). The listbox carries `role="listbox"`
 *   and each suggestion a `role="option"` with `aria-selected`.
 *   WAI-ARIA 1.2 pattern.
 *
 * Keyboard model (SEARCH-4):
 * - ArrowDown/ArrowUp wrap the suggestion list.
 * - Enter adds a tag (text or highlighted suggestion).
 * - Escape closes the dropdown or clears the input.
 * - IME composition (keyCode 229) is short-circuited.
 *
 * Button state (SEARCH-5, SRT-9..11):
 * - Idle (no tags and no input focused) → icon-only circular button.
 * - Active (any tag or any input focused) → icon + "Buscar" label.
 * - The wrapper is `shrink-0` and the label uses `max-w`/`opacity` so the
 *   button expansion never reflows the inputs.
 *
 * Loading state (SEARCH-5):
 * - On submit the button swaps its icon for a spinning `Loader2` for 1 s.
 *   No fetch happens — placeholder until the search endpoint is wired up.
 */
export function SearchPanel() {
  // ── State ────────────────────────────────────────────────────────────
  const [operacion, setOperacion] = useState<Operacion>('alquilar');
  const [tipo, setTipo] = useState('');

  // Location tags
  const [locationTags, setLocationTags] = useState<string[]>([]);
  const [locationInput, setLocationInput] = useState('');
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationHighlight, setLocationHighlight] = useState(0);
  const [locationFocused, setLocationFocused] = useState(false);

  // Features tags
  const [featuresTags, setFeaturesTags] = useState<string[]>([]);
  const [featuresInput, setFeaturesInput] = useState('');
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [featuresHighlight, setFeaturesHighlight] = useState(0);
  const [featuresFocused, setFeaturesFocused] = useState(false);

  // Property type dropdown
  const [tipoOpen, setTipoOpen] = useState(false);

  // Misc
  const [buscando, setBuscando] = useState(false);
  const [modalIa, setModalIa] = useState(false);

  const contenedor = useRef<HTMLDivElement>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Derived state ───────────────────────────────────────────────────
  const isActive =
    locationTags.length > 0 ||
    featuresTags.length > 0 ||
    locationFocused ||
    featuresFocused;

  // ── Suggestions (per input) ─────────────────────────────────────────
  const locationSuggestions = useMemo(() => {
    const q = locationInput.trim().toLowerCase();
    const tagSet = new Set(locationTags.map((t) => t.toLowerCase()));
    const base = q
      ? zonas.filter((z) => z.toLowerCase().includes(q) && !tagSet.has(z.toLowerCase()))
      : zonas.filter((z) => !tagSet.has(z.toLowerCase())).slice(0, SUGGESTION_LIMIT);
    return base.slice(0, SUGGESTION_LIMIT);
  }, [locationInput, locationTags]);

  const featuresSuggestions = useMemo(() => {
    const q = featuresInput.trim().toLowerCase();
    const tagSet = new Set(featuresTags.map((t) => t.toLowerCase()));
    const base = q
      ? caracteristicas.filter(
          (c) => c.toLowerCase().includes(q) && !tagSet.has(c.toLowerCase()),
        )
      : caracteristicas.filter((c) => !tagSet.has(c.toLowerCase())).slice(0, SUGGESTION_LIMIT);
    return base.slice(0, SUGGESTION_LIMIT);
  }, [featuresInput, featuresTags]);

  // ── Tag helpers (per input) ─────────────────────────────────────────
  const addLocationTag = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || locationTags.length >= MAX_TAGS) return;
      if (locationTags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) return;
      setLocationTags((prev) => [...prev, trimmed]);
      setLocationInput('');
      setLocationOpen(false);
      setLocationHighlight(0);
    },
    [locationTags],
  );

  const removeLocationTag = useCallback((index: number) => {
    setLocationTags((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addFeaturesTag = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || featuresTags.length >= MAX_TAGS) return;
      if (featuresTags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) return;
      setFeaturesTags((prev) => [...prev, trimmed]);
      setFeaturesInput('');
      setFeaturesOpen(false);
      setFeaturesHighlight(0);
    },
    [featuresTags],
  );

  const removeFeaturesTag = useCallback((index: number) => {
    setFeaturesTags((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const locationLimitReached = locationTags.length >= MAX_TAGS;
  const featuresLimitReached = featuresTags.length >= MAX_TAGS;

  // ── Click outside ───────────────────────────────────────────────────
  useEffect(() => {
    const alClickear = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) {
        setLocationOpen(false);
        setFeaturesOpen(false);
        setTipoOpen(false);
      }
    };
    document.addEventListener('mousedown', alClickear);
    return () => document.removeEventListener('mousedown', alClickear);
  }, []);

  // ── Cleanup pending blur timer on unmount ───────────────────────────
  useEffect(() => {
    return () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    };
  }, []);

  /**
   * Schedule a focus-out for a given input group. The 100 ms delay lets
   * `mousedown` on a suggestion (or a tag's X button) register BEFORE we
   * flip the focus state, so the search button doesn't briefly collapse
   * while the click is in flight (SRT-10).
   */
  function scheduleBlur(setter: (v: boolean) => void) {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    blurTimerRef.current = setTimeout(() => setter(false), BLUR_DELAY_MS);
  }

  function cancelPendingBlur() {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
  }

  // ── Submit ──────────────────────────────────────────────────────────
  function buscar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocationOpen(false);
    setFeaturesOpen(false);
    setBuscando(true);
    window.setTimeout(() => setBuscando(false), 1000);
  }

  // ── Keyboard handlers (per input) ───────────────────────────────────
  function handleLocationKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;

    if (e.key === 'Enter') {
      if (locationOpen && locationSuggestions[locationHighlight]) {
        e.preventDefault();
        addLocationTag(locationSuggestions[locationHighlight]);
        return;
      }
      if (locationInput.trim()) {
        e.preventDefault();
        addLocationTag(locationInput);
        return;
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setLocationOpen(true);
      setLocationHighlight((i) => (i + 1) % Math.max(locationSuggestions.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setLocationHighlight((i) =>
        i === 0 ? Math.max(locationSuggestions.length - 1, 0) : i - 1,
      );
    } else if (e.key === 'Escape') {
      if (locationOpen) {
        setLocationOpen(false);
      } else if (locationInput) {
        setLocationInput('');
        setLocationHighlight(0);
      }
    }
  }

  function handleFeaturesKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;

    if (e.key === 'Enter') {
      if (featuresOpen && featuresSuggestions[featuresHighlight]) {
        e.preventDefault();
        addFeaturesTag(featuresSuggestions[featuresHighlight]);
        return;
      }
      if (featuresInput.trim()) {
        e.preventDefault();
        addFeaturesTag(featuresInput);
        return;
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFeaturesOpen(true);
      setFeaturesHighlight((i) => (i + 1) % Math.max(featuresSuggestions.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFeaturesHighlight((i) =>
        i === 0 ? Math.max(featuresSuggestions.length - 1, 0) : i - 1,
      );
    } else if (e.key === 'Escape') {
      if (featuresOpen) {
        setFeaturesOpen(false);
      } else if (featuresInput) {
        setFeaturesInput('');
        setFeaturesHighlight(0);
      }
    }
  }

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
          {/* Property type combobox */}
          <div className="relative flex min-w-0 shrink-0 items-center sm:w-44">
            <button
              type="button"
              onClick={() => setTipoOpen((v) => !v)}
              className={cn(
                'flex w-full items-center gap-2 rounded-full bg-transparent py-3 pr-8 pl-3 text-sm sm:pl-1',
                tipo ? 'text-foreground' : 'text-muted-foreground',
                'focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none',
              )}
            >
              <span className="truncate">{tipo || '¿Qué buscás?'}</span>
              <ChevronDown
                aria-hidden
                className={cn(
                  'pointer-events-none absolute right-3 size-4 shrink-0 text-muted-foreground transition-transform sm:right-4',
                  tipoOpen && 'rotate-180',
                )}
              />
            </button>

            {tipoOpen && (
              <div
                role="listbox"
                className={cn(
                  'glass-panel absolute top-[calc(100%+0.5rem)] left-0 z-50 w-full min-w-44 rounded-2xl border border-border/70 p-1.5',
                  DROPDOWN_Z,
                )}
              >
                {tiposDePropiedad.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="option"
                    aria-selected={tipo === t}
                    onClick={() => {
                      setTipo(t);
                      setTipoOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                      tipo === t
                        ? 'bg-secondary text-secondary-foreground'
                        : 'text-muted-foreground hover:bg-secondary/50',
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          <span
            aria-hidden
            className="hidden h-8 w-px shrink-0 bg-border sm:block"
          />

          {/* ── Location tag + input block ────────────────────────────── */}
          <div className="relative min-w-0 flex-1">
            <div className="flex h-12 items-center gap-1.5 overflow-hidden">
              {locationTags.length === 0 && (
                <MapPin
                  aria-hidden
                  className="absolute left-3 top-1/2 z-10 size-4 shrink-0 -translate-y-1/2 text-muted-foreground"
                />
              )}

              {locationTags.map((tag, i) => (
                <span
                  key={`${tag}-${i}`}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary/80 px-2.5 py-1 text-xs font-medium text-secondary-foreground"
                >
                  <span className="max-w-[8ch] truncate">{tag}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeLocationTag(i);
                    }}
                    className="grid size-4 shrink-0 place-items-center rounded-full transition-colors hover:bg-foreground/10"
                    aria-label={`Quitar ${tag}`}
                  >
                    <X aria-hidden className="size-3" />
                  </button>
                </span>
              ))}

              <input
                type="text"
                value={locationInput}
                role="combobox"
                aria-expanded={locationOpen}
                aria-autocomplete="list"
                aria-controls="sugerencias-direccion"
                aria-label="Zona, barrio o dirección"
                placeholder={locationTags.length === 0 ? 'Zona, barrio o dirección' : ''}
                onChange={(e) => {
                  setLocationInput(e.target.value);
                  setLocationOpen(true);
                  setLocationHighlight(0);
                }}
                onFocus={() => {
                  cancelPendingBlur();
                  setLocationFocused(true);
                  setLocationOpen(true);
                }}
                onBlur={() => {
                  scheduleBlur(setLocationFocused);
                }}
                onKeyDown={handleLocationKeyDown}
                className={cn(
                  'h-full bg-transparent text-sm placeholder:text-muted-foreground focus-visible:outline-none',
                  locationTags.length === 0
                    ? 'w-full rounded-full pl-9 pr-3'
                    : 'min-w-[60px] flex-1 rounded-full pl-1 pr-3',
                )}
              />
            </div>

            {/* Location suggestions dropdown */}
            {locationOpen && (
              <div
                id="sugerencias-direccion"
                role="listbox"
                className={cn(
                  'glass-panel absolute top-[calc(100%+0.75rem)] left-0 w-full min-w-64 rounded-3xl border border-border/70 p-1.5',
                  DROPDOWN_Z,
                )}
              >
                {locationLimitReached ? (
                  <p className="px-3 py-3 text-sm text-muted-foreground">
                    Máximo 4 ubicaciones
                  </p>
                ) : locationSuggestions.length > 0 ? (
                  locationSuggestions.map((zona, i) => (
                    <button
                      key={zona}
                      type="button"
                      role="option"
                      aria-selected={i === locationHighlight}
                      onMouseEnter={() => setLocationHighlight(i)}
                      onClick={() => addLocationTag(zona)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-sm transition-colors',
                        i === locationHighlight
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
                    {locationInput.trim()
                      ? `No encontramos "${locationInput.trim()}". Presioná Enter para agregarlo como filtro.`
                      : 'Escribí para buscar zonas.'}
                  </p>
                )}
              </div>
            )}
          </div>

          <span
            aria-hidden
            className="hidden h-8 w-px shrink-0 bg-border sm:block"
          />

          {/* ── Features tag + input block ─────────────────────────────── */}
          <div className="relative min-w-0 flex-1">
            <div className="flex h-12 items-center gap-1.5 overflow-hidden">
              {featuresTags.length === 0 && (
                <Tags
                  aria-hidden
                  className="absolute left-3 top-1/2 z-10 size-4 shrink-0 -translate-y-1/2 text-muted-foreground"
                />
              )}

              {featuresTags.map((tag, i) => (
                <span
                  key={`${tag}-${i}`}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary/80 px-2.5 py-1 text-xs font-medium text-secondary-foreground"
                >
                  <span className="max-w-[8ch] truncate">{tag}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFeaturesTag(i);
                    }}
                    className="grid size-4 shrink-0 place-items-center rounded-full transition-colors hover:bg-foreground/10"
                    aria-label={`Quitar ${tag}`}
                  >
                    <X aria-hidden className="size-3" />
                  </button>
                </span>
              ))}

              <input
                type="text"
                value={featuresInput}
                role="combobox"
                aria-expanded={featuresOpen}
                aria-autocomplete="list"
                aria-controls="sugerencias-caracteristica"
                aria-label="Características del inmueble"
                placeholder={featuresTags.length === 0 ? 'Características' : ''}
                onChange={(e) => {
                  setFeaturesInput(e.target.value);
                  setFeaturesOpen(true);
                  setFeaturesHighlight(0);
                }}
                onFocus={() => {
                  cancelPendingBlur();
                  setFeaturesFocused(true);
                  setFeaturesOpen(true);
                }}
                onBlur={() => {
                  scheduleBlur(setFeaturesFocused);
                }}
                onKeyDown={handleFeaturesKeyDown}
                className={cn(
                  'h-full bg-transparent text-sm placeholder:text-muted-foreground focus-visible:outline-none',
                  featuresTags.length === 0
                    ? 'w-full rounded-full pl-9 pr-3'
                    : 'min-w-[60px] flex-1 rounded-full pl-1 pr-3',
                )}
              />
            </div>

            {/* Features suggestions dropdown */}
            {featuresOpen && (
              <div
                id="sugerencias-caracteristica"
                role="listbox"
                className={cn(
                  'glass-panel absolute top-[calc(100%+0.75rem)] left-0 w-full min-w-64 rounded-3xl border border-border/70 p-1.5',
                  DROPDOWN_Z,
                )}
              >
                {featuresLimitReached ? (
                  <p className="px-3 py-3 text-sm text-muted-foreground">
                    Máximo 4 características
                  </p>
                ) : featuresSuggestions.length > 0 ? (
                  featuresSuggestions.map((car, i) => (
                    <button
                      key={car}
                      type="button"
                      role="option"
                      aria-selected={i === featuresHighlight}
                      onMouseEnter={() => setFeaturesHighlight(i)}
                      onClick={() => addFeaturesTag(car)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-sm transition-colors',
                        i === featuresHighlight
                          ? 'bg-secondary text-secondary-foreground'
                          : 'text-muted-foreground',
                      )}
                    >
                      <Tags aria-hidden className="size-4 shrink-0" />
                      {car}
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-3 text-sm text-muted-foreground">
                    {featuresInput.trim()
                      ? `No encontramos "${featuresInput.trim()}". Presioná Enter para agregarlo como filtro.`
                      : 'Escribí para buscar características.'}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Search button — collapsible */}
          <Button
            type="submit"
            size={isActive ? 'lg' : 'icon-lg'}
            disabled={buscando}
            className={cn(
              'shrink-0 rounded-full transition-all duration-300',
              isActive
                ? 'h-12 px-6 shadow-[0_14px_30px_-16px_color-mix(in_oklch,var(--primary)_85%,transparent)]'
                : 'h-12',
            )}
          >
            {buscando ? <Loader2 className="animate-spin" /> : <Search />}
            <span
              className={cn(
                'overflow-hidden transition-all duration-300',
                isActive ? 'max-w-[100px] opacity-100 ml-0' : 'max-w-0 opacity-0 -ml-1',
              )}
            >
              Buscar
            </span>
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
