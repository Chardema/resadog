import { describe, expect, it, vi } from "vitest";

// Resend n'est jamais appelé : seul le contenu de l'e-mail est construit.
const { ResendMock } = vi.hoisted(() => ({
  ResendMock: vi.fn(function ResendMock() {
    throw new Error("Resend ne doit pas être instancié.");
  }),
}));
vi.mock("resend", () => ({ Resend: ResendMock }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));

import { getBookingEmailDetails } from "@/lib/booking-email-details";
import { buildBookingInvoiceEmail } from "@/lib/email";

const invoice = {
  number: "LPD-2027-0001",
  amountPaid: 300,
  hostedUrl: "https://invoice.example.test/i/1",
};

const baseBooking = {
  id: "booking_abcdefgh12345678",
  totalPrice: 300,
  serviceType: "BOARDING",
  pets: [{ name: "Rex" }],
};

function periodLines(text: string) {
  return text.split("\n").filter((line) => /^(Période|Period) : /.test(line));
}

// Ligne « Période » / « Period » de la facture : une seule mention du fuseau,
// alors que « Début » et « Fin » des autres e-mails en portent chacune une.
describe("e-mail de facture : ligne Période", () => {
  it("séjour multi-jours : une seule mention du fuseau, en FR et en EN", () => {
    const details = getBookingEmailDetails({
      ...baseBooking,
      startDate: new Date("2027-01-04T00:00:00.000Z"),
      endDate: new Date("2027-01-07T00:00:00.000Z"),
      startTime: "18:00",
      endTime: "10:30",
    });
    const email = buildBookingInvoiceEmail("Alex", details, invoice);

    const lines = periodLines(email.text);
    expect(lines).toEqual([
      "Période : du 04 janvier 2027 à 18:00 au 07 janvier 2027 à 10:30 (heure de Paris)",
      "Period : du 04 janvier 2027 à 18:00 au 07 janvier 2027 à 10:30 (heure de Paris)",
    ]);
    for (const line of lines) expect(line.match(/Paris/g)).toHaveLength(1);
    expect(email.html.match(/\(heure de Paris\)/g)).toHaveLength(2);
    expect(email.html).not.toContain("(Paris)");
    // Les champs Début / Fin des autres e-mails restent inchangés.
    expect(details.startDate).toBe("04 janvier 2027 à 18:00 (Paris)");
    expect(details.endDate).toBe("07 janvier 2027 à 10:30 (Paris)");
    expect(ResendMock).not.toHaveBeenCalled();
  });

  it("séjour d'un jour : une seule date et une seule mention du fuseau", () => {
    const day = new Date("2027-01-04T00:00:00.000Z");
    const details = getBookingEmailDetails({
      ...baseBooking,
      startDate: day,
      endDate: day,
      startTime: "09:00",
      endTime: "18:00",
    });
    const email = buildBookingInvoiceEmail("Alex", details, invoice);

    const lines = periodLines(email.text);
    expect(lines).toEqual([
      "Période : le 04 janvier 2027 de 09:00 à 18:00 (heure de Paris)",
      "Period : le 04 janvier 2027 de 09:00 à 18:00 (heure de Paris)",
    ]);
    for (const line of lines) {
      expect(line.match(/Paris/g)).toHaveLength(1);
      expect(line.match(/04 janvier 2027/g)).toHaveLength(1);
    }
    expect(ResendMock).not.toHaveBeenCalled();
  });

  it("appelant sans champ period : repli sur début – fin", () => {
    const email = buildBookingInvoiceEmail(
      "Alex",
      { petName: "Rex", startDate: "04 janvier 2027", endDate: "07 janvier 2027", totalPrice: 300 },
      invoice
    );
    expect(periodLines(email.text)[0]).toBe("Période : 04 janvier 2027 – 07 janvier 2027");
  });
});
