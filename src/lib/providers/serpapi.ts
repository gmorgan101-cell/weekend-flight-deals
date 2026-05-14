/**
 * SerpApi provider — uses Google Flights and Google Travel Explore APIs
 *
 * Two endpoints:
 *   1. google_travel_explore — "where can I fly?" discovery (Step 1)
 *   2. google_flights — detailed flight search for a specific route (Step 2)
 *
 * Free tier: 100 searches/month
 * Docs: https://serpapi.com/google-flights-api
 */

import { FlightDeal, CheapDestination } from "./types";
import { getAverageTempForDate } from "../weather";
import {
  formatDuration,
  formatDate,
  getHour,
  getDayOfWeek,
  buildSkyscannerLink,
} from "../flight-utils";
import { isBankHolidayMonday } from "../bank-holidays";

const SERPAPI_BASE = "https://serpapi.com/search";
const LONDON_AIRPORTS = "LHR,LGW,STN,LTN,LCY";

function getApiKey(): string {
  const key = process.env.SERPAPI_KEY;
  if (!key) throw new Error("SERPAPI_KEY is not configured");
  return key;
}

// ─── Step 1: Discover destinations ──────────────────────────────────

export async function discoverDestinations(params: {
  departDate: string;
  returnDate: string;
  maxPrice?: number;
}): Promise<CheapDestination[]> {
  const searchParams = new URLSearchParams({
    engine: "google_travel_explore",
    departure_id: LONDON_AIRPORTS,
    outbound_date: params.departDate,
    return_date: params.returnDate,
    currency: "GBP",
    hl: "en",
    gl: "uk",
    api_key: getApiKey(),
  });

  if (params.maxPrice) {
    searchParams.set("max_price", String(params.maxPrice));
  }

  const url = `${SERPAPI_BASE}?${searchParams}`;
  console.log(`[SerpApi] Exploring destinations ${params.departDate} → ${params.returnDate}`);

  const response = await fetch(url);
  const data = await response.json();

  if (data.error) {
    console.error("[SerpApi] Explore error:", data.error);
    return [];
  }

  const destinations: CheapDestination[] = [];

  for (const dest of data.destinations || []) {
    const price = dest.flight_price;
    if (price === undefined || price === null) continue;
    if (params.maxPrice && price > params.maxPrice) continue;

    destinations.push({
      name: dest.name,
      countryName: dest.country,
      skyCode: dest.destination_airport?.code || "",
      skyId: `${dest.destination_airport?.code || ""}-${dest.name}`,
      price,
      directAvailable: dest.number_of_stops === 0,
      imageUrl: dest.thumbnail,
      type: "city",
      avgTemp: getAverageTempForDate(dest.name, params.departDate),
    });
  }

  // Sort by price
  destinations.sort((a, b) => a.price - b.price);

  console.log(`[SerpApi] Found ${destinations.length} destinations`);
  return destinations;
}

// ─── Step 2: Search flights for a specific route ────────────────────

export async function searchFlightsForCity(params: {
  arrivalCode: string;
  departDate: string;
  returnDate: string;
  maxPrice?: number;
}): Promise<FlightDeal[]> {
  const searchParams = new URLSearchParams({
    engine: "google_flights",
    departure_id: LONDON_AIRPORTS,
    arrival_id: params.arrivalCode,
    outbound_date: params.departDate,
    return_date: params.returnDate,
    currency: "GBP",
    type: "1", // round trip
    hl: "en",
    gl: "uk",
    api_key: getApiKey(),
  });

  const url = `${SERPAPI_BASE}?${searchParams}`;
  console.log(`[SerpApi] Searching flights to ${params.arrivalCode}`);

  const response = await fetch(url);
  const data = await response.json();

  if (data.error) {
    console.error("[SerpApi] Flights error:", data.error);
    return [];
  }

  const allFlights = [
    ...(data.best_flights || []),
    ...(data.other_flights || []),
  ];

  const depDate = new Date(params.departDate);
  const retDate = new Date(params.returnDate);
  const nights = Math.round(
    (retDate.getTime() - depDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const deals: FlightDeal[] = [];

  for (const flight of allFlights) {
    const price = flight.price;
    if (!price) continue;
    if (params.maxPrice && price > params.maxPrice) continue;

    const outboundLegs = flight.flights || [];
    if (outboundLegs.length === 0) continue;

    const firstLeg = outboundLegs[0];
    const lastLeg = outboundLegs[outboundLegs.length - 1];

    const depAirport = firstLeg.departure_airport || {};
    const arrAirport = lastLeg.arrival_airport || {};
    const depTime = depAirport.time || "";
    const arrTime = arrAirport.time || "";

    // Apply departure time filters
    if (depTime) {
      const depHour = getHour(depTime);
      const depDay = getDayOfWeek(depTime);

      // Thursday: must be after 8pm
      if (depDay === 4 && depHour < 20) continue;
      // Friday: must be after 6pm
      if (depDay === 5 && depHour < 18) continue;
      // Other days: skip (we only want Thu/Fri departures)
      if (depDay !== 4 && depDay !== 5) continue;
    }

    const totalDuration = flight.total_duration || 0;
    const stops = outboundLegs.length - 1;

    // Build a Skyscanner link as fallback booking link
    const bookingLink = buildSkyscannerLink(
      depAirport.id || "",
      arrAirport.id || "",
      depTime,
      params.returnDate + "T18:00"
    );

    const depDay = depTime ? getDayOfWeek(depTime) : 5;

    deals.push({
      id: `serp-${depAirport.id}-${arrAirport.id}-${depTime}-${price}`,
      flyFrom: depAirport.id || "",
      flyTo: arrAirport.id || "",
      cityFrom: depAirport.name || "London",
      cityTo: arrAirport.name || params.arrivalCode,
      countryTo: "",
      price,
      currency: "GBP",
      departureDate: depTime ? formatDate(depTime) : formatDate(params.departDate),
      returnDate: formatDate(params.returnDate),
      departureTime: depTime ? depTime.slice(11, 16) : "",
      returnTime: "",
      airline: firstLeg.airline || "Unknown",
      airlineLogo: firstLeg.airline_logo || flight.airline_logo || "",
      bookingLink,
      nightsInDest: nights,
      stopovers: stops,
      durationOutbound: formatDuration(totalDuration),
      durationReturn: "",
      departureAirport: `${depAirport.name || ""} (${depAirport.id || ""})`,
      arrivalAirport: `${arrAirport.name || ""} (${arrAirport.id || ""})`,
      departureDay:
        depDay === 4 ? "Thu" : depDay === 5 ? "Fri" : "—",
      provider: "Google Flights",
    });
  }

  // Sort by price
  deals.sort((a, b) => a.price - b.price);

  console.log(`[SerpApi] Found ${deals.length} flights to ${params.arrivalCode}`);
  return deals;
}
