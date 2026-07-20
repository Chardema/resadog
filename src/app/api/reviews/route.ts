import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getGooglePlaceReviews } from "@/lib/google-places-reviews";

// GET public — Récupérer les avis actifs pour l'affichage
export async function GET(request: NextRequest) {
  try {
    const requestedLocale = request.nextUrl.searchParams.get("locale");
    const locale = requestedLocale === "en" || requestedLocale === "es"
      ? requestedLocale
      : "fr";

    const [databaseReviews, googlePlace] = await Promise.all([
      prisma.review.findMany({
        where: { isActive: true },
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      }),
      getGooglePlaceReviews(locale).catch((error) => {
        console.error("Erreur récupération avis Google Maps:", error);
        return null;
      }),
    ]);

    const reviews = googlePlace?.reviews.length
      ? [
          ...googlePlace.reviews,
          ...databaseReviews.filter((review) => review.source !== "GOOGLE"),
        ]
      : databaseReviews;

    return NextResponse.json(
      {
        reviews,
        googlePlace: googlePlace
          ? {
              rating: googlePlace.rating,
              reviewCount: googlePlace.reviewCount,
              googleMapsUri: googlePlace.googleMapsUri,
              hasLiveReviews: googlePlace.reviews.length > 0,
            }
          : null,
      },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Erreur récupération avis:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
