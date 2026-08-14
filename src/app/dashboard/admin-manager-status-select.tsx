"use client";

import React from "react";

import { updateAssignmentStatusPointApproval, updateManagerServiceStatus } from "../actions";
import { getStatusLabel, getStatusPillClass, normalizeStatus } from "../status-utils";
import { formatPointDelta } from "@/lib/points";
import type { DashboardRequestMediaItem } from "@/lib/gallery";

const STATUS_OPTIONS = ["New Call", "In Process", "Completed", "Cancel"] as const;

type AdminManagerStatusSelectProps = {
  request: {
    id: string;
    status: string | null;
    statusReason: string | null;
    statusSubmittedAt?: Date | string | null;
    statusPointsDelta?: number | null;
    lastAttemptByName?: string | null;
    assignments?: Array<{
      id?: string;
      employeeId: string;
      status?: string | null;
      statusReason?: string | null;
      statusSubmittedAt?: Date | string | null;
      statusPointsDelta?: number | null;
      statusPointsApproval?: string | null;
      statusPointsReviewedAt?: Date | string | null;
      statusPointsReviewedByName?: string | null;
      employee?: { name: string } | null;
    }>;
    mediaItems?: DashboardRequestMediaItem[];
  };
};

export function AdminManagerStatusSelect({ request }: AdminManagerStatusSelectProps) {
  const status = getStatusLabel(request.status);
  const assignmentRemarks = getAssignmentRemarks(request.assignments ?? [], request.mediaItems ?? []);
  const remarks = assignmentRemarks.length > 0 ? assignmentRemarks : getRequestFallbackRemarks(request);

  return (
    <div className="space-y-1">
      <form action={updateManagerServiceStatus} onClick={(event) => event.stopPropagation()}>
        <input type="hidden" name="requestId" value={request.id} />
        <select
          name="status"
          defaultValue={status}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          className={`w-full max-w-[7.5rem] rounded-md border px-2 py-1 text-[11px] font-semibold outline-none ring-1 ring-inset transition focus:border-blue-400 focus:ring-blue-400 ${getStatusPillClass(
            status,
          )}`}
          aria-label="Update service status"
          title="Update status"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </form>
      {remarks.length > 0 ? <AssignmentRemarksPopup remarks={remarks} /> : null}
    </div>
  );
}

type AssignmentRemark = {
  id: string;
  employeeName: string;
  status: ReturnType<typeof normalizeStatus>;
  remark: string;
  submittedAt: Date | string | null | undefined;
  points: number | null | undefined;
  approval: string | null | undefined;
  reviewedAt: Date | string | null | undefined;
  reviewedByName: string | null | undefined;
  canReview: boolean;
  audioItems: DashboardRequestMediaItem[];
};

function getAssignmentRemarks(
  assignments: NonNullable<AdminManagerStatusSelectProps["request"]["assignments"]>,
  mediaItems: DashboardRequestMediaItem[],
) {
  const availableAudioItems = mediaItems.filter((item) => item.type === "audio");

  return assignments
    .filter((assignment) => assignment.statusSubmittedAt && assignment.statusReason?.trim())
    .sort((a, b) => getDateTime(b.statusSubmittedAt) - getDateTime(a.statusSubmittedAt))
    .map((assignment) => ({
      id: assignment.id ?? assignment.employeeId,
      employeeName: assignment.employee?.name ?? "Employee",
      status: normalizeStatus(assignment.status),
      remark: assignment.statusReason?.trim() ?? "",
      submittedAt: assignment.statusSubmittedAt,
      points: assignment.statusPointsDelta,
      approval: assignment.statusPointsApproval ?? (typeof assignment.statusPointsDelta === "number" ? "approved" : "pending"),
      reviewedAt: assignment.statusPointsReviewedAt,
      reviewedByName: assignment.statusPointsReviewedByName,
      canReview: Boolean(assignment.id),
      audioItems: getRemarkAudioItems(availableAudioItems, assignment.employeeId, assignment.statusSubmittedAt),
    }));
}

function getRequestFallbackRemarks(request: AdminManagerStatusSelectProps["request"]): AssignmentRemark[] {
  if (!request.statusReason?.trim()) {
    return [];
  }

  return [
    {
      id: `request-${request.id}`,
      employeeName: request.lastAttemptByName ?? "Recent update",
      status: normalizeStatus(request.status),
      remark: request.statusReason.trim(),
      submittedAt: request.statusSubmittedAt,
      points: request.statusPointsDelta,
      approval: "legacy",
      reviewedAt: null,
      reviewedByName: null,
      canReview: false,
      audioItems: [],
    },
  ];
}

function getRemarkAudioItems(
  audioItems: DashboardRequestMediaItem[],
  employeeId: string,
  submittedAt: Date | string | null | undefined,
) {
  const submittedTime = getDateTime(submittedAt);
  const gracePeriodMs = 5 * 60 * 1000;

  return audioItems
    .filter((item) => item.uploadedById === employeeId)
    .filter((item) => {
      if (submittedTime === 0) {
        return true;
      }

      const uploadedTime = getDateTime(item.uploadedAt);
      return uploadedTime === 0 || uploadedTime <= submittedTime + gracePeriodMs;
    })
    .sort((a, b) => getDateTime(b.uploadedAt) - getDateTime(a.uploadedAt))
    .slice(0, 3);
}

