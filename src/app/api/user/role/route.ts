import { NextResponse } from "next/server";

/**
 * API de changement de rôle - DÉSACTIVÉE
 *
 * Cette API a été désactivée pour des raisons de sécurité.
 * Le compte administrateur doit être créé via le script:
 *
 * npm run create-admin
 *
 * Voir le fichier ADMIN_SETUP.md pour plus d'informations.
 */

export async function PUT(request: Request) {
  return NextResponse.json(
    {
      error: "Cette fonctionnalité a été désactivée pour des raisons de sécurité. Le compte administrateur doit être créé via le script de setup."
    },
    { status: 403 }
  );
}
