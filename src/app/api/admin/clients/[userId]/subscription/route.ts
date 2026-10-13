import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe/config";
import Stripe from "stripe";
import { z } from "zod";
import {
  getSubscriptionRefundPreview,
  refundLatestSubscriptionPayment,
} from "@/lib/stripe/subscription-refunds";
import { sendSubscriptionRefundCompletedEmail } from "@/lib/email";

const refundConfirmationSchema = z.object({
  confirmation: z.literal("REFUND_LATEST_PAYMENT_AND_CANCEL"),
});

async function requireAdmin() {
  const session = await auth();
  return session?.user?.id && session.user.role === "ADMIN" ? session : null;
}

function stripeErrorResponse(error: unknown, fallback: string) {
  if (error instanceof Stripe.errors.StripeError) {
    return NextResponse.json(
      { error: error.message || fallback },
      { status: error.statusCode && error.statusCode >= 400 ? error.statusCode : 502 }
    );
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: 500 }
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: "Interdit" }, { status: 403 });

    const { userId } = await params;
    const subscription = await prisma.userSubscription.findUnique({
      where: { userId },
      select: { stripeSubscriptionId: true, status: true },
    });

    if (!subscription?.stripeSubscriptionId) {
      return NextResponse.json({ error: "Abonnement introuvable" }, { status: 404 });
    }

    const preview = await getSubscriptionRefundPreview(subscription.stripeSubscriptionId);
    if (!preview) {
      return NextResponse.json(
        { error: "Aucune échéance Premium payée n'a été trouvée." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      subscriptionStatus: subscription.status,
      invoice: {
        id: preview.invoiceId,
        number: preview.invoiceNumber,
        createdAt: preview.invoiceCreatedAt,
        currency: preview.currency,
        amountPaid: preview.amountPaidCents / 100,
        alreadyRefunded: preview.alreadyRefundedCents / 100,
        refundableAmount: preview.refundableAmountCents / 100,
        latestRefundStatus: preview.latestRefundStatus,
      },
    });
  } catch (error) {
    console.error("Erreur préparation remboursement abonnement:", error);
    return stripeErrorResponse(error, "Impossible de préparer le remboursement Stripe.");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: "Interdit" }, { status: 403 });

    const confirmation = refundConfirmationSchema.parse(await request.json());
    if (confirmation.confirmation !== "REFUND_LATEST_PAYMENT_AND_CANCEL") {
      return NextResponse.json({ error: "Confirmation invalide" }, { status: 400 });
    }

    const { userId } = await params;
    const subscription = await prisma.userSubscription.findUnique({
      where: { userId },
      select: {
        stripeSubscriptionId: true,
        user: { select: { email: true, name: true } },
      },
    });

    if (!subscription?.stripeSubscriptionId) {
      return NextResponse.json({ error: "Abonnement introuvable" }, { status: 404 });
    }

    const result = await refundLatestSubscriptionPayment({
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      userId,
      adminUserId: session.user.id,
    });

    await prisma.userSubscription.update({
      where: { userId },
      data: { status: "CANCELED" },
    });

    let emailStatus: "SENT" | "PENDING" | "FAILED" = "PENDING";
    if (result.refundId && result.refundStatus === "succeeded") {
      try {
        await sendSubscriptionRefundCompletedEmail(
          subscription.user.email,
          subscription.user.name || "Client",
          {
            amount: (result.refundedAmountCents + result.alreadyRefundedCents) / 100,
            refundId: result.refundId,
          },
          { idempotencyKey: `subscription-refund-completed-${result.refundId}` }
        );
        emailStatus = "SENT";
      } catch (emailError) {
        emailStatus = "FAILED";
        console.error("SUBSCRIPTION_REFUND_EMAIL_FAILED", emailError);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Remboursement accepté par Stripe et abonnement résilié immédiatement.",
      invoiceNumber: result.invoiceNumber,
      refundId: result.refundId,
      refundStatus: result.refundStatus,
      refundedAmount: result.refundedAmountCents / 100,
      alreadyRefunded: result.alreadyRefundedCents / 100,
      subscriptionCanceled: result.subscriptionCanceled,
      emailStatus,
    });
  } catch (error) {
    console.error("Erreur remboursement abonnement admin:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Confirmation de remboursement invalide" }, { status: 400 });
    }
    return stripeErrorResponse(error, "Le remboursement de l'abonnement a échoué.");
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: "Interdit" }, { status: 403 });
    }

    const { userId } = await params;

    const subscription = await prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (!subscription || !subscription.stripeSubscriptionId) {
      return NextResponse.json({ error: "Abonnement introuvable" }, { status: 404 });
    }

    // Résilier à échéance pour ne pas couper un service déjà payé.
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    return NextResponse.json({
      success: true,
      message: "Résiliation programmée à la fin de la période",
    });
  } catch (error) {
    console.error("Erreur résiliation admin:", error);
    return stripeErrorResponse(error, "Erreur serveur");
  }
}
