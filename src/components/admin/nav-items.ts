/**
 * Shared admin-zone navigation entries.
 *
 * Boundary: this module is intentionally framework-free. It imports
 * NO Next.js, NO React — so the same list is consumed by both the
 * desktop `Sidebar` and the mobile `AdminMobileNav` without either
 * surface drifting (admin-dashboard design decision D6: "Shared nav
 * items, not duplicate in Sidebar+MobileNav").
 *
 * Why exactly two entries?
 * - Spec "Spanish Nav Links" pins the contract: only `Propiedades`
 *   and `Publicaciones` are real destinations for this change. The
 *   old placeholder list (Dashboard / Clientes / Reportes /
 *   Configuración) was content-domain scaffolding for the wireframe
 *   and is intentionally removed in this PR (it does not represent
 *   shipped routes).
 * - Future entries (Clientes, Reportes, Configuración) land as their
 *   own PRs with their own specs.
 */
export interface AdminNavItem {
  /** Visible label of the nav entry (Spanish). */
  readonly label: string;
  /** Destination route under `/admin`. */
  readonly href: string;
}

/**
 * The canonical admin-zone nav list. Order is intentional:
 * Propiedades first (the core content domain), Publicaciones second
 * (publications reference propiedades).
 */
export const ADMIN_NAV_ITEMS: readonly AdminNavItem[] = [
  { label: 'Propiedades', href: '/admin/properties' },
  { label: 'Publicaciones', href: '/admin/publicaciones' },
] as const;
