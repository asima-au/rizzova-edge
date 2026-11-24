import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import legacy from "@/lib/legacy-redirects.json";
import { SITE_URL } from "@/lib/site";
import { MediaGallery, type MediaItem } from "@/components/pdp/media-gallery";
import { ProductExperience } from "@/components/pdp/product-experience";
import { SpecPanel } from "@/components/pdp/spec-panel";
import { getComplements, getProduct, movedSlug } from "@/lib/catalog";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  if (!product) return { title: "Not found", robots: { index: false } };
  // Meta description: the approved one-line summary, else the start of the description as plain text (~155 characters).
  const plain = (product.summary || (product.description ?? "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  const base = plain || `Shop ${product.title} at Rizzova. Free delivery to Australia and the US, A$5 to the UAE.`;
  const description = base.length > 155 ? `${base.slice(0, 152).replace(/\s+\S*$/, "")}…` : base;
  const url = `/product/${product.slug}`;
  return {
    title: product.title.length > 60 ? product.title.slice(0, 58).replace(/\s+\S*$/, "") : product.title,
    description: description || undefined,
    alternates: { canonical: url },
    openGraph: { type: "website", url, title: product.title, description: description || undefined, images: product.images.slice(0, 1) },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) {
    // Old rizzova.com (WooCommerce) product addresses: matched products move permanently, others go to a search.
    const replaced = await movedSlug(slug);
    if (replaced) redirect(`/product/${replaced}`);
    const moved = (legacy as Record<string, string>)[slug];
    if (moved) permanentRedirect(`/product/${moved}`);
    const words = slug.split("-").filter((w) => /^[a-z]{3,}$/.test(w)).slice(0, 4).join(" ");
    if (words) redirect(`/?q=${encodeURIComponent(words)}`);
    notFound();
  }
  const complements = await getComplements(product);
  const media: MediaItem[] = product.images.map((src, i) => ({ kind: "image", src, alt: `${product.title}, image ${i + 1}` }));
  const prices = product.variants.map((v) => v.priceCents / 100);

  // Structured data so search engines and AI shopping agents can read price and stock without scraping the UI.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: (product.summary || (product.description ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500)) || undefined,
    url: `${SITE_URL}/product/${product.slug}`,
    brand: { "@type": "Brand", name: "Rizzova" },
    sku: product.variants[0]?.sku,
    image: product.images,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: product.currency,
      lowPrice: Math.min(...prices).toFixed(2),
      highPrice: Math.max(...prices).toFixed(2),
      offerCount: product.variants.length,
      availability: product.variants.some((v) => v.stock > 0) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      // Matches lib/shipping.ts and the refunds policy: free to AU/US, A$5 to the UAE, 2–3 weeks; no change-of-mind returns.
      shippingDetails: (["AU", "US", "AE"] as const).map((country) => ({
        "@type": "OfferShippingDetails",
        shippingDestination: { "@type": "DefinedRegion", addressCountry: country },
        shippingRate: { "@type": "MonetaryAmount", value: country === "AE" ? 5 : 0, currency: "AUD" },
        deliveryTime: { "@type": "ShippingDeliveryTime", transitTime: { "@type": "QuantitativeValue", minValue: 14, maxValue: 21, unitCode: "DAY" } },
      })),
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: ["AU", "US", "AE"],
        returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
        url: `${SITE_URL}/refunds`,
      },
    },
  };

  return (
    <article className="container-x grid grid-cols-[minmax(0,1fr)] gap-8 pt-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]" aria-labelledby="product-title">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="min-w-0 space-y-6">
        <MediaGallery media={media} title={product.title} seed={product.id} category={product.category} isSample={product.isSample} />
        <SpecPanel specs={product.specs} />
      </div>
      <div className="min-w-0 space-y-5 lg:sticky lg:top-24 lg:self-start">
        <header>
          {product.isSample && (
            <p className="mb-2 inline-block rounded-[var(--radius-chip)] border border-[var(--color-warn)]/60 px-2.5 py-0.5 font-[family-name:var(--font-mono)] text-xs text-[var(--color-warn)]">
              Sample product, not for sale
            </p>
          )}
          <h1 id="product-title" className="text-balance font-[family-name:var(--font-display)] text-2xl font-bold leading-tight sm:text-3xl">{product.title}</h1>
          {product.supplierRating != null && product.supplierRating > 0 && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--color-muted)]">
              <span aria-hidden className="tracking-tight text-[var(--color-accent)]">{"★".repeat(Math.round(product.supplierRating))}{"☆".repeat(5 - Math.round(product.supplierRating))}</span>
              <span>
                <b className="text-[var(--color-fg)]">{product.supplierRating.toFixed(1)}</b> from our supplier&rsquo;s buyers
                {product.supplierOrders ? ` · ${product.supplierOrders >= 1000 ? `${Math.floor(product.supplierOrders / 1000)}k+` : `${product.supplierOrders}+`} sold` : ""}
              </span>
            </p>
          )}
          {product.shipCountries && product.shipCountries.length > 0 && product.shipCountries.length < 3 && (
            <p className="mt-3 inline-block rounded-[var(--radius-chip)] bg-[var(--color-olive)] px-3 py-1 text-sm font-semibold text-[#f7f2e8]">
              Ships to {product.shipCountries.map((c) => ({ AU: "Australia", US: "the United States", AE: "the UAE" })[c] ?? c).join(" and ")} only
            </p>
          )}
          {product.isSample && product.description && <p className="mt-3 text-[var(--color-muted)]">{product.description}</p>}
        </header>
        <ProductExperience product={product} complements={complements} />
      </div>
      {product.description && !product.isSample && (
        // Supplier HTML (sanitised by the ingestion Worker) is long and image-heavy: full width, folded, images kept to a sensible size.
        <details className="glass group rounded-[var(--radius-panel)] p-5 sm:p-6 lg:col-span-2">
          <summary className="flex cursor-pointer list-none items-center justify-between font-[family-name:var(--font-display)] text-xl font-semibold">
            Product description
            <span className="text-sm font-[family-name:var(--font-sans)] font-semibold text-[var(--color-accent-ink)] underline underline-offset-4 group-open:hidden">Read more</span>
            <span className="hidden text-sm font-[family-name:var(--font-sans)] font-semibold underline underline-offset-4 group-open:inline">Show less</span>
          </summary>
          <div
            className="mt-4 max-w-3xl text-[var(--color-muted)] [&_*]:!bg-transparent [&_*]:!font-[family-name:var(--font-sans)] [&_*]:!text-inherit [&_img]:mx-auto [&_img]:my-3 [&_img]:!h-auto [&_img]:max-h-[420px] [&_img]:!w-auto [&_img]:max-w-full [&_img]:rounded-xl [&_img]:object-contain"
            dangerouslySetInnerHTML={{ __html: asHtml(product.description) }}
          />
        </details>
      )}
    </article>
  );
}

/** Approved Rizz AI copy is plain text with blank-line paragraphs; supplier copy is already (sanitised) HTML. */
function asHtml(text: string): string {
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  const esc = (v: string) => v.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
  return text.split(/\n{2,}/).map((para) => `<p>${esc(para.trim()).replace(/\n/g, "<br>")}</p>`).join("");
}
