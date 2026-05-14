"use client";

interface Destination {
  name: string;
  countryName?: string;
  skyCode: string;
  skyId: string;
  price: number;
  directAvailable: boolean;
  imageUrl?: string;
  avgTemp?: number | null;
}

export default function DestinationCard({
  destination,
  onSelect,
}: {
  destination: Destination;
  onSelect: (skyId: string, name: string) => void;
}) {
  const temp = destination.avgTemp;

  return (
    <button
      onClick={() => onSelect(destination.skyId, destination.name)}
      className="group relative overflow-hidden rounded-2xl shadow-sm active:scale-[0.98] transition-transform text-left w-full"
    >
      {/* Image */}
      <div className="aspect-[16/10] bg-gray-200 dark:bg-slate-700 overflow-hidden">
        {destination.imageUrl ? (
          <img
            src={destination.imageUrl}
            alt={destination.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-400 to-blue-600" />
        )}
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white leading-tight truncate">
              {destination.name}
            </h3>
            {destination.countryName && (
              <p className="text-xs text-white/70 mt-0.5">
                {destination.countryName}
              </p>
            )}
            <div className="flex items-center gap-1.5 mt-1.5">
              {destination.directAvailable && (
                <span className="text-[10px] font-semibold bg-white/20 backdrop-blur-sm text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                  Direct
                </span>
              )}
              {temp !== null && temp !== undefined && (
                <span className="text-[10px] font-semibold bg-amber-400/30 backdrop-blur-sm text-amber-100 px-1.5 py-0.5 rounded-full">
                  ☀️ {temp}°C
                </span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] text-white/60">from</p>
            <p className="text-lg font-bold text-emerald-400 leading-tight">
              £{Math.round(destination.price)}
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}
