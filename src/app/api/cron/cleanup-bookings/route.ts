import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  // Vérification de sécurité (Vercel Cron envoie un header spécifique)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // En local ou sans secret, on peut autoriser pour tester si besoin, 
    // mais en prod c'est mieux de sécuriser.
    // Pour l'instant, on laisse ouvert si pas de secret défini (pour faciliter le test)
    if (process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    // Calculer la date il y a 1 heure
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Supprimer les réservations PENDING créées il y a plus d'1h et sans paiement réussi
    const deleted = await prisma.booking.deleteMany({
      where: {
        status: "PENDING",
        createdAt: {
          lt: oneHourAgo,
        },
        // S'assurer qu'on ne supprime pas une résa qui a un paiement en cours/réussi
        // (bien que normalement PENDING = pas encore validé par webhook)
        payment: {
          is: null, // Pas de tentative de paiement enregistrée
        },
      },
    });

    // Nettoyer aussi les paiements "PROCESSING" abandonnés depuis 24h (au cas où)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const oldBookings = await prisma.booking.findMany({
      where: {
        status: "PENDING",
        createdAt: { lt: oneHourAgo },
        payment: {
          status: "PROCESSING", // Paiement initié mais jamais fini
          createdAt: { lt: oneDayAgo } // Abandonné depuis longtemps
        }
      }
    });
    
    // On supprime ces réservations une par une (cascade supprimera le paiement)
    for (const b of oldBookings) {
      await prisma.booking.delete({ where: { id: b.id } });
    }

    return NextResponse.json({
      success: true,
      deletedPending: deleted.count,
      deletedAbandoned: oldBookings.length,
      message: `Nettoyage effectué : ${deleted.count + oldBookings.length} réservations supprimées.`
    });
  } catch (error) {
    console.error("Erreur Cron Cleanup:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
