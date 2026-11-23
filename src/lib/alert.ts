import { EmailMessage } from "cloudflare:email";
import type { Env } from "../env";

/**
 * Plain-text email to the owner through Cloudflare Email Routing (free).
 * ALERT_TO must be a verified destination address in rizzova.com's Email Routing.
 * Never throws: an alert that cannot be sent must not fail the order it reports.
 */
export async function alertOwner(env: Env, subject: string, text: string): Promise<void> {
  if (!env.ALERT_EMAIL || !env.ALERT_TO) return;
  const from = "alerts@rizzova.com";
  const clean = (v: string) => v.replace(/[\r\n]+/g, " ").slice(0, 200);
  const raw = [
    `From: Rizzova Alerts <${from}>`,
    `To: ${env.ALERT_TO}`,
    `Subject: ${clean(subject)}`,
    `Message-ID: <${crypto.randomUUID()}@rizzova.com>`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    text,
  ].join("\r\n");
  try {
    await env.ALERT_EMAIL.send(new EmailMessage(from, env.ALERT_TO, raw));
  } catch (err) {
    console.error("owner alert not sent", (err as Error).message);
  }
}

const DASHBOARD = "https://rizzova-edge.rizzdigital.workers.dev/console/dashboard";

/** New live paid order: what to order on AliExpress. No customer address in the email; it is on the dashboard. */
export async function alertNewOrder(env: Env, orderId: string): Promise<void> {
  const order = await env.DB.prepare(`SELECT order_number, total_cents, json_extract(shipping_address_json, '$.country') AS country FROM orders WHERE id = ?`)
    .bind(orderId).first<{ order_number: string; total_cents: number; country: string | null }>();
  if (!order) return;
  const { results } = await env.DB.prepare(`SELECT title, quantity FROM order_items WHERE order_id = ?`).bind(orderId).all<{ title: string; quantity: number }>();
  const items = results.map((i) => `- ${i.quantity} x ${i.title.slice(0, 90)}`).join("\n");
  await alertOwner(
    env,
    `New order ${order.order_number}: A$${(order.total_cents / 100).toFixed(2)}`,
    `You have a new paid order on rizzova.com.\n\nOrder: ${order.order_number}\nTotal: A$${(order.total_cents / 100).toFixed(2)}\nShip to: ${order.country ?? "see dashboard"}\n\n${items}\n\nPlace it on AliExpress from the master dashboard, then click "Mark as ordered":\n${DASHBOARD}\n`,
  );
}

/**
 * Daily store report emailed by the store itself (no Claude needed), from the 00:00 UTC (11 am Sydney) cron.
 * Counts only, no customer details. The subject starts with "ACTION NEEDED" when something waits on the owner.
 */
export async function dailyReport(env: Env): Promise<void> {
  const since = Date.UTC(2026, 10, 19, 3, 40); // Stripe live; earlier orders were tests
  const LIVE = `created_at >= ${since} AND COALESCE(shipping_name,'') NOT LIKE 'TEST ORDER%'`;
  const PAID = `status IN ('paid','fulfilling','shipped','delivered')`;
  const one = <T>(sql: string) => env.DB.prepare(sql).first<T>();
  const [day, week, toOrder, failed, stock, ae] = await Promise.all([
    one<{ n: number; c: number }>(`SELECT COUNT(*) n, COALESCE(SUM(total_cents),0) c FROM orders WHERE ${LIVE} AND ${PAID} AND created_at >= ${Date.now() - 86_400_000}`),
    one<{ n: number; c: number }>(`SELECT COUNT(*) n, COALESCE(SUM(total_cents),0) c FROM orders WHERE ${LIVE} AND ${PAID} AND created_at >= ${Date.now() - 7 * 86_400_000}`),
    one<{ n: number }>(`SELECT COUNT(*) n FROM orders o WHERE o.status = 'paid' AND o.created_at >= ${since} AND COALESCE(o.shipping_name,'') NOT LIKE 'TEST ORDER%'
      AND NOT EXISTS (SELECT 1 FROM fulfillments f WHERE f.order_id = o.id AND f.ae_order_id IS NOT NULL)`),
    one<{ n: number }>(`SELECT COUNT(*) n FROM orders WHERE ${LIVE} AND status = 'fulfilment_failed'`),
    one<{ live: number; hidden: number }>(`SELECT SUM(status = 'active') live, SUM(status = 'unavailable' AND total_stock = 0) hidden FROM products`),
    one<{ expires_at: number }>(`SELECT expires_at FROM auth_tokens LIMIT 1`),
  ]);
  const aud = (c: number) => `A$${(c / 100).toFixed(2)}`;
  const aeOk = !!ae && ae.expires_at > Date.now();
  const actions: string[] = [];
  if ((toOrder?.n ?? 0) > 0) actions.push(`- ${toOrder!.n} paid order(s) to place on AliExpress: ${DASHBOARD}`);
  if ((failed?.n ?? 0) > 0) actions.push(`- ${failed!.n} order(s) failed at the supplier: ${DASHBOARD}`);
  if (!aeOk) actions.push(`- AliExpress is disconnected: open https://rizzova-edge.rizzdigital.workers.dev/oauth/aliexpress/start in an InPrivate window`);
  const subject = actions.length ? "ACTION NEEDED: Rizzova daily report" : `Rizzova daily report: ${day?.n ?? 0} order(s), ${aud(day?.c ?? 0)}`;
  await alertOwner(env, subject, [
    actions.length ? `Needs you:\n${actions.join("\n")}\n` : "All clear: nothing waiting on you.\n",
    `Last 24 hours: ${day?.n ?? 0} paid order(s), ${aud(day?.c ?? 0)}`,
    `Last 7 days: ${week?.n ?? 0} paid order(s), ${aud(week?.c ?? 0)}`,
    `Live products: ${stock?.live ?? 0} (sold out and hidden: ${stock?.hidden ?? 0})`,
    `AliExpress connection: ${aeOk ? "OK" : "DISCONNECTED"}`,
    `AliExpress requests yesterday: ${(await env.DB.prepare(`SELECT n FROM api_usage WHERE day = ?`).bind(new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)).first<{ n: number }>())?.n ?? 0} (optional work stops at 2,500 a day)`,
    "",
    `Live dashboard: ${DASHBOARD}`,
    "This email is sent by the store itself every day at about 11 am Sydney time.",
  ].join("\n"));
}
