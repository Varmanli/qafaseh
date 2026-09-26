import { NextRequest } from "next/server";
import { z } from "zod";

import { assertAdminApi } from "@/lib/admin/permissions";
import { deleteContactMessage, setContactMessageRead } from "@/lib/admin/contact-messages";
import { apiError, apiSuccess } from "@/lib/api/response";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;
  const parsed = z.object({ isRead: z.boolean() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError("وضعیت پیام نامعتبر است.", 422);

  const { id } = await params;
  const row = await setContactMessageRead(id, parsed.data.isRead);
  if (!row) return apiError("پیام پیدا نشد.", 404);
  return apiSuccess({ message: "وضعیت پیام به‌روزرسانی شد." });
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;

  const { id } = await params;
  const row = await deleteContactMessage(id);
  if (!row) return apiError("پیام پیدا نشد.", 404);
  return apiSuccess({ message: "پیام حذف شد." });
}
