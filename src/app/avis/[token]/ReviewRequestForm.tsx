"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ExternalLink, LoaderCircle, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GOOGLE_REVIEW_URL } from "@/lib/google-reviews";

type BookingDetails = {
  petName: string;
  startDate: string;
  endDate: string;
  serviceLabel?: string;
  bookingId?: string;
};

type ReviewRequestFormProps = {
  token: string;
  booking: BookingDetails;
  alreadySubmitted: boolean;
  isPreview?: boolean;
};

function RatingInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <p className="text-sm font-bold text-gray-900">{label}</p>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            type="button"
            onClick={() => onChange(rating)}
            className="rounded-md p-1 text-amber-400 transition hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
            aria-label={`${rating} étoile${rating > 1 ? "s" : ""}`}
          >
            <Star className={`h-7 w-7 ${rating <= value ? "fill-current" : ""}`} />
          </button>
        ))}
      </div>
    </div>
  );
}

export function ReviewRequestForm({ token, booking, alreadySubmitted, isPreview = false }: ReviewRequestFormProps) {
  const [serviceRating, setServiceRating] = useState(5);
  const [serviceComment, setServiceComment] = useState("");
  const [websiteRating, setWebsiteRating] = useState(5);
  const [websiteComment, setWebsiteComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(alreadySubmitted);

  const submitReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isPreview) {
      setSubmitted(true);
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/review-requests/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceRating,
          serviceComment,
          websiteRating,
          websiteComment: websiteComment.trim() || undefined,
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Impossible d'envoyer votre avis.");
      }

      window.gtag?.("event", "review_form_submit", {
        event_category: "reviews",
        event_label: "website_review_form",
        transport_type: "beacon",
      });
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Impossible d'envoyer votre avis.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    const trackGoogleReviewClick = () => {
      window.gtag?.("event", "google_review_click", {
        event_category: "reviews",
        event_label: "review_confirmation",
        transport_type: "beacon",
      });
    };

    return (
      <div className="rounded-lg border border-emerald-200 bg-white p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
        <h1 className="mt-4 text-2xl font-bold text-gray-950">Merci pour votre avis</h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          {isPreview
            ? "Le test est terminé. Aucun avis n'a été enregistré."
            : "Votre retour sur la prestation a bien été enregistré et peut maintenant apparaître dans les avis du site."}
        </p>
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center justify-center gap-1 text-amber-500" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star key={star} className="h-5 w-5 fill-current" />
            ))}
          </div>
          <h2 className="mt-3 text-lg font-bold text-gray-950">Partager aussi votre expérience sur Google</h2>
          <p className="mt-2 text-sm leading-6 text-gray-700">
            Votre avis Google aide les familles près de Disneyland Paris à trouver une personne de confiance pour leur animal.
          </p>
          <a
            href={GOOGLE_REVIEW_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={trackGoogleReviewClick}
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-gray-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2"
          >
            Publier mon avis sur Google
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
          <p className="mt-3 text-xs leading-5 text-gray-500">
            La publication sur Google est facultative et s’ouvre dans un nouvel onglet.
          </p>
        </div>
        <Link href="/" className="mt-6 inline-flex text-sm font-bold text-orange-700 hover:text-orange-800">
          Retour à l'accueil
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submitReview} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-orange-700">Avis client</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-950">Votre retour après la prestation</h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          {isPreview
            ? "Mode test : vous pouvez parcourir le formulaire sans enregistrer d'avis."
            : "L'avis sur la prestation pourra être affiché sur le site. Le retour sur le site internet reste interne."}
        </p>
      </div>

      {isPreview && (
        <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-900">
          Ceci est un aperçu. Le bouton d'envoi ne publiera rien sur le site.
        </div>
      )}

      <div className="mt-6 rounded-lg border border-orange-100 bg-orange-50 p-4 text-sm text-orange-950">
        <p className="font-bold">{booking.serviceLabel || "Prestation"} pour {booking.petName}</p>
        <p className="mt-1">{booking.startDate} au {booking.endDate}</p>
      </div>

      <div className="mt-7 space-y-7">
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-gray-950">1. Avis sur la prestation</h2>
            <p className="mt-1 text-sm text-gray-600">Ce texte sera utilisé dans les avis visibles sur le site.</p>
          </div>
          <RatingInput label="Note de la prestation" value={serviceRating} onChange={setServiceRating} />
          <div>
            <label htmlFor="service-comment" className="text-sm font-bold text-gray-900">
              Votre avis
            </label>
            <textarea
              id="service-comment"
              required
              minLength={10}
              maxLength={2000}
              value={serviceComment}
              onChange={(event) => setServiceComment(event.target.value)}
              className="mt-2 h-32 w-full resize-none rounded-lg border border-gray-300 p-3 text-sm outline-none transition focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
              placeholder="Comment s'est passée la garde ?"
            />
          </div>
        </section>

        <section className="space-y-4 border-t border-gray-100 pt-7">
          <div>
            <h2 className="text-lg font-bold text-gray-950">2. Avis sur le site internet</h2>
            <p className="mt-1 text-sm text-gray-600">Ce retour sert à améliorer le parcours de réservation.</p>
          </div>
          <RatingInput label="Note du site internet" value={websiteRating} onChange={setWebsiteRating} />
          <div>
            <label htmlFor="website-comment" className="text-sm font-bold text-gray-900">
              Commentaire optionnel
            </label>
            <textarea
              id="website-comment"
              maxLength={2000}
              value={websiteComment}
              onChange={(event) => setWebsiteComment(event.target.value)}
              className="mt-2 h-28 w-full resize-none rounded-lg border border-gray-300 p-3 text-sm outline-none transition focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
              placeholder="Le site était-il simple à utiliser ?"
            />
          </div>
        </section>
      </div>

      {error && (
        <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
          {error}
        </div>
      )}

      <Button type="submit" disabled={isSubmitting} className="mt-6 w-full bg-orange-600 text-white hover:bg-orange-700">
        {isSubmitting ? (
          <>
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Envoi en cours
          </>
        ) : (
          isPreview ? "Tester l'envoi" : "Envoyer mon avis"
        )}
      </Button>
    </form>
  );
}
