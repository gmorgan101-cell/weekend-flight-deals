import {
  FlightProvider,
  FlightDeal,
  CheapDestination,
  ProviderRateLimitError,
} from "./types";
import { isBankHolidayMonday } from "../bank-holidays";
import { getHeaders, formatDuration, formatTime, formatDate, getHour, getDayOfWeek, buildSkyscannerLink, passesTimeFilter } from "../flight-utils";

const BASE_URL = "https://flights-sky.p.rapidapi.com";

interface LocationResult {
  id: string;
  type: string;
  content: {
    location: { skyCode: string; name: string; type: string };
    flightQuotes?: {
      cheapest?: { rawPrice: number; direct: boolean };
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

async function fetchWithRateLimit(url: string): Promise<Response> {
  const response = await fetch(url, {
    headers: getHeaders("flights-sky.p.rapidapi.com"),
  });

  if (!response.ok) {
    const text = await response.text();
    if (
      response.status === 429 ||
      text.includes("exceeded") ||
      text.includes("quota")
    ) {
      throw new ProviderRateLimitError("Sky Scrapper");
    }
    throw new Error(`Sky Scrapper API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  if (
    data?.message &&
    typeof data.message === "string" &&
    (data.message.includes("exceeded") || data.message.includes("quota"))
  ) {
    throw new ProviderRateLimitError("Sky Scrapper");
  }

  return data;
}

export const skyScrapperProvider: FlightProvider = {
  name: "Sky Scrapper",

  async searchEverywhere(params) {
    const searchParams = new URLSearchParams({
      fromEntityId: "LOND",
      departDate: params.departDate,
      returnDate: params.returnDate,
      currency: "GBP",
    });

    const data = (await fetchWithRateLimit(
      `${BASE_URL}/flights/search-everywhere?${searchParams}`
    )) as any;

    const results = data?.data?.everywhereDestination?.results || [];
    return parseLocationResults(results, "country");
  },

  async searchCountry(params) {
    const searchParams = new URLSearchParams({
      fromEntityId: "LOND",
      toEntityId: params.countryId,
      departDate: params.departDate,
      returnDate: params.returnDate,
      currency: "GBP",
      adults: "1",
    });

    const data = (await fetchWithRateLimit(
      `${BASE_URL}/flights/search-roundtrip?${searchParams}`
    )) as any;

    const results = data?.data?.countryDestination?.results || [];
    return parseLocationResults(results, "city");
  },

  async searchFlights(params) {
    const searchParams = new URLSearchParams({
      fromEntityId: "LOND",
      toEntityId: params.toCode,
      departDate: params.departDate,
      returnDate: params.returnDate,
      currency: "GBP",
      adults: "1",
    });

    const data = (await fetchWithRateLimit(
      `${BASE_URL}/flights/search-roundtrip?${searchParams}`
    )) as any;

    const itineraries = data?.data?.itineraries || [];
    const depDate = new Date(params.departDate);
    const retDate = new Date(params.returnDate);
    const nights = Math.round(
      (retDate.getTime() - depDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    return itineraries
      .filter((it: any) => {
        if (params.maxPrice && it.price.raw > params.maxPrice) return false;
        if (it.legs.length !== 2) return false;
        return passesTimeFilter(it.legs[0].departure, it.legs[1].departure);
      })
      .map((it: any) => {
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
          departureDay:
            depDay === 4
              ? "Thu"
              : depDay === 5
                ? "Fri"
                : formatDate(out.departure).split(",")[0],
          arrivalTime: "",
          provider: "Sky Scrapper",
        };
      })
      .sort((a: FlightDeal, b: FlightDeal) => a.price - b.price);
  },
};
