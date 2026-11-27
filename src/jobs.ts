import { cj } from "./cj/client";
import { callBusiness, optionalCallsAllowed } from "./aliexpress/client";
import { queueSoldOutRetries, replaceSoldOut } from "./ingest/replace";
import type { Env } from "./env";
import { getAccessToken, refreshToken, REFRESH_WINDOW_MS, tokenHealth } from "./aliexpress/auth";
import { ingestProduct, recordSyncError } from "./ingest/product";
import { getDsOrder, placeDsOrder } from "./aliexpress/dropshipper";
import { now } from "./lib/util";
import { discoverFromFeeds, discoverFromSearch, discoveryKeywords, vetCandidate } from "./ingest/discover";
import { matchLegacy } from "./ingest/legacy";
import { alertOwner, dailyReport } from "./lib/alert";

export type Job =
  | { type: "ingest-product"; aeProductId: string }
  | { type: "replace-product"; productId: number }
  | { type: "daily-report" }
  | { type: "debug-call"; method: string; params: Record<string, string | number> }
  | { type: "cj-call"; path: string; query?: Record<string, string> }
  | { type: "fulfil-order"; orderId: string }
  | { type: "track-fulfilment"; fulfilmentId: number }
  | { type: "vet-candidate"; aeProductId: string }
  | { type: "match-legacy"; wcId: number }
  | { type: "run-discovery" }
  | { type: "search-discovery"; keyword: string };

const SYNC_BATCH = 75; // x4 runs a day: every product re-checked daily without flooding the AliExpress call limit

// ───────────── Queue consumer ─────────────
export async function handleQueue(batch: MessageBatch<Job>, env: Env): Promise<void> {
  let token: string | null = null;
  const getToken = async () => (token ??= await getAccessToken(env));

  for (const msg of batch.messages) {
    const job = msg.body;
    try {
      if ((job.type === "vet-candidate" || job.type === "run-discovery" || job.type === "search-discovery") && !(await optionalCallsAllowed(env))) {
        console.log("skipped (AliExpress daily budget or back-off)", job.type); // vet-candidate stays 'new' and is retried by the drip
      }
      else if (job.type === "ingest-product") {
        await ingestProduct(env, await getToken(), job.aeProductId);
        // Sold out at the supplier: hide it and find a similar product (src/ingest/replace.ts).
        const p = await env.DB.prepare(`SELECT id FROM products WHERE aliexpress_product_id = ? AND status = 'active' AND total_stock = 0 AND replaced_by_ae IS NULL`).bind(job.aeProductId).first<{ id: number }>();
        if (p) await env.JOBS.send({ type: "replace-product", productId: p.id });
      }
      else if (job.type === "replace-product") await replaceSoldOut(env, job.productId);
      else if (job.type === "daily-report") await dailyReport(env);
      else if (job.type === "debug-call") {
        // Diagnostics only (queued by hand): log a read-only AliExpress call's reply.
        const r = await callBusiness(env, job.method, await getToken(), job.params).catch((e) => ({ error: String(e) }));
        console.log("debug-call", job.method, JSON.stringify(r).slice(0, 30000));
      }
      else if (job.type === "cj-call") {
        // Diagnostics only (queued by hand): store a read-only CJ reply in KV for 1 hour.
        const r = await cj(env, job.path, { query: job.query }).catch((e) => ({ error: String(e) }));
        await env.KV.put("cj_debug", JSON.stringify(r).slice(0, 60000), { expirationTtl: 3600 });
      }
      else if (job.type === "fulfil-order") await fulfilOrder(env, await getToken(), job.orderId);
      else if (job.type === "track-fulfilment") await trackFulfilment(env, await getToken(), job.fulfilmentId);
      else if (job.type === "vet-candidate") await vetCandidate(env, await getToken(), job.aeProductId);
      else if (job.type === "match-legacy") await matchLegacy(env, await getToken(), job.wcId);
      else if (job.type === "run-discovery") console.log("discovery", JSON.stringify(await discoverFromFeeds(env, await getToken())));
      else if (job.type === "search-discovery") console.log("search", job.keyword, JSON.stringify(await discoverFromSearch(env, await getToken(), job.keyword)));
      msg.ack();
    } catch (err) {
      const message = (err as Error).message;
      console.error(job.type, message);
      if (job.type === "ingest-product") await recordSyncError(env, job.aeProductId, message);
      // Permanent answers (cannot ship to our country, sold out, deleted): reject once, never retry.
      if (job.type === "vet-candidate" && /SHIP_TO_COUNTRY_PROHIBITED|Unsaleable|ITEM_ID_NOT_FOUND|NOT_EXIST|off.?shelf/i.test(message)) {
        await env.DB.prepare(`UPDATE ae_candidates SET status = 'rejected', reason = ?, updated_at = ? WHERE aliexpress_product_id = ?`)
          .bind(message.slice(0, 120), now(), job.aeProductId).run();
        msg.ack();
        continue;
      }
      if (job.type === "fulfil-order" && msg.attempts >= 5) {
        await env.DB.prepare(`UPDATE orders SET status = 'fulfilment_failed', updated_at = ? WHERE id = ?`).bind(now(), job.orderId).run();
        await alertOwner(env, "Supplier order failed: place it by hand", `Automatic AliExpress ordering failed 5 times (${message.slice(0, 300)}).\n\nOpen the master dashboard and place the order on AliExpress by hand:\nhttps://rizzova-edge.rizzdigital.workers.dev/console/dashboard\n`);
      }
      // Exponential backoff: 30s, 60s, 120s, ... (Queues sends to the DLQ after max_retries).
      msg.retry({ delaySeconds: Math.min(30 * 2 ** (msg.attempts - 1), 3600) });
    }
  }
}

