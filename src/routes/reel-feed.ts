import { Hono } from "hono";
import type { Env } from "../env";
import { imageUrl } from "../ingest/images";

/**
 * GET /api/reel-feed?category=kids&limit=10
 * Live products for social videos (VidLab / Creatify / Metricool): only active, in-stock items,
 * approved Rizz AI titles when available, current AUD price and the exact rizzova.com link.
 * Categories match the storefront departments (keyword match on the supplier title).
 */
export const reelFeed = new Hono<{ Bindings: Env }>();

const CATEGORIES: Record<string, { name: string; match: RegExp }> = {
  gifts: { name: "Christmas Gifts", match: /christmas|xmas|santa|gift/i },
  home: { name: "Home & Kitchen", match: /kitchen|home|storage|organi[sz]er|soap|cup|decor|wall|mat\b/i },
  pets: { name: "Pets", match: /^(?!.*\b(mold|mould|candle|sticker)\b).*\b(pet|dog|cat|puppy|kitten)s?\b/i },
  kids: { name: "Kids & Toys", match: /toy|kids?|child|puzzle|block|squeeze|fidget/i },
  tech: { name: "Tech", match: /usb|card reader|phone|cable|camera|led|charger|magnetic/i },
  jewellery: { name: "Jewellery", match: /jewel|necklace|\brings?\b|pendant|bracelet|earrings?/i },
};

reelFeed.get("/", async (c) => {
  const key = (c.req.query("category") ?? "").toLowerCase();
  const cat = CATEGORIES[key];
  const limit = Math.min(Math.max(Number(c.req.query("limit")) || 10, 1), 20);
  const site = c.env.PUBLIC_SITE_URL.replace(/\/$/, "");
  const { results } = await c.env.DB.prepare(
    `SELECT p.id, p.title AS supplier_title, COALESCE(pc.title, p.title) AS title, pc.summary, p.slug, p.currency,
            p.min_price_cents, p.max_price_cents, p.feature_image_id
     FROM products p LEFT JOIN product_copy pc ON pc.product_id = p.id AND pc.status = 'approved'
     WHERE p.status = 'active' AND p.total_stock > 0 AND p.feature_image_id IS NOT NULL
     ORDER BY p.created_at DESC LIMIT 500`,
  ).all<{ id: number; supplier_title: string; title: string; summary: string | null; slug: string; currency: string; min_price_cents: number | null; max_price_cents: number | null; feature_image_id: string }>();

  const picked = (cat ? results.filter((p) => cat.match.test(p.supplier_title)) : results).slice(0, limit);
  return c.json(
    {
      store: "Rizzova",
      shopUrl: site,
      category: cat?.name ?? "All products",
      categories: Object.keys(CATEGORIES),
      generatedAt: new Date().toISOString(),
      items: picked.map((p) => ({
        title: p.title,
        summary: p.summary,
        price: p.min_price_cents === null ? null : (p.min_price_cents / 100).toFixed(2),
        currency: p.currency,
        image: imageUrl(c.env, p.feature_image_id),
        url: `${site}/product/${p.slug}`,
      })),
    },
    200,
    { "cache-control": "public, max-age=300" },
  );
});
