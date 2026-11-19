# AliExpress best sellers export

Fetches the best-selling products for your keywords from the AliExpress **Affiliate API** (`aliexpress.affiliate.product.query`, sorted by `LAST_VOLUME_DESC`) and writes a CSV or JSON file. Each row has the product link, recent sales, price, positive-review rate and main image.

## Before you start
- You need an app in the **Affiliate** category on https://openservice.aliexpress.com. The Rizzova "Drop Shipping" app (555396) is refused by this API.
- You need a **tracking ID** from AliExpress Portals (Affiliate), under Tracking ID.

## Run it
```bash
cd scripts/aliexpress_top_products
cp .env.example .env            # then fill in the three values
python3 -m pip install -r requirements.txt   # optional: only python-dotenv
python3 top_products.py --keywords "pet bed,kids puzzle,christmas gift" --limit 100 --max-price 60 --out top_products.csv
```

| Option | Default | Meaning |
|---|---|---|
| `--keywords` | none | Comma-separated search terms; each is searched separately |
| `--category-ids` | none | Comma-separated AliExpress category IDs |
| `--ship-to` / `--currency` / `--language` | AU / AUD / EN | Region and display settings |
| `--limit` | 100 | Products scanned per keyword; pages of 50 are fetched automatically |
| `--min-sales` | 100 | Minimum recent orders (`lastest_volume`) |
| `--min-positive-rate` | 90 | Minimum `evaluate_rate`, a percentage of positive reviews (90 is roughly 4.5 stars) |
| `--min-price` / `--max-price` | none | Price range in the target currency |
| `--format` | csv | `csv` or `json` |

The script retries rate limits and network errors with backoff, explains common error codes, removes duplicates by `product_id`, and falls back to `product_detail_url` when there is no `promotion_link`.

## Adding results to Rizzova
Paste the links (or product IDs) into "Add products you picked" on the console, or send them to Claude to check against the store's rules first.
