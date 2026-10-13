import { createHash } from "node:crypto";
import { parseCatVisitQuoteRequest, quoteMailSchema } from "@/lib/cat-visit-quote-request";
import type { CatVisitQuote, CatVisitQuoteDetails } from "@/lib/cat-visit-quote";

interface QuoteApiDependencies {
  authorize: () => Promise<string | null>;
  renderPdf: (quote: CatVisitQuote, details: CatVisitQuoteDetails) => Promise<Buffer>;
  findSent: (key: string) => Promise<boolean>;
  limit: (adminId: string) => Promise<{ success: boolean; resetIn: number }>;
  send: (input: { to: string; subject: string; message: string; reference: string; pdf: Buffer }, key: string) => Promise<unknown>;
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export async function handleCatVisitQuoteRequest(request: Request, mode: "pdf" | "send", deps: QuoteApiDependencies) {
  const adminId = await deps.authorize();
  if (!adminId) return json({ error: "Accès non autorisé." }, 403);
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  // Next may reconstruct an internal hostname; Host retains the browser-facing authority.
  const requestOrigin = request.headers.get("host") ? `${url.protocol}//${request.headers.get("host")}` : url.origin;
  if (origin && origin !== requestOrigin) return json({ error: "Origine non autorisée." }, 403);
  if (!request.headers.get("content-type")?.includes("application/json")) return json({ error: "Format de requête invalide." }, 415);
  if (Number(request.headers.get("content-length")) > 40000) return json({ error: "Le devis est trop volumineux." }, 413);
  const text = await request.text();
  if (text.length > 40000) return json({ error: "Le devis est trop volumineux." }, 413);
  let prepared: ReturnType<typeof parseCatVisitQuoteRequest>;
  let mail: ReturnType<typeof quoteMailSchema.parse> | undefined;
  try {
    const body = JSON.parse(text);
    prepared = parseCatVisitQuoteRequest(body.document);
    if (mode === "send") {
      const parsed = quoteMailSchema.safeParse(body.mail);
      if (!parsed.success) return json({ error: parsed.error.issues[0]?.message || "Message invalide." }, 400);
      mail = parsed.data;
      if (!prepared.details.clientName || !prepared.details.address) return json({ error: "Complétez le nom et l’adresse du client avant l’envoi." }, 400);
    }
  } catch (error) {
    return json({ error: error instanceof SyntaxError ? "Requête invalide." : error instanceof Error ? error.message : "Devis invalide." }, 400);
  }
  const { quote, details } = prepared;
  try {
    if (mode === "pdf") {
      const pdf = await deps.renderPdf(quote, details);
      return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${details.reference.toLowerCase()}.pdf"`, "Cache-Control": "no-store" } });
    }
    if (!mail) return json({ error: "Message invalide." }, 400);
    const key = `cat-visit-quote-${createHash("sha256").update(JSON.stringify({ quote, details, mail })).digest("hex")}`;
    // The provider key also protects simultaneous requests before the log is saved.
    if (await deps.findSent(key)) return json({ success: true, alreadySent: true, message: `Ce devis a déjà été envoyé à ${mail.to}.` });
    const limit = await deps.limit(adminId);
    if (!limit.success) return json({ error: "Trop d’envois rapprochés. Réessayez dans une minute." }, 429, { "Retry-After": String(limit.resetIn) });
    const pdf = await deps.renderPdf(quote, details);
    await deps.send({ ...mail, reference: details.reference, pdf }, key);
    return json({ success: true, message: `Devis envoyé à ${mail.to}, avec le PDF en pièce jointe.` });
  } catch (error) {
    console.error(`Erreur ${mode === "pdf" ? "PDF" : "envoi"} devis chats:`, error);
    return json({ error: mode === "pdf" ? "Le PDF n’a pas pu être préparé. Réessayez." : "L’envoi n’a pas pu être confirmé. Réessayez sans modifier le message pour éviter un doublon." }, 502);
  }
}
