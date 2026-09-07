"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Activity,
  BookOpen,
  Eye,
  FileText,
  Globe2,
  MessageSquareQuote,
  MousePointerClick,
  NotebookPen,
  UserCheck,
  Users,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { AdminAnalytics, AnalyticsPeriod } from "@/lib/admin/analytics";
import AdminStatCard from "@/components/admin/AdminStatCard";

const PERIODS: { value: AnalyticsPeriod; label: string }[] = [
  { value: 1, label: "امروز" },
  { value: 7, label: "۷ روز" },
  { value: 30, label: "۳۰ روز" },
  { value: 90, label: "۹۰ روز" },
];

const number = (value: number) => value.toLocaleString("fa-IR");

function Change({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span className={positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
      {positive ? "+" : ""}{number(value)}٪ نسبت به دوره قبل
    </span>
  );
}

function Ranking({ title, items, empty }: { title: string; items: { label: string; views: number }[]; empty: string }) {
  return (
    <section className="overflow-hidden rounded-[1.7rem] border border-white/10 bg-[#101c17] shadow-[0_18px_55px_rgba(0,0,0,0.16)]">
      <div className="relative border-b border-white/10 px-4 py-4">
        <div className="absolute inset-x-8 top-0 h-0.5 bg-gradient-to-r from-transparent via-[#7de2b4]/70 to-transparent" />
        <h2 className="text-sm font-black text-white">{title}</h2>
      </div>
      {items.length ? (
        <ol className="divide-y divide-white/[0.07]">
          {items.map((item, index) => (
            <li key={`${item.label}-${index}`} className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.035]">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-[#7de2b4]/15 bg-[#7de2b4]/10 text-xs font-black text-[#7de2b4]">{number(index + 1)}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-white/85 group-hover:text-white">{item.label}</span>
              <span className="shrink-0 rounded-lg bg-white/[0.05] px-2 py-1 text-xs tabular-nums text-white/55">{number(item.views)} بازدید</span>
            </li>
          ))}
        </ol>
      ) : <p className="px-4 py-9 text-center text-xs font-bold text-muted-foreground">{empty}</p>}
    </section>
  );
}

