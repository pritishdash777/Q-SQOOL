"use client";

import { ProgressProvider } from "@/components/progress/ProgressProvider";

type Props = { children: React.ReactNode };

export default function ClientWrapper({ children }: Props) {
  return <ProgressProvider>{children}</ProgressProvider>;
}
