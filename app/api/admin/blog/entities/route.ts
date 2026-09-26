import { NextRequest } from "next/server";
import { and, arrayContains, eq, ilike, isNull, or } from "drizzle-orm";

import { db } from "@/db";
import { CatalogBook, ReferenceItem } from "@/db/schema";
import { assertAdminApi } from "@/lib/admin/permissions";
import { apiError, apiSuccess } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;
  const type = req.nextUrl.searchParams.get("type");
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q || !["book", "author", "genre"].includes(type ?? "")) return apiSuccess({ results: [] });
  const term = `%${q}%`;
  if (type === "book") {
    const results = await db.select({ id: CatalogBook.id, label: CatalogBook.title, detail: CatalogBook.author }).from(CatalogBook).where(and(eq(CatalogBook.status, "APPROVED"), or(ilike(CatalogBook.title, term), ilike(CatalogBook.author, term)))).limit(12);
    return apiSuccess({ results });
  }
  const referenceType = type === "author" ? "AUTHOR" : "GENRE";
  const results = await db.select({ id: ReferenceItem.id, label: ReferenceItem.name, detail: ReferenceItem.countryName }).from(ReferenceItem).where(and(eq(ReferenceItem.status, "APPROVED"), referenceType === "AUTHOR" ? arrayContains(ReferenceItem.roles, ["AUTHOR"]) : eq(ReferenceItem.type, referenceType), ...(referenceType === "AUTHOR" ? [isNull(ReferenceItem.canonicalReferenceId)] : []), ilike(ReferenceItem.name, term))).limit(12);
  return apiSuccess({ results });
}
