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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}