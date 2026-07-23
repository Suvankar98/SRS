"use client";

import React from "react";

import { updateManagerServiceStatus } from "../actions";
import { RemarkPopup } from "../remark-popup";
import { getStatusLabel, getStatusPillClass, normalizeStatus } from "../status-utils";

const STATUS_OPTIONS = ["New Call", "In Process", "Completed", "Cancel"] as const;

type AdminManagerStatusSelectProps = {
  request: {
    id: string;
    status: string | null;
    statusReason: string | null;
    assignments?: Array<{
      id?: string;
      employeeId: string;
      status?: string | null;
      statusReason?: string | null;
      statusSubmittedAt?: Date | string | null;
      employee?: { name: string } | null;
    }>;
  };
};

export function AdminManagerStatusSelect({ request }: AdminManagerStatusSelectProps) {
  const status = getStatusLabel(request.status);
  const assignmentRemarks = getAssignmentRemarks(request.assignments ?? []);

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
      {assignmentRemarks.length > 0 ? (
        <AssignmentRemarksPopup remarks={assignmentRemarks} />
      ) : request.statusReason ? (
        <div className="mt-1">
          <RemarkPopup remark={request.statusReason} />
        </div>
      ) : null}
    </div>
  );
}

type AssignmentRemark = {
  id: string;
  employeeName: string;
  status: ReturnType<typeof normalizeStatus>;
  remark: string;
  submittedAt: Date | string | null | undefined;
};

function getAssignmentRemarks(assignments: NonNullable<AdminManagerStatusSelectProps["request"]["assignments"]>) {
  return assignments
    .filter((assignment) => assignment.statusSubmittedAt && assignment.statusReason?.trim())
    .sort((a, b) => getDateTime(b.statusSubmittedAt) - getDateTime(a.statusSubmittedAt))
    .map((assignment) => ({
      id: assignment.id ?? assignment.employeeId,
      employeeName: assignment.employee?.name ?? "Employee",
      status: normalizeStatus(assignment.status),
      remark: assignment.statusReason?.trim() ?? "",
      submittedAt: assignment.statusSubmittedAt,
    }));
}

function AssignmentRemarksPopup({ remarks }: { remarks: AssignmentRemark[] }) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
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
              {remarks.map((remark) => (
                <div key={remark.id} className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold text-blue-950">{remark.employeeName}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${getStatusPillClass(remark.status)}`}>
                      {remark.status}
                    </span>
                  </div>
                  {remark.submittedAt ? (
                    <p className="mt-1 text-[11px] font-medium text-blue-600">{formatRemarkDateTime(remark.submittedAt)}</p>
                  ) : null}
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-blue-900">
                    {remark.remark}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
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
