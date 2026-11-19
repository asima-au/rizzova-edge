import { STORE } from "@/lib/policies";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/site";

/** /llms.txt: a plain summary for AI answer engines (AEO/GEO), pointing at the pages worth reading. */
export function GET() {
  const body = `# Rizzova

> ${SITE_DESCRIPTION}

Rizzova is an Australian online store (ABN ${STORE.abn}). Prices are in Australian dollars.

## Key facts
- Delivery: free to Australia and the United States (tracked, 2–3 weeks); A$5 to the United Arab Emirates.
- Payments: cards, Apple Pay and Google Pay through Stripe.
- Returns: no change-of-mind returns; Australian Consumer Law guarantees always apply to faulty items.
- Contact: ${STORE.email} or WhatsApp ${STORE.phone}.

## Pages
- [Shop](${SITE_URL}/): all products
- [Shipping & Delivery](${SITE_URL}/shipping)
- [Refunds & Returns](${SITE_URL}/refunds)
- [Payments](${SITE_URL}/payments)
- [Contact](${SITE_URL}/contact)
- [Sitemap](${SITE_URL}/sitemap.xml): every product page
`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
