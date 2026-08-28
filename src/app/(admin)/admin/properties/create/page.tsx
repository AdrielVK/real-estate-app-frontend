import { Container } from '@/components/ui/Container';

/**
 * `/admin/properties/create` — RSC placeholder for the create flow.
 *
 * Why a placeholder (not a form yet)?
 * - The skeleton scope is the listing + create affordance. The
 *   real create form lands in a later change once the backend
 *   contract for property mutations ships. This page exists so the
 *   "Crear propiedad" CTA in the toolbar lands somewhere coherent
 *   — a real route the auth guard already protects, with the same
 *   chrome as the listing.
 *
 * Why an RSC (no `'use client'`)?
 * - The placeholder is a static heading + muted message. There is
 *   nothing to hydrate. Keeping it RSC preserves the
 *   "only the toolbar ships JS" boundary from the listing page.
 *
 * Why inherit the AdminShell chrome (no new shell)?
 * - Spec "Shared Admin Chrome" pins the contract: both
 *   `/admin/properties` and `/admin/properties/create` render
 *   inside `(admin)/admin/layout.tsx`, which already provides the
 *   `AdminShell`. This file MUST NOT add another shell — a
 *   duplicate shell would render two sidebars and break the layout.
 *
 * Accessibility:
 * - The heading is the first thing in the document, the muted
 *   message is a `<p>` so screen readers announce it after the
 *   heading. The route is reachable by direct URL (and the
 *   toolbar's CTA) and the auth guard stays in `proxy.ts`.
 */
export default function AdminPropertiesCreatePage() {
  return (
    <Container className="space-y-4 py-8">
      <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">Crear propiedad</h1>
      <p className="text-sm text-muted-foreground">
        Próximamente: formulario de alta de propiedades. Esta vista placeholder se publica junto al
        skeleton del listado para mantener la coherencia visual de la zona admin.
      </p>
    </Container>
  );
}
