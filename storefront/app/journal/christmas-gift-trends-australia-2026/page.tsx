import type { Metadata } from "next";
import Link from "next/link";
import { postBySlug } from "@/lib/journal";
import { SITE_URL } from "@/lib/site";

const post = postBySlug("christmas-gift-trends-australia-2026")!;
const url = `${SITE_URL}/journal/${post.slug}`;

export const metadata: Metadata = {
  title: { absolute: post.title },
  description: post.description,
  alternates: { canonical: `/journal/${post.slug}` },
  openGraph: { type: "article", title: post.title, description: post.description, url },
};

// Google Trends, Australia, web search, past 30 days to 25 Nov 2026, related queries for "christmas gifts".
const RISING: [string, string][] = [
  ["Sephora", "Breakout"],
  ["Christmas gifts for 10 year old girls", "Breakout"],
  ["Christmas bon bons with good gifts", "Breakout"],
  ["Mens gifts", "+250%"],
  ["Gifts for men", "+140%"],
  ["Yeti", "+120%"],
  ["Christmas gifts under 20", "+110%"],
  ["Mum Christmas gifts", "+90%"],
  ["Mens Christmas gifts", "+80%"],
  ["Gifts for mum", "+60%"],
  ["Handmade Christmas gifts", "+60%"],
  ["Funny Christmas gifts", "+50%"],
];
const TOP: [string, number][] = [
  ["Gifts for Christmas", 100], ["Kids Christmas gifts", 16], ["Christmas gifts ideas", 16], ["Best Christmas gifts", 14],
  ["Christmas gifts for kids", 11], ["Gifts for women", 8], ["Teen Christmas gifts", 8], ["Christmas gifts 2026", 7],
];
const STATES: [string, number][] = [
  ["Northern Territory", 100], ["Tasmania", 67], ["Australian Capital Territory", 41], ["South Australia", 34],
  ["Western Australia", 28], ["Queensland", 28], ["New South Wales", 26], ["Victoria", 23],
];
// Google Trends, Australia, Google Shopping searches, past 3 months to 24 Nov 2026, average on one shared 0-100 scale per group of five.
const SHOPPING: [string, number][] = [
  ["Squishy toys", 19], ["Water bottle", 15], ["Beach towel", 2], ["Massage gun", 1], ["Cooler bag", 1], ["Hammock", 1],
];

const th = "border-b border-black/10 px-3 py-2 text-left text-sm font-semibold";
const td = "border-b border-black/5 px-3 py-2 text-sm";

