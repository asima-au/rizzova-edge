import { Hono } from "hono";
import type { Env } from "../env";
import { imageUrl } from "../ingest/images";

/**
 * GET /api/merchant-feed.xml
 * Google Merchant Center product feed (RSS 2.0 with the g: namespace) for free Google Shopping listings.
 * Only active, in-stock products with an image; approved Rizz AI titles and summaries when available.
 * Prices are the store's AUD prices; delivery is free to Australia.
 */
export const merchantFeed = new Hono<{ Bindings: Env }>();

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const plain = (html: string | null) =>
  (html ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

merchantFeed.get("/", async (c) => {
  const site = c.env.PUBLIC_SITE_URL.replace(/\/$/, "");
  const { results } = await c.env.DB.prepare(
    `SELECT p.id, COALESCE(pc.title, p.title) AS title, COALESCE(pc.summary, pc.description, p.description) AS description,
            p.slug, p.currency, p.min_price_cents, p.feature_image_id, cat.name AS department
     FROM products p
     LEFT JOIN product_copy pc ON pc.product_id = p.id AND pc.status = 'approved'
     LEFT JOIN categories cat ON cat.id = p.category_id
     WHERE p.status = 'active' AND p.total_stock > 0 AND p.feature_image_id IS NOT NULL AND p.min_price_cents IS NOT NULL
       AND (p.ship_countries IS NULL OR p.ship_countries LIKE '%AU%')
     ORDER BY p.created_at DESC LIMIT 5000`,
  ).all<{ id: number; title: string; description: string | null; slug: string; currency: string; min_price_cents: number; feature_image_id: string; department: string | null }>();

  const items = results.map((p) => {
    const desc = plain(p.description).slice(0, 4900) || p.title;
    return `<item>
<g:id>RZ-${p.id}</g:id>
<g:title>${esc(p.title.slice(0, 150))}</g:title>
<g:description>${esc(desc)}</g:description>
<g:link>${esc(`${site}/product/${p.slug}`)}</g:link>
<g:image_link>${esc(imageUrl(c.env, p.feature_image_id))}</g:image_link>
<g:availability>in_stock</g:availability>
<g:price>${(p.min_price_cents / 100).toFixed(2)} ${p.currency || "AUD"}</g:price>
<g:condition>new</g:condition>
<g:brand>Rizzova</g:brand>
<g:identifier_exists>no</g:identifier_exists>
${p.department ? `<g:product_type>${esc(p.department)}</g:product_type>` : ""}
<g:shipping><g:country>AU</g:country><g:service>Free tracked delivery</g:service><g:price>0.00 AUD</g:price><g:min_handling_time>1</g:min_handling_time><g:max_handling_time>3</g:max_handling_time><g:min_transit_time>10</g:min_transit_time><g:max_transit_time>20</g:max_transit_time></g:shipping>
</item>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>Rizzova</title>
<link>${site}</link>
<description>Rizzova gifts and everyday finds, free delivery to Australia</description>
${items.join("\n")}
</channel>
</rss>`;
  return c.body(xml, 200, { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" });
});
