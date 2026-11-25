/** Rizzova Journal: data-led gift guides and trend reports (linkable content for bloggers and journalists). */
export interface JournalPost { slug: string; title: string; description: string; published: string; updated: string; readMinutes: number }

export const JOURNAL: JournalPost[] = [
  {
    slug: "christmas-gift-trends-australia-2026",
    title: "Christmas Gift Trends Australia 2026: What Australians Are Searching For",
    description:
      "Google Trends data on Australia's Christmas 2026 gift searches: gifts for men up 250%, gifts under $20 up 110%, the rise of gifts for mum, and which states search most.",
    published: "2026-11-25",
    updated: "2026-11-25",
    readMinutes: 4,
  },
];

export const postBySlug = (slug: string) => JOURNAL.find((p) => p.slug === slug);
