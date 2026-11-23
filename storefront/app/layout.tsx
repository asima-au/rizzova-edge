import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";
import { CartProvider } from "@/context/cart-context";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ContactButton } from "@/components/contact-button";
import { STORE } from "@/lib/policies";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/site";
import "./globals.css";

// Modern retail pairing: Bricolage Grotesque (characterful display) for headings, Plus Jakarta Sans for text and prices.
const serif = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-lora", weight: ["500", "600", "700", "800"] });
const body = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-nunito", weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Rizzova | Gifts & Everyday Finds, Free Delivery to AU & US", template: "%s | Rizzova" },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: "Rizzova", url: SITE_URL, title: "Rizzova", description: SITE_DESCRIPTION, images: ["/brand/logo-mark.png"] },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-AU" className={`${serif.variable} ${body.variable}`}>
      <body className="antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-[var(--color-accent)] focus:px-4 focus:py-2 focus:text-[var(--color-accent-ink)]">
          Skip to content
        </a>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "OnlineStore",
            name: "Rizzova",
            url: SITE_URL,
            logo: `${SITE_URL}/brand/logo-mark.png`,
            description: SITE_DESCRIPTION,
            email: STORE.email,
            telephone: STORE.phone,
            taxID: `ABN ${STORE.abn}`,
            areaServed: ["AU", "US", "AE"],
            contactPoint: { "@type": "ContactPoint", contactType: "customer service", email: STORE.email, telephone: STORE.phone, availableLanguage: "English" },
          }).replace(/</g, "\\u003c") }}
        />
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
