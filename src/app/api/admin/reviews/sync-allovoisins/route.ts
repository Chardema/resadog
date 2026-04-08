import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const ALLOVOISINS_URL = "https://www.allovoisins.com/p/meganemelique-1";

// GET — Fetch les données publiques JSON-LD depuis AlloVoisins
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    const res = await fetch(ALLOVOISINS_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LaPatteDoree/1.0)",
        "Accept": "text/html",
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `AlloVoisins a retourné ${res.status}` }, { status: 502 });
    }

    const html = await res.text();

    // Extraire le JSON-LD
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (!jsonLdMatch) {
      return NextResponse.json({ error: "JSON-LD non trouvé sur la page" }, { status: 404 });
    }

    try {
      const jsonLd = JSON.parse(jsonLdMatch[1]);
      const aggregateRating = jsonLd.aggregateRating;

      return NextResponse.json({
        source: "AlloVoisins",
        profileUrl: ALLOVOISINS_URL + "#avis",
        rating: aggregateRating?.ratingValue ? parseFloat(aggregateRating.ratingValue) : null,
        reviewCount: aggregateRating?.reviewCount ? parseInt(aggregateRating.reviewCount) : null,
        bestRating: aggregateRating?.bestRating ? parseInt(aggregateRating.bestRating) : 5,
        name: jsonLd.name || null,
        fetchedAt: new Date().toISOString(),
      });
    } catch {
      return NextResponse.json({ error: "Impossible de parser le JSON-LD" }, { status: 500 });
    }
  } catch (error) {
    console.error("Erreur sync AlloVoisins:", error);
    return NextResponse.json({ error: "Erreur de connexion à AlloVoisins" }, { status: 502 });
  }
}
