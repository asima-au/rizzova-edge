/**
 * Gift-guide collections (Google Trends, Nov 2026). Products are chosen by rules on the backend
 * (src/routes/collections.ts), so new products join automatically.
 */
export interface GiftCollection { slug: string; name: string; emoji: string; blurb: string; seoTitle: string; seoDescription: string }

export const COLLECTIONS: GiftCollection[] = [
  {
    slug: "secret-santa-under-25", name: "Secret Santa under A$25", emoji: "🎁",
    blurb: "Crowd-pleasing gifts that stay inside the Secret Santa budget, with free tracked delivery.",
    seoTitle: "Secret Santa Gifts Under $25 | Free Delivery Australia",
    seoDescription: "Fun, useful Secret Santa and white elephant gifts under A$25. Top-rated picks with free tracked delivery to Australia and the US.",
  },
  {
    slug: "gifts-for-mum", name: "Gifts for mum", emoji: "💐",
    blurb: "Jewellery, cosy scarves, lamps and little luxuries she will actually use.",
    seoTitle: "Christmas Gifts for Mum | Rizzova Australia",
    seoDescription: "Thoughtful Christmas gifts for mum: jewellery, scarves, candles, lamps and self-care. Free tracked delivery across Australia.",
  },
  {
    slug: "kids-and-teens", name: "Kids & teens", emoji: "🧸",
    blurb: "Toys, puzzles, building sets and plushies for every age.",
    seoTitle: "Christmas Gifts for Kids & Teens | Rizzova",
    seoDescription: "Best Christmas gifts for kids and teens: building sets, puzzles, plush toys and fidgets. Free tracked delivery to Australia.",
  },
  {
    slug: "funny-gifts", name: "Funny gifts", emoji: "😂",
    blurb: "Squishies, giant geese and gifts that get a laugh on Christmas morning.",
    seoTitle: "Funny Christmas Gifts | Rizzova Australia",
    seoDescription: "Funny Christmas gifts and stocking stuffers: squishy toys, giant plush geese, fidgets and novelty finds. Free delivery.",
  },
  {
    slug: "teacher-gifts", name: "Teacher gifts", emoji: "🍎",
    blurb: "End-of-year thank-yous: bottles, planners, mugs and desk treats under A$40.",
    seoTitle: "Teacher Gifts for Christmas & End of Year | Rizzova",
    seoDescription: "End-of-year teacher gifts under A$40: water bottles, planners, mugs, candles and desk accessories. Free tracked delivery.",
  },
];

export const collectionBySlug = (slug: string) => COLLECTIONS.find((c) => c.slug === slug);
