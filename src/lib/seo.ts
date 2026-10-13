import type { Metadata } from "next";
import { LEGAL_INFORMATION } from "@/lib/legal";
import { INSTAGRAM_URL } from "@/lib/social-links";

export const SITE_NAME = "La Patte Dorée";
export const SEO_LAST_MODIFIED = "2026-09-04";

export const coreKeywords = [
  "garde chien Disneyland Paris",
  "garde chat 77",
  "garde chien 77",
  "garde animaux 77",
  "pension chien 77",
  "visite chat domicile 77",
  "petsitter Disneyland Paris",
  "garde animaux Seine-et-Marne",
  "garde chien Val d'Europe",
  "garde chat Seine-et-Marne",
];

const coreServiceAreas = [
  "Disneyland Paris",
  "Val d'Europe",
  "Chessy",
  "Serris",
  "Montévrain",
  "Magny-le-Hongre",
  "Coupvray",
  "Bailly-Romainvilliers",
  "Seine-et-Marne",
  "77",
];

export type LocalSeoPage = {
  slug: string;
  path: string;
  title: string;
  metaTitle: string;
  description: string;
  eyebrow: string;
  lead: string;
  intent: string;
  keywords: string[];
  areas: string[];
  proofPoints: string[];
  services: Array<{
    title: string;
    text: string;
  }>;
  sections: Array<{
    title: string;
    body: string;
    bullets: string[];
  }>;
  faqs: Array<{
    question: string;
    answer: string;
  }>;
  ctaLabel: string;
  disneyDisclaimer?: boolean;
};

export function getSiteUrl() {
  const rawUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.VERCEL_URL ||
    "https://resadog.vercel.app";
  const withProtocol = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
  return withProtocol.replace(/\/$/, "");
}

