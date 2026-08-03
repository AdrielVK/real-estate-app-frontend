/**
 * URL ↔ filter state bridge for the `/buscar` search results page.
 *
 * URL is the single source of truth: every filter change serializes to
 * a search-param string, the page parses it server-side, and pagination
 * rebuilds the URL from the current filter set so active filters are
 * preserved.
 *
 * Conventions
 * - Booleans: emitted only when `true`; absent on the wire means `undefined`.
 * - Empty arrays: omitted entirely (not `propertyTypes=` with an empty value).
 * - `page`: omitted when it equals `1`; default to `1` on parse.
 * - `currency`: always emitted (defaults to `ARS`).
 * - Multi-value keys (`propertyTypes`, `requiredTags`): comma-separated
 *   in a single key — keeps URLs short and matches the spec.
 * - Unknown keys: ignored on parse (forward-compat with new filters).
 *
 * Pure module — no React, no `next/navigation`. Fully unit-testable.
 */
import type {
  Currency,
  OperationSlug,
  PropertyAge,
  PropertyTypeSlug,
  SearchFilters,
  TagCategory,
} from '@/types/publication';

/* ------------------------------------------------------------------ */
/*  Enum tables                                                        */
/* ------------------------------------------------------------------ */

/**
 * UI label for each `OperationSlug`. Backend slugs are lowercased snake_case;
 * the table is the only place we translate them for display.
 */
export const OPERATION_LABEL: Record<OperationSlug, string> = {
  venta: 'Venta',
  alquiler: 'Alquiler',
  alquiler_temporario: 'Alquiler temporario',
  alquiler_comercial: 'Alquiler comercial',
  permuta: 'Permuta',
};

/**
 * UI label for each `PropertyTypeSlug`.
 */
export const PROPERTY_TYPE_LABEL: Record<PropertyTypeSlug, string> = {
  casa: 'Casa',
  departamento: 'Departamento',
  ph: 'PH',
  local: 'Local',
  oficina: 'Oficina',
  terreno: 'Terreno',
  cochera: 'Cochera',
  galpon: 'Galpón',
};

/**
 * Hardcoded common tag slugs grouped by category. The backend does not
 * expose a tag-listing endpoint yet, so the UI shows a curated set per
 * category. The module is ready to swap for a fetched list later
 * without changing call sites — only the constant value moves.
 */
export const TAGS_BY_CATEGORY: Record<
  TagCategory,
  readonly { readonly slug: string; readonly label: string }[]
> = {
  servicio: [
    { slug: 'agua-corriente', label: 'Agua corriente' },
    { slug: 'gas-natural', label: 'Gas natural' },
    { slug: 'cloacas', label: 'Cloacas' },
    { slug: 'internet', label: 'Internet' },
    { slug: 'seguridad-24hs', label: 'Seguridad 24hs' },
    { slug: 'portero', label: 'Portero' },
  ],
  amenidades: [
    { slug: 'pileta', label: 'Pileta' },
    { slug: 'parrilla', label: 'Parrilla' },
    { slug: 'quincho', label: 'Quincho' },
    { slug: 'gimnasio', label: 'Gimnasio' },
    { slug: 'sum', label: 'SUM' },
    { slug: 'laundry', label: 'Laundry' },
    { slug: 'cochera', label: 'Cochera' },
    { slug: 'balcon', label: 'Balcón' },
    { slug: 'terraza', label: 'Terraza' },
    { slug: 'jardin', label: 'Jardín' },
    { slug: 'amoblado', label: 'Amoblado' },
  ],
  condicion: [
    { slug: 'a-estrenar', label: 'A estrenar' },
    { slug: 'reciclado', label: 'Reciclado' },
    { slug: 'buen-estado', label: 'Buen estado' },
    { slug: 'acepta-mascotas', label: 'Acepta mascotas' },
  ],
  material: [
    { slug: 'madera', label: 'Madera' },
    { slug: 'mamposteria', label: 'Mampostería' },
    { slug: 'hormigon', label: 'Hormigón' },
    { slug: 'steel-frame', label: 'Steel frame' },
  ],
};

