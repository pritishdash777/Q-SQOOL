import type { Metadata } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";
import "../components/effects/quantum-background.css";
import ClientWrapper from "@/components/progress/ClientWrapper";

export const metadata: Metadata = {
  title: "Q-SQOOL — Learn Quantum. Build Circuits. Shape the Future",
  description:
    "An interactive quantum learning, circuit-building, simulation and AI guidance platform.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

const themeScript = `
  try {
    const savedTheme = localStorage.getItem("q-sqool-theme");
    const theme = savedTheme === "light"
      ? "light"
      : savedTheme === "system"
        ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
        : "dark";

    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch {
    document.documentElement.classList.add("dark");
    document.documentElement.dataset.theme = "dark";
    document.documentElement.style.colorScheme = "dark";
  }
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>

      <body><ClientWrapper>{children}</ClientWrapper></body>
    </html>
  );
}