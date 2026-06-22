"use client";

import React from "react";
import { updateServiceCallStatus } from "./actions";

export function StatusUpdateModal({ request }: { request: any }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [status, setStatus] = React.useState(request.status || "Pending");
  const [reason, setReason] = React.useState(request.statusReason || "");
  const [showReasonInput, setShowReasonInput] = React.useState(
    request.status === "Cancel" || request.status === "Visit & Reschedule"
  );

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    setShowReasonInput(newStatus === "Cancel" || newStatus === "Visit & Reschedule");
    if (newStatus !== "Cancel" && newStatus !== "Visit & Reschedule") {
      setReason("");
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("requestId", String(request.id));
    formData.append("status", status);
    formData.append("statusReason", reason);
    
    await updateServiceCallStatus(formData);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex rounded-lg bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800 transition hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:hover:bg-blue-900"
      >
        {request.status || "Pending"}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-blue-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-blue-200 px-6 py-4 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-blue-950 dark:text-slate-100">
                Update Call Status
              </h3>
              <p className="mt-1 text-sm text-blue-600 dark:text-slate-400">
                Docket: {request.docketNumber}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <div>
                <label className="block text-sm font-medium text-blue-700 dark:text-slate-200">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm text-blue-900 outline-none focus:border-blue-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="Pending">Pending</option>
                  <option value="Cancel">Cancel</option>
                  <option value="Visit & Reschedule">Visit & Reschedule</option>
                  <option value="Close">Close</option>
                </select>
              </div>

              {showReasonInput && (
                <div>
                  <label className="block text-sm font-medium text-blue-700 dark:text-slate-200">
                    Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Enter reason for this status change..."
                    required={showReasonInput}
                    className="mt-2 w-full rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm text-blue-900 outline-none focus:border-blue-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    rows={4}
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 rounded-lg border border-blue-200 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800 dark:bg-sky-600 dark:hover:bg-sky-500"
                >
                  Save Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}


