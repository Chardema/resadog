import { NextResponse } from "next/server";

/**
 * API de changement de rôle - DÉSACTIVÉE
 *
 * Cette API a été désactivée pour des raisons de sécurité.
 * Le compte administrateur doit être créé via le script:
 *
 * npm run create-admin
 *
 * La procédure complète est documentée dans le README.
 */

export async function PUT() {
  return NextResponse.json(
    {
      error: "Cette fonctionnalité a été désactivée pour des raisons de sécurité. Le compte administrateur doit être créé via le script de setup."
    },
    { status: 403 }
  );
}
