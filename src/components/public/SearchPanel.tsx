'use client';

import { type FormEvent,useEffect, useMemo, useRef, useState } from 'react';

import {
  ChevronDown,
  Loader2,
  MapPin,
  Search,
  Wand2,
} from 'lucide-react';

import type { Operacion } from '@/types/publication';
import { tiposDePropiedad, zonas } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

import { AiSearchDialog } from '@/components/public/AiSearchDialog';
import { Button } from '@/components/ui/Button';

const sugerenciasIniciales = zonas.slice(0, 5);

/**
 * `SearchPanel` — the home page's primary search widget (SEARCH-1..8).
 *
 * Why a Client Component?
 * - Owns seven pieces of local state (operacion, tipo, consulta, three
 *   suggestion flags, buscando) plus a click-outside listener and a
 *   mock-loading timer. None of that belongs on the server.
 *
 * Composition:
 * - The `<form>` wraps the operation toggle + the search bar.
 * - The "Buscar con IA" button lives OUTSIDE the form so its click
 *   never accidentally submits it.
 *
 * Combobox semantics:
 * - The input is a `role="combobox"` with `aria-controls` pointing at
 *   the suggestion listbox. The listbox carries `role="listbox"` and
 *   each suggestion a `role="option"` with `aria-selected`. This is
 *   the WAI-ARIA 1.2 combobox pattern (SEARCH-4).
 *
 * Keyboard model (SEARCH-4):
 * - ArrowDown/ArrowUp wrap around the suggestion list.
 * - Enter selects the highlighted suggestion (no form submit).
 * - Escape closes the dropdown.
 * - The handler also short-circuits while the IME is composing
 *   (keyCode 229) so users typing in CJK keyboards don't jump the
 *   highlight mid-stroke.
 *
 * Loading state (SEARCH-5):
 * - On submit the button swaps its icon for a spinning `Loader2` for
 *   1 second. No fetch happens — this is a visual placeholder until
 *   the search endpoint is wired up (matches the AI dialog's "coming
 *   soon" treatment).
 */
export function SearchPanel() {
  const [operacion, setOperacion] = useState<Operacion>('alquilar');
  const [tipo, setTipo] = useState('');
  const [consulta, setConsulta] = useState('');
  const [sugerenciasAbiertas, setSugerenciasAbiertas] = useState(false);
  const [resaltado, setResaltado] = useState(0);
  const [buscando, setBuscando] = useState(false);
  const [modalIa, setModalIa] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  const sugerencias = useMemo(() => {
    const q = consulta.trim().toLowerCase();
    if (!q) return sugerenciasIniciales;
    return zonas.filter((z) => z.toLowerCase().includes(q)).slice(0, 6);
  }, [consulta]);

  useEffect(() => {
    const alClickear = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) {
        setSugerenciasAbiertas(false);
      }
    };
    document.addEventListener('mousedown', alClickear);
    return () => document.removeEventListener('mousedown', alClickear);
  }, []);

  function buscar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSugerenciasAbiertas(false);
    setBuscando(true);
    window.setTimeout(() => setBuscando(false), 1000);
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
      <form
        onSubmit={buscar}
        className="min-w-0 flex-1"
        aria-label="Búsqueda de propiedades"
      >
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

        <div
          ref={contenedor}
          className="glass-panel relative flex flex-col gap-1 rounded-[1.75rem] border border-border/70 p-2 sm:h-[4.5rem] sm:flex-row sm:items-center sm:rounded-full sm:pl-5"
        >
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

          <div className="relative min-w-0 flex-1">
            <MapPin
              aria-hidden
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              value={consulta}
              role="combobox"
              aria-expanded={sugerenciasAbiertas}
              aria-autocomplete="list"
              aria-controls="sugerencias-zona"
              aria-label="Zona, barrio o dirección"
              placeholder="Zona, barrio, dirección o característica"
              onChange={(e) => {
                setConsulta(e.target.value);
                setSugerenciasAbiertas(true);
                setResaltado(0);
              }}
              onFocus={() => setSugerenciasAbiertas(true)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing || e.keyCode === 229) return;
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
                  setSugerenciasAbiertas(false);
                } else if (
                  e.key === 'Enter' &&
                  sugerenciasAbiertas &&
                  sugerencias[resaltado]
                ) {
                  e.preventDefault();
                  setConsulta(sugerencias[resaltado]);
                  setSugerenciasAbiertas(false);
                }
              }}
              className="h-12 w-full rounded-full bg-transparent pr-3 pl-9 text-sm placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
            />

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
                      onClick={() => {
                        setConsulta(zona);
                        setSugerenciasAbiertas(false);
                      }}
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
                    No encontramos zonas con “{consulta.trim()}”. Probá con
                    otro barrio o usá la búsqueda con IA.
                  </p>
                )}
              </div>
            )}
          </div>

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
