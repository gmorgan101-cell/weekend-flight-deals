import { NextRequest, NextResponse } from "next/server";
import { getCached, setCache } from "@/lib/cache";

interface Attraction {
  title: string;
  rating: number | null;
  reviews: number | null;
  description: string;
  thumbnail: string;
}

const SERPAPI_BASE = "https://serpapi.com/search";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const city = params.get("city");
  const country = params.get("country");

  if (!city) {
    return NextResponse.json(
      { error: "city parameter is required" },
      { status: 400 }
    );
  }

  const cacheKey = `cityinfo-${city}-${country || ""}`;
  const cached = getCached<{ attractions: Attraction[] }>(cacheKey);
  if (cached) {
    console.log(`[Cache hit] city info ${city}`);
    return NextResponse.json(cached);
  }

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "SERPAPI_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const query = country
      ? `${city} ${country} things to do`
      : `${city} things to do`;

    const searchParams = new URLSearchParams({
      engine: "tripadvisor",
      q: query,
      limit: "6",
      api_key: apiKey,
    });

    console.log(`[SerpApi] TripAdvisor search: ${query}`);
    const response = await fetch(`${SERPAPI_BASE}?${searchParams}`);
    const data = await response.json();

    if (data.error) {
      console.error("[SerpApi] TripAdvisor error:", data.error);
      return NextResponse.json({ attractions: [] });
    }

    const places = data.places || [];
    const attractions: Attraction[] = places
      .filter((p: any) => p.place_type === "ATTRACTION")
      .slice(0, 6)
      .map((p: any) => ({
        title: p.title || "",
        rating: p.rating || null,
        reviews: p.reviews || null,
        description: p.description || "",
        thumbnail: p.thumbnail || "",
      }));

    const result = { attractions };
    setCache(cacheKey, result);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("City info error:", message);
    return NextResponse.json({ attractions: [] });
  }
}
