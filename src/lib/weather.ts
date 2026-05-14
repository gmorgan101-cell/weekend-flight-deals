/**
 * Average daily high temperatures (°C) by city and month.
 * Source: historical climate averages for popular European destinations.
 * Key = city name (lowercase), Value = array of 12 monthly temps [Jan..Dec]
 */

const CITY_TEMPS: Record<string, number[]> = {
  // Ireland
  "dublin":       [8, 8, 10, 12, 15, 18, 20, 19, 17, 14, 10, 8],
  "galway":       [8, 8, 10, 12, 15, 17, 19, 19, 17, 13, 10, 8],
  "kilkenny":     [8, 8, 10, 12, 15, 18, 20, 19, 17, 14, 10, 8],
  "cork":         [8, 9, 10, 12, 15, 18, 19, 19, 17, 14, 10, 9],

  // United Kingdom
  "manchester":   [7, 7, 10, 12, 16, 18, 20, 20, 17, 13, 9, 7],
  "edinburgh":    [7, 7, 9, 11, 14, 17, 19, 19, 16, 12, 9, 7],

  // France
  "paris":        [7, 8, 12, 15, 19, 22, 25, 25, 21, 16, 10, 7],
  "nice":         [13, 13, 15, 17, 21, 25, 28, 28, 25, 21, 16, 13],
  "marseille":    [12, 12, 15, 17, 21, 26, 29, 29, 25, 20, 15, 12],
  "lyon":         [6, 8, 13, 16, 20, 24, 27, 27, 22, 16, 10, 7],
  "bordeaux":     [10, 11, 14, 16, 20, 23, 26, 26, 23, 18, 13, 10],
  "toulouse":     [9, 11, 14, 16, 20, 24, 27, 27, 23, 18, 12, 9],
  "nantes":       [9, 9, 13, 15, 18, 22, 24, 24, 21, 17, 12, 9],

  // Spain
  "barcelona":    [14, 15, 17, 19, 22, 26, 29, 29, 26, 22, 17, 14],
  "madrid":       [10, 12, 16, 18, 22, 28, 33, 32, 27, 20, 14, 10],
  "malaga":       [17, 17, 19, 21, 24, 28, 31, 31, 28, 24, 20, 17],
  "palma de mallorca": [15, 15, 17, 19, 23, 27, 31, 31, 27, 23, 18, 16],
  "alicante":     [17, 17, 19, 21, 24, 28, 31, 32, 29, 25, 20, 17],
  "valencia":     [16, 16, 18, 20, 23, 27, 30, 30, 27, 23, 19, 16],
  "valència":     [16, 16, 18, 20, 23, 27, 30, 30, 27, 23, 19, 16],
  "seville":      [16, 17, 20, 22, 26, 31, 36, 36, 32, 26, 20, 16],
  "bilbao":       [12, 13, 15, 16, 19, 22, 25, 25, 23, 19, 15, 12],

  // Italy
  "rome":         [12, 13, 16, 18, 23, 27, 31, 31, 27, 22, 17, 13],
  "milan":        [6, 9, 14, 18, 22, 27, 30, 29, 25, 18, 11, 6],
  "naples":       [13, 13, 16, 18, 23, 27, 30, 31, 27, 22, 17, 13],
  "venice":       [6, 8, 13, 17, 22, 26, 28, 28, 24, 18, 12, 7],
  "florence":     [10, 12, 15, 18, 23, 28, 32, 31, 27, 21, 14, 10],
  "bologna":      [5, 8, 14, 18, 23, 27, 30, 30, 25, 19, 12, 6],

  // Portugal
  "lisbon":       [15, 16, 18, 19, 22, 26, 28, 28, 27, 22, 18, 15],
  "porto":        [14, 14, 17, 18, 20, 24, 26, 26, 24, 21, 17, 14],
  "faro":         [16, 17, 19, 20, 23, 27, 29, 29, 27, 23, 19, 16],

  // Netherlands
  "amsterdam":    [6, 6, 10, 13, 17, 19, 22, 22, 19, 14, 10, 7],

  // Germany
  "berlin":       [3, 4, 9, 14, 19, 22, 25, 24, 20, 14, 8, 4],
  "munich":       [3, 5, 10, 14, 19, 22, 24, 24, 20, 14, 8, 4],
  "hamburg":      [4, 4, 8, 13, 17, 20, 22, 22, 18, 13, 8, 5],
  "cologne":      [5, 6, 11, 15, 19, 22, 25, 24, 20, 15, 9, 6],

  // Greece
  "athens":       [13, 14, 16, 20, 25, 30, 33, 33, 29, 24, 18, 14],
  "thessaloniki": [9, 10, 14, 19, 24, 29, 31, 31, 27, 21, 15, 10],
  "crete":        [15, 15, 17, 20, 24, 28, 30, 30, 27, 23, 19, 16],

  // Poland
  "warsaw":       [1, 2, 7, 13, 19, 22, 24, 24, 19, 13, 6, 2],
  "krakow":       [2, 3, 8, 14, 19, 22, 24, 24, 19, 14, 7, 3],
  "kraków":       [2, 3, 8, 14, 19, 22, 24, 24, 19, 14, 7, 3],

  // Croatia
  "dubrovnik":    [12, 12, 14, 17, 22, 26, 29, 29, 26, 21, 17, 13],
  "split":        [11, 12, 14, 17, 22, 26, 30, 30, 26, 21, 16, 12],
  "zagreb":       [4, 6, 11, 16, 21, 24, 27, 27, 22, 16, 10, 5],

  // Czechia
  "prague":       [2, 4, 9, 14, 19, 22, 25, 24, 20, 13, 7, 3],

  // Scandinavia
  "oslo":         [0, 1, 5, 10, 16, 20, 22, 21, 16, 10, 4, 1],
  "copenhagen":   [3, 3, 7, 12, 17, 20, 22, 22, 18, 13, 7, 4],
  "stockholm":    [1, 1, 5, 10, 16, 20, 23, 22, 17, 11, 5, 2],

  // Other
  "luxembourg":   [4, 5, 10, 14, 18, 21, 24, 23, 19, 14, 8, 5],
  "marrakech":    [18, 20, 23, 25, 29, 33, 38, 38, 33, 28, 23, 19],
  "istanbul":     [9, 9, 12, 17, 22, 27, 29, 29, 26, 20, 15, 11],
  "reykjavik":    [3, 3, 4, 7, 10, 13, 15, 14, 11, 7, 4, 3],
  "larnaca":      [17, 17, 19, 22, 27, 31, 33, 33, 31, 28, 22, 18],
  "budapest":     [4, 6, 11, 17, 22, 25, 28, 27, 22, 16, 9, 5],
  "vienna":       [3, 5, 10, 16, 21, 24, 27, 26, 21, 15, 8, 4],
  "brussels":     [6, 7, 11, 14, 18, 21, 23, 23, 19, 15, 9, 6],
  "zurich":       [3, 5, 10, 15, 19, 23, 25, 25, 20, 14, 8, 4],
  "geneva":       [4, 6, 11, 15, 20, 23, 27, 26, 21, 15, 9, 5],
};

/**
 * Get average high temperature for a city in a given month.
 * @param cityName - City name (case insensitive)
 * @param month - 0-indexed month (0 = January, 11 = December)
 * @returns Temperature in °C, or null if city not found
 */
export function getAverageTemp(cityName: string, month: number): number | null {
  const key = cityName.toLowerCase().trim();
  const temps = CITY_TEMPS[key];
  if (!temps) return null;
  return temps[month] ?? null;
}

/**
 * Get average temp from a date string (YYYY-MM-DD)
 */
export function getAverageTempForDate(cityName: string, dateStr: string): number | null {
  const month = parseInt(dateStr.slice(5, 7), 10) - 1; // 0-indexed
  return getAverageTemp(cityName, month);
}
