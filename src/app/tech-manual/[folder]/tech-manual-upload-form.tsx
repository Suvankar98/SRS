"use client";

import React from "react";
import { useRouter } from "next/navigation";

const CHUNK_SIZE_BYTES = 700 * 1024;
const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1600;
const IMAGE_TARGET_BYTES = 2 * 1024 * 1024;

type TechManualUploadFormProps = {
  folderId: string;
};

type UploadPopup = {
  type: "success" | "error";
  message: string;
};

export function TechManualUploadForm({ folderId }: TechManualUploadFormProps) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement | null>(null);
  const [fileError, setFileError] = React.useState("");
  const [isUploading, setIsUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [popup, setPopup] = React.useState<UploadPopup | null>(null);

  const validateFile = (file: File | null) => {
    if (!file) {
      setFileError("");
      return true;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setFileError("This file is too large. Please upload a document up to 250 MB.");
      return false;
    }

    setFileError("");
    return true;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isUploading) {
      return;
    }

    const form = event.currentTarget;
    const documentName = (form.elements.namedItem("documentName") as HTMLInputElement | null)?.value.trim() ?? "";
    const selectedFile = (form.elements.namedItem("file") as HTMLInputElement | null)?.files?.[0] ?? null;

    if (!documentName) {
      setPopup({ type: "error", message: "Please enter a document display name." });
      return;
    }

    if (!selectedFile || !validateFile(selectedFile)) {
      setPopup({ type: "error", message: fileError || "Please select a valid document file." });
      return;
    }

    setIsUploading(true);
    setProgress(0);

    try {
      const preparedFile = await prepareFileForUpload(selectedFile);
      await uploadFileInChunks({
        folderId,
        documentName,
        file: preparedFile,
        onProgress: setProgress,
      });

      formRef.current?.reset();
      setFileError("");
      setProgress(100);
      setPopup({ type: "success", message: "Document uploaded successfully." });
      router.refresh();
    } catch (error) {
      setPopup({
        type: "error",
        message: error instanceof Error ? error.message : "Upload failed. Please try again.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <form
        ref={formRef}
        onSubmit={handleSubmit}
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
        {isUploading ? (
          <div className="rounded-xl border border-blue-100 bg-white p-2">
            <div className="h-2 overflow-hidden rounded-full bg-blue-100">
              <div className="h-full rounded-full bg-blue-700 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-1 text-xs font-semibold text-blue-700">{progress}% uploaded</p>
          </div>
        ) : null}
        <button
          type="submit"
          disabled={Boolean(fileError) || isUploading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#0b4fb3] px-4 text-sm font-semibold text-white transition hover:bg-[#083f90] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <UploadIcon />
          {isUploading ? "Uploading..." : "Upload File"}
        </button>
      </form>

      {popup ? <UploadMessagePopup popup={popup} onClose={() => setPopup(null)} /> : null}
    </>
  );
}

async function prepareFileForUpload(file: File) {
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return file;
  }

  const compressed = await compressImage(file);
  return compressed.size < file.size ? compressed : file;
}

async function compressImage(file: File) {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(imageUrl);
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      return file;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    for (const quality of [0.82, 0.72, 0.62, 0.52]) {
      const blob = await canvasToBlob(canvas, "image/jpeg", quality);
      if (blob.size <= IMAGE_TARGET_BYTES || quality === 0.52) {
        return new File([blob], replaceFileExtension(file.name, "jpg"), { type: "image/jpeg" });
      }
    }
  } finally {
    URL.revokeObjectURL(imageUrl);
  }

  return file;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The selected image could not be compressed."));
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("The selected image could not be compressed."));
        }
      },
      type,
      quality,
    );
  });
}

function replaceFileExtension(fileName: string, nextExtension: string) {
  return fileName.replace(/\.[^.]+$/, "") + `.${nextExtension}`;
}

async function uploadFileInChunks({
  folderId,
  documentName,
  file,
  onProgress,
}: {
  folderId: string;
  documentName: string;
  file: File;
  onProgress: (progress: number) => void;
}) {
  const uploadId = createUploadId();
  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE_BYTES));

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    const start = chunkIndex * CHUNK_SIZE_BYTES;
    const end = Math.min(file.size, start + CHUNK_SIZE_BYTES);
    const formData = new FormData();

    formData.set("uploadId", uploadId);
    formData.set("folderId", folderId);
    formData.set("documentName", documentName);
    formData.set("fileName", file.name);
    formData.set("chunkIndex", String(chunkIndex));
    formData.set("totalChunks", String(totalChunks));
    formData.set("totalSize", String(file.size));
    formData.set("chunk", file.slice(start, end), file.name);

    const response = await fetch("/api/tech-manual/upload", {
      method: "POST",
      body: formData,
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.ok) {
      throw new Error(result?.message || "The file could not be uploaded. Please try again.");
    }

    onProgress(Math.round(((chunkIndex + 1) / totalChunks) * 100));
  }
}

function createUploadId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "");
  }

  return `${Date.now()}${Math.random().toString(36).slice(2)}`;
}

function UploadMessagePopup({ popup, onClose }: { popup: UploadPopup; onClose: () => void }) {
  const isSuccess = popup.type === "success";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-blue-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.24)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${isSuccess ? "text-emerald-600" : "text-red-600"}`}>
              {isSuccess ? "Upload Complete" : "Upload Error"}
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-blue-950">{popup.message}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-200"
            aria-label="Close upload message"
            title="Close"
          >
            <CloseIcon />
          </button>
        </div>
      </div>
    </div>
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

function CloseIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
