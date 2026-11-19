"""Daily Rizzova snapshot: order and store counts (no customer details) -> snapshot.json for the Rizzova HQ artifact.
Reads D1 through the Cloudflare API; the session's proxy injects the Cloudflare credentials."""
import datetime, json, sys, urllib.request

ACCOUNT = "bee7d2e080270ecebe14549aecd7db36"
DB = "002681e9-a691-402a-a80b-e34674cd5e43"
LIVE_SINCE = 1795059600000  # Stripe live, 19 Nov 2026 03:40 UTC; earlier orders were test payments
LIVE = f"created_at >= {LIVE_SINCE} AND COALESCE(shipping_name,'') NOT LIKE 'TEST ORDER%'"


def q(sql):
    req = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{DB}/query",
        data=json.dumps({"sql": sql}).encode(), headers={"content-type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=60) as r:
        body = json.load(r)
    if not body.get("success"):
        raise SystemExit(f"D1 query failed: {body.get('errors')}")
    return body["result"][0]["results"]


now = datetime.datetime.now(datetime.timezone.utc)
day_ago = int((now - datetime.timedelta(days=1)).timestamp() * 1000)
week_ago = int((now - datetime.timedelta(days=7)).timestamp() * 1000)
month_ago = int((now - datetime.timedelta(days=30)).timestamp() * 1000)
paid = "status IN ('paid','fulfilling','shipped','delivered')"

status = {r["status"]: r["n"] for r in q(f"SELECT status, COUNT(*) n FROM orders WHERE {LIVE} GROUP BY status")}
new24 = q(f"SELECT COUNT(*) n, COALESCE(SUM(total_cents),0) c FROM orders WHERE {LIVE} AND {paid} AND created_at >= {day_ago}")[0]
rev7 = q(f"SELECT COALESCE(SUM(total_cents),0) c FROM orders WHERE {LIVE} AND {paid} AND created_at >= {week_ago}")[0]["c"]
rev30 = q(f"SELECT COALESCE(SUM(total_cents),0) c FROM orders WHERE {LIVE} AND {paid} AND created_at >= {month_ago}")[0]["c"]
to_order = q(f"""SELECT COUNT(*) n FROM orders o WHERE {LIVE.replace('created_at', 'o.created_at').replace('shipping_name', 'o.shipping_name')}
  AND o.status = 'paid' AND NOT EXISTS (SELECT 1 FROM fulfillments f WHERE f.order_id = o.id AND f.ae_order_id IS NOT NULL)""")[0]["n"]
products = q("SELECT COUNT(*) n, COALESCE(SUM(total_stock = 0),0) oos FROM products WHERE status = 'active'")[0]
titles = q("SELECT COUNT(*) n FROM product_copy WHERE status = 'draft'")[0]["n"]
suggestions = q("SELECT COUNT(*) n FROM ae_candidates WHERE status = 'passed'")[0]["n"]
ae = q("SELECT expires_at FROM auth_tokens LIMIT 1")
ae_ok = bool(ae) and ae[0]["expires_at"] > now.timestamp() * 1000

snapshot = {
    "generatedAt": now.isoformat(timespec="minutes"),
    "orders": {
        "new24h": new24["n"],
        "toOrder": to_order,
        "inProcess": status.get("fulfilling", 0),
        "shipped": status.get("shipped", 0),
        "delivered": status.get("delivered", 0),
        "failed": status.get("fulfilment_failed", 0),
        "unpaid": status.get("pending", 0),
        "refundedCancelled": status.get("refunded", 0) + status.get("cancelled", 0),
    },
    "revenueCents": {"last24h": new24["c"], "last7d": rev7, "last30d": rev30},
    "store": {"liveProducts": products["n"], "outOfStock": products["oos"], "titlesWaiting": titles,
              "suggestionsWaiting": suggestions, "aliexpressConnected": ae_ok},
}
out = sys.argv[1] if len(sys.argv) > 1 else "snapshot.json"
with open(out, "w") as f:
    json.dump(snapshot, f, indent=1)
print(json.dumps(snapshot))
