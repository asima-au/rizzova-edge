import type { Env } from "../env";
import { callBusiness } from "../aliexpress/client";
import { getDsProduct } from "../aliexpress/dropshipper";
import { now } from "../lib/util";

/**
 * Nightly product discovery: promo feeds -> ae_candidates -> vetting -> import_queue.
 *
 * Field names for ds.feed.itemids.get, the rating fields of ds.product.get and ds.freight.query
 * were not confirmed with the console's API test tool, so parsing is defensive and every check
 * fails closed: a candidate with no readable rating or delivery cost is rejected with a reason,
 * never imported. Check `GET /admin/candidates?status=rejected` after the first run.
 */

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[^\d.]/g, "")) : NaN;
  return Number.isFinite(n) && String(v).trim() !== "" ? n : null;
};

/** Every value under `key` anywhere in a nested payload (AliExpress nesting varies by API). */
function findAll(node: unknown, key: string, out: unknown[] = []): unknown[] {
  if (Array.isArray(node)) for (const v of node) findAll(v, key, out);
  else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (k === key) out.push(v);
      findAll(v, key, out);
    }
  }
  return out;
}
const first = (node: unknown, keys: string[]): unknown => {
  for (const k of keys) {
    const hit = findAll(node, k).find((v) => v !== undefined && v !== null && v !== "");
    if (hit !== undefined) return hit;
  }
  return undefined;
};

/** Product ids in a feed response: product_id fields, or a plain list of numeric ids. */
export function feedProductIds(payload: unknown): string[] {
  const ids = new Set<string>();
  const add = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(add);
    const s = String(v ?? "").trim();
    if (/^\d{10,20}$/.test(s)) ids.add(s);
  };
  for (const k of ["product_id", "productId", "product_ids", "item_id", "itemId", "number", "products"]) findAll(payload, k).forEach(add);
  return [...ids];
}

