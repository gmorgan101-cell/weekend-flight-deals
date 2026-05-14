export interface FlightDeal {
  id: string;
  flyFrom: string;
  flyTo: string;
  cityFrom: string;
  cityTo: string;
  countryTo: string;
  price: number;
  currency: string;
  departureDate: string;
  returnDate: string;
  departureTime: string;
  returnTime: string;
  airline: string;
  airlineLogo: string;
  bookingLink: string;
  nightsInDest: number;
  stopovers: number;
  durationOutbound: string;
  durationReturn: string;
  departureAirport: string;
  arrivalAirport: string;
  departureDay: string;
  provider: string;
}

export interface CheapDestination {
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

export interface FlightProvider {
  name: string;
  searchEverywhere?(params: {
    departDate: string;
    returnDate: string;
  }): Promise<CheapDestination[]>;

  searchCountry?(params: {
    countryId: string;
    departDate: string;
    returnDate: string;
  }): Promise<CheapDestination[]>;

  searchFlights(params: {
    fromCode: string;
    toCode: string;
    departDate: string;
    returnDate: string;
    maxPrice?: number;
  }): Promise<FlightDeal[]>;
}

export class ProviderRateLimitError extends Error {
  constructor(provider: string) {
    super(`${provider}: Monthly API limit reached`);
    this.name = "ProviderRateLimitError";
  }
}
