"use client";

import { FlightDeal } from "@/lib/providers/types";

export default function FlightCard({ flight }: { flight: FlightDeal }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
      {/* Header: airline + price */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 dark:border-slate-700">
        <div className="flex items-center gap-2.5">
          {flight.airlineLogo && (
            <img
              src={flight.airlineLogo}
              alt={flight.airline}
              className="w-6 h-6 rounded"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
            {flight.airline}
          </span>
        </div>
        <div className="text-right">
          <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
            £{flight.price}
          </span>
          <span className="text-[10px] text-gray-500 dark:text-slate-400 block">return</span>
        </div>
      </div>

      {/* Flight details */}
      <div className="px-4 py-3 space-y-2.5">
        {/* Outbound */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase">Out</span>
              <span className="text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-semibold">
                {flight.departureDay} {flight.departureTime}
              </span>
            </div>
            <p className="text-xs text-gray-600 dark:text-slate-400 mt-0.5">
              {flight.departureAirport}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-900 dark:text-white font-medium">{flight.departureDate}</p>
            <p className="text-[10px] text-gray-500 dark:text-slate-400">{flight.durationOutbound}</p>
          </div>
        </div>

        {/* Return */}
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase">Ret</span>
            <p className="text-xs text-gray-600 dark:text-slate-400 mt-0.5">
              {flight.arrivalAirport}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-900 dark:text-white font-medium">{flight.returnDate}</p>
            <p className="text-[10px] text-gray-500 dark:text-slate-400">{flight.durationReturn}</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-slate-700/50 border-t border-gray-100 dark:border-slate-700">
        <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-slate-400">
          <span>{flight.nightsInDest} nights</span>
          <span className="w-0.5 h-0.5 bg-gray-300 dark:bg-slate-500 rounded-full" />
          <span>
            {flight.stopovers === 0
              ? "Direct"
              : `${flight.stopovers} stop${flight.stopovers > 1 ? "s" : ""}`}
          </span>
        </div>
        <a
          href={flight.bookingLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg active:bg-blue-700 transition-colors"
        >
          Book
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </div>
  );
}
