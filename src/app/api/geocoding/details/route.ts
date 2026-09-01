/**
 * `GET /api/geocoding/details` — thin proxy over Places API (New).
 *
 * Upstream pinned: `GET https://places.googleapis.com/v1/places/{placeId}`
 * (Places API New). Same thin-route rationale as the autocomplete handler:
 * all behavior lives in `@/lib/geocoding/places-api`.
 *
 * Contract: `?placeId=<id>&sessionToken=<opaque>` → 200 normalized
 * `{ placeId, formattedAddress, addressComponents, location }` (GP-2),
 * 400 `invalid_request`, 404 `place_not_found`, 503 `not_configured`
 * (GP-4), 429 + `Retry-After` (GP-5), 502 `upstream_error` (GP-6).
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { placeDetails, toProxyResponse } from '@/lib/geocoding/places-api';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const placeId = request.nextUrl.searchParams.get('placeId');
    const sessionToken = request.nextUrl.searchParams.get('sessionToken');
    const result = await placeDetails(placeId, sessionToken);
    return NextResponse.json(result);
  } catch (error) {
    return toProxyResponse(error);
  }
}