/**
 * "Antigüedad de la propiedad" selector options — how old the
 * building is, NOT when the listing was published. Maps to the
 * `propertyAge` URL param and the (forthcoming) backend field.
 *
 * `undefined` (Cualquiera) is encoded as the absence of the param.
 */
export const PROPERTY_AGE_OPTIONS: readonly {
  readonly label: string;
  readonly value: PropertyAge;
}[] = [
  { label: 'A estrenar', value: '0-2' },
  { label: 'De 2 a 5 años', value: '2-5' },
  { label: 'De 5 a 10 años', value: '5-10' },
  { label: 'De 10 a 20 años', value: '10-20' },
  { label: '20+ años', value: '20+' },
];

/* ------------------------------------------------------------------ */
/*  Defaults                                                           */
/* ------------------------------------------------------------------ */

const KNOWN_OPERATION_SLUGS = new Set<OperationSlug>(
  Object.keys(OPERATION_LABEL) as OperationSlug[],
);

const KNOWN_PROPERTY_TYPE_SLUGS = new Set<PropertyTypeSlug>(
  Object.keys(PROPERTY_TYPE_LABEL) as PropertyTypeSlug[],
);

const KNOWN_PROPERTY_AGE = new Set<PropertyAge>(['0-2', '2-5', '5-10', '10-20', '20+']);

const KNOWN_CURRENCIES = new Set<Currency>(['ARS', 'USD']);

/** Default filter state — `page=1`, `currency='ARS'`, empty arrays. Currency is only serialized when a price filter is active. */
export const DEFAULT_FILTERS: SearchFilters = {
  propertyTypes: [],
  requiredTags: [],
  currency: 'ARS',
  page: 1,
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function firstString(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    // Next.js hands repeated keys as arrays. Join with commas so
    // `?propertyTypes=casa&propertyTypes=ph` is equivalent to
    // `?propertyTypes=casa,ph` and both reach the CSV parser below.
    return value.length > 0 ? value.join(',') : undefined;
  }
  return value;
}

/**
 * Variant of `firstString` for scalar params (numbers, booleans, enums).
 * Repeated keys collapse to the FIRST occurrence — the same semantics
 * Next.js would expose if the value were already a plain string.
 */
function firstScalar(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value[0];
  return value;
}

