"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ExternalLink, Loader2, Plus, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ReferenceTypeValue } from "@/lib/validations/reference";

type Option = {
  id: string;
  name: string;
};

export default function AdminReferenceCombobox({
  type,
  value,
  onChange,
  placeholder,
  disabled = false,
  invalid = false,
  manageHref,
  localOptions,
}: {
  type?: ReferenceTypeValue;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  invalid?: boolean;
  manageHref?: string;
  localOptions?: string[];
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Option[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (!open) return;

    const onMouseDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onEscape);

    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !wrapRef.current) return;
    const updatePosition = () => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (rect) setMenuPosition({ top: rect.bottom + 8, left: rect.left, width: rect.width });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => { window.removeEventListener("resize", updatePosition); window.removeEventListener("scroll", updatePosition, true); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!type) {
      const filtered = (localOptions ?? [])
        .filter((option) =>
          option.toLowerCase().includes(value.trim().toLowerCase()),
        )
        .slice(0, 12)
        .map((option) => ({ id: option, name: option }));
      setItems(filtered);
      return;
    }

    const ctrl = new AbortController();
    setLoading(true);

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/reference?type=${type}&q=${encodeURIComponent(value.trim())}`,
          { credentials: "include", signal: ctrl.signal },
        );
        const data = (await response.json()) as { items?: Option[] };
        setItems(data.items ?? []);
      } catch (error) {
        if (!(error instanceof DOMException)) setItems([]);
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      ctrl.abort();
      window.clearTimeout(timer);
      setLoading(false);
    };
  }, [localOptions, open, type, value]);

  const trimmedValue = value.trim();
  const exactMatch = useMemo(
    () =>
      items.some(
        (item) => item.name.trim().toLowerCase() === trimmedValue.toLowerCase(),
      ),
    [items, trimmedValue],
  );

  const visibleItems = useMemo(() => {
    const options = [...items];
    if (trimmedValue && !exactMatch) {
      options.unshift({ id: "__create__", name: trimmedValue });
    }
    return options;
  }, [exactMatch, items, trimmedValue]);

  useEffect(() => {
    setActiveIndex(0);
  }, [trimmedValue, visibleItems.length]);

  return (
    <div className={cn("relative", open && "z-[1000] isolate")} ref={wrapRef}>
      <div className="relative">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          disabled={disabled}
          aria-invalid={invalid}
          role="combobox"
          autoComplete="off"
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (!visibleItems.length) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((current) => (current + 1) % visibleItems.length);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setActiveIndex(
                (current) => (current - 1 + visibleItems.length) % visibleItems.length,
              );
            } else if (event.key === "Enter") {
              event.preventDefault();
              const selected = visibleItems[activeIndex];
              if (!selected) return;
              onChange(selected.name);
              setOpen(false);
            }
          }}
          className="h-11 rounded-2xl border-border/70 bg-background/75 pr-10 pl-10"
        />
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </span>
      </div>

      {open ? (
        createPortal(<div ref={menuRef} style={{ position: "fixed", top: menuPosition.top, left: menuPosition.left, width: menuPosition.width }} className="z-[9999] overflow-hidden rounded-[1.2rem] border border-border/80 bg-card/95 p-1.5 shadow-[0_24px_70px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl">
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {visibleItems.map((item, index) => {
              const isCreate = item.id === "__create__";
              const selected =
                item.name.trim().toLowerCase() === trimmedValue.toLowerCase();

              return (
                <button
                  key={`${item.id}-${item.name}`}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange(item.name);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-right text-sm transition",
                    index === activeIndex
                      ? "bg-primary/10 text-foreground"
                      : "text-foreground hover:bg-white/5",
                  )}
                >
                  <span className="truncate">
                    {isCreate ? `استفاده از «${item.name}»` : item.name}
                  </span>
                  {isCreate ? (
                    <Plus className="h-4 w-4 shrink-0 text-primary" />
                  ) : selected ? (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  ) : null}
                </button>
              );
            })}

            {!loading && visibleItems.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                موردی پیدا نشد
              </div>
            ) : null}
          </div>

          {manageHref ? (
            <a
              href={manageHref}
              className="mt-2 flex items-center justify-between rounded-xl border border-border/70 bg-background/50 px-3 py-2 text-xs font-bold text-muted-foreground transition hover:text-foreground"
            >
              <span>مدیریت این فهرست مرجع</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>, document.body)
      ) : null}
    </div>
  );
}
