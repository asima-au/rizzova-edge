import { Hono } from "hono";
import type { Env } from "../env";
import { now } from "../lib/util";
import { tokenHealth } from "../aliexpress/auth";
import { requireAdmin } from "./admin";

/**
 * Owner master dashboard: /console/dashboard (signed in through /console).
 * Live from D1 on every load: what needs action, orders and payments, fulfilment, catalogue and connections.
 */
export const dashboard = new Hono<{ Bindings: Env }>();
dashboard.use("*", requireAdmin);

/** Stripe went live on 19 Nov 2026 03:40 UTC; earlier orders were test-mode payments. */
const LIVE_SINCE = Date.UTC(2026, 10, 19, 3, 40);
const DAY = 86_400_000;

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
const money = (cents: number | null | undefined) => `A$${((cents ?? 0) / 100).toFixed(2)}`;
const date = (ms: number) => new Date(ms).toLocaleString("en-AU", { timeZone: "Australia/Sydney", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

interface OrderRow {
  id: string; order_number: string; status: string; total_cents: number; created_at: number;
  shipping_name: string | null; country: string | null; items: number; tracking: string | null; ae_order: string | null;
}

dashboard.get("/", async (c) => {
  const db = c.env.DB;
  const t = now();
  const [orders, toFulfil, products, copy, sugg, fulfil] = await db.batch([
    db.prepare(
      `SELECT o.id, o.order_number, o.status, o.total_cents, o.created_at, o.shipping_name,
              json_extract(o.shipping_address_json, '$.country') AS country,
              (SELECT SUM(quantity) FROM order_items WHERE order_id = o.id) AS items,
              (SELECT tracking_number FROM fulfillments WHERE order_id = o.id AND tracking_number IS NOT NULL LIMIT 1) AS tracking,
              (SELECT ae_order_id FROM fulfillments WHERE order_id = o.id LIMIT 1) AS ae_order
       FROM orders o ORDER BY o.created_at DESC LIMIT 200`,
    ),
    db.prepare(
      `SELECT o.order_number, o.id, i.title, i.ae_product_id, i.ae_sku_attr, i.quantity, i.unit_cost_cents
       FROM orders o JOIN order_items i ON i.order_id = o.id
       WHERE o.status = 'paid' AND o.created_at >= ? AND NOT EXISTS (SELECT 1 FROM fulfillments f WHERE f.order_id = o.id AND f.ae_order_id IS NOT NULL)
       ORDER BY o.created_at`,
    ).bind(LIVE_SINCE),
    db.prepare(
      `SELECT status, COUNT(*) AS n, SUM(total_stock = 0) AS out_of_stock, MIN(min_price_cents) AS lo, MAX(min_price_cents) AS hi
       FROM products GROUP BY status`,
    ),
    db.prepare(`SELECT status, COUNT(*) AS n FROM product_copy GROUP BY status`),
    db.prepare(`SELECT COUNT(*) AS n FROM ae_candidates WHERE status = 'passed'`),
    db.prepare(`SELECT status, COUNT(*) AS n FROM fulfillments GROUP BY status`),
  ]);

  const all = (orders?.results ?? []) as OrderRow[];
  const isTest = (o: OrderRow) => o.created_at < LIVE_SINCE || /^TEST ORDER/i.test(o.shipping_name ?? "");
  const live = all.filter((o) => !isTest(o));
  const paidStates = new Set(["paid", "fulfilling", "shipped", "delivered"]);
  const revenue = (days: number) => live.filter((o) => paidStates.has(o.status) && o.created_at >= t - days * DAY).reduce((n, o) => n + o.total_cents, 0);
  const count = (s: string) => live.filter((o) => o.status === s).length;
  const lines = (toFulfil?.results ?? []) as { order_number: string; id: string; title: string; ae_product_id: string; ae_sku_attr: string; quantity: number; unit_cost_cents: number }[];
  const prodRows = (products?.results ?? []) as { status: string; n: number; out_of_stock: number; lo: number; hi: number }[];
  const active = prodRows.find((r) => r.status === "active");
  const copyRows = (copy?.results ?? []) as { status: string; n: number }[];
  const drafts = copyRows.find((r) => r.status === "draft")?.n ?? 0;
  const suggestions = ((sugg?.results ?? [])[0] as { n: number } | undefined)?.n ?? 0;
  const fulfilRows = (fulfil?.results ?? []) as { status: string; n: number }[];
  const ae = await tokenHealth(c.env).catch(() => ({ authorised: false as const }));
  const key = c.env.STRIPE_SECRET_KEY ?? "";
  const stripeMode = !key ? "missing" : /^(sk|rk)_live_/.test(key) ? "live" : "test";

  const pill = (text: string, tone: "good" | "warn" | "bad" | "muted") => `<span class="pill ${tone}">${esc(text)}</span>`;
  const statusTone: Record<string, "good" | "warn" | "bad" | "muted"> = {
    paid: "warn", fulfilling: "warn", shipped: "good", delivered: "good", pending: "muted", cancelled: "muted", refunded: "muted", fulfilment_failed: "bad",
  };
  const actions: string[] = [];
  if (lines.length) actions.push(`${pill(`${new Set(lines.map((l) => l.id)).size} to order`, "bad")} Paid orders waiting to be placed on AliExpress (below).`);
  if (count("fulfilment_failed")) actions.push(`${pill(`${count("fulfilment_failed")} failed`, "bad")} Supplier order failed: place it by hand.`);
  if (drafts) actions.push(`${pill(`${drafts} titles`, "warn")} New product titles waiting for approval. <a href="/console/titles">Review</a>`);
  if (suggestions) actions.push(`${pill(`${suggestions} products`, "warn")} Product suggestions waiting. <a href="/console/suggestions">Review</a>`);
  if (!ae.authorised || ("refreshExpiresInDays" in ae && ae.refreshExpiresInDays !== null && ae.refreshExpiresInDays < 0)) {
    actions.push(`${pill("AliExpress", "bad")} Not connected. <a href="/oauth/aliexpress/start">Connect</a>`);
  }
  if (stripeMode !== "live") actions.push(`${pill("Stripe", "bad")} Payments are in ${stripeMode} mode.`);

  const toFulfilHtml = lines.length
    ? `<table><thead><tr><th>Order</th><th>Product</th><th>Option</th><th>Qty</th><th>Supplier cost</th><th></th></tr></thead><tbody>${lines.map((l) => `<tr>
<td>${esc(l.order_number)}</td><td>${esc(l.title.slice(0, 70))}</td><td><small>${esc(l.ae_sku_attr)}</small></td><td>${l.quantity}</td><td>${money(l.unit_cost_cents * l.quantity)}</td>
<td>${l.ae_product_id.startsWith("CJ-") ? `<a href="https://cjdropshipping.com/product/p-${esc(l.ae_product_id.slice(3))}.html" target="_blank" rel="noopener">Open on CJ</a> <small>(SKU ${esc(l.ae_sku_attr)})</small>` : `<a href="https://www.aliexpress.com/item/${esc(l.ae_product_id)}.html" target="_blank" rel="noopener">Open on AliExpress</a>`}</td></tr>`).join("")}</tbody></table>
<form method="post" action="/console/dashboard/placed" class="inline"><label>Order number <input name="order" placeholder="RZ-240005" required></label>
<label>AliExpress order ID <input name="ae" placeholder="8123456789012345" required></label><button type="submit">Mark as ordered</button></form>
<p class="note">After you place the order on AliExpress, enter its order ID here. The store then checks tracking every night and marks the order shipped and delivered.</p>`
    : `<p class="ok">Nothing to order. Every paid order has a supplier order.</p>`;

  const ordersHtml = all.length
    ? `<table><thead><tr><th>Order</th><th>Date</th><th>Status</th><th>Total</th><th>Country</th><th>Items</th><th>Tracking</th></tr></thead><tbody>${all.slice(0, 50).map((o) => `<tr${isTest(o) ? ' class="test"' : ""}>
<td>${esc(o.order_number)}${isTest(o) ? " <small>(test)</small>" : ""}</td><td>${date(o.created_at)}</td><td>${pill(o.status.replace("_", " "), statusTone[o.status] ?? "muted")}</td>
<td>${money(o.total_cents)}</td><td>${esc(o.country ?? "")}</td><td>${o.items ?? 0}</td><td>${o.tracking ? `<a href="https://t.17track.net/en#nums=${esc(o.tracking)}" target="_blank" rel="noopener">${esc(o.tracking)}</a>` : ""}</td></tr>`).join("")}</tbody></table>`
    : "<p>No orders yet.</p>";

  const body = `
<header><h1>Rizzova dashboard</h1><p>Live, ${date(t)} Sydney time · <a href="/console/home">Console</a> · <a href="${esc(c.env.PUBLIC_SITE_URL)}" target="_blank" rel="noopener">Store</a></p></header>
<section><h2>Needs your action</h2>${actions.length ? `<ul class="actions">${actions.map((a) => `<li>${a}</li>`).join("")}</ul>` : `<p class="ok">All clear.</p>`}</section>
<section class="tiles">
  <div><span>Revenue, 7 days</span><b>${money(revenue(7))}</b></div>
  <div><span>Revenue, 30 days</span><b>${money(revenue(30))}</b></div>
  <div><span>Revenue, all time</span><b>${money(revenue(36500))}</b></div>
  <div><span>To order on AliExpress</span><b>${new Set(lines.map((l) => l.id)).size}</b></div>
  <div><span>Shipped</span><b>${count("shipped")}</b></div>
  <div><span>Delivered</span><b>${count("delivered")}</b></div>
  <div><span>Unpaid checkouts</span><b>${count("pending")}</b></div>
  <div><span>Refunded / cancelled</span><b>${count("refunded") + count("cancelled")}</b></div>
</section>
<section><h2>To order on AliExpress</h2>${toFulfilHtml}</section>
<section><h2>Orders</h2><p class="note">Revenue counts paid live orders only. Orders from before Stripe went live (19 Nov) and labelled test orders are marked "(test)".</p>${ordersHtml}</section>
<section class="two">
  <div><h2>Catalogue</h2><ul>
    <li>${active?.n ?? 0} live products${active?.out_of_stock ? `, ${pill(`${active.out_of_stock} out of stock`, "warn")}` : ""}</li>
    <li>Prices ${money(active?.lo)} to ${money(active?.hi)}</li>
    <li>${prodRows.filter((r) => r.status !== "active").map((r) => `${r.n} ${esc(r.status)}`).join(", ") || "None archived"}</li>
    <li>Titles: ${copyRows.map((r) => `${r.n} ${esc(r.status)}`).join(", ") || "no drafts yet"}</li>
    <li>${suggestions} product suggestions waiting</li></ul></div>
  <div><h2>Connections</h2><ul>
    <li>Stripe payments: ${pill(stripeMode, stripeMode === "live" ? "good" : "bad")}</li>
    <li>AliExpress: ${ae.authorised ? pill(`connected, renews automatically`, "good") : pill("not connected", "bad")}</li>
    <li>Supplier orders: ${fulfilRows.map((r) => `${r.n} ${esc(r.status)}`).join(", ") || "none yet"}</li>
    <li>Automatic supplier ordering: ${pill(c.env.AUTO_FULFIL === "on" ? "on" : "off (you place orders)", c.env.AUTO_FULFIL === "on" ? "good" : "muted")}</li>
    <li>Automatic product import: ${pill(c.env.AUTO_IMPORT === "on" ? "on" : "off (you approve)", "muted")}</li></ul></div>
</section>`;

  return c.html(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="120"><title>Rizzova dashboard</title><style>
:root{--bg:#f7f2e8;--card:#fff;--fg:#2a1645;--muted:#6b5d7d;--gold:#c9a14a;--good:#2f6b3a;--warn:#8a5a00;--bad:#b03a2e;--line:rgba(42,22,69,.12)}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;padding:24px max(16px,env(safe-area-inset-left,0px)) 48px max(16px,env(safe-area-inset-right,0px))}
main{max-width:1180px;margin:0 auto;display:grid;gap:20px}header h1{margin:0;font:600 28px Georgia,serif}header p{margin:4px 0 0;color:var(--muted)}
section{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px;min-width:0;overflow-x:auto}h2{margin:0 0 10px;font:600 18px Georgia,serif}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:10px;background:none;border:0;padding:0}
.tiles div{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px}.tiles span{display:block;color:var(--muted);font-size:13px}.tiles b{font-size:22px;font-variant-numeric:tabular-nums}
.two{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;background:none;border:0;padding:0}.two>div{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px}
ul{margin:0;padding-left:18px}li{margin:4px 0}.actions{list-style:none;padding:0}
table{width:100%;border-collapse:collapse;font-size:14px;font-variant-numeric:tabular-nums}th,td{text-align:left;padding:7px 8px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--muted);font-weight:600}
tr.test td{color:var(--muted)}.pill{display:inline-block;padding:1px 9px;border-radius:999px;font-size:12px;font-weight:700;margin-right:6px}
.good{background:#e3f0e4;color:var(--good)}.warn{background:#f8ecd2;color:var(--warn)}.bad{background:#f7dedb;color:var(--bad)}.muted{background:#ece8f1;color:var(--muted)}
.ok{color:var(--good);margin:0}.note{color:var(--muted);font-size:13px}a{color:var(--fg)}
.inline{display:flex;flex-wrap:wrap;gap:10px;align-items:end;margin-top:12px}.inline input{display:block;padding:8px;border:1px solid var(--line);border-radius:8px}
button{background:var(--gold);border:0;border-radius:999px;padding:9px 18px;font-weight:700;color:var(--fg);cursor:pointer}
</style></head><body><main>${body}</main></body></html>`);
});

/** Record a supplier order placed by hand; the nightly tracking job then follows it. */
dashboard.post("/placed", async (c) => {
  const form = await c.req.parseBody();
  const orderNumber = String(form.order ?? "").trim().toUpperCase();
  const aeOrder = String(form.ae ?? "").replace(/\D/g, "");
  const order = await c.env.DB.prepare(`SELECT id, status FROM orders WHERE order_number = ?`).bind(orderNumber).first<{ id: string; status: string }>();
  if (!order || !aeOrder) return c.redirect("/console/dashboard", 303);
  const t = now();
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT OR IGNORE INTO fulfillments (order_id, ae_order_id, status, attempts, updated_at) VALUES (?, ?, 'placed', 1, ?)`).bind(order.id, aeOrder, t),
    c.env.DB.prepare(`UPDATE orders SET status = 'fulfilling', updated_at = ? WHERE id = ? AND status = 'paid'`).bind(t, order.id),
  ]);
  return c.redirect("/console/dashboard", 303);
});