function csvSplit(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parseInt0(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  return value === 'true' ? true : undefined;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Parse Next.js `searchParams` into a `SearchFilters` object.
 *
 * Defensive: unknown keys are dropped, malformed numbers become
 * `undefined`, and unknown enum slugs are filtered out of arrays.
 * Page defaults to `1` and currency to `'ARS'` (matching `DEFAULT_FILTERS`).
 */
export function parseSearchParams(
  sp: Record<string, string | string[] | undefined>,
): SearchFilters {
  const filters: SearchFilters = { ...DEFAULT_FILTERS };

  const locationText = firstString(sp.locationText);
  if (locationText && locationText.length > 0) {
    filters.locationText = locationText;
  }

  const propertyTypes = csvSplit(firstString(sp.propertyTypes)).filter(
    (slug): slug is PropertyTypeSlug => KNOWN_PROPERTY_TYPE_SLUGS.has(slug as PropertyTypeSlug),
  );
  if (propertyTypes.length > 0) {
    filters.propertyTypes = propertyTypes;
  }

  const operation = firstScalar(sp.operation);
  if (operation && KNOWN_OPERATION_SLUGS.has(operation as OperationSlug)) {
    filters.operation = operation as OperationSlug;
  }

  const priceMin = parseInt0(firstScalar(sp.priceMin));
  if (priceMin !== undefined) filters.priceMin = priceMin;

  const priceMax = parseInt0(firstScalar(sp.priceMax));
  if (priceMax !== undefined) filters.priceMax = priceMax;

  const currency = firstScalar(sp.currency);
  if (currency && KNOWN_CURRENCIES.has(currency as Currency)) {
    filters.currency = currency as Currency;
  }

  for (const key of [
    'roomsMin',
    'bedroomsMin',
    'bathroomsMin',
    'garagesMin',
    'totalAreaMin',
    'totalAreaMax',
    'coveredAreaMin',
    'coveredAreaMax',
  ] as const) {
    const value = parseInt0(firstScalar(sp[key]));
    if (value !== undefined) {
      // Numeric filters are always non-negative — drop negatives defensively.
      filters[key] = value < 0 ? undefined : value;
    }
  }

  const requiredTags = csvSplit(firstString(sp.requiredTags));
  if (requiredTags.length > 0) {
    filters.requiredTags = requiredTags;
  }

  const propertyAge = firstScalar(sp.propertyAge);
  if (propertyAge && KNOWN_PROPERTY_AGE.has(propertyAge as PropertyAge)) {
    filters.propertyAge = propertyAge as PropertyAge;
  }

  // Expensas: `noExpensas` and `expensesMax` are mutually exclusive on
  // the wire but defensive — if both arrive (legacy URL), we trust
  // `noExpensas=true` and drop the numeric cap. `expensesCurrency` is
  // only meaningful when `expensesMax` is also set.
  if (parseBoolean(firstScalar(sp.noExpensas)) === true) {
    filters.noExpensas = true;
  } else {
    const expensesMax = parseInt0(firstScalar(sp.expensesMax));
    if (expensesMax !== undefined) {
      filters.expensesMax = expensesMax;
      const expensesCurrency = firstScalar(sp.expensesCurrency);
      filters.expensesCurrency =
        expensesCurrency && KNOWN_CURRENCIES.has(expensesCurrency as Currency)
          ? (expensesCurrency as Currency)
          : 'ARS';
    }
  }

  for (const key of [
    'acceptsCredits',
    'requiresGuarantor',
    'acceptsPets',
    'featuredOnly',
  ] as const) {
    const value = parseBoolean(firstScalar(sp[key]));
    if (value !== undefined) {
      filters[key] = value;
    }
  }

  const page = parseInt0(firstScalar(sp.page));
  if (page !== undefined && page >= 1) {
    filters.page = page;
  }

  return filters;
}

/**
 * Serialize `SearchFilters` to `URLSearchParams`.
 *
 * Rules (see header doc):
 * - Booleans emitted only when `true`.
 * - Empty arrays / absent keys omitted.
 * - `page` omitted when `1` (clean default URL).
 * - `currency` emitted only when `priceMin` or `priceMax` is set.
 */
export function serializeFilters(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.locationText) {
    params.set('locationText', filters.locationText);
  }

  if (filters.propertyTypes.length > 0) {
    params.set('propertyTypes', filters.propertyTypes.join(','));
  }

  if (filters.operation) {
    params.set('operation', filters.operation);
  }

  if (filters.priceMin !== undefined) {
    params.set('priceMin', String(filters.priceMin));
  }
  if (filters.priceMax !== undefined) {
    params.set('priceMax', String(filters.priceMax));
  }

  if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
    params.set('currency', filters.currency);
  }

  const numericKeys = [
    'roomsMin',
    'bedroomsMin',
    'bathroomsMin',
    'garagesMin',
    'totalAreaMin',
    'totalAreaMax',
    'coveredAreaMin',
    'coveredAreaMax',
  ] as const;
  for (const key of numericKeys) {
    const value = filters[key];
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }

  if (filters.requiredTags.length > 0) {
    params.set('requiredTags', filters.requiredTags.join(','));
  }

  if (filters.propertyAge !== undefined) {
    params.set('propertyAge', filters.propertyAge);
  }

  // Expensas: `noExpensas` is mutually exclusive with `expensesMax` /
  // `expensesCurrency` on the wire — picking "Sin expensas" clears the
  // numeric filter and the backend reads `noExpensas=true` to mean
  // "must be 0 / not reported". When the user has set a numeric
  // cap, we send the cap and the currency (default ARS).
  if (filters.noExpensas === true) {
    params.set('noExpensas', 'true');
  } else if (filters.expensesMax !== undefined) {
    params.set('expensesMax', String(filters.expensesMax));
    params.set('expensesCurrency', filters.expensesCurrency ?? 'ARS');
  }

  for (const key of [
    'acceptsCredits',
    'requiresGuarantor',
    'acceptsPets',
    'featuredOnly',
  ] as const) {
    if (filters[key] === true) {
      params.set(key, 'true');
    }
  }

  if (filters.page !== 1) {
    params.set('page', String(filters.page));
  }

  return params;
}
