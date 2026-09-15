"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";

export function ThemeToggle() {
  const { resolvedTheme, toggleTheme, mounted } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      disabled={!mounted}
      className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-foreground shadow-sm transition hover:bg-accent disabled:cursor-default disabled:opacity-100"
      aria-label={mounted ? `Switch to ${isDark ? "light" : "dark"} mode` : "Theme loading"}
      title={mounted ? `${isDark ? "Light" : "Dark"} mode` : "Theme loading"}
    >
      <span className="sr-only">{mounted ? (isDark ? "Light mode" : "Dark mode") : "Theme loading"}</span>
      {mounted ? (isDark ? <Sun className="size-5" /> : <Moon className="size-5" />) : <span className="size-4" />}
    </button>
  );
}
