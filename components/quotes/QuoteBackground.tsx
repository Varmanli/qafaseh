"use client";

import { useQuoteBackgroundImage } from "@/lib/quotes/background-client";
import type { QuoteBackground as QuoteBackgroundVariant } from "@/lib/quotes/backgrounds";

export function QuoteBackground({
  variant,
}: {
  variant: QuoteBackgroundVariant;
}) {
  const imageSrc = useQuoteBackgroundImage(variant);

  if (!imageSrc || variant === "default") {
    return <DefaultQuoteBackground />;
  }

  return <ImageQuoteBackground src={imageSrc} />;
}

function DefaultQuoteBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Sophisticated ivory/charcoal gradient background base */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--card)/0.95),hsl(var(--background)/0.98))]" />

      {/* Very soft warm literary glows - hidden on mobile for performance */}
      <div className="hidden md:block absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/[0.08] dark:bg-primary/[0.05] blur-3xl" />
      <div className="hidden md:block absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-primary/[0.04] dark:bg-primary/[0.02] blur-3xl" />

      {/* Intricate manuscript layout guidelines SVG (low visual weight) - hidden on mobile to reduce DOM size and paint cost */}
      <svg className="hidden md:block absolute inset-0 w-full h-full text-primary opacity-[0.06] dark:opacity-[0.04]" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.4">
        {/* Outer margin guides */}
        <rect x="5" y="5" width="90" height="90" rx="2" strokeDasharray="1 2" />
        <rect x="8" y="8" width="84" height="84" rx="1" />

        {/* Center crosshair guides */}
        <line x1="50" y1="8" x2="50" y2="92" strokeDasharray="0.75 1.5" />
        <line x1="8" y1="50" x2="92" y2="50" strokeDasharray="0.75 1.5" />

        {/* Symmetrical diagonal guides */}
        <line x1="20" y1="20" x2="80" y2="80" strokeDasharray="0.5 2" />
        <line x1="80" y1="20" x2="20" y2="80" strokeDasharray="0.5 2" />

        {/* Concentric layout circles */}
        <circle cx="50" cy="50" r="30" />
        <circle cx="50" cy="50" r="18" strokeDasharray="1 1" />
        <circle cx="50" cy="50" r="8" />

        {/* Corner crop marks / grid lines */}
        <path d="M5 15 L15 5 M85 15 L95 5 M5 85 L15 95 M85 85 L95 95" />
      </svg>

      {/* Fine manuscript grain texture - hidden on mobile for performance */}
      <div className="hidden md:block absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_1px_1px,hsl(var(--foreground)/0.18)_0.7px,transparent_0.8px)] [background-size:16px_16px]" />

      {/* Subtle top light highlight */}
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
    </div>
  );
}

function ImageQuoteBackground({ src }: { src: string }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Artwork */}
      <div
        className="absolute inset-0 scale-[1.01] bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url("${src}")`,
        }}
      />

      {/* Readability — keep the artwork visible, not washed out */}
      <div className="absolute inset-0 bg-black/34" />

      {/* Gentle center focus */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.10)_0%,rgba(0,0,0,0.18)_52%,rgba(0,0,0,0.38)_100%)]" />

      {/* Cinematic depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/25" />

      {/* Thin glass-like highlight */}
      <div className="absolute inset-x-7 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
    </div>
  );
}