async function fulfilOrder(env: Env, token: string, orderId: string) {
  const order = await env.DB.prepare(
    `SELECT id, order_number, status, shipping_name, shipping_phone, shipping_address_json FROM orders WHERE id = ?`,
  ).bind(orderId).first<{ id: string; order_number: string; status: string; shipping_name: string | null; shipping_phone: string | null; shipping_address_json: string | null }>();
  if (!order) throw new Error(`Order ${orderId} not found`);
  if (order.status !== "paid") return; // already handled, or not payable
  const existing = await env.DB.prepare(`SELECT 1 FROM fulfillments WHERE order_id = ? AND ae_order_id IS NOT NULL`).bind(orderId).first();
  if (existing) return; // never place the supplier order twice

  const { results: items } = await env.DB.prepare(`SELECT ae_product_id, ae_sku_attr, quantity FROM order_items WHERE order_id = ?`)
    .bind(orderId).all<{ ae_product_id: string; ae_sku_attr: string; quantity: number }>();
  const addr = JSON.parse(order.shipping_address_json ?? "{}");
  if (!addr.line1 || !addr.country) throw new Error("Order has no shipping address");

  await env.DB.prepare(`UPDATE orders SET status = 'fulfilling', updated_at = ? WHERE id = ?`).bind(now(), orderId).run();
  const aeOrderIds = await placeDsOrder(env, token, {
    outOrderId: order.order_number,
    address: {
      fullName: order.shipping_name ?? "", phone: (order.shipping_phone ?? "").replace(/[^\d]/g, ""), phoneCountry: ({ AU: "+61", US: "+1", AE: "+971", NZ: "+64" } as Record<string, string>)[addr.country] ?? "",
      line1: addr.line1, line2: addr.line2 ?? undefined, city: addr.city ?? "", province: addr.state ?? "", zip: addr.postal_code ?? "", country: addr.country,
    },
    items: items.map((i) => ({ aeProductId: i.ae_product_id, skuAttr: i.ae_sku_attr, quantity: i.quantity })),
  });
  const t = now();
  await env.DB.batch(
    aeOrderIds.map((id) =>
      env.DB.prepare(`INSERT OR IGNORE INTO fulfillments (order_id, ae_order_id, status, attempts, updated_at) VALUES (?, ?, 'placed', 1, ?)`).bind(orderId, id, t),
    ),
  );
}

