"use client";

import { ProgressProvider } from "@/components/progress/ProgressProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import type { ReactNode } from "react";

type Props = { children: ReactNode };

export default function ClientWrapper({ children }: Props) {
  return (
    <ThemeProvider>
      <ProgressProvider>
        {children}
      </ProgressProvider>
    </ThemeProvider>
  );
}
