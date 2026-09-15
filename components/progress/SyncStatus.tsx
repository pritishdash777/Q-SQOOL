"use client";
import { useProgress } from "./ProgressProvider";
import { Loader2 } from "lucide-react";

export default function SyncStatus() {
  const { syncStatus, progress, refreshProgress } = useProgress();
  if (syncStatus === "idle") return null;
  const message = syncStatus === "synced" ? "Synced" : syncStatus === "syncing" ? "Syncing…" :
    syncStatus === "error" ? "Progress is in memory; browser saving failed." :
    syncStatus === "offline" ? "Not synced. Retry when connected." :
    progress?.userId === "guest" ? "Saved on this device · Guest" : "Saved on this device · Pending sync";
  return <div role="status" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
    {syncStatus === "syncing" && <Loader2 className="size-4 animate-spin" />}
    {message}
    {(syncStatus === "offline" || syncStatus === "error") && <button onClick={refreshProgress} className="text-primary underline">Retry sync</button>}
  </div>;
}