const settings = (env: Env) => ({
  feeds: (env.DISCOVERY_FEEDS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  perFeed: Math.min(Number(env.DISCOVERY_PER_FEED) || 50, 200),
  minRating: Number(env.DISCOVERY_MIN_RATING) || 4.8,
  minStoreRating: Number(env.DISCOVERY_MIN_STORE_RATING) || 4.6,
  minOrders: Number(env.DISCOVERY_MIN_ORDERS) || 100,
  maxShipCents: Number(env.DISCOVERY_MAX_SHIP_CENTS) || 300,
  countries: (env.DISCOVERY_COUNTRIES || "AU,US,AE").split(",").map((s) => s.trim()).filter(Boolean),
  dailyLimit: Number(env.DISCOVERY_DAILY_LIMIT) || 10,
  autoImport: env.AUTO_IMPORT === "on",
  maxPriceCents: Number(env.DISCOVERY_MAX_PRICE_CENTS) || 6000,
});

/**
 * Owner rule (20 Nov 2026): no risky or high-value items that make returns a headache.
 * Weapons and hunting gear, footwear and sized clothing, higher-value electronics, batteries and cosmetics are skipped.
 */
const BLOCKED = /\b(rifle|gun|pistol|airsoft|hunting|knife|knives|dagger|sword|taser|crossbow|ammo|scope|shoes?|boots?|sneakers?|heels|sandals?|dress|jeans|pants|trousers|shirt|jacket|coat|lingerie|bra|amplifier|dac|headphones?|earbuds|speaker|camera|drone|projector|smart ?watch|tablet|laptop|power ?bank|battery|batteries|lithium|vape|e-?cig|perfume|cosmetic|makeup|serum|cream|supplement|medicine|tattoo)\b/i;

/** Cron step: pull feed ids, store unseen ones, queue them for vetting. */
export async function discoverFromFeeds(env: Env, token: string): Promise<{ found: number; queued: number }> {
  const s = settings(env);
  const t = now();
  let found = 0;
  const fresh: string[] = [];
  for (const feed of s.feeds) {
    let ids: string[] = [];
    try {
      const payload = await callBusiness(env, "aliexpress.ds.feed.itemids.get", token, { feed_name: feed, page_size: s.perFeed });
      ids = feedProductIds(payload).slice(0, s.perFeed);
    } catch (err) {
      console.error("feed", feed, (err as Error).message);
      continue;
    }
    found += ids.length;
    for (let i = 0; i < ids.length; i += 50) {
      const res = await env.DB.batch(
        ids.slice(i, i + 50).map((id) =>
          env.DB.prepare(`INSERT OR IGNORE INTO ae_candidates (aliexpress_product_id, feed, status, found_at, updated_at) VALUES (?, ?, 'new', ?, ?)`).bind(id, feed, t, t),
        ),
      );
      res.forEach((r, j) => { if (r.meta.changes > 0) fresh.push(ids[i + j]!); });
    }
  }
  for (let i = 0; i < fresh.length; i += 100) {
    await env.JOBS.sendBatch(fresh.slice(i, i + 100).map((id) => ({ body: { type: "vet-candidate" as const, aeProductId: id } })));
  }
  return { found, queued: fresh.length };
}

/**
 * Best sellers for one keyword: aliexpress.ds.text.search sorted by orders, two pages of 50.
 * New product ids go into ae_candidates (feed "search: <keyword>") and are vetted like feed products.
 */
export async function discoverFromSearch(env: Env, token: string, keyword: string): Promise<{ found: number; queued: number }> {
  const t = now();
  const ids: string[] = [];
  for (const pageIndex of [1, 2]) {
    const payload = await callBusiness(env, "aliexpress.ds.text.search", token, {
      keyWord: keyword, local: "en_US", countryCode: env.AE_SHIP_TO_COUNTRY, currency: env.STORE_CURRENCY,
      sortBy: "orders,desc", pageSize: 50, pageIndex,
    });
    const page = feedProductIds(payload);
    ids.push(...page.filter((id) => !ids.includes(id)));
    if (page.length < 50) break;
  }
  const fresh: string[] = [];
  const feed = `search: ${keyword}`.slice(0, 80);
  for (let i = 0; i < ids.length; i += 50) {
    const res = await env.DB.batch(
      ids.slice(i, i + 50).map((id) =>
        env.DB.prepare(`INSERT OR IGNORE INTO ae_candidates (aliexpress_product_id, feed, status, found_at, updated_at) VALUES (?, ?, 'new', ?, ?)`).bind(id, feed, t, t),
      ),
    );
    res.forEach((r, j) => { if (r.meta.changes > 0) fresh.push(ids[i + j]!); });
  }
  for (let i = 0; i < fresh.length; i += 100) {
    await env.JOBS.sendBatch(fresh.slice(i, i + 100).map((id) => ({ body: { type: "vet-candidate" as const, aeProductId: id } })));
  }
  return { found: ids.length, queued: fresh.length };
}

/** Keywords searched every night (DISCOVERY_KEYWORDS), one queued job each. */
export const discoveryKeywords = (env: Env) => (env.DISCOVERY_KEYWORDS ?? "").split(",").map((k) => k.trim()).filter(Boolean);

/** Cheapest delivery to one country, in store-currency cents; null when not deliverable or unreadable. */
async function cheapestShippingCents(env: Env, token: string, aeProductId: string, skuId: string | undefined, country: string): Promise<number | null> {
  const payload = await callBusiness(env, "aliexpress.ds.freight.query", token, {
    queryDeliveryReq: JSON.stringify({
      productId: Number(aeProductId), selectedSkuId: skuId, quantity: 1, shipToCountry: country,
      currency: env.STORE_CURRENCY, language: "en_US", locale: "en_US",
    }),
  });
  const options = findAll(payload, "delivery_option_d_t_o").flat() as Record<string, unknown>[];
  let best: number | null = null;
  for (const o of options) {
    if (!o || typeof o !== "object") continue;
    const free = o.free_shipping === true || String(o.free_shipping) === "true";
    // Despite its name, shipping_fee_cent holds the amount in currency units ("12.60" = A$12.60), as seen on 18 Nov 2026.
    const amount = num(o.shipping_fee_cent) ?? num(o.shipping_fee);
    const cents = free ? 0 : amount === null ? null : Math.round(amount * 100);
    if (cents !== null && (best === null || cents < best)) best = cents;
  }
  return best;
}

/** Queue step: rating, order volume and delivery checks for one candidate; imports it when it passes. */
export async function vetCandidate(env: Env, token: string, aeProductId: string): Promise<void> {
  const s = settings(env);
  const ds = await getDsProduct(env, token, aeProductId);
  const rating = num(first(ds, ["avg_evaluation_rating", "evaluation_rating"]));
  const orders = num(first(ds, ["sales_count", "order_count"]));
  const storeRatings = ["item_as_described_rating", "communication_rating", "shipping_speed_rating"]
    .map((k) => num(first(ds, [k]))).filter((v): v is number => v !== null);
  const skuId = first(ds, ["sku_id"]);

  const reasons: string[] = [];
  const title = String(first(ds, ["subject"]) ?? "");
  const blocked = title.match(BLOCKED);
  if (blocked) reasons.push(`blocked type: ${blocked[0].toLowerCase()}`);
  // Retail is cost x PRICE_MARKUP; compare the cheapest variant's retail with the cap.
  const costs = findAll(ds, "offer_sale_price").map(num).filter((v): v is number => v !== null);
  const retailCents = costs.length ? Math.round(Math.min(...costs) * 100 * (Number(env.PRICE_MARKUP) || 2)) : null;
  if (retailCents === null) reasons.push("no price");
  else if (retailCents > s.maxPriceCents) reasons.push(`retail about A$${(retailCents / 100).toFixed(0)} is over the A$${s.maxPriceCents / 100} cap`);
  if (rating === null) reasons.push("no rating");
  else if (rating < s.minRating) reasons.push(`rating ${rating}`);
  if (orders === null) reasons.push("no order count");
  else if (orders < s.minOrders) reasons.push(`${orders} orders`);
  if (storeRatings.some((r) => r < s.minStoreRating)) reasons.push(`store ratings ${storeRatings.join("/")}`);

  // Delivery: Australia is required; the US and UAE are optional. A product is sold only to the
  // countries it reaches within the cost limit (checkout enforces products.ship_countries).
  const shipping: Record<string, number | null> = {};
  const reachable: string[] = [];
  if (reasons.length === 0) {
    for (const c of s.countries) {
      shipping[c] = await cheapestShippingCents(env, token, aeProductId, skuId === undefined ? undefined : String(skuId), c).catch(() => null);
      if (shipping[c] !== null && shipping[c]! <= s.maxShipCents) reachable.push(c);
    }
    if (!reachable.includes("AU")) {
      reasons.push(shipping.AU === null || shipping.AU === undefined ? "no delivery to AU" : `AU delivery ${shipping.AU}c`);
    }
  }

  const passed = reasons.length === 0;
  let status = passed ? "passed" : "rejected";
  if (passed && s.autoImport) {
    const since = now() - 24 * 3600_000;
    const today = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ae_candidates WHERE status = 'imported' AND updated_at > ?`).bind(since).first<{ n: number }>();
    if ((today?.n ?? 0) < s.dailyLimit) {
      await env.DB.prepare(`INSERT OR IGNORE INTO import_queue (aliexpress_product_id, requested_at) VALUES (?, ?)`).bind(aeProductId, now()).run();
      await env.JOBS.send({ type: "ingest-product", aeProductId });
      status = "imported";
    }
  }
  await env.DB.prepare(
    `UPDATE ae_candidates SET status = ?, rating = ?, orders = ?, shipping_json = ?, ship_countries = ?, reason = ?, updated_at = ? WHERE aliexpress_product_id = ?`,
  ).bind(status, rating, orders, JSON.stringify(shipping), reachable.length ? reachable.join(",") : null, reasons.join("; ") || null, now(), aeProductId).run();
}
