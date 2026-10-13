"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ArrowUpRight, MessageCircle, Star } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { GOOGLE_MAPS_PLACE_URL, GOOGLE_REVIEW_URL } from "@/lib/google-reviews";

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
  visitDate?: { year: number; month: number };
  translated?: boolean;
}

interface GooglePlaceSummary {
  rating: number;
  reviewCount: number;
  googleMapsUri: string;
  hasLiveReviews: boolean;
}

const sourceConfig: Record<string, { label: string; color: string; url?: string }> = {
  ALLOVOISINS: { label: "AlloVoisins", color: "bg-blue-50 text-blue-800", url: "https://www.allovoisins.com/p/meganemelique-1#avis" },
  ROVER: { label: "Rover", color: "bg-emerald-50 text-emerald-800", url: "https://www.rover.com/members/megane-m-le-paradis-des-animaux/" },
  GOOGLE: { label: "Google Maps", color: "border border-gray-200 bg-white text-gray-700", url: GOOGLE_MAPS_PLACE_URL },
  WEBSITE: { label: "La Patte Dorée", color: "bg-orange-50 text-orange-800" },
};

function StarRating({ rating }: { rating: number }) {
  const { t, locale } = useLanguage();
  const value = Math.min(5, Math.max(0, rating));
  return (
    <div data-no-translate className="relative inline-flex text-amber-600" role="img" aria-label={`${new Intl.NumberFormat(locale).format(value)} ${t("étoiles sur 5")}`}>
      <div aria-hidden="true" className="flex gap-1">{Array.from({ length: 5 }, (_, i) => <Star key={i} className="h-4 w-4" />)}</div>
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden" style={{ width: `${value * 20}%` }}><div className="flex w-max gap-1">{Array.from({ length: 5 }, (_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}</div></div>
    </div>
  );
}

// Remove only a known copied Rover header, leaving the testimonial itself intact.
function reviewContent(review: Review) {
  const content = review.content.trim();
  if (review.source !== "ROVER") return content;
  const lines = content.split(/\r?\n/);
  if (lines[0]?.trim() === review.author.trim() && lines[1]?.includes(" • ") && lines[2]?.trim() === "Photo de profil") {
    return lines.slice(3).join("\n").trim();
  }
  return content;
}

