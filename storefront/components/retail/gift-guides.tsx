import Link from "next/link";
import { COLLECTIONS } from "@/lib/collections";

/** "Shop by gift" row on the home page: one tile per gift-guide collection. */
export function GiftGuides() {
  return (
    <section aria-label="Gift guides" className="container-x pt-12">
      <h2 className="mb-5 font-[family-name:var(--font-display)] text-3xl font-semibold">Shop by gift</h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {COLLECTIONS.map((c, i) => (
          <li key={c.slug}>
            <Link
              href={`/gifts/${c.slug}`}
              className={`group flex h-full min-h-32 flex-col justify-between rounded-[22px] p-5 shadow-[0_18px_36px_-24px_rgba(42,22,69,.6)] transition hover:-translate-y-1 ${
                ["bg-[#2a1645] text-white", "bg-[#f3e3c3] text-[#2a1645]", "bg-[#5b6b3a] text-[#f7f2e8]", "bg-[#c9a14a] text-[#241534]", "bg-white text-[#2a1645]"][i % 5]
              }`}
            >
              <span aria-hidden className="text-3xl transition group-hover:scale-110">{c.emoji}</span>
              <span className="mt-3 font-[family-name:var(--font-display)] text-lg font-bold leading-tight">{c.name} →</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