/** Data-led trend report: written to be cited by bloggers and journalists (linkable asset). */
export default function ChristmasTrends2026() {
  const jsonLd = {
    "@context": "https://schema.org", "@type": "Article", headline: post.title, description: post.description,
    datePublished: post.published, dateModified: post.updated, mainEntityOfPage: url,
    author: { "@type": "Organization", name: "Rizzova", url: SITE_URL },
    publisher: { "@type": "Organization", name: "Rizzova", url: SITE_URL, logo: { "@type": "ImageObject", url: `${SITE_URL}/brand/logo-mark.png` } },
  };
  return (
    <article className="container-x max-w-3xl pt-10 pb-16 [&_h2]:mt-10 [&_h2]:font-[family-name:var(--font-display)] [&_h2]:text-2xl [&_h2]:font-bold [&_p]:mt-4 [&_p]:leading-relaxed [&_li]:mt-2">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--color-accent)]"><Link href="/journal">Rizzova Journal</Link> · Trend report</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">{post.title}</h1>
      <p className="!mt-3 text-sm text-[var(--color-muted)]">Published 25 November 2026 · Data: Google Trends (Australia) · By the Rizzova team</p>

      <div className="mt-8 rounded-[22px] bg-[#2a1645] p-6 text-white">
        <p className="!mt-0 font-bold text-[var(--color-accent)]">Key findings</p>
        <ul className="list-disc pl-5 text-white/90">
          <li><b>Gifts for men</b> are the fastest-growing Christmas search in Australia this month: &ldquo;mens gifts&rdquo; is up <b>250%</b> and &ldquo;gifts for men&rdquo; up <b>140%</b>.</li>
          <li><b>Budget gifts</b> are rising fast: &ldquo;Christmas gifts under 20&rdquo; is up <b>110%</b>, a sign shoppers are buying more, smaller presents.</li>
          <li><b>Mum</b> is the most searched-for recipient: &ldquo;mum Christmas gifts&rdquo; up <b>90%</b>, &ldquo;gifts for mum&rdquo; up <b>60%</b>.</li>
          <li><b>Kids</b> dominate overall volume, and &ldquo;Christmas gifts for 10 year old girls&rdquo; is a breakout search (up more than 5,000%).</li>
          <li><b>The Northern Territory and Tasmania</b> search for Christmas gifts more than any other state, relative to population.</li>
        </ul>
      </div>

      <h2>The fastest-rising Christmas gift searches</h2>
      <p>These are the searches related to &ldquo;Christmas gifts&rdquo; that grew most in Australia over the past 30 days, compared with the previous period. &ldquo;Breakout&rdquo; means growth of more than 5,000%.</p>
      <div className="mt-4 overflow-x-auto rounded-2xl bg-white">
        <table className="w-full"><thead><tr><th className={th}>Search</th><th className={th}>Growth</th></tr></thead>
          <tbody>{RISING.map(([q, g]) => <tr key={q}><td className={td}>{q}</td><td className={`${td} font-semibold`}>{g}</td></tr>)}</tbody></table>
      </div>
      <p>Two themes stand out. Men have overtaken every other gift recipient for growth, and price-capped searches (&ldquo;under 20&rdquo;) are climbing as people look for Secret Santa and stocking-filler gifts. Brand searches such as Sephora and Yeti point to beauty and insulated drinkware as this year&rsquo;s aspirational gifts.</p>

      <h2>What Australians search for most</h2>
      <p>By total volume, general searches lead, with kids&rsquo; gifts the most popular specific category. Values are relative to the top search (100).</p>
      <div className="mt-4 overflow-x-auto rounded-2xl bg-white">
        <table className="w-full"><thead><tr><th className={th}>Search</th><th className={th}>Relative volume</th></tr></thead>
          <tbody>{TOP.map(([q, v]) => <tr key={q}><td className={td}>{q}</td><td className={td}>{v}</td></tr>)}</tbody></table>
      </div>

      <h2>Which states search most for Christmas gifts</h2>
      <p>Relative to its population, the Northern Territory searches most for Christmas gifts, followed by Tasmania and the ACT. Victoria and New South Wales search least relative to population, even though they produce the most searches in total.</p>
      <div className="mt-4 overflow-x-auto rounded-2xl bg-white">
        <table className="w-full"><thead><tr><th className={th}>State or territory</th><th className={th}>Search interest (0–100)</th></tr></thead>
          <tbody>{STATES.map(([s, v]) => <tr key={s}><td className={td}>{s}</td><td className={td}>{v}</td></tr>)}</tbody></table>
      </div>

      <h2>Viral gifts vs what people actually shop for</h2>
      <p>Gift guides this year are full of beach towels, hammocks and cooler bags for an Australian summer Christmas. Google Shopping data tells a different story: shoppers are searching far more for <b>squishy toys</b> and <b>water bottles</b> than for the summer gear that fills the guides.</p>
      <div className="mt-4 overflow-x-auto rounded-2xl bg-white">
        <table className="w-full"><thead><tr><th className={th}>Product (Google Shopping)</th><th className={th}>Average interest, Sep–Nov</th></tr></thead>
          <tbody>{SHOPPING.map(([q, v]) => <tr key={q}><td className={td}>{q}</td><td className={td}>{v}</td></tr>)}</tbody></table>
      </div>

      <h2>What this means for your Christmas shopping</h2>
      <ul className="list-disc pl-5">
        <li>Buying for a Secret Santa or a big family? You are not alone; see our <Link className="underline" href="/gifts/secret-santa-under-25">Secret Santa gifts under A$25</Link>.</li>
        <li>Stuck on mum? Browse <Link className="underline" href="/gifts/gifts-for-mum">gifts for mum</Link>.</li>
        <li>For the kids: <Link className="underline" href="/gifts/kids-and-teens">gifts for kids &amp; teens</Link>, or something silly from our <Link className="underline" href="/gifts/funny-gifts">funny gifts</Link>.</li>
        <li>End of school year: <Link className="underline" href="/gifts/teacher-gifts">teacher gifts</Link>.</li>
        <li>Order by 3 December for delivery before Christmas.</li>
      </ul>

      <h2>Method</h2>
      <p className="text-sm text-[var(--color-muted)]">Data from Google Trends for Australia: related queries and state interest for &ldquo;christmas gifts&rdquo; (web search, past 30 days, collected 25 November 2026), and Google Shopping interest for product terms (past 3 months, compared on one shared 0–100 scale). Google Trends values are relative, not absolute search counts.</p>

      <div className="mt-10 rounded-2xl border border-black/10 bg-white p-5 text-sm">
        <b>Using this data?</b> You are welcome to quote or republish these figures. Please credit &ldquo;Rizzova&rdquo; with a link to this page: <span className="break-all">{url}</span>
      </div>
    </article>
  );
}
