/**
 * Rate limiter en mémoire pour les endpoints sensibles.
 * Adapté au modèle serverless Vercel (chaque instance a son propre state).
 * Pour un rate limiting distribué, utiliser Upstash Redis.
 */

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Nettoyage périodique des entrées expirées
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60_000); // Toutes les 60 secondes

interface RateLimitOptions {
  /** Nombre max de requêtes dans la fenêtre */
  maxRequests: number;
  /** Durée de la fenêtre en secondes */
  windowSeconds: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetIn: number;
}

export function rateLimit(
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  const windowMs = options.windowSeconds * 1000;

  const existing = rateLimitMap.get(key);

  if (!existing || now > existing.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return { success: true, remaining: options.maxRequests - 1, resetIn: options.windowSeconds };
  }

  if (existing.count >= options.maxRequests) {
    const resetIn = Math.ceil((existing.resetTime - now) / 1000);
    return { success: false, remaining: 0, resetIn };
  }

  existing.count++;
  return {
    success: true,
    remaining: options.maxRequests - existing.count,
    resetIn: Math.ceil((existing.resetTime - now) / 1000),
  };
}
