"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AlertTriangle,
  ExternalLink,
  LoaderCircle,
  RotateCcw,
  SearchCheck,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/common/ConfirmDialog";
import IranKetabDraftReview from "./IranKetabDraftReview";
import type { IranKetabExtractionEnvelope } from "@ghafaseh/iranketab-extractor";
import type { IranKetabMatchAnalysis } from "@/lib/importers/iranketab/match-analysis";
import {
  ImportStepper,
  ImportStickySummary,
  InitialGuide,
  RecoverableCard,
  RecentHistory,
  type RecentImport,
} from "./IranKetabImporterUi";
import IranKetabImportSuccess from "./IranKetabImportSuccess";
import {
  commitSuccessSchema,
  type CommitSuccess,
} from "@/lib/importers/iranketab/commit-contract";

type Analysis = {
  catalog: {
    status: string;
    selected: {
      title: string;
      authors: string;
      editionCount: number;
      reasons: string[];
      adminHref: string;
    } | null;
    candidates: Array<{
      id: string;
      title: string;
      authors: string;
      editionCount: number;
      confidence: string;
      reasons: string[];
      adminHref: string;
    }>;
  };
  editions: Array<{
    extractedIndex: number;
    sourceEditionCode: string;
    status: string;
    confidence: string;
    existingCatalogTitle: string | null;
    reasons: string[];
    adminHref: string | null;
  }>;
  entities: Array<{
    type: string;
    extractedName: string;
    status: string;
    confidence: string;
    candidate: { name: string; adminHref: string } | null;
    alternatives: Array<{ name: string; adminHref: string }>;
    requiresManualSelection: boolean;
  }>;
  conflicts: Array<{ id: string; message: string; blocksImport: boolean }>;
  warnings: Array<{ id: string; message: string }>;
  summary: {
    catalogStatus: string;
    totalExtractedEditions: number;
    newEditions: number;
    exactEditionMatches: number;
    possibleEditionMatches: number;
    conflictingEditions: number;
    exactEntityMatches: number;
    possibleEntityMatches: number;
    newEntities: number;
    entityConflicts: number;
    readiness: string;
    canProceedToReview: boolean;
    requiresManualReview: boolean;
  };
};
type PreviewResponse =
  | {
      success: true;
      sessionId: string;
      extraction: IranKetabExtractionEnvelope;
      preview: Preview;
      analysis: IranKetabMatchAnalysis;
    }
  | {
      success: false;
      error: { code: string; message: string; retryable: boolean };
    };
type Edition = {
  titleOverride: string | null;
  translators: string[];
  publisher: string | null;
  isbn10: string | null;
  isbn13: string | null;
  publishedYear: number | null;
  pageCount: number | null;
  sourceEditionCode: string;
  sourceUrl: string;
  description: string | null;
  coverCandidate: string | null;
};
type Preview = {
  catalog: {
    title: string;
    subtitle: string | null;
    originalTitle: string | null;
    authors: string[];
    sanitizedDescriptionHtml: string;
    genres: string[];
    country: string | null;
    language: string;
    firstPublishedYear: number | null;
    canonicalUrl: string;
    selectedEditionCode: string | null;
  };
  editions: Edition[];
  diagnostics: {
    editionsBeforeDeduplication: number;
    editionsAfterDeduplication: number;
    selectedEditionCode: string | null;
    warningCount: number;
    warnings: string[];
    missingFields: string[];
  };
};
type RecoverableSession = {
  id: string;
  sourceUrl: string;
  canonicalSourceUrl: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  extraction: IranKetabExtractionEnvelope | null;
  draft: import("@/lib/importers/iranketab/draft").IranKetabImportDraft | null;
  extractionFingerprint: string | null;
  preparedCovers: unknown[] | null;
  metadata: { analysis?: IranKetabMatchAnalysis; preview?: Preview } | null;
};
function workflowStageForSession(
  session: Pick<RecoverableSession, "status" | "preparedCovers">,
) {
  if (
    session.status === "IMPORTING_REFERENCES" ||
    session.status === "READY_TO_COMMIT"
  )
    return 3;
  if (session.status === "COVER_PREPARATION" || session.preparedCovers?.length)
    return 2;
  return 1;
}

