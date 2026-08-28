import { cookies } from 'next/headers';

import { resolveAdminUser } from '@/lib/auth/admin-session';
import { canCreateProperty } from '@/lib/auth/roles';

import { PropertyCard, PropertyPagination, PropertyToolbar } from '@/components/admin/properties';
import { Container } from '@/components/ui/Container';

const PAGE_SIZE = 6;
const TOTAL_PAGES = 5;

interface PageProps {
  /**
   * Next 16 hands the page the parsed query string. We only read
   * `page`; the rest is left to the future filtering slice.
   */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Build the deterministic 30-item mock data set used by the
 * skeleton. Six items per page across five pages so the pagination
 * surface is exercised (1 … 2 3 4 … 5).
 *
 * Why inline?
 * - Spec NFR "No Backend Coupling" pins the contract: the listing
 *   MUST NOT import from `@/types/publication` (no DTOs) and MUST
 *   NOT make network requests. Inline placeholders keep the surface
 *   minimal — the real data source ships in a later change.
 */
function buildMockProperties(): readonly {
  readonly title: string;
  readonly price: string;
  readonly location: string;
  readonly specs: readonly string[];
}[] {
  return Array.from({ length: PAGE_SIZE * TOTAL_PAGES }, (_, index) => {
    const n = index + 1;
    return {
      title: `Propiedad ${n}`,
      price: `USD ${(100_000 + n * 7_500).toLocaleString('en-US')}`,
      location: 'Villa Belgrano, Córdoba',
      specs: ['187 m²', '4 amb.', '2 cocheras'] as const,
    };
  });
}

/**
 * Clamp a raw `?page=` value to the inclusive `[1, totalPages]`
 * range. Non-integer, non-numeric, empty, or zero values fall back
 * to 1 (canonical first page). This matches the spec scenarios:
 * `?page=0`, `?page=-3`, `?page=abc` → page 1; `?page=99` → 5.
 */
function clampPage(raw: string | string[] | undefined, totalPages: number): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') return 1;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return 1;
  return Math.min(parsed, totalPages);
}

/**
 * `/admin/properties` — admin properties listing (RSC).
 *
 * Why a server component?
 * - The page orchestrates: cookie → `resolveAdminUser` →
 *   `canCreateProperty` → clamp `?page=` → slice mock data →
 *   render the toolbar / cards / pagination. None of this needs
 *   client state. The toolbar (the only client island) owns the
 *   dialog state for the advanced-filters affordance.
 *
 * Why re-resolve the user here (the layout already does it)?
 * - Next.js layouts cannot pass props to their `children` pages,
 *   and a context provider would add a boundary + drift risk.
 *   Re-running the 3-line cookie → user pipeline on the page keeps
 *   the data flow request-scoped and identical to the layout's
 *   snapshot (the cookie is read twice in the same request, so the
 *   payload is consistent).
 *
 * Page clamp
 * - `?page=` accepts any string but only valid 1..TOTAL_PAGES
 *   integers navigate; everything else falls back to the canonical
 *   first page. The clamp is a pure function — the integration
 *   test exercises it from every angle (`0`, `-3`, `abc`, `99`, `6`,
 *   `3`).
 *
 * Spec scenarios pinned:
 * - "Listing render" → 6 cards, pagination, grid 1→3 cols.
 * - "Role-Gated Create Affordance" → `canCreateProperty(user.role)`
 *   gates the toolbar CTA.
 * - "Property Toolbar" → always present, search + filters.
 * - "Paginated Listing" → windowed pagination, URL-driven.
 */
export default async function AdminPropertiesPage({ searchParams }: PageProps) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('auth.accessToken')?.value;
  const user = resolveAdminUser(accessToken);
  const canCreate = canCreateProperty(user?.role);

  const params = await searchParams;
  const currentPage = clampPage(params.page, TOTAL_PAGES);

  const allProperties = buildMockProperties();
  const start = (currentPage - 1) * PAGE_SIZE;
  const visibleProperties = allProperties.slice(start, start + PAGE_SIZE);

  return (
    <Container className="space-y-6 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">Propiedades</h1>
        <p className="text-sm text-muted-foreground">
          Gestioná el catálogo de propiedades. La lista se conecta al backend en una iteración
          posterior.
        </p>
      </header>

      <PropertyToolbar canCreate={canCreate} />

      <section
        aria-label={`Listado de propiedades, página ${currentPage} de ${TOTAL_PAGES}`}
        data-testid="properties-grid"
        className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
      >
        {visibleProperties.map((property) => (
          <PropertyCard
            key={property.title}
            title={property.title}
            price={property.price}
            location={property.location}
            specs={property.specs}
          />
        ))}
      </section>

      <PropertyPagination currentPage={currentPage} totalPages={TOTAL_PAGES} />
    </Container>
  );
}
