/**
 * Server-only Google Places API (New) client for the geocoding proxy.
 *
 * SECURITY BOUNDARY (GP-7): this module is the ONLY reader of
 * `process.env.GOOGLE_PLACES_API_KEY`. The variable is deliberately NOT
 * `NEXT_PUBLIC_*`, so it never reaches the browser bundle; the two Route
 * Handlers under `src/app/api/geocoding/` are the only callers.
 *
 * Why Places API (New) and not the legacy JS SDK?
 * - New endpoints are plain REST (`places.googleapis.com/v1/...`), so the
 *   proxy needs no Google JS in the client and no second auth surface.
 *   The `X-Goog-FieldMask` header minimizes the upstream payload — which
 *   also caps quota burn on these publicly reachable routes.
 *
 * Why throw `ProxyRequestError` instead of returning a result object
 * (unlike `@/lib/auth/api`)?
 * - Both proxy routes share the exact same error → HTTP mapping (400/503/
 *   429/404/502). A typed throw funnels every failure into one code path
 *   (`toProxyResponse`) so a route can never accidentally forward Google
 *   internals (GP-6).
 *
 * Why are logs status-only and test-guarded?
 * - The key, session token and user input must never appear in logs
 *   (threat matrix row "key/token logging"). `NODE_ENV !== 'test'`
 *   mirrors `@/lib/auth/api` so the suite stays silent and the
 *   console-spy leak test can assert nothing is emitted.
 */
import { NextResponse } from 'next/server';

import { z } from 'zod';

import type {
  AutocompleteResponse,
  PlaceDetailsResponse,
  Prediction,
  ProxyError,
  ProxyErrorCode,
} from '@/types/geocoding';

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const AUTOCOMPLETE_FIELD_MASK = 'places.id,places.text';
const DETAILS_BASE = 'https://places.googleapis.com/v1/places';
const DETAILS_FIELD_MASK = 'id,formattedAddress,addressComponents,location';

/** Default hint when upstream 429s without `Retry-After` (GP-5). */
const DEFAULT_RETRY_AFTER = '1';

/**
 * Injection guards (task 1.4, threat matrix): adversarial query values must
 * never reach the upstream URL path, body, or token passthrough.
 * - `placeId` lands in a URL PATH → strict charset whitelist (traversal,
 *   `?`, control chars all rejected) plus `encodeURIComponent` as
 *   defense-in-depth.
 * - `input` lands in a JSON body → length cap bounds quota abuse.
 * - `sessionToken` is opaque → forwarded only when it matches the UUID-ish
 *   shape the hook generates; anything else is silently omitted (GP-3).
 */
const PLACE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,120}$/;
const MAX_INPUT_LENGTH = 200;
const SESSION_TOKEN_PATTERN = /^[0-9a-fA-F-]{1,64}$/;

function sanitizeSessionToken(sessionToken: string | null): string | null {
  return sessionToken && SESSION_TOKEN_PATTERN.test(sessionToken) ? sessionToken : null;
}

/**
 * Upstream shapes below are parsed with Zod and re-emitted in the
 * normalized contract only — any field not modeled here is dropped
 * (GP-6: raw envelope never reaches the client).
 */
const UpstreamPredictionSchema = z.object({
  id: z.string().min(1),
  text: z.object({ text: z.string() }).optional(),
  structuredFormatting: z.object({ mainText: z.string(), secondaryText: z.string() }).optional(),
});

const AutocompleteUpstreamSchema = z.object({
  places: z.array(UpstreamPredictionSchema).optional(),
});

const UpstreamAddressComponentSchema = z.object({
  longText: z.string().optional(),
  shortText: z.string().optional(),
  types: z.array(z.string()).optional(),
});

const PlaceDetailsUpstreamSchema = z.object({
  id: z.string().min(1),
  formattedAddress: z.string().optional(),
  addressComponents: z.array(UpstreamAddressComponentSchema).optional(),
  location: z.object({ latitude: z.number(), longitude: z.number() }).optional(),
});

/**
 * Typed proxy failure: `status` is the HTTP code the route returns and
 * `code` is the stable, generic error name (GP-6). `retryAfter` is the
 * only upstream header ever passed through (GP-5).
 */
export class ProxyRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: ProxyErrorCode,
    readonly retryAfter?: string,
  ) {
    super(code);
    this.name = 'ProxyRequestError';
  }
}

/** GP-4: missing key fails closed BEFORE any upstream call is attempted. */
function readServerKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new ProxyRequestError(503, 'not_configured');
  return key;
}

