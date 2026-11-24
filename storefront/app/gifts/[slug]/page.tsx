import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGrid } from "@/components/product-grid";
import { getCollectionProducts } from "@/lib/catalog";
import { COLLECTIONS, collectionBySlug } from "@/lib/collections";
import { SITE_URL } from "@/lib/site";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const col = collectionBySlug((await params).slug);
  if (!col) return {};
  const url = `/gifts/${col.slug}`;
  return {
    title: { absolute: col.seoTitle },
    description: col.seoDescription,
    alternates: { canonical: url },
    openGraph: { title: col.seoTitle, description: col.seoDescription, url: `${SITE_URL}${url}` },
  };
}

/** Gift-guide collection page (e.g. /gifts/secret-santa-under-25). */
export default async function GiftCollectionPage({ params }: { params: Params }) {
  const col = collectionBySlug((await params).slug);
  if (!col) notFound();
  const products = await getCollectionProducts(col.slug);
  return (
    <div className="container-x space-y-8 pt-10">
      <header className="relative overflow-hidden rounded-[28px] bg-[radial-gradient(120%_120%_at_0%_0%,#4b2a7a_0%,#2a1645_60%,#1a0d2e_100%)] p-8 text-white sm:p-10">
        <span aria-hidden className="absolute -right-6 -top-6 text-[120px] leading-none opacity-20">{col.emoji}</span>
        <p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--color-accent)]">Gift guide</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-tight sm:text-5xl">{col.name}</h1>
        <p className="mt-3 max-w-xl text-white/75">{col.blurb}</p>
      </header>
      <nav aria-label="Other gift guides" className="flex flex-wrap gap-2">
        {COLLECTIONS.filter((c) => c.slug !== col.slug).map((c) => (
          <Link key={c.slug} href={`/gifts/${c.slug}`} className="rounded-full border border-[var(--color-line,rgba(0,0,0,.12))] bg-white px-4 py-2 text-sm font-semibold hover:border-[var(--color-accent)]">
            {c.emoji} {c.name}
          </Link>
        ))}
      </nav>
      {products.length ? <ProductGrid products={products} label={col.name} /> : <p>New gifts are on the way. Check back soon.</p>}
    </div>
  );
}
