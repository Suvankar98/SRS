"use client";

import { useState } from "react";
import { normalizeStatus } from "../status-utils";

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

export function ReportCallDetailsModal({ request }: CallDetailsModalProps) {
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
        {request.name}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-slate-950/45 p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-7xl rounded-3xl border border-blue-200 bg-white p-6 shadow-[0_28px_90px_rgba(15,23,42,0.18)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-3 border-b border-blue-100 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Service Request Details</p>
                <h2 className="mt-1 text-2xl font-semibold text-blue-950">{request.docketNumber}</h2>
                <p className="mt-1 text-sm text-blue-700">
                  Last attended by: <span className="font-semibold">{lastAttendedBy || "Not attended yet"}</span>
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-blue-200 text-blue-700 transition hover:bg-blue-50"
                aria-label="Close service request details"
                title="Close"
              >
                x
              </button>
            </div>

            <div className="pt-2">
              <h3 className="mb-4 text-sm font-semibold text-blue-900">Activity Timeline</h3>
              <div className="space-y-3">
                {timelineEvents.map((event, index) => (
                  <div
                    key={`${event.type}-${index}-${String(event.timestamp)}`}
                    className={`rounded-xl border-l-4 p-4 ${getColorClass(event.color)}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/70 text-[10px] font-bold">
                        {getIconForType(event.type)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{event.label}</p>
                          <p className="text-xs font-medium opacity-75">{formatTimelineDate(event.timestamp)}</p>
                        </div>
                        <p className="mt-1 break-words text-sm opacity-85">{event.details}</p>
                        {event.meta ? <p className="mt-1 break-words text-xs font-medium opacity-75">{event.meta}</p> : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end border-t border-blue-100 pt-4">
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

function getColorClass(color: string) {
  const colors: Record<string, string> = {
    blue: "bg-blue-100 text-blue-700 border-blue-300",
    green: "bg-green-100 text-green-700 border-green-300",
    amber: "bg-amber-100 text-amber-700 border-amber-300",
    purple: "bg-purple-100 text-purple-700 border-purple-300",
    slate: "bg-slate-100 text-slate-700 border-slate-300",
  };

  return colors[color] || colors.blue;
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
  };

  return icons[type] || "EV";
}