/** Collapse every non-429 upstream failure into a generic 502 (GP-6). */
function upstreamFailure(
  status: number | undefined,
  retryAfter?: string | null,
): ProxyRequestError {
  if (process.env.NODE_ENV !== 'test') {
    // Status only — never the key, token, input, or Google's message.
    console.error('[geocoding] upstream request failed', { status: status ?? 'network' });
  }
  if (status === 429) {
    return new ProxyRequestError(429, 'rate_limited', retryAfter ?? DEFAULT_RETRY_AFTER);
  }
  return new ProxyRequestError(502, 'upstream_error');
}

async function parseUpstreamJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw upstreamFailure(response.status);
  }
}

function normalizePrediction(entry: z.infer<typeof UpstreamPredictionSchema>): Prediction {
  const description = entry.text?.text ?? entry.structuredFormatting?.mainText ?? '';
  return entry.structuredFormatting
    ? {
        placeId: entry.id,
        description,
        structuredFormatting: entry.structuredFormatting,
      }
    : { placeId: entry.id, description };
}

/**
 * `POST places.googleapis.com/v1/places:autocomplete` (GP-1). The session
 * token is opaque server-side and forwarded untouched for billing
 * grouping (GP-3). Validation order is deliberate: a malformed request is
 * a 400 even when the key is absent, so garbage probes never depend on
 * deployment state.
 */
export async function autocomplete(
  input: string | null,
  sessionToken: string | null,
): Promise<AutocompleteResponse> {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new ProxyRequestError(400, 'invalid_request');
  }
  if (input.length > MAX_INPUT_LENGTH) {
    throw new ProxyRequestError(400, 'invalid_request');
  }
  const key = readServerKey();

  const body: Record<string, string> = { input };
  const token = sanitizeSessionToken(sessionToken);
  if (token) body.sessionToken = token;

  let response: Response;
  try {
    response = await fetch(AUTOCOMPLETE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': AUTOCOMPLETE_FIELD_MASK,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw upstreamFailure(undefined);
  }

  if (!response.ok) {
    throw upstreamFailure(response.status, response.headers.get('Retry-After'));
  }

  const parsed = AutocompleteUpstreamSchema.safeParse(await parseUpstreamJson(response));
  if (!parsed.success) throw upstreamFailure(response.status);

  return {
    predictions: (parsed.data.places ?? []).map(normalizePrediction),
  };
}

/**
 * `GET places.googleapis.com/v1/places/{placeId}` (GP-2). `placeId` is
 * interpolated into the upstream path, so it is `encodeURIComponent`-safe
 * by construction; the charset guard (task 1.4) rejects traversal-shaped
 * ids before this line is ever reached. Google `location.{latitude,
 * longitude}` normalizes to `{lat, lng}`, `null` when absent (AS-4).
 */
export async function placeDetails(
  placeId: string | null,
  sessionToken: string | null,
): Promise<PlaceDetailsResponse> {
  if (typeof placeId !== 'string' || !PLACE_ID_PATTERN.test(placeId.trim())) {
    throw new ProxyRequestError(400, 'invalid_request');
  }
  const key = readServerKey();

  const url = new URL(`${DETAILS_BASE}/${encodeURIComponent(placeId.trim())}`);
  const token = sanitizeSessionToken(sessionToken);
  if (token) url.searchParams.set('sessionToken', token);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': DETAILS_FIELD_MASK,
      },
    });
  } catch {
    throw upstreamFailure(undefined);
  }

  if (response.status === 404) {
    throw new ProxyRequestError(404, 'place_not_found');
  }
  if (!response.ok) {
    throw upstreamFailure(response.status, response.headers.get('Retry-After'));
  }

  const parsed = PlaceDetailsUpstreamSchema.safeParse(await parseUpstreamJson(response));
  if (!parsed.success) throw upstreamFailure(response.status);

  const { id, formattedAddress, addressComponents, location } = parsed.data;
  return {
    placeId: id,
    formattedAddress: formattedAddress ?? '',
    addressComponents: (addressComponents ?? []).map((component) => ({
      longText: component.longText ?? '',
      shortText: component.shortText ?? '',
      types: component.types ?? [],
    })),
    location: location ? { lat: location.latitude, lng: location.longitude } : null,
  };
}

/**
 * Map a thrown value to the proxy's HTTP contract. Anything that is not a
 * `ProxyRequestError` collapses to a generic 502 — routes stay thin and
 * cannot leak internals (GP-6).
 */
export function toProxyResponse(error: unknown): Response {
  if (error instanceof ProxyRequestError) {
    return NextResponse.json({ error: error.code } satisfies ProxyError, {
      status: error.status,
      headers: error.retryAfter ? { 'Retry-After': error.retryAfter } : undefined,
    });
  }
  if (process.env.NODE_ENV !== 'test') {
    console.error('[geocoding] unexpected proxy failure');
  }
  return NextResponse.json({ error: 'upstream_error' } satisfies ProxyError, { status: 502 });
}
