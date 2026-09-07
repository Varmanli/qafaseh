"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ArrowDownUp,
  Loader2,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AdminActionButton,
  AdminBadge,
  AdminColumn,
  AdminDataTable,
  AdminDataTableActions,
  AdminDataTableCell,
  AdminDataTablePagination,
  AdminDataTableRow,
  AdminDataTableSearch,
  AdminDataTableToolbar,
} from "@/components/admin/AdminDataTable";
import { useConfirm } from "@/components/common/ConfirmDialog";
import { cn } from "@/lib/utils";
import BookCoverImage from "@/components/books/BookCoverImage";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AdminBookRow {
  id: string;
  title: string;
  author: string;
  genre: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  primaryEditionId: string | null;
  primaryEditionLabel: string | null;
  primaryEditionPublisher: string | null;
  coverImage: string | null;
  editionCount: number;
  linkCount: number;
  libraryCount: number;
  createdByName: string | null;
  createdAt: string;
}

const COLUMNS: AdminColumn[] = [
  { key: "book", label: "کتاب" },
  { key: "author", label: "نویسنده" },
  { key: "library", label: "افزوده‌شدن به کتابخانه" },
  { key: "creator", label: "سازنده" },
  { key: "date", label: "تاریخ" },
  { key: "actions", label: "عملیات", align: "center" },
];

const STATUS_BADGE: Record<AdminBookRow["status"], string> = {
  APPROVED: "border-primary/20 bg-primary/12 text-primary",
  PENDING:
    "border-amber-500/20 bg-amber-500/12 text-amber-700 dark:text-amber-400",
  REJECTED: "border-destructive/20 bg-destructive/12 text-destructive",
};

const STATUS_LABEL: Record<AdminBookRow["status"], string> = {
  APPROVED: "تأییدشده",
  PENDING: "در انتظار",
  REJECTED: "ردشده",
};

function splitGenres(value: string | null) {
  if (!value) return [];

  return value
    .split(/[،,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function AdminBooksPage() {
  const confirm = useConfirm();
  const router = useRouter();

  const [rows, setRows] = useState<AdminBookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [librarySort, setLibrarySort] = useState<"asc" | "desc">("desc");
  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => librarySort === "desc" ? b.libraryCount - a.libraryCount : a.libraryCount - b.libraryCount),
    [rows, librarySort],
  );

  const queryParams = useMemo(() => {
    const params = new URLSearchParams({ page: String(page) });

    if (q.trim()) params.set("q", q.trim());
    if (status !== "ALL") params.set("status", status);

    return params;
  }, [page, q, status]);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/books?${queryParams}`, {
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "خطا در بارگذاری کتاب‌ها");
        return;
      }

      setRows(data.books || []);
      setTotalPages(data.totalPages || 1);
    } catch {
      toast.error("ارتباط با سرور برقرار نشد");
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [q, status]);

  const setBookStatus = async (id: string, next: "APPROVED" | "REJECTED") => {
    setBusyId(id);

    try {
      const res = await fetch(`/api/admin/books/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: next }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "عملیات ناموفق بود");
        return;
      }

      toast.success(data.message || "انجام شد");

      setRows((prev) =>
        prev.map((row) => (row.id === id ? { ...row, status: next } : row)),
      );
    } catch {
      toast.error("عملیات ناموفق بود");
    } finally {
      setBusyId(null);
    }
  };

  const remove = (id: string) => {
    void confirm({
      title: "حذف کتاب",
      description: "این کتاب کاتالوگ حذف شود؟ نسخه‌ها هم حذف می‌شوند.",
      onConfirm: async () => {
        setBusyId(id);

        try {
          const res = await fetch(`/api/admin/books/${id}`, {
            method: "DELETE",
            credentials: "include",
          });

          if (!res.ok) {
            toast.error("حذف کتاب ناموفق بود.");
            return;
          }

          toast.success("کتاب حذف شد.");
          setRows((prev) => prev.filter((row) => row.id !== id));
        } catch {
          toast.error("حذف کتاب ناموفق بود.");
        } finally {
          setBusyId(null);
        }
      },
    });
  };

  return (
    <div>
      <AdminDataTableToolbar>
        <AdminDataTableSearch
          value={q}
          onChange={setQ}
          placeholder="عنوان یا نویسنده..."
        />

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-11 w-full rounded-2xl border-border/80 bg-background/70 sm:w-48">
            <SelectValue placeholder="وضعیت" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="ALL">همه‌ی وضعیت‌ها</SelectItem>
            <SelectItem value="PENDING">در انتظار</SelectItem>
            <SelectItem value="APPROVED">تأییدشده</SelectItem>
            <SelectItem value="REJECTED">ردشده</SelectItem>
          </SelectContent>
        </Select>

      </AdminDataTableToolbar>

      <AdminDataTable
        columns={COLUMNS.map((column) => column.key === "library" ? {
          ...column,
          label: <button type="button" onClick={() => setLibrarySort((value) => value === "desc" ? "asc" : "desc")} className="inline-flex items-center gap-1.5 transition-colors hover:text-[#7de2b4]" title="مرتب‌سازی بر اساس تعداد افزودن به کتابخانه">{column.label}<ArrowDownUp className="h-3.5 w-3.5" /></button>,
        } : column)}
        loading={loading}
        isEmpty={rows.length === 0}
        footer={
          <AdminDataTablePagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        }
      >
        {sortedRows.map((book) => (
          <AdminDataTableRow key={book.id}>
            <AdminDataTableCell>
              <BookCell book={book} />
            </AdminDataTableCell>

            <AdminDataTableCell><span className="w-full whitespace-nowrap text-right text-sm font-bold text-white/75">{book.author || "نویسنده نامشخص"}</span></AdminDataTableCell>

            <AdminDataTableCell align="center"><span className="whitespace-nowrap rounded-xl border border-[#7de2b4]/15 bg-[#7de2b4]/10 px-3 py-1.5 text-sm font-black tabular-nums text-[#7de2b4]">{book.libraryCount.toLocaleString("fa-IR")} نفر</span></AdminDataTableCell>

            <AdminDataTableCell align="center">
              <span className="line-clamp-1 text-center text-xs font-medium text-muted-foreground">
                {book.createdByName || "—"}
              </span>
            </AdminDataTableCell>

            <AdminDataTableCell>
              <span className="text-xs tabular-nums text-muted-foreground">
                {new Date(book.createdAt).toLocaleDateString("fa-IR")}
              </span>
            </AdminDataTableCell>

            <AdminDataTableCell align="center">
              <AdminDataTableActions>
                <AdminActionButton
                  icon={<Pencil className="h-4 w-4" />}
                  onClick={() => router.push(`/admin/books/${book.id}/edit`)}
                  disabled={busyId === book.id}
                  title="ویرایش"
                />

                {book.status !== "APPROVED" ? (
                  <AdminActionButton
                    icon={
                      busyId === book.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )
                    }
                    tone="primary"
                    onClick={() => setBookStatus(book.id, "APPROVED")}
                    disabled={busyId === book.id}
                    title="تأیید"
                  />
                ) : null}

                {book.status !== "REJECTED" ? (
                  <AdminActionButton
                    icon={
                      busyId === book.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )
                    }
                    onClick={() => setBookStatus(book.id, "REJECTED")}
                    disabled={busyId === book.id}
                    title="رد"
                  />
                ) : null}

                <AdminActionButton
                  icon={<Trash2 className="h-4 w-4" />}
                  tone="danger"
                  onClick={() => remove(book.id)}
                  disabled={busyId === book.id}
                  title="حذف"
                />
              </AdminDataTableActions>
            </AdminDataTableCell>
          </AdminDataTableRow>
        ))}
      </AdminDataTable>
    </div>
  );
}

