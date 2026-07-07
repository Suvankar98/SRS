"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { deleteServiceRequest, updateServiceRequestDetails } from "./actions";
import { CALL_TYPE_OPTIONS } from "@/lib/service-request-options";
import { AssignmentPicker, type AssignmentPickerAssignment } from "./dashboard/assignment-picker";

type SimpleOption = {
  id: string;
  name: string;
};

type RequestDetails = {
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
  status?: string | null;
  assignedTo?: { name: string } | null;
  assignments?: AssignmentPickerAssignment[];
  createdBy?: { name: string } | null;
};

type BillingType = "warranty" | "amc" | "chargeable";
const BILLING_TYPE_OPTIONS: Array<{ id: BillingType; label: string }> = [
  { id: "warranty", label: "Warranty" },
  { id: "amc", label: "AMC" },
  { id: "chargeable", label: "Chargeable" },
];

const AREAS = [
  "Alipore",
  "Ballygunge",
  "Baghajatin",
  "Behala",
  "Bhowanipore",
  "Dum Dum",
  "EM Bypass",
  "Esplanade",
  "Garia",
  "Jadavpur",
  "Kalighat",
  "Kasba",
  "Kidderpore",
  "Lake Town",
  "New Alipore",
  "Park Circus",
  "Park Street",
  "Rajarhat",
  "Salt Lake",
  "Sealdah",
  "Shyambazar",
  "Tollygunge",
];

