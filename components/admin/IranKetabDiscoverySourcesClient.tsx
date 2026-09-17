"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play, Plus, RefreshCw, RotateCcw } from "lucide-react";

import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, DiscoveryBadge, formatDate } from "./IranKetabDiscoveryUi";

type Source = {
  id: string;
  name: string;
  sourceUrl: string;
  crawlStatus: string;
  publisherImportStatus: "IDLE" | "RUNNING" | "PAUSED" | "COMPLETED";
  discoveredBookCount: number;
  newBookCount: number;
  updatedAt: string;
};

type PublisherStatus = {
  source: {
    crawlStatus: string;
    publisherImportStatus: "IDLE" | "RUNNING" | "PAUSED" | "COMPLETED";
    publisherImportStartedAt: string | null;
    publisherImportCompletedAt: string | null;
    discoveredBookCount: number;
    newBookCount: number;
    lastErrorMessage: string | null;
  };
  run: {
    pagesFetched: number;
    booksFound: number;
    startedAt: string;
    completedAt: string | null;
  } | null;
  counts: {
    items: Record<string, number>;
    jobs: Record<string, number>;
  };
  progress: { total: number; imported: number; attention: number; remaining: number; percent: number };
  backgroundWorkerEnabled: boolean;
  logs: Array<{ label: string; status: string }>;
};

