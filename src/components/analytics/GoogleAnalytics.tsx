import Script from "next/script";
import { GOOGLE_CONSENT_STORAGE_KEY } from "@/lib/google-consent";

const googleAnalyticsId =
  process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID ?? "G-6HN68EFFPH";

export function GoogleAnalytics() {
  const consentBootstrap = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    window.gtag = window.gtag || gtag;

    var googleConsent = 'denied';
    try {
      googleConsent = window.localStorage.getItem('${GOOGLE_CONSENT_STORAGE_KEY}') === 'accepted'
        ? 'granted'
        : 'denied';
    } catch (error) {}

    gtag('consent', 'default', {
      analytics_storage: googleConsent,
      ad_storage: googleConsent,
      ad_user_data: googleConsent,
      ad_personalization: googleConsent,
      wait_for_update: 500
    });
  `;

  const googleTagConfiguration = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    window.gtag = window.gtag || gtag;
    gtag('js', new Date());
    gtag('config', '${googleAnalyticsId}', {
      cookie_expires: 34128000
    });
  `;

  return (
    <>
      <script
        id="google-consent-default"
        dangerouslySetInnerHTML={{ __html: consentBootstrap }}
      />
      <Script
        id="google-tag-manager"
        src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`}
        strategy="afterInteractive"
      />
      <Script id="google-tag-config" strategy="afterInteractive">
        {googleTagConfiguration}
      </Script>
    </>
  );
}
