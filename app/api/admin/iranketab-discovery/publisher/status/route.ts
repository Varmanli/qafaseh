import { NextRequest } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";

import { assertAdminApi } from "@/lib/admin/permissions";
import { apiError, apiSuccess } from "@/lib/api/response";
import { db } from "@/db";
import {
  IranKetabDiscoveryImportJob,
  IranKetabDiscoveryItem,
  IranKetabDiscoveryMembership,
  IranKetabDiscoveryRun,
  IranKetabDiscoverySource,
} from "@/db/schema";
import { getIranKetabDiscoverySource } from "@/lib/discovery/iranketab/source-service";

export async function GET(req: NextRequest) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;

  const sourceId = req.nextUrl.searchParams.get("sourceId")?.trim();
  if (!sourceId) return apiError("شناسهٔ منبع الزامی است", 422, "SOURCE_ID_REQUIRED");

  const source = await getIranKetabDiscoverySource(sourceId);
  if (!source) return apiError("منبع کشف یافت نشد", 404, "DISCOVERY_SOURCE_NOT_FOUND");

  const [itemRows, jobRows, failedJobs, latestRun] = await Promise.all([
    db
      .select({ status: IranKetabDiscoveryItem.status, count: sql<number>`count(*)::int` })
      .from(IranKetabDiscoveryMembership)
      .innerJoin(IranKetabDiscoveryItem, eq(IranKetabDiscoveryMembership.discoveryItemId, IranKetabDiscoveryItem.id))
      .where(eq(IranKetabDiscoveryMembership.discoverySourceId, sourceId))
      .groupBy(IranKetabDiscoveryItem.status),
    db
      .select({ status: IranKetabDiscoveryImportJob.status, count: sql<number>`count(*)::int` })
      .from(IranKetabDiscoveryImportJob)
      .where(eq(IranKetabDiscoveryImportJob.discoverySourceId, sourceId))
      .groupBy(IranKetabDiscoveryImportJob.status),
    db
      .select({
        id: IranKetabDiscoveryImportJob.id,
        discoveryItemId: IranKetabDiscoveryImportJob.discoveryItemId,
        lastErrorCode: IranKetabDiscoveryImportJob.lastErrorCode,
        lastErrorMessage: IranKetabDiscoveryImportJob.lastErrorMessage,
        updatedAt: IranKetabDiscoveryImportJob.updatedAt,
        titleHint: IranKetabDiscoveryItem.titleHint,
        canonicalUrl: IranKetabDiscoveryItem.canonicalUrl,
      })
      .from(IranKetabDiscoveryImportJob)
      .innerJoin(IranKetabDiscoveryItem, eq(IranKetabDiscoveryImportJob.discoveryItemId, IranKetabDiscoveryItem.id))
      .where(and(
        eq(IranKetabDiscoveryImportJob.discoverySourceId, sourceId),
        eq(IranKetabDiscoveryImportJob.status, "FAILED"),
      ))
      .orderBy(desc(IranKetabDiscoveryImportJob.updatedAt))
      .limit(20),
    db
      .select({
        status: IranKetabDiscoveryRun.status,
        startedAt: IranKetabDiscoveryRun.startedAt,
        completedAt: IranKetabDiscoveryRun.completedAt,
        pagesFetched: IranKetabDiscoveryRun.pagesFetched,
        booksFound: IranKetabDiscoveryRun.booksFound,
        itemsInserted: IranKetabDiscoveryRun.itemsInserted,
        diagnostics: IranKetabDiscoveryRun.diagnostics,
        errorCode: IranKetabDiscoveryRun.errorCode,
        errorMessage: IranKetabDiscoveryRun.errorMessage,
      })
      .from(IranKetabDiscoveryRun)
      .where(eq(IranKetabDiscoveryRun.discoverySourceId, sourceId))
      .orderBy(desc(IranKetabDiscoveryRun.startedAt))
      .limit(1),
  ]);

  const items = toCounts(itemRows);
  const jobs = toCounts(jobRows);
  const run = latestRun[0] ?? source.recentRuns[0] ?? null;
  const logs = buildLogs(source, run, items, jobs);

  return apiSuccess({
    source: {
      id: source.id,
      name: source.name,
      crawlStatus: source.crawlStatus,
      publisherImportStatus: source.publisherImportStatus,
      publisherImportStartedAt: source.publisherImportStartedAt,
      publisherImportCompletedAt: source.publisherImportCompletedAt,
      discoveredBookCount: source.discoveredBookCount,
      newBookCount: source.newBookCount,
      lastErrorCode: source.lastErrorCode,
      lastErrorMessage: source.lastErrorMessage,
    },
    run,
    counts: { items, jobs },
    progress: buildProgress(items),
    errors: failedJobs,
    logs,
  });
}

