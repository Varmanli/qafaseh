import type { ReactNode } from "react";
import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";
import { BrandLogo } from "@/components/BrandLogo";
import type { SiteBranding } from "@/lib/settings/types";

export function AuthLayout({
  children,
  branding,
}: {
  children: ReactNode;
  branding: SiteBranding;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07110d] text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(111,170,143,0.22),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(42,98,82,0.28),transparent_30%),linear-gradient(135deg,#07110d_0%,#0d1713_45%,#111c18_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:72px_72px] opacity-[0.08]" />
      <div className="absolute left-[-8rem] top-24 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="absolute bottom-[-7rem] right-[-4rem] h-80 w-80 rounded-full bg-emerald-300/10 blur-3xl" />

      <div className="relative z-10 flex min-h-screen">
        <AuthBrandPanel branding={branding} />

        <main className="flex min-h-screen flex-1 items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
          <div className="w-full max-w-[30rem]">
            <div className="mb-8 flex justify-center lg:hidden">
              <BrandLogo
                {...branding}
                size="auth"
              />
            </div>

            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
