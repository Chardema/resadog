import { GOOGLE_CONSENT_STORAGE_KEY } from "@/lib/google-consent";

export const GOOGLE_ANALYTICS_ID =
  process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID?.trim() || "G-6HN68EFFPH";

export const GOOGLE_CONSENT_BOOTSTRAP = `
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  window.gtag = window.gtag || gtag;

  gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500
  });

  var storedGoogleConsent = null;
  try {
    storedGoogleConsent = window.localStorage.getItem('${GOOGLE_CONSENT_STORAGE_KEY}');
  } catch (error) {}

  if (storedGoogleConsent === 'accepted' || storedGoogleConsent === 'rejected') {
    var storedGoogleConsentValue = storedGoogleConsent === 'accepted' ? 'granted' : 'denied';
    gtag('consent', 'update', {
      analytics_storage: storedGoogleConsentValue,
      ad_storage: storedGoogleConsentValue,
      ad_user_data: storedGoogleConsentValue,
      ad_personalization: storedGoogleConsentValue
    });
  }
`;

export const GOOGLE_TAG_CONFIGURATION = `
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  window.gtag = window.gtag || gtag;
  gtag('js', new Date());
  gtag('config', '${GOOGLE_ANALYTICS_ID}', {
    cookie_expires: 34128000
  });
`;
