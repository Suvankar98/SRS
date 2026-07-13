"use client";

import { useState, type ReactNode } from "react";

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
  } | null;
  triggerContent?: ReactNode;
};

type TimelineRequest = NonNullable<CallDetailsModalProps["request"]>;

type TimelineEvent = {
  type: string;
  label: string;
  timestamp: Date | string;
  details: string;
  meta?: string;
  color: string;
};

export function ReportCallDetailsModal({ request, triggerContent }: CallDetailsModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!request) return null;

  const timelineEvents = getTimelineEvents(request);
  const lastAttendedBy = getLastAttendedBy(request);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
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
                      {request.docketNumber}
                    </span>
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
                    href={`/api/service-request/${encodeURIComponent(request.id)}/pdf`}
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
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-blue-950">Activity Timeline</h3>
                  <p className="mt-1 text-xs text-slate-500">{timelineEvents.length} recorded events</p>
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
                      <p className="mt-2 break-words text-sm leading-6 text-slate-700">{event.details}</p>
                      {event.meta ? <p className="mt-2 break-words text-xs font-medium leading-5 text-slate-500">{event.meta}</p> : null}
                    </div>
                    <time className="text-xs font-medium text-slate-500 sm:pt-4 sm:text-right">
                      {formatTimelineDate(event.timestamp)}
                    </time>
                  </li>
                ))}
              </ol>
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

function getTimelineEvents(request: TimelineRequest): TimelineEvent[] {
  const activityEvents =
    request.activities?.map((activity) => ({
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
    })) ?? [];

  if (activityEvents.length > 0) {
    return activityEvents;
  }

  const fallbackEvents: TimelineEvent[] = [
    {
      type: "created",
      label: "Service Request Created",
      timestamp: request.createdAt,
      details: `Created docket ${request.docketNumber}`,
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
