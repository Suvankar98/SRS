"use client";

import { useRef, useState, useTransition } from "react";
import { uploadEmployeeImage } from "../actions";

type EmployeeMediaUploadProps = {
  requestId: string;
  onUploaded?: () => void;
};

const allowedTypes = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/ogg",
  "video/x-msvideo",
  "video/x-matroska",
  "video/3gpp",
  "video/x-ms-wmv",
  "video/x-m4v",
];
const allowedExtensions = [
  "png",
  "jpeg",
  "jpg",
  "webp",
  "gif",
  "mp4",
  "m4v",
  "webm",
  "mov",
  "qt",
  "ogv",
  "avi",
  "mkv",
  "3gp",
  "wmv",
];

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
      setFileError("Unsupported file type. Please choose an image or supported video.");
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
      setUploadError(fileError || "Please choose an image or video first.");
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
    <form
      className="flex flex-col gap-1 text-[11px] text-blue-950"
      onSubmit={handleSubmit}
    >
      <div className="flex items-center gap-2">
        <input type="hidden" name="requestId" value={requestId} />
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-2 py-1 transition hover:bg-blue-100">
          <span className="font-semibold">File</span>
          <input
            name="file"
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleFileChange}
            ref={fileInputRef}
          />
        </label>
        <span className="truncate max-w-[9rem] text-blue-600">{fileName || "No file chosen"}</span>
        <button
          type="submit"
          aria-label="Upload file"
          disabled={!fileName || !!fileError || isPending}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-950 text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 5 17 10" />
            <line x1="12" y1="5" x2="12" y2="19" />
          </svg>
        </button>
      </div>
      {fileError ? <p className="text-xs text-red-600">{fileError}</p> : null}
      {uploadError ? <p className="text-xs font-medium text-red-600">{uploadError}</p> : null}
      {isPending ? <p className="text-xs font-medium text-blue-700">Uploading...</p> : null}
      <p className="text-[10px] text-blue-600">Optional for completion.</p>
    </form>
  );
}
