"use client";

import React from "react";
import { DocketDetailsModal } from "../docket-details-modal";
import { StatusUpdateModal } from "../status-update-modal";
import { AssignmentPicker, type AssignmentPickerAssignment } from "./assignment-picker";
import { AdminManagerStatusSelect } from "./admin-manager-status-select";
import { DashboardRequestRow } from "./dashboard-request-row";
import { normalizeStatus } from "../status-utils";
import type { DashboardRequestMediaItem } from "@/lib/gallery";

const COMPLETED_REASSIGN_WINDOW_MS = 72 * 60 * 60 * 1000;

export type DashboardListRequest = {
  id: string;
  docketNumber: string;
  createdAt: Date;
  name: string;
  company: string;
  contactPerson2: string | null;
  phoneNumber1: string;
  phoneNumber2: string | null;
  fullAddress: string;
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
  createdBy?: { name: string } | null;
  mediaItems?: DashboardRequestMediaItem[];
};

type DashboardRequestListProps = {
  requests: DashboardListRequest[];
  products: Array<{ id: string; name: string }>;
  employees: Array<{ id: string; name: string }>;
  canEditDocket: boolean;
  canAssign: boolean;
  isEmployee: boolean;
};

export function DashboardRequestList({
  requests,
  products,
  employees,
  canEditDocket,
  canAssign,
  isEmployee,
}: DashboardRequestListProps) {
  const [items, setItems] = React.useState(requests);
  const [orderMessage, setOrderMessage] = React.useState("");

  // drag & drop state
  const dragItem = React.useRef<number | null>(null);
  const dragOverItem = React.useRef<number | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, id: string) => {
    const idx = items.findIndex((it) => it.id === id);
    dragItem.current = idx >= 0 ? idx : null;
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>, id: string) => {
    e.preventDefault();
    const idx = items.findIndex((it) => it.id === id);
    dragOverItem.current = idx >= 0 ? idx : null;
  };

  const handleDrop = (e: React.DragEvent<HTMLTableRowElement>, id: string) => {
    e.preventDefault();
    const from = dragItem.current;
    const to = dragOverItem.current;
    if (from === null || to === null || from === to) return;
    setItems((current) => {
      const copy = [...current];
      const [moved] = copy.splice(from, 1);
      copy.splice(to, 0, moved);
      if (!isEmployee && canAssign) {
        void saveDashboardOrder(copy.map((item) => item.id));
      }
      return copy;
    });
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const handleDragEnd = () => {
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const saveDashboardOrder = async (requestIds: string[]) => {
    setOrderMessage("Saving order...");

    try {
      const response = await fetch("/api/dashboard/reorder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestIds }),
      });
      const json = await response.json();

      if (!json.success) {
        setOrderMessage(json.message || "Order was not saved");
        return;
      }

      setOrderMessage("Order saved");
      window.setTimeout(() => setOrderMessage(""), 1500);
    } catch (error) {
      console.error(error);
      setOrderMessage("Order was not saved");
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-blue-200 bg-white">
      {orderMessage ? (
        <div className="border-b border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
          {orderMessage}
        </div>
      ) : null}
      <div className="space-y-3 p-1.5 md:hidden">
        {items.map((request) => {
          const isCompletedRequest = isClosedStatus(request.status);
          const isReassignLocked = isCompletedRequest && !isCompletedReassignWindowOpen(request);

          return (
          <article
            key={request.id}
            className={`rounded-2xl border p-3 text-sm text-blue-900 shadow-sm ${
              !isEmployee && isClosedStatus(request.status)
                ? "border-emerald-300 bg-emerald-50"
                : "border-blue-200 bg-white"
            }`}
          >
            <div className="mb-3 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <DocketDetailsModal
                    request={request}
                    canEdit={canEditDocket}
                    canAssign={canAssign}
                    employees={employees}
                    products={products}
                    renderTrigger={(open) => (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          open();
                        }}
                        className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-blue-300 bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-blue-800 shadow-sm transition hover:border-blue-500 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
                        aria-label={`Open docket details for ${request.docketNumber}`}
                      >
                        <span className="min-w-0">{request.docketNumber}</span>
                        <OpenDocketIcon />
                      </button>
                    )}
                  />
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="inline-flex rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] bg-red-100 text-red-800 ring-1 ring-inset ring-red-300">
                    {getComplaintAgeLabel(request)}
                  </span>
                  {isEmployee && request.assignedToId ? <EmployeeCountdownBadge request={request} /> : null}
                </div>
              </div>

              <div className="min-w-0">
                <p className="break-words text-base font-bold leading-snug text-blue-950">{request.company}</p>
                <p className="mt-2 border-t border-blue-100 pt-2 break-words text-xs font-medium leading-snug text-slate-600">{request.name}</p>
                {!isEmployee ? (
                  <div className="mt-2 flex flex-col items-start">
                    <AdminManagerStatusSelect request={request} />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <Detail label="Location" value={request.area} />
              <Detail label="Product" value={request.product} />
              <div className="rounded-lg border border-blue-100 bg-white px-2.5 py-2 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-500">Call Type</p>
                <p className="mt-1 break-words text-[13px] font-bold leading-snug text-blue-950">{request.callType}</p>
                {request.callType === "Service" ? (
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-blue-700">
                    {request.serviceBillingType ? formatServiceBillingType(request.serviceBillingType) : "Not specified"}
                  </p>
                ) : null}
              </div>
              <div className="rounded-lg border border-blue-100 bg-white px-2.5 py-2 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-500">Amount</p>
                <p className="mt-1 break-words text-[13px] font-bold leading-snug text-blue-950">
                  {formatINRCurrency(request.serviceBillingType === "chargeable" ? request.chargeableAmount ?? 0 : 0)}
                </p>
              </div>
              {!isEmployee ? (
                <>
                  <div className="rounded-lg border border-blue-100 bg-white px-2.5 py-2 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-500">Phone</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] font-bold leading-snug text-blue-950">
                      <span>{request.phoneNumber1}</span>
                    </div>
                  </div>
                  {request.phoneNumber2 && <Detail label="Alt Phone" value={request.phoneNumber2} />}
                </>
              ) : null}
              {isEmployee ? (
                <div className="col-span-2 flex items-center justify-between gap-3 rounded-lg border border-blue-100 bg-blue-50/70 px-2.5 py-2 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-500">Status</p>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <StatusUpdateModal request={request} />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="flex-1" />
              {canAssign ? (
                <div className="space-y-2">
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                    <p className="text-xs font-semibold text-blue-900">
                      <span className="text-[10px] uppercase tracking-[0.08em] text-blue-600">Assigned to:</span> {request.assignedTo?.name ?? "Unassigned"}
                    </p>
                    {request.assignedAt ? (
                      <p className="mt-1 text-[10px] text-blue-700">Assigned {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(request.assignedAt))}</p>
                    ) : null}
                    {request.status === "Completed" && request.assignedTo?.name ? (
                      <p className="mt-1 text-[11px] text-blue-700">Reassigned to {request.assignedTo.name}</p>
                    ) : null}
                  </div>
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
              ) : null}
            </div>
          </article>
          );
        })}
      </div>

      <div className="hidden overflow-hidden md:block">
        <table className="w-full table-fixed divide-y divide-blue-300 text-left text-xs">
          <colgroup>
            <col className="w-[14%]" />
            <col className="w-[13%]" />
            <col className="w-[10%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[7%]" />
            <col className="w-[11%]" />
            {canAssign ? <col className="w-[18%]" /> : null}
          </colgroup>
          <thead className="bg-blue-50 text-blue-700">
            <tr>
              <Th>Docket</Th>
              <Th>Days Old</Th>
              <Th>Name</Th>
              <Th>Location</Th>
              <Th>Product</Th>
              <Th>Call Type</Th>
              <Th>Amount</Th>
              <Th>Status</Th>
              {canAssign ? <Th>Allocate</Th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-100 bg-white">
            {items.map((request, index) => (
              <DashboardRequestRow
                key={request.id}
                request={request}
                products={products}
                employees={employees}
                canEditDocket={canEditDocket}
                canAssign={canAssign}
                isEmployee={isEmployee}
                draggable={true}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function getComplaintAgeLabel(request: DashboardListRequest) {
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
}

function getParsedDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function getCompletedAt(request: DashboardListRequest) {
  return (
    getParsedDate(request.closedAt) ??
    getParsedDate(request.statusSubmittedAt) ??
    getParsedDate(request.lastAttemptAt)
  );
}

function isCompletedReassignWindowOpen(request: DashboardListRequest) {
  const completedAt = getCompletedAt(request);

  if (!completedAt) {
    return false;
  }

  return Date.now() - completedAt.getTime() <= COMPLETED_REASSIGN_WINDOW_MS;
}

function EmployeeCountdownBadge({ request }: { request: DashboardListRequest }) {
  const assignedAt = getParsedDate(request.assignedAt);

  if (!assignedAt || isClosedStatus(request.status)) {
    return null;
  }

  const now = new Date();
  const assignedDay = new Date(assignedAt);
  const dayStart = new Date(assignedDay.getFullYear(), assignedDay.getMonth(), assignedDay.getDate());
  const deadline9 = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), 21, 0, 0);
  const deadline24 = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), 24, 0, 0);

  let colorClass = "bg-emerald-50 text-emerald-900 ring-emerald-300";
  let label = `Due in ${formatDuration(deadline9.getTime() - now.getTime())}`;

  if (now >= deadline9 && now < deadline24) {
    colorClass = "bg-amber-50 text-amber-900 ring-amber-300";
    label = `Due in ${formatDuration(deadline24.getTime() - now.getTime())}`;
  }

  if (now >= deadline24) {
    colorClass = "bg-rose-50 text-rose-900 ring-rose-300";
    label = `Overdue by ${formatDuration(now.getTime() - deadline24.getTime())}`;
  }

  return (
    <span className={`inline-flex rounded-md px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${colorClass}`}>
      {label}
    </span>
  );
}

function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
  }

  return `${minutes} min`;
}

function getDayNumberInTimeZone(value: Date, timeZone: string) {
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
}

function isClosedStatus(status: string | null) {
  return normalizeStatus(status) === "Completed";
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-blue-100 bg-white px-2.5 py-2 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-500">{label}</p>
      <p className="mt-1 break-words text-[13px] font-bold leading-snug text-blue-950">{value}</p>
    </div>
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

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="break-words border-b-2 border-blue-200 px-2 py-3 text-[10px] font-extrabold uppercase tracking-[0.1em] text-blue-900">
      {children}
    </th>
  );
}

function formatServiceBillingType(value: string) {
  if (value === "amc") {
    return "AMC";
  }

  if (value === "warranty") {
    return "Warranty";
  }

  if (value === "chargeable") {
    return "Chargeable";
  }

  return value;
}

function formatINRCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