export function absoluteUrl(path = "/") {
  if (path.startsWith("http")) return path;
  return `${getSiteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export function buildMetadata({
  title,
  description,
  path,
  keywords = [],
  noIndex = false,
}: {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  noIndex?: boolean;
}): Metadata {
  return {
    metadataBase: new URL(getSiteUrl()),
    title,
    description,
    keywords: [...keywords, ...coreKeywords],
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: "fr_FR",
      type: "website",
      images: [
        {
          url: "/logo-mark.png",
          width: 512,
          height: 512,
          alt: "Emblème La Patte Dorée",
        },
      ],
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: ["/logo-mark.png"],
    },
    robots: noIndex
      ? {
          index: false,
          follow: true,
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-snippet": -1,
            "max-image-preview": "large",
            "max-video-preview": -1,
          },
        },
  };
}

export const localSeoPages: LocalSeoPage[] = [
  {
    slug: "garde-chien-disneyland-paris",
    path: "/garde-chien-disneyland-paris",
    title: "Garde chien près de Disneyland Paris",
    metaTitle: "Garde chien Disneyland Paris | Petsitter familial 77",
    description:
      "Garde de chien près de Disneyland Paris : hébergement familial, garderie, visites et promenades autour de Val d'Europe, photos et réservation en ligne.",
    eyebrow: "Garde chien Disneyland Paris",
    lead:
      "Vous passez la journée aux parcs, partez en week-end à Val d'Europe ou cherchez une solution de garde locale ? La Patte Dorée accueille votre chien dans un cadre familial, sans box, avec une prise en charge adaptée à son rythme.",
    intent:
      "Une solution locale pour les propriétaires qui cherchent une garde de chien fiable autour de Disneyland Paris, Chessy, Serris, Montévrain et Val d'Europe.",
    keywords: [
      "garde chien Disneyland Paris",
      "petsitter Disneyland Paris",
      "dog sitter Disneyland Paris",
      "garde chien Val d'Europe",
      "pension chien Disneyland Paris",
    ],
    areas: ["Disneyland Paris", "Chessy", "Serris", "Montévrain", "Magny-le-Hongre", "Coupvray", "Bailly-Romainvilliers", "Val d'Europe"],
    proofPoints: [
      "Profil animal vérifié avant confirmation",
      "Garde familiale sans box",
      "Photos et nouvelles pendant la garde",
      "Réservation et paiement en ligne",
    ],
    services: [
      {
        title: "Hébergement familial",
        text: "Votre chien dort dans un environnement de maison, avec présence, sorties et attention quotidienne.",
      },
      {
        title: "Garderie de jour",
        text: "Une garde sur la journée pendant vos sorties à Disneyland Paris, votre travail ou vos rendez-vous.",
      },
      {
        title: "Promenades",
        text: "Des balades adaptées à l'énergie de votre chien, avec un rythme fixé selon ses habitudes.",
      },
      {
        title: "Visites à domicile",
        text: "Passages chez vous pour repas, sortie, présence et surveillance lorsque le maintien à domicile est préférable.",
      },
    ],
    sections: [
      {
        title: "Une garde pensée pour les journées à Disney",
        body:
          "Les journées autour de Disneyland Paris peuvent être longues, bruyantes et fatigantes pour un chien. Une garde dédiée évite le stress, les temps d'attente et les allers-retours compliqués.",
        bullets: [
          "Accueil sur réservation selon disponibilités",
          "Routine respectée : repas, sorties, repos et consignes",
          "Prise en charge adaptée aux chiots, chiens adultes et chiens seniors",
        ],
      },
      {
        title: "Un secteur clair autour de Val d'Europe",
        body:
          "La prestation est proposée autour de Disneyland Paris et reste indépendante. Chaque demande est confirmée selon le lieu exact, les dates et le profil de l'animal.",
        bullets: [
          "Secteur Val d'Europe, Chessy, Serris et communes proches",
          "Solution utile pour visiteurs, habitants et travailleurs du secteur",
          "Informations de santé et habitudes demandées avant validation",
        ],
      },
    ],
    faqs: [
      {
        question: "Puis-je faire garder mon chien pendant une journée à Disneyland Paris ?",
        answer:
          "Oui, la garderie de jour peut convenir si les disponibilités sont ouvertes et si le profil de votre chien est compatible avec une garde familiale.",
      },
      {
        question: "La Patte Dorée est-elle affiliée à Disneyland Paris ?",
        answer:
          "Non. La Patte Dorée est un service indépendant de garde d'animaux situé sur le secteur, sans affiliation avec Disneyland Paris.",
      },
      {
        question: "Mon chien sera-t-il en box ?",
        answer:
          "Non. La garde est familiale : le chien vit dans un cadre de maison, avec sorties, repos et présence humaine.",
      },
      {
        question: "Quelles communes sont couvertes autour de Disneyland Paris ?",
        answer:
          "Les demandes concernent principalement Val d'Europe, Chessy, Serris, Montévrain, Magny-le-Hongre, Coupvray et Bailly-Romainvilliers, selon les disponibilités.",
      },
    ],
    ctaLabel: "Réserver une garde chien",
    disneyDisclaimer: true,
  },
  {
    slug: "garde-chat-77",
    path: "/garde-chat-77",
    title: "Garde chat en Seine-et-Marne 77",
    metaTitle: "Garde chat 77 | Visite chat à domicile Seine-et-Marne",
    description:
      "Garde de chat en Seine-et-Marne (77) : visites à domicile, repas, litière, soins simples, photos et nouvelles. Réservation en ligne avec La Patte Dorée.",
    eyebrow: "Garde chat 77",
    lead:
      "Pour un chat, rester dans son environnement est souvent la solution la plus confortable. La Patte Dorée organise des visites à domicile en Seine-et-Marne pour les repas, la litière, la présence et les nouvelles.",
    intent:
      "Des visites à domicile pensées pour les chats qui restent plus sereins dans leur environnement habituel.",
    keywords: [
      "garde chat 77",
      "visite chat 77",
      "garde chat Seine-et-Marne",
      "cat sitter 77",
      "visite chat domicile 77",
    ],
    areas: ["Seine-et-Marne", "Val d'Europe", "Chessy", "Serris", "Montévrain", "Coupvray", "Bailly-Romainvilliers", "Magny-le-Hongre"],
    proofPoints: [
      "Visites à domicile",
      "Repas, eau et litière",
      "Soins simples selon consignes",
      "Photos après passage",
    ],
    services: [
      {
        title: "Visite chat à domicile",
        text: "Passage de 30 minutes à 2 heures pour nourriture, eau, litière, présence et surveillance.",
      },
      {
        title: "Garde à votre domicile",
        text: "Présence longue à domicile lorsque votre chat a besoin d'une surveillance plus soutenue.",
      },
      {
        title: "Hébergement chat",
        text: "Accueil possible pour les chats compatibles avec un changement d'environnement, après validation.",
      },
      {
        title: "Suivi pendant votre absence",
        text: "Des nouvelles pour savoir comment se passe la garde et repérer rapidement tout changement inhabituel.",
      },
    ],
    sections: [
      {
        title: "Une garde chat sans casser ses habitudes",
        body:
          "La plupart des chats supportent mieux l'absence de leurs humains quand leur territoire reste stable. Les visites permettent de garder les repères tout en assurant les besoins essentiels.",
        bullets: [
          "Nettoyage de la litière et contrôle de l'eau",
          "Respect des horaires de repas et des consignes",
          "Temps calme, jeu ou présence selon le caractère du chat",
        ],
      },
      {
        title: "Un service local dans le 77",
        body:
          "La Patte Dorée organise les visites de chat en Seine-et-Marne depuis le site, avec une validation avant chaque prestation.",
        bullets: [
          "Informations santé et habitudes renseignées dans le profil animal",
          "Durée de visite adaptée au besoin réel",
          "Possibilité de réserver plusieurs passages selon les dates",
        ],
      },
    ],
    faqs: [
      {
        question: "Combien de temps dure une visite chat à domicile ?",
        answer:
          "La visite commence à 30 minutes et peut aller jusqu'à 2 heures selon les besoins : repas, litière, présence, jeux ou soins simples.",
      },
      {
        question: "Faites-vous la garde chat dans tout le 77 ?",
        answer:
          "Les demandes sont étudiées selon la commune, les dates et les disponibilités. Le secteur Val d'Europe et les communes proches sont prioritaires.",
      },
      {
        question: "Puis-je donner des consignes précises pour mon chat ?",
        answer:
          "Oui. Le profil animal permet de renseigner alimentation, santé, habitudes, traitements simples et points de vigilance.",
      },
      {
        question: "Envoyez-vous des nouvelles pendant la garde ?",
        answer:
          "Oui, des photos et nouvelles peuvent être envoyées pour vous permettre de suivre la prestation sereinement.",
      },
    ],
    ctaLabel: "Réserver une garde chat",
  },
  {
    slug: "garde-chien-77",
    path: "/garde-chien-77",
    title: "Garde chien en Seine-et-Marne 77",
    metaTitle: "Garde chien 77 | Pension, garderie et promenade",
    description:
      "Garde chien 77 : hébergement familial, garderie de jour, promenades et visites à domicile en Seine-et-Marne, avec réservation en ligne.",
    eyebrow: "Garde chien 77",
    lead:
      "Besoin d'une garde chien en Seine-et-Marne pour une journée, un week-end ou des vacances ? La Patte Dorée propose une prise en charge familiale, claire et réservée en ligne.",
    intent:
      "Hébergement familial, garderie, promenades et visites : choisissez la formule qui respecte le mieux le rythme de votre chien.",
    keywords: [
      "garde chien 77",
      "garde chien Seine-et-Marne",
      "petsitter chien 77",
      "promenade chien 77",
      "garderie chien 77",
    ],
    areas: ["Seine-et-Marne", "Val d'Europe", "Chessy", "Serris", "Montévrain", "Magny-le-Hongre", "Coupvray", "Bailly-Romainvilliers"],
    proofPoints: [
      "Profil animal détaillé",
      "Maison et jardin",
      "Promenades incluses selon prestation",
      "Consignes santé suivies",
    ],
    services: [
      {
        title: "Garde de nuit",
        text: "Hébergement familial pour les absences, week-ends et vacances.",
      },
      {
        title: "Garde de jour",
        text: "Accueil le matin et retour le soir pour les journées de travail ou de sortie.",
      },
      {
        title: "Promenade chien",
        text: "Balade de quartier pour garder un rythme régulier et dépenser votre chien.",
      },
      {
        title: "Passage à domicile",
        text: "Visite ponctuelle pour repas, sortie, surveillance et présence.",
      },
    ],
    sections: [
      {
        title: "Un cadre familial plutôt qu'une garde impersonnelle",
        body:
          "La garde est organisée pour limiter le stress : présentation des habitudes, profil animal complet, consignes de repas et rythme de sortie.",
        bullets: [
          "Pas de box pour l'hébergement familial",
          "Sorties et temps de repos planifiés",
          "Attention particulière aux chiens anxieux, seniors ou jeunes",
        ],
      },
      {
        title: "Une réservation lisible",
        body:
          "Le site permet de choisir la prestation, les dates, les animaux concernés et les options utiles. La demande reste validée avant confirmation définitive.",
        bullets: [
          "Tarifs affichés avant paiement",
          "Paiement sécurisé",
          "Historique et suivi depuis l'espace client",
        ],
      },
    ],
    faqs: [
      {
        question: "Quel type de garde chien proposez-vous dans le 77 ?",
        answer:
          "La Patte Dorée propose hébergement familial, garderie de jour, visites à domicile et promenades selon les disponibilités.",
      },
      {
        question: "La garde convient-elle à un chiot ?",
        answer:
          "Oui si le profil est compatible. Les chiots demandent plus d'attention et peuvent entraîner un supplément selon la grille tarifaire.",
      },
      {
        question: "Les promenades sont-elles incluses ?",
        answer:
          "Pour l'hébergement familial, les sorties font partie de la routine. Les promenades seules peuvent aussi être réservées comme prestation dédiée.",
      },
      {
        question: "Comment savoir si ma commune est couverte ?",
        answer:
          "Envoyez une demande avec votre adresse ou secteur. La faisabilité est confirmée selon la distance, les dates et les disponibilités.",
      },
    ],
    ctaLabel: "Réserver une garde chien 77",
  },
  {
    slug: "pension-chien-77",
    path: "/pension-chien-77",
    title: "Pension chien familiale en Seine-et-Marne",
    metaTitle: "Pension chien 77 | Hébergement familial sans box",
    description:
      "Pension chien 77 en cadre familial : hébergement sans box, promenades, jardin, photos et suivi personnalisé en Seine-et-Marne.",
    eyebrow: "Pension chien 77",
    lead:
      "La pension chien chez La Patte Dorée privilégie un cadre de maison : présence, sorties, repos et suivi, sans environnement de chenil.",
    intent:
      "Un hébergement familial sans box, conçu pour offrir à votre chien un séjour calme et proche de ses habitudes.",
    keywords: [
      "pension chien 77",
      "pension canine 77",
      "hébergement chien 77",
      "pension chien Seine-et-Marne",
      "pension chien Val d'Europe",
    ],
    areas: ["Seine-et-Marne", "Val d'Europe", "Disneyland Paris", "Chessy", "Serris", "Montévrain", "Magny-le-Hongre", "Coupvray"],
    proofPoints: [
      "Hébergement familial",
      "Sans box ni chenil",
      "Photos pendant le séjour",
      "Validation avant confirmation",
    ],
    services: [
      {
        title: "Séjour courte durée",
        text: "Une nuit, un week-end ou quelques jours avec une routine claire.",
      },
      {
        title: "Vacances longues",
        text: "Organisation possible pour les absences prolongées, avec suivi régulier.",
      },
      {
        title: "Jardin et sorties",
        text: "Accès extérieur et promenades selon les besoins du chien.",
      },
      {
        title: "Profil complet",
        text: "Habitudes, alimentation, santé et consignes sont renseignées avant la garde.",
      },
    ],
    sections: [
      {
        title: "Une alternative au chenil classique",
        body:
          "Certains chiens vivent mal les box, le bruit ou les grands groupes. L'hébergement familial permet de garder une ambiance plus calme et plus proche du quotidien.",
        bullets: [
          "Garde limitée et validée selon compatibilité",
          "Rythme individualisé",
          "Nouvelles régulières pendant le séjour",
        ],
      },
      {
        title: "Préparer le séjour avant le départ",
        body:
          "Une bonne pension commence avant l'arrivée : alimentation, traitement, ententes, habitudes de sommeil et comportements importants sont notés dans le dossier.",
        bullets: [
          "Informations de santé centralisées",
          "Consignes lisibles pour chaque animal",
          "Réservation en ligne avec confirmation",
        ],
      },
    ],
    faqs: [
      {
        question: "La pension chien se fait-elle en box ?",
        answer:
          "Non. La Patte Dorée propose un hébergement familial, dans un cadre de maison, sous réserve de compatibilité entre les animaux accueillis.",
      },
      {
        question: "Quel est le tarif de pension chien ?",
        answer:
          "Le tarif dépend de la prestation, du nombre d'animaux et des éventuels suppléments. Les prix sont affichés au moment de la réservation.",
      },
      {
        question: "Puis-je réserver pour plusieurs semaines ?",
        answer:
          "Oui, les longues périodes peuvent être étudiées selon les disponibilités et le profil du chien.",
      },
      {
        question: "Recevrai-je des photos ?",
        answer:
          "Oui, des nouvelles et photos peuvent être partagées pendant le séjour pour vous permettre de suivre la garde.",
      },
    ],
    ctaLabel: "Réserver une pension chien",
    disneyDisclaimer: true,
  },
  {
    slug: "visite-chat-domicile-77",
    path: "/visite-chat-domicile-77",
    title: "Visite chat à domicile dans le 77",
    metaTitle: "Visite chat domicile 77 | Garde chat Seine-et-Marne",
    description:
      "Visite chat domicile 77 : passage chez vous pour repas, eau, litière, présence, soins simples et photos. Service de garde chat en Seine-et-Marne.",
    eyebrow: "Visite chat domicile 77",
    lead:
      "La visite chat à domicile permet de sécuriser votre absence tout en laissant votre chat dans son territoire. Les passages sont organisés autour de ses besoins réels.",
    intent:
      "Des passages à domicile ajustés aux habitudes de votre chat, de ses repas à ses moments de jeu ou de calme.",
    keywords: [
      "visite chat domicile 77",
      "garde chat domicile 77",
      "passage chat domicile 77",
      "visite chat Seine-et-Marne",
      "cat sitter domicile 77",
    ],
    areas: ["Seine-et-Marne", "Val d'Europe", "Chessy", "Serris", "Montévrain", "Coupvray", "Magny-le-Hongre", "Bailly-Romainvilliers"],
    proofPoints: [
      "Passage de 30 min à 2 h",
      "Litière et alimentation",
      "Surveillance du comportement",
      "Compte rendu après visite",
    ],
    services: [
      {
        title: "Passage quotidien",
        text: "Un ou plusieurs passages selon la durée de votre absence et les besoins du chat.",
      },
      {
        title: "Litière et repas",
        text: "Nettoyage, eau fraîche, alimentation et vérification des points importants.",
      },
      {
        title: "Présence et jeu",
        text: "Temps calme ou interaction selon le tempérament du chat.",
      },
      {
        title: "Soins simples",
        text: "Consignes de soins non vétérinaires suivies lorsque la situation le permet.",
      },
    ],
    sections: [
      {
        title: "Un passage utile, pas seulement un bol rempli",
        body:
          "Une bonne visite vérifie aussi le comportement, l'eau, la litière, les accès et les petits signaux qui peuvent indiquer un problème.",
        bullets: [
          "Contrôle visuel de l'état général",
          "Photos et nouvelles après le passage",
          "Adaptation au chat sociable, discret ou craintif",
        ],
      },
      {
        title: "La durée dépend du besoin",
        body:
          "Certains chats ont seulement besoin d'un passage court et régulier. D'autres demandent plus de présence, de jeu ou de surveillance, surtout lors d'une longue absence.",
        bullets: [
          "30 minutes pour les besoins essentiels",
          "Durées longues possibles jusqu'à 2 heures",
          "Organisation selon vos dates et consignes",
        ],
      },
    ],
    faqs: [
      {
        question: "Que comprend une visite chat à domicile ?",
        answer:
          "Elle comprend au minimum repas, eau, litière, contrôle visuel et présence. Des soins simples ou jeux peuvent être ajoutés selon les consignes.",
      },
      {
        question: "Puis-je demander deux visites par jour ?",
        answer:
          "Oui, plusieurs passages peuvent être demandés selon les disponibilités et le besoin du chat.",
      },
      {
        question: "Mon chat est peureux, est-ce un problème ?",
        answer:
          "Non. La visite s'adapte au caractère du chat. Pour un chat craintif, le passage privilégie le calme, la routine et la surveillance discrète.",
      },
      {
        question: "Faut-il créer un profil animal ?",
        answer:
          "Oui, le profil permet de centraliser les informations utiles : alimentation, santé, comportement, habitudes et consignes de visite.",
      },
    ],
    ctaLabel: "Réserver une visite chat",
  },
  {
    slug: "garde-animaux-seine-et-marne",
    path: "/garde-animaux-seine-et-marne",
    title: "Garde animaux en Seine-et-Marne",
    metaTitle: "Garde animaux 77 | Chien et chat Seine-et-Marne",
    description:
      "Garde animaux 77 : chien et chat en Seine-et-Marne, hébergement familial, visites à domicile, garderie et promenades avec réservation en ligne.",
    eyebrow: "Garde animaux Seine-et-Marne",
    lead:
      "La Patte Dorée regroupe les principales solutions de garde animaux dans le 77 : chien, chat, garde à domicile, hébergement, visites et promenades.",
    intent:
      "Une solution claire pour organiser la garde de votre chien ou de votre chat selon son âge, son caractère et vos dates.",
    keywords: [
      "garde animaux 77",
      "garde animaux Seine-et-Marne",
      "petsitter 77",
      "garde chien chat 77",
      "garde animaux Val d'Europe",
    ],
    areas: coreServiceAreas,
    proofPoints: [
      "Chien et chat",
      "Profils animaux détaillés",
      "Tarifs lisibles",
      "Espace client",
    ],
    services: [
      {
        title: "Hébergement familial",
        text: "Accueil de votre animal dans un environnement de maison pour les nuits et vacances.",
      },
      {
        title: "Garde à domicile",
        text: "Présence chez vous pour conserver les repères de l'animal.",
      },
      {
        title: "Visites",
        text: "Passages ponctuels pour repas, litière, sortie, soins simples et surveillance.",
      },
      {
        title: "Promenades",
        text: "Balades pour les chiens, avec durée adaptée selon le besoin.",
      },
    ],
    sections: [
      {
        title: "Une offre complète pour chien et chat",
        body:
          "Les besoins changent selon l'espèce, l'âge, le tempérament et la durée d'absence. La Patte Dorée permet de choisir le format de garde le plus adapté.",
        bullets: [
          "Hébergement pour les animaux compatibles",
          "Domicile pour préserver les habitudes",
          "Promenade ou visite pour les besoins ponctuels",
        ],
      },
      {
        title: "Un service local et vérifiable",
        body:
          "Les prestations s'appuient sur des informations précises concernant chaque animal avant validation.",
        bullets: [
          "Profil animal détaillé",
          "Validation de la demande avant confirmation",
          "Suivi depuis l'espace client",
        ],
      },
    ],
    faqs: [
      {
        question: "Quels animaux pouvez-vous garder ?",
        answer:
          "Les prestations principales concernent les chiens et les chats. Chaque demande est validée selon le profil, les dates et la prestation choisie.",
      },
      {
        question: "Intervenez-vous dans toute la Seine-et-Marne ?",
        answer:
          "Les demandes sont étudiées selon la commune. Le secteur Val d'Europe et les communes proches sont les plus fréquemment desservis.",
      },
      {
        question: "Comment réserver une garde animaux 77 ?",
        answer:
          "Créez un compte, ajoutez le profil de votre animal, choisissez la prestation et envoyez votre demande de réservation.",
      },
      {
        question: "Pourquoi renseigner autant d'informations sur l'animal ?",
        answer:
          "Ces informations permettent d'adapter la garde : alimentation, santé, habitudes, comportement et points de vigilance.",
      },
    ],
    ctaLabel: "Réserver une garde animaux",
  },
];

export function getLocalSeoPage(slug: string) {
  return localSeoPages.find((page) => page.slug === slug);
}

export function getLocalBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${getSiteUrl()}/#localbusiness`,
    name: SITE_NAME,
    alternateName: LEGAL_INFORMATION.commercialName,
    taxID: LEGAL_INFORMATION.siren.replace(/\s/g, ""),
    identifier: LEGAL_INFORMATION.siret.replace(/\s/g, ""),
    url: getSiteUrl(),
    image: absoluteUrl("/logo-mark.png"),
    logo: absoluteUrl("/logo-mark.png"),
    description:
      "Service de garde d'animaux pour chiens et chats près de Disneyland Paris, Val d'Europe et en Seine-et-Marne.",
    priceRange: "€€",
    address: {
      "@type": "PostalAddress",
      streetAddress: "29 boulevard des 100 Arpents",
      postalCode: "77600",
      addressLocality: "Bussy-Saint-Georges",
      addressCountry: "FR",
    },
    areaServed: coreServiceAreas.map((area) => ({
      "@type": "AdministrativeArea",
      name: area,
    })),
    knowsAbout: coreKeywords,
    sameAs: [
      INSTAGRAM_URL,
      "https://www.allovoisins.com/p/meganemelique-1#avis",
      "https://www.rover.com/members/megane-m-le-paradis-des-animaux/",
    ],
  };
}

export function getLocalServiceJsonLd(page: LocalSeoPage) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${absoluteUrl(page.path)}#service`,
    name: page.title,
    description: page.description,
    url: absoluteUrl(page.path),
    provider: {
      "@id": `${getSiteUrl()}/#localbusiness`,
      name: SITE_NAME,
    },
    serviceType: page.eyebrow,
    areaServed: page.areas.map((area) => ({
      "@type": "Place",
      name: area,
    })),
    offers: {
      "@type": "Offer",
      url: absoluteUrl("/booking"),
      availability: "https://schema.org/InStock",
    },
  };
}

export function getFaqJsonLd(page: LocalSeoPage) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function getBreadcrumbJsonLd(page: LocalSeoPage) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Accueil",
        item: getSiteUrl(),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: page.title,
        item: absoluteUrl(page.path),
      },
    ],
  };
}