export default function IranKetabPreviewClient({
  view = "summary",
}: {
  view?: "summary" | "details";
}) {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<Extract<
    PreviewResponse,
    { success: true }
  > | null>(null);
  const [error, setError] = useState<{
    message: string;
    retryable: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [editionFilter, setEditionFilter] = useState("ALL");
  const [draftDirty, setDraftDirty] = useState(false);
  const [workflowStage, setWorkflowStage] = useState(1);
  const [recent, setRecent] = useState<RecentImport[]>([]);
  const [terminalSuccess, setTerminalSuccess] = useState<CommitSuccess | null>(
    null,
  );
  const terminalSuccessRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const confirm = useConfirm();
  const [recoverable, setRecoverable] = useState<RecoverableSession | null>(
    null,
  );
  const [restored, setRestored] = useState<RecoverableSession | null>(null);
  const [showSamePageReview, setShowSamePageReview] = useState(false);
  const [isFreshImport, setIsFreshImport] = useState(true);
  const [resetGeneration, setResetGeneration] = useState(0);
  useEffect(() => {
    if (sessionStorage.getItem("iranketab:explicit-reset") === "1") {
      setWorkflowStage(1);
      setRecoverable(null);
      setRestored(null);
      return;
    }
    const savedPreview = sessionStorage.getItem("iranketab:preview");
    if (savedPreview) {
      try {
        const saved = JSON.parse(savedPreview) as {
          url: string;
          result: Extract<PreviewResponse, { success: true }>;
        };
        if (saved.result?.success) {
          setIsFreshImport(false);
          setUrl(saved.url);
          setResult(saved.result);
          setWorkflowStage(2);
        }
      } catch {
        sessionStorage.removeItem("iranketab:preview");
      }
    }
    const stored = sessionStorage.getItem("iranketab:last-success");
    if (stored) {
      const parsed = commitSuccessSchema.safeParse(JSON.parse(stored));
      if (parsed.success) {
        terminalSuccessRef.current = true;
        setIsFreshImport(false);
        setTerminalSuccess(parsed.data);
        setWorkflowStage(5);
      } else sessionStorage.removeItem("iranketab:last-success");
    }
    Promise.all([
      fetch("/api/admin/books/import-links/sessions/active").then((response) =>
        response.json(),
      ),
      fetch("/api/admin/books/import-history?page=1").then((response) =>
        response.json(),
      ),
    ])
      .then(
        ([active, history]: [
          { data?: { session?: RecoverableSession | null } },
          { data?: { rows?: Array<{ session: RecentImport }> } },
        ]) => {
          if (!terminalSuccessRef.current)
            setRecoverable(active.data?.session ?? null);
          setRecent(
            history.data?.rows?.map((item) => item.session).slice(0, 5) ?? [],
          );
        },
      )
      .catch(() => undefined);
  }, []);
  function continueSession() {
    if (
      !recoverable?.extraction ||
      !recoverable.metadata?.analysis ||
      !recoverable.metadata.preview
    )
      return;
    setRestored(recoverable);
    setUrl(recoverable.sourceUrl);
    setResult({
      success: true,
      sessionId: recoverable.id,
      extraction: recoverable.extraction,
      analysis: recoverable.metadata.analysis,
      preview: recoverable.metadata.preview,
    });
    setRecoverable(null);
    setWorkflowStage(workflowStageForSession(recoverable));
  }
  async function restartSession() {
    if (
      !(await confirm({
        title: "شروع ورود جدید؟",
        description:
          "فرآیند نیمه‌کاره در تاریخچه باقی می‌ماند و می‌توانید بعداً آن را بررسی کنید.",
        confirmLabel: "شروع ورود جدید",
        cancelLabel: "انصراف",
      }))
    )
      return;
    setRecoverable(null);
  }
  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (loading) return;
    if (
      recoverable &&
      !(await confirm({
        title: "شروع ورود جدید؟",
        description:
          "یک فرآیند نیمه‌کاره دارید. فرآیند فعلی در تاریخچه حفظ می‌شود و ورود جدید جداگانه ساخته خواهد شد.",
        confirmLabel: "شروع ورود جدید",
        cancelLabel: "ادامه فرآیند قبلی",
      }))
    )
      return;
    if (
      result &&
      draftDirty &&
      !(await confirm({
        title: "کنار گذاشتن پیش‌نویس؟",
        description:
          "تغییرات بررسی هنوز ذخیره نشده‌اند. آیا از کنار گذاشتن آن‌ها مطمئن هستید؟",
        confirmLabel: "کنار گذاشتن",
        cancelLabel: "انصراف",
      }))
    )
      return;
    setError(null);
    setIsFreshImport(false);
    sessionStorage.removeItem("iranketab:explicit-reset");
    setLoading(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch("/api/admin/books/import-links/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal: controller.signal,
      });
      const payload = (await response.json()) as PreviewResponse;
      if (!payload.success) {
        setError(payload.error);
        requestAnimationFrame(() => urlInputRef.current?.focus());
        return;
      }
      setResult(payload);
      setIsFreshImport(false);
      setShowSamePageReview(false);
      sessionStorage.setItem(
        "iranketab:preview",
        JSON.stringify({ url, result: payload }),
      );
      setWorkflowStage(2);
      setExpanded(false);
      requestAnimationFrame(() => summaryRef.current?.focus());
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError({
        message: "ارتباط با سرور برقرار نشد. دوباره تلاش کنید.",
        retryable: true,
      });
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setLoading(false);
      }
    }
  }
  async function resetImport(force = false) {
    if (
      !force && draftDirty &&
      !(await confirm({
        title: "کنار گذاشتن پیش‌نویس؟",
        description:
          "تغییرات بررسی هنوز ذخیره نشده‌اند. آیا از کنار گذاشتن آن‌ها مطمئن هستید؟",
        confirmLabel: "کنار گذاشتن",
        cancelLabel: "انصراف",
      }))
    )
      return;
    // Switch the rendered workflow to the empty form before any server cleanup.
    setIsFreshImport(true);
    setResetGeneration((generation) => generation + 1);
    setUrl("");
    setResult(null);
    setRecoverable(null);
    setRestored(null);
    setTerminalSuccess(null);
    terminalSuccessRef.current = false;
    setShowSamePageReview(false);
    setWorkflowStage(1);
    setExpanded(false);
    setDraftDirty(false);
    abortRef.current?.abort();
    abortRef.current = null;
    const sessionId = result?.sessionId ?? recoverable?.id ?? restored?.id;
    sessionStorage.setItem("iranketab:explicit-reset", "1");
    if (sessionId) await fetch(`/api/admin/books/import-links/sessions/${sessionId}/draft`, { method: "DELETE" }).catch(() => undefined);
    for (const storage of [sessionStorage, localStorage]) {
      for (let index = storage.length - 1; index >= 0; index -= 1) {
        const key = storage.key(index);
        if (key?.toLowerCase().includes("iranketab")) storage.removeItem(key);
      }
    }
    sessionStorage.setItem("iranketab:explicit-reset", "1");
    window.history.replaceState({}, "", window.location.pathname);
    setLoading(false);
    setUrl("");
    setResult(null);
    setShowSamePageReview(false);
    sessionStorage.removeItem("iranketab:preview");
    setError(null);
    setTerminalSuccess(null);
    terminalSuccessRef.current = false;
    setWorkflowStage(1);
    setExpanded(false);
    setDraftDirty(false);
    setRestored(null);
    setRecoverable(null);
    sessionStorage.removeItem("iranketab:last-success");
  }
  async function reset() { await resetImport(false); }
  async function handleNewImport() { await resetImport(true); }
  function handleImportSuccess(success: CommitSuccess) {
    setTerminalSuccess(success);
    terminalSuccessRef.current = true;
    setWorkflowStage(5);
    sessionStorage.setItem("iranketab:last-success", JSON.stringify(success));
    window.setTimeout(() => { void resetImport(true); }, 1800);
  }
  const editions = result?.preview.editions ?? [];
  const filtered = result
    ? editions.filter(
        (_, index) =>
          editionFilter === "ALL" ||
          result.analysis.editions[index]?.status === editionFilter,
      )
    : editions;
  const visible = expanded ? filtered : filtered.slice(0, 6);
  const draftReview = !isFreshImport && result ? (
    <IranKetabDraftReview
      key={`${result.sessionId}-${resetGeneration}`}
      sessionId={result.sessionId}
      extraction={result.extraction}
      analysis={result.analysis}
      onDirtyChange={setDraftDirty}
      onStageChange={setWorkflowStage}
      onSuccess={handleImportSuccess}
      recoveredDraft={restored?.id === result.sessionId ? restored.draft : null}
      recoveredPrepared={restored?.id === result.sessionId && restored.draft && restored.extractionFingerprint ? { draft: restored.draft, fingerprint: restored.extractionFingerprint, preparedCovers: restored.preparedCovers ?? [] } : null}
    />
  ) : null;
  if (view === "summary") {
    const summary = result?.analysis.summary;
    const warnings = result?.analysis.warnings.length ?? (error ? 1 : 0);
    const blocking =
      result?.analysis.conflicts.filter((item) => item.blocksImport).length ??
      (error ? 1 : 0);
    const stats = [
      [
        "کل موارد شناسایی‌شده",
        summary?.totalExtractedEditions ?? 0,
        "تمام نسخه‌های استخراج‌شده پس از پاک‌سازی",
      ],
      [
        "تعداد نسخه‌ها",
        summary?.totalExtractedEditions ?? 0,
        "نسخه‌هایی که برای ورود بررسی می‌شوند",
      ],
      ["هشدارها", warnings, "مواردی که بهتر است پیش از ثبت مرور شوند"],
      ["خطاهای مسدودکننده", blocking, "مواردی که تا رفع‌شدن مانع ثبت هستند"],
      [
        "رکوردهای جدید",
        summary?.newEditions ?? 0,
        "نسخه‌هایی که مورد مشابه ندارند",
      ],
      [
        "تطبیق‌های موجود",
        summary?.exactEditionMatches ?? 0,
        "نسخه‌هایی که با رکورد موجود تطبیق دارند",
      ],
    ] as const;
    return (
      <div className="w-full space-y-4 pb-8">
        <div className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur sm:p-5">
          <ImportStepper
            current={
              terminalSuccess ? 5 : result ? workflowStage : loading ? 0 : 0
            }
          />
          <div className="mt-4 flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xl font-black text-foreground">
                {terminalSuccess
                  ? "ورود با موفقیت انجام شد"
                  : result
                    ? "بررسی اولیه آماده است"
                    : "شروع ورود از ایران‌کتاب"}
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {result
                  ? result.preview.catalog.title
                  : "لینک کتاب را وارد کنید تا اطلاعات آن بررسی شود."}
              </p>
            </div>
            {!terminalSuccess ? (
              result ? (
                <Button asChild className="h-11 rounded-xl">
                  <Link href="/admin/books/import-links/details">
                    ادامه بررسی جزئیات
                  </Link>
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => urlInputRef.current?.focus()}
                  disabled={loading}
                  className="h-11 rounded-xl"
                >
                  بررسی اطلاعات
                </Button>
              )
            ) : null}
          </div>
          {error ? (
            <p className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error.message}
            </p>
          ) : null}
          <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Input
              ref={urlInputRef}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://www.iranketab.ir/book/..."
              dir="ltr"
              aria-label="نشانی صفحه کتاب ایران‌کتاب"
              disabled={loading}
              className="h-11 min-w-0"
            />
            <Button type="submit" disabled={loading || !url.trim()} className="h-11 shrink-0 px-5">
              <span className="relative size-4 shrink-0" aria-hidden>
                <LoaderCircle className={`absolute inset-0 size-4 ${loading ? "animate-spin opacity-100" : "opacity-0"}`} />
                <SearchCheck className={`absolute inset-0 size-4 ${loading ? "opacity-0" : "opacity-100"}`} />
              </span>
              بررسی
            </Button>
          </form>
          <span id="iranketab-workflow-control" className="sr-only" aria-hidden="true" />
        </div>
        {!terminalSuccess ? (
          <>
            <section className="rounded-2xl border border-border/70 bg-card/45 p-3 sm:p-4">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {stats.map(([label, value, help]) => (
                <Card key={label} className="min-h-[82px] border-border/60 bg-card/70 shadow-none">
                  <CardContent className="flex h-full items-center justify-between gap-3 p-3">
                    <p className="text-xl font-black tabular-nums text-foreground">
                      {value.toLocaleString("fa-IR")}
                    </p>
                    <p className="text-right text-xs font-bold leading-5 text-foreground/90">{label}</p>
                  </CardContent>
                </Card>
              ))}
              </div>
            </section>
            {result ? (() => {
              const profiles = result.extraction.diagnostics.relatedProfiles;
              const counts = {
                authors: profiles.filter((profile) => profile.type === "AUTHOR").length,
                translators: profiles.filter((profile) => profile.type === "TRANSLATOR").length,
                publishers: profiles.filter((profile) => profile.type === "PUBLISHER").length,
              };
              const warnings = profiles.filter((profile) => (profile.diagnostics?.length ?? 0) > 0).length;
              return (
                <section data-testid="iranketab-reference-enrichment-summary" className="rounded-2xl border border-border/70 bg-card/45 p-3 sm:p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-sm font-black text-foreground">بررسی پدیدآورندگان</h2>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">پروفایل نویسندگان، مترجمان و ناشر پیش از ادامه دریافت و برای تطبیق آماده شده است.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" onClick={() => setShowSamePageReview(true)} className="h-10 rounded-xl font-bold">
                        بررسی اطلاعات نویسندگان و ناشر
                      </Button>
                      {warnings > 0 ? <Button type="button" variant="outline" onClick={() => void submit()} disabled={loading} className="h-10 rounded-xl">
                        تلاش مجدد دریافت پروفایل‌ها
                      </Button> : null}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
                    {[["نویسندگان", counts.authors], ["مترجمان", counts.translators], ["ناشران", counts.publishers], ["هشدارهای غیرمسدودکننده", warnings]] .map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-border/60 bg-card/60 px-3 py-2 text-center">
                        <p className="text-lg font-black tabular-nums">{Number(value).toLocaleString("fa-IR")}</p>
                        <p className="text-[11px] text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })() : null}
            <div className="fixed inset-x-0 bottom-0 z-40 flex flex-col gap-2 border-t border-border/60 bg-background/95 px-4 py-3 shadow-[0_-16px_32px_-24px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-end sm:px-8">
              {result ? <Button type="button" onClick={() => setShowSamePageReview(true)} variant="outline" className="h-10 rounded-xl font-bold">بررسی کاورها</Button> : null}
              <Button type="button" variant="outline" onClick={handleNewImport} className="h-10 rounded-xl">افزودن کتاب جدید</Button>
              <Button
                asChild
                variant="outline"
                className="h-10 rounded-xl border-primary/25 bg-primary/5 font-bold"
                disabled={!result}
              >
                <Link href="/admin/books/import-links/details">
                  مشاهده و ویرایش جزئیات
                </Link>
              </Button>
              <Button asChild variant="ghost" className="rounded-xl">
                <Link href="/admin/books/import-history">تاریخچه ورود</Link>
              </Button>
            </div>
            {showSamePageReview ? <div className="mt-4">{draftReview}</div> : null}
          </>
        ) : (
          <IranKetabImportSuccess success={terminalSuccess} onRestart={reset} />
        )}
      </div>
    );
  }
  return (
    <div className="relative isolate pb-24 sm:pb-10">
      <div
        className="pointer-events-none absolute inset-x-0 -top-16 -z-10 h-80 overflow-hidden"
        aria-hidden
      >
        <div className="absolute right-[-8rem] top-0 size-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute left-[-10rem] top-20 size-80 rounded-full bg-sky-500/5 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-border/60 bg-card/80 shadow-[0_24px_80px_-48px_hsl(var(--foreground)/0.35)] backdrop-blur-xl">
          <div className="border-b border-border/60 bg-gradient-to-l from-primary/[0.08] via-transparent to-transparent px-4 py-4 sm:px-6 lg:px-8">
            <ImportStepper
              current={
                terminalSuccess ? 5 : result ? workflowStage : loading ? 0 : 0
              }
            />
          </div>

          {terminalSuccess ? (
            <div className="p-3 sm:p-5 lg:p-7">
              <IranKetabImportSuccess
                success={terminalSuccess}
                onRestart={() => {
                  sessionStorage.removeItem("iranketab:last-success");
                  terminalSuccessRef.current = false;
                  setTerminalSuccess(null);
                  setWorkflowStage(0);
                  setResult(null);
                  setUrl("");
                }}
              />
            </div>
          ) : (
            <div className="space-y-6 p-3 sm:p-5 lg:p-7">
              <ImportStickySummary
                title={
                  result ? result.preview.catalog.title : "شروع دریافت اطلاعات"
                }
                status={
                  loading
                    ? "در حال دریافت"
                    : result
                      ? "پیش‌نمایش آماده"
                      : "آماده شروع"
                }
                stats={
                  result
                    ? [
                        {
                          label: "کل نسخه‌ها",
                          value: result.analysis.summary.totalExtractedEditions,
                        },
                        {
                          label: "جدید",
                          value: result.analysis.summary.newEditions,
                          tone: "success",
                        },
                        {
                          label: "موجود",
                          value: result.analysis.summary.exactEditionMatches,
                        },
                        {
                          label: "حذف/تعارض",
                          value: result.analysis.summary.conflictingEditions,
                          tone: result.analysis.summary.conflictingEditions
                            ? "danger"
                            : "default",
                        },
                        {
                          label: "هشدارها",
                          value: result.analysis.warnings.length,
                          tone: result.analysis.warnings.length
                            ? "warning"
                            : "default",
                        },
                        {
                          label: "خطاهای مسدودکننده",
                          value: result.analysis.conflicts.filter(
                            (item) => item.blocksImport,
                          ).length,
                          tone: result.analysis.conflicts.some(
                            (item) => item.blocksImport,
                          )
                            ? "danger"
                            : "default",
                        },
                      ]
                    : [
                        { label: "کل موارد", value: 0 },
                        { label: "جدید", value: 0 },
                        { label: "موجود", value: 0 },
                        { label: "حذف‌شده", value: 0 },
                        {
                          label: "هشدارها",
                          value: error ? 1 : 0,
                          tone: error ? "warning" : "default",
                        },
                        {
                          label: "خطاها",
                          value: error ? 1 : 0,
                          tone: error ? "danger" : "default",
                        },
                      ]
                }
                secondary={
                  result ? (
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      منبع:{" "}
                      <span dir="ltr">
                        {result.preview.catalog.canonicalUrl}
                      </span>
                    </span>
                  ) : null
                }
                action={
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => submit()}
                    disabled={loading || !url.trim()}
                    className="rounded-xl"
                  >
                    {loading ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <SearchCheck className="size-4" />
                    )}
                    {result ? "دریافت مجدد" : "بررسی اطلاعات"}
                  </Button>
                }
              />
              {!result && recoverable ? (
                <RecoverableCard
                  session={recoverable}
                  onContinue={continueSession}
                  onRestart={restartSession}
                />
              ) : null}

              <div
                className="flex items-start gap-3 rounded-2xl border border-primary/15 bg-primary/[0.05] px-4 py-3 text-sm leading-7 text-muted-foreground"
                role="note"
              >
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <ShieldAlert className="size-4" aria-hidden />
                </span>
                <div>
                  <p className="font-bold text-foreground">
                    مرحله‌ای امن و قابل بازگشت
                  </p>
                  <p>در مرحله دریافت و بررسی، هیچ کتابی در سایت ثبت نمی‌شود.</p>
                </div>
              </div>

              <Card className="overflow-hidden rounded-[1.75rem] border-border/60 bg-background/70 shadow-none">
                <CardHeader className="border-b border-border/50 bg-muted/20 px-4 py-5 sm:px-6">
                  <div className="flex items-start gap-4">
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-primary/15 bg-primary/10 text-primary shadow-sm">
                      <SearchCheck className="size-6" />
                    </span>
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="text-lg font-black sm:text-xl">
                        {result
                          ? "منبع واردشده"
                          : "دریافت اطلاعات کتاب از ایران‌کتاب"}
                      </CardTitle>
                      <CardDescription className="max-w-3xl leading-7">
                        لینک دقیق صفحه کتاب را وارد کنید تا اطلاعات، نسخه‌ها و
                        مراجع آن پیش از ثبت نهایی تحلیل شوند.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 sm:p-6">
                  <form onSubmit={submit} className="space-y-4">
                    <div className="space-y-2">
                      <label
                        htmlFor="iranketab-url"
                        className="block text-sm font-extrabold text-foreground"
                      >
                        نشانی صفحه کتاب ایران‌کتاب
                      </label>
                      <div className="relative">
                        <Input
                          ref={urlInputRef}
                          id="iranketab-url"
                          type="url"
                          dir="ltr"
                          inputMode="url"
                          value={url}
                          onChange={(event) => setUrl(event.target.value)}
                          required
                          disabled={loading}
                          placeholder="https://www.iranketab.ir/book/1045-white-nights"
                          aria-invalid={Boolean(error)}
                          aria-describedby={
                            error ? "iranketab-url-error" : "iranketab-url-help"
                          }
                          className="h-14 rounded-2xl border-border/70 bg-card pl-4 pr-12 text-left shadow-sm transition-shadow focus-visible:ring-2 focus-visible:ring-primary/20"
                        />
                        <ExternalLink className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      </div>
                      <p
                        id="iranketab-url-help"
                        className="text-xs leading-6 text-muted-foreground"
                      >
                        فقط لینک HTTPS صفحه کتاب پذیرفته می‌شود.
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Button
                        type="submit"
                        disabled={loading || !url.trim()}
                        className="h-12 rounded-2xl px-6 font-bold shadow-sm sm:min-w-64"
                      >
                        <span className="relative size-4 shrink-0" aria-hidden>
                          <LoaderCircle
                            className={`absolute inset-0 size-4 transition-opacity ${
                              loading ? "animate-spin opacity-100" : "opacity-0"
                            }`}
                          />
                          <SearchCheck
                            className={`absolute inset-0 size-4 transition-opacity ${
                              loading ? "opacity-0" : "opacity-100"
                            }`}
                          />
                        </span>
                        <span>
                          {loading
                            ? "در حال دریافت و تحلیل اطلاعات..."
                            : "دریافت و بررسی اطلاعات"}
                        </span>
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        onClick={reset}
                        className="h-12 rounded-2xl px-5 text-muted-foreground"
                      >
                        <RotateCcw className="size-4" />
                        پاک‌کردن فرم
                      </Button>
                    </div>
                  </form>

                  {result ? (
                    <div className="mt-5" />
                  ) : null}

                  {loading ? (
                    <div
                      className="mt-5 flex items-center gap-3 rounded-2xl border border-primary/15 bg-primary/[0.04] px-4 py-3 text-sm text-muted-foreground"
                      role="status"
                    >
                      <LoaderCircle className="size-4 animate-spin text-primary" />
                      <span>در حال دریافت صفحه و استخراج اطلاعات کتاب...</span>
                    </div>
                  ) : null}

                  {error ? (
                    <div
                      className="mt-5 rounded-2xl border border-destructive/25 bg-destructive/[0.06] p-4"
                      role="alert"
                      id="iranketab-url-error"
                    >
                      <div className="flex items-start gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive">
                          <AlertTriangle className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-destructive">
                            {error.message}
                          </p>
                          {error.retryable ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="mt-3 rounded-xl border-destructive/20"
                              onClick={() => submit()}
                            >
                              تلاش دوباره
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {!result ? (
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,.75fr)]">
                  <InitialGuide />
                  <RecentHistory sessions={recent} />
                </div>
              ) : null}

              {result ? (
                <div
                  ref={summaryRef}
                  tabIndex={-1}
                  className="space-y-6 outline-none"
                >
                  <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                    <Card className="overflow-hidden rounded-[1.75rem] border-border/60 bg-background/70 shadow-none">
                      <CardHeader className="border-b border-border/50 bg-gradient-to-l from-primary/[0.07] via-transparent to-transparent px-5 py-6 sm:px-7">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                              استخراج موفق
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {result.preview.diagnostics.editionsAfterDeduplication.toLocaleString(
                                "fa-IR",
                              )}{" "}
                              نسخه نهایی
                            </span>
                          </div>
                          <CardTitle className="break-words text-2xl font-black leading-tight sm:text-3xl">
                            {result.preview.catalog.title}
                          </CardTitle>
                          <CardDescription className="text-sm leading-7">
                            {result.preview.catalog.originalTitle ||
                              result.preview.catalog.subtitle ||
                              "اطلاعات هویتی کتاب"}
                          </CardDescription>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-6 p-5 sm:p-7">
                        <div className="flex flex-wrap gap-2">
                          {result.preview.catalog.authors.map((name) => (
                            <Chip key={name}>{name}</Chip>
                          ))}
                          {result.preview.catalog.genres.map((name) => (
                            <Chip key={name}>{name}</Chip>
                          ))}
                        </div>

                        {result.preview.catalog.sanitizedDescriptionHtml ? (
                          <div
                            className="prose max-w-none break-words text-sm leading-8 dark:prose-invert prose-p:text-muted-foreground prose-a:text-primary"
                            dangerouslySetInnerHTML={{
                              __html:
                                result.preview.catalog.sanitizedDescriptionHtml,
                            }}
                          />
                        ) : (
                          <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                            توضیحی استخراج نشد.
                          </p>
                        )}

                        <a
                          href={result.preview.catalog.canonicalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex max-w-full items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-muted"
                        >
                          <ExternalLink className="size-4 shrink-0" />
                          <span className="truncate" dir="ltr">
                            {result.preview.catalog.canonicalUrl}
                          </span>
                        </a>
                      </CardContent>
                    </Card>

                    <aside className="grid content-start gap-3 sm:grid-cols-2 xl:grid-cols-1">
                      <Meta
                        label="کشور"
                        value={result.preview.catalog.country}
                        emphasized
                      />
                      <Meta
                        label="زبان"
                        value={result.preview.catalog.language}
                        emphasized
                      />
                      <Meta
                        label="سال نخستین انتشار"
                        value={result.preview.catalog.firstPublishedYear}
                        emphasized
                      />
                      <Meta
                        label="تعداد نسخه‌ها"
                        value={
                          result.preview.diagnostics.editionsAfterDeduplication
                        }
                        emphasized
                      />
                    </aside>
                  </section>

                  <AnalysisPanel
                    analysis={result.analysis}
                    filter={editionFilter}
                    onFilter={setEditionFilter}
                  />

                  {draftReview}

                  <Card className="overflow-hidden rounded-[1.75rem] border-border/60 bg-background/70 shadow-none">
                    <CardHeader className="flex-row items-start justify-between gap-4 border-b border-border/50 px-5 py-5 sm:px-7">
                      <div className="space-y-1">
                        <CardTitle className="text-lg font-black">
                          نسخه‌های استخراج‌شده
                        </CardTitle>
                        <CardDescription className="leading-6">
                          {result.preview.diagnostics.editionsBeforeDeduplication.toLocaleString(
                            "fa-IR",
                          )}{" "}
                          نسخه پیش از حذف موارد تکراری و{" "}
                          {result.preview.diagnostics.editionsAfterDeduplication.toLocaleString(
                            "fa-IR",
                          )}{" "}
                          نسخه نهایی
                        </CardDescription>
                      </div>
                      <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
                        {filtered.length.toLocaleString("fa-IR")} مورد
                      </span>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6">
                      <div className="grid gap-4 2xl:grid-cols-2">
                        {visible.map((edition) => (
                          <EditionCard
                            key={edition.sourceEditionCode}
                            edition={edition}
                          />
                        ))}
                      </div>
                      {filtered.length > 6 ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="mt-5 h-11 w-full rounded-2xl border-dashed"
                          onClick={() => setExpanded((value) => !value)}
                        >
                          {expanded
                            ? "نمایش نسخه‌های کمتر"
                            : `نمایش همه ${filtered.length.toLocaleString("fa-IR")} نسخه`}
                        </Button>
                      ) : null}
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden rounded-[1.75rem] border-border/60 bg-background/70 shadow-none">
                    <CardHeader className="border-b border-border/50 px-5 py-5 sm:px-7">
                      <CardTitle className="text-lg font-black">
                        هشدارها و جزئیات استخراج
                      </CardTitle>
                      <CardDescription>
                        وضعیت پاک‌سازی داده‌ها و مواردی که بهتر است پیش از ثبت
                        بررسی شوند.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5 p-4 sm:p-6">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Meta
                          label="هشدارها"
                          value={result.preview.diagnostics.warningCount}
                        />
                        <Meta
                          label="پیش از dedupe"
                          value={
                            result.preview.diagnostics
                              .editionsBeforeDeduplication
                          }
                        />
                        <Meta
                          label="پس از dedupe"
                          value={
                            result.preview.diagnostics
                              .editionsAfterDeduplication
                          }
                        />
                      </div>

                      {[
                        ...result.preview.diagnostics.warnings,
                        ...result.preview.diagnostics.missingFields,
                      ].length ? (
                        <ul className="grid gap-3 lg:grid-cols-2">
                          {[
                            ...result.preview.diagnostics.warnings,
                            ...result.preview.diagnostics.missingFields,
                          ].map((item, index) => (
                            <li
                              key={`${item}-${index}`}
                              className="flex gap-3 rounded-2xl border border-amber-500/15 bg-amber-500/[0.07] p-4 text-sm leading-7 text-amber-700 dark:text-amber-200"
                            >
                              <AlertTriangle className="mt-1 size-4 shrink-0" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.06] p-4 text-sm text-emerald-700 dark:text-emerald-300">
                          هشداری گزارش نشد.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-primary/15 bg-primary/[0.07] px-3 py-1.5 text-xs font-bold text-primary">
      {children}
    </span>
  );
}

function Meta({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string | number | null | undefined;
  emphasized?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-2xl border border-border/55 bg-card/70 p-4 shadow-sm ${
        emphasized ? "min-h-24" : ""
      }`}
    >
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd
        className={`mt-2 break-words font-black text-foreground ${
          emphasized ? "text-xl" : "text-sm"
        }`}
      >
        {typeof value === "number"
          ? value.toLocaleString("fa-IR")
          : (value ?? "—")}
      </dd>
    </div>
  );
}

function EditionCard({ edition }: { edition: Edition }) {
  return (
    <article className="group min-w-0 overflow-hidden rounded-[1.5rem] border border-border/60 bg-card/65 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 sm:p-5">
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="w-full shrink-0 sm:w-24">
          {edition.coverCandidate ? (
            <div className="overflow-hidden rounded-2xl border bg-muted shadow-sm">
              <Image
                src={edition.coverCandidate}
                alt={`پیش‌نمایش کاور ${edition.titleOverride ?? edition.sourceEditionCode}`}
                width={192}
                height={288}
                unoptimized
                className="aspect-[2/3] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="flex aspect-[2/3] w-full items-center justify-center rounded-2xl border border-dashed bg-muted/30 px-3 text-center text-xs leading-6 text-muted-foreground">
              بدون کاور امن
            </div>
          )}
          <span className="mt-2 hidden text-center text-[10px] text-muted-foreground sm:block">
            پیش‌نمایش منبع
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h3 className="break-words text-base font-black leading-7">
              {edition.titleOverride || `نسخه ${edition.sourceEditionCode}`}
            </h3>
            <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
              {edition.sourceEditionCode}
            </span>
          </div>

          <dl className="mt-4 grid gap-2 sm:grid-cols-2">
            <Meta label="ناشر" value={edition.publisher} />
            <Meta
              label="مترجم"
              value={edition.translators.join("، ") || null}
            />
            <Meta label="شابک" value={edition.isbn13 || edition.isbn10} />
            <Meta
              label="سال / صفحه"
              value={
                [edition.publishedYear, edition.pageCount]
                  .filter(Boolean)
                  .join(" / ") || null
              }
            />
          </dl>

          {edition.description ? (
            <p className="mt-4 line-clamp-3 break-words text-xs leading-6 text-muted-foreground">
              {edition.description}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function AnalysisPanel({
  analysis,
  filter,
  onFilter,
}: {
  analysis: Analysis;
  filter: string;
  onFilter: (value: string) => void;
}) {
  const labels: Record<string, string> = {
    NEW: "نسخه جدید",
    EXACT_MATCH: "تطبیق دقیق",
    POSSIBLE_MATCH: "تطبیق احتمالی",
    CONFLICT: "تعارض",
    INSUFFICIENT_DATA: "اطلاعات ناکافی",
    READY_FOR_REVIEW: "آماده بررسی",
    REQUIRES_ENTITY_SELECTION: "نیازمند انتخاب مرجع",
    REQUIRES_CATALOG_SELECTION: "نیازمند انتخاب کتاب",
    BLOCKED_BY_CONFLICT: "مسدود به‌دلیل تعارض",
    EXACT_MATCH_ENTITY: "تطبیق دقیق",
    AMBIGUOUS: "مبهم",
  };

  const catalogTitle =
    analysis.catalog.status === "NEW"
      ? "کتاب جدید تشخیص داده شد"
      : analysis.catalog.status === "EXACT_MATCH"
        ? "کتاب موجود شناسایی شد"
        : analysis.catalog.status === "CONFLICT"
          ? "تعارض در شناسایی کتاب"
          : "تطبیق احتمالی کتاب";

  return (
    <Card className="overflow-hidden rounded-[1.75rem] border-border/60 bg-background/70 shadow-none">
      <CardHeader className="border-b border-border/50 px-5 py-5 sm:px-7">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="space-y-1">
            <CardTitle className="text-lg font-black">
              تحلیل تطبیق با کاتالوگ
            </CardTitle>
            <CardDescription className="leading-6">
              این تحلیل فقط خواندنی است و هیچ تغییری در داده‌های سایت ایجاد
              نمی‌کند.
            </CardDescription>
          </div>
          <span className="w-fit rounded-full border border-primary/15 bg-primary/[0.06] px-3 py-1.5 text-xs font-bold text-primary">
            {labels[analysis.summary.readiness] ?? analysis.summary.readiness}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Meta
            label="وضعیت آمادگی"
            value={
              labels[analysis.summary.readiness] ?? analysis.summary.readiness
            }
          />
          <Meta label="نسخه جدید" value={analysis.summary.newEditions} />
          <Meta
            label="تطبیق دقیق نسخه"
            value={analysis.summary.exactEditionMatches}
          />
          <Meta
            label="تعارض نسخه"
            value={analysis.summary.conflictingEditions}
          />
        </div>

        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <SearchCheck className="size-4" />
            </span>
            <p className="font-black">{catalogTitle}</p>
          </div>

          {analysis.catalog.candidates.length ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {analysis.catalog.candidates.map((candidate) => (
                <div
                  key={candidate.id}
                  className="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm"
                >
                  <a
                    className="font-black text-primary hover:underline"
                    href={candidate.adminHref}
                  >
                    {candidate.title}
                  </a>
                  <p className="mt-1 text-foreground">
                    {candidate.authors} ·{" "}
                    {candidate.editionCount.toLocaleString("fa-IR")} نسخه
                  </p>
                  <p className="mt-2 leading-6 text-muted-foreground">
                    {candidate.reasons.join(" ")}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 rounded-2xl border border-border/50 bg-card/50 p-2">
          {[
            "ALL",
            "NEW",
            "EXACT_MATCH",
            "POSSIBLE_MATCH",
            "CONFLICT",
            "INSUFFICIENT_DATA",
          ].map((status) => (
            <Button
              key={status}
              type="button"
              size="sm"
              variant={filter === status ? "default" : "ghost"}
              className="rounded-xl"
              onClick={() => onFilter(status)}
            >
              {status === "ALL" ? "همه نسخه‌ها" : labels[status]}
            </Button>
          ))}
        </div>

        {analysis.entities.length ? (
          <div className="space-y-3">
            <p className="font-black">تطبیق مراجع</p>
            <div className="grid gap-3 lg:grid-cols-2">
              {analysis.entities.map((item) => (
                <div
                  key={`${item.type}:${item.extractedName}`}
                  className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-card/50 p-4 text-sm"
                >
                  <span className="font-black">{item.extractedName}</span>
                  <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                    {labels[item.status] ?? item.status}
                  </span>
                  {item.candidate ? (
                    <a
                      href={item.candidate.adminHref}
                      className="mr-auto font-bold text-primary hover:underline"
                    >
                      {item.candidate.name}
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {analysis.conflicts.length || analysis.warnings.length ? (
          <ul className="grid gap-3 lg:grid-cols-2">
            {[...analysis.conflicts, ...analysis.warnings].map((item) => (
              <li
                key={item.id}
                className="flex gap-3 rounded-2xl border border-amber-500/15 bg-amber-500/[0.07] p-4 text-sm leading-7 text-amber-700 dark:text-amber-200"
              >
                <AlertTriangle className="mt-1 size-4 shrink-0" />
                <span>{item.message}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
