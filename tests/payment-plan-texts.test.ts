import fs from "node:fs";
import path from "node:path";
import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DepositPlanBooking } from "@/components/admin/DepositPlanDetails";

// Textes du lot 7 (spec 07, §5.8) : publiés seulement quand isPaymentPlanEnabled()
// est vrai (aperçus Vercel, local et, depuis la PR d'activation, production).
// Plan fermé (coupe-circuit PAYMENT_PLAN_ENABLED_IN_PRODUCTION à false, simulé
// ici) : CGV, confidentialité, devis et version des CGV identiques à main.
const closedPlan = vi.hoisted(() => ({ value: false }));
vi.mock("@/lib/payment-plan", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/payment-plan")>();
  return { ...actual, isPaymentPlanEnabled: () => !closedPlan.value && actual.isPaymentPlanEnabled() };
});

// Rendu hors Next.js : un lien simple suffit pour lire le texte des pages.
vi.mock("next/link", async () => {
  const react = await import("react");
  return {
    default: ({ href, children, className }: { href: string; children?: ReactNode; className?: string }) =>
      react.createElement("a", { href, className }, children),
  };
});

// Le plan suit l'environnement à l'appel : aperçu = ouvert ; fermé = production
// avec le coupe-circuit simulé. Les modules ne sont jamais rechargés : aucune
// valeur n'est figée au chargement.
const setPlan = (enabled: boolean) => {
  vi.stubEnv("VERCEL_ENV", enabled ? "preview" : "production");
  closedPlan.value = !enabled;
};

async function renderPage(enabled: boolean, load: () => Promise<{ default: () => ReactElement }>) {
  setPlan(enabled);
  const page = await load();
  return renderToStaticMarkup(createElement(page.default));
}

const readSource = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

afterEach(() => {
  vi.unstubAllEnvs();
  closedPlan.value = false;
});

describe("version des CGV", () => {
  it("production (plan activé) : version des CGV du plan", async () => {
    const legal = await import("@/lib/legal");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(legal.getLegalDocumentVersion()).toBe(legal.PAYMENT_PLAN_LEGAL_DOCUMENT_VERSION);
    expect(legal.getLegalDocumentVersionLabel()).toBe(legal.PAYMENT_PLAN_LEGAL_DOCUMENT_VERSION_LABEL);
    expect(legal.getLegalDocumentVersion()).not.toBe(legal.STANDARD_LEGAL_DOCUMENT_VERSION);
  });

  it("plan fermé (coupe-circuit) : version du 13 septembre 2026 inchangée", async () => {
    const legal = await import("@/lib/legal");
    setPlan(false);
    expect(legal.getLegalDocumentVersion()).toBe("2026-09-13");
    expect(legal.getLegalDocumentVersionLabel()).toBe("13 septembre 2026");
  });

  it("aperçu (plan ouvert) : nouvelle version, engagement Premium toujours daté du 13 septembre 2026", async () => {
    const legal = await import("@/lib/legal");
    setPlan(true);
    expect(legal.getLegalDocumentVersion()).toBe(legal.PAYMENT_PLAN_LEGAL_DOCUMENT_VERSION);
    expect(legal.getLegalDocumentVersion()).not.toBe("2026-09-13");
    expect(legal.PREMIUM_COMMITMENT_VERSION_LABEL).toBe("13 septembre 2026");
  });

  it("la version suit l'environnement sans rechargement du module", async () => {
    const legal = await import("@/lib/legal");
    setPlan(true);
    const preview = legal.getLegalDocumentVersion();
    setPlan(false);
    expect(legal.getLegalDocumentVersion()).toBe("2026-09-13");
    expect(preview).not.toBe("2026-09-13");
  });
});

