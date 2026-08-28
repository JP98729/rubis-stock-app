"use client";

import { useCallback, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { GREEN } from "@/lib/brand";

export function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  return { toast, showToast };
}

export function ToastView({ toast }: { toast: string | null }) {
  if (!toast) return null;
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
      <CheckCircle2 size={16} style={{ color: GREEN }} /> {toast}
    </div>
  );
}
