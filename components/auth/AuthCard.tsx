import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AuthLogo } from "@/components/auth/AuthLayout";

interface AuthCardProps {
  title?: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
  className,
}: AuthCardProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-white/10 bg-white/[0.025] p-6 sm:p-8",
        className
      )}
    >
      <div>
        {title ? <div className="mb-7 text-center">
          <div className="space-y-2">
            <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="text-sm leading-6 text-white/55">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div> : <div className="mb-7 flex justify-center"><AuthLogo /></div>}

        {children}

        {footer ? (
          <div className="mt-7 border-t border-white/10 pt-5 text-center text-sm text-white/50">
            {footer}
          </div>
        ) : null}
      </div>
    </section>
  );
}
