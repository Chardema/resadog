import { describe, expect, it } from "vitest";
import { formatServicePeriod } from "@/lib/booking-email-details";

// Libellé de période des factures et du Checkout : chaque heure une seule
// fois, une seule mention du fuseau.
describe("formatServicePeriod", () => {
  const stay = {
    startDate: new Date("2027-01-04T00:00:00.000Z"),
    endDate: new Date("2027-01-07T00:00:00.000Z"),
    startTime: "18:00",
    endTime: "10:30",
  };

  it("séjour multi-jours, heures différentes à l'arrivée et au départ", () => {
    const label = formatServicePeriod(stay);
    expect(label).toBe("du 04 janvier 2027 à 18:00 au 07 janvier 2027 à 10:30 (heure de Paris)");
    expect(label.match(/18:00/g)).toHaveLength(1);
    expect(label.match(/Paris/g)).toHaveLength(1);
  });

  it("prestation sur un seul jour", () => {
    const sameDay = { ...stay, endDate: stay.startDate, startTime: "09:00", endTime: "18:00" };
    expect(formatServicePeriod(sameDay)).toBe("le 04 janvier 2027 de 09:00 à 18:00 (heure de Paris)");
    expect(formatServicePeriod({ ...sameDay, endTime: null })).toBe("le 04 janvier 2027 à 09:00 (heure de Paris)");
    expect(formatServicePeriod({ ...sameDay, startTime: null, endTime: null })).toBe("le 04 janvier 2027");
  });

  it("heures absentes ou partielles", () => {
    expect(formatServicePeriod({ ...stay, startTime: null, endTime: null })).toBe("du 04 janvier 2027 au 07 janvier 2027");
    expect(formatServicePeriod({ ...stay, endTime: "" })).toBe("du 04 janvier 2027 à 18:00 au 07 janvier 2027 (heure de Paris)");
  });

  it("format court pour la description du Checkout Stripe", () => {
    expect(formatServicePeriod(stay, "short")).toBe("du 04/01/2027 à 18:00 au 07/01/2027 à 10:30 (heure de Paris)");
  });
});
