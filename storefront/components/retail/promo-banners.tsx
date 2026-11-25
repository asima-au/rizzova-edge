import Link from "next/link";
import type { Product } from "@/lib/types";

/**
 * Hero bento under the department row: one large Christmas card with three floating product photos
 * (layered, tilted, soft shadows for depth) and two smaller cards beside it. Photos come from the Top 10 picks.
 */
export function PromoBanners({ products = [] }: { products?: Product[] }) {
  const img = (i: number) => products.filter((p) => p.images[0])[i]?.images[0];
  return (
    <section aria-label="Offers" className="container-x grid gap-4 pt-8 lg:grid-cols-3 lg:grid-rows-2">
      {/* Main card */}
      <Link
        href="/#gifts"
        className="group relative isolate flex min-h-[320px] overflow-hidden rounded-[28px] bg-[radial-gradient(120%_120%_at_0%_0%,#4b2a7a_0%,#2a1645_55%,#1a0d2e_100%)] p-7 text-white shadow-[0_30px_60px_-30px_rgba(42,22,69,.7)] lg:col-span-2 lg:row-span-2 lg:min-h-[420px] lg:p-10"
      >
        <span aria-hidden className="absolute -right-24 -top-24 -z-10 size-80 rounded-full bg-[var(--color-accent)]/25 blur-3xl" />
        <div className="relative z-10 flex max-w-[52%] flex-col justify-between max-sm:max-w-full">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide ring-1 ring-white/20 backdrop-blur">
              <span className="size-1.5 rounded-full bg-[var(--color-accent)]" /> Christmas Gift Shop
            </span>
            <h2 className="mt-5 font-[family-name:var(--font-display)] text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-5xl lg:text-6xl">
              Gifts they&rsquo;ll <span className="text-[var(--color-accent)]">actually</span> love
            </h2>
            <p className="mt-4 text-[15px] text-white/75">Order by 3 December for Christmas delivery. Free tracked shipping.</p>
            <p className="mt-3 inline-flex items-center gap-2 rounded-xl border border-dashed border-[var(--color-accent)] px-3 py-1.5 text-sm font-semibold"><span className="text-[var(--color-accent)]">15% off</span> with code <b className="tracking-wider text-white">XMAS15</b></p>
          </div>
          <span className="mt-8 inline-flex w-fit items-center gap-2 rounded-full bg-[var(--color-accent)] px-6 py-3 text-sm font-bold text-[var(--color-accent-ink)] shadow-[0_10px_24px_-8px_rgba(201,161,74,.8)] transition group-hover:-translate-y-0.5">
            Shop the top 10 <span aria-hidden>→</span>
          </span>
        </div>
        {/* Floating product stack */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 hidden w-[48%] [perspective:1200px] sm:block">
          {[
            { i: 0, cls: "right-[34%] top-[14%] w-[46%] -rotate-[8deg] z-10" },
            { i: 1, cls: "right-[6%] top-[8%] w-[44%] rotate-[6deg] z-20" },
            { i: 2, cls: "right-[18%] bottom-[8%] w-[50%] -rotate-[2deg] z-30" },
          ].map(({ i, cls }) =>
            img(i) ? (
              <div key={i} className={`absolute ${cls} aspect-square overflow-hidden rounded-3xl bg-white p-1.5 shadow-[0_25px_50px_-12px_rgba(0,0,0,.6)] ring-1 ring-white/30 transition duration-500 [transform-style:preserve-3d] group-hover:[transform:translateY(-6px)_rotateY(-8deg)]`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img(i)} alt="" className="size-full rounded-[20px] object-cover" />
              </div>
            ) : null,
          )}
        </div>
      </Link>

      {/* Delivery card */}
      <Link href="/shipping" className="group relative isolate flex min-h-[200px] flex-col justify-between overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#f3d58a_0%,#c9a14a_60%,#a9822f_100%)] p-7 text-[var(--color-accent-ink)] shadow-[0_24px_48px_-28px_rgba(169,130,47,.9)]">
        <span aria-hidden className="absolute -bottom-10 -right-6 -z-10 text-[150px] leading-none opacity-20 transition group-hover:rotate-6">📦</span>
        <div>
          <span className="text-xs font-bold uppercase tracking-[.14em] opacity-70">Free delivery</span>
          <h3 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-extrabold leading-tight tracking-tight">Free shipping to Australia &amp; the US</h3>
          <p className="mt-1 text-sm opacity-75">Tracked, 2–3 weeks. UAE A$5.</p>
        </div>
        <span className="mt-4 text-sm font-bold underline decoration-2 underline-offset-4 group-hover:no-underline">Delivery info →</span>
      </Link>

      {/* New arrivals card */}
      <Link href="#new" className="group relative isolate flex min-h-[200px] overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#6f8247_0%,#4d5c2f_100%)] p-7 text-[#f7f2e8] shadow-[0_24px_48px_-28px_rgba(77,92,47,.9)]">
        <div className="relative z-10 flex max-w-[60%] flex-col justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-[.14em] opacity-70">New this week</span>
            <h3 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-extrabold leading-tight tracking-tight">Fresh finds for home, pets &amp; kids</h3>
          </div>
          <span className="mt-4 text-sm font-bold underline decoration-2 underline-offset-4 group-hover:no-underline">See what&rsquo;s new →</span>
        </div>
        {img(3) && (
          <div aria-hidden className="absolute -bottom-4 -right-4 w-[46%] rotate-[8deg] overflow-hidden rounded-3xl bg-white p-1.5 shadow-[0_20px_40px_-12px_rgba(0,0,0,.55)] transition duration-500 group-hover:rotate-[3deg] group-hover:-translate-y-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img(3)} alt="" className="aspect-square w-full rounded-[20px] object-cover" />
          </div>
        )}
      </Link>
    </section>
  );
}
