"use client";

import { createContext, useContext, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import type { SiteBranding } from "@/lib/settings/types";

const AuthBrandingContext = createContext<SiteBranding | null>(null);

export function AuthLogo() {
  const branding = useContext(AuthBrandingContext);
  return <Link href="/" aria-label="صفحهٔ اصلی قفسه"><BrandLogo {...branding} size="auth" logoClassName="!h-12 !w-auto !max-w-[132px]" /></Link>;
}

export function AuthLayout({
  children,
  branding,
}: {
  children: ReactNode;
  branding: SiteBranding;
}) {
  const pathname = usePathname();
  const logoInsideCard = pathname === "/auth/login" || pathname === "/auth/signup" || pathname === "/auth/forgot-password";

  return (
    <AuthBrandingContext.Provider value={branding}>
    <main className="flex min-h-svh items-center justify-center bg-[#0b1511] px-5 py-10 text-white">
      <div className="w-full max-w-[400px]">
        {!logoInsideCard ? <div className="mb-8 flex justify-center"><AuthLogo /></div> : null}
        {children}
      </div>
    </main>
    </AuthBrandingContext.Provider>
  );
}
