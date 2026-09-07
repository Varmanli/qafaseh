"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
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
import Image from "next/image";
import AdminRichTextEditor from "@/components/admin/AdminRichTextEditor";
import { useConfirm } from "@/components/common/ConfirmDialog";
import {
  initializeIranKetabDraft,
  type IranKetabImportDraft,
  validateIranKetabDraft,
} from "@/lib/importers/iranketab/draft";
import { iranKetabDraftReducer } from "@/lib/importers/iranketab/draft-state";
import type { IranKetabExtractionEnvelope } from "@ghafaseh/iranketab-extractor";
import type { IranKetabMatchAnalysis } from "@/lib/importers/iranketab/match-analysis";
import {
  deriveImportWorkflowReadiness,
  workflowReadinessLabel,
  type ImportWorkflowReadiness,
} from "@/lib/importers/iranketab/workflow-readiness";
import {
  prepareCoversSuccessSchema,
  preparedDraftMatchesCurrent,
  type PreparedCoverResult,
  type PreparedDraft,
} from "@/lib/importers/iranketab/cover-contract";
import { deriveCoverUiState } from "@/lib/importers/iranketab/cover-ui-state";
import {
  commitSuccessSchema,
  type CommitSuccess,
} from "@/lib/importers/iranketab/commit-contract";
import IranKetabImportSuccess from "./IranKetabImportSuccess";

type CommitDiagnostic = { httpStatus: number; [key: string]: unknown };

function preparedDraftFromUnknown(value: unknown): PreparedDraft | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { preparedCovers?: unknown[] };
  const upgraded = {
    ...record,
    preparedCovers: record.preparedCovers?.map((item) => {
      if (
        !item ||
        typeof item !== "object" ||
        (item as { status?: string }).status !== "PREPARED"
      )
        return item;
      return {
        action: "USE_PREPARED",
        preparedAt: new Date(0).toISOString(),
        ...item,
      };
    }),
  };
  const parsed =
    prepareCoversSuccessSchema.shape.preparedDraft.safeParse(upgraded);
  return parsed.success ? parsed.data : null;
}

