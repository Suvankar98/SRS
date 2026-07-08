import { NextResponse } from "next/server";

function getGoogleMapsApiKey() {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
}

type GooglePlacesAutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: {
      text?: {
        text?: string;
      };
    };
    queryPrediction?: {
      text?: {
        text?: string;
      };
    };
  }>;
  error?: {
    message?: string;
    status?: string;
  };
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("query")?.trim() || "";
  const googleMapsApiKey = getGoogleMapsApiKey();

  if (!googleMapsApiKey) {
    return NextResponse.json({ suggestions: [], autocompleteDisabled: true });
  }

  if (query.length < 1) {
    return NextResponse.json({ suggestions: [] });
  }

  let data: GooglePlacesAutocompleteResponse;
  try {
    const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": googleMapsApiKey,
        "X-Goog-FieldMask": "suggestions.placePrediction.text.text,suggestions.queryPrediction.text.text",
      },
      body: JSON.stringify({
        input: query,
        includedPrimaryTypes: ["(regions)"],
        includedRegionCodes: ["in"],
        languageCode: "en",
      }),
    });
    data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          suggestions: [],
          error: data.error?.message || "Google API request failed",
          googleStatus: data.error?.status,
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

  const suggestions = (data.suggestions ?? [])
    .map((suggestion) => suggestion.placePrediction?.text?.text ?? suggestion.queryPrediction?.text?.text ?? "")
    .filter((suggestion) => suggestion !== "")
    .slice(0, 10);

  const uniqueSuggestions = Array.from(new Set(suggestions));

  return NextResponse.json({ suggestions: uniqueSuggestions });
}