function ReviewCard({ review }: { review: Review }) {
  const { locale, t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const source = sourceConfig[review.source] || sourceConfig.WEBSITE;
  const isGoogle = review.source === "GOOGLE";
  const content = reviewContent(review);
  const published = review.publishTime ? new Date(review.publishTime) : null;
  const date = published && !Number.isNaN(published.getTime())
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(published)
    : review.date;
  const url = review.reviewUri || source.url;
  const author = (
    <>
      {isGoogle && review.authorPhotoUri ? (
        <Image src={review.authorPhotoUri} alt="" width={40} height={40} unoptimized className="h-10 w-10 shrink-0 rounded-full object-cover" />
      ) : (
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-50 font-bold text-orange-800">{review.author.charAt(0)}</span>
      )}
      <div className="min-w-0">
        <p data-no-translate className="truncate text-sm font-bold text-gray-900">{review.author}</p>
        <p data-no-translate className="mt-1 text-xs text-gray-500">{date}</p>
      </div>
    </>
  );

  return (
    <article className="flex min-w-0 flex-col rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-3">
        <span data-no-translate className={`rounded-full px-3 py-1 text-xs font-semibold ${source.color}`}>{source.label}</span>
        <StarRating rating={review.rating} />
      </div>
      {isGoogle && review.authorUri ? (
        <a href={review.authorUri} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-blue-600">{author}</a>
      ) : <div className="flex min-w-0 items-center gap-3">{author}</div>}
      <div className="mt-5 flex-1">
        <blockquote id={`review-${review.id}`} data-no-translate className={`whitespace-pre-line break-words text-sm leading-7 text-gray-700 ${expanded || content.length <= 280 ? "" : "line-clamp-6"}`}>{content}</blockquote>
        {content.length > 280 && (
          <button type="button" aria-expanded={expanded} aria-controls={`review-${review.id}`} aria-label={`${t(expanded ? "Réduire l’avis de" : "Lire l’avis de")} ${review.author}`} onClick={() => setExpanded(!expanded)} className="mt-2 min-h-11 text-sm font-bold text-orange-800 hover:underline">{expanded ? "Réduire l’avis" : "Lire la suite"}</button>
        )}
        {isGoogle && review.translated && <p className="mt-2 text-xs text-gray-500">Traduit par Google</p>}
        {isGoogle && review.visitDate && <p className="mt-2 text-xs text-gray-500">Visite : <span data-no-translate>{new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(review.visitDate.year, review.visitDate.month - 1, 1)))}</span></p>}
      </div>
      {url && <a href={url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-11 items-center gap-2 border-t border-gray-100 pt-4 text-xs font-bold text-gray-600 hover:text-orange-800">{isGoogle && review.reviewUri ? "Voir l’avis original" : "Voir les avis sur la plateforme"}<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></a>}
    </article>
  );
}

export function ReviewsSection() {
  const { locale } = useLanguage();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [googlePlace, setGooglePlace] = useState<GooglePlaceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchReviews() {
      setIsLoading(true);
      setHasError(false);
      try {
        const response = await fetch(`/api/reviews?locale=${locale}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]) });
        if (!response.ok) throw new Error("Reviews unavailable");
        const data = await response.json();
        if (!controller.signal.aborted) {
          setReviews(data.reviews || []);
          setGooglePlace(data.googlePlace || null);
        }
      } catch {
        if (!controller.signal.aborted) {
          setReviews([]);
          setGooglePlace(null);
          setHasError(true);
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }
    void fetchReviews();
    return () => controller.abort();
  }, [locale]);

  const hasGoogleRating = googlePlace && googlePlace.reviewCount > 0 && googlePlace.rating > 0;

  return (
    <section id="avis" aria-labelledby="reviews-title" className="scroll-mt-28 border-y border-orange-100 bg-orange-50/40 py-16 md:py-20">
      <div className="container mx-auto px-6">
        <div className="mb-8 grid items-center gap-8 lg:grid-cols-[1fr_auto]">
          <div className="max-w-2xl">
            <p className="mb-3 text-sm font-bold uppercase tracking-wider text-orange-800">Leurs mots, votre confiance</p>
            <h2 id="reviews-title" className="text-3xl font-extrabold tracking-tight text-gray-900 md:text-4xl">Des nouvelles après la garde</h2>
            <p className="mt-4 leading-7 text-gray-600">Des témoignages partagés sur La Patte Dorée, Rover ou Google Maps. La source est indiquée sur chaque avis.</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 lg:max-w-sm">
            <p data-no-translate className="text-sm font-semibold text-gray-700">Google Maps</p>
            {hasGoogleRating ? (
              <>
                <div className="mt-2 flex items-center gap-3"><span data-no-translate className="text-3xl font-extrabold text-gray-900">{new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(googlePlace.rating)}<span className="text-base font-normal text-gray-500"> / 5</span></span><StarRating rating={googlePlace.rating} /></div>
                <p className="mt-2 text-sm text-gray-600"><span data-no-translate>{googlePlace.reviewCount}</span> avis sur Google Maps</p>
              </>
            ) : <p className="mt-2 text-sm leading-6 text-gray-600">Consultez notre fiche et les avis directement sur Google Maps.</p>}
            <a href={googlePlace?.googleMapsUri || GOOGLE_MAPS_PLACE_URL} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-orange-800 hover:underline">Voir les avis Google<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></a>
          </div>
        </div>

        <div id="review-list" aria-busy={isLoading}>
          {isLoading ? (
            <div role="status">
              <span className="sr-only">Chargement des avis…</span>
              <div aria-hidden="true" className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-80 animate-pulse rounded-3xl border border-orange-100 bg-white" />)}</div>
            </div>
          ) : reviews.length > 0 ? (
            <div className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">{(showAll ? reviews : reviews.slice(0, 3)).map((review) => <ReviewCard key={review.id} review={review} />)}</div>
          ) : (
            <div role="status" className="flex items-start gap-3 rounded-2xl border border-orange-100 bg-white p-6 text-sm leading-6 text-gray-600"><MessageCircle className="mt-1 h-5 w-5 shrink-0 text-orange-700" aria-hidden="true" /><p>{hasError ? "Les avis ne peuvent pas être chargés pour le moment. Vous pouvez les consulter sur les plateformes ci-dessous." : "Retrouvez les témoignages sur nos profils ci-dessous."}</p></div>
          )}
        </div>
        {!isLoading && reviews.length > 3 && <div className="mt-6 text-center"><button type="button" aria-expanded={showAll} aria-controls="review-list" onClick={() => setShowAll(!showAll)} className="min-h-11 rounded-xl border border-orange-200 bg-white px-6 py-3 text-sm font-bold text-orange-800 transition-colors hover:bg-orange-50">{showAll ? "Afficher moins d’avis" : "Voir les autres avis"}</button></div>}
        {googlePlace?.hasLiveReviews && <p className="mt-6 max-w-3xl text-xs leading-5 text-gray-500">Sélection de cinq avis au maximum, classés par pertinence par Google Maps. Les avis ne sont pas vérifiés individuellement par Google, qui recherche et supprime les faux contenus identifiés.</p>}
        <div className="mt-8 flex flex-col justify-between gap-4 border-t border-orange-200/60 pt-6 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <a href={sourceConfig.ROVER.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-gray-600 hover:text-emerald-800">Rover<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></a>
            <a href={sourceConfig.ALLOVOISINS.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-gray-600 hover:text-blue-800">AlloVoisins<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></a>
          </div>
          <a href={GOOGLE_REVIEW_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-orange-800 hover:underline">Partager votre avis sur Google<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></a>
        </div>
      </div>
    </section>
  );
}
