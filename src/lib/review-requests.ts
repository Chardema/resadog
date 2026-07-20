import crypto from "crypto";
import { prisma } from "@/lib/db/prisma";
import { getBookingEmailDetails } from "@/lib/booking-email-details";
import { sendReviewRequestEmail } from "@/lib/email";

const APP_URL = process.env.NEXTAUTH_URL || "https://resadog.vercel.app";

type ReviewBooking = {
  id: string;
  clientId: string;
  startDate: Date;
  endDate: Date;
  totalPrice: number;
  serviceType: string;
  pets?: { name: string }[];
  pet?: { name: string | null } | null;
  client: {
    email: string;
    name: string | null;
  };
};

export function getReviewRequestUrl(token: string) {
  return `${APP_URL}/avis/${token}`;
}

export function getBookingCompletionDate(booking: { endDate: Date; endTime?: string | null }) {
  const completedAt = new Date(booking.endDate);
  const [hours, minutes] = booking.endTime?.split(":").map(Number) || [];

  if (Number.isInteger(hours) && Number.isInteger(minutes)) {
    completedAt.setUTCHours(hours, minutes, 0, 0);
    return completedAt;
  }

  completedAt.setUTCHours(23, 59, 59, 999);
  return completedAt;
}

async function createToken() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const token = crypto.randomBytes(24).toString("hex");
    const existing = await prisma.reviewRequest.findUnique({ where: { token } });
    if (!existing) return token;
  }

  throw new Error("Impossible de créer un jeton d'avis unique.");
}

export async function ensureReviewRequest(booking: ReviewBooking) {
  const existing = await prisma.reviewRequest.findUnique({
    where: { bookingId: booking.id },
  });

  if (existing) return existing;

  return prisma.reviewRequest.create({
    data: {
      token: await createToken(),
      bookingId: booking.id,
      clientId: booking.clientId,
    },
  });
}

export async function sendReviewRequestForBooking(
  booking: ReviewBooking,
  options?: { idempotencyKey?: string }
) {
  const reviewRequest = await ensureReviewRequest(booking);

  await sendReviewRequestEmail(
    booking.client.email,
    booking.client.name || "Client",
    getBookingEmailDetails(booking),
    getReviewRequestUrl(reviewRequest.token),
    { idempotencyKey: options?.idempotencyKey || `booking-review-request-${booking.id}` }
  );

  return reviewRequest;
}
