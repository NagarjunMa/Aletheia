import type { MetadataRoute } from "next";

const canonicalOrigin =
  process.env.NEXT_PUBLIC_APP_URL || "https://www.aletheia.live";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: canonicalOrigin,
      lastModified,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${canonicalOrigin}/demo`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${canonicalOrigin}/install`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${canonicalOrigin}/status`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${canonicalOrigin}/privacy`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${canonicalOrigin}/terms`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.4,
    },
  ];
}
