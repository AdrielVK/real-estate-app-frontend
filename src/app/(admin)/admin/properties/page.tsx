import { cookies } from 'next/headers';

import { resolveAdminUser } from '@/lib/auth/admin-session';
import { canCreateProperty } from '@/lib/auth/roles';
import { fetchBusinessUsers } from '@/lib/business-users/api';
import { fetchPropertiesByRole } from '@/lib/properties/api';
import { buildAgentMap, buildOwnerMap } from '@/lib/properties/name-maps';

import { PropertyList } from '@/components/admin/properties';
import { Container } from '@/components/ui/Container';

/**
 * One-shot dataset size for the client-side search island
 * (change `admin-properties-frontend-search`). The backend is assumed to
 * accept `limit=100`; if it caps lower, the `truncated` banner covers the
 * UX and this constant is the one-line tunable (design open question).
 */
const SEARCH_DATASET_LIMIT = 100;

/**
 * `/admin/properties` — admin properties listing (RSC).
 *
 * Role-based fetch:
 * - `ADMIN` → `GET /properties`
 * - `AGENT` / `ADMINISTRATIVE` → `GET /properties/me`
 * - `null` user → fail-closed, no fetch, empty state with
 *   "No autorizado" message.
 *
 * Pagination contract (delta `paginated-listing`): the server `?page=`
 * URL contract is RETIRED on this page. The RSC fetches one expanded
 * dataset (`SEARCH_DATASET_LIMIT`) and hands it to the `PropertyList`
 * client island, which owns search filtering and 6-per-page client
 * pagination.
 *
 * Ephemeral feedback contract (change `admin-property-create-snackbar`,
 * delta `admin-properties-listing`): the page consumes NO `searchParams`
 * at all. The `?created=1` server banner is REMOVED — success is a
 * client toast (`admin-toast-feedback`). Legacy `?created=1` deep-links
 * stay inert: the param simply has no reader, the list renders normally.
 *
 * Name maps: agent display names are resolved server-side in batch
 * (`getPropertyAgentName`) and merged over the client-safe mock registry
 * (`buildAgentMap`) so the scorer indexes the same text the cards show.
 */
export default async function AdminPropertiesPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('auth.accessToken')?.value;
  const user = resolveAdminUser(accessToken);
  const canCreate = canCreateProperty(user?.role);

  // Fail-closed: no user → no fetch, render unauthorized empty state.
  // The search toolbar is intentionally omitted here — a search input
  // over a dataset we never fetched would be dead UI (and its controlled
  // callback cannot cross the RSC → client boundary anyway).
  if (!user) {
    return (
      <Container className="space-y-6 py-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">Propiedades</h1>
          <p className="text-sm text-muted-foreground">Gestioná el catálogo de propiedades.</p>
        </header>
        {/* Durable auth state (not ephemeral feedback): stays a
            server-rendered role=status region per the spec. */}
        <div
          role="status"
          className="glass-panel rounded-xl border border-border px-4 py-8 text-center text-sm text-muted-foreground"
        >
          No autorizado para ver propiedades.
        </div>
      </Container>
    );
  }

  // One-shot expanded fetch — page 1 is implicit (api layer default).
  const result = await fetchPropertiesByRole(user.role, { limit: SEARCH_DATASET_LIMIT });

  // Truncation: the backend knows about more rows than we fetched.
  const truncated = result.total > result.properties.length;

  // Resolve agent names server-side for the cards (no hashtag fallback).
  // Single AGENT fetch (fail-open) merged over the mock registry so
  // existing mock ids and real DB ids both resolve. The card receives
  // `agentName` only when the map has a hit — otherwise it renders
  // date-only without the `Agente #xxxx` placeholder.
  const agentNameMap = buildAgentMap();
  try {
    const agents = await fetchBusinessUsers({ role: 'AGENT', limit: 100 });
    for (const agent of agents) agentNameMap.set(agent.id, agent.name);
  } catch {
    // fetchBusinessUsers already fail-opens to [] and handles
    // NEXT_REDIRECT; this catch is defensive for any unexpected throw.
  }

  const ownerNameMap = buildOwnerMap();

  return (
    <Container className="space-y-6 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">Propiedades</h1>
        <p className="text-sm text-muted-foreground">Gestioná el catálogo de propiedades.</p>
      </header>

      <PropertyList
        properties={result.properties}
        agentNameMap={agentNameMap}
        ownerNameMap={ownerNameMap}
        canCreate={canCreate}
        truncated={truncated}
      />
    </Container>
  );
}
