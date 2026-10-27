import { LEGAL_DOCUMENT_VERSION_LABEL, LEGAL_INFORMATION } from "@/lib/legal";

const Field = ({ label, value }: { label: string; value?: string | null }) => {
  if (!value) return null;
  return (
    <p>
      <strong>{label} :</strong> {value}
    </p>
  );
};

export default function LegalNoticePage() {
  const mediatorUrl = process.env.CONSUMER_MEDIATOR_URL;
  const mediatorName = process.env.CONSUMER_MEDIATOR_NAME;
  const mediatorAddress = process.env.CONSUMER_MEDIATOR_ADDRESS;
  const professionalInsurance = process.env.PROFESSIONAL_INSURANCE?.trim();

  return (
    <div data-no-translate className="min-h-screen bg-[#FDFbf7] py-20">
      <div className="container mx-auto max-w-4xl px-6">
        <h1 className="mb-8 text-4xl font-extrabold text-gray-900">Mentions légales</h1>
        <div className="space-y-8 rounded-lg bg-white p-8 text-gray-700 shadow-sm md:p-12">
          <section className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">Éditeur du site</h2>
            <p className="mb-3">
              <strong>{LEGAL_INFORMATION.brandName}</strong> est l’appellation publique d’une activité exercée sous le nom commercial déclaré <strong>{LEGAL_INFORMATION.commercialName}</strong>.
            </p>
            <Field label="Nom commercial" value={LEGAL_INFORMATION.commercialName} />
            <Field label="Forme juridique" value={LEGAL_INFORMATION.legalForm} />
            <Field label="Exploitante (mention légale)" value={`${LEGAL_INFORMATION.ownerName}, EI`} />
            <Field label="SIREN" value={LEGAL_INFORMATION.siren} />
            <Field label="SIRET de l’établissement principal" value={LEGAL_INFORMATION.siret} />
            <Field label="Immatriculation au RNE" value={LEGAL_INFORMATION.rneRegistrationDate} />
            <Field label="Début d’activité déclaré" value={LEGAL_INFORMATION.activityStartDate} />
            <Field label="Adresse professionnelle" value={LEGAL_INFORMATION.address} />
            <Field label="Directrice de la publication" value={LEGAL_INFORMATION.publicationDirector} />
            <p>
              <strong>Adresse électronique :</strong>{" "}
              <a className="font-semibold text-orange-700 underline" href={`mailto:${LEGAL_INFORMATION.contactEmail}`}>{LEGAL_INFORMATION.contactEmail}</a>
            </p>
            <p>
              <strong>Téléphone :</strong>{" "}
              <a className="font-semibold text-orange-700 underline" href={`tel:${LEGAL_INFORMATION.phone.replace(/\D/g, "")}`}>{LEGAL_INFORMATION.phone}</a>
            </p>
            <p><strong>TVA :</strong> {LEGAL_INFORMATION.vatMention}.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">Activité</h2>
            <p>{LEGAL_INFORMATION.activity}.</p>
            <p>{LEGAL_INFORMATION.excludedActivities}.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">Qualification professionnelle</h2>
            <p>
              Attestation de connaissances communément appelée ACACED, obtenue après réussite de l’évaluation du {LEGAL_INFORMATION.acaced.evaluationDate}.
            </p>
            <Field label="Numéro de l’attestation" value={LEGAL_INFORMATION.acaced.number} />
            <Field label="Catégories" value={LEGAL_INFORMATION.acaced.categories.join(" et ")} />
            <Field label="Date de délivrance" value={LEGAL_INFORMATION.acaced.issueDate} />
            <Field label="Assurance professionnelle" value={professionalInsurance} />
          </section>

          <section className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">Médiation de la consommation</h2>
            {(mediatorName || mediatorAddress || mediatorUrl) ? (
              <>
                <Field label="Médiateur" value={mediatorName} />
                <Field label="Adresse" value={mediatorAddress} />
                {mediatorUrl && (
                  <p>
                    <a className="font-semibold text-orange-700 underline" href={mediatorUrl} target="_blank" rel="noreferrer">
                      Saisir le médiateur de la consommation
                    </a>
                  </p>
                )}
              </>
            ) : (
              <p className="rounded-lg bg-amber-50 p-4 text-amber-950">
                Les coordonnées du médiateur de la consommation seront publiées ici après la conclusion de la convention requise.
              </p>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">Hébergement</h2>
            <p>
              Le site est hébergé par <strong>{LEGAL_INFORMATION.host.name}</strong>, {LEGAL_INFORMATION.host.address}. Téléphone : {LEGAL_INFORMATION.host.phone}. Site :{" "}
              <a className="font-semibold text-orange-700 underline" href={LEGAL_INFORMATION.host.url} target="_blank" rel="noreferrer">vercel.com</a>.
            </p>
          </section>

          <p className="border-t border-gray-100 pt-6 text-sm text-gray-500">
            Dernière mise à jour : {LEGAL_DOCUMENT_VERSION_LABEL}.
          </p>
        </div>
      </div>
    </div>
  );
}
