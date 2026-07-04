"use client";

import React, { useState } from "react";
import { getStatusPillClass, getStatusLabel, normalizeStatus } from "../status-utils";

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
    closedByName: string | null;
    callType: string;
    area: string;
    serviceBillingType: string | null;
    chargeableAmount: number | null;
    customerReview: string | null;
    assignedTo: {
      name: string;
    } | null;
  } | null;
};

export function ReportCallDetailsModal({ request }: CallDetailsModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!request) return null;

  const status = normalizeStatus(request.status);
  const createdDate = new Date(request.createdAt);
  const formattedDate = createdDate.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });

  const getBillingTypeLabel = (type: string | null) => {
    if (!type) return "N/A";
    const typeMap: Record<string, string> = {
      warranty: "Warranty",
      amc: "AMC",
      chargeable: "Chargeable",
    };
    return typeMap[type] || type;
  };

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
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="my-6 w-full max-w-2xl rounded-3xl border border-blue-200 bg-white p-6 shadow-[0_28px_90px_rgba(15,23,42,0.18)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Service Request Details</p>
                <h2 className="mt-1 text-2xl font-semibold text-blue-950">{request.docketNumber}</h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-blue-200 text-blue-700 transition hover:bg-blue-50"
              >
                ✕
              </button>
            </div>

            {/* Content Grid */}
            <div className="space-y-6">
              {/* Customer Info */}
              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-3">Customer Information</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-blue-600 font-medium">Name</p>
                    <p className="text-sm text-blue-950 font-medium mt-1">{request.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600 font-medium">Company</p>
                    <p className="text-sm text-blue-950 font-medium mt-1">{request.company || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600 font-medium">Phone 1</p>
                    <p className="text-sm text-blue-950 font-medium mt-1">{request.phoneNumber1}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600 font-medium">Phone 2</p>
                    <p className="text-sm text-blue-950 font-medium mt-1">{request.phoneNumber2 || "N/A"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-blue-600 font-medium">Address</p>
                    <p className="text-sm text-blue-950 font-medium mt-1">{request.fullAddress}</p>
                  </div>
                </div>
              </div>

              {/* Service Info */}
              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-3">Service Information</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-blue-600 font-medium">Docket</p>
                    <p className="text-sm text-blue-950 font-medium mt-1">{request.docketNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600 font-medium">Created</p>
                    <p className="text-sm text-blue-950 font-medium mt-1">{formattedDate}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600 font-medium">Area</p>
                    <p className="text-sm text-blue-950 font-medium mt-1">{request.area}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600 font-medium">Product</p>
                    <p className="text-sm text-blue-950 font-medium mt-1">{request.product}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600 font-medium">Call Type</p>
                    <p className="text-sm text-blue-950 font-medium mt-1">{request.callType}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600 font-medium">Assigned To</p>
                    <p className="text-sm text-blue-950 font-medium mt-1">{request.assignedTo?.name || "Unassigned"}</p>
                  </div>
                </div>
              </div>

              {/* Billing Info */}
              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-3">Billing Information</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-blue-600 font-medium">Type</p>
                    <p className="text-sm text-blue-950 font-medium mt-1">
                      {getBillingTypeLabel(request.serviceBillingType)}
                    </p>
                  </div>
                  {request.serviceBillingType === "chargeable" && (
                    <div>
                      <p className="text-xs text-blue-600 font-medium">Amount</p>
                      <p className="text-sm text-blue-950 font-medium mt-1">₹ {request.chargeableAmount || 0}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Info */}
              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-3">Status & Notes</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-blue-600 font-medium">Current Status</p>
                    <div className="mt-1">
                      <span
                        className={`inline-flex items-center rounded-md px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ${getStatusPillClass(
                          status,
                        )}`}
                      >
                        {getStatusLabel(status)}
                      </span>
                    </div>
                  </div>
                  {request.statusReason && (
                    <div>
                      <p className="text-xs text-blue-600 font-medium">Status Reason</p>
                      <p className="text-sm text-blue-950 mt-1 bg-white p-2 rounded border border-blue-100">
                        {request.statusReason}
                      </p>
                    </div>
                  )}
                  {request.complaintDetails && (
                    <div>
                      <p className="text-xs text-blue-600 font-medium">Complaint Details</p>
                      <p className="text-sm text-blue-950 mt-1 bg-white p-2 rounded border border-blue-100">
                        {request.complaintDetails}
                      </p>
                    </div>
                  )}
                  {request.customerReview && (
                    <div>
                      <p className="text-xs text-blue-600 font-medium">Customer Review</p>
                      <p className="text-sm text-blue-950 mt-1 bg-white p-2 rounded border border-blue-100">
                        {request.customerReview}
                      </p>
                    </div>
                  )}
                  {request.closedByName && (
                    <div>
                      <p className="text-xs text-blue-600 font-medium">Closed By</p>
                      <p className="text-sm text-blue-950 font-medium mt-1">{request.closedByName}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 flex justify-end">
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
