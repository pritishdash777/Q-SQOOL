import type { Metadata } from "next";
import "./globals.css";

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
    const theme = savedTheme === "light" ? "light" : "dark";

    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  } catch {
    document.documentElement.classList.add("dark");
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

      <body>{children}</body>
    </html>
  );
}