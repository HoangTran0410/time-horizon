import type { SyncConnectionStatus } from "../constants/types";

type SyncStatusPresentation = {
  badgeClassName: string;
  indicatorClassName: string;
};

export const getSyncStatusPresentation = (options: {
  hasPendingSyncableChanges: boolean;
  syncConnectionStatus: SyncConnectionStatus;
}): SyncStatusPresentation => {
  const { hasPendingSyncableChanges, syncConnectionStatus } = options;

  if (syncConnectionStatus === "error") {
    return {
      badgeClassName: "border-rose-500/30 bg-rose-500/10 text-rose-100",
      indicatorClassName: "bg-rose-400",
    };
  }

  if (hasPendingSyncableChanges) {
    return {
      badgeClassName: "border-amber-500/30 bg-amber-500/10 text-amber-100",
      indicatorClassName: "bg-amber-300",
    };
  }

  if (syncConnectionStatus === "connected") {
    return {
      badgeClassName: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
      indicatorClassName: "bg-emerald-300",
    };
  }

  return {
    badgeClassName: "border-zinc-700/80 bg-zinc-900/80 text-zinc-200",
    indicatorClassName: "bg-zinc-500",
  };
};

export const getSyncStatusLabelKey = (
  syncConnectionStatus: SyncConnectionStatus,
): "syncConnected" | "syncConnecting" | "syncError" | "syncDisconnected" => {
  if (syncConnectionStatus === "connected") {
    return "syncConnected";
  }

  if (syncConnectionStatus === "connecting") {
    return "syncConnecting";
  }

  if (syncConnectionStatus === "error") {
    return "syncError";
  }

  return "syncDisconnected";
};
