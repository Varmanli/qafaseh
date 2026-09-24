"use client";

import { useState } from "react";
import Image from "next/image";

import { normalizeMediaUrl } from "@/lib/book/cover";

const PLACEHOLDER_COVER = "/placeholder-cover.svg";

export function shouldBypassImageOptimizer(src: string | null | undefined): boolean {
  if (!src) return false;
  try {
    const url = new URL(src);
    const hostname = url.hostname.toLowerCase();

    return (
      hostname.endsWith(".arvanstorage.ir") ||
      hostname.endsWith(".liara.space") ||
      hostname.includes("s3.ir-thr-at1")
    );
  } catch {
    return false;
  }
}

type BookCoverImageProps = {
  src: string | null | undefined;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  priority?: boolean;
  sizes?: string;
};

export default function BookCoverImage({
  src,
  alt,
  className,
  width,
  height,
  fill = false,
  priority = false,
  sizes,
}: BookCoverImageProps) {
  const resolvedSrc = normalizeMediaUrl(src) ?? PLACEHOLDER_COVER;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const displayedSrc = failedSrc === resolvedSrc ? PLACEHOLDER_COVER : resolvedSrc;
  const bypassOptimizer = shouldBypassImageOptimizer(displayedSrc);

  return (
    <Image
      src={displayedSrc}
      alt={alt}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      fill={fill}
      sizes={sizes}
      priority={priority}
      className={className}
      unoptimized={bypassOptimizer}
      onError={() => setFailedSrc(resolvedSrc)}
    />
  );
}
