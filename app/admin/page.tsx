import type { ReactNode } from "react";
import Link from "next/link";
import {
  BookCopy,
  ChevronLeft,
  FileText,
  MessageSquareQuote,
  NotebookPen,
  Plus,
  Settings,
  Users,
} from "lucide-react";

import { getAdminOverview } from "@/lib/admin/service";
import { getAdminAnalytics } from "@/lib/admin/analytics";
import AdminStatCard from "@/components/admin/AdminStatCard";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const QUICK_ACTIONS = [
  {
    href: "/admin/books/new",
    label: "افزودن کتاب",
    description: "ثبت کتاب جدید در کاتالوگ",
    icon: Plus,
  },
  {
    href: "/admin/books/import-links",
    label: "ورود از ایران‌کتاب",
    description: "افزودن کتاب از اطلاعات ایران‌کتاب",
    icon: BookCopy,
  },
  {
    href: "/admin/blog",
    label: "نوشتن برای مجله",
    description: "انتشار مطلب در مجله قفسه",
    icon: FileText,
  },
  {
    href: "/admin/settings",
    label: "تنظیمات سایت",
    description: "مدیریت تنظیمات عمومی",
    icon: Settings,
  },
];

function faDate(d: Date) {
  return new Date(d).toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function AdminDashboardPage() {
  const [overview, analytics] = await Promise.all([
    getAdminOverview(),
    getAdminAnalytics(1),
  ]);
  const { counts } = overview;

  return (
    <div className="space-y-7">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <AdminStatCard
          label="کاربران"
          value={counts.users}
          icon={Users}
          href="/admin/users"
        />

        <AdminStatCard
          label="کتاب‌های کاتالوگ"
          value={counts.books}
          icon={BookCopy}
          href="/admin/books"
        />

        <AdminStatCard
          label="بازدید یکتا امروز"
          value={analytics.today.visitors}
          icon={Users}
        />

        <AdminStatCard
          label="تکه‌های کتاب"
          value={counts.quotes}
          icon={MessageSquareQuote}
        />

        <AdminStatCard
          label="یادداشت‌ها"
          value={counts.notes}
          icon={NotebookPen}
        />

        <AdminStatCard
          label="بازدید یکتا دیروز"
          value={analytics.yesterday}
          icon={Users}
        />
      </section>

      <section>
          <div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {QUICK_ACTIONS.map((action) => (
                <QuickActionCard
                  key={action.href}
                  href={action.href}
                  label={action.label}
                  description={action.description}
                  icon={<action.icon className="h-4 w-4" />}
                />
              ))}
            </div>
          </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <RecentCard title="کاربران اخیر" viewAll="/admin/users">
          {overview.recentUsers.length === 0 ? (
            <Empty />
          ) : (
            overview.recentUsers.map((user) => (
              <Row
                key={user.id}
                title={user.name || user.username || "کاربر"}
                subtitle={
                  user.username ? `@${user.username}` : "بدون نام کاربری"
                }
                meta={faDate(user.createdAt)}
              />
            ))
          )}
        </RecentCard>

        <RecentCard title="کتاب‌های اخیر" viewAll="/admin/books">
          {overview.recentBooks.length === 0 ? (
            <Empty />
          ) : (
            overview.recentBooks.map((book) => (
              <Row
                key={book.id}
                title={book.title}
                subtitle={book.author}
                meta={faDate(book.createdAt)}
              />
            ))
          )}
        </RecentCard>

        <RecentCard title="فعالیت‌های اخیر" viewAll="/admin/users">
          {overview.recentActivities.length === 0 ? (
            <Empty text="هنوز فعالیتی ثبت نشده است" />
          ) : (
            overview.recentActivities.map((activity) => (
              <Row
                key={activity.id}
                title={activity.userName}
                subtitle={`${activity.action} · ${activity.target}`}
                meta={faDate(activity.createdAt)}
              />
            ))
          )}
        </RecentCard>
      </section>
    </div>
  );
}

function QuickActionCard({
  href,
  label,
  description,
  icon,
}: {
  href: string;
  label: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#101c17] p-4 shadow-[0_18px_55px_rgba(0,0,0,0.16)] transition-all hover:-translate-y-0.5 hover:border-white/20"
    >
      <div className="absolute inset-x-8 top-0 h-0.5 bg-gradient-to-r from-transparent via-[#7de2b4]/70 to-transparent" />
      <div className="pointer-events-none absolute -left-10 -top-10 h-24 w-24 rounded-full bg-primary/10 opacity-0 blur-2xl transition-opacity group-hover:opacity-100" />

      <div className="relative flex items-start justify-between gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#7de2b4]/15 bg-[#7de2b4]/10 text-[#7de2b4]">
          {icon}
        </span>

        <ChevronLeft className="mt-2 h-4 w-4 shrink-0 text-white/35 transition-transform group-hover:-translate-x-0.5 group-hover:text-[#7de2b4]" />
      </div>

      <div className="relative mt-4">
        <p className="text-sm font-black text-white/90">{label}</p>
        <p className="mt-1 line-clamp-2 text-xs leading-6 text-white/40">
          {description}
        </p>
      </div>
    </Link>
  );
}

function RecentCard({
  title,
  viewAll,
  children,
}: {
  title: string;
  viewAll: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[1.7rem] border border-white/10 bg-[#101c17] shadow-[0_18px_55px_rgba(0,0,0,0.16)]">
      <div className="relative flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4">
        <div className="absolute inset-x-8 top-0 h-0.5 bg-gradient-to-r from-transparent via-[#7de2b4]/70 to-transparent" />
        <h3 className="text-sm font-black text-white">{title}</h3>

        <Link
          href={viewAll}
          className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
        >
          مشاهده همه
          <ChevronLeft className="h-3.5 w-3.5" />
        </Link>
      </div>

      <ul className="divide-y divide-white/[0.07]">{children}</ul>
    </div>
  );
}

function Row({
  title,
  subtitle,
  meta,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
}) {
  return (
    <li className="group flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.035]">
      <div className="min-w-0">
        <p className="line-clamp-1 text-sm font-bold text-white/85 group-hover:text-white">
          {title}
        </p>

        {subtitle ? (
          <p className="mt-1 line-clamp-1 text-[11px] text-white/40">
            {subtitle}
          </p>
        ) : null}
      </div>

      {meta ? (
        <span className="shrink-0 rounded-lg bg-white/[0.05] px-2.5 py-1 text-[10px] font-bold tabular-nums text-white/55">
          {meta}
        </span>
      ) : null}
    </li>
  );
}

function Empty({ text = "موردی نیست" }: { text?: string }) {
  return (
    <li className="px-4 py-8 text-center">
      <p className="text-xs font-bold text-muted-foreground">{text}</p>
    </li>
  );
}
