"use client";

import React, { useRef, useState, useTransition } from "react";
import { uploadEmployeeImage } from "../actions";

type EmployeeMediaUploadProps = {
  requestId: string;
  mediaLabel?: string;
  helperText?: string;
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
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
  "audio/aac",
  "audio/m4a",
];
const allowedExtensions = ["png", "jpeg", "jpg", "webp", "gif", "mp4", "m4v", "webm", "mov", "qt", "ogv", "ogg", "avi", "mkv", "3gp", "wmv", "mp3", "wav", "aac", "m4a"];

export function EmployeeMediaUpload({ requestId, mediaLabel, helperText = "Optional for this status.", onUploaded }: EmployeeMediaUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [fileError, setFileError] = useState<string>("");
  const [uploadError, setUploadError] = useState<string>("");
  const [isRecording, setIsRecording] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [isPending, startTransition] = useTransition();
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const photoCanvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraRecorderRef = useRef<MediaRecorder | null>(null);
  const cameraChunksRef = useRef<Blob[]>([]);

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
      setFileError("Unsupported file type. Please capture a photo, video, or voice message.");
      return false;
    }

    setFileError("");
    return true;
  };

  const stopRecordingStream = () => {
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
  };

  const stopCameraStream = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
  };

  React.useEffect(() => {
    if (!isCameraOpen || !videoPreviewRef.current || !cameraStreamRef.current) {
      return;
    }

    videoPreviewRef.current.srcObject = cameraStreamRef.current;
    void videoPreviewRef.current.play().catch(() => undefined);
  }, [isCameraOpen]);

  React.useEffect(() => {
    return () => {
      stopRecordingStream();
      stopCameraStream();
    };
  }, []);

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setUploadError("Camera capture is not supported on this device/browser.");
      return;
    }

    try {
      setUploadError("");
      setFileError("");
      setIsCameraLoading(true);
      let stream: MediaStream;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: true,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      }

      cameraStreamRef.current = stream;
      setIsCameraOpen(true);
    } catch (error) {
      stopCameraStream();
      setUploadError(error instanceof Error ? error.message : "Unable to open camera.");
    } finally {
      setIsCameraLoading(false);
    }
  };

  const closeCamera = () => {
    if (cameraRecorderRef.current && cameraRecorderRef.current.state !== "inactive") {
      cameraRecorderRef.current.stop();
      return;
    }

    setIsVideoRecording(false);
    setIsCameraOpen(false);
    stopCameraStream();
  };

  const capturePhoto = () => {
    const video = videoPreviewRef.current;
    const canvas = photoCanvasRef.current;

    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) {
      setUploadError("Camera is not ready yet.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");

    if (!context) {
      setUploadError("Unable to capture photo on this device.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setUploadError("Unable to capture photo on this device.");
        return;
      }

      const photoFile = new File([blob], `camera-photo-${Date.now()}.jpg`, { type: "image/jpeg" });
      validateFile(photoFile);
      closeCamera();
    }, "image/jpeg", 0.92);
  };

  const startVideoCapture = () => {
    const stream = cameraStreamRef.current;

    if (!stream || typeof MediaRecorder === "undefined") {
      setUploadError("Video recording is not supported on this device/browser.");
      return;
    }

    try {
      const mimeType = getSupportedVideoMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      cameraChunksRef.current = [];
      cameraRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          cameraChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const recordedMimeType = recorder.mimeType || mimeType || "video/webm";
        const extension = getVideoFileExtension(recordedMimeType);
        const blob = new Blob(cameraChunksRef.current, { type: recordedMimeType });
        const videoFile = new File([blob], `camera-video-${Date.now()}.${extension}`, { type: recordedMimeType });
        validateFile(videoFile);
        setIsVideoRecording(false);
        setIsCameraOpen(false);
        stopCameraStream();
      };

      recorder.start();
      setSelectedFile(null);
      setFileName("Recording video...");
      setIsVideoRecording(true);
      setUploadError("");
      setFileError("");
    } catch (error) {
      setIsVideoRecording(false);
      setUploadError(error instanceof Error ? error.message : "Unable to start video recording.");
    }
  };

  const stopVideoCapture = () => {
    if (cameraRecorderRef.current && cameraRecorderRef.current.state !== "inactive") {
      cameraRecorderRef.current.stop();
    }
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

    if (isVideoRecording) {
      setUploadError("Stop the video recording before uploading.");
      return;
    }

    if (fileError || !selectedFile) {
      setUploadError(fileError || "Please capture a photo, video, or voice message first.");
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
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : "Upload failed. Please try again.");
      }
    });
  };

  return (
    <form className="min-w-0 text-[11px] text-blue-950" onSubmit={handleSubmit}>
      <div className="grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)_2rem] items-center gap-2 max-[420px]:grid-cols-2">
        <input type="hidden" name="requestId" value={requestId} />
        {mediaLabel ? <input type="hidden" name="mediaLabel" value={mediaLabel} /> : null}
        <button
          type="button"
          onClick={openCamera}
          disabled={isPending || isRecording || isVideoRecording || isCameraLoading}
          className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-full border border-blue-200 bg-white px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CameraIcon />
          {isCameraLoading ? "Opening" : "Camera"}
        </button>
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isPending || isCameraOpen || isVideoRecording}
          className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition ${
            isRecording
              ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
              : "border-blue-200 bg-white text-blue-700 hover:bg-blue-50"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <MicIcon />
          {isRecording ? "Stop" : "Voice"}
        </button>
        <span className="min-w-0 truncate text-blue-600 max-[420px]:col-span-1">{fileName || "No file ready"}</span>
        <button
          type="submit"
          aria-label="Upload media"
          disabled={!selectedFile || !!fileError || isPending || isRecording || isVideoRecording}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-950 text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <UploadIcon />
        </button>
      </div>
      {fileError ? <p className="text-xs text-red-600">{fileError}</p> : null}
      {uploadError ? <p className="text-xs font-medium text-red-600">{uploadError}</p> : null}
      {isPending ? <p className="text-xs font-medium text-blue-700">Uploading...</p> : null}
      <p className="mt-1 break-words text-[10px] leading-4 text-blue-600">{helperText}</p>

      {isCameraOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onClick={closeCamera}>
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-blue-100 px-4 py-3">
              <p className="text-sm font-semibold text-blue-950">Camera</p>
              <button
                type="button"
                onClick={closeCamera}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close camera"
                title="Close"
              >
                <CloseIcon />
              </button>
            </div>
            <div className="bg-slate-950">
              <video ref={videoPreviewRef} className="aspect-[3/4] max-h-[68vh] w-full object-cover" playsInline muted autoPlay />
              <canvas ref={photoCanvasRef} className="hidden" />
            </div>
            <div className="grid grid-cols-2 gap-2 p-3">
              <button
                type="button"
                onClick={capturePhoto}
                disabled={isVideoRecording}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Photo
              </button>
              <button
                type="button"
                onClick={isVideoRecording ? stopVideoCapture : startVideoCapture}
                className={`inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-xs font-bold transition ${
                  isVideoRecording
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-blue-700 text-white hover:bg-blue-800"
                }`}
              >
                {isVideoRecording ? "Stop Video" : "Record Video"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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

function getSupportedVideoMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  const types = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function getVideoFileExtension(mimeType: string) {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogv";
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

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
    </svg>
  );
}
