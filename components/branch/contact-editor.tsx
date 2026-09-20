"use client";

import { useState } from "react";
import { Camera, Mail, MapPin, Phone } from "lucide-react";
import { GREEN, GREEN_DARK, KENYA_COUNTIES } from "@/lib/brand";
import { compressAndUpload } from "../photo";
import { saveBranchContact, saveManagerName, saveManagerPhoto } from "@/app/actions/branch";

export function BranchContactEditor({
  phone,
  email,
  address,
  county,
  zipCode,
  onSaved,
}: {
  phone: string;
  email: string;
  address: string;
  county: string;
  zipCode: string;
  onSaved: (msg: string) => void;
}) {
  const [effectivePhone, setEffectivePhone] = useState(phone);
  const [effectiveEmail, setEffectiveEmail] = useState(email);
  const [effectiveAddress, setEffectiveAddress] = useState(address);
  const [effectiveCounty, setEffectiveCounty] = useState(county);
  const [effectiveZipCode, setEffectiveZipCode] = useState(zipCode);
  // auto-open if no email or zip code on file yet — same "please complete this" pattern
  const [editing, setEditing] = useState(!email || !zipCode);
  const [phoneDraft, setPhoneDraft] = useState(phone);
  const [emailDraft, setEmailDraft] = useState(email);
  const [addressDraft, setAddressDraft] = useState(address);
  const [countyDraft, setCountyDraft] = useState(county);
  const [zipCodeDraft, setZipCodeDraft] = useState(zipCode);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    const res = await saveBranchContact(phoneDraft, emailDraft, addressDraft, countyDraft, zipCodeDraft);
    if (!res.ok) {
      onSaved(res.error);
      return;
    }
    setEffectivePhone(phoneDraft.trim());
    setEffectiveEmail(emailDraft.trim());
    setEffectiveAddress(addressDraft.trim());
    setEffectiveCounty(countyDraft);
    setEffectiveZipCode(zipCodeDraft.trim());
    setSaved(true);
    setEditing(false);
    onSaved("Contact details updated");
    setTimeout(() => setSaved(false), 2000);
  }

  if (!editing) {
    return (
      <div className="flex flex-col gap-0.5 mt-1.5">
        <div className="text-xs text-gray-500 flex items-center gap-1.5">
          <Phone size={11} className="text-gray-400" /> {effectivePhone || "No phone on file"}
        </div>
        <div className="text-xs text-gray-500 flex items-center gap-1.5">
          <Mail size={11} className="text-gray-400" /> {effectiveEmail}
        </div>
        <div className="text-xs text-gray-500 flex items-center gap-1.5">
          <MapPin size={11} className="text-gray-400" />
          {effectiveAddress || "No address on file"}
          {effectiveCounty && `, ${effectiveCounty}`}
          {effectiveZipCode && ` ${effectiveZipCode}`}
        </div>
        <button
          onClick={() => setEditing(true)}
          className="text-[11px] font-semibold self-start mt-0.5"
          style={{ color: GREEN_DARK }}
        >
          Edit contact details
        </button>
      </div>
    );
  }

  return (
    <div
      className="mt-2 p-3 rounded-lg"
      style={{
        background: effectiveEmail && effectiveZipCode ? "#F9FAFB" : "#FEF6F5",
        border: effectiveEmail && effectiveZipCode ? "1px solid #E5E7EB" : "1px solid #F5C4BE",
      }}
    >
      {!effectiveEmail && (
        <div className="text-xs font-semibold mb-2" style={{ color: "#C0392B" }}>
          No email on file for this branch — please add one below.
        </div>
      )}
      {!effectiveZipCode && (
        <div className="text-xs font-semibold mb-2" style={{ color: "#C0392B" }}>
          Please choose your county and enter your zip code below.
        </div>
      )}
      <label className="flex flex-col gap-1 mb-2">
        <span className="text-[11px] text-gray-500 font-medium">Phone</span>
        <input
          value={phoneDraft}
          onChange={(e) => setPhoneDraft(e.target.value)}
          placeholder="+254 7XX XXX XXX"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 mb-2">
        <span className="text-[11px] text-gray-500 font-medium">Email</span>
        <input
          type="email"
          value={emailDraft}
          onChange={(e) => setEmailDraft(e.target.value)}
          placeholder="branch@example.com"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 mb-2">
        <span className="text-[11px] text-gray-500 font-medium">Address</span>
        <input
          value={addressDraft}
          onChange={(e) => setAddressDraft(e.target.value)}
          placeholder="Street, building, area"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 mb-2">
        <span className="text-[11px] text-gray-500 font-medium">County</span>
        <select
          value={countyDraft}
          onChange={(e) => setCountyDraft(e.target.value)}
          className={`border rounded-lg px-3 py-2 text-sm bg-white ${
            countyDraft ? "border-gray-300" : "border-red-300 bg-red-50"
          }`}
        >
          <option value="">Select your county</option>
          {KENYA_COUNTIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 mb-2">
        <span className="text-[11px] text-gray-500 font-medium">Zip code</span>
        <input
          value={zipCodeDraft}
          onChange={(e) => setZipCodeDraft(e.target.value)}
          placeholder="e.g. 00100"
          className={`border rounded-lg px-3 py-2 text-sm ${
            zipCodeDraft.trim() ? "border-gray-300" : "border-red-300 bg-red-50"
          }`}
        />
      </label>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!countyDraft || !zipCodeDraft.trim()}
          className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold disabled:opacity-60"
          style={{ background: !countyDraft || !zipCodeDraft.trim() ? "#9CA3AF" : GREEN }}
        >
          {saved ? "Saved ✓" : "Save"}
        </button>
        {effectiveEmail && effectiveZipCode && (
          <button
            onClick={() => {
              setPhoneDraft(effectivePhone);
              setEmailDraft(effectiveEmail);
              setAddressDraft(effectiveAddress);
              setCountyDraft(effectiveCounty);
              setZipCodeDraft(effectiveZipCode);
              setEditing(false);
            }}
            className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold text-gray-600"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

export function ManagerPhotoUploader({
  photoUrl,
  name,
  onSaved,
}: {
  photoUrl: string | null;
  name: string | null;
  onSaved: (msg: string) => void;
}) {
  const inputId = "mgr-photo-upload";
  const [photo, setPhoto] = useState(photoUrl);
  const [savedName, setSavedName] = useState(name ?? "");
  const [nameDraft, setNameDraft] = useState(name ?? "");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await compressAndUpload(file, 220, 0.6);
      setPhoto(url);
      await saveManagerPhoto(url);
      onSaved("Photo saved");
    } catch {
      /* ignore */
    }
    e.target.value = "";
  }

  async function handleRemove() {
    setPhoto(null);
    await saveManagerPhoto(null);
    onSaved("Photo removed");
  }

  async function handleNameBlur() {
    const value = nameDraft.trim();
    if (value === savedName) return;
    await saveManagerName(value);
    setSavedName(value);
    onSaved("Name saved");
  }

  const incomplete = !photo || !savedName;

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: incomplete ? "#FEF6F5" : "#F9FAFB",
        border: incomplete ? "1px solid #F5C4BE" : "1px solid #E5E7EB",
      }}
    >
      {incomplete && (
        <div className="text-xs font-semibold mb-3" style={{ color: "#C0392B" }}>
          Add your photo &amp; name below — merchandisers use this to confirm they&apos;re speaking with the right
          person.
        </div>
      )}
      <div className="flex items-start gap-3">
        <label htmlFor={inputId} className="relative cursor-pointer shrink-0">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="Branch manager" className="w-14 h-14 rounded-full object-cover border-2 border-white shadow" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400">
              <Camera size={20} />
            </div>
          )}
          <span className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full border border-gray-200 w-5 h-5 flex items-center justify-center shadow-sm">
            <Camera size={10} className="text-gray-500" />
          </span>
          <input id={inputId} type="file" accept="image/*" capture="user" className="hidden" onChange={handleFile} />
        </label>
        <div className="flex-1">
          <label className="flex flex-col gap-1 mb-1.5">
            <span className="text-[11px] text-gray-500 font-medium">Your name (shown to visiting merchandisers)</span>
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={handleNameBlur}
              placeholder="e.g. Joan Wanjiru"
              className={`border rounded-lg px-3 py-1.5 text-sm ${!nameDraft.trim() ? "border-red-300 bg-red-50" : "border-gray-300"}`}
            />
          </label>
          {nameDraft.trim() && !photo && (
            <label
              htmlFor={inputId}
              className="mt-1 mb-2 w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold cursor-pointer text-white"
              style={{ background: GREEN }}
            >
              <Camera size={16} /> Take Selfie
            </label>
          )}
          <div className="text-xs text-gray-500">
            {photo ? (
              <>
                Your photo and name are on file, so merchandisers can confirm they&apos;re speaking with you.{" "}
                <button onClick={handleRemove} className="text-red-500 font-semibold">
                  Remove photo
                </button>
              </>
            ) : (
              <>Upload a face photo so visiting merchandisers can recognize you on-site.</>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
