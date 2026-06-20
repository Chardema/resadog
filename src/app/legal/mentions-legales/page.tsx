const Field = ({ label, value }: { label: string; value?: string }) => {
  if (!value) return null;
  return (
    <p>
      <strong>{label} :</strong> {value}
    </p>
  );
};

export default function LegalNoticePage() {
  const mediatorUrl = process.env.CONSUMER_MEDIATOR_URL;

  return (
    <div className="min-h-screen bg-[#FDFbf7] py-20">
      <div className="container mx-auto max-w-4xl px-6">
        <h1 className="mb-8 text-4xl font-extrabold text-gray-900">Mentions légales</h1>
        <div className="space-y-8 rounded-lg bg-white p-8 text-gray-700 shadow-sm md:p-12">
          <section className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">Éditeur du site</h2>
            <Field label="Raison sociale" value={process.env.BUSINESS_LEGAL_NAME} />
            <Field label="SIRET" value={process.env.BUSINESS_SIRET} />
            <Field label="Adresse" value={process.env.BUSINESS_ADDRESS} />
            <Field label="Contact" value={process.env.SUPPORT_EMAIL} />
          </section>

          <section className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">Qualification professionnelle</h2>
            <p>Les prestations sont encadrées par une professionnelle titulaire de l’ACACED.</p>
            <Field label="Numéro d’attestation" value={process.env.NEXT_PUBLIC_ACACED_NUMBER} />
            <Field label="Assurance professionnelle" value={process.env.PROFESSIONAL_INSURANCE} />
          </section>

          <section className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">Médiation de la consommation</h2>
            <Field label="Médiateur" value={process.env.CONSUMER_MEDIATOR_NAME} />
            {mediatorUrl && (
              <p>
                <a className="font-semibold text-orange-700 underline" href={mediatorUrl} target="_blank" rel="noreferrer">
                  Saisir le médiateur de la consommation
                </a>
              </p>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">Hébergement</h2>
            <p>Le site est hébergé par Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
