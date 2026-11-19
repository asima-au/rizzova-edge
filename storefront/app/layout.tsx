import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Lora, Nunito_Sans } from "next/font/google";
import { CartProvider } from "@/context/cart-context";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ContactButton } from "@/components/contact-button";
import "./globals.css";

// Boutique pairing: Lora (warm serif, echoes the logo) for headings, Nunito Sans for text and prices.
const serif = Lora({ subsets: ["latin"], variable: "--font-lora", weight: ["500", "600", "700"], style: ["normal", "italic"] });
const body = Nunito_Sans({ subsets: ["latin"], variable: "--font-nunito" });

export const metadata: Metadata = {
  title: { default: "Rizzova", template: "%s · Rizzova" },
  description: "Home, pets, kids, tech and everyday finds, delivered to Australia, the US and the UAE.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-AU" className={`${serif.variable} ${body.variable}`}>
      <body className="antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-[var(--color-accent)] focus:px-4 focus:py-2 focus:text-[var(--color-accent-ink)]">
          Skip to content
        </a>
        <CartProvider>
          <SiteHeader />
          <main id="main" className="pb-24">
            {children}
          </main>
          <SiteFooter />
          <ContactButton />
        </CartProvider>
      </body>
    </html>
  );
}
