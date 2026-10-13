import { redirect } from "next/navigation";
import { GOOGLE_REVIEW_URL } from "@/lib/google-reviews";

export default function LegacyReviewPage() {
  redirect(GOOGLE_REVIEW_URL);
}
