import { NextResponse } from "next/server";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("query")?.trim() || "";

  if (!GOOGLE_MAPS_API_KEY) {
    return NextResponse.json({ suggestions: [], error: "Missing API key" }, { status: 500 });
  }

  if (query.length < 1) {
    return NextResponse.json({ suggestions: [] });
  }

  const googleUrl = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
  googleUrl.searchParams.set("input", query);
  googleUrl.searchParams.set("types", "(regions)");
  googleUrl.searchParams.set("components", "country:in");
  googleUrl.searchParams.set("key", GOOGLE_MAPS_API_KEY);

  let data: any;
  try {
    const response = await fetch(googleUrl.toString());
    data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          suggestions: [],
          error: data?.error_message || "Google API request failed",
          googleStatus: data?.status,
        },
        { status: response.status }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        suggestions: [],
        error: error instanceof Error ? error.message : "Google API request failed",
      },
      { status: 500 }
    );
  }

  if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    return NextResponse.json(
      {
        suggestions: [],
        error: data.error_message || data.status,
        googleStatus: data.status,
      },
      { status: 500 }
    );
  }

  const suggestions = Array.isArray(data.predictions)
    ? data.predictions.map((prediction: any) => prediction.description).slice(0, 10)
    : [];

  return NextResponse.json({ suggestions });
}
