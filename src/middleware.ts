// Pour l'instant, on désactive le middleware NextAuth car il nécessite Node.js runtime
// On gérera l'authentification au niveau des pages et API routes
export { auth as middleware } from "@/lib/auth";

export const config = {
  // Matcher vide pour désactiver le middleware globalement
  // On protégera les routes manuellement dans les pages
  matcher: [],
};
