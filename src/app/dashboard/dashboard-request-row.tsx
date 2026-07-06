"use client";

import React from "react";
import { DocketDetailsModal } from "../docket-details-modal";
import { RemarkPopup } from "../remark-popup";
import { StatusUpdateModal } from "../status-update-modal";
import {
  formatServiceBillingType,
  formatINRCurrency,
  getStatusLabel,
  getStatusPillClass,
} from "../status-utils";

type DashboardRequestRowProps = {
  request: {
    id: string;
    docketNumber: string;
    createdAt: Date | string;
    name: string;
    company: string;
    phoneNumber1: string;
    phoneNumber2: string | null;
    fullAddress: string;
    complaintDetails: string | null;
    area: string;
    product: string;
    callType: string;
    serviceBillingType: string | null;
    chargeableAmount: number | null;
    assignedToId: string | null;
    assignedAt?: Date | string | null;
    status: string | null;
    statusReason: string | null;
    closedAt: Date | string | null;
    closedByName: string | null;
    assignedTo?: { name: string } | null;
    createdBy?: { name: string } | null;
  };
  products: Array<{ id: string; name: string }>;
  employees: Array<{ id: string; name: string }>;
  canEditDocket: boolean;
  canAssign: boolean;
  isEmployee: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
};

function StatusPill({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${className}`}>
      {label}
    </span>
  );
}

export function DashboardRequestRow({
  request,
  products,
  employees,
  canEditDocket,
  canAssign,
  isEmployee,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  // drag handlers
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: DashboardRequestRowProps & {
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLTableRowElement>, id: string) => void;
  onDragOver?: (e: React.DragEvent<HTMLTableRowElement>, id: string) => void;
  onDrop?: (e: React.DragEvent<HTMLTableRowElement>, id: string) => void;
  onDragEnd?: (e: React.DragEvent<HTMLTableRowElement>, id: string) => void;
}) {
  const openModalRef = React.useRef<() => void>(() => {});

  const getComplaintAgeLabel = (request: { createdAt: Date | string; status: string | null; closedAt?: Date | string | null }) => {
    const createdAt = typeof request.createdAt === "string" ? new Date(request.createdAt) : request.createdAt;
    const closedAt = getClosedAt(request as { createdAt: Date | string; status: string | null; closedAt?: Date | string | null } & Record<string, unknown>);
    const endDate = request.status === "Completed" && closedAt ? closedAt : new Date();

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
    const value = (request as any).assignedAt;
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
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getAssignmentCountdown = (assignedAt: Date) => {
    const now = new Date();
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

  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const assignedAt = getAssignedAt(request);
    if (!assignedAt || isClosedStatus(request.status)) {
      return;
    }

    const interval = window.setInterval(() => setTick((current) => current + 1), 30000);
    return () => window.clearInterval(interval);
  }, [request.assignedAt, request.status]);

  const renderAssignmentBadge = (request: any) => {
    const assignedAt = getAssignedAt(request);
    if (!assignedAt) return null;

    const now = new Date();
    const assignedDay = new Date(assignedAt);
    const dayStart = new Date(assignedDay.getFullYear(), assignedDay.getMonth(), assignedDay.getDate());
    const deadline9 = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), 21, 0, 0);
    const deadline24 = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), 24, 0, 0);

    let colorClass = "bg-emerald-50 text-emerald-900 ring-emerald-300";
    if (now >= deadline9 && now < deadline24) {
      colorClass = "bg-amber-50 text-amber-900 ring-amber-300";
    }
    if (now >= deadline24) {
      colorClass = "bg-rose-50 text-rose-900 ring-rose-300";
    }

    // If completed, evaluate thumbs
    const closedAt = getClosedAt(request as any);
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
      <div className={`inline-flex flex-col gap-1 rounded-md px-2 py-2 text-xs font-semibold ring-1 ring-inset ${colorClass}`}>
        <span>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(assignedAt)}</span>
        <span className="text-[10px] font-normal text-blue-700">{getAssignmentCountdown(assignedAt)}</span>
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

  return (
    <tr
      draggable={draggable}
      onDragStart={(e) => onDragStart?.(e, request.id)}
      onDragOver={(e) => onDragOver?.(e, request.id)}
      onDrop={(e) => onDrop?.(e, request.id)}
      onDragEnd={(e) => onDragEnd?.(e, request.id)}
      onClick={() => {
        if (canEditDocket) {
          openModalRef.current();
        }
      }}
      tabIndex={canEditDocket ? 0 : -1}
      className={`align-top text-blue-900 ${!isEmployee && isClosedStatus(request.status) ? "bg-emerald-50/80" : ""} ${canEditDocket ? "cursor-pointer" : ""}`}
    >
      <td className="px-2.5 py-2.5 align-top whitespace-normal break-words text-xs font-semibold text-blue-950">
        <div className="flex items-start gap-3">
          {!isEmployee ? (
            <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-white text-blue-700 shadow-sm" onClick={(e)=>e.stopPropagation()} title="Drag to reorder">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M10 6h6M10 12h6M10 18h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
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
                <span
                  onClick={(event) => {
                    event.stopPropagation();
                    open();
                  }}
                  className="font-semibold text-blue-800 underline decoration-blue-300 underline-offset-2 transition hover:text-blue-600"
                >
                  {request.docketNumber}
                </span>
              )}
            />

            {!isEmployee ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {/* previously up/down buttons removed - drag handle used instead */}
              </div>
            ) : null}
          </div>
        </div>
      </td>
      <td className="px-2.5 py-2.5 align-top whitespace-normal break-words text-xs">
        <div className="flex flex-col gap-2">
          <span className="inline-flex rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] bg-red-100 text-red-800 ring-1 ring-inset ring-red-300">{getComplaintAgeLabel(request)}</span>
          {request.assignedToId ? renderAssignmentBadge(request) : null}
        </div>
      </td>
      <td className="px-2.5 py-2.5 align-top whitespace-normal break-words text-xs">
        <p className="font-semibold text-blue-950">{request.name}</p>
        <p className="mt-0.5 text-xs font-semibold text-blue-900">{request.company}</p>
      </td>
      <td className="px-2.5 py-2.5 align-top whitespace-normal break-words text-xs">{request.area}</td>
      <td className="px-2.5 py-2.5 align-top whitespace-normal break-words text-xs">{request.product}</td>
      <td className="px-2.5 py-2.5 align-top whitespace-normal break-words text-xs">
        <p>{request.callType}</p>
        {request.callType === "Service" ? (
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-700">
            {request.serviceBillingType ? formatServiceBillingType(request.serviceBillingType) : "Not specified"}
          </p>
        ) : null}
      </td>
      <td className="px-2.5 py-2.5 align-top whitespace-normal break-words text-xs font-semibold text-blue-950">
        {formatINRCurrency(request.serviceBillingType === "chargeable" ? request.chargeableAmount ?? 0 : 0)}
      </td>
      <td className="px-2.5 py-2.5 align-top whitespace-normal break-words text-xs" onClick={(event) => event.stopPropagation()}>
        {isEmployee ? (
          <div className="whitespace-nowrap">
            <StatusUpdateModal request={request} />
          </div>
        ) : (
          <div className="space-y-1">
            <StatusPill label={getStatusLabel(request.status)} className={getStatusPillClass(request.status)} />
            {request.statusReason && (
              <div className="mt-1">
                <RemarkPopup remark={request.statusReason} />
              </div>
            )}
          </div>
        )}
      </td>
      {canAssign ? (
        <td className="px-2.5 py-2.5 align-top whitespace-normal break-words text-xs" onClick={(event) => event.stopPropagation()}>
          <div className="space-y-2">
            {isClosedStatus(request.status) ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-2">
                <p className="text-xs font-semibold text-emerald-900">
                  <span className="text-[10px] uppercase tracking-[0.08em] text-emerald-700">Closed By:</span>{" "}
                  {getClosedByName(request)}
                </p>
              </div>
            ) : null}
            {!isClosedStatus(request.status) ? (
              <div className="flex items-center gap-2">
                <input type="hidden" name="requestId" value={request.id} />
                <select
                  name="assignedToId"
                  defaultValue={request.assignedToId ? String(request.assignedToId) : ""}
                  onChange={async (e) => {
                    const assignedToId = e.currentTarget.value;
                    try {
                      // show quick toast then reload to reflect change
                      const res = await fetch("/api/assign", {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ requestId: request.id, assignedToId }),
                      });

                      const json = await res.json();
                      if (json.success) {
                        // show small toast
                        const el = document.createElement("div");
                        el.className = "fixed bottom-4 right-4 z-50 rounded-md bg-emerald-600 px-4 py-2 text-white";
                        el.textContent = "Allocation saved";
                        document.body.appendChild(el);
                        setTimeout(() => {
                          el.remove();
                          window.location.reload();
                        }, 800);
                      } else {
                        alert(json.message || "Allocation failed");
                      }
                    } catch (err) {
                      console.error(err);
                      alert("Allocation failed");
                    }
                  }}
                  className="min-w-[9.5rem] flex-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs outline-none focus:border-blue-400"
                >
                  <option value="">Select employee</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        </td>
      ) : null}
    </tr>
  );
}
