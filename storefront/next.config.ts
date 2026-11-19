import type { NextConfig } from "next";

const config: NextConfig = {
  images: {
    // Product media is served by Cloudflare Images, already resized per variant.
    remotePatterns: [{ protocol: "https", hostname: "imagedelivery.net" }, { protocol: "https", hostname: "rizzova.com" }],
    unoptimized: true,
  },
  poweredByHeader: false,
  // Old WooCommerce addresses from the Hostinger shop.
  async redirects() {
    return [
      { source: "/shop", destination: "/", permanent: true },
      { source: "/shop/:path*", destination: "/", permanent: true },
      { source: "/product-category/:path*", destination: "/", permanent: true },
      { source: "/cart", destination: "/", permanent: false },
      { source: "/my-account/:path*", destination: "/contact", permanent: false },
      { source: "/refund_returns", destination: "/refunds", permanent: true },
    ];
  },
};

export default config;
