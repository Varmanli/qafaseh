import { notFound } from "next/navigation";
import Link from "next/link";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin/permissions";
import { getImportSessionDetail } from "@/lib/importers/iranketab/session";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const data = await getImportSessionDetail((await params).id);
  if (!data) notFound();
  const { session } = data;
  const result = (session.resultSummary ?? {}) as {
    catalogAction?: string;
    catalogTitle?: string;
    editions?: Record<string, number>;
    entities?: { created?: number; reused?: number };
    warnings?: string[];
  };
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="جزئیات فرآیند ورود"
        description={session.canonicalSourceUrl}
        action={
          <Button asChild variant="outline">
            <Link href="/admin/books/import-history">بازگشت</Link>
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>منبع و وضعیت</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <Row label="URL اولیه" value={session.sourceUrl} />
              <Row label="URL کانونی" value={session.canonicalSourceUrl} />
              <Row label="منبع" value={session.sourceName} />
              <Row label="وضعیت" value={session.status} />
              <Row label="نسخه پیش‌نویس" value={session.draftVersion.toLocaleString("fa-IR")} />
              <Row
                label="مدیر"
                value={data.adminName || data.adminEmail || session.adminId}
              />
              <Row
                label="زمان ایجاد"
                value={session.createdAt.toLocaleString("fa-IR")}
              />
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>نتیجه</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Row label="عنوان کتاب" value={result.catalogTitle ?? "—"} />
              <Row label="تصمیم کاتالوگ" value={result.catalogAction ?? "—"} />
              <Row label="نسخه‌های ایجادشده" value={String(result.editions?.CREATED ?? 0)} />
              <Row label="نسخه‌های استفاده‌شده" value={String(result.editions?.REUSED ?? 0)} />
              <Row label="مراجع ایجادشده" value={String(result.entities?.created ?? 0)} />
              <Row label="مراجع استفاده‌شده" value={String(result.entities?.reused ?? 0)} />
            </dl>
            {session.catalogId ? (
              <Button asChild size="sm" variant="outline" className="mt-4">
                <Link href={`/admin/books/${session.catalogId}/edit`}>مشاهده کتاب در مدیریت</Link>
              </Button>
            ) : null}
            {result.warnings?.length ? (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                <p className="font-bold">هشدارهای عملیاتی</p>
                <ul className="mt-2 list-inside list-disc space-y-1">
                  {result.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
                </ul>
              </div>
            ) : null}
            {session.errorCode ? (
              <div className="mt-3 rounded-xl bg-destructive/10 p-3">
                <p>
                  {session.errorCode}: {session.errorMessage}
                </p>
                <p>قابل تلاش مجدد: {session.retryable ? "بله" : "خیر"}</p>
                {session.retryable ? (
                  <Button asChild size="sm" className="mt-3">
                    <Link href="/admin/books/import-links">تلاش مجدد</Link>
                  </Button>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>خط زمانی</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 border-r pr-5">
            {data.events.map((event) => (
              <li key={event.id}>
                <p className="font-bold">{event.type}</p>
                <p className="text-xs text-muted-foreground">
                  {event.createdAt.toLocaleString("fa-IR")}
                </p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-all font-bold">{value}</dd>
    </div>
  );
}
