import { isBankHolidayMonday } from "./bank-holidays";

const BASE_URL = "https://flights-sky.p.rapidapi.com";

// Departure time constraints
const MIN_THURSDAY_HOUR = 20; // After 8pm
const MIN_FRIDAY_HOUR = 18; // After 6pm
const MIN_SUNDAY_RETURN_HOUR = 17; // After 5pm

export interface FlightDeal {
  id: string;
  flyFrom: string;
  flyTo: string;
  cityFrom: string;
  cityTo: string;
  countryTo: string;
  price: number;
  currency: string;
  departureDate: string;
  returnDate: string;
  departureTime: string;
  returnTime: string;
  airline: string;
  airlineLogo: string;
  bookingLink: string;
  nightsInDest: number;
  stopovers: number;
  durationOutbound: string;
  durationReturn: string;
  departureAirport: string;
  arrivalAirport: string;
  departureDay: string; // "Thu" or "Fri"
}

export interface CheapDestination {
  name: string;
  skyCode: string;
  skyId: string;
  price: number;
  directAvailable: boolean;
  imageUrl?: string;
  type: "country" | "city";
}

export interface Weekend {
  thursdayDate: string; // YYYY-MM-DD
  fridayDate: string;
  sundayDate: string;
  mondayDate: string;
  isBankHoliday: boolean;
  label: string;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function formatTime(dateStr: string): string {
  return dateStr.slice(11, 16);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function getHour(dateStr: string): number {
  return parseInt(dateStr.slice(11, 13), 10);
}

function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr).getDay(); // 0=Sun, 1=Mon, ..., 4=Thu, 5=Fri
}

function buildSkyscannerLink(
  fromCode: string,
  toCode: string,
  departDate: string,
  returnDate: string
): string {
  const dep = departDate.slice(0, 10).replace(/-/g, "").slice(2);
  const ret = returnDate.slice(0, 10).replace(/-/g, "").slice(2);
  return `https://www.skyscanner.net/transport/flights/${fromCode.toLowerCase()}/${toCode.toLowerCase()}/${dep}/${ret}/`;
}

function getHeaders(): Record<string, string> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) throw new Error("RAPIDAPI_KEY is not configured");
  return {
    "x-rapidapi-host": "flights-sky.p.rapidapi.com",
    "x-rapidapi-key": apiKey,
  };
}

interface LocationResult {
  id: string;
  type: string;
  content: {
    location: {
      skyCode: string;
      name: string;
      type: string;
    };
    flightQuotes?: {
      cheapest?: { rawPrice: number; direct: boolean };
      direct?: { rawPrice: number; direct: boolean };
    };
    image?: { url: string };
    flightRoutes?: { directFlightsAvailable: boolean };
  };
  skyId: string;
}

function parseLocationResults(
  results: LocationResult[],
  type: "country" | "city"
): CheapDestination[] {
  return results
    .filter((r) => r.type === "LOCATION" && r.content?.flightQuotes?.cheapest)
    .map((r) => ({
      name: r.content.location.name,
      skyCode: r.content.location.skyCode,
      skyId: r.skyId,
      price: r.content.flightQuotes!.cheapest!.rawPrice,
      directAvailable:
        r.content.flightRoutes?.directFlightsAvailable ??
        r.content.flightQuotes?.cheapest?.direct ??
        false,
      imageUrl: r.content.image?.url,
      type,
    }))
    .sort((a, b) => a.price - b.price);
}

