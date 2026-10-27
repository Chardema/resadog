import { NextRequest, NextResponse } from "next/server";
import { getInitialPublicReviews } from "@/lib/public-reviews";

// GET — Route publique pour afficher les avis actifs sur la page d'accueil
export async function GET(request: NextRequest) {
  try {
    const requestedLocale =
      request.nextUrl.searchParams.get("locale") ||
      request.nextUrl.searchParams.get("lang");
    const locale =
      requestedLocale === "en" || requestedLocale === "es"
        ? requestedLocale
        : "fr";

    const data = await getInitialPublicReviews(locale);

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Erreur récupération avis:", error);
    return NextResponse.json({ reviews: [], googlePlace: null }, { status: 500 });
  }
}
