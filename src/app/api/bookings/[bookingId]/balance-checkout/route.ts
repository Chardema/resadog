import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createBalanceCheckoutSession, isBalanceCollectionEnabled } from "@/lib/balance-collection";
import { getStripeCheckoutLocale, getStripeReturnBaseUrl } from "@/lib/stripe/checkout";

// Reprise du solde après un échec (spec 07, lot 5) : chaque clic sur « Régler
// le solde » crée une session Checkout fraîche (3DS sur session). L'e-mail ne
// contient jamais de lien Checkout, seulement la page authentifiée /pay.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  if (!isBalanceCollectionEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { bookingId } = await params;
  const baseUrl = getStripeReturnBaseUrl(request);
  const payPage = `${baseUrl}/dashboard/bookings/${encodeURIComponent(bookingId)}/pay`;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(`${baseUrl}/auth/signin?callbackUrl=${encodeURIComponent(`/dashboard/bookings/${bookingId}/pay`)}`, 303);
  }

  try {
    const result = await createBalanceCheckoutSession({
      bookingId,
      userId: session.user.id,
      returnBaseUrl: baseUrl,
      locale: getStripeCheckoutLocale(request),
    });
    if (result.ok) return NextResponse.redirect(result.url, 303);
    return NextResponse.redirect(`${payPage}?error=${result.reason}`, 303);
  } catch (error) {
    console.error(`balance-checkout ${bookingId}:`, error);
    return NextResponse.redirect(`${payPage}?error=STRIPE`, 303);
  }
}
