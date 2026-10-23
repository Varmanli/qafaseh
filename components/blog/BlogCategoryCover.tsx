"use client";

import Image from "next/image";
import { useState } from "react";
import BlogCategoryArtwork from "@/components/blog/BlogCategoryArtwork";
import { normalizeMediaUrl } from "@/lib/book/cover";

export default function BlogCategoryCover({ src, slug, sizes }: {
  src?: string | null;
  slug: string;
  sizes: string;
}) {
  const resolved = normalizeMediaUrl(src);
  const [failed, setFailed] = useState<string | null>(null);
  const [optimizerFailed, setOptimizerFailed] = useState<string | null>(null);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <BlogCategoryArtwork slug={slug} />
      {resolved && failed !== resolved ? (
        <Image src={resolved} alt="" fill sizes={sizes}
          className="object-cover" unoptimized={resolved.startsWith("http") || optimizerFailed === resolved}
          onError={() => optimizerFailed === resolved ? setFailed(resolved) : setOptimizerFailed(resolved)} />
      ) : null}
    </div>
  );
}
