"use client";

import { useState, type ReactNode } from "react";

import { formatDocketNumber } from "@/lib/docket";

type Activity = {
  id: string;
  type: string;
  title: string;
  details: string | null;
  status: string | null;
  statusReason: string | null;
  actorName: string | null;
  actorRole: string | null;
  employeeName: string | null;
  createdAt: Date | string;
};

type CallDetailsModalProps = {
  request: {
    id: string;
    docketNumber: string;
    name: string;
    company: string;
    contactPerson2: string | null;
    phoneNumber1: string;
    phoneNumber2: string | null;
    fullAddress: string;
    complaintDetails: string | null;
    product: string;
    status: string | null;
    statusReason: string | null;
    assignedToId: string | null;
    createdAt: Date | string;
    assignedAt: Date | string | null;
    statusSubmittedAt: Date | string | null;
    closedAt: Date | string | null;
    closedByName: string | null;
    deletedAt?: Date | string | null;
    deletedByName?: string | null;
    deletedByRole?: string | null;
    callType: string;
    area: string;
    serviceBillingType: string | null;
    chargeableAmount: number | null;
    customerReview: string | null;
    assignedTo: {
      name: string;
    } | null;
    activities?: Activity[];
    relatedRequests?: TimelineRequest[];
  } | null;
  triggerContent?: ReactNode;
};

type TimelineRequest = NonNullable<CallDetailsModalProps["request"]>;
type RelatedTimelineRequest = Omit<TimelineRequest, "relatedRequests">;

type TimelineEvent = {
  type: string;
  label: string;
  timestamp: Date | string;
  details: string;
  meta?: string;
  color: string;
  isEmployeeComment?: boolean;
  commentText?: string;
};

