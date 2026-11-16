import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { localSeoPages } from "@/lib/seo";

const groupDir = path.join(process.cwd(), "src/app/(local-seo)");

// Routes statiques et non [slug] : une URL inconnue à un segment doit tomber sur
// la 404 rendue dans le layout (lang, en-tête, pied de page), pas sur un
// notFound() levé par une page, que Next sert dans sa coquille d'erreur.
describe("routes des pages SEO locales", () => {
  const routeDirs = fs
    .readdirSync(groupDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(groupDir, entry.name, "page.tsx")))
    .map((entry) => entry.name);

  it("n'utilise aucun segment dynamique", () => {
    expect(routeDirs.filter((name) => name.startsWith("["))).toEqual([]);
  });

  it("a exactement une route statique par page de localSeoPages", () => {
    expect([...routeDirs].sort()).toEqual(localSeoPages.map((page) => page.slug).sort());
  });

  it("chaque route rend la page de son propre slug", () => {
    for (const page of localSeoPages) {
      const source = fs.readFileSync(path.join(groupDir, page.slug, "page.tsx"), "utf8");
      expect(source).toContain(`const slug = "${page.slug}";`);
      expect(page.path).toBe(`/${page.slug}`);
    }
  });
});
