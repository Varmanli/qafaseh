import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

import { apiError, apiSuccess } from "@/lib/api/response";
import { assertAdminApi } from "@/lib/admin/permissions";
import { getSiteNavigationMenus, updateSiteNavigationMenus } from "@/lib/layout/navigation-settings";
import { navigationMenusSchema } from "@/lib/layout/navigation-schema";

export async function GET() {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;
  return apiSuccess({ menus: await getSiteNavigationMenus() });
}

export async function PUT(req: NextRequest) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;
  const parsed = navigationMenusSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "منو نامعتبر است", 422);
  const menus = await updateSiteNavigationMenus(parsed.data);
  revalidatePath("/", "layout");
  return apiSuccess({ menus, message: "منوهای سایت ذخیره شد" });
}