export async function searchEverywhere(params: {
  departDate: string;
  returnDate: string;
}): Promise<CheapDestination[]> {
  const searchParams = new URLSearchParams({
    fromEntityId: "LOND",
    departDate: params.departDate,
    returnDate: params.returnDate,
    currency: "GBP",
  });

  const response = await fetch(
    `${BASE_URL}/flights/search-everywhere?${searchParams}`,
    { headers: getHeaders() }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const results = data?.data?.everywhereDestination?.results || [];
  return parseLocationResults(results, "country");
}

export async function searchCountry(params: {
  countryId: string;
  departDate: string;
  returnDate: string;
}): Promise<CheapDestination[]> {
  const searchParams = new URLSearchParams({
    fromEntityId: "LOND",
    toEntityId: params.countryId,
    departDate: params.departDate,
    returnDate: params.returnDate,
    currency: "GBP",
    adults: "1",
  });

  const response = await fetch(
    `${BASE_URL}/flights/search-roundtrip?${searchParams}`,
    { headers: getHeaders() }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const results = data?.data?.countryDestination?.results || [];
  return parseLocationResults(results, "city");
}

interface RoundtripLeg {
  origin: {
    displayCode: string;
    name: string;
    city: string;
  };
  destination: {
    displayCode: string;
    name: string;
    city: string;
    country: string;
  };
  durationInMinutes: number;
  stopCount: number;
  departure: string;
  arrival: string;
  carriers: {
    marketing: Array<{ name: string; logoUrl: string }>;
  };
}

interface RoundtripItinerary {
  id: string;
  price: { raw: number; formatted: string };
  legs: RoundtripLeg[];
}

function passesTimeFilter(itinerary: RoundtripItinerary): boolean {
  if (itinerary.legs.length !== 2) return false;

  const outbound = itinerary.legs[0];
  const returnLeg = itinerary.legs[1];

  // Outbound time check
  const depHour = getHour(outbound.departure);
  const depDay = getDayOfWeek(outbound.departure);

  if (depDay === 4) {
    // Thursday — must be after 8pm
    if (depHour < MIN_THURSDAY_HOUR) return false;
  } else if (depDay === 5) {
    // Friday — must be after 6pm
    if (depHour < MIN_FRIDAY_HOUR) return false;
  }

  // Return time check
  const retHour = getHour(returnLeg.departure);
  const retDay = getDayOfWeek(returnLeg.departure);
  const retDate = returnLeg.departure.slice(0, 10);

  if (retDay === 0) {
    // Sunday — must be after 5pm
    if (retHour < MIN_SUNDAY_RETURN_HOUR) return false;
  } else if (retDay === 1) {
    // Monday — only allowed if bank holiday (no time restriction)
    if (!isBankHolidayMonday(retDate)) return false;
  }

  return true;
}

export async function searchFlights(params: {
  cityId: string;
  departDate: string;
  returnDate: string;
  maxPrice?: number;
  isBankHoliday?: boolean;
}): Promise<FlightDeal[]> {
  // We search Friday → Sunday (or Monday for BH)
  // The API returns flights for that specific date pair
  const searchParams = new URLSearchParams({
    fromEntityId: "LOND",
    toEntityId: params.cityId,
    departDate: params.departDate,
    returnDate: params.returnDate,
    currency: "GBP",
    adults: "1",
  });

  const response = await fetch(
    `${BASE_URL}/flights/search-roundtrip?${searchParams}`,
    { headers: getHeaders() }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const itineraries: RoundtripItinerary[] = data?.data?.itineraries || [];

  const depDate = new Date(params.departDate);
  const retDate = new Date(params.returnDate);
  const nights = Math.round(
    (retDate.getTime() - depDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  return itineraries
    .filter((it) => {
      if (params.maxPrice && it.price.raw > params.maxPrice) return false;
      if (it.legs.length !== 2) return false;
      if (!passesTimeFilter(it)) return false;
      return true;
    })
    .map((it) => {
      const out = it.legs[0];
      const ret = it.legs[1];
      const depDay = getDayOfWeek(out.departure);

      return {
        id: it.id,
        flyFrom: out.origin.displayCode,
        flyTo: out.destination.displayCode,
        cityFrom: out.origin.city,
        cityTo: out.destination.city,
        countryTo: out.destination.country,
        price: it.price.raw,
        currency: "GBP",
        departureDate: formatDate(out.departure),
        returnDate: formatDate(ret.departure),
        departureTime: formatTime(out.departure),
        returnTime: formatTime(ret.departure),
        airline: out.carriers.marketing[0]?.name || "Unknown",
        airlineLogo: out.carriers.marketing[0]?.logoUrl || "",
        bookingLink: buildSkyscannerLink(
          out.origin.displayCode,
          out.destination.displayCode,
          out.departure,
          ret.departure
        ),
        nightsInDest: nights,
        stopovers: out.stopCount,
        durationOutbound: formatDuration(out.durationInMinutes),
        durationReturn: formatDuration(ret.durationInMinutes),
        departureAirport: `${out.origin.name} (${out.origin.displayCode})`,
        arrivalAirport: `${out.destination.name} (${out.destination.displayCode})`,
        departureDay: depDay === 4 ? "Thu" : depDay === 5 ? "Fri" : formatDate(out.departure).split(",")[0],
      };
    })
    .sort((a, b) => a.price - b.price);
}

export function getUpcomingWeekends(weeksAhead: number = 8): Weekend[] {
  const weekends: Weekend[] = [];
  const now = new Date();

  for (let i = 1; i <= weeksAhead; i++) {
    const thursday = new Date(now);
    thursday.setDate(
      now.getDate() + ((4 - now.getDay() + 7) % 7) + (i - 1) * 7
    );
    if (thursday <= now) thursday.setDate(thursday.getDate() + 7);

    const friday = new Date(thursday);
    friday.setDate(thursday.getDate() + 1);

    const sunday = new Date(thursday);
    sunday.setDate(thursday.getDate() + 3);

    const monday = new Date(thursday);
    monday.setDate(thursday.getDate() + 4);

    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const mondayStr = fmt(monday);
    const bankHol = isBankHolidayMonday(mondayStr);

    const endDay = bankHol ? monday : sunday;
    const label = `${thursday.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${endDay.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;

    weekends.push({
      thursdayDate: fmt(thursday),
      fridayDate: fmt(friday),
      sundayDate: fmt(sunday),
      mondayDate: mondayStr,
      isBankHoliday: bankHol,
      label,
    });
  }

  return weekends;
}
