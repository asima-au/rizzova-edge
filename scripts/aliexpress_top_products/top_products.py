#!/usr/bin/env python3
"""
Fetch the best-selling AliExpress products for a set of keywords and export links + sales metrics.

API:      AliExpress Open Platform, Affiliate API `aliexpress.affiliate.product.query`
Gateway:  https://api-sg.aliexpress.com/sync  (business APIs; IOP gateway)
Signing:  HMAC-SHA256 over the sorted parameters (key+value concatenated), hex, upper case.
          This is the same scheme the Rizzova Worker uses for its dropshipping calls (src/aliexpress/client.ts).

Needs an app in the Affiliate category (a Drop Shipping app is refused) and an Affiliate tracking ID.

Usage:
  python3 top_products.py --keywords "pet bed,kids puzzle" --limit 100 --out top_products.csv
  python3 top_products.py --keywords "christmas gift" --min-price 5 --max-price 60 --format json --out top.json
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import hmac
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

GATEWAY = "https://api-sg.aliexpress.com/sync"
METHOD = "aliexpress.affiliate.product.query"
PAGE_SIZE = 50  # the API's maximum page size
FIELDS = [
    "product_id", "product_title", "promotion_link", "product_detail_url", "lastest_volume",
    "target_sale_price", "target_sale_price_currency", "evaluate_rate", "product_main_image_url",
]

# Error codes worth explaining in plain words (gateway "code" or resp_result "resp_code").
ERROR_HELP = {
    "IncompleteSignature": "Signature rejected: check ALIEXPRESS_APP_SECRET and the server clock.",
    "InvalidAppKey": "Unknown app key: check ALIEXPRESS_APP_KEY.",
    "InsufficientPermission": "This app cannot call the Affiliate API. Create an app in the Affiliate category.",
    "AppCallLimitExceeded": "Rate limit reached for this app.",
    "ApiCallLimit": "Rate limit reached for this API.",
    "IllegalTimestamp": "Server clock is off: sync the system time.",
    "402": "Invalid parameter (often the tracking ID or category ID).",
    "405": "No products found for these filters.",
}
RETRYABLE = {"AppCallLimitExceeded", "ApiCallLimit", "ServiceUnavailable", "SystemError", "isp.temporary-failed"}


def load_env(path: str = ".env") -> None:
    """Minimal .env loader (python-dotenv is used if installed). Existing environment variables win."""
    try:
        from dotenv import load_dotenv  # type: ignore

        load_dotenv(path)
        return
    except ImportError:
        pass
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def sign(secret: str, params: dict[str, str]) -> str:
    """IOP signature for business APIs: sort keys, concatenate key+value, HMAC-SHA256 with the app secret, upper hex."""
    base = "".join(f"{k}{params[k]}" for k in sorted(params))
    return hmac.new(secret.encode(), base.encode(), hashlib.sha256).hexdigest().upper()


class ApiError(Exception):
    def __init__(self, code: str, message: str, retryable: bool = False):
        hint = ERROR_HELP.get(code, "")
        super().__init__(f"AliExpress error {code}: {message}" + (f" ({hint})" if hint else ""))
        self.code, self.retryable = code, retryable


def call(app_key: str, app_secret: str, api_params: dict[str, str], retries: int = 4) -> dict:
    """One signed POST to the gateway, with exponential backoff on rate limits and network errors."""
    for attempt in range(retries + 1):
        params = {
            "app_key": app_key,
            "method": METHOD,
            "sign_method": "sha256",
            "timestamp": str(int(time.time() * 1000)),  # milliseconds, like the Worker
            **{k: v for k, v in api_params.items() if v not in ("", None)},
        }
        params["sign"] = sign(app_secret, params)
        body = urllib.parse.urlencode(params).encode()
        req = urllib.request.Request(GATEWAY, data=body, headers={"Content-Type": "application/x-www-form-urlencoded;charset=utf-8"})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.loads(r.read().decode())
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            if attempt == retries:
                raise ApiError("network", str(e))
            time.sleep(2 ** attempt)
            continue

        # Gateway-level error: {"code": "...", "message": "...", "request_id": "..."}
        if "error_response" in data or (data.get("code") not in (None, "0", 0)):
            err = data.get("error_response", data)
            code, msg = str(err.get("code", "unknown")), err.get("msg") or err.get("message", "")
            if code in RETRYABLE and attempt < retries:
                time.sleep(2 ** attempt)
                continue
            raise ApiError(code, msg, code in RETRYABLE)

        resp = data.get("aliexpress_affiliate_product_query_response", {}).get("resp_result", {})
        code = str(resp.get("resp_code", ""))
        if code == "405":  # no results is not a failure
            return {"products": [], "total": 0}
        if code != "200":
            raise ApiError(code or "no_payload", resp.get("resp_msg", "unexpected response"))
        result = resp.get("result", {})
        products = result.get("products", {}).get("product", [])
        if isinstance(products, dict):  # a single product comes back as an object
            products = [products]
        return {"products": products, "total": int(result.get("total_record_count", 0) or 0)}
    raise ApiError("retries", "gave up after retries")


def percent(v) -> float | None:
    """evaluate_rate looks like '96.5%'."""
    try:
        return float(str(v).rstrip("%"))
    except (TypeError, ValueError):
        return None


def number(v) -> float | None:
    try:
        return float(str(v).replace(",", ""))
    except (TypeError, ValueError):
        return None


def fetch(args, app_key: str, app_secret: str, tracking_id: str) -> list[dict]:
    keywords = [k.strip() for k in args.keywords.split(",") if k.strip()] or [""]
    seen: dict[str, dict] = {}  # dedupe by product_id across keywords and pages
    for kw in keywords:
        page, fetched = 1, 0
        while fetched < args.limit:
            res = call(app_key, app_secret, {
                "keywords": kw,
                "category_ids": args.category_ids,
                "page_no": str(page),
                "page_size": str(PAGE_SIZE),
                "sort": "LAST_VOLUME_DESC",
                "target_currency": args.currency,
                "target_language": args.language,
                "ship_to_country": args.ship_to,
                "tracking_id": tracking_id,
                "fields": ",".join(FIELDS),
            })
            products = res["products"]
            if not products:
                break
            for p in products:
                pid = str(p.get("product_id", ""))
                if not pid or pid in seen:
                    continue
                volume = number(p.get("lastest_volume")) or 0
                rate = percent(p.get("evaluate_rate"))
                price = number(p.get("target_sale_price"))
                # Client-side filters (applied after the API's own sorting).
                if volume < args.min_sales:
                    continue
                if args.min_positive_rate and (rate is None or rate < args.min_positive_rate):
                    continue
                if price is not None and ((args.min_price and price < args.min_price) or (args.max_price and price > args.max_price)):
                    continue
                seen[pid] = {
                    "product_id": pid,
                    "product_title": p.get("product_title", ""),
                    "link": p.get("promotion_link") or p.get("product_detail_url", ""),
                    "lastest_volume": int(volume),
                    "target_sale_price": price,
                    "currency": p.get("target_sale_price_currency", args.currency),
                    "evaluate_rate": rate,
                    "product_main_image_url": p.get("product_main_image_url", ""),
                    "keyword": kw,
                }
            fetched += len(products)
            print(f"  '{kw or '(all)'}' page {page}: {len(products)} products, {len(seen)} kept so far", file=sys.stderr)
            if len(products) < PAGE_SIZE or page * PAGE_SIZE >= res["total"]:
                break
            page += 1
            time.sleep(0.4)  # stay well inside the per-second call limit
    rows = sorted(seen.values(), key=lambda r: r["lastest_volume"], reverse=True)
    return rows[: args.limit * len(keywords)]


def write(rows: list[dict], path: str, fmt: str) -> None:
    if fmt == "json":
        with open(path, "w", encoding="utf-8") as f:
            json.dump(rows, f, ensure_ascii=False, indent=1)
        return
    cols = ["product_id", "product_title", "link", "lastest_volume", "target_sale_price", "currency", "evaluate_rate", "product_main_image_url", "keyword"]
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)


def main() -> int:
    ap = argparse.ArgumentParser(description="Export best-selling AliExpress products (Affiliate API).")
    ap.add_argument("--keywords", default="", help='Comma-separated, e.g. "pet bed,kids puzzle"')
    ap.add_argument("--category-ids", default="", help='Comma-separated AliExpress category IDs, e.g. "509,44"')
    ap.add_argument("--ship-to", default="AU")
    ap.add_argument("--currency", default="AUD")
    ap.add_argument("--language", default="EN")
    ap.add_argument("--limit", type=int, default=100, help="Products to scan per keyword (paginates automatically)")
    ap.add_argument("--min-sales", type=int, default=100, help="Minimum lastest_volume (recent orders)")
    ap.add_argument("--min-positive-rate", type=float, default=90.0, help="Minimum evaluate_rate %% (90 is roughly 4.5 stars)")
    ap.add_argument("--min-price", type=float, default=None)
    ap.add_argument("--max-price", type=float, default=None)
    ap.add_argument("--format", choices=["csv", "json"], default="csv")
    ap.add_argument("--out", default="top_products.csv")
    ap.add_argument("--env", default=".env")
    args = ap.parse_args()

    load_env(args.env)
    app_key = os.environ.get("ALIEXPRESS_APP_KEY", "")
    app_secret = os.environ.get("ALIEXPRESS_APP_SECRET", "")
    tracking_id = os.environ.get("ALIEXPRESS_TRACKING_ID", "")
    missing = [n for n, v in [("ALIEXPRESS_APP_KEY", app_key), ("ALIEXPRESS_APP_SECRET", app_secret), ("ALIEXPRESS_TRACKING_ID", tracking_id)] if not v]
    if missing:
        print(f"Missing in .env: {', '.join(missing)}", file=sys.stderr)
        return 2

    try:
        rows = fetch(args, app_key, app_secret, tracking_id)
    except ApiError as e:
        print(str(e), file=sys.stderr)
        return 1
    write(rows, args.out, args.format)
    print(f"Wrote {len(rows)} products to {args.out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
