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
  {
    slug: "gifts-for-men", name: "Gifts for men", emoji: "🧔",
    blurb: "Watches, wallets, gadgets and desk toys for dads, brothers and boyfriends who say they want nothing.",
    seoTitle: "Christmas Gifts for Men Australia 2026 | Rizzova",
    seoDescription: "Christmas gifts for men: watches, slim wallets, earbuds, sunglasses, model cars and EDC fidgets. Free tracked delivery across Australia.",
  },
  {
    slug: "stocking-stuffers", name: "Stocking stuffers under A$15", emoji: "🧦",
    blurb: "Small, fun and useful fillers for every stocking, all under A$15.",
    seoTitle: "Stocking Stuffers Under $15 Australia | Rizzova",
    seoDescription: "Cheap stocking stuffers under A$15 for kids, teens and adults: fidgets, keychains, hair clips, lip balm and more. Free delivery in Australia.",
  },
  {
    slug: "gifts-for-teen-girls", name: "Gifts for teen girls", emoji: "💅",
    blurb: "Kawaii plush, claw clips, nail sets, sunset lamps and jewellery she will actually love.",
    seoTitle: "Christmas Gifts for Teenage Girls Australia | Rizzova",
    seoDescription: "Trending gifts for teenage girls: kawaii plush, claw clips, nail polish, sunset lamps, scarves and jewellery. Free tracked delivery.",
  },
  {
    slug: "pet-lovers", name: "Gifts for pet lovers", emoji: "🐾",
    blurb: "Cosy beds, clever toys and grooming favourites for cats, dogs and their humans.",
    seoTitle: "Gifts for Cat & Dog Lovers Australia | Rizzova",
    seoDescription: "Gifts for pet lovers: calming cat beds, interactive cat toys, grooming brushes and paw print kits. Free tracked delivery in Australia.",
  },
  {
    slug: "winter-warmers", name: "Cosy winter gifts", emoji: "❄️",
    blurb: "Beanies, scarves and soft blankets for cold-weather Christmases in the US and beyond.",
    seoTitle: "Cosy Winter Gifts – Beanies, Scarves & Blankets | Rizzova",
    seoDescription: "Warm winter gifts: knit beanies, cashmere-feel scarves, faux fur hats and soft throw blankets. Free tracked delivery to the US and Australia.",
  },
];

export const collectionBySlug = (slug: string) => COLLECTIONS.find((c) => c.slug === slug);
