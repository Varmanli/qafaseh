import { withPublicContentInvalidation } from "@/lib/cache/public-data";
import { NextRequest } from "next/server";
import { z } from "zod";

import { assertAdminApi } from "@/lib/admin/permissions";
import { apiError, apiSuccess } from "@/lib/api/response";
import { applyReferenceProfiles } from "@/lib/reference/profile-import";

const applySchema = z.object({
  profiles: z.unknown(),
  overwrite: z.boolean().optional(),
});

async function handlePOST(req: NextRequest) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("درخواست نامعتبر است.", 400);
  }

  const parsed = applySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("ورودی نامعتبر است.", 422, "INVALID_IMPORT_PAYLOAD");
  }

  const result = await applyReferenceProfiles(parsed.data.profiles, {
    overwrite: parsed.data.overwrite ?? false,
  });

  return apiSuccess({ ...result });
}

export const POST = withPublicContentInvalidation(handlePOST);
