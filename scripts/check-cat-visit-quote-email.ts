import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { addCalendarDays, getTodayDateKey } from "../src/lib/booking-dates";
import { calculateCatVisitQuote } from "../src/lib/cat-visit-quote";
import { makeCatVisitQuoteRequest } from "../src/lib/cat-visit-quote-request";
import { buildCatVisitQuoteMail } from "../src/lib/cat-visit-quote-mail";
import { handleCatVisitQuoteRequest } from "../src/lib/cat-visit-quote-api";
import { renderCatVisitQuotePdf } from "../src/lib/cat-visit-quote-pdf";

async function main() {
  const today = getTodayDateKey();
  const quote = calculateCatVisitQuote({ catCount: 2, dates: [7, 9, 12, 14, 16, 19].map((n) => addCalendarDays(today, n)), visitsPerDay: 1, durationMinutes: 30, travelFeePerVisit: 0 });
  assert.ok(quote);
  const details = { clientName: "Cliente de démonstration", address: "Adresse de démonstration\n77600 Bussy-Saint-Georges", notes: "", petNames: "Moka et Plume", issuedOn: today, validUntil: quote.dates[0], reference: `DEV-${today.replaceAll("-", "")}-ABCDEF12` };
  const mail = { to: "client@example.com", ...buildCatVisitQuoteMail(quote, details) };
  assert.ok(mail.message.includes("90,00"));
  assert.ok(mail.message.includes("6 visites de 30 minutes pour 2 chats"));
  const body = { document: makeCatVisitQuoteRequest(quote, details), mail };
  const pdf = await renderCatVisitQuotePdf(quote, details);
  const retryPdf = await renderCatVisitQuotePdf(quote, details);
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(pdf.equals(retryPdf), "PDF must be byte-identical across retries for provider idempotency");
  let sent = 0, rendered = 0;
  const requests: { key: string; pdf: Buffer; to: string; message: string }[] = [];
  const deps = {
    authorize: async () => "admin-test",
    renderPdf: async (value: typeof quote) => { rendered++; assert.equal(value.total, 90); return pdf; },
    findSent: async () => false,
    limit: async () => ({ success: true, resetIn: 60 }),
    send: async (input: { pdf: Buffer; to: string; message: string }, key: string) => { sent++; requests.push({ ...input, key }); },
  };
  function request(value: unknown = body, origin = "https://example.test") {
    return new Request("https://example.test/api/admin/quotes/cat-visits/send", { method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(value) });
  }
  assert.equal((await handleCatVisitQuoteRequest(request(), "send", { ...deps, authorize: async () => null })).status, 403);
  assert.equal((await handleCatVisitQuoteRequest(request(body, "https://elsewhere.test"), "send", deps)).status, 403);
  assert.equal((await handleCatVisitQuoteRequest(request({ ...body, mail: { ...mail, to: "bad address" } }), "send", deps)).status, 400);
  assert.equal((await handleCatVisitQuoteRequest(request({ ...body, document: { ...body.document, details: { ...details, clientName: "" } } }), "send", deps)).status, 400);
  assert.equal((await handleCatVisitQuoteRequest(request({ ...body, document: { ...body.document, input: { ...body.document.input, total: 1 } } }), "send", deps)).status, 400);
  assert.equal((await handleCatVisitQuoteRequest(request({ ...body, document: { ...body.document, details: { ...details, validUntil: addCalendarDays(today, -1) } } }), "send", deps)).status, 400);
  assert.equal((await handleCatVisitQuoteRequest(request(), "send", { ...deps, limit: async () => ({ success: false, resetIn: 60 }) })).status, 429);
  assert.equal(sent, 0); assert.equal(rendered, 0);
  const proxied = new Request("https://internal.test/api/admin/quotes/cat-visits/pdf", { method: "POST", headers: { "content-type": "application/json", origin: "https://example.test", host: "example.test" }, body: JSON.stringify(body) });
  assert.equal((await handleCatVisitQuoteRequest(proxied, "pdf", deps)).status, 200);
  const download = await handleCatVisitQuoteRequest(request(), "pdf", deps);
  assert.equal(download.status, 200); assert.equal(download.headers.get("Content-Type"), "application/pdf");
  assert.ok(Buffer.from(await download.arrayBuffer()).equals(pdf));
  const response = await handleCatVisitQuoteRequest(request(), "send", deps);
  assert.equal(response.status, 200); assert.equal(sent, 1);
  assert.ok(requests[0].pdf.equals(pdf)); assert.equal(requests[0].message, mail.message);
  // Same payload and differently ordered/duplicated dates retain the same provider key.
  await handleCatVisitQuoteRequest(request({ ...body, document: { ...body.document, input: { ...body.document.input, dates: [...quote.dates].reverse().concat(quote.dates[0]) } } }), "send", deps);
  assert.equal(requests[0].key, requests[1].key);
  const alreadySent = await handleCatVisitQuoteRequest(request(), "send", { ...deps, findSent: async () => true });
  assert.equal((await alreadySent.json()).alreadySent, true); assert.equal(sent, 2);
  const initialError = console.error; console.error = () => {};
  try { assert.equal((await handleCatVisitQuoteRequest(request(), "send", { ...deps, send: async () => { throw new Error("Provider unavailable"); } })).status, 502); }
  finally { console.error = initialError; }
  if (process.env.QUOTE_PDF_OUTPUT_DIR) {
    await mkdir(process.env.QUOTE_PDF_OUTPUT_DIR, { recursive: true });
    await writeFile(path.join(process.env.QUOTE_PDF_OUTPUT_DIR, "devis-email-test.pdf"), pdf);
    const longQuote = calculateCatVisitQuote({ ...quote, dates: Array.from({ length: 45 }, (_, i) => addCalendarDays(today, i + 7)) });
    assert.ok(longQuote);
    assert.ok(buildCatVisitQuoteMail(longQuote, details).message.length < 6000);
    await writeFile(path.join(process.env.QUOTE_PDF_OUTPUT_DIR, "devis-email-long-test.pdf"), await renderCatVisitQuotePdf(longQuote, { ...details, notes: "Consignes de démonstration. ".repeat(40) }));
  }
  console.log("Quote email checks passed: authorization, validation, server pricing, PDF attachment, deterministic retry, duplicate protection and provider failure. No email sent.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
