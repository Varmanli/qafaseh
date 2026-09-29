"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { useConfirm } from "@/components/common/ConfirmDialog";
import BookCoverImage from "@/components/books/BookCoverImage";

type Loan = {
  id: string;
  bookId: string | null;
  title: string;
  author: string;
  coverImage: string | null;
  borrowerName: string;
  loanedAt: string;
  dueAt: string | null;
  returnedAt: string | null;
  note: string | null;
};
type BookOption = { id: string; title: string; author: string; coverImage: string | null };
type LoanForm = {
  bookId: string;
  borrowerName: string;
  loanedAt: string;
  dueAt: string;
  note: string;
  returned: boolean;
};
const dateOnly = (value: string) => value.slice(0, 10);
const displayDate = (value: string | Date) =>
  new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(typeof value === "string" ? new Date(value) : value);
const today = () => toIsoDate(new Date());
function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function fromIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

export default function LoansPage({ books }: { books: BookOption[] }) {
  const confirm = useConfirm();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"active" | "returned">("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [calendarField, setCalendarField] = useState<
    "loanedAt" | "dueAt" | null
  >(null);
  const [form, setForm] = useState<LoanForm>({
    bookId: books[0]?.id ?? "",
    borrowerName: "",
    loanedAt: today(),
    dueAt: "",
    note: "",
    returned: false,
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/loans", { cache: "no-store" });
      if (!res.ok) throw new Error();
      setLoans((await res.json()).loans);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const bookId = new URLSearchParams(window.location.search).get("bookId");
    if (bookId && books.some((book) => book.id === bookId)) {
      setForm((previous) => ({ ...previous, bookId }));
      setOpen(true);
    }
  }, [books]);

  function startNew() {
    setEditingId(null);
    setForm({
      bookId: books[0]?.id ?? "",
      borrowerName: "",
      loanedAt: today(),
      dueAt: "",
      note: "",
      returned: false,
    });
    setOpen(true);
  }
  function edit(loan: Loan) {
    setEditingId(loan.id);
    setForm({
      bookId: loan.bookId ?? "",
      borrowerName: loan.borrowerName,
      loanedAt: dateOnly(loan.loanedAt),
      dueAt: loan.dueAt ? dateOnly(loan.dueAt) : "",
      note: loan.note ?? "",
      returned: !!loan.returnedAt,
    });
    setOpen(true);
  }
  async function save() {
    setBusy(true);
    try {
      const res = await fetch(
        editingId ? `/api/loans/${editingId}` : "/api/loans",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            bookId: form.bookId || null,
            dueAt: form.dueAt || null,
            note: form.note || null,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ذخیره انجام نشد");
      setOpen(false);
      toast.success("امانت ذخیره شد");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ذخیره انجام نشد");
    } finally {
      setBusy(false);
    }
  }
  async function markReturned(loan: Loan) {
    setBusy(true);
    try {
      const res = await fetch(`/api/loans/${loan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: loan.bookId,
          borrowerName: loan.borrowerName,
          loanedAt: dateOnly(loan.loanedAt),
          dueAt: loan.dueAt ? dateOnly(loan.dueAt) : null,
          note: loan.note,
          returned: true,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("کتاب پس گرفته شد");
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "ثبت بازگشت انجام نشد",
      );
    } finally {
      setBusy(false);
    }
  }
  function remove(loan: Loan) {
    void confirm({
      title: "حذف امانت",
      description: "این رکورد از تاریخچه حذف شود؟",
      onConfirm: async () => {
        setBusy(true);
        try {
          const res = await fetch(`/api/loans/${loan.id}`, {
            method: "DELETE",
          });
          if (!res.ok) throw new Error();
          toast.success("امانت حذف شد");
          await refresh();
        } catch {
          toast.error("حذف انجام نشد");
        } finally {
          setBusy(false);
        }
      },
    });
  }
  const visible = loans.filter((loan) => {
    const matchesTab = tab === "active" ? !loan.returnedAt : !!loan.returnedAt;
    const query = searchQuery.trim().toLocaleLowerCase("fa-IR");
    const matchesQuery =
      !query ||
      [loan.title, loan.author, loan.borrowerName].some((value) =>
        value.toLocaleLowerCase("fa-IR").includes(query),
      );
    return matchesTab && matchesQuery;
  });
  const activeCount = loans.filter((loan) => !loan.returnedAt).length;
  const returnedCount = loans.length - activeCount;

  return (
    <main
      dir="rtl"
      className="mx-auto w-full max-w-7xl space-y-5 px-3 pb-12 pt-5 sm:space-y-6 sm:px-6 sm:pb-16 sm:pt-9"
    >
      <header className="flex flex-col gap-4 rounded-2xl border border-primary/15 bg-primary/[0.045] p-4 sm:flex-row sm:items-center sm:justify-between sm:rounded-3xl sm:p-6">
        <div className="flex min-w-0 items-center gap-3.5 sm:gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary sm:size-12 sm:rounded-2xl">
            <BookOpen className="size-5 sm:size-6" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-black text-foreground sm:text-2xl">
              امانت‌های من
            </h1>
            <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm">
              کتاب‌هایی که به دیگران امانت داده‌ای.
            </p>
          </div>
        </div>
        <Button
          onClick={startNew}
          disabled={!books.length}
          className="h-10 w-full rounded-xl px-4 sm:w-auto sm:shrink-0"
        >
          <Plus className="size-4" /> ثبت امانت
        </Button>
      </header>

      {loading ? (
        <div
          className="space-y-3"
          aria-busy="true"
          aria-label="در حال بارگذاری امانت‌ها"
        >
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="h-40 animate-pulse rounded-2xl border border-border/70 bg-card/70"
            />
          ))}
        </div>
      ) : error ? (
        <section className="rounded-xl border border-border bg-card px-5 py-10 text-center">
          <p className="font-bold">دریافت امانت‌ها ناموفق بود.</p>
          <Button variant="outline" className="mt-4" onClick={refresh}>
            تلاش دوباره
          </Button>
        </section>
      ) : !loans.length ? (
        <section className="rounded-xl border border-dashed border-border bg-card px-5 py-12 text-center sm:py-14">
          <BookOpen className="mx-auto size-7 text-muted-foreground" />
          <h2 className="mt-3 font-bold">
            {tab === "active"
              ? "کتابی در امانت نیست"
              : "هنوز امانتی بازگردانده نشده"}
          </h2>
          {!books.length ? (
            <p className="mt-1 text-sm text-muted-foreground">
              برای ثبت امانت، یک کتاب فیزیکی به کتابخانه‌ات اضافه کن.
            </p>
          ) : tab === "active" ? (
            <p className="mt-1 text-sm text-muted-foreground">
              کتابی را که به کسی سپرده‌ای اینجا ثبت کن.
            </p>
          ) : null}
          {tab === "active" && (
            <Button
              onClick={startNew}
              disabled={!books.length}
              variant="outline"
              className="mt-4 rounded-lg"
            >
              <Plus className="size-4" /> ثبت امانت
            </Button>
          )}
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-border/70 bg-card p-3 sm:p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-sm">
                <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="جست‌وجو بین کتاب‌ها و گیرنده‌ها..."
                  aria-label="جست‌وجو بین امانت‌ها"
                  className="h-10 rounded-xl border-border/70 bg-background/70 pr-9"
                />
              </div>
              <div
                role="tablist"
                aria-label="وضعیت امانت‌ها"
                className="flex w-full gap-1.5 overflow-x-auto pb-0.5 lg:w-auto"
              >
                {(
                  [
                    { value: "active", label: "در امانت", count: activeCount },
                    {
                      value: "returned",
                      label: "بازگردانده‌شده",
                      count: returnedCount,
                    },
                  ] as const
                ).map((filter) => {
                  const active = tab === filter.value;
                  return (
                    <button
                      key={filter.value}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setTab(filter.value)}
                      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition sm:px-3.5 ${active ? "border-primary/20 bg-primary/10 text-primary" : "border-transparent text-muted-foreground hover:border-border hover:bg-background hover:text-foreground"}`}
                    >
                      {filter.label}
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] tabular-nums ${active ? "bg-primary/10" : "bg-muted"}`}
                      >
                        {filter.count.toLocaleString("fa-IR")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {visible.length ? (
            <section aria-label="فهرست امانت‌ها">
              <div className="grid gap-3 lg:grid-cols-2 sm:gap-4">
                {visible.map((loan) => (
                  <article
                    key={loan.id}
                    className="group grid min-w-0 grid-cols-[78px_minmax(0,1fr)] items-start gap-x-3.5 gap-y-3 rounded-2xl border border-border/70 bg-card p-3.5 transition-colors hover:border-primary/25 sm:grid-cols-[88px_minmax(0,1fr)] sm:gap-x-4 sm:p-4 xl:grid-cols-[88px_minmax(0,1fr)_minmax(220px,0.9fr)]"
                  >
                    <div className="relative h-[116px] w-[78px] overflow-hidden rounded-lg bg-muted ring-1 ring-black/5 sm:h-[132px] sm:w-[88px]">
                      <BookCoverImage
                        src={loan.coverImage}
                        alt={`جلد کتاب ${loan.title}`}
                        fill
                        sizes="(max-width: 640px) 78px, 88px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <LoanBookInfo loan={loan} />
                    </div>
                    <div className="col-span-2 min-w-0 border-t border-border/60 pt-3 xl:col-span-1 xl:border-r xl:border-t-0 xl:py-1 xl:pr-4">
                      <LoanDetails loan={loan} />
                    </div>
                    <div className="col-span-2 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3 xl:col-span-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => edit(loan)}
                        disabled={busy}
                        className="h-9 flex-1 rounded-lg sm:flex-none"
                      >
                        <Pencil className="size-3.5" /> ویرایش
                      </Button>
                      {!loan.returnedAt && (
                        <Button
                          size="sm"
                          onClick={() => markReturned(loan)}
                          disabled={busy}
                          className="h-9 flex-1 rounded-lg sm:flex-none"
                        >
                          <RotateCcw className="size-3.5" /> پس گرفتم
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`حذف امانت ${loan.title}`}
                        title="حذف امانت"
                        onClick={() => remove(loan)}
                        disabled={busy}
                        className="ms-auto size-9 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-dashed border-border bg-card/60 px-5 py-12 text-center">
              <Search className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-3 font-bold">امانتی پیدا نشد</p>
              <p className="mt-1 text-sm text-muted-foreground">
                عبارت جست‌وجو یا وضعیت امانت را تغییر بده.
              </p>
              {searchQuery && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setSearchQuery("")}
                >
                  پاک‌کردن جست‌وجو
                </Button>
              )}
            </section>
          )}
        </>
      )}

      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) setCalendarField(null);
        }}
      >
        <DialogContent
          className="max-h-[92dvh] gap-5 overflow-y-auto rounded-2xl border-border/70 bg-card p-4 sm:max-w-xl sm:rounded-3xl sm:p-6"
          dir="rtl"
        >
          <DialogHeader>
            <span className="mb-1 grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <BookOpen className="size-5" />
            </span>
            <DialogTitle className="text-base font-black sm:text-lg">
              {editingId ? "ویرایش امانت" : "ثبت امانت"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <label className="block text-sm">
              کتاب
              <BookCombobox
                books={books}
                value={form.bookId}
                missingBook={!!editingId && !form.bookId}
                onChange={(bookId) => setForm({ ...form, bookId })}
              />
            </label>
            <label className="block text-sm">
              نام گیرنده
              <Input
                className="mt-1 rounded-xl border-border/70 bg-background/70"
                value={form.borrowerName}
                onChange={(event) =>
                  setForm({ ...form, borrowerName: event.target.value })
                }
                maxLength={150}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <LoanDateField
                label="تاریخ امانت"
                value={form.loanedAt}
                open={calendarField === "loanedAt"}
                onToggle={() =>
                  setCalendarField(
                    calendarField === "loanedAt" ? null : "loanedAt",
                  )
                }
              />
              <LoanDateField
                label="بازگشت مورد انتظار"
                value={form.dueAt}
                open={calendarField === "dueAt"}
                onToggle={() =>
                  setCalendarField(calendarField === "dueAt" ? null : "dueAt")
                }
              />
            </div>
            {calendarField && (
              <div className="rounded-xl border border-border bg-background/50 p-2">
                <Calendar
                  mode="single"
                  selected={
                    form[calendarField]
                      ? fromIsoDate(form[calendarField])
                      : undefined
                  }
                  defaultMonth={fromIsoDate(
                    form[calendarField] || form.loanedAt,
                  )}
                  onSelect={(date) => {
                    if (date)
                      setForm((current) => ({
                        ...current,
                        [calendarField]: toIsoDate(date),
                      }));
                    setCalendarField(null);
                  }}
                />
              </div>
            )}
            <label className="block text-sm">
              یادداشت (اختیاری)
              <Textarea
                className="mt-1 rounded-xl border-border/70 bg-background/70"
                value={form.note}
                onChange={(event) =>
                  setForm({ ...form, note: event.target.value })
                }
                maxLength={1000}
              />
            </label>
            {editingId && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={form.returned}
                  onChange={(event) =>
                    setForm({ ...form, returned: event.target.checked })
                  }
                />{" "}
                بازگردانده‌شده
              </label>
            )}
            <div className="border-t border-border/70 pt-4">
              <Button
                onClick={save}
                disabled={
                  busy ||
                  (!editingId && !form.bookId) ||
                  !form.borrowerName.trim() ||
                  !form.loanedAt
                }
                className="h-10 w-full rounded-xl sm:w-auto sm:min-w-36"
              >
                {busy ? "در حال ذخیره..." : "ذخیره امانت"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function BookCombobox({
  books,
  value,
  missingBook,
  onChange,
}: {
  books: BookOption[];
  value: string;
  missingBook: boolean;
  onChange: (bookId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = books.find((book) => book.id === value);
  const normalizedQuery = query.trim().toLocaleLowerCase("fa-IR");
  const filteredBooks = books.filter((book) =>
    `${book.title} ${book.author}`.toLocaleLowerCase("fa-IR").includes(normalizedQuery),
  );

  return (
    <div
      className="relative mt-1"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls="loan-book-options"
        onClick={() => {
          setQuery("");
          setOpen((current) => !current);
        }}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/70 px-3.5 py-2.5 text-right text-sm outline-none transition hover:border-primary/35 focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/20"
      >
        <span className="min-w-0 flex-1">
          <span className={`block truncate ${selected || missingBook ? "font-medium text-foreground" : "text-muted-foreground"}`}>
            {selected?.title ?? (missingBook ? "کتاب حذف‌شده از کتابخانه" : "انتخاب از کتابخانه")}
          </span>
          {selected && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{selected.author}</span>}
        </span>
        <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-2 overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
          <div className="relative border-b border-border/60 p-2.5">
            <Search className="pointer-events-none absolute right-5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="جست‌وجوی عنوان یا نویسنده..."
              aria-label="جست‌وجوی کتاب در کتابخانه"
              className="h-10 rounded-lg border-border/60 bg-background/70 pr-9"
            />
          </div>
          <div id="loan-book-options" role="listbox" aria-label="کتاب‌های کتابخانه" className="max-h-52 space-y-1 overflow-y-auto p-1.5">
            {filteredBooks.length ? filteredBooks.map((book) => (
              <button
                key={book.id}
                type="button"
                role="option"
                aria-selected={value === book.id}
                onClick={() => {
                  onChange(book.id);
                  setOpen(false);
                  setQuery("");
                }}
                className={`flex w-full items-center gap-3 rounded-lg p-2 text-right transition-colors ${value === book.id ? "bg-primary/10" : "hover:bg-muted/70"}`}
              >
                <span className="relative h-12 w-9 shrink-0 overflow-hidden rounded bg-muted">
                  <BookCoverImage src={book.coverImage} alt="" fill sizes="36px" className="object-cover" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-foreground">{book.title}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">{book.author}</span>
                </span>
                {value === book.id && <Check className="size-4 shrink-0 text-primary" />}
              </button>
            )) : (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">کتابی با این عنوان پیدا نشد.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LoanBookInfo({ loan }: { loan: Loan }) {
  return (
    <div className="flex min-h-[116px] min-w-0 flex-col justify-center py-1 sm:min-h-[132px]">
      <h3 className="line-clamp-2 text-lg font-black leading-8 text-foreground sm:text-xl">
        {loan.title}
      </h3>
      <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-muted-foreground sm:text-base">
        {loan.author}
      </p>
    </div>
  );
}

function LoanDetails({ loan }: { loan: Loan }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-end">
        <span
          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${loan.returnedAt ? "border-border bg-muted text-muted-foreground" : "border-primary/20 bg-primary/10 text-primary"}`}
        >
          {loan.returnedAt ? "بازگردانده‌شده" : "در امانت"}
        </span>
      </div>
      <div className="mt-2.5 grid grid-cols-1 gap-y-2 text-[11px] text-muted-foreground sm:text-xs">
        <p className="flex min-w-0 items-center gap-1.5">
          <UserRound className="size-3.5 shrink-0 text-primary/80" />
          <span className="truncate">گیرنده: {loan.borrowerName}</span>
        </p>
        <p className="flex min-w-0 items-center gap-1.5">
          <CalendarDays className="size-3.5 shrink-0 text-primary/80" />
          <span className="truncate">
            تاریخ امانت: {displayDate(loan.loanedAt)}
          </span>
        </p>
        {loan.dueAt && (
          <p className="flex min-w-0 items-center gap-1.5">
            <CalendarDays className="size-3.5 shrink-0 text-primary/80" />
            <span className="truncate">
              موعد بازگشت: {displayDate(loan.dueAt)}
            </span>
          </p>
        )}
        {loan.returnedAt && (
          <p className="flex min-w-0 items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
            <CalendarDays className="size-3.5 shrink-0" />
            <span className="truncate">
              تاریخ بازگشت: {displayDate(loan.returnedAt)}
            </span>
          </p>
        )}
      </div>
      {loan.note && (
        <p className="mt-2 line-clamp-2 rounded-lg bg-muted/60 px-2.5 py-1.5 text-[10px] leading-5 text-muted-foreground sm:text-[11px]">
          {loan.note}
        </p>
      )}
    </div>
  );
}

function LoanDateField({
  label,
  value,
  open,
  onToggle,
}: {
  label: string;
  value: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="min-w-0">
      <span className="block text-sm">{label}</span>
      <Button
        type="button"
        variant="outline"
        aria-expanded={open}
        onClick={onToggle}
        className="mt-1 h-10 w-full justify-between rounded-xl border-border/70 bg-background/70 px-3 font-normal"
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {value ? displayDate(fromIsoDate(value)) : "انتخاب تاریخ شمسی"}
        </span>
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
      </Button>
    </div>
  );
}