function toCounts(rows: Array<{ status: string; count: number }>) {
  return Object.fromEntries(rows.map((row) => [row.status, row.count]));
}

function buildProgress(items: Record<string, number>) {
  const total = Object.values(items).reduce((sum, value) => sum + value, 0);
  const imported = items.IMPORTED ?? 0;
  const attention = (items.NEEDS_REVIEW ?? 0) + (items.FAILED ?? 0);
  const finished = imported + attention + (items.SKIPPED ?? 0);
  return {
    total,
    imported,
    attention,
    remaining: Math.max(0, total - finished),
    percent: total ? Math.round((finished / total) * 100) : 0,
  };
}

function buildLogs(
  source: { crawlStatus: string; publisherImportStatus: string; lastErrorMessage: string | null },
  run: { status: string; pagesFetched: number; booksFound: number; itemsInserted: number; diagnostics?: unknown; errorMessage?: string | null } | null,
  items: Record<string, number>,
  jobs: Record<string, number>,
) {
  const diagnostics = run?.diagnostics as { lastPageUrl?: string | null; stoppedReason?: string } | null;
  const logs = [
    { label: source.publisherImportStatus === "RUNNING" ? "این ناشر، ورودی فعال سیستم است" : source.publisherImportStatus === "PAUSED" ? "ورود این ناشر متوقف شده است" : source.publisherImportStatus === "COMPLETED" ? "صف این ناشر تعیین‌تکلیف شده است" : "منبع انتشارات آماده است", status: source.publisherImportStatus === "PAUSED" ? "warning" : "done" },
    { label: run ? `${run.pagesFetched} صفحه خوانده شد` : "در انتظار شروع خواندن صفحه‌ها", status: run ? "done" : "active" },
    { label: run ? `${run.booksFound} کتاب شناسایی شد` : "در انتظار شناسایی کتاب‌ها", status: run ? "done" : "pending" },
    { label: `${items.QUEUED ?? 0} کتاب در صف ورود قرار گرفت`, status: items.QUEUED ? "active" : run ? "done" : "pending" },
    { label: `${jobs.COMPLETED ?? 0} کتاب وارد شد`, status: jobs.COMPLETED ? "done" : "active" },
    { label: `${jobs.PENDING ?? 0} کار منتظر و ${jobs.PROCESSING ?? 0} کار در حال پردازش است`, status: jobs.PENDING || jobs.PROCESSING ? "active" : "done" },
    { label: `${items.NEEDS_REVIEW ?? 0} مورد نیازمند بررسی داخلی است`, status: items.NEEDS_REVIEW ? "warning" : "done" },
    ...(diagnostics?.lastPageUrl ? [{ label: `آخرین صفحه: ${diagnostics.lastPageUrl}`, status: "info" }] : []),
    ...(diagnostics?.stoppedReason ? [{ label: `پایان پیمایش: ${stoppedReasonLabel(diagnostics.stoppedReason)}`, status: "info" }] : []),
    ...((jobs.FAILED ?? 0) > 0 ? [{ label: `${jobs.FAILED} ورود با خطا ثبت شد`, status: "error" }] : []),
    ...(source.crawlStatus === "FAILED" || run?.status === "FAILED" ? [{ label: source.lastErrorMessage ?? run?.errorMessage ?? "اجرای منبع ناموفق بود", status: "error" }] : []),
  ];
  return logs;
}

function stoppedReasonLabel(value: string) {
  return ({
    NO_NEXT_PAGE: "صفحهٔ بعدی وجود نداشت",
    DUPLICATE_PAGE: "صفحهٔ تکراری شناسایی شد",
    MAX_PAGES: "به سقف صفحه‌های مجاز رسید",
    MAX_DISCOVERED_BOOKS: "به سقف کتاب‌های مجاز رسید",
  } as Record<string, string>)[value] ?? value;
}
