import Link from "next/link";

/** Home-page promo strip for the Gift Finder quiz (kept out of the department row). */
export function GiftFinderPromo() {
  return (
    <section className="container-x pt-6" aria-label="Gift Finder">
      <Link
        href="/gift-finder"
        className="group relative flex flex-col gap-4 overflow-hidden rounded-[28px] bg-[linear-gradient(110deg,#c9a14a_0%,#e6c77d_45%,#f3e2b5_100%)] p-6 text-[#241534] shadow-[0_18px_40px_-18px_rgba(75,42,123,.45)] transition hover:-translate-y-0.5 sm:flex-row sm:items-center sm:justify-between sm:p-8"
      >
        <span aria-hidden className="pointer-events-none absolute -right-4 -top-6 text-[120px] leading-none opacity-25 transition group-hover:rotate-6 sm:text-[150px]">🎁</span>
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#4b2a7b]">Stuck on what to buy?</p>
          <h2 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-tight sm:text-4xl">Try our Gift Finder</h2>
          <p className="mt-2 max-w-md text-[#241534]/80">Answer 3 quick questions: who it&rsquo;s for, your budget and their vibe. Get gift ideas in 10 seconds.</p>
        </div>
        <span className="relative inline-flex w-fit items-center gap-2 rounded-full bg-[#241534] px-6 py-3 font-bold text-white shadow-lg group-hover:bg-[#4b2a7b]">Find a gift →</span>
      </Link>
    </section>
  );
}
