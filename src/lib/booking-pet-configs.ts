/**
 * Synchronise les configurations individuelles par animal avec la liste
 * d'identifiants actifs.
 *
 * - Conserve les configurations existantes des animaux toujours présents.
 * - Crée une configuration (via `createDefault`) pour les nouveaux animaux.
 * - Retire les animaux qui ne sont plus sélectionnés.
 *
 * Renvoie la MÊME référence `current` quand rien ne change : utilisée dans un
 * `setState((current) => ...)`, cela permet à React d'ignorer la mise à jour
 * et évite la boucle « Maximum update depth exceeded » sur /booking.
 */
export function syncPetConfigs<T>(
  current: Record<string, T>,
  petIds: readonly string[],
  createDefault: (petId: string) => T
): Record<string, T> {
  const uniqueIds = Array.from(new Set(petIds));
  const currentKeys = Object.keys(current);
  const unchanged =
    currentKeys.length === uniqueIds.length &&
    uniqueIds.every((id) => Object.prototype.hasOwnProperty.call(current, id));
  if (unchanged) return current;

  const next: Record<string, T> = {};
  for (const id of uniqueIds) {
    next[id] = Object.prototype.hasOwnProperty.call(current, id)
      ? current[id]
      : createDefault(id);
  }
  return next;
}
