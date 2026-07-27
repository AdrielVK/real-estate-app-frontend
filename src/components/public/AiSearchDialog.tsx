'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { ArrowRight, Loader2, Sparkles, Wand2, X } from 'lucide-react';

import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';

const ejemplos = [
  'Depto de 2 ambientes con balcón cerca del centro, hasta $450.000',
  'Casa con patio y espacio para dos autos en zona norte',
  'Algo luminoso para trabajar desde casa, que acepte mascotas',
  'Local a la calle con vidriera amplia en Güemes',
];

export interface AiSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * `AiSearchDialog` — AI-assisted search modal with example prompts
 * (DIALOG-IA-1..3).
 *
 * - Native `<dialog>` via our `Dialog` primitive.
 * - Textarea with Enter-to-submit, Shift+Enter for newline.
 * - Example chips that fill the textarea on click.
 * - Simulated loading state (1 s) with "results found" feedback.
 * - No real API call — placeholder until the AI endpoint is wired.
 */
export function AiSearchDialog({ open, onOpenChange }: AiSearchDialogProps) {
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState<'idle' | 'cargando' | 'listo'>('idle');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Focus and reset state when the dialog opens
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting form state on open is intentional
    setEstado('idle');
    setError(null);
    setTexto('');
    const id = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(id);
  }, [open]);

  const enviar = useCallback(
    (event?: React.FormEvent) => {
      event?.preventDefault();
      if (texto.trim().length < 6) {
        setError('Contanos un poco más sobre lo que estás buscando.');
        inputRef.current?.focus();
        return;
      }
      setError(null);
      setEstado('cargando');
      window.setTimeout(() => setEstado('listo'), 1100);
    },
    [texto],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div className="flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-primary">
            <Wand2 aria-hidden className="size-5" />
            <h2 className="text-lg font-semibold text-foreground">
              Buscar con IA
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Cerrar"
            className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none cursor-pointer"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          Describí la propiedad como se la contarías a un asesor. Nosotros
          traducimos eso en resultados.
        </p>

        <form onSubmit={enviar} className="grid gap-4">
          {/* Textarea */}
          <div className="rounded-3xl border border-border bg-background/70 p-1 transition-shadow focus-within:ring-3 focus-within:ring-ring/40">
            <textarea
              ref={inputRef}
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (
                  e.key === 'Enter' &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing &&
                  e.keyCode !== 229
                ) {
                  enviar();
                }
              }}
              rows={3}
              aria-label="Descripción de lo que buscás"
              aria-invalid={Boolean(error)}
              placeholder="Depto de 2 ambientes con balcón cerca del centro, hasta $450.000"
              className="w-full resize-none bg-transparent px-4 py-3 text-base leading-relaxed placeholder:text-muted-foreground/70 focus:outline-none sm:text-lg cursor-text"
            />
          </div>

          {error && (
            <p role="alert" className="-mt-2 text-sm text-destructive">
              {error}
            </p>
          )}

          {/* Example prompts */}
          <div className="grid gap-2">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">
              Probá con
            </p>
            <div className="flex flex-wrap gap-2">
              {ejemplos.map((ejemplo) => (
                <button
                  key={ejemplo}
                  type="button"
                  onClick={() => {
                    setTexto(ejemplo);
                    setError(null);
                    inputRef.current?.focus();
                  }}
                  className={cn(
                    'max-w-full rounded-full border border-border bg-card/60 px-3.5 py-2 text-left text-[0.8rem] text-muted-foreground transition-all',
                    'hover:-translate-y-px hover:border-primary/40 hover:text-foreground',
                    'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                    'cursor-pointer',
                  )}
                >
                  <span className="line-clamp-1">{ejemplo}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col-reverse items-stretch gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
            {estado === 'listo' ? (
              <p className="flex items-center gap-2 text-sm text-primary">
                <Sparkles aria-hidden className="size-4" />
                Encontramos 18 propiedades que coinciden con tu descripción.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Enter para buscar, Shift + Enter para agregar una línea.
              </p>
            )}
            <div className="flex items-center gap-2 sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="hidden rounded-full px-4 sm:inline-flex"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="lg"
                disabled={estado === 'cargando'}
                className="h-11 flex-1 rounded-full px-5 sm:flex-none"
              >
                {estado === 'cargando' ? (
                  <>
                    <Loader2 aria-hidden className="animate-spin" />
                    Buscando
                  </>
                ) : (
                  <>
                    Buscar
                    <ArrowRight aria-hidden className="size-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Dialog>
  );
}
