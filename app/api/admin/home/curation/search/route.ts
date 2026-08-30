import { NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api/response";
import { assertAdminApi } from "@/lib/admin/permissions";
import {
  searchFeaturedAuthors,
  searchFeaturedBlogPosts,
} from "@/lib/home/curation";

const querySchema = z.object({
  type: z.enum(["authors", "posts"]),
  q: z.string().trim().min(1).max(200),
});

export async function GET(req: NextRequest) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;

  const parsed = querySchema.safeParse({
    type: req.nextUrl.searchParams.get("type"),
    q: req.nextUrl.searchParams.get("q"),
  });
  if (!parsed.success) return apiError("پارامترهای جست‌وجو نامعتبر است", 422);

  const results =
    parsed.data.type === "authors"
      ? await searchFeaturedAuthors(parsed.data.q)
      : await searchFeaturedBlogPosts(parsed.data.q);
  return apiSuccess({ results });
}
