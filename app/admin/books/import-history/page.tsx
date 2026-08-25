import Link from "next/link";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin/permissions";
import {
  IMPORT_STATUSES,
  listImportSessions,
  type ImportStatus,
} from "@/lib/importers/iranketab/session";
export const dynamic = "force-dynamic";
const statusLabels: Record<string, string> = {
  CREATED: "ایجادشده",
  EXTRACTING: "در حال استخراج",
  PREVIEW_READY: "پیش‌نمایش آماده",
  DRAFT_REVIEW: "در حال بررسی",
  COVER_PREPARATION: "آماده‌سازی کاور",
  READY_TO_COMMIT: "آماده ثبت",
  COMMITTING: "در حال ثبت",
  SUCCESS: "موفق",
  FAILED: "ناموفق",
  CANCELLED: "لغوشده",
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const status = IMPORT_STATUSES.includes(sp.status as ImportStatus)
    ? (sp.status as ImportStatus)
    : undefined;
  const data = await listImportSessions({
    page: Math.max(1, Number(sp.page) || 1),
    status,
    adminId: sp.adminId,
    source: sp.source,
    q: sp.q,
    from: sp.from ? new Date(sp.from) : undefined,
    to: sp.to ? new Date(sp.to) : undefined,
  });
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="تاریخچه ورود ایران‌کتاب"
        description="فرآیندهای موفق، ناموفق و نیمه‌کاره"
      />
      <Card>
        <CardContent className="p-4">
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
            <Input
              name="q"
              defaultValue={sp.q}
              placeholder="URL، عنوان یا شناسه منبع"
            />
            <select
              name="status"
              defaultValue={status ?? ""}
              className="rounded-xl border bg-background px-3"
            >
              <option value="">همه وضعیت‌ها</option>
              {IMPORT_STATUSES.map((item) => (
                <option key={item} value={item}>{statusLabels[item] ?? item}</option>
              ))}
            </select>
            <Input
              name="adminId"
              defaultValue={sp.adminId}
              placeholder="شناسه مدیر"
            />
            <Input name="from" type="date" defaultValue={sp.from} />
            <Input name="to" type="date" defaultValue={sp.to} aria-label="تا تاریخ" />
            <Input name="source" defaultValue={sp.source} placeholder="منبع" />
            <Button type="submit">فیلتر</Button>
          </form>
        </CardContent>
      </Card>
      {data.rows.length ? (
        <>
        <div className="hidden overflow-x-auto rounded-2xl border md:block">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3 text-right">تاریخ</th>
                <th className="p-3 text-right">مدیر</th>
                <th className="p-3 text-right">منبع</th>
                <th className="p-3 text-right">وضعیت</th>
                <th className="p-3 text-right">نتیجه</th>
                <th className="p-3 text-right">مدت</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map(({ session, adminName, adminEmail }) => (
                <tr key={session.id} className="border-t">
                  <td className="p-3">
                    <Link
                      className="text-primary hover:underline"
                      href={`/admin/books/import-history/${session.id}`}
                    >
                      {session.createdAt.toLocaleString("fa-IR")}
                    </Link>
                  </td>
                  <td className="p-3">
                    {adminName || adminEmail || session.adminId}
                  </td>
                  <td className="max-w-64 break-all p-3" dir="ltr">
                    {session.canonicalSourceUrl}
                  </td>
                  <td className="p-3"><span className="rounded-full border px-2 py-1 text-xs font-bold">{statusLabels[session.status] ?? session.status}</span></td>
                  <td className="p-3">
                    {String(
                      session.errorCode ??
                        "—",
                    )}
                  </td>
                  <td className="p-3">
                    {session.completedAt && session.startedAt
                      ? `${Math.max(0, session.completedAt.getTime() - session.startedAt.getTime()) / 1000}s`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-3 md:hidden">
          {data.rows.map(({ session, adminName, adminEmail }) => (
            <Card key={session.id}>
              <CardContent className="space-y-3 p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <Link className="font-bold text-primary" href={`/admin/books/import-history/${session.id}`}>
                    {session.createdAt.toLocaleString("fa-IR")}
                  </Link>
                  <span className="shrink-0 rounded-full border px-2 py-1 text-xs font-bold">
                    {statusLabels[session.status] ?? session.status}
                  </span>
                </div>
                <p className="break-all text-left text-xs text-muted-foreground" dir="ltr">{session.canonicalSourceUrl}</p>
                <div className="flex justify-between gap-3 text-xs">
                  <span>{adminName || adminEmail || session.adminId}</span>
                  <span>{String(session.errorCode ?? "—")}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        </>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            سابقه‌ای با این فیلترها پیدا نشد.
          </CardContent>
        </Card>
      )}
      <div className="flex justify-between">
        <Button asChild variant="outline" aria-disabled={data.page <= 1} className={data.page <= 1 ? "pointer-events-none opacity-50" : ""}>
          <Link
            href={`?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter((entry): entry is [string, string] => Boolean(entry[1]))), page: String(data.page - 1) })}`}
          >
            قبلی
          </Link>
        </Button>
        <span>صفحه {data.page.toLocaleString("fa-IR")}</span>
        <Button
          asChild
          variant="outline"
          aria-disabled={data.page * data.pageSize >= data.total}
          className={data.page * data.pageSize >= data.total ? "pointer-events-none opacity-50" : ""}
        >
          <Link
            href={`?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter((entry): entry is [string, string] => Boolean(entry[1]))), page: String(data.page + 1) })}`}
          >
            بعدی
          </Link>
        </Button>
      </div>
    </div>
  );
}
