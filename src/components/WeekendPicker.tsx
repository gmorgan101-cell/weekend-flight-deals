"use client";

interface Weekend {
  thursdayDate: string;
  fridayDate: string;
  sundayDate: string;
  mondayDate: string;
  isBankHoliday: boolean;
  label: string;
}

interface WeekendPickerProps {
  weekends: Weekend[];
  selected: number;
  onSelect: (index: number) => void;
}

export default function WeekendPicker({
  weekends,
  selected,
  onSelect,
}: WeekendPickerProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {weekends.map((w, i) => (
        <button
          key={i}
          onClick={() => onSelect(i)}
          className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors relative ${
            selected === i
              ? w.isBankHoliday
                ? "bg-amber-500 text-white"
                : "bg-blue-600 text-white"
              : w.isBankHoliday
                ? "bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-2 border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                : "bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600"
          }`}
        >
          <span className="flex items-center gap-1.5">
            {w.isBankHoliday && <span className="text-xs">🏖️</span>}
            {w.label}
          </span>
        </button>
      ))}
    </div>
  );
}
