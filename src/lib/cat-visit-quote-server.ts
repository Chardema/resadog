import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { sendCatVisitQuoteEmail } from "@/lib/email";
import { distributedRateLimit } from "@/lib/rate-limit";
import { handleCatVisitQuoteRequest } from "@/lib/cat-visit-quote-api";
import { renderCatVisitQuotePdf } from "@/lib/cat-visit-quote-pdf";

export function catVisitQuoteRoute(request: Request, mode: "pdf" | "send") {
  return handleCatVisitQuoteRequest(request, mode, {
    authorize: async () => {
      const session = await auth();
      return session?.user?.id && session.user.role === "ADMIN" ? session.user.id : null;
    },
    renderPdf: renderCatVisitQuotePdf,
    findSent: async (key) => Boolean(await prisma.emailLog.findFirst({
      where: { idempotencyKey: key, status: { in: ["SENT", "DELIVERED", "BOUNCED", "COMPLAINED"] } }, select: { id: true },
    })),
    limit: (adminId) => distributedRateLimit(`cat-visit-quote:${adminId}`, { maxRequests: 10, windowSeconds: 60 }),
    send: sendCatVisitQuoteEmail,
  });
}