export default function IranKetabDraftReview({
  extraction,
  analysis,
  onDirtyChange,
  sessionId,
  recoveredDraft,
  recoveredPrepared,
  onStageChange,
  onSuccess,
}: {
  extraction: IranKetabExtractionEnvelope;
  analysis: IranKetabMatchAnalysis;
  onDirtyChange: (dirty: boolean) => void;
  sessionId: string;
  recoveredDraft?: IranKetabImportDraft | null;
  recoveredPrepared?: unknown;
  onStageChange?: (stage: number) => void;
  onSuccess?: (success: CommitSuccess) => void;
}) {
  const initial = useMemo(
    () => recoveredDraft ?? initializeIranKetabDraft(extraction, analysis),
    [extraction, analysis, recoveredDraft],
  );
  const [draft, dispatch] = useReducer(iranKetabDraftReducer, initial);
  const [open, setOpen] = useState<number | null>(null);
  const [filter, setFilter] = useState("ALL");
  const [serverIssues, setServerIssues] = useState<string[]>([]);
  const [commitDiagnostic, setCommitDiagnostic] = useState<CommitDiagnostic | null>(null);
  const [checking, setChecking] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "failed"
  >("idle");
  const [commitResult, setCommitResult] = useState<CommitSuccess | null>(null);
  const terminalRef = useRef(false);
  const [preparedDraft, setPreparedDraft] = useState<PreparedDraft | null>(() =>
    preparedDraftFromUnknown(recoveredPrepared),
  );
  const [coverResults, setCoverResults] = useState<PreparedCoverResult[]>(
    () => {
      return preparedDraftFromUnknown(recoveredPrepared)?.preparedCovers ?? [];
    },
  );
  const confirm = useConfirm();
  const commitGuard = useRef(false);
  const reviewRef = useRef<HTMLElement | null>(null);
  const [controlTarget, setControlTarget] = useState<HTMLElement | null>(null);
  useEffect(
    () =>
      setControlTarget(document.getElementById("iranketab-workflow-control")),
    [],
  );
  useEffect(() => {
    onStageChange?.(commitResult ? 6 : preparedDraft ? 4 : 2);
  }, [commitResult, preparedDraft, onStageChange]);
  useEffect(() => {
    dispatch({ type: "RESET", draft: initial });
  }, [initial]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty || terminalRef.current || commitResult) return;
    const timer = setTimeout(() => {
      setSaveState("saving");
      fetch(`/api/admin/books/import-links/sessions/${sessionId}/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft, extraction }),
      })
        .then((response) => {
          if (!response.ok) throw new Error("AUTOSAVE_FAILED");
          setSaveState("saved");
        })
        .catch(() => setSaveState("failed"));
    }, 500);
    return () => clearTimeout(timer);
  }, [commitResult, dirty, draft, extraction, sessionId]);
  useEffect(() => {
    if (preparedDraft && !preparedDraftMatchesCurrent(preparedDraft, draft)) {
      setPreparedDraft(null);
      setCoverResults([]);
      setServerIssues([
        "تصمیم‌ها پس از آماده‌سازی کاورها تغییر کرده‌اند؛ کاورها را دوباره آماده کنید.",
      ]);
    }
  }, [draft, preparedDraft]);
  useEffect(() => {
    const leave = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    addEventListener("beforeunload", leave);
    return () => removeEventListener("beforeunload", leave);
  }, [dirty]);
  const validation = validateIranKetabDraft(
    draft,
    new Set(draft.source.approvedCoverCandidateUrls),
  );
  const editions = draft.editions.filter(
    (item) => filter === "ALL" || item.action === filter,
  );
  const counts = {
    create: draft.editions.filter((x) => x.action === "CREATE_NEW").length,
    reuse: draft.editions.filter((x) => x.action === "REUSE_EXISTING").length,
    exclude: draft.editions.filter((x) => x.action === "EXCLUDE").length,
  };
  const unresolvedEntities = draft.entities.filter(
    (x) => x.action === "UNRESOLVED",
  );
  const blockingConflicts = draft.unresolvedIssues.filter((x) => x.blocking);
  const failedCovers = coverResults.filter((x) => x.status === "FAILED");
  const coverSummary = deriveCoverUiState(coverResults);
  const readiness = deriveImportWorkflowReadiness({
    draft,
    validation,
    coverResults,
    prepared: Boolean(preparedDraft),
    committing,
    success: Boolean(commitResult),
  });
  const relatedProfiles = extraction.diagnostics.relatedProfiles;
  const profileCounts = {
    AUTHOR: relatedProfiles.filter((profile) => profile.type === "AUTHOR").length,
    TRANSLATOR: relatedProfiles.filter((profile) => profile.type === "TRANSLATOR").length,
    PUBLISHER: relatedProfiles.filter((profile) => profile.type === "PUBLISHER").length,
  };
  const profileFailures = relatedProfiles.filter((profile) => (profile.diagnostics?.length ?? 0) > 0).length;
  const canContinue =
    !checking &&
    !preparing &&
    !committing &&
    readiness !== "BLOCKED_BY_CONFLICT" &&
    readiness !== "INVALID_DRAFT" &&
    readiness !== "REQUIRES_CATALOG_DECISION" &&
    readiness !== "REQUIRES_ENTITY_RESOLUTION" &&
    readiness !== "REQUIRES_EDITION_RESOLUTION";
  const warningCount = validation.issues.length + serverIssues.length;

  function focusTarget(selector: string, editionIndex?: number) {
    if (editionIndex !== undefined) setOpen(editionIndex);
    requestAnimationFrame(() => {
      const target = reviewRef.current?.querySelector<HTMLElement>(selector);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      requestAnimationFrame(() => target?.focus({ preventScroll: true }));
    });
  }
  async function runPrimaryAction() {
    if (
      readiness === "READY_FOR_COVER_IMPORT" ||
      readiness === "COVER_PREPARATION_PARTIAL"
    )
      return prepareCovers();
    if (readiness === "READY_FOR_FINAL_IMPORT") return commit();
    if (readiness === "INVALID_DRAFT") {
      await check();
      focusTarget(
        '[aria-invalid="true"], [data-workflow-invalid="true"], [data-workflow-summary="true"]',
      );
      return;
    }
    if (readiness === "REQUIRES_CATALOG_DECISION")
      return focusTarget('[data-workflow-catalog="true"]');
    if (readiness === "REQUIRES_ENTITY_RESOLUTION")
      return focusTarget('[data-workflow-entity-unresolved="true"]');
    if (readiness === "REQUIRES_EDITION_RESOLUTION") {
      const unresolved = draft.editions.find(
        (item) =>
          item.action === "EXCLUDE" && item.reason === "نیازمند تصمیم دستی",
      );
      return focusTarget(
        `[data-workflow-edition="${unresolved?.extractedEditionIndex ?? 0}"]`,
        unresolved?.extractedEditionIndex ?? 0,
      );
    }
    if (readiness === "BLOCKED_BY_CONFLICT")
      return focusTarget('[data-workflow-conflict="true"]');
    if (readiness === "COVER_PREPARATION_FAILED")
      return focusTarget('[data-workflow-cover-errors="true"]');
  }
  async function check() {
    setChecking(true);
    setServerIssues([]);
    try {
      const response = await fetch(
        "/api/admin/books/import-links/validate-draft",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        },
      );
      const json = (await response.json()) as {
        data?: { valid: boolean; issues: string[] };
        error?: { message: string };
      };
      setServerIssues(
        json.data?.issues ?? [json.error?.message ?? "اعتبارسنجی ناموفق بود."],
      );
    } catch {
      setServerIssues(["ارتباط با اعتبارسنجی سرور برقرار نشد."]);
    } finally {
      setChecking(false);
    }
  }
  async function prepareCovers() {
    setPreparing(true);
    try {
      const response = await fetch(
        "/api/admin/books/import-links/prepare-covers",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, extraction, draft }),
        },
      );
      const raw: unknown = await response.json();
      if (!response.ok) {
        const error = raw as { error?: string };
        setServerIssues([error.error ?? "آماده‌سازی کاورها ناموفق بود."]);
        return;
      }
      const parsed = prepareCoversSuccessSchema.safeParse(raw);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        setServerIssues([
          `پاسخ آماده‌سازی کاور معتبر نیست (${first?.path.join(".") || "response"}): ${first?.message ?? "ساختار ناشناخته"}`,
        ]);
        return;
      }
      setCoverResults(parsed.data.results);
      setPreparedDraft(parsed.data.preparedDraft);
      setServerIssues([]);
    } catch (error) {
      setServerIssues([
        error instanceof Error
          ? `خطا در پردازش پاسخ آماده‌سازی کاور: ${error.message}`
          : "ارتباط با سرویس آماده‌سازی کاور برقرار نشد.",
      ]);
    } finally {
      setPreparing(false);
    }
  }
  async function commit() {
    if (
      commitGuard.current ||
      !preparedDraft ||
      !(await confirm({
        title: "ثبت نهایی کتاب و نسخه‌ها",
        description:
          "پس از تأیید، اطلاعات انتخاب‌شده در سایت ثبت می‌شوند. لطفاً تصمیم‌ها را یک‌بار دیگر بررسی کنید.",
        confirmLabel: "ثبت نهایی",
        cancelLabel: "انصراف",
        destructive: false,
      }))
    )
      return;
    commitGuard.current = true;
    setCommitting(true);
    try {
      const response = await fetch("/api/admin/books/import-links/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, extraction, draft: preparedDraft }),
      });
      const raw: unknown = await response.json();
      const parsed = commitSuccessSchema.safeParse(raw);
      if (response.ok && parsed.success) {
        terminalRef.current = true;
        commitGuard.current = true;
        setServerIssues([]);
        setCommitDiagnostic(null);
        setCommitResult(parsed.data);
        onSuccess?.(parsed.data);
        sessionStorage.setItem(
          "iranketab:last-success",
          JSON.stringify(parsed.data),
        );
      } else {
        const error = raw as { error?: string; code?: string; diagnostic?: Record<string, unknown> };
        setServerIssues([
          error.error ??
            (parsed.success
              ? "ثبت نهایی ناموفق بود."
              : `پاسخ ثبت نهایی معتبر نیست: ${parsed.error.issues[0]?.path.join(".")}`),
        ]);
        setCommitDiagnostic(error.diagnostic ? { httpStatus: response.status, ...error.diagnostic } : null);
        if (error.code === "STALE_DRAFT") setPreparedDraft(null);
        if (error.code === "COVER_PROMOTION_FAILED") {
          setPreparedDraft(null);
          setCoverResults([]);
        }
      }
    } catch {
      setServerIssues(["ارتباط با سرویس ثبت نهایی برقرار نشد."]);
    } finally {
      if (!terminalRef.current) commitGuard.current = false;
      setCommitting(false);
    }
  }
  if (commitResult)
    return (
      <IranKetabImportSuccess
        success={commitResult}
        onRestart={() => {
          sessionStorage.removeItem("iranketab:last-success");
          location.assign("/admin/books/import-links");
        }}
      />
    );
  return (
    <section
      ref={reviewRef}
      className="relative space-y-6 pb-40 sm:pb-32"
      aria-label="بررسی و تصمیم‌گیری برای ورود کتاب"
    >
      <Card data-testid="iranketab-reference-enrichment-step" className="overflow-hidden rounded-3xl border-primary/20 shadow-sm">
        <CardHeader className="border-b border-border/50 px-5 py-4 sm:px-7">
          <CardTitle className="text-base font-black">بررسی پدیدآورندگان</CardTitle>
          <CardDescription>پروفایل‌های نویسندگان، مترجمان و ناشران همراه با استخراج کتاب دریافت و برای تطبیق آماده شده‌اند.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
          {(["AUTHOR", "TRANSLATOR", "PUBLISHER"] as const).map((type) => (
            <div key={type} className="rounded-2xl border border-border/60 bg-background/50 p-3">
              <p className="text-sm font-black">{type === "AUTHOR" ? "نویسندگان" : type === "TRANSLATOR" ? "مترجمان" : "ناشران"}</p>
              <p className="mt-1 text-2xl font-black text-primary">{profileCounts[type].toLocaleString("fa-IR")}</p>
              <p className="text-xs text-muted-foreground">پروفایل دریافت و تحلیل شد</p>
            </div>
          ))}
          <p className="text-xs leading-6 text-muted-foreground sm:col-span-3">
            {profileFailures > 0 ? `${profileFailures.toLocaleString("fa-IR")} پروفایل با هشدار دریافت شد؛ ورود کتاب متوقف نمی‌شود و می‌توانید جزئیات را بررسی کنید.` : "اطلاعات پروفایل‌ها برای تطبیق موجودی آماده است."}
          </p>
        </CardContent>
      </Card>
      {controlTarget
        ? createPortal(
            <div
              data-testid="import-workflow-top-control"
              className="sticky top-2 z-40 overflow-hidden rounded-2xl border border-primary/20 bg-card/95 p-3 shadow-lg shadow-foreground/[0.06] backdrop-blur supports-[backdrop-filter]:bg-card/85 sm:p-4"
              aria-live="polite"
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="space-y-2.5">
                  <div className="grid gap-2 text-sm sm:grid-cols-3">
                    <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 font-black text-primary">
                      وضعیت: {workflowReadinessLabel(readiness)}
                    </span>
                    <span>
                      نسخه‌ها:{" "}
                      {draft.editions
                        .filter((item) => item.action !== "EXCLUDE")
                        .length.toLocaleString("fa-IR")}{" "}
                      انتخاب‌شده
                    </span>
                    <span>
                      کاورها: {coverSummary.prepared.toLocaleString("fa-IR")}{" "}
                      آماده، {coverSummary.failed.toLocaleString("fa-IR")}{" "}
                      ناموفق
                    </span>
                    <span>
                      تصاویر مراجع: {(preparedDraft?.preparedReferenceImages?.filter((item) => item.status === "PREPARED").length ?? 0).toLocaleString("fa-IR")} آماده
                    </span>
                    <span>
                      خطاها:{" "}
                      {(
                        blockingConflicts.length +
                        unresolvedEntities.length +
                        coverSummary.failed
                      ).toLocaleString("fa-IR")}
                    </span>
                    <span>هشدارها: {warningCount.toLocaleString("fa-IR")}</span>
                  </div>
                  <p
                    className={
                      saveState === "failed"
                        ? "text-xs font-bold text-amber-600 dark:text-amber-400"
                        : "text-xs text-muted-foreground"
                    }
                  >
                    {saveState === "saving"
                      ? "در حال ذخیره پیش‌نویس..."
                      : saveState === "failed"
                        ? "ذخیره خودکار ناموفق بود؛ وضعیت کاورها تغییری نکرده است."
                        : saveState === "saved"
                          ? "پیش‌نویس ذخیره شد."
                          : "تغییرات به‌صورت خودکار ذخیره می‌شوند."}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  {blockingConflicts.length ||
                  unresolvedEntities.length ||
                  validation.issues.length ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        focusTarget(
                          '[data-workflow-conflict="true"], [data-workflow-entity-unresolved="true"], [data-workflow-invalid="true"]',
                        )
                      }
                    >
                      مشاهده موارد
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>,
            controlTarget,
          )
        : null}
      <Card
        data-workflow-summary="true"
        tabIndex={-1}
        data-state={
          validation.valid && !serverIssues.length ? "ready" : "attention"
        }
        className={
          validation.valid && !serverIssues.length
            ? "overflow-hidden rounded-3xl border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.06] via-card to-card shadow-sm"
            : "overflow-hidden rounded-3xl border-amber-500/30 bg-gradient-to-br from-amber-500/[0.06] via-card to-card shadow-sm"
        }
      >
        <CardHeader className="border-b border-border/60 bg-muted/15 pb-5">
          <CardTitle className="flex items-center gap-2.5 text-xl">
            {validation.valid && !serverIssues.length ? (
              <CheckCircle2 className="text-emerald-500" />
            ) : (
              <ShieldAlert className="text-amber-500" />
            )}
            آمادگی پیش‌نویس
          </CardTitle>
          <CardDescription>
            {validation.valid
              ? "تصمیم‌ ها در مرورگر نگهداری می‌شوند؛ مرحله انتقال هنوز اجرا نشده است."
              : "موارد زیر باید پیش از مرحله بعد حل شوند."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 p-5 sm:p-6">
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <span>جدید: {counts.create}</span>
            <span>استفاده از موجود: {counts.reuse}</span>
            <span>حذف‌شده: {counts.exclude}</span>
          </div>
          {[...validation.issues, ...serverIssues].length ? (
            <ul
              className="space-y-2 rounded-2xl border border-amber-500/20 bg-amber-500/[0.08] p-4 text-sm"
              role="alert"
              data-workflow-invalid="true"
              tabIndex={-1}
            >
          {[...validation.issues, ...serverIssues].map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08] p-4 text-sm font-bold text-emerald-600 dark:text-emerald-400">
              پیش‌نویس برای مرحله انتقال کاور آماده است.
            </p>
          )}
          {commitDiagnostic ? (
            <div className="space-y-3 rounded-2xl border border-sky-500/30 bg-sky-500/[0.06] p-4 text-sm" dir="ltr" data-testid="iranketab-commit-diagnostic">
              <div className="flex items-center justify-between gap-3" dir="rtl">
                <span className="font-bold">جزئیات تشخیصی خطای ثبت نهایی (توسعه)</span>
                <Button type="button" size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(JSON.stringify(commitDiagnostic, null, 2))}>کپی جزئیات خطا</Button>
              </div>
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-background/80 p-3 text-xs">{JSON.stringify(commitDiagnostic, null, 2)}</pre>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Card
        data-workflow-catalog="true"
        tabIndex={-1}
        className="overflow-hidden rounded-3xl border-border/70 shadow-sm"
      >
        <CardHeader className="border-b border-border/60 bg-muted/20">
          <CardTitle className="text-xl">تصمیم کاتالوگ</CardTitle>
          <CardDescription>
            URL منبع فقط‌خواندنی است: {draft.source.canonicalUrl}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap gap-2.5">
            <Button
              type="button"
              size="sm"
              variant={
                draft.catalog.action === "CREATE_NEW" ? "default" : "outline"
              }
              onClick={() =>
                dispatch({
                  type: "SET_CATALOG_ACTION",
                  catalog:
                    initial.catalog.action === "CREATE_NEW"
                      ? initial.catalog
                      : {
                          action: "CREATE_NEW",
                          fields: {
                            title: extraction.book.title,
                            subtitle: extraction.book.subtitle,
                            originalTitle: extraction.book.originalTitle,
                            description: extraction.book.description,
                            language: extraction.book.language,
                            firstPublishedYear:
                              extraction.book.firstPublishedYear,
                          },
                          authors: initial.entities.filter(
                            (x) => x.entityType === "AUTHOR",
                          ),
                          genres: initial.entities.filter(
                            (x) => x.entityType === "GENRE",
                          ),
                          country:
                            initial.entities.find(
                              (x) => x.entityType === "COUNTRY",
                            ) ?? null,
                        },
                })
              }
            >
              ساخت کتاب جدید
            </Button>
            <Button
              type="button"
              size="sm"
              variant={
                draft.catalog.action === "REUSE_EXISTING"
                  ? "default"
                  : "outline"
              }
              disabled={!analysis.catalog.selected}
              onClick={() =>
                analysis.catalog.selected &&
                dispatch({
                  type: "SET_CATALOG_ACTION",
                  catalog: {
                    action: "REUSE_EXISTING",
                    catalogId: analysis.catalog.selected.id,
                    fieldActions: [
                      "subtitle",
                      "originalTitle",
                      "description",
                      "language",
                      "firstPublishedYear",
                    ].map((field) => ({
                      field: field as "subtitle",
                      action: "KEEP_EXISTING" as const,
                    })),
                    authors: initial.entities.filter(
                      (x) => x.entityType === "AUTHOR",
                    ),
                    genres: initial.entities.filter(
                      (x) => x.entityType === "GENRE",
                    ),
                    country:
                      initial.entities.find(
                        (x) => x.entityType === "COUNTRY",
                      ) ?? null,
                  },
                })
              }
            >
              استفاده از کتاب موجود
            </Button>
          </div>
          {draft.catalog.action === "CREATE_NEW" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium">
                عنوان
                <Input
                  aria-invalid={!draft.catalog.fields.title.trim()}
                  value={draft.catalog.fields.title}
                  onChange={(e) =>
                    dispatch({
                      type: "PATCH_CATALOG_FIELDS",
                      fields: { title: e.target.value },
                    })
                  }
                />
              </label>
              <label className="space-y-2 text-sm font-medium">
                عنوان اصلی
                <Input
                  value={draft.catalog.fields.originalTitle ?? ""}
                  onChange={(e) =>
                    dispatch({
                      type: "PATCH_CATALOG_FIELDS",
                      fields: { originalTitle: e.target.value || null },
                    })
                  }
                />
              </label>
              <label className="space-y-2 text-sm font-medium">
                زبان
                <Input
                  value={draft.catalog.fields.language}
                  onChange={(e) =>
                    dispatch({
                      type: "PATCH_CATALOG_FIELDS",
                      fields: { language: e.target.value },
                    })
                  }
                />
              </label>
              <label className="space-y-2 text-sm font-medium">
                سال نخستین انتشار
                <Input
                  type="number"
                  value={draft.catalog.fields.firstPublishedYear ?? ""}
                  onChange={(e) =>
                    dispatch({
                      type: "PATCH_CATALOG_FIELDS",
                      fields: {
                        firstPublishedYear: e.target.value
                          ? Number(e.target.value)
                          : null,
                      },
                    })
                  }
                />
              </label>
              <div className="space-y-2 sm:col-span-2">
                <p className="text-sm font-bold">توضیحات</p>
                <AdminRichTextEditor
                  value={draft.catalog.fields.description ?? ""}
                  onChange={(description) =>
                    dispatch({
                      type: "PATCH_CATALOG_FIELDS",
                      fields: { description: description || null },
                    })
                  }
                />
              </div>
            </div>
          ) : (
            <p className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-sm leading-7">
              کتاب موجود انتخاب‌شده: {analysis.catalog.selected?.title}. تمام
              فیلدهای قابل ویرایش فعلاً به‌طور صریح «نگه‌داشتن مقدار سایت»
              هستند.
            </p>
          )}
        </CardContent>
      </Card>
      <Card className="overflow-hidden rounded-3xl border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-muted/20">
          <CardTitle>حل مراجع</CardTitle>
          <CardDescription>
            هر نویسنده، مترجم، ناشر، ژانر و کشور باید تصمیم صریح داشته باشد؛ در
            این مرحله هیچ مرجعی ساخته نمی‌شود.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          {draft.entities.map((entity, index) => {
            const candidate = analysis.entities.find(
              (x) =>
                x.type === entity.entityType &&
                x.extractedName === entity.extractedName,
            )?.candidate;
            return (
              <div
                data-workflow-entity-unresolved={
                  entity.action === "UNRESOLVED" ? "true" : undefined
                }
                tabIndex={entity.action === "UNRESOLVED" ? -1 : undefined}
                key={`${entity.entityType}-${entity.extractedName}-${index}`}
                className="group rounded-2xl border border-border/70 bg-card/70 p-4 text-sm shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md"
              >
                {entity.profile?.imageUrl ? <Image src={entity.profile.imageUrl} alt="" width={56} height={56} className="mb-3 h-14 w-14 rounded-xl object-cover" unoptimized /> : null}
                <p className="font-black">
                  {entity.extractedName}{" "}
                  <span className="text-muted-foreground">
                    ({entity.entityType})
                  </span>
                </p>
                {entity.profile ? <div className="mt-2 grid gap-2 text-xs text-muted-foreground">
                  <span>منبع: {entity.profile.sourceUrl ?? "بدون صفحه پروفایل"}</span>
                  {entity.profile.originalName !== undefined ? <Input aria-label={`نام اصلی ${entity.extractedName}`} placeholder="نام اصلی" value={entity.profile.originalName ?? ""} onChange={(e) => dispatch({ type: "SET_ENTITY", index, entity: { ...entity, profile: { ...entity.profile, originalName: e.target.value || null } } })} /> : null}
                  {entity.profile.description !== undefined ? <Input aria-label={`توضیحات ${entity.extractedName}`} placeholder="توضیحات" value={entity.profile.description ?? ""} onChange={(e) => dispatch({ type: "SET_ENTITY", index, entity: { ...entity, profile: { ...entity.profile, description: e.target.value || null } } })} /> : null}
                  <span>{entity.profile.countryName ?? "کشور نامشخص"} · {entity.profile.birthYear ?? "؟"}–{entity.profile.deathYear ?? "؟"}</span>
                </div> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {candidate ? (
                    <Button
                      size="sm"
                      type="button"
                      variant={
                        entity.action === "REUSE_EXISTING"
                          ? "default"
                          : "outline"
                      }
                      onClick={() =>
                        dispatch({
                          type: "SET_ENTITY",
                          index,
                          entity: {
                            action: "REUSE_EXISTING",
                            entityType: entity.entityType,
                            entityId: candidate.id,
                            extractedName: entity.extractedName,
                            displayName: candidate.name,
                            profile: entity.profile,
                            profileImageAction: "preserve",
                            bannerImageAction: "preserve",
                          },
                        })
                      }
                    >
                      استفاده از «{candidate.name}»
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    type="button"
                    variant={
                      entity.action === "CREATE_NEW" ? "default" : "outline"
                    }
                    onClick={() =>
                      dispatch({
                        type: "SET_ENTITY",
                        index,
                        entity: {
                          action: "CREATE_NEW",
                          entityType: entity.entityType,
                          extractedName: entity.extractedName,
                          proposedName:
                            entity.action === "CREATE_NEW"
                              ? entity.proposedName
                              : entity.extractedName,
                          profile: entity.profile,
                          profileImageAction: entity.action === "CREATE_NEW" ? entity.profileImageAction : "replace",
                          bannerImageAction: entity.action === "CREATE_NEW" ? entity.bannerImageAction : "replace",
                        },
                      })
                    }
                  >
                    ایجاد در مرحله بعد
                  </Button>
                  <Button size="sm" type="button" variant={entity.action === "IGNORE" ? "default" : "outline"} onClick={() => dispatch({ type: "SET_ENTITY", index, entity: { action: "IGNORE", entityType: entity.entityType, extractedName: entity.extractedName, reason: "نادیده‌گرفته‌شده توسط مدیر", profile: entity.profile } })}>
                    نادیده گرفتن
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    variant={
                      entity.action === "UNRESOLVED" ? "destructive" : "outline"
                    }
                    onClick={() =>
                      dispatch({
                        type: "SET_ENTITY",
                        index,
                        entity: {
                          action: "UNRESOLVED",
                          entityType: entity.entityType,
                          extractedName: entity.extractedName,
                          reason: "نیازمند بررسی مدیر",
                        },
                      })
                    }
                  >
                    حل‌نشده
                  </Button>
                </div>
                {entity.action === "CREATE_NEW" ? (
                  <Input
                    className="mt-3"
                    aria-label={`نام پیشنهادی ${entity.extractedName}`}
                    value={entity.proposedName}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_ENTITY",
                        index,
                        entity: { ...entity, proposedName: e.target.value },
                      })
                    }
                  />
                ) : null}
                {entity.action !== "IGNORE" && entity.action !== "UNRESOLVED" && entity.profile ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {(["profile", "banner"] as const).map((kind) => {
                      const field = kind === "profile" ? "profileImageAction" : "bannerImageAction";
                      const value = entity[field];
                      return <label key={kind} className="text-xs font-bold">{kind === "profile" ? "تصویر پروفایل" : "تصویر بنر"}
                        <select className="mt-1 h-9 w-full rounded-md border bg-background px-2" value={value} onChange={(e) => dispatch({ type: "SET_ENTITY", index, entity: { ...entity, [field]: e.target.value as "preserve" | "replace" | "remove" } })}>
                          <option value="preserve">حفظ موجود</option><option value="replace">جایگزینی</option><option value="remove">حذف صریح</option>
                        </select>
                      </label>;
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>
      <Card className="overflow-hidden rounded-3xl border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-muted/20">
          <CardTitle>نسخه‌ها و تصمیم کاور آینده</CardTitle>
          <CardDescription>
            هیچ کاوری در این مرحله دانلود یا آپلود نمی‌شود.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap gap-2.5">
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={() => dispatch({ type: "EXCLUDE_ALL" })}
            >
              حذف همه
            </Button>
            {["ALL", "CREATE_NEW", "REUSE_EXISTING", "EXCLUDE"].map((value) => (
              <Button
                key={value}
                size="sm"
                type="button"
                variant={filter === value ? "default" : "outline"}
                onClick={() => setFilter(value)}
              >
                {value === "ALL" ? "همه" : value}
              </Button>
            ))}
          </div>
          {editions.map((edition) => {
            const index = edition.extractedEditionIndex;
            const source = extraction.editions[index];
            const isOpen = open === index;
            return (
              <article
                key={index}
                data-workflow-edition={index}
                tabIndex={-1}
                className="overflow-hidden rounded-2xl border border-border/70 bg-card/60 shadow-sm transition-colors hover:border-primary/20"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 px-4 py-4 text-right transition-colors hover:bg-muted/35"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : index)}
                >
                  <span className="font-black">
                    {source?.titleOverride ||
                      `نسخه ${source?.sourceEditionCode ?? index + 1}`}
                  </span>
                  {isOpen ? <ChevronUp /> : <ChevronDown />}
                </button>
                {isOpen ? (
                  <div className="border-t border-border/60 bg-muted/[0.18] p-4 sm:p-5">
                    <div className="flex flex-wrap gap-2.5">
                      {["CREATE_NEW", "REUSE_EXISTING", "EXCLUDE"].map(
                        (action) => (
                          <Button
                            key={action}
                            type="button"
                            size="sm"
                            variant={
                              edition.action === action ? "default" : "outline"
                            }
                            disabled={
                              action === "REUSE_EXISTING" &&
                              !analysis.editions[index]?.existingEditionId
                            }
                            onClick={() => {
                              if (action === "EXCLUDE")
                                dispatch({
                                  type: "SET_EDITION",
                                  index,
                                  edition: {
                                    extractedEditionIndex: index,
                                    action: "EXCLUDE",
                                    reason: "تصمیم مدیر",
                                  },
                                });
                              else if (action === "REUSE_EXISTING")
                                dispatch({
                                  type: "SET_EDITION",
                                  index,
                                  edition: {
                                    ...initial.editions[index],
                                    action: "REUSE_EXISTING",
                                    editionId:
                                      analysis.editions[index]
                                        .existingEditionId!,
                                    fieldActions: [],
                                    translators: initial.entities.filter(
                                      (x) => x.entityType === "TRANSLATOR",
                                    ),
                                    publisher:
                                      initial.entities.find(
                                        (x) => x.entityType === "PUBLISHER",
                                      ) ?? null,
                                    coverAction: { action: "KEEP_EXISTING" },
                                  },
                                });
                              else
                                dispatch({
                                  type: "SET_EDITION",
                                  index,
                                  edition:
                                    initial.editions[index].action ===
                                    "CREATE_NEW"
                                      ? initial.editions[index]
                                      : {
                                          extractedEditionIndex: index,
                                          action: "CREATE_NEW",
                                          fields: {
                                            titleOverride: source.titleOverride,
                                            isbn10: source.isbn10,
                                            isbn13: source.isbn13,
                                            publishedYear: source.publishedYear,
                                            pageCount: source.pageCount,
                                            editionDescription:
                                              source.editionDescription,
                                            sourceEditionCode:
                                              source.sourceEditionCode,
                                            sourceUrl: source.sourceUrl,
                                          },
                                          translators: initial.entities.filter(
                                            (x) =>
                                              x.entityType === "TRANSLATOR",
                                          ),
                                          publisher:
                                            initial.entities.find(
                                              (x) =>
                                                x.entityType === "PUBLISHER",
                                            ) ?? null,
                                          coverAction:
                                            source &&
                                            draft.source
                                              .approvedCoverCandidateUrls[0]
                                              ? {
                                                  action: "IMPORT_SOURCE",
                                                  candidateUrl:
                                                    draft.source
                                                      .approvedCoverCandidateUrls[0],
                                                }
                                              : { action: "SKIP" },
                                        },
                                });
                            }}
                          >
                            {action}
                          </Button>
                        ),
                      )}
                    </div>
                    {edition.action === "CREATE_NEW" ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="space-y-2 text-sm font-medium">
                          ISBN-13
                          <Input
                            dir="ltr"
                            value={edition.fields.isbn13 ?? ""}
                            onChange={(e) =>
                              dispatch({
                                type: "SET_EDITION",
                                index,
                                edition: {
                                  ...edition,
                                  fields: {
                                    ...edition.fields,
                                    isbn13: e.target.value || null,
                                  },
                                },
                              })
                            }
                          />
                        </label>
                        <label className="space-y-2 text-sm font-medium">
                          ISBN-10
                          <Input
                            dir="ltr"
                            value={edition.fields.isbn10 ?? ""}
                            onChange={(e) =>
                              dispatch({
                                type: "SET_EDITION",
                                index,
                                edition: {
                                  ...edition,
                                  fields: {
                                    ...edition.fields,
                                    isbn10: e.target.value || null,
                                  },
                                },
                              })
                            }
                          />
                        </label>
                        <label className="space-y-2 text-sm font-medium">
                          سال انتشار
                          <Input
                            type="number"
                            value={edition.fields.publishedYear ?? ""}
                            onChange={(e) =>
                              dispatch({
                                type: "SET_EDITION",
                                index,
                                edition: {
                                  ...edition,
                                  fields: {
                                    ...edition.fields,
                                    publishedYear: e.target.value
                                      ? Number(e.target.value)
                                      : null,
                                  },
                                },
                              })
                            }
                          />
                        </label>
                        <label className="space-y-2 text-sm font-medium">
                          تعداد صفحات
                          <Input
                            type="number"
                            value={edition.fields.pageCount ?? ""}
                            onChange={(e) =>
                              dispatch({
                                type: "SET_EDITION",
                                index,
                                edition: {
                                  ...edition,
                                  fields: {
                                    ...edition.fields,
                                    pageCount: e.target.value
                                      ? Number(e.target.value)
                                      : null,
                                  },
                                },
                              })
                            }
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </CardContent>
      </Card>
      <Card className="overflow-hidden rounded-3xl border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-muted/20">
          <CardTitle>آماده‌سازی کاورها</CardTitle>
          <CardDescription>
            کاورهای انتخاب‌شده به WebP تبدیل و فقط در فضای موقت وارد می‌شوند؛
            هنوز به هیچ نسخه‌ای متصل نخواهند شد.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 p-5 sm:p-6">
          {coverResults.length ? (
            <p className="rounded-2xl border border-border/60 bg-muted/25 p-4 text-sm font-black">
              وضعیت: {coverSummary.status} ·{" "}
              {coverSummary.prepared.toLocaleString("fa-IR")} آماده،{" "}
              {coverSummary.failed.toLocaleString("fa-IR")} ناموفق
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              هنوز کاوری آماده نشده است.
            </p>
          )}
          {coverResults.length ? (
            <ul
              className="grid gap-3 text-sm sm:grid-cols-2"
              data-workflow-cover-errors="true"
              tabIndex={-1}
            >
              {coverResults.map((result) => (
                <li
                  key={result.extractedEditionIndex}
                  className="rounded-2xl border border-border/70 bg-card/70 p-4"
                >
                  <span className="font-black">
                    نسخه {result.extractedEditionIndex + 1}:{" "}
                    {result.status === "PREPARED"
                      ? "آماده"
                      : result.status === "FAILED"
                        ? "ناموفق"
                        : result.status === "KEPT_EXISTING"
                          ? "حفظ کاور موجود"
                          : "بدون انتقال"}
                  </span>
                  {result.status === "PREPARED" ? (
                    <div className="mt-3 space-y-3 text-xs text-muted-foreground">
                      <a
                        className="text-primary underline"
                        href={result.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        پیش‌نمایش آماده
                      </a>
                      <details className="rounded-xl border border-border/60 bg-muted/30 p-3">
                        <summary className="cursor-pointer font-bold">
                          جزئیات فنی
                        </summary>
                        <div className="mt-2 space-y-1">
                          <p dir="ltr" className="break-all">
                            {result.objectKey}
                          </p>
                          <p>
                            {result.width.toLocaleString("fa-IR")}×
                            {result.height.toLocaleString("fa-IR")} ·{" "}
                            {result.sizeBytes.toLocaleString("fa-IR")} بایت ·{" "}
                            {result.mimeType}
                          </p>
                          <time dateTime={result.preparedAt}>
                            {new Date(result.preparedAt).toLocaleString(
                              "fa-IR",
                            )}
                          </time>
                          <p dir="ltr" className="break-all">
                            fingerprint: {preparedDraft?.fingerprint}
                          </p>
                        </div>
                      </details>
                    </div>
                  ) : null}
                  {result.status === "FAILED" ? (
                    <span className="mr-2 text-destructive">
                      {result.error.message}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {preparedDraft ? <ContributorImportPanel draft={draft} preparedDraft={preparedDraft} /> : null}
        </CardContent>
      </Card>
      {blockingConflicts.length ? (
        <Card
          data-workflow-conflict="true"
          tabIndex={-1}
          className="border-destructive/30 bg-destructive/[0.025] shadow-sm"
        >
          <CardHeader>
            <CardTitle>تعارض‌های مسدودکننده</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3 text-sm sm:grid-cols-2">
              {blockingConflicts.map((issue) => (
                <li
                  key={issue.id}
                  className="rounded-2xl border border-destructive/20 bg-destructive/[0.08] p-4 text-destructive"
                >
                  {issue.message}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
      {readiness !== "SUCCESS" ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/95 px-4 py-3 shadow-[0_-12px_30px_-20px_hsl(var(--foreground)/0.45)] backdrop-blur-xl sm:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div aria-hidden="true" />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl px-5"
                onClick={() => focusTarget('[data-workflow-summary="true"]')}
              >
                بازگشت و ویرایش اطلاعات
              </Button>
              <WorkflowActionSummary readiness={readiness}
                unresolvedCount={unresolvedEntities.length}
                blockingCount={blockingConflicts.length}
                failedCoverCount={failedCovers.length}
                disabled={!canContinue}
                onAction={runPrimaryAction}
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ContributorImportPanel({ draft, preparedDraft }: { draft: IranKetabImportDraft; preparedDraft: PreparedDraft }) {
  const entities = draft.entities.filter((entity) => entity.entityType === "AUTHOR" || entity.entityType === "TRANSLATOR" || entity.entityType === "PUBLISHER");
  const staged = preparedDraft.preparedReferenceImages ?? [];
  const completed = entities.filter((entity) => entity.action === "IGNORE" || staged.some((image) => image.entityType === entity.entityType && image.extractedName === entity.extractedName && image.status === "PREPARED") || !entity.profile?.imageUrl).length;
  const groups = (["AUTHOR", "TRANSLATOR", "PUBLISHER"] as const).map((type) => {
    const items = entities.filter((entity) => entity.entityType === type);
    const warnings = items.filter((entity) => staged.some((image) => image.entityType === type && image.extractedName === entity.extractedName && image.status === "FAILED")).length;
    return { type, items, warnings };
  });
  return <Card data-testid="iranketab-contributor-step" className="overflow-hidden rounded-3xl border-primary/20 shadow-sm">
    <CardHeader className="border-b border-border/60 bg-primary/[0.04]"><CardTitle>ایمپورت نویسندگان، مترجمان و ناشران</CardTitle><CardDescription>در حال آماده‌سازی اطلاعات اشخاص — {completed.toLocaleString("fa-IR")} از {entities.length.toLocaleString("fa-IR")}</CardDescription></CardHeader>
    <CardContent className="grid gap-3 p-5 sm:grid-cols-3">{groups.map(({ type, items, warnings }) => <details key={type} open className="rounded-2xl border p-3"><summary className="cursor-pointer font-black">{type === "AUTHOR" ? "نویسندگان" : type === "TRANSLATOR" ? "مترجمان" : "ناشران"} · {items.length.toLocaleString("fa-IR")} · هشدار {warnings.toLocaleString("fa-IR")}</summary><ul className="mt-3 space-y-2 text-sm">{items.map((entity) => { const images = staged.filter((image) => image.entityType === type && image.extractedName === entity.extractedName); const failed = images.some((image) => image.status === "FAILED"); return <li key={`${type}-${entity.extractedName}`} className="rounded-xl bg-muted/30 p-2"><div className="font-bold">{entity.extractedName}</div><div className="text-xs text-muted-foreground">{entity.action === "IGNORE" ? "نادیده گرفته شد" : failed ? "ناموفق — ادامه با هشدار" : images.length ? "تصویر آماده شد" : "پروفایل دریافت شد"}</div></li>; })}</ul></details>)}</CardContent>
  </Card>;
}

function WorkflowActionSummary({
  readiness,
  unresolvedCount,
  blockingCount,
  failedCoverCount,
  disabled,
  onAction,
  compact = false,
}: {
  readiness: ImportWorkflowReadiness;
  unresolvedCount: number;
  blockingCount: number;
  failedCoverCount: number;
  disabled: boolean;
  onAction: () => void | Promise<void>;
  compact?: boolean;
}) {
  if (readiness === "SUCCESS") return null;
  const content: Record<
    ImportWorkflowReadiness,
    { action: string; reason?: string }
  > = {
    REQUIRES_CATALOG_DECISION: {
      action: "تکمیل انتخاب کتاب",
      reason: "تصمیم کتاب مقصد هنوز نهایی نشده است.",
    },
    REQUIRES_ENTITY_RESOLUTION: {
      action: "تکمیل مراجع حل‌نشده",
      reason: `${unresolvedCount.toLocaleString("fa-IR")} مرجع هنوز حل نشده است.`,
    },
    REQUIRES_EDITION_RESOLUTION: {
      action: "تکمیل تصمیم نسخه‌ها",
      reason: "حداقل یک نسخه هنوز تصمیم نهایی ندارد.",
    },
    BLOCKED_BY_CONFLICT: {
      action: "بررسی تعارض‌ها",
      reason: `${blockingCount.toLocaleString("fa-IR")} تعارض مسدودکننده باید بررسی شود.`,
    },
    INVALID_DRAFT: {
      action: "بررسی خطاهای پیش‌نویس",
      reason:
        "پیش‌نویس باید اعتبارسنجی شود و خطاهای نمایش‌داده‌شده برطرف شوند.",
    },
    READY_FOR_COVER_IMPORT: { action: "آماده‌سازی کاورها" },
    COVER_PREPARATION_PARTIAL: {
      action: "تلاش مجدد برای کاورهای ناموفق",
      reason: `${failedCoverCount.toLocaleString("fa-IR")} کاور نیازمند آماده‌سازی مجدد است.`,
    },
    COVER_PREPARATION_FAILED: {
      action: "بررسی خطاهای کاور",
      reason: `${failedCoverCount.toLocaleString("fa-IR")} کاور آماده نشد.`,
    },
    READY_FOR_FINAL_IMPORT: { action: "ثبت نهایی کتاب و نسخه‌ها" },
    COMMITTING: { action: "در حال ثبت کتاب، نسخه‌ها و کاورها..." },
    SUCCESS: { action: "ثبت انجام شد" },
  };
  const item = content[readiness];
  return (
    <Button
      type="button"
      className="h-11 rounded-xl px-6 font-black shadow-sm"
      disabled={disabled || readiness === "COMMITTING"}
      onClick={onAction}
    >
      {item.action}
    </Button>
  );
}
