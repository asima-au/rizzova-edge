"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Search, X } from "lucide-react";
import { spring } from "@/lib/tokens";

/** Search box: "/" focuses it from anywhere, Escape clears and leaves. `wide` fills its row (header); otherwise it grows on focus. */
export function SearchBar({ wide = false }: { wide?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const reduce = useReducedMotion();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/?q=${encodeURIComponent(q)}` : "/");
    inputRef.current?.blur();
  };

  return (
    <motion.form
      role="search"
      onSubmit={submit}
      animate={wide ? undefined : { width: focused ? 360 : 220 }}
      transition={reduce ? { duration: 0 } : spring.snappy}
      className={`glass relative flex min-w-0 max-w-full items-center rounded-[var(--radius-control)] pl-3 pr-2 focus-within:border-[var(--color-accent)] ${wide ? "h-12 w-full border-2" : "h-11"}`}
    >
      <label htmlFor={id} className="sr-only">Search products</label>
      <Search className="size-4 shrink-0 text-[var(--color-muted)]" aria-hidden />
      <input
        ref={inputRef}
        id={id}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setValue("");
            inputRef.current?.blur();
          }
        }}
        placeholder={wide ? "Search gifts, home, pets, kids, tech…" : "Search Rizzova"}
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent px-2 text-[15px] outline-none placeholder:text-[var(--color-muted)] [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button type="button" onClick={() => setValue("")} aria-label="Clear search" className="grid size-7 place-items-center rounded-lg text-[var(--color-muted)] hover:text-[var(--color-fg)]">
          <X className="size-4" aria-hidden />
        </button>
      ) : (
        <kbd className="hidden rounded-md border border-black/15 px-1.5 font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-muted)] sm:block" aria-hidden>
          /
        </kbd>
      )}
    </motion.form>
  );
}
