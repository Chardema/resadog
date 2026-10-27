import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockFindMany, mockGetGooglePlaceReviews } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockGetGooglePlaceReviews: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    review: {
      findMany: mockFindMany,
    },
  },
}));

vi.mock("@/lib/google-places-reviews", () => ({
  getGooglePlaceReviews: mockGetGooglePlaceReviews,
}));

import { getInitialPublicReviews } from "@/lib/public-reviews";

describe("getInitialPublicReviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merges live Google reviews with non-GOOGLE database reviews", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "db-1",
        source: "ROVER",
        author: "Sophie",
        rating: 5,
        date: "Octobre 2026",
        content: "Super garde !",
      },
      {
        id: "db-google-dup",
        source: "GOOGLE",
        author: "Ancien",
        rating: 5,
        date: "Septembre 2026",
        content: "Doublon DB",
      },
    ]);
    mockGetGooglePlaceReviews.mockResolvedValue({
      rating: 5.0,
      reviewCount: 12,
      googleMapsUri: "https://maps.google.com/?cid=123",
      reviews: [
        {
          id: "google-1",
          source: "GOOGLE",
          author: "Marc",
          rating: 5,
          date: "Il y a 2 jours",
          content: "Parfait près de Disney",
        },
      ],
    });

    const result = await getInitialPublicReviews("fr");
    expect(result.reviews).toHaveLength(2);
    expect(result.reviews[0].id).toBe("google-1");
    expect(result.reviews[1].id).toBe("db-1");
    expect(result.googlePlace).toEqual({
      rating: 5.0,
      reviewCount: 12,
      googleMapsUri: "https://maps.google.com/?cid=123",
      hasLiveReviews: true,
    });
  });

  it("falls back to database reviews when Google Places returns null or rejects, and never throws if DB is unavailable", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "db-1",
        source: "ALLOVOISINS",
        author: "Claire",
        rating: 5,
        date: "Octobre 2026",
        content: "Très rassurant",
      },
    ]);
    mockGetGooglePlaceReviews.mockResolvedValue(null);

    const fallbackResult = await getInitialPublicReviews("fr");
    expect(fallbackResult.reviews).toHaveLength(1);
    expect(fallbackResult.reviews[0].author).toBe("Claire");
    expect(fallbackResult.googlePlace).toBeNull();

    mockFindMany.mockRejectedValue(new Error("DB unreachable"));
    mockGetGooglePlaceReviews.mockRejectedValue(new Error("Network error"));

    const safeEmpty = await getInitialPublicReviews("en");
    expect(safeEmpty).toEqual({
      reviews: [],
      googlePlace: null,
    });
  });
});