describe("/legal/cgv", () => {
  it("plan fermé (coupe-circuit) : aucune clause d'acompte", async () => {
    const html = await renderPage(false, () => import("@/app/legal/cgv/page"));
    expect(html).toContain("Version en vigueur au 13 septembre 2026");
    expect(html).not.toContain('id="acompte-solde"');
    expect(html).not.toContain('id="annulation-acompte"');
    expect(html).not.toContain("Paiement en deux fois");
    expect(html).not.toContain("L214-2");
    expect(html).not.toContain("lien de paiement sécurisé");
    expect(html).not.toContain("enregistrée par Stripe afin de prélever le solde");
    expect(html).toContain("Les abonnements souscrits avant la version du 13 septembre 2026");
  });

  it("aperçu (plan ouvert) : acompte, mandat, barème, intérêts, rétractation et carte enregistrée", async () => {
    const html = await renderPage(true, () => import("@/app/legal/cgv/page"));
    expect(html).toContain('id="acompte-solde"');
    expect(html).toContain('id="annulation-acompte"');
    expect(html).toContain("30 % du montant total, arrondi à l’euro supérieur");
    expect(html).toContain("constitue un acompte et non des arrhes");
    expect(html).toContain("Autorisation de prélèvement du solde :");
    expect(html).toContain("prélevé automatiquement 7 jours avant le début");
    expect(html).toContain("Au moins 7 jours avant le début :");
    expect(html).toContain("Entre 7 jours et 48 h avant le début :");
    expect(html).toContain("Moins de 48 h avant le début :");
    expect(html).toContain("L214-2");
    expect(html).toContain("sans préjudice du droit de rétractation");
    expect(html).toContain("lien de paiement sécurisé");
    expect(html).toContain("enregistrée par Stripe afin de prélever le solde");
    // L'engagement Premium reste daté de la version qui l'a introduit.
    expect(html).toContain("Les abonnements souscrits avant la version du 13 septembre 2026");
    const { PAYMENT_PLAN_LEGAL_DOCUMENT_VERSION_LABEL } = await import("@/lib/legal");
    expect(html).toContain(`Version en vigueur au ${PAYMENT_PLAN_LEGAL_DOCUMENT_VERSION_LABEL}`);
    expect(html).not.toContain("Version en vigueur au 13 septembre 2026");
  });
});

describe("/legal/confidentialite", () => {
  it("plan fermé (coupe-circuit) : liste des données et prestataires inchangée", async () => {
    const html = await renderPage(false, () => import("@/app/legal/confidentialite/page"));
    expect(html).not.toContain("Carte enregistrée et autorisation de prélèvement");
    expect(html).toContain("pour les paiements, remboursements, abonnements et documents de facturation associés ;");
    expect(html).not.toContain("conservation de la carte enregistrée");
  });

  it("aperçu (plan ouvert) : carte conservée chez Stripe, finalité et durée", async () => {
    const html = await renderPage(true, () => import("@/app/legal/confidentialite/page"));
    expect(html).toContain("Carte enregistrée et autorisation de prélèvement :");
    expect(html).toContain("enregistrée et conservée par Stripe");
    expect(html).toContain("quatre derniers chiffres");
    expect(html).toContain("ainsi que la conservation de la carte enregistrée pour le prélèvement du solde ;");
    expect(html).not.toContain("documents de facturation associés ;</li>");
  });
});

describe("devis visites chat", () => {
  it("plan fermé (coupe-circuit) : conditions de paiement identiques à main", async () => {
    const quote = await import("@/lib/cat-visit-quote");
    setPlan(false);
    expect(quote.getCatVisitPaymentTerms()).toBe(
      "Règlement par carte bancaire via le site. Autorisation bancaire à la demande, débit après confirmation de la disponibilité."
    );
  });

  it("aperçu (plan ouvert) : acompte de 30 % et solde à J-7", async () => {
    const quote = await import("@/lib/cat-visit-quote");
    setPlan(true);
    expect(quote.getCatVisitPaymentTerms()).toContain("acompte de 30 %");
    expect(quote.getCatVisitPaymentTerms()).toContain("7 jours avant le premier passage");
  });
});

