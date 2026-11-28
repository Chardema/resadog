// Lecture défensive des réponses des API d'authentification : une page
// d'erreur HTML (500, proxy, timeout) ou un corps vide ne doit jamais faire
// apparaître une SyntaxError brute à l'écran.

export const SIGNUP_GENERIC_ERROR =
  "Inscription impossible pour le moment. Réessayez dans quelques instants ou écrivez-nous.";
export const SIGNIN_GENERIC_ERROR =
  "Connexion impossible pour le moment. Réessayez dans quelques instants ou écrivez-nous.";
export const NETWORK_ERROR =
  "Connexion au serveur impossible. Vérifiez votre connexion Internet puis réessayez.";
export const RATE_LIMIT_ERROR = "Trop de tentatives. Réessayez plus tard.";

const MAX_DISPLAYED_ERROR_LENGTH = 300;

type ApiResponseLike = Pick<Response, "ok" | "status" | "text">;

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; data: Record<string, unknown> | null };

/** Lit le corps en JSON sans jamais lever d'exception (null si illisible). */
export async function readJsonSafely(response: Pick<Response, "text">): Promise<unknown> {
  try {
    const text = await response.text();
    if (!text.trim()) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function pickErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const value = (body as Record<string, unknown>).error;
  if (typeof value !== "string") return null;
  const message = value.trim();
  return message && message.length <= MAX_DISPLAYED_ERROR_LENGTH ? message : null;
}

/** Message d'erreur affichable pour une réponse en échec. */
export async function extractApiError(response: ApiResponseLike, fallback: string): Promise<string> {
  const message = pickErrorMessage(await readJsonSafely(response));
  if (message) return message;
  if (response.status === 429) return RATE_LIMIT_ERROR;
  return fallback;
}

/** Réponse décodée : données si succès, message affichable sinon. */
export async function parseApiResponse<T = Record<string, unknown>>(
  response: ApiResponseLike,
  fallback: string
): Promise<ApiResult<T>> {
  const body = await readJsonSafely(response);
  if (response.ok) {
    return { ok: true, status: response.status, data: (body ?? {}) as T };
  }
  const data = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const error =
    pickErrorMessage(body) ?? (response.status === 429 ? RATE_LIMIT_ERROR : fallback);
  return { ok: false, status: response.status, error, data };
}
