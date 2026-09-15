"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  mounted: boolean;
};

const STORAGE_KEY = "q-sqool-theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function readTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === "light" || saved === "dark" || saved === "system"
      ? saved
      : "dark";
  } catch {
    return "dark";
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark");
  const [mounted, setMounted] = useState(false);
  const themeRef = useRef<Theme>("dark");

  useEffect(() => {
    const applyTheme = (nextTheme: Theme) => {
      const nextResolved = nextTheme === "system" ? getSystemTheme() : nextTheme;
      const root = document.documentElement;

      root.classList.toggle("dark", nextResolved === "dark");
      root.dataset.theme = nextResolved;
      root.style.colorScheme = nextResolved;
      setResolvedTheme(nextResolved);
    };

    const initialTheme = readTheme();
    themeRef.current = initialTheme;
    setThemeState(initialTheme);
    applyTheme(initialTheme);
    setMounted(true);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemTheme = () => {
      if (themeRef.current === "system") applyTheme("system");
    };
    media.addEventListener("change", handleSystemTheme);
    return () => media.removeEventListener("change", handleSystemTheme);
  }, []);

  const setTheme = (nextTheme: Theme) => {
    themeRef.current = nextTheme;
    setThemeState(nextTheme);
    try {
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {
      // Theme still applies when storage is unavailable.
    }

    const nextResolved = nextTheme === "system" ? getSystemTheme() : nextTheme;
    document.documentElement.classList.toggle("dark", nextResolved === "dark");
    document.documentElement.dataset.theme = nextResolved;
    document.documentElement.style.colorScheme = nextResolved;
    setResolvedTheme(nextResolved);
  };

  const toggleTheme = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme, mounted }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
