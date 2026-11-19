import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import type { Env } from "../env";
import { now, safeEqual } from "../lib/util";
import { requireAdmin, ADMIN_COOKIE } from "./admin";
import { alertOwner } from "../lib/alert";

/** Owner console: sign in once with the admin password, then use buttons instead of hand-edited links. */
export const consoleApp = new Hono<{ Bindings: Env }>();

export const page = (body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Rizzova admin</title>
<style>body{font-family:system-ui,sans-serif;max-width:440px;margin:48px auto;padding:0 16px;background:#faf8fc;color:#241534}
h1{font-size:22px}a.b,button{display:block;width:100%;box-sizing:border-box;margin:10px 0;padding:14px;border:0;border-radius:10px;
background:#4b2a7b;color:#fff;font-size:16px;text-align:center;text-decoration:none;cursor:pointer}
input{width:100%;box-sizing:border-box;padding:12px;font-size:16px;border:1px solid #bbb;border-radius:10px}
.err{color:#b00020}p{line-height:1.5}</style></head><body>${body}</body></html>`;

consoleApp.get("/", (c) => c.html(page(`<h1>Rizzova admin</h1>
${c.req.query("e") ? `<p class="err">That password didn't match. Try again.</p>` : ""}
<form method="post"><p>Admin password (the ADMIN_TOKEN you saved in Cloudflare):</p>
<input type="password" name="password" autocomplete="current-password" required autofocus>
<button type="submit">Sign in</button></form>`)));

consoleApp.post("/", async (c) => {
  const form = await c.req.parseBody();
  const password = String(form.password ?? "");
  if (!c.env.ADMIN_TOKEN || !password || !safeEqual(password, c.env.ADMIN_TOKEN)) return c.redirect("/console?e=1", 303);
  setCookie(c, ADMIN_COOKIE, password, { httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: 7 * 86400 });
  return c.redirect("/console/home", 303);
});

consoleApp.get("/home", requireAdmin, (c) => c.html(page(`<h1>Rizzova admin</h1>
<p>Signed in for 7 days on this browser.</p>
<a class="b" href="/oauth/aliexpress/start">1. Connect AliExpress</a>
<a class="b" href="/oauth/aliexpress/health">2. Check the AliExpress connection</a>
<a class="b" href="/admin/discovery/run">3. Import products now</a>
<a class="b" href="/admin/candidates">4. See import results</a>
<a class="b" href="/console/dashboard" style="background:#c9a14a;color:#241534">Master dashboard</a>
<form method="post" action="/console/test-alert"><button type="submit">Send me a test alert email</button></form>
<a class="b" href="/console/suggestions">New product suggestions (approve before they go live)</a>
<a class="b" href="/console/titles">Review new product titles (Rizz AI)</a>
<a class="b" href="/admin/stripe/status">Check Stripe payments (test or live)</a>
<form method="post" action="/admin/stripe/setup"><button type="submit">Connect Stripe payments (run after changing the key)</button></form>
<form method="post" action="/console/legacy/match"><button type="submit">Find my old Hostinger products on AliExpress</button></form>
<form method="post" action="/console/legacy/import"><button type="submit">Add the matched old products to the store</button></form>
<a class="b" href="/console/legacy">See old-product matching results</a>
<form method="post" action="/console/add"><p><b>Add products you picked:</b> paste AliExpress product links, one per line.</p>
<textarea name="links" rows="5" style="width:100%;box-sizing:border-box;font-size:14px;border:1px solid #bbb;border-radius:10px;padding:10px"
placeholder="https://www.aliexpress.com/item/1005008783400471.html"></textarea>
<button type="submit">Add these products</button></form>
<a class="b" href="${c.env.PUBLIC_SITE_URL}">Open the store</a>`)));

/** Owner-picked products: pull the ids out of pasted AliExpress links and queue them for import. */
consoleApp.post("/add", requireAdmin, async (c) => {
  const form = await c.req.parseBody();
  const text = String(form.links ?? "");
  const ids = [...new Set([...text.matchAll(/(?:item\/|productIds=|^|\s)(\d{12,20})(?:\.html|\b)/gm)].map((m) => m[1]!))].slice(0, 50);
  if (ids.length === 0) {
    return c.html(page(`<h1>No products found</h1><p>Paste links that look like aliexpress.com/item/1005….html</p><a class="b" href="/console/home">Back</a>`));
  }
  const t = now();
  await c.env.DB.batch(ids.map((id) => c.env.DB.prepare(`INSERT OR IGNORE INTO import_queue (aliexpress_product_id, requested_at) VALUES (?, ?)`).bind(id, t)));
  await c.env.JOBS.sendBatch(ids.map((id) => ({ body: { type: "ingest-product" as const, aeProductId: id } })));
  return c.html(page(`<h1>Adding ${ids.length} product${ids.length > 1 ? "s" : ""}</h1>
<p>They appear on the store within a few minutes: ${ids.join(", ")}</p>
<a class="b" href="${c.env.PUBLIC_SITE_URL}">Open the store</a><a class="b" href="/console/home">Back</a>`));
});

/** Queue every old product not yet matched (Halloween items skipped: out of season). */
consoleApp.post("/legacy/match", requireAdmin, async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT wc_id FROM legacy_products WHERE status = 'new' AND halloween = 0`).all<{ wc_id: number }>();
  for (let i = 0; i < results.length; i += 100) {
    await c.env.JOBS.sendBatch(results.slice(i, i + 100).map((r) => ({ body: { type: "match-legacy" as const, wcId: r.wc_id } })));
  }
  return c.html(page(`<h1>Matching ${results.length} products</h1><p>This runs in the background and takes about 10–20 minutes.</p>
<a class="b" href="/console/legacy">See results</a><a class="b" href="/console/home">Back</a>`));
});

consoleApp.post("/legacy/import", requireAdmin, async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT wc_id, ae_product_id FROM legacy_products WHERE status = 'matched'`).all<{ wc_id: number; ae_product_id: string }>();
  const t = now();
  for (let i = 0; i < results.length; i += 50) {
    const chunk = results.slice(i, i + 50);
    await c.env.DB.batch(chunk.flatMap((r) => [
      c.env.DB.prepare(`INSERT OR IGNORE INTO import_queue (aliexpress_product_id, requested_at) VALUES (?, ?)`).bind(r.ae_product_id, t),
      c.env.DB.prepare(`UPDATE legacy_products SET status = 'imported', updated_at = ? WHERE wc_id = ?`).bind(t, r.wc_id),
    ]));
    await c.env.JOBS.sendBatch(chunk.map((r) => ({ body: { type: "ingest-product" as const, aeProductId: r.ae_product_id } })));
  }
  return c.html(page(`<h1>Adding ${results.length} products</h1><p>They appear on the store within a few minutes.</p>
<a class="b" href="${c.env.PUBLIC_SITE_URL}">Open the store</a><a class="b" href="/console/home">Back</a>`));
});

consoleApp.get("/legacy", requireAdmin, async (c) => {
  const { results: counts } = await c.env.DB.prepare(`SELECT status, COUNT(*) AS n FROM legacy_products GROUP BY status`).all<{ status: string; n: number }>();
  const { results: rows } = await c.env.DB.prepare(`SELECT title, status, ae_product_id, note FROM legacy_products WHERE status <> 'new' ORDER BY updated_at DESC LIMIT 300`).all<{ title: string; status: string; ae_product_id: string | null; note: string | null }>();
  const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
  return c.html(page(`<h1>Old products</h1><p>${counts.map((r) => `${r.status}: <b>${r.n}</b>`).join(" · ")}</p>
<ul style="padding-left:18px">${rows.map((r) => `<li><b>${r.status}</b> – ${esc(r.title)}${r.ae_product_id ? ` – <a href="https://www.aliexpress.com/item/${r.ae_product_id}.html" target="_blank" rel="noopener">AliExpress</a>` : ""}<br><small>${esc(r.note ?? "")}</small></li>`).join("")}</ul>
<a class="b" href="/console/home">Back</a>`));
});

/** Rizz AI drafts (product_copy): original vs new title, editable, approve or reject. Only approved copy shows on the store. */
consoleApp.get("/titles", requireAdmin, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT pc.product_id AS id, p.title AS original, pc.title, pc.summary FROM product_copy pc JOIN products p ON p.id = pc.product_id
     WHERE pc.status = 'draft' ORDER BY pc.updated_at DESC LIMIT 100`,
  ).all<{ id: number; original: string; title: string; summary: string | null }>();
  const { results: counts } = await c.env.DB.prepare(`SELECT status, COUNT(*) AS n FROM product_copy GROUP BY status`).all<{ status: string; n: number }>();
  const esc = (v: string) => v.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
  const rows = results.map((r) => `<li style="margin:0 0 18px;padding:12px;border:1px solid #ddd;border-radius:12px;background:#fff">
<small style="color:#6b5d7d">Was: ${esc(r.original)}</small>
<input name="title_${r.id}" value="${esc(r.title)}" maxlength="120" style="margin-top:6px">
${r.summary ? `<small>${esc(r.summary)}</small>` : ""}
<p style="margin:8px 0 0"><label><input type="radio" name="do_${r.id}" value="approve" checked style="width:auto"> Approve</label>
&nbsp; <label><input type="radio" name="do_${r.id}" value="reject" style="width:auto"> Reject</label>
&nbsp; <label><input type="radio" name="do_${r.id}" value="later" style="width:auto"> Later</label></p></li>`).join("");
  return c.html(page(`<h1>New product titles</h1>
<p>${counts.map((r) => `${r.status}: <b>${r.n}</b>`).join(" · ") || "No drafts yet."} Rizz AI writes 25 more every 6 hours.</p>
${results.length ? `<form method="post"><p>Edit any title, then save. Approved titles and descriptions replace the AliExpress ones on the store.</p><ul style="padding:0;list-style:none">${rows}</ul><button type="submit">Save</button></form>` : "<p>Nothing waiting for review.</p>"}
<a class="b" href="/console/home">Back</a>`));
});

consoleApp.post("/titles", requireAdmin, async (c) => {
  const form = await c.req.parseBody();
  const t = now();
  const stmts: D1PreparedStatement[] = [];
  for (const [key, value] of Object.entries(form)) {
    const m = key.match(/^do_(\d+)$/);
    if (!m || value === "later") continue;
    const id = Number(m[1]);
    const title = String(form[`title_${id}`] ?? "").trim().slice(0, 120);
    if (value === "approve" && title) {
      stmts.push(c.env.DB.prepare(`UPDATE product_copy SET title = ?, status = 'approved', updated_at = ? WHERE product_id = ? AND status = 'draft'`).bind(title, t, id));
    } else if (value === "reject") {
      stmts.push(c.env.DB.prepare(`UPDATE product_copy SET status = 'rejected', updated_at = ? WHERE product_id = ? AND status = 'draft'`).bind(t, id));
    }
  }
  const res = stmts.length ? await c.env.DB.batch(stmts) : [];
  const changed = res.reduce((n, r) => n + (r.meta.changes ?? 0), 0);
  return c.html(page(`<h1>Saved</h1><p>${changed} product${changed === 1 ? "" : "s"} updated. Approved titles show on the store within a few minutes.</p>
<a class="b" href="/console/titles">Review more</a><a class="b" href="/console/home">Back</a>`));
});

/** Products that passed the nightly checks wait here; nothing is imported until the owner approves it. */
consoleApp.get("/suggestions", requireAdmin, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT aliexpress_product_id AS id, feed, rating, orders FROM ae_candidates WHERE status = 'passed' ORDER BY updated_at DESC LIMIT 100`,
  ).all<{ id: string; feed: string | null; rating: number | null; orders: number | null }>();
  const rows = results.map((r) => `<li style="margin:0 0 12px;padding:12px;border:1px solid #ddd;border-radius:12px;background:#fff">
<a href="https://www.aliexpress.com/item/${r.id}.html" target="_blank" rel="noopener">View on AliExpress</a>
<small> · ${r.rating ?? "?"}★ · ${r.orders ?? "?"} orders · ${r.feed ?? ""}</small>
<p style="margin:8px 0 0"><label><input type="radio" name="do_${r.id}" value="add" style="width:auto"> Add to store</label>
&nbsp; <label><input type="radio" name="do_${r.id}" value="skip" style="width:auto"> Skip</label>
&nbsp; <label><input type="radio" name="do_${r.id}" value="later" checked style="width:auto"> Later</label></p></li>`).join("");
  return c.html(page(`<h1>Product suggestions</h1>
<p>These passed the checks (4.7★+, low delivery cost, under A$${(Number(c.env.DISCOVERY_MAX_PRICE_CENTS) || 6000) / 100}, no risky types). Nothing goes live until you add it.</p>
${results.length ? `<form method="post"><ul style="padding:0;list-style:none">${rows}</ul><button type="submit">Save</button></form>` : "<p>No suggestions waiting.</p>"}
<a class="b" href="/console/home">Back</a>`));
});

consoleApp.post("/suggestions", requireAdmin, async (c) => {
  const form = await c.req.parseBody();
  const t = now();
  const add: string[] = [];
  const stmts: D1PreparedStatement[] = [];
  for (const [key, value] of Object.entries(form)) {
    const m = key.match(/^do_(\d{6,20})$/);
    if (!m) continue;
    if (value === "add") {
      add.push(m[1]!);
      stmts.push(c.env.DB.prepare(`INSERT OR IGNORE INTO import_queue (aliexpress_product_id, requested_at) VALUES (?, ?)`).bind(m[1], t));
      stmts.push(c.env.DB.prepare(`UPDATE ae_candidates SET status = 'imported', updated_at = ? WHERE aliexpress_product_id = ?`).bind(t, m[1]));
    } else if (value === "skip") {
      stmts.push(c.env.DB.prepare(`UPDATE ae_candidates SET status = 'rejected', reason = 'skipped by owner', updated_at = ? WHERE aliexpress_product_id = ?`).bind(t, m[1]));
    }
  }
  if (stmts.length) await c.env.DB.batch(stmts);
  if (add.length) await c.env.JOBS.sendBatch(add.map((id) => ({ body: { type: "ingest-product" as const, aeProductId: id } })));
  return c.html(page(`<h1>Saved</h1><p>${add.length} product${add.length === 1 ? "" : "s"} being added; they appear on the store within a few minutes.</p>
<a class="b" href="/console/suggestions">Back to suggestions</a><a class="b" href="/console/home">Home</a>`));
});

consoleApp.post("/test-alert", requireAdmin, async (c) => {
  if (!c.env.ALERT_EMAIL || !c.env.ALERT_TO) return c.html(page(`<h1>Alerts not set up</h1><p>The alert email address is missing.</p><a class="b" href="/console/home">Back</a>`));
  await alertOwner(c.env, "Rizzova test alert", "This is a test. Urgent store alerts (new paid orders, failed supplier orders) will arrive like this.\n\nMaster dashboard: https://rizzova-edge.rizzdigital.workers.dev/console/dashboard\n");
  return c.html(page(`<h1>Test alert sent</h1><p>Check your inbox (and spam folder) for "Rizzova test alert" from alerts@rizzova.com.</p><a class="b" href="/console/home">Back</a>`));
});
