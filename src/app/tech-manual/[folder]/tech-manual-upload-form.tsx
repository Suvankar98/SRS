"use client";

import React from "react";

import { uploadTechManualDocument } from "@/app/actions";

const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
const MAX_FILE_SIZE_LABEL = "100 MB";

type TechManualUploadFormProps = {
  folderId: string;
};

export function TechManualUploadForm({ folderId }: TechManualUploadFormProps) {
  const [fileError, setFileError] = React.useState("");

  const validateFile = (file: File | null) => {
    if (!file) {
      setFileError("");
      return true;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileError(`This file is too large. Please upload a document up to ${MAX_FILE_SIZE_LABEL}.`);
      return false;
    }

    setFileError("");
    return true;
  };

  return (
    <form
      action={uploadTechManualDocument}
      onSubmit={(event) => {
        const form = event.currentTarget;
        const file = (form.elements.namedItem("file") as HTMLInputElement | null)?.files?.[0] ?? null;

        if (!validateFile(file)) {
          event.preventDefault();
        }
      }}
      className="grid gap-3 rounded-2xl border border-blue-100 bg-slate-50 p-4"
    >
      <input type="hidden" name="folderId" value={folderId} />
      <p className="text-sm font-bold text-blue-950">Upload Document</p>
      <input
        name="documentName"
        required
        maxLength={140}
        placeholder="Document display name"
        className="h-10 rounded-xl border border-blue-200 bg-white px-3 text-sm font-medium text-blue-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
      />
      <input
        name="file"
        type="file"
        required
        accept="image/*,video/*,.pdf,.doc,.docx,.rtf"
        onChange={(event) => validateFile(event.currentTarget.files?.[0] ?? null)}
        className="block w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm text-blue-950 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-100 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-blue-700"
      />
      {fileError ? <p className="text-xs font-semibold text-red-600">{fileError}</p> : null}
      <button
        type="submit"
        disabled={Boolean(fileError)}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#0b4fb3] px-4 text-sm font-semibold text-white transition hover:bg-[#083f90] disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        <UploadIcon />
        Upload File
      </button>
    </form>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M5 20h14" />
    </svg>
  );
}
