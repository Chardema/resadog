import { catVisitQuoteRoute } from "@/lib/cat-visit-quote-server";

export const runtime = "nodejs";
export const maxDuration = 60;
export function POST(request: Request) { return catVisitQuoteRoute(request, "pdf"); }
