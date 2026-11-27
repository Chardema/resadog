import { NextRequest, NextResponse } from "next/server";
import { collectBalances, isBalanceCollectionEnabled, resolveReferenceDate } from "@/lib/balance-collection";

// Solde du plan acompte (spec 07, lot 5) : prélèvement à J-7, relances J-5 / J-3,
// annulation pour défaut de paiement à J-2. Rejouable : verrou en base et clés
// d'idempotence Stripe empêchent tout double débit. Le cron Vercel est ajouté
// au lot 9 (vercel.json), à approuver au déploiement.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isBalanceCollectionEnabled()) {
    return NextResponse.json({ success: true, enabled: false });
  }

  // Date de référence injectable pour les tests (?now=…), refusée en production.
  const reference = resolveReferenceDate(request.nextUrl.searchParams.get("now"));
  if ("error" in reference) return NextResponse.json({ error: reference.error }, { status: 400 });

  const dryRun = request.nextUrl.searchParams.get("dryRun") === "true";
  try {
    const report = await collectBalances({ now: reference.now, dryRun });
    return NextResponse.json(
      { success: report.errors.length === 0, enabled: true, ...report },
      { status: report.errors.length > 0 ? 502 : 200 }
    );
  } catch (error) {
    console.error("collect-balances:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
