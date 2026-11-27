/**
 * Store departments. Each product belongs to exactly one (set by the backend, src/lib/classify.ts),
 * so a department page lists only its own products. Ids must match the backend's categories table.
 */
export interface Department { name: string; href: string; id?: number; highlight?: boolean }

const dept = (slug: string) => `/?dept=${slug}`;

export const DEPARTMENTS: Department[] = [
  { name: "Christmas Gifts", href: "/#gifts", highlight: true },
  { name: "Home & Kitchen", href: dept("home-kitchen"), id: 1 },
  { name: "Pets", href: dept("pets"), id: 2 },
  { name: "Kids & Toys", href: dept("kids-toys"), id: 3 },
  { name: "Tech", href: dept("tech"), id: 4 },
  { name: "Jewellery & Watches", href: dept("jewellery"), id: 5 },
  { name: "Beauty", href: dept("beauty"), id: 6 },
  { name: "Fashion", href: dept("fashion"), id: 7 },
  { name: "Hobbies & More", href: dept("hobbies"), id: 8 },
];

/** The department for a ?dept= slug, if any. */
export const departmentBySlug = (slug: string) => DEPARTMENTS.find((d) => d.id && d.href === dept(slug));
