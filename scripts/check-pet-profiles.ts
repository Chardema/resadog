import assert from "node:assert/strict";
import { getPetProfileCompletion, requiresPetBirthDateProof } from "../src/lib/pets";

const completePetWithoutProof = {
  name: "Sasha",
  breed: "Labrador",
  birthDate: "2020-01-01",
  birthDateProofUrl: null,
  weight: 24,
  gender: "FEMALE",
  spayedNeutered: true,
  medicalInfo: "Aucune connue",
  medications: "Aucun",
  behaviorNotes: "Sociable",
  feedingSchedule: "Deux repas par jour",
  vetInfo: "Clinique vétérinaire",
  emergencyContact: "06 00 00 00 00",
} as const;

assert.equal(requiresPetBirthDateProof("ADMIN"), false);
assert.equal(requiresPetBirthDateProof("CLIENT"), true);
assert.equal(requiresPetBirthDateProof("SITTER"), true);

const clientCompletion = getPetProfileCompletion(completePetWithoutProof);
assert.equal(clientCompletion.isComplete, false);
assert.equal(clientCompletion.missingFields.some(({ key }) => key === "birthDateProofUrl"), true);

const adminCreationCompletion = getPetProfileCompletion(completePetWithoutProof, {
  requireBirthDateProof: false,
});
assert.equal(adminCreationCompletion.isComplete, true);

const verifiedAdminPetCompletion = getPetProfileCompletion({
  ...completePetWithoutProof,
  birthDateVerifiedAt: "2026-08-26T00:00:00.000Z",
});
assert.equal(verifiedAdminPetCompletion.isComplete, true);

console.log("OK - exemption de justificatif d'âge réservée aux administrateurs");
