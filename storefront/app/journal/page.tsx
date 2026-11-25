import type { Metadata } from "next";
import Link from "next/link";
import { JOURNAL } from "@/lib/journal";

export const metadata: Metadata = {
  title: "Journal: Gift Trends & Gift Guides",
  description: "Gift trend reports and practical gift guides from Rizzova, based on real Australian search data.",
  alternates: { canonical: "/journal" },
};

/** /journal: list of articles. */
export default function JournalIndex() {
  return (
    <div className="container-x max-w-3xl space-y-8 pt-10">
      <header>
        <p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--color-accent)]">Rizzova Journal</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-tight">Gift trends &amp; guides</h1>
        <p className="mt-3 text-[var(--color-muted)]">What Australians are searching for, and gift ideas that actually land.</p>
      </header>
      <ul className="space-y-4">
        {JOURNAL.map((p) => (
          <li key={p.slug}>
            <Link href={`/journal/${p.slug}`} className="block rounded-[22px] bg-white p-6 shadow-[0_18px_36px_-28px_rgba(42,22,69,.6)] transition hover:-translate-y-0.5">
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold leading-tight">{p.title}</h2>
              <p className="mt-2 text-[var(--color-muted)]">{p.description}</p>
              <p className="mt-3 text-sm font-semibold">{new Date(p.published).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })} · {p.readMinutes} min read →</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
