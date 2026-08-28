"use client";

import { useCallback, useSyncExternalStore } from "react";
import { CheckCircle2 } from "lucide-react";
import { GREEN } from "@/lib/brand";

/**
 * Toast state lives at module scope, outside React, so it survives a parent
 * component remounting mid-display — which happens here because uploading an
 * LPO (or saving a stocktake, etc.) triggers a server-side revalidatePath,
 * and the resulting background refresh can remount the view that owns the
 * toast, wiping plain useState before the 4s timer ever gets to run.
 */
let currentMessage: string | null = null;
let dismissTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function setMessage(msg: string | null) {
  currentMessage = msg;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return currentMessage;
}

function getServerSnapshot() {
  return null;
}

export function useToast() {
  const toast = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const showToast = useCallback((msg: string) => {
    if (dismissTimer) clearTimeout(dismissTimer);
    setMessage(msg);
    dismissTimer = setTimeout(() => setMessage(null), 4000);
  }, []);

  return { toast, showToast };
}

export function ToastView({ toast }: { toast: string | null }) {
  if (!toast) return null;
  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-50 max-w-[92vw] bg-gray-900 text-white text-sm px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
    >
      <CheckCircle2 size={16} className="shrink-0" style={{ color: GREEN }} />
      <span className="text-center">{toast}</span>
    </div>
  );
}
