/**
 * Store departments. Every product belongs to exactly one, so a department page shows only its own products.
 * Ids are fixed: the storefront links to /?dept=<slug> and the API filters by category_id.
 */
export const DEPARTMENTS = [
  { id: 1, slug: "home-kitchen", name: "Home & Kitchen" },
  { id: 2, slug: "pets", name: "Pets" },
  { id: 3, slug: "kids-toys", name: "Kids & Toys" },
  { id: 4, slug: "tech", name: "Tech" },
  { id: 5, slug: "jewellery", name: "Jewellery & Watches" },
  { id: 6, slug: "beauty", name: "Beauty" },
  { id: 7, slug: "fashion", name: "Fashion" },
  { id: 8, slug: "hobbies", name: "Hobbies & More" },
] as const;

const ID = Object.fromEntries(DEPARTMENTS.map((d) => [d.slug, d.id])) as Record<(typeof DEPARTMENTS)[number]["slug"], number>;

/**
 * First matching rule wins, so the order matters: toys shaped like animals are toys, pet-proof covers are homewares,
 * a coffee machine's carry bag is kitchen gear, and a scarf's "hair band" is fashion rather than beauty.
 */
const RULES: [RegExp, number][] = [
  [/bath(room)? mat|slipcover|furniture/i, ID["home-kitchen"]],
  [/\blures?\b|\bbait\b|fishing/i, ID.hobbies],
  [/protective case|shockproof/i, ID.tech],
  [/plush|stuffed|action figure|\bfigures?\b|building blocks?|\bbricks?\b|\bmoc\b|toy car|teether|rainstick/i, ID["kids-toys"]],
  [/cushion cover|candle/i, ID["home-kitchen"]],
  [/\bpets?\b|\bdogs?\b|pupp(y|ies)|kitten|cat teaser|kennel|aquarium|\blitter\b|pet bed/i, ID.pets],
  [/\bbab(y|ies)\b|newborn|toddler|\bkids?\b|child|\btoys?\b|puzzles?|squeeze|stress relief|fidget|squish|needoh/i, ID["kids-toys"]],
  [/kitchen|coffee|espresso|\bmugs?\b|\bcups?\b|tumbler|flask|wine|soap|sink|spice|yogurt|baking|peeler|dish/i, ID["home-kitchen"]],
  [/jewel|necklace|pendant|bracelet|earring|\brings?\b|wrist ?watch|\bwatch(es)?\b|keychain|key ring|brooch|enamel pins/i, ID.jewellery],
  [/scarf|shawl|t-shirt|\btee\b|sweater|pullover|\bhats?\b|beanie|\bcap\b|balaclava|\bbag\b|messenger|slippers|sandals|clothing/i, ID.fashion],
  [/skin|lip balm|lipstick|makeup|callus|pedicure|manicure|\bnail|coconut oil|beauty|\bhair\b/i, ID.beauty],
  [/\busb\b|bluetooth|earphone|headset|\biems?\b|ear tips|controller|joystick|ps[45]\b|xbox|charger|cable|thermostat|zigbee|laser|rangefinder|\bdji\b|camera|digital/i, ID.tech],
  [/\bhome\b|storage|organi[sz]er|\bwall\b|hooks?\b|hanger|\bmats?\b|decor|bathroom|holder|cover|cleaning|party favors|duct/i, ID["home-kitchen"]],
];

/** The department id for a product title. Anything unrecognised goes to Hobbies & More, never to Home & Kitchen. */
export function classifyTitle(title: string): number {
  for (const [re, id] of RULES) if (re.test(title)) return id;
  return ID.hobbies;
}

/** Seed the department rows (idempotent). */
export async function ensureDepartments(db: D1Database): Promise<void> {
  await db.batch(DEPARTMENTS.map((d) => db.prepare(`INSERT OR IGNORE INTO categories (id, name, slug) VALUES (?, ?, ?)`).bind(d.id, d.name, d.slug)));
}
