"use client";

import { useRef, useState, useTransition } from "react";
import { uploadEmployeeImage } from "../actions";

type EmployeeMediaUploadProps = {
  requestId: string;
  onUploaded?: () => void;
};

const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];
const allowedExtensions = ["png", "jpeg", "jpg", "webp", "gif"];

export function EmployeeMediaUpload({ requestId, onUploaded }: EmployeeMediaUploadProps) {
  const [fileName, setFileName] = useState<string>("");
  const [fileError, setFileError] = useState<string>("");
  const [uploadError, setUploadError] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File | null) => {
    if (!file) {
      setFileName("");
      setFileError("");
      setUploadError("");
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const isAllowedType = file.type ? allowedTypes.includes(file.type) : false;
    const isAllowedExtension = allowedExtensions.includes(extension);

    setFileName(file.name);
    setUploadError("");

    if (!isAllowedType && !isAllowedExtension) {
      setFileError("Unsupported file type. Please capture an image.");
    } else {
      setFileError("");
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null;
    validateFile(file);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (fileError || !fileName) {
      setUploadError(fileError || "Please capture an image first.");
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    setUploadError("");

    startTransition(async () => {
      try {
        await uploadEmployeeImage(formData);
        setFileName("");
        onUploaded?.();
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : "Upload failed. Please try again.");
      }
    });
  };

  return (
    <form className="flex flex-col gap-1 text-[11px] text-blue-950" onSubmit={handleSubmit}>
      <div className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="requestId" value={requestId} />
        <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-full border border-blue-200 bg-white px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-50">
          <CameraIcon />
          Camera
          <input
            name="file"
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
            ref={fileInputRef}
          />
        </label>
        <span className="max-w-[9rem] truncate text-blue-600">{fileName || "No photo captured"}</span>
        <button
          type="submit"
          aria-label="Upload photo"
          disabled={!fileName || !!fileError || isPending}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-950 text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <UploadIcon />
        </button>
      </div>
      {fileError ? <p className="text-xs text-red-600">{fileError}</p> : null}
      {uploadError ? <p className="text-xs font-medium text-red-600">{uploadError}</p> : null}
      {isPending ? <p className="text-xs font-medium text-blue-700">Uploading...</p> : null}
      <p className="text-[10px] text-blue-600">Optional for completion.</p>
    </form>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 7h1.6l1.2-2h4.4l1.2 2H17a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3Z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 5 17 10" />
      <line x1="12" y1="5" x2="12" y2="19" />
    </svg>
  );
}