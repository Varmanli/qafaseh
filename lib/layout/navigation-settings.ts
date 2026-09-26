import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { SiteSetting } from "@/db/schema";
import {
  DEFAULT_FOOTER_MENU,
  DEFAULT_HEADER_MENU,
  type SiteNavigationMenus,
} from "@/lib/layout/navigation";
import { navigationMenusSchema } from "@/lib/layout/navigation-schema";

const HEADER_KEY = "headerMenu";
const FOOTER_KEY = "footerMenu";

export async function getSiteNavigationMenus(): Promise<SiteNavigationMenus> {
  try {
    const rows = await db.select({ key: SiteSetting.key, value: SiteSetting.value })
      .from(SiteSetting).where(inArray(SiteSetting.key, [HEADER_KEY, FOOTER_KEY]));
    const values = new Map(rows.map((row) => [row.key, row.value]));
    const parsed = navigationMenusSchema.safeParse({
      header: JSON.parse(values.get(HEADER_KEY) ?? "null"),
      footer: JSON.parse(values.get(FOOTER_KEY) ?? "null"),
    });
    if (parsed.success) return parsed.data;
  } catch {
    // Missing settings fall back to the same links the site shipped with.
  }
  return { header: DEFAULT_HEADER_MENU, footer: DEFAULT_FOOTER_MENU };
}

export async function updateSiteNavigationMenus(menus: SiteNavigationMenus) {
  const now = new Date();
  await db.transaction(async (tx) => {
    for (const [key, value] of [
      [HEADER_KEY, JSON.stringify(menus.header)],
      [FOOTER_KEY, JSON.stringify(menus.footer)],
    ]) {
      await tx.insert(SiteSetting).values({ key, value, updatedAt: now })
        .onConflictDoUpdate({ target: SiteSetting.key, set: { value, updatedAt: now } });
    }
  });
  return menus;
}
