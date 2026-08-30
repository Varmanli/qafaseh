"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "theme";
const ThemeContext = createContext<{
  resolvedTheme: Theme;
  setTheme: (theme: Theme) => void;
} | null>(null);

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setCurrentTheme] = useState<Theme>("dark");

  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      if (storedTheme === "light" || storedTheme === "dark") {
        setCurrentTheme(storedTheme);
        applyTheme(storedTheme);
        return;
      }
    } catch {
      // Theme persistence may be unavailable in restricted browser contexts.
    }

    applyTheme("dark");
  }, []);

  const setTheme = useCallback((nextTheme: Theme) => {
    setCurrentTheme(nextTheme);
    applyTheme(nextTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Keep the selected theme for the active session when storage is unavailable.
    }
  }, []);

  const value = useMemo(() => ({ resolvedTheme: theme, setTheme }), [theme, setTheme]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
