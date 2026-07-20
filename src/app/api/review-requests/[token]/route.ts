import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getBookingEmailDetails } from "@/lib/booking-email-details";
import { sendWebsiteFeedbackNotification } from "@/lib/email";
import { z } from "zod";

const submitReviewSchema = z.object({
  serviceRating: z.number().int().min(1).max(5),
  serviceComment: z.string().trim().min(10, "Votre avis sur la prestation doit contenir au moins 10 caractères.").max(2000),
  websiteRating: z.number().int().min(1).max(5).optional(),
  websiteComment: z.string().trim().max(2000).optional(),
});

const formatReviewDate = (date: Date) =>
  date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const getPublicAuthor = (name: string | null) => {
  if (!name) return "Client La Patte Dorée";
  const [firstName] = name.trim().split(/\s+/);
  return firstName || "Client La Patte Dorée";
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const reviewRequest = await prisma.reviewRequest.findUnique({
      where: { token },
      include: {
        booking: {
          include: {
            client: { select: { name: true } },
            pets: { select: { name: true } },
            pet: { select: { name: true } },
          },
        },
      },
    });

    if (!reviewRequest) {
      return NextResponse.json({ error: "Lien d'avis introuvable" }, { status: 404 });
    }

    return NextResponse.json({
      request: {
        submittedAt: reviewRequest.submittedAt,
        booking: getBookingEmailDetails(reviewRequest.booking),
        clientName: reviewRequest.booking.client.name,
      },
    });
  } catch (error) {
    console.error("Erreur récupération demande d'avis:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const data = submitReviewSchema.parse(await request.json());
    const cleanWebsiteComment = data.websiteComment?.trim() || null;

    const result = await prisma.$transaction(async (tx) => {
      const reviewRequest = await tx.reviewRequest.findUnique({
        where: { token },
        include: {
          booking: {
            include: {
              client: { select: { name: true, email: true } },
            },
          },
        },
      });

      if (!reviewRequest) {
        throw new Error("NOT_FOUND");
      }

      if (reviewRequest.submittedAt) {
        throw new Error("ALREADY_SUBMITTED");
      }

      const review = await tx.review.create({
        data: {
          source: "WEBSITE",
          author: getPublicAuthor(reviewRequest.booking.client.name),
          rating: data.serviceRating,
          date: formatReviewDate(new Date()),
          content: data.serviceComment,
          isActive: true,
        },
      });

      await tx.reviewRequest.update({
        where: { id: reviewRequest.id },
        data: {
          submittedAt: new Date(),
          serviceRating: data.serviceRating,
          serviceComment: data.serviceComment,
          websiteRating: data.websiteRating ?? null,
          websiteComment: cleanWebsiteComment,
          reviewId: review.id,
        },
      });

      return {
        review,
        notification: {
          clientName: reviewRequest.booking.client.name || "Client La Patte Dorée",
          clientEmail: reviewRequest.booking.client.email,
          bookingId: reviewRequest.booking.id,
          serviceRating: data.serviceRating,
          serviceComment: data.serviceComment,
          websiteRating: data.websiteRating ?? null,
          websiteComment: cleanWebsiteComment,
        },
      };
    });

    try {
      await sendWebsiteFeedbackNotification(result.notification);
    } catch (emailError) {
      console.error("Avis enregistré, mais notification retour site non envoyée:", emailError);
    }

    return NextResponse.json({ review: result.review }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Données invalides" }, { status: 400 });
    }

    if (error instanceof Error && error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Lien d'avis introuvable" }, { status: 404 });
    }

    if (error instanceof Error && error.message === "ALREADY_SUBMITTED") {
      return NextResponse.json({ error: "Un avis a déjà été envoyé avec ce lien." }, { status: 409 });
    }

    console.error("Erreur soumission avis:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
