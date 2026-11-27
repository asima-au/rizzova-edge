import type { Env } from "../env";

/**
 * CJdropshipping API v2 client (https://developers.cjdropshipping.com).
 * The API key lives only in the CJ_API_KEY Worker secret. Access tokens last ~15 days and
 * CJ allows a new token only every few minutes, so the token is cached in KV.
 */
const BASE = "https://developers.cjdropshipping.com/api2.0/v1";
const TOKEN_KEY = "cj_access_token";

export class CjError extends Error {}

async function token(env: Env): Promise<string> {
  const cached = await env.KV.get(TOKEN_KEY);
  if (cached) return cached;
  if (!env.CJ_API_KEY) throw new CjError("CJ_API_KEY secret is not set");
  const res = await fetch(`${BASE}/authentication/getAccessToken`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ apiKey: env.CJ_API_KEY }),
  });
  const body = (await res.json()) as { result?: boolean; message?: string; data?: { accessToken?: string; accessTokenExpiryDate?: string } };
  const t = body.data?.accessToken;
  if (!body.result || !t) throw new CjError(`CJ login failed: ${body.message ?? res.status}`);
  const expires = Date.parse(body.data?.accessTokenExpiryDate ?? "") || Date.now() + 14 * 86_400_000;
  // Keep one day of margin before CJ's expiry.
  await env.KV.put(TOKEN_KEY, t, { expirationTtl: Math.max(3600, Math.floor((expires - Date.now()) / 1000) - 86_400) });
  return t;
}

/** Calls a CJ endpoint (path after /api2.0/v1) and returns `data`, or throws CjError. */
export async function cj<T = unknown>(env: Env, path: string, init: { method?: "GET" | "POST"; query?: Record<string, string>; body?: unknown } = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: { "CJ-Access-Token": await token(env), "content-type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const body = (await res.json()) as { result?: boolean; code?: number; message?: string; data?: T };
  if (body.code === 1600001 || body.code === 1600003) await env.KV.delete(TOKEN_KEY); // token invalid: log in again next call
  if (!body.result) throw new CjError(`CJ ${path}: ${body.message ?? res.status}`);
  return body.data as T;
}
