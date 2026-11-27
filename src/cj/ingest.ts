import type { Env } from "../env";
import { cj } from "./client";
import { classifyTitle } from "../lib/classify";
import { uploadImageFromUrl, imageIdFor } from "../ingest/images";
import { now, retailFromCost, sanitizeHtml, slugify } from "../lib/util";

/**
 * Import or re-sync one CJdropshipping Australian-warehouse product.
 * Stored in the same tables as AliExpress products with the key "CJ-<pid>" in aliexpress_product_id,
 * so listings, cart and checkout work unchanged. Ships to Australia only (AU warehouse, fast delivery).
 * CJ prices are USD; CJ_USD_AUD converts them. Orders for CJ items are placed by hand (see jobs.ts).
 */
interface CjVariant { vid: string; variantSku: string; variantNameEn?: string | null; variantKey?: string | null; variantSellPrice: number; variantImage?: string | null }
interface CjProduct { pid: string; productNameEn: string; description?: string; productImageSet?: string; productImage?: string; bigImage?: string; status?: string; variants?: CjVariant[] }

const MAX_IMAGES = 8;
const parseList = (v?: string): string[] => {
  if (!v) return [];
  try { return JSON.parse(v.replace(/'/g, '"')) as string[]; } catch { return []; }
};

export async function ingestCjProduct(env: Env, key: string): Promise<void> {
  const pid = key.replace(/^CJ-/, "");
  const p = await cj<CjProduct>(env, "/product/query", { query: { pid } });
  const title = (p.productNameEn ?? "").replace(/\s+AU$/i, "").trim();
  if (!title) throw new Error(`CJ ${pid} has no title`);
  const fx = Number(env.CJ_USD_AUD) || 1.55;
  const markup = Number(env.CJ_PRICE_MARKUP) || 1.6; // AU-warehouse stock costs more, so a lower markup keeps prices competitive
  const compareMarkup = Number(env.COMPARE_AT_MARKUP) || 0;
  const variants = (p.variants ?? []).filter((v) => v.vid && v.variantSellPrice > 0).map((v) => {
    const cost = Math.round(v.variantSellPrice * fx * 100);
    const price = retailFromCost(cost, markup);
    const label = (v.variantNameEn || v.variantKey || "").trim();
    return { ...v, cost, price, compareAt: compareMarkup > 1 ? Math.round(price * compareMarkup) : null, attributes: p.variants!.length > 1 && label ? { Option: label } : {} };
  });
  if (!variants.length) throw new Error(`CJ ${pid} has no purchasable variants`);

  const gallery = [...new Set([p.bigImage, ...parseList(p.productImage), ...parseList(p.productImageSet)].filter((u): u is string => !!u))].slice(0, MAX_IMAGES);
  const uploaded = new Map<string, string>();
  for (const url of gallery) {
    try { uploaded.set(url, await uploadImageFromUrl(env, url, await imageIdFor(key, url))); } catch (e) { console.warn("cj image skipped", url, (e as Error).message); }
  }
  const run = now();
  const live = !p.status || p.status === "3"; // 3 = on sale at CJ
  const pidSql = `(SELECT id FROM products WHERE aliexpress_product_id = ?)`;
  const stmts: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO products (aliexpress_product_id, title, description, slug, status, currency, feature_image_id, ship_countries, last_synced_at, sync_error, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'AU', ?8, NULL, ?8, ?8)
       ON CONFLICT(aliexpress_product_id) DO UPDATE SET
         title=excluded.title, description=excluded.description,
         status = CASE WHEN products.status = 'archived' THEN 'archived' ELSE excluded.status END,
         feature_image_id=COALESCE(excluded.feature_image_id, products.feature_image_id), ship_countries='AU',
         last_synced_at=excluded.last_synced_at, sync_error=NULL, updated_at=excluded.updated_at`,
    ).bind(key, title, sanitizeHtml(p.description), slugify(title, key), live ? "active" : "unavailable", env.STORE_CURRENCY, uploaded.get(gallery[0] ?? "") ?? null, run),
    env.DB.prepare(`UPDATE products SET category_id = ? WHERE aliexpress_product_id = ? AND category_id IS NULL`).bind(classifyTitle(title), key),
  ];
  for (const v of variants) {
    stmts.push(env.DB.prepare(
      `INSERT INTO product_variants (product_id, ae_sku_id, ae_sku_attr, sku, price_cents, compare_at_price_cents, cost_cents, stock_qty, attributes_json, is_active, synced_run)
       VALUES (${pidSql}, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
       ON CONFLICT(product_id, ae_sku_id) DO UPDATE SET ae_sku_attr=excluded.ae_sku_attr, price_cents=excluded.price_cents,
         compare_at_price_cents=excluded.compare_at_price_cents, cost_cents=excluded.cost_cents, stock_qty=excluded.stock_qty,
         attributes_json=excluded.attributes_json, is_active=1, synced_run=excluded.synced_run`,
    ).bind(key, v.vid, v.variantSku, `RZ-CJ-${v.variantSku}`, v.price, v.compareAt, v.cost, live ? 50 : 0, JSON.stringify(v.attributes), run));
  }
  stmts.push(env.DB.prepare(`UPDATE product_variants SET is_active = 0, stock_qty = 0 WHERE product_id = ${pidSql} AND synced_run <> ?`).bind(key, run));
  gallery.forEach((url, i) => {
    const id = uploaded.get(url);
    if (id) stmts.push(env.DB.prepare(
      `INSERT INTO product_images (product_id, cloudflare_image_id, source_url, position, is_feature) VALUES (${pidSql}, ?, ?, ?, ?)
       ON CONFLICT(product_id, cloudflare_image_id) DO UPDATE SET position=excluded.position, is_feature=excluded.is_feature`,
    ).bind(key, id, url, i, i === 0 ? 1 : 0));
  });
  stmts.push(env.DB.prepare(
    `UPDATE products SET min_price_cents = (SELECT MIN(price_cents) FROM product_variants WHERE product_id = products.id AND is_active = 1),
       max_price_cents = (SELECT MAX(price_cents) FROM product_variants WHERE product_id = products.id AND is_active = 1),
       total_stock = (SELECT COALESCE(SUM(stock_qty),0) FROM product_variants WHERE product_id = products.id AND is_active = 1)
     WHERE aliexpress_product_id = ?`).bind(key));
  stmts.push(env.DB.prepare(`DELETE FROM import_queue WHERE aliexpress_product_id = ?`).bind(key));
  await env.DB.batch(stmts);
}
