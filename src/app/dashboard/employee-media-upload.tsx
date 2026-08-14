"use client";

import React, { useRef, useState, useTransition } from "react";
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
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
  "audio/aac",
  "audio/m4a",
];
const allowedExtensions = ["png", "jpeg", "jpg", "webp", "gif", "webm", "ogg", "mp3", "mp4", "wav", "aac", "m4a"];

export function EmployeeMediaUpload({ requestId, onUploaded }: EmployeeMediaUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [fileError, setFileError] = useState<string>("");
  const [uploadError, setUploadError] = useState<string>("");
  const [isRecording, setIsRecording] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);

  const validateFile = (file: File | null) => {
    if (!file) {
      setSelectedFile(null);
      setFileName("");
      setFileError("");
      setUploadError("");
      return false;
    }

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const isAllowedType = file.type ? allowedTypes.includes(file.type) : false;
    const isAllowedExtension = allowedExtensions.includes(extension);

    setSelectedFile(file);
    setFileName(file.name);
    setUploadError("");

    if (!isAllowedType && !isAllowedExtension) {
      setFileError("Unsupported file type. Please capture an image or record a voice message.");
      return false;
    }

    setFileError("");
    return true;
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null;
    validateFile(file);
  };

  const stopRecordingStream = () => {
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setUploadError("Voice recording is not supported on this device/browser.");
      return;
    }

    try {
      setUploadError("");
      setFileError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordingChunksRef.current = [];
      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const extension = getVoiceFileExtension(mimeType);
        const blob = new Blob(recordingChunksRef.current, { type: mimeType });
        const voiceFile = new File([blob], `voice-message-${Date.now()}.${extension}`, { type: mimeType });
        validateFile(voiceFile);
        setIsRecording(false);
        stopRecordingStream();
      };

      recorder.start();
      setSelectedFile(null);
      setFileName("Recording...");
      setIsRecording(true);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      stopRecordingStream();
      setIsRecording(false);
      setUploadError(error instanceof Error ? error.message : "Unable to start voice recording.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isRecording) {
      setUploadError("Stop the voice recording before uploading.");
      return;
    }

    if (fileError || !selectedFile) {
      setUploadError(fileError || "Please capture an image or record a voice message first.");
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("file", selectedFile, selectedFile.name);
    setUploadError("");

    startTransition(async () => {
      try {
        await uploadEmployeeImage(formData);
        setSelectedFile(null);
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
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isPending}
          className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition ${
            isRecording
              ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
              : "border-blue-200 bg-white text-blue-700 hover:bg-blue-50"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <MicIcon />
          {isRecording ? "Stop" : "Voice"}
        </button>
        <span className="max-w-[9rem] truncate text-blue-600">{fileName || "No file ready"}</span>
        <button
          type="submit"
          aria-label="Upload media"
          disabled={!selectedFile || !!fileError || isPending || isRecording}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-950 text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <UploadIcon />
        </button>
      </div>
      {fileError ? <p className="text-xs text-red-600">{fileError}</p> : null}
      {uploadError ? <p className="text-xs font-medium text-red-600">{uploadError}</p> : null}
      {isPending ? <p className="text-xs font-medium text-blue-700">Uploading...</p> : null}
      <p className="text-[10px] text-blue-600">Optional for this status.</p>
    </form>
  );
}

function getVoiceFileExtension(mimeType: string) {
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 7h1.6l1.2-2h4.4l1.2 2H17a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3Z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z" />
      <path d="M19 11a7 7 0 0 1-14 0" />
      <path d="M12 18v3" />
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