// UK (England & Wales) Bank Holidays 2025–2027
// Source: gov.uk/bank-holidays
const BANK_HOLIDAYS: string[] = [
  // 2025
  "2025-01-01", // New Year's Day
  "2025-04-18", // Good Friday
  "2025-04-21", // Easter Monday
  "2025-05-05", // Early May bank holiday
  "2025-05-26", // Spring bank holiday
  "2025-08-25", // Summer bank holiday
  "2025-12-25", // Christmas Day
  "2025-12-26", // Boxing Day

  // 2026
  "2026-01-01", // New Year's Day
  "2026-04-03", // Good Friday
  "2026-04-06", // Easter Monday
  "2026-05-04", // Early May bank holiday
  "2026-05-25", // Spring bank holiday
  "2026-08-31", // Summer bank holiday
  "2026-12-25", // Christmas Day
  "2026-12-28", // Boxing Day (substitute)

  // 2027
  "2027-01-01", // New Year's Day
  "2027-03-26", // Good Friday
  "2027-03-29", // Easter Monday
  "2027-05-03", // Early May bank holiday
  "2027-05-31", // Spring bank holiday
  "2027-08-30", // Summer bank holiday
  "2027-12-27", // Christmas Day (substitute)
  "2027-12-28", // Boxing Day (substitute)
];

const holidaySet = new Set(BANK_HOLIDAYS);

export function isBankHoliday(dateStr: string): boolean {
  return holidaySet.has(dateStr);
}

export function isBankHolidayMonday(dateStr: string): boolean {
  const d = new Date(dateStr);
  return d.getDay() === 1 && holidaySet.has(dateStr);
}
