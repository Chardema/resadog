import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockAuth,
  mockUserFindUnique,
  mockDistributedRateLimit,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockDistributedRateLimit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

vi.mock("@/lib/rate-limit", () => ({
  distributedRateLimit: mockDistributedRateLimit,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
    },
    booking: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    availability: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    coupon: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    review: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock("@/lib/finance-server", () => ({
  loadFinanceReport: vi.fn().mockResolvedValue(null),
}));

import { GET as getAdminBookings } from "@/app/api/admin/bookings/route";
import {
  GET as getAdminCoupons,
  POST as postAdminCoupons,
} from "@/app/api/admin/coupons/route";
import {
  GET as getAdminReviews,
  POST as postAdminReviews,
} from "@/app/api/admin/reviews/route";
import {
  POST as postAdminAvailability,
  PUT as putAdminAvailability,
} from "@/app/api/admin/availability/route";
import { GET as getCalendarIcal } from "@/app/api/calendar/ical/route";
import { GET as getAvailabilityCheck } from "@/app/api/availability/check/route";
import { buildMetadata } from "@/lib/seo";
import nextConfig from "../../../next.config";

function findAdminRouteFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findAdminRouteFiles(fullPath));
    } else if (entry.isFile() && entry.name === "route.ts") {
      files.push(fullPath);
    }
  }

  return files;
}

describe("Admin API routes & security guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ensures every route.ts under src/app/api/admin enforces authentication and ADMIN/SITTER role checks", () => {
    const adminApiDir = path.join(process.cwd(), "src/app/api/admin");
    const routeFiles = findAdminRouteFiles(adminApiDir);

    expect(routeFiles.length).toBeGreaterThanOrEqual(18);

    for (const filePath of routeFiles) {
      const relativePath = path.relative(process.cwd(), filePath);
      const source = fs.readFileSync(filePath, "utf8");

      const delegatesToCatVisitQuote = source.includes("catVisitQuoteRoute");
      if (delegatesToCatVisitQuote) {
        const quoteServerSource = fs.readFileSync(
          path.join(process.cwd(), "src/lib/cat-visit-quote-server.ts"),
          "utf8"
        );
        expect(quoteServerSource).toContain("auth()");
        expect(quoteServerSource).toContain('role === "ADMIN"');
        continue;
      }

      expect(
        source.includes("auth()"),
        `${relativePath} must call auth() to authenticate the session`
      ).toBe(true);
      expect(
        source.includes('"ADMIN"') || source.includes("'ADMIN'"),
        `${relativePath} must verify ADMIN (or SITTER) role`
      ).toBe(true);
    }
  });

  it("verifies dead route src/app/api/user/role/route.ts has been removed", () => {
    const deadRoutePath = path.join(
      process.cwd(),
      "src/app/api/user/role/route.ts"
    );
    expect(fs.existsSync(deadRoutePath)).toBe(false);
  });

  it("rejects unauthenticated requests (null session) across admin endpoints with 401/403", async () => {
    mockAuth.mockResolvedValue(null);

    const bookingsRes = await getAdminBookings(
      new NextRequest("http://localhost:3000/api/admin/bookings")
    );
    expect([401, 403]).toContain(bookingsRes.status);

    const couponsGetRes = await getAdminCoupons();
    expect([401, 403]).toContain(couponsGetRes.status);

    const couponsPostRes = await postAdminCoupons(
      new NextRequest("http://localhost:3000/api/admin/coupons", {
        method: "POST",
        body: JSON.stringify({ code: "TEST10" }),
      })
    );
    expect([401, 403]).toContain(couponsPostRes.status);

    const reviewsGetRes = await getAdminReviews();
    expect([401, 403]).toContain(reviewsGetRes.status);

    const availabilityPostRes = await postAdminAvailability(
      new Request("http://localhost:3000/api/admin/availability", {
        method: "POST",
        body: JSON.stringify({}),
      })
    );
    expect([401, 403]).toContain(availabilityPostRes.status);
  });

  it("rejects authenticated non-admin CLIENT requests across admin endpoints with 403", async () => {
    mockAuth.mockResolvedValue({
      user: {
        id: "client-user-1",
        email: "client@example.com",
        role: "CLIENT",
      },
    });

    const bookingsRes = await getAdminBookings(
      new NextRequest("http://localhost:3000/api/admin/bookings")
    );
    expect(bookingsRes.status).toBe(403);

    const couponsGetRes = await getAdminCoupons();
    expect(couponsGetRes.status).toBe(403);

    const reviewsPostRes = await postAdminReviews(
      new NextRequest("http://localhost:3000/api/admin/reviews", {
        method: "POST",
        body: JSON.stringify({
          source: "WEBSITE",
          author: "Test",
          rating: 5,
          date: "Octobre 2026",
          content: "Super",
        }),
      })
    );
    expect(reviewsPostRes.status).toBe(403);

    const availabilityPutRes = await putAdminAvailability(
      new Request("http://localhost:3000/api/admin/availability", {
        method: "PUT",
        body: JSON.stringify({
          startDate: "2026-11-01",
          endDate: "2026-11-05",
          action: "BLOCK",
        }),
      })
    );
    expect(availabilityPutRes.status).toBe(403);
  });

  it("protects /api/calendar/ical against missing, invalid, or non-admin tokens", async () => {
    const missingTokenRes = await getCalendarIcal(
      new NextRequest("http://localhost:3000/api/calendar/ical")
    );
    expect(missingTokenRes.status).toBe(401);

    mockUserFindUnique.mockResolvedValueOnce(null);
    const invalidTokenRes = await getCalendarIcal(
      new NextRequest(
        "http://localhost:3000/api/calendar/ical?token=bad-token&mode=admin"
      )
    );
    expect(invalidTokenRes.status).toBe(404);

    mockUserFindUnique.mockResolvedValueOnce({
      id: "client-1",
      role: "CLIENT",
      calendarToken: "valid-client-token",
    });
    const nonAdminTokenRes = await getCalendarIcal(
      new NextRequest(
        "http://localhost:3000/api/calendar/ical?token=valid-client-token&mode=admin"
      )
    );
    expect(nonAdminTokenRes.status).toBe(403);
  });

  it("enforces distributedRateLimit on /api/availability/check and returns 429 with Retry-After when exceeded", async () => {
    mockDistributedRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetIn: 42,
    });

    const res = await getAvailabilityCheck(
      new NextRequest(
        "http://localhost:3000/api/availability/check?startDate=2026-11-10&endDate=2026-11-12&serviceType=BOARDING",
        {
          headers: { "x-forwarded-for": "203.0.113.10" },
        }
      )
    );

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
    expect(mockDistributedRateLimit).toHaveBeenCalledWith(
      "availability-check:203.0.113.10",
      { maxRequests: 60, windowSeconds: 60 }
    );
  });

  it("configures 1200x630 OpenGraph image, summary_large_image Twitter card, and permanent /services & /contact redirects", async () => {
    const meta = buildMetadata({
      title: "Tarifs garde animaux",
      description: "Grille tarifaire La Patte Dorée",
      path: "/tarifs",
    });

    expect(meta.openGraph?.images).toEqual([
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "La Patte Dorée — Garde familiale de chiens et chats près de Disneyland Paris",
      },
    ]);
    expect(meta.twitter).toMatchObject({
      card: "summary_large_image",
      images: ["/opengraph-image"],
    });

    const redirects = await nextConfig.redirects?.();
    expect(redirects).toEqual(
      expect.arrayContaining([
        { source: "/services", destination: "/#services", permanent: true },
        { source: "/contact", destination: "/#nous-trouver", permanent: true },
      ])
    );
  });
});
