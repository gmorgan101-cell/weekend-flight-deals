import { NextRequest, NextResponse } from "next/server";
import {
  searchAllCities,
  searchFlights,
} from "@/lib/providers";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const departDate = params.get("departDate");
  const returnDate = params.get("returnDate");
  const city = params.get("city");
  const maxPrice = params.get("maxPrice");

  if (!departDate || !returnDate) {
    return NextResponse.json(
      { error: "departDate and returnDate are required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  try {
    // Step 2: search flights for a specific city
    if (city) {
      const flights = await searchFlights({
        cityId: city,
        departDate,
        returnDate,
        maxPrice: maxPrice ? parseInt(maxPrice) : undefined,
      });
      return NextResponse.json({ flights, count: flights.length });
    }

    // Step 1: search all cities across all countries
    const { destinations } = await searchAllCities({
      departDate,
      returnDate,
      maxPrice: maxPrice ? parseInt(maxPrice) : undefined,
    });

    return NextResponse.json({
      destinations,
      count: destinations.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Flight search error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
