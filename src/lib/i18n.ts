import { generatedCatalogue } from "@/lib/i18n.generated";

export const supportedLocales = ["fr", "en", "es"] as const;

export type Locale = (typeof supportedLocales)[number];

export const localeNames: Record<Locale, string> = {
  fr: "Français",
  en: "English",
  es: "Español",
};

export function isLocale(value: string | null | undefined): value is Locale {
  return supportedLocales.includes(value as Locale);
}

type Translation = { en: string; es: string };

/**
 * Source copy stays in French, the business' primary language. The client-side
 * translator uses this catalogue for both static and dynamically rendered UI.
 * Longer entries are intentionally preferred before shorter fragments.
 */
const catalogue: Record<string, Translation> = {
  // Brand and high-visibility local landing-page copy are curated by hand.
  "La Patte": { en: "La Patte", es: "La Patte" },
  "Garde chien près de Disneyland Paris": {
    en: "Dog sitting near Disneyland Paris",
    es: "Cuidado de perros cerca de Disneyland Paris",
  },
  "Pension chien familiale en Seine-et-Marne": {
    en: "Family dog boarding in Seine-et-Marne",
    es: "Alojamiento familiar para perros en Seine-et-Marne",
  },
  "Garde d'animaux en Seine-et-Marne": {
    en: "Pet sitting in Seine-et-Marne",
    es: "Cuidado de mascotas en Seine-et-Marne",
  },
  "Photos après passage": {
    en: "Photos after each visit",
    es: "Fotos después de cada visita",
  },
  "La Patte Dorée | Pet-sitter près de Disneyland Paris": {
    en: "La Patte Dorée | Pet sitter near Disneyland Paris",
    es: "La Patte Dorée | Cuidadora de mascotas cerca de Disneyland Paris",
  },
  "Comme à la maison,": { en: "Just like home,", es: "Como en casa," },
  "même quand vous êtes loin.": { en: "even when you are away.", es: "incluso cuando está lejos." },
  "Hébergement familial sans box, visites à domicile et promenades, tout près de Disneyland Paris. Partez l'esprit tranquille, on s'occupe du reste.": {
    en: "Cage-free family boarding, home visits and walks near Disneyland Paris. Relax and enjoy your time away — we will take care of everything.",
    es: "Alojamiento familiar sin jaulas, visitas a domicilio y paseos cerca de Disneyland Paris. Disfrute con tranquilidad: nosotros nos ocupamos del resto.",
  },
  "Services": { en: "Services", es: "Servicios" },
  "Près de chez vous": { en: "Near you", es: "Cerca de usted" },
  "Autour de Disneyland Paris": { en: "Around Disneyland Paris", es: "Alrededor de Disneyland Paris" },
  "Pour les chats": { en: "For cats", es: "Para gatos" },
  "Hébergement familial": { en: "Family boarding", es: "Alojamiento familiar" },
  "Toutes nos zones": { en: "All service areas", es: "Todas nuestras zonas" },
  "janvier": { en: "January", es: "enero" },
  "février": { en: "February", es: "febrero" },
  "mars": { en: "March", es: "marzo" },
  "avril": { en: "April", es: "abril" },
  "Mai": { en: "May", es: "mayo" },
  "juin": { en: "June", es: "junio" },
  "juillet": { en: "July", es: "julio" },
  "août": { en: "August", es: "agosto" },
  "septembre": { en: "September", es: "septiembre" },
  "octobre": { en: "October", es: "octubre" },
  "novembre": { en: "November", es: "noviembre" },
  "décembre": { en: "December", es: "diciembre" },
  "janv.": { en: "Jan", es: "ene" },
  "févr.": { en: "Feb", es: "feb" },
  "avr.": { en: "Apr", es: "abr" },
  "juil.": { en: "Jul", es: "jul" },
  "sept.": { en: "Sep", es: "sept" },
  "oct.": { en: "Oct", es: "oct" },
  "nov.": { en: "Nov", es: "nov" },
  "déc.": { en: "Dec", es: "dic" },
  "Garde chien Disneyland Paris & garde chat 77 | La Patte Dorée": {
    en: "Dog sitting near Disneyland Paris & cat sitting in Seine-et-Marne | La Patte Dorée",
    es: "Cuidado de perros cerca de Disneyland Paris y de gatos en Seine-et-Marne | La Patte Dorée",
  },
  "Disponibilités ouvertes pour 2026": {
    en: "2026 bookings now open",
    es: "Reservas abiertas para 2026",
  },
  "Garde chien et chat": { en: "Dog and cat sitting", es: "Cuidado de perros y gatos" },
  "près de Disneyland Paris.": { en: "near Disneyland Paris.", es: "cerca de Disneyland Paris." },
  "Garde chien Disneyland Paris, garde chat 77, visites à domicile, promenades et hébergement familial sans box. Partez l'esprit tranquille.": {
    en: "Dog sitting near Disneyland Paris, cat care in Seine-et-Marne, home visits, walks and cage-free family boarding. Travel with complete peace of mind.",
    es: "Cuidado de perros cerca de Disneyland Paris, cuidado de gatos en Seine-et-Marne, visitas a domicilio, paseos y alojamiento familiar sin jaulas. Viaje con total tranquilidad.",
  },
  "Réserver un séjour": { en: "Book a stay", es: "Reservar una estancia" },
  "Accéder à mon espace": { en: "Go to my account", es: "Ir a mi cuenta" },
  "Créer un compte": { en: "Create an account", es: "Crear una cuenta" },
  "Créer mon compte": { en: "Create my account", es: "Crear mi cuenta" },
  "Mon espace": { en: "My account", es: "Mi cuenta" },
  "Compétence professionnelle": { en: "Professional expertise", es: "Experiencia profesional" },
  "Une prise en charge fondée sur la connaissance des besoins biologiques, physiologiques et comportementaux des chiens et des chats.": {
    en: "Care based on a thorough understanding of dogs' and cats' biological, physiological and behavioural needs.",
    es: "Un cuidado basado en el conocimiento de las necesidades biológicas, fisiológicas y de comportamiento de perros y gatos.",
  },
  "Besoins individualisés": { en: "Personalised care", es: "Atención personalizada" },
  "Qualification ACACED chien et chat": {
    en: "ACACED qualification for dogs and cats",
    es: "Cualificación ACACED para perros y gatos",
  },
  "Photos et nouvelles": { en: "Photos and updates", es: "Fotos y noticias" },
  "Paiement sécurisé": { en: "Secure payment", es: "Pago seguro" },
  "Garde locale 77": { en: "Local pet care in Seine-et-Marne", es: "Cuidado local en Seine-et-Marne" },
  "Garde d'animaux près de Disneyland Paris et en Seine-et-Marne": {
    en: "Pet care near Disneyland Paris and across Seine-et-Marne",
    es: "Cuidado de mascotas cerca de Disneyland Paris y en Seine-et-Marne",
  },
  "La Patte Dorée répond aux recherches locales les plus utiles : garde chien Disneyland Paris, garde chat 77, pension chien 77, visites à domicile et petsitter autour de Val d'Europe.": {
    en: "La Patte Dorée provides the local services visitors need most: dog sitting near Disneyland Paris, cat sitting and dog boarding in Seine-et-Marne, home visits and pet care around Val d'Europe.",
    es: "La Patte Dorée ofrece los servicios locales más buscados: cuidado de perros cerca de Disneyland Paris, cuidado de gatos y alojamiento canino en Seine-et-Marne, visitas a domicilio y cuidado de mascotas en Val d'Europe.",
  },
  "Garderie, hébergement familial, visites et promenades autour de Val d'Europe.": {
    en: "Day care, family boarding, home visits and walks around Val d'Europe.",
    es: "Guardería, alojamiento familiar, visitas y paseos en Val d'Europe.",
  },
  "Visites à domicile pour repas, litière, présence, soins simples et photos.": {
    en: "Home visits for feeding, litter care, company, basic care and photos.",
    es: "Visitas a domicilio para comida, arenero, compañía, cuidados básicos y fotos.",
  },
  "Une pension familiale sans box, avec routine et suivi pendant le séjour.": {
    en: "Cage-free family boarding, with a familiar routine and regular updates.",
    es: "Alojamiento familiar sin jaulas, con su rutina habitual y seguimiento durante la estancia.",
  },
  "Chien et chat dans le 77 : garde à domicile, hébergement, garderie et sorties.": {
    en: "Dog and cat care in Seine-et-Marne: in-home sitting, boarding, day care and walks.",
    es: "Cuidado de perros y gatos en Seine-et-Marne: cuidado a domicilio, alojamiento, guardería y paseos.",
  },
  "Services sur-mesure": { en: "Tailored services", es: "Servicios a medida" },
  "Garde de chien": { en: "Dog care", es: "Cuidado de perros" },
  "Un tarif calculé sur la durée réelle": { en: "Pricing based on actual duration", es: "Una tarifa calculada según la duración real" },
  "Le compteur commence au moment du dépôt et s’arrête à la reprise. Le changement de date à minuit ne déclenche jamais une nouvelle facturation.": {
    en: "Time starts at drop-off and stops at pick-up. Crossing midnight never triggers a new charge on its own.",
    es: "El tiempo empieza con la entrega y termina con la recogida. El cambio de fecha a medianoche nunca genera un nuevo cobro por sí solo.",
  },
  "Garde de jour, jusqu’à 10 h": { en: "Day care, up to 10 hours", es: "Guardería de día, hasta 10 h" },
  "garde de jour jusqu’à 10 h": { en: "day care up to 10 hours", es: "guardería de día hasta 10 h" },
  "Par jour, jusqu’à 10 h": { en: "Per day, up to 10 hours", es: "Por día, hasta 10 h" },
  "Par période de 24 h commencée": { en: "Per started 24-hour period", es: "Por cada periodo de 24 h iniciado" },
  "Période de 24 h, avec nuit": { en: "24-hour period, including overnight", es: "Periodo de 24 h, con noche" },
  "Comment sont comptés les dépassements ?": { en: "How is extra time charged?", es: "¿Cómo se cobran los excesos de tiempo?" },
  "Dès qu’une période de 24 h est dépassée, même de quelques minutes, une nouvelle période commence. Les durées intermédiaires restent ainsi simples et prévisibles.": {
    en: "As soon as a 24-hour period is exceeded, even by a few minutes, a new period begins. This keeps intermediate durations simple and predictable.",
    es: "En cuanto se supera un periodo de 24 h, aunque solo sea por unos minutos, comienza un nuevo periodo. Así, las duraciones intermedias siguen siendo sencillas y previsibles.",
  },
  "Vendredi 18 h → samedi 18 h": { en: "Friday 6 pm → Saturday 6 pm", es: "Viernes 18 h → sábado 18 h" },
  "10 h 01 à 24 h de garde": { en: "10 hours 1 minute to 24 hours of care", es: "De 10 h 01 a 24 h de cuidado" },
  "Vendredi 18 h → dimanche 18 h": { en: "Friday 6 pm → Sunday 6 pm", es: "Viernes 18 h → domingo 18 h" },
  "Exemple de dépassement : samedi 18 h 01 démarre une deuxième période de 24 h.": {
    en: "Overrun example: Saturday at 6:01 pm starts a second 24-hour period.",
    es: "Ejemplo de exceso: el sábado a las 18:01 comienza un segundo periodo de 24 h.",
  },
  "période de 24 h": { en: "24-hour period", es: "periodo de 24 h" },
  "périodes de 24 h": { en: "24-hour periods", es: "periodos de 24 h" },
  "périodes de 24 h et +": { en: "24-hour periods or more", es: "periodos de 24 h o más" },
  "période de 24 h facturée": { en: "24-hour period charged", es: "periodo de 24 h facturado" },
  "périodes de 24 h facturées": { en: "24-hour periods charged", es: "periodos de 24 h facturados" },
  "€ / période de 24 h": { en: "€ / 24-hour period", es: "€ / periodo de 24 h" },
  "€ / jusqu’à 10 h": { en: "€ / up to 10 hours", es: "€ / hasta 10 h" },
  "45 € / période de 24 h": { en: "€45 / 24-hour period", es: "45 € / periodo de 24 h" },
  "23 € / période de 24 h": { en: "€23 / 24-hour period", es: "23 € / periodo de 24 h" },
  "35 € / jusqu’à 10 h": { en: "€35 / up to 10 hours", es: "35 € / hasta 10 h" },
  "30 € / jusqu’à 10 h": { en: "€30 / up to 10 hours", es: "30 € / hasta 10 h" },
  "16 € / 30 min": { en: "€16 / 30 min", es: "16 € / 30 min" },
  "15 € / 30 min": { en: "€15 / 30 min", es: "15 € / 30 min" },
  "40 à 80 € / jour": { en: "€40 to €80 / day", es: "De 40 € a 80 € / día" },
  "La dernière période est entamée et facturée en entier.": { en: "The final period has started and is charged in full.", es: "El último periodo ha comenzado y se factura completo." },
  "Durée exacte, sans dépassement.": { en: "Exact duration, with no overrun.", es: "Duración exacta, sin exceso." },
  "Choisissez l’arrivée et le départ. Le tarif est calculé depuis l’heure d’arrivée, par période de 24 h commencée.": {
    en: "Choose arrival and departure. Pricing starts at the arrival time and is calculated per started 24-hour period.",
    es: "Elija la llegada y la salida. La tarifa se calcula desde la hora de llegada, por cada periodo de 24 h iniciado.",
  },
  "Votre compagnon vit avec nous, avec nuit, accès canapé et jardin inclus. Le tarif suit des périodes réelles de 24 h à partir de l’arrivée.": {
    en: "Your pet stays with us overnight, with sofa and garden access included. Pricing follows actual 24-hour periods from arrival.",
    es: "Su mascota se queda con nosotros por la noche, con acceso al sofá y al jardín. La tarifa sigue periodos reales de 24 h desde la llegada.",
  },
  "Tout ce qu'il faut pour son bonheur.": { en: "Everything they need to feel happy.", es: "Todo lo que necesita para ser feliz." },
  "Hébergement Familial": { en: "Family boarding", es: "Alojamiento familiar" },
  "Hébergement et garderie": { en: "Boarding and day care", es: "Alojamiento y guardería" },
  "Hébergement avec nuit": { en: "Overnight boarding", es: "Alojamiento con noche" },
  "Le calcul se fait sur la durée réelle entre le dépôt et la reprise, sans nouvelle facturation au simple passage de minuit.": {
    en: "Pricing is based on the actual time between drop-off and pick-up. Crossing midnight does not trigger a new charge on its own.",
    es: "La tarifa se calcula según el tiempo real entre la entrega y la recogida. El paso de la medianoche no genera por sí solo un nuevo cobro.",
  },
  "Votre compagnon vit avec nous, dans la maison. Pas de box, accès jardin illimité et séances de câlins sur le canapé. C'est comme chez vous, en mieux.": {
    en: "Your pet lives with us in our home. No cages, unlimited garden access and plenty of sofa cuddles. Just like home, only better.",
    es: "Su mascota vive con nosotros en casa. Sin jaulas, con acceso ilimitado al jardín y muchos mimos en el sofá. Como en casa, pero aún mejor.",
  },
  "Vie de famille 24/7": { en: "Family life 24/7", es: "Vida familiar 24/7" },
  "Photos tous les jours": { en: "Daily photos", es: "Fotos diarias" },
  "Garde à votre domicile": { en: "Sitting in your home", es: "Cuidado en su domicilio" },
  "Garde au domicile du client": { en: "Pet sitting in your home", es: "Cuidado en su domicilio" },
  "À partir de": { en: "From", es: "Desde" },
  "Jusqu’à 6 h": { en: "Up to 6 hours", es: "Hasta 6 h" },
  "De 6 h à 10 h": { en: "Over 6 and up to 10 hours", es: "Más de 6 y hasta 10 h" },
  "Plus de 6 h et jusqu’à 10 h": { en: "Over 6 and up to 10 hours", es: "Más de 6 y hasta 10 h" },
  "Plus de 10 h": { en: "Over 10 hours", es: "Más de 10 h" },
  "Jusqu'à 2 h": { en: "Up to 2 hours", es: "Hasta 2 h" },
  "Une présence prolongée chez vous : repas, sorties, compagnie, surveillance et respect de la routine habituelle de votre animal.": {
    en: "Extended care in your home, including meals, walks, company and supervision while respecting your pet's usual routine.",
    es: "Una presencia prolongada en su hogar con comidas, salidas, compañía y supervisión, respetando la rutina habitual de su mascota.",
  },
  "Une présence longue chez vous sur la journée : repas, sorties, compagnie, surveillance et routine habituelle conservée.": {
    en: "All-day care in your home: meals, walks, company and supervision while keeping your pet's usual routine.",
    es: "Cuidado durante el día en su casa: comidas, salidas, compañía y supervisión, manteniendo su rutina habitual.",
  },
  "Promenades": { en: "Dog walks", es: "Paseos" },
  "Chat : sur demande": { en: "Cat: on request", es: "Gato: bajo petición" },
  "Promenade de chat : sur demande.": { en: "Cat walks: on request.", es: "Paseo de gatos: bajo petición." },
  "par tranche supplémentaire de 30 minutes commencée. Promenade de chat : sur demande.": {
    en: "per additional started 30-minute period. Cat walks: on request.",
    es: "por cada tramo adicional de 30 minutos iniciado. Paseo de gatos: bajo petición.",
  },
  "sur demande": { en: "on request", es: "bajo petición" },
  "minutes": { en: "minutes", es: "minutos" },
  "Besoin de se dépenser ? Je viens chercher votre compagnon pour une balade active.": {
    en: "Need to burn off some energy? I will collect your pet for an active walk.",
    es: "¿Necesita gastar energía? Recogeré a su mascota para un paseo activo.",
  },
  "Visites à domicile": { en: "Home visits", es: "Visitas a domicilio" },
  "Passage ponctuel": { en: "Home visit", es: "Visita a domicilio" },
  "Visite de 30 minutes": { en: "30-minute visit", es: "Visita de 30 minutos" },
  "Visite de 60, 90 ou 120 minutes": { en: "60, 90 or 120-minute visit", es: "Visita de 60, 90 o 120 minutos" },
  "Par visite, même prix entre 1 h et 2 h": { en: "Per visit, same price from 1 to 2 hours", es: "Por visita, mismo precio entre 1 y 2 h" },
  "Tarif de départ pour": { en: "Starting price for", es: "Precio inicial para" },
  "minutes, puis": { en: "minutes, then", es: "minutos, después" },
  "€ par tranche supplémentaire de": { en: "€ per additional", es: "€ por cada tramo adicional de" },
  "par tranche supplémentaire de": { en: "per additional", es: "por cada tramo adicional de" },
  "minutes commencée.": { en: "minute period started.", es: "minutos iniciado." },
  "Visite à domicile :": { en: "Home visit:", es: "Visita a domicilio:" },
  "€ et chat": { en: "€ and cat", es: "€ y gato" },
  "€ pour 30 minutes, puis": { en: "€ for 30 minutes, then", es: "€ por 30 minutos, después" },
  "Puis +": { en: "Then +", es: "Después +" },
  "€ par tranche de": { en: "€ per additional", es: "€ por cada" },
  "min : chien": { en: "min: dog", es: "min: perro" },
  "€ pour 60 / 90 / 120 min.": { en: "€ for 60 / 90 / 120 min.", es: "€ para 60 / 90 / 120 min." },
  "2 h :": { en: "2 hrs:", es: "2 h:" },
  "Un passage ponctuel chez vous pour les repas, la litière, les soins simples, les sorties et un moment de présence.": {
    en: "A one-off visit to your home for meals, litter care, basic care, outings and companionship.",
    es: "Una visita puntual a su domicilio para las comidas, el arenero, los cuidados básicos, las salidas y un momento de compañía.",
  },
  "Un passage ponctuel chez vous pour repas, litière, soins simples et présence.": {
    en: "A home visit for feeding, litter care, basic care and company.",
    es: "Una visita a domicilio para comida, arenero, cuidados básicos y compañía.",
  },
  "Garderie de Jour": { en: "Day care", es: "Guardería de día" },
  "Plusieurs jours peuvent être réservés : chaque journée respecte les mêmes horaires et reste limitée à 10 h.": {
    en: "Several days can be booked: each day uses the same schedule and remains limited to 10 hours.",
    es: "Se pueden reservar varios días: cada jornada mantiene el mismo horario y sigue limitada a 10 h.",
  },
  "Long hébergement": { en: "Long boarding stay", es: "Alojamiento de larga duración" },
  "Garderie de jour au domicile du pet-sitter": { en: "Day care at the pet sitter's home", es: "Guardería de día en el domicilio del cuidador" },
  "Déposez votre compagnon le matin et récupérez-le le soir. Repas, jeux, repos et promenades selon ses habitudes.": {
    en: "Drop your pet off in the morning and collect them in the evening. Meals, play, rest and walks are tailored to their usual routine.",
    es: "Deje a su mascota por la mañana y recójala por la tarde. Comidas, juegos, descanso y paseos según sus hábitos.",
  },
  "Prestation soumise à disponibilité et à compatibilité avec les animaux déjà présents.": {
    en: "Subject to availability and compatibility with pets already present.",
    es: "Servicio sujeto a disponibilidad y compatibilidad con los animales ya presentes.",
  },
  "Soumise à disponibilité et à compatibilité avec les animaux déjà présents.": {
    en: "Subject to availability and compatibility with pets already present.",
    es: "Sujeto a disponibilidad y compatibilidad con los animales ya presentes.",
  },
  "Les horaires exacts doivent être indiqués lors de la réservation. Les frais exceptionnels nécessaires à la prestation, notamment le parking, les péages ou les transports, sont facturés en supplément après accord préalable.": {
    en: "Exact times must be provided when booking. Exceptional expenses required for the service, including parking, tolls or transport, are charged separately with prior approval.",
    es: "Los horarios exactos deben indicarse al reservar. Los gastos excepcionales necesarios para el servicio, incluidos el aparcamiento, los peajes o el transporte, se facturan por separado previo acuerdo.",
  },
  "Règle chien à retenir": { en: "Dog pricing rule", es: "Regla de precio para perros" },
  "Jusqu’à 10 h le même jour :": { en: "Up to 10 hours on the same day:", es: "Hasta 10 h el mismo día:" },
  ". De 10 h 01 à 24 h :": { en: ". From 10 hours 1 minute to 24 hours:", es: ". De 10 h 01 a 24 h:" },
  ". À 24 h 01, une deuxième période commence, soit": { en: ". At 24 hours 1 minute, a second period starts, for a total of", es: ". A las 24 h 01 comienza un segundo periodo, con un total de" },
  "Chiot de moins d’un an": { en: "Puppy under one year old", es: "Cachorro menor de un año" },
  "5 € par jour de garderie ou par période de 24 h commencée en hébergement. Aucun supplément jeune animal pour les chats ni pour les autres services.": {
    en: "€5 per day of day care or per started 24-hour boarding period. No age-related surcharge applies to cats or any other service.",
    es: "5 € por día de guardería o por cada periodo de alojamiento de 24 h iniciado. No se aplica ningún suplemento por edad a los gatos ni a otros servicios.",
  },
  "Remise automatique de 10 % à partir de 14 périodes de 24 h commencées.": {
    en: "Automatic 10% discount from 14 started 24-hour periods.",
    es: "Descuento automático del 10 % a partir de 14 periodos de 24 h iniciados.",
  },
  "Premium": { en: "Premium", es: "Premium" },
  "Premium ✨": { en: "Premium ✨", es: "Premium ✨" },
  "100 % de la prestation est due.": {
    en: "100% of the service fee is due.",
    es: "Se debe abonar el 100 % del importe de la prestación.",
  },
  "Sortie individuelle": { en: "Individual outing", es: "Salida individual" },
  "Un supplément peut être appliqué les jours fériés et pour les demandes de dernière minute.": {
    en: "A surcharge may apply on public holidays and for last-minute requests.",
    es: "Puede aplicarse un suplemento los días festivos y para las solicitudes de última hora.",
  },
  "Les jours fériés et les demandes de dernière minute ne déclenchent aucune majoration automatique dans le calcul en ligne.": {
    en: "Public holidays and last-minute requests do not trigger any automatic surcharge in the online calculation.",
    es: "Los días festivos y las solicitudes de última hora no generan ningún recargo automático en el cálculo en línea.",
  },
  "Heure de début": { en: "Start time", es: "Hora de inicio" },
  "Heure de fin": { en: "End time", es: "Hora de finalización" },
  "Durée calculée :": { en: "Calculated duration:", es: "Duración calculada:" },
  "Horaires :": { en: "Times:", es: "Horarios:" },
  "Déposez-le le matin, récupérez-le le soir. Idéal pour vos journées de travail. Socialisation et jeux garantis.": {
    en: "Drop your pet off in the morning and collect them in the evening. Ideal for workdays, with plenty of play and socialisation.",
    es: "Déjelo por la mañana y recójalo por la tarde. Ideal para los días de trabajo, con juegos y socialización.",
  },
  "Plus d'avantages,": { en: "More benefits,", es: "Más ventajas," },
  "plus de Pattes.": { en: "more Paw points.", es: "más puntos Patita." },
  "Activez Premium pour obtenir": { en: "Join Premium to receive", es: "Active Premium para obtener" },
  "-10% sur chaque réservation": { en: "10% off every booking", es: "un 10% de descuento en cada reserva" },
  ", des Pattes doublées et une priorité pendant les vacances.": {
    en: ", double Paw points and priority during holiday periods.",
    es: ", puntos Patita dobles y prioridad durante las vacaciones.",
  },
  "Découvrir le concept": { en: "Discover how it works", es: "Descubrir cómo funciona" },
  "Voir Premium": { en: "View Premium", es: "Ver Premium" },
  "Pattes doublées": { en: "Double Paw points", es: "Puntos Patita dobles" },
  "1 euro dépensé rapporte 2 Pattes avec Premium.": {
    en: "Earn 2 Paw points for every euro spent with Premium.",
    es: "Gane 2 puntos Patita por cada euro gastado con Premium.",
  },
  "-10% immédiat": { en: "Instant 10% off", es: "10% de descuento inmediato" },
  "La remise s'applique automatiquement sur les réservations.": {
    en: "The discount is applied automatically to bookings.",
    es: "El descuento se aplica automáticamente a las reservas.",
  },
  "Badge Premium": { en: "Premium badge", es: "Insignia Premium" },
  "Votre statut est visible dans votre espace client.": {
    en: "Your status is displayed in your account.",
    es: "Su estado aparece en su cuenta.",
  },
  "Priorité vacances": { en: "Holiday priority", es: "Prioridad en vacaciones" },
  "Vos demandes sont priorisées sur les périodes chargées.": {
    en: "Your requests receive priority during busy periods.",
    es: "Sus solicitudes tienen prioridad durante los periodos de mayor demanda.",
  },
  "Rejoignez la famille.": { en: "Join the family.", es: "Únase a la familia." },
  "Créez votre compte gratuitement et réservez votre première garde en moins de 2 minutes.": {
    en: "Create your free account and book your first pet stay in under 2 minutes.",
    es: "Cree su cuenta gratis y reserve el primer cuidado de su mascota en menos de 2 minutos.",
  },
  "Garde chien Disneyland Paris": { en: "Dog sitting near Disneyland Paris", es: "Cuidado de perros cerca de Disneyland Paris" },
  "Pension chien 77": { en: "Dog boarding in Seine-et-Marne", es: "Alojamiento canino en Seine-et-Marne" },
  "Garde animaux Seine-et-Marne": { en: "Pet care in Seine-et-Marne", es: "Cuidado de mascotas en Seine-et-Marne" },
  "Garde animaux 77": { en: "Pet care in Seine-et-Marne", es: "Cuidado de mascotas en Seine-et-Marne" },
  "minutes · chat sur demande": { en: "minutes · cats on request", es: "minutos · gatos bajo petición" },

  // Loyalty concept
  "Nouveau : Premium et fidélité": { en: "New: Premium and loyalty rewards", es: "Nuevo: Premium y recompensas" },
  "Des récompenses claires,": { en: "Clear rewards,", es: "Recompensas claras," },
  "faciles à suivre.": { en: "easy to track.", es: "fáciles de seguir." },
  "Tous les clients gagnent des Pattes à chaque réservation. Premium ajoute une remise automatique, les Pattes doublées et des avantages de confort.": {
    en: "Every customer earns Paw points with each booking. Premium adds an automatic discount, double points and extra convenience.",
    es: "Todos los clientes ganan puntos Patita con cada reserva. Premium añade un descuento automático, puntos dobles y ventajas adicionales.",
  },
  "1. Réservez": { en: "1. Book", es: "1. Reserve" },
  "Chaque euro dépensé rapporte 1 Patte dans le programme gratuit.": {
    en: "Earn 1 Paw point for every euro spent with the free programme.",
    es: "Gane 1 punto Patita por cada euro gastado con el programa gratuito.",
  },
  "2. Montez de niveau": { en: "2. Level up", es: "2. Suba de nivel" },
  "Bronze, Argent, Or puis Diamant : votre statut progresse automatiquement.": {
    en: "Bronze, Silver, Gold then Diamond: your status progresses automatically.",
    es: "Bronce, Plata, Oro y Diamante: su nivel progresa automáticamente.",
  },
  "3. Débloquez des récompenses": { en: "3. Unlock rewards", es: "3. Desbloquee recompensas" },
  "300, 700 et 1500 Pattes ouvrent des réductions et avantages fidélité.": {
    en: "Reach 300, 700 and 1,500 Paw points to unlock discounts and loyalty benefits.",
    es: "Alcance 300, 700 y 1500 puntos Patita para obtener descuentos y ventajas.",
  },
  "300 Pattes donnent 5 €, 700 Pattes donnent 15 € et 1500 Pattes donnent 24 € de réduction.": {
    en: "300 Paw points give €5 off, 700 Paw points give €15 off and 1,500 Paw points give €24 off.",
    es: "300 puntos Patita dan 5 € de descuento, 700 dan 15 € y 1500 dan 24 € de descuento.",
  },
  "Gratuit ou Premium ?": { en: "Free or Premium?", es: "¿Gratis o Premium?" },
  "Le programme fidélité reste inclus pour tous les clients.": {
    en: "The loyalty programme remains included for every customer.",
    es: "El programa de fidelidad está incluido para todos los clientes.",
  },
  "Fidélité gratuite": { en: "Free loyalty programme", es: "Fidelidad gratuita" },
  "Pattes gagnées": { en: "Paw points earned", es: "Puntos Patita ganados" },
  "Niveaux": { en: "Levels", es: "Niveles" },
  "Bronze à Diamant": { en: "Bronze to Diamond", es: "De Bronce a Diamante" },
  "Récompenses": { en: "Rewards", es: "Recompensas" },
  "5 euros de réduction": { en: "€5 discount", es: "5 euros de descuento" },
  "15 euros de réduction": { en: "€15 discount", es: "15 euros de descuento" },
  "24 euros de réduction": { en: "€24 discount", es: "24 euros de descuento" },
  "Prix": { en: "Price", es: "Precio" },
  "Remise": { en: "Discount", es: "Descuento" },
  "Incluse": { en: "Included", es: "Incluida" },
  "Annulation": { en: "Cancellation", es: "Cancelación" },
  "Gratuite jusqu'à 24h": { en: "Free up to 24 hours", es: "Gratis hasta 24 horas antes" },
  "Gratuite au moins 24h avant": { en: "Free at least 24 hours before", es: "Gratis al menos 24 horas antes" },
  "Prix mensuel": { en: "Monthly price", es: "Precio mensual" },
  "Questions fréquentes": { en: "Frequently asked questions", es: "Preguntas frecuentes" },
  "Est-ce que le programme fidélité est payant ?": { en: "Does the loyalty programme cost anything?", es: "¿El programa de fidelidad es de pago?" },
  "Non. Tous les clients gagnent des Pattes automatiquement à chaque réservation.": {
    en: "No. Every customer automatically earns Paw points with each booking.",
    es: "No. Todos los clientes ganan automáticamente puntos Patita con cada reserva.",
  },
  "Que donne Premium ?": { en: "What does Premium include?", es: "¿Qué incluye Premium?" },
  "Que deviennent mes Pattes si j’arrête Premium ?": { en: "What happens to my Paw points if I cancel Premium?", es: "¿Qué ocurre con mis puntos Patita si cancelo Premium?" },
  "Elles restent dans votre espace client. Seuls les avantages Premium s’arrêtent.": {
    en: "They stay in your account. Only your Premium benefits end.",
    es: "Permanecen en su cuenta. Solo finalizan las ventajas Premium.",
  },
  "Prêt à passer Premium ?": { en: "Ready to join Premium?", es: "¿Listo/a para pasarse a Premium?" },
  "Le programme fidélité gratuit reste actif quoi qu'il arrive.": {
    en: "Your free loyalty programme remains active whatever you decide.",
    es: "El programa de fidelidad gratuito seguirá activo decida lo que decida.",
  },

  // Navigation, account and authentication
  "Navigation principale": { en: "Main navigation", es: "Navegación principal" },
  "Accueil": { en: "Home", es: "Inicio" },
  "Réserver": { en: "Book", es: "Reservar" },
  "Animaux": { en: "Pets", es: "Mascotas" },
  "Mes Animaux": { en: "My pets", es: "Mis mascotas" },
  "Profil": { en: "Profile", es: "Perfil" },
  "Tarifs": { en: "Pricing", es: "Precios" },
  "Garde 77": { en: "Local pet care", es: "Cuidado local" },
  "Connexion": { en: "Sign in", es: "Iniciar sesión" },
  "S’inscrire": { en: "Sign up", es: "Registrarse" },
  "S'inscrire": { en: "Sign up", es: "Registrarse" },
  "Créer": { en: "Sign up", es: "Registro" },
  "Bonjour": { en: "Hello", es: "Hola" },
  "Espace admin": { en: "Admin area", es: "Área de administración" },
  "Mon Espace": { en: "My account", es: "Mi cuenta" },
  "Se déconnecter": { en: "Sign out", es: "Cerrar sesión" },
  "Déconnexion...": { en: "Signing out...", es: "Cerrando sesión..." },
  "Bon retour !": { en: "Welcome back!", es: "¡Qué alegría volver a verle!" },
  "Connectez-vous pour gérer vos gardes.": { en: "Sign in to manage your bookings.", es: "Inicie sesión para gestionar sus reservas." },
  "Compte créé avec succès ! Bienvenue 🐾": { en: "Account created successfully! Welcome 🐾", es: "¡Cuenta creada correctamente! Bienvenido/a 🐾" },
  "Identifiants incorrects 😕": { en: "Incorrect email or password 😕", es: "Correo o contraseña incorrectos 😕" },
  "Une erreur inattendue est survenue": { en: "An unexpected error occurred", es: "Se ha producido un error inesperado" },
  "Mot de passe": { en: "Password", es: "Contraseña" },
  "Mot de passe oublié ?": { en: "Forgot your password?", es: "¿Ha olvidado su contraseña?" },
  "Oublié ?": { en: "Forgot it?", es: "¿La olvidó?" },
  "Se connecter": { en: "Sign in", es: "Iniciar sesión" },
  "Pas encore de compte ?": { en: "Don't have an account yet?", es: "¿Todavía no tiene cuenta?" },
  "Retour à l'accueil": { en: "Back to home", es: "Volver al inicio" },
  "Bienvenue !": { en: "Welcome!", es: "¡Bienvenido/a!" },
  "Rejoignez la famille et offrez le meilleur à votre compagnon.": {
    en: "Join the family and give your pet the very best.",
    es: "Únase a la familia y ofrezca lo mejor a su mascota.",
  },
  "Prénom": { en: "First name", es: "Nombre" },
  "Votre prénom": { en: "Your first name", es: "Su nombre" },
  "Déjà membre ?": { en: "Already a member?", es: "¿Ya tiene cuenta?" },
  "Me connecter": { en: "Sign in", es: "Iniciar sesión" },
  "Nouveau mot de passe": { en: "New password", es: "Nueva contraseña" },
  "Choisissez au moins 8 caractères.": { en: "Choose at least 8 characters.", es: "Elija al menos 8 caracteres." },
  "Saisissez l'adresse email de votre compte. Le lien reçu sera valable une heure.": {
    en: "Enter your account email address. The link you receive will be valid for one hour.",
    es: "Introduzca el correo de su cuenta. El enlace que reciba será válido durante una hora.",
  },
  "Retour à la connexion": { en: "Back to sign in", es: "Volver al inicio de sesión" },

  // Booking flow
  "Hébergement": { en: "Boarding", es: "Alojamiento" },
  "Garderie Jour": { en: "Day care", es: "Guardería de día" },
  "Visite à votre domicile": { en: "Home visit", es: "Visita a domicilio" },
  "Promenade": { en: "Dog walk", es: "Paseo" },
  "Votre compagnon vit avec nous, accès canapé et jardin inclus.": {
    en: "Your pet stays in our home, with sofa and garden access included.",
    es: "Su mascota se queda en nuestra casa, con acceso al sofá y al jardín.",
  },
  "Présence longue chez vous sur une journée complète : repas, sorties, compagnie et surveillance.": {
    en: "Full-day care in your home: meals, walks, company and supervision.",
    es: "Cuidado durante todo el día en su casa: comidas, paseos, compañía y supervisión.",
  },
  "Déposez-le le matin, récupérez-le le soir.": { en: "Drop off in the morning and collect in the evening.", es: "Déjelo por la mañana y recójalo por la tarde." },
  "Passage ponctuel chez vous de 30 min à 2 h : repas, litière, soins simples et présence.": {
    en: "A 30-minute to 2-hour home visit for feeding, litter care, basic care and company.",
    es: "Una visita a domicilio de 30 minutos a 2 horas para comida, arenero, cuidados básicos y compañía.",
  },
  "Balade de 30 min dans le quartier.": { en: "A 30-minute walk around the neighbourhood.", es: "Un paseo de 30 minutos por el barrio." },
  "Créer les passages": { en: "Schedule visits", es: "Programar visitas" },
  "Choisissez les dates, le nombre de passages par jour et leur durée. Le planning apparaîtra juste en dessous.": {
    en: "Choose the dates, number of visits per day and duration. Your schedule will appear below.",
    es: "Elija las fechas, el número de visitas al día y su duración. El horario aparecerá debajo.",
  },
  "Rythme souhaité": { en: "Preferred frequency", es: "Frecuencia deseada" },
  "1 passage": { en: "1 visit", es: "1 visita" },
  "2 passages": { en: "2 visits", es: "2 visitas" },
  "3 passages": { en: "3 visits", es: "3 visitas" },
  "Matin": { en: "Morning", es: "Mañana" },
  "Matin et midi": { en: "Morning and midday", es: "Mañana y mediodía" },
  "Matin, midi et soir": { en: "Morning, midday and evening", es: "Mañana, mediodía y tarde" },
  "Date de début": { en: "Start date", es: "Fecha de inicio" },
  "Date de fin": { en: "End date", es: "Fecha de fin" },
  "Jour de garde": { en: "Sitting day", es: "Día de cuidado" },
  "Jour de garderie": { en: "Day-care date", es: "Día de guardería" },
  "Passages / jour": { en: "Visits per day", es: "Visitas al día" },
  "Durée": { en: "Duration", es: "Duración" },
  "Passages sélectionnés": { en: "Selected visits", es: "Visitas seleccionadas" },
  "Aucun passage généré pour le moment.": { en: "No visits scheduled yet.", es: "Todavía no hay visitas programadas." },
  "Ajouter un passage": { en: "Add a visit", es: "Añadir una visita" },
  "Dates rapides": { en: "Quick dates", es: "Fechas rápidas" },
  "Aujourd’hui": { en: "Today", es: "Hoy" },
  "Demain": { en: "Tomorrow", es: "Mañana" },
  "Ce week-end": { en: "This weekend", es: "Este fin de semana" },
  "Composer le planning": { en: "Build your schedule", es: "Crear el horario" },
  "Ajoutez un jour ponctuel ou plusieurs jours d’un coup. Vous pourrez ensuite ajuster chaque passage.": {
    en: "Add a single day or several days at once. You can then adjust each visit.",
    es: "Añada un día o varios días a la vez. Después podrá ajustar cada visita.",
  },
  "Choisir rapidement": { en: "Quick selection", es: "Selección rápida" },
  "Durée de chaque passage": { en: "Duration of each visit", es: "Duración de cada visita" },
  "Heure": { en: "Time", es: "Hora" },
  "passages prêts à être ajoutés": { en: "visits ready to add", es: "visitas listas para añadir" },
  "passage prêt à être ajouté": { en: "visit ready to add", es: "visita lista para añadir" },
  "jours": { en: "days", es: "días" },
  "Ajouter au planning": { en: "Add to schedule", es: "Añadir al horario" },
  "Créer le planning": { en: "Create schedule", es: "Crear horario" },
  "Planning sélectionné": { en: "Selected schedule", es: "Horario seleccionado" },
  "passages": { en: "visits", es: "visitas" },
  "passage": { en: "visit", es: "visita" },
  "Aucun passage ajouté pour le moment.": { en: "No visits added yet.", es: "Todavía no se han añadido visitas." },
  "Passage": { en: "Visit", es: "Visita" },
  "Vider": { en: "Clear", es: "Vaciar" },
  "Choisissez une date et ajoutez-la au planning.": { en: "Choose a date and add it to the schedule.", es: "Elija una fecha y añádala al horario." },
  "Ajouter un passage ce jour": { en: "Add a visit on this day", es: "Añadir una visita este día" },
  "Heure du passage": { en: "Visit time", es: "Hora de la visita" },
  "Durée du passage": { en: "Visit duration", es: "Duración de la visita" },
  "Supprimer ce passage": { en: "Delete this visit", es: "Eliminar esta visita" },
  "Choisir le jour de garde": { en: "Choose the sitting date", es: "Elegir el día de cuidado" },
  "Choisir le jour de garderie": { en: "Choose the day-care date", es: "Elegir el día de guardería" },
  "Commencez par le jour, puis choisissez un créneau adapté à votre routine.": {
    en: "Start with the date, then choose a time slot that suits your routine.",
    es: "Empiece por la fecha y elija un horario adaptado a su rutina.",
  },
  "Horaires pratiques": { en: "Convenient times", es: "Horarios prácticos" },
  "Planifier les journées de garde": { en: "Plan the sitting days", es: "Planificar los días de cuidado" },
  "Choisissez une ou plusieurs journées. Les mêmes horaires seront appliqués chaque jour, sans nuitée.": {
    en: "Choose one or more days. The same hours will apply each day, with no overnight stay.",
    es: "Elija uno o varios días. Se aplicará el mismo horario cada día, sin estancia nocturna.",
  },
  "Nombre de journées": { en: "Number of days", es: "Número de días" },
  "journée": { en: "day", es: "día" },
  "journées": { en: "days", es: "días" },
  "Première journée": { en: "First day", es: "Primer día" },
  "Dernière journée": { en: "Last day", es: "Último día" },
  "Demi-journée": { en: "Half day", es: "Medio día" },
  "Journée Disneyland": { en: "Disneyland day", es: "Día en Disneyland" },
  "Soirée au parc": { en: "Evening at the park", es: "Tarde en el parque" },
  "Disney + soirée": { en: "Disney + evening", es: "Disney + tarde-noche" },
  "Début chaque jour": { en: "Start each day", es: "Inicio cada día" },
  "Fin chaque jour": { en: "End each day", es: "Fin cada día" },
  "journées sélectionnées": { en: "days selected", es: "días seleccionados" },
  "journée sélectionnée": { en: "day selected", es: "día seleccionado" },
  "par jour": { en: "per day", es: "al día" },
  "La fin doit être après le début le même jour. Les créneaux de nuit ne sont pas acceptés.": {
    en: "The end time must be after the start time on the same day. Overnight slots are not accepted.",
    es: "La hora de fin debe ser posterior a la de inicio el mismo día. No se aceptan horarios nocturnos.",
  },
  "Chaque date correspond à une garde en journée aux horaires choisis. Pour une présence pendant la nuit, choisissez l’hébergement.": {
    en: "Each date is a daytime sitting session at the selected hours. For overnight care, choose boarding.",
    es: "Cada fecha corresponde a un cuidado diurno en el horario elegido. Para cuidado nocturno, elija alojamiento.",
  },
  "Une présence prolongée chez vous, sur une ou plusieurs journées sans nuitée : repas, sorties, compagnie, surveillance et respect de la routine habituelle.": {
    en: "Extended care in your home over one or more days without overnight stays: meals, outings, company, supervision and respect for the usual routine.",
    es: "Cuidado prolongado en su domicilio durante uno o varios días sin pernocta: comidas, salidas, compañía, supervisión y respeto de la rutina habitual.",
  },
  "Horaires quotidiens :": { en: "Daily hours:", es: "Horario diario:" },
  "Journées :": { en: "Days:", es: "Días:" },
  "Aucune nuitée incluse.": { en: "No overnight stay included.", es: "No incluye estancia nocturna." },
  "Journée": { en: "Full day", es: "Día completo" },
  "Soirée": { en: "Evening", es: "Tarde-noche" },
  "Longue présence": { en: "Extended stay", es: "Estancia prolongada" },
  "Dépose tôt": { en: "Early drop-off", es: "Entrega temprana" },
  "Journée standard": { en: "Standard day", es: "Día estándar" },
  "Dépose tard": { en: "Late drop-off", es: "Entrega tardía" },
  "La garderie est limitée à 10 heures par jour. Ajustez l’heure de début ou de fin.": {
    en: "Day care is limited to 10 hours per day. Adjust the start or end time.",
    es: "La guardería está limitada a 10 horas al día. Ajuste la hora de inicio o de fin.",
  },
  "L’heure de fin doit être postérieure à l’heure de début.": {
    en: "The end time must be later than the start time.",
    es: "La hora de fin debe ser posterior a la hora de inicio.",
  },
  "La garderie de jour est limitée à une seule journée et à 10 heures. Pour plusieurs jours avec nuit, choisissez l’hébergement.": {
    en: "Day care is limited to one day and 10 hours. For overnight stays across several days, choose boarding.",
    es: "La guardería está limitada a un día y 10 horas. Para varios días con noche, elija alojamiento.",
  },
  "Planifier le séjour": { en: "Plan your stay", es: "Planificar la estancia" },
  "Choisissez l’arrivée et le départ. Une nuit minimum est nécessaire.": {
    en: "Choose arrival and departure. A minimum stay of one night is required.",
    es: "Elija la llegada y la salida. Se requiere al menos una noche.",
  },
  "Arrivée rapide": { en: "Quick arrival", es: "Llegada rápida" },
  "Durée du séjour": { en: "Length of stay", es: "Duración de la estancia" },
  "nuits": { en: "nights", es: "noches" },
  "Arrivée": { en: "Arrival", es: "Llegada" },
  "Heure d’arrivée": { en: "Arrival time", es: "Hora de llegada" },
  "Départ": { en: "Departure", es: "Salida" },
  "Heure de départ": { en: "Departure time", es: "Hora de salida" },
  "nuits sélectionnées": { en: "nights selected", es: "noches seleccionadas" },
  "nuit sélectionnée": { en: "night selected", es: "noche seleccionada" },
  "à": { en: "at", es: "a las" },
  "Créneau disponible": { en: "Time slot available", es: "Horario disponible" },
  "Créneau indisponible": { en: "Time slot unavailable", es: "Horario no disponible" },
  "Vérification des disponibilités…": { en: "Checking availability…", es: "Comprobando disponibilidad…" },
  "Certaines dates sont indisponibles": { en: "Some dates are unavailable", es: "Algunas fechas no están disponibles" },
  "Dates concernées": { en: "Affected dates", es: "Fechas afectadas" },
  "Sélectionnez vos dates": { en: "Select your dates", es: "Seleccione sus fechas" },
  "Vos animaux": { en: "Your pets", es: "Sus mascotas" },
  "Choisissez le service": { en: "Choose a service", es: "Elija un servicio" },
  "Nouvelle réservation": { en: "New booking", es: "Nueva reserva" },
  "Récapitulatif": { en: "Summary", es: "Resumen" },
  "Total": { en: "Total", es: "Total" },
  "Continuer": { en: "Continue", es: "Continuar" },
  "Retour": { en: "Back", es: "Atrás" },
  "Payer et réserver": { en: "Pay and book", es: "Pagar y reservar" },
  "Paiement en ligne sécurisé par Stripe.": { en: "Secure online payment powered by Stripe.", es: "Pago seguro en línea con Stripe." },
  "Aucun animal enregistré": { en: "No pets registered", es: "No hay mascotas registradas" },
  "Ajouter un animal": { en: "Add a pet", es: "Añadir una mascota" },
  "Chien": { en: "Dog", es: "Perro" },
  "Chat": { en: "Cat", es: "Gato" },
  "Chien :": { en: "Dog:", es: "Perro:" },
  "Chat :": { en: "Cat:", es: "Gato:" },
  "nuit": { en: "night", es: "noche" },
  "jour": { en: "day", es: "día" },
  "visite": { en: "visit", es: "visita" },

  // Customer area and pet profiles
  "Toutes vos réservations": { en: "All your bookings", es: "Todas sus reservas" },
  "Confirmée": { en: "Confirmed", es: "Confirmada" },
  "Terminée": { en: "Completed", es: "Finalizada" },
  "Annulée": { en: "Cancelled", es: "Cancelada" },
  "Terminées": { en: "Completed", es: "Finalizadas" },
  "Annulées": { en: "Cancelled", es: "Canceladas" },
  "Aucune réservation trouvée": { en: "No bookings found", es: "No se encontraron reservas" },
  "Annuler cette réservation ?": { en: "Cancel this booking?", es: "¿Cancelar esta reserva?" },
  "Compte": { en: "Account", es: "Cuenta" },
  "Mes informations": { en: "My details", es: "Mis datos" },
  "Informations enregistrées.": { en: "Details saved.", es: "Datos guardados." },
  "Profils complets": { en: "Complete profiles", es: "Perfiles completos" },
  "À compléter": { en: "Needs completing", es: "Por completar" },
  "Aucun profil animal": { en: "No pet profiles", es: "No hay perfiles de mascotas" },
  "Race non renseignée": { en: "Breed not provided", es: "Raza no indicada" },
  "Mâle": { en: "Male", es: "Macho" },
  "Femelle": { en: "Female", es: "Hembra" },
  "Genre inconnu": { en: "Unknown sex", es: "Sexo desconocido" },
  "Âge": { en: "Age", es: "Edad" },
  "Poids": { en: "Weight", es: "Peso" },
  "Stérilisé": { en: "Neutered", es: "Esterilizado" },
  "Oui": { en: "Yes", es: "Sí" },
  "Non / inconnu": { en: "No / unknown", es: "No / desconocido" },
  "Identité": { en: "Identity", es: "Identidad" },
  "Santé & habitudes": { en: "Health & habits", es: "Salud y hábitos" },
  "Informations médicales": { en: "Medical information", es: "Información médica" },
  "Médicaments": { en: "Medication", es: "Medicamentos" },
  "Vétérinaire": { en: "Vet", es: "Veterinario" },
  "Carnet de santé": { en: "Health record", es: "Historial de salud" },
  "Carnet de vaccination": { en: "Vaccination record", es: "Cartilla de vacunación" },
  "Aucun vaccin enregistré": { en: "No vaccines recorded", es: "No hay vacunas registradas" },
  "Ajouter un vaccin": { en: "Add a vaccine", es: "Añadir una vacuna" },
  "Enregistrer": { en: "Save", es: "Guardar" },

  // Reviews, subscriptions and shared UI
  "Avis clients": { en: "Customer reviews", es: "Opiniones de clientes" },
  "Ils nous font confiance ❤️": { en: "Trusted by pet owners ❤️", es: "Propietarios que confían en nosotros ❤️" },
  "Découvrez les retours de nos clients sur nos plateformes partenaires. Votre compagnon mérite ce qu'il y a de mieux.": {
    en: "Read what our customers say on our partner platforms. Your companion deserves the very best.",
    es: "Descubra las opiniones de nuestros clientes en nuestras plataformas asociadas. Su mascota merece lo mejor.",
  },
  "Propriétaire vérifié": { en: "Verified owner", es: "Propietario verificado" },
  "Voir tous les avis": { en: "View all reviews", es: "Ver todas las opiniones" },
  "Partager aussi votre expérience sur Google": {
    en: "Share your experience on Google too",
    es: "Comparta también su experiencia en Google",
  },
  "Votre avis Google aide les familles près de Disneyland Paris à trouver une personne de confiance pour leur animal.": {
    en: "Your Google review helps families near Disneyland Paris find someone they can trust with their pet.",
    es: "Su opinión en Google ayuda a las familias cerca de Disneyland Paris a encontrar a alguien de confianza para cuidar de su mascota.",
  },
  "Publier mon avis sur Google": {
    en: "Post my review on Google",
    es: "Publicar mi opinión en Google",
  },
  "La publication sur Google est facultative et s’ouvre dans un nouvel onglet.": {
    en: "Posting on Google is optional and opens in a new tab.",
    es: "Publicar en Google es opcional y se abre en una nueva pestaña.",
  },
  "Voir le profil": { en: "View profile", es: "Ver perfil" },
  "Plus d'avantages, tout simplement": { en: "More benefits, made simple", es: "Más ventajas, así de fácil" },
  "Votre abonnement Premium est actif": { en: "Your Premium membership is active", es: "Su suscripción Premium está activa" },
  "Premium ajoute des avantages concrets à chaque réservation. Le programme de fidélité gratuit reste ouvert à tous.": {
    en: "Premium adds valuable benefits to every booking. The free loyalty programme remains open to everyone.",
    es: "Premium añade ventajas concretas a cada reserva. El programa de fidelidad gratuito sigue abierto a todos.",
  },
  "Vous bénéficiez déjà de la remise de 10 %, des Pattes doublées et du badge Premium.": {
    en: "You already receive 10% off, double Paw points and the Premium badge.",
    es: "Ya disfruta de un 10% de descuento, puntos Patita dobles y la insignia Premium.",
  },
  "Gérer Premium": { en: "Manage Premium", es: "Gestionar Premium" },
  "Avantages Premium": { en: "Premium benefits", es: "Ventajas Premium" },
  "La remise s’applique automatiquement sur toutes les réservations.": {
    en: "The discount is applied automatically to every booking.",
    es: "El descuento se aplica automáticamente a todas las reservas.",
  },
  "1 euro dépensé rapporte 2 Pattes au lieu de 1.": {
    en: "Earn 2 Paw points instead of 1 for every euro spent.",
    es: "Gane 2 puntos Patita en lugar de 1 por cada euro gastado.",
  },
  "Vos demandes passent en priorité sur les périodes chargées.": {
    en: "Your requests receive priority during busy periods.",
    es: "Sus solicitudes tienen prioridad durante los periodos de mayor demanda.",
  },
  "Votre statut est visible dans l’espace client.": { en: "Your status is displayed in your account.", es: "Su estado aparece en su cuenta." },
  "Fidélité gratuite incluse pour tous": { en: "Free loyalty programme for everyone", es: "Fidelidad gratuita para todos" },
  "Sans Premium : 1 euro dépensé = 1 Patte. Avec Premium : 1 euro dépensé = 2 Pattes.": {
    en: "Without Premium: €1 spent = 1 Paw point. With Premium: €1 spent = 2 Paw points.",
    es: "Sin Premium: 1 € gastado = 1 punto Patita. Con Premium: 1 € gastado = 2 puntos Patita.",
  },
  "Les avantages s'appliquent automatiquement à vos réservations.": {
    en: "Benefits are applied automatically to your bookings.",
    es: "Las ventajas se aplican automáticamente a sus reservas.",
  },
  "Premium actif": { en: "Premium active", es: "Premium activo" },
  "Activer Premium": { en: "Join Premium", es: "Activar Premium" },
  "Préparation": { en: "Preparing", es: "Preparando" },
  "Chargement": { en: "Loading", es: "Cargando" },
  "Paiement sécurisé par Stripe. Résiliation depuis votre profil.": {
    en: "Secure payment by Stripe. Cancel anytime from your profile.",
    es: "Pago seguro con Stripe. Cancele desde su perfil.",
  },
  "Mensuel": { en: "Monthly", es: "Mensual" },
  "/mois": { en: "/month", es: "/mes" },
  "Programme fidélité gratuit": { en: "Free loyalty programme", es: "Programa de fidelidad gratuito" },
  "Mes Pattes": { en: "My Paw points", es: "Mis puntos Patita" },
  "Solde fidélité": { en: "Loyalty balance", es: "Saldo de fidelidad" },
  "Utiliser": { en: "Use", es: "Canjear" },
  "Pas assez": { en: "Not enough", es: "Insuficiente" },
  "Abonnement Premium": { en: "Premium membership", es: "Suscripción Premium" },
  "Gratuit": { en: "Free", es: "Gratis" },
  "Résilier Premium": { en: "Cancel Premium", es: "Cancelar Premium" },
  "Factures Premium": { en: "Premium invoices", es: "Facturas Premium" },
  "Télécharger la facture PDF": { en: "Download PDF invoice", es: "Descargar factura en PDF" },
  "Cookies essentiels": { en: "Essential cookies", es: "Cookies esenciales" },
  "Nécessaires pour la connexion et les paiements Stripe. Aucun cookie publicitaire.": {
    en: "Required for sign-in and Stripe payments. No advertising cookies.",
    es: "Necesarias para iniciar sesión y realizar pagos con Stripe. Sin cookies publicitarias.",
  },
  "Accepter": { en: "Accept", es: "Aceptar" },
  "En savoir plus": { en: "Learn more", es: "Más información" },
  "Vos préférences de cookies": { en: "Your cookie preferences", es: "Sus preferencias de cookies" },
  "Les cookies essentiels assurent la connexion et les paiements. Avec votre accord, Google Analytics nous aide à mesurer les visites et l’efficacité de nos annonces.": {
    en: "Essential cookies support sign-in and payments. With your permission, Google Analytics helps us measure visits and the effectiveness of our ads.",
    es: "Las cookies esenciales permiten el inicio de sesión y los pagos. Con su permiso, Google Analytics nos ayuda a medir las visitas y la eficacia de nuestros anuncios.",
  },
  "Tout accepter": { en: "Accept all", es: "Aceptar todo" },
  "Refuser": { en: "Reject", es: "Rechazar" },
  "En savoir plus et gérer mes préférences": {
    en: "Learn more and manage my preferences",
    es: "Más información y gestionar mis preferencias",
  },
  "Gérer mes cookies": { en: "Manage my cookies", es: "Gestionar mis cookies" },
  "Mesure d’audience et des annonces": {
    en: "Audience and ad measurement",
    es: "Medición de audiencia y anuncios",
  },
  "Avec votre accord uniquement, nous utilisons Google Analytics et la mesure Google Ads afin de comprendre quelles pages sont consultées et si nos annonces permettent de trouver nos services. Le tag utilisé est": {
    en: "Only with your permission, we use Google Analytics and Google Ads measurement to understand which pages are viewed and whether our ads help people find our services. The tag used is",
    es: "Solo con su permiso, utilizamos Google Analytics y la medición de Google Ads para saber qué páginas se visitan y si nuestros anuncios ayudan a encontrar nuestros servicios. La etiqueta utilizada es",
  },
  "Durée maximale": { en: "Maximum duration", es: "Duración máxima" },
  "Mesure d’audience et attribution des campagnes Google.": {
    en: "Audience measurement and Google campaign attribution.",
    es: "Medición de audiencia y atribución de campañas de Google.",
  },
  "13 mois": { en: "13 months", es: "13 meses" },
  "Si vous refusez, ces stockages restent désactivés. Vous pouvez modifier votre choix à tout moment depuis le lien « Gérer mes cookies » situé en bas du site. Nous ne revendons pas vos données.": {
    en: "If you reject, this storage remains disabled. You can change your choice at any time from the “Manage my cookies” link at the bottom of the site. We do not sell your data.",
    es: "Si rechaza, este almacenamiento permanecerá desactivado. Puede cambiar su elección en cualquier momento desde el enlace «Gestionar mis cookies» situado al pie del sitio. No vendemos sus datos.",
  },
  "Signaler un problème": { en: "Report a problem", es: "Informar de un problema" },
  "Fermer": { en: "Close", es: "Cerrar" },
  "Merci ! Le message a été envoyé.": { en: "Thank you! Your message has been sent.", es: "¡Gracias! Su mensaje ha sido enviado." },
  "Description du bug": { en: "Problem description", es: "Descripción del problema" },
  "Décrivez ce qui ne marche pas... (ex: le bouton X ne clique pas sur la page Y)": {
    en: "Describe what is not working... (e.g. button X does not work on page Y)",
    es: "Describa lo que no funciona... (p. ej., el botón X no funciona en la página Y)",
  },
  "Annuler": { en: "Cancel", es: "Cancelar" },
  "Envoi...": { en: "Sending...", es: "Enviando..." },
  "Envoyer le rapport": { en: "Send report", es: "Enviar informe" },

  // Welcome offer
  "Offre de bienvenue": { en: "Welcome offer", es: "Oferta de bienvenida" },
  "-10 % sur votre première réservation": { en: "10% off your first booking", es: "10 % de descuento en su primera reserva" },
  "Réservée aux 5 premiers nouveaux clients · code": { en: "For the first 5 new clients · code", es: "Para los 5 primeros clientes nuevos · código" },
  "J'en profite": { en: "Claim the offer", es: "Aprovechar la oferta" },
  "5 premiers nouveaux clients :": { en: "First 5 new clients:", es: "5 primeros clientes nuevos:" },
  "Offre de bienvenue : 10 % de réduction appliquée": { en: "Welcome offer: 10% discount applied", es: "Oferta de bienvenida: 10 % de descuento aplicado" },
  "Cette offre est réservée aux nouveaux clients, pour leur première réservation.": { en: "This offer is for new clients on their first booking.", es: "Esta oferta está reservada a nuevos clientes en su primera reserva." },
  "Les 5 offres de bienvenue ont déjà été attribuées.": { en: "All 5 welcome offers have already been claimed.", es: "Las 5 ofertas de bienvenida ya han sido asignadas." },
  "Votre offre de bienvenue est déjà associée à une autre réservation.": { en: "Your welcome offer is already linked to another booking.", es: "Su oferta de bienvenida ya está vinculada a otra reserva." },
  "L'offre de bienvenue n'est pas associée à cette réservation.": { en: "The welcome offer is not linked to this booking.", es: "La oferta de bienvenida no está vinculada a esta reserva." },

  // Resident cats shown during bookings hosted at the pet-sitter's home
  "Deux chats vivent à la maison": {
    en: "Two cats live in the house",
    es: "Dos gatos viven en la casa",
  },
  "Pour la garderie et l'hébergement, la compatibilité est prise en compte. Si la cohabitation avec votre animal n'est pas sereine, nos chats restent dans un espace séparé.": {
    en: "For day care and boarding, compatibility is taken into account. If they are not comfortable sharing the space with your pet, our cats are kept in a separate area.",
    es: "Para la guardería y el alojamiento, se tiene en cuenta la compatibilidad. Si no están cómodos compartiendo el espacio con su mascota, nuestros gatos permanecen en una zona separada.",
  },

  // Footer and legal navigation
  "Service de garde d’animaux premium avec suivi en temps réel. Offrez à vos compagnons des vacances aussi belles que les vôtres.": {
    en: "Premium pet care with regular real-time updates. Give your companions a holiday as wonderful as yours.",
    es: "Cuidado premium de mascotas con seguimiento en tiempo real. Ofrezca a sus compañeros unas vacaciones tan bonitas como las suyas.",
  },
  "Navigation": { en: "Navigation", es: "Navegación" },
  "Le Club (Abonnements) ✨": { en: "The Club (Memberships) ✨", es: "El Club (Suscripciones) ✨" },
  "Garde locale": { en: "Local pet care", es: "Cuidado local" },
  "Légal": { en: "Legal", es: "Legal" },
  "Mentions légales": { en: "Legal notice", es: "Aviso legal" },
  "CGV & Annulation": { en: "Terms & cancellations", es: "Condiciones y cancelaciones" },
  "Politique de Confidentialité": { en: "Privacy policy", es: "Política de privacidad" },
  "Tous droits réservés.": { en: "All rights reserved.", es: "Todos los derechos reservados." },
  "Éditeur du site": { en: "Website publisher", es: "Editor del sitio" },
  "Qualification professionnelle": { en: "Professional qualification", es: "Cualificación profesional" },
  "Médiation de la consommation": { en: "Consumer mediation", es: "Mediación de consumo" },
  "Hébergement du site": { en: "Website hosting", es: "Alojamiento del sitio web" },
  // Hero & Home (Chantier 1)
  "Bussy-Saint-Georges · Val d’Europe · Disneyland Paris": {
    en: "Bussy-Saint-Georges · Val d’Europe · Disneyland Paris",
    es: "Bussy-Saint-Georges · Val d’Europe · Disneyland Paris",
  },
  "· Avis vérifiés": { en: "· Verified reviews", es: "· Opiniones verificadas" },
  "Avis vérifiés": { en: "Verified reviews", es: "Opiniones verificadas" },
  "Garde familiale de chiens & chats près de Disneyland Paris,": {
    en: "Family dog & cat boarding near Disneyland Paris,",
    es: "Alojamiento familiar para perros y gatos cerca de Disneyland Paris,",
  },
  "comme à la maison.": { en: "just like home.", es: "como en casa." },
  "100 % sans box ni cage": {
    en: "100% cage-free and kennel-free",
    es: "100 % sin jaulas ni perreras",
  },
  ", garderie de jour, visites à domicile et promenades en Seine-et-Marne (77). Partez l’esprit tranquille avec des photos et nouvelles chaque jour.": {
    en: ", day care, home visits and dog walks in Seine-et-Marne (77). Enjoy complete peace of mind with daily photos and updates.",
    es: ", guardería de día, visitas a domicilio y paseos en Seine-et-Marne (77). Viaje con total tranquilidad con fotos y noticias cada día.",
  },
  "Hébergement familial 100 % sans box ni cage, garderie de jour, visites à domicile et promenades en Seine-et-Marne (77). Partez l’esprit tranquille avec des photos et nouvelles chaque jour.": {
    en: "100% cage-free family boarding, day care, home visits and dog walks in Seine-et-Marne (77). Enjoy complete peace of mind with daily photos and updates.",
    es: "Alojamiento familiar 100 % sin jaulas, guardería de día, visitas a domicilio y paseos en Seine-et-Marne (77). Viaje con total tranquilidad con fotos y noticias cada día.",
  },
  "Vérifier mes dates & simuler mon tarif": {
    en: "Check my dates & estimate my price",
    es: "Comprobar mis fechas y calcular mi tarifa",
  },
  "Découvrir les services & tarifs": {
    en: "Explore services & pricing",
    es: "Descubrir servicios y tarifas",
  },
  "Tarif calculé à la durée réelle": {
    en: "Price calculated on actual duration",
    es: "Tarifa calculada según la duración real",
  },
  "Consignes santé & habitudes vérifiées avant chaque garde": {
    en: "Health instructions & routines checked before every stay",
    es: "Instrucciones de salud y rutinas verificadas antes de cada estancia",
  },
  "Garde familiale de chiens et chats chez La Patte Dorée": {
    en: "Family dog and cat boarding at La Patte Dorée",
    es: "Cuidado familiar de perros y gatos en La Patte Dorée",
  },
  "Cadre 100 % familial": {
    en: "100% family home environment",
    es: "Entorno 100 % familiar",
  },
  "Maison & suivi personnalisé": {
    en: "Home setting & personalised care",
    es: "Hogar y seguimiento personalizado",
  },
  "Dès": { en: "From", es: "Desde" },
  "dès": { en: "from", es: "desde" },
  "% dès": { en: "% from", es: "% desde" },
  "Dès 35 €": { en: "From €35", es: "Desde 35 €" },
  "Zéro box, zéro cage": {
    en: "Zero kennels, zero cages",
    es: "Cero perreras, cero jaulas",
  },
  "Votre compagnon vit avec nous dans la maison, à son rythme, avec sorties et moments de jeu adaptés.": {
    en: "Your pet lives with us inside our home at their own pace, with tailored outings and playtime.",
    es: "Su mascota vive con nosotros en casa, a su propio ritmo, con salidas y momentos de juego adaptados.",
  },
  "Photos & nouvelles quotidiennes": {
    en: "Daily photos & updates",
    es: "Fotos y noticias diarias",
  },
  "Vous suivez son séjour chaque jour pendant votre visite à Disneyland Paris ou vos vacances.": {
    en: "Follow their stay every day during your visit to Disneyland Paris or your holiday.",
    es: "Siga su estancia cada día durante su visita a Disneyland Paris o sus vacaciones.",
  },
  "Titulaire ACACED Chien & Chat": {
    en: "State-certified ACACED Dog & Cat holder",
    es: "Titular del certificado oficial ACACED Perro y Gato",
  },
  "Certificat officiel de capacité, vérification du carnet de santé et respect strict des consignes.": {
    en: "Official French pet care certification, health record check and strict adherence to your instructions.",
    es: "Certificado oficial de capacidad, verificación de la cartilla sanitaria y estricto respeto de sus indicaciones.",
  },
  "Bussy-Saint-Georges · à 10 min des parcs Disney": {
    en: "Bussy-Saint-Georges · 10 min from the Disney parks",
    es: "Bussy-Saint-Georges · a 10 min de los parques Disney",
  },
  "Lire les avis →": { en: "Read reviews →", es: "Leer opiniones →" },
  "Qualifié ACACED": { en: "ACACED Certified", es: "Certificado ACACED" },
  "Chien & chat certifié": {
    en: "Certified for dogs & cats",
    es: "Certificado para perros y gatos",
  },
  "100 % sans box": { en: "100% kennel-free", es: "100 % sin jaulas" },
  "Cadre familial calme": {
    en: "Calm family home",
    es: "Entorno familiar tranquilo",
  },
  "Suivi quotidien": { en: "Daily updates", es: "Seguimiento diario" },
  "Photos & nouvelles": { en: "Photos & updates", es: "Fotos y noticias" },
  "Note 5,0 / 5": { en: "Rated 5.0 / 5", es: "Nota 5,0 / 5" },
  "Note": { en: "Rated", es: "Nota" },
  "Voir les avis clients →": {
    en: "See client reviews →",
    es: "Ver opiniones de clientes →",
  },
  "Un cadre familial": {
    en: "A family home setting",
    es: "Un entorno familiar",
  },
  "Promenades incluses": {
    en: "Walks included",
    es: "Paseos incluidos",
  },

  // Footer & Nav
  "Dog boarding Disneyland Paris (EN)": {
    en: "Dog boarding Disneyland Paris (EN)",
    es: "Guardería y alojamiento canino Disneyland Paris (EN)",
  },
  "Cookies": { en: "Cookies", es: "Cookies" },
  "· SIREN": { en: "· SIREN", es: "· SIREN" },
  "Historique": { en: "History", es: "Historial" },

  // Local SEO & Disneyland Paris (src/lib/seo.ts & src/app/(local-seo)/[slug]/page.tsx)
  "Page introuvable": { en: "Page not found", es: "Página no encontrada" },
  "Cette page n'existe pas.": {
    en: "This page does not exist.",
    es: "Esta página no existe.",
  },
  "animaux": { en: "pets", es: "mascotas" },
  "total": { en: "total", es: "total" },
  "Garderie de jour chien (jusqu’à 10 h)": {
    en: "Dog day care (up to 10 hours)",
    es: "Guardería de día para perros (hasta 10 h)",
  },
  "Garderie de jour chien (jusqu'à 10 h)": {
    en: "Dog day care (up to 10 hours)",
    es: "Guardería de día para perros (hasta 10 h)",
  },
  "Hébergement familial 24 h": {
    en: "24-hour family boarding",
    es: "Alojamiento familiar 24 h",
  },
  "Hébergement familial chien (période de 24 h)": {
    en: "Family dog boarding (24-hour period)",
    es: "Alojamiento familiar para perros (periodo de 24 h)",
  },
  "garde de jour jusqu'à 10 h": {
    en: "day care up to 10 hours",
    es: "guardería de día hasta 10 h",
  },
  "Promenade 30 min": { en: "30-min dog walk", es: "Paseo de 30 min" },
  "Visite 30 min": { en: "30-min home visit", es: "Visita de 30 min" },
  "Garde à votre domicile / hôtel": {
    en: "Sitting at your home / hotel",
    es: "Cuidado en su domicilio / hotel",
  },
  "Sur demande": { en: "On request", es: "Bajo petición" },
  "Diplômée d’État ACACED Chien & Chat": {
    en: "State-certified ACACED Dog & Cat",
    es: "Certificado estatal ACACED Perro y Gato",
  },
  "RER A Bussy-Saint-Georges (8 min) · A4 sortie 12 (10 min)": {
    en: "RER A Bussy-Saint-Georges (8 min) · A4 exit 12 (10 min)",
    es: "RER A Bussy-Saint-Georges (8 min) · A4 salida 12 (10 min)",
  },
  "Simuler mon tarif": { en: "Estimate my price", es: "Calcular mi tarifa" },
  "Visiting from abroad? Read this page in English": {
    en: "Visiting from abroad? Read this page in English",
    es: "¿Nos visita desde el extranjero? Lea esta página en inglés",
  },
  "Service indépendant de garde d'animaux certifié ACACED, non affilié à Disneyland Paris.": {
    en: "Independent ACACED-certified pet sitting service, not affiliated with Disneyland Paris.",
    es: "Servicio independiente de cuidado de mascotas certificado por ACACED, no afiliado a Disneyland Paris.",
  },
  "Service de garde d'animaux pour chiens et chats près de Disneyland Paris, Bussy-Saint-Georges, Val d'Europe et en Seine-et-Marne.": {
    en: "Dog and cat sitting and boarding service near Disneyland Paris, Bussy-Saint-Georges, Val d'Europe and in Seine-et-Marne.",
    es: "Servicio de cuidado y alojamiento de perros y gatos cerca de Disneyland Paris, Bussy-Saint-Georges, Val d'Europe y en Seine-et-Marne.",
  },
  "Garde familiale chien · À 10 min de Disneyland Paris": {
    en: "Family dog boarding · 10 min from Disneyland Paris",
    es: "Alojamiento familiar canino · A 10 min de Disneyland Paris",
  },
  "Garde chien et chat dans le 77": {
    en: "Dog and cat sitting in Seine-et-Marne (77)",
    es: "Cuidado de perros y gatos en Seine-et-Marne (77)",
  },
  "✓ Diplômée ACACED · ✓ Bussy-Saint-Georges (RER A 8 min / A4 sortie 12 10 min)": {
    en: "✓ ACACED certified · ✓ Bussy-Saint-Georges (RER A 8 min / A4 exit 12 10 min)",
    es: "✓ Certificada ACACED · ✓ Bussy-Saint-Georges (RER A 8 min / A4 salida 12 10 min)",
  },
  "Horaires réels : la période de 24 h démarre à l’heure de dépôt (le passage de minuit ne déclenche jamais une seconde journée facturée).": {
    en: "Real-time billing: the 24-hour period starts at drop-off time (crossing midnight never triggers a second billed day).",
    es: "Horarios reales: el periodo de 24 h comienza a la hora de entrega (el paso de la medianoche nunca genera un segundo día facturado).",
  },
  "Formules & Tarifs clairs": {
    en: "Clear packages & pricing",
    es: "Fórmulas y tarifas claras",
  },
  "Quelle garde choisir pendant votre séjour à Disneyland Paris ?": {
    en: "Which care option should you choose during your stay at Disneyland Paris?",
    es: "¿Qué opción de cuidado elegir durante su estancia en Disneyland Paris?",
  },
  "Besoin d'une garde fiable dans le 77 ?": {
    en: "Need reliable pet sitting in Seine-et-Marne (77)?",
    es: "¿Necesita un cuidado de mascotas de confianza en el 77?",
  },
  "Hébergement chien": { en: "Dog boarding", es: "Alojamiento para perros" },
  "Hébergement chat": { en: "Cat boarding", es: "Alojamiento para gatos" },
  "Garderie chien": { en: "Dog day care", es: "Guardería para perros" },
  "Garderie chat": { en: "Cat day care", es: "Guardería para gatos" },
  "Visite chien": { en: "Dog home visit", es: "Visita para perros" },
  "Visite chat": { en: "Cat home visit", es: "Visita para gatos" },
  "Promenade chien": { en: "Dog walk", es: "Paseo para perros" },
  "Visite 2 h chat": { en: "2-hour cat visit", es: "Visita de 2 h para gatos" },
  "Garde de chien près de Disneyland Paris : l'alternative familiale sans box": {
    en: "Dog Boarding & Daycare Near Disneyland Paris: The Cage-Free Family Alternative",
    es: "Cuidado de perros cerca de Disneyland Paris: la alternativa familiar sin jaulas",
  },
  "Garde Chien Disneyland Paris : Alternative au Chenil (Sans Box)": {
    en: "Dog Boarding Near Disneyland Paris: Cage-Free Alternative to the Kennel",
    es: "Guardería y Alojamiento Canino en Disneyland Paris: Alternativa sin Jaulas",
  },
  "Alternative familiale au chenil de Disneyland Paris : garde chien sans box à 10 min des parcs (Bussy-St-Georges). Garderie jour 35 €, pension 24h 45 €, photos.": {
    en: "Family alternative to the Disneyland Paris kennel: cage-free dog boarding 10 min from the parks (Bussy-St-Georges). Day care €35, 24h boarding €45, photo updates.",
    es: "Alternativa familiar a la perrera de Disneyland Paris: cuidado de perros sin jaulas a 10 min de los parques (Bussy-St-Georges). Guardería 35 €, pensión 24h 45 €, fotos.",
  },
  "Garde chien Disneyland Paris · À 10 min des parcs (Bussy-Saint-Georges)": {
    en: "Dog boarding Disneyland Paris · 10 min from the parks (Bussy-Saint-Georges)",
    es: "Cuidado de perros Disneyland Paris · A 10 min de los parques (Bussy-Saint-Georges)",
  },
  "Vous visitez Disneyland Paris pour la journée ou séjournez dans un hôtel à Val d'Europe ? Offrez à votre chien de vraies vacances pendant que vous profitez des attractions. Située à Bussy-Saint-Georges (à 2 stations de RER A ou 10 minutes en voiture des parcs), La Patte Dorée accueille votre compagnon dans une vraie maison avec jardin, sans box ni cage, avec promenades incluses et photos envoyées dans la journée.": {
    en: "Visiting Disneyland Paris for the day or staying at a hotel in Val d'Europe? Give your dog a real holiday while you enjoy the attractions. Located in Bussy-Saint-Georges (just 2 RER A stops or a 10-minute drive from the parks), La Patte Dorée welcomes your dog into a real family house with a fenced garden, 100% cage-free and kennel-free, with walks included and photo updates sent throughout the day.",
    es: "¿Visita Disneyland Paris por el día o se aloja en un hotel en Val d'Europe? Ofrezca a su perro unas verdaderas vacaciones mientras disfruta de las atracciones. Situada en Bussy-Saint-Georges (a 2 paradas de RER A o 10 minutos en coche de los parques), La Patte Dorée acoge a su compañero en una verdadera casa familiar con jardín, sin jaulas ni perreras, con paseos incluidos y fotos enviadas durante el día.",
  },
  "Que vous veniez pour une journée aux parcs ou pour un séjour de plusieurs nuits dans un hôtel Disney, Val d'Europe ou Villages Nature, notre tarification s'adapte à vos horaires réels (le passage de minuit ne déclenche jamais une seconde journée facturée).": {
    en: "Whether you are visiting the parks for a single day or staying several nights at a Disney, Val d'Europe or Villages Nature hotel, our pricing adapts to your actual schedule (crossing midnight never triggers an extra billed day).",
    es: "Tanto si viene a pasar el día en los parques como si se aloja varias noches en un hotel Disney, Val d'Europe o Villages Nature, nuestra tarifa se adapta a sus horarios reales (el paso de la medianoche nunca genera un segundo día facturado).",
  },
  "Vérifier les disponibilités & réserver": {
    en: "Check availability & book",
    es: "Comprobar disponibilidad y reservar",
  },
  "Maison & jardin clos — 100 % sans box ni cage": {
    en: "House & fenced garden — 100% cage-free and kennel-free",
    es: "Casa y jardín vallado — 100 % sin jaulas ni perreras",
  },
  "À 10 min de Disneyland Paris (A4 sortie 12 / RER A Bussy-St-Georges)": {
    en: "10 min from Disneyland Paris (A4 exit 12 / RER A Bussy-St-Georges)",
    es: "A 10 min de Disneyland Paris (A4 salida 12 / RER A Bussy-St-Georges)",
  },
  "Promenades incluses & photos envoyées pendant votre journée au parc": {
    en: "Walks included & photo updates sent during your day at the park",
    es: "Paseos incluidos y fotos enviadas durante su día en el parque",
  },
  "Pet-sitter diplômée ACACED · Réservation en ligne sécurisée": {
    en: "ACACED-certified pet sitter · Secure online booking",
    es: "Cuidadora certificada ACACED · Reserva online segura",
  },
  "Garderie de jour — 35 € (jusqu'à 10 h)": {
    en: "Day care — €35 (up to 10 hours)",
    es: "Guardería de día — 35 € (hasta 10 h)",
  },
  "Idéal pour une journée au parc Disneyland ou Walt Disney Studios. Déposez votre chien le matin avant l'ouverture, profitez des attractions l'esprit léger et récupérez-le après sa journée de jeux, de balades et de repos au calme.": {
    en: "Ideal for a day at Disneyland Park or Walt Disney Studios. Drop your dog off in the morning before park opening, enjoy the rides with peace of mind, and pick them up after a day of play, walks, and quiet rest.",
    es: "Ideal para pasar el día en Disneyland Park o Walt Disney Studios. Deje a su perro por la mañana antes de la apertura, disfrute de las atracciones con tranquilidad y recójalo después de su día de juegos, paseos y descanso.",
  },
  "Hébergement familial 24 h — 45 € / 24 h": {
    en: "24-hour family boarding — €45 / 24h",
    es: "Alojamiento familiar 24 h — 45 € / 24 h",
  },
  "La formule préférée des visiteurs qui restent pour le spectacle nocturne ou dorment à l'hôtel. Le tarif est calculé par période glissante de 24 h à partir de l'heure de dépôt (ex. : arrivée à 9 h le samedi → départ jusqu'à 9 h le dimanche = 45 €).": {
    en: "The favourite option for visitors staying for the evening fireworks show or sleeping at a hotel. Pricing is calculated per rolling 24-hour period from drop-off time (e.g. Saturday 9 am arrival → Sunday up to 9 am pick-up = €45).",
    es: "La opción preferida de los visitantes que se quedan para el espectáculo nocturno o duermen en el hotel. La tarifa se calcula por periodo continuo de 24 h desde la hora de entrega (ej.: llegada el sábado a las 9 h → salida hasta el domingo a las 9 h = 45 €).",
  },
  "Séjour multi-jours & week-end Disney": {
    en: "Multi-day stay & Disney weekend",
    es: "Estancia de varios días y fin de semana en Disney",
  },
  "Vous logez dans un hôtel de Marne-la-Vallée qui n'accepte pas les animaux ? Votre chien séjourne avec nous comme à la maison (canapé, jardin, sorties régulières et suivi quotidien).": {
    en: "Staying at a hotel in Marne-la-Vallée that doesn't allow pets? Your dog stays with us just like at home (sofa, garden, regular walks, and daily photo updates).",
    es: "¿Se aloja en un hotel de Marne-la-Vallée que no admite mascotas? Su perro se queda con nosotros como en casa (sofá, jardín, salidas regulares y seguimiento diario).",
  },
  "Visites & promenades autour de Val d'Europe": {
    en: "Home visits & dog walks around Val d'Europe",
    es: "Visitas y paseos alrededor de Val d'Europe",
  },
  "Vous résidez ou louez un hébergement acceptant les animaux à Chessy, Serris, Montévrain ou Bussy-Saint-Georges ? Nous passons sortir, nourrir et câliner votre compagnon à domicile (dès 15 € / 30 min).": {
    en: "Staying in a pet-friendly rental in Chessy, Serris, Montévrain or Bussy-Saint-Georges? We stop by to walk, feed, and cuddle your pet at your accommodation (from €15 / 30 min).",
    es: "¿Reside o alquila un alojamiento que admite mascotas en Chessy, Serris, Montévrain o Bussy-Saint-Georges? Pasamos a pasear, alimentar y mimar a su mascota a domicilio (desde 15 € / 30 min).",
  },
  "Pourquoi choisir une garde familiale plutôt que le chenil de Disneyland Paris ?": {
    en: "Why choose family boarding over the official Disneyland Paris kennel?",
    es: "¿Por qué elegir un alojamiento familiar en lugar de la perrera de Disneyland Paris?",
  },
  "Le chenil officiel du parc (Animal Care Center) dépanne, mais impose des contraintes lourdes : votre chien y est placé en box individuel et le personnel n'est pas autorisé à le promener (vous devez sortir du parc en cours de journée pour venir le balader vous-même). Avec La Patte Dorée, vous n'avez aucun aller-retour à faire en pleine journée : nous nous occupons de tout.": {
    en: "The park's official kennel (Animal Care Center) is a basic fallback, but comes with strict limitations: dogs are kept in individual kennels and staff are not allowed to walk them (you must leave the park during the day to walk your dog yourself). With La Patte Dorée, you never have to leave the park mid-day: we take care of everything.",
    es: "La perrera oficial del parque (Animal Care Center) saca de un apuro, pero impone fuertes limitaciones: su perro permanece en un box individual y el personal no está autorizado a pasearlo (usted debe salir del parque durante el día para pasearlo). Con La Patte Dorée, no tendrá que hacer idas y vueltas a mitad del día: nos ocupamos de todo.",
  },
  "Zéro cage, zéro box : vie de famille en maison avec accès au jardin et au canapé": {
    en: "Zero cages, zero kennels: family life in a real house with access to the garden and sofa",
    es: "Cero jaulas, cero perreras: vida familiar en casa con acceso al jardín y al sofá",
  },
  "Promenades assurées par nos soins : profitez des deux parcs sans devoir ressortir à midi": {
    en: "Walks handled by us: enjoy both Disney parks without having to leave at midday",
    es: "Paseos realizados por nosotros: disfrute de los dos parques sin tener que salir al mediodía",
  },
  "Idéal si vous voulez rester jusqu'au spectacle pyrotechnique du soir (formule 24 h à 45 €)": {
    en: "Ideal if you want to stay until the evening fireworks show (24-hour boarding package at €45)",
    es: "Ideal si desea quedarse hasta el espectáculo pirotécnico nocturno (fórmula 24 h a 45 €)",
  },
  "Nouvelles et photos envoyées pour rassurer toute la famille dans les files d'attente": {
    en: "Photos and updates sent to reassure the whole family while waiting in line for rides",
    es: "Noticias y fotos enviadas para tranquilizar a toda la familia en las colas de las atracciones",
  },
  "Accès ultra-rapide depuis les parcs, la gare TGV/RER de Chessy et l'autoroute A4": {
    en: "Ultra-fast access from the parks, Marne-la-Vallée Chessy TGV/RER station and the A4 motorway",
    es: "Acceso ultrarrápido desde los parques, la estación TGV/RER de Chessy y la autopista A4",
  },
  "Notre maison d'accueil est située à Bussy-Saint-Georges (77600), sur votre trajet direct vers Disneyland Paris. Le dépôt et la reprise se font sur rendez-vous rapide pour ne pas retarder votre entrée aux parcs.": {
    en: "Our family home is located in Bussy-Saint-Georges (77600), right on your route to Disneyland Paris. Drop-off and pick-up are arranged by quick appointment so you don't delay your park entry.",
    es: "Nuestra casa de acogida está situada en Bussy-Saint-Georges (77600), en su trayecto directo hacia Disneyland Paris. La entrega y recogida se realizan con cita rápida para no retrasar su entrada a los parques.",
  },
  "En voiture : à 10 minutes des parkings Disney et des hôtels via l'A4 (sortie 12 Bussy-Saint-Georges)": {
    en: "By car: 10 minutes from Disney parking lots and hotels via the A4 motorway (Exit 12 Bussy-Saint-Georges)",
    es: "En coche: a 10 minutos de los aparcamientos Disney y de los hoteles por la A4 (salida 12 Bussy-Saint-Georges)",
  },
  "En RER A : station Bussy-Saint-Georges, à seulement 2 arrêts (8 minutes) de Marne-la-Vallée Chessy": {
    en: "By RER A train: Bussy-Saint-Georges station, just 2 stops (8 minutes) from Marne-la-Vallée Chessy",
    es: "En RER A: estación Bussy-Saint-Georges, a solo 2 paradas (8 minutos) de Marne-la-Vallée Chessy",
  },
  "Proche de tous les hôtels de Val d'Europe, Serris, Chessy, Coupvray, Magny-le-Hongre et Bailly-Romainvilliers": {
    en: "Close to all hotels in Val d'Europe, Serris, Chessy, Coupvray, Magny-le-Hongre and Bailly-Romainvilliers",
    es: "Cerca de todos los hoteles de Val d'Europe, Serris, Chessy, Coupvray, Magny-le-Hongre y Bailly-Romainvilliers",
  },
  "Profil santé, habitudes et ententes vérifiés avant confirmation pour garantir la sécurité de chaque chien": {
    en: "Health profile, habits and compatibility checked before confirmation to guarantee every dog's safety",
    es: "Perfil de salud, hábitos y sociabilidad verificados antes de la confirmación para garantizar la seguridad de cada perro",
  },
  "Quelle est la différence entre La Patte Dorée et le chenil officiel de Disneyland Paris (Animal Care Center) ?": {
    en: "What is the difference between La Patte Dorée and the official Disneyland Paris kennel (Animal Care Center)?",
    es: "¿Cuál es la diferencia entre La Patte Dorée y la perrera oficial de Disneyland Paris (Animal Care Center)?",
  },
  "Au chenil officiel de Disneyland Paris, les chiens sont gardés en box individuel et le personnel ne les promène pas : les propriétaires doivent revenir eux-mêmes pendant la journée pour les sortir. Chez La Patte Dorée, votre chien est accueilli dans une vraie maison familiale avec jardin à Bussy-Saint-Georges (à 10 min du parc), sans cage ni box. Nous assurons ses promenades, ses repas et ses moments de jeu, et nous vous envoyons des photos pendant que vous profitez des parcs sans interruption.": {
    en: "At the official Disneyland Paris kennel, dogs are kept in individual runs and staff do not walk them: owners must come back during the day to take them out themselves. At La Patte Dorée, your dog stays in a real family home with a garden in Bussy-Saint-Georges (10 minutes from the park), with no cages or kennels. We handle their walks, meals, and playtime, and send you photo updates while you enjoy the parks uninterrupted.",
    es: "En la perrera oficial de Disneyland Paris, los perros permanecen en boxes individuales y el personal no los pasea: los propietarios deben volver durante el día para sacarlos. En La Patte Dorée, su perro es acogido en una verdadera casa familiar con jardín en Bussy-Saint-Georges (a 10 min del parque), sin jaulas ni boxes. Nos encargamos de sus paseos, comidas y juegos, y le enviamos fotos mientras disfruta de los parques sin interrupciones.",
  },
  "Comment choisir entre la garderie de jour (35 €) et l'hébergement 24 h (45 €) pour une journée à Disney ?": {
    en: "How do I choose between day care (€35) and 24-hour boarding (€45) for a day at Disney?",
    es: "¿Cómo elegir entre la guardería de día (35 €) y el alojamiento 24 h (45 €) para un día en Disney?",
  },
  "Si vous restez aux parcs jusqu'à 10 heures maximum dans la même journée, la garderie de jour à 35 € suffit. Si vous souhaitez arriver dès l'ouverture (ex. 8h30 / 9h00) et rester jusqu'à la fermeture après le spectacle nocturne (souvent 22h00 ou 23h00, soit plus de 10 heures de présence), ou laisser votre chien dormir au calme pour le récupérer le lendemain matin, la formule hébergement 24 h à 45 € s'applique automatiquement.": {
    en: "If you stay at the parks for up to 10 hours on the same day, the €35 day care option is all you need. If you want to arrive right at park opening (e.g. 8:30 / 9:00 am) and stay until closing after the evening fireworks show (often 10:00 or 11:00 pm, i.e. more than 10 hours), or let your dog sleep peacefully overnight and pick them up the next morning, the €45 24-hour boarding rate applies automatically.",
    es: "Si permanece en los parques hasta un máximo de 10 horas en el mismo día, la guardería de día a 35 € es suficiente. Si desea llegar desde la apertura (ej. 8:30 / 9:00) y quedarse hasta el cierre tras el espectáculo nocturno (a menudo 22:00 o 23:00, es decir, más de 10 horas), o dejar que su perro duerma tranquilo para recogerlo a la mañana siguiente, se aplica automáticamente la fórmula de alojamiento 24 h a 45 €.",
  },
  "À quelle distance de Disneyland Paris et des hôtels Disney êtes-vous situés ?": {
    en: "How far are you located from Disneyland Paris and the Disney hotels?",
    es: "¿A qué distancia de Disneyland Paris y de los hoteles Disney se encuentran?",
  },
  "Nous sommes situés à Bussy-Saint-Georges (77600), à environ 10 minutes en voiture de Disneyland Paris, de Val d'Europe et des hôtels partenaires (via l'autoroute A4, sortie 12), et à seulement 2 stations de RER A (8 minutes) de la gare de Marne-la-Vallée Chessy.": {
    en: "We are located in Bussy-Saint-Georges (77600), about a 10-minute drive from Disneyland Paris, Val d'Europe and partner hotels (via the A4 motorway, Exit 12), and just 2 RER A train stops (8 minutes) from Marne-la-Vallée Chessy station.",
    es: "Estamos situados en Bussy-Saint-Georges (77600), a unos 10 minutos en coche de Disneyland Paris, Val d'Europe y los hoteles asociados (por la autopista A4, salida 12), y a solo 2 paradas de RER A (8 minutos) de la estación de Marne-la-Vallée Chessy.",
  },
  "Mon chien sera-t-il enfermé en box ou en cage ?": {
    en: "Will my dog be locked in a kennel run or cage?",
    es: "¿Estará mi perro encerrado en un box o jaula?",
  },
  "Jamais. L'accueil est 100 % familial : votre chien vit avec nous dans la maison, profite du salon, du jardin clos et de vraies balades. Pour garantir une ambiance sereine, nous validons au préalable le profil de chaque animal (sociabilité, habitudes, santé). Deux chats habitués aux chiens vivent également à la maison et disposent d'un espace séparé si nécessaire.": {
    en: "Never. Our care is 100% family-style: your dog lives with us inside our house, enjoys the living room, the fenced garden, and real walks. To guarantee a peaceful atmosphere, we review each pet's profile beforehand (socialisation, habits, health). Two dog-friendly cats also live in the house and have their own separate space if needed.",
    es: "Jamás. La acogida es 100 % familiar: su perro vive con nosotros en la casa, disfruta del salón, del jardín vallado y de verdaderos paseos. Para garantizar un ambiente tranquilo, validamos previamente el perfil de cada animal (sociabilidad, hábitos, salud). Dos gatos acostumbrados a los perros viven también en la casa y disponen de un espacio separado si es necesario.",
  },
  "Puis-je déposer mon chien tôt le matin avant l'ouverture des parcs ?": {
    en: "Can I drop my dog off early in the morning before the parks open?",
    es: "¿Puedo dejar a mi perro temprano por la mañana antes de la apertura de los parques?",
  },
  "Oui, les horaires de dépôt et de reprise sont définis lors de votre réservation en ligne afin de s'adapter aux horaires d'ouverture des parcs Disney et à votre heure d'arrivée.": {
    en: "Yes, drop-off and pick-up times are set during your online booking to match Disney park opening hours and your arrival time.",
    es: "Sí, los horarios de entrega y recogida se definen durante su reserva en línea para adaptarse a los horarios de apertura de los parques Disney y a su hora de llegada.",
  },
  "Que dois-je apporter le jour de la garde ?": {
    en: "What should I bring on the day of the stay?",
    es: "¿Qué debo llevar el día de la estancia?",
  },
  "Apportez la nourriture habituelle de votre chien (pour éviter tout changement digestif), son collier ou harnais, sa laisse, son carnet de santé à jour et, si vous le souhaitez, son panier ou jouet préféré pour qu'il garde ses repères.": {
    en: "Bring your dog's usual food (to avoid any digestive upset), their collar or harness, leash, up-to-date health/vaccination record, and if you wish, their favourite bed or toy so they feel right at home.",
    es: "Traiga la comida habitual de su perro (para evitar cambios digestivos), su collar o arnés, su correa, su cartilla sanitaria al día y, si lo desea, su cama o juguete favorito para que conserve sus referencias.",
  },
  "Non. La Patte Dorée est un service indépendant de garde d'animaux déclaré et certifié ACACED en Seine-et-Marne (77), sans aucune affiliation commerciale avec Disneyland Paris / Euro Disney.": {
    en: "No. La Patte Dorée is an independent, registered and ACACED-certified pet sitting service in Seine-et-Marne (77), with no commercial affiliation with Disneyland Paris / Euro Disney.",
    es: "No. La Patte Dorée es un servicio independiente de cuidado de mascotas declarado y certificado por ACACED en Seine-et-Marne (77), sin ninguna afiliación comercial con Disneyland Paris / Euro Disney.",
  },
  "Animal Care Center Disneyland Paris": {
    en: "Animal Care Center Disneyland Paris",
    es: "Animal Care Center Disneyland Paris",
  },
  "garde chien Bussy-Saint-Georges": {
    en: "dog boarding Bussy-Saint-Georges",
    es: "cuidado de perros Bussy-Saint-Georges",
  },
  "garde chien sans box Disneyland Paris": {
    en: "cage-free dog boarding Disneyland Paris",
    es: "alojamiento canino sin jaulas Disneyland Paris",
  },
  "garderie chien journée Disneyland Paris": {
    en: "dog day care Disneyland Paris",
    es: "guardería de día para perros Disneyland Paris",
  },
  "laisser son chien à Disneyland Paris": {
    en: "where to leave your dog at Disneyland Paris",
    es: "dónde dejar a su perro en Disneyland Paris",
  },
  "Marne-la-Vallée Chessy": {
    en: "Marne-la-Vallée Chessy",
    es: "Marne-la-Vallée Chessy",
  },
  "Soins simples selon consignes": {
    en: "Basic care according to your instructions",
    es: "Cuidados básicos según sus indicaciones",
  },
  "Respect des horaires de repas et des consignes": {
    en: "Strict adherence to meal times and instructions",
    es: "Respeto de los horarios de comida y de las indicaciones",
  },
  "Maison et jardin": { en: "House and garden", es: "Casa y jardín" },
  "Promenades incluses selon prestation": {
    en: "Walks included depending on the service",
    es: "Paseos incluidos según el servicio",
  },
  "Les promenades sont-elles incluses ?": {
    en: "Are walks included?",
    es: "¿Están incluidos los paseos?",
  },
  "Comment savoir si ma commune est couverte ?": {
    en: "How do I know if my town is covered?",
    es: "¿Cómo saber si mi municipio está cubierto?",
  },
  "Sans box ni chenil": {
    en: "No cages or kennels",
    es: "Sin jaulas ni perreras",
  },
  "Validation avant confirmation": {
    en: "Review before confirmation",
    es: "Validación antes de la confirmación",
  },
  "Vacances longues": { en: "Long holidays", es: "Vacaciones largas" },
  "Jardin et sorties": { en: "Garden and outings", es: "Jardín y salidas" },
  "Une alternative au chenil classique": {
    en: "An alternative to traditional kennels",
    es: "Una alternativa a la perrera tradicional",
  },
  "Recevrai-je des photos ?": {
    en: "Will I receive photos?",
    es: "¿Recibiré fotos?",
  },
  "Surveillance du comportement": {
    en: "Behaviour monitoring",
    es: "Supervisión del comportamiento",
  },
  "Soins simples": { en: "Basic care", es: "Cuidados básicos" },
  "Organisation selon vos dates et consignes": {
    en: "Tailored to your dates and instructions",
    es: "Organización según sus fechas e indicaciones",
  },
  "Tarifs lisibles": { en: "Clear pricing", es: "Tarifas claras" },
  "Visites": { en: "Home visits", es: "Visitas" },
  "Validation de la demande avant confirmation": {
    en: "Request reviewed before confirmation",
    es: "Validación de la solicitud antes de la confirmación",
  },
  "Garde chat en Seine-et-Marne 77": {
    en: "Cat sitting in Seine-et-Marne (77)",
    es: "Cuidado de gatos en Seine-et-Marne (77)",
  },
  "Garde chat 77 | Visite chat à domicile Seine-et-Marne": {
    en: "Cat Sitting 77 | Cat Home Visits & Boarding in Seine-et-Marne",
    es: "Cuidado de gatos 77 | Visitas a domicilio en Seine-et-Marne",
  },
  "Garde chat 77": { en: "Cat sitting 77", es: "Cuidado de gatos 77" },
  "Réserver une garde chat": {
    en: "Book cat sitting",
    es: "Reservar cuidado de gatos",
  },
  "Faites-vous la garde chat dans tout le 77 ?": {
    en: "Do you offer cat sitting across all of Seine-et-Marne (77)?",
    es: "¿Ofrecen cuidado de gatos en todo Seine-et-Marne (77)?",
  },
  "Garde chien en Seine-et-Marne 77": {
    en: "Dog boarding & sitting in Seine-et-Marne (77)",
    es: "Cuidado y alojamiento de perros en Seine-et-Marne (77)",
  },
  "Garde chien 77 | Pension, garderie et promenade": {
    en: "Dog Boarding 77 | Family Boarding, Day Care & Walks",
    es: "Cuidado de perros 77 | Alojamiento familiar, guardería y paseos",
  },
  "Garde chien 77 : hébergement familial, garderie de jour, promenades et visites à domicile en Seine-et-Marne, avec réservation en ligne.": {
    en: "Dog sitting in Seine-et-Marne (77): family boarding, day care, dog walks and home visits, with online booking.",
    es: "Cuidado de perros en Seine-et-Marne (77): alojamiento familiar, guardería de día, paseos y visitas a domicilio, con reserva online.",
  },
  "Garde chien 77": { en: "Dog sitting 77", es: "Cuidado de perros 77" },
  "Réserver une garde chien 77": {
    en: "Book dog care in 77",
    es: "Reservar cuidado de perros en el 77",
  },
  "Garde de nuit": { en: "Overnight care", es: "Cuidado nocturno" },
  "Visite chat domicile 77 | Garde chat Seine-et-Marne": {
    en: "Cat Home Visits 77 | Cat Sitting in Seine-et-Marne",
    es: "Visitas a domicilio para gatos 77 | Cuidado de gatos en Seine-et-Marne",
  },
  "Réserver une visite chat": {
    en: "Book a cat visit",
    es: "Reservar una visita para gatos",
  },
  "Non. La visite s'adapte au caractère du chat. Pour un chat craintif, le passage privilégie le calme, la routine et la surveillance discrète.": {
    en: "No. Each visit adapts to your cat's personality. For a shy cat, we prioritise calm, routine and gentle, discreet supervision.",
    es: "No. La visita se adapta al carácter del gato. Para un gato tímido, priorizamos la calma, la rutina y una supervisión discreta.",
  },

  // --- Chantier 2 UI/UX : Booking simulation, explicit stepper, sticky mobile bar & homepage CTA ---
  "1. Compagnon & Service": {
    en: "1. Pet & Service",
    es: "1. Mascota y Servicio",
  },
  "1. Service": {
    en: "1. Service",
    es: "1. Servicio",
  },
  "2. Dates & Disponibilités": {
    en: "2. Dates & Availability",
    es: "2. Fechas y Disponibilidad",
  },
  "2. Dates": {
    en: "2. Dates",
    es: "2. Fechas",
  },
  "3. Récap.": {
    en: "3. Summary",
    es: "3. Resumen",
  },
  "3. Récapitulatif": {
    en: "3. Summary",
    es: "3. Resumen",
  },
  "Ajouter": {
    en: "Add",
    es: "Añadir",
  },
  "Retirer": {
    en: "Remove",
    es: "Quitar",
  },
  "Ajouter mon compagnon →": {
    en: "Add my pet →",
    es: "Añadir mi mascota →",
  },
  "Ajouter un compagnon": {
    en: "Add a pet",
    es: "Añadir una mascota",
  },
  "Chat adulte": {
    en: "Adult cat",
    es: "Gato adulto",
  },
  "Chien adulte": {
    en: "Adult dog",
    es: "Perro adulto",
  },
  "Chiot": {
    en: "Puppy",
    es: "Cachorro",
  },
  "Chaton": {
    en: "Kitten",
    es: "Gatito",
  },
  "1 an et +": {
    en: "1 year & older",
    es: "1 año o más",
  },
  "Moins d'1 an (+5 €/période)": {
    en: "Under 1 year (+€5/period)",
    es: "Menos de 1 año (+5 €/período)",
  },
  "Choisir les dates →": {
    en: "Choose dates →",
    es: "Elegir fechas →",
  },
  "Compléter la fiche de mon compagnon →": {
    en: "Complete my pet's profile →",
    es: "Completar la ficha de mi mascota →",
  },
  "Continuer & réserver →": {
    en: "Continue & book →",
    es: "Continuar y reservar →",
  },
  "Créer mon compte & continuer →": {
    en: "Create my account & continue →",
    es: "Crear mi cuenta y continuar →",
  },
  "Créez votre compte gratuit en 1 minute pour enregistrer votre compagnon et confirmer ces dates": {
    en: "Create your free account in 1 minute to register your pet and confirm these dates",
    es: "Crea tu cuenta gratuita en 1 minuto para registrar a tu mascota y confirmar estas fechas",
  },
  "Créez votre compte gratuit en 1 minute pour enregistrer votre compagnon et confirmer ces dates.": {
    en: "Create your free account in 1 minute to register your pet and confirm these dates.",
    es: "Crea tu cuenta gratuita en 1 minuto para registrar a tu mascota y confirmar estas fechas.",
  },
  "Enregistrez ou complétez la fiche de votre compagnon pour confirmer ces dates": {
    en: "Register or complete your pet's profile to confirm these dates",
    es: "Registra o completa la ficha de tu mascota para confirmar estas fechas",
  },
  "Étapes de réservation": {
    en: "Booking steps",
    es: "Pasos de la reserva",
  },
  "J'ai déjà un compte": {
    en: "I already have an account",
    es: "Ya tengo una cuenta",
  },
  "Mes compagnons enregistrés": {
    en: "My saved pets",
    es: "Mis mascotas registradas",
  },
  "Simuler un tarif rapide": {
    en: "Quick price simulator",
    es: "Simular tarifa rápida",
  },
  "Payer & confirmer": {
    en: "Pay & confirm",
    es: "Pagar y confirmar",
  },
  "Prêt à planifier le séjour de votre compagnon ?": {
    en: "Ready to plan your pet's stay?",
    es: "¿Listo para planificar la estancia de tu mascota?",
  },
  "Profil compagnon en attente — mode simulation actif": {
    en: "Pet profile pending — simulation mode active",
    es: "Perfil de mascota pendiente — modo simulación activo",
  },
  "promenade de 30 min": {
    en: "30-min walk",
    es: "paseo de 30 min",
  },
  "visite de 30 min": {
    en: "30-min visit",
    es: "visita de 30 min",
  },
  "Retour à ma simulation": {
    en: "Back to my quote",
    es: "Volver a mi simulación",
  },
  "Sélectionnez au moins 1 compagnon pour simuler votre tarif et vérifier les disponibilités.": {
    en: "Select at least 1 pet to simulate your rate and check availability.",
    es: "Selecciona al menos 1 mascota para simular tu tarifa y comprobar la disponibilidad.",
  },
  "Sélectionnez vos compagnons (jusqu'à 4) pour calculer immédiatement votre tarif exact. Vos choix sont sauvegardés automatiquement.": {
    en: "Select your pets (up to 4) to immediately calculate your exact rate. Your choices are saved automatically.",
    es: "Selecciona tus mascotas (hasta 4) para calcular de inmediato tu tarifa exacta. Tus opciones se guardan automáticamente.",
  },
  "Sélectionnez votre compagnon enregistré pour confirmer ces dates": {
    en: "Select your saved pet to confirm these dates",
    es: "Selecciona tu mascota registrada para confirmar estas fechas",
  },
  "Simulation & disponibilités en accès libre": {
    en: "Open access quote & availability",
    es: "Simulación y disponibilidad de libre acceso",
  },
  "Simulation en direct": {
    en: "Live quote",
    es: "Simulación en directo",
  },
  "Simulez votre tarif et vérifiez nos disponibilités en direct": {
    en: "Simulate your rate and check live availability",
    es: "Simula tu tarifa y comprueba nuestra disponibilidad en directo",
  },
  "Utiliser mon compagnon enregistré →": {
    en: "Use my saved pet →",
    es: "Usar mi mascota registrada →",
  },
  "Vérification…": {
    en: "Checking…",
    es: "Comprobando…",
  },
  "Disponible": {
    en: "Available",
    es: "Disponible",
  },
  "Indisponible": {
    en: "Unavailable",
    es: "No disponible",
  },
  "Vérifier les disponibilités & tarifs": {
    en: "Check availability & rates",
    es: "Ver disponibilidad y tarifas",
  },
  "Vérifiez nos disponibilités en temps réel et simulez votre tarif exact selon vos horaires en moins d'une minute, avant même de créer votre compte.": {
    en: "Check our real-time availability and simulate your exact rate for your schedule in under a minute, before even creating an account.",
    es: "Consulta nuestra disponibilidad en tiempo real y simula tu tarifa exacta según tus horarios en menos de un minuto, incluso antes de crear tu cuenta.",
  },
  "Voir le récapitulatif →": {
    en: "View summary →",
    es: "Ver el resumen →",
  },
  "Vos dates et votre tarif estimé restent sauvegardés. Dès que la fiche de votre compagnon est complète et validée, vous pourrez finaliser la réservation.": {
    en: "Your dates and estimated rate remain saved. As soon as your pet's profile is complete and verified, you can finalise your booking.",
    es: "Tus fechas y tu tarifa estimada quedan guardadas. En cuanto la ficha de tu mascota esté completa y validada, podrás finalizar la reserva.",
  },
  "Vos dates sont disponibles": {
    en: "Your dates are available",
    es: "Tus fechas están disponibles",
  },
  "Votre sélection": {
    en: "Your selection",
    es: "Tu selección",
  },
  "Votre simulation (dates, horaires, service et tarif estimé) est sauvegardée automatiquement : vous la retrouverez immédiatement après votre connexion.": {
    en: "Your quote (dates, times, service and estimated rate) is saved automatically: you will find it right after signing in.",
    es: "Tu simulación (fechas, horarios, servicio y tarifa estimada) se guarda automáticamente: la recuperarás enseguida tras iniciar sesión.",
  },
  "Vous êtes actuellement en mode simulation rapide. Basculez sur votre compagnon validé pour accéder au paiement sécurisé.": {
    en: "You are currently in quick quote mode. Switch to your verified pet to proceed to secure payment.",
    es: "Actualmente estás en modo de simulación rápida. Cambia a tu mascota validada para acceder al pago seguro.",
  },
  "Vous pouvez simuler votre tarif et vérifier nos disponibilités dès maintenant. Pour confirmer le paiement à l'étape 3, votre compagnon devra avoir un profil complet et validé.": {
    en: "You can simulate your rate and check availability right now. To confirm payment at step 3, your pet will need a complete and verified profile.",
    es: "Puedes simular tu tarifa y comprobar la disponibilidad ahora mismo. Para confirmar el pago en el paso 3, tu mascota deberá tener un perfil completo y validado.",
  },
  "-10 % Bienvenue": {
    en: "10% Welcome offer",
    es: "-10 % Bienvenida",
  },
  "-10 % dès 14 périodes": {
    en: "10% off from 14 periods",
    es: "-10 % desde 14 períodos",
  },
  "🇬🇧 Dog Boarding Disneyland Paris": {
    en: "🇬🇧 Dog Boarding Disneyland Paris",
    es: "🇬🇧 Dog Boarding Disneyland Paris",
  },
  "🐈 Chat": {
    en: "🐈 Cat",
    es: "🐈 Gato",
  },
  "🐕 Chien": {
    en: "🐕 Dog",
    es: "🐕 Perro",
  },
  "1 € = 1 Patte": {
    en: "€1 = 1 Paw point",
    es: "1 € = 1 punto Patita",
  },
  "Accueil dès 6h30 à 10 minutes des parcs Disney : jeux au jardin, repos au calme et compagnie continue jusqu’à 10 h de garde en journée.": {
    en: "Drop-off from 6:30 a.m. just 10 minutes from the Disney parks: garden play, quiet rest, and continuous company for up to 10 hours of daytime care.",
    es: "Recepción desde las 6:30 a 10 minutos de los parques Disney: juegos en el jardín, descanso tranquilo y compañía continua hasta 10 h de guardería diurna.",
  },
  "Autour de chez vous · 30 min à 2 h": {
    en: "Around your home · 30 min to 2 hrs",
    es: "Alrededor de tu casa · 30 min a 2 h",
  },
  "avis vérifiés": {
    en: "verified reviews",
    es: "reseñas verificadas",
  },
  "Balade attentive au rythme de votre chien autour de votre domicile, avec compte-rendu et photo au retour.": {
    en: "Attentive walk at your dog's pace around your home, with a report and photo upon return.",
    es: "Paseo atento al ritmo de tu perro alrededor de tu domicilio, con informe y foto al regresar.",
  },
  "Chaque séjour récompense votre fidélité": {
    en: "Every stay rewards your loyalty",
    es: "Cada estancia recompensa tu fidelidad",
  },
  "Chez nous · Journée jusqu’à 10 h": {
    en: "At our home · Day care up to 10 hrs",
    es: "En nuestra casa · Día de hasta 10 h",
  },
  "Chez nous · Nuit incluse": {
    en: "At our home · Night included",
    es: "En nuestra casa · Noche incluida",
  },
  "Chez vous · 30 min à 2 h": {
    en: "At your home · 30 min to 2 hrs",
    es: "En tu casa · 30 min a 2 h",
  },
  "Chez vous · Présence prolongée": {
    en: "At your home · Extended presence",
    es: "En tu casa · Presencia prolongada",
  },
  "Chien 16 € · Chat 15 €": {
    en: "Dog €16 · Cat €15",
    es: "Perro 16 € · Gato 15 €",
  },
  "Choisir mes horaires →": {
    en: "Choose my schedule →",
    es: "Elegir mis horarios →",
  },
  "Crédité automatiquement dès votre 1re garde": {
    en: "Credited automatically from your 1st stay",
    es: "Acreditado automáticamente desde tu 1.ª estancia",
  },
  "Paliers fidélité": {
    en: "Loyalty tiers",
    es: "Niveles de fidelidad",
  },
  "Les remises ne se cumulent pas : la plus avantageuse est retenue.": {
    en: "Discounts cannot be combined: the most advantageous one is applied.",
    es: "Los descuentos no son acumulables: se aplica el más ventajoso.",
  },
  "Les remises ne sont pas cumulables. Le système compare votre avantage fidélité ou Premium et les remises automatiques, puis conserve l’avantage le plus favorable.": {
    en: "Discounts cannot be combined. The system compares your loyalty or Premium benefit and automatic discounts, then keeps the most advantageous option.",
    es: "Los descuentos no son acumulables. El sistema compara tu ventaja de fidelidad o Premium y los descuentos automáticos, y conserva la opción más favorable.",
  },
  "Communes desservies autour de Bussy-Saint-Georges & Val d’Europe": {
    en: "Towns served around Bussy-Saint-Georges & Val d'Europe",
    es: "Municipios atendidos alrededor de Bussy-Saint-Georges y Val d'Europe",
  },
  "Composer mes visites →": {
    en: "Plan my visits →",
    es: "Configurar mis visitas →",
  },
  "Compteur 24 h dès l’heure de dépôt": {
    en: "24-hour clock starts at drop-off time",
    es: "Contador de 24 h desde la hora de entrega",
  },
  "Consultez les informations pratiques, accès et tarifs selon le mode de garde recherché :": {
    en: "Check practical information, directions, and rates for the care option you need:",
    es: "Consulta la información práctica, accesos y tarifas según la modalidad de cuidado que buscas:",
  },
  "Découvrir le programme Pattes": {
    en: "Discover the Paw loyalty program",
    es: "Descubrir el programa Patitas",
  },
  "Dépose dès 6h30 · Retour jusqu’à 20h30": {
    en: "Drop-off from 6:30 a.m. · Pick-up until 8:30 p.m.",
    es: "Entrega desde las 6:30 · Recogida hasta las 20:30",
  },
  "Dès 15 € / 30 min": {
    en: "From €15 / 30 min",
    es: "Desde 15 € / 30 min",
  },
  "Dès 40 € / jour": {
    en: "From €40 / day",
    es: "Desde 40 € / día",
  },
  "Détail des tarifs & remises": {
    en: "Full rates & discounts",
    es: "Detalle de tarifas y descuentos",
  },
  "Ferrières-en-Brie": {
    en: "Ferrières-en-Brie",
    es: "Ferrières-en-Brie",
  },
  "Fidélité & Avantages Premium": {
    en: "Loyalty & Premium Benefits",
    es: "Fidelidad y Ventajas Premium",
  },
  "Gagnez gratuitement 1 Patte par euro dépensé dès votre première garde (jusqu’à 24 € de remise fidélité). Besoin de gardes régulières ? L’abonnement Premium offre -10 % jusqu’à 20 € par réservation, les Pattes doublées et la priorité vacances.": {
    en: "Earn 1 free Paw point for every euro spent from your very first stay (up to €24 in loyalty discounts). Need regular care? The Premium membership gives 10% off up to €20 per booking, double Paw points, and holiday priority.",
    es: "Gana gratis 1 punto Patita por cada euro gastado desde tu primera estancia (hasta 24 € de descuento por fidelidad). ¿Necesitas cuidados regulares? La suscripción Premium ofrece un -10 % hasta 20 € por reserva, puntos Patita dobles y prioridad en vacaciones.",
  },
  "Garde chat Seine-et-Marne (77)": {
    en: "Cat boarding Seine-et-Marne (77)",
    es: "Guardería de gatos Seine-et-Marne (77)",
  },
  "Garde chien Seine-et-Marne (77)": {
    en: "Dog boarding Seine-et-Marne (77)",
    es: "Guardería de perros Seine-et-Marne (77)",
  },
  "Hébergement familial (24 h)": {
    en: "Family boarding (24 hrs)",
    es: "Alojamiento familiar (24 h)",
  },
  "Hébergement familial chez nous ou visites et promenades à domicile dans tout le secteur de Marne-la-Vallée :": {
    en: "Family boarding at our home or home visits and walks across the Marne-la-Vallée area:",
    es: "Alojamiento familiar en nuestra casa o visitas y paseos a domicilio en todo el sector de Marne-la-Vallée:",
  },
  "Idéal journée Disneyland Paris": {
    en: "Ideal for a Disneyland Paris day trip",
    es: "Ideal para un día en Disneyland Paris",
  },
  "Jusqu’à 20 € de remise par réservation": {
    en: "Up to €20 off per booking",
    es: "Hasta 20 € de descuento por reserva",
  },
  "Jusqu’à 24 € de remise fidélité cumulable": {
    en: "Up to €24 in stackable loyalty rewards",
    es: "Hasta 24 € de descuento de fidelidad acumulable",
  },
  "Nos gardes par besoin en Seine-et-Marne (77)": {
    en: "Our pet care options in Seine-et-Marne (77)",
    es: "Nuestros cuidados según tu necesidad en Seine-et-Marne (77)",
  },
  "Nos prestations & tarifs": {
    en: "Our services & rates",
    es: "Nuestros servicios y tarifas",
  },
  "Nous veillons sur vos animaux directement chez vous pour préserver toutes leurs habitudes (paliers jusqu’à 6 h, 10 h ou +10 h).": {
    en: "We care for your pets right in your own home to preserve all their routines (tiers up to 6 hrs, 10 hrs, or 10+ hrs).",
    es: "Cuidamos de tus mascotas directamente en tu casa para conservar todas sus rutinas (tramos de hasta 6 h, 10 h o +10 h).",
  },
  "Pattes doublées & accès prioritaire aux périodes fortes": {
    en: "Double Paw points & priority access during peak periods",
    es: "Puntos Patita dobles y acceso prioritario en temporada alta",
  },
  "Pension familiale chien 77": {
    en: "Family dog boarding 77",
    es: "Pensión familiar para perros 77",
  },
  "Pet-sitting Seine-et-Marne": {
    en: "Pet sitting Seine-et-Marne",
    es: "Pet-sitting Seine-et-Marne",
  },
  "Planifier une balade →": {
    en: "Schedule a walk →",
    es: "Programar un paseo →",
  },
  "Premium -10 %": {
    en: "Premium 10% off",
    es: "Premium -10%",
  },
  "Promenades chien": {
    en: "Dog walking",
    es: "Paseos para perros",
  },
  "Repas, eau fraîche, litière, câlins et nouvelles en photo à chaque passage (2 chats inclus au tarif de base).": {
    en: "Meals, fresh water, litter box, cuddles, and photo updates at every visit (2 cats included in the base rate).",
    es: "Comida, agua fresca, arenero, mimos y fotos en cada visita (2 gatos incluidos en la tarifa base).",
  },
  "Réserver une journée →": {
    en: "Book day care →",
    es: "Reservar un día →",
  },
  "service": {
    en: "service",
    es: "servicio",
  },
  "Simuler mon prix": {
    en: "Simulate my price",
    es: "Simular mi precio",
  },
  "Simuler un séjour →": {
    en: "Simulate a stay →",
    es: "Simular una estancia →",
  },
  "Tarif calculé à la durée réelle : le compteur démarre à l’heure de dépôt (aucune double facturation au passage de minuit). Supplément chiot/chaton (< 1 an) : +5 €.": {
    en: "Rate calculated on actual duration: the clock starts at drop-off time (no double billing at midnight). Puppy/kitten supplement (< 1 year): +€5.",
    es: "Tarifa calculada según la duración real: el contador empieza a la hora de entrega (sin doble facturación a medianoche). Suplemento cachorro/gatito (< 1 año): +5 €.",
  },
  "Une garde familiale attentive, sans box ni chenil. Choisissez un service pour simuler votre tarif exact selon vos dates et horaires.": {
    en: "Attentive family pet care with no cages or kennels. Choose a service to simulate your exact rate for your dates and schedule.",
    es: "Un cuidado familiar atento, sin jaulas ni perreras. Elige un servicio para simular tu tarifa exacta según tus fechas y horarios.",
  },
  "Visite chat à domicile 77": {
    en: "Cat home visits 77",
    es: "Visita de gatos a domicilio 77",
  },
  "Voir les avantages Premium": {
    en: "See Premium benefits",
    es: "Ver ventajas Premium",
  },
  "Votre compagnon vit à la maison avec nous et profite du jardin clos, des sorties et d’une présence rassurante jour et nuit, avec photos chaque jour.": {
    en: "Your pet lives in our family house and enjoys our fenced garden, walks, and reassuring company day and night, with daily photos.",
    es: "Tu compañero vive en casa con nosotros y disfruta del jardín vallado, salidas y una presencia tranquilizadora día y noche, con fotos cada día.",
  },
  "77600 Bussy-Saint-Georges · Val d’Europe": {
    en: "77600 Bussy-Saint-Georges · Val d’Europe",
    es: "77600 Bussy-Saint-Georges · Val d’Europe",
  },
  "77600 Bussy-Saint-Georges (à 10 min de Disneyland Paris & Val d’Europe) · Accueil 7j/7 sur réservation": {
    en: "77600 Bussy-Saint-Georges (10 min from Disneyland Paris & Val d’Europe) · Open 7 days a week by booking",
    es: "77600 Bussy-Saint-Georges (a 10 min de Disneyland Paris y Val d’Europe) · Abierto 7 días/7 con reserva",
  },
  "Certifié ACACED Chien & Chat n°": {
    en: "ACACED Dogs & Cats Certified No.",
    es: "Certificado ACACED Perros y Gatos n.º",
  },
  "Certifié ACACED Chien & Chat n° 2025/ef33-4a9c": {
    en: "ACACED Dogs & Cats Certified No. 2025/ef33-4a9c",
    es: "Certificado ACACED Perros y Gatos n.º 2025/ef33-4a9c",
  },
  "Connexion client": {
    en: "Client login",
    es: "Acceso clientes",
  },
  "Île-de-France": {
    en: "Île-de-France",
    es: "Isla de Francia",
  },
  "Langue": {
    en: "Language",
    es: "Idioma",
  },
  "Légal & Aide": {
    en: "Legal & Help",
    es: "Legal y Ayuda",
  },
  "Programme Fidélité": {
    en: "Loyalty Program",
    es: "Programa de Fidelidad",
  },
  "Simuler & Réserver": {
    en: "Simulate & Book",
    es: "Simular y Reservar",
  },
  "Tarifs & Conditions": {
    en: "Rates & Terms",
    es: "Tarifas y Condiciones",
  },
  "Accueil familial chiens et chats à Bussy-Saint-Georges (77)": {
    en: "Family home boarding for dogs and cats in Bussy-Saint-Georges (77)",
    es: "Alojamiento familiar para perros y gatos en Bussy-Saint-Georges (77)",
  },
  "Bussy-Saint-Georges (77)": {
    en: "Bussy-Saint-Georges (77)",
    es: "Bussy-Saint-Georges (77)",
  },
  "Cavalier King Charles endormi paisiblement dans un fauteuil chez La Patte Dorée à 10 min de Disneyland Paris": {
    en: "Cavalier King Charles Spaniel sleeping peacefully in an armchair at La Patte Dorée, 10 min from Disneyland Paris",
    es: "Cavalier King Charles durmiendo plácidamente en un sillón en La Patte Dorée, a 10 min de Disneyland Paris",
  },
  "Cavalier King Charles endormi paisiblement dans un fauteuil chez La Patte Dorée en Seine-et-Marne (77)": {
    en: "Cavalier King Charles Spaniel sleeping peacefully in an armchair at La Patte Dorée in Seine-et-Marne (77)",
    es: "Cavalier King Charles durmiendo plácidamente en un sillón en La Patte Dorée en Seine-et-Marne (77)",
  },
  "Chat profitant du soleil dans l'herbe pendant sa garde en Seine-et-Marne": {
    en: "Cat enjoying the sun in the grass during its stay in Seine-et-Marne",
    es: "Gato disfrutando del sol en la hierba durante su estancia en Seine-et-Marne",
  },
  "Chat profitant du soleil dans l'herbe pendant une garde chat en Seine-et-Marne (77)": {
    en: "Cat enjoying the sun in the grass during cat boarding in Seine-et-Marne (77)",
    es: "Gato disfrutando del sol en la hierba durante una estancia felina en Seine-et-Marne (77)",
  },
  "Chat tigré détendu sur le canapé familial chez La Patte Dorée en Seine-et-Marne (77)": {
    en: "Tabby cat relaxed on the family sofa at La Patte Dorée in Seine-et-Marne (77)",
    es: "Gato atigrado relajado en el sofá familiar en La Patte Dorée en Seine-et-Marne (77)",
  },
  "Garde chat · 100 % sereine": {
    en: "Cat care · 100% peaceful",
    es: "Cuidado de gatos · 100 % sereno",
  },
  "Hébergement familial sans box ni chenil en Seine-et-Marne (77)": {
    en: "Cage-free and kennel-free family boarding in Seine-et-Marne (77)",
    es: "Alojamiento familiar sin jaulas ni perreras en Seine-et-Marne (77)",
  },
  "Le cadre réel chez La Patte Dorée en Seine-et-Marne": {
    en: "The real home environment at La Patte Dorée in Seine-et-Marne",
    es: "El entorno real en La Patte Dorée en Seine-et-Marne",
  },
  "Le cadre réel pendant votre journée à Disneyland Paris": {
    en: "The real home environment during your day at Disneyland Paris",
    es: "El entorno real durante tu día en Disneyland Paris",
  },
  "Maison familiale · Zéro box": {
    en: "Family home · Zero cages",
    es: "Casa familiar · Cero jaulas",
  },
  "Repos au calme en maison familiale à 10 min de Disneyland Paris": {
    en: "Peaceful rest in a family home 10 min from Disneyland Paris",
    es: "Descanso tranquilo en una casa familiar a 10 min de Disneyland Paris",
  },
  "Un aperçu réel de nos gardes et visites chats dans le 77": {
    en: "A real glimpse of our cat boarding and drop-in visits in the 77 area",
    es: "Un vistazo real a nuestras estancias y visitas para gatos en el 77",
  },
  "Un cadre de maison réel pour votre chien dans le 77": {
    en: "A real family home setting for your dog in the 77 area",
    es: "Un verdadero entorno de hogar para tu perro en el 77",
  },
  "Vraies photos de nos pensionnaires à Bussy-Saint-Georges : jardin clos, vraies promenades incluses et repos au salon sans cage.": {
    en: "Real photos of our guests in Bussy-Saint-Georges: enclosed garden, real walks included, and cage-free rest in the living room.",
    es: "Fotos reales de nuestros huéspedes en Bussy-Saint-Georges: jardín vallado, paseos reales incluidos y descanso en el salón sin jaulas.",
  },
  "Vraies photos de nos pensionnaires chiens et chats à Bussy-Saint-Georges : salon familial, jardin clos et repos au calme.": {
    en: "Real photos of our dog and cat guests in Bussy-Saint-Georges: family living room, enclosed garden, and peaceful rest.",
    es: "Fotos reales de nuestros huéspedes perros y gatos en Bussy-Saint-Georges: salón familiar, jardín vallado y descanso tranquilo.",
  },
  "Vraies photos prises lors de nos gardes : respect des habitudes, calme, câlins et nouvelles envoyées à chaque passage.": {
    en: "Real photos taken during our stays: routines respected, calm environment, cuddles, and updates sent at every visit.",
    es: "Fotos reales tomadas durante nuestras guardias: respeto de las rutinas, calma, mimos y noticias enviadas en cada visita.",
  },
  "Tarif public :": {
    en: "Public rate:",
    es: "Tarifa pública:",
  },
};


