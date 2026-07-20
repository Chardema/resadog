import type { MetadataRoute } from "next";
import { absoluteUrl, localSeoPages, SEO_LAST_MODIFIED } from "@/lib/seo";

const publicRoutes: Array<{
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
}> = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/concept", priority: 0.55, changeFrequency: "monthly" },
  { path: "/subscriptions", priority: 0.55, changeFrequency: "monthly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(SEO_LAST_MODIFIED);

  return [
    ...publicRoutes.map((route) => ({
      url: absoluteUrl(route.path),
      lastModified,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    ...localSeoPages.map((page) => ({
      url: absoluteUrl(page.path),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.95,
    })),
  ];
}
