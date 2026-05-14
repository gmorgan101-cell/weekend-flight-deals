import { isBankHolidayMonday } from "./bank-holidays";

// Departure time constraints
const MIN_THURSDAY_HOUR = 20; // After 8pm
const MIN_FRIDAY_HOUR = 18; // After 6pm
const MIN_SUNDAY_RETURN_HOUR = 17; // After 5pm

export function getHeaders(host: string, apiKeyEnv?: string): Record<string, string> {
  const envVar = apiKeyEnv || "RAPIDAPI_KEY";
  const apiKey = process.env[envVar];
  if (!apiKey) throw new Error(`${envVar} is not configured`);
  return {
    "x-rapidapi-host": host,
    "x-rapidapi-key": apiKey,
  };
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

export function formatTime(dateStr: string): string {
  return dateStr.slice(11, 16);
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function getHour(dateStr: string): number {
  return parseInt(dateStr.slice(11, 13), 10);
}

export function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr).getDay();
}

export function buildSkyscannerLink(
  fromCode: string,
  toCode: string,
  departDate: string,
  returnDate: string
): string {
  const dep = departDate.slice(0, 10).replace(/-/g, "").slice(2);
  const ret = returnDate.slice(0, 10).replace(/-/g, "").slice(2);
  return `https://www.skyscanner.net/transport/flights/${fromCode.toLowerCase()}/${toCode.toLowerCase()}/${dep}/${ret}/`;
}

export function passesTimeFilter(
  outboundDeparture: string,
  returnDeparture: string
): boolean {
  // Outbound time check
  const depHour = getHour(outboundDeparture);
  const depDay = getDayOfWeek(outboundDeparture);

  if (depDay === 4) {
    // Thursday — must be after 8pm
    if (depHour < MIN_THURSDAY_HOUR) return false;
  } else if (depDay === 5) {
    // Friday — must be after 6pm
    if (depHour < MIN_FRIDAY_HOUR) return false;
  }

  // Return time check
  const retHour = getHour(returnDeparture);
  const retDay = getDayOfWeek(returnDeparture);
  const retDate = returnDeparture.slice(0, 10);

  if (retDay === 0) {
    // Sunday — must be after 5pm
    if (retHour < MIN_SUNDAY_RETURN_HOUR) return false;
  } else if (retDay === 1) {
    // Monday — only allowed if bank holiday
    if (!isBankHolidayMonday(retDate)) return false;
  }

  return true;
}
