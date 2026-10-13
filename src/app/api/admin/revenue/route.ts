import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadFinanceReport } from "@/lib/finance-server";
import { financeMonth, summarizeFinanceYear } from "@/lib/finance";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !["ADMIN", "SITTER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }
  const currentYear = Number(financeMonth(new Date()).slice(0, 4));
  const year = Number(request.nextUrl.searchParams.get("year") || currentYear);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Année invalide" }, { status: 400 });
  }
  try {
    const report = await loadFinanceReport(request.nextUrl.searchParams.get("refresh") === "1");
    const years = [...new Set([currentYear, year,
      ...report.events.map((event) => Number(financeMonth(event.occurredAt).slice(0, 4))),
      ...report.upcoming.map((booking) => Number(financeMonth(booking.startsAt).slice(0, 4))),
    ])].sort((a, b) => b - a);
    return NextResponse.json({
      ...summarizeFinanceYear(report, year), year, years, settings: report.settings,
      events: report.events.filter((event) => Number(financeMonth(event.occurredAt).slice(0, 4)) === year),
      projections: report.projections, warnings: report.warnings, generatedAt: new Date().toISOString(),
      upcoming: report.upcoming.filter((booking) => Number(financeMonth(booking.startsAt).slice(0, 4)) === year),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Erreur lors du chargement des finances admin:", error);
    return NextResponse.json({ error: "Impossible de charger les finances. Réessayez." }, { status: 500 });
  }
}
