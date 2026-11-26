import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { translateFrenchText } from "@/lib/i18n";

const NO_SHOW_CGV_TEXT =
  "une indemnité correspondant au préjudice justifié (créneau immobilisé, temps mobilisé et impossibilité de réattribuer la place), déduction faite des coûts économisés et des sommes obtenues par une réattribution, peut être retenue dans la limite du prix réservé. Aucun remboursement n’est effectué si cette indemnité justifiée couvre la totalité du montant encaissé. Sinon, la différence est remboursée. Aucun prélèvement supplémentaire n’est automatique.";

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function extractNoShowText(source: string) {
  const match = source.match(/<strong[^>]*>Non-présentation :<\/strong> ([^<]+)<\/li>/);
  expect(match, "ligne « Non-présentation » introuvable").not.toBeNull();
  return match![1];
}

describe("/tarifs — non-présentation alignée sur les CGV", () => {
  const tarifs = readSource("src/app/tarifs/page.tsx");
  const cgv = readSource("src/app/legal/cgv/page.tsx");

  it("no longer claims that 100 % of the service is due", () => {
    expect(tarifs).not.toContain("100 % de la prestation est due");
    expect(readSource("src/lib/i18n.ts")).not.toContain("100 % de la prestation est due");
  });

  it("uses exactly the CGV no-show wording", () => {
    const cgvText = extractNoShowText(cgv);
    expect(cgvText).toBe(NO_SHOW_CGV_TEXT);
    expect(extractNoShowText(tarifs)).toBe(cgvText);
  });

  it("inherits the existing EN/ES translations of the CGV paragraph", () => {
    expect(translateFrenchText(NO_SHOW_CGV_TEXT, "en")).toBe(
      "Compensation for justified loss (the reserved slot, time committed and inability to reallocate the place), minus costs saved and income from reallocating it, may be retained up to the booking price. No refund is made if this justified compensation covers the full amount collected. Otherwise the difference is refunded. No additional charge is automatic."
    );
    expect(translateFrenchText(NO_SHOW_CGV_TEXT, "es")).toBe(
      "Puede retenerse una indemnización por el perjuicio justificado (horario reservado, tiempo dedicado e imposibilidad de reasignar la plaza), descontando los costes ahorrados y los ingresos de una reasignación, hasta el límite del precio reservado. No se realiza reembolso si la indemnización justificada cubre todo el importe cobrado. En caso contrario, se reembolsa la diferencia. Ningún cargo adicional es automático."
    );
  });
});
