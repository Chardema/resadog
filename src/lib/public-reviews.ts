import { prisma } from "@/lib/db/prisma";
import { getGooglePlaceReviews, type GooglePlaceReviews } from "@/lib/google-places-reviews";

export type SerializedReview = {
  id: string;
  source: string;
  author: string;
  rating: number;
  date: string;
  content: string;
  authorUri?: string;
  authorPhotoUri?: string;
  reviewUri?: string;
  publishTime?: string;
  visitDate?: { year: number; month: number };
  translated?: boolean;
};

export type PublicGooglePlaceSummary = {
  rating: number;
  reviewCount: number;
  googleMapsUri: string;
  hasLiveReviews: boolean;
};

export async function getInitialPublicReviews(
  locale: "fr" | "en" | "es" = "fr"
): Promise<{
  reviews: SerializedReview[];
  googlePlace: PublicGooglePlaceSummary | null;
}> {
  const [databaseResult, googleResult] = await Promise.allSettled([
    (async () =>
      prisma.review.findMany({
        where: { isActive: true },
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      }))(),
    (async () => getGooglePlaceReviews(locale))(),
  ]);

  const databaseReviews: SerializedReview[] =
    databaseResult.status === "fulfilled"
      ? databaseResult.value.map((r) => ({
          id: r.id,
          source: r.source,
          author: r.author,
          rating: r.rating,
          date: r.date,
          content: r.content,
        }))
      : [];

  const googlePlace: GooglePlaceReviews | null =
    googleResult.status === "fulfilled" ? googleResult.value : null;

  const reviews: SerializedReview[] = googlePlace?.reviews.length
    ? [
        ...googlePlace.reviews,
        ...databaseReviews.filter((review) => review.source !== "GOOGLE"),
      ]
    : databaseReviews;

  return {
    reviews,
    googlePlace: googlePlace
      ? {
          rating: googlePlace.rating,
          reviewCount: googlePlace.reviewCount,
          googleMapsUri: googlePlace.googleMapsUri,
          hasLiveReviews: googlePlace.reviews.length > 0,
        }
      : null,
  };
}
