import type { Job } from "./jobs";

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  JOBS: Queue<Job>;
  /** Cloudflare Email Routing send binding for owner alerts (src/lib/alert.ts). */
  ALERT_EMAIL?: SendEmail;

  AE_GATEWAY: string;
  AE_SHIP_TO_COUNTRY: string;
  STORE_CURRENCY: string;
  STORE_LANGUAGE: string;
  PRICE_MARKUP: string;
  COMPARE_AT_MARKUP: string;
  PUBLIC_SITE_URL: string;
  CF_IMAGES_ACCOUNT_HASH: string;
  CHECKOUT_COUNTRIES: string;
  AUTO_FULFIL: string;
  DISCOVERY_FEEDS: string;
  DISCOVERY_KEYWORDS: string;
  AE_OPTIONAL_DAILY_BUDGET?: string;
  DISCOVERY_PER_FEED: string;
  DISCOVERY_MIN_RATING: string;
  DISCOVERY_MIN_STORE_RATING: string;
  DISCOVERY_MIN_ORDERS: string;
  DISCOVERY_MAX_SHIP_CENTS: string;
  DISCOVERY_COUNTRIES: string;
  DISCOVERY_DAILY_LIMIT: string;
  AUTO_IMPORT: string;
  DISCOVERY_MAX_PRICE_CENTS: string;

  // Secrets
  AE_APP_KEY: string;
  CJ_API_KEY?: string;
  CJ_USD_AUD?: string;
  CJ_PRICE_MARKUP?: string;
  AE_APP_SECRET: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  CF_ACCOUNT_ID: string;
  CF_IMAGES_API_TOKEN: string;
  ADMIN_TOKEN: string;
  /** Owner alert address: a verified Email Routing destination. */
  ALERT_TO?: string;
}
