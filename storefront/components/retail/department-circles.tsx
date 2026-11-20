import Link from "next/link";
import { DEPARTMENTS } from "@/lib/departments";
import type { Product } from "@/lib/types";

/** Round department tiles, each showing a matching product photo (or the logo when none matches yet). */
export function DepartmentCircles({ products, photos = {} }: { products: Product[]; photos?: Record<string, string> }) {
  return (
    <section aria-label="Shop by department" className="container-x pt-8">
      <ul className="flex gap-5 overflow-x-auto pb-2 sm:grid sm:grid-cols-4 sm:gap-6 lg:grid-cols-9">
        {DEPARTMENTS.map((d) => {
          const image = photos[d.name] ?? products.find((p) => (d.id ? p.categoryId === d.id : /christmas|santa|gift/i.test(p.title)) && p.images[0])?.images[0];
          return (
            <li key={d.name} className="w-24 shrink-0 sm:w-auto">
              <Link href={d.href} className="group block text-center">
                <span className="mx-auto grid aspect-square w-full max-w-36 place-items-center overflow-hidden rounded-full bg-white ring-1 ring-black/10 transition group-hover:ring-2 group-hover:ring-[var(--color-accent)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image ?? "/brand/logo-mark.png"}
                    alt=""
                    loading="lazy"
                    className={image ? "size-full object-cover transition group-hover:scale-105" : "size-1/2 object-contain opacity-80"}
                  />
                </span>
                <span className="mt-3 block text-sm font-medium sm:text-[15px]">{d.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