export default function IranKetabDiscoverySourcesClient() {
  const [sources, setSources] = useState<Source[]>([]);
  const [publisherUrl, setPublisherUrl] = useState("");
  const [publisherSourceId, setPublisherSourceId] = useState<string | null>(null);
  const [publisherStatus, setPublisherStatus] = useState<PublisherStatus | null>(null);
  const [publisherProcessing, setPublisherProcessing] = useState(false);
  const publisherProcessingRef = useRef(false);
  const [publisherWorking, setPublisherWorking] = useState(false);
  const [publisherControlWorking, setPublisherControlWorking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const activePublisherSourceId = sources.find((source) => source.publisherImportStatus === "RUNNING")?.id
    ?? (publisherStatus?.source.publisherImportStatus === "RUNNING" ? publisherSourceId : null);

  const loadSources = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<{ sources: Source[] }>(
        "/api/admin/iranketab-discovery/sources?page=1&sourceType=PUBLISHER",
      );
      setSources(data.sources);
      setPublisherSourceId((current) =>
        current && data.sources.some((source) => source.id === current)
          ? current
          : data.sources.find((source) => source.publisherImportStatus === "RUNNING")?.id ?? data.sources[0]?.id ?? null,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "بارگذاری ورودهای قبلی ناموفق بود");
    } finally {
      setLoading(false);
    }
  }, []);

  const kickPublisherQueue = useCallback(async () => {
    if (!activePublisherSourceId || publisherProcessingRef.current) return;
    publisherProcessingRef.current = true;
    setPublisherProcessing(true);
    try {
      await apiFetch("/api/admin/iranketab-discovery/publisher/process", {
        method: "POST",
        body: JSON.stringify({ sourceId: activePublisherSourceId }),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "پردازش صف ورود ناموفق بود");
    } finally {
      publisherProcessingRef.current = false;
      setPublisherProcessing(false);
    }
  }, [activePublisherSourceId]);

  const refreshPublisherStatus = useCallback(async () => {
    if (!publisherSourceId) return;
    try {
      const nextStatus = await apiFetch<PublisherStatus>(
          `/api/admin/iranketab-discovery/publisher/status?sourceId=${encodeURIComponent(publisherSourceId)}`,
      );
      setPublisherStatus(nextStatus);
      setSources((current) => current.map((source) => source.id === publisherSourceId
        ? { ...source, publisherImportStatus: nextStatus.source.publisherImportStatus }
        : source));
      if (activePublisherSourceId) void kickPublisherQueue();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "بارگذاری وضعیت ورود ناموفق بود");
    }
  }, [activePublisherSourceId, kickPublisherQueue, publisherSourceId]);

  useEffect(() => { void loadSources(); }, [loadSources]);
  useEffect(() => {
    if (!publisherSourceId) return;
    void refreshPublisherStatus();
    const timer = setInterval(() => void refreshPublisherStatus(), 5000);
    return () => clearInterval(timer);
  }, [publisherSourceId, refreshPublisherStatus]);

  async function startPublisherImport(event: React.FormEvent) {
    event.preventDefault();
    setPublisherWorking(true);
    setError("");
    setNotice("");
    try {
      const data = await apiFetch<{ source: { id: string } }>(
        "/api/admin/iranketab-discovery/publisher",
        { method: "POST", body: JSON.stringify({ url: publisherUrl }) },
      );
      setPublisherSourceId(data.source.id);
      setPublisherUrl("");
      setNotice("ورود شروع شد. وضعیت مراحل و لاگ‌ها در همین صفحه به‌روز می‌شود.");
      await loadSources();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "شروع ورود خودکار ناموفق بود");
    } finally {
      setPublisherWorking(false);
    }
  }

  async function controlPublisher(action: "PAUSE" | "RESUME" | "RETRY_FAILED") {
    if (!publisherSourceId) return;
    setPublisherControlWorking(true);
    setError("");
    setNotice("");
    try {
      const data = await apiFetch<{ message: string }>(
        "/api/admin/iranketab-discovery/publisher/control",
        { method: "POST", body: JSON.stringify({ sourceId: publisherSourceId, action }) },
      );
      setNotice(data.message);
      await Promise.all([loadSources(), refreshPublisherStatus()]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تغییر وضعیت ورود ناموفق بود");
    } finally {
      setPublisherControlWorking(false);
    }
  }

  return <div className="space-y-6">
    <AdminPageHeader
      title="ورود خودکار از ایران‌کتاب"
      description="لینک صفحهٔ یک انتشارات را وارد کنید؛ بقیهٔ مراحل خودکار انجام می‌شود."
      action={<Button variant="outline" onClick={() => void loadSources()} disabled={loading}><RefreshCw className="h-4 w-4" />به‌روزرسانی</Button>}
    />
    {error ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p> : null}
    {notice ? <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p> : null}

    <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
      <h2 className="text-base font-black">شروع ورود کتاب‌های انتشارات</h2>
      <p className="mt-1 text-sm text-muted-foreground">فقط لینک را بفرستید؛ صفحه‌بندی، کتاب‌ها و ورود تدریجی در پس‌زمینه مدیریت می‌شود.</p>
      <form onSubmit={startPublisherImport} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Input dir="ltr" type="url" value={publisherUrl} onChange={(event) => setPublisherUrl(event.target.value)} placeholder="https://www.iranketab.ir/publisher/1800-..." required className="flex-1 bg-background" />
        <Button type="submit" disabled={publisherWorking}>
          <span className="relative inline-flex h-4 w-4" aria-hidden="true">
            <Loader2 className={`absolute inset-0 h-4 w-4 ${publisherWorking ? "animate-spin opacity-100" : "opacity-0"}`} />
            <Plus className={`absolute inset-0 h-4 w-4 ${publisherWorking ? "opacity-0" : "opacity-100"}`} />
          </span>
          {publisherWorking ? "در حال شروع…" : "شروع ورود"}
        </Button>
      </form>
    </section>

    {publisherStatus ? <PublisherProgress status={publisherStatus} processing={publisherProcessing} controlWorking={publisherControlWorking} onControl={controlPublisher} /> : null}

    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-black">انتشاراتی که تاکنون وارد شده‌اند</h2><p className="mt-1 text-sm text-muted-foreground">برای دیدن گزارش هر مورد، روی آن کلیک کنید.</p></div>{loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {sources.map((source) => <button key={source.id} type="button" onClick={() => setPublisherSourceId(source.id)} className={`rounded-xl border p-4 text-right transition-colors hover:border-primary/50 ${publisherSourceId === source.id ? "border-primary bg-primary/5" : ""}`}>
          <div className="flex items-center justify-between gap-2"><span className="font-bold">{source.name}</span><DiscoveryBadge value={publisherBadgeValue(source.publisherImportStatus)} label={publisherStatusLabel(source.publisherImportStatus)} /></div>
          <p className="mt-2 text-xs text-muted-foreground">{source.discoveredBookCount.toLocaleString("fa-IR")} کتاب پیدا شده · {source.newBookCount.toLocaleString("fa-IR")} مورد جدید</p>
          <p className="mt-1 text-[11px] text-muted-foreground">آخرین تغییر: {formatDate(source.updatedAt)}</p>
        </button>)}
      </div>
      {!loading && !sources.length ? <p className="py-6 text-center text-sm text-muted-foreground">هنوز ورود خودکاری ثبت نشده است.</p> : null}
    </section>
  </div>;
}

