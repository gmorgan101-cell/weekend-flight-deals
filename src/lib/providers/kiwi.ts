import {
  FlightProvider,
  FlightDeal,
  ProviderRateLimitError,
} from "./types";
import {
  getHeaders,
  formatDate,
  getDayOfWeek,
  getHour,
  buildSkyscannerLink,
} from "../flight-utils";
import { isBankHolidayMonday } from "../bank-holidays";

const BASE_URL = "https://kiwi-com-cheap-flights.p.rapidapi.com";
const HOST = "kiwi-com-cheap-flights.p.rapidapi.com";

interface KiwiSegment {
  source: {
    localTime: string;
    station: {
      code: string;
      name: string;
      city: { name: string; legacyId: string };
      country: { code: string };
    };
  };
  destination: {
    localTime: string;
    station: {
      code: string;
      name: string;
      city: { name: string; legacyId: string };
      country: { code: string };
    };
  };
  duration: number | null;
  carrier?: { name: string; code: string };
}

interface KiwiSector {
  sectorSegments: Array<{ segment: KiwiSegment }>;
}

interface KiwiOneWayItinerary {
  id: string;
  price: { amount: string };
  outbound: KiwiSector;
  bookingOptions?: {
    edges: Array<{ node: { bookingUrl: string } }>;
  };
}

