import {
  FlightProvider,
  FlightDeal,
  ProviderRateLimitError,
} from "./types";
import {
  getHeaders,
  formatDuration,
  formatDate,
  getDayOfWeek,
  passesTimeFilter,
  buildSkyscannerLink,
} from "../flight-utils";

const BASE_URL = "https://google-flights2.p.rapidapi.com/api/v1";

// London airports to search from
const LONDON_AIRPORTS = ["LGW", "LHR", "STN", "LTN", "LCY"];

interface GFlight {
  departure_airport: { airport_name: string; airport_code: string; time: string };
  arrival_airport: { airport_name: string; airport_code: string; time: string };
  duration: { raw: number; text: string };
  airline: string;
  airline_logo: string;
  flight_number: string;
}

interface GItinerary {
  departure_time: string;
  arrival_time: string;
  duration: { raw: number; text: string };
  flights: GFlight[];
  price: number;
  stops: number;
}

function parseGoogleTime(timeStr: string): string {
  // Format: "2026-5-15 07:10" -> "2026-05-15T07:10:00"
  const parts = timeStr.split(" ");
  const dateParts = parts[0].split("-");
  const year = dateParts[0];
  const month = dateParts[1].padStart(2, "0");
  const day = dateParts[2].padStart(2, "0");
  return `${year}-${month}-${day}T${parts[1]}:00`;
}

async function searchRoute(
  fromCode: string,
  toCode: string,
  departDate: string,
  returnDate: string
): Promise<GItinerary[]> {
  const searchParams = new URLSearchParams({
    departure_id: fromCode,
    arrival_id: toCode,
    outbound_date: departDate,
    return_date: returnDate,
    adults: "1",
    travel_class: "ECONOMY",
    currency: "GBP",
    country_code: "GB",
    search_type: "best",
  });

  const response = await fetch(`${BASE_URL}/searchFlights?${searchParams}`, {
    headers: getHeaders("google-flights2.p.rapidapi.com"),
  });

  if (!response.ok) {
    const text = await response.text();
    if (
      response.status === 429 ||
      text.includes("exceeded") ||
      text.includes("quota")
    ) {
      throw new ProviderRateLimitError("Google Flights");
    }
    throw new Error(`Google Flights API error ${response.status}: ${text}`);
  }

  const data = await response.json();

  if (
    data?.message &&
    typeof data.message === "string" &&
    (data.message.includes("exceeded") || data.message.includes("quota"))
  ) {
    throw new ProviderRateLimitError("Google Flights");
  }

  if (data?.status === false) {
    // API returned an error — might be bad params, not rate limit
    return [];
  }

  const topFlights = data?.data?.itineraries?.topFlights || [];
  const otherFlights = data?.data?.itineraries?.otherFlights || [];
  return [...topFlights, ...otherFlights];
}

export const googleFlightsProvider: FlightProvider = {
  name: "Google Flights",

  // Google Flights doesn't support "search everywhere" — no searchEverywhere method
  // No searchCountry either

  async searchFlights(params) {
    // Google Flights requires real IATA airport codes, not Skyscanner area codes like "LOND"
    // Always search from the 3 main budget airline London hubs
    const airportsToSearch = ["LGW", "STN", "LTN"];

    const allItineraries: GItinerary[] = [];

    // Search sequentially to avoid burning API calls if we get rate limited
    for (const airport of airportsToSearch) {
      try {
        const itineraries = await searchRoute(
          airport,
          params.toCode,
          params.departDate,
          params.returnDate
        );
        allItineraries.push(
          ...itineraries.map((it) => ({
            ...it,
            _fromAirport: airport,
          }))
        );
      } catch (err) {
        if (err instanceof ProviderRateLimitError) throw err;
        // Skip this airport on error
        console.error(`Google Flights error for ${airport}:`, err);
      }
    }

    const depDate = new Date(params.departDate);
    const retDate = new Date(params.returnDate);
    const nights = Math.round(
      (retDate.getTime() - depDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const deals: FlightDeal[] = [];
    const seen = new Set<string>();

    for (const it of allItineraries) {
      if (!it.flights || it.flights.length === 0) continue;
      if (params.maxPrice && it.price > params.maxPrice) continue;

      const outFlight = it.flights[0];
      const returnFlight = it.flights[it.flights.length - 1];

      const depTimeIso = parseGoogleTime(outFlight.departure_airport.time);
      const retTimeIso = parseGoogleTime(
        returnFlight.arrival_airport.time
      );

      // We need the return leg's departure time, not arrival
      // Google Flights groups outbound+return into one itinerary differently
      // The itinerary shows outbound flights — the return is a separate search
      // Actually, Google Flights returns outbound-only in each itinerary
      // For round trips, each itinerary only shows the outbound leg
      // We can't properly time-filter the return without another call

      // Apply outbound time filter at least
      const depHour = parseInt(depTimeIso.slice(11, 13), 10);
      const depDay = getDayOfWeek(depTimeIso);

      if (depDay === 4 && depHour < 20) continue; // Thu before 8pm
      if (depDay === 5 && depHour < 18) continue; // Fri before 6pm

      const dedupKey = `${outFlight.departure_airport.airport_code}-${outFlight.arrival_airport.airport_code}-${outFlight.departure_airport.time}-${it.price}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      deals.push({
        id: `gf-${dedupKey}`,
        flyFrom: outFlight.departure_airport.airport_code,
        flyTo: outFlight.arrival_airport.airport_code,
        cityFrom: "London",
        cityTo: outFlight.arrival_airport.airport_name.split(" ")[0],
        countryTo: "",
        price: it.price,
        currency: "GBP",
        departureDate: formatDate(depTimeIso),
        returnDate: formatDate(params.returnDate + "T12:00:00"),
        departureTime: depTimeIso.slice(11, 16),
        returnTime: "—",
        airline: outFlight.airline,
        airlineLogo: outFlight.airline_logo,
        bookingLink: buildSkyscannerLink(
          outFlight.departure_airport.airport_code,
          outFlight.arrival_airport.airport_code,
          depTimeIso,
          params.returnDate + "T12:00:00"
        ),
        nightsInDest: nights,
        stopovers: it.stops,
        durationOutbound: it.duration.text,
        durationReturn: "—",
        departureAirport: `${outFlight.departure_airport.airport_name} (${outFlight.departure_airport.airport_code})`,
        arrivalAirport: `${outFlight.arrival_airport.airport_name} (${outFlight.arrival_airport.airport_code})`,
        departureDay:
          depDay === 4
            ? "Thu"
            : depDay === 5
              ? "Fri"
              : "—",
        provider: "Google Flights",
      });
    }

    return deals.sort((a, b) => a.price - b.price);
  },
};
