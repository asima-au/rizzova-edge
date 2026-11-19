import Link from "next/link";

const BANNERS = [
  { kicker: "Christmas Gift Shop", title: "Gifts they'll actually love", note: "Order by 3 December for Christmas delivery", href: "/?q=christmas", cta: "Shop gifts", tone: "plum" },
  { kicker: "Free delivery", title: "Free shipping to Australia & the US", note: "Tracked delivery in 2–3 weeks. UAE A$5.", href: "/shipping", cta: "Delivery info", tone: "gold" },
  { kicker: "New this week", title: "Fresh finds for home, pets & kids", note: "Hand-picked, top-rated products", href: "#new", cta: "See what's new", tone: "ivory" },
] as const;

const TONES = {
  plum: "bg-[var(--color-plum)] text-white",
  gold: "bg-[var(--color-accent)] text-[var(--color-accent-ink)]",
  ivory: "bg-[var(--color-ink-2)] text-[var(--color-fg)] ring-1 ring-black/5",
} as const;

/** Three promo cards under the department row. */
export function PromoBanners() {
  return (
    <section aria-label="Offers" className="container-x grid gap-5 pt-10 md:grid-cols-3">
      {BANNERS.map((b) => (
        <Link key={b.kicker} href={b.href} className={`group flex min-h-48 flex-col justify-between rounded-[var(--radius-panel)] p-6 transition hover:-translate-y-0.5 ${TONES[b.tone]}`}>
          <span>
            <span className="text-xs font-bold uppercase tracking-[0.18em] opacity-80">{b.kicker}</span>
            <span className="mt-2 block font-[family-name:var(--font-display)] text-2xl leading-tight">{b.title}</span>
            <span className="mt-2 block text-sm opacity-80">{b.note}</span>
          </span>
          <span className="mt-4 font-semibold underline underline-offset-4 group-hover:no-underline">{b.cta} →</span>
        </Link>
      ))}
    </section>
  );
}
