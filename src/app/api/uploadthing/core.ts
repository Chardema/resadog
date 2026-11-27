import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { auth } from "@/lib/auth";
import { isProductionDeployment } from "@/lib/runtime-env";

const f = createUploadthing();

export const UPLOADS_DISABLED_MESSAGE = "Téléversement désactivé sur les environnements de test";

// Le middleware s'exécute avant tout envoi vers UploadThing : hors production
// (aperçus, local), aucun fichier n'atteint le compte UploadThing réel.
export async function authorizeUpload() {
  if (!isProductionDeployment()) {
    throw new UploadThingError({ code: "FORBIDDEN", message: UPLOADS_DISABLED_MESSAGE });
  }
  const session = await auth();
  if (!session?.user?.id) throw new Error("Non authentifié");
  return { userId: session.user.id };
}

export const ourFileRouter = {
  petImage: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(authorizeUpload)
    .onUploadComplete(async ({ metadata, file }) => {
      return { uploadedBy: metadata.userId, url: file.url };
    }),
  petAgeProof: f({
    image: { maxFileSize: "4MB", maxFileCount: 1 },
    pdf: { maxFileSize: "4MB", maxFileCount: 1, contentDisposition: "attachment" },
  })
    .middleware(authorizeUpload)
    .onUploadComplete(async ({ metadata, file }) => {
      return { uploadedBy: metadata.userId, url: file.url };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
