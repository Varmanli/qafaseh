"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BookOpen,
  FileText,
  Loader2,
  Shield,
  UserRound,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploader } from "@/components/upload/ImageUploader";

type Detail = {
  user: {
    id: string;
    name: string | null;
    username: string | null;
    email: string | null;
    image: string | null;
    bio: string | null;
    role: "USER" | "ADMIN";
    createdAt: string;
  };
  activity: { books: number; read: number; notes: number; thoughts: number };
  recentActivities: Array<{ createdAt: string; type: string; bookTitle: string | null; detail: string | null }>;
};
export default function AdminUserDetail({ userId }: { userId: string }) {
  const [data, setData] = useState<Detail | null>(null);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  useEffect(() => {
    let active = true;

    void fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
      credentials: "include",
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "کاربر پیدا نشد");
        }
    return { user: payload.user, activity: payload.activity, recentActivities: payload.recentActivities ?? [] };
      })
      .then((detail: Detail) => {
        if (active) setData(detail);
      })
      .catch((error) => {
        if (active)
          toast.error(
            error instanceof Error ? error.message : "خطا در بارگذاری",
          );
      });

    return () => {
      active = false;
    };
  }, [userId]);
  if (!data)
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  const { user, activity, recentActivities } = data;
  const activityPageSize = 6;
  const activityTotalPages = Math.max(1, Math.ceil(recentActivities.length / activityPageSize));
  const visibleActivities = recentActivities.slice((activityPage - 1) * activityPageSize, activityPage * activityPageSize);
  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: user.name || null,
          username: user.username || null,
          email: user.email || null,
          bio: user.bio || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(d.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ذخیره ناموفق بود");
    } finally {
      setSaving(false);
    }
  };
  const update = (key: "name" | "username" | "email" | "bio", value: string) =>
    setData((c) => (c ? { ...c, user: { ...c.user, [key]: value } } : c));
  const persistAvatar = async (nextImage: string) => {
    const previousImage = user.image;
    const image = nextImage || null;
    setAvatarSaving(true);
    try {
      const r = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ image }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "ذخیره تصویر ناموفق بود");
      setData((c) => (c ? { ...c, user: { ...c.user, image } } : c));
      toast.success("تصویر پروفایل ذخیره شد.");
    } catch (error) {
      setData((c) =>
        c ? { ...c, user: { ...c.user, image: previousImage } } : c,
      );
      toast.error(
        error instanceof Error ? error.message : "ذخیره تصویر ناموفق بود.",
      );
    } finally {
      setAvatarSaving(false);
    }
  };
  const activityItems: Array<{
    label: string;
    value: number;
    Icon: typeof BookOpen;
  }> = [
    { label: "کتاب‌ها", value: activity.books, Icon: BookOpen },
    { label: "خوانده‌شده", value: activity.read, Icon: BookOpen },
    { label: "یادداشت‌ها", value: activity.notes, Icon: FileText },
    { label: "برداشت‌های عمومی", value: activity.thoughts, Icon: UserRound },
  ];
  const changeRole = async () => {
    const role = user.role === "ADMIN" ? "USER" : "ADMIN";
    const r = await fetch(`/api/admin/users/${userId}/role`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const d = await r.json();
    if (!r.ok) return toast.error(d.error || "عملیات ناموفق بود");
    setData((c) => (c ? { ...c, user: { ...c.user, role } } : c));
    toast.success(d.message);
  };
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="h-4 w-4" />
        بازگشت به کاربران
      </Link>
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#14251d] via-[#101c17] to-[#0d1713] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.2)] sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar className="h-20 w-20 ring-1 ring-border">
            {user.image && (
              <AvatarImage src={user.image} alt="" className="object-cover" />
            )}
            <AvatarFallback className="text-2xl">
              {(user.name || user.username || "ق").charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-black text-foreground">
              {user.name || "بدون نام"}
            </h1>
            <p dir="ltr" className="mt-1 text-sm text-muted-foreground">
              @{user.username || "—"} · {user.email || "—"}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              عضویت: {new Date(user.createdAt).toLocaleDateString("fa-IR")}
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            {user.role === "ADMIN" ? "مدیر" : "کاربر"}
          </span>
        </div>
      </section>
      <section className="order-last rounded-[1.7rem] border border-white/10 bg-[#101c17] p-5 shadow-[0_18px_55px_rgba(0,0,0,0.14)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-[#7de2b4]" />
            <h2 className="font-black text-white">فعالیت‌های اخیر</h2>
          </div>
          <span className="text-xs text-white/35">{recentActivities.length.toLocaleString("fa-IR")} فعالیت</span>
        </div>
        {recentActivities.length ? (
          <div className="mt-4 divide-y divide-white/[0.07]">
            {visibleActivities.map((item, index) => (
              <div key={`${item.createdAt}-${item.type}-${index}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#7de2b4]/15 bg-[#7de2b4]/10 text-[#7de2b4]"><Activity className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white/85">{item.type === "BOOK_ADDED" ? "افزودن کتاب" : item.type === "REVIEW" ? "ثبت ریویو" : item.type === "QUOTE" ? "ثبت تکه کتاب" : item.type === "NOTE" ? "ثبت یادداشت خصوصی" : item.type === "THOUGHT" ? "انتشار برداشت" : "فعالیت مطالعه"}</p>
                  <p className="mt-1 truncate text-xs text-white/45">{item.bookTitle || "بدون عنوان کتاب"}{item.detail && item.type !== "READING" ? ` · ${item.detail}` : ""}</p>
                </div>
                <time className="shrink-0 text-[10px] tabular-nums text-white/35">{new Date(item.createdAt).toLocaleDateString("fa-IR")}</time>
              </div>
            ))}
          {activityTotalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between border-t border-white/[0.07] pt-3 text-xs font-bold text-white/45">
              <button type="button" disabled={activityPage <= 1} onClick={() => setActivityPage((page) => Math.max(1, page - 1))} className="rounded-lg border border-white/10 px-3 py-2 transition-colors hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-30">قبلی</button>
              <span>صفحه {activityPage.toLocaleString("fa-IR")} از {activityTotalPages.toLocaleString("fa-IR")}</span>
              <button type="button" disabled={activityPage >= activityTotalPages} onClick={() => setActivityPage((page) => Math.min(activityTotalPages, page + 1))} className="rounded-lg border border-white/10 px-3 py-2 transition-colors hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-30">بعدی</button>
            </div>
          ) : null}
          </div>
        ) : <p className="mt-5 rounded-xl bg-white/[0.03] px-4 py-6 text-center text-xs text-white/40">هنوز فعالیتی ثبت نشده است.</p>}
      </section>
      <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-[1.7rem] border border-white/10 bg-[#101c17] p-5 shadow-[0_18px_55px_rgba(0,0,0,0.14)]">
          <h2 className="font-black text-white">ویرایش پروفایل</h2>
          <div className="mt-5 space-y-5">
            <ImageUploader
              value={user.image}
              onChange={persistAvatar}
              onUploadStateChange={setAvatarUploading}
              folder="avatars"
              variant="avatar"
              label="آواتار"
              targetOwnerId={userId}
              disabled={saving || avatarUploading || avatarSaving}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                value={user.name || ""}
                onChange={(e) => update("name", e.target.value)}
                placeholder="نام نمایشی"
                className="h-12 rounded-xl"
              />
              <Input
                dir="ltr"
                value={user.username || ""}
                onChange={(e) => update("username", e.target.value)}
                placeholder="username"
                className="h-12 rounded-xl"
              />
              <Input
                dir="ltr"
                value={user.email || ""}
                onChange={(e) => update("email", e.target.value)}
                placeholder="email@example.com"
                className="h-12 rounded-xl"
              />
              <Textarea
                value={user.bio || ""}
                onChange={(e) => update("bio", e.target.value)}
                placeholder="بیوگرافی"
                className="min-h-28 rounded-xl sm:col-span-2"
              />
              <Button
                onClick={save}
                disabled={saving || avatarUploading || avatarSaving}
                className="h-12 w-full rounded-xl sm:col-span-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}ذخیره
                تغییرات
              </Button>
            </div>
          </div>
        </section>
        <div className="space-y-6">
          <section className="rounded-[1.7rem] border border-white/10 bg-[#101c17] p-5 shadow-[0_18px_55px_rgba(0,0,0,0.14)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
                <h2 className="font-black text-white">نقش کاربر</h2>
              </div>
              <span className="rounded-lg bg-[#7de2b4]/10 px-2.5 py-1 text-xs font-bold text-[#7de2b4]">{user.role === "ADMIN" ? "مدیر" : "کاربر"}</span>
            </div>
            <p className="mt-4 text-xs text-white/45">
              نقش فعلی: {user.role === "ADMIN" ? "مدیر" : "کاربر"}
            </p>
            <Button variant="outline" onClick={changeRole} className="mt-4 h-11 w-full rounded-xl border-white/15">
              {user.role === "ADMIN" ? "حذف دسترسی مدیر" : "ارتقا به مدیر"}
            </Button>
          </section>
          <section className="rounded-[1.7rem] border border-white/10 bg-[#101c17] p-5 shadow-[0_18px_55px_rgba(0,0,0,0.14)]">
            <h2 className="font-black text-white">فعالیت کاربر</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {activityItems.map(({ label, value, Icon }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 transition-colors hover:border-[#7de2b4]/25 hover:bg-white/[0.06]"
                >
                  <Icon className="h-4 w-4 text-primary" />
                  <p className="mt-2 text-lg font-black tabular-nums">
                    {value.toLocaleString("fa-IR")}
                  </p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
