"use client";

import React from "react";
import { DocketDetailsModal } from "../docket-details-modal";
import { StatusPill } from "../status-update-modal";
import { RemarkPopup } from "../remark-popup";
import { EmployeeMediaUpload } from "./employee-media-upload";
import { CopyPhoneButton } from "./copy-phone-button";
import { assignServiceCall } from "../actions";
import { formatServiceBillingType, formatINRCurrency } from "../status-utils";
import { ServiceRequest } from "@prisma/client";

export type SimpleOption = {
  id: string;
  name: string;
};

type DashboardTableBodyProps = {
  requests: Array<ServiceRequest & {
    serviceBillingType: string | null;
    chargeableAmount: number | null;
    phoneNumber2: string | null;
    company: string;
    fullAddress: string;
    complaintDetails: string | null;
  }>;
  products: SimpleOption[];
  employees: SimpleOption[];
  canEditDocket: boolean;
  canAssign: boolean;
  isEmployee: boolean;
  getComplaintAgeLabel: (request: { createdAt: Date; status: string | null }) => string;
  getClosedByName: (request: { closedByName: string | null }) => string;
  getStatusLabel: (status: string | null) => string;
  getStatusPillClass: (status: string | null) => string;
  isClosedStatus: (status: string | null) => boolean;
};

export function DashboardTableBody({
  requests,
  products,
  employees,
  canEditDocket,
  canAssign,
  isEmployee,
  getComplaintAgeLabel,
  getClosedByName,
  getStatusLabel,
  getStatusPillClass,
  isClosedStatus,
}: DashboardTableBodyProps) {
  return (
    <tbody className="divide-y divide-blue-100 bg-white">
      {requests.map((request) => (
        <DashboardTableRow
          key={request.id}
          request={request}
          products={products}
          employees={employees}
          canEditDocket={canEditDocket}
          canAssign={canAssign}
          isEmployee={isEmployee}
          getComplaintAgeLabel={getComplaintAgeLabel}
          getClosedByName={getClosedByName}
          getStatusLabel={getStatusLabel}
          getStatusPillClass={getStatusPillClass}
          isClosedStatus={isClosedStatus}
        />
      ))}
    </tbody>
  );
}

function DashboardTableRow({
  request,
  products,
  employees,
  canEditDocket,
  canAssign,
  isEmployee,
  getComplaintAgeLabel,
  getClosedByName,
  getStatusLabel,
  getStatusPillClass,
  isClosedStatus,
}: Omit<DashboardTableBodyProps, "requests"> & { request: DashboardTableBodyProps["requests"][number] }) {
  const openModalRef = React.useRef<() => void>(() => {});

  const rowClick = () => {
    if (canEditDocket) {
      openModalRef.current?.();
    }
  };

  return (
    <tr
      onClick={rowClick}
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
      </td>
      <td className="px-2.5 py-2.5 align-top whitespace-normal break-words text-xs">{getComplaintAgeLabel(request)}</td>
      <td className="px-2.5 py-2.5 align-top whitespace-normal break-words text-xs">
        <p className="font-semibold text-blue-950">{request.name}</p>
        <p className="mt-0.5 text-xs font-normal text-blue-700">{request.company}</p>
      </td>
      <td className="px-2.5 py-2.5 align-top whitespace-normal break-words text-xs">{request.area}</td>
      <td className="px-2.5 py-2.5 align-top whitespace-normal break-words text-xs">{request.product}</td>
      <td className="px-2.5 py-2.5 align-top whitespace-normal break-words text-xs">
        <p>{request.callType}</p>
        {request.callType === "Service" && request.serviceBillingType ? (
          <p className="mt-1 text-[11px] font-bold text-blue-700">
            {formatServiceBillingType(request.serviceBillingType)}
            {request.serviceBillingType === "chargeable" && request.chargeableAmount !== null
              ? ` - ${formatINRCurrency(request.chargeableAmount)}`
              : ""}
          </p>
        ) : null}
      </td>
      <td className="px-2.5 py-2.5 align-top whitespace-normal break-words text-xs">
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
        <td className="px-2.5 py-2.5 align-top whitespace-normal break-words text-xs text-right">
          <EmployeeMediaUpload requestId={request.id} />
        </td>
      ) : null}
      {canAssign ? (
        <td className="px-2.5 py-2.5 align-top whitespace-normal break-words text-xs">
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
