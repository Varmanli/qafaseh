"use client";

import { isValidElement, type ReactNode } from "react";
import useEmblaCarousel from "embla-carousel-react";
import type { EmblaOptionsType } from "embla-carousel";

import { cn } from "@/lib/utils";

/**
 * Lightweight RTL-aware carousel built on Embla Carousel.
 * Supports dragging and touch gestures without navigation buttons.
 */
export function Carousel({
  slides,
  slideClassName,
  className,
  containerClassName,
  ariaLabel,
  align = "start",
}: {
  slides: ReactNode[];
  slideClassName?: string;
  className?: string;
  containerClassName?: string;
  ariaLabel?: string;
  align?: EmblaOptionsType["align"];
  /** Backward-compatible; touch/drag remains the navigation mechanism. */
  controls?: boolean;
}) {
  const [emblaRef] = useEmblaCarousel({
    direction: "rtl",
    align,
    containScroll: "trimSnaps",
    dragFree: false,
    breakpoints: {
      "(max-width: 768px)": { active: false },
    },
  });

  return (
    <div className={cn("relative min-w-0", className)}>
      <div
        ref={emblaRef}
        role="region"
        aria-roledescription="carousel"
        aria-label={ariaLabel}
        className="overflow-x-auto md:overflow-hidden snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch]"
      >
        <div className={cn("flex gap-3", containerClassName)}>
          {slides.map((slide, index) => (
            <div
              key={isValidElement(slide) && slide.key !== null ? slide.key : index}
              className={cn("min-w-0 shrink-0 grow-0 snap-start", slideClassName)}
            >
              {slide}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
