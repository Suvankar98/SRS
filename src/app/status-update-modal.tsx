"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { updateServiceCallStatus } from "./actions";
import { getStatusLabel } from "./status-utils";
import { EmployeeMediaUpload } from "./dashboard/employee-media-upload";

type StatusRequest = {
  id: string;
  docketNumber: string;
  status: string | null;
  statusReason: string | null;
  mediaUploadedAt?: Date | string | null;
};

type EditableStatus = "In Process" | "Completed" | "Cancel";
type StatusChoice = "" | EditableStatus;

export function StatusUpdateModal({ request }: { request: StatusRequest }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const [status, setStatus] = React.useState<StatusChoice>("");
  const [reason, setReason] = React.useState(request.statusReason || "");
  const [submitError, setSubmitError] = React.useState("");
  const [uploadToast, setUploadToast] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [hasUploadedMedia, setHasUploadedMedia] = React.useState(Boolean(request.mediaUploadedAt));
  const currentStatusLabel = getStatusLabel(request.status);
  const showWorkDoneInput = status === "In Process";
  const showCancelReasonInput = status === "Cancel";
  const showCompletedRemarkInput = status === "Completed";

  const openModal = () => {
    setStatus("");
    setReason("");
    setSubmitError("");
    setUploadToast("");
    setHasUploadedMedia(Boolean(request.mediaUploadedAt));
    setIsOpen(true);
  };

  React.useEffect(() => {
    if (!uploadToast) {
      return;
    }

    const timeout = window.setTimeout(() => setUploadToast(""), 2500);
    return () => window.clearTimeout(timeout);
  }, [uploadToast]);

  const handleStatusChange = (newStatus: StatusChoice) => {
    setStatus(newStatus);
    if (newStatus !== "Cancel" && newStatus !== "In Process" && newStatus !== "Completed") {
      setReason("");
    }
  };

  const handleSubmit = async () => {
    setSubmitError("");

    if (!status) {
      setSubmitError("Please choose a status.");
      return;
    }

    if (showWorkDoneInput && reason.trim() === "") {
      setSubmitError("Please enter how much work is done.");
      return;
    }

    if (showCancelReasonInput && reason.trim() === "") {
      setSubmitError("Reason is required when status is Cancel.");
      return;
    }

    if (status === "Completed" && !hasUploadedMedia) {
      setSubmitError("Upload media first.");
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("requestId", String(request.id));
      formData.append("status", status);
      formData.append("statusReason", reason);

      await updateServiceCallStatus(formData);
      setIsOpen(false);
      router.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to update status.");
    } finally {
      setIsSubmitting(false);
    }
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
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-blue-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-blue-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-blue-950">
                Update Call Status
              </h3>
              <p className="mt-1 text-sm text-blue-600">
                Docket: {request.docketNumber} <span className="mx-2 text-blue-300">|</span> Current status: {currentStatusLabel}
              </p>
            </div>

            <div className="space-y-4 p-6">
              <div>
                <label className="block text-sm font-medium text-blue-700">
                  Status
                </label>
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

              {showWorkDoneInput && (
                <div>
                  <label className="block text-sm font-medium text-blue-700">
                    Work done <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Describe how much work is done..."
                    className="mt-2 w-full rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm text-blue-900 outline-none focus:border-blue-400"
                    rows={4}
                  />
                </div>
              )}

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

              {status === "Completed" ? (
                <div className="space-y-4">
                  {showCompletedRemarkInput ? (
                    <div>
                      <label className="block text-sm font-medium text-blue-700">
                        Remark
                      </label>
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Enter completion remark..."
                        className="mt-2 w-full rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm text-blue-900 outline-none focus:border-blue-400"
                        rows={4}
                      />
                    </div>
                  ) : null}

                  <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                    <p className="break-words text-xs font-medium text-blue-700 sm:text-sm">
                      {hasUploadedMedia ? "Media ready." : "Upload media to complete."}
                    </p>
                    <EmployeeMediaUpload
                      requestId={request.id}
                      onUploaded={() => {
                        setHasUploadedMedia(true);
                        setSubmitError("");
                        setUploadToast("Media uploaded successfully.");
                        router.refresh();
                      }}
                    />
                  </div>
                </div>
              ) : null}
              {submitError ? <p className="text-sm font-medium text-red-600">{submitError}</p> : null}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 rounded-lg border border-blue-200 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Saving..." : "Save Status"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}



