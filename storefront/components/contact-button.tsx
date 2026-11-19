"use client";

import { useEffect, useRef, useState } from "react";
import { Mail, MessageCircle, X } from "lucide-react";
import { STORE } from "@/lib/policies";

const WHATSAPP = `https://wa.me/${STORE.phoneHref.replace(/\D/g, "")}?text=${encodeURIComponent("Hi Rizzova, I have a question about ")}`;
const EMAIL = `mailto:${STORE.email}?subject=${encodeURIComponent("Question for Rizzova")}`;

/** Floating "Chat with us": every customer question goes to the owner's WhatsApp or the support inbox. */
export function ContactButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  return (
    <div ref={ref} className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <div role="dialog" aria-label="Contact Rizzova" className="w-72 rounded-[var(--radius-panel)] bg-white p-4 text-[var(--color-fg)] shadow-[0_18px_50px_-15px_rgb(42_22_69/0.45)] ring-1 ring-black/10">
          <p className="font-[family-name:var(--font-display)] text-lg font-semibold">Questions? We&apos;re here.</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Usually a reply within a few hours, AEST.</p>
          <a href={WHATSAPP} target="_blank" rel="noopener" className="mt-4 flex items-center gap-3 rounded-[var(--radius-control)] bg-[#25D366] px-4 py-3 font-semibold text-white hover:brightness-95">
            <MessageCircle className="size-5" aria-hidden /> Chat on WhatsApp
          </a>
          <a href={EMAIL} className="mt-2 flex items-center gap-3 rounded-[var(--radius-control)] border border-black/10 px-4 py-3 font-semibold hover:border-[var(--color-accent)]">
            <Mail className="size-5" aria-hidden /> Email {STORE.email}
          </a>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Close contact options" : "Chat with us"}
        className="flex items-center gap-2 rounded-full bg-[var(--color-plum)] px-5 py-3 font-semibold text-white shadow-[0_12px_30px_-10px_rgb(42_22_69/0.6)] ring-2 ring-[var(--color-accent)] hover:brightness-110"
      >
        {open ? <X className="size-5" aria-hidden /> : <MessageCircle className="size-5 text-[var(--color-accent)]" aria-hidden />}
        <span className="hidden sm:inline">{open ? "Close" : "Chat with us"}</span>
      </button>
    </div>
  );
}
