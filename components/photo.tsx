"use client";

import { useId, useState } from "react";
import { Camera, FileText } from "lucide-react";
import { GREEN_DARK } from "@/lib/brand";
import { ProductThumb } from "./ui";

/** Compress a captured/selected image client-side before uploading (keeps uploads small). */
export function compressImage(file: File, maxDim = 220, quality = 0.55): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxDim) {
        height = Math.round(height * (maxDim / width));
        width = maxDim;
      } else if (height > maxDim) {
        width = Math.round(width * (maxDim / height));
        height = maxDim;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Pushes a compressed data URL through the server's uploadFile helper and returns
 * the stored URL (Vercel Blob in production, ./.local-uploads in local dev).
 */
export async function uploadDataUrl(dataUrl: string): Promise<string> {
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl }),
  });
  if (!res.ok) throw new Error("upload failed");
  const json = (await res.json()) as { url: string };
  return json.url;
}

export async function compressAndUpload(file: File, maxDim?: number, quality?: number): Promise<string> {
  const dataUrl = await compressImage(file, maxDim, quality);
  return uploadDataUrl(dataUrl);
}

/** Reads a file (PDF or image) as a data URL without any compression, for document uploads. */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Uploads an LPO document (PDF or photo of a paper LPO) as-is, via the LPO-specific route. */
export async function uploadLpoFile(file: File): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);
  const res = await fetch("/api/upload-lpo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || "upload failed");
  }
  const json = (await res.json()) as { url: string };
  return json.url;
}

export function ProductPhotoPicker({
  product,
  value,
  onChange,
}: {
  product: { sku: string; range: string; flavour: string };
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      onChange(await compressAndUpload(file));
    } catch {
      /* ignore capture errors */
    }
    setBusy(false);
    e.target.value = "";
  }
  return (
    <label htmlFor={inputId} className="relative shrink-0 cursor-pointer">
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt={product.flavour} className="w-9 h-9 rounded-lg object-cover border border-gray-200" />
      ) : (
        <ProductThumb product={product} size={36} />
      )}
      <span className="absolute -bottom-1 -right-1 bg-white rounded-full border border-gray-200 w-4 h-4 flex items-center justify-center">
        <Camera size={9} className={busy ? "text-gray-300 animate-pulse" : "text-gray-500"} />
      </span>
      <input id={inputId} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
    </label>
  );
}

export function PlacementPhotoCapture({
  photo,
  onChange,
  tone,
  allowLibrary,
}: {
  photo: string | null;
  onChange: (url: string | null) => void;
  tone?: "good" | "neutral" | "bad";
  /** Also offer "Scan / choose file" (photo library, Files app, and iOS's document scanner) alongside the camera. */
  allowLibrary?: boolean;
}) {
  const cameraInputId = useId();
  const libraryInputId = useId();
  const [busy, setBusy] = useState(false);
  const isGood = tone === "good";
  const isNeutral = tone === "neutral";
  const color = isGood ? GREEN_DARK : isNeutral ? "#1D4ED8" : "#C0392B";
  const borderClass = isGood ? "border-green-300" : isNeutral ? "border-blue-300" : "border-red-300";
  const bgClass = isGood ? "bg-green-50" : isNeutral ? "bg-blue-50" : "bg-red-50";
  const imgBorderClass = isGood ? "border-green-200" : isNeutral ? "border-blue-200" : "border-red-200";

  const isPdf = !!photo && photo.toLowerCase().endsWith(".pdf");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      if (file.type === "application/pdf") {
        onChange(await uploadDataUrl(await readFileAsDataUrl(file)));
      } else {
        onChange(await compressAndUpload(file, 260, 0.6));
      }
    } catch {
      /* ignore capture errors */
    }
    setBusy(false);
    e.target.value = "";
  }

  return (
    <div className="mt-1">
      {photo ? (
        <div className="flex items-center gap-2.5">
          {isPdf ? (
            <a
              href={photo}
              target="_blank"
              rel="noopener noreferrer"
              className={`w-16 h-16 rounded-lg border ${imgBorderClass} bg-white flex flex-col items-center justify-center gap-0.5`}
            >
              <FileText size={22} style={{ color }} />
              <span className="text-[9px] font-semibold" style={{ color }}>
                PDF
              </span>
            </a>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="Shelf evidence" className={`w-16 h-16 rounded-lg object-cover border ${imgBorderClass}`} />
          )}
          <div className="flex flex-col items-start gap-1">
            <label htmlFor={cameraInputId} className="text-xs font-semibold cursor-pointer" style={{ color }}>
              Retake photo
              <input
                id={cameraInputId}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFile}
              />
            </label>
            {allowLibrary && (
              <label htmlFor={libraryInputId} className="text-xs font-semibold cursor-pointer" style={{ color }}>
                Scan / choose file
                <input
                  id={libraryInputId}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleFile}
                />
              </label>
            )}
          </div>
        </div>
      ) : allowLibrary ? (
        <div className="flex gap-2">
          <label
            htmlFor={cameraInputId}
            className={`flex-1 flex items-center justify-center gap-2 border-2 border-dashed ${borderClass} ${bgClass} rounded-lg py-3 text-sm font-semibold cursor-pointer`}
            style={{ color }}
          >
            <Camera size={16} /> {busy ? "Uploading…" : "Take photo"}
            <input
              id={cameraInputId}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFile}
            />
          </label>
          <label
            htmlFor={libraryInputId}
            className={`flex-1 flex items-center justify-center gap-2 border-2 border-dashed ${borderClass} ${bgClass} rounded-lg py-3 text-sm font-semibold cursor-pointer`}
            style={{ color }}
          >
            {busy ? "Uploading…" : "Scan / choose file"}
            <input
              id={libraryInputId}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handleFile}
            />
          </label>
        </div>
      ) : (
        <label
          htmlFor={cameraInputId}
          className={`flex items-center justify-center gap-2 border-2 border-dashed ${borderClass} ${bgClass} rounded-lg py-3 text-sm font-semibold cursor-pointer`}
          style={{ color }}
        >
          <Camera size={16} /> {busy ? "Uploading…" : "Take photo"}
          <input
            id={cameraInputId}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFile}
          />
        </label>
      )}
    </div>
  );
}
