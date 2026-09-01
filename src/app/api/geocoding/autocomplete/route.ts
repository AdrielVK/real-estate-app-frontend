/**
 * `GET /api/geocoding/autocomplete` — thin proxy over Places API (New).
 *
 * Upstream pinned: `POST https://places.googleapis.com/v1/places:autocomplete`
 * (Places API New — REST, header-authenticated). The legacy
 * `maps.googleapis.com/js/api` SDK is intentionally NOT used: it would put
 * a key in the browser bundle (GP-7).
 *
 * Why so thin?
 * - All behavior (key check, validation, normalization, error mapping)
 *   lives in `@/lib/geocoding/places-api`, shared with the details route.
 *   Duplicating the error map per route is how raw envelopes leak (GP-6).
 *
 * Contract: `?input=<query>&sessionToken=<opaque>` → 200
 * `{ predictions: [{ placeId, description, structuredFormatting? }] }`
 * (GP-1), 400 `invalid_request`, 503 `not_configured` (GP-4), 429
 * `rate_limited` + `Retry-After` (GP-5), 502 `upstream_error` (GP-6).
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { autocomplete, toProxyResponse } from '@/lib/geocoding/places-api';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const input = request.nextUrl.searchParams.get('input');
    const sessionToken = request.nextUrl.searchParams.get('sessionToken');
    const result = await autocomplete(input, sessionToken);
    return NextResponse.json(result);
  } catch (error) {
    return toProxyResponse(error);
  }
}
