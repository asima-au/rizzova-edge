#!/usr/bin/env python3
"""
Google search through Bright Data's SERP API (zone mcp_serp) for Rizzova research: backlink prospects, trends.
The API token is injected by the session's network proxy for api.brightdata.com, so no key is read here.
Free tier: 5,000 requests a month; requests simply stop when it runs out.

Usage: python3 scripts/bd_search.py "australian mum blog write for us" [--country au] [--json]
"""
import argparse, json, sys, time, urllib.parse, urllib.request


def search(query: str, country: str = "au", retries: int = 2) -> list[dict]:
    url = f"https://www.google.com/search?q={urllib.parse.quote(query)}&gl={country}&hl=en"
    body = json.dumps({"zone": "mcp_serp", "url": url, "format": "raw", "data_format": "parsed_light"}).encode()
    for attempt in range(retries + 1):
        req = urllib.request.Request("https://api.brightdata.com/request", data=body, headers={"content-type": "application/json"})
        with urllib.request.urlopen(req, timeout=90) as r:
            text = r.read().decode()
        try:
            return [
                {"title": o.get("title", ""), "link": o.get("link", ""), "description": o.get("description", "")}
                for o in json.loads(text).get("organic", [])
                if o.get("link", "").startswith("http")
            ]
        except json.JSONDecodeError:
            # "This query recently failed ... try again after 15 seconds"
            if attempt < retries:
                time.sleep(20)
                continue
            raise SystemExit(f"Bright Data: {text[:200]}")
    return []


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("query")
    ap.add_argument("--country", default="au")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    res = search(a.query, a.country)
    if a.json:
        json.dump(res, sys.stdout, indent=1)
    else:
        for r in res:
            print(f"- {r['title'][:80]}\n  {r['link']}")
