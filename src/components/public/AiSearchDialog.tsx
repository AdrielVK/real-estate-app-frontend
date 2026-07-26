'use client';

import { Sparkles, X } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';

export interface AiSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * `AiSearchDialog` — placeholder modal for the AI-assisted search
 * (DIALOG-IA-1..3).
 *
 * Scope (this PR):
 * - Native `<dialog>` via our `Dialog` primitive.
 * - Heading, helper copy, textarea, Cancel/Search buttons.
 * - "Search" closes the dialog with a "coming soon" disclaimer.
 *   The actual search wiring lands when the AI endpoint is available
 *   — that's why the textarea is uncontrolled and the button does
 *   not dispatch a fetch.
 *
 * Visual notes:
 * - We keep the surface unstyled at the Dialog level (no extra
 *   classes) so the dialog reads as a plain centered card. Future
 *   iterations will inherit the v0 AI dialog's glow + examples row.
 */
export function AiSearchDialog({ open, onOpenChange }: AiSearchDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles aria-hidden className="size-6" />
            <h2 className="text-lg font-semibold text-foreground">
              Buscar con IA
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Cerrar"
            className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          Describí en tus palabras el tipo de propiedad que estás buscando y
          nuestra IA te ayudará a encontrar las mejores opciones.
        </p>

        <textarea
          placeholder="Describí el tipo de propiedad que buscás..."
          rows={4}
          className="w-full rounded-2xl border border-border bg-background p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring/40"
        />

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => onOpenChange(false)}>
            Buscar
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          La búsqueda con IA estará disponible próximamente.
        </p>
      </div>
    </Dialog>
  );
}
