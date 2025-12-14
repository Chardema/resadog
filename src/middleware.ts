import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Middleware simple sans NextAuth (pour éviter les problèmes Edge Runtime)
// La vérification de l'authentification se fait au niveau des pages
export function middleware(request: NextRequest) {
  // Pour l'instant, on laisse passer toutes les requêtes
  // La protection se fait au niveau des pages avec auth() de NextAuth
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
