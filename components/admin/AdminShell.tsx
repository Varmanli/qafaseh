"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ThemeToggle from "@/components/layout/ThemeToggle";
import AdminNav from "@/components/admin/AdminSidebar";
import type { SiteBranding } from "@/lib/settings/types";

interface AdminUser {
  name: string | null;
  username: string | null;
  image: string | null;
}

function Brand({
  branding,
}: {
  branding: SiteBranding;
}) {
  return (
    <Link href="/admin" className="flex items-center gap-2.5">
      <BrandLogo {...branding} size="admin" />
    </Link>
  );
}

function UserChip({ user }: { user: AdminUser }) {
  const name = user.name?.trim() || user.username || "مدیر";
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-[#101c17] p-2.5 shadow-[0_14px_38px_rgba(0,0,0,0.16)]">
      <Avatar className="h-9 w-9 ring-1 ring-inset ring-[#7de2b4]/20">
        {user.image && (
          <AvatarImage src={user.image} alt={name} className="object-cover" />
        )}
        <AvatarFallback className="bg-[#7de2b4]/10 text-sm font-bold text-[#7de2b4]">
          {name.charAt(0)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-white/90">{name}</p>
        <p className="truncate text-[11px] text-white/40">
          مدیر سامانه
        </p>
      </div>
    </div>
  );
}

export default function AdminShell({
  user,
  children,
  branding,
}: {
  user: AdminUser;
  children: React.ReactNode;
  branding: SiteBranding;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="باز کردن منوی مدیریت"
                  className="rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="flex w-72 flex-col border-border bg-card p-0"
              >
                <SheetHeader className="border-b border-border p-4 text-right">
                  <SheetTitle>
                    <Brand branding={branding} />
                  </SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto p-3">
                  <AdminNav onNavigate={() => setOpen(false)} />
                </div>
                <div className="border-t border-border p-3">
                  <UserChip user={user} />
                </div>
              </SheetContent>
            </Sheet>
            <Brand branding={branding} />
          </div>

          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              className="hidden h-9 rounded-xl px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground sm:inline-flex"
            >
              <Link href="/">
                بازگشت به سایت
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 overflow-y-auto border-l border-white/10 bg-[#0d1713] p-3 lg:flex lg:flex-col">
          <div className="flex-1">
            <AdminNav />
          </div>
          <div className="pt-3">
            <UserChip user={user} />
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
