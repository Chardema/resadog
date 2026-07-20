"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { GOOGLE_MAPS_PLACE_URL } from "@/lib/google-reviews";

interface Review {
  id: string;
  source: string;
  author: string;
  rating: number;
  date: string;
  content: string;
  authorUri?: string;
  authorPhotoUri?: string;
  reviewUri?: string;
  publishTime?: string;
  visitDate?: {
    year: number;
    month: number;
  };
  translated?: boolean;
}

interface GooglePlaceSummary {
  rating: number;
  reviewCount: number;
  googleMapsUri: string;
  hasLiveReviews: boolean;
}

const StarRating = ({ rating }: { rating: number }) => (
  <div className="flex gap-0.5" role="img" aria-label={`${rating} étoiles sur 5`}>
    {[...Array(5)].map((_, i) => (
      <span aria-hidden="true" key={i} className={`text-lg ${i < rating ? "text-yellow-400" : "text-gray-200"}`}>★</span>
    ))}
  </div>
);

const sourceConfig: Record<string, { label: string; color: string }> = {
  ALLOVOISINS: { label: "AlloVoisins", color: "bg-blue-100 text-blue-700" },
  ROVER: { label: "Rover", color: "bg-green-100 text-green-700" },
  GOOGLE: { label: "Google Maps", color: "border border-gray-200 bg-white text-[#5e5e5e]" },
  WEBSITE: { label: "La Patte Dorée", color: "bg-orange-100 text-orange-700" },
};

function formatReviewDate(review: Review, locale: string) {
  if (!review.publishTime) return review.date;
  const date = new Date(review.publishTime);
  if (Number.isNaN(date.getTime())) return review.date;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

function formatVisitDate(review: Review, locale: string) {
  if (!review.visitDate) return null;
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(review.visitDate.year, review.visitDate.month - 1, 1))
  );
}

