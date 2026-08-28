'use client';

import { useId, useState } from 'react';

import Link from 'next/link';

import { Plus, SlidersHorizontal } from 'lucide-react';

import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';

export interface PropertyToolbarProps {
  /**
   * Whether the current user may create properties. Computed
   * server-side via `canCreateProperty(user.role)` and passed
   * across the RSC → client boundary as a plain boolean
   * (design D5: never pass the raw role).
   */
  canCreate: boolean;
  /** Optional className appended to the toolbar's outer flex row. */
  className?: string;
}

/**
 * `PropertyToolbar` — the single client island on the admin
 * properties listing (spec "Property Toolbar", design D5).
 *
 * Why a client component?
 * - The advanced-filters affordance owns an `open` state for the
 *   `<Dialog>`. Everything else (search input, CTA) is purely
 *   declarative, but the dialog state forces the `'use client'`
 *   boundary. The page stays RSC; only the toolbar ships JS.
 *
 * Why a `canCreate: boolean` prop instead of `user.role`?
 * - The page already calls `canCreateProperty(user.role)` to make
 *   the auth decision server-side. Re-deriving the decision on the
 *   client would (a) leak the role to the browser bundle, and
 *   (b) duplicate the predicate across RSC and client. We pass the
 *   already-computed boolean — minimal payload, no drift surface.
 *
 * Accessibility:
 * - The search input uses an `aria-label` so screen readers
 *   announce its purpose (the spec calls for a labelled input;
 *   the visible label is intentionally hidden to keep the row
 *   compact — the placeholder text doubles as a visual hint).
 * - The "Filtros avanzados" button carries an explicit `aria-label`
 *   so the visible text — which is hidden on small viewports — is
 *   always announced (matches the search filter-bar pattern).
 * - The dialog uses an `id`-bound heading for `aria-labelledby`
 *   (Dialog primitive forwards it).
 *
 * Token discipline (spec NFR "Design Token Compliance"):
 * - `border-border`, `bg-background/70`, `text-foreground`,
 *   `text-muted-foreground` — no hardcoded hex.
 * - The CTA uses `Button asChild` so the underlying `<Link>` keeps
 *   real navigation semantics (no `<a>` workarounds).
 */
export function PropertyToolbar({ canCreate, className }: PropertyToolbarProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const headingId = useId();

  return (
    <div
      data-slot="property-toolbar"
      className={cn('flex flex-wrap items-center gap-2', className)}
    >
      {/* Search field — input styling mirrors the search filter-bar
          tokens per the design. On wide viewports it stretches to a
          comfortable width; on narrow viewports it occupies the full
          row and the buttons wrap below. */}
      <input
        type="search"
        aria-label="Buscar propiedades"
        placeholder="Buscar propiedades…"
        data-testid="property-toolbar-search"
        className="h-9 w-full min-w-0 flex-1 rounded-full border border-border bg-background/70 px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:max-w-sm"
      />

      <Button
        type="button"
        variant="outline"
        size="md"
        onClick={() => setAdvancedOpen(true)}
        aria-label="Abrir filtros avanzados"
        aria-haspopup="dialog"
        aria-expanded={advancedOpen}
        data-testid="property-toolbar-filters"
        className="h-9 cursor-pointer rounded-full"
      >
        <SlidersHorizontal aria-hidden className="size-4" />
        <span className="hidden sm:inline">Filtros avanzados</span>
      </Button>
      {canCreate ? (
        <Button
          asChild
          size="md"
          data-testid="property-toolbar-create"
          className="h-9 cursor-pointer rounded-full"
        >
          <Link href="/admin/properties/create">
            <Plus aria-hidden className="size-4" />
            <span>Crear propiedad</span>
          </Link>
        </Button>
      ) : null}

      {/* Advanced-filters dialog — placeholder body. The full filter
          UI ships in a later PR; for the skeleton the dialog just
          needs to open / close / be labelled so the contract is
          pinned. */}
      <Dialog open={advancedOpen} onOpenChange={setAdvancedOpen} labelledBy={headingId}>
        <div className="flex flex-col gap-3">
          <h2 id={headingId} className="text-lg font-semibold text-foreground">
            Filtros avanzados
          </h2>
          <p className="text-sm text-muted-foreground">
            Próximamente: filtros avanzados para la lista de propiedades.
          </p>
        </div>
      </Dialog>
    </div>
  );
}
