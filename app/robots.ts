import type { MetadataRoute } from "next";

const canonicalOrigin =
  process.env.NEXT_PUBLIC_APP_URL || "https://www.aletheia.live";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard/", "/profile/", "/settings/"],
      },
    ],
    sitemap: `${canonicalOrigin}/sitemap.xml`,
  };
}
