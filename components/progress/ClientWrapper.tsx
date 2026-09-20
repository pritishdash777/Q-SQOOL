"use client";

import { ProgressProvider } from "@/components/progress/ProgressProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import type { ReactNode } from "react";
import QAIChatbot from "@/components/q-ai/QAIChatbot";

type Props = { children: ReactNode };

export default function ClientWrapper({ children }: Props) {
  return (
    <ThemeProvider>
      <ProgressProvider>
        {children}
        <QAIChatbot />
      </ProgressProvider>
    </ThemeProvider>
  );
}
