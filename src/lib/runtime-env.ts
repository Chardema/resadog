// Règle unique « production ou non » pour couper les services externes réels
// (GA/Ads, e-mails, uploads) sur les aperçus Vercel et en local.
//
// - Serveur : VERCEL_ENV (variable système Vercel, lue à l'exécution).
// - Navigateur : NEXT_PUBLIC_VERCEL_ENV (exposée automatiquement par Vercel,
//   figée dans le bundle au build).
// NODE_ENV n'est volontairement pas utilisé : il vaut "production" aussi dans
// les aperçus. Toute autre valeur (preview, development, absente…) = hors prod.
export function isProductionDeployment(): boolean {
  if (typeof window === "undefined") {
    return process.env.VERCEL_ENV === "production";
  }
  return process.env.NEXT_PUBLIC_VERCEL_ENV === "production";
}
