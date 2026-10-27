import { HomePageClient } from "@/components/home/HomePageClient";
import { getInitialPublicReviews } from "@/lib/public-reviews";

export default async function Home() {
  const { reviews: initialReviews, googlePlace: initialGooglePlace } =
    await getInitialPublicReviews("fr");

  return (
    <HomePageClient
      initialReviews={initialReviews}
      initialGooglePlace={initialGooglePlace}
    />
  );
}