describe("textes conditionnels des pages client (source)", () => {
  it("/tarifs : lignes d'acompte derrière isPaymentPlanEnabled(), ligne standard intacte", () => {
    const source = readSource("src/app/tarifs/page.tsx");
    const gate = source.indexOf("{isPaymentPlanEnabled() && (");
    expect(gate).toBeGreaterThan(-1);
    expect(source.indexOf("Paiement en deux fois :")).toBeGreaterThan(gate);
    expect(source.indexOf("Réservation avec acompte :")).toBeGreaterThan(gate);
    expect(source).toContain(
      "annulation gratuite au moins 48 h avant le début ; à moins de 48 h, 50 % du montant est retenu.</li>"
    );
  });

  it("/history : barème 48 h conservé pour le paiement en une fois, barème acompte sinon", () => {
    const source = readSource("src/app/history/page.tsx");
    const branch = source.indexOf('bookingToCancel.paymentPlan === "DEPOSIT_BALANCE" ? (');
    const depositText = source.indexOf("Réservation payée en deux fois :");
    const fullText = source.indexOf("Au moins 48 h avant la prestation, le paiement est restitué intégralement.");
    expect(branch).toBeGreaterThan(-1);
    expect(depositText).toBeGreaterThan(branch);
    expect(fullText).toBeGreaterThan(depositText);
    expect(source.split("Au moins 48 h avant la prestation").length).toBe(2);
  });

  it("/dashboard et /history : « Régler le solde » mène à la page de paiement, seulement si le solde est payable", () => {
    for (const file of ["src/app/dashboard/page.tsx", "src/app/history/page.tsx"]) {
      const source = readSource(file);
      expect(source).toContain('balance?.state === "PAYABLE"');
      expect(source).toMatch(/href=\{`\/dashboard\/bookings\/\$\{[\w.]+\.id\}\/pay`\}/);
    }
  });

  it("réservation : rappel 48 h inchangé hors plan acompte", () => {
    const source = readSource("src/app/booking/page.tsx");
    expect(source).toContain(
      'const FULL_CANCELLATION_SUMMARY = "L\'annulation est gratuite au moins 48 h avant le début de la garde. Passé ce délai, 50 % du montant est retenu, sous réserve des droits légaux.";'
    );
    expect(source).toContain("{depositTerms ? DEPOSIT_CANCELLATION_SUMMARY : FULL_CANCELLATION_SUMMARY}");
  });
});

describe("état du solde vu par le client", () => {
  const startDate = "2027-04-26T08:00:00.000Z";
  const beforeDeadline = new Date("2027-04-20T10:00:00.000Z");
  const afterDeadline = new Date("2027-04-24T11:00:00.000Z"); // 13:00 à Paris, après J-2 12:00

  it.each([
    ["FAILED", "CONFIRMED", beforeDeadline, "PAYABLE"],
    ["FAILED", "CONFIRMED", afterDeadline, "CLOSED"],
    ["FAILED", "CANCELLED", beforeDeadline, "CLOSED"],
    ["SCHEDULED", "CONFIRMED", beforeDeadline, "SCHEDULED"],
    ["PROCESSING", "CONFIRMED", beforeDeadline, "IN_PROGRESS"],
    ["SUCCEEDED", "CONFIRMED", afterDeadline, "PAID"],
    ["CANCELED", "CANCELLED", beforeDeadline, "CLOSED"],
  ] as const)("%s / %s → %s", async (installmentStatus, bookingStatus, now, expected) => {
    const { getBalancePaymentStateFor } = await import("@/lib/payment-plan");
    expect(getBalancePaymentStateFor({ installmentStatus, bookingStatus, startDate }, now)).toBe(expected);
  });
});

