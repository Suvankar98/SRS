"use client";

import React from "react";
import { DocketDetailsModal } from "../docket-details-modal";
import { StatusUpdateModal } from "../status-update-modal";
import { AdminManagerStatusSelect } from "./admin-manager-status-select";
import { AssignmentPicker, type AssignmentPickerAssignment } from "./assignment-picker";
import {
  formatServiceBillingType,
  formatINRCurrency,
  normalizeStatus,
} from "../status-utils";
import type { DashboardRequestMediaItem } from "@/lib/gallery";

const COMPLETED_REASSIGN_WINDOW_MS = 72 * 60 * 60 * 1000;

type DashboardRequestRowRequest = {
  id: string;
  docketNumber: string;
  createdAt: Date | string;
  name: string;
  company: string;
  contactPerson2: string | null;
  phoneNumber1: string;
  phoneNumber2: string | null;
  fullAddress: string;
  installationDate?: Date | string | null;
  complaintDetails: string | null;
  area: string;
  product: string;
  callType: string;
  serviceBillingType: string | null;
  chargeableAmount: number | null;
  dashboardOrder: number | null;
  assignedToId: string | null;
  assignedAt?: Date | string | null;
  status: string | null;
  statusSubmittedAt?: Date | string | null;
  statusReason: string | null;
  closedAt: Date | string | null;
  closedByName: string | null;
  lastAttemptByName?: string | null;
  lastAttemptAt?: Date | string | null;
  assignedTo?: { name: string } | null;
  assignments?: AssignmentPickerAssignment[];
  activities?: DashboardServiceActivity[];
  createdBy?: { name: string } | null;
  mediaItems?: DashboardRequestMediaItem[];
};

