"use client";

import { useId, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { GREEN, GREEN_DARK } from "@/lib/brand";
import { uploadLpoFile } from "../photo";
import { addLpoDocument, removeLpoDocument } from "@/app/actions/branch";
import type { LpoDocumentDTO } from "@/lib/queries";

export function LpoUploader({
  documents,
  onSaved,
}: {
  documents: LpoDocumentDTO[];
  onSaved: (msg: string) => void;
}) {
  const inputId = useId();
  const [docs, setDocs] = useState(documents);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const url = await uploadLpoFile(file);
      await addLpoDocument(url, file.name);
      setDocs((prev) => [{ id: url, url, filename: file.name, uploadedAt: "just now" }, ...prev]);
      onSaved("LPO uploaded");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
    setBusy(false);
    e.target.value = "";
  }

  async function handleRemove(id: string) {
    setDocs((prev) => prev.filter((d) => d.id !== id));
    await removeLpoDocument(id);
    onSaved("LPO removed");
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="font-semibold text-sm mb-1">Your LPO Documents</div>
      <div className="text-xs text-gray-400 mb-3">
        Upload a PDF or a photo of your signed LPO for this order — Pure Nutrition can see it in your branch&apos;s
        order summary.
      </div>
      {docs.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
              <a
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm min-w-0 flex-1"
                style={{ color: GREEN_DARK }}
              >
                <FileText size={15} className="shrink-0" />
                <span className="truncate">{d.filename}</span>
              </a>
              <span className="text-[11px] text-gray-400 shrink-0">{d.uploadedAt}</span>
              <button onClick={() => handleRemove(d.id)} className="text-gray-300 hover:text-red-500 shrink-0">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      {error && <div className="text-xs text-red-600 mb-2">{error}</div>}
      <label
        htmlFor={inputId}
        className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold cursor-pointer text-white"
        style={{ background: busy ? "#9CA3AF" : GREEN }}
      >
        <Upload size={16} /> {busy ? "Uploading…" : "Upload LPO"}
        <input
          id={inputId}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={handleFile}
          disabled={busy}
        />
      </label>
    </div>
  );
}
