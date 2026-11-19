/**
 * Store departments. Products have no categories yet, so each department is a search;
 * `match` picks a product photo for its home-page circle.
 */
export interface Department { name: string; href: string; match: RegExp; highlight?: boolean }

const q = (term: string) => `/?q=${encodeURIComponent(term)}`;

export const DEPARTMENTS: Department[] = [
  { name: "Christmas Gifts", href: q("christmas"), match: /christmas|xmas|santa|gift/i, highlight: true },
  { name: "Home & Kitchen", href: q("home"), match: /kitchen|home|storage|organi[sz]er|soap|cup/i },
  { name: "Pets", href: q("pet"), match: /\b(pet|dog|cat)s?\b/i },
  { name: "Kids & Toys", href: q("toy"), match: /toy|kids?|child|puzzle|block/i },
  { name: "Tech", href: q("tech"), match: /usb|card reader|phone|cable|camera|led|charger/i },
  { name: "Jewellery", href: q("jewelry"), match: /jewel|necklace|ring|pendant|bracelet|earring/i },
  { name: "Beauty", href: q("beauty"), match: /beauty|skin|face|hair|makeup/i },
  { name: "Fashion", href: q("fashion"), match: /scarf|shirt|dress|bag|wear|fashion/i },
];