export function ReportCallDetailsModal({ request, triggerContent }: CallDetailsModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  if (!request) return null;

  const relatedRequests = getRelatedTimelineRequests(request);
  const selectedRequest = selectedRequestId ? relatedRequests.find((relatedRequest) => relatedRequest.id === selectedRequestId) ?? null : null;
  const timelineEvents = selectedRequest ? getTimelineEvents(selectedRequest) : [];
  const lastAttendedBy = getLastAttendedBy(selectedRequest ?? request);
  const displayDocketNumber = formatDocketNumber((selectedRequest ?? request).docketNumber);

  return (
    <>
      <button
        onClick={() => {
          setSelectedRequestId(null);
          setIsOpen(true);
        }}
        className="cursor-pointer text-blue-600 font-medium hover:text-blue-800 hover:underline transition"
      >
        {triggerContent ?? request.name}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-slate-950/45 p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.18)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-blue-100 bg-white px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-600">Service Request Details</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <h2 className="min-w-0 break-words text-2xl font-semibold leading-tight text-blue-950">{request.company}</h2>
                    <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">
                      {displayDocketNumber}
                    </span>
                    <ReportPrintPdfLink requestId={(selectedRequest ?? request).id} docketNumber={displayDocketNumber} />
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-600">{request.name}</p>
                <p className="mt-1 text-sm text-blue-700">
                  Last attended by: <span className="font-semibold">{lastAttendedBy || "Not attended yet"}</span>
                </p>
                {request.deletedAt ? (
                  <p className="mt-1 text-sm text-rose-700">
                    Deleted by: <span className="font-semibold">{request.deletedByName || "Unknown"}</span>
                    {request.deletedByRole ? <span> ({request.deletedByRole})</span> : null}
                  </p>
                ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <a
                    href={`/api/service-request/${encodeURIComponent((selectedRequest ?? request).id)}/pdf`}
                    download
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                    title="Download PDF"
                  >
                    <PdfIcon />
                    PDF
                  </a>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                    aria-label="Close service request details"
                    title="Close"
                  >
                    x
                  </button>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
              <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-blue-950">Docket Numbers</h3>
                    <p className="mt-1 text-xs text-slate-500">{relatedRequests.length} docket{relatedRequests.length === 1 ? "" : "s"} for this company</p>
                  </div>
                  {selectedRequest ? (
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">
                      Selected {formatDocketNumber(selectedRequest.docketNumber)}
                    </span>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {relatedRequests.map((relatedRequest) => {
                    const isSelected = selectedRequest?.id === relatedRequest.id;
                    const relatedDocketNumber = formatDocketNumber(relatedRequest.docketNumber);

                    return (
                      <div
                        key={relatedRequest.id}
                        className={`inline-flex overflow-hidden rounded-full border text-xs font-semibold transition ${
                          isSelected
                            ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                            : "border-blue-200 bg-white text-blue-700 hover:border-blue-400"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedRequestId(relatedRequest.id)}
                          className={`inline-flex items-center gap-2 px-3 py-1.5 transition ${isSelected ? "hover:bg-blue-700" : "hover:bg-blue-50"}`}
                        >
                          {relatedDocketNumber}
                          <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${isSelected ? "bg-white/20 text-white" : "bg-blue-50 text-blue-600"}`}>
                            {relatedRequest.status || "New Call"}
                          </span>
                        </button>
                        <DocketChipPrintPdfLink requestId={relatedRequest.id} docketNumber={relatedDocketNumber} isSelected={isSelected} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedRequest ? (
                <>
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-blue-950">Activity Timeline</h3>
                      <p className="mt-1 text-xs text-slate-500">{timelineEvents.length} recorded events for {formatDocketNumber(selectedRequest.docketNumber)}</p>
                    </div>
                    <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                      Full process
                    </span>
                  </div>

                  <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-4 before:top-2 before:w-px before:bg-blue-100 sm:before:left-5">
                    {timelineEvents.map((event, index) => (
                      <li
                        key={`${event.type}-${index}-${String(event.timestamp)}`}
                        className="relative grid gap-3 pl-11 sm:grid-cols-[minmax(0,1fr)_10rem] sm:pl-14"
                      >
                        <span className={`absolute left-0 top-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold ring-4 ring-white sm:h-10 sm:w-10 ${getTimelineDotClass(event.color)}`}>
                            {getIconForType(event.type)}
                        </span>
                        <div className={`rounded-xl border bg-white p-4 shadow-sm ${getTimelineAccentClass(event.color)}`}>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-950">{event.label}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${getTimelineBadgeClass(event.color)}`}>
                              {event.type}
                            </span>
                          </div>
                          <TimelineDetails event={event} />
                          {event.meta ? <p className="mt-2 break-words text-xs font-medium leading-5 text-slate-500">{event.meta}</p> : null}
                        </div>
                        <time className="text-xs font-medium text-slate-500 sm:pt-4 sm:text-right">
                          {formatTimelineDate(event.timestamp)}
                        </time>
                      </li>
                    ))}
                  </ol>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-blue-200 bg-white px-4 py-10 text-center">
                  <p className="text-sm font-semibold text-blue-950">Select a docket number to view its activity timeline.</p>
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-blue-100 bg-white px-4 py-4 sm:px-6">
              <button
                onClick={() => setIsOpen(false)}
                className="inline-flex items-center justify-center rounded-xl border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TimelineDetails({ event }: { event: TimelineEvent }) {
  if (!event.isEmployeeComment || !event.commentText) {
    return <p className="mt-2 break-words text-sm leading-6 text-slate-700">{event.details}</p>;
  }

  const commentIndex = event.details.indexOf(event.commentText);

  if (commentIndex < 0) {
    return (
      <p className="mt-2 break-words text-sm leading-6 text-slate-700">
        {event.details}{" "}
        <span className="font-medium text-rose-700">{event.commentText}</span>
      </p>
    );
  }

  return (
    <p className="mt-2 break-words text-sm leading-6 text-slate-700">
      {event.details.slice(0, commentIndex)}
      <span className="font-medium text-rose-700">{event.commentText}</span>
      {event.details.slice(commentIndex + event.commentText.length)}
    </p>
  );
}

function getRelatedTimelineRequests(request: TimelineRequest): RelatedTimelineRequest[] {
  const relatedRequests = request.relatedRequests ?? [];
  const byId = new Map<string, RelatedTimelineRequest>();

  for (const relatedRequest of [request, ...relatedRequests]) {
    const { relatedRequests: _relatedRequests, ...timelineRequest } = relatedRequest;
    byId.set(timelineRequest.id, timelineRequest);
  }

  return Array.from(byId.values()).sort((a, b) => getRequestTime(b) - getRequestTime(a));
}

function getRequestTime(request: RelatedTimelineRequest) {
  const assignedAt = request.assignedAt ? new Date(request.assignedAt).getTime() : 0;
  const createdAt = new Date(request.createdAt).getTime();
  return Number.isNaN(assignedAt) || assignedAt === 0 ? (Number.isNaN(createdAt) ? 0 : createdAt) : assignedAt;
}
function getTimelineEvents(request: TimelineRequest): TimelineEvent[] {
  const activityEvents =
    request.activities?.map((activity) => {
      const commentText = getEmployeeCommentText(activity);

      return {
        type: activity.type,
        label: activity.title,
        timestamp: activity.createdAt,
        details: activity.details || getActivityDetails(activity),
        meta: [
          activity.employeeName ? `Employee: ${activity.employeeName}` : null,
          activity.actorName ? `By: ${activity.actorName}${activity.actorRole ? ` (${activity.actorRole})` : ""}` : null,
          activity.status ? `Status: ${activity.status}` : null,
        ]
          .filter(Boolean)
          .join(" | "),
        color: getActivityColor(activity.type),
        isEmployeeComment: Boolean(commentText),
        commentText,
      };
    }) ?? [];

  if (activityEvents.length > 0) {
    return activityEvents;
  }

  const fallbackEvents: TimelineEvent[] = [
    {
      type: "created",
      label: "Service Request Created",
      timestamp: request.createdAt,
      details: `Created docket ${formatDocketNumber(request.docketNumber)}`,
      color: "blue",
    },
  ];

  if (request.assignedAt) {
    fallbackEvents.push({
      type: "assigned",
      label: "Service Request Assigned",
      timestamp: request.assignedAt,
      details: `Assigned to ${request.assignedTo?.name || "Unassigned"}`,
      color: "green",
    });
  }

  if (request.statusSubmittedAt) {
    fallbackEvents.push({
      type: "status",
      label: "Status Updated",
      timestamp: request.statusSubmittedAt,
      details: `Status: ${request.status || "New Call"}${request.statusReason ? ` - ${request.statusReason}` : ""}`,
      meta: request.closedByName ? `Last attended by: ${request.closedByName}` : undefined,
      color: "amber",
    });
  }

  if (request.closedAt) {
    fallbackEvents.push({
      type: "closed",
      label: "Service Request Closed",
      timestamp: request.closedAt,
      details: `Closed by ${request.closedByName || "Unknown"}`,
      color: "purple",
    });
  }

  if (request.deletedAt) {
    fallbackEvents.push({
      type: "deleted",
      label: "Service Request Deleted",
      timestamp: request.deletedAt,
      details: `Deleted by ${request.deletedByName || "Unknown"}`,
      meta: request.deletedByRole ? `Role: ${request.deletedByRole}` : undefined,
      color: "rose",
    });
  }

  return fallbackEvents;
}

function getEmployeeCommentText(activity: Activity) {
  const hasEmployeeActor = activity.actorRole?.toLowerCase() === "employee" || Boolean(activity.employeeName?.trim());

  if (!hasEmployeeActor || !isStatusCommentActivity(activity)) {
    return "";
  }

  const statusReason = activity.statusReason?.trim();

  if (statusReason) {
    return statusReason;
  }

  const details = activity.details?.trim() ?? "";
  const colonIndex = details.lastIndexOf(":");

  if (colonIndex < 0) {
    return "";
  }

  return details.slice(colonIndex + 1).trim();
}

function isStatusCommentActivity(activity: Activity) {
  const type = activity.type.toLowerCase();
  const title = activity.title.toLowerCase();

  return (
    type === "status" ||
    type === "completed" ||
    type === "closed" ||
    type === "cancel" ||
    type === "cancelled" ||
    title.includes("completed") ||
    title.includes("status")
  );
}
function isEmployeeWrittenComment(activity: Activity) {
  return Boolean(
    activity.statusReason?.trim() &&
      (activity.actorRole?.toLowerCase() === "employee" || activity.employeeName?.trim()),
  );
}
function getActivityDetails(activity: Activity) {
  if (activity.statusReason) {
    return `${activity.status || "Status"}: ${activity.statusReason}`;
  }

  if (activity.employeeName) {
    return `Employee: ${activity.employeeName}`;
  }

  return activity.status ? `Status: ${activity.status}` : "Activity recorded";
}

function getActivityColor(type: string) {
  if (type === "created") return "blue";
  if (type === "assigned") return "green";
  if (type === "completed" || type === "closed") return "purple";
  if (type === "deleted") return "rose";
  if (type === "priority-starred" || type === "priority-unstarred") return "green";
  if (type === "status" || type === "manager-status") return "amber";
  return "slate";
}

function getLastAttendedBy(request: TimelineRequest) {
  const attendedActivity = [...(request.activities ?? [])]
    .reverse()
    .find((activity) => activity.employeeName || activity.type === "status" || activity.type === "completed");

  return attendedActivity?.employeeName || request.closedByName;
}

function formatTimelineDate(date: Date | string) {
  const dateObj = new Date(date);
  return dateObj.toLocaleString("en-IN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
}

function getIconForType(type: string) {
  const icons: Record<string, string> = {
    created: "CR",
    assigned: "AS",
    unassigned: "RM",
    status: "ST",
    "manager-status": "AM",
    completed: "CL",
    closed: "CL",
    deleted: "DL",
    "priority-starred": "PS",
    "priority-unstarred": "PU",
  };

  return icons[type] || "EV";
}

function getTimelineDotClass(color: string) {
  const colors: Record<string, string> = {
    blue: "bg-blue-100 text-blue-700",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    purple: "bg-violet-100 text-violet-700",
    rose: "bg-rose-100 text-rose-700",
    slate: "bg-slate-100 text-slate-700",
  };

  return colors[color] || colors.blue;
}

function getTimelineAccentClass(color: string) {
  const colors: Record<string, string> = {
    blue: "border-blue-100",
    green: "border-emerald-100",
    amber: "border-amber-100",
    purple: "border-violet-100",
    rose: "border-rose-100",
    slate: "border-slate-200",
  };

  return colors[color] || colors.blue;
}

function getTimelineBadgeClass(color: string) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    purple: "bg-violet-50 text-violet-700",
    rose: "bg-rose-50 text-rose-700",
    slate: "bg-slate-50 text-slate-700",
  };

  return colors[color] || colors.blue;
}

function DocketChipPrintPdfLink({ requestId, docketNumber, isSelected }: { requestId: string; docketNumber: string; isSelected: boolean }) {
  return (
    <a
      href={`/api/service-request/${encodeURIComponent(requestId)}/pdf?disposition=inline`}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => event.stopPropagation()}
      className={`inline-flex w-8 shrink-0 items-center justify-center border-l transition focus:outline-none focus:ring-2 focus:ring-blue-200 ${
        isSelected
          ? "border-white/25 text-white hover:bg-white/15"
          : "border-blue-100 text-blue-700 hover:bg-blue-50"
      }`}
      aria-label={`Open printable service report PDF for ${docketNumber}`}
      title={`Print ${docketNumber}`}
    >
      <PrintIcon />
      <span className="sr-only">Print {docketNumber}</span>
    </a>
  );
}
function ReportPrintPdfLink({ requestId, docketNumber }: { requestId: string; docketNumber: string }) {
  return (
    <a
      href={`/api/service-request/${encodeURIComponent(requestId)}/pdf?disposition=inline`}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => event.stopPropagation()}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-700 shadow-sm transition hover:border-blue-400 hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
      aria-label={`Open printable service report PDF for ${docketNumber}`}
      title="Open printable PDF"
    >
      <PrintIcon />
      <span className="sr-only">Print {docketNumber}</span>
    </a>
  );
}

function PrintIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M5.5 7V3.8H14.5V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 14.2H4.2A1.7 1.7 0 0 1 2.5 12.5V9A2 2 0 0 1 4.5 7H15.5A2 2 0 0 1 17.5 9V12.5A1.7 1.7 0 0 1 15.8 14.2H14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 11.5H13.5V16.5H6.5V11.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M14.5 9.8H14.55" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function PdfIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 3h7l4 4v14H7V3ZM14 3v5h4M9.5 13h5M9.5 16h3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}










