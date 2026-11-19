import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import legacy from "@/lib/legacy-redirects.json";
import { MediaGallery, type MediaItem } from "@/components/pdp/media-gallery";
import { ProductExperience } from "@/components/pdp/product-experience";
import { SpecPanel } from "@/components/pdp/spec-panel";
import { getComplements, getProduct } from "@/lib/catalog";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  return product ? { title: product.title, description: product.description ?? undefined } : { title: "Not found" };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) {
    // Old rizzova.com (WooCommerce) product addresses: matched products move permanently, others go to a search.
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
    description: product.description ?? undefined,
    sku: product.variants[0]?.sku,
    image: product.images,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: product.currency,
      lowPrice: Math.min(...prices).toFixed(2),
      highPrice: Math.max(...prices).toFixed(2),
      offerCount: product.variants.length,
      availability: product.variants.some((v) => v.stock > 0) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
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