const completeCatalogue: Record<string, Translation> = {
  ...generatedCatalogue,
  ...catalogue,
};

const WORD_CHAR_RE = /[\p{L}\p{N}]/u;
const NON_PARTIAL_SOURCES = new Set([
  "de",
  "De",
  "du",
  "des",
  "au",
  "aux",
  "ou",
  "ou à",
  "et",
  "et la",
  "à",
  "en",
  "par",
  "pour",
  "sur",
  "dans",
  "avec",
  "sans",
  "sous",
  "vers",
  "chez",
  "mais",
  "donc",
  "or",
  "ni",
  "car",
  "enter",
  "exit",
  "ghost",
  "green",
  "amber",
  "icon",
  "name",
  "none",
  "round",
  "service",
  "sm",
  "true",
  "wait",
]);

function isWordChar(char: string | undefined): boolean {
  return Boolean(char && WORD_CHAR_RE.test(char));
}

const orderedEntries = Object.entries(completeCatalogue)
  .filter(([source]) => source.length >= 2 && !NON_PARTIAL_SOURCES.has(source))
  .sort(([a], [b]) => b.length - a.length);

export function translateFrenchText(value: string, locale: Locale): string {
  if (locale === "fr" || !value.trim()) return value;

  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const core = value.slice(leading.length, value.length - trailing.length || undefined);
  const exact = completeCatalogue[core];
  if (exact) return `${leading}${exact[locale]}${trailing}`;

  const matches: Array<{ start: number; end: number; source: string; replacement: string }> = [];
  for (const [source, targets] of orderedEntries) {
    const startsWithWord = isWordChar(source[0]);
    const endsWithWord = isWordChar(source[source.length - 1]);
    let start = core.indexOf(source);
    while (start !== -1) {
      const end = start + source.length;
      const prevChar = start > 0 ? core[start - 1] : undefined;
      const nextChar = end < core.length ? core[end] : undefined;
      const hasValidStartBoundary = !startsWithWord || !isWordChar(prevChar);
      const hasValidEndBoundary = !endsWithWord || !isWordChar(nextChar);
      const overlapsLongerMatch = matches.some((match) => start < match.end && end > match.start);
      if (hasValidStartBoundary && hasValidEndBoundary && !overlapsLongerMatch) {
        matches.push({ start, end, source, replacement: targets[locale] });
        start = core.indexOf(source, end);
      } else {
        start = core.indexOf(source, start + 1);
      }
    }
  }

  if (matches.length === 0) return value;

  matches.sort((a, b) => a.start - b.start);

  let unmatched = "";
  let checkCursor = 0;
  for (const match of matches) {
    unmatched += " " + core.slice(checkCursor, match.start);
    checkCursor = match.end;
  }
  unmatched += " " + core.slice(checkCursor);

  const allowedUnmatchedTokens =
    /^(min|mins|h|hr|hrs|j|kg|km|max|ttc|ht|rer|tgv|a4|acaced|siren|siret|bussy|saint|georges|st|disneyland|paris|disney|val|europe|marne|vallée|chessy|serris|coupvray|montévrain|magny|hongre|bailly|romainvilliers|seine|patte|dorée)$/i;
  const unmatchedWords = (unmatched.match(/\p{L}{2,}/gu) ?? []).filter(
    (word) => !allowedUnmatchedTokens.test(word)
  );

  if (unmatchedWords.length > 0) {
    return value;
  }

  let cursor = 0;
  let translated = "";
  for (const match of matches) {
    translated += core.slice(cursor, match.start);
    translated += match.replacement;
    cursor = match.end;
  }
  translated += core.slice(cursor);
  return `${leading}${translated}${trailing}`;
}