async function trackFulfilment(env: Env, token: string, fulfilmentId: number) {
  const f = await env.DB.prepare(`SELECT id, order_id, ae_order_id FROM fulfillments WHERE id = ?`).bind(fulfilmentId)
    .first<{ id: number; order_id: string; ae_order_id: string | null }>();
  if (!f?.ae_order_id) return;
  const info = await getDsOrder(env, token, f.ae_order_id);
  const shipped = !!info.trackingNumber;
  const delivered = /FINISH|CONFIRM/i.test(info.status);
  const status = delivered ? "delivered" : shipped ? "shipped" : "placed";
  await env.DB.batch([
    env.DB.prepare(`UPDATE fulfillments SET status = ?, tracking_number = COALESCE(?, tracking_number), carrier = COALESCE(?, carrier), updated_at = ? WHERE id = ?`)
      .bind(status, info.trackingNumber ?? null, info.carrier ?? null, now(), f.id),
    env.DB.prepare(
      `UPDATE orders SET status = CASE
         WHEN NOT EXISTS (SELECT 1 FROM fulfillments WHERE order_id = ?1 AND status NOT IN ('delivered')) THEN 'delivered'
         WHEN NOT EXISTS (SELECT 1 FROM fulfillments WHERE order_id = ?1 AND status NOT IN ('shipped','delivered')) THEN 'shipped'
         ELSE status END, updated_at = ?2
       WHERE id = ?1 AND status IN ('fulfilling','shipped')`,
    ).bind(f.order_id, now()),
  ]);
}

// ───────────── Cron triggers ─────────────
export async function handleCron(controller: ScheduledController, env: Env): Promise<void> {
  switch (controller.cron) {
    case "*/15 * * * *": {
      const h = await tokenHealth(env);
      if (h.authorised && h.accessExpiresInHours * 3600_000 < REFRESH_WINDOW_MS) await refreshToken(env);
      // Drip-vet waiting candidates (8 per 15 min, at most ~770 a day) only while within the daily call budget.
      if (h.authorised && (await optionalCallsAllowed(env))) {
        const { results: waiting } = await env.DB.prepare(
          `SELECT aliexpress_product_id AS id FROM ae_candidates WHERE status = 'new' AND updated_at < ? ORDER BY found_at LIMIT 8`,
        ).bind(now() - 3600_000).all<{ id: string }>();
        if (waiting.length) {
          await env.DB.batch(waiting.map((w) => env.DB.prepare(`UPDATE ae_candidates SET updated_at = ? WHERE aliexpress_product_id = ?`).bind(now(), w.id)));
          await env.JOBS.sendBatch(waiting.map((w) => ({ body: { type: "vet-candidate" as const, aeProductId: w.id } })));
        }
      }
      if (h.authorised && h.refreshExpiresInDays !== null && h.refreshExpiresInDays < 7) {
        console.warn(`AliExpress refresh token expires in ${h.refreshExpiresInDays} days – re-authorise at /oauth/aliexpress/start`);
      }
      return;
    }
    case "0 */6 * * *": {
      // The 00:00 UTC run (11 am Sydney): the store emails its own daily report, no Claude needed.
      if (new Date(controller.scheduledTime).getUTCHours() === 0) await dailyReport(env).catch((e) => console.error("daily report", (e as Error).message));
      const { results } = await env.DB.prepare(
        `SELECT aliexpress_product_id AS id FROM import_queue WHERE attempts < 5
         UNION ALL
         SELECT id FROM (SELECT aliexpress_product_id AS id FROM products WHERE status <> 'archived' ORDER BY last_synced_at ASC LIMIT ?)`,
      ).bind(SYNC_BATCH).all<{ id: string }>();
      const ids = [...new Set(results.map((r) => r.id))];
      for (let i = 0; i < ids.length; i += 100) {
        await env.JOBS.sendBatch(ids.slice(i, i + 100).map((id) => ({ body: { type: "ingest-product" as const, aeProductId: id } })));
      }
      return;
    }
    case "0 13 * * *": {
      // Midnight in Sydney (AEDT). Shares this slot because the free plan allows 5 crons per account.
      const r = await discoverFromFeeds(env, await getAccessToken(env)).catch((err) => {
        console.error("discovery", (err as Error).message);
        return null;
      });
      if (r) console.log(`discovery: ${r.found} feed items, ${r.queued} new candidates queued for vetting`);
      // Best-seller keyword searches, one job each so every search gets its own call budget.
      await queueSoldOutRetries(env);
      const keywords = discoveryKeywords(env);
      if (keywords.length) await env.JOBS.sendBatch(keywords.map((keyword) => ({ body: { type: "search-discovery" as const, keyword } })));
      const { results } = await env.DB.prepare(`SELECT id FROM fulfillments WHERE status IN ('placed','shipped') LIMIT 500`).all<{ id: number }>();
      for (let i = 0; i < results.length; i += 100) {
        await env.JOBS.sendBatch(results.slice(i, i + 100).map((r) => ({ body: { type: "track-fulfilment" as const, fulfilmentId: r.id } })));
      }
      return;
    }
  }
}
