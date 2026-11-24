export interface Variant {
  id: number;
  sku: string;
  priceCents: number;
  compareAtCents: number | null;
  stock: number;
  attributes: Record<string, string>;
}

export interface Spec {
  group: string;
  label: string;
  value: string;
}

export interface Product {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  /** Approved one-line summary (Rizz AI), used for meta descriptions. */
  summary?: string | null;
  /** Countries the supplier delivers to, e.g. ["AU"]; empty or missing = all store countries. */
  shipCountries?: string[];
  /** AliExpress buyers' average rating and units sold (supplier figures, not Rizzova reviews). */
  supplierRating?: number | null;
  supplierOrders?: number | null;
  currency: string;
  category: string;
  categoryId?: number | null;
  images: string[];
  variants: Variant[];
  specs: Spec[];
  /** True for demo catalogue entries shown when no backend is configured. */
  isSample: boolean;
}

export type StockState = "in_stock" | "low" | "out";

export interface ShippingAddress {
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: "AU" | "US" | "AE";
}
