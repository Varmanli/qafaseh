import { withPublicContentInvalidation } from "@/lib/cache/public-data";
import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

import { apiError, apiSuccess } from "@/lib/api/response";
import { assertAdminApi } from "@/lib/admin/permissions";
import { getSiteSettings, updateSiteSettings } from "@/lib/settings/service";
import { siteSettingsSchema } from "@/lib/settings/types";

export const runtime = "nodejs";

export async function GET() {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;

  const settings = await getSiteSettings();
  return apiSuccess({ settings });
}

async function handlePUT(req: NextRequest) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("درخواست نامعتبر است", 400);
  }

  const parsed = siteSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "ورودی نامعتبر است",
      422,
    );
  }

  const settings = await updateSiteSettings(parsed.data);

  // متادیتای ریشه (عنوان/توضیحات/فاوآیکون/OG) و همه‌ی صفحاتِ زیرِ layout را
  // باطل می‌کند تا تغییرات (مثل فاوآیکون) بلافاصله در کل سایت اعمال شوند.
  revalidatePath("/", "layout");

  return apiSuccess({ settings, message: "تنظیمات ذخیره شد" });
}

export const PUT = withPublicContentInvalidation(handlePUT);
