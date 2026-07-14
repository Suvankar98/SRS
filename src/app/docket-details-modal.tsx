"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { deleteServiceRequest, updateServiceRequestDetails } from "./actions";
import { CALL_TYPE_OPTIONS } from "@/lib/service-request-options";
import { AssignmentPicker, type AssignmentPickerAssignment } from "./dashboard/assignment-picker";
import { CopyPhoneButton } from "./dashboard/copy-phone-button";
import { ProductAutocomplete } from "./product-autocomplete";
import { formatIndianPhoneNumber, getIndianPhoneCopyValue } from "@/lib/phone";

const COMPLETED_REASSIGN_WINDOW_MS = 72 * 60 * 60 * 1000;

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
  assignedToId: string | null;
  assignedAt?: Date | string | null;
  status?: string | null;
  statusSubmittedAt?: Date | string | null;
  closedAt?: Date | string | null;
  closedByName?: string | null;
  lastAttemptByName?: string | null;
  lastAttemptAt?: Date | string | null;
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

const inputClassName =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-blue-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:text-base";
const mutedInputClassName =
  "w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 sm:text-base";
const textareaClassName = `${inputClassName} min-h-24 resize-y`;

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
  const [contactPerson2, setContactPerson2] = React.useState(request.contactPerson2 || "");
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
  const productOptions = React.useMemo(() => {
    if (products.some((option) => option.name.toLowerCase() === product.toLowerCase())) {
      return products;
    }

    return [{ id: `current-${product}`, name: product }, ...products];
  }, [product, products]);
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
    formData.append("contactPerson2", contactPerson2);
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
      `Delete ${request.docketNumber}? It will be removed from the dashboard but kept in call history.`,
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
  const isCompletedRequest = request.status === "Completed";
  const isReassignLocked = isCompletedRequest && !isCompletedReassignWindowOpen(request);

  const modal = isOpen ? (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-2 sm:p-4"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="my-2 flex max-h-[calc(100vh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg sm:my-4 sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0">
            <h3 className="break-words text-base font-semibold text-blue-950 sm:text-lg">
              Docket Details - {request.docketNumber}
              {assignedAtLabel ? (
                <span className="mt-1 block text-xs font-medium text-blue-600 sm:ml-2 sm:mt-0 sm:inline">
                  Assigned: {assignedAtLabel}
                </span>
              ) : null}
            </h3>
            <p className="text-xs text-gray-500 sm:hidden">{formatRequestDateTime(request.createdAt)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {request.status ? (
              <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">{request.status}</span>
            ) : null}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-200"
              aria-label="Close docket details"
              title="Close"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-4 py-5 sm:px-6">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
              <div className="space-y-4">
                <GridField label="Customer">
                  {canEdit ? (
                    <div className="grid gap-4">
                      <EditFieldLabel label="Company">
                        <input value={company} readOnly className={mutedInputClassName} />
                      </EditFieldLabel>
                      <div className="grid gap-3">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <p className="mb-3 text-xs font-semibold text-slate-700">Primary contact</p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <EditFieldLabel label="Name 1">
                              <input value={name} onChange={(e) => setName(e.target.value)} className={inputClassName} placeholder="Contact Person 1" />
                            </EditFieldLabel>
                            <EditFieldLabel label="Contact number 1">
                              <input value={phoneNumber1} onChange={(e) => setPhoneNumber1(e.target.value)} className={inputClassName} placeholder="+91 9876543210" />
                            </EditFieldLabel>
                          </div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <p className="mb-3 text-xs font-semibold text-slate-700">Secondary contact</p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <EditFieldLabel label="Name 2">
                              <input value={contactPerson2} onChange={(e) => setContactPerson2(e.target.value)} className={inputClassName} placeholder="Contact Person 2" />
                            </EditFieldLabel>
                            <EditFieldLabel label="Contact number 2">
                              <input value={phoneNumber2} onChange={(e) => setPhoneNumber2(e.target.value)} className={inputClassName} placeholder="+91 9876543210" />
                            </EditFieldLabel>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <CustomerNameField
                      name={name}
                      company={company}
                      contactPerson2={contactPerson2}
                      phoneNumber1={phoneNumber1}
                      phoneNumber2={phoneNumber2}
                    />
                  )}
                </GridField>

                <GridField
                  label="Address"
                  action={
                    <button
                      type="button"
                      onClick={handleOpenMap}
                      disabled={!fullAddress.trim()}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-blue-200 bg-white text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Open address in maps"
                      title="Open address in maps"
                    >
                      <MapIcon />
                    </button>
                  }
                >
                  {canEdit ? (
                    <textarea value={fullAddress} onChange={(e) => setFullAddress(e.target.value)} className={textareaClassName} rows={4} />
                  ) : (
                    <InfoField label="Address" value={fullAddress} />
                  )}
                </GridField>

                <GridField label="Complaint details">
                  {canEdit ? (
                    <textarea value={complaintDetails} onChange={(e) => setComplaintDetails(e.target.value)} className={textareaClassName} rows={4} />
                  ) : (
                    <InfoField label="Complaint" value={complaintDetails || "Not specified"} />
                  )}
                </GridField>
              </div>

              <div className="space-y-4">
                <GridField label="Product">
                  {canEdit ? (
                    <ProductAutocomplete
                      products={productOptions}
                      label=""
                      value={product}
                      onChange={setProduct}
                      placeholder="Type product name"
                      inputClassName={inputClassName}
                      required
                    />
                  ) : (
                    <InfoField label="Product" value={product} />
                  )}
                </GridField>

                <GridField label="Call type">
                  {canEdit ? (
                    <select value={callType} onChange={(e) => handleCallTypeChange(e.target.value)} className={inputClassName}>
                      {callTypeOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <InfoField label="Call type" value={callType} />
                  )}
                </GridField>

                {isServiceCall && (
                  <GridField label="Service billing type">
                    {canEdit ? (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {BILLING_TYPE_OPTIONS.map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => toggleServiceBillingType(opt.id)}
                              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${serviceBillingType === opt.id ? "bg-blue-600 text-white" : "border border-slate-300 bg-white text-gray-700 hover:border-blue-300 hover:text-blue-700"}`}>
                              {opt.label}
                            </button>
                          ))}
                        </div>

                        {isChargeable && (
                          <div className="mt-2">
                            <EditFieldLabel label="Chargeable amount">
                              <input value={chargeableAmount} onChange={(e) => setChargeableAmount(e.target.value)} className={inputClassName} placeholder="Amount" />
                            </EditFieldLabel>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <InfoField label="Billing" value={formatServiceBillingType(serviceBillingType)} />
                        {isChargeable ? <InfoField label="Amount" value={chargeableAmount || "0"} /> : null}
                      </div>
                    )}
                  </GridField>
                )}

                <GridField label="Area">
                  {canEdit ? (
                    <select value={area} onChange={(e) => setArea(e.target.value)} className={inputClassName}>
                      {AREAS.map((a) => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  ) : (
                    <InfoField label="Area" value={area} />
                  )}
                </GridField>

                {canAssign ? (
                  <GridField label="Assignment">
                    {employees ? (
                      <div>
                        <AssignmentPicker
                          key={`${request.id}:${request.assignments?.map((assignment) => assignment.employeeId).join(",") ?? request.assignedToId ?? ""}`}
                          requestId={request.id}
                          employees={employees}
                          assignments={request.assignments}
                          defaultEmployeeId={request.assignedToId}
                          disabled={isReassignLocked}
                          disabledMessage={isReassignLocked ? "This completed service can no longer be reassigned." : undefined}
                        />
                        {isCompletedRequest ? (
                          <p className={`mt-2 text-xs font-medium ${isReassignLocked ? "text-slate-600" : "text-blue-700"}`}>
                            {isReassignLocked ? "Reassign window closed after 72 hours." : "Reassign available within 72 hours of completion."}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-3 space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-gray-600">
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
                  </GridField>
                ) : null}
              </div>
            </div>
          </div>

          {canEdit ? (
            <div className="grid gap-2 border-t border-slate-200 bg-white px-4 py-4 sm:flex sm:items-center sm:justify-end sm:gap-3 sm:px-6">
              <button type="button" onClick={handleDelete} disabled={isDeleting} className="w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">{isDeleting ? "Deleting..." : "Delete"}</button>
              <button type="submit" className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 sm:w-auto">Save changes</button>
            </div>
          ) : null}
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

function EditFieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-600">
        {label}
      </span>
      {children}
    </label>
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
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="block text-sm font-semibold text-blue-950">{label}</span>
        {action ? <div>{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-blue-950">
      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 whitespace-pre-line font-semibold">{value}</p>
    </div>
  );
}

function CustomerNameField({
  name,
  company,
  contactPerson2,
  phoneNumber1,
  phoneNumber2,
}: {
  name: string;
  company: string;
  contactPerson2: string;
  phoneNumber1: string;
  phoneNumber2: string;
}) {
  return (
    <div className="grid gap-3 text-sm text-blue-950">
      <InfoField label="Company" value={company} />
      <div className="grid gap-2">
        <ContactPairField nameLabel="Name 1" name={name} phoneLabel="Contact number 1" phoneNumber={phoneNumber1} />
        {contactPerson2.trim() || phoneNumber2.trim() ? (
          <ContactPairField
            nameLabel="Name 2"
            name={contactPerson2 || "Not provided"}
            phoneLabel="Contact number 2"
            phoneNumber={phoneNumber2}
          />
        ) : null}
      </div>
    </div>
  );
}

function ContactPairField({
  nameLabel,
  name,
  phoneLabel,
  phoneNumber,
}: {
  nameLabel: string;
  name: string;
  phoneLabel: string;
  phoneNumber: string;
}) {
  const displayValue = phoneNumber.trim() ? formatIndianPhoneNumber(phoneNumber) : "Not provided";
  const copyValue = getIndianPhoneCopyValue(phoneNumber);

  return (
    <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{nameLabel}</p>
        <p className="mt-1 break-words font-semibold text-blue-950">{name}</p>
      </div>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{phoneLabel}</p>
          <p className="mt-1 break-words font-semibold text-blue-950">{displayValue}</p>
        </div>
        {phoneNumber.trim() ? <CopyPhoneButton value={copyValue} /> : null}
      </div>
    </div>
  );
}

function MapIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21s7-5.2 7-12a7 7 0 1 0-14 0c0 6.8 7 12 7 12Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18 6 6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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

  return value || "Not specified";
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

function getCompletedAt(request: RequestDetails) {
  return (
    parseDateValue(request.closedAt) ??
    parseDateValue(request.statusSubmittedAt) ??
    parseDateValue(request.lastAttemptAt)
  );
}

function isCompletedReassignWindowOpen(request: RequestDetails) {
  const completedAt = getCompletedAt(request);

  if (!completedAt) {
    return false;
  }

  return Date.now() - completedAt.getTime() <= COMPLETED_REASSIGN_WINDOW_MS;
}