export function ReviewsSection() {
  const { locale } = useLanguage();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [googlePlace, setGooglePlace] = useState<GooglePlaceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    const fetchReviews = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/reviews?locale=${locale}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setReviews(data.reviews || []);
          setGooglePlace(data.googlePlace || null);
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("Erreur chargement avis:", error);
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    fetchReviews();

    return () => controller.abort();
  }, [locale]);

  if (isLoading) {
    return (
      <section className="py-20 bg-gradient-to-b from-white to-orange-50/50">
        <div className="container mx-auto px-6 text-center">
          <div className="text-4xl animate-pulse">⭐</div>
        </div>
      </section>
    );
  }

  if (reviews.length === 0 && !googlePlace) return null;

  return (
    <section className="py-20 bg-gradient-to-b from-white to-orange-50/50">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
            Ils nous font confiance ❤️
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg">
            Découvrez les retours de nos clients sur nos plateformes partenaires.
            Votre compagnon mérite ce qu'il y a de mieux.
          </p>
        </motion.div>

        {googlePlace && (
          <div className="mx-auto mb-8 flex max-w-4xl flex-col items-center justify-between gap-5 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:flex-row sm:px-6">
            <div className="text-center sm:text-left">
              <p
                translate="no"
                data-no-translate
                className="whitespace-nowrap text-sm font-normal text-[#5e5e5e]"
              >
                Google Maps
              </p>
              <div className="mt-1 flex items-center justify-center gap-3 sm:justify-start">
                <span className="text-2xl font-extrabold text-gray-950">
                  {googlePlace.rating.toFixed(1)}/5
                </span>
                <StarRating rating={Math.round(googlePlace.rating)} />
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {googlePlace.reviewCount} avis publiés sur Google Maps
              </p>
            </div>
            <a
              href={googlePlace.googleMapsUri}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-5 text-sm font-bold text-gray-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              Voir tous les avis sur Google Maps →
            </a>
          </div>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reviews.map((review, index) => {
            const source = sourceConfig[review.source] || sourceConfig.WEBSITE;
            const isGoogleReview = review.source === "GOOGLE" && Boolean(review.reviewUri);
            const visitDate = formatVisitDate(review, locale);
            const googleAuthorAvatar = review.authorPhotoUri ? (
              <Image
                src={review.authorPhotoUri}
                alt={review.author}
                width={40}
                height={40}
                unoptimized
                className="h-10 w-10 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center font-bold text-blue-600 text-sm">
                {review.author.charAt(0)}
              </div>
            );
            return (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -5 }}
                className={`bg-white p-6 rounded-3xl shadow-lg border flex flex-col h-full ${
                  isGoogleReview ? "border-blue-100" : "border-gray-100"
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <span
                    translate={isGoogleReview ? "no" : undefined}
                    data-no-translate={isGoogleReview ? true : undefined}
                    className={`whitespace-nowrap px-3 py-1 rounded-full text-xs ${
                      isGoogleReview ? "font-normal" : "font-bold"
                    } ${source.color}`}
                  >
                    {source.label}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatReviewDate(review, locale)}
                  </span>
                </div>

                <div className="flex-1 mb-4">
                  <StarRating rating={review.rating} />
                  <p
                    data-no-translate={isGoogleReview ? true : undefined}
                    className="text-gray-700 mt-3 italic text-sm leading-relaxed"
                  >
                    &ldquo;{review.content}&rdquo;
                  </p>
                  {isGoogleReview && review.translated && (
                    <p className="mt-2 text-xs text-gray-400">Traduit par Google</p>
                  )}
                  {isGoogleReview && visitDate && (
                    <p className="mt-2 text-xs text-gray-500">Visite : {visitDate}</p>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-gray-50">
                  {isGoogleReview && review.authorUri ? (
                    <a
                      href={review.authorUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      {googleAuthorAvatar}
                      <div className="min-w-0">
                        <p data-no-translate className="truncate font-bold text-gray-900 text-sm">{review.author}</p>
                        <p className="text-xs text-gray-500">Profil Google Maps</p>
                      </div>
                    </a>
                  ) : isGoogleReview ? (
                    <div className="flex min-w-0 items-center gap-3">
                      {googleAuthorAvatar}
                      <div className="min-w-0">
                        <p data-no-translate className="truncate font-bold text-gray-900 text-sm">{review.author}</p>
                        <p className="text-xs text-gray-500">Avis publié sur Google Maps</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center font-bold text-gray-500 text-sm">
                        {review.author.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{review.author}</p>
                        <p className="text-xs text-gray-500">Propriétaire vérifié</p>
                      </div>
                    </>
                  )}
                </div>

                {isGoogleReview && review.reviewUri && (
                  <a
                    href={review.reviewUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 text-xs font-bold text-blue-700 underline-offset-4 hover:underline"
                  >
                    Voir l’avis original sur Google Maps ↗
                  </a>
                )}
              </motion.div>
            );
          })}
        </div>

        {googlePlace?.hasLiveReviews && (
          <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-5 text-gray-500">
            Sélection de cinq avis au maximum, classés par pertinence par Google Maps. Les avis ne sont pas vérifiés individuellement par Google, qui recherche et supprime les faux contenus identifiés.
          </p>
        )}

        {/* Liens vers les profils */}
        <div className="mt-12 flex justify-center gap-4 flex-wrap">
          <a
            href={googlePlace?.googleMapsUri || GOOGLE_MAPS_PLACE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all text-gray-700 font-medium text-sm"
          >
            <span translate="no" data-no-translate className="font-normal text-[#5e5e5e]">Google Maps</span> Voir tous les avis →
          </a>
          <a
            href="https://www.allovoisins.com/p/meganemelique-1#avis"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all text-gray-700 font-medium text-sm"
          >
            <span className="text-blue-500 font-bold">AlloVoisins</span> Voir tous les avis →
          </a>
          <a
            href="https://www.rover.com/members/megane-m-le-paradis-des-animaux/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all text-gray-700 font-medium text-sm"
          >
            <span className="text-green-500 font-bold">Rover</span> Voir le profil →
          </a>
        </div>
      </div>
    </section>
  );
}
