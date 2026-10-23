import type { ComponentProps } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AuthButtonProps extends ComponentProps<typeof Button> {
  loading?: boolean;
}

export function AuthButton({
  children,
  className,
  loading = false,
  disabled,
  variant = "default",
  asChild = false,
  ...props
}: AuthButtonProps) {
  const buttonClassName = cn(
    "h-11 w-full rounded-xl text-sm font-semibold transition-colors",
    variant === "default" &&
      "bg-emerald-200 text-emerald-950 hover:bg-emerald-100",
    variant === "outline" &&
      "border-white/12 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white",
    className
  );

  // در حالت asChild، Slot فقط یک فرزند می‌پذیرد؛ پس بدون wrapperهای لودر،
  // فرزند را مستقیماً پاس می‌دهیم (لودر در این حالت پشتیبانی نمی‌شود).
  if (asChild) {
    return (
      <Button
        asChild
        variant={variant}
        className={buttonClassName}
        disabled={disabled || loading}
        {...props}
      >
        {children}
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      className={buttonClassName}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
      <span>{children}</span>
    </Button>
  );
}
