"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { updateServiceCallStatus } from "./actions";
import { getStatusLabel } from "./status-utils";
import { EmployeeMediaUpload } from "./dashboard/employee-media-upload";
import { formatDocketNumber } from "@/lib/docket";

type StatusRequest = {
  id: string;
  docketNumber: string;
  status: string | null;
  statusReason: string | null;
  customerReview?: string | null;
  mediaUploadedAt?: Date | string | null;
  activities?: ServiceHistoryActivity[];
};

type ServiceHistoryActivity = {
  id: string;
  type: string;
  title: string;
  details: string | null;
  status: string | null;
  statusReason: string | null;
  employeeName: string | null;
  actorName: string | null;
  actorRole: string | null;
  createdAt: Date | string;
};

type EditableStatus = "In Process" | "Completed" | "Cancel";
type StatusChoice = "" | EditableStatus;

type ModalStep = "details" | "signature";

type StatusMediaUploadPanelProps = {
  title: string;
  requestId: string;
  mediaLabel?: string;
  note: string;
  notePlaceholder: string;
  helperText: string;
  onNoteChange: (value: string) => void;
  onUploaded: () => void;
};

function StatusMediaUploadPanel({
  title,
  requestId,
  mediaLabel = title,
  note,
  notePlaceholder,
  helperText,
  onNoteChange,
  onUploaded,
}: StatusMediaUploadPanelProps) {
  return (
    <div className="min-w-0 space-y-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
      {notePlaceholder ? (
        <label className="block min-w-0">
          <span className="mb-1.5 block text-sm font-semibold text-blue-800">{title}</span>
          <textarea
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder={notePlaceholder}
            rows={3}
            className="w-full resize-y rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-blue-900 outline-none transition placeholder:text-blue-300 focus:border-blue-400"
          />
        </label>
      ) : (
        <p className="text-sm font-semibold text-blue-800">{title}</p>
      )}
      <EmployeeMediaUpload requestId={requestId} mediaLabel={mediaLabel} helperText={helperText} onUploaded={onUploaded} />
    </div>
  );
}
export function StatusUpdateModal({ request }: { request: StatusRequest }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const [status, setStatus] = React.useState<StatusChoice>("");
  const [reason, setReason] = React.useState(request.statusReason || "");
  const [customerReview, setCustomerReview] = React.useState(request.customerReview || "");
  const [submitError, setSubmitError] = React.useState("");
  const [beforeNote, setBeforeNote] = React.useState("");
  const [afterNote, setAfterNote] = React.useState("");
  const [uploadToast, setUploadToast] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [hasUploadedMedia, setHasUploadedMedia] = React.useState(Boolean(request.mediaUploadedAt));
  const [step, setStep] = React.useState<ModalStep>("details");
  const [isSigning, setIsSigning] = React.useState(false);
  const [hasSignature, setHasSignature] = React.useState(false);
  const signatureCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const currentStatusLabel = getStatusLabel(request.status);
  const displayDocketNumber = formatDocketNumber(request.docketNumber);
  const showCancelReasonInput = status === "Cancel";
  const showBeforeAfterMediaInput = status === "In Process" || status === "Completed";
  const showCancelMediaInput = status === "Cancel";
  const showSignatureStep = status === "In Process" || status === "Completed";

  const openModal = () => {
    setStatus("");
    setReason("");
    setSubmitError("");
    setUploadToast("");
    setBeforeNote("");
    setAfterNote("");
    setCustomerReview(request.customerReview || "");
    setHasUploadedMedia(Boolean(request.mediaUploadedAt));
    setStep("details");
    setHasSignature(false);
    setIsSigning(false);
    setIsOpen(true);
  };

  React.useEffect(() => {
    if (!uploadToast) {
      return;
    }

    const timeout = window.setTimeout(() => setUploadToast(""), 2500);
    return () => window.clearTimeout(timeout);
  }, [uploadToast]);

  React.useEffect(() => {
    if (step !== "signature") {
      return;
    }

    const resizeCanvas = () => {
      const canvas = signatureCanvasRef.current;

      if (!canvas) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));

      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }

      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.lineCap = "round";
      context.lineJoin = "round";
      context.lineWidth = 2.4;
      context.strokeStyle = "#0b63b6";
      context.clearRect(0, 0, rect.width, rect.height);
      setHasSignature(false);
    };

    const timeout = window.setTimeout(resizeCanvas, 0);
    window.addEventListener("resize", resizeCanvas);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [step]);

  const handleStatusChange = (newStatus: StatusChoice) => {
    setStatus(newStatus);
    setStep("details");
    setHasSignature(false);
    if (newStatus !== "Cancel") {
      setReason("");
    }

    if (newStatus !== "In Process" && newStatus !== "Completed") {
      setBeforeNote("");
      setAfterNote("");
    setCustomerReview(request.customerReview || "");
    }
  };

  const validateDetails = () => {
    setSubmitError("");

    if (!status) {
      setSubmitError("Please choose a status.");
      return false;
    }

    if (showCancelReasonInput && reason.trim() === "") {
      setSubmitError("Reason is required when status is Cancel.");
      return false;
    }

    if (status === "Completed" && !beforeNote.trim() && !afterNote.trim()) {
      setSubmitError("Please enter before or after details.");
      return false;
    }

    return true;
  };

  const handleNext = () => {
    if (!validateDetails()) {
      return;
    }

    setStep("signature");
  };

  const handleMediaUploaded = (label: string) => {
    setHasUploadedMedia(true);
    setSubmitError("");
    setUploadToast(`${label} media uploaded successfully.`);
    router.refresh();
  };

  const getStatusReasonValue = () => {
    const sections = [reason.trim()];

    if (showBeforeAfterMediaInput && beforeNote.trim()) {
      sections.push(`Before: ${beforeNote.trim()}`);
    }

    if (showBeforeAfterMediaInput && afterNote.trim()) {
      sections.push(`After: ${afterNote.trim()}`);
    }

    return sections.filter(Boolean).join("\n\n");
  };

  const handleSubmit = async () => {
    if (!validateDetails()) {
      return;
    }

    if (showSignatureStep && !hasSignature) {
      setSubmitError("Customer signature is required.");
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      const signatureDataUrl = hasSignature ? signatureCanvasRef.current?.toDataURL("image/png") : "";
      formData.append("requestId", String(request.id));
      formData.append("status", status);
      formData.append("statusReason", getStatusReasonValue());
      formData.append("customerReview", customerReview.trim());

      if (signatureDataUrl) {
        formData.append("customerSignatureDataUrl", signatureDataUrl);
      }

      await updateServiceCallStatus(formData);
      setIsOpen(false);
      router.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to update status.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSignaturePoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    const rect = canvas?.getBoundingClientRect();

    if (!rect) {
      return null;
    }

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const startSignature = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = getSignaturePoint(event);
    const context = signatureCanvasRef.current?.getContext("2d");

    if (!point || !context) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    context.beginPath();
    context.moveTo(point.x, point.y);
    setIsSigning(true);
  };

  const drawSignature = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isSigning) {
      return;
    }

    const point = getSignaturePoint(event);
    const context = signatureCanvasRef.current?.getContext("2d");

    if (!point || !context) {
      return;
    }

    event.preventDefault();
    context.lineTo(point.x, point.y);
    context.stroke();
    setHasSignature(true);
  };

  const stopSignature = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsSigning(false);
  };

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    context.clearRect(0, 0, rect.width, rect.height);
    setHasSignature(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="inline-flex rounded-lg bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800 transition hover:bg-blue-200"
      >
        {getStatusLabel(request.status)}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setIsOpen(false)}>
          {uploadToast ? (
            <div className="fixed right-4 top-4 z-[60] max-w-[calc(100vw-2rem)] rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-lg">
              {uploadToast}
            </div>
          ) : null}
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-blue-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-blue-200 px-4 py-4 sm:px-6">
              <h3 className="text-lg font-semibold text-blue-950">Update Call Status</h3>
              <p className="mt-1 text-sm text-blue-600">
                Docket: {displayDocketNumber} <span className="mx-2 text-blue-300">|</span> Current status: {currentStatusLabel}
              </p>
            </div>

            <div className="space-y-4 p-4 sm:p-6">
              {step === "details" ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-blue-700">Status</label>
                    <select
                      value={status}
                      onChange={(e) => handleStatusChange(e.target.value as StatusChoice)}
                      className="mt-2 w-full rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm text-blue-900 outline-none focus:border-blue-400"
                    >
                      <option value="">Choose</option>
                      <option value="In Process">In Process</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancel">Cancel</option>
                    </select>
                    <p className="mt-2 text-xs text-blue-600">After saving, this call will move off your dashboard.</p>
                  </div>

                  {showCancelReasonInput && (
                    <div>
                      <label className="block text-sm font-medium text-blue-700">
                        Reason <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Enter reason for this status change..."
                        className="mt-2 w-full rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm text-blue-900 outline-none focus:border-blue-400"
                        rows={4}
                      />
                    </div>
                  )}

                  {showBeforeAfterMediaInput ? (
                    <div className="grid min-w-0 gap-3 md:grid-cols-2">
                      <StatusMediaUploadPanel
                        title="Before"
                        requestId={request.id}
                        note={beforeNote}
                        notePlaceholder="Describe before condition..."
                        helperText="Capture before photo/video or voice message."
                        onNoteChange={setBeforeNote}
                        onUploaded={() => handleMediaUploaded("Before")}
                      />
                      <StatusMediaUploadPanel
                        title="After"
                        requestId={request.id}
                        note={afterNote}
                        notePlaceholder="Describe after work/result..."
                        helperText="Capture after photo/video or voice message."
                        onNoteChange={setAfterNote}
                        onUploaded={() => handleMediaUploaded("After")}
                      />
                    </div>
                  ) : null}

                  {showCancelMediaInput ? (
                    <StatusMediaUploadPanel
                      title={hasUploadedMedia ? "Status media uploaded" : "Status media"}
                      requestId={request.id}
                      mediaLabel="Status"
                      note=""
                      notePlaceholder=""
                      helperText="Optional for this status."
                      onNoteChange={() => undefined}
                      onUploaded={() => handleMediaUploaded("Status")}
                    />
                  ) : null}

                </>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-sm text-blue-900">
                    <p className="font-semibold">Customer Signature <span className="text-red-500">*</span></p>
                    <p className="mt-1 text-xs text-blue-600">
                      Status: {status} <span className="mx-1 text-blue-300">|</span> Docket: {displayDocketNumber}
                    </p>
                  </div>
                  <label className="block">
                    <span className="block text-sm font-medium text-blue-700">Customer Review</span>
                    <textarea
                      value={customerReview}
                      onChange={(event) => setCustomerReview(event.target.value)}
                      placeholder="Enter customer review..."
                      rows={3}
                      className="mt-2 w-full resize-y rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm text-blue-900 outline-none transition placeholder:text-blue-300 focus:border-blue-400"
                    />
                  </label>
                  <div>
                    <div className="rounded-xl border border-blue-200 bg-white p-2">
                      <canvas
                        ref={signatureCanvasRef}
                        onPointerDown={startSignature}
                        onPointerMove={drawSignature}
                        onPointerUp={stopSignature}
                        onPointerCancel={stopSignature}
                        onPointerLeave={stopSignature}
                        className="h-40 w-full touch-none rounded-lg bg-white"
                        aria-label="Customer signature pad"
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="text-xs font-medium text-red-600">Signature is required.</p>
                      <button
                        type="button"
                        onClick={clearSignature}
                        className="rounded-full border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {submitError ? <p className="text-sm font-medium text-red-600">{submitError}</p> : null}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => (step === "signature" ? setStep("details") : setIsOpen(false))}
                  className="flex-1 rounded-lg border border-blue-200 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
                >
                  {step === "signature" ? "Back" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={step === "details" && showSignatureStep ? handleNext : handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Saving..." : step === "details" && showSignatureStep ? "Next" : "Save Status"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
