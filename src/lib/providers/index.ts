/**
 * Flight search orchestrator
 *
 * Uses SerpApi (Google Flights + Google Travel Explore) as the sole provider.
 * - Step 1: discoverDestinations → 1 API call returns all cities with prices & images
 * - Step 2: searchFlights → 1 API call returns detailed flights for a specific city
 *
 * Results are cached in-memory for 4 hours to avoid burning API calls.
 */

import { FlightDeal, CheapDestination } from "./types";
import { discoverDestinations, searchFlightsForCity } from "./serpapi";
import { getCached, setCache } from "../cache";

// ─── Search all destinations (Step 1) ────────────────────────────────

export async function searchAllCities(params: {
  departDate: string;
  returnDate: string;
  maxPrice?: number;
}): Promise<{ destinations: CheapDestination[] }> {
  const cacheKey = `explore-${params.departDate}-${params.returnDate}`;
  const cached = getCached<CheapDestination[]>(cacheKey);

  if (cached) {
    console.log(`[Cache hit] destinations ${params.departDate}`);
    const filtered = params.maxPrice
      ? cached.filter((d) => d.price <= params.maxPrice!)
      : cached;
    return { destinations: filtered };
  }

  // One API call gets all destinations
  const destinations = await discoverDestinations({
    departDate: params.departDate,
    returnDate: params.returnDate,
    maxPrice: params.maxPrice,
  });

  // Cache the full results (without price filter for reuse at different budgets)
  setCache(cacheKey, destinations);

  return { destinations };
}

// ─── Search flights for a specific city (Step 2) ─────────────────────

export async function searchFlights(params: {
  cityId: string;
  departDate: string;
  returnDate: string;
  maxPrice?: number;
}): Promise<FlightDeal[]> {
  const cacheKey = `flights-${params.cityId}-${params.departDate}-${params.returnDate}`;
  const cached = getCached<FlightDeal[]>(cacheKey);

  if (cached) {
    console.log(`[Cache hit] flights ${params.cityId}`);
    const filtered = params.maxPrice
      ? cached.filter((f) => f.price <= params.maxPrice!)
      : cached;
    return filtered;
  }

  // One API call per city
  const flights = await searchFlightsForCity({
    arrivalCode: params.cityId,
    departDate: params.departDate,
    returnDate: params.returnDate,
    maxPrice: params.maxPrice,
  });

  // Cache full results
  setCache(cacheKey, flights);

  return flights;
}

export { type FlightDeal, type CheapDestination } from "./types";
