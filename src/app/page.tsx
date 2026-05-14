"use client";

import { useState, useEffect, useCallback } from "react";
import DestinationCard from "@/components/DestinationCard";
import WeekendPicker from "@/components/WeekendPicker";
import ThemeToggle from "@/components/ThemeToggle";
import { FlightDeal } from "@/lib/providers/types";

interface Weekend {
  thursdayDate: string;
  fridayDate: string;
  sundayDate: string;
  mondayDate: string;
  isBankHoliday: boolean;
  label: string;
}

interface Destination {
  name: string;
  countryName?: string;
  skyCode: string;
  skyId: string;
  price: number;
  directAvailable: boolean;
  imageUrl?: string;
  type: "country" | "city";
  avgTemp?: number | null;
}

interface Attraction {
  title: string;
  rating: number | null;
  reviews: number | null;
  description: string;
  thumbnail: string;
}

type SortMode = "price" | "temp";

type View =
  | { level: "destinations" }
  | {
      level: "city";
      cityId: string;
      cityName: string;
      countryName: string;
      imageUrl?: string;
      avgTemp?: number | null;
      price: number;
      directAvailable: boolean;
      airportCode: string;
    };

function isBankHolidayMonday(dateStr: string): boolean {
  const bankHolidays = new Set([
    "2025-01-01","2025-04-18","2025-04-21","2025-05-05","2025-05-26",
    "2025-08-25","2025-12-25","2025-12-26",
    "2026-01-01","2026-04-03","2026-04-06","2026-05-04","2026-05-25",
    "2026-08-31","2026-12-25","2026-12-28",
    "2027-01-01","2027-03-26","2027-03-29","2027-05-03","2027-05-31",
    "2027-08-30","2027-12-27","2027-12-28",
  ]);
  const d = new Date(dateStr);
  return d.getDay() === 1 && bankHolidays.has(dateStr);
}

function getUpcomingWeekends(weeksAhead: number = 8): Weekend[] {
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

function formatReviewCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.3;
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          className={`w-3 h-3 ${
            i < full
              ? "text-amber-400"
              : i === full && half
                ? "text-amber-300"
                : "text-gray-200 dark:text-slate-600"
          }`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  );
}