function BookCell({ book }: { book: AdminBookRow }) {
  return (
    <div className="flex w-full min-w-[220px] items-center justify-start gap-3 text-right" dir="rtl">
      <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-xl border border-border/80 bg-muted shadow-sm">
        <BookCoverImage
          src={book.coverImage}
          alt={book.title}
          fill
          sizes="40px"
          className="object-cover"
        />
      </div>

      <div className="min-w-0 flex-1 text-right">
        <p className="truncate whitespace-nowrap text-right text-sm font-black text-white">
          {book.title}
        </p>

      </div>
    </div>
  );
}

function GenreCell({ value }: { value: string | null }) {
  const genres = splitGenres(value);
  const visibleGenres = genres.slice(0, 2);
  const hiddenGenres = genres.slice(2);

  if (genres.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div className="flex max-w-[280px] flex-wrap items-center gap-1.5">
      {visibleGenres.map((genre) => (
        <span
          key={genre}
          title={genre}
          className="inline-flex max-w-[112px] items-center truncate rounded-full border border-primary/15 bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary"
        >
          {genre}
        </span>
      ))}

      {hiddenGenres.length > 0 ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center rounded-full border border-border/80 bg-background/60 px-2.5 py-1 text-[11px] font-black text-muted-foreground transition-colors hover:border-primary/20 hover:bg-primary/5 hover:text-primary"
            >
              +{hiddenGenres.length.toLocaleString("fa-IR")} مورد
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            align="end"
            sideOffset={8}
            className="z-[100] w-[240px] rounded-2xl border border-border/80 bg-card/95 p-2.5 text-right text-foreground shadow-2xl backdrop-blur-xl"
          >
            <span className="mb-2 block text-[10px] font-black text-muted-foreground">
              ژانرهای بیشتر
            </span>
            <span className="flex flex-wrap gap-1.5">
              {hiddenGenres.map((genre) => (
                <span
                  key={genre}
                  className="inline-flex max-w-full rounded-full border border-primary/15 bg-primary/10 px-2.5 py-1 text-[10px] font-bold leading-5 text-primary"
                >
                  <span className="max-w-[190px] truncate">{genre}</span>
                </span>
              ))}
            </span>
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}

function EditionCell({
  primaryEditionLabel,
  primaryEditionPublisher,
  editionCount,
  linkCount,
}: {
  primaryEditionLabel: string | null;
  primaryEditionPublisher: string | null;
  editionCount: number;
  linkCount: number;
}) {
  return (
    <div className="flex min-w-[110px] flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center rounded-full border border-border/80 bg-background/60 px-2.5 py-1 text-[11px] font-black tabular-nums text-foreground">
        {editionCount.toLocaleString("fa-IR")} نسخه
      </span>

      {linkCount > 0 ? (
        <span className="inline-flex items-center rounded-full border border-primary/15 bg-primary/10 px-2.5 py-1 text-[11px] font-black tabular-nums text-primary">
          {linkCount.toLocaleString("fa-IR")} لینک
        </span>
      ) : null}

      {primaryEditionLabel || primaryEditionPublisher ? (
        <span className="inline-flex items-center rounded-full border border-emerald-500/15 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-black text-emerald-700 dark:text-emerald-400">
          نسخه اصلی: {primaryEditionLabel || primaryEditionPublisher}
        </span>
      ) : null}
    </div>
  );
}