describe("e-mail « demande reçue » : calendrier de l'acompte (FR / EN / ES)", () => {
  const terms = { depositAmount: 90, balanceAmount: 210, balanceDueDate: "2027-04-19" };

  it.each(["fr", "en", "es"] as const)("%s : montants et date du solde", async (locale) => {
    const text = await import("@/lib/payment-plan-text");
    const row = text.getDepositRequestPaymentRow(terms, locale);
    const schedule = text.getDepositRequestSchedule(terms, locale);
    for (const value of [row, schedule]) {
      expect(value).toContain("19/04/2027");
      expect(value).toMatch(/90,00\s?€|€90\.00/);
      expect(value).toMatch(/210,00\s?€|€210\.00/);
      expect(value.toLowerCase()).not.toContain("arrhes");
    }
  });
});

describe("admin : détail du paiement en deux fois", () => {
  const booking: DepositPlanBooking = {
    startDate: "2027-04-26T08:00:00.000Z",
    totalPrice: 300,
    depositAmount: 90,
    balanceAmount: 210,
    balanceDueAt: "2027-04-18T22:00:00.000Z",
    payment: { status: "SUCCEEDED", amount: 90, capturedAmount: 90 },
  };

  async function render(props: Partial<DepositPlanBooking>) {
    const { DepositPlanDetails } = await import("@/components/admin/DepositPlanDetails");
    return renderToStaticMarkup(createElement(DepositPlanDetails, { booking: { ...booking, ...props } }));
  }

  it("affiche le consentement MIT, le solde et le calendrier", async () => {
    const html = await render({
      mandateAcceptedAt: "2026-11-27T10:00:00.000Z",
      mandateLegalVersion: "2026-11-27",
      installments: [{ status: "SCHEDULED", amount: 210, dueAt: "2027-04-18T22:00:00.000Z", attempts: 0 }],
    });
    expect(html).toContain("Autorisation de prélèvement du solde");
    expect(html).toContain("CGV 2026-11-27");
    expect(html).toContain("210,00");
    expect(html).toContain("Prélèvement prévu le 19/04/2027");
    expect(html).toContain("12/04/2027");
    expect(html).toContain("24/04/2027");
  });

  it("signale l'absence de consentement et l'échec du prélèvement", async () => {
    const html = await render({
      mandateAcceptedAt: null,
      installments: [{ status: "FAILED", amount: 210, dueAt: "2027-04-18T22:00:00.000Z", attempts: 2, lastErrorCode: "card_declined" }],
    });
    expect(html).toContain("Aucune autorisation enregistrée");
    expect(html).toContain("card_declined");
    expect(html).toContain("2 tentative(s)");
  });

  it("libellé du paiement : « autorisé » avant acceptation, « encaissé » ensuite", async () => {
    const { getDepositPaymentLabel } = await import("@/components/admin/DepositPlanDetails");
    expect(getDepositPaymentLabel("PROCESSING")).toBe("Acompte autorisé (non débité)");
    expect(getDepositPaymentLabel("SUCCEEDED")).toBe("Acompte encaissé");
    expect(getDepositPaymentLabel("FAILED")).toBeNull();
  });

  it("libellé du badge selon l'échéance BALANCE, tous les états", async () => {
    const { getDepositPaymentLabel } = await import("@/components/admin/DepositPlanDetails");
    expect(getDepositPaymentLabel("SUCCEEDED", "SUCCEEDED")).toBe("Acompte et solde encaissés");
    expect(getDepositPaymentLabel("SUCCEEDED", "SCHEDULED")).toBe("Acompte encaissé");
    expect(getDepositPaymentLabel("SUCCEEDED", null)).toBe("Acompte encaissé");
    expect(getDepositPaymentLabel("SUCCEEDED", "PROCESSING")).toBe("Acompte encaissé · solde en cours");
    expect(getDepositPaymentLabel("SUCCEEDED", "FAILED")).toBe("Acompte encaissé · solde impayé");
    expect(getDepositPaymentLabel("SUCCEEDED", "REFUNDED")).toBe("Acompte encaissé · solde remboursé");
    expect(getDepositPaymentLabel("SUCCEEDED", "CANCELED")).toBe("Acompte encaissé · solde annulé");
    expect(getDepositPaymentLabel("PROCESSING", "SCHEDULED")).toBe("Acompte autorisé (non débité)");
    expect(getDepositPaymentLabel("REFUNDED", "REFUNDED")).toBeNull();
  });

  it("état court du solde, tous les états", async () => {
    const { getBalanceShortLabel } = await import("@/components/admin/DepositPlanDetails");
    const dueAt = "2027-04-18T22:00:00.000Z";
    expect(getBalanceShortLabel(null)).toBe("à programmer à l'acceptation");
    expect(getBalanceShortLabel({ status: "SCHEDULED", dueAt })).toBe("programmé le 19/04/2027");
    expect(getBalanceShortLabel({ status: "PROCESSING", dueAt })).toBe("prélèvement en cours");
    expect(getBalanceShortLabel({ status: "SUCCEEDED", dueAt, paidAt: "2027-04-18T22:05:00.000Z" })).toBe("payé le 19/04/2027");
    expect(getBalanceShortLabel({ status: "SUCCEEDED", dueAt, paidAt: null })).toBe("payé");
    expect(getBalanceShortLabel({ status: "FAILED", dueAt })).toBe("en échec");
    expect(getBalanceShortLabel({ status: "CANCELED", dueAt })).toBe("annulé");
    expect(getBalanceShortLabel({ status: "REFUNDED", dueAt })).toBe("remboursé");
  });

  it("solde réglé : acompte encaissé ET solde payé, avec la date du paiement", async () => {
    const html = await render({
      mandateAcceptedAt: "2026-11-27T10:00:00.000Z",
      installments: [{ status: "SUCCEEDED", amount: 210, dueAt: "2027-04-18T22:00:00.000Z", attempts: 1, paidAt: "2027-04-18T22:05:00.000Z" }],
    });
    expect(html).toContain("encaissé");
    expect(html).toContain("payé le 19/04/2027");
    expect(html).toContain("Acompte et solde encaissés · solde payé le 19/04/2027");
  });

  it("conserve les états intermédiaires du solde", async () => {
    const refunded = await render({
      installments: [{ status: "REFUNDED", amount: 210, dueAt: "2027-04-18T22:00:00.000Z", attempts: 1, refundedAmount: 210 }],
    });
    expect(refunded).toContain("Remboursé (210,00");
    expect(refunded).not.toContain("Acompte et solde encaissés");
    const processing = await render({
      installments: [{ status: "PROCESSING", amount: 210, dueAt: "2027-04-18T22:00:00.000Z", attempts: 1 }],
    });
    expect(processing).toContain("Prélèvement en cours");
    const canceled = await render({
      installments: [{ status: "CANCELED", amount: 210, dueAt: "2027-04-18T22:00:00.000Z", attempts: 0 }],
    });
    expect(canceled).toContain("Annulé, non prélevé");
  });
});

describe("traductions EN / ES des nouveaux textes visibles", () => {
  it.each([
    "Solde de réservation à régler",
    "Le prélèvement automatique du solde de la garde de",
    "n'a pas abouti. Réglez-le en ligne pour conserver la réservation.",
    "Solde de",
    "€ prélevé automatiquement le",
    "Paiement en deux fois :",
    "Réservation avec acompte :",
    "Carte enregistrée et autorisation de prélèvement :",
    "Paiement en deux fois : acompte et solde",
    "Réservations payées en deux fois (acompte et solde)",
  ])("%s", async (source) => {
    const { translateFrenchText } = await import("@/lib/i18n");
    const en = translateFrenchText(source, "en");
    const es = translateFrenchText(source, "es");
    expect(en).not.toBe(source);
    expect(es).not.toBe(source);
    expect(en.toLowerCase()).not.toContain("arrhes");
  });
});
