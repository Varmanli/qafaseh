import { cachePublicData } from "@/lib/cache/public-data";
import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { BookExternalLink } from "@/db/schema";
import {
  externalLinkDisplayLabel,
  normalizeExternalBookLinkProvider,
  normalizeExternalBookLinkType,
  type ExternalLinkProviderValue,
  type ExternalLinkTypeValue,
} from "@/lib/book/external-links-meta";
import type { ExternalLinkInput } from "@/lib/validations/external-links";

type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/** ردیف کاملِ لینک برای فرم ادمین. */
export interface AdminExternalLink {
  id: string;
  provider: ExternalLinkProviderValue;
  type: ExternalLinkTypeValue;
  url: string;
  label: string | null;
  isActive: boolean;
  sortOrder: number;
}

/** شکل عمومیِ لینک برای نمایش در صفحه‌ی کتاب. */
export interface PublicBookExternalLink {
  id: string;
  provider: ExternalLinkProviderValue;
  label: string;
  url: string;
  type: ExternalLinkTypeValue;
}

/** همه‌ی لینک‌های یک کتاب (برای ادمین) به ترتیب نمایش. */
export async function listBookExternalLinks(
  catalogBookId: string,
): Promise<AdminExternalLink[]> {
  const rows = await db
    .select({
      id: BookExternalLink.id,
      provider: BookExternalLink.provider,
      type: BookExternalLink.type,
      url: BookExternalLink.url,
      label: BookExternalLink.label,
      isActive: BookExternalLink.isActive,
      sortOrder: BookExternalLink.sortOrder,
    })
    .from(BookExternalLink)
    .where(eq(BookExternalLink.catalogBookId, catalogBookId))
    .orderBy(asc(BookExternalLink.sortOrder), asc(BookExternalLink.createdAt));

  return rows.map((row) => ({
    id: row.id,
    provider: row.provider as ExternalLinkProviderValue,
    type: row.type as ExternalLinkTypeValue,
    url: row.url,
    label: row.label,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  }));
}

/** فقط لینک‌های فعالِ یک کتاب برای نمایش عمومی، با برچسب نمایشِ آماده. */
async function loadPublicBookExternalLinks(
  catalogBookId: string,
): Promise<PublicBookExternalLink[]> {
  const rows = await db
    .select({
      id: BookExternalLink.id,
      provider: BookExternalLink.provider,
      type: BookExternalLink.type,
      url: BookExternalLink.url,
      label: BookExternalLink.label,
    })
    .from(BookExternalLink)
    .where(
      and(
        eq(BookExternalLink.catalogBookId, catalogBookId),
        eq(BookExternalLink.isActive, true),
      ),
    )
    .orderBy(
      asc(BookExternalLink.sortOrder),
      asc(BookExternalLink.provider),
      asc(BookExternalLink.createdAt),
    );

  return rows.map((row) => {
    const provider = normalizeExternalBookLinkProvider(row.provider);
    const type = normalizeExternalBookLinkType(row.type);
    return {
      id: row.id,
      provider,
      type,
      url: row.url,
      label: externalLinkDisplayLabel({ provider, type, label: row.label }),
    };
  });
}

/** لینک‌های ورودی را پاک‌سازی و یکتا (بر اساس provider+url) می‌کند. */
function sanitizeLinks(links: ExternalLinkInput[]) {
  const seen = new Set<string>();
  const out: Array<{
    provider: ExternalLinkProviderValue;
    type: ExternalLinkTypeValue;
    url: string;
    label: string | null;
    isActive: boolean;
    sortOrder: number;
  }> = [];

  links.forEach((link, index) => {
    const url = link.url.trim();
    if (!url) return; // ردیف‌های خالی نادیده گرفته می‌شوند
    const provider = normalizeExternalBookLinkProvider(link.provider);
    const key = `${provider}::${url.toLowerCase()}`;
    if (seen.has(key)) return; // جلوگیری از تکرار
    seen.add(key);
    out.push({
      provider,
      type: normalizeExternalBookLinkType(link.type),
      url,
      label: link.label?.trim() ? link.label.trim() : null,
      isActive: link.isActive ?? true,
      sortOrder: link.sortOrder ?? index,
    });
  });

  return out;
}

/**
 * لینک‌های بیرونیِ یک کتاب را به‌صورت replace-all ذخیره می‌کند: همه‌ی لینک‌های
 * قبلی حذف و مجموعه‌ی جدید درج می‌شود (یکتا و بدون تکرار). در صورت ارسال tx،
 * در همان تراکنش اجرا می‌شود تا با ساخت/ویرایش کتاب اتمیک بماند.
 */
export async function upsertBookExternalLinks(
  catalogBookId: string,
  links: ExternalLinkInput[],
  tx: DbClient = db,
): Promise<void> {
  const clean = sanitizeLinks(links);

  await tx
    .delete(BookExternalLink)
    .where(eq(BookExternalLink.catalogBookId, catalogBookId));

  if (clean.length === 0) return;

  await tx.insert(BookExternalLink).values(
    clean.map((link, index) => ({
      catalogBookId,
      provider: link.provider,
      type: link.type,
      url: link.url,
      label: link.label,
      isActive: link.isActive,
      sortOrder: link.sortOrder ?? index,
    })),
  );
}

const cachedPublicBookExternalLinks = cachePublicData(loadPublicBookExternalLinks, "lib/book/external-links.ts:getPublicBookExternalLinks", 300);
export async function getPublicBookExternalLinks(...args: Parameters<typeof loadPublicBookExternalLinks>): ReturnType<typeof loadPublicBookExternalLinks> {
  return cachedPublicBookExternalLinks(...args);
}
