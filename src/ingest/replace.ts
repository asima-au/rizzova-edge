import type { Env } from "../env";
import { alertOwner } from "../lib/alert";
import { classifyTitle } from "../lib/classify";

const now = () => Date.now();
const STOP = new Set("for with and the new pcs set cute mini small large women men kids girls boys gift gifts hot sale style 1pc 2pcs home".split(" "));
const words = (t: string) => new Set(t.toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));

/**
 * A live product sold out: hide it and add the closest vetted suggestion in the same department
 * (same supplier rules: rating, orders, store ratings, A$5 AU delivery, price cap, block list).
 * The old address redirects to the replacement. If nothing fits yet it stays hidden and is retried daily.
 */
export async function replaceSoldOut(env: Env, productId: number): Promise<void> {
  const old = await env.DB.prepare(
    `SELECT id, title, slug, category_id, total_stock, status, replaced_by_ae FROM products WHERE id = ?`,
  ).bind(productId).first<{ id: number; title: string; slug: string; category_id: number | null; total_stock: number; status: string; replaced_by_ae: string | null }>();
  if (!old || old.total_stock > 0 || old.status === "archived" || old.replaced_by_ae) return;
  await env.DB.prepare(`UPDATE products SET status = 'unavailable', replace_checked_at = ? WHERE id = ?`).bind(now(), old.id).run();

  const dept = old.category_id ?? classifyTitle(old.title);
  const want = words(old.title);
  const { results } = await env.DB.prepare(
    `SELECT aliexpress_product_id AS id, title, orders, rating FROM ae_candidates WHERE status = 'passed' AND title IS NOT NULL`,
  ).all<{ id: string; title: string; orders: number | null; rating: number | null }>();
  let best: { id: string; title: string; score: number } | null = null;
  for (const c of results) {
    if (classifyTitle(c.title) !== dept) continue;
    const overlap = [...words(c.title)].filter((w) => want.has(w)).length;
    if (overlap < 2) continue; // at least two meaningful words in common, so a tablecloth never replaces a Christmas ornament
    const score = overlap * 10 + Math.log10((c.orders ?? 0) + 1) + (c.rating ?? 0);
    if (!best || score > best.score) best = { id: c.id, title: c.title, score };
  }

  const site = env.PUBLIC_SITE_URL;
  if (!best) {
    await alertOwner(env, "Sold out: hidden, no replacement yet",
      `"${old.title.slice(0, 120)}" sold out at the supplier, so it is hidden from the store.\n\nNo similar vetted product is waiting yet; Rizzova checks again every day.\n`);
    return;
  }
  await env.DB.batch([
    env.DB.prepare(`UPDATE products SET replaced_by_ae = ? WHERE id = ?`).bind(best.id, old.id),
    env.DB.prepare(`UPDATE ae_candidates SET status = 'imported', updated_at = ? WHERE aliexpress_product_id = ?`).bind(now(), best.id),
    env.DB.prepare(`INSERT OR IGNORE INTO import_queue (aliexpress_product_id, requested_at) VALUES (?, ?)`).bind(best.id, now()),
  ]);
  await env.JOBS.send({ type: "ingest-product", aeProductId: best.id });
  await alertOwner(env, "Sold out: replaced automatically",
    `"${old.title.slice(0, 120)}" sold out at the supplier and is hidden.\n\nReplaced with a similar product that meets your supplier rules:\n"${best.title.slice(0, 140)}"\nhttps://www.aliexpress.com/item/${best.id}.html\n\nThe old link (${site}/product/${old.slug}) now opens the replacement.\n`);
}

/** Daily: retry sold-out products that are hidden without a replacement. */
export async function queueSoldOutRetries(env: Env): Promise<void> {
  const { results } = await env.DB.prepare(
    `SELECT id FROM products WHERE total_stock = 0 AND replaced_by_ae IS NULL AND status <> 'archived'
       AND (replace_checked_at IS NULL OR replace_checked_at < ?)`,
  ).bind(now() - 20 * 3600_000).all<{ id: number }>();
  if (results.length) await env.JOBS.sendBatch(results.map((r) => ({ body: { type: "replace-product" as const, productId: r.id } })));
}
