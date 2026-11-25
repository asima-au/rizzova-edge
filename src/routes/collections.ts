import { Hono } from "hono";
import type { Env } from "../env";

/**
 * GET /api/collections/:slug -> { slug, name, slugs: [...] }
 * Gift-guide collections built from rules (price, department, title words), so new products join automatically.
 * Chosen from Google Trends (Nov 2026): Secret Santa under $25, gifts for mum, kids & teens, funny gifts, teacher gifts.
 */
export const collections = new Hono<{ Bindings: Env }>();

const like = (words: string[]) => `(${words.map((w) => `lower(p.title) LIKE '%${w}%'`).join(" OR ")})`;

/** Household, utility and spare-part items that never belong in a gift guide. */
const NOT_GIFTY = `NOT ${like(["soap", "dispenser", "sink", "cleaning", "scrub", "drain", "hook", "hanger", "cable", "charger", "storage bag", "organizer", "organiser", "vacuum", "clamp", "spare", "replacement", "parts", "seat post", "wraps", "sticker", "spider", "scale", "pliers", "filter", "duct", "litter", "halloween", "mould", "mold", "windsock", "flag pole", "father", " dad ", "dad mug", "lemon", "sprayer", "bicycle", "cycling"])}`;

/** Fixed rules only (no user input reaches the SQL). */
export const COLLECTIONS: Record<string, { name: string; where: string }> = {
  "secret-santa-under-25": { name: "Secret Santa gifts under A$25", where: `p.min_price_cents BETWEEN 600 AND 2500 AND COALESCE(p.category_id, 0) <> 2 AND ${NOT_GIFTY}` },
  "gifts-for-mum": {
    name: "Gifts for mum",
    where: `(p.category_id IN (5, 6) OR ${like(["scarf", "candle", "blanket", "mug", "tumbler", "night light", "lamp", "cushion", "jewel", "necklace", "bracelet", "pendant", "planner", "sunflower", "satin", "silk", "towel", "jewelry box"])})
            AND COALESCE(p.category_id, 0) NOT IN (2, 3, 8)
            AND NOT ${like(["for men", "men''s", "mens ", "male", "baby", "kids", "child", "pet ", " rc ", "clothes storage", "kitchen towel", "hand towel", " men ", "design men", "keycap"])}
            AND ${NOT_GIFTY}`,
  },
  "kids-and-teens": { name: "Gifts for kids & teens", where: "p.category_id = 3" },
  "funny-gifts": {
    name: "Funny gifts",
    where: `${like(["funny", "goose", "screaming", "prank", "squish", "fidget", "squeeze toy", "squeeze ball", "stress ball", "capybara", "skeleton", "stress relief", "novelty", "joke", "cheese"])} AND ${NOT_GIFTY}`,
  },
  "teacher-gifts": {
    name: "Teacher gifts",
    where: `${like(["teacher", "tumbler", "planner", "pencil", "highlighter", "stationery", "notebook", "copybook", "bookmark", "desk lamp", "table light", "candle", "plush keychain", "enamel pins", "water bottle", "night light"])}
            AND p.min_price_cents <= 4000 AND COALESCE(p.category_id, 0) <> 2 AND ${NOT_GIFTY}`,
  },
};

collections.get("/:slug", async (c) => {
  const col = COLLECTIONS[c.req.param("slug")];
  if (!col) return c.json({ error: "Not found" }, 404);
  const { results } = await c.env.DB.prepare(
    `SELECT p.slug FROM products p
     WHERE p.status = 'active' AND p.total_stock > 0 AND p.feature_image_id IS NOT NULL AND (${col.where})
     ORDER BY COALESCE(p.supplier_orders, 0) DESC, p.created_at DESC LIMIT 48`,
  ).all<{ slug: string }>();
  return c.json({ slug: c.req.param("slug"), name: col.name, slugs: results.map((r) => r.slug) });
});
