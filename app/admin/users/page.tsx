"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, Shield, ShieldOff } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

interface AdminUserRow {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  image: string | null;
  role: "USER" | "ADMIN";
  createdAt: string;
  bookCount: number;
}

const COLUMNS: AdminColumn[] = [
  { key: "user", label: "کاربر" },
  { key: "username", label: "نام کاربری" },
  { key: "email", label: "ایمیل" },
  { key: "role", label: "نقش" },
  { key: "books", label: "کتاب‌ها" },
  { key: "joined", label: "تاریخ عضویت" },
  { key: "actions", label: "عملیات", align: "center" },
];

export default function AdminUsersPage() {
  const confirm = useConfirm();
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (q.trim()) params.set("q", q.trim());
      if (role !== "ALL") params.set("role", role);
      const res = await fetch(`/api/admin/users?${params}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "خطا در بارگذاری");
        return;
      }
      setRows(data.users || []);
      setTotalPages(data.totalPages || 1);
    } catch {
      toast.error("ارتباط با سرور برقرار نشد");
    } finally {
      setLoading(false);
    }
  }, [page, q, role]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // Reset to page 1 when filters change.
  useEffect(() => {
    setPage(1);
  }, [q, role]);

  const toggleRole = (user: AdminUserRow) => {
    const next = user.role === "ADMIN" ? "USER" : "ADMIN";
    const verb = next === "ADMIN" ? "ادمین شود" : "از ادمین خارج شود";
    void confirm({
      title: "تغییر نقش کاربر",
      description: `«${user.name || user.username}» ${verb}؟`,
      confirmLabel: "تأیید",
      destructive: false,
      onConfirm: async () => {
        setBusyId(user.id);
        try {
          const res = await fetch(`/api/admin/users/${user.id}/role`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ role: next }),
          });
          const data = await res.json();
          if (!res.ok) {
            toast.error(data.error || "عملیات ناموفق بود");
            return;
          }
          toast.success(data.message || "به‌روزرسانی شد");
          setRows((prev) =>
            prev.map((r) => (r.id === user.id ? { ...r, role: next } : r))
          );
        } catch {
          toast.error("ارتباط با سرور برقرار نشد");
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
          placeholder="نام، نام‌کاربری یا ایمیل..."
        />
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="h-12 w-full rounded-2xl sm:w-52">
            <SelectValue placeholder="نقش" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه‌ی نقش‌ها</SelectItem>
            <SelectItem value="ADMIN">مدیر</SelectItem>
            <SelectItem value="USER">کاربر</SelectItem>
          </SelectContent>
        </Select>
      </AdminDataTableToolbar>

      <AdminDataTable
        columns={COLUMNS}
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
        {rows.map((u) => (
          <AdminDataTableRow key={u.id}>
            <AdminDataTableCell>
              <Link href={`/admin/users/${u.id}`} className="flex w-full items-center justify-start gap-2.5 text-right">
                <Avatar className="h-9 w-9 ring-1 ring-inset ring-border">
                  {u.image && (
                    <AvatarImage src={u.image} alt="" className="object-cover" />
                  )}
                  <AvatarFallback className="bg-muted text-xs font-bold text-foreground">
                    {(u.name || u.username || "ق").charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-foreground">
                  {u.name || "—"}
                </span>
              </Link>
            </AdminDataTableCell>
            <AdminDataTableCell className="text-muted-foreground">
              <span dir="ltr" className="block text-right">
                {u.username ? `@${u.username}` : "—"}
              </span>
            </AdminDataTableCell>
            <AdminDataTableCell className="text-muted-foreground">
              <span dir="ltr" className="block text-right">
                {u.email || "—"}
              </span>
            </AdminDataTableCell>
            <AdminDataTableCell>
              <AdminBadge
                className={
                  u.role === "ADMIN"
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground"
                }
              >
                {u.role === "ADMIN" ? "مدیر" : "کاربر"}
              </AdminBadge>
            </AdminDataTableCell>
            <AdminDataTableCell className="tabular-nums text-muted-foreground">
              {u.bookCount.toLocaleString("fa-IR")}
            </AdminDataTableCell>
            <AdminDataTableCell className="text-xs tabular-nums text-muted-foreground">
              {new Date(u.createdAt).toLocaleDateString("fa-IR")}
            </AdminDataTableCell>
            <AdminDataTableCell align="center">
              <AdminDataTableActions>
                {u.username ? (
                  <AdminActionButton
                    icon={<ExternalLink className="h-4 w-4" />}
                    href={`/${u.username}`}
                    external
                    title="مشاهده پروفایل"
                  />
                ) : null}
                <AdminActionButton
                  icon={
                    busyId === u.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : u.role === "ADMIN" ? (
                      <ShieldOff className="h-3.5 w-3.5" />
                    ) : (
                      <Shield className="h-3.5 w-3.5" />
                    )
                  }
                  onClick={() => toggleRole(u)}
                  disabled={busyId === u.id}
                  title={u.role === "ADMIN" ? "حذف ادمین" : "ادمین کردن"}
                >
                  {u.role === "ADMIN" ? "حذف ادمین" : "ادمین کن"}
                </AdminActionButton>
              </AdminDataTableActions>
            </AdminDataTableCell>
          </AdminDataTableRow>
        ))}
      </AdminDataTable>
    </div>
  );
}