export function DocketDetailsModal({
  request,
  canEdit,
  canAssign,
  employees,
  products,
  renderTrigger,
  onReady,
}: {
  request: RequestDetails;
  canEdit: boolean;
  canAssign?: boolean;
  employees?: SimpleOption[];
  products: SimpleOption[];
  renderTrigger?: (open: () => void) => React.ReactNode;
  onReady?: (open: () => void) => void;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const openModal = () => setIsOpen(true);

  React.useEffect(() => {
    if (onReady) {
      onReady(openModal);
    }
  }, [onReady]);
  const [name, setName] = React.useState(request.name);
  const [company] = React.useState(request.company);
  const [phoneNumber1, setPhoneNumber1] = React.useState(request.phoneNumber1);
  const [phoneNumber2, setPhoneNumber2] = React.useState(request.phoneNumber2 || "");
  const [fullAddress, setFullAddress] = React.useState(request.fullAddress);
  const [complaintDetails, setComplaintDetails] = React.useState(request.complaintDetails || "");
  const [area, setArea] = React.useState(request.area);
  const [product, setProduct] = React.useState(request.product);
  const [callType, setCallType] = React.useState(request.callType);
  const [serviceBillingType, setServiceBillingType] = React.useState<BillingType | "">(
    request.serviceBillingType && BILLING_TYPE_OPTIONS.some((option) => option.id === request.serviceBillingType)
      ? (request.serviceBillingType as BillingType)
      : "",
  );
  const [chargeableAmount, setChargeableAmount] = React.useState(
    request.chargeableAmount !== null && request.chargeableAmount !== undefined ? String(request.chargeableAmount) : "",
  );
  const [isDeleting, setIsDeleting] = React.useState(false);
  const callTypeOptions = request.callType && !CALL_TYPE_OPTIONS.includes(request.callType as (typeof CALL_TYPE_OPTIONS)[number])
    ? [request.callType, ...CALL_TYPE_OPTIONS]
    : [...CALL_TYPE_OPTIONS];
  const isServiceCall = callType === "Service";
  const isChargeable = isServiceCall && serviceBillingType === "chargeable";

  const handleCallTypeChange = (value: string) => {
    setCallType(value);

    if (value !== "Service") {
      setServiceBillingType("");
      setChargeableAmount("");
    }
  };

  const toggleServiceBillingType = (optionId: BillingType) => {
    setServiceBillingType((currentValue) => {
      const nextValue = currentValue === optionId ? "" : optionId;

      if (nextValue !== "chargeable") {
        setChargeableAmount("");
      }

      return nextValue;
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!canEdit) {
      return;
    }

    const formData = new FormData();
    formData.append("requestId", String(request.id));
    formData.append("name", name);
    formData.append("company", company);
    formData.append("phoneNumber1", phoneNumber1);
    formData.append("phoneNumber2", phoneNumber2);
    formData.append("fullAddress", fullAddress);
    formData.append("complaintDetails", complaintDetails);
    formData.append("area", area);
    formData.append("product", product);
    formData.append("callType", callType);
    formData.append("serviceBillingType", isServiceCall ? serviceBillingType : "");
    formData.append("chargeableAmount", isChargeable ? chargeableAmount : "");

    await updateServiceRequestDetails(formData);
    setIsOpen(false);
    router.refresh();
  };

  const handleDelete = async () => {
    if (!canEdit || isDeleting) {
      return;
    }

    const shouldDelete = window.confirm(
      `Delete ${request.docketNumber}? This will permanently remove this service request.`,
    );

    if (!shouldDelete) {
      return;
    }

    setIsDeleting(true);

    try {
      const formData = new FormData();
      formData.append("requestId", String(request.id));
      await deleteServiceRequest(formData);
      setIsOpen(false);
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenMap = () => {
    const address = fullAddress.trim();
    if (!address) {
      return;
    }

    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
    window.open(mapsUrl, "_blank", "noopener,noreferrer");
  };
  const assignmentDates =
    request.assignments
      ?.map((assignment) => parseDateValue(assignment.assignedAt))
      .filter((value): value is Date => value !== null) ?? [];
  const firstAssignedAt =
    assignmentDates.length > 0
      ? new Date(Math.min(...assignmentDates.map((value) => value.getTime())))
      : parseDateValue(request.assignedAt);
  const assignedAtLabel = firstAssignedAt ? formatRequestDateTime(firstAssignedAt) : null;

  const modal = isOpen ? (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-2 sm:p-4"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="my-2 flex max-h-[calc(100vh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-lg border bg-white shadow-lg sm:my-4 sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0">
            <h3 className="break-words text-base font-semibold text-blue-950 sm:text-lg">
              Docket Details - {request.docketNumber}
              {assignedAtLabel ? (
                <span className="mt-1 block text-xs font-medium text-blue-600 sm:ml-2 sm:mt-0 sm:inline">
                  Assigned: {assignedAtLabel}
                </span>
              ) : null}
            </h3>
            <p className="text-xs text-gray-500">{formatRequestDateTime(request.createdAt)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {request.status ? (
              <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">{request.status}</span>
            ) : null}
            <button type="button" onClick={() => setIsOpen(false)} className="rounded-full bg-red-100 px-3 py-1 text-sm text-red-700">Close</button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
              <div className="space-y-4">
                <GridField label="Customer name">
                  {canEdit ? (
                    <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded border px-3 py-2 text-sm sm:text-base" />
                  ) : (
                    <InfoField label="Name" value={`${name} ${company ? `\n${company}` : ""}`.trim()} />
                  )}
                </GridField>

                <GridField label="Phone numbers">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input value={phoneNumber1} onChange={(e) => setPhoneNumber1(e.target.value)} className="w-full rounded border px-3 py-2 text-sm sm:text-base" />
                    <input value={phoneNumber2} onChange={(e) => setPhoneNumber2(e.target.value)} className="w-full rounded border px-3 py-2 text-sm sm:text-base" />
                  </div>
                </GridField>

                <GridField label="Address">
                  <textarea value={fullAddress} onChange={(e) => setFullAddress(e.target.value)} className="w-full rounded border px-3 py-2 text-sm sm:text-base" rows={4} />
                </GridField>

                <GridField label="Complaint details">
                  <textarea value={complaintDetails} onChange={(e) => setComplaintDetails(e.target.value)} className="w-full rounded border px-3 py-2 text-sm sm:text-base" rows={4} />
                </GridField>
              </div>

              <div className="space-y-4">
                <GridField label="Product">
                  {canEdit ? (
                    <select value={product} onChange={(e) => setProduct(e.target.value)} className="w-full rounded border px-3 py-2 text-sm sm:text-base">
                      {products.map((p) => (
                        <option key={p.id} value={p.name ?? p.id}>{p.name ?? p.id}</option>
                      ))}
                    </select>
                  ) : (
                    <InfoField label="Product" value={product} />
                  )}
                </GridField>

                <GridField label="Call type">
                  <select value={callType} onChange={(e) => handleCallTypeChange(e.target.value)} className="w-full rounded border px-3 py-2 text-sm sm:text-base">
                    {callTypeOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </GridField>

                {isServiceCall && (
                  <GridField label="Service billing type">
                    <div className="flex flex-wrap gap-2">
                      {BILLING_TYPE_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => toggleServiceBillingType(opt.id)}
                          className={`rounded px-3 py-1 ${serviceBillingType === opt.id ? "bg-blue-600 text-white" : "border text-gray-700"}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {isChargeable && (
                      <div className="mt-2">
                        <input value={chargeableAmount} onChange={(e) => setChargeableAmount(e.target.value)} className="w-full rounded border px-3 py-2 text-sm sm:text-base" placeholder="Amount" />
                      </div>
                    )}
                  </GridField>
                )}

                <GridField label="Area">
                  <select value={area} onChange={(e) => setArea(e.target.value)} className="w-full rounded border px-3 py-2 text-sm sm:text-base">
                    {AREAS.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </GridField>

                <div className="space-y-2">
                  {canAssign && employees ? (
                    <div>
                      <label className="block text-sm font-medium text-blue-700">Assign to</label>
                      <div className="mt-2">
                        <AssignmentPicker
                          key={`${request.id}:${request.assignments?.map((assignment) => assignment.employeeId).join(",") ?? request.assignedToId ?? ""}`}
                          requestId={request.id}
                          employees={employees}
                          assignments={request.assignments}
                          defaultEmployeeId={request.assignedToId}
                        />
                      </div>
                    </div>
                  ) : null}

                  {canAssign ? (
                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                      {request.createdBy ? <p>Created by: {request.createdBy.name}</p> : null}
                      {request.assignments && request.assignments.length > 0 ? (
                        request.assignments.map((assignment) => (
                          <p key={assignment.employeeId}>
                            Assigned to: {assignment.employee?.name ?? "Employee"}
                            {assignment.assignedAt ? ` at ${formatRequestDateTime(assignment.assignedAt)}` : ""}
                          </p>
                        ))
                      ) : (
                        <>
                          {request.assignedTo ? <p>Assigned to: {request.assignedTo.name}</p> : null}
                          {request.assignedAt ? <p>Assigned at: {formatRequestDateTime(request.assignedAt)}</p> : null}
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-2 border-t px-4 py-4 sm:flex sm:items-center sm:justify-end sm:gap-3 sm:px-6">
            <button type="button" onClick={handleOpenMap} className="w-full rounded border px-3 py-2 text-sm sm:w-auto">Open in maps</button>
            {canEdit ? (
              <>
                <button type="button" onClick={handleDelete} disabled={isDeleting} className="w-full rounded border px-3 py-2 text-sm text-red-600 sm:w-auto">{isDeleting ? "Deleting..." : "Delete"}</button>
                <button type="submit" className="w-full rounded bg-blue-600 px-4 py-2 text-white sm:w-auto">Save changes</button>
              </>
            ) : (
              <button type="button" onClick={() => setIsOpen(false)} className="w-full rounded bg-blue-600 px-4 py-2 text-white sm:w-auto">Close</button>
            )}
          </div>
        </form>
      </div>
    </div>
  ) : null;

  return (
    <div>
      {renderTrigger ? (
        renderTrigger(openModal)
      ) : (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            openModal();
          }}
          className="font-semibold text-blue-800 underline decoration-blue-300 underline-offset-2 transition hover:text-blue-600"
        >
          {request.docketNumber}
        </button>
      )}

      {modal}
    </div>
  );
}

function GridField({
  label,
  children,
  action,
}: {
  label: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="block text-sm font-medium text-blue-700">{label}</span>
        {action ? <div>{action}</div> : null}
      </div>
      {children}
    </label>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
      <p className="text-[10px] uppercase tracking-[0.12em] text-blue-600">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function formatRequestDateTime(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function parseDateValue(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
