import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Search and AI crawlers may read the shop; checkout, orders and the API stay out of indexes. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/checkout", "/order/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
