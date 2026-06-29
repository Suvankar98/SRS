"use client";

import React from "react";
import { DocketDetailsModal } from "../docket-details-modal";
import { RemarkPopup } from "../remark-popup";
import { StatusUpdateModal } from "../status-update-modal";
import { EmployeeMediaUpload } from "./employee-media-upload";
import { CopyPhoneButton } from "./copy-phone-button";
import { DashboardRequestRow } from "./dashboard-request-row";
import { getStatusLabel, getStatusPillClass } from "../status-utils";

export type DashboardListRequest = {
  id: string;
  docketNumber: string;
  createdAt: Date;
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
  status: string | null;
  statusReason: string | null;
  closedAt: Date | string | null;
  closedByName: string | null;
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

  const moveItem = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) {
      return;
    }

    setItems((currentItems) => {
      const next = [...currentItems];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-blue-200 bg-white">
      <div className="space-y-3 p-3 md:hidden">
        {items.map((request, index) => (
          <article
            key={request.id}
            className={`rounded-xl border p-3 text-sm text-blue-900 ${
              !isEmployee && isClosedStatus(request.status)
                ? "border-emerald-300 bg-emerald-50"
                : "border-blue-200 bg-blue-50/40"
            }`}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <div className="text-xs uppercase tracking-[0.12em] text-blue-600">
                  <DocketDetailsModal request={request} canEdit={canEditDocket} products={products} />
                </div>
                <p className="font-semibold text-blue-950">{request.name}</p>
                <p className="text-xs font-normal text-blue-700">{request.company}</p>
                <span className="inline-flex rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] bg-red-100 text-red-800 ring-1 ring-inset ring-red-300">
                  {getComplaintAgeLabel(request)}
                </span>
              </div>
              {!isEmployee && (
                <div className="flex flex-col items-end">
                  <StatusPill label={getStatusLabel(request.status)} className={getStatusPillClass(request.status)} />
                  {request.statusReason && (
                    <div className="mt-2">
                      <RemarkPopup remark={request.statusReason} />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <Detail label="Location" value={request.area} />
              <Detail label="Product" value={request.product} />
              <div>
                <p className="text-[11px] uppercase tracking-[0.08em] text-blue-600">Call Type</p>
                <p className="mt-0.5 break-words text-blue-900 font-semibold">{request.callType}</p>
                {request.callType === "Service" ? (
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-blue-700">
                    {request.serviceBillingType ? formatServiceBillingType(request.serviceBillingType) : "Not specified"}
                  </p>
                ) : null}
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.08em] text-blue-600">Amount</p>
                <p className="mt-0.5 break-words text-blue-950 font-semibold">
                  {formatINRCurrency(request.serviceBillingType === "chargeable" ? request.chargeableAmount ?? 0 : 0)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.08em] text-blue-600">Phone</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-blue-900">
                  <span>{request.phoneNumber1}</span>
                  {isEmployee ? (
                    <span className="inline-flex items-center gap-2">
                      <CopyPhoneButton value={request.phoneNumber1} />
                    </span>
                  ) : null}
                </div>
              </div>
              {request.phoneNumber2 && <Detail label="Alt Phone" value={request.phoneNumber2} />}
              {isEmployee ? (
                <div className="flex flex-col gap-2">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-blue-600">Status</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusUpdateModal request={request} />
                    <EmployeeMediaUpload requestId={request.id} />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => moveItem(index, -1)}
                  disabled={index === 0}
                  className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(index, 1)}
                  disabled={index === items.length - 1}
                  className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ↓
                </button>
              </div>
              {canAssign ? (
                isClosedStatus(request.status) ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <p className="text-xs font-semibold text-emerald-900">
                      <span className="text-[10px] uppercase tracking-[0.08em] text-emerald-700">Closed By:</span> {request.closedByName ?? "Unknown"}
                    </p>
                  </div>
                ) : (
                  <form action="#" className="flex flex-col gap-2 sm:flex-row sm:items-center" onClick={(event) => event.stopPropagation()}>
                    <select
                      name="assignedToId"
                      defaultValue={request.assignedToId ?? ""}
                      className="w-full rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs outline-none focus:border-blue-400 sm:w-auto"
                    >
                      <option value="">Select employee</option>
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.name}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="rounded-full bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-800">
                      Save
                    </button>
                  </form>
                )
              ) : null}
            </div>
          </article>
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-[900px] w-full table-auto divide-y divide-blue-100 text-left text-xs">
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
              {isEmployee ? <Th>Media</Th> : null}
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
                onMoveUp={() => moveItem(index, -1)}
                onMoveDown={() => moveItem(index, 1)}
                canMoveUp={index !== 0}
                canMoveDown={index !== items.length - 1}
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
  const closedAt = getClosedAt(request);
  const endDate = request.status === "Close" && closedAt ? closedAt : new Date();

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

function getClosedAt(request: DashboardListRequest) {
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
  return (status || "Pending") === "Close";
}

function StatusPill({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${className}`}>
      {label}
    </span>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.08em] text-blue-600">{label}</p>
      <p className="mt-0.5 break-words text-blue-900">{value}</p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="break-words px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-600">{children}</th>;
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