function PublisherProgress({ status, processing, controlWorking, onControl }: { status: PublisherStatus; processing: boolean; controlWorking: boolean; onControl: (action: "PAUSE" | "RESUME" | "RETRY_FAILED") => void }) {
  const publisherState = status.source.publisherImportStatus;
  const hasFailures = (status.counts.jobs.FAILED ?? 0) > 0;
  const stage = status.source.crawlStatus === "RUNNING"
    ? "در حال خواندن صفحه‌های ناشر"
    : publisherState === "RUNNING"
      ? "در حال ورود کتاب‌ها"
      : publisherState === "PAUSED"
        ? "متوقف‌شده؛ آمادهٔ ادامه"
        : publisherState === "COMPLETED"
          ? hasFailures || status.progress.attention ? "تمام‌شده با موارد نیازمند بررسی" : "همهٔ کتاب‌ها وارد شدند"
          : "آمادهٔ شروع";
  const badge = publisherBadgeValue(publisherState);

  return <section className="rounded-2xl border bg-card p-5 shadow-sm" aria-live="polite">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-black">گزارش ورود</h2><p className="mt-1 text-sm text-primary">مرحلهٔ فعلی: {stage}</p>{processing ? <p className="mt-1 text-xs text-muted-foreground">کتاب جاری در حال پردازش است…</p> : null}</div><div className="flex flex-wrap items-center gap-2"><DiscoveryBadge value={badge} label={stage} />{publisherState === "RUNNING" ? <Button size="sm" variant="outline" onClick={() => onControl("PAUSE")} disabled={controlWorking}><Pause className="h-4 w-4" />توقف</Button> : <Button size="sm" onClick={() => onControl("RESUME")} disabled={controlWorking}><Play className="h-4 w-4" />{publisherState === "PAUSED" ? "ادامه" : "فعال‌کردن"}</Button>}{hasFailures ? <Button size="sm" variant="outline" onClick={() => onControl("RETRY_FAILED")} disabled={controlWorking}><RotateCcw className="h-4 w-4" />تلاش مجدد خطاها</Button> : null}</div></div>
    <div className="mt-4 overflow-hidden rounded-full bg-muted"><div className="h-2 bg-primary transition-all" style={{ width: `${status.progress.percent}%` }} /></div>
    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground"><span>{status.progress.percent.toLocaleString("fa-IR")}٪ تعیین‌تکلیف‌شده</span><span>{status.progress.remaining.toLocaleString("fa-IR")} مورد باقی‌مانده</span></div>
    {!status.backgroundWorkerEnabled && publisherState === "RUNNING" ? <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">پردازش پس‌زمینه روی سرور فعال نیست؛ تا زمان فعال‌کردن worker، این صفحه را باز نگه دارید.</p> : null}
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5"><Metric label="صفحه خوانده‌شده" value={status.run?.pagesFetched ?? 0} /><Metric label="کل کتاب‌ها" value={status.progress.total} /><Metric label="در صف ورود" value={(status.counts.jobs.PENDING ?? 0) + (status.counts.jobs.PROCESSING ?? 0)} /><Metric label="واردشده" value={status.progress.imported} /><Metric label="نیازمند بررسی" value={status.progress.attention} /></div>
    <div className="mt-5 grid gap-2"><p className="text-sm font-bold">لاگ مراحل</p>{status.logs.map((log, index) => <div key={`${log.label}-${index}`} className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs"><span className={log.status === "error" ? "text-destructive" : log.status === "warning" ? "text-amber-600" : log.status === "done" ? "text-emerald-600" : "text-primary"}>●</span><span className="break-all">{log.label}</span></div>)}</div>
  </section>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border bg-background px-3 py-2"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 text-lg font-black tabular-nums">{value.toLocaleString("fa-IR")}</p></div>; }

function publisherStatusLabel(status: Source["publisherImportStatus"]) {
  return ({ IDLE: "آماده", RUNNING: "فعال", PAUSED: "متوقف", COMPLETED: "تمام‌شده" } as const)[status];
}

function publisherBadgeValue(status: Source["publisherImportStatus"]) {
  return ({ IDLE: "IDLE", RUNNING: "RUNNING", PAUSED: "PAUSED", COMPLETED: "SUCCEEDED" } as const)[status];
}
