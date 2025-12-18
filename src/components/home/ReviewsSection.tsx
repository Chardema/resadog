"use client";

import { motion } from "framer-motion";
import { reviews } from "@/data/reviews";
import Image from "next/link"; // Not used directly for images yet

const StarRating = ({ rating }: { rating: number }) => {
  return (
    <div className="flex gap-0.5">
      {[...Array(5)].map((_, i) => (
        <span key={i} className={`text-lg ${i < rating ? "text-yellow-400" : "text-gray-200"}`}>
          ★
        </span>
      ))}
    </div>
  );
};

export function ReviewsSection() {
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

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reviews.map((review, index) => (
            <motion.div
              key={review.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -5 }}
              className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100 flex flex-col h-full"
            >
              {/* Header: Source & Date */}
              <div className="flex justify-between items-start mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  review.source === "AlloVoisins" 
                    ? "bg-blue-100 text-blue-700" 
                    : "bg-green-100 text-green-700"
                }`}>
                  {review.source === "AlloVoisins" ? "AlloVoisins" : "Rover"}
                </span>
                <span className="text-xs text-gray-400">{review.date}</span>
              </div>

              {/* Content */}
              <div className="flex-1 mb-4">
                <StarRating rating={review.rating} />
                <p className="text-gray-700 mt-3 italic text-sm leading-relaxed">
                  "{review.content}"
                </p>
              </div>

              {/* Footer: Author */}
              <div className="flex items-center gap-3 pt-4 border-t border-gray-50">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center font-bold text-gray-500 text-sm">
                  {review.author.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">{review.author}</p>
                  <p className="text-xs text-gray-500">Propriétaire vérifié</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Links to profiles */}
        <div className="mt-12 flex justify-center gap-4 flex-wrap">
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
