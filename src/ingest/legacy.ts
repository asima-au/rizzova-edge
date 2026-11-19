import type { Env } from "../env";
import { callBusiness } from "../aliexpress/client";
import { getDsProduct, list } from "../aliexpress/dropshipper";
import { feedProductIds } from "./discover";
import { now } from "../lib/util";

/**
 * Old Hostinger (WooCommerce + DSers) products carry no AliExpress product id, but their
 * variation SKUs are AliExpress sku_attr values ("14:200661016#as shown"). We search AliExpress
 * by title and accept the candidate whose SKUs share most of those values. Unsure matches are
 * left unmatched rather than guessed.
 */
const MAX_CANDIDATES = 6;   // up to 3 searches + 6 product.get calls per job; queue batches of 3 stay under the free-plan subrequest limit
const MIN_OVERLAP = 0.5;    // share of the old product's option codes the AliExpress listing must have

/** Option codes on an AliExpress listing, split from each SKU's sku_attr ("14:173#Blue;5:100014064"). */
function skuAttrs(ds: Awaited<ReturnType<typeof getDsProduct>>): Set<string> {
  const out = new Set<string>();
  for (const s of list(ds.ae_item_sku_info_dtos?.ae_item_sku_info_d_t_o)) {
    for (const part of String(s.sku_attr ?? s.id ?? "").split(";")) if (part.includes(":")) out.add(part.trim());
  }
  return out;
}

export async function matchLegacy(env: Env, token: string, wcId: number): Promise<void> {
  const row = await env.DB.prepare(`SELECT title, sku_attrs FROM legacy_products WHERE wc_id = ?`).bind(wcId).first<{ title: string; sku_attrs: string }>();
  if (!row) return;
  const wanted = JSON.parse(row.sku_attrs || "[]") as string[];
  const save = (status: string, ae: string | null, score: number | null, note: string) =>
    env.DB.prepare(`UPDATE legacy_products SET status = ?, ae_product_id = ?, score = ?, note = ?, updated_at = ? WHERE wc_id = ?`)
      .bind(status, ae, score, note.slice(0, 300), now(), wcId).run();
  if (wanted.length === 0) return void (await save("nomatch", null, null, "no option codes to compare"));

  // Long cleaned-up titles often find nothing, so retry with the first 5, then 3 words.
  const words = row.title.replace(/[|–—(].*$/, "").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  let keyWord = "";
  let candidates: string[] = [];
  let lastReply = "";
  for (const n of [8, 5, 3]) {
    if (n < 8 && words.length <= n) break;
    keyWord = words.slice(0, n).join(" ");
    const payload = await callBusiness(env, "aliexpress.ds.text.search", token, {
      keyWord, local: "en_US", countryCode: env.AE_SHIP_TO_COUNTRY, currency: env.STORE_CURRENCY, pageSize: 10, pageIndex: 1,
    });
    candidates = feedProductIds(payload).slice(0, MAX_CANDIDATES);
    if (candidates.length > 0) break;
    lastReply = JSON.stringify(payload).slice(0, 180);
  }
  if (candidates.length === 0) return void (await save("nomatch", null, null, `search found nothing for "${keyWord}": ${lastReply}`));

  let best: { id: string; score: number } | null = null;
  for (const id of candidates) {
    const attrs = skuAttrs(await getDsProduct(env, token, id).catch(() => ({})));
    const score = wanted.filter((a) => attrs.has(a)).length / wanted.length;
    if (!best || score > best.score) best = { id, score };
  }
  if (best && best.score >= MIN_OVERLAP) await save("matched", best.id, best.score, `matched ${Math.round(best.score * 100)}% of option codes`);
  else await save("nomatch", best?.id ?? null, best?.score ?? 0, `best candidate matched ${Math.round((best?.score ?? 0) * 100)}% of option codes`);
}