export default function AdminAnalyticsDashboard({ analytics }: { analytics: AdminAnalytics }) {
  const router = useRouter();
  const { summary, engagement, totals } = analytics;
  const [sessionMode, setSessionMode] = useState<"all" | "unique">("all");
  const [sessionPage, setSessionPage] = useState(1);
  const sessions = useMemo(() => {
    if (sessionMode === "all") return analytics.recentSessions;
    const seen = new Set<string>();
    return analytics.recentSessions.filter((session) => {
      if (seen.has(session.visitorId)) return false;
      seen.add(session.visitorId);
      return true;
    });
  }, [analytics.recentSessions, sessionMode]);
  const sessionPageSize = 8;
  const sessionTotalPages = Math.max(1, Math.ceil(sessions.length / sessionPageSize));
  const visibleSessions = sessions.slice((sessionPage - 1) * sessionPageSize, sessionPage * sessionPageSize);

  return (
    <div className="space-y-6">
      <section className="relative flex flex-col gap-4 overflow-hidden rounded-[1.7rem] border border-white/10 bg-[#101c17] p-4 shadow-[0_18px_55px_rgba(0,0,0,0.16)] sm:flex-row sm:items-center sm:justify-between">
        <div className="pointer-events-none absolute inset-x-10 top-0 h-0.5 bg-gradient-to-r from-transparent via-[#7de2b4]/70 to-transparent" />
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#7de2b4]/15 bg-[#7de2b4]/10 text-[#7de2b4]">
            <Activity className="h-5 w-5" />
          </span>
          <h2 className="text-base font-black text-white">رفت‌وآمد و تعامل کاربران</h2>
        </div>
        <div className="flex w-fit rounded-xl border border-white/10 bg-black/15 p-1">
          {PERIODS.map((item) => (
            <button key={item.value} type="button" onClick={() => router.push(`/admin/stats?period=${item.value}`)} className={`rounded-lg px-3 py-2 text-xs font-black transition-all ${analytics.period === item.value ? "bg-[#7de2b4] text-[#10231d] shadow-[0_6px_18px_rgba(125,226,180,0.18)]" : "text-white/55 hover:bg-white/[0.06] hover:text-white"}`}>
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <AdminStatCard label="بازدید صفحه" value={summary.pageViews} icon={Eye} hint={`${number(analytics.today.pageViews)} امروز · ${summary.pageViewsChange >= 0 ? "+" : ""}${number(summary.pageViewsChange)}٪`} tone="primary" />
        <AdminStatCard label="بازدیدکننده یکتا" value={summary.visitors} icon={Users} hint={`${number(analytics.today.visitors)} امروز · ${summary.visitorsChange >= 0 ? "+" : ""}${number(summary.visitorsChange)}٪`} tone="primary" />
        <AdminStatCard label="کاربر فعال" value={engagement.activeUsers} icon={Activity} hint="فعالیت مطالعه یا ثبت محتوا" />
        <AdminStatCard label="کاربر جدید" value={engagement.newUsers} icon={UserCheck} hint="حساب‌های ساخته‌شده در این دوره" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-[1.7rem] border border-border/70 bg-card/75 p-4 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div><h2 className="text-sm font-black text-foreground">روند بازدید و بازدیدکننده</h2><p className="mt-1 text-xs text-muted-foreground">مقایسه‌ی روزانه در بازه انتخاب‌شده</p></div>
            <div className="text-xs font-bold text-muted-foreground"><Change value={summary.visitorsChange} /></div>
          </div>
          <div className="mt-4 h-80 overflow-hidden rounded-2xl border border-white/10 bg-[#0d1915] p-3" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.trend} margin={{ top: 18, right: 18, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="pageViewsFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#7de2b4" stopOpacity={0.42}/><stop offset="100%" stopColor="#7de2b4" stopOpacity={0.02}/></linearGradient>
                  <linearGradient id="visitorsFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#a78bfa" stopOpacity={0.3}/><stop offset="100%" stopColor="#a78bfa" stopOpacity={0.02}/></linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 5" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "rgba(255,255,255,0.58)" }} minTickGap={24} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "rgba(255,255,255,0.58)" }} allowDecimals={false} width={34} />
                <Tooltip cursor={{ stroke: "rgba(255,255,255,0.24)", strokeDasharray: "4 4" }} contentStyle={{ borderRadius: 14, border: "1px solid rgba(125,226,180,0.24)", background: "rgba(12,28,22,0.96)", boxShadow: "0 18px 45px rgba(0,0,0,0.35)", direction: "rtl" }} labelStyle={{ color: "#dff8eb", fontWeight: 800, marginBottom: 6 }} itemStyle={{ color: "#fff", fontSize: 12, fontWeight: 700 }} formatter={(value: number, name: string) => [number(value), name]} />
                <Legend verticalAlign="top" align="right" height={30} iconType="circle" wrapperStyle={{ color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: 700 }} />
                <Area type="monotone" dataKey="pageViews" name="بازدید صفحه" stroke="#7de2b4" strokeWidth={3} fill="url(#pageViewsFill)" dot={{ r: 2, fill: "#7de2b4", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#0d1915", stroke: "#7de2b4", strokeWidth: 2 }} />
                <Area type="monotone" dataKey="visitors" name="بازدیدکننده یکتا" stroke="#a78bfa" strokeWidth={2.5} fill="url(#visitorsFill)" dot={{ r: 2, fill: "#a78bfa", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#0d1915", stroke: "#a78bfa", strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <section className="rounded-[1.7rem] border border-border/70 bg-card/75 p-4 shadow-sm">
          <h2 className="text-sm font-black text-foreground">ترکیب بازدیدکنندگان</h2>
          <div className="mt-5 grid grid-cols-1 gap-3">
            <Metric label="کاربران واردشده" value={summary.signedInVisitors} total={summary.visitors} color="bg-primary" />
            <Metric label="مهمان‌ها" value={summary.guestVisitors} total={summary.visitors} color="bg-violet-500" />
            <Metric label="بازدیدکننده جدید" value={summary.newVisitors} total={summary.visitors} color="bg-amber-500" />
          </div>
        </section>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Ranking title="کتاب‌های پربازدید" items={analytics.popularBooks} empty="هنوز بازدیدی از صفحه کتاب ثبت نشده است." />
        <Ranking title="نویسنده‌های پربازدید" items={analytics.popularAuthors} empty="هنوز بازدیدی از صفحه نویسنده ثبت نشده است." />
        <Ranking title="صفحه‌های پربازدید" items={analytics.popularPages.map((page) => ({ label: page.path, views: page.views }))} empty="هنوز بازدیدی ثبت نشده است." />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Engagement icon={BookOpen} label="افزودن به کتابخانه" value={engagement.libraryAdds} />
        <Engagement icon={MousePointerClick} label="شروع مطالعه" value={engagement.startedReading} />
        <Engagement icon={MessageSquareQuote} label="تکه‌های ثبت‌شده" value={engagement.quotes} />
        <Engagement icon={NotebookPen} label="یادداشت‌ها" value={engagement.publicNotes + engagement.privateNotes} />
      </section>

      <section className="overflow-hidden rounded-[1.7rem] border border-border/70 bg-card/75 shadow-sm">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-4">
          <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /><h2 className="text-sm font-black">آخرین بازدیدها و نشست‌ها</h2></div>
          <div className="flex items-center gap-2"><div className="flex rounded-xl border border-border/60 bg-background/50 p-1"><button type="button" onClick={() => { setSessionMode("all"); setSessionPage(1); }} className={`rounded-lg px-2 py-1 text-[11px] font-bold ${sessionMode === "all" ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}>همه بازدیدها</button><button type="button" onClick={() => { setSessionMode("unique"); setSessionPage(1); }} className={`rounded-lg px-2 py-1 text-[11px] font-bold ${sessionMode === "unique" ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}>کاربران یکتا</button></div><span className="text-[11px] text-muted-foreground">{number(sessions.length)} مورد</span></div>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-right text-xs"><thead className="border-b border-border/50 text-muted-foreground"><tr>{["کاربر","صفحه","IP","دستگاه و مرورگر","منبع ورود","زمان"].map((label) => <th key={label} className="whitespace-nowrap px-4 py-3 font-bold">{label}</th>)}</tr></thead><tbody>{visibleSessions.map((session, index) => <tr key={`${session.visitorId}-${session.createdAt}-${index}`} className="border-b border-border/40 last:border-0 hover:bg-white/[0.02]"><td className="px-4 py-3 font-bold">{session.userName}{session.username ? <span className="mt-1 block text-[10px] font-normal text-muted-foreground">@{session.username}</span> : null}</td><td dir="ltr" className="max-w-56 truncate px-4 py-3 text-muted-foreground">{session.path}</td><td dir="ltr" className="px-4 py-3 font-mono text-[11px]">{session.ipAddress ?? "ثبت نشده"}</td><td className="max-w-64 px-4 py-3 text-muted-foreground">{deviceLabel(session.userAgent)}</td><td dir="ltr" className="max-w-48 truncate px-4 py-3 text-muted-foreground">{session.referrer ? new URL(session.referrer).hostname : "ورود مستقیم"}</td><td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{new Date(session.createdAt).toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" })}</td></tr>)}</tbody></table>{sessions.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">هنوز داده‌ای ثبت نشده است.</p> : null}</div>
        {sessions.length > 0 ? <div className="flex items-center justify-between border-t border-border/50 px-4 py-3"><button type="button" disabled={sessionPage <= 1} onClick={() => setSessionPage((page) => Math.max(1, page - 1))} className="rounded-lg border border-border/60 px-3 py-1.5 text-xs disabled:opacity-40">قبلی</button><span className="text-xs text-muted-foreground">صفحه {number(sessionPage)} از {number(sessionTotalPages)}</span><button type="button" disabled={sessionPage >= sessionTotalPages} onClick={() => setSessionPage((page) => Math.min(sessionTotalPages, page + 1))} className="rounded-lg border border-border/60 px-3 py-1.5 text-xs disabled:opacity-40">بعدی</button></div> : null}
      </section>

      <section className="rounded-[1.7rem] border border-border/70 bg-card/75 p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2"><Globe2 className="h-4 w-4 text-primary" /><h2 className="text-sm font-black text-foreground">وضعیت کل پلتفرم</h2></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
          <Total label="کاربران" value={totals.users} color="#7de2b4" />
          <Total label="کتاب کاتالوگ" value={totals.catalogBooks} color="#60a5fa" />
          <Total label="نسخه‌ها" value={totals.editions} color="#a78bfa" />
          <Total label="تکه‌ها" value={totals.quotes} color="#f59e0b" />
          <Total label="یادداشت‌ها" value={totals.notes} color="#fb7185" />
          <Total label="کتاب منتظر" value={totals.pendingBooks} color="#f97316" />
          <Total label="نسخه منتظر" value={totals.pendingEditions} color="#eab308" />
          <Total label="مرجع منتظر" value={totals.pendingReferences} color="#c084fc" />
        </div>
      </section>
    </div>
  );
}

function deviceLabel(userAgent: string | null) {
  if (!userAgent) return "ثبت نشده";
  const device = /mobile|android|iphone|ipad/i.test(userAgent) ? "موبایل" : "دسکتاپ";
  const browser = /edg/i.test(userAgent) ? "Edge" : /chrome/i.test(userAgent) ? "Chrome" : /firefox/i.test(userAgent) ? "Firefox" : /safari/i.test(userAgent) ? "Safari" : "مرورگر دیگر";
  return `${device} · ${browser}`;
}

function Metric({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const percent = total ? Math.round((value / total) * 100) : 0;
  const accent = color === "bg-violet-500" ? "#a78bfa" : color === "bg-amber-500" ? "#f59e0b" : "#7de2b4";
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#101c17] p-3.5 transition-transform hover:-translate-y-0.5">
      <div className="absolute inset-y-0 right-0 w-1" style={{ backgroundColor: accent }} />
      <div className="flex items-start justify-between gap-2 pr-1">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-white/65">{label}</p>
          <p className="mt-2 text-2xl font-black tabular-nums text-white">{number(value)}</p>
        </div>
        <span className="rounded-xl px-2 py-1 text-xs font-black tabular-nums" style={{ color: accent, backgroundColor: `${accent}18` }}>
          {number(percent)}٪
        </span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.08]">
        <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, background: `linear-gradient(90deg, ${accent}66, ${accent})` }} />
      </div>
      <p className="mt-2 text-[10px] text-white/35">از مجموع بازدیدکنندگان این دوره</p>
    </div>
  );
}
function Engagement({ icon: Icon, label, value }: { icon: typeof BookOpen; label: string; value: number }) {
  return <div className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-[#101c17] p-4 shadow-[0_14px_38px_rgba(0,0,0,0.12)] transition-all hover:-translate-y-0.5 hover:border-white/20"><div className="absolute inset-x-8 top-0 h-0.5 bg-gradient-to-r from-transparent via-[#7de2b4]/70 to-transparent" /><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#7de2b4]/15 bg-[#7de2b4]/10 text-[#7de2b4]"><Icon className="h-5 w-5" /></span><div><p className="text-xs font-bold text-white/55">{label}</p><p className="mt-1 text-xl font-black tabular-nums text-white">{number(value)}</p></div></div>;
}
function Total({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#101c17] px-3 py-3.5 transition-all hover:-translate-y-0.5 hover:border-white/20">
      <div className="absolute inset-x-0 top-0 h-0.5 opacity-80" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      <p className="truncate text-[11px] font-bold text-white/48">{label}</p>
      <p className="mt-2 text-xl font-black tabular-nums text-white transition-colors group-hover:text-emerald-100">{number(value)}</p>
      <div className="mt-3 h-1 w-8 rounded-full opacity-70" style={{ backgroundColor: color }} />
    </div>
  );
}
