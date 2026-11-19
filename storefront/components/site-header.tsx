"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ShoppingBag, Truck } from "lucide-react";
import { useCart } from "@/context/cart-context";
import { spring } from "@/lib/tokens";
import { DEPARTMENTS } from "@/lib/departments";
import { SearchBar } from "./search-bar";
import { CartSheet } from "./cart-sheet";

/** Retail header: plum notice bar, logo + full-width search + cart, then the department menu. */
export function SiteHeader() {
  const { totals } = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const reduce = useReducedMotion();
  const count = totals.itemCount;

  return (
    <>
      <p className="bg-[var(--color-accent)] px-4 py-2 text-center text-[13px] text-[var(--color-accent-ink)]">
        <b>Christmas:</b> order by 3 December for delivery before Christmas · Free delivery to Australia &amp; the US
      </p>
      <header className="sticky top-0 z-40 bg-[var(--color-plum)] text-[#f7f3e8]">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:gap-6 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Rizzova home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-mark.png" alt="" width={44} height={44} className="size-11" />
            <span className="hidden font-[family-name:var(--font-serif)] text-2xl uppercase tracking-[0.24em] text-[var(--color-accent)] sm:inline">Rizzova</span>
          </Link>
          <div className="min-w-0 flex-1">
            <Suspense fallback={<div className="glass h-12 w-full rounded-[var(--radius-control)]" aria-hidden />}>
              <SearchBar wide />
            </Suspense>
          </div>
          <p className="hidden items-center gap-2 text-sm text-[#dcd5bf] lg:flex">
            <Truck className="size-5 text-[var(--color-accent)]" aria-hidden /> Ships to AU · US · UAE
          </p>
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            aria-label={`Open cart, ${count} ${count === 1 ? "item" : "items"}`}
            aria-haspopup="dialog"
            aria-expanded={cartOpen}
            className="relative grid size-12 shrink-0 place-items-center rounded-[var(--radius-control)] border border-white/20 transition-colors hover:border-[var(--color-accent)]"
          >
            <ShoppingBag className="size-6" aria-hidden />
            <AnimatePresence initial={false}>
              {count > 0 && (
                <motion.span
                  key={count}
                  initial={reduce ? false : { scale: 0.4, opacity: 0, y: 4 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.4, opacity: 0 }}
                  transition={spring.pop}
                  className="absolute -right-2 -top-2 grid min-w-6 place-items-center rounded-[var(--radius-chip)] border-2 border-[var(--color-plum)] bg-[var(--color-accent)] px-1.5 font-[family-name:var(--font-mono)] text-xs font-bold text-[var(--color-accent-ink)]"
                  aria-hidden
                >
                  {count}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
        <nav aria-label="Departments" className="border-t border-white/10 bg-[#1e0f33]">
          <ul className="mx-auto flex max-w-7xl gap-6 overflow-x-auto px-4 py-3 text-[15px] font-semibold whitespace-nowrap sm:px-6">
            {DEPARTMENTS.map((d) => (
              <li key={d.name}>
                <Link href={d.href} className={d.highlight ? "text-[var(--color-accent)] hover:underline" : "hover:text-[var(--color-accent)]"}>
                  {d.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <CartSheet open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