function AssignmentRemarksPopup({ remarks }: { remarks: AssignmentRemark[] }) {
  const [open, setOpen] = React.useState(false);
  const [reviewingRemarkId, setReviewingRemarkId] = React.useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setReviewingRemarkId(null);
          setOpen(true);
        }}
        className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 underline decoration-blue-300 underline-offset-2 transition hover:text-blue-800"
      >
        <RemarkIcon />
        View remark
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-blue-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-blue-950">Individual Remarks</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-red-200 bg-red-50 p-1 text-red-700 transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-200"
                aria-label="Close"
                title="Close"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="space-y-3">
              {remarks.map((remark) => {
                const reviewIsLocked = remark.approval === "approved" || remark.approval === "not_approved";
                const reviewButtonsDisabled = reviewIsLocked || reviewingRemarkId === remark.id;

                return (
                <div key={remark.id} className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-blue-950">{remark.employeeName}</p>
                      {remark.submittedAt ? (
                        <p className="mt-1 text-[11px] font-medium text-blue-600">{formatRemarkDateTime(remark.submittedAt)}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${getStatusPillClass(remark.status)}`}>
                        {remark.status}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${getApprovalPillClass(remark.approval)}`}>
                        {getApprovalLabel(remark.approval)}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-blue-900">
                    {remark.remark}
                  </p>
                  {remark.audioItems.length > 0 ? (
                    <div className="mt-3 space-y-2 rounded-lg border border-blue-100 bg-white/80 p-2.5">
                      {remark.audioItems.map((item) => (
                        <div key={item.url} className="space-y-1">
                          <p className="truncate text-[10px] font-semibold text-blue-600">{item.fileName}</p>
                          <audio src={item.url} className="w-full" controls preload="metadata" />
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-blue-100 pt-3">
                    <p className="text-[11px] font-semibold text-blue-700">
                      {remark.approval === "approved"
                        ? `Points: ${formatPointDelta(remark.points)}`
                        : remark.approval === "not_approved"
                          ? "Points: 0"
                          : "Points pending"}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {remark.canReview ? (
                        <>
                          <form action={updateAssignmentStatusPointApproval} onSubmit={() => setReviewingRemarkId(remark.id)}>
                            <input type="hidden" name="assignmentId" value={remark.id} />
                            <input type="hidden" name="approval" value="approved" />
                            <button
                              type="submit"
                              disabled={reviewButtonsDisabled}
                              className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold uppercase text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-emerald-600"
                            >
                              Approved
                            </button>
                          </form>
                          <form action={updateAssignmentStatusPointApproval} onSubmit={() => setReviewingRemarkId(remark.id)}>
                            <input type="hidden" name="assignmentId" value={remark.id} />
                            <input type="hidden" name="approval" value="not_approved" />
                            <button
                              type="submit"
                              disabled={reviewButtonsDisabled}
                              className="inline-flex items-center justify-center rounded-lg bg-red-600 px-2.5 py-1.5 text-[11px] font-bold uppercase text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-red-600"
                            >
                              Not Approved
                            </button>
                          </form>
                        </>
                      ) : (
                        <span className="rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-blue-700">Assignment history unavailable</span>
                      )}
                    </div>
                  </div>
                  {remark.reviewedByName || remark.reviewedAt ? (
                    <p className="mt-2 text-[10px] font-medium text-blue-500">
                      Reviewed {remark.reviewedByName ? `by ${remark.reviewedByName}` : ""}
                      {remark.reviewedAt ? ` on ${formatRemarkDateTime(remark.reviewedAt)}` : ""}
                    </p>
                  ) : null}
                </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function getApprovalLabel(value: string | null | undefined) {
  if (value === "approved") {
    return "Approved";
  }

  if (value === "not_approved") {
    return "Not Approved";
  }

  return "Pending";
}

function getApprovalPillClass(value: string | null | undefined) {
  if (value === "approved") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (value === "not_approved") {
    return "bg-rose-100 text-rose-700";
  }

  return "bg-amber-100 text-amber-700";
}

function getDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return 0;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatRemarkDateTime(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function RemarkIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 shrink-0" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm9 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM6.92 6.085c.081-.16.19-.299.34-.398.145-.097.371-.187.74-.187.28 0 .506.069.668.19a.598.598 0 0 1 .272.505c0 .233-.088.4-.263.55-.165.14-.414.26-.737.38C7.48 7.26 7 7.5 7 8.5h1.5c0-.42.2-.6.63-.77.44-.173.87-.41 1.18-.71.314-.303.49-.72.49-1.27 0-.69-.27-1.24-.76-1.6C9.55 3.83 8.94 3.5 8 3.5c-.64 0-1.22.17-1.68.48-.46.31-.78.77-.92 1.34l1.52.765Z"
        clipRule="evenodd"
      />
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
