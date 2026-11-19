import { DepartmentCircles } from "@/components/retail/department-circles";
import { PromoBanners } from "@/components/retail/promo-banners";
import { ProductRow } from "@/components/retail/product-row";
import { ProductGrid } from "@/components/product-grid";
import { getProduct, listProducts, previewSource } from "@/lib/catalog";
import christmasPicks from "@/lib/christmas-picks.json";
import type { Product } from "@/lib/types";

const withImage = (p: Product) => p.images.length > 0 && p.variants.some((v) => v.stock > 0);


export default async function HomePage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.slice(0, 80) : undefined;
  const [products, source] = await Promise.all([listProducts(query), previewSource()]);

  const banner = source && (
    <p role="status" className="container-x pt-4">
      <span className="block rounded-[var(--radius-control)] border-2 border-dashed border-[var(--color-warn)]/60 px-4 py-2.5 text-sm text-[var(--color-warn)]">
        {source === "rizzova.com"
          ? "Preview: products shown from the current rizzova.com catalogue. Checkout here is a demo and takes no payment."
          : "Preview: sample products. Checkout here is a demo and takes no payment."}
      </span>
    </p>
  );

  if (query) {
    return (
      <>
        {banner}
        <div className="container-x space-y-8 pt-10">
          <h1 className="font-[family-name:var(--font-poster)] text-5xl uppercase sm:text-7xl">“{query}”</h1>
          <ProductGrid products={products} label={`Search results for ${query}`} />
        </div>
      </>
    );
  }

  const shown = products.filter(withImage);
  // Owner-chosen Christmas picks (lib/christmas-picks.json), in that order; sold-out or removed ones drop out.
  const picks = (await Promise.all((christmasPicks as string[]).map((slug) => getProduct(slug)))).filter((p): p is Product => !!p && withImage(p));
  const first = picks.length >= 4 ? picks : shown.slice(0, 8);
  const pickedIds = new Set(first.map((p) => p.id));

  return (
    <div>
      {banner}
      <DepartmentCircles products={shown} />
      <PromoBanners />
      <ProductRow id="gifts" title="Top 10 Christmas gifts" products={first} />
      <ProductRow id="new" title="New arrivals" products={shown.filter((p) => !pickedIds.has(p.id)).slice(0, 12)} />
    </div>
  );
}
