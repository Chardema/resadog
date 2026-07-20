import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getBookingEmailDetails } from "@/lib/booking-email-details";
import { ReviewRequestForm } from "./ReviewRequestForm";

export default async function ReviewRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { token } = await params;
  const { preview } = await searchParams;
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

  if (!reviewRequest) notFound();

  return (
    <main className="min-h-screen bg-[#FDFbf7] px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="mb-6 inline-flex text-sm font-bold text-orange-700 hover:text-orange-800">
          La Patte Dorée
        </Link>
        <ReviewRequestForm
          token={token}
          booking={getBookingEmailDetails(reviewRequest.booking)}
          alreadySubmitted={Boolean(reviewRequest.submittedAt)}
          isPreview={preview === "1"}
        />
      </div>
    </main>
  );
}
