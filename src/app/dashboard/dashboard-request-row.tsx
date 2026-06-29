"use client";

import React from "react";
import { DocketDetailsModal } from "../docket-details-modal";
import { RemarkPopup } from "../remark-popup";
import { StatusUpdateModal } from "../status-update-modal";
import { EmployeeMediaUpload } from "./employee-media-upload";
import { CopyPhoneButton } from "./copy-phone-button";
import { assignServiceCall } from "../actions";
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
    status: string | null;
    statusReason: string | null;
    closedAt: Date | string | null;
    closedByName: string | null;
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
}: DashboardRequestRowProps) {
  const openModalRef = React.useRef<() => void>(() => {});

  const getComplaintAgeLabel = (request: { createdAt: Date | string; status: string | null; closedAt?: Date | string | null }) => {
    const createdAt = typeof request.createdAt === "string" ? new Date(request.createdAt) : request.createdAt;
    const closedAt = getClosedAt(request as { createdAt: Date | string; status: string | null; closedAt?: Date | string | null } & Record<string, unknown>);
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
  };

  const getClosedByName = (request: { closedByName: string | null }) => {
    const value = request.closedByName;
    return typeof value === "string" && value.trim() !== "" ? value : "Unknown";
  };

  const isClosedStatus = (status: string | null) => {
    return (status || "Pending") === "Close";
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
      onClick={() => {
        if (canEditDocket) {
          openModalRef.current();
        }
      }}
      tabIndex={canEditDocket ? 0 : -1}
      className={`align-top text-blue-900 ${!isEmployee && isClosedStatus(request.status) ? "bg-emerald-50/80" : ""} ${canEditDocket ? "cursor-pointer" : ""}`}
    >
      <td className="px-2.5 py-2.5 align-top whitespace-normal break-words text-xs font-semibold text-blue-950">
        <DocketDetailsModal
          request={request}
          canEdit={canEditDocket}
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
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onMoveUp?.();
              }}
              disabled={!canMoveUp}
              className="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-full border border-blue-200 bg-white text-xs font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onMoveDown?.();
              }}
              disabled={!canMoveDown}
              className="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-full border border-blue-200 bg-white text-xs font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ↓
            </button>
          </div>
        ) : null}
      </td>
      <td className="px-2.5 py-2.5 align-top whitespace-normal break-words text-xs">
        <span className="inline-flex rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] bg-red-100 text-red-800 ring-1 ring-inset ring-red-300">
          {getComplaintAgeLabel(request)}
        </span>
      </td>
      <td className="px-2.5 py-2.5 align-top whitespace-normal break-words text-xs">
        <p className="font-semibold text-blue-950">{request.name}</p>
        <p className="mt-0.5 text-xs font-normal text-blue-700">{request.company}</p>
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
      {isEmployee ? (
        <td className="px-2.5 py-2.5 align-top whitespace-normal break-words text-xs text-right" onClick={(event) => event.stopPropagation()}>
          <EmployeeMediaUpload requestId={request.id} />
        </td>
      ) : null}
      {canAssign ? (
        <td className="px-2.5 py-2.5 align-top whitespace-normal break-words text-xs" onClick={(event) => event.stopPropagation()}>
          {isClosedStatus(request.status) ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-2">
              <p className="text-xs font-semibold text-emerald-900">
                <span className="text-[10px] uppercase tracking-[0.08em] text-emerald-700">Closed By:</span>{" "}
                {getClosedByName(request)}
              </p>
            </div>
          ) : (
            <form action={assignServiceCall} className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
              <input type="hidden" name="requestId" value={request.id} />
              <select
                name="assignedToId"
                defaultValue={request.assignedToId ? String(request.assignedToId) : ""}
                className="min-w-[9.5rem] flex-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs outline-none focus:border-blue-400"
              >
                <option value="">Select employee</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="shrink-0 rounded-full bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-800"
              >
                Save
              </button>
            </form>
          )}
        </td>
      ) : null}
    </tr>
  );
}
