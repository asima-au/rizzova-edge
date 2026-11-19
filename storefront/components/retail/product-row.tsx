import type { Product } from "@/lib/types";
import { ProductCard } from "../product-card";

/** A titled row of product cards in an even grid (retail layout, not masonry). */
export function ProductRow({ id, title, products }: { id?: string; title: string; products: Product[] }) {
  if (products.length === 0) return null;
  return (
    <section id={id} aria-label={title} className="container-x pt-12">
      <h2 className="mb-5 font-[family-name:var(--font-display)] text-2xl">{title}</h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 [&>article]:mb-0">
        {products.map((p, i) => <ProductCard key={p.id} product={p} index={i} aspect="1 / 1" />)}
      </div>
    </section>
  );
}
