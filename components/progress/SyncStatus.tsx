"use client";

import { useProgress } from "@/components/progress/ProgressProvider";
import { Loader2 } from "lucide-react";

export default function SyncStatus() {
  const { syncStatus } = useProgress();

  if (syncStatus === "idle" || syncStatus === "synced") return null;

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      {syncStatus === "saving-local" && "Saving..."}
      {syncStatus === "syncing" && "Syncing..."}
      {syncStatus === "offline" && "Offline"}
      {syncStatus === "error" && "Sync error"}
    </div>
  );
}
