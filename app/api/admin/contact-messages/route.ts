import { NextRequest } from "next/server";
import { z } from "zod";

import { assertAdminApi } from "@/lib/admin/permissions";
import { listContactMessages } from "@/lib/admin/contact-messages";
import { apiError, apiSuccess } from "@/lib/api/response";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  q: z.string().trim().max(200).optional(),
  topic: z.enum(["book", "criticism", "suggestion", "problem", "cooperation", "other"]).optional(),
  status: z.enum(["all", "unread", "read"]).default("all"),
});

export async function GET(req: NextRequest) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;

  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return apiError("فیلتر پیام‌ها نامعتبر است.", 422);

  const pageSize = 25;
  const { rows, total, unreadTotal } = await listContactMessages({ ...parsed.data, pageSize });
  return apiSuccess({ messages: rows, total, unreadTotal, page: parsed.data.page, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}