export default function Home() {
  const [weekends] = useState(() => getUpcomingWeekends(12));
  const [selectedWeekend, setSelectedWeekend] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState(150);
  const [sortMode, setSortMode] = useState<SortMode>("price");
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [flights, setFlights] = useState<FlightDeal[]>([]);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [view, setView] = useState<View>({ level: "destinations" });
  const [loading, setLoading] = useState(false);
  const [loadingFlights, setLoadingFlights] = useState(false);
  const [loadingCity, setLoadingCity] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFlights, setShowFlights] = useState(false);

  const weekend = selectedWeekend !== null ? weekends[selectedWeekend] : null;
  const searchDepartDate = weekend?.fridayDate;
  const searchReturnDate = weekend?.isBankHoliday
    ? weekend.mondayDate
    : weekend?.sundayDate;

  // ─── Step 1: Load destinations ───────────────────────────────────
  const loadAllCities = useCallback(async () => {
    if (!searchDepartDate || !searchReturnDate) return;
    setLoading(true);
    setError(null);
    setView({ level: "destinations" });
    setFlights([]);
    setAttractions([]);
    setShowFlights(false);

    try {
      const params = new URLSearchParams({
        departDate: searchDepartDate,
        returnDate: searchReturnDate,
        maxPrice: String(maxPrice),
      });
      const res = await fetch(`/api/flights?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setDestinations(data.destinations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setDestinations([]);
    } finally {
      setLoading(false);
    }
  }, [searchDepartDate, searchReturnDate, maxPrice]);

  // ─── Step 2: Load city info + flights ────────────────────────────
  const loadCityDetail = useCallback(
    async (dest: Destination) => {
      if (!searchDepartDate || !searchReturnDate) return;
      const airportCode = dest.skyCode || dest.skyId.split("-")[0];

      setView({
        level: "city",
        cityId: dest.skyId,
        cityName: dest.name,
        countryName: dest.countryName || "",
        imageUrl: dest.imageUrl,
        avgTemp: dest.avgTemp,
        price: dest.price,
        directAvailable: dest.directAvailable,
        airportCode,
      });
      setFlights([]);
      setAttractions([]);
      setShowFlights(false);
      setError(null);

      // Load TripAdvisor attractions and flights in parallel
      setLoadingCity(true);
      setLoadingFlights(true);

      // TripAdvisor
      fetch(`/api/city?city=${encodeURIComponent(dest.name)}&country=${encodeURIComponent(dest.countryName || "")}`)
        .then((res) => res.json())
        .then((data) => setAttractions(data.attractions || []))
        .catch(() => setAttractions([]))
        .finally(() => setLoadingCity(false));

      // Flights
      const flightParams = new URLSearchParams({
        departDate: searchDepartDate,
        returnDate: searchReturnDate,
        city: airportCode,
        maxPrice: String(maxPrice),
      });
      fetch(`/api/flights?${flightParams}`)
        .then((res) => res.json())
        .then((data) => setFlights(data.flights || []))
        .catch(() => setFlights([]))
        .finally(() => setLoadingFlights(false));
    },
    [searchDepartDate, searchReturnDate, maxPrice]
  );

  useEffect(() => {
    if (selectedWeekend !== null) {
      loadAllCities();
    }
  }, [selectedWeekend, loadAllCities]);

  const handleWeekendSelect = (i: number) => {
    setSelectedWeekend(i);
    setView({ level: "destinations" });
    setFlights([]);
    setDestinations([]);
    setAttractions([]);
  };

  const handleDestinationSelect = (skyId: string, _name: string) => {
    const dest = destinations.find((d) => d.skyId === skyId);
    if (dest) loadCityDetail(dest);
  };

  // Sort destinations
  const sortedDestinations = [...destinations].sort((a, b) => {
    if (sortMode === "temp") {
      return (b.avgTemp ?? -99) - (a.avgTemp ?? -99);
    }
    return a.price - b.price;
  });

  const isCity = view.level === "city";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 sticky top-0 z-20">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {isCity ? (
              <button
                onClick={loadAllCities}
                className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 font-medium active:text-blue-800 dark:active:text-blue-300"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
            ) : (
              <h1 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Weekend Flights
              </h1>
            )}
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <p className="text-[10px] text-gray-400 dark:text-slate-500 text-right leading-tight">
                All London airports<br />LGW LHR STN LTN LCY
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* ═══════════ STEP 1: Destinations ═══════════ */}
      {!isCity && (
        <main className="max-w-lg mx-auto px-4 py-4 space-y-4 pb-20">
          {/* Weekend picker + budget */}
          <section className="space-y-3">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              Choose weekend
            </h2>
            <WeekendPicker
              weekends={weekends}
              selected={selectedWeekend ?? -1}
              onSelect={handleWeekendSelect}
            />
            <div className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-xl px-3 py-2.5 border border-gray-100 dark:border-slate-700">
              <span className="text-xs text-gray-500 dark:text-slate-400 shrink-0">Budget</span>
              <input
                type="range"
                min={50}
                max={300}
                step={10}
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="flex-1 accent-blue-600 h-1"
              />
              <span className="text-sm font-bold text-gray-900 dark:text-white w-10 text-right">
                £{maxPrice}
              </span>
            </div>
            <div className="flex gap-2 text-[10px] text-gray-400 dark:text-slate-500 overflow-x-auto">
              <span className="shrink-0 bg-gray-50 dark:bg-slate-800 px-2 py-1 rounded-full">Thu 8pm+</span>
              <span className="shrink-0 bg-gray-50 dark:bg-slate-800 px-2 py-1 rounded-full">Fri 6pm+</span>
              <span className="shrink-0 bg-gray-50 dark:bg-slate-800 px-2 py-1 rounded-full">Sun 5pm+ return</span>
            </div>
          </section>

          {/* Empty state */}
          {selectedWeekend === null && !loading && (
            <div className="text-center py-20 text-gray-400 dark:text-slate-500">
              <svg className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm font-medium">Pick a weekend to get started</p>
              <p className="text-xs mt-1">We'll find destinations within your budget</p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="text-center py-20">
              <div className="inline-flex items-center gap-2 text-gray-500 dark:text-slate-400 text-sm">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Finding destinations...
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300">
              <p className="font-medium">Something went wrong</p>
              <p className="text-xs mt-1">{error}</p>
            </div>
          )}

          {/* Results + sort */}
          {!loading && !error && destinations.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {destinations.length} destination{destinations.length !== 1 ? "s" : ""}
                </p>
                <div className="flex bg-gray-100 dark:bg-slate-700 rounded-lg p-0.5">
                  <button
                    onClick={() => setSortMode("price")}
                    className={`text-xs px-3 py-1 rounded-md font-medium transition-colors ${
                      sortMode === "price" ? "bg-white dark:bg-slate-600 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-slate-400"
                    }`}
                  >
                    Price
                  </button>
                  <button
                    onClick={() => setSortMode("temp")}
                    className={`text-xs px-3 py-1 rounded-md font-medium transition-colors ${
                      sortMode === "temp" ? "bg-white dark:bg-slate-600 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-slate-400"
                    }`}
                  >
                    Warmest
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sortedDestinations.map((dest) => (
                  <DestinationCard
                    key={dest.skyId}
                    destination={dest}
                    onSelect={handleDestinationSelect}
                  />
                ))}
              </div>
            </>
          )}

          {/* No results */}
          {!loading && !error && selectedWeekend !== null && destinations.length === 0 && (
            <div className="text-center py-20 text-gray-500 dark:text-slate-400">
              <p className="text-sm font-medium">No destinations found</p>
              <p className="text-xs mt-1">Try increasing your budget</p>
            </div>
          )}
        </main>
      )}

      {/* ═══════════ STEP 2: City Detail ═══════════ */}
      {isCity && view.level === "city" && (
        <>
          <main className="max-w-lg mx-auto pb-24">
            {/* Hero image */}
            <div className="relative h-48 bg-gray-200 dark:bg-slate-700 overflow-hidden">
              {view.imageUrl ? (
                <img
                  src={view.imageUrl}
                  alt={view.cityName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-400 to-blue-600" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h2 className="text-2xl font-bold text-white">{view.cityName}</h2>
                <p className="text-sm text-white/80">{view.countryName}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  {view.directAvailable && (
                    <span className="text-[10px] font-semibold bg-white/20 backdrop-blur-sm text-white px-2 py-0.5 rounded-full uppercase tracking-wide">
                      Direct flights
                    </span>
                  )}
                  {view.avgTemp !== null && view.avgTemp !== undefined && (
                    <span className="text-[10px] font-semibold bg-amber-400/30 backdrop-blur-sm text-amber-100 px-2 py-0.5 rounded-full">
                      ☀️ {view.avgTemp}°C avg
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Things to do */}
            <div className="px-4 py-4 space-y-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                Things to do
              </h3>

              {loadingCity && (
                <div className="flex items-center gap-2 text-gray-400 dark:text-slate-500 text-xs py-6 justify-center">
                  <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading attractions...
                </div>
              )}

              {!loadingCity && attractions.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-slate-500 py-4 text-center">
                  No attraction info available
                </p>
              )}

              {!loadingCity && attractions.length > 0 && (
                <div className="space-y-2.5">
                  {attractions.map((att, i) => (
                    <div
                      key={i}
                      className="flex gap-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-2.5 overflow-hidden"
                    >
                      {att.thumbnail && (
                        <img
                          src={att.thumbnail}
                          alt={att.title}
                          className="w-16 h-16 rounded-lg object-cover shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {att.title}
                        </h4>
                        {att.rating && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <StarRating rating={att.rating} />
                            {att.reviews && (
                              <span className="text-[10px] text-gray-400 dark:text-slate-500">
                                {formatReviewCount(att.reviews)}
                              </span>
                            )}
                          </div>
                        )}
                        {att.description && (
                          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                            {att.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Flights section */}
              {showFlights && (
                <div className="pt-4 space-y-3">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                    Available flights
                  </h3>

                  {loadingFlights && (
                    <div className="flex items-center gap-2 text-gray-400 dark:text-slate-500 text-xs py-6 justify-center">
                      <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Searching flights...
                    </div>
                  )}

                  {!loadingFlights && flights.length === 0 && (
                    <p className="text-xs text-gray-400 dark:text-slate-500 py-4 text-center">
                      No flights match your schedule
                    </p>
                  )}

                  {!loadingFlights &&
                    flights.map((flight) => (
                      <div
                        key={flight.id}
                        className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden"
                      >
                        {/* Airline + price */}
                        <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-50 dark:border-slate-700">
                          <div className="flex items-center gap-2">
                            {flight.airlineLogo && (
                              <img
                                src={flight.airlineLogo}
                                alt={flight.airline}
                                className="w-5 h-5 rounded"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                }}
                              />
                            )}
                            <span className="text-xs font-medium text-gray-700 dark:text-slate-300">
                              {flight.airline}
                            </span>
                          </div>
                          <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                            £{flight.price}
                          </span>
                        </div>

                        {/* Details */}
                        <div className="px-3 py-2.5 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-semibold text-[10px]">
                                {flight.departureDay} {flight.departureTime}
                              </span>
                              <span className="text-gray-500 dark:text-slate-400">{flight.departureAirport}</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-slate-500">
                            <span>{flight.durationOutbound}</span>
                            <span>
                              {flight.stopovers === 0 ? "Direct" : `${flight.stopovers} stop`} · {flight.nightsInDest} nights
                            </span>
                          </div>
                        </div>

                        {/* Book button */}
                        <div className="px-3 py-2 bg-gray-50 dark:bg-slate-700/50 border-t border-gray-100 dark:border-slate-700">
                          <a
                            href={flight.bookingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full text-center px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg active:bg-blue-700 transition-colors"
                          >
                            Book for £{flight.price} →
                          </a>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </main>

          {/* Sticky bottom bar */}
          {!showFlights && (
            <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 z-20">
              <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Flights from</p>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    £{view.price}
                    <span className="text-xs font-normal text-gray-400 dark:text-slate-500 ml-1">return</span>
                  </p>
                </div>
                <button
                  onClick={() => setShowFlights(true)}
                  className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl active:bg-blue-700 transition-colors flex items-center gap-1.5"
                >
                  See flights
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
