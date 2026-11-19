import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import type { Env } from "../env";
import { now, safeEqual } from "../lib/util";
import { requireAdmin, ADMIN_COOKIE } from "./admin";

/** Owner console: sign in once with the admin password, then use buttons instead of hand-edited links. */
export const consoleApp = new Hono<{ Bindings: Env }>();

const page = (body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
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
