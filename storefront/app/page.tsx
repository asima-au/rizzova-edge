import { DepartmentCircles } from "@/components/retail/department-circles";
import { PromoBanners } from "@/components/retail/promo-banners";
import { GiftGuides } from "@/components/retail/gift-guides";
import { GiftFinderPromo } from "@/components/retail/gift-finder-promo";
import { ProductRow } from "@/components/retail/product-row";
import { ProductGrid } from "@/components/product-grid";
import { getProduct, listProducts, previewSource } from "@/lib/catalog";
import { departmentBySlug } from "@/lib/departments";
import christmasPicks from "@/lib/christmas-picks.json";
import departmentPhotos from "@/lib/department-photos.json";
import type { Product } from "@/lib/types";

const withImage = (p: Product) => p.images.length > 0 && p.variants.some((v) => v.stock > 0);


export default async function HomePage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; dept?: string | string[] }> }) {
  const { q, dept } = await searchParams;
  const query = typeof q === "string" ? q.slice(0, 80) : undefined;
  const department = !query && typeof dept === "string" ? departmentBySlug(dept) : undefined;
  const [products, source] = await Promise.all([listProducts(query, department?.id), previewSource()]);

  const banner = source && (
    <p role="status" className="container-x pt-4">
      <span className="block rounded-[var(--radius-control)] border-2 border-dashed border-[var(--color-warn)]/60 px-4 py-2.5 text-sm text-[var(--color-warn)]">
        {source === "rizzova.com"
          ? "Preview: products shown from the current rizzova.com catalogue. Checkout here is a demo and takes no payment."
          : "Preview: sample products. Checkout here is a demo and takes no payment."}
      </span>
    </p>
  );

  if (department) {
    return (
      <>
        {banner}
        <div className="container-x space-y-8 pt-10">
          <h1 className="font-[family-name:var(--font-display)] text-4xl sm:text-5xl">{department.name}</h1>
          <ProductGrid products={products.filter((p) => p.categoryId === department.id)} label={department.name} />
        </div>
      </>
    );
  }

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
  // Owner/Claude-chosen photo per department circle (lib/department-photos.json), so every circle has a product.
  const photoEntries = await Promise.all(Object.entries(departmentPhotos as Record<string, string>).map(async ([name, slug]) => [name, (await getProduct(slug))?.images[0]] as const));
  const photos = Object.fromEntries(photoEntries.filter((e): e is readonly [string, string] => !!e[1]));

  return (
    <div>
      {banner}
      <DepartmentCircles products={shown} photos={photos} />
      <GiftFinderPromo />
      <PromoBanners products={first} />
      <ProductRow id="gifts" title="Top 10 Christmas gifts" products={first} />
      <GiftGuides />
      <ProductRow id="new" title="New arrivals" products={shown.filter((p) => !pickedIds.has(p.id)).slice(0, 12)} />
    </div>
  );
}
