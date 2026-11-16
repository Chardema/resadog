// Affichage de la carte demandé pour cette session uniquement : ce n'est pas
// un consentement Analytics/Ads et cela ne charge pas gtag.js. La carte ne se
// charge qu'après un clic sur « Afficher la carte », même si la mesure
// d'audience Google a été acceptée.
export const MAP_SESSION_STORAGE_KEY = "la-patte-doree-google-maps-session";

type MapPermissionWindow = {
  sessionStorage: Pick<Storage, "getItem">;
};

// `allowedInThisPage` sert de repli mémoire si sessionStorage est inaccessible
// (navigation restreinte).
export function hasMapPermission(win: MapPermissionWindow, allowedInThisPage: boolean) {
  if (allowedInThisPage) return true;
  try {
    return win.sessionStorage.getItem(MAP_SESSION_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function rememberMapForSession(win: { sessionStorage: Pick<Storage, "setItem"> }) {
  try {
    win.sessionStorage.setItem(MAP_SESSION_STORAGE_KEY, "1");
  } catch {
    // Stockage indisponible : la carte reste affichée pour cette page.
  }
}
