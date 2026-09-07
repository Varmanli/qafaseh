"use client";

import { Toaster } from "react-hot-toast";
import PerformanceMonitor from "@/components/PerformanceMonitor";
import ThemeProvider from "@/components/ThemeProvider";
import { ConfirmProvider } from "@/components/common/ConfirmDialog";
import DisablePwa from "@/components/pwa/DisablePwa";
import PwaInstallPrompt from "@/components/pwa/PwaInstallPrompt";
import HomeNavigationTour from "@/components/onboarding/HomeNavigationTour";
import { OnboardingProvider } from "@/components/onboarding/OnboardingProvider";

export default function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <OnboardingProvider>
        <ConfirmProvider>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 4200,
              className:
                "!mt-3 !rounded-2xl !border !border-emerald-200/20 !bg-[#10231d]/95 !px-5 !py-3 !text-sm !font-bold !text-emerald-50 !shadow-[0_18px_50px_rgba(0,0,0,0.28)] !backdrop-blur-xl",
              success: {
                iconTheme: {
                  primary: "#8ee6bd",
                  secondary: "#10231d",
                },
              },
            }}
          />
          <PerformanceMonitor />
          <DisablePwa />
          <PwaInstallPrompt />
          <HomeNavigationTour />
        </ConfirmProvider>
      </OnboardingProvider>
    </ThemeProvider>
  );
}
