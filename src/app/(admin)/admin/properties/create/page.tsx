/**
 * `/admin/properties/create` — RSC wrapper for the create flow.
 *
 * Why an RSC page (not a client guard, design D4)?
 * - The spec pins the contract: ADMINISTRATIVE/unauthenticated must
 *   receive NO form HTML. A client-side guard ships the form to the
 *   browser first and hides it — the redirect has to happen on the
 *   server, before a single form byte is serialized. `redirect`
 *   throws `NEXT_REDIRECT`, so the island never renders for a role
 *   the backend will reject anyway.
 *
 * Why re-resolve the user here (the layout already does it)?
 * - Same reason as the listing page (see `../page.tsx`): layouts
 *   cannot pass props to pages, and the cookie read is request-
 *   scoped and cheap. The 3-line pipeline (cookies →
 *   `resolveAdminUser` → `canCreateProperty`) keeps this page's
 *   snapshot identical to the layout's within the request.
 *
 * Why does the island get a boolean and not the role?
 * - Boundary minimization (design D4): the only fact the client
 *   needs is "may this user create?". The raw role stays server-side;
 *   the island's `canCreate=false → null` guard is defense in depth
 *   for a mis-wired parent, not the gate itself.
 *
 * Chrome parity (admin-property-skeleton DELTA):
 * - This file renders INSIDE `(admin)/admin/layout.tsx`'s
 *   `AdminShell`. It MUST NOT add another shell — a duplicate would
 *   render two sidebars. The heading + island sit in the same
 *   `Container py-8` treatment as the rest of the zone.
 *
 * RSC lift (admin-property-business-users, design D5):
 * - The AGENT selector options are fetched HERE, server-side, via
 *   `fetchBusinessUsers` (`authFetch` is server-only by contract) and
 *   threaded into the island as plain-JSON props. Single role query
 *   fail-opens to `[]`, so a backend outage degrades to empty selector,
 *   never a crash. Owner is not fetched (product: only AGENT).
 *   The only pre-existing exception: a terminal 401 re-throws
 *   `NEXT_REDIRECT` from inside the fetcher and bounces to `/login`
 *   (REQ-BUA-005) — the redirect is NOT masked as an empty list.
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { resolveAdminUser } from '@/lib/auth/admin-session';
import { canCreateProperty } from '@/lib/auth/roles';
import { fetchBusinessUsers } from '@/lib/business-users/api';

import { PropertyCreateForm } from '@/components/admin/properties';
import { Container } from '@/components/ui/Container';

export default async function AdminPropertiesCreatePage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('auth.accessToken')?.value;
  const user = resolveAdminUser(accessToken);
  const canCreate = canCreateProperty(user?.role);

  // The gate runs BEFORE any form markup exists: `redirect` throws,
  // so nothing below this line — and no form HTML — reaches a role
  // that cannot honor it.
  if (!canCreate) redirect('/admin/properties');

  // Design D5: only AGENT role is selectable (owner field is informational
  // and not backed by business-users per product decision). Single query
  // fail-opens to `[]` while NEXT_REDIRECT propagates.
  const agents = await fetchBusinessUsers({ role: 'AGENT' });
  const owners: typeof agents = [];

  return (
    <Container className="space-y-6 py-8">
      <header className="space-y-2">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Casal · Admin · Nueva ficha
        </p>
        <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
          Crear propiedad
        </h1>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          Cargá los datos esenciales y publicá sin fricción. Las secciones guían el progreso y
          marcan dónde revisar.
        </p>
      </header>
      <PropertyCreateForm canCreate={canCreate} options={{ agents, owners }} />
    </Container>
  );
}
