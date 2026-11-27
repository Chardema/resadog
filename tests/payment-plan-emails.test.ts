import { describe, expect, it, vi } from "vitest";

// Resend n'est jamais appelé : seul le contenu des e-mails est vérifié.
vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));

import { buildPaymentPlanEmail } from "@/lib/email";
import {
  PAYMENT_PLAN_LOCALES,
  getAuthorizationExpiredSection,
  getDepositConfirmationSection,
} from "@/lib/payment-plan-text";

const schedule = {
  depositAmount: 90,
  balanceAmount: 210,
  balanceDueDate: "2027-04-19",
  depositCapturedDate: "2026-11-27",
  cardLast4: "4242",
};

describe("e-mail de confirmation avec calendrier (FR / EN / ES)", () => {
  it.each(PAYMENT_PLAN_LOCALES)("%s : montants, date du solde, carte et barème", (locale) => {
    const section = getDepositConfirmationSection(schedule, locale);
    const text = [section.subtitle, ...section.paragraphs, ...section.rows.map((row) => `${row.label} ${row.value}`)].join("\n");
    expect(text).toContain("19/04/2027");
    expect(text).toContain("27/11/2026");
    expect(text).toContain("4242");
    expect(text).toMatch(/90,00\s?€|€90\.00/);
    expect(text).toMatch(/210,00\s?€|€210\.00/);
    expect(text).toMatch(/300,00\s?€|€300\.00/);
    expect(text).toMatch(/48/);
    expect(section.rows).toHaveLength(4);
  });

  it("dit « acompte », jamais « arrhes »", () => {
    const fr = getDepositConfirmationSection(schedule, "fr");
    const text = [fr.title, fr.subtitle, ...fr.paragraphs, ...fr.rows.map((row) => row.label)].join(" ");
    expect(text).toContain("acompte");
    expect(text.toLowerCase()).not.toContain("arrhes");
  });

  it("sans carte connue, parle de la carte enregistrée", () => {
    const section = getDepositConfirmationSection({ ...schedule, cardLast4: null }, "fr");
    expect(section.paragraphs[0]).toContain("la carte enregistrée");
  });

  it("assemble les trois langues dans le texte et le HTML, avec les données échappées", () => {
    const email = buildPaymentPlanEmail({
      subject: "Sujet",
      userName: "<Client>",
      url: "https://example.test/dashboard",
      sections: {
        fr: getDepositConfirmationSection(schedule, "fr"),
        en: getDepositConfirmationSection(schedule, "en"),
        es: getDepositConfirmationSection(schedule, "es"),
      },
    });
    expect(email.text).toContain("Réservation validée");
    expect(email.text).toContain("Booking confirmed");
    expect(email.text).toContain("Reserva confirmada");
    expect(email.html).toContain('lang="es"');
    expect(email.html).toContain("&lt;Client&gt;");
    expect(email.html).not.toContain("<Client>");
  });
});

describe("e-mail « demande expirée » (FR / EN / ES)", () => {
  it.each(PAYMENT_PLAN_LOCALES)("%s : nomme l'animal et invite à refaire une demande", (locale) => {
    const section = getAuthorizationExpiredSection("Rex", locale);
    expect(section.subtitle).toContain("Rex");
    expect(section.paragraphs.length).toBeGreaterThan(0);
    expect(section.buttonLabel.length).toBeGreaterThan(0);
  });
});
