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
