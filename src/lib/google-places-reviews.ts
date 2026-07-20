import "server-only";

import { GOOGLE_MAPS_PLACE_URL, GOOGLE_PLACE_ID } from "@/lib/google-reviews";

type SupportedReviewLocale = "fr" | "en" | "es";

type GoogleLocalizedText = {
  text?: string;
  languageCode?: string;
};

type GoogleAuthorAttribution = {
  displayName?: string;
  uri?: string;
  photoUri?: string;
};

type GoogleReview = {
  name?: string;
  relativePublishTimeDescription?: string;
  text?: GoogleLocalizedText;
  originalText?: GoogleLocalizedText;
  rating?: number;
  authorAttribution?: GoogleAuthorAttribution;
  publishTime?: string;
  googleMapsUri?: string;
  visitDate?: {
    year?: number;
    month?: number;
  };
};

type GooglePlaceDetails = {
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  reviews?: GoogleReview[];
};

export type PublicGoogleReview = {
  id: string;
  source: "GOOGLE";
  author: string;
  rating: number;
  date: string;
  content: string;
  authorUri?: string;
  authorPhotoUri?: string;
  reviewUri: string;
  publishTime?: string;
  visitDate?: {
    year: number;
    month: number;
  };
  translated: boolean;
};

export type GooglePlaceReviews = {
  rating: number;
  reviewCount: number;
  googleMapsUri: string;
  reviews: PublicGoogleReview[];
};

function safeHttpsUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function normalizeVisitDate(review: GoogleReview) {
  const year = review.visitDate?.year;
  const month = review.visitDate?.month;
  if (!year || !month || month < 1 || month > 12) return undefined;
  return { year, month };
}

function normalizeReview(review: GoogleReview, index: number): PublicGoogleReview | null {
  const content = review.text?.text?.trim();
  const reviewUri = safeHttpsUrl(review.googleMapsUri);
  if (!content || !reviewUri) return null;

  const rating = Math.min(5, Math.max(1, Math.round(review.rating ?? 5)));
  const originalLanguage = review.originalText?.languageCode;
  const displayedLanguage = review.text?.languageCode;

  return {
    id: review.name || `google-review-${review.publishTime || index}`,
    source: "GOOGLE",
    author: review.authorAttribution?.displayName?.trim() || "Utilisateur Google Maps",
    rating,
    date: review.relativePublishTimeDescription || "Avis Google Maps",
    content,
    authorUri: safeHttpsUrl(review.authorAttribution?.uri),
    authorPhotoUri: safeHttpsUrl(review.authorAttribution?.photoUri),
    reviewUri,
    publishTime: review.publishTime,
    visitDate: normalizeVisitDate(review),
    translated: Boolean(
      originalLanguage && displayedLanguage && originalLanguage !== displayedLanguage
    ),
  };
}

export async function getGooglePlaceReviews(
  languageCode: SupportedReviewLocale = "fr"
): Promise<GooglePlaceReviews | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) return null;

  const url = new URL(`https://places.googleapis.com/v1/places/${GOOGLE_PLACE_ID}`);
  url.searchParams.set("languageCode", languageCode);
  url.searchParams.set("regionCode", "FR");

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": [
        "rating",
        "userRatingCount",
        "googleMapsUri",
        "reviews.name",
        "reviews.relativePublishTimeDescription",
        "reviews.text",
        "reviews.originalText",
        "reviews.rating",
        "reviews.authorAttribution",
        "reviews.publishTime",
        "reviews.googleMapsUri",
        "reviews.visitDate",
      ].join(","),
    },
  });

  if (!response.ok) {
    throw new Error(`Google Places API a répondu avec le statut ${response.status}`);
  }

  const place = (await response.json()) as GooglePlaceDetails;
  const reviews = (place.reviews || [])
    .map(normalizeReview)
    .filter((review): review is PublicGoogleReview => review !== null);

  return {
    rating: Math.min(5, Math.max(0, place.rating ?? 0)),
    reviewCount: Math.max(0, place.userRatingCount ?? 0),
    googleMapsUri: safeHttpsUrl(place.googleMapsUri) || GOOGLE_MAPS_PLACE_URL,
    reviews,
  };
}
