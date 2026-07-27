'use client';

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { ChevronDown, Loader2, MapPin, Search, Tags, Wand2, X } from 'lucide-react';

import type { Operacion } from '@/types/publication';
import { caracteristicas, tiposDePropiedad, zonas } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

import { AiSearchDialog } from '@/components/public/AiSearchDialog';
import { Button } from '@/components/ui/Button';

const MAX_TAGS = 4;
const SUGGESTION_LIMIT = 4;

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

  // Features tags
  const [featuresTags, setFeaturesTags] = useState<string[]>([]);
  const [featuresInput, setFeaturesInput] = useState('');
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [featuresHighlight, setFeaturesHighlight] = useState(0);

  // Property type dropdown
  const [tipoOpen, setTipoOpen] = useState(false);

  // Misc
  const [buscando, setBuscando] = useState(false);
  const [modalIa, setModalIa] = useState(false);

  const contenedor = useRef<HTMLDivElement>(null);
  const tipoTriggerRef = useRef<HTMLButtonElement>(null);
  const locationTriggerRef = useRef<HTMLDivElement>(null);
  const featuresTriggerRef = useRef<HTMLDivElement>(null);

  // Refs to portal dropdown DOM nodes so click-outside can ignore them
  const tipoDropdownRef = useRef<HTMLDivElement>(null);
  const locationDropdownRef = useRef<HTMLDivElement>(null);
  const featuresDropdownRef = useRef<HTMLDivElement>(null);

  // Portal dropdown positions (computed in effects to avoid reading refs during render)
  const [tipoDropdownStyle, setTipoDropdownStyle] = useState<React.CSSProperties>({});
  const [locationDropdownStyle, setLocationDropdownStyle] = useState<React.CSSProperties>({});
  const [featuresDropdownStyle, setFeaturesDropdownStyle] = useState<React.CSSProperties>({});

  // ── Open helpers (mutual exclusion: only one dropdown at a time) ────
  function openTipo() {
    setLocationOpen(false);
    setFeaturesOpen(false);
    setTipoOpen(true);
  }
  function toggleTipo() {
    if (tipoOpen) setTipoOpen(false);
    else openTipo();
  }

  function openLocation() {
    setTipoOpen(false);
    setFeaturesOpen(false);
    setLocationOpen(true);
  }
  function openFeatures() {
    setTipoOpen(false);
    setLocationOpen(false);
    setFeaturesOpen(true);
  }

  function closeAll() {
    setTipoOpen(false);
    setLocationOpen(false);
    setFeaturesOpen(false);
  }

  function calcStyle(ref: React.RefObject<HTMLElement | null>, minWidth = 256): React.CSSProperties {
    if (!ref.current) return { position: 'fixed', top: 0, left: 0, zIndex: 50, minWidth };
    const r = ref.current.getBoundingClientRect();
    return {
      position: 'fixed',
      top: r.bottom + 8,
      left: r.left,
      minWidth: Math.max(r.width, minWidth),
      zIndex: 50,
    };
  }

  // Recalculate portal positions whenever a dropdown opens
  useEffect(() => { if (tipoOpen) setTipoDropdownStyle(calcStyle(tipoTriggerRef)); }, [tipoOpen]);
  useEffect(() => { if (locationOpen) setLocationDropdownStyle(calcStyle(locationTriggerRef)); }, [locationOpen]);
  useEffect(() => { if (featuresOpen) setFeaturesDropdownStyle(calcStyle(featuresTriggerRef)); }, [featuresOpen]);

  // Close any open dropdown on scroll
  useEffect(() => {
    const onScroll = () => closeAll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Click outside ───────────────────────────────────────────────────
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
      const target = e.target as Element;
      // Ignore clicks inside the search bar or any portal dropdown
      if (contenedor.current?.contains(target)) return;
      if (target.closest('[role="listbox"]')) return;
      closeAll();
    };
    document.addEventListener('mousedown', alClickear);
    return () => document.removeEventListener('mousedown', alClickear);
  }, []);

  // ── Submit ──────────────────────────────────────────────────────────
  function buscar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    closeAll();
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
      openLocation();
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
      openFeatures();
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
              ref={tipoTriggerRef}
              type="button"
              onClick={toggleTipo}
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

            {tipoOpen &&
              createPortal(
                <div
                  ref={tipoDropdownRef}
                  role="listbox"
                  style={tipoDropdownStyle}
                  className="glass-panel rounded-2xl border border-border/70 p-1.5"
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
                </div>,
                document.body,
              )}
          </div>

          <span
            aria-hidden
            className="hidden h-8 w-px shrink-0 bg-border sm:block"
          />

          {/* ── Location tag + input block ────────────────────────────── */}
          <div ref={locationTriggerRef} className="relative min-w-0 flex-1">
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
                  openLocation();
                  setLocationHighlight(0);
                }}
                onFocus={() => openLocation()}
                onBlur={undefined}
                onKeyDown={handleLocationKeyDown}
                className={cn(
                  'h-full bg-transparent text-sm placeholder:text-muted-foreground focus-visible:outline-none',
                  locationTags.length === 0
                    ? 'w-full rounded-full pl-9 pr-3'
                    : 'min-w-[60px] flex-1 rounded-full pl-1 pr-3',
                )}
              />
            </div>

            {/* Location suggestions dropdown (portaled to escape glass-panel stacking context) */}
            {locationOpen &&
              createPortal(
                <div
                  ref={locationDropdownRef}
                  id="sugerencias-direccion"
                  role="listbox"
                  style={locationDropdownStyle}
                  className="glass-panel rounded-3xl border border-border/70 p-1.5"
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
                </div>,
                document.body,
              )}
          </div>

          <span
            aria-hidden
            className="hidden h-8 w-px shrink-0 bg-border sm:block"
          />

          {/* ── Features tag + input block ─────────────────────────────── */}
          <div ref={featuresTriggerRef} className="relative min-w-0 flex-1">
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
                  openFeatures();
                  setFeaturesHighlight(0);
                }}
                onFocus={() => openFeatures()}
                onBlur={undefined}
                onKeyDown={handleFeaturesKeyDown}
                className={cn(
                  'h-full bg-transparent text-sm placeholder:text-muted-foreground focus-visible:outline-none',
                  featuresTags.length === 0
                    ? 'w-full rounded-full pl-9 pr-3'
                    : 'min-w-[60px] flex-1 rounded-full pl-1 pr-3',
                )}
              />
            </div>

            {/* Features suggestions dropdown (portaled to escape glass-panel stacking context) */}
            {featuresOpen &&
              createPortal(
                <div
                  ref={featuresDropdownRef}
                  id="sugerencias-caracteristica"
                  role="listbox"
                  style={featuresDropdownStyle}
                  className="glass-panel rounded-3xl border border-border/70 p-1.5"
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
                </div>,
                document.body,
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
