"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { deleteServiceRequest, updateServiceRequestDetails } from "./actions";
import { CALL_TYPE_OPTIONS } from "@/lib/service-request-options";

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
  products,
  renderTrigger,
  onReady,
}: {
  request: RequestDetails;
  canEdit: boolean;
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
  const [company, setCompany] = React.useState(request.company);
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

  return (
    <>
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

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="my-4 w-full max-w-4xl rounded-[2rem] border border-blue-200 bg-white shadow-[0_20px_80px_rgba(15,23,42,0.12)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 border-b border-blue-200 bg-white px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-2xl font-semibold tracking-tight text-blue-950">
                    Docket Details
                  </h3>
                  <p className="text-sm leading-6 text-blue-600">{request.docketNumber}</p>
                </div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-blue-500">
                  Registered {formatRequestDateTime(request.createdAt)}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 p-5 sm:p-6">
              <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
                <GridField label="Name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  readOnly={!canEdit}
                  required
                  className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 outline-none transition placeholder:text-blue-400 focus:border-blue-400 focus:bg-white"
                />
              </GridField>

                <GridField label="Company">
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  readOnly={!canEdit}
                  required
                  className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 outline-none transition placeholder:text-blue-400 focus:border-blue-400 focus:bg-white"
                />
              </GridField>

                <GridField label="Phone Number 1">
                  <input
                    value={phoneNumber1}
                    onChange={(e) => setPhoneNumber1(e.target.value)}
                    readOnly={!canEdit}
                    required
                    className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 outline-none transition placeholder:text-blue-400 focus:border-blue-400 focus:bg-white"
                  />
                </GridField>

                <GridField label="Phone Number 2">
                  <input
                    value={phoneNumber2}
                    onChange={(e) => setPhoneNumber2(e.target.value)}
                    readOnly={!canEdit}
                    className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 outline-none transition placeholder:text-blue-400 focus:border-blue-400 focus:bg-white"
                  />
                </GridField>

                <GridField label="Area">
                  {canEdit ? (
                    <select
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 outline-none transition focus:border-blue-400 focus:bg-white"
                    >
                      {AREAS.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={area}
                      readOnly
                      className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950"
                    />
                  )}
                </GridField>

                <GridField label="Product">
                  {canEdit ? (
                    <select
                      value={product}
                      onChange={(e) => setProduct(e.target.value)}
                      className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 outline-none transition focus:border-blue-400 focus:bg-white"
                    >
                      {products.map((item) => (
                        <option key={item.id} value={item.name}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={product}
                      readOnly
                      className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950"
                    />
                  )}
                </GridField>

                <GridField label="Call Type">
                  {canEdit ? (
                    <select
                      value={callType}
                      onChange={(e) => handleCallTypeChange(e.target.value)}
                      className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 outline-none transition focus:border-blue-400 focus:bg-white"
                    >
                      {callTypeOptions.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={callType}
                      readOnly
                      className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950"
                    />
                  )}
                </GridField>

                {isServiceCall ? (
                  <div className="md:col-span-2">
                    <span className="mb-2 block text-sm font-medium text-blue-700">Service Type</span>
                    {canEdit ? (
                      <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
                        <div className="flex flex-wrap gap-4">
                          {BILLING_TYPE_OPTIONS.map((option) => (
                            <label key={option.id} className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-blue-900">
                              <input
                                type="checkbox"
                                checked={serviceBillingType === option.id}
                                onChange={() => toggleServiceBillingType(option.id)}
                                className="h-4 w-4 rounded border-blue-300 text-blue-700 focus:ring-blue-500"
                              />
                              <span>{option.label}</span>
                            </label>
                          ))}
                        </div>

                        {isChargeable ? (
                          <label className="mt-4 block">
                            <span className="mb-2 block text-sm font-medium text-blue-700">Chargeable Amount</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              inputMode="decimal"
                              value={chargeableAmount}
                              onChange={(e) => setChargeableAmount(e.target.value)}
                              className="w-full rounded-2xl border border-blue-200 bg-white px-4 py-3 text-blue-950 outline-none transition placeholder:text-blue-400 focus:border-blue-400"
                              placeholder="Enter amount"
                              required
                            />
                          </label>
                        ) : null}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
                        <p className="font-medium capitalize">{serviceBillingType || "Not specified"}</p>
                        <p className="mt-1 text-blue-700">
                          Amount: {formatCurrency(serviceBillingType === "chargeable" ? request.chargeableAmount ?? 0 : 0)}
                        </p>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              <GridField
                label="Full Address"
                action={
                  <button
                    type="button"
                    onClick={handleOpenMap}
                    disabled={!fullAddress.trim()}
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-600 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M12 21C15.866 21 19 17.866 19 14C19 10.134 14 4 12 4C10 4 5 10.134 5 14C5 17.866 8.134 21 12 21Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="12" cy="14" r="2.5" stroke="currentColor" strokeWidth="1.8"/>
                    </svg>
                    Map
                  </button>
                }
              >
                <textarea
                  rows={4}
                  value={fullAddress}
                  onChange={(e) => setFullAddress(e.target.value)}
                  readOnly={!canEdit}
                  required
                  className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 outline-none transition placeholder:text-blue-400 focus:border-blue-400 focus:bg-white"
                />
              </GridField>

              <GridField label="Complaint Details">
                <textarea
                  rows={3}
                  value={complaintDetails}
                  onChange={(e) => setComplaintDetails(e.target.value)}
                  readOnly={!canEdit}
                  required
                  className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 outline-none transition placeholder:text-blue-400 focus:border-blue-400 focus:bg-white"
                />
              </GridField>

              <div className="grid grid-cols-3 gap-2 border-t border-blue-200 pt-5 sm:gap-3">
                {canEdit ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="w-full rounded-full bg-rose-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </button>
                ) : (
                  <div />
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-full rounded-full bg-emerald-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-800"
                >
                  Close
                </button>
                {canEdit ? (
                  <button
                    type="submit"
                    className="w-full rounded-full bg-blue-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-800"
                  >
                    Save
                  </button>
                ) : (
                  <div />
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </>
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

function formatRequestDateTime(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

