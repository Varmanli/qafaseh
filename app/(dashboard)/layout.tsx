import "../globals.css";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import MobileNav from "@/components/layout/MobileNav";
import ErrorBoundary from "@/components/ErrorBoundary";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/roles";
import { getSiteSettings } from "@/lib/settings/service";
import { getSiteNavigationMenus } from "@/lib/layout/navigation-settings";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // اعتبارسنجی واقعی توکن و وجود کاربر در دیتابیس (محیط Node)
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }
  const [settings, navigation] = await Promise.all([getSiteSettings(), getSiteNavigationMenus()]);
  const branding = {
    logoUrl: settings.logoUrl,
    logoLightUrl: settings.logoLightUrl,
    logoDarkUrl: settings.logoDarkUrl,
    siteName: settings.siteName,
  };

  return (
    <div className="flex min-h-screen flex-col bg-background pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">
      <SiteHeader
        user={{
          name: user.name,
          email: user.email,
          image: user.image,
          username: user.username,
        }}
        isAdmin={isAdmin(user)}
        branding={branding}
        primaryNav={navigation.header}
      />
      <main className="flex-1">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
      <SiteFooter
        branding={branding}
        footerLinks={navigation.footer}
        user={{
          name: user.name,
          email: user.email,
          image: user.image,
          username: user.username,
        }}
      />
      <MobileNav primaryLinks={navigation.header} />
    </div>
  );
}