type DashboardServiceActivity = {
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

type DashboardRequestRowProps = {
  request: DashboardRequestRowRequest;
  products: Array<{ id: string; name: string }>;
  employees: Array<{ id: string; name: string }>;
  canEditDocket: boolean;
  canAssign: boolean;
  isEmployee: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onToggleStar?: (id: string) => void;
  isStarred?: boolean;
};

export function DashboardRequestRow({
  request,
  products,
  employees,
  canEditDocket,
  canAssign,
  isEmployee,
  // drag handlers
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onToggleStar,
  isStarred = false,
}: DashboardRequestRowProps & {
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLTableRowElement>, id: string) => void;
  onDragOver?: (e: React.DragEvent<HTMLTableRowElement>, id: string) => void;
  onDrop?: (e: React.DragEvent<HTMLTableRowElement>, id: string) => void;
  onDragEnd?: (e: React.DragEvent<HTMLTableRowElement>, id: string) => void;
}) {
  const openModalRef = React.useRef<() => void>(() => {});
  const showReorderControls = Boolean(canEditDocket && !isEmployee && draggable);

  const getComplaintAgeLabel = (request: DashboardRequestRowRequest) => {
    const createdAt = typeof request.createdAt === "string" ? new Date(request.createdAt) : request.createdAt;
    const completedAt = getCompletedAt(request);
    const endDate = isClosedStatus(request.status) && completedAt ? completedAt : new Date();

    const endDay = getDayNumberInTimeZone(endDate, "Asia/Kolkata");
    const createdDay = getDayNumberInTimeZone(createdAt, "Asia/Kolkata");
    const days = Math.max(0, endDay - createdDay);

    if (days === 0) {
      return "Today";
    }

    if (days === 1) {
      return "1 day";
    }

    return `${days} days`;
  };

  const getClosedByName = (request: { closedByName: string | null }) => {
    const value = request.closedByName;
    return typeof value === "string" && value.trim() !== "" ? value : "Unknown";
  };

  const isClosedStatus = (status: string | null) => {
    return (status || "New Call") === "Completed";
  };

  const getClosedAt = (request: { createdAt: Date | string; status: string | null; closedAt?: Date | string | null } & Record<string, unknown>) => {
    const value = request.closedAt;

    if (value instanceof Date) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    return null;
  };

  const getAssignedAt = (request: { assignedAt?: Date | string | null }) => {
    const value = request.assignedAt;
    if (value instanceof Date) return value;
    if (typeof value === "string") {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return null;
  };

  const getDurationLabel = (milliseconds: number) => {
    const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
      return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
    }

    return `${minutes} min`;
  };

  const getAssignmentCountdown = (assignedAt: Date, now: Date) => {
    const assignedDay = new Date(assignedAt);
    const dayStart = new Date(assignedDay.getFullYear(), assignedDay.getMonth(), assignedDay.getDate());
    const deadline9 = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), 21, 0, 0);
    const deadline24 = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), 24, 0, 0);

    if (now < deadline9) {
      return `Due in ${getDurationLabel(deadline9.getTime() - now.getTime())}`;
    }

    if (now < deadline24) {
      return `Due in ${getDurationLabel(deadline24.getTime() - now.getTime())}`;
    }

    return `Overdue by ${getDurationLabel(now.getTime() - deadline24.getTime())}`;
  };

  const [now, setNow] = React.useState<Date | null>(null);
  const assignedAtValue = request.assignedAt;
  const requestStatus = request.status;

  React.useEffect(() => {
    const assignedAt = getAssignedAt({ assignedAt: assignedAtValue });
    if (!assignedAt || isClosedStatus(requestStatus)) {
      return;
    }

    const initialTick = window.setTimeout(() => setNow(new Date()), 0);
    const interval = window.setInterval(() => setNow(new Date()), 30000);
    return () => {
      window.clearTimeout(initialTick);
      window.clearInterval(interval);
    };
  }, [assignedAtValue, requestStatus]);

  const renderAssignmentBadge = (request: DashboardRequestRowRequest) => {
    const assignedAt = getAssignedAt(request);
    if (!assignedAt) return null;

    const assignedDay = new Date(assignedAt);
    const dayStart = new Date(assignedDay.getFullYear(), assignedDay.getMonth(), assignedDay.getDate());
    const deadline9 = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), 21, 0, 0);
    const deadline24 = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), 24, 0, 0);

    const completedAt = getClosedAt(request);
    if (request.status === "Completed" && completedAt) {
      const completedOnTime = completedAt <= deadline24;

      return (
        <div
          className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset ${
            completedOnTime
              ? "bg-emerald-50 text-emerald-900 ring-emerald-300"
              : "bg-rose-50 text-rose-900 ring-rose-300"
          }`}
        >
          {completedOnTime ? "Completed on time" : "Completed late"}
        </div>
      );
    }

    // Avoid hydration mismatches: render a stable label until the client clock is available.
    if (!now) {
      return (
        <div className="inline-flex rounded-md bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-900 ring-1 ring-inset ring-blue-300">
          Assigned
        </div>
      );
    }

    let colorClass = "bg-emerald-50 text-emerald-900 ring-emerald-300";
    if (now >= deadline9 && now < deadline24) {
      colorClass = "bg-amber-50 text-amber-900 ring-amber-300";
    }
    if (now >= deadline24) {
      colorClass = "bg-rose-50 text-rose-900 ring-rose-300";
    }

    // If completed, evaluate thumbs
    const closedAt = getClosedAt(request);
    if (request.status === "Completed" && closedAt) {
      if (closedAt <= deadline9 || (closedAt <= deadline24 && closedAt > deadline9)) {
        return (
          <div className={`inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset ${colorClass}`}>
            <span>Congratulations</span>
            <span aria-hidden>👍</span>
          </div>
        );
      }
      return (
        <div className={`inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset ${colorClass}`}>
          <span>Too late</span>
          <span aria-hidden>👎</span>
        </div>
      );
    }

    return (
      <div className={`inline-flex rounded-md px-2.5 py-1.5 text-xs font-semibold ring-1 ring-inset ${colorClass}`}>
        {getAssignmentCountdown(assignedAt, now)}
      </div>
    );
  };

  const getDayNumberInTimeZone = (value: Date, timeZone: string) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(value);

    const year = Number(parts.find((part) => part.type === "year")?.value);
    const month = Number(parts.find((part) => part.type === "month")?.value);
    const day = Number(parts.find((part) => part.type === "day")?.value);

    return Math.floor(Date.UTC(year, month - 1, day) / (1000 * 60 * 60 * 24));
  };

  const getSubmittedAssignmentAttempts = () =>
    request.assignments
      ?.filter((assignment) => assignment.statusSubmittedAt)
      .sort((a, b) => getDateTime(b.statusSubmittedAt) - getDateTime(a.statusSubmittedAt)) ?? [];

  const renderLastAttemptBadge = () => {
    if (isEmployee) {
      return null;
    }

    const assignmentAttempts = getSubmittedAssignmentAttempts();

    if (assignmentAttempts.length === 0 && !request.lastAttemptByName?.trim()) {
      return (
        <span className="inline-flex rounded-md bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
          No attempt yet
        </span>
      );
    }

    if (assignmentAttempts.length > 0) {
      return (
        <span className="flex w-full min-w-0 max-w-full flex-col gap-1 rounded-md bg-slate-50 px-2 py-1.5 text-[10px] font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
          <span className="text-[9px] uppercase tracking-[0.12em] text-slate-500">Last attempts</span>
          {assignmentAttempts.map((assignment) => {
            const status = normalizeStatus(assignment.status);

            return (
              <span
                key={assignment.id ?? assignment.employeeId}
                className={`grid min-w-0 max-w-full grid-cols-[minmax(3.75rem,1fr)_auto_auto] items-center gap-1 overflow-hidden rounded px-1.5 py-1 ring-1 ring-inset ${getAttemptBadgeClass(status)}`}
              >
                <span className="min-w-0 truncate">{assignment.employee?.name ?? "Employee"}</span>
                <span className="shrink-0 whitespace-nowrap rounded-full bg-white/65 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.06em]">{status}</span>
                {assignment.statusSubmittedAt ? (
                  <span className="whitespace-nowrap text-right text-[9px] font-medium">{formatShortDateTime(assignment.statusSubmittedAt)}</span>
                ) : null}
              </span>
            );
          })}
        </span>
      );
    }

    return (
      <span className="inline-flex w-full min-w-0 max-w-full flex-col rounded-md bg-blue-50 px-2 py-1.5 text-[10px] font-semibold text-blue-900 ring-1 ring-inset ring-blue-200">
        <span className="text-[9px] uppercase tracking-[0.12em] text-blue-500">Last attempt</span>
        <span className="grid min-w-0 max-w-full grid-cols-[minmax(3.75rem,1fr)_auto_auto] items-center gap-1 overflow-hidden">
          <span className="min-w-0 truncate">{request.lastAttemptByName}</span>
          <span className="shrink-0 whitespace-nowrap rounded-full bg-white/70 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.06em] text-blue-700">
            {normalizeStatus(request.status)}
          </span>
          {request.lastAttemptAt ? (
            <span className="whitespace-nowrap text-right text-[9px] font-medium text-blue-600">{formatShortDateTime(request.lastAttemptAt)}</span>
          ) : null}
        </span>
      </span>
    );
  };
  const isCompletedRequest = isClosedStatus(request.status);
  const isReassignLocked = isCompletedRequest && !isCompletedReassignWindowOpen(request);

  return (
    <tr
      draggable={showReorderControls}
      onDragStart={(e) => {
        if (showReorderControls) {
          onDragStart?.(e, request.id);
        }
      }}
      onDragOver={(e) => {
        if (showReorderControls) {
          onDragOver?.(e, request.id);
        }
      }}
      onDrop={(e) => {
        if (showReorderControls) {
          onDrop?.(e, request.id);
        }
      }}
      onDragEnd={(e) => {
        if (showReorderControls) {
          onDragEnd?.(e, request.id);
        }
      }}
      onClick={() => {
        if (canEditDocket) {
          openModalRef.current();
        }
      }}
      tabIndex={canEditDocket ? 0 : -1}
      className={`align-top text-blue-900 ${!isEmployee && isClosedStatus(request.status) ? "bg-emerald-50/80" : ""} ${canEditDocket ? "cursor-pointer" : ""}`}
    >
      <td className="px-2 py-2.5 align-top whitespace-normal break-words text-xs font-semibold text-blue-950">
        <div className="flex items-start gap-2">
          {showReorderControls ? (
            <div className="mt-1 flex shrink-0 flex-col items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleStar?.(request.id);
                }}
                className={`flex h-7 w-7 items-center justify-center rounded-full border shadow-sm transition focus:outline-none focus:ring-2 focus:ring-amber-300 ${
                  isStarred
                    ? "border-amber-300 bg-amber-100 text-amber-600"
                    : "border-blue-100 bg-white text-slate-400 hover:border-amber-300 hover:text-amber-500"
                }`}
                title={isStarred ? "Move back" : "Move to top"}
                aria-label={isStarred ? `Move ${request.docketNumber} back` : `Move ${request.docketNumber} to top`}
                aria-pressed={isStarred}
              >
                <StarIcon filled={isStarred} />
              </button>
            </div>
          ) : null}

          <div className="min-w-0">
            <DocketDetailsModal
              request={request}
              canEdit={canEditDocket}
              canAssign={canAssign}
              employees={employees}
              products={products}
              onReady={(open) => {
                openModalRef.current = open;
              }}
              renderTrigger={(open) => (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    open();
                  }}
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-blue-300 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-blue-800 shadow-sm transition hover:border-blue-500 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  aria-label={`Open docket details for ${request.docketNumber}`}
                >
                  <span className="min-w-0 truncate">{request.docketNumber}</span>
                  <OpenDocketIcon />
                </button>
              )}
            />

            {isEmployee ? (
              <PreviousStatusButton request={request} />
            ) : (
              <div className="mt-2 flex flex-wrap items-center gap-2" />
            )}
          </div>
        </div>
      </td>
      <td className="px-2 py-2.5 align-top whitespace-normal break-words text-xs">
        <div className="flex flex-col gap-2">
          <span className="inline-flex max-w-full rounded-md bg-red-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.04em] text-red-800 ring-1 ring-inset ring-red-300">{getComplaintAgeLabel(request)}</span>
          {isEmployee && request.assignedToId ? renderAssignmentBadge(request) : renderLastAttemptBadge()}
        </div>
      </td>
      <td className="px-2 py-2.5 align-top whitespace-normal break-words text-xs">
        <p className={`break-words text-[13px] leading-snug text-blue-700 ${isEmployee ? "font-extrabold" : "font-semibold"}`}>{request.company}</p>
        <p className="mt-1.5 break-words text-[12px] font-bold leading-snug text-slate-950">{request.name}</p>
      </td>
      <td className="px-2 py-2.5 align-top whitespace-normal break-words text-xs">{request.area}</td>
      <td className="px-2 py-2.5 align-top whitespace-normal break-words text-xs">{request.product}</td>
      <td className="px-2 py-2.5 align-top whitespace-normal break-words text-xs">
        <p>{request.callType}</p>
        {request.callType === "Service" ? (
          <p className="mt-1 inline-block whitespace-nowrap text-[9px] font-semibold uppercase leading-3 tracking-normal text-blue-700">
            {request.serviceBillingType ? formatServiceBillingType(request.serviceBillingType) : "Not specified"}
          </p>
        ) : null}
      </td>
      <td className="px-2 py-2.5 align-top whitespace-normal break-words text-xs font-semibold text-blue-950">
        {formatINRCurrency(request.serviceBillingType === "chargeable" ? request.chargeableAmount ?? 0 : 0)}
      </td>
      <td className="px-2 py-2.5 align-top whitespace-normal break-words text-xs" onClick={(event) => event.stopPropagation()}>
        {isEmployee ? (
          <div className="whitespace-nowrap">
            <StatusUpdateModal request={request} />
          </div>
        ) : (
          <AdminManagerStatusSelect request={request} />
        )}
      </td>
      {canAssign ? (
        <td className="px-2 py-2.5 align-top whitespace-normal break-words text-xs" onClick={(event) => event.stopPropagation()}>
          <div className="space-y-2">
            {isClosedStatus(request.status) ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-2">
                <p className="text-xs font-semibold text-emerald-900">
                  <span className="text-[10px] uppercase tracking-[0.08em] text-emerald-700">Closed By:</span>{" "}
                  {getClosedByName(request)}
                </p>
              </div>
            ) : null}
            <AssignmentPicker
              key={`${request.id}:${request.assignments?.map((assignment) => assignment.employeeId).join(",") ?? request.assignedToId ?? ""}`}
              requestId={request.id}
              employees={employees}
              assignments={request.assignments}
              defaultEmployeeId={request.assignedToId}
              compact
              disabled={isReassignLocked}
              disabledMessage={isReassignLocked ? "This completed service can no longer be reassigned." : undefined}
            />
          </div>
        </td>
      ) : null}
    </tr>
  );
}

function PreviousStatusButton({ request }: { request: DashboardRequestRowRequest }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const entries = getPreviousStatusEntries(request);

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen(true);
        }}
        className="mt-2 inline-flex max-w-full items-center justify-center rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-200"
      >
        Previous status
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-blue-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-blue-200 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-blue-950">Previous Status</h3>
                <p className="mt-1 text-xs font-medium text-blue-600">{request.docketNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-200"
                aria-label="Close previous status"
                title="Close"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="space-y-2 p-5">
              {entries.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-sm font-medium text-slate-600">
                  No previous status found for this service.
                </p>
              ) : (
                entries.map((entry) => (
                  <article key={entry.id} className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs text-blue-900">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-blue-950">{entry.person}</p>
                        <p className="mt-0.5 text-[11px] font-medium text-blue-600">{entry.title}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${getPreviousStatusClass(entry.status)}`}>
                        {entry.status}
                      </span>
                    </div>
                    {entry.remark ? (
                      <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-white px-2.5 py-2 text-[11px] leading-5 text-slate-700 ring-1 ring-inset ring-blue-100">
                        {entry.remark}
                      </p>
                    ) : null}
                    <p className="mt-2 text-[10px] font-medium text-blue-500">{formatPreviousStatusDateTime(entry.createdAt)}</p>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

type PreviousStatusEntry = {
  id: string;
  title: string;
  person: string;
  status: ReturnType<typeof normalizeStatus>;
  remark: string;
  createdAt: Date | string;
};

function getPreviousStatusEntries(request: DashboardRequestRowRequest): PreviousStatusEntry[] {
  const activityEntries =
    request.activities
      ?.filter((activity) => Boolean(activity.status) || Boolean(activity.statusReason))
      .map((activity) => ({
        id: `activity-${activity.id}`,
        title: activity.title,
        person: activity.employeeName || activity.actorName || "Staff",
        status: normalizeStatus(activity.status),
        remark: getPreviousStatusRemark(activity.statusReason, activity.details),
        createdAt: activity.createdAt,
      })) ?? [];

  if (activityEntries.length > 0) {
    return activityEntries.slice(0, 8);
  }

  return (
    request.assignments
      ?.filter((assignment) => assignment.statusSubmittedAt)
      .sort((a, b) => getDateTime(b.statusSubmittedAt) - getDateTime(a.statusSubmittedAt))
      .map((assignment) => ({
        id: `assignment-${assignment.id ?? assignment.employeeId}`,
        title: "Status Updated",
        person: assignment.employee?.name || "Employee",
        status: normalizeStatus(assignment.status),
        remark: assignment.statusReason?.trim() ?? "",
        createdAt: assignment.statusSubmittedAt ?? assignment.closedAt ?? "",
      }))
      .slice(0, 8) ?? []
  );
}

function getPreviousStatusRemark(statusReason: string | null, details: string | null) {
  return statusReason?.trim() || details?.trim() || "";
}

function getPreviousStatusClass(status: ReturnType<typeof normalizeStatus>) {
  switch (status) {
    case "Completed":
      return "bg-emerald-100 text-emerald-800";
    case "In Process":
      return "bg-amber-100 text-amber-800";
    case "Cancel":
      return "bg-red-100 text-red-800";
    case "New Call":
    default:
      return "bg-blue-100 text-blue-800";
  }
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} aria-hidden="true">
      <path
        d="m12 3.8 2.35 4.76 5.25.76-3.8 3.7.9 5.23L12 15.78l-4.7 2.47.9-5.23-3.8-3.7 5.25-.76L12 3.8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function OpenDocketIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 5h11v11M19 5 6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function getDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return 0;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function getParsedDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getAttemptBadgeClass(status: ReturnType<typeof normalizeStatus>) {
  switch (status) {
    case "Completed":
      return "bg-emerald-50 text-emerald-900 ring-emerald-200";
    case "In Process":
      return "bg-amber-50 text-amber-900 ring-amber-200";
    case "Cancel":
      return "bg-red-50 text-red-900 ring-red-200";
    case "New Call":
    default:
      return "bg-blue-50 text-blue-900 ring-blue-200";
  }
}

function getCompletedAt(request: DashboardRequestRowRequest) {
  return (
    getParsedDate(request.closedAt) ??
    getParsedDate(request.statusSubmittedAt) ??
    getParsedDate(request.lastAttemptAt)
  );
}

function isCompletedReassignWindowOpen(request: DashboardRequestRowRequest) {
  const completedAt = getCompletedAt(request);

  if (!completedAt) {
    return false;
  }

  return Date.now() - completedAt.getTime() <= COMPLETED_REASSIGN_WINDOW_MS;
}

function formatShortDateTime(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatPreviousStatusDateTime(value: Date | string) {
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
