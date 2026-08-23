"use client";

import { useRef, useState } from "react";
import { Eraser } from "lucide-react";
import { uploadDataUrl } from "./photo";

/**
 * Canvas signature pad. On stroke end the PNG is uploaded through the server's
 * uploadFile helper and the resulting URL is handed back — the DB never stores a data URL.
 */
export function SignaturePad({ onChange }: { onChange: (url: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const hasStrokeRef = useRef(false);
  const [uploading, setUploading] = useState(false);

  function getCtx() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1f2937";
    return ctx;
  }
  function pointerPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const point = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    // The canvas is drawn at its intrinsic size but laid out at CSS size — scale the point.
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (point.clientX - rect.left) * scaleX, y: (point.clientY - rect.top) * scaleY };
  }
  function start(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    drawingRef.current = true;
    const canvas = canvasRef.current!;
    const { x, y } = pointerPos(e, canvas);
    const ctx = getCtx();
    ctx.beginPath();
    ctx.moveTo(x, y);
  }
  function move(e: React.MouseEvent | React.TouchEvent) {
    if (!drawingRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current!;
    const { x, y } = pointerPos(e, canvas);
    const ctx = getCtx();
    ctx.lineTo(x, y);
    ctx.stroke();
    hasStrokeRef.current = true;
  }
  async function end() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (!hasStrokeRef.current) return;
    setUploading(true);
    try {
      const url = await uploadDataUrl(canvasRef.current!.toDataURL("image/png"));
      onChange(url);
    } catch {
      onChange(null);
    }
    setUploading(false);
  }
  function clear() {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    hasStrokeRef.current = false;
    onChange(null);
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={520}
        height={140}
        className="w-full border border-gray-300 rounded-lg bg-white touch-none"
        style={{ height: 110 }}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <div className="flex items-center gap-3 mt-2">
        <button type="button" onClick={clear} className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
          <Eraser size={13} /> Clear signature
        </button>
        {uploading && <span className="text-[11px] text-gray-400">Saving signature…</span>}
      </div>
    </div>
  );
}
