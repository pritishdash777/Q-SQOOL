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

    document.documentElement.classList.toggle(
      "dark",
      savedTheme === "dark"
    );
  } catch {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>

      <body>{children}</body>
    </html>
  );
}