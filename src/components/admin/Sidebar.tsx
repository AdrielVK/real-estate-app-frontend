import { cn } from '@/lib/utils';

interface SidebarNavItem {
  /** Visible label of the nav entry. */
  label: string;
  /**
   * Intended destination. Items are currently rendered as `aria-disabled`
   * buttons (spec A6 — visible but non-functional) so the href is purely
   * metadata for the future visual / routing layer.
   */
  href: string;
}

/**
 * Placeholder navigation entries for the admin zone (spec A3).
 * Order is intentional: dashboard first, then content domains, then admin
 * tooling at the bottom. Items are intentionally non-functional in this
 * change (A6) and will become real routes in a later one.
 */
const NAV_ITEMS: readonly SidebarNavItem[] = [
  { label: 'Dashboard', href: '/admin' },
  { label: 'Publicaciones', href: '/admin/publicaciones' },
  { label: 'Propiedades', href: '/admin/propiedades' },
  { label: 'Clientes', href: '/admin/clientes' },
  { label: 'Reportes', href: '/admin/reportes' },
  { label: 'Configuración', href: '/admin/configuracion' },
];

export interface SidebarProps {
  /** Optional extra classes appended to the root element. */
  className?: string;
}

/**
 * `Sidebar` — fixed left navigation for the admin zone.
 *
 * - Width is structural (`w-64`, 256px) so the main content area has a
 *   predictable companion column.
 * - Background is the ONLY color used in the admin zone (`bg-neutral-900`,
 *   spec A7 — admin must be visually distinct from the public zone). Text
 *   uses white for readability on the dark surface; this is functional
 *   contrast, not decorative styling.
 * - Hidden below `lg` per the design (admin tools assume a desktop-class
 *   viewport); the mobile drawer is a future concern.
 * - Each nav item is a `<button disabled aria-disabled="true">` so the
 *   entries are visible and focusable but cannot navigate yet (A6).
 *   Real routing lands in a later change.
 */
export function Sidebar({ className }: SidebarProps) {
  return (
    <aside
      className={cn('hidden w-64 shrink-0 flex-col bg-neutral-900 text-white lg:flex', className)}
    >
      <div className="border-b border-white/10 px-6 py-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-white/60">Real State</p>
        <p className="mt-1 text-base font-semibold">Admin</p>
      </div>
      <nav aria-label="Navegación de administración" className="flex-1 px-3 py-4">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <button
                type="button"
                disabled
                aria-disabled="true"
                data-testid={`sidebar-nav-${item.label.toLowerCase()}`}
                className={cn(
                  'flex w-full items-center gap-3 px-3 py-2 text-left text-sm',
                  'cursor-not-allowed opacity-70',
                )}
              >
                <span aria-hidden="true" className="inline-block h-2 w-2 shrink-0 bg-white/40" />
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
