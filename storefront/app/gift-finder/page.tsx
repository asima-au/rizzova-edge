import type { Metadata } from "next";
import Link from "next/link";
import { ProductGrid } from "@/components/product-grid";
import { getFinderProducts } from "@/lib/catalog";
import { COLLECTIONS } from "@/lib/collections";
import { SITE_URL } from "@/lib/site";

const TITLE = "Gift Finder Quiz: Find the Perfect Gift in 10 Seconds | Rizzova";
const DESC = "Free gift finder: pick who it's for, your budget and their vibe, and get hand-picked gift ideas instantly. Free tracked delivery to Australia and the US.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESC,
  alternates: { canonical: "/gift-finder" },
  openGraph: { title: TITLE, description: DESC, url: `${SITE_URL}/gift-finder` },
};

const WHO = [["her", "👩 Her"], ["him", "👨 Him"], ["kids", "🧒 Kids"], ["baby", "👶 Baby"], ["teen", "🧑‍🎤 Teen"], ["pet", "🐾 Pet lover"]] as const;
const BUDGET = [["15", "Under $15"], ["25", "Under $25"], ["50", "Under $50"], ["80", "Under $80"]] as const;
const VIBE = [["cosy", "☁️ Cosy"], ["funny", "😂 Funny"], ["cute", "🥰 Cute"], ["practical", "🧰 Practical"], ["tech", "🔌 Techy"], ["pretty", "✨ Pretty"]] as const;

type Search = Promise<{ who?: string; budget?: string; vibe?: string }>;

function Choice({ name, value, label, current }: { name: string; value: string; label: string; current?: string }) {
  return (
    <label className="cursor-pointer">
      <input type="radio" name={name} value={value} defaultChecked={current === value} className="peer sr-only" required />
      <span className="inline-block rounded-full border border-white/25 px-4 py-2 text-sm font-semibold transition peer-checked:border-[var(--color-accent)] peer-checked:bg-[var(--color-accent)] peer-checked:text-[#1a0d2e] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-accent)] hover:border-[var(--color-accent)]">{label}</span>
    </label>
  );
}

/** Free interactive gift quiz: a link-worthy tool for bloggers and a shortcut for shoppers. Works without JavaScript (plain GET form). */
export default async function GiftFinder({ searchParams }: { searchParams: Search }) {
  const a = await searchParams;
  const done = !!(a.who && a.budget && a.vibe);
  const products = done ? await getFinderProducts(a) : [];
  const whoLabel = WHO.find(([v]) => v === a.who)?.[1].replace(/^\S+\s/, "").toLowerCase();
  const jsonLd = { "@context": "https://schema.org", "@type": "WebApplication", name: "Rizzova Gift Finder", url: `${SITE_URL}/gift-finder`, applicationCategory: "LifestyleApplication", offers: { "@type": "Offer", price: "0", priceCurrency: "AUD" }, description: DESC };
  return (
    <div className="container-x space-y-8 pt-10 pb-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <form method="get" action="/gift-finder#results" className="relative overflow-hidden rounded-[28px] bg-[radial-gradient(120%_120%_at_0%_0%,#4b2a7a_0%,#2a1645_60%,#1a0d2e_100%)] p-6 text-white sm:p-10">
        <span aria-hidden className="absolute -right-6 -top-8 text-[130px] leading-none opacity-20">🎁</span>
        <p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--color-accent)]">Free tool</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-tight sm:text-5xl">Gift Finder</h1>
        <p className="mt-3 max-w-xl text-white/75">Three quick questions and we&rsquo;ll pick gifts they&rsquo;ll actually love.</p>
        {([["1. Who is it for?", "who", WHO, a.who], ["2. What's your budget?", "budget", BUDGET, a.budget], ["3. What's their vibe?", "vibe", VIBE, a.vibe]] as const).map(([q, name, opts, cur]) => (
          <fieldset key={name} className="mt-6">
            <legend className="mb-3 font-semibold">{q}</legend>
            <div className="flex flex-wrap gap-2">{opts.map(([v, l]) => <Choice key={v} name={name} value={v} label={l} current={cur} />)}</div>
          </fieldset>
        ))}
        <button type="submit" className="mt-8 rounded-full bg-[var(--color-accent)] px-7 py-3 font-bold text-[#1a0d2e] shadow-lg hover:brightness-110">Find gifts →</button>
      </form>

      {done && (
        <section id="results" className="space-y-4">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold">Gift ideas for {whoLabel}, under A${a.budget}</h2>
          {products.length ? <ProductGrid products={products} label="Gift ideas" /> : <p>No exact match yet. Try a bigger budget or another vibe.</p>}
          <p className="text-sm text-[var(--color-muted)]">Use code <b>XMAS15</b> for 15% off · Free tracked delivery to Australia and the US.</p>
        </section>
      )}

      <nav aria-label="Gift guides" className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">Or browse a gift guide</h2>
        <div className="flex flex-wrap gap-2">
          {COLLECTIONS.map((c) => <Link key={c.slug} href={`/gifts/${c.slug}`} className="rounded-full border border-[var(--color-line,rgba(0,0,0,.12))] bg-white px-4 py-2 text-sm font-semibold hover:border-[var(--color-accent)]">{c.emoji} {c.name}</Link>)}
        </div>
      </nav>

      <div className="rounded-2xl border border-black/10 bg-white p-5 text-sm">
        <b>Blogger or editor?</b> You&rsquo;re welcome to link to this free Gift Finder in your gift guides: <span className="break-all">{SITE_URL}/gift-finder</span>
      </div>
    </div>
  );
}