async function fetchKiwi(url: string): Promise<any> {
  const headers = getHeaders(HOST, "RAPIDAPI_KEY_KIWI");
  headers["Content-Type"] = "application/json";

  const response = await fetch(url, { headers });

  if (!response.ok) {
    const text = await response.text();
    if (
      response.status === 429 ||
      text.includes("exceeded") ||
      text.includes("quota") ||
      text.includes("MONTHLY")
    ) {
      throw new ProviderRateLimitError("Kiwi");
    }
    throw new Error(`Kiwi API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  if (
    data?.message &&
    typeof data.message === "string" &&
    (data.message.includes("exceeded") || data.message.includes("quota"))
  ) {
    throw new ProviderRateLimitError("Kiwi");
  }

  return data;
}

function getDurationMinutes(seg: KiwiSegment): number {
  if (seg.duration) return Math.round(seg.duration / 60);
  const dep = new Date(seg.source.localTime).getTime();
  const arr = new Date(seg.destination.localTime).getTime();
  return Math.round((arr - dep) / 60000);
}

function formatDurationMins(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

interface OnewayFlight {
  depTime: string;
  depDate: string;
  depHour: number;
  depDay: number;
  fromCode: string;
  toCode: string;
  fromName: string;
  toName: string;
  cityFrom: string;
  cityTo: string;
  countryTo: string;
  airline: string;
  duration: string;
  durationMins: number;
  stops: number;
  price: number;
  airportFrom: string;
  airportTo: string;
}

function parseOneWayResults(
  data: any,
  targetDate: string
): OnewayFlight[] {
  const itineraries = data?.itineraries || [];
  const flights: OnewayFlight[] = [];

  for (const it of itineraries) {
    // One-way endpoint uses "sector", round-trip uses "outbound"
    const sector = it.sector || it.outbound;
    const segs = sector?.sectorSegments;
    if (!segs?.length) continue;

    const seg = segs[0].segment;
    const depTime = seg.source.localTime;
    const depDate = depTime.slice(0, 10);

    // Only keep flights on the target date
    if (depDate !== targetDate) continue;

    const depHour = getHour(depTime);
    const depDay = getDayOfWeek(depTime);
    const duration = getDurationMinutes(seg);

    flights.push({
      depTime,
      depDate,
      depHour,
      depDay,
      fromCode: seg.source.station.code,
      toCode: seg.destination.station.code,
      fromName: seg.source.station.name,
      toName: seg.destination.station.name,
      cityFrom: seg.source.station.city.name,
      cityTo: seg.destination.station.city.name,
      countryTo: seg.destination.station.country.code,
      airline: seg.carrier?.name || "Unknown",
      duration: formatDurationMins(duration),
      durationMins: duration,
      stops: segs.length - 1,
      price: parseFloat(it.price.amount),
      airportFrom: `${seg.source.station.name} (${seg.source.station.code})`,
      airportTo: `${seg.destination.station.name} (${seg.destination.station.code})`,
    });
  }

  return flights;
}

export const kiwiProvider: FlightProvider = {
  name: "Kiwi",

  async searchFlights(params) {
    // Kiwi's round-trip endpoint mixes dates from different weeks.
    // Instead, we do two one-way searches and combine the cheapest pairs.
    // This costs 2 API calls but gives us exact date control.

    const depDay = getDayOfWeek(params.departDate + "T12:00:00");
    const retDay = getDayOfWeek(params.returnDate + "T12:00:00");

    // Determine which days to search for outbound (Thu/Fri)
    const outboundDayName = depDay === 4 ? "THURSDAY" : "FRIDAY";
    // Determine which days to search for return (Sun/Mon)
    const inboundDayName = retDay === 1 ? "MONDAY" : "SUNDAY";

    // Also search Thu if depart is Fri (we accept Thu after 8pm too)
    const outboundDays =
      depDay === 5 ? "THURSDAY,FRIDAY" : outboundDayName;

    const searchBase = new URLSearchParams({
      source: `City:${params.fromCode === "LOND" ? "london_gb" : params.fromCode}`,
      destination: `City:${params.toCode}`,
      currency: "gbp",
      locale: "en",
      adults: "1",
      children: "0",
      infants: "0",
      cabinClass: "ECONOMY",
      sortBy: "PRICE",
      sortOrder: "ASCENDING",
      limit: "50",
      transportTypes: "FLIGHT",
      contentProviders: "KIWI",
    });

    // Search outbound one-way
    const outParams = new URLSearchParams(searchBase);
    outParams.set("outbound", outboundDays);

    // Search return one-way (swap source and destination)
    const retParams = new URLSearchParams({
      source: `City:${params.toCode}`,
      destination: `City:${params.fromCode === "LOND" ? "london_gb" : params.fromCode}`,
      currency: "gbp",
      locale: "en",
      adults: "1",
      children: "0",
      infants: "0",
      cabinClass: "ECONOMY",
      sortBy: "PRICE",
      sortOrder: "ASCENDING",
      limit: "50",
      transportTypes: "FLIGHT",
      contentProviders: "KIWI",
      outbound: "SUNDAY,MONDAY",
    });

    // Run both searches in parallel
    const [outData, retData] = await Promise.all([
      fetchKiwi(`${BASE_URL}/one-way?${outParams}`),
      fetchKiwi(`${BASE_URL}/one-way?${retParams}`),
    ]);

    // Parse results, filtering to target dates
    // For outbound: accept target Friday date, or the Thursday before
    const targetFri = params.departDate;
    const targetThu = new Date(params.departDate);
    targetThu.setDate(targetThu.getDate() - (depDay === 5 ? 1 : 0));
    const targetThuStr = targetThu.toISOString().slice(0, 10);

    // For return: accept target Sunday, or Monday if bank holiday
    const targetSun = params.returnDate;
    const targetMon = new Date(params.returnDate);
    targetMon.setDate(targetMon.getDate() + 1);
    const targetMonStr = targetMon.toISOString().slice(0, 10);

    // Get outbound flights on target dates
    let outFlights = [
      ...parseOneWayResults(outData, targetFri),
      ...(depDay === 5
        ? parseOneWayResults(outData, targetThuStr)
        : []),
    ];

    // Get return flights on target dates
    let retFlights = [
      ...parseOneWayResults(retData, targetSun),
      ...(isBankHolidayMonday(targetMonStr)
        ? parseOneWayResults(retData, targetMonStr)
        : []),
    ];


    // Apply time constraints
    outFlights = outFlights.filter((f) => {
      if (f.depDay === 4 && f.depHour < 20) return false; // Thu before 8pm
      if (f.depDay === 5 && f.depHour < 18) return false; // Fri before 6pm
      return true;
    });

    retFlights = retFlights.filter((f) => {
      if (f.depDay === 0 && f.depHour < 17) return false; // Sun before 5pm
      if (f.depDay === 1 && !isBankHolidayMonday(f.depDate)) return false;
      return true;
    });

    if (outFlights.length === 0 || retFlights.length === 0) return [];

    // Combine: pair each outbound with the cheapest compatible return
    const depDate = new Date(params.departDate);
    const retDate = new Date(params.returnDate);
    const nights = Math.round(
      (retDate.getTime() - depDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const deals: FlightDeal[] = [];

    for (const out of outFlights) {
      for (const ret of retFlights) {
        const totalPrice = Math.round(out.price + ret.price);
        if (params.maxPrice && totalPrice > params.maxPrice) continue;

        const bookingLink = buildSkyscannerLink(
          out.fromCode,
          out.toCode,
          out.depTime,
          ret.depTime
        );

        deals.push({
          id: `kiwi-${out.fromCode}-${out.toCode}-${out.depTime}-${ret.depTime}`,
          flyFrom: out.fromCode,
          flyTo: out.toCode,
          cityFrom: out.cityFrom,
          cityTo: out.cityTo,
          countryTo: out.countryTo,
          price: totalPrice,
          currency: "GBP",
          departureDate: formatDate(out.depTime),
          returnDate: formatDate(ret.depTime),
          departureTime: out.depTime.slice(11, 16),
          returnTime: ret.depTime.slice(11, 16),
          airline: out.airline,
          airlineLogo: "",
          bookingLink,
          nightsInDest: nights,
          stopovers: out.stops,
          durationOutbound: out.duration,
          durationReturn: ret.duration,
          departureAirport: out.airportFrom,
          arrivalAirport: out.airportTo,
          departureDay:
            out.depDay === 4 ? "Thu" : out.depDay === 5 ? "Fri" : "—",
          arrivalTime: "",
          provider: "Kiwi",
        });
      }
    }

    // Sort by price and return top results (limit combinatorial explosion)
    return deals.sort((a, b) => a.price - b.price).slice(0, 15);
  },
};
