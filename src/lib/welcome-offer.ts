export const WELCOME_OFFER_CODE = "BIENVENUE10";
export const WELCOME_OFFER_DISCOUNT_PERCENT = 10;
export const WELCOME_OFFER_MAX_CLIENTS = 5;
export const WELCOME_OFFER_NOTE = `Code promo: ${WELCOME_OFFER_CODE}`;
export const WELCOME_OFFER_DESCRIPTION = "Offre de bienvenue : -10 % sur votre première réservation";
export const WELCOME_OFFER_LOCK_ID = 17072026;
export const WELCOME_OFFER_CHECKOUT_MINUTES = 31;

export function isWelcomeOfferCode(code: string | null | undefined) {
  return code?.trim().toUpperCase() === WELCOME_OFFER_CODE;
}
