import type { MetadataRoute } from "next";
import { allProductSlugs } from "@/lib/catalog";
import { POLICIES } from "@/lib/policies";
import { SITE_URL } from "@/lib/site";

// Built on request so newly imported products appear without a redeploy.
export const dynamic = "force-dynamic";

/** /sitemap.xml for Google Search Console: home, every live product and the policy pages. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await allProductSlugs();
  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    ...slugs.map((s) => ({ url: `${SITE_URL}/product/${s}`, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...POLICIES.map((p) => ({ url: `${SITE_URL}/${p.slug}`, changeFrequency: "yearly" as const, priority: 0.3 })),
  ];
}
