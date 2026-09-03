"use client";

import { useId, useState } from "react";
import { Camera, CheckCircle2, FileText } from "lucide-react";
import { GREEN, GREEN_DARK } from "@/lib/brand";
import { acceptCourierDispatch, uploadCourierDeliveryNote } from "@/app/actions/courier";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function CourierActions({
  dispatchId,
  initialStatus,
  initialDeliveryNoteUrl,
}: {
  dispatchId: string;
  initialStatus: string;
  initialDeliveryNoteUrl: string | null;
}) {
  const cameraInputId = useId();
  const libraryInputId = useId();
  const [status, setStatus] = useState(initialStatus);
  const [deliveryNoteUrl, setDeliveryNoteUrl] = useState(initialDeliveryNoteUrl);
  const [acceptBusy, setAcceptBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleAccept() {
    setAcceptBusy(true);
    setError("");
    const res = await acceptCourierDispatch(dispatchId);
    if (res.ok) {
      setStatus((s) => (s === "pending" ? "accepted" : s));
    } else {
      setError(res.error);
    }
    setAcceptBusy(false);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadBusy(true);
    setError("");
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const uploadRes = await fetch("/api/upload-courier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dispatchId, dataUrl }),
      });
      const uploadJson = (await uploadRes.json()) as { url?: string; error?: string };
      if (!uploadRes.ok || !uploadJson.url) throw new Error(uploadJson.error || "Upload failed");
      const result = await uploadCourierDeliveryNote(dispatchId, uploadJson.url);
      if (!result.ok) throw new Error(result.error);
      setDeliveryNoteUrl(uploadJson.url);
      setStatus("delivered");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
    setUploadBusy(false);
    e.target.value = "";
  }

  const isPdf = !!deliveryNoteUrl && deliveryNoteUrl.toLowerCase().endsWith(".pdf");

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-sm font-semibold mb-2">1. Accept this dispatch</div>
        {status === "pending" ? (
          <button
            onClick={handleAccept}
            disabled={acceptBusy}
            className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold text-white"
            style={{ background: acceptBusy ? "#9CA3AF" : GREEN }}
          >
            {acceptBusy ? "Accepting…" : "Accept Dispatch"}
          </button>
        ) : (
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: "#EEF7DE", color: GREEN_DARK }}>
            <CheckCircle2 size={16} className="shrink-0" />
            Accepted
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-sm font-semibold mb-2">2. Upload the signed &amp; stamped delivery note</div>
        {deliveryNoteUrl ? (
          <div className="flex items-center gap-2.5">
            {isPdf ? (
              <a
                href={deliveryNoteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-16 h-16 rounded-lg border border-green-200 bg-white flex flex-col items-center justify-center gap-0.5"
              >
                <FileText size={22} style={{ color: GREEN_DARK }} />
                <span className="text-[9px] font-semibold" style={{ color: GREEN_DARK }}>
                  PDF
                </span>
              </a>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={deliveryNoteUrl} alt="Delivery note" className="w-16 h-16 rounded-lg object-cover border border-green-200" />
            )}
            <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: GREEN_DARK }}>
              <CheckCircle2 size={16} className="shrink-0" />
              Delivered — note uploaded
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <label
              htmlFor={cameraInputId}
              className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-blue-300 bg-blue-50 rounded-lg py-3 text-sm font-semibold cursor-pointer"
              style={{ color: "#1D4ED8" }}
            >
              <Camera size={16} /> {uploadBusy ? "Uploading…" : "Take photo"}
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
              className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-blue-300 bg-blue-50 rounded-lg py-3 text-sm font-semibold cursor-pointer"
              style={{ color: "#1D4ED8" }}
            >
              {uploadBusy ? "Uploading…" : "Scan / choose file"}
              <input
                id={libraryInputId}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFile}
              />
            </label>
          </div>
        )}
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  );
}
